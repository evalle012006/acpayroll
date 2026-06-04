const express = require("express");
const router = express.Router();
const pool = require("../db");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const { requireAuth } = require("../middlewares/authMiddleware");
const { requirePermission } = require("../middlewares/permissionMiddleware");

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

const STATUS_WAITING_HR_FILE = "Waiting HR File";
const STATUS_APPROVED = "Approved";
const STATUS_REJECTED = "Rejected";
const STATUS_VOID = "Void";

const OLD_STATUS_PENDING_VP = "Pending VP Approval";

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
const norm = (v) => toStr(v).toLowerCase();

const isCreatorRole = (req) =>
  isBranchManager(req) ||
  isAreaManager(req) ||
  isRegionalManager(req) ||
  isAssistantVicePresident(req) ||
  isHr(req) ||
  isAdmin(req) ||
  isIT(req);

const isPowerView = (req) =>
  isAdmin(req) ||
  isIT(req) ||
  isHr(req) ||
  isAccounting(req) ||
  isTread(req) ||
  isVicePresident(req) ||
  isSeniorVicePresident(req) ||
  isPresident(req);

const canUploadFinalFile = (req) =>
  isHr(req) || isAdmin(req) || isIT(req) || isAccounting(req) || isSeniorVicePresident(req);

const canRejectOrder = (req) => isHr(req) || isAdmin(req) || isIT(req) || isAccounting(req) || isVicePresident(req) || isSeniorVicePresident(req);

const getUserBranchId = (req) => req.user?.branch_id ?? null;

  const isNumericId = (v) => /^\d+$/.test(String(v ?? "").trim());

  async function resolveUserBranchId(req) {
    const raw = String(req.user?.branch_id ?? "").trim();

    if (!raw) return null;

    if (isNumericId(raw)) return Number(raw);

    const r = await pool.query(
      `
      SELECT id
      FROM public.branches
      WHERE LOWER(TRIM(code)) = LOWER(TRIM($1))
      LIMIT 1
      `,
      [raw]
    );

    return r.rows[0]?.id || null;
  }

const getUserArea = (req) => toStr(req.user?.area);
const getUserRegion = (req) => toStr(req.user?.region);
const getUserDivision = (req) => toStr(req.user?.division);

const displayName = (row) => {
  const ln = toStr(row?.last_name);
  const fn = toStr(row?.first_name);
  const mn = toStr(row?.middle_name);

  const built = `${ln}${ln && fn ? ", " : ""}${fn}${mn ? ` ${mn}` : ""}`
    .replace(/\s+/g, " ")
    .trim();

  return built || toStr(row?.fullname) || "-";
};

const uploadsRoot = path.join(process.cwd(), "uploads");
const transferUploadsDir = path.join(uploadsRoot, "transfer-staff-orders");

if (!fs.existsSync(transferUploadsDir)) {
  fs.mkdirSync(transferUploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, transferUploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    const base = path
      .basename(file.originalname || "file", ext)
      .replace(/[^a-zA-Z0-9-_]/g, "_");

    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}-${base}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
});

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

  return `${prefix}-${year}-${String(month).padStart(2, "0")}-${String(
    nextVal
  ).padStart(4, "0")}`;
}

const canAccessOrder = (req, order) => {
  if (isPowerView(req)) return true;

  if (isBranchManager(req)) {
    const branchId = Number(getUserBranchId(req));
    return (
      branchId === Number(order.prev_branch_id) ||
      branchId === Number(order.to_branch_id)
    );
  }

  if (isAreaManager(req)) {
    return norm(getUserArea(req)) === norm(order.area);
  }

  if (isRegionalManager(req)) {
    return norm(getUserRegion(req)) === norm(order.region);
  }

  if (isAssistantVicePresident(req)) {
    return norm(getUserDivision(req)) === norm(order.division);
  }

  return false;
};

