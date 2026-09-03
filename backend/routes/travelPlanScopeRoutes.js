const express = require("express");
const router = express.Router();

const pool = require("../db");

const { requireAuth } =
  require("../middlewares/authMiddleware");

const {
  toStr,
  normalizeDepartment,
  normalizeRole,

  TREAD_TRAVEL_PLAN_ROLES,

  isAuditDepartment,
  isOfficeOfPresidentDepartment,
  isOperationStyleTravelDepartment,

  isAdminOrIT,
  canViewTravelModule,

  sendServerError,
} = require("../utils/travelPlanHelpers");

// =====================================================
// GET ALL STAFF FOR TRAVEL PLAN DROPDOWNS
// =====================================================
//
// Used by:
// 1. Create Travel Plan - Employee
// 2. Review - Involved
// 3. Findings - Involved
//
// This is separate from /travel-plans/staff-scope.
// The Staff Scope dashboard keeps its original manager rules.
// =====================================================

router.get(
  "/travel-plans/staff-dropdown",
  requireAuth,
  async (req, res) => {
    try {
      if (!canViewTravelModule(req)) {
        return res.status(403).json({
          message:
            "You are not allowed to view travel plan staff.",
        });
      }

      const role = normalizeRole(req.user?.role);

      const department = normalizeDepartment(
        req.user?.department
      );

      const userArea = toStr(req.user?.area);
      const userRegion = toStr(req.user?.region);
      const userDivision = toStr(req.user?.division);
      const userBranchId = Number(req.user?.branch_id);

      const baseSelect = `
        SELECT
          s.id,
          s.employee_no,

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
            s.employee_no
          ) AS employee_name,

          s.position,

          b.name AS branch_name,
          b.code AS branch_code,

          COALESCE(
            NULLIF(TRIM(s.area), ''),
            NULLIF(TRIM(b.area), '')
          ) AS area,

          COALESCE(
            NULLIF(TRIM(s.region), ''),
            NULLIF(TRIM(b.region), '')
          ) AS region,

          COALESCE(
            NULLIF(TRIM(s.division), ''),
            NULLIF(TRIM(b.division), '')
          ) AS division,

          s.department

        FROM public.staff s

        LEFT JOIN public.branches b
          ON b.id = s.branch_id

        WHERE LOWER(
          TRIM(
            COALESCE(s.status, 'active')
          )
        ) = 'active'

        AND LOWER(
          TRIM(
            COALESCE(s.position, '')
          )
        ) NOT IN (
          'vice president',
          'acting vice president',
          'senior vice president',
          'acting senior vice president',
          'president'
        )

          AND s.employee_no IS NOT NULL

          AND TRIM(s.employee_no) <> ''
      `;

      let sql = "";
      let params = [];

      // ADMIN AND IT:
      // Show every active staff member.
      if (isAdminOrIT(req)) {
        sql = `
          ${baseSelect}

          ORDER BY
            s.department ASC NULLS LAST,
            b.name ASC NULLS LAST,
            employee_name ASC
        `;
      }

      // TREAD:
      // Show every active staff member.
      else if (
        department === "tread department" &&
        TREAD_TRAVEL_PLAN_ROLES.includes(role)
      ) {
        sql = `
          ${baseSelect}

          ORDER BY
            s.department ASC NULLS LAST,
            b.name ASC NULLS LAST,
            employee_name ASC
        `;
      }

      // OFFICE OF THE PRESIDENT
      // Show every active staff member.
      else if (
        isOfficeOfPresidentDepartment(department)
      ) {
        sql = `
          ${baseSelect}

          ORDER BY
            s.department ASC NULLS LAST,
            b.name ASC NULLS LAST,
            employee_name ASC
        `;
      }

      // AREA MANAGER:
      // AUDIT BRANCH MANAGER:
      // Show active Audit Department staff from the same branch.
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
          ${baseSelect}

          AND s.branch_id = $1

          AND LOWER(
            TRIM(
              COALESCE(s.department, '')
            )
          ) = LOWER(TRIM($2))

          ORDER BY
            employee_name ASC
        `;

        params = [userBranchId, department];
      }

      // =================================================
      // AREA MANAGER / ACTING AREA MANAGER
      // =================================================
      //
      // Employee dropdown:
      // Show only Area Manager through Senior Vice President.
      // Exclude Branch Manager, Loan Officer, and all lower staff.
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
          ${baseSelect}

          AND LOWER(
            TRIM(
              COALESCE(
                NULLIF(TRIM(s.area), ''),
                NULLIF(TRIM(b.area), ''),
                ''
              )
            )
          ) = LOWER(TRIM($1))

          AND LOWER(
            TRIM(
              COALESCE(s.department, '')
            )
          ) = LOWER(TRIM($2))

          AND LOWER(
            TRIM(
              COALESCE(s.position, '')
            )
          ) IN (
            'area manager',
            'acting area manager',
            'regional manager',
            'acting regional manager',
            'assistant vice president',
            'vice president',
            'senior vice president'
          )

          ORDER BY
            CASE LOWER(
              TRIM(
                COALESCE(s.position, '')
              )
            )
              WHEN 'area manager' THEN 1
              WHEN 'acting area manager' THEN 2
              WHEN 'regional manager' THEN 3
              WHEN 'acting regional manager' THEN 4
              WHEN 'assistant vice president' THEN 5
              WHEN 'vice president' THEN 6
              WHEN 'senior vice president' THEN 7
              ELSE 99
            END,

            employee_name ASC
        `;

        params = [
          userArea,
          department,
        ];
      }

      // REGIONAL MANAGER:
      // Show every active staff member within the same region.
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
          ${baseSelect}

          AND LOWER(
            TRIM(
              COALESCE(
                NULLIF(TRIM(s.region), ''),
                NULLIF(TRIM(b.region), ''),
                ''
              )
            )
          ) = LOWER(TRIM($1))

          AND LOWER(
            TRIM(
              COALESCE(s.department, '')
            )
          ) = LOWER(TRIM($2))

          ORDER BY
            area ASC NULLS LAST,
            b.name ASC NULLS LAST,
            employee_name ASC
        `;

        params = [userRegion, department];
      }

      // ASSISTANT VICE PRESIDENT:
      // Show every active staff member within the same division.
      else if (
        isOperationStyleTravelDepartment(department) &&
        role === "assistant vice president"
      ) {
        if (!userDivision) {
          return res.json([]);
        }

        sql = `
          ${baseSelect}

          AND LOWER(
            TRIM(
              COALESCE(
                NULLIF(TRIM(s.division), ''),
                NULLIF(TRIM(b.division), ''),
                ''
              )
            )
          ) = LOWER(TRIM($1))

          AND LOWER(
            TRIM(
              COALESCE(s.department, '')
            )
          ) = LOWER(TRIM($2))

          ORDER BY
            region ASC NULLS LAST,
            area ASC NULLS LAST,
            b.name ASC NULLS LAST,
            employee_name ASC
        `;

        params = [userDivision, department];
      }

      // VP AND SVP:
      // Show every active Operation Department staff member.
      else if (
        isOperationStyleTravelDepartment(department) &&
        [
          "vice president",
          "senior vice president",
        ].includes(role)
      ) {
        sql = `
          ${baseSelect}

          AND LOWER(
            TRIM(
              COALESCE(s.department, '')
            )
          ) = LOWER(TRIM($1))

          ORDER BY
            division ASC NULLS LAST,
            region ASC NULLS LAST,
            area ASC NULLS LAST,
            b.name ASC NULLS LAST,
            employee_name ASC
        `;

        params = [department];
      }

      // No matching access.
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
        "GET /travel-plans/staff-dropdown",
        error
      );
    }
  }
);

// =====================================================
// GET ALL ACTIVE STAFF FOR REVIEW AND FINDINGS
// =====================================================
//
// This route is separate from:
// /travel-plans/staff-dropdown
//
// It is used only for the Review and Findings
// involved-staff selector.
// =====================================================

router.get(
  "/travel-plans/involved-staff-dropdown",
  requireAuth,
  async (req, res) => {
    try {
      if (!canViewTravelModule(req)) {
        return res.status(403).json({
          message:
            "You are not allowed to view involved staff.",
        });
      }

      const result = await pool.query(
        `
        SELECT
          s.id,
          s.employee_no,

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
            s.employee_no
          ) AS employee_name,

          s.position,
          s.status,

          s.branch_id,
          b.name AS branch_name,
          b.code AS branch_code,

          COALESCE(
            NULLIF(TRIM(s.area), ''),
            NULLIF(TRIM(b.area), '')
          ) AS area,

          COALESCE(
            NULLIF(TRIM(s.region), ''),
            NULLIF(TRIM(b.region), '')
          ) AS region,

          COALESCE(
            NULLIF(TRIM(s.division), ''),
            NULLIF(TRIM(b.division), '')
          ) AS division,

          s.department

        FROM public.staff s

        LEFT JOIN public.branches b
          ON b.id = s.branch_id

        WHERE
            s.employee_no IS NOT NULL

        AND TRIM(s.employee_no) <> ''

        ORDER BY
          s.department ASC NULLS LAST,
          b.name ASC NULLS LAST,
          employee_name ASC
        `
      );

      return res.json(result.rows);
    } catch (error) {
      return sendServerError(
        res,
        "GET /travel-plans/involved-staff-dropdown",
        error
      );
    }
  }
);

// =====================================================
// GET STAFF SCOPE
// =====================================================

router.get(
  "/travel-plans/staff-scope",
  requireAuth,
  async (req, res) => {
    try {
      if (!canViewTravelModule(req)) {
        return res.status(403).json({
          message:
            "You are not allowed to view the travel plan staff scope.",
        });
      }

            const selectedDate = toStr(req.query.date);

            const targetDate =
              /^\d{4}-\d{2}-\d{2}$/.test(selectedDate)
                ? selectedDate
                : new Intl.DateTimeFormat("en-CA", {
                    timeZone: "Asia/Manila",
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                  }).format(new Date());

      const role = normalizeRole(req.user?.role);
      const department = normalizeDepartment(
        req.user?.department
      );

      const userArea = toStr(req.user?.area);
      const userRegion = toStr(req.user?.region);
      const userDivision = toStr(req.user?.division);
      const userBranchId = Number(req.user?.branch_id);

      const baseSelect = `
        SELECT
          s.id,
          s.employee_no,

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
            s.employee_no
          ) AS employee_name,

          s.position,
          b.name AS branch_name,
          b.code AS branch_code,
          s.area,
          s.region,
          s.division,
          s.department,

          active_leave.leave_type,
          active_leave.start_date AS leave_start_date,
          active_leave.end_date AS leave_end_date,

          CASE

            WHEN active_leave.leave_type = 'Indefinite Leave'
            THEN 'Indefinite Leave'

            WHEN active_leave.id IS NOT NULL
            THEN 'On Leave'

            WHEN EXISTS (
              SELECT 1
              FROM public.travel_plans tp
              WHERE tp.plan_date = $1::date
                AND (
                  tp.employee_name = s.fullname
                  OR LOWER(TRIM(COALESCE(tp.employee_name,''))) =
                    LOWER(
                      TRIM(
                        CONCAT_WS(
                          ' ',
                          s.last_name,
                          s.first_name,
                          s.middle_name
                        )
                      )
                    )
                )
            )
            THEN 'Submitted'

            WHEN $1::date < (
                NOW() AT TIME ZONE 'Asia/Manila'
              )::date
            THEN 'Incomplete'

            ELSE 'Pending'

          END AS travel_status

        FROM public.staff s

        LEFT JOIN public.branches b
          ON b.id = s.branch_id

        /*
          Finds an approved leave that applies to the selected date.
        */
        LEFT JOIN LATERAL (
          SELECT
            lr.id,
            lr.leave_type,
            lr.start_date,
            lr.end_date,
            lr.date_created,
            lr.status

          FROM public.leave_requests lr

          WHERE lr.employee_id = s.id

            AND LOWER(TRIM(COALESCE(lr.status, ''))) = 'approved'

            AND (
              /*
                Normal leave:
                selected date must be within start and end date.
              */
              (
                LOWER(TRIM(COALESCE(lr.leave_type, '')))
                  <> 'indefinite leave'

                AND lr.start_date IS NOT NULL
                AND lr.end_date IS NOT NULL

                AND $1::date BETWEEN
                  lr.start_date::date
                  AND lr.end_date::date
              )

              OR

              /*
                Indefinite leave:
                starts from date_created and remains active
                until its status is changed to Returned to Work.
              */
              (
                LOWER(TRIM(COALESCE(lr.leave_type, '')))
                  = 'indefinite leave'

                AND $1::date >= COALESCE(
                  lr.start_date::date,
                  lr.date_created::date,
                  lr.entry_date::date
                )
              )
            )

          ORDER BY
            CASE
              WHEN LOWER(TRIM(COALESCE(lr.leave_type, '')))
                = 'indefinite leave'
              THEN 0
              ELSE 1
            END,
            lr.id DESC

          LIMIT 1
        ) active_leave ON TRUE

                WHERE (
                  /*
                    Normal active staff.
                  */
                  LOWER(TRIM(COALESCE(s.status, 'active'))) = 'active'

                  OR

                  /*
                    Include inactive staff when they are currently
                    on approved Indefinite Leave.
                  */
                  active_leave.leave_type = 'Indefinite Leave'
                )

                /*
                  VP, SVP, and President are monitoring roles.
                  They must not appear as employees required
                  to submit travel plans.
                */
                AND LOWER(
                  TRIM(
                    COALESCE(s.position, '')
                  )
                ) NOT IN (
                  'vice president',
                  'acting vice president',
                  'senior vice president',
                  'acting senior vice president',
                  'president'
                )
              `;

      let sql = "";
      let params = [targetDate];

      // =================================================
      // ADMIN AND IT
      // =================================================
      //
      // Admin and IT can view all Operation Department
      // managers from Area Manager through SVP.
      // =================================================

      if (isAdminOrIT(req)) {
        sql = `
          ${baseSelect}

          ORDER BY
            LOWER(
              TRIM(
                COALESCE(s.department, '')
              )
            ) ASC,

            CASE LOWER(
              TRIM(
                COALESCE(s.position, '')
              )
            )
              WHEN 'president' THEN 1
              WHEN 'senior vice president' THEN 2
              WHEN 'acting senior vice president' THEN 3
              WHEN 'vice president' THEN 4
              WHEN 'acting vice president' THEN 5
              WHEN 'assistant vice president' THEN 6
              WHEN 'regional manager' THEN 7
              WHEN 'acting regional manager' THEN 8
              WHEN 'area manager' THEN 9
              WHEN 'acting area manager' THEN 10
              WHEN 'branch manager' THEN 11
              WHEN 'acting branch manager' THEN 12
              WHEN 'loan officer' THEN 13
              ELSE 99
            END,

            employee_name ASC
        `;

        params = [targetDate];
      }

      // =================================================
      // TREAD DEPARTMENT
      // =================================================
      //
      // TREAD Branch Manager through SVP can view all
      // Operation managers from Area Manager through SVP.
      // =================================================

      else if (
        department === "tread department" &&
        TREAD_TRAVEL_PLAN_ROLES.includes(role)
      ) {
        sql = `
          ${baseSelect}

          AND LOWER(
            TRIM(
              COALESCE(s.department, '')
            )
          ) = 'operation department'

          AND LOWER(
            TRIM(
              COALESCE(s.position, '')
            )
          ) IN (
            'area manager',
            'acting area manager',
            'regional manager',
            'acting regional manager',
            'assistant vice president',
            'vice president',
            'senior vice president'
          )

          ORDER BY
            CASE LOWER(
              TRIM(
                COALESCE(s.position, '')
              )
            )
              WHEN 'senior vice president' THEN 1
              WHEN 'vice president' THEN 2
              WHEN 'assistant vice president' THEN 3
              WHEN 'regional manager' THEN 4
              WHEN 'acting regional manager' THEN 5
              WHEN 'area manager' THEN 6
              WHEN 'acting area manager' THEN 7
              ELSE 99
            END,

            s.fullname ASC
        `;
      }

      // =================================================
      // OFFICE OF THE PRESIDENT
      // =================================================

      else if (
        isOfficeOfPresidentDepartment(department)
      ) {
        sql = `
          ${baseSelect}

          ORDER BY
            employee_name ASC
        `;
      }

      // AREA MANAGER / ACTING AREA MANAGER
      // =================================================
      // AUDIT BRANCH MANAGER / ACTING BRANCH MANAGER
      // =================================================
      // Shows active Audit Department staff from the
      // logged-in manager's branch.
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
          ${baseSelect}

          AND s.branch_id = $2

          AND LOWER(
            TRIM(
              COALESCE(s.department, '')
            )
          ) = LOWER(TRIM($3))

          ORDER BY
            s.fullname ASC
        `;

        params = [
          targetDate,
          userBranchId,
          department,
        ];
      }

      // =================================================
      // AREA MANAGER / ACTING AREA MANAGER
      // =================================================
      //
      // Show only Area Manager or Acting Area Manager
      // assigned to the same area.
      // Branch Managers, Loan Officers, and other staff
      // are excluded.
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
          ${baseSelect}

          AND LOWER(
            TRIM(
              COALESCE(
                NULLIF(TRIM(s.area), ''),
                NULLIF(TRIM(b.area), ''),
                ''
              )
            )
          ) = LOWER(TRIM($2))

          AND LOWER(
            TRIM(
              COALESCE(s.department, '')
            )
          ) = LOWER(TRIM($3))

          AND LOWER(
            TRIM(
              COALESCE(s.position, '')
            )
          ) IN (
            'area manager',
            'acting area manager'
          )

          ORDER BY
            CASE LOWER(
              TRIM(
                COALESCE(s.position, '')
              )
            )
              WHEN 'area manager' THEN 1
              WHEN 'acting area manager' THEN 2
              ELSE 99
            END,

            s.fullname ASC
        `;

        params = [
          targetDate,
          userArea,
          department,
        ];
      }

      // =================================================
      // REGIONAL MANAGER / ACTING REGIONAL MANAGER
      // =================================================
      //
      // Shows Area Managers and Acting Area Managers
      // under the same region.
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
          ${baseSelect}

          AND LOWER(
            TRIM(
              COALESCE(
                NULLIF(TRIM(s.region), ''),
                NULLIF(TRIM(b.region), ''),
                ''
              )
            )
          ) = LOWER(TRIM($2))

          AND LOWER(
            TRIM(
              COALESCE(s.position, '')
            )
          ) IN (
            'regional manager',
            'acting regional manager',
            'area manager',
            'acting area manager'
          )

          AND LOWER(
            TRIM(
              COALESCE(s.department, '')
            )
          ) = LOWER(TRIM($3))

          ORDER BY
            CASE LOWER(
              TRIM(
                COALESCE(s.position, '')
              )
            )
              WHEN 'regional manager' THEN 1
              WHEN 'acting regional manager' THEN 2
              WHEN 'area manager' THEN 3
              WHEN 'acting area manager' THEN 4
              ELSE 99
            END,

            COALESCE(
              NULLIF(TRIM(s.area), ''),
              NULLIF(TRIM(b.area), '')
            ) ASC NULLS LAST,

            s.fullname ASC
        `;

        params = [
          targetDate,
          userRegion,
          department,
        ];
      }

      // =================================================
      // ASSISTANT VICE PRESIDENT
      // =================================================
      //
      // Shows Regional Managers and Area Managers
      // under the same division.
      // =================================================

      else if (
        isOperationStyleTravelDepartment(department) &&
        role === "assistant vice president"
      ) {
        if (!userDivision) {
          return res.json([]);
        }

        sql = `
          ${baseSelect}

          AND LOWER(
            TRIM(
              COALESCE(
                NULLIF(TRIM(s.division), ''),
                NULLIF(TRIM(b.division), ''),
                ''
              )
            )
          ) = LOWER(TRIM($2))

          AND LOWER(
            TRIM(
              COALESCE(s.position, '')
            )
          ) IN (
            'assistant vice president',
            'regional manager',
            'acting regional manager',
            'area manager',
            'acting area manager'
          )
          AND LOWER(
            TRIM(
              COALESCE(s.department, '')
            )
          ) = LOWER(TRIM($3))

          ORDER BY
            CASE LOWER(
              TRIM(
                COALESCE(s.position, '')
              )
            )
              WHEN 'assistant vice president' THEN 1
              WHEN 'regional manager' THEN 2
              WHEN 'acting regional manager' THEN 3
              WHEN 'area manager' THEN 4
              WHEN 'acting area manager' THEN 5
            END,

            COALESCE(
              NULLIF(TRIM(s.region), ''),
              NULLIF(TRIM(b.region), '')
            ) ASC NULLS LAST,

            s.fullname ASC
        `;

        params = [targetDate, userDivision, department];
      }

      // =================================================
      // VICE PRESIDENT
      // =================================================
      //
      // Shows AVP, Regional Managers, and Area Managers
      // from the Operation Department.
      // =================================================

      else if (
        isOperationStyleTravelDepartment(department) &&
        role === "vice president"
      ) {
        sql = `
          ${baseSelect}

          AND LOWER(
            TRIM(
              COALESCE(s.department, '')
            )
          ) = LOWER(TRIM($2))

          AND LOWER(
            TRIM(
              COALESCE(s.position, '')
            )
          ) IN (
            'assistant vice president',
            'regional manager',
            'acting regional manager',
            'area manager',
            'acting area manager'
          )

          ORDER BY
            CASE LOWER(
              TRIM(
                COALESCE(s.position, '')
              )
            )
              WHEN 'assistant vice president' THEN 1
              WHEN 'regional manager' THEN 2
              WHEN 'acting regional manager' THEN 3
              WHEN 'area manager' THEN 4
              WHEN 'acting area manager' THEN 5
              ELSE 99
            END,

            s.fullname ASC
        `;
        params = [targetDate, department];
      }

      // =================================================
      // SENIOR VICE PRESIDENT
      // =================================================
      //
      // Shows VP, AVP, Regional Managers, and
      // Area Managers from the Operation Department.
      // =================================================

      else if (
        isOperationStyleTravelDepartment(department) &&
        role === "senior vice president"
      ) {
        sql = `
          ${baseSelect}

          AND LOWER(
            TRIM(
              COALESCE(s.department, '')
            )
          ) = LOWER(TRIM($2))

          AND LOWER(
            TRIM(
              COALESCE(s.position, '')
            )
          ) IN (
            'assistant vice president',
            'regional manager',
            'acting regional manager',
            'area manager',
            'acting area manager'
          )

          ORDER BY
            CASE LOWER(
              TRIM(
                COALESCE(s.position, '')
              )
            )
              WHEN 'assistant vice president' THEN 1
              WHEN 'regional manager' THEN 2
              WHEN 'acting regional manager' THEN 3
              WHEN 'area manager' THEN 4
              WHEN 'acting area manager' THEN 5
              ELSE 99
            END,

            s.fullname ASC
        `;

        params = [targetDate, department];
      }

      // =================================================
      // NO MATCHING SCOPE
      // =================================================

      else {
        return res.json([]);
      }

      const result = await pool.query(sql, params);

      return res.json(result.rows);
    } catch (error) {
      return sendServerError(
        res,
        "GET /travel-plans/staff-scope",
        error
      );
    }
  }
);

