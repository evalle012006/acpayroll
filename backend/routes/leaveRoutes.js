const express = require("express");
const router = express.Router();
const pool = require("../db");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { requireAuth, requireRole } = require("../middlewares/authMiddleware");

const toInt = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

const toStr = (v) => String(v ?? "").trim();

const toDateOrNull = (v) => {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const d = s.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
};

const roleLower = (req) => String(req.user?.role || "").trim().toLowerCase();
const isAdmin = (req) => roleLower(req) === "admin";
const isHr = (req) => roleLower(req) === "hr";
const isAccounting = (req) => roleLower(req) === "accounting";
const isBranchManager = (req) => roleLower(req) === "branch manager";
const isAreaManager = (req) => roleLower(req) === "area manager";
const isRegionalManager = (req) => roleLower(req) === "regional manager";
const isAssistantVicePresident = (req) => roleLower(req) === "assistant vice president";

const getUserBranchCode = (req) => toStr(req.user?.branch_id);
const getUserArea = (req) => toStr(req.user?.area);

const isRequestViewer = (req) =>
  isAdmin(req) || isRegionalManager(req) || isAssistantVicePresident(req);

const canUploadApprovedLeave = (req) => isAdmin(req);

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

  if (r.rowCount === 0) return null;
  return r.rows[0].id;
}

const makeTxnCode = (leaveType) => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  const lt = String(leaveType || "").toLowerCase();

  const prefix = lt.includes("sick")
    ? "SL"
    : lt.includes("annual")
    ? "AL"
    : lt.includes("maternity")
    ? "ML"
    : lt.includes("paternity")
    ? "PL"
    : "LV";

  return `${prefix}${y}${m}${day}`;
};

const diffDaysInclusive = (startDate, endDate) => {
  const a = new Date(startDate);
  const b = new Date(endDate);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  const ms = b.setHours(0, 0, 0, 0) - a.setHours(0, 0, 0, 0);
  return Math.floor(ms / 86400000) + 1;
};

const leaveUploadDir = path.join(__dirname, "..", "uploads", "leave_attachments");
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
  limits: { fileSize: 10 * 1024 * 1024 },
});

const baseLeaveSelect = `
  SELECT
    lr.id,
    lr.staff_name,
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

  LEFT JOIN LATERAL (
    SELECT
      file_name,
      file_path,
      file_mime,
      file_size,
      uploaded_by_role
    FROM public.leave_attachments
    WHERE leave_request_id = lr.id
      AND attachment_type = 'request'
    ORDER BY id DESC
    LIMIT 1
  ) req_file ON true

  LEFT JOIN LATERAL (
    SELECT
      file_name,
      file_path,
      file_mime,
      file_size,
      uploaded_by_role
    FROM public.leave_attachments
    WHERE leave_request_id = lr.id
      AND attachment_type = 'approved'
    ORDER BY id DESC
    LIMIT 1
  ) appr_file ON true
`;

const initialPendingStatusForRequester = (req) => {
  if (isAreaManager(req)) return "Pending Regional Manager";
  if (isRegionalManager(req)) return "Pending Assistant Vice President";
  if (isAssistantVicePresident(req)) return "Pending Admin";
  if (isAdmin(req) || isHr(req) || isAccounting(req)) return "Pending Admin";
  return "Pending Area Manager";
};

