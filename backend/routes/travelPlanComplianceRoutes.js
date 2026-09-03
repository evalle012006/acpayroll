const express = require("express");
const router = express.Router();

const pool = require("../db");

const { requireAuth } =
  require("../middlewares/authMiddleware");

const {
  toStr,
  isValidId,
  normalizeDepartment,
  normalizeRole,
  isAdminOrIT,
  resolveLoggedInStaff,
  getComplianceReviewLevel,
  canCheckCompliance,
  getLoggedInUserDisplayName,
  manilaTimestampSql,
  sendServerError,
} = require("../utils/travelPlanHelpers");

// =====================================================
// SUBMIT COMPLIANCE
// Only the involved staff account can submit.
// =====================================================

router.put(
  "/travel-plan-compliances/:id/comply",
  requireAuth,
  async (req, res) => {
    const client = await pool.connect();

    try {
      const complianceId = Number(
        req.params.id
      );

      if (!isValidId(complianceId)) {
        return res.status(400).json({
          message:
            "Invalid compliance ID.",
        });
      }

      const responseText = toStr(
        req.body.compliance_response
      );

      if (!responseText) {
        return res.status(400).json({
          message:
            "Compliance response is required.",
        });
      }

      const staff = await resolveLoggedInStaff(
        client,
        req
      );

      if (!staff) {
        return res.status(403).json({
          message:
            "Your account could not be matched to a staff record.",
        });
      }

      await client.query("BEGIN");

      const existingResult =
        await client.query(
          `
          SELECT
            id,
            employee_id,
            status
          FROM public.travel_plan_compliances
          WHERE id = $1
          LIMIT 1
          FOR UPDATE
          `,
          [complianceId]
        );

      if (!existingResult.rowCount) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          message:
            "Compliance record not found.",
        });
      }

      const compliance =
        existingResult.rows[0];

      if (
        Number(compliance.employee_id) !==
        Number(staff.id)
      ) {
        await client.query("ROLLBACK");

        return res.status(403).json({
          message:
            "This compliance record is assigned to another staff member.",
        });
      }

      if (
        compliance.status === "Cancelled"
      ) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message:
            "Cancelled compliance cannot be submitted.",
        });
      }

      const result = await client.query(
        `
        UPDATE public.travel_plan_compliances
        SET
          compliance_response = $2,
            status = 'Submitted',
            review_level = 1,

          complied_at =
            NOW() AT TIME ZONE 'Asia/Manila',

          complied_by = $3,

          updated_at =
            NOW() AT TIME ZONE 'Asia/Manila'

        WHERE id = $1

        RETURNING *
        `,
        [
          complianceId,
          responseText,
          req.user?.id || null,
        ]
      );

      await client.query("COMMIT");

      return res.json({
        message:
          "Compliance submitted successfully and is now waiting for manager checking.",

        compliance: result.rows[0],
      });
    } catch (error) {
      await client.query("ROLLBACK");

      return sendServerError(
        res,
        "PUT /travel-plan-compliances/:id/comply",
        error
      );
    } finally {
      client.release();
    }
  }
);

// =====================================================
// CHECK STAFF COMPLIANCE
// AM → RM → AVP → VP → SVP
// Admin and IT may perform the final check.
// =====================================================

