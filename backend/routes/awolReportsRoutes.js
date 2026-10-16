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
  isBranchManager,
  isAreaManager,
  isRegionalManager,
  isAssistantVicePresident,
  isVicePresident,
  isSeniorVicePresident,
  isPresident,
  isTread,
} = require("../utils/roleAccess");

const STATUS_AREA = "Waiting Area Manager Approval";
const STATUS_REGIONAL = "Waiting Regional Manager Approval";
const STATUS_AVP = "Waiting Assistant Vice President Approval";
const STATUS_VP = "Waiting Vice President Approval";
const STATUS_HR = "Waiting HR Department Approval";
const STATUS_WAITING_FINAL = "Waiting Final File Upload";
const STATUS_APPROVED = "Approved";
const STATUS_REJECTED = "Rejected";
const STATUS_VOID = "Voided";

const REPORT_TYPES = [
  "AWOL Report",
  "Incident Report",
  "Notice to Explain",
];

const toStr = (v) => String(v ?? "").trim();
const norm = (v) => toStr(v).toLowerCase();

const toInt = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

const toDateOrNull = (v) => {
  const s = toStr(v);
  if (!s) return null;

  const d = s.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
};

const normalizeReportType = (v) => {
  const input = toStr(v);

  return REPORT_TYPES.find(
    (type) => norm(type) === norm(input)
  ) || null;
};

const prefixByReportType = (reportType) => {
  const t = norm(reportType);

  if (t === "incident report") return "INC";

  if (t === "notice to explain") return "NTE";

  return "AWOL";
};

const dateLabelByReportType = (reportType) => {
  const t = norm(reportType);

  if (t === "incident report") return "Incident Date";

  if (t === "notice to explain") return "Notice Date";

  return "AWOL Date";
};

const getUserDepartment = (req) =>
  norm(
    req.user?.department ||
      req.user?.department_name ||
      req.user?.departmentName ||
      req.user?.user_department ||
      req.user?.dept
  );

const isHRDepartmentUser = (req) =>
  isHr(req) ||
  [
    "hr",
    "hr department",
    "human resources",
    "human resources department",
  ].includes(getUserDepartment(req));

const isAccountingDepartmentUser = (req) =>
  isAccounting(req) ||
  [
    "accounting",
    "accounting department",
  ].includes(getUserDepartment(req));

const isAuditDepartmentUser = (req) =>
  ["audit", "audit department"].includes(
    norm(
      req.user?.department ||
        req.user?.department_name ||
        req.user?.departmentName ||
        req.user?.user_department ||
        req.user?.dept
    )
  );

const isOperationDepartmentUser = (req) =>
  ["operation", "operation department"].includes(
    getUserDepartment(req)
  );

const canCreateReport = (req) => {
  if (isOperationDepartmentUser(req)) {
    return (
      isAreaManager(req) ||
      isRegionalManager(req) ||
      isAssistantVicePresident(req) ||
      isVicePresident(req)
    );
  }

  return (
    isBranchManager(req) ||
    isAreaManager(req) ||
    isRegionalManager(req) ||
    isAssistantVicePresident(req) ||
    isVicePresident(req) ||
    isSeniorVicePresident(req) ||
    isHRDepartmentUser(req) ||
    isAccountingDepartmentUser(req) ||
    isAuditDepartmentUser(req) ||
    isAdmin(req) ||
    isIT(req)
  );
};

const canViewAll = (req) =>
  isAdmin(req) ||
  isIT(req) ||
  isHRDepartmentUser(req) ||
  isAccountingDepartmentUser(req) ||
  isAuditDepartmentUser(req) ||
  isTread(req) ||
  isVicePresident(req) ||
  isSeniorVicePresident(req) ||
  isPresident(req);

const canUploadFinalFile = (req) =>
  isHRDepartmentUser(req) ||
  isAccountingDepartmentUser(req) ||
  isAuditDepartmentUser(req) ||
  isAdmin(req) ||
  isIT(req);

const canBypassApprove = (req) =>
  isAdmin(req) ||
  isIT(req) ||
  isHRDepartmentUser(req) ||
  isAccountingDepartmentUser(req) ||
  isAuditDepartmentUser(req);

const canVoidReport = (req) =>
  isHRDepartmentUser(req) ||
  isAccountingDepartmentUser(req) ||
  isAuditDepartmentUser(req) ||
  isAdmin(req) ||
  isIT(req);

