-- 1. Drop old structures to prevent key constraint violations during testing
DROP TABLE IF EXISTS password_resets;
DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS artists;

-- 2. Secure Artist Registry Table
CREATE TABLE artists (
    id TEXT PRIMARY KEY NOT NULL,          -- UUID v4 generated on signup
    email TEXT UNIQUE NOT NULL,            -- Lowercase unique index
    password_hash TEXT NOT NULL,           -- Web Crypto API secure PBKDF2 hash
    artist_name TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 3. Consolidated Multi-Tenant Transaction Ledger Table
CREATE TABLE transactions (
    id TEXT PRIMARY KEY NOT NULL,
    artist_id TEXT NOT NULL,               -- Explicit multi-tenant data boundary mapping
    timestamp TEXT NOT NULL,               -- ISO 8601 string date representation
    clientName TEXT DEFAULT 'Anonymous Client',
    description TEXT,
    incomeType TEXT NOT NULL,              -- appointment, walk-in, deposit, tip
    paymentMethod TEXT NOT NULL,           -- cash, card, ath-movil, zelle, venmo, paypal
    grossAmount REAL NOT NULL,
    shopCutPercentage REAL DEFAULT 40,
    netAmount REAL NOT NULL,
    FOREIGN KEY(artist_id) REFERENCES artists(id) ON DELETE CASCADE
);

-- 4. Cryptographic Password Reset Registry
CREATE TABLE password_resets (
    id TEXT PRIMARY KEY NOT NULL,
    artist_id TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,            -- Secure random hex token string
    expires_at TEXT NOT NULL,              -- ISO timestamp (+1 hour window)
    used INTEGER DEFAULT 0 NOT NULL,       -- Boolean representation flag (0 = false, 1 = true)
    FOREIGN KEY(artist_id) REFERENCES artists(id) ON DELETE CASCADE
);

-- 5. Optimization Indexing Engine
CREATE INDEX IF NOT EXISTS idx_transactions_artist_timestamp ON transactions(artist_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_resets_token ON password_resets(token);