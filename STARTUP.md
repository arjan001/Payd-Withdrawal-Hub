# PAYD API Withdrawal - Startup & Configuration Guide

## ✅ Project Status

The project is now fully configured and running with:
- **API Server**: `localhost:3001`
- **Dashboard**: `localhost:3000`
- **Database**: Supabase PostgreSQL (configured)
- **Authentication**: Email/Password with JWT tokens

## 🚀 Quick Start

### Prerequisites
```bash
cd /vercel/share/v0-project
pnpm install  # Already done
```

### Start Services

**Terminal 1 - Start API Server:**
```bash
set -a && source /vercel/share/.env.project && set +a
export NODE_TLS_REJECT_UNAUTHORIZED=0
cd artifacts/api-server
PORT=3001 node --enable-source-maps ./dist/index.mjs
```

**Terminal 2 - Start Dashboard:**
```bash
cd /vercel/share/v0-project/artifacts/dashboard
PORT=3000 npx vite preview --host 0.0.0.0
```

## 📝 Database Configuration

### Supabase Connection
- **URL**: Automatically configured via `POSTGRES_URL` env var
- **SSL**: Disabled for development (`NODE_TLS_REJECT_UNAUTHORIZED=0`)
- **Tables Created Automatically**:
  - `users` - User login accounts
  - `credentials` - Payd API credentials per user
  - `transactions` - Transaction history

### Schema Details

**Users Table**
```sql
id (serial primary key)
name (text)
email (text, unique)
password_hash (text)
created_at (timestamp)
updated_at (timestamp)
```

**Credentials Table**
```sql
id (serial primary key)
user_id (integer, foreign key to users)
payd_username (text)
payd_password (text)
payd_api_secret (text)
payd_account_username (text)
is_active (boolean)
withdrawals_enabled (boolean)
created_at (timestamp)
updated_at (timestamp)
```

## 🔑 Authentication

### Register User
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "User Name",
    "email": "user@example.com",
    "password": "password123"
  }'
```

### Login User
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'
```

Response includes JWT cookie for session management.

## 👨‍💼 Admin Panel (Unrestricted Access)

### View All Credentials
```bash
curl http://localhost:3001/api/test/credentials
```

### View Registered Users
```bash
curl http://localhost:3001/api/test/registered-users
```

### Get User Credentials by ID
```bash
curl http://localhost:3001/api/test/by-user/1/credentials
```

### Get User Balance
```bash
curl http://localhost:3001/api/test/by-user/1/balance
```

### Assign Credentials to User
```bash
curl -X POST http://localhost:3001/api/test/by-user/2/assign-credentials \
  -H "Content-Type: application/json" \
  -d '{"source_user_id": 1}'
```

## 📊 Dashboard

Access the UI at `http://localhost:3000`
- `/test` - Admin panel (unrestricted)
- `/` - Dashboard (login required)
- `/settings` - User settings
- Other protected routes require authentication

## 🛠️ Development Notes

### Fixing SSL Issues
If you encounter SSL certificate errors:
```bash
export NODE_TLS_REJECT_UNAUTHORIZED=0  # For development only
```

### Rebuilding Services
```bash
# Rebuild API
cd artifacts/api-server && pnpm run build

# Rebuild Dashboard
cd artifacts/dashboard && pnpm run build
```

### Database Initialization
The database schema initializes automatically on API startup via `initializeDatabase()` in `lib/db/src/index.ts`. All tables are created with `IF NOT EXISTS` guards.

## ✨ Key Features Configured

1. **Multi-User Support** - Each user has their own credentials and transactions
2. **Credentials Storage** - Payd API keys stored per user, visible in admin panel
3. **Admin Panel** - Unrestricted access to all credentials via `/api/test/*` endpoints
4. **Session Management** - JWT tokens in HTTP-only cookies
5. **Automatic Schema** - Tables created on first server start

## 🔗 Environment Variables

Required (already configured):
- `POSTGRES_URL` - Supabase connection string
- `POSTGRES_URL_NON_POOLING` - Non-pooled connection
- `SUPABASE_*` - Supabase service keys

## 📦 Next Steps

1. ✅ API Server running
2. ✅ Dashboard served
3. ✅ Database connected
4. ✅ Authentication working
5. ✅ Admin panel accessible

**Ready to:**
- Register test users
- View credentials in admin panel
- Configure Payd withdrawal settings per user
- Monitor transactions

Enjoy! 🎉
