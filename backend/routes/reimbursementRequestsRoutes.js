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
const isAreaManager = (req) => roleLower(req) === "area manager";
const isRegionalManager = (req) => roleLower(req) === "regional manager";
const isAssistantVicePresident = (req) =>
  roleLower(req) === "assistant vice president";
const isBranchManager = (req) => roleLower(req) === "branch manager";

const getUserArea = (req) => toStr(req.user?.area);
const getUserRegion = (req) => toStr(req.user?.region);
const getUserBranchId = (req) => toInt(req.user?.branch_id);

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
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

const canCreateRole = (role) => {
  const r = norm(role);
  return [
    "admin",
    "hr",
    "accounting",
    "branch manager",
    "area manager",
    "regional manager",
    "assistant vice president",
    "vice president",
    "senior vice president",
    "president",
  ].includes(r);
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
  rr.area_manager_status,
  rr.regional_manager_status,
  rr.assistant_vice_president_status,
  rr.admin_status,
  rr.attachment_path,
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
    const role = roleLower(req);

    if (isAdmin(req)) {
      const result = await pool.query(
        `
        SELECT
          ${reimbursementSelect}
        FROM reimbursement_requests rr
        ORDER BY rr.created_at DESC, rr.id DESC
        `
      );
      return res.json(result.rows);
    }

    if (isAreaManager(req)) {
      const area = getUserArea(req);
      if (!area) return res.json([]);

      const result = await pool.query(
        `
        SELECT
          ${reimbursementSelect}
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
        SELECT
          ${reimbursementSelect}
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
      const result = await pool.query(
        `
        SELECT
          ${reimbursementSelect}
        FROM reimbursement_requests rr
        ORDER BY rr.created_at DESC, rr.id DESC
        `
      );
      return res.json(result.rows);
    }

    if (isBranchManager(req)) {
      const branchId = getUserBranchId(req);
      if (!branchId) return res.json([]);

      const result = await pool.query(
        `
        SELECT
          ${reimbursementSelect}
        FROM reimbursement_requests rr
        LEFT JOIN staff s ON s.id = rr.employee_id
        WHERE s.branch_id = $1
        ORDER BY rr.created_at DESC, rr.id DESC
        `,
        [branchId]
      );
      return res.json(result.rows);
    }

    const result = await pool.query(
      `
      SELECT
        ${reimbursementSelect}
      FROM reimbursement_requests rr
      ORDER BY rr.created_at DESC, rr.id DESC
      `
    );
    return res.json(result.rows);
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
      SELECT
        ${reimbursementSelect}
      FROM reimbursement_requests rr
      WHERE rr.id = $1
      LIMIT 1
      `,
      [id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: "Reimbursement request not found." });
    }

    res.json(result.rows[0]);
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

    const employee_id = hasValue(req.body.employee_id) ? toInt(req.body.employee_id) : null;
    const employee_no = toStr(req.body.employee_no) || null;
    const staff_name = toStr(req.body.staff_name);
    const description = toStr(req.body.description);
    const amount = toNum(req.body.amount);
    const request_date = hasValue(req.body.request_date) ? req.body.request_date : null;
    const request_type = toStr(req.body.request_type) || null;

    // admin only can set reimbursement_date, so on create always null
    const reimbursement_date = null;

    const status = "Pending";
    const approval_stage = "area manager";

    const attachment_path = req.file
      ? `/uploads/reimbursements/${req.file.filename}`
      : null;

    if (!staff_name) {
      return res.status(400).json({ message: "Staff name is required." });
    }

    if (!description) {
      return res.status(400).json({ message: "Description is required." });
    }

    if (amount <= 0) {
      return res.status(400).json({ message: "Amount must be greater than zero." });
    }

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
        area_manager_status,
        regional_manager_status,
        assistant_vice_president_status,
        admin_status,
        attachment_path,
        created_by
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
        'Pending','Pending','Pending','Pending',
        $11,$12
      )
      RETURNING *
      `,
      [
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
        attachment_path,
        req.user?.id || null,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("POST /reimbursement-requests error:", err);
    res.status(500).json({ message: "Failed to create reimbursement request." });
  }
});

router.put("/:id", requireAuth, async (req, res) => {
  try {
    const id = toInt(req.params.id);
    const action = norm(req.body.action);
    const rejection_reason = toStr(req.body.rejection_reason || req.body.reason || "");

    if (!id) {
      return res.status(400).json({ message: "Invalid reimbursement id." });
    }

    if (!["approve", "reject"].includes(action)) {
      return res.status(400).json({ message: "Invalid action." });
    }

    const existing = await pool.query(
      `SELECT * FROM reimbursement_requests WHERE id = $1 LIMIT 1`,
      [id]
    );

    if (!existing.rows.length) {
      return res.status(404).json({ message: "Reimbursement request not found." });
    }

    const row = existing.rows[0];

    if (row.status === "Approved" || row.status === "Rejected") {
      return res.status(400).json({ message: "Already finalized." });
    }

    const chain = [
      "area manager",
      "regional manager",
      "assistant vice president",
      "admin",
    ];

    const currentStage = norm(row.approval_stage || "area manager");
    const role = roleLower(req);

    if (role !== currentStage) {
      return res.status(403).json({ message: "Not your approval stage." });
    }

    const statusColumnMap = {
      "area manager": "area_manager_status",
      "regional manager": "regional_manager_status",
      "assistant vice president": "assistant_vice_president_status",
      admin: "admin_status",
    };

    const column = statusColumnMap[role];
    if (!column) {
      return res.status(403).json({ message: "Access denied." });
    }

    if (action === "reject") {
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

    const currentIndex = chain.indexOf(role);
    const nextStage = chain[currentIndex + 1];

    if (!nextStage) {
      // final admin approval, only here reimbursement_date may be saved
      const reimbursement_date =
        isAdmin(req) && hasValue(req.body.reimbursement_date)
          ? req.body.reimbursement_date
          : row.reimbursement_date;

      const result = await pool.query(
        `
        UPDATE reimbursement_requests
        SET
          status = 'Approved',
          ${column} = 'Approved',
          approved_by = $2,
          approved_at = NOW(),
          reimbursement_date = $3,
          rejected_by = NULL,
          rejected_at = NULL,
          rejection_reason = NULL,
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
        `,
        [id, req.user?.id || null, reimbursement_date]
      );

      return res.json(result.rows[0]);
    }

    const result = await pool.query(
      `
      UPDATE reimbursement_requests
      SET
        ${column} = 'Approved',
        approval_stage = $2,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
      `,
      [id, nextStage]
    );

    return res.json(result.rows[0]);
  } catch (err) {
    console.error("PUT /reimbursement-requests/:id error:", err);
    res.status(500).json({ message: "Failed to update reimbursement request." });
  }
});

module.exports = router;