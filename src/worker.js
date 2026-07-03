/// <reference types="@cloudflare/workers-types" />
// ---------------------------------------------------------------------------
// 🛡️ NATIVE WEB CRYPTO UTILITIES
// ---------------------------------------------------------------------------
const CryptoUtils = {
    uuidv4() {
        return crypto.randomUUID();
    },
    // 32 random bytes -> 64 hex chars. Used for password reset tokens instead
    // of a UUID, since it carries meaningfully more entropy for a bearer token
    // that grants a password change.
    generateResetToken() {
        const bytes = crypto.getRandomValues(new Uint8Array(32));
        return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    },
    async hashPassword(password) {
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const baseKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
        const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" }, baseKey, 256);
        const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
        const hashHex = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
        return `${saltHex}:${hashHex}`;
    },
    // Constant-time string comparison. Prevents an attacker from using
    // response-time differences to guess a hash byte-by-byte. Both inputs are
    // hex-encoded hashes so length-branching on unequal length is safe (an
    // attacker learns nothing new — hash length is fixed and public).
    timingSafeEqual(a, b) {
        if (a.length !== b.length)
            return false;
        let result = 0;
        for (let i = 0; i < a.length; i++) {
            result |= a.charCodeAt(i) ^ b.charCodeAt(i);
        }
        return result === 0;
    },
    async verifyPassword(password, storedHash) {
        const [saltHex, originalHashHex] = storedHash.split(':');
        if (!saltHex || !originalHashHex)
            return false;
        const salt = new Uint8Array(saltHex.match(/.{1,2}/g).map(b => parseInt(b, 16)));
        const baseKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
        const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" }, baseKey, 256);
        const candidateHashHex = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
        return CryptoUtils.timingSafeEqual(candidateHashHex, originalHashHex);
    },
    async generateToken(payload, secret) {
        const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
        const encPayload = btoa(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24) }));
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
                return null;
            return { artistId: payload.artistId };
        }
        catch {
            return null;
        }
    }
};
// ---------------------------------------------------------------------------
// 🧪 VALIDATION
// ---------------------------------------------------------------------------
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INCOME_TYPES = new Set(['appointment', 'walk-in', 'deposit', 'tip']);
const PAYMENT_METHODS = new Set(['cash', 'card', 'ath-movil', 'zelle', 'venmo', 'paypal']);
function isValidEmail(v) {
    return typeof v === 'string' && v.length <= 254 && EMAIL_RE.test(v);
}
function isNonEmptyString(v, maxLen = 255) {
    return typeof v === 'string' && v.trim().length > 0 && v.length <= maxLen;
}
// 8-128 chars. The upper bound isn't arbitrary hardening — PBKDF2 cost scales
// with input size, so capping length limits how expensive a single hashing
// call can be made by a malicious payload.
function isValidPassword(v) {
    return typeof v === 'string' && v.length >= 8 && v.length <= 128;
}
function validateTransactionPayload(data) {
    if (!data || typeof data !== 'object')
        return { ok: false, error: 'Missing transaction body.' };
    if (!isNonEmptyString(data.id, 64))
        return { ok: false, error: 'Missing or invalid id.' };
    if (typeof data.timestamp !== 'string' || isNaN(Date.parse(data.timestamp))) {
        return { ok: false, error: 'Missing or invalid timestamp.' };
    }
    if (data.clientName !== undefined && data.clientName !== null && typeof data.clientName !== 'string') {
        return { ok: false, error: 'Invalid clientName.' };
    }
    if (data.description !== undefined && data.description !== null && typeof data.description !== 'string') {
        return { ok: false, error: 'Invalid description.' };
    }
    if (!INCOME_TYPES.has(data.incomeType))
        return { ok: false, error: 'Invalid incomeType.' };
    if (!PAYMENT_METHODS.has(data.paymentMethod))
        return { ok: false, error: 'Invalid paymentMethod.' };
    const gross = Number(data.grossAmount);
    if (!Number.isFinite(gross) || gross <= 0 || gross > 1_000_000) {
        return { ok: false, error: 'grossAmount must be a positive number.' };
    }
    const cut = Number(data.shopCutPercentage);
    if (!Number.isFinite(cut) || cut < 0 || cut > 100) {
        return { ok: false, error: 'shopCutPercentage must be between 0 and 100.' };
    }
    return {
        ok: true,
        value: {
            id: data.id,
            timestamp: data.timestamp,
            clientName: (data.clientName || 'Anonymous Client').slice(0, 255),
            description: data.description ? String(data.description).slice(0, 1000) : null,
            incomeType: data.incomeType,
            paymentMethod: data.paymentMethod,
            grossAmount: Math.round(gross * 100) / 100,
            shopCutPercentage: Math.round(cut * 100) / 100,
        },
    };
}
async function parseJsonBody(request) {
    try {
        return await request.json();
    }
    catch {
        return null;
    }
}
export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
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
        const secret = env.JWT_SECRET;
        if (!secret)
            return jsonResponse({ error: 'Server misconfigured.' }, 500);
        try {
            // -----------------------------------------------------------------
            // 1. Auth Routing
            // -----------------------------------------------------------------
            if (url.pathname.startsWith('/api/auth/')) {
                // [POST] /api/auth/signup
                if (request.method === 'POST' && url.pathname === '/api/auth/signup') {
                    const body = await parseJsonBody(request);
                    if (!body)
                        return jsonResponse({ error: 'Invalid request body.' }, 400);
                    const { email, password, artistName } = body;
                    if (!isValidEmail(email))
                        return jsonResponse({ error: 'A valid email is required.' }, 400);
                    if (!isValidPassword(password))
                        return jsonResponse({ error: 'Password must be 8-128 characters.' }, 400);
                    if (!isNonEmptyString(artistName, 255))
                        return jsonResponse({ error: 'Artist name is required.' }, 400);
                    const normalizedEmail = email.toLowerCase().trim();
                    const existing = await env.DB.prepare('SELECT id FROM artists WHERE email = ?').bind(normalizedEmail).first();
                    if (existing)
                        return jsonResponse({ error: 'An account with that email already exists.' }, 409);
                    const hash = await CryptoUtils.hashPassword(password);
                    await env.DB.prepare('INSERT INTO artists (id, email, password_hash, artist_name) VALUES (?, ?, ?, ?)').bind(CryptoUtils.uuidv4(), normalizedEmail, hash, artistName.trim()).run();
                    return jsonResponse({ success: true }, 201);
                }
                // [POST] /api/auth/login
                if (request.method === 'POST' && url.pathname === '/api/auth/login') {
                    const body = await parseJsonBody(request);
                    if (!body)
                        return jsonResponse({ error: 'Invalid request body.' }, 400);
                    const { email, password } = body;
                    if (!isValidEmail(email) || typeof password !== 'string' || !password) {
                        // Generic on purpose — don't tell the caller which field was wrong.
                        return jsonResponse({ error: 'Invalid email or password.' }, 401);
                    }
                    const artist = await env.DB.prepare('SELECT id, password_hash FROM artists WHERE email = ?').bind(email.toLowerCase().trim()).first();
                    if (!artist || !(await CryptoUtils.verifyPassword(password, artist.password_hash))) {
                        return jsonResponse({ error: 'Invalid email or password.' }, 401);
                    }
                    return jsonResponse({ token: await CryptoUtils.generateToken({ artistId: artist.id }, secret) });
                }
                // [POST] /api/auth/forgot
                if (request.method === 'POST' && url.pathname === '/api/auth/forgot') {
                    const body = await parseJsonBody(request);
                    if (!body)
                        return jsonResponse({ error: 'Invalid request body.' }, 400);
                    const { email } = body;
                    // Same response regardless of validity/match — avoids leaking
                    // which emails have accounts (enumeration).
                    if (isValidEmail(email)) {
                        const normalizedEmail = email.toLowerCase().trim();
                        const artist = await env.DB.prepare('SELECT id FROM artists WHERE email = ?').bind(normalizedEmail).first();
                        if (artist) {
                            const token = CryptoUtils.generateResetToken();
                            const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
                            await env.DB.prepare('INSERT INTO password_resets (id, artist_id, token, expires_at) VALUES (?, ?, ?, ?)').bind(CryptoUtils.uuidv4(), artist.id, token, expiresAt).run();
                            // TODO: wire this up to real email delivery (Resend, Postmark,
                            // MailChannels, etc). Right now the token is only ever
                            // surfaced in dev logs — no email is actually sent yet.
                            if (env.ENVIRONMENT === 'development') {
                                console.log(`[DEV ONLY] Reset token for ${normalizedEmail}: ${token}`);
                            }
                        }
                    }
                    return jsonResponse({ message: 'If that email has an account, a reset link is on its way.' });
                }
                // [POST] /api/auth/reset
                if (request.method === 'POST' && url.pathname === '/api/auth/reset') {
                    const body = await parseJsonBody(request);
                    if (!body)
                        return jsonResponse({ error: 'Invalid request body.' }, 400);
                    const { token, newPassword } = body;
                    if (!isNonEmptyString(token, 128) || !isValidPassword(newPassword)) {
                        return jsonResponse({ error: 'Invalid or expired reset link.' }, 400);
                    }
                    const resetRecord = await env.DB.prepare('SELECT artist_id, expires_at, used FROM password_resets WHERE token = ?').bind(token).first();
                    // Same generic error for "not found", "already used", and
                    // "expired" — an attacker probing tokens learns nothing from the
                    // response about which case they hit.
                    const invalid = !resetRecord ||
                        resetRecord.used === 1 ||
                        new Date() > new Date(resetRecord.expires_at);
                    if (invalid) {
                        return jsonResponse({ error: 'Invalid or expired reset link.' }, 400);
                    }
                    const updatedHash = await CryptoUtils.hashPassword(newPassword);
                    await env.DB.batch([
                        env.DB.prepare('UPDATE artists SET password_hash = ? WHERE id = ?').bind(updatedHash, resetRecord.artist_id),
                        env.DB.prepare('UPDATE password_resets SET used = 1 WHERE token = ?').bind(token),
                    ]);
                    return jsonResponse({ success: true, message: 'Password updated. You can now sign in.' });
                }
            }
            // -----------------------------------------------------------------
            // 2. Auth Middleware
            // -----------------------------------------------------------------
            const authHeader = request.headers.get("Authorization");
            if (!authHeader?.startsWith("Bearer "))
                return jsonResponse({ error: "Access denied." }, 401);
            const session = await CryptoUtils.verifyToken(authHeader.split(" ")[1], secret);
            if (!session)
                return jsonResponse({ error: "Invalid or expired session." }, 401);
            // -----------------------------------------------------------------
            // 3. Protected Ledger Routes
            // -----------------------------------------------------------------
            if (url.pathname === '/api/transactions') {
                if (request.method === 'GET') {
                    // LIMIT is a basic safety net, not real pagination — worth
                    // revisiting with proper offset/cursor pagination once artists
                    // start accumulating thousands of sessions.
                    const { results } = await env.DB.prepare('SELECT * FROM transactions WHERE artist_id = ? ORDER BY timestamp DESC LIMIT 1000').bind(session.artistId).all();
                    return jsonResponse(results);
                }
                if (request.method === 'POST') {
                    const body = await parseJsonBody(request);
                    if (!body)
                        return jsonResponse({ error: 'Invalid request body.' }, 400);
                    const validated = validateTransactionPayload(body);
                    if (!validated.ok)
                        return jsonResponse({ error: validated.error }, 400);
                    const tx = validated.value;
                    // Net is computed server-side rather than trusted from the
                    // client, so a tampered payload can't record a net amount that
                    // doesn't match gross/cut.
                    const netAmount = Math.round(tx.grossAmount * (1 - tx.shopCutPercentage / 100) * 100) / 100;
                    await env.DB.prepare(`INSERT INTO transactions
             (id, artist_id, timestamp, clientName, description, incomeType, paymentMethod, grossAmount, shopCutPercentage, netAmount)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(tx.id, session.artistId, tx.timestamp, tx.clientName, tx.description, tx.incomeType, tx.paymentMethod, tx.grossAmount, tx.shopCutPercentage, netAmount).run();
                    return jsonResponse({ success: true, id: tx.id, netAmount }, 201);
                }
            }
            return jsonResponse({ error: 'Not found' }, 404);
        }
        catch (e) {
            // Log the real error server-side for debugging, but never echo raw
            // error internals (DB constraint text, stack traces, etc.) back to
            // the client.
            console.error('Unhandled worker error:', e);
            return jsonResponse({ error: 'Internal server error.' }, 500);
        }
    }
};
