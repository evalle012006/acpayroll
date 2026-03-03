const express = require("express");
const router = express.Router();
const pool = require("../db");
const { requireAuth, requireRole } = require("../middlewares/authMiddleware");

const toNum = (v) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

// month "YYYY-MM" -> "YYYY-MM-01"
const monthToDate = (monthStr) => {
  const m = String(monthStr || "").trim();
  if (!/^\d{4}-\d{2}$/.test(m)) return null;
  return `${m}-01`;
};

/**
 * ✅ GET snapshots for a month
 * GET /api/schedule-balances?month=YYYY-MM&branchId=1
 */
router.get("/", requireAuth, async (req, res) => {
  try {
    const snapshotMonth = monthToDate(req.query.month);
    const branchId = req.query.branchId ? Number(req.query.branchId) : null;

    if (!snapshotMonth) {
      return res.status(400).json({ message: "month is required in YYYY-MM format" });
    }

    const params = [snapshotMonth];
    let sql = `
      SELECT
        id,
        snapshot_month,
        staff_id,
        employee_id,
        fullname,
        position,
        branch_id,
        cbu,
        cashbond,
        salary_advance,
        motorcycle_loan,
        special_advance,
        cash_advance,
        other_receivable,
        staff_accounts_payable,
        created_at,
        updated_at
      FROM public.schedule_balance_snapshots
      WHERE snapshot_month = $1
    `;

    if (branchId) {
      params.push(branchId);
      sql += ` AND branch_id = $2`;
    }

    sql += ` ORDER BY fullname ASC`;

    const result = await pool.query(sql, params);
    return res.json(result.rows);
  } catch (e) {
    console.error("GET /api/schedule-balances ERROR:", e.message);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * ✅ POST: create monthly snapshot FROM CURRENT staff_balances
 * POST /api/schedule-balances/snapshot/from-current
 * body: { month: "YYYY-MM" }
 *
 * Admin only
 */
router.post("/snapshot/from-current", requireAuth, requireRole(["Admin"]), async (req, res) => {
  const snapshotMonth = monthToDate(req.body?.month);

  if (!snapshotMonth) {
    return res.status(400).json({ message: "month is required in YYYY-MM format" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    /**
     * ✅ IMPORTANT:
     * staff_balances has NO branch_id, so we LEFT JOIN staff to get branch_id
     *
     * Assumption: public.staff.id matches staff_balances.id
     * If yours is different, tell me and I’ll adjust.
     */
    const current = await client.query(`
      SELECT
        sb.id AS staff_id,
        sb.employee_id,
        sb.fullname,
        sb.position,
        s.branch_id,
        COALESCE(sb.cbu, 0) AS cbu,
        COALESCE(sb.cashbond, 0) AS cashbond,
        COALESCE(sb.salary_advance, 0) AS salary_advance,
        COALESCE(sb.motorcycle_loan, 0) AS motorcycle_loan,
        COALESCE(sb.special_advance, 0) AS special_advance,
        COALESCE(sb.cash_advance, 0) AS cash_advance,
        COALESCE(sb.other_receivable, 0) AS other_receivable,
        COALESCE(sb.staff_accounts_payable, 0) AS staff_accounts_payable
      FROM public.staff_balances sb
      LEFT JOIN public.staff s ON s.id = sb.id
      ORDER BY sb.fullname ASC
    `);

    const rows = current.rows || [];

    // nothing to snapshot
    if (rows.length === 0) {
      await client.query("COMMIT");
      return res.json({ message: "No rows found in staff_balances", month: snapshotMonth, count: 0 });
    }

    // upsert each row into snapshots
    for (const r of rows) {
      const staff_id = Number(r.staff_id);
      if (!staff_id) continue;

      await client.query(
        `
        INSERT INTO public.schedule_balance_snapshots (
          snapshot_month,
          staff_id,
          employee_id,
          fullname,
          position,
          branch_id,
          cbu,
          cashbond,
          salary_advance,
          motorcycle_loan,
          special_advance,
          cash_advance,
          other_receivable,
          staff_accounts_payable,
          created_at,
          updated_at
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,
          $7,$8,$9,$10,$11,$12,$13,$14,
          NOW(), NOW()
        )
        ON CONFLICT (snapshot_month, staff_id)
        DO UPDATE SET
          employee_id = EXCLUDED.employee_id,
          fullname = EXCLUDED.fullname,
          position = EXCLUDED.position,
          branch_id = EXCLUDED.branch_id,
          cbu = EXCLUDED.cbu,
          cashbond = EXCLUDED.cashbond,
          salary_advance = EXCLUDED.salary_advance,
          motorcycle_loan = EXCLUDED.motorcycle_loan,
          special_advance = EXCLUDED.special_advance,
          cash_advance = EXCLUDED.cash_advance,
          other_receivable = EXCLUDED.other_receivable,
          staff_accounts_payable = EXCLUDED.staff_accounts_payable,
          updated_at = NOW()
        `,
        [
          snapshotMonth,
          staff_id,
          r.employee_id ? Number(r.employee_id) : null,
          String(r.fullname || ""),
          String(r.position || ""),
          r.branch_id ? Number(r.branch_id) : null,
          toNum(r.cbu),
          toNum(r.cashbond),
          toNum(r.salary_advance),
          toNum(r.motorcycle_loan),
          toNum(r.special_advance),
          toNum(r.cash_advance),
          toNum(r.other_receivable),
          toNum(r.staff_accounts_payable),
        ]
      );
    }

    await client.query("COMMIT");
    return res.json({ message: "Snapshot saved from current balances", month: snapshotMonth, count: rows.length });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("POST /api/schedule-balances/snapshot/from-current ERROR:", e.message);
    return res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
});

module.exports = router;