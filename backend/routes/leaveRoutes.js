const express = require("express");
const router = express.Router();
const pool = require("../db");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const { requireAuth } = require("../middlewares/authMiddleware");
const { requirePermission } = require("../middlewares/permissionMiddleware");

const toStr = (v) => String(v ?? "").trim();
const norm = (v) => toStr(v).toLowerCase();

const roleLower = (req) => norm(req.user?.role);

const isAdmin = (req) => roleLower(req) === "admin";
const isAdminOrIT = (req) => ["admin", "it"].includes(roleLower(req));
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

const getUserBranchCode = (req) => toStr(req.user?.branch_id);
const getUserArea = (req) => toStr(req.user?.area);
const getUserRegion = (req) => toStr(req.user?.region);
const getUserDivision = (req) => toStr(req.user?.division);
const getUserDepartment = (req) => toStr(req.user?.department);

const OPERATION_DEPARTMENTS = [
  "operation",
  "operations",
  "operation department",
  "operations department",
  "payroll",
  "payroll department",
];

const isOperationDepartment = (department) =>
  OPERATION_DEPARTMENTS.includes(norm(department));

const isHrDepartmentUser = (req) => {
  const d = norm(req.user?.department);
  return d === "hr" || d === "hr department" || d === "human resources" || d === "human resources department";
};

const isBypassApprover = (req) =>
  isAdminOrIT(req) || isAccounting(req) || isHrDepartmentUser(req);

const isFinalApprover = (req) => isHrDepartmentUser(req);

const canUploadApprovedLeave = (req) =>
  isAdminOrIT(req) || isAccounting(req) || isHrDepartmentUser(req);

const departmentCanViewOwnDepartment = (department) => {
  const d = norm(department);

  return [
    "tread",
    "tread department",
    "it",
    "it department",
    "hr",
    "hr department",
    "human resources",
    "human resources department",
    "audit",
    "audit department",
    "accounting",
    "accounting department",
    "production & logistic",
    "production & logistic department",
    "production and logistic",
    "production and logistic department",
  ].includes(d);
};

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

const diffDaysInclusive = (startDate, endDate) => {
  const a = new Date(startDate);
  const b = new Date(endDate);

  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;

  const ms = b.setHours(0, 0, 0, 0) - a.setHours(0, 0, 0, 0);
  return Math.floor(ms / 86400000) + 1;
};

const buildStaffName = (staff) => {
  if (!staff) return "";

  return (
    toStr(staff.fullname) ||
    [staff.first_name, staff.middle_name, staff.last_name]
      .map(toStr)
      .filter(Boolean)
      .join(" ")
  );
};

const leaveUploadDir = path.join(
  __dirname,
  "..",
  "uploads",
  "leave_attachments"
);

