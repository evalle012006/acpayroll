const express = require("express");
const router = express.Router();
const pool = require("../db");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

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

const toDateOrNull = (v) => {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const d = s.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
};

const toStr = (v) => String(v ?? "").trim();
const norm = (v) => toStr(v).toLowerCase();

// =====================================================
// DEMOTION ORDER APPROVAL HISTORY
// =====================================================

const saveDemotionApprovalHistory = async (
  client,
  req,
  {
    demotionOrderId,
    action,
    approvalStage = null,
    remarks = null,
  }
) => {
  const orderId = toInt(demotionOrderId);

  if (!orderId) {
    throw new Error("Invalid demotion order ID for approval history");
  }

  const user = req.user || {};

  const performedBy = toInt(user.id);

  const performedByName =
    toStr(user.fullname) ||
    toStr(user.full_name) ||
    toStr(user.name) ||
    [
      toStr(user.first_name),
      toStr(user.last_name),
    ]
      .filter(Boolean)
      .join(" ") ||
    toStr(user.username) ||
    "Unknown User";

  await client.query(
    `
    INSERT INTO public.demotion_order_approval_history
    (
      demotion_order_id,
      action,
      approval_stage,
      performed_by,
      performed_by_name,
      performed_by_role,
      performed_by_department,
      remarks,
      created_at
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
      NOW()
    )
    `,
    [
      orderId,
      toStr(action),
      approvalStage
        ? toStr(approvalStage)
        : null,
      performedBy,
      performedByName,
      toStr(user.role) || null,
      toStr(user.department) || null,
      remarks
        ? toStr(remarks)
        : null,
    ]
  );
};

const uploadDir = path.join(__dirname, "../uploads/demotions");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname || ""));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
});

const isTopManagement = (req) => {
  const dept = norm(req.user?.department);

  const isHRDepartment =
    dept === "hr department" ||
    dept === "human resources" ||
    dept === "human resources department";

  return (
    isAdmin(req) ||
    isIT(req) ||
    isHr(req) ||
    isHRDepartment ||
    isAccounting(req) ||
    isTread(req) ||
    isVicePresident(req) ||
    isSeniorVicePresident(req) ||
    isPresident(req) ||

    (
      dept === "it department" &&
      (
        isBranchManager(req) ||
        isAreaManager(req) ||
        isRegionalManager(req) ||
        isAssistantVicePresident(req) ||
        isVicePresident(req) ||
        isSeniorVicePresident(req)
      )
    )
  );
};

const isFinalUploader = (req) => {
  const dept = norm(req.user?.department);

  const isHRDepartment =
    dept === "hr" ||
    dept === "hr department" ||
    dept === "human resources" ||
    dept === "human resources department";

  const isITDepartment =
    dept === "it" ||
    dept === "it department";

  const isAccountingDepartment =
    dept === "accounting" ||
    dept === "accounting department";

  return (
    isAdmin(req) ||
    isHRDepartment ||
    isITDepartment ||
    isAccountingDepartment
  );
};

const isHRWorkflowUser = (req) => {
  const dept = norm(req.user?.department);

  return (
    isAdmin(req) ||
    isHr(req) ||
    isAccounting(req) ||
    dept === "hr" ||
    dept === "hr department" ||
    dept === "human resources" ||
    dept === "human resources department" ||
    dept === "accounting" ||
    dept === "accounting department"
  );
};

const canCreateDemotion = (req) => {
  const dept = norm(req.user?.department);

  const isHRDepartment =
    dept === "hr" ||
    dept === "hr department" ||
    dept === "human resources" ||
    dept === "human resources department";

  const isITDepartment =
    dept === "it" ||
    dept === "it department";

  const isAccountingDepartment =
    dept === "accounting" ||
    dept === "accounting department";

  return (
    isAdmin(req) ||
    isHRDepartment ||
    isITDepartment ||
    isAccountingDepartment
  );
};

const canEditDemotion = (req) => {
  const dept = norm(req.user?.department);

  const isHRDepartment =
    dept === "hr" ||
    dept === "hr department" ||
    dept === "human resources" ||
    dept === "human resources department";

  const isITDepartment =
    dept === "it" ||
    dept === "it department";

  const isAccountingDepartment =
    dept === "accounting" ||
    dept === "accounting department";

  return (
    isAdmin(req) ||
    isHRDepartment ||
    isITDepartment ||
    isAccountingDepartment
  );
};

const canVoidOrDeleteDemotion = (req) => {
  const dept = norm(req.user?.department);

  const isHRDepartment =
    dept === "hr" ||
    dept === "hr department" ||
    dept === "human resources" ||
    dept === "human resources department";

  const isITDepartment =
    dept === "it" ||
    dept === "it department";

  const isAccountingDepartment =
    dept === "accounting" ||
    dept === "accounting department";

  return (
    isAdmin(req) ||
    isHRDepartment ||
    isITDepartment ||
    isAccountingDepartment
  );
};

const canBypassDemotion = (req) => {
  const dept = norm(req.user?.department);

  const isHRDepartment =
    dept === "hr" ||
    dept === "hr department" ||
    dept === "human resources" ||
    dept === "human resources department";

  const isITDepartment =
    dept === "it" ||
    dept === "it department";

  const isAccountingDepartment =
    dept === "accounting" ||
    dept === "accounting department";

  return (
    isAdmin(req) ||
    isIT(req) ||
    isHr(req) ||
    isAccounting(req) ||
    isSeniorVicePresident(req) ||
    isHRDepartment ||
    isITDepartment ||
    isAccountingDepartment
  );
};

const getUserArea = (req) => toStr(req.user?.area);
const getUserRegion = (req) => toStr(req.user?.region);
const getUserDivision = (req) => toStr(req.user?.division);

const getUserRole = (req) => norm(req.user?.role);

const BACK_OFFICE_DEPARTMENTS = [
  "it",
  "it department",
  "hr",
  "hr department",
  "human resources",
  "human resources department",
  "accounting",
  "accounting department",
  "audit",
  "audit department",
  "production & logistic",
  "production & logistic department",
  "production and logistic",
  "production and logistic department",
  "office of the president",
  "tread",
  "tread department",
  "treadt department",
];

const OPERATION_DEPARTMENTS = [
  "operation",
  "operations",
  "operation department",
  "operations department",
];

const isBackOfficeDepartment = (department) =>
  BACK_OFFICE_DEPARTMENTS.includes(norm(department));

const isOperationDepartment = (department) =>
  OPERATION_DEPARTMENTS.includes(norm(department));

const getInitialStage = (department, oldPosition) => {
  const pos = norm(oldPosition);

  if (isOperationDepartment(department)) {
    if (pos.includes("area manager")) {
      return "regional manager";
    }

    if (pos.includes("regional manager")) {
      return "assistant vice president";
    }

    if (pos.includes("assistant vice president")) {
      return "vice president";
    }

    if (pos.includes("vice president")) {
      return "admin";
    }

    return "area manager";
  }

  return "admin";
};

const getRawApprovalChain = (
  department,
  oldPosition = ""
) => {
  if (isOperationDepartment(department)) {
    const full = [
      "area manager",
      "regional manager",
      "assistant vice president",
      "vice president",
      "admin",
    ];

    const start = getInitialStage(
      department,
      oldPosition
    );

    const index = full.indexOf(start);

    return index >= 0
      ? full.slice(index)
      : full;
  }

  return ["admin"];
};