router.put(
  "/travel-plan-compliances/:id/check",
  requireAuth,
  async (req, res) => {
    const client = await pool.connect();

    try {
      if (!canCheckCompliance(req)) {
        return res.status(403).json({
          message:
            "You are not allowed to check staff compliance.",
        });
      }

      const complianceId = Number(req.params.id);

      if (!isValidId(complianceId)) {
        return res.status(400).json({
          message: "Invalid compliance ID.",
        });
      }

      const remarks = toStr(req.body.remarks);

      const checkerLevel =
        getComplianceReviewLevel(req);

      const checkerRole =
        normalizeRole(req.user?.role);

      const checkerDepartment =
        normalizeDepartment(
          req.user?.department
        );

      const checkerName =
        getLoggedInUserDisplayName(req);

      await client.query("BEGIN");

      const existingResult =
        await client.query(
          `
          SELECT
            c.id,
            c.status,
            c.review_level,
            c.employee_id,
            c.employee_name,
            c.department,
            c.area,
            c.region,
            c.division,

            c.compliance_response

          FROM public.travel_plan_compliances c

          WHERE c.id = $1

          LIMIT 1
          FOR UPDATE
          `,
          [complianceId]
        );

      if (!existingResult.rowCount) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          message:
            "Compliance record not found.",
        });
      }

      const compliance =
        existingResult.rows[0];

      if (
        !compliance.compliance_response ||
        !toStr(compliance.compliance_response)
      ) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message:
            "The involved staff must submit a compliance response before it can be checked.",
        });
      }

      if (
        ["pending", "cancelled"].includes(
          normalizeRole(compliance.status)
        )
      ) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message:
            "Only submitted compliance records can be checked.",
        });
      }

      if (
        normalizeRole(compliance.status) ===
        "complied"
      ) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message:
            "This compliance has already completed all checking.",
        });
      }

      const currentLevel =
        Number(compliance.review_level) || 0;

      if (checkerLevel <= currentLevel) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message:
            "This compliance has already been checked at your level or a higher level.",
        });
      }

      /*
        Do not allow a manager to skip a required lower
        review level.

        Level 2: AM can check after employee submission.
        Level 3: RM requires AM check.
        Level 4: AVP requires RM check.
        Level 5: VP requires AVP check.
        Level 6: SVP requires VP check.
      */
      if (checkerLevel > currentLevel + 1) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message:
            "The previous checking level must be completed first.",
        });
      }

      const duplicateCheckResult =
        await client.query(
          `
          SELECT id
          FROM public.travel_plan_compliance_checks
          WHERE compliance_id = $1
            AND LOWER(
              TRIM(
                COALESCE(
                  checked_by_role,
                  ''
                )
              )
            ) = LOWER(TRIM($2))
          LIMIT 1
          `,
          [
            complianceId,
            checkerRole,
          ]
        );

      if (duplicateCheckResult.rowCount) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message:
            "Your role has already checked this compliance.",
        });
      }

      await client.query(
        `
        INSERT INTO public.travel_plan_compliance_checks
        (
          compliance_id,

          checked_by_user_id,
          checked_by_name,
          checked_by_role,
          checked_by_department,

          review_level,
          remarks,

          checked_at,
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

          NOW() AT TIME ZONE 'Asia/Manila',
          NOW() AT TIME ZONE 'Asia/Manila'
        )
        `,
        [
          complianceId,

          req.user?.id || null,
          checkerName,
          checkerRole,
          checkerDepartment || null,

          checkerLevel,
          remarks || null,
        ]
      );

      const finalStatus =
        checkerLevel >= 6
          ? "Complied"
          : "Checked";

      const result = await client.query(
        `
        UPDATE public.travel_plan_compliances
        SET
          review_level = $2,
          status = $3,

          latest_checked_by_user_id = $4,
          latest_checked_by_name = $5,
          latest_checked_by_role = $6,
          latest_checked_by_department = $7,

          latest_checked_at =
            NOW() AT TIME ZONE 'Asia/Manila',

          latest_check_remarks = $8,

          updated_at =
            NOW() AT TIME ZONE 'Asia/Manila'

        WHERE id = $1

        RETURNING *
        `,
        [
          complianceId,
          checkerLevel,
          finalStatus,

          req.user?.id || null,
          checkerName,
          checkerRole,
          checkerDepartment || null,

          remarks || null,
        ]
      );

      await client.query("COMMIT");

      return res.json({
        message:
          finalStatus === "Complied"
            ? "Compliance checking completed."
            : `Compliance checked by ${checkerRole}.`,

        compliance: result.rows[0],
      });
    } catch (error) {
      await client.query("ROLLBACK");

      if (
        error?.code === "23505"
      ) {
        return res.status(400).json({
          message:
            "This checking role has already reviewed the compliance.",
        });
      }

      return sendServerError(
        res,
        "PUT /travel-plan-compliances/:id/check",
        error
      );
    } finally {
      client.release();
    }
  }
);

// =====================================================
// GET COMPLIANCE CHECK HISTORY
// =====================================================

router.get(
  "/travel-plan-compliances/:id/checks",
  requireAuth,
  async (req, res) => {
    try {
      const complianceId = Number(
        req.params.id
      );

      if (!isValidId(complianceId)) {
        return res.status(400).json({
          message: "Invalid compliance ID.",
        });
      }

      const complianceResult =
        await pool.query(
          `
          SELECT id
          FROM public.travel_plan_compliances
          WHERE id = $1
          LIMIT 1
          `,
          [complianceId]
        );

      if (!complianceResult.rowCount) {
        return res.status(404).json({
          message:
            "Compliance record not found.",
        });
      }

      const result = await pool.query(
        `
        SELECT
          id,
          compliance_id,

          checked_by_user_id,
          checked_by_name,
          checked_by_role,
          checked_by_department,

          review_level,
          remarks,

          ${manilaTimestampSql(
            "checked_at"
          )} AS checked_at,

          ${manilaTimestampSql(
            "created_at"
          )} AS created_at

        FROM public.travel_plan_compliance_checks

        WHERE compliance_id = $1

        ORDER BY
          review_level ASC,
          checked_at ASC,
          id ASC
        `,
        [complianceId]
      );

      return res.json(result.rows);
    } catch (error) {
      return sendServerError(
        res,
        "GET /travel-plan-compliances/:id/checks",
        error
      );
    }
  }
);

