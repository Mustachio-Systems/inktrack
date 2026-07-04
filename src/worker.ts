/// <reference types="@cloudflare/workers-types" />

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
  RESEND_API_KEY: string;
  EMAIL_FROM: string;
  APP_URL: string;
}

type JsonObject = Record<string, unknown>;

type ShopFeeType = 'percentage' | 'fixed' | 'booth-rent' | 'hybrid' | 'none';
type ShopExpenseFrequency = 'weekly' | 'monthly' | 'one-time';

interface TransactionInput {
  id: string;
  timestamp: string;
  clientName: string;
  description: string | null;
  incomeType: string;
  paymentMethod: string;
  grossAmount: number;
  shopFeeType: ShopFeeType;
  shopCutPercentage: number;
  shopFixedFee: number;
}

interface ShopExpenseInput {
  name: string;
  amount: number;
  frequency: ShopExpenseFrequency;
  startsOn: string;
  endsOn: string | null;
}

interface ArtistRow {
  id: string;
  password_hash: string;
}

interface ResetRow {
  artist_id: string;
  expires_at: string;
  used: number;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INCOME_TYPES = new Set(['appointment', 'walk-in', 'deposit', 'tip']);
const PAYMENT_METHODS = new Set(['cash', 'card', 'ath-movil', 'zelle', 'venmo', 'paypal']);
const SHOP_FEE_TYPES = new Set<ShopFeeType>(['percentage', 'fixed', 'booth-rent', 'hybrid', 'none']);
const EXPENSE_FREQUENCIES = new Set<ShopExpenseFrequency>(['weekly', 'monthly', 'one-time']);

function isValidEmail(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 254 && EMAIL_RE.test(value);
}

function isNonEmptyString(value: unknown, maxLength = 255): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength;
}

function isValidPassword(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 8 && value.length <= 128;
}

function isValidIsoDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00`));
}

function cleanText(value: unknown, maxLength: number, fallback = ''): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) || fallback : fallback;
}

function json(data: unknown, status = 200, corsHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders,
    },
  });
}

function calculateNet(
  grossAmount: number,
  shopFeeType: ShopFeeType,
  shopCutPercentage: number,
  shopFixedFee: number,
): number {
  const percentageFee =
    shopFeeType === 'percentage' || shopFeeType === 'hybrid'
      ? grossAmount * (shopCutPercentage / 100)
      : 0;

  const fixedFee =
    shopFeeType === 'fixed' || shopFeeType === 'hybrid'
      ? shopFixedFee
      : 0;

  return Math.max(0, Math.round((grossAmount - percentageFee - fixedFee) * 100) / 100);
}

async function readJson(request: Request): Promise<JsonObject | null> {
  try {
    const parsed: unknown = await request.json();
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as JsonObject)
      : null;
  } catch {
    return null;
  }
}

const CryptoUtils = {
  uuid(): string {
    return crypto.randomUUID();
  },

  randomHex(byteLength = 32): string {
    const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
    return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, '0')).join('');
  },

  async hashPassword(password: string): Promise<string> {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveBits'],
    );

    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
      key,
      256,
    );

    const saltHex = Array.from(salt).map((byte) => byte.toString(16).padStart(2, '0')).join('');
    const hashHex = Array.from(new Uint8Array(bits)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
    return `${saltHex}:${hashHex}`;
  },

  timingSafeEqual(left: string, right: string): boolean {
    if (left.length !== right.length) return false;
    let result = 0;
    for (let index = 0; index < left.length; index += 1) {
      result |= left.charCodeAt(index) ^ right.charCodeAt(index);
    }
    return result === 0;
  },

  async verifyPassword(password: string, storedHash: string): Promise<boolean> {
    const [saltHex, expectedHash] = storedHash.split(':');
    if (!saltHex || !expectedHash || !/^[a-f0-9]+$/i.test(saltHex) || !/^[a-f0-9]+$/i.test(expectedHash)) return false;

    const pairs = saltHex.match(/.{1,2}/g);
    if (!pairs) return false;

    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveBits'],
    );

    const bits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: new Uint8Array(pairs.map((pair) => parseInt(pair, 16))),
        iterations: 100000,
        hash: 'SHA-256',
      },
      key,
      256,
    );

    const candidate = Array.from(new Uint8Array(bits)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
    return CryptoUtils.timingSafeEqual(candidate, expectedHash);
  },

  async signToken(artistId: string, secret: string): Promise<string> {
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = btoa(JSON.stringify({ artistId, exp: Math.floor(Date.now() / 1000) + 86400 }));
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );

    const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${header}.${payload}`));
    const signatureHex = Array.from(new Uint8Array(signature)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
    return `${header}.${payload}.${signatureHex}`;
  },

  async verifyToken(token: string, secret: string): Promise<{ artistId: string } | null> {
    try {
      const [header, payload, signatureHex] = token.split('.');
      if (!header || !payload || !signatureHex || !/^[a-f0-9]+$/i.test(signatureHex)) return null;

      const pairs = signatureHex.match(/.{1,2}/g);
      if (!pairs) return null;

      const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['verify'],
      );

      const valid = await crypto.subtle.verify(
        'HMAC',
        key,
        new Uint8Array(pairs.map((pair) => parseInt(pair, 16))),
        new TextEncoder().encode(`${header}.${payload}`),
      );
      if (!valid) return null;

      const decoded = JSON.parse(atob(payload)) as { artistId?: unknown; exp?: unknown };
      if (typeof decoded.artistId !== 'string' || typeof decoded.exp !== 'number') return null;
      if (Date.now() / 1000 >= decoded.exp) return null;
      return { artistId: decoded.artistId };
    } catch {
      return null;
    }
  },
};

