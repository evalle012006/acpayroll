const express = require("express");
const router = express.Router();
const pool = require("../db");
const { requireAuth, requireRole } = require("../middlewares/authMiddleware");

const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Helpers
// ===============================
const toNum = (v) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const toInt = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

const toDateOrNull = (v) => {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const d = s.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
};

const roleLower = (req) => String(req.user?.role || "").trim().toLowerCase();
const isAdmin = (req) => roleLower(req) === "admin";
const isBranchManager = (req) => roleLower(req) === "branch manager";
const getUserBranchId = (req) => req.user?.branch_id ?? null;

// Upload staff photo
// ===============================
const staffUploadDir = path.join(__dirname, "..", "uploads", "staff");
fs.mkdirSync(staffUploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, staffUploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const safeExt = [".png", ".jpg", ".jpeg", ".webp"].includes(ext) ? ext : ".jpg";
    cb(null, `staff_${Date.now()}_${Math.random().toString(16).slice(2)}${safeExt}`);
  },
});

const upload = multer({ storage, limits: { fileSize: 2 * 1024 * 1024 } });

// BRANCHES
// ===============================
router.get("/branches", requireAuth, async (req, res) => {
  try {
    if (isAdmin(req)) {
      const result = await pool.query("SELECT id, code, name, area FROM public.branches ORDER BY id ASC");
      return res.json(result.rows);
    }

    if (isBranchManager(req)) {
      const bid = getUserBranchId(req);
      if (!bid) return res.json([]);
      const result = await pool.query("SELECT id, code, name, area FROM public.branches WHERE id=$1", [bid]);
      return res.json(result.rows);
    }

    return res.status(403).json({ message: "Access denied" });
  } catch (e) {
    console.error("GET /api/branches ERROR:", e.message);
    return res.status(500).json({ message: "Server error" });
  }
});

router.post("/branches", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const { code, name, area } = req.body;
    if (!code || !name || !area) return res.status(400).json({ message: "code, name, area required" });

    const result = await pool.query(
      `INSERT INTO public.branches (code, name, area)
       VALUES ($1,$2,$3)
       RETURNING id, code, name, area`,
      [code, name, area]
    );

    return res.json({ message: "Branch created", branch: result.rows[0] });
  } catch (e) {
    console.error("POST /api/branches ERROR:", e.message);
    return res.status(500).json({ message: "Server error" });
  }
});

router.put("/branches/:id", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid branch id" });

    const { code, name, area } = req.body;
    if (!code || !name || !area) return res.status(400).json({ message: "code, name, area required" });

    const result = await pool.query(
      `UPDATE public.branches SET code=$1, name=$2, area=$3
       WHERE id=$4
       RETURNING id, code, name, area`,
      [code, name, area, id]
    );

    if (result.rowCount === 0) return res.status(404).json({ message: "Branch not found" });
    return res.json({ message: "Branch updated", branch: result.rows[0] });
  } catch (e) {
    console.error("PUT /api/branches/:id ERROR:", e.message);
    return res.status(500).json({ message: "Server error" });
  }
});

router.delete("/branches/:id", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid branch id" });

    const result = await pool.query("DELETE FROM public.branches WHERE id=$1 RETURNING id", [id]);
    if (result.rowCount === 0) return res.status(404).json({ message: "Branch not found" });

    return res.json({ message: "Branch deleted" });
  } catch (e) {
    console.error("DELETE /api/branches/:id ERROR:", e.message);
    return res.status(500).json({ message: "Server error" });
  }
});

// STAFF
// ===============================
router.get("/staff", requireAuth, async (req, res) => {
  try {
    if (isAdmin(req)) {
      const result = await pool.query("SELECT * FROM public.staff ORDER BY id DESC");
      return res.json(result.rows);
    }

    if (isBranchManager(req)) {
      const bid = getUserBranchId(req);
      if (!bid) return res.json([]);
      const result = await pool.query("SELECT * FROM public.staff WHERE branch_id=$1 ORDER BY id DESC", [bid]);
      return res.json(result.rows);
    }

    return res.status(403).json({ message: "Access denied" });
  } catch (e) {
    console.error("GET /api/staff ERROR:", e.message);
    return res.status(500).json({ message: "Server error" });
  }
});