router.get(
  "/transfer-staff-orders",
  requireAuth,
  requirePermission("transfer_staff_order", "view"),
  async (req, res) => {
    try {
      if (isPowerView(req)) {
        const r = await pool.query(`
          SELECT *
          FROM public.transfer_staff_orders
          ORDER BY created_at DESC
        `);

        return res.json(r.rows);
      }

      if (isBranchManager(req)) {
        const branchId = await resolveUserBranchId(req);
        if (!branchId) return res.json([]);

        const r = await pool.query(
          `
          SELECT *
          FROM public.transfer_staff_orders
          WHERE prev_branch_id = $1 OR to_branch_id = $1
          ORDER BY created_at DESC
          `,
          [branchId]
        );

        return res.json(r.rows);
      }

      if (isAreaManager(req)) {
        const area = getUserArea(req);
        if (!area) return res.json([]);

        const r = await pool.query(
          `
          SELECT *
          FROM public.transfer_staff_orders
          WHERE LOWER(TRIM(COALESCE(area, ''))) = LOWER(TRIM($1))
          ORDER BY created_at DESC
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
          SELECT *
          FROM public.transfer_staff_orders
          WHERE LOWER(TRIM(COALESCE(region, ''))) = LOWER(TRIM($1))
          ORDER BY created_at DESC
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
          SELECT *
          FROM public.transfer_staff_orders
          WHERE LOWER(TRIM(COALESCE(division, ''))) = LOWER(TRIM($1))
          ORDER BY created_at DESC
          `,
          [division]
        );

        return res.json(r.rows);
      }

      return res.status(403).json({ message: "Access denied" });
    } catch (e) {
      console.error("GET /api/transfer-staff-orders ERROR:", e.message);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

router.post(
  "/transfer-staff-orders",
  requireAuth,
  requirePermission("transfer_staff_order", "create"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      if (!isCreatorRole(req)) {
        return res.status(403).json({
          message:
            "Only Branch Manager, Area Manager, Regional Manager, Assistant Vice President, HR, Admin, or IT can create transfer staff orders.",
        });
      }

      await client.query("BEGIN");

      const b = req.body || {};
      const employee_id = toInt(b.employee_id);
      const prev_branch_id = toInt(b.prev_branch_id);
      const to_branch_id = toInt(b.to_branch_id);

      const department = toStr(b.department);
      const division = toStr(b.division);
      const area = toStr(b.area);
      const region = toStr(b.region);
      const details = toStr(b.details);

      const date_created = toDateOrNull(b.date_created);
      const effective_date = toDateOrNull(b.effective_date);

      if (!employee_id) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Employee required" });
      }

      if (!prev_branch_id || !to_branch_id) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Branches required" });
      }

      if (!division || !area || !region || !department) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: "Division, area, and region are required.",
        });
      }

      if (!date_created || !effective_date) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: "Date created and effective date are required.",
        });
      }

      if (!details) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Details required" });
      }

      const s = await client.query(
        `
        SELECT id, fullname, last_name, first_name, middle_name, branch_id, area, region, division
        FROM public.staff
        WHERE id = $1
        `,
        [employee_id]
      );

      if (s.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Staff not found" });
      }

      const staffRow = s.rows[0];

      if (isBranchManager(req)) {
        const userBranchId = await resolveUserBranchId(req);

        if (Number(userBranchId) !== Number(prev_branch_id)) {
          await client.query("ROLLBACK");
          return res.status(403).json({ message: "Access denied" });
        }
      }

      if (isAreaManager(req)) {
        if (norm(getUserArea(req)) !== norm(staffRow.area)) {
          await client.query("ROLLBACK");
          return res.status(403).json({ message: "Access denied" });
        }
      }

      if (isRegionalManager(req)) {
        if (norm(getUserRegion(req)) !== norm(staffRow.region)) {
          await client.query("ROLLBACK");
          return res.status(403).json({ message: "Access denied" });
        }
      }

      if (isAssistantVicePresident(req)) {
        if (norm(getUserDivision(req)) !== norm(staffRow.division)) {
          await client.query("ROLLBACK");
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const employee_name = displayName(staffRow);
      const orderNo = await generateTransferOrderNo(client);

      const ins = await client.query(
        `
        INSERT INTO public.transfer_staff_orders
        (
          order_no,
          employee_id,
          employee_name,
          prev_branch_id,
          prev_branch_code,
          prev_branch_name,
          to_branch_id,
          to_branch_code,
          to_branch_name,
          area,
          region,
          division,
          department,
          date_created,
          effective_date,
          details,
          status,
          created_by
        )
        VALUES
        (
          $1,$2,$3,
          $4,$5,$6,
          $7,$8,$9,
          $10,$11,$12,$13,
          $14::date,$15::date,$16,
          $17,$18
        )
        RETURNING *
        `,
        [
          orderNo,
          employee_id,
          employee_name,
          prev_branch_id,
          toStr(b.prev_branch_code),
          toStr(b.prev_branch_name),
          to_branch_id,
          toStr(b.to_branch_code),
          toStr(b.to_branch_name),
          area,
          region,
          division,
          department,
          date_created,
          effective_date,
          details,
          STATUS_WAITING_HR_FILE,
          req.user?.id ?? null,
        ]
      );

      await client.query("COMMIT");
      return res.json(ins.rows[0]);
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("POST /api/transfer-staff-orders ERROR:", e.message);
      return res.status(500).json({ message: e.message || "Server error" });
    } finally {
      client.release();
    }
  }
);

