const express = require("express");
const router = express.Router();
const db = require("../db");

const { requireAuth } = require("../middlewares/authMiddleware");
const { requirePermission } = require("../middlewares/permissionMiddleware");

const {
  uploadToTemp,
  moveFromTempKeepExisting,
  getSignedDownloadUrl,
} = require("../services/spacesUpload");

const clean = (v) => String(v ?? "").trim();
const norm = (v) => clean(v).toLowerCase();

const toNum = (v) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const ACCOUNTING_FINAL = "Accounting Department";

const getUserRole = (req) => norm(req.user?.role);
const getUserDepartment = (req) =>
  norm(req.user?.department || req.user?.department_name);

const isAdmin = (req) => getUserRole(req) === "admin";
const isAccounting = (req) =>
  getUserRole(req) === "accounting" ||
  getUserDepartment(req) === "accounting department";
const isHR = (req) =>
  getUserRole(req) === "hr" || getUserDepartment(req) === "hr department";

const isIT = (req) =>
  getUserRole(req) === "it";

const isSVP = (req) => getUserRole(req) === "senior vice president";

const canBypassApproval = (req) =>
  isAdmin(req) || isIT(req) || isAccounting(req) || isHR(req) || isSVP(req);

const canVoid = (req) => isAdmin(req) || isAccounting(req) || isHR(req);
const canDelete = canVoid;

const isOperationDepartment = (department) => {
  const d = norm(department);
  return (
    d === "operation department" ||
    d === "operations department" ||
    d === "operation" ||
    d === "operations"
  );
};

const isAuditDepartment = (department) => norm(department) === "audit department";

const isBackOfficeDepartment = (department) => {
  const d = norm(department);
  return [
    "it department",
    "hr department",
    "accounting department",
    "tread department",
    "office of the president",
    "production and logistic department",
    "production & logistic department",
  ].includes(d);
};

const hasRole = (position, roleName) => norm(position).includes(norm(roleName));

const isBranchManagerPos = (position) =>
  hasRole(position, "branch manager") || hasRole(position, "acting branch manager");

const isAreaManagerPos = (position) =>
  hasRole(position, "area manager") || hasRole(position, "acting area manager");

const isRegionalManagerPos = (position) =>
  hasRole(position, "regional manager") ||
  hasRole(position, "acting regional manager");

const isAVPPos = (position) => {
  const value = norm(position);

  return (
    value === "assistant vice president" ||
    value === "acting assistant vice president" ||
    value.includes("assistant vice president")
  );
};

const isSVPPos = (position) => {
  const value = norm(position);

  return (
    value === "senior vice president" ||
    value === "acting senior vice president" ||
    value.includes("senior vice president")
  );
};

const isVPPos = (position) => {
  const value = norm(position);

  return (
    value.includes("vice president") &&
    !value.includes("assistant vice president") &&
    !value.includes("senior vice president")
  );
};

const uniq = (arr) => {
  const out = [];
  for (const x of arr) {
    if (x && !out.some((y) => norm(y) === norm(x))) out.push(x);
  }
  return out;
};

