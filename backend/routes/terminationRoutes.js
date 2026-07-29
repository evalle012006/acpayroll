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
  isHrDepartment,
  isAccountingDepartment,
  isITDepartment,
} = require("../utils/roleAccess");

const STATUS_WAITING_FINAL = "Waiting Final File Upload";
const STATUS_APPROVED = "Approved";
const STATUS_REJECTED = "Rejected";
const STATUS_VOID = "Voided";

const toStr = (v) => String(v ?? "").trim();
const norm = (v) => toStr(v).toLowerCase();

const normalizeDepartment = (value) =>
  norm(value).replace(/\s+/g, " ");

const normalizeRole = (value) =>
  norm(value).replace(/\s+/g, " ");

const isOperationVicePresident = (req) => {
  const role = normalizeRole(
    req.user?.role
  );

  const department = normalizeDepartment(
    req.user?.department
  );

  return (
    department === "operation department" &&
    role === "vice president"
  );
};

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

const canManageTermination = (req) =>
  isAdmin(req) ||
  isIT(req) ||
  isHr(req) ||
  isAccounting(req) ||
  isHrDepartment(req) ||
  isAccountingDepartment(req) ||
  isITDepartment(req);

const canViewTermination = (req) =>
  canManageTermination(req) ||
  isOperationVicePresident(req);

const canDeleteTermination = (req) =>
  isAdmin(req) || isIT(req);

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

const uploadsDir = path.join(process.cwd(), "uploads", "terminations");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

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

async function generateRequestNo(client) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const prefix = "TOC";

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

/* =========================================================
   GET TERMINATION REQUESTS
========================================================= */
router.get(
  "/termination-requests",
  requireAuth,
  requirePermission("termination_request", "view"),
  async (req, res) => {
    try {
      if (!canViewTermination(req)) {
        return res.status(403).json({
          message: "Access denied",
        });
      }

      const r = await pool.query(`
        SELECT *
        FROM public.termination_requests
        ORDER BY created_at DESC, id DESC
      `);

      return res.json(r.rows);
    } catch (e) {
      console.error("GET /termination-requests ERROR:", e);
      return res.status(500).json({
        message: e.message || "Server error",
      });
    }
  }
);