router.get(
  "/transfer-staff-orders/:id/files",
  requireAuth,
  requirePermission("transfer_staff_order", "view"),
  async (req, res) => {
    try {
      const id = toInt(req.params.id);

      if (!id) {
        return res.status(400).json({ message: "Invalid transfer order id" });
      }

      const orderCheck = await pool.query(
        `
        SELECT *
        FROM public.transfer_staff_orders
        WHERE id = $1
        `,
        [id]
      );

      if (orderCheck.rowCount === 0) {
        return res.status(404).json({ message: "Transfer order not found" });
      }

      const order = orderCheck.rows[0];

      if (!canAccessOrder(req, order)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const r = await pool.query(
        `
        SELECT
          id,
          transfer_order_id,
          original_name,
          filename,
          file_path,
          mime_type,
          file_size,
          uploaded_by,
          created_at
        FROM public.transfer_staff_order_files
        WHERE transfer_order_id = $1
        ORDER BY created_at DESC, id DESC
        `,
        [id]
      );

      return res.json(r.rows);
    } catch (e) {
      console.error("GET /api/transfer-staff-orders/:id/files ERROR:", e.message);
      return res.status(500).json({ message: e.message || "Server error" });
    }
  }
);

router.get(
  "/transfer-staff-orders/staff/:staffId",
  requireAuth,
  requirePermission("transfer_staff_order", "view"),
  async (req, res) => {
    try {
      const staffId = toInt(req.params.staffId);

      if (!staffId) {
        return res.status(400).json({ message: "Invalid staff id" });
      }

      const r = await pool.query(
        `
        SELECT *
        FROM public.transfer_staff_orders
        WHERE employee_id = $1
        ORDER BY created_at DESC
        `,
        [staffId]
      );

      return res.json(r.rows);
    } catch (e) {
      console.error(
        "GET /api/transfer-staff-orders/staff/:staffId ERROR:",
        e.message
      );
      return res.status(500).json({ message: "Failed to load transfer history" });
    }
  }
);

router.post(
  "/transfer-staff-orders/:id/hr-final-file",
  requireAuth,
  requirePermission("transfer_staff_order", "upload_approved"),
  upload.single("file"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      if (!canUploadFinalFile(req)) {
        return res.status(403).json({
          message: "Only HR, Admin, or IT can upload the final transfer file.",
        });
      }

      const id = toInt(req.params.id);

      if (!id) {
        return res.status(400).json({ message: "Invalid transfer order id" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "Final file is required" });
      }

      await client.query("BEGIN");

      const orderCheck = await client.query(
        `
        SELECT *
        FROM public.transfer_staff_orders
        WHERE id = $1
        FOR UPDATE
        `,
        [id]
      );

      if (orderCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Transfer order not found" });
      }

      const order = orderCheck.rows[0];

      if (
        order.status !== STATUS_WAITING_HR_FILE &&
        order.status !== OLD_STATUS_PENDING_VP
      ) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message:
            "Order must be Waiting HR File before HR/Admin/IT can upload final file.",
        });
      }

      const oldFiles = await client.query(
        `
        SELECT file_path
        FROM public.transfer_staff_order_files
        WHERE transfer_order_id = $1
        `,
        [id]
      );

      await client.query(
        `
        DELETE FROM public.transfer_staff_order_files
        WHERE transfer_order_id = $1
        `,
        [id]
      );

      for (const oldFile of oldFiles.rows) {
        try {
          if (oldFile.file_path && fs.existsSync(oldFile.file_path)) {
            fs.unlinkSync(oldFile.file_path);
          }
        } catch (unlinkErr) {
          console.warn(
            "Unable to delete old transfer file:",
            unlinkErr.message
          );
        }
      }

      const fileIns = await client.query(
        `
        INSERT INTO public.transfer_staff_order_files
        (
          transfer_order_id,
          original_name,
          filename,
          file_path,
          mime_type,
          file_size,
          uploaded_by
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        RETURNING *
        `,
        [
          id,
          toStr(req.file.originalname),
          toStr(req.file.filename),
          toStr(req.file.path),
          toStr(req.file.mimetype),
          Number(req.file.size || 0),
          req.user?.id ?? null,
        ]
      );

      const upd = await client.query(
        `
        UPDATE public.transfer_staff_orders
        SET
          status = $2,
          approved_by = $3,
          approved_at = NOW(),
          rejected_by = NULL,
          rejected_at = NULL,
          rejection_reason = NULL
        WHERE id = $1
        RETURNING *
        `,
        [id, STATUS_APPROVED, req.user?.id ?? null]
      );

      const updatedOrder = upd.rows[0];

      await client.query(
        `
        UPDATE public.staff
        SET
          branch_id = $1,
          area = $2,
          region = $3,
          division = $4,
          department = $5
        WHERE id = $6
        `,
        [
          updatedOrder.to_branch_id,
          updatedOrder.area,
          updatedOrder.region,
          updatedOrder.division,
          updatedOrder.department,
          updatedOrder.employee_id,
        ]
      );

      await client.query("COMMIT");

      return res.json({
        order: updatedOrder,
        file: fileIns.rows[0],
      });
    } catch (e) {
      await client.query("ROLLBACK");

      if (req.file?.path) {
        try {
          if (fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
          }
        } catch (unlinkErr) {
          console.warn("Unable to delete failed upload:", unlinkErr.message);
        }
      }

      console.error(
        "POST /api/transfer-staff-orders/:id/hr-final-file ERROR:",
        e.message
      );

      return res.status(500).json({ message: e.message || "Server error" });
    } finally {
      client.release();
    }
  }
);

