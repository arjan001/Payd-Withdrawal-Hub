import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { getConnectionString } from "@netlify/database";
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

export * from "./schema";
