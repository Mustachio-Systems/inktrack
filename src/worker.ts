/// <reference types="@cloudflare/workers-types" />

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
}

// 🛡️ NATIVE WEB CRYPTO UTILITIES
const CryptoUtils = {
  uuidv4(): string {
    return crypto.randomUUID();
  },

  async hashPassword(password: string): Promise<string> {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const baseKey = await crypto.subtle.importKey(
      "raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]
    );
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" }, baseKey, 256
    );
    const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
    const hashHex = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
    return `${saltHex}:${hashHex}`;
  },

  async verifyPassword(password: string, storedHash: string): Promise<boolean> {
    const [saltHex, originalHashHex] = storedHash.split(':');
    if (!saltHex || !originalHashHex) return false;
    const salt = new Uint8Array(saltHex.match(/.{1,2}/g)!.map(b => parseInt(b, 16)));
    const baseKey = await crypto.subtle.importKey(
      "raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]
    );
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" }, baseKey, 256
    );
    const candidateHashHex = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
    return candidateHashHex === originalHashHex;
  },

  async generateToken(payload: { artistId: string }, secret: string): Promise<string> {
    const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const encPayload = btoa(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24) }));
    const key = await crypto.subtle.importKey(
      "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
    );
    const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${header}.${encPayload}`));
    const sigHex = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
    return `${header}.${encPayload}.${sigHex}`;
  },

  async verifyToken(token: string, secret: string): Promise<{ artistId: string } | null> {
    try {
      const [header, encPayload, sigHex] = token.split('.');
      const key = await crypto.subtle.importKey(
        "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]
      );
      const verified = await crypto.subtle.verify(
        "HMAC", key, new Uint8Array(sigHex.match(/.{1,2}/g)!.map(b => parseInt(b, 16))), new TextEncoder().encode(`${header}.${encPayload}`)
      );
      if (!verified) return null;
      const payload = JSON.parse(atob(encPayload));
      if (Math.floor(Date.now() / 1000) > payload.exp) return null;
      return { artistId: payload.artistId };
    } catch {
      return null;
    }
  }
};

export default {
  // Added ExecutionContext parameter (ctx) for proper background task management
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const jsonResponse = (data: any, status = 200) => new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status
    });

    const secret = env.JWT_SECRET;
    if (!secret) return jsonResponse({ error: 'Missing JWT_SECRET configuration' }, 500);

    try {
      // 1. Auth Routing
      if (url.pathname.startsWith('/api/auth/')) {
        // [POST] /api/auth/signup
        if (request.method === 'POST' && url.pathname === '/api/auth/signup') {
            const { email, password, artistName } = await request.json() as any;
            const hash = await CryptoUtils.hashPassword(password);
            await env.DB.prepare('INSERT INTO artists (id, email, password_hash, artist_name) VALUES (?, ?, ?, ?)').bind(CryptoUtils.uuidv4(), email.toLowerCase().trim(), hash, artistName).run();
            return jsonResponse({ success: true }, 201);
        }
        // [POST] /api/auth/login
        if (request.method === 'POST' && url.pathname === '/api/auth/login') {
            const { email, password } = await request.json() as any;
            const artist = await env.DB.prepare('SELECT id, password_hash FROM artists WHERE email = ?').bind(email.toLowerCase().trim()).first<any>();
            if (!artist || !(await CryptoUtils.verifyPassword(password, artist.password_hash))) return jsonResponse({ error: 'Unauthorized' }, 401);
            return jsonResponse({ token: await CryptoUtils.generateToken({ artistId: artist.id }, secret) });
        }
        // [POST] /api/auth/forgot
        if (request.method === 'POST' && url.pathname === '/api/auth/forgot') {
            const { email } = await request.json() as any;
            const artist = await env.DB.prepare('SELECT id FROM artists WHERE email = ?').bind(email.toLowerCase().trim()).first<any>();
            if (artist) {
                const token = CryptoUtils.uuidv4();
                await env.DB.prepare('INSERT INTO password_resets (id, artist_id, token, expires_at) VALUES (?, ?, ?, ?)').bind(CryptoUtils.uuidv4(), artist.id, token, new Date(Date.now() + 3600000).toISOString()).run();
                console.log(`[QA TRACE LOG] Token for ${email}: ${token}`);
            }
            return jsonResponse({ message: 'Request processed.' });
        }
      }

      // 2. Auth Middleware
      const authHeader = request.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) return jsonResponse({ error: "Access denied." }, 401);
      
      const session = await CryptoUtils.verifyToken(authHeader.split(" ")[1], secret);
      if (!session) return jsonResponse({ error: "Invalid session." }, 401);

      // 3. Protected Ledger Routes
      if (url.pathname === '/api/transactions') {
        if (request.method === 'GET') {
           const { results } = await env.DB.prepare('SELECT * FROM transactions WHERE artist_id = ? ORDER BY timestamp DESC').bind(session.artistId).all();
           return jsonResponse(results);
        }
        if (request.method === 'POST') {
           const data = await request.json() as any;
           await env.DB.prepare('INSERT INTO transactions (id, artist_id, timestamp, clientName, description, incomeType, paymentMethod, grossAmount, shopCutPercentage, netAmount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(data.id, session.artistId, data.timestamp, data.clientName, data.description, data.incomeType, data.paymentMethod, data.grossAmount, data.shopCutPercentage, data.netAmount).run();
           return jsonResponse({ success: true }, 201);
        }
      }

      return jsonResponse({ error: 'Not found' }, 404);
    } catch (e: any) {
      return jsonResponse({ error: e.message }, 500);
    }
  }
  
};