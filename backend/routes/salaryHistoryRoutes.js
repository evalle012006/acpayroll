const express = require("express");
const router = express.Router();
const pool = require("../db");

const { requireAuth } = require("../middlewares/authMiddleware");
const { requirePermission } = require("../middlewares/permissionMiddleware");

const toStr = (v) => String(v ?? "").trim();

router.get(
  "/effective",
  requireAuth,
  requirePermission("salary_history", "view"),
  async (req, res) => {
    try {
      const branchId = Number(req.query.branchId);
      const month = toStr(req.query.month);

      if (!Number.isFinite(branchId)) {
        return res.status(400).json({ message: "branchId is required" });
      }

      if (!/^\d{4}-\d{2}$/.test(month)) {
        return res.status(400).json({ message: "month must be YYYY-MM" });
      }

      const result = await pool.query(
        `
        WITH month_cutoff AS (
          SELECT (to_date($2 || '-01', 'YYYY-MM-DD') + interval '1 month - 1 day')::date AS cutoff_date
        ),
        branch_staff AS (
          SELECT
            s.id AS staff_id,
            TRIM(COALESCE(s.employee_no, '')) AS employee_no,
            COALESCE(s.salary, 0) AS current_salary,
            COALESCE(s.ecola, 0) AS current_ecola
          FROM public.staff s
          WHERE s.branch_id = $1
            AND TRIM(COALESCE(s.employee_no, '')) <> ''
        ),
        latest_history AS (
          SELECT DISTINCT ON (TRIM(sh.employee_no))
            TRIM(sh.employee_no) AS employee_no,
            COALESCE(sh.salary, 0) AS salary,
            COALESCE(sh.ecola, 0) AS ecola,
            sh.effective_date,
            sh.created_at,
            sh.id
          FROM public.salary_history sh
          CROSS JOIN month_cutoff mc
          WHERE sh.effective_date <= mc.cutoff_date
          ORDER BY
            TRIM(sh.employee_no),
            sh.effective_date DESC,
            sh.created_at DESC,
            sh.id DESC
        )
        SELECT
          bs.staff_id,
          bs.employee_no,
          COALESCE(lh.salary, bs.current_salary, 0) AS salary,
          COALESCE(lh.ecola, bs.current_ecola, 0) AS ecola,
          lh.effective_date
        FROM branch_staff bs
        LEFT JOIN latest_history lh
          ON lh.employee_no = bs.employee_no
        ORDER BY bs.employee_no
        `,
        [branchId, month]
      );

      return res.json(result.rows);
    } catch (err) {
      console.error("GET /salary-history/effective ERROR:", err);
      return res.status(500).json({
        message: err.message || "Server error",
      });
    }
  }
);

router.get(
  "/:employee_no",
  requireAuth,
  requirePermission("salary_history", "view"),
  async (req, res) => {
    try {
      const employeeNo = String(req.params.employee_no || "").trim();

      if (!employeeNo) {
        return res.status(400).json({ message: "employee_no is required" });
      }

      const result = await pool.query(
        `
        SELECT
          id,
          employee_no,
          effective_date,
          salary,
          ecola,
          created_at
        FROM public.salary_history
        WHERE employee_no = $1
        ORDER BY effective_date ASC, created_at ASC, id ASC
        `,
        [employeeNo]
      );

      return res.json(result.rows);
    } catch (err) {
      console.error("GET /salary-history/:employee_no ERROR:", err);
      return res.status(500).json({
        message: err.message || "Server error",
      });
    }
  }
);

module.exports = router;