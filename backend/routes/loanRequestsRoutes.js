//loanRequestsRoutes.js

const express = require("express");
const router = express.Router();
const pool = require("../db");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const { requireAuth } = require("../middlewares/authMiddleware");
const { requirePermission } = require("../middlewares/permissionMiddleware");

const {
  getRole,
  canViewAll,
  isIT,
  isBranchManager,
  isAreaManager,
  isRegionalManager,
  isAssistantVicePresident,
  isVicePresident,
  isSeniorVicePresident,
  isPresident,
} = require("../utils/roleAccess");

const ACCOUNTING_FINAL = "accounting";

const toNum = (v) => {
  const cleaned = String(v ?? "")
    .replace(/[₱,\s]/g, "")
    .trim();

  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
};

const toInt = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

const toStr = (v) => String(v ?? "").trim();
const norm = (v) => toStr(v).toLowerCase();
const roleLower = (req) => norm(getRole(req));

const getUserDepartment = (req) =>
  toStr(
    req.user?.department ||
    req.user?.department_name ||
    req.user?.user_department ||
    req.user?.departmentName ||
    req.user?.dept
  );

const getUserBranchCode = (req) => toStr(req.user?.branch_id);
const getUserArea = (req) => toStr(req.user?.area);
const getUserRegion = (req) => toStr(req.user?.region);

const isAdmin = (req) => norm(getRole(req)) === "admin";

const isHrDepartmentUser = (req) => {
  const role = norm(getRole(req));
  const dept = norm(getUserDepartment(req)).replace(/\s+/g, " ");

  return (
    role === "hr" ||
    dept === "hr" ||
    dept === "hr department" ||
    dept.includes("hr")
  );
};

const isAccountingDepartmentUser = (req) => {
  const role = norm(getRole(req));
  const dept = norm(getUserDepartment(req)).replace(/\s+/g, " ");

  return (
    role === "accounting" ||
    dept === "accounting" ||
    dept === "accounting department" ||
    dept.includes("accounting")
  );
};

const canBypassApproval = (req) =>
  isAdmin(req) ||
  isIT(req) ||
  isHrDepartmentUser(req) ||
  isAccountingDepartmentUser(req) ||
  isSeniorVicePresident(req);

const canVoidOrDeleteLoan = (req) =>
  isAdmin(req) ||
  isIT(req) ||
  isHrDepartmentUser(req) ||
  isAccountingDepartmentUser(req);

const canViewAllLoans = (req) => {
  const dept = norm(getUserDepartment(req));

  if (canViewAll(req)) return true;
  if (isIT(req)) return true;
  if (isHrDepartmentUser(req)) return true;
  if (isAccountingDepartmentUser(req)) return true;
  if (isSeniorVicePresident(req)) return true;
  if (isPresident(req)) return true;

  return [
    "it department",
    "audit department",
    "hr department",
    "accounting department",
    "office of the president",
    "production & logistic department",
    "production and logistic department",
    "tread department",
  ].includes(dept);
};

const canDownloadLoanFiles = (req) =>
  canViewAllLoans(req) ||
  isBranchManager(req) ||
  isAreaManager(req) ||
  isRegionalManager(req) ||
  isAssistantVicePresident(req) ||
  isVicePresident(req);

const VALID_LOAN_PURPOSES = [
  "Emergency",
  "Medical",
  "Hospital Bill",
  "Drivers License",
  "Motorcycle",
  "Financial",
  "Travel",
  "Mortgage",
  "Business",
  "Bill Payment",
];

const isValidLoanPurpose = (purpose) =>
  VALID_LOAN_PURPOSES.map(norm).includes(norm(purpose));

const hasRole = (position, roleName) =>
  norm(position).includes(norm(roleName));

const isBranchManagerPos = (position) =>
  hasRole(position, "branch manager") ||
  hasRole(position, "acting branch manager");

const isAreaManagerPos = (position) =>
  hasRole(position, "area manager") ||
  hasRole(position, "acting area manager");

const isRegionalManagerPos = (position) =>
  hasRole(position, "regional manager") ||
  hasRole(position, "acting regional manager");

const isAvpPos = (position) =>
  hasRole(position, "assistant vice president");

const isVpPos = (position) =>
  hasRole(position, "vice president") &&
  !hasRole(position, "assistant vice president") &&
  !hasRole(position, "senior vice president");

const isSvpPos = (position) =>
  hasRole(position, "senior vice president");

const isOperationDept = (department) => {
  const dept = norm(department);
  return [
    "operation department",
    "operations department",
    "operation",
    "operations",
  ].includes(dept);
};

const isOperationVicePresidentUser = (req) =>
  isVicePresident(req) && isOperationDept(getUserDepartment(req));

const isOperationAdvanceLoan = (loanType) =>
  [
    "salary advance",
    "cash advance",
    "cash loan",
    "special advance",
    "special loan",
  ].includes(norm(loanType));

const shouldVpFinalUpload = (staff, loanType) =>
  isOperationDept(staff?.department) &&
  isOperationAdvanceLoan(loanType) &&
  !isVpPos(staff?.position) &&
  !isSvpPos(staff?.position);

const canFinalUploadLoanFile = (
  req,
  applicantPosition,
  applicantDepartment,
  loanType
) => {
  const isOperation = isOperationDept(applicantDepartment);

  if (
    isOperation &&
    isOperationAdvanceLoan(loanType) &&
    !isVpPos(applicantPosition) &&
    !isSvpPos(applicantPosition)
  ) {
    return isOperationVicePresidentUser(req) || isAdmin(req) || isIT(req);
  }

  return (
    isAccountingDepartmentUser(req) ||
    isHrDepartmentUser(req) ||
    isAdmin(req) ||
    isIT(req)
  );
};

