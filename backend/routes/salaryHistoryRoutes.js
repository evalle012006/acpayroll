const express = require("express");
const router = express.Router();
const pool = require("../db");

const { requireAuth } = require("../middlewares/authMiddleware");
const { requirePermission } = require("../middlewares/permissionMiddleware");

const toStr = (v) => String(v ?? "").trim();

// ============================================================
// CREATE MISSING SALARY HISTORY BASELINES
// ============================================================

router.post(
  "/initialize",
  requireAuth,
  requirePermission("salary_history", "view"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const result = await client.query(
        `
        INSERT INTO public.salary_history
          (
            employee_no,
            effective_date,
            salary,
            ecola
          )
        SELECT
          TRIM(s.employee_no),
          COALESCE(
            s.start_date,
            s.regularization_date,
            CURRENT_DATE
          )::date,
          COALESCE(s.salary, 0),
          COALESCE(s.ecola, 0)
        FROM public.staff s
        WHERE TRIM(COALESCE(s.employee_no, '')) <> ''

          AND NOT EXISTS (
            SELECT 1
            FROM public.salary_history sh
            WHERE TRIM(sh.employee_no) =
                  TRIM(s.employee_no)
          )
        RETURNING
          id,
          employee_no,
          effective_date,
          salary,
          ecola
        `
      );

      await client.query("COMMIT");

      return res.json({
        message: "Salary history baseline initialized.",
        inserted: result.rowCount,
        rows: result.rows,
      });
    } catch (err) {
      await client.query("ROLLBACK");

      console.error(
        "POST /salary-history/initialize ERROR:",
        err
      );

      return res.status(500).json({
        message:
          err.message ||
          "Failed to initialize salary history.",
      });
    } finally {
      client.release();
    }
  }
);

router.get(
  "/effective",
  requireAuth,
  requirePermission("salary_history", "view"),
  async (req, res) => {
    try {
      const branchRaw = toStr(req.query.branchId);
      const branchId =
        branchRaw && branchRaw.toLowerCase() !== "all"
          ? Number(branchRaw)
          : null;

      const month = toStr(req.query.month);

      if (
        branchId !== null &&
        (!Number.isFinite(branchId) || branchId <= 0)
      ) {
        return res.status(400).json({
          message: "branchId must be a valid branch ID or All",
        });
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
            TRIM(COALESCE(s.employee_no, '')) AS employee_no
          FROM public.staff s
          WHERE
            ($1::int IS NULL OR s.branch_id = $1::int)
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

          CASE
            WHEN lh.id IS NOT NULL
              THEN lh.salary
            ELSE NULL
          END AS salary,

          CASE
            WHEN lh.id IS NOT NULL
              THEN lh.ecola
            ELSE NULL
          END AS ecola,

          lh.effective_date,

          CASE
            WHEN lh.id IS NOT NULL
              THEN TRUE
            ELSE FALSE
          END AS has_history

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