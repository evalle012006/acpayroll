const express = require("express");
const router = express.Router();
const pool = require("../db");
const { requireAuth, requireRole } = require("../middlewares/authMiddleware");

/* ------------------------- Helpers ------------------------- */
const toInt = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

const toDate = (v) => {
  const s = String(v ?? "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};

const toStr = (v) => String(v ?? "").trim();

const roleLower = (req) => String(req.user?.role || "").trim().toLowerCase();
const isAdmin = (req) => roleLower(req) === "admin";
const isBranchManager = (req) => roleLower(req) === "branch manager";
const getUserBranchId = (req) => req.user?.branch_id ?? null;

/* Branch manager guard:
   - Can only create/edit/delete deployments for staff currently in their branch
*/
async function assertStaffInManagersBranch(req, client, employeeId) {
  if (!isBranchManager(req)) return true;

  const bid = getUserBranchId(req);
  if (!bid) return false;

  const r = await client.query(
    `SELECT id FROM public.staff WHERE id=$1 AND branch_id=$2`,
    [employeeId, bid]
  );

  return r.rowCount > 0;
}

/* ------------------------- GET list ------------------------- */
// GET /api/deployments
router.get("/deployments", requireAuth, async (req, res) => {
  try {
    const role = roleLower(req);

    if (role === "admin") {
      const r = await pool.query(
        `SELECT * FROM public.deployment_orders ORDER BY id DESC`
      );
      return res.json(r.rows);
    }

    if (role === "branch manager") {
      const bid = getUserBranchId(req);
      if (!bid) return res.json([]);
      const r = await pool.query(
        `SELECT *
         FROM public.deployment_orders
         WHERE branch_id = $1
         ORDER BY id DESC`,
        [bid]
      );
      return res.json(r.rows);
    }

    return res.status(403).json({ message: "Access denied" });
  } catch (e) {
    console.error("GET /api/deployments ERROR:", e.message);
    return res.status(500).json({ message: "Server error" });
  }
});

/* ------------------------- GET one (VIEW) ------------------------- */
// GET /api/deployments/:id
router.get("/deployments/:id", requireAuth, async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });

    // Admin can view all. Branch manager can view only own branch records.
    if (isBranchManager(req)) {
      const bid = getUserBranchId(req);
      const r = await pool.query(
        `SELECT * FROM public.deployment_orders WHERE id=$1 AND branch_id=$2`,
        [id, bid]
      );
      if (r.rowCount === 0) return res.status(404).json({ message: "Not found" });
      return res.json(r.rows[0]);
    }

    if (!isAdmin(req)) return res.status(403).json({ message: "Access denied" });

    const r = await pool.query(`SELECT * FROM public.deployment_orders WHERE id=$1`, [id]);
    if (r.rowCount === 0) return res.status(404).json({ message: "Not found" });

    return res.json(r.rows[0]);
  } catch (e) {
    console.error("GET /api/deployments/:id ERROR:", e.message);
    return res.status(500).json({ message: "Server error" });
  }
});

/* ------------------------- CREATE ------------------------- */
// POST /api/deployments
router.post(
  "/deployments",
  requireAuth,
  requireRole(["admin", "branch manager"]),
  async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const employee_id = toInt(req.body?.employee_id);
      const branch_id = toInt(req.body?.branch_id);
      const deployment_date = toDate(req.body?.deployment_date);
      const details = toStr(req.body?.details);

      if (!employee_id) return res.status(400).json({ message: "Employee is required" });
      if (!branch_id) return res.status(400).json({ message: "Branch is required" });
      if (!deployment_date) return res.status(400).json({ message: "Deployment date is required" });

      // Branch manager can only deploy staff currently in their branch
      const ok = await assertStaffInManagersBranch(req, client, employee_id);
      if (!ok) {
        await client.query("ROLLBACK");
        return res.status(403).json({ message: "Access denied" });
      }

      // get staff snapshot (name parts + fullname)
      const s = await client.query(
        `SELECT id, fullname, first_name, last_name, middle_name
         FROM public.staff
         WHERE id = $1`,
        [employee_id]
      );
      if (s.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Staff not found" });
      }
      const staffRow = s.rows[0];

      // branch snapshot
      const b = await client.query(
        `SELECT id, code, name FROM public.branches WHERE id=$1`,
        [branch_id]
      );
      if (b.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Branch not found" });
      }
      const branchRow = b.rows[0];

      const ins = await client.query(
        `
        INSERT INTO public.deployment_orders
          (employee_id, employee_name,
           first_name, last_name, middle_name,
           branch_id, branch_code, branch_name,
           deployment_date, details,
           status, created_by)
        VALUES
          ($1,$2,
           $3,$4,$5,
           $6,$7,$8,
           $9::date,$10,
           'Pending',$11)
        RETURNING *;
        `,
        [
          employee_id,
          String(staffRow.fullname || ""),
          toStr(staffRow.first_name) || null,
          toStr(staffRow.last_name) || null,
          toStr(staffRow.middle_name) || null,
          branch_id,
          String(branchRow.code || ""),
          String(branchRow.name || ""),
          deployment_date,
          details || null,
          req.user?.id ?? null,
        ]
      );

      await client.query("COMMIT");
      return res.json(ins.rows[0]);
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("POST /api/deployments ERROR:", e.message);
      return res.status(500).json({ message: "Server error" });
    } finally {
      client.release();
    }
  }
);

