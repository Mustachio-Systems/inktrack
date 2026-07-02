/// <reference types="@cloudflare/workers-types" />
// 🛡️ NATIVE WEB CRYPTO UTILITIES (Isolate-Compatible Security Layer)
const CryptoUtils = {
    uuidv4() {
        return crypto.randomUUID();
    },
    async hashPassword(password) {
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const baseKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
        const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" }, baseKey, 256);
        const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
        const hashHex = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
        return `${saltHex}:${hashHex}`;
    },
    async verifyPassword(password, storedHash) {
        const [saltHex, originalHashHex] = storedHash.split(':');
        const salt = new Uint8Array(saltHex.match(/.{1,2}/g).map(b => parseInt(b, 16)));
        const baseKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
        const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" }, baseKey, 256);
        const candidateHashHex = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
        return candidateHashHex === originalHashHex;
    },
    async generateToken(payload, secret) {
        const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
        const encPayload = btoa(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24) })); // 24hr Session Expiry
        const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
        const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${header}.${encPayload}`));
        const sigHex = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
        return `${header}.${encPayload}.${sigHex}`;
    },
    async verifyToken(token, secret) {
        try {
            const [header, encPayload, sigHex] = token.split('.');
            const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
            const verified = await crypto.subtle.verify("HMAC", key, new Uint8Array(sigHex.match(/.{1,2}/g).map(b => parseInt(b, 16))), new TextEncoder().encode(`${header}.${encPayload}`));
            if (!verified)
                return null;
            const payload = JSON.parse(atob(encPayload));
            if (Math.floor(Date.now() / 1000) > payload.exp)
                return null; // Token expiration verification
            return { artistId: payload.artistId };
        }
        catch {
            return null;
        }
    }
};
export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        // 🛡️ Strict CORS Headers (Must include Authorization for token validation headers)
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        };
        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }
        const jsonResponse = (data, status = 200) => new Response(JSON.stringify(data), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status
        });
        const secret = env.JWT_SECRET || "fallback-local-testing-secret-key-matrix-99";
        try {
            // ---------------------------------------------------------
            // 🔓 PUBLIC AUTHENTICATION ROUTING REGISTRIES
            // ---------------------------------------------------------
            // POST /api/auth/signup
            if (request.method === 'POST' && url.pathname === '/api/auth/signup') {
                const { email, password, artistName } = await request.json();
                if (!email || !password || !artistName) {
                    return jsonResponse({ error: 'Missing strict required registration parameters.' }, 400);
                }
                const normalizedEmail = email.toLowerCase().trim();
                const existing = await env.DB.prepare('SELECT id FROM artists WHERE email = ?').bind(normalizedEmail).first();
                if (existing) {
                    return jsonResponse({ error: 'Identity conflict: Email endpoint already provisioned.' }, 409);
                }
                const artistId = CryptoUtils.uuidv4();
                const passwordHash = await CryptoUtils.hashPassword(password);
                await env.DB.prepare('INSERT INTO artists (id, email, password_hash, artist_name) VALUES (?, ?, ?, ?)').bind(artistId, normalizedEmail, passwordHash, artistName).run();
                return jsonResponse({ success: true, message: 'Artist footprint initiated.' }, 201);
            }
            // POST /api/auth/login
            if (request.method === 'POST' && url.pathname === '/api/auth/login') {
                const { email, password } = await request.json();
                const normalizedEmail = email.toLowerCase().trim();
                const artist = await env.DB.prepare('SELECT id, password_hash FROM artists WHERE email = ?').bind(normalizedEmail).first();
                if (!artist || !(await CryptoUtils.verifyPassword(password, artist.password_hash))) {
                    return jsonResponse({ error: 'Credential validation match failure.' }, 401);
                }
                const token = await CryptoUtils.generateToken({ artistId: artist.id }, secret);
                return jsonResponse({ token }, 200);
            }
            // POST /api/auth/forgot
            if (request.method === 'POST' && url.pathname === '/api/auth/forgot') {
                const { email } = await request.json();
                const normalizedEmail = email.toLowerCase().trim();
                const artist = await env.DB.prepare('SELECT id FROM artists WHERE email = ?').bind(normalizedEmail).first();
                // Anti-enumeration payload mask (returns 200 regardless of match)
                if (artist) {
                    const resetId = CryptoUtils.uuidv4();
                    const rawBytes = crypto.getRandomValues(new Uint8Array(24));
                    const resetToken = Array.from(rawBytes).map(b => b.toString(16).padStart(2, '0')).join('');
                    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
                    await env.DB.prepare('INSERT INTO password_resets (id, artist_id, token, expires_at) VALUES (?, ?, ?, ?)').bind(resetId, artist.id, resetToken, expiresAt).run();
                    console.log(`[QA TRACE LOG] Verification token for ${normalizedEmail}: ${resetToken}`);
                }
                return jsonResponse({ message: 'If credentials match standard records, a verification token has been issued.' });
            }
            // 🔄 NEW ADDITION: POST /api/auth/reset (Commits new password)
            if (request.method === 'POST' && url.pathname === '/api/auth/reset') {
                const { token, newPassword } = await request.json();
                if (!token || !newPassword) {
                    return jsonResponse({ error: 'Missing security verification parameters.' }, 400);
                }
                // Validate token identity, lifespans, and previous usage records
                const resetRecord = await env.DB.prepare('SELECT artist_id, expires_at, used FROM password_resets WHERE token = ?').bind(token).first();
                if (!resetRecord) {
                    return jsonResponse({ error: 'Invalid token matching profile.' }, 400);
                }
                if (resetRecord.used === 1) {
                    return jsonResponse({ error: 'Security breach threat: This single-use validation token has already been consumed.' }, 400);
                }
                if (new Date().toISOString() > resetRecord.expires_at) {
                    return jsonResponse({ error: 'Token lifespan expired. Please request a new link.' }, 400);
                }
                // Hash new candidate password matrix
                const updatedHash = await CryptoUtils.hashPassword(newPassword);
                // Atomic Transaction: Commit password changes and void the reset token
                await env.DB.batch([
                    env.DB.prepare('UPDATE artists SET password_hash = ? WHERE id = ?').bind(updatedHash, resetRecord.artist_id),
                    env.DB.prepare('UPDATE password_resets SET used = 1 WHERE token = ?').bind(token)
                ]);
                return jsonResponse({ success: true, message: 'Password database registry successfully updated.' });
            }
            // ---------------------------------------------------------
            // 🛡️ ISOLATED TOKEN MIDDLEWARE ENFORCEMENT BOUNDARY
            // ---------------------------------------------------------
            const authHeader = request.headers.get("Authorization");
            if (!authHeader || !authHeader.startsWith("Bearer ")) {
                return jsonResponse({ error: "Access denied. Valid authorization token signature required." }, 401);
            }
            const session = await CryptoUtils.verifyToken(authHeader.split(" ")[1], secret);
            if (!session) {
                return jsonResponse({ error: "Session fingerprint has expired or is corrupt." }, 401);
            }
            const { artistId } = session;
            // ---------------------------------------------------------
            // 📈 PROTECTED LEDGER TRANSACTION ROUTING
            // ---------------------------------------------------------
            // GET /api/transactions (Tenant-Isolated Feed)
            if (request.method === 'GET' && url.pathname === '/api/transactions') {
                const { results } = await env.DB.prepare('SELECT id, timestamp, clientName, description, incomeType, paymentMethod, grossAmount, shopCutPercentage, netAmount FROM transactions WHERE artist_id = ? ORDER BY timestamp DESC').bind(artistId).all();
                return jsonResponse(results);
            }
            // POST /api/transactions (Tenant-Bound Direct Injection)
            if (request.method === 'POST' && url.pathname === '/api/transactions') {
                const data = await request.json();
                if (!data.id || !data.grossAmount || !data.incomeType || !data.paymentMethod) {
                    return jsonResponse({ error: 'Missing strict required transaction variables.' }, 400);
                }
                await env.DB.prepare(`INSERT INTO transactions (id, artist_id, timestamp, clientName, description, incomeType, paymentMethod, grossAmount, shopCutPercentage, netAmount)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(data.id, artistId, data.timestamp, data.clientName || 'Anonymous Client', data.description || null, data.incomeType, data.paymentMethod, data.grossAmount, data.shopCutPercentage, data.netAmount).run();
                return jsonResponse({ success: true, id: data.id }, 201);
            }
            return jsonResponse({ error: 'Endpoint route context not found.' }, 404);
        }
        catch (error) {
            return jsonResponse({ error: error.message || 'Internal Edge Runtime Exception' }, 500);
        }
    },
};
