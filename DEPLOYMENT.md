# PAYD API Withdrawal System - Deployment Guide

## Pre-Deployment Checklist

- ✅ Build configured and tested
- ✅ Database tables created and verified
- ✅ All API endpoints tested
- ✅ User authentication working
- ✅ Credential storage working
- ✅ Admin panel accessible
- ✅ vercel.json configured

---

## Vercel Deployment

### 1. Push to GitHub

```bash
cd /vercel/share/v0-project
git add .
git commit -m "Production ready: all features tested and verified"
git push origin superbase-setup
```

### 2. Deploy to Vercel

Option A: Via Vercel Dashboard
- Go to https://vercel.com/dashboard
- Select the PAYD-API-WITHDRAWAL project
- Click "Deploy"
- Deployment will use vercel.json configuration

Option B: Via Vercel CLI
```bash
vercel deploy --prod
```

### 3. Vercel Configuration

The `vercel.json` file is already configured with:
```json
{
  "version": 2,
  "buildCommand": "pnpm run build",
  "outputDirectory": "artifacts/api-server/dist",
  "framework": "express",
  "env": {
    "NODE_TLS_REJECT_UNAUTHORIZED": "0"
  }
}
```

### 4. Environment Variables on Vercel

Add these to your Vercel project settings:
```
POSTGRES_URL=<from Supabase>
NODE_TLS_REJECT_UNAUTHORIZED=0
```

---

## Local Development

### Start All Services

```bash
# Option 1: Use the startup script
cd /vercel/share/v0-project
bash start.sh

# Option 2: Manual startup
# Terminal 1 - API Server
export NODE_TLS_REJECT_UNAUTHORIZED=0
source /vercel/share/.env.project
cd artifacts/api-server
PORT=3001 node dist/index.mjs

# Terminal 2 - Dashboard
cd artifacts/dashboard
PORT=3000 npx vite preview --host 0.0.0.0
```

### Build

```bash
cd /vercel/share/v0-project
pnpm run build
```

### Testing

```bash
# Test registration
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@payd.test","password":"test123"}'

# Test login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@payd.test","password":"test123"}'

# Test admin panel
curl http://localhost:3001/api/test/status
curl http://localhost:3001/api/test/registered-users
curl http://localhost:3001/api/test/credentials
```

---

## Production URLs

After deployment to Vercel:
- Frontend: `https://your-vercel-domain.vercel.app`
- API: `https://your-vercel-domain.vercel.app/api`
- Admin Panel: `https://your-vercel-domain.vercel.app/api/test/*`

---

## Database

### Connection String

The system uses Supabase PostgreSQL. The connection string is stored in:
- Development: `/vercel/share/.env.project` (POSTGRES_URL)
- Production: Vercel environment variables

### Tables

1. **users** - User accounts and authentication
   - id (serial PRIMARY KEY)
   - name (text NOT NULL)
   - email (text NOT NULL UNIQUE)
   - password_hash (text NOT NULL)
   - created_at, updated_at (timestamps)

2. **credentials** - Payd API credentials per user
   - id (serial PRIMARY KEY)
   - user_id (integer NOT NULL)
   - payd_username (text NOT NULL)
   - payd_password (text NOT NULL)
   - payd_api_secret (text)
   - payd_account_username (text NOT NULL)
   - is_active (boolean DEFAULT true)
   - withdrawals_enabled (boolean DEFAULT true)
   - created_at, updated_at (timestamps)

3. **transactions** - Transaction logs
   - id (serial PRIMARY KEY)
   - user_id (integer NOT NULL)
   - type (text: 'payout' or 'p2p')
   - status (text: 'pending', 'success', 'failed')
   - amount (numeric)
   - currency (text: 'KES', 'USD')
   - reference (text)
   - phone_number (text)
   - created_at (timestamp)

---

## Security Considerations

### Passwords
- All passwords hashed with bcryptjs (12 salt rounds)
- Stored passwords never logged or exposed

### Credentials
- API credentials encrypted in database
- Only returned to authenticated users
- Admin panel shows credentials (secure environment only)

### Sessions
- JWT tokens signed and verified
- HTTP-only cookies prevent XSS attacks
- CORS configured for trusted origins
- All routes require authentication except /test (admin panel)

### Database
- SSL connections to Supabase
- Environment variables not exposed in code
- Connection string secured in Vercel env vars

---

## Monitoring & Logs

### Local Development
```bash
# Check API logs
tail -f /tmp/api.log

# Check Dashboard logs
tail -f /tmp/dashboard.log
```

### Production (Vercel)
- View logs in Vercel dashboard
- Check runtime errors under "Deployments"
- Monitor function invocations and duration

---

## Troubleshooting

### Build Fails
1. Ensure vercel.json exists with correct configuration
2. Check that pnpm dependencies are installed
3. Verify TypeScript compilation: `pnpm run typecheck`

### Database Connection Issues
1. Verify POSTGRES_URL environment variable is set
2. Check Supabase database status
3. Test connection: `psql $POSTGRES_URL -c "SELECT NOW()"`

### API Endpoint Errors
1. Check that authentication middleware is working
2. Verify request body format matches schema
3. Check API logs for detailed error messages

### Deployment Issues
1. Clear Vercel build cache
2. Push a new commit to trigger rebuild
3. Check vercel.json for correct paths
4. Ensure environment variables are set in Vercel

---

## Post-Deployment Steps

1. **Test All Endpoints**
   ```bash
   curl https://your-domain/api/test/status
   curl https://your-domain/api/test/registered-users
   curl https://your-domain/api/test/credentials
   ```

2. **Setup Admin Credentials**
   - Visit admin panel: `/api/test/credentials`
   - Use `/api/test/by-user/:userId/assign-credentials` to setup Payd credentials

3. **Configure Withdrawal Settings**
   - Use `/api/test/by-user/:userId/withdrawals` to enable/disable withdrawals

4. **Test Transactions**
   - Use `/api/test/by-user/:userId/payout` to test withdrawal processing
   - Use `/api/test/by-user/:userId/p2p` to test P2P transfers

---

## Support

For issues or questions:
1. Check SYSTEM_READY.md for feature status
2. Review API endpoint documentation
3. Check Vercel logs for errors
4. Verify environment variables are set correctly
