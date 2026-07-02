var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/worker.ts
var CryptoUtils = {
  uuidv4() {
    return crypto.randomUUID();
  },
  async hashPassword(password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const baseKey = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(password),
      "PBKDF2",
      false,
      ["deriveBits"]
    );
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt, iterations: 1e5, hash: "SHA-256" },
      baseKey,
      256
    );
    const saltHex = Array.from(salt).map((b) => b.toString(16).padStart(2, "0")).join("");
    const hashHex = Array.from(new Uint8Array(bits)).map((b) => b.toString(16).padStart(2, "0")).join("");
    return `${saltHex}:${hashHex}`;
  },
  async verifyPassword(password, storedHash) {
    const [saltHex, originalHashHex] = storedHash.split(":");
    if (!saltHex || !originalHashHex) return false;
    const salt = new Uint8Array(saltHex.match(/.{1,2}/g).map((b) => parseInt(b, 16)));
    const baseKey = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(password),
      "PBKDF2",
      false,
      ["deriveBits"]
    );
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt, iterations: 1e5, hash: "SHA-256" },
      baseKey,
      256
    );
    const candidateHashHex = Array.from(new Uint8Array(bits)).map((b) => b.toString(16).padStart(2, "0")).join("");
    return candidateHashHex === originalHashHex;
  },
  async generateToken(payload, secret) {
    const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const encPayload = btoa(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1e3) + 60 * 60 * 24 }));
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${header}.${encPayload}`));
    const sigHex = Array.from(new Uint8Array(signature)).map((b) => b.toString(16).padStart(2, "0")).join("");
    return `${header}.${encPayload}.${sigHex}`;
  },
  async verifyToken(token, secret) {
    try {
      const [header, encPayload, sigHex] = token.split(".");
      const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["verify"]
      );
      const verified = await crypto.subtle.verify(
        "HMAC",
        key,
        new Uint8Array(sigHex.match(/.{1,2}/g).map((b) => parseInt(b, 16))),
        new TextEncoder().encode(`${header}.${encPayload}`)
      );
      if (!verified) return null;
      const payload = JSON.parse(atob(encPayload));
      if (Math.floor(Date.now() / 1e3) > payload.exp) return null;
      return { artistId: payload.artistId };
    } catch {
      return null;
    }
  }
};
var worker_default = {
  // Added ExecutionContext parameter (ctx) for proper background task management
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    };
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }
    const jsonResponse = /* @__PURE__ */ __name((data, status = 200) => new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status
    }), "jsonResponse");
    const secret = env.JWT_SECRET;
    if (!secret) return jsonResponse({ error: "Missing JWT_SECRET configuration" }, 500);
    try {
      if (url.pathname.startsWith("/api/auth/")) {
        if (request.method === "POST" && url.pathname === "/api/auth/signup") {
          const { email, password, artistName } = await request.json();
          const hash = await CryptoUtils.hashPassword(password);
          await env.DB.prepare("INSERT INTO artists (id, email, password_hash, artist_name) VALUES (?, ?, ?, ?)").bind(CryptoUtils.uuidv4(), email.toLowerCase().trim(), hash, artistName).run();
          return jsonResponse({ success: true }, 201);
        }
        if (request.method === "POST" && url.pathname === "/api/auth/login") {
          const { email, password } = await request.json();
          const artist = await env.DB.prepare("SELECT id, password_hash FROM artists WHERE email = ?").bind(email.toLowerCase().trim()).first();
          if (!artist || !await CryptoUtils.verifyPassword(password, artist.password_hash)) return jsonResponse({ error: "Unauthorized" }, 401);
          return jsonResponse({ token: await CryptoUtils.generateToken({ artistId: artist.id }, secret) });
        }
        if (request.method === "POST" && url.pathname === "/api/auth/forgot") {
          const { email } = await request.json();
          const artist = await env.DB.prepare("SELECT id FROM artists WHERE email = ?").bind(email.toLowerCase().trim()).first();
          if (artist) {
            const token = CryptoUtils.uuidv4();
            await env.DB.prepare("INSERT INTO password_resets (id, artist_id, token, expires_at) VALUES (?, ?, ?, ?)").bind(CryptoUtils.uuidv4(), artist.id, token, new Date(Date.now() + 36e5).toISOString()).run();
            console.log(`[QA TRACE LOG] Token for ${email}: ${token}`);
          }
          return jsonResponse({ message: "Request processed." });
        }
      }
      const authHeader = request.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) return jsonResponse({ error: "Access denied." }, 401);
      const session = await CryptoUtils.verifyToken(authHeader.split(" ")[1], secret);
      if (!session) return jsonResponse({ error: "Invalid session." }, 401);
      if (url.pathname === "/api/transactions") {
        if (request.method === "GET") {
          const { results } = await env.DB.prepare("SELECT * FROM transactions WHERE artist_id = ? ORDER BY timestamp DESC").bind(session.artistId).all();
          return jsonResponse(results);
        }
        if (request.method === "POST") {
          const data = await request.json();
          await env.DB.prepare("INSERT INTO transactions (id, artist_id, timestamp, clientName, description, incomeType, paymentMethod, grossAmount, shopCutPercentage, netAmount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(data.id, session.artistId, data.timestamp, data.clientName, data.description, data.incomeType, data.paymentMethod, data.grossAmount, data.shopCutPercentage, data.netAmount).run();
          return jsonResponse({ success: true }, 201);
        }
      }
      return jsonResponse({ error: "Not found" }, 404);
    } catch (e) {
      return jsonResponse({ error: e.message }, 500);
    }
  }
};
export {
  worker_default as default
};
//# sourceMappingURL=worker.js.map
