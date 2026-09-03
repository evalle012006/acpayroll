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

const markExpiredTravelPlansIncomplete = async (
  client = pool
) => {
  await client.query(`
    UPDATE public.travel_plans

    SET
      status = 'Incomplete',
      updated_at =
        NOW() AT TIME ZONE 'Asia/Manila'

    WHERE LOWER(
      TRIM(
        COALESCE(status, '')
      )
    ) = 'pending'

      AND plan_date < (
        NOW() AT TIME ZONE 'Asia/Manila'
      )::date
  `);
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

module.exports = router;