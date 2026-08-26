const express = require("express");
const router = express.Router();
const pool = require("../db");

const { requireAuth } = require("../middlewares/authMiddleware");
const { requirePermission } = require("../middlewares/permissionMiddleware");

const {
  isAdmin,
  isIT,
  isHr,
  isAccounting,
  isTread,
  isBranchManager,
  isAreaManager,
  isRegionalManager,
  isAssistantVicePresident,
  isVicePresident,
  isSeniorVicePresident,
  isPresident,
} = require("../utils/roleAccess");

const toNum = (v) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const clean = (v) => String(v ?? "").trim();
const toStr = (v) => String(v ?? "").trim();

const getUserBranchCode = (req) => toStr(req.user?.branch_id);
const getUserArea = (req) => toStr(req.user?.area);
const getUserRegion = (req) => toStr(req.user?.region);
const getUserDivision = (req) => toStr(req.user?.division);
const getUserDepartment = (req) =>
  toStr(
    req.user?.department ||
      req.user?.department_name ||
      req.user?.user_department ||
      req.user?.departmentName ||
      req.user?.dept
  ).toLowerCase();

const isITDepartmentUser = (req) =>
  getUserDepartment(req).includes("it");

const isAuditDepartmentUser = (req) =>
  getUserDepartment(req).includes("audit");

const isTreadDepartmentUser = (req) =>
  getUserDepartment(req).includes("tread");

const isOfficePresidentDepartmentUser = (req) =>
  getUserDepartment(req).includes("office of the president");

const isAccountingDepartmentUser = (req) =>
  getUserDepartment(req).includes("accounting");

const isHrDepartmentUser = (req) =>
  getUserDepartment(req).includes("hr");

function isTopLevelViewer(req) {
  return (
    isAdmin(req) ||
    isIT(req) ||
    isHr(req) ||

    isHrDepartmentUser(req) ||
    isITDepartmentUser(req) ||
    isAccountingDepartmentUser(req) ||
    isAuditDepartmentUser(req) ||
    isTreadDepartmentUser(req) ||
    isOfficePresidentDepartmentUser(req) ||

    isAccounting(req) ||
    isTread(req) ||
    isVicePresident(req) ||
    isSeniorVicePresident(req) ||
    isPresident(req)
  );
}

function isDivisionScopedViewer(req) {
  return isAssistantVicePresident(req);
}

function isRegionScopedViewer(req) {
  return isRegionalManager(req);
}

function isAreaScopedViewer(req) {
  return isAreaManager(req);
}

function isBranchScopedViewer(req) {
  return isBranchManager(req);
}

function isViewOnlyUser(req) {
  return isTread(req);
}

async function getBranchIdFromCode(branchCode) {
  const code = toStr(branchCode);
  if (!code) return null;

  const r = await pool.query(
    `
    SELECT id
    FROM public.branches
    WHERE LOWER(TRIM(code)) = LOWER(TRIM($1))
    LIMIT 1
    `,
    [code]
  );

  if (r.rowCount === 0) return null;
  return r.rows[0].id;
}

async function ensureBalanceRow(client, employeeNo) {
  await client.query(
    `
    INSERT INTO public.staff_balances
      (
        employee_no,
        fullname,
        "position",
        last_name,
        first_name,
        middle_name,
        cbu,
        cashbond,
        utility,
        salary_advance,
        motorcycle_loan,
        special_advance,
        cash_advance,
        other_receivable,
        staff_accounts_payable,
        created_at,
        updated_at
      )
    SELECT
      s.employee_no,
      s.fullname,
      s."position",
      s.last_name,
      s.first_name,
      s.middle_name,
      0, 0, 0,
      0, 0, 0, 0,
      0, 0,
      NOW(), NOW()
    FROM public.staff s
    WHERE s.employee_no = $1
    ON CONFLICT (employee_no) DO NOTHING
    `,
    [employeeNo]
  );
}

async function getScopedStaffRowByEmployeeNo(client, employeeNo) {
  const r = await client.query(
    `
    SELECT
      id,
      employee_no,
      branch_id,
      area,
      region,
      division
    FROM public.staff
    WHERE employee_no = $1
    LIMIT 1
    `,
    [employeeNo]
  );

  if (r.rowCount === 0) return null;
  return r.rows[0];
}