const canRejectReport = (req) =>
  isAreaManager(req) ||
  isRegionalManager(req) ||
  isAssistantVicePresident(req) ||
  isVicePresident(req) ||
  isHRDepartmentUser(req) ||
  isAccountingDepartmentUser(req) ||
  isAuditDepartmentUser(req) ||
  isAdmin(req) ||
  isIT(req);

const displayName = (s) => {
  const ln = toStr(s?.last_name);
  const fn = toStr(s?.first_name);
  const mn = toStr(s?.middle_name);

  return (
    `${ln}${ln && fn ? ", " : ""}${fn}${mn ? ` ${mn}` : ""}`
      .replace(/\s+/g, " ")
      .trim() ||
    toStr(s?.fullname) ||
    "-"
  );
};

// =====================================================
// INITIAL APPROVAL STATUS BY REPORT TYPE
// =====================================================

const getInitialStatus = (reportType, employee) => {

  // AWOL and Incident Reports go directly to HR
  if (
    reportType === "AWOL Report" ||
    reportType === "Incident Report"
  ) {
    return STATUS_HR;
  }

  // Notice to Explain follows line supervisor approval
  if (reportType === "Notice to Explain") {

    const position = norm(employee?.position);

    // VP employee → HR
    if (
      position === "vice president" ||
      position === "vp"
    ) {
      return STATUS_HR;
    }

    // AVP employee → VP
    if (
      position === "assistant vice president" ||
      position === "avp"
    ) {
      return STATUS_VP;
    }

    // RM employee → AVP
    if (
      position === "regional manager" ||
      position === "rm"
    ) {
      return STATUS_AVP;
    }

    // AM employee → RM
    if (
      position === "area manager" ||
      position === "am"
    ) {
      return STATUS_REGIONAL;
    }

    // Loan Officer / Branch Manager / other employees → AM
    return STATUS_AREA;
  }

  return STATUS_HR;
};

// =====================================================
// STAFF REPORT APPROVAL HISTORY
// =====================================================

const getHistoryActor = (req) => {
  const user = req.user || {};

  const fullname =
    user.fullname ||
    user.full_name ||
    user.name ||
    [user.first_name, user.last_name]
      .filter(Boolean)
      .join(" ") ||
    user.email ||
    `User #${user.id || "Unknown"}`;

  return {
    id: user.id || null,
    name: String(fullname).trim(),
    role: String(user.role || "").trim(),
    department: String(
      user.department ||
      user.department_name ||
      user.departmentName ||
      user.user_department ||
      user.dept ||
      ""
    ).trim(),
  };
};


// =====================================================
// INSERT APPROVAL HISTORY
// =====================================================

const insertApprovalHistory = async (
  client,
  reportId,
  req,
  action,
  previousStatus,
  newStatus,
  notes = null
) => {
  const actor = getHistoryActor(req);

  await client.query(
    `
      INSERT INTO public.awol_report_approval_history
      (
        report_id,
        actor_id,
        actor_name,
        actor_role,
        actor_department,
        action,
        previous_status,
        new_status,
        notes,
        performed_at
      )
      VALUES
      (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, NOW()
      )
    `,
    [
      reportId,
      actor.id,
      actor.name,
      actor.role,
      actor.department,
      action,
      previousStatus,
      newStatus,
      notes,
    ]
  );
};


// =====================================================
// UPDATE REPORT AND SAVE HISTORY TOGETHER
// =====================================================

const updateReportWithHistory = async (
  req,
  reportId,
  sql,
  params,
  action,
  notes = null
) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const before = await client.query(
      `
        SELECT status
        FROM public.awol_reports
        WHERE id = $1
        FOR UPDATE
      `,
      [reportId]
    );

    const updated = await client.query(sql, params);

    if (updated.rowCount > 0) {
      await insertApprovalHistory(
        client,
        reportId,
        req,
        action,
        before.rows[0]?.status || null,
        updated.rows[0].status,
        notes
      );
    }

    await client.query("COMMIT");

    return updated;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const canAccessRow = (req, row) => {
  if (canViewAll(req)) return true;

  if (
    isHRDepartmentUser(req) ||
    isAuditDepartmentUser(req)
  ) {
    return true;
  }

  if (isBranchManager(req)) {
    const userBranchId = toInt(req.user?.branch_id);

    if (userBranchId) {
      return Number(userBranchId) === Number(row.branch_id);
    }

    const userBranchCode =
      req.user?.branch_id || req.user?.branch || req.user?.branch_code;

    return norm(userBranchCode) === norm(row.branch_code);
  }

  if (isAreaManager(req)) {
    return norm(req.user?.area) === norm(row.area);
  }

  if (isRegionalManager(req)) {
    return norm(req.user?.region) === norm(row.region);
  }

  if (isAssistantVicePresident(req)) {
    return norm(req.user?.division) === norm(row.division);
  }

  return false;
};

