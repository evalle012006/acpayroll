const express = require("express");
const router = express.Router();
const pool = require("../db");
const { requireAuth, requireRole } = require("../middlewares/authMiddleware");

/* ---------------- Helpers ---------------- */
const toInt = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

const toDate = (v) => {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
};

const clean = (v) => String(v ?? "").trim();
const norm = (v) => clean(v).toLowerCase();

const roleLower = (req) => norm(req.user?.role);
const isAdmin = (req) => roleLower(req) === "admin";
const isHr = (req) => roleLower(req) === "hr";
const isAccounting = (req) => roleLower(req) === "accounting";
const isBranchManager = (req) => roleLower(req) === "branch manager";
const isAssistantVicePresident = (req) =>
  roleLower(req) === "assistant vice president";
const isVicePresident = (req) => roleLower(req) === "vice president";
const isSeniorVicePresident = (req) =>
  roleLower(req) === "senior vice president";
const isPresident = (req) => roleLower(req) === "president";

const isTopManagement = (req) =>
  isAdmin(req) ||
  isHr(req) ||
  isAccounting(req) ||
  isAssistantVicePresident(req) ||
  isVicePresident(req) ||
  isSeniorVicePresident(req) ||
  isPresident(req);

const getUserBranchId = (req) => req.user?.branch_id ?? null;

const normalizeExitType = (v) => {
  const s = norm(v);

  if (s === "awol") return "AWOL";
  if (s === "resign" || s === "resigned") return "Resigned";
  if (s === "termination" || s === "terminated") return "Terminated";
  if (s === "deceased" || s === "death") return "Deceased";

  return clean(v);
};

