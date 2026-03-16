const express = require("express");
const router = express.Router();
const pool = require("../db");
const { requireAuth, requireRole } = require("../middlewares/authMiddleware");

const toInt = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

const clean = (v) => String(v ?? "").trim();

router.get("/departments", requireAuth, async (_req, res) => {
  try {
    const r = await pool.query(
      `SELECT id, code, name, description, created_at, updated_at
       FROM public.departments
       ORDER BY id ASC`
    );
    return res.json(r.rows);
  } catch (e) {
    console.error("GET /api/departments ERROR:", e.message);
    return res.status(500).json({ message: "Server error" });
  }
});

router.get(
  "/departments/:id/staff",
  requireAuth,
  requireRole(["admin", "branch manager"]),
  async (req, res) => {
    try {
      const id = toInt(req.params.id);
      if (!id) return res.status(400).json({ message: "Invalid department id" });

      const dep = await pool.query(
        `SELECT id, name FROM public.departments WHERE id=$1`,
        [id]
      );
      if (dep.rowCount === 0) return res.status(404).json({ message: "Department not found" });

      const depName = String(dep.rows[0].name || "").trim();

      const role = String(req.user?.role || "").trim().toLowerCase();
      const bid = req.user?.branch_id ?? null;

      if (role === "admin") {
        const r = await pool.query(
          `
          SELECT
            s.*,
            br.code AS branch_code,
            br.name AS branch_name
          FROM public.staff s
          LEFT JOIN public.branches br ON br.id = s.branch_id
          WHERE COALESCE(s.department,'') = $1
          ORDER BY s.fullname ASC
          `,
          [depName]
        );
        return res.json(r.rows);
      }

      if (role === "branch manager") {
        if (!bid) return res.json([]);
        const r = await pool.query(
          `
          SELECT
            s.*,
            br.code AS branch_code,
            br.name AS branch_name
          FROM public.staff s
          LEFT JOIN public.branches br ON br.id = s.branch_id
          WHERE COALESCE(s.department,'') = $1
            AND s.branch_id = $2
          ORDER BY s.fullname ASC
          `,
          [depName, bid]
        );
        return res.json(r.rows);
      }

      return res.status(403).json({ message: "Access denied" });
    } catch (e) {
      console.error("GET /api/departments/:id/staff ERROR:", e.message);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

router.post("/departments", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const code = clean(req.body?.code);
    const name = clean(req.body?.name);
    const description = clean(req.body?.description);

    if (!name) return res.status(400).json({ message: "name is required" });

    if (code) {
      const exists = await pool.query(
        `SELECT id FROM public.departments WHERE code = $1 LIMIT 1`,
        [code]
      );
      if (exists.rowCount > 0) {
        return res.status(409).json({ message: "Department code already exists" });
      }
    }

    const r = await pool.query(
      `INSERT INTO public.departments (code, name, description)
       VALUES ($1, $2, $3)
       RETURNING id, code, name, description, created_at, updated_at`,
      [code || null, name, description || null]
    );

    return res.json({ message: "Department created", department: r.rows[0] });
  } catch (e) {
    console.error("POST /api/departments ERROR:", e.message);
    return res.status(500).json({ message: "Server error" });
  }
});

router.put("/departments/:id", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid department id" });

    const code = clean(req.body?.code);
    const name = clean(req.body?.name);
    const description = clean(req.body?.description);

    if (!name) return res.status(400).json({ message: "name is required" });

    if (code) {
      const exists = await pool.query(
        `SELECT id FROM public.departments WHERE code=$1 AND id <> $2 LIMIT 1`,
        [code, id]
      );
      if (exists.rowCount > 0) {
        return res.status(409).json({ message: "Department code already exists" });
      }
    }

    const r = await pool.query(
      `UPDATE public.departments
       SET code=$1,
           name=$2,
           description=$3,
           updated_at=NOW()
       WHERE id=$4
       RETURNING id, code, name, description, created_at, updated_at`,
      [code || null, name, description || null, id]
    );

    if (r.rowCount === 0) return res.status(404).json({ message: "Department not found" });

    return res.json({ message: "Department updated", department: r.rows[0] });
  } catch (e) {
    console.error("PUT /api/departments/:id ERROR:", e.message);
    return res.status(500).json({ message: "Server error" });
  }
});

router.delete("/departments/:id", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid department id" });

    const r = await pool.query(
      `DELETE FROM public.departments WHERE id=$1 RETURNING id`,
      [id]
    );

    if (r.rowCount === 0) return res.status(404).json({ message: "Department not found" });

    return res.json({ message: "Department deleted" });
  } catch (e) {
    console.error("DELETE /api/departments/:id ERROR:", e.message);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;