fs.mkdirSync(leaveUploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, leaveUploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    cb(null, `leave_${Date.now()}_${Math.random().toString(16).slice(2)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
});

const baseLeaveSelect = `
  SELECT
    lr.id,

    COALESCE(
      NULLIF(TRIM(lr.staff_name), ''),
      NULLIF(TRIM(s.fullname), ''),
      NULLIF(TRIM(CONCAT_WS(' ', s.first_name, s.middle_name, s.last_name)), ''),
      '-'
    ) AS staff_name,

    lr.leave_type,
    lr.start_date,
    lr.end_date,
    lr.status,
    lr.transaction_code,
    lr.entry_date,
    lr.employee_id,
    lr.date_created,
    lr.total_no_of_days,
    lr.reason,
    lr.area_approved_by,
    lr.area_approved_at,
    lr.regional_approved_by,
    lr.regional_approved_at,
    lr.division_approved_by,
    lr.division_approved_at,
    lr.admin_approved_by,
    lr.admin_approved_at,
    lr.rejection_reason,

    s.employee_no,
    s.area,
    s.region,
    s.division,
    s.branch_id,
    b.code AS branch_code,
    b.name AS branch_name,
    s.department,
    s.position,
    s.photo_url,

    req_file.file_name AS request_attachment_name,
    req_file.file_path AS request_attachment_path,
    req_file.file_mime AS request_attachment_mime,
    req_file.file_size AS request_attachment_size,
    req_file.uploaded_by_role AS request_uploaded_by_role,

    appr_file.file_name AS approved_attachment_name,
    appr_file.file_path AS approved_attachment_path,
    appr_file.file_mime AS approved_attachment_mime,
    appr_file.file_size AS approved_attachment_size,
    appr_file.uploaded_by_role AS approved_uploaded_by_role

  FROM public.leave_requests lr
  LEFT JOIN public.staff s ON s.id = lr.employee_id
  LEFT JOIN public.branches b ON b.id = s.branch_id

  LEFT JOIN LATERAL (
    SELECT file_name, file_path, file_mime, file_size, uploaded_by_role
    FROM public.leave_attachments
    WHERE leave_request_id = lr.id
      AND attachment_type = 'request'
    ORDER BY id DESC
    LIMIT 1
  ) req_file ON true

  LEFT JOIN LATERAL (
    SELECT file_name, file_path, file_mime, file_size, uploaded_by_role
    FROM public.leave_attachments
    WHERE leave_request_id = lr.id
      AND attachment_type = 'approved'
    ORDER BY id DESC
    LIMIT 1
  ) appr_file ON true
`;

const isVicePresidentPosition = (position) => {
  const pos = norm(position);
  return pos === "vice president" || pos === "vp";
};

const isSeniorVicePresidentPosition = (position) => {
  const pos = norm(position);
  return pos === "senior vice president" || pos === "svp";
};

const sameDepartment = (a, b) => {
  return norm(a) === norm(b);
};

const ROLE_ALIASES = {
  area_manager: ["area manager", "acting area manager"],
  regional_manager: ["regional manager", "acting regional manager"],
  assistant_vice_president: ["assistant vice president", "avp"],
  vice_president: ["vice president", "vp"],
  senior_vice_president: ["senior vice president", "svp"],
};

const STATUS_TO_ROLE_KEY = {
  "Pending Area Manager": "area_manager",
  "Pending Regional Manager": "regional_manager",
  "Pending Assistant Vice President": "assistant_vice_president",
  "Pending Vice President": "vice_president",
  "Pending Senior Vice President": "senior_vice_president",
};

const ROLE_KEY_TO_STATUS = {
  area_manager: "Pending Area Manager",
  regional_manager: "Pending Regional Manager",
  assistant_vice_president: "Pending Assistant Vice President",
  vice_president: "Pending Vice President",
  senior_vice_president: "Pending Senior Vice President",
};

/*
  Skip rule:
  If the next approver role does not exist inside the SAME department,
  skip to the next role.

  Example:
  IT Department has Area Manager but no Regional Manager.
  Flow:
  Area Manager -> Assistant Vice President -> Vice President -> HR
*/
const approverRoleExistsInDepartment = async (roleKey, department) => {
  const dept = toStr(department);
  const roles = ROLE_ALIASES[roleKey] || [];

  if (!dept || roles.length === 0) return false;

  const rolePlaceholders = roles.map((_, idx) => `$${idx + 2}`).join(",");

  const r = await pool.query(
    `
    SELECT id
    FROM public.users
    WHERE LOWER(TRIM(COALESCE(department,''))) = LOWER(TRIM($1))
      AND LOWER(TRIM(COALESCE(role,''))) IN (${rolePlaceholders})
      AND LOWER(TRIM(COALESCE(status,'Active'))) = 'active'
    LIMIT 1
    `,
    [dept, ...roles]
  );

  return r.rowCount > 0;
};

const getNextStatusByDepartmentChain = async (department, roleKeys) => {
  for (const roleKey of roleKeys) {
    const exists = await approverRoleExistsInDepartment(roleKey, department);

    if (exists) {
      return ROLE_KEY_TO_STATUS[roleKey];
    }
  }

  return "Pending HR";
};

/*
  Initial status depends on the creator role.

  Branch Manager / lower:
    Area Manager -> Regional Manager -> AVP -> VP -> HR

  Area Manager:
    Regional Manager -> AVP -> VP -> HR

  Regional Manager:
    AVP -> VP -> HR

  AVP:
    VP -> HR

  VP:
    SVP -> HR

  SVP:
    HR
*/
const getInitialStatusByDepartment = async (req, staff) => {
  const department = toStr(staff?.department);
  const position = toStr(staff?.position);

  if (isSeniorVicePresident(req) || isSeniorVicePresidentPosition(position)) {
    return "Pending HR";
  }

  if (isVicePresident(req) || isVicePresidentPosition(position)) {
    return await getNextStatusByDepartmentChain(department, [
      "senior_vice_president",
    ]);
  }

  if (isAssistantVicePresident(req)) {
    return await getNextStatusByDepartmentChain(department, [
      "vice_president",
    ]);
  }

  if (isRegionalManager(req)) {
    return await getNextStatusByDepartmentChain(department, [
      "assistant_vice_president",
      "vice_president",
    ]);
  }

  if (isAreaManager(req)) {
    return await getNextStatusByDepartmentChain(department, [
      "regional_manager",
      "assistant_vice_president",
      "vice_president",
    ]);
  }

  return await getNextStatusByDepartmentChain(department, [
    "area_manager",
    "regional_manager",
    "assistant_vice_president",
    "vice_president",
  ]);
};

const getNextStatusAfterApproval = async (currentStatus, row) => {
  const department = toStr(row.department);

  if (currentStatus === "Pending Branch Manager") {
    return await getNextStatusByDepartmentChain(department, [
      "area_manager",
      "regional_manager",
      "assistant_vice_president",
      "vice_president",
    ]);
  }

  if (currentStatus === "Pending Area Manager") {
    return await getNextStatusByDepartmentChain(department, [
      "regional_manager",
      "assistant_vice_president",
      "vice_president",
    ]);
  }

  if (currentStatus === "Pending Regional Manager") {
    return await getNextStatusByDepartmentChain(department, [
      "assistant_vice_president",
      "vice_president",
    ]);
  }

  if (currentStatus === "Pending Assistant Vice President") {
    return await getNextStatusByDepartmentChain(department, [
      "vice_president",
    ]);
  }

  if (currentStatus === "Pending Vice President") {
    const position = norm(row.position);

    if (isOperationDepartment(department) && isVicePresidentPosition(position)) {
      return await getNextStatusByDepartmentChain(department, [
        "senior_vice_president",
      ]);
    }

    return "Pending HR";
  }

  if (currentStatus === "Pending Senior Vice President") {
    return "Pending HR";
  }

  return "Pending HR";
};

const isCurrentStageApprover = (req, row) => {
  const status = toStr(row.status);
  const requestDepartment = toStr(row.department);
  const userDepartment = getUserDepartment(req);

  if (isBypassApprover(req) || isPresident(req)) return true;

  if (status === "Pending Area Manager") {
    return isAreaManager(req) && sameDepartment(userDepartment, requestDepartment);
  }

  if (status === "Pending Regional Manager") {
    return (
      isRegionalManager(req) && sameDepartment(userDepartment, requestDepartment)
    );
  }

  if (status === "Pending Assistant Vice President") {
    return (
      isAssistantVicePresident(req) &&
      sameDepartment(userDepartment, requestDepartment)
    );
  }

  if (status === "Pending Vice President") {
    return isVicePresident(req) && sameDepartment(userDepartment, requestDepartment);
  }

  if (status === "Pending Senior Vice President") {
    return (
      isSeniorVicePresident(req) &&
      sameDepartment(userDepartment, requestDepartment)
    );
  }

  if (status === "Pending HR") {
    return isHrDepartmentUser(req);
  }

  return false;
};

const canActOnLeave = async (req, leaveId) => {
  const r = await pool.query(
    `
    SELECT
      lr.id,
      lr.status,
      lr.employee_id,
      s.area,
      s.branch_id,
      s.region,
      s.division,
      s.department,
      s.position
    FROM public.leave_requests lr
    JOIN public.staff s ON s.id = lr.employee_id
    WHERE lr.id = $1
    LIMIT 1
    `,
    [leaveId]
  );

  if (r.rowCount === 0) {
    return { ok: false, code: 404, message: "Leave request not found" };
  }

  const row = r.rows[0];
  const status = toStr(row.status);

  if (status === "Rejected" || status === "Approved" || status === "Voided") {
    return {
      ok: false,
      code: 400,
      message: `Leave already ${status.toLowerCase()}`,
    };
  }

  if (status === "Pending HR") {
    if (!isHrDepartmentUser(req)) {
      return {
        ok: false,
        code: 403,
        message: "Only HR Department can final approve this leave",
      };
    }

    return { ok: true, row };
  }

  if (!isCurrentStageApprover(req, row)) {
    return {
      ok: false,
      code: 403,
      message: "You are not allowed to approve this leave request stage.",
    };
  }

  return { ok: true, row };
};

const deleteOldApprovedAttachments = async (client, leaveId) => {
  const oldFiles = await client.query(
    `
    SELECT file_path
    FROM public.leave_attachments
    WHERE leave_request_id = $1
      AND attachment_type = 'approved'
    `,
    [leaveId]
  );

  for (const old of oldFiles.rows) {
    try {
      const rel = String(old.file_path || "").replace(/^\/uploads\//, "");
      const oldPath = path.join(__dirname, "..", "uploads", rel);

      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    } catch (e) {
      console.error("DELETE OLD LEAVE FILE ERROR:", e.message);
    }
  }

  await client.query(
    `
    DELETE FROM public.leave_attachments
    WHERE leave_request_id = $1
      AND attachment_type = 'approved'
    `,
    [leaveId]
  );
};

const insertApprovedAttachment = async (client, leaveId, file, req) => {
  await deleteOldApprovedAttachments(client, leaveId);

  await client.query(
    `
    INSERT INTO public.leave_attachments
    (
      leave_request_id,
      file_name,
      file_path,
      file_mime,
      file_size,
      attachment_type,
      uploaded_by,
      uploaded_by_role
    )
    VALUES
    (
      $1,$2,$3,$4,$5,
      'approved',$6,$7
    )
    `,
    [
      leaveId,
      file.originalname || null,
      `/uploads/leave_attachments/${file.filename}`,
      file.mimetype || null,
      file.size || null,
      req.user?.id ?? null,
      roleLower(req),
    ]
  );
};

async function applyIndefiniteLeaveEffectiveDates(client = pool) {
  await client.query(`
    UPDATE public.staff s
    SET status = 'Inactive'
    FROM public.leave_requests lr
    WHERE lr.employee_id = s.id
      AND lr.leave_type = 'Indefinite Leave'
      AND lr.status = 'Approved'
      AND lr.start_date IS NOT NULL
      AND lr.start_date::date <= CURRENT_DATE
      AND COALESCE(s.status, '') <> 'Inactive'
  `);
}

router.get(
  "/leave-requests",
  requireAuth,
  requirePermission("leave_request", "view"),
  async (req, res) => {
    try {
      await applyIndefiniteLeaveEffectiveDates();
      if (
        isAdminOrIT(req) ||
        isAccounting(req) ||
        isFinalApprover(req) ||
        isVicePresident(req) ||
        isSeniorVicePresident(req) ||
        isPresident(req)
      ) {
        const r = await pool.query(`
          ${baseLeaveSelect}
          ORDER BY lr.entry_date DESC NULLS LAST, lr.id DESC
        `);

        return res.json(r.rows);
      }

      const department = getUserDepartment(req);

      if (departmentCanViewOwnDepartment(department)) {
        const r = await pool.query(
          `
          ${baseLeaveSelect}
          WHERE LOWER(TRIM(COALESCE(s.department,''))) = LOWER(TRIM($1))
          ORDER BY lr.entry_date DESC NULLS LAST, lr.id DESC
          `,
          [department]
        );

        return res.json(r.rows);
      }

      if (isBranchManager(req)) {
        const bid = await getBranchIdFromCode(getUserBranchCode(req));
        if (!bid) return res.json([]);

        const r = await pool.query(
          `
          ${baseLeaveSelect}
          WHERE s.branch_id = $1
          ORDER BY lr.entry_date DESC NULLS LAST, lr.id DESC
          `,
          [bid]
        );

        return res.json(r.rows);
      }

      if (isAreaManager(req)) {
        const r = await pool.query(
          `
          ${baseLeaveSelect}
          WHERE LOWER(TRIM(COALESCE(s.area,''))) = LOWER(TRIM($1))
          ORDER BY lr.entry_date DESC NULLS LAST, lr.id DESC
          `,
          [getUserArea(req)]
        );

        return res.json(r.rows);
      }

      if (isRegionalManager(req)) {
        const r = await pool.query(
          `
          ${baseLeaveSelect}
          WHERE LOWER(TRIM(COALESCE(s.region,''))) = LOWER(TRIM($1))
          ORDER BY lr.entry_date DESC NULLS LAST, lr.id DESC
          `,
          [getUserRegion(req)]
        );

        return res.json(r.rows);
      }

      if (isAssistantVicePresident(req)) {
        const r = await pool.query(
          `
          ${baseLeaveSelect}
          WHERE LOWER(TRIM(COALESCE(s.division, ''))) = LOWER(TRIM($1))
          ORDER BY lr.entry_date DESC NULLS LAST, lr.id DESC
          `,
          [getUserDivision(req)]
        );

        return res.json(r.rows);
      }

      return res.status(403).json({ message: "Access denied" });
    } catch (e) {
      console.error("GET /api/leave-requests ERROR:", e.message);
      return res.status(500).json({ message: e?.message || "Server error" });
    }
  }
);

router.post(
  "/leave-requests",
  requireAuth,
  requirePermission("leave_request", "create"),
  upload.single("attachment"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const { employee_id, leave_type, date_created, start_date, end_date, reason } =
        req.body;

      if (!employee_id) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "employee_id is required" });
      }

      const staffRes = await client.query(
        `
        SELECT id, fullname, department, position, first_name, middle_name, last_name
        FROM public.staff
        WHERE id = $1
        LIMIT 1
        `,
        [employee_id]
      );

      if (staffRes.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Staff not found" });
      }

      const staff = staffRes.rows[0];
      const staffName = buildStaffName(staff);
      const isIndefiniteLeave = leave_type === "Indefinite Leave";

      let total_no_of_days = 0;
      if (!isIndefiniteLeave) {
        total_no_of_days = diffDaysInclusive(start_date, end_date);
      }

      const seqRes = await client.query(`
        SELECT nextval('public.leave_requests_id_seq') AS n
      `);

      const leaveSeq = Number(seqRes.rows[0].n);
      const transaction_code = `LV-${String(leaveSeq).padStart(7, "0")}`;
      const status = await getInitialStatusByDepartment(req, staff);

      const insertRes = await client.query(
        `
        INSERT INTO public.leave_requests (
          id,
          employee_id,
          staff_name,
          leave_type,
          date_created,
          start_date,
          end_date,
          total_no_of_days,
          reason,
          status,
          transaction_code,
          entry_date
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW()
        )
        RETURNING *
        `,
        [
          leaveSeq,
          employee_id,
          staffName || null,
          leave_type,
          date_created,
          start_date,
          isIndefiniteLeave ? null : end_date,
          total_no_of_days,
          reason || null,
          status,
          transaction_code,
        ]
      );

      const leaveId = insertRes.rows[0].id;

      if (req.file) {
        await client.query(
          `
          INSERT INTO public.leave_attachments
          (
            leave_request_id,
            file_name,
            file_path,
            file_mime,
            file_size,
            attachment_type,
            uploaded_by,
            uploaded_by_role
          )
          VALUES (
            $1,$2,$3,$4,$5,
            'request',$6,$7
          )
          `,
          [
            leaveId,
            req.file.originalname || null,
            `/uploads/leave_attachments/${req.file.filename}`,
            req.file.mimetype || null,
            req.file.size || null,
            req.user?.id ?? null,
            roleLower(req),
          ]
        );
      }

      await client.query("COMMIT");

      const finalRow = await pool.query(`${baseLeaveSelect} WHERE lr.id = $1`, [
        leaveId,
      ]);

      return res.json(finalRow.rows[0]);
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("CREATE LEAVE ERROR:", err.message);
      return res.status(500).json({ message: err.message });
    } finally {
      client.release();
    }
  }
);

router.post(
  "/leave-requests/:id/approved-file",
  requireAuth,
  requirePermission("leave_request", "upload_approved"),
  upload.single("attachment"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const leaveId = String(req.params.id || "").trim();

      if (!req.file) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Attachment is required" });
      }

      if (!canUploadApprovedLeave(req)) {
        await client.query("ROLLBACK");
        return res.status(403).json({ message: "Access denied" });
      }

      await insertApprovedAttachment(client, leaveId, req.file, req);

      await client.query("COMMIT");

      return res.json({ message: "Approved leave file uploaded" });
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("UPLOAD APPROVED FILE ERROR:", e.message);
      return res.status(500).json({ message: e?.message || "Server error" });
    } finally {
      client.release();
    }
  }
);

router.put(
  "/leave-requests/:id",
  requireAuth,
  requirePermission("leave_request", "approve"),
  upload.single("attachment"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const id = String(req.params.id || "").trim();
      const action = String(req.body?.action || "").trim().toLowerCase();

      const access = await canActOnLeave(req, id);

      if (!access.ok) {
        await client.query("ROLLBACK");
        return res.status(access.code).json({ message: access.message });
      }

      const currentStatus = toStr(access.row.status);

      if (action === "reject") {
        await client.query(
          `
          UPDATE public.leave_requests
          SET
            status = 'Rejected',
            rejection_reason = $2
          WHERE id = $1
          `,
          [id, toStr(req.body?.rejection_reason) || "Rejected by approver"]
        );

        await client.query("COMMIT");

        const finalRow = await pool.query(`${baseLeaveSelect} WHERE lr.id = $1`, [
          id,
        ]);

        return res.json(finalRow.rows[0]);
      }

      if (action !== "approve") {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Invalid action" });
      }

      if (!req.file) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message:
            "Please upload the signed/approved leave file before approving. This file will replace the previous file for the next approver.",
        });
      }

      await insertApprovedAttachment(client, id, req.file, req);

      let sql = "";
      let params = [id, req.user?.id ?? null];

            if (currentStatus === "Pending HR") {
              if (!isHrDepartmentUser(req)) {
                await client.query("ROLLBACK");
                return res.status(403).json({
                  message: "Only HR Department can final approve leave.",
                });
              }

              sql = `
                UPDATE public.leave_requests
                SET
                  status = 'Approved',
                  admin_approved_by = $2,
                  admin_approved_at = NOW()
                WHERE id = $1
              `;
              params = [id, req.user?.id ?? null];
            } else if (currentStatus === "Pending Branch Manager") {
              const nextStatus = await getNextStatusAfterApproval(
                currentStatus,
                access.row
              );

              sql = `
                UPDATE public.leave_requests
                SET status = $2
                WHERE id = $1
              `;
              params = [id, nextStatus];
            } else if (currentStatus === "Pending Area Manager") {
              const nextStatus = await getNextStatusAfterApproval(
                currentStatus,
                access.row
              );

              sql = `
                UPDATE public.leave_requests
                SET
                  status = $3,
                  area_approved_by = $2,
                  area_approved_at = NOW()
                WHERE id = $1
              `;
              params = [id, req.user?.id ?? null, nextStatus];
            } else if (currentStatus === "Pending Regional Manager") {
              const nextStatus = await getNextStatusAfterApproval(
                currentStatus,
                access.row
              );

              sql = `
                UPDATE public.leave_requests
                SET
                  status = $3,
                  regional_approved_by = $2,
                  regional_approved_at = NOW()
                WHERE id = $1
              `;
              params = [id, req.user?.id ?? null, nextStatus];
            } else if (currentStatus === "Pending Assistant Vice President") {
              const nextStatus = await getNextStatusAfterApproval(
                currentStatus,
                access.row
              );

              sql = `
                UPDATE public.leave_requests
                SET
                  status = $3,
                  division_approved_by = $2,
                  division_approved_at = NOW()
                WHERE id = $1
              `;
              params = [id, req.user?.id ?? null, nextStatus];
            } else if (currentStatus === "Pending Vice President") {
              const nextStatus = await getNextStatusAfterApproval(
                currentStatus,
                access.row
              );

              sql = `
                UPDATE public.leave_requests
                SET
                  status = $3,
                  admin_approved_by = $2,
                  admin_approved_at = NOW()
                WHERE id = $1
              `;
              params = [id, req.user?.id ?? null, nextStatus];
            } else if (currentStatus === "Pending Senior Vice President") {
              sql = `
                UPDATE public.leave_requests
                SET
                  status = 'Pending HR',
                  admin_approved_by = $2,
                  admin_approved_at = NOW()
                WHERE id = $1
              `;
              params = [id, req.user?.id ?? null];
            } else {
              await client.query("ROLLBACK");
              return res.status(400).json({ message: "Invalid current status for approval" });
            }

      await client.query(sql, params);
      await applyIndefiniteLeaveEffectiveDates(client);
      await client.query("COMMIT");

      const finalRow = await pool.query(`${baseLeaveSelect} WHERE lr.id = $1`, [
        id,
      ]);

      return res.json(finalRow.rows[0]);
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("PUT /api/leave-requests/:id ERROR:", e.message);
      return res.status(500).json({ message: e?.message || "Server error" });
    } finally {
      client.release();
    }
  }
);

router.put(
  "/leave-requests/:id/void",
  requireAuth,
  requirePermission("leave_request", "delete"),
  async (req, res) => {
    try {
      if (!(isAdmin(req) || isHrDepartmentUser(req))) {
          return res.status(403).json({
              message: "Only Admin or HR Department can void approved leave.",
          });
      }

      const id = String(req.params.id || "").trim();

      const r = await pool.query(
        `
        UPDATE public.leave_requests
        SET status = 'Voided'
        WHERE id = $1
          AND status = 'Approved'
        RETURNING *
        `,
        [id]
      );

      if (r.rowCount === 0) {
        return res.status(400).json({
          message: "Only approved leave can be voided.",
        });
      }

      return res.json({
        message: "Leave request voided.",
        leave: r.rows[0],
      });
    } catch (e) {
      console.error("VOID LEAVE ERROR:", e.message);
      return res.status(500).json({ message: e?.message || "Server error" });
    }
  }
);

router.delete(
  "/leave-requests/:id",
  requireAuth,
  requirePermission("leave_request", "delete"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      if (!(isAdmin(req) || isHrDepartmentUser(req))) {
          return res.status(403).json({
              message: "Only Admin or HR Department can delete rejected or voided leave.",
          });
      }

      const id = String(req.params.id || "").trim();

      await client.query("BEGIN");

      const chk = await client.query(
        `
        SELECT id, status
        FROM public.leave_requests
        WHERE id = $1
        `,
        [id]
      );

      if (chk.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Leave request not found." });
      }

      if (!["Rejected", "Voided"].includes(toStr(chk.rows[0].status))) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: "Only rejected leave can be deleted.",
        });
      }

      const files = await client.query(
        `
        SELECT file_path
        FROM public.leave_attachments
        WHERE leave_request_id = $1
        `,
        [id]
      );

      await client.query(
        `
        DELETE FROM public.leave_attachments
        WHERE leave_request_id = $1
        `,
        [id]
      );

      await client.query(
        `
        DELETE FROM public.leave_requests
        WHERE id = $1
        `,
        [id]
      );

      await client.query("COMMIT");

      for (const f of files.rows) {
        try {
          const rel = String(f.file_path || "").replace(/^\/uploads\//, "");
          const absPath = path.join(__dirname, "..", "uploads", rel);

          if (fs.existsSync(absPath)) {
            fs.unlinkSync(absPath);
          }
        } catch (e) {
          console.error("DELETE LEAVE FILE ERROR:", e.message);
        }
      }

      return res.json({ message: "Leave request deleted." });
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("DELETE LEAVE ERROR:", e.message);
      return res.status(500).json({ message: e?.message || "Server error" });
    } finally {
      client.release();
    }
  }
);

router.get(
  "/leave-requests/staff/:staffId",
  requireAuth,
  requirePermission("leave_request", "view"),
  async (_req, res) => {
    try {
      const staffId = Number(_req.params.staffId);

      if (!Number.isFinite(staffId)) {
        return res.status(400).json({ message: "Invalid staff id" });
      }

      const result = await pool.query(
        `
        SELECT *
        FROM public.leave_requests
        WHERE employee_id = $1
        ORDER BY entry_date DESC NULLS LAST, id DESC
        `,
        [staffId]
      );

      return res.json(result.rows);
    } catch (err) {
      console.error("GET /leave-requests/staff/:staffId ERROR:", err.message);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

router.get(
  "/leave-requests/:id/download/:type",
  requireAuth,
  requirePermission("leave_request", "view"),
  async (req, res) => {
    try {
      const leaveId = String(req.params.id || "").trim();
      const type = String(req.params.type || "").trim().toLowerCase();

      if (!["request", "approved", "latest"].includes(type)) {
        return res.status(400).json({
          message: "Invalid attachment type",
        });
      }

      if (type === "latest") {
        const latest = await pool.query(
          `
          SELECT file_name, file_path, file_mime
          FROM public.leave_attachments
          WHERE leave_request_id = $1
            AND attachment_type IN ('approved', 'request')
          ORDER BY
            CASE WHEN attachment_type = 'approved' THEN 1 ELSE 2 END,
            id DESC
          LIMIT 1
          `,
          [leaveId]
        );

        if (latest.rowCount === 0) {
          return res.status(404).json({ message: "File not found" });
        }

        const row = latest.rows[0];
        const rel = String(row.file_path || "").replace(/^\/uploads\//, "");
        const absPath = path.join(__dirname, "..", "uploads", rel);

        if (!fs.existsSync(absPath)) {
          return res.status(404).json({ message: "Physical file missing" });
        }

        return res.download(absPath, row.file_name || undefined);
      }

      const r = await pool.query(
        `
        SELECT file_name, file_path, file_mime
        FROM public.leave_attachments
        WHERE leave_request_id = $1
          AND attachment_type = $2
        ORDER BY id DESC
        LIMIT 1
        `,
        [leaveId, type]
      );

      if (r.rowCount === 0) {
        return res.status(404).json({ message: "File not found" });
      }

      const row = r.rows[0];
      const rel = String(row.file_path || "").replace(/^\/uploads\//, "");
      const absPath = path.join(__dirname, "..", "uploads", rel);

      if (!fs.existsSync(absPath)) {
        return res.status(404).json({ message: "Physical file missing" });
      }

      return res.download(absPath, row.file_name || undefined);
    } catch (e) {
      console.error("DOWNLOAD LEAVE FILE ERROR:", e.message);
      return res.status(500).json({ message: e?.message || "Server error" });
    }
  }
);

router.put(
  "/leave-requests/:id/return-to-work",
  requireAuth,
  requirePermission("leave_request", "approve"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      if (!(isAdminOrIT(req) || isHrDepartmentUser(req))) {
        return res.status(403).json({
          message: "Only Admin, IT, or HR Department can return staff to work.",
        });
      }

      const id = String(req.params.id || "").trim();

      await client.query("BEGIN");

      const r = await client.query(
        `
        SELECT id, employee_id, leave_type, status
        FROM public.leave_requests
        WHERE id = $1
        FOR UPDATE
        `,
        [id]
      );

      if (r.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Leave request not found." });
      }

      const row = r.rows[0];

      if (row.leave_type !== "Indefinite Leave" || row.status !== "Approved") {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: "Only approved Indefinite Leave can be returned to work.",
        });
      }

      await client.query(
        `
        UPDATE public.staff
        SET status = 'Active'
        WHERE id = $1
        `,
        [row.employee_id]
      );

      await client.query(
        `
        UPDATE public.leave_requests
        SET status = 'Returned to Work'
        WHERE id = $1
        `,
        [id]
      );

      await client.query("COMMIT");

      return res.json({ message: "Staff returned to work." });
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("RETURN TO WORK ERROR:", e.message);
      return res.status(500).json({ message: e.message || "Server error" });
    } finally {
      client.release();
    }
  }
);

module.exports = router;