// =====================================================
// MY COMPLIANCE RECORDS
// =====================================================

router.get(
  "/travel-plan-compliances/my",
  requireAuth,
  async (req, res) => {
    const client = await pool.connect();

    try {
      const staff = await resolveLoggedInStaff(
        client,
        req
      );

      if (!staff) {
        return res.json([]);
      }

      const result = await client.query(
        `
        SELECT
          c.id,
          c.travel_plan_id,
          c.finding_note_id,

          c.employee_id,
          c.employee_no,
          c.employee_name,
          c.position,

          c.branch_id,
          c.branch_name,

          c.department,
          c.area,
          c.region,
          c.division,

          c.finding_title,
          c.finding_details,

          TO_CHAR(
            c.due_date,
            'YYYY-MM-DD'
          ) AS due_date,

          c.status,
          c.review_level,

          c.compliance_response,

          c.latest_checked_by_user_id,
          c.latest_checked_by_name,
          c.latest_checked_by_role,
          c.latest_checked_by_department,

          ${manilaTimestampSql(
            "c.latest_checked_at"
          )} AS latest_checked_at,

          c.latest_check_remarks,

          ${manilaTimestampSql(
            "c.complied_at"
          )} AS complied_at,

          c.complied_by,

          ${manilaTimestampSql(
            "c.created_at"
          )} AS created_at,

          ${manilaTimestampSql(
            "c.updated_at"
          )} AS updated_at,

          tp.title AS travel_plan_title,

          TO_CHAR(
            tp.plan_date,
            'YYYY-MM-DD'
          ) AS travel_plan_date,

          tp.branch_name AS visited_branch_name,

          creator.id AS finding_created_by_id,

          TRIM(
            CONCAT_WS(
              ' ',
              creator.first_name,
              creator.middle_name,
              creator.last_name
            )
          ) AS finding_created_by_name

        FROM public.travel_plan_compliances c

        INNER JOIN public.travel_plans tp
          ON tp.id = c.travel_plan_id

        LEFT JOIN public.users creator
          ON creator.id = c.created_by

        WHERE c.employee_id = $1

        ORDER BY
          CASE c.status
            WHEN 'Pending' THEN 1
            WHEN 'Submitted' THEN 2
            WHEN 'Checked' THEN 3
            WHEN 'Complied' THEN 4
            WHEN 'Cancelled' THEN 5
            ELSE 99
          END,

          c.created_at DESC,
          c.id DESC
        `,
        [staff.id]
      );

      return res.json(result.rows);
    } catch (error) {
      return sendServerError(
        res,
        "GET /travel-plan-compliances/my",
        error
      );
    } finally {
      client.release();
    } 
  }
);

// =====================================================
// MY PENDING COMPLIANCE COUNT
// Used by the Sidebar red badge.
// =====================================================

router.get(
  "/travel-plan-compliances/my-pending-count",
  requireAuth,
  async (req, res) => {
    const client = await pool.connect();

    try {
      const staff = await resolveLoggedInStaff(
        client,
        req
      );

      if (!staff) {
        return res.json({
          pending_count: 0,
        });
      }

      const result = await client.query(
        `
        SELECT COUNT(*)::INTEGER AS pending_count
        FROM public.travel_plan_compliances
        WHERE employee_id = $1
          AND status = 'Pending'
        `,
        [staff.id]
      );

      return res.json({
        pending_count:
          Number(
            result.rows[0]?.pending_count
          ) || 0,
      });
    } catch (error) {
      return sendServerError(
        res,
        "GET /travel-plan-compliances/my-pending-count",
        error
      );
    } finally {
      client.release();
    }
  }
);

