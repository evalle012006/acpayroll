const express = require("express");
const router = express.Router();
const db = require("../db");

const { requireAuth } = require("../middlewares/authMiddleware");
const { requirePermission } = require("../middlewares/permissionMiddleware");

const {
  uploadToTemp,
  moveFromTemp,
  getSignedDownloadUrl,
} = require("../services/spacesUpload");

const clean = (v) => String(v ?? "").trim();
const norm = (v) => clean(v).toLowerCase();

const toNum = (v) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const getUserRole = (req) => norm(req.user?.role);

const isAdmin = (req) => getUserRole(req) === "admin";
const isIT = (req) => getUserRole(req) === "it";
const isHR = (req) => getUserRole(req) === "hr";
const isAccounting = (req) => getUserRole(req) === "accounting";
const isVicePresident = (req) => getUserRole(req) === "vice president";

const canPowerAction = (req) =>
  isAdmin(req) || isIT(req) || isHR(req) || isAccounting(req) || isSeniorVicePresident(req);

const canBypassApproval = canPowerAction;

const isOperationDepartment = (department) => {
  const dept = norm(department);
  return (
    dept === "operation department" ||
    dept === "operations department" ||
    dept === "operation" ||
    dept === "operations"
  );
};

const canFinalUpload = (req, department) => {
  if (
    isAdmin(req) ||
    isIT(req) ||
    isHR(req) ||
    isAccounting(req) ||
    isSeniorVicePresident(req)
  ) {
    return true;
  }

  if (isOperationDepartment(department)) {
    return isVicePresident(req);
  }

  return false;
};

const WAITING_FINAL_FILE = "Waiting Final File Upload";

const APPROVAL_CHAIN = [
  "Branch Manager",
  "Area Manager",
  "Regional Manager",
  "Assistant Vice President",
  "Vice President",
];

const getApprovalChainByApplicantRole = (applicantRole) => {
  const role = norm(applicantRole);

  if (role.includes("branch manager")) {
    return [
      "Area Manager",
      "Regional Manager",
      "Assistant Vice President",
      "Vice President",
    ];
  }

  if (role.includes("area manager")) {
    return ["Regional Manager", "Assistant Vice President", "Vice President"];
  }

  if (role.includes("regional manager")) {
    return ["Assistant Vice President", "Vice President"];
  }

  if (role.includes("assistant vice president")) {
    return ["Vice President"];
  }

  if (role.includes("vice president")) {
    return ["Vice President"];
  }

  return APPROVAL_CHAIN;
};

const initialStage = (applicantRole) => {
  const chain = getApprovalChainByApplicantRole(applicantRole);
  return chain[0] || "Vice President";
};

const nextStage = (stage, applicantRole) => {
  const chain = getApprovalChainByApplicantRole(applicantRole);
  const current = norm(stage);
  const index = chain.findIndex((x) => norm(x) === current);

  if (index < 0) return chain[0] || "Vice President";
  if (index >= chain.length - 1) return "Approved";

  return chain[index + 1];
};

const stageColumn = (stage) => {
  const s = norm(stage);

  if (s === "branch manager") return "branch_manager_status";
  if (s === "area manager") return "area_manager_status";
  if (s === "regional manager") return "regional_manager_status";
  if (s === "assistant vice president") return "avp_status";
  if (s === "vice president") return "vp_status";

  return null;
};

const canApproveCurrentStage = (req, stage) => {
  const role = getUserRole(req);
  const s = norm(stage);

  if (canBypassApproval(req)) return true;

  if (s === "branch manager") return role === "branch manager";
  if (s === "area manager") return role === "area manager";
  if (s === "regional manager") return role === "regional manager";
  if (s === "assistant vice president")
    return role === "assistant vice president";
  if (s === "vice president") return role === "vice president";

  return false;
};

const chainTextByApplicantRole = (role) =>
  getApprovalChainByApplicantRole(role).join(" → ");

async function getStaffById(employeeId, client = db) {
  const r = await client.query(
    `
    SELECT
      id,
      employee_no,
      department,
      position
    FROM public.staff
    WHERE id = $1
    LIMIT 1
    `,
    [employeeId]
  );

  return r.rows[0] || null;
}

