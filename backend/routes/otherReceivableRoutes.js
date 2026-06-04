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

const canCreateOR = (req) =>
  isAdmin(req) ||
  isIT(req) ||
  isHrDepartment(req) ||
  isAccountingDepartment(req) ||
  isOperationVP(req);

const canViewOR = (req) =>
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

const canViewAllOR = (req) =>
  isAdmin(req) ||
  isIT(req) ||
  isHrDepartment(req) ||
  isAccountingDepartment(req) ||
  isVicePresident(req) ||
  isSeniorVicePresident(req) ||
  isPresident(req) ||
  isTread(req);

const canApproveOR = (req) =>
  isHrDepartment(req) ||
  isAccountingDepartment(req) ||
  isSeniorVicePresident(req);

const canRejectOR = (req) =>
  isHrDepartment(req) ||
  isAccountingDepartment(req) ||
  isITDepartment(req) ||
  isSeniorVicePresident(req);

const canVoidOR = (req) =>
  isAccountingDepartment(req) ||
  isHrDepartment(req) ||
  isAdmin(req) ||
  isIT(req);

const canDeleteOR = (req) =>
  isAdmin(req) ||
  isIT(req) ||
  isITDepartment(req);

const canBypassOR = (req) => isAdmin(req) || isIT(req);

const canUploadFinalFile = (req) =>
  isHrDepartment(req) ||
  isAccountingDepartment(req) ||
  isAdmin(req) ||
  isIT(req);

const uploadDir = path.join(__dirname, "..", "uploads", "other-receivables");

fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    const base = path
      .basename(file.originalname || "other-receivable-file", ext)
      .replace(/[^a-zA-Z0-9-_]/g, "_")
      .slice(0, 80);

    cb(null, `other_receivable_${Date.now()}_${base}${ext}`);
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
  if (canViewAllOR(req)) return { where: "", params: [] };

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
    console.error("DELETE OLD OTHER RECEIVABLE FILE ERROR:", e.message);
  }
}

async function userCanAccessORRecord(client, req, id) {
  if (!canViewOR(req)) return false;
  if (canViewAllOR(req)) return true;

  const scope = buildViewScopeWhere(req, 2);

  const r = await client.query(
    `
    SELECT ore.id
    FROM public.other_receivables ore
    LEFT JOIN public.staff s ON s.id = ore.employee_id
    WHERE ore.id = $1::bigint
    ${scope.where}
    LIMIT 1
    `,
    [id, ...scope.params]
  );

  return r.rowCount > 0;
}

