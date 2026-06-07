
-- Drop and recreate tables to match the existing Drizzle schema (serial integer PKs)
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS credentials CASCADE;
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE users (
  id SERIAL PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX users_email_idx ON users USING btree (email);

CREATE TABLE credentials (
  id SERIAL PRIMARY KEY NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id),
  payd_username TEXT NOT NULL,
  payd_password TEXT NOT NULL,
  payd_api_secret TEXT,
  payd_account_username TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  withdrawals_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX credentials_user_id_idx ON credentials USING btree (user_id);

CREATE TABLE transactions (
  id SERIAL PRIMARY KEY NOT NULL,
  user_id INTEGER REFERENCES users(id),
  reference TEXT UNIQUE,
  correlator_id TEXT UNIQUE,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  amount NUMERIC(14,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'KES',
  phone_number TEXT,
  narration TEXT,
  channel TEXT,
  business_account TEXT,
  business_type TEXT,
  receiver_username TEXT,
  wallet_type TEXT,
  result_code INTEGER,
  remarks TEXT,
  third_party_trans_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX transactions_user_id_idx ON transactions (user_id);
CREATE INDEX transactions_created_at_idx ON transactions (created_at DESC);
