const express = require("express");
const router = express.Router();
const pool = require("../db");

const { requireAuth } = require("../middlewares/authMiddleware");
const { requirePermission } = require("../middlewares/permissionMiddleware");

const toStr = (v) => String(v ?? "").trim();
const norm = (v) => toStr(v).toLowerCase();

const toInt = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

const toNum = (v) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const toDateOrNull = (v) => {
  const s = toStr(v);
  if (!s) return null;

  const d = s.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
};

/*
|--------------------------------------------------------------------------
| ROLE HELPERS
|--------------------------------------------------------------------------
*/

const getRole = (req) =>
  norm(
    req.user?.role ||
      req.user?.user_role ||
      req.user?.role_name ||
      req.user?.position
  );

const hasAnyRole = (req, roles = []) => {
  const role = getRole(req);
  return roles.map(norm).includes(role);
};

const hasFullAccess = (req) =>
  hasAnyRole(req, [
    "admin",
    "it",
    "hr",
    "accounting",
    "tread",
    "vice president",
    "senior vice president",
    "president",
  ]);

const isBranchManager = (req) => hasAnyRole(req, ["branch manager"]);
const isAreaManager = (req) => hasAnyRole(req, ["area manager"]);
const isRegionalManager = (req) => hasAnyRole(req, ["regional manager"]);
const isAssistantVicePresident = (req) =>
  hasAnyRole(req, ["assistant vice president"]);

/*
|--------------------------------------------------------------------------
| USER SCOPE
|--------------------------------------------------------------------------
*/

const getUserArea = (req) => norm(req.user?.area);
const getUserRegion = (req) => norm(req.user?.region);
const getUserDivision = (req) => norm(req.user?.division);

/*
|--------------------------------------------------------------------------
| SAFE BRANCH MATCH
|--------------------------------------------------------------------------
*/

async function getTableColumns(client, tableName) {
  const r = await client.query(
    `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = $1
    `,
    [tableName]
  );

  return r.rows.map((x) => x.column_name);
}

async function branchMatches(client, req, staff) {
  const userBranch = norm(req.user?.branch_id);
  const staffBranch = norm(staff?.branch_id);

  if (!userBranch || !staffBranch) return false;

  if (userBranch === staffBranch) return true;

  const userBranchNum = toInt(req.user?.branch_id);
  const staffBranchNum = toInt(staff?.branch_id);

  if (
    userBranchNum !== null &&
    staffBranchNum !== null &&
    userBranchNum === staffBranchNum
  ) {
    return true;
  }

  const branchRes = await client.query(
    `
    SELECT 1
    FROM public.branches b
    WHERE
      (
        LOWER(TRIM(b.id::text)) = LOWER(TRIM($1))
        OR LOWER(TRIM(COALESCE(b.code::text, ''))) = LOWER(TRIM($1))
        OR LOWER(TRIM(COALESCE(b.name::text, ''))) = LOWER(TRIM($1))
      )
      AND
      (
        LOWER(TRIM(b.id::text)) = LOWER(TRIM($2))
        OR LOWER(TRIM(COALESCE(b.code::text, ''))) = LOWER(TRIM($2))
        OR LOWER(TRIM(COALESCE(b.name::text, ''))) = LOWER(TRIM($2))
      )
    LIMIT 1
    `,
    [userBranch, staffBranch]
  );

  return branchRes.rowCount > 0;
}

/*
|--------------------------------------------------------------------------
| STAFF ACCESS CHECK
|--------------------------------------------------------------------------
*/

async function canAccessStaffById(client, req, staffId) {
  const id = toInt(staffId);

  if (!id) return false;

  if (hasFullAccess(req)) {
    return true;
  }

  const r = await client.query(
    `
    SELECT
      id,
      branch_id,
      area,
      region,
      division
    FROM public.staff
    WHERE id = $1
    LIMIT 1
    `,
    [id]
  );

  if (r.rowCount === 0) {
    return false;
  }

  const staff = r.rows[0];

  if (isBranchManager(req)) {
    return await branchMatches(client, req, staff);
  }

  if (isAreaManager(req)) {
    const userArea = getUserArea(req);
    if (!userArea) return false;

    return norm(staff.area) === userArea;
  }

  if (isRegionalManager(req)) {
    const userRegion = getUserRegion(req);
    if (!userRegion) return false;

    return norm(staff.region) === userRegion;
  }

  if (isAssistantVicePresident(req)) {
    const userDivision = getUserDivision(req);
    if (!userDivision) return false;

    return norm(staff.division) === userDivision;
  }

  return false;
}