const getRawApprovalChain = (staff) => {
  const pos = norm(staff?.position);
  const dept = norm(staff?.department);
  const isOperation = isOperationDept(dept);

    const isAuditDepartment =
      dept === "audit" ||
      dept === "audit department";

    if (isAuditDepartment) {
      if (isSvpPos(pos)) {
        return [ACCOUNTING_FINAL];
      }

      if (isVpPos(pos)) {
        return [
          "senior vice president",
          ACCOUNTING_FINAL,
        ];
      }

      if (isAvpPos(pos)) {
        return [
          "senior vice president",
          ACCOUNTING_FINAL,
        ];
      }

      if (isRegionalManagerPos(pos)) {
        return [
          "assistant vice president",
          ACCOUNTING_FINAL,
        ];
      }

      if (isAreaManagerPos(pos)) {
        return [
          "regional manager",
          "assistant vice president",
          ACCOUNTING_FINAL,
        ];
      }

      if (isBranchManagerPos(pos)) {
        return [
          "area manager",
          "regional manager",
          "assistant vice president",
          ACCOUNTING_FINAL,
        ];
      }

      return [
        "branch manager",
        "area manager",
        "regional manager",
        "assistant vice president",
        ACCOUNTING_FINAL,
      ];
    }

  if (isOperation) {
    if (isSvpPos(pos)) return [ACCOUNTING_FINAL];
    if (isVpPos(pos)) return ["senior vice president", ACCOUNTING_FINAL];
    if (isAvpPos(pos)) return ["vice president"];

    if (isRegionalManagerPos(pos)) {
      return ["assistant vice president", "vice president"];
    }

    if (isAreaManagerPos(pos)) {
      return ["regional manager", "assistant vice president", "vice president"];
    }

    if (isBranchManagerPos(pos)) {
      return [
        "area manager",
        "regional manager",
        "assistant vice president",
        "vice president",
      ];
    }

    return [
      "branch manager",
      "area manager",
      "regional manager",
      "assistant vice president",
      "vice president",
    ];
  }

  const isITDepartment =
    dept === "it" ||
    dept === "it department" ||
    dept === "information technology" ||
    dept === "information technology department";

  if (isITDepartment) {
    if (isSvpPos(pos)) {
      return [
        ACCOUNTING_FINAL,
      ];
    }

    if (isAvpPos(pos)) {
      return [
        "senior vice president",
        ACCOUNTING_FINAL,
      ];
    }

    if (isRegionalManagerPos(pos)) {
      return [
        "assistant vice president",
        ACCOUNTING_FINAL,
      ];
    }

    if (isAreaManagerPos(pos)) {
      return [
        "regional manager",
        "assistant vice president",
        ACCOUNTING_FINAL,
      ];
    }

    if (isBranchManagerPos(pos)) {
      return [
        "area manager",
        "regional manager",
        "assistant vice president",
        ACCOUNTING_FINAL,
      ];
    }

    return [
      "branch manager",
      "area manager",
      "regional manager",
      "assistant vice president",
      ACCOUNTING_FINAL,
    ];
  }

  if (isSvpPos(pos)) {
    return [ACCOUNTING_FINAL];
  }

  if (isVpPos(pos)) {
    return [
      "senior vice president",
      ACCOUNTING_FINAL,
    ];
  }

  if (isBranchManagerPos(pos)) {
    return [
      "vice president",
      "senior vice president",
      ACCOUNTING_FINAL,
    ];
  }

  return [
    "branch manager",
    "vice president",
    "senior vice president",
    ACCOUNTING_FINAL,
  ];
};

const stageColumn = (stage) => {
  const s = norm(stage);

  if (s === "branch manager") return "branch_manager_status";
  if (s === "area manager") return "area_manager_status";
  if (s === "regional manager") return "regional_manager_status";
  if (s === "assistant vice president") return "assistant_vice_president_status";
  if (s === "vice president") return "vice_president_status";
  if (s === "senior vice president") return "senior_vice_president_status";
  if (s === ACCOUNTING_FINAL || s === "admin") return "admin_status";

  return null;
};

const stageApprovedAtColumn = (stage) => {
  const s = norm(stage);

  if (s === "branch manager") return "branch_manager_approved_at";
  if (s === "area manager") return "area_manager_approved_at";
  if (s === "regional manager") return "regional_manager_approved_at";
  if (s === "assistant vice president")
    return "assistant_vice_president_approved_at";
  if (s === "vice president") return "vice_president_approved_at";
  if (s === "senior vice president")
    return "senior_vice_president_approved_at";
  if (s === ACCOUNTING_FINAL || s === "admin")
    return "accounting_approved_at";

  return null;
};

const canApproveStage = (req, stage) => {
  const role = roleLower(req);
  const s = norm(stage);

  if (canBypassApproval(req)) return true;

  if (s === "branch manager") return role === "branch manager";
  if (s === "area manager") return role === "area manager";
  if (s === "regional manager") return role === "regional manager";
  if (s === "assistant vice president") return role === "assistant vice president";
  if (s === "vice president") return role === "vice president";
  if (s === "senior vice president") return role === "senior vice president";
  if (s === ACCOUNTING_FINAL || s === "admin") {
    return (
      isAccountingDepartmentUser(req) ||
      isHrDepartmentUser(req) ||
      isAdmin(req) ||
      isIT(req)
    );
  }

  return false;
};

async function getTableColumns(client, tableName) {
  const r = await client.query(
    `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = $1
    `,
    [tableName]
  );

  return r.rows.map((x) => x.column_name);
}

async function hasApproverAccount(client, stage, staff) {
  const s = norm(stage);

  if (s === ACCOUNTING_FINAL) return true;

  const userCols = await getTableColumns(client, "users");

  const checkUsers = async () => {
    if (!userCols.includes("role")) return false;

    const where = [`LOWER(TRIM(COALESCE(role, ''))) = $1`];
    const params = [s];

    if (userCols.includes("status")) {
      where.push(`LOWER(TRIM(COALESCE(status, 'active'))) <> 'inactive'`);
    }

    if (userCols.includes("department")) {
      params.push(norm(staff.department));

      const departmentParam = `$${params.length}`;

      where.push(`
        (
          LOWER(
            REGEXP_REPLACE(
              TRIM(COALESCE(users.department, '')),
              '\\s+',
              ' ',
              'g'
            )
          ) = ${departmentParam}

          OR EXISTS (
            SELECT 1
            FROM public.user_department_scopes uds
            WHERE uds.user_id = users.id
              AND LOWER(
                REGEXP_REPLACE(
                  TRIM(COALESCE(uds.department, '')),
                  '\\s+',
                  ' ',
                  'g'
                )
              ) = ${departmentParam}
          )
        )
      `);
    }

    const r = await client.query(
      `
        SELECT id
        FROM public.users
        WHERE ${where.join(" AND ")}
        LIMIT 1
      `,
      params
    );

    return r.rowCount > 0;
  };

  const checkStaff = async () => {
    const staffCols = await getTableColumns(client, "staff");

    if (!staffCols.includes("position")) return false;

    const where = [`LOWER(TRIM(COALESCE(position, ''))) = $1`];
    const params = [s];

    if (staffCols.includes("status")) {
      where.push(`LOWER(TRIM(COALESCE(status, 'active'))) = 'active'`);
    }

    if (staffCols.includes("department")) {
      params.push(norm(staff.department));
      where.push(`LOWER(TRIM(COALESCE(department, ''))) = $${params.length}`);
    }

    const r = await client.query(
      `SELECT id FROM public.staff WHERE ${where.join(" AND ")} LIMIT 1`,
      params
    );

    return r.rowCount > 0;
  };

  try {
    // First check if an active USER account exists
    const userExists = await checkUsers();

    if (userExists) {
      return true;
    }

    // If no matching user account was found,
    // fall back to the staff table.
    return await checkStaff();
  } catch (userError) {
    console.error(
      "CHECK LOAN APPROVER USER ERROR:",
      userError.message
    );

    // If users lookup fails for any reason,
    // still try the staff table.
    try {
      return await checkStaff();
    } catch (staffError) {
      console.error(
        "CHECK LOAN APPROVER STAFF ERROR:",
        staffError.message
      );

      return false;
    }
  }
}

