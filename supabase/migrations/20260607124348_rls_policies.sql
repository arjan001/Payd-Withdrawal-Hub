
-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- users policies (app manages auth itself via password_hash, so allow service role full access)
-- Anon/authenticated access is handled at the app layer, not Supabase Auth.
-- We grant anon role access so the app's pg connection (using DATABASE_URL) can read/write.
CREATE POLICY "allow_all_users" ON users FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_credentials" ON credentials FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_transactions" ON transactions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
