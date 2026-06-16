// promotionOrderRoutes.js
const express = require("express");
const router = express.Router();
const pool = require("../db");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const { requireAuth } = require("../middlewares/authMiddleware");
const { requirePermission } = require("../middlewares/permissionMiddleware");

const toNum = (v) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

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

const roleLower = (req) => norm(req.user?.role);
const deptLower = (req) =>
  norm(
    req.user?.department ||
      req.user?.department_name ||
      req.user?.user_department ||
      req.user?.departmentName ||
      req.user?.dept
  );

const isAdmin = (req) => roleLower(req) === "admin";
const isIT = (req) => roleLower(req) === "it";
const isHr = (req) => roleLower(req) === "hr";
const isAccounting = (req) => roleLower(req) === "accounting";
const isTread = (req) => roleLower(req) === "tread";
const isBranchManager = (req) => roleLower(req) === "branch manager";
const isAreaManager = (req) => roleLower(req) === "area manager";
const isRegionalManager = (req) => roleLower(req) === "regional manager";
const isAssistantVicePresident = (req) => roleLower(req) === "assistant vice president";
const isVicePresident = (req) => roleLower(req) === "vice president";
const isSeniorVicePresident = (req) => roleLower(req) === "senior vice president";
const isPresident = (req) => roleLower(req) === "president";

const isHrDepartmentUser = (req) =>
  isHr(req) ||
  deptLower(req) === "hr" ||
  deptLower(req) === "hr department" ||
  deptLower(req) === "human resources" ||
  deptLower(req) === "human resources department";

const isTreadDepartmentUser = (req) =>
  isTread(req) ||
  deptLower(req) === "tread" ||
  deptLower(req) === "tread department" ||
  deptLower(req) === "treadt department";

const isITDepartmentUser = (req) =>
  isIT(req) ||
  deptLower(req) === "it" ||
  deptLower(req) === "it department";

const isAccountingDepartmentUser = (req) =>
  isAccounting(req) ||
  deptLower(req) === "accounting" ||
  deptLower(req) === "accounting department";

const isFinalPowerUser = (req) =>
  isAdmin(req) || isIT(req) || isHrDepartmentUser(req) || isAccountingDepartmentUser(req);

const canBypassApproval = (req) => isAdmin(req) || isSeniorVicePresident(req);

const canDeletePromotion = (req) => isAdmin(req);

const OPERATION_DEPTS = [
  "operation",
  "operations",
  "operation department",
  "operations department",
];

const PRODUCTION_DEPTS = [
  "production & logistic",
  "production & logistic department",
  "production and logistic",
  "production and logistic department",
  "logistic & production",
  "logistic & production department",
  "logistic and production",
  "logistic and production department",
];

const isOperationDepartment = (department) => OPERATION_DEPTS.includes(norm(department));
const isProductionDepartment = (department) => PRODUCTION_DEPTS.includes(norm(department));

const isBackOfficeFullViewDept = (dept) => {
  const d = norm(dept);
  return (
    d === "it department" ||
    d === "it" ||
    d === "audit department" ||
    d === "audit" ||
    d === "hr department" ||
    d === "hr" ||
    d === "human resources" ||
    d === "human resources department" ||
    d === "accounting department" ||
    d === "accounting" ||
    d === "tread department" ||
    d === "tread" ||
    d === "office of the president" ||
    isProductionDepartment(d)
  );
};

const getUserArea = (req) => toStr(req.user?.area);
const getUserRegion = (req) => toStr(req.user?.region);
const getUserDivision = (req) => toStr(req.user?.division);

async function getBranchIdFromCode(branchCode) {
  const code = toStr(branchCode);
  if (!code) return null;

  const r = await pool.query(
    `
    SELECT id
    FROM public.branches
    WHERE LOWER(TRIM(code)) = LOWER(TRIM($1))
    LIMIT 1
    `,
    [code]
  );

  return r.rows[0]?.id || null;
}