async function getApprovalChain(client, staff) {
  const raw = getRawApprovalChain(staff);
  const final = [];

  for (const stage of raw) {
    const exists = await hasApproverAccount(client, stage, staff);
    if (exists) final.push(stage);
  }

  return final.length ? final : [ACCOUNTING_FINAL];
}

async function getInitialApprovalStage(client, staff) {
  const chain = await getApprovalChain(client, staff);
  return chain[0] || ACCOUNTING_FINAL;
}

async function getNextApprovalStage(client, staff, currentStage) {
  const chain = await getApprovalChain(client, staff);
  const idx = chain.findIndex((x) => norm(x) === norm(currentStage));

  if (idx < 0) return chain[0] || ACCOUNTING_FINAL;
  if (idx >= chain.length - 1) return "approved";

  return chain[idx + 1];
}

async function getBranchIdFromCode(branchCode) {
  const code = toStr(branchCode);
  if (!code) return null;

  const r = await pool.query(
    `
    SELECT id
    FROM public.branches
    WHERE LOWER(TRIM(code)) = LOWER(TRIM($1))
    LIMIT 1
    `,
    [code]
  );

  return r.rows[0]?.id || null;
}

async function ensureBalanceRow(client, employeeNo) {
  await client.query(
    `
    INSERT INTO public.staff_balances
    (
      employee_no,
      fullname,
      position,
      last_name,
      first_name,
      middle_name,
      cbu,
      cashbond,
      utility,
      salary_advance,
      motorcycle_loan,
      special_advance,
      cash_advance,
      pag_ibig_loan,
      other_receivable,
      staff_accounts_payable,
      created_at,
      updated_at
    )
    SELECT
      s.employee_no,
      s.fullname,
      s.position,
      s.last_name,
      s.first_name,
      s.middle_name,
      0, -- cbu
      0, -- cashbond
      0, -- utility
      0, -- salary_advance
      0, -- motorcycle_loan
      0, -- special_advance
      0, -- cash_advance
      0, -- pag_ibig_loan
      0, -- other_receivable
      0, -- staff_accounts_payable
      NOW(),
      NOW()
    FROM public.staff s
    WHERE s.employee_no = $1
    ON CONFLICT (employee_no) DO NOTHING
    `,
    [employeeNo]
  );
}

function loanTypeToBalanceColumn(loanType) {
  const lt = norm(loanType);

  if (lt === "salary advance") return "salary_advance";
  if (lt === "special loan") return "special_advance";
  if (lt === "special advance") return "special_advance";
  if (lt === "cash advance") return "cash_advance";
  if (lt === "cash loan") return "cash_advance";  
  if (lt === "motorcycle loan") return "motorcycle_loan";
  if (lt === "pag-ibig loan") return "pag_ibig_loan";
  if (lt === "pag ibig loan") return "pag_ibig_loan";

  return null;
}

async function hasExistingLoanBalance(
  client,
  employeeNo,
  loanType
) {
  const result = await client.query(
    `
    WITH eligible_loans AS (
      SELECT
        lr.id,
        lr.employee_no,
        lr.loan_type,

        COALESCE(
          lr.approved_total,
          lr.total,
          lr.approved_amount,
          lr.amount,
          0
        ) AS loan_total,

        COALESCE(
          lr.approved_per_month,
          lr.per_month,
          0
        ) AS monthly_deduction,

        CASE
          /*
            LOAN DEDUCTION RULE

            Approved 1st - 9th
            = first deduction on 10th SAME month

            Approved 10th - end
            = first deduction on 10th NEXT month
          */
          WHEN EXTRACT(
            DAY FROM lr.approved_at::date
          ) BETWEEN 1 AND 9

          THEN (
            DATE_TRUNC(
              'month',
              lr.approved_at::date
            )
            + INTERVAL '9 days'
          )::date

          ELSE (
            DATE_TRUNC(
              'month',
              lr.approved_at::date
            )
            + INTERVAL '1 month'
            + INTERVAL '9 days'
          )::date
        END AS first_deduction_date

      FROM public.loan_requests lr

      WHERE
        LOWER(
          TRIM(
            COALESCE(
              lr.employee_no,
              ''
            )
          )
        ) = LOWER(TRIM($1))

        AND LOWER(
          TRIM(
            COALESCE(
              lr.loan_type,
              ''
            )
          )
        ) = LOWER(TRIM($2))

        AND LOWER(
          TRIM(
            COALESCE(
              lr.status,
              ''
            )
          )
        ) = 'approved'

        AND lr.approved_at IS NOT NULL
    ),

    calculated AS (
      SELECT
        id,

        GREATEST(
          loan_total
          -
          (
            CASE
              /*
                First deduction has not happened yet.
              */
              WHEN
                (
                  NOW()
                  AT TIME ZONE 'Asia/Manila'
                )::date
                <
                first_deduction_date

              THEN 0

              ELSE
                (
                  /*
                    Count completed 10th deductions.

                    Example:
                    First deduction = Sep 10

                    Sep 09 -> 0
                    Sep 10 -> 1
                    Oct 09 -> 1
                    Oct 10 -> 2
                    Nov 09 -> 2
                    Nov 10 -> 3
                  */

                  (
                    EXTRACT(
                      YEAR FROM
                      (
                        NOW()
                        AT TIME ZONE 'Asia/Manila'
                      )::date
                    )::int
                    -
                    EXTRACT(
                      YEAR FROM
                      first_deduction_date
                    )::int
                  ) * 12

                  +

                  (
                    EXTRACT(
                      MONTH FROM
                      (
                        NOW()
                        AT TIME ZONE 'Asia/Manila'
                      )::date
                    )::int
                    -
                    EXTRACT(
                      MONTH FROM
                      first_deduction_date
                    )::int
                  )

                  +

                  CASE
                    WHEN EXTRACT(
                      DAY FROM
                      (
                        NOW()
                        AT TIME ZONE 'Asia/Manila'
                      )::date
                    )::int >= 10
                    THEN 1
                    ELSE 0
                  END
                )
            END

            * monthly_deduction
          ),
          0
        ) AS remaining_balance

      FROM eligible_loans
    )

    SELECT
      id,
      remaining_balance

    FROM calculated

    WHERE remaining_balance > 0

    LIMIT 1
    `,
    [
      employeeNo,
      loanType,
    ]
  );

  return result.rowCount > 0;
}