async function canAccessEmployeeNo(client, req, employeeNo) {
  const staffRow = await getScopedStaffRowByEmployeeNo(client, employeeNo);

  if (!staffRow) {
    return { ok: false, code: 404, message: "Staff not found" };
  }

  if (isTopLevelViewer(req)) {
    return { ok: true, staffRow };
  }

  if (isBranchScopedViewer(req)) {
    const branchCode = getUserBranchCode(req);
    if (!branchCode) {
      return { ok: false, code: 403, message: "Access denied" };
    }

    const branchId = await getBranchIdFromCode(branchCode);
    if (!branchId || Number(staffRow.branch_id) !== Number(branchId)) {
      return { ok: false, code: 403, message: "Access denied" };
    }

    return { ok: true, staffRow };
  }

  if (isAreaScopedViewer(req)) {
    const area = getUserArea(req);

    if (!area || toStr(staffRow.area).toLowerCase() !== area.toLowerCase()) {
      return { ok: false, code: 403, message: "Access denied" };
    }

    return { ok: true, staffRow };
  }

  if (isRegionScopedViewer(req)) {
    const region = getUserRegion(req);

    if (!region || toStr(staffRow.region).toLowerCase() !== region.toLowerCase()) {
      return { ok: false, code: 403, message: "Access denied" };
    }

    return { ok: true, staffRow };
  }

  if (isDivisionScopedViewer(req)) {
    const division = getUserDivision(req);

    if (!division || toStr(staffRow.division).toLowerCase() !== division.toLowerCase()) {
      return { ok: false, code: 403, message: "Access denied" };
    }

    return { ok: true, staffRow };
  }

  return { ok: false, code: 403, message: "Access denied" };
}