async function getUserBranchId(req) {
  const raw = toStr(req.user?.branch_id);
  if (!raw) return null;

  const asNumber = Number(raw);
  if (Number.isFinite(asNumber)) return asNumber;

  return await getBranchIdFromCode(raw);
}

const STAGE_COLUMN = {
  "branch manager": "branch_manager_status",
  "area manager": "area_manager_status",
  "regional manager": "regional_manager_status",
  "assistant vice president": "assistant_vice_president_status",
  "vice president": "vice_president_status",
  "senior vice president": "senior_vice_president_status",
  tread: "tread_status",
  final: "final_status",
};

const normalizePosition = (position) =>
  norm(position)
    .replace(/^acting\s+/i, "")
    .replace(/\(acting\)/gi, "")
    .replace(/acting/gi, "")
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const getBaseChainByPosition = (position) => {
  const p = normalizePosition(position);

  if (p.includes("senior vice president")) return [];
  if (p.includes("vice president")) return ["senior vice president"];
  if (p.includes("assistant vice president")) return ["vice president", "senior vice president"];
  if (p.includes("regional manager")) return ["assistant vice president", "vice president"];
  if (p.includes("area manager")) return ["regional manager", "assistant vice president", "vice president"];
  if (p.includes("branch manager")) return ["area manager", "regional manager", "assistant vice president", "vice president"];

  return ["branch manager", "area manager", "regional manager", "assistant vice president", "vice president"];
};

const getRawPromotionChain = (department, oldPosition) => {
  const base = getBaseChainByPosition(oldPosition);

  if (isOperationDepartment(department)) {
    return [...base, "tread", "final"];
  }

  return [...base, "final"];
};

async function getTableColumns(client, tableName) {
  const r = await client.query(
    `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = $1
    `,
    [tableName]
  );

  return r.rows.map((x) => x.column_name);
}

async function hasApproverAccount(client, stage, staff) {
  const s = norm(stage);

  if (s === "final") return true;
  if (s === "tread") {
    const r = await client.query(
      `
      SELECT id
      FROM public.users
      WHERE LOWER(TRIM(COALESCE(department,''))) LIKE '%tread%'
         OR LOWER(TRIM(COALESCE(role,''))) = 'tread'
      LIMIT 1
      `
    );
    return r.rowCount > 0;
  }

  const cols = await getTableColumns(client, "users");
  if (!cols.includes("role")) return true;

  const where = [`LOWER(TRIM(COALESCE(role,''))) = $1`];
  const params = [s];

  if (cols.includes("status")) {
    where.push(`LOWER(TRIM(COALESCE(status,'active'))) <> 'inactive'`);
  }

  if (s === "branch manager" && cols.includes("branch_id")) {
    params.push(String(staff.branch_id || ""));
    where.push(`COALESCE(branch_id::text,'') = $${params.length}`);
  }

  if (s === "area manager" && cols.includes("area")) {
    params.push(norm(staff.area));
    where.push(`LOWER(TRIM(COALESCE(area,''))) = $${params.length}`);
  }

  if (s === "regional manager" && cols.includes("region")) {
    params.push(norm(staff.region));
    where.push(`LOWER(TRIM(COALESCE(region,''))) = $${params.length}`);
  }

  if (
    ["assistant vice president", "vice president", "senior vice president"].includes(s) &&
    cols.includes("department")
  ) {
    params.push(norm(staff.department));
    where.push(`LOWER(TRIM(COALESCE(department,''))) = $${params.length}`);
  }

  try {
    const r = await client.query(
      `
      SELECT id
      FROM public.users
      WHERE ${where.join(" AND ")}
      LIMIT 1
      `,
      params
    );

    return r.rowCount > 0;
  } catch {
    return true;
  }
}