router.post("/staff", requireAuth, requireRole(["admin"]), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const body = req.body || {};
    const fullname = String(body.fullname || "").trim();
    const position = String(body.position || "").trim();

    if (!fullname || !position) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "fullname and position are required" });
    }

    const staffInsert = await client.query(
      `
      INSERT INTO public.staff
        (employee_no, fullname, "position", department, area,
         salary, ecola, branch_id, regularization_date,
         motorcycle_loan, postage, transportation,
         additional_target, repairing, additional_monitoring,
         motorcycle, other_deduction)
      VALUES
        ($1,$2,$3,$4,$5,
         $6,$7,$8,$9,
         $10,$11,$12,
         $13,$14,$15,
         $16,$17)
      RETURNING id, fullname, "position";
      `,
      [
        body.employee_no || null,
        fullname,
        position,
        body.department || null,
        body.area || null,
        toNum(body.salary),
        toNum(body.ecola),
        toInt(body.branch_id),
        toDateOrNull(body.regularization_date),
        toNum(body.motorcycle_loan),
        toNum(body.postage),
        toNum(body.transportation),
        toNum(body.additional_target),
        toNum(body.repairing),
        toNum(body.additional_monitoring),
        toNum(body.motorcycle),
        toNum(body.other_deduction),
      ]
    );

    const s = staffInsert.rows[0];

    await client.query(
      `
      INSERT INTO public.staff_balances
        (employee_id, fullname, "position",
         cbu, cashbond, salary_advance, motorcycle_loan,
         special_advance, cash_advance, other_receivable, staff_accounts_payable)
      VALUES
        ($1, $2, $3,
         0,0,0,0,
         0,0,0,0)
      ON CONFLICT (employee_id)
      DO UPDATE SET
        fullname = EXCLUDED.fullname,
        "position" = EXCLUDED."position",
        updated_at = NOW();
      `,
      [s.id, s.fullname, s.position]
    );

    await client.query("COMMIT");
    return res.json({ message: "Staff added", id: s.id });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("POST /api/staff ERROR:", e.message);
    return res.status(500).json({ message: e?.message || "Server error" });
  } finally {
    client.release();
  }
});

router.put("/staff/:id", requireAuth, requireRole(["admin"]), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const id = toInt(req.params.id);
    if (!id) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Invalid staff id" });
    }

    const body = req.body || {};
    const fullname = String(body.fullname || "").trim();
    const position = String(body.position || "").trim();
    if (!fullname || !position) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "fullname and position are required" });
    }

    const updated = await client.query(
      `
      UPDATE public.staff
      SET
        employee_no=$1,
        fullname=$2,
        "position"=$3,
        department=$4,
        area=$5,
        salary=$6,
        ecola=$7,
        branch_id=$8,
        regularization_date=$9,
        motorcycle_loan=$10,
        postage=$11,
        transportation=$12,
        additional_target=$13,
        repairing=$14,
        additional_monitoring=$15,
        motorcycle=$16,
        other_deduction=$17
      WHERE id=$18
      RETURNING id, fullname, "position";
      `,
      [
        body.employee_no || null,
        fullname,
        position,
        body.department || null,
        body.area || null,
        toNum(body.salary),
        toNum(body.ecola),
        toInt(body.branch_id),
        toDateOrNull(body.regularization_date),
        toNum(body.motorcycle_loan),
        toNum(body.postage),
        toNum(body.transportation),
        toNum(body.additional_target),
        toNum(body.repairing),
        toNum(body.additional_monitoring),
        toNum(body.motorcycle),
        toNum(body.other_deduction),
        id,
      ]
    );

    if (updated.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Staff not found" });
    }

    const s = updated.rows[0];
    await client.query(
      `UPDATE public.staff_balances SET fullname=$1, "position"=$2, updated_at=NOW() WHERE employee_id=$3`,
      [s.fullname, s.position, s.id]
    );

    await client.query("COMMIT");
    return res.json({ message: "Staff updated" });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("PUT /api/staff/:id ERROR:", e.message);
    return res.status(500).json({ message: e?.message || "Server error" });
  } finally {
    client.release();
  }
});

router.delete("/staff/:id", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid staff id" });

    await pool.query("DELETE FROM public.staff WHERE id=$1", [id]);
    return res.json({ message: "Staff deleted" });
  } catch (e) {
    console.error("DELETE /api/staff/:id ERROR:", e.message);
    return res.status(500).json({ message: "Server error" });
  }
});

// ✅ PHOTO UPLOAD (allow admin + branch manager)
router.post(
  "/staff/:id/photo",
  requireAuth,
  requireRole(["admin", "branch manager"]),
  upload.single("photo"),
  async (req, res) => {
    try {
      const staffId = toInt(req.params.id);
      if (!staffId) return res.status(400).json({ message: "Invalid staff id." });
      if (!req.file) return res.status(400).json({ message: "No file uploaded." });

      // branch manager can only update their staff
      if (isBranchManager(req)) {
        const bid = getUserBranchId(req);
        const check = await pool.query(`SELECT id FROM public.staff WHERE id=$1 AND branch_id=$2`, [staffId, bid]);
        if (check.rowCount === 0) return res.status(403).json({ message: "Access denied" });
      }

      const photoUrl = `/uploads/staff/${req.file.filename}`;
      await pool.query(`UPDATE public.staff SET photo_url=$1 WHERE id=$2`, [photoUrl, staffId]);

      return res.json({ photo_url: photoUrl });
    } catch (e) {
      console.error("POST /api/staff/:id/photo ERROR:", e.message);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

module.exports = router;