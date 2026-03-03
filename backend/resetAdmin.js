const bcrypt = require("bcryptjs");
const pool = require("./db");

(async () => {
  const username = "admin";
  const newPassword = "admin123";

  const hash = await bcrypt.hash(newPassword, 10);

  const r = await pool.query(
    `UPDATE public.users SET password=$1 WHERE username=$2 RETURNING username`,
    [hash, username]
  );

  console.log("Updated:", r.rows[0]);
  process.exit(0);
})();