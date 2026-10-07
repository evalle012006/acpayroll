const express = require("express");
const router = express.Router();
const pool = require("../db");

const { requireAuth } = require("../middlewares/authMiddleware");

/* =========================================================
   HELPERS
========================================================= */

const toInt = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

const toNum = (v) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const validYear = (v) => {
  const year = toInt(v);

  if (!year || year < 2000 || year > 2100) {
    return null;
  }

  return year;
};

const toDateOnlyUtc = (value) => {
  if (!value) return null;

  if (
    value instanceof Date &&
    !Number.isNaN(value.getTime())
  ) {
    return value
      .toISOString()
      .slice(0, 10);
  }

  const match = String(value).match(
    /^(\d{4})-(\d{2})-(\d{2})/
  );

  return match
    ? `${match[1]}-${match[2]}-${match[3]}`
    : null;
};

/* =========================================================
   GET BONUS COMPUTATION EMPLOYEE LIST
   GET /api/bonus-computations?year=2026

   Returns:
   - Employee information
   - Salary
   - ECOLA
   - Total Gross
   - Yearly 13th Month total
   - Yearly 14th Month total
   - Yearly 15th Month total
========================================================= */

router.get("/", requireAuth, async (req, res) => {
  try {
    const year = validYear(req.query?.year);

    if (!year) {
      return res.status(400).json({
        message: "Valid year is required.",
      });
    }

    const result = await pool.query(
      `
      SELECT
        s.id AS staff_id,
        s.employee_no,
        s.fullname,
        s.position,
        s.department,
        s.branch_id,
        b.code AS branch_code,
        b.name AS branch_name,
        s.start_date,
        s.regularization_date,

        COALESCE(s.salary, 0)::numeric AS salary,
        COALESCE(s.ecola, 0)::numeric AS ecola,

        (
          COALESCE(s.salary, 0) +
          COALESCE(s.ecola, 0)
        )::numeric AS total_gross,

        COALESCE(
          SUM(bc.total_compensation)
            FILTER (
              WHERE bc.computation_year = $1
            ),
          0
        )::numeric AS total_compensation,

        COALESCE(
          SUM(bc.deductions)
            FILTER (
              WHERE bc.computation_year = $1
            ),
          0
        )::numeric AS deductions,

        COALESCE(
          SUM(bc.month_13)
            FILTER (
              WHERE bc.computation_year = $1
            ),
          0
        )::numeric AS month_13,

        COALESCE(
          SUM(bc.month_14)
            FILTER (
              WHERE bc.computation_year = $1
            ),
          0
        )::numeric AS month_14,

        COALESCE(
          SUM(bc.month_15)
            FILTER (
              WHERE bc.computation_year = $1
            ),
          0
        )::numeric AS month_15

      FROM public.staff s

      LEFT JOIN public.branches b
        ON b.id = s.branch_id

      LEFT JOIN public.bonus_computations bc
        ON bc.staff_id = s.id
       AND bc.computation_year = $1

      GROUP BY
        s.id,
        s.employee_no,
        s.fullname,
        s.position,
        s.department,
        s.branch_id,
        b.code,
        b.name,
        s.start_date,
        s.regularization_date,
        s.salary,
        s.ecola

      ORDER BY
        s.department ASC NULLS LAST,
        s.fullname ASC NULLS LAST;
      `,
      [year]
    );

    return res.json({
      year,
      rows: result.rows,
    });
  } catch (err) {
    console.error(
      "GET /bonus-computations ERROR:",
      err?.message
    );

    return res.status(500).json({
      message:
        err?.message ||
        "Failed to load bonus computations.",
    });
  }
});

/* =========================================================
   GET ONE EMPLOYEE MONTHLY BONUS
   GET /api/bonus-computations/staff/:staffId?year=2026

   Always returns January - December.
========================================================= */

