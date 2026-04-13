const express = require("express");
const router = express.Router();
const pool = require("../db");
const { requireAuth, requireRole } = require("../middlewares/authMiddleware");

const toInt = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

const toDate = (v) => {
  const s = String(v ?? "").trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};

const toStr = (v) => String(v ?? "").trim();
const toNum = (v) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const roleLower = (req) => String(req.user?.role || "").trim().toLowerCase();
const isAdmin = (req) => roleLower(req) === "admin";
const isHr = (req) => roleLower(req) === "hr";
const isAccounting = (req) => roleLower(req) === "accounting";
const isBranchManager = (req) => roleLower(req) === "branch manager";
const isAreaManager = (req) => roleLower(req) === "area manager";
const isRegionalManager = (req) => roleLower(req) === "regional manager";
const isAssistantVicePresident = (req) =>
  roleLower(req) === "assistant vice president";

const getUserRegion = (req) => toStr(req.user?.region);
const getUserBranchCode = (req) => toStr(req.user?.branch_id);
const getUserArea = (req) => toStr(req.user?.area);

async function assertStaffInManagersRegion(req, client, employeeId) {
  if (!isRegionalManager(req)) return true;

  const userRegion = getUserRegion(req);
  if (!userRegion) return false;

  const r = await client.query(
    `
    SELECT id
    FROM public.staff
    WHERE id = $1
      AND LOWER(TRIM(COALESCE(region, ''))) = LOWER(TRIM($2))
    `,
    [employeeId, userRegion]
  );

  return r.rowCount > 0;
}

async function getBranchByCode(client, branchCode) {
  const code = toStr(branchCode);
  if (!code) return null;

  const r = await client.query(
    `
    SELECT id, code, name
    FROM public.branches
    WHERE LOWER(TRIM(code)) = LOWER(TRIM($1))
    LIMIT 1
    `,
    [code]
  );

  return r.rowCount ? r.rows[0] : null;
}

async function getManagerBranch(client, req) {
  const managerBranchCode = getUserBranchCode(req);
  if (!managerBranchCode) return null;
  return await getBranchByCode(client, managerBranchCode);
}

async function assertStaffInManagersBranch(req, client, employeeId) {
  if (!isBranchManager(req)) return true;

  const managerBranch = await getManagerBranch(client, req);
  if (!managerBranch?.id) return false;

  const r = await client.query(
    `
    SELECT id
    FROM public.staff
    WHERE id = $1
      AND branch_id = $2
    `,
    [employeeId, managerBranch.id]
  );

  return r.rowCount > 0;
}

async function assertStaffInManagersArea(req, client, employeeId) {
  if (!isAreaManager(req)) return true;

  const userArea = getUserArea(req);
  if (!userArea) return false;

  const r = await client.query(
    `
    SELECT id
    FROM public.staff
    WHERE id = $1
      AND LOWER(TRIM(COALESCE(area, ''))) = LOWER(TRIM($2))
    `,
    [employeeId, userArea]
  );

  return r.rowCount > 0;
}

async function syncStaffBalancesFromStaff(client, staffId) {
  const staffRes = await client.query(
    `
    SELECT
      employee_no,
      cbu,
      cashbond,
      utility_charge,
      utility,
      other_receivable,
      staff_accounts_payable
    FROM public.staff
    WHERE id = $1
    LIMIT 1
    `,
    [staffId]
  );

  if (staffRes.rowCount === 0) return;

  const s = staffRes.rows[0];
  const employeeNo = toStr(s.employee_no);
  if (!employeeNo) return;

  await client.query(
    `
    INSERT INTO public.staff_balances
      (
        employee_no,
        cbu,
        cashbond,
        utility,
        other_receivable,
        staff_accounts_payable
      )
    VALUES
      ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (employee_no)
    DO UPDATE SET
      cbu = EXCLUDED.cbu,
      cashbond = EXCLUDED.cashbond,
      utility = EXCLUDED.utility,
      other_receivable = EXCLUDED.other_receivable,
      staff_accounts_payable = EXCLUDED.staff_accounts_payable
    `,
    [
      employeeNo,
      toNum(s.cbu),
      toNum(s.cashbond),
      toNum(s.utility ?? s.utility_charge),
      toNum(s.other_receivable),
      toNum(s.staff_accounts_payable),
    ]
  );
}

