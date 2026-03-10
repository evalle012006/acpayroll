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

async function generateOrderNo(client, prefix) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

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

router.get("/promotion-orders", requireAuth, async (req, res) => {
  try {
    const role = roleLower(req);

    if (role === "admin") {
      const r = await pool.query(`SELECT * FROM public.promotion_orders ORDER BY created_at DESC`);
      return res.json(r.rows);
    }

    if (role === "branch manager") {
      const bid = getUserBranchId(req);
      if (!bid) return res.json([]);

      const r = await pool.query(
        `
        SELECT po.*
        FROM public.promotion_orders po
        JOIN public.staff s ON s.id = po.employee_id
        WHERE s.branch_id = $1
        ORDER BY po.created_at DESC
        `,
        [bid]
      );
      return res.json(r.rows);
    }

    return res.status(403).json({ message: "Access denied" });
  } catch (e) {
    console.error("GET /api/promotion-orders ERROR:", e.message);
    return res.status(500).json({ message: "Server error" });
  }
});

router.post("/promotion-orders", requireAuth, requireRole(["admin", "branch manager"]), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const b = req.body || {};

    const employee_id = toInt(b.employee_id);
    const effective_date = toDateOrNull(b.effective_date);

    const employee_name = String(b.employee_name || "").trim();
    const old_position = String(b.old_position || "").trim();
    const new_position = String(b.new_position || "").trim();

    const old_salary = toNum(b.old_salary);
    const new_salary = toNum(b.new_salary);

    const old_ecola = toNum(b.old_ecola);
    const new_ecola = toNum(b.new_ecola);

    const remarks = String(b.remarks || "").trim() || null;

    const prev_branch_id = b.prev_branch_id ? toInt(b.prev_branch_id) : null;
    const prev_branch_code = String(b.prev_branch_code || "");
    const prev_branch_name = String(b.prev_branch_name || "");

    const present_branch_id = b.present_branch_id ? toInt(b.present_branch_id) : null;
    const present_branch_code = String(b.present_branch_code || "");
    const present_branch_name = String(b.present_branch_name || "");

    if (!employee_id) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Employee is required" });
    }
    if (!new_position) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "New position is required" });
    }
    if (!effective_date) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Effective date is required" });
    }
    if (!present_branch_id) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Present branch is required" });
    }

    const staffRes = await client.query(
      `SELECT id, fullname, branch_id FROM public.staff WHERE id=$1`,
      [employee_id]
    );
    if (staffRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Staff not found" });
    }

    const staffRow = staffRes.rows[0];

    if (isBranchManager(req)) {
      const bid = getUserBranchId(req);
      if (!bid || Number(staffRow.branch_id) !== Number(bid)) {
        await client.query("ROLLBACK");
        return res.status(403).json({ message: "Access denied" });
      }
    }

    const orderNo = await generateOrderNo(client, "PRO");

    const ins = await client.query(
      `
      INSERT INTO public.promotion_orders
        (
          order_no,
          employee_id,
          employee_name,

          prev_branch_id, prev_branch_code, prev_branch_name,
          present_branch_id, present_branch_code, present_branch_name,

          old_position, new_position,
          old_salary, new_salary,

          old_ecola, new_ecola,

          effective_date,
          remarks,

          status,
          created_by
        )
      VALUES
        (
          $1,$2,$3,
          $4,$5,$6,
          $7,$8,$9,
          $10,$11,
          $12,$13,
          $14,$15,
          $16::date,
          $17,
          'Pending',
          $18
        )
      RETURNING *;
      `,
      [
        orderNo,
        employee_id,
        employee_name || String(staffRow.fullname || ""),

        prev_branch_id,
        prev_branch_code,
        prev_branch_name,

        present_branch_id,
        present_branch_code,
        present_branch_name,

        old_position || null,
        new_position,

        old_salary,
        new_salary,

        old_ecola,
        new_ecola,

        effective_date,
        remarks,

        req.user?.id ?? null,
      ]
    );

    await client.query("COMMIT");
    return res.json(ins.rows[0]);
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("POST /api/promotion-orders ERROR:", e.message);
    return res.status(500).json({ message: e?.message || "Server error" });
  } finally {
    client.release();
  }
});

router.put("/promotion-orders/:id/approve", requireAuth, requireRole(["admin"]), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const id = toInt(req.params.id);
    if (!id) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Invalid id" });
    }

    const r = await client.query(
      `
      UPDATE public.promotion_orders
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

    if (r.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Order not found or not Pending" });
    }

    const order = r.rows[0];

    await client.query(
      `
      UPDATE public.staff
      SET
        "position"=$1,
        salary=$2,
        ecola=$3,
        branch_id=$4
      WHERE id=$5
      `,
      [
        order.new_position,
        toNum(order.new_salary),
        toNum(order.new_ecola),
        order.present_branch_id ? Number(order.present_branch_id) : null,
        order.employee_id,
      ]
    );

    await client.query("COMMIT");
    return res.json(order);
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("PUT /api/promotion-orders/:id/approve ERROR:", e.message);
    return res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
});

router.put("/promotion-orders/:id/reject", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });

    const reason = String(req.body?.reason || "").trim();
    if (!reason) return res.status(400).json({ message: "Rejection reason is required" });

    const r = await pool.query(
      `
      UPDATE public.promotion_orders
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
    console.error("PUT /api/promotion-orders/:id/reject ERROR:", e.message);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;