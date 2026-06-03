import { drizzle } from "drizzle-orm/netlify-db";
import { sql as dsql } from "drizzle-orm";
import * as schema from "./schema";

// Connect through Netlify's official Drizzle adapter for Netlify Database.
//
// Previously this file used the Neon *HTTP* driver (`drizzle-orm/neon-http` +
// `neon(connectionString)`). That driver speaks Neon's SQL-over-HTTP protocol,
// but the database Netlify provisions for this project is reached over the
// standard Postgres wire protocol (its host is `*.db.netlify.com`, and in local
// dev/preview the connection is a plain TCP proxy such as
// `postgres://127.0.0.1:<port>`). The HTTP driver cannot talk to either of
// those — it rejects the local proxy URL outright and cannot reach a wire-only
// host — which is what surfaced as the recurring HTTP 502 and "database does
// not exist" failures.
//
// `drizzle-orm/netlify-db` is the adapter Netlify maintains for exactly this
// setup. Called with no connection argument it resolves the connection from the
// environment Netlify injects (`NETLIFY_DB_URL`, which the platform sets in dev,
// deploy previews, and production) — so there is no connection string to
// hard-code and no env-var name to guess.
//
// We pin the adapter to its `server` driver (node-postgres over the Postgres
// wire protocol). Its other option, `serverless`, immediately hands the
// connection string to Neon's HTTP client, which only accepts a full
// `postgresql://user:pass@host/db` Neon-HTTP URL and throws on the
// wire-protocol connection Netlify actually provides (e.g. the
// `postgres://127.0.0.1:<port>` proxy used in dev/preview). The wire-protocol
// driver is what `netlify db connect` and `@netlify/database` use by default,
// and it connects cleanly in every environment. An explicit platform-set
// `NETLIFY_DB_DRIVER` is still respected.
process.env["NETLIFY_DB_DRIVER"] ??= "server";

export const db = drizzle({ schema });

// ---------------------------------------------------------------------------
// Self-healing credentials table
// ---------------------------------------------------------------------------
// The canonical schema lives in `src/schema/credentials.ts` and is applied to
// the database through the migration in `netlify/database/migrations/`, which
// Netlify runs automatically on every deploy. That migration is the source of
// truth for the table's shape.
//
// `ensureCredentialsTable()` is a runtime safety net that runs the SAME table
// definition idempotently (`CREATE TABLE IF NOT EXISTS`) before the dashboard
// reads or writes credentials. It guarantees that saving credentials always
// works, even on a database branch where the migration has not been applied
// yet — which is exactly the "credentials store not ready" situation that
// previously caused saves to fail. On any database where the migration has
// already created the table, every statement below is a no-op.
//
// This uses the application's own read/write database connection (the same one
// the dashboard uses for INSERT/UPDATE/DELETE), not the read-only `netlify db
// connect` path, so the DDL is permitted.
let ensureCredentialsPromise: Promise<void> | null = null;

export function ensureCredentialsTable(): Promise<void> {
  if (!ensureCredentialsPromise) {
    ensureCredentialsPromise = (async () => {
      await db.execute(dsql`
        CREATE TABLE IF NOT EXISTS "credentials" (
          "id" serial PRIMARY KEY NOT NULL,
          "payd_username" text NOT NULL,
          "payd_password" text NOT NULL,
          "payd_api_secret" text,
          "payd_account_username" text NOT NULL,
          "is_active" boolean DEFAULT false NOT NULL,
          "withdrawals_enabled" boolean DEFAULT false NOT NULL,
          "created_at" timestamp with time zone DEFAULT now() NOT NULL,
          "updated_at" timestamp with time zone DEFAULT now() NOT NULL
        )
      `);
      await db.execute(dsql`
        CREATE UNIQUE INDEX IF NOT EXISTS "credentials_account_username_idx"
          ON "credentials" USING btree ("payd_account_username")
      `);
    })().catch((err) => {
      // Reset the cached promise so the next request can retry rather than
      // permanently caching a transient failure (e.g. a cold-start timeout).
      ensureCredentialsPromise = null;
      throw err;
    });
  }
  return ensureCredentialsPromise;
}

export * from "./schema";
