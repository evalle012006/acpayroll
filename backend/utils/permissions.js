const { hasAnyRole } = require("./roleAccess");

const PERMISSIONS = {
  transfer_staff_order: {
    view: [
      "admin",
      "hr",
      "accounting",
      "branch manager",
      "area manager",
      "regional manager",
      "assistant vice president",
      "vice president",
      "senior vice president",
      "president",
      "tread",
    ],
    create: [
      "admin",
      "hr",
      "accounting",
      "area manager",
      "regional manager",
      "assistant vice president",
      "vice president",
      "senior vice president",
      "president",
    ],
    approve: ["admin", "hr", "accounting"],
    reject: ["admin", "hr", "accounting"],
    delete: ["admin"],
  },

  exit_staff_order: {
    view: [
      "admin",
      "hr",
      "accounting",
      "vice president",
      "senior vice president",
      "president",
      "tread",
    ],
    create: [
      "admin",
      "hr",
      "accounting",
      "branch manager",
      "assistant vice president",
      "vice president",
      "senior vice president",
      "president",
    ],
    approve: [
      "admin",
      "hr",
      "accounting",
      "vice president",
      "senior vice president",
      "president",
    ],
    reject: [
      "admin",
      "hr",
      "accounting",
      "vice president",
      "senior vice president",
      "president",
    ],
    delete: ["admin", "hr", "accounting"],
  },

  staff_information: {
    view: [
      "admin",
      "hr",
      "accounting",
      "branch manager",
      "area manager",
      "regional manager",
      "assistant vice president",
      "vice president",
      "senior vice president",
      "president",
      "tread",
    ],
    edit: ["admin", "hr", "accounting"],
    view_private: ["admin", "hr", "accounting"],
  },
};

const can = (req, moduleName, action) => {
  const allowedRoles = PERMISSIONS?.[moduleName]?.[action] || [];
  return hasAnyRole(req, allowedRoles);
};

const requirePermission = (moduleName, action) => {
  return (req, res, next) => {
    if (!can(req, moduleName, action)) {
      return res.status(403).json({
        message: `Access denied: ${moduleName}.${action}`,
      });
    }

    next();
  };
};

module.exports = {
  PERMISSIONS,
  can,
  requirePermission,
};