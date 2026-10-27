//suspensionRoutes.js

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

  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return null;
  }

  const date = new Date(`${s}T00:00:00Z`);

  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== s
  ) {
    return null;
  }

  return s;
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

const isOperationDepartmentUser = (req) => {
  const dept = String(
    req.user?.department ||
      req.user?.department_name ||
      req.user?.departmentName ||
      req.user?.user_department ||
      req.user?.dept ||
      ""
  ).toLowerCase();

  return dept === "operation department";
};

const isAuditDepartmentUser = (req) => {
  const dept = String(
    req.user?.department ||
      req.user?.department_name ||
      req.user?.departmentName ||
      req.user?.user_department ||
      req.user?.dept ||
      ""
  )
    .trim()
    .toLowerCase();

  return (
    dept === "audit" ||
    dept === "audit department"
  );
};

const isOperationVicePresident = (req) =>
  isOperationDepartmentUser(req) &&
  isVicePresident(req);

const hasSuspensionFullAccess = (req) =>
  isAdmin(req) ||
  isIT(req) ||
  isHr(req) ||
  isHrDepartmentUser(req) ||
  isHRDepartmentManager(req) ||
  isAccounting(req) ||
  isAccountingDepartmentUser(req) ||
  isITDepartmentManager(req) ||
  isAuditDepartmentUser(req) ||
  isOperationVicePresident(req);

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

const STAGE_HR_ADMIN_ORDER = "hr admin order";
const STAGE_AVP_SIGNED_ORDER = "avp signed admin order";
const STAGE_HR_RECEIVED = "hr received";
const STAGE_RECEIVED = "received";

const LABELS = {
  [STAGE_AREA]: "Pending Area Manager",
  [STAGE_RM]: "Pending Regional Manager",
  [STAGE_AVP]: "Pending Assistant Vice President",
  [STAGE_ADMIN]: "Pending Admin/HR/Accounting",

  [STAGE_HR_ADMIN_ORDER]: "Wait for HR Admin Order",
  [STAGE_AVP_SIGNED_ORDER]: "Wait for AVP Signed Admin Order",
  [STAGE_HR_RECEIVED]: "Wait to Received",
  [STAGE_RECEIVED]: "Received",
};

