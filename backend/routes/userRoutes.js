const express = require("express");
const router = express.Router();
const pool = require("../db");
const { requireAuth } = require("../middlewares/authMiddleware");
const { requirePermission } = require("../middlewares/permissionMiddleware");
const bcrypt = require("bcryptjs");

const clean = (v) => String(v ?? "").trim();

const USER_RETURN_FIELDS = `
  id,
  username,
  role,
  created_at,
  branch_id,
  area,
  region,
  division,
  first_name,
  middle_name,
  last_name,
  department
`;

router.get(
  "/",
  requireAuth,
  requirePermission("users", "view"),
  async (_req, res) => {
    try {
      const result = await pool.query(
        `
        SELECT ${USER_RETURN_FIELDS}
        FROM public.users
        ORDER BY id DESC
        `
      );

      return res.json(result.rows);
    } catch (e) {
      console.error("GET /api/users ERROR:", e.message);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

router.post(
  "/",
  requireAuth,
  requirePermission("users", "create"),
  async (req, res) => {
    try {
      const username = clean(req.body?.username);
      const password = clean(req.body?.password);
      const role = clean(req.body?.role).toLowerCase();

      const branch_id = req.body?.branch_id ?? null;
      const area = clean(req.body?.area) || null;
      const region = clean(req.body?.region) || null;
      const division = clean(req.body?.division) || null;

      const first_name = clean(req.body?.first_name) || null;
      const middle_name = clean(req.body?.middle_name) || null;
      const last_name = clean(req.body?.last_name) || null;
      const department = clean(req.body?.department) || null;

      if (!username || !password || !role) {
        return res.status(400).json({
          message: "username, password, role are required",
        });
      }

      const exists = await pool.query(
        `
        SELECT id
        FROM public.users
        WHERE lower(trim(username)) = lower(trim($1))
        LIMIT 1
        `,
        [username]
      );

      if (exists.rows.length > 0) {
        return res.status(409).json({ message: "Username already exists" });
      }

      const hashed = await bcrypt.hash(password, 10);

      const result = await pool.query(
        `
        INSERT INTO public.users (
          username,
          password,
          role,
          branch_id,
          area,
          region,
          division,
          first_name,
          middle_name,
          last_name,
          department,
          created_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())
        RETURNING ${USER_RETURN_FIELDS}
        `,
        [
          username,
          hashed,
          role,
          branch_id,
          area,
          region,
          division,
          first_name,
          middle_name,
          last_name,
          department,
        ]
      );

      return res.json({
        message: "User created",
        user: result.rows[0],
      });
    } catch (e) {
      console.error("POST /api/users ERROR:", e.message);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

router.put(
  "/:id",
  requireAuth,
  requirePermission("users", "edit"),
  async (req, res) => {
    try {
      const id = Number(req.params.id);

      if (!Number.isFinite(id) || id <= 0) {
        return res.status(400).json({ message: "Invalid user id" });
      }

      const username = clean(req.body?.username);
      const role = clean(req.body?.role).toLowerCase();

      const branch_id = req.body?.branch_id ?? null;
      const area = clean(req.body?.area) || null;
      const region = clean(req.body?.region) || null;
      const division = clean(req.body?.division) || null;

      const first_name = clean(req.body?.first_name) || null;
      const middle_name = clean(req.body?.middle_name) || null;
      const last_name = clean(req.body?.last_name) || null;
      const department = clean(req.body?.department) || null;

      if (!username || !role) {
        return res.status(400).json({
          message: "username and role are required",
        });
      }

      const existing = await pool.query(
        `
        SELECT id
        FROM public.users
        WHERE lower(trim(username)) = lower(trim($1))
          AND id <> $2
        LIMIT 1
        `,
        [username, id]
      );

      if (existing.rows.length > 0) {
        return res.status(409).json({ message: "Username already exists" });
      }

      let hashed = null;
      const password = clean(req.body?.password);

      if (password) {
        hashed = await bcrypt.hash(password, 10);
      }

      const result = await pool.query(
        `
        UPDATE public.users
        SET
          username = $1,
          role = $2,
          branch_id = $3,
          area = $4,
          region = $5,
          division = $6,
          first_name = $7,
          middle_name = $8,
          last_name = $9,
          department = $10,
          password = COALESCE($11, password),
          updated_at = NOW()
        WHERE id = $12
        RETURNING ${USER_RETURN_FIELDS}
        `,
        [
          username,
          role,
          branch_id,
          area,
          region,
          division,
          first_name,
          middle_name,
          last_name,
          department,
          hashed,
          id,
        ]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ message: "User not found" });
      }

      return res.json({
        message: "User updated",
        user: result.rows[0],
      });
    } catch (e) {
      console.error("PUT /api/users/:id ERROR:", e.message);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

router.put(
  "/:id/reset-password",
  requireAuth,
  requirePermission("users", "edit"),
  async (req, res) => {
    try {
      const id = Number(req.params.id);

      if (!Number.isFinite(id) || id <= 0) {
        return res.status(400).json({ message: "Invalid user id" });
      }

      const new_password = clean(req.body?.new_password);

      if (!new_password || new_password.length < 6) {
        return res.status(400).json({
          message: "new_password is required (min 6 chars)",
        });
      }

      const hashed = await bcrypt.hash(new_password, 10);

      const result = await pool.query(
        `
        UPDATE public.users
        SET
          password = $1,
          updated_at = NOW()
        WHERE id = $2
        RETURNING ${USER_RETURN_FIELDS}
        `,
        [hashed, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ message: "User not found" });
      }

      return res.json({
        message: "Password reset",
        user: result.rows[0],
      });
    } catch (e) {
      console.error("PUT /api/users/:id/reset-password ERROR:", e.message);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

router.delete(
  "/:id",
  requireAuth,
  requirePermission("users", "delete"),
  async (req, res) => {
    try {
      const id = Number(req.params.id);

      if (!Number.isFinite(id) || id <= 0) {
        return res.status(400).json({ message: "Invalid user id" });
      }

      const result = await pool.query(
        `
        DELETE FROM public.users
        WHERE id = $1
        RETURNING id
        `,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ message: "User not found" });
      }

      return res.json({ message: "User deleted" });
    } catch (e) {
      console.error("DELETE /api/users/:id ERROR:", e.message);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

module.exports = router;