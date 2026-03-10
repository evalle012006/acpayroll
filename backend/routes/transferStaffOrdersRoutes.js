const express = require("express");
const router = express.Router();
const pool = require("../db");
const { requireAuth, requireRole } = require("../middlewares/authMiddleware");

const toInt = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

const toDateOrNull = (v) => {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const d = s.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
};

const roleLower = (req) => String(req.user?.role || "").trim().toLowerCase();
const isAdmin = (req) => roleLower(req) === "admin";
const isBranchManager = (req) => roleLower(req) === "branch manager";
const getUserBranchId = (req) => req.user?.branch_id ?? null;

const toStr = (v) => String(v ?? "").trim();

const displayName = (row) => {
  const ln = toStr(row?.last_name);
  const fn = toStr(row?.first_name);
  const mn = toStr(row?.middle_name);
  const built = `${ln}${ln && fn ? ", " : ""}${fn}${mn ? ` ${mn}` : ""}`
    .replace(/\s+/g, " ")
    .trim();
  return built || toStr(row?.fullname) || "-";
};

async function generateTransferOrderNo(client) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const prefix = "TSO";

  await client.query(
    `
    INSERT INTO public.order_sequences(prefix, year, month, next_value)
    VALUES ($1,$2,$3,1)
    ON CONFLICT (prefix, year, month) DO NOTHING
    `,
    [prefix, year, month]
  );

  const seq = await client.query(
    `
    SELECT next_value
    FROM public.order_sequences
    WHERE prefix=$1 AND year=$2 AND month=$3
    FOR UPDATE
    `,
    [prefix, year, month]
  );

  const nextVal = Number(seq.rows[0].next_value);

  await client.query(
    `
    UPDATE public.order_sequences
    SET next_value = next_value + 1
    WHERE prefix=$1 AND year=$2 AND month=$3
    `,
    [prefix, year, month]
  );

  const mm = String(month).padStart(2, "0");
  const nnnn = String(nextVal).padStart(4, "0");
  return `${prefix}-${year}-${mm}-${nnnn}`;
}

router.get("/transfer-staff-orders", requireAuth, async (req, res) => {
  try {
    const role = roleLower(req);
    const branchId = getUserBranchId(req);

    if (role === "admin") {
      const r = await pool.query(
        `SELECT * FROM public.transfer_staff_orders ORDER BY created_at DESC`
      );
      return res.json(r.rows);
    }

    if (role === "branch manager") {
      if (!branchId) return res.json([]);
      const r = await pool.query(
        `
        SELECT *
        FROM public.transfer_staff_orders
        WHERE prev_branch_id = $1
        ORDER BY created_at DESC
        `,
        [branchId]
      );
      return res.json(r.rows);
    }

    return res.status(403).json({ message: "Access denied" });
  } catch (e) {
    console.error("GET /api/transfer-staff-orders ERROR:", e.message);
    return res.status(500).json({ message: "Server error" });
  }
});

