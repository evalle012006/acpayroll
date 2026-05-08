const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const pool = require("../db");
const { requireAuth } = require("../middlewares/authMiddleware");

const router = express.Router();

const toNum = (v) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const toInt = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

const toStr = (v) => String(v ?? "").trim();
const norm = (v) => toStr(v).toLowerCase();
const hasValue = (v) => toStr(v) !== "";
const roleLower = (req) => norm(req.user?.role);

const isAdmin = (req) => roleLower(req) === "admin";
const isIT = (req) => roleLower(req) === "it";
const isBypass = (req) => isAdmin(req) || isIT(req);

const isBranchManager = (req) => roleLower(req) === "branch manager";
const isAreaManager = (req) => roleLower(req) === "area manager";
const isRegionalManager = (req) => roleLower(req) === "regional manager";
const isAssistantVicePresident = (req) =>
  roleLower(req) === "assistant vice president";
const isVicePresident = (req) => roleLower(req) === "vice president";
const isSeniorVicePresident = (req) => roleLower(req) === "senior vice president";

const getUserArea = (req) => toStr(req.user?.area);
const getUserRegion = (req) => toStr(req.user?.region);
const getUserBranchId = (req) => toInt(req.user?.branch_id);
const getUserDivision = (req) => toStr(req.user?.division);

const uploadDir = path.join(__dirname, "..", "uploads", "reimbursements");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    const safeBase = path
      .basename(file.originalname || "file", ext)
      .replace(/[^a-zA-Z0-9-_]/g, "_")
      .slice(0, 80);

    cb(null, `reimbursement-${Date.now()}-${safeBase}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
});

const canCreateRole = (role) => {
  return [
    "admin",
    "it",
    "hr",
    "accounting",
    "branch manager",
    "area manager",
    "regional manager",
    "assistant vice president",
    "vice president",
    "senior vice president",
    "president",
  ].includes(norm(role));
};

const NORMAL_CHAIN = [
  "branch manager",
  "area manager",
  "regional manager",
  "assistant vice president",
  "vice president",
  "senior vice president",
];

const BRANCH_MANAGER_CHAIN = [
  "area manager",
  "regional manager",
  "assistant vice president",
  "vice president",
];

const getApprovalChain = (staffPosition, creatorRole) => {
  const position = norm(staffPosition);
  const creator = norm(creatorRole);

  if (position === "branch manager" || creator === "branch manager") {
    return BRANCH_MANAGER_CHAIN;
  }

  return NORMAL_CHAIN;
};

const stageColumnMap = {
  "branch manager": "branch_manager_status",
  "area manager": "area_manager_status",
  "regional manager": "regional_manager_status",
  "assistant vice president": "assistant_vice_president_status",
  "vice president": "vice_president_status",
  "senior vice president": "senior_vice_president_status",
};

const canActOnStage = (req, stage) => {
  if (isBypass(req)) return true;

  const role = roleLower(req);
  return role === norm(stage);
};

const reimbursementSelect = `
  rr.id,
  rr.employee_id,
  rr.employee_no,
  rr.staff_name,
  rr.description,
  rr.amount,
  rr.request_date,
  rr.request_type,
  rr.reimbursement_date,
  rr.status,
  rr.approval_stage,
  rr.approval_chain,
  rr.area_manager_status,
  rr.regional_manager_status,
  rr.assistant_vice_president_status,
  rr.vice_president_status,
  rr.senior_vice_president_status,
  rr.branch_manager_status,
  rr.admin_status,
  rr.attachment_path,
  rr.attachment_name,
  rr.rejection_reason,
  rr.created_by,
  rr.approved_by,
  rr.approved_at,
  rr.rejected_by,
  rr.rejected_at,
  rr.created_at,
  rr.updated_at
`;

router.get("/", requireAuth, async (req, res) => {
  try {
    if (
      isAdmin(req) ||
      isIT(req) ||
      roleLower(req) === "hr" ||
      roleLower(req) === "accounting" ||
      roleLower(req) === "tread" ||
      isVicePresident(req) ||
      isSeniorVicePresident(req) ||
      roleLower(req) === "president"
    ) {
      const result = await pool.query(`
        SELECT ${reimbursementSelect}
        FROM reimbursement_requests rr
        ORDER BY rr.created_at DESC, rr.id DESC
      `);

      return res.json(result.rows);
    }

    if (isBranchManager(req)) {
      const branchId = getUserBranchId(req);
      if (!branchId) return res.json([]);

      const result = await pool.query(
        `
        SELECT ${reimbursementSelect}
        FROM reimbursement_requests rr
        LEFT JOIN staff s ON s.id = rr.employee_id
        WHERE s.branch_id = $1
        ORDER BY rr.created_at DESC, rr.id DESC
        `,
        [branchId]
      );

      return res.json(result.rows);
    }

    if (isAreaManager(req)) {
      const area = getUserArea(req);
      if (!area) return res.json([]);

      const result = await pool.query(
        `
        SELECT ${reimbursementSelect}
        FROM reimbursement_requests rr
        LEFT JOIN staff s ON s.id = rr.employee_id
        WHERE LOWER(TRIM(COALESCE(s.area, ''))) = LOWER(TRIM($1))
        ORDER BY rr.created_at DESC, rr.id DESC
        `,
        [area]
      );

      return res.json(result.rows);
    }

    if (isRegionalManager(req)) {
      const region = getUserRegion(req);
      if (!region) return res.json([]);

      const result = await pool.query(
        `
        SELECT ${reimbursementSelect}
        FROM reimbursement_requests rr
        LEFT JOIN staff s ON s.id = rr.employee_id
        WHERE LOWER(TRIM(COALESCE(s.region, ''))) = LOWER(TRIM($1))
        ORDER BY rr.created_at DESC, rr.id DESC
        `,
        [region]
      );

      return res.json(result.rows);
    }

    if (isAssistantVicePresident(req)) {
      const division = getUserDivision(req);

      if (!division) {
        const result = await pool.query(`
          SELECT ${reimbursementSelect}
          FROM reimbursement_requests rr
          ORDER BY rr.created_at DESC, rr.id DESC
        `);

        return res.json(result.rows);
      }

      const result = await pool.query(
        `
        SELECT ${reimbursementSelect}
        FROM reimbursement_requests rr
        LEFT JOIN staff s ON s.id = rr.employee_id
        WHERE LOWER(TRIM(COALESCE(s.division, ''))) = LOWER(TRIM($1))
        ORDER BY rr.created_at DESC, rr.id DESC
        `,
        [division]
      );

      return res.json(result.rows);
    }

    return res.status(403).json({ message: "Access denied." });
  } catch (err) {
    console.error("GET /reimbursement-requests error:", err);
    res.status(500).json({ message: "Failed to fetch reimbursement requests." });
  }
});

router.get("/:id", requireAuth, async (req, res) => {
  try {
    const id = toInt(req.params.id);

    if (!id) {
      return res.status(400).json({ message: "Invalid reimbursement id." });
    }

    const result = await pool.query(
      `
      SELECT ${reimbursementSelect}
      FROM reimbursement_requests rr
      WHERE rr.id = $1
      LIMIT 1
      `,
      [id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: "Reimbursement request not found." });
    }

    return res.json(result.rows[0]);
  } catch (err) {
    console.error("GET /reimbursement-requests/:id error:", err);
    res.status(500).json({ message: "Failed to fetch reimbursement request." });
  }
});

router.post("/", requireAuth, upload.single("attachment"), async (req, res) => {
  try {
    if (!canCreateRole(req.user?.role)) {
      return res.status(403).json({ message: "Access denied." });
    }

    const employee_id = hasValue(req.body.employee_id)
      ? toInt(req.body.employee_id)
      : null;

    const employee_no = toStr(req.body.employee_no) || null;
    const staff_name = toStr(req.body.staff_name);
    const description = toStr(req.body.description);
    const amount = toNum(req.body.amount);
    const request_date = hasValue(req.body.request_date)
      ? req.body.request_date
      : null;
    const request_type = toStr(req.body.request_type) || null;
    const reimbursement_date = null;

    if (!employee_id) {
      return res.status(400).json({ message: "Employee is required." });
    }

    if (!staff_name) {
      return res.status(400).json({ message: "Staff name is required." });
    }

    if (!description) {
      return res.status(400).json({ message: "Description is required." });
    }

    if (amount <= 0) {
      return res.status(400).json({ message: "Amount must be greater than zero." });
    }

    if (!req.file) {
      return res.status(400).json({ message: "Reimbursement request file is required." });
    }

    const staffRes = await pool.query(
      `
      SELECT id, employee_no, fullname, position
      FROM staff
      WHERE id = $1
      LIMIT 1
      `,
      [employee_id]
    );

    if (staffRes.rowCount === 0) {
      return res.status(404).json({ message: "Staff not found." });
    }

    const staff = staffRes.rows[0];
    const chain = getApprovalChain(staff.position, req.user?.role);
    const approval_stage = chain[0];

    const attachment_path = `/uploads/reimbursements/${req.file.filename}`;
    const attachment_name = req.file.originalname || null;

    const result = await pool.query(
      `
      INSERT INTO reimbursement_requests (
        employee_id,
        employee_no,
        staff_name,
        description,
        amount,
        request_date,
        request_type,
        reimbursement_date,
        status,
        approval_stage,
        approval_chain,
        branch_manager_status,
        area_manager_status,
        regional_manager_status,
        assistant_vice_president_status,
        vice_president_status,
        senior_vice_president_status,
        admin_status,
        attachment_path,
        attachment_name,
        created_by
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,
        'Pending',
        $9,
        $10,
        'Pending','Pending','Pending','Pending','Pending','Pending','Pending',
        $11,$12,$13
      )
      RETURNING *
      `,
      [
        employee_id,
        employee_no || staff.employee_no || null,
        staff_name,
        description,
        amount,
        request_date,
        request_type,
        reimbursement_date,
        approval_stage,
        JSON.stringify(chain),
        attachment_path,
        attachment_name,
        req.user?.id || null,
      ]
    );

    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("POST /reimbursement-requests error:", err);
    res.status(500).json({
      message: err.message || "Failed to create reimbursement request.",
    });
  }
});

router.get("/:id/download/latest", requireAuth, async (req, res) => {
  try {
    const id = toInt(req.params.id);

    if (!id) {
      return res.status(400).json({ message: "Invalid reimbursement id." });
    }

    const result = await pool.query(
      `
      SELECT attachment_path, attachment_name
      FROM reimbursement_requests
      WHERE id = $1
      LIMIT 1
      `,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Reimbursement request not found." });
    }

    const row = result.rows[0];

    if (!row.attachment_path) {
      return res.status(404).json({ message: "No reimbursement file found." });
    }

    const filePath = path.join(
      __dirname,
      "..",
      String(row.attachment_path).replace(/^\/+/, "")
    );

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "File not found on server." });
    }

    return res.download(filePath, row.attachment_name || path.basename(filePath));
  } catch (err) {
    console.error("GET /reimbursement-requests/:id/download/latest error:", err);
    res.status(500).json({ message: "Failed to download reimbursement file." });
  }
});

router.put(
  "/:id",
  requireAuth,
  upload.single("attachment"),
  async (req, res) => {
    try {
      const id = toInt(req.params.id);
      const action = norm(req.body.action || req.body.status);
      const rejection_reason = toStr(
        req.body.rejection_reason || req.body.reason || ""
      );

      if (!id) {
        return res.status(400).json({ message: "Invalid reimbursement id." });
      }

      if (!["approve", "approved", "reject", "rejected"].includes(action)) {
        return res.status(400).json({ message: "Invalid action." });
      }

      const existing = await pool.query(
        `
        SELECT *
        FROM reimbursement_requests
        WHERE id = $1
        LIMIT 1
        `,
        [id]
      );

      if (!existing.rows.length) {
        return res.status(404).json({ message: "Reimbursement request not found." });
      }

      const row = existing.rows[0];

      if (norm(row.status) === "approved" || norm(row.status) === "rejected") {
        return res.status(400).json({ message: "Already finalized." });
      }

      let chain = null;

      try {
        chain = Array.isArray(row.approval_chain)
          ? row.approval_chain
          : JSON.parse(row.approval_chain || "[]");
      } catch {
        chain = NORMAL_CHAIN;
      }

      if (!Array.isArray(chain) || chain.length === 0) {
        chain = NORMAL_CHAIN;
      }

      chain = chain.map(norm);

      const currentStage = norm(row.approval_stage || chain[0]);
      const role = roleLower(req);
      const bypass = isBypass(req);

      if (!bypass && !canActOnStage(req, currentStage)) {
        return res.status(403).json({ message: "Not your approval stage." });
      }

      const actingStage = currentStage;
      const column = stageColumnMap[actingStage];

      if (!column) {
        return res.status(403).json({ message: "Access denied." });
      }

      if (action === "reject" || action === "rejected") {
        const result = await pool.query(
          `
          UPDATE reimbursement_requests
          SET
            status = 'Rejected',
            ${column} = 'Rejected',
            rejected_by = $2,
            rejected_at = NOW(),
            approved_by = NULL,
            approved_at = NULL,
            rejection_reason = $3,
            updated_at = NOW()
          WHERE id = $1
          RETURNING *
          `,
          [id, req.user?.id || null, rejection_reason || null]
        );

        return res.json(result.rows[0]);
      }

      if (!req.file) {
        return res.status(400).json({
          message: "Please upload the signed reimbursement file before approving.",
        });
      }

      const attachment_path = `/uploads/reimbursements/${req.file.filename}`;
      const attachment_name = req.file.originalname || null;

      const currentIndex = chain.indexOf(currentStage);
      const nextStage = bypass ? null : chain[currentIndex + 1];

      if (!nextStage) {
        const reimbursement_date = hasValue(req.body.reimbursement_date)
          ? req.body.reimbursement_date
          : row.reimbursement_date;

        const result = await pool.query(
          `
          UPDATE reimbursement_requests
          SET
            status = 'Approved',
            approval_stage = 'approved',
            ${column} = 'Approved',
            approved_by = $2,
            approved_at = NOW(),
            reimbursement_date = $3,
            attachment_path = $4,
            attachment_name = $5,
            rejected_by = NULL,
            rejected_at = NULL,
            rejection_reason = NULL,
            updated_at = NOW()
          WHERE id = $1
          RETURNING *
          `,
          [
            id,
            req.user?.id || null,
            reimbursement_date,
            attachment_path,
            attachment_name,
          ]
        );

        return res.json(result.rows[0]);
      }

      const result = await pool.query(
        `
        UPDATE reimbursement_requests
        SET
          ${column} = 'Approved',
          approval_stage = $2,
          attachment_path = $3,
          attachment_name = $4,
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
        `,
        [id, nextStage, attachment_path, attachment_name]
      );

      return res.json(result.rows[0]);
    } catch (err) {
      console.error("PUT /reimbursement-requests/:id error:", err);
      res.status(500).json({
        message: err.message || "Failed to update reimbursement request.",
      });
    }
  }
);

module.exports = router;