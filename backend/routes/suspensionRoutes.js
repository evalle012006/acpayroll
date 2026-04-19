const express = require("express");
const router = express.Router();
const pool = require("../db");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { requireAuth, requireRole } = require("../middlewares/authMiddleware");

const toInt = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

const toNum = (v) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const toDate = (v) => {
  const s = String(v ?? "").trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};

const clean = (v) => String(v ?? "").trim();
const toStr = (v) => String(v ?? "").trim();

const roleLower = (req) => String(req.user?.role || "").trim().toLowerCase();
const isAdmin = (req) => roleLower(req) === "admin";
const isHr = (req) => roleLower(req) === "hr";
const isAccounting = (req) => roleLower(req) === "accounting";
const isBranchManager = (req) => roleLower(req) === "branch manager";
const isAssistantVicePresident = (req) =>
  roleLower(req) === "assistant vice president";

const getUserBranchId = (req) => req.user?.branch_id ?? null;
const getUserRegion = (req) => toStr(req.user?.region);

const uploadRoot = path.join(process.cwd(), "uploads");
const suspensionUploadDir = path.join(uploadRoot, "suspension");

if (!fs.existsSync(suspensionUploadDir)) {
  fs.mkdirSync(suspensionUploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, suspensionUploadDir),
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

const removeStoredFile = (storedPath) => {
  try {
    if (!storedPath) return;
    const fullPath = path.join(process.cwd(), storedPath.replace(/^\/+/, ""));
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  } catch (e) {
    console.error("removeStoredFile ERROR:", e.message);
  }
};

const canAccessStaffRecord = (req, staff) => {
  if (isAdmin(req) || isHr(req) || isAccounting(req)) return true;

  if (isBranchManager(req)) {
    const bid = toInt(getUserBranchId(req));
    return !!bid && Number(staff.branch_id) === Number(bid);
  }

  if (isAssistantVicePresident(req)) {
    const region = getUserRegion(req);
    return !!region && toStr(staff.region).toLowerCase() === region.toLowerCase();
  }

  return false;
};

const canMutateOrder = (req, row) => {
  if (isAdmin(req)) return true;

  if (isBranchManager(req)) {
    const bid = toInt(getUserBranchId(req));
    return !!bid && Number(row.branch_id) === Number(bid);
  }

  if (isAssistantVicePresident(req)) {
    const region = getUserRegion(req);
    return !!region && toStr(row.region).toLowerCase() === region.toLowerCase();
  }

  return false;
};

router.get("/suspension-orders", requireAuth, async (req, res) => {
  try {
    if (isAdmin(req) || isHr(req) || isAccounting(req)) {
      const r = await pool.query(`
        SELECT *
        FROM public.suspension_orders
        ORDER BY id DESC
      `);
      return res.json(r.rows);
    }

    if (isBranchManager(req)) {
      const bid = toInt(getUserBranchId(req));
      if (!bid) return res.json([]);

      const r = await pool.query(
        `
        SELECT so.*
        FROM public.suspension_orders so
        LEFT JOIN public.staff s
          ON s.id = so.employee_id
        WHERE s.branch_id = $1
        ORDER BY so.id DESC
        `,
        [bid]
      );

      return res.json(r.rows);
    }

    if (isAssistantVicePresident(req)) {
      const region = getUserRegion(req);
      if (!region) return res.json([]);

      const r = await pool.query(
        `
        SELECT so.*
        FROM public.suspension_orders so
        LEFT JOIN public.staff s
          ON s.id = so.employee_id
        WHERE LOWER(TRIM(COALESCE(s.region, ''))) = LOWER(TRIM($1))
        ORDER BY so.id DESC
        `,
        [region]
      );

      return res.json(r.rows);
    }

    return res.status(403).json({ message: "Access denied" });
  } catch (e) {
    console.error("GET /api/suspension-orders ERROR:", e);
    return res.status(500).json({ message: e?.message || "Server error" });
  }
});

router.get("/suspension-orders/staff/:id", requireAuth, async (req, res) => {
  try {
    const employeeId = toInt(req.params.id);
    if (!employeeId) {
      return res.status(400).json({ message: "Invalid staff id" });
    }

    const s = await pool.query(
      `
      SELECT id, branch_id, region
      FROM public.staff
      WHERE id = $1
      `,
      [employeeId]
    );

    if (s.rowCount === 0) {
      return res.status(404).json({ message: "Staff not found" });
    }

    const staff = s.rows[0];

    if (!canAccessStaffRecord(req, staff)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const r = await pool.query(
      `
      SELECT *
      FROM public.suspension_orders
      WHERE employee_id = $1
      ORDER BY id DESC
      `,
      [employeeId]
    );

    return res.json(r.rows);
  } catch (e) {
    console.error("GET /api/suspension-orders/staff/:id ERROR:", e.message);
    return res.status(500).json({ message: "Server error" });
  }
});

router.post(
  "/suspension-orders",
  requireAuth,
  requireRole(["admin", "branch manager", "assistant vice president"]),
  upload.single("attachment"),
  async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const employee_id = toInt(req.body?.employee_id);
      const reason = clean(req.body?.reason);
      const details = clean(req.body?.details);
      const suspension_type = clean(req.body?.suspension_type);

      const start_date = toDate(req.body?.suspension_start ?? req.body?.start_date);
      const end_date = toDate(req.body?.suspension_end ?? req.body?.end_date);

      const days_of_suspension = toNum(req.body?.days_of_suspension);
      const basic_salary = toNum(req.body?.basic_salary);
      const ecola = toNum(req.body?.ecola);
      const transportation = toNum(req.body?.transportation);

      const prorated_salary = toNum(req.body?.prorated_salary);
      const prorated_ecola = toNum(req.body?.prorated_ecola);
      const prorated_transportation = toNum(req.body?.prorated_transportation);
      const prorated_repairing = toNum(req.body?.prorated_repairing);
      const prorated_allowance = toNum(req.body?.prorated_allowance);
      const prorated_postage = toNum(req.body?.prorated_postage);
      const total_deduction = toNum(req.body?.total_deduction);

      const attachment_path = req.file ? `/uploads/suspension/${req.file.filename}` : null;
      const attachment_name = req.file ? clean(req.file.originalname) : null;
      const attachment_mime = req.file ? clean(req.file.mimetype) : null;

      if (!employee_id) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Employee is required" });
      }
      if (!suspension_type) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Suspension type is required" });
      }
      if (!start_date) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Start date is required" });
      }
      if (!end_date) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "End date is required" });
      }
      if (days_of_suspension <= 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Days of suspension is required" });
      }
      if (!reason) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Reason is required" });
      }

      const s = await client.query(
        `
        SELECT id, fullname, first_name, last_name, middle_name, branch_id, region
        FROM public.staff
        WHERE id = $1
        `,
        [employee_id]
      );

      if (s.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Staff not found" });
      }

      const staff = s.rows[0];

      if (!canAccessStaffRecord(req, staff)) {
        await client.query("ROLLBACK");
        return res.status(403).json({ message: "Access denied" });
      }

      const employee_name = clean(req.body?.employee_name) || clean(staff.fullname);

      const seq = await client.query(
        `SELECT nextval('public.suspension_orders_id_seq') AS n`
      );
      const n = Number(seq.rows?.[0]?.n || 0);
      const order_no = `SUS-${String(n).padStart(8, "0")}`;

      const ins = await client.query(
        `
        INSERT INTO public.suspension_orders
          (
            id,
            order_no,
            employee_id,
            employee_name,
            suspension_type,
            reason,
            start_date,
            end_date,
            days_of_suspension,
            basic_salary,
            ecola,
            transportation,
            prorated_salary,
            prorated_ecola,
            prorated_transportation,
            prorated_repairing,
            prorated_allowance,
            prorated_postage,
            total_deduction,
            details,
            attachment_path,
            attachment_name,
            attachment_mime,
            status,
            created_by,
            last_name,
            first_name,
            middle_name
          )
        VALUES
          (
            $1, $2, $3, $4, $5, $6, $7::date, $8::date, $9, $10, $11, $12,
            $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23,
            'Pending', $24, $25, $26, $27
          )
        RETURNING *;
        `,
        [
          n,
          order_no,
          employee_id,
          employee_name,
          suspension_type,
          reason,
          start_date,
          end_date,
          days_of_suspension,
          basic_salary,
          ecola,
          transportation,
          prorated_salary,
          prorated_ecola,
          prorated_transportation,
          prorated_repairing,
          prorated_allowance,
          prorated_postage,
          total_deduction,
          details || null,
          attachment_path,
          attachment_name,
          attachment_mime,
          req.user?.id ?? null,
          clean(staff.last_name),
          clean(staff.first_name),
          clean(staff.middle_name),
        ]
      );

      await client.query("COMMIT");
      return res.json(ins.rows[0]);
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("POST /api/suspension-orders ERROR:", e.message);
      return res.status(500).json({ message: e?.message || "Server error" });
    } finally {
      client.release();
    }
  }
);

