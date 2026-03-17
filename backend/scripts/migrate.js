require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

const pool = new Pool({
  user: process.env.PG_USER || "postgres",
  password: process.env.PG_PASSWORD || "admin123",
  host: process.env.PG_HOST || "localhost",
  port: Number(process.env.PG_PORT || 5432),
  database: process.env.PG_DATABASE || "payroll",
});

async function runMigrations() {
  const client = await pool.connect();
  try {
    // Create migrations tracking table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS public._migrations (
        id SERIAL PRIMARY KEY,
        filename TEXT UNIQUE NOT NULL,
        ran_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    const migrationsDir = path.join(__dirname, "../migrations");
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith(".sql"))
      .sort(); // runs in order: 001_, 002_, etc.

    for (const file of files) {
      // Skip already-run migrations
      const { rowCount } = await client.query(
        "SELECT 1 FROM public._migrations WHERE filename = $1",
        [file]
      );
      if (rowCount > 0) {
        console.log(`⏭  Skipping (already ran): ${file}`);
        continue;
      }

      console.log(`▶  Running: ${file}`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");

      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          "INSERT INTO public._migrations (filename) VALUES ($1)",
          [file]
        );
        await client.query("COMMIT");
        console.log(`✅ Done: ${file}`);
      } catch (err) {
        await client.query("ROLLBACK");
        console.error(`❌ Failed on ${file}:`, err.message);
        process.exit(1);
      }
    }

    console.log("\n🎉 All migrations complete.");
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations();