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

const normalizeStatus = (v) => {
  const s = String(v ?? "").trim().toLowerCase();
  return s === "inactive" ? "Inactive" : "Active";
};

const roleLower = (req) => String(req.user?.role || "").trim().toLowerCase();
const isAdmin = (req) => roleLower(req) === "admin";
const isBranchManager = (req) => roleLower(req) === "branch manager";
const getUserBranchId = (req) => req.user?.branch_id ?? null;

// branch-manager guard for staff ownership
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

// Upload staff photo (multer)
// ===============================
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

// Upload staff attachments (multer)
// ===============================
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

// BRANCHES
// ===============================
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
    const code = String(req.body?.code || "").trim();
    const name = String(req.body?.name || "").trim();
    const area = String(req.body?.area || "").trim();
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

    const code = String(req.body?.code || "").trim();
    const name = String(req.body?.name || "").trim();
    const area = String(req.body?.area || "").trim();
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

// STAFF
// ===============================
router.get("/staff", requireAuth, async (req, res) => {
  try {
    if (isAdmin(req)) {
      const r = await pool.query(`SELECT * FROM public.staff ORDER BY id DESC`);
      return res.json(r.rows);
    }

    if (isBranchManager(req)) {
      const bid = getUserBranchId(req);
      if (!bid) return res.json([]);
      const r = await pool.query(`SELECT * FROM public.staff WHERE branch_id=$1 ORDER BY id DESC`, [bid]);
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
    const fullname = String(b.fullname || "").trim();
    const position = String(b.position || "").trim();

    if (!fullname || !position) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "fullname and position are required" });
    }

    const ins = await client.query(
      `
      INSERT INTO public.staff (
        employee_no, fullname, "position", department, area, branch_id,
        salary, ecola, transportation, postage, motorcycle_loan,
        additional_target, repairing, additional_monitoring,
        motorcycle, other_deduction,
        regularization_date,
        status
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,
        $7,$8,$9,$10,$11,
        $12,$13,$14,
        $15,$16,
        $17,
        $18
      )
      RETURNING id;
      `,
      [
        b.employee_no || null,
        fullname,
        position,
        b.department || null,
        b.area || null,
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

        toDateOrNull(b.regularization_date),
        normalizeStatus(b.status),
      ]
    );

    const newId = ins.rows[0].id;

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
    const fullname = String(b.fullname || "").trim();
    const position = String(b.position || "").trim();

    if (!fullname || !position) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "fullname and position are required" });
    }

    const upd = await client.query(
      `
      UPDATE public.staff
      SET
        employee_no=$1,
        fullname=$2,
        "position"=$3,
        department=$4,
        area=$5,
        branch_id=$6,

        salary=$7,
        ecola=$8,
        transportation=$9,
        postage=$10,
        motorcycle_loan=$11,

        additional_target=$12,
        repairing=$13,
        additional_monitoring=$14,

        motorcycle=$15,
        other_deduction=$16,

        regularization_date=$17,
        status=$18
      WHERE id=$19
      RETURNING id;
      `,
      [
        b.employee_no || null,
        fullname,
        position,
        b.department || null,
        b.area || null,
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

        toDateOrNull(b.regularization_date),
        normalizeStatus(b.status),
        id,
      ]
    );

    if (upd.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Staff not found" });
    }

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

// STAFF PHOTO UPLOAD
// ===============================
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

// LEAVE REQUESTS
// ===============================
router.get("/leave-requests", requireAuth, async (_req, res) => {
  try {
    const r = await pool.query(`SELECT * FROM public.leave_requests ORDER BY id DESC`);
    return res.json(r.rows);
  } catch (e) {
    console.error("GET /api/leave-requests ERROR:", e.message);
    return res.status(500).json({ message: "Server error" });
  }
});

// LOAN REQUESTS
// ===============================
router.get("/loan-requests", requireAuth, async (_req, res) => {
  try {
    const r = await pool.query(`SELECT * FROM public.loan_requests ORDER BY id DESC`);
    return res.json(r.rows);
  } catch (e) {
    console.error("GET /api/loan-requests ERROR:", e.message);
    return res.status(500).json({ message: "Server error" });
  }
});

// STAFF BALANCES
// ===============================
router.get("/staff-balances", requireAuth, async (_req, res) => {
  try {
    const r = await pool.query(`SELECT * FROM public.staff_balances ORDER BY id DESC`);
    return res.json(r.rows);
  } catch (e) {
    console.error("GET /api/staff-balances ERROR:", e.message);
    return res.status(500).json({ message: "Server error" });
  }
});

// TRANSFER STAFF ORDERS
// ===============================
async function generateTransferOrderNo(client) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const prefix = "TSO";

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

    const orderNo = await generateTransferOrderNo(client);

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

    const reason = String(req.body?.reason || "").trim();
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

// STAFF ATTACHMENTS
// ===============================

// GET /api/staff/:id/attachments
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

// POST /api/staff/:id/attachments  (multipart/form-data: file_name, file)
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

      const fileName = String(req.body?.file_name || "").trim();
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

// DELETE /api/staff/attachments/:id
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

      // delete physical file best effort
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