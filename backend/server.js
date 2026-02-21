const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
app.use(cors());
app.use(express.json());

// ✅ PostgreSQL Connection
const pool = new Pool({
  user: "postgres",
  password: "admin123",
  host: "localhost",
  port: 5432,
  database: "payroll",
});

/* ✅ AUTH LOGIN */

app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const result = await pool.query("SELECT * FROM public.users WHERE username=$1", [
      username,
    ]);

    if (result.rows.length === 0) {
      return res.status(401).json({ message: "Invalid username or password" });
    }

    const user = result.rows[0];

    // ✅ plain password check (temporary)
    if (password !== user.password) {
      return res.status(401).json({ message: "Invalid username or password" });
    }

    res.json({
      message: "Login successful",
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

/* ✅ STAFF ACCOUNTS PAYABLE (ONE ONLY) */

app.get("/api/staff-accounts-payable", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        COALESCE(id, employee_id::text || '-' || entry_date::text) AS id,
        employee_id,
        staff_name,
        description,
        amount,
        term,
        per_month,
        entry_date,
        balance
      FROM public.staff_accounts_payable
      ORDER BY entry_date DESC
    `);

    res.json(result.rows);
  } catch (err) {
    console.error("GET /api/staff-accounts-payable ERROR:", err.message);
    res.status(500).json({ message: "Server error fetching staff accounts payable" });
  }
});

app.post("/api/staff-accounts-payable", async (req, res) => {
  try {
    const { employee_id, staff_name, description, amount, term, per_month, balance, entry_date } = req.body;

    const result = await pool.query(
      `
      INSERT INTO public.staff_accounts_payable
        (employee_id, staff_name, description, amount, term, per_month, balance, entry_date)
      VALUES
        ($1,$2,$3,$4,$5,$6,$7, COALESCE($8::date, CURRENT_DATE))
      RETURNING
        COALESCE(id, employee_id::text || '-' || entry_date::text) AS id,
        employee_id, staff_name, description, amount, term, per_month, entry_date, balance
      `,
      [employee_id, staff_name, description, amount, term, per_month, balance, entry_date]
    );

    res.json({ message: "Saved successfully", row: result.rows[0] });
  } catch (err) {
    console.error("POST /api/staff-accounts-payable ERROR:", err.message);
    res.status(500).json({ message: "Server error saving staff accounts payable" });
  }
});

/* ✅ STAFF CRUD */

app.get("/staff", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM public.staff ORDER BY id DESC");
    res.json(result.rows);
  } catch (err) {
    console.error("GET STAFF ERROR:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post("/staff", async (req, res) => {
  try {
    const {
      fullname,
      position,
      department,
      area,
      salary,
      ecola,
      payroll_date,
      branch_id,
      regularization_date,
      motorcycle_loan,
    } = req.body;

    await pool.query(
      `INSERT INTO public.staff
       (fullname, position, department, area, salary, ecola, payroll_date, branch_id, regularization_date, motorcycle_loan)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        fullname,
        position,
        department,
        area,
        salary,
        ecola,
        payroll_date,
        branch_id,
        regularization_date,
        motorcycle_loan,
      ]
    );

    res.json({ message: "Staff added" });
  } catch (err) {
    console.error("ADD STAFF ERROR:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ✅ FIXED UPDATE (id was missing before)

app.put("/staff/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const {
      fullname,
      position,
      department,
      area,
      salary,
      ecola,
      payroll_date,
      regularization_date,
      motorcycle_loan,
    } = req.body;

    await pool.query(
      `UPDATE public.staff
       SET fullname=$1, position=$2, department=$3, area=$4,
           salary=$5, ecola=$6, payroll_date=$7,
           regularization_date=$8, motorcycle_loan=$9
       WHERE id=$10`,
      [
        fullname,
        position,
        department,
        area,
        salary,
        ecola,
        payroll_date,
        regularization_date,
        motorcycle_loan,
        id,
      ]
    );

    res.json({ message: "Staff updated" });
  } catch (err) {
    console.error("UPDATE STAFF ERROR:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.delete("/staff/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM public.staff WHERE id=$1", [id]);
    res.json({ message: "Staff deleted" });
  } catch (err) {
    console.error("DELETE STAFF ERROR:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ✅ STAFF BY AREA (Transportation) */

app.get("/staff/area/:area", async (req, res) => {
  const { area } = req.params;
  const { month } = req.query; // YYYY-MM

  try {
    let query = `
      SELECT *
      FROM public.staff
      WHERE area ILIKE $1
    `;
    const params = [area];

    if (month) {
      query += ` AND to_char(payroll_date, 'YYYY-MM') = $2`;
      params.push(month);
    }

    query += ` ORDER BY id ASC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error("GET /staff/area/:area ERROR:", err.message);
    res.status(500).json({ message: "Server error fetching staff by area" });
  }
});

/* ✅ BRANCHES CRUD */

app.get("/branches", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, code, name, area FROM public.branches ORDER BY id ASC"
    );
    res.json(result.rows);
  } catch (err) {
    console.error("GET /branches ERROR:", err.message);
    res.status(500).json({ message: "Server error fetching branches" });
  }
});

app.get("/branches/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      "SELECT id, code, name, area FROM public.branches WHERE id=$1",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Branch not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("GET /branches/:id ERROR:", err.message);
    res.status(500).json({ message: "Server error fetching branch" });
  }
});

app.post("/branches", async (req, res) => {
  try {
    const { code, name, area } = req.body;

    const result = await pool.query(
      "INSERT INTO public.branches (code, name, area) VALUES ($1,$2,$3) RETURNING id, code, name, area",
      [code, name, area]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error("POST /branches ERROR:", err.message);
    res.status(500).json({ message: "Server error adding branch" });
  }
});

app.put("/branches/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { code, name, area } = req.body;

    const result = await pool.query(
      "UPDATE public.branches SET code=$1, name=$2, area=$3 WHERE id=$4 RETURNING id, code, name, area",
      [code, name, area, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Branch not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("PUT /branches/:id ERROR:", err.message);
    res.status(500).json({ message: "Server error updating branch" });
  }
});

app.delete("/branches/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM public.branches WHERE id=$1", [id]);
    res.json({ message: "Branch deleted" });
  } catch (err) {
    console.error("DELETE /branches/:id ERROR:", err.message);
    res.status(500).json({ message: "Server error deleting branch" });
  }
});

/* ✅ LEAVE REQUESTS */
app.get("/api/leave-requests", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM public.leave_requests ORDER BY id DESC"
    );
    res.json(result.rows);
  } catch (err) {
    console.error("GET LEAVE REQUESTS ERROR:", err.message);
    res.status(500).json({ message: "Server error fetching leave requests" });
  }
});

app.put("/api/leave-requests/:id", async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    await pool.query(
      "UPDATE public.leave_requests SET status = $1 WHERE id = $2",
      [status, id]
    );
    res.json({ message: "Leave request updated" });
  } catch (err) {
    console.error("UPDATE LEAVE REQUEST ERROR:", err.message);
    res.status(500).json({ message: "Server error updating leave request" });
  }
});

/* ✅ LOAN REQUESTS */
app.get("/api/loan-requests", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM public.loan_requests ORDER BY id DESC"
    );
    res.json(result.rows);
  } catch (err) {
    console.error("GET LOAN REQUESTS ERROR:", err.message);
    res.status(500).json({ message: "Server error fetching loan requests" });
  }
});

app.put("/api/loan-requests/:id", async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    await pool.query(
      "UPDATE public.loan_requests SET status = $1 WHERE id = $2",
      [status, id]
    );
    res.json({ message: "Loan request updated" });
  } catch (err) {
    console.error("UPDATE LOAN REQUEST ERROR:", err.message);
    res.status(500).json({ message: "Server error updating loan request" });
  }
});

/* ✅ SALARY (Payroll) + AUTO STAFF PAYABLE DEDUCTION */

app.get("/salary/:branchId", async (req, res) => {
  const { branchId } = req.params;
  const toNum = (v) => Number(v || 0);

  try {
    const staffRes = await pool.query(
      `SELECT * FROM public.staff WHERE branch_id = $1 ORDER BY id ASC`,
      [branchId]
    );

    const staffRows = staffRes.rows;

    const employeeIds = staffRows
      .map((s) => s.employee_id ?? s.id)
      .filter((x) => x !== null && x !== undefined);

    let payableRows = [];
    if (employeeIds.length > 0) {
      const payRes = await pool.query(
        `
        SELECT employee_id, per_month, balance
        FROM public.staff_accounts_payable
        WHERE employee_id = ANY($1::int[])
          AND balance > 0
        `,
        [employeeIds]
      );
      payableRows = payRes.rows;
    }

    const payableMap = new Map();
    for (const p of payableRows) {
      const deduction = Math.max(0, Math.min(toNum(p.per_month), toNum(p.balance)));
      payableMap.set(p.employee_id, (payableMap.get(p.employee_id) || 0) + deduction);
    }

    const computed = staffRows.map((s) => {
      const salary = toNum(s.salary);
      const ecola = toNum(s.ecola);

      const total_er = toNum(s.hdmf_er) + toNum(s.sss_er) + toNum(s.ph_er);
      const total_ee = toNum(s.hdmf_ee) + toNum(s.sss_ee) + toNum(s.ph_ee);

      const empKey = s.employee_id ?? s.id;
      const staff_accounts_payable = payableMap.get(Number(empKey)) || 0;

      const total_deduction =
        total_ee +
        toNum(s.tax) +
        toNum(s.utility_charge) +
        toNum(s.cbu) +
        toNum(s.cashbond) +
        toNum(s.salary_advance) +
        toNum(s.special_advance) +
        toNum(s.cash_advance) +
        toNum(s.other_receivable) +
        toNum(s.pagibig_mpl) +
        toNum(s.sss_loan) +
        staff_accounts_payable;

      const net_pay = salary + ecola - total_deduction;

      return {
        ...s,
        total_er,
        total_ee,
        staff_accounts_payable,
        total_deduction,
        net_pay,
      };
    });

    res.json(computed);
  } catch (err) {
    console.error("SALARY ERROR:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ✅ TEST */

app.get("/test", (req, res) => res.send("Backend is working!"));

/* ✅ SERVER START */

app.listen(5000, () => {
  console.log("🚀 Server running on http://localhost:5000");
});