async function validateSalaryAdvance(client, employeeNo, amount) {
  const r = await client.query(
    `
    SELECT
      COALESCE(cbu,0) AS cbu,
      COALESCE(cashbond,0) AS cashbond
    FROM public.staff_balances
    WHERE employee_no = $1
    LIMIT 1
    `,
    [employeeNo]
  );

  if (r.rowCount === 0) {
    throw new Error("Staff balances not found.");
  }

  const cbu = toNum(r.rows[0].cbu);
  const cashbond = toNum(r.rows[0].cashbond);

  const maxLoanable = cbu + cashbond;

  if (toNum(amount) > maxLoanable) {
    throw new Error(
      "Personal savings too low for the requested loan."
    );
  }

  return maxLoanable;
}

function buildLoanSchedule(
  totalAmount,
  monthlyAmount,
  startDate = new Date()
) {
  const rows = [];

  let remaining =
    Math.round(toNum(totalAmount) * 100) / 100;

  const monthly = toNum(monthlyAmount);

  if (remaining <= 0 || monthly <= 0) {
    return rows;
  }

  const approvedDate = new Date(startDate);
  const current = new Date(approvedDate);

  // Loan deduction cutoff rule:
  //
  // Approved on the 1st–9th
  // → first deduction is the 10th of SAME month
  //
  // Approved on the 10th–end of month
  // → first deduction is the 10th of NEXT month

  if (approvedDate.getDate() <= 9) {
    // Approved 1st-9th:
    // first deduction = 10th of same month
    current.setDate(10);
  } else {
    // Approved 10th-end:
    // first deduction = 10th of next month
    current.setMonth(current.getMonth() + 1);
    current.setDate(10);
  }

  while (remaining > 0) {
    const deduction = Math.min(
      remaining,
      monthly
    );

    rows.push({
      month: current.toLocaleString("en-US", {
        month: "long",
        year: "numeric",
      }),
      date: current.toISOString().slice(0, 10),
      amount:
        Math.round(deduction * 100) / 100,
    });

    remaining =
      Math.round(
        (remaining - deduction) * 100
      ) / 100;

    current.setMonth(
      current.getMonth() + 1
    );

    current.setDate(10);
  }

  return rows;
}

async function createLoanApprovedNotification(client, loanId) {
  const r = await client.query(
    `
    SELECT
      lr.id,
      lr.employee_no,
      lr.loan_type,
      lr.total,
      lr.amount,
      COALESCE(s.fullname,'') AS staff_name,
      s.branch_id,
      b.code AS branch_code,
      b.name AS branch_name
    FROM public.loan_requests lr
    LEFT JOIN public.staff s
      ON s.id = lr.staff_id
    LEFT JOIN public.branches b
      ON b.id = s.branch_id
    WHERE lr.id = $1
    LIMIT 1
    `,
    [loanId]
  );

  if (r.rowCount === 0) return;

  const loan = r.rows[0];

  await client.query(
    `
    INSERT INTO public.notifications
    (
      user_id,
      role,
      department,
      scope,
      title,
      message,
      link,
      target_branch_id,
      target_branch_code,
      target_branch_name,
      is_read,
      created_at
    )
    VALUES
    (
      NULL,
      NULL,
      NULL,
      'branch-or-admin',
      $1,
      $2,
      '/approval',
      $3,
      $4,
      $5,
      FALSE,
      NOW()
    )
    `,
    [
      "Loan Approved",
      `${loan.staff_name || "Employee"}'s ${
        loan.loan_type || "loan"
      } has been fully approved.`,
      loan.branch_id ? String(loan.branch_id) : null,
      loan.branch_code || null,
      loan.branch_name || null,
    ]
  );
}

const uploadDir = path.join(
  __dirname,
  "../uploads/loans"
);

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, {
    recursive: true,
  });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) =>
    cb(null, uploadDir),

  filename: (_req, file, cb) => {
    const unique =
      Date.now() +
      "-" +
      Math.round(Math.random() * 1e9);

    cb(
      null,
      unique +
        path.extname(
          file.originalname || ""
        )
    );
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024,
  },
});

const loanSelectFields = `
  lr.id,
  lr.staff_id,
  lr.employee_no,

  lr.loan_type,
  lr.loan_purpose,
  lr.reason,

  lr.amount,
  lr.term,
  lr.interest,
  lr.total,
  lr.per_month,

  lr.approved_amount,
  lr.approved_total,
  lr.approved_per_month,
  lr.approved_term,

  lr.status,
  lr.approved_at,
  lr.disbursement_date,

  lr.attachment_path,
  lr.attachment_name,
  lr.attachment_mime,

  lr.approved_attachment_path,
  lr.approved_attachment_name,
  lr.approved_attachment_mime,

  lr.applicant_role,
  lr.approval_stage,

  lr.branch_manager_status,
  lr.area_manager_status,
  lr.regional_manager_status,
  lr.assistant_vice_president_status,
  lr.vice_president_status,
  lr.senior_vice_president_status,
  lr.admin_status,
  lr.branch_manager_approved_at,
  lr.area_manager_approved_at,
  lr.regional_manager_approved_at,
  lr.assistant_vice_president_approved_at,
  lr.vice_president_approved_at,
  lr.senior_vice_president_approved_at,
  lr.accounting_approved_at,

  COALESCE(s.fullname,'') AS staff_name,

  s.first_name,
  s.last_name,
  s.middle_name,

  s.area,
  s.region,
  s.division,
  s.department,
  s.position,

  b.code AS branch_code,
  b.name AS branch_name
`;

