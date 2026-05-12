const express = require("express");
const router = express.Router();
const pool = require("../db");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const { requireAuth } = require("../middlewares/authMiddleware");
const { requirePermission } = require("../middlewares/permissionMiddleware");

const toStr = (v) => String(v ?? "").trim();
const norm = (v) => toStr(v).toLowerCase();

const roleLower = (req) => norm(req.user?.role);
const isAdmin = (req) => ["admin", "it"].includes(roleLower(req));

const uploadDir = path.join(process.cwd(), "uploads", "board-resolution");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    const base = path
      .basename(file.originalname || "file", ext)
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 80);

    cb(null, `${Date.now()}-${base}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
});

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.board_resolution_requests (
      id SERIAL PRIMARY KEY,
      request_no VARCHAR(50) UNIQUE,
      date_created DATE,
      to_text TEXT,
      thru_text TEXT,
      title TEXT NOT NULL,
      details TEXT,
      status VARCHAR(100) DEFAULT 'Submitted',
      created_by INTEGER,
      created_by_role VARCHAR(100),
      created_at TIMESTAMP DEFAULT NOW(),
      request_attachment_path TEXT,
      request_attachment_name TEXT,
      request_attachment_mime TEXT,
      rejected_by INTEGER,
      rejected_at TIMESTAMP,
      rejection_reason TEXT
    );
  `);

  await pool.query(`
    ALTER TABLE public.board_resolution_requests
    ADD COLUMN IF NOT EXISTS date_created DATE,
    ADD COLUMN IF NOT EXISTS to_text TEXT,
    ADD COLUMN IF NOT EXISTS thru_text TEXT,
    ADD COLUMN IF NOT EXISTS title TEXT,
    ADD COLUMN IF NOT EXISTS details TEXT,
    ADD COLUMN IF NOT EXISTS status VARCHAR(100) DEFAULT 'Submitted',
    ADD COLUMN IF NOT EXISTS created_by INTEGER,
    ADD COLUMN IF NOT EXISTS created_by_role VARCHAR(100),
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS request_attachment_path TEXT,
    ADD COLUMN IF NOT EXISTS request_attachment_name TEXT,
    ADD COLUMN IF NOT EXISTS request_attachment_mime TEXT,
    ADD COLUMN IF NOT EXISTS rejected_by INTEGER,
    ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
  `);
}

async function generateRequestNo(client) {
  const seq = await client.query(`
    SELECT nextval('public.board_resolution_requests_id_seq') AS n
  `);

  const n = Number(seq.rows[0].n);
  const year = new Date().getFullYear();

  return `BR-${year}-${String(n).padStart(6, "0")}`;
}

router.get(
  "/board-resolution-requests",
  requireAuth,
  requirePermission("board_resolution", "view"),
  async (req, res) => {
    try {
      await ensureTable();

      const r = await pool.query(
        `
        SELECT *
        FROM public.board_resolution_requests
        ORDER BY created_at DESC, id DESC
        `
      );

      return res.json(r.rows);
    } catch (e) {
      console.error("GET /board-resolution-requests ERROR:", e);
      return res.status(500).json({ message: e?.message || "Server error" });
    }
  }
);

router.post(
  "/board-resolution-requests",
  requireAuth,
  requirePermission("board_resolution", "create"),
  upload.single("attachment"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      await ensureTable();
      await client.query("BEGIN");

      const date_created = toStr(req.body?.date_created) || null;
      const to_text = toStr(req.body?.to);
      const thru_text = toStr(req.body?.thru);
      const title = toStr(req.body?.title);
      const details = toStr(req.body?.details);

      if (!title) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Subject is required" });
      }

      if (!to_text) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "To is required" });
      }

      const requestNo = await generateRequestNo(client);

      const requestPath = req.file
        ? `/uploads/board-resolution/${req.file.filename}`
        : null;

      const ins = await client.query(
        `
        INSERT INTO public.board_resolution_requests
        (
          request_no,
          date_created,
          to_text,
          thru_text,
          title,
          details,
          status,
          created_by,
          created_by_role,
          request_attachment_path,
          request_attachment_name,
          request_attachment_mime
        )
        VALUES ($1,$2::date,$3,$4,$5,$6,'Submitted',$7,$8,$9,$10,$11)
        RETURNING *;
        `,
        [
          requestNo,
          date_created,
          to_text,
          thru_text || null,
          title,
          details || null,
          req.user?.id ?? null,
          roleLower(req),
          requestPath,
          req.file?.originalname || null,
          req.file?.mimetype || null,
        ]
      );

      await client.query("COMMIT");
      return res.json(ins.rows[0]);
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("POST /board-resolution-requests ERROR:", e);
      return res.status(500).json({ message: e?.message || "Server error" });
    } finally {
      client.release();
    }
  }
);