const canApproveCurrentStage = (req, row) => {
  if (!row) {
    return {
      allowed: false,
      nextStatus: null,
    };
  }

  const status = row.status;

  if (
    [
      STATUS_APPROVED,
      STATUS_REJECTED,
      STATUS_VOID,
      STATUS_WAITING_FINAL,
      STATUS_HR,
    ].includes(status)
  ) {
    return {
      allowed: false,
      nextStatus: null,
    };
  }

  // Admin / IT / HR / Accounting / Audit bypass
  if (canBypassApprove(req)) {
    return {
      allowed: true,
      nextStatus: STATUS_HR,
    };
  }

  // Area Manager Approval
  if (
    status === STATUS_AREA &&
    isAreaManager(req) &&
    norm(req.user?.area) === norm(row.area)
  ) {
    return {
      allowed: true,
      nextStatus: STATUS_REGIONAL,
    };
  }

  // Regional Manager Approval
  if (
    status === STATUS_REGIONAL &&
    isRegionalManager(req) &&
    norm(req.user?.region) === norm(row.region)
  ) {
    return {
      allowed: true,
      nextStatus: STATUS_AVP,
    };
  }

  // Assistant Vice President Approval
  if (
    status === STATUS_AVP &&
    isAssistantVicePresident(req) &&
    norm(req.user?.division) === norm(row.division)
  ) {
    return {
      allowed: true,
      nextStatus: STATUS_VP,
    };
  }

  // Vice President Approval
  if (
    status === STATUS_VP &&
    isVicePresident(req)
  ) {
    return {
      allowed: true,
      nextStatus: STATUS_HR,
    };
  }

  return {
    allowed: false,
    nextStatus: null,
  };
};

const uploadsDir = path.join(process.cwd(), "uploads", "staff-reports");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    const base = path
      .basename(file.originalname || "file", ext)
      .replace(/[^a-zA-Z0-9-_]/g, "_");

    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}-${base}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
});

async function generateReportNo(client, reportType) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const prefix = prefixByReportType(reportType);

  await client.query(
    `
    INSERT INTO public.order_sequences(prefix, year, month, next_value)
    VALUES ($1, $2, $3, 1)
    ON CONFLICT (prefix, year, month) DO NOTHING
    `,
    [prefix, year, month]
  );

  const seq = await client.query(
    `
    SELECT next_value
    FROM public.order_sequences
    WHERE prefix = $1
      AND year = $2
      AND month = $3
    FOR UPDATE
    `,
    [prefix, year, month]
  );

  const nextVal = Number(seq.rows[0].next_value);

  await client.query(
    `
    UPDATE public.order_sequences
    SET next_value = next_value + 1
    WHERE prefix = $1
      AND year = $2
      AND month = $3
    `,
    [prefix, year, month]
  );

  return `${prefix}-${year}-${String(month).padStart(2, "0")}-${String(
    nextVal
  ).padStart(4, "0")}`;
}

// =====================================================
// GET STAFF REPORT APPROVAL HISTORY
// =====================================================

router.get(
  "/awol-reports/:id/approval-history",
  requireAuth,
  requirePermission("staff_report", "view"),
  async (req, res) => {
    try {
      const id = toInt(req.params.id);

      if (!id) {
        return res.status(400).json({
          message: "Invalid report id",
        });
      }

      const reportResult = await pool.query(
        `
          SELECT *
          FROM public.awol_reports
          WHERE id = $1
        `,
        [id]
      );

      if (reportResult.rowCount === 0) {
        return res.status(404).json({
          message: "Staff report not found",
        });
      }

      const report = reportResult.rows[0];

      if (!canAccessRow(req, report)) {
        return res.status(403).json({
          message: "Access denied",
        });
      }

      const historyResult = await pool.query(
        `
          SELECT
            id,
            report_id,
            actor_id,
            actor_name,
            actor_role,
            actor_department,
            action,
            previous_status,
            new_status,
            notes,
            performed_at
          FROM public.awol_report_approval_history
          WHERE report_id = $1
          ORDER BY performed_at ASC, id ASC
        `,
        [id]
      );

      return res.json(historyResult.rows);

    } catch (error) {
      console.error(
        "GET STAFF REPORT APPROVAL HISTORY ERROR:",
        error
      );

      return res.status(500).json({
        message: "Failed to load approval history",
      });
    }
  }
);