/* =========================================================
   CREATE TERMINATION REQUEST
========================================================= */
router.post(
  "/termination-requests",
  requireAuth,
  requirePermission("termination_request", "create"),
  upload.single("attachment"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      if (!canManageTermination(req)) {
        return res.status(403).json({
          message:
            "Only Admin, IT Department, HR Department, and Accounting Department can create Termination of Contract.",
        });
      }

      await client.query("BEGIN");

      const employeeId = toInt(req.body?.employee_id);
      const dateCreated = toDateOrNull(req.body?.date_created);
      const effectiveDate = toDateOrNull(req.body?.effective_date);
      const reason = toStr(req.body?.reason);
      const remarks = toStr(req.body?.remarks);

      if (!employeeId) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Employee is required." });
      }

      if (!dateCreated || !effectiveDate) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: "Date Created and Effective Date are required.",
        });
      }

      if (!reason) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: "Reason is required.",
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
          s.department,
          s.position,
          b.code AS branch_code,
          b.name AS branch_name
        FROM public.staff s
        LEFT JOIN public.branches b
          ON b.id = s.branch_id
        WHERE s.id = $1
        LIMIT 1
        `,
        [employeeId]
      );

      if (staff.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Staff not found." });
      }

      const s = staff.rows[0];
      const requestNo = await generateRequestNo(client);

      const ins = await client.query(
        `
        INSERT INTO public.termination_requests
        (
          request_no,
          employee_id,
          employee_name,
          branch_id,
          branch_code,
          branch_name,
          area,
          region,
          division,
          department,
          position,
          date_created,
          effective_date,
          reason,
          remarks,
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
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
          $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
          NOW(),NOW()
        )
        RETURNING *
        `,
        [
          requestNo,
          s.id,
          displayName(s),
          s.branch_id,
          s.branch_code,
          s.branch_name,
          s.area,
          s.region,
          s.division,
          s.department,
          s.position,
          dateCreated,
          effectiveDate,
          reason,
          remarks || null,
          STATUS_WAITING_FINAL,
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

      console.error("POST /termination-requests ERROR:", e);

      return res.status(500).json({
        message: e.message || "Server error",
      });
    } finally {
      client.release();
    }
  }
);

/* =========================================================
   REJECT TERMINATION REQUEST
========================================================= */
router.put(
  "/termination-requests/:id/reject",
  requireAuth,
  requirePermission("termination_request", "reject"),
  async (req, res) => {
    try {
      if (!canManageTermination(req)) {
        return res.status(403).json({
          message: "Access denied.",
        });
      }

      const id = toInt(req.params.id);
      const reason = toStr(req.body?.reason);

      if (!id) {
        return res.status(400).json({
          message: "Invalid request id.",
        });
      }

      if (!reason) {
        return res.status(400).json({
          message: "Rejection reason is required.",
        });
      }

      const current = await pool.query(
        `
        SELECT *
        FROM public.termination_requests
        WHERE id = $1
        `,
        [id]
      );

      if (current.rowCount === 0) {
        return res.status(404).json({
          message: "Termination request not found.",
        });
      }

      const row = current.rows[0];

      if (
        row.status === STATUS_APPROVED ||
        row.status === STATUS_REJECTED ||
        row.status === STATUS_VOID
      ) {
        return res.status(400).json({
          message: `Request already ${row.status}.`,
        });
      }

      const r = await pool.query(
        `
        UPDATE public.termination_requests
        SET
          status = $2,
          rejected_by = $3,
          rejected_at = NOW(),
          rejection_reason = $4,
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
        `,
        [
          id,
          STATUS_REJECTED,
          req.user?.id ?? null,
          reason,
        ]
      );

      return res.json(r.rows[0]);
    } catch (e) {
      console.error(
        "PUT /termination-requests/:id/reject ERROR:",
        e
      );

      return res.status(500).json({
        message: e.message || "Server error",
      });
    }
  }
);

/* =========================================================
   VOID TERMINATION REQUEST
========================================================= */
router.put(
  "/termination-requests/:id/void",
  requireAuth,
  requirePermission("termination_request", "void"),
  async (req, res) => {
    try {
      if (!canManageTermination(req)) {
        return res.status(403).json({
          message: "Access denied.",
        });
      }

      const id = toInt(req.params.id);
      const reason = toStr(req.body?.reason);

      if (!id) {
        return res.status(400).json({
          message: "Invalid request id.",
        });
      }

      const current = await pool.query(
        `
        SELECT *
        FROM public.termination_requests
        WHERE id = $1
        `,
        [id]
      );

      if (current.rowCount === 0) {
        return res.status(404).json({
          message: "Termination request not found.",
        });
      }

      const row = current.rows[0];

      if (row.status !== STATUS_APPROVED) {
        return res.status(400).json({
          message: "Only approved requests can be voided.",
        });
      }

      const r = await pool.query(
        `
        UPDATE public.termination_requests
        SET
          status = $2,
          rejection_reason = COALESCE($3, rejection_reason),
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
        `,
        [
          id,
          STATUS_VOID,
          reason || null,
        ]
      );

      return res.json(r.rows[0]);
    } catch (e) {
      console.error(
        "PUT /termination-requests/:id/void ERROR:",
        e
      );

      return res.status(500).json({
        message: e.message || "Server error",
      });
    }
  }
);

/* =========================================================
   FINAL FILE UPLOAD / APPROVE TERMINATION REQUEST
========================================================= */
router.post(
  "/termination-requests/:id/final-file",
  requireAuth,
  requirePermission("termination_request", "upload_approved"),
  upload.single("attachment"),
  async (req, res) => {
    try {
      if (!canManageTermination(req)) {
        return res.status(403).json({
          message: "Access denied.",
        });
      }

      const id = toInt(req.params.id);

      if (!id) {
        return res.status(400).json({
          message: "Invalid request id.",
        });
      }

      if (!req.file) {
        return res.status(400).json({
          message: "Final approved file is required.",
        });
      }

      const current = await pool.query(
        `
        SELECT *
        FROM public.termination_requests
        WHERE id = $1
        `,
        [id]
      );

      if (current.rowCount === 0) {
        return res.status(404).json({
          message: "Termination request not found.",
        });
      }

      const row = current.rows[0];

      if (row.status !== STATUS_WAITING_FINAL) {
        return res.status(400).json({
          message: "Request must be waiting for final file upload.",
        });
      }

      const previousFile = row.approved_attachment_path;

      const r = await pool.query(
        `
        UPDATE public.termination_requests
        SET
          status = $2,
          approved_by = $3,
          approved_at = NOW(),
          hr_uploaded_by = $3,
          hr_uploaded_at = NOW(),
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
          STATUS_APPROVED,
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
      console.error(
        "POST /termination-requests/:id/final-file ERROR:",
        e
      );

      return res.status(500).json({
        message: e.message || "Server error",
      });
    }
  }
);

