const express = require("express");
const router = express.Router();
const pool = require("../db");
const { requireAuth, requireRole } = require("../middlewares/authMiddleware");

const toNum = (v) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const toInt = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

const toDate = (v) => {
  const s = String(v ?? "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};

const roleLower = (req) => String(req.user?.role || "").trim().toLowerCase();
const isAdmin = (req) => roleLower(req) === "admin";

// GET /api/staff-accounts-payable
router.get("/staff-accounts-payable", requireAuth, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT *
       FROM public.staff_accounts_payable
       ORDER BY id DESC`
    );
    return res.json(r.rows);
  } catch (e) {
    console.error("GET /api/staff-accounts-payable ERROR:", e.message);
    return res.status(500).json({ message: "Server error" });
  }
});

// POST /api/staff-accounts-payable  (create)
router.post(
  "/staff-accounts-payable",
  requireAuth,
  requireRole(["admin", "branch manager"]),
  async (req, res) => {
    try {
      const employee_id = toInt(req.body?.employee_id);
      const staff_name = String(req.body?.staff_name || "").trim();
      const description = String(req.body?.description || "").trim();

      const amount = toNum(req.body?.amount);
      const term = Math.max(1, toInt(req.body?.term) || 1);
      const per_month = toNum(req.body?.per_month) || (term ? amount / term : amount);
      const balance =
        req.body?.balance === "" || req.body?.balance == null ? amount : toNum(req.body?.balance);

      const entry_date = req.body?.entry_date ? toDate(req.body.entry_date) : null;

      if (!employee_id) return res.status(400).json({ message: "employee_id is required" });
      if (!staff_name) return res.status(400).json({ message: "staff_name is required" });
      if (!description) return res.status(400).json({ message: "description is required" });
      if (!amount) return res.status(400).json({ message: "amount is required" });
      if (!term) return res.status(400).json({ message: "term is required" });

      // Optional: snapshot name parts from staff table
      const s = await pool.query(
        `SELECT first_name, last_name, middle_name
         FROM public.staff
         WHERE id=$1`,
        [employee_id]
      );

      const first_name = s.rows[0]?.first_name ?? null;
      const last_name = s.rows[0]?.last_name ?? null;
      const middle_name = s.rows[0]?.middle_name ?? null;

      const ins = await pool.query(
        `
        INSERT INTO public.staff_accounts_payable
          (employee_id, staff_name, description, amount, term, per_month, entry_date, balance,
           status, created_by, first_name, last_name, middle_name)
        VALUES
          ($1,$2,$3,$4,$5,$6,$7::date,$8,'Pending',$9,$10,$11,$12)
        RETURNING *;
        `,
        [
          employee_id,
          staff_name,
          description,
          amount,
          term,
          per_month,
          entry_date,
          balance,
          req.user?.id ?? null,
          first_name,
          last_name,
          middle_name,
        ]
      );

      return res.json(ins.rows[0]);
    } catch (e) {
      console.error("POST /api/staff-accounts-payable ERROR:", e.message);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

// PUT /api/staff-accounts-payable/:id  (approve/reject)
router.put("/staff-accounts-payable/:id", requireAuth, async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });

    const status = String(req.body?.status || "").trim();
    const reason = String(req.body?.reason || "").trim();

    if (!status) return res.status(400).json({ message: "status is required" });

    // Admin only for approve/reject
    const sLower = status.toLowerCase();
    if ((sLower === "approved" || sLower === "rejected") && !isAdmin(req)) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (sLower === "rejected" && !reason) {
      return res.status(400).json({ message: "reason is required for rejection" });
    }

    const upd = await pool.query(
      `
      UPDATE public.staff_accounts_payable
      SET status=$1,
          approved_by = CASE WHEN $1='Approved' THEN $2 ELSE approved_by END,
          approved_at = CASE WHEN $1='Approved' THEN NOW() ELSE approved_at END,
          rejected_by = CASE WHEN $1='Rejected' THEN $2 ELSE rejected_by END,
          rejected_at = CASE WHEN $1='Rejected' THEN NOW() ELSE rejected_at END,
          rejection_reason = CASE WHEN $1='Rejected' THEN $3 ELSE rejection_reason END
      WHERE id=$4
      RETURNING *;
      `,
      [status, req.user?.id ?? null, reason || null, id]
    );

    if (upd.rowCount === 0) return res.status(404).json({ message: "SAP record not found" });
    return res.json(upd.rows[0]);
  } catch (e) {
    console.error("PUT /api/staff-accounts-payable/:id ERROR:", e.message);
    return res.status(500).json({ message: "Server error" });
  }
});

// DELETE /api/staff-accounts-payable/:id  (admin only)
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

      if (r.rowCount === 0) return res.status(404).json({ message: "SAP record not found" });
      return res.json({ message: "Deleted", id: r.rows[0].id });
    } catch (e) {
      console.error("DELETE /api/staff-accounts-payable/:id ERROR:", e.message);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

module.exports = router;