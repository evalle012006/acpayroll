const express = require("express");
const router = express.Router();
const pool = require("../db");
const { requireAuth } = require("../middlewares/authMiddleware");

const toStr = (v) => String(v ?? "").trim();
const norm = (v) => toStr(v).toLowerCase();
const toInt = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

const roleLower = (req) => norm(req.user?.role);
const isAdminLike = (req) => {
  const r = roleLower(req);
  return r === "admin" || r === "hr" || r === "accounting";
};

const getUserBranchId = (req) => toInt(req.user?.branch_id);

router.get("/notifications", requireAuth, async (req, res) => {
  try {
    const limit = Math.min(toInt(req.query.limit) || 20, 100);
    const role = roleLower(req);
    const userBranchId = getUserBranchId(req);

    let query = `
      SELECT *
      FROM public.notifications
      WHERE 1=1
    `;
    const params = [];

    if (isAdminLike(req)) {
      query += `
        AND (
          scope IN ('all', 'admins', 'branch-or-admin')
          OR target_branch_id IS NULL
        )
      `;
    } else if (role === "branch manager") {
      if (!userBranchId) return res.json([]);
      params.push(userBranchId);
      query += `
        AND (
          scope = 'all'
          OR (scope IN ('branch', 'branch-or-admin') AND target_branch_id = $1)
        )
      `;
    } else {
      query += ` AND scope = 'all' `;
    }

    params.push(limit);
    query += ` ORDER BY created_at DESC LIMIT $${params.length}`;

    const result = await pool.query(query, params);
    return res.json(result.rows);
  } catch (err) {
    console.error("GET /api/notifications ERROR:", err.message);
    return res.status(500).json({ message: "Failed to load notifications." });
  }
});

router.get("/notifications/unread-count", requireAuth, async (req, res) => {
  try {
    const role = roleLower(req);
    const userBranchId = getUserBranchId(req);

    let query = `
      SELECT COUNT(*)::int AS unread_count
      FROM public.notifications
      WHERE is_read = FALSE
    `;
    const params = [];

    if (isAdminLike(req)) {
      query += `
        AND (
          scope IN ('all', 'admins', 'branch-or-admin')
          OR target_branch_id IS NULL
        )
      `;
    } else if (role === "branch manager") {
      if (!userBranchId) return res.json({ unread_count: 0 });
      params.push(userBranchId);
      query += `
        AND (
          scope = 'all'
          OR (scope IN ('branch', 'branch-or-admin') AND target_branch_id = $1)
        )
      `;
    } else {
      query += ` AND scope = 'all' `;
    }

    const result = await pool.query(query, params);
    return res.json(result.rows[0] || { unread_count: 0 });
  } catch (err) {
    console.error("GET /api/notifications/unread-count ERROR:", err.message);
    return res.status(500).json({ message: "Failed to load unread count." });
  }
});

router.put("/notifications/:id/read", requireAuth, async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (!id) {
      return res.status(400).json({ message: "Invalid notification id." });
    }

    const role = roleLower(req);
    const userBranchId = getUserBranchId(req);

    let query = `
      UPDATE public.notifications
      SET is_read = TRUE
      WHERE id = $1
    `;
    const params = [id];

    if (isAdminLike(req)) {
      query += `
        AND (
          scope IN ('all', 'admins', 'branch-or-admin')
          OR target_branch_id IS NULL
        )
      `;
    } else if (role === "branch manager") {
      if (!userBranchId) {
        return res.status(403).json({ message: "Access denied." });
      }
      params.push(userBranchId);
      query += `
        AND (
          scope = 'all'
          OR (scope IN ('branch', 'branch-or-admin') AND target_branch_id = $2)
        )
      `;
    } else {
      query += ` AND scope = 'all' `;
    }

    query += ` RETURNING *`;

    const result = await pool.query(query, params);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Notification not found." });
    }

    return res.json(result.rows[0]);
  } catch (err) {
    console.error("PUT /api/notifications/:id/read ERROR:", err.message);
    return res.status(500).json({ message: "Failed to update notification." });
  }
});

router.put("/notifications/read-all", requireAuth, async (req, res) => {
  try {
    const role = roleLower(req);
    const userBranchId = getUserBranchId(req);

    let query = `
      UPDATE public.notifications
      SET is_read = TRUE
      WHERE is_read = FALSE
    `;
    const params = [];

    if (isAdminLike(req)) {
      query += `
        AND (
          scope IN ('all', 'admins', 'branch-or-admin')
          OR target_branch_id IS NULL
        )
      `;
    } else if (role === "branch manager") {
      if (!userBranchId) {
        return res.json({ updated: 0 });
      }
      params.push(userBranchId);
      query += `
        AND (
          scope = 'all'
          OR (scope IN ('branch', 'branch-or-admin') AND target_branch_id = $1)
        )
      `;
    } else {
      query += ` AND scope = 'all' `;
    }

    const result = await pool.query(query, params);
    return res.json({ updated: result.rowCount || 0 });
  } catch (err) {
    console.error("PUT /api/notifications/read-all ERROR:", err.message);
    return res.status(500).json({ message: "Failed to mark notifications as read." });
  }
});

router.delete("/notifications/clear-all", requireAuth, async (req, res) => {
  try {
    const role = roleLower(req);
    const userBranchId = getUserBranchId(req);

    let query = `
      DELETE FROM public.notifications
      WHERE 1=1
    `;
    const params = [];

    if (isAdminLike(req)) {
      query += `
        AND (
          scope IN ('all', 'admins', 'branch-or-admin')
          OR target_branch_id IS NULL
        )
      `;
    } else if (role === "branch manager") {
      if (!userBranchId) {
        return res.json({ deleted: 0 });
      }
      params.push(userBranchId);
      query += `
        AND (
          scope = 'all'
          OR (scope IN ('branch', 'branch-or-admin') AND target_branch_id = $1)
        )
      `;
    } else {
      query += ` AND scope = 'all' `;
    }

    const result = await pool.query(query, params);
    return res.json({ deleted: result.rowCount || 0 });
  } catch (err) {
    console.error("DELETE /api/notifications/clear-all ERROR:", err.message);
    return res.status(500).json({ message: "Failed to clear notifications." });
  }
});

module.exports = router;