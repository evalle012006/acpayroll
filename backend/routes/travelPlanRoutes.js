const express = require("express");
const router = express.Router();

const pool = require("../db");
const { deleteKey } = require("../services/spacesUpload");
const { requireAuth } = require("../middlewares/authMiddleware");

const {
  toStr,
  norm,
  isValidId,
  normalizeDepartment,
  normalizeRole,

  TREAD_TRAVEL_PLAN_ROLES,

  isAuditDepartment,
  isOfficeOfPresidentDepartment,
  isOperationStyleTravelDepartment,

  isAdminOrIT,
  canViewTravelModule,
  canCreatePlan,
  canEditPlan,
  canDeleteTravelRecord,

  markExpiredTravelPlansIncomplete,
  wouldCreateThreeConsecutiveBranchVisits,
  manilaTimestampSql,
  sendServerError,
} = require("../utils/travelPlanHelpers");

const travelPlanSelect = `
  id,
  title,
  TO_CHAR(plan_date, 'YYYY-MM-DD') AS plan_date,

  employee_name,
  position,

  branch_name,
  description,

  review,
  findings,

  photo_url,
  ${manilaTimestampSql("photo_uploaded_at")} AS photo_uploaded_at,
  photo_latitude,
  photo_longitude,

  check_in_photo_url,
  ${manilaTimestampSql("check_in_at")} AS check_in_at,
  check_in_latitude,
  check_in_longitude,

  check_out_photo_url,
  ${manilaTimestampSql("check_out_at")} AS check_out_at,
  check_out_latitude,
  check_out_longitude,

  created_by,

  status,
  ${manilaTimestampSql("submitted_at")} AS submitted_at,
  submitted_by,

  ${manilaTimestampSql("created_at")} AS created_at,
  ${manilaTimestampSql("updated_at")} AS updated_at
`;

// =====================================================
// GET TRAVEL PLANS BASED ON ACCOUNT SCOPE
// =====================================================

