const express = require("express");
const router = express.Router();
const pool = require("../db");
const { requireAuth, requireRole } = require("../middlewares/authMiddleware");

const toInt = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

const toNum = (v) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const toStr = (v) => String(v ?? "").trim();

const toDateOrNull = (v) => {
  const s = toStr(v);
  if (!s) return null;
  const d = s.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
};

const roleLower = (req) => toStr(req.user?.role).toLowerCase();

const isAdmin = (req) => roleLower(req) === "admin";
const isHr = (req) => roleLower(req) === "hr";
const isAccounting = (req) => roleLower(req) === "accounting";
const isBranchManager = (req) => roleLower(req) === "branch manager";
const isAreaManager = (req) => roleLower(req) === "area manager";
const isRegionalManager = (req) => roleLower(req) === "regional manager";
const isAssistantVicePresident = (req) => roleLower(req) === "assistant vice president";
const isVicePresident = (req) => roleLower(req) === "vice president";
const isSeniorVicePresident = (req) => roleLower(req) === "senior vice president";
const isPresident = (req) => roleLower(req) === "president";

const isTopManagement = (req) =>
  isAdmin(req) ||
  isHr(req) ||
  isAccounting(req) ||
  isVicePresident(req) ||
  isSeniorVicePresident(req) ||
  isPresident(req);

const getUserBranchCode = (req) => toStr(req.user?.branch_id);
const getUserArea = (req) => toStr(req.user?.area);
const getUserRegion = (req) => toStr(req.user?.region);
const getUserDivision = (req) => toStr(req.user?.division);

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

  return r.rowCount ? Number(r.rows[0].id) : null;
}

async function canAccessBranch(req, branchId) {
  if (isTopManagement(req)) return true;

  const b = await pool.query(
    `
    SELECT id, area, region, division
    FROM public.branches
    WHERE id = $1
    LIMIT 1
    `,
    [branchId]
  );

  if (b.rowCount === 0) return false;

  const row = b.rows[0];

  if (isBranchManager(req)) {
    const myBranchId = await getBranchIdFromCode(getUserBranchCode(req));
    return !!myBranchId && Number(myBranchId) === Number(row.id);
  }

  if (isAreaManager(req)) {
    const myArea = getUserArea(req);
    return !!myArea && toStr(row.area).toLowerCase() === myArea.toLowerCase();
  }

  if (isRegionalManager(req)) {
    const myRegion = getUserRegion(req);
    return !!myRegion && toStr(row.region).toLowerCase() === myRegion.toLowerCase();
  }

  if (isAssistantVicePresident(req)) {
    const myDivision = getUserDivision(req);
    return !!myDivision && toStr(row.division).toLowerCase() === myDivision.toLowerCase();
  }

  return false;
}

async function ensureStaffInBranch(staffId, branchId) {
  const r = await pool.query(
    `
    SELECT id
    FROM public.staff
    WHERE id = $1
      AND branch_id = $2
    LIMIT 1
    `,
    [staffId, branchId]
  );

  return r.rowCount > 0;
}

/* =========================================================
   GET OVERRIDES BY BRANCH
========================================================= */
router.get(
  "/branch/:branchId",
  requireAuth,
  requireRole([
    "admin",
    "hr",
    "accounting",
    "branch manager",
    "area manager",
    "regional manager",
    "assistant vice president",
    "vice president",
    "senior vice president",
    "president",
  ]),
  async (req, res) => {
    try {
      const branchId = toInt(req.params.branchId);
      if (!branchId) {
        return res.status(400).json({ message: "Invalid branch id" });
      }

      const allowed = await canAccessBranch(req, branchId);
      if (!allowed) {
        return res.status(403).json({ message: "Access denied" });
      }

      const result = await pool.query(
        `
        SELECT *
        FROM transportation_overrides
        WHERE branch_id = $1
        ORDER BY staff_id ASC
        `,
        [branchId]
      );

      return res.json(result.rows);
    } catch (err) {
      console.error("GET /api/transportation-overrides/branch/:branchId ERROR:", err.message);
      return res.status(500).json({ message: "Failed to fetch overrides" });
    }
  }
);