async function hasActiveApprover(
  client,
  stage,
  staff
) {
  const normalizedStage = norm(stage);

  // Admin means the final HR/Accounting/IT/Admin group.
  // This stage is not assigned to one specific account.
  if (normalizedStage === "admin") {
    return true;
  }

  const values = [normalizedStage];

  const conditions = [
    `LOWER(TRIM(COALESCE(u.role, ''))) = $1`,
    `LOWER(TRIM(COALESCE(u.status, 'Active'))) = 'active'`,
  ];

  if (normalizedStage === "area manager") {
    values.push(toStr(staff?.area));

    conditions.push(
      `LOWER(TRIM(COALESCE(u.area, ''))) =
       LOWER(TRIM($${values.length}))`
    );
  }

  if (normalizedStage === "regional manager") {
    values.push(toStr(staff?.region));

    conditions.push(
      `LOWER(TRIM(COALESCE(u.region, ''))) =
       LOWER(TRIM($${values.length}))`
    );
  }

  if (
    normalizedStage ===
      "assistant vice president" &&
    staff?.division
  ) {
    values.push(toStr(staff.division));

    conditions.push(
      `LOWER(TRIM(COALESCE(u.division, ''))) =
       LOWER(TRIM($${values.length}))`
    );
  }

  if (
    [
      "assistant vice president",
      "vice president",
    ].includes(normalizedStage)
  ) {
    values.push(toStr(staff?.department));

    conditions.push(
      `LOWER(TRIM(COALESCE(u.department, ''))) =
       LOWER(TRIM($${values.length}))`
    );
  }

  const result = await client.query(
    `
    SELECT u.id
    FROM public.users u
    WHERE ${conditions.join("\n      AND ")}
    LIMIT 1
    `,
    values
  );

  return result.rowCount > 0;
}

async function getActiveApprovalChain(
  client,
  staff
) {
  const rawChain = getRawApprovalChain(
    staff.department,
    staff.position
  );

  const activeChain = [];

  for (const stage of rawChain) {
    if (stage === "admin") {
      activeChain.push(stage);
      continue;
    }

    const exists = await hasActiveApprover(
      client,
      stage,
      staff
    );

    if (exists) {
      activeChain.push(stage);
    }
  }

  return activeChain.length
    ? activeChain
    : ["admin"];
}

async function resolveCurrentActiveStage(
  client,
  staff,
  savedStage
) {
  const currentStage = norm(savedStage);

  const activeChain =
    await getActiveApprovalChain(
      client,
      staff
    );

  if (!currentStage) {
    return activeChain[0] || "admin";
  }

  if (currentStage === "admin") {
    return "admin";
  }

  const currentStillActive =
    await hasActiveApprover(
      client,
      currentStage,
      staff
    );

  if (currentStillActive) {
    return currentStage;
  }

  const rawChain = getRawApprovalChain(
    staff.department,
    staff.position
  );

  const currentIndex = rawChain.findIndex(
    (stage) =>
      norm(stage) === currentStage
  );

  const nextActiveStage = activeChain.find(
    (stage) => {
      const stageIndex = rawChain.findIndex(
        (rawStage) =>
          norm(rawStage) === norm(stage)
      );

      return stageIndex > currentIndex;
    }
  );

  if (nextActiveStage) {
    return nextActiveStage;
  }

  return "admin";
}

const statusColumnMap = {
  "area manager": "area_manager_status",
  "regional manager": "regional_manager_status",
  "assistant vice president": "assistant_vice_president_status",
  "vice president": "vice_president_status",
  admin: "admin_status",
};

async function getUserBranchIdResolved(req) {
  const raw = String(req.user?.branch_id || "").trim();
  if (!raw) return null;

  const n = Number(raw);
  if (Number.isFinite(n)) return n;

  const r = await pool.query(
    `
    SELECT id
    FROM public.branches
    WHERE LOWER(TRIM(code)) = LOWER(TRIM($1))
    LIMIT 1
    `,
    [raw]
  );

  return r.rows[0]?.id ? Number(r.rows[0].id) : null;
}

async function generateOrderNo(client, prefix) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  await client.query(
    `
    INSERT INTO public.order_sequences(prefix, year, month, next_value)
    VALUES ($1,$2,$3,1)
    ON CONFLICT (prefix, year, month)
    DO NOTHING
    `,
    [prefix, year, month]
  );

  const seq = await client.query(
    `
    SELECT next_value
    FROM public.order_sequences
    WHERE prefix=$1
      AND year=$2
      AND month=$3
    FOR UPDATE
    `,
    [prefix, year, month]
  );

  const nextVal = Number(seq.rows[0].next_value);

  await client.query(
    `
    UPDATE public.order_sequences
    SET next_value = next_value + 1
    WHERE prefix=$1
      AND year=$2
      AND month=$3
    `,
    [prefix, year, month]
  );

  return `${prefix}-${year}-${String(month).padStart(2, "0")}-${String(
    nextVal
  ).padStart(4, "0")}`;
}

function userCanActStage(req, stage, staff) {
  const dept = norm(req.user?.department);
  const currentStage = norm(stage);

  if (!isOperationDepartment(dept)) {
    return false;
  }

  if (!isOperationDepartment(staff?.department)) {
    return false;
  }

  if (currentStage === "area manager") {
    return (
      isAreaManager(req) &&
      norm(getUserArea(req)) === norm(staff?.area)
    );
  }

  if (currentStage === "regional manager") {
    return (
      isRegionalManager(req) &&
      norm(getUserRegion(req)) === norm(staff?.region)
    );
  }

  if (currentStage === "assistant vice president") {
    return (
      isAssistantVicePresident(req) &&
      norm(getUserDivision(req)) === norm(staff?.division)
    );
  }

  if (currentStage === "vice president") {
    return isVicePresident(req);
  }

  return false;
}

async function getStaffScope(client, staffId) {
  const r = await client.query(
    `
    SELECT
      id,
      employee_no,
      fullname,
      first_name,
      last_name,
      middle_name,
      "position",
      branch_id,
      area,
      region,
      division,
      department
    FROM public.staff
    WHERE id = $1
    LIMIT 1
    `,
    [staffId]
  );

  return r.rows[0] || null;
}

async function canAccessStaff(client, req, staffRow) {
  if (!staffRow) return false;

  const dept = norm(req.user?.department);

  if (
    isAdmin(req) ||
    isIT(req) ||

    isHr(req) ||
      dept === "hr department" ||
      dept === "human resources" ||
      dept === "human resources department" ||
    
    isAccounting(req) ||
    dept === "accounting" ||
    dept === "accounting department" ||
    isTread(req) ||
    isVicePresident(req) ||
    isSeniorVicePresident(req) ||
    isPresident(req) ||
    (
      dept === "it department" &&
      (
        isBranchManager(req) ||
        isAreaManager(req) ||
        isRegionalManager(req) ||
        isAssistantVicePresident(req) ||
        isVicePresident(req) ||
        isSeniorVicePresident(req)
      )
    )
  ) {
    return true;
  }

  if (isBranchManager(req)) {
    const bid = await getUserBranchIdResolved(req);
    return bid && Number(staffRow.branch_id) === Number(bid);
  }

  if (isAreaManager(req)) {
    return norm(staffRow.area) === norm(getUserArea(req));
  }

  if (isRegionalManager(req)) {
    return norm(staffRow.region) === norm(getUserRegion(req));
  }

  if (isAssistantVicePresident(req)) {
    return norm(staffRow.division) === norm(getUserDivision(req));
  }

  return false;
}