router.get(
  "/transfer-staff-orders/files/:fileId/download",
  requireAuth,
  requirePermission("transfer_staff_order", "view"),
  async (req, res) => {
    try {
      const fileId = toInt(req.params.fileId);

      if (!fileId) {
        return res.status(400).json({ message: "Invalid file id" });
      }

      const r = await pool.query(
        `
        SELECT
          f.id,
          f.transfer_order_id,
          f.original_name,
          f.filename,
          f.file_path,
          f.mime_type,
          f.file_size,
          t.*
        FROM public.transfer_staff_order_files f
        JOIN public.transfer_staff_orders t
          ON t.id = f.transfer_order_id
        WHERE f.id = $1
        `,
        [fileId]
      );

      if (r.rowCount === 0) {
        return res.status(404).json({ message: "File not found" });
      }

      const row = r.rows[0];

      if (!canAccessOrder(req, row)) {
        return res.status(403).json({ message: "Access denied" });
      }

      if (!row.file_path || !fs.existsSync(row.file_path)) {
        return res.status(404).json({ message: "Stored file not found" });
      }

      return res.download(
        row.file_path,
        row.original_name || row.filename || "download"
      );
    } catch (e) {
      console.error(
        "GET /api/transfer-staff-orders/files/:fileId/download ERROR:",
        e.message
      );
      return res.status(500).json({ message: e.message || "Server error" });
    }
  }
);