/*
|--------------------------------------------------------------------------
| NORMALIZE PAYLOAD
|--------------------------------------------------------------------------
*/

function normalizePayload(body = {}) {
  const original_amount = toNum(body.original_amount);
  const interest = toNum(body.interest);

  const interest_amount = Number(
    (original_amount * (interest / 100)).toFixed(2)
  );

  const total_amount = Number((original_amount + interest_amount).toFixed(2));

  const term_months = toInt(body.term_months) ?? 0;
  const months_paid = toInt(body.months_paid) ?? 0;

  let per_month = toNum(body.per_month);

  if ((!per_month || per_month <= 0) && total_amount > 0 && term_months > 0) {
    per_month = Number((total_amount / term_months).toFixed(2));
  }

  let remaining_balance = toNum(body.remaining_balance);

  if (total_amount > 0) {
    remaining_balance = Math.max(
      0,
      Number((total_amount - per_month * months_paid).toFixed(2))
    );
  }

  return {
    loan_type: toStr(body.loan_type),

    original_amount,
    interest,
    interest_amount,
    total_amount,

    term_months,
    months_paid,
    per_month,
    remaining_balance,

    start_date: toDateOrNull(body.start_date),
    effective_date: toDateOrNull(body.effective_date),

    status: toStr(body.status) || "Active",
    remarks: toStr(body.remarks) || null,
  };
}

/*
|--------------------------------------------------------------------------
| GET STAFF LOAN OPENING BALANCES
|--------------------------------------------------------------------------
*/

router.get(
  "/staff-loan-opening-balances/staff/:staffId",
  requireAuth,
  requirePermission("staff_loan_opening_balance", "view"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const staffId = toInt(req.params.staffId);

      if (!staffId) {
        return res.status(400).json({
          message: "Invalid staff id",
        });
      }

      const allowed = await canAccessStaffById(client, req, staffId);

      if (!allowed) {
        return res.status(403).json({
          message: "Access denied",
          debug: {
            role: getRole(req),
            user_branch_id: req.user?.branch_id ?? null,
            user_area: req.user?.area ?? null,
            user_region: req.user?.region ?? null,
            user_division: req.user?.division ?? null,
            staff_id: staffId,
          },
        });
      }

      const r = await client.query(
        `
        SELECT *
        FROM public.staff_loan_opening_balances
        WHERE staff_id = $1
        ORDER BY id DESC
        `,
        [staffId]
      );

      return res.json(r.rows);
    } catch (e) {
      console.error("GET STAFF LOAN OPENING BALANCES ERROR:", e);

      return res.status(500).json({
        message: e?.message || "Server error",
      });
    } finally {
      client.release();
    }
  }
);

/*
|--------------------------------------------------------------------------
| CREATE
|--------------------------------------------------------------------------
*/

router.post(
  "/staff-loan-opening-balances",
  requireAuth,
  requirePermission("staff_loan_opening_balance", "create"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const staff_id = toInt(req.body?.staff_id);

      if (!staff_id) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message: "staff_id is required",
        });
      }

      const allowed = await canAccessStaffById(client, req, staff_id);

      if (!allowed) {
        await client.query("ROLLBACK");

        return res.status(403).json({
          message: "Access denied",
        });
      }

      const staffRes = await client.query(
        `
        SELECT employee_no
        FROM public.staff
        WHERE id = $1
        LIMIT 1
        `,
        [staff_id]
      );

      if (staffRes.rowCount === 0) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          message: "Staff not found",
        });
      }

      const payload = normalizePayload(req.body);

      if (!payload.loan_type) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message: "loan_type is required",
        });
      }

      const ins = await client.query(
        `
        INSERT INTO public.staff_loan_opening_balances
        (
          staff_id,
          employee_no,
          loan_type,
          original_amount,
          interest,
          interest_amount,
          total_amount,
          term_months,
          months_paid,
          per_month,
          remaining_balance,
          start_date,
          effective_date,
          status,
          remarks,
          created_by,
          updated_by
        )
        VALUES
        (
          $1,$2,$3,$4,$5,$6,$7,
          $8,$9,$10,$11,
          $12::date,
          $13::date,
          $14,$15,$16,$16
        )
        RETURNING *
        `,
        [
          staff_id,
          toStr(staffRes.rows[0]?.employee_no) || null,

          payload.loan_type,
          payload.original_amount,
          payload.interest,
          payload.interest_amount,
          payload.total_amount,

          payload.term_months,
          payload.months_paid,
          payload.per_month,
          payload.remaining_balance,

          payload.start_date,
          payload.effective_date,

          payload.status,
          payload.remarks,

          req.user?.id ?? null,
        ]
      );

      await client.query("COMMIT");

      return res.json(ins.rows[0]);
    } catch (e) {
      await client.query("ROLLBACK");

      console.error("CREATE STAFF LOAN OPENING BALANCE ERROR:", e);

      return res.status(500).json({
        message: e?.message || "Server error",
      });
    } finally {
      client.release();
    }
  }
);

