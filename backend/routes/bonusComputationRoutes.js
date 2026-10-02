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
        b.name AS branch_name,

        COALESCE(s.salary, 0)::numeric AS salary,
        COALESCE(s.ecola, 0)::numeric AS ecola,

        (
          COALESCE(s.salary, 0) +
          COALESCE(s.ecola, 0)
        )::numeric AS total_gross,

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
        b.name,
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
          b.name AS branch_name,

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
         "month_13": 1000,
         "month_14": 0,
         "month_15": 0
       }
     ]
   }
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

      const normalizedMonths = [];

      for (const item of months) {
        const month = toInt(item?.month);
        const month13 = toNum(item?.month_13);
        const month14 = toNum(item?.month_14);
        const month15 = toNum(item?.month_15);

        if (!month || month < 1 || month > 12) {
          return res.status(400).json({
            message: "Invalid computation month.",
          });
        }

        if (
          month13 < 0 ||
          month14 < 0 ||
          month15 < 0
        ) {
          return res.status(400).json({
            message:
              "Bonus amounts cannot be negative.",
          });
        }

        normalizedMonths.push({
          month,
          month_13: month13,
          month_14: month14,
          month_15: month15,
        });
      }

      const uniqueMonths = new Set(
        normalizedMonths.map((item) => item.month)
      );

      if (uniqueMonths.size !== 12) {
        return res.status(400).json({
          message:
            "Each month from January to December must appear exactly once.",
        });
      }

      const staffCheck = await client.query(
        `
        SELECT id
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

      await client.query("BEGIN");

      for (const item of normalizedMonths) {
        await client.query(
          `
          INSERT INTO public.bonus_computations
          (
            staff_id,
            computation_year,
            computation_month,
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
            $7,
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
            month_13 = EXCLUDED.month_13,
            month_14 = EXCLUDED.month_14,
            month_15 = EXCLUDED.month_15,
            updated_by = EXCLUDED.updated_by,
            updated_at = NOW();
          `,
          [
            staffId,
            year,
            item.month,
            item.month_13,
            item.month_14,
            item.month_15,
            req.user?.id ?? null,
          ]
        );
      }

      await client.query("COMMIT");

      return res.json({
        message: "Bonus computation saved successfully.",
        staff_id: staffId,
        year,
      });
    } catch (err) {
      try {
        await client.query("ROLLBACK");
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