router.delete(
  "/loan-requests/:id",
  requireAuth,
  async (req, res) => {
    try {
      if (!canVoidOrDeleteLoan(req)) {
        return res.status(403).json({
          message:
            "Only Admin, IT, HR Department and Accounting Department can delete loans.",
        });
      }

      const id = toInt(req.params.id);

      if (!id) {
        return res.status(400).json({
          message: "Invalid loan id",
        });
      }

      const r = await pool.query(
        `
        DELETE FROM public.loan_requests
        WHERE id = $1
          AND LOWER(TRIM(COALESCE(status,'')))
          IN ('voided','rejected')
        RETURNING id
        `,
        [id]
      );

      if (r.rowCount === 0) {
        return res.status(400).json({
          message:
            "Only rejected or voided loans can be deleted.",
        });
      }

      return res.json({
        message:
          "Loan deleted successfully.",
      });
    } catch (err) {
      console.error(
        "DELETE LOAN ERROR:",
        err
      );

      return res.status(500).json({
        message:
          err.message || "Server error",
      });
    }
  }
);

router.get(
  "/loan-requests",
  requireAuth,
  requirePermission("loan_request", "view"),
  async (req, res) => {
    try {
      let query = "";
      let params = [];

      const userDept = norm(getUserDepartment(req));

      if (canViewAllLoans(req)) {
        query = `
          SELECT ${loanSelectFields}
          FROM public.loan_requests lr
          LEFT JOIN public.staff s ON s.id = lr.staff_id
          LEFT JOIN public.branches b ON b.id = s.branch_id
          ORDER BY lr.id DESC
        `;
      } else if (isVicePresident(req) && userDept.includes("operation")) {
        query = `
          SELECT ${loanSelectFields}
          FROM public.loan_requests lr
          LEFT JOIN public.staff s ON s.id = lr.staff_id
          LEFT JOIN public.branches b ON b.id = s.branch_id
          WHERE LOWER(TRIM(COALESCE(s.department,''))) IN
          ('operation department','operations department','operation','operations')
          ORDER BY lr.id DESC
        `;
      } else if (isBranchManager(req)) {
        const bid = await getBranchIdFromCode(getUserBranchCode(req));
        if (!bid) return res.json([]);

        query = `
          SELECT ${loanSelectFields}
          FROM public.loan_requests lr
          LEFT JOIN public.staff s ON s.id = lr.staff_id
          LEFT JOIN public.branches b ON b.id = s.branch_id
          WHERE s.branch_id = $1
          ORDER BY lr.id DESC
        `;
        params = [bid];
      } else if (isAreaManager(req)) {
        query = `
          SELECT ${loanSelectFields}
          FROM public.loan_requests lr
          LEFT JOIN public.staff s ON s.id = lr.staff_id
          LEFT JOIN public.branches b ON b.id = s.branch_id
          WHERE LOWER(TRIM(COALESCE(s.area,''))) = LOWER(TRIM($1))
          ORDER BY lr.id DESC
        `;
        params = [getUserArea(req)];
      } else if (isRegionalManager(req)) {
        query = `
          SELECT ${loanSelectFields}
          FROM public.loan_requests lr
          LEFT JOIN public.staff s ON s.id = lr.staff_id
          LEFT JOIN public.branches b ON b.id = s.branch_id
          WHERE LOWER(TRIM(COALESCE(s.region,''))) = LOWER(TRIM($1))
          ORDER BY lr.id DESC
        `;
        params = [getUserRegion(req)];
      } else if (isAssistantVicePresident(req)) {
        query = `
          SELECT ${loanSelectFields}
          FROM public.loan_requests lr
          LEFT JOIN public.staff s ON s.id = lr.staff_id
          LEFT JOIN public.branches b ON b.id = s.branch_id
          WHERE LOWER(TRIM(COALESCE(s.division,''))) = LOWER(TRIM($1))
             OR LOWER(TRIM(COALESCE(s.department,''))) = LOWER(TRIM($2))
          ORDER BY lr.id DESC
        `;
        params = [toStr(req.user?.division), getUserDepartment(req)];
      } else {
        return res.status(403).json({
          message: "Access denied",
        });
      }

      const r = await pool.query(query, params);
      return res.json(r.rows);
    } catch (e) {
      console.error("GET LOANS ERROR:", e);
      return res.status(500).json({
        message: e.message || "Server error",
      });
    }
  }
);

router.get(
  "/loan-requests/staff/:staffId",
  requireAuth,
  requirePermission("loan_request", "view"),
  async (req, res) => {
    try {
      const staffId = toInt(req.params.staffId);

      if (!staffId) {
        return res.status(400).json({
          message: "Invalid staff id",
        });
      }

      const r = await pool.query(
        `
        SELECT ${loanSelectFields}
        FROM public.loan_requests lr
        LEFT JOIN public.staff s ON s.id = lr.staff_id
        LEFT JOIN public.branches b ON b.id = s.branch_id
        WHERE lr.staff_id = $1
        ORDER BY lr.id DESC
        `,
        [staffId]
      );

      return res.json(r.rows);
    } catch (e) {
      console.error("GET STAFF LOANS ERROR:", e);
      return res.status(500).json({
        message: e.message || "Server error",
      });
    }
  }
);

