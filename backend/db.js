const { Pool } = require("pg");

const pool = new Pool({
  user: process.env.PG_USER || "postgres",
  password: process.env.PG_PASSWORD || "admin123",
  host: process.env.PG_HOST || "localhost",
  port: Number(process.env.PG_PORT || 5432),
  database: process.env.PG_DATABASE || "payroll",

  // Connection pool health settings
  max: 10,                        // max connections in pool
  idleTimeoutMillis: 30000,       // close idle connections after 30s
  connectionTimeoutMillis: 5000,  // fail fast if can't connect in 5s

  // Keepalive — critical for Docker networking
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});

pool.on("error", (err) => {
  console.error("Unexpected PostgreSQL error:", err);
  // Don't crash the process — pool will try to reconnect
});

// Optional: test connection on startup so you catch misconfig early
pool.query("SELECT 1").catch((err) => {
  console.error("DB connection test failed:", err.message);
});

module.exports = pool;