/* ------------------------- EDIT ------------------------- */
// PUT /api/deployments/:id
router.put(
  "/deployments/:id",
  requireAuth,
  requireRole(["admin", "branch manager"]),
  async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const id = toInt(req.params.id);
      if (!id) return res.status(400).json({ message: "Invalid id" });

      // read existing row for access checks
      const existing = await client.query(
        `SELECT * FROM public.deployment_orders WHERE id=$1`,
        [id]
      );
      if (existing.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Deployment not found" });
      }

      const row = existing.rows[0];

      // branch manager can only edit if the employee is in their branch (current staff branch)
      if (isBranchManager(req)) {
        const ok = await assertStaffInManagersBranch(req, client, row.employee_id);
        if (!ok) {
          await client.query("ROLLBACK");
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const branch_id = toInt(req.body?.branch_id);
      const deployment_date = toDate(req.body?.deployment_date);
      const details = toStr(req.body?.details);

      if (!branch_id) return res.status(400).json({ message: "Branch is required" });
      if (!deployment_date) return res.status(400).json({ message: "Deployment date is required" });

      // branch snapshot
      const b = await client.query(
        `SELECT id, code, name FROM public.branches WHERE id=$1`,
        [branch_id]
      );
      if (b.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Branch not found" });
      }
      const branchRow = b.rows[0];

      const r = await client.query(
        `
        UPDATE public.deployment_orders
        SET branch_id=$1,
            branch_code=$2,
            branch_name=$3,
            deployment_date=$4::date,
            details=$5,
            updated_at=NOW()
        WHERE id=$6
        RETURNING *;
        `,
        [
          branch_id,
          String(branchRow.code || ""),
          String(branchRow.name || ""),
          deployment_date,
          details || null,
          id,
        ]
      );

      await client.query("COMMIT");
      return res.json(r.rows[0]);
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("PUT /api/deployments/:id ERROR:", e.message);
      return res.status(500).json({ message: "Server error" });
    } finally {
      client.release();
    }
  }
);

/* ------------------------- DELETE ------------------------- */
// DELETE /api/deployments/:id
router.delete(
  "/deployments/:id",
  requireAuth,
  requireRole(["admin"]), // keep admin only for safety
  async (req, res) => {
    try {
      const id = toInt(req.params.id);
      if (!id) return res.status(400).json({ message: "Invalid id" });

      const r = await pool.query(
        `DELETE FROM public.deployment_orders WHERE id=$1 RETURNING id`,
        [id]
      );

      if (r.rowCount === 0) return res.status(404).json({ message: "Deployment not found" });

      return res.json({ message: "Deleted", id: r.rows[0].id });
    } catch (e) {
      console.error("DELETE /api/deployments/:id ERROR:", e.message);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

/* ------------------------- APPROVE ------------------------- */
// PUT /api/deployments/:id/approve  (ADMIN)
router.put(
  "/deployments/:id/approve",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const id = toInt(req.params.id);
      if (!id) return res.status(400).json({ message: "Invalid id" });

      const r = await client.query(
        `
        UPDATE public.deployment_orders
        SET
          status='Approved',
          approved_by=$2,
          approved_at=COALESCE(approved_at, NOW()),
          rejected_by=NULL,
          rejected_at=NULL,
          rejection_reason=NULL,
          updated_at=NOW()
        WHERE id=$1 AND status='Pending'
        RETURNING *;
        `,
        [id, req.user?.id ?? null]
      );

      if (r.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Not found or not Pending" });
      }

      const order = r.rows[0];

      // apply to staff: update staff.branch_id
      await client.query(
        `UPDATE public.staff SET branch_id=$1 WHERE id=$2`,
        [order.branch_id, order.employee_id]
      );

      await client.query("COMMIT");
      return res.json(order);
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("PUT /api/deployments/:id/approve ERROR:", e.message);
      return res.status(500).json({ message: "Server error" });
    } finally {
      client.release();
    }
  }
);

module.exports = router;