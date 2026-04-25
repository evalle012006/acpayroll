const express = require("express");
const router = express.Router();
const pool = require("../db");
const { requireAuth, requireRole } = require("../middlewares/authMiddleware");

const toStr = (v) => String(v ?? "").trim();

const toInt = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

const toNum = (v) => {
  const s = String(v ?? "").trim();
  if (!s) return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

const toDateOrNull = (v) => {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const d = s.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
};

const roleLower = (req) => String(req.user?.role || "").trim().toLowerCase();
const isAdmin = (req) => roleLower(req) === "admin";
const isHr = (req) => roleLower(req) === "hr";
const isAccounting = (req) => roleLower(req) === "accounting";
const isTread = (req) => roleLower(req) === "tread";
const isBranchManager = (req) => roleLower(req) === "branch manager";
const isAreaManager = (req) => roleLower(req) === "area manager";
const isRegionalManager = (req) => roleLower(req) === "regional manager";
const isAssistantVicePresident = (req) =>
  roleLower(req) === "assistant vice president";
const isVicePresident = (req) => roleLower(req) === "vice president";
const isSeniorVicePresident = (req) =>
  roleLower(req) === "senior vice president";
const isPresident = (req) => roleLower(req) === "president";

const isTopManagement = (req) =>
  isAdmin(req) ||
  isHr(req) ||
  isAccounting(req) ||
  isTread(req) ||
  isVicePresident(req) ||
  isSeniorVicePresident(req) ||
  isPresident(req);

const getUserArea = (req) => toStr(req.user?.area);
const getUserBranchCode = (req) => toStr(req.user?.branch_id);
const getUserDivision = (req) => toStr(req.user?.division);
const getUserRegion = (req) => toStr(req.user?.region);

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

  return r.rowCount ? r.rows[0].id : null;
}

async function canAccessStaffById(client, req, staffId) {
  const id = toInt(staffId);
  if (!id) return false;

  if (isTopManagement(req)) return true;

  const r = await client.query(
    `
    SELECT id, branch_id, area, region, division
    FROM public.staff
    WHERE id = $1
    LIMIT 1
    `,
    [id]
  );

  if (r.rowCount === 0) return false;

  const row = r.rows[0];

  if (isBranchManager(req)) {
    const bid = await getBranchIdFromCode(getUserBranchCode(req));
    return !!bid && Number(row.branch_id) === Number(bid);
  }

  if (isAreaManager(req)) {
    const area = getUserArea(req);
    return !!area && toStr(row.area).toLowerCase() === area.toLowerCase();
  }

  if (isRegionalManager(req)) {
    const region = getUserRegion(req);
    return !!region && toStr(row.region).toLowerCase() === region.toLowerCase();
  }

  if (isAssistantVicePresident(req)) {
    const division = getUserDivision(req);
    return !!division && toStr(row.division).toLowerCase() === division.toLowerCase();
  }

  return false;
}

function normalizePayload(body = {}) {
  const original_amount = toNum(body.original_amount);
  const interest = toNum(body.interest);

  const interest_amount = Number(
    (original_amount * (interest / 100)).toFixed(2)
  );

  const total_amount = Number(
    (original_amount + interest_amount).toFixed(2)
  );

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

  const loan_type = toStr(body.loan_type);
  const status = toStr(body.status) || "Active";
  const remarks = toStr(body.remarks) || null;

  return {
    loan_type,
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
    status,
    remarks,
  };
}

/* =========================================================
   GET ALL FOR STAFF
========================================================= */
router.get(
  "/staff-loan-opening-balances/staff/:staffId",
  requireAuth,
  requireRole([
    "admin",
    "hr",
    "accounting",
    "tread",
    "branch manager",
    "area manager",
    "regional manager",
    "assistant vice president",
    "vice president",
    "senior vice president",
    "president",
  ]),
  async (req, res) => {
    const client = await pool.connect();
    try {
      const staffId = toInt(req.params.staffId);
      if (!staffId) return res.status(400).json({ message: "Invalid staff id" });

      const allowed = await canAccessStaffById(client, req, staffId);
      if (!allowed) return res.status(403).json({ message: "Access denied" });

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
      console.error("GET /api/staff-loan-opening-balances/staff/:staffId ERROR:", e.message);
      return res.status(500).json({ message: "Server error" });
    } finally {
      client.release();
    }
  }
);

/* =========================================================
   CREATE
========================================================= */
router.post(
  "/staff-loan-opening-balances",
  requireAuth,
  requireRole(["admin", "hr", "accounting", "tread"]),
  async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const staff_id = toInt(req.body?.staff_id);
      if (!staff_id) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "staff_id is required" });
      }

      const staffRes = await client.query(
        `
        SELECT id, employee_no
        FROM public.staff
        WHERE id = $1
        LIMIT 1
        `,
        [staff_id]
      );

      if (staffRes.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Staff not found" });
      }

      const payload = normalizePayload(req.body);
      if (!payload.loan_type) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "loan_type is required" });
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
          ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::date,$13::date,$14,$15,$16,$16)
        RETURNING *;
        `,
        [
          staff_id,
          toStr(staffRes.rows[0].employee_no) || null,
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
      console.error("POST /api/staff-loan-opening-balances ERROR:", e.message);
      return res.status(500).json({ message: e?.message || "Server error" });
    } finally {
      client.release();
    }
  }
);

/* =========================================================
   UPDATE
========================================================= */
router.put(
  "/staff-loan-opening-balances/:id",
  requireAuth,
  requireRole(["admin", "hr", "accounting", "tread"]),
  async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const id = toInt(req.params.id);
      if (!id) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Invalid id" });
      }

      const existing = await client.query(
        `
        SELECT id, staff_id
        FROM public.staff_loan_opening_balances
        WHERE id = $1
        LIMIT 1
        `,
        [id]
      );

      if (existing.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Record not found" });
      }

      const payload = normalizePayload(req.body);
      if (!payload.loan_type) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "loan_type is required" });
      }

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
        RETURNING *;
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
      console.error("PUT /api/staff-loan-opening-balances/:id ERROR:", e.message);
      return res.status(500).json({ message: e?.message || "Server error" });
    } finally {
      client.release();
    }
  }
);

/* =========================================================
   DELETE
========================================================= */
router.delete(
  "/staff-loan-opening-balances/:id",
  requireAuth,
  requireRole(["admin", "hr", "accounting", "tread"]),
  async (req, res) => {
    try {
      const id = toInt(req.params.id);
      if (!id) return res.status(400).json({ message: "Invalid id" });

      const r = await pool.query(
        `
        DELETE FROM public.staff_loan_opening_balances
        WHERE id = $1
        RETURNING id
        `,
        [id]
      );

      if (r.rowCount === 0) {
        return res.status(404).json({ message: "Record not found" });
      }

      return res.json({ message: "Deleted", id: r.rows[0].id });
    } catch (e) {
      console.error("DELETE /api/staff-loan-opening-balances/:id ERROR:", e.message);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

module.exports = router;