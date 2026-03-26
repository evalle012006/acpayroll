const express = require("express");
const router = express.Router();
const pool = require("../db");
const { requireAuth, requireRole } = require("../middlewares/authMiddleware");

const roleLower = (req) => String(req.user?.role || "").trim().toLowerCase();
const isAdmin = (req) => roleLower(req) === "admin";
const isHr = (req) => roleLower(req) === "hr";
const isAccounting = (req) => roleLower(req) === "accounting";

/* ===============================
   GET (ALLOW ADMIN, HR, ACCOUNTING)
================================= */
router.get("/consolidation", requireAuth, async (req, res) => {
  try {
    if (!isAdmin(req) && !isHr(req) && !isAccounting(req)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const result = await pool.query(`
      SELECT id, year, company_name, tin, created_at
      FROM consolidation_2316
      ORDER BY year DESC, id DESC
    `);

    res.json(result.rows);
  } catch (err) {
    console.error("GET /consolidation error:", err);
    res.status(500).json({ message: "Failed to fetch consolidation records" });
  }
});

/* ===============================
   CREATE (ADMIN ONLY)
================================= */
router.post(
  "/consolidation",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    try {
      const { year, company_name, tin } = req.body;

      if (!year || !company_name || !tin) {
        return res.status(400).json({
          message: "year, company_name, and tin are required",
        });
      }

      const result = await pool.query(
        `
        INSERT INTO consolidation_2316 (year, company_name, tin)
        VALUES ($1, $2, $3)
        RETURNING *
        `,
        [year, company_name, tin]
      );

      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error("POST /consolidation error:", err);
      res.status(500).json({ message: "Failed to create consolidation record" });
    }
  }
);

/* ===============================
   UPDATE (ADMIN ONLY)
================================= */
router.put(
  "/consolidation/:id",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { year, company_name, tin } = req.body;

      if (!year || !company_name || !tin) {
        return res.status(400).json({
          message: "year, company_name, and tin are required",
        });
      }

      const result = await pool.query(
        `
        UPDATE consolidation_2316
        SET year = $1,
            company_name = $2,
            tin = $3,
            updated_at = NOW()
        WHERE id = $4
        RETURNING *
        `,
        [year, company_name, tin, id]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ message: "Consolidation record not found" });
      }

      res.json(result.rows[0]);
    } catch (err) {
      console.error("PUT /consolidation/:id error:", err);
      res.status(500).json({ message: "Failed to update consolidation record" });
    }
  }
);

/* ===============================
   DELETE (ADMIN ONLY)
================================= */
router.delete(
  "/consolidation/:id",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    try {
      const { id } = req.params;

      const result = await pool.query(
        `
        DELETE FROM consolidation_2316
        WHERE id = $1
        RETURNING id
        `,
        [id]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ message: "Consolidation record not found" });
      }

      res.json({ message: "Consolidation record deleted successfully" });
    } catch (err) {
      console.error("DELETE /consolidation/:id error:", err);
      res.status(500).json({ message: "Failed to delete consolidation record" });
    }
  }
);

module.exports = router;