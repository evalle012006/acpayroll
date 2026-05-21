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
const deptLower = (req) => norm(req.user?.department);

const isAdmin = (req) => roleLower(req) === "admin";
const isIT = (req) => roleLower(req) === "it";
const isHr = (req) => roleLower(req) === "hr";
const isAccounting = (req) => roleLower(req) === "accounting";
const isTread = (req) => roleLower(req) === "tread";
const isBranchManager = (req) => roleLower(req) === "branch manager";
const isAreaManager = (req) => roleLower(req) === "area manager";
const isRegionalManager = (req) => roleLower(req) === "regional manager";
const isAssistantVicePresident = (req) =>
  roleLower(req) === "assistant vice president";
const isVicePresident = (req) => roleLower(req) === "vice president";
const isSeniorVicePresident = (req) =>
  roleLower(req) === "senior vice president";
const isPresident = (req) => roleLower(req) === "president";

const isTreadDepartmentUser = (req) =>
  isTread(req) ||
  deptLower(req) === "tread" ||
  deptLower(req) === "tread department" ||
  deptLower(req) === "treadt department";

const isHrDepartmentUser = (req) =>
  isHr(req) ||
  deptLower(req) === "hr" ||
  deptLower(req) === "hr department" ||
  deptLower(req) === "human resources" ||
  deptLower(req) === "human resources department";

const OPERATION_DEPTS = [
  "operation",
  "operations",
  "operation department",
  "operations department",
  "payroll",
];

const isOperationDepartment = (department) =>
  OPERATION_DEPTS.includes(norm(department));

const isTopManagement = (req) =>
  isAdmin(req) ||
  isIT(req) ||
  isHrDepartmentUser(req) ||
  isAccounting(req) ||
  isTreadDepartmentUser(req) ||
  isVicePresident(req) ||
  isSeniorVicePresident(req) ||
  isPresident(req);

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
  hr: "hr_status",
};

const normalizePosition = (position) =>
  norm(position)
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const getOperationStartStage = (oldPosition) => {
  const pos = normalizePosition(oldPosition);

  if (pos.includes("branch manager")) return "area manager";
  if (pos.includes("area manager")) return "regional manager";
  if (pos.includes("regional manager")) return "assistant vice president";
  if (pos.includes("assistant vice president")) return "vice president";
  if (pos.includes("vice president")) return "tread";

  return "branch manager";
};

const getOperationChain = (oldPosition) => {
  const full = [
    "branch manager",
    "area manager",
    "regional manager",
    "assistant vice president",
    "vice president",
    "tread",
    "hr",
  ];

  const start = getOperationStartStage(oldPosition);
  const idx = full.indexOf(start);

  return idx >= 0 ? full.slice(idx) : full;
};

const getPromotionChain = (department, oldPosition) => {
  const dept = norm(department);

  if (isOperationDepartment(dept)) {
    return getOperationChain(oldPosition);
  }

  if (dept === "it" || dept === "it department") {
    return ["assistant vice president", "hr"];
  }

  if (
    dept === "tread" ||
    dept === "tread department" ||
    dept === "treadt department"
  ) {
    return ["assistant vice president", "hr"];
  }

  if (
    dept === "hr" ||
    dept === "hr department" ||
    dept === "human resources" ||
    dept === "human resources department" ||
    dept === "accounting" ||
    dept === "accounting department"
  ) {
    return ["senior vice president"];
  }

  if (dept === "audit" || dept === "audit department") {
    return ["senior vice president", "hr"];
  }

  if (
    dept === "office of the president" ||
    dept === "production & logistic" ||
    dept === "production & logistic department" ||
    dept === "production and logistic" ||
    dept === "production and logistic department"
  ) {
    return ["hr"];
  }

  return ["hr"];
};

const getInitialApprovalStage = (department, oldPosition) =>
  getPromotionChain(department, oldPosition)[0];

