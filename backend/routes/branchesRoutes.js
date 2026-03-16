const express = require("express");
const router = express.Router();
const pool = require("../db");
const { requireAuth, requireRole } = require("../middlewares/authMiddleware");

const toInt = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

const toNumOrNull = (v) => {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const toStr = (v) => String(v ?? "").trim();

const roleLower = (req) => String(req.user?.role || "").trim().toLowerCase();
const isAdmin = (req) => roleLower(req) === "admin";
const isBranchManager = (req) => roleLower(req) === "branch manager";
const getUserBranchCode = (req) => toStr(req.user?.branch_id);

router.get("/branches", requireAuth, async (req, res) => {
  try {
    if (isAdmin(req)) {
      const r = await pool.query(`
        SELECT id, code, name, area, address, latitude, longitude
        FROM public.branches
        ORDER BY id ASC
      `);
      return res.json(r.rows);
    }

    if (isBranchManager(req)) {
      const branchCode = getUserBranchCode(req);
      if (!branchCode) return res.json([]);

      const r = await pool.query(
        `
        SELECT id, code, name, area, address, latitude, longitude
        FROM public.branches
        WHERE LOWER(TRIM(code)) = LOWER(TRIM($1))
        ORDER BY id ASC
        `,
        [branchCode]
      );

      return res.json(r.rows);
    }

    return res.status(403).json({ message: "Access denied" });
  } catch (e) {
    console.error("GET /api/branches ERROR:", e.message);
    return res.status(500).json({ message: "Server error" });
  }
});

router.get("/branches/:id", requireAuth, async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid branch id" });

    if (isAdmin(req)) {
      const r = await pool.query(
        `
        SELECT id, code, name, area, address, latitude, longitude
        FROM public.branches
        WHERE id = $1
        `,
        [id]
      );

      if (r.rowCount === 0) return res.status(404).json({ message: "Branch not found" });
      return res.json(r.rows[0]);
    }

    if (isBranchManager(req)) {
      const branchCode = getUserBranchCode(req);
      if (!branchCode) return res.status(403).json({ message: "Access denied" });

      const r = await pool.query(
        `
        SELECT id, code, name, area, address, latitude, longitude
        FROM public.branches
        WHERE id = $1
          AND LOWER(TRIM(code)) = LOWER(TRIM($2))
        `,
        [id, branchCode]
      );

      if (r.rowCount === 0) return res.status(403).json({ message: "Access denied" });
      return res.json(r.rows[0]);
    }

    return res.status(403).json({ message: "Access denied" });
  } catch (e) {
    console.error("GET /api/branches/:id ERROR:", e.message);
    return res.status(500).json({ message: "Server error" });
  }
});

router.post(
  "/branches",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    try {
      const code = toStr(req.body?.code);
      const name = toStr(req.body?.name);
      const area = toStr(req.body?.area);
      const address = toStr(req.body?.address) || null;
      const latitude = toNumOrNull(req.body?.latitude);
      const longitude = toNumOrNull(req.body?.longitude);

      if (!code) return res.status(400).json({ message: "Branch code is required" });
      if (!name) return res.status(400).json({ message: "Branch name is required" });
      if (!area) return res.status(400).json({ message: "Area is required" });

      const dup = await pool.query(
        `
        SELECT id
        FROM public.branches
        WHERE LOWER(TRIM(code)) = LOWER(TRIM($1))
           OR LOWER(TRIM(name)) = LOWER(TRIM($2))
        LIMIT 1
        `,
        [code, name]
      );

      if (dup.rowCount > 0) {
        return res.status(409).json({ message: "Branch code or name already exists" });
      }

      const ins = await pool.query(
        `
        INSERT INTO public.branches (code, name, area, address, latitude, longitude)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, code, name, area, address, latitude, longitude
        `,
        [code, name, area, address, latitude, longitude]
      );

      return res.json(ins.rows[0]);
    } catch (e) {
      console.error("POST /api/branches ERROR:", e.message);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

router.put(
  "/branches/:id",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    try {
      const id = toInt(req.params.id);
      if (!id) return res.status(400).json({ message: "Invalid branch id" });

      const code = toStr(req.body?.code);
      const name = toStr(req.body?.name);
      const area = toStr(req.body?.area);
      const address = toStr(req.body?.address) || null;
      const latitude = toNumOrNull(req.body?.latitude);
      const longitude = toNumOrNull(req.body?.longitude);

      if (!code) return res.status(400).json({ message: "Branch code is required" });
      if (!name) return res.status(400).json({ message: "Branch name is required" });
      if (!area) return res.status(400).json({ message: "Area is required" });

      const dup = await pool.query(
        `
        SELECT id
        FROM public.branches
        WHERE (LOWER(TRIM(code)) = LOWER(TRIM($1)) OR LOWER(TRIM(name)) = LOWER(TRIM($2)))
          AND id <> $3
        LIMIT 1
        `,
        [code, name, id]
      );

      if (dup.rowCount > 0) {
        return res.status(409).json({ message: "Branch code or name already exists" });
      }

      const upd = await pool.query(
        `
        UPDATE public.branches
        SET code = $1,
            name = $2,
            area = $3,
            address = $4,
            latitude = $5,
            longitude = $6
        WHERE id = $7
        RETURNING id, code, name, area, address, latitude, longitude
        `,
        [code, name, area, address, latitude, longitude, id]
      );

      if (upd.rowCount === 0) return res.status(404).json({ message: "Branch not found" });

      return res.json(upd.rows[0]);
    } catch (e) {
      console.error("PUT /api/branches/:id ERROR:", e.message);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

router.delete(
  "/branches/:id",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    try {
      const id = toInt(req.params.id);
      if (!id) return res.status(400).json({ message: "Invalid branch id" });

      const used = await pool.query(
        `
        SELECT id
        FROM public.staff
        WHERE branch_id = $1
        LIMIT 1
        `,
        [id]
      );

      if (used.rowCount > 0) {
        return res.status(400).json({
          message: "Cannot delete branch because it is already assigned to staff",
        });
      }

      const del = await pool.query(
        `
        DELETE FROM public.branches
        WHERE id = $1
        RETURNING id
        `,
        [id]
      );

      if (del.rowCount === 0) return res.status(404).json({ message: "Branch not found" });

      return res.json({ message: "Branch deleted", id: del.rows[0].id });
    } catch (e) {
      console.error("DELETE /api/branches/:id ERROR:", e.message);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

module.exports = router;