function buildEmployeeName(row) {
  const ln = toStr(row?.last_name);
  const fn = toStr(row?.first_name);
  const mn = toStr(row?.middle_name);

  const built = `${ln}${ln && fn ? ", " : ""}${fn}${mn ? ` ${mn}` : ""}`
    .replace(/\s+/g, " ")
    .trim();

  return built || toStr(row?.fullname);
}

const demotionSelect = `
  dmo.*,
  s.employee_no,
  s.department,
  s.area,
  s.region,
  s.division,
  s.branch_id AS staff_branch_id,
  b.code AS staff_branch_code,
  b.name AS staff_branch_name
`;

// =====================================================
// GET DEMOTION ORDER APPROVAL HISTORY
// =====================================================

router.get(
  "/demotion-orders/:id/approval-history",
  requireAuth,
  requirePermission("demotion_order", "view"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const id = toInt(req.params.id);

      if (!id) {
        return res.status(400).json({
          message: "Invalid demotion order ID",
        });
      }

      // Find the demotion order.
      const orderResult = await client.query(
        `
        SELECT
          id,
          employee_id
        FROM public.demotion_orders
        WHERE id = $1
        LIMIT 1
        `,
        [id]
      );

      if (orderResult.rowCount === 0) {
        return res.status(404).json({
          message: "Demotion order not found",
        });
      }

      const order = orderResult.rows[0];

      // Apply the existing staff visibility rules.
      const staffRow = await getStaffScope(
        client,
        order.employee_id
      );

      if (!staffRow) {
        return res.status(404).json({
          message: "Employee not found",
        });
      }

      const allowed = await canAccessStaff(
        client,
        req,
        staffRow
      );

      if (!allowed) {
        return res.status(403).json({
          message:
            "You are not allowed to view this demotion order",
        });
      }

      const historyResult = await client.query(
        `
        SELECT
          id,
          demotion_order_id,
          action,
          approval_stage,
          performed_by,
          performed_by_name,
          performed_by_role,
          performed_by_department,
          remarks,
          created_at
        FROM public.demotion_order_approval_history
        WHERE demotion_order_id = $1
        ORDER BY created_at ASC, id ASC
        `,
        [id]
      );

      return res.json(historyResult.rows);
    } catch (error) {
      console.error(
        "GET Demotion Approval History ERROR:",
        error
      );

      return res.status(500).json({
        message:
          error.message ||
          "Failed to load approval history",
      });
    } finally {
      client.release();
    }
  }
);

/*
|--------------------------------------------------------------------------
| GET STAFF DEMOTION ORDERS
|--------------------------------------------------------------------------
*/

router.get(
  "/demotion-orders/staff/:id",
  requireAuth,
  requirePermission("demotion_order", "view"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const employeeId = toInt(req.params.id);
      if (!employeeId) {
        return res.status(400).json({ message: "Invalid staff id" });
      }

      const staffRow = await getStaffScope(client, employeeId);

      if (!staffRow) {
        return res.status(404).json({ message: "Staff not found" });
      }

      const allowed = await canAccessStaff(client, req, staffRow);

      if (!allowed) {
        return res.status(403).json({ message: "Access denied" });
      }

      const r = await client.query(
        `
        SELECT ${demotionSelect}
        FROM public.demotion_orders dmo
        JOIN public.staff s ON s.id = dmo.employee_id
        LEFT JOIN public.branches b ON b.id = s.branch_id
        WHERE dmo.employee_id = $1
        ORDER BY dmo.created_at DESC
        `,
        [employeeId]
      );

      return res.json(r.rows);
    } catch (e) {
      console.error("GET /api/demotion-orders/staff/:id ERROR:", e);
      return res.status(500).json({ message: e?.message || "Server error" });
    } finally {
      client.release();
    }
  }
);

/*
|--------------------------------------------------------------------------
| GET ALL DEMOTION ORDERS
|--------------------------------------------------------------------------
*/

router.get(
  "/demotion-orders",
  requireAuth,
  requirePermission("demotion_order", "view"),
  async (req, res) => {
    try {
      if (isTopManagement(req)) {
        const r = await pool.query(`
          SELECT ${demotionSelect}
          FROM public.demotion_orders dmo
          JOIN public.staff s ON s.id = dmo.employee_id
          LEFT JOIN public.branches b ON b.id = s.branch_id
          ORDER BY dmo.created_at DESC
        `);

        return res.json(r.rows);
      }

      if (isAssistantVicePresident(req)) {
        const division = getUserDivision(req);

        if (!division) {
          return res.json([]);
        }

        const r = await pool.query(
          `
          SELECT ${demotionSelect}
          FROM public.demotion_orders dmo
          JOIN public.staff s ON s.id = dmo.employee_id
          LEFT JOIN public.branches b ON b.id = s.branch_id
          WHERE LOWER(TRIM(COALESCE(dmo.prev_division, ''))) =
                LOWER(TRIM($1))
          ORDER BY dmo.created_at DESC
          `,
          [division]
        );

        return res.json(r.rows);
      }

      if (isBranchManager(req)) {
        const branchId = await getUserBranchIdResolved(req);
        if (!branchId) return res.json([]);

        const r = await pool.query(
          `
          SELECT ${demotionSelect}
          FROM public.demotion_orders dmo
          JOIN public.staff s ON s.id = dmo.employee_id
          LEFT JOIN public.branches b ON b.id = s.branch_id
          WHERE dmo.prev_branch_id = $1
          ORDER BY dmo.created_at DESC
          `,
          [branchId]
        );

        return res.json(r.rows);
      }

      if (isAreaManager(req)) {
        const area = getUserArea(req);
        if (!area) return res.json([]);

        const r = await pool.query(
          `
          SELECT ${demotionSelect}
          FROM public.demotion_orders dmo
          JOIN public.staff s ON s.id = dmo.employee_id
          LEFT JOIN public.branches b ON b.id = s.branch_id
          WHERE LOWER(TRIM(COALESCE(dmo.prev_area, ''))) =
                LOWER(TRIM($1))
          ORDER BY dmo.created_at DESC
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
          SELECT ${demotionSelect}
          FROM public.demotion_orders dmo
          JOIN public.staff s ON s.id = dmo.employee_id
          LEFT JOIN public.branches b ON b.id = s.branch_id
          WHERE LOWER(TRIM(COALESCE(dmo.prev_region, ''))) =
                LOWER(TRIM($1))
          ORDER BY dmo.created_at DESC
          `,
          [region]
        );

        return res.json(r.rows);
      }

      return res.status(403).json({ message: "Access denied" });
    } catch (e) {
      console.error("GET /api/demotion-orders ERROR:", e);
      return res.status(500).json({ message: e?.message || "Server error" });
    }
  }
);

/*
|--------------------------------------------------------------------------
| CREATE DEMOTION ORDER
|--------------------------------------------------------------------------
*/

