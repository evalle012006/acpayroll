const express = require("express");
const router = express.Router();

const pool = require("../db");

const { requireAuth } =
  require("../middlewares/authMiddleware");

const {
  uploadPhotosToTemp,
  moveFromTempKeepExisting,
  getSignedDownloadUrl,
  deleteKey,
} = require("../services/spacesUpload");

const {
  toStr,
  norm,
  isValidId,
  toNullableNumber,
  canViewTravelModule,
  canUploadPlanPhoto,
  canDeleteTravelRecord,
  sendServerError,
  manilaTimestampSql,
} = require("../utils/travelPlanHelpers");

// =====================================================
// GET TRAVEL PLAN PHOTOS
// =====================================================

router.get("/travel-plans/:id/photos", requireAuth, async (req, res) => {
  try {
    if (!canViewTravelModule(req)) {
      return res.status(403).json({
        message: "You are not allowed to view travel plan photos.",
      });
    }

    const travelPlanId = Number(req.params.id);

    if (!isValidId(travelPlanId)) {
      return res.status(400).json({
        message: "Invalid travel plan ID.",
      });
    }

    const planResult = await pool.query(
      `
      SELECT id
      FROM public.travel_plans
      WHERE id = $1
      LIMIT 1
      `,
      [travelPlanId]
    );

    if (!planResult.rowCount) {
      return res.status(404).json({
        message: "Travel plan not found.",
      });
    }

    const result = await pool.query(
      `
      SELECT
        id,
        travel_plan_id,
        photo_type,
        photo_url,
        latitude,
        longitude,

        CASE
          WHEN captured_at IS NULL THEN NULL
          ELSE
            TO_CHAR(
              captured_at,
              'YYYY-MM-DD"T"HH24:MI:SS.MS'
            ) || '+08:00'
        END AS captured_at,

        uploaded_by,

        CASE
          WHEN created_at IS NULL THEN NULL
          ELSE
            TO_CHAR(
              created_at,
              'YYYY-MM-DD"T"HH24:MI:SS.MS'
            ) || '+08:00'
        END AS created_at

      FROM public.travel_plan_photos
      WHERE travel_plan_id = $1
      ORDER BY
        CASE UPPER(TRIM(COALESCE(photo_type, '')))
          WHEN 'CHECK_IN' THEN 1
          WHEN 'GENERAL' THEN 2
          WHEN 'CHECK_OUT' THEN 3
          ELSE 4
        END,
        created_at ASC,
        id ASC
      `,
      [travelPlanId]
    );

    const photos = await Promise.all(
      result.rows.map(async (photo) => {
        let signedUrl = null;

        if (photo.photo_url) {
          try {
            signedUrl = await getSignedDownloadUrl(
              photo.photo_url,
              3600
            );
          } catch (signError) {
            console.error(
              "Failed to create signed URL:",
              photo.photo_url,
              signError
            );
          }
        }

        return {
          ...photo,
          signed_url: signedUrl,
        };
      })
    );

    return res.json(photos);
  } catch (error) {
    return sendServerError(
      res,
      "GET /travel-plans/:id/photos",
      error
    );
  }
});

// =====================================================
// UPLOAD TRAVEL PLAN PHOTOS
// =====================================================

