const express = require("express");
const router = express.Router();
const pool = require("../db");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { requireAuth } = require("../middlewares/authMiddleware");
const { requirePermission } = require("../utils/permissions");

const toInt = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

const toStr = (v) => String(v ?? "").trim();
const norm = (v) => toStr(v).toLowerCase();

const roleLower = (req) => norm(req.user?.role);

const isAdmin = (req) => ["admin", "it"].includes(roleLower(req));
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

const BACK_OFFICE_DEPARTMENTS = [
  "it",
  "it department",
  "accounting",
  "accounting department",
  "hr",
  "hr department",
  "human resources",
  "human resources department",
  "audit",
  "audit department",
  "tread",
  "tread department",
  "office",
  "main office",
  "office of the president",
];

const isOperationDepartment = (department) =>
  OPERATION_DEPARTMENTS.includes(norm(department));

const isBackOfficeDepartment = (department) =>
  BACK_OFFICE_DEPARTMENTS.includes(norm(department));

const isFinalApprover = (req) =>
  isAdmin(req) || isHr(req) || isAccounting(req) || isTread(req) || isIT(req);

const isFullViewer = (req) =>
  isFinalApprover(req) ||
  isVicePresident(req) ||
  isSeniorVicePresident(req) ||
  isPresident(req);

const isRequestViewer = (req) =>
  isFinalApprover(req) ||
  isRegionalManager(req) ||
  isAssistantVicePresident(req) ||
  isVicePresident(req) ||
  isSeniorVicePresident(req) ||
  isPresident(req);

const canUploadApprovedLeave = (req) =>
  isAdmin(req) || isIT(req) || isHr(req) || isAccounting(req);

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
    s.department,

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

const getInitialStatusByDepartment = (req, department) => {
  /*
    OPERATION:
    Branch Manager -> Area Manager -> Regional Manager ->
    Assistant Vice President -> Vice President -> Pending Admin
  */
  if (isOperationDepartment(department)) {
    if (isBranchManager(req)) return "Pending Area Manager";
    if (isAreaManager(req)) return "Pending Regional Manager";
    if (isRegionalManager(req)) return "Pending Assistant Vice President";
    if (isAssistantVicePresident(req)) return "Pending Vice President";
    if (isVicePresident(req)) return "Pending Admin";
    return "Pending Branch Manager";
  }

  /*
    BACK OFFICE / MAIN OFFICE:
    IT Department -> Assistant Vice President
    Others -> Senior Vice President
  */

  const dept = norm(department);

  if (
    dept === "it" ||
    dept === "it department"
  ) {
    return "Pending Assistant Vice President";
  }

  return "Pending Senior Vice President";
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
      s.department
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
    return {
      ok: false,
      code: 400,
      message: `Leave already ${status.toLowerCase()}`,
    };
  }

  if (status === "Pending Branch Manager") {
    if (!isBranchManager(req) && !isFinalApprover(req) && !isPresident(req)) {
      return {
        ok: false,
        code: 403,
        message: "Only branch manager can act on this stage",
      };
    }

    return { ok: true, row };
  }

  if (status === "Pending Area Manager") {
    if (
      !isAreaManager(req) &&
      !isFinalApprover(req) &&
      !isSeniorVicePresident(req) &&
      !isPresident(req)
    ) {
      return {
        ok: false,
        code: 403,
        message: "Only area manager can act on this stage",
      };
    }

    if (isAreaManager(req) && norm(row.area) !== norm(getUserArea(req))) {
      return { ok: false, code: 403, message: "Access denied" };
    }

    return { ok: true, row };
  }

  if (status === "Pending Regional Manager") {
    if (
      !isRegionalManager(req) &&
      !isFinalApprover(req) &&
      !isSeniorVicePresident(req) &&
      !isPresident(req)
    ) {
      return {
        ok: false,
        code: 403,
        message: "Only regional manager can act on this stage",
      };
    }

    if (isRegionalManager(req) && norm(row.region) !== norm(getUserRegion(req))) {
      return { ok: false, code: 403, message: "Access denied" };
    }

    return { ok: true, row };
  }

  if (status === "Pending Assistant Vice President") {
    if (
      !isAssistantVicePresident(req) &&
      !isFinalApprover(req) &&
      !isSeniorVicePresident(req) &&
      !isPresident(req)
    ) {
      return {
        ok: false,
        code: 403,
        message: "Only assistant vice president can act on this stage",
      };
    }

    if (
      isAssistantVicePresident(req) &&
      norm(row.division) !== norm(getUserDivision(req))
    ) {
      return { ok: false, code: 403, message: "Access denied" };
    }

    return { ok: true, row };
  }

  if (status === "Pending Vice President") {
    if (
      !isVicePresident(req) &&
      !isFinalApprover(req) &&
      !isSeniorVicePresident(req) &&
      !isPresident(req)
    ) {
      return {
        ok: false,
        code: 403,
        message: "Only vice president can act on this stage",
      };
    }

    return { ok: true, row };
  }

  if (status === "Pending Senior Vice President") {
    if (!isSeniorVicePresident(req) && !isPresident(req) && !isFinalApprover(req)) {
      return {
        ok: false,
        code: 403,
        message: "Only senior vice president can act on this stage",
      };
    }

    const userDepartment = getUserDepartment(req);

    if (
      isSeniorVicePresident(req) &&
      userDepartment &&
      norm(userDepartment) !== norm(row.department)
    ) {
      return {
        ok: false,
        code: 403,
        message: "You can only approve leave requests for your department",
      };
    }

    return { ok: true, row };
  }

  if (status === "Pending Admin") {
    if (
      !isFinalApprover(req) &&
      !isVicePresident(req) &&
      !isSeniorVicePresident(req) &&
      !isPresident(req)
    ) {
      return {
        ok: false,
        code: 403,
        message: "Only admin/hr/accounting/tread or higher roles can act on this stage",
      };
    }

    return { ok: true, row };
  }

  return { ok: false, code: 400, message: "Unsupported leave status" };
};