router.post(
  "/demotion-orders",
  requireAuth,
  requirePermission("demotion_order", "create"),
  upload.single("attachment"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

        if (!canCreateDemotion(req)) {
          await client.query("ROLLBACK");
          return res.status(403).json({
            message:
              "Only Admin, IT Department, HR Department, and Accounting Department can create demotion orders.",
          });
        }

      const b = req.body || {};
      const employee_id = toInt(b.employee_id);
      const new_position = toStr(b.new_position);
      const effective_date = toDateOrNull(b.effective_date);
      const details = toStr(b.details);
      const to_branch_id = toInt(b.to_branch_id);

      const to_division = toStr(b.to_division);
      const to_region = toStr(b.to_region);
      const to_area = toStr(b.to_area);

      const to_department = toStr(b.to_department);

      if (!to_division || !to_region || !to_area) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message:
            "Destination division, region, and area are required.",
        });
      }

      if (!to_department) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: "Destination department required",
        });
      }

      if (!employee_id) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Employee required" });
      }

      if (!new_position) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "New position required" });
      }

      if (!effective_date) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Effective date required" });
      }

      if (!to_branch_id) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Destination branch required" });
      }

      if (!req.file) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Demotion request file is required" });
      }

      const staffRow = await getStaffScope(client, employee_id);

      if (!staffRow) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Staff not found" });
      }

      const allowed = await canAccessStaff(client, req, staffRow);

      if (!allowed) {
        await client.query("ROLLBACK");
        return res.status(403).json({ message: "Access denied" });
      }

      const prevBranchId = staffRow.branch_id ? Number(staffRow.branch_id) : null;

      const prevBr = prevBranchId
        ? await client.query(
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
            `,
            [prevBranchId]
          )
        : { rowCount: 0, rows: [] };

      const toBr = await client.query(
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
        `,
        [to_branch_id]
      );

      if (toBr.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Destination branch not found" });
      }

      const destinationDivision = to_division;
      const destinationRegion = to_region;
      const destinationArea = to_area;

      const employee_name = buildEmployeeName(staffRow);
      const orderNo = await generateOrderNo(client, "DMO");
      const department = toStr(staffRow.department);
      const staffForApproval = {
        ...staffRow,
        department,
        position: staffRow.position,
      };

      const activeChain =
        await getActiveApprovalChain(
          client,
          staffForApproval
        );

      const initialStage =
        activeChain[0] || "admin";

      const attachment_path = `/uploads/demotions/${req.file.filename}`;
      const attachment_name = req.file.originalname || null;
      const attachment_mime = req.file.mimetype || null;

      const ins = await client.query(
        `
        INSERT INTO public.demotion_orders
        (
          order_no,
          employee_id,
          employee_name,

          old_position,
          new_position,

          prev_branch_id,
          prev_branch_code,
          prev_branch_name,

          prev_division,
          prev_region,
          prev_area,
          prev_department,

          to_branch_id,
          to_branch_code,
          to_branch_name,

          to_division,
          to_region,
          to_area,
          to_department,

          effective_date,
          details,

          status,
          approval_stage,

          area_manager_status,
          regional_manager_status,
          assistant_vice_president_status,
          vice_president_status,
          admin_status,

          attachment_path,
          attachment_name,
          attachment_mime,

          approved_attachment_path,
          approved_attachment_name,
          approved_attachment_mime,

          created_by
        )
        VALUES
        (
          $1,$2,$3,

          $4,$5,

          $6,$7,$8,

          $9,$10,$11,$12,

          $13,$14,$15,

          $16,$17,$18,$19,

          $20::date,$21,

          'Pending',
          $22,

          'Pending',
          'Pending',
          'Pending',
          'Pending',
          'Pending',

          $23,$24,$25,

          NULL,NULL,NULL,

          $26
        )
        RETURNING *
        `,
        [
          orderNo,
          employee_id,
          employee_name,

          toStr(staffRow.position) || null,
          new_position,

          prevBranchId,
          prevBr.rowCount
            ? toStr(prevBr.rows[0].code)
            : "",
          prevBr.rowCount
            ? toStr(prevBr.rows[0].name)
            : "",

          toStr(staffRow.division) || null,
          toStr(staffRow.region) || null,
          toStr(staffRow.area) || null,
          toStr(staffRow.department) || null,

          Number(to_branch_id),
          toStr(toBr.rows[0].code),
          toStr(toBr.rows[0].name),

          destinationDivision || null,
          destinationRegion || null,
          destinationArea || null,
          to_department || null,

          effective_date,
          details || null,

          initialStage,

          attachment_path,
          attachment_name,
          attachment_mime,

          req.user?.id ?? null,
        ]
      );

      await saveDemotionApprovalHistory(
        client,
        req,
        {
          demotionOrderId: ins.rows[0].id,
          action: "Created",
          approvalStage: initialStage,
          remarks:
            `Demotion order ${orderNo} created. ` +
            `Initial approval stage: ${initialStage}.`,
        }
      );

      await client.query("COMMIT");

      return res.json(ins.rows[0]);
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("POST /api/demotion-orders ERROR:", e);
      return res.status(500).json({ message: e?.message || "Server error" });
    } finally {
      client.release();
    }
  }
);

/*
|--------------------------------------------------------------------------
| EDIT DEMOTION ORDER
|--------------------------------------------------------------------------
*/

router.put(
  "/demotion-orders/:id/edit",
  requireAuth,
  requirePermission("demotion_order", "edit"),
  upload.single("attachment"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const id = toInt(req.params.id);

      if (!id) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: "Invalid demotion order ID",
        });
      }

      if (!canEditDemotion(req)) {
        await client.query("ROLLBACK");

        if (req.file?.path) {
          try {
            fs.unlinkSync(req.file.path);
          } catch {}
        }

        return res.status(403).json({
          message:
            "Only Admin, IT Department, HR Department, and Accounting Department can edit demotion orders.",
        });
      }

      const existingResult = await client.query(
        `
        SELECT *
        FROM public.demotion_orders
        WHERE id = $1
        FOR UPDATE
        `,
        [id]
      );

      if (!existingResult.rowCount) {
        await client.query("ROLLBACK");

        if (req.file?.path) {
          try {
            fs.unlinkSync(req.file.path);
          } catch {}
        }

        return res.status(404).json({
          message: "Demotion order not found",
        });
      }

      const existing = existingResult.rows[0];
      const currentStatus = norm(existing.status);

      if (
        currentStatus === "approved" ||
        currentStatus === "rejected" ||
        currentStatus === "voided"
      ) {
        await client.query("ROLLBACK");

        if (req.file?.path) {
          try {
            fs.unlinkSync(req.file.path);
          } catch {}
        }

        return res.status(400).json({
          message:
            "Approved, rejected, or voided demotion orders can no longer be edited.",
        });
      }

      const b = req.body || {};

      const new_position = toStr(b.new_position);
      const effective_date = toDateOrNull(b.effective_date);
      const details = toStr(b.details);
      const to_branch_id = toInt(b.to_branch_id);
      const to_division = toStr(b.to_division);
      const to_region = toStr(b.to_region);
      const to_area = toStr(b.to_area);
      const to_department = toStr(b.to_department);

      if (!to_division || !to_region || !to_area) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message:
            "Destination division, region, and area are required.",
        });
      }

      if (!new_position) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: "New position required",
        });
      }

      if (!effective_date) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: "Effective date required",
        });
      }

      if (!to_branch_id) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: "Destination branch required",
        });
      }

      if (!to_department) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: "Destination department required",
        });
      }

      const branchResult = await client.query(
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
        [to_branch_id]
      );

      if (!branchResult.rowCount) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: "Destination branch not found",
        });
      }

      const branch = branchResult.rows[0];

      let attachmentPath = existing.attachment_path;
      let attachmentName = existing.attachment_name;
      let attachmentMime = existing.attachment_mime;

      if (req.file) {
        attachmentPath = `/uploads/demotions/${req.file.filename}`;
        attachmentName = req.file.originalname || null;
        attachmentMime = req.file.mimetype || null;
      }

      const updated = await client.query(
        `
        UPDATE public.demotion_orders
        SET
          new_position = $1,
          to_branch_id = $2,
          to_branch_code = $3,
          to_branch_name = $4,
          to_division = $5,
          to_region = $6,
          to_area = $7,
          to_department = $8,
          effective_date = $9::date,
          details = $10,
          attachment_path = $11,
          attachment_name = $12,
          attachment_mime = $13
        WHERE id = $14
        RETURNING *
        `,
        [
          new_position,
          to_branch_id,
          toStr(branch.code),
          toStr(branch.name),
          to_division,
          to_region,
          to_area,
          to_department,
          effective_date,
          details,
          attachmentPath,
          attachmentName,
          attachmentMime,
          id,
        ]
      );

      await client.query("COMMIT");

      // Remove old request attachment only after DB update succeeds.
      if (
        req.file &&
        existing.attachment_path &&
        existing.attachment_path !== attachmentPath
      ) {
        try {
          const oldFile = path.join(
            __dirname,
            "..",
            existing.attachment_path.replace(/^\/+/, "")
          );

          if (fs.existsSync(oldFile)) {
            fs.unlinkSync(oldFile);
          }
        } catch (cleanupError) {
          console.error(
            "Failed to remove old demotion attachment:",
            cleanupError
          );
        }
      }

      return res.json({
        message: "Demotion order updated successfully.",
        order: updated.rows[0],
      });
    } catch (e) {
      try {
        await client.query("ROLLBACK");
      } catch {}

      // New upload should not remain when edit fails.
      if (req.file?.path) {
        try {
          if (fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
          }
        } catch {}
      }

      console.error(
        "PUT /api/demotion-orders/:id/edit ERROR:",
        e
      );

      return res.status(500).json({
        message: e?.message || "Server error",
      });
    } finally {
      client.release();
    }
  }
);

