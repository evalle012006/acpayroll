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

  opening_loan_remaining AS (
    SELECT
      ob.staff_id,

      SUM(
        CASE WHEN LOWER(COALESCE(ob.loan_type, '')) = 'salary advance'
        THEN COALESCE(ob.remaining_balance, 0) ELSE 0 END
      )::numeric(12,2) AS opening_salary_advance,

      SUM(
        CASE WHEN LOWER(COALESCE(ob.loan_type, '')) = 'motorcycle loan'
        THEN COALESCE(ob.remaining_balance, 0) ELSE 0 END
      )::numeric(12,2) AS opening_motorcycle_loan,

      SUM(
        CASE WHEN LOWER(COALESCE(ob.loan_type, '')) = 'special advance'
        THEN COALESCE(ob.remaining_balance, 0) ELSE 0 END
      )::numeric(12,2) AS opening_special_advance,

      SUM(
        CASE WHEN LOWER(COALESCE(ob.loan_type, '')) = 'cash advance'
        THEN COALESCE(ob.remaining_balance, 0) ELSE 0 END
      )::numeric(12,2) AS opening_cash_advance

    FROM public.staff_loan_opening_balances ob
    CROSS JOIN cutoff c
    WHERE
      ob.staff_id IS NOT NULL
      AND LOWER(COALESCE(ob.status, '')) = 'active'
      AND (ob.effective_date IS NULL OR ob.effective_date <= c.month_end)
    GROUP BY ob.staff_id
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
    COALESCE(s.fullname, CONCAT_WS(' ', s.last_name, s.first_name, s.middle_name)) AS fullname,
    s.last_name,
    s.first_name,
    s.middle_name,
    s.position,
    s.branch_id,

    COALESCE(sb.cbu, 0) AS cbu,
    COALESCE(sb.cashbond, 0) AS cashbond,
    COALESCE(sb.utility, 0) AS utility,

    COALESCE(lr.salary_loan, 0) AS salary_loan,
    COALESCE(lr.salary_advance, 0) + COALESCE(olr.opening_salary_advance, 0) AS salary_advance,
    COALESCE(lr.motorcycle_loan, 0) + COALESCE(olr.opening_motorcycle_loan, 0) AS motorcycle_loan,
    COALESCE(lr.special_advance, 0) + COALESCE(olr.opening_special_advance, 0) AS special_advance,
    COALESCE(lr.cash_advance, 0) + COALESCE(olr.opening_cash_advance, 0) AS cash_advance,

    COALESCE(sb.other_receivable, 0) AS other_receivable,
    COALESCE(sap.staff_accounts_payable, COALESCE(sb.staff_accounts_payable, 0), 0) AS staff_accounts_payable,

    (SELECT month_end FROM cutoff) AS as_of_date,
    NOW() AS created_at,
    NOW() AS updated_at

  FROM public.staff s
  LEFT JOIN public.staff_balances sb
    ON sb.employee_no = s.employee_no
  LEFT JOIN loan_remaining lr
    ON lr.staff_id = s.id
  LEFT JOIN opening_loan_remaining olr
    ON olr.staff_id = s.id
  LEFT JOIN sap_remaining sap
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

router.post(
  "/deduct",
  requireAuth,
  requirePermission("schedule_balance", "edit"),
  async (req, res) => {
    try {
      const { staff_id, month } = req.body;
      const snapshotMonth = monthToDate(month);

      if (!staff_id || !snapshotMonth) {
        return res.status(400).json({ message: "Missing staff_id or month" });
      }

      const result = await pool.query(
        `
        UPDATE public.schedule_balance_snapshots
        SET
          salary_advance = GREATEST(0, salary_advance - (salary_advance / 12)),
          motorcycle_loan = GREATEST(0, motorcycle_loan - (motorcycle_loan / 12)),
          special_advance = GREATEST(0, special_advance - (special_advance / 12)),
          cash_advance = GREATEST(0, cash_advance - (cash_advance / 12)),
          staff_accounts_payable = GREATEST(0, staff_accounts_payable - (staff_accounts_payable / 12)),
          updated_at = NOW()
        WHERE staff_id = $1
          AND snapshot_month = $2::date
        RETURNING *;
        `,
        [staff_id, snapshotMonth]
      );

      return res.json(result.rows[0] || {});
    } catch (err) {
      console.error("POST /schedule-balances/deduct ERROR:", err);
      return res.status(500).json({ message: "Deduction failed" });
    }
  }
);

router.post(
  "/snapshot/from-current",
  requireAuth,
  requirePermission("schedule_balance", "create"),
  async (req, res) => {
    const snapshotMonth = monthToDate(req.body?.month);

    if (!snapshotMonth) {
      return res.status(400).json({
        message: "month is required in YYYY-MM format",
      });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const current = await client.query(buildLiveSql(" WHERE LOWER(COALESCE(s.status, 'active')) = 'active' "), [
        snapshotMonth,
      ]);

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
        message: "Snapshot saved from current live balances",
        month: snapshotMonth,
        count: rows.length,
      });
    } catch (e) {
      try {
        await client.query("ROLLBACK");
      } catch {}

      console.error("POST /api/schedule-balances/snapshot/from-current ERROR:", e);

      return res.status(500).json({
        message: e.message || "Server error",
      });
    } finally {
      client.release();
    }
  }
);

module.exports = router;