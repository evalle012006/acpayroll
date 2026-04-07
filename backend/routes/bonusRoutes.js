const express = require("express");
const router = express.Router();
const pool = require("../db");
const { requireAuth, requireRole } = require("../middlewares/authMiddleware");

/* ================= HELPERS ================= */
const toNum = (v) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const toInt = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

const normalizeDate = (v) => {
  const s = String(v ?? "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};

const normalizeBonusMonth = (v) => {
  const s = normalizeDate(v);
  if (!s) return null;
  const [y, m] = s.split("-");
  return `${y}-${m}-01`;
};

/* ================= GET BRANCH BONUS ================= */
router.get("/branch/:branchId", requireAuth, async (req, res) => {
  try {
    const branchId = toInt(req.params.branchId);
    if (!branchId) {
      return res.status(400).json({ message: "Invalid branchId." });
    }

    const result = await pool.query(
      `
      SELECT
        bl.id,
        bl.bonus_run_id,
        bl.employee_id,
        bl.salary,
        bl.month_13,
        bl.month_14,
        bl.month_15,
        bl.percentage,
        bl.result,
        bl.is_released,
        bl.release_date,
        bl.created_at,
        bl.updated_at,

        br.branch_id,
        br.bonus_month,

        s.employee_no,
        s.fullname,
        s.position
      FROM public.bonus_lines bl
      INNER JOIN public.bonus_runs br
        ON br.id = bl.bonus_run_id
      LEFT JOIN public.staff s
        ON s.id = bl.employee_id
      WHERE br.branch_id = $1
      ORDER BY br.bonus_month DESC, bl.updated_at DESC, bl.id DESC
      `,
      [branchId]
    );

    return res.json(result.rows);
  } catch (err) {
    console.error("GET /bonus/branch ERROR:", err?.message);
    return res.status(500).json({
      message: err?.message || "Failed to load branch bonus lines.",
    });
  }
});

/* ================= CREATE / GET RUN ================= */
router.post("/run", requireAuth, requireRole(["admin"]), async (req, res) => {
  const branch_id = toInt(req.body?.branch_id);
  const bonus_month = normalizeBonusMonth(req.body?.bonus_month);
  const notes = req.body?.notes ?? null;

  if (!branch_id || !bonus_month) {
    return res.status(400).json({
      message: "branch_id and bonus_month are required.",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existing = await client.query(
      `
      SELECT id
      FROM public.bonus_runs
      WHERE branch_id = $1 AND bonus_month = $2::date
      LIMIT 1
      `,
      [branch_id, bonus_month]
    );

    let runId;

    if (existing.rowCount > 0) {
      runId = existing.rows[0].id;

      await client.query(
        `
        UPDATE public.bonus_runs
        SET notes = COALESCE($2, notes),
            updated_at = NOW()
        WHERE id = $1
        `,
        [runId, notes]
      );
    } else {
      const inserted = await client.query(
        `
        INSERT INTO public.bonus_runs
          (branch_id, bonus_month, notes, created_at, updated_at)
        VALUES ($1, $2::date, $3, NOW(), NOW())
        RETURNING id
        `,
        [branch_id, bonus_month, notes]
      );

      runId = inserted.rows[0].id;
    }

    await client.query("COMMIT");

    return res.json({
      bonus_run_id: runId,
      branch_id,
      bonus_month,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("POST /bonus/run ERROR:", err?.message);
    return res.status(500).json({
      message: err?.message || "Failed to create bonus run.",
    });
  } finally {
    client.release();
  }
});

/* ================= GET RUN DETAILS ================= */
router.get("/run/:runId", requireAuth, async (req, res) => {
  try {
    const runId = toInt(req.params.runId);
    if (!runId) {
      return res.status(400).json({ message: "Invalid runId." });
    }

    const runRes = await pool.query(
      `SELECT * FROM public.bonus_runs WHERE id = $1`,
      [runId]
    );

    if (runRes.rowCount === 0) {
      return res.status(404).json({ message: "Bonus run not found." });
    }

    const linesRes = await pool.query(
      `
      SELECT
        bl.*,
        s.employee_no,
        s.fullname AS employee_name,
        s.position
      FROM public.bonus_lines bl
      LEFT JOIN public.staff s
        ON s.id = bl.employee_id
      WHERE bl.bonus_run_id = $1
      ORDER BY s.fullname ASC NULLS LAST
      `,
      [runId]
    );

    return res.json({
      run: runRes.rows[0],
      lines: linesRes.rows,
    });
  } catch (err) {
    console.error("GET /bonus/run/:runId ERROR:", err?.message);
    return res.status(500).json({
      message: err?.message || "Failed to load bonus run.",
    });
  }
});

/* ================= UPSERT BONUS LINES ================= */
router.post("/run/:runId/lines", requireAuth, requireRole(["admin"]), async (req, res) => {
  const runId = toInt(req.params.runId);
  const lines = Array.isArray(req.body?.lines) ? req.body.lines : [];

  if (!runId) {
    return res.status(400).json({ message: "Invalid runId." });
  }

  if (lines.length === 0) {
    return res.status(400).json({ message: "lines is required." });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const runCheck = await client.query(
      `SELECT id FROM public.bonus_runs WHERE id = $1`,
      [runId]
    );

    if (runCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Bonus run not found." });
    }

    const upserted = [];

    for (const l of lines) {
      const employee_id = toInt(l.employee_id);
      if (!employee_id) continue;

      const result = await client.query(
        `
        INSERT INTO public.bonus_lines (
          bonus_run_id,
          employee_id,
          salary,
          month_13,
          month_14,
          month_15,
          percentage,
          result,
          is_released,
          release_date,
          created_at,
          updated_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,false,NULL,NOW(),NOW())
        ON CONFLICT (bonus_run_id, employee_id)
        DO UPDATE SET
          salary = EXCLUDED.salary,
          month_13 = EXCLUDED.month_13,
          month_14 = EXCLUDED.month_14,
          month_15 = EXCLUDED.month_15,
          percentage = EXCLUDED.percentage,
          result = EXCLUDED.result,
          updated_at = NOW()
        RETURNING *;
        `,
        [
          runId,
          employee_id,
          toNum(l.salary),
          toNum(l.month_13),
          toNum(l.month_14),
          toNum(l.month_15),
          toNum(l.percentage),
          toNum(l.result),
        ]
      );

      upserted.push(result.rows[0]);
    }

    await client.query(
      `UPDATE public.bonus_runs SET updated_at = NOW() WHERE id = $1`,
      [runId]
    );

    await client.query("COMMIT");

    return res.json({
      message: "Bonus saved.",
      lines: upserted,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("POST /bonus/run/:runId/lines ERROR:", err?.message);
    return res.status(500).json({
      message: err?.message || "Failed to save bonus lines.",
    });
  } finally {
    client.release();
  }
});

/* ================= RELEASE BONUS ================= */
router.put("/line/:lineId/release", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const lineId = toInt(req.params.lineId);
    const release_date = normalizeDate(req.body?.release_date);

    if (!lineId) {
      return res.status(400).json({ message: "Invalid lineId." });
    }

    if (!release_date) {
      return res.status(400).json({ message: "Valid release_date is required." });
    }

    const result = await pool.query(
      `
      UPDATE public.bonus_lines
      SET
        is_released = true,
        release_date = $1::date,
        updated_at = NOW()
      WHERE id = $2
      RETURNING *;
      `,
      [release_date, lineId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Bonus line not found." });
    }

    return res.json(result.rows[0]);
  } catch (err) {
    console.error("PUT /bonus/line/:lineId/release ERROR:", err?.message);
    return res.status(500).json({
      message: err?.message || "Failed to release bonus.",
    });
  }
});

module.exports = router;