const express = require("express");
const router = express.Router();
const pool = require("../db");
const { requireAuth, requireRole } = require("../middlewares/authMiddleware");

const toNum = (v) => {
  const n = Number(v);
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

// GET /api/loan-requests
router.get("/loan-requests", requireAuth, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT *
       FROM public.loan_requests
       ORDER BY id DESC`
    );
    return res.json(r.rows);
  } catch (e) {
    console.error("GET /api/loan-requests ERROR:", e.message);
    return res.status(500).json({ message: "Server error" });
  }
});

// POST /api/loan-requests  (create)
router.post(
  "/loan-requests",
  requireAuth,
  requireRole(["admin", "branch manager"]),
  async (req, res) => {
    try {
      const employee_id = toInt(req.body?.employee_id);
      const staff_name = String(req.body?.staff_name || "").trim();

      const loan_type = String(req.body?.loan_type || "").trim();
      const reason = String(req.body?.reason || "").trim();

      const amount = toNum(req.body?.amount);
      const term = Math.max(1, toInt(req.body?.term) || 1);
      const interest = toNum(req.body?.interest);

      const total = toNum(req.body?.total) || amount + (amount * interest) / 100;
      const per_month = toNum(req.body?.per_month) || (term ? total / term : total);

      const status = String(req.body?.status || "Pending").trim() || "Pending";

      const approved_at = req.body?.approved_at ? toDate(req.body.approved_at) : null;
      const disbursement_date = req.body?.disbursement_date ? toDate(req.body.disbursement_date) : null;
      const entry_date = req.body?.entry_date ? toDate(req.body.entry_date) : null;

      if (!employee_id) return res.status(400).json({ message: "employee_id is required" });
      if (!staff_name) return res.status(400).json({ message: "staff_name is required" });
      if (!loan_type) return res.status(400).json({ message: "loan_type is required" });
      if (!amount) return res.status(400).json({ message: "amount is required" });
      if (!term) return res.status(400).json({ message: "term is required" });
      if (!reason) return res.status(400).json({ message: "reason is required" });

      // staff snapshot for name parts (optional but matches your DB columns)
      const s = await pool.query(
        `SELECT id, first_name, last_name, middle_name
         FROM public.staff
         WHERE id=$1`,
        [employee_id]
      );

      const first_name = s.rows[0]?.first_name ?? null;
      const last_name = s.rows[0]?.last_name ?? null;
      const middle_name = s.rows[0]?.middle_name ?? null;

      const ins = await pool.query(
        `
        INSERT INTO public.loan_requests
          (employee_id, staff_name, loan_type, reason, amount, term, interest, total, per_month,
           status, approved_at, disbursement_date, entry_date,
           first_name, last_name, middle_name)
        VALUES
          ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::date,$12::date,$13::date,$14,$15,$16)
        RETURNING *;
        `,
        [
          employee_id,
          staff_name,
          loan_type,
          reason,
          amount,
          term,
          interest,
          total,
          per_month,
          status,
          approved_at,
          disbursement_date,
          entry_date,
          first_name,
          last_name,
          middle_name,
        ]
      );

      return res.json(ins.rows[0]);
    } catch (e) {
      console.error("POST /api/loan-requests ERROR:", e.message);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

// PUT /api/loan-requests/:id  (update status only)
router.put("/loan-requests/:id", requireAuth, async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });

    const status = String(req.body?.status || "").trim();
    if (!status) return res.status(400).json({ message: "status is required" });

    // Only admin can approve/reject (recommended)
    const sLower = status.toLowerCase();
    if ((sLower === "approved" || sLower === "rejected") && !isAdmin(req)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const upd = await pool.query(
      `
      UPDATE public.loan_requests
      SET status=$1,
          approved_at = CASE WHEN $1='Approved' THEN NOW() ELSE approved_at END
      WHERE id=$2
      RETURNING *;
      `,
      [status, id]
    );

    if (upd.rowCount === 0) return res.status(404).json({ message: "Loan request not found" });
    return res.json(upd.rows[0]);
  } catch (e) {
    console.error("PUT /api/loan-requests/:id ERROR:", e.message);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;