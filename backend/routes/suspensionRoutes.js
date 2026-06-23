const express = require("express");
const router = express.Router();
const pool = require("../db");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

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

const toNum = (v) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const toDate = (v) => {
  const s = String(v ?? "").trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};

const clean = (v) => String(v ?? "").trim();
const toStr = (v) => String(v ?? "").trim();

const getUserBranchId = (req) => req.user?.branch_id ?? null;
const getUserArea = (req) => toStr(req.user?.area);
const getUserRegion = (req) => toStr(req.user?.region);
const getUserDivision = (req) => toStr(req.user?.division);

const isOfficeOfThePresidentUser = (req) =>
  String(
    req.user?.department ||
      req.user?.department_name ||
      req.user?.departmentName ||
      req.user?.user_department ||
      req.user?.dept ||
      ""
  )
    .toLowerCase()
    .includes("office of the president");

const isHrDepartmentUser = (req) =>
  String(
    req.user?.department ||
    req.user?.department_name ||
    ""
  )
    .toLowerCase()
    .includes("hr");

const isAccountingDepartmentUser = (req) =>
  String(
    req.user?.department ||
    req.user?.department_name ||
    ""
  )
    .toLowerCase()
    .includes("accounting");

const isITDepartmentManager = (req) => {
  const dept = String(
    req.user?.department ||
      req.user?.department_name ||
      req.user?.departmentName ||
      req.user?.user_department ||
      req.user?.dept ||
      ""
  ).toLowerCase();

  return (
    dept === "it department" &&
    (
      isBranchManager(req) ||
      isAreaManager(req) ||
      isRegionalManager(req) ||
      isAssistantVicePresident(req) ||
      isVicePresident(req) ||
      isSeniorVicePresident(req)
    )
  );
};

const isHRDepartmentManager = (req) => {
  const dept = String(
    req.user?.department ||
    req.user?.department_name ||
    req.user?.departmentName ||
    req.user?.user_department ||
    req.user?.dept ||
    ""
  ).toLowerCase();

  return (
    dept === "hr department" &&
    (
      isBranchManager(req) ||
      isAreaManager(req) ||
      isRegionalManager(req) ||
      isAssistantVicePresident(req) ||
      isVicePresident(req) ||
      isSeniorVicePresident(req)
    )
  );
};

const uploadRoot = path.join(process.cwd(), "uploads");
const suspensionUploadDir = path.join(uploadRoot, "suspension");

