const express = require("express");
const router = express.Router();
const pool = require("../db");

// Use the same middleware you already use in your other routes
const { requireAuth /*, requireRole*/ } = require("../middlewares/authMiddleware");

const toNum = (v) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const toInt = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

const toDateOnly = (v) => String(v ?? "").slice(0, 10); // YYYY-MM-DD

/**
 * POST /bonus/run
 * Create or get a bonus run for a branch + bonus_month.
 * body: { branch_id, bonus_month, notes? }
 * bonus_month should be the first day of month e.g. "2026-12-01"
 */
router.post("/run", requireAuth, async (req, res) => {
  const branch_id = toInt(req.body.branch_id);
  const bonus_month = toDateOnly(req.body.bonus_month);
  const notes = req.body.notes ?? null;

  if (!branch_id || !bonus_month) {
    return res.status(400).json({ message: "branch_id and bonus_month are required." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Try find existing run
    const existing = await client.query(
      `SELECT id FROM bonus_runs WHERE branch_id = $1 AND bonus_month = $2 LIMIT 1`,
      [branch_id, bonus_month]
    );

    let runId;

    if (existing.rowCount > 0) {
      runId = existing.rows[0].id;

      await client.query(
        `UPDATE bonus_runs
         SET notes = COALESCE($2, notes),
             updated_at = NOW()
         WHERE id = $1`,
        [runId, notes]
      );
    } else {
      const inserted = await client.query(
        `INSERT INTO bonus_runs (branch_id, bonus_month, notes)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [branch_id, bonus_month, notes]
      );
      runId = inserted.rows[0].id;
    }

    await client.query("COMMIT");
    return res.json({ bonus_run_id: runId });
  } catch (err) {
    await client.query("ROLLBACK");
    return res.status(500).json({ message: err?.message || "Failed to create bonus run." });
  } finally {
    client.release();
  }
});

/**
 * GET /bonus/run/:runId
 * Get run header + its lines.
 */
router.get("/run/:runId", requireAuth, async (req, res) => {
  const runId = toInt(req.params.runId);
  if (!runId) return res.status(400).json({ message: "Invalid runId" });

  try {
    const runRes = await pool.query(
      `SELECT id, branch_id, bonus_month, notes, created_at, updated_at
       FROM bonus_runs
       WHERE id = $1`,
      [runId]
    );

    if (runRes.rowCount === 0) {
      return res.status(404).json({ message: "Bonus run not found." });
    }

    const linesRes = await pool.query(
      `SELECT
         id,
         bonus_run_id,
         staff_id,
         salary,
         month_13,
         month_14,
         month_15,
         created_at,
         updated_at
       FROM bonus_lines
       WHERE bonus_run_id = $1
       ORDER BY staff_id`,
      [runId]
    );

    return res.json({
      run: runRes.rows[0],
      lines: linesRes.rows,
    });
  } catch (err) {
    return res.status(500).json({ message: err?.message || "Failed to load bonus run." });
  }
});

/**
 * POST /bonus/run/:runId/lines
 * Upsert lines for a run.
 * body: { lines: [{ staff_id, salary, month_13, month_14, month_15 }] }
 */
router.post("/run/:runId/lines", requireAuth, async (req, res) => {
  // If you want admin-only saving, uncomment:
  // router.post("/run/:runId/lines", requireAuth, requireRole("admin"), async (req, res) => {

  const runId = toInt(req.params.runId);
  if (!runId) return res.status(400).json({ message: "Invalid runId" });

  const lines = Array.isArray(req.body.lines) ? req.body.lines : [];
  if (lines.length === 0) return res.status(400).json({ message: "lines is required." });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Validate run exists
    const runCheck = await client.query(`SELECT id FROM bonus_runs WHERE id = $1`, [runId]);
    if (runCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Bonus run not found." });
    }

    for (const l of lines) {
      const staff_id = toInt(l.staff_id);
      if (!staff_id) continue;

      const salary = toNum(l.salary);
      const month_13 = toNum(l.month_13);
      const month_14 = toNum(l.month_14);
      const month_15 = toNum(l.month_15);

      await client.query(
        `INSERT INTO bonus_lines (bonus_run_id, staff_id, salary, month_13, month_14, month_15)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (bonus_run_id, staff_id)
         DO UPDATE SET
           salary = EXCLUDED.salary,
           month_13 = EXCLUDED.month_13,
           month_14 = EXCLUDED.month_14,
           month_15 = EXCLUDED.month_15,
           updated_at = NOW()`,
        [runId, staff_id, salary, month_13, month_14, month_15]
      );
    }

    await client.query(
      `UPDATE bonus_runs SET updated_at = NOW() WHERE id = $1`,
      [runId]
    );

    await client.query("COMMIT");
    return res.json({ message: "Bonus saved." });
  } catch (err) {
    await client.query("ROLLBACK");
    return res.status(500).json({ message: err?.message || "Failed to save bonus lines." });
  } finally {
    client.release();
  }
});

module.exports = router;