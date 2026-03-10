const express = require("express");
const router = express.Router();
const pool = require("../db");
const { requireAuth, requireRole } = require("../middlewares/authMiddleware");

const toNum = (v) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const toInt = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

const roleLower = (req) => String(req.user?.role || "").trim().toLowerCase();
const isAdmin = (req) => roleLower(req) === "admin";

async function staffIdFromEmployeeNo(client, employee_no) {
  const eno = String(employee_no || "").trim();
  if (!eno) return { staffId: null, staff: null };

  const s = await client.query(
    `
    SELECT id, employee_no, fullname, first_name, last_name, middle_name, "position"
    FROM public.staff
    WHERE employee_no = $1
    `,
    [eno]
  );

  if (s.rowCount === 0) return { staffId: null, staff: null };
  return { staffId: toInt(s.rows[0].id), staff: s.rows[0] };
}

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
      0, 0, 0,
      0, 0, 0, 0,
      0, 0,
      NOW(), NOW()
    FROM public.staff s
    WHERE s.id = $1::int
    ON CONFLICT (employee_id) DO NOTHING
    `,
    [staffId]
  );
}

router.get("/staff-accounts-payable", requireAuth, async (_req, res) => {
  try {
    const r = await pool.query(
      `
      SELECT
        sap.id,
        sap.employee_id,
        sap.staff_name,
        sap.description,
        sap.amount,
        sap.term,
        sap.per_month,
        sap.balance,
        sap.payable_id,
        sap.status,
        sap.created_at,
        sap.created_by,
        sap.approved_by,
        sap.approved_at,
        sap.rejected_by,
        sap.rejected_at,
        sap.rejection_reason,
        sap.last_name,
        sap.first_name,
        sap.middle_name,
        sap.entry_date,
        COALESCE(sap.employee_no, s.employee_no) AS employee_no
      FROM public.staff_accounts_payable sap
      LEFT JOIN public.staff s ON s.id = sap.employee_id
      ORDER BY sap.id DESC
      `
    );

    return res.json(r.rows);
  } catch (e) {
    console.error("GET /api/staff-accounts-payable ERROR:", e.message);
    return res.status(500).json({ message: e?.message || "Server error" });
  }
});

router.get("/staff-accounts-payable/employee/:employeeNo", requireAuth, async (req, res) => {
  const client = await pool.connect();

  try {
    const employeeNo = String(req.params.employeeNo || "").trim();
    if (!employeeNo) return res.status(400).json({ message: "Invalid employee_no" });

    const { staffId } = await staffIdFromEmployeeNo(client, employeeNo);
    if (!staffId) return res.status(404).json({ message: "Staff not found" });

    const r = await client.query(
      `
      SELECT
        sap.*,
        $1::varchar AS employee_no
      FROM public.staff_accounts_payable sap
      WHERE sap.employee_id = $2::int
      ORDER BY sap.id DESC
      `,
      [employeeNo, staffId]
    );

    return res.json(r.rows);
  } catch (e) {
    console.error("GET /api/staff-accounts-payable/employee/:employeeNo ERROR:", e.message);
    return res.status(500).json({ message: e?.message || "Server error" });
  } finally {
    client.release();
  }
});

router.post(
  "/staff-accounts-payable",
  requireAuth,
  requireRole(["admin", "branch manager"]),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const employee_no = String(req.body?.employee_no || "").trim();
      const staff_name = String(req.body?.staff_name || "").trim();
      const description = String(req.body?.description || "").trim();

      const amount = toNum(req.body?.amount);
      const term = Math.max(1, toInt(req.body?.term) || 1);
      const per_month = toNum(req.body?.per_month) || (term ? amount / term : 0);
      const balance =
        req.body?.balance === "" || req.body?.balance == null
          ? amount
          : toNum(req.body?.balance);

      if (!employee_no) return res.status(400).json({ message: "employee_no is required" });
      if (!staff_name) return res.status(400).json({ message: "staff_name is required" });
      if (!description) return res.status(400).json({ message: "description is required" });
      if (!amount) return res.status(400).json({ message: "amount is required" });
      if (!term) return res.status(400).json({ message: "term is required" });

      await client.query("BEGIN");

      const { staffId, staff } = await staffIdFromEmployeeNo(client, employee_no);
      if (!staffId) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Staff not found" });
      }

      const ins = await client.query(
        `
        INSERT INTO public.staff_accounts_payable
          (
            employee_id,
            employee_no,
            staff_name,
            description,
            amount,
            term,
            per_month,
            balance,
            status,
            created_by,
            first_name,
            last_name,
            middle_name
          )
        VALUES
          ($1::int, $2::varchar, $3::varchar, $4::varchar, $5::numeric, $6::int, $7::numeric, $8::numeric, 'Pending', $9::int, $10::varchar, $11::varchar, $12::varchar)
        RETURNING *;
        `,
        [
          staffId,
          employee_no,
          staff_name,
          description,
          amount,
          term,
          per_month,
          balance,
          req.user?.id ?? null,
          staff?.first_name ?? null,
          staff?.last_name ?? null,
          staff?.middle_name ?? null,
        ]
      );

      await client.query("COMMIT");
      return res.json(ins.rows[0]);
    } catch (e) {
      try {
        await client.query("ROLLBACK");
      } catch {}
      console.error("POST /api/staff-accounts-payable ERROR:", e.message);
      return res.status(500).json({ message: e?.message || "Server error" });
    } finally {
      client.release();
    }
  }
);

router.put("/staff-accounts-payable/:id", requireAuth, async (req, res) => {
  const client = await pool.connect();

  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });

    const status = String(req.body?.status || "").trim();
    const reason = String(req.body?.reason || "").trim();

    if (!status) return res.status(400).json({ message: "status is required" });

    const sLower = status.toLowerCase();

    if ((sLower === "approved" || sLower === "rejected") && !isAdmin(req)) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (sLower === "rejected" && !reason) {
      return res.status(400).json({ message: "reason is required for rejection" });
    }

    await client.query("BEGIN");

    const cur = await client.query(
      `
      SELECT
        id,
        employee_id,
        status,
        amount,
        balance
      FROM public.staff_accounts_payable
      WHERE id = $1::bigint
      FOR UPDATE
      `,
      [id]
    );

    if (cur.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "SAP record not found" });
    }

    const prevStatus = String(cur.rows[0].status || "").trim();
    const employeeId = toInt(cur.rows[0].employee_id);
    const balToAdd = toNum(cur.rows[0].balance);
    const amtFallback = toNum(cur.rows[0].amount);
    const addValue = balToAdd > 0 ? balToAdd : amtFallback;

    const upd = await client.query(
      `
      UPDATE public.staff_accounts_payable
      SET
        status = $1::varchar,
        approved_by = CASE
          WHEN $1::varchar = 'Approved' THEN $2::int
          ELSE approved_by
        END,
        approved_at = CASE
          WHEN $1::varchar = 'Approved' THEN NOW()
          ELSE approved_at
        END,
        rejected_by = CASE
          WHEN $1::varchar = 'Rejected' THEN $2::int
          ELSE rejected_by
        END,
        rejected_at = CASE
          WHEN $1::varchar = 'Rejected' THEN NOW()
          ELSE rejected_at
        END,
        rejection_reason = CASE
          WHEN $1::varchar = 'Rejected' THEN $3::text
          ELSE rejection_reason
        END
      WHERE id = $4::bigint
      RETURNING *;
      `,
      [status, req.user?.id ?? null, reason || null, id]
    );

    if (prevStatus !== "Approved" && status === "Approved" && employeeId) {
      await ensureBalanceRow(client, employeeId);

      await client.query(
        `
        UPDATE public.staff_balances
        SET
          staff_accounts_payable = COALESCE(staff_accounts_payable, 0) + $1::numeric,
          updated_at = NOW()
        WHERE employee_id = $2::int
        `,
        [addValue, employeeId]
      );
    }

    await client.query("COMMIT");
    return res.json(upd.rows[0]);
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {}
    console.error("PUT /api/staff-accounts-payable/:id ERROR:", e.message);
    return res.status(500).json({ message: e?.message || "Server error" });
  } finally {
    client.release();
  }
});

module.exports = router;