const canActOnLeave = async (req, leaveId) => {
  const r = await pool.query(
    `
    SELECT
      lr.id,
      lr.status,
      lr.employee_id,
      s.area,
      s.branch_id
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

  if (status === "Rejected" || status === "Approved") {
    return { ok: false, code: 400, message: `Leave already ${status.toLowerCase()}` };
  }

  if (status === "Pending Area Manager") {
    if (!isAreaManager(req)) {
      return { ok: false, code: 403, message: "Only area manager can act on this stage" };
    }

    const userArea = toStr(getUserArea(req)).toLowerCase();
    const rowArea = toStr(row.area).toLowerCase();

    if (!userArea || userArea !== rowArea) {
      return { ok: false, code: 403, message: "Access denied" };
    }

    return { ok: true, row };
  }

  if (status === "Pending Regional Manager") {
    if (!isRegionalManager(req) && !isAdmin(req)) {
      return {
        ok: false,
        code: 403,
        message: "Only regional manager can act on this stage",
      };
    }

    return { ok: true, row };
  }

  if (status === "Pending Assistant Vice President") {
    if (!isAssistantVicePresident(req) && !isAdmin(req)) {
      return {
        ok: false,
        code: 403,
        message: "Only assistant vice president can act on this stage",
      };
    }

    return { ok: true, row };
  }

  if (status === "Pending Admin") {
    if (!isAdmin(req) && !isHr(req) && !isAccounting(req)) {
      return { ok: false, code: 403, message: "Only admin/hr/accounting can act on this stage" };
    }

    return { ok: true, row };
  }

  return { ok: false, code: 400, message: "Unsupported leave status" };
};

router.get("/leave-requests", requireAuth, async (req, res) => {
  try {
    if (
      isAdmin(req) ||
      isHr(req) ||
      isAccounting(req) ||
      isRegionalManager(req) ||
      isAssistantVicePresident(req)
    ) {
      const r = await pool.query(`
        ${baseLeaveSelect}
        ORDER BY lr.entry_date DESC NULLS LAST, lr.id DESC
      `);
      return res.json(r.rows);
    }

    if (isBranchManager(req)) {
      const branchCode = getUserBranchCode(req);
      if (!branchCode) return res.json([]);

      const bid = await getBranchIdFromCode(branchCode);
      if (!bid) return res.json([]);

      const r = await pool.query(
        `
        ${baseLeaveSelect}
        JOIN public.staff s ON s.id = lr.employee_id
        WHERE s.branch_id = $1
        ORDER BY lr.entry_date DESC NULLS LAST, lr.id DESC
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
        ${baseLeaveSelect}
        JOIN public.staff s ON s.id = lr.employee_id
        WHERE LOWER(TRIM(COALESCE(s.area, ''))) = LOWER(TRIM($1))
        ORDER BY lr.entry_date DESC NULLS LAST, lr.id DESC
        `,
        [area]
      );

      return res.json(r.rows);
    }

    return res.status(403).json({ message: "Access denied" });
  } catch (e) {
    console.error("GET /api/leave-requests ERROR:", e.message);
    return res.status(500).json({ message: "Server error" });
  }
});

router.get(
  "/leave-requests/staff/:staffId",
  requireAuth,
  requireRole([
    "admin",
    "branch manager",
    "hr",
    "accounting",
    "area manager",
    "regional manager",
    "assistant vice president",
  ]),
  async (req, res) => {
    try {
      const staffId = toInt(req.params.staffId);
      if (!staffId) return res.status(400).json({ message: "Invalid staff id" });

      if (isBranchManager(req)) {
        const branchCode = getUserBranchCode(req);
        if (!branchCode) return res.status(403).json({ message: "Access denied" });

        const bid = await getBranchIdFromCode(branchCode);
        if (!bid) return res.status(403).json({ message: "Access denied" });

        const chk = await pool.query(
          `
          SELECT id
          FROM public.staff
          WHERE id = $1
            AND branch_id = $2
          `,
          [staffId, bid]
        );

        if (chk.rowCount === 0) return res.status(403).json({ message: "Access denied" });
      }

      if (isAreaManager(req)) {
        const area = getUserArea(req);
        if (!area) return res.status(403).json({ message: "Access denied" });

        const chk = await pool.query(
          `
          SELECT id
          FROM public.staff
          WHERE id = $1
            AND LOWER(TRIM(COALESCE(area, ''))) = LOWER(TRIM($2))
          `,
          [staffId, area]
        );

        if (chk.rowCount === 0) return res.status(403).json({ message: "Access denied" });
      }

      const r = await pool.query(
        `
        ${baseLeaveSelect}
        WHERE lr.employee_id = $1
        ORDER BY lr.entry_date DESC NULLS LAST, lr.id DESC
        `,
        [staffId]
      );

      return res.json(r.rows);
    } catch (e) {
      console.error("GET /api/leave-requests/staff/:staffId ERROR:", e.message);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

router.post(
  "/leave-requests",
  requireAuth,
  requireRole([
    "admin",
    "hr",
    "accounting",
    "area manager",
    "regional manager",
    "assistant vice president",
  ]),
  upload.single("attachment"),
  async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const b = req.body || {};
      const employee_id = toInt(b.employee_id);
      const leave_type = String(b.leave_type || "").trim();
      const start_date = toDateOrNull(b.start_date);
      const end_date = toDateOrNull(b.end_date);
      const date_created = toDateOrNull(b.date_created) || toDateOrNull(new Date().toISOString());
      const reason = toStr(b.reason) || null;

      if (!employee_id) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "employee_id is required" });
      }
      if (!leave_type) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "leave_type is required" });
      }
      if (!start_date || !end_date) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "start_date and end_date are required" });
      }
      if (String(start_date) > String(end_date)) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Start date must be on or before end date" });
      }

      const total_no_of_days = diffDaysInclusive(start_date, end_date);

      const s = await client.query(
        `
        SELECT id, fullname, branch_id, area, division
        FROM public.staff
        WHERE id = $1
        `,
        [employee_id]
      );

      if (s.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Staff not found" });
      }

      const staffRow = s.rows[0];

      if (isBranchManager(req)) {
        const branchCode = getUserBranchCode(req);
        const bid = await getBranchIdFromCode(branchCode);

        if (!bid || Number(staffRow.branch_id) !== Number(bid)) {
          await client.query("ROLLBACK");
          return res.status(403).json({ message: "Access denied" });
        }
      }

      if (isAreaManager(req)) {
        const area = getUserArea(req);
        if (!area || toStr(staffRow.area).toLowerCase() !== area.toLowerCase()) {
          await client.query("ROLLBACK");
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const txnCode = makeTxnCode(leave_type);
      const id = `LV-${Date.now()}-${Math.random().toString(16).slice(2, 6).toUpperCase()}`;
      const initialStatus = initialPendingStatusForRequester(req);

      await client.query(
        `
        INSERT INTO public.leave_requests
          (
            id,
            staff_name,
            leave_type,
            start_date,
            end_date,
            status,
            transaction_code,
            entry_date,
            employee_id,
            date_created,
            total_no_of_days,
            reason
          )
        VALUES
          (
            $1, $2, $3, $4::date, $5::date, $6, $7, CURRENT_DATE, $8,
            $9::date, $10, $11
          )
        `,
        [
          id,
          String(staffRow.fullname || ""),
          leave_type,
          start_date,
          end_date,
          initialStatus,
          txnCode,
          employee_id,
          date_created,
          total_no_of_days,
          reason,
        ]
      );

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
          VALUES
            ($1, $2, $3, $4, $5, 'request', $6, $7)
          `,
          [
            id,
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

      const finalRow = await pool.query(
        `
        ${baseLeaveSelect}
        WHERE lr.id = $1
        `,
        [id]
      );

      return res.json(finalRow.rows[0]);
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("POST /api/leave-requests ERROR:", e.message);
      return res.status(500).json({ message: e?.message || "Server error" });
    } finally {
      client.release();
    }
  }
);

