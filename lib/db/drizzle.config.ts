import { defineConfig } from "drizzle-kit";
import path from "path";

const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

if (!connectionString) {
  throw new Error(
    "No database connection string found. Set DATABASE_URL or SUPABASE_DB_URL.",
  );
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  out: path.join(__dirname, "../../netlify/database/migrations"),
  dialect: "postgresql",
  dbCredentials: {
    url: connectionString,
  },
  migrations: {
    prefix: "timestamp",
  },
});