async function getPromotionChain(client, staff) {
  const raw = getRawPromotionChain(staff.department, staff.position);
  const chain = [];

  for (const stage of raw) {
    const exists = await hasApproverAccount(client, stage, staff);
    if (exists) chain.push(stage);
  }

  return chain.length ? chain : ["final"];
}

async function getInitialApprovalStage(client, staff) {
  const chain = await getPromotionChain(client, staff);
  return chain[0] || "final";
}

async function getNextApprovalStage(client, staff, currentStage) {
  const chain = await getPromotionChain(client, staff);
  const idx = chain.findIndex((x) => norm(x) === norm(currentStage));

  if (idx < 0) return chain[0] || "final";
  if (idx >= chain.length - 1) return "approved";

  return chain[idx + 1];
}

const canCreatePromotionForStaff = (req, staffRow) => {
  if (isAdmin(req) || isIT(req)) return true;

  const roleAllowed =
    isBranchManager(req) ||
    isAreaManager(req) ||
    isRegionalManager(req) ||
    isAssistantVicePresident(req) ||
    isVicePresident(req) ||
    isSeniorVicePresident(req);

  if (!roleAllowed) return false;

  const userDept = deptLower(req);
  const staffDept = norm(staffRow.department);

  if (isBackOfficeFullViewDept(userDept)) return true;

  if (isOperationDepartment(userDept) && isOperationDepartment(staffDept)) {
    return true;
  }

  return false;
};

const canViewAllPromotionOrders = (req) => {
  if (isAdmin(req) || isIT(req)) return true;

  if (isBackOfficeFullViewDept(deptLower(req))) return true;

  if (
    isVicePresident(req) ||
    isSeniorVicePresident(req) ||
    isPresident(req)
  ) {
    return true;
  }

  return false;
};

const canRoleActAtStage = (req, stage) => {
  const s = norm(stage);

  if (canBypassApproval(req)) return true;

  if (s === "branch manager") return isBranchManager(req);
  if (s === "area manager") return isAreaManager(req);
  if (s === "regional manager") return isRegionalManager(req);
  if (s === "assistant vice president") return isAssistantVicePresident(req);
  if (s === "vice president") return isVicePresident(req);
  if (s === "senior vice president") return isSeniorVicePresident(req);
  if (s === "tread") return isTreadDepartmentUser(req);
  if (s === "final") return isHrDepartmentUser(req) || isAdmin(req) || isIT(req);

  return false;
};

const canDownloadApprovedFile = (req, order) => {
  if (
    isAdmin(req) ||
    isIT(req) ||
    isHrDepartmentUser(req) ||
    isVicePresident(req) ||
    isSeniorVicePresident(req) ||
    isPresident(req) ||
    canViewAllPromotionOrders(req)
  ) {
    return true;
  }

  const status = norm(order?.status);

  return status === "approved";
};

