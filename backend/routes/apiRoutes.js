const express = require("express");
const router = express.Router();
const pool = require("../db");
const { requireAuth, requireRole } = require("../middlewares/authMiddleware");

const multer = require("multer");
const path = require("path");
const fs = require("fs");

/* ------------------------- Helpers ------------------------- */
const toStr = (v) => String(v ?? "").trim();

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

const normalizeStatus = (v) => {
  const s = String(v ?? "").trim().toLowerCase();
  return s === "inactive" ? "Inactive" : "Active";
};

const buildFullname = (b) => {
  const ln = toStr(b?.last_name);
  const fn = toStr(b?.first_name);
  const mn = toStr(b?.middle_name);

  const built = `${ln}${ln && fn ? ", " : ""}${fn}${mn ? ` ${mn}` : ""}`
    .replace(/\s+/g, " ")
    .trim();

  return built || toStr(b?.fullname);
};

const roleLower = (req) => String(req.user?.role || "").trim().toLowerCase();
const isAdmin = (req) => roleLower(req) === "admin";
const isBranchManager = (req) => roleLower(req) === "branch manager";
const getUserBranchId = (req) => req.user?.branch_id ?? null;

/* ------------------------- Branch-manager staff guard ------------------------- */
async function assertStaffInManagersBranch(req, staffId) {
  if (!isBranchManager(req)) return true;
  const bid = getUserBranchId(req);
  if (!bid) return false;

  const check = await pool.query(
    `SELECT id FROM public.staff WHERE id=$1 AND branch_id=$2`,
    [staffId, bid]
  );
  return check.rowCount > 0;
}

/* ------------------------- Upload dirs (multer) ------------------------- */
const staffUploadDir = path.join(__dirname, "..", "uploads", "staff");
fs.mkdirSync(staffUploadDir, { recursive: true });

const photoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, staffUploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const safeExt = [".png", ".jpg", ".jpeg", ".webp"].includes(ext) ? ext : ".jpg";
    cb(null, `staff_${Date.now()}_${Math.random().toString(16).slice(2)}${safeExt}`);
  },
});

const uploadPhoto = multer({
  storage: photoStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
});

const attachUploadDir = path.join(__dirname, "..", "uploads", "staff_attachments");
fs.mkdirSync(attachUploadDir, { recursive: true });

const attachStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, attachUploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase() || ".bin";
    cb(null, `attach_${Date.now()}_${Math.random().toString(16).slice(2)}${ext}`);
  },
});

const uploadAttachment = multer({
  storage: attachStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

/* ===========================================================
   BRANCHES
   =========================================================== */
router.get("/branches", requireAuth, async (req, res) => {
  try {
    if (isAdmin(req)) {
      const r = await pool.query(
        `SELECT id, code, name, area FROM public.branches ORDER BY id ASC`
      );
      return res.json(r.rows);
    }

    if (isBranchManager(req)) {
      const bid = getUserBranchId(req);
      if (!bid) return res.json([]);
      const r = await pool.query(
        `SELECT id, code, name, area FROM public.branches WHERE id=$1`,
        [bid]
      );
      return res.json(r.rows);
    }

    return res.status(403).json({ message: "Access denied" });
  } catch (e) {
    console.error("GET /api/branches ERROR:", e.message);
    return res.status(500).json({ message: "Server error" });
  }
});

router.post("/branches", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const code = toStr(req.body?.code);
    const name = toStr(req.body?.name);
    const area = toStr(req.body?.area);
    if (!code || !name || !area) return res.status(400).json({ message: "code, name, area required" });

    const r = await pool.query(
      `INSERT INTO public.branches (code, name, area)
       VALUES ($1,$2,$3)
       RETURNING id, code, name, area`,
      [code, name, area]
    );

    return res.json({ message: "Branch created", branch: r.rows[0] });
  } catch (e) {
    console.error("POST /api/branches ERROR:", e.message);
    return res.status(500).json({ message: "Server error" });
  }
});

router.put("/branches/:id", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid branch id" });

    const code = toStr(req.body?.code);
    const name = toStr(req.body?.name);
    const area = toStr(req.body?.area);
    if (!code || !name || !area) return res.status(400).json({ message: "code, name, area required" });

    const r = await pool.query(
      `UPDATE public.branches
       SET code=$1, name=$2, area=$3
       WHERE id=$4
       RETURNING id, code, name, area`,
      [code, name, area, id]
    );

    if (r.rowCount === 0) return res.status(404).json({ message: "Branch not found" });
    return res.json({ message: "Branch updated", branch: r.rows[0] });
  } catch (e) {
    console.error("PUT /api/branches/:id ERROR:", e.message);
    return res.status(500).json({ message: "Server error" });
  }
});

router.delete("/branches/:id", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid branch id" });

    const r = await pool.query(`DELETE FROM public.branches WHERE id=$1 RETURNING id`, [id]);
    if (r.rowCount === 0) return res.status(404).json({ message: "Branch not found" });

    return res.json({ message: "Branch deleted" });
  } catch (e) {
    console.error("DELETE /api/branches/:id ERROR:", e.message);
    return res.status(500).json({ message: "Server error" });
  }
});

