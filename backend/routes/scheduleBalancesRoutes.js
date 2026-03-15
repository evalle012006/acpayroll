const express = require("express");
const router = express.Router();
const pool = require("../db");
const { requireAuth, requireRole } = require("../middlewares/authMiddleware");

const toNum = (v) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const monthToDate = (monthStr) => {
  const m = String(monthStr || "").trim();
  if (!/^\d{4}-\d{2}$/.test(m)) return null;
  return `${m}-01`;
};

const monthEndExpr = (paramRef) =>
  `((DATE_TRUNC('month', ${paramRef}::date) + INTERVAL '1 month - 1 day')::date)`;

/* =========================================================
   GET SNAPSHOT
========================================================= */
router.get("/", requireAuth, async (req, res) => {
  try {
    const snapshotMonth = monthToDate(req.query.month);
    const branchId = req.query.branchId ? Number(req.query.branchId) : null;

    if (!snapshotMonth) {
      return res.status(400).json({ message: "month is required in YYYY-MM format" });
    }

    const params = [snapshotMonth];
    let sql = `
      SELECT
        sbs.id,
        sbs.snapshot_month,
        sbs.staff_id,
        sbs.employee_no,
        sbs.fullname,
        sbs.position,
        sbs.branch_id,
        sbs.last_name,
        sbs.first_name,
        sbs.middle_name,
        sbs.cbu,
        sbs.cashbond,
        sbs.utility,
        sbs.salary_loan,
        sbs.salary_advance,
        sbs.motorcycle_loan,
        sbs.special_advance,
        sbs.cash_advance,
        sbs.other_receivable,
        sbs.staff_accounts_payable,
        sbs.created_at,
        sbs.updated_at
      FROM public.schedule_balance_snapshots sbs
      WHERE sbs.snapshot_month = $1::date
    `;

    if (branchId) {
      params.push(branchId);
      sql += ` AND sbs.branch_id = $2::int`;
    }

    sql += ` ORDER BY sbs.fullname ASC`;

    const result = await pool.query(sql, params);
    return res.json(result.rows);
  } catch (e) {
    console.error("GET /api/schedule-balances ERROR:", e);
    return res.status(500).json({ message: e.message || "Server error" });
  }
});

