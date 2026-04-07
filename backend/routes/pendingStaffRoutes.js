const express = require("express");
const router = express.Router();
const pool = require("../db");
const { requireAuth, requireRole } = require("../middlewares/authMiddleware");

/* ================= HELPERS ================= */
const toInt = (v) => {
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
};

const toStr = (v) => String(v ?? "").trim();
const norm = (v) => toStr(v).toLowerCase();

const asObject = (v) => {
  if (!v) return {};
  if (typeof v === "object") return v;
  try {
    return JSON.parse(v);
  } catch {
    return {};
  }
};

const roleLower = (req) => toStr(req.user?.role).toLowerCase();
const isBranchManager = (req) => roleLower(req) === "branch manager";

/* =========================================================
   GET ALL PENDING STAFF
   (Branch Manager = only their branch)
========================================================= */
router.get(
  "/pending-staff",
  requireAuth,
  requireRole(["admin", "hr", "accounting", "branch manager"]),
  async (req, res) => {
    try {
      const userBranch = toStr(req.user?.branch_id);

      const result = await pool.query(`
        SELECT
          id,
          payload,
          status,
          created_by,
          approved_by,
          approved_at,
          rejected_at,
          rejection_reason,
          created_at
        FROM public.pending_staff_requests
        WHERE LOWER(COALESCE(status, '')) = 'pending'
        ORDER BY created_at DESC, id DESC
      `);

      let rows = result.rows.map((row) => {
        const payload = asObject(row.payload);
        return {
          ...row,
          payload,
        };
      });

      /* 🔥 FILTER FOR BRANCH MANAGER */
      if (isBranchManager(req)) {
        rows = rows.filter((r) => {
          const branch = toStr(r.payload?.branch_id || r.payload?.branch_code);
          return branch === userBranch;
        });
      }

      return res.json(rows);
    } catch (err) {
      console.error("GET /pending-staff error:", err);
      return res.status(500).json({ message: "Failed to load pending staff requests" });
    }
  }
);