router.put(
  "/transfer-staff-orders/:id/void",
  requireAuth,
  requirePermission("transfer_staff_order", "void"),
  async (req, res) => {
    try {
      if (!(isAdmin(req) || isIT(req) || isHr(req) || isAccounting(req))) {
        return res.status(403).json({ message: "Access denied" });
      }

      const id = toInt(req.params.id);
      const reason = toStr(req.body?.reason);

      if (!id) return res.status(400).json({ message: "Invalid id" });
      if (!reason) return res.status(400).json({ message: "Void reason is required" });

      const r = await pool.query(
        `
        UPDATE public.transfer_staff_orders
        SET
          status = 'Void',
          voided_by = $2,
          voided_at = NOW(),
          void_reason = $3
        WHERE id = $1
          AND status IN ('Approved', 'Rejected')
        RETURNING *
        `,
        [id, req.user?.id ?? null, reason]
      );

      if (r.rowCount === 0) {
        return res.status(400).json({ message: "Order not found or cannot be voided." });
      }

      return res.json(r.rows[0]);
    } catch (e) {
      console.error("VOID TRANSFER ERROR:", e.message);
      return res.status(500).json({ message: e.message || "Server error" });
    }
  }
);

router.delete(
  "/transfer-staff-orders/:id",
  requireAuth,
  requirePermission("transfer_staff_order", "delete"),
  async (req, res) => {
    try {
      if (!(isAdmin(req) || isIT(req))) {
        return res.status(403).json({ message: "Only Admin or IT can delete." });
      }

      const id = toInt(req.params.id);
      if (!id) return res.status(400).json({ message: "Invalid id" });

      const r = await pool.query(
        `
        DELETE FROM public.transfer_staff_orders
        WHERE id = $1
          AND status IN ('Rejected', 'Void')
        RETURNING *
        `,
        [id]
      );

      if (r.rowCount === 0) {
        return res.status(400).json({
          message: "Only Rejected or Void transfer orders can be deleted.",
        });
      }

      return res.json({ message: "Transfer order deleted successfully." });
    } catch (e) {
      console.error("DELETE TRANSFER ERROR:", e.message);
      return res.status(500).json({ message: e.message || "Server error" });
    }
  }
);

router.put(
  "/transfer-staff-orders/:id/reject",
  requireAuth,
  requirePermission("transfer_staff_order", "reject"),
  async (req, res) => {
    try {
      if (!canRejectOrder(req)) {
        return res.status(403).json({
          message: "Only HR, Admin, IT, or Vice President can reject transfer orders.",
        });
      }

      const id = toInt(req.params.id);

      if (!id) return res.status(400).json({ message: "Invalid id" });

      const reason = toStr(req.body?.reason);

      if (!reason) {
        return res.status(400).json({ message: "Rejection reason is required" });
      }

      const r = await pool.query(
        `
        UPDATE public.transfer_staff_orders
        SET
          status = $2,
          rejected_by = $3,
          rejected_at = NOW(),
          rejection_reason = $4
        WHERE id = $1
          AND status IN ($5, $6)
        RETURNING *
        `,
        [
          id,
          STATUS_REJECTED,
          req.user?.id ?? null,
          reason,
          STATUS_WAITING_HR_FILE,
          OLD_STATUS_PENDING_VP,
        ]
      );

      if (r.rowCount === 0) {
        return res.status(400).json({
          message: "Order not found or cannot be rejected at this stage.",
        });
      }

      return res.json(r.rows[0]);
    } catch (e) {
      console.error("PUT /api/transfer-staff-orders/:id/reject ERROR:", e.message);
      return res.status(500).json({ message: e.message || "Server error" });
    }
  }
);

module.exports = router;