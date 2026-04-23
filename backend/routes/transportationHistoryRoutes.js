const express = require("express");
const router = express.Router();
const pool = require("../db");
const { requireAuth } = require("../middlewares/authMiddleware");

const toNum = (v) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const toInt = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

const toStr = (v) => String(v ?? "").trim();

/* GET transportation history by branch + month */
router.get("/branch/:branchId", requireAuth, async (req, res) => {
  try {
    const branchId = toInt(req.params.branchId);
    const month = toStr(req.query.month);

    if (!branchId) {
      return res.status(400).json({ message: "Invalid branchId" });
    }

    if (!/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ message: "month must be YYYY-MM" });
    }

    const result = await pool.query(
      `
      SELECT
        id,
        branch_id,
        staff_id,
        employee_no,
        history_month,
        postage,
        transportation,
        additional_target,
        repairing,
        additional_monitoring,
        motorcycle_loan,
        other_deduction,
        created_at,
        updated_at
      FROM public.transportation_history
      WHERE branch_id = $1
        AND history_month = $2
      ORDER BY staff_id ASC
      `,
      [branchId, month]
    );

    return res.json(result.rows);
  } catch (err) {
    console.error("GET /transport-history/branch/:branchId ERROR:", err);
    return res.status(500).json({ message: "Failed to fetch transportation history" });
  }
});

/* SAVE transportation history by branch + staff + month */
router.post("/", requireAuth, async (req, res) => {
  try {
    const branch_id = toInt(req.body?.branch_id);
    const staff_id = toInt(req.body?.staff_id);
    const employee_no = toStr(req.body?.employee_no);
    const history_month = toStr(req.body?.history_month);
    const values = req.body?.values || {};

    if (!branch_id) {
      return res.status(400).json({ message: "branch_id is required" });
    }

    if (!staff_id) {
      return res.status(400).json({ message: "staff_id is required" });
    }

    if (!/^\d{4}-\d{2}$/.test(history_month)) {
      return res.status(400).json({ message: "history_month must be YYYY-MM" });
    }

    const result = await pool.query(
      `
      INSERT INTO public.transportation_history
      (
        branch_id,
        staff_id,
        employee_no,
        history_month,
        postage,
        transportation,
        additional_target,
        repairing,
        additional_monitoring,
        motorcycle_loan,
        other_deduction,
        updated_at
      )
      VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())

      ON CONFLICT (branch_id, staff_id, history_month)
      DO UPDATE SET
        employee_no = EXCLUDED.employee_no,
        postage = EXCLUDED.postage,
        transportation = EXCLUDED.transportation,
        additional_target = EXCLUDED.additional_target,
        repairing = EXCLUDED.repairing,
        additional_monitoring = EXCLUDED.additional_monitoring,
        motorcycle_loan = EXCLUDED.motorcycle_loan,
        other_deduction = EXCLUDED.other_deduction,
        updated_at = NOW()

      RETURNING *
      `,
      [
        branch_id,
        staff_id,
        employee_no || null,
        history_month,
        toNum(values.postage),
        toNum(values.transportation),
        toNum(values.additional_target),
        toNum(values.repairing),
        toNum(values.additional_monitoring),
        toNum(values.motorcycle_loan),
        toNum(values.other_deduction),
      ]
    );

    return res.json({
      message: "Transportation history saved",
      row: result.rows[0],
    });
  } catch (err) {
    console.error("POST /transport-history ERROR:", err);
    return res.status(500).json({ message: "Failed to save transportation history" });
  }
});

/* DELETE transportation history by branch + staff + month */
router.delete("/branch/:branchId/staff/:staffId", requireAuth, async (req, res) => {
  try {
    const branchId = toInt(req.params.branchId);
    const staffId = toInt(req.params.staffId);
    const month = toStr(req.query.month);

    if (!branchId || !staffId) {
      return res.status(400).json({ message: "Invalid branchId or staffId" });
    }

    if (!/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ message: "month must be YYYY-MM" });
    }

    await pool.query(
      `
      DELETE FROM public.transportation_history
      WHERE branch_id = $1
        AND staff_id = $2
        AND history_month = $3
      `,
      [branchId, staffId, month]
    );

    return res.json({ message: "Transportation history removed" });
  } catch (err) {
    console.error("DELETE /transport-history/branch/:branchId/staff/:staffId ERROR:", err);
    return res.status(500).json({ message: "Failed to remove transportation history" });
  }
});

module.exports = router;