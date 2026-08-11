const express = require("express");
const router = express.Router();
const pool = require("../db");

const { requireAuth } = require("../middlewares/authMiddleware");
const { requirePermission } = require("../middlewares/permissionMiddleware");

const toNum = (v) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const toInt = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

const toStr = (v) => String(v ?? "").trim();

const monthToDate = (monthStr) => {
  const m = toStr(monthStr);
  if (!/^\d{4}-\d{2}$/.test(m)) return null;
  return `${m}-01`;
};

const monthEndExpr = (paramRef) =>
  `((DATE_TRUNC('month', ${paramRef}::date) + INTERVAL '1 month - 1 day')::date)`;

const normRole = (v) => String(v || "").trim().toLowerCase();

const resolveRequestedBranchId = async (rawBranchValue) => {
  const raw = toStr(rawBranchValue);
  if (!raw) return null;

  const asInt = toInt(raw);
  if (asInt) return asInt;

  const byCode = await pool.query(
    `
    SELECT id
    FROM public.branches
    WHERE LOWER(TRIM(code)) = LOWER(TRIM($1))
    LIMIT 1
    `,
    [raw]
  );

  if (byCode.rowCount > 0) return Number(byCode.rows[0].id);
  return null;
};

const resolveBranchScope = async (req) => {
  const role = normRole(req.user?.role);
  const requestedRaw = toStr(req.query.branchId);
  const userBranchRaw = toStr(req.user?.branch_id);
  const userAreaRaw = toStr(req.user?.area);

  const requestedBranchId = await resolveRequestedBranchId(requestedRaw);

  if (role === "branch manager") {
    if (!userBranchRaw) {
      return {
        error: { status: 403, message: "Access denied: no branch assigned." },
      };
    }

    const userBranchId = await resolveRequestedBranchId(userBranchRaw);

    if (!userBranchId) {
      return {
        error: { status: 403, message: "Invalid branch mapping." },
      };
    }

    if (requestedRaw && requestedBranchId && requestedBranchId !== userBranchId) {
      return {
        error: { status: 403, message: "Access denied: invalid branch." },
      };
    }

    return { branchId: userBranchId };
  }

  if (role === "area manager") {
    if (!userAreaRaw) {
      return {
        error: { status: 403, message: "Access denied: no area assigned." },
      };
    }

    const branchRes = await pool.query(
      `
      SELECT id
      FROM public.branches
      WHERE LOWER(TRIM(area)) = LOWER(TRIM($1))
      `,
      [userAreaRaw]
    );

    return { branchIds: branchRes.rows.map((r) => Number(r.id)) };
  }

  return { branchId: requestedBranchId };
};

