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

const toNum = (v) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const toInt = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

const roleLower = (req) => norm(req.user?.role);
const deptLower = (req) => norm(req.user?.department);

const isAdmin = (req) => roleLower(req) === "admin";
const isIT = (req) => roleLower(req) === "it";

const isHrDepartment = (req) =>
  roleLower(req) === "hr" ||
  deptLower(req) === "hr" ||
  deptLower(req) === "hr department" ||
  deptLower(req) === "human resources" ||
  deptLower(req) === "human resources department";

const isOperationVP = (req) =>
  roleLower(req) === "vice president" &&
  [
    "operation",
    "operations",
    "operation department",
    "operations department",
  ].includes(deptLower(req));

const canCreateSAP = (req) =>
  isAdmin(req) || isIT(req) || isOperationVP(req) || isHrDepartment(req);

const canApproveSAP = (req) =>
  isAdmin(req) || isIT(req) || isHrDepartment(req);

const canViewSAP = (req) => canCreateSAP(req) || canApproveSAP(req);

const uploadDir = path.join(
  __dirname,
  "..",
  "uploads",
  "staff-accounts-payable"
);

fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    const base = path
      .basename(file.originalname || "sap-file", ext)
      .replace(/[^a-zA-Z0-9-_]/g, "_")
      .slice(0, 80);

    cb(null, `sap_${Date.now()}_${base}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
});

async function staffIdFromEmployeeNo(client, employee_no) {
  const eno = toStr(employee_no);

  if (!eno) return { staffId: null, staff: null };

  const s = await client.query(
    `
    SELECT
      id,
      employee_no,
      fullname,
      first_name,
      last_name,
      middle_name,
      "position"
    FROM public.staff
    WHERE TRIM(employee_no) = TRIM($1)
    LIMIT 1
    `,
    [eno]
  );

  if (s.rowCount === 0) return { staffId: null, staff: null };

  return {
    staffId: toInt(s.rows[0].id),
    staff: s.rows[0],
  };
}

async function ensureBalanceRow(client, employeeNo) {
  await client.query(
    `
    INSERT INTO public.staff_balances
      (
        employee_no,
        fullname,
        "position",
        last_name,
        first_name,
        middle_name,
        cbu,
        cashbond,
        utility,
        salary_advance,
        motorcycle_loan,
        special_advance,
        cash_advance,
        other_receivable,
        staff_accounts_payable,
        created_at,
        updated_at
      )
    SELECT
      s.employee_no,
      s.fullname,
      s."position",
      s.last_name,
      s.first_name,
      s.middle_name,
      0, 0, 0,
      0, 0, 0, 0,
      0, 0,
      NOW(), NOW()
    FROM public.staff s
    WHERE s.employee_no = $1
    ON CONFLICT (employee_no) DO NOTHING
    `,
    [employeeNo]
  );
}

function removeUploadedFile(filePathValue) {
  try {
    if (!filePathValue) return;

    const rel = String(filePathValue).replace(/^\/uploads\//, "");
    const abs = path.join(__dirname, "..", "uploads", rel);

    if (fs.existsSync(abs)) {
      fs.unlinkSync(abs);
    }
  } catch (e) {
    console.error("DELETE OLD SAP FILE ERROR:", e.message);
  }
}

router.get(
  "/staff-accounts-payable",
  requireAuth,
  requirePermission("staff_accounts_payable", "view"),
  async (req, res) => {
    try {
      if (!canViewSAP(req)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const r = await pool.query(
        `
        SELECT
          sap.id,
          sap.employee_id,
          sap.staff_name,
          sap.description,
          sap.amount,
          sap.term,
          sap.per_month,
          sap.balance,
          sap.payable_id,
          sap.status,
          sap.created_at,
          sap.created_by,
          sap.approved_by,
          sap.approved_at,
          sap.rejected_by,
          sap.rejected_at,
          sap.rejection_reason,
          sap.last_name,
          sap.first_name,
          sap.middle_name,
          sap.entry_date,
          sap.attachment_path,
          sap.attachment_name,
          sap.attachment_mime,
          sap.approved_attachment_path,
          sap.approved_attachment_name,
          sap.approved_attachment_mime,
          COALESCE(sap.employee_no, s.employee_no) AS employee_no
        FROM public.staff_accounts_payable sap
        LEFT JOIN public.staff s ON s.id = sap.employee_id
        ORDER BY sap.id DESC
        `
      );

      return res.json(r.rows);
    } catch (e) {
      console.error("GET /api/staff-accounts-payable ERROR:", e.message);
      return res.status(500).json({ message: e?.message || "Server error" });
    }
  }
);

router.get(
  "/staff-accounts-payable/employee/:employeeNo",
  requireAuth,
  requirePermission("staff_accounts_payable", "view"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const employeeNo = toStr(req.params.employeeNo);

      if (!employeeNo) {
        return res.status(400).json({ message: "Invalid employee_no" });
      }

      const { staffId } = await staffIdFromEmployeeNo(client, employeeNo);

      if (!staffId) {
        return res.status(404).json({ message: "Staff not found" });
      }

      const r = await client.query(
        `
        SELECT
          sap.*,
          $1::varchar AS employee_no
        FROM public.staff_accounts_payable sap
        WHERE sap.employee_id = $2::int
        ORDER BY sap.id DESC
        `,
        [employeeNo, staffId]
      );

      return res.json(r.rows);
    } catch (e) {
      console.error(
        "GET /api/staff-accounts-payable/employee/:employeeNo ERROR:",
        e.message
      );

      return res.status(500).json({ message: e?.message || "Server error" });
    } finally {
      client.release();
    }
  }
);

router.post(
  "/staff-accounts-payable",
  requireAuth,
  requirePermission("staff_accounts_payable", "create"),
  upload.single("attachment"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      if (!canCreateSAP(req)) {
        return res.status(403).json({
          message:
            "Only VP of Operation Department, HR Department, Admin, or IT can create SAP.",
        });
      }

      const employee_no = toStr(req.body?.employee_no || req.body?.employeeNo);
      const staff_name = toStr(req.body?.staff_name || req.body?.staffName);
      const description = toStr(req.body?.description);

      const amount = toNum(req.body?.amount);
      const term = Math.max(1, toInt(req.body?.term) || 1);
      const per_month = toNum(req.body?.per_month);
      const balance =
        req.body?.balance === "" || req.body?.balance == null
          ? amount
          : toNum(req.body?.balance);

      if (!employee_no) {
        return res.status(400).json({ message: "employee_no is required" });
      }

      if (!staff_name) {
        return res.status(400).json({ message: "staff_name is required" });
      }

      if (!description) {
        return res.status(400).json({ message: "description is required" });
      }

      if (amount <= 0) {
        return res.status(400).json({ message: "amount is required" });
      }

      if (term <= 0) {
        return res.status(400).json({ message: "term is required" });
      }

      if (per_month <= 0) {
        return res.status(400).json({ message: "per_month is required" });
      }

      await client.query("BEGIN");

      const { staffId, staff } = await staffIdFromEmployeeNo(client, employee_no);

      if (!staffId) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Staff not found" });
      }

      const attachmentPath = req.file
        ? `/uploads/staff-accounts-payable/${req.file.filename}`
        : null;

      const ins = await client.query(
        `
        INSERT INTO public.staff_accounts_payable
          (
            employee_id,
            employee_no,
            staff_name,
            description,
            amount,
            term,
            per_month,
            balance,
            status,
            created_by,
            first_name,
            last_name,
            middle_name,
            attachment_path,
            attachment_name,
            attachment_mime
          )
        VALUES
          (
            $1::int,
            $2::varchar,
            $3::varchar,
            $4::varchar,
            $5::numeric,
            $6::int,
            $7::numeric,
            $8::numeric,
            'Pending',
            $9::int,
            $10::varchar,
            $11::varchar,
            $12::varchar,
            $13::text,
            $14::text,
            $15::text
          )
        RETURNING *;
        `,
        [
          staffId,
          employee_no,
          staff_name,
          description,
          amount,
          term,
          per_month,
          balance,
          toInt(req.user?.id),
          staff?.first_name ?? null,
          staff?.last_name ?? null,
          staff?.middle_name ?? null,
          attachmentPath,
          req.file?.originalname || null,
          req.file?.mimetype || null,
        ]
      );

      await client.query("COMMIT");

      return res.json(ins.rows[0]);
    } catch (e) {
      try {
        await client.query("ROLLBACK");
      } catch {}

      console.error("POST /api/staff-accounts-payable ERROR:", e.message);
      return res.status(500).json({ message: e?.message || "Server error" });
    } finally {
      client.release();
    }
  }
);

router.put(
  "/staff-accounts-payable/:id",
  requireAuth,
  requirePermission("staff_accounts_payable", "approve"),
  upload.single("attachment"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const id = toInt(req.params.id);

      if (!id) {
        return res.status(400).json({ message: "Invalid id" });
      }

      const status = toStr(req.body?.status);
      const reason = toStr(req.body?.reason);

      if (!status) {
        return res.status(400).json({ message: "status is required" });
      }

      const sLower = status.toLowerCase();

      if (!["approved", "rejected"].includes(sLower)) {
        return res.status(400).json({
          message: "status must be Approved or Rejected",
        });
      }

      if (!canApproveSAP(req)) {
        return res.status(403).json({
          message: "Only HR Department, Admin, or IT can approve SAP.",
        });
      }

      if (sLower === "approved" && !req.file) {
        return res.status(400).json({
          message: "Approved attachment is required before approval",
        });
      }

      if (sLower === "rejected" && !reason) {
        return res.status(400).json({
          message: "reason is required for rejection",
        });
      }

      await client.query("BEGIN");

      const cur = await client.query(
        `
        SELECT
          id,
          employee_id,
          employee_no,
          status,
          amount,
          balance,
          approved_attachment_path
        FROM public.staff_accounts_payable
        WHERE id = $1::bigint
        FOR UPDATE
        `,
        [id]
      );

      if (cur.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "SAP record not found" });
      }

      const prevStatus = toStr(cur.rows[0].status);
      const employeeNo = toStr(cur.rows[0].employee_no);
      const balToAdd = toNum(cur.rows[0].balance);
      const amtFallback = toNum(cur.rows[0].amount);
      const addValue = balToAdd > 0 ? balToAdd : amtFallback;
      const userId = toInt(req.user?.id);
      const finalStatus = sLower === "approved" ? "Approved" : "Rejected";

      let approvedPath = cur.rows[0].approved_attachment_path || null;
      let approvedName = null;
      let approvedMime = null;

      if (sLower === "approved" && req.file) {
        removeUploadedFile(cur.rows[0].approved_attachment_path);

        approvedPath = `/uploads/staff-accounts-payable/${req.file.filename}`;
        approvedName = req.file.originalname || null;
        approvedMime = req.file.mimetype || null;
      }

      const upd = await client.query(
        `
        UPDATE public.staff_accounts_payable
        SET
          status = $1::varchar,

          approved_by = CASE
            WHEN $1::varchar = 'Approved' THEN $2::int
            ELSE approved_by
          END,

          approved_at = CASE
            WHEN $1::varchar = 'Approved' THEN NOW()
            ELSE approved_at
          END,

          rejected_by = CASE
            WHEN $1::varchar = 'Rejected' THEN $2::int
            ELSE rejected_by
          END,

          rejected_at = CASE
            WHEN $1::varchar = 'Rejected' THEN NOW()
            ELSE rejected_at
          END,

          rejection_reason = CASE
            WHEN $1::varchar = 'Rejected' THEN $3::text
            ELSE rejection_reason
          END,

          approved_attachment_path = CASE
            WHEN $1::varchar = 'Approved' THEN $5::text
            ELSE approved_attachment_path
          END,

          approved_attachment_name = CASE
            WHEN $1::varchar = 'Approved' THEN $6::text
            ELSE approved_attachment_name
          END,

          approved_attachment_mime = CASE
            WHEN $1::varchar = 'Approved' THEN $7::text
            ELSE approved_attachment_mime
          END

        WHERE id = $4::bigint
        RETURNING *;
        `,
        [
          finalStatus,
          userId,
          reason || null,
          id,
          approvedPath,
          approvedName,
          approvedMime,
        ]
      );

      if (prevStatus !== "Approved" && finalStatus === "Approved" && employeeNo) {
        await ensureBalanceRow(client, employeeNo);

        await client.query(
          `
          UPDATE public.staff_balances
          SET
            staff_accounts_payable =
              COALESCE(staff_accounts_payable, 0) + $1::numeric,
            updated_at = NOW()
          WHERE employee_no = $2::varchar
          `,
          [addValue, employeeNo]
        );
      }

      await client.query("COMMIT");

      return res.json(upd.rows[0]);
    } catch (e) {
      try {
        await client.query("ROLLBACK");
      } catch {}

      console.error("PUT /api/staff-accounts-payable/:id ERROR:", e.message);
      return res.status(500).json({ message: e?.message || "Server error" });
    } finally {
      client.release();
    }
  }
);

router.get(
  "/staff-accounts-payable/:id/download/:type",
  requireAuth,
  requirePermission("staff_accounts_payable", "view"),
  async (req, res) => {
    try {
      const id = toInt(req.params.id);
      const type = norm(req.params.type);

      if (!id) {
        return res.status(400).json({ message: "Invalid id" });
      }

      if (!["request", "approved"].includes(type)) {
        return res.status(400).json({ message: "Invalid file type" });
      }

      const r = await pool.query(
        `
        SELECT
          attachment_path,
          attachment_name,
          approved_attachment_path,
          approved_attachment_name
        FROM public.staff_accounts_payable
        WHERE id = $1
        LIMIT 1
        `,
        [id]
      );

      if (r.rowCount === 0) {
        return res.status(404).json({ message: "SAP record not found" });
      }

      const row = r.rows[0];

      const filePathValue =
        type === "approved" ? row.approved_attachment_path : row.attachment_path;

      const fileNameValue =
        type === "approved" ? row.approved_attachment_name : row.attachment_name;

      if (!filePathValue) {
        return res.status(404).json({ message: "File not found" });
      }

      const rel = String(filePathValue).replace(/^\/uploads\//, "");
      const abs = path.join(__dirname, "..", "uploads", rel);

      if (!fs.existsSync(abs)) {
        return res.status(404).json({ message: "Physical file missing" });
      }

      return res.download(abs, fileNameValue || path.basename(abs));
    } catch (e) {
      console.error("DOWNLOAD SAP FILE ERROR:", e.message);
      return res.status(500).json({ message: e?.message || "Server error" });
    }
  }
);

module.exports = router;