router.get(
  "/awol-reports",
  requireAuth,
  requirePermission("staff_report", "view"),
  async (req, res) => {
    try {
      if (canViewAll(req)) {
        const r = await pool.query(`
          SELECT
            *,
            COALESCE(report_type, 'AWOL Report') AS report_type
          FROM public.awol_reports
          ORDER BY created_at DESC
        `);

        return res.json(r.rows);
      }

      let sql = "";
      let value = "";

      if (isHRDepartmentUser(req)) {
        const r = await pool.query(`
          SELECT *,
                COALESCE(report_type,'AWOL Report') AS report_type
          FROM public.awol_reports
          ORDER BY created_at DESC
        `);

        return res.json(r.rows);
      }

      if (isBranchManager(req)) {
        const userBranchId = toInt(req.user?.branch_id);

        if (userBranchId) {
          sql = "branch_id = $1";
          value = userBranchId;
        } else {
          sql = "LOWER(TRIM(COALESCE(branch_code, ''))) = LOWER(TRIM($1))";
          value = req.user?.branch_id || req.user?.branch || req.user?.branch_code;
        }
      } else if (isAreaManager(req)) {
        sql = "LOWER(TRIM(COALESCE(area, ''))) = LOWER(TRIM($1))";
        value = req.user?.area;
      } else if (isRegionalManager(req)) {
        sql = "LOWER(TRIM(COALESCE(region, ''))) = LOWER(TRIM($1))";
        value = req.user?.region;
      } else if (isAssistantVicePresident(req)) {
        sql = "LOWER(TRIM(COALESCE(division, ''))) = LOWER(TRIM($1))";
        value = req.user?.division;
      } else {
        return res.status(403).json({ message: "Access denied" });
      }
      const r = await pool.query(
        `
        SELECT
          *,
          COALESCE(report_type, 'AWOL Report') AS report_type
        FROM public.awol_reports
        WHERE ${sql}
        ORDER BY created_at DESC
        `,
        [value]
      );

      return res.json(r.rows);
    } catch (e) {
      console.error("GET /api/awol-reports ERROR:", e.message);
      return res.status(500).json({ message: e.message || "Server error" });
    }
  }
);

router.post(
  "/awol-reports/:id/approve-upload",
  requireAuth,
  requirePermission("staff_report", "approve"),
  upload.single("attachment"),
  async (req, res) => {
    try {
      const id = toInt(req.params.id);

      if (!id) {
        return res.status(400).json({ message: "Invalid report id" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "Approved file required" });
      }

      const current = await pool.query(
        `SELECT * FROM public.awol_reports WHERE id = $1`,
        [id]
      );

      if (current.rowCount === 0) {
        return res.status(404).json({ message: "Report not found" });
      }

      const row = current.rows[0];

      if (!canAccessRow(req, row)) {
        return res.status(403).json({
          message: "Access denied",
        });
      }

      // Prevent approval of completed reports
      if (
        [
          STATUS_WAITING_FINAL,
          STATUS_APPROVED,
          STATUS_REJECTED,
          STATUS_VOID,
        ].includes(row.status)
      ) {
        return res.status(400).json({
          message: `Report cannot be approved with upload. Current status: ${row.status}`,
        });
      }

      const approval = canApproveCurrentStage(req, row);

      if (!approval.allowed) {
        return res.status(403).json({
          message: `This report is not for your approval. Current status: ${row.status}`,
        });
      }

      const previousFile = row.approved_attachment_path;

      const r = await updateReportWithHistory(
        req,
        id,
        `
        UPDATE public.awol_reports
        SET
          status = $2,
          approved_by = $3,
          approved_at = NOW(),
          approved_attachment_path = $4,
          approved_attachment_name = $5,
          approved_attachment_mime = $6,
          rejected_by = NULL,
          rejected_at = NULL,
          rejection_reason = NULL,
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
        `,
        [
          id,
          approval.nextStatus,
          req.user?.id ?? null,
          req.file.path,
          req.file.originalname,
          req.file.mimetype,
        ],
        "Approved With File",
        `Approved file uploaded: ${req.file.originalname}`
      );

      if (
        previousFile &&
        previousFile !== req.file.path &&
        fs.existsSync(previousFile)
      ) {
        try {
          fs.unlinkSync(previousFile);
        } catch {}
      }

      return res.json(r.rows[0]);
    } catch (e) {
      console.error("POST /api/awol-reports/:id/approve-upload ERROR:", e.message);
      return res.status(500).json({ message: e.message || "Server error" });
    }
  }
);

