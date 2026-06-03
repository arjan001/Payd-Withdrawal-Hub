import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

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

export * from "./schema";
