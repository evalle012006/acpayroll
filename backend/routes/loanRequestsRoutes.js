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
  canFinalApprove,
  isIT,
  isBranchManager,
  isAreaManager,
  isRegionalManager,
  isAssistantVicePresident,
  isVicePresident,
  isSeniorVicePresident,
  isPresident,
} = require("../utils/roleAccess");

const toNum = (v) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const toInt = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

const toStr = (v) => String(v ?? "").trim();
const norm = (v) => toStr(v).toLowerCase();
const roleLower = (req) => getRole(req);

const isFinalApprover = (req) => isVicePresident(req) || isSeniorVicePresident(req) || canFinalApprove(req);

const canViewAllLoans = (req) => canViewAll(req);

const canDownloadLoanFiles = (req) =>
  canViewAll(req) ||
  isIT(req) ||
  isBranchManager(req) ||
  isAreaManager(req) ||
  isRegionalManager(req) ||
  isAssistantVicePresident(req) ||
  isVicePresident(req) ||
  isSeniorVicePresident(req) ||
  isPresident(req);

const canFinalUploadLoanFile = (req) => canFinalApprove(req) || isIT(req);

const getUserBranchCode = (req) => toStr(req.user?.branch_id);
const getUserArea = (req) => toStr(req.user?.area);
const getUserRegion = (req) => toStr(req.user?.region);
const getUserDepartment = (req) => toStr(req.user?.department);

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

const BACK_OFFICE_DEPARTMENTS = [
  "it",
  "it department",
  "audit",
  "audit department",
  "hr",
  "hr department",
  "human resources",
  "human resources department",
  "accounting",
  "accounting department",
  "tread",
  "tread department",
  "production & logistic",
  "production & logistic department",
  "production and logistic",
  "production and logistic department",
  "office of the president",
  "main office",
];

const OPERATION_DEPARTMENTS = [
  "operation",
  "operations",
  "operation department",
  "operations department",
  "payroll",
  "payroll department",
];

const isValidLoanPurpose = (purpose) =>
  VALID_LOAN_PURPOSES.map(norm).includes(norm(purpose));

const isBackOfficeDepartment = (department) =>
  BACK_OFFICE_DEPARTMENTS.includes(norm(department));

const isOperationDepartment = (department) =>
  OPERATION_DEPARTMENTS.includes(norm(department));

const getInitialApprovalStage = (applicantRole, department) => {
  if (isBackOfficeDepartment(department)) {
    return "assistant vice president";
  }

  const role = norm(applicantRole);

  if (role === "vice president") return "admin";
  if (role === "assistant vice president") return "vice president";
  if (role === "regional manager") return "assistant vice president";
  if (role === "area manager") return "regional manager";

  return "area manager";
};

const getApprovalChain = (applicantRole, department) => {
  if (isBackOfficeDepartment(department)) {
    return ["assistant vice president"];
  }

  const role = norm(applicantRole);

  if (role === "vice president") return ["vice president"];
  if (role === "assistant vice president") return ["vice president"];

  if (role === "regional manager") {
    return ["assistant vice president", "vice president"];
  }

  if (role === "area manager") {
    return ["regional manager", "assistant vice president", "vice president"];
  }

  return [
    "area manager",
    "regional manager",
    "assistant vice president",
    "vice president",
  ];
};

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
        "position",
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
      s."position",
      s.last_name,
      s.first_name,
      s.middle_name,
      0, 0, 0,
      0, 0, 0, 0, 0,
      0, 0,
      NOW(), NOW()
    FROM public.staff s
    WHERE s.employee_no = $1
    ON CONFLICT (employee_no) DO NOTHING
    `,
    [employeeNo]
  );
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
      COALESCE(s.fullname, '') AS staff_name,
      s.branch_id,
      b.code AS branch_code,
      b.name AS branch_name
    FROM public.loan_requests lr
    LEFT JOIN public.staff s ON s.id = lr.staff_id
    LEFT JOIN public.branches b ON b.id = s.branch_id
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
      `${loan.staff_name || "Employee"}'s ${loan.loan_type || "loan"} has been fully approved.`,
      loan.branch_id ? String(loan.branch_id) : null,
      loan.branch_code || null,
      loan.branch_name || null,
    ]
  );
}

function loanTypeToBalanceColumn(loanType) {
  const lt = norm(loanType);

  if (lt === "salary advance") return "salary_advance";
  if (lt === "special loan" || lt === "special advance") return "special_advance";
  if (lt === "cash loan" || lt === "cash advance") return "cash_advance";
  if (lt === "motorcycle loan") return "motorcycle_loan";
  if (lt === "pag-ibig loan" || lt === "pag ibig loan") return "pag_ibig_loan";

  return null;
}

