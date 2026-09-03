const express = require("express");
const router = express.Router();

const pool = require("../db");
const { requireAuth } = require("../middlewares/authMiddleware");

const { toStr, norm, normalizeDepartment, normalizeRole,
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