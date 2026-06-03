import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { getConnectionString } from "@netlify/database";
import { sql as dsql } from "drizzle-orm";
import * as schema from "./schema";

// Resolve the connection string through Netlify's own database package. This is
// the Neon Postgres instance that Netlify provisions and manages for the
// project: `getConnectionString()` reads the credentials Netlify injects at
// runtime (NETLIFY_DATABASE_URL and friends) so we never hard-code or juggle
// individual env vars here. A local DATABASE_URL is still honoured as a
// fallback for development outside of Netlify.
const connectionString = (() => {
  try {
    return getConnectionString();
  } catch {
    return process.env.DATABASE_URL;
  }
})();

if (!connectionString) {
  throw new Error(
    "No database connection string found. Provision the Netlify Database, or set DATABASE_URL locally.",
  );
}

// Use Neon's serverless HTTP driver rather than a long-lived TCP connection
// pool. Inside a Netlify Function each invocation runs in a short-lived,
// freezable container: a `pg.Pool` keeps TCP sockets open between invocations,
// but Neon closes those sockets while the container is frozen, so the next
// request hangs on a dead connection until the function times out — which the
// platform surfaces as an HTTP 502. The HTTP driver issues every query as an
// independent stateless request, so there is no pool to go stale and no event
// loop kept alive after the response is sent.
const sql = neon(connectionString);
export const db = drizzle(sql, { schema });

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
// This uses the application's own read/write Neon connection (the same one the
// dashboard uses for INSERT/UPDATE/DELETE), not the read-only `netlify db
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
