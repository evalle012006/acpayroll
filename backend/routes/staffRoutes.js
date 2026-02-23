const express = require("express");
const router = express.Router();
const pool = require("../db");
const { requireAuth, requireRole } = require("../middlewares/authMiddleware");

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const toInt = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

const loanTypeToBalanceColumn = (loanType) => {
  if (loanType === "Motorcycle Loan") return "motorcycle_loan";
  if (loanType === "Salary Advance" || loanType === "Advance Loan") return "salary_advance";
  if (loanType === "Cash Advance" || loanType === "Cash Loan") return "cash_advance";
  if (loanType === "Special Advance" || loanType === "Special Loan") return "special_advance";
  return null;
};

const roleLower = (req) => String(req.user?.role || "").toLowerCase();
const isAdmin = (req) => roleLower(req) === "admin";
const isBranchManager = (req) => roleLower(req) === "branch manager";
const getUserBranchId = (req) => req.user?.branch_id ?? null;

router.get("/branches", requireAuth, async (req, res) => {
  try {
    if (isAdmin(req)) {
      const result = await pool.query("SELECT id, code, name, area FROM public.branches ORDER BY id ASC");
      return res.json(result.rows);
    }

    if (isBranchManager(req)) {
      const bid = getUserBranchId(req);
      if (!bid) return res.json([]);
      const result = await pool.query("SELECT id, code, name, area FROM public.branches WHERE id=$1", [bid]);
      return res.json(result.rows);
    }

    return res.status(403).json({ message: "Access denied" });
  } catch (e) {
    console.error("GET /api/branches ERROR:", e.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/branches", requireAuth, requireRole(["Admin"]), async (req, res) => {
  try {
    const { code, name, area } = req.body;
    if (!code || !name || !area) return res.status(400).json({ message: "code, name, area required" });

    const result = await pool.query(
      `INSERT INTO public.branches (code, name, area) VALUES ($1,$2,$3) RETURNING id, code, name, area`,
      [code, name, area]
    );

    res.json({ message: "Branch created", branch: result.rows[0] });
  } catch (e) {
    console.error("POST /api/branches ERROR:", e.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.put("/branches/:id", requireAuth, requireRole(["Admin"]), async (req, res) => {
  try {
    const { id } = req.params;
    const { code, name, area } = req.body;
    if (!code || !name || !area) return res.status(400).json({ message: "code, name, area required" });

    const result = await pool.query(
      `UPDATE public.branches SET code=$1, name=$2, area=$3 WHERE id=$4 RETURNING id, code, name, area`,
      [code, name, area, id]
    );

    if (result.rows.length === 0) return res.status(404).json({ message: "Branch not found" });
    res.json({ message: "Branch updated", branch: result.rows[0] });
  } catch (e) {
    console.error("PUT /api/branches/:id ERROR:", e.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.delete("/branches/:id", requireAuth, requireRole(["Admin"]), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query("DELETE FROM public.branches WHERE id=$1 RETURNING id", [id]);
    if (result.rows.length === 0) return res.status(404).json({ message: "Branch not found" });
    res.json({ message: "Branch deleted" });
  } catch (e) {
    console.error("DELETE /api/branches/:id ERROR:", e.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/staff", requireAuth, async (req, res) => {
  try {
    if (isAdmin(req)) {
      const result = await pool.query("SELECT * FROM public.staff ORDER BY id DESC");
      return res.json(result.rows);
    }

    if (isBranchManager(req)) {
      const bid = getUserBranchId(req);
      if (!bid) return res.json([]);
      const result = await pool.query("SELECT * FROM public.staff WHERE branch_id=$1 ORDER BY id DESC", [bid]);
      return res.json(result.rows);
    }

    return res.status(403).json({ message: "Access denied" });
  } catch (e) {
    console.error("GET /api/staff ERROR:", e.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/staff", requireAuth, requireRole(["Admin"]), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const {
      employee_no, fullname, position, department, area,
      salary, ecola, branch_id, regularization_date,
      motorcycle_loan, postage, transportation,
      additional_target, repairing, additional_monitoring,
      motorcycle, other_deduction,
    } = req.body;

    const staffInsert = await client.query(
      `
      INSERT INTO public.staff
        (employee_no, fullname, "position", department, area, salary, ecola, branch_id, regularization_date, motorcycle_loan,
         postage, transportation, additional_target, repairing, additional_monitoring, motorcycle, other_deduction)
      VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
      RETURNING id, fullname, "position";
      `,
      [
        employee_no || null,
        fullname,
        position,
        department,
        area,
        toNum(salary),
        toNum(ecola),
        toInt(branch_id),
        regularization_date || null,
        toNum(motorcycle_loan),
        toNum(postage),
        toNum(transportation),
        toNum(additional_target),
        toNum(repairing),
        toNum(additional_monitoring),
        toNum(motorcycle),
        toNum(other_deduction),
      ]
    );

    const s = staffInsert.rows[0];

    await client.query(
      `
      INSERT INTO public.staff_balances
        (employee_id, fullname, "position",
         cbu, cashbond, salary_advance, motorcycle_loan, special_advance, cash_advance, other_receivable, staff_accounts_payable)
      VALUES
        ($1, $2, $3,
         0,0,0,0,0,0,0,0)
      ON CONFLICT (employee_id)
      DO UPDATE SET
        fullname = EXCLUDED.fullname,
        "position" = EXCLUDED."position",
        updated_at = NOW();
      `,
      [s.id, s.fullname, s.position]
    );

    await client.query("COMMIT");
    res.json({ message: "Staff added", id: s.id });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("POST /api/staff ERROR:", e.message);
    res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
});

router.put("/staff/:id", requireAuth, requireRole(["Admin"]), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { id } = req.params;

    const {
      employee_no, fullname, position, department, area,
      salary, ecola, branch_id, regularization_date,
      motorcycle_loan, postage, transportation,
      additional_target, repairing, additional_monitoring,
      motorcycle, other_deduction,
    } = req.body;

    const updated = await client.query(
      `
      UPDATE public.staff
      SET
        employee_no=$1,
        fullname=$2,
        "position"=$3,
        department=$4,
        area=$5,
        salary=$6,
        ecola=$7,
        branch_id=$8,
        regularization_date=$9,
        motorcycle_loan=$10,
        postage=$11,
        transportation=$12,
        additional_target=$13,
        repairing=$14,
        additional_monitoring=$15,
        motorcycle=$16,
        other_deduction=$17
      WHERE id=$18
      RETURNING id, fullname, "position";
      `,
      [
        employee_no || null,
        fullname,
        position,
        department,
        area,
        toNum(salary),
        toNum(ecola),
        toInt(branch_id),
        regularization_date || null,
        toNum(motorcycle_loan),
        toNum(postage),
        toNum(transportation),
        toNum(additional_target),
        toNum(repairing),
        toNum(additional_monitoring),
        toNum(motorcycle),
        toNum(other_deduction),
        toInt(id),
      ]
    );

    if (updated.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Staff not found" });
    }

    const s = updated.rows[0];

    await client.query(
      `UPDATE public.staff_balances SET fullname=$1, "position"=$2, updated_at=NOW() WHERE employee_id=$3`,
      [s.fullname, s.position, s.id]
    );

    await client.query("COMMIT");
    res.json({ message: "Staff updated" });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("PUT /api/staff/:id ERROR:", e.message);
    res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
});

router.delete("/staff/:id", requireAuth, requireRole(["Admin"]), async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM public.staff WHERE id=$1", [id]);
    res.json({ message: "Staff deleted" });
  } catch (e) {
    console.error("DELETE /api/staff/:id ERROR:", e.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/leave-requests", requireAuth, async (req, res) => {
  try {
    if (isAdmin(req)) {
      const result = await pool.query("SELECT * FROM public.leave_requests ORDER BY id DESC");
      return res.json(result.rows);
    }

    if (isBranchManager(req)) {
      const bid = getUserBranchId(req);
      if (!bid) return res.json([]);

      const result = await pool.query(
        `
        SELECT lr.*
        FROM public.leave_requests lr
        JOIN public.staff s ON s.id = lr.employee_id
        WHERE s.branch_id = $1
        ORDER BY lr.id DESC
        `,
        [bid]
      );
      return res.json(result.rows);
    }

    return res.status(403).json({ message: "Access denied" });
  } catch (e) {
    console.error("GET /api/leave-requests ERROR:", e.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/leave-requests", requireAuth, async (req, res) => {
  try {
    const { employee_id, staff_name, leave_type, start_date, end_date, status } = req.body;

    if (!employee_id || !staff_name || !leave_type || !start_date || !end_date) {
      return res.status(400).json({ message: "employee_id, staff_name, leave_type, start_date, end_date are required" });
    }

    if (isBranchManager(req)) {
      const bid = getUserBranchId(req);
      const check = await pool.query("SELECT id FROM public.staff WHERE id=$1 AND branch_id=$2", [employee_id, bid]);
      if (check.rows.length === 0) return res.status(403).json({ message: "Access denied" });
    }

    const result = await pool.query(
      `
      INSERT INTO public.leave_requests (employee_id, staff_name, leave_type, start_date, end_date, status, entry_date)
      VALUES ($1,$2,$3,$4,$5,$6, NOW())
      RETURNING *;
      `,
      [toInt(employee_id), staff_name, leave_type, start_date, end_date, status || "Pending"]
    );

    res.json(result.rows[0]);
  } catch (e) {
    console.error("POST /api/leave-requests ERROR:", e.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.put("/leave-requests/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (isBranchManager(req)) {
      const bid = getUserBranchId(req);
      const check = await pool.query(
        `
        SELECT lr.id
        FROM public.leave_requests lr
        JOIN public.staff s ON s.id = lr.employee_id
        WHERE lr.id=$1 AND s.branch_id=$2
        `,
        [id, bid]
      );
      if (check.rows.length === 0) return res.status(403).json({ message: "Access denied" });
    }

    await pool.query("UPDATE public.leave_requests SET status=$1 WHERE id=$2", [status, id]);
    res.json({ message: "Leave request updated" });
  } catch (e) {
    console.error("PUT /api/leave-requests/:id ERROR:", e.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/loan-requests", requireAuth, async (req, res) => {
  try {
    if (isAdmin(req)) {
      const result = await pool.query("SELECT * FROM public.loan_requests ORDER BY id DESC");
      return res.json(result.rows);
    }

    if (isBranchManager(req)) {
      const bid = getUserBranchId(req);
      if (!bid) return res.json([]);

      const result = await pool.query(
        `
        SELECT lr.*
        FROM public.loan_requests lr
        JOIN public.staff s ON s.id = lr.employee_id
        WHERE s.branch_id = $1
        ORDER BY lr.id DESC
        `,
        [bid]
      );
      return res.json(result.rows);
    }

    return res.status(403).json({ message: "Access denied" });
  } catch (e) {
    console.error("GET /api/loan-requests ERROR:", e.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/loan-requests", requireAuth, async (req, res) => {
  try {
    const { employee_id, staff_name, loan_type, amount, term, interest, reason, status, disbursement_date } = req.body;

    const empId = toInt(employee_id);
    if (!empId || !staff_name || !loan_type) {
      return res.status(400).json({ message: "employee_id, staff_name, loan_type are required" });
    }

    if (isBranchManager(req)) {
      const bid = getUserBranchId(req);
      const check = await pool.query("SELECT id FROM public.staff WHERE id=$1 AND branch_id=$2", [empId, bid]);
      if (check.rows.length === 0) return res.status(403).json({ message: "Access denied" });
    }

    const amt = toNum(amount);
    const intr = toNum(interest);
    const trm = Math.max(1, toNum(term));
    const total = amt + (amt * intr) / 100;
    const per_month = total / trm;

    const insertQ = `
      INSERT INTO public.loan_requests
        (employee_id, staff_name, loan_type, amount, term, interest, reason, total, per_month, status, disbursement_date, entry_date)
      VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, NOW())
      RETURNING *;
    `;

    const result = await pool.query(insertQ, [
      empId,
      staff_name,
      loan_type,
      amt,
      trm,
      intr,
      reason || "",
      total,
      per_month,
      status || "Pending",
      disbursement_date || null,
    ]);

    const col = loanTypeToBalanceColumn(loan_type);

    const staffRes = await pool.query(`SELECT "position" FROM public.staff WHERE id=$1`, [empId]);
    const staffPos = staffRes.rows?.[0]?.position ?? null;

    await pool.query(
      `
      INSERT INTO public.staff_balances (employee_id, fullname, "position")
      VALUES ($1, $2, $3)
      ON CONFLICT (employee_id)
      DO UPDATE SET
        fullname = EXCLUDED.fullname,
        "position" = COALESCE(public.staff_balances."position", EXCLUDED."position"),
        updated_at = NOW()
      `,
      [empId, staff_name, staffPos]
    );

    if (col) {
      await pool.query(
        `
        UPDATE public.staff_balances
        SET ${col} = COALESCE(${col}, 0) + $1,
            updated_at = NOW()
        WHERE employee_id = $2
        `,
        [total, empId]
      );
    }

    res.json(result.rows[0]);
  } catch (e) {
    console.error("POST /api/loan-requests ERROR:", e.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.put("/loan-requests/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, disbursement_date } = req.body;

    if (isBranchManager(req)) {
      const bid = getUserBranchId(req);
      const check = await pool.query(
        `
        SELECT lr.id
        FROM public.loan_requests lr
        JOIN public.staff s ON s.id = lr.employee_id
        WHERE lr.id=$1 AND s.branch_id=$2
        `,
        [id, bid]
      );
      if (check.rows.length === 0) return res.status(403).json({ message: "Access denied" });
    }

    const q = `
      UPDATE public.loan_requests
      SET
        status = $1,
        approved_at = CASE
          WHEN $1 = 'Approved' AND approved_at IS NULL THEN NOW()
          ELSE approved_at
        END,
        disbursement_date = COALESCE($2::date, disbursement_date)
      WHERE id = $3
      RETURNING *;
    `;

    const result = await pool.query(q, [status, disbursement_date || null, id]);
    if (result.rows.length === 0) return res.status(404).json({ message: "Loan request not found" });

    res.json(result.rows[0]);
  } catch (e) {
    console.error("PUT /api/loan-requests/:id ERROR:", e.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/staff-balances", requireAuth, async (req, res) => {
  try {
    const requestedBranchId = req.query.branchId;
    const branchId = isAdmin(req) ? (requestedBranchId || null) : getUserBranchId(req);

    const params = [];
    let where = "";

    if (branchId) {
      params.push(branchId);
      where = `WHERE s.branch_id = $1`;
    }

    const q = `
      SELECT
        sb.id,
        sb.employee_id,
        sb.fullname,
        COALESCE(sb."position", s."position") AS position,
        s.regularization_date,
        sb.cbu,
        sb.cashbond,
        sb.salary_advance,
        sb.motorcycle_loan,
        sb.special_advance,
        sb.cash_advance,
        sb.other_receivable,
        COALESCE((
          SELECT SUM(COALESCE(sap.balance, 0))
          FROM public.staff_accounts_payable sap
          WHERE sap.employee_id = sb.employee_id
            AND COALESCE(sap.balance, 0) > 0
        ), 0) AS staff_accounts_payable,
        sb.created_at,
        sb.updated_at
      FROM public.staff_balances sb
      LEFT JOIN public.staff s ON s.id = sb.employee_id
      ${where}
      ORDER BY sb.fullname ASC
    `;

    const result = await pool.query(q, params);
    res.json(result.rows);
  } catch (e) {
    console.error("GET /api/staff-balances ERROR:", e.message);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;