const getCurrentStage = (row) => {
  const explicit = toStr(row?.approval_stage).toLowerCase();

  if (
    [
      STAGE_AREA,
      STAGE_RM,
      STAGE_AVP,
      STAGE_ADMIN,
      STAGE_HR_ADMIN_ORDER,
      STAGE_AVP_SIGNED_ORDER,
      STAGE_HR_RECEIVED,
      STAGE_RECEIVED,
    ].includes(explicit)
  ) {
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
    hasSuspensionFullAccess(req) ||
    isOfficeOfThePresidentUser(req) ||
    isTread(req) ||
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
  if (hasSuspensionFullAccess(req)) {
    return true;
  }

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
  hasSuspensionFullAccess(req) ||
  isRegionalManager(req) ||
  isAssistantVicePresident(req) ||
  isVicePresident(req);

const canDownloadApprovedFile = (req, row) => {
  if (hasSuspensionFullAccess(req)) {
    return true;
  }

  if (isRegionalManager(req)) return true;
  if (isAssistantVicePresident(req)) return true;
  if (isVicePresident(req)) return true;

  if (
    isAreaManager(req) &&
    ["approved", "received"].includes(
      String(row?.status || "").trim().toLowerCase()
    )
  ) {
    return true;
  }

  return false;
};

  // =====================================================
  // SUSPENSION STAFF STATUS LIFECYCLE
  // =====================================================
  async function applyDueSuspensions() {

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // =====================================================
      // 1. START ACTIVE SUSPENSIONS
      // Active -> Inactive
      // =====================================================
      const suspendedStaff = await client.query(`
        UPDATE public.staff s
        SET status = 'Inactive'
        WHERE LOWER(TRIM(COALESCE(s.status, ''))) = 'active'

          AND EXISTS (
            SELECT 1
            FROM public.suspension_orders so
            WHERE so.employee_id = s.id

              AND LOWER(TRIM(COALESCE(so.status, '')))
                IN ('approved', 'received')

              AND (NOW() AT TIME ZONE 'Asia/Manila')::date
                  >= so.start_date::date

              AND (NOW() AT TIME ZONE 'Asia/Manila')::date
                  <= so.end_date::date
          )

        RETURNING
          s.id,
          s.employee_no
      `);

      // =====================================================
      // RECORD SUSPENSION START IN STATUS HISTORY
      // =====================================================
      for (const staff of suspendedStaff.rows) {
        const suspensionRes = await client.query(
          `
          SELECT
            so.id,
            so.order_no,
            so.start_date,
            so.end_date,
            so.reason,
            so.details
          FROM public.suspension_orders so
          WHERE so.employee_id = $1

            AND LOWER(TRIM(COALESCE(so.status, '')))
              IN ('approved', 'received')

            AND (NOW() AT TIME ZONE 'Asia/Manila')::date
                >= so.start_date::date

            AND (NOW() AT TIME ZONE 'Asia/Manila')::date
                <= so.end_date::date

          ORDER BY
            so.start_date ASC,
            so.id ASC

          LIMIT 1
          `,
          [staff.id]
        );

        if (suspensionRes.rowCount > 0) {
          const suspension = suspensionRes.rows[0];

          await client.query(
            `
            INSERT INTO public.status_history
            (
              employee_no,
              effective_date,
              status,
              reason,
              remarks
            )
            SELECT
              $1::varchar,
              $2::date,
              'Inactive'::varchar,
              'Suspension'::varchar,
              $3::text
            WHERE NOT EXISTS (
              SELECT 1
              FROM public.status_history sh
              WHERE LOWER(TRIM(COALESCE(sh.employee_no, ''))) =
                    LOWER(TRIM(COALESCE($1::varchar, '')))

                AND sh.effective_date = $2::date

                AND LOWER(TRIM(COALESCE(sh.status, ''))) =
                    'inactive'

                AND LOWER(TRIM(COALESCE(sh.reason, ''))) =
                    'suspension'
            )
            `,
            [
              staff.employee_no,
              suspension.start_date,
              [
                suspension.order_no
                  ? `Suspension Order: ${suspension.order_no}`
                  : null,
                suspension.reason
                  ? `Reason: ${suspension.reason}`
                  : null,
                suspension.end_date
                  ? `Until: ${String(suspension.end_date).slice(0, 10)}`
                  : null,
                suspension.details
                  ? `Details: ${suspension.details}`
                  : null,
              ]
                .filter(Boolean)
                .join(" | "),
            ]
          );
        }
      }

      // =====================================================
      // 2. FIND STAFF WHOSE SUSPENSION HAS FINISHED
      //
      // IMPORTANT:
      // Only reactivate an employee when the latest relevant
      // inactive history is Suspension.
      // =====================================================
      const finishedStaff = await client.query(`
        SELECT DISTINCT
          s.id,
          s.employee_no
        FROM public.staff s

        WHERE LOWER(TRIM(COALESCE(s.status, ''))) = 'inactive'

          -- At least one approved suspension already finished
          AND EXISTS (
            SELECT 1
            FROM public.suspension_orders finished_so
            WHERE finished_so.employee_id = s.id

              AND LOWER(
                TRIM(
                  COALESCE(
                    finished_so.status,
                    ''
                  )
                )
              ) IN ('approved', 'received')

              AND (NOW() AT TIME ZONE 'Asia/Manila')::date
                  > finished_so.end_date::date
          )

          -- No approved suspension currently active
          AND NOT EXISTS (
            SELECT 1
            FROM public.suspension_orders active_so
            WHERE active_so.employee_id = s.id

              AND LOWER(
                TRIM(
                  COALESCE(
                    active_so.status,
                    ''
                  )
                )
              ) IN ('approved', 'received')

              AND (NOW() AT TIME ZONE 'Asia/Manila')::date
                  >= active_so.start_date::date

              AND (NOW() AT TIME ZONE 'Asia/Manila')::date
                  <= active_so.end_date::date
          )

          -- Do not reactivate exit transactions
          AND LOWER(
            TRIM(
              COALESCE(
                s.exit_type,
                ''
              )
            )
          ) NOT IN (
            'resigned',
            'resignation',
            'terminated',
            'termination',
            'awol',
            'deceased',
            'death'
          )

          -- Latest status history must show Suspension
          AND (
            SELECT LOWER(TRIM(COALESCE(sh.reason, '')))
            FROM public.status_history sh
            WHERE LOWER(TRIM(COALESCE(sh.employee_no, ''))) =
                  LOWER(TRIM(COALESCE(s.employee_no, '')))
            ORDER BY
              sh.effective_date DESC,
              sh.id DESC
            LIMIT 1
          ) = 'suspension'
      `);

      // =====================================================
      // 3. REACTIVATE FINISHED SUSPENSIONS
      // =====================================================
      for (const staff of finishedStaff.rows) {
        const finishedSuspensionRes = await client.query(
          `
          SELECT
            so.id,
            so.order_no,
            so.start_date,
            so.end_date,
            so.reason
          FROM public.suspension_orders so
          WHERE so.employee_id = $1

            AND LOWER(TRIM(COALESCE(so.status, '')))
              IN ('approved', 'received')

            AND (NOW() AT TIME ZONE 'Asia/Manila')::date
                > so.end_date::date

          ORDER BY
            so.end_date DESC,
            so.id DESC

          LIMIT 1
          `,
          [staff.id]
        );

        if (finishedSuspensionRes.rowCount === 0) {
          continue;
        }

        const suspension = finishedSuspensionRes.rows[0];

        await client.query(
          `
          UPDATE public.staff
          SET status = 'Active'
          WHERE id = $1
            AND LOWER(TRIM(COALESCE(status, ''))) = 'inactive'
          `,
          [staff.id]
        );

        // =====================================================
        // RECORD RETURN FROM SUSPENSION
        //
        // Effective Active date = day AFTER suspension end.
        // =====================================================
        await client.query(
          `
          INSERT INTO public.status_history
          (
            employee_no,
            effective_date,
            status,
            reason,
            remarks
          )
          SELECT
            $1::varchar,
            ($2::date + INTERVAL '1 day')::date,
            'Active'::varchar,
            'Suspension End'::varchar,
            $3::text

          WHERE NOT EXISTS (
            SELECT 1
            FROM public.status_history sh
            WHERE LOWER(TRIM(COALESCE(sh.employee_no, ''))) =
                  LOWER(TRIM(COALESCE($1::varchar, '')))

              AND sh.effective_date =
                  ($2::date + INTERVAL '1 day')::date

              AND LOWER(TRIM(COALESCE(sh.status, ''))) =
                  'active'

              AND LOWER(TRIM(COALESCE(sh.reason, ''))) =
                  'suspension end'
          )
          `,
          [
            staff.employee_no,
            suspension.end_date,
            suspension.order_no
              ? `Returned to Active after Suspension Order ${suspension.order_no}`
              : "Returned to Active after suspension",
          ]
        );
      }

      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");

      console.error("========== applyDueSuspensions ERROR ==========");
      console.error("message:", e.message);
      console.error("code:", e.code);
      console.error("detail:", e.detail);
      console.error("hint:", e.hint);
      console.error("where:", e.where);
      console.error("===============================================");

      throw e;
    } finally {
      client.release();
    }
  }

router.get(
  "/suspension-orders",
  requireAuth,
  requirePermission("suspension_order", "view"),
  async (req, res) => {
    try {
      await applyDueSuspensions();

      if (
        hasSuspensionFullAccess(req) ||
        isOfficeOfThePresidentUser(req) ||
        isTread(req) ||
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

      if (isVicePresident(req)) {
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

      if (
        isOperationDepartmentUser(req) &&
        (
          isBranchManager(req) ||
          isAreaManager(req) ||
          isRegionalManager(req) ||
          isAssistantVicePresident(req)
        )
      ) {
        await client.query("ROLLBACK");
        return res.status(403).json({
          message:
            "Operation Department Branch Manager to Assistant Vice President can only view suspension orders.",
        });
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

      const employee_name = clean(staff.fullname);

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

      if (hasSuspensionFullAccess(req)) {
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

      if (
        isOperationDepartmentUser(req) &&
        (
          isBranchManager(req) ||
          isAreaManager(req) ||
          isRegionalManager(req) ||
          isAssistantVicePresident(req)
        )
      ) {
        await client.query("ROLLBACK");
        return res.status(403).json({
          message: "Operation Department Branch Manager to Vice President can only view suspension orders.",
        });
      }

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

      if (
        ["approved", "received"].includes(
          String(existing.status || "").trim().toLowerCase()
        )
      ) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message: "Completed suspension orders cannot be edited",
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

      const employee_name = clean(staff.fullname);

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

// =====================================================
// EXTEND APPROVED / RECEIVED SUSPENSION
// WITH AUTOMATIC / MANUAL DEDUCTION COMPUTATION
// =====================================================

router.put(
  "/suspension-orders/:id/extend",
  requireAuth,
  requirePermission("suspension_order", "edit"),
  async (req, res) => {
    let client;
    let inTransaction = false;

    try {
      const id = toInt(req.params.id);

      const newEndDate = toDate(req.body?.new_end_date);

      const extensionReason = clean(
        req.body?.extension_reason
      );

      const canExtend =
        isAdmin(req) ||
        isIT(req) ||
        isHr(req) ||
        isHrDepartmentUser(req) ||
        isAccounting(req) ||
        isAccountingDepartmentUser(req);

      if (!id || id <= 0) {
        return res.status(400).json({
          message: "Invalid suspension order ID",
        });
      }

      if (!canExtend) {
        return res.status(403).json({
          message: "Not authorized to extend suspensions",
        });
      }

      if (!newEndDate) {
        return res.status(400).json({
          message: "New suspension end date is required",
        });
      }

      if (!extensionReason) {
        return res.status(400).json({
          message: "Extension reason is required",
        });
      }

      client = await pool.connect();

      await client.query("BEGIN");
      inTransaction = true;

      const existingRes = await client.query(
        `
          SELECT *
          FROM public.suspension_orders
          WHERE id = $1
          FOR UPDATE
        `,
        [id]
      );

      if (existingRes.rowCount === 0) {
        return res.status(404).json({
          message: "Suspension order not found",
        });
      }

      const existing = existingRes.rows[0];

      const status = clean(existing.status).toLowerCase();

      if (!["approved", "received"].includes(status)) {
        return res.status(400).json({
          message:
            "Only approved or received suspensions can be extended",
        });
      }

      const previousEndDate = toDate(existing.end_date);
      const startDate = toDate(existing.start_date);

      if (!previousEndDate || !startDate) {
        return res.status(400).json({
          message: "Invalid suspension dates",
        });
      }

      // =====================================================
      // VALIDATE SUSPENSION IS CURRENTLY ACTIVE
      // =====================================================

      const todayRes = await client.query(`
        SELECT
          (NOW() AT TIME ZONE 'Asia/Manila')::date::text
            AS today
      `);

      const today = todayRes.rows[0].today;

      // Suspension must have started and must not have expired.
      if (today < startDate) {
        return res.status(400).json({
          message:
            "Suspension has not started yet. Extension is not allowed.",
        });
      }

      if (today > previousEndDate) {
        return res.status(400).json({
          message:
            "Suspension has already expired. Extension is no longer allowed.",
        });
      }

      // =====================================================
      // VALIDATE EMPLOYEE IS CURRENTLY SUSPENDED
      // =====================================================

      const staffStatusRes = await client.query(
        `
          SELECT
            s.id,
            s.status,

            (
              SELECT LOWER(TRIM(COALESCE(sh.reason, '')))
              FROM public.status_history sh
              WHERE LOWER(TRIM(COALESCE(sh.employee_no, ''))) =
                    LOWER(TRIM(COALESCE(s.employee_no, '')))
                AND sh.effective_date <=
                    (NOW() AT TIME ZONE 'Asia/Manila')::date
              ORDER BY
                sh.effective_date DESC,
                sh.id DESC
              LIMIT 1
            ) AS latest_status_reason,

            (
              SELECT LOWER(TRIM(COALESCE(sh.status, '')))
              FROM public.status_history sh
              WHERE LOWER(TRIM(COALESCE(sh.employee_no, ''))) =
                    LOWER(TRIM(COALESCE(s.employee_no, '')))
                AND sh.effective_date <=
                    (NOW() AT TIME ZONE 'Asia/Manila')::date
              ORDER BY
                sh.effective_date DESC,
                sh.id DESC
              LIMIT 1
            ) AS latest_status

          FROM public.staff s
          WHERE s.id = $1
          FOR UPDATE OF s
        `,
        [existing.employee_id]
      );

      if (staffStatusRes.rowCount === 0) {
        return res.status(404).json({
          message: "Employee not found",
        });
      }

      const staffStatus = staffStatusRes.rows[0];

      if (
        clean(staffStatus.status).toLowerCase() !== "inactive" ||
        staffStatus.latest_status !== "inactive" ||
        staffStatus.latest_status_reason !== "suspension"
      ) {
        return res.status(400).json({
          message:
            "Extension is only allowed when the employee is currently Inactive due to Suspension.",
        });
      }

      // Calculate additional calendar days.
      const additionalDays = Math.round(
        (
          Date.parse(`${newEndDate}T00:00:00Z`) -
          Date.parse(`${previousEndDate}T00:00:00Z`)
        ) / 86400000
      );

      if (
        !Number.isFinite(additionalDays) ||
        additionalDays <= 0
      ) {
        return res.status(400).json({
          message:
            "New end date must be later than current end date",
        });
      }

      const previousDays = Number(
        existing.days_of_suspension
      );

      if (
        !Number.isFinite(previousDays) ||
        previousDays <= 0
      ) {
        return res.status(400).json({
          message:
            "Original suspension days must be greater than zero",
        });
      }

      const newDays = previousDays + additionalDays;

      // =====================================================
      // DEDUCTION COMPONENTS
      // =====================================================

      const fields = [
        "prorated_salary",
        "prorated_ecola",
        "prorated_transportation",
        "prorated_repairing",
        "prorated_allowance",
        "prorated_postage",
      ];

      const roundMoney = (n) =>
        Math.round((n + Number.EPSILON) * 100) / 100;

      const original = {};
      const updated = {};

      const adjustments = req.body?.adjusted_components;

      if (
        adjustments !== undefined &&
        (
          typeof adjustments !== "object" ||
          adjustments === null ||
          Array.isArray(adjustments) ||
          Object.keys(adjustments).some(
            (key) => !fields.includes(key)
          )
        )
      ) {
        return res.status(400).json({
          message: "Invalid adjusted deduction components",
        });
      }

      // =====================================================
      // AUTOMATIC CALCULATION
      //
      // Updated Amount =
      // Original Amount / Original Days * New Days
      //
      // Manual adjustments override automatic amounts.
      // =====================================================

      for (const field of fields) {
        const oldAmount = Number(existing[field] ?? 0);

        if (
          !Number.isFinite(oldAmount) ||
          oldAmount < 0
        ) {
          return res.status(400).json({
            message: `Invalid original ${field}`,
          });
        }

        original[field] = oldAmount;

        const automatic = roundMoney(
          (oldAmount / previousDays) * newDays
        );

        const manual =
          adjustments &&
          Object.prototype.hasOwnProperty.call(
            adjustments,
            field
          )
            ? adjustments[field]
            : undefined;

        if (
          manual !== undefined &&
          (
            manual === null ||
            manual === "" ||
            !Number.isFinite(Number(manual)) ||
            Number(manual) < 0
          )
        ) {
          return res.status(400).json({
            message: `Invalid adjustment for ${field}`,
          });
        }

        updated[field] =
          manual === undefined
            ? automatic
            : roundMoney(Number(manual));
      }

      // =====================================================
      // COMPUTE TOTAL DEDUCTIONS
      // =====================================================

      const previousTotal = roundMoney(
        fields.reduce(
          (sum, field) => sum + original[field],
          0
        )
      );

      const newTotal = roundMoney(
        fields.reduce(
          (sum, field) => sum + updated[field],
          0
        )
      );

      const additionalDeduction = roundMoney(
        newTotal - previousTotal
      );

      if (additionalDeduction < 0) {
        return res.status(400).json({
          message:
            "Updated total deduction cannot be lower than the original total deduction.",
        });
      }

      // =====================================================
      // UPDATE SUSPENSION
      // =====================================================

      const updatedRes = await client.query(
        `
          UPDATE public.suspension_orders
          SET
            end_date = $2::date,
            days_of_suspension = $3,

            prorated_salary = $4,
            prorated_ecola = $5,
            prorated_transportation = $6,
            prorated_repairing = $7,
            prorated_allowance = $8,
            prorated_postage = $9,

            total_deduction = $10

          WHERE id = $1
          RETURNING *
        `,
        [
          id,
          newEndDate,
          newDays,

          updated.prorated_salary,
          updated.prorated_ecola,
          updated.prorated_transportation,
          updated.prorated_repairing,
          updated.prorated_allowance,
          updated.prorated_postage,

          newTotal,
        ]
      );

      // =====================================================
      // SAVE EXTENSION HISTORY
      // =====================================================

      await client.query(
        `
          INSERT INTO public.suspension_extension_history
          (
            suspension_order_id,
            previous_end_date,
            new_end_date,

            previous_days,
            new_days,
            additional_days,

            extension_reason,
            extended_by,

            previous_deductions,
            updated_deductions,

            previous_total_deduction,
            new_total_deduction
          )
          VALUES
          (
            $1,
            $2::date,
            $3::date,

            $4,
            $5,
            $6,

            $7,
            $8,

            $9::jsonb,
            $10::jsonb,

            $11,
            $12
          )
        `,
        [
          id,
          previousEndDate,
          newEndDate,

          previousDays,
          newDays,
          additionalDays,

          extensionReason,
          toInt(req.user?.id),

          JSON.stringify(original),
          JSON.stringify(updated),

          previousTotal,
          newTotal,
        ]
      );

      await client.query("COMMIT");
      inTransaction = false;

      return res.json({
        success: true,
        message: "Suspension extended successfully",

        data: updatedRes.rows[0],

        extension: {
          previous_end_date: previousEndDate,
          new_end_date: newEndDate,

          previous_days: previousDays,
          additional_days: additionalDays,
          new_days: newDays,

          previous_total_deduction: previousTotal,
          additional_deduction: additionalDeduction,
          new_total_deduction: newTotal,

          previous_deductions: original,
          updated_deductions: updated,

          extension_reason: extensionReason,
        },
      });

    } catch (error) {
      console.error(
        "EXTEND SUSPENSION ERROR:",
        error
      );

      return res.status(500).json({
        message: error.message || "Server error",
      });

    } finally {
      if (client) {
        if (inTransaction) {
          try {
            await client.query("ROLLBACK");
          } catch (rollbackError) {
            console.error(
              "EXTEND SUSPENSION ROLLBACK ERROR:",
              rollbackError
            );
          }
        }

        client.release();
      }
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

      if (
        isOperationDepartmentUser(req) &&
        (
          isBranchManager(req) ||
          isAreaManager(req) ||
          isRegionalManager(req) ||
          isAssistantVicePresident(req)
        )
      ) {
        await client.query("ROLLBACK");
        return res.status(403).json({
          message: "Operation Department Branch Manager to Vice President can only view suspension orders.",
        });
      }

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

      if (
        ["approved", "received"].includes(
          String(existing.status || "").trim().toLowerCase()
        )
      ) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message: "Completed suspension orders cannot be deleted",
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

      if (existing.attachment_path) {
        removeStoredFile(existing.attachment_path);
      }

      if (existing.approved_attachment_path) {
        removeStoredFile(existing.approved_attachment_path);
      }

      if (existing.admin_order_attachment_path) {
        removeStoredFile(existing.admin_order_attachment_path);
      }

      if (existing.signed_admin_order_path) {
        removeStoredFile(existing.signed_admin_order_path);
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

      if (
        ![
          "request",
          "approved",
          "admin-order",
          "signed-admin-order",
        ].includes(type)
      ) {
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

      if (
        type !== "request" &&
        !canDownloadApprovedFile(req, row)
      ) {
        return res.status(403).json({ message: "Access denied" });
      }

      let storedPath = null;
      let storedName = null;

      if (type === "request") {
        storedPath = row.attachment_path;
        storedName = row.attachment_name;
      } else if (type === "approved") {
        // Legacy approved attachment
        storedPath = row.approved_attachment_path;
        storedName = row.approved_attachment_name;
      } else if (type === "admin-order") {
        storedPath = row.admin_order_attachment_path;
        storedName = row.admin_order_attachment_name;
      } else if (type === "signed-admin-order") {
        storedPath = row.signed_admin_order_path;
        storedName = row.signed_admin_order_name;
      }

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

// =====================================================
// HR UPLOAD ADMIN ORDER
// =====================================================

router.post(
  "/suspension-orders/:id/admin-order",
  requireAuth,
  requirePermission("suspension_order", "upload_approved"),
  upload.single("attachment"),
  async (req, res) => {
    try {
      const id = toInt(req.params.id);

      if (!id) {
        return res.status(400).json({ message: "Invalid id" });
      }

      if (!req.file) {
        return res.status(400).json({
          message: "Admin Order file is required",
        });
      }

      if (!(isHr(req) || isHrDepartmentUser(req) || isAdmin(req))) {
        removeStoredFile(`/uploads/suspension/${req.file.filename}`);

        return res.status(403).json({
          message: "Only HR/Admin can upload the Admin Order",
        });
      }

      const existing = await pool.query(
        `
        SELECT *
        FROM public.suspension_orders
        WHERE id = $1
        `,
        [id]
      );

      if (existing.rowCount === 0) {
        removeStoredFile(`/uploads/suspension/${req.file.filename}`);

        return res.status(404).json({
          message: "Suspension order not found",
        });
      }

      const row = existing.rows[0];
      const currentStage = getCurrentStage(row);

      if (currentStage !== STAGE_HR_ADMIN_ORDER) {
        removeStoredFile(`/uploads/suspension/${req.file.filename}`);

        return res.status(400).json({
          message: "This order is not waiting for HR Admin Order",
        });
      }

      const newPath =
        `/uploads/suspension/${req.file.filename}`;

      const oldPath =
        row.admin_order_attachment_path || null;

      const result = await pool.query(
        `
        UPDATE public.suspension_orders
        SET
          admin_order_attachment_path = $2,
          admin_order_attachment_name = $3,
          admin_order_attachment_mime = $4,
          admin_order_uploaded_by = $5,
          admin_order_uploaded_at = NOW(),

          approval_stage = $6,
          status = $7
        WHERE id = $1
        RETURNING *;
        `,
        [
          id,
          newPath,
          clean(req.file.originalname),
          clean(req.file.mimetype),
          toInt(req.user?.id),
          STAGE_AVP_SIGNED_ORDER,
          LABELS[STAGE_AVP_SIGNED_ORDER],
        ]
      );

      if (oldPath && oldPath !== newPath) {
        removeStoredFile(oldPath);
      }

      return res.json(result.rows[0]);
    } catch (e) {
      if (req.file) {
        removeStoredFile(
          `/uploads/suspension/${req.file.filename}`
        );
      }

      console.error(
        "POST /api/suspension-orders/:id/admin-order ERROR:",
        e.message
      );

      return res.status(500).json({
        message: e?.message || "Server error",
      });
    }
  }
);

// =====================================================
// AVP UPLOAD SIGNED ADMIN ORDER
// =====================================================
router.post(
  "/suspension-orders/:id/avp-signed-order",
  requireAuth,
  requirePermission("suspension_order", "upload_approved"),
  upload.single("attachment"),
  async (req, res) => {
    try {
      const id = toInt(req.params.id);

      if (!id) {
        return res.status(400).json({ message: "Invalid id" });
      }

      if (!req.file) {
        return res.status(400).json({
          message: "Signed Admin Order file is required",
        });
      }

      if (!isAssistantVicePresident(req)) {
        removeStoredFile(`/uploads/suspension/${req.file.filename}`);

        return res.status(403).json({
          message:
            "Only Assistant Vice President can upload the signed Admin Order",
        });
      }

      const existing = await pool.query(
        `
        SELECT *
        FROM public.suspension_orders
        WHERE id = $1
        `,
        [id]
      );

      if (existing.rowCount === 0) {
        removeStoredFile(`/uploads/suspension/${req.file.filename}`);

        return res.status(404).json({
          message: "Suspension order not found",
        });
      }

      const row = existing.rows[0];
      const currentStage = getCurrentStage(row);

      if (currentStage !== STAGE_AVP_SIGNED_ORDER) {
        removeStoredFile(`/uploads/suspension/${req.file.filename}`);

        return res.status(400).json({
          message:
            "This order is not waiting for AVP Signed Admin Order",
        });
      }

      const newPath =
        `/uploads/suspension/${req.file.filename}`;

      const oldPath =
        row.signed_admin_order_path || null;

      const result = await pool.query(
        `
        UPDATE public.suspension_orders
        SET
          signed_admin_order_path = $2,
          signed_admin_order_name = $3,
          signed_admin_order_mime = $4,
          signed_admin_order_uploaded_by = $5,
          signed_admin_order_uploaded_at = NOW(),

          approval_stage = $6,
          status = $7
        WHERE id = $1
        RETURNING *;
        `,
        [
          id,
          newPath,
          clean(req.file.originalname),
          clean(req.file.mimetype),
          toInt(req.user?.id),
          STAGE_HR_RECEIVED,
          LABELS[STAGE_HR_RECEIVED],
        ]
      );

      if (oldPath && oldPath !== newPath) {
        removeStoredFile(oldPath);
      }

      return res.json(result.rows[0]);
    } catch (e) {
      if (req.file) {
        removeStoredFile(
          `/uploads/suspension/${req.file.filename}`
        );
      }

      console.error(
        "POST /api/suspension-orders/:id/avp-signed-order ERROR:",
        e.message
      );

      return res.status(500).json({
        message: e?.message || "Server error",
      });
    }
  }
);


// =====================================================
// HR RECEIVED
// =====================================================
router.put(
  "/suspension-orders/:id/received",
  requireAuth,
  requirePermission("suspension_order", "approve"),
  async (req, res) => {
    try {
      const id = toInt(req.params.id);

      if (!id) {
        return res.status(400).json({ message: "Invalid id" });
      }

      if (!(isHr(req) || isHrDepartmentUser(req) || isAdmin(req))) {
        return res.status(403).json({
          message: "Only HR/Admin can mark the order as Received",
        });
      }

      const existing = await pool.query(
        `
        SELECT *
        FROM public.suspension_orders
        WHERE id = $1
        `,
        [id]
      );

      if (existing.rowCount === 0) {
        return res.status(404).json({
          message: "Suspension order not found",
        });
      }

      const row = existing.rows[0];
      const currentStage = getCurrentStage(row);

      if (currentStage !== STAGE_HR_RECEIVED) {
        return res.status(400).json({
          message: "This order is not waiting to be received",
        });
      }

      if (!row.signed_admin_order_path) {
        return res.status(400).json({
          message: "Signed Admin Order is required",
        });
      }

      const result = await pool.query(
        `
          UPDATE public.suspension_orders
          SET
            received_by = $2,
            received_at = NOW(),

            approval_stage = $3,
            status = 'Received',

            approved_by = $4,
            approved_at = NOW()
          WHERE id = $1
          RETURNING *;
        `,
        [
          id,
          toInt(req.user?.id),
          STAGE_RECEIVED,
          String(req.user?.id || ""),
        ]
      );

      await applyDueSuspensions();

      return res.json(result.rows[0]);
    } catch (e) {
      console.error(
        "PUT /api/suspension-orders/:id/received ERROR:",
        e.message
      );

      return res.status(500).json({
        message: e?.message || "Server error",
      });
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

      if (
        isOperationDepartmentUser(req) &&
        (
          isBranchManager(req) ||
          isAreaManager(req) ||
          isRegionalManager(req) ||
          isAssistantVicePresident(req)
        )
      ) {
        return res.status(403).json({
          message:
            "Operation Department Branch Manager to Assistant Vice President can only view suspension orders.",
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
      const approverId = toInt(req.user?.id);
      const approverText = String(approverId || "");

      let result;

      // Full-access users approve the final stage.
      // This must be checked first because an Audit user
      // may also have an Area Manager, Regional Manager,
      // or Assistant Vice President role.

      if (hasSuspensionFullAccess(req)) {
        if (currentStage !== STAGE_ADMIN) {
          return res.status(400).json({
            message:
              "This order is not pending final approval",
          });
        }

        result = await pool.query(
          `
            UPDATE public.suspension_orders
            SET
              admin_status = 'Approved',
              admin_approved_by = $2,
              admin_approved_at = NOW(),

              approved_by = NULL,
              approved_at = NULL,

              approval_stage = $3,
              status = $4,

              rejected_by = NULL,
              rejected_at = NULL,
              rejection_reason = NULL
            WHERE id = $1
            RETURNING *;
          `,
          [
            id,
            approverId,
            STAGE_HR_ADMIN_ORDER,
            LABELS[STAGE_HR_ADMIN_ORDER],
          ]
        );
      } else if (isAreaManager(req)) {
        if (currentStage !== STAGE_AREA) {
          return res.status(400).json({
            message:
              "This order is not pending Area Manager approval",
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
          [
            id,
            approverId,
            STAGE_RM,
            LABELS[STAGE_RM],
          ]
        );
      } else if (isRegionalManager(req)) {
        if (currentStage !== STAGE_RM) {
          return res.status(400).json({
            message:
              "This order is not pending Regional Manager approval",
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
          [
            id,
            approverId,
            STAGE_AVP,
            LABELS[STAGE_AVP],
          ]
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
          [
            id,
            approverId,
            STAGE_ADMIN,
            LABELS[STAGE_ADMIN],
          ]
        );
      } else {
        return res.status(403).json({
          message: "Access denied",
        });
      }

      if (result.rowCount === 0) {
        return res.status(400).json({
          message: "Not found or invalid approval stage",
        });
      }


      // =====================================================
      // APPLY STAFF STATUS AFTER FINAL SUSPENSION APPROVAL
      // =====================================================
      if (
        String(result.rows[0]?.status || "")
          .trim()
          .toLowerCase() === "approved"
      ) {
        await applyDueSuspensions();
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

      if (
        isOperationDepartmentUser(req) &&
        (
          isBranchManager(req) ||
          isAreaManager(req) ||
          isRegionalManager(req) ||
          isAssistantVicePresident(req)
        )
      ) {
        return res.status(403).json({
          message:
            "Operation Department Branch Manager to Assistant Vice President can only view suspension orders.",
        });
      }

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
        hasSuspensionFullAccess(req) &&
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

console.log("[suspension] suspensionRoutes.js loaded");

applyDueSuspensions()
  .then(() => {
    console.log("[suspension] applyDueSuspensions initial run completed");
  })
  .catch((err) => {
    console.error("[suspension] applyDueSuspensions initial run failed:", err);
  });

module.exports = router;  