router.post(
  "/awol-reports",
  requireAuth,
  requirePermission("staff_report", "create"),
  upload.single("attachment"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      if (!canCreateReport(req)) {
        return res.status(403).json({ message: "Access denied" });
      }

      await client.query("BEGIN");

      const reportType = normalizeReportType(req.body?.report_type);

      if (!reportType) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message: `Invalid report type. Allowed types: ${REPORT_TYPES.join(", ")}.`,
        });
      }

      const employeeId = toInt(req.body?.employee_id);
      const dateCreated = toDateOrNull(req.body?.date_created);
      const awolDate = toDateOrNull(req.body?.awol_date);
      const details = toStr(req.body?.details);

      if (!employeeId) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Employee required" });
      }

      if (!dateCreated || !awolDate) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: `${dateLabelByReportType(reportType)} and Date Created are required`,
        });
      }

      const staff = await client.query(
        `
        SELECT
          s.id,
          s.fullname,
          s.last_name,
          s.first_name,
          s.middle_name,
          s.position,
          s.department,
          s.branch_id,
          s.area,
          s.region,
          s.division,
          b.code AS branch_code,
          b.name AS branch_name
        FROM public.staff s
        LEFT JOIN public.branches b ON b.id = s.branch_id
        WHERE s.id = $1
        `,
        [employeeId]
      );

      if (staff.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Staff not found" });
      }

      const s = staff.rows[0];

      if (
        !isHRDepartmentUser(req) &&
        !isAccountingDepartmentUser(req) &&
        !isAuditDepartmentUser(req) &&
        isBranchManager(req)
      ) {
        const userBranchId = toInt(req.user?.branch_id);

        if (userBranchId) {
          if (Number(userBranchId) !== Number(s.branch_id)) {
            await client.query("ROLLBACK");
            return res.status(403).json({ message: "Access denied" });
          }
        } else {
          const userBranchCode =
            req.user?.branch_id || req.user?.branch || req.user?.branch_code;

          if (norm(userBranchCode) !== norm(s.branch_code)) {
            await client.query("ROLLBACK");
            return res.status(403).json({ message: "Access denied" });
          }
        }
      }

      if (
        !isHRDepartmentUser(req) &&
        !isAccountingDepartmentUser(req) &&
        !isAuditDepartmentUser(req) &&
        isAreaManager(req) &&
        norm(req.user?.area) !== norm(s.area)
      ) {
        await client.query("ROLLBACK");
        return res.status(403).json({ message: "Access denied" });
      }

      if (
        !isHRDepartmentUser(req) &&
        !isAccountingDepartmentUser(req) &&
        !isAuditDepartmentUser(req) &&
        isRegionalManager(req) &&
        norm(req.user?.region) !== norm(s.region)
      ) {
        await client.query("ROLLBACK");
        return res.status(403).json({ message: "Access denied" });
      }

      if (
        !isHRDepartmentUser(req) &&
        !isAccountingDepartmentUser(req) &&
        !isAuditDepartmentUser(req) &&
        isAssistantVicePresident(req) &&
        norm(req.user?.division) !== norm(s.division)
      ) {
        await client.query("ROLLBACK");
        return res.status(403).json({ message: "Access denied" });
      }

      const reportNo = await generateReportNo(
        client,
        reportType
      );

      const initialStatus = getInitialStatus(
        reportType,
        s
      );

      const ins = await client.query(
        `
        INSERT INTO public.awol_reports
        (
          report_no,
          report_type,
          employee_id,
          employee_name,
          branch_id,
          branch_code,
          branch_name,
          area,
          region,
          division,
          date_created,
          awol_date,
          details,
          status,
          created_by,
          request_attachment_path,
          request_attachment_name,
          request_attachment_mime,
          created_at,
          updated_at
        )
        VALUES
        (
          $1, $2, $3, $4, $5, $6, $7, $8, $9,
          $10, $11::date, $12::date, $13, $14, $15,
          $16, $17, $18, NOW(), NOW()
        )
        RETURNING *
        `,
        [
          reportNo,
          reportType,
          s.id,
          displayName(s),
          s.branch_id,
          s.branch_code,
          s.branch_name,
          s.area,
          s.region,
          s.division,
          dateCreated,
          awolDate,
          details,
          initialStatus,
          req.user?.id ?? null,
          req.file?.path || null,
          req.file?.originalname || null,
          req.file?.mimetype || null,
        ]
      );

      // SAVE CREATED HISTORY
      await insertApprovalHistory(
        client,
        ins.rows[0].id,
        req,
        "Created",
        null,
        initialStatus
      );

      await client.query("COMMIT");

      return res.json(ins.rows[0]);
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("POST /api/awol-reports ERROR:", e.message);
      return res.status(500).json({ message: e.message || "Server error" });
    } finally {
      client.release();
    }
  }
);

