const express = require("express");
const router = express.Router();
const pool = require("../db");
const { requireAuth, requireRole } = require("../middlewares/authMiddleware");

const toInt = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

const toNum = (v) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const roleLower = (req) => String(req.user?.role || "").trim().toLowerCase();
const isAdmin = (req) => roleLower(req) === "admin";
const isBranchManager = (req) => roleLower(req) === "branch manager";

async function ensureBalanceRow(client, staffId) {
  await client.query(
    `
    INSERT INTO public.staff_balances
      (
        employee_id,
        fullname,
        "position",
        last_name,
        first_name,
        middle_name,
        cbu,
        cashbond,
        utility,
        salary_advance,
        motorcycle_loan,
        special_advance,
        cash_advance,
        other_receivable,
        staff_accounts_payable,
        created_at,
        updated_at
      )
    SELECT
      s.id,
      s.fullname,
      s."position",
      s.last_name,
      s.first_name,
      s.middle_name,
      0,0,0,
      0,0,0,0,
      0,0,
      NOW(), NOW()
    FROM public.staff s
    WHERE s.id = $1
    ON CONFLICT (employee_id) DO NOTHING
    `,
    [staffId]
  );
}

router.get(
  "/staff-balances",
  requireAuth,
  requireRole(["admin", "branch manager"]),
  async (req, res) => {
    try {
      // Admin
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
    } catch (e) {
      console.error("GET /api/staff-balances ERROR:", e.message);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

router.get(
  "/staff-balances/:staffId",
  requireAuth,
  requireRole(["admin", "branch manager"]),
  async (req, res) => {
    const client = await pool.connect();
    try {
      const staffId = toInt(req.params.staffId);
      if (!staffId) return res.status(400).json({ message: "Invalid staff id" });

      const myRole = roleLower(req);
      const myBranchId = req.user?.branch_id ?? null;

      if (myRole === "branch manager") {
        if (!myBranchId) return res.status(403).json({ message: "Access denied" });

        const s = await client.query(`SELECT id, branch_id FROM public.staff WHERE id=$1`, [staffId]);
        if (s.rowCount === 0) return res.status(404).json({ message: "Staff not found" });

        if (Number(s.rows[0].branch_id) !== Number(myBranchId)) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      await client.query("BEGIN");

      await ensureBalanceRow(client, staffId);

      const r = await client.query(
        `
        SELECT
          sb.employee_id,
          COALESCE(sb.fullname, s.fullname) AS fullname,
          COALESCE(sb."position", s."position") AS "position",
          COALESCE(sb.last_name, s.last_name) AS last_name,
          COALESCE(sb.first_name, s.first_name) AS first_name,
          COALESCE(sb.middle_name, s.middle_name) AS middle_name,

          COALESCE(sb.cbu,0) as cbu,
          COALESCE(sb.cashbond,0) as cashbond,
          COALESCE(sb.utility,0) as utility,

          COALESCE(sb.salary_advance,0) as salary_advance,
          COALESCE(sb.special_advance,0) as special_advance,
          COALESCE(sb.cash_advance,0) as cash_advance,
          COALESCE(sb.motorcycle_loan,0) as motorcycle_loan,
          COALESCE(sb.other_receivable,0) as other_receivable,
          COALESCE(sb.staff_accounts_payable,0) as staff_accounts_payable,

          sb.created_at,
          sb.updated_at
        FROM public.staff_balances sb
        LEFT JOIN public.staff s ON s.id = sb.employee_id
        WHERE sb.employee_id = $1
        LIMIT 1
        `,
        [staffId]
      );

      await ensureBalanceRow(client, staffId);
      
      await client.query("COMMIT");

      if (r.rowCount === 0) {
        return res.json({
          employee_id: staffId,
          fullname: "",
          position: "",
          last_name: "",
          first_name: "",
          middle_name: "",
          cbu: 0,
          cashbond: 0,
          utility: 0,
          salary_advance: 0,
          special_advance: 0,
          cash_advance: 0,
          motorcycle_loan: 0,
          other_receivable: 0,
          staff_accounts_payable: 0,
          created_at: null,
          updated_at: null,
        });
      }

      return res.json(r.rows[0]);
    } catch (e) {
      try {
        await client.query("ROLLBACK");
      } catch {}
      console.error("GET /api/staff-balances/:staffId ERROR:", e.message);
      return res.status(500).json({ message: "Server error" });
    } finally {
      client.release();
    }
  }
);

router.post(
  "/staff-balances/bootstrap",
  requireAuth,
  requireRole(["admin"]),
  async (_req, res) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const r = await client.query(
        `
        INSERT INTO public.staff_balances
          (
            employee_id,
            fullname,
            "position",
            last_name,
            first_name,
            middle_name,
            cbu,
            cashbond,
            utility,
            salary_advance,
            motorcycle_loan,
            special_advance,
            cash_advance,
            other_receivable,
            staff_accounts_payable,
            created_at,
            updated_at
          )
        SELECT
          s.id,
          s.fullname,
          s."position",
          s.last_name,
          s.first_name,
          s.middle_name,
          0,0,0,
          0,0,0,0,
          0,0,
          NOW(), NOW()
        FROM public.staff s
        LEFT JOIN public.staff_balances sb ON sb.employee_id = s.id
        WHERE sb.employee_id IS NULL
        `
      );

      await client.query("COMMIT");
      return res.json({ message: "Bootstrap done", inserted: r.rowCount });
    } catch (e) {
      try {
        await client.query("ROLLBACK");
      } catch {}
      console.error("POST /api/staff-balances/bootstrap ERROR:", e.message);
      return res.status(500).json({ message: "Server error" });
    } finally {
      client.release();
    }
  }
);

router.put(
  "/staff-balances/:staffId",
  requireAuth,
  requireRole(["admin", "branch manager"]),
  async (req, res) => {
    const client = await pool.connect();
    try {
      const staffId = toInt(req.params.staffId);
      if (!staffId) return res.status(400).json({ message: "Invalid staff id" });

      await client.query("BEGIN");

      await ensureBalanceRow(client, staffId);

      await client.query(
        `
        UPDATE public.staff_balances
        SET
          cbu = $1,
          cashbond = $2,
          utility = $3,
          salary_advance = $4,
          special_advance = $5,
          cash_advance = $6,
          motorcycle_loan = $7,
          other_receivable = $8,
          staff_accounts_payable = $9,
          updated_at = NOW()
        WHERE employee_id = $10
        `,
        [
          toNum(req.body?.cbu),
          toNum(req.body?.cashbond),
          toNum(req.body?.utility),
          toNum(req.body?.salary_advance),
          toNum(req.body?.special_advance),
          toNum(req.body?.cash_advance),
          toNum(req.body?.motorcycle_loan),
          toNum(req.body?.other_receivable),
          toNum(req.body?.staff_accounts_payable),
          staffId,
        ]
      );

      const r = await client.query(
        `SELECT * FROM public.staff_balances WHERE employee_id = $1 LIMIT 1`,
        [staffId]
      );

      await client.query("COMMIT");
      return res.json(r.rows[0] || null);
    } catch (e) {
      try {
        await client.query("ROLLBACK");
      } catch {}
      console.error("PUT /api/staff-balances/:staffId ERROR:", e.message);
      return res.status(500).json({ message: "Server error" });
    } finally {
      client.release();
    }
  }
);

module.exports = router;