router.put(
  "/suspension-orders/:id",
  requireAuth,
  requireRole(["admin", "branch manager", "assistant vice president"]),
  upload.single("attachment"),
  async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const id = toInt(req.params.id);
      if (!id) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Invalid id" });
      }

      const existingRes = await client.query(
        `
        SELECT so.*, s.branch_id, s.region
        FROM public.suspension_orders so
        LEFT JOIN public.staff s ON s.id = so.employee_id
        WHERE so.id = $1
        `,
        [id]
      );

      if (existingRes.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Suspension order not found" });
      }

      const existing = existingRes.rows[0];

      if (String(existing.status || "").toLowerCase() !== "pending") {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Only pending orders can be edited" });
      }

      if (!canMutateOrder(req, existing)) {
        await client.query("ROLLBACK");
        return res.status(403).json({ message: "Access denied" });
      }

      const employee_id = toInt(req.body?.employee_id);
      const reason = clean(req.body?.reason);
      const details = clean(req.body?.details);
      const suspension_type = clean(req.body?.suspension_type);

      const start_date = toDate(req.body?.suspension_start ?? req.body?.start_date);
      const end_date = toDate(req.body?.suspension_end ?? req.body?.end_date);

      const days_of_suspension = toNum(req.body?.days_of_suspension);
      const basic_salary = toNum(req.body?.basic_salary);
      const ecola = toNum(req.body?.ecola);
      const transportation = toNum(req.body?.transportation);

      const prorated_salary = toNum(req.body?.prorated_salary);
      const prorated_ecola = toNum(req.body?.prorated_ecola);
      const prorated_transportation = toNum(req.body?.prorated_transportation);
      const prorated_repairing = toNum(req.body?.prorated_repairing);
      const prorated_allowance = toNum(req.body?.prorated_allowance);
      const prorated_postage = toNum(req.body?.prorated_postage);
      const total_deduction = toNum(req.body?.total_deduction);

      if (!employee_id) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Employee is required" });
      }
      if (!suspension_type) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Suspension type is required" });
      }
      if (!start_date) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Start date is required" });
      }
      if (!end_date) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "End date is required" });
      }
      if (days_of_suspension <= 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Days of suspension is required" });
      }
      if (!reason) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Reason is required" });
      }

      const staffRes = await client.query(
        `
        SELECT id, fullname, first_name, last_name, middle_name, branch_id, region
        FROM public.staff
        WHERE id = $1
        `,
        [employee_id]
      );

      if (staffRes.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Staff not found" });
      }

      const staff = staffRes.rows[0];

      if (!canAccessStaffRecord(req, staff)) {
        await client.query("ROLLBACK");
        return res.status(403).json({ message: "Access denied" });
      }

      let attachment_path = existing.attachment_path;
      let attachment_name = existing.attachment_name;
      let attachment_mime = existing.attachment_mime;

      if (req.file) {
        attachment_path = `/uploads/suspension/${req.file.filename}`;
        attachment_name = clean(req.file.originalname);
        attachment_mime = clean(req.file.mimetype);
      }

      const employee_name = clean(req.body?.employee_name) || clean(staff.fullname);

      const upd = await client.query(
        `
        UPDATE public.suspension_orders
        SET
          employee_id = $2,
          employee_name = $3,
          suspension_type = $4,
          reason = $5,
          start_date = $6::date,
          end_date = $7::date,
          days_of_suspension = $8,
          basic_salary = $9,
          ecola = $10,
          transportation = $11,
          prorated_salary = $12,
          prorated_ecola = $13,
          prorated_transportation = $14,
          prorated_repairing = $15,
          prorated_allowance = $16,
          prorated_postage = $17,
          total_deduction = $18,
          details = $19,
          attachment_path = $20,
          attachment_name = $21,
          attachment_mime = $22,
          last_name = $23,
          first_name = $24,
          middle_name = $25
        WHERE id = $1
        RETURNING *;
        `,
        [
          id,
          employee_id,
          employee_name,
          suspension_type,
          reason,
          start_date,
          end_date,
          days_of_suspension,
          basic_salary,
          ecola,
          transportation,
          prorated_salary,
          prorated_ecola,
          prorated_transportation,
          prorated_repairing,
          prorated_allowance,
          prorated_postage,
          total_deduction,
          details || null,
          attachment_path,
          attachment_name,
          attachment_mime,
          clean(staff.last_name),
          clean(staff.first_name),
          clean(staff.middle_name),
        ]
      );

      await client.query("COMMIT");

      if (req.file && existing.attachment_path && existing.attachment_path !== attachment_path) {
        removeStoredFile(existing.attachment_path);
      }

      return res.json(upd.rows[0]);
    } catch (e) {
      await client.query("ROLLBACK");
      if (req.file) {
        removeStoredFile(`/uploads/suspension/${req.file.filename}`);
      }
      console.error("PUT /api/suspension-orders/:id ERROR:", e.message);
      return res.status(500).json({ message: e?.message || "Server error" });
    } finally {
      client.release();
    }
  }
);

