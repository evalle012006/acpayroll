const express = require("express");
const router = express.Router();
const pool = require("../db");

const { requireAuth } = require("../middlewares/authMiddleware");
const { requirePermission } = require("../middlewares/permissionMiddleware");

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

async function makeOrderNo() {
  const result = await pool.query(`
    SELECT 'SBF-' || LPAD((COALESCE(MAX(id), 0) + 1)::text, 6, '0') AS order_no
    FROM public.sbf_orders
  `);

  return result.rows[0]?.order_no || "SBF-000001";
}

const selectSbfFields = `
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
`;

router.get(
  "/sbf-orders",
  requireAuth,
  requirePermission("sbf_order", "view"),
  async (_req, res) => {
    try {
      const result = await pool.query(`
        SELECT ${selectSbfFields}
        FROM public.sbf_orders
        ORDER BY id DESC
      `);

      return res.json(result.rows);
    } catch (err) {
      console.error("GET SBF ORDERS ERROR:", err);
      return res.status(500).json({ message: err.message });
    }
  }
);

router.post(
  "/sbf-orders",
  requireAuth,
  requirePermission("sbf_order", "create"),
  async (req, res) => {
    try {
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
        INSERT INTO public.sbf_orders (
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
        RETURNING ${selectSbfFields}
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

      return res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error("CREATE SBF ORDER ERROR:", err);
      return res.status(500).json({ message: err.message });
    }
  }
);

router.put(
  "/sbf-orders/:id/approve",
  requireAuth,
  requirePermission("sbf_order", "approve"),
  async (req, res) => {
    try {
      const id = Number(req.params.id);

      if (!Number.isFinite(id)) {
        return res.status(400).json({ message: "Invalid SBF order id" });
      }

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
        UPDATE public.sbf_orders
        SET
          status = 'Approved',
          approved_by = $2,
          approved_at = NOW()
        WHERE id = $1
        RETURNING ${selectSbfFields}
        `,
        [id, approvedBy]
      );

      if (!result.rows.length) {
        return res.status(404).json({ message: "SBF order not found" });
      }

      return res.json(result.rows[0]);
    } catch (err) {
      console.error("APPROVE SBF ORDER ERROR:", err);
      return res.status(500).json({ message: err.message });
    }
  }
);

router.put(
  "/sbf-orders/:id/reject",
  requireAuth,
  requirePermission("sbf_order", "reject"),
  async (req, res) => {
    try {
      const id = Number(req.params.id);

      if (!Number.isFinite(id)) {
        return res.status(400).json({ message: "Invalid SBF order id" });
      }

      const result = await pool.query(
        `
        UPDATE public.sbf_orders
        SET status = 'Rejected'
        WHERE id = $1
        RETURNING ${selectSbfFields}
        `,
        [id]
      );

      if (!result.rows.length) {
        return res.status(404).json({ message: "SBF order not found" });
      }

      return res.json(result.rows[0]);
    } catch (err) {
      console.error("REJECT SBF ORDER ERROR:", err);
      return res.status(500).json({ message: err.message });
    }
  }
);

module.exports = router;