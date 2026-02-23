const express = require("express");
const router = express.Router();
const pool = require("../db");
const { requireAuth, requireRole } = require("../middlewares/authMiddleware");

router.get("/", requireAuth, requireRole(["Admin"]), async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, username, password, role, created_at, branch_id
       FROM public.users
       ORDER BY id DESC`
    );
    res.json(result.rows);
  } catch (e) {
    console.error("GET /api/users ERROR:", e.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/", requireAuth, requireRole(["Admin"]), async (req, res) => {
  try {
    const { username, password, role, branch_id } = req.body;

    if (!username || !password || !role) {
      return res.status(400).json({ message: "username, password, role are required" });
    }

    const exists = await pool.query("SELECT id FROM public.users WHERE username=$1", [username]);
    if (exists.rows.length > 0) return res.status(409).json({ message: "Username already exists" });

    const result = await pool.query(
      `
      INSERT INTO public.users (username, password, role, branch_id, created_at)
      VALUES ($1,$2,$3,$4,NOW())
      RETURNING id, username, password, role, created_at, branch_id
      `,
      [username, password, role, branch_id ?? null]
    );

    res.json(result.rows[0]);
  } catch (e) {
    console.error("POST /api/users ERROR:", e.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.put("/:id", requireAuth, requireRole(["Admin"]), async (req, res) => {
  try {
    const { id } = req.params;
    const { username, password, role, branch_id } = req.body;

    if (!username || !role) return res.status(400).json({ message: "username and role are required" });

    const existing = await pool.query("SELECT id FROM public.users WHERE username=$1 AND id <> $2", [
      username,
      id,
    ]);
    if (existing.rows.length > 0) return res.status(409).json({ message: "Username already exists" });

    const result = await pool.query(
      `
      UPDATE public.users
      SET
        username = $1,
        role = $2,
        branch_id = $3,
        password = CASE WHEN $4 IS NULL OR $4 = '' THEN password ELSE $4 END,
        updated_at = NOW()
      WHERE id = $5
      RETURNING id, username, password, role, created_at, branch_id
      `,
      [username, role, branch_id ?? null, password ?? null, id]
    );

    if (result.rows.length === 0) return res.status(404).json({ message: "User not found" });
    res.json(result.rows[0]);
  } catch (e) {
    console.error("PUT /api/users/:id ERROR:", e.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.delete("/:id", requireAuth, requireRole(["Admin"]), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query("DELETE FROM public.users WHERE id=$1 RETURNING id", [id]);
    if (result.rows.length === 0) return res.status(404).json({ message: "User not found" });
    res.json({ message: "User deleted" });
  } catch (e) {
    console.error("DELETE /api/users/:id ERROR:", e.message);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;