const buildLiveSql = (whereSql = "") => `
  WITH cutoff AS (
    SELECT
      $1::date AS month_start,
      ${monthEndExpr("$1")} AS month_end,
      ($1::date + INTERVAL '24 days')::date AS posting_date
  ),

  eligible_loans AS (
    SELECT
      lr.*,

      CASE
        WHEN COALESCE(
          lr.disbursement_date,
          lr.approved_at
        )::date
        <=
        (
          DATE_TRUNC(
            'month',
            COALESCE(
              lr.disbursement_date,
              lr.approved_at
            )::date
          )
          + INTERVAL '24 days'
        )::date

        THEN
        (
          DATE_TRUNC(
            'month',
            COALESCE(
              lr.disbursement_date,
              lr.approved_at
            )::date
          )
          + INTERVAL '24 days'
        )::date

        ELSE
        (
          DATE_TRUNC(
            'month',
            COALESCE(
              lr.disbursement_date,
              lr.approved_at
            )::date
          )
          + INTERVAL '1 month'
          + INTERVAL '24 days'
        )::date
      END AS first_deduction_date

    FROM public.loan_requests lr

    WHERE
      lr.staff_id IS NOT NULL
      AND LOWER(TRIM(COALESCE(lr.status, ''))) = 'approved'
      AND COALESCE(
        lr.disbursement_date,
        lr.approved_at
      ) IS NOT NULL
  ),

    loan_remaining AS (
      SELECT
        lr.staff_id,

        SUM(
          CASE
            WHEN LOWER(TRIM(COALESCE(lr.loan_type, ''))) = 'salary loan'
            THEN GREATEST(
              COALESCE(
                lr.approved_total,
                lr.total,
                lr.approved_amount,
                lr.amount,
                0
              )
              -
              (
                CASE
                  WHEN c.posting_date < lr.first_deduction_date
                  THEN 0
                  ELSE
                    (
                      (
                        EXTRACT(
                          YEAR FROM c.posting_date
                        )::int
                        -
                        EXTRACT(
                          YEAR FROM lr.first_deduction_date
                        )::int
                      ) * 12
                      +
                      (
                        EXTRACT(
                          MONTH FROM c.posting_date
                        )::int
                        -
                        EXTRACT(
                          MONTH FROM lr.first_deduction_date
                        )::int
                      )
                      + 1
                    )
                END
                *
                COALESCE(
                  lr.approved_per_month,
                  lr.per_month,
                  0
                )
              ),
              0
            )
            ELSE 0
          END
        )::numeric(12,2) AS salary_loan,

        SUM(
          CASE
            WHEN LOWER(TRIM(COALESCE(lr.loan_type, ''))) = 'salary advance'
            THEN GREATEST(
              COALESCE(
                lr.approved_total,
                lr.total,
                lr.approved_amount,
                lr.amount,
                0
              )
              -
              (
                CASE
                  WHEN c.posting_date < lr.first_deduction_date
                  THEN 0
                  ELSE
                    (
                      (
                        EXTRACT(
                          YEAR FROM c.posting_date
                        )::int
                        -
                        EXTRACT(
                          YEAR FROM lr.first_deduction_date
                        )::int
                      ) * 12
                      +
                      (
                        EXTRACT(
                          MONTH FROM c.posting_date
                        )::int
                        -
                        EXTRACT(
                          MONTH FROM lr.first_deduction_date
                        )::int
                      )
                      + 1
                    )
                END
                *
                COALESCE(
                  lr.approved_per_month,
                  lr.per_month,
                  0
                )
              ),
              0
            )
            ELSE 0
          END
        )::numeric(12,2) AS salary_advance,

        SUM(
          CASE
            WHEN LOWER(TRIM(COALESCE(lr.loan_type, ''))) = 'motorcycle loan'
            THEN GREATEST(
              COALESCE(
                lr.approved_total,
                lr.total,
                lr.approved_amount,
                lr.amount,
                0
              )
              -
              (
                CASE
                  WHEN c.posting_date < lr.first_deduction_date
                  THEN 0
                  ELSE
                    (
                      (
                        EXTRACT(
                          YEAR FROM c.posting_date
                        )::int
                        -
                        EXTRACT(
                          YEAR FROM lr.first_deduction_date
                        )::int
                      ) * 12
                      +
                      (
                        EXTRACT(
                          MONTH FROM c.posting_date
                        )::int
                        -
                        EXTRACT(
                          MONTH FROM lr.first_deduction_date
                        )::int
                      )
                      + 1
                    )
                END
                *
                COALESCE(
                  lr.approved_per_month,
                  lr.per_month,
                  0
                )
              ),
              0
            )
            ELSE 0
          END
        )::numeric(12,2) AS motorcycle_loan,

        SUM(
          CASE
            WHEN LOWER(TRIM(COALESCE(lr.loan_type, ''))) IN (
              'special loan',
              'special advance'
            )
            THEN GREATEST(
              COALESCE(
                lr.approved_total,
                lr.total,
                lr.approved_amount,
                lr.amount,
                0
              )
              -
              (
                CASE
                  WHEN c.posting_date < lr.first_deduction_date
                  THEN 0
                  ELSE
                    (
                      (
                        EXTRACT(
                          YEAR FROM c.posting_date
                        )::int
                        -
                        EXTRACT(
                          YEAR FROM lr.first_deduction_date
                        )::int
                      ) * 12
                      +
                      (
                        EXTRACT(
                          MONTH FROM c.posting_date
                        )::int
                        -
                        EXTRACT(
                          MONTH FROM lr.first_deduction_date
                        )::int
                      )
                      + 1
                    )
                END
                *
                COALESCE(
                  lr.approved_per_month,
                  lr.per_month,
                  0
                )
              ),
              0
            )
            ELSE 0
          END
        )::numeric(12,2) AS special_advance,

        SUM(
          CASE
            WHEN LOWER(TRIM(COALESCE(lr.loan_type, ''))) IN (
              'cash loan',
              'cash advance'
            )
            THEN GREATEST(
              COALESCE(
                lr.approved_total,
                lr.total,
                lr.approved_amount,
                lr.amount,
                0
              )
              -
              (
                CASE
                  WHEN c.posting_date < lr.first_deduction_date
                  THEN 0
                  ELSE
                    (
                      (
                        EXTRACT(
                          YEAR FROM c.posting_date
                        )::int
                        -
                        EXTRACT(
                          YEAR FROM lr.first_deduction_date
                        )::int
                      ) * 12
                      +
                      (
                        EXTRACT(
                          MONTH FROM c.posting_date
                        )::int
                        -
                        EXTRACT(
                          MONTH FROM lr.first_deduction_date
                        )::int
                      )
                      + 1
                    )
                END
                *
                COALESCE(
                  lr.approved_per_month,
                  lr.per_month,
                  0
                )
              ),
              0
            )
            ELSE 0
          END
        )::numeric(12,2) AS cash_advance

      FROM eligible_loans lr
      CROSS JOIN cutoff c

      WHERE
        COALESCE(
          lr.disbursement_date,
          lr.approved_at
        )::date <= c.posting_date

      GROUP BY lr.staff_id
    ),

  opening_loan_remaining AS (
    SELECT
      ob.staff_id,

      SUM(
        CASE
          WHEN LOWER(TRIM(COALESCE(ob.loan_type, ''))) = 'salary advance'
          THEN GREATEST(
            COALESCE(
              ob.remaining_balance,
              ob.total_amount,
              ob.original_amount,
              0
            ),
            0
          )
          ELSE 0
        END
      )::numeric(12,2) AS opening_salary_advance,

      SUM(
        CASE
          WHEN LOWER(TRIM(COALESCE(ob.loan_type, ''))) = 'motorcycle loan'
          THEN GREATEST(
            COALESCE(
              ob.remaining_balance,
              ob.total_amount,
              ob.original_amount,
              0
            ),
            0
          )
          ELSE 0
        END
      )::numeric(12,2) AS opening_motorcycle_loan,

      SUM(
        CASE
          WHEN LOWER(TRIM(COALESCE(ob.loan_type, ''))) IN (
            'special advance',
            'special loan'
          )
          THEN GREATEST(
            COALESCE(
              ob.remaining_balance,
              ob.total_amount,
              ob.original_amount,
              0
            ),
            0
          )
          ELSE 0
        END
      )::numeric(12,2) AS opening_special_advance,

      SUM(
        CASE
          WHEN LOWER(TRIM(COALESCE(ob.loan_type, ''))) IN (
            'cash advance',
            'cash loan'
          )
          THEN GREATEST(
            COALESCE(
              ob.remaining_balance,
              ob.total_amount,
              ob.original_amount,
              0
            ),
            0
          )
          ELSE 0
        END
      )::numeric(12,2) AS opening_cash_advance

    FROM public.staff_loan_opening_balances ob
    CROSS JOIN cutoff c

    WHERE
      ob.staff_id IS NOT NULL
      AND LOWER(TRIM(COALESCE(ob.status, ''))) = 'active'
      AND COALESCE(ob.effective_date, ob.start_date) <= c.posting_date

    GROUP BY ob.staff_id
  ),

  sap_payable AS (
    SELECT
      sap.employee_no,

      SUM(
        GREATEST(
          COALESCE(sap.balance, sap.amount, 0),
          0
        )
      )::numeric(12,2) AS staff_accounts_payable

    FROM public.staff_accounts_payable sap
    CROSS JOIN cutoff c

    WHERE
      sap.employee_no IS NOT NULL

      AND LOWER(
        TRIM(
          COALESCE(sap.status, '')
        )
      ) = 'approved'

      AND COALESCE(
        sap.release_date,
        sap.approved_at,
        sap.created_at
      ) <= c.posting_date

    GROUP BY sap.employee_no
  ),

  other_receivable_amount AS (
    SELECT
      ore.employee_no,

      SUM(
        GREATEST(
          COALESCE(ore.amount, 0)
          -
          (
            GREATEST(
              (
                DATE_PART(
                  'year',
                  AGE(
                    c.posting_date,
                    COALESCE(
                      ore.deduction_start_date,
                      ore.release_date,
                      ore.approved_at,
                      ore.created_at
                    )
                  )
                )::int * 12
              )
              +
              DATE_PART(
                'month',
                AGE(
                  c.posting_date,
                  COALESCE(
                    ore.deduction_start_date,
                    ore.release_date,
                    ore.approved_at,
                    ore.created_at
                  )
                )
              )::int,
              0
            )
            * COALESCE(ore.per_month, 0)
          ),
          0
        )
      )::numeric(12,2) AS other_receivable

    FROM public.other_receivables ore
    CROSS JOIN cutoff c

    WHERE
      ore.employee_no IS NOT NULL
      AND LOWER(TRIM(COALESCE(ore.status, ''))) = 'approved'

      AND COALESCE(
        ore.deduction_start_date,
        ore.release_date,
        ore.approved_at,
        ore.created_at
      ) <= c.posting_date

    GROUP BY ore.employee_no
  ),

  monthly_posted_balances AS (
    SELECT
      employee_no,
      SUM(COALESCE(cbu, 0))::numeric(12,2) AS cbu,
      SUM(COALESCE(cashbond, 0))::numeric(12,2) AS cashbond,
      SUM(COALESCE(utility, 0))::numeric(12,2) AS utility
    FROM public.monthly_balance_postings
    WHERE month_label <= TO_CHAR((SELECT month_end FROM cutoff), 'YYYY-MM')
    GROUP BY employee_no
  )

  SELECT
    s.id,
    s.id AS staff_id,
    s.employee_no,
    COALESCE(s.fullname, CONCAT_WS(' ', s.last_name, s.first_name, s.middle_name)) AS fullname,
    s.last_name,
    s.first_name,
    s.middle_name,
    s.position,
    s.branch_id,

    COALESCE(sb.cbu, mbp.cbu, 0) AS cbu,
    COALESCE(sb.cashbond, mbp.cashbond, 0) AS cashbond,
    COALESCE(sb.utility, mbp.utility, 0) AS utility,

    COALESCE(lr.salary_loan, 0) AS salary_loan,
    COALESCE(lr.salary_advance, 0) + COALESCE(olr.opening_salary_advance, 0) AS salary_advance,
    COALESCE(lr.motorcycle_loan, 0) + COALESCE(olr.opening_motorcycle_loan, 0) AS motorcycle_loan,
    COALESCE(lr.special_advance, 0) + COALESCE(olr.opening_special_advance, 0) AS special_advance,
    COALESCE(lr.cash_advance, 0) + COALESCE(olr.opening_cash_advance, 0) AS cash_advance,

    COALESCE(ore.other_receivable, 0) AS other_receivable,
    COALESCE(sap.staff_accounts_payable, 0) AS staff_accounts_payable,

    (SELECT month_end FROM cutoff) AS as_of_date,
    NOW() AS created_at,
    NOW() AS updated_at

  FROM public.staff s
  LEFT JOIN public.staff_balances sb
    ON sb.employee_no = s.employee_no
  LEFT JOIN monthly_posted_balances mbp
    ON mbp.employee_no = s.employee_no
  LEFT JOIN loan_remaining lr
    ON lr.staff_id = s.id
  LEFT JOIN opening_loan_remaining olr
    ON olr.staff_id = s.id
  LEFT JOIN other_receivable_amount ore
    ON ore.employee_no = s.employee_no
  LEFT JOIN sap_payable sap
    ON sap.employee_no = s.employee_no
  ${whereSql}
  ORDER BY COALESCE(s.fullname, CONCAT_WS(' ', s.last_name, s.first_name, s.middle_name)) ASC
`;

