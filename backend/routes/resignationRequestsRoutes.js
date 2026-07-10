const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const router = express.Router();
const pool = require("../db");

const { requireAuth } = require("../middlewares/authMiddleware");
const { requirePermission } = require("../middlewares/permissionMiddleware");

const toInt = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

const toDate = (v) => {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
};

const clean = (v) => String(v ?? "").trim();
const norm = (v) => clean(v).toLowerCase();

const roleLower = (req) => norm(req.user?.role);
const departmentLower = (req) => norm(req.user?.department);

const isAdmin = (req) => ["admin", "it"].includes(roleLower(req));
const isIT = (req) => roleLower(req) === "it";
const isHr = (req) => roleLower(req) === "hr";
const isAccounting = (req) => roleLower(req) === "accounting";
const isTread = (req) => roleLower(req) === "tread";
const isBranchManager = (req) =>
  roleLower(req) === "branch manager";

const isAreaManager = (req) =>
  roleLower(req) === "area manager";

const isRegionalManager = (req) =>
  roleLower(req) === "regional manager";

const isAssistantVicePresident = (req) =>
  roleLower(req) === "assistant vice president";

const isVicePresident = (req) =>
  roleLower(req) === "vice president";

const isSeniorVicePresident = (req) =>
  roleLower(req) === "senior vice president";

const isHRDepartment = (req) =>
  departmentLower(req) === "hr department";

const isAccountingDepartment = (req) =>
  departmentLower(req) === "accounting department";

const isHRorAccountingManager = (req) =>
  (isHRDepartment(req) || isAccountingDepartment(req)) &&
  (
    isBranchManager(req) ||
    isAreaManager(req) ||
    isRegionalManager(req) ||
    isAssistantVicePresident(req) ||
    isVicePresident(req) ||
    isSeniorVicePresident(req)
  );
const isPresident = (req) => roleLower(req) === "president";

const isFinalApprover = (req) =>
  isAdmin(req) ||
  isIT(req) ||
  isHr(req) ||
  isAccounting(req) ||
  isSeniorVicePresident(req) ||
  isHRorAccountingManager(req);

const getUserBranchId = (req) => req.user?.branch_id ?? null;
const getUserArea = (req) => clean(req.user?.area);
const getUserRegion = (req) => clean(req.user?.region);

const matchBranch = (userBranchId, rowBranchId, rowBranchCode) => {
  if (!userBranchId) return false;

  return (
    String(userBranchId) === String(rowBranchId) ||
    norm(userBranchId) === norm(rowBranchCode)
  );
};

const STATUS_BRANCH = "Pending Branch Manager";
const STATUS_AREA = "Pending Area Manager";
const STATUS_RM = "Pending Regional Manager";
const STATUS_AVP = "Pending Assistant Vice President";
const STATUS_VP = "Pending Vice President";
const STATUS_SVP = "Pending Senior Vice President";
const STATUS_ADMIN = "Pending Admin";
const STATUS_APPROVED = "Approved";
const STATUS_REJECTED = "Rejected";