if (!fs.existsSync(suspensionUploadDir)) {
  fs.mkdirSync(suspensionUploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, suspensionUploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    const base = path
      .basename(file.originalname || "file", ext)
      .replace(/[^a-zA-Z0-9-_]/g, "_");
    cb(null, `${Date.now()}-${base}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
});

const removeStoredFile = (storedPath) => {
  try {
    if (!storedPath) return;
    const fullPath = path.join(process.cwd(), storedPath.replace(/^\/+/, ""));
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
  } catch (e) {
    console.error("removeStoredFile ERROR:", e.message);
  }
};

const STAGE_AREA = "area manager";
const STAGE_RM = "regional manager";
const STAGE_AVP = "assistant vice president";
const STAGE_ADMIN = "admin";

const LABELS = {
  [STAGE_AREA]: "Pending Area Manager",
  [STAGE_RM]: "Pending Regional Manager",
  [STAGE_AVP]: "Pending Assistant Vice President",
  [STAGE_ADMIN]: "Pending Admin/HR/Accounting",
};

const getCurrentStage = (row) => {
  const explicit = toStr(row?.approval_stage).toLowerCase();

  if ([STAGE_AREA, STAGE_RM, STAGE_AVP, STAGE_ADMIN].includes(explicit)) {
    return explicit;
  }

  if (toStr(row?.area_manager_status).toLowerCase() !== "approved") {
    return STAGE_AREA;
  }

  if (toStr(row?.regional_manager_status).toLowerCase() !== "approved") {
    return STAGE_RM;
  }

  if (
    toStr(row?.assistant_vice_president_status).toLowerCase() !== "approved"
  ) {
    return STAGE_AVP;
  }

  if (toStr(row?.admin_status).toLowerCase() !== "approved") {
    return STAGE_ADMIN;
  }

  return STAGE_ADMIN;
};

const canAccessStaffRecord = (req, staff) => {
  if (
    isAdmin(req) ||
    isIT(req) ||
    isHr(req) ||
    isHrDepartmentUser(req) ||
    isHRDepartmentManager(req) ||
    isAccounting(req) ||
    isAccountingDepartmentUser(req) ||
    isOfficeOfThePresidentUser(req) ||
    isITDepartmentManager(req) ||
    isTread(req) ||
    isVicePresident(req) ||
    isSeniorVicePresident(req) ||
    isPresident(req)
  ) {
    return true;
  }

  if (isBranchManager(req)) {
    const bid = toInt(getUserBranchId(req));
    return !!bid && Number(staff.branch_id) === Number(bid);
  }

  if (isAreaManager(req)) {
    const area = getUserArea(req);
    return !!area && toStr(staff.area).toLowerCase() === area.toLowerCase();
  }

  if (isRegionalManager(req)) {
    const region = getUserRegion(req);
    return !!region && toStr(staff.region).toLowerCase() === region.toLowerCase();
  }

  if (isAssistantVicePresident(req)) {
    const division = getUserDivision(req);
    return !!division && toStr(staff.division).toLowerCase() === division.toLowerCase();
  }

  return false;
};

const canMutatePendingOrder = (req, row) => {
  if (
    isAdmin(req) ||
    isIT(req) ||
    isHr(req) ||
    isHrDepartmentUser(req) ||
    isHRDepartmentManager(req) ||
    isAccounting(req) ||
    isITDepartmentManager(req) ||
    isAccountingDepartmentUser(req)
  ) return true;

  if (isBranchManager(req)) {
    const bid = toInt(getUserBranchId(req));
    return !!bid && Number(row.branch_id) === Number(bid);
  }

  if (isAreaManager(req)) {
    const area = getUserArea(req);
    return !!area && toStr(row.area).toLowerCase() === area.toLowerCase();
  }

  if (isRegionalManager(req)) {
    const region = getUserRegion(req);
    return !!region && toStr(row.region).toLowerCase() === region.toLowerCase();
  }

  if (isAssistantVicePresident(req)) {
    const division = getUserDivision(req);
    return !!division && toStr(row.division).toLowerCase() === division.toLowerCase();
  }

  if (isVicePresident(req) || isSeniorVicePresident(req) || isPresident(req)) {
    return true;
  }

  return false;
};

const canDownloadRequestFile = (req) =>
  isRegionalManager(req) ||
  isAssistantVicePresident(req) ||
  isAdmin(req) ||
  isIT(req) ||
  isHr(req) ||
  isHrDepartmentUser(req) ||
  isHRDepartmentManager(req) ||
  isAccounting(req) ||
  isITDepartmentManager(req) ||
  isAccountingDepartmentUser(req);

const canDownloadApprovedFile = (req, row) => {
  if (
    isAdmin(req) ||
    isIT(req) ||
    isHr(req) ||
    isHrDepartmentUser(req) ||
    isHRDepartmentManager(req) ||
    isAccounting(req) ||
    isITDepartmentManager(req) ||
    isAccountingDepartmentUser(req)
  ) return true;

  if (isRegionalManager(req)) return true;
  if (isAssistantVicePresident(req)) return true;

  if (
    isAreaManager(req) &&
    String(row?.status || "").toLowerCase() === "approved"
  ) {
    return true;
  }

  return false;
};

const canUploadApprovedFile = (req) =>
  isAdmin(req) ||
  isIT(req) ||
  isHr(req) ||
  isHrDepartmentUser(req) ||
  isHRDepartmentManager(req) ||
  isAccounting(req) ||
  isITDepartmentManager(req) ||
  isAccountingDepartmentUser(req);

router.get(
  "/suspension-orders",
  requireAuth,
  requirePermission("suspension_order", "view"),
  async (req, res) => {
    try {
      if (
        isAdmin(req) ||
        isIT(req) ||
        isHr(req) ||
        isHrDepartmentUser(req) ||
        isHRDepartmentManager(req) ||
        isAccounting(req) ||
        isAccountingDepartmentUser(req) ||
        isOfficeOfThePresidentUser(req) ||
        isITDepartmentManager(req) ||
        isTread(req) ||
        isVicePresident(req) ||
        isSeniorVicePresident(req) ||
        isPresident(req)
      ) {
        const r = await pool.query(`
          SELECT *
          FROM public.suspension_orders
          ORDER BY id DESC
        `);

        return res.json(r.rows);
      }

      if (isBranchManager(req)) {
        const bid = toInt(getUserBranchId(req));
        if (!bid) return res.json([]);

        const r = await pool.query(
          `
          SELECT so.*
          FROM public.suspension_orders so
          LEFT JOIN public.staff s ON s.id = so.employee_id
          WHERE s.branch_id = $1
          ORDER BY so.id DESC
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
          SELECT so.*
          FROM public.suspension_orders so
          LEFT JOIN public.staff s ON s.id = so.employee_id
          WHERE LOWER(TRIM(COALESCE(s.area, ''))) = LOWER(TRIM($1))
          ORDER BY so.id DESC
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
          SELECT so.*
          FROM public.suspension_orders so
          LEFT JOIN public.staff s ON s.id = so.employee_id
          WHERE LOWER(TRIM(COALESCE(s.region, so.region, ''))) = LOWER(TRIM($1))
          ORDER BY so.id DESC
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
          SELECT so.*
          FROM public.suspension_orders so
          LEFT JOIN public.staff s ON s.id = so.employee_id
          WHERE LOWER(TRIM(COALESCE(s.division, so.division, ''))) = LOWER(TRIM($1))
          ORDER BY so.id DESC
          `,
          [division]
        );

        return res.json(r.rows);
      }

      return res.status(403).json({ message: "Access denied" });
    } catch (e) {
      console.error("GET /api/suspension-orders ERROR:", e);
      return res.status(500).json({ message: e?.message || "Server error" });
    }
  }
);

router.get(
  "/suspension-orders/staff/:id",
  requireAuth,
  requirePermission("suspension_order", "view"),
  async (req, res) => {
    try {
      const employeeId = toInt(req.params.id);

      if (!employeeId) {
        return res.status(400).json({ message: "Invalid staff id" });
      }

      const s = await pool.query(
        `
        SELECT id, branch_id, region, area, division
        FROM public.staff
        WHERE id = $1
        `,
        [employeeId]
      );

      if (s.rowCount === 0) {
        return res.status(404).json({ message: "Staff not found" });
      }

      const staff = s.rows[0];

      if (!canAccessStaffRecord(req, staff)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const r = await pool.query(
        `
        SELECT *
        FROM public.suspension_orders
        WHERE employee_id = $1
        ORDER BY id DESC
        `,
        [employeeId]
      );

      return res.json(r.rows);
    } catch (e) {
      console.error("GET /api/suspension-orders/staff/:id ERROR:", e.message);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

router.post(
  "/suspension-orders",
  requireAuth,
  requirePermission("suspension_order", "create"),
  upload.single("attachment"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const employee_id = toInt(req.body?.employee_id);
      const reason = clean(req.body?.reason);
      const details = clean(req.body?.details);
      const suspension_type = clean(req.body?.suspension_type);

      const start_date = toDate(
        req.body?.suspension_start ?? req.body?.start_date
      );

      const end_date = toDate(req.body?.suspension_end ?? req.body?.end_date);

      const days_of_suspension = toNum(req.body?.days_of_suspension);
      const basic_salary = toNum(req.body?.basic_salary);
      const ecola = toNum(req.body?.ecola);
      const transportation = toNum(req.body?.transportation);

      const prorated_salary = toNum(req.body?.prorated_salary);
      const prorated_ecola = toNum(req.body?.prorated_ecola);
      const prorated_transportation = toNum(req.body?.prorated_transportation);
      const prorated_repairing = toNum(req.body?.prorated_repairing);
      const prorated_allowance = toNum(req.body?.prorated_allowance);
      const prorated_postage = toNum(req.body?.prorated_postage);
      const total_deduction = toNum(req.body?.total_deduction);

      const attachment_path = req.file
        ? `/uploads/suspension/${req.file.filename}`
        : null;
      const attachment_name = req.file ? clean(req.file.originalname) : null;
      const attachment_mime = req.file ? clean(req.file.mimetype) : null;

      if (!employee_id) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Employee is required" });
      }

      if (!suspension_type) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Suspension type is required" });
      }

      if (!start_date) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Start date is required" });
      }

      if (!end_date) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "End date is required" });
      }

      if (days_of_suspension <= 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: "Days of suspension is required",
        });
      }

      if (!reason) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Reason is required" });
      }

      const s = await client.query(
        `
        SELECT
          id,
          fullname,
          first_name,
          last_name,
          middle_name,
          branch_id,
          region,
          area,
          division
        FROM public.staff
        WHERE id = $1
        `,
        [employee_id]
      );

      if (s.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Staff not found" });
      }

      const staff = s.rows[0];

      if (!canAccessStaffRecord(req, staff)) {
        await client.query("ROLLBACK");
        return res.status(403).json({ message: "Access denied" });
      }

      const employee_name =
        clean(req.body?.employee_name) || clean(staff.fullname);

      const seq = await client.query(
        `SELECT nextval('public.suspension_orders_id_seq') AS n`
      );

      const n = Number(seq.rows?.[0]?.n || 0);
      const order_no = `SUS-${String(n).padStart(6, "0")}`;

      let initialStage = STAGE_AREA;
      let areaStatus = "Pending";
      let regionalStatus = "Pending";
      let avpStatus = "Pending";
      let adminStatus = "Pending";

      if (
        isAdmin(req) ||
        isIT(req) ||
        isHr(req) ||
        isHrDepartmentUser(req) ||
        isHRDepartmentManager(req) ||
        isAccounting(req) ||
        isAccountingDepartmentUser(req)
      ) {
        initialStage = STAGE_ADMIN;
      } else if (
        isAssistantVicePresident(req) ||
        isVicePresident(req) ||
        isSeniorVicePresident(req) ||
        isPresident(req)
      ) {
        initialStage = STAGE_AVP;
      } else if (isRegionalManager(req)) {
        initialStage = STAGE_RM;
      }

      const createdBy = toInt(req.user?.id);

      const ins = await client.query(
        `
        INSERT INTO public.suspension_orders
          (
            id,
            order_no,
            employee_id,
            employee_name,
            suspension_type,
            reason,
            start_date,
            end_date,
            days_of_suspension,
            basic_salary,
            ecola,
            transportation,
            prorated_salary,
            prorated_ecola,
            prorated_transportation,
            prorated_repairing,
            prorated_allowance,
            prorated_postage,
            total_deduction,
            details,
            attachment_path,
            attachment_name,
            attachment_mime,
            approved_attachment_path,
            approved_attachment_name,
            approved_attachment_mime,
            approval_stage,
            area_manager_status,
            regional_manager_status,
            assistant_vice_president_status,
            admin_status,
            status,
            created_by,
            last_name,
            first_name,
            middle_name,
            area,
            region,
            division,
            branch_id
          )
        VALUES
          (
            $1, $2, $3, $4, $5, $6, $7::date, $8::date, $9, $10, $11, $12,
            $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23,
            NULL, NULL, NULL,
            $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37
          )
        RETURNING *;
        `,
        [
          n,
          order_no,
          employee_id,
          employee_name,
          suspension_type,
          reason,
          start_date,
          end_date,
          days_of_suspension,
          basic_salary,
          ecola,
          transportation,
          prorated_salary,
          prorated_ecola,
          prorated_transportation,
          prorated_repairing,
          prorated_allowance,
          prorated_postage,
          total_deduction,
          details || null,
          attachment_path,
          attachment_name,
          attachment_mime,
          initialStage,
          areaStatus,
          regionalStatus,
          avpStatus,
          adminStatus,
          LABELS[initialStage],
          createdBy,
          clean(staff.last_name),
          clean(staff.first_name),
          clean(staff.middle_name),
          clean(staff.area),
          clean(staff.region),
          clean(staff.division),
          staff.branch_id || null,
        ]
      );

      await client.query("COMMIT");
      return res.json(ins.rows[0]);
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("POST /api/suspension-orders ERROR:", e.message);
      return res.status(500).json({ message: e?.message || "Server error" });
    } finally {
      client.release();
    }
  }
);

router.put(
  "/suspension-orders/:id",
  requireAuth,
  requirePermission("suspension_order", "edit"),
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

      const existingRes = await client.query(
        `
        SELECT *
        FROM public.suspension_orders
        WHERE id = $1
        `,
        [id]
      );

      if (existingRes.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Suspension order not found" });
      }

      const existing = existingRes.rows[0];

      if (String(existing.status || "").toLowerCase() === "approved") {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: "Approved orders cannot be edited",
        });
      }

      if (!canMutatePendingOrder(req, existing)) {
        await client.query("ROLLBACK");
        return res.status(403).json({ message: "Access denied" });
      }

      const employee_id = toInt(req.body?.employee_id);
      const reason = clean(req.body?.reason);
      const details = clean(req.body?.details);
      const suspension_type = clean(req.body?.suspension_type);

      const start_date = toDate(
        req.body?.suspension_start ?? req.body?.start_date
      );

      const end_date = toDate(req.body?.suspension_end ?? req.body?.end_date);

      const days_of_suspension = toNum(req.body?.days_of_suspension);
      const basic_salary = toNum(req.body?.basic_salary);
      const ecola = toNum(req.body?.ecola);
      const transportation = toNum(req.body?.transportation);

      const prorated_salary = toNum(req.body?.prorated_salary);
      const prorated_ecola = toNum(req.body?.prorated_ecola);
      const prorated_transportation = toNum(req.body?.prorated_transportation);
      const prorated_repairing = toNum(req.body?.prorated_repairing);
      const prorated_allowance = toNum(req.body?.prorated_allowance);
      const prorated_postage = toNum(req.body?.prorated_postage);
      const total_deduction = toNum(req.body?.total_deduction);

      if (!employee_id) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Employee is required" });
      }

      if (!suspension_type) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Suspension type is required" });
      }

      if (!start_date) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Start date is required" });
      }

      if (!end_date) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "End date is required" });
      }

      if (days_of_suspension <= 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: "Days of suspension is required",
        });
      }

      if (!reason) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Reason is required" });
      }

      const staffRes = await client.query(
        `
        SELECT
          id,
          fullname,
          first_name,
          last_name,
          middle_name,
          branch_id,
          region,
          area,
          division
          FROM public.staff
        WHERE id = $1
        `,
        [employee_id]
      );

      if (staffRes.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Staff not found" });
      }

      const staff = staffRes.rows[0];

      if (!canAccessStaffRecord(req, staff)) {
        await client.query("ROLLBACK");
        return res.status(403).json({ message: "Access denied" });
      }

      let attachment_path = existing.attachment_path;
      let attachment_name = existing.attachment_name;
      let attachment_mime = existing.attachment_mime;

      if (req.file) {
        attachment_path = `/uploads/suspension/${req.file.filename}`;
        attachment_name = clean(req.file.originalname);
        attachment_mime = clean(req.file.mimetype);
      }

      const employee_name =
        clean(req.body?.employee_name) || clean(staff.fullname);

      const upd = await client.query(
        `
        UPDATE public.suspension_orders
        SET
          employee_id = $2,
          employee_name = $3,
          suspension_type = $4,
          reason = $5,
          start_date = $6::date,
          end_date = $7::date,
          days_of_suspension = $8,
          basic_salary = $9,
          ecola = $10,
          transportation = $11,
          prorated_salary = $12,
          prorated_ecola = $13,
          prorated_transportation = $14,
          prorated_repairing = $15,
          prorated_allowance = $16,
          prorated_postage = $17,
          total_deduction = $18,
          details = $19,
          attachment_path = $20,
          attachment_name = $21,
          attachment_mime = $22,
          last_name = $23,
          first_name = $24,
          middle_name = $25,
          area = $26,
          region = $27,
          division = $28,
          branch_id = $29
        WHERE id = $1
        RETURNING *;
        `,
        [
          id,
          employee_id,
          employee_name,
          suspension_type,
          reason,
          start_date,
          end_date,
          days_of_suspension,
          basic_salary,
          ecola,
          transportation,
          prorated_salary,
          prorated_ecola,
          prorated_transportation,
          prorated_repairing,
          prorated_allowance,
          prorated_postage,
          total_deduction,
          details || null,
          attachment_path,
          attachment_name,
          attachment_mime,
          clean(staff.last_name),
          clean(staff.first_name),
          clean(staff.middle_name),
          clean(staff.area),
          clean(staff.region),
          clean(staff.division),
          staff.branch_id || null,
        ]
      );

      await client.query("COMMIT");

      if (
        req.file &&
        existing.attachment_path &&
        existing.attachment_path !== attachment_path
      ) {
        removeStoredFile(existing.attachment_path);
      }

      return res.json(upd.rows[0]);
    } catch (e) {
      await client.query("ROLLBACK");

      if (req.file) {
        removeStoredFile(`/uploads/suspension/${req.file.filename}`);
      }

      console.error("PUT /api/suspension-orders/:id ERROR:", e.message);
      return res.status(500).json({ message: e?.message || "Server error" });
    } finally {
      client.release();
    }
  }
);

router.delete(
  "/suspension-orders/:id",
  requireAuth,
  requirePermission("suspension_order", "delete"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const id = toInt(req.params.id);

      if (!id) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Invalid id" });
      }

      const existingRes = await client.query(
        `SELECT * FROM public.suspension_orders WHERE id = $1`,
        [id]
      );

      if (existingRes.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Suspension order not found" });
      }

      const existing = existingRes.rows[0];

      if (String(existing.status || "").toLowerCase() === "approved") {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: "Approved orders cannot be deleted",
        });
      }

      if (!canMutatePendingOrder(req, existing)) {
        await client.query("ROLLBACK");
        return res.status(403).json({ message: "Access denied" });
      }

      await client.query(`DELETE FROM public.suspension_orders WHERE id = $1`, [
        id,
      ]);

      await client.query("COMMIT");

      if (existing.attachment_path) removeStoredFile(existing.attachment_path);

      if (existing.approved_attachment_path) {
        removeStoredFile(existing.approved_attachment_path);
      }

      return res.json({ message: "Suspension order deleted successfully" });
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("DELETE /api/suspension-orders/:id ERROR:", e.message);
      return res.status(500).json({ message: e?.message || "Server error" });
    } finally {
      client.release();
    }
  }
);

router.get(
  "/suspension-orders/:id/download/:type",
  requireAuth,
  requirePermission("suspension_order", "view"),
  async (req, res) => {
    try {
      const id = toInt(req.params.id);
      const type = clean(req.params.type).toLowerCase();

      if (!id) return res.status(400).json({ message: "Invalid id" });

      if (!["request", "approved"].includes(type)) {
        return res.status(400).json({ message: "Invalid file type" });
      }

      const r = await pool.query(
        `SELECT * FROM public.suspension_orders WHERE id = $1`,
        [id]
      );

      if (r.rowCount === 0) {
        return res.status(404).json({
          message: "Suspension order not found",
        });
      }

      const row = r.rows[0];

      if (type === "request" && !canDownloadRequestFile(req)) {
        return res.status(403).json({ message: "Access denied" });
      }

      if (type === "approved" && !canDownloadApprovedFile(req, row)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const storedPath =
        type === "request" ? row.attachment_path : row.approved_attachment_path;

      const storedName =
        type === "request" ? row.attachment_name : row.approved_attachment_name;

      if (!storedPath) {
        return res.status(404).json({ message: "No attachment found" });
      }

      const filePath = path.join(process.cwd(), storedPath.replace(/^\/+/, ""));

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "Stored file not found" });
      }

      return res.download(filePath, storedName || path.basename(filePath));
    } catch (e) {
      console.error(
        "GET /api/suspension-orders/:id/download/:type ERROR:",
        e.message
      );

      return res.status(500).json({ message: "Server error" });
    }
  }
);

router.post(
  "/suspension-orders/:id/approved-file",
  requireAuth,
  requirePermission("suspension_order", "upload_approved"),
  upload.single("attachment"),
  async (req, res) => {
    try {
      const id = toInt(req.params.id);

      if (!id) return res.status(400).json({ message: "Invalid id" });

      if (!req.file) {
        return res.status(400).json({ message: "Attachment is required" });
      }

      if (!canUploadApprovedFile(req)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const existing = await pool.query(
        `SELECT * FROM public.suspension_orders WHERE id = $1`,
        [id]
      );

      if (existing.rowCount === 0) {
        return res.status(404).json({
          message: "Suspension order not found",
        });
      }

      const row = existing.rows[0];
      const oldApprovedPath = row.approved_attachment_path || null;
      const newPath = `/uploads/suspension/${req.file.filename}`;

      const result = await pool.query(
        `
        UPDATE public.suspension_orders
        SET
          approved_attachment_path = $2,
          approved_attachment_name = $3,
          approved_attachment_mime = $4
        WHERE id = $1
        RETURNING *;
        `,
        [
          id,
          newPath,
          clean(req.file.originalname),
          clean(req.file.mimetype),
        ]
      );

      if (oldApprovedPath && oldApprovedPath !== newPath) {
        removeStoredFile(oldApprovedPath);
      }

      return res.json(result.rows[0]);
    } catch (e) {
      console.error(
        "POST /api/suspension-orders/:id/approved-file ERROR:",
        e.message
      );

      return res.status(500).json({ message: e?.message || "Server error" });
    }
  }
);

router.put(
  "/suspension-orders/:id/approve",
  requireAuth,
  requirePermission("suspension_order", "approve"),
  async (req, res) => {
    try {
      const id = toInt(req.params.id);

      if (!id) return res.status(400).json({ message: "Invalid id" });

      const existingRes = await pool.query(
        `SELECT * FROM public.suspension_orders WHERE id = $1`,
        [id]
      );

      if (existingRes.rowCount === 0) {
        return res.status(404).json({
          message: "Suspension order not found",
        });
      }

      const row = existingRes.rows[0];
      const currentStage = getCurrentStage(row);
      const approverId = toInt(req.user?.id);
      const approverText = String(approverId || "");

      let result;

      if (isAreaManager(req) && !isHRDepartmentManager(req)) {
        if (currentStage !== STAGE_AREA) {
          return res.status(400).json({
            message: "This order is not pending Area Manager approval",
          });
        }

        result = await pool.query(
          `
          UPDATE public.suspension_orders
          SET
            area_manager_status = 'Approved',
            area_manager_approved_by = $2,
            area_manager_approved_at = NOW(),
            approval_stage = $3,
            status = $4,
            rejected_by = NULL,
            rejected_at = NULL,
            rejection_reason = NULL
          WHERE id = $1
          RETURNING *;
          `,
          [id, approverId, STAGE_RM, LABELS[STAGE_RM]]
        );
      } else if (isRegionalManager(req)) {
        if (currentStage !== STAGE_RM) {
          return res.status(400).json({
            message: "This order is not pending Regional Manager approval",
          });
        }

        result = await pool.query(
          `
          UPDATE public.suspension_orders
          SET
            regional_manager_status = 'Approved',
            regional_manager_approved_by = $2,
            regional_manager_approved_at = NOW(),
            approval_stage = $3,
            status = $4,
            rejected_by = NULL,
            rejected_at = NULL,
            rejection_reason = NULL
          WHERE id = $1
          RETURNING *;
          `,
          [id, approverId, STAGE_AVP, LABELS[STAGE_AVP]]
        );
      } else if (isAssistantVicePresident(req)) {
        if (currentStage !== STAGE_AVP) {
          return res.status(400).json({
            message:
              "This order is not pending Assistant Vice President approval",
          });
        }

        result = await pool.query(
          `
          UPDATE public.suspension_orders
          SET
            assistant_vice_president_status = 'Approved',
            assistant_vice_president_approved_by = $2,
            assistant_vice_president_approved_at = NOW(),
            approval_stage = $3,
            status = $4,
            rejected_by = NULL,
            rejected_at = NULL,
            rejection_reason = NULL
          WHERE id = $1
          RETURNING *;
          `,
          [id, approverId, STAGE_ADMIN, LABELS[STAGE_ADMIN]]
        );
      } else if (
          isAdmin(req) ||
          isIT(req) ||
          isHr(req) ||
          isHRDepartmentManager(req) ||
          isAccounting(req) ||
          isAccountingDepartmentUser(req)
      ) {
        if (currentStage !== STAGE_ADMIN) {
          return res.status(400).json({
            message: "This order is not pending Admin/HR/Accounting approval",
          });
        }

        result = await pool.query(
          `
          UPDATE public.suspension_orders
          SET
            admin_status = 'Approved',
            admin_approved_by = $2,
            admin_approved_at = NOW(),
            approved_by = $3,
            approved_at = NOW(),
            approval_stage = $4,
            status = 'Approved',
            rejected_by = NULL,
            rejected_at = NULL,
            rejection_reason = NULL
          WHERE id = $1
          RETURNING *;
          `,
          [id, approverId, approverText, STAGE_ADMIN]
        );
      } else {
        return res.status(403).json({ message: "Access denied" });
      }

      if (result.rowCount === 0) {
        return res.status(400).json({
          message: "Not found or invalid approval stage",
        });
      }

      return res.json(result.rows[0]);
    } catch (e) {
      console.error("PUT /api/suspension-orders/:id/approve ERROR:", e.message);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

router.put(
  "/suspension-orders/:id/reject",
  requireAuth,
  requirePermission("suspension_order", "reject"),
  async (req, res) => {
    try {
      const id = toInt(req.params.id);

      if (!id) return res.status(400).json({ message: "Invalid id" });

      const reason = clean(req.body?.reason);

      if (!reason) {
        return res.status(400).json({
          message: "Rejection reason is required",
        });
      }

      const existingRes = await pool.query(
        `SELECT * FROM public.suspension_orders WHERE id = $1`,
        [id]
      );

      if (existingRes.rowCount === 0) {
        return res.status(404).json({
          message: "Suspension order not found",
        });
      }

      const row = existingRes.rows[0];
      const currentStage = getCurrentStage(row);
      const rejecterId = toInt(req.user?.id);

      let allowed = false;

      if (isAreaManager(req) && currentStage === STAGE_AREA) allowed = true;
      if (isRegionalManager(req) && currentStage === STAGE_RM) allowed = true;

      if (isAssistantVicePresident(req) && currentStage === STAGE_AVP) {
        allowed = true;
      }

      if (
        (
          isAdmin(req) ||
          isIT(req) ||
          isHr(req) ||
          isHRDepartmentManager(req) ||
          isAccounting(req) ||
          isAccountingDepartmentUser(req)
        ) &&
        currentStage === STAGE_ADMIN
      ) {
        allowed = true;
      }

      if (!allowed) {
        return res.status(403).json({ message: "Access denied" });
      }

      const r = await pool.query(
        `
        UPDATE public.suspension_orders
        SET
          status = 'Rejected',
          rejected_by = $2,
          rejected_at = NOW(),
          rejection_reason = $3,
          approved_by = NULL,
          approved_at = NULL
        WHERE id = $1
        RETURNING *;
        `,
        [id, rejecterId, reason]
      );

      return res.json(r.rows[0]);
    } catch (e) {
      console.error("PUT /api/suspension-orders/:id/reject ERROR:", e.message);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

module.exports = router;