function validateTransaction(value: JsonObject): { ok: true; data: TransactionInput } | { ok: false; error: string } {
  if (!isNonEmptyString(value.id, 64)) return { ok: false, error: 'Missing or invalid session ID.' };
  if (typeof value.timestamp !== 'string' || Number.isNaN(Date.parse(value.timestamp))) return { ok: false, error: 'Invalid session timestamp.' };
  if (typeof value.incomeType !== 'string' || !INCOME_TYPES.has(value.incomeType)) return { ok: false, error: 'Invalid category.' };
  if (typeof value.paymentMethod !== 'string' || !PAYMENT_METHODS.has(value.paymentMethod)) return { ok: false, error: 'Invalid payment channel.' };

  const grossAmount = Number(value.grossAmount);
  if (!Number.isFinite(grossAmount) || grossAmount <= 0 || grossAmount > 1_000_000) {
    return { ok: false, error: 'Gross amount must be a positive number.' };
  }

  // Legacy exports that existed before shop agreements use the original percentage split.
  const requestedFeeType = value.shopFeeType ?? 'percentage';
  if (typeof requestedFeeType !== 'string' || !SHOP_FEE_TYPES.has(requestedFeeType as ShopFeeType)) {
    return { ok: false, error: 'Invalid shop agreement.' };
  }

  const shopFeeType = requestedFeeType as ShopFeeType;
  const rawPercentage = Number(value.shopCutPercentage ?? 40);
  const rawFixedFee = Number(value.shopFixedFee ?? 0);

  if (!Number.isFinite(rawPercentage) || rawPercentage < 0 || rawPercentage > 100) {
    return { ok: false, error: 'Shop split must be between 0% and 100%.' };
  }
  if (!Number.isFinite(rawFixedFee) || rawFixedFee < 0 || rawFixedFee > 1_000_000) {
    return { ok: false, error: 'Fixed shop fee must be a valid non-negative amount.' };
  }

  const shopCutPercentage = shopFeeType === 'percentage' || shopFeeType === 'hybrid' ? Math.round(rawPercentage * 100) / 100 : 0;
  const shopFixedFee = shopFeeType === 'fixed' || shopFeeType === 'hybrid' ? Math.round(rawFixedFee * 100) / 100 : 0;

  if (shopFixedFee > grossAmount) {
    return { ok: false, error: 'Fixed shop fee cannot be higher than the gross amount.' };
  }

  return {
    ok: true,
    data: {
      id: value.id,
      timestamp: value.timestamp,
      clientName: cleanText(value.clientName, 255, 'Anonymous Client'),
      description: cleanText(value.description, 1000) || null,
      incomeType: value.incomeType,
      paymentMethod: value.paymentMethod,
      grossAmount: Math.round(grossAmount * 100) / 100,
      shopFeeType,
      shopCutPercentage,
      shopFixedFee,
    },
  };
}

