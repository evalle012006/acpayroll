const express = require("express");
const router = express.Router();
const db = require("../db");
const { requireAuth } = require("../middlewares/authMiddleware");

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
const canBypassApproval = (req) => ["admin", "it"].includes(getUserRole(req));

const APPROVAL_CHAIN = [
  "Branch Manager",
  "Area Manager",
  "Regional Manager",
  "Assistant Vice President",
  "Vice President",
];

const initialStage = () => "Branch Manager";

const nextStage = (stage) => {
  const current = norm(stage);
  const index = APPROVAL_CHAIN.findIndex((x) => norm(x) === current);

  if (index < 0) return APPROVAL_CHAIN[0];
  if (index >= APPROVAL_CHAIN.length - 1) return "Approved";

  return APPROVAL_CHAIN[index + 1];
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
  if (s === "assistant vice president") return role === "assistant vice president";
  if (s === "vice president") return role === "vice president";

  return false;
};

/* GET ALL */
router.get("/cbu-withdrawals", requireAuth, async (_req, res) => {
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
});

/* CREATE */
router.post("/cbu-withdrawals", requireAuth, uploadToTemp, async (req, res) => {
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

    const staffRes = await db.query(
      `
      SELECT id, employee_no, department, position
      FROM public.staff
      WHERE id = $1
      LIMIT 1
      `,
      [employeeId]
    );

    if (staffRes.rowCount === 0) {
      return res.status(404).json({ message: "Staff record not found" });
    }

    const staff = staffRes.rows[0];
    const employeeNo = clean(staff.employee_no);

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
    const startStage = initialStage();

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

    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("CREATE CBU ERROR:", err.message);
    return res.status(500).json({ message: err.message });
  }
});

/* DOWNLOAD LATEST / REQUEST / APPROVED FILE */
router.get("/cbu-withdrawals/:id/download/:type", requireAuth, async (req, res) => {
  try {
    const id = toNum(req.params.id);
    const type = norm(req.params.type);

    if (!id) return res.status(400).json({ message: "Invalid withdrawal id" });

    const result = await db.query(
      `
      SELECT
        attachment_path,
        approved_attachment_path
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

    if (type === "approved") {
      key = row.approved_attachment_path || row.attachment_path;
    }

    if (!key) return res.status(404).json({ message: "File not found" });

    const url = await getSignedDownloadUrl(key);
    return res.json({ url });
  } catch (err) {
    console.error("DOWNLOAD CBU FILE ERROR:", err.message);
    return res.status(500).json({ message: err.message });
  }
});

/* APPROVE / REJECT WITH UPLOAD CHAIN */
router.put("/cbu-withdrawals/:id", requireAuth, uploadToTemp, async (req, res) => {
  const client = await db.connect();

  try {
    const id = toNum(req.params.id);
    const rawStatus = clean(req.body?.status || req.body?.action);
    const status =
      norm(rawStatus) === "approved" || norm(rawStatus) === "approve"
        ? "Approved"
        : norm(rawStatus) === "rejected" || norm(rawStatus) === "reject"
        ? "Rejected"
        : rawStatus;
    const rejectionReason = clean(req.body?.rejection_reason);

    if (!id) return res.status(400).json({ message: "Invalid withdrawal id" });

    if (!["Approved", "Rejected"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    if (status === "Rejected" && !rejectionReason) {
      return res.status(400).json({ message: "Rejection reason is required" });
    }

    if (status === "Approved" && !req.file?.key) {
      return res.status(400).json({
        message:
          "Please upload the signed/approved CBU file before approving. This file will replace the previous file for the next approver.",
      });
    }

    await client.query("BEGIN");

    const current = await client.query(
      `
      SELECT id, employee_id, amount, status, approval_stage
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

    if (norm(row.status) === "approved") {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "This withdrawal is already approved" });
    }

    if (norm(row.status) === "rejected") {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "This withdrawal is already rejected" });
    }

    const currentStage = clean(row.approval_stage) || "Branch Manager";
    const col = stageColumn(currentStage);
    const bypass = canBypassApproval(req);

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
      return res.json({ message: "CBU withdrawal rejected successfully" });
    }

    const latestFileKey = await moveFromTemp(
      req.file.key,
      "cbu-withdrawals/latest",
      String(id),
      req.file.originalname || "signed-cbu-file"
    );

    const latestFileName = req.file.originalname || null;
    const next = bypass ? "Approved" : nextStage(currentStage);

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
        SET approval_stage = $1,
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

    const staffRes = await client.query(
      `
      SELECT id, employee_no
      FROM public.staff
      WHERE id = $1
      LIMIT 1
      `,
      [row.employee_id]
    );

    if (staffRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Staff record not found" });
    }

    const employeeNo = clean(staffRes.rows[0].employee_no);

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
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Balance not found" });
    }

    const currentCbu = toNum(balance.rows[0].cbu);
    const amount = toNum(row.amount);

    if (currentCbu < amount) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: `Insufficient CBU balance. Current balance is ${currentCbu}.`,
      });
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

    const updated = await client.query(
      `
      UPDATE public.cbu_withdrawals
      SET status = 'Approved',
          approval_stage = 'Approved',
          approved_at = NOW(),
          attachment_path = $2,
          attachment_name = $3,
          approved_attachment_path = $2,
          approved_attachment_name = $3,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
      `,
      [id, latestFileKey, latestFileName]
    );

    await client.query("COMMIT");

    return res.json({
      message: bypass
        ? "CBU withdrawal fully approved by Admin/IT bypass and deducted successfully."
        : "CBU withdrawal fully approved and deducted successfully.",
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
});

/* BACKWARD COMPATIBLE FINAL FILE UPLOAD */
router.post(
  "/cbu-withdrawals/:id/approved-file",
  requireAuth,
  uploadToTemp,
  async (req, res) => {
    try {
      const id = toNum(req.params.id);

      if (!id) return res.status(400).json({ message: "Invalid withdrawal id" });
      if (!req.file?.key) return res.status(400).json({ message: "No file uploaded" });

      const finalKey = await moveFromTemp(
        req.file.key,
        "cbu-withdrawals/approved",
        String(id),
        req.file.originalname || "approved-file"
      );

      const result = await db.query(
        `
        UPDATE public.cbu_withdrawals
        SET attachment_path = $1,
            attachment_name = $2,
            approved_attachment_path = $1,
            approved_attachment_name = $2,
            updated_at = NOW()
        WHERE id = $3
        RETURNING *
        `,
        [finalKey, req.file.originalname || null, id]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ message: "CBU withdrawal not found" });
      }

      return res.json({ message: "Approved file uploaded", data: result.rows[0] });
    } catch (err) {
      console.error("UPLOAD CBU APPROVED FILE ERROR:", err.message);
      return res.status(500).json({ message: err.message });
    }
  }
);

module.exports = router;