router.post(
  "/transfer-staff-orders",
  requireAuth,
  requireRole(["admin", "branch manager"]),
  async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const b = req.body || {};
      const employee_id = toInt(b.employee_id);
      const prev_branch_id = toInt(b.prev_branch_id);
      const to_branch_id = toInt(b.to_branch_id);

      const division = toStr(b.division);
      const area = toStr(b.area);
      const details = toStr(b.details);

      const date_created = toDateOrNull(b.date_created);
      const effective_date = toDateOrNull(b.effective_date);

      if (!employee_id) return res.status(400).json({ message: "Employee required" });
      if (!prev_branch_id || !to_branch_id) return res.status(400).json({ message: "Branches required" });
      if (prev_branch_id === to_branch_id) return res.status(400).json({ message: "Branches must differ" });
      if (!division) return res.status(400).json({ message: "Division required" });
      if (!area) return res.status(400).json({ message: "Area required" });
      if (!date_created) return res.status(400).json({ message: "Date created required" });
      if (!effective_date) return res.status(400).json({ message: "Effective date required" });
      if (!details) return res.status(400).json({ message: "Details required" });

      if (isBranchManager(req)) {
        const myBranch = getUserBranchId(req);
        if (!myBranch || Number(myBranch) !== Number(prev_branch_id)) {
          await client.query("ROLLBACK");
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const s = await client.query(
        `
        SELECT id, fullname, last_name, first_name, middle_name
        FROM public.staff
        WHERE id = $1
        `,
        [employee_id]
      );
      if (s.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Staff not found" });
      }

      const staffRow = s.rows[0];
      const employee_name = displayName(staffRow);

      const orderNo = await generateTransferOrderNo(client);

      const ins = await client.query(
        `
        INSERT INTO public.transfer_staff_orders
          (order_no, employee_id, employee_name,
           prev_branch_id, prev_branch_code, prev_branch_name,
           to_branch_id, to_branch_code, to_branch_name,
           area, division, date_created, effective_date, details,
           status, created_by,
           last_name, first_name, middle_name)
        VALUES
          ($1,$2,$3,
           $4,$5,$6,
           $7,$8,$9,
           $10,$11,$12::date,$13::date,$14,
           'Pending',$15,
           $16,$17,$18)
        RETURNING *;
        `,
        [
          orderNo,
          employee_id,
          employee_name,

          prev_branch_id,
          toStr(b.prev_branch_code),
          toStr(b.prev_branch_name),

          to_branch_id,
          toStr(b.to_branch_code),
          toStr(b.to_branch_name),

          area,
          division,
          date_created,
          effective_date,
          details,

          req.user?.id ?? null,

          toStr(staffRow.last_name) || null,
          toStr(staffRow.first_name) || null,
          toStr(staffRow.middle_name) || null,
        ]
      );

      await client.query("COMMIT");
      return res.json(ins.rows[0]);
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("POST /api/transfer-staff-orders ERROR:", e.message);
      return res.status(500).json({ message: "Server error" });
    } finally {
      client.release();
    }
  }
);

router.put(
  "/transfer-staff-orders/:id/approve",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    try {
      const id = toInt(req.params.id);
      if (!id) return res.status(400).json({ message: "Invalid id" });

      const r = await pool.query(
        `
        UPDATE public.transfer_staff_orders
        SET
          status='Approved',
          approved_by=$2,
          approved_at=COALESCE(approved_at, NOW()),
          rejected_by=NULL,
          rejected_at=NULL,
          rejection_reason=NULL
        WHERE id=$1 AND status='Pending'
        RETURNING *;
        `,
        [id, req.user?.id ?? null]
      );

      if (r.rowCount === 0) return res.status(400).json({ message: "Order not found or not Pending" });

      const order = r.rows[0];
      await pool.query(
        `UPDATE public.staff SET branch_id=$1 WHERE id=$2`,
        [order.to_branch_id, order.employee_id]
      );

      return res.json(order);
    } catch (e) {
      console.error("PUT /api/transfer-staff-orders/:id/approve ERROR:", e.message);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

router.put(
  "/transfer-staff-orders/:id/reject",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    try {
      const id = toInt(req.params.id);
      if (!id) return res.status(400).json({ message: "Invalid id" });

      const reason = toStr(req.body?.reason);
      if (!reason) return res.status(400).json({ message: "Rejection reason is required" });

      const r = await pool.query(
        `
        UPDATE public.transfer_staff_orders
        SET
          status='Rejected',
          rejected_by=$2,
          rejected_at=COALESCE(rejected_at, NOW()),
          rejection_reason=$3,
          approved_by=NULL,
          approved_at=NULL
        WHERE id=$1 AND status='Pending'
        RETURNING *;
        `,
        [id, req.user?.id ?? null, reason]
      );

      if (r.rowCount === 0) return res.status(400).json({ message: "Order not found or not Pending" });
      return res.json(r.rows[0]);
    } catch (e) {
      console.error("PUT /api/transfer-staff-orders/:id/reject ERROR:", e.message);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

module.exports = router;