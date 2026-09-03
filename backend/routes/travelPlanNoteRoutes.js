const express = require("express");
const router = express.Router();

const pool = require("../db");

const { requireAuth } = require("../middlewares/authMiddleware");
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
  canViewTravelModule,
  canEditPlan,
  canDeleteTravelRecord,
  syncFindingCompliances,
  sendServerError,
} = require("../utils/travelPlanHelpers");

// =====================================================
// CREATE TRAVEL PLAN NOTE
// =====================================================

router.post(
  "/travel-plans/:id/notes",
  requireAuth,
  uploadPhotosToTemp,
  async (req, res) => {
    const client = await pool.connect();

    try {
      if (!canEditPlan(req)) {
        return res.status(403).json({
          message:
            "You are not allowed to add notes.",
        });
      }

      const travelPlanId = Number(
        req.params.id
      );

      if (!isValidId(travelPlanId)) {
        return res.status(400).json({
          message:
            "Invalid travel plan.",
        });
      }

      const noteType = toStr(
        req.body.note_type
      ).toUpperCase();

      const title = toStr(
        req.body.title
      );

      const passbookReconciliation =
        toStr(
          req.body.passbook_reconciliation
        );

      const pastDueDelinquentReport =
        toStr(
          req.body.past_due_delinquent_report
        );

      const groupCollectionRecord =
        toStr(
          req.body.group_collection_record
        );

      const otherFindings =
        toStr(
          req.body.other_findings
        );

      const involvedStaff =
        toStr(
          req.body.involved_staff
        );

      const dueDate =
        toStr(
          req.body.due_date
        );

      const reviewCoh =
        toStr(req.body.review_coh);

      const reviewCashbookVsVoucher =
        toStr(
          req.body.review_cashbook_vs_voucher
        );

      const reviewLor =
        toStr(req.body.review_lor);

      const reviewLos =
        toStr(req.body.review_los);

      const reviewLdf =
        toStr(req.body.review_ldf);

      const reviewDcs =
        toStr(req.body.review_dcs);

      const reviewBms =
        toStr(req.body.review_bms);

      const reviewOtherFindings =
        toStr(req.body.review_other_findings);

      let involvedStaffIds = [];

      try {
        involvedStaffIds =
          typeof req.body
            .involved_staff_ids ===
          "string"
            ? JSON.parse(
                req.body
                  .involved_staff_ids
              )
            : req.body
                .involved_staff_ids;

        if (
          !Array.isArray(
            involvedStaffIds
          )
        ) {
          involvedStaffIds = [];
        }
      } catch {
        involvedStaffIds = [];
      }

      if (
        noteType !== "REVIEW" &&
        noteType !== "FINDINGS"
      ) {
        return res.status(400).json({
          message:
            "Invalid note type.",
        });
      }

      if (!title) {
        return res.status(400).json({
          message:
            "Title is required.",
        });
      }
      
      if (noteType === "REVIEW") {
        const hasReview =
          reviewCoh ||
          reviewCashbookVsVoucher ||
          reviewLor ||
          reviewLos ||
          reviewLdf ||
          reviewDcs ||
          reviewBms ||
          reviewOtherFindings;

        if (!hasReview) {
          return res.status(400).json({
            message:
              "Enter at least one Branch Visit Finding.",
          });
        }

        if (involvedStaffIds.length === 0) {
          return res.status(400).json({
            message:
              "Select involved staff.",
          });
        }

        if (
          !Array.isArray(req.files) ||
          req.files.length === 0
        ) {
          return res.status(400).json({
            message:
              "Upload a Branch Visit Findings photo.",
          });
        }
      }

      if (noteType === "FINDINGS") {
        const hasFinding =
          passbookReconciliation ||
          pastDueDelinquentReport ||
          groupCollectionRecord ||
          otherFindings;

        if (!hasFinding) {
          return res.status(400).json({
            message:
              "Enter at least one Group Visit Finding.",
          });
        }

        if (!dueDate) {
          return res.status(400).json({
            message:
              "Compliance due date is required.",
          });
        }

        if (involvedStaffIds.length === 0) {
          return res.status(400).json({
            message:
              "Select involved staff.",
          });
        }

        if (
          !Array.isArray(req.files) ||
          req.files.length === 0
        ) {
          return res.status(400).json({
            message:
              "Upload a Group Visit Findings photo.",
          });
        }
      }

      await client.query("BEGIN");

      const planResult =
        await client.query(
          `
          SELECT
            id,
            status

          FROM public.travel_plans

          WHERE id=$1

          FOR UPDATE
          `,
          [travelPlanId]
        );

      if (
        !planResult.rowCount
      ) {
        await client.query(
          "ROLLBACK"
        );

        return res.status(404).json({
          message:
            "Travel plan not found.",
        });
      }

      if (
        norm(
          planResult.rows[0].status
        ) === "completed"
      ) {
        await client.query(
          "ROLLBACK"
        );

        return res.status(400).json({
          message:
            "Completed travel plans cannot be modified.",
        });
      }

      let findingPhotoUrl =
        null;

      let reviewPhotoUrl =
        null;

      if (
        noteType ===
          "FINDINGS" &&
        Array.isArray(req.files) &&
        req.files.length > 0
      ) {
        const file =
          req.files[0];

        findingPhotoUrl =
          await moveFromTempKeepExisting(
            file.key,
            "travel-plan-findings",
            String(
              travelPlanId
            ),
            file.originalname
          );
      }

      if (
        noteType ===
          "REVIEW" &&
        Array.isArray(req.files) &&
        req.files.length > 0
      ) {
        const file =
          req.files[0];

        reviewPhotoUrl =
          await moveFromTempKeepExisting(
            file.key,
            "travel-plan-review",
            String(
              travelPlanId
            ),
            file.originalname
          );
      }

      const reviewDetails = [
        reviewCoh
          ? `COH:\n${reviewCoh}`
          : "",

        reviewCashbookVsVoucher
          ? `Cashbook vs Voucher:\n${reviewCashbookVsVoucher}`
          : "",

        reviewLor
          ? `LOR:\n${reviewLor}`
          : "",

        reviewLos
          ? `LOS:\n${reviewLos}`
          : "",

        reviewLdf
          ? `LDF:\n${reviewLdf}`
          : "",

        reviewDcs
          ? `DCS:\n${reviewDcs}`
          : "",

        reviewBms
          ? `BMS:\n${reviewBms}`
          : "",

        reviewOtherFindings
          ? `Others:\n${reviewOtherFindings}`
          : "",
      ]
        .filter(Boolean)
        .join("\n\n");
        
          const findingDetails = [
        passbookReconciliation
          ? `Passbook Reconciliation:\n${passbookReconciliation}`
          : "",

        pastDueDelinquentReport
          ? `Past Due & Delinquent Report:\n${pastDueDelinquentReport}`
          : "",

        groupCollectionRecord
          ? `Group Collection Record:\n${groupCollectionRecord}`
          : "",

        otherFindings
          ? `Others:\n${otherFindings}`
          : "",
      ]
        .filter(Boolean)
        .join("\n\n");

      const result = await client.query(
        `
        INSERT INTO public.travel_plan_notes
        (
          travel_plan_id,
          note_type,
          title,

          finding_type,

          review_coh,
          review_cashbook_vs_voucher,
          review_lor,
          review_los,
          review_ldf,
          review_dcs,
          review_bms,
          review_other_findings,
          review_photo_url,

          passbook_reconciliation,
          past_due_delinquent_report,
          group_collection_record,
          other_findings,

          involved_staff,
          due_date,

          content,
          finding_photo_url,

          created_by,
          created_at
        )
        VALUES
        (
          $1,
          $2,
          $3,

          $4,

          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11,
          $12,
          $13,

          $14,
          $15,
          $16,
          $17,

          $18,
          $19::date,

          $20,
          $21,

          $22,
          NOW() AT TIME ZONE 'Asia/Manila'
        )
        RETURNING
          id,
          travel_plan_id,
          note_type,
          title,

          finding_type,

          review_coh,
          review_cashbook_vs_voucher,
          review_lor,
          review_los,
          review_ldf,
          review_dcs,
          review_bms,
          review_other_findings,
          review_photo_url,

          passbook_reconciliation,
          past_due_delinquent_report,
          group_collection_record,
          other_findings,

          involved_staff,

          TO_CHAR(
            due_date,
            'YYYY-MM-DD'
          ) AS due_date,

          content,
          finding_photo_url,

          created_by,

          CASE
            WHEN created_at IS NULL
              THEN NULL
            ELSE
              TO_CHAR(
                created_at,
                'YYYY-MM-DD"T"HH24:MI:SS.MS'
              ) || '+08:00'
          END AS created_at
        `,
        [
          // $1
          travelPlanId,

          // $2
          noteType,

          // $3
          noteType === "REVIEW"
            ? "Branch Visit Findings"
            : "Group Visit Findings",

          // $4
          noteType === "FINDINGS"
            ? "Group Visit Findings"
            : null,

          // $5
          noteType === "REVIEW"
            ? reviewCoh || null
            : null,

          // $6
          noteType === "REVIEW"
            ? reviewCashbookVsVoucher || null
            : null,

          // $7
          noteType === "REVIEW"
            ? reviewLor || null
            : null,

          // $8
          noteType === "REVIEW"
            ? reviewLos || null
            : null,

          // $9
          noteType === "REVIEW"
            ? reviewLdf || null
            : null,

          // $10
          noteType === "REVIEW"
            ? reviewDcs || null
            : null,

          // $11
          noteType === "REVIEW"
            ? reviewBms || null
            : null,

          // $12
          noteType === "REVIEW"
            ? reviewOtherFindings || null
            : null,

          // $13
          noteType === "REVIEW"
            ? reviewPhotoUrl
            : null,

          // $14
          noteType === "FINDINGS"
            ? passbookReconciliation || null
            : null,

          // $15
          noteType === "FINDINGS"
            ? pastDueDelinquentReport || null
            : null,

          // $16
          noteType === "FINDINGS"
            ? groupCollectionRecord || null
            : null,

          // $17
          noteType === "FINDINGS"
            ? otherFindings || null
            : null,

          // $18
          involvedStaff || null,

          // $19
          noteType === "FINDINGS"
            ? dueDate || null
            : null,

          // $20
          noteType === "REVIEW"
            ? reviewDetails || null
            : findingDetails || null,

          // $21
          noteType === "FINDINGS"
            ? findingPhotoUrl
            : null,

          // $22
          req.user?.id || null,
        ]
      );

      const note = result.rows[0];

      let assignedComplianceCount = 0;

      if (noteType === "FINDINGS") {
        assignedComplianceCount =
          await syncFindingCompliances(
            client,
            {
              travelPlanId,

              findingNoteId:
                note.id,

              findingTitle:
                "Group Visit Findings",

              findingDetails,

              involvedStaffText:
                involvedStaff,

              involvedStaffIds,

              dueDate:
                dueDate || null,

              createdBy:
                req.user?.id || null,
            }
          );

        if (
          assignedComplianceCount === 0
        ) {
          await client.query(
            "ROLLBACK"
          );

          return res.status(400).json({
            message:
              "The selected involved staff could not be matched to staff records.",
          });
        }
      }

      await client.query("COMMIT");

      return res.status(201).json({
        message:
          noteType === "REVIEW"
            ? "Branch Visit Findings created successfully."
            : `Group Visit Findings created and assigned to ${assignedComplianceCount} staff member(s).`,

        note,

        assigned_compliance_count:
          assignedComplianceCount,
      });
    } catch (error) {
      await client.query("ROLLBACK");

      return sendServerError(
        res,
        "POST /travel-plans/:id/notes",
        error
      );
    } finally {
      client.release();
    }
  }
);