router.get(
  "/travel-plans",
  requireAuth,
  async (req, res) => {
    try {
      if (!canViewTravelModule(req)) {
        return res.status(403).json({
          message:
            "You are not allowed to view travel plans.",
        });
      }

      await markExpiredTravelPlansIncomplete(pool);

      const role = normalizeRole(req.user?.role);

      const department = normalizeDepartment(
        req.user?.department
      );

      const userArea = toStr(req.user?.area);
      const userRegion = toStr(req.user?.region);
      const userDivision = toStr(req.user?.division);
      const userBranchId = Number(req.user?.branch_id);

      /*
        The inner query first formats every travel plan
        using travelPlanSelect.

        The lateral staff lookup finds the staff member
        assigned to the travel plan.

        The branch lookup provides area, region, and
        division when those values are stored in branches.
      */

      const baseSql = `
        SELECT
          tp_data.*

        FROM (
          SELECT
            ${travelPlanSelect}
          FROM public.travel_plans
        ) tp_data

        LEFT JOIN LATERAL (
          SELECT
            s.id,
            s.employee_no,
            s.fullname,
            s.position,
            s.department,
            s.area,
            s.region,
            s.division,
            s.branch_id

          FROM public.staff s

          LEFT JOIN public.branches staff_branch
            ON staff_branch.id = s.branch_id

          WHERE LOWER(
            TRIM(
              COALESCE(
                NULLIF(TRIM(s.fullname), ''),
                NULLIF(
                  TRIM(
                    CONCAT_WS(
                      ' ',
                      s.last_name,
                      s.first_name,
                      s.middle_name
                    )
                  ),
                  ''
                ),
                ''
              )
            )
          ) = LOWER(
            TRIM(
              COALESCE(
                tp_data.employee_name,
                ''
              )
            )
          )

          ORDER BY
            CASE
              WHEN LOWER(
                TRIM(
                  COALESCE(
                    staff_branch.name,
                    ''
                  )
                )
              ) = LOWER(
                TRIM(
                  COALESCE(
                    tp_data.branch_name,
                    ''
                  )
                )
              )
              THEN 0
              ELSE 1
            END,

            s.id ASC

          LIMIT 1
        ) matched_staff
          ON TRUE

        LEFT JOIN LATERAL (
          SELECT
            b.id,
            b.name,
            b.code,
            b.area,
            b.region,
            b.division

          FROM public.branches b

          WHERE LOWER(
            TRIM(
              COALESCE(b.name, '')
            )
          ) = LOWER(
            TRIM(
              COALESCE(
                tp_data.branch_name,
                ''
              )
            )
          )

          ORDER BY b.id ASC
          LIMIT 1
        ) matched_branch
          ON TRUE

        WHERE 1 = 1
      `;

      let sql = "";
      let params = [];

      // =================================================
      // ADMIN / IT
      // =================================================
      // Can see every travel plan.
      // =================================================

      if (isAdminOrIT(req)) {
        sql = `
          ${baseSql}

          ORDER BY
            tp_data.plan_date DESC,
            tp_data.id DESC
        `;
      }

      // =================================================
      // OFFICE OF THE PRESIDENT
      // =================================================
      // Any role under this department can see all
      // travel plans.
      // =================================================

      else if (
        isOfficeOfPresidentDepartment(
          department
        )
      ) {
        sql = `
          ${baseSql}

          ORDER BY
            tp_data.plan_date DESC,
            tp_data.id DESC
        `;
      }

      // =================================================
      // TREAD DEPARTMENT
      // =================================================
      // Existing rule: allowed TREAD roles can see all.
      // =================================================

      else if (
        department === "tread department" &&
        TREAD_TRAVEL_PLAN_ROLES.includes(role)
      ) {
        sql = `
          ${baseSql}

          ORDER BY
            tp_data.plan_date DESC,
            tp_data.id DESC
        `;
      }

      // AREA MANAGER / ACTING AREA MANAGER
      // =================================================
      // AUDIT BRANCH MANAGER / ACTING BRANCH MANAGER
      // =================================================
      // Can see Audit Department travel plans assigned
      // to staff from the same branch only.
      // =================================================

      else if (
        isAuditDepartment(department) &&
        [
          "branch manager",
          "acting branch manager",
        ].includes(role)
      ) {
        if (!Number.isInteger(userBranchId) || userBranchId <= 0) {
          return res.json([]);
        }

        sql = `
          ${baseSql}

          AND COALESCE(
            matched_staff.branch_id,
            matched_branch.id
          ) = $1

          AND LOWER(
            TRIM(
              COALESCE(
                matched_staff.department,
                ''
              )
            )
          ) = LOWER(TRIM($2))

          ORDER BY
            tp_data.plan_date DESC,
            tp_data.id DESC
        `;

        params = [userBranchId, department];
      }

      // =================================================
      // AREA MANAGER / ACTING AREA MANAGER
      // =================================================
      //
      // Same area only.
      // Can see Area Manager and lower positions.
      // Cannot see RM, AVP, VP, or SVP.
      // =================================================

      else if (
        isOperationStyleTravelDepartment(department) &&
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
                NULLIF(
                  TRIM(matched_staff.area),
                  ''
                ),
                NULLIF(
                  TRIM(matched_branch.area),
                  ''
                ),
                ''
              )
            )
          ) = LOWER(TRIM($1))

          AND LOWER(
            TRIM(
              COALESCE(
                matched_staff.department,
                ''
              )
            )
          ) = LOWER(TRIM($2))

          AND LOWER(
            TRIM(
              COALESCE(
                matched_staff.position,
                tp_data.position,
                ''
              )
            )
          ) NOT IN (
            'regional manager',
            'acting regional manager',
            'assistant vice president',
            'vice president',
            'senior vice president',
            'president'
          )

          ORDER BY
            tp_data.plan_date DESC,
            tp_data.id DESC
        `;

        params = [userArea, department];
      }

      // =================================================
      // REGIONAL MANAGER / ACTING REGIONAL MANAGER
      // =================================================
      //
      // Same region only.
      // Can see Regional Manager and lower positions.
      // Cannot see AVP, VP, or SVP.
      // =================================================

      else if (
        isOperationStyleTravelDepartment(department) &&
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
                NULLIF(
                  TRIM(matched_staff.region),
                  ''
                ),
                NULLIF(
                  TRIM(matched_branch.region),
                  ''
                ),
                ''
              )
            )
          ) = LOWER(TRIM($1))

          AND LOWER(
            TRIM(
              COALESCE(
                matched_staff.department,
                ''
              )
            )
          ) = LOWER(TRIM($2))

          AND LOWER(
            TRIM(
              COALESCE(
                matched_staff.position,
                tp_data.position,
                ''
              )
            )
          ) NOT IN (
            'assistant vice president',
            'vice president',
            'senior vice president',
            'president'
          )

          ORDER BY
            tp_data.plan_date DESC,
            tp_data.id DESC
        `;

        params = [userRegion, department];
      }

      // =================================================
      // ASSISTANT VICE PRESIDENT
      // =================================================
      //
      // Same division only.
      // Can see AVP and lower positions.
      // Cannot see VP or SVP.
      // =================================================

      else if (
        isOperationStyleTravelDepartment(department) &&
        role === "assistant vice president"
      ) {
        if (!userDivision) {
          return res.json([]);
        }

        sql = `
          ${baseSql}

          AND LOWER(
            TRIM(
              COALESCE(
                NULLIF(
                  TRIM(matched_staff.division),
                  ''
                ),
                NULLIF(
                  TRIM(matched_branch.division),
                  ''
                ),
                ''
              )
            )
          ) = LOWER(TRIM($1))

          AND LOWER(
            TRIM(
              COALESCE(
                matched_staff.department,
                ''
              )
            )
          ) = LOWER(TRIM($2))

          AND LOWER(
            TRIM(
              COALESCE(
                matched_staff.position,
                tp_data.position,
                ''
              )
            )
          ) NOT IN (
            'vice president',
            'senior vice president',
            'president'
          )

          ORDER BY
            tp_data.plan_date DESC,
            tp_data.id DESC
        `;

        params = [userDivision, department];
      }

      // =================================================
      // VICE PRESIDENT
      // =================================================
      //
      // Can see Operation Department plans from
      // Vice President downward.
      // Cannot see Senior Vice President or President.
      // =================================================

      else if (
        isOperationStyleTravelDepartment(department) &&
        role === "vice president"
      ) {
        sql = `
          ${baseSql}

          AND LOWER(
            TRIM(
              COALESCE(
                matched_staff.department,
                ''
              )
            )
          ) = LOWER(TRIM($1))

          AND LOWER(
            TRIM(
              COALESCE(
                matched_staff.position,
                tp_data.position,
                ''
              )
            )
          ) NOT IN (
            'senior vice president',
            'president'
          )

          ORDER BY
            tp_data.plan_date DESC,
            tp_data.id DESC
        `;
        params = [department];
      }

      // =================================================
      // SENIOR VICE PRESIDENT
      // =================================================
      //
      // Can see all Operation Department travel plans.
      // =================================================

      else if (
        isOperationStyleTravelDepartment(department) &&
        role === "senior vice president"
      ) {
        sql = `
          ${baseSql}

          AND LOWER(
            TRIM(
              COALESCE(
                matched_staff.department,
                ''
              )
            )
          ) = LOWER(TRIM($1))

          ORDER BY
            tp_data.plan_date DESC,
            tp_data.id DESC
        `;
        params = [department];
      }

      // =================================================
      // NO MATCHING SCOPE
      // =================================================

      else {
        return res.json([]);
      }

      const result = await pool.query(
        sql,
        params
      );

      return res.json(result.rows);
    } catch (error) {
      return sendServerError(
        res,
        "GET /travel-plans",
        error
      );
    }
  }
);  

