import { defineConfig } from "drizzle-kit";
import path from "path";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  // Migrations must live in netlify/database/migrations so the Netlify
  // platform applies them automatically on deploy.
  out: path.join(__dirname, "../../netlify/database/migrations"),
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  // Use a timestamp prefix so generated migrations always sort after any
  // previously-applied version (an index prefix of 0000 is rejected by the
  // platform as out-of-order).
  migrations: {
    prefix: "timestamp",
  },
});