const getRawApprovalChain = (department, position) => {
  const dept = norm(department);
  const pos = norm(position);

  if (isOperationDepartment(dept)) {
    // =====================================================
    // OPERATION DEPARTMENT CBU WITHDRAWAL
    //
    // LO / BM:
    // AM -> RM -> AVP -> VP FINAL
    //
    // AM to SVP:
    // continues to Accounting Department FINAL
    // =====================================================

    // Senior Vice President applicant
    // -> Accounting final only
    if (isSVPPos(pos)) {
      return [
        ACCOUNTING_FINAL,
      ];
    }

    // Vice President applicant
    // -> SVP -> Accounting final
    if (isVPPos(pos)) {
      return [
        "Senior Vice President",
        ACCOUNTING_FINAL,
      ];
    }

    // Assistant Vice President applicant
    // -> VP -> Accounting final
    if (isAVPPos(pos)) {
      return [
        "Vice President",
        ACCOUNTING_FINAL,
      ];
    }

    // Regional Manager applicant
    // -> AVP -> VP -> Accounting final
    if (isRegionalManagerPos(pos)) {
      return [
        "Assistant Vice President",
        "Vice President",
        ACCOUNTING_FINAL,
      ];
    }

    // Area Manager applicant
    // -> RM -> AVP -> VP -> Accounting final
    if (isAreaManagerPos(pos)) {
      return [
        "Regional Manager",
        "Assistant Vice President",
        "Vice President",
        ACCOUNTING_FINAL,
      ];
    }

    // Branch Manager applicant
    // -> AM -> RM -> AVP -> VP FINAL
    if (isBranchManagerPos(pos)) {
      return [
        "Area Manager",
        "Regional Manager",
        "Assistant Vice President",
        "Vice President",
      ];
    }

    // Loan Officer / other Operation staff
    // -> AM -> RM -> AVP -> VP FINAL
    return [
      "Area Manager",
      "Regional Manager",
      "Assistant Vice President",
      "Vice President",
    ];
  }

  if (isAuditDepartment(dept)) {
    if (isSVPPos(pos)) return [ACCOUNTING_FINAL];
    if (isVPPos(pos)) return ["Senior Vice President", ACCOUNTING_FINAL];
    if (isAVPPos(pos)) {
      return ["Vice President", "Senior Vice President", ACCOUNTING_FINAL];
    }

    return [
      "Assistant Vice President",
      "Vice President",
      "Senior Vice President",
      ACCOUNTING_FINAL,
    ];
  }

  if (isBackOfficeDepartment(dept)) {
    // Senior Vice President applicant
    // -> Accounting final
    if (isSVPPos(pos)) {
      return [
        ACCOUNTING_FINAL,
      ];
    }

    // Vice President applicant
    // -> SVP -> Accounting
    if (isVPPos(pos)) {
      return [
        "Senior Vice President",
        ACCOUNTING_FINAL,
      ];
    }

    // Assistant Vice President applicant
    // -> SVP -> Accounting
    if (isAVPPos(pos)) {
      return [
        "Senior Vice President",
        ACCOUNTING_FINAL,
      ];
    }

    // Regional Manager applicant
    // -> AVP -> SVP -> Accounting
    if (isRegionalManagerPos(pos)) {
      return [
        "Assistant Vice President",
        "Senior Vice President",
        ACCOUNTING_FINAL,
      ];
    }

    // Branch Manager / other Back Office staff
    // -> RM -> AVP -> SVP -> Accounting
    return [
      "Regional Manager",
      "Assistant Vice President",
      "Senior Vice President",
      ACCOUNTING_FINAL,
    ];
  }

  return [
    "Branch Manager",
    "Area Manager",
    "Regional Manager",
    "Assistant Vice President",
    "Vice President",
    "Senior Vice President",
    ACCOUNTING_FINAL,
  ];
};

const stageColumn = (stage) => {
  const s = norm(stage);

  if (s === "branch manager") return "branch_manager_status";
  if (s === "area manager") return "area_manager_status";
  if (s === "regional manager") return "regional_manager_status";
  if (s === "assistant vice president") return "avp_status";
  if (s === "vice president") return "vp_status";
  if (s === "senior vice president") return "svp_status";
  if (s === norm(ACCOUNTING_FINAL)) return "final_status";

  return null;
};

const stageApprovedAtColumn = (stage) => {
  const s = norm(stage);

  if (s === "branch manager") return "branch_manager_approved_at";
  if (s === "area manager") return "area_manager_approved_at";
  if (s === "regional manager") return "regional_manager_approved_at";
  if (s === "assistant vice president") return "avp_approved_at";
  if (s === "vice president") return "vp_approved_at";
  if (s === "senior vice president") return "svp_approved_at";
  if (s === norm(ACCOUNTING_FINAL)) return "accounting_approved_at";

  return null;
};

const userHasDepartmentScope = (req, department) => {
  const target = norm(department);

  if (!target) {
    return false;
  }

  const primaryDepartment = norm(
    req.user?.department ||
    req.user?.department_name
  );

  if (primaryDepartment === target) {
    return true;
  }

  const scopes = Array.isArray(req.user?.department_scopes)
    ? req.user.department_scopes
    : [];

  return scopes.some(
    (scope) => norm(scope) === target
  );
};

