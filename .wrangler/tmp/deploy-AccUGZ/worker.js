var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/worker.ts
var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
var INCOME_TYPES = /* @__PURE__ */ new Set(["appointment", "walk-in", "deposit", "tip"]);
var PAYMENT_METHODS = /* @__PURE__ */ new Set(["cash", "card", "ath-movil", "zelle", "venmo", "paypal"]);
var RESET_TOKEN_TTL_MS = 60 * 60 * 1e3;
var SESSION_TTL_SECONDS = 60 * 60 * 24;
var CryptoUtils = {
  uuidv4() {
    return crypto.randomUUID();
  },
  generateResetToken() {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
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
      {
        name: "PBKDF2",
        salt,
        iterations: 1e5,
        hash: "SHA-256"
      },
      baseKey,
      256
    );
    const saltHex = Array.from(salt).map((byte) => byte.toString(16).padStart(2, "0")).join("");
    const hashHex = Array.from(new Uint8Array(bits)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
    return `${saltHex}:${hashHex}`;
  },
  timingSafeEqual(a, b) {
    if (a.length !== b.length) return false;
    let result = 0;
    for (let index = 0; index < a.length; index += 1) {
      result |= a.charCodeAt(index) ^ b.charCodeAt(index);
    }
    return result === 0;
  },
  async verifyPassword(password, storedHash) {
    const [saltHex, originalHashHex] = storedHash.split(":");
    if (!saltHex || !originalHashHex || !/^[a-f0-9]+$/i.test(saltHex) || !/^[a-f0-9]+$/i.test(originalHashHex)) {
      return false;
    }
    const saltPairs = saltHex.match(/.{1,2}/g);
    if (!saltPairs) return false;
    const salt = new Uint8Array(saltPairs.map((pair) => parseInt(pair, 16)));
    const baseKey = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(password),
      "PBKDF2",
      false,
      ["deriveBits"]
    );
    const bits = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt,
        iterations: 1e5,
        hash: "SHA-256"
      },
      baseKey,
      256
    );
    const candidateHashHex = Array.from(new Uint8Array(bits)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
    return CryptoUtils.timingSafeEqual(candidateHashHex, originalHashHex);
  },
  async generateToken(payload, secret) {
    const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const encodedPayload = btoa(
      JSON.stringify({
        ...payload,
        exp: Math.floor(Date.now() / 1e3) + SESSION_TTL_SECONDS
      })
    );
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signature = await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(`${header}.${encodedPayload}`)
    );
    const signatureHex = Array.from(new Uint8Array(signature)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
    return `${header}.${encodedPayload}.${signatureHex}`;
  },
  async verifyToken(token, secret) {
    try {
      const [header, encodedPayload, signatureHex] = token.split(".");
      if (!header || !encodedPayload || !signatureHex || !/^[a-f0-9]+$/i.test(signatureHex)) {
        return null;
      }
      const signaturePairs = signatureHex.match(/.{1,2}/g);
      if (!signaturePairs) return null;
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
        new Uint8Array(signaturePairs.map((pair) => parseInt(pair, 16))),
        new TextEncoder().encode(`${header}.${encodedPayload}`)
      );
      if (!verified) return null;
      const payload = JSON.parse(atob(encodedPayload));
      if (typeof payload.artistId !== "string" || typeof payload.exp !== "number" || Math.floor(Date.now() / 1e3) > payload.exp) {
        return null;
      }
      return { artistId: payload.artistId };
    } catch {
      return null;
    }
  }
};
function isValidEmail(value) {
  return typeof value === "string" && value.length <= 254 && EMAIL_RE.test(value);
}
__name(isValidEmail, "isValidEmail");
function isNonEmptyString(value, maxLength = 255) {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;
}
__name(isNonEmptyString, "isNonEmptyString");
function isValidPassword(value) {
  return typeof value === "string" && value.length >= 8 && value.length <= 128;
}
__name(isValidPassword, "isValidPassword");
function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };
    return entities[character];
  });
}
__name(escapeHtml, "escapeHtml");
function getResetUrl(appUrl, token) {
  const url = new URL("/reset-password", appUrl);
  url.searchParams.set("token", token);
  return url.toString();
}
__name(getResetUrl, "getResetUrl");
function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...extraHeaders
    }
  });
}
__name(jsonResponse, "jsonResponse");
function htmlEmailShell(title, bodyHtml) {
  return `
<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#f4efe7;color:#16130f;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:600px;margin:0 auto;padding:32px 18px;">
      <div style="background:#16130f;color:#efe7d8;padding:20px 24px;">
        <div style="font-size:22px;font-weight:700;letter-spacing:.4px;">
          inktrack<span style="color:#c39a48;">.</span>
        </div>
        <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#c39a48;margin-top:4px;">
          Artist Revenue Console
        </div>
      </div>
      <div style="background:#ffffff;padding:30px 24px;border:1px solid #e4ddd1;">
        <h1 style="margin:0 0 16px;font-size:26px;line-height:1.2;color:#16130f;">
          ${title}
        </h1>
        ${bodyHtml}
      </div>
      <div style="padding:18px 10px;color:#786f65;font-size:12px;line-height:1.5;">
        InkTrack helps artists keep a clear ledger of sessions, earnings, and shop splits.
      </div>
    </div>
  </body>
</html>`;
}
__name(htmlEmailShell, "htmlEmailShell");
async function sendEmail(env, email) {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM || !env.APP_URL) {
    throw new Error("Email configuration is incomplete.");
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [email.to],
      subject: email.subject,
      text: email.text,
      html: email.html
    })
  });
  if (!response.ok) {
    const resendError = await response.text();
    console.error("Resend email delivery failed:", response.status, resendError);
    throw new Error(`Resend rejected email request with status ${response.status}.`);
  }
}
__name(sendEmail, "sendEmail");
async function sendWelcomeEmail(env, email, artistName) {
  const safeName = escapeHtml(artistName);
  const dashboardUrl = new URL("/dashboard", env.APP_URL).toString();
  await sendEmail(env, {
    to: email,
    subject: "Welcome to InkTrack",
    text: `Welcome to InkTrack, ${artistName}. Your ledger is ready. Open InkTrack: ${dashboardUrl}`,
    html: htmlEmailShell(
      `Welcome to InkTrack, ${safeName}.`,
      `
        <p style="font-size:16px;line-height:1.6;margin:0 0 16px;">
          Your artist ledger is ready. You can now log sessions, track weekly income,
          review shop splits, and see how your month is progressing.
        </p>
        <p style="margin:24px 0;">
          <a href="${dashboardUrl}" style="display:inline-block;background:#a83a2c;color:#ffffff;text-decoration:none;padding:13px 18px;font-weight:700;border-radius:4px;">
            Open InkTrack
          </a>
        </p>
        <p style="font-size:12px;color:#786f65;line-height:1.5;margin:20px 0 0;">
          If you did not create this account, you can safely ignore this email.
        </p>`
    )
  });
}
__name(sendWelcomeEmail, "sendWelcomeEmail");
async function sendPasswordResetEmail(env, email, resetUrl) {
  await sendEmail(env, {
    to: email,
    subject: "Reset your InkTrack password",
    text: `We received a request to reset your InkTrack password. Use this link within one hour: ${resetUrl}`,
    html: htmlEmailShell(
      "Reset your password",
      `
        <p style="font-size:16px;line-height:1.6;margin:0 0 16px;">
          We received a request to reset the password for your InkTrack account.
        </p>
        <p style="margin:24px 0;">
          <a href="${resetUrl}" style="display:inline-block;background:#a83a2c;color:#ffffff;text-decoration:none;padding:13px 18px;font-weight:700;border-radius:4px;">
            Reset Password
          </a>
        </p>
        <p style="font-size:14px;line-height:1.6;margin:0;">
          This reset link expires in <strong>1 hour</strong>.
        </p>
        <p style="font-size:12px;color:#786f65;line-height:1.5;margin:20px 0 0;">
          If you did not request a password reset, you can safely ignore this email.
        </p>`
    )
  });
}
__name(sendPasswordResetEmail, "sendPasswordResetEmail");
function validateTransactionPayload(data) {
  if (!data || typeof data !== "object") {
    return { ok: false, error: "Missing transaction body." };
  }
  const transaction = data;
  if (!isNonEmptyString(transaction.id, 64)) {
    return { ok: false, error: "Missing or invalid id." };
  }
  if (typeof transaction.timestamp !== "string" || Number.isNaN(Date.parse(transaction.timestamp))) {
    return { ok: false, error: "Missing or invalid timestamp." };
  }
  if (transaction.clientName !== void 0 && transaction.clientName !== null && typeof transaction.clientName !== "string") {
    return { ok: false, error: "Invalid clientName." };
  }
  if (transaction.description !== void 0 && transaction.description !== null && typeof transaction.description !== "string") {
    return { ok: false, error: "Invalid description." };
  }
  if (typeof transaction.incomeType !== "string" || !INCOME_TYPES.has(transaction.incomeType)) {
    return { ok: false, error: "Invalid incomeType." };
  }
  if (typeof transaction.paymentMethod !== "string" || !PAYMENT_METHODS.has(transaction.paymentMethod)) {
    return { ok: false, error: "Invalid paymentMethod." };
  }
  const gross = Number(transaction.grossAmount);
  if (!Number.isFinite(gross) || gross <= 0 || gross > 1e6) {
    return { ok: false, error: "grossAmount must be a positive number." };
  }
  const cut = Number(transaction.shopCutPercentage);
  if (!Number.isFinite(cut) || cut < 0 || cut > 100) {
    return { ok: false, error: "shopCutPercentage must be between 0 and 100." };
  }
  return {
    ok: true,
    value: {
      id: transaction.id,
      timestamp: transaction.timestamp,
      clientName: typeof transaction.clientName === "string" && transaction.clientName.trim() ? transaction.clientName.trim().slice(0, 255) : "Anonymous Client",
      description: typeof transaction.description === "string" && transaction.description.trim() ? transaction.description.trim().slice(0, 1e3) : null,
      incomeType: transaction.incomeType,
      paymentMethod: transaction.paymentMethod,
      grossAmount: Math.round(gross * 100) / 100,
      shopCutPercentage: Math.round(cut * 100) / 100
    }
  };
}
__name(validateTransactionPayload, "validateTransactionPayload");
async function parseJsonBody(request) {
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return null;
    }
    return body;
  } catch {
    return null;
  }
}
__name(parseJsonBody, "parseJsonBody");
var worker_default = {
  async fetch(request, env, _ctx) {
    const url = new URL(request.url);
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    };
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }
    const respond = /* @__PURE__ */ __name((data, status = 200) => jsonResponse(data, status, corsHeaders), "respond");
    if (!env.JWT_SECRET) {
      console.error("JWT_SECRET is missing.");
      return respond({ error: "Server misconfigured." }, 500);
    }
    try {
      if (url.pathname.startsWith("/api/auth/")) {
        if (request.method === "POST" && url.pathname === "/api/auth/signup") {
          const body = await parseJsonBody(request);
          if (!body) return respond({ error: "Invalid request body." }, 400);
          const { email, password, artistName } = body;
          if (!isValidEmail(email)) {
            return respond({ error: "A valid email is required." }, 400);
          }
          if (!isValidPassword(password)) {
            return respond({ error: "Password must be 8-128 characters." }, 400);
          }
          if (!isNonEmptyString(artistName, 255)) {
            return respond({ error: "Artist name is required." }, 400);
          }
          const normalizedEmail = email.toLowerCase().trim();
          const cleanArtistName = artistName.trim();
          const existing = await env.DB.prepare("SELECT id FROM artists WHERE email = ?").bind(normalizedEmail).first();
          if (existing) {
            return respond({ error: "An account with that email already exists." }, 409);
          }
          const artistId = CryptoUtils.uuidv4();
          const passwordHash = await CryptoUtils.hashPassword(password);
          await env.DB.prepare(
            "INSERT INTO artists (id, email, password_hash, artist_name) VALUES (?, ?, ?, ?)"
          ).bind(artistId, normalizedEmail, passwordHash, cleanArtistName).run();
          try {
            await sendWelcomeEmail(env, normalizedEmail, cleanArtistName);
          } catch (emailError) {
            console.error("Welcome email could not be sent:", emailError);
          }
          return respond({ success: true }, 201);
        }
        if (request.method === "POST" && url.pathname === "/api/auth/login") {
          const body = await parseJsonBody(request);
          if (!body) return respond({ error: "Invalid request body." }, 400);
          const { email, password } = body;
          if (!isValidEmail(email) || typeof password !== "string" || !password) {
            return respond({ error: "Invalid email or password." }, 401);
          }
          const artist = await env.DB.prepare("SELECT id, password_hash FROM artists WHERE email = ?").bind(email.toLowerCase().trim()).first();
          if (!artist || typeof artist.id !== "string" || typeof artist.password_hash !== "string" || !await CryptoUtils.verifyPassword(password, artist.password_hash)) {
            return respond({ error: "Invalid email or password." }, 401);
          }
          const token = await CryptoUtils.generateToken({ artistId: artist.id }, env.JWT_SECRET);
          return respond({ token });
        }
        if (request.method === "POST" && url.pathname === "/api/auth/forgot") {
          const body = await parseJsonBody(request);
          if (!body) return respond({ error: "Invalid request body." }, 400);
          const { email } = body;
          if (isValidEmail(email)) {
            const normalizedEmail = email.toLowerCase().trim();
            const artist = await env.DB.prepare("SELECT id FROM artists WHERE email = ?").bind(normalizedEmail).first();
            if (artist && typeof artist.id === "string") {
              const token = CryptoUtils.generateResetToken();
              const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS).toISOString();
              const resetUrl = getResetUrl(env.APP_URL, token);
              await env.DB.batch([
                env.DB.prepare("DELETE FROM password_resets WHERE artist_id = ? AND used = 0").bind(artist.id),
                env.DB.prepare(
                  "INSERT INTO password_resets (id, artist_id, token, expires_at, used) VALUES (?, ?, ?, ?, 0)"
                ).bind(CryptoUtils.uuidv4(), artist.id, token, expiresAt)
              ]);
              try {
                await sendPasswordResetEmail(env, normalizedEmail, resetUrl);
              } catch (emailError) {
                console.error("Password reset email could not be sent:", emailError);
              }
            }
          }
          return respond({
            message: "If that email has an account, a reset link is on its way."
          });
        }
        if (request.method === "POST" && url.pathname === "/api/auth/reset") {
          const body = await parseJsonBody(request);
          if (!body) return respond({ error: "Invalid request body." }, 400);
          const { token, newPassword } = body;
          if (!isNonEmptyString(token, 128) || !isValidPassword(newPassword)) {
            return respond({ error: "Invalid or expired reset link." }, 400);
          }
          const resetRecord = await env.DB.prepare(
            "SELECT artist_id, expires_at, used FROM password_resets WHERE token = ?"
          ).bind(token).first();
          const alreadyUsed = resetRecord?.used === 1 || resetRecord?.used === true;
          const expired = !resetRecord || typeof resetRecord.expires_at !== "string" || Number.isNaN(Date.parse(resetRecord.expires_at)) || Date.now() > new Date(resetRecord.expires_at).getTime();
          if (!resetRecord || alreadyUsed || expired || typeof resetRecord.artist_id !== "string") {
            return respond({ error: "Invalid or expired reset link." }, 400);
          }
          const updatedHash = await CryptoUtils.hashPassword(newPassword);
          await env.DB.batch([
            env.DB.prepare("UPDATE artists SET password_hash = ? WHERE id = ?").bind(updatedHash, resetRecord.artist_id),
            env.DB.prepare("UPDATE password_resets SET used = 1 WHERE token = ?").bind(token)
          ]);
          return respond({
            success: true,
            message: "Password updated. You can now sign in."
          });
        }
        return respond({ error: "Not found." }, 404);
      }
      const authHeader = request.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return respond({ error: "Access denied." }, 401);
      }
      const session = await CryptoUtils.verifyToken(
        authHeader.slice("Bearer ".length),
        env.JWT_SECRET
      );
      if (!session) {
        return respond({ error: "Invalid or expired session." }, 401);
      }
      if (url.pathname === "/api/transactions/import" && request.method === "POST") {
        const body = await parseJsonBody(request);
        if (!body || !Array.isArray(body.transactions)) {
          return respond({ error: "Expected a transactions array." }, 400);
        }
        if (body.transactions.length === 0) {
          return respond({ error: "The backup file contains no sessions." }, 400);
        }
        if (body.transactions.length > 1e3) {
          return respond({ error: "A backup can contain at most 1,000 sessions." }, 400);
        }
        const restoredTransactions = [];
        for (const rawTransaction of body.transactions) {
          const validated = validateTransactionPayload(rawTransaction);
          if (!validated.ok) {
            return respond(
              {
                error: `Backup contains an invalid session: ${validated.error}`
              },
              400
            );
          }
          restoredTransactions.push(validated.value);
        }
        const statements = restoredTransactions.map((transaction) => {
          const netAmount = Math.round(
            transaction.grossAmount * (1 - transaction.shopCutPercentage / 100) * 100
          ) / 100;
          return env.DB.prepare(
            `INSERT INTO transactions
                (
                  id,
                  artist_id,
                  timestamp,
                  clientName,
                  description,
                  incomeType,
                  paymentMethod,
                  grossAmount,
                  shopCutPercentage,
                  netAmount
                )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)

              ON CONFLICT(id) DO UPDATE SET
                timestamp = excluded.timestamp,
                clientName = excluded.clientName,
                description = excluded.description,
                incomeType = excluded.incomeType,
                paymentMethod = excluded.paymentMethod,
                grossAmount = excluded.grossAmount,
                shopCutPercentage = excluded.shopCutPercentage,
                netAmount = excluded.netAmount

              WHERE transactions.artist_id = excluded.artist_id`
          ).bind(
            transaction.id,
            session.artistId,
            transaction.timestamp,
            transaction.clientName,
            transaction.description,
            transaction.incomeType,
            transaction.paymentMethod,
            transaction.grossAmount,
            transaction.shopCutPercentage,
            netAmount
          );
        });
        await env.DB.batch(statements);
        return respond({
          success: true,
          restored: restoredTransactions.length,
          message: `Restored ${restoredTransactions.length} session(s) to your ledger.`
        });
      }
      if (url.pathname === "/api/transactions" && request.method === "GET") {
        const { results } = await env.DB.prepare(
          "SELECT * FROM transactions WHERE artist_id = ? ORDER BY timestamp DESC LIMIT 1000"
        ).bind(session.artistId).all();
        return respond(results);
      }
      if (url.pathname === "/api/transactions" && request.method === "POST") {
        const body = await parseJsonBody(request);
        if (!body) return respond({ error: "Invalid request body." }, 400);
        const validated = validateTransactionPayload(body);
        if (!validated.ok) {
          return respond({ error: validated.error }, 400);
        }
        const transaction = validated.value;
        const netAmount = Math.round(
          transaction.grossAmount * (1 - transaction.shopCutPercentage / 100) * 100
        ) / 100;
        await env.DB.prepare(
          `INSERT INTO transactions
             (id, artist_id, timestamp, clientName, description, incomeType, paymentMethod, grossAmount, shopCutPercentage, netAmount)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          transaction.id,
          session.artistId,
          transaction.timestamp,
          transaction.clientName,
          transaction.description,
          transaction.incomeType,
          transaction.paymentMethod,
          transaction.grossAmount,
          transaction.shopCutPercentage,
          netAmount
        ).run();
        return respond({ success: true, id: transaction.id, netAmount }, 201);
      }
      const transactionRoute = url.pathname.match(/^\/api\/transactions\/([^/]+)$/);
      if (transactionRoute && request.method === "PUT") {
        const transactionId = decodeURIComponent(transactionRoute[1]);
        const body = await parseJsonBody(request);
        if (!body) return respond({ error: "Invalid request body." }, 400);
        const validated = validateTransactionPayload(body);
        if (!validated.ok) {
          return respond({ error: validated.error }, 400);
        }
        const transaction = validated.value;
        if (transaction.id !== transactionId) {
          return respond({ error: "Transaction ID does not match the requested record." }, 400);
        }
        const netAmount = Math.round(
          transaction.grossAmount * (1 - transaction.shopCutPercentage / 100) * 100
        ) / 100;
        const result = await env.DB.prepare(
          `UPDATE transactions
             SET clientName = ?,
                 description = ?,
                 incomeType = ?,
                 paymentMethod = ?,
                 grossAmount = ?,
                 shopCutPercentage = ?,
                 netAmount = ?
             WHERE id = ? AND artist_id = ?`
        ).bind(
          transaction.clientName,
          transaction.description,
          transaction.incomeType,
          transaction.paymentMethod,
          transaction.grossAmount,
          transaction.shopCutPercentage,
          netAmount,
          transactionId,
          session.artistId
        ).run();
        if (!result.meta.changes) {
          return respond({ error: "Session not found." }, 404);
        }
        return respond({ success: true, id: transactionId, netAmount });
      }
      if (transactionRoute && request.method === "DELETE") {
        const transactionId = decodeURIComponent(transactionRoute[1]);
        const result = await env.DB.prepare("DELETE FROM transactions WHERE id = ? AND artist_id = ?").bind(transactionId, session.artistId).run();
        if (!result.meta.changes) {
          return respond({ error: "Session not found." }, 404);
        }
        return respond({ success: true, id: transactionId });
      }
      return respond({ error: "Not found." }, 404);
    } catch (error) {
      console.error("Unhandled worker error:", error);
      return respond({ error: "Internal server error." }, 500);
    }
  }
};
export {
  worker_default as default
};
//# sourceMappingURL=worker.js.map
