const express = require("express");
const router = express.Router();

const pool = require("../db");
const { requireAuth } = require("../middlewares/authMiddleware");
const { getSignedDownloadUrl, } = require("../services/spacesUpload");

const { toStr, norm, isValidId, normalizeDepartment, normalizeRole,
  TREAD_TRAVEL_PLAN_ROLES,

  isAdminOrIT,
  isAuditDepartment,
  isOfficeOfPresidentDepartment,
  isOperationStyleTravelDepartment,

  canViewTravelModule,

  markExpiredTravelPlansIncomplete,
  manilaTimestampSql,
  sendServerError,
} = require("../utils/travelPlanHelpers");

const canViewCalendarSummaryRow = (req, row) => {
  const role = normalizeRole(req.user?.role);

  const department = normalizeDepartment(
    req.user?.department
  );

  const userArea = toStr(req.user?.area);
  const userRegion = toStr(req.user?.region);
  const userDivision = toStr(req.user?.division);
  const userBranchId = Number(req.user?.branch_id);

  const rowDepartment = normalizeDepartment(
    row?.department
  );

  const rowPosition = normalizeRole(
    row?.position
  );

  const rowArea = toStr(row?.area);
  const rowRegion = toStr(row?.region);
  const rowDivision = toStr(row?.division);

  const rowStaffBranchId = Number(
    row?.staff_branch_id
  );

  // ADMIN / IT
  if (isAdminOrIT(req)) {
    return true;
  }

  // OFFICE OF THE PRESIDENT
  if (
    isOfficeOfPresidentDepartment(
      department
    )
  ) {
    return true;
  }

  // TREAD
  if (
    department === "tread department" &&
    TREAD_TRAVEL_PLAN_ROLES.includes(role)
  ) {
    return true;
  }

  // AUDIT BRANCH MANAGER
  if (
    isAuditDepartment(department) &&
    [
      "branch manager",
      "acting branch manager",
    ].includes(role)
  ) {
    return (
      Number.isInteger(userBranchId) &&
      userBranchId > 0 &&
      rowStaffBranchId === userBranchId &&
      rowDepartment === department
    );
  }

  // AREA MANAGER
  if (
    isOperationStyleTravelDepartment(
      department
    ) &&
    [
      "area manager",
      "acting area manager",
    ].includes(role)
  ) {
    const blockedPositions = [
      "regional manager",
      "acting regional manager",
      "assistant vice president",
      "vice president",
      "senior vice president",
      "president",
    ];

    return (
      Boolean(userArea) &&
      norm(rowArea) === norm(userArea) &&
      rowDepartment === department &&
      !blockedPositions.includes(
        rowPosition
      )
    );
  }

  // REGIONAL MANAGER
  if (
    isOperationStyleTravelDepartment(
      department
    ) &&
    [
      "regional manager",
      "acting regional manager",
    ].includes(role)
  ) {
    const blockedPositions = [
      "assistant vice president",
      "vice president",
      "senior vice president",
      "president",
    ];

    return (
      Boolean(userRegion) &&
      norm(rowRegion) === norm(userRegion) &&
      rowDepartment === department &&
      !blockedPositions.includes(
        rowPosition
      )
    );
  }

  // ASSISTANT VICE PRESIDENT
  if (
    isOperationStyleTravelDepartment(
      department
    ) &&
    role === "assistant vice president"
  ) {
    const blockedPositions = [
      "vice president",
      "senior vice president",
      "president",
    ];

    return (
      Boolean(userDivision) &&
      norm(rowDivision) ===
        norm(userDivision) &&
      rowDepartment === department &&
      !blockedPositions.includes(
        rowPosition
      )
    );
  }

  // VICE PRESIDENT
  if (
    isOperationStyleTravelDepartment(
      department
    ) &&
    role === "vice president"
  ) {
    return (
      rowDepartment === department &&
      ![
        "senior vice president",
        "president",
      ].includes(rowPosition)
    );
  }

  // SENIOR VICE PRESIDENT
  if (
    isOperationStyleTravelDepartment(
      department
    ) &&
    role === "senior vice president"
  ) {
    return rowDepartment === department;
  }

  return false;
};

// =====================================================
// CALENDAR SUMMARY REPORT - TRAVEL PLAN DETAILS
// =====================================================