router.get(
  "/staff/:staffId",
  requireAuth,
  async (req, res) => {
    try {
      const staffId = toInt(req.params.staffId);
      const year = validYear(req.query?.year);

      if (!staffId) {
        return res.status(400).json({
          message: "Invalid staff id.",
        });
      }

      if (!year) {
        return res.status(400).json({
          message: "Valid year is required.",
        });
      }

      const staffResult = await pool.query(
        `
        SELECT
          s.id AS staff_id,
          s.employee_no,
          s.fullname,
          s.position,
          s.department,
          s.branch_id,
          b.code AS branch_code,
          b.name AS branch_name,
          s.start_date,
          s.regularization_date,

          COALESCE(s.salary, 0)::numeric AS salary,
          COALESCE(s.ecola, 0)::numeric AS ecola,

          (
            COALESCE(s.salary, 0) +
            COALESCE(s.ecola, 0)
          )::numeric AS total_gross

        FROM public.staff s

        LEFT JOIN public.branches b
          ON b.id = s.branch_id

        WHERE s.id = $1
        LIMIT 1;
        `,
        [staffId]
      );

      if (staffResult.rowCount === 0) {
        return res.status(404).json({
          message: "Staff not found.",
        });
      }

      const monthlyResult = await pool.query(
        `
        SELECT
          computation_month,
          total_compensation,
          deductions,
          month_13,
          month_14,
          month_15
        FROM public.bonus_computations
        WHERE staff_id = $1
          AND computation_year = $2
        ORDER BY computation_month ASC;
        `,
        [staffId, year]
      );

      const savedByMonth = new Map(
        monthlyResult.rows.map((row) => [
          Number(row.computation_month),
          row,
        ])
      );

      const months = [];

      for (let month = 1; month <= 12; month += 1) {
        const saved = savedByMonth.get(month);

        months.push({
          month,
          total_compensation: toNum(
            saved?.total_compensation
          ),
          deductions: toNum(saved?.deductions),
          month_13: toNum(saved?.month_13),
          month_14: toNum(saved?.month_14),
          month_15: toNum(saved?.month_15),
        });
      }

      return res.json({
        year,
        staff: staffResult.rows[0],
        months,
      });
    } catch (err) {
      console.error(
        "GET /bonus-computations/staff/:staffId ERROR:",
        err?.message
      );

      return res.status(500).json({
        message:
          err?.message ||
          "Failed to load employee bonus computation.",
      });
    }
  }
);

/* =========================================================
   SAVE JANUARY - DECEMBER
   PUT /api/bonus-computations/staff/:staffId

   Body:
    {
      "year": 2026,
      "months": [
        {
          "month": 1,
          "deductions": 0
        }
      ]
    }

  Salary + ECOLA, 13th Month, 14th Month,
  and 15th Month Base are calculated by the backend.
========================================================= */