const uploadDir = path.join(__dirname, "..", "uploads", "promotion-orders");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    const base = path
      .basename(file.originalname || "attachment", ext)
      .replace(/[^a-zA-Z0-9-_]/g, "_")
      .slice(0, 80);

    cb(null, `${Date.now()}-${base}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
});

function removeStoredFile(storedPath) {
  try {
    if (!storedPath) return;
    const cleanPath = String(storedPath).replace(/^\/+/, "");
    const fullPath = path.join(process.cwd(), cleanPath);
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
  } catch (e) {
    console.error("removeStoredFile ERROR:", e.message);
  }
}

async function generateOrderNo(client, prefix) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  await client.query(
    `
    INSERT INTO public.order_sequences(prefix, year, month, next_value)
    VALUES ($1,$2,$3,1)
    ON CONFLICT (prefix, year, month) DO NOTHING
    `,
    [prefix, year, month]
  );

  const seq = await client.query(
    `
    SELECT next_value
    FROM public.order_sequences
    WHERE prefix=$1 AND year=$2 AND month=$3
    FOR UPDATE
    `,
    [prefix, year, month]
  );

  const nextVal = Number(seq.rows[0].next_value);

  await client.query(
    `
    UPDATE public.order_sequences
    SET next_value = next_value + 1
    WHERE prefix=$1 AND year=$2 AND month=$3
    `,
    [prefix, year, month]
  );

  return `${prefix}-${year}-${String(month).padStart(2, "0")}-${String(nextVal).padStart(4, "0")}`;
}

router.get(
  "/promotion-orders",
  requireAuth,
  requirePermission("promotion_order", "view"),
  async (req, res) => {
    try {
      if (canViewAllPromotionOrders(req)) {
        const r = await pool.query(`
          SELECT *
          FROM public.promotion_orders
          ORDER BY created_at DESC
        `);

        return res.json(r.rows);
      }

      if (isVicePresident(req) && isOperationDepartment(deptLower(req))) {
        const r = await pool.query(`
          SELECT po.*
          FROM public.promotion_orders po
          JOIN public.staff s ON s.id = po.employee_id
          WHERE LOWER(TRIM(COALESCE(s.department,''))) IN
            ('operation','operations','operation department','operations department')
          ORDER BY po.created_at DESC
        `);

        return res.json(r.rows);
      }

      if (isBranchManager(req)) {
        const bid = await getUserBranchId(req);
        if (!bid) return res.json([]);

        const r = await pool.query(
          `
          SELECT po.*
          FROM public.promotion_orders po
          JOIN public.staff s ON s.id = po.employee_id
          WHERE s.branch_id = $1
          ORDER BY po.created_at DESC
          `,
          [bid]
        );

        return res.json(r.rows);
      }

      if (isAreaManager(req)) {
        const area = getUserArea(req);
        if (!area) return res.json([]);

        const r = await pool.query(
          `
          SELECT po.*
          FROM public.promotion_orders po
          JOIN public.staff s ON s.id = po.employee_id
          WHERE LOWER(TRIM(COALESCE(s.area,''))) = LOWER(TRIM($1))
             OR po.approval_stage = 'area manager'
          ORDER BY po.created_at DESC
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
          SELECT po.*
          FROM public.promotion_orders po
          JOIN public.staff s ON s.id = po.employee_id
          WHERE LOWER(TRIM(COALESCE(s.region,''))) = LOWER(TRIM($1))
             OR po.approval_stage = 'regional manager'
          ORDER BY po.created_at DESC
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
          SELECT po.*
          FROM public.promotion_orders po
          JOIN public.staff s ON s.id = po.employee_id
          WHERE LOWER(TRIM(COALESCE(s.division,''))) = LOWER(TRIM($1))
             OR po.approval_stage = 'assistant vice president'
          ORDER BY po.created_at DESC
          `,
          [division]
        );

        return res.json(r.rows);
      }

      return res.status(403).json({ message: "Access denied" });
    } catch (e) {
      console.error("GET /api/promotion-orders ERROR:", e);
      return res.status(500).json({ message: e?.message || "Server error" });
    }
  }
);

router.get(
  "/promotion-orders/staff/:staffId",
  requireAuth,
  requirePermission("promotion_order", "view"),
  async (req, res) => {
    try {
      const staffId = toInt(req.params.staffId);

      if (!staffId) {
        return res.status(400).json({ message: "Invalid staff id" });
      }

      const r = await pool.query(
        `
        SELECT *
        FROM public.promotion_orders
        WHERE employee_id = $1
        ORDER BY created_at DESC
        `,
        [staffId]
      );

      return res.json(r.rows);
    } catch (e) {
      console.error("GET /api/promotion-orders/staff/:staffId ERROR:", e);
      return res.status(500).json({ message: "Failed to load promotion history" });
    }
  }
);

router.post(
  "/promotion-orders",
  requireAuth,
  requirePermission("promotion_order", "create"),
  upload.single("attachment"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const b = req.body || {};

      const employee_id = toInt(b.employee_id);
      const effective_date = toDateOrNull(b.effective_date);

      const employee_name = toStr(b.employee_name);
      const departmentFromBody = toStr(b.department);
      const old_position = toStr(b.old_position);
      const new_position = toStr(b.new_position);

      const old_salary = toNum(b.old_salary);
      const new_salary = toNum(b.new_salary);
      const old_ecola = toNum(b.old_ecola);
      const new_ecola = toNum(b.new_ecola);

      const prev_branch_id = toInt(b.prev_branch_id);
      const present_branch_id = toInt(b.present_branch_id);
      const prev_branch_code = toStr(b.prev_branch_code);
      const prev_branch_name = toStr(b.prev_branch_name);
      const present_branch_code = toStr(b.present_branch_code);
      const present_branch_name = toStr(b.present_branch_name);

      const details = toStr(b.details || b.remarks);

      if (!employee_id) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Employee is required" });
      }

      if (!new_position) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "New position is required" });
      }

      if (!effective_date) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Effective date is required" });
      }

      if (!req.file) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Promotion request file is required" });
      }

      const staffRes = await client.query(
        `
        SELECT
          id,
          fullname,
          employee_no,
          branch_id,
          area,
          region,
          division,
          department,
          last_name,
          first_name,
          middle_name,
          position,
          salary,
          ecola
        FROM public.staff
        WHERE id = $1
        `,
        [employee_id]
      );

      if (staffRes.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Staff not found" });
      }

      const staffRow = staffRes.rows[0];
      const department = departmentFromBody || toStr(staffRow.department);
      const currentPosition = old_position || toStr(staffRow.position);

      if (!department) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: "Employee department is required. Make sure staff.department is saved.",
        });
      }

      if (!canCreatePromotionForStaff(req, staffRow)) {
        await client.query("ROLLBACK");
        return res.status(403).json({
          message: "You are not allowed to create promotion for this department.",
        });
      }

      const staffForChain = {
        ...staffRow,
        department,
        position: currentPosition,
      };

      const attachment_path = `/uploads/promotion-orders/${req.file.filename}`;
      const attachment_name = req.file.originalname || null;
      const attachment_mime = req.file.mimetype || null;

      const applicantRole = roleLower(req);
      const approvalStage = await getInitialApprovalStage(client, staffForChain);
      const orderNo = await generateOrderNo(client, "PRO");

      const ins = await client.query(
        `
        INSERT INTO public.promotion_orders
          (
            order_no,
            employee_id,
            employee_name,
            department,
            old_position,
            new_position,
            old_salary,
            new_salary,
            effective_date,
            details,
            status,
            created_by,
            old_ecola,
            new_ecola,
            last_name,
            first_name,
            middle_name,
            prev_branch_id,
            prev_branch_code,
            prev_branch_name,
            present_branch_id,
            present_branch_code,
            present_branch_name,
            attachment_path,
            attachment_name,
            attachment_mime,
            approved_attachment_path,
            approved_attachment_name,
            approved_attachment_mime,
            applicant_role,
            approval_stage,
            branch_manager_status,
            area_manager_status,
            regional_manager_status,
            assistant_vice_president_status,
            vice_president_status,
            senior_vice_president_status,
            tread_status,
            hr_status,
            final_status
          )
        VALUES
          (
            $1, $2, $3, $4, $5, $6, $7, $8, $9::date, $10, 'Pending', $11,
            $12, $13, $14, $15, $16,
            $17, $18, $19, $20, $21, $22,
            $23, $24, $25,
            NULL, NULL, NULL,
            $26, $27,
            'Pending',
            'Pending',
            'Pending',
            'Pending',
            'Pending',
            'Pending',
            'Pending',
            'Pending',
            'Pending'
          )
        RETURNING *;
        `,
        [
          orderNo,
          employee_id,
          employee_name || toStr(staffRow.fullname),
          department,
          currentPosition || null,
          new_position,
          old_salary || toNum(staffRow.salary),
          new_salary,
          effective_date,
          details || null,
          req.user?.id ?? null,
          old_ecola || toNum(staffRow.ecola),
          new_ecola,
          toStr(staffRow.last_name) || null,
          toStr(staffRow.first_name) || null,
          toStr(staffRow.middle_name) || null,
          prev_branch_id,
          prev_branch_code || null,
          prev_branch_name || null,
          present_branch_id,
          present_branch_code || null,
          present_branch_name || null,
          attachment_path,
          attachment_name,
          attachment_mime,
          applicantRole,
          approvalStage,
        ]
      );

      await client.query("COMMIT");
      return res.json(ins.rows[0]);
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("POST /api/promotion-orders ERROR:", e);
      return res.status(500).json({ message: e?.message || "Server error" });
    } finally {
      client.release();
    }
  }
);

router.put(
  "/promotion-orders/:id/approve",
  requireAuth,
  requirePermission("promotion_order", "approve"),
  upload.single("attachment"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const id = toInt(req.params.id);

      if (!id) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Invalid id" });
      }

      if (!req.file) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: "Please upload the signed/approved promotion file before approving.",
        });
      }

      const cur = await client.query(
        `
        SELECT *
        FROM public.promotion_orders
        WHERE id = $1
        FOR UPDATE
        `,
        [id]
      );

      if (cur.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Promotion order not found" });
      }

      const order = cur.rows[0];

      if (["approved", "rejected", "voided"].includes(norm(order.status))) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Order already finalized" });
      }

      const staffRes = await client.query(
        `
        SELECT id, branch_id, area, region, division, department, position
        FROM public.staff
        WHERE id = $1
        LIMIT 1
        `,
        [order.employee_id]
      );

      const staff = staffRes.rows[0] || {
        id: order.employee_id,
        branch_id: order.prev_branch_id,
        area: order.area,
        region: order.region,
        division: order.division,
        department: order.department,
        position: order.old_position,
      };

      staff.department = order.department || staff.department;
      staff.position = order.old_position || staff.position;

      let currentStage = norm(order.approval_stage) || (await getInitialApprovalStage(client, staff));

      if (!canRoleActAtStage(req, currentStage)) {
        await client.query("ROLLBACK");
        return res.status(403).json({ message: "Not your approval stage" });
      }

      const latestPath = `/uploads/promotion-orders/${req.file.filename}`;
      const latestName = req.file.originalname || null;
      const latestMime = req.file.mimetype || null;

      const column = STAGE_COLUMN[currentStage];

      if (!column) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Invalid approval stage" });
      }

      if (currentStage === "final") {
        if (!isHrDepartmentUser(req) && !isAdmin(req) && !isIT(req)) {
          await client.query("ROLLBACK");
          return res.status(403).json({ message: "Only HR Department can final approve and upload." });
        }

        await client.query(
          `
          UPDATE public.promotion_orders
          SET
            status = 'Approved',
            ${column} = 'Approved',
            approved_by = $2,
            approved_at = NOW(),
            rejected_by = NULL,
            rejected_at = NULL,
            rejection_reason = NULL,
            approval_stage = NULL,
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

        await client.query(
          `
          UPDATE public.staff
          SET
            "position" = $1,
            salary = $2,
            ecola = $3,
            branch_id = $4
          WHERE id = $5
          `,
          [
            order.new_position,
            toNum(order.new_salary),
            toNum(order.new_ecola),
            order.present_branch_id ? Number(order.present_branch_id) : null,
            order.employee_id,
          ]
        );

        await client.query("COMMIT");

        if (order.attachment_path && order.attachment_path !== latestPath) {
          removeStoredFile(order.attachment_path);
        }

        return res.json({ message: "Promotion finalized by HR and staff updated." });
      }

      const nextStage = await getNextApprovalStage(client, staff, currentStage);

      await client.query(
        `
        UPDATE public.promotion_orders
        SET
          ${column} = 'Approved',
          approval_stage = $2,
          rejected_by = NULL,
          rejected_at = NULL,
          rejection_reason = NULL,
          attachment_path = $3,
          attachment_name = $4,
          attachment_mime = $5
        WHERE id = $1
        `,
        [id, nextStage, latestPath, latestName, latestMime]
      );

      await client.query("COMMIT");

      if (order.attachment_path && order.attachment_path !== latestPath) {
        removeStoredFile(order.attachment_path);
      }

      return res.json({
        message:
          nextStage === "final"
            ? "Promotion approved. Waiting for HR Department final approval and upload."
            : `Promotion approved. Moved to ${nextStage}.`,
      });
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("PUT /api/promotion-orders/:id/approve ERROR:", e);
      return res.status(500).json({ message: e?.message || "Server error" });
    } finally {
      client.release();
    }
  }
);

