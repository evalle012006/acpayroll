const express = require("express");
const router = express.Router();
const pool = require("../db");
const { requireAuth } = require("../middlewares/authMiddleware");
const { requirePermission } = require("../utils/permissions");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const {
  isAdmin,
  isIT,
  isHr,
  isAccounting,
  isTread,
  isBranchManager,
  isAreaManager,
  isRegionalManager,
  isAssistantVicePresident,
  isVicePresident,
  isSeniorVicePresident,
  isPresident,
} = require("../utils/roleAccess");

const toNum = (v) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const toInt = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

const toStr = (v) => String(v ?? "").trim();

const canViewSettlements = (req) =>
  isAdmin(req) ||
  isIT(req) ||
  isHr(req) ||
  isAccounting(req) ||
  isTread(req) ||
  isBranchManager(req) ||
  isAreaManager(req) ||
  isRegionalManager(req) ||
  isAssistantVicePresident(req) ||
  isVicePresident(req) ||
  isSeniorVicePresident(req) ||
  isPresident(req);

const getUserBranchCode = (req) => toStr(req.user?.branch_id);
const getUserArea = (req) => toStr(req.user?.area);
const getUserRegion = (req) => toStr(req.user?.region);
const getUserDivision = (req) => toStr(req.user?.division);

const uploadDir = path.join(__dirname, "..", "uploads", "settlements");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname || ""));
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 15 * 1024 * 1024,
  },
});

async function getBranchByIdOrCode({ id, code }) {
  if (id) {
    const r = await pool.query(
      `
      SELECT id, code, name
      FROM public.branches
      WHERE id = $1
      LIMIT 1
      `,
      [id]
    );

    if (r.rowCount > 0) return r.rows[0];
  }

  if (code) {
    const r = await pool.query(
      `
      SELECT id, code, name
      FROM public.branches
      WHERE LOWER(TRIM(code)) = LOWER(TRIM($1))
      LIMIT 1
      `,
      [code]
    );

    if (r.rowCount > 0) return r.rows[0];
  }

  return null;
}

router.get(
  "/settlements",
  requireAuth,
  requirePermission("statement_of_account", "view"),
  async (req, res) => {
    try {
      if (!canViewSettlements(req)) {
        return res.status(403).json({ message: "Access denied" });
      }

      if (isBranchManager(req)) {
        const branchCode = getUserBranchCode(req);

        if (!branchCode) return res.json([]);

        const r = await pool.query(
          `
          SELECT *
          FROM public.settlements
          WHERE LOWER(TRIM(COALESCE(settlement_branch_code, ''))) = LOWER(TRIM($1))
          ORDER BY id DESC
          `,
          [branchCode]
        );

        return res.json(r.rows);
      }

      if (isAreaManager(req)) {
        const area = getUserArea(req);

        if (!area) return res.json([]);

        const r = await pool.query(
          `
          SELECT st.*
          FROM public.settlements st
          LEFT JOIN public.staff s ON s.id = st.staff_id
          WHERE LOWER(TRIM(COALESCE(s.area, ''))) = LOWER(TRIM($1))
          ORDER BY st.id DESC
          `,
          [area]
        );

        return res.json(r.rows);
      }

      if (isRegionalManager(req)) {
        const region = getUserRegion(req);

        if (!region) return res.json([]);

        const r = await pool.query(
          `
          SELECT st.*
          FROM public.settlements st
          LEFT JOIN public.staff s ON s.id = st.staff_id
          WHERE LOWER(TRIM(COALESCE(s.region, ''))) = LOWER(TRIM($1))
          ORDER BY st.id DESC
          `,
          [region]
        );

        return res.json(r.rows);
      }

      if (isAssistantVicePresident(req)) {
        const division = getUserDivision(req);

        if (!division) return res.json([]);

        const r = await pool.query(
          `
          SELECT st.*
          FROM public.settlements st
          LEFT JOIN public.staff s ON s.id = st.staff_id
          WHERE LOWER(TRIM(COALESCE(s.division, ''))) = LOWER(TRIM($1))
          ORDER BY st.id DESC
          `,
          [division]
        );

        return res.json(r.rows);
      }

      const r = await pool.query(
        `
        SELECT *
        FROM public.settlements
        ORDER BY id DESC
        `
      );

      return res.json(r.rows);
    } catch (e) {
      console.error("GET /api/settlements FULL ERROR:", e);
      return res.status(500).json({ message: e.message || "Server error" });
    }
  }
);