router.get(
  "/",
  requireAuth,
  requirePermission("schedule_balance", "view"),
  async (req, res) => {
    try {
      const snapshotMonth = monthToDate(req.query.month);

      if (!snapshotMonth) {
        return res.status(400).json({
          message: "month is required in YYYY-MM format",
        });
      }

      const scope = await resolveBranchScope(req);

      if (scope.error) {
        return res.status(scope.error.status).json({
          message: scope.error.message,
        });
      }

      const params = [snapshotMonth];

      let sql = `
        SELECT
          id,
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
        FROM public.schedule_balance_snapshots
        WHERE snapshot_month = $1::date
      `;

      if (scope.branchIds) {
        params.push(scope.branchIds);
        sql += ` AND branch_id = ANY($2::int[])`;
      } else if (scope.branchId) {
        params.push(scope.branchId);
        sql += ` AND branch_id = $2::int`;
      }

      sql += ` ORDER BY fullname ASC`;

      const result = await pool.query(sql, params);
      return res.json(result.rows);
    } catch (e) {
      console.error("GET /api/schedule-balances ERROR:", e);
      return res.status(500).json({ message: e.message || "Server error" });
    }
  }
);

router.get(
  "/live",
  requireAuth,
  requirePermission("schedule_balance", "view"),
  async (req, res) => {
    try {
      const snapshotMonth = monthToDate(req.query.month);

      if (!snapshotMonth) {
        return res.status(400).json({
          message: "month is required in YYYY-MM format",
        });
      }

      const scope = await resolveBranchScope(req);

      if (scope.error) {
        return res.status(scope.error.status).json({
          message: scope.error.message,
        });
      }

      const params = [snapshotMonth];
      let whereSql = "";

      if (scope.branchIds) {
        params.push(scope.branchIds);
        whereSql = ` WHERE s.branch_id = ANY($2::int[]) `;
      } else if (scope.branchId) {
        params.push(scope.branchId);
        whereSql = ` WHERE s.branch_id = $2::int `;
      } else {
        whereSql = ` WHERE LOWER(COALESCE(s.status, 'active')) = 'active' `;
      }

      if (whereSql && !whereSql.toLowerCase().includes("status")) {
        whereSql += ` AND LOWER(COALESCE(s.status, 'active')) = 'active' `;
      }

      const sql = buildLiveSql(whereSql);
      const result = await pool.query(sql, params);

      return res.json(result.rows);
    } catch (e) {
      console.error("GET /api/schedule-balances/live ERROR:", e);
      return res.status(500).json({ message: e.message || "Server error" });
    }
  }
);

