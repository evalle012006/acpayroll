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
  isHrDepartment,
  isAccountingDepartment,
  isITDepartment,
  isBranchManager,
  isAreaManager,
  isRegionalManager,
  isAssistantVicePresident,
  isVicePresident,
  isSeniorVicePresident,
  isPresident,
  isTread,
  isOperationVP,
} = require("../utils/roleAccess");

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

const canCreateSAP = (req) =>
  isAdmin(req) ||
  isIT(req) ||
  isHrDepartment(req) ||
  isAccountingDepartment(req) ||
  isOperationVP(req);

const canViewSAP = (req) =>
  isAdmin(req) ||
  isIT(req) ||
  isHrDepartment(req) ||
  isAccountingDepartment(req) ||
  isBranchManager(req) ||
  isAreaManager(req) ||
  isRegionalManager(req) ||
  isAssistantVicePresident(req) ||
  isVicePresident(req) ||
  isSeniorVicePresident(req) ||
  isPresident(req) ||
  isTread(req);

const canViewAllSAP = (req) =>
  isAdmin(req) ||
  isIT(req) ||
  isHrDepartment(req) ||
  isAccountingDepartment(req) ||
  isVicePresident(req) ||
  isSeniorVicePresident(req) ||
  isPresident(req) ||
  isTread(req);

const canApproveSAP = (req) =>
  isHrDepartment(req) ||
  isAccountingDepartment(req) ||
  isSeniorVicePresident(req);

const canRejectSAP = (req) =>
  isHrDepartment(req) ||
  isAccountingDepartment(req) ||
  isITDepartment(req) ||
  isSeniorVicePresident(req);

const canVoidSAP = (req) =>
  isAccountingDepartment(req) ||
  isHrDepartment(req) ||
  isAdmin(req) ||
  isIT(req);

const canDeleteSAP = (req) =>
  isAdmin(req) ||
  isIT(req) ||
  isITDepartment(req);

const canBypassSAP = (req) => isAdmin(req) || isIT(req);

const canUploadFinalFile = (req) =>
  isHrDepartment(req) ||
  isAccountingDepartment(req) ||
  isAdmin(req) ||
  isIT(req);

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

function userBranchId(req) {
  return toInt(req.user?.branch_id || req.user?.branchId);
}

function userArea(req) {
  return norm(req.user?.area);
}

function userRegion(req) {
  return norm(req.user?.region);
}

function userDivision(req) {
  return norm(req.user?.division);
}

function buildViewScopeWhere(req, startIndex = 1) {
  if (canViewAllSAP(req)) return { where: "", params: [] };

  if (isBranchManager(req)) {
    const branchId = userBranchId(req);
    if (!branchId) return { where: " AND 1 = 0 ", params: [] };

    return {
      where: ` AND s.branch_id = $${startIndex}::int `,
      params: [branchId],
    };
  }

  if (isAreaManager(req)) {
    const area = userArea(req);
    if (!area) return { where: " AND 1 = 0 ", params: [] };

    return {
      where: ` AND LOWER(TRIM(COALESCE(s.area, ''))) = $${startIndex}::varchar `,
      params: [area],
    };
  }

  if (isRegionalManager(req)) {
    const region = userRegion(req);
    if (!region) return { where: " AND 1 = 0 ", params: [] };

    return {
      where: ` AND LOWER(TRIM(COALESCE(s.region, ''))) = $${startIndex}::varchar `,
      params: [region],
    };
  }

  if (isAssistantVicePresident(req)) {
    const division = userDivision(req);
    if (!division) return { where: " AND 1 = 0 ", params: [] };

    return {
      where: ` AND LOWER(TRIM(COALESCE(s.division, ''))) = $${startIndex}::varchar `,
      params: [division],
    };
  }

  return { where: " AND 1 = 0 ", params: [] };
}

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

