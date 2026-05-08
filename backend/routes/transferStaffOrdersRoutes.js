const express = require("express");
const router = express.Router();
const pool = require("../db");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const { requireAuth } = require("../middlewares/authMiddleware");
const { requirePermission } = require("../utils/permissions");

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

const isTopManagement = (req) =>
  isAdmin(req) ||
  isIT(req) ||
  isHr(req) ||
  isAccounting(req) ||
  isVicePresident(req) ||
  isSeniorVicePresident(req) ||
  isPresident(req);

const canViewAllTransferOrders = (req) =>
  isTopManagement(req) ||
  isAssistantVicePresident(req) ||
  isTread(req);

const getUserRegion = (req) => toStr(req.user?.region);
const getUserBranchId = (req) => req.user?.branch_id ?? null;
const getUserArea = (req) => toStr(req.user?.area);

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
  destination: (_req, _file, cb) => {
    cb(null, transferUploadsDir);
  },
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

  const mm = String(month).padStart(2, "0");
  const nnnn = String(nextVal).padStart(4, "0");

  return `${prefix}-${year}-${mm}-${nnnn}`;
}

async function canAccessTransferOrderFiles(req, orderRow) {
  const branchId = getUserBranchId(req);
  const userArea = getUserArea(req);
  const userRegion = getUserRegion(req);

  if (canViewAllTransferOrders(req)) {
    return true;
  }

  if (isBranchManager(req)) {
    return Number(branchId) === Number(orderRow.prev_branch_id);
  }

  if (isAreaManager(req)) {
    return toStr(userArea).toLowerCase() === toStr(orderRow.area).toLowerCase();
  }

  if (isRegionalManager(req)) {
    return toStr(userRegion).toLowerCase() === toStr(orderRow.region).toLowerCase();
  }

  return false;
}