// =====================================================
// GET TRAVEL PLAN NOTES
// =====================================================

router.get(
  "/travel-plans/:id/notes",
  requireAuth,
  async (req, res) => {
    try {
      if (!canViewTravelModule(req)) {
        return res.status(403).json({
          message:
            "You are not allowed to view travel plan notes.",
        });
      }

      const travelPlanId = Number(
        req.params.id
      );

      if (!isValidId(travelPlanId)) {
        return res.status(400).json({
          message:
            "Invalid travel plan ID.",
        });
      }

      const planResult = await pool.query(
        `
        SELECT
          id
        FROM public.travel_plans
        WHERE id = $1
        LIMIT 1
        `,
        [travelPlanId]
      );

      if (!planResult.rowCount) {
        return res.status(404).json({
          message:
            "Travel plan not found.",
        });
      }

      const result = await pool.query(
        `
        SELECT
          id,
          travel_plan_id,
          note_type,
          title,

          /*
            Legacy fields.
          */
          finding_type,
          content,

          /*
            Branch Visit Findings / REVIEW.
          */
          review_coh,
          review_cashbook_vs_voucher,
          review_lor,
          review_los,
          review_ldf,
          review_dcs,
          review_bms,
          review_other_findings,
          review_photo_url,

          /*
            Group Visit Findings / FINDINGS.
          */
          passbook_reconciliation,
          past_due_delinquent_report,
          group_collection_record,
          other_findings,
          finding_photo_url,

          involved_staff,

          TO_CHAR(
            due_date,
            'YYYY-MM-DD'
          ) AS due_date,

          created_by,

          CASE
            WHEN created_at IS NULL
              THEN NULL
            ELSE
              TO_CHAR(
                created_at,
                'YYYY-MM-DD"T"HH24:MI:SS.MS'
              ) || '+08:00'
          END AS created_at

        FROM public.travel_plan_notes

        WHERE travel_plan_id = $1

        ORDER BY
          created_at DESC,
          id DESC
        `,
        [travelPlanId]
      );

      const notes = await Promise.all(
        result.rows.map(async (note) => {
          let findingPhotoSignedUrl = null;
          let reviewPhotoSignedUrl = null;

          if (note.finding_photo_url) {
            try {
              findingPhotoSignedUrl =
                await getSignedDownloadUrl(
                  note.finding_photo_url,
                  3600
                );
            } catch (signError) {
              console.error(
                "Failed to create finding photo signed URL:",
                note.finding_photo_url,
                signError
              );
            }
          }

          if (note.review_photo_url) {
            try {
              reviewPhotoSignedUrl =
                await getSignedDownloadUrl(
                  note.review_photo_url,
                  3600
                );
            } catch (signError) {
              console.error(
                "Failed to create review photo signed URL:",
                note.review_photo_url,
                signError
              );
            }
          }

          return {
            ...note,

            finding_photo_signed_url:
              findingPhotoSignedUrl,

            review_photo_signed_url:
              reviewPhotoSignedUrl,
          };
        })
      );

      return res.json(notes);
    } catch (error) {
      return sendServerError(
        res,
        "GET /travel-plans/:id/notes",
        error
      );
    }
  }
);