// =====================================================
// UPDATE CURRENT CBU, CASHBOND, AND UTILITY
// =====================================================

router.get(
  "/staff/:staffId/yearly-savings",
  requireAuth,
  requirePermission("schedule_balance", "view"),
  async (req, res) => {
    try {
      const staffId = toInt(req.params.staffId);
      const year = toInt(req.query.year);

      if (!staffId) {
        return res.status(400).json({
          message: "Invalid staff ID",
        });
      }

      if (!year || year < 2000 || year > 2100) {
        return res.status(400).json({
          message: "Invalid year",
        });
      }

      const scope = await resolveBranchScope(req);

      if (scope.error) {
        return res.status(scope.error.status).json({
          message: scope.error.message,
        });
      }

      const staffParams = [staffId];

      let staffSql = `
        SELECT
          id,
          employee_no,
          COALESCE(
            NULLIF(TRIM(fullname),''),
            NULLIF(
              TRIM(CONCAT_WS(' ',
                last_name,
                first_name,
                middle_name
              )),
              ''
            ),
            employee_no
          ) AS fullname,
          position,
          branch_id
        FROM public.staff
        WHERE id = $1
      `;

      if (scope.branchIds) {
        staffParams.push(scope.branchIds);
        staffSql += ` AND branch_id = ANY($2::int[])`;
      } else if (scope.branchId) {
        staffParams.push(scope.branchId);
        staffSql += ` AND branch_id = $2::int`;
      }

      staffSql += ` LIMIT 1`;

      const staffResult = await pool.query(
        staffSql,
        staffParams
      );

      if (!staffResult.rowCount) {
        return res.status(404).json({
          message: "Staff not found."
        });
      }

      const staff = staffResult.rows[0];

      const result = await pool.query(
        `
        WITH months AS (

            SELECT
                month_number,
                MAKE_DATE($2, month_number, 1) AS month_date

            FROM generate_series(1,12) month_number

        ),

        historical AS (

            SELECT
                id AS snapshot_id,
                snapshot_month,
                cbu,
                cashbond,
                utility

            FROM public.schedule_balance_snapshots

            WHERE
                staff_id = $1
            AND EXTRACT(YEAR FROM snapshot_month)= $2

        ),

        current_balance AS (

            SELECT
                cbu,
                cashbond,
                utility

            FROM public.staff_balances

            WHERE employee_no = $3

            LIMIT 1

        ),

        today_cte AS (

            SELECT
                DATE_TRUNC(
                    'month',
                    NOW() AT TIME ZONE 'Asia/Manila'
                )::date AS current_month

        )

        SELECT

            m.month_number,

            TO_CHAR(
                m.month_date,
                'YYYY-MM'
            ) AS month_label,

            TRIM(
                TO_CHAR(
                    m.month_date,
                    'Month'
                )
            ) AS month_name,

            m.month_date,

            h.snapshot_id,

            CASE

                WHEN m.month_date >
                    (
                        SELECT current_month
                        FROM today_cte
                    )
                THEN NULL

                WHEN m.month_date =
                    (
                        SELECT current_month
                        FROM today_cte
                    )
                THEN COALESCE(
                    (
                        SELECT cbu
                        FROM current_balance
                    ),
                    h.cbu,
                    0
                )

                ELSE h.cbu

            END AS cbu,

            CASE

                WHEN m.month_date >
                    (
                        SELECT current_month
                        FROM today_cte
                    )
                THEN NULL

                WHEN m.month_date =
                    (
                        SELECT current_month
                        FROM today_cte
                    )
                THEN COALESCE(
                    (
                        SELECT cashbond
                        FROM current_balance
                    ),
                    h.cashbond,
                    0
                )

                ELSE h.cashbond

            END AS cashbond,

            CASE

                WHEN m.month_date >
                    (
                        SELECT current_month
                        FROM today_cte
                    )
                THEN NULL

                WHEN m.month_date =
                    (
                        SELECT current_month
                        FROM today_cte
                    )
                THEN COALESCE(
                    (
                        SELECT utility
                        FROM current_balance
                    ),
                    h.utility,
                    0
                )

                ELSE h.utility

            END AS utility,

            CASE

                WHEN m.month_date >
                    (
                        SELECT current_month
                        FROM today_cte
                    )
                THEN 'future'

                WHEN m.month_date =
                    (
                        SELECT current_month
                        FROM today_cte
                    )
                THEN 'current'

                WHEN h.snapshot_id IS NOT NULL
                THEN 'historical'

                ELSE 'missing'

            END AS balance_source

        FROM months m

        LEFT JOIN historical h
            ON h.snapshot_month = m.month_date

        ORDER BY
            m.month_number
        `,
        [
          staffId,
          year,
          staff.employee_no,
        ]
      );

      return res.json({
        staff,
        year,
        months: result.rows,
      });

    } catch (error) {

      console.error(
        "GET yearly-savings ERROR:",
        error
      );

      return res.status(500).json({
        message:
          error.message ||
          "Failed to load yearly savings",
      });

    }
  }
);