async function finalizeCbuWithdrawal({
  client,
  row,
  staff,
  fileKey,
  fileName,
}) {
  const employeeNo = clean(staff.employee_no);
  const amount = toNum(row.amount);

  const balance = await client.query(
    `
    SELECT id, COALESCE(cbu, 0) AS cbu
    FROM public.staff_balances
    WHERE employee_no = $1
    FOR UPDATE
    `,
    [employeeNo]
  );

  if (balance.rowCount === 0) {
    return {
      errorStatus: 404,
      error: { message: "Balance not found" },
    };
  }

  const currentCbu = toNum(balance.rows[0].cbu);

  if (currentCbu < amount) {
    return {
      errorStatus: 400,
      error: {
        message: `Insufficient CBU balance. Current balance is ${currentCbu}.`,
      },
    };
  }

  await client.query(
    `
    UPDATE public.staff_balances
    SET cbu = COALESCE(cbu, 0) - $1::numeric,
        updated_at = NOW()
    WHERE employee_no = $2
    `,
    [amount, employeeNo]
  );

  const result = await client.query(
    `
    UPDATE public.cbu_withdrawals
    SET status = 'Approved',
        approval_stage = 'Approved',
        approved_at = NOW(),
        attachment_path = $1,
        attachment_name = $2,
        approved_attachment_path = $1,
        approved_attachment_name = $2,
        updated_at = NOW()
    WHERE id = $3
    RETURNING *
    `,
    [fileKey, fileName, row.id]
  );

  return { data: result.rows[0] };
}

router.get(
  "/cbu-withdrawals",
  requireAuth,
  requirePermission("cbu_withdrawal", "view"),
  async (_req, res) => {
    try {
      const result = await db.query(`
        SELECT
          cw.*,
          s.employee_no,
          s.department,
          s.position,
          s.area,
          s.region,
          s.division,
          s.position AS staff_role,
          COALESCE(
            NULLIF(TRIM(s.fullname), ''),
            CONCAT_WS(' ', s.first_name, s.middle_name, s.last_name),
            '-'
          ) AS fullname,
          b.code AS branch_code,
          b.name AS branch_name,
          COALESCE(sb.cbu, 0) AS cbu_balance
        FROM public.cbu_withdrawals cw
        LEFT JOIN public.staff s ON s.id = cw.employee_id
        LEFT JOIN public.branches b ON b.id = s.branch_id
        LEFT JOIN public.staff_balances sb ON sb.employee_no = s.employee_no
        ORDER BY cw.id DESC
      `);

      return res.json(result.rows);
    } catch (err) {
      console.error("GET CBU ERROR:", err.message);
      return res.status(500).json({ message: err.message });
    }
  }
);

router.post(
  "/cbu-withdrawals",
  requireAuth,
  requirePermission("cbu_withdrawal", "create"),
  uploadToTemp,
  async (req, res) => {
    try {
      const employeeId = toNum(req.body?.employee_id);
      const amount = toNum(req.body?.amount);
      const reason = clean(req.body?.reason);
      const disbursementDate = clean(req.body?.disbursement_date) || null;

      if (!employeeId) {
        return res.status(400).json({ message: "Employee is required" });
      }

      if (!amount || amount <= 0) {
        return res.status(400).json({ message: "Valid amount is required" });
      }

      if (!reason) {
        return res.status(400).json({ message: "Reason is required" });
      }

      if (!req.file?.key) {
        return res.status(400).json({ message: "Request file is required" });
      }

      const staff = await getStaffById(employeeId);

      if (!staff) {
        return res.status(404).json({ message: "Staff record not found" });
      }

      const employeeNo = clean(staff.employee_no);
      const applicantRole = clean(staff.position || req.user?.role);
      const startStage = initialStage(applicantRole);

      const balanceRes = await db.query(
        `
        SELECT COALESCE(cbu, 0) AS cbu
        FROM public.staff_balances
        WHERE employee_no = $1
        LIMIT 1
        `,
        [employeeNo]
      );

      if (balanceRes.rowCount === 0) {
        return res.status(404).json({ message: "Balance not found" });
      }

      if (toNum(balanceRes.rows[0].cbu) < amount) {
        return res.status(400).json({
          message: `Insufficient CBU balance. Current balance is ${balanceRes.rows[0].cbu}.`,
        });
      }

      const attachmentPath = await moveFromTemp(
        req.file.key,
        "cbu-withdrawals/latest",
        String(employeeId),
        req.file.originalname || "request-file"
      );

      const attachmentName = req.file.originalname || null;

      const result = await db.query(
        `
        INSERT INTO public.cbu_withdrawals (
          employee_id,
          amount,
          reason,
          status,
          approval_stage,
          disbursement_date,
          attachment_path,
          attachment_name,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, 'Pending', $4, $5, $6, $7, NOW(), NOW())
        RETURNING *
        `,
        [
          employeeId,
          amount,
          reason,
          startStage,
          disbursementDate,
          attachmentPath,
          attachmentName,
        ]
      );

      return res.status(201).json({
        ...result.rows[0],
        approval_chain: chainTextByApplicantRole(applicantRole),
      });
    } catch (err) {
      console.error("CREATE CBU ERROR:", err.message);
      return res.status(500).json({ message: err.message });
    }
  }
);

