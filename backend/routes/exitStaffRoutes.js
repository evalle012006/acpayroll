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
const getUserBranchId = (req) => req.user?.branch_id ?? null;

/* ============================================================
   GET ALL
============================================================ */
router.get("/exit-staff-orders", requireAuth, async (req, res) => {
  try {
    if (isAdmin(req)) {
      const r = await pool.query(`SELECT * FROM public.exit_staff_orders ORDER BY id DESC`);
      return res.json(r.rows);
    }

    if (isBranchManager(req)) {
      const bid = getUserBranchId(req);
      if (!bid) return res.json([]);
      const r = await pool.query(
        `SELECT * FROM public.exit_staff_orders WHERE branch_id=$1 ORDER BY id DESC`,
        [bid]
      );
      return res.json(r.rows);
    }

    return res.status(403).json({ message: "Access denied" });
  } catch (e) {
    console.error("GET exit staff ERROR:", e.message);
    return res.status(500).json({ message: "Server error" });
  }
});

/* ============================================================
   CREATE
============================================================ */
router.post(
  "/exit-staff-orders",
  requireAuth,
  requireRole(["admin", "branch manager"]),
  async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const employee_id = toInt(req.body?.employee_id);
      const exit_type = clean(req.body?.exit_type);
      const date_created = toDate(req.body?.date_created) || toDate(new Date().toISOString());
      const effective_date = toDate(req.body?.effective_date);

      const settlement_date = toDate(req.body?.settlement_date);
      const settlement_branch_id = toInt(req.body?.settlement_branch_id);

      const remarks = clean(req.body?.remarks);

      if (!employee_id) return res.status(400).json({ message: "Employee required" });
      if (!exit_type) return res.status(400).json({ message: "Exit type required" });
      if (!date_created) return res.status(400).json({ message: "Date created required" });
      if (!effective_date) return res.status(400).json({ message: "Effective date required" });

      // Snapshot staff
      const s = await client.query(
        `SELECT id, fullname, first_name, last_name, middle_name, branch_id
         FROM public.staff WHERE id=$1`,
        [employee_id]
      );

      if (s.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Staff not found" });
      }

      const staff = s.rows[0];

      // previous branch snapshot (from staff)
      const prev_branch_id = staff.branch_id ? toInt(staff.branch_id) : null;
      let prev_branch_code = "";
      let prev_branch_name = "";

      if (prev_branch_id) {
        const b = await client.query(`SELECT code,name FROM public.branches WHERE id=$1`, [prev_branch_id]);
        if (b.rowCount > 0) {
          prev_branch_code = clean(b.rows[0].code);
          prev_branch_name = clean(b.rows[0].name);
        }
      }

      // settlement branch snapshot (optional)
      let settlement_branch_code = "";
      let settlement_branch_name = "";
      if (settlement_branch_id) {
        const sb = await client.query(`SELECT code,name FROM public.branches WHERE id=$1`, [settlement_branch_id]);
        if (sb.rowCount === 0) {
          await client.query("ROLLBACK");
          return res.status(404).json({ message: "Settlement branch not found" });
        }
        settlement_branch_code = clean(sb.rows[0].code);
        settlement_branch_name = clean(sb.rows[0].name);
      }

      const employee_name = clean(req.body?.employee_name) || clean(staff.fullname);

      // generate order no using sequence id
      const seq = await client.query(`SELECT nextval('public.exit_staff_orders_id_seq') AS n`);
      const n = Number(seq.rows[0].n);
      const order_no = `EXIT-${String(n).padStart(8, "0")}`;

      const ins = await client.query(
        `
        INSERT INTO public.exit_staff_orders
        (
          id, order_no,
          employee_id, employee_name,
          last_name, first_name, middle_name,

          branch_id, branch_code, branch_name,               -- previous branch snapshot

          exit_type, date_created, effective_date,

          settlement_date,
          settlement_branch_id, settlement_branch_code, settlement_branch_name,

          remarks,
          status, created_by
        )
        VALUES
        (
          $1,$2,
          $3,$4,
          $5,$6,$7,

          $8,$9,$10,

          $11,$12::date,$13::date,

          $14::date,
          $15,$16,$17,

          $18,
          'Pending',$19
        )
        RETURNING *;
        `,
        [
          n,
          order_no,
          employee_id,
          employee_name,
          clean(staff.last_name),
          clean(staff.first_name),
          clean(staff.middle_name),

          prev_branch_id,
          prev_branch_code,
          prev_branch_name,

          exit_type,
          date_created,
          effective_date,

          settlement_date || null,
          settlement_branch_id || null,
          settlement_branch_code || null,
          settlement_branch_name || null,

          remarks || null,
          req.user?.id ?? null,
        ]
      );

      await client.query("COMMIT");
      return res.json(ins.rows[0]);
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("POST exit staff ERROR:", e.message);
      return res.status(500).json({ message: "Server error" });
    } finally {
      client.release();
    }
  }
);

/* ============================================================
   APPROVE (ADMIN ONLY)
   Set staff.status = 'Inactive'
============================================================ */
router.put(
  "/exit-staff-orders/:id/approve",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const id = toInt(req.params.id);
      if (!id) return res.status(400).json({ message: "Invalid id" });

      const r = await client.query(
        `
        UPDATE public.exit_staff_orders
        SET status='Approved',
            approved_by=$2,
            approved_at=NOW()
        WHERE id=$1 AND status='Pending'
        RETURNING *;
        `,
        [id, req.user?.id ?? null]
      );

      if (r.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Not found or not Pending" });
      }

      const order = r.rows[0];

      await client.query(`UPDATE public.staff SET status='Inactive' WHERE id=$1`, [order.employee_id]);

      await client.query("COMMIT");
      return res.json(order);
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("APPROVE exit staff ERROR:", e.message);
      return res.status(500).json({ message: "Server error" });
    } finally {
      client.release();
    }
  }
);

/* ============================================================
   REJECT (ADMIN ONLY)
============================================================ */
router.put(
  "/exit-staff-orders/:id/reject",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    try {
      const id = toInt(req.params.id);
      const reason = clean(req.body?.reason);

      if (!id) return res.status(400).json({ message: "Invalid id" });
      if (!reason) return res.status(400).json({ message: "Rejection reason required" });

      const r = await pool.query(
        `
        UPDATE public.exit_staff_orders
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
      console.error("REJECT exit staff ERROR:", e.message);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

/* ============================================================
   DELETE (ADMIN ONLY) - cannot delete Approved
============================================================ */
router.delete(
  "/exit-staff-orders/:id",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    try {
      const id = toInt(req.params.id);
      if (!id) return res.status(400).json({ message: "Invalid id" });

      const r = await pool.query(
        `DELETE FROM public.exit_staff_orders WHERE id=$1 AND status!='Approved' RETURNING id`,
        [id]
      );

      if (r.rowCount === 0) return res.status(400).json({ message: "Cannot delete Approved or not found" });

      return res.json({ message: "Deleted", id: r.rows[0].id });
    } catch (e) {
      console.error("DELETE exit staff ERROR:", e.message);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

module.exports = router;