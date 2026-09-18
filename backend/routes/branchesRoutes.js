const express = require("express");
const router = express.Router();
const pool = require("../db");

const { requireAuth } = require("../middlewares/authMiddleware");
const { requirePermission } = require("../middlewares/permissionMiddleware");

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

const toNumOrNull = (v) => {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const toStr = (v) => String(v ?? "").trim();

const isTopManagement = (req) =>
  isAdmin(req) ||
  isIT(req) ||
  isHr(req) ||
  isAccounting(req) ||
  isTread(req) ||
  isVicePresident(req) ||
  isSeniorVicePresident(req) ||
  isPresident(req);

  const isDepartmentManagement = (req) => {
    const dept = String(req.user?.department || "").trim().toUpperCase();

    const allowedDepartment =
      dept === "HR DEPARTMENT" ||
      dept === "ACCOUNTING DEPARTMENT" ||
      dept === "IT DEPARTMENT";

    const allowedRole =
      isBranchManager(req) ||
      isAreaManager(req) ||
      isRegionalManager(req) ||
      isAssistantVicePresident(req) ||
      isVicePresident(req) ||
      isSeniorVicePresident(req);

    return allowedDepartment && allowedRole;
  };

const getUserBranchCode = (req) => toStr(req.user?.branch_id);
const getUserArea = (req) => toStr(req.user?.area);
const getUserRegion = (req) => toStr(req.user?.region);
const getUserDivision = (req) => toStr(req.user?.division);

router.get(
  "/branches",
  requireAuth,
  requirePermission("branch", "view"),
  async (req, res) => {
    try {
      if (isTopManagement(req) || isDepartmentManagement(req)) {
        const r = await pool.query(`
          SELECT id, code, name, area, region, division, address, latitude, longitude
          FROM public.branches
          ORDER BY id ASC
        `);

        return res.json(r.rows);
      }

      if (isBranchManager(req)) {
        const branchCode = getUserBranchCode(req);
        if (!branchCode) return res.json([]);

        const r = await pool.query(
          `
          SELECT id, code, name, area, region, division, address, latitude, longitude
          FROM public.branches
          WHERE LOWER(TRIM(code)) = LOWER(TRIM($1))
          ORDER BY id ASC
          `,
          [branchCode]
        );

        return res.json(r.rows);
      }

      if (isAreaManager(req)) {
        const area = getUserArea(req);
        if (!area) return res.json([]);

        const r = await pool.query(
          `
          SELECT id, code, name, area, region, division, address, latitude, longitude
          FROM public.branches
          WHERE LOWER(TRIM(COALESCE(area, ''))) = LOWER(TRIM($1))
          ORDER BY id ASC
          `,
          [area]
        );

        return res.json(r.rows);
      }

      if (isRegionalManager(req)) {
        const region = getUserRegion(req);
        if (!region) return res.json([]);

        const r = await pool.query(
          `
          SELECT id, code, name, area, region, division, address, latitude, longitude
          FROM public.branches
          WHERE LOWER(TRIM(COALESCE(region, ''))) = LOWER(TRIM($1))
          ORDER BY id ASC
          `,
          [region]
        );

        return res.json(r.rows);
      }

      if (isAssistantVicePresident(req)) {
        const division = getUserDivision(req);
        if (!division) return res.json([]);

        const r = await pool.query(
          `
          SELECT id, code, name, area, region, division, address, latitude, longitude
          FROM public.branches
          WHERE LOWER(TRIM(COALESCE(division, ''))) = LOWER(TRIM($1))
          ORDER BY id ASC
          `,
          [division]
        );

        return res.json(r.rows);
      }

      return res.status(403).json({ message: "Access denied" });
    } catch (e) {
      console.error("GET /api/branches ERROR:", e.message);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

router.get(
  "/branches-all",
  requireAuth,
  requirePermission("branch", "view"),
  async (_req, res) => {
    try {
      const r = await pool.query(`
        SELECT id, code, name, area, region, division, address, latitude, longitude
        FROM public.branches
        ORDER BY id ASC
      `);

      return res.json(r.rows);
    } catch (e) {
      console.error("GET /api/branches-all ERROR:", e.message);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

router.get(
  "/branches/:id",
  requireAuth,
  requirePermission("branch", "view"),
  async (req, res) => {
    try {
      const id = toInt(req.params.id);

      if (!id) {
        return res.status(400).json({ message: "Invalid branch id" });
      }

      let r;

      if (isTopManagement(req) || isDepartmentManagement(req)) {
        r = await pool.query(
          `
          SELECT id, code, name, area, region, division, address, latitude, longitude
          FROM public.branches
          WHERE id = $1
          `,
          [id]
        );
      } else if (isBranchManager(req)) {
        const branchCode = getUserBranchCode(req);
        if (!branchCode) return res.status(403).json({ message: "Access denied" });

        r = await pool.query(
          `
          SELECT id, code, name, area, region, division, address, latitude, longitude
          FROM public.branches
          WHERE id = $1
            AND LOWER(TRIM(code)) = LOWER(TRIM($2))
          `,
          [id, branchCode]
        );
      } else if (isAreaManager(req)) {
        const area = getUserArea(req);
        if (!area) return res.status(403).json({ message: "Access denied" });

        r = await pool.query(
          `
          SELECT id, code, name, area, region, division, address, latitude, longitude
          FROM public.branches
          WHERE id = $1
            AND LOWER(TRIM(COALESCE(area, ''))) = LOWER(TRIM($2))
          `,
          [id, area]
        );
      } else if (isRegionalManager(req)) {
        const region = getUserRegion(req);
        if (!region) return res.status(403).json({ message: "Access denied" });

        r = await pool.query(
          `
          SELECT id, code, name, area, region, division, address, latitude, longitude
          FROM public.branches
          WHERE id = $1
            AND LOWER(TRIM(COALESCE(region, ''))) = LOWER(TRIM($2))
          `,
          [id, region]
        );
      } else if (isAssistantVicePresident(req)) {
        const division = getUserDivision(req);
        if (!division) return res.status(403).json({ message: "Access denied" });

        r = await pool.query(
          `
          SELECT id, code, name, area, region, division, address, latitude, longitude
          FROM public.branches
          WHERE id = $1
            AND LOWER(TRIM(COALESCE(division, ''))) = LOWER(TRIM($2))
          `,
          [id, division]
        );
      } else {
        return res.status(403).json({ message: "Access denied" });
      }

      if (r.rowCount === 0) {
        return res.status(404).json({ message: "Branch not found" });
      }

      return res.json(r.rows[0]);
    } catch (e) {
      console.error("GET /api/branches/:id ERROR:", e.message);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

router.post(
  "/branches",
  requireAuth,
  requirePermission("branch", "create"),
  async (req, res) => {
    try {
      const code = toStr(req.body?.code);
      const name = toStr(req.body?.name);
      const area = toStr(req.body?.area);
      const region = toStr(req.body?.region);
      const division = toStr(req.body?.division);
      const address = toStr(req.body?.address) || null;
      const latitude = toNumOrNull(req.body?.latitude);
      const longitude = toNumOrNull(req.body?.longitude);

      if (!code) return res.status(400).json({ message: "Branch code is required" });
      if (!name) return res.status(400).json({ message: "Branch name is required" });
      if (!area) return res.status(400).json({ message: "Area is required" });
      if (!region) return res.status(400).json({ message: "Region is required" });
      if (!division) return res.status(400).json({ message: "Division is required" });

      const dup = await pool.query(
        `
        SELECT id
        FROM public.branches
        WHERE LOWER(TRIM(code)) = LOWER(TRIM($1))
           OR LOWER(TRIM(name)) = LOWER(TRIM($2))
        LIMIT 1
        `,
        [code, name]
      );

      if (dup.rowCount > 0) {
        return res.status(409).json({
          message: "Branch code or name already exists",
        });
      }

      const ins = await pool.query(
        `
        INSERT INTO public.branches
          (code, name, area, region, division, address, latitude, longitude)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, code, name, area, region, division, address, latitude, longitude
        `,
        [code, name, area, region, division, address, latitude, longitude]
      );

      return res.json(ins.rows[0]);
    } catch (e) {
      console.error("POST /api/branches ERROR:", e.message);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

router.put(
  "/branches/:id",
  requireAuth,
  requirePermission("branch", "edit"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const id = toInt(req.params.id);

      if (!id) {
        return res.status(400).json({ message: "Invalid branch id" });
      }

      const code = toStr(req.body?.code);
      const name = toStr(req.body?.name);
      const area = toStr(req.body?.area);
      const region = toStr(req.body?.region);
      const division = toStr(req.body?.division);
      const address = toStr(req.body?.address) || null;
      const latitude = toNumOrNull(req.body?.latitude);
      const longitude = toNumOrNull(req.body?.longitude);

      if (!code) {
        return res.status(400).json({ message: "Branch code is required" });
      }

      if (!name) {
        return res.status(400).json({ message: "Branch name is required" });
      }

      if (!area) {
        return res.status(400).json({ message: "Area is required" });
      }

      if (!region) {
        return res.status(400).json({ message: "Region is required" });
      }

      if (!division) {
        return res.status(400).json({ message: "Division is required" });
      }

      await client.query("BEGIN");

      // -----------------------------------------------------
      // CHECK DUPLICATE BRANCH CODE / NAME
      // -----------------------------------------------------
      const dup = await client.query(
        `
          SELECT id
          FROM public.branches
          WHERE (
            LOWER(TRIM(code)) = LOWER(TRIM($1))
            OR LOWER(TRIM(name)) = LOWER(TRIM($2))
          )
            AND id <> $3
          LIMIT 1
        `,
        [code, name, id]
      );

      if (dup.rowCount > 0) {
        await client.query("ROLLBACK");

        return res.status(409).json({
          message: "Branch code or name already exists",
        });
      }

      // -----------------------------------------------------
      // UPDATE BRANCH
      // -----------------------------------------------------
      const upd = await client.query(
        `
          UPDATE public.branches
          SET
            code = $1,
            name = $2,
            area = $3,
            region = $4,
            division = $5,
            address = $6,
            latitude = $7,
            longitude = $8
          WHERE id = $9
          RETURNING
            id,
            code,
            name,
            area,
            region,
            division,
            address,
            latitude,
            longitude
        `,
        [
          code,
          name,
          area,
          region,
          division,
          address,
          latitude,
          longitude,
          id,
        ]
      );

      if (upd.rowCount === 0) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          message: "Branch not found",
        });
      }

      // -----------------------------------------------------
      // SYNC ALL STAFF ASSIGNED TO THIS BRANCH
      // -----------------------------------------------------
      const staffSync = await client.query(
        `
          UPDATE public.staff
          SET
            area = $1,
            region = $2,
            division = $3
          WHERE branch_id = $4
        `,
        [area, region, division, id]
      );

      await client.query("COMMIT");

      return res.json({
        ...upd.rows[0],
        staff_updated: staffSync.rowCount,
      });
    } catch (e) {
      try {
        await client.query("ROLLBACK");
      } catch (_) {}

      console.error("PUT /api/branches/:id ERROR:", e);

      return res.status(500).json({
        message: "Server error",
      });
    } finally {
      client.release();
    }
  }
);

router.delete(
  "/branches/:id",
  requireAuth,
  requirePermission("branch", "delete"),
  async (req, res) => {
    try {
      const id = toInt(req.params.id);

      if (!id) return res.status(400).json({ message: "Invalid branch id" });

      const used = await pool.query(
        `
        SELECT id
        FROM public.staff
        WHERE branch_id = $1
        LIMIT 1
        `,
        [id]
      );

      if (used.rowCount > 0) {
        return res.status(400).json({
          message: "Cannot delete branch because it is already assigned to staff",
        });
      }

      const del = await pool.query(
        `
        DELETE FROM public.branches
        WHERE id = $1
        RETURNING id
        `,
        [id]
      );

      if (del.rowCount === 0) {
        return res.status(404).json({ message: "Branch not found" });
      }

      return res.json({
        message: "Branch deleted",
        id: del.rows[0].id,
      });
    } catch (e) {
      console.error("DELETE /api/branches/:id ERROR:", e.message);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

module.exports = router;