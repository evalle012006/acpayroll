//bonusComputationRoutes.js

const express = require("express");
const router = express.Router();
const pool = require("../db");
const { requireAuth } = require("../middlewares/authMiddleware");

/* =========================================================
   HELPERS
========================================================= */

const toInt = (v) => {const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

const toNum = (v) => { const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const validYear = (v) => {
  const year = toInt(v);

  if (!year || year < 2000 || year > 2100) {return null;}

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
   BONUS COMPUTATION HELPERS
========================================================= */

const normalizeText = (value) => String(value ?? "").trim().toLowerCase();
const getDaysInMonth = (year, month) => new Date(Date.UTC(year, month, 0)).getUTCDate();
const getDateString = (year, month, day) => [year, String(month).padStart(2, "0"), String(day).padStart(2, "0"),].join("-");
const roundMoney = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const canManageBonus = (req) => {
  const role = normalizeText(req.user?.role);
  const department = normalizeText(req.user?.department || req.user?.department_name);

  return (
    role === "admin" ||
    role === "it" ||
    department === "hr" ||
    department === "hr department" ||
    department === "accounting" ||
    department === "accounting department"
  );
};

const requireBonusManager = (req, res, next) => {
  if (!canManageBonus(req)) {
    return res.status(403).json({message: "You do not have permission to manage bonus computations.",});
  }

  next();
};

const computeMonthlyCompensation = ({
  year, month, startDate, exitDate, salaryHistory,
}) => {
  const daysInMonth = getDaysInMonth(year, month);

  let totalCompensation = 0;

  for (let day = 1; day <= daysInMonth; day += 1) {
    const currentDate = getDateString(year, month, day);

    if (currentDate < startDate) {continue;}
    if (exitDate && currentDate > exitDate) {continue;}

    let applicableSalary = null;

    for (const history of salaryHistory) {
      const effectiveDate = toDateOnlyUtc(
        history.effective_date
      );

      if (effectiveDate <= currentDate) {
        applicableSalary = history;
      } else {
        break;
      }
    }

    if (!applicableSalary) {
      return {
        valid: false,
        reason: `Missing applicable Salary History for ${currentDate}.`,
      };
    }

    const basicSalary = toNum(applicableSalary.salary);
    const ecola = toNum(applicableSalary.ecola);

    totalCompensation +=
      (basicSalary + ecola) / daysInMonth;
  }

  return {
    valid: true,
    totalCompensation: roundMoney(totalCompensation),
  };
};

const loadSuspensionDeductions = async (client, staffId, year) => {
  const result = await client.query(
    `
      SELECT
        EXTRACT(
          MONTH FROM so.end_date
        )::integer AS month,

        COALESCE(
          SUM(
            COALESCE(so.prorated_salary, 0)
          ),
          0
        )::numeric AS salary_deduction,

        COALESCE(
          SUM(
            COALESCE(so.prorated_ecola, 0)
          ),
          0
        )::numeric AS ecola_deduction

      FROM public.suspension_orders so

      WHERE so.employee_id = $1

        AND LOWER(
          TRIM(COALESCE(so.status, ''))
        ) = 'received'

        AND so.end_date >= make_date($2, 1, 1)

        AND so.end_date < make_date($2 + 1, 1, 1)

      GROUP BY
        EXTRACT(MONTH FROM so.end_date)

      ORDER BY
        month ASC;
    `,
    [staffId, year]
  );

  const deductionsByMonth = new Map();

  for (const row of result.rows) {
    const month = Number(row.month);

    const salaryDeduction = roundMoney(
      row.salary_deduction
    );

    const ecolaDeduction = roundMoney(
      row.ecola_deduction
    );

    deductionsByMonth.set(month, {
      salaryDeduction,
      ecolaDeduction,

      totalDeduction: roundMoney(
        salaryDeduction + ecolaDeduction
      ),
    });
  }

  return deductionsByMonth;
};

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
    console.error("GET /bonus-computations ERROR:", err?.message);

    return res.status(500).json({
      message: err?.message || "Failed to load bonus computations.",
    });
  }
});

