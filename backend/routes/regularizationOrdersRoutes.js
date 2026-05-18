const express = require("express");
const router = express.Router();
const pool = require("../db");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const { requireAuth } = require("../middlewares/authMiddleware");
const { requirePermission } = require("../middlewares/permissionMiddleware");

const toInt = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

const toNum = (v) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const clean = (v) => String(v ?? "").trim();

const toDate = (v) => {
  const s = String(v ?? "").trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};

const uploadRoot = path.join(process.cwd(), "uploads");
const regUploadDir = path.join(uploadRoot, "regularization");

if (!fs.existsSync(regUploadDir)) {
  fs.mkdirSync(regUploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, regUploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    const base = path
      .basename(file.originalname || "file", ext)
      .replace(/[^a-zA-Z0-9-_]/g, "_");

    cb(null, `${Date.now()}-${base}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
});

router.get(
  "/regularization-orders",
  requireAuth,
  requirePermission("regularization_order", "view"),
  async (_req, res) => {
    try {
      const result = await pool.query(`
        SELECT *
        FROM public.regularization_orders
        ORDER BY id DESC
      `);

      return res.json(result.rows);
    } catch (err) {
      console.error("GET /regularization-orders ERROR:", err);
      return res.status(500).json({
        message: err?.message || "Failed to load regularization orders.",
      });
    }
  }
);

router.post(
  "/regularization-orders",
  requireAuth,
  requirePermission("regularization_order", "create"),
  upload.single("attachment"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const employee_id = toInt(req.body?.employee_id);
      const employee_no = clean(req.body?.employee_no);
      const employee_name = clean(req.body?.employee_name);

      const branch_id = toInt(req.body?.branch_id);
      const branch_label = clean(req.body?.branch_label);

      const regularization_branch_id = toInt(req.body?.regularization_branch_id);
      const regularization_branch_label = clean(req.body?.regularization_branch_label);

      const date_created =
        toDate(req.body?.date_created) || new Date().toISOString().slice(0, 10);

      const effective_date = toDate(req.body?.effective_date);

      const previous_position = clean(req.body?.previous_position);
      const present_position = clean(req.body?.present_position);

      const previous_salary = toNum(req.body?.previous_salary);
      const present_salary = toNum(req.body?.present_salary);

      const previous_ecola = toNum(req.body?.previous_ecola);
      const present_ecola = toNum(req.body?.present_ecola);

      const remarks = clean(req.body?.remarks);

      const attachment_path = req.file
        ? `/uploads/regularization/${req.file.filename}`
        : null;

      const attachment_name = req.file ? clean(req.file.originalname) : null;
      const attachment_mime = req.file ? clean(req.file.mimetype) : null;

      if (!employee_id) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Employee is required." });
      }

      if (!effective_date) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Regularization date is required." });
      }

      if (!present_position) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Present position is required." });
      }

      if (!regularization_branch_id) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Regularization branch is required." });
      }

      const idRes = await client.query(`
        SELECT COALESCE(MAX(id), 0) + 1 AS next_id
        FROM public.regularization_orders
      `);

      const nextId = Number(idRes.rows?.[0]?.next_id || 0);

      if (!nextId) {
        await client.query("ROLLBACK");
        return res.status(500).json({
          message: "Failed to generate regularization ID.",
        });
      }

      const order_no = `REG-${String(nextId).padStart(8, "0")}`;

      const inserted = await client.query(
        `
        INSERT INTO public.regularization_orders
        (
          id,
          order_no,
          employee_id,
          employee_no,
          employee_name,
          branch_id,
          branch_label,
          regularization_branch_id,
          regularization_branch_label,
          date_created,
          effective_date,
          previous_position,
          present_position,
          previous_salary,
          present_salary,
          previous_ecola,
          present_ecola,
          attachment_path,
          attachment_name,
          attachment_mime,
          approved_attachment_path,
          approved_attachment_name,
          approved_attachment_mime,
          remarks,
          status,
          created_by,
          created_at,
          updated_at
        )
        VALUES
        (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10::date,$11::date,
          $12,$13,$14,$15,$16,$17,
          $18,$19,$20,
          NULL,NULL,NULL,
          $21,
          'Pending',
          $22,
          NOW(),
          NOW()
        )
        RETURNING *;
        `,
        [
          nextId,
          order_no,
          employee_id,
          employee_no,
          employee_name,
          branch_id,
          branch_label,
          regularization_branch_id,
          regularization_branch_label,
          date_created,
          effective_date,
          previous_position,
          present_position,
          previous_salary,
          present_salary,
          previous_ecola,
          present_ecola,
          attachment_path,
          attachment_name,
          attachment_mime,
          remarks || null,
          req.user?.id ?? null,
        ]
      );

      await client.query("COMMIT");
      return res.json(inserted.rows[0]);
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("POST /regularization-orders ERROR:", err);
      return res.status(500).json({
        message: err?.message || "Failed to create regularization order.",
      });
    } finally {
      client.release();
    }
  }
);

router.get(
  "/regularization-orders/:id/download",
  requireAuth,
  requirePermission("regularization_order", "view"),
  async (req, res) => {
    try {
      const id = toInt(req.params.id);

      if (!id) {
        return res.status(400).json({ message: "Invalid id." });
      }

      const result = await pool.query(
        `
        SELECT *
        FROM public.regularization_orders
        WHERE id = $1
        `,
        [id]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          message: "Regularization order not found.",
        });
      }

      const row = result.rows[0];

      const finalPath = row.approved_attachment_path || row.attachment_path;
      const finalName = row.approved_attachment_name || row.attachment_name;

      if (!finalPath) {
        return res.status(404).json({ message: "No attachment found." });
      }

      const filePath = path.join(process.cwd(), finalPath.replace(/^\/+/, ""));

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "Stored file not found." });
      }

      return res.download(filePath, finalName || path.basename(filePath));
    } catch (err) {
      console.error("GET /regularization-orders/:id/download ERROR:", err);
      return res.status(500).json({
        message: err?.message || "Failed to download attachment.",
      });
    }
  }
);

router.put(
  "/regularization-orders/:id/approve",
  requireAuth,
  requirePermission("regularization_order", "approve"),
  upload.single("attachment"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const id = toInt(req.params.id);

      if (!id) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Invalid id." });
      }

      const check = await client.query(
        `
        SELECT *
        FROM public.regularization_orders
        WHERE id = $1
        FOR UPDATE
        `,
        [id]
      );

      if (check.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          message: "Regularization order not found.",
        });
      }

      const existing = check.rows[0];

      const approvedPath = req.file
        ? `/uploads/regularization/${req.file.filename}`
        : existing.approved_attachment_path || existing.attachment_path;

      const approvedName = req.file
        ? clean(req.file.originalname)
        : existing.approved_attachment_name || existing.attachment_name;

      const approvedMime = req.file
        ? clean(req.file.mimetype)
        : existing.approved_attachment_mime || existing.attachment_mime;

      const result = await client.query(
        `
        UPDATE public.regularization_orders
        SET
          status = 'Approved',
          approved_by = $2,
          approved_at = NOW(),
          approved_attachment_path = $3,
          approved_attachment_name = $4,
          approved_attachment_mime = $5,
          updated_at = NOW()
        WHERE id = $1
        RETURNING *;
        `,
        [id, req.user?.id ?? null, approvedPath, approvedName, approvedMime]
      );

      const row = result.rows[0];

      await client.query(
        `
        UPDATE public.staff
        SET
          position = COALESCE(NULLIF($2, ''), position),
          salary = COALESCE($3, salary),
          ecola = COALESCE($4, ecola),
          branch_id = COALESCE($5, branch_id),
          regularization_date = COALESCE($6::date, regularization_date)
        WHERE id = $1
        `,
        [
          row.employee_id,
          row.present_position,
          row.present_salary,
          row.present_ecola,
          row.regularization_branch_id || row.branch_id || null,
          row.effective_date,
        ]
      );

      await client.query("COMMIT");
      return res.json(row);
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("PUT /regularization-orders/:id/approve ERROR:", err);
      return res.status(500).json({
        message: err?.message || "Failed to approve regularization order.",
      });
    } finally {
      client.release();
    }
  }
);

router.put(
  "/regularization-orders/:id/reject",
  requireAuth,
  requirePermission("regularization_order", "reject"),
  async (req, res) => {
    try {
      const id = toInt(req.params.id);
      const reason = clean(req.body?.reason);

      if (!id) {
        return res.status(400).json({ message: "Invalid id." });
      }

      if (!reason) {
        return res.status(400).json({
          message: "Rejection reason is required.",
        });
      }

      const result = await pool.query(
        `
        UPDATE public.regularization_orders
        SET
          status = 'Rejected',
          rejection_reason = $2,
          rejected_by = $3,
          rejected_at = NOW(),
          updated_at = NOW()
        WHERE id = $1
        RETURNING *;
        `,
        [id, reason, req.user?.id ?? null]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          message: "Regularization order not found.",
        });
      }

      return res.json(result.rows[0]);
    } catch (err) {
      console.error("PUT /regularization-orders/:id/reject ERROR:", err);
      return res.status(500).json({
        message: err?.message || "Failed to reject regularization order.",
      });
    }
  }
);

router.delete(
  "/regularization-orders/:id",
  requireAuth,
  requirePermission("regularization_order", "delete"),
  async (req, res) => {
    try {
      const id = toInt(req.params.id);

      if (!id) {
        return res.status(400).json({ message: "Invalid id." });
      }

      const result = await pool.query(
        `
        SELECT attachment_path, approved_attachment_path
        FROM public.regularization_orders
        WHERE id = $1
        `,
        [id]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          message: "Regularization order not found.",
        });
      }

      const row = result.rows[0];

      await pool.query(
        `
        DELETE FROM public.regularization_orders
        WHERE id = $1
        `,
        [id]
      );

      [row.attachment_path, row.approved_attachment_path]
        .filter(Boolean)
        .forEach((p) => {
          const filePath = path.join(process.cwd(), String(p).replace(/^\/+/, ""));
          fs.unlink(filePath, () => {});
        });

      return res.json({
        message: "Regularization order deleted successfully.",
      });
    } catch (err) {
      console.error("DELETE /regularization-orders/:id ERROR:", err);
      return res.status(500).json({
        message: err?.message || "Failed to delete regularization order.",
      });
    }
  }
);

module.exports = router;