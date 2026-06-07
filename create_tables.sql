-- Create users table
CREATE TABLE IF NOT EXISTS public.users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create index on users email
CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON public.users(email);

-- Create credentials table
CREATE TABLE IF NOT EXISTS public.credentials (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    payd_username TEXT NOT NULL,
    payd_password TEXT NOT NULL,
    payd_api_secret TEXT,
    payd_account_username TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    withdrawals_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create index on credentials user_id
CREATE UNIQUE INDEX IF NOT EXISTS credentials_user_id_idx ON public.credentials(user_id);

-- Create transactions table
CREATE TABLE IF NOT EXISTS public.transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES public.users(id) ON DELETE CASCADE,
    reference TEXT UNIQUE,
    correlator_id TEXT UNIQUE,
    type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    amount NUMERIC(14, 2) NOT NULL,
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
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Insert sample admin user
INSERT INTO public.users (name, email, password_hash)
VALUES (
    'Admin User',
    'admin@payd.test',
    '$2a$10$YourHashedPasswordHere'
) ON CONFLICT (email) DO NOTHING;

COMMIT;