// =====================================================
// CREATE TRAVEL PLAN
// =====================================================

router.post("/travel-plans", requireAuth, async (req, res) => {
  const client = await pool.connect();

  try {
    if (!canCreatePlan(req)) {
      return res.status(403).json({
        message:
          "You are not allowed to create a travel plan.",
      });
    }

    const title = toStr(req.body.title);
    const planDate = toStr(req.body.plan_date);

    const employeeName = toStr(req.body.employee_name);
    const position = toStr(req.body.position);

    const branchName = toStr(req.body.branch_name);
    const description = toStr(req.body.description);

    if (!title) {
      return res.status(400).json({
        message: "Title is required.",
      });
    }

    if (!planDate) {
      return res.status(400).json({
        message: "Plan date is required.",
      });
    }

    if (!employeeName) {
      return res.status(400).json({
        message: "Employee is required.",
      });
    }

    if (!branchName) {
      return res.status(400).json({
        message: "Branch is required.",
      });
    }

    // =====================================================
    // CONSECUTIVE BRANCH VISIT RESTRICTION
    // =====================================================
    //
    // AUDIT DEPARTMENT:
    // - Any role
    // - Unlimited consecutive visits to the same branch
    //
    // OTHER DEPARTMENTS:
    // - Keep existing maximum of 2 consecutive visits
    // - Third consecutive visit to the same branch is blocked
    // =====================================================

    const currentDepartment = normalizeDepartment(
      req.user?.department
    );

    if (!isAuditDepartment(currentDepartment)) {
      const hasThreeConsecutiveVisits =
        await wouldCreateThreeConsecutiveBranchVisits(
          client,
          {
            employeeName,
            branchName,
            planDate,
          }
        );

      if (hasThreeConsecutiveVisits) {
        return res.status(400).json({
          message:
            `${employeeName} cannot visit ${branchName} three times in a row. ` +
            "Select a different branch before visiting this branch again.",
        });
      }
    }

    const result = await client.query(
      `
      INSERT INTO public.travel_plans
      (
        title,
        plan_date,

        employee_name,
        position,

        branch_name,
        description,

        created_by,

        status,
        created_at,
        updated_at
      )
      VALUES
      (
        $1,
        $2::date,

        $3,
        $4,

        $5,
        $6,

        $7,

        'Pending',
        NOW() AT TIME ZONE 'Asia/Manila',
        NOW() AT TIME ZONE 'Asia/Manila'
      )
      RETURNING
        ${travelPlanSelect}
      `,
      [
        title,
        planDate,

        employeeName || null,
        position || null,

        branchName || null,
        description || null,

        req.user?.id || null,
      ]
    );

    return res.status(201).json({
      message: "Travel plan created successfully.",
      plan: result.rows[0],
    });
  } catch (error) {
    return sendServerError(
      res,
      "POST /travel-plans",
      error
    );
  } finally {
    client.release();
  }
});