const uploadDir = path.join(__dirname, "../uploads/loans");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname || ""));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
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
  lr.area_manager_status,
  lr.regional_manager_status,
  lr.assistant_vice_president_status,
  lr.vice_president_status,
  lr.admin_status,

  COALESCE(s.fullname, '') AS staff_name,
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

router.get(
  "/loan-requests",
  requireAuth,
  requirePermission("loan_request", "view"),
  async (req, res) => {
    try {
      let query = "";
      let params = [];

      if (canViewAllLoans(req)) {
        query = `
          SELECT ${loanSelectFields}
          FROM public.loan_requests lr
          LEFT JOIN public.staff s ON s.id = lr.staff_id
          LEFT JOIN public.branches b ON b.id = s.branch_id
          ORDER BY lr.id DESC
        `;
      } else if (isBranchManager(req)) {
        const branchCode = getUserBranchCode(req);
        if (!branchCode) return res.json([]);

        const bid = await getBranchIdFromCode(branchCode);
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
        const area = getUserArea(req);
        if (!area) return res.json([]);

        query = `
          SELECT ${loanSelectFields}
          FROM public.loan_requests lr
          LEFT JOIN public.staff s ON s.id = lr.staff_id
          LEFT JOIN public.branches b ON b.id = s.branch_id
          WHERE LOWER(TRIM(COALESCE(s.area, ''))) = LOWER(TRIM($1))
          ORDER BY lr.id DESC
        `;
        params = [area];
      } else if (isRegionalManager(req)) {
        const region = getUserRegion(req);
        if (!region) return res.json([]);

        query = `
          SELECT ${loanSelectFields}
          FROM public.loan_requests lr
          LEFT JOIN public.staff s ON s.id = lr.staff_id
          LEFT JOIN public.branches b ON b.id = s.branch_id
          WHERE LOWER(TRIM(COALESCE(s.region, ''))) = LOWER(TRIM($1))
          ORDER BY lr.id DESC
        `;
        params = [region];
      } else if (isAssistantVicePresident(req)) {
        query = `
          SELECT ${loanSelectFields}
          FROM public.loan_requests lr
          LEFT JOIN public.staff s ON s.id = lr.staff_id
          LEFT JOIN public.branches b ON b.id = s.branch_id
          WHERE LOWER(TRIM(COALESCE(s.department, ''))) = LOWER(TRIM($1))
             OR LOWER(TRIM(COALESCE(s.division, ''))) = LOWER(TRIM(COALESCE($2, '')))
          ORDER BY lr.id DESC
        `;
        params = [getUserDepartment(req), req.user?.division || ""];
      } else {
        return res.status(403).json({ message: "Access denied" });
      }

      const r = await pool.query(query, params);
      return res.json(r.rows);
    } catch (e) {
      console.error("GET /api/loan-requests ERROR:", e);
      return res.status(500).json({ message: e?.message || "Server error" });
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
        return res.status(400).json({ message: "Invalid staff id" });
      }

      const s = await pool.query(
        `
        SELECT id, branch_id, area, region, department
        FROM public.staff
        WHERE id = $1
        LIMIT 1
        `,
        [staffId]
      );

      if (s.rowCount === 0) {
        return res.status(404).json({ message: "Staff not found" });
      }

      const staffRow = s.rows[0];

      if (!canViewAllLoans(req)) {
        if (isBranchManager(req)) {
          const branchCode = getUserBranchCode(req);
          const bid = await getBranchIdFromCode(branchCode);

          if (!bid || Number(staffRow.branch_id) !== Number(bid)) {
            return res.status(403).json({ message: "Access denied" });
          }
        } else if (isAreaManager(req)) {
          const area = getUserArea(req);

          if (!area || norm(staffRow.area) !== norm(area)) {
            return res.status(403).json({ message: "Access denied" });
          }
        } else if (isRegionalManager(req)) {
          const region = getUserRegion(req);

          if (!region || norm(staffRow.region) !== norm(region)) {
            return res.status(403).json({ message: "Access denied" });
          }
        } else if (isAssistantVicePresident(req)) {
          if (
            getUserDepartment(req) &&
            norm(getUserDepartment(req)) !== norm(staffRow.department)
          ) {
            return res.status(403).json({ message: "Access denied" });
          }
        } else {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const r = await pool.query(
        `
        SELECT ${loanSelectFields}
        FROM public.loan_requests lr
        LEFT JOIN public.staff s ON s.id = lr.staff_id
        LEFT JOIN public.branches b ON b.id = s.branch_id
        WHERE lr.staff_id = $1::int
        ORDER BY lr.id DESC
        `,
        [staffId]
      );

      return res.json(r.rows);
    } catch (e) {
      console.error("GET /api/loan-requests/staff/:staffId ERROR:", e);
      return res.status(500).json({ message: e?.message || "Server error" });
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
      let term = Math.max(1, toInt(req.body?.term) || 1);
      let interest = toNum(req.body?.interest);

      if (norm(loan_type) === "cash advance") {
        amount = 5000;
        term = 1;
        interest = 0;
      }

      const total = amount + (amount * interest) / 100;
      const per_month = term ? total / term : total;

      if (!staff_id) return res.status(400).json({ message: "staff_id is required" });
      if (!loan_type) return res.status(400).json({ message: "loan_type is required" });
      if (!loan_purpose) return res.status(400).json({ message: "loan_purpose is required" });
      if (!isValidLoanPurpose(loan_purpose)) {
        return res.status(400).json({ message: "Invalid loan purpose" });
      }
      if (!amount || amount <= 0) return res.status(400).json({ message: "amount is required" });
      if (!term || term <= 0) return res.status(400).json({ message: "term is required" });
      if (!reason) return res.status(400).json({ message: "reason is required" });
      if (!req.file) return res.status(400).json({ message: "Loan request file is required" });

      await client.query("BEGIN");

      const s = await client.query(
        `
        SELECT id, employee_no, branch_id, area, region, department
        FROM public.staff
        WHERE id = $1::int
        `,
        [staff_id]
      );

      if (s.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Staff not found" });
      }

      const staffRow = s.rows[0];
      const employee_no = staffRow?.employee_no ?? null;

      if (isBranchManager(req)) {
        const branchCode = getUserBranchCode(req);
        const bid = await getBranchIdFromCode(branchCode);

        if (!bid || Number(staffRow.branch_id) !== Number(bid)) {
          await client.query("ROLLBACK");
          return res.status(403).json({ message: "Access denied" });
        }
      }

      if (isAreaManager(req)) {
        const area = getUserArea(req);

        if (!area || norm(staffRow.area) !== norm(area)) {
          await client.query("ROLLBACK");
          return res.status(403).json({ message: "Access denied" });
        }
      }

      if (isRegionalManager(req)) {
        const region = getUserRegion(req);

        if (!region || norm(staffRow.region) !== norm(region)) {
          await client.query("ROLLBACK");
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const applicant_role = roleLower(req);
      const approval_stage = getInitialApprovalStage(
        applicant_role,
        staffRow.department
      );

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
            area_manager_status,
            regional_manager_status,
            assistant_vice_president_status,
            vice_president_status,
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
            $1::int,
            $2::varchar,
            $3::varchar,
            $4::varchar,
            $5::text,
            $6::numeric,
            $7::int,
            $8::numeric,
            $9::numeric,
            $10::numeric,
            'Pending',
            $11::varchar,
            $12::varchar,
            'Pending',
            'Pending',
            'Pending',
            'Pending',
            'Pending',
            NULL,
            NULL,
            $13::text,
            $14::text,
            $15::text,
            NULL,
            NULL,
            NULL
          )
        RETURNING *;
        `,
        [
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

      console.error("POST /api/loan-requests ERROR:", e);
      return res.status(500).json({ message: e?.message || "Server error" });
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
        return res.status(400).json({ message: "Invalid attachment type" });
      }

      const r = await pool.query(
        `
        SELECT
          id,
          status,
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
        return res.status(404).json({ message: "Loan not found" });
      }

      if (!canDownloadLoanFiles(req)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const row = r.rows[0];

      let targetPath = row.attachment_path;
      let targetName = row.attachment_name;

      if (type === "approved" || type === "latest") {
        targetPath = row.approved_attachment_path || row.attachment_path;
        targetName = row.approved_attachment_name || row.attachment_name;
      }

      if (type === "request") {
        targetPath = row.attachment_path;
        targetName = row.attachment_name;
      }

      if (!targetPath) {
        return res.status(404).json({ message: "No loan file found" });
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
        console.error("Loan file not found. Tried paths:", possiblePaths);
        return res.status(404).json({
          message: "Loan file not found",
          saved_path: targetPath,
        });
      }

      return res.download(filePath, targetName || path.basename(filePath));
    } catch (e) {
      console.error("GET /api/loan-requests/:id/download/:type ERROR:", e);
      return res.status(500).json({ message: e?.message || "Server error" });
    }
  }
);

router.put(
  "/loan-requests/:id",
  requireAuth,
  requirePermission("loan_request", "approve"),
  upload.single("attachment"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const id = toInt(req.params.id);
      const action = norm(req.body?.action);

      if (!id) return res.status(400).json({ message: "Invalid id" });
      if (!["approve", "reject"].includes(action)) {
        return res.status(400).json({ message: "Invalid action" });
      }

      if (action === "approve" && !req.file) {
        return res.status(400).json({
          message:
            "Please upload the signed/approved loan file before approving. This file will replace the previous file for the next approver.",
        });
      }

      const role = roleLower(req);

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

      if (loan.status === "Approved" || loan.status === "Rejected") {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Already finalized" });
      }

      const staffInfo = await client.query(
        `
        SELECT department
        FROM public.staff
        WHERE id = $1
        LIMIT 1
        `,
        [loan.staff_id]
      );

      const department = staffInfo.rows[0]?.department || "";
      const applicantRole = toStr(loan.applicant_role);
      const chain = getApprovalChain(applicantRole, department);

      let currentStage = norm(loan.approval_stage);

      if (!chain.includes(currentStage)) {
        currentStage = chain[0] || "admin";
      }

      const canAct =
        currentStage === "admin" ? isFinalApprover(req) : role === currentStage;

      const highLevelOverride = isIT(req) || norm(role) === "admin";

      if (!canAct && !highLevelOverride) {
        await client.query("ROLLBACK");
        return res.status(403).json({ message: "Not your approval stage" });
      }

      const effectiveRole = currentStage === "admin" ? "admin" : currentStage;

      const statusColumnMap = {
        "area manager": "area_manager_status",
        "regional manager": "regional_manager_status",
        "assistant vice president": "assistant_vice_president_status",
        "vice president": "vice_president_status",
        admin: "admin_status",
      };

      const column = statusColumnMap[effectiveRole];

      if (!column) {
        await client.query("ROLLBACK");
        return res.status(403).json({ message: "Access denied" });
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
        return res.json({ message: "Rejected successfully" });
      }

      const latestPath = `/uploads/loans/${req.file.filename}`;
      const latestName = req.file.originalname || null;
      const latestMime = req.file.mimetype || null;

      const currentIndex = chain.indexOf(effectiveRole);
      const nextStage = chain[currentIndex + 1];

      if (!nextStage) {
        await client.query(
          `
          UPDATE public.loan_requests
          SET
            status = 'Approved',
            ${column} = 'Approved',
            approved_at = CURRENT_DATE,
            disbursement_date = CURRENT_DATE,

            attachment_path = $2,
            attachment_name = $3,
            attachment_mime = $4,

            approved_attachment_path = $2,
            approved_attachment_name = $3,
            approved_attachment_mime = $4
          WHERE id = $1
          `,
          [id, latestPath, latestName, latestMime]
        );

        const employeeNo = loan.employee_no;
        const total = toNum(loan.total) || toNum(loan.amount);
        const balanceColumn = loanTypeToBalanceColumn(loan.loan_type);

        if (employeeNo && balanceColumn) {
          await ensureBalanceRow(client, employeeNo);

          await client.query(
            `
            UPDATE public.staff_balances
            SET ${balanceColumn} = COALESCE(${balanceColumn}, 0) + $1,
                updated_at = NOW()
            WHERE employee_no = $2
            `,
            [total, employeeNo]
          );
        }

        await createLoanApprovedNotification(client, id);

        await client.query("COMMIT");
        return res.json({
          message: "Fully Approved. Final file is now available to staff.",
        });
      }

      await client.query(
        `
        UPDATE public.loan_requests
        SET
          ${column} = 'Approved',
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
        message: `Approved and uploaded signed file. Moved to ${nextStage}.`,
      });
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch {}

      console.error("Loan approval chain error:", err);
      return res.status(500).json({ message: err.message });
    } finally {
      client.release();
    }
  }
);

router.post(
  "/loan-requests/:id/approved-file",
  requireAuth,
  requirePermission("loan_request", "upload_approved"),
  upload.single("attachment"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const id = toInt(req.params.id);

      if (!id) return res.status(400).json({ message: "Invalid id" });
      if (!req.file) {
        return res.status(400).json({ message: "Attachment is required" });
      }

      if (!canFinalUploadLoanFile(req)) {
        return res.status(403).json({
          message:
            "Only HR, IT, Admin, and Accounting can upload final approved files",
        });
      }

      await client.query("BEGIN");

      const cur = await client.query(
        `
        SELECT id, status
        FROM public.loan_requests
        WHERE id = $1
        LIMIT 1
        `,
        [id]
      );

      if (cur.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Loan not found" });
      }

      if (toStr(cur.rows[0].status) !== "Approved") {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: "Final signed file can only be uploaded after final approval",
        });
      }

      const finalPath = `/uploads/loans/${req.file.filename}`;
      const finalName = req.file.originalname || null;
      const finalMime = req.file.mimetype || null;

      await client.query(
        `
        UPDATE public.loan_requests
        SET
          attachment_path = $2,
          attachment_name = $3,
          attachment_mime = $4,
          approved_attachment_path = $2,
          approved_attachment_name = $3,
          approved_attachment_mime = $4
        WHERE id = $1
        `,
        [id, finalPath, finalName, finalMime]
      );

      await client.query("COMMIT");
      return res.json({ message: "Final signed file uploaded successfully" });
    } catch (e) {
      try {
        await client.query("ROLLBACK");
      } catch {}

      console.error("POST /api/loan-requests/:id/approved-file ERROR:", e);
      return res.status(500).json({ message: e?.message || "Server error" });
    } finally {
      client.release();
    }
  }
);

/* =========================================================
   VOID LOAN
========================================================= */

router.put(
  "/loan-requests/:id/void",

  requireAuth,

  async (req, res, next) => {
    if (!isIT(req) && !canViewAll(req)) {
      return res.status(403).json({
        message:
          "Only Admin and IT can void loans",
      });
    }

    next();
  },
  async (req, res) => {
    const client =
      await pool.connect();

    try {
      const id = toInt(
        req.params.id
      );

      const reason =
        toStr(
          req.body?.reason
        );

      if (!id) {
        return res.status(400).json({
          message:
            "Invalid loan id",
        });
      }

      await client.query(
        "BEGIN"
      );

      const cur =
        await client.query(
          `
          SELECT
            id,
            status,
            employee_no,
            total,
            amount,
            loan_type

          FROM public.loan_requests

          WHERE id = $1

          FOR UPDATE
          `,
          [id]
        );

      if (
        cur.rowCount === 0
      ) {
        await client.query(
          "ROLLBACK"
        );

        return res.status(404).json({
          message:
            "Loan not found",
        });
      }

      const loan =
        cur.rows[0];

      if (
        norm(
          loan.status
        ) !== "approved"
      ) {
        await client.query(
          "ROLLBACK"
        );

        return res.status(400).json({
          message:
            "Only approved loans can be voided",
        });
      }

      const balanceColumn =
        loanTypeToBalanceColumn(
          loan.loan_type
        );

      const total =
        toNum(
          loan.total
        ) ||
        toNum(
          loan.amount
        );

      /*
        REVERSE STAFF BALANCE
      */

      if (
        loan.employee_no &&
        balanceColumn
      ) {
        await ensureBalanceRow(
          client,
          loan.employee_no
        );

        await client.query(
          `
          UPDATE public.staff_balances

          SET
            ${balanceColumn} =
              GREATEST(
                COALESCE(${balanceColumn}, 0) - $1,
                0
              ),

            updated_at =
              NOW()

          WHERE employee_no = $2
          `,
          [
            total,
            loan.employee_no,
          ]
        );
      }

      /*
        VOID LOAN
      */

      await client.query(
        `
        UPDATE public.loan_requests

        SET
          status = 'Voided',

          reason =
            CASE
              WHEN COALESCE(reason, '') = ''
              THEN $2
              ELSE reason || E'\n\n[VOID REASON]\n' || $2
            END

        WHERE id = $1
        `,
        [
          id,
          reason ||
            "Loan voided",
        ]
      );

      await client.query(
        "COMMIT"
      );

      return res.json({
        message:
          "Loan successfully voided and removed from staff balances",
      });
    } catch (err) {
      try {
        await client.query(
          "ROLLBACK"
        );
      } catch {}

      console.error(
        "VOID LOAN ERROR:",
        err
      );

      return res.status(500).json({
        message:
          err.message ||
          "Server error",
      });
    } finally {
      client.release();
    }
  }
);

module.exports = router;