/* =========================================================
   EXIT STAFF (inactive list)
========================================================= */
router.get("/exit-staff", requireAuth, async (req, res) => {
  try {
    if (!isTopManagement(req) && !isBranchManager(req)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const params = [];
    let sql = `
      SELECT
        s.id,
        s.employee_no,
        s.fullname,
        s.last_name,
        s.first_name,
        s.middle_name,
        s.branch_id,
        b.code AS branch_code,
        b.name AS branch_name,
        s.department,
        s.position,
        s.status,
        s.exit_type,
        s.exit_date,
        s.exit_remarks
      FROM public.staff s
      LEFT JOIN public.branches b ON b.id = s.branch_id
      WHERE LOWER(TRIM(COALESCE(s.status, ''))) = 'inactive'
        AND LOWER(TRIM(COALESCE(s.exit_type, ''))) IN ('awol', 'resigned', 'terminated', 'deceased')
    `;

    if (isBranchManager(req)) {
      const bid = getUserBranchId(req);
      if (!bid) return res.json([]);
      params.push(bid);
      sql += ` AND s.branch_id = $${params.length}`;
    }

    sql += `
      ORDER BY
        s.exit_date DESC NULLS LAST,
        s.last_name ASC,
        s.first_name ASC
    `;

    const r = await pool.query(sql, params);
    return res.json(r.rows);
  } catch (e) {
    console.error("GET /exit-staff ERROR:", e.message);
    return res.status(500).json({ message: "Server error" });
  }
});

/* =========================================================
   EXIT STAFF ORDERS
========================================================= */
router.get("/exit-staff-orders", requireAuth, async (req, res) => {
  try {
    if (isTopManagement(req)) {
      const r = await pool.query(`
        SELECT *
        FROM public.exit_staff_orders
        ORDER BY id DESC
      `);
      return res.json(r.rows);
    }

    if (isBranchManager(req)) {
      const bid = getUserBranchId(req);
      if (!bid) return res.json([]);

      const r = await pool.query(
        `
        SELECT *
        FROM public.exit_staff_orders
        WHERE branch_id = $1
        ORDER BY id DESC
        `,
        [bid]
      );
      return res.json(r.rows);
    }

    return res.status(403).json({ message: "Access denied" });
  } catch (e) {
    console.error("GET /exit-staff-orders ERROR:", e.message);
    return res.status(500).json({ message: "Server error" });
  }
});

router.post(
  "/exit-staff-orders",
  requireAuth,
  requireRole([
    "admin",
    "branch manager",
    "assistant vice president",
    "vice president",
    "senior vice president",
    "president",
  ]),
  async (req, res) => {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const staff_id = toInt(req.body?.staff_id);
      const employee_no_input = clean(req.body?.employee_no);
      const exit_type = normalizeExitType(req.body?.exit_type);
      const date_created =
        toDate(req.body?.date_created) || toDate(new Date().toISOString());
      const effective_date = toDate(req.body?.effective_date);
      const settlement_date = toDate(req.body?.settlement_date);
      const settlement_branch_id = toInt(req.body?.settlement_branch_id);
      const remarks = clean(req.body?.remarks);

      if (!staff_id && !employee_no_input) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Staff is required" });
      }

      if (
        !exit_type ||
        !["AWOL", "Resigned", "Terminated", "Deceased"].includes(exit_type)
      ) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: "Exit type must be AWOL, Resigned, Terminated, or Deceased",
        });
      }

      if (!date_created) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Date created required" });
      }

      if (!effective_date) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Effective date required" });
      }

      let s;

      if (staff_id) {
        s = await client.query(
          `
          SELECT
            id,
            employee_no,
            fullname,
            last_name,
            first_name,
            middle_name,
            branch_id,
            status
          FROM public.staff
          WHERE id = $1
          `,
          [staff_id]
        );
      } else {
        s = await client.query(
          `
          SELECT
            id,
            employee_no,
            fullname,
            last_name,
            first_name,
            middle_name,
            branch_id,
            status
          FROM public.staff
          WHERE employee_no = $1
          `,
          [employee_no_input]
        );
      }

      if (s.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Staff not found" });
      }

      const staff = s.rows[0];

      if (isBranchManager(req)) {
        const userBranchId = getUserBranchId(req);
        if (!userBranchId || Number(userBranchId) !== Number(staff.branch_id)) {
          await client.query("ROLLBACK");
          return res.status(403).json({
            message: "You can only create exit staff orders for your branch.",
          });
        }
      }

      const prev_branch_id = staff.branch_id ? toInt(staff.branch_id) : null;
      let prev_branch_code = "";
      let prev_branch_name = "";

      if (prev_branch_id) {
        const b = await client.query(
          `SELECT code, name FROM public.branches WHERE id = $1`,
          [prev_branch_id]
        );

        if (b.rowCount > 0) {
          prev_branch_code = clean(b.rows[0].code);
          prev_branch_name = clean(b.rows[0].name);
        }
      }

      let settlement_branch_code = "";
      let settlement_branch_name = "";

      if (settlement_branch_id) {
        const sb = await client.query(
          `SELECT code, name FROM public.branches WHERE id = $1`,
          [settlement_branch_id]
        );

        if (sb.rowCount === 0) {
          await client.query("ROLLBACK");
          return res.status(404).json({ message: "Settlement branch not found" });
        }

        settlement_branch_code = clean(sb.rows[0].code);
        settlement_branch_name = clean(sb.rows[0].name);
      }

      const employee_name =
        clean(req.body?.employee_name) ||
        clean(staff.fullname) ||
        [clean(staff.last_name), clean(staff.first_name), clean(staff.middle_name)]
          .filter(Boolean)
          .join(", ");

      const seq = await client.query(
        `SELECT nextval('public.exit_staff_orders_id_seq') AS n`
      );
      const n = Number(seq.rows[0].n);
      const order_no = `EXIT-${String(n).padStart(8, "0")}`;

      const ins = await client.query(
        `
        INSERT INTO public.exit_staff_orders
        (
          id,
          order_no,
          employee_no,
          employee_name,
          last_name,
          first_name,
          middle_name,
          branch_id,
          branch_code,
          branch_name,
          exit_type,
          date_created,
          effective_date,
          settlement_date,
          settlement_branch_id,
          settlement_branch_code,
          settlement_branch_name,
          remarks,
          status,
          created_by
        )
        VALUES
        (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11,
          $12::date,
          $13::date,
          $14::date,
          $15,
          $16,
          $17,
          $18,
          'Pending',
          $19
        )
        RETURNING *;
        `,
        [
          n,
          order_no,
          clean(staff.employee_no),
          employee_name,
          clean(staff.last_name),
          clean(staff.first_name),
          clean(staff.middle_name),
          prev_branch_id,
          prev_branch_code,
          prev_branch_name,
          exit_type,
          date_created,
          effective_date,
          settlement_date || null,
          settlement_branch_id || null,
          settlement_branch_code || null,
          settlement_branch_name || null,
          remarks || null,
          req.user?.id ?? null,
        ]
      );

      await client.query("COMMIT");
      return res.json(ins.rows[0]);
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("POST /exit-staff-orders ERROR:", e);
      return res.status(500).json({ message: e?.message || "Server error" });
    } finally {
      client.release();
    }
  }
);