router.get("/leave-requests", requireAuth, async (req, res) => {
  try {
    if (
      isFullViewer(req) ||
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
        WHERE LOWER(TRIM(COALESCE(s.area, ''))) =
              LOWER(TRIM($1))
        ORDER BY lr.entry_date DESC NULLS LAST, lr.id DESC
        `,
        [area]
      );

      return res.json(r.rows);
    }

    return res.status(403).json({
      message: "Access denied",
    });
  } catch (e) {
    console.error(
      "GET /api/leave-requests ERROR:",
      e.message
    );

    return res.status(500).json({
      message: e?.message || "Server error",
    });
  }
});

router.post(
  "/leave-requests",
  requireAuth,
  requirePermission("leave_request", "create"),
  upload.single("attachment"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const {
        employee_id,
        leave_type,
        date_created,
        start_date,
        end_date,
        reason,
      } = req.body;

      if (!employee_id) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message: "employee_id is required",
        });
      }

      const staffRes = await client.query(
        `
        SELECT
          id,
          fullname,
          department,
          first_name,
          middle_name,
          last_name
        FROM public.staff
        WHERE id = $1
        LIMIT 1
        `,
        [employee_id]
      );

      if (staffRes.rowCount === 0) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          message: "Staff not found",
        });
      }

      const staff = staffRes.rows[0];

      const staffName = buildStaffName(staff);

      const isIndefiniteLeave =
        leave_type === "Indefinite Leave";

      let total_no_of_days = 0;

      if (!isIndefiniteLeave) {
        total_no_of_days = diffDaysInclusive(
          start_date,
          end_date
        );
      }

      const seqRes = await client.query(`
        SELECT nextval('public.leave_requests_id_seq') AS n
      `);

      const leaveSeq = Number(seqRes.rows[0].n);

      const transaction_code = `LV-${String(
        leaveSeq
      ).padStart(7, "0")}`;

      const status = getInitialStatusByDepartment(
        req,
        staff.department
      );

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
          isIndefiniteLeave ? null : start_date,
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

      if (isIndefiniteLeave) {
        await client.query(
          `
          UPDATE public.staff
          SET status = 'Inactive'
          WHERE id = $1
          `,
          [employee_id]
        );
      }

      await client.query("COMMIT");

      const finalRow = await pool.query(
        `
        ${baseLeaveSelect}
        WHERE lr.id = $1
        `,
        [leaveId]
      );

      return res.json(finalRow.rows[0]);
    } catch (err) {
      await client.query("ROLLBACK");

      console.error(
        "CREATE LEAVE ERROR:",
        err.message
      );

      return res.status(500).json({
        message: err.message,
      });
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

      const leaveId = String(
        req.params.id || ""
      ).trim();

      if (!req.file) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message: "Attachment is required",
        });
      }

      if (!canUploadApprovedLeave(req)) {
        await client.query("ROLLBACK");

        return res.status(403).json({
          message: "Access denied",
        });
      }

      /*
        DELETE OLD APPROVED FILES
      */
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
          const rel = String(
            old.file_path || ""
          ).replace(/^\/uploads\//, "");

          const oldPath = path.join(
            __dirname,
            "..",
            "uploads",
            rel
          );

          if (fs.existsSync(oldPath)) {
            fs.unlinkSync(oldPath);
          }
        } catch (e) {
          console.error(
            "DELETE OLD FILE ERROR:",
            e.message
          );
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
          req.file.originalname || null,
          `/uploads/leave_attachments/${req.file.filename}`,
          req.file.mimetype || null,
          req.file.size || null,
          req.user?.id ?? null,
          roleLower(req),
        ]
      );

      await client.query("COMMIT");

      return res.json({
        message:
          "Approved leave file uploaded",
      });
    } catch (e) {
      await client.query("ROLLBACK");

      console.error(
        "UPLOAD APPROVED FILE ERROR:",
        e.message
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
  "/leave-requests/:id",
  requireAuth,
  requirePermission("leave_request", "approve"),
  async (req, res) => {
    try {
      const id = String(req.params.id || "").trim();

      const action = String(
        req.body?.action || ""
      ).trim();

      const access = await canActOnLeave(req, id);

      if (!access.ok) {
        return res.status(access.code).json({
          message: access.message,
        });
      }

      const currentStatus = toStr(
        access.row.status
      );

      if (action.toLowerCase() === "reject") {
        await pool.query(
          `
          UPDATE public.leave_requests
          SET
            status = 'Rejected',
            rejection_reason = $2
          WHERE id = $1
          `,
          [
            id,
            toStr(req.body?.rejection_reason),
          ]
        );
      } else {
        let sql = "";
        let params = [id, req.user?.id ?? null];

        if (
          currentStatus ===
          "Pending Branch Manager"
        ) {
          sql = `
            UPDATE public.leave_requests
            SET
              status = 'Pending Area Manager'
            WHERE id = $1
          `;
          params = [id];
        }

        else if (
          currentStatus ===
          "Pending Area Manager"
        ) {
          sql = `
            UPDATE public.leave_requests
            SET
              status = 'Pending Regional Manager',
              area_approved_by = $2,
              area_approved_at = NOW()
            WHERE id = $1
          `;
        }

        else if (
          currentStatus ===
          "Pending Regional Manager"
        ) {
          sql = `
            UPDATE public.leave_requests
            SET
              status = 'Pending Assistant Vice President',
              regional_approved_by = $2,
              regional_approved_at = NOW()
            WHERE id = $1
          `;
        }

        else if (
          currentStatus ===
          "Pending Assistant Vice President"
        ) {

          const dept = norm(access.row.department);

          /*
            IT Department:
            AVP is final approver
          */
          if (
            dept === "it" ||
            dept === "it department"
          ) {
            sql = `
              UPDATE public.leave_requests
              SET
                status = 'Approved',
                division_approved_by = $2,
                division_approved_at = NOW()
              WHERE id = $1
            `;
          }

          /*
            OPERATION:
            Continue to Vice President
          */
          else {
            sql = `
              UPDATE public.leave_requests
              SET
                status = 'Pending Vice President',
                division_approved_by = $2,
                division_approved_at = NOW()
              WHERE id = $1
            `;
          }
        }

        else if (
          currentStatus ===
          "Pending Vice President"
        ) {
          sql = `
            UPDATE public.leave_requests
            SET
              status = 'Pending Admin'
            WHERE id = $1
          `;
          params = [id];
        }

        else if (
          currentStatus ===
          "Pending Senior Vice President"
        ) {
          sql = `
            UPDATE public.leave_requests
            SET
              status = 'Approved'
            WHERE id = $1
          `;
          params = [id];
        }

        else if (
          currentStatus ===
          "Pending Admin"
        ) {
          sql = `
            UPDATE public.leave_requests
            SET
              status = 'Approved',
              admin_approved_by = $2,
              admin_approved_at = NOW()
            WHERE id = $1
          `;
        }

        else {
          return res.status(400).json({
            message:
              "Invalid current status for approval",
          });
        }

        await pool.query(sql, params);
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
      console.error(
        "PUT /api/leave-requests/:id ERROR:",
        e.message
      );

      return res.status(500).json({
        message: e?.message || "Server error",
      });
    }
  }
);

router.get(
  "/leave-requests/:id/download/:type",
  requireAuth,
  async (req, res) => {
    try {
      const leaveId = String(req.params.id || "").trim();

      const type = String(req.params.type || "")
        .trim()
        .toLowerCase();

      if (!["request", "approved"].includes(type)) {
        return res.status(400).json({
          message: "Invalid attachment type",
        });
      }

      const r = await pool.query(
        `
        SELECT
          file_name,
          file_path,
          file_mime
        FROM public.leave_attachments
        WHERE leave_request_id = $1
          AND attachment_type = $2
        ORDER BY id DESC
        LIMIT 1
        `,
        [leaveId, type]
      );

      if (r.rowCount === 0) {
        return res.status(404).json({
          message: "File not found",
        });
      }

      const row = r.rows[0];

      const rel = String(row.file_path || "").replace(
        /^\/uploads\//,
        ""
      );

      const absPath = path.join(
        __dirname,
        "..",
        "uploads",
        rel
      );

      if (!fs.existsSync(absPath)) {
        return res.status(404).json({
          message: "Physical file missing",
        });
      }

      return res.download(
        absPath,
        row.file_name || undefined
      );
    } catch (e) {
      console.error(
        "DOWNLOAD LEAVE FILE ERROR:",
        e.message
      );

      return res.status(500).json({
        message: e?.message || "Server error",
      });
    }
  }
);

module.exports = router;