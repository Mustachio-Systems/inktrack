/// <reference types="@cloudflare/workers-types" />

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;

  // Cloudflare Worker secrets / variables
  RESEND_API_KEY: string;
  EMAIL_FROM: string;
  APP_URL: string;

  ENVIRONMENT?: string;
}

type JsonRecord = Record<string, unknown>;

interface EmailInput {
  to: string;
  subject: string;
  text: string;
  html: string;
}

interface IncomingTransaction {
  id: string;
  timestamp: string;
  clientName: string;
  description: string | null;
  incomeType: string;
  paymentMethod: string;
  grossAmount: number;
  shopCutPercentage: number;
}

interface ArtistRecord {
  id: string;
  email?: string;
  password_hash?: string;
  artist_name?: string;
}

interface PasswordResetRecord {
  artist_id: string;
  expires_at: string;
  used: number | boolean;
}

// ---------------------------------------------------------------------------
// CONSTANTS
// ---------------------------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INCOME_TYPES = new Set(['appointment', 'walk-in', 'deposit', 'tip']);
const PAYMENT_METHODS = new Set(['cash', 'card', 'ath-movil', 'zelle', 'venmo', 'paypal']);

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const SESSION_TTL_SECONDS = 60 * 60 * 24; // 24 hours

// ---------------------------------------------------------------------------
// NATIVE WEB CRYPTO UTILITIES
// ---------------------------------------------------------------------------

const CryptoUtils = {
  uuidv4(): string {
    return crypto.randomUUID();
  },

  generateResetToken(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    return Array.from(bytes)
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  },

  async hashPassword(password: string): Promise<string> {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const baseKey = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveBits'],
    );

    const bits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256',
      },
      baseKey,
      256,
    );

    const saltHex = Array.from(salt)
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');

    const hashHex = Array.from(new Uint8Array(bits))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');

    return `${saltHex}:${hashHex}`;
  },

  timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;

    let result = 0;
    for (let index = 0; index < a.length; index += 1) {
      result |= a.charCodeAt(index) ^ b.charCodeAt(index);
    }

    return result === 0;
  },

  async verifyPassword(password: string, storedHash: string): Promise<boolean> {
    const [saltHex, originalHashHex] = storedHash.split(':');

    if (!saltHex || !originalHashHex || !/^[a-f0-9]+$/i.test(saltHex) || !/^[a-f0-9]+$/i.test(originalHashHex)) {
      return false;
    }

    const saltPairs = saltHex.match(/.{1,2}/g);
    if (!saltPairs) return false;

    const salt = new Uint8Array(saltPairs.map((pair) => parseInt(pair, 16)));

    const baseKey = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveBits'],
    );

    const bits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256',
      },
      baseKey,
      256,
    );

    const candidateHashHex = Array.from(new Uint8Array(bits))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');

    return CryptoUtils.timingSafeEqual(candidateHashHex, originalHashHex);
  },

  async generateToken(payload: { artistId: string }, secret: string): Promise<string> {
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const encodedPayload = btoa(
      JSON.stringify({
        ...payload,
        exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
      }),
    );

    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );

    const signature = await crypto.subtle.sign(
      'HMAC',
      key,
      new TextEncoder().encode(`${header}.${encodedPayload}`),
    );

    const signatureHex = Array.from(new Uint8Array(signature))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');

    return `${header}.${encodedPayload}.${signatureHex}`;
  },

  async verifyToken(token: string, secret: string): Promise<{ artistId: string } | null> {
    try {
      const [header, encodedPayload, signatureHex] = token.split('.');

      if (!header || !encodedPayload || !signatureHex || !/^[a-f0-9]+$/i.test(signatureHex)) {
        return null;
      }

      const signaturePairs = signatureHex.match(/.{1,2}/g);
      if (!signaturePairs) return null;

      const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['verify'],
      );

      const verified = await crypto.subtle.verify(
        'HMAC',
        key,
        new Uint8Array(signaturePairs.map((pair) => parseInt(pair, 16))),
        new TextEncoder().encode(`${header}.${encodedPayload}`),
      );

      if (!verified) return null;

      const payload = JSON.parse(atob(encodedPayload)) as { artistId?: unknown; exp?: unknown };

      if (
        typeof payload.artistId !== 'string' ||
        typeof payload.exp !== 'number' ||
        Math.floor(Date.now() / 1000) > payload.exp
      ) {
        return null;
      }

      return { artistId: payload.artistId };
    } catch {
      return null;
    }
  },
};

