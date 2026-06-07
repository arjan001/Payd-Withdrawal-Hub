
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users (email);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_user" ON users FOR SELECT
  TO authenticated USING (auth.uid()::text = id::text);

CREATE POLICY "insert_own_user" ON users FOR INSERT
  TO authenticated WITH CHECK (auth.uid()::text = id::text);

CREATE POLICY "update_own_user" ON users FOR UPDATE
  TO authenticated USING (auth.uid()::text = id::text) WITH CHECK (auth.uid()::text = id::text);

CREATE POLICY "delete_own_user" ON users FOR DELETE
  TO authenticated USING (auth.uid()::text = id::text);