// =====================================================
// UPDATE TRAVEL PLAN
// =====================================================

router.put("/travel-plans/:id", requireAuth, async (req, res) => {

  const client = await pool.connect();

  try {
    if (!canEditPlan(req)) {
      return res.status(403).json({
        message:
          "You are not allowed to edit this travel plan.",
      });
    }

    const id = Number(req.params.id);

    if (!isValidId(id)) {
      return res.status(400).json({
        message: "Invalid travel plan ID.",
      });
    }

    const existingResult = await client.query(
      `
      SELECT
        id,
        status,
        plan_date,
        created_by
      FROM public.travel_plans
      WHERE id = $1
      LIMIT 1
      `,
      [id]
    );

    if (!existingResult.rowCount) {
      return res.status(404).json({
        message: "Travel plan not found.",
      });
    }

    const existingPlan = existingResult.rows[0];

    const todayResult = await client.query(`
      SELECT (
        NOW() AT TIME ZONE 'Asia/Manila'
      )::date AS today
    `);

    const today = String(
      todayResult.rows[0]?.today || ""
    ).slice(0, 10);

    const existingPlanDate = String(
      existingPlan.plan_date || ""
    ).slice(0, 10);

    const existingStatus = norm(
      existingPlan.status
    );

    if (existingStatus === "completed") {
      return res.status(400).json({
        message:
          "Completed travel plans can no longer be edited.",
      });
    }

    const currentRole = normalizeRole(req.user?.role);
    const isAdminUser = currentRole === "admin";

    if (
      existingStatus === "incomplete" &&
      !isAdminUser
    ) {
      return res.status(400).json({
        message:
          "This travel plan is incomplete and can only be edited by Admin.",
      });
    }

    if (
      existingStatus === "pending" &&
      existingPlanDate &&
      existingPlanDate < today
    ) {
      await client.query(
        `
        UPDATE public.travel_plans
        SET
          status = 'Incomplete',
          updated_at =
            NOW() AT TIME ZONE 'Asia/Manila'
        WHERE id = $1
        `,
        [id]
      );

      if (!isAdminUser) {
        return res.status(400).json({
          message:
            "This travel plan was not completed on its scheduled date and can only be edited by Admin.",
        });
      }
    }

    const title = toStr(req.body.title);
    const planDate = toStr(req.body.plan_date);

    const employeeName = toStr(req.body.employee_name);
    const position = toStr(req.body.position);

    const branchName = toStr(req.body.branch_name);
    const description = toStr(req.body.description);

    if (!title) {
      return res.status(400).json({
        message: "Title is required.",
      });
    }

    if (!planDate) {
      return res.status(400).json({
        message: "Plan date is required.",
      });
    }

    if (!employeeName) {
      return res.status(400).json({
        message: "Employee is required.",
      });
    }

    if (!branchName) {
      return res.status(400).json({
        message: "Branch is required.",
      });
    }

    // =====================================================
    // CONSECUTIVE BRANCH VISIT RESTRICTION
    // =====================================================
    //
    // AUDIT DEPARTMENT:
    // - Any role
    // - Unlimited consecutive visits to the same branch
    //
    // OTHER DEPARTMENTS:
    // - Keep existing maximum of 2 consecutive visits
    // =====================================================

    const currentDepartment = normalizeDepartment(
      req.user?.department
    );

    if (!isAuditDepartment(currentDepartment)) {
      const hasThreeConsecutiveVisits =
        await wouldCreateThreeConsecutiveBranchVisits(
          client,
          {
            employeeName,
            branchName,
            planDate,
            excludePlanId: id,
          }
        );

      if (hasThreeConsecutiveVisits) {
        return res.status(400).json({
          message:
            `${employeeName} cannot visit ${branchName} three times in a row. ` +
            "Select a different branch before visiting this branch again.",
        });
      }
    }

    const result = await client.query(
      `
      UPDATE public.travel_plans
      SET
        title = $2,
        plan_date = $3::date,

        employee_name = $4,
        position = $5,

        branch_name = $6,
        description = $7,

        updated_at =
          NOW() AT TIME ZONE 'Asia/Manila'
      WHERE id = $1
      RETURNING
        ${travelPlanSelect}
      `,
      [
        id,
        title,
        planDate,

        employeeName || null,
        position || null,

        branchName || null,
        description || null,
      ]
    );

    return res.json({
      message: "Travel plan updated successfully.",
      plan: result.rows[0],
    });
  } catch (error) {
    return sendServerError(
      res,
      "PUT /travel-plans/:id",
      error
    );
  } finally {
    client.release();
  }
});