// =====================================================
// UPDATE CURRENT CBU, CASHBOND, AND UTILITY
// =====================================================

router.put(
  "/current/:staffId/manual-edit",
  requireAuth,
  requirePermission("schedule_balance", "edit"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const staffId = toInt(req.params.staffId);
      const cbu = Number(req.body?.cbu);
      const cashbond = Number(req.body?.cashbond);
      const utility = Number(req.body?.utility);

      if (!staffId) {
        return res.status(400).json({
          message: "Invalid staff ID",
        });
      }

      if (
        !Number.isFinite(cbu) ||
        !Number.isFinite(cashbond) ||
        !Number.isFinite(utility)
      ) {
        return res.status(400).json({
          message:
            "CBU, Cashbond, and Utility must be valid numbers",
        });
      }

      if (cbu < 0 || cashbond < 0 || utility < 0) {
        return res.status(400).json({
          message:
            "CBU, Cashbond, and Utility cannot be negative",
        });
      }

      await client.query("BEGIN");

      const staffResult = await client.query(
        `
        SELECT
          id,
          employee_no,
          fullname,
          position,
          branch_id
        FROM public.staff
        WHERE id = $1
        LIMIT 1
        FOR UPDATE
        `,
        [staffId]
      );

      if (!staffResult.rowCount) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          message: "Staff not found",
        });
      }

      const staff = staffResult.rows[0];

      if (!toStr(staff.employee_no)) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message:
            "Staff employee number is missing.",
        });
      }

      const updatedResult = await client.query(
        `
        INSERT INTO public.staff_balances
        (
          employee_no,
          fullname,
          position,
          cbu,
          cashbond,
          utility,
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
          NOW(),
          NOW()
        )

        ON CONFLICT (employee_no)
        DO UPDATE SET
          fullname = COALESCE(
            NULLIF(EXCLUDED.fullname, ''),
            public.staff_balances.fullname
          ),

          position = COALESCE(
            NULLIF(EXCLUDED.position, ''),
            public.staff_balances.position
          ),

          cbu = EXCLUDED.cbu,
          cashbond = EXCLUDED.cashbond,
          utility = EXCLUDED.utility,
          updated_at = NOW()

        RETURNING *
        `,
        [
          staff.employee_no,
          toStr(staff.fullname) || null,
          toStr(staff.position) || null,
          cbu,
          cashbond,
          utility,
        ]
      );

      await client.query("COMMIT");

      return res.json({
        message:
          "Current staff balance updated successfully",
        balance: updatedResult.rows[0],
      });
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {}

      console.error(
        "PUT /api/schedule-balances/current/:staffId/manual-edit ERROR:",
        error
      );

      return res.status(500).json({
        message:
          error.message ||
          "Failed to update current staff balance",
      });
    } finally {
      client.release();
    }
  }
);