router.post(
  "/travel-plans/:id/photos",
  requireAuth,
  uploadPhotosToTemp,
  async (req, res) => {
    const uploadedKeys = [];

    try {
      if (!canUploadPlanPhoto(req)) {
        return res.status(403).json({
          message: "You are not allowed to upload travel plan photos.",
        });
      }

      const travelPlanId = Number(req.params.id);

      if (!isValidId(travelPlanId)) {
        return res.status(400).json({
          message: "Invalid travel plan ID.",
        });
      }

      if (!Array.isArray(req.files) || req.files.length === 0) {
        return res.status(400).json({
          message: "At least one photo is required.",
        });
      }

      const photoType = toStr(req.body.type || "GENERAL").toUpperCase();

      const allowedPhotoTypes = [
        "GENERAL",
        "CHECK_IN",
        "CHECK_OUT",
      ];

      if (!allowedPhotoTypes.includes(photoType)) {
        return res.status(400).json({
          message:
            "Photo type must be GENERAL, CHECK_IN, or CHECK_OUT.",
        });
      }

      const latitude = toNullableNumber(req.body.latitude);
      const longitude = toNullableNumber(req.body.longitude);

      const planResult = await pool.query(
        `
        SELECT
          id,
          status,
          plan_date
        FROM public.travel_plans
        WHERE id = $1
        LIMIT 1
        `,
        [travelPlanId]
      );

      if (!planResult.rowCount) {
        return res.status(404).json({
          message: "Travel plan not found.",
        });
      }

      const plan = planResult.rows[0];

      const todayResult = await pool.query(`
        SELECT (
          NOW() AT TIME ZONE 'Asia/Manila'
        )::date AS today
      `);

      const today = String(
        todayResult.rows[0]?.today || ""
      ).slice(0, 10);

      const planDate = String(
        plan.plan_date || ""
      ).slice(0, 10);

      const planStatus = norm(plan.status);

      if (planStatus === "completed") {
        return res.status(400).json({
          message:
            "Photos cannot be added to a completed travel plan.",
        });
      }

      if (
        planStatus === "incomplete" ||
        (
          planStatus === "pending" &&
          planDate &&
          planDate < today
        )
      ) {
        await pool.query(
          `
          UPDATE public.travel_plans
          SET
            status = 'Incomplete',
            updated_at =
              NOW() AT TIME ZONE 'Asia/Manila'
          WHERE id = $1
          `,
          [travelPlanId]
        );

        return res.status(400).json({
          message:
            "This travel plan is incomplete. Photos can no longer be uploaded.",
        });
      }

      const insertedPhotos = [];

      for (const file of req.files) {
        const originalName =
          toStr(file.originalname) || `photo-${Date.now()}.jpg`;

        const photoKey = await moveFromTempKeepExisting(
          file.key,
          "travel-plans",
          String(travelPlanId),
          originalName
        );

        uploadedKeys.push(photoKey);

        const result = await pool.query(
          `
          INSERT INTO public.travel_plan_photos
          (
            travel_plan_id,
            photo_type,
            photo_url,
            latitude,
            longitude,
            captured_at,
            uploaded_by,
            created_at
          )
          VALUES
          (
            $1,
            $2,
            $3,
            $4,
            $5,
            NOW() AT TIME ZONE 'Asia/Manila',
            $6,
            NOW() AT TIME ZONE 'Asia/Manila'
          )
          RETURNING
            id,
            travel_plan_id,
            photo_type,
            photo_url,
            latitude,
            longitude,

            CASE
              WHEN captured_at IS NULL THEN NULL
              ELSE
                TO_CHAR(
                  captured_at,
                  'YYYY-MM-DD"T"HH24:MI:SS.MS'
                ) || '+08:00'
            END AS captured_at,

            uploaded_by,

            CASE
              WHEN created_at IS NULL THEN NULL
              ELSE
                TO_CHAR(
                  created_at,
                  'YYYY-MM-DD"T"HH24:MI:SS.MS'
                ) || '+08:00'
            END AS created_at
          `,
          [
            travelPlanId,
            photoType,
            photoKey,
            latitude,
            longitude,
            req.user?.id || null,
          ]
        );

        insertedPhotos.push(result.rows[0]);
      }

      if (photoType === "CHECK_IN" && insertedPhotos.length > 0) {
        await pool.query(
          `
          UPDATE public.travel_plans
          SET
            check_in_photo_url = COALESCE(check_in_photo_url, $2),
            check_in_at = COALESCE(
              check_in_at,
              NOW() AT TIME ZONE 'Asia/Manila'
            ),
            check_in_latitude = COALESCE(check_in_latitude, $3),
            check_in_longitude = COALESCE(check_in_longitude, $4),
            updated_at = NOW() AT TIME ZONE 'Asia/Manila'
          WHERE id = $1
          `,
          [
            travelPlanId,
            insertedPhotos[0].photo_url,
            latitude,
            longitude,
          ]
        );
      }

      if (photoType === "CHECK_OUT" && insertedPhotos.length > 0) {
        await pool.query(
          `
          UPDATE public.travel_plans
          SET
            check_out_photo_url = COALESCE(check_out_photo_url, $2),
            check_out_at = COALESCE(
              check_out_at,
              NOW() AT TIME ZONE 'Asia/Manila'
            ),
            check_out_latitude = COALESCE(check_out_latitude, $3),
            check_out_longitude = COALESCE(check_out_longitude, $4),
            updated_at = NOW() AT TIME ZONE 'Asia/Manila'
          WHERE id = $1
          `,
          [
            travelPlanId,
            insertedPhotos[0].photo_url,
            latitude,
            longitude,
          ]
        );
      }

      if (photoType === "GENERAL" && insertedPhotos.length > 0) {
        await pool.query(
          `
          UPDATE public.travel_plans
          SET
            photo_url = COALESCE(photo_url, $2),
            photo_uploaded_at = COALESCE(
              photo_uploaded_at,
              NOW() AT TIME ZONE 'Asia/Manila'
            ),
            photo_latitude = COALESCE(photo_latitude, $3),
            photo_longitude = COALESCE(photo_longitude, $4),
            updated_at = NOW() AT TIME ZONE 'Asia/Manila'
          WHERE id = $1
          `,
          [
            travelPlanId,
            insertedPhotos[0].photo_url,
            latitude,
            longitude,
          ]
        );
      }

      const photosWithSignedUrls = await Promise.all(
        insertedPhotos.map(async (photo) => ({
          ...photo,
          signed_url: photo.photo_url
            ? await getSignedDownloadUrl(photo.photo_url, 3600)
            : null,
        }))
      );

      return res.status(201).json({
        message: "Travel plan photos uploaded successfully.",
        photos: photosWithSignedUrls,
      });
    } catch (error) {
      for (const key of uploadedKeys) {
        try {
          await deleteKey(key);
        } catch (cleanupError) {
          console.error(
            "Failed to clean up uploaded photo:",
            key,
            cleanupError
          );
        }
      }

      return sendServerError(
        res,
        "POST /travel-plans/:id/photos",
        error
      );
    }
  }
);

