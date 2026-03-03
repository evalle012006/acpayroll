const express = require("express");
const router = express.Router();
const pool = require("../db");
const { requireAuth, requireRole } = require("../middlewares/authMiddleware");

const multer = require("multer");
const path = require("path");
const fs = require("fs");

/* ------------------------- Helpers ------------------------- */
const toNum = (v) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const toNumOrNull = (v) => {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
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

const toStr = (v) => String(v ?? "").trim();

const toEmailOrNull = (v) => {
  const s = String(v ?? "").trim();
  if (!s) return null;
  return s; // keep flexible; validate on frontend if you want
};

const buildFullname = ({ last_name, first_name, middle_name, fullname }) => {
  const ln = toStr(last_name);
  const fn = toStr(first_name);
  const mn = toStr(middle_name);

  if (ln || fn || mn) {
    const mid = mn ? ` ${mn}` : "";
    return `${ln}${ln && fn ? ", " : ""}${fn}${mid}`.trim().replace(/\s+/g, " ");
  }

  return toStr(fullname);
};

const roleLower = (req) => String(req.user?.role || "").trim().toLowerCase();
const isAdmin = (req) => roleLower(req) === "admin";
const isBranchManager = (req) => roleLower(req) === "branch manager";
const getUserBranchId = (req) => req.user?.branch_id ?? null;

/* ------------------------- Upload Setup ------------------------- */
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

/* ------------------------- Branches ------------------------- */
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

/* ------------------------- Staff ------------------------- */
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

    const last_name = toStr(body.last_name);
    const first_name = toStr(body.first_name);
    const middle_name = toStr(body.middle_name);

    const fullname = buildFullname({
      last_name,
      first_name,
      middle_name,
      fullname: body.fullname,
    });

    const position = toStr(body.position);

    if (!last_name || !first_name || !position) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "last_name, first_name, and position are required" });
    }

    const staffInsert = await client.query(
      `
      INSERT INTO public.staff
        (employee_no, last_name, first_name, middle_name, fullname,

         address, municipality, province, contact, email,
         date_of_birth, place_of_birth, gender, civil_status, citizenship,
         height, weight, religion, blood_type,

         "position", department, area, region, division, branch_id, status,
         start_date, regularization_date,

         salary, ecola,

         cbu, cashbond, utility_charge,
         transportation, postage, motorcycle_loan,
         additional_target, repairing, additional_monitoring,
         motorcycle, other_deduction)
      VALUES
        ($1,$2,$3,$4,$5,

         $6,$7,$8,$9,$10,
         $11,$12,$13,$14,$15,
         $16,$17,$18,$19,

         $20,$21,$22,$23,$24,
         $25,$26,

         $27,$28,

         $29,$30,$31,
         $32,$33,$34,
         $35,$36,$37,
         $38,$39)
      RETURNING id, fullname, "position";
      `,
      [
        body.employee_no || null,
        last_name,
        first_name,
        middle_name || null,
        fullname,

        toStr(body.address) || null,
        toStr(body.municipality) || null,
        toStr(body.province) || null,
        toStr(body.contact) || null,
        toEmailOrNull(body.email),

        toDateOrNull(body.date_of_birth),
        toStr(body.place_of_birth) || null,
        toStr(body.gender) || null,
        toStr(body.civil_status) || null,
        toStr(body.citizenship) || null,

        toNumOrNull(body.height),
        toNumOrNull(body.weight),
        toStr(body.religion) || null,
        toStr(body.blood_type) || null,

        position,
        body.department || null,
        body.area || null,
        toInt(body.branch_id),
        String(body.status || "Active"),

        toDateOrNull(body.start_date),
        toDateOrNull(body.regularization_date),

        toNumOrNull(body.salary), // allow null if not sent
        toNumOrNull(body.ecola),  // allow null if not sent

        toNum(body.cbu),
        toNum(body.cashbond),
        toNum(body.utility ?? body.utility_charge),

        toNum(body.transportation),
        toNum(body.postage),
        toNum(body.motorcycle_loan),

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
         $4, $5, 0, 0,
         0, 0, 0, 0)
      ON CONFLICT (employee_id)
      DO UPDATE SET
        fullname = EXCLUDED.fullname,
        "position" = EXCLUDED."position",
        cbu = EXCLUDED.cbu,
        cashbond = EXCLUDED.cashbond,
        updated_at = NOW();
      `,
      [s.id, s.fullname, s.position, toNum(body.cbu), toNum(body.cashbond)]
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

    const last_name = toStr(body.last_name);
    const first_name = toStr(body.first_name);
    const middle_name = toStr(body.middle_name);

    const fullname = buildFullname({
      last_name,
      first_name,
      middle_name,
      fullname: body.fullname,
    });

    const position = toStr(body.position);

    if (!last_name || !first_name || !position) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "last_name, first_name, and position are required" });
    }

    const updated = await client.query(
      `
      UPDATE public.staff
      SET
        employee_no=$1,
        last_name=$2,
        first_name=$3,
        middle_name=$4,
        fullname=$5,

        address=$6,
        municipality=$7,
        province=$8,
        contact=$9,
        email=$10,
        date_of_birth=$11,
        place_of_birth=$12,
        gender=$13,
        civil_status=$14,
        citizenship=$15,
        height=$16,
        weight=$17,
        religion=$18,
        blood_type=$19,

        "position"=$20,
        department=$21,
        area=$22,
        branch_id=$23,
        status=$24,

        start_date=$25,
        regularization_date=$26,

        salary=$27,
        ecola=$28,

        cbu=$29,
        cashbond=$30,
        utility_charge=$31,

        transportation=$32,
        postage=$33,
        motorcycle_loan=$34,

        additional_target=$35,
        repairing=$36,
        additional_monitoring=$37,

        motorcycle=$38,
        other_deduction=$39
      WHERE id=$40
      RETURNING id, fullname, "position";
      `,
      [
        body.employee_no || null,
        last_name,
        first_name,
        middle_name || null,
        fullname,

        toStr(body.address) || null,
        toStr(body.municipality) || null,
        toStr(body.province) || null,
        toStr(body.contact) || null,
        toEmailOrNull(body.email),

        toDateOrNull(body.date_of_birth),
        toStr(body.place_of_birth) || null,
        toStr(body.gender) || null,
        toStr(body.civil_status) || null,
        toStr(body.citizenship) || null,

        toNumOrNull(body.height),
        toNumOrNull(body.weight),
        toStr(body.religion) || null,
        toStr(body.blood_type) || null,

        position,
        body.department || null,
        body.area || null,
        toInt(body.branch_id),
        String(body.status || "Active"),

        toDateOrNull(body.start_date),
        toDateOrNull(body.regularization_date),

        toNumOrNull(body.salary),
        toNumOrNull(body.ecola),

        toNum(body.cbu),
        toNum(body.cashbond),
        toNum(body.utility ?? body.utility_charge),

        toNum(body.transportation),
        toNum(body.postage),
        toNum(body.motorcycle_loan),

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
      `
      UPDATE public.staff_balances
      SET
        fullname=$1,
        "position"=$2,
        cbu=$3,
        cashbond=$4,
        updated_at=NOW()
      WHERE employee_id=$5
      `,
      [s.fullname, s.position, toNum(body.cbu), toNum(body.cashbond), s.id]
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