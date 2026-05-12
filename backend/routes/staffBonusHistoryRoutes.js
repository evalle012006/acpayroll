const express = require("express");
const router = express.Router();
const pool = require("../db");

const { requireAuth } = require("../middlewares/authMiddleware");
const { requirePermission } = require("../middlewares/permissionMiddleware");

/* ================= HELPERS ================= */

const toInt = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

const toNum = (v) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const toStr = (v) => String(v ?? "").trim();

const normalizeDate = (v) => {
  const s = String(v ?? "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};

/* =========================================================
   GET STAFF BONUS HISTORY
========================================================= */

router.get(
  "/staff-bonus-history/staff/:staffId",
  requireAuth,
  requirePermission("staff_bonus_history", "view"),
  async (req, res) => {
    try {
      const staffId = toInt(req.params.staffId);

      if (!staffId) {
        return res.status(400).json({
          message: "Invalid staff id.",
        });
      }

      const result = await pool.query(
        `
        SELECT
          id,
          staff_id,
          employee_no,
          bonus_type,
          bonus_month,
          amount,
          release_date,
          remarks,
          created_by,
          created_at
        FROM public.staff_bonus_history
        WHERE staff_id = $1
        ORDER BY
          release_date DESC NULLS LAST,
          created_at DESC,
          id DESC
        `,
        [staffId]
      );

      return res.json(result.rows);
    } catch (err) {
      console.error("GET /staff-bonus-history ERROR:", err?.message);

      return res.status(500).json({
        message: err?.message || "Failed to load bonus history.",
      });
    }
  }
);

/* =========================================================
   UPDATE BONUS HISTORY
========================================================= */

router.put(
  "/staff-bonus-history/:id",
  requireAuth,
  requirePermission("staff_bonus_history", "edit"),
  async (req, res) => {
    try {
      const id = toInt(req.params.id);
      const amount = toNum(req.body?.amount);
      const release_date = normalizeDate(req.body?.release_date);
      const remarks = toStr(req.body?.remarks) || null;

      if (!id) {
        return res.status(400).json({
          message: "Invalid history id.",
        });
      }

      if (amount < 0) {
        return res.status(400).json({
          message: "Amount cannot be negative.",
        });
      }

      const existing = await pool.query(
        `
        SELECT id
        FROM public.staff_bonus_history
        WHERE id = $1
        `,
        [id]
      );

      if (existing.rowCount === 0) {
        return res.status(404).json({
          message: "Bonus history not found.",
        });
      }

      const updated = await pool.query(
        `
        UPDATE public.staff_bonus_history
        SET
          amount = $2,
          release_date = COALESCE($3::date, release_date),
          remarks = $4
        WHERE id = $1
        RETURNING *;
        `,
        [id, amount, release_date, remarks]
      );

      return res.json(updated.rows[0]);
    } catch (err) {
      console.error("PUT /staff-bonus-history ERROR:", err?.message);

      return res.status(500).json({
        message: err?.message || "Failed to update bonus history.",
      });
    }
  }
);

/* =========================================================
   CREATE BONUS HISTORY
========================================================= */

router.post(
  "/staff-bonus-history",
  requireAuth,
  requirePermission("staff_bonus_history", "create"),
  async (req, res) => {
    try {
      const staff_id = toInt(req.body?.staff_id);
      const employee_no = toStr(req.body?.employee_no);
      const bonus_type = toStr(req.body?.bonus_type) || "13th Month";
      const bonus_month = normalizeDate(req.body?.bonus_month);
      const amount = toNum(req.body?.amount);
      const release_date = normalizeDate(req.body?.release_date);
      const remarks = toStr(req.body?.remarks);

      if (!staff_id || !bonus_month) {
        return res.status(400).json({
          message: "staff_id and bonus_month are required.",
        });
      }

      if (amount < 0) {
        return res.status(400).json({
          message: "Amount cannot be negative.",
        });
      }

      const staffCheck = await pool.query(
        `
        SELECT id, employee_no
        FROM public.staff
        WHERE id = $1
        LIMIT 1
        `,
        [staff_id]
      );

      if (staffCheck.rowCount === 0) {
        return res.status(404).json({
          message: "Staff not found.",
        });
      }

      const result = await pool.query(
        `
        INSERT INTO public.staff_bonus_history
        (
          staff_id,
          employee_no,
          bonus_type,
          bonus_month,
          amount,
          release_date,
          remarks,
          created_by,
          created_at
        )
        VALUES
        ($1,$2,$3,$4::date,$5,$6::date,$7,$8,NOW())
        RETURNING *;
        `,
        [
          staff_id,
          employee_no || staffCheck.rows[0].employee_no || null,
          bonus_type,
          bonus_month,
          amount,
          release_date,
          remarks || null,
          req.user?.id ?? null,
        ]
      );

      return res.json(result.rows[0]);
    } catch (err) {
      console.error("POST /staff-bonus-history ERROR:", err?.message);

      return res.status(500).json({
        message: err?.message || "Failed to create bonus history.",
      });
    }
  }
);

module.exports = router;