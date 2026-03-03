const express = require("express");
const router = express.Router();
const pool = require("../db");
const { requireAuth } = require("../middlewares/authMiddleware");

const roleLower = (req) => String(req.user?.role || "").trim().toLowerCase();
const isAdmin = (req) => roleLower(req) === "admin";
const isBranchManager = (req) => roleLower(req) === "branch manager";

router.get("/staff-balances", requireAuth, async (req, res) => {
  try {
    // ✅ Admin: all balances
    if (isAdmin(req)) {
      const r = await pool.query(`
        SELECT
          sb.*,
          s.branch_id,
          COALESCE(sb."position", s."position") AS "position",
          COALESCE(sb.fullname, s.fullname) AS fullname,
          COALESCE(sb.last_name, s.last_name) AS last_name,
          COALESCE(sb.first_name, s.first_name) AS first_name,
          COALESCE(sb.middle_name, s.middle_name) AS middle_name
        FROM public.staff_balances sb
        LEFT JOIN public.staff s ON s.id = sb.employee_id
        ORDER BY sb.id DESC
      `);
      return res.json(r.rows);
    }

    // ✅ Branch Manager: only balances for staff in their branch
    if (isBranchManager(req)) {
      const branchId = req.user?.branch_id ?? null;
      if (!branchId) return res.json([]);

      const r = await pool.query(
        `
        SELECT
          sb.*,
          s.branch_id,
          COALESCE(sb."position", s."position") AS "position",
          COALESCE(sb.fullname, s.fullname) AS fullname,
          COALESCE(sb.last_name, s.last_name) AS last_name,
          COALESCE(sb.first_name, s.first_name) AS first_name,
          COALESCE(sb.middle_name, s.middle_name) AS middle_name
        FROM public.staff_balances sb
        JOIN public.staff s ON s.id = sb.employee_id
        WHERE s.branch_id = $1
        ORDER BY sb.id DESC
        `,
        [branchId]
      );
      return res.json(r.rows);
    }

    return res.status(403).json({ message: "Access denied" });
  } catch (e) {
    console.error("GET /api/staff-balances ERROR:", e.message);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;