// =====================================================
// DELETE TRAVEL PLAN
// =====================================================

router.delete("/travel-plans/:id", requireAuth, async (req, res) => {
  const client = await pool.connect();

  try {
    if (!canDeleteTravelRecord(req)) {
      return res.status(403).json({
        message:
          "Only Admin, IT, and TREAD Department can delete travel plans.",
      });
    }

    const id = Number(req.params.id);

    if (!isValidId(id)) {
      return res.status(400).json({
        message: "Invalid travel plan ID.",
      });
    }

    await client.query("BEGIN");

    const photoResult = await client.query(
      `
      SELECT
        photo_url
      FROM public.travel_plan_photos
      WHERE travel_plan_id = $1
      `,
      [id]
    );

    const deleteResult = await client.query(
      `
      DELETE FROM public.travel_plans
      WHERE id = $1
      RETURNING id
      `,
      [id]
    );

    if (!deleteResult.rowCount) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        message: "Travel plan not found.",
      });
    }

    await client.query("COMMIT");

    for (const photo of photoResult.rows) {
      if (!photo.photo_url) continue;

      try {
        await deleteKey(photo.photo_url);
      } catch (deleteError) {
        console.error(
          "Failed to delete travel-plan photo:",
          photo.photo_url,
          deleteError
        );
      }
    }

    return res.json({
      message: "Travel plan deleted successfully.",
    });
  } catch (error) {
    await client.query("ROLLBACK");

    return sendServerError(
      res,
      "DELETE /travel-plans/:id",
      error
    );
  } finally {
    client.release(); 
  }
});

// =====================================================
// SUBMIT / COMPLETE TRAVEL PLAN
// =====================================================

