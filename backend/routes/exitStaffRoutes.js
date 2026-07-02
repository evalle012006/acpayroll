const express = require("express");
const router = express.Router();
const pool = require("../db");

const { requireAuth } = require("../middlewares/authMiddleware");
const { requirePermission } = require("../middlewares/permissionMiddleware");
const { writeEvent, dispatchSyncEvent } = require("../services/lmsSyncService");

const {
  isAdmin,
  isIT,
  isHr,
  isAccounting,
  isTread,
  isBranchManager,
  isAreaManager,
  isRegionalManager,
  isAssistantVicePresident,
  isVicePresident,
  isSeniorVicePresident,
  isPresident,
} = require("../utils/roleAccess");

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

const todayDate = () => new Date().toISOString().slice(0, 10);
const clean = (v) => String(v ?? "").trim();
const norm = (v) => clean(v).toLowerCase();

const isTopManagement = (req) =>
  isAdmin(req) ||
  isIT(req) ||
  isHr(req) ||
  isAccounting(req) ||
  isTread(req) ||
  isAreaManager(req) ||
  isRegionalManager(req) ||
  isAssistantVicePresident(req) ||
  isVicePresident(req) ||
  isSeniorVicePresident(req) ||
  isPresident(req);

const isHRDepartmentManagement = (req) => {
  const dept = String(req.user?.department || "").trim().toUpperCase();

  return (
    dept === "HR DEPARTMENT" &&
    (
      isBranchManager(req) ||
      isAreaManager(req) ||
      isRegionalManager(req) ||
      isAssistantVicePresident(req) ||
      isVicePresident(req) ||
      isSeniorVicePresident(req)
    )
  );
};

const getUserBranchId = (req) => {
  const raw =
    req.user?.branch_id ??
    req.user?.branchId ??
    req.user?.branch_code ??
    req.user?.branchCode ??
    null;

  const n = Number(raw);

  if (Number.isFinite(n)) {
    return Math.trunc(n);
  }

  return null;
};

const getUserBranchCode = (req) =>
  clean(
    req.user?.branch_code ??
      req.user?.branchCode ??
      req.user?.branch_id ??
      ""
  );

const normalizeExitType = (v) => {
  const s = norm(v);

  if (s === "awol") return "AWOL";
  if (s === "resign" || s === "resigned") return "Resigned";
  if (s === "termination" || s === "terminated") return "Terminated";
  if (s === "deceased" || s === "death") return "Deceased";

  return clean(v);
};

const buildEmployeeName = (row) => {
  const ln = clean(row?.last_name);
  const fn = clean(row?.first_name);
  const mn = clean(row?.middle_name);

  const built = `${ln}${ln && fn ? ", " : ""}${fn}${mn ? ` ${mn}` : ""}`
    .replace(/\s+/g, " ")
    .trim();

  return built || clean(row?.fullname) || clean(row?.employee_name);
};

const applyDueExitStaff = async () => {
  await pool.query(`
    UPDATE public.staff s
    SET status = 'Inactive'
    FROM public.exit_staff_orders eso
    WHERE s.employee_no = eso.employee_no
      AND LOWER(TRIM(COALESCE(eso.status, ''))) = 'approved'
      AND eso.effective_date IS NOT NULL
      AND eso.effective_date <= CURRENT_DATE
      AND LOWER(TRIM(COALESCE(s.status, ''))) <> 'inactive'
      AND NOT EXISTS (
        SELECT 1
        FROM public.status_history sh
        WHERE sh.employee_no = eso.employee_no
          AND LOWER(TRIM(COALESCE(sh.status, ''))) = 'active'
          AND LOWER(TRIM(COALESCE(sh.reason, ''))) IN ('re-apply', 'reapply')
          AND sh.effective_date IS NOT NULL
          AND sh.effective_date >= eso.effective_date
      )
  `);
};