router.put(
  "/awol-reports/:id/approve",
  requireAuth,
  requirePermission("staff_report", "approve"),
  async (req, res) => {
    try {
      const id = toInt(req.params.id);

      if (!id) {
        return res.status(400).json({ message: "Invalid report id" });
      }

      const current = await pool.query(
        `
        SELECT *
        FROM public.awol_reports
        WHERE id = $1
        `,
        [id]
      );

      if (current.rowCount === 0) {
        return res.status(404).json({ message: "Report not found" });
      }

      const row = current.rows[0];

      if (!canAccessRow(req, row)) {
        return res.status(403).json({ message: "Access denied" });
      }

      if (
        row.status === STATUS_APPROVED ||
        row.status === STATUS_REJECTED ||
        row.status === STATUS_VOID
      ) {
        return res.status(400).json({
          message: `Report already ${row.status}`,
        });
      }

      if (row.status === STATUS_WAITING_FINAL) {
        return res.status(400).json({
          message: "Report is already waiting for final file upload",
        });
      }

      const approval = canApproveCurrentStage(req, row);

      if (!approval.allowed) {
        return res.status(403).json({
          message: `This report is not for your approval. Current status: ${row.status}`,
        });
      }

      const r = await updateReportWithHistory(
        req,
        id,
        `
          UPDATE public.awol_reports
          SET
            status = $2,
            approved_by = $3,
            approved_at = NOW(),
            rejected_by = NULL,
            rejected_at = NULL,
            rejection_reason = NULL,
            updated_at = NOW()
          WHERE id = $1
          RETURNING *
        `,
        [id, approval.nextStatus, req.user?.id ?? null],
        "Approved",
        "Report approved"
      );

      return res.json(r.rows[0]);
    } catch (e) {
      console.error("PUT /api/awol-reports/:id/approve ERROR:", e.message);
      return res.status(500).json({ message: e.message || "Server error" });
    }
  }
);