// =====================================================
// GET BRANCH SCOPE
// =====================================================

router.get(
  "/travel-plans/branch-scope",
  requireAuth,
  async (req, res) => {
    try {
      if (!canViewTravelModule(req)) {
        return res.status(403).json({
          message:
            "You are not allowed to view the travel plan branch scope.",
        });
      }

      const role = normalizeRole(req.user?.role);
      const department = normalizeDepartment(
        req.user?.department
      );

      const userArea = toStr(req.user?.area);
      const userRegion = toStr(req.user?.region);
      const userDivision = toStr(req.user?.division);
      const userBranchId = Number(req.user?.branch_id);

      const baseSelect = `
        SELECT DISTINCT
          b.id,
          b.code AS branch_code,
          b.name AS branch_name,
          b.area,
          b.region,
          b.division

        FROM public.branches b

        WHERE COALESCE(
          LOWER(
            TRIM(
              b.name
            )
          ),
          ''
        ) <> ''
      `;

      let sql = "";
      let params = [];

      sql = `
        ${baseSelect}

        ORDER BY
          b.region ASC NULLS LAST,
          b.area ASC NULLS LAST,
          b.name ASC
      `;

      params = [];

      const result = await pool.query(sql, params);

      return res.json(result.rows);
    } catch (error) {
      return sendServerError(
        res,
        "GET /travel-plans/branch-scope",
        error
      );
    }
  }
);

module.exports = router;