router.get(
  "/staff-balances",
  requireAuth,
  requirePermission("staff_balance", "view"),
  async (req, res) => {
    try {
      if (isTopLevelViewer(req)) {
        const r = await pool.query(`
          SELECT
            sb.*,
            s.id AS staff_id,
            s.branch_id,
            s.area,
            s.region,
            s.division,
            COALESCE(sb."position", s."position") AS "position",
            COALESCE(sb.fullname, s.fullname) AS fullname,
            COALESCE(sb.last_name, s.last_name) AS last_name,
            COALESCE(sb.first_name, s.first_name) AS first_name,
            COALESCE(sb.middle_name, s.middle_name) AS middle_name
          FROM public.staff_balances sb
          LEFT JOIN public.staff s ON s.employee_no = sb.employee_no
          ORDER BY sb.id DESC
        `);

        return res.json(r.rows);
      }

      if (isBranchScopedViewer(req)) {
        const branchCode = getUserBranchCode(req);
        if (!branchCode) return res.json([]);

        const branchId = await getBranchIdFromCode(branchCode);
        if (!branchId) return res.json([]);

        const r = await pool.query(
          `
          SELECT
            sb.*,
            s.id AS staff_id,
            s.branch_id,
            s.area,
            s.region,
            s.division,
            COALESCE(sb."position", s."position") AS "position",
            COALESCE(sb.fullname, s.fullname) AS fullname,
            COALESCE(sb.last_name, s.last_name) AS last_name,
            COALESCE(sb.first_name, s.first_name) AS first_name,
            COALESCE(sb.middle_name, s.middle_name) AS middle_name
          FROM public.staff_balances sb
          JOIN public.staff s ON s.employee_no = sb.employee_no
          WHERE s.branch_id = $1
          ORDER BY sb.id DESC
          `,
          [branchId]
        );

        return res.json(r.rows);
      }

      if (isAreaScopedViewer(req)) {
        const area = getUserArea(req);
        if (!area) return res.json([]);

        const r = await pool.query(
          `
          SELECT
            sb.*,
            s.id AS staff_id,
            s.branch_id,
            s.area,
            s.region,
            s.division,
            COALESCE(sb."position", s."position") AS "position",
            COALESCE(sb.fullname, s.fullname) AS fullname,
            COALESCE(sb.last_name, s.last_name) AS last_name,
            COALESCE(sb.first_name, s.first_name) AS first_name,
            COALESCE(sb.middle_name, s.middle_name) AS middle_name
          FROM public.staff_balances sb
          JOIN public.staff s ON s.employee_no = sb.employee_no
          WHERE LOWER(TRIM(COALESCE(s.area, ''))) = LOWER(TRIM($1))
          ORDER BY sb.id DESC
          `,
          [area]
        );

        return res.json(r.rows);
      }

      if (isRegionScopedViewer(req)) {
        const region = getUserRegion(req);
        if (!region) return res.json([]);

        const r = await pool.query(
          `
          SELECT
            sb.*,
            s.id AS staff_id,
            s.branch_id,
            s.area,
            s.region,
            s.division,
            COALESCE(sb."position", s."position") AS "position",
            COALESCE(sb.fullname, s.fullname) AS fullname,
            COALESCE(sb.last_name, s.last_name) AS last_name,
            COALESCE(sb.first_name, s.first_name) AS first_name,
            COALESCE(sb.middle_name, s.middle_name) AS middle_name
          FROM public.staff_balances sb
          JOIN public.staff s ON s.employee_no = sb.employee_no
          WHERE LOWER(TRIM(COALESCE(s.region, ''))) = LOWER(TRIM($1))
          ORDER BY sb.id DESC
          `,
          [region]
        );

        return res.json(r.rows);
      }

      if (isDivisionScopedViewer(req)) {
        const division = getUserDivision(req);
        if (!division) return res.json([]);

        const r = await pool.query(
          `
          SELECT
            sb.*,
            s.id AS staff_id,
            s.branch_id,
            s.area,
            s.region,
            s.division,
            COALESCE(sb."position", s."position") AS "position",
            COALESCE(sb.fullname, s.fullname) AS fullname,
            COALESCE(sb.last_name, s.last_name) AS last_name,
            COALESCE(sb.first_name, s.first_name) AS first_name,
            COALESCE(sb.middle_name, s.middle_name) AS middle_name
          FROM public.staff_balances sb
          JOIN public.staff s ON s.employee_no = sb.employee_no
          WHERE LOWER(TRIM(COALESCE(s.division, ''))) = LOWER(TRIM($1))
          ORDER BY sb.id DESC
          `,
          [division]
        );

        return res.json(r.rows);
      }

      return res.status(403).json({ message: "Access denied" });
    } catch (e) {
      console.error("GET /api/staff-balances ERROR:", e);
      return res.status(500).json({ message: e.message || "Server error" });
    }
  }
);

router.put(
  "/staff-balances/:employeeNo",
  requireAuth,
  requirePermission("staff_balance", "edit"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      if (isViewOnlyUser(req)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const employeeNo = clean(req.params.employeeNo);

      if (!employeeNo) {
        return res.status(400).json({ message: "Invalid employee no" });
      }

      const access = await canAccessEmployeeNo(client, req, employeeNo);

      if (!access.ok) {
        return res.status(access.code).json({ message: access.message });
      }

      await client.query("BEGIN");

      await ensureBalanceRow(client, employeeNo);

      const existingBal = await client.query(
        `
        SELECT *
        FROM public.staff_balances
        WHERE employee_no = $1
        LIMIT 1
        `,
        [employeeNo]
      );

      const oldBal = existingBal.rows[0] || {};

      const keepNum = (key) => {
        const v = req.body?.[key];
        if (v === undefined || v === null || v === "") {
          return toNum(oldBal[key]);
        }
        return toNum(v);
      };

      await client.query(
        `
        UPDATE public.staff_balances
        SET
          cbu = $1,
          cashbond = $2,
          utility = $3,
          salary_advance = $4,
          special_advance = $5,
          cash_advance = $6,
          motorcycle_loan = $7,
          other_receivable = $8,
          staff_accounts_payable = $9,
          updated_at = NOW()
        WHERE employee_no = $10
        `,
        [
          keepNum("cbu"),
          keepNum("cashbond"),
          keepNum("utility"),
          keepNum("salary_advance"),
          keepNum("special_advance"),
          keepNum("cash_advance"),
          keepNum("motorcycle_loan"),
          keepNum("other_receivable"),
          keepNum("staff_accounts_payable"),
          employeeNo,
        ]
      );

      const r = await client.query(
        `
        SELECT
          sb.*,
          s.id AS staff_id,
          s.branch_id,
          s.area,
          s.region,
          s.division,
          COALESCE(sb."position", s."position") AS "position",
          COALESCE(sb.fullname, s.fullname) AS fullname,
          COALESCE(sb.last_name, s.last_name) AS last_name,
          COALESCE(sb.first_name, s.first_name) AS first_name,
          COALESCE(sb.middle_name, s.middle_name) AS middle_name
        FROM public.staff_balances sb
        LEFT JOIN public.staff s ON s.employee_no = sb.employee_no
        WHERE sb.employee_no = $1
        LIMIT 1
        `,
        [employeeNo]
      );

      await client.query("COMMIT");
      return res.json(r.rows[0]);
    } catch (e) {
      try {
        await client.query("ROLLBACK");
      } catch {}

      console.error("PUT /api/staff-balances/:employeeNo ERROR:", e);
      return res.status(500).json({ message: e.message || "Server error" });
    } finally {
      client.release();
    }
  }
);

