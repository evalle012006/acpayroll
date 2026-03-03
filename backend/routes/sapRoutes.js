const express = require("express");
const router = express.Router();
const pool = require("../db");
const { requireAuth, requireRole } = require("../middlewares/authMiddleware");

const toInt = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

const toNum = (v) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const roleLower = (req) => String(req.user?.role || "").trim().toLowerCase();
const isAdmin = (req) => roleLower(req) === "admin";
const isBranchManager = (req) => roleLower(req) === "branch manager";
const getUserBranchId = (req) => req.user?.branch_id ?? null;

router.get("/staff-accounts-payable", requireAuth, async (req, res) => {
  try {
    if (isAdmin(req)) {
      const r = await pool.query(
        `SELECT *
         FROM public.staff_accounts_payable
         ORDER BY id DESC`
      );
      return res.json(r.rows);
    }

    if (isBranchManager(req)) {
      const bid = getUserBranchId(req);
      if (!bid) return res.json([]);

      const r = await pool.query(
        `
        SELECT sap.*
        FROM public.staff_accounts_payable sap
        JOIN public.staff s ON s.id = sap.employee_id
        WHERE s.branch_id = $1
        ORDER BY sap.id DESC
        `,
        [bid]
      );

      return res.json(r.rows);
    }

    return res.status(403).json({ message: "Access denied" });
  } catch (e) {
    console.error("GET /api/staff-accounts-payable ERROR:", e.message);
    return res.status(500).json({ message: "Server error" });
  }
});

router.post(
  "/staff-accounts-payable",
  requireAuth,
  requireRole(["admin", "branch manager"]),
  async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const b = req.body || {};
      const employee_id = toInt(b.employee_id);
      const staff_name = String(b.staff_name || "").trim();
      const description = String(b.description || "").trim();
      const amount = toNum(b.amount);
      const term = Math.max(1, toInt(b.term) || 1);
      const per_month = toNum(b.per_month) || (term > 0 ? amount / term : 0);
      const balance = toNum(b.balance) || amount;

      if (!employee_id) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Employee is required" });
      }
      if (!staff_name) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Staff name is required" });
      }
      if (!description) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Description is required" });
      }
      if (amount <= 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Amount must be greater than 0" });
      }

      // Branch manager guard: employee must be in their branch
      if (isBranchManager(req)) {
        const bid = getUserBranchId(req);
        const chk = await client.query(
          `SELECT id FROM public.staff WHERE id=$1 AND branch_id=$2`,
          [employee_id, bid]
        );
        if (chk.rowCount === 0) {
          await client.query("ROLLBACK");
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const ins = await client.query(
        `
        INSERT INTO public.staff_accounts_payable
          (employee_id, staff_name, description, amount, term, per_month, entry_date, balance, status, created_by)
        VALUES
          ($1,$2,$3,$4,$5,$6, CURRENT_DATE, $7, 'Pending', $8)
        RETURNING *;
        `,
        [
          employee_id,
          staff_name,
          description,
          amount,
          term,
          per_month,
          balance,
          req.user?.id ?? null,
        ]
      );

      await client.query("COMMIT");
      return res.json(ins.rows[0]);
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("POST /api/staff-accounts-payable ERROR:", e.message);
      return res.status(500).json({ message: "Server error" });
    } finally {
      client.release();
    }
  }
);

router.put(
  "/staff-accounts-payable/:id",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    try {
      const id = toInt(req.params.id);
      if (!id) return res.status(400).json({ message: "Invalid id" });

      const status = String(req.body?.status || "").trim();
      const reason = String(req.body?.reason || "").trim();

      if (!["Approved", "Rejected"].includes(status)) {
        return res.status(400).json({ message: "Status must be Approved or Rejected" });
      }

      if (status === "Rejected" && !reason) {
        return res.status(400).json({ message: "Rejection reason is required" });
      }

      const q =
        status === "Approved"
          ? `
            UPDATE public.staff_accounts_payable
            SET
              status='Approved',
              approved_by=$2,
              approved_at=COALESCE(approved_at, NOW()),
              rejected_by=NULL,
              rejected_at=NULL,
              rejection_reason=NULL
            WHERE id=$1 AND status='Pending'
            RETURNING *;
          `
          : `
            UPDATE public.staff_accounts_payable
            SET
              status='Rejected',
              rejected_by=$2,
              rejected_at=COALESCE(rejected_at, NOW()),
              rejection_reason=$3,
              approved_by=NULL,
              approved_at=NULL
            WHERE id=$1 AND status='Pending'
            RETURNING *;
          `;

      const params = status === "Approved"
        ? [id, req.user?.id ?? null]
        : [id, req.user?.id ?? null, reason];

      const r = await pool.query(q, params);

      if (r.rowCount === 0) return res.status(400).json({ message: "Record not found or not Pending" });
      return res.json(r.rows[0]);
    } catch (e) {
      console.error("PUT /api/staff-accounts-payable/:id ERROR:", e.message);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

router.delete(
  "/staff-accounts-payable/:id",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    try {
      const id = toInt(req.params.id);
      if (!id) return res.status(400).json({ message: "Invalid id" });

      const r = await pool.query(
        `DELETE FROM public.staff_accounts_payable WHERE id=$1 RETURNING id`,
        [id]
      );

      if (r.rowCount === 0) return res.status(404).json({ message: "Not found" });
      return res.json({ message: "Deleted" });
    } catch (e) {
      console.error("DELETE /api/staff-accounts-payable/:id ERROR:", e.message);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

module.exports = router;