const bcrypt = require("bcryptjs");
const pool = require("./db"); // <-- db.js is in the same folder

(async () => {
  try {
    const { rows } = await pool.query("SELECT id, username, password FROM public.users");

    for (const u of rows) {
      const plain = String(u.password || "");

      // skip if already bcrypt hash
      if (plain.startsWith("$2a$") || plain.startsWith("$2b$") || plain.startsWith("$2y$")) {
        console.log(`Skipping (already hashed): ${u.username}`);
        continue;
      }

      const hash = await bcrypt.hash(plain, 10);

      await pool.query("UPDATE public.users SET password = $1 WHERE id = $2", [hash, u.id]);

      console.log(`Hashed: ${u.username}`);
    }

    console.log("✅ Done hashing all users.");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error hashing users:", err.message);
    process.exit(1);
  }
})();