const express = require("express");
const router = express.Router();
const pool = require("../db");
const { requireAuth, requireRole } = require("../middlewares/authMiddleware");

const toInt = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

const toDate = (v) => {
  const s = String(v ?? "").trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};

const clean = (v) => String(v ?? "").trim();

const roleLower = (req) => String(req.user?.role || "").trim().toLowerCase();
const isAdmin = (req) => roleLower(req) === "admin";
const isHr = (req) => roleLower(req) === "hr";
const isAccounting = (req) => roleLower(req) === "accounting";
const isBranchManager = (req) => roleLower(req) === "branch manager";
const getUserBranchId = (req) => req.user?.branch_id ?? null;

router.get("/suspension-orders", requireAuth, async (req, res) => {
  try {
    if (isAdmin(req) || isHr(req) || isAccounting(req)) {
      const r = await pool.query(
        `
        SELECT *
        FROM public.suspension_orders
        ORDER BY id DESC
        `
      );
      return res.json(r.rows);
    }

    if (isBranchManager(req)) {
      const bid = getUserBranchId(req);
      if (!bid) return res.json([]);

      const r = await pool.query(
        `
        SELECT so.*
        FROM public.suspension_orders so
        JOIN public.staff s ON s.id = so.employee_id
        WHERE s.branch_id = $1
        ORDER BY so.id DESC
        `,
        [bid]
      );
      return res.json(r.rows);
    }

    return res.status(403).json({ message: "Access denied" });
  } catch (e) {
    console.error("GET /api/suspension-orders ERROR:", e.message);
    return res.status(500).json({ message: "Server error" });
  }
});

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

      const start_date = toDate(req.body?.suspension_start ?? req.body?.start_date);
      const end_date = toDate(req.body?.suspension_end ?? req.body?.end_date);

      if (!employee_id) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Employee is required" });
      }
      if (!start_date) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Start date is required" });
      }
      if (!end_date) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "End date is required" });
      }
      if (!reason) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Reason is required" });
      }

      const s = await client.query(
        `
        SELECT id, fullname, first_name, last_name, middle_name, branch_id
        FROM public.staff
        WHERE id = $1
        `,
        [employee_id]
      );

      if (s.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Staff not found" });
      }

      const staff = s.rows[0];

      if (isBranchManager(req)) {
        const bid = getUserBranchId(req);
        if (!bid || Number(staff.branch_id) !== Number(bid)) {
          await client.query("ROLLBACK");
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const employee_name = clean(req.body?.employee_name) || clean(staff.fullname);

      const seq = await client.query(
        `SELECT nextval('public.suspension_orders_id_seq') AS n`
      );
      const n = Number(seq.rows?.[0]?.n || 0);
      const order_no = `SUS-${String(n).padStart(8, "0")}`;

      const ins = await client.query(
        `
        INSERT INTO public.suspension_orders
          (
            id,
            order_no,
            employee_id,
            employee_name,
            reason,
            start_date,
            end_date,
            details,
            status,
            created_by,
            last_name,
            first_name,
            middle_name
          )
        VALUES
          (
            $1, $2, $3, $4, $5, $6::date, $7::date, $8, 'Pending', $9, $10, $11, $12
          )
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
        SET
          status = 'Approved',
          approved_by = $2,
          approved_at = NOW(),
          rejected_by = NULL,
          rejected_at = NULL,
          rejection_reason = NULL
        WHERE id = $1 AND status = 'Pending'
        RETURNING *;
        `,
        [id, req.user?.id ?? null]
      );

      if (r.rowCount === 0) {
        return res.status(400).json({ message: "Not found or not Pending" });
      }

      return res.json(r.rows[0]);
    } catch (e) {
      console.error("PUT /api/suspension-orders/:id/approve ERROR:", e.message);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

router.put(
  "/suspension-orders/:id/reject",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    try {
      const id = toInt(req.params.id);
      if (!id) return res.status(400).json({ message: "Invalid id" });

      const reason = clean(req.body?.reason);
      if (!reason) {
        return res.status(400).json({ message: "Rejection reason is required" });
      }

      const r = await pool.query(
        `
        UPDATE public.suspension_orders
        SET
          status = 'Rejected',
          rejected_by = $2,
          rejected_at = NOW(),
          rejection_reason = $3,
          approved_by = NULL,
          approved_at = NULL
        WHERE id = $1 AND status = 'Pending'
        RETURNING *;
        `,
        [id, req.user?.id ?? null, reason]
      );

      if (r.rowCount === 0) {
        return res.status(400).json({ message: "Not found or not Pending" });
      }

      return res.json(r.rows[0]);
    } catch (e) {
      console.error("PUT /api/suspension-orders/:id/reject ERROR:", e.message);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

module.exports = router;