router.put(
  "/exit-staff-orders/:id/approve",
  requireAuth,
  requireRole([
    "admin",
    "assistant vice president",
    "vice president",
    "senior vice president",
    "president",
  ]),
  async (req, res) => {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const id = toInt(req.params.id);
      if (!id) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Invalid id" });
      }

      const orderRes = await client.query(
        `
        SELECT *
        FROM public.exit_staff_orders
        WHERE id = $1
        FOR UPDATE
        `,
        [id]
      );

      if (orderRes.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Exit staff order not found" });
      }

      const existing = orderRes.rows[0];

      if (String(existing.status || "").toLowerCase() !== "pending") {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Only pending orders can be approved" });
      }

      const employeeNo = clean(existing.employee_no);
      const effectiveDate = toDate(existing.effective_date);
      const exitType = normalizeExitType(existing.exit_type);
      const remarks = clean(existing.remarks) || null;

      if (!employeeNo) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Order has no employee number" });
      }

      if (!effectiveDate) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Order has invalid effective date" });
      }

      const staffRes = await client.query(
        `
        SELECT id, employee_no
        FROM public.staff
        WHERE employee_no = $1
        FOR UPDATE
        `,
        [employeeNo]
      );

      if (staffRes.rowCount === 0) {
        await client.query("ROLLBACK");
        return res
          .status(404)
          .json({ message: "Staff record not found for this employee number" });
      }

      const orderUpdate = await client.query(
        `
        UPDATE public.exit_staff_orders
        SET
          status = 'Approved',
          approved_by = $2,
          approved_at = NOW(),
          rejected_by = NULL,
          rejected_at = NULL,
          rejection_reason = NULL
        WHERE id = $1
        RETURNING *;
        `,
        [id, req.user?.id ?? null]
      );

      await client.query(
        `
        UPDATE public.staff
        SET
          status = 'Inactive',
          exit_type = $2,
          exit_date = $3::date,
          exit_remarks = $4
        WHERE employee_no = $1
        `,
        [employeeNo, exitType, effectiveDate, remarks]
      );

      try {
        await client.query(
          `
          INSERT INTO public.status_history
            (employee_no, effective_date, status, reason, remarks)
          VALUES
            ($1, $2::date, 'Inactive', $3, $4)
          ON CONFLICT DO NOTHING
          `,
          [employeeNo, effectiveDate, exitType, remarks]
        );
      } catch (historyErr) {
        console.warn("status_history insert skipped:", historyErr.message);
      }

      await client.query("COMMIT");
      return res.json(orderUpdate.rows[0]);
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("PUT /exit-staff-orders/:id/approve ERROR:", e);
      return res.status(500).json({ message: e?.message || "Server error" });
    } finally {
      client.release();
    }
  }
);

router.put(
  "/exit-staff-orders/:id/reject",
  requireAuth,
  requireRole([
    "admin",
    "assistant vice president",
    "vice president",
    "senior vice president",
    "president",
  ]),
  async (req, res) => {
    try {
      const id = toInt(req.params.id);
      const reason = clean(req.body?.reason);

      if (!id) return res.status(400).json({ message: "Invalid id" });
      if (!reason) {
        return res.status(400).json({ message: "Rejection reason required" });
      }

      const r = await pool.query(
        `
        UPDATE public.exit_staff_orders
        SET
          status = 'Rejected',
          rejected_by = $2,
          rejected_at = NOW(),
          rejection_reason = $3,
          approved_by = NULL,
          approved_at = NULL
        WHERE id = $1
          AND status = 'Pending'
        RETURNING *;
        `,
        [id, req.user?.id ?? null, reason]
      );

      if (r.rowCount === 0) {
        return res.status(400).json({ message: "Not found or not Pending" });
      }

      return res.json(r.rows[0]);
    } catch (e) {
      console.error("PUT /exit-staff-orders/:id/reject ERROR:", e.message);
      return res.status(500).json({ message: e?.message || "Server error" });
    }
  }
);

router.delete(
  "/exit-staff-orders/:id",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    try {
      const id = toInt(req.params.id);
      if (!id) return res.status(400).json({ message: "Invalid id" });

      const check = await pool.query(
        `
        SELECT status
        FROM public.exit_staff_orders
        WHERE id = $1
        `,
        [id]
      );

      if (check.rowCount === 0) {
        return res.status(404).json({ message: "Order not found" });
      }

      if (String(check.rows[0].status || "").toLowerCase() === "approved") {
        return res.status(400).json({ message: "Approved orders cannot be deleted" });
      }

      await pool.query(
        `
        DELETE FROM public.exit_staff_orders
        WHERE id = $1
        `,
        [id]
      );

      return res.json({ message: "Deleted" });
    } catch (e) {
      console.error("DELETE /exit-staff-orders/:id ERROR:", e.message);
      return res.status(500).json({ message: e?.message || "Server error" });
    }
  }
);

module.exports = router;