router.put(
  "/snapshot/:id/manual-edit",
  requireAuth,
  requirePermission("schedule_balance", "edit"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const id = toInt(req.params.id);
      const cbu = toNum(req.body?.cbu);
      const cashbond = toNum(req.body?.cashbond);
      const utility = toNum(req.body?.utility);
      

      if (!id) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: "Invalid snapshot id",
        });
      }

      if (cbu < 0 || cashbond < 0 || utility < 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: "CBU, Cashbond, and Utility cannot be negative",
        });
      }

      const current = await client.query(
        `
        SELECT *
        FROM public.schedule_balance_snapshots
        WHERE id = $1
        FOR UPDATE
        `,
        [id]
      );

      if (current.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          message: "Historical snapshot not found",
        });
      }

      const old = current.rows[0];

      await client.query(
        `
        INSERT INTO public.schedule_balance_snapshot_history
        (
          snapshot_id,
          snapshot_month,
          staff_id,
          employee_no,
          old_cbu,
          new_cbu,
          old_cashbond,
          new_cashbond,
          old_utility,
          new_utility,
          edited_by,
          edited_at
        )
        VALUES
        (
        $1,$2,$3,$4,
        $5,$6,
        $7,$8,
        $9,$10,
        $11,
        NOW()
        )
        `,
        [
          old.id,
          old.snapshot_month,
          old.staff_id,
          old.employee_no,
          toNum(old.cbu),
          cbu,
          toNum(old.cashbond),
          cashbond,
          toNum(old.utility),
          utility,
          req.user?.id ?? null,
        ]
      );

      const updated = await client.query(
        `
        UPDATE public.schedule_balance_snapshots
        SET
          cbu = $2,
          cashbond = $3,
          utility = $4,
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
        `,
        [id, cbu, cashbond, utility]
      );

      await client.query("COMMIT");

      return res.json({
        message: "Historical balance corrected successfully",
        snapshot: updated.rows[0],
      });
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch {}

      console.error(
        "PUT /api/schedule-balances/snapshot/:id/manual-edit ERROR:",
        err
      );

      return res.status(500).json({
        message: err.message || "Failed to edit historical balance",
      });
    } finally {
      client.release();
    }
  }
);

module.exports = router;