const express = require("express");
const router = express.Router();
const pool = require("../db");
const { requireAuth } = require("../middlewares/authMiddleware");
const { requirePermission } = require("../utils/permissions");

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

function isTopLevelViewer(req) {
  return (
    isAdmin(req) ||
    isIT(req) ||
    isHr(req) ||
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
          toNum(req.body?.cbu),
          toNum(req.body?.cashbond),
          toNum(req.body?.utility),
          toNum(req.body?.salary_advance),
          toNum(req.body?.special_advance),
          toNum(req.body?.cash_advance),
          toNum(req.body?.motorcycle_loan),
          toNum(req.body?.other_receivable),
          toNum(req.body?.staff_accounts_payable),
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

          COALESCE(sb.salary_advance, 0) AS salary_advance,
          COALESCE(sb.special_advance, 0) AS special_advance,
          COALESCE(sb.cash_advance, 0) AS cash_advance,
          COALESCE(sb.motorcycle_loan, 0) AS motorcycle_loan,
          COALESCE(sb.other_receivable, 0) AS other_receivable,
          COALESCE(sb.staff_accounts_payable, 0) AS staff_accounts_payable,

          sb.created_at,
          sb.updated_at
        FROM public.staff_balances sb
        LEFT JOIN public.staff s ON s.employee_no = sb.employee_no
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