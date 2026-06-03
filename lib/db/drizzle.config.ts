import { defineConfig } from "drizzle-kit";
import { getConnectionString } from "@netlify/database";
import path from "path";

// Resolve the connection string from Netlify's managed database (falling back
// to a local DATABASE_URL) so `drizzle-kit generate` works both on the Netlify
// platform and in local development.
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

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  // Migrations must live in netlify/database/migrations so the Netlify
  // platform applies them automatically on deploy.
  out: path.join(__dirname, "../../netlify/database/migrations"),
  dialect: "postgresql",
  dbCredentials: {
    url: connectionString,
  },
  // Use a timestamp prefix so generated migrations always sort after any
  // previously-applied version (an index prefix of 0000 is rejected by the
  // platform as out-of-order).
  migrations: {
    prefix: "timestamp",
  },
});