/* =========================================================
   GET ONE
========================================================= */
router.get(
  "/pending-staff/:id",
  requireAuth,
  requireRole(["admin", "hr", "accounting", "branch manager"]),
  async (req, res) => {
    try {
      const id = toInt(req.params.id);
      if (!id) {
        return res.status(400).json({ message: "Invalid pending staff request id" });
      }

      const result = await pool.query(
        `
        SELECT *
        FROM public.pending_staff_requests
        WHERE id = $1
        LIMIT 1
        `,
        [id]
      );

      if (!result.rows.length) {
        return res.status(404).json({ message: "Pending staff request not found" });
      }

      const row = result.rows[0];
      const payload = asObject(row.payload);

      /* 🔥 BRANCH MANAGER RESTRICTION */
      if (isBranchManager(req)) {
        const userBranch = toStr(req.user?.branch_id);
        const branch = toStr(payload?.branch_id || payload?.branch_code);

        if (branch !== userBranch) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      return res.json({
        ...row,
        payload,
      });
    } catch (err) {
      console.error("GET /pending-staff/:id error:", err);
      return res.status(500).json({ message: "Failed to load pending staff request" });
    }
  }
);

/* =========================================================
   UPDATE (EDIT)
========================================================= */
router.put(
  "/pending-staff/:id",
  requireAuth,
  requireRole(["admin", "hr", "accounting", "branch manager"]),
  async (req, res) => {
    try {
      const id = toInt(req.params.id);
      if (!id) {
        return res.status(400).json({ message: "Invalid pending staff request id" });
      }

      const existingQ = await pool.query(
        `
        SELECT id, payload, status
        FROM public.pending_staff_requests
        WHERE id = $1
        LIMIT 1
        `,
        [id]
      );

      if (!existingQ.rows.length) {
        return res.status(404).json({ message: "Pending staff request not found" });
      }

      const existing = existingQ.rows[0];

      if (norm(existing.status) !== "pending") {
        return res.status(400).json({ message: "Only pending requests can be edited" });
      }

      const payloadOld = asObject(existing.payload);

      /* 🔥 BRANCH MANAGER CAN ONLY EDIT OWN BRANCH */
      if (isBranchManager(req)) {
        const userBranch = toStr(req.user?.branch_id);
        const branch = toStr(payloadOld?.branch_id || payloadOld?.branch_code);

        if (branch !== userBranch) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const incoming = req.body?.payload ?? req.body ?? {};
      const payload = asObject(incoming);

      const last_name = toStr(payload.last_name);
      const first_name = toStr(payload.first_name);
      const position = toStr(payload.position);

      if (!last_name || !first_name || !position) {
        return res.status(400).json({
          message: "last_name, first_name, and position are required",
        });
      }

      const employeeNo = toStr(payload.employee_no);
      if (employeeNo) {
        const dupStaff = await pool.query(
          `
          SELECT 1
          FROM public.staff
          WHERE LOWER(TRIM(employee_no)) = LOWER(TRIM($1))
          LIMIT 1
          `,
          [employeeNo]
        );

        if (dupStaff.rowCount > 0) {
          return res.status(409).json({ message: "Employee No already exists in staff" });
        }
      }

      const result = await pool.query(
        `
        UPDATE public.pending_staff_requests
        SET payload = $1::jsonb
        WHERE id = $2
        RETURNING *
        `,
        [JSON.stringify(payload), id]
      );

      return res.json({
        message: "Pending staff request updated successfully",
        request: {
          ...result.rows[0],
          payload: asObject(result.rows[0].payload),
        },
      });
    } catch (err) {
      console.error("PUT /pending-staff/:id error:", err);
      return res.status(500).json({ message: "Failed to update pending staff request" });
    }
  }
);

/* =========================================================
   APPROVE (ADMIN ONLY)
========================================================= */
router.put(
  "/pending-staff/:id/approve",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    try {
      const id = toInt(req.params.id);
      if (!id) {
        return res.status(400).json({ message: "Invalid pending staff request id" });
      }

      const result = await pool.query(
        `
        UPDATE public.pending_staff_requests
        SET
          status = 'Approved',
          approved_by = $1,
          approved_at = NOW(),
          rejected_at = NULL,
          rejection_reason = NULL
        WHERE id = $2
          AND LOWER(COALESCE(status, '')) = 'pending'
        RETURNING *
        `,
        [req.user?.id || null, id]
      );

      if (!result.rows.length) {
        return res.status(404).json({
          message: "Pending staff request not found or already processed",
        });
      }

      return res.json({ message: "Pending staff approved successfully" });
    } catch (err) {
      console.error("PUT /pending-staff/:id/approve error:", err);
      return res.status(500).json({ message: "Failed to approve pending staff" });
    }
  }
);

/* =========================================================
   REJECT (ADMIN ONLY)
========================================================= */
router.put(
  "/pending-staff/:id/reject",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    try {
      const id = toInt(req.params.id);
      if (!id) {
        return res.status(400).json({ message: "Invalid pending staff request id" });
      }

      const rejection_reason = toStr(req.body?.rejection_reason) || null;

      const result = await pool.query(
        `
        UPDATE public.pending_staff_requests
        SET
          status = 'Rejected',
          rejected_at = NOW(),
          rejection_reason = $1,
          approved_by = NULL,
          approved_at = NULL
        WHERE id = $2
          AND LOWER(COALESCE(status, '')) = 'pending'
        RETURNING *
        `,
        [rejection_reason, id]
      );

      if (!result.rows.length) {
        return res.status(404).json({
          message: "Pending staff request not found or already processed",
        });
      }

      return res.json({ message: "Pending staff rejected successfully" });
    } catch (err) {
      console.error("PUT /pending-staff/:id/reject error:", err);
      return res.status(500).json({ message: "Failed to reject pending staff" });
    }
  }
);

module.exports = router;