const uploadDir = path.join(process.cwd(), "uploads", "resignation-requests");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    const base = path
      .basename(file.originalname || "file", ext)
      .replace(/[^a-zA-Z0-9_-]/g, "_");

    cb(null, `${Date.now()}-${base}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
});

const isAuditDepartment = (staff) =>
  norm(staff?.department) === "audit department";

const determineInitialStatus = (req, staff) => {
  const staffPosition = norm(staff?.position)
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (isAuditDepartment(staff)) return STATUS_SVP;

  if (
    isAreaManager(req) &&
    staffPosition.includes("branch") &&
    staffPosition.includes("manager")
  ) {
    return STATUS_BRANCH;
  }

  if (staffPosition.includes("area manager")) return STATUS_RM;
  if (staffPosition.includes("regional manager")) return STATUS_AVP;
  if (staffPosition.includes("assistant vice president")) return STATUS_VP;
  if (staffPosition.includes("vice president")) return STATUS_ADMIN;

  if (isBranchManager(req)) return STATUS_AREA;
  if (isAreaManager(req)) return STATUS_AREA;
  if (isRegionalManager(req)) return STATUS_AVP;
  if (isAssistantVicePresident(req)) return STATUS_VP;
  if (isVicePresident(req)) return STATUS_ADMIN;
  if (isFinalApprover(req) || isTread(req)) return STATUS_ADMIN;

  return STATUS_AREA;
};

const canActOnCurrentStage = (req, row) => {
  const status = clean(row.status);

  if (isFinalApprover(req)) {
    return status !== STATUS_APPROVED && status !== STATUS_REJECTED;
  }

  if (isBranchManager(req)) {
    return (
      status === STATUS_BRANCH &&
      matchBranch(getUserBranchId(req), row.branch_id, row.branch_code)
    );
  }

  if (isAreaManager(req)) {
    return status === STATUS_AREA && norm(getUserArea(req)) === norm(row.area);
  }

  if (isRegionalManager(req)) {
    return (
      status === STATUS_RM && norm(getUserRegion(req)) === norm(row.region)
    );
  }

  if (isAssistantVicePresident(req)) return status === STATUS_AVP;
  if (isVicePresident(req)) return status === STATUS_VP;
  if (isSeniorVicePresident(req)) return status === STATUS_SVP;

  return false;
};

router.get(
  "/resignation-requests",
  requireAuth,
  requirePermission("resignation_request", "view"),
  async (req, res) => {
    try {
      const params = [];

      let sql = `
        SELECT rr.*
        FROM public.resignation_requests rr
        LEFT JOIN public.staff s
          ON s.id = rr.staff_id
          OR s.employee_no = rr.employee_no
        WHERE 1=1
      `;

      if (
        isAdmin(req) ||
        isIT(req) ||
        isHr(req) ||
        isAccounting(req) ||
        isTread(req) ||
        isVicePresident(req) ||
        isSeniorVicePresident(req) ||
        isPresident(req) ||
        isHRDepartment(req)
      ) {
        // Full access
      } else if (isBranchManager(req)) {
        const branchId = getUserBranchId(req);
        if (!branchId) return res.json([]);

        params.push(String(branchId));

        sql += `
          AND (
            CAST(COALESCE(s.branch_id, rr.branch_id) AS TEXT) = $${params.length}
            OR LOWER(TRIM(COALESCE(rr.branch_code, ''))) =
               LOWER(TRIM($${params.length}))
          )
        `;
      } else if (isAreaManager(req)) {
        const area = getUserArea(req);
        if (!area) return res.json([]);

        params.push(area);

        sql += `
          AND LOWER(TRIM(COALESCE(s.area, rr.area, ''))) =
              LOWER(TRIM($${params.length}))
        `;
      } else if (isRegionalManager(req)) {
        const region = getUserRegion(req);
        if (!region) return res.json([]);

        params.push(region);

        sql += `
          AND LOWER(TRIM(COALESCE(s.region, rr.region, ''))) =
              LOWER(TRIM($${params.length}))
        `;
      } else if (isAssistantVicePresident(req)) {
        const division = clean(req.user?.division);

        if (division) {
          params.push(division);

          sql += `
            AND LOWER(TRIM(COALESCE(s.division, ''))) =
                LOWER(TRIM($${params.length}))
          `;
        } else {
          sql += `
            AND status IN (
              '${STATUS_AVP}',
              '${STATUS_VP}',
              '${STATUS_ADMIN}',
              '${STATUS_APPROVED}',
              '${STATUS_REJECTED}'
            )
          `;
        }
      } else {
        return res.status(403).json({ message: "Access denied" });
      }

      sql += ` ORDER BY rr.id DESC`;

      const r = await pool.query(sql, params);
      return res.json(r.rows);
    } catch (e) {
      console.error("GET /resignation-requests ERROR:", e);
      return res.status(500).json({ message: e?.message || "Server error" });
    }
  }
);

router.post(
  "/resignation-requests",
  requireAuth,
  requirePermission("resignation_request", "create"),
  upload.single("attachment"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const staff_id = toInt(req.body?.staff_id);
      const employee_no = clean(req.body?.employee_no);
      const employee_name = clean(req.body?.employee_name);
      const last_name = clean(req.body?.last_name);
      const first_name = clean(req.body?.first_name);
      const middle_name = clean(req.body?.middle_name);
      const branch_id = toInt(req.body?.branch_id);
      const branch_code = clean(req.body?.branch_code);
      const branch_name = clean(req.body?.branch_name);
      const resignation_date = toDate(req.body?.resignation_date);
      const effective_date = toDate(req.body?.effective_date);
      const remarks = clean(req.body?.remarks);

      const attachment_path = req.file
        ? `/uploads/resignation-requests/${req.file.filename}`
        : null;

      if (!staff_id) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Staff is required" });
      }

      if (!effective_date) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Effective date is required" });
      }

      const staffRes = await client.query(
        `
        SELECT
          id,
          employee_no,
          fullname,
          last_name,
          first_name,
          middle_name,
          branch_id,
          status,
          area,
          region,
          position,
          department
        FROM public.staff
        WHERE id = $1
        FOR UPDATE
        `,
        [staff_id]
      );

      if (staffRes.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Staff not found" });
      }

      const staff = staffRes.rows[0];

      if (norm(staff.status || "Active") !== "active") {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: "Only active staff can file resignation request",
        });
      }

      if (isBranchManager(req)) {
        const userBranchId = getUserBranchId(req);

        if (!matchBranch(userBranchId, staff.branch_id, branch_code)) {
          await client.query("ROLLBACK");
          return res.status(403).json({
            message: "You can only create resignation requests for your branch",
          });
        }
      }

      if (isAreaManager(req)) {
        const userArea = getUserArea(req);

        if (!userArea || norm(userArea) !== norm(staff.area)) {
          await client.query("ROLLBACK");
          return res.status(403).json({
            message: "You can only create resignation requests for your area",
          });
        }
      }

      if (isRegionalManager(req)) {
        const userRegion = getUserRegion(req);

        if (!userRegion || norm(userRegion) !== norm(staff.region)) {
          await client.query("ROLLBACK");
          return res.status(403).json({
            message: "You can only create resignation requests for your region",
          });
        }
      }

      const duplicateCheck = await client.query(
        `
        SELECT 1
        FROM public.resignation_requests
        WHERE employee_no = $1
          AND status IN ($2,$3,$4,$5,$6,$7,$8)
        LIMIT 1
        `,
        [
          clean(staff.employee_no),
          STATUS_BRANCH,
          STATUS_AREA,
          STATUS_RM,
          STATUS_AVP,
          STATUS_VP,
          STATUS_SVP,
          STATUS_ADMIN,
        ]
      );

      if (duplicateCheck.rowCount > 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message:
            "A pending resignation request already exists for this employee",
        });
      }

      let finalBranchCode = branch_code;
      let finalBranchName = branch_name;

      if (branch_id) {
        const b = await client.query(
          `
          SELECT code, name
          FROM public.branches
          WHERE id = $1
          `,
          [branch_id]
        );

        if (b.rowCount > 0) {
          finalBranchCode = clean(b.rows[0].code);
          finalBranchName = clean(b.rows[0].name);
        }
      }

      const seq = await client.query(
        `SELECT nextval('public.resignation_requests_id_seq') AS n`
      );

      const n = Number(seq.rows[0].n);
      const request_no = `RES-${String(n).padStart(8, "0")}`;
      const initialStatus = determineInitialStatus(req, staff);

      const ins = await client.query(
        `
        INSERT INTO public.resignation_requests
        (
          id,
          request_no,
          staff_id,
          employee_no,
          employee_name,
          last_name,
          first_name,
          middle_name,
          branch_id,
          branch_code,
          branch_name,
          area,
          region,
          resignation_date,
          effective_date,
          remarks,
          attachment_path,
          status,
          created_by
        )
        VALUES
        (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
          $11,$12,$13,$14::date,$15::date,$16,$17,$18,$19
        )
        RETURNING *;
        `,
        [
          n,
          request_no,
          staff_id,
          employee_no || clean(staff.employee_no),
          employee_name || clean(staff.fullname),
          last_name || clean(staff.last_name),
          first_name || clean(staff.first_name),
          middle_name || clean(staff.middle_name),
          branch_id || staff.branch_id || null,
          finalBranchCode || null,
          finalBranchName || null,
          clean(staff.area) || null,
          clean(staff.region) || null,
          resignation_date || effective_date,
          effective_date,
          remarks || null,
          attachment_path,
          initialStatus,
          req.user?.id ?? null,
        ]
      );

      await client.query("COMMIT");
      return res.json(ins.rows[0]);
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("POST /resignation-requests ERROR:", e);
      return res.status(500).json({ message: e?.message || "Server error" });
    } finally {
      client.release();
    }
  }
);

router.put(
  "/resignation-requests/:id/upload",
  requireAuth,
  requirePermission("resignation_request", "approve"),
  upload.single("attachment"),
  async (req, res) => {
    try {
      const id = toInt(req.params.id);

      if (!id) return res.status(400).json({ message: "Invalid id" });

      if (!req.file) {
        return res.status(400).json({ message: "Attachment file is required" });
      }

      const requestRes = await pool.query(
        `
        SELECT *
        FROM public.resignation_requests
        WHERE id = $1
        `,
        [id]
      );

      if (requestRes.rowCount === 0) {
        return res.status(404).json({ message: "Resignation request not found" });
      }

      const row = requestRes.rows[0];

      if (!canActOnCurrentStage(req, row)) {
        return res.status(403).json({
          message: "You cannot upload file for this current approval stage",
        });
      }

      const attachmentPath = `/uploads/resignation-requests/${req.file.filename}`;

      const r = await pool.query(
        `
        UPDATE public.resignation_requests
        SET
          attachment_path = $2,
          approved_attachment_name = $3,
          approved_attachment_mime = $4
        WHERE id = $1
        RETURNING *;
        `,
        [id, attachmentPath, req.file.originalname || null, req.file.mimetype || null]
      );

      return res.json(r.rows[0]);
    } catch (e) {
      console.error("PUT /resignation-requests/:id/upload ERROR:", e);
      return res.status(500).json({ message: e?.message || "Server error" });
    }
  }
);

router.put(
  "/resignation-requests/:id/approve",
  requireAuth,
  requirePermission("resignation_request", "approve"),
  upload.single("attachment"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const id = toInt(req.params.id);

      if (!id) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Invalid id" });
      }

      const requestRes = await client.query(
        `
        SELECT *
        FROM public.resignation_requests
        WHERE id = $1
        FOR UPDATE
        `,
        [id]
      );

      if (requestRes.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Resignation request not found" });
      }

      const existing = requestRes.rows[0];
      const currentStatus = clean(existing.status);

      if (currentStatus === STATUS_APPROVED || currentStatus === STATUS_REJECTED) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: "This request is already completed",
        });
      }

      const uploadedAttachmentPath = req.file
        ? `/uploads/resignation-requests/${req.file.filename}`
        : null;

      const bypass =
        req.body?.bypass === true ||
        req.body?.bypass === "true";

      if (isFinalApprover(req) && !bypass) {
        const finalAttachmentPath =
          uploadedAttachmentPath || existing.attachment_path || null;

        if (!finalAttachmentPath) {
          await client.query("ROLLBACK");
          return res.status(400).json({
            message: "Final approved file is required before approval",
          });
        }

        const employeeNo = clean(existing.employee_no);
        const effectiveDate = toDate(existing.effective_date);
        const remarks = clean(existing.remarks) || null;

        const isReapplyRequest = Boolean(existing.revoke_effective_date);

        const finalEffectiveDate = isReapplyRequest
          ? toDate(existing.revoke_effective_date)
          : effectiveDate;

        const finalRemarks = isReapplyRequest
          ? clean(existing.revoke_remarks) || remarks
          : remarks;

        if (!employeeNo) {
          await client.query("ROLLBACK");
          return res.status(400).json({ message: "Request has no employee number" });
        }

        if (!effectiveDate) {
          await client.query("ROLLBACK");
          return res.status(400).json({
            message: "Request has invalid effective date",
          });
        }

        const staffRes = await client.query(
          `
          SELECT id, employee_no
          FROM public.staff
          WHERE employee_no = $1
          FOR UPDATE
          `,
          [employeeNo]
        );

        if (staffRes.rowCount === 0) {
          await client.query("ROLLBACK");
          return res.status(404).json({
            message: "Staff record not found for this employee number",
          });
        }

        const updateRequest = await client.query(
          `
          UPDATE public.resignation_requests
          SET
            status = $2,
            approved_by = $3,
            approved_at = NOW(),
            rejected_by = NULL,
            rejected_at = NULL,
            rejection_reason = NULL,
            attachment_path = $4,
            approved_attachment_path = $4,
            approved_attachment_name = $5,
            approved_attachment_mime = $6
          WHERE id = $1
          RETURNING *;
          `,
          [
            id,
            STATUS_APPROVED,
            req.user?.id ?? null,
            finalAttachmentPath,
            req.file?.originalname || existing.approved_attachment_name || null,
            req.file?.mimetype || existing.approved_attachment_mime || null,
          ]
        );

        if (isReapplyRequest) {
          await client.query(
            `
            UPDATE public.staff
            SET
              status = 'Active',
              branch_id = $2,
              area = $3,
              region = $4,
              division = $5,
              position = $6,
              department = $7,
              exit_type = NULL,
              exit_date = NULL,
              exit_remarks = NULL
            WHERE employee_no = $1
            `,
            [
              employeeNo,
              existing.revoke_branch_id,
              existing.revoke_area,
              existing.revoke_region,
              existing.revoke_division,
              existing.revoke_position,
              existing.revoke_department,
            ]
          );
        } else {
          await client.query(
            `
            UPDATE public.staff
            SET
              status = 'Inactive',
              exit_type = 'Resigned',
              exit_date = $2::date,
              exit_remarks = $3
            WHERE employee_no = $1
            `,
            [employeeNo, effectiveDate, remarks]
          );
        }

        try {
          await client.query(
            `
            INSERT INTO public.status_history
              (employee_no, effective_date, status, reason, remarks)
            VALUES
              ($1, $2::date, 'Inactive', 'Resigned', $3)
            ON CONFLICT DO NOTHING
            `,
            [
              employeeNo,
              finalEffectiveDate,
              isReapplyRequest ? "Re-applied / resignation revoked" : finalRemarks,
            ]
          );
        } catch (historyErr) {
          console.warn("status_history insert skipped:", historyErr.message);
        }

        await client.query("COMMIT");
        return res.json(updateRequest.rows[0]);
      }

      if (bypass) {

      if (!isAdmin(req) && !isIT(req)) {
        await client.query("ROLLBACK");
        return res.status(403).json({
          message: "Only Admin and IT can bypass approval."
        });
      }
        let nextStatus = null;

        switch (currentStatus) {
          case STATUS_BRANCH:
            nextStatus = STATUS_AREA;
            break;

          case STATUS_AREA:
            nextStatus = STATUS_RM;
            break;

          case STATUS_RM:
            nextStatus = STATUS_AVP;
            break;

          case STATUS_AVP:
            nextStatus = STATUS_VP;
            break;

          case STATUS_VP:
            nextStatus = STATUS_ADMIN;
            break;

          case STATUS_SVP:
            nextStatus = STATUS_ADMIN;
            break;

          case STATUS_ADMIN:
            return res.status(400).json({
              message: "Admin is already the last approval stage.",
            });

          default:
            return res.status(400).json({
              message: "Cannot bypass this stage.",
            });
        }

        const updated = await client.query(
          `
          UPDATE resignation_requests
          SET
            status = $2,
            approved_by = $3,
            approved_at = NOW()
          WHERE id = $1
          RETURNING *;
          `,
          [
            id,
            nextStatus,
            req.user?.id ?? null
          ]
        );

        await client.query("COMMIT");
        return res.json(updated.rows[0]);
      }

      let nextStatus = null;
      let approverField = null;
      let approverAtField = null;

      if (isBranchManager(req)) {
        if (currentStatus !== STATUS_BRANCH) {
          await client.query("ROLLBACK");
          return res.status(400).json({
            message: "This request is not pending Branch Manager approval",
          });
        }

        const userBranchId = getUserBranchId(req);

        if (!matchBranch(userBranchId, existing.branch_id, existing.branch_code)) {
          await client.query("ROLLBACK");
          return res.status(403).json({
            message:
              "You can only approve resignation requests within your branch",
          });
        }

        nextStatus = STATUS_AREA;
        approverField = "branch_manager_approved_by";
        approverAtField = "branch_manager_approved_at";
      } else if (isAreaManager(req)) {
        if (currentStatus !== STATUS_AREA) {
          await client.query("ROLLBACK");
          return res.status(400).json({
            message: "This request is not pending Area Manager approval",
          });
        }

        const userArea = getUserArea(req);

        if (!userArea || norm(userArea) !== norm(existing.area)) {
          await client.query("ROLLBACK");
          return res.status(403).json({
            message: "You can only approve resignation requests within your area",
          });
        }

        nextStatus = STATUS_RM;
        approverField = "area_manager_approved_by";
        approverAtField = "area_manager_approved_at";
      } else if (isRegionalManager(req)) {
        if (currentStatus !== STATUS_RM) {
          await client.query("ROLLBACK");
          return res.status(400).json({
            message: "This request is not pending Regional Manager approval",
          });
        }

        const userRegion = getUserRegion(req);

        if (!userRegion || norm(userRegion) !== norm(existing.region)) {
          await client.query("ROLLBACK");
          return res.status(403).json({
            message:
              "You can only approve resignation requests within your region",
          });
        }

        nextStatus = STATUS_AVP;
        approverField = "regional_manager_approved_by";
        approverAtField = "regional_manager_approved_at";
      } else if (isAssistantVicePresident(req)) {
        if (currentStatus !== STATUS_AVP) {
          await client.query("ROLLBACK");
          return res.status(400).json({
            message:
              "This request is not pending Assistant Vice President approval",
          });
        }

        nextStatus = STATUS_VP;
        approverField = "avp_approved_by";
        approverAtField = "avp_approved_at";
      } else if (isVicePresident(req)) {
        if (currentStatus !== STATUS_VP) {
          await client.query("ROLLBACK");
          return res.status(400).json({
            message: "This request is not pending Vice President approval",
          });
        }

        nextStatus = STATUS_ADMIN;
        approverField = "vp_approved_by";
        approverAtField = "vp_approved_at";
      } else if (isSeniorVicePresident(req)) {
        if (currentStatus !== STATUS_SVP) {
          await client.query("ROLLBACK");
          return res.status(400).json({
            message:
              "This request is not pending Senior Vice President approval",
          });
        }

        nextStatus = STATUS_ADMIN;
        approverField = "svp_approved_by";
        approverAtField = "svp_approved_at";
      } else {
        await client.query("ROLLBACK");
        return res.status(403).json({ message: "Access denied" });
      }

      if (!approverField || !approverAtField) {
        await client.query("ROLLBACK");
        return res.status(500).json({
          message: "Approver fields not configured",
        });
      }

      const updateRes = await client.query(
        `
        UPDATE public.resignation_requests
        SET
          status = $2,
          ${approverField} = $3,
          ${approverAtField} = NOW(),
          rejected_by = NULL,
          rejected_at = NULL,
          rejection_reason = NULL,
          attachment_path = COALESCE($4, attachment_path),
          approved_attachment_name = COALESCE($5, approved_attachment_name),
          approved_attachment_mime = COALESCE($6, approved_attachment_mime)
        WHERE id = $1
        RETURNING *;
        `,
        [
          id,
          nextStatus,
          req.user?.id ?? null,
          uploadedAttachmentPath,
          req.file?.originalname || null,
          req.file?.mimetype || null,
        ]
      );

      await client.query("COMMIT");
      return res.json(updateRes.rows[0]);
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("PUT /resignation-requests/:id/approve ERROR:", e);
      return res.status(500).json({ message: e?.message || "Server error" });
    } finally {
      client.release();
    }
  }
);

router.put(
  "/resignation-requests/:id/reject",
  requireAuth,
  requirePermission("resignation_request", "reject"),
  async (req, res) => {
    try {
      const id = toInt(req.params.id);
      const reason = clean(req.body?.reason);

      if (!id) return res.status(400).json({ message: "Invalid id" });

      if (!reason) {
        return res.status(400).json({ message: "Rejection reason required" });
      }

      const requestRes = await pool.query(
        `
        SELECT *
        FROM public.resignation_requests
        WHERE id = $1
        `,
        [id]
      );

      if (requestRes.rowCount === 0) {
        return res.status(404).json({ message: "Request not found" });
      }

      const existing = requestRes.rows[0];

      if (!canActOnCurrentStage(req, existing)) {
        return res.status(403).json({
          message: "You cannot reject this current approval stage",
        });
      }

      const r = await pool.query(
        `
        UPDATE public.resignation_requests
        SET
          status = $2,
          rejected_by = $3,
          rejected_at = NOW(),
          rejection_reason = $4,
          approved_by = NULL,
          approved_at = NULL
        WHERE id = $1
        RETURNING *;
        `,
        [id, STATUS_REJECTED, req.user?.id ?? null, reason]
      );

      return res.json(r.rows[0]);
    } catch (e) {
      console.error("PUT /resignation-requests/:id/reject ERROR:", e);
      return res.status(500).json({ message: e?.message || "Server error" });
    }
  }
);

router.put(
  "/resignation-requests/:id/revoke",
  requireAuth,
  requirePermission("resignation_request", "approve"),
  upload.single("attachment"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const id = toInt(req.params.id);

      if (!id) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Invalid id" });
      }

      if (!isFinalApprover(req)) {
        await client.query("ROLLBACK");
        return res.status(403).json({
          message: "Only Admin, IT, HR, or Accounting can revoke approved resignation",
        });
      }

      const effective_date = toDate(req.body?.effective_date);
      const branch_id = toInt(req.body?.branch_id);
      const position = clean(req.body?.position);
      
      const department = clean(req.body?.department);
      
        if (!department) {
          await client.query("ROLLBACK");
          return res.status(400).json({
            message: "Department is required",
          });
        }

      const remarks = clean(req.body?.remarks);

      if (!effective_date) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Effective date is required" });
      }

      if (!branch_id) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Resume branch is required" });
      }

      if (!position) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "New position is required" });
      }

      if (!req.file) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Revoke/re-apply file is required" });
      }

      const requestRes = await client.query(
        `
        SELECT *
        FROM public.resignation_requests
        WHERE id = $1
        FOR UPDATE
        `,
        [id]
      );

      if (requestRes.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Request not found" });
      }

      const existing = requestRes.rows[0];

      if (clean(existing.status) !== STATUS_APPROVED) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: "Only approved resignation requests can be revoked/re-applied",
        });
      }

      const employeeNo = clean(existing.employee_no);

      if (!employeeNo) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Request has no employee number" });
      }

      const branchRes = await client.query(
        `
        SELECT id, code, name, area, region, division
        FROM public.branches
        WHERE id = $1
        LIMIT 1
        `,
        [branch_id]
      );

      if (branchRes.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Resume branch not found" });
      }

      const branch = branchRes.rows[0];

      const attachmentPath = `/uploads/resignation-requests/${req.file.filename}`;

      const updated = await client.query(
        `
        UPDATE public.resignation_requests
        SET
          status = $2,

          revoke_effective_date = $3::date,
          revoke_branch_id = $4,
          revoke_branch_code = $5,
          revoke_branch_name = $6,
          revoke_area = $7,
          revoke_region = $8,
          revoke_division = $9,
          revoke_position = $10,
          revoke_department = $11,
          revoke_remarks = $12,
          revoke_attachment_path = $13,
          revoke_attachment_name = $14,
          revoke_attachment_mime = $15,
          revoke_requested_by = $16,
          revoke_requested_at = NOW(),

          approved_by = NULL,
          approved_at = NULL,
          rejected_by = NULL,
          rejected_at = NULL,
          rejection_reason = NULL,

          attachment_path = $13,
          approved_attachment_path = NULL,
          approved_attachment_name = NULL,
          approved_attachment_mime = NULL
        WHERE id = $1
        RETURNING *;
        `,
        [
          id,
          STATUS_ADMIN,
          effective_date,
          branch.id,
          clean(branch.code) || null,
          clean(branch.name) || null,
          clean(branch.area) || null,
          clean(branch.region) || null,
          clean(branch.division) || null,
          position,
          department,
          remarks || null,
          attachmentPath,
          req.file.originalname || null,
          req.file.mimetype || null,
          req.user?.id ?? null,
        ]
      );

      await client.query("COMMIT");

      return res.json({
        message: "Re-apply request submitted for approval.",
        request: updated.rows[0],
      });
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("PUT /resignation-requests/:id/revoke ERROR:", e);
      return res.status(500).json({ message: e?.message || "Server error" });
    } finally {
      client.release();
    }
  }
);

router.delete(
  "/resignation-requests/:id",
  requireAuth,
  requirePermission("resignation_request", "delete"),
  async (req, res) => {
    try {
      const id = toInt(req.params.id);

      if (!id) return res.status(400).json({ message: "Invalid id" });

      if (!isFinalApprover(req)) {
        return res.status(403).json({
          message:
            "Only Admin, IT, HR, or Accounting can delete resignation requests",
        });
      }

      const check = await pool.query(
        `
        SELECT status, attachment_path
        FROM public.resignation_requests
        WHERE id = $1
        `,
        [id]
      );

      if (check.rowCount === 0) {
        return res.status(404).json({ message: "Request not found" });
      }

      const row = check.rows[0];

      if (norm(row.status) === norm(STATUS_APPROVED)) {
        return res.status(400).json({
          message: "Approved requests cannot be deleted. Use revoke instead.",
        });
      }

      const attachmentPath = row.attachment_path;

      await pool.query(
        `
        DELETE FROM public.resignation_requests
        WHERE id = $1
        `,
        [id]
      );

      if (attachmentPath) {
        const absolutePath = path.join(
          process.cwd(),
          attachmentPath.replace(/^\/+/, "")
        );

        fs.unlink(absolutePath, () => {});
      }

      return res.json({ message: "Deleted" });
    } catch (e) {
      console.error("DELETE /resignation-requests/:id ERROR:", e);
      return res.status(500).json({ message: e?.message || "Server error" });
    }
  }
);

module.exports = router;