const express = require("express");
const router = express.Router();
const pool = require("../db");

const { requireAuth } = require("../middlewares/authMiddleware");

const {
  requirePermission,
} = require("../middlewares/permissionMiddleware");

const clean = (v) =>
  String(v ?? "").trim();

/* =========================================================
   GET STATUS HISTORY
========================================================= */

router.get(
  "/:employee_no",

  requireAuth,

  requirePermission(
    "status_history",
    "view"
  ),

  async (req, res) => {
    try {
      const employeeNo =
        clean(
          req.params
            .employee_no
        );

      if (!employeeNo) {
        return res.status(400).json({
          message:
            "employee_no is required.",
        });
      }

      const result =
        await pool.query(
          `
          SELECT
            id,
            employee_no,
            effective_date,
            status,
            reason,
            remarks,
            created_at

          FROM public.status_history

          WHERE employee_no = $1

          ORDER BY
            effective_date ASC,
            id ASC
          `,
          [employeeNo]
        );

      return res.json(
        result.rows
      );
    } catch (err) {
      console.error(
        "GET /api/status-history/:employee_no ERROR:",
        err
      );

      return res.status(500).json({
        message:
          err.message ||
          "Server error",
      });
    }
  }
);

module.exports =
  router;