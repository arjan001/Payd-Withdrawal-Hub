import { drizzle } from "drizzle-orm/node-postgres";
import { sql as dsql } from "drizzle-orm";
import pg from "pg";
import * as schema from "./schema";

let _db: ReturnType<typeof drizzle> | null = null;
let _pool: pg.Pool | null = null;

function initPool(): pg.Pool {
  if (_pool) return _pool;
  
  const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  
  console.log("[v0 DB] DATABASE_URL available:", !!process.env.DATABASE_URL);
  console.log("[v0 DB] SUPABASE_DB_URL available:", !!process.env.SUPABASE_DB_URL);
  console.log("[v0 DB] connectionString first 30 chars:", connectionString?.substring(0, 30) || "null");

  if (!connectionString) {
    throw new Error(
      "No database connection string found. Set DATABASE_URL or SUPABASE_DB_URL.",
    );
  }

  console.log("[v0 DB] Creating pg.Pool with connectionString:", connectionString);
  _pool = new pg.Pool({ 
    connectionString,
    ssl: connectionString?.includes('neon') ? { rejectUnauthorized: false } : false
  });
  console.log("[v0 DB] Pool created, host:", _pool.options?.host, "port:", _pool.options?.port);
  return _pool;
}

export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get: (_, prop) => {
    if (!_db) {
      const pool = initPool();
      _db = drizzle(pool, { schema });
    }
    return Reflect.get(_db as any, prop);
  },
});

// ─── Auto-setup: idempotent full schema init ──────────────────────────────────
// Called once at server startup. Safe to run on every boot — all statements
// use IF NOT EXISTS / IF NOT EXISTS index guards, so re-running is a no-op.
// When the project is forked or cloned and run fresh, this creates every table
// and index automatically without any manual migration step.

let _initPromise: Promise<void> | null = null;

export function initializeDatabase(): Promise<void> {
  if (!_initPromise) {
    _initPromise = _run().catch((err) => {
      _initPromise = null; // allow retry on transient failure
      throw err;
    });
  }
  return _initPromise;
}

async function _run(): Promise<void> {
  // 1. users — must exist before credentials (FK)
  await db.execute(dsql`
    CREATE TABLE IF NOT EXISTS "users" (
      "id"            serial PRIMARY KEY NOT NULL,
      "name"          text NOT NULL,
      "email"         text NOT NULL,
      "password_hash" text NOT NULL,
      "created_at"    timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at"    timestamp with time zone DEFAULT now() NOT NULL
    )
  `);
  await db.execute(dsql`
    CREATE UNIQUE INDEX IF NOT EXISTS "users_email_idx"
      ON "users" USING btree ("email")
  `);

  // 2. credentials — scoped per user (one row per user)
  await db.execute(dsql`
    CREATE TABLE IF NOT EXISTS "credentials" (
      "id"                    serial PRIMARY KEY NOT NULL,
      "user_id"               integer REFERENCES "users"("id"),
      "payd_username"         text NOT NULL,
      "payd_password"         text NOT NULL,
      "payd_api_secret"       text,
      "payd_account_username" text NOT NULL,
      "is_active"             boolean DEFAULT false NOT NULL,
      "withdrawals_enabled"   boolean DEFAULT false NOT NULL,
      "created_at"            timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at"            timestamp with time zone DEFAULT now() NOT NULL
    )
  `);
  await db.execute(dsql`
    CREATE UNIQUE INDEX IF NOT EXISTS "credentials_user_id_idx"
      ON "credentials" USING btree ("user_id")
  `);
  // Same Payd wallet may be linked to multiple registered users — user_id is the only unique key
  await dropLegacyPaydAccountUsernameConstraint();
  // Add user_id column to existing installs that pre-date multi-tenancy
  await db.execute(dsql`
    DO $$ BEGIN
      ALTER TABLE "credentials" ADD COLUMN "user_id" integer REFERENCES "users"("id");
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $$
  `);
  // Backfill user_id on legacy credential rows by matching account username to user name or email
  await db.execute(dsql`
    UPDATE "credentials" AS c
    SET "user_id" = u."id", "withdrawals_enabled" = true
    FROM "users" AS u
    WHERE c."user_id" IS NULL
      AND (
        LOWER(u."name") = LOWER(c."payd_account_username")
        OR LOWER(split_part(u."email", '@', 1)) = LOWER(c."payd_account_username")
        OR LOWER(u."name") = LOWER(c."payd_username")
        OR LOWER(split_part(u."email", '@', 1)) = LOWER(c."payd_username")
      )
  `);
  // Ensure every linked credential can withdraw with its own API keys
  await db.execute(dsql`
    UPDATE "credentials"
    SET "withdrawals_enabled" = true
    WHERE "user_id" IS NOT NULL
      AND "withdrawals_enabled" = false
  `);

  // 3. transactions — scoped per user
  await db.execute(dsql`
    CREATE TABLE IF NOT EXISTS "transactions" (
      "id"                   serial PRIMARY KEY NOT NULL,
      "user_id"              integer REFERENCES "users"("id"),
      "reference"            text UNIQUE,
      "correlator_id"        text UNIQUE,
      "type"                 text NOT NULL,
      "status"               text DEFAULT 'pending' NOT NULL,
      "amount"               numeric(14,2) NOT NULL,
      "currency"             text DEFAULT 'KES' NOT NULL,
      "phone_number"         text,
      "narration"            text,
      "channel"              text,
      "business_account"     text,
      "business_type"        text,
      "receiver_username"    text,
      "wallet_type"          text,
      "result_code"          integer,
      "remarks"              text,
      "third_party_trans_id" text,
      "created_at"           timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at"           timestamp with time zone DEFAULT now() NOT NULL
    )
  `);
  // Add user_id column to existing installs that pre-date multi-tenancy
  await db.execute(dsql`
    DO $$ BEGIN
      ALTER TABLE "transactions" ADD COLUMN "user_id" integer REFERENCES "users"("id");
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $$
  `);
}

/** Removes legacy uniqueness on payd_account_username so credentials are keyed by user_id only. */
export async function dropLegacyPaydAccountUsernameConstraint(): Promise<void> {
  await db.execute(dsql`DROP INDEX IF EXISTS "credentials_account_username_idx"`);
  await db.execute(dsql`
    DO $$ BEGIN
      ALTER TABLE "credentials" DROP CONSTRAINT IF EXISTS "credentials_payd_account_username_key";
    EXCEPTION WHEN undefined_object THEN NULL;
    END $$
  `);
}

// Backward-compat alias used in routes that call ensureCredentialsTable()
export function ensureCredentialsTable(): Promise<void> {
  return initializeDatabase();
}

export * from "./schema";
