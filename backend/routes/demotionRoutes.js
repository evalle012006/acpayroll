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
    if (pos.includes("area manager")) return "assistant vice president";
    if (pos.includes("regional manager")) return "assistant vice president";
    if (pos.includes("assistant vice president")) return "vice president";
    if (pos.includes("vice president")) return "admin";

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

function userCanActStage(req, stage) {
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
      if (isTopManagement(req) || isAssistantVicePresident(req)) {
        const r = await pool.query(`
          SELECT ${demotionSelect}
          FROM public.demotion_orders dmo
          JOIN public.staff s ON s.id = dmo.employee_id
          LEFT JOIN public.branches b ON b.id = s.branch_id
          ORDER BY dmo.created_at DESC
        `);

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
          WHERE s.branch_id = $1
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
          WHERE LOWER(TRIM(COALESCE(s.area, ''))) = LOWER(TRIM($1))
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
          WHERE LOWER(TRIM(COALESCE(s.region, ''))) = LOWER(TRIM($1))
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
            SELECT id, code, name
            FROM public.branches
            WHERE id = $1
            `,
            [prevBranchId]
          )
        : { rowCount: 0, rows: [] };

      const toBr = await client.query(
        `
        SELECT id, code, name
        FROM public.branches
        WHERE id = $1
        `,
        [to_branch_id]
      );

      if (toBr.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Destination branch not found" });
      }

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
            to_branch_id,
            to_branch_code,
            to_branch_name,
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
            $1,$2,$3,$4,$5,
            $6,$7,$8,
            $9,$10,$11,
            $12::date,$13,
            'Pending',
            $14,
            'Pending',
            'Pending',
            'Pending',
            'Pending',
            'Pending',
            $15,$16,$17,
            NULL,NULL,NULL,
            $18
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
          prevBr.rowCount ? toStr(prevBr.rows[0].code) : "",
          prevBr.rowCount ? toStr(prevBr.rows[0].name) : "",
          Number(to_branch_id),
          toStr(toBr.rows[0].code),
          toStr(toBr.rows[0].name),
          effective_date,
          details || null,
          initialStage,
          attachment_path,
          attachment_name,
          attachment_mime,
          req.user?.id ?? null,
        ]
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
          s.branch_id,
          s.area,
          s.region,
          s.division
        FROM public.demotion_orders dmo
        JOIN public.staff s ON s.id = dmo.employee_id
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

      if (!userCanActStage(req, currentStage)) {
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

        await client.query("COMMIT");
        return res.json({ message: "Rejected successfully" });
      }

      const latestPath = `/uploads/demotions/${req.file.filename}`;
      const latestName = req.file.originalname || null;
      const latestMime = req.file.mimetype || null;

      const currentIndex = chain.indexOf(currentStage);
      const nextStage = chain[currentIndex + 1];

      if (!nextStage) {
        await client.query(
          `
          UPDATE public.demotion_orders
          SET
            ${column} = 'Approved',
            status = 'Approved',
            approved_by = $2,
            approved_at = NOW(),

            attachment_path = $3,
            attachment_name = $4,
            attachment_mime = $5,

            approved_attachment_path = $3,
            approved_attachment_name = $4,
            approved_attachment_mime = $5
          WHERE id = $1
          `,
          [id, req.user?.id ?? null, latestPath, latestName, latestMime]
        );

        const toBranchId = toInt(order.to_branch_id);

        if (!toBranchId) {
          await client.query("ROLLBACK");
          return res.status(400).json({ message: "Destination branch missing in order" });
        }

        await client.query(
          `
          UPDATE public.staff
          SET
            "position" = $1,
            branch_id = $2
          WHERE id = $3
          `,
          [toStr(order.new_position), toBranchId, Number(order.employee_id)]
        );

        await client.query(
          `
          UPDATE public.staff_balances
          SET
            fullname = $1,
            "position" = $2,
            updated_at = NOW()
          WHERE employee_no = (
            SELECT employee_no
            FROM public.staff
            WHERE id = $3
            LIMIT 1
          )
          `,
          [toStr(order.employee_name), toStr(order.new_position), Number(order.employee_id)]
        );

        await client.query("COMMIT");
        return res.json({
          message: "Demotion fully approved. Latest approved file is available.",
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
          waitingAdmin ? "Wait for Admin Order" : "Pending",
          latestPath,
          latestName,
          latestMime,
        ]
      );

      await client.query("COMMIT");

      return res.json({
        message: waitingAdmin
          ? "Vice President approved. Waiting for Admin/IT/HR/Accounting final upload."
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
| FINAL APPROVED FILE UPLOAD
|--------------------------------------------------------------------------
*/

router.post(
  "/demotion-orders/:id/approved-file",
  requireAuth,
  requirePermission("demotion_order", "upload_approved"),
  upload.single("attachment"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const id = toInt(req.params.id);

      if (!id) return res.status(400).json({ message: "Invalid id" });

      if (!req.file) {
        return res.status(400).json({ message: "Attachment is required" });
      }

      if (!isFinalUploader(req)) {
        return res.status(403).json({
          message: "Only Admin, IT, HR, and Accounting can upload approved files",
        });
      }

      await client.query("BEGIN");

      const cur = await client.query(
        `
        SELECT *
        FROM public.demotion_orders
        WHERE id = $1
        FOR UPDATE
        `,
        [id]
      );

      if (cur.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Demotion order not found" });
      }

      const order = cur.rows[0];

      if (!["admin", "wait for admin order"].includes(norm(order.approval_stage)) &&
          norm(order.status) !== "wait for admin order") {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: "Final file can only be uploaded after VP approval or direct admin stage.",
        });
      }

      const finalPath = `/uploads/demotions/${req.file.filename}`;
      const finalName = req.file.originalname || null;
      const finalMime = req.file.mimetype || null;

      await client.query(
        `
        UPDATE public.demotion_orders
        SET
          status = 'Approved',
          admin_status = 'Approved',
          approval_stage = 'approved',
          approved_by = $2,
          approved_at = NOW(),

          attachment_path = $3,
          attachment_name = $4,
          attachment_mime = $5,

          approved_attachment_path = $3,
          approved_attachment_name = $4,
          approved_attachment_mime = $5
        WHERE id = $1
        `,
        [id, req.user?.id ?? null, finalPath, finalName, finalMime]
      );

      const toBranchId = toInt(order.to_branch_id);

      if (!toBranchId) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Destination branch missing in order" });
      }

      await client.query(
        `
        UPDATE public.staff
        SET
          "position" = $1,
          branch_id = $2
        WHERE id = $3
        `,
        [toStr(order.new_position), toBranchId, Number(order.employee_id)]
      );

      await client.query(
        `
        UPDATE public.staff_balances
        SET
          fullname = $1,
          "position" = $2,
          updated_at = NOW()
        WHERE employee_no = (
          SELECT employee_no
          FROM public.staff
          WHERE id = $3
          LIMIT 1
        )
        `,
        [toStr(order.employee_name), toStr(order.new_position), Number(order.employee_id)]
      );

      await client.query("COMMIT");

      return res.json({
        message: "Final approved file uploaded. Demotion approved successfully.",
      });
    } catch (e) {
      try {
        await client.query("ROLLBACK");
      } catch {}

      console.error("POST /api/demotion-orders/:id/approved-file ERROR:", e);
      return res.status(500).json({ message: e?.message || "Server error" });
    } finally {
      client.release();
    }
  }
);

module.exports = router;