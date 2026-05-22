const express = require("express");
const router = express.Router();
const pool = require("../db");

const fs = require("fs");
const path = require("path");
const multer = require("multer");

const { requireAuth } = require("../middlewares/authMiddleware");
const { requirePermission } = require("../middlewares/permissionMiddleware");

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const uploadDir = path.join(__dirname, "..", "uploads", "sbf-orders");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const safeName = String(file.originalname || "file")
      .replace(/[^\w.\-() ]+/g, "_")
      .replace(/\s+/g, "_");

    cb(null, `${Date.now()}-${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024,
  },
});

async function makeOrderNo() {
  const result = await pool.query(`
    SELECT 'SBF-' || LPAD((COALESCE(MAX(id), 0) + 1)::text, 6, '0') AS order_no
    FROM public.sbf_orders
  `);

  return result.rows[0]?.order_no || "SBF-000001";
}

const selectSbfFields = `
  id,
  order_no,
  employee_no,
  employee_name,
  branch_code,
  branch_name,
  assistance_type,
  amount,
  reason,
  date_created,
  effective_date,
  status,
  attachment_path,
  attachment_name,
  attachment_mime,
  approved_by,
  approved_at
`;

router.get(
  "/sbf-orders",
  requireAuth,
  requirePermission("sbf_order", "view"),
  async (_req, res) => {
    try {
      const result = await pool.query(`
        SELECT ${selectSbfFields}
        FROM public.sbf_orders
        ORDER BY id DESC
      `);

      return res.json(result.rows);
    } catch (err) {
      console.error("GET SBF ORDERS ERROR:", err);
      return res.status(500).json({ message: err.message });
    }
  }
);

router.get(
  "/sbf-orders/:id",
  requireAuth,
  requirePermission("sbf_order", "view"),
  async (req, res) => {
    try {
      const id = Number(req.params.id);

      if (!Number.isFinite(id)) {
        return res.status(400).json({ message: "Invalid SBF order id" });
      }

      const result = await pool.query(
        `
        SELECT ${selectSbfFields}
        FROM public.sbf_orders
        WHERE id = $1
        `,
        [id]
      );

      if (!result.rows.length) {
        return res.status(404).json({ message: "SBF order not found" });
      }

      return res.json(result.rows[0]);
    } catch (err) {
      console.error("GET SINGLE SBF ORDER ERROR:", err);
      return res.status(500).json({ message: err.message });
    }
  }
);

router.post(
  "/sbf-orders",
  requireAuth,
  requirePermission("sbf_order", "create"),
  upload.single("attachment"),
  async (req, res) => {
    try {
      const {
        employee_no,
        employee_name,
        branch_code,
        branch_name,
        assistance_type,
        amount,
        reason,
        date_created,
        effective_date,
      } = req.body;

      const order_no = await makeOrderNo();

      const attachmentPath = req.file
        ? `/uploads/sbf-orders/${req.file.filename}`
        : null;

      const attachmentName = req.file?.originalname || null;
      const attachmentMime = req.file?.mimetype || null;

      const result = await pool.query(
        `
        INSERT INTO public.sbf_orders (
          order_no,
          employee_no,
          employee_name,
          branch_code,
          branch_name,
          assistance_type,
          amount,
          reason,
          date_created,
          effective_date,
          status,
          attachment_path,
          attachment_name,
          attachment_mime
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
        RETURNING ${selectSbfFields}
        `,
        [
          order_no,
          employee_no,
          employee_name,
          branch_code,
          branch_name,
          assistance_type,
          toNum(amount),
          reason,
          date_created || null,
          effective_date || null,
          "Pending",
          attachmentPath,
          attachmentName,
          attachmentMime,
        ]
      );

      return res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error("CREATE SBF ORDER ERROR:", err);
      return res.status(500).json({ message: err.message });
    }
  }
);

router.get(
  "/sbf-orders/:id/download",
  requireAuth,
  requirePermission("sbf_order", "view"),
  async (req, res) => {
    try {
      const id = Number(req.params.id);

      if (!Number.isFinite(id)) {
        return res.status(400).json({ message: "Invalid SBF order id" });
      }

      const result = await pool.query(
        `
        SELECT attachment_path, attachment_name, attachment_mime
        FROM public.sbf_orders
        WHERE id = $1
        `,
        [id]
      );

      if (!result.rows.length) {
        return res.status(404).json({ message: "SBF order not found" });
      }

      const row = result.rows[0];

      if (!row.attachment_path) {
        return res.status(404).json({ message: "No attachment uploaded" });
      }

      const filename = path.basename(row.attachment_path);
      const filePath = path.join(uploadDir, filename);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "File not found on server" });
      }

      if (row.attachment_mime) {
        res.setHeader("Content-Type", row.attachment_mime);
      }

      return res.download(filePath, row.attachment_name || filename);
    } catch (err) {
      console.error("DOWNLOAD SBF FILE ERROR:", err);
      return res.status(500).json({ message: err.message });
    }
  }
);

router.put(
  "/sbf-orders/:id/approve",
  requireAuth,
  requirePermission("sbf_order", "approve"),
  async (req, res) => {
    try {
      const id = Number(req.params.id);

      if (!Number.isFinite(id)) {
        return res.status(400).json({ message: "Invalid SBF order id" });
      }

      const approvedBy = Number(
        req.user?.id ?? req.user?.user_id ?? req.user?.employee_id
      );

      if (!Number.isFinite(approvedBy)) {
        return res.status(400).json({
          message:
            "Invalid approver id. Check req.user.id / user_id / employee_id",
        });
      }

      const result = await pool.query(
        `
        UPDATE public.sbf_orders
        SET
          status = 'Approved',
          approved_by = $2,
          approved_at = NOW()
        WHERE id = $1
        RETURNING ${selectSbfFields}
        `,
        [id, approvedBy]
      );

      if (!result.rows.length) {
        return res.status(404).json({ message: "SBF order not found" });
      }

      return res.json(result.rows[0]);
    } catch (err) {
      console.error("APPROVE SBF ORDER ERROR:", err);
      return res.status(500).json({ message: err.message });
    }
  }
);

router.put(
  "/sbf-orders/:id/reject",
  requireAuth,
  requirePermission("sbf_order", "reject"),
  async (req, res) => {
    try {
      const id = Number(req.params.id);

      if (!Number.isFinite(id)) {
        return res.status(400).json({ message: "Invalid SBF order id" });
      }

      const result = await pool.query(
        `
        UPDATE public.sbf_orders
        SET status = 'Rejected'
        WHERE id = $1
        RETURNING ${selectSbfFields}
        `,
        [id]
      );

      if (!result.rows.length) {
        return res.status(404).json({ message: "SBF order not found" });
      }

      return res.json(result.rows[0]);
    } catch (err) {
      console.error("REJECT SBF ORDER ERROR:", err);
      return res.status(500).json({ message: err.message });
    }
  }
);

module.exports = router;