/* =========================================================
   GET ALL DEPLOYMENTS
========================================================= */
router.get("/deployments", requireAuth, async (req, res) => {
  const client = await pool.connect();

  try {
    if (isAdmin(req) || isHr(req) || isAccounting(req)) {
      const r = await client.query(`
        SELECT *
        FROM public.deployment_orders
        ORDER BY id DESC
      `);

      return res.json(r.rows);
    }

    if (isBranchManager(req)) {
      const managerBranch = await getManagerBranch(client, req);
      if (!managerBranch?.id) return res.json([]);

      const r = await client.query(
        `
        SELECT *
        FROM public.deployment_orders
        WHERE branch_id = $1
        ORDER BY id DESC
        `,
        [managerBranch.id]
      );

      return res.json(r.rows);
    }

    if (isAreaManager(req)) {
      const userArea = getUserArea(req);
      if (!userArea) return res.json([]);

      const r = await client.query(
        `
        SELECT d.*
        FROM public.deployment_orders d
        JOIN public.staff s ON s.id = d.employee_id
        WHERE LOWER(TRIM(COALESCE(s.area, ''))) = LOWER(TRIM($1))
        ORDER BY d.id DESC
        `,
        [userArea]
      );

      return res.json(r.rows);
    }

    if (isRegionalManager(req)) {
      const userRegion = getUserRegion(req);
      if (!userRegion) return res.json([]);

      const r = await client.query(
        `
        SELECT d.*
        FROM public.deployment_orders d
        JOIN public.staff s ON s.id = d.employee_id
        WHERE LOWER(TRIM(COALESCE(s.region, ''))) = LOWER(TRIM($1))
        ORDER BY d.id DESC
        `,
        [userRegion]
      );

      return res.json(r.rows);
    }

    if (isAssistantVicePresident(req)) {
      const r = await client.query(
        `
        SELECT *
        FROM public.deployment_orders
        ORDER BY id DESC
        `
      );

      return res.json(r.rows);
    }

    return res.status(403).json({ message: "Access denied" });
  } catch (e) {
    console.error("GET /api/deployments ERROR:", e.message);
    return res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
});

/* =========================================================
   GET ONE DEPLOYMENT
========================================================= */
router.get("/deployments/:id", requireAuth, async (req, res) => {
  const client = await pool.connect();

  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });

    if (isAdmin(req) || isHr(req) || isAccounting(req) || isAssistantVicePresident(req)) {
      const r = await client.query(
        `
        SELECT *
        FROM public.deployment_orders
        WHERE id = $1
        `,
        [id]
      );

      if (r.rowCount === 0) {
        return res.status(404).json({ message: "Not found" });
      }

      return res.json(r.rows[0]);
    }

    if (isBranchManager(req)) {
      const managerBranch = await getManagerBranch(client, req);
      if (!managerBranch?.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      const r = await client.query(
        `
        SELECT *
        FROM public.deployment_orders
        WHERE id = $1
          AND branch_id = $2
        `,
        [id, managerBranch.id]
      );

      if (r.rowCount === 0) {
        return res.status(404).json({ message: "Not found" });
      }

      return res.json(r.rows[0]);
    }

    if (isAreaManager(req)) {
      const userArea = getUserArea(req);
      if (!userArea) return res.status(403).json({ message: "Access denied" });

      const r = await client.query(
        `
        SELECT d.*
        FROM public.deployment_orders d
        JOIN public.staff s ON s.id = d.employee_id
        WHERE d.id = $1
          AND LOWER(TRIM(COALESCE(s.area, ''))) = LOWER(TRIM($2))
        `,
        [id, userArea]
      );

      if (r.rowCount === 0) {
        return res.status(404).json({ message: "Not found" });
      }

      return res.json(r.rows[0]);
    }

    if (isRegionalManager(req)) {
      const userRegion = getUserRegion(req);
      if (!userRegion) return res.status(403).json({ message: "Access denied" });

      const r = await client.query(
        `
        SELECT d.*
        FROM public.deployment_orders d
        JOIN public.staff s ON s.id = d.employee_id
        WHERE d.id = $1
          AND LOWER(TRIM(COALESCE(s.region, ''))) = LOWER(TRIM($2))
        `,
        [id, userRegion]
      );

      if (r.rowCount === 0) {
        return res.status(404).json({ message: "Not found" });
      }

      return res.json(r.rows[0]);
    }

    return res.status(403).json({ message: "Access denied" });
  } catch (e) {
    console.error("GET /api/deployments/:id ERROR:", e.message);
    return res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
});