/*
|--------------------------------------------------------------------------
| DOWNLOAD DEMOTION FILE
|--------------------------------------------------------------------------
*/

router.get(
  "/demotion-orders/:id/download/:type",
  requireAuth,
  requirePermission("demotion_order", "view"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const id = toInt(req.params.id);
      const type = norm(req.params.type);

      if (!id) return res.status(400).json({ message: "Invalid id" });

      if (!["request", "approved", "latest"].includes(type)) {
        return res.status(400).json({ message: "Invalid attachment type" });
      }

      const r = await client.query(
        `
          SELECT
            dmo.*,
            dmo.prev_branch_id AS branch_id,
            dmo.prev_area AS area,
            dmo.prev_region AS region,
            dmo.prev_division AS division,
            dmo.prev_department AS department
          FROM public.demotion_orders dmo
          WHERE dmo.id = $1
          LIMIT 1
        `,
        [id]
      );

      if (r.rowCount === 0) {
        return res.status(404).json({ message: "Demotion order not found" });
      }

      const row = r.rows[0];

      const allowed = await canAccessStaff(client, req, row);

      if (!allowed) {
        return res.status(403).json({ message: "Access denied" });
      }

      let targetPath = row.attachment_path;
      let targetName = row.attachment_name;

      if (type === "approved") {
        targetPath = row.approved_attachment_path || row.attachment_path;
        targetName = row.approved_attachment_name || row.attachment_name;
      }

      if (type === "latest") {
        targetPath = row.approved_attachment_path || row.attachment_path;
        targetName = row.approved_attachment_name || row.attachment_name;
      }

      if (!targetPath) {
        return res.status(404).json({ message: "No demotion file found" });
      }

      const rel = String(targetPath).replace(/^\/uploads\//, "");
      const filePath = path.join(__dirname, "..", "uploads", rel);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "Demotion file not found" });
      }

      return res.download(filePath, targetName || path.basename(filePath));
    } catch (e) {
      console.error("GET /api/demotion-orders/:id/download/:type ERROR:", e);
      return res.status(500).json({ message: e?.message || "Server error" });
    } finally {
      client.release();
    }
  }
);

/*
|--------------------------------------------------------------------------
| APPROVE / REJECT CHAIN
|--------------------------------------------------------------------------
*/

router.put(
  "/demotion-orders/:id",
  requireAuth,
  requirePermission("demotion_order", "approve"),
  upload.single("attachment"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const id = toInt(req.params.id);
      const action = norm(req.body?.action);

      if (!id) return res.status(400).json({ message: "Invalid id" });
      if (!["approve", "reject"].includes(action)) {
        return res.status(400).json({ message: "Invalid action" });
      }

      const reason = toStr(req.body?.reason);

      if (action === "reject" && !reason) {
        return res.status(400).json({ message: "Rejection reason is required" });
      }

      if (action === "approve" && !req.file) {
        return res.status(400).json({
          message:
            "Please upload the signed/approved demotion file before approving. This file will replace the previous file for the next approver.",
        });
      }

      await client.query("BEGIN");

      const cur = await client.query(
        `
        SELECT
          dmo.*,
          s.branch_id,
          s.area,
          s.region,
          s.division,
          s.department,
          s.position
        FROM public.demotion_orders dmo
        JOIN public.staff s ON s.id = dmo.employee_id
        WHERE dmo.id = $1
        FOR UPDATE
        `,
        [id]
      );

      if (cur.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Demotion order not found" });
      }

      const order = cur.rows[0];

      if (norm(order.status) === "approved" || norm(order.status) === "rejected") {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Already finalized" });
      }

      const approvalStaff = {
        branch_id: order.branch_id,
        area: order.area,
        region: order.region,
        division: order.division,
        department: toStr(order.department),
        position:
          toStr(order.old_position) ||
          toStr(order.position),
      };

      const chain =
        await getActiveApprovalChain(
          client,
          approvalStaff
        );

      let currentStage =
        await resolveCurrentActiveStage(
          client,
          approvalStaff,
          order.approval_stage
        );

      if (
        norm(order.approval_stage) !==
        norm(currentStage)
      ) {
        await client.query(
          `
          UPDATE public.demotion_orders
          SET approval_stage = $2
          WHERE id = $1
          `,
          [id, currentStage]
        );
      }

      if (!userCanActStage(req, currentStage, approvalStaff)) {
        await client.query("ROLLBACK");
        return res.status(403).json({ 
          message: "Not your approval stage" 
        });
      }

      const column = statusColumnMap[currentStage];

      if (!column) {
        await client.query("ROLLBACK");
        return res.status(403).json({ message: "Invalid approval stage" });
      }

      if (action === "reject") {
        await client.query(
          `
          UPDATE public.demotion_orders
          SET
            status = 'Rejected',
            ${column} = 'Rejected',
            rejected_by = $2,
            rejected_at = NOW(),
            rejection_reason = $3
          WHERE id = $1
          `,
          [id, req.user?.id ?? null, reason]
        );

        await saveDemotionApprovalHistory(
          client,
          req,
          {
            demotionOrderId: id,
            action: "Rejected",
            approvalStage: currentStage,
            remarks: reason,
          }
        );

        await client.query("COMMIT");

        return res.json({
          message: "Rejected successfully",
        });
      }

      const latestPath = `/uploads/demotions/${req.file.filename}`;
      const latestName = req.file.originalname || null;
      const latestMime = req.file.mimetype || null;

      const currentIndex = chain.indexOf(currentStage);
      const nextStage = chain[currentIndex + 1];

      if (!nextStage) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message:
            "Management approval cannot finalize a demotion order. The order must continue through the HR Admin Order and HR Final Approval workflow.",
        });
      }

      const waitingAdmin = nextStage === "admin";

      await client.query(
        `
        UPDATE public.demotion_orders
        SET
          ${column} = 'Approved',
          approval_stage = $2,
          status = $3,

          attachment_path = $4,
          attachment_name = $5,
          attachment_mime = $6
        WHERE id = $1
        `,
        [
          id,
          nextStage,
          waitingAdmin ? "Wait for HR Order" : "Pending",
          latestPath,
          latestName,
          latestMime,
        ]
      );

      await saveDemotionApprovalHistory(
        client,
        req,
        {
          demotionOrderId: id,
          action: "Approved",
          approvalStage: currentStage,
          remarks: waitingAdmin
            ? "Management approval completed. Forwarded to HR Admin Order."
            : `Approved. Forwarded to ${nextStage}.`,
        }
      );

      await client.query("COMMIT");

      return res.json({
        message: waitingAdmin
          ? "Management approval completed. Waiting for HR to upload the Admin Order."
          : `Approved and moved to ${nextStage}.`,
      });
    } catch (e) {
      try {
        await client.query("ROLLBACK");
      } catch {}

      console.error("PUT /api/demotion-orders/:id ERROR:", e);
      return res.status(500).json({ message: e?.message || "Server error" });
    } finally {
      client.release();
    }
  }
);