const roleMatchesStage = (req, stage) => {
  const role = getUserRole(req);
  const dept = getUserDepartment(req);
  const s = norm(stage);

  if (s === "branch manager") return role === "branch manager";
  if (s === "area manager") return role === "area manager";
  if (s === "regional manager") return role === "regional manager";
  if (s === "assistant vice president") return role === "assistant vice president";
  if (s === "vice president") return role === "vice president";
  if (s === "senior vice president") return role === "senior vice president";
  if (s === norm(ACCOUNTING_FINAL)) {
    return role === "accounting" || dept === "accounting department";
  }

  return false;
};

const canApproveCurrentStage = (req, stage, staff = null) => {
  // Accounting final remains Accounting only
  if (norm(stage) === norm(ACCOUNTING_FINAL)) {
    return roleMatchesStage(req, stage);
  }

  // Existing bypass users keep their bypass capability
  if (canBypassApproval(req)) {
    return true;
  }

  // Role must match the current stage first
  if (!roleMatchesStage(req, stage)) {
    return false;
  }

  // For Back Office / Audit requests,
  // approver must also belong to the request department
  // either as primary department or approval scope.
  if (
    staff &&
    (
      isBackOfficeDepartment(staff.department) ||
      isAuditDepartment(staff.department)
    )
  ) {
    return userHasDepartmentScope(
      req,
      staff.department
    );
  }

  return true;
};