router.get(
  "/board-resolution-requests/:id/download",
  requireAuth,
  requirePermission("board_resolution", "view"),
  async (req, res) => {
    try {
      await ensureTable();

      const id = Number(req.params.id);

      if (!Number.isFinite(id)) {
        return res.status(400).json({ message: "Invalid request id" });
      }

      const r = await pool.query(
        `
        SELECT *
        FROM public.board_resolution_requests
        WHERE id = $1
        LIMIT 1
        `,
        [id]
      );

      if (r.rowCount === 0) {
        return res.status(404).json({ message: "Request not found" });
      }

      const row = r.rows[0];

      if (!row.request_attachment_path) {
        return res.status(404).json({ message: "File not found" });
      }

      const rel = String(row.request_attachment_path).replace(/^\/uploads\//, "");
      const absPath = path.join(process.cwd(), "uploads", rel);

      if (!fs.existsSync(absPath)) {
        return res.status(404).json({ message: "Physical file missing" });
      }

      return res.download(
        absPath,
        row.request_attachment_name || path.basename(absPath)
      );
    } catch (e) {
      console.error("DOWNLOAD board-resolution ERROR:", e);
      return res.status(500).json({ message: e?.message || "Server error" });
    }
  }
);

router.put(
  "/board-resolution-requests/:id/reject",
  requireAuth,
  requirePermission("board_resolution", "reject"),
  async (req, res) => {
    try {
      await ensureTable();

      const id = Number(req.params.id);
      const reason = toStr(req.body?.reason || req.body?.rejection_reason);

      if (!Number.isFinite(id)) {
        return res.status(400).json({ message: "Invalid request id" });
      }

      if (!reason) {
        return res.status(400).json({ message: "Rejection reason is required" });
      }

      const r = await pool.query(
        `
        UPDATE public.board_resolution_requests
        SET
          status = 'Rejected',
          rejected_by = $2,
          rejected_at = NOW(),
          rejection_reason = $3
        WHERE id = $1
        RETURNING *
        `,
        [id, req.user?.id ?? null, reason]
      );

      if (r.rowCount === 0) {
        return res.status(404).json({ message: "Request not found" });
      }

      return res.json(r.rows[0]);
    } catch (e) {
      console.error("REJECT board-resolution ERROR:", e);
      return res.status(500).json({ message: e?.message || "Server error" });
    }
  }
);

router.delete(
  "/board-resolution-requests/:id",
  requireAuth,
  requirePermission("board_resolution", "delete"),
  async (req, res) => {
    try {
      await ensureTable();

      const id = Number(req.params.id);

      if (!Number.isFinite(id)) {
        return res.status(400).json({ message: "Invalid request id" });
      }

      const cur = await pool.query(
        `
        SELECT *
        FROM public.board_resolution_requests
        WHERE id = $1
        LIMIT 1
        `,
        [id]
      );

      if (cur.rowCount === 0) {
        return res.status(404).json({ message: "Request not found" });
      }

      const row = cur.rows[0];

      if (!isAdmin(req) && String(row.created_by) !== String(req.user?.id)) {
        return res.status(403).json({
          message: "Only the creator or Admin/IT can delete this request",
        });
      }

      if (row.request_attachment_path) {
        try {
          const rel = String(row.request_attachment_path).replace(/^\/uploads\//, "");
          const absPath = path.join(process.cwd(), "uploads", rel);
          if (fs.existsSync(absPath)) fs.unlinkSync(absPath);
        } catch {}
      }

      await pool.query(
        `
        DELETE FROM public.board_resolution_requests
        WHERE id = $1
        `,
        [id]
      );

      return res.json({ message: "Deleted" });
    } catch (e) {
      console.error("DELETE board-resolution ERROR:", e);
      return res.status(500).json({ message: e?.message || "Server error" });
    }
  }
);

module.exports = router;