router.post(
  "/loan-requests",
  requireAuth,
  requirePermission("loan_request", "create"),
  upload.single("attachment"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const staff_id = toInt(req.body?.staff_id ?? req.body?.employee_id);
      const loan_type = toStr(req.body?.loan_type);
      const loan_purpose = toStr(req.body?.loan_purpose);
      const reason = toStr(req.body?.reason);

      let amount = toNum(req.body?.amount);
        console.log("CREATE LOAN BODY:", req.body);
        console.log("AMOUNT RECEIVED:", req.body?.amount, "PARSED:", amount);

      let term = Math.max(1, toInt(req.body?.term) || 1);
      let interest = 0;
      let per_month = 0;

      const loanTypeLower = norm(loan_type);

      if (!staff_id) {
        return res.status(400).json({ message: "staff_id is required" });
      }

      if (!loan_type) {
        return res.status(400).json({ message: "loan_type is required" });
      }

      if (!loan_purpose) {
        return res.status(400).json({ message: "loan_purpose is required" });
      }

      if (!isValidLoanPurpose(loan_purpose)) {
        return res.status(400).json({ message: "Invalid loan purpose" });
      }

      if (!amount || amount <= 0) {
        return res.status(400).json({ message: "amount is required" });
      }

      if (!reason) {
        return res.status(400).json({ message: "reason is required" });
      }

      if (!req.file) {
        return res.status(400).json({
          message: "Loan request file is required",
        });
      }

      if (loanTypeLower === "pag-ibig loan") {
        return res.status(400).json({
          message: "Pag-ibig Loan is currently disabled.",
        });
      }

      if (loanTypeLower === "salary advance") {
        interest = 10;
        term = 10;
      }

      if (loanTypeLower === "special advance" || loanTypeLower === "special loan") {
        interest = 0;
      }

      if (loanTypeLower === "cash advance" || loanTypeLower === "cash loan") {
        interest = 0;
        term = 1;

        if (amount < 1000 || amount > 5000) {
          return res.status(400).json({
            message: "Cash Advance amount must be between ₱1,000 and ₱5,000.",
          });
        }
      }

      if (loanTypeLower === "motorcycle loan") {
        interest = 20;
        per_month = Math.trunc(toNum(req.body?.per_month));

        if (per_month <= 0 || String(req.body?.per_month || "").includes(".")) {
          return res.status(400).json({
            message:
              "Motorcycle Loan monthly payment is required and must not contain decimal values.",
          });
        }
      }

      const total = amount + amount * (interest / 100);

      if (loanTypeLower !== "motorcycle loan") {
        per_month = Math.round((total / term) * 100) / 100;
      }

      await client.query("BEGIN");

      const s = await client.query(
        `
        SELECT
          id,
          employee_no,
          branch_id,
          area,
          region,
          division,
          department,
          position
        FROM public.staff
        WHERE id = $1
        LIMIT 1
        `,
        [staff_id]
      );

      if (s.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          message: "Staff not found",
        });
      }

      const staffRow = s.rows[0];

      await ensureBalanceRow(client, staffRow.employee_no);

      const existingPending = await client.query(
        `
        SELECT id
        FROM public.loan_requests
        WHERE employee_no = $1
          AND LOWER(TRIM(COALESCE(loan_type,''))) = LOWER(TRIM($2))
          AND LOWER(TRIM(COALESCE(status,''))) NOT IN ('approved','rejected','voided')
        LIMIT 1
        `,
        [staffRow.employee_no, loan_type]
      );

      if (existingPending.rowCount > 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: `This staff already has an active ${loan_type} request. Wait until it is approved, rejected, or voided.`,
        });
      }

      if (await hasExistingLoanBalance(client, staffRow.employee_no, loan_type)) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: `This staff still has an existing ${loan_type} balance. Fully paid ${loan_type} is required before creating another ${loan_type}.`,
        });
      }

      if (loanTypeLower === "salary advance") {
        await validateSalaryAdvance(client, staffRow.employee_no, amount);
      }

      if (!canViewAllLoans(req)) {
        if (isBranchManager(req)) {
          const bid = await getBranchIdFromCode(getUserBranchCode(req));

          if (!bid || Number(staffRow.branch_id) !== Number(bid)) {
            await client.query("ROLLBACK");
            return res.status(403).json({ message: "Access denied" });
          }
        }

        if (isAreaManager(req) && norm(staffRow.area) !== norm(getUserArea(req))) {
          await client.query("ROLLBACK");
          return res.status(403).json({ message: "Access denied" });
        }

        if (isRegionalManager(req) && norm(staffRow.region) !== norm(getUserRegion(req))) {
          await client.query("ROLLBACK");
          return res.status(403).json({ message: "Access denied" });
        }

        if (
          isAssistantVicePresident(req) &&
          norm(staffRow.division) !== norm(req.user?.division) &&
          norm(staffRow.department) !== norm(getUserDepartment(req))
        ) {
          await client.query("ROLLBACK");
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const applicant_role = toStr(staffRow.position || roleLower(req));
      const approval_stage = await getInitialApprovalStage(client, staffRow);

      const attachment_path = `/uploads/loans/${req.file.filename}`;
      const attachment_name = req.file.originalname || null;
      const attachment_mime = req.file.mimetype || null;

      const ins = await client.query(
        `
        INSERT INTO public.loan_requests
        (
          staff_id,
          employee_no,
          loan_type,
          loan_purpose,
          reason,
          amount,
          term,
          interest,
          total,
          per_month,
          status,
          applicant_role,
          approval_stage,
          branch_manager_status,
          area_manager_status,
          regional_manager_status,
          assistant_vice_president_status,
          vice_president_status,
          senior_vice_president_status,
          admin_status,
          approved_at,
          disbursement_date,
          attachment_path,
          attachment_name,
          attachment_mime,
          approved_attachment_path,
          approved_attachment_name,
          approved_attachment_mime
        )
        VALUES
        (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
          'Pending',$11,$12,
          'Pending','Pending','Pending','Pending','Pending','Pending','Pending',
          NULL,NULL,
          $13,$14,$15,
          NULL,NULL,NULL
        )
        RETURNING *
        `,
        [
          staff_id,
          staffRow.employee_no,
          loan_type,
          loan_purpose,
          reason,
          amount,
          term,
          interest,
          total,
          per_month,
          applicant_role,
          approval_stage,
          attachment_path,
          attachment_name,
          attachment_mime,
        ]
      );

      await client.query("COMMIT");
      return res.json(ins.rows[0]);
    } catch (e) {
      try {
        await client.query("ROLLBACK");
      } catch {}

      console.error("CREATE LOAN ERROR:", e);
      return res.status(500).json({
        message: e.message || "Server error",
      });
    } finally {
      client.release();
    }
  }
);