router.get(
  "/staff-balances/:employeeNo",
  requireAuth,
  requirePermission("staff_balance", "view"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const employeeNo = clean(req.params.employeeNo);

      if (!employeeNo) {
        return res.status(400).json({ message: "Invalid employee no" });
      }

      const access = await canAccessEmployeeNo(client, req, employeeNo);

      if (!access.ok) {
        return res.status(access.code).json({ message: access.message });
      }

      await client.query("BEGIN");

      await ensureBalanceRow(client, employeeNo);

      const r = await client.query(
        `
        SELECT
          s.id AS staff_id,
          sb.employee_no,
          COALESCE(sb.fullname, s.fullname) AS fullname,
          COALESCE(sb."position", s."position") AS "position",
          COALESCE(sb.last_name, s.last_name) AS last_name,
          COALESCE(sb.first_name, s.first_name) AS first_name,
          COALESCE(sb.middle_name, s.middle_name) AS middle_name,

          COALESCE(sb.cbu, 0) AS cbu,
          COALESCE(sb.cashbond, 0) AS cashbond,
          COALESCE(sb.utility, 0) AS utility,

          (
            COALESCE(loanx.salary_advance, 0) +
            COALESCE(openingx.salary_advance, 0)
          )::numeric(12,2) AS salary_advance,

          (
            COALESCE(loanx.special_advance, 0) +
            COALESCE(openingx.special_advance, 0)
          )::numeric(12,2) AS special_advance,

          (
            COALESCE(loanx.cash_advance, 0) +
            COALESCE(openingx.cash_advance, 0)
          )::numeric(12,2) AS cash_advance,

          (
            COALESCE(loanx.motorcycle_loan, 0) +
            COALESCE(openingx.motorcycle_loan, 0)
          )::numeric(12,2) AS motorcycle_loan,

          COALESCE(orx.other_receivable, 0) AS other_receivable,
          COALESCE(sapx.staff_accounts_payable, 0) AS staff_accounts_payable,

          sb.created_at,
          sb.updated_at

        FROM public.staff_balances sb
        LEFT JOIN public.staff s ON s.employee_no = sb.employee_no

        LEFT JOIN (
          SELECT
            lr.staff_id,

            /* =========================================
              SALARY ADVANCE
              SAME LOGIC AS SCHEDULE OF BALANCES
            ========================================= */
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
                      WHEN (NOW() AT TIME ZONE 'Asia/Manila')::date <
                        CASE
                          WHEN EXTRACT(DAY FROM lr.approved_at::date) BETWEEN 1 AND 9
                          THEN (
                            DATE_TRUNC('month', lr.approved_at::date)
                            + INTERVAL '24 days'
                          )::date
                          ELSE (
                            DATE_TRUNC('month', lr.approved_at::date)
                            + INTERVAL '1 month'
                            + INTERVAL '24 days'
                          )::date
                        END
                      THEN 0

                      ELSE
                        (
                          (
                            EXTRACT(
                              YEAR FROM (NOW() AT TIME ZONE 'Asia/Manila')::date
                            )::int
                            -
                            EXTRACT(
                              YEAR FROM
                              CASE
                                WHEN EXTRACT(DAY FROM lr.approved_at::date) BETWEEN 1 AND 9
                                THEN (
                                  DATE_TRUNC('month', lr.approved_at::date)
                                  + INTERVAL '24 days'
                                )::date
                                ELSE (
                                  DATE_TRUNC('month', lr.approved_at::date)
                                  + INTERVAL '1 month'
                                  + INTERVAL '24 days'
                                )::date
                              END
                            )::int
                          ) * 12
                          +
                          (
                            EXTRACT(
                              MONTH FROM (NOW() AT TIME ZONE 'Asia/Manila')::date
                            )::int
                            -
                            EXTRACT(
                              MONTH FROM
                              CASE
                                WHEN EXTRACT(DAY FROM lr.approved_at::date) BETWEEN 1 AND 9
                                THEN (
                                  DATE_TRUNC('month', lr.approved_at::date)
                                  + INTERVAL '24 days'
                                )::date
                                ELSE (
                                  DATE_TRUNC('month', lr.approved_at::date)
                                  + INTERVAL '1 month'
                                  + INTERVAL '24 days'
                                )::date
                              END
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


            /* =========================================
              SPECIAL ADVANCE
              SAME LOGIC AS SCHEDULE OF BALANCES
            ========================================= */
            SUM(
              CASE
                WHEN LOWER(TRIM(COALESCE(lr.loan_type, ''))) IN (
                  'special advance',
                  'special loan'
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
                      WHEN (NOW() AT TIME ZONE 'Asia/Manila')::date <
                        CASE
                          WHEN EXTRACT(DAY FROM lr.approved_at::date) BETWEEN 1 AND 9
                          THEN (
                            DATE_TRUNC('month', lr.approved_at::date)
                            + INTERVAL '24 days'
                          )::date
                          ELSE (
                            DATE_TRUNC('month', lr.approved_at::date)
                            + INTERVAL '1 month'
                            + INTERVAL '24 days'
                          )::date
                        END
                      THEN 0

                      ELSE
                        (
                          (
                            EXTRACT(
                              YEAR FROM (NOW() AT TIME ZONE 'Asia/Manila')::date
                            )::int
                            -
                            EXTRACT(
                              YEAR FROM
                              CASE
                                WHEN EXTRACT(DAY FROM lr.approved_at::date) BETWEEN 1 AND 9
                                THEN (
                                  DATE_TRUNC('month', lr.approved_at::date)
                                  + INTERVAL '24 days'
                                )::date
                                ELSE (
                                  DATE_TRUNC('month', lr.approved_at::date)
                                  + INTERVAL '1 month'
                                  + INTERVAL '24 days'
                                )::date
                              END
                            )::int
                          ) * 12
                          +
                          (
                            EXTRACT(
                              MONTH FROM (NOW() AT TIME ZONE 'Asia/Manila')::date
                            )::int
                            -
                            EXTRACT(
                              MONTH FROM
                              CASE
                                WHEN EXTRACT(DAY FROM lr.approved_at::date) BETWEEN 1 AND 9
                                THEN (
                                  DATE_TRUNC('month', lr.approved_at::date)
                                  + INTERVAL '24 days'
                                )::date
                                ELSE (
                                  DATE_TRUNC('month', lr.approved_at::date)
                                  + INTERVAL '1 month'
                                  + INTERVAL '24 days'
                                )::date
                              END
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


            /* =========================================
              CASH ADVANCE
              SAME LOGIC AS SCHEDULE OF BALANCES
            ========================================= */
            SUM(
              CASE
                WHEN LOWER(TRIM(COALESCE(lr.loan_type, ''))) IN (
                  'cash advance',
                  'cash loan'
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
                      WHEN (NOW() AT TIME ZONE 'Asia/Manila')::date <
                        CASE
                          WHEN EXTRACT(DAY FROM lr.approved_at::date) BETWEEN 1 AND 9
                          THEN (
                            DATE_TRUNC('month', lr.approved_at::date)
                            + INTERVAL '24 days'
                          )::date
                          ELSE (
                            DATE_TRUNC('month', lr.approved_at::date)
                            + INTERVAL '1 month'
                            + INTERVAL '24 days'
                          )::date
                        END
                      THEN 0

                      ELSE
                        (
                          (
                            EXTRACT(
                              YEAR FROM (NOW() AT TIME ZONE 'Asia/Manila')::date
                            )::int
                            -
                            EXTRACT(
                              YEAR FROM
                              CASE
                                WHEN EXTRACT(DAY FROM lr.approved_at::date) BETWEEN 1 AND 9
                                THEN (
                                  DATE_TRUNC('month', lr.approved_at::date)
                                  + INTERVAL '24 days'
                                )::date
                                ELSE (
                                  DATE_TRUNC('month', lr.approved_at::date)
                                  + INTERVAL '1 month'
                                  + INTERVAL '24 days'
                                )::date
                              END
                            )::int
                          ) * 12
                          +
                          (
                            EXTRACT(
                              MONTH FROM (NOW() AT TIME ZONE 'Asia/Manila')::date
                            )::int
                            -
                            EXTRACT(
                              MONTH FROM
                              CASE
                                WHEN EXTRACT(DAY FROM lr.approved_at::date) BETWEEN 1 AND 9
                                THEN (
                                  DATE_TRUNC('month', lr.approved_at::date)
                                  + INTERVAL '24 days'
                                )::date
                                ELSE (
                                  DATE_TRUNC('month', lr.approved_at::date)
                                  + INTERVAL '1 month'
                                  + INTERVAL '24 days'
                                )::date
                              END
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
            )::numeric(12,2) AS cash_advance,


            /* =========================================
              MOTORCYCLE LOAN
              SAME LOGIC AS SCHEDULE OF BALANCES
            ========================================= */
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
                      WHEN (NOW() AT TIME ZONE 'Asia/Manila')::date <
                        CASE
                          WHEN EXTRACT(DAY FROM lr.approved_at::date) BETWEEN 1 AND 9
                          THEN (
                            DATE_TRUNC('month', lr.approved_at::date)
                            + INTERVAL '24 days'
                          )::date
                          ELSE (
                            DATE_TRUNC('month', lr.approved_at::date)
                            + INTERVAL '1 month'
                            + INTERVAL '24 days'
                          )::date
                        END
                      THEN 0

                      ELSE
                        (
                          (
                            EXTRACT(
                              YEAR FROM (NOW() AT TIME ZONE 'Asia/Manila')::date
                            )::int
                            -
                            EXTRACT(
                              YEAR FROM
                              CASE
                                WHEN EXTRACT(DAY FROM lr.approved_at::date) BETWEEN 1 AND 9
                                THEN (
                                  DATE_TRUNC('month', lr.approved_at::date)
                                  + INTERVAL '24 days'
                                )::date
                                ELSE (
                                  DATE_TRUNC('month', lr.approved_at::date)
                                  + INTERVAL '1 month'
                                  + INTERVAL '24 days'
                                )::date
                              END
                            )::int
                          ) * 12
                          +
                          (
                            EXTRACT(
                              MONTH FROM (NOW() AT TIME ZONE 'Asia/Manila')::date
                            )::int
                            -
                            EXTRACT(
                              MONTH FROM
                              CASE
                                WHEN EXTRACT(DAY FROM lr.approved_at::date) BETWEEN 1 AND 9
                                THEN (
                                  DATE_TRUNC('month', lr.approved_at::date)
                                  + INTERVAL '24 days'
                                )::date
                                ELSE (
                                  DATE_TRUNC('month', lr.approved_at::date)
                                  + INTERVAL '1 month'
                                  + INTERVAL '24 days'
                                )::date
                              END
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
            )::numeric(12,2) AS motorcycle_loan

          FROM public.loan_requests lr

          WHERE
            lr.staff_id IS NOT NULL
            AND LOWER(TRIM(COALESCE(lr.status, ''))) = 'approved'
            AND lr.approved_at IS NOT NULL
            AND lr.approved_at::date <=
                (NOW() AT TIME ZONE 'Asia/Manila')::date

          GROUP BY lr.staff_id

        ) loanx ON loanx.staff_id = s.id

        LEFT JOIN (
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
                  )
                  -
                  (
                    CASE
                      WHEN (NOW() AT TIME ZONE 'Asia/Manila')::date <
                          COALESCE(ob.effective_date, ob.start_date)
                      THEN 0

                      ELSE
                        (
                          (
                            EXTRACT(
                              YEAR FROM (NOW() AT TIME ZONE 'Asia/Manila')::date
                            )::int
                            -
                            EXTRACT(
                              YEAR FROM COALESCE(ob.effective_date, ob.start_date)
                            )::int
                          ) * 12
                          +
                          (
                            EXTRACT(
                              MONTH FROM (NOW() AT TIME ZONE 'Asia/Manila')::date
                            )::int
                            -
                            EXTRACT(
                              MONTH FROM COALESCE(ob.effective_date, ob.start_date)
                            )::int
                          )
                        )
                    END
                    *
                    COALESCE(ob.per_month, 0)
                  ),
                  0
                )
                ELSE 0
              END
            )::numeric(12,2) AS salary_advance,


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
                  )
                  -
                  (
                    CASE
                      WHEN (NOW() AT TIME ZONE 'Asia/Manila')::date <
                          COALESCE(ob.effective_date, ob.start_date)
                      THEN 0

                      ELSE
                        (
                          (
                            EXTRACT(
                              YEAR FROM (NOW() AT TIME ZONE 'Asia/Manila')::date
                            )::int
                            -
                            EXTRACT(
                              YEAR FROM COALESCE(ob.effective_date, ob.start_date)
                            )::int
                          ) * 12
                          +
                          (
                            EXTRACT(
                              MONTH FROM (NOW() AT TIME ZONE 'Asia/Manila')::date
                            )::int
                            -
                            EXTRACT(
                              MONTH FROM COALESCE(ob.effective_date, ob.start_date)
                            )::int
                          )
                        )
                    END
                    *
                    COALESCE(ob.per_month, 0)
                  ),
                  0
                )
                ELSE 0
              END
            )::numeric(12,2) AS special_advance,


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
                  )
                  -
                  (
                    CASE
                      WHEN (NOW() AT TIME ZONE 'Asia/Manila')::date <
                          COALESCE(ob.effective_date, ob.start_date)
                      THEN 0

                      ELSE
                        (
                          (
                            EXTRACT(
                              YEAR FROM (NOW() AT TIME ZONE 'Asia/Manila')::date
                            )::int
                            -
                            EXTRACT(
                              YEAR FROM COALESCE(ob.effective_date, ob.start_date)
                            )::int
                          ) * 12
                          +
                          (
                            EXTRACT(
                              MONTH FROM (NOW() AT TIME ZONE 'Asia/Manila')::date
                            )::int
                            -
                            EXTRACT(
                              MONTH FROM COALESCE(ob.effective_date, ob.start_date)
                            )::int
                          )
                        )
                    END
                    *
                    COALESCE(ob.per_month, 0)
                  ),
                  0
                )
                ELSE 0
              END
            )::numeric(12,2) AS cash_advance,


            SUM(
              CASE
                WHEN LOWER(TRIM(COALESCE(ob.loan_type, ''))) = 'motorcycle loan'
                THEN GREATEST(
                  COALESCE(
                    ob.remaining_balance,
                    ob.total_amount,
                    ob.original_amount,
                    0
                  )
                  -
                  (
                    CASE
                      WHEN (NOW() AT TIME ZONE 'Asia/Manila')::date <
                          COALESCE(ob.effective_date, ob.start_date)
                      THEN 0

                      ELSE
                        (
                          (
                            EXTRACT(
                              YEAR FROM (NOW() AT TIME ZONE 'Asia/Manila')::date
                            )::int
                            -
                            EXTRACT(
                              YEAR FROM COALESCE(ob.effective_date, ob.start_date)
                            )::int
                          ) * 12
                          +
                          (
                            EXTRACT(
                              MONTH FROM (NOW() AT TIME ZONE 'Asia/Manila')::date
                            )::int
                            -
                            EXTRACT(
                              MONTH FROM COALESCE(ob.effective_date, ob.start_date)
                            )::int
                          )
                        )
                    END
                    *
                    COALESCE(ob.per_month, 0)
                  ),
                  0
                )
                ELSE 0
              END
            )::numeric(12,2) AS motorcycle_loan

          FROM public.staff_loan_opening_balances ob

          WHERE
            ob.staff_id IS NOT NULL
            AND LOWER(TRIM(COALESCE(ob.status, ''))) = 'active'
            AND COALESCE(ob.effective_date, ob.start_date) IS NOT NULL

          GROUP BY ob.staff_id

        ) openingx ON openingx.staff_id = s.id

          LEFT JOIN (
            SELECT
              employee_no,
              SUM(
                GREATEST(
                  COALESCE(amount, 0) -
                  (
                    GREATEST(
                      (
                        DATE_PART(
                          'year',
                          AGE(
                            CURRENT_DATE,
                            COALESCE(deduction_start_date, release_date, approved_at, created_at)
                          )
                        )::int * 12
                      ) +
                      DATE_PART(
                        'month',
                        AGE(
                          CURRENT_DATE,
                          COALESCE(deduction_start_date, release_date, approved_at, created_at)
                        )
                      )::int,
                      0
                    ) * COALESCE(per_month, 0)
                  ),
                  0
                )
              )::numeric(12,2) AS other_receivable
            FROM public.other_receivables
            WHERE LOWER(COALESCE(status, '')) = 'approved'
            GROUP BY employee_no
          ) orx ON orx.employee_no = sb.employee_no

          LEFT JOIN (
            SELECT
              employee_no,
              SUM(COALESCE(amount, 0))::numeric(12,2) AS staff_accounts_payable
            FROM public.staff_accounts_payable
            WHERE LOWER(COALESCE(status, '')) = 'approved'
            GROUP BY employee_no
          ) sapx ON sapx.employee_no = sb.employee_no

          WHERE sb.employee_no = $1
          LIMIT 1
          `,
          [employeeNo]
        );

      await client.query("COMMIT");

      if (r.rowCount === 0) {
        return res.json({
          staff_id: access.staffRow.id,
          employee_no: employeeNo,
          fullname: "",
          position: "",
          last_name: "",
          first_name: "",
          middle_name: "",
          cbu: 0,
          cashbond: 0,
          utility: 0,
          salary_advance: 0,
          special_advance: 0,
          cash_advance: 0,
          motorcycle_loan: 0,
          other_receivable: 0,
          staff_accounts_payable: 0,
          created_at: null,
          updated_at: null,
        });
      }

      return res.json(r.rows[0]);
    } catch (e) {
      try {
        await client.query("ROLLBACK");
      } catch {}

      console.error("GET /api/staff-balances/:employeeNo ERROR:", e);
      return res.status(500).json({ message: e.message || "Server error" });
    } finally {
      client.release();
    }
  }
);