router.get(
  "/cbu-withdrawals/:id/download/:type",
  requireAuth,
  requirePermission("cbu_withdrawal", "view"),
  async (req, res) => {
    try {
      const id = toNum(req.params.id);
      const type = norm(req.params.type);

      if (!id) {
        return res.status(400).json({ message: "Invalid withdrawal id" });
      }

      if (!["request", "approved", "latest"].includes(type)) {
        return res.status(400).json({ message: "Invalid file type" });
      }

      const result = await db.query(
        `
        SELECT attachment_path, approved_attachment_path
        FROM public.cbu_withdrawals
        WHERE id = $1
        `,
        [id]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ message: "CBU withdrawal not found" });
      }

      const row = result.rows[0];

      let key = row.attachment_path;

      if (type === "approved" || type === "latest") {
        key = row.approved_attachment_path || row.attachment_path;
      }

      if (type === "request") {
        key = row.attachment_path;
      }

      if (!key) {
        return res.status(404).json({ message: "File not found" });
      }

      const url = await getSignedDownloadUrl(key);
      return res.json({ url });
    } catch (err) {
      console.error("DOWNLOAD CBU FILE ERROR:", err.message);
      return res.status(500).json({ message: err.message });
    }
  }
);

router.put(
  "/cbu-withdrawals/:id",
  requireAuth,
  requirePermission("cbu_withdrawal", "approve"),
  uploadToTemp,
  async (req, res) => {
    const client = await db.connect();

    try {
      const id = toNum(req.params.id);
      const rawStatus = clean(req.body?.status || req.body?.action);

      const status =
        norm(rawStatus) === "approved" || norm(rawStatus) === "approve"
          ? "Approved"
          : norm(rawStatus) === "rejected" || norm(rawStatus) === "reject"
          ? "Rejected"
          : norm(rawStatus) === "void"
          ? "Void"
          : rawStatus;

      const rejectionReason = clean(req.body?.rejection_reason);

      if (!id) {
        return res.status(400).json({ message: "Invalid withdrawal id" });
      }

      if (!["Approved", "Rejected", "Void"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }

      if (status === "Rejected" && !rejectionReason) {
        return res.status(400).json({ message: "Rejection reason is required" });
      }

      if (status === "Approved" && !req.file?.key) {
        return res.status(400).json({
          message:
            "Please upload the signed/approved CBU file before approving.",
        });
      }

      await client.query("BEGIN");

      const current = await client.query(
        `
        SELECT *
        FROM public.cbu_withdrawals
        WHERE id = $1
        FOR UPDATE
        `,
        [id]
      );

      if (current.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "CBU withdrawal not found" });
      }

      const row = current.rows[0];

      const staff = await getStaffById(row.employee_id, client);

      if (!staff) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Staff record not found" });
      }

      if (status === "Void") {
        if (!canPowerAction(req)) {
          await client.query("ROLLBACK");
          return res.status(403).json({
            message: "Only Admin, IT, HR, or Accounting can void CBU withdrawal.",
          });
        }

        if (norm(row.status) === "rejected") {
          await client.query("ROLLBACK");
          return res.status(400).json({
            message: "This withdrawal is already rejected.",
          });
        }

        if (norm(row.status) === "void") {
          await client.query("ROLLBACK");
          return res.status(400).json({
            message: "This withdrawal is already voided.",
          });
        }

        const wasFullyApproved =
          norm(row.status) === "approved" &&
          norm(row.approval_stage) === "approved";

        if (wasFullyApproved) {
          const employeeNo = clean(staff.employee_no);
          const amount = toNum(row.amount);

          await client.query(
            `
            UPDATE public.staff_balances
            SET cbu = COALESCE(cbu, 0) + $1::numeric,
                updated_at = NOW()
            WHERE employee_no = $2
            `,
            [amount, employeeNo]
          );
        }

        const updated = await client.query(
          `
          UPDATE public.cbu_withdrawals
          SET status = 'Void',
              approval_stage = 'Void',
              updated_at = NOW()
          WHERE id = $1
          RETURNING *
          `,
          [id]
        );

        await client.query("COMMIT");

        return res.json({
          message: wasFullyApproved
            ? "CBU withdrawal voided successfully. CBU amount has been returned."
            : "CBU withdrawal voided successfully.",
          data: updated.rows[0],
        });
      }

      if (norm(row.status) === "approved") {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: "This withdrawal is already approved",
        });
      }

      if (norm(row.status) === "rejected") {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: "This withdrawal is already rejected",
        });
      }

      if (norm(row.status) === "void") {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: "This withdrawal is already voided",
        });
      }

      if (norm(row.status) === norm(WAITING_FINAL_FILE)) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: isOperationDepartment(staff.department)
            ? "This withdrawal already passed chain approval. Vice President must upload final file."
            : "This withdrawal already passed chain approval. HR/Accounting/Admin/IT must upload final file.",
        });
      }

      const applicantRole = clean(staff.position || "");
      const currentStage = clean(row.approval_stage) || initialStage(applicantRole);
      const col = stageColumn(currentStage);

      if (!canApproveCurrentStage(req, currentStage)) {
        await client.query("ROLLBACK");
        return res.status(403).json({ message: "Not your approval stage" });
      }

      if (status === "Rejected") {
        if (col) {
          await client.query(
            `
            UPDATE public.cbu_withdrawals
            SET ${col} = 'Rejected',
                status = 'Rejected',
                rejection_reason = $1,
                rejected_at = NOW(),
                updated_at = NOW()
            WHERE id = $2
            `,
            [rejectionReason, id]
          );
        } else {
          await client.query(
            `
            UPDATE public.cbu_withdrawals
            SET status = 'Rejected',
                rejection_reason = $1,
                rejected_at = NOW(),
                updated_at = NOW()
            WHERE id = $2
            `,
            [rejectionReason, id]
          );
        }

        await client.query("COMMIT");
        return res.json({
          message: "CBU withdrawal rejected successfully",
        });
      }

      const latestFileKey = await moveFromTemp(
        req.file.key,
        "cbu-withdrawals/latest",
        String(id),
        req.file.originalname || "signed-cbu-file"
      );

      const latestFileName = req.file.originalname || null;
      const next = nextStage(currentStage, applicantRole);

      if (col) {
        await client.query(
          `
          UPDATE public.cbu_withdrawals
          SET ${col} = 'Approved',
              updated_at = NOW()
          WHERE id = $1
          `,
          [id]
        );
      }

      if (next !== "Approved") {
        const updated = await client.query(
          `
          UPDATE public.cbu_withdrawals
          SET status = 'Pending',
              approval_stage = $1,
              attachment_path = $2,
              attachment_name = $3,
              updated_at = NOW()
          WHERE id = $4
          RETURNING *
          `,
          [next, latestFileKey, latestFileName, id]
        );

        await client.query("COMMIT");

        return res.json({
          message: `CBU withdrawal approved and signed file uploaded. Next stage: ${next}`,
          data: updated.rows[0],
        });
      }

      if (isOperationDepartment(staff.department) && isVicePresident(req)) {
        const finalized = await finalizeCbuWithdrawal({
          client,
          row,
          staff,
          fileKey: latestFileKey,
          fileName: latestFileName,
        });

        if (finalized.error) {
          await client.query("ROLLBACK");
          return res.status(finalized.errorStatus).json(finalized.error);
        }

        await client.query("COMMIT");

        return res.json({
          message: "Vice President approved. CBU withdrawal fully approved.",
          data: finalized.data,
        });
      }

      const updated = await client.query(
        `
        UPDATE public.cbu_withdrawals
        SET status = $1,
            approval_stage = $1,
            attachment_path = $2,
            attachment_name = $3,
            updated_at = NOW()
        WHERE id = $4
        RETURNING *
        `,
        [WAITING_FINAL_FILE, latestFileKey, latestFileName, id]
      );

      await client.query("COMMIT");

      return res.json({
        message: isOperationDepartment(staff.department)
          ? "Chain approval completed. Waiting for Vice President final upload."
          : "Chain approval completed. Waiting for HR/Accounting/Admin/IT final upload.",
        data: updated.rows[0],
      });
    } catch (err) {
      await client.query("ROLLBACK");

      console.error("UPDATE CBU ERROR:", err.message);

      return res.status(500).json({
        message: err.message || "Failed to update CBU withdrawal",
      });
    } finally {
      client.release();
    }
  }
);