/* =========================================================
   DOWNLOAD REQUEST FILE
========================================================= */
router.get(
  "/termination-requests/:id/download/request",
  requireAuth,
  requirePermission("termination_request", "view"),
  async (req, res) => {
    try {
      if (!canViewTermination(req)) {
        return res.status(403).json({
          message: "Access denied.",
        });
      }

      const id = toInt(req.params.id);

      if (!id) {
        return res.status(400).json({
          message: "Invalid request id.",
        });
      }

      const r = await pool.query(
        `
        SELECT
          request_attachment_path,
          request_attachment_name
        FROM public.termination_requests
        WHERE id = $1
        `,
        [id]
      );

      if (r.rowCount === 0) {
        return res.status(404).json({
          message: "Termination request not found.",
        });
      }

      const row = r.rows[0];

      if (
        !row.request_attachment_path ||
        !fs.existsSync(row.request_attachment_path)
      ) {
        return res.status(404).json({
          message: "Request file not found.",
        });
      }

      return res.download(
        row.request_attachment_path,
        row.request_attachment_name || "termination-request-file"
      );
    } catch (e) {
      console.error(
        "GET /termination-requests/:id/download/request ERROR:",
        e
      );

      return res.status(500).json({
        message: e.message || "Server error",
      });
    }
  }
);

/* =========================================================
   DOWNLOAD APPROVED FILE
========================================================= */
router.get(
  "/termination-requests/:id/download/approved",
  requireAuth,
  requirePermission("termination_request", "view"),
  async (req, res) => {
    try {
      if (!canViewTermination(req)) {
        return res.status(403).json({
          message: "Access denied.",
        });
      }

      const id = toInt(req.params.id);

      if (!id) {
        return res.status(400).json({
          message: "Invalid request id.",
        });
      }

      const r = await pool.query(
        `
        SELECT
          approved_attachment_path,
          approved_attachment_name
        FROM public.termination_requests
        WHERE id = $1
        `,
        [id]
      );

      if (r.rowCount === 0) {
        return res.status(404).json({
          message: "Termination request not found.",
        });
      }

      const row = r.rows[0];

      if (
        !row.approved_attachment_path ||
        !fs.existsSync(row.approved_attachment_path)
      ) {
        return res.status(404).json({
          message: "Approved file not found.",
        });
      }

      return res.download(
        row.approved_attachment_path,
        row.approved_attachment_name || "termination-approved-file"
      );
    } catch (e) {
      console.error(
        "GET /termination-requests/:id/download/approved ERROR:",
        e
      );

      return res.status(500).json({
        message: e.message || "Server error",
      });
    }
  }
);

/* =========================================================
   DELETE TERMINATION REQUEST
========================================================= */
router.delete(
  "/termination-requests/:id",
  requireAuth,
  requirePermission("termination_request", "delete"),
  async (req, res) => {
    try {
      if (!canDeleteTermination(req)) {
        return res.status(403).json({
          message: "Only Admin and IT can delete termination requests.",
        });
      }

      const id = toInt(req.params.id);

      if (!id) {
        return res.status(400).json({
          message: "Invalid request id.",
        });
      }

      const current = await pool.query(
        `
        SELECT *
        FROM public.termination_requests
        WHERE id = $1
        `,
        [id]
      );

      if (current.rowCount === 0) {
        return res.status(404).json({
          message: "Termination request not found.",
        });
      }

      const row = current.rows[0];

      const files = [
        row.request_attachment_path,
        row.approved_attachment_path,
      ];

      await pool.query(
        `
        DELETE
        FROM public.termination_requests
        WHERE id = $1
        `,
        [id]
      );

      for (const file of files) {
        if (file && fs.existsSync(file)) {
          try {
            fs.unlinkSync(file);
          } catch {}
        }
      }

      return res.json({
        message: "Termination request deleted successfully.", 
      });
    } catch (e) {
      console.error(
        "DELETE /termination-requests/:id ERROR:",
        e
      );

      return res.status(500).json({
        message: e.message || "Server error",
      });
    }
  }
);

module.exports = router;