// ---------------------------------------------------------------------------
// VALIDATION + SMALL HELPERS
// ---------------------------------------------------------------------------

function isValidEmail(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 254 && EMAIL_RE.test(value);
}

function isNonEmptyString(value: unknown, maxLength = 255): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength;
}

function isValidPassword(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 8 && value.length <= 128;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };

    return entities[character];
  });
}

function getResetUrl(appUrl: string, token: string): string {
  const url = new URL('/reset-password', appUrl);
  url.searchParams.set('token', token);
  return url.toString();
}

function jsonResponse(
  data: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...extraHeaders,
    },
  });
}

function htmlEmailShell(title: string, bodyHtml: string): string {
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

// ---------------------------------------------------------------------------
// EMAIL DELIVERY THROUGH RESEND
// ---------------------------------------------------------------------------

async function sendEmail(env: Env, email: EmailInput): Promise<void> {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM || !env.APP_URL) {
    throw new Error('Email configuration is incomplete.');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [email.to],
      subject: email.subject,
      text: email.text,
      html: email.html,
    }),
  });

  if (!response.ok) {
    const resendError = await response.text();
    console.error('Resend email delivery failed:', response.status, resendError);
    throw new Error(`Resend rejected email request with status ${response.status}.`);
  }
}

async function sendWelcomeEmail(env: Env, email: string, artistName: string): Promise<void> {
  const safeName = escapeHtml(artistName);
  const dashboardUrl = new URL('/dashboard', env.APP_URL).toString();

  await sendEmail(env, {
    to: email,
    subject: 'Welcome to InkTrack',
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
        </p>`,
    ),
  });
}

async function sendPasswordResetEmail(env: Env, email: string, resetUrl: string): Promise<void> {
  await sendEmail(env, {
    to: email,
    subject: 'Reset your InkTrack password',
    text: `We received a request to reset your InkTrack password. Use this link within one hour: ${resetUrl}`,
    html: htmlEmailShell(
      'Reset your password',
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
        </p>`,
    ),
  });
}

// ---------------------------------------------------------------------------
// TRANSACTION VALIDATION
// ---------------------------------------------------------------------------

function validateTransactionPayload(
  data: unknown,
): { ok: true; value: IncomingTransaction } | { ok: false; error: string } {
  if (!data || typeof data !== 'object') {
    return { ok: false, error: 'Missing transaction body.' };
  }

  const transaction = data as JsonRecord;

  if (!isNonEmptyString(transaction.id, 64)) {
    return { ok: false, error: 'Missing or invalid id.' };
  }

  if (typeof transaction.timestamp !== 'string' || Number.isNaN(Date.parse(transaction.timestamp))) {
    return { ok: false, error: 'Missing or invalid timestamp.' };
  }

  if (
    transaction.clientName !== undefined &&
    transaction.clientName !== null &&
    typeof transaction.clientName !== 'string'
  ) {
    return { ok: false, error: 'Invalid clientName.' };
  }

  if (
    transaction.description !== undefined &&
    transaction.description !== null &&
    typeof transaction.description !== 'string'
  ) {
    return { ok: false, error: 'Invalid description.' };
  }

  if (typeof transaction.incomeType !== 'string' || !INCOME_TYPES.has(transaction.incomeType)) {
    return { ok: false, error: 'Invalid incomeType.' };
  }

  if (
    typeof transaction.paymentMethod !== 'string' ||
    !PAYMENT_METHODS.has(transaction.paymentMethod)
  ) {
    return { ok: false, error: 'Invalid paymentMethod.' };
  }

  const gross = Number(transaction.grossAmount);
  if (!Number.isFinite(gross) || gross <= 0 || gross > 1_000_000) {
    return { ok: false, error: 'grossAmount must be a positive number.' };
  }

  const cut = Number(transaction.shopCutPercentage);
  if (!Number.isFinite(cut) || cut < 0 || cut > 100) {
    return { ok: false, error: 'shopCutPercentage must be between 0 and 100.' };
  }

  return {
    ok: true,
    value: {
      id: transaction.id,
      timestamp: transaction.timestamp,
      clientName:
        typeof transaction.clientName === 'string' && transaction.clientName.trim()
          ? transaction.clientName.trim().slice(0, 255)
          : 'Anonymous Client',
      description:
        typeof transaction.description === 'string' && transaction.description.trim()
          ? transaction.description.trim().slice(0, 1000)
          : null,
      incomeType: transaction.incomeType,
      paymentMethod: transaction.paymentMethod,
      grossAmount: Math.round(gross * 100) / 100,
      shopCutPercentage: Math.round(cut * 100) / 100,
    },
  };
}