router.get(
  "/transfer-staff-orders",
  requireAuth,
  requirePermission("transfer_staff_order", "view"),
  async (req, res) => {
    try {
      const branchId = getUserBranchId(req);
      const userArea = getUserArea(req);

      if (canViewAllTransferOrders(req)) {
        const r = await pool.query(`
          SELECT *
          FROM public.transfer_staff_orders
          ORDER BY created_at DESC
        `);

        return res.json(r.rows);
      }

      if (isBranchManager(req)) {
        if (!branchId) return res.json([]);

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

      if (isAreaManager(req)) {
        if (!userArea) return res.json([]);

        const r = await pool.query(
          `
          SELECT *
          FROM public.transfer_staff_orders
          WHERE LOWER(TRIM(COALESCE(area, ''))) = LOWER(TRIM($1))
          ORDER BY created_at DESC
          `,
          [userArea]
        );

        return res.json(r.rows);
      }

      if (isRegionalManager(req)) {
        const userRegion = getUserRegion(req);
        if (!userRegion) return res.json([]);

        const r = await pool.query(
          `
          SELECT *
          FROM public.transfer_staff_orders
          WHERE LOWER(TRIM(COALESCE(region, ''))) = LOWER(TRIM($1))
          ORDER BY created_at DESC
          `,
          [userRegion]
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
      await client.query("BEGIN");

      const b = req.body || {};
      const employee_id = toInt(b.employee_id);
      const prev_branch_id = toInt(b.prev_branch_id);
      const to_branch_id = toInt(b.to_branch_id);

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

      if (!division) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Division required" });
      }

      if (!area) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Area required" });
      }

      if (!region) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Region required" });
      }

      if (!date_created) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Date created required" });
      }

      if (!effective_date) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Effective date required" });
      }

      if (!details) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Details required" });
      }

      if (isBranchManager(req)) {
        const myBranch = getUserBranchId(req);

        if (!myBranch || Number(myBranch) !== Number(prev_branch_id)) {
          await client.query("ROLLBACK");
          return res.status(403).json({ message: "Access denied" });
        }
      }

      if (isAreaManager(req)) {
        const myArea = getUserArea(req);

        if (!myArea || myArea.toLowerCase() !== area.toLowerCase()) {
          await client.query("ROLLBACK");
          return res.status(403).json({ message: "Access denied" });
        }

        const staffAreaCheck = await client.query(
          `
          SELECT id
          FROM public.staff
          WHERE id = $1
            AND LOWER(TRIM(COALESCE(area, ''))) = LOWER(TRIM($2))
          `,
          [employee_id, myArea]
        );

        if (staffAreaCheck.rowCount === 0) {
          await client.query("ROLLBACK");
          return res.status(403).json({ message: "Access denied" });
        }
      }

      if (isRegionalManager(req)) {
        const myRegion = getUserRegion(req);

        if (!myRegion || myRegion.toLowerCase() !== region.toLowerCase()) {
          await client.query("ROLLBACK");
          return res.status(403).json({ message: "Access denied" });
        }

        const staffRegionCheck = await client.query(
          `
          SELECT id
          FROM public.staff
          WHERE id = $1
            AND LOWER(TRIM(COALESCE(region, ''))) = LOWER(TRIM($2))
          `,
          [employee_id, myRegion]
        );

        if (staffRegionCheck.rowCount === 0) {
          await client.query("ROLLBACK");
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const s = await client.query(
        `
        SELECT id, fullname, last_name, first_name, middle_name
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
            date_created,
            effective_date,
            details,
            status,
            created_by,
            last_name,
            first_name,
            middle_name
          )
        VALUES
          (
            $1,$2,$3,
            $4,$5,$6,
            $7,$8,$9,
            $10,$11,$12,$13::date,$14::date,$15,
            'Pending',$16,
            $17,$18,$19
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
          date_created,
          effective_date,
          details,
          req.user?.id ?? null,
          toStr(staffRow.last_name) || null,
          toStr(staffRow.first_name) || null,
          toStr(staffRow.middle_name) || null,
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
  }
);

router.get(
  "/transfer-staff-orders/:id/files",
  requireAuth,
  requirePermission("transfer_staff_order", "view"),
  async (req, res) => {
    try {
      const transferOrderId = toInt(req.params.id);

      if (!transferOrderId) {
        return res.status(400).json({ message: "Invalid transfer order id" });
      }

      const orderCheck = await pool.query(
        `
        SELECT id, prev_branch_id, area, region
        FROM public.transfer_staff_orders
        WHERE id = $1
        `,
        [transferOrderId]
      );

      if (orderCheck.rowCount === 0) {
        return res.status(404).json({ message: "Transfer order not found" });
      }

      const order = orderCheck.rows[0];
      const allowed = await canAccessTransferOrderFiles(req, order);

      if (!allowed) {
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
        [transferOrderId]
      );

      return res.json(r.rows);
    } catch (e) {
      console.error("GET /api/transfer-staff-orders/:id/files ERROR:", e.message);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

router.post(
  "/transfer-staff-orders/:id/files",
  requireAuth,
  requirePermission("transfer_staff_order", "create"),
  upload.array("files", 10),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const transferOrderId = toInt(req.params.id);

      if (!transferOrderId) {
        return res.status(400).json({ message: "Invalid transfer order id" });
      }

      const files = Array.isArray(req.files) ? req.files : [];

      if (files.length === 0) {
        return res.status(400).json({ message: "No files uploaded" });
      }

      const orderCheck = await client.query(
        `
        SELECT id, prev_branch_id, area, region
        FROM public.transfer_staff_orders
        WHERE id = $1
        `,
        [transferOrderId]
      );

      if (orderCheck.rowCount === 0) {
        return res.status(404).json({ message: "Transfer order not found" });
      }

      const order = orderCheck.rows[0];
      const allowed = await canAccessTransferOrderFiles(req, order);

      if (!allowed) {
        return res.status(403).json({ message: "Access denied" });
      }

      await client.query("BEGIN");

      const inserted = [];

      for (const file of files) {
        const ins = await client.query(
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
            transferOrderId,
            toStr(file.originalname),
            toStr(file.filename),
            toStr(file.path),
            toStr(file.mimetype),
            Number(file.size || 0),
            req.user?.id ?? null,
          ]
        );

        inserted.push(ins.rows[0]);
      }

      await client.query("COMMIT");
      return res.json(inserted);
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("POST /api/transfer-staff-orders/:id/files ERROR:", e.message);
      return res.status(500).json({ message: "Server error" });
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
          t.prev_branch_id,
          t.area,
          t.region
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
      const allowed = await canAccessTransferOrderFiles(req, row);

      if (!allowed) {
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

      return res.status(500).json({ message: "Server error" });
    }
  }
);

router.put(
  "/transfer-staff-orders/:id/approve",
  requireAuth,
  requirePermission("transfer_staff_order", "approve"),
  async (req, res) => {
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
        RETURNING *
        `,
        [id, req.user?.id ?? null]
      );

      if (r.rowCount === 0) {
        return res.status(400).json({ message: "Order not found or not Pending" });
      }

      const order = r.rows[0];

      await pool.query(
        `
        UPDATE public.staff
        SET
          branch_id = $1,
          area = $2,
          region = $3,
          division = $4
        WHERE id = $5
        `,
        [order.to_branch_id, order.area, order.region, order.division, order.employee_id]
      );

      return res.json(order);
    } catch (e) {
      console.error("PUT /api/transfer-staff-orders/:id/approve ERROR:", e.message);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

router.put(
  "/transfer-staff-orders/:id/reject",
  requireAuth,
  requirePermission("transfer_staff_order", "reject"),
  async (req, res) => {
    try {
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
          status='Rejected',
          rejected_by=$2,
          rejected_at=COALESCE(rejected_at, NOW()),
          rejection_reason=$3,
          approved_by=NULL,
          approved_at=NULL
        WHERE id=$1 AND status='Pending'
        RETURNING *
        `,
        [id, req.user?.id ?? null, reason]
      );

      if (r.rowCount === 0) {
        return res.status(400).json({ message: "Order not found or not Pending" });
      }

      return res.json(r.rows[0]);
    } catch (e) {
      console.error("PUT /api/transfer-staff-orders/:id/reject ERROR:", e.message);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

module.exports = router;