function validateExpense(value: JsonObject): { ok: true; data: ShopExpenseInput } | { ok: false; error: string } {
  if (!isNonEmptyString(value.name, 100)) return { ok: false, error: 'Cost name is required.' };

  const amount = Number(value.amount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) {
    return { ok: false, error: 'Cost amount must be greater than zero.' };
  }

  if (typeof value.frequency !== 'string' || !EXPENSE_FREQUENCIES.has(value.frequency as ShopExpenseFrequency)) {
    return { ok: false, error: 'Choose weekly, monthly, or one-time.' };
  }

  if (!isValidIsoDate(value.startsOn)) return { ok: false, error: 'Choose a valid start date.' };

  const endsOn =
    value.endsOn === null || value.endsOn === undefined || value.endsOn === ''
      ? null
      : isValidIsoDate(value.endsOn)
        ? value.endsOn
        : 'INVALID';

  if (endsOn === 'INVALID') return { ok: false, error: 'End date is invalid.' };
  if (endsOn && endsOn < value.startsOn) return { ok: false, error: 'End date cannot be before start date.' };

  return {
    ok: true,
    data: {
      name: value.name.trim().slice(0, 100),
      amount: Math.round(amount * 100) / 100,
      frequency: value.frequency as ShopExpenseFrequency,
      startsOn: value.startsOn,
      endsOn,
    },
  };
}

