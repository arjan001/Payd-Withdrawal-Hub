import { Pool } from "pg";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const connectionString =
  process.env.DATABASE_URL ||
  process.env.SUPABASE_DB_URL ||
  process.env.POSTGRES_URL;

if (!connectionString) {
  throw new Error(
    "No database connection string found. Set DATABASE_URL, SUPABASE_DB_URL, or POSTGRES_URL."
  );
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false } as any,
});

(async () => {
  const client = await pool.connect();
  try {
    const sqlPath = path.join(__dirname, "../../create_tables.sql");
    const sql = fs.readFileSync(sqlPath, "utf8");
    const statements = sql.split(";").filter((s) => s.trim());

    console.log("🔄 Creating database tables...\n");

    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await client.query(statement);
          const cmd = statement.substring(0, 40).trim();
          console.log("✓", cmd.replace(/\n/g, " "), "...");
        } catch (err: any) {
          if (err.message.includes("already exists")) {
            console.log("⊘ Already exists:", statement.substring(0, 40).trim());
          } else {
            console.error("✗ Error:", err.message.substring(0, 80));
          }
        }
      }
    }
    console.log("\n✅ Database configuration complete!");
  } finally {
    client.release();
    await pool.end();
  }
})();