router.get(
  "/travel-plans/summary-report/:id/details",
  requireAuth,
  async (req, res) => {
    try {
      if (!canViewTravelModule(req)) {
        return res.status(403).json({
          message:
            "You are not allowed to view the Calendar Summary Report.",
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

      await markExpiredTravelPlansIncomplete(
        pool
      );

      const planResult = await pool.query(
        `
        SELECT
          tp.id,

          TO_CHAR(
            tp.plan_date,
            'YYYY-MM-DD'
          ) AS plan_date,

          tp.title,
          tp.employee_name,

          matched_staff.employee_no,

          COALESCE(
            NULLIF(
              TRIM(
                matched_staff.position
              ),
              ''
            ),
            tp.position
          ) AS position,

          matched_staff.department,

          matched_staff.id
            AS staff_id,

          matched_staff.branch_id
            AS staff_branch_id,

          tp.branch_name,

          COALESCE(
            NULLIF(
              TRIM(
                matched_branch.area
              ),
              ''
            ),
            NULLIF(
              TRIM(
                matched_staff.area
              ),
              ''
            )
          ) AS area,

          COALESCE(
            NULLIF(
              TRIM(
                matched_branch.region
              ),
              ''
            ),
            NULLIF(
              TRIM(
                matched_staff.region
              ),
              ''
            )
          ) AS region,

          COALESCE(
            NULLIF(
              TRIM(
                matched_branch.division
              ),
              ''
            ),
            NULLIF(
              TRIM(
                matched_staff.division
              ),
              ''
            )
          ) AS division,

          tp.description,
          tp.status,

          ${manilaTimestampSql(
            "tp.check_in_at"
          )} AS check_in_at,

          ${manilaTimestampSql(
            "tp.check_out_at"
          )} AS check_out_at,

          CASE
            WHEN
              tp.check_in_at IS NOT NULL
              AND tp.check_out_at IS NOT NULL
              AND tp.check_out_at >=
                  tp.check_in_at

            THEN EXTRACT(
              EPOCH FROM (
                tp.check_out_at
                -
                tp.check_in_at
              )
            )::BIGINT

            ELSE NULL
          END AS duration_seconds,

          CASE
            WHEN
              tp.check_in_at IS NOT NULL
              AND tp.check_out_at IS NOT NULL
              AND tp.check_out_at >=
                  tp.check_in_at

            THEN CONCAT(
              FLOOR(
                EXTRACT(
                  EPOCH FROM (
                    tp.check_out_at
                    -
                    tp.check_in_at
                  )
                ) / 3600
              ),
              ' hr ',
              FLOOR(
                MOD(
                  EXTRACT(
                    EPOCH FROM (
                      tp.check_out_at
                      -
                      tp.check_in_at
                    )
                  ),
                  3600
                ) / 60
              ),
              ' min'
            )

            ELSE 'Not complete'
          END AS duration_label

        FROM public.travel_plans tp

        LEFT JOIN LATERAL (
          SELECT
            s.id,
            s.employee_no,

            COALESCE(
              NULLIF(
                TRIM(s.fullname),
                ''
              ),

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

              s.employee_no
            ) AS employee_name,

            s.position,
            s.department,
            s.branch_id,

            COALESCE(
              NULLIF(
                TRIM(s.area),
                ''
              ),
              NULLIF(
                TRIM(sb.area),
                ''
              )
            ) AS area,

            COALESCE(
              NULLIF(
                TRIM(s.region),
                ''
              ),
              NULLIF(
                TRIM(sb.region),
                ''
              )
            ) AS region,

            COALESCE(
              NULLIF(
                TRIM(s.division),
                ''
              ),
              NULLIF(
                TRIM(sb.division),
                ''
              )
            ) AS division

          FROM public.staff s

          LEFT JOIN public.branches sb
            ON sb.id = s.branch_id

          WHERE LOWER(
            TRIM(
              COALESCE(
                NULLIF(
                  TRIM(s.fullname),
                  ''
                ),

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
                tp.employee_name,
                ''
              )
            )
          )

          ORDER BY
            CASE
              WHEN LOWER(
                TRIM(
                  COALESCE(
                    sb.name,
                    ''
                  )
                )
              ) = LOWER(
                TRIM(
                  COALESCE(
                    tp.branch_name,
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
            b.area,
            b.region,
            b.division

          FROM public.branches b

          WHERE LOWER(
            TRIM(
              COALESCE(
                b.name,
                ''
              )
            )
          ) = LOWER(
            TRIM(
              COALESCE(
                tp.branch_name,
                ''
              )
            )
          )

          ORDER BY b.id ASC

          LIMIT 1
        ) matched_branch
          ON TRUE

        WHERE tp.id = $1

        LIMIT 1
        `,
        [travelPlanId]
      );

      if (!planResult.rowCount) {
        return res.status(404).json({
          message:
            "Travel Plan not found.",
        });
      }

      const plan =
        planResult.rows[0];

      if (
        !canViewCalendarSummaryRow(
          req,
          plan
        )
      ) {
        return res.status(403).json({
          message:
            "You are not allowed to view this Travel Plan.",
        });
      }

      const notesResult = await pool.query(
        `
        SELECT
          id,
          travel_plan_id,
          note_type,
          title,
          finding_type,
          content,

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

          created_by,

          CASE
            WHEN created_at IS NULL THEN NULL
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

      const notes = notesResult.rows || [];

      const reviewNote =
        notes.find(
          (note) =>
            norm(note.note_type) === "review"
        ) || null;

      const findingNote =
        notes.find(
          (note) =>
            norm(note.note_type) === "findings"
        ) || null;

      let reviewPhotoSignedUrl = null;
      let findingPhotoSignedUrl = null;

      if (reviewNote?.review_photo_url) {
        try {
          reviewPhotoSignedUrl =
            await getSignedDownloadUrl(
              reviewNote.review_photo_url,
              3600
            );
        } catch (signError) {
          console.error(
            "Calendar Summary review photo signing error:",
            signError
          );
        }
      }

      if (findingNote?.finding_photo_url) {
        try {
          findingPhotoSignedUrl =
            await getSignedDownloadUrl(
              findingNote.finding_photo_url,
              3600
            );
        } catch (signError) {
          console.error(
            "Calendar Summary finding photo signing error:",
            signError
          );
        }
      }

      const review = reviewNote
        ? {
            id: reviewNote.id,
            title: reviewNote.title,

            review_coh:
              reviewNote.review_coh,

            review_cashbook_vs_voucher:
              reviewNote.review_cashbook_vs_voucher,

            review_lor:
              reviewNote.review_lor,

            review_los:
              reviewNote.review_los,

            review_ldf:
              reviewNote.review_ldf,

            review_dcs:
              reviewNote.review_dcs,

            review_bms:
              reviewNote.review_bms,

            review_other_findings:
              reviewNote.review_other_findings,

            content:
              reviewNote.content,

            involved_staff:
              reviewNote.involved_staff,

            due_date:
              reviewNote.due_date,

            photo_url:
              reviewPhotoSignedUrl,

            created_at:
              reviewNote.created_at,
          }
        : null;

      const findings = findingNote
        ? {
            id: findingNote.id,
            title: findingNote.title,

            passbook_reconciliation:
              findingNote.passbook_reconciliation,

            past_due_delinquent_report:
              findingNote.past_due_delinquent_report,

            group_collection_record:
              findingNote.group_collection_record,

            other_findings:
              findingNote.other_findings,

            content:
              findingNote.content,

            involved_staff:
              findingNote.involved_staff,

            due_date:
              findingNote.due_date,

            photo_url:
              findingPhotoSignedUrl,

            created_at:
              findingNote.created_at,
          }
        : null;

      return res.json({
        plan,
        review,
        findings,
        photos: [],
      });
    } catch (error) {
      return sendServerError(
        res,
        "GET /travel-plans/summary-report/:id/details",
        error
      );
    }
  }
);

// =====================================================
// CALENDAR SUMMARY REPORT
// =====================================================
//
// Provides:
// 1. Summary cards
// 2. Travel Details
// 3. Staff Summary
// 4. Branch Summary
// 5. Filter options
//
// IMPORTANT:
// This route must remain ABOVE:
//
// GET /travel-plans/:id
//
// =====================================================

router.get(
  "/travel-plans/summary-report",
  requireAuth,
  async (req, res) => {
    try {
      if (!canViewTravelModule(req)) {
        return res.status(403).json({
          message:
            "You are not allowed to view the Calendar Summary Report.",
        });
      }

      await markExpiredTravelPlansIncomplete(pool);

      // =================================================
      // REQUEST FILTERS
      // =================================================

      const dateFrom = toStr(req.query.dateFrom);
      const dateTo = toStr(req.query.dateTo);

      const filterDivision = toStr(req.query.division);
      const filterRegion = toStr(req.query.region);
      const filterArea = toStr(req.query.area);
      const filterBranch = toStr(req.query.branch);

      const filterDepartment = toStr(
        req.query.department
      );

      const filterPosition = toStr(
        req.query.position
      );

      const filterEmployee = toStr(
        req.query.employee
      );

      const filterStatus = toStr(
        req.query.status
      );

      const search = toStr(req.query.search);

      // =================================================
      // VALIDATE DATES
      // =================================================

      if (
        dateFrom &&
        !/^\d{4}-\d{2}-\d{2}$/.test(dateFrom)
      ) {
        return res.status(400).json({
          message:
            "dateFrom must be in YYYY-MM-DD format.",
        });
      }

      if (
        dateTo &&
        !/^\d{4}-\d{2}-\d{2}$/.test(dateTo)
      ) {
        return res.status(400).json({
          message:
            "dateTo must be in YYYY-MM-DD format.",
        });
      }

      if (
        dateFrom &&
        dateTo &&
        dateFrom > dateTo
      ) {
        return res.status(400).json({
          message:
            "Date From cannot be later than Date To.",
        });
      }

      // =================================================
      // USER SCOPE
      // =================================================

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

      const userBranchId = Number(
        req.user?.branch_id
      );

      // =================================================
      // QUERY PARAMETER HELPERS
      // =================================================

      const params = [];

      const addParam = (value) => {
        params.push(value);
        return `$${params.length}`;
      };

      const conditions = [];

      // =================================================
      // BASE QUERY
      // =================================================
      //
      // matched_staff:
      // Finds the actual staff record connected to
      // travel_plans.employee_name.
      //
      // matched_branch:
      // Finds the branch visited by branch_name.
      //
      // =================================================

      let sql = `
        WITH report_rows AS (
          SELECT
            tp.id,

            TO_CHAR(
              tp.plan_date,
              'YYYY-MM-DD'
            ) AS plan_date,

            tp.title,

            tp.employee_name,

            matched_staff.employee_no,

            COALESCE(
              NULLIF(
                TRIM(
                  matched_staff.position
                ),
                ''
              ),
              tp.position
            ) AS position,

            matched_staff.department,

            tp.branch_name,

            COALESCE(
              NULLIF(
                TRIM(
                  matched_branch.area
                ),
                ''
              ),
              NULLIF(
                TRIM(
                  matched_staff.area
                ),
                ''
              )
            ) AS area,

            COALESCE(
              NULLIF(
                TRIM(
                  matched_branch.region
                ),
                ''
              ),
              NULLIF(
                TRIM(
                  matched_staff.region
                ),
                ''
              )
            ) AS region,

            COALESCE(
              NULLIF(
                TRIM(
                  matched_branch.division
                ),
                ''
              ),
              NULLIF(
                TRIM(
                  matched_staff.division
                ),
                ''
              )
            ) AS division,

            matched_staff.id
              AS staff_id,

            matched_staff.branch_id
              AS staff_branch_id,

            matched_branch.id
              AS visited_branch_id,

            tp.description,

            tp.status,

            ${manilaTimestampSql(
              "tp.check_in_at"
            )} AS check_in_at,

            ${manilaTimestampSql(
              "tp.check_out_at"
            )} AS check_out_at,

            CASE
              WHEN
                tp.check_in_at IS NOT NULL
                AND tp.check_out_at IS NOT NULL
                AND tp.check_out_at >=
                    tp.check_in_at

              THEN EXTRACT(
                EPOCH FROM (
                  tp.check_out_at
                  -
                  tp.check_in_at
                )
              )::BIGINT

              ELSE NULL
            END AS duration_seconds,

            CASE
              WHEN
                tp.check_in_at IS NOT NULL
                AND tp.check_out_at IS NOT NULL
                AND tp.check_out_at >=
                    tp.check_in_at

              THEN CONCAT(
                FLOOR(
                  EXTRACT(
                    EPOCH FROM (
                      tp.check_out_at
                      -
                      tp.check_in_at
                    )
                  ) / 3600
                ),
                ' hr ',
                FLOOR(
                  MOD(
                    EXTRACT(
                      EPOCH FROM (
                        tp.check_out_at
                        -
                        tp.check_in_at
                      )
                    ),
                    3600
                  ) / 60
                ),
                ' min'
              )

              ELSE 'Not complete'
            END AS duration_label

          FROM public.travel_plans tp

          LEFT JOIN LATERAL (
            SELECT
              s.id,
              s.employee_no,

              COALESCE(
                NULLIF(
                  TRIM(s.fullname),
                  ''
                ),

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

                s.employee_no
              ) AS employee_name,

              s.position,
              s.department,

              s.branch_id,

              COALESCE(
                NULLIF(TRIM(s.area), ''),
                NULLIF(
                  TRIM(sb.area),
                  ''
                )
              ) AS area,

              COALESCE(
                NULLIF(TRIM(s.region), ''),
                NULLIF(
                  TRIM(sb.region),
                  ''
                )
              ) AS region,

              COALESCE(
                NULLIF(
                  TRIM(s.division),
                  ''
                ),
                NULLIF(
                  TRIM(sb.division),
                  ''
                )
              ) AS division

            FROM public.staff s

            LEFT JOIN public.branches sb
              ON sb.id = s.branch_id

            WHERE LOWER(
              TRIM(
                COALESCE(
                  NULLIF(
                    TRIM(s.fullname),
                    ''
                  ),

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
                  tp.employee_name,
                  ''
                )
              )
            )

            ORDER BY
              CASE
                WHEN LOWER(
                  TRIM(
                    COALESCE(
                      sb.name,
                      ''
                    )
                  )
                ) = LOWER(
                  TRIM(
                    COALESCE(
                      tp.branch_name,
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
              b.code,
              b.name,
              b.area,
              b.region,
              b.division

            FROM public.branches b

            WHERE LOWER(
              TRIM(
                COALESCE(
                  b.name,
                  ''
                )
              )
            ) = LOWER(
              TRIM(
                COALESCE(
                  tp.branch_name,
                  ''
                )
              )
            )

            ORDER BY b.id ASC

            LIMIT 1
          ) matched_branch
            ON TRUE
        )

        SELECT *
        FROM report_rows
        WHERE 1 = 1
      `;

      // =================================================
      // ACCOUNT SCOPE
      // =================================================

      // ADMIN / IT:
      // No additional restriction.
      if (isAdminOrIT(req)) {
        // All Travel Plans.
      }

      // OFFICE OF THE PRESIDENT:
      // Existing Travel Plan rule = all.
      else if (
        isOfficeOfPresidentDepartment(
          department
        )
      ) {
        // All Travel Plans.
      }

      // TREAD:
      // Existing Travel Plan rule = all.
      else if (
        department ===
          "tread department" &&
        TREAD_TRAVEL_PLAN_ROLES.includes(
          role
        )
      ) {
        // All Travel Plans.
      }

      // AUDIT BRANCH MANAGER:
      // Same assigned branch only.
      else if (
        isAuditDepartment(
          department
        ) &&
        [
          "branch manager",
          "acting branch manager",
        ].includes(role)
      ) {
        if (
          !Number.isInteger(
            userBranchId
          ) ||
          userBranchId <= 0
        ) {
          return res.json({
            summary: {
              staff_traveled: 0,
              total_travels: 0,
              branches_visited: 0,
              completed: 0,
              incomplete: 0,
            },
            travel_details: [],
            staff_summary: [],
            branch_summary: [],
            filters: {
              divisions: [],
              regions: [],
              areas: [],
              branches: [],
              departments: [],
              positions: [],
              employees: [],
            },
          });
        }

        const pBranch =
          addParam(userBranchId);

        const pDepartment =
          addParam(department);

        conditions.push(`
          staff_branch_id =
            ${pBranch}::int
        `);

        conditions.push(`
          LOWER(
            TRIM(
              COALESCE(
                department,
                ''
              )
            )
          ) =
          LOWER(TRIM(${pDepartment}))
        `);
      }

      // AREA MANAGER:
      // Same area + same department.
      else if (
        isOperationStyleTravelDepartment(
          department
        ) &&
        [
          "area manager",
          "acting area manager",
        ].includes(role)
      ) {
        if (!userArea) {
          return res.json({
            summary: {
              staff_traveled: 0,
              total_travels: 0,
              branches_visited: 0,
              completed: 0,
              incomplete: 0,
            },
            travel_details: [],
            staff_summary: [],
            branch_summary: [],
            filters: {
              divisions: [],
              regions: [],
              areas: [],
              branches: [],
              departments: [],
              positions: [],
              employees: [],
            },
          });
        }

        const pArea =
          addParam(userArea);

        const pDepartment =
          addParam(department);

        conditions.push(`
          LOWER(
            TRIM(
              COALESCE(area, '')
            )
          ) =
          LOWER(TRIM(${pArea}))
        `);

        conditions.push(`
          LOWER(
            TRIM(
              COALESCE(
                department,
                ''
              )
            )
          ) =
          LOWER(TRIM(${pDepartment}))
        `);

        conditions.push(`
          LOWER(
            TRIM(
              COALESCE(position, '')
            )
          ) NOT IN (
            'regional manager',
            'acting regional manager',
            'assistant vice president',
            'vice president',
            'senior vice president',
            'president'
          )
        `);
      }

      // REGIONAL MANAGER:
      // Same region + same department.
      else if (
        isOperationStyleTravelDepartment(
          department
        ) &&
        [
          "regional manager",
          "acting regional manager",
        ].includes(role)
      ) {
        if (!userRegion) {
          return res.json({
            summary: {
              staff_traveled: 0,
              total_travels: 0,
              branches_visited: 0,
              completed: 0,
              incomplete: 0,
            },
            travel_details: [],
            staff_summary: [],
            branch_summary: [],
            filters: {
              divisions: [],
              regions: [],
              areas: [],
              branches: [],
              departments: [],
              positions: [],
              employees: [],
            },
          });
        }

        const pRegion =
          addParam(userRegion);

        const pDepartment =
          addParam(department);

        conditions.push(`
          LOWER(
            TRIM(
              COALESCE(region, '')
            )
          ) =
          LOWER(TRIM(${pRegion}))
        `);

        conditions.push(`
          LOWER(
            TRIM(
              COALESCE(
                department,
                ''
              )
            )
          ) =
          LOWER(TRIM(${pDepartment}))
        `);

        conditions.push(`
          LOWER(
            TRIM(
              COALESCE(position, '')
            )
          ) NOT IN (
            'assistant vice president',
            'vice president',
            'senior vice president',
            'president'
          )
        `);
      }

      // ASSISTANT VICE PRESIDENT:
      // Same division + same department.
      else if (
        isOperationStyleTravelDepartment(
          department
        ) &&
        role ===
          "assistant vice president"
      ) {
        if (!userDivision) {
          return res.json({
            summary: {
              staff_traveled: 0,
              total_travels: 0,
              branches_visited: 0,
              completed: 0,
              incomplete: 0,
            },
            travel_details: [],
            staff_summary: [],
            branch_summary: [],
            filters: {
              divisions: [],
              regions: [],
              areas: [],
              branches: [],
              departments: [],
              positions: [],
              employees: [],
            },
          });
        }

        const pDivision =
          addParam(userDivision);

        const pDepartment =
          addParam(department);

        conditions.push(`
          LOWER(
            TRIM(
              COALESCE(
                division,
                ''
              )
            )
          ) =
          LOWER(TRIM(${pDivision}))
        `);

        conditions.push(`
          LOWER(
            TRIM(
              COALESCE(
                department,
                ''
              )
            )
          ) =
          LOWER(TRIM(${pDepartment}))
        `);

        conditions.push(`
          LOWER(
            TRIM(
              COALESCE(position, '')
            )
          ) NOT IN (
            'vice president',
            'senior vice president',
            'president'
          )
        `);
      }

      // VICE PRESIDENT:
      // Same department.
      else if (
        isOperationStyleTravelDepartment(
          department
        ) &&
        role === "vice president"
      ) {
        const pDepartment =
          addParam(department);

        conditions.push(`
          LOWER(
            TRIM(
              COALESCE(
                department,
                ''
              )
            )
          ) =
          LOWER(TRIM(${pDepartment}))
        `);

        conditions.push(`
          LOWER(
            TRIM(
              COALESCE(position, '')
            )
          ) NOT IN (
            'senior vice president',
            'president'
          )
        `);
      }

      // SENIOR VICE PRESIDENT:
      // All Travel Plans under same department.
      else if (
        isOperationStyleTravelDepartment(
          department
        ) &&
        role ===
          "senior vice president"
      ) {
        const pDepartment =
          addParam(department);

        conditions.push(`
          LOWER(
            TRIM(
              COALESCE(
                department,
                ''
              )
            )
          ) =
          LOWER(TRIM(${pDepartment}))
        `);
      }

      // NO ACCESS SCOPE
      else {
        return res.json({
          summary: {
            staff_traveled: 0,
            total_travels: 0,
            branches_visited: 0,
            completed: 0,
            incomplete: 0,
          },
          travel_details: [],
          staff_summary: [],
          branch_summary: [],
          filters: {
            divisions: [],
            regions: [],
            areas: [],
            branches: [],
            departments: [],
            positions: [],
            employees: [],
          },
        });
      }

      // =================================================
      // DATE FILTERS
      // =================================================

      if (dateFrom) {
        const p =
          addParam(dateFrom);

        conditions.push(`
          plan_date::date >= ${p}::date
        `);
      }

      if (dateTo) {
        const p =
          addParam(dateTo);

        conditions.push(`
          plan_date::date <= ${p}::date
        `);
      }

      // =================================================
      // USER SELECTED FILTERS
      // =================================================

      const hasRealValue = (value) =>
        value &&
        norm(value) !== "all";

      if (
        hasRealValue(
          filterDivision
        )
      ) {
        const p =
          addParam(filterDivision);

        conditions.push(`
          LOWER(
            TRIM(
              COALESCE(
                division,
                ''
              )
            )
          ) =
          LOWER(TRIM(${p}))
        `);
      }

      if (
        hasRealValue(
          filterRegion
        )
      ) {
        const p =
          addParam(filterRegion);

        conditions.push(`
          LOWER(
            TRIM(
              COALESCE(region, '')
            )
          ) =
          LOWER(TRIM(${p}))
        `);
      }

      if (
        hasRealValue(
          filterArea
        )
      ) {
        const p =
          addParam(filterArea);

        conditions.push(`
          LOWER(
            TRIM(
              COALESCE(area, '')
            )
          ) =
          LOWER(TRIM(${p}))
        `);
      }

      if (
        hasRealValue(
          filterBranch
        )
      ) {
        const p =
          addParam(filterBranch);

        conditions.push(`
          LOWER(
            TRIM(
              COALESCE(
                branch_name,
                ''
              )
            )
          ) =
          LOWER(TRIM(${p}))
        `);
      }

      if (
        hasRealValue(
          filterDepartment
        )
      ) {
        const p =
          addParam(
            filterDepartment
          );

        conditions.push(`
          LOWER(
            TRIM(
              COALESCE(
                department,
                ''
              )
            )
          ) =
          LOWER(TRIM(${p}))
        `);
      }

      if (
        hasRealValue(
          filterPosition
        )
      ) {
        const p =
          addParam(filterPosition);

        conditions.push(`
          LOWER(
            TRIM(
              COALESCE(
                position,
                ''
              )
            )
          ) =
          LOWER(TRIM(${p}))
        `);
      }

      if (
        hasRealValue(
          filterEmployee
        )
      ) {
        const p =
          addParam(filterEmployee);

        conditions.push(`
          (
            LOWER(
              TRIM(
                COALESCE(
                  employee_no,
                  ''
                )
              )
            ) =
              LOWER(TRIM(${p}))

            OR

            LOWER(
              TRIM(
                COALESCE(
                  employee_name,
                  ''
                )
              )
            ) =
              LOWER(TRIM(${p}))
          )
        `);
      }

      if (
        hasRealValue(
          filterStatus
        )
      ) {
        const p =
          addParam(filterStatus);

        conditions.push(`
          LOWER(
            TRIM(
              COALESCE(status, '')
            )
          ) =
          LOWER(TRIM(${p}))
        `);
      }

      // =================================================
      // SEARCH
      // =================================================

      if (search) {
        const p =
          addParam(`%${search}%`);

        conditions.push(`
          (
            employee_no
              ILIKE ${p}

            OR employee_name
              ILIKE ${p}

            OR position
              ILIKE ${p}

            OR department
              ILIKE ${p}

            OR branch_name
              ILIKE ${p}

            OR area
              ILIKE ${p}

            OR region
              ILIKE ${p}

            OR division
              ILIKE ${p}

            OR title
              ILIKE ${p}
          )
        `);
      }

      // =================================================
      // APPEND CONDITIONS
      // =================================================

      if (conditions.length > 0) {
        sql += `
          AND ${conditions.join(
            "\nAND "
          )}
        `;
      }

      sql += `
        ORDER BY
          plan_date DESC,
          id DESC
      `;

      const result =
        await pool.query(
          sql,
          params
        );

      const rows = result.rows;

      // =================================================
      // SUMMARY CARDS
      // =================================================

      const uniqueEmployees =
        new Set(
          rows
            .map((row) =>
              toStr(
                row.employee_no ||
                row.employee_name
              ).toLowerCase()
            )
            .filter(Boolean)
        );

      const uniqueBranches =
        new Set(
          rows
            .map((row) =>
              toStr(
                row.branch_name
              ).toLowerCase()
            )
            .filter(Boolean)
        );

      const completedCount =
        rows.filter(
          (row) =>
            norm(row.status) ===
            "completed"
        ).length;

      const incompleteCount =
        rows.filter(
          (row) =>
            norm(row.status) ===
            "incomplete"
        ).length;

      // =================================================
      // TRAVEL DETAILS
      // =================================================

      const travelDetails =
        rows.map((row) => ({
          id: row.id,

          date: row.plan_date,

          employee_no:
            row.employee_no,

          employee_name:
            row.employee_name,

          position:
            row.position,

          department:
            row.department,

          branch:
            row.branch_name,

          area: row.area,
          region: row.region,
          division: row.division,

          title: row.title,

          description:
            row.description,

          time_in:
            row.check_in_at,

          time_out:
            row.check_out_at,

          duration_seconds:
            row.duration_seconds,

          duration:
            row.duration_label,

          status:
            row.status,
        }));

      // =================================================
      // STAFF SUMMARY
      // =================================================

      const staffMap =
        new Map();

      for (const row of rows) {
        const key =
          toStr(
            row.employee_no ||
            row.employee_name
          ).toLowerCase();

        if (!key) continue;

        if (!staffMap.has(key)) {
          staffMap.set(key, {
            staff_id:
              row.staff_id,

            employee_no:
              row.employee_no,

            employee_name:
              row.employee_name,

            position:
              row.position,

            department:
              row.department,

            travelDates:
              new Set(),

            branchVisits: [],

            completed: 0,
            incomplete: 0,
          });
        }

        const item =
          staffMap.get(key);

        if (row.plan_date) {
          item.travelDates.add(
            row.plan_date
          );
        }

        if (row.branch_name) {
          item.branchVisits.push(
            row.branch_name
          );
        }

        if (
          norm(row.status) ===
          "completed"
        ) {
          item.completed++;
        }

        if (
          norm(row.status) ===
          "incomplete"
        ) {
          item.incomplete++;
        }
      }

      const staffSummary =
        Array.from(
          staffMap.values()
        ).map((item) => {
          const branchCounts =
            new Map();

          for (
            const branchName
            of item.branchVisits
          ) {
            const key =
              toStr(
                branchName
              ).toLowerCase();

            if (!key) continue;

            branchCounts.set(
              key,
              {
                name:
                  branchName,

                count:
                  (
                    branchCounts.get(
                      key
                    )?.count || 0
                  ) + 1,
              }
            );
          }

          const mostVisited =
            Array.from(
              branchCounts.values()
            ).sort(
              (a, b) =>
                b.count - a.count ||
                a.name.localeCompare(
                  b.name
                )
            )[0];

          return {
            staff_id:
              item.staff_id,

            employee_no:
              item.employee_no,

            employee_name:
              item.employee_name,

            position:
              item.position,

            department:
              item.department,

            travel_days:
              item.travelDates.size,

            branch_visits:
              item.branchVisits.length,

            completed:
              item.completed,

            incomplete:
              item.incomplete,

            most_visited_branch:
              mostVisited?.name ||
              "-",
          };
        });

      staffSummary.sort(
        (a, b) =>
          toStr(
            a.employee_name
          ).localeCompare(
            toStr(
              b.employee_name
            )
          )
      );

      // =================================================
      // BRANCH SUMMARY
      // =================================================

      const branchMap =
        new Map();

      for (const row of rows) {
        const key =
          toStr(
            row.branch_name
          ).toLowerCase();

        if (!key) continue;

        if (!branchMap.has(key)) {
          branchMap.set(key, {
            branch:
              row.branch_name,

            area:
              row.area,

            region:
              row.region,

            division:
              row.division,

            visits: 0,

            staff:
              new Set(),

            last_visit:
              null,
          });
        }

        const item =
          branchMap.get(key);

        item.visits++;

        const employeeKey =
          toStr(
            row.employee_no ||
            row.employee_name
          ).toLowerCase();

        if (employeeKey) {
          item.staff.add(
            employeeKey
          );
        }

        if (
          row.plan_date &&
          (
            !item.last_visit ||
            row.plan_date >
              item.last_visit
          )
        ) {
          item.last_visit =
            row.plan_date;
        }
      }

      const branchSummary =
        Array.from(
          branchMap.values()
        )
          .map((item) => ({
            branch:
              item.branch,

            area:
              item.area,

            region:
              item.region,

            division:
              item.division,

            visits:
              item.visits,

            unique_staff:
              item.staff.size,

            last_visit:
              item.last_visit,
          }))
          .sort(
            (a, b) =>
              b.visits - a.visits ||
              toStr(
                a.branch
              ).localeCompare(
                toStr(
                  b.branch
                )
              )
          );

      // =================================================
      // FILTER OPTIONS
      // =================================================

      const uniqueTextValues = (
        values
      ) =>
        [
          ...new Set(
            values
              .map(toStr)
              .filter(Boolean)
          ),
        ].sort((a, b) =>
          a.localeCompare(b)
        );

      const employees =
        Array.from(
          new Map(
            rows
              .filter(
                (row) =>
                  row.employee_name
              )
              .map((row) => [
                toStr(
                  row.employee_no ||
                  row.employee_name
                ).toLowerCase(),

                {
                  staff_id:
                    row.staff_id,

                  employee_no:
                    row.employee_no,

                  employee_name:
                    row.employee_name,

                  position:
                    row.position,

                  department:
                    row.department,
                },
              ])
          ).values()
        ).sort(
          (a, b) =>
            toStr(
              a.employee_name
            ).localeCompare(
              toStr(
                b.employee_name
              )
            )
        );

      // =================================================
      // RESPONSE
      // =================================================

      return res.json({
        summary: {
          staff_traveled:
            uniqueEmployees.size,

          total_travels:
            rows.length,

          branches_visited:
            uniqueBranches.size,

          completed:
            completedCount,

          incomplete:
            incompleteCount,
        },

        travel_details:
          travelDetails,

        staff_summary:
          staffSummary,

        branch_summary:
          branchSummary,

        filters: {
          divisions:
            uniqueTextValues(
              rows.map(
                (row) =>
                  row.division
              )
            ),

          regions:
            uniqueTextValues(
              rows.map(
                (row) =>
                  row.region
              )
            ),

          areas:
            uniqueTextValues(
              rows.map(
                (row) =>
                  row.area
              )
            ),

          branches:
            uniqueTextValues(
              rows.map(
                (row) =>
                  row.branch_name
              )
            ),

          departments:
            uniqueTextValues(
              rows.map(
                (row) =>
                  row.department
              )
            ),

          positions:
            uniqueTextValues(
              rows.map(
                (row) =>
                  row.position
              )
            ),

          employees,
        },
      });
    } catch (error) {
      return sendServerError(
        res,
        "GET /travel-plans/summary-report",
        error
      );
    }
  }
);

module.exports = router;