router.put(
  "/promotion-orders/:id/reject",
  requireAuth,
  requirePermission("promotion_order", "reject"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const id = toInt(req.params.id);
      const reason = toStr(req.body?.reason);

      if (!id) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Invalid id" });
      }

      if (!reason) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Rejection reason is required" });
      }

      const cur = await client.query(
        `
        SELECT *
        FROM public.promotion_orders
        WHERE id = $1
        FOR UPDATE
        `,
        [id]
      );

      if (cur.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Promotion order not found" });
      }

      const order = cur.rows[0];

      if (["approved", "rejected", "voided"].includes(norm(order.status))) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Order already finalized" });
      }

      const currentStage = norm(order.approval_stage);

      if (!canRoleActAtStage(req, currentStage)) {
        await client.query("ROLLBACK");
        return res.status(403).json({ message: "Not your approval stage" });
      }

      const column = STAGE_COLUMN[currentStage] || "final_status";

      await client.query(
        `
        UPDATE public.promotion_orders
        SET
          status = 'Rejected',
          ${column} = 'Rejected',
          rejected_by = $2,
          rejected_at = NOW(),
          rejection_reason = $3,
          approved_by = NULL,
          approved_at = NULL
        WHERE id = $1
        `,
        [id, req.user?.id ?? null, reason]
      );

      await client.query("COMMIT");
      return res.json({ message: "Promotion rejected." });
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("PUT /api/promotion-orders/:id/reject ERROR:", e);
      return res.status(500).json({ message: e?.message || "Server error" });
    } finally {
      client.release();
    }
  }
);

