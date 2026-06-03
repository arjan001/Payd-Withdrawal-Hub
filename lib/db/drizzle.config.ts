import { defineConfig } from "drizzle-kit";
import path from "path";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "No database connection string found. Set DATABASE_URL.",
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