router.delete(
  "/suspension-orders/:id",
  requireAuth,
  requireRole(["admin", "branch manager", "assistant vice president"]),
  async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const id = toInt(req.params.id);
      if (!id) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Invalid id" });
      }

      const existingRes = await client.query(
        `
        SELECT so.*, s.branch_id, s.region
        FROM public.suspension_orders so
        LEFT JOIN public.staff s ON s.id = so.employee_id
        WHERE so.id = $1
        `,
        [id]
      );

      if (existingRes.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Suspension order not found" });
      }

      const existing = existingRes.rows[0];

      if (String(existing.status || "").toLowerCase() !== "pending") {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Only pending orders can be deleted" });
      }

      if (!canMutateOrder(req, existing)) {
        await client.query("ROLLBACK");
        return res.status(403).json({ message: "Access denied" });
      }

      await client.query(
        `
        DELETE FROM public.suspension_orders
        WHERE id = $1
        `,
        [id]
      );

      await client.query("COMMIT");

      if (existing.attachment_path) {
        removeStoredFile(existing.attachment_path);
      }

      return res.json({ message: "Suspension order deleted successfully" });
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("DELETE /api/suspension-orders/:id ERROR:", e.message);
      return res.status(500).json({ message: e?.message || "Server error" });
    } finally {
      client.release();
    }
  }
);