const canRoleActAtStage = (req, stage) => {
  const role = roleLower(req);

  if (isAdmin(req) || isIT(req)) return true;

  if (stage === "branch manager") return role === "branch manager";
  if (stage === "area manager") return role === "area manager";
  if (stage === "regional manager") return role === "regional manager";
  if (stage === "assistant vice president") {
    return role === "assistant vice president";
  }
  if (stage === "vice president") return role === "vice president";
  if (stage === "senior vice president") return role === "senior vice president";
  if (stage === "tread") return isTreadDepartmentUser(req);
  if (stage === "hr") return isHrDepartmentUser(req);

  return false;
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

  return `${prefix}-${year}-${String(month).padStart(2, "0")}-${String(
    nextVal
  ).padStart(4, "0")}`;
}

router.get(
  "/promotion-orders",
  requireAuth,
  requirePermission("promotion_order", "view"),
  async (req, res) => {
    try {
      if (isTopManagement(req) || isAssistantVicePresident(req)) {
        const r = await pool.query(`
          SELECT *
          FROM public.promotion_orders
          ORDER BY created_at DESC
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
             OR po.approval_stage = 'branch manager'
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
          WHERE LOWER(TRIM(COALESCE(s.area, ''))) = LOWER(TRIM($1))
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
          WHERE LOWER(TRIM(COALESCE(s.region, ''))) = LOWER(TRIM($1))
             OR po.approval_stage = 'regional manager'
          ORDER BY po.created_at DESC
          `,
          [region]
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
  "/promotion-orders/staff/:id",
  requireAuth,
  requirePermission("promotion_order", "view"),
  async (req, res) => {
    try {
      const employeeId = toInt(req.params.id);

      if (!employeeId) {
        return res.status(400).json({ message: "Invalid staff id" });
      }

      const r = await pool.query(
        `
        SELECT *
        FROM public.promotion_orders
        WHERE employee_id = $1
        ORDER BY created_at DESC
        `,
        [employeeId]
      );

      return res.json(r.rows);
    } catch (e) {
      console.error("GET /api/promotion-orders/staff/:id ERROR:", e);
      return res.status(500).json({ message: e?.message || "Server error" });
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
        return res.status(400).json({
          message: "Promotion request file is required",
        });
      }

      const staffRes = await client.query(
        `
        SELECT
          id,
          fullname,
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

      if (isBranchManager(req)) {
        const bid = await getUserBranchId(req);
        if (!bid || Number(staffRow.branch_id) !== Number(bid)) {
          await client.query("ROLLBACK");
          return res.status(403).json({ message: "Access denied" });
        }
      }

      if (isAreaManager(req)) {
        const area = getUserArea(req);
        if (!area || norm(staffRow.area) !== norm(area)) {
          await client.query("ROLLBACK");
          return res.status(403).json({ message: "Access denied" });
        }
      }

      if (isRegionalManager(req)) {
        const region = getUserRegion(req);
        if (!region || norm(staffRow.region) !== norm(region)) {
          await client.query("ROLLBACK");
          return res.status(403).json({ message: "Access denied" });
        }
      }

      if (isAssistantVicePresident(req)) {
        const division = getUserDivision(req);
        if (division && norm(staffRow.division) !== norm(division)) {
          await client.query("ROLLBACK");
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const attachment_path = `/uploads/promotion-orders/${req.file.filename}`;
      const attachment_name = req.file.originalname || null;
      const attachment_mime = req.file.mimetype || null;

      const applicantRole = roleLower(req);
      const approvalStage = getInitialApprovalStage(department, currentPosition);
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
          message:
            "Please upload the signed/approved promotion file before approving.",
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

      if (norm(order.status) === "approved" || norm(order.status) === "rejected") {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Order already finalized" });
      }

      const department = toStr(order.department);
      const chain = getPromotionChain(department, order.old_position);
      let currentStage = norm(order.approval_stage);

      if (!chain.includes(currentStage)) {
        currentStage = chain[0];
      }

      if (!canRoleActAtStage(req, currentStage)) {
        await client.query("ROLLBACK");
        return res.status(403).json({ message: "Not your approval stage" });
      }

      const column = STAGE_COLUMN[currentStage];

      if (!column) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Invalid approval stage" });
      }

      const latestPath = `/uploads/promotion-orders/${req.file.filename}`;
      const latestName = req.file.originalname || null;
      const latestMime = req.file.mimetype || null;

      const currentIndex = chain.indexOf(currentStage);
      const nextStage = chain[currentIndex + 1];

      if (!nextStage) {
        await client.query(
          `
          UPDATE public.promotion_orders
          SET
            status='Approved',
            ${column}='Approved',
            final_status='Approved',
            approved_by=$2,
            approved_at=NOW(),
            rejected_by=NULL,
            rejected_at=NULL,
            rejection_reason=NULL,
            approval_stage=NULL,
            attachment_path=$3,
            attachment_name=$4,
            attachment_mime=$5,
            approved_attachment_path=$3,
            approved_attachment_name=$4,
            approved_attachment_mime=$5
          WHERE id=$1
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

        return res.json({
          message: "Promotion finalized and staff updated.",
        });
      }

      const extraFields = [];

      if (currentStage === "tread") {
        extraFields.push(`tread_approved_by=$6`, `tread_approved_at=NOW()`);
      }

      if (currentStage === "hr") {
        extraFields.push(`hr_approved_by=$6`, `hr_approved_at=NOW()`);
      }

      const updateParams = [
        id,
        nextStage,
        latestPath,
        latestName,
        latestMime,
      ];

      if (extraFields.length) {
        updateParams.push(req.user?.id ?? null);
      }

      await client.query(
        `
        UPDATE public.promotion_orders
        SET
          ${column}='Approved',
          approval_stage=$2,
          rejected_by=NULL,
          rejected_at=NULL,
          rejection_reason=NULL,
          attachment_path=$3,
          attachment_name=$4,
          attachment_mime=$5
          ${extraFields.length ? `, ${extraFields.join(", ")}` : ""}
        WHERE id=$1
        `,
        updateParams
      );

      await client.query("COMMIT");

      return res.json({
        message: `Promotion approved. Moved to ${nextStage}.`,
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
  "/promotion-orders/:id/final-upload",
  requireAuth,
  requirePermission("promotion_order", "upload_approved"),
  upload.single("attachment"),
  async (_req, res) => {
    return res.status(400).json({
      message:
        "Final upload is no longer used. Approve the current stage with an uploaded file instead.",
    });
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

      if (norm(order.status) === "approved" || norm(order.status) === "rejected") {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Order already finalized" });
      }

      const department = toStr(order.department);
      const chain = getPromotionChain(department, order.old_position);
      let currentStage = norm(order.approval_stage);

      if (!chain.includes(currentStage)) {
        currentStage = chain[0];
      }

      if (!canRoleActAtStage(req, currentStage)) {
        await client.query("ROLLBACK");
        return res.status(403).json({ message: "Not your approval stage" });
      }

      const column = STAGE_COLUMN[currentStage];

      await client.query(
        `
        UPDATE public.promotion_orders
        SET
          status='Rejected',
          ${column}='Rejected',
          rejected_by=$2,
          rejected_at=NOW(),
          rejection_reason=$3,
          approved_by=NULL,
          approved_at=NULL
        WHERE id=$1
        `,
        [id, req.user?.id ?? null, reason]
      );

      await client.query("COMMIT");
      return res.json({ message: "Promotion rejected" });
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("PUT /api/promotion-orders/:id/reject ERROR:", e);
      return res.status(500).json({ message: e?.message || "Server error" });
    } finally {
      client.release();
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

      if (!id) {
        return res.status(400).json({ message: "Invalid id" });
      }

      if (!["request", "approved", "latest"].includes(type)) {
        return res.status(400).json({ message: "Invalid attachment type" });
      }

      const r = await pool.query(
        `
        SELECT
          id,
          attachment_path,
          attachment_name,
          approved_attachment_path,
          approved_attachment_name
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

      let targetPath = row.attachment_path;
      let targetName = row.attachment_name;

      if (type === "approved") {
        targetPath = row.approved_attachment_path || row.attachment_path;
        targetName = row.approved_attachment_name || row.attachment_name;
      }

      if (!targetPath) {
        return res.status(404).json({ message: "No promotion file found" });
      }

      const rel = String(targetPath).replace(/^\/uploads\//, "");
      const filePath = path.join(__dirname, "..", "uploads", rel);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "File not found" });
      }

      return res.download(filePath, targetName || path.basename(filePath));
    } catch (e) {
      console.error("GET /api/promotion-orders/:id/download/:type ERROR:", e);
      return res.status(500).json({ message: e?.message || "Server error" });
    }
  }
);

module.exports = router; 