router.post(
  "/leave-requests/:id/approved-file",
  requireAuth,
  requireRole(["admin"]),
  upload.single("attachment"),
  async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const leaveId = String(req.params.id || "").trim();
      if (!leaveId) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Invalid leave request id" });
      }

      if (!req.file) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Attachment is required" });
      }

      if (!canUploadApprovedLeave(req)) {
        await client.query("ROLLBACK");
        return res.status(403).json({ message: "Access denied" });
      }

      const leaveCheck = await client.query(
        `
        SELECT id, status
        FROM public.leave_requests
        WHERE id = $1
        LIMIT 1
        `,
        [leaveId]
      );

      if (leaveCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Leave request not found" });
      }

      if (String(leaveCheck.rows[0].status || "") !== "Approved") {
        await client.query("ROLLBACK");
        return res
          .status(400)
          .json({ message: "Approved file can only be uploaded after approval" });
      }

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
          ($1, $2, $3, $4, $5, 'approved', $6, $7)
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

      await client.query("COMMIT");
      return res.json({ message: "Approved leave file uploaded" });
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("POST /api/leave-requests/:id/approved-file ERROR:", e.message);
      return res.status(500).json({ message: "Server error" });
    } finally {
      client.release();
    }
  }
);

router.get("/leave-requests/:id/download/:type", requireAuth, async (req, res) => {
  try {
    const id = String(req.params.id || "").trim();
    const type = String(req.params.type || "").trim().toLowerCase();

    if (!id) return res.status(400).json({ message: "Invalid id" });
    if (!["request", "approved"].includes(type)) {
      return res.status(400).json({ message: "Invalid attachment type" });
    }

    const leaveRes = await pool.query(
      `
      SELECT id, employee_id, status
      FROM public.leave_requests
      WHERE id = $1
      LIMIT 1
      `,
      [id]
    );

    if (leaveRes.rowCount === 0) {
      return res.status(404).json({ message: "Leave request not found" });
    }

    if (type === "request") {
      if (!isRequestViewer(req)) {
        return res.status(403).json({ message: "Access denied" });
      }
    }

    if (type === "approved") {
      if (
        !(
          isAdmin(req) ||
          isRegionalManager(req) ||
          isAssistantVicePresident(req) ||
          isAreaManager(req)
        )
      ) {
        return res.status(403).json({ message: "Access denied" });
      }
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
      [id, type]
    );

    if (r.rowCount === 0) {
      return res.status(404).json({ message: "No attachment found" });
    }

    const row = r.rows[0];
    const rel = String(row.file_path).replace(/^\/uploads\//, "");
    const filePath = path.join(__dirname, "..", "uploads", rel);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "Attachment file not found" });
    }

    return res.download(filePath, row.file_name || path.basename(filePath));
  } catch (e) {
    console.error("GET /api/leave-requests/:id/download/:type ERROR:", e.message);
    return res.status(500).json({ message: "Server error" });
  }
});

