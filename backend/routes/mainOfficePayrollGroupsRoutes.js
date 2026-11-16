const express = require("express");
const router = express.Router();
const pool = require("../db");
const {
  requireAuth,
  requireRole,
} = require("../middlewares/authMiddleware");

const toStr = (value) => String(value ?? "").trim();

const makeGroupKey = (name) =>
  name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const isAdmin = (req) =>
  String(req.user?.role || "").trim().toLowerCase() === "admin";

router.get("/", requireAuth, async (req, res) => {
  try {
    const includeInactive =
      req.query.include_inactive === "true" && isAdmin(req);

    const result = await pool.query(
      `
      SELECT id, group_key, group_name, sort_order, is_active
      FROM public.main_office_payroll_groups
      WHERE is_active = TRUE OR $1::boolean = TRUE
      ORDER BY sort_order, group_name
      `,
      [includeInactive]
    );

    return res.json(result.rows);
  } catch (err) {
    console.error("GET main office payroll groups:", err.message);
    return res.status(500).json({ message: "Server error" });
  }
});

router.post("/", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const groupName = toStr(req.body?.group_name);

    if (!groupName || groupName.length > 80) {
      return res.status(400).json({
        message: "Enter a payroll group name up to 80 characters.",
      });
    }

    const groupKey = makeGroupKey(groupName);

    if (!groupKey) {
      return res.status(400).json({
        message: "Enter a valid payroll group name.",
      });
    }

    const duplicate = await pool.query(
      `
      SELECT id
      FROM public.main_office_payroll_groups
      WHERE LOWER(TRIM(group_name)) = LOWER(TRIM($1))
      LIMIT 1
      `,
      [groupName]
    );

    if (duplicate.rowCount > 0) {
      return res.status(409).json({
        message: "That payroll group already exists.",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO public.main_office_payroll_groups
        (group_key, group_name, sort_order)
      VALUES (
        $1,
        $2,
        COALESCE(
          (SELECT MAX(sort_order) + 1
           FROM public.main_office_payroll_groups),
          1
        )
      )
      RETURNING id, group_key, group_name, sort_order, is_active
      `,
      [groupKey, groupName]
    );

    return res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({
        message: "That payroll group already exists.",
      });
    }

    console.error("POST main office payroll group:", err.message);
    return res.status(500).json({ message: "Server error" });
  }
});

router.put("/:id", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const groupName = toStr(req.body?.group_name);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid group ID." });
    }

    if (!groupName || groupName.length > 80) {
      return res.status(400).json({
        message: "Enter a payroll group name up to 80 characters.",
      });
    }

    const result = await pool.query(
      `
      UPDATE public.main_office_payroll_groups
      SET group_name = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING id, group_key, group_name, sort_order, is_active
      `,
      [id, groupName]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Payroll group not found." });
    }

    return res.json(result.rows[0]);
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({
        message: "That payroll group name already exists.",
      });
    }

    console.error("PUT main office payroll group:", err.message);
    return res.status(500).json({ message: "Server error" });
  }
});

router.patch(
  "/:id/status",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    try {
      const id = Number(req.params.id);
      const isActive = req.body?.is_active;

      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ message: "Invalid group ID." });
      }

      if (typeof isActive !== "boolean") {
        return res.status(400).json({
          message: "is_active must be true or false.",
        });
      }

      const result = await pool.query(
        `
        UPDATE public.main_office_payroll_groups
        SET is_active = $2, updated_at = NOW()
        WHERE id = $1
        RETURNING id, group_key, group_name, sort_order, is_active
        `,
        [id, isActive]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ message: "Payroll group not found." });
      }

      return res.json(result.rows[0]);
    } catch (err) {
      console.error("PATCH main office payroll group status:", err.message);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

// Assign or move a Main Office employee into this payroll group.
router.patch(
  "/:id/staff/:staffId",
  requireAuth,
  requireRole(["admin", "hr", "accounting"]),
  async (req, res) => {
    try {
      const groupId = Number(req.params.id);
      const staffId = Number(req.params.staffId);

      if (
        !Number.isInteger(groupId) || groupId <= 0 ||
        !Number.isInteger(staffId) || staffId <= 0
      ) {
        return res.status(400).json({ message: "Invalid group or staff ID." });
      }

      const groupResult = await pool.query(
        `
        SELECT id, group_key
        FROM public.main_office_payroll_groups
        WHERE id = $1 AND is_active = TRUE
        `,
        [groupId]
      );

      if (groupResult.rowCount === 0) {
        return res.status(404).json({ message: "Active payroll group not found." });
      }

      const group = groupResult.rows[0];

      const staffResult = await pool.query(
        `
        UPDATE public.staff AS s
        SET payroll_group_id = $1,
            payroll_group = $2
        FROM public.branches AS b
        WHERE s.id = $3
          AND s.branch_id = b.id
          AND UPPER(TRIM(b.code)) = 'B000'
        RETURNING s.id, s.employee_no, s.payroll_group_id, s.payroll_group
        `,
        [group.id, group.group_key, staffId]
      );

      if (staffResult.rowCount === 0) {
        return res.status(404).json({
          message: "Main Office staff member not found.",
        });
      }

      return res.json(staffResult.rows[0]);
    } catch (err) {
      console.error("Assign Main Office payroll staff:", err.message);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

// Remove an employee from this group only.
// This does not delete the employee or change their branch.
router.delete(
  "/:id/staff/:staffId",
  requireAuth,
  requireRole(["admin", "hr", "accounting"]),
  async (req, res) => {
    try {
      const groupId = Number(req.params.id);
      const staffId = Number(req.params.staffId);

      if (
        !Number.isInteger(groupId) || groupId <= 0 ||
        !Number.isInteger(staffId) || staffId <= 0
      ) {
        return res.status(400).json({ message: "Invalid group or staff ID." });
      }

      const staffResult = await pool.query(
        `
        UPDATE public.staff AS s
        SET payroll_group_id = NULL,
            payroll_group = NULL
        FROM public.branches AS b
        WHERE s.id = $1
          AND s.payroll_group_id = $2
          AND s.branch_id = b.id
          AND UPPER(TRIM(b.code)) = 'B000'
        RETURNING s.id, s.employee_no
        `,
        [staffId, groupId]
      );

      if (staffResult.rowCount === 0) {
        return res.status(404).json({
          message: "Staff member is not assigned to this payroll group.",
        });
      }

      return res.json({
        message: "Staff member removed from the payroll group.",
        staff: staffResult.rows[0],
      });
    } catch (err) {
      console.error("Remove Main Office payroll staff:", err.message);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

module.exports = router;