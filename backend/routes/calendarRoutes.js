console.log("LOADED calendarRoutes.js");

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

// =====================================================
// BASIC HELPERS
// =====================================================

const toStr = (value) => String(value ?? "").trim();

const norm = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase();

const normalizeDepartment = (value) =>
  norm(value).replace(/\s+/g, " ");

const normalizeRole = (value) =>
  norm(value).replace(/\s+/g, " ");

const toNullableNumber = (value) => {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
};

const isValidId = (value) => {
  const id = Number(value);

  return Number.isInteger(id) && id > 0;
};

const calculateInclusiveDays = (dateFrom, dateTo) => {
  if (!dateFrom || !dateTo) {
    return null;
  }

  const from = new Date(`${dateFrom}T00:00:00`);
  const to = new Date(`${dateTo}T00:00:00`);

  if (
    Number.isNaN(from.getTime()) ||
    Number.isNaN(to.getTime()) ||
    to < from
  ) {
    return null;
  }

  const millisecondsPerDay = 1000 * 60 * 60 * 24;

  return Math.floor((to - from) / millisecondsPerDay) + 1;
};

// =====================================================
// TRAVEL PLAN COMPLIANCE HELPERS
// =====================================================

const normalizeName = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ");

const buildUserNameCandidates = (user) => {
  const firstName = toStr(user?.first_name);
  const middleName = toStr(user?.middle_name);
  const lastName = toStr(user?.last_name);

  const candidates = [
    toStr(user?.fullname),
    toStr(user?.full_name),
    [firstName, middleName, lastName]
      .filter(Boolean)
      .join(" "),
    [lastName, firstName, middleName]
      .filter(Boolean)
      .join(" "),
    lastName && firstName
      ? `${lastName}, ${firstName}${
          middleName ? ` ${middleName}` : ""
        }`
      : "",
  ];

  return [
    ...new Set(
      candidates
        .map(normalizeName)
        .filter(Boolean)
    ),
  ];
};

const resolveLoggedInStaff = async (client, req) => {
  const userCandidates = buildUserNameCandidates(
    req.user || {}
  );

  if (userCandidates.length === 0) {
    return null;
  }

  const result = await client.query(
    `
    SELECT
      s.id,
      s.employee_no,
      s.first_name,
      s.middle_name,
      s.last_name,

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
      s.department,
      s.branch_id,
      s.area,
      s.region,
      s.division,

      b.name AS branch_name

    FROM public.staff s

    LEFT JOIN public.branches b
      ON b.id = s.branch_id

    WHERE LOWER(
      TRIM(
        COALESCE(s.status, 'active')
      )
    ) IN (
      'active',
      'inactive'
    )

    ORDER BY
      CASE
        WHEN s.branch_id = $1 THEN 0
        ELSE 1
      END,

      s.id ASC
    `,
    [
      Number(req.user?.branch_id) || null,
    ]
  );

  return (
    result.rows.find((staff) => {
      const staffCandidates = [
        staff.employee_name,

        [
          staff.first_name,
          staff.middle_name,
          staff.last_name,
        ]
          .filter(Boolean)
          .join(" "),
      ]
        .map(normalizeName)
        .filter(Boolean);

      return staffCandidates.some((staffName) =>
        userCandidates.includes(staffName)
      );
    }) || null
  );
};

