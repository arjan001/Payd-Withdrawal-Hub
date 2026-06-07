
CREATE TABLE IF NOT EXISTS credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  payd_username TEXT,
  payd_password TEXT,
  payd_api_secret TEXT,
  payd_account_username TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  withdrawals_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS credentials_user_id_idx ON credentials (user_id);

ALTER TABLE credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_credentials" ON credentials FOR SELECT
  TO authenticated USING (auth.uid()::text = user_id::text);

CREATE POLICY "insert_own_credentials" ON credentials FOR INSERT
  TO authenticated WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "update_own_credentials" ON credentials FOR UPDATE
  TO authenticated USING (auth.uid()::text = user_id::text) WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "delete_own_credentials" ON credentials FOR DELETE
  TO authenticated USING (auth.uid()::text = user_id::text);