router.put(
  "/leave-requests/:id",
  requireAuth,
  requireRole([
    "admin",
    "hr",
    "accounting",
    "area manager",
    "regional manager",
    "assistant vice president",
  ]),
  async (req, res) => {
    try {
      const id = String(req.params.id || "").trim();
      if (!id) return res.status(400).json({ message: "Invalid id" });

      const action = String(req.body?.action || req.body?.status || "").trim();
      const rejectionReason = toStr(req.body?.rejection_reason);

      if (!["approve", "Approved", "reject", "Rejected"].includes(action)) {
        return res.status(400).json({ message: "Action must be approve or reject" });
      }

      const access = await canActOnLeave(req, id);
      if (!access.ok) {
        return res.status(access.code).json({ message: access.message });
      }

      const current = access.row;
      const currentStatus = toStr(current.status);

      if (action.toLowerCase() === "reject") {
        const r = await pool.query(
          `
          UPDATE public.leave_requests
          SET
            status = 'Rejected',
            rejection_reason = $2
          WHERE id = $1
          RETURNING id
          `,
          [id, rejectionReason || null]
        );

        if (r.rowCount === 0) return res.status(404).json({ message: "Not found" });
      } else {
        let sql = "";
        let params = [id, req.user?.id ?? null];

        if (currentStatus === "Pending Area Manager") {
          sql = `
            UPDATE public.leave_requests
            SET
              status = 'Pending Regional Manager',
              area_approved_by = $2,
              area_approved_at = NOW()
            WHERE id = $1
            RETURNING id
          `;
        } else if (currentStatus === "Pending Regional Manager") {
          sql = `
            UPDATE public.leave_requests
            SET
              status = 'Pending Assistant Vice President',
              regional_approved_by = $2,
              regional_approved_at = NOW()
            WHERE id = $1
            RETURNING id
          `;
        } else if (currentStatus === "Pending Assistant Vice President") {
          sql = `
            UPDATE public.leave_requests
            SET
              status = 'Pending Admin'
            WHERE id = $1
            RETURNING id
          `;
          params = [id];
        } else if (currentStatus === "Pending Admin") {
          sql = `
            UPDATE public.leave_requests
            SET
              status = 'Approved',
              admin_approved_by = $2,
              admin_approved_at = NOW()
            WHERE id = $1
            RETURNING id
          `;
        } else {
          return res.status(400).json({ message: "Invalid current status for approval" });
        }

        const r = await pool.query(sql, params);
        if (r.rowCount === 0) return res.status(404).json({ message: "Not found" });
      }

      const finalRow = await pool.query(
        `
        ${baseLeaveSelect}
        WHERE lr.id = $1
        `,
        [id]
      );

      return res.json(finalRow.rows[0]);
    } catch (e) {
      console.error("PUT /api/leave-requests/:id ERROR:", e.message);
      return res.status(500).json({ message: e?.message || "Server error" });
    }
  }
);

module.exports = router;