const findInvolvedStaff = async (
  client,
  involvedStaffText,
  involvedStaffIds = []
) => {
  const validIds = Array.isArray(involvedStaffIds)
    ? involvedStaffIds
        .map(Number)
        .filter(
          (id) =>
            Number.isInteger(id) &&
            id > 0
        )
    : [];

  const result = await client.query(
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
      s.department,

      s.branch_id,
      b.name AS branch_name,

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
      ) AS division

    FROM public.staff s

    LEFT JOIN public.branches b
      ON b.id = s.branch_id

    ORDER BY s.id ASC
    `
  );

  if (validIds.length > 0) {
    return result.rows.filter((staff) =>
      validIds.includes(Number(staff.id))
    );
  }

  const normalizedInvolvedText =
    normalizeName(involvedStaffText);

  if (!normalizedInvolvedText) {
    return [];
  }

  /*
    The existing frontend sends names as one text value.
    Some names contain commas, so we do not split by comma.
    Instead, we check whether the full employee name appears
    inside the complete involved-staff text.
  */
  return result.rows.filter((staff) => {
    const normalizedEmployeeName =
      normalizeName(staff.employee_name);

    return (
      normalizedEmployeeName &&
      normalizedInvolvedText.includes(
        normalizedEmployeeName
      )
    );
  });
};

async function syncFindingCompliances(
  client,
  {
    travelPlanId,
    findingNoteId,
    findingTitle,
    findingDetails,
    involvedStaffText,
    involvedStaffIds,
    dueDate,
    createdBy,
  }
) {
  let assignedCount = 0;

  const matchedStaff =
    await findInvolvedStaff(
      client,
      involvedStaffText,
      involvedStaffIds
    );

  await client.query(
    `
    DELETE FROM public.travel_plan_compliances
    WHERE finding_note_id = $1
      AND status = 'Pending'
    `,
    [findingNoteId]
  );

  for (const staff of matchedStaff) {
    await client.query(
      `
      INSERT INTO public.travel_plan_compliances
      (
        travel_plan_id,
        finding_note_id,

        employee_id,
        employee_no,
        employee_name,
        position,

        branch_id,
        branch_name,

        department,
        area,
        region,
        division,

        finding_title,
        finding_details,

        due_date,

        status,

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

        $15::date,

        'Pending',

        $16,

        NOW() AT TIME ZONE 'Asia/Manila'
      )
      `,
      [
        travelPlanId,
        findingNoteId,

        staff.id,
        staff.employee_no,
        staff.employee_name,
        staff.position,

        staff.branch_id,
        staff.branch_name,

        staff.department,
        staff.area,
        staff.region,
        staff.division,

        findingTitle,

        findingDetails,

        dueDate || null,

        createdBy,
      ]
    );

    assignedCount++;
  }

  return assignedCount;
}

// =====================================================
// ROLE HELPERS
// =====================================================

const OPERATION_TRAVEL_PLAN_ROLES = [
  "area manager",
  "acting area manager",
  "regional manager",
  "acting regional manager",
  "assistant vice president",
  "vice president",
  "senior vice president",
];

const AUDIT_TRAVEL_PLAN_ROLES = [
  "branch manager",
  "acting branch manager",
  "area manager",
  "acting area manager",
  "regional manager",
  "acting regional manager",
  "assistant vice president",
  "vice president",
  "senior vice president",
];

const TREAD_TRAVEL_PLAN_ROLES = [
  "branch manager",
  "acting branch manager",
  "area manager",
  "acting area manager",
  "regional manager",
  "acting regional manager",
  "assistant vice president",
  "vice president",
  "senior vice president",
];

const isOperationDepartment = (department) =>
  normalizeDepartment(department) === "operation department";

const isAuditDepartment = (department) =>
  normalizeDepartment(department) === "audit department";

const isOfficeOfPresidentDepartment = (department) => {
  const normalizedDepartment =
    normalizeDepartment(department);

  return (
    normalizedDepartment ===
      "office of the president" ||
    normalizedDepartment ===
      "office of the president department"
  );
};

const isOperationStyleTravelDepartment = (department) =>
  isOperationDepartment(department) ||
  isAuditDepartment(department);

const hasOperationStyleTravelRole = (department, role) => {
  const normalizedDepartment = normalizeDepartment(department);
  const normalizedRole = normalizeRole(role);

  if (normalizedDepartment === "operation department") {
    return OPERATION_TRAVEL_PLAN_ROLES.includes(normalizedRole);
  }

  if (normalizedDepartment === "audit department") {
    return AUDIT_TRAVEL_PLAN_ROLES.includes(normalizedRole);
  }

  return false;
};

const isAdminOrIT = (req) => {
  const role = normalizeRole(req.user?.role);

  return role === "admin" || role === "it";
};

const canManageCalendarActivity = (req) => {
  const role = normalizeRole(req.user?.role);

  const department = normalizeDepartment(
    req.user?.department
  );

  return (
    role === "admin" ||
    department === "tread department"
  );
};

// =====================================================
// COMPLIANCE CHECK HELPERS
// =====================================================

const COMPLIANCE_REVIEW_LEVELS = {
  "area manager": 2,
  "acting area manager": 2,

  "regional manager": 3,
  "acting regional manager": 3,

  "assistant vice president": 4,

  "vice president": 5,

  "senior vice president": 6,
};

const getComplianceReviewLevel = (req) => {
  const role = normalizeRole(req.user?.role);

  if (role === "admin" || role === "it") {
    return 6;
  }

  return COMPLIANCE_REVIEW_LEVELS[role] || null;
};

const canCheckCompliance = (req) =>
  getComplianceReviewLevel(req) !== null;

const getLoggedInUserDisplayName = (req) => {
  return (
    toStr(req.user?.fullname) ||
    toStr(req.user?.full_name) ||
    [
      toStr(req.user?.first_name),
      toStr(req.user?.middle_name),
      toStr(req.user?.last_name),
    ]
      .filter(Boolean)
      .join(" ") ||
    toStr(req.user?.email) ||
    `User ${req.user?.id || ""}`
  );
};

// =====================================================
// TRAVEL PLAN ACCESS
// =====================================================

const canCreatePlan = (req) => {
  const role = normalizeRole(
    req.user?.role
  );

  const department = normalizeDepartment(
    req.user?.department
  );

  if (isAdminOrIT(req)) {
    return true;
  }

  /*
    Operation and Audit use their existing
    role hierarchy.
  */
  if (
    hasOperationStyleTravelRole(
      department,
      role
    )
  ) {
    return true;
  }

  /*
    TREAD:
    Branch Manager up to Senior Vice President.
  */
  if (
    department === "tread department" &&
    TREAD_TRAVEL_PLAN_ROLES.includes(role)
  ) {
    return true;
  }

  /*
    Office of the President:
    Any role under the department may create
    and manage travel plans.
  */
  if (
    isOfficeOfPresidentDepartment(
      department
    )
  ) {
    return true;
  }

  return false;
};

const canEditPlan = (req) => canCreatePlan(req);

const canUploadPlanPhoto = (req) => canCreatePlan(req);

const canDeleteTravelRecord = (req) => {
  const role = normalizeRole(req.user?.role);
  const department = normalizeDepartment(req.user?.department);

  return (
    role === "admin" ||
    role === "it" ||
    department === "tread department"
  );
};

const canViewTravelModule = (req) => {
  const role = normalizeRole(
    req.user?.role
  );

  const department = normalizeDepartment(
    req.user?.department
  );

  if (isAdminOrIT(req)) {
    return true;
  }

  if (
    hasOperationStyleTravelRole(
      department,
      role
    )
  ) {
    return true;
  }

  if (
    department === "tread department" &&
    TREAD_TRAVEL_PLAN_ROLES.includes(role)
  ) {
    return true;
  }

  /*
    Any role under Office of the President
    can open the Travel Plan/Calendar module.
  */
  if (
    isOfficeOfPresidentDepartment(
      department
    )
  ) {
    return true;
  }

  return false;
};

// =====================================================
// STANDARD ERROR HANDLER
// =====================================================

const sendServerError = (res, routeName, error) => {
  console.error(`${routeName} ERROR:`, error);

  return res.status(500).json({
    message: "Server error",
  });
};

const manilaTimestampSql = (columnName) => `
  CASE
    WHEN ${columnName} IS NULL THEN NULL
    ELSE
      TO_CHAR(
        ${columnName},
        'YYYY-MM-DD"T"HH24:MI:SS.MS'
      ) || '+08:00'
  END
`;

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

    const result = await pool.query(
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
  }
});

// =====================================================
// UPDATE TRAVEL PLAN
// =====================================================

router.put("/travel-plans/:id", requireAuth, async (req, res) => {
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

    const existingResult = await pool.query(
      `
      SELECT
        id,
        status,
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

    if (norm(existingPlan.status) === "completed") {
      return res.status(400).json({
        message:
          "Completed travel plans can no longer be edited.",
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

    const result = await pool.query(
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
        toStr(req.body.review_cashbook_vs_voucher);

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
          $15::date,

          $16,
          $17,

          $18,
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
            ? reviewBms || null
            : null,

          // $8
          noteType === "REVIEW"
            ? reviewOtherFindings || null
            : null,

          // $9
          noteType === "REVIEW"
            ? reviewPhotoUrl
            : null,

          // $10
          noteType === "FINDINGS"
            ? passbookReconciliation || null
            : null,

          // $11
          noteType === "FINDINGS"
            ? pastDueDelinquentReport || null
            : null,

          // $12
          noteType === "FINDINGS"
            ? groupCollectionRecord || null
            : null,

          // $13
          noteType === "FINDINGS"
            ? otherFindings || null
            : null,

          // $14
          involvedStaff || null,

          // $15
          noteType === "FINDINGS"
            ? dueDate || null
            : null,

          // $16
          noteType === "REVIEW"
            ? reviewDetails || null
            : findingDetails || null,

          // $17
          noteType === "FINDINGS"
            ? findingPhotoUrl
            : null,

          // $18
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

      const result =
        await client.query(
          `
          UPDATE public.travel_plan_notes

          SET
            note_type = $2,
            title = $3,

            finding_type = $4,

            review_coh = $5,
            review_cashbook_vs_voucher = $6,
            review_bms = $7,
            review_other_findings = $8,
            review_photo_url = $9,

            passbook_reconciliation = $10,
            past_due_delinquent_report = $11,
            group_collection_record = $12,
            other_findings = $13,
            finding_photo_url = $14,

            involved_staff = $15,
            due_date = $16::date,

            content = $17

          WHERE id = $1

          RETURNING
            id,
            travel_plan_id,
            note_type,
            title,

            finding_type,

            review_coh,
            review_cashbook_vs_voucher,
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
              ? reviewCashbookVsVoucher ||
                null
              : null,

            // $7
            noteType === "REVIEW"
              ? reviewBms || null
              : null,

            // $8
            noteType === "REVIEW"
              ? reviewOtherFindings ||
                null
              : null,

            // $9
            noteType === "REVIEW"
              ? reviewPhotoUrl
              : null,

            // $10
            noteType === "FINDINGS"
              ? passbookReconciliation ||
                null
              : null,

            // $11
            noteType === "FINDINGS"
              ? pastDueDelinquentReport ||
                null
              : null,

            // $12
            noteType === "FINDINGS"
              ? groupCollectionRecord ||
                null
              : null,

            // $13
            noteType === "FINDINGS"
              ? otherFindings || null
              : null,

            // $14
            noteType === "FINDINGS"
              ? findingPhotoUrl
              : null,

            // $15
            involvedStaff || null,

            // $16
            noteType === "FINDINGS"
              ? dueDate || null
              : null,

            // $17
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
          status
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

      if (norm(planResult.rows[0].status) === "completed") {
        return res.status(400).json({
          message:
            "Photos cannot be added to a completed travel plan.",
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
// GET STAFF SCOPE
// =====================================================

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
            THEN 'Not Submitted'

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
            'vice president',
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
              WHEN 'vice president' THEN 1
              WHEN 'assistant vice president' THEN 2
              WHEN 'regional manager' THEN 3
              WHEN 'acting regional manager' THEN 4
              WHEN 'area manager' THEN 5
              WHEN 'acting area manager' THEN 6
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
            'senior vice president',
            'vice president',
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

      // =================================================
      // ADMIN AND IT
      // =================================================
      //
      // Admin and IT can see all branches.
      // =================================================

      if (isAdminOrIT(req)) {
        sql = `
          ${baseSelect}

          ORDER BY
            b.region ASC NULLS LAST,
            b.area ASC NULLS LAST,
            b.name ASC
        `;
      }

      // =================================================
      // TREAD DEPARTMENT
      // =================================================
      //
      // TREAD Branch Manager through SVP can see all
      // branches.
      // =================================================

      else if (
        department === "tread department" &&
        TREAD_TRAVEL_PLAN_ROLES.includes(role)
      ) {
        sql = `
          ${baseSelect}

          ORDER BY
            b.region ASC NULLS LAST,
            b.area ASC NULLS LAST,
            b.name ASC
        `;
      }

      // AREA MANAGER / ACTING AREA MANAGER
      // =================================================
      // AUDIT BRANCH MANAGER / ACTING BRANCH MANAGER
      // =================================================
      // Can select and view only the logged-in account's
      // assigned branch.
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

          AND b.id = $1

          ORDER BY
            b.name ASC
        `;

        params = [userBranchId];
      }

      // =================================================
      // AREA MANAGER / ACTING AREA MANAGER
      // =================================================
      //
      // Shows all branches under the user's area.
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
              COALESCE(b.area, '')
            )
          ) = LOWER(TRIM($1))

          ORDER BY
            b.name ASC
        `;

        params = [userArea];
      }

      // =================================================
      // REGIONAL MANAGER / ACTING REGIONAL MANAGER
      // =================================================
      //
      // Shows all branches under the user's region.
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
              COALESCE(b.region, '')
            )
          ) = LOWER(TRIM($1))

          ORDER BY
            b.area ASC NULLS LAST,
            b.name ASC
        `;

        params = [userRegion];
      }

      // =================================================
      // ASSISTANT VICE PRESIDENT
      // =================================================
      //
      // Shows all branches under the user's division.
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
              COALESCE(b.division, '')
            )
          ) = LOWER(TRIM($1))

          ORDER BY
            b.region ASC NULLS LAST,
            b.area ASC NULLS LAST,
            b.name ASC
        `;

        params = [userDivision];
      }

      // =================================================
      // VICE PRESIDENT
      // =================================================
      //
      // Vice President can see all branches.
      // =================================================

      else if (
        isOperationStyleTravelDepartment(department) &&
        role === "vice president"
      ) {
        sql = `
          ${baseSelect}

          ORDER BY
            b.division ASC NULLS LAST,
            b.region ASC NULLS LAST,
            b.area ASC NULLS LAST,
            b.name ASC
        `;
      }

      // =================================================
      // SENIOR VICE PRESIDENT
      // =================================================
      //
      // Senior Vice President can see all branches.
      // =================================================

      else if (
        isOperationStyleTravelDepartment(department) &&
        role === "senior vice president"
      ) {
        sql = `
          ${baseSelect}

          ORDER BY
            b.division ASC NULLS LAST,
            b.region ASC NULLS LAST,
            b.area ASC NULLS LAST,
            b.name ASC
        `;
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
        "GET /travel-plans/branch-scope",
        error
      );
    }
  }
);

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