router.put(
  "/promotion-orders/:id/void",
  requireAuth,
  requirePermission("promotion_order", "delete"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const id = toInt(req.params.id);

      if (!id) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Invalid id" });
      }

      if (!canDeletePromotion(req)) {
        await client.query("ROLLBACK");
        return res.status(403).json({ message: "Only Admin can void approved promotion." });
      }

      const cur = await client.query(
        `
        SELECT *
        FROM public.promotion_orders
        WHERE id=$1
        FOR UPDATE
        `,
        [id]
      );

      if (cur.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Promotion order not found" });
      }

      const order = cur.rows[0];

      if (norm(order.status) !== "approved") {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Only approved promotion can be voided." });
      }

      await client.query(
        `
        UPDATE public.promotion_orders
        SET
          status='Voided',
          final_status='Voided',
          approval_stage='final',
          approved_by=NULL,
          approved_at=NULL
        WHERE id=$1
        `,
        [id]
      );

      await client.query(
        `
        UPDATE public.staff
        SET
          "position" = $1,
          salary = $2,
          ecola = $3,
          branch_id = $4
        WHERE id = $5
        `,
        [
          order.old_position,
          toNum(order.old_salary),
          toNum(order.old_ecola),
          order.prev_branch_id ? Number(order.prev_branch_id) : null,
          order.employee_id,
        ]
      );

      await client.query("COMMIT");
      return res.json({ message: "Promotion voided and staff reverted." });
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("PUT /api/promotion-orders/:id/void ERROR:", e);
      return res.status(500).json({ message: e?.message || "Server error" });
    } finally {
      client.release();
    }
  }
);

