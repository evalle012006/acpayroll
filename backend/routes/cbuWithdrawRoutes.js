const express = require("express");
const router = express.Router();
const db = require("../db");

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

const MAIN_OFFICE_DEPARTMENTS = [
  "audit department",
  "human resource department",
  "accounting department",
  "it department",
  "office of the president",
  "production & logistic department",
  "tread department",
];

const OPERATION_POSITIONS = [
  "loan officer",
  "probationary loan officer",
  "branch manager",
];

const isMainOffice = (department) =>
  MAIN_OFFICE_DEPARTMENTS.includes(norm(department));

const isOperationChain = (staff) =>
  norm(staff?.department) === "operation department" &&
  OPERATION_POSITIONS.includes(norm(staff?.position));

const initialStage = (staff) => {
  if (isMainOffice(staff?.department)) return "SVP";
  if (isOperationChain(staff)) return "Branch Manager";
  return "Branch Manager";
};

const nextStage = (stage) => {
  const s = norm(stage);

  if (s === "branch manager") return "Area Manager";
  if (s === "area manager") return "Regional Manager";
  if (s === "regional manager") return "Assistant Vice President";
  if (s === "assistant vice president") return "Vice President";
  if (s === "vice president") return "Approved";

  if (s === "svp" || s === "senior vice president") return "Final";
  if (s === "final") return "Approved";

  return "Approved";
};

const stageColumn = (stage) => {
  const s = norm(stage);

  if (s === "branch manager") return "branch_manager_status";
  if (s === "area manager") return "area_manager_status";
  if (s === "regional manager") return "regional_manager_status";
  if (s === "assistant vice president") return "avp_status";
  if (s === "vice president") return "vp_status";
  if (s === "svp" || s === "senior vice president") return "svp_status";
  if (s === "final") return "final_status";

  return null;
};

// GET ALL
router.get("/cbu-withdrawals", async (_req, res) => {
  try {
    const result = await db.query(`
      SELECT
        cw.*,
        s.employee_no,
        s.department,
        s.position,
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

// CREATE
router.post("/cbu-withdrawals", uploadToTemp, async (req, res) => {
  try {
    const employeeId = toNum(req.body?.employee_id);
    const amount = toNum(req.body?.amount);
    const reason = clean(req.body?.reason);
    const disbursementDate = clean(req.body?.disbursement_date) || null;

    if (!employeeId) return res.status(400).json({ message: "Employee is required" });
    if (!amount || amount <= 0) return res.status(400).json({ message: "Valid amount is required" });
    if (!reason) return res.status(400).json({ message: "Reason is required" });

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

    let attachmentPath = null;
    let attachmentName = null;

    if (req.file?.key) {
      attachmentPath = await moveFromTemp(
        req.file.key,
        "cbu-withdrawals/request",
        String(employeeId),
        req.file.originalname || "request-file"
      );
      attachmentName = req.file.originalname || null;
    }

    const startStage = initialStage(staff);

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

// UPLOAD APPROVED FILE
router.post("/cbu-withdrawals/:id/approved-file", uploadToTemp, async (req, res) => {
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
      SET approved_attachment_path = $1,
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
});

// DOWNLOAD FILE
router.get("/cbu-withdrawals/:id/download/:type", async (req, res) => {
  try {
    const id = toNum(req.params.id);
    const type = clean(req.params.type);

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
    const key = type === "approved" ? row.approved_attachment_path : row.attachment_path;

    if (!key) return res.status(404).json({ message: "File not found" });

    const url = await getSignedDownloadUrl(key);
    return res.json({ url });
  } catch (err) {
    console.error("DOWNLOAD CBU FILE ERROR:", err.message);
    return res.status(500).json({ message: err.message });
  }
});

// APPROVE / REJECT
router.put("/cbu-withdrawals/:id", async (req, res) => {
  const client = await db.connect();

  try {
    const id = toNum(req.params.id);
    const status = clean(req.body?.status);
    const rejectionReason = clean(req.body?.rejection_reason);

    if (!id) return res.status(400).json({ message: "Invalid withdrawal id" });

    if (!["Approved", "Rejected"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    if (status === "Rejected" && !rejectionReason) {
      return res.status(400).json({ message: "Rejection reason is required" });
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

    const next = nextStage(currentStage);

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
            updated_at = NOW()
        WHERE id = $2
        RETURNING *
        `,
        [next, id]
      );

      await client.query("COMMIT");

      return res.json({
        message: `CBU withdrawal approved. Next stage: ${next}`,
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
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
      `,
      [id]
    );

    await client.query("COMMIT");

    return res.json({
      message: "CBU withdrawal fully approved and deducted successfully",
      data: updated.rows[0],
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("UPDATE CBU ERROR:", err.message);
    return res.status(500).json({ message: err.message || "Failed to update CBU withdrawal" });
  } finally {
    client.release();
  }
});

module.exports = router;