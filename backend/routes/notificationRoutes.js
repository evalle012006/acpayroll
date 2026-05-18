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

const getRole = (req) => norm(req.user?.role);

const isAdminLike = (req) => {
  const role = getRole(req);
  return ["admin", "it", "hr", "accounting"].includes(role);
};

const getUserBranchId = (req) => {
  const n = toInt(req.user?.branch_id);
  return n || null;
};
const getUserId = (req) => toInt(req.user?.id);

const buildVisibilityWhere = (req, startIndex = 1) => {
  const role = getRole(req);
  const userId = getUserId(req);
  const branchId = getUserBranchId(req);

  if (isAdminLike(req)) {
    return {
      where: `
        AND (
          LOWER(TRIM(COALESCE(scope, 'all'))) IN ('all', 'admins', 'admin', 'branch-or-admin')
          OR target_branch_id IS NULL
          OR LOWER(TRIM(COALESCE(role, ''))) = LOWER(TRIM($${startIndex}))
          OR user_id = $${startIndex + 1}
        )
      `,
      params: [role, userId],
    };
  }

  if (role === "branch manager") {
    return {
      where: `
        AND (
          LOWER(TRIM(COALESCE(scope, 'all'))) = 'all'
          OR user_id = $${startIndex}
          OR LOWER(TRIM(COALESCE(role, ''))) = LOWER(TRIM($${startIndex + 1}))
          OR (
            LOWER(TRIM(COALESCE(scope, ''))) IN ('branch', 'branch-or-admin')
            AND target_branch_id = NULLIF($${startIndex + 2}, '')::int
          )
        )
      `,
      params: [userId, role, branchId],
    };
  }

  return {
    where: `
      AND (
        LOWER(TRIM(COALESCE(scope, 'all'))) = 'all'
        OR user_id = $${startIndex}
        OR LOWER(TRIM(COALESCE(role, ''))) = LOWER(TRIM($${startIndex + 1}))
      )
    `,
    params: [userId, role],
  };
};

/*
|--------------------------------------------------------------------------
| GET NOTIFICATIONS
|--------------------------------------------------------------------------
*/

router.get("/notifications", requireAuth, async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 50);

    const visibility = buildVisibilityWhere(req, 1);
    const params = [...visibility.params, limit];
    const limitIndex = params.length;

    const result = await pool.query(
      `
      SELECT
        id,
        user_id,
        role,
        department,
        scope,
        title,
        message,
        link,
        target_branch_id,
        target_branch_code,
        target_branch_name,
        is_read,
        created_at
      FROM public.notifications
      WHERE 1=1
      ${visibility.where}
      ORDER BY created_at DESC, id DESC
      LIMIT $${limitIndex}
      `,
      params
    );

    return res.json(result.rows);
  } catch (err) {
    console.error("GET /notifications ERROR:", err.message);
    return res.status(500).json({
      message: err.message || "Failed to load notifications.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| UNREAD COUNT
|--------------------------------------------------------------------------
*/

router.get("/notifications/unread-count", requireAuth, async (req, res) => {
  try {
    const visibility = buildVisibilityWhere(req, 1);

    const result = await pool.query(
      `
      SELECT COUNT(*)::int AS unread_count
      FROM public.notifications
      WHERE is_read = FALSE
      ${visibility.where}
      `,
      visibility.params
    );

    return res.json(result.rows[0] || { unread_count: 0 });
  } catch (err) {
    console.error("GET /notifications/unread-count ERROR:", err.message);
    return res.status(500).json({
      message: "Failed to load unread count.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| MARK ONE READ
|--------------------------------------------------------------------------
*/

router.put("/notifications/:id/read", requireAuth, async (req, res) => {
  try {
    const id = toInt(req.params.id);

    if (!id) {
      return res.status(400).json({
        message: "Invalid notification id.",
      });
    }

    const visibility = buildVisibilityWhere(req, 2);

    const result = await pool.query(
      `
      UPDATE public.notifications
      SET is_read = TRUE
      WHERE id = $1
      ${visibility.where}
      RETURNING *
      `,
      [id, ...visibility.params]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        message: "Notification not found.",
      });
    }

    return res.json(result.rows[0]);
  } catch (err) {
    console.error("PUT /notifications/:id/read ERROR:", err.message);
    return res.status(500).json({
      message: "Failed to update notification.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| MARK ALL READ
|--------------------------------------------------------------------------
*/

router.put("/notifications/read-all", requireAuth, async (req, res) => {
  try {
    const visibility = buildVisibilityWhere(req, 1);

    const result = await pool.query(
      `
      UPDATE public.notifications
      SET is_read = TRUE
      WHERE is_read = FALSE
      ${visibility.where}
      `,
      visibility.params
    );

    return res.json({
      updated: result.rowCount || 0,
    });
  } catch (err) {
    console.error("PUT /notifications/read-all ERROR:", err.message);
    return res.status(500).json({
      message: "Failed to mark notifications as read.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| CLEAR VISIBLE NOTIFICATIONS
|--------------------------------------------------------------------------
*/

router.delete("/notifications/clear-all", requireAuth, async (req, res) => {
  try {
    const visibility = buildVisibilityWhere(req, 1);

    const result = await pool.query(
      `
      DELETE FROM public.notifications
      WHERE 1=1
      ${visibility.where}
      `,
      visibility.params
    );

    return res.json({
      deleted: result.rowCount || 0,
    });
  } catch (err) {
    console.error("DELETE /notifications/clear-all ERROR:", err.message);
    return res.status(500).json({
      message: "Failed to clear notifications.",
    });
  }
});

module.exports = router;