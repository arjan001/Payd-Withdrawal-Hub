import { defineConfig } from "drizzle-kit";
import path from "path";

// `drizzle-kit generate` builds migrations by diffing the schema against the
// stored snapshot — it does not connect to the database, so no connection
// string is required here. The Netlify platform applies the generated SQL
// automatically on every deploy.
export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  // Migrations must live in netlify/database/migrations so the Netlify
  // platform applies them automatically on deploy.
  out: path.join(__dirname, "../../netlify/database/migrations"),
  dialect: "postgresql",
  // Use a timestamp prefix so generated migrations always sort after any
  // previously-applied version (an index prefix of 0000 is rejected by the
  // platform as out-of-order).
  migrations: {
    prefix: "timestamp",
  },
});