router.get(
  "/loan-requests/:id/download/:type",
  requireAuth,
  requirePermission("loan_request", "view"),
  async (req, res) => {
    try {
      const id = toInt(req.params.id);
      const type = norm(req.params.type);

      if (!id) return res.status(400).json({ message: "Invalid id" });

      if (!["request", "approved", "latest"].includes(type)) {
        return res.status(400).json({
          message: "Invalid attachment type",
        });
      }

      const r = await pool.query(
        `
        SELECT
          id,
          attachment_path,
          attachment_name,
          approved_attachment_path,
          approved_attachment_name
        FROM public.loan_requests
        WHERE id = $1
        LIMIT 1
        `,
        [id]
      );

      if (r.rowCount === 0) {
        return res.status(404).json({
          message: "Loan not found",
        });
      }

      if (!canDownloadLoanFiles(req)) {
        return res.status(403).json({
          message: "Access denied",
        });
      }

      const row = r.rows[0];

      let targetPath = row.attachment_path;
      let targetName = row.attachment_name;

      if (type === "approved" || type === "latest") {
        targetPath = row.approved_attachment_path || row.attachment_path;
        targetName = row.approved_attachment_name || row.attachment_name;
      }

      if (!targetPath) {
        return res.status(404).json({
          message: "No loan file found",
        });
      }

      const cleanPath = String(targetPath).replace(/^\/+/, "");
      const fileNameOnly = path.basename(cleanPath);

      const possiblePaths = [
        path.isAbsolute(targetPath) ? targetPath : null,
        path.join(__dirname, "..", cleanPath),
        path.join(process.cwd(), cleanPath),
        path.join(uploadDir, fileNameOnly),
      ].filter(Boolean);

      const filePath = possiblePaths.find((p) => fs.existsSync(p));

      if (!filePath) {
        return res.status(404).json({
          message: "Loan file not found",
          saved_path: targetPath,
        });
      }

      return res.download(filePath, targetName || path.basename(filePath));
    } catch (e) {
      console.error("DOWNLOAD LOAN ERROR:", e);
      return res.status(500).json({
        message: e.message || "Server error",
      });
    }
  }
);

router.put(
  "/loan-requests/:id",
  requireAuth,
  upload.single("attachment"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const id = toInt(req.params.id);
      const action = norm(req.body?.action);

      if (!id) {
        return res.status(400).json({ message: "Invalid id" });
      }

      if (!["approve", "reject"].includes(action)) {
        return res.status(400).json({ message: "Invalid action" });
      }

      if (action === "approve" && !req.file) {
        return res.status(400).json({
          message:
            "Please upload the signed/approved loan file before approving.",
        });
      }

      await client.query("BEGIN");

      const cur = await client.query(
        `
        SELECT *
        FROM public.loan_requests
        WHERE id = $1
        FOR UPDATE
        `,
        [id]
      );

      if (cur.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Loan not found" });
      }

      const loan = cur.rows[0];

      if (["approved", "rejected", "voided"].includes(norm(loan.status))) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: "Already finalized",
        });
      }

      const staffInfo = await client.query(
        `
        SELECT
          id,
          employee_no,
          branch_id,
          area,
          region,
          division,
          department,
          position
        FROM public.staff
        WHERE id = $1
        LIMIT 1
        `,
        [loan.staff_id]
      );

      if (staffInfo.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          message: "Staff not found",
        });
      }

      const staff = staffInfo.rows[0];

      let currentStage =
        norm(loan.approval_stage) ||
        (await getInitialApprovalStage(client, staff));

      const currentStageHasActiveApprover =
        await hasApproverAccount(
          client,
          currentStage,
          staff
        );

      if (!currentStageHasActiveApprover) {
        const activeChain = await getApprovalChain(
          client,
          staff
        );

        const rawChain = getRawApprovalChain(staff);

        const oldStageIndex = rawChain.findIndex(
          (stage) => norm(stage) === norm(currentStage)
        );

        const nextActiveStage = activeChain.find((stage) => {
          const stageIndex = rawChain.findIndex(
            (rawStage) => norm(rawStage) === norm(stage)
          );

          return stageIndex > oldStageIndex;
        });

        currentStage =
          nextActiveStage ||
          activeChain[0] ||
          ACCOUNTING_FINAL;

        await client.query(
          `
          UPDATE public.loan_requests
          SET approval_stage = $2
          WHERE id = $1
          `,
          [id, currentStage]
        );
      }

      if (!canApproveStage(req, currentStage)) {
        await client.query("ROLLBACK");

        console.log("DEBUG APPROVAL");
        console.log("ROLE:", getRole(req));
        console.log("STAGE:", currentStage);
        console.log("CAN BYPASS:", canBypassApproval(req));

        return res.status(403).json({
          message: "Not your approval stage",
        });
      }

      const column = stageColumn(currentStage);
      const approvedAtColumn = stageApprovedAtColumn(currentStage);

      if (!column || !approvedAtColumn) {
        await client.query("ROLLBACK");

        console.log("DEBUG COLUMN");
        console.log("CURRENT STAGE:", currentStage);

        return res.status(403).json({
          message: "Access denied",
        });
      }

      if (action === "reject") {
        await client.query(
          `
          UPDATE public.loan_requests
          SET
            status = 'Rejected',
            ${column} = 'Rejected'
          WHERE id = $1
          `,
          [id]
        );

        await client.query("COMMIT");

        return res.json({
          message: "Rejected successfully",
        });
      }

      const latestPath = `/uploads/loans/${req.file.filename}`;
      const latestName = req.file.originalname || null;
      const latestMime = req.file.mimetype || null;

      const nextStage = await getNextApprovalStage(client, staff, currentStage);

      if (norm(nextStage) === "approved") {
        const finalStage = shouldVpFinalUpload(staff, loan.loan_type)
          ? "vice president"
          : "accounting";

        const finalStatus = shouldVpFinalUpload(staff, loan.loan_type)
          ? "Pending Vice President Final File"
          : "Pending Accounting";

        await client.query(
          `
          UPDATE public.loan_requests
          SET
            ${column} = 'Approved',
            ${approvedAtColumn} = NOW(),
            status = $5,
            approval_stage = $6,
            attachment_path = $2,
            attachment_name = $3,
            attachment_mime = $4
          WHERE id = $1
          `,
          [id, latestPath, latestName, latestMime, finalStatus, finalStage]
        );

        await client.query("COMMIT");

        return res.json({
          message: shouldVpFinalUpload(staff, loan.loan_type)
            ? "Approved. Waiting for Operation Vice President final file."
            : "Approved. Waiting for Accounting final amount and final file.",
        });
      }

      await client.query(
        `
        UPDATE public.loan_requests
        SET
          ${column} = 'Approved',
          ${approvedAtColumn} = NOW(),
          approval_stage = $1,
          attachment_path = $3,
          attachment_name = $4,
          attachment_mime = $5
        WHERE id = $2
        `,
        [nextStage, id, latestPath, latestName, latestMime]
      );

      await client.query("COMMIT");

      return res.json({
        message: `Approved and moved to ${nextStage}.`,
      });
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch {}

      console.error("APPROVE LOAN ERROR:", err);
      return res.status(500).json({
        message: err.message || "Server error",
      });
    } finally {
      client.release();
    }
  }
);