/* =========================================================
   GET LIVE
========================================================= */
router.get("/live", requireAuth, async (req, res) => {
  try {
    const snapshotMonth = monthToDate(req.query.month);
    const branchId = req.query.branchId ? Number(req.query.branchId) : null;

    if (!snapshotMonth) {
      return res.status(400).json({ message: "month is required in YYYY-MM format" });
    }

    const params = [snapshotMonth];
    let whereSql = "";

    if (branchId) {
      params.push(branchId);
      whereSql = ` WHERE s.branch_id = $2::int `;
    }

    const sql = `
      WITH cutoff AS (
        SELECT
          $1::date AS month_start,
          ${monthEndExpr("$1")} AS month_end
      ),

      loan_remaining AS (
        SELECT
          lr.staff_id,

          SUM(
            CASE
              WHEN LOWER(COALESCE(lr.loan_type, '')) = 'salary loan'
              THEN GREATEST(
                COALESCE(lr.total, lr.amount, 0) -
                (
                  GREATEST(
                    (
                      DATE_PART(
                        'year',
                        AGE((SELECT month_end FROM cutoff), COALESCE(lr.disbursement_date, lr.approved_at))
                      )::int * 12
                    ) +
                    DATE_PART(
                      'month',
                      AGE((SELECT month_end FROM cutoff), COALESCE(lr.disbursement_date, lr.approved_at))
                    )::int,
                    0
                  ) * COALESCE(lr.per_month, 0)
                ),
                0
              )
              ELSE 0
            END
          )::numeric(12,2) AS salary_loan,

          SUM(
            CASE
              WHEN LOWER(COALESCE(lr.loan_type, '')) = 'salary advance'
              THEN GREATEST(
                COALESCE(lr.total, lr.amount, 0) -
                (
                  GREATEST(
                    (
                      DATE_PART(
                        'year',
                        AGE((SELECT month_end FROM cutoff), COALESCE(lr.disbursement_date, lr.approved_at))
                      )::int * 12
                    ) +
                    DATE_PART(
                      'month',
                      AGE((SELECT month_end FROM cutoff), COALESCE(lr.disbursement_date, lr.approved_at))
                    )::int,
                    0
                  ) * COALESCE(lr.per_month, 0)
                ),
                0
              )
              ELSE 0
            END
          )::numeric(12,2) AS salary_advance,

          SUM(
            CASE
              WHEN LOWER(COALESCE(lr.loan_type, '')) = 'motorcycle loan'
              THEN GREATEST(
                COALESCE(lr.total, lr.amount, 0) -
                (
                  GREATEST(
                    (
                      DATE_PART(
                        'year',
                        AGE((SELECT month_end FROM cutoff), COALESCE(lr.disbursement_date, lr.approved_at))
                      )::int * 12
                    ) +
                    DATE_PART(
                      'month',
                      AGE((SELECT month_end FROM cutoff), COALESCE(lr.disbursement_date, lr.approved_at))
                    )::int,
                    0
                  ) * COALESCE(lr.per_month, 0)
                ),
                0
              )
              ELSE 0
            END
          )::numeric(12,2) AS motorcycle_loan,

          SUM(
            CASE
              WHEN LOWER(COALESCE(lr.loan_type, '')) IN ('special loan', 'special advance')
              THEN GREATEST(
                COALESCE(lr.total, lr.amount, 0) -
                (
                  GREATEST(
                    (
                      DATE_PART(
                        'year',
                        AGE((SELECT month_end FROM cutoff), COALESCE(lr.disbursement_date, lr.approved_at))
                      )::int * 12
                    ) +
                    DATE_PART(
                      'month',
                      AGE((SELECT month_end FROM cutoff), COALESCE(lr.disbursement_date, lr.approved_at))
                    )::int,
                    0
                  ) * COALESCE(lr.per_month, 0)
                ),
                0
              )
              ELSE 0
            END
          )::numeric(12,2) AS special_advance,

          SUM(
            CASE
              WHEN LOWER(COALESCE(lr.loan_type, '')) IN ('cash loan', 'cash advance')
              THEN GREATEST(
                COALESCE(lr.total, lr.amount, 0) -
                (
                  GREATEST(
                    (
                      DATE_PART(
                        'year',
                        AGE((SELECT month_end FROM cutoff), COALESCE(lr.disbursement_date, lr.approved_at))
                      )::int * 12
                    ) +
                    DATE_PART(
                      'month',
                      AGE((SELECT month_end FROM cutoff), COALESCE(lr.disbursement_date, lr.approved_at))
                    )::int,
                    0
                  ) * COALESCE(lr.per_month, 0)
                ),
                0
              )
              ELSE 0
            END
          )::numeric(12,2) AS cash_advance

        FROM public.loan_requests lr
        CROSS JOIN cutoff c
        WHERE
          lr.staff_id IS NOT NULL
          AND LOWER(COALESCE(lr.status, '')) = 'approved'
          AND COALESCE(lr.disbursement_date, lr.approved_at) IS NOT NULL
          AND COALESCE(lr.disbursement_date, lr.approved_at) <= c.month_end
        GROUP BY lr.staff_id
      ),

      sap_remaining AS (
        SELECT
          sap.employee_no,
          SUM(COALESCE(sap.balance, sap.amount, 0))::numeric(12,2) AS staff_accounts_payable
        FROM public.staff_accounts_payable sap
        CROSS JOIN cutoff c
        WHERE
          sap.employee_no IS NOT NULL
          AND LOWER(COALESCE(sap.status, '')) = 'approved'
          AND COALESCE(sap.approved_at, sap.created_at) <= c.month_end
        GROUP BY sap.employee_no
      )

      SELECT
        s.id,
        s.id AS staff_id,
        s.employee_no,
        COALESCE(sb.fullname, s.fullname) AS fullname,
        COALESCE(sb.last_name, s.last_name) AS last_name,
        COALESCE(sb.first_name, s.first_name) AS first_name,
        COALESCE(sb.middle_name, s.middle_name) AS middle_name,
        COALESCE(sb.position, s.position) AS position,
        s.branch_id,

        COALESCE(sb.cbu, 0) AS cbu,
        COALESCE(sb.cashbond, 0) AS cashbond,
        COALESCE(sb.utility, 0) AS utility,

        COALESCE(lr.salary_loan, 0) AS salary_loan,
        COALESCE(lr.salary_advance, 0) AS salary_advance,
        COALESCE(lr.motorcycle_loan, 0) AS motorcycle_loan,
        COALESCE(lr.special_advance, 0) AS special_advance,
        COALESCE(lr.cash_advance, 0) AS cash_advance,

        COALESCE(sb.other_receivable, 0) AS other_receivable,
        COALESCE(sap.staff_accounts_payable, 0) AS staff_accounts_payable,

        (SELECT month_end FROM cutoff) AS as_of_date,
        NOW() AS created_at,
        NOW() AS updated_at
      FROM public.staff_balances sb
      LEFT JOIN public.staff s
        ON s.employee_no = sb.employee_no
      LEFT JOIN loan_remaining lr
        ON lr.staff_id = s.id
      LEFT JOIN sap_remaining sap
        ON sap.employee_no = s.employee_no
      ${whereSql}
      ORDER BY COALESCE(sb.fullname, s.fullname) ASC
    `;

    const result = await pool.query(sql, params);
    return res.json(result.rows);
  } catch (e) {
    console.error("GET /api/schedule-balances/live ERROR:", e);
    return res.status(500).json({ message: e.message || "Server error" });
  }
});