/* =========================================================
   CREATE OR UPDATE OVERRIDE
========================================================= */
router.post(
  "/",
  requireAuth,
  requireRole([
    "admin",
    "hr",
    "accounting",
    "branch manager",
    "area manager",
    "regional manager",
    "assistant vice president",
    "vice president",
    "senior vice president",
    "president",
  ]),
  async (req, res) => {
    try {
      const branch_id = toInt(req.body?.branch_id);
      const staff_id = toInt(req.body?.staff_id);
      const until = toDateOrNull(req.body?.until);
      const values = req.body?.values || {};

      if (!branch_id) {
        return res.status(400).json({ message: "branch_id is required" });
      }

      if (!staff_id) {
        return res.status(400).json({ message: "staff_id is required" });
      }

      const allowed = await canAccessBranch(req, branch_id);
      if (!allowed) {
        return res.status(403).json({ message: "Access denied" });
      }

      const staffOk = await ensureStaffInBranch(staff_id, branch_id);
      if (!staffOk) {
        return res.status(400).json({ message: "Staff does not belong to the selected branch" });
      }

      await pool.query(
        `
        INSERT INTO transportation_overrides
        (
          branch_id,
          staff_id,
          postage,
          transportation,
          additional_target,
          repairing,
          additional_monitoring,
          motorcycle_loan,
          other_deduction,
          until_date
        )
        VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)

        ON CONFLICT (branch_id, staff_id)
        DO UPDATE SET
          postage = EXCLUDED.postage,
          transportation = EXCLUDED.transportation,
          additional_target = EXCLUDED.additional_target,
          repairing = EXCLUDED.repairing,
          additional_monitoring = EXCLUDED.additional_monitoring,
          motorcycle_loan = EXCLUDED.motorcycle_loan,
          other_deduction = EXCLUDED.other_deduction,
          until_date = EXCLUDED.until_date
        `,
        [
          branch_id,
          staff_id,
          toNum(values.postage),
          toNum(values.transportation),
          toNum(values.additional_target),
          toNum(values.repairing),
          toNum(values.additional_monitoring),
          toNum(values.motorcycle_loan),
          toNum(values.other_deduction),
          until,
        ]
      );

      return res.json({ message: "Override saved" });
    } catch (err) {
      console.error("POST /api/transportation-overrides ERROR:", err.message);
      return res.status(500).json({ message: "Failed to save override" });
    }
  }
);

/* =========================================================
   DELETE OVERRIDE
========================================================= */
router.delete(
  "/branch/:branchId/staff/:staffId",
  requireAuth,
  requireRole([
    "admin",
    "hr",
    "accounting",
    "branch manager",
    "area manager",
    "regional manager",
    "assistant vice president",
    "vice president",
    "senior vice president",
    "president",
  ]),
  async (req, res) => {
    try {
      const branchId = toInt(req.params.branchId);
      const staffId = toInt(req.params.staffId);

      if (!branchId) {
        return res.status(400).json({ message: "Invalid branch id" });
      }

      if (!staffId) {
        return res.status(400).json({ message: "Invalid staff id" });
      }

      const allowed = await canAccessBranch(req, branchId);
      if (!allowed) {
        return res.status(403).json({ message: "Access denied" });
      }

      await pool.query(
        `
        DELETE FROM transportation_overrides
        WHERE branch_id = $1 AND staff_id = $2
        `,
        [branchId, staffId]
      );

      return res.json({ message: "Override removed" });
    } catch (err) {
      console.error("DELETE /api/transportation-overrides/branch/:branchId/staff/:staffId ERROR:", err.message);
      return res.status(500).json({ message: "Failed to remove override" });
    }
  }
);

module.exports = router;