// =====================================================
// MANAGER COMPLIANCE REVIEW SCOPE
// =====================================================
//
// Area Manager:
//   Submitted records in the same area, review_level = 1.
//
// Regional Manager:
//   Same region, already checked by AM, review_level = 2.
//
// Assistant Vice President:
//   Same division, already checked by RM, review_level = 3.
//
// Vice President:
//   Same department, already checked by AVP, review_level = 4.
//
// Senior Vice President:
//   Same department, already checked by VP, review_level = 5.
//
// Admin / IT:
//   All records waiting for any manager check.
//
// =====================================================

router.get(
  "/travel-plan-compliances/review-scope",
  requireAuth,
  async (req, res) => {
    try {
      if (!canCheckCompliance(req)) {
        return res.status(403).json({
          message:
            "You are not allowed to review staff compliance.",
        });
      }

      const role = normalizeRole(
        req.user?.role
      );

      const department =
        normalizeDepartment(
          req.user?.department
        );

      const userArea = toStr(
        req.user?.area
      );

      const userRegion = toStr(
        req.user?.region
      );

      const userDivision = toStr(
        req.user?.division
      );

      const reviewerLevel =
        getComplianceReviewLevel(req);

      if (
        !Number.isInteger(reviewerLevel) ||
        reviewerLevel < 1
      ) {
        return res.json([]);
      }

      const baseSql = `
        SELECT
          c.id,
          c.travel_plan_id,
          c.finding_note_id,

          c.employee_id,
          c.employee_no,
          c.employee_name,
          c.position,

          c.branch_id,
          c.branch_name,

          c.department,
          c.area,
          c.region,
          c.division,

          c.finding_title,
          c.finding_details,

          TO_CHAR(
            c.due_date,
            'YYYY-MM-DD'
          ) AS due_date,

          c.status,
          c.review_level,

          c.compliance_response,

          ${manilaTimestampSql(
            "c.complied_at"
          )} AS complied_at,

          c.complied_by,

          c.latest_checked_by_user_id,
          c.latest_checked_by_name,
          c.latest_checked_by_role,
          c.latest_checked_by_department,

          ${manilaTimestampSql(
            "c.latest_checked_at"
          )} AS latest_checked_at,

          c.latest_check_remarks,

          ${manilaTimestampSql(
            "c.created_at"
          )} AS created_at,

          ${manilaTimestampSql(
            "c.updated_at"
          )} AS updated_at,

          tp.title AS travel_plan_title,

          TO_CHAR(
            tp.plan_date,
            'YYYY-MM-DD'
          ) AS travel_plan_date,

          tp.branch_name
            AS visited_branch_name,

          finding_creator.id
            AS finding_created_by_id,

          TRIM(
            CONCAT_WS(
              ' ',
              finding_creator.first_name,
              finding_creator.middle_name,
              finding_creator.last_name
            )
          ) AS finding_created_by_name

        FROM public.travel_plan_compliances c

        INNER JOIN public.travel_plans tp
          ON tp.id = c.travel_plan_id

        LEFT JOIN public.users finding_creator
          ON finding_creator.id = c.created_by

        WHERE c.status IN (
          'Submitted',
          'Checked'
        )

          AND COALESCE(
            c.review_level,
            0
          ) = $1
      `;

      let sql = "";
      let params = [];

      // =================================================
      // ADMIN / IT
      // =================================================
      //
      // Can see all compliance records that are waiting
      // for their next checking level.
      // =================================================

      if (isAdminOrIT(req)) {
        sql = `
          SELECT
            c.id,
            c.travel_plan_id,
            c.finding_note_id,

            c.employee_id,
            c.employee_no,
            c.employee_name,
            c.position,

            c.branch_id,
            c.branch_name,

            c.department,
            c.area,
            c.region,
            c.division,

            c.finding_title,
            c.finding_details,

            TO_CHAR(
              c.due_date,
              'YYYY-MM-DD'
            ) AS due_date,

            c.status,
            c.review_level,

            c.compliance_response,

            ${manilaTimestampSql(
              "c.complied_at"
            )} AS complied_at,

            c.complied_by,

            c.latest_checked_by_user_id,
            c.latest_checked_by_name,
            c.latest_checked_by_role,
            c.latest_checked_by_department,

            ${manilaTimestampSql(
              "c.latest_checked_at"
            )} AS latest_checked_at,

            c.latest_check_remarks,

            ${manilaTimestampSql(
              "c.created_at"
            )} AS created_at,

            ${manilaTimestampSql(
              "c.updated_at"
            )} AS updated_at,

            tp.title
              AS travel_plan_title,

            TO_CHAR(
              tp.plan_date,
              'YYYY-MM-DD'
            ) AS travel_plan_date,

            tp.branch_name
              AS visited_branch_name

          FROM public.travel_plan_compliances c

          INNER JOIN public.travel_plans tp
            ON tp.id = c.travel_plan_id

          WHERE c.status IN (
            'Submitted',
            'Checked'
          )

            AND COALESCE(
              c.review_level,
              0
            ) BETWEEN 1 AND 5

          ORDER BY
            c.review_level ASC,
            c.due_date ASC NULLS LAST,
            c.created_at ASC,
            c.id ASC
        `;

        params = [];
      }

      // =================================================
      // AREA MANAGER / ACTING AREA MANAGER
      // =================================================
      //
      // Employee has already submitted:
      // review_level must be 1.
      // Same area and same department only.
      // =================================================

      else if (
        [
          "area manager",
          "acting area manager",
        ].includes(role)
      ) {
        if (!userArea) {
          return res.json([]);
        }

        sql = `
          ${baseSql}

          AND LOWER(
            TRIM(
              COALESCE(
                c.area,
                ''
              )
            )
          ) = LOWER(TRIM($2))

          AND LOWER(
            TRIM(
              COALESCE(
                c.department,
                ''
              )
            )
          ) = LOWER(TRIM($3))

          ORDER BY
            c.due_date ASC NULLS LAST,
            c.created_at ASC,
            c.id ASC
        `;

        params = [
          reviewerLevel - 1,
          userArea,
          department,
        ];
      }

      // =================================================
      // REGIONAL MANAGER / ACTING REGIONAL MANAGER
      // =================================================
      //
      // Must already be checked by Area Manager:
      // review_level must be 2.
      // Same region and same department only.
      // =================================================

      else if (
        [
          "regional manager",
          "acting regional manager",
        ].includes(role)
      ) {
        if (!userRegion) {
          return res.json([]);
        }

        sql = `
          ${baseSql}

          AND LOWER(
            TRIM(
              COALESCE(
                c.region,
                ''
              )
            )
          ) = LOWER(TRIM($2))

          AND LOWER(
            TRIM(
              COALESCE(
                c.department,
                ''
              )
            )
          ) = LOWER(TRIM($3))

          ORDER BY
            c.due_date ASC NULLS LAST,
            c.created_at ASC,
            c.id ASC
        `;

        params = [
          reviewerLevel - 1,
          userRegion,
          department,
        ];
      }

      // =================================================
      // ASSISTANT VICE PRESIDENT
      // =================================================
      //
      // Must already be checked by RM:
      // review_level must be 3.
      // Same division and same department only.
      // =================================================

      else if (
        role ===
        "assistant vice president"
      ) {
        if (!userDivision) {
          return res.json([]);
        }

        sql = `
          ${baseSql}

          AND LOWER(
            TRIM(
              COALESCE(
                c.division,
                ''
              )
            )
          ) = LOWER(TRIM($2))

          AND LOWER(
            TRIM(
              COALESCE(
                c.department,
                ''
              )
            )
          ) = LOWER(TRIM($3))

          ORDER BY
            c.due_date ASC NULLS LAST,
            c.created_at ASC,
            c.id ASC
        `;

        params = [
          reviewerLevel - 1,
          userDivision,
          department,
        ];
      }

      // =================================================
      // VICE PRESIDENT
      // =================================================
      //
      // Must already be checked by AVP:
      // review_level must be 4.
      // Same department only.
      // =================================================

      else if (
        role === "vice president"
      ) {
        sql = `
          ${baseSql}

          AND LOWER(
            TRIM(
              COALESCE(
                c.department,
                ''
              )
            )
          ) = LOWER(TRIM($2))

          ORDER BY
            c.due_date ASC NULLS LAST,
            c.created_at ASC,
            c.id ASC
        `;

        params = [
          reviewerLevel - 1,
          department,
        ];
      }

      // =================================================
      // SENIOR VICE PRESIDENT
      // =================================================
      //
      // Must already be checked by VP:
      // review_level must be 5.
      // Same department only.
      // =================================================

      else if (
        role ===
        "senior vice president"
      ) {
        sql = `
          ${baseSql}

          AND LOWER(
            TRIM(
              COALESCE(
                c.department,
                ''
              )
            )
          ) = LOWER(TRIM($2))

          ORDER BY
            c.due_date ASC NULLS LAST,
            c.created_at ASC,
            c.id ASC
        `;

        params = [
          reviewerLevel - 1,
          department,
        ];
      }

      else {
        return res.json([]);
      }

      const result = await pool.query(
        sql,
        params
      );

      return res.json(result.rows);
    } catch (error) {
      console.error("========== REVIEW SCOPE ERROR ==========");
      console.error(error);
      console.error(error.stack);

      return res.status(500).json({
        message: error.message,
        stack: error.stack,
      });
    }
  }
);