// =====================================================
// DELETE TRAVEL PLAN PHOTO
// =====================================================

router.delete(
  "/travel-plans/photos/:photoId",
  requireAuth,
  async (req, res) => {
    const client = await pool.connect();

    try {
      if (!canUploadPlanPhoto(req) && !canDeleteTravelRecord(req)) {
        return res.status(403).json({
          message: "You are not allowed to delete travel plan photos.",
        });
      }

      const photoId = Number(req.params.photoId);

      if (!isValidId(photoId)) {
        return res.status(400).json({
          message: "Invalid photo ID.",
        });
      }

      await client.query("BEGIN");

      const existingResult = await client.query(
        `
        SELECT
          p.id,
          p.travel_plan_id,
          p.photo_type,
          p.photo_url,
          tp.status
        FROM public.travel_plan_photos p
        INNER JOIN public.travel_plans tp
          ON tp.id = p.travel_plan_id
        WHERE p.id = $1
        LIMIT 1
        `,
        [photoId]
      );

      if (!existingResult.rowCount) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          message: "Travel plan photo not found.",
        });
      }

      const existingPhoto = existingResult.rows[0];

      if (
        norm(existingPhoto.status) === "completed" &&
        !canDeleteTravelRecord(req)
      ) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message:
            "Only Admin can delete photos from completed travel plans.",
        });
      }

      await client.query(
        `
        DELETE FROM public.travel_plan_photos
        WHERE id = $1
        `,
        [photoId]
      );

      const nextPhotoResult = await client.query(
        `
        SELECT
          photo_url,
          latitude,
          longitude,
          captured_at
        FROM public.travel_plan_photos
        WHERE travel_plan_id = $1
          AND UPPER(TRIM(COALESCE(photo_type, ''))) = $2
        ORDER BY
          created_at ASC,
          id ASC
        LIMIT 1
        `,
        [
          existingPhoto.travel_plan_id,
          toStr(existingPhoto.photo_type).toUpperCase(),
        ]
      );

      const nextPhoto = nextPhotoResult.rows[0] || null;
      const deletedType = toStr(existingPhoto.photo_type).toUpperCase();

      if (deletedType === "CHECK_IN") {
        await client.query(
          `
          UPDATE public.travel_plans
          SET
            check_in_photo_url = $2,
            check_in_at = $3,
            check_in_latitude = $4,
            check_in_longitude = $5,
            updated_at = NOW() AT TIME ZONE 'Asia/Manila'
          WHERE id = $1
          `,
          [
            existingPhoto.travel_plan_id,
            nextPhoto?.photo_url || null,
            nextPhoto?.captured_at || null,
            nextPhoto?.latitude || null,
            nextPhoto?.longitude || null,
          ]
        );
      }

      if (deletedType === "CHECK_OUT") {
        await client.query(
          `
          UPDATE public.travel_plans
          SET
            check_out_photo_url = $2,
            check_out_at = $3,
            check_out_latitude = $4,
            check_out_longitude = $5,
            updated_at = NOW() AT TIME ZONE 'Asia/Manila'
          WHERE id = $1
          `,
          [
            existingPhoto.travel_plan_id,
            nextPhoto?.photo_url || null,
            nextPhoto?.captured_at || null,
            nextPhoto?.latitude || null,
            nextPhoto?.longitude || null,
          ]
        );
      }

      if (deletedType === "GENERAL") {
        await client.query(
          `
          UPDATE public.travel_plans
          SET
            photo_url = $2,
            photo_uploaded_at = $3,
            photo_latitude = $4,
            photo_longitude = $5,
            updated_at = NOW() AT TIME ZONE 'Asia/Manila'
          WHERE id = $1
          `,
          [
            existingPhoto.travel_plan_id,
            nextPhoto?.photo_url || null,
            nextPhoto?.captured_at || null,
            nextPhoto?.latitude || null,
            nextPhoto?.longitude || null,
          ]
        );
      }

      await client.query("COMMIT");

      if (existingPhoto.photo_url) {
        try {
          await deleteKey(existingPhoto.photo_url);
        } catch (deleteError) {
          console.error(
            "Failed to delete photo from storage:",
            existingPhoto.photo_url,
            deleteError
          );
        }
      }

      return res.json({
        message: "Travel plan photo deleted successfully.",
      });
    } catch (error) {
      await client.query("ROLLBACK");

      return sendServerError(
        res,
        "DELETE /travel-plans/photos/:photoId",
        error
      );
    } finally {
      client.release();
    }
  }
);

module.exports = router;