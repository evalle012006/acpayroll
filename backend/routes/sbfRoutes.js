const express = require("express");
const router = express.Router();
const pool = require("../db");
const { requireAuth, requireRole } = require("../middlewares/authMiddleware");

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const toInt = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

const norm = (v) => String(v ?? "").trim().toLowerCase();

const roleLower = (req) => norm(req.user?.role);
const isAdmin = (req) => roleLower(req) === "admin";
const isHr = (req) => roleLower(req) === "hr";
const isAccounting = (req) => roleLower(req) === "accounting";
const isTread = (req) => roleLower(req) === "tread";
const isBranchManager = (req) => roleLower(req) === "branch manager";
const isAreaManager = (req) => roleLower(req) === "area manager";

const canViewSbf = (req) =>
  isAdmin(req) ||
  isHr(req) ||
  isAccounting(req) ||
  isBranchManager(req) ||
  isAreaManager(req) ||
  isTread(req);

const canCreateSbf = (req) =>
  isAdmin(req) ||
  isHr(req) ||
  isAccounting(req) ||
  isBranchManager(req) ||
  isAreaManager(req) ||
  isTread(req);

const canApproveSbf = (req) =>
  isAdmin(req) ||
  isHr(req) ||
  isAccounting(req) ||
  isTread(req);

async function makeOrderNo() {
  const result = await pool.query(`
    SELECT 'SBF-' || LPAD((COALESCE(MAX(id), 0) + 1)::text, 6, '0') AS order_no
    FROM sbf_orders
  `);

  return result.rows[0]?.order_no || "SBF-000001";
}

/* GET ALL */
router.get("/sbf-orders", requireAuth, async (req, res) => {
  try {
    if (!canViewSbf(req)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const result = await pool.query(`
      SELECT
        id,
        order_no,
        employee_no,
        employee_name,
        branch_code,
        branch_name,
        assistance_type,
        amount,
        reason,
        date_created,
        effective_date,
        status,
        approved_by,
        approved_at
      FROM sbf_orders
      ORDER BY id DESC
    `);

    res.json(result.rows);
  } catch (err) {
    console.error("GET SBF ORDERS ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

/* CREATE */
router.post(
  "/sbf-orders",
  requireAuth,
  requireRole([
    "admin",
    "hr",
    "accounting",
    "branch manager",
    "area manager",
    "tread",
  ]),
  async (req, res) => {
    try {
      if (!canCreateSbf(req)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const {
        employee_no,
        employee_name,
        branch_code,
        branch_name,
        assistance_type,
        amount,
        reason,
        date_created,
        effective_date,
      } = req.body;

      const order_no = await makeOrderNo();

      const result = await pool.query(
        `
        INSERT INTO sbf_orders (
          order_no,
          employee_no,
          employee_name,
          branch_code,
          branch_name,
          assistance_type,
          amount,
          reason,
          date_created,
          effective_date,
          status
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        RETURNING
          id,
          order_no,
          employee_no,
          employee_name,
          branch_code,
          branch_name,
          assistance_type,
          amount,
          reason,
          date_created,
          effective_date,
          status,
          approved_by,
          approved_at
        `,
        [
          order_no,
          employee_no,
          employee_name,
          branch_code,
          branch_name,
          assistance_type,
          toNum(amount),
          reason,
          date_created || null,
          effective_date || null,
          "Pending",
        ]
      );

      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error("CREATE SBF ORDER ERROR:", err);
      res.status(500).json({ message: err.message });
    }
  }
);

/* APPROVE */
router.put(
  "/sbf-orders/:id/approve",
  requireAuth,
  requireRole(["admin", "hr", "accounting", "tread"]),
  async (req, res) => {
    try {
      if (!canApproveSbf(req)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const { id } = req.params;

      const approvedBy = Number(
        req.user?.id ?? req.user?.user_id ?? req.user?.employee_id
      );

      if (!Number.isFinite(approvedBy)) {
        return res.status(400).json({
          message: "Invalid approver id. Check req.user.id / user_id / employee_id",
        });
      }

      const result = await pool.query(
        `
        UPDATE sbf_orders
        SET
          status = 'Approved',
          approved_by = $2,
          approved_at = NOW()
        WHERE id = $1
        RETURNING
          id,
          order_no,
          employee_no,
          employee_name,
          branch_code,
          branch_name,
          assistance_type,
          amount,
          reason,
          date_created,
          effective_date,
          status,
          approved_by,
          approved_at
        `,
        [id, approvedBy]
      );

      if (!result.rows.length) {
        return res.status(404).json({ message: "SBF order not found" });
      }

      res.json(result.rows[0]);
    } catch (err) {
      console.error("APPROVE SBF ORDER ERROR:", err);
      res.status(500).json({ message: err.message });
    }
  }
);

/* REJECT */
router.put(
  "/sbf-orders/:id/reject",
  requireAuth,
  requireRole(["admin", "hr", "accounting", "tread"]),
  async (req, res) => {
    try {
      if (!canApproveSbf(req)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const { id } = req.params;

      const result = await pool.query(
        `
        UPDATE sbf_orders
        SET status = 'Rejected'
        WHERE id = $1
        RETURNING
          id,
          order_no,
          employee_no,
          employee_name,
          branch_code,
          branch_name,
          assistance_type,
          amount,
          reason,
          date_created,
          effective_date,
          status,
          approved_by,
          approved_at
        `,
        [id]
      );

      if (!result.rows.length) {
        return res.status(404).json({ message: "SBF order not found" });
      }

      res.json(result.rows[0]);
    } catch (err) {
      console.error("REJECT SBF ORDER ERROR:", err);
      res.status(500).json({ message: err.message });
    }
  }
);

module.exports = router;