// =====================================================
// MANAGER PENDING REVIEW COUNT
// Used for the red Comply badge.
// =====================================================

router.get(
  "/travel-plan-compliances/review-pending-count",
  requireAuth,
  async (req, res) => {
    try {
      if (!canCheckCompliance(req)) {
        return res.json({
          pending_count: 0,
        });
      }

      const role = normalizeRole(
        req.user?.role
      );

      const department =
        normalizeDepartment(
          req.user?.department
        );

      const userArea = toStr(
        req.user?.area
      );

      const userRegion = toStr(
        req.user?.region
      );

      const userDivision = toStr(
        req.user?.division
      );

      const reviewerLevel =
        getComplianceReviewLevel(req);

      let sql = "";
      let params = [];

      if (isAdminOrIT(req)) {
        sql = `
          SELECT
            COUNT(*)::INTEGER
              AS pending_count

          FROM public.travel_plan_compliances

          WHERE status IN (
            'Submitted',
            'Checked'
          )

            AND COALESCE(
              review_level,
              0
            ) BETWEEN 1 AND 5
        `;
      }

      else if (
        [
          "area manager",
          "acting area manager",
        ].includes(role)
      ) {
        if (!userArea) {
          return res.json({
            pending_count: 0,
          });
        }

        sql = `
          SELECT
            COUNT(*)::INTEGER
              AS pending_count

          FROM public.travel_plan_compliances

          WHERE status = 'Submitted'

            AND review_level = $1

            AND LOWER(
              TRIM(
                COALESCE(area, '')
              )
            ) = LOWER(TRIM($2))

            AND LOWER(
              TRIM(
                COALESCE(
                  department,
                  ''
                )
              )
            ) = LOWER(TRIM($3))
        `;

        params = [
          reviewerLevel - 1,
          userArea,
          department,
        ];
      }

      else if (
        [
          "regional manager",
          "acting regional manager",
        ].includes(role)
      ) {
        if (!userRegion) {
          return res.json({
            pending_count: 0,
          });
        }

        sql = `
          SELECT
            COUNT(*)::INTEGER
              AS pending_count

          FROM public.travel_plan_compliances

          WHERE status = 'Checked'

            AND review_level = $1

            AND LOWER(
              TRIM(
                COALESCE(region, '')
              )
            ) = LOWER(TRIM($2))

            AND LOWER(
              TRIM(
                COALESCE(
                  department,
                  ''
                )
              )
            ) = LOWER(TRIM($3))
        `;

        params = [
          reviewerLevel - 1,
          userRegion,
          department,
        ];
      }

      else if (
        role ===
        "assistant vice president"
      ) {
        if (!userDivision) {
          return res.json({
            pending_count: 0,
          });
        }

        sql = `
          SELECT
            COUNT(*)::INTEGER
              AS pending_count

          FROM public.travel_plan_compliances

          WHERE status = 'Checked'

            AND review_level = $1

            AND LOWER(
              TRIM(
                COALESCE(
                  division,
                  ''
                )
              )
            ) = LOWER(TRIM($2))

            AND LOWER(
              TRIM(
                COALESCE(
                  department,
                  ''
                )
              )
            ) = LOWER(TRIM($3))
        `;

        params = [
          reviewerLevel - 1,
          userDivision,
          department,
        ];
      }

      else if (
        [
          "vice president",
          "senior vice president",
        ].includes(role)
      ) {
        sql = `
          SELECT
            COUNT(*)::INTEGER
              AS pending_count

          FROM public.travel_plan_compliances

          WHERE status = 'Checked'

            AND review_level = $1

            AND LOWER(
              TRIM(
                COALESCE(
                  department,
                  ''
                )
              )
            ) = LOWER(TRIM($2))
        `;

        params = [
          reviewerLevel - 1,
          department,
        ];
      }

      else {
        return res.json({
          pending_count: 0,
        });
      }

      const result = await pool.query(
        sql,
        params
      );

      return res.json({
        pending_count:
          Number(
            result.rows[0]?.pending_count
          ) || 0,
      });
    } catch (error) {
      return sendServerError(
        res,
        "GET /travel-plan-compliances/review-pending-count",
        error
      );
    }
  }
);

module.exports = router;