/*
|--------------------------------------------------------------------------
| BYPASS MANAGEMENT APPROVAL
|--------------------------------------------------------------------------
*/

router.put(
  "/demotion-orders/:id/bypass",
  requireAuth,
  requirePermission("demotion_order", "approve"),
  upload.single("attachment"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const id = toInt(req.params.id);
      const action = norm(req.body?.action);

      if (!id) {
        return res.status(400).json({
          message: "Invalid id",
        });
      }

      if (!["approve", "reject"].includes(action)) {
        return res.status(400).json({
          message: "Invalid action",
        });
      }

      if (!canBypassDemotion(req)) {
        return res.status(403).json({
          message:
            "You are not allowed to bypass demotion approval.",
        });
      }

      const reason = toStr(req.body?.reason);

      if (action === "reject" && !reason) {
        return res.status(400).json({
          message: "Rejection reason is required.",
        });
      }

      if (action === "approve" && !req.file) {
        return res.status(400).json({
          message:
            "Please upload the signed/approved demotion file before bypass approval.",
        });
      }

      await client.query("BEGIN");

      const cur = await client.query(
        `
        SELECT
          dmo.*,
          s.branch_id,
          s.area,
          s.region,
          s.division,
          s.department,
          s.position
        FROM public.demotion_orders dmo
        JOIN public.staff s
          ON s.id = dmo.employee_id
        WHERE dmo.id = $1
        FOR UPDATE
        `,
        [id]
      );

      if (!cur.rowCount) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          message: "Demotion order not found.",
        });
      }

      const order = cur.rows[0];

      if (
        ["approved", "rejected", "voided"].includes(
          norm(order.status)
        )
      ) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message:
            "This demotion order is already finalized.",
        });
      }

      const currentStage = norm(order.approval_stage);

      // Bypass is only for management approval stages.
      const managementStages = [
        "area manager",
        "regional manager",
        "assistant vice president",
        "vice president",
      ];

      if (!managementStages.includes(currentStage)) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message:
            "Bypass approval is only available during the management approval stages.",
        });
      }

      const column = statusColumnMap[currentStage];

      if (!column) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message: "Invalid approval stage.",
        });
      }

      // ----------------------------------------------------
      // BYPASS REJECT
      // ----------------------------------------------------

      if (action === "reject") {
        await client.query(
          `
          UPDATE public.demotion_orders
          SET
            status = 'Rejected',
            ${column} = 'Rejected',
            rejected_by = $2,
            rejected_at = NOW(),
            rejection_reason = $3
          WHERE id = $1
          `,
          [
            id,
            req.user?.id ?? null,
            reason,
          ]
        );

        await saveDemotionApprovalHistory(
          client,
          req,
          {
            demotionOrderId: id,
            action: "Bypass Rejected",
            approvalStage: currentStage,
            remarks: reason,
          }
        );

        await client.query("COMMIT");

        return res.json({
          message: "Demotion rejected through bypass.",
        });
      }

      // ----------------------------------------------------
      // BYPASS APPROVE
      //
      // Skip remaining management approvals and move
      // directly to HR Admin Order.
      // ----------------------------------------------------

      const latestPath =
        `/uploads/demotions/${req.file.filename}`;

      const latestName =
        req.file.originalname || null;

      const latestMime =
        req.file.mimetype || null;

      const updates = [];

      const chainOrder = [
        "area manager",
        "regional manager",
        "assistant vice president",
        "vice president",
      ];

      const currentIndex =
        chainOrder.indexOf(currentStage);

      for (
        let index = currentIndex;
        index < chainOrder.length;
        index += 1
      ) {
        const stage = chainOrder[index];
        const statusColumn = statusColumnMap[stage];

        if (statusColumn) {
          updates.push(
            `${statusColumn} = 'Bypass Approved'`
          );
        }
      }

      await client.query(
        `
        UPDATE public.demotion_orders
        SET
          ${updates.join(",\n          ")},
          approval_stage = 'admin',
          status = 'Wait for HR Order',
          attachment_path = $2,
          attachment_name = $3,
          attachment_mime = $4
        WHERE id = $1
        `,
        [
          id,
          latestPath,
          latestName,
          latestMime,
        ]
      );

      await saveDemotionApprovalHistory(
        client,
        req,
        {
          demotionOrderId: id,
          action: "Bypass Approved",
          approvalStage: currentStage,
          remarks:
            "Remaining management approvals bypassed. " +
            "Forwarded to HR Admin Order.",
        }
      );

      await client.query("COMMIT");

      return res.json({
        message:
          "Management approval bypassed successfully. Waiting for HR Admin Order.",
      });
    } catch (e) {
      try {
        await client.query("ROLLBACK");
      } catch {}

      console.error(
        "PUT /api/demotion-orders/:id/bypass ERROR:",
        e
      );

      return res.status(500).json({
        message: e?.message || "Server error",
      });
    } finally {
      client.release();
    }
  }
);

/*
|--------------------------------------------------------------------------
| HR ADMIN ORDER UPLOAD
|--------------------------------------------------------------------------
*/

