import { Pool } from "pg";

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
    console.log("🗑️  Clearing all test data...\n");

    // Delete in correct order (foreign key constraints)
    const transResult = await client.query("DELETE FROM transactions");
    console.log(`✓ Deleted ${transResult.rowCount} transactions`);

    const credResult = await client.query("DELETE FROM credentials");
    console.log(`✓ Deleted ${credResult.rowCount} credentials`);

    const userResult = await client.query("DELETE FROM users");
    console.log(`✓ Deleted ${userResult.rowCount} users`);

    console.log("\n✅ Database cleared successfully!");
    console.log("Ready for fresh registration testing.");
  } finally {
    client.release();
    await pool.end();
  }
})();