function removeUploadedFile(filePathValue) {
  try {
    if (!filePathValue) return;

    const rel = String(filePathValue).replace(/^\/uploads\//, "");
    const abs = path.join(__dirname, "..", "uploads", rel);

    if (fs.existsSync(abs)) fs.unlinkSync(abs);
  } catch (e) {
    console.error("DELETE OLD SAP FILE ERROR:", e.message);
  }
}

async function userCanAccessSapRecord(client, req, id) {
  if (!canViewSAP(req)) return false;
  if (canViewAllSAP(req)) return true;

  const scope = buildViewScopeWhere(req, 2);

  const r = await client.query(
    `
    SELECT sap.id
    FROM public.staff_accounts_payable sap
    LEFT JOIN public.staff s ON s.id = sap.employee_id
    WHERE sap.id = $1::bigint
    ${scope.where}
    LIMIT 1
    `,
    [id, ...scope.params]
  );

  return r.rowCount > 0;
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

      const scope = buildViewScopeWhere(req, 1);

      const r = await pool.query(
        `
        SELECT
          sap.id,
          sap.employee_id,
          sap.staff_name,
          sap.description,
          sap.amount,
          sap.release_date,
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
          sap.branch,
          sap.area,
          sap.region,
          sap.division,
          sap.department,
          COALESCE(sap.employee_no, s.employee_no) AS employee_no,
          s.branch_id
        FROM public.staff_accounts_payable sap
        LEFT JOIN public.staff s ON s.id = sap.employee_id
        WHERE 1 = 1
        ${scope.where}
        ORDER BY sap.id DESC
        `,
        scope.params
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
      if (!canViewSAP(req)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const employeeNo = toStr(req.params.employeeNo);

      if (!employeeNo) {
        return res.status(400).json({ message: "Invalid employee_no" });
      }

      const { staffId } = await staffIdFromEmployeeNo(client, employeeNo);

      if (!staffId) {
        return res.status(404).json({ message: "Staff not found" });
      }

      const scope = buildViewScopeWhere(req, 3);

      const r = await client.query(
        `
        SELECT
          sap.*,
          COALESCE(sap.employee_no, s.employee_no, $1::varchar) AS employee_no,
          s.branch_id
        FROM public.staff_accounts_payable sap
        LEFT JOIN public.staff s ON s.id = sap.employee_id
        WHERE sap.employee_id = $2::int
        ${scope.where}
        ORDER BY sap.id DESC
        `,
        [employeeNo, staffId, ...scope.params]
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
            "Only VP of Operation Department, HR Department, Accounting Department, Admin, or IT can create SAP.",
        });
      }

      const employee_no = toStr(req.body?.employee_no || req.body?.employeeNo);
      const staff_name = toStr(req.body?.staff_name || req.body?.staffName);

      const branch = toStr(req.body?.branch);
      const area = toStr(req.body?.area);
      const region = toStr(req.body?.region);
      const division = toStr(req.body?.division);
      const department = toStr(req.body?.department);

      const description = toStr(req.body?.description);
      const amount = toNum(req.body?.amount);
      const release_date = toStr(req.body?.release_date);

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

      if (!release_date) {
        return res.status(400).json({ message: "release_date is required" });
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
            branch,
            area,
            region,
            division,
            department,
            description,
            amount,
            release_date,
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
            $4::text,
            $5::text,
            $6::text,
            $7::text,
            $8::text,
            $9::text,
            $10::numeric,
            $11::date,
            'Pending',
            $12::int,
            $13::varchar,
            $14::varchar,
            $15::varchar,
            $16::text,
            $17::text,
            $18::text
          )
        RETURNING *;
        `,
        [
          staffId,
          employee_no,
          staff_name,
          branch,
          area,
          region,
          division,
          department,
          description,
          amount,
          release_date,
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

async function approveSapRecord(client, req, id, file) {
  const cur = await client.query(
    `
    SELECT
      id,
      status,
      approved_attachment_path
    FROM public.staff_accounts_payable
    WHERE id = $1::bigint
    FOR UPDATE
    `,
    [id]
  );

  if (cur.rowCount === 0) {
    return { status: 404, body: { message: "SAP record not found" } };
  }

  const row = cur.rows[0];

  let approvedPath = row.approved_attachment_path || null;
  let approvedName = null;
  let approvedMime = null;

  if (file) {
    removeUploadedFile(row.approved_attachment_path);

    approvedPath = `/uploads/staff-accounts-payable/${file.filename}`;
    approvedName = file.originalname || null;
    approvedMime = file.mimetype || null;
  }

  const upd = await client.query(
    `
    UPDATE public.staff_accounts_payable
    SET
      status = 'Approved',
      approved_by = $1::int,
      approved_at = NOW(),
      rejected_by = NULL,
      rejected_at = NULL,
      rejection_reason = NULL,
      approved_attachment_path = COALESCE($3::text, approved_attachment_path),
      approved_attachment_name = COALESCE($4::text, approved_attachment_name),
      approved_attachment_mime = COALESCE($5::text, approved_attachment_mime),
      updated_at = NOW()
    WHERE id = $2::bigint
    RETURNING *;
    `,
    [toInt(req.user?.id), id, approvedPath, approvedName, approvedMime]
  );

  return { status: 200, body: upd.rows[0] };
}

router.put(
  "/staff-accounts-payable/:id",
  requireAuth,
  requirePermission("staff_accounts_payable", "approve"),
  upload.single("attachment"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const id = toInt(req.params.id);
      if (!id) return res.status(400).json({ message: "Invalid id" });

      const status = toStr(req.body?.status);
      const reason = toStr(req.body?.reason);

      if (!status) return res.status(400).json({ message: "status is required" });

      const sLower = status.toLowerCase();

      if (!["approved", "rejected"].includes(sLower)) {
        return res.status(400).json({
          message: "status must be Approved or Rejected",
        });
      }

      if (sLower === "approved" && !canApproveSAP(req)) {
        return res.status(403).json({
          message:
            "Only HR Department, Accounting Department, or Senior Vice President can approve SAP.",
        });
      }

      if (sLower === "rejected" && !canRejectSAP(req)) {
        return res.status(403).json({
          message:
            "Only HR Department, Accounting Department, IT Department, or Senior Vice President can reject SAP.",
        });
      }

      if (sLower === "approved" && req.file && !canUploadFinalFile(req)) {
        return res.status(403).json({
          message:
            "Only HR Department, Accounting Department, Admin, or IT can upload the final file.",
        });
      }

      if (sLower === "approved" && !req.file && canUploadFinalFile(req)) {
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

      if (sLower === "approved") {
        const result = await approveSapRecord(client, req, id, req.file);

        if (result.status !== 200) {
          await client.query("ROLLBACK");
          return res.status(result.status).json(result.body);
        }

        await client.query("COMMIT");
        return res.json(result.body);
      }

      const cur = await client.query(
        `
        SELECT id
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

      const upd = await client.query(
        `
        UPDATE public.staff_accounts_payable
        SET
          status = 'Rejected',
          rejected_by = $1::int,
          rejected_at = NOW(),
          rejection_reason = $2::text,
          updated_at = NOW()
        WHERE id = $3::bigint
        RETURNING *;
        `,
        [toInt(req.user?.id), reason || null, id]
      );

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

router.put(
  "/staff-accounts-payable/:id/bypass",
  requireAuth,
  requirePermission("staff_accounts_payable", "approve"),
  upload.single("attachment"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const id = toInt(req.params.id);
      if (!id) return res.status(400).json({ message: "Invalid id" });

      if (!canBypassSAP(req)) {
        return res.status(403).json({
          message: "Only Admin or IT can bypass approval.",
        });
      }

      if (!req.file) {
        return res.status(400).json({
          message: "Final approved attachment is required for bypass approval.",
        });
      }

      await client.query("BEGIN");

      const result = await approveSapRecord(client, req, id, req.file);

      if (result.status !== 200) {
        await client.query("ROLLBACK");
        return res.status(result.status).json(result.body);
      }

      await client.query("COMMIT");

      return res.json(result.body);
    } catch (e) {
      try {
        await client.query("ROLLBACK");
      } catch {}

      console.error("PUT /api/staff-accounts-payable/:id/bypass ERROR:", e.message);
      return res.status(500).json({ message: e?.message || "Server error" });
    } finally {
      client.release();
    }
  }
);

router.put(
  "/staff-accounts-payable/:id/void",
  requireAuth,
  requirePermission("staff_accounts_payable", "approve"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const id = toInt(req.params.id);
      const reason = toStr(req.body?.reason);

      if (!id) return res.status(400).json({ message: "Invalid id" });

      if (!canVoidSAP(req)) {
        return res.status(403).json({
          message: "Only Accounting Department, HR Department, Admin, or IT can void SAP.",
        });
      }

      if (!reason) {
        return res.status(400).json({ message: "Void reason is required." });
      }

      await client.query("BEGIN");

      const cur = await client.query(
        `
        SELECT id, status
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

      if (toStr(cur.rows[0].status) !== "Approved") {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: "Only Approved SAP records can be voided.",
        });
      }

      const upd = await client.query(
        `
        UPDATE public.staff_accounts_payable
        SET
          status = 'Void',
          rejected_by = $1::int,
          rejected_at = NOW(),
          rejection_reason = $2::text,
          updated_at = NOW()
        WHERE id = $3::bigint
        RETURNING *;
        `,
        [toInt(req.user?.id), reason, id]
      );

      await client.query("COMMIT");

      return res.json(upd.rows[0]);
    } catch (e) {
      try {
        await client.query("ROLLBACK");
      } catch {}

      console.error("PUT /api/staff-accounts-payable/:id/void ERROR:", e.message);
      return res.status(500).json({ message: e?.message || "Server error" });
    } finally {
      client.release();
    }
  }
);

router.delete(
  "/staff-accounts-payable/:id",
  requireAuth,
  requirePermission("staff_accounts_payable", "delete"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const id = toInt(req.params.id);
      if (!id) return res.status(400).json({ message: "Invalid id" });

      if (!canDeleteSAP(req)) {
        return res.status(403).json({
          message: "Only Admin or IT Department can delete SAP.",
        });
      }

      await client.query("BEGIN");

      const cur = await client.query(
        `
        SELECT
          id,
          status,
          attachment_path,
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

      const row = cur.rows[0];
      const status = norm(row.status);

      if (!["rejected", "void"].includes(status)) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: "Only Rejected or Void SAP records can be deleted.",
        });
      }

      await client.query(
        `
        DELETE FROM public.staff_accounts_payable
        WHERE id = $1::bigint
        `,
        [id]
      );

      removeUploadedFile(row.attachment_path);
      removeUploadedFile(row.approved_attachment_path);

      await client.query("COMMIT");

      return res.json({ message: "SAP deleted successfully." });
    } catch (e) {
      try {
        await client.query("ROLLBACK");
      } catch {}

      console.error("DELETE /api/staff-accounts-payable/:id ERROR:", e.message);
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
    const client = await pool.connect();

    try {
      const id = toInt(req.params.id);
      const type = norm(req.params.type);

      if (!id) return res.status(400).json({ message: "Invalid id" });

      if (!["request", "approved"].includes(type)) {
        return res.status(400).json({ message: "Invalid file type" });
      }

      const canAccess = await userCanAccessSapRecord(client, req, id);

      if (!canAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      const r = await client.query(
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
    } finally {
      client.release();
    }
  }
);

module.exports = router;