router.get(
  "/exit-staff",
  requireAuth,
  requirePermission("exit_staff_order", "view"),
  async (req, res) => {
    try {
      await applyDueExitStaff();

      if (!isTopManagement(req) && !isBranchManager(req) && !isHRDepartmentManagement(req)) {
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
          s.exit_remarks,
          s.area,
          s.region,
          s.division,
          s.start_date,
          s.regularization_date
        FROM public.staff s
        LEFT JOIN public.branches b ON b.id = s.branch_id
        WHERE LOWER(TRIM(COALESCE(s.status, ''))) = 'inactive'
          AND LOWER(TRIM(COALESCE(s.exit_type, ''))) IN ('awol', 'resigned', 'terminated', 'deceased')
      `;

      if (isBranchManager(req) && !isHRDepartmentManagement(req)) {
        const bid = getUserBranchId(req);
        const bcode = getUserBranchCode(req);

        if (bid) {
          params.push(bid);
          sql += ` AND s.branch_id = $${params.length}`;
        } else if (bcode) {
          params.push(bcode);
          sql += ` AND b.code = $${params.length}`;
        } else {
          return res.json([]);
        }
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
  }
);

router.get(
  "/exit-staff-orders",
  requireAuth,
  requirePermission("exit_staff_order", "view"),
  async (req, res) => {
    try {
      await applyDueExitStaff();

      if (isTopManagement(req) || isHRDepartmentManagement(req)) {
        const r = await pool.query(`
          SELECT *
          FROM public.exit_staff_orders
          ORDER BY id DESC
        `);

        return res.json(r.rows);
      }

      if (isBranchManager(req) && !isHRDepartmentManagement(req)) {
        const bid = getUserBranchId(req);
        const bcode = getUserBranchCode(req);

        if (bid) {
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

        if (bcode) {
          const r = await pool.query(
            `
            SELECT *
            FROM public.exit_staff_orders
            WHERE branch_code = $1
            ORDER BY id DESC
            `,
            [bcode]
          );

          return res.json(r.rows);
        }

        return res.json([]);
      }

      return res.status(403).json({ message: "Access denied" });
    } catch (e) {
      console.error("GET /exit-staff-orders ERROR:", e.message);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

router.post(
  "/exit-staff-orders",
  requireAuth,
  requirePermission("exit_staff_order", "create"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const staff_id = toInt(req.body?.staff_id);
      const employee_no_input = clean(req.body?.employee_no);
      const exit_type = normalizeExitType(req.body?.exit_type);
      const date_created = toDate(req.body?.date_created) || todayDate();
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

      const staffQuery = staff_id
        ? {
            sql: `
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
            params: [staff_id],
          }
        : {
            sql: `
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
            params: [employee_no_input],
          };

      const s = await client.query(staffQuery.sql, staffQuery.params);

      if (s.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Staff not found" });
      }

      const staff = s.rows[0];

      if (isBranchManager(req) && !isHRDepartmentManagement(req)) {
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
          `
          SELECT code, name
          FROM public.branches
          WHERE id = $1
          `,
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
          `
          SELECT code, name
          FROM public.branches
          WHERE id = $1
          `,
          [settlement_branch_id]
        );

        if (sb.rowCount === 0) {
          await client.query("ROLLBACK");
          return res.status(404).json({ message: "Settlement branch not found" });
        }

        settlement_branch_code = clean(sb.rows[0].code);
        settlement_branch_name = clean(sb.rows[0].name);
      }

      const employee_name = clean(req.body?.employee_name) || buildEmployeeName(staff);

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
  requirePermission("exit_staff_order", "approve"),
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

      if (norm(existing.status) !== "pending") {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: "Only pending orders can be approved",
        });
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
        return res.status(404).json({
          message: "Staff record not found for this employee number",
        });
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

      const today = todayDate();

      if (effectiveDate <= today) {
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
      } else {
        await client.query(
          `
          UPDATE public.staff
          SET
            status = 'Active',
            exit_type = $2,
            exit_date = $3::date,
            exit_remarks = $4
          WHERE employee_no = $1
          `,
          [employeeNo, exitType, effectiveDate, remarks]
        );
      }

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

      // ── LMS Sync ──
      // Fetch updated staff row for employee_id (exit_staff_orders uses employee_no)
      const staffForSync = staffRes.rows[0]; // already fetched above in this handler
      const syncEventId = await writeEvent(client, {
        event_type:   "exited",
        employee_id:  staffForSync.id,
        employee_no:  existing.employee_no,
        source_table: "exit_staff_orders",
        source_id:    existing.id,
        payload: {
          employee_no:    existing.employee_no,
          employee_name:  existing.employee_name,
          exit_type:      existing.exit_type,
          effective_date: existing.effective_date,
          remarks:        existing.remarks,
          order_no:       existing.order_no,
        },
      });
      // ── end LMS Sync ──

      await client.query("COMMIT");

      dispatchSyncEvent(syncEventId).catch(() => {});

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
  requirePermission("exit_staff_order", "reject"),
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

router.put("/exit-staff/:id/reapply",
  requireAuth,
  requirePermission("exit_staff_order", "approve"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const id = toInt(req.params.id);

      if (!id) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Invalid staff id" });
      }

      const branch_id = toInt(req.body?.branch_id);
      const position = clean(req.body?.position);
      const start_date = toDate(req.body?.start_date) || todayDate();
      const remarks = clean(req.body?.remarks);

      if (!branch_id) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Branch is required" });
      }

      if (!position) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Position is required" });
      }

      const staffRes = await client.query(
        `
        SELECT
          id,
          employee_no,
          fullname,
          last_name,
          first_name,
          middle_name,
          status
        FROM public.staff
        WHERE id = $1
        FOR UPDATE
        `,
        [id]
      );

      if (staffRes.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Staff not found" });
      }

      const branchRes = await client.query(
        `
        SELECT
          id,
          code,
          name,
          area,
          region,
          division
        FROM public.branches
        WHERE id = $1
        LIMIT 1
        `,
        [branch_id]
      );

      if (branchRes.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Branch not found" });
      }

      const branch = branchRes.rows[0];
      const staff = staffRes.rows[0];
      const employeeNo = clean(staff.employee_no);

      await client.query(
        `
       UPDATE public.exit_staff_orders
        SET
          remarks = TRIM(COALESCE(remarks, '') || E'\nRe-applied on ' || $2::text)
        WHERE employee_no = $1
          AND LOWER(TRIM(COALESCE(status, ''))) = 'approved'
        `,
        [employeeNo, start_date]
      );

      const updated = await client.query(
        `
        UPDATE public.staff
        SET
          status = 'Active',
          branch_id = $2,
          area = $3,
          region = $4,
          division = $5,
          "position" = $6,
          start_date = $7::date,
          exit_type = NULL,
          exit_date = NULL,
          exit_remarks = NULL
        WHERE id = $1
        RETURNING
          id,
          employee_no,
          fullname,
          last_name,
          first_name,
          middle_name,
          branch_id,
          area,
          region,
          division,
          "position",
          status
        `,
        [
          id,
          branch.id,
          clean(branch.area) || clean(req.body?.area) || "",
          clean(branch.region) || clean(req.body?.region) || "",
          clean(branch.division) || clean(req.body?.division) || "",
          position,
          start_date,
        ]
      );

      try {
        await client.query(
          `
          INSERT INTO public.status_history
            (employee_no, effective_date, status, reason, remarks)
          VALUES
            ($1, $2::date, 'Active', 'Re-Apply', $3)
          ON CONFLICT DO NOTHING
          `,
          [employeeNo, start_date, remarks || null]
        );
      } catch (historyErr) {
        console.warn("status_history reapply insert skipped:", historyErr.message);
      }

      await client.query("COMMIT");

      return res.json({
        message: "Staff re-applied successfully",
        staff: updated.rows[0],
      });
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("PUT /api/exit-staff/:id/reapply ERROR:", e);
      return res.status(500).json({ message: e?.message || "Server error" });
    } finally {
      client.release();
    }
  }
);

router.delete("/exit-staff-orders/:id",
  requireAuth,
  requirePermission("exit_staff_order", "delete"),
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

      const orderStatus = norm(check.rows[0].status);

        if (
          !["approved", "rejected", "pending"].includes(orderStatus)
        ) {
          return res.status(400).json({
            message: "Invalid status"
          });
        }

        const order = await pool.query(
          `
          SELECT employee_no
          FROM public.exit_staff_orders
          WHERE id = $1
          `,
          [id]
        );

        if (order.rowCount > 0 && orderStatus === "approved") {
          await pool.query(
            `
            UPDATE public.staff
            SET
              status = 'Active',
              exit_type = NULL,
              exit_date = NULL,
              exit_remarks = NULL
            WHERE employee_no = $1
            `,
            [order.rows[0].employee_no]
          );
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