/* =========================================================
   SAVE SNAPSHOT FROM CURRENT
========================================================= */
router.post(
  "/snapshot/from-current",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    const snapshotMonth = monthToDate(req.body?.month);

    if (!snapshotMonth) {
      return res.status(400).json({ message: "month is required in YYYY-MM format" });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const current = await client.query(
        `
        WITH cutoff AS (
          SELECT
            $1::date AS month_start,
            ${monthEndExpr("$1")} AS month_end
        ),

        loan_remaining AS (
          SELECT
            lr.staff_id,

            SUM(
              CASE
                WHEN LOWER(COALESCE(lr.loan_type, '')) = 'salary loan'
                THEN GREATEST(
                  COALESCE(lr.total, lr.amount, 0) -
                  (
                    GREATEST(
                      (
                        DATE_PART(
                          'year',
                          AGE((SELECT month_end FROM cutoff), COALESCE(lr.disbursement_date, lr.approved_at))
                        )::int * 12
                      ) +
                      DATE_PART(
                        'month',
                        AGE((SELECT month_end FROM cutoff), COALESCE(lr.disbursement_date, lr.approved_at))
                      )::int,
                      0
                    ) * COALESCE(lr.per_month, 0)
                  ),
                  0
                )
                ELSE 0
              END
            )::numeric(12,2) AS salary_loan,

            SUM(
              CASE
                WHEN LOWER(COALESCE(lr.loan_type, '')) = 'salary advance'
                THEN GREATEST(
                  COALESCE(lr.total, lr.amount, 0) -
                  (
                    GREATEST(
                      (
                        DATE_PART(
                          'year',
                          AGE((SELECT month_end FROM cutoff), COALESCE(lr.disbursement_date, lr.approved_at))
                        )::int * 12
                      ) +
                      DATE_PART(
                        'month',
                        AGE((SELECT month_end FROM cutoff), COALESCE(lr.disbursement_date, lr.approved_at))
                      )::int,
                      0
                    ) * COALESCE(lr.per_month, 0)
                  ),
                  0
                )
                ELSE 0
              END
            )::numeric(12,2) AS salary_advance,

            SUM(
              CASE
                WHEN LOWER(COALESCE(lr.loan_type, '')) = 'motorcycle loan'
                THEN GREATEST(
                  COALESCE(lr.total, lr.amount, 0) -
                  (
                    GREATEST(
                      (
                        DATE_PART(
                          'year',
                          AGE((SELECT month_end FROM cutoff), COALESCE(lr.disbursement_date, lr.approved_at))
                        )::int * 12
                      ) +
                      DATE_PART(
                        'month',
                        AGE((SELECT month_end FROM cutoff), COALESCE(lr.disbursement_date, lr.approved_at))
                      )::int,
                      0
                    ) * COALESCE(lr.per_month, 0)
                  ),
                  0
                )
                ELSE 0
              END
            )::numeric(12,2) AS motorcycle_loan,

            SUM(
              CASE
                WHEN LOWER(COALESCE(lr.loan_type, '')) IN ('special loan', 'special advance')
                THEN GREATEST(
                  COALESCE(lr.total, lr.amount, 0) -
                  (
                    GREATEST(
                      (
                        DATE_PART(
                          'year',
                          AGE((SELECT month_end FROM cutoff), COALESCE(lr.disbursement_date, lr.approved_at))
                        )::int * 12
                      ) +
                      DATE_PART(
                        'month',
                        AGE((SELECT month_end FROM cutoff), COALESCE(lr.disbursement_date, lr.approved_at))
                      )::int,
                      0
                    ) * COALESCE(lr.per_month, 0)
                  ),
                  0
                )
                ELSE 0
              END
            )::numeric(12,2) AS special_advance,

            SUM(
              CASE
                WHEN LOWER(COALESCE(lr.loan_type, '')) IN ('cash loan', 'cash advance')
                THEN GREATEST(
                  COALESCE(lr.total, lr.amount, 0) -
                  (
                    GREATEST(
                      (
                        DATE_PART(
                          'year',
                          AGE((SELECT month_end FROM cutoff), COALESCE(lr.disbursement_date, lr.approved_at))
                        )::int * 12
                      ) +
                      DATE_PART(
                        'month',
                        AGE((SELECT month_end FROM cutoff), COALESCE(lr.disbursement_date, lr.approved_at))
                      )::int,
                      0
                    ) * COALESCE(lr.per_month, 0)
                  ),
                  0
                )
                ELSE 0
              END
            )::numeric(12,2) AS cash_advance

          FROM public.loan_requests lr
          CROSS JOIN cutoff c
          WHERE
            lr.staff_id IS NOT NULL
            AND LOWER(COALESCE(lr.status, '')) = 'approved'
            AND COALESCE(lr.disbursement_date, lr.approved_at) IS NOT NULL
            AND COALESCE(lr.disbursement_date, lr.approved_at) <= c.month_end
          GROUP BY lr.staff_id
        ),

        sap_remaining AS (
          SELECT
            sap.employee_no,
            SUM(COALESCE(sap.balance, sap.amount, 0))::numeric(12,2) AS staff_accounts_payable
          FROM public.staff_accounts_payable sap
          CROSS JOIN cutoff c
          WHERE
            sap.employee_no IS NOT NULL
            AND LOWER(COALESCE(sap.status, '')) = 'approved'
            AND COALESCE(sap.approved_at, sap.created_at) <= c.month_end
          GROUP BY sap.employee_no
        )

        SELECT
          s.id AS staff_id,
          s.employee_no,
          COALESCE(sb.fullname, s.fullname) AS fullname,
          COALESCE(sb.last_name, s.last_name) AS last_name,
          COALESCE(sb.first_name, s.first_name) AS first_name,
          COALESCE(sb.middle_name, s.middle_name) AS middle_name,
          COALESCE(sb.position, s.position) AS position,
          s.branch_id,

          COALESCE(sb.cbu, 0) AS cbu,
          COALESCE(sb.cashbond, 0) AS cashbond,
          COALESCE(sb.utility, 0) AS utility,

          COALESCE(lr.salary_loan, 0) AS salary_loan,
          COALESCE(lr.salary_advance, 0) AS salary_advance,
          COALESCE(lr.motorcycle_loan, 0) AS motorcycle_loan,
          COALESCE(lr.special_advance, 0) AS special_advance,
          COALESCE(lr.cash_advance, 0) AS cash_advance,

          COALESCE(sb.other_receivable, 0) AS other_receivable,
          COALESCE(sap.staff_accounts_payable, 0) AS staff_accounts_payable
        FROM public.staff_balances sb
        LEFT JOIN public.staff s
          ON s.employee_no = sb.employee_no
        LEFT JOIN loan_remaining lr
          ON lr.staff_id = s.id
        LEFT JOIN sap_remaining sap
          ON sap.employee_no = s.employee_no
        ORDER BY COALESCE(sb.fullname, s.fullname) ASC
        `,
        [snapshotMonth]
      );

      const rows = current.rows || [];

      for (const r of rows) {
        const staff_id = Number(r.staff_id);
        if (!staff_id) continue;

        await client.query(
          `
          INSERT INTO public.schedule_balance_snapshots (
            snapshot_month,
            staff_id,
            employee_no,
            fullname,
            position,
            branch_id,
            last_name,
            first_name,
            middle_name,
            cbu,
            cashbond,
            utility,
            salary_loan,
            salary_advance,
            motorcycle_loan,
            special_advance,
            cash_advance,
            other_receivable,
            staff_accounts_payable,
            created_at,
            updated_at
          )
          VALUES (
            $1::date,
            $2::int,
            $3::varchar,
            $4::varchar,
            $5::varchar,
            $6::int,
            $7::varchar,
            $8::varchar,
            $9::varchar,
            $10::numeric,
            $11::numeric,
            $12::numeric,
            $13::numeric,
            $14::numeric,
            $15::numeric,
            $16::numeric,
            $17::numeric,
            $18::numeric,
            $19::numeric,
            NOW(),
            NOW()
          )
          ON CONFLICT (snapshot_month, staff_id)
          DO UPDATE SET
            employee_no = EXCLUDED.employee_no,
            fullname = EXCLUDED.fullname,
            position = EXCLUDED.position,
            branch_id = EXCLUDED.branch_id,
            last_name = EXCLUDED.last_name,
            first_name = EXCLUDED.first_name,
            middle_name = EXCLUDED.middle_name,
            cbu = EXCLUDED.cbu,
            cashbond = EXCLUDED.cashbond,
            utility = EXCLUDED.utility,
            salary_loan = EXCLUDED.salary_loan,
            salary_advance = EXCLUDED.salary_advance,
            motorcycle_loan = EXCLUDED.motorcycle_loan,
            special_advance = EXCLUDED.special_advance,
            cash_advance = EXCLUDED.cash_advance,
            other_receivable = EXCLUDED.other_receivable,
            staff_accounts_payable = EXCLUDED.staff_accounts_payable,
            updated_at = NOW()
          `,
          [
            snapshotMonth,
            staff_id,
            r.employee_no || null,
            String(r.fullname || ""),
            String(r.position || ""),
            r.branch_id ? Number(r.branch_id) : null,
            r.last_name || null,
            r.first_name || null,
            r.middle_name || null,
            toNum(r.cbu),
            toNum(r.cashbond),
            toNum(r.utility),
            toNum(r.salary_loan),
            toNum(r.salary_advance),
            toNum(r.motorcycle_loan),
            toNum(r.special_advance),
            toNum(r.cash_advance),
            toNum(r.other_receivable),
            toNum(r.staff_accounts_payable),
          ]
        );
      }

      await client.query("COMMIT");
      return res.json({
        message: "Snapshot saved from month-end live balances",
        month: snapshotMonth,
        count: rows.length,
      });
    } catch (e) {
      try {
        await client.query("ROLLBACK");
      } catch {}
      console.error("POST /api/schedule-balances/snapshot/from-current ERROR:", e);
      return res.status(500).json({ message: e.message || "Server error" });
    } finally {
      client.release();
    }
  }
);

module.exports = router;