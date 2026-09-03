const express = require("express");
const router = express.Router();

const pool = require("../db");

const { requireAuth } =
  require("../middlewares/authMiddleware");

const {
  toStr,
  isValidId,
  calculateInclusiveDays,
  normalizeDepartment,
  normalizeRole,
  canViewTravelModule,
  canManageCalendarActivity,
  sendServerError,
} = require("../utils/travelPlanHelpers");

// =====================================================
// GET ALL CALENDAR ACTIVITIES
// =====================================================

router.get(
  "/calendar-activities",
  requireAuth,
  async (req, res) => {
    try {
      if (!canViewTravelModule(req)) {
        return res.status(403).json({
          message:
            "You are not allowed to view calendar activities.",
        });
      }

      const result = await pool.query(`
        SELECT
          id,
          title,

          TO_CHAR(
            date_from,
            'YYYY-MM-DD'
          ) AS date_from,

          TO_CHAR(
            date_to,
            'YYYY-MM-DD'
          ) AS date_to,

          days,
          subject,
          venue,
          description,
          created_by,
          created_at,
          updated_at

        FROM public.calendar_activities

        ORDER BY
          date_from DESC,
          date_to DESC,
          id DESC
      `);

      return res.json(result.rows);
    } catch (error) {
      return sendServerError(
        res,
        "GET /calendar-activities",
        error
      );
    }
  }
);

// =====================================================
// GET ONE CALENDAR ACTIVITY
// =====================================================

router.get(
  "/calendar-activities/:id",
  requireAuth,
  async (req, res) => {
    try {
      if (!canViewTravelModule(req)) {
        return res.status(403).json({
          message:
            "You are not allowed to view this calendar activity.",
        });
      }

      const activityId = Number(req.params.id);

      if (!isValidId(activityId)) {
        return res.status(400).json({
          message: "Invalid calendar activity ID.",
        });
      }

      const result = await pool.query(
        `
        SELECT
          id,
          title,

          TO_CHAR(
            date_from,
            'YYYY-MM-DD'
          ) AS date_from,

          TO_CHAR(
            date_to,
            'YYYY-MM-DD'
          ) AS date_to,

          days,
          subject,
          venue,
          description,
          created_by,
          created_at,
          updated_at

        FROM public.calendar_activities

        WHERE id = $1

        LIMIT 1
        `,
        [activityId]
      );

      if (!result.rowCount) {
        return res.status(404).json({
          message: "Calendar activity not found.",
        });
      }

      return res.json(result.rows[0]);
    } catch (error) {
      return sendServerError(
        res,
        "GET /calendar-activities/:id",
        error
      );
    }
  }
);

// =====================================================
// CREATE CALENDAR ACTIVITY
// =====================================================

router.post(
  "/calendar-activities",
  requireAuth,
  async (req, res) => {
    try {
      if (!canManageCalendarActivity(req)) {
        return res.status(403).json({
          message:
            "Only Admin and TREAD Department can create calendar activities.",
        });
      }

      const title = toStr(req.body.title);
      const dateFrom = toStr(req.body.date_from);
      const dateTo = toStr(req.body.date_to);

      const subject = toStr(req.body.subject);
      const venue = toStr(req.body.venue);
      const description = toStr(req.body.description);

      if (!title) {
        return res.status(400).json({
          message: "Title is required.",
        });
      }

      if (!dateFrom) {
        return res.status(400).json({
          message: "Date From is required.",
        });
      }

      if (!dateTo) {
        return res.status(400).json({
          message: "Date To is required.",
        });
      }

      const days = calculateInclusiveDays(dateFrom, dateTo);

      if (!days) {
        return res.status(400).json({
          message:
            "Date To cannot be earlier than Date From.",
        });
      }

      const result = await pool.query(
        `
        INSERT INTO public.calendar_activities
        (
          title,
          date_from,
          date_to,
          days,
          subject,
          venue,
          description,
          created_by,
          created_at,
          updated_at
        )
        VALUES
        (
          $1,
          $2::date,
          $3::date,
          $4,
          $5,
          $6,
          $7,
          $8,
          NOW() AT TIME ZONE 'Asia/Manila',
          NOW() AT TIME ZONE 'Asia/Manila'
        )
        RETURNING
          id,
          title,

          TO_CHAR(
            date_from,
            'YYYY-MM-DD'
          ) AS date_from,

          TO_CHAR(
            date_to,
            'YYYY-MM-DD'
          ) AS date_to,

          days,
          subject,
          venue,
          description,
          created_by,
          created_at,
          updated_at
        `,
        [
          title,
          dateFrom,
          dateTo,
          days,
          subject || null,
          venue || null,
          description || null,
          req.user?.id || null,
        ]
      );

      return res.status(201).json({
        message:
          "Calendar activity created successfully.",
        activity: result.rows[0],
      });
    } catch (error) {
      return sendServerError(
        res,
        "POST /calendar-activities",
        error
      );
    }
  }
);