router.put(
  "/staff/:staffId",
  requireAuth,
  async (req, res) => {
    const client = await pool.connect();

    try {
      const staffId = toInt(req.params.staffId);
      const year = validYear(req.body?.year);

      const months = Array.isArray(req.body?.months)
        ? req.body.months
        : [];

      if (!staffId) {
        return res.status(400).json({
          message: "Invalid staff id.",
        });
      }

      if (!year) {
        return res.status(400).json({
          message: "Valid year is required.",
        });
      }

      if (months.length !== 12) {
        return res.status(400).json({
          message:
            "January through December are required.",
        });
      }

      /* =====================================================
         NORMALIZE MANUAL VALUES

         Editable:
         - Total Compensation
         - Deductions
         - 13th Month

         Read only:
         - 14th Month = 13th Month
         - 15th Month = 13th Month
      ===================================================== */

      const normalizedMonths = [];

      for (const item of months) {
        const month = toInt(item?.month);

        const totalCompensation = toNum(
          item?.total_compensation
        );

        const deductions = toNum(
          item?.deductions
        );

        const month13 = toNum(
          item?.month_13
        );

        if (
          !month ||
          month < 1 ||
          month > 12
        ) {
          return res.status(400).json({
            message:
              "Invalid computation month.",
          });
        }

        if (
          totalCompensation < 0 ||
          deductions < 0 ||
          month13 < 0
        ) {
          return res.status(400).json({
            message:
              "Computation amounts cannot be negative.",
          });
        }

        normalizedMonths.push({
          month,

          total_compensation:
            totalCompensation,

          deductions,

          month_13: month13,

          // 14th and 15th always follow 13th.
          month_14: month13,
          month_15: month13,
        });
      }

      const uniqueMonths = new Set(
        normalizedMonths.map(
          (item) => item.month
        )
      );

      if (uniqueMonths.size !== 12) {
        return res.status(400).json({
          message:
            "Each month from January to December must appear exactly once.",
        });
      }

      /* =====================================================
         LOAD STAFF
      ===================================================== */

      const staffCheck = await client.query(
        `
          SELECT
            id,
            TRIM(
              COALESCE(employee_no, '')
            ) AS employee_no,
            start_date,
            regularization_date,
            COALESCE(salary, 0)::numeric
              AS salary,
            COALESCE(ecola, 0)::numeric
              AS ecola

          FROM public.staff

          WHERE id = $1

          LIMIT 1;
        `,
        [staffId]
      );

      if (staffCheck.rowCount === 0) {
        return res.status(404).json({
          message: "Staff not found.",
        });
      }

      const staff = staffCheck.rows[0];

      if (!staff.employee_no) {
        return res.status(400).json({
          message:
            "Staff employee number is required for bonus computation.",
        });
      }

      /* =====================================================
         LOAD CURRENT SAVED BONUS COMPUTATION

         We need this so we can determine which Total
         Compensation months HR actually changed.
      ===================================================== */

      const currentComputationResult =
        await client.query(
          `
            SELECT
              computation_month,
              COALESCE(
                total_compensation,
                0
              )::numeric AS total_compensation

            FROM public.bonus_computations

            WHERE staff_id = $1
              AND computation_year = $2

            ORDER BY
              computation_month ASC;
          `,
          [staffId, year]
        );

      const currentCompensationByMonth =
        new Map(
          currentComputationResult.rows.map(
            (row) => [
              Number(row.computation_month),
              toNum(
                row.total_compensation
              ),
            ]
          )
        );

      /* =====================================================
         LOAD SALARY HISTORY

         Salary History remains the permanent source of
         Salary + ECOLA.

         If Total Compensation is manually corrected in
         Bonus Computation, we create/update a correction
         effective for that month.
      ===================================================== */

      const salaryHistoryResult =
        await client.query(
          `
            SELECT
              id,
              TRIM(employee_no)
                AS employee_no,
              effective_date,
              COALESCE(
                salary,
                0
              )::numeric AS salary,
              COALESCE(
                ecola,
                0
              )::numeric AS ecola,
              created_at

            FROM public.salary_history

            WHERE TRIM(employee_no) = $1
              AND effective_date <=
                make_date($2, 12, 31)

            ORDER BY
              effective_date ASC,
              created_at ASC,
              id ASC;
          `,
          [
            staff.employee_no,
            year,
          ]
        );

      const salaryHistory = [
        ...salaryHistoryResult.rows,
      ];

      const startDate =
        toDateOnlyUtc(
          staff.start_date
        );

      await client.query("BEGIN");

      /* =====================================================
         SYNC MANUAL TOTAL COMPENSATION CHANGES
         TO SALARY HISTORY
      ===================================================== */

      for (
        const item of normalizedMonths
      ) {
        const monthStart =
          `${year}-${String(
            item.month
          ).padStart(2, "0")}-01`;

        const monthEnd = new Date(
          Date.UTC(
            year,
            item.month,
            0
          )
        )
          .toISOString()
          .slice(0, 10);

        /*
         * Do not allow compensation before
         * employee deployment.
         */
        if (
          startDate &&
          startDate > monthEnd
        ) {
          if (
            toNum(
              item.total_compensation
            ) !== 0
          ) {
            throw new Error(
              `Total compensation for month ${item.month} cannot be entered before the employee's deployment date.`
            );
          }

          continue;
        }

        /*
         * Compare submitted compensation against
         * the value currently saved in
         * bonus_computations.
         *
         * If HR did not change it, do not touch
         * Salary History.
         */

        const hasCurrentComputation =
          currentCompensationByMonth.has(
            item.month
          );

        if (!hasCurrentComputation) {
          continue;
        }

        const currentCompensation =
          toNum(
            currentCompensationByMonth.get(
              item.month
            )
          );

        const submittedCompensation =
          toNum(
            item.total_compensation
          );

        const compensationChanged =
          Math.abs(
            submittedCompensation -
              currentCompensation
          ) > 0.004;

        if (!compensationChanged) {
          continue;
        }

        /*
         * Find Salary History effective for
         * this month.
         */
        let applicableHistory = null;

        for (
          const history of salaryHistory
        ) {
          const effectiveDate =
            toDateOnlyUtc(
              history.effective_date
            );

          if (!effectiveDate) {
            continue;
          }

          if (
            effectiveDate <= monthEnd
          ) {
            applicableHistory = history;
          } else {
            break;
          }
        }

        /*
         * Preserve ECOLA.
         *
         * Total Compensation =
         * Salary + ECOLA
         */
        const applicableEcola =
          applicableHistory
            ? toNum(
                applicableHistory.ecola
              )
            : toNum(staff.ecola);

        const submittedTotalCompensation =
          toNum(item.total_compensation);

        let correctedEcola = applicableEcola;

        let correctedSalary =
          submittedTotalCompensation -
          correctedEcola;

        if (correctedSalary < 0) {
          correctedSalary = 0;
          correctedEcola =
            submittedTotalCompensation;
        }

        /*
         * Check if there is already a Salary
         * History entry effective on the first
         * day of this month.
         *
         * If yes -> update that correction.
         * If no  -> insert new correction.
         */
        /*
        * Salary History has a unique constraint for
        * employee + effective_date.
        *
        * Do not depend only on the in-memory array.
        * Let PostgreSQL update the existing row when
        * that employee/date already exists.
        */

        const savedHistory =
          await client.query(
            `
              INSERT INTO public.salary_history
              (
                employee_no,
                effective_date,
                salary,
                ecola,
                created_at
              )
              VALUES
              (
                $1,
                $2::date,
                $3,
                $4,
                NOW()
              )

              ON CONFLICT ON CONSTRAINT unique_employee_effective_date
              DO UPDATE SET
                salary = EXCLUDED.salary,
                ecola = EXCLUDED.ecola

              RETURNING
                id,
                employee_no,
                effective_date,
                salary,
                ecola,
                created_at;
            `,
            [
              staff.employee_no,
              monthStart,
              correctedSalary,
              correctedEcola,
            ]
          );

        const savedHistoryRow =
          savedHistory.rows[0];

        const existingHistoryIndex =
          salaryHistory.findIndex(
            (history) =>
              Number(history.id) ===
              Number(savedHistoryRow.id)
          );

        if (existingHistoryIndex >= 0) {
          salaryHistory[
            existingHistoryIndex
          ] = savedHistoryRow;
        } else {
          salaryHistory.push(
            savedHistoryRow
          );
        }

        /*
         * Keep history ordered because later
         * months depend on the latest effective
         * Salary History record.
         */
        salaryHistory.sort(
          (a, b) => {
            const dateA =
              toDateOnlyUtc(
                a.effective_date
              ) || "";

            const dateB =
              toDateOnlyUtc(
                b.effective_date
              ) || "";

            if (dateA !== dateB) {
              return dateA.localeCompare(
                dateB
              );
            }

            return (
              Number(a.id || 0) -
              Number(b.id || 0)
            );
          }
        );
      }

      /* =====================================================
         SAVE BONUS COMPUTATION

         IMPORTANT:
         We save exactly the manually submitted:
         - Total Compensation
         - Deductions
         - 13th Month

         Then:
         - 14th = 13th
         - 15th = 13th
      ===================================================== */

      for (
        const item of normalizedMonths
      ) {
        await client.query(
          `
            INSERT INTO public.bonus_computations
            (
              staff_id,
              computation_year,
              computation_month,
              total_compensation,
              deductions,
              month_13,
              month_14,
              month_15,
              created_by,
              updated_by,
              created_at,
              updated_at
            )
            VALUES
            (
              $1,
              $2,
              $3,
              $4,
              $5,
              $6,
              $7,
              $8,
              $9,
              $9,
              NOW(),
              NOW()
            )

            ON CONFLICT
            (
              staff_id,
              computation_year,
              computation_month
            )

            DO UPDATE SET
              total_compensation =
                EXCLUDED.total_compensation,

              deductions =
                EXCLUDED.deductions,

              month_13 =
                EXCLUDED.month_13,

              month_14 =
                EXCLUDED.month_14,

              month_15 =
                EXCLUDED.month_15,

              updated_by =
                EXCLUDED.updated_by,

              updated_at = NOW();
          `,
          [
            staffId,
            year,
            item.month,
            item.total_compensation,
            item.deductions,
            item.month_13,
            item.month_14,
            item.month_15,
            req.user?.id ?? null,
          ]
        );
      }

      await client.query("COMMIT");

      return res.json({
        message:
          "Bonus computation and Salary History saved successfully.",
        staff_id: staffId,
        year,
      });
    } catch (err) {
      try {
        await client.query(
          "ROLLBACK"
        );
      } catch {
        // Ignore rollback error.
      }

      console.error(
        "PUT /bonus-computations/staff/:staffId ERROR:",
        err?.message
      );

      return res.status(500).json({
        message:
          err?.message ||
          "Failed to save bonus computation.",
      });
    } finally {
      client.release();
    }
  }
);

module.exports = router;