router.get("/staff/:staffId", requireAuth, async (req, res) => {
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
          month_15,
          is_manual_override
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
          exists: Boolean(saved),
          total_compensation: toNum(
            saved?.total_compensation
          ),

          deductions: toNum(saved?.deductions),
          month_13: toNum(saved?.month_13),
          month_14: toNum(saved?.month_14),
          month_15: toNum(saved?.month_15),
          is_manual_override:
            saved?.is_manual_override === true,
        });
      }

      return res.json({
        year, staff: staffResult.rows[0], months,
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

router.post("/recalculate", requireAuth, requireBonusManager, async (req, res) => {
    let client;

    try {
      const year = validYear(req.body?.year);

      if (!year) {
        return res.status(400).json({
          message: "Valid year is required.",
        });
      }

      client = await pool.connect();

      await client.query("BEGIN");

      const staffResult = await client.query(`
        SELECT
          s.id AS staff_id,
          TRIM(COALESCE(s.employee_no, '')) AS employee_no,
          s.fullname,
          s.status,
          s.start_date,
          s.exit_date
        FROM public.staff s
        WHERE TRIM(COALESCE(s.employee_no, '')) <> ''
        ORDER BY s.id ASC;
      `);

      let processedStaff = 0;
      let processedMonths = 0;
      let protectedMonths = 0;

      const skippedStaff = [];

      for (const staff of staffResult.rows) {
        const staffId = toInt(staff.staff_id);

        await client.query(
          `
            SELECT pg_advisory_xact_lock(
              hashtext('bonus_computation'),
              hashtext($1::text || ':' || $2::text)
            );
          `,
          [staffId, year]
        );

        const employeeNo = String(
          staff.employee_no || ""
        ).trim();

        const startDate = toDateOnlyUtc(staff.start_date);
        const exitDate = toDateOnlyUtc(staff.exit_date);
        const status = normalizeText(staff.status);

        /* ===============================================
           VALIDATE EMPLOYMENT DATES
        =============================================== */

        if (!startDate) {
          skippedStaff.push({
            staff_id: staffId,
            employee_no: employeeNo,
            fullname: staff.fullname,
            reason: "Missing employment start date.",
          });

          continue;
        }

        if (
          status === "inactive" &&
          !exitDate
        ) {
          skippedStaff.push({
            staff_id: staffId,
            employee_no: employeeNo,
            fullname: staff.fullname,
            reason:
              "Inactive employee has no exit date.",
          });

          continue;
        }

        if (
          status === "active" &&
          exitDate
        ) {
          skippedStaff.push({
            staff_id: staffId,
            employee_no: employeeNo,
            fullname: staff.fullname,
            reason:
              "Active employee has an exit date. Please verify.",
          });

          continue;
        }

        if (
          exitDate &&
          exitDate < startDate
        ) {
          skippedStaff.push({
            staff_id: staffId,
            employee_no: employeeNo,
            fullname: staff.fullname,
            reason:
              "Exit date is earlier than start date.",
          });

          continue;
        }

        /* ===============================================
           LOAD SALARY HISTORY
        =============================================== */

        const historyResult = await client.query(
          `
          SELECT
            id,
            effective_date,
            COALESCE(salary, 0)::numeric AS salary,
            COALESCE(ecola, 0)::numeric AS ecola,
            created_at
          FROM public.salary_history
          WHERE TRIM(employee_no) = $1
            AND effective_date <= make_date($2, 12, 31)
          ORDER BY
            effective_date ASC,
            created_at ASC,
            id ASC;
          `,
          [employeeNo, year]
        );

        const salaryHistory = historyResult.rows;

        if (salaryHistory.length === 0) {
          skippedStaff.push({
            staff_id: staffId,
            employee_no: employeeNo,
            fullname: staff.fullname,
            reason:
              "No Salary History available.",
          });

          continue;
        }

        const suspensionDeductions = await loadSuspensionDeductions(client, staffId, year);
        const computedMonths = [];
        let computationError = null;

        for (
          let month = 1;
          month <= 12;
          month += 1
        ) {
          const result = computeMonthlyCompensation({
            year, month, startDate, exitDate, salaryHistory,
          });

          if (!result.valid) {
            computationError = result.reason;
            break;
          }

          const totalCompensation = result.totalCompensation;
          const suspension = suspensionDeductions.get(month);
          const deductions = roundMoney(suspension?.totalDeduction ?? 0);
          const adjustedCompensation = roundMoney(Math.max(0, totalCompensation - deductions));
          const monthlyBonusShare = roundMoney(adjustedCompensation / 12);

          computedMonths.push({month, totalCompensation, deductions, monthlyBonusShare,});
        }

        if (computationError) {
          skippedStaff.push({
            staff_id: staffId,
            employee_no: employeeNo,
            fullname: staff.fullname,
            reason: computationError,
          });

          continue;
        }

        for (const item of computedMonths) {
          const result = await client.query(
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
                manual_base_month_13,
                manual_base_month_14,
                manual_base_month_15,
                is_manual_override,
                created_by,
                updated_by,
                created_at,
                updated_at
              )
              VALUES
              (
                $1, $2, $3, $4,
                $5,
                $6, $6, $6,
                NULL, NULL, NULL,
                FALSE,
                $7, $7,
                NOW(), NOW()
              )

              ON CONFLICT
                (staff_id, computation_year, computation_month)

              DO UPDATE SET

                total_compensation =
                  CASE
                    WHEN bonus_computations.is_manual_override = TRUE
                    THEN bonus_computations.total_compensation
                    ELSE EXCLUDED.total_compensation
                  END,

                deductions = EXCLUDED.deductions,

                month_13 =
                  CASE
                    WHEN bonus_computations.is_manual_override = TRUE
                    THEN GREATEST(
                      0,
                      COALESCE(
                        bonus_computations.manual_base_month_13,
                        bonus_computations.month_13
                      ) - ROUND(EXCLUDED.deductions / 12.0, 2)
                    )
                    ELSE EXCLUDED.month_13
                  END,

                month_14 =
                  CASE
                    WHEN bonus_computations.is_manual_override = TRUE
                    THEN GREATEST(
                      0,
                      COALESCE(
                        bonus_computations.manual_base_month_14,
                        bonus_computations.month_14
                      ) - ROUND(EXCLUDED.deductions / 12.0, 2)
                    )
                    ELSE EXCLUDED.month_14
                  END,

                month_15 =
                  CASE
                    WHEN bonus_computations.is_manual_override = TRUE
                    THEN GREATEST(
                      0,
                      COALESCE(
                        bonus_computations.manual_base_month_15,
                        bonus_computations.month_15
                      ) - ROUND(EXCLUDED.deductions / 12.0, 2)
                    )
                    ELSE EXCLUDED.month_15
                  END,

                manual_base_month_13 =
                  CASE
                    WHEN bonus_computations.is_manual_override = TRUE
                    THEN bonus_computations.manual_base_month_13
                    ELSE NULL
                  END,

                manual_base_month_14 =
                  CASE
                    WHEN bonus_computations.is_manual_override = TRUE
                    THEN bonus_computations.manual_base_month_14
                    ELSE NULL
                  END,

                manual_base_month_15 =
                  CASE
                    WHEN bonus_computations.is_manual_override = TRUE
                    THEN bonus_computations.manual_base_month_15
                    ELSE NULL
                  END,

                updated_by = EXCLUDED.updated_by,
                updated_at = NOW()

              RETURNING id;
            `,
            [
              staffId,
              year,
              item.month,
              item.totalCompensation,
              item.deductions,
              item.monthlyBonusShare,
              req.user?.id ?? null,
            ]
          );

          if (result.rowCount > 0) {
            processedMonths += 1;
          } else {
            protectedMonths += 1;
          }
        }

        processedStaff += 1;
      }

      await client.query("COMMIT");

      return res.json({
        message: `Bonus computations for ${year} processed successfully.`,
        year,
        staff_processed: processedStaff,
        months_processed: processedMonths,
        protected_months: protectedMonths,
        skipped_staff_count: skippedStaff.length,
        skipped_staff: skippedStaff,
      });
    } catch (err) {
      if (client) {
        try {
          await client.query("ROLLBACK");
        } catch (rollbackError) {
          console.error(
            "Bonus computation rollback error:",
            rollbackError
          );
        }
      }

      console.error("POST /bonus-computations/recalculate ERROR:", err);

      return res.status(500).json({
        message: err?.message || "Failed to generate bonus computations.",
      });
    } finally {
      if (client) {
        client.release();
      }
    }
  }
);

router.put("/staff/:staffId", requireAuth, requireBonusManager, async (req, res) => {
    let client;

    try {
      const staffId = toInt(req.params.staffId);
      const year = validYear(req.body?.year);

      const months = Array.isArray(req.body?.months)
        ? req.body.months
        : [];

      if (!staffId || staffId <= 0) {
        return res.status(400).json({
          message: "Invalid staff id.",
        });
      }

      if (!year) {
        return res.status(400).json({
          message: "Valid year is required.",
        });
      }

      if (months.length < 1 || months.length > 12) {
        return res.status(400).json({
          message: "Provide between 1 and 12 edited months.",
        });
      }

      const normalizedMonths = [];

      for (const item of months) {
        const month = Number(item?.month);
        const totalCompensation = Number(item?.total_compensation);
        const month13 = Number(item?.month_13);
        const original = item?.original;

        if (
          !Number.isInteger(month) ||
          month < 1 ||
          month > 12
        ) {
          return res.status(400).json({
            message: "Invalid computation month.",
          });
        }

        if (
          !Number.isFinite(totalCompensation) ||
          !Number.isFinite(month13) ||
          totalCompensation < 0 ||
          month13 < 0
        ) {
          return res.status(400).json({
            message: `Invalid amounts for month ${month}.`,
          });
        }

        if (
          !original ||
          typeof original !== "object" ||
          typeof original.exists !== "boolean" ||
          typeof original.is_manual_override !== "boolean"
        ) {
          return res.status(400).json({
            message:
              `Original computation snapshot is required ` +
              `for month ${month}.`,
          });
        }

        const originalValues = {
          exists: original.exists,
          total_compensation: Number(
            original.total_compensation
          ),
          deductions: Number(original.deductions),
          month_13: Number(original.month_13),
          month_14: Number(original.month_14),
          month_15: Number(original.month_15),
          is_manual_override: original.is_manual_override,
        };

        if (
          ![
            originalValues.total_compensation,
            originalValues.deductions,
            originalValues.month_13,
            originalValues.month_14,
            originalValues.month_15,
          ].every(
            (value) =>
              Number.isFinite(value) && value >= 0
          )
        ) {
          return res.status(400).json({
            message:
              `Invalid original computation values ` +
              `for month ${month}.`,
          });
        }

        normalizedMonths.push({
          month,

          total_compensation: roundMoney(totalCompensation),
          month_13: roundMoney(month13),
          original: 
            {
              exists: originalValues.exists,
              total_compensation: roundMoney(originalValues.total_compensation),
              deductions: roundMoney(originalValues.deductions),
              month_13: roundMoney(originalValues.month_13),
              month_14: roundMoney(originalValues.month_14),
              month_15: roundMoney(originalValues.month_15),
              is_manual_override:originalValues.is_manual_override,
            },
        });
      }

      const uniqueMonths = new Set(
        normalizedMonths.map((item) => item.month)
      );

      if (uniqueMonths.size !== normalizedMonths.length) {
        return res.status(400).json({
          message: "Duplicate computation months are not allowed.",
        });
      }

      client = await pool.connect();

      await client.query("BEGIN");
      await client.query(
        `
          SELECT pg_advisory_xact_lock(
            hashtext('bonus_computation'),
            hashtext($1::text || ':' || $2::text)
          );
        `,
        [staffId, year]
      );

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
        await client.query("ROLLBACK");

        return res.status(404).json({
          message: "Staff not found.",
        });
      }

      const suspensionDeductions =
        await loadSuspensionDeductions(
          client,
          staffId,
          year
        );

      const requestedMonthNumbers = normalizedMonths.map((item) => item.month);
      const existingResult = await client.query(
        `
          SELECT
            computation_month,
            total_compensation,
            deductions,
            month_13,
            month_14,
            month_15,
            is_manual_override
          FROM public.bonus_computations
          WHERE staff_id = $1
            AND computation_year = $2
            AND computation_month = ANY($3::int[])
          ORDER BY computation_month
          FOR UPDATE;
        `,
        [staffId, year, requestedMonthNumbers]
      );

      const existingMap = new Map(
        existingResult.rows.map((row) => [
          Number(row.computation_month),
          row,
        ])
      );

      const conflicts = [];

      for (const item of normalizedMonths) {
        const existing = existingMap.get(item.month);
        const original = item.original;

        if (!existing) {
          if (original.exists) {
            conflicts.push(item.month);
          }

          continue;
        }

        if (!original.exists) {
          conflicts.push(item.month);
          continue;
        }

        const changedSinceLoaded =
          roundMoney(existing.total_compensation) !==
            original.total_compensation ||
          roundMoney(existing.deductions) !==
            original.deductions ||
          roundMoney(existing.month_13) !==
            original.month_13 ||
          roundMoney(existing.month_14) !==
            original.month_14 ||
          roundMoney(existing.month_15) !==
            original.month_15 ||
          existing.is_manual_override !==
            original.is_manual_override;

        if (changedSinceLoaded) {
          conflicts.push(item.month);
        }
      }

      if (conflicts.length > 0) {
        await client.query("ROLLBACK");

        return res.status(409).json({
          message:
            "Another user has modified one or more selected " +
            "months. Reload the employee computation before saving.",
          conflict_months: conflicts,
        });
      }

      let updatedMonths = 0;
      let unchangedMonths = 0;

      for (const item of normalizedMonths) {
        const existing = existingMap.get(item.month);

        const deductions = roundMoney(
          suspensionDeductions.get(item.month)?.totalDeduction ?? 0
        );

        const originalDeductions = roundMoney(
          item.original.deductions
        );

        if (deductions !== originalDeductions) {
          await client.query("ROLLBACK");

          return res.status(409).json({
            message:
              `Suspension deductions for month ${item.month} ` +
              `have changed. Please reload the employee's ` +
              `bonus computation before saving.`,

            conflict_months: [item.month],
          });
        }

        const changed =
          !existing ||
          roundMoney(existing.total_compensation) !==
            item.total_compensation ||
          roundMoney(existing.deductions) !==
            deductions ||
          roundMoney(existing.month_13) !==
            item.month_13 ||
          roundMoney(existing.month_14) !==
            item.month_13 ||
          roundMoney(existing.month_15) !==
            item.month_13;

        if (!changed) {
          unchangedMonths += 1;
          continue;
        }

        const suspensionAdjustment = roundMoney(deductions / 12);
        const manualBase13 = roundMoney(item.month_13 + suspensionAdjustment);
        const manualBase14 = roundMoney(item.month_13 + suspensionAdjustment);
        const manualBase15 = roundMoney(item.month_13 + suspensionAdjustment);

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
              manual_base_month_13,
              manual_base_month_14,
              manual_base_month_15,
              is_manual_override,
              created_by,
              updated_by,
              created_at,
              updated_at
            )
            VALUES
            (
              $1, $2, $3, $4, $5,
              $6, $6, $6,
              $7, $8, $9,
              TRUE,
              $10, $10,
              NOW(), NOW()
            )

            ON CONFLICT
              (staff_id, computation_year, computation_month)

            DO UPDATE SET
              total_compensation = EXCLUDED.total_compensation,
              deductions = EXCLUDED.deductions,

              month_13 = EXCLUDED.month_13,
              month_14 = EXCLUDED.month_14,
              month_15 = EXCLUDED.month_15,

              manual_base_month_13 = EXCLUDED.manual_base_month_13,
              manual_base_month_14 = EXCLUDED.manual_base_month_14,
              manual_base_month_15 = EXCLUDED.manual_base_month_15,

              is_manual_override = TRUE,
              updated_by = EXCLUDED.updated_by,
              updated_at = NOW();
          `,
          [
            staffId,
            year,
            item.month,
            item.total_compensation,
            deductions,
            item.month_13,
            manualBase13,
            manualBase14,
            manualBase15,
            req.user?.id ?? null,
          ]
        );

        updatedMonths += 1;
      }

      await client.query("COMMIT");

      return res.json({
        message: "Bonus computation saved successfully.",
        staff_id: staffId,
        year,
        updated_months: updatedMonths,
        unchanged_months: unchangedMonths,
      });
    } catch (err) {
      if (client) {
        try {
          await client.query("ROLLBACK");
        } catch (rollbackError) {
          console.error(
            "Bonus manual edit rollback error:",
            rollbackError
          );
        }
      }

      console.error("PUT /bonus-computations/staff/:staffId ERROR:", err);

      return res.status(500).json({
        message:
          err?.message ||
          "Failed to save bonus computation.",
      });
    } finally {
      if (client) {
        client.release();
      }
    }
  }
);

router.post("/staff/:staffId/reset-automatic", requireAuth, requireBonusManager, async (req, res) => {
    let client;

    try {
      const staffId = toInt(req.params.staffId);
      const year = validYear(req.body?.year);
      const month = Number(req.body?.month);

      if (!staffId || staffId <= 0) {
        return res.status(400).json({
          message: "Invalid staff id.",
        });
      }

      if (!year) {
        return res.status(400).json({
          message: "Valid year is required.",
        });
      }

      if (!Number.isInteger(month) || month < 1 || month > 12)
      {return res.status(400).json({message: "Valid month from 1 to 12 is required.",});}

      client = await pool.connect();
      await client.query("BEGIN");

      await client.query(
        `
          SELECT pg_advisory_xact_lock(
            hashtext('bonus_computation'),
            hashtext($1::text || ':' || $2::text)
          );
        `,
        [staffId, year]
      );

      const staffResult = await client.query(
        `
        SELECT
          id AS staff_id,
          TRIM(COALESCE(employee_no, '')) AS employee_no,
          fullname,
          status,
          start_date,
          exit_date
        FROM public.staff
        WHERE id = $1
        LIMIT 1;
        `,
        [staffId]
      );

      if (staffResult.rowCount === 0) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          message: "Staff not found.",
        });
      }

      const staff = staffResult.rows[0];
      const employeeNo = String(staff.employee_no || "").trim();
      const startDate = toDateOnlyUtc(staff.start_date);
      const exitDate = toDateOnlyUtc(staff.exit_date);
      const status = normalizeText(staff.status);

      let validationError = null;

      if (!employeeNo) 
        { validationError = "Employee number is missing.";} 
      else if (!startDate) 
        {validationError ="Employment start date is missing.";} 
      else if (status === "inactive" &&!exitDate) 
        {validationError = "Inactive employee has no exit date.";} 
      else if (status === "active" && exitDate)
        {validationError = "Active employee has an exit date. Please verify.";}
      else if (exitDate && exitDate < startDate)
        {validationError = "Exit date is earlier than start date.";}

      if (validationError) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message: validationError,
        });
      }

      const historyResult = await client.query(
        `
        SELECT
          id,
          effective_date,
          COALESCE(salary, 0)::numeric AS salary,
          COALESCE(ecola, 0)::numeric AS ecola,
          created_at
        FROM public.salary_history
        WHERE TRIM(employee_no) = $1
          AND effective_date <= make_date($2, 12, 31)
        ORDER BY
          effective_date ASC, created_at ASC, id ASC;
        `,
        [employeeNo, year]
      );

      if (historyResult.rowCount === 0) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message: "No Salary History available for automatic computation.",
        });
      }

      const computation = computeMonthlyCompensation({
        year, month, startDate, exitDate,
        salaryHistory: historyResult.rows,
      });

      if (!computation.valid) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: computation.reason,});
      }

      const totalCompensation = computation.totalCompensation;
      const suspensionDeductions = await loadSuspensionDeductions(client, staffId, year);
      const suspension = suspensionDeductions.get(month);
      const deductions = roundMoney(suspension?.totalDeduction ?? 0);
      const adjustedCompensation = roundMoney(Math.max(0, totalCompensation - deductions));
      const monthlyBonusShare = roundMoney(adjustedCompensation / 12);

      const updateResult = await client.query(
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
          is_manual_override,
          created_by,
          updated_by,
          created_at,
          updated_at
        )
        VALUES
        (
          $1, $2, $3, $4,
          $5,
          $6, $6, $6,
          FALSE,
          $7, $7,
          NOW(),
          NOW()
        )

        ON CONFLICT
          (staff_id, computation_year, computation_month)

        DO UPDATE SET
          total_compensation = EXCLUDED.total_compensation,

          deductions = EXCLUDED.deductions,

          month_13 = EXCLUDED.month_13,
          month_14 = EXCLUDED.month_14,
          month_15 = EXCLUDED.month_15,

          manual_base_month_13 = NULL,
          manual_base_month_14 = NULL,
          manual_base_month_15 = NULL,

          is_manual_override = FALSE,

          updated_by = EXCLUDED.updated_by,
          updated_at = NOW()

        RETURNING
          id,
          staff_id,
          computation_year,
          computation_month,
          total_compensation,
          deductions,
          month_13,
          month_14,
          month_15,
          is_manual_override;
        `,
        [staffId, year, month, totalCompensation, deductions, monthlyBonusShare, req.user?.id ?? null,]
      );

      await client.query("COMMIT");

      return res.json({
        message: "Bonus computation reset to automatic successfully.",
        staff_id: staffId, year, month,
        computation: updateResult.rows[0],
      });
    } catch (err) {
      if (client) {
        try {
          await client.query("ROLLBACK");
        } catch (rollbackError) {
          console.error(
            "Reset automatic rollback error:",
            rollbackError
          );
        }
      }

      console.error("POST /bonus-computations/staff/:staffId/reset-automatic ERROR:", err);

      return res.status(500).json({
        message: err?.message || "Failed to reset bonus computation.",
      });
    } finally {
      if (client) {
        client.release();
      }
    }
  }
);

module.exports = router;