router.post(
  "/cbu-withdrawals/:id/approved-file",
  requireAuth,
  requirePermission("cbu_withdrawal", "upload_approved"),
  uploadToTemp,
  async (req, res) => {
    const client = await db.connect();

    try {
      const id = toNum(req.params.id);

      if (!id) {
        return res.status(400).json({ message: "Invalid withdrawal id" });
      }

      if (!req.file?.key) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      await client.query("BEGIN");

      const current = await client.query(
        `
        SELECT *
        FROM public.cbu_withdrawals
        WHERE id = $1
        FOR UPDATE
        `,
        [id]
      );

      if (current.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "CBU withdrawal not found" });
      }

      const row = current.rows[0];

      const staff = await getStaffById(row.employee_id, client);

      if (!staff) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Staff record not found" });
      }

      if (!canFinalUpload(req, staff.department)) {
        await client.query("ROLLBACK");
        return res.status(403).json({
          message: isOperationDepartment(staff.department)
            ? "Only Vice President can upload final file."
            : "Only HR, Accounting, Admin, or IT can upload final file.",
        });
      }

      if (
        norm(row.status) !== norm(WAITING_FINAL_FILE) &&
        !canBypassApproval(req)
      ) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message:
            "Final file can only be uploaded after chain approval is completed.",
        });
      }

      if (norm(row.status) === "approved") {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: "This withdrawal is already approved.",
        });
      }

      if (norm(row.status) === "rejected") {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: "This withdrawal is already rejected.",
        });
      }

      if (norm(row.status) === "void") {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: "This withdrawal is already voided.",
        });
      }

      const finalKey = await moveFromTemp(
        req.file.key,
        "cbu-withdrawals/approved",
        String(id),
        req.file.originalname || "approved-file"
      );

      const finalName = req.file.originalname || null;

      const finalized = await finalizeCbuWithdrawal({
        client,
        row,
        staff,
        fileKey: finalKey,
        fileName: finalName,
      });

      if (finalized.error) {
        await client.query("ROLLBACK");
        return res.status(finalized.errorStatus).json(finalized.error);
      }

      await client.query("COMMIT");

      return res.json({
        message: "Final approved file uploaded. CBU withdrawal fully approved.",
        data: finalized.data,
      });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("UPLOAD CBU APPROVED FILE ERROR:", err.message);
      return res.status(500).json({ message: err.message });
    } finally {
      client.release();
    }
  }
);

router.delete(
  "/cbu-withdrawals/:id",
  requireAuth,
  requirePermission("cbu_withdrawal", "delete"),
  async (req, res) => {
    try {
      const id = toNum(req.params.id);

      if (!id) {
        return res.status(400).json({ message: "Invalid withdrawal id" });
      }

      if (!canPowerAction(req)) {
        return res.status(403).json({
          message: "Only Admin, IT, HR, or Accounting can delete CBU withdrawal.",
        });
      }

      const check = await db.query(
        `
        SELECT status
        FROM public.cbu_withdrawals
        WHERE id = $1
        `,
        [id]
      );

      if (check.rowCount === 0) {
        return res.status(404).json({ message: "CBU withdrawal not found" });
      }

      if (norm(check.rows[0].status) === "approved") {
        return res.status(400).json({
          message: "Approved withdrawal cannot be deleted. Use void instead.",
        });
      }

      await db.query(
        `
        DELETE FROM public.cbu_withdrawals
        WHERE id = $1
        `,
        [id]
      );

      return res.json({ message: "CBU withdrawal deleted successfully." });
    } catch (err) {
      console.error("DELETE CBU ERROR:", err.message);
      return res.status(500).json({ message: err.message });
    }
  }
);

module.exports = router;