router.post(
  "/loan-requests/:id/approved-file",
  requireAuth,
  upload.single("attachment"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const id = toInt(req.params.id);

      if (!id) {
        return res.status(400).json({ message: "Invalid id" });
      }

      if (!req.file) {
        return res.status(400).json({
          message: "Attachment is required",
        });
      }

      await client.query("BEGIN");

      const cur = await client.query(
        `
        SELECT
          lr.*,
          s.position,
          s.department
        FROM public.loan_requests lr
        LEFT JOIN public.staff s ON s.id = lr.staff_id
        WHERE lr.id = $1
        FOR UPDATE OF lr
        `,
        [id]
      );

      if (cur.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          message: "Loan not found",
        });
      }

      const loan = cur.rows[0];

      const finalStatus = norm(loan.status);

      const finalStage = norm(loan.approval_stage);

      if (
        finalStatus !== "pending accounting" &&
        finalStatus !== "pending vice president final file" &&
        finalStage !== "accounting" &&
        finalStage !== "vice president"
      ) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: "This loan is not yet ready for final upload.",
        });
      }

      if (
        !canFinalUploadLoanFile(req, loan.position, loan.department, loan.loan_type)
      ) {
        await client.query("ROLLBACK");
        return res.status(403).json({
          message: "Not allowed to upload final file.",
        });
      }

      const isOperationNonMotorAdvance =
        isOperationDept(loan.department) &&
        isOperationAdvanceLoan(loan.loan_type) &&
        norm(loan.loan_type) !== "motorcycle loan";

      const approvedAmount = isOperationNonMotorAdvance
        ? toNum(loan.amount)
        : toNum(req.body?.approved_amount);

      const approvedTotal = isOperationNonMotorAdvance
        ? toNum(loan.total)
        : toNum(req.body?.approved_total);

      const approvedPerMonth = isOperationNonMotorAdvance
        ? toNum(loan.per_month)
        : toNum(req.body?.approved_per_month);

      const approvedTerm = isOperationNonMotorAdvance
        ? toNum(loan.term)
        : toNum(req.body?.approved_term);

      if (approvedAmount <= 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Approved Amount is required." });
      }

      if (approvedTotal <= 0) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message: "Total Amount with Interest is required.",
        });
      }

      if (approvedPerMonth <= 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Monthly Deduction is required." });
      }

      if (approvedTerm <= 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Terms is required." });
      }

      const finalPath = `/uploads/loans/${req.file.filename}`;
      const finalName = req.file.originalname || null;
      const finalMime = req.file.mimetype || null;

      const finalApprovedAtColumn =
        finalStage === "vice president"
          ? "vice_president_approved_at"
          : "accounting_approved_at";

      const finalStatusColumn =
        finalStage === "vice president"
          ? "vice_president_status"
          : "admin_status";

      await client.query(
        `
        UPDATE public.loan_requests
        SET
          status = 'Approved',
          approval_stage = 'completed',

          ${finalStatusColumn} = 'Approved',
          ${finalApprovedAtColumn} = NOW(),

          approved_at = CURRENT_DATE,
          disbursement_date = CURRENT_DATE,

          approved_amount = $5,
          approved_total = $6,
          approved_per_month = $7,
          approved_term = $8,

          attachment_path = $2,
          attachment_name = $3,
          attachment_mime = $4,

          approved_attachment_path = $2,
          approved_attachment_name = $3,
          approved_attachment_mime = $4
        WHERE id = $1
        `,
        [
          id,
          finalPath,
          finalName,
          finalMime,
          approvedAmount,
          approvedTotal,
          approvedPerMonth,
          approvedTerm,
        ]
      );

      const balanceColumn = loanTypeToBalanceColumn(loan.loan_type);

      const total = approvedTotal;

      if (loan.employee_no && balanceColumn) {
        await ensureBalanceRow(client, loan.employee_no);

       await client.query(
          `
          UPDATE public.staff_balances
          SET
            ${balanceColumn} = $1,
            updated_at = NOW()
          WHERE employee_no = $2
          `,
          [total, loan.employee_no]
        );
      }

      await createLoanApprovedNotification(client, id);

      await client.query("COMMIT");

      return res.json({
        message: "Final signed file uploaded. Loan is now fully approved.",
      });
    } catch (e) {
      try {
        await client.query("ROLLBACK");
      } catch {}

      console.error("FINAL LOAN UPLOAD ERROR:", e);
      return res.status(500).json({
        message: e.message || "Server error",
      });
    } finally {
      client.release();
    }
  }
);

router.put(
  "/loan-requests/:id/void",
  requireAuth,
  async (req, res, next) => {
    if (!canVoidOrDeleteLoan(req)) {
      return res.status(403).json({
        message:
          "Only Admin, IT, HR Department and Accounting Department can void loans.",
      });
    }

    next();
  },
  async (req, res) => {
    const client = await pool.connect();

    try {
      const id = toInt(req.params.id);
      const reason = toStr(req.body?.reason);

      if (!id) {
        return res.status(400).json({
          message: "Invalid loan id",
        });
      }

      await client.query("BEGIN");

      const cur = await client.query(
        `
        SELECT
          id,
          status,
          employee_no,
          approved_total,
          approved_amount,
          total,
          amount,
          loan_type
        FROM public.loan_requests
        WHERE id = $1
        FOR UPDATE
        `,
        [id]
      );

      if (cur.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          message: "Loan not found",
        });
      }

      const loan = cur.rows[0];

      if (norm(loan.status) !== "approved") {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: "Only approved loans can be voided.",
        });
      }

      const balanceColumn = loanTypeToBalanceColumn(loan.loan_type);

      const total = toNum(loan.approved_total);

      if (loan.employee_no && balanceColumn) {
        await ensureBalanceRow(client, loan.employee_no);

        await client.query(
          `
          UPDATE public.staff_balances
          SET
            ${balanceColumn} = GREATEST(COALESCE(${balanceColumn},0) - $1, 0),
            updated_at = NOW()
          WHERE employee_no = $2
          `,
          [total, loan.employee_no]
        );
      }

      await client.query(
        `
        UPDATE public.loan_requests
        SET
          status = 'Voided',
          reason =
            CASE
              WHEN COALESCE(reason,'') = ''
              THEN $2
              ELSE reason || E'\n\n[VOID REASON]\n' || $2
            END
        WHERE id = $1
        `,
        [id, reason || "Loan voided"]
      );

      await client.query("COMMIT");

      return res.json({
        message:
          "Loan successfully voided and removed from staff balances.",
      });
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch {}

      console.error("VOID LOAN ERROR:", err);
      return res.status(500).json({
        message: err.message || "Server error",
      });
    } finally {
      client.release();
    }
  }
);

module.exports = router;