/* ===========================================================
   STAFF
   - UPDATED for last_name / first_name / middle_name
   - Server computes fullname automatically
   =========================================================== */
router.get("/staff", requireAuth, async (req, res) => {
  try {
    if (isAdmin(req)) {
      const r = await pool.query(`SELECT * FROM public.staff ORDER BY id DESC`);
      return res.json(r.rows);
    }

    if (isBranchManager(req)) {
      const bid = getUserBranchId(req);
      if (!bid) return res.json([]);
      const r = await pool.query(
        `SELECT * FROM public.staff WHERE branch_id=$1 ORDER BY id DESC`,
        [bid]
      );
      return res.json(r.rows);
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

    const b = req.body || {};

    const last_name = toStr(b.last_name);
    const first_name = toStr(b.first_name);
    const middle_name = toStr(b.middle_name);

    const position = toStr(b.position);
    const fullname = buildFullname(b);

    if (!last_name || !first_name || !position) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "last_name, first_name, and position are required" });
    }

    const ins = await client.query(
      `
      INSERT INTO public.staff (
        employee_no,
        last_name, first_name, middle_name,
        fullname,
        address, municipality, province, contact, email,
        date_of_birth, place_of_birth, gender, civil_status, citizenship,
        height, weight, religion, blood_type,

        "position", department, area, branch_id,
        salary, ecola, transportation, postage, motorcycle_loan,
        additional_target, repairing, additional_monitoring,
        motorcycle, other_deduction,

        start_date,
        regularization_date,
        status
      )
      VALUES (
        $1,
        $2,$3,$4,
        $5,
        $6,$7,$8,$9,$10,
        $11,$12,$13,$14,$15,
        $16,$17,$18,$19,

        $20,$21,$22,$23,
        $24,$25,$26,$27,$28,
        $29,$30,$31,
        $32,$33,

        $34,
        $35,
        $36
      )
      RETURNING id;
      `,
      [
        b.employee_no || null,
        last_name,
        first_name,
        middle_name || null,
        fullname,

        toStr(b.address) || null,
        toStr(b.municipality) || null,
        toStr(b.province) || null,
        toStr(b.contact) || null,
        toStr(b.email) || null,

        toDateOrNull(b.date_of_birth),
        toStr(b.place_of_birth) || null,
        toStr(b.gender) || null,
        toStr(b.civil_status) || null,
        toStr(b.citizenship) || null,

        b.height === "" || b.height === null || b.height === undefined ? null : toNum(b.height),
        b.weight === "" || b.weight === null || b.weight === undefined ? null : toNum(b.weight),
        toStr(b.religion) || null,
        toStr(b.blood_type) || null,

        position,
        toStr(b.department) || null,
        toStr(b.area) || null,
        toInt(b.branch_id),

        toNum(b.salary),
        toNum(b.ecola),
        toNum(b.transportation),
        toNum(b.postage),
        toNum(b.motorcycle_loan),

        toNum(b.additional_target),
        toNum(b.repairing),
        toNum(b.additional_monitoring),

        toNum(b.motorcycle),
        toNum(b.other_deduction),

        toDateOrNull(b.start_date),
        toDateOrNull(b.regularization_date),
        normalizeStatus(b.status),
      ]
    );

    const newId = ins.rows[0].id;

    // Keep balances table synced to employee_id + fullname + position
    await client.query(
      `
      INSERT INTO public.staff_balances
        (employee_id, fullname, "position",
         cbu, cashbond, salary_advance, motorcycle_loan,
         special_advance, cash_advance, other_receivable, staff_accounts_payable)
      VALUES
        ($1,$2,$3,0,0,0,0,0,0,0,0)
      ON CONFLICT (employee_id)
      DO UPDATE SET
        fullname=EXCLUDED.fullname,
        "position"=EXCLUDED."position",
        updated_at=NOW()
      `,
      [newId, fullname, position]
    );

    await client.query("COMMIT");
    return res.json({ message: "Staff added", id: newId });
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

    const b = req.body || {};

    const last_name = toStr(b.last_name);
    const first_name = toStr(b.first_name);
    const middle_name = toStr(b.middle_name);

    const position = toStr(b.position);
    const fullname = buildFullname(b);

    if (!last_name || !first_name || !position) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "last_name, first_name, and position are required" });
    }

    const upd = await client.query(
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

        salary=$24,
        ecola=$25,
        transportation=$26,
        postage=$27,
        motorcycle_loan=$28,

        additional_target=$29,
        repairing=$30,
        additional_monitoring=$31,

        motorcycle=$32,
        other_deduction=$33,

        start_date=$34,
        regularization_date=$35,
        status=$36
      WHERE id=$37
      RETURNING id;
      `,
      [
        b.employee_no || null,

        last_name,
        first_name,
        middle_name || null,
        fullname,

        toStr(b.address) || null,
        toStr(b.municipality) || null,
        toStr(b.province) || null,
        toStr(b.contact) || null,
        toStr(b.email) || null,

        toDateOrNull(b.date_of_birth),
        toStr(b.place_of_birth) || null,
        toStr(b.gender) || null,
        toStr(b.civil_status) || null,
        toStr(b.citizenship) || null,

        b.height === "" || b.height === null || b.height === undefined ? null : toNum(b.height),
        b.weight === "" || b.weight === null || b.weight === undefined ? null : toNum(b.weight),
        toStr(b.religion) || null,
        toStr(b.blood_type) || null,

        position,
        toStr(b.department) || null,
        toStr(b.area) || null,
        toInt(b.branch_id),

        toNum(b.salary),
        toNum(b.ecola),
        toNum(b.transportation),
        toNum(b.postage),
        toNum(b.motorcycle_loan),

        toNum(b.additional_target),
        toNum(b.repairing),
        toNum(b.additional_monitoring),

        toNum(b.motorcycle),
        toNum(b.other_deduction),

        toDateOrNull(b.start_date),
        toDateOrNull(b.regularization_date),
        normalizeStatus(b.status),
        id,
      ]
    );

    if (upd.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Staff not found" });
    }

    // keep balances synced
    await client.query(
      `UPDATE public.staff_balances
       SET fullname=$1, "position"=$2, updated_at=NOW()
       WHERE employee_id=$3`,
      [fullname, position, id]
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

    await pool.query(`DELETE FROM public.staff WHERE id=$1`, [id]);
    return res.json({ message: "Staff deleted" });
  } catch (e) {
    console.error("DELETE /api/staff/:id ERROR:", e.message);
    return res.status(500).json({ message: "Server error" });
  }
});

/* ------------------------- STAFF PHOTO UPLOAD ------------------------- */
router.post(
  "/staff/:id/photo",
  requireAuth,
  requireRole(["admin", "branch manager"]),
  uploadPhoto.single("photo"),
  async (req, res) => {
    try {
      const staffId = toInt(req.params.id);
      if (!staffId) return res.status(400).json({ message: "Invalid staff id" });
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });

      const ok = await assertStaffInManagersBranch(req, staffId);
      if (!ok) return res.status(403).json({ message: "Access denied" });

      const photoUrl = `/uploads/staff/${req.file.filename}`;
      await pool.query(`UPDATE public.staff SET photo_url=$1 WHERE id=$2`, [photoUrl, staffId]);

      return res.json({ photo_url: photoUrl });
    } catch (e) {
      console.error("POST /api/staff/:id/photo ERROR:", e.message);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

/* ===========================================================
   LEAVE / LOAN / BALANCES (used by Dashboard + Salary)
   =========================================================== */
router.get("/leave-requests", requireAuth, async (_req, res) => {
  try {
    const r = await pool.query(`SELECT * FROM public.leave_requests ORDER BY id DESC`);
    return res.json(r.rows);
  } catch (e) {
    console.error("GET /api/leave-requests ERROR:", e.message);
    return res.status(500).json({ message: e?.message || "Server error" });
  }
});

router.get("/leave-requests/staff/:id", requireAuth, async (req, res) => {
  try {
    const staffId = Number(req.params.id);
    if (!Number.isFinite(staffId) || staffId <= 0) {
      return res.status(400).json({ message: "Invalid staff id" });
    }

    const r = await pool.query(
      `SELECT *
       FROM public.leave_requests
       WHERE employee_id = $1
       ORDER BY id DESC`,
      [staffId]
    );

    return res.json(r.rows);
  } catch (e) {
    console.error("GET /api/leave-requests/staff/:id ERROR:", e.message);
    return res.status(500).json({ message: "Server error" });
  }
});

router.get("/loan-requests", requireAuth, async (_req, res) => {
  try {
    const r = await pool.query(`SELECT * FROM public.loan_requests ORDER BY id DESC`);
    return res.json(r.rows);
  } catch (e) {
    console.error("GET /api/loan-requests ERROR:", e.message);
    return res.status(500).json({ message: "Server error" });
  }
});

router.get("/staff-balances", requireAuth, async (_req, res) => {
  try {
    const r = await pool.query(`SELECT * FROM public.staff_balances ORDER BY id DESC`);
    return res.json(r.rows);
  } catch (e) {
    console.error("GET /api/staff-balances ERROR:", e.message);
    return res.status(500).json({ message: "Server error" });
  }
});

/* ===========================================================
   ORDER NUMBER GENERATOR
   =========================================================== */
async function generateOrderNo(client, prefix) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  await client.query(
    `
    INSERT INTO public.order_sequences(prefix, year, month, next_value)
    VALUES ($1,$2,$3,1)
    ON CONFLICT (prefix, year, month) DO NOTHING
    `,
    [prefix, year, month]
  );

  const seq = await client.query(
    `
    SELECT next_value
    FROM public.order_sequences
    WHERE prefix=$1 AND year=$2 AND month=$3
    FOR UPDATE
    `,
    [prefix, year, month]
  );

  const nextVal = Number(seq.rows[0].next_value);

  await client.query(
    `
    UPDATE public.order_sequences
    SET next_value = next_value + 1
    WHERE prefix=$1 AND year=$2 AND month=$3
    `,
    [prefix, year, month]
  );

  const mm = String(month).padStart(2, "0");
  const nnnn = String(nextVal).padStart(4, "0");
  return `${prefix}-${year}-${mm}-${nnnn}`;
}

/* ===========================================================
   PROMOTION / DEMOTION / SUSPENSION / EXIT / TRANSFER
   (same behavior as your file)
   =========================================================== */

/* -------- PROMOTION ORDERS -------- */
router.get("/promotion-orders", requireAuth, async (req, res) => {
  try {
    const role = roleLower(req);
    const branchId = getUserBranchId(req);

    if (role === "admin") {
      const r = await pool.query(`SELECT * FROM public.promotion_orders ORDER BY created_at DESC`);
      return res.json(r.rows);
    }

    if (role === "branch manager") {
      const r = await pool.query(
        `
        SELECT po.*
        FROM public.promotion_orders po
        JOIN public.staff s ON s.id = po.employee_id
        WHERE s.branch_id = $1
        ORDER BY po.created_at DESC
        `,
        [branchId]
      );
      return res.json(r.rows);
    }

    return res.status(403).json({ message: "Access denied" });
  } catch (e) {
    console.error("GET /api/promotion-orders ERROR:", e.message);
    return res.status(500).json({ message: "Server error" });
  }
});

router.post("/promotion-orders", requireAuth, requireRole(["admin", "branch manager"]), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { employee_id, employee_name, new_position, new_salary, effective_date, remarks } = req.body || {};

    const empId = toInt(employee_id);
    if (!empId) return res.status(400).json({ message: "Employee required" });

    const eff = toDateOrNull(effective_date);
    if (!eff) return res.status(400).json({ message: "Effective date required" });

    const np = toStr(new_position);
    if (!np) return res.status(400).json({ message: "New position required" });

    const s = await client.query(
      `SELECT id, fullname, "position", salary, branch_id FROM public.staff WHERE id=$1`,
      [empId]
    );
    if (s.rowCount === 0) return res.status(404).json({ message: "Staff not found" });

    const staffRow = s.rows[0];

    if (isBranchManager(req)) {
      const bid = getUserBranchId(req);
      if (!bid || Number(staffRow.branch_id) !== Number(bid)) {
        await client.query("ROLLBACK");
        return res.status(403).json({ message: "Access denied" });
      }
    }

    const orderNo = await generateOrderNo(client, "PRO");

    const ins = await client.query(
      `
      INSERT INTO public.promotion_orders
        (order_no, employee_id, employee_name,
         prev_position, new_position,
         prev_salary, new_salary,
         effective_date, date_created, remarks,
         status, created_by)
      VALUES
        ($1,$2,$3,
         $4,$5,
         $6,$7,
         $8::date, CURRENT_DATE, $9,
         'Pending', $10)
      RETURNING *;
      `,
      [
        orderNo,
        empId,
        toStr(employee_name) || toStr(staffRow.fullname),
        toStr(staffRow.position || ""),
        np,
        toNum(staffRow.salary),
        toNum(new_salary),
        eff,
        toStr(remarks) || "",
        req.user?.id ?? null,
      ]
    );

    await client.query("COMMIT");
    return res.json(ins.rows[0]);
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("POST /api/promotion-orders ERROR:", e.message);
    return res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
});

router.put("/promotion-orders/:id/approve", requireAuth, requireRole(["admin"]), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });

    const r = await client.query(
      `
      UPDATE public.promotion_orders
      SET
        status='Approved',
        approved_by=$2,
        approved_at=COALESCE(approved_at, NOW()),
        rejected_by=NULL,
        rejected_at=NULL,
        rejection_reason=NULL
      WHERE id=$1 AND status='Pending'
      RETURNING *;
      `,
      [id, req.user?.id ?? null]
    );

    if (r.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Order not found or not Pending" });
    }

    const order = r.rows[0];

    await client.query(
      `
      UPDATE public.staff
      SET "position"=$1,
          salary=$2
      WHERE id=$3
      `,
      [order.new_position, toNum(order.new_salary), order.employee_id]
    );

    // also keep staff_balances position synced
    await client.query(
      `UPDATE public.staff_balances SET "position"=$1, updated_at=NOW() WHERE employee_id=$2`,
      [order.new_position, order.employee_id]
    );

    await client.query("COMMIT");
    return res.json(order);
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("PUT /api/promotion-orders/:id/approve ERROR:", e.message);
    return res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
});

router.put("/promotion-orders/:id/reject", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });

    const reason = toStr(req.body?.reason);
    if (!reason) return res.status(400).json({ message: "Rejection reason is required" });

    const r = await pool.query(
      `
      UPDATE public.promotion_orders
      SET
        status='Rejected',
        rejected_by=$2,
        rejected_at=COALESCE(rejected_at, NOW()),
        rejection_reason=$3,
        approved_by=NULL,
        approved_at=NULL
      WHERE id=$1 AND status='Pending'
      RETURNING *;
      `,
      [id, req.user?.id ?? null, reason]
    );

    if (r.rowCount === 0) return res.status(400).json({ message: "Order not found or not Pending" });
    return res.json(r.rows[0]);
  } catch (e) {
    console.error("PUT /api/promotion-orders/:id/reject ERROR:", e.message);
    return res.status(500).json({ message: "Server error" });
  }
});

/* -------- DEMOTION ORDERS -------- */
router.get("/demotion-orders", requireAuth, async (req, res) => {
  try {
    const role = roleLower(req);
    if (role !== "admin" && role !== "branch manager") {
      return res.status(403).json({ message: "Access denied" });
    }

    const r = await pool.query(`SELECT * FROM public.demotion_orders ORDER BY created_at DESC`);
    return res.json(r.rows);
  } catch (e) {
    console.error("GET /api/demotion-orders ERROR:", e.message);
    return res.status(500).json({ message: "Server error" });
  }
});

router.post("/demotion-orders", requireAuth, requireRole(["admin", "branch manager"]), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { employee_id, employee_name, old_position, new_position, effective_date, details } = req.body || {};

    if (!employee_id || !employee_name) return res.status(400).json({ message: "Employee required" });
    if (!new_position) return res.status(400).json({ message: "New position required" });
    if (!effective_date) return res.status(400).json({ message: "Effective date required" });

    const orderNo = await generateOrderNo(client, "DMO");

    const r = await client.query(
      `
      INSERT INTO public.demotion_orders
        (order_no, employee_id, employee_name, old_position, new_position, effective_date, details, status, created_by)
      VALUES
        ($1,$2,$3,$4,$5,$6::date,$7,'Pending',$8)
      RETURNING *;
      `,
      [
        orderNo,
        Number(employee_id),
        String(employee_name),
        old_position ? String(old_position) : null,
        String(new_position),
        String(effective_date).slice(0, 10),
        details ? String(details) : null,
        req.user?.id ?? null,
      ]
    );

    await client.query("COMMIT");
    return res.json(r.rows[0]);
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("POST /api/demotion-orders ERROR:", e.message);
    return res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
});

router.put("/demotion-orders/:id/approve", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });

    const r = await pool.query(
      `
      UPDATE public.demotion_orders
      SET
        status='Approved',
        approved_by=$2,
        approved_at=COALESCE(approved_at, NOW()),
        rejected_by=NULL,
        rejected_at=NULL,
        rejection_reason=NULL
      WHERE id=$1 AND status='Pending'
      RETURNING *;
      `,
      [id, req.user?.id ?? null]
    );

    if (r.rowCount === 0) return res.status(400).json({ message: "Order not found or not Pending" });
    return res.json(r.rows[0]);
  } catch (e) {
    console.error("PUT /api/demotion-orders/:id/approve ERROR:", e.message);
    return res.status(500).json({ message: "Server error" });
  }
});

router.put("/demotion-orders/:id/reject", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });

    const reason = toStr(req.body?.reason);
    if (!reason) return res.status(400).json({ message: "Rejection reason is required" });

    const r = await pool.query(
      `
      UPDATE public.demotion_orders
      SET
        status='Rejected',
        rejected_by=$2,
        rejected_at=COALESCE(rejected_at, NOW()),
        rejection_reason=$3,
        approved_by=NULL,
        approved_at=NULL
      WHERE id=$1 AND status='Pending'
      RETURNING *;
      `,
      [id, req.user?.id ?? null, reason]
    );

    if (r.rowCount === 0) return res.status(400).json({ message: "Order not found or not Pending" });
    return res.json(r.rows[0]);
  } catch (e) {
    console.error("PUT /api/demotion-orders/:id/reject ERROR:", e.message);
    return res.status(500).json({ message: "Server error" });
  }
});

/* -------- SUSPENSION ORDERS -------- */
router.get("/suspension-orders", requireAuth, async (req, res) => {
  try {
    const role = roleLower(req);
    if (role !== "admin" && role !== "branch manager") {
      return res.status(403).json({ message: "Access denied" });
    }

    const r = await pool.query(`SELECT * FROM public.suspension_orders ORDER BY created_at DESC`);
    return res.json(r.rows);
  } catch (e) {
    console.error("GET /api/suspension-orders ERROR:", e.message);
    return res.status(500).json({ message: "Server error" });
  }
});

router.post("/suspension-orders", requireAuth, requireRole(["admin", "branch manager"]), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { employee_id, employee_name, reason, start_date, end_date, details } = req.body || {};

    if (!employee_id || !employee_name) return res.status(400).json({ message: "Employee required" });
    if (!reason) return res.status(400).json({ message: "Reason required" });
    if (!start_date || !end_date) return res.status(400).json({ message: "Start/End date required" });

    const orderNo = await generateOrderNo(client, "SUS");

    const r = await client.query(
      `
      INSERT INTO public.suspension_orders
        (order_no, employee_id, employee_name, reason, start_date, end_date, details, status, created_by)
      VALUES
        ($1,$2,$3,$4,$5::date,$6::date,$7,'Pending',$8)
      RETURNING *;
      `,
      [
        orderNo,
        Number(employee_id),
        String(employee_name),
        String(reason),
        String(start_date).slice(0, 10),
        String(end_date).slice(0, 10),
        details ? String(details) : null,
        req.user?.id ?? null,
      ]
    );

    await client.query("COMMIT");
    return res.json(r.rows[0]);
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("POST /api/suspension-orders ERROR:", e.message);
    return res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
});

router.put("/suspension-orders/:id/approve", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });

    const r = await pool.query(
      `
      UPDATE public.suspension_orders
      SET
        status='Approved',
        approved_by=$2,
        approved_at=COALESCE(approved_at, NOW()),
        rejected_by=NULL,
        rejected_at=NULL,
        rejection_reason=NULL
      WHERE id=$1 AND status='Pending'
      RETURNING *;
      `,
      [id, req.user?.id ?? null]
    );

    if (r.rowCount === 0) return res.status(400).json({ message: "Order not found or not Pending" });
    return res.json(r.rows[0]);
  } catch (e) {
    console.error("PUT /api/suspension-orders/:id/approve ERROR:", e.message);
    return res.status(500).json({ message: "Server error" });
  }
});

router.put("/suspension-orders/:id/reject", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });

    const reason = toStr(req.body?.reason);
    if (!reason) return res.status(400).json({ message: "Rejection reason is required" });

    const r = await pool.query(
      `
      UPDATE public.suspension_orders
      SET
        status='Rejected',
        rejected_by=$2,
        rejected_at=COALESCE(rejected_at, NOW()),
        rejection_reason=$3,
        approved_by=NULL,
        approved_at=NULL
      WHERE id=$1 AND status='Pending'
      RETURNING *;
      `,
      [id, req.user?.id ?? null, reason]
    );

    if (r.rowCount === 0) return res.status(400).json({ message: "Order not found or not Pending" });
    return res.json(r.rows[0]);
  } catch (e) {
    console.error("PUT /api/suspension-orders/:id/reject ERROR:", e.message);
    return res.status(500).json({ message: "Server error" });
  }
});

/* -------- EXIT STAFF ORDERS -------- */
router.get("/exit-staff-orders", requireAuth, async (req, res) => {
  try {
    const role = roleLower(req);
    const branchId = getUserBranchId(req);

    if (role === "admin") {
      const r = await pool.query(`SELECT * FROM public.exit_staff_orders ORDER BY created_at DESC`);
      return res.json(r.rows);
    }

    if (role === "branch manager") {
      const r = await pool.query(
        `
        SELECT *
        FROM public.exit_staff_orders
        WHERE branch_id = $1
        ORDER BY created_at DESC
        `,
        [branchId]
      );
      return res.json(r.rows);
    }

    return res.status(403).json({ message: "Access denied" });
  } catch (e) {
    console.error("GET /api/exit-staff-orders ERROR:", e.message);
    return res.status(500).json({ message: "Server error" });
  }
});

router.post("/exit-staff-orders", requireAuth, requireRole(["admin", "branch manager"]), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const b = req.body || {};
    const employee_id = toInt(b.employee_id);
    const exit_type = toStr(b.exit_type);
    const effective_date = toDateOrNull(b.effective_date);
    const remarks = toStr(b.remarks);

    if (!employee_id) return res.status(400).json({ message: "Employee required" });
    if (!["Resign", "AWOL", "Termination"].includes(exit_type)) {
      return res.status(400).json({ message: "Exit type must be Resign, AWOL, or Termination" });
    }
    if (!effective_date) return res.status(400).json({ message: "Effective date required" });

    const s = await client.query(
      `
      SELECT
        s.id,
        s.fullname,
        s.branch_id,
        br.code AS branch_code,
        br.name AS branch_name
      FROM public.staff s
      LEFT JOIN public.branches br ON br.id = s.branch_id
      WHERE s.id = $1
      `,
      [employee_id]
    );

    if (s.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Staff not found" });
    }

    const staffRow = s.rows[0];

    if (isBranchManager(req)) {
      const bid = getUserBranchId(req);
      if (!bid || Number(staffRow.branch_id) !== Number(bid)) {
        await client.query("ROLLBACK");
        return res.status(403).json({ message: "Access denied" });
      }
    }

    const orderNo = await generateOrderNo(client, "EXIT");

    const ins = await client.query(
      `
      INSERT INTO public.exit_staff_orders
        (order_no, employee_id, employee_name,
         branch_id, branch_code, branch_name,
         exit_type, effective_date, remarks,
         status, created_by)
      VALUES
        ($1,$2,$3,
         $4,$5,$6,
         $7,$8::date,$9,
         'Pending',$10)
      RETURNING *;
      `,
      [
        orderNo,
        employee_id,
        String(staffRow.fullname || ""),
        staffRow.branch_id ? Number(staffRow.branch_id) : null,
        String(staffRow.branch_code || ""),
        String(staffRow.branch_name || ""),
        exit_type,
        effective_date,
        remarks || null,
        req.user?.id ?? null,
      ]
    );

    await client.query("COMMIT");
    return res.json(ins.rows[0]);
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("POST /api/exit-staff-orders ERROR:", e.message);
    return res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
});

router.put("/exit-staff-orders/:id/approve", requireAuth, requireRole(["admin"]), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });

    const r = await client.query(
      `
      UPDATE public.exit_staff_orders
      SET
        status='Approved',
        approved_by=$2,
        approved_at=COALESCE(approved_at, NOW()),
        rejected_by=NULL,
        rejected_at=NULL,
        rejection_reason=NULL
      WHERE id=$1 AND status='Pending'
      RETURNING *;
      `,
      [id, req.user?.id ?? null]
    );

    if (r.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Order not found or not Pending" });
    }

    const order = r.rows[0];

    await client.query(`UPDATE public.staff SET status='Inactive' WHERE id=$1`, [order.employee_id]);

    await client.query("COMMIT");
    return res.json(order);
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("PUT /api/exit-staff-orders/:id/approve ERROR:", e.message);
    return res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
});

router.put("/exit-staff-orders/:id/reject", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });

    const reason = toStr(req.body?.reason);
    if (!reason) return res.status(400).json({ message: "Rejection reason is required" });

    const r = await pool.query(
      `
      UPDATE public.exit_staff_orders
      SET
        status='Rejected',
        rejected_by=$2,
        rejected_at=COALESCE(rejected_at, NOW()),
        rejection_reason=$3,
        approved_by=NULL,
        approved_at=NULL
      WHERE id=$1 AND status='Pending'
      RETURNING *;
      `,
      [id, req.user?.id ?? null, reason]
    );

    if (r.rowCount === 0) return res.status(400).json({ message: "Order not found or not Pending" });
    return res.json(r.rows[0]);
  } catch (e) {
    console.error("PUT /api/exit-staff-orders/:id/reject ERROR:", e.message);
    return res.status(500).json({ message: "Server error" });
  }
});

/* -------- TRANSFER STAFF ORDERS -------- */
router.get("/transfer-staff-orders", requireAuth, async (req, res) => {
  try {
    const role = roleLower(req);
    const branchId = getUserBranchId(req);

    if (role === "admin") {
      const r = await pool.query(`SELECT * FROM public.transfer_staff_orders ORDER BY created_at DESC`);
      return res.json(r.rows);
    }

    if (role === "branch manager") {
      const r = await pool.query(
        `
        SELECT *
        FROM public.transfer_staff_orders
        WHERE prev_branch_id = $1
        ORDER BY created_at DESC
        `,
        [branchId]
      );
      return res.json(r.rows);
    }

    return res.status(403).json({ message: "Access denied" });
  } catch (e) {
    console.error("GET /api/transfer-staff-orders ERROR:", e.message);
    return res.status(500).json({ message: "Server error" });
  }
});

router.post("/transfer-staff-orders", requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const b = req.body || {};
    const {
      employee_id,
      employee_name,
      prev_branch_id,
      prev_branch_code,
      prev_branch_name,
      to_branch_id,
      to_branch_code,
      to_branch_name,
      area,
      division,
      date_created,
      effective_date,
      details,
    } = b;

    if (!employee_id || !employee_name) return res.status(400).json({ message: "Employee required" });
    if (!prev_branch_id || !to_branch_id) return res.status(400).json({ message: "Branches required" });
    if (Number(prev_branch_id) === Number(to_branch_id)) return res.status(400).json({ message: "Branches must differ" });
    if (!area || !division) return res.status(400).json({ message: "Area and Division required" });
    if (!date_created || !effective_date) return res.status(400).json({ message: "Dates required" });
    if (!details) return res.status(400).json({ message: "Details required" });

    if (isBranchManager(req)) {
      const bid = getUserBranchId(req);
      if (!bid || Number(bid) !== Number(prev_branch_id)) {
        await client.query("ROLLBACK");
        return res.status(403).json({ message: "Access denied" });
      }
    }

    const orderNo = await generateOrderNo(client, "TSO");

    const ins = await client.query(
      `
      INSERT INTO public.transfer_staff_orders
        (order_no, employee_id, employee_name,
         prev_branch_id, prev_branch_code, prev_branch_name,
         to_branch_id, to_branch_code, to_branch_name,
         area, division, date_created, effective_date, details,
         status, created_by)
      VALUES
        ($1,$2,$3,
         $4,$5,$6,
         $7,$8,$9,
         $10,$11,$12::date,$13::date,$14,
         'Pending',$15)
      RETURNING *;
      `,
      [
        orderNo,
        Number(employee_id),
        String(employee_name),
        Number(prev_branch_id),
        String(prev_branch_code || ""),
        String(prev_branch_name || ""),
        Number(to_branch_id),
        String(to_branch_code || ""),
        String(to_branch_name || ""),
        String(area),
        String(division),
        String(date_created).slice(0, 10),
        String(effective_date).slice(0, 10),
        String(details),
        req.user?.id ?? null,
      ]
    );

    await client.query("COMMIT");
    return res.json(ins.rows[0]);
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("POST /api/transfer-staff-orders ERROR:", e.message);
    return res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
});

router.put("/transfer-staff-orders/:id/approve", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });

    const r = await pool.query(
      `
      UPDATE public.transfer_staff_orders
      SET
        status='Approved',
        approved_by=$2,
        approved_at=COALESCE(approved_at, NOW()),
        rejected_by=NULL,
        rejected_at=NULL,
        rejection_reason=NULL
      WHERE id=$1 AND status='Pending'
      RETURNING *;
      `,
      [id, req.user?.id ?? null]
    );

    if (r.rowCount === 0) return res.status(400).json({ message: "Order not found or not Pending" });
    return res.json(r.rows[0]);
  } catch (e) {
    console.error("PUT /api/transfer-staff-orders/:id/approve ERROR:", e.message);
    return res.status(500).json({ message: "Server error" });
  }
});

router.put("/transfer-staff-orders/:id/reject", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });

    const reason = toStr(req.body?.reason);
    if (!reason) return res.status(400).json({ message: "Rejection reason is required" });

    const r = await pool.query(
      `
      UPDATE public.transfer_staff_orders
      SET
        status='Rejected',
        rejected_by=$2,
        rejected_at=COALESCE(rejected_at, NOW()),
        rejection_reason=$3,
        approved_by=NULL,
        approved_at=NULL
      WHERE id=$1 AND status='Pending'
      RETURNING *;
      `,
      [id, req.user?.id ?? null, reason]
    );

    if (r.rowCount === 0) return res.status(400).json({ message: "Order not found or not Pending" });
    return res.json(r.rows[0]);
  } catch (e) {
    console.error("PUT /api/transfer-staff-orders/:id/reject ERROR:", e.message);
    return res.status(500).json({ message: "Server error" });
  }
});

/* ===========================================================
   STAFF ATTACHMENTS
   =========================================================== */
router.get("/staff/:id/attachments", requireAuth, async (req, res) => {
  try {
    const staffId = toInt(req.params.id);
    if (!staffId) return res.status(400).json({ message: "Invalid staff id" });

    const ok = await assertStaffInManagersBranch(req, staffId);
    if (!ok) return res.status(403).json({ message: "Access denied" });

    const r = await pool.query(
      `
      SELECT id, staff_id, file_name, original_name, file_url, uploaded_at
      FROM public.staff_attachments
      WHERE staff_id=$1
      ORDER BY uploaded_at DESC
      `,
      [staffId]
    );

    return res.json(r.rows);
  } catch (e) {
    console.error("GET /api/staff/:id/attachments ERROR:", e.message);
    return res.status(500).json({ message: "Server error" });
  }
});

router.post(
  "/staff/:id/attachments",
  requireAuth,
  requireRole(["admin", "branch manager"]),
  uploadAttachment.single("file"),
  async (req, res) => {
    try {
      const staffId = toInt(req.params.id);
      if (!staffId) return res.status(400).json({ message: "Invalid staff id" });
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });

      const ok = await assertStaffInManagersBranch(req, staffId);
      if (!ok) return res.status(403).json({ message: "Access denied" });

      const fileName = toStr(req.body?.file_name);
      if (!fileName) return res.status(400).json({ message: "File name required" });

      const fileUrl = `/uploads/staff_attachments/${req.file.filename}`;
      const originalName = req.file.originalname || req.file.filename;

      const r = await pool.query(
        `
        INSERT INTO public.staff_attachments
          (staff_id, file_name, original_name, file_url, uploaded_by)
        VALUES ($1,$2,$3,$4,$5)
        RETURNING id, staff_id, file_name, original_name, file_url, uploaded_at
        `,
        [staffId, fileName, originalName, fileUrl, req.user?.id ?? null]
      );

      return res.json(r.rows[0]);
    } catch (e) {
      console.error("POST /api/staff/:id/attachments ERROR:", e.message);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

router.delete(
  "/staff/attachments/:id",
  requireAuth,
  requireRole(["admin", "branch manager"]),
  async (req, res) => {
    const client = await pool.connect();
    try {
      const id = toInt(req.params.id);
      if (!id) return res.status(400).json({ message: "Invalid attachment id" });

      await client.query("BEGIN");

      const found = await client.query(
        `SELECT id, staff_id, file_url FROM public.staff_attachments WHERE id=$1`,
        [id]
      );

      if (found.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Not found" });
      }

      const att = found.rows[0];

      const ok = await assertStaffInManagersBranch(req, att.staff_id);
      if (!ok) {
        await client.query("ROLLBACK");
        return res.status(403).json({ message: "Access denied" });
      }

      await client.query(`DELETE FROM public.staff_attachments WHERE id=$1`, [id]);
      await client.query("COMMIT");

      try {
        const absolute = path.join(__dirname, "..", att.file_url.replace("/uploads/", "uploads/"));
        fs.unlinkSync(absolute);
      } catch {
        // ignore
      }

      return res.json({ message: "Deleted" });
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("DELETE /api/staff/attachments/:id ERROR:", e.message);
      return res.status(500).json({ message: "Server error" });
    } finally {
      client.release();
    }
  }
);

module.exports = router;