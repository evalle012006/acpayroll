const { hasAnyRole } = require("./roleAccess");

const ADMIN_ROLES = ["admin", "it"];

const FINANCE_HR_ROLES = [
  "admin",
  "it",
  "hr",
  "tread",
  "accounting",
];

const MANAGEMENT_ROLES = [
  "branch manager",
  "area manager",
  "regional manager",
  "assistant vice president",
  "vice president",
  "senior vice president",
  "president",
];

const FULL_MANAGEMENT_ROLES = [
  "assistant vice president",
  "vice president",
  "senior vice president",
  "president",
];

const ALL_OPERATION_ROLES = [
  "admin",
  "it",
  "hr",
  "tread",
  "accounting",
  ...MANAGEMENT_ROLES,
];

const PERMISSIONS = {
  /* =========================================================
     DASHBOARD
  ========================================================= */

  dashboard: {
    view: ALL_OPERATION_ROLES,
  },

  /* =========================================================
     STAFF INFORMATION
  ========================================================= */

  staff_information: {
    view: ALL_OPERATION_ROLES,

    create: [
      "admin",
      "it",
      "hr",
      "tread",
      "accounting",
    ],

    edit: [
      "admin",
      "it",
      "hr",
      "tread",
      "accounting",
    ],

    delete: [
      "admin",
      "it",
    ],

    view_private: [
      "admin",
      "it",
      "hr",
      "tread",
      "accounting",
    ],

    upload_photo: [
      "admin",
      "it",
      "hr",
      "tread",
      "accounting",
    ],
  },

  /* =========================================================
     TRANSFER STAFF ORDER
  ========================================================= */

  transfer_staff_order: {
    view: ALL_OPERATION_ROLES,

    create: [
      "admin",
      "it",
      "hr",
      "tread",
      "accounting",
    ],

    approve: FINANCE_HR_ROLES,

    reject: FINANCE_HR_ROLES,

    delete: ADMIN_ROLES,
  },

  /* =========================================================
     EXIT STAFF ORDER
  ========================================================= */

  exit_staff_order: {
    view: [
      "admin",
      "it",
      "hr",
      "accounting",
      "vice president",
      "senior vice president",
      "president",
      "tread",
    ],

    create: [
      "admin",
      "it",
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
      "it",
      "hr",
      "accounting",
      "vice president",
      "senior vice president",
      "president",
    ],

    reject: [
      "admin",
      "it",
      "hr",
      "accounting",
      "vice president",
      "senior vice president",
      "president",
    ],

    delete: FINANCE_HR_ROLES,
  },

  /* =========================================================
     LOAN REQUEST
  ========================================================= */

  loan_request: {
    view: ALL_OPERATION_ROLES,

    create: [
      "admin",
      "it",
      "hr",
      "accounting",
      "branch manager",
      "area manager",
      "regional manager",
      "assistant vice president",
      "vice president",
      "senior vice president",
      "president",
    ],

    approve: [
      "admin",
      "it",
      "hr",
      "accounting",
      "area manager",
      "regional manager",
      "assistant vice president",
      "vice president",
      "senior vice president",
      "president",
    ],

    reject: [
      "admin",
      "it",
      "hr",
      "accounting",
      "area manager",
      "regional manager",
      "assistant vice president",
      "vice president",
      "senior vice president",
      "president",
    ],

     upload_approved: [
      "admin",
      "it",
      "hr",
      "accounting",
      "tread",
      "vice president",
      "senior vice president",
      "president",
    ],

    delete: ADMIN_ROLES,
  },

  /* =========================================================
     STAFF BALANCE
  ========================================================= */

  staff_balance: {
    view: ALL_OPERATION_ROLES,

    edit: [
      "admin",
      "it",
      "hr",
      "accounting",
    ],
  },

  /* =========================================================
     COMPENSATION RATE
  ========================================================= */

  comp_rate: {
    view: ALL_OPERATION_ROLES,
    create: FINANCE_HR_ROLES,
    edit: FINANCE_HR_ROLES,
    delete: ADMIN_ROLES,
  },

  /* =========================================================
     DEPARTMENT
  ========================================================= */

  department: {
    create: ADMIN_ROLES,

    edit: ADMIN_ROLES,

    delete: ADMIN_ROLES,
  },

  /* =========================================================
     BRANCH
  ========================================================= */

  branch: {
    view: ALL_OPERATION_ROLES,

    create: ADMIN_ROLES,

    edit: FINANCE_HR_ROLES,

    delete: FINANCE_HR_ROLES,
  },

  /* =========================================================
     DEMOTION ORDER
  ========================================================= */

  demotion_order: {
    view: ALL_OPERATION_ROLES,

    create: [
      "admin",
      "it",
      "tread",
      "branch manager",
      "area manager",
      "regional manager",
      "assistant vice president",
      "vice president",
      "senior vice president",
      "president",
    ],

    approve: [
      "admin",
      "it",
      "tread",
      "vice president",
      "senior vice president",
      "president",
    ],

    reject: [
      "admin",
      "it",
      "tread",
      "vice president",
      "senior vice president",
      "president",
    ],
  },

  leave_request: {
    view: ALL_OPERATION_ROLES,

    create: [
      "admin",
      "it",
      "hr",
      "accounting",
      "tread",
      "branch manager",
      "area manager",
      "regional manager",
      "assistant vice president",
      "vice president",
      "senior vice president",
      "president",
    ],

    approve: [
      "admin",
      "it",
      "hr",
      "accounting",
      "tread",
      "area manager",
      "regional manager",
      "assistant vice president",
      "vice president",
      "senior vice president",
      "president",
    ],

    reject: [
      "admin",
      "it",
      "hr",
      "accounting",
      "tread",
      "area manager",
      "regional manager",
      "assistant vice president",
      "vice president",
      "senior vice president",
      "president",
    ],

    upload_approved: [
      "admin",
      "it",
      "hr",
      "accounting",
      "tread",
      "vice president",
      "senior vice president",
      "president",
    ],
  },

  /* =========================================================
     STAFF LOAN OPENING BALANCE
  ========================================================= */

  staff_loan_opening_balance: {
    view: ALL_OPERATION_ROLES,

    create: [
      "admin",
      "it",
      "hr",
      "accounting",
      "tread",
      "area manager",
    ],

    edit: [
      "admin",
      "it",
      "hr",
      "accounting",
      "tread",
      "area manager",
    ],

    delete: [
      "admin",
      "it",
      "hr",
      "accounting",
      "tread",
    ],
  },

  statement_of_account: {
    view: [
      "admin",
      "it",
      "hr",
      "accounting",
      "tread",
      "branch manager",
      "area manager",
      "regional manager",
      "assistant vice president",
      "vice president",
      "senior vice president",
      "president",
    ],
    create: FINANCE_HR_ROLES,
    edit: FINANCE_HR_ROLES,
    approve: FINANCE_HR_ROLES,
    reject: FINANCE_HR_ROLES,
    delete: ADMIN_ROLES,
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
  ADMIN_ROLES,
  FINANCE_HR_ROLES,
  MANAGEMENT_ROLES,
  FULL_MANAGEMENT_ROLES,
  ALL_OPERATION_ROLES,

  PERMISSIONS,

  can,
  requirePermission,
};