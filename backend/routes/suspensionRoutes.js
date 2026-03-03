const express = require("express");
const router = express.Router();
const pool = require("../db");
const { requireAuth, requireRole } = require("../middlewares/authMiddleware");

const toInt = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

const toDate = (v) => {
  const s = String(v ?? "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};

const clean = (v) => String(v ?? "").trim();

const roleLower = (req) => String(req.user?.role || "").trim().toLowerCase();
const isAdmin = (req) => roleLower(req) === "admin";
const isBranchManager = (req) => roleLower(req) === "branch manager";

/**
 * GET /api/suspension-orders
 * Admin: all
 * Branch manager: (optional) still all for now (no branch_id column on suspension_orders)
 */
router.get("/suspension-orders", requireAuth, async (req, res) => {
  try {
    const role = roleLower(req);
    if (role !== "admin" && role !== "branch manager") {
      return res.status(403).json({ message: "Access denied" });
    }

    const r = await pool.query(
      `SELECT *
       FROM public.suspension_orders
       ORDER BY id DESC`
    );
    return res.json(r.rows);
  } catch (e) {
    console.error("GET /api/suspension-orders ERROR:", e.message);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * POST /api/suspension-orders
 * Roles: admin, branch manager
 * Body: employee_id, employee_name, suspension_start OR start_date, suspension_end OR end_date, reason, details?
 */
router.post(
  "/suspension-orders",
  requireAuth,
  requireRole(["admin", "branch manager"]),
  async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const employee_id = toInt(req.body?.employee_id);
      const reason = clean(req.body?.reason);
      const details = clean(req.body?.details);

      // Accept either naming from your current frontend OR DB column names
      const start_date = toDate(req.body?.suspension_start ?? req.body?.start_date);
      const end_date = toDate(req.body?.suspension_end ?? req.body?.end_date);

      if (!employee_id) return res.status(400).json({ message: "Employee is required" });
      if (!start_date) return res.status(400).json({ message: "Start date is required" });
      if (!end_date) return res.status(400).json({ message: "End date is required" });
      if (!reason) return res.status(400).json({ message: "Reason is required" });

      // Snapshot staff info (name parts)
      const s = await client.query(
        `SELECT id, fullname, first_name, last_name, middle_name
         FROM public.staff
         WHERE id = $1`,
        [employee_id]
      );

      if (s.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Staff not found" });
      }

      const staff = s.rows[0];
      const employee_name = clean(req.body?.employee_name) || clean(staff.fullname);

      // Generate a simple order_no like "SUS-00000123"
      // If you already have a better format, replace this block
      const seq = await client.query(`SELECT nextval('public.suspension_orders_id_seq') AS n`);
      const n = Number(seq.rows?.[0]?.n || 0);
      const order_no = `SUS-${String(n).padStart(8, "0")}`;

      // Insert using explicit id (so order_no matches the same "n")
      const ins = await client.query(
        `
        INSERT INTO public.suspension_orders
          (id, order_no, employee_id, employee_name, reason, start_date, end_date, details, status, created_by,
           last_name, first_name, middle_name)
        VALUES
          ($1, $2, $3, $4, $5, $6::date, $7::date, $8, 'Pending', $9, $10, $11, $12)
        RETURNING *;
        `,
        [
          n,
          order_no,
          employee_id,
          employee_name,
          reason,
          start_date,
          end_date,
          details || null,
          req.user?.id ?? null,
          clean(staff.last_name),
          clean(staff.first_name),
          clean(staff.middle_name),
        ]
      );

      await client.query("COMMIT");
      return res.json(ins.rows[0]);
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("POST /api/suspension-orders ERROR:", e.message);
      return res.status(500).json({ message: "Server error" });
    } finally {
      client.release();
    }
  }
);

/**
 * PUT /api/suspension-orders/:id/approve
 * Admin only
 */
router.put(
  "/suspension-orders/:id/approve",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    try {
      const id = toInt(req.params.id);
      if (!id) return res.status(400).json({ message: "Invalid id" });

      const r = await pool.query(
        `
        UPDATE public.suspension_orders
        SET status='Approved',
            approved_by=$2,
            approved_at=NOW()
        WHERE id=$1 AND status='Pending'
        RETURNING *;
        `,
        [id, req.user?.id ?? null]
      );

      if (r.rowCount === 0) return res.status(400).json({ message: "Not found or not Pending" });
      return res.json(r.rows[0]);
    } catch (e) {
      console.error("PUT /api/suspension-orders/:id/approve ERROR:", e.message);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

/**
 * PUT /api/suspension-orders/:id/reject
 * Admin only
 * Body: { reason }
 */
router.put(
  "/suspension-orders/:id/reject",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    try {
      const id = toInt(req.params.id);
      if (!id) return res.status(400).json({ message: "Invalid id" });

      const reason = clean(req.body?.reason);
      if (!reason) return res.status(400).json({ message: "Rejection reason is required" });

      const r = await pool.query(
        `
        UPDATE public.suspension_orders
        SET status='Rejected',
            rejected_by=$2,
            rejected_at=NOW(),
            rejection_reason=$3
        WHERE id=$1 AND status='Pending'
        RETURNING *;
        `,
        [id, req.user?.id ?? null, reason]
      );

      if (r.rowCount === 0) return res.status(400).json({ message: "Not found or not Pending" });
      return res.json(r.rows[0]);
    } catch (e) {
      console.error("PUT /api/suspension-orders/:id/reject ERROR:", e.message);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

module.exports = router;