/*
|--------------------------------------------------------------------------
| UPDATE
|--------------------------------------------------------------------------
*/

router.put(
  "/staff-loan-opening-balances/:id",
  requireAuth,
  requirePermission("staff_loan_opening_balance", "edit"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const id = toInt(req.params.id);

      if (!id) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message: "Invalid id",
        });
      }

      const existing = await client.query(
        `
        SELECT staff_id
        FROM public.staff_loan_opening_balances
        WHERE id = $1
        LIMIT 1
        `,
        [id]
      );

      if (existing.rowCount === 0) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          message: "Record not found",
        });
      }

      const allowed = await canAccessStaffById(
        client,
        req,
        existing.rows[0].staff_id
      );

      if (!allowed) {
        await client.query("ROLLBACK");

        return res.status(403).json({
          message: "Access denied",
        });
      }

      const payload = normalizePayload(req.body);

      const upd = await client.query(
        `
        UPDATE public.staff_loan_opening_balances
        SET
          loan_type = $2,
          original_amount = $3,
          interest = $4,
          interest_amount = $5,
          total_amount = $6,
          term_months = $7,
          months_paid = $8,
          per_month = $9,
          remaining_balance = $10,
          start_date = $11::date,
          effective_date = $12::date,
          status = $13,
          remarks = $14,
          updated_by = $15,
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
        `,
        [
          id,

          payload.loan_type,
          payload.original_amount,
          payload.interest,
          payload.interest_amount,
          payload.total_amount,

          payload.term_months,
          payload.months_paid,
          payload.per_month,
          payload.remaining_balance,

          payload.start_date,
          payload.effective_date,

          payload.status,
          payload.remarks,

          req.user?.id ?? null,
        ]
      );

      await client.query("COMMIT");

      return res.json(upd.rows[0]);
    } catch (e) {
      await client.query("ROLLBACK");

      console.error("UPDATE STAFF LOAN OPENING BALANCE ERROR:", e);

      return res.status(500).json({
        message: e?.message || "Server error",
      });
    } finally {
      client.release();
    }
  }
);

/*
|--------------------------------------------------------------------------
| DELETE
|--------------------------------------------------------------------------
*/

router.delete(
  "/staff-loan-opening-balances/:id",
  requireAuth,
  requirePermission("staff_loan_opening_balance", "delete"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const id = toInt(req.params.id);

      if (!id) {
        return res.status(400).json({
          message: "Invalid id",
        });
      }

      const existing = await client.query(
        `
        SELECT staff_id
        FROM public.staff_loan_opening_balances
        WHERE id = $1
        LIMIT 1
        `,
        [id]
      );

      if (existing.rowCount === 0) {
        return res.status(404).json({
          message: "Record not found",
        });
      }

      const allowed = await canAccessStaffById(
        client,
        req,
        existing.rows[0].staff_id
      );

      if (!allowed) {
        return res.status(403).json({
          message: "Access denied",
        });
      }

      await client.query(
        `
        DELETE FROM public.staff_loan_opening_balances
        WHERE id = $1
        `,
        [id]
      );

      return res.json({
        message: "Deleted successfully",
      });
    } catch (e) {
      console.error("DELETE STAFF LOAN OPENING BALANCE ERROR:", e);

      return res.status(500).json({
        message: e?.message || "Server error",
      });
    } finally {
      client.release();
    }
  }
);

module.exports = router;