router.get(
  "/other-receivables",
  requireAuth,
  requirePermission("other_receivable", "view"),
  async (req, res) => {
    try {
      if (!canViewOR(req)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const scope = buildViewScopeWhere(req, 1);

      const r = await pool.query(
        `
        SELECT
          ore.id,
          ore.employee_id,
          ore.employee_no,
          ore.employee_name,
          ore.branch,
          ore.area,
          ore.region,
          ore.division,
          ore.department,
          ore.description,
          ore.amount,
          ore.release_date,
          ore.term,
          ore.per_month,
          ore.deduction_start_date,
          ore.balance,
          ore.attachment_path,
          ore.attachment_name,
          ore.attachment_mime,
          ore.status,
          ore.created_by,
          ore.created_at,
          ore.approved_by,
          ore.approved_at,
          ore.rejected_by,
          ore.rejected_at,
          ore.rejection_reason,
          ore.updated_at,
          s.branch_id
        FROM public.other_receivables ore
        LEFT JOIN public.staff s ON s.id = ore.employee_id
        WHERE 1 = 1
        ${scope.where}
        ORDER BY ore.id DESC
        `,
        scope.params
      );

      return res.json(r.rows);
    } catch (e) {
      console.error("GET /api/other-receivables ERROR:", e.message);
      return res.status(500).json({ message: e?.message || "Server error" });
    }
  }
);

router.post(
  "/other-receivables",
  requireAuth,
  requirePermission("other_receivable", "create"),
  upload.single("attachment"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      if (!canCreateOR(req)) {
        return res.status(403).json({
          message:
            "Only VP of Operation Department, HR Department, Accounting Department, Admin, or IT can create Other Receivable.",
        });
      }

      const employee_no = toStr(req.body?.employee_no || req.body?.employeeNo);
      const employee_name = toStr(
        req.body?.employee_name ||
          req.body?.employeeName ||
          req.body?.staff_name ||
          req.body?.staffName
      );

      const branch = toStr(req.body?.branch);
      const area = toStr(req.body?.area);
      const region = toStr(req.body?.region);
      const division = toStr(req.body?.division);
      const department = toStr(req.body?.department);

      const description = toStr(req.body?.description);
      const amount = toNum(req.body?.amount);
      const release_date = toStr(req.body?.release_date);

      const term = Math.max(1, toInt(req.body?.term) || 1);
      const per_month =
        toNum(req.body?.per_month) > 0
          ? toNum(req.body?.per_month)
          : amount / term;

      const deduction_start_date = toStr(
        req.body?.deduction_start_date || req.body?.deductionStartDate
      );

      const balance = amount;

      if (!employee_no) {
        return res.status(400).json({ message: "employee_no is required" });
      }

      if (!employee_name) {
        return res.status(400).json({ message: "employee_name is required" });
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

      if (!deduction_start_date) {
        return res.status(400).json({
          message: "deduction_start_date is required",
        });
      }

      await client.query("BEGIN");

      const { staffId } = await staffIdFromEmployeeNo(client, employee_no);

      if (!staffId) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Staff not found" });
      }

      const attachmentPath = req.file
        ? `/uploads/other-receivables/${req.file.filename}`
        : null;

      const ins = await client.query(
        `
        INSERT INTO public.other_receivables
          (
            employee_id,
            employee_no,
            employee_name,
            branch,
            area,
            region,
            division,
            department,
            description,
            amount,
            release_date,
            term,
            per_month,
            deduction_start_date,
            balance,
            attachment_path,
            attachment_name,
            attachment_mime,
            status,
            created_by,
            created_at,
            updated_at
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
            $12::int,
            $13::numeric,
            $14::date,
            $15::numeric,
            $16::text,
            $17::text,
            $18::text,
            'Pending',
            $19::int,
            NOW(),
            NOW()
          )
        RETURNING *;
        `,
        [
          staffId,
          employee_no,
          employee_name,
          branch,
          area,
          region,
          division,
          department,
          description,
          amount,
          release_date,
          term,
          per_month,
          deduction_start_date,
          balance,
          attachmentPath,
          req.file?.originalname || null,
          req.file?.mimetype || null,
          toInt(req.user?.id),
        ]
      );

      await client.query("COMMIT");

      return res.json(ins.rows[0]);
    } catch (e) {
      try {
        await client.query("ROLLBACK");
      } catch {}

      console.error("POST /api/other-receivables ERROR:", e.message);
      return res.status(500).json({ message: e?.message || "Server error" });
    } finally {
      client.release();
    }
  }
);

async function approveORRecord(client, req, id) {
  const cur = await client.query(
    `
    SELECT id
    FROM public.other_receivables
    WHERE id = $1::bigint
    FOR UPDATE
    `,
    [id]
  );

  if (cur.rowCount === 0) {
    return { status: 404, body: { message: "Other Receivable record not found" } };
  }

  const upd = await client.query(
    `
    UPDATE public.other_receivables
    SET
      status = 'Approved',
      approved_by = $1::int,
      approved_at = NOW(),
      rejected_by = NULL,
      rejected_at = NULL,
      rejection_reason = NULL,
      updated_at = NOW()
    WHERE id = $2::bigint
    RETURNING *;
    `,
    [toInt(req.user?.id), id]
  );

  return { status: 200, body: upd.rows[0] };
}

router.put(
  "/other-receivables/:id",
  requireAuth,
  requirePermission("other_receivable", "approve"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const id = toInt(req.params.id);
      if (!id) return res.status(400).json({ message: "Invalid id" });

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

      if (sLower === "approved" && !canApproveOR(req)) {
        return res.status(403).json({
          message:
            "Only HR Department, Accounting Department, or Senior Vice President can approve Other Receivable.",
        });
      }

      if (sLower === "rejected" && !canRejectOR(req)) {
        return res.status(403).json({
          message:
            "Only HR Department, Accounting Department, IT Department, or Senior Vice President can reject Other Receivable.",
        });
      }

      if (sLower === "rejected" && !reason) {
        return res.status(400).json({
          message: "reason is required for rejection",
        });
      }

      await client.query("BEGIN");

      if (sLower === "approved") {
        const result = await approveORRecord(client, req, id);

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
        FROM public.other_receivables
        WHERE id = $1::bigint
        FOR UPDATE
        `,
        [id]
      );

      if (cur.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Other Receivable record not found" });
      }

      const upd = await client.query(
        `
        UPDATE public.other_receivables
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

      console.error("PUT /api/other-receivables/:id ERROR:", e.message);
      return res.status(500).json({ message: e?.message || "Server error" });
    } finally {
      client.release();
    }
  }
);