router.delete(
  "/promotion-orders/:id",
  requireAuth,
  requirePermission("promotion_order", "delete"),
  async (req, res) => {
    try {
      const id = toInt(req.params.id);

      if (!id) return res.status(400).json({ message: "Invalid id" });

      if (!canDeletePromotion(req)) {
        return res.status(403).json({ message: "Only Admin can delete promotion orders." });
      }

      const check = await pool.query(
        `
        SELECT attachment_path, approved_attachment_path, status
        FROM public.promotion_orders
        WHERE id=$1
        `,
        [id]
      );

      if (check.rowCount === 0) {
        return res.status(404).json({ message: "Promotion order not found" });
      }

      const status = norm(check.rows[0].status);

      if (!["rejected", "voided"].includes(status)) {
        return res.status(400).json({ message: "Only rejected or voided promotion orders can be deleted." });
      }

      await pool.query(`DELETE FROM public.promotion_orders WHERE id=$1`, [id]);

      removeStoredFile(check.rows[0].attachment_path);
      removeStoredFile(check.rows[0].approved_attachment_path);

      return res.json({ message: "Promotion deleted." });
    } catch (e) {
      console.error("DELETE /api/promotion-orders/:id ERROR:", e);
      return res.status(500).json({ message: e?.message || "Server error" });
    }
  }
);

