const pool = require("../db");

const normalize = (v) =>
  String(v || "")
    .trim()
    .toLowerCase();

const SUPER_USERS = [
  "admin",
  "it",
];

/*
  CHECK PERMISSION
  RETURNS TRUE/FALSE
*/
const hasPermission = async (
  user,
  moduleName,
  actionName
) => {
  try {
    const role = normalize(user?.role);

    const department = String(
      user?.department || ""
    ).trim();

    if (!role) {
      return false;
    }

    /*
      ADMIN + IT
      FULL ACCESS
    */

    if (SUPER_USERS.includes(role)) {
      return true;
    }

    /*
      1. CHECK ROLE + DEPARTMENT
    */

    const departmentResult = await pool.query(
      `
      SELECT allowed
      FROM public.role_permissions
      WHERE LOWER(role) = LOWER($1)
        AND LOWER(COALESCE(department, '')) = LOWER($2)
        AND module_name = $3
        AND action_name = $4
      LIMIT 1
      `,
      [
        role,
        department,
        moduleName,
        actionName,
      ]
    );

    if (departmentResult.rowCount > 0) {
      return Boolean(
        departmentResult.rows[0].allowed
      );
    }

    /*
      2. FALLBACK ROLE ONLY
    */

    const roleResult = await pool.query(
      `
      SELECT allowed
      FROM public.role_permissions
      WHERE LOWER(role) = LOWER($1)
        AND (
          department IS NULL
          OR TRIM(department) = ''
        )
        AND module_name = $2
        AND action_name = $3
      LIMIT 1
      `,
      [
        role,
        moduleName,
        actionName,
      ]
    );

    if (roleResult.rowCount === 0) {
      return false;
    }

    return Boolean(
      roleResult.rows[0].allowed
    );
  } catch (err) {
    console.error(
      "HAS PERMISSION ERROR:",
      err.message
    );

    return false;
  }
};

/*
  EXPRESS MIDDLEWARE
*/
const requirePermission = (
  moduleName,
  actionName
) => {
  return async (req, res, next) => {
    try {
      const allowed = await hasPermission(
        req.user,
        moduleName,
        actionName
      );

      if (!allowed) {
        return res.status(403).json({
          message: `No permission for ${moduleName}:${actionName}`,
        });
      }

      return next();
    } catch (err) {
      console.error(
        "PERMISSION ERROR:",
        err.message
      );

      return res.status(500).json({
        message: "Permission check failed",
      });
    }
  };
};

module.exports = {
  requirePermission,
  hasPermission,
};