router.post(
  "/demotion-orders/:id/hr-order",
  requireAuth,
  requirePermission("demotion_order", "upload_approved"),
  upload.single("attachment"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const id = toInt(req.params.id);

      if (!id) {
        return res.status(400).json({ message: "Invalid id" });
      }

      if (!isHRWorkflowUser(req)) {
        return res.status(403).json({
          message: "Only HR or Admin can upload the Admin Order.",
        });
      }

      if (!req.file) {
        return res.status(400).json({
          message: "Admin Order file is required.",
        });
      }

      await client.query("BEGIN");

      const result = await client.query(
        `
        SELECT *
        FROM public.demotion_orders
        WHERE id = $1
        FOR UPDATE
        `,
        [id]
      );

      if (!result.rowCount) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          message: "Demotion order not found",
        });
      }

      const order = result.rows[0];

      const terminalStatus = norm(order.status);

      if (
        ["approved", "rejected", "voided"].includes(terminalStatus)
      ) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message:
            "This demotion order is already finalized and can no longer receive an Admin Order.",
        });
      }

      const isOperationOrder =
        isOperationDepartment(order.prev_department);

      const nextStage = isOperationOrder
        ? "avp signed order"
        : "hr final";

      const nextStatus = isOperationOrder
        ? "Wait for AVP Signed Order"
        : "Wait for HR Final Approval";

      if (
        norm(order.approval_stage) !== "admin" ||
        ![
          "wait for admin order",
          "wait for hr order",
          "pending",
        ].includes(norm(order.status))
      ) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message:
            "HR Admin Order can only be uploaded after management approval.",
        });
      }

      const filePath =
        `/uploads/demotions/${req.file.filename}`;

      const fileName =
        req.file.originalname || null;

      const fileMime =
        req.file.mimetype || null;

      await client.query(
        `
        UPDATE public.demotion_orders
        SET
          admin_status = 'Approved',

          hr_order_status = 'Approved',
          hr_order_by = $2,
          hr_order_at = NOW(),

          approval_stage = $3,
          status = $4,

          attachment_path = $5,
          attachment_name = $6,
          attachment_mime = $7
        WHERE id = $1
        `,
        [
          id,
          req.user?.id ?? null,
          nextStage,
          nextStatus,
          filePath,
          fileName,
          fileMime,
        ]
      );

      await saveDemotionApprovalHistory(
        client,
        req,
        {
          demotionOrderId: id,
          action: "Admin Order Uploaded",
          approvalStage: "admin",
          remarks:
            `Admin Order uploaded: ${fileName || "Attachment"}.`,
        }
      );

      await client.query("COMMIT");

      return res.json({
        message: isOperationOrder
          ? "Admin Order uploaded successfully. Waiting for AVP to upload the staff-signed Admin Order."
          : "Admin Order uploaded successfully. Waiting for HR final approval.",
      });
    } catch (e) {
      try {
        await client.query("ROLLBACK");
      } catch {}

      console.error(
        "POST /api/demotion-orders/:id/hr-order ERROR:",
        e
      );

      return res.status(500).json({
        message: e?.message || "Server error",
      });
    } finally {
      client.release();
    }
  }
);

/*
|--------------------------------------------------------------------------
| AVP STAFF-SIGNED ADMIN ORDER
|--------------------------------------------------------------------------
*/

router.post(
  "/demotion-orders/:id/avp-signed-order",
  requireAuth,
  requirePermission("demotion_order", "approve"),
  upload.single("attachment"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const id = toInt(req.params.id);

      if (!id) {
        return res.status(400).json({ message: "Invalid id" });
      }

      if (!req.file) {
        return res.status(400).json({
          message:
            "Staff-signed Admin Order is required.",
        });
      }

      await client.query("BEGIN");

      const result = await client.query(
        `
        SELECT *
        FROM public.demotion_orders
        WHERE id = $1
        FOR UPDATE
        `,
        [id]
      );

      if (!result.rowCount) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          message: "Demotion order not found",
        });
      }

      const order = result.rows[0];

      if (!isOperationDepartment(order.prev_department)) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message:
            "The AVP staff-signed Admin Order step only applies to Operation Department demotion orders.",
        });
      }

      if (
        ["approved", "rejected", "voided"].includes(norm(order.status))
      ) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message:
            "This demotion order is already finalized.",
        });
      }

      if (
        norm(order.approval_stage) !==
        "avp signed order"
      ) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message:
            "This demotion order is not waiting for the AVP signed Admin Order.",
        });
      }

      /*
       * The AVP handling this return stage must belong
       * to the employee's ORIGINAL division.
       */
      const allowedAVP =
        isAdmin(req) ||
        (
          isAssistantVicePresident(req) &&
          isOperationDepartment(req.user?.department) &&
          norm(getUserDivision(req)) ===
            norm(order.prev_division)
        );

      if (!allowedAVP) {
        await client.query("ROLLBACK");

        return res.status(403).json({
          message:
            "Only the responsible Assistant Vice President can upload the signed Admin Order.",
        });
      }

      const filePath =
        `/uploads/demotions/${req.file.filename}`;

      const fileName =
        req.file.originalname || null;

      const fileMime =
        req.file.mimetype || null;

      await client.query(
        `
        UPDATE public.demotion_orders
        SET
          avp_signed_order_status = 'Approved',
          avp_signed_order_by = $2,
          avp_signed_order_at = NOW(),

          approval_stage = 'hr final',
          status = 'Wait for HR Final Approval',

          attachment_path = $3,
          attachment_name = $4,
          attachment_mime = $5
        WHERE id = $1
        `,
        [
          id,
          req.user?.id ?? null,
          filePath,
          fileName,
          fileMime,
        ]
      );

      await saveDemotionApprovalHistory(
        client,
        req,
        {
          demotionOrderId: id,
          action: "Staff-Signed Order Uploaded",
          approvalStage: "avp signed order",
          remarks:
            `Staff-signed Admin Order uploaded: ${fileName || "Attachment"}.`,
        }
      );

      await client.query("COMMIT");

      return res.json({
        message:
          "Staff-signed Admin Order uploaded successfully. Waiting for HR final verification and approval.",
      });
    } catch (e) {
      try {
        await client.query("ROLLBACK");
      } catch {}

      console.error(
        "POST /api/demotion-orders/:id/avp-signed-order ERROR:",
        e
      );

      return res.status(500).json({
        message: e?.message || "Server error",
      });
    } finally {
      client.release();
    }
  }
);

/*
|--------------------------------------------------------------------------
| HR FINAL VERIFICATION / APPROVAL
|--------------------------------------------------------------------------
*/

router.post(
  "/demotion-orders/:id/hr-final",
  requireAuth,
  requirePermission("demotion_order", "upload_approved"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const id = toInt(req.params.id);

      if (!id) {
        return res.status(400).json({
          message: "Invalid id",
        });
      }

      if (!isHRWorkflowUser(req)) {
        return res.status(403).json({
          message:
            "Only HR or Admin can perform final approval.",
        });
      }

      await client.query("BEGIN");

      const result = await client.query(
        `
        SELECT *
        FROM public.demotion_orders
        WHERE id = $1
        FOR UPDATE
        `,
        [id]
      );

      if (!result.rowCount) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          message: "Demotion order not found",
        });
      }

      const order = result.rows[0];

      if (
        ["approved", "rejected", "voided"].includes(norm(order.status))
      ) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message:
            "This demotion order has already been finalized.",
        });
      }

      if (
        norm(order.approval_stage) !== "hr final"
      ) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message:
            "This demotion order is not waiting for HR final approval.",
        });
      }

      const isOperationOrder =
        isOperationDepartment(order.prev_department);

      if (
        isOperationOrder &&
        norm(order.avp_signed_order_status) !== "approved"
      ) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message:
            "AVP staff-signed Admin Order has not been completed.",
        });
      }

      if (!order.attachment_path) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message:
            "Signed Admin Order file is missing.",
        });
      }

      const toBranchId =
        toInt(order.to_branch_id);

      if (!toBranchId) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message:
            "Destination branch missing in order.",
        });
      }

      /*
       * The AVP-uploaded file is already the final
       * staff-signed Admin Order.
       */
      await client.query(
        `
          UPDATE public.demotion_orders
          SET
            hr_final_status = 'Approved',
            hr_final_by = $2,
            hr_final_at = NOW(),

            status = 'Approved',
            approval_stage = 'approved',

            approved_by = $3,
            approved_at = NOW(),

            approved_attachment_path =
              attachment_path,
            approved_attachment_name =
              attachment_name,
            approved_attachment_mime =
              attachment_mime
          WHERE id = $1
        `,
        [
          id,
          req.user?.id ?? null,
          req.user?.id ?? null,
        ]
      );

      /*
       * Apply the actual demotion ONLY NOW.
       */
      const staffUpdate = await client.query(
        `
        UPDATE public.staff
        SET
          "position" = $1,
          branch_id = $2,
          division = $3,
          region = $4,
          area = $5,
          department = $6
        WHERE id = $7
        RETURNING id, employee_no
        `,
        [
          toStr(order.new_position),
          toBranchId,
          toStr(order.to_division),
          toStr(order.to_region),
          toStr(order.to_area),
          toStr(order.to_department),
          Number(order.employee_id),
        ]
      );

      if (!staffUpdate.rowCount) {
        throw new Error(
          "Employee record was not found. Demotion was not applied."
        );
      }

      const employeeNo =
        toStr(staffUpdate.rows[0]?.employee_no);

      if (employeeNo) {
        await client.query(
          `
          UPDATE public.staff_balances
          SET
            fullname = $1,
            "position" = $2,
            updated_at = NOW()
          WHERE employee_no = $3
          `,
          [
            toStr(order.employee_name),
            toStr(order.new_position),
            employeeNo,
          ]
        );
      }

      await saveDemotionApprovalHistory(
        client,
        req,
        {
          demotionOrderId: id,
          action: "Final Approved",
          approvalStage: "hr final",
          remarks:
            "Final approval completed. Employee information updated.",
        }
      );

      await client.query("COMMIT");

      return res.json({
        message:
          "HR verified the staff-signed Admin Order. Demotion approved successfully.",
      });
    } catch (e) {
      try {
        await client.query("ROLLBACK");
      } catch {}

      console.error(
        "POST /api/demotion-orders/:id/hr-final ERROR:",
        e
      );

      return res.status(500).json({
        message: e?.message || "Server error",
      });
    } finally {
      client.release();
    }
  }
);

