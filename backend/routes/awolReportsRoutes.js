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
const STATUS_WAITING_FINAL = "Waiting Final File Upload";
const STATUS_APPROVED = "Approved";
const STATUS_REJECTED = "Rejected";
const STATUS_VOID = "Voided";

const REPORT_TYPES = [
  "AWOL Report",
  "Notice to Explain",
  "Termination of Contract",
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
  const found = REPORT_TYPES.find((x) => norm(x) === norm(input));
  return found || "AWOL Report";
};

const prefixByReportType = (reportType) => {
  const t = norm(reportType);

  if (t === "notice to explain") return "NTE";
  if (t === "termination of contract") return "TOC";

  return "AWOL";
};

const dateLabelByReportType = (reportType) => {
  const t = norm(reportType);

  if (t === "notice to explain") return "Notice Date";
  if (t === "termination of contract") return "Termination Date";

  return "AWOL Date";
};

const canCreateReport = (req) =>
  isBranchManager(req) ||
  isAreaManager(req) ||
  isRegionalManager(req) ||
  isAssistantVicePresident(req) ||
  isVicePresident(req) ||
  isAdmin(req) ||
  isIT(req);

const canViewAll = (req) =>
  isAdmin(req) ||
  isIT(req) ||
  isHr(req) ||
  isAccounting(req) ||
  isTread(req) ||
  isVicePresident(req) ||
  isSeniorVicePresident(req) ||
  isPresident(req);

const canUploadFinalFile = (req) =>
  isHr(req) || isAccounting(req) || isAdmin(req) || isIT(req);

const canBypassApprove = (req) => isAdmin(req) || isIT(req);

const canVoidReport = (req) => isHr(req) || isAccounting(req) || isAdmin(req) || isIT(req);

const canRejectReport = (req) =>
  isAreaManager(req) ||
  isRegionalManager(req) ||
  isAssistantVicePresident(req) ||
  isVicePresident(req) ||
  isHr(req) ||
  isAccounting(req) ||
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

const getInitialStatus = (req) => {
  if (isBranchManager(req)) return STATUS_AREA;
  if (isAreaManager(req)) return STATUS_REGIONAL;
  if (isRegionalManager(req)) return STATUS_AVP;
  if (isAssistantVicePresident(req)) return STATUS_VP;
  if (isVicePresident(req)) return STATUS_WAITING_FINAL;

  if (isAdmin(req) || isIT(req)) return STATUS_WAITING_FINAL;

  return STATUS_AREA;
};

const canAccessRow = (req, row) => {
  if (canViewAll(req)) return true;

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
  if (canBypassApprove(req)) {
    return {
      allowed: true,
      nextStatus: STATUS_WAITING_FINAL,
    };
  }

  if (row.status === STATUS_AREA && isAreaManager(req)) {
    return {
      allowed: true,
      nextStatus: STATUS_REGIONAL,
    };
  }

  if (row.status === STATUS_REGIONAL && isRegionalManager(req)) {
    return {
      allowed: true,
      nextStatus: STATUS_AVP,
    };
  }

  if (row.status === STATUS_AVP && isAssistantVicePresident(req)) {
    return {
      allowed: true,
      nextStatus: STATUS_VP,
    };
  }

  if (row.status === STATUS_VP && isVicePresident(req)) {
    return {
      allowed: true,
      nextStatus: STATUS_WAITING_FINAL,
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
        return res.status(403).json({ message: "Access denied" });
      }

      const approval = canApproveCurrentStage(req, row);

      if (!approval.allowed) {
        return res.status(403).json({
          message: `This report is not for your approval. Current status: ${row.status}`,
        });
      }

      const previousFile =
        row.approved_attachment_path || row.request_attachment_path;

      const r = await pool.query(
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
        ]
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

      if (isBranchManager(req)) {
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

      if (isAreaManager(req) && norm(req.user?.area) !== norm(s.area)) {
        await client.query("ROLLBACK");
        return res.status(403).json({ message: "Access denied" });
      }

      if (isRegionalManager(req) && norm(req.user?.region) !== norm(s.region)) {
        await client.query("ROLLBACK");
        return res.status(403).json({ message: "Access denied" });
      }

      if (isAssistantVicePresident(req) && norm(req.user?.division) !== norm(s.division)) {
        await client.query("ROLLBACK");
        return res.status(403).json({ message: "Access denied" });
      }

      const reportNo = await generateReportNo(client, reportType);
      const initialStatus = getInitialStatus(req);

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

      const r = await pool.query(
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
        [id, approval.nextStatus, req.user?.id ?? null]
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
            message: "Only HR/Accounting/Admin/IT can reject during final upload stage",
          });
        }
      }

      const r = await pool.query(
        `
        UPDATE public.awol_reports
        SET
          status = $2,
          rejected_by = $3,
          rejected_at = NOW(),
          rejection_reason = $4,
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
        `,
        [id, STATUS_REJECTED, req.user?.id ?? null, reason]
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

      const r = await pool.query(
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
        [id, STATUS_VOID, reason || null, STATUS_APPROVED]
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
        return res.status(403).json({ message: "Admin/IT only" });
      }

      const id = toInt(req.params.id);

      if (!id) {
        return res.status(400).json({ message: "Invalid report id" });
      }

      const r = await pool.query(
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
          AND status NOT IN ($4, $5, $6)
        RETURNING *
        `,
        [
          id,
          STATUS_WAITING_FINAL,
          req.user?.id ?? null,
          STATUS_APPROVED,
          STATUS_REJECTED,
          STATUS_VOID,
        ]
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
          message: "Only HR/Accounting/Admin/IT can upload final file",
        });
      }

      const id = toInt(req.params.id);

      if (!id) {
        return res.status(400).json({ message: "Invalid report id" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "Final file required" });
      }

      const r = await pool.query(
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
          AND status = $7
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
        ]
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

      const filePath =
        type === "approved"
          ? row.approved_attachment_path
          : row.request_attachment_path;

      const fileName =
        type === "approved"
          ? row.approved_attachment_name
          : row.request_attachment_name;

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