async function parseJsonBody(request: Request): Promise<JsonRecord | null> {
  try {
    const body = await request.json();

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return null;
    }

    return body as JsonRecord;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// WORKER
// ---------------------------------------------------------------------------

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const respond = (data: unknown, status = 200) => jsonResponse(data, status, corsHeaders);

    if (!env.JWT_SECRET) {
      console.error('JWT_SECRET is missing.');
      return respond({ error: 'Server misconfigured.' }, 500);
    }

    try {
      // ---------------------------------------------------------------------
      // AUTH ROUTES
      // ---------------------------------------------------------------------

      if (url.pathname.startsWith('/api/auth/')) {
        // POST /api/auth/signup
        if (request.method === 'POST' && url.pathname === '/api/auth/signup') {
          const body = await parseJsonBody(request);
          if (!body) return respond({ error: 'Invalid request body.' }, 400);

          const { email, password, artistName } = body;

          if (!isValidEmail(email)) {
            return respond({ error: 'A valid email is required.' }, 400);
          }

          if (!isValidPassword(password)) {
            return respond({ error: 'Password must be 8-128 characters.' }, 400);
          }

          if (!isNonEmptyString(artistName, 255)) {
            return respond({ error: 'Artist name is required.' }, 400);
          }

          const normalizedEmail = email.toLowerCase().trim();
          const cleanArtistName = artistName.trim();

          const existing = await env.DB
            .prepare('SELECT id FROM artists WHERE email = ?')
            .bind(normalizedEmail)
            .first();

          if (existing) {
            return respond({ error: 'An account with that email already exists.' }, 409);
          }

          const artistId = CryptoUtils.uuidv4();
          const passwordHash = await CryptoUtils.hashPassword(password);

          await env.DB
            .prepare(
              'INSERT INTO artists (id, email, password_hash, artist_name) VALUES (?, ?, ?, ?)',
            )
            .bind(artistId, normalizedEmail, passwordHash, cleanArtistName)
            .run();

          // A welcome email should not prevent account creation if delivery is
          // temporarily unavailable. Delivery errors are visible in Worker logs.
          try {
            await sendWelcomeEmail(env, normalizedEmail, cleanArtistName);
          } catch (emailError) {
            console.error('Welcome email could not be sent:', emailError);
          }

          return respond({ success: true }, 201);
        }

        // POST /api/auth/login
        if (request.method === 'POST' && url.pathname === '/api/auth/login') {
          const body = await parseJsonBody(request);
          if (!body) return respond({ error: 'Invalid request body.' }, 400);

          const { email, password } = body;

          if (!isValidEmail(email) || typeof password !== 'string' || !password) {
            return respond({ error: 'Invalid email or password.' }, 401);
          }

          const artist = await env.DB
            .prepare('SELECT id, password_hash FROM artists WHERE email = ?')
            .bind(email.toLowerCase().trim())
            .first<ArtistRecord>();

          if (
            !artist ||
            typeof artist.id !== 'string' ||
            typeof artist.password_hash !== 'string' ||
            !(await CryptoUtils.verifyPassword(password, artist.password_hash))
          ) {
            return respond({ error: 'Invalid email or password.' }, 401);
          }

          const token = await CryptoUtils.generateToken({ artistId: artist.id }, env.JWT_SECRET);
          return respond({ token });
        }

        // POST /api/auth/forgot
        if (request.method === 'POST' && url.pathname === '/api/auth/forgot') {
          const body = await parseJsonBody(request);
          if (!body) return respond({ error: 'Invalid request body.' }, 400);

          const { email } = body;

          // Always return the same response. This prevents account enumeration.
          if (isValidEmail(email)) {
            const normalizedEmail = email.toLowerCase().trim();

            const artist = await env.DB
              .prepare('SELECT id FROM artists WHERE email = ?')
              .bind(normalizedEmail)
              .first<ArtistRecord>();

            if (artist && typeof artist.id === 'string') {
              const token = CryptoUtils.generateResetToken();
              const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS).toISOString();
              const resetUrl = getResetUrl(env.APP_URL, token);

              // A user only needs one active reset link. Old unused links for
              // the same artist become invalid when a new reset is requested.
              await env.DB.batch([
                env.DB
                  .prepare('DELETE FROM password_resets WHERE artist_id = ? AND used = 0')
                  .bind(artist.id),
                env.DB
                  .prepare(
                    'INSERT INTO password_resets (id, artist_id, token, expires_at, used) VALUES (?, ?, ?, ?, 0)',
                  )
                  .bind(CryptoUtils.uuidv4(), artist.id, token, expiresAt),
              ]);

              try {
                await sendPasswordResetEmail(env, normalizedEmail, resetUrl);
              } catch (emailError) {
                // Never expose email delivery details to the requesting user.
                // Check Worker logs + Resend Logs to diagnose delivery issues.
                console.error('Password reset email could not be sent:', emailError);
              }
            }
          }

          return respond({
            message: 'If that email has an account, a reset link is on its way.',
          });
        }

        // POST /api/auth/reset
        if (request.method === 'POST' && url.pathname === '/api/auth/reset') {
          const body = await parseJsonBody(request);
          if (!body) return respond({ error: 'Invalid request body.' }, 400);

          const { token, newPassword } = body;

          if (!isNonEmptyString(token, 128) || !isValidPassword(newPassword)) {
            return respond({ error: 'Invalid or expired reset link.' }, 400);
          }

          const resetRecord = await env.DB
            .prepare(
              'SELECT artist_id, expires_at, used FROM password_resets WHERE token = ?',
            )
            .bind(token)
            .first<PasswordResetRecord>();

          const alreadyUsed = resetRecord?.used === 1 || resetRecord?.used === true;
          const expired =
            !resetRecord ||
            typeof resetRecord.expires_at !== 'string' ||
            Number.isNaN(Date.parse(resetRecord.expires_at)) ||
            Date.now() > new Date(resetRecord.expires_at).getTime();

          if (!resetRecord || alreadyUsed || expired || typeof resetRecord.artist_id !== 'string') {
            return respond({ error: 'Invalid or expired reset link.' }, 400);
          }

          const updatedHash = await CryptoUtils.hashPassword(newPassword);

          await env.DB.batch([
            env.DB
              .prepare('UPDATE artists SET password_hash = ? WHERE id = ?')
              .bind(updatedHash, resetRecord.artist_id),
            env.DB
              .prepare('UPDATE password_resets SET used = 1 WHERE token = ?')
              .bind(token),
          ]);

          return respond({
            success: true,
            message: 'Password updated. You can now sign in.',
          });
        }

        return respond({ error: 'Not found.' }, 404);
      }

      // ---------------------------------------------------------------------
      // PROTECTED LEDGER ROUTES
      // ---------------------------------------------------------------------

      const authHeader = request.headers.get('Authorization');

      if (!authHeader?.startsWith('Bearer ')) {
        return respond({ error: 'Access denied.' }, 401);
      }

      const session = await CryptoUtils.verifyToken(
        authHeader.slice('Bearer '.length),
        env.JWT_SECRET,
      );

      if (!session) {
        return respond({ error: 'Invalid or expired session.' }, 401);
      }

      // GET /api/transactions
      if (url.pathname === '/api/transactions' && request.method === 'GET') {
        const { results } = await env.DB
          .prepare(
            'SELECT * FROM transactions WHERE artist_id = ? ORDER BY timestamp DESC LIMIT 1000',
          )
          .bind(session.artistId)
          .all();

        return respond(results);
      }

      // POST /api/transactions
      if (url.pathname === '/api/transactions' && request.method === 'POST') {
        const body = await parseJsonBody(request);
        if (!body) return respond({ error: 'Invalid request body.' }, 400);

        const validated = validateTransactionPayload(body);
        if (!validated.ok) {
          return respond({ error: validated.error }, 400);
        }

        const transaction = validated.value;
        const netAmount =
          Math.round(
            transaction.grossAmount * (1 - transaction.shopCutPercentage / 100) * 100,
          ) / 100;

        await env.DB
          .prepare(
            `INSERT INTO transactions
             (id, artist_id, timestamp, clientName, description, incomeType, paymentMethod, grossAmount, shopCutPercentage, netAmount)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            transaction.id,
            session.artistId,
            transaction.timestamp,
            transaction.clientName,
            transaction.description,
            transaction.incomeType,
            transaction.paymentMethod,
            transaction.grossAmount,
            transaction.shopCutPercentage,
            netAmount,
          )
          .run();

        return respond({ success: true, id: transaction.id, netAmount }, 201);
      }


      // PUT /api/transactions/:id
      // The artist ID is included in every write condition so an authenticated
      // artist can only modify their own ledger entries.
      const transactionRoute = url.pathname.match(/^\/api\/transactions\/([^/]+)$/);

      if (transactionRoute && request.method === 'PUT') {
        const transactionId = decodeURIComponent(transactionRoute[1]);
        const body = await parseJsonBody(request);

        if (!body) return respond({ error: 'Invalid request body.' }, 400);

        const validated = validateTransactionPayload(body);
        if (!validated.ok) {
          return respond({ error: validated.error }, 400);
        }

        const transaction = validated.value;

        if (transaction.id !== transactionId) {
          return respond({ error: 'Transaction ID does not match the requested record.' }, 400);
        }

        const netAmount =
          Math.round(
            transaction.grossAmount * (1 - transaction.shopCutPercentage / 100) * 100,
          ) / 100;

        const result = await env.DB
          .prepare(
            `UPDATE transactions
             SET clientName = ?,
                 description = ?,
                 incomeType = ?,
                 paymentMethod = ?,
                 grossAmount = ?,
                 shopCutPercentage = ?,
                 netAmount = ?
             WHERE id = ? AND artist_id = ?`,
          )
          .bind(
            transaction.clientName,
            transaction.description,
            transaction.incomeType,
            transaction.paymentMethod,
            transaction.grossAmount,
            transaction.shopCutPercentage,
            netAmount,
            transactionId,
            session.artistId,
          )
          .run();

        if (!result.meta.changes) {
          return respond({ error: 'Session not found.' }, 404);
        }

        return respond({ success: true, id: transactionId, netAmount });
      }

      // DELETE /api/transactions/:id
      if (transactionRoute && request.method === 'DELETE') {
        const transactionId = decodeURIComponent(transactionRoute[1]);

        const result = await env.DB
          .prepare('DELETE FROM transactions WHERE id = ? AND artist_id = ?')
          .bind(transactionId, session.artistId)
          .run();

        if (!result.meta.changes) {
          return respond({ error: 'Session not found.' }, 404);
        }

        return respond({ success: true, id: transactionId });
      }

      return respond({ error: 'Not found.' }, 404);
    } catch (error) {
      console.error('Unhandled worker error:', error);
      return respond({ error: 'Internal server error.' }, 500);
    }
  },
};