async function getUserColumns(client) {
  const table = await client.query(`
    SELECT to_regclass('public.users') AS users_table
  `);

  if (!table.rows[0]?.users_table) return [];

  const cols = await client.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
  `);

  return cols.rows.map((r) => r.column_name);
}

async function hasApproverAccount(client, stage, staff) {
  if (norm(stage) === norm(ACCOUNTING_FINAL)) {
    return true;
  }

  const stageRole = norm(stage);
  const staffDepartment = norm(staff.department);

  try {
    // =====================================================
    // OPERATION DEPARTMENT
    // Keep geographic approval scoping:
    // Branch -> Area -> Region -> Division -> Department
    // =====================================================
    if (isOperationDepartment(staff.department)) {
      const params = [stageRole];

      const where = [
        `LOWER(TRIM(COALESCE(u.role, ''))) = $1`,
        `LOWER(TRIM(COALESCE(u.status, 'active'))) <> 'inactive'`,
      ];

      if (stageRole === "branch manager") {
        params.push(staff.branch_id || null);
        where.push(`u.branch_id = $${params.length}`);
      }

      if (stageRole === "area manager") {
        params.push(norm(staff.area));
        where.push(
          `LOWER(TRIM(COALESCE(u.area, ''))) = $${params.length}`
        );
      }

      if (stageRole === "regional manager") {
        params.push(norm(staff.region));
        where.push(
          `LOWER(TRIM(COALESCE(u.region, ''))) = $${params.length}`
        );
      }

      if (stageRole === "assistant vice president") {
        params.push(norm(staff.division));
        where.push(
          `LOWER(TRIM(COALESCE(u.division, ''))) = $${params.length}`
        );
      }

      if (stageRole === "vice president") {
        where.push(`
          LOWER(TRIM(COALESCE(u.department, ''))) IN (
            'operation department',
            'operations department',
            'operation',
            'operations'
          )
        `);
      }

      const r = await client.query(
        `
        SELECT u.id
        FROM public.users u
        WHERE ${where.join(" AND ")}
        LIMIT 1
        `,
        params
      );

      return r.rowCount > 0;
    }

    // =====================================================
    // BACK OFFICE / AUDIT
    //
    // An approver is valid when:
    //
    // 1. Their PRIMARY department matches
    // OR
    // 2. user_department_scopes contains the department
    //
    // Example:
    // Helen = TREAD Department AVP
    // Scope = IT Department
    // Therefore Helen can approve IT requests.
    // =====================================================

    const r = await client.query(
      `
      SELECT DISTINCT u.id
      FROM public.users u

      LEFT JOIN public.user_department_scopes uds
        ON uds.user_id = u.id

      WHERE
        LOWER(TRIM(COALESCE(u.role, ''))) = $1

        AND LOWER(
          TRIM(COALESCE(u.status, 'active'))
        ) <> 'inactive'

        AND (
          LOWER(TRIM(COALESCE(u.department, ''))) = $2

          OR

          LOWER(TRIM(COALESCE(uds.department, ''))) = $2
        )

      LIMIT 1
      `,
      [
        stageRole,
        staffDepartment,
      ]
    );

    return r.rowCount > 0;
  } catch (err) {
    console.error(
      "hasApproverAccount ERROR:",
      {
        stage,
        staffDepartment,
        message: err.message,
      }
    );

    return false;
  }
}

async function getApprovalChain(client, staff) {
  const raw = uniq(getRawApprovalChain(staff.department, staff.position));
  const final = [];

  for (const stage of raw) {
    if (norm(stage) === norm(ACCOUNTING_FINAL)) {
      final.push(stage);
      continue;
    }

    const exists = await hasApproverAccount(client, stage, staff);
    if (exists) final.push(stage);
  }

  return final.length ? final : [ACCOUNTING_FINAL];
}

const chainText = (chain) => chain.join(" → ");

async function getInitialStage(client, staff) {
  const chain = await getApprovalChain(client, staff);
  return chain[0] || ACCOUNTING_FINAL;
}

async function getNextStage(client, staff, currentStage) {
  const chain = await getApprovalChain(client, staff);
  const idx = chain.findIndex((x) => norm(x) === norm(currentStage));

  if (idx < 0) return chain[0] || ACCOUNTING_FINAL;
  if (idx >= chain.length - 1) return "Approved";

  return chain[idx + 1];
}

async function getStaffById(employeeId, client = db) {
  const r = await client.query(
    `
    SELECT
      s.id,
      s.employee_no,
      s.department,
      s.position,
      s.branch_id,
      s.area,
      s.region,
      s.division
    FROM public.staff s
    WHERE s.id = $1
    LIMIT 1
    `,
    [employeeId]
  );

  return r.rows[0] || null;
}

async function finalizeCbuWithdrawal({ client, row, staff, fileKey, fileName }) {
  const employeeNo = clean(staff.employee_no);
  const amount = toNum(row.amount);

  const balance = await client.query(
    `
    SELECT id, COALESCE(cbu, 0) AS cbu
    FROM public.staff_balances
    WHERE employee_no = $1
    FOR UPDATE
    `,
    [employeeNo]
  );

  if (balance.rowCount === 0) {
    return {
      errorStatus: 404,
      error: { message: "Balance not found" },
    };
  }

  const currentCbu = toNum(balance.rows[0].cbu);

  if (currentCbu < amount) {
    return {
      errorStatus: 400,
      error: {
        message: `Insufficient CBU balance. Current balance is ${currentCbu}.`,
      },
    };
  }

  await client.query(
    `
    UPDATE public.staff_balances
    SET cbu = COALESCE(cbu, 0) - $1::numeric,
        updated_at = NOW()
    WHERE employee_no = $2
    `,
    [amount, employeeNo]
  );

  const result = await client.query(
    `
    UPDATE public.cbu_withdrawals
    SET
        status = 'Approved',
        approval_stage = 'Approved',
        approved_at = NOW(),

        approved_attachment_path = $1,
        approved_attachment_name = $2,

        final_status = 'Approved',
        accounting_approved_at = NOW(),

        updated_at = NOW()
    WHERE id = $3
    RETURNING *
    `,
    [fileKey, fileName, row.id]
  );

  return { data: result.rows[0] };
}

router.get(
  "/cbu-withdrawals",
  requireAuth,
  requirePermission("cbu_withdrawal", "view"),
  async (req, res) => {
    try {
      const params = [];
      let where = "";

      const role = getUserRole(req);
      const dept = getUserDepartment(req);

      if (
        role === "president" ||
        isAdmin(req) ||
        isIT(req) ||
        isHR(req) ||
        isAccounting(req)
      ) {
        where = "";
      } else if (isOperationDepartment(dept)) {
        if (role === "branch manager") {
          params.push(req.user?.branch_id || null);

          where = `
            WHERE LOWER(TRIM(COALESCE(b.code, ''))) =
                  LOWER(TRIM($${params.length}))
          `;
        } else if (role === "area manager") {
          params.push(norm(req.user?.area));
          where = `WHERE LOWER(TRIM(COALESCE(s.area, ''))) = $${params.length}`;
        } else if (role === "regional manager") {
          params.push(norm(req.user?.region));
          where = `WHERE LOWER(TRIM(COALESCE(s.region, ''))) = $${params.length}`;
        } else if (role === "assistant vice president") {
          params.push(norm(req.user?.division));
          where = `WHERE LOWER(TRIM(COALESCE(s.division, ''))) = $${params.length}`;
        } else if (role === "vice president") {
          where = `
            WHERE LOWER(TRIM(COALESCE(s.department, ''))) IN
              ('operation department', 'operations department', 'operation', 'operations')
          `;
        }
      }

      const result = await db.query(
        `
        SELECT
          cw.*,
          s.employee_no,
          s.department,
          s.position,
          s.area,
          s.region,
          s.division,
          s.position AS staff_role,
          COALESCE(
            NULLIF(TRIM(s.fullname), ''),
            CONCAT_WS(' ', s.first_name, s.middle_name, s.last_name),
            '-'
          ) AS fullname,
          b.code AS branch_code,
          b.name AS branch_name,
          COALESCE(sb.cbu, 0) AS cbu_balance
        FROM public.cbu_withdrawals cw
        LEFT JOIN public.staff s ON s.id = cw.employee_id
        LEFT JOIN public.branches b ON b.id = s.branch_id
        LEFT JOIN public.staff_balances sb ON sb.employee_no = s.employee_no
        ${where}
        ORDER BY cw.id DESC
        `,
        params
      );

      return res.json(result.rows);
    } catch (err) {
      console.error("GET CBU ERROR:", err.message);
      return res.status(500).json({ message: err.message });
    }
  }
);

router.post(
  "/cbu-withdrawals",
  requireAuth,
  requirePermission("cbu_withdrawal", "create"),
  uploadToTemp,
  async (req, res) => {
    const client = await db.connect();

    try {
      const employeeId = toNum(req.body?.employee_id);
      const amount = toNum(req.body?.amount);
      const reason = clean(req.body?.reason);
      const disbursementDate = clean(req.body?.disbursement_date) || null;

      if (!employeeId) return res.status(400).json({ message: "Employee is required" });
      if (!amount || amount <= 0) {
        return res.status(400).json({ message: "Valid amount is required" });
      }
      if (!reason) return res.status(400).json({ message: "Reason is required" });
      if (!req.file?.key) {
        return res.status(400).json({ message: "Request file is required" });
      }

      await client.query("BEGIN");

      const staff = await getStaffById(employeeId, client);
      if (!staff) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Staff record not found" });
      }

      const employeeNo = clean(staff.employee_no);
      const chain = await getApprovalChain(client, staff);
      const startStage = chain[0] || ACCOUNTING_FINAL;

      const balanceRes = await client.query(
        `
        SELECT COALESCE(cbu, 0) AS cbu
        FROM public.staff_balances
        WHERE employee_no = $1
        LIMIT 1
        `,
        [employeeNo]
      );

      if (balanceRes.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Balance not found" });
      }

      if (toNum(balanceRes.rows[0].cbu) < amount) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: `Insufficient CBU balance. Current balance is ${balanceRes.rows[0].cbu}.`,
        });
      }

      const attachmentPath = await moveFromTempKeepExisting(
        req.file.key,
        "cbu-withdrawals/request",
        String(employeeId),
        req.file.originalname || "request-file"
      );
      const attachmentName = req.file.originalname || null;

      const result = await client.query(
        `
        INSERT INTO public.cbu_withdrawals (
          employee_id,
          amount,
          reason,
          status,
          approval_stage,
          disbursement_date,
          attachment_path,
          attachment_name,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, 'Pending', $4, $5, $6, $7, NOW(), NOW())
        RETURNING *
        `,
        [
          employeeId,
          amount,
          reason,
          startStage,
          disbursementDate,
          attachmentPath,
          attachmentName,
        ]
      );

      await client.query("COMMIT");

      return res.status(201).json({
        ...result.rows[0],
        approval_chain: chainText(chain),
      });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("CREATE CBU ERROR:", err.message);
      return res.status(500).json({ message: err.message });
    } finally {
      client.release();
    }
  }
);

router.get(
  "/cbu-withdrawals/:id/download/:type",
  requireAuth,
  requirePermission("cbu_withdrawal", "view"),
  async (req, res) => {
    try {
      const id = toNum(req.params.id);
      const type = norm(req.params.type);

      if (!id) return res.status(400).json({ message: "Invalid withdrawal id" });

      if (!["request", "approved", "latest"].includes(type)) {
        return res.status(400).json({ message: "Invalid file type" });
      }

      const result = await db.query(
        `
        SELECT attachment_path, approved_attachment_path
        FROM public.cbu_withdrawals
        WHERE id = $1
        `,
        [id]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ message: "CBU withdrawal not found" });
      }

      const row = result.rows[0];
      let key = row.attachment_path;

      if (type === "approved" || type === "latest") {
        key = row.approved_attachment_path || row.attachment_path;
      }

      if (type === "request") key = row.attachment_path;

      if (!key) return res.status(404).json({ message: "File not found" });

      const url = await getSignedDownloadUrl(key);
      return res.json({ url });
    } catch (err) {
      console.error("DOWNLOAD CBU FILE ERROR:", err.message);
      return res.status(500).json({ message: err.message });
    }
  }
);

router.put(
  "/cbu-withdrawals/:id",
  requireAuth,
  requirePermission("cbu_withdrawal", "approve"),
  uploadToTemp,
  async (req, res) => {
    const client = await db.connect();

    try {
      const id = toNum(req.params.id);
      const rawStatus = clean(req.body?.status || req.body?.action);

      const status =
        norm(rawStatus) === "approved" || norm(rawStatus) === "approve"
          ? "Approved"
          : norm(rawStatus) === "rejected" || norm(rawStatus) === "reject"
          ? "Rejected"
          : norm(rawStatus) === "void"
          ? "Void"
          : rawStatus;

      const rejectionReason = clean(req.body?.rejection_reason);

      if (!id) return res.status(400).json({ message: "Invalid withdrawal id" });

      if (!["Approved", "Rejected", "Void"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }

      if (status === "Rejected" && !rejectionReason) {
        return res.status(400).json({ message: "Rejection reason is required" });
      }

      if (status === "Approved" && !req.file?.key) {
        return res.status(400).json({
          message: "Please upload the signed/approved CBU file before approving.",
        });
      }

      await client.query("BEGIN");

      const current = await client.query(
        `
        SELECT *
        FROM public.cbu_withdrawals
        WHERE id = $1
        FOR UPDATE
        `,
        [id]
      );

      if (current.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "CBU withdrawal not found" });
      }

      const row = current.rows[0];
      const staff = await getStaffById(row.employee_id, client);

      if (!staff) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Staff record not found" });
      }

      if (["rejected", "void"].includes(norm(row.status))) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: `This withdrawal is already ${norm(row.status)}.`,
        });
      }

      if (status === "Void") {
        if (!canVoid(req)) {
          await client.query("ROLLBACK");
          return res.status(403).json({
            message:
              "Only Admin, HR Department, or Accounting Department can void CBU withdrawal.",
          });
        }

        if (norm(row.status) === "approved") {
          await client.query(
            `
            UPDATE public.staff_balances
            SET
              cbu = COALESCE(cbu, 0) + $1::numeric,
              updated_at = NOW()
            WHERE employee_no = $2
            `,
            [toNum(row.amount), staff.employee_no]
          );
        }

        await client.query(
          `
          UPDATE public.cbu_withdrawals
          SET
            status = 'Void',
            approval_stage = 'Void',
            updated_at = NOW()
          WHERE id = $1
          `,
          [id]
        );

        await client.query("COMMIT");

        return res.json({
          message: "CBU withdrawal voided successfully.",
        });
      }

      let currentStage =
        clean(row.approval_stage) ||
        (await getInitialStage(client, staff));

      const currentStageHasActiveApprover =
        await hasApproverAccount(
          client,
          currentStage,
          staff
        );

      if (!currentStageHasActiveApprover) {
        const rawChain = uniq(
          getRawApprovalChain(
            staff.department,
            staff.position
          )
        );

        const activeChain = await getApprovalChain(
          client,
          staff
        );

        const currentIndex = rawChain.findIndex(
          (stage) =>
            norm(stage) === norm(currentStage)
        );

        const nextActiveStage = activeChain.find(
          (stage) => {
            const stageIndex = rawChain.findIndex(
              (rawStage) =>
                norm(rawStage) === norm(stage)
            );

            return stageIndex > currentIndex;
          }
        );

        currentStage =
          nextActiveStage ||
          activeChain[0] ||
          ACCOUNTING_FINAL;

        await client.query(
          `
          UPDATE public.cbu_withdrawals
          SET
            approval_stage = $2,
            updated_at = NOW()
          WHERE id = $1
          `,
          [id, currentStage]
        );
      }

      const col = stageColumn(currentStage);
      const approvedAtCol = stageApprovedAtColumn(currentStage);

      if (!canApproveCurrentStage(req, currentStage, staff)) {
        await client.query("ROLLBACK");
        return res.status(403).json({ message: "Not your approval stage" });
      }

      if (status === "Rejected") {
        const updateSql = col
          ? `
            UPDATE public.cbu_withdrawals
            SET ${col} = 'Rejected',
                status = 'Rejected',
                rejection_reason = $1,
                rejected_at = NOW(),
                updated_at = NOW()
            WHERE id = $2
            RETURNING *
          `
          : `
            UPDATE public.cbu_withdrawals
            SET status = 'Rejected',
                rejection_reason = $1,
                rejected_at = NOW(),
                updated_at = NOW()
            WHERE id = $2
            RETURNING *
          `;

        const rejected = await client.query(updateSql, [rejectionReason, id]);

        await client.query("COMMIT");
        return res.json({
          message: "CBU withdrawal rejected successfully.",
          data: rejected.rows[0],
        });
      }

      const latestFileKey = await moveFromTempKeepExisting(
        req.file.key,
        "cbu-withdrawals/latest",
        String(id),
        req.file.originalname || "signed-cbu-file"
      );

      const latestFileName = req.file.originalname || null;

      if (norm(currentStage) === norm(ACCOUNTING_FINAL)) {
        const finalized = await finalizeCbuWithdrawal({
          client,
          row,
          staff,
          fileKey: latestFileKey,
          fileName: latestFileName,
        });

        if (finalized.error) {
          await client.query("ROLLBACK");
          return res.status(finalized.errorStatus).json(finalized.error);
        }

        await client.query("COMMIT");

        return res.json({
          message: "Accounting final approval completed. CBU balance deducted.",
          data: finalized.data,
        });
      }

      if (col) {
        await client.query(
          `
          UPDATE public.cbu_withdrawals
          SET
            ${col} = 'Approved',
            ${approvedAtCol} = NOW(),
            updated_at = NOW()
          WHERE id = $1
          `,
          [id]
        );
      }

      const next = await getNextStage(client, staff, currentStage);

      if (norm(next) === "approved") {
        const finalized = await finalizeCbuWithdrawal({
          client,
          row,
          staff,
          fileKey: latestFileKey,
          fileName: latestFileName,
        });

        if (finalized.error) {
          await client.query("ROLLBACK");
          return res.status(finalized.errorStatus).json(finalized.error);
        }

        await client.query("COMMIT");

        return res.json({
          message: "CBU withdrawal fully approved. CBU balance deducted.",
          data: finalized.data,
        });
      }

      const updated = await client.query(
        `
        UPDATE public.cbu_withdrawals
        SET
          status = 'Pending',
          approval_stage = $1,

          approved_attachment_path = $2,
          approved_attachment_name = $3,

          updated_at = NOW()

        WHERE id = $4

        RETURNING *
        `,
        [
          next,
          latestFileKey,
          latestFileName,
          id,
        ]
      );

      await client.query("COMMIT");

      return res.json({
        message: `CBU withdrawal approved and signed file uploaded. Next stage: ${next}`,
        data: updated.rows[0],
      });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("UPDATE CBU ERROR:", err.message);
      return res.status(500).json({
        message: err.message || "Failed to update CBU withdrawal",
      });
    } finally {
      client.release();
    }
  }
);

router.post(
  "/cbu-withdrawals/:id/approved-file",
  requireAuth,
  requirePermission("cbu_withdrawal", "upload_approved"),
  uploadToTemp,
  async (req, res) => {
    const client = await db.connect();

    try {
      const id = toNum(req.params.id);

      if (!id) return res.status(400).json({ message: "Invalid withdrawal id" });
      if (!req.file?.key) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      await client.query("BEGIN");

      const current = await client.query(
        `
        SELECT *
        FROM public.cbu_withdrawals
        WHERE id = $1
        FOR UPDATE
        `,
        [id]
      );

      if (current.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "CBU withdrawal not found" });
      }

      const row = current.rows[0];
      const staff = await getStaffById(row.employee_id, client);

      if (!staff) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Staff record not found" });
      }

      if (norm(row.approval_stage) !== norm(ACCOUNTING_FINAL)) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: "Final upload is only allowed during Accounting Department stage.",
        });
      }

      if (!canApproveCurrentStage(req, ACCOUNTING_FINAL)) {
        await client.query("ROLLBACK");
        return res.status(403).json({
          message: "Only Accounting Department can upload final file.",
        });
      }

      const finalKey = await moveFromTempKeepExisting(
        req.file.key,
        "cbu-withdrawals/approved",
        String(id),
        req.file.originalname || "approved-file"
      );

      const finalName = req.file.originalname || null;

      const finalized = await finalizeCbuWithdrawal({
        client,
        row,
        staff,
        fileKey: finalKey,
        fileName: finalName,
      });

      if (finalized.error) {
        await client.query("ROLLBACK");
        return res.status(finalized.errorStatus).json(finalized.error);
      }

      await client.query("COMMIT");

      return res.json({
        message: "Accounting final approved file uploaded. CBU withdrawal fully approved.",
        data: finalized.data,
      });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("UPLOAD CBU APPROVED FILE ERROR:", err.message);
      return res.status(500).json({ message: err.message });
    } finally {
      client.release();
    }
  }
);

router.delete(
  "/cbu-withdrawals/:id",
  requireAuth,
  requirePermission("cbu_withdrawal", "delete"),
  async (req, res) => {
    try {
      const id = toNum(req.params.id);

      if (!id) return res.status(400).json({ message: "Invalid withdrawal id" });

      if (!canDelete(req)) {
        return res.status(403).json({
          message: "Only Admin, HR Department, or Accounting Department can delete CBU withdrawal.",
        });
      }

      const check = await db.query(
        `
        SELECT status
        FROM public.cbu_withdrawals
        WHERE id = $1
        `,
        [id]
      );

      if (check.rowCount === 0) {
        return res.status(404).json({ message: "CBU withdrawal not found" });
      }

      if (!["rejected", "void"].includes(norm(check.rows[0].status))) {
        return res.status(400).json({
          message: "Delete is only allowed when the CBU withdrawal is Rejected or Void.",
        });
      }

      await db.query(
        `
        DELETE FROM public.cbu_withdrawals
        WHERE id = $1
        `,
        [id]
      );

      return res.json({ message: "CBU withdrawal deleted successfully." });
    } catch (err) {
      console.error("DELETE CBU ERROR:", err.message);
      return res.status(500).json({ message: err.message });
    }
  }
);

module.exports = router;