// =====================================================
// UPDATE TRAVEL PLAN NOTE
// =====================================================

router.put(
  "/travel-plans/notes/:noteId",
  requireAuth,
  uploadPhotosToTemp,
  async (req, res) => {
    const client = await pool.connect();

    let newlyUploadedPhotoKey = null;

    try {
      if (!canEditPlan(req)) {
        return res.status(403).json({
          message:
            "You are not allowed to edit travel plan notes.",
        });
      }

      const noteId = Number(
        req.params.noteId
      );

      if (!isValidId(noteId)) {
        return res.status(400).json({
          message:
            "Invalid note ID.",
        });
      }

      const noteType = toStr(
        req.body.note_type
      ).toUpperCase();

      // =================================================
      // BRANCH VISIT FINDINGS / REVIEW
      // =================================================

      const reviewCoh =
        toStr(req.body.review_coh);

      const reviewCashbookVsVoucher =
        toStr(
          req.body.review_cashbook_vs_voucher
        );

      const reviewLor =
        toStr(req.body.review_lor);

      const reviewLos =
        toStr(req.body.review_los);

      const reviewLdf =
        toStr(req.body.review_ldf);

      const reviewDcs =
        toStr(req.body.review_dcs);

      const reviewBms =
        toStr(req.body.review_bms);

      const reviewOtherFindings =
        toStr(
          req.body.review_other_findings
        );

      // =================================================
      // GROUP VISIT FINDINGS / FINDINGS
      // =================================================

      const passbookReconciliation =
        toStr(
          req.body.passbook_reconciliation
        );

      const pastDueDelinquentReport =
        toStr(
          req.body.past_due_delinquent_report
        );

      const groupCollectionRecord =
        toStr(
          req.body.group_collection_record
        );

      const otherFindings =
        toStr(
          req.body.other_findings
        );

      const involvedStaff =
        toStr(
          req.body.involved_staff
        );

      const dueDate =
        toStr(
          req.body.due_date
        );

      let involvedStaffIds = [];

      try {
        involvedStaffIds =
          typeof req.body.involved_staff_ids ===
          "string"
            ? JSON.parse(
                req.body.involved_staff_ids
              )
            : req.body.involved_staff_ids;

        if (
          !Array.isArray(
            involvedStaffIds
          )
        ) {
          involvedStaffIds = [];
        }
      } catch {
        involvedStaffIds = [];
      }

      if (
        ![
          "REVIEW",
          "FINDINGS",
        ].includes(noteType)
      ) {
        return res.status(400).json({
          message:
            "Note type must be REVIEW or FINDINGS.",
        });
      }

      // =================================================
      // REVIEW VALIDATION
      // =================================================

      if (noteType === "REVIEW") {
        const hasReviewFinding =
          reviewCoh ||
          reviewCashbookVsVoucher ||
          reviewLor ||
          reviewLos ||
          reviewLdf ||
          reviewDcs ||
          reviewBms ||
          reviewOtherFindings;

        if (!hasReviewFinding) {
          return res.status(400).json({
            message:
              "Enter at least one Branch Visit Finding.",
          });
        }

        if (
          involvedStaffIds.length === 0 &&
          !involvedStaff
        ) {
          return res.status(400).json({
            message:
              "Select at least one involved staff member.",
          });
        }
      }

      // =================================================
      // FINDINGS VALIDATION
      // =================================================

      if (noteType === "FINDINGS") {
        const hasGroupFinding =
          passbookReconciliation ||
          pastDueDelinquentReport ||
          groupCollectionRecord ||
          otherFindings;

        if (!hasGroupFinding) {
          return res.status(400).json({
            message:
              "Enter at least one Group Visit Finding.",
          });
        }

        if (
          involvedStaffIds.length === 0 &&
          !involvedStaff
        ) {
          return res.status(400).json({
            message:
              "Select at least one involved staff member.",
          });
        }

        if (!dueDate) {
          return res.status(400).json({
            message:
              "Compliance due date is required.",
          });
        }
      }

      if (
        dueDate &&
        !/^\d{4}-\d{2}-\d{2}$/.test(
          dueDate
        )
      ) {
        return res.status(400).json({
          message:
            "Due date must use YYYY-MM-DD format.",
        });
      }

      const title =
        noteType === "REVIEW"
          ? "Branch Visit Findings"
          : "Group Visit Findings";

      const reviewDetails = [
        reviewCoh
          ? `COH:\n${reviewCoh}`
          : "",

        reviewCashbookVsVoucher
          ? `Cashbook vs Voucher:\n${reviewCashbookVsVoucher}`
          : "",

        reviewLor
          ? `LOR:\n${reviewLor}`
          : "",

        reviewLos
          ? `LOS:\n${reviewLos}`
          : "",

        reviewLdf
          ? `LDF:\n${reviewLdf}`
          : "",

        reviewDcs
          ? `DCS:\n${reviewDcs}`
          : "",

        reviewBms
          ? `BMS:\n${reviewBms}`
          : "",

        reviewOtherFindings
          ? `Others:\n${reviewOtherFindings}`
          : "",
      ]
        .filter(Boolean)
        .join("\n\n");

      const findingDetails = [
        passbookReconciliation
          ? `Passbook Reconciliation:\n${passbookReconciliation}`
          : "",

        pastDueDelinquentReport
          ? `Past Due & Delinquent Report:\n${pastDueDelinquentReport}`
          : "",

        groupCollectionRecord
          ? `Group Collection Record:\n${groupCollectionRecord}`
          : "",

        otherFindings
          ? `Others:\n${otherFindings}`
          : "",
      ]
        .filter(Boolean)
        .join("\n\n");

      await client.query("BEGIN");

      const existingResult =
        await client.query(
          `
          SELECT
            n.id,
            n.travel_plan_id,
            n.note_type,

            n.finding_photo_url,
            n.review_photo_url,

            tp.status

          FROM public.travel_plan_notes n

          INNER JOIN public.travel_plans tp
            ON tp.id =
              n.travel_plan_id

          WHERE n.id = $1

          LIMIT 1

          FOR UPDATE
          `,
          [noteId]
        );

      if (!existingResult.rowCount) {
        await client.query(
          "ROLLBACK"
        );

        return res.status(404).json({
          message:
            "Travel plan note not found.",
        });
      }

      const existingNote =
        existingResult.rows[0];

      if (
        norm(existingNote.status) ===
        "completed"
      ) {
        await client.query(
          "ROLLBACK"
        );

        return res.status(400).json({
          message:
            "Notes from completed travel plans cannot be edited.",
        });
      }

      const previousFindingPhotoUrl =
        existingNote.finding_photo_url ||
        null;

      const previousReviewPhotoUrl =
        existingNote.review_photo_url ||
        null;

      let findingPhotoUrl =
        noteType === "FINDINGS"
          ? previousFindingPhotoUrl
          : null;

      let reviewPhotoUrl =
        noteType === "REVIEW"
          ? previousReviewPhotoUrl
          : null;

      // =================================================
      // OPTIONAL REPLACEMENT PHOTO
      // =================================================

      if (
        Array.isArray(req.files) &&
        req.files.length > 0
      ) {
        const file = req.files[0];

        if (noteType === "REVIEW") {
          reviewPhotoUrl =
            await moveFromTempKeepExisting(
              file.key,
              "travel-plan-review",
              String(
                existingNote.travel_plan_id
              ),
              file.originalname
            );

          newlyUploadedPhotoKey =
            reviewPhotoUrl;
        }

        if (noteType === "FINDINGS") {
          findingPhotoUrl =
            await moveFromTempKeepExisting(
              file.key,
              "travel-plan-findings",
              String(
                existingNote.travel_plan_id
              ),
              file.originalname
            );

          newlyUploadedPhotoKey =
            findingPhotoUrl;
        }
      }

      const result = await client.query(
        `
        UPDATE public.travel_plan_notes

        SET
          note_type = $2,
          title = $3,

          finding_type = $4,

          review_coh = $5,
          review_cashbook_vs_voucher = $6,
          review_lor = $7,
          review_los = $8,
          review_ldf = $9,
          review_dcs = $10,
          review_bms = $11,
          review_other_findings = $12,
          review_photo_url = $13,

          passbook_reconciliation = $14,
          past_due_delinquent_report = $15,
          group_collection_record = $16,
          other_findings = $17,
          finding_photo_url = $18,

          involved_staff = $19,
          due_date = $20::date,

          content = $21

        WHERE id = $1

        RETURNING
          id,
          travel_plan_id,
          note_type,
          title,

          finding_type,

          review_coh,
          review_cashbook_vs_voucher,
          review_lor,
          review_los,
          review_ldf,
          review_dcs,
          review_bms,
          review_other_findings,
          review_photo_url,

          passbook_reconciliation,
          past_due_delinquent_report,
          group_collection_record,
          other_findings,
          finding_photo_url,

          involved_staff,

          TO_CHAR(
            due_date,
            'YYYY-MM-DD'
          ) AS due_date,

          content,
          created_by,

          CASE
            WHEN created_at IS NULL
              THEN NULL
            ELSE
              TO_CHAR(
                created_at,
                'YYYY-MM-DD"T"HH24:MI:SS.MS'
              ) || '+08:00'
          END AS created_at
        `,
        [
          // $1
          noteId,

          // $2
          noteType,

          // $3
          title,

          // $4
          noteType === "FINDINGS"
            ? "Group Visit Findings"
            : null,

          // $5
          noteType === "REVIEW"
            ? reviewCoh || null
            : null,

          // $6
          noteType === "REVIEW"
            ? reviewCashbookVsVoucher || null
            : null,

          // $7
          noteType === "REVIEW"
            ? reviewLor || null
            : null,

          // $8
          noteType === "REVIEW"
            ? reviewLos || null
            : null,

          // $9
          noteType === "REVIEW"
            ? reviewLdf || null
            : null,

          // $10
          noteType === "REVIEW"
            ? reviewDcs || null
            : null,

          // $11
          noteType === "REVIEW"
            ? reviewBms || null
            : null,

          // $12
          noteType === "REVIEW"
            ? reviewOtherFindings || null
            : null,

          // $13
          noteType === "REVIEW"
            ? reviewPhotoUrl
            : null,

          // $14
          noteType === "FINDINGS"
            ? passbookReconciliation || null
            : null,

          // $15
          noteType === "FINDINGS"
            ? pastDueDelinquentReport || null
            : null,

          // $16
          noteType === "FINDINGS"
            ? groupCollectionRecord || null
            : null,

          // $17
          noteType === "FINDINGS"
            ? otherFindings || null
            : null,

          // $18
          noteType === "FINDINGS"
            ? findingPhotoUrl
            : null,

          // $19
          involvedStaff || null,

          // $20
          noteType === "FINDINGS"
            ? dueDate || null
            : null,

          // $21
          noteType === "REVIEW"
            ? reviewDetails || null
            : findingDetails || null,
        ]
      );

      let assignedComplianceCount = 0;

      if (noteType === "FINDINGS") {
        assignedComplianceCount =
          await syncFindingCompliances(
            client,
            {
              travelPlanId:
                existingNote.travel_plan_id,

              findingNoteId:
                noteId,

              findingTitle:
                "Group Visit Findings",

              findingDetails,

              involvedStaffText:
                involvedStaff,

              involvedStaffIds,

              dueDate:
                dueDate || null,

              createdBy:
                req.user?.id || null,
            }
          );

        if (
          assignedComplianceCount === 0
        ) {
          await client.query(
            "ROLLBACK"
          );

          if (newlyUploadedPhotoKey) {
            try {
              await deleteKey(
                newlyUploadedPhotoKey
              );
            } catch (cleanupError) {
              console.error(
                "Failed to clean up new note photo:",
                newlyUploadedPhotoKey,
                cleanupError
              );
            }
          }

          return res.status(400).json({
            message:
              "The selected involved staff could not be matched to staff records.",
          });
        }
      } else {
        /*
          REVIEW does not generate compliance records.
          Remove only pending assignments if an old
          FINDINGS record was changed to REVIEW.
        */
        await client.query(
          `
          DELETE FROM public.travel_plan_compliances

          WHERE finding_note_id = $1
            AND status = 'Pending'
          `,
          [noteId]
        );
      }

      await client.query("COMMIT");

      // =================================================
      // REMOVE REPLACED OR UNUSED OLD PHOTOS
      // =================================================

      const oldPhotoKeysToDelete = [];

      if (
        previousFindingPhotoUrl &&
        previousFindingPhotoUrl !==
          findingPhotoUrl
      ) {
        oldPhotoKeysToDelete.push(
          previousFindingPhotoUrl
        );
      }

      if (
        previousReviewPhotoUrl &&
        previousReviewPhotoUrl !==
          reviewPhotoUrl
      ) {
        oldPhotoKeysToDelete.push(
          previousReviewPhotoUrl
        );
      }

      for (
        const oldPhotoKey of
        oldPhotoKeysToDelete
      ) {
        try {
          await deleteKey(oldPhotoKey);
        } catch (deleteError) {
          console.error(
            "Failed to delete replaced note photo:",
            oldPhotoKey,
            deleteError
          );
        }
      }

      return res.json({
        message:
          noteType === "REVIEW"
            ? "Branch Visit Findings updated successfully."
            : `Group Visit Findings updated for ${assignedComplianceCount} staff member(s).`,

        note:
          result.rows[0],

        assigned_compliance_count:
          assignedComplianceCount,
      });
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error(
          "PUT note rollback failed:",
          rollbackError
        );
      }

      if (newlyUploadedPhotoKey) {
        try {
          await deleteKey(
            newlyUploadedPhotoKey
          );
        } catch (cleanupError) {
          console.error(
            "Failed to clean up uploaded note photo:",
            newlyUploadedPhotoKey,
            cleanupError
          );
        }
      }

      return sendServerError(
        res,
        "PUT /travel-plans/notes/:noteId",
        error
      );
    } finally {
      client.release();
    }
  }
);

