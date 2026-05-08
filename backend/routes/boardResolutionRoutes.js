const express = require("express");
const router = express.Router();
const pool = require("../db");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { requireAuth } = require("../middlewares/authMiddleware");

const toStr = (v) => String(v ?? "").trim();
const norm = (v) => toStr(v).toLowerCase();

const roleLower = (req) => norm(req.user?.role);

const isAdmin = (req) => ["admin", "it"].includes(roleLower(req));
const isIT = (req) => roleLower(req) === "it";
const isHr = (req) => roleLower(req) === "hr";
const isAccounting = (req) => roleLower(req) === "accounting";
const isRegionalManager = (req) => roleLower(req) === "regional manager";
const isAssistantVicePresident = (req) =>
  roleLower(req) === "assistant vice president";
const isVicePresident = (req) => roleLower(req) === "vice president";
const isSeniorVicePresident = (req) => roleLower(req) === "senior vice president";
const isPresident = (req) => roleLower(req) === "president";

const canCreate = (req) =>
  isRegionalManager(req) ||
  isAssistantVicePresident(req) ||
  isAdmin(req) ||
  isIT(req);

const canViewAll = (req) =>
  isAdmin(req) ||
  isIT(req) ||
  isHr(req) ||
  isAccounting(req) ||
  isVicePresident(req) ||
  isSeniorVicePresident(req) ||
  isPresident(req);

const canDeleteRow = (req, row) =>
  String(row.created_by) === String(req.user?.id) || isAdmin(req);

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

router.get("/board-resolution-requests", requireAuth, async (req, res) => {
  try {
    await ensureTable();

    if (canViewAll(req)) {
      const r = await pool.query(`
        SELECT *
        FROM public.board_resolution_requests
        ORDER BY created_at DESC, id DESC
      `);

      return res.json(r.rows);
    }

    if (isRegionalManager(req)) {
      const r = await pool.query(
        `
        SELECT *
        FROM public.board_resolution_requests
        WHERE created_by = $1
        ORDER BY created_at DESC, id DESC
        `,
        [req.user?.id ?? null]
      );

      return res.json(r.rows);
    }

    return res.status(403).json({ message: "Access denied" });
  } catch (e) {
    console.error("GET /board-resolution-requests ERROR:", e);
    return res.status(500).json({ message: e?.message || "Server error" });
  }
});

router.post(
  "/board-resolution-requests",
  requireAuth,
  upload.single("attachment"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      await ensureTable();

      if (!canCreate(req)) {
        return res.status(403).json({
          message: "Only Regional Manager can create board resolution requests",
        });
      }

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

router.get("/board-resolution-requests/:id/download", requireAuth, async (req, res) => {
  try {
    await ensureTable();

    const id = Number(req.params.id);

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

    const allowed =
      canViewAll(req) ||
      String(row.created_by) === String(req.user?.id);

    if (!allowed) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (!row.request_attachment_path) {
      return res.status(404).json({ message: "File not found" });
    }

    const rel = String(row.request_attachment_path).replace(/^\/uploads\//, "");
    const absPath = path.join(process.cwd(), "uploads", rel);

    if (!fs.existsSync(absPath)) {
      return res.status(404).json({ message: "Physical file missing" });
    }

    return res.download(absPath, row.request_attachment_name || path.basename(absPath));
  } catch (e) {
    console.error("DOWNLOAD board-resolution ERROR:", e);
    return res.status(500).json({ message: e?.message || "Server error" });
  }
});

router.delete("/board-resolution-requests/:id", requireAuth, async (req, res) => {
  try {
    await ensureTable();

    const id = Number(req.params.id);

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

    if (!canDeleteRow(req, row)) {
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
});

module.exports = router;