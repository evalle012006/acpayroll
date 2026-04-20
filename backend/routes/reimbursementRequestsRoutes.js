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

const toStr = (v) => String(v ?? "").trim();
const norm = (v) => toStr(v).toLowerCase();
const hasValue = (v) => toStr(v) !== "";

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

const canApproveRole = (role) => {
  const r = norm(role);
  return r === "admin" || r === "hr" || r === "accounting";
};

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

router.get("/", requireAuth, async (req, res) => {
  try {
    const role = norm(req.user?.role);

    let query = `
      SELECT
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
        rr.attachment_path,
        rr.rejection_reason,
        rr.created_by,
        rr.approved_by,
        rr.approved_at,
        rr.rejected_by,
        rr.rejected_at,
        rr.created_at,
        rr.updated_at
      FROM reimbursement_requests rr
      ORDER BY rr.created_at DESC, rr.id DESC
    `;

    const params = [];

    if (role === "branch manager" && req.user?.branch_id) {
      query = `
        SELECT
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
          rr.attachment_path,
          rr.rejection_reason,
          rr.created_by,
          rr.approved_by,
          rr.approved_at,
          rr.rejected_by,
          rr.rejected_at,
          rr.created_at,
          rr.updated_at
        FROM reimbursement_requests rr
        LEFT JOIN staff s ON s.id = rr.employee_id
        WHERE s.branch_id = $1
        ORDER BY rr.created_at DESC, rr.id DESC
      `;
      params.push(req.user.branch_id);
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error("GET /reimbursement-requests error:", err);
    res.status(500).json({ message: "Failed to fetch reimbursement requests." });
  }
});

router.get("/:id", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ message: "Invalid reimbursement id." });
    }

    const result = await pool.query(
      `
      SELECT
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
        rr.attachment_path,
        rr.rejection_reason,
        rr.created_by,
        rr.approved_by,
        rr.approved_at,
        rr.rejected_by,
        rr.rejected_at,
        rr.created_at,
        rr.updated_at
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

router.post(
  "/",
  requireAuth,
  upload.single("attachment"),
  async (req, res) => {
    try {
      if (!canCreateRole(req.user?.role)) {
        return res.status(403).json({ message: "Access denied." });
      }

      const employee_id = hasValue(req.body.employee_id) ? Number(req.body.employee_id) : null;
      const employee_no = toStr(req.body.employee_no) || null;
      const staff_name = toStr(req.body.staff_name);
      const description = toStr(req.body.description);
      const amount = toNum(req.body.amount);
      const request_date = hasValue(req.body.request_date) ? req.body.request_date : null;
      const request_type = toStr(req.body.request_type) || null;
      const reimbursement_date = hasValue(req.body.reimbursement_date)
        ? req.body.reimbursement_date
        : null;
      const status = hasValue(req.body.status) ? toStr(req.body.status) : "Pending";
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
          attachment_path,
          created_by
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
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
          status || "Pending",
          attachment_path,
          req.user?.id || null,
        ]
      );

      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error("POST /reimbursement-requests error:", err);
      res.status(500).json({ message: "Failed to create reimbursement request." });
    }
  }
);

router.put("/:id", requireAuth, async (req, res) => {
  try {
    if (!canApproveRole(req.user?.role)) {
      return res.status(403).json({ message: "Access denied." });
    }

    const id = Number(req.params.id);
    const status = toStr(req.body.status);
    const rejection_reason = toStr(req.body.rejection_reason || req.body.reason || "");

    if (!Number.isInteger(id)) {
      return res.status(400).json({ message: "Invalid reimbursement id." });
    }

    if (!["Approved", "Rejected"].includes(status)) {
      return res.status(400).json({ message: "Invalid status." });
    }

    const existing = await pool.query(
      `SELECT id, status FROM reimbursement_requests WHERE id = $1 LIMIT 1`,
      [id]
    );

    if (!existing.rows.length) {
      return res.status(404).json({ message: "Reimbursement request not found." });
    }

    let result;

    if (status === "Approved") {
      result = await pool.query(
        `
        UPDATE reimbursement_requests
        SET
          status = 'Approved',
          approved_by = $2,
          approved_at = NOW(),
          rejected_by = NULL,
          rejected_at = NULL,
          rejection_reason = NULL,
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
        `,
        [id, req.user?.id || null]
      );
    } else {
      result = await pool.query(
        `
        UPDATE reimbursement_requests
        SET
          status = 'Rejected',
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
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("PUT /reimbursement-requests/:id error:", err);
    res.status(500).json({ message: "Failed to update reimbursement request." });
  }
});

module.exports = router;