router.post(
  "/staff-balances/bootstrap",
  requireAuth,
  requirePermission("staff_balance", "edit"),
  async (_req, res) => {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const r = await client.query(
        `
        INSERT INTO public.staff_balances
          (
            employee_no,
            fullname,
            "position",
            last_name,
            first_name,
            middle_name,
            cbu,
            cashbond,
            utility,
            salary_advance,
            motorcycle_loan,
            special_advance,
            cash_advance,
            other_receivable,
            staff_accounts_payable,
            created_at,
            updated_at
          )
        SELECT
          s.employee_no,
          s.fullname,
          s."position",
          s.last_name,
          s.first_name,
          s.middle_name,
          0, 0, 0,
          0, 0, 0, 0,
          0, 0,
          NOW(), NOW()
        FROM public.staff s
        LEFT JOIN public.staff_balances sb ON sb.employee_no = s.employee_no
        WHERE sb.employee_no IS NULL
        `
      );

      await client.query("COMMIT");

      return res.json({
        message: "Bootstrap done",
        inserted: r.rowCount,
      });
    } catch (e) {
      try {
        await client.query("ROLLBACK");
      } catch {}

      console.error("POST /api/staff-balances/bootstrap ERROR:", e);
      return res.status(500).json({ message: e.message || "Server error" });
    } finally {
      client.release();
    }
  }
);

module.exports = router;