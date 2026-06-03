import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

// Accept the connection string from either the Netlify Database env vars
// (set automatically when the managed Postgres is provisioned) or the
// DATABASE_URL used in local/Replit environments.
const connectionString =
  process.env.NETLIFY_DATABASE_URL ??
  process.env.NETLIFY_DATABASE_URL_UNPOOLED ??
  process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "No database connection string found. Set NETLIFY_DATABASE_URL (Netlify) or DATABASE_URL.",
  );
}

// Neon (the Netlify Database backend) requires TLS.
const needsSsl = /sslmode=require|neon\.tech/.test(connectionString);

export const pool = new Pool({
  connectionString,
  ...(needsSsl ? { ssl: { rejectUnauthorized: false } } : {}),
});
export const db = drizzle(pool, { schema });

export * from "./schema";
