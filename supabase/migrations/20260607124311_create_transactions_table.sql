
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  reference TEXT,
  correlator_id TEXT,
  type TEXT,
  status TEXT,
  amount NUMERIC,
  currency TEXT,
  phone_number TEXT,
  narration TEXT,
  channel TEXT,
  business_account TEXT,
  business_type TEXT,
  receiver_username TEXT,
  wallet_type TEXT,
  result_code TEXT,
  remarks TEXT,
  third_party_trans_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS transactions_user_id_idx ON transactions (user_id);
CREATE INDEX IF NOT EXISTS transactions_reference_idx ON transactions (reference);
CREATE INDEX IF NOT EXISTS transactions_created_at_idx ON transactions (created_at DESC);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_transactions" ON transactions FOR SELECT
  TO authenticated USING (auth.uid()::text = user_id::text);

CREATE POLICY "insert_own_transactions" ON transactions FOR INSERT
  TO authenticated WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "update_own_transactions" ON transactions FOR UPDATE
  TO authenticated USING (auth.uid()::text = user_id::text) WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "delete_own_transactions" ON transactions FOR DELETE
  TO authenticated USING (auth.uid()::text = user_id::text);