router.put(
  "/travel-plans/:id/submit",
  requireAuth,
  async (req, res) => {
    const client = await pool.connect();

    try {
      if (!canEditPlan(req)) {
        return res.status(403).json({
          message:
            "You are not allowed to submit this travel plan.",
        });
      }

      const travelPlanId = Number(req.params.id);

      if (!isValidId(travelPlanId)) {
        return res.status(400).json({
          message: "Invalid travel plan ID.",
        });
      }

      await client.query("BEGIN");

      const planResult = await client.query(
        `
        SELECT
          id,
          title,
          status,
          plan_date,
          created_by
        FROM public.travel_plans
        WHERE id = $1
        LIMIT 1
        FOR UPDATE
        `,
        [travelPlanId]
      );

      if (!planResult.rowCount) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          message: "Travel plan not found.",
        });
      }

      const existingPlan = planResult.rows[0];

      if (norm(existingPlan.status) === "completed") {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message: "This travel plan is already completed.",
        });
      }

      const todayResult = await client.query(`
        SELECT (
          NOW() AT TIME ZONE 'Asia/Manila'
        )::date AS today
      `);

      const today = String(
        todayResult.rows[0]?.today || ""
      ).slice(0, 10);

      const planDate = String(
        existingPlan.plan_date || ""
      ).slice(0, 10);

      if (
        norm(existingPlan.status) ===
          "incomplete" ||
        (
          norm(existingPlan.status) ===
            "pending" &&
          planDate &&
          planDate < today
        )
      ) {
        await client.query(
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

        await client.query("COMMIT");

        return res.status(400).json({
          message:
            "This travel plan was not completed on its scheduled date and is now incomplete.",
        });
      }

      // Check that the travel plan has at least one check-in photo.
      const checkInResult = await client.query(
        `
        SELECT
          id,
          photo_url,
          latitude,
          longitude,
          captured_at
        FROM public.travel_plan_photos
        WHERE travel_plan_id = $1
          AND UPPER(TRIM(COALESCE(photo_type, ''))) = 'CHECK_IN'
        ORDER BY
          captured_at ASC NULLS LAST,
          created_at ASC,
          id ASC
        LIMIT 1
        `,
        [travelPlanId]
      );

      if (!checkInResult.rowCount) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message:
            "A check-in photo is required before completing the travel plan.",
        });
      }

      // Check that the travel plan has at least one check-out photo.
      const checkOutResult = await client.query(
        `
        SELECT
          id,
          photo_url,
          latitude,
          longitude,
          captured_at
        FROM public.travel_plan_photos
        WHERE travel_plan_id = $1
          AND UPPER(TRIM(COALESCE(photo_type, ''))) = 'CHECK_OUT'
        ORDER BY
          captured_at DESC NULLS LAST,
          created_at DESC,
          id DESC
        LIMIT 1
        `,
        [travelPlanId]
      );

      if (!checkOutResult.rowCount) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message:
            "A check-out photo is required before completing the travel plan.",
        });
      }

      const checkInPhoto = checkInResult.rows[0];
      const checkOutPhoto = checkOutResult.rows[0];

      // Prevent an invalid check-out time.
      if (
        checkInPhoto.captured_at &&
        checkOutPhoto.captured_at &&
        new Date(checkOutPhoto.captured_at) <
          new Date(checkInPhoto.captured_at)
      ) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message:
            "Check-out time cannot be earlier than check-in time.",
        });
      }

      // Get the latest Review note.
      const reviewResult = await client.query(
        `
        SELECT
          title,
          involved_staff,
          content
        FROM public.travel_plan_notes
        WHERE travel_plan_id = $1
          AND UPPER(TRIM(note_type)) = 'REVIEW'
        ORDER BY
          created_at DESC,
          id DESC
        LIMIT 1
        `,
        [travelPlanId]
      );

      // Get the latest Findings note.
      const findingsResult = await client.query(
        `
        SELECT
          title,
          involved_staff,
          content
        FROM public.travel_plan_notes
        WHERE travel_plan_id = $1
          AND UPPER(TRIM(note_type)) = 'FINDINGS'
        ORDER BY
          created_at DESC,
          id DESC
        LIMIT 1
        `,
        [travelPlanId]
      );

      const latestReview = reviewResult.rows[0] || null;
      const latestFindings = findingsResult.rows[0] || null;

      const reviewText = latestReview
        ? [
            latestReview.title,
            latestReview.involved_staff
              ? `Involved: ${latestReview.involved_staff}`
              : "",
            latestReview.content,
          ]
            .filter(Boolean)
            .join("\n")
        : null;

      const findingsText = latestFindings
        ? [
            latestFindings.title,
            latestFindings.involved_staff
              ? `Involved: ${latestFindings.involved_staff}`
              : "",
            latestFindings.content,
          ]
            .filter(Boolean)
            .join("\n")
        : null;

      const result = await client.query(
        `
        UPDATE public.travel_plans
        SET
          status = 'Completed',

          submitted_at =
            NOW() AT TIME ZONE 'Asia/Manila',

          submitted_by = $2,

          review = $3,
          findings = $4,

          check_in_photo_url = $5,
          check_in_at = $6,
          check_in_latitude = $7,
          check_in_longitude = $8,

          check_out_photo_url = $9,
          check_out_at = $10,
          check_out_latitude = $11,
          check_out_longitude = $12,

          updated_at =
            NOW() AT TIME ZONE 'Asia/Manila'
        WHERE id = $1
        RETURNING
          ${travelPlanSelect}
        `,
        [
          travelPlanId,
          req.user?.id || null,

          reviewText,
          findingsText,

          checkInPhoto.photo_url || null,
          checkInPhoto.captured_at || null,
          checkInPhoto.latitude || null,
          checkInPhoto.longitude || null,

          checkOutPhoto.photo_url || null,
          checkOutPhoto.captured_at || null,
          checkOutPhoto.latitude || null,
          checkOutPhoto.longitude || null,
        ]
      );

      await client.query("COMMIT");

      return res.json({
        message: "Travel plan completed successfully.",
        plan: result.rows[0],
      });
    } catch (error) {
      await client.query("ROLLBACK");

      return sendServerError(
        res,
        "PUT /travel-plans/:id/submit",
        error
      );
    } finally {
      client.release();
    }
  }
);

// =====================================================
// ADMIN COMPLETE INCOMPLETE TRAVEL PLAN
// =====================================================