async function sendEmail(
    env: Env,
    to: string,
    subject: string,
    html: string,
) {
    if (!env.RESEND_API_KEY) {
        throw new Error('RESEND_API_KEY is missing in the Worker environment.');
    }

    if (!env.EMAIL_FROM) {
        throw new Error('EMAIL_FROM is missing in the Worker environment.');
    }

    if (!env.APP_URL) {
        throw new Error('APP_URL is missing in the Worker environment.');
    }

    const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            from: env.EMAIL_FROM,
            to: [to],
            subject,
            html,
        }),
    });

    const responseText = await response.text();

    if (!response.ok) {
        console.error('Resend failed:', {
            status: response.status,
            statusText: response.statusText,
            response: responseText,
            to,
            from: env.EMAIL_FROM,
        });

        throw new Error(
            `Resend rejected the email (${response.status}): ${responseText}`,
        );
    }

    console.log('Resend accepted email:', {
        to,
        subject,
        response: responseText,
    });

    return responseText;
}

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
    const respond = (data: unknown, status = 200) => json(data, status, cors);

    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (!env.JWT_SECRET) return respond({ error: 'Server misconfigured.' }, 500);

    try {
      // -------------------- PUBLIC AUTH ROUTES --------------------
      if (url.pathname === '/api/auth/signup' && request.method === 'POST') {
        const body = await readJson(request);
        if (!body) return respond({ error: 'Invalid request body.' }, 400);

        const email = body.email;
        const password = body.password;
        const artistName = body.artistName;

        if (!isValidEmail(email)) return respond({ error: 'A valid email is required.' }, 400);
        if (!isValidPassword(password)) return respond({ error: 'Password must be 8-128 characters.' }, 400);
        if (!isNonEmptyString(artistName, 255)) return respond({ error: 'Artist name is required.' }, 400);

        const normalizedEmail = email.toLowerCase().trim();
        const existing = await env.DB.prepare('SELECT id FROM artists WHERE email = ?').bind(normalizedEmail).first();
        if (existing) return respond({ error: 'An account with that email already exists.' }, 409);

        const artistId = CryptoUtils.uuid();
        await env.DB
          .prepare('INSERT INTO artists (id, email, password_hash, artist_name) VALUES (?, ?, ?, ?)')
          .bind(artistId, normalizedEmail, await CryptoUtils.hashPassword(password), artistName.trim())
          .run();

        let welcomeEmailSent = false;
        let welcomeEmailError: string | null = null;

        try {
            await sendEmail(
                env,
                normalizedEmail,
                'Welcome to InkTrack',
                `<div style="font-family:Arial,sans-serif">
                  <h1>Welcome to InkTrack, ${artistName.trim()}.</h1>
                  <p>Your artist ledger is ready.</p>
                  <p>
                    <a href="${new URL('/login', env.APP_URL)}">
                      Open InkTrack
                    </a>
                  </p>
                </div>`,
            );

            welcomeEmailSent = true;
        } catch (error) {
            console.error('Welcome email error:', error);

            welcomeEmailError =
                error instanceof Error
                    ? error.message
                    : 'Unknown welcome-email error.';
        }

        return respond(
            {
                success: true,
                welcomeEmailSent,
                welcomeEmailError,
            },
            201,
        );
      }

      if (url.pathname === '/api/auth/login' && request.method === 'POST') {
        const body = await readJson(request);
        if (!body || !isValidEmail(body.email) || typeof body.password !== 'string') {
          return respond({ error: 'Invalid email or password.' }, 401);
        }

        const artist = await env.DB
          .prepare('SELECT id, password_hash FROM artists WHERE email = ?')
          .bind(body.email.toLowerCase().trim())
          .first<ArtistRow>();

        if (!artist || !(await CryptoUtils.verifyPassword(body.password, artist.password_hash))) {
          return respond({ error: 'Invalid email or password.' }, 401);
        }

        return respond({ token: await CryptoUtils.signToken(artist.id, env.JWT_SECRET) });
      }

      if (url.pathname === '/api/auth/forgot' && request.method === 'POST') {
        const body = await readJson(request);
        if (!body) return respond({ error: 'Invalid request body.' }, 400);

        if (isValidEmail(body.email)) {
          const email = body.email.toLowerCase().trim();
          const artist = await env.DB.prepare('SELECT id FROM artists WHERE email = ?').bind(email).first<{ id: string }>();

          if (artist) {
            const token = CryptoUtils.randomHex();
            const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
            const resetUrl = new URL('/reset-password', env.APP_URL);
            resetUrl.searchParams.set('token', token);

            await env.DB.batch([
              env.DB.prepare('DELETE FROM password_resets WHERE artist_id = ? AND used = 0').bind(artist.id),
              env.DB
                .prepare('INSERT INTO password_resets (id, artist_id, token, expires_at, used) VALUES (?, ?, ?, ?, 0)')
                .bind(CryptoUtils.uuid(), artist.id, token, expiresAt),
            ]);

            try {
              await sendEmail(
                env,
                email,
                'Reset your InkTrack password',
                `<div style="font-family:Arial,sans-serif"><h1>Reset your password</h1><p><a href="${resetUrl.toString()}">Reset Password</a></p><p>This link expires in one hour.</p></div>`,
              );
            } catch (error) {
              console.error('Reset email error:', error);
            }
          }
        }

        return respond({ message: 'If that email has an account, a reset link is on its way.' });
      }

      if (url.pathname === '/api/auth/reset' && request.method === 'POST') {
        const body = await readJson(request);
        if (!body || !isNonEmptyString(body.token, 128) || !isValidPassword(body.newPassword)) {
          return respond({ error: 'Invalid or expired reset link.' }, 400);
        }

        const reset = await env.DB
          .prepare('SELECT artist_id, expires_at, used FROM password_resets WHERE token = ?')
          .bind(body.token)
          .first<ResetRow>();

        if (!reset || reset.used === 1 || Date.now() > new Date(reset.expires_at).getTime()) {
          return respond({ error: 'Invalid or expired reset link.' }, 400);
        }

        await env.DB.batch([
          env.DB.prepare('UPDATE artists SET password_hash = ? WHERE id = ?').bind(await CryptoUtils.hashPassword(body.newPassword), reset.artist_id),
          env.DB.prepare('UPDATE password_resets SET used = 1 WHERE token = ?').bind(body.token),
        ]);

        return respond({ success: true, message: 'Password updated. You can now sign in.' });
      }

      // -------------------- AUTHENTICATED ROUTES --------------------
      const authHeader = request.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) return respond({ error: 'Access denied.' }, 401);

      const session = await CryptoUtils.verifyToken(authHeader.slice(7), env.JWT_SECRET);
      if (!session) return respond({ error: 'Invalid or expired session.' }, 401);

      // ---- Transactions ----
      if (url.pathname === '/api/transactions' && request.method === 'GET') {
        const { results } = await env.DB
          .prepare('SELECT * FROM transactions WHERE artist_id = ? ORDER BY timestamp DESC LIMIT 1000')
          .bind(session.artistId)
          .all();
        return respond(results);
      }

      if (url.pathname === '/api/transactions' && request.method === 'POST') {
        const body = await readJson(request);
        if (!body) return respond({ error: 'Invalid request body.' }, 400);

        const validated = validateTransaction(body);
        if (!validated.ok) return respond({ error: validated.error }, 400);

        const tx = validated.data;
        const netAmount = calculateNet(tx.grossAmount, tx.shopFeeType, tx.shopCutPercentage, tx.shopFixedFee);

        await env.DB
          .prepare(
            `INSERT INTO transactions
              (id, artist_id, timestamp, clientName, description, incomeType, paymentMethod, grossAmount, shopFeeType, shopCutPercentage, shopFixedFee, netAmount)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            tx.id, session.artistId, tx.timestamp, tx.clientName, tx.description, tx.incomeType,
            tx.paymentMethod, tx.grossAmount, tx.shopFeeType, tx.shopCutPercentage, tx.shopFixedFee, netAmount,
          )
          .run();

        return respond({ success: true, id: tx.id, netAmount }, 201);
      }

      if (url.pathname === '/api/transactions/import' && request.method === 'POST') {
        const body = await readJson(request);
        const list = body?.transactions;
        if (!Array.isArray(list) || list.length === 0 || list.length > 1000) {
          return respond({ error: 'Backup must contain 1 to 1,000 sessions.' }, 400);
        }

        const statements: D1PreparedStatement[] = [];
        for (const item of list) {
          if (!item || typeof item !== 'object' || Array.isArray(item)) return respond({ error: 'Backup contains an invalid session.' }, 400);
          const validated = validateTransaction(item as JsonObject);
          if (!validated.ok) return respond({ error: `Backup contains an invalid session: ${validated.error}` }, 400);

          const tx = validated.data;
          const netAmount = calculateNet(tx.grossAmount, tx.shopFeeType, tx.shopCutPercentage, tx.shopFixedFee);

          statements.push(
            env.DB.prepare(
              `INSERT INTO transactions
                (id, artist_id, timestamp, clientName, description, incomeType, paymentMethod, grossAmount, shopFeeType, shopCutPercentage, shopFixedFee, netAmount)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(id) DO UPDATE SET
                 timestamp = excluded.timestamp,
                 clientName = excluded.clientName,
                 description = excluded.description,
                 incomeType = excluded.incomeType,
                 paymentMethod = excluded.paymentMethod,
                 grossAmount = excluded.grossAmount,
                 shopFeeType = excluded.shopFeeType,
                 shopCutPercentage = excluded.shopCutPercentage,
                 shopFixedFee = excluded.shopFixedFee,
                 netAmount = excluded.netAmount
               WHERE transactions.artist_id = excluded.artist_id`,
            ).bind(
              tx.id, session.artistId, tx.timestamp, tx.clientName, tx.description, tx.incomeType,
              tx.paymentMethod, tx.grossAmount, tx.shopFeeType, tx.shopCutPercentage, tx.shopFixedFee, netAmount,
            ),
          );
        }

        await env.DB.batch(statements);
        return respond({ success: true, restored: statements.length, message: `Restored ${statements.length} session(s).` });
      }

      const transactionMatch = url.pathname.match(/^\/api\/transactions\/([^/]+)$/);
      if (transactionMatch && request.method === 'PUT') {
        const id = decodeURIComponent(transactionMatch[1]);
        const body = await readJson(request);
        if (!body) return respond({ error: 'Invalid request body.' }, 400);

        body.id = id;
        const validated = validateTransaction(body);
        if (!validated.ok) return respond({ error: validated.error }, 400);

        const tx = validated.data;
        const netAmount = calculateNet(tx.grossAmount, tx.shopFeeType, tx.shopCutPercentage, tx.shopFixedFee);

        const result = await env.DB
          .prepare(
            `UPDATE transactions SET
              clientName = ?, description = ?, incomeType = ?, paymentMethod = ?,
              grossAmount = ?, shopFeeType = ?, shopCutPercentage = ?, shopFixedFee = ?, netAmount = ?
             WHERE id = ? AND artist_id = ?`,
          )
          .bind(
            tx.clientName, tx.description, tx.incomeType, tx.paymentMethod, tx.grossAmount,
            tx.shopFeeType, tx.shopCutPercentage, tx.shopFixedFee, netAmount, id, session.artistId,
          )
          .run();

        if (!result.meta.changes) return respond({ error: 'Session not found.' }, 404);
        return respond({ success: true, id, netAmount });
      }

      if (transactionMatch && request.method === 'DELETE') {
        const id = decodeURIComponent(transactionMatch[1]);
        const result = await env.DB
          .prepare('DELETE FROM transactions WHERE id = ? AND artist_id = ?')
          .bind(id, session.artistId)
          .run();

        if (!result.meta.changes) return respond({ error: 'Session not found.' }, 404);
        return respond({ success: true });
      }

      // ---- Recurring / one-time shop costs ----
      if (url.pathname === '/api/shop-expenses' && request.method === 'GET') {
        const { results } = await env.DB
          .prepare(
            `SELECT
              id, name, amount, frequency,
              starts_on AS startsOn,
              ends_on AS endsOn,
              created_at AS createdAt
             FROM shop_expenses
             WHERE artist_id = ?
             ORDER BY starts_on DESC, created_at DESC`,
          )
          .bind(session.artistId)
          .all();

        return respond(results);
      }

      if (url.pathname === '/api/shop-expenses' && request.method === 'POST') {
        const body = await readJson(request);
        if (!body) return respond({ error: 'Invalid request body.' }, 400);

        const validated = validateExpense(body);
        if (!validated.ok) return respond({ error: validated.error }, 400);

        const expense = validated.data;
        const id = CryptoUtils.uuid();

        await env.DB
          .prepare(
            'INSERT INTO shop_expenses (id, artist_id, name, amount, frequency, starts_on, ends_on) VALUES (?, ?, ?, ?, ?, ?, ?)',
          )
          .bind(id, session.artistId, expense.name, expense.amount, expense.frequency, expense.startsOn, expense.endsOn)
          .run();

        return respond({ success: true, id }, 201);
      }

      const expenseMatch = url.pathname.match(/^\/api\/shop-expenses\/([^/]+)$/);
      if (expenseMatch && request.method === 'PUT') {
        const id = decodeURIComponent(expenseMatch[1]);
        const body = await readJson(request);
        if (!body) return respond({ error: 'Invalid request body.' }, 400);

        const validated = validateExpense(body);
        if (!validated.ok) return respond({ error: validated.error }, 400);

        const expense = validated.data;
        const result = await env.DB
          .prepare(
            `UPDATE shop_expenses SET name = ?, amount = ?, frequency = ?, starts_on = ?, ends_on = ?
             WHERE id = ? AND artist_id = ?`,
          )
          .bind(expense.name, expense.amount, expense.frequency, expense.startsOn, expense.endsOn, id, session.artistId)
          .run();

        if (!result.meta.changes) return respond({ error: 'Shop cost not found.' }, 404);
        return respond({ success: true, id });
      }

      if (expenseMatch && request.method === 'DELETE') {
        const id = decodeURIComponent(expenseMatch[1]);
        const result = await env.DB
          .prepare('DELETE FROM shop_expenses WHERE id = ? AND artist_id = ?')
          .bind(id, session.artistId)
          .run();

        if (!result.meta.changes) return respond({ error: 'Shop cost not found.' }, 404);
        return respond({ success: true });
      }

      return respond({ error: 'Not found.' }, 404);
    } catch (error) {
      console.error('Unhandled worker error:', error);
      return respond({ error: 'Internal server error.' }, 500);
    }
  },
};
