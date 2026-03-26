const express = require("express");
const router = express.Router();
const pool = require("../db");
const { requireAuth, requireRole } = require("../middlewares/authMiddleware");

const toInt = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

const toStr = (v) => String(v ?? "").trim();

const toDateOrNull = (v) => {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const d = s.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
};

const roleLower = (req) => String(req.user?.role || "").trim().toLowerCase();
const isAdmin = (req) => roleLower(req) === "admin";
const isHr = (req) => roleLower(req) === "hr";
const isAccounting = (req) => roleLower(req) === "accounting";
const isBranchManager = (req) => roleLower(req) === "branch manager";
const getUserBranchCode = (req) => toStr(req.user?.branch_id);

async function getBranchIdFromCode(branchCode) {
  const code = toStr(branchCode);
  if (!code) return null;

  const r = await pool.query(
    `
    SELECT id
    FROM public.branches
    WHERE LOWER(TRIM(code)) = LOWER(TRIM($1))
    LIMIT 1
    `,
    [code]
  );

  if (r.rowCount === 0) return null;
  return r.rows[0].id;
}

const makeTxnCode = (leaveType) => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  const lt = String(leaveType || "").toLowerCase();

  const prefix = lt.includes("sick")
    ? "SL"
    : lt.includes("annual")
    ? "AL"
    : "LV";

  return `${prefix}${y}${m}${day}`;
};

router.get("/leave-requests", requireAuth, async (req, res) => {
  try {
    if (isAdmin(req) || isHr(req) || isAccounting(req)) {
      const r = await pool.query(
        `SELECT id, staff_name, leave_type, start_date, end_date, status, transaction_code, entry_date, employee_id
         FROM public.leave_requests
         ORDER BY entry_date DESC NULLS LAST, id DESC`
      );
      return res.json(r.rows);
    }

    if (isBranchManager(req)) {
      const branchCode = getUserBranchCode(req);
      if (!branchCode) return res.json([]);

      const bid = await getBranchIdFromCode(branchCode);
      if (!bid) return res.json([]);

      const r = await pool.query(
        `
        SELECT lr.id, lr.staff_name, lr.leave_type, lr.start_date, lr.end_date, lr.status, lr.transaction_code, lr.entry_date, lr.employee_id
        FROM public.leave_requests lr
        JOIN public.staff s ON s.id = lr.employee_id
        WHERE s.branch_id = $1
        ORDER BY lr.entry_date DESC NULLS LAST, lr.id DESC
        `,
        [bid]
      );

      return res.json(r.rows);
    }

    return res.status(403).json({ message: "Access denied" });
  } catch (e) {
    console.error("GET /api/leave-requests ERROR:", e.message);
    return res.status(500).json({ message: "Server error" });
  }
});

router.get(
  "/leave-requests/staff/:staffId",
  requireAuth,
  requireRole(["admin", "branch manager", "hr", "accounting"]),
  async (req, res) => {
    try {
      const staffId = toInt(req.params.staffId);
      if (!staffId) return res.status(400).json({ message: "Invalid staff id" });

      if (isBranchManager(req)) {
        const branchCode = getUserBranchCode(req);
        if (!branchCode) return res.status(403).json({ message: "Access denied" });

        const bid = await getBranchIdFromCode(branchCode);
        if (!bid) return res.status(403).json({ message: "Access denied" });

        const chk = await pool.query(
          `SELECT id FROM public.staff WHERE id = $1 AND branch_id = $2`,
          [staffId, bid]
        );
        if (chk.rowCount === 0) return res.status(403).json({ message: "Access denied" });
      }

      const r = await pool.query(
        `SELECT id, staff_name, leave_type, start_date, end_date, status, transaction_code, entry_date, employee_id
         FROM public.leave_requests
         WHERE employee_id = $1
         ORDER BY entry_date DESC NULLS LAST, id DESC`,
        [staffId]
      );

      return res.json(r.rows);
    } catch (e) {
      console.error("GET /api/leave-requests/staff/:staffId ERROR:", e.message);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

router.post(
  "/leave-requests",
  requireAuth,
  requireRole(["admin", "branch manager", "hr", "accounting"]),
  async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const b = req.body || {};
      const employee_id = toInt(b.employee_id);
      const leave_type = String(b.leave_type || "").trim();
      const start_date = toDateOrNull(b.start_date);
      const end_date = toDateOrNull(b.end_date);

      if (!employee_id) return res.status(400).json({ message: "employee_id is required" });
      if (!leave_type) return res.status(400).json({ message: "leave_type is required" });
      if (!start_date || !end_date) {
        return res.status(400).json({ message: "start_date and end_date are required" });
      }
      if (String(start_date) > String(end_date)) {
        return res.status(400).json({ message: "Start date must be on or before end date" });
      }

      const s = await client.query(
        `SELECT id, fullname, branch_id FROM public.staff WHERE id = $1`,
        [employee_id]
      );
      if (s.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Staff not found" });
      }

      const staffRow = s.rows[0];

      if (isBranchManager(req)) {
        const branchCode = getUserBranchCode(req);
        const bid = await getBranchIdFromCode(branchCode);

        if (!bid || Number(staffRow.branch_id) !== Number(bid)) {
          await client.query("ROLLBACK");
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const txnCode = makeTxnCode(leave_type);
      const id = `LV-${Date.now()}-${Math.random().toString(16).slice(2, 6).toUpperCase()}`;

      const ins = await client.query(
        `
        INSERT INTO public.leave_requests
          (id, staff_name, leave_type, start_date, end_date, status, transaction_code, entry_date, employee_id)
        VALUES
          ($1, $2, $3, $4::date, $5::date, 'Pending', $6, CURRENT_DATE, $7)
        RETURNING id, staff_name, leave_type, start_date, end_date, status, transaction_code, entry_date, employee_id
        `,
        [id, String(staffRow.fullname || ""), leave_type, start_date, end_date, txnCode, employee_id]
      );

      await client.query("COMMIT");
      return res.json(ins.rows[0]);
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("POST /api/leave-requests ERROR:", e.message);
      return res.status(500).json({ message: e?.message || "Server error" });
    } finally {
      client.release();
    }
  }
);

router.put("/leave-requests/:id", requireAuth, requireRole(["admin", "hr", "accounting"]), async (req, res) => {
  try {
    const id = String(req.params.id || "").trim();
    if (!id) return res.status(400).json({ message: "Invalid id" });

    const status = String(req.body?.status || "").trim();
    if (!["Approved", "Rejected"].includes(status)) {
      return res.status(400).json({ message: "Status must be Approved or Rejected" });
    }

    const r = await pool.query(
      `
      UPDATE public.leave_requests
      SET status = $2
      WHERE id = $1
      RETURNING id, staff_name, leave_type, start_date, end_date, status, transaction_code, entry_date, employee_id
      `,
      [id, status]
    );

    if (r.rowCount === 0) return res.status(404).json({ message: "Not found" });
    return res.json(r.rows[0]);
  } catch (e) {
    console.error("PUT /api/leave-requests/:id ERROR:", e.message);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
