const express = require("express");
const router = express.Router();
const pool = require("../db");
const { requireAuth } = require("../middlewares/authMiddleware");
const { requirePermission } = require("../middlewares/permissionMiddleware");

const norm = (v) => String(v ?? "").trim().toLowerCase();
const toStr = (v) => String(v ?? "").trim();

router.get("/role-permissions",
  requireAuth,
  requirePermission("permissions", "view"),
  async (_req, res) => {
    try {
      const r = await pool.query(`
        SELECT
          id,
          role,
          department,
          module_name,
          action_name,
          allowed
        FROM public.role_permissions
        ORDER BY role, department, module_name, action_name
      `);

      return res.json(r.rows);
    } catch (e) {
      console.error("GET /role-permissions ERROR:", e);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

router.put(
  "/role-permissions",
  requireAuth,
  requirePermission("permissions", "edit"),
  async (req, res) => {
    try {
      const role = norm(req.body?.role);
      const departmentRaw = toStr(req.body?.department);
      const department = departmentRaw || null;
      const moduleName = norm(req.body?.module_name);
      const actionName = norm(req.body?.action_name);
      const allowed = Boolean(req.body?.allowed);

      if (!role || !moduleName || !actionName) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const r = await pool.query(
        `
        INSERT INTO public.role_permissions
          (
            role,
            department,
            module_name,
            action_name,
            allowed,
            updated_at
          )
        VALUES
          ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT
          (role, COALESCE(department, ''), module_name, action_name)
        DO UPDATE SET
          allowed = EXCLUDED.allowed,
          department = EXCLUDED.department,
          updated_at = NOW()
        RETURNING *
        `,
        [role, department, moduleName, actionName, allowed]
      );

      return res.json(r.rows[0]);
    } catch (e) { 
      console.error("PUT /role-permissions ERROR:", e);
      return res.status(500).json({
        message: e?.message || "Server error",
      });
    }
  }
);

module.exports = router;