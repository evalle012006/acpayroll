const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const router = express.Router();
const pool = require("../db");

const { requireAuth } = require("../middlewares/authMiddleware");
const { requirePermission } = require("../middlewares/permissionMiddleware");

const toInt = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

const toDate = (v) => {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
};

const clean = (v) => String(v ?? "").trim();
const norm = (v) => clean(v).toLowerCase();

const roleLower = (req) => norm(req.user?.role);
const departmentLower = (req) => norm(req.user?.department);

const isAdmin = (req) => roleLower(req) === "admin";
const isIT = (req) => roleLower(req) === "it";
const isHr = (req) => roleLower(req) === "hr";
const isAccounting = (req) => roleLower(req) === "accounting";
const isTread = (req) => roleLower(req) === "tread";
const isBranchManager = (req) =>
  roleLower(req) === "branch manager";

const isAreaManager = (req) =>  
  roleLower(req) === "area manager";

const isRegionalManager = (req) =>
  roleLower(req) === "regional manager";

const isAssistantVicePresident = (req) =>
  roleLower(req) === "assistant vice president";

const isVicePresident = (req) =>
  roleLower(req) === "vice president";

const isSeniorVicePresident = (req) =>
  roleLower(req) === "senior vice president";

const isHRDepartment = (req) =>
  departmentLower(req) === "hr department";

const isAccountingDepartment = (req) =>
  departmentLower(req) === "accounting department";

// HR and Accounting Department can bypass any pending stage.
const canBypassResignation = (req) =>
  isAdmin(req) ||
  isHRDepartment(req) ||
  isAccountingDepartment(req);

// HR and Accounting Department can upload documents.
const canUploadResignation = (req) =>
  isAdmin(req) ||
  isIT(req) ||
  isHRDepartment(req) ||
  isAccountingDepartment(req);

const isHRorAccountingManager = (req) =>
  (isHRDepartment(req) || isAccountingDepartment(req)) &&
  (
    isBranchManager(req) ||
    isAreaManager(req) ||
    isRegionalManager(req) ||
    isAssistantVicePresident(req) ||
    isVicePresident(req) ||
    isSeniorVicePresident(req)
  );
const isPresident = (req) => roleLower(req) === "president";

// =====================================================
// RESIGNATION FINAL APPROVER
// HR DEPARTMENT - ANY ROLE
// =====================================================
const isFinalApprover = (req) =>
  isHRDepartment(req);

// =====================================================
// REVOKE / RE-APPLY ACCESS
// Admin / HR Department / Accounting Department
// =====================================================

const canManageResignationReturn = (req) =>
  isAdmin(req) ||
  isHRDepartment(req) ||
  isAccountingDepartment(req);

// =====================================================
// DELETE RESIGNATION ACCESS
// =====================================================
const canDeleteResignation = (req) =>
  isAdmin(req) ||
  isIT(req) ||
  isHRDepartment(req) ||
  isAccountingDepartment(req);

const getUserBranchId = (req) =>
  req.user?.branch_id ?? null;

const getUserArea = (req) => clean(req.user?.area);
const getUserRegion = (req) => clean(req.user?.region);

const matchBranch = (userBranchId, rowBranchId, rowBranchCode) => {
  if (!userBranchId) return false;

  return (
    String(userBranchId) === String(rowBranchId) ||
    norm(userBranchId) === norm(rowBranchCode)
  );
};

const STATUS_BRANCH = "Pending Branch Manager";
const STATUS_AREA = "Pending Area Manager";
const STATUS_RM = "Pending Regional Manager";
const STATUS_AVP = "Pending Assistant Vice President";
const STATUS_VP = "Pending Vice President";
const STATUS_SVP = "Pending Senior Vice President";

// NEW RESIGNATION SIGNATURE WORKFLOW
const STATUS_HR = "Pending HR Department";
const STATUS_AVP_SIGNATURE = "Pending AVP Signature";
const STATUS_HR_FINAL = "Pending HR Final Approval";

const STATUS_APPROVED = "Approved";
const STATUS_REJECTED = "Rejected";
const STATUS_REVOKED = "Revoked";

const applyDueResignations = async () => {
  await pool.query(`
    UPDATE public.staff s
    SET
      status = 'Inactive',
      exit_type = 'Resigned',
      exit_date = rr.effective_date,
      exit_remarks = rr.remarks
    FROM public.resignation_requests rr
    WHERE LOWER(TRIM(COALESCE(s.employee_no, ''))) =
          LOWER(TRIM(COALESCE(rr.employee_no, '')))

      AND LOWER(TRIM(COALESCE(rr.status, ''))) = 'approved'

      AND rr.revoke_effective_date IS NULL

      AND rr.effective_date IS NOT NULL

      AND rr.effective_date::date <=
          (NOW() AT TIME ZONE 'Asia/Manila')::date

      AND LOWER(TRIM(COALESCE(s.status, ''))) <> 'inactive'

      AND NOT EXISTS (
        SELECT 1
        FROM public.status_history sh
        WHERE LOWER(TRIM(COALESCE(sh.employee_no, ''))) =
              LOWER(TRIM(COALESCE(rr.employee_no, '')))

          AND LOWER(TRIM(COALESCE(sh.status, ''))) = 'active'

          AND LOWER(TRIM(COALESCE(sh.reason, ''))) IN (
            're-apply',
            'reapply',
            'reactivated'
          )

          AND sh.effective_date::date >= rr.effective_date::date
      )
  `);
};