// =====================================================
// DELETE TRAVEL PLAN NOTE
// =====================================================

router.delete(
  "/travel-plans/notes/:noteId",
  requireAuth,
  async (req, res) => {
    const client = await pool.connect();

    try {
      if (
        !canEditPlan(req) &&
        !canDeleteTravelRecord(req)
      ) {
        return res.status(403).json({
          message:
            "You are not allowed to delete travel plan notes.",
        });
      }

      const noteId = Number(
        req.params.noteId
      );

      if (!isValidId(noteId)) {
        return res.status(400).json({
          message:
            "Invalid note ID.",
        });
      }

      await client.query("BEGIN");

      const existingResult =
        await client.query(
          `
          SELECT
            n.id,
            n.travel_plan_id,
            n.note_type,

            n.finding_photo_url,
            n.review_photo_url,

            tp.status

          FROM public.travel_plan_notes n

          INNER JOIN public.travel_plans tp
            ON tp.id =
              n.travel_plan_id

          WHERE n.id = $1

          LIMIT 1

          FOR UPDATE
          `,
          [noteId]
        );

      if (!existingResult.rowCount) {
        await client.query(
          "ROLLBACK"
        );

        return res.status(404).json({
          message:
            "Travel plan note not found.",
        });
      }

      const existingNote =
        existingResult.rows[0];

      if (
        norm(existingNote.status) ===
          "completed" &&
        !canDeleteTravelRecord(req)
      ) {
        await client.query(
          "ROLLBACK"
        );

        return res.status(400).json({
          message:
            "Only Admin, IT, or TREAD Department can delete notes from completed travel plans.",
        });
      }

      /*
        Remove pending compliance assignments first.

        Submitted, Checked, or Complied records are
        preserved so completed compliance history
        is not accidentally erased.
      */
      await client.query(
        `
        DELETE FROM public.travel_plan_compliances

        WHERE finding_note_id = $1
          AND status = 'Pending'
        `,
        [noteId]
      );

      const deleteResult =
        await client.query(
          `
          DELETE FROM public.travel_plan_notes

          WHERE id = $1

          RETURNING
            id,
            note_type
          `,
          [noteId]
        );

      if (!deleteResult.rowCount) {
        await client.query(
          "ROLLBACK"
        );

        return res.status(404).json({
          message:
            "Travel plan note not found.",
        });
      }

      await client.query("COMMIT");

      /*
        Delete storage objects only after the database
        transaction succeeds.
      */
      const photoKeys = [
        existingNote.finding_photo_url,
        existingNote.review_photo_url,
      ].filter(Boolean);

      for (const photoKey of photoKeys) {
        try {
          await deleteKey(photoKey);
        } catch (deleteError) {
          console.error(
            "Failed to delete travel-plan note photo:",
            photoKey,
            deleteError
          );
        }
      }

      return res.json({
        message:
          existingNote.note_type ===
          "REVIEW"
            ? "Branch Visit Findings deleted successfully."
            : "Group Visit Findings deleted successfully.",
      });
    } catch (error) {
      try {
        await client.query(
          "ROLLBACK"
        );
      } catch (rollbackError) {
        console.error(
          "DELETE note rollback failed:",
          rollbackError
        );
      }

      return sendServerError(
        res,
        "DELETE /travel-plans/notes/:noteId",
        error
      );
    } finally {
      client.release();
    }
  }
);

module.exports = router;