router.put(
  "/awol-reports/:id/reject",
  requireAuth,
  requirePermission("staff_report", "reject"),
  async (req, res) => {
    try {
      if (!canRejectReport(req)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const id = toInt(req.params.id);
      const reason = toStr(req.body?.reason);

      if (!id) {
        return res.status(400).json({ message: "Invalid report id" });
      }

      if (!reason) {
        return res.status(400).json({ message: "Rejection reason required" });
      }

      const current = await pool.query(
        `
        SELECT *
        FROM public.awol_reports
        WHERE id = $1
        `,
        [id]
      );

      if (current.rowCount === 0) {
        return res.status(404).json({ message: "Report not found" });
      }

      const row = current.rows[0];

      if (!canAccessRow(req, row)) {
        return res.status(403).json({ message: "Access denied" });
      }

      if (
        row.status === STATUS_APPROVED ||
        row.status === STATUS_REJECTED ||
        row.status === STATUS_VOID
      ) {
        return res.status(400).json({
          message: `Report cannot be rejected. Current status: ${row.status}`,
        });
      }

      if (!canBypassApprove(req)) {
        const approval = canApproveCurrentStage(req, row);

        if (!approval.allowed && row.status !== STATUS_WAITING_FINAL) {
          return res.status(403).json({
            message: `This report is not for your rejection. Current status: ${row.status}`,
          });
        }

        if (row.status === STATUS_WAITING_FINAL && !canUploadFinalFile(req)) {
          return res.status(403).json({
            message: "Only HR/Audit/Accounting/Admin/IT can reject during final upload stage",
          });
        }
      }

      const r = await updateReportWithHistory(
        req,
        id,
        `
          UPDATE public.awol_reports
          SET
            status = $2,
            rejected_by = $3,
            rejected_at = NOW(),
            rejection_reason = $4,
            updated_at = NOW()
          WHERE id = $1
            AND status NOT IN ($5, $6, $7)
          RETURNING *
        `,
        [
          id,
          STATUS_REJECTED,
          req.user?.id ?? null,
          reason,
          STATUS_APPROVED,
          STATUS_REJECTED,
          STATUS_VOID,
        ],
        "Rejected",
        reason
      );

      return res.json(r.rows[0]);
    } catch (e) {
      console.error("PUT /api/awol-reports/:id/reject ERROR:", e.message);
      return res.status(500).json({ message: e.message || "Server error" });
    }
  }
);

router.put(
  "/awol-reports/:id/void",
  requireAuth,
  requirePermission("staff_report", "approve"),
  async (req, res) => {
    try {
      if (!canVoidReport(req)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const id = toInt(req.params.id);
      const reason = toStr(req.body?.reason);

      if (!id) {
        return res.status(400).json({ message: "Invalid report id" });
      }

      const r = await updateReportWithHistory(
        req,
        id,
        `
          UPDATE public.awol_reports
          SET
            status = $2,
            rejected_by = NULL,
            rejected_at = NULL,
            rejection_reason = COALESCE($3, rejection_reason),
            updated_at = NOW()
          WHERE id = $1
            AND status = $4
          RETURNING *
        `,
        [
          id,
          STATUS_VOID,
          reason || null,
          STATUS_APPROVED,
        ],
        "Voided",
        reason || null
      );

      if (r.rowCount === 0) {
        return res.status(400).json({ message: "Report cannot be voided" });
      }

      return res.json(r.rows[0]);
    } catch (e) {
      console.error("PUT /api/awol-reports/:id/void ERROR:", e.message);
      return res.status(500).json({ message: e.message || "Server error" });
    }
  }
);

router.put(
  "/awol-reports/:id/admin-bypass-approve",
  requireAuth,
  requirePermission("staff_report", "approve"),
  async (req, res) => {
    try {
      if (!canBypassApprove(req)) {
        return res.status(403).json({
          message:
            "Only Admin, IT, HR, Accounting, and Audit Department can bypass approval",
        });
      }

      const id = toInt(req.params.id);

      if (!id) {
        return res.status(400).json({ message: "Invalid report id" });
      }

      const r = await updateReportWithHistory(
        req,
        id,
        `
          UPDATE public.awol_reports
          SET
            status = $2,
            approved_by = $3,
            approved_at = NOW(),
            hr_uploaded_by = NULL,
            hr_uploaded_at = NULL,
            rejected_by = NULL,
            rejected_at = NULL,
            rejection_reason = NULL,
            updated_at = NOW()
          WHERE id = $1
            AND status NOT IN ($4, $5, $6, $7)
          RETURNING *
        `,
        [
          id,
          STATUS_HR,
          req.user?.id ?? null,
          STATUS_APPROVED,
          STATUS_REJECTED,
          STATUS_VOID,
          STATUS_HR,
        ],
        "Bypassed approval",
        null
      );

      if (r.rowCount === 0) {
        return res.status(400).json({
          message: "Report cannot be bypass-approved",
        });
      }

      return res.json(r.rows[0]);
    } catch (e) {
      console.error("PUT /api/awol-reports/:id/admin-bypass-approve ERROR:", e.message);
      return res.status(500).json({ message: e.message || "Server error" });
    }
  }
);

router.post(
  "/awol-reports/:id/hr-final-file",
  requireAuth,
  requirePermission("staff_report", "upload_approved"),
  upload.single("attachment"),
  async (req, res) => {
    try {
      if (!canUploadFinalFile(req)) {
        return res.status(403).json({
          message:"Only HR/Audit/Accounting/Admin/IT can upload final file",
        });
      }

      const id = toInt(req.params.id);

      if (!id) {
        return res.status(400).json({ message: "Invalid report id" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "Final file required" });
      }

      const r = await updateReportWithHistory(
        req,
        id,
        `
        UPDATE public.awol_reports
        SET
          status = $2,
          hr_uploaded_by = $3,
          hr_uploaded_at = NOW(),
          approved_by = $3,
          approved_at = NOW(),
          approved_attachment_path = $4,
          approved_attachment_name = $5,
          approved_attachment_mime = $6,
          rejected_by = NULL,
          rejected_at = NULL,
          rejection_reason = NULL,
          updated_at = NOW()
        WHERE id = $1
          AND status IN ($7, $8)
        RETURNING *
        `,
        [
          id,
          STATUS_APPROVED,
          req.user?.id ?? null,
          req.file.path,
          req.file.originalname,
          req.file.mimetype,
          STATUS_WAITING_FINAL,
          STATUS_HR,
          ],
        "Final file uploaded and approved",
        null
      );  

      if (r.rowCount === 0) {
        return res.status(400).json({
          message: "Report must be waiting final file upload",
        });
      }

      return res.json(r.rows[0]);
    } catch (e) {
      console.error("POST /api/awol-reports/:id/hr-final-file ERROR:", e.message);
      return res.status(500).json({ message: e.message || "Server error" });
    }
  }
);

// =====================================================
// UPLOAD ANSWER LETTER - NOTICE TO EXPLAIN
// =====================================================

router.post(
  "/awol-reports/:id/answer-letter",
  requireAuth,
  requirePermission("staff_report", "view"),
  upload.single("attachment"),
  async (req, res) => {
    try {
      const id = toInt(req.params.id);

      if (!id) {
        return res.status(400).json({
          message: "Invalid report ID",
        });
      }

      if (!req.file) {
        return res.status(400).json({
          message: "Please select an Answer Letter file",
        });
      }

      // Only authorized departments can upload
      const canUpload =
        isAdmin(req) ||
        isIT(req) ||
        isHRDepartmentUser(req) ||
        isAccountingDepartmentUser(req);

      if (!canUpload) {
        return res.status(403).json({
          message: "You are not authorized to upload Answer Letters",
        });
      }

      const reportResult = await pool.query(
        `
          SELECT *
          FROM public.awol_reports
          WHERE id = $1
        `,
        [id]
      );

      if (reportResult.rowCount === 0) {
        return res.status(404).json({
          message: "NTE report not found",
        });
      }

      const report = reportResult.rows[0];

      if (norm(report.report_type) !== "notice to explain") {
        return res.status(400).json({
          message: "Answer Letters are only available for Notice to Explain",
        });
      }

      if (!canAccessRow(req, report)) {
        return res.status(403).json({
          message: "Access denied",
        });
      }

      const result = await pool.query(
        `
          UPDATE public.awol_reports
          SET
            answer_letter_path = $2,
            answer_letter_name = $3,
            answer_letter_mime = $4,
            answer_letter_uploaded_at = NOW(),
            answer_letter_uploaded_by = $5,
            updated_at = NOW()
          WHERE id = $1
          RETURNING *
        `,
        [
          id,
          req.file.path,
          req.file.originalname,
          req.file.mimetype,
          req.user?.id || null,
        ]
      );

      return res.json(result.rows[0]);
    } catch (error) {
      console.error("UPLOAD ANSWER LETTER ERROR:", error);

      return res.status(500).json({
        message: "Failed to upload Answer Letter",
      });
    }
  }
);

router.get(
  "/awol-reports/:id/download/:type",
  requireAuth,
  requirePermission("staff_report", "view"),
  async (req, res) => {
    try {
      const id = toInt(req.params.id);
      const type = toStr(req.params.type);

      if (!id) {
        return res.status(400).json({ message: "Invalid report id" });
      }

      const r = await pool.query(
        `
        SELECT *
        FROM public.awol_reports
        WHERE id = $1
        `,
        [id]
      );

      if (r.rowCount === 0) {
        return res.status(404).json({ message: "Report not found" });
      }

      const row = r.rows[0];

      if (!canAccessRow(req, row)) {
        return res.status(403).json({ message: "Access denied" });
      }

      let filePath = null;
      let fileName = null;

      if (type === "approved") {
        filePath = row.approved_attachment_path;
        fileName = row.approved_attachment_name;
      } else if (type === "request") {
        filePath = row.request_attachment_path;
        fileName = row.request_attachment_name;
      } else if (type === "answer-letter") {
        if (norm(row.report_type) !== "notice to explain") {
          return res.status(400).json({
            message: "Answer Letter is only available for NTE reports",
          });
        }

        filePath = row.answer_letter_path;
        fileName = row.answer_letter_name;
      } else {
        return res.status(400).json({
          message: "Invalid file type",
        });
      }

      if (!filePath || !fs.existsSync(filePath)) {
        return res.status(404).json({ message: "File not found" });
      }

      return res.download(filePath, fileName || "staff-report-file");
    } catch (e) {
      console.error("GET /api/awol-reports/:id/download/:type ERROR:", e.message);
      return res.status(500).json({ message: e.message || "Server error" });
    }
  }
);

module.exports = router;