router.put(
  "/other-receivables/:id/bypass",
  requireAuth,
  requirePermission("other_receivable", "approve"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const id = toInt(req.params.id);
      if (!id) return res.status(400).json({ message: "Invalid id" });

      if (!canBypassOR(req)) {
        return res.status(403).json({
          message: "Only Admin or IT can bypass approval.",
        });
      }

      await client.query("BEGIN");

      const result = await approveORRecord(client, req, id);

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

      console.error("PUT /api/other-receivables/:id/bypass ERROR:", e.message);
      return res.status(500).json({ message: e?.message || "Server error" });
    } finally {
      client.release();
    }
  }
);

router.put(
  "/other-receivables/:id/void",
  requireAuth,
  requirePermission("other_receivable", "approve"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const id = toInt(req.params.id);
      const reason = toStr(req.body?.reason);

      if (!id) return res.status(400).json({ message: "Invalid id" });

      if (!canVoidOR(req)) {
        return res.status(403).json({
          message:
            "Only Accounting Department, HR Department, Admin, or IT can void Other Receivable.",
        });
      }

      if (!reason) {
        return res.status(400).json({ message: "Void reason is required." });
      }

      await client.query("BEGIN");

      const cur = await client.query(
        `
        SELECT id, status
        FROM public.other_receivables
        WHERE id = $1::bigint
        FOR UPDATE
        `,
        [id]
      );

      if (cur.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Other Receivable record not found" });
      }

      if (toStr(cur.rows[0].status) !== "Approved") {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: "Only Approved Other Receivable records can be voided.",
        });
      }

      const upd = await client.query(
        `
        UPDATE public.other_receivables
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

      console.error("PUT /api/other-receivables/:id/void ERROR:", e.message);
      return res.status(500).json({ message: e?.message || "Server error" });
    } finally {
      client.release();
    }
  }
);

router.delete(
  "/other-receivables/:id",
  requireAuth,
  requirePermission("other_receivable", "delete"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const id = toInt(req.params.id);
      if (!id) return res.status(400).json({ message: "Invalid id" });

      if (!canDeleteOR(req)) {
        return res.status(403).json({
          message: "Only Admin or IT Department can delete Other Receivable.",
        });
      }

      await client.query("BEGIN");

      const cur = await client.query(
        `
        SELECT
          id,
          status,
          attachment_path
        FROM public.other_receivables
        WHERE id = $1::bigint
        FOR UPDATE
        `,
        [id]
      );

      if (cur.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Other Receivable record not found" });
      }

      const row = cur.rows[0];
      const status = norm(row.status);

      if (!["rejected", "void"].includes(status)) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: "Only Rejected or Void Other Receivable records can be deleted.",
        });
      }

      await client.query(
        `
        DELETE FROM public.other_receivables
        WHERE id = $1::bigint
        `,
        [id]
      );

      removeUploadedFile(row.attachment_path);

      await client.query("COMMIT");

      return res.json({ message: "Other Receivable deleted successfully." });
    } catch (e) {
      try {
        await client.query("ROLLBACK");
      } catch {}

      console.error("DELETE /api/other-receivables/:id ERROR:", e.message);
      return res.status(500).json({ message: e?.message || "Server error" });
    } finally {
      client.release();
    }
  }
);

router.get(
  "/other-receivables/:id/download",
  requireAuth,
  requirePermission("other_receivable", "view"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const id = toInt(req.params.id);
      if (!id) return res.status(400).json({ message: "Invalid id" });

      const canAccess = await userCanAccessORRecord(client, req, id);

      if (!canAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      const r = await client.query(
        `
        SELECT
          attachment_path,
          attachment_name
        FROM public.other_receivables
        WHERE id = $1
        LIMIT 1
        `,
        [id]
      );

      if (r.rowCount === 0) {
        return res.status(404).json({ message: "Other Receivable record not found" });
      }

      const row = r.rows[0];

      if (!row.attachment_path) {
        return res.status(404).json({ message: "File not found" });
      }

      const rel = String(row.attachment_path).replace(/^\/uploads\//, "");
      const abs = path.join(__dirname, "..", "uploads", rel);

      if (!fs.existsSync(abs)) {
        return res.status(404).json({ message: "Physical file missing" });
      }

      return res.download(abs, row.attachment_name || path.basename(abs));
    } catch (e) {
      console.error("DOWNLOAD OTHER RECEIVABLE FILE ERROR:", e.message);
      return res.status(500).json({ message: e?.message || "Server error" });
    } finally {
      client.release();
    }
  }
);

module.exports = router;