router.get(
  "/promotion-orders/:id/download/:type",
  requireAuth,
  requirePermission("promotion_order", "view"),
  async (req, res) => {
    try {
      const id = toInt(req.params.id);
      const type = norm(req.params.type);

      if (!id) return res.status(400).json({ message: "Invalid id" });

      if (!["request", "approved", "latest"].includes(type)) {
        return res.status(400).json({ message: "Invalid attachment type" });
      }

      const r = await pool.query(
        `
        SELECT *
        FROM public.promotion_orders
        WHERE id = $1
        LIMIT 1
        `,
        [id]
      );

      if (r.rowCount === 0) {
        return res.status(404).json({ message: "Promotion order not found" });
      }

      const row = r.rows[0];

      if ((type === "approved" || type === "latest") && !canDownloadApprovedFile(req, row)) {
        return res.status(403).json({ message: "Access denied" });
      }

      let storedPath = row.attachment_path;
      let storedName = row.attachment_name;

      if (type === "approved") {
        storedPath = row.approved_attachment_path;
        storedName = row.approved_attachment_name;
      }

      if (type === "latest") {
        storedPath = row.approved_attachment_path || row.attachment_path;
        storedName = row.approved_attachment_name || row.attachment_name;
      }

      if (!storedPath) {
        return res.status(404).json({ message: "No attachment found" });
      }

      const cleanPath = String(storedPath).replace(/^\/+/, "");
      const fileNameOnly = path.basename(cleanPath);

      const possiblePaths = [
        path.isAbsolute(storedPath) ? storedPath : null,
        path.join(__dirname, "..", cleanPath),
        path.join(process.cwd(), cleanPath),
        path.join(uploadDir, fileNameOnly),
      ].filter(Boolean);

      const filePath = possiblePaths.find((p) => fs.existsSync(p));

      if (!filePath) {
        return res.status(404).json({
          message: "Stored file not found",
          saved_path: storedPath,
        });
      }

      return res.download(filePath, storedName || path.basename(filePath));
    } catch (e) {
      console.error("GET /api/promotion-orders/:id/download/:type ERROR:", e);
      return res.status(500).json({ message: e?.message || "Server error" });
    }
  }
);

module.exports = router;