// =====================================================
// UPDATE CALENDAR ACTIVITY
// =====================================================

router.put(
  "/calendar-activities/:id",
  requireAuth,
  async (req, res) => {
    try {
      if (!canManageCalendarActivity(req)) {
        return res.status(403).json({
          message:
            "Only Admin and TREAD Department can edit calendar activities.",
        });
      }

      const activityId = Number(req.params.id);

      if (!isValidId(activityId)) {
        return res.status(400).json({
          message: "Invalid calendar activity ID.",
        });
      }

      const title = toStr(req.body.title);
      const dateFrom = toStr(req.body.date_from);
      const dateTo = toStr(req.body.date_to);

      const subject = toStr(req.body.subject);
      const venue = toStr(req.body.venue);
      const description = toStr(req.body.description);

      if (!title) {
        return res.status(400).json({
          message: "Title is required.",
        });
      }

      if (!dateFrom) {
        return res.status(400).json({
          message: "Date From is required.",
        });
      }

      if (!dateTo) {
        return res.status(400).json({
          message: "Date To is required.",
        });
      }

      const days = calculateInclusiveDays(
        dateFrom,
        dateTo
      );

      if (!days) {
        return res.status(400).json({
          message:
            "Date To cannot be earlier than Date From.",
        });
      }

      const result = await pool.query(
        `
        UPDATE public.calendar_activities

        SET
          title = $2,
          date_from = $3::date,
          date_to = $4::date,
          days = $5,
          subject = $6,
          venue = $7,
          description = $8,
          updated_at =
            NOW() AT TIME ZONE 'Asia/Manila'

        WHERE id = $1

        RETURNING
          id,
          title,

          TO_CHAR(
            date_from,
            'YYYY-MM-DD'
          ) AS date_from,

          TO_CHAR(
            date_to,
            'YYYY-MM-DD'
          ) AS date_to,

          days,
          subject,
          venue,
          description,
          created_by,
          created_at,
          updated_at
        `,
        [
          activityId,
          title,
          dateFrom,
          dateTo,
          days,
          subject || null,
          venue || null,
          description || null,
        ]
      );

      if (!result.rowCount) {
        return res.status(404).json({
          message: "Calendar activity not found.",
        });
      }

      return res.json({
        message:
          "Calendar activity updated successfully.",
        activity: result.rows[0],
      });
    } catch (error) {
      return sendServerError(
        res,
        "PUT /calendar-activities/:id",
        error
      );
    }
  }
);

// =====================================================
// DELETE CALENDAR ACTIVITY
// =====================================================

router.delete(
  "/calendar-activities/:id",
  requireAuth,
  async (req, res) => {
    try {
      if (!canManageCalendarActivity(req)) {
        return res.status(403).json({
          message:
            "Only Admin and TREAD Department can delete calendar activities.",
        });
      }

      const activityId = Number(req.params.id);

      if (!isValidId(activityId)) {
        return res.status(400).json({
          message: "Invalid calendar activity ID.",
        });
      }

      const result = await pool.query(
        `
        DELETE FROM public.calendar_activities
        WHERE id = $1
        RETURNING id
        `,
        [activityId]
      );

      if (!result.rowCount) {
        return res.status(404).json({
          message: "Calendar activity not found.",
        });
      }

      return res.json({
        message:
          "Calendar activity deleted successfully.",
      });
    } catch (error) {
      return sendServerError(
        res,
        "DELETE /calendar-activities/:id",
        error
      );
    }
  }
);

module.exports = router;