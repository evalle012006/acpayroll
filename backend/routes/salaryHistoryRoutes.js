const express = require("express");
const router = express.Router();
const pool = require("../db");
const { requireAuth } = require("../middlewares/authMiddleware");

router.get("/:employee_no", requireAuth, async (req, res) => {
  try {
    const employeeNo = String(req.params.employee_no || "").trim();

    if (!employeeNo) {
      return res.status(400).json({ message: "employee_no is required" });
    }

    const result = await pool.query(
      `
      SELECT
        id,
        employee_no,
        effective_date,
        salary,
        ecola,
        created_at
      FROM salary_history
      WHERE employee_no = $1
      ORDER BY effective_date ASC
      `,
      [employeeNo]
    );

    return res.json(result.rows);
  } catch (err) {
    console.error("GET /salary-history/:employee_no ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;