/*
|--------------------------------------------------------------------------
| VOID APPROVED DEMOTION ORDER
|--------------------------------------------------------------------------
*/

router.put(
  "/demotion-orders/:id/void",
  requireAuth,
  requirePermission("demotion_order", "void"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const id = toInt(req.params.id);
      const reason = toStr(req.body?.reason);

      if (!id) {
        return res.status(400).json({
          message: "Invalid demotion order ID",
        });
      }

      if (!reason) {
        return res.status(400).json({
          message: "Void reason is required",
        });
      }

      if (!canVoidOrDeleteDemotion(req)) {
        return res.status(403).json({
          message:
            "Only Admin, HR Department, IT Department, and Accounting Department can void demotion orders.",
        });
      }

      await client.query("BEGIN");

      const result = await client.query(
        `
        SELECT *
        FROM public.demotion_orders
        WHERE id = $1
        FOR UPDATE
        `,
        [id]
      );

      if (!result.rowCount) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          message: "Demotion order not found",
        });
      }

      const order = result.rows[0];

      if (norm(order.status) !== "approved") {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message: "Only approved demotion orders can be voided",
        });
      }

      const previousBranchId = toInt(order.prev_branch_id);

      if (!previousBranchId) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message:
            "Previous branch is missing. The demotion cannot be restored safely.",
        });
      }

      if (!toStr(order.old_position)) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message:
            "Previous position is missing. The demotion cannot be restored safely.",
        });
      }

      // Restore the employee's previous position, branch, and scope.
      const staffRestore = await client.query(
        `
        UPDATE public.staff
        SET
          "position" = $1,
          branch_id = $2,
          division = $3,
          region = $4,
          area = $5,
          department = $6
        WHERE id = $7
        RETURNING id, employee_no
        `,
        [
          toStr(order.old_position),
          previousBranchId,
          toStr(order.prev_division),
          toStr(order.prev_region),
          toStr(order.prev_area),
          toStr(order.prev_department),
          Number(order.employee_id),
        ]
      );

      // Safety check:
      // Do not mark the demotion as Voided if the employee
      // could not actually be restored.
      if (!staffRestore.rowCount) {
        throw new Error(
          "Employee record was not found. Demotion could not be voided safely."
        );
      }

      // We already have the employee number from the restored staff record.
      const employeeNo =
        toStr(staffRestore.rows[0]?.employee_no);

      // Restore the corresponding staff balance position.
      if (employeeNo) {
        await client.query(
          `
          UPDATE public.staff_balances
          SET
            fullname = $1,
            "position" = $2,
            updated_at = NOW()
          WHERE employee_no = $3
          `,
          [
            toStr(order.employee_name),
            toStr(order.old_position),
            employeeNo,
          ]
        );
      }

      await client.query(
        `
        UPDATE public.demotion_orders
        SET
          status = 'Voided',
          approval_stage = 'voided',
          voided_by = $2,
          voided_at = NOW(),
          void_reason = $3
        WHERE id = $1
        RETURNING *
        `,
        [
          id,
          req.user?.id ?? null,
          reason,
        ]
      );

      await saveDemotionApprovalHistory(
        client,
        req,
        {
          demotionOrderId: id,
          action: "Voided",
          approvalStage: "voided",
          remarks: reason,
        }
      );

      await client.query("COMMIT");

      return res.json({
        message:
          "Demotion order voided successfully. The employee's previous position and branch were restored.",
      });
    } catch (e) {
      try {
        await client.query("ROLLBACK");
      } catch {}

      console.error(
        "PUT /api/demotion-orders/:id/void ERROR:",
        e
      );

      return res.status(500).json({
        message: e?.message || "Server error",
      });
    } finally {
      client.release();
    }
  }
);

/*
|--------------------------------------------------------------------------
| DELETE REJECTED OR VOIDED DEMOTION ORDER
|--------------------------------------------------------------------------
*/

router.delete(
  "/demotion-orders/:id",
  requireAuth,
  requirePermission("demotion_order", "delete"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const id = toInt(req.params.id);

      if (!id) {
        return res.status(400).json({
          message: "Invalid demotion order ID",
        });
      }

      if (!canVoidOrDeleteDemotion(req)) {
        return res.status(403).json({
          message:
            "Only Admin, HR Department, IT Department, and Accounting Department can delete demotion orders.",
        });
      }

      await client.query("BEGIN");

      const result = await client.query(
        `
        SELECT *
        FROM public.demotion_orders
        WHERE id = $1
        FOR UPDATE
        `,
        [id]
      );

      if (!result.rowCount) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          message: "Demotion order not found",
        });
      }

      const order = result.rows[0];
      const status = norm(order.status);

      if (!["rejected", "voided"].includes(status)) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message:
            "Only rejected or voided demotion orders can be deleted",
        });
      }

      await client.query(
        `
        DELETE FROM public.demotion_orders
        WHERE id = $1
        `,
        [id]
      );

      await client.query("COMMIT");

      const possiblePaths = [
        order.attachment_path,
        order.approved_attachment_path,
      ]
        .filter(Boolean)
        .map((filePath) =>
          path.join(
            __dirname,
            "..",
            "uploads",
            String(filePath).replace(/^\/uploads\//, "")
          )
        );

      for (const filePath of [...new Set(possiblePaths)]) {
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        } catch (fileError) {
          console.error(
            "Failed to delete demotion attachment:",
            filePath,
            fileError
          );
        }
      }

      return res.json({
        message: "Demotion order deleted successfully",
      });
    } catch (e) {
      try {
        await client.query("ROLLBACK");
      } catch {}

      console.error(
        "DELETE /api/demotion-orders/:id ERROR:",
        e
      );

      return res.status(500).json({
        message: e?.message || "Server error",
      });
    } finally {
      client.release();
    }
  }
);

module.exports = router;