/* =========================================================
   GET DEPLOYMENTS BY STAFF
========================================================= */
router.get(
  "/deployment-orders/staff/:id",
  requireAuth,
  requireRole([
    "admin",
    "hr",
    "accounting",
    "branch manager",
    "area manager",
    "regional manager",
    "assistant vice president",
  ]),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const employeeId = toInt(req.params.id);
      if (!employeeId) {
        return res.status(400).json({ message: "Invalid staff id" });
      }

      if (isBranchManager(req)) {
        const ok = await assertStaffInManagersBranch(req, client, employeeId);
        if (!ok) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      if (isAreaManager(req)) {
        const ok = await assertStaffInManagersArea(req, client, employeeId);
        if (!ok) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      if (isRegionalManager(req)) {
        const ok = await assertStaffInManagersRegion(req, client, employeeId);
        if (!ok) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const r = await client.query(
        `
        SELECT *
        FROM public.deployment_orders
        WHERE employee_id = $1
        ORDER BY created_at DESC
        `,
        [employeeId]
      );

      return res.json(r.rows);
    } catch (e) {
      console.error("GET /api/deployment-orders/staff/:id ERROR:", e.message);
      return res.status(500).json({ message: "Server error" });
    } finally {
      client.release();
    }
  }
);

/* =========================================================
   CREATE DEPLOYMENT
========================================================= */
router.post(
  "/deployments",
  requireAuth,
  requireRole([
    "admin",
    "branch manager",
    "area manager",
    "regional manager",
    "assistant vice president",
  ]),
  async (req, res) => {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const employee_id = toInt(req.body?.employee_id);
      const branch_code = toStr(req.body?.branch_code);
      const deployment_date = toDate(req.body?.deployment_date);
      const details = toStr(req.body?.details);

      if (!employee_id) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Employee is required" });
      }

      if (!branch_code) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Branch code is required" });
      }

      if (!deployment_date) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Deployment date is required" });
      }

      if (isBranchManager(req)) {
        const ok = await assertStaffInManagersBranch(req, client, employee_id);
        if (!ok) {
          await client.query("ROLLBACK");
          return res.status(403).json({ message: "Access denied" });
        }
      }

      if (isAreaManager(req)) {
        const ok = await assertStaffInManagersArea(req, client, employee_id);
        if (!ok) {
          await client.query("ROLLBACK");
          return res.status(403).json({ message: "Access denied" });
        }
      }

      if (isRegionalManager(req)) {
        const ok = await assertStaffInManagersRegion(req, client, employee_id);
        if (!ok) {
          await client.query("ROLLBACK");
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const s = await client.query(
        `
        SELECT id, fullname, first_name, last_name, middle_name
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
      const branchRow = await getBranchByCode(client, branch_code);

      if (!branchRow) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Branch not found" });
      }

      const ins = await client.query(
        `
        INSERT INTO public.deployment_orders
          (
            employee_id,
            employee_name,
            first_name,
            last_name,
            middle_name,
            branch_id,
            branch_code,
            branch_name,
            deployment_date,
            details,
            status,
            created_by
          )
        VALUES
          (
            $1, $2, $3, $4, $5, $6, $7, $8, $9::date, $10, 'Pending', $11
          )
        RETURNING *;
        `,
        [
          employee_id,
          toStr(staffRow.fullname) || "",
          toStr(staffRow.first_name) || null,
          toStr(staffRow.last_name) || null,
          toStr(staffRow.middle_name) || null,
          branchRow.id,
          branchRow.code,
          branchRow.name,
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

/* =========================================================
   UPDATE DEPLOYMENT
========================================================= */
router.put(
  "/deployments/:id",
  requireAuth,
  requireRole([
    "admin",
    "branch manager",
    "area manager",
    "regional manager",
    "assistant vice president",
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

      const existing = await client.query(
        `
        SELECT *
        FROM public.deployment_orders
        WHERE id = $1
        `,
        [id]
      );

      if (existing.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Deployment not found" });
      }

      const row = existing.rows[0];

      if (String(row.status || "").toLowerCase() === "approved") {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Approved deployments cannot be edited" });
      }

      if (isBranchManager(req)) {
        const ok = await assertStaffInManagersBranch(req, client, row.employee_id);
        if (!ok) {
          await client.query("ROLLBACK");
          return res.status(403).json({ message: "Access denied" });
        }
      }

      if (isAreaManager(req)) {
        const ok = await assertStaffInManagersArea(req, client, row.employee_id);
        if (!ok) {
          await client.query("ROLLBACK");
          return res.status(403).json({ message: "Access denied" });
        }
      }

      if (isRegionalManager(req)) {
        const ok = await assertStaffInManagersRegion(req, client, row.employee_id);
        if (!ok) {
          await client.query("ROLLBACK");
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const branch_code = toStr(req.body?.branch_code);
      const deployment_date = toDate(req.body?.deployment_date);
      const details = toStr(req.body?.details);

      if (!branch_code) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Branch code is required" });
      }

      if (!deployment_date) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Deployment date is required" });
      }

      const branchRow = await getBranchByCode(client, branch_code);
      if (!branchRow) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Branch not found" });
      }

      const upd = await client.query(
        `
        UPDATE public.deployment_orders
        SET
          branch_id = $1,
          branch_code = $2,
          branch_name = $3,
          deployment_date = $4::date,
          details = $5,
          updated_at = NOW()
        WHERE id = $6
        RETURNING *;
        `,
        [branchRow.id, branchRow.code, branchRow.name, deployment_date, details || null, id]
      );

      await client.query("COMMIT");
      return res.json(upd.rows[0]);
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("PUT /api/deployments/:id ERROR:", e.message);
      return res.status(500).json({ message: "Server error" });
    } finally {
      client.release();
    }
  }
);

/* =========================================================
   DELETE DEPLOYMENT
========================================================= */
router.delete(
  "/deployments/:id",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    try {
      const id = toInt(req.params.id);
      if (!id) return res.status(400).json({ message: "Invalid id" });

      const r = await pool.query(
        `
        DELETE FROM public.deployment_orders
        WHERE id = $1
        RETURNING id
        `,
        [id]
      );

      if (r.rowCount === 0) {
        return res.status(404).json({ message: "Deployment not found" });
      }

      return res.json({ message: "Deleted", id: r.rows[0].id });
    } catch (e) {
      console.error("DELETE /api/deployments/:id ERROR:", e.message);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

/* =========================================================
   APPROVE DEPLOYMENT
========================================================= */
router.put(
  "/deployments/:id/approve",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
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
        UPDATE public.deployment_orders
        SET
          status = 'Approved',
          approved_by = $2,
          approved_at = COALESCE(approved_at, NOW()),
          rejected_by = NULL,
          rejected_at = NULL,
          rejection_reason = NULL,
          updated_at = NOW()
        WHERE id = $1
          AND status = 'Pending'
        RETURNING *;
        `,
        [id, req.user?.id ?? null]
      );

      if (r.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Not found or not Pending" });
      }

      const order = r.rows[0];

      await client.query(
        `
        UPDATE public.staff
        SET branch_id = $1
        WHERE id = $2
        `,
        [order.branch_id, order.employee_id]
      );

      await syncStaffBalancesFromStaff(client, order.employee_id);

      await client.query("COMMIT");
      return res.json(order);
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("PUT /api/deployments/:id/approve ERROR:", e.message);
      return res.status(500).json({ message: e?.message || "Server error" });
    } finally {
      client.release();
    }
  }
);

module.exports = router;