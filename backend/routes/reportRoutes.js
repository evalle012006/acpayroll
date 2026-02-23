const express = require("express");
const router = express.Router();
const pool = require("../db");
const { requireAuth } = require("../middlewares/authMiddleware");

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const getUserBranchId = (req) => req.user?.branch_id ?? null;
const isAdmin = (req) => String(req.user?.role || "") === "Admin";
const isBranchManager = (req) => String(req.user?.role || "") === "Branch Manager";

router.get("/branches/:id", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid branch id" });

    if (isBranchManager(req)) {
      const bid = getUserBranchId(req);
      if (!bid || Number(bid) !== id) return res.status(403).json({ message: "Access denied" });
    } else if (!isAdmin(req)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const result = await pool.query(
      "SELECT id, code, name, area FROM public.branches WHERE id=$1",
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: "Branch not found" });

    res.json(result.rows[0]);
  } catch (e) {
    console.error("GET /api/branches/:id ERROR:", e.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/payroll/:branchId", requireAuth, async (req, res) => {
  try {
    const branchId = Number(req.params.branchId);
    if (!Number.isFinite(branchId)) return res.status(400).json({ message: "Invalid branch id" });

    if (isBranchManager(req)) {
      const bid = getUserBranchId(req);
      if (!bid || Number(bid) !== branchId) return res.status(403).json({ message: "Access denied" });
    } else if (!isAdmin(req)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const q = `
      SELECT
        s.id,
        s.employee_no,
        s.fullname,
        s."position" AS position,
        s.department,
        s.area,
        s.branch_id,
        s.regularization_date,

        COALESCE(s.salary, 0) AS salary,
        COALESCE(s.ecola, 0) AS ecola,

        -- allowances (for Salary screen)
        COALESCE(s.transportation, 0) AS transportation,

        -- balances / deductions (staff_balances)
        COALESCE(sb.cbu, 0) AS cbu,
        COALESCE(sb.cashbond, 0) AS cashbond,
        COALESCE(sb.salary_advance, 0) AS salary_advance,
        COALESCE(sb.motorcycle_loan, 0) AS motorcycle_loan,
        COALESCE(sb.special_advance, 0) AS special_advance,
        COALESCE(sb.cash_advance, 0) AS cash_advance,
        COALESCE(sb.other_receivable, 0) AS other_receivable,

        -- staff_accounts_payable sum of open balances
        COALESCE((
          SELECT SUM(COALESCE(sap.balance, 0))
          FROM public.staff_accounts_payable sap
          WHERE sap.employee_id = s.id
            AND COALESCE(sap.balance, 0) > 0
        ), 0) AS staff_accounts_payable,

        -- placeholders (you haven't implemented contributions/tax tables yet)
        0::numeric AS hdmf_er,
        0::numeric AS sss_er,
        0::numeric AS ph_er,
        0::numeric AS total_er,

        0::numeric AS hdmf_ee,
        0::numeric AS sss_ee,
        0::numeric AS ph_ee,
        0::numeric AS total_ee,

        0::numeric AS tax,
        0::numeric AS utility_charge,
        0::numeric AS pagibig_mpl,
        0::numeric AS sss_loan,

        NOW()::date AS payroll_date
      FROM public.staff s
      LEFT JOIN public.staff_balances sb ON sb.employee_id = s.id
      WHERE s.branch_id = $1
      ORDER BY s.fullname ASC
    `;

    const result = await pool.query(q, [branchId]);

    const rows = result.rows.map((r) => {
      const totalComp = toNum(r.salary) + toNum(r.ecola);
      const totalEE = toNum(r.total_ee);

      const totalDeduction =
        totalEE +
        toNum(r.tax) +
        toNum(r.utility_charge) +
        toNum(r.cbu) +
        toNum(r.cashbond) +
        toNum(r.salary_advance) +
        toNum(r.motorcycle_loan) +
        toNum(r.special_advance) +
        toNum(r.cash_advance) +
        toNum(r.other_receivable) +
        toNum(r.pagibig_mpl) +
        toNum(r.sss_loan) +
        toNum(r.staff_accounts_payable);

      const netPay = totalComp - totalDeduction;

      return {
        ...r,
        total_comp: totalComp,
        total_deduction: totalDeduction,
        net_pay: netPay,
      };
    });

    res.json(rows);
  } catch (e) {
    console.error("GET /api/payroll/:branchId ERROR:", e.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/staff/area/:area", requireAuth, async (req, res) => {
  try {
    const area = String(req.params.area || "");
    if (!area) return res.status(400).json({ message: "Area is required" });

    const params = [area];
    let where = `WHERE s.area = $1`;

    if (isBranchManager(req)) {
      const bid = getUserBranchId(req);
      if (!bid) return res.json([]);
      params.push(bid);
      where += ` AND s.branch_id = $2`;
    } else if (!isAdmin(req)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const q = `
      SELECT
        s.id,
        s.employee_no,
        s.fullname,
        s."position" AS position,
        s.department,
        s.area,
        s.branch_id,
        s.regularization_date,
        COALESCE(s.postage, 0) AS postage,
        COALESCE(s.transportation, 0) AS transportation,
        COALESCE(s.additional_target, 0) AS additional_target,
        COALESCE(s.repairing, 0) AS repairing,
        COALESCE(s.additional_monitoring, 0) AS additional_monitoring,
        COALESCE(s.motorcycle_loan, 0) AS motorcycle_loan,
        COALESCE(s.other_deduction, 0) AS other_deduction
      FROM public.staff s
      ${where}
      ORDER BY s.fullname ASC
    `;

    const result = await pool.query(q, params);
    res.json(result.rows);
  } catch (e) {
    console.error("GET /api/staff/area/:area ERROR:", e.message);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;