router.put(
  "/travel-plans/:id/admin-complete",
  requireAuth,
  async (req, res) => {
    try {
      const role = normalizeRole(req.user?.role);

      if (role !== "admin") {
        return res.status(403).json({
          message:
            "Only Admin can complete an incomplete travel plan.",
        });
      }

      const travelPlanId = Number(req.params.id);

      if (!isValidId(travelPlanId)) {
        return res.status(400).json({
          message: "Invalid travel plan ID.",
        });
      }

      const existingResult = await pool.query(
        `
        SELECT
          id,
          status
        FROM public.travel_plans
        WHERE id = $1
        LIMIT 1
        `,
        [travelPlanId]
      );

      if (!existingResult.rowCount) {
        return res.status(404).json({
          message: "Travel plan not found.",
        });
      }

      const currentStatus = norm(
        existingResult.rows[0].status
      );

      if (currentStatus !== "incomplete") {
        return res.status(400).json({
          message:
            "Only incomplete travel plans can be completed using Admin override.",
        });
      }

      const result = await pool.query(
        `
        UPDATE public.travel_plans
        SET
          status = 'Completed',
          submitted_at =
            NOW() AT TIME ZONE 'Asia/Manila',
          submitted_by = $2,
          updated_at =
            NOW() AT TIME ZONE 'Asia/Manila'
        WHERE id = $1

        RETURNING
          ${travelPlanSelect}
        `,
        [
          travelPlanId,
          req.user?.id || null,
        ]
      );

      return res.json({
        message:
          "Incomplete travel plan marked as completed by Admin.",
        plan: result.rows[0],
      });
    } catch (error) {
      return sendServerError(
        res,
        "PUT /travel-plans/:id/admin-complete",
        error
      );
    }
  }
);

// =====================================================
// REOPEN COMPLETED TRAVEL PLAN
// =====================================================

//
// Only Admin and IT can reopen a completed plan.
//

router.put(
  "/travel-plans/:id/reopen",
  requireAuth,
  async (req, res) => {
    try {
      if (!canDeleteTravelRecord(req)) {
        return res.status(403).json({
          message:
            "Only Admin, IT, and TREAD Department can reopen completed travel plans.",
        });
      }

      const travelPlanId = Number(req.params.id);

      if (!isValidId(travelPlanId)) {
        return res.status(400).json({
          message: "Invalid travel plan ID.",
        });
      }

      const existingResult = await pool.query(
        `
        SELECT
          id,
          status
        FROM public.travel_plans
        WHERE id = $1
        LIMIT 1
        `,
        [travelPlanId]
      );

      if (!existingResult.rowCount) {
        return res.status(404).json({
          message: "Travel plan not found.",
        });
      }

      if (
        norm(existingResult.rows[0].status) !== "completed"
      ) {
        return res.status(400).json({
          message:
            "Only completed travel plans can be reopened.",
        });
      }

      const result = await pool.query(
        `
        UPDATE public.travel_plans
        SET
          status = 'Pending',
          submitted_at = NULL,
          submitted_by = NULL,
          updated_at =
            NOW() AT TIME ZONE 'Asia/Manila'
        WHERE id = $1
        RETURNING
          ${travelPlanSelect}
        `,
        [travelPlanId]
      );

      return res.json({
        message: "Travel plan reopened successfully.",
        plan: result.rows[0],
      });
    } catch (error) {
      return sendServerError(
        res,
        "PUT /travel-plans/:id/reopen",
        error
      );
    }
  }
);

// =====================================================
// COMPLETED TRAVEL PLAN HISTORY
// ONLY THE LOGGED-IN ACCOUNT'S OWN COMPLETED PLANS
// =====================================================

router.get(
  "/travel-plans/history/completed",
  requireAuth,
  async (req, res) => {
    try {
      if (!canViewTravelModule(req)) {
        return res.status(403).json({
          message:
            "You are not allowed to view travel plan history.",
        });
      }

      const userId = Number(req.user?.id);

      if (!Number.isInteger(userId) || userId <= 0) {
        return res.status(401).json({
          message:
            "Unable to identify the logged-in account.",
        });
      }

      const result = await pool.query(
        `
        SELECT
          ${travelPlanSelect},

          CASE
            WHEN check_in_at IS NOT NULL
              AND check_out_at IS NOT NULL
              AND check_out_at >= check_in_at
            THEN
              EXTRACT(
                EPOCH FROM (check_out_at - check_in_at)
              )::BIGINT
            ELSE NULL
          END AS duration_seconds,

          CASE
            WHEN check_in_at IS NOT NULL
              AND check_out_at IS NOT NULL
              AND check_out_at >= check_in_at
            THEN
              CONCAT(
                FLOOR(
                  EXTRACT(
                    EPOCH FROM (check_out_at - check_in_at)
                  ) / 3600
                ),
                ' hr ',
                FLOOR(
                  MOD(
                    EXTRACT(
                      EPOCH FROM (check_out_at - check_in_at)
                    ),
                    3600
                  ) / 60
                ),
                ' min'
              )
            ELSE
              'Not complete'
          END AS duration_label

        FROM public.travel_plans

        WHERE LOWER(
          TRIM(
            COALESCE(status, '')
          )
        ) = 'completed'

          AND created_by = $1

        ORDER BY
          submitted_at DESC NULLS LAST,
          plan_date DESC,
          id DESC
        `,
        [userId]
      );

      return res.json(result.rows);
    } catch (error) {
      return sendServerError(
        res,
        "GET /travel-plans/history/completed",
        error
      );
    }
  }
);

