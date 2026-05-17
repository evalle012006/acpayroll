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

const STATUS_PENDING_VP = "Pending Vice President";
const STATUS_WAITING_HR = "Waiting HR Final File";
const STATUS_APPROVED = "Approved";
const STATUS_REJECTED = "Rejected";

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

const canCreateAwol = (req) =>
  isBranchManager(req) ||
  isAreaManager(req) ||
  isRegionalManager(req) ||
  isAssistantVicePresident(req) ||
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

const uploadsDir = path.join(process.cwd(), "uploads", "awol-reports");
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

async function generateReportNo(client) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const prefix = "AWOL";

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

const canAccessRow = (req, row) => {
  if (canViewAll(req)) return true;

  if (isBranchManager(req)) {
    return Number(req.user?.branch_id) === Number(row.branch_id);
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

router.get(
  "/awol-reports",
  requireAuth,
  requirePermission("staff_report", "view"),
  async (req, res) => {
    try {
      if (canViewAll(req)) {
        const r = await pool.query(`
          SELECT *
          FROM public.awol_reports
          ORDER BY created_at DESC
        `);
        return res.json(r.rows);
      }

      let sql = "";
      let value = "";

      if (isBranchManager(req)) {
        sql = "branch_id = $1";
        value = req.user?.branch_id;
      } else if (isAreaManager(req)) {
        sql = "LOWER(TRIM(COALESCE(area,''))) = LOWER(TRIM($1))";
        value = req.user?.area;
      } else if (isRegionalManager(req)) {
        sql = "LOWER(TRIM(COALESCE(region,''))) = LOWER(TRIM($1))";
        value = req.user?.region;
      } else if (isAssistantVicePresident(req)) {
        sql = "LOWER(TRIM(COALESCE(division,''))) = LOWER(TRIM($1))";
        value = req.user?.division;
      } else {
        return res.status(403).json({ message: "Access denied" });
      }

      const r = await pool.query(
        `
        SELECT *
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
  "/awol-reports",
  requireAuth,
  requirePermission("staff_report", "create"),
  upload.single("attachment"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      if (!canCreateAwol(req)) {
        return res.status(403).json({ message: "Access denied" });
      }

      await client.query("BEGIN");

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
        return res.status(400).json({ message: "Dates required" });
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

      if (isBranchManager(req) && Number(req.user?.branch_id) !== Number(s.branch_id)) {
        await client.query("ROLLBACK");
        return res.status(403).json({ message: "Access denied" });
      }

      if (isAreaManager(req) && norm(req.user?.area) !== norm(s.area)) {
        await client.query("ROLLBACK");
        return res.status(403).json({ message: "Access denied" });
      }

      if (isRegionalManager(req) && norm(req.user?.region) !== norm(s.region)) {
        await client.query("ROLLBACK");
        return res.status(403).json({ message: "Access denied" });
      }

      if (
        isAssistantVicePresident(req) &&
        norm(req.user?.division) !== norm(s.division)
      ) {
        await client.query("ROLLBACK");
        return res.status(403).json({ message: "Access denied" });
      }

      const reportNo = await generateReportNo(client);

      const ins = await client.query(
        `
        INSERT INTO public.awol_reports
        (
          report_no,
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
          request_attachment_mime
        )
        VALUES
        (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10::date,$11::date,$12,$13,$14,$15,$16,$17
        )
        RETURNING *
        `,
        [
          reportNo,
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
          STATUS_PENDING_VP,
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
  "/awol-reports/:id/vp-approve",
  requireAuth,
  requirePermission("staff_report", "approve"),
  async (req, res) => {
    try {
      if (!isVicePresident(req) && !isAdmin(req) && !isIT(req)) {
        return res.status(403).json({ message: "Only VP can approve" });
      }

      const id = toInt(req.params.id);

      const r = await pool.query(
        `
        UPDATE public.awol_reports
        SET
          status = $2,
          vp_approved_by = $3,
          vp_approved_at = NOW(),
          rejected_by = NULL,
          rejected_at = NULL,
          rejection_reason = NULL,
          updated_at = NOW()
        WHERE id = $1
          AND status = $4
        RETURNING *
        `,
        [id, STATUS_WAITING_HR, req.user?.id ?? null, STATUS_PENDING_VP]
      );

      if (r.rowCount === 0) {
        return res.status(400).json({ message: "Report not pending VP approval" });
      }

      return res.json(r.rows[0]);
    } catch (e) {
      console.error("PUT /api/awol-reports/:id/vp-approve ERROR:", e.message);
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
      if (!isVicePresident(req) && !isHr(req) && !isAdmin(req) && !isIT(req)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const id = toInt(req.params.id);
      const reason = toStr(req.body?.reason);

      if (!reason) {
        return res.status(400).json({ message: "Rejection reason required" });
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
          AND status IN ($5,$6)
        RETURNING *
        `,
        [
          id,
          STATUS_REJECTED,
          req.user?.id ?? null,
          reason,
          STATUS_PENDING_VP,
          STATUS_WAITING_HR,
        ]
      );

      if (r.rowCount === 0) {
        return res.status(400).json({ message: "Report cannot be rejected" });
      }

      return res.json(r.rows[0]);
    } catch (e) {
      console.error("PUT /api/awol-reports/:id/reject ERROR:", e.message);
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
      if (!isHr(req) && !isAdmin(req) && !isIT(req)) {
        return res.status(403).json({ message: "Only HR can upload final file" });
      }

      const id = toInt(req.params.id);

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
          approved_attachment_path = $4,
          approved_attachment_name = $5,
          approved_attachment_mime = $6,
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
          STATUS_WAITING_HR,
        ]
      );

      if (r.rowCount === 0) {
        return res.status(400).json({ message: "Report must be waiting HR final file" });
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

      return res.download(filePath, fileName || "awol-report-file");
    } catch (e) {
      console.error("GET /api/awol-reports/:id/download/:type ERROR:", e.message);
      return res.status(500).json({ message: e.message || "Server error" });
    }
  }
);

module.exports = router;