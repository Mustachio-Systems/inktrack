-- 0002_shop_agreements.sql
--
-- SAFE UPGRADE FOR AN EXISTING InkTrack D1 DATABASE.
-- Do NOT use the original DROP TABLE migration again in production:
-- it deletes all artists, transactions, and password-reset records.

ALTER TABLE transactions
  ADD COLUMN shopFeeType TEXT NOT NULL DEFAULT 'percentage';

ALTER TABLE transactions
  ADD COLUMN shopFixedFee REAL NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS shop_expenses (
  id TEXT PRIMARY KEY NOT NULL,
  artist_id TEXT NOT NULL,
  name TEXT NOT NULL,
  amount REAL NOT NULL CHECK(amount > 0),
  frequency TEXT NOT NULL CHECK(frequency IN ('weekly', 'monthly', 'one-time')),
  starts_on TEXT NOT NULL,
  ends_on TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY(artist_id) REFERENCES artists(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_shop_expenses_artist
  ON shop_expenses(artist_id, starts_on);
