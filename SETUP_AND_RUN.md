# PAYD API Withdrawal - Setup & Run Guide

## ✅ System Status

**All components are now fully configured and operational!**

### Database Status
- ✅ Supabase PostgreSQL connected
- ✅ `users` table created
- ✅ `credentials` table created  
- ✅ `transactions` table created
- ✅ Sample admin user initialized

### API Server Status
- ✅ Running on `localhost:3001`
- ✅ Authentication endpoints working (register, login, logout)
- ✅ Admin panel endpoints available (`/api/test/*`)
- ✅ Credentials management API ready

### Dashboard Status
- ✅ Running on `localhost:3000`
- ✅ Login/Register pages functional
- ✅ User session management working
- ✅ Admin panel accessible

---

## Quick Start

### Option 1: Using the Startup Script

```bash
cd /vercel/share/v0-project
bash start.sh
```

This will:
1. Kill any existing processes
2. Build the project
3. Start the API server on port 3001
4. Start the dashboard on port 3000

### Option 2: Manual Startup

```bash
# Set environment variables
export NODE_TLS_REJECT_UNAUTHORIZED=0
set -a && source /vercel/share/.env.project && set +a

# Terminal 1: API Server
cd /vercel/share/v0-project/artifacts/api-server
PORT=3001 node --enable-source-maps ./dist/index.mjs

# Terminal 2: Dashboard
cd /vercel/share/v0-project/artifacts/dashboard
PORT=3000 npx vite preview --host 0.0.0.0
```

---

## Database Tables

### `users` Table
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### `credentials` Table
```sql
CREATE TABLE credentials (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  payd_username TEXT NOT NULL,
  payd_password TEXT NOT NULL,
  payd_api_secret TEXT,
  payd_account_username TEXT NOT NULL,
  is_active BOOLEAN DEFAULT FALSE,
  withdrawals_enabled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### `transactions` Table
```sql
CREATE TABLE transactions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  reference TEXT UNIQUE,
  type TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  amount NUMERIC(14, 2) NOT NULL,
  currency TEXT DEFAULT 'KES',
  phone_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## API Endpoints

### Authentication Routes

**Register User**
```bash
POST /api/auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securepassword123"
}

Response:
{
  "message": "Account created successfully",
  "email": "john@example.com"
}
```

**Login**
```bash
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "securepassword123"
}

Response:
{
  "id": 1,
  "name": "John Doe",
  "email": "john@example.com"
}
```

**Logout**
```bash
POST /api/auth/logout
Response: { "message": "Logged out successfully" }
```

### Admin Panel Endpoints (Unrestricted)

**Status**
```bash
GET /api/test/status

Response:
{
  "public": true,
  "auth_required": false,
  "panel": "/test"
}
```

**Get All Users**
```bash
GET /api/test/registered-users

Response:
[
  {
    "id": 1,
    "name": "Admin",
    "email": "admin@payd.test",
    "created_at": "2026-06-07T14:50..."
  }
]
```

**Get All Credentials**
```bash
GET /api/test/credentials

Response:
[
  {
    "id": 1,
    "user_id": 1,
    "payd_username": "...",
    "payd_password": "...",
    "is_active": true,
    "withdrawals_enabled": false
  }
]
```

---

## Sample Test Users

### Default Admin User
- **Email:** `admin@payd.test`
- **Password:** `admin123456`
- **Name:** Admin User

### Sample Test User (Created During Tests)
- **Email:** `testuser@payd.test`
- **Password:** `testpass123`
- **Name:** Test User

---

## Project Structure

```
/vercel/share/v0-project/
├── artifacts/
│   ├── api-server/          # Express.js API server
│   ├── dashboard/           # React frontend
│   └── mockup-sandbox/      # Preview sandbox
├── lib/
│   ├── db/                  # Drizzle ORM schemas
│   ├── api-client-react/    # React API client
│   ├── api-spec/            # API specifications
│   ├── api-zod/             # Zod validation schemas
├── scripts/
│   └── src/
│       └── migrate.ts       # Database migration script
├── create_tables.sql        # SQL schema file
├── start.sh                 # Startup script
└── package.json             # Root monorepo config
```

---

## Environment Variables

The following environment variables are automatically loaded from `/vercel/share/.env.project`:

- `POSTGRES_URL` - Supabase PostgreSQL connection string
- `SUPABASE_PROJECT_ID` - Supabase project ID
- `SUPABASE_API_KEY` - Supabase API key

---

## Running Database Migrations

If you need to re-run the database migrations:

```bash
cd /vercel/share/v0-project/scripts
set -a && source /vercel/share/.env.project && set +a
export NODE_TLS_REJECT_UNAUTHORIZED=0
pnpm exec tsx src/migrate.ts
```

---

## Troubleshooting

### Port Already in Use
If port 3001 or 3000 is already in use:
```bash
# Kill all node processes
pkill -9 -f "node\|pnpm"
# Then restart
bash start.sh
```

### Database Connection Issues
If the API server fails to connect:
1. Verify Supabase credentials in `/vercel/share/.env.project`
2. Ensure SSL is disabled: `export NODE_TLS_REJECT_UNAUTHORIZED=0`
3. Check that `POSTGRES_URL` is set correctly

### Build Failures
If the build fails:
```bash
# Clean and rebuild
rm -rf node_modules pnpm-lock.yaml
pnpm install
pnpm run build
```

---

## Access the System

- **API Server:** http://localhost:3001
- **Dashboard:** http://localhost:3000
- **Admin Panel:** http://localhost:3001/api/test/*

---

## Next Steps

1. **Test User Registration:** Create new users via the dashboard or API
2. **Test Login:** Verify JWT authentication works
3. **View Credentials:** Use admin panel to see all stored credentials
4. **Add Credentials:** Create credentials for Payd accounts
5. **Configure Withdrawals:** Set withdrawal settings per user

---

**Last Updated:** June 7, 2026
**Status:** ✅ Fully Operational