router.get(
  "/suspension-orders/:id/download",
  requireAuth,
  async (req, res) => {
    try {
      const id = toInt(req.params.id);
      if (!id) return res.status(400).json({ message: "Invalid id" });

      const r = await pool.query(
        `
        SELECT so.*, s.branch_id, s.region
        FROM public.suspension_orders so
        LEFT JOIN public.staff s ON s.id = so.employee_id
        WHERE so.id = $1
        `,
        [id]
      );

      if (r.rowCount === 0) {
        return res.status(404).json({ message: "Suspension order not found" });
      }

      const row = r.rows[0];

      if (!canMutateOrder(req, row) && !isHr(req) && !isAccounting(req)) {
        return res.status(403).json({ message: "Access denied" });
      }

      if (!row.attachment_path) {
        return res.status(404).json({ message: "No attachment found" });
      }

      const filePath = path.join(process.cwd(), row.attachment_path.replace(/^\/+/, ""));
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "Stored file not found" });
      }

      return res.download(filePath, row.attachment_name || path.basename(filePath));
    } catch (e) {
      console.error("GET /api/suspension-orders/:id/download ERROR:", e.message);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

router.put(
  "/suspension-orders/:id/approve",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    try {
      const id = toInt(req.params.id);
      if (!id) return res.status(400).json({ message: "Invalid id" });

      const r = await pool.query(
        `
        UPDATE public.suspension_orders
        SET
          status = 'Approved',
          approved_by = $2,
          approved_at = NOW(),
          rejected_by = NULL,
          rejected_at = NULL,
          rejection_reason = NULL
        WHERE id = $1 AND status = 'Pending'
        RETURNING *;
        `,
        [id, req.user?.id ?? null]
      );

      if (r.rowCount === 0) {
        return res.status(400).json({ message: "Not found or not Pending" });
      }

      return res.json(r.rows[0]);
    } catch (e) {
      console.error("PUT /api/suspension-orders/:id/approve ERROR:", e.message);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

router.put(
  "/suspension-orders/:id/reject",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    try {
      const id = toInt(req.params.id);
      if (!id) return res.status(400).json({ message: "Invalid id" });

      const reason = clean(req.body?.reason);
      if (!reason) {
        return res.status(400).json({ message: "Rejection reason is required" });
      }

      const r = await pool.query(
        `
        UPDATE public.suspension_orders
        SET
          status = 'Rejected',
          rejected_by = $2,
          rejected_at = NOW(),
          rejection_reason = $3,
          approved_by = NULL,
          approved_at = NULL
        WHERE id = $1 AND status = 'Pending'
        RETURNING *;
        `,
        [id, req.user?.id ?? null, reason]
      );

      if (r.rowCount === 0) {
        return res.status(400).json({ message: "Not found or not Pending" });
      }

      return res.json(r.rows[0]);
    } catch (e) {
      console.error("PUT /api/suspension-orders/:id/reject ERROR:", e.message);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

module.exports = router;