router.post(
  "/settlements",
  requireAuth,
  requirePermission("statement_of_account", "create"),
  upload.single("attachment"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const staff_id = toInt(req.body?.staff_id);
      const employee_no = toStr(req.body?.employee_no);
      const employee_name = toStr(req.body?.employee_name);
      const prev_branch = toStr(req.body?.prev_branch);

      const settlement_branch_id = toInt(req.body?.settlement_branch_id);
      const settlement_branch_code = toStr(req.body?.settlement_branch_code);

      if (!staff_id) return res.status(400).json({ message: "staff_id is required" });
      if (!employee_no) return res.status(400).json({ message: "employee_no is required" });
      if (!employee_name) return res.status(400).json({ message: "employee_name is required" });

      if (!settlement_branch_id && !settlement_branch_code) {
        return res.status(400).json({ message: "Settlement branch is required" });
      }

      await client.query("BEGIN");

      const branch = await getBranchByIdOrCode({
        id: settlement_branch_id,
        code: settlement_branch_code,
      });

      if (!branch) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Invalid settlement branch" });
      }

      const s = await client.query(
        `
        SELECT first_name, last_name, middle_name
        FROM public.staff
        WHERE id = $1
        LIMIT 1
        `,
        [staff_id]
      );

      if (s.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Invalid staff_id. Staff record not found." });
      }

      const first_name = s.rows[0].first_name || null;
      const last_name = s.rows[0].last_name || null;
      const middle_name = s.rows[0].middle_name || null;

      const cbu = toNum(req.body?.cbu);
      const cashbond = toNum(req.body?.cashbond);
      const utility = toNum(req.body?.utility);
      const thirteenth_month_pay = toNum(req.body?.thirteenth_month_pay);
      const last_pay = toNum(req.body?.last_pay);

      const separation_pay =
        req.body?.separation_pay === "" || req.body?.separation_pay == null
          ? null
          : toNum(req.body?.separation_pay);

      const cash_assistance =
        req.body?.cash_assistance === "" || req.body?.cash_assistance == null
          ? null
          : toNum(req.body?.cash_assistance);

      const liabilities = toNum(req.body?.liabilities);
      const total_benefits = toNum(req.body?.total_benefits);
      const net_settlement = toNum(req.body?.net_settlement);

      const attachment_path = req.file ? `/uploads/settlements/${req.file.filename}` : null;
      const attachment_name = req.file ? req.file.originalname : null;
      const attachment_mime = req.file ? req.file.mimetype : null;

      const r = await client.query(
        `
        INSERT INTO public.settlements (
          staff_id,
          employee_no,
          employee_name,
          prev_branch,

          cbu,
          cashbond,
          utility,
          thirteenth_month_pay,
          last_pay,
          separation_pay,
          cash_assistance,
          liabilities,
          total_benefits,
          net_settlement,

          settlement_branch_id,
          settlement_branch_code,
          settlement_branch_name,

          attachment_path,
          attachment_name,
          attachment_mime,

          created_by,
          last_name,
          first_name,
          middle_name
        )
        VALUES (
          $1,$2,$3,$4,
          $5,$6,$7,$8,$9,$10,$11,$12,$13,$14,
          $15,$16,$17,
          $18,$19,$20,
          $21,$22,$23,$24
        )
        RETURNING *;
        `,
        [
          staff_id,
          employee_no,
          employee_name,
          prev_branch || null,

          cbu,
          cashbond,
          utility,
          thirteenth_month_pay,
          last_pay,
          separation_pay,
          cash_assistance,
          liabilities,
          total_benefits,
          net_settlement,

          branch.id,
          branch.code,
          branch.name,

          attachment_path,
          attachment_name,
          attachment_mime,

          req.user?.id ?? null,
          last_name,
          first_name,
          middle_name,
        ]
      );

      await client.query("COMMIT");
      return res.json(r.rows[0]);
    } catch (e) {
      try {
        await client.query("ROLLBACK");
      } catch {}

      console.error("POST /api/settlements FULL ERROR:", e);
      return res.status(500).json({ message: e.message || "Server error" });
    } finally {
      client.release();
    }
  }
);

router.get(
  "/settlements/:id/download",
  requireAuth,
  requirePermission("statement_of_account", "view"),
  async (req, res) => {
    try {
      const id = toInt(req.params.id);
      if (!id) return res.status(400).json({ message: "Invalid id" });

      const r = await pool.query(
        `
        SELECT
          st.id,
          st.staff_id,
          st.settlement_branch_code,
          st.attachment_path,
          st.attachment_name,
          s.area,
          s.region,
          s.division
        FROM public.settlements st
        LEFT JOIN public.staff s ON s.id = st.staff_id
        WHERE st.id = $1
        LIMIT 1
        `,
        [id]
      );

      if (r.rowCount === 0) {
        return res.status(404).json({ message: "Settlement not found" });
      }

      const row = r.rows[0];

      if (isBranchManager(req)) {
        const branchCode = getUserBranchCode(req);

        if (toStr(row.settlement_branch_code).toLowerCase() !== branchCode.toLowerCase()) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      if (isAreaManager(req)) {
        if (toStr(row.area).toLowerCase() !== getUserArea(req).toLowerCase()) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      if (isRegionalManager(req)) {
        if (toStr(row.region).toLowerCase() !== getUserRegion(req).toLowerCase()) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      if (isAssistantVicePresident(req)) {
        if (toStr(row.division).toLowerCase() !== getUserDivision(req).toLowerCase()) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      if (!row.attachment_path) {
        return res.status(404).json({ message: "No settlement file found" });
      }

      const rel = String(row.attachment_path).replace(/^\/uploads\//, "");
      const filePath = path.join(__dirname, "..", "uploads", rel);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "File not found" });
      }

      return res.download(filePath, row.attachment_name || path.basename(filePath));
    } catch (e) {
      console.error("GET /api/settlements/:id/download FULL ERROR:", e);
      return res.status(500).json({ message: e.message || "Server error" });
    }
  }
);

router.delete(
  "/settlements/:id",
  requireAuth,
  requirePermission("statement_of_account", "delete"),
  async (req, res) => {
    try {
      const id = toInt(req.params.id);
      if (!id) return res.status(400).json({ message: "Invalid id" });

      const r = await pool.query(
        `
        DELETE FROM public.settlements
        WHERE id = $1
        RETURNING id
        `,
        [id]
      );

      if (r.rowCount === 0) return res.status(404).json({ message: "Not found" });

      return res.json({ message: "Deleted", id: r.rows[0].id });
    } catch (e) {
      console.error("DELETE /api/settlements/:id FULL ERROR:", e);
      return res.status(500).json({ message: e.message || "Server error" });
    }
  }
);

module.exports = router;