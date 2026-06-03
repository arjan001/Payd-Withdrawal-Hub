import { drizzle } from "drizzle-orm/node-postgres";
import { sql as dsql } from "drizzle-orm";
import pg from "pg";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "No database connection string found. Set DATABASE_URL.",
  );
}

const pool = new pg.Pool({ connectionString });

export const db = drizzle(pool, { schema });

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
      ensureCredentialsPromise = null;
      throw err;
    });
  }
  return ensureCredentialsPromise;
}

export * from "./schema";