// =====================================================
// GET TRAVEL PLANS BY BRANCH
// =====================================================
//
// Frontend example:
// GET /travel-plans/branch/CEBU%20BRANCH
//
// This route must stay above:
//
// GET /travel-plans/:id
//
// so Express does not treat "branch" as the ID.
// =====================================================

router.get(
  "/travel-plans/branch/:branchName",
  requireAuth,
  async (req, res) => {
    try {
      if (!canViewTravelModule(req)) {
        return res.status(403).json({
          message:
            "You are not allowed to view branch travel-plan records.",
        });
      }

      const branchName = toStr(req.params.branchName);

      if (!branchName) {
        return res.status(400).json({
          message: "Branch name is required.",
        });
      }

      const result = await pool.query(
        `
        SELECT
          ${travelPlanSelect},

          CASE
            WHEN check_in_at IS NOT NULL
              AND check_out_at IS NOT NULL
              AND check_out_at >= check_in_at
            THEN
              EXTRACT(
                EPOCH FROM (
                  check_out_at - check_in_at
                )
              )::BIGINT
            ELSE NULL
          END AS duration_seconds,

          CASE
            WHEN check_in_at IS NOT NULL
              AND check_out_at IS NOT NULL
              AND check_out_at >= check_in_at
            THEN
              CONCAT(
                FLOOR(
                  EXTRACT(
                    EPOCH FROM (
                      check_out_at - check_in_at
                    )
                  ) / 3600
                ),
                ' hr ',
                FLOOR(
                  MOD(
                    EXTRACT(
                      EPOCH FROM (
                        check_out_at - check_in_at
                      )
                    ),
                    3600
                  ) / 60
                ),
                ' min'
              )
            ELSE
              'Not complete'
          END AS duration_label

        FROM public.travel_plans

        WHERE LOWER(
          TRIM(
            COALESCE(branch_name, '')
          )
        ) = LOWER(TRIM($1))

        ORDER BY
          plan_date DESC,
          id DESC
        `,
        [branchName]
      );

      return res.json(result.rows);
    } catch (error) {
      return sendServerError(
        res,
        "GET /travel-plans/branch/:branchName",
        error
      );
    }
  }
);

// =====================================================
// GET ONE TRAVEL PLAN
// =====================================================
//
// Keep this near the bottom because:
//
// /travel-plans/:id
//
// can accidentally capture:
//
// /travel-plans/staff-scope
// /travel-plans/branch-scope
// /travel-plans/history
// /travel-plans/branch
//
// The specific routes must appear first.
// =====================================================

router.get(
  "/travel-plans/:id",
  requireAuth,
  async (req, res) => {
    try {
      if (!canViewTravelModule(req)) {
        return res.status(403).json({
          message:
            "You are not allowed to view this travel plan.",
        });
      }

      const travelPlanId = Number(req.params.id);

      if (!isValidId(travelPlanId)) {
        return res.status(400).json({
          message: "Invalid travel plan ID.",
        });
      }

      const result = await pool.query(
        `
        SELECT
          ${travelPlanSelect},

          CASE
            WHEN check_in_at IS NOT NULL
              AND check_out_at IS NOT NULL
              AND check_out_at >= check_in_at
            THEN
              EXTRACT(
                EPOCH FROM (
                  check_out_at - check_in_at
                )
              )::BIGINT
            ELSE NULL
          END AS duration_seconds,

          CASE
            WHEN check_in_at IS NOT NULL
              AND check_out_at IS NOT NULL
              AND check_out_at >= check_in_at
            THEN
              CONCAT(
                FLOOR(
                  EXTRACT(
                    EPOCH FROM (
                      check_out_at - check_in_at
                    )
                  ) / 3600
                ),
                ' hr ',
                FLOOR(
                  MOD(
                    EXTRACT(
                      EPOCH FROM (
                        check_out_at - check_in_at
                      )
                    ),
                    3600
                  ) / 60
                ),
                ' min'
              )
            ELSE
              'Not complete'
          END AS duration_label

        FROM public.travel_plans

        WHERE id = $1

        LIMIT 1
        `,
        [travelPlanId]
      );

      if (!result.rowCount) {
        return res.status(404).json({
          message: "Travel plan not found.",
        });
      }

      return res.json(result.rows[0]);
    } catch (error) {
      return sendServerError(
        res,
        "GET /travel-plans/:id",
        error
      );
    }
  }
);

module.exports = router;