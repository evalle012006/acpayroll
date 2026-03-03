const express = require("express");
const router = express.Router();
const pool = require("../db");
const { requireAuth, requireRole } = require("../middlewares/authMiddleware");

/* ------------------------- Helpers ------------------------- */
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

/* ------------------------- Order No Generator ------------------------- */
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

/* ------------------------- GET /api/demotion-orders ------------------------- */
router.get("/demotion-orders", requireAuth, async (req, res) => {
  try {
    const role = roleLower(req);

    if (role !== "admin" && role !== "branch manager") {
      return res.status(403).json({ message: "Access denied" });
    }

    // Admin sees all
    if (isAdmin(req)) {
      const r = await pool.query(`SELECT * FROM public.demotion_orders ORDER BY created_at DESC`);
      return res.json(r.rows);
    }

    // Branch manager sees only orders of staff in their branch
    const branchId = getUserBranchId(req);
    if (!branchId) return res.json([]);

    const r = await pool.query(
      `
      SELECT dmo.*
      FROM public.demotion_orders dmo
      JOIN public.staff s ON s.id = dmo.employee_id
      WHERE s.branch_id = $1
      ORDER BY dmo.created_at DESC
      `,
      [branchId]
    );

    return res.json(r.rows);
  } catch (e) {
    console.error("GET /api/demotion-orders ERROR:", e.message);
    return res.status(500).json({ message: "Server error" });
  }
});

/* ------------------------- POST /api/demotion-orders ------------------------- */
router.post("/demotion-orders", requireAuth, requireRole(["admin", "branch manager"]), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const b = req.body || {};
    const employee_id = toInt(b.employee_id);
    const new_position = String(b.new_position || "").trim();
    const effective_date = toDateOrNull(b.effective_date);
    const details = String(b.details || "").trim();

    const to_branch_id = toInt(b.to_branch_id);

    if (!employee_id) return res.status(400).json({ message: "Employee required" });
    if (!new_position) return res.status(400).json({ message: "New position required" });
    if (!effective_date) return res.status(400).json({ message: "Effective date required" });
    if (!to_branch_id) return res.status(400).json({ message: "Destination branch required" });

    // read staff
    const s = await client.query(
      `SELECT id, first_name, last_name, middle_name, fullname, "position", branch_id FROM public.staff WHERE id=$1`,
      [employee_id]
    );
    if (s.rowCount === 0) return res.status(404).json({ message: "Staff not found" });
    const staffRow = s.rows[0];

    // branch manager restriction
    if (isBranchManager(req)) {
      const bid = getUserBranchId(req);
      if (!bid || Number(staffRow.branch_id) !== Number(bid)) {
        await client.query("ROLLBACK");
        return res.status(403).json({ message: "Access denied" });
      }
    }

    // fetch prev branch info
    const prevBranchId = staffRow.branch_id ? Number(staffRow.branch_id) : null;
    const prevBr = prevBranchId
      ? await client.query(`SELECT id, code, name FROM public.branches WHERE id=$1`, [prevBranchId])
      : { rowCount: 0, rows: [] };

    // fetch destination branch info
    const toBr = await client.query(`SELECT id, code, name FROM public.branches WHERE id=$1`, [to_branch_id]);
    if (toBr.rowCount === 0) return res.status(400).json({ message: "Destination branch not found" });

    const employee_name =
      String(staffRow.fullname || "").trim() ||
      `${String(staffRow.last_name || "").trim()}, ${String(staffRow.first_name || "").trim()} ${String(staffRow.middle_name || "").trim()}`
        .replace(/\s+/g, " ")
        .trim();

    const old_position = String(staffRow.position || "").trim();

    const orderNo = await generateOrderNo(client, "DMO");

    const ins = await client.query(
      `
      INSERT INTO public.demotion_orders
        (order_no, employee_id, employee_name, old_position, new_position,
         prev_branch_id, prev_branch_code, prev_branch_name,
         to_branch_id, to_branch_code, to_branch_name,
         effective_date, details, status, created_by)
      VALUES
        ($1,$2,$3,$4,$5,
         $6,$7,$8,
         $9,$10,$11,
         $12::date,$13,'Pending',$14)
      RETURNING *;
      `,
      [
        orderNo,
        employee_id,
        employee_name,
        old_position || null,
        new_position,

        prevBranchId,
        prevBr.rowCount ? String(prevBr.rows[0].code || "") : "",
        prevBr.rowCount ? String(prevBr.rows[0].name || "") : "",

        Number(to_branch_id),
        String(toBr.rows[0].code || ""),
        String(toBr.rows[0].name || ""),

        effective_date,
        details || null,
        req.user?.id ?? null,
      ]
    );

    await client.query("COMMIT");
    return res.json(ins.rows[0]);
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("POST /api/demotion-orders ERROR:", e.message);
    return res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
});

/* ------------------------- PUT /api/demotion-orders/:id/approve (ADMIN) ------------------------- */
router.put("/demotion-orders/:id/approve", requireAuth, requireRole(["admin"]), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });

    const r = await client.query(
      `
      UPDATE public.demotion_orders
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

    const toBranchId = toInt(order.to_branch_id);
    if (!toBranchId) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Destination branch missing in order" });
    }

    await client.query(
      `
      UPDATE public.staff
      SET
        "position" = $1,
        branch_id = $2
      WHERE id = $3
      `,
      [String(order.new_position || ""), toBranchId, Number(order.employee_id)]
    );

    await client.query(
      `
      UPDATE public.staff_balances
      SET
        fullname = $1,
        "position" = $2,
        updated_at = NOW()
      WHERE employee_id = $3
      `,
      [
        String(order.employee_name || ""),
        String(order.new_position || ""),
        Number(order.employee_id),
      ]
    );

    await client.query("COMMIT");
    return res.json(order);
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("PUT /api/demotion-orders/:id/approve ERROR:", e.message);
    return res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
});

/* ------------------------- PUT /api/demotion-orders/:id/reject (ADMIN) ------------------------- */
router.put("/demotion-orders/:id/reject", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });

    const reason = String(req.body?.reason || "").trim();
    if (!reason) return res.status(400).json({ message: "Rejection reason is required" });

    const r = await pool.query(
      `
      UPDATE public.demotion_orders
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
    console.error("PUT /api/demotion-orders/:id/reject ERROR:", e.message);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;