const uploadDir = path.join(process.cwd(), "uploads", "resignation-requests");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    const base = path
      .basename(file.originalname || "file", ext)
      .replace(/[^a-zA-Z0-9_-]/g, "_");

    cb(null, `${Date.now()}-${base}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
});

const isAuditDepartment = (staff) =>
  norm(staff?.department) === "audit department";

const STATUS_ROLE_MAP = {
  [STATUS_BRANCH]: ["branch manager", "acting branch manager"],
  [STATUS_AREA]: ["area manager", "acting area manager"],
  [STATUS_RM]: ["regional manager", "acting regional manager"],
  [STATUS_AVP]: ["assistant vice president"],
  [STATUS_VP]: ["vice president"],
  [STATUS_SVP]: ["senior vice president"],
};

const approverExists = async (client, status, staff) => {
  if (status === STATUS_HR) {
    return true;
  }

  const roles = STATUS_ROLE_MAP[status] || [];

  if (roles.length === 0) {
    return false;
  }

  const values = [...roles];
  const rolePlaceholders = roles
    .map((_, index) => `$${index + 1}`)
    .join(", ");

  const conditions = [
    `LOWER(TRIM(COALESCE(role, ''))) IN (${rolePlaceholders})`,
    `LOWER(TRIM(COALESCE(status, 'Active'))) = 'active'`,
  ];

  if (status === STATUS_BRANCH) {
    values.push(String(staff?.branch_id || ""));

    conditions.push(
      `LOWER(TRIM(COALESCE(branch_id::text, ''))) =
       LOWER(TRIM($${values.length}))`
    );
  }

  if (status === STATUS_AREA) {
    values.push(clean(staff?.area));

    conditions.push(
      `LOWER(TRIM(COALESCE(area, ''))) =
       LOWER(TRIM($${values.length}))`
    );
  }

  if (status === STATUS_RM) {
    values.push(clean(staff?.region));

    conditions.push(
      `LOWER(TRIM(COALESCE(region, ''))) =
       LOWER(TRIM($${values.length}))`
    );
  }

  if (status === STATUS_AVP && staff?.division) {
    values.push(clean(staff.division));

    conditions.push(
      `LOWER(TRIM(COALESCE(division, ''))) =
       LOWER(TRIM($${values.length}))`
    );
  }

  if (
    [STATUS_AVP, STATUS_VP, STATUS_SVP].includes(status) &&
    staff?.department
  ) {
    values.push(clean(staff.department));

    conditions.push(
      `LOWER(TRIM(COALESCE(department, ''))) =
       LOWER(TRIM($${values.length}))`
    );
  }

  const result = await client.query(
    `
    SELECT id
    FROM public.users
    WHERE ${conditions.join("\n      AND ")}
    LIMIT 1
    `,
    values
  );

  return result.rowCount > 0;
};

const getFirstActiveStatus = async (
  client,
  staff,
  possibleStatuses
) => {
  for (const status of possibleStatuses) {
    if (status === STATUS_HR) {
      return STATUS_HR;
    }

    const exists = await approverExists(
      client,
      status,
      staff
    );

    if (exists) {
      return status;
    }
  }

  return STATUS_HR;
};

const determineInitialStatus = async (
  client,
  req,
  staff
) => {
  const staffPosition = norm(staff?.position)
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (isAuditDepartment(staff)) {
    return await getFirstActiveStatus(
      client,
      staff,
      [STATUS_SVP, STATUS_HR]
    );
  }

  if (
    isAreaManager(req) &&
    staffPosition.includes("branch") &&
    staffPosition.includes("manager")
  ) {
    return await getFirstActiveStatus(
      client,
      staff,
      [
        STATUS_BRANCH,
        STATUS_AREA,
        STATUS_RM,
        STATUS_AVP,
        STATUS_VP,
        STATUS_HR,
      ]
    );
  }

  if (staffPosition.includes("area manager")) {
    return await getFirstActiveStatus(
      client,
      staff,
      [STATUS_RM, STATUS_AVP, STATUS_VP, STATUS_HR]
    );
  }

  if (staffPosition.includes("regional manager")) {
    return await getFirstActiveStatus(
      client,
      staff,
      [STATUS_AVP, STATUS_VP, STATUS_HR]
    );
  }

  if (staffPosition.includes("assistant vice president")) {
    return await getFirstActiveStatus(
      client,
      staff,
      [STATUS_VP, STATUS_HR]
    );
  }

  if (staffPosition.includes("vice president")) {
    return STATUS_HR;
  }

  if (isBranchManager(req) || isAreaManager(req)) {
    return await getFirstActiveStatus(
      client,
      staff,
      [
        STATUS_AREA,
        STATUS_RM,
        STATUS_AVP,
        STATUS_VP,
        STATUS_HR,
      ]
    );
  }

  if (isRegionalManager(req)) {
    return await getFirstActiveStatus(
      client,
      staff,
      [STATUS_AVP, STATUS_VP, STATUS_HR]
    );
  }

  if (isAssistantVicePresident(req)) {
    return await getFirstActiveStatus(
      client,
      staff,
      [STATUS_VP, STATUS_HR]
    );
  }

  if (
    isVicePresident(req) ||
    isFinalApprover(req) ||
    isTread(req)
  ) {
    return STATUS_HR;
  }

  return await getFirstActiveStatus(
    client,
    staff,
    [
      STATUS_AREA,
      STATUS_RM,
      STATUS_AVP,
      STATUS_VP,
      STATUS_HR,
    ]
  );
};

const getNextActiveStatus = async (
  client,
  currentStatus,
  staff
) => {
  if (currentStatus === STATUS_BRANCH) {
    return await getFirstActiveStatus(
      client,
      staff,
      [
        STATUS_AREA,
        STATUS_RM,
        STATUS_AVP,
        STATUS_VP,
        STATUS_HR,
      ]
    );
  }

  if (currentStatus === STATUS_AREA) {
    return await getFirstActiveStatus(
      client,
      staff,
      [
        STATUS_RM,
        STATUS_AVP,
        STATUS_VP,
        STATUS_HR,
      ]
    );
  }

  if (currentStatus === STATUS_RM) {
    return await getFirstActiveStatus(
      client,
      staff,
      [STATUS_AVP, STATUS_VP, STATUS_HR]
    );
  }

  if (currentStatus === STATUS_AVP) {
    return await getFirstActiveStatus(
      client,
      staff,
      [STATUS_VP, STATUS_HR]
    );
  }

  if (
    currentStatus === STATUS_VP ||
    currentStatus === STATUS_SVP
  ) {
    return STATUS_HR;
  }

  return STATUS_HR;
};

const canActOnCurrentStage = (req, row) => {
  const status = clean(row?.status);

  // ADMIN may act on any pending approval stage.
  if (isAdmin(req)) {
    return ![
      STATUS_APPROVED,
      STATUS_REJECTED,
      STATUS_REVOKED,
    ].includes(status);
  }

  // =====================================================
  // HR DEPARTMENT
  // HR INITIAL + HR FINAL
  // =====================================================
  if (isHRDepartment(req)) {
    return (
      status === STATUS_HR ||
      status === STATUS_HR_FINAL
    );
  }

  // =====================================================
  // BRANCH MANAGER
  // =====================================================
  if (isBranchManager(req)) {
    return (
      status === STATUS_BRANCH &&
      matchBranch(
        getUserBranchId(req),
        row?.branch_id,
        row?.branch_code
      )
    );
  }

  // =====================================================
  // AREA MANAGER
  // =====================================================
  if (isAreaManager(req)) {
    return (
      status === STATUS_AREA &&
      norm(getUserArea(req)) === norm(row?.area)
    );
  }

  // =====================================================
  // REGIONAL MANAGER
  // =====================================================
  if (isRegionalManager(req)) {
    return (
      status === STATUS_RM &&
      norm(getUserRegion(req)) === norm(row?.region)
    );
  }

  // =====================================================
  // AVP
  //
  // AVP has TWO possible stages:
  // 1. normal management approval
  // 2. signature approval after HR initial approval
  // =====================================================
  if (isAssistantVicePresident(req)) {
    return (
      status === STATUS_AVP ||
      status === STATUS_AVP_SIGNATURE
    );
  }

  if (isVicePresident(req)) {
    return status === STATUS_VP;
  }

  if (isSeniorVicePresident(req)) {
    return status === STATUS_SVP;
  }

  return false;
};

// =====================================================
// REJECT RESIGNATION ACCESS
// Admin / IT / HR Dept / Accounting Dept:
//   may reject at ANY pending approval stage
//
// Operation approvers:
//   may reject only when it is their current stage
// =====================================================
const canRejectResignation = (req, row) => {
  const status = clean(row?.status);

  // Completed requests cannot be rejected again
  if (
    status === STATUS_APPROVED ||
    status === STATUS_REJECTED ||
    status === STATUS_REVOKED
  ) {
    return false;
  }

  // Management override for pending resignation
  if (
    isAdmin(req) ||
    isIT(req) ||
    isHRDepartment(req) ||
    isAccountingDepartment(req)
  ) {
    return true;
  }

  // Normal approval-chain approver
  return canActOnCurrentStage(req, row);
};

router.get(
  "/resignation-requests",
  requireAuth,
  requirePermission("resignation_request", "view"),
  async (req, res) => {
    try {
      await applyDueResignations();

      const params = [];

      let sql = `
        SELECT
          rr.*,

          bm_user.username AS branch_manager_approved_by_name,
          am_user.username AS area_manager_approved_by_name,
          rm_user.username AS regional_manager_approved_by_name,
          avp_user.username AS avp_approved_by_name,
          vp_user.username AS vp_approved_by_name,
          svp_user.username AS svp_approved_by_name,
          president_user.username AS president_approved_by_name,

          hr_initial_user.username AS hr_initial_approved_by_name,
          avp_signature_user.username AS avp_signature_approved_by_name,
          hr_final_user.username AS hr_final_approved_by_name,

          final_user.username AS approved_by_name

        FROM public.resignation_requests rr

        LEFT JOIN public.staff s
          ON s.id = rr.staff_id
          OR s.employee_no = rr.employee_no

        LEFT JOIN public.users bm_user
          ON bm_user.id = rr.branch_manager_approved_by

        LEFT JOIN public.users am_user
          ON am_user.id = rr.area_manager_approved_by

        LEFT JOIN public.users rm_user
          ON rm_user.id = rr.regional_manager_approved_by

        LEFT JOIN public.users avp_user
          ON avp_user.id = rr.avp_approved_by

        LEFT JOIN public.users vp_user
          ON vp_user.id = rr.vp_approved_by

        LEFT JOIN public.users svp_user
          ON svp_user.id = rr.svp_approved_by

        LEFT JOIN public.users president_user
          ON president_user.id = rr.president_approved_by

        LEFT JOIN public.users final_user
          ON final_user.id = rr.approved_by

        LEFT JOIN public.users hr_initial_user
          ON hr_initial_user.id = rr.hr_initial_approved_by

        LEFT JOIN public.users avp_signature_user
          ON avp_signature_user.id = rr.avp_signature_approved_by

        LEFT JOIN public.users hr_final_user
          ON hr_final_user.id = rr.hr_final_approved_by

        WHERE 1=1
      `;

      if (
        isAdmin(req) ||
        isIT(req) ||
        isHr(req) ||
        isAccounting(req) ||
        isTread(req) ||
        isVicePresident(req) ||
        isSeniorVicePresident(req) ||
        isPresident(req) ||
        isHRDepartment(req)
      ) {
        // Full access
      } else if (isBranchManager(req)) {
        const branchId = getUserBranchId(req);
        if (!branchId) return res.json([]);

        params.push(String(branchId));

        sql += `
          AND (
            CAST(COALESCE(s.branch_id, rr.branch_id) AS TEXT) = $${params.length}
            OR LOWER(TRIM(COALESCE(rr.branch_code, ''))) =
               LOWER(TRIM($${params.length}))
          )
        `;
      } else if (isAreaManager(req)) {
        const area = getUserArea(req);
        if (!area) return res.json([]);

        params.push(area);

        sql += `
          AND LOWER(TRIM(COALESCE(s.area, rr.area, ''))) =
              LOWER(TRIM($${params.length}))
        `;
      } else if (isRegionalManager(req)) {
        const region = getUserRegion(req);
        if (!region) return res.json([]);

        params.push(region);

        sql += `
          AND LOWER(TRIM(COALESCE(s.region, rr.region, ''))) =
              LOWER(TRIM($${params.length}))
        `;
      } else if (isAssistantVicePresident(req)) {
        const division = clean(req.user?.division);

        if (division) {
          params.push(division);

          sql += `
            AND LOWER(TRIM(COALESCE(s.division, ''))) =
                LOWER(TRIM($${params.length}))
          `;
        } else {
          sql += `
            AND status IN (
              '${STATUS_AVP}',
              '${STATUS_VP}',
              '${STATUS_HR}',
              '${STATUS_AVP_SIGNATURE}',
              '${STATUS_HR_FINAL}',
              '${STATUS_APPROVED}',
              '${STATUS_REJECTED}'
            )
          `;
        }
      } else {
        return res.status(403).json({ message: "Access denied" });
      }

      sql += ` ORDER BY rr.id DESC`;

      const r = await pool.query(sql, params);
      return res.json(r.rows);
    } catch (e) {
      console.error("GET /resignation-requests ERROR:", e);
      return res.status(500).json({ message: e?.message || "Server error" });
    }
  }
);

router.post(
  "/resignation-requests",
  requireAuth,
  requirePermission("resignation_request", "create"),
  upload.single("attachment"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const staff_id = toInt(req.body?.staff_id);
      const employee_no = clean(req.body?.employee_no);
      const employee_name = clean(req.body?.employee_name);
      const last_name = clean(req.body?.last_name);
      const first_name = clean(req.body?.first_name);
      const middle_name = clean(req.body?.middle_name);
      const branch_id = toInt(req.body?.branch_id);
      const branch_code = clean(req.body?.branch_code);
      const branch_name = clean(req.body?.branch_name);
      const resignation_date = toDate(req.body?.resignation_date);
      const remarks = clean(req.body?.remarks);

      const attachment_path = req.file
        ? `/uploads/resignation-requests/${req.file.filename}`
        : null;

      if (!staff_id) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Staff is required" });
      }

      const staffRes = await client.query(
        `
        SELECT
          id,
          employee_no,
          fullname,
          last_name,
          first_name,
          middle_name,
          branch_id,
          status,
          area,
          region,
          division,
          position,
          department
        FROM public.staff
        WHERE id = $1
        FOR UPDATE
        `,
        [staff_id]
      );

      if (staffRes.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Staff not found" });
      }

      const staff = staffRes.rows[0];

      if (norm(staff.status || "Active") !== "active") {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: "Only active staff can file resignation request",
        });
      }

      if (isBranchManager(req)) {
        const userBranchId = getUserBranchId(req);

        if (!matchBranch(userBranchId, staff.branch_id, branch_code)) {
          await client.query("ROLLBACK");
          return res.status(403).json({
            message: "You can only create resignation requests for your branch",
          });
        }
      }

      if (isAreaManager(req)) {
        const userArea = getUserArea(req);

        if (!userArea || norm(userArea) !== norm(staff.area)) {
          await client.query("ROLLBACK");
          return res.status(403).json({
            message: "You can only create resignation requests for your area",
          });
        }
      }

      if (isRegionalManager(req)) {
        const userRegion = getUserRegion(req);

        if (!userRegion || norm(userRegion) !== norm(staff.region)) {
          await client.query("ROLLBACK");
          return res.status(403).json({
            message: "You can only create resignation requests for your region",
          });
        }
      }

      const duplicateCheck = await client.query(
        `
          SELECT 1
          FROM public.resignation_requests
          WHERE employee_no = $1
            AND status IN ($2,$3,$4,$5,$6,$7,$8,$9,$10)
          LIMIT 1
        `,
        [
          clean(staff.employee_no),
          STATUS_BRANCH,
          STATUS_AREA,
          STATUS_RM,
          STATUS_AVP,
          STATUS_VP,
          STATUS_SVP,
          STATUS_HR,
          STATUS_AVP_SIGNATURE,
          STATUS_HR_FINAL,
        ]
      );

      if (duplicateCheck.rowCount > 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message:
            "A pending resignation request already exists for this employee",
        });
      }

      let finalBranchCode = branch_code;
      let finalBranchName = branch_name;

      if (branch_id) {
        const b = await client.query(
          `
          SELECT code, name
          FROM public.branches
          WHERE id = $1
          `,
          [branch_id]
        );

        if (b.rowCount > 0) {
          finalBranchCode = clean(b.rows[0].code);
          finalBranchName = clean(b.rows[0].name);
        }
      }

      const seq = await client.query(
        `SELECT nextval('public.resignation_requests_id_seq') AS n`
      );

      const n = Number(seq.rows[0].n);
      const request_no = `RES-${String(n).padStart(8, "0")}`;
      const initialStatus = await determineInitialStatus(
        client,
        req,
        staff
      );

      const ins = await client.query(
        `
        INSERT INTO public.resignation_requests
        (
          id,
          request_no,
          staff_id,
          employee_no,
          employee_name,
          last_name,
          first_name,
          middle_name,
          branch_id,
          branch_code,
          branch_name,
          area,
          region,
          resignation_date,
          effective_date,
          remarks,
          attachment_path,
          status,
          created_by
        )
        VALUES
        (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
          $11,$12,$13,$14::date,$15::date,$16,$17,$18,$19
        )
        RETURNING *;
        `,
        [
          n,
          request_no,
          staff_id,
          employee_no || clean(staff.employee_no),
          employee_name || clean(staff.fullname),
          last_name || clean(staff.last_name),
          first_name || clean(staff.first_name),
          middle_name || clean(staff.middle_name),
          branch_id || staff.branch_id || null,
          finalBranchCode || null,
          finalBranchName || null,
          clean(staff.area) || null,
          clean(staff.region) || null,
          resignation_date,
          null,
          remarks || null,
          attachment_path,
          initialStatus,
          req.user?.id ?? null,
        ]
      );

      await client.query("COMMIT");
      return res.json(ins.rows[0]);
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("POST /resignation-requests ERROR:", e);
      return res.status(500).json({ message: e?.message || "Server error" });
    } finally {
      client.release();
    }
  }
);

// =====================================================
// UPLOAD RESIGNATION FILE
// =====================================================
router.put(
  "/resignation-requests/:id/upload",
  requireAuth,
  requirePermission("resignation_request", "approve"),
  upload.single("attachment"),
  async (req, res) => {
    try {
      const id = toInt(req.params.id);

      if (!id) {
        return res.status(400).json({
          message: "Invalid id",
        });
      }

      if (!req.file) {
        return res.status(400).json({
          message: "Attachment file is required",
        });
      }

      const requestRes = await pool.query(
        `
          SELECT *
          FROM public.resignation_requests
          WHERE id = $1
        `,
        [id]
      );

      if (requestRes.rowCount === 0) {
        return res.status(404).json({
          message: "Resignation request not found",
        });
      }

      const row = requestRes.rows[0];

      if (
        !canUploadResignation(req) &&
        !canActOnCurrentStage(req, row)
      ) {
        return res.status(403).json({
          message:
            "You cannot upload a file for this approval stage",
        });
      }

      if (
        [
          STATUS_APPROVED,
          STATUS_REJECTED,
          STATUS_REVOKED,
        ].includes(clean(row.status))
      ) {
        return res.status(400).json({
          message: "Cannot upload files to a completed resignation request",
        });
      }

      const attachmentPath =
        `/uploads/resignation-requests/${req.file.filename}`;

      const attachmentName =
        req.file.originalname || null;

      const attachmentMime =
        req.file.mimetype || null;

      let stageSet = "";

      if (clean(row.status) === STATUS_HR) {
        stageSet = `,
          hr_initial_attachment_path = $2,
          hr_initial_attachment_name = $3,
          hr_initial_attachment_mime = $4
        `;
      }

      if (clean(row.status) === STATUS_AVP_SIGNATURE) {
        stageSet = `,
          avp_signature_attachment_path = $2,
          avp_signature_attachment_name = $3,
          avp_signature_attachment_mime = $4
        `;
      }

      if (clean(row.status) === STATUS_HR_FINAL) {
        stageSet = `,
          hr_final_attachment_path = $2,
          hr_final_attachment_name = $3,
          hr_final_attachment_mime = $4
        `;
      }

      const r = await pool.query(
        `
          UPDATE public.resignation_requests
          SET
            attachment_path = $2,
            approved_attachment_path = $2,
            approved_attachment_name = $3,
            approved_attachment_mime = $4
            ${stageSet}
          WHERE id = $1
          RETURNING *;
        `,
        [
          id,
          attachmentPath,
          attachmentName,
          attachmentMime,
        ]
      );

      return res.json(r.rows[0]);
    } catch (e) {
      console.error(
        "PUT /resignation-requests/:id/upload ERROR:",
        e
      );

      return res.status(500).json({
        message: e?.message || "Server error",
      });
    }
  }
);

// =====================================================
// FINALIZE APPROVED RESIGNATION
// Called ONLY when resignation reaches final Approved.
// =====================================================

      const finalizeApprovedResignation = async (
        client,
        existing,
        employeeNo,
        effectiveDate
      ) => {
        const remarks = clean(existing.remarks) || null;

        const isReapplyRequest =
          Boolean(existing.revoke_effective_date);

        const finalEffectiveDate = isReapplyRequest
          ? toDate(existing.revoke_effective_date)
          : effectiveDate;

        const finalRemarks = isReapplyRequest
          ? clean(existing.revoke_remarks) || remarks
          : remarks;

        if (isReapplyRequest) {
          await client.query(
            `
              UPDATE public.staff
              SET
                status = 'Active',
                branch_id = $2,
                area = $3,
                region = $4,
                division = $5,
                position = $6,
                department = $7,
                exit_type = NULL,
                exit_date = NULL,
                exit_remarks = NULL
              WHERE employee_no = $1
            `,
            [
              employeeNo,
              existing.revoke_branch_id,
              existing.revoke_area,
              existing.revoke_region,
              existing.revoke_division,
              existing.revoke_position,
              existing.revoke_department,
            ]
          );
        } else {
          const todayRes = await client.query(
            `
              SELECT
                (NOW() AT TIME ZONE 'Asia/Manila')::date::text
                AS today
            `
          );

          const today = todayRes.rows[0].today;

          if (finalEffectiveDate <= today) {
            await client.query(
              `
                UPDATE public.staff
                SET
                  status = 'Inactive',
                  exit_type = 'Resigned',
                  exit_date = $2::date,
                  exit_remarks = $3
                WHERE employee_no = $1
              `,
              [
                employeeNo,
                finalEffectiveDate,
                finalRemarks,
              ]
            );
          } else {
            await client.query(
              `
                UPDATE public.staff
                SET
                  status = 'Active',
                  exit_type = 'Resigned',
                  exit_date = $2::date,
                  exit_remarks = $3
                WHERE employee_no = $1
              `,
              [
                employeeNo,
                finalEffectiveDate,
                finalRemarks,
              ]
            );
          }
        }

        try {
          if (isReapplyRequest) {
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
                VALUES
                  ($1, $2::date, 'Active', 'Re-Apply', $3)
                ON CONFLICT DO NOTHING
              `,
              [
                employeeNo,
                finalEffectiveDate,
                finalRemarks ||
                  "Resignation revoked / staff re-applied",
              ]
            );
          } else {
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
                VALUES
                  ($1, $2::date, 'Inactive', 'Resigned', $3)
                ON CONFLICT DO NOTHING
              `,
              [
                employeeNo,
                finalEffectiveDate,
                finalRemarks,
              ]
            );
          }
        } catch (historyErr) {
          console.warn(
            "status_history insert skipped:",
            historyErr.message
          );
        }
      };

// =====================================================
// APPROVE RESIGNATION REQUEST
// =====================================================
router.put(
  "/resignation-requests/:id/approve",
  requireAuth,
  requirePermission("resignation_request", "approve"),
  upload.single("attachment"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const id = toInt(req.params.id);

      if (!id) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: "Invalid id",
        });
      }

      // =====================================================
      // LOAD REQUEST + CURRENT STAFF SCOPE
      // =====================================================
      const requestRes = await client.query(
        `
          SELECT
            rr.*,
            s.area AS current_staff_area,
            s.region AS current_staff_region,
            s.division AS current_staff_division,
            s.branch_id AS current_staff_branch_id,
            s.department AS current_staff_department,
            s.position AS current_staff_position
          FROM public.resignation_requests rr
          LEFT JOIN public.staff s
            ON s.id = rr.staff_id
            OR (
              rr.employee_no IS NOT NULL
              AND s.employee_no = rr.employee_no
            )
          WHERE rr.id = $1
          FOR UPDATE OF rr
        `,
        [id]
      );

      if (requestRes.rowCount === 0) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          message: "Resignation request not found",
        });
      }

      const existing = requestRes.rows[0];
      const currentStatus = clean(existing.status);

      // =====================================================
      // COMPLETED REQUEST CHECK
      // =====================================================
      if (
        currentStatus === STATUS_APPROVED ||
        currentStatus === STATUS_REJECTED ||
        currentStatus === STATUS_REVOKED
      ) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message: "This request is already completed",
        });
      }

      const approvalStaff = {
        branch_id:
          existing.current_staff_branch_id ||
          existing.branch_id,

        area:
          existing.current_staff_area ||
          existing.area,

        region:
          existing.current_staff_region ||
          existing.region,

        division:
          existing.current_staff_division || "",

        department:
          existing.current_staff_department || "",

        position:
          existing.current_staff_position || "",
      };

      const bypass =
        req.body?.bypass === true ||
        req.body?.bypass === "true";

      const uploadedAttachmentPath = req.file
        ? `/uploads/resignation-requests/${req.file.filename}`
        : null;

      const uploadedAttachmentName =
        req.file?.originalname || null;

      const uploadedAttachmentMime =
        req.file?.mimetype || null;

      // =====================================================
      // ADMIN BYPASS VALIDATION
      // =====================================================
      if (bypass && !canBypassResignation(req)) {
        await client.query("ROLLBACK");

        return res.status(403).json({
          message:
            "Only Admin, HR Department, and Accounting Department can bypass approval.",
        });
      }

      // =====================================================
      // FILE REQUIRED
      //
      // Required for:
      // - HR INITIAL
      // - AVP SIGNATURE
      // - ADMIN BYPASS
      //
      // HR FINAL can use the AVP signed file already uploaded.
      // =====================================================
      if (
        currentStatus === STATUS_HR ||
        currentStatus === STATUS_AVP_SIGNATURE ||
        bypass
      ) {
        if (!req.file) {
          await client.query("ROLLBACK");

          return res.status(400).json({
            message:
              currentStatus === STATUS_AVP_SIGNATURE
                ? "Signed resignation file is required for AVP approval."
                : "Attachment file is required for approval.",
          });
        }
      }

      // =====================================================
      // ADMIN BYPASS
      // =====================================================
      if (bypass) {
        let nextStatus = null;

        let approverField = null;
        let approverAtField = null;

        let extraSet = "";
        const extraValues = [];

        switch (currentStatus) {
          case STATUS_BRANCH:
            approverField = "branch_manager_approved_by";
            approverAtField = "branch_manager_approved_at";

            nextStatus = await getNextActiveStatus(
              client,
              currentStatus,
              approvalStaff
            );
            break;

          case STATUS_AREA:
            approverField = "area_manager_approved_by";
            approverAtField = "area_manager_approved_at";

            nextStatus = await getNextActiveStatus(
              client,
              currentStatus,
              approvalStaff
            );
            break;

          case STATUS_RM:
            approverField = "regional_manager_approved_by";
            approverAtField = "regional_manager_approved_at";

            nextStatus = await getNextActiveStatus(
              client,
              currentStatus,
              approvalStaff
            );
            break;

          case STATUS_AVP:
            approverField = "avp_approved_by";
            approverAtField = "avp_approved_at";

            nextStatus = await getNextActiveStatus(
              client,
              currentStatus,
              approvalStaff
            );
            break;

          case STATUS_VP:
            approverField = "vp_approved_by";
            approverAtField = "vp_approved_at";
            nextStatus = STATUS_HR;
            break;

          case STATUS_SVP:
            approverField = "svp_approved_by";
            approverAtField = "svp_approved_at";
            nextStatus = STATUS_HR;
            break;

          // -----------------------------------------------
          // HR INITIAL -> AVP SIGNATURE
          // -----------------------------------------------
          case STATUS_HR:
            approverField = "hr_initial_approved_by";
            approverAtField = "hr_initial_approved_at";
            nextStatus = STATUS_AVP_SIGNATURE;

            extraSet = `,
              hr_initial_attachment_path = $5,
              hr_initial_attachment_name = $6,
              hr_initial_attachment_mime = $7
            `;

            extraValues.push(
              uploadedAttachmentPath,
              uploadedAttachmentName,
              uploadedAttachmentMime
            );
            break;

          // -----------------------------------------------
          // AVP SIGNATURE -> HR FINAL
          // -----------------------------------------------
          case STATUS_AVP_SIGNATURE:
            approverField = "avp_signature_approved_by";
            approverAtField = "avp_signature_approved_at";
            nextStatus = STATUS_HR_FINAL;

            extraSet = `,
              avp_signature_attachment_path = $5,
              avp_signature_attachment_name = $6,
              avp_signature_attachment_mime = $7
            `;

            extraValues.push(
              uploadedAttachmentPath,
              uploadedAttachmentName,
              uploadedAttachmentMime
            );
            break;

          // -----------------------------------------------
          // HR FINAL -> APPROVED
          // handled separately below
          // -----------------------------------------------
          case STATUS_HR_FINAL:
            break;

          default:
            await client.query("ROLLBACK");

            return res.status(400).json({
              message: "Cannot bypass this stage.",
            });
        }

        // =====================================================
        // ADMIN BYPASS HR FINAL -> APPROVED
        // =====================================================
        if (currentStatus === STATUS_HR_FINAL) {
          const employeeNo = clean(existing.employee_no);

          const isReapplyRequest =
            Boolean(existing.revoke_effective_date);

          const effectiveDate = isReapplyRequest
            ? toDate(existing.revoke_effective_date)
            : toDate(
                req.body?.effective_date ||
                existing.effective_date
              );

          if (!employeeNo) {
            await client.query("ROLLBACK");

            return res.status(400).json({
              message: "Request has no employee number",
            });
          }

          if (!effectiveDate) {
            await client.query("ROLLBACK");

            return res.status(400).json({
              message:
                "Effective date is required for final approval",
            });
          }

          const finalFile =
            uploadedAttachmentPath ||
            existing.avp_signature_attachment_path ||
            existing.hr_initial_attachment_path ||
            existing.attachment_path ||
            null;

          if (!finalFile) {
            await client.query("ROLLBACK");

            return res.status(400).json({
              message: "Final resignation file is required.",
            });
          }

          const finalName =
            uploadedAttachmentName ||
            existing.avp_signature_attachment_name ||
            existing.hr_initial_attachment_name ||
            existing.approved_attachment_name ||
            null;

          const finalMime =
            uploadedAttachmentMime ||
            existing.avp_signature_attachment_mime ||
            existing.hr_initial_attachment_mime ||
            existing.approved_attachment_mime ||
            null;

          const updateRequest = await client.query(
            `
              UPDATE public.resignation_requests
              SET
                status = $2,
                effective_date = $3::date,

                hr_final_approved_by = $4,
                hr_final_approved_at = NOW(),

                hr_final_attachment_path = $5,
                hr_final_attachment_name = $6,
                hr_final_attachment_mime = $7,

                approved_by = $4,
                approved_at = NOW(),

                attachment_path = $5,
                approved_attachment_path = $5,
                approved_attachment_name = $6,
                approved_attachment_mime = $7,

                rejected_by = NULL,
                rejected_at = NULL,
                rejection_reason = NULL

              WHERE id = $1
              RETURNING *
            `,
            [
              id,
              STATUS_APPROVED,
              effectiveDate,
              req.user?.id ?? null,
              finalFile,
              finalName,
              finalMime,
            ]
          );

          await finalizeApprovedResignation(
            client,
            existing,
            employeeNo,
            effectiveDate
          );

          await client.query("COMMIT");

          return res.json(updateRequest.rows[0]);
        }

        const values = [
          id,
          nextStatus,
          req.user?.id ?? null,
          uploadedAttachmentPath,
          ...extraValues,
        ];

        const updated = await client.query(
          `
            UPDATE public.resignation_requests
            SET
              status = $2,

              ${approverField} = $3,
              ${approverAtField} = NOW(),

              attachment_path =
                COALESCE($4, attachment_path),

              rejected_by = NULL,
              rejected_at = NULL,
              rejection_reason = NULL

              ${extraSet}

            WHERE id = $1
            RETURNING *
          `,
          values
        );

        await client.query("COMMIT");

        return res.json(updated.rows[0]);
      }

      // =====================================================
      // HR INITIAL APPROVAL
      // HR uploads document then sends to AVP for signature.
      // =====================================================
      if (
        isHRDepartment(req) &&
        currentStatus === STATUS_HR
      ) {
        if (!req.file) {
          await client.query("ROLLBACK");

          return res.status(400).json({
            message:
              "HR approval file is required before sending to AVP.",
          });
        }

        const updated = await client.query(
          `
            UPDATE public.resignation_requests
            SET
              status = $2,

              hr_initial_approved_by = $3,
              hr_initial_approved_at = NOW(),

              hr_initial_attachment_path = $4,
              hr_initial_attachment_name = $5,
              hr_initial_attachment_mime = $6,

              attachment_path = $4,
              approved_attachment_name = $5,
              approved_attachment_mime = $6,

              rejected_by = NULL,
              rejected_at = NULL,
              rejection_reason = NULL

            WHERE id = $1
            RETURNING *
          `,
          [
            id,
            STATUS_AVP_SIGNATURE,
            req.user?.id ?? null,
            uploadedAttachmentPath,
            uploadedAttachmentName,
            uploadedAttachmentMime,
          ]
        );

        await client.query("COMMIT");

        return res.json(updated.rows[0]);
      }

      // =====================================================
      // AVP SIGNATURE APPROVAL
      //
      // AVP downloads HR file, signs it, uploads signed file,
      // approves -> HR FINAL
      // =====================================================
      if (
        isAssistantVicePresident(req) &&
        currentStatus === STATUS_AVP_SIGNATURE
      ) {
        if (!req.file) {
          await client.query("ROLLBACK");

          return res.status(400).json({
            message:
              "AVP signed resignation file is required.",
          });
        }

        // Optional but recommended division protection.
        const userDivision = norm(req.user?.division);
        const staffDivision = norm(
          existing.current_staff_division ||
          approvalStaff.division
        );

        if (
          userDivision &&
          staffDivision &&
          userDivision !== staffDivision
        ) {
          await client.query("ROLLBACK");

          return res.status(403).json({
            message:
              "You can only sign resignation requests within your division.",
          });
        }

        const updated = await client.query(
          `
            UPDATE public.resignation_requests
            SET
              status = $2,

              avp_signature_approved_by = $3,
              avp_signature_approved_at = NOW(),

              avp_signature_attachment_path = $4,
              avp_signature_attachment_name = $5,
              avp_signature_attachment_mime = $6,

              attachment_path = $4,
              approved_attachment_name = $5,
              approved_attachment_mime = $6,

              rejected_by = NULL,
              rejected_at = NULL,
              rejection_reason = NULL

            WHERE id = $1
            RETURNING *
          `,
          [
            id,
            STATUS_HR_FINAL,
            req.user?.id ?? null,
            uploadedAttachmentPath,
            uploadedAttachmentName,
            uploadedAttachmentMime,
          ]
        );

        await client.query("COMMIT");

        return res.json(updated.rows[0]);
      }

      // =====================================================
      // HR FINAL APPROVAL
      // =====================================================
      if (
        isHRDepartment(req) &&
        currentStatus === STATUS_HR_FINAL
      ) {
        const employeeNo = clean(existing.employee_no);

        const isReapplyRequest =
          Boolean(existing.revoke_effective_date);

        const effectiveDate = isReapplyRequest
          ? toDate(existing.revoke_effective_date)
          : toDate(
              req.body?.effective_date ||
              existing.effective_date
            );

        if (!employeeNo) {
          await client.query("ROLLBACK");

          return res.status(400).json({
            message: "Request has no employee number",
          });
        }

        if (!effectiveDate) {
          await client.query("ROLLBACK");

          return res.status(400).json({
            message:
              "Effective date is required for final approval",
          });
        }

        const finalFile =
          uploadedAttachmentPath ||
          existing.avp_signature_attachment_path ||
          existing.hr_initial_attachment_path ||
          existing.attachment_path ||
          null;

        if (!finalFile) {
          await client.query("ROLLBACK");

          return res.status(400).json({
            message:
              "AVP signed resignation file is required before HR final approval.",
          });
        }

        const finalName =
          uploadedAttachmentName ||
          existing.avp_signature_attachment_name ||
          existing.hr_initial_attachment_name ||
          existing.approved_attachment_name ||
          null;

        const finalMime =
          uploadedAttachmentMime ||
          existing.avp_signature_attachment_mime ||
          existing.hr_initial_attachment_mime ||
          existing.approved_attachment_mime ||
          null;

        const updateRequest = await client.query(
          `
            UPDATE public.resignation_requests
            SET
              status = $2,
              effective_date = $3::date,

              hr_final_approved_by = $4,
              hr_final_approved_at = NOW(),

              hr_final_attachment_path = $5,
              hr_final_attachment_name = $6,
              hr_final_attachment_mime = $7,

              approved_by = $4,
              approved_at = NOW(),

              attachment_path = $5,
              approved_attachment_path = $5,
              approved_attachment_name = $6,
              approved_attachment_mime = $7,

              rejected_by = NULL,
              rejected_at = NULL,
              rejection_reason = NULL

            WHERE id = $1
            RETURNING *
          `,
          [
            id,
            STATUS_APPROVED,
            effectiveDate,
            req.user?.id ?? null,
            finalFile,
            finalName,
            finalMime,
          ]
        );

        await finalizeApprovedResignation(
          client,
          existing,
          employeeNo,
          effectiveDate
        );

        await client.query("COMMIT");

        return res.json(updateRequest.rows[0]);
      }

      // =====================================================
      // NORMAL MANAGEMENT APPROVAL
      // BM -> AM -> RM -> AVP -> VP -> HR
      // =====================================================
      let nextStatus = null;
      let approverField = null;
      let approverAtField = null;

      if (isBranchManager(req)) {
        if (currentStatus !== STATUS_BRANCH) {
          await client.query("ROLLBACK");

          return res.status(400).json({
            message:
              "This request is not pending Branch Manager approval",
          });
        }

        if (
          !matchBranch(
            getUserBranchId(req),
            existing.branch_id,
            existing.branch_code
          )
        ) {
          await client.query("ROLLBACK");

          return res.status(403).json({
            message:
              "You can only approve resignation requests within your branch",
          });
        }

        nextStatus = await getNextActiveStatus(
          client,
          currentStatus,
          approvalStaff
        );

        approverField = "branch_manager_approved_by";
        approverAtField = "branch_manager_approved_at";
      } else if (isAreaManager(req)) {
        if (currentStatus !== STATUS_AREA) {
          await client.query("ROLLBACK");

          return res.status(400).json({
            message:
              "This request is not pending Area Manager approval",
          });
        }

        const userArea = norm(getUserArea(req));
        const requestArea = norm(
          existing.current_staff_area ||
          existing.area
        );

        if (!userArea || userArea !== requestArea) {
          await client.query("ROLLBACK");

          return res.status(403).json({
            message:
              "You can only approve resignation requests within your area",
          });
        }

        nextStatus = await getNextActiveStatus(
          client,
          currentStatus,
          approvalStaff
        );

        approverField = "area_manager_approved_by";
        approverAtField = "area_manager_approved_at";
      } else if (isRegionalManager(req)) {
        if (currentStatus !== STATUS_RM) {
          await client.query("ROLLBACK");

          return res.status(400).json({
            message:
              "This request is not pending Regional Manager approval",
          });
        }

        let managerRegion = clean(getUserRegion(req));

        const loggedInEmployeeNo = clean(
          req.user?.employee_no ||
          req.user?.employeeNo ||
          req.user?.staff_employee_no
        );

        if (loggedInEmployeeNo) {
          const managerStaffRes = await client.query(
            `
              SELECT region
              FROM public.staff
              WHERE LOWER(TRIM(COALESCE(employee_no, ''))) =
                    LOWER(TRIM($1))
              LIMIT 1
            `,
            [loggedInEmployeeNo]
          );

          if (managerStaffRes.rowCount > 0) {
            managerRegion =
              clean(managerStaffRes.rows[0]?.region) ||
              managerRegion;
          }
        }

        const staffRegion = clean(
          existing.current_staff_region ||
          existing.region
        );

        if (
          !norm(managerRegion) ||
          norm(managerRegion) !== norm(staffRegion)
        ) {
          await client.query("ROLLBACK");

          return res.status(403).json({
            message:
              `Region mismatch. Regional Manager region: ${managerRegion}. ` +
              `Employee region: ${staffRegion}.`,
          });
        }

        nextStatus = await getNextActiveStatus(
          client,
          currentStatus,
          approvalStaff
        );

        approverField = "regional_manager_approved_by";
        approverAtField = "regional_manager_approved_at";
      } else if (isAssistantVicePresident(req)) {
        if (currentStatus !== STATUS_AVP) {
          await client.query("ROLLBACK");

          return res.status(400).json({
            message:
              "This request is not pending Assistant Vice President approval",
          });
        }

        nextStatus = await getNextActiveStatus(
          client,
          currentStatus,
          approvalStaff
        );

        approverField = "avp_approved_by";
        approverAtField = "avp_approved_at";
      } else if (isVicePresident(req)) {
        if (currentStatus !== STATUS_VP) {
          await client.query("ROLLBACK");

          return res.status(400).json({
            message:
              "This request is not pending Vice President approval",
          });
        }

        nextStatus = STATUS_HR;
        approverField = "vp_approved_by";
        approverAtField = "vp_approved_at";
      } else if (isSeniorVicePresident(req)) {
        if (currentStatus !== STATUS_SVP) {
          await client.query("ROLLBACK");

          return res.status(400).json({
            message:
              "This request is not pending Senior Vice President approval",
          });
        }

        nextStatus = STATUS_HR;
        approverField = "svp_approved_by";
        approverAtField = "svp_approved_at";
      } else {
        await client.query("ROLLBACK");

        return res.status(403).json({
          message: "Access denied",
        });
      }

      const updateRes = await client.query(
        `
          UPDATE public.resignation_requests
          SET
            status = $2,

            ${approverField} = $3,
            ${approverAtField} = NOW(),

            rejected_by = NULL,
            rejected_at = NULL,
            rejection_reason = NULL,

            attachment_path =
              COALESCE($4, attachment_path),

            approved_attachment_name =
              COALESCE($5, approved_attachment_name),

            approved_attachment_mime =
              COALESCE($6, approved_attachment_mime)

          WHERE id = $1
          RETURNING *
        `,
        [
          id,
          nextStatus,
          req.user?.id ?? null,
          uploadedAttachmentPath,
          uploadedAttachmentName,
          uploadedAttachmentMime,
        ]
      );

      await client.query("COMMIT");

      return res.json(updateRes.rows[0]);
    } catch (e) {
      try {
        await client.query("ROLLBACK");
      } catch (_) {}

      console.error(
        "PUT /resignation-requests/:id/approve ERROR:",
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

router.put(
  "/resignation-requests/:id/reject",
  requireAuth,
  requirePermission("resignation_request", "reject"),
  async (req, res) => {
    try {
      const id = toInt(req.params.id);
      const reason = clean(req.body?.reason);

      if (!id) return res.status(400).json({ message: "Invalid id" });

      if (!reason) {
        return res.status(400).json({ message: "Rejection reason required" });
      }

      const requestRes = await pool.query(
        `
        SELECT *
        FROM public.resignation_requests
        WHERE id = $1
        `,
        [id]
      );

      if (requestRes.rowCount === 0) {
        return res.status(404).json({ message: "Request not found" });
      }

      const existing = requestRes.rows[0];

      if (!canRejectResignation(req, existing)) {
        return res.status(403).json({
          message: "You cannot reject this resignation request",
        });
      }

      const r = await pool.query(
        `
        UPDATE public.resignation_requests
        SET
          status = $2,
          rejected_by = $3,
          rejected_at = NOW(),
          rejection_reason = $4,
          approved_by = NULL,
          approved_at = NULL
        WHERE id = $1
        RETURNING *;
        `,
        [id, STATUS_REJECTED, req.user?.id ?? null, reason]
      );

      return res.json(r.rows[0]);
    } catch (e) {
      console.error("PUT /resignation-requests/:id/reject ERROR:", e);
      return res.status(500).json({ message: e?.message || "Server error" });
    }
  }
);

router.put(
  "/resignation-requests/:id/revoke",
  requireAuth,
  requirePermission("resignation_request", "approve"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const id = toInt(req.params.id);
      const remarks = clean(req.body?.remarks);

      if (!id) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message: "Invalid id",
        });
      }

      if (!canManageResignationReturn(req)) {
        await client.query("ROLLBACK");

        return res.status(403).json({
          message:
            "Only Admin, HR Department, or Accounting Department can revoke an approved resignation.",
        });
      }

      const requestRes = await client.query(
        `
        SELECT *
        FROM public.resignation_requests
        WHERE id = $1
        FOR UPDATE
        `,
        [id]
      );

      if (requestRes.rowCount === 0) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          message: "Resignation request not found",
        });
      }

      const existing = requestRes.rows[0];

      if (clean(existing.status) !== STATUS_APPROVED) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message:
            "Only approved resignation requests can be revoked.",
        });
      }

      const effectiveDate = toDate(existing.effective_date);

      if (!effectiveDate) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message: "Resignation has no valid effective date.",
        });
      }

      // Use PostgreSQL date so the comparison follows database date.
      const todayRes = await client.query(
        `SELECT CURRENT_DATE::text AS today`
      );

      const today = todayRes.rows[0].today;

      // =====================================================
      // REVOKE ONLY BEFORE THE EFFECTIVE DATE
      // =====================================================
      if (effectiveDate <= today) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message:
            "This resignation has already taken effect. Revoke is no longer allowed. Please use Re-Apply.",
        });
      }

      const employeeNo = clean(existing.employee_no);

      if (!employeeNo) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message: "Request has no employee number",
        });
      }

      // =====================================================
      // MARK RESIGNATION AS REVOKED
      // =====================================================
      const updated = await client.query(
        `
        UPDATE public.resignation_requests
        SET
          status = $2,

          revoke_effective_date = NULL,
          revoke_branch_id = NULL,
          revoke_branch_code = NULL,
          revoke_branch_name = NULL,
          revoke_area = NULL,
          revoke_region = NULL,
          revoke_division = NULL,
          revoke_position = NULL,
          revoke_department = NULL,

          revoke_remarks = $3,
          revoke_requested_by = $4,
          revoke_requested_at = NOW()

        WHERE id = $1

        RETURNING *
        `,
        [
          id,
          STATUS_REVOKED,
          remarks || "Resignation revoked before effective date",
          req.user?.id ?? null,
        ]
      );

      // =====================================================
      // EMPLOYEE REMAINS ACTIVE
      // Remove the future resignation information.
      // =====================================================
      await client.query(
        `
        UPDATE public.staff
        SET
          status = 'Active',
          exit_type = NULL,
          exit_date = NULL,
          exit_remarks = NULL
        WHERE employee_no = $1
        `,
        [employeeNo]
      );

      // =====================================================
      // REMOVE THE FUTURE INACTIVE HISTORY ENTRY
      // It never actually happened because resignation
      // was revoked before the effective date.
      // =====================================================
      await client.query(
        `
        DELETE FROM public.status_history
        WHERE employee_no = $1
          AND effective_date = $2::date
          AND LOWER(TRIM(COALESCE(status, ''))) = 'inactive'
          AND LOWER(TRIM(COALESCE(reason, ''))) = 'resigned'
        `,
        [employeeNo, effectiveDate]
      );

      // Keep history that resignation was revoked.
      try {
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
          VALUES
            (
              $1,
              CURRENT_DATE,
              'Active',
              'Resignation Revoked',
              $2
            )
          ON CONFLICT DO NOTHING
          `,
          [
            employeeNo,
            remarks || "Resignation revoked before effective date",
          ]
        );
      } catch (historyErr) {
        console.warn(
          "status_history revoke insert skipped:",
          historyErr.message
        );
      }

      await client.query("COMMIT");

      return res.json({
        message: "Resignation revoked successfully.",
        request: updated.rows[0],
      });
    } catch (e) {
      await client.query("ROLLBACK");

      console.error(
        "PUT /resignation-requests/:id/revoke ERROR:",
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

router.put(
  "/resignation-requests/:id/reapply",
  requireAuth,
  requirePermission("resignation_request", "approve"),
  upload.single("attachment"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      // Make sure any due resignation is applied first.
      await applyDueResignations();

      await client.query("BEGIN");

      const id = toInt(req.params.id);

      if (!id) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message: "Invalid id",
        });
      }

      if (!canManageResignationReturn(req)) {
        await client.query("ROLLBACK");

        return res.status(403).json({
          message:
            "Only Admin, HR Department, or Accounting Department can submit a Re-Apply request.",
        });
      }

      // =====================================================
      // RE-APPLY FORM
      // =====================================================
      const effective_date = toDate(req.body?.effective_date);
      const branch_id = toInt(req.body?.branch_id);
      const position = clean(req.body?.position);
      const department = clean(req.body?.department);
      const remarks = clean(req.body?.remarks);

      if (!effective_date) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message: "Re-Apply effective date is required",
        });
      }

      if (!branch_id) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message: "Resume branch is required",
        });
      }

      if (!position) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message: "New position is required",
        });
      }

      if (!department) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message: "Department is required",
        });
      }

      if (!req.file) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message: "Re-Apply file is required",
        });
      }

      const requestRes = await client.query(
        `
        SELECT *
        FROM public.resignation_requests
        WHERE id = $1
        FOR UPDATE
        `,
        [id]
      );

      if (requestRes.rowCount === 0) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          message: "Resignation request not found",
        });
      }

      const existing = requestRes.rows[0];

      // Original resignation must already be completed.
      if (clean(existing.status) !== STATUS_APPROVED) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message:
            "Only an approved resignation can be used for Re-Apply.",
        });
      }

      const resignationEffectiveDate = toDate(
        existing.effective_date
      );

      if (!resignationEffectiveDate) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message: "Resignation has no valid effective date.",
        });
      }

      const todayRes = await client.query(
        `SELECT CURRENT_DATE::text AS today`
      );

      const today = todayRes.rows[0].today;

      // =====================================================
      // RE-APPLY ONLY ON/AFTER RESIGNATION EFFECTIVE DATE
      // =====================================================
      if (resignationEffectiveDate > today) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message:
            "The resignation has not taken effect yet. Use Revoke instead of Re-Apply.",
        });
      }

      const employeeNo = clean(existing.employee_no);

      if (!employeeNo) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message: "Request has no employee number",
        });
      }

      // Employee should now be inactive.
      const staffRes = await client.query(
        `
        SELECT
          id,
          status
        FROM public.staff
        WHERE employee_no = $1
        FOR UPDATE
        `,
        [employeeNo]
      );

      if (staffRes.rowCount === 0) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          message: "Staff record not found",
        });
      }

      if (
        norm(staffRes.rows[0].status) !== "inactive"
      ) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message:
            "Staff is not inactive yet. Re-Apply can only be used after the resignation takes effect.",
        });
      }

      const branchRes = await client.query(
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
        [branch_id]
      );

      if (branchRes.rowCount === 0) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          message: "Resume branch not found",
        });
      }

      const branch = branchRes.rows[0];

      const attachmentPath =
        `/uploads/resignation-requests/${req.file.filename}`;

      // =====================================================
      // SEND RE-APPLY TO HR DEPARTMENT FOR FINAL APPROVAL
      // Staff remains INACTIVE until approved.
      // =====================================================

      const updated = await client.query(
        `
        UPDATE public.resignation_requests
        SET
          status = $2,

          revoke_effective_date = $3::date,

          revoke_branch_id = $4,
          revoke_branch_code = $5,
          revoke_branch_name = $6,

          revoke_area = $7,
          revoke_region = $8,
          revoke_division = $9,

          revoke_position = $10,
          revoke_department = $11,
          revoke_remarks = $12,

          revoke_attachment_path = $13,
          revoke_attachment_name = $14,
          revoke_attachment_mime = $15,

          revoke_requested_by = $16,
          revoke_requested_at = NOW(),

          approved_by = NULL,
          approved_at = NULL,

          rejected_by = NULL,
          rejected_at = NULL,
          rejection_reason = NULL,

          attachment_path = $13,

          approved_attachment_path = NULL,
          approved_attachment_name = NULL,
          approved_attachment_mime = NULL

        WHERE id = $1

        RETURNING *
        `,
        [
          id,
          STATUS_HR,

          effective_date,

          branch.id,
          clean(branch.code) || null,
          clean(branch.name) || null,

          clean(branch.area) || null,
          clean(branch.region) || null,
          clean(branch.division) || null,

          position,
          department,
          remarks || null,

          attachmentPath,
          req.file.originalname || null,
          req.file.mimetype || null,

          req.user?.id ?? null,
        ]
      );

      await client.query("COMMIT");

      return res.json({
        message:
          "Re-Apply request submitted for final approval.",
        request: updated.rows[0],
      });
    } catch (e) {
      await client.query("ROLLBACK");

      console.error(
        "PUT /resignation-requests/:id/reapply ERROR:",
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

router.delete(
  "/resignation-requests/:id",
  requireAuth,
  requirePermission("resignation_request", "delete"),
  async (req, res) => {
    try {
      const id = toInt(req.params.id);

      if (!id) return res.status(400).json({ message: "Invalid id" });

      if (!canDeleteResignation(req)) {
        return res.status(403).json({
          message:
            "Only Admin, IT, HR Department, or Accounting Department can delete resignation requests",
        });
      }

      const check = await pool.query(
        `
        SELECT status, attachment_path
        FROM public.resignation_requests
        WHERE id = $1
        `,
        [id]
      );

      if (check.rowCount === 0) {
        return res.status(404).json({ message: "Request not found" });
      }

      const row = check.rows[0];

      if (norm(row.status) === norm(STATUS_APPROVED)) {
        return res.status(400).json({
          message: "Approved requests cannot be deleted. Use revoke instead.",
        });
      }

      const attachmentPath = row.attachment_path;

      await pool.query(
        `
        DELETE FROM public.resignation_requests
        WHERE id = $1
        `,
        [id]
      );

      if (attachmentPath) {
        const absolutePath = path.join(
          process.cwd(),
          attachmentPath.replace(/^\/+/, "")
        );

        fs.unlink(absolutePath, () => {});
      }

      return res.json({ message: "Deleted" });
    } catch (e) {
      console.error("DELETE /resignation-requests/:id ERROR:", e);
      return res.status(500).json({ message: e?.message || "Server error" });
    }
  }
);

module.exports = router;