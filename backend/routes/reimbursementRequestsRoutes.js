const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const pool = require("../db");
const { requireAuth } = require("../middlewares/authMiddleware");
const { requirePermission } = require("../middlewares/permissionMiddleware");

const router = express.Router();

const WAITING_FINAL_FILE = "Waiting Final File Upload";

/* ======================================================
   HELPERS
====================================================== */

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
const hasValue = (v) => toStr(v) !== "";

const roleLower = (req) => norm(req.user?.role);
const userDepartment = (req) => norm(req.user?.department);
const userDivision = (req) => toStr(req.user?.division);
const userArea = (req) => toStr(req.user?.area);
const userRegion = (req) => toStr(req.user?.region);
const userBranchId = (req) => toInt(req.user?.branch_id);

const isAccountingDeptManager = (req) =>
  isAccountingDepartment(userDepartment(req)) &&
  [
    "branch manager",
    "area manager",
    "regional manager",
    "assistant vice president",
    "vice president",
    "senior vice president",
  ].includes(roleLower(req));

const isITDeptManager = (req) =>
  isITDepartment(userDepartment(req)) &&
  [
    "branch manager",
    "acting branch manager",
    "area manager",
    "acting area manager",
    "regional manager",
    "acting regional manager",
    "assistant vice president",
    "vice president",
    "senior vice president",
  ].includes(roleLower(req));

const isAdmin = (req) => roleLower(req) === "admin";
const isIT = (req) => roleLower(req) === "it";
const isHR = (req) => roleLower(req) === "hr";
const isAccounting = (req) => roleLower(req) === "accounting";
const isTread = (req) => roleLower(req) === "tread";

const isBranchManager = (req) => roleLower(req) === "branch manager";
const isAreaManager = (req) => roleLower(req) === "area manager";
const isRegionalManager = (req) => roleLower(req) === "regional manager";
const isAssistantVicePresident = (req) =>
  roleLower(req) === "assistant vice president";
const isVicePresident = (req) => roleLower(req) === "vice president";
const isSeniorVicePresident = (req) =>
  roleLower(req) === "senior vice president";
const isPresident = (req) => roleLower(req) === "president";

const canBypassApproval = (req) =>
  isAdmin(req) || isIT(req) || isAccountingDeptManager(req) || isITDeptManager(req);

const canFinalUpload = (req) =>
  isHR(req) ||
  isAccounting(req) ||
  isAdmin(req) ||
  isIT(req) ||
  isAccountingDeptManager(req) ||
  isITDeptManager(req);

const isOperationDepartment = (department) =>
  norm(department).includes("operation");

const isAuditDepartment = (department) => norm(department).includes("audit");

const isProductionDepartment = (department) =>
  norm(department).includes("production");

const isHRDepartment = (department) => norm(department).includes("hr");

const isAccountingDepartment = (department) =>
  norm(department).includes("accounting");

const isTreadDepartment = (department) => norm(department).includes("tread");

const isITDepartment = (department) => norm(department).includes("it");

/* ======================================================
   UPLOAD
====================================================== */

const uploadDir = path.join(__dirname, "..", "uploads", "reimbursements");

fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),

  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    const safeBase = path
      .basename(file.originalname || "file", ext)
      .replace(/[^a-zA-Z0-9-_]/g, "_")
      .slice(0, 80);

    cb(null, `reimbursement-${Date.now()}-${safeBase}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024,
  },
});

/* ======================================================
   APPROVAL CHAIN
====================================================== */

const OPERATION_LOAN_OFFICER_CHAIN = [
  "area manager",
  "regional manager",
  "assistant vice president",
  "vice president",
];

const OPERATION_BRANCH_MANAGER_CHAIN = [
  "area manager",
  "regional manager",
  "assistant vice president",
  "vice president",
];

const OPERATION_AREA_MANAGER_CHAIN = [
  "regional manager",
  "assistant vice president",
  "vice president",
];

const OPERATION_REGIONAL_MANAGER_CHAIN = [
  "assistant vice president",
  "vice president",
];

const OPERATION_AVP_CHAIN = [
  "vice president",
];

const OPERATION_VP_CHAIN = [
  "senior vice president",
];

const OPERATION_SVP_CHAIN = [];

const BACK_OFFICE_SVP_CHAIN = ["senior vice president"];
const BACK_OFFICE_AVP_CHAIN = ["assistant vice president"];

const stageColumnMap = {
  "branch manager": "branch_manager_status",
  "area manager": "area_manager_status",
  "regional manager": "regional_manager_status",
  "assistant vice president": "assistant_vice_president_status",
  "vice president": "vice_president_status",
  "senior vice president": "senior_vice_president_status",
};

const stageApprovedAtColumnMap = {
  "branch manager": "branch_manager_approved_at",
  "area manager": "area_manager_approved_at",
  "regional manager": "regional_manager_approved_at",
  "assistant vice president": "assistant_vice_president_approved_at",
  "vice president": "vice_president_approved_at",
  "senior vice president": "senior_vice_president_approved_at",
};

const stageLabel = (stage) => {
  const s = norm(stage);

  if (s === "branch manager") return "Branch Manager";
  if (s === "area manager") return "Area Manager";
  if (s === "regional manager") return "Regional Manager";
  if (s === "assistant vice president") return "Assistant Vice President";
  if (s === "vice president") return "Vice President";
  if (s === "senior vice president") return "Senior Vice President";
  if (s === norm(WAITING_FINAL_FILE)) return WAITING_FINAL_FILE;
  if (s === "approved") return "Approved";
  if (s === "rejected") return "Rejected";
  if (s === "void") return "Void";

  return stage || "Pending";
};

const getApprovalChain = (staffDepartment, staffPosition) => {
  const department = norm(staffDepartment);
  const position = norm(staffPosition);

  if (isOperationDepartment(department)) {
    // Senior Vice President applicant
    // Accounting final only
    if (position.includes("senior vice president")) {
      return OPERATION_SVP_CHAIN;
    }

    // Vice President applicant
    // SVP -> Accounting final
    if (
      position.includes("vice president") &&
      !position.includes("assistant vice president") &&
      !position.includes("senior vice president")
    ) {
      return OPERATION_VP_CHAIN;
    }

    // Assistant Vice President applicant
    // VP -> Accounting final
    if (position.includes("assistant vice president")) {
      return OPERATION_AVP_CHAIN;
    }

    // Regional Manager applicant
    // AVP -> VP -> Accounting final
    if (position.includes("regional manager")) {
      return OPERATION_REGIONAL_MANAGER_CHAIN;
    }

    // Area Manager applicant
    // RM -> AVP -> VP -> Accounting final
    if (position.includes("area manager")) {
      return OPERATION_AREA_MANAGER_CHAIN;
    }

    // Branch Manager applicant
    // AM -> RM -> AVP -> VP FINAL
    if (position.includes("branch manager")) {
      return OPERATION_BRANCH_MANAGER_CHAIN;
    }

    // Loan Officer / other Operation staff
    // AM -> RM -> AVP -> VP FINAL
    return OPERATION_LOAN_OFFICER_CHAIN;
  }

  if (isTreadDepartment(department)) {
    return BACK_OFFICE_AVP_CHAIN;
  }

  if (isITDepartment(department)) {
    return BACK_OFFICE_AVP_CHAIN;
  }

  if (
    isAuditDepartment(department) ||
    isHRDepartment(department) ||
    isProductionDepartment(department) ||
    isAccountingDepartment(department)
  ) {
    return BACK_OFFICE_SVP_CHAIN;
  }

  return BACK_OFFICE_SVP_CHAIN;
};

const canCreateReimbursement = (req, staffDepartment) => {
  const role = roleLower(req);
  const department = norm(staffDepartment);
  const creatorDepartment = userDepartment(req);

  if (creatorDepartment === "office of the president") {
    return true;
  }

  if (
    isAdmin(req) ||
    isIT(req) ||
    isHR(req) ||
    isAccounting(req) ||
    isAccountingDeptManager(req) ||
    isITDeptManager(req)
  ) {
    return true;
  }

  if (isOperationDepartment(department)) {
    return [
      "area manager",
      "regional manager",
      "assistant vice president",
      "vice president",
      "senior vice president",
    ].includes(role);
  }

  return [
    "hr",
    "accounting",
    "tread",
    "area manager",
    "regional manager",
    "assistant vice president",
    "vice president",
    "senior vice president",
    "president",
  ].includes(role);
};

const canActOnStage = (req, stage) => {
  if (canBypassApproval(req)) return true;
  return roleLower(req) === norm(stage);
};

const parseChain = (chainValue) => {
  try {
    if (Array.isArray(chainValue)) return chainValue.map(norm).filter(Boolean);

    if (chainValue) {
      const parsed = JSON.parse(chainValue);
      if (Array.isArray(parsed)) return parsed.map(norm).filter(Boolean);
    }
  } catch {}

  return [];
};

const nextStage = (currentStage, chain) => {
  const normalizedChain = Array.isArray(chain) ? chain.map(norm) : [];
  const current = norm(currentStage);
  const index = normalizedChain.findIndex((x) => x === current);

  if (index < 0) return normalizedChain[0] || null;
  if (index >= normalizedChain.length - 1) return WAITING_FINAL_FILE;

  return normalizedChain[index + 1];
};

const allStageStatusesDefault = {
  branch_manager_status: "Pending",
  area_manager_status: "Pending",
  regional_manager_status: "Pending",
  assistant_vice_president_status: "Pending",
  vice_president_status: "Pending",
  senior_vice_president_status: "Pending",
  admin_status: "Pending",
};

/* ======================================================
   SELECT
====================================================== */

const reimbursementSelect = `
  rr.id,
  rr.employee_id,
  rr.employee_no,
  rr.staff_name,
  rr.description,
  rr.amount,
  rr.request_date,
  rr.request_type,
  rr.reimbursement_date,
  rr.status,
  rr.approval_stage,
  rr.approval_chain,

  rr.branch_manager_status,
  rr.branch_manager_approved_at,

  rr.area_manager_status,
  rr.area_manager_approved_at,

  rr.regional_manager_status,
  rr.regional_manager_approved_at,

  rr.assistant_vice_president_status,
  rr.assistant_vice_president_approved_at,

  rr.vice_president_status,
  rr.vice_president_approved_at,

  rr.senior_vice_president_status,
  rr.senior_vice_president_approved_at,

  rr.admin_status,
  rr.final_approved_at,

  rr.attachment_path,
  rr.attachment_name,

  rr.rejection_reason,

  rr.created_by,
  rr.approved_by,
  rr.approved_at,

  rr.rejected_by,
  rr.rejected_at,

  rr.created_at,
  rr.updated_at,

  s.department AS staff_department,
  s.position AS staff_position,
  s.area AS staff_area,
  s.region AS staff_region,
  s.division AS staff_division,
  b.code AS branch_code,
  b.name AS branch_name
`;

/* ======================================================
   STAFF LOOKUP
====================================================== */

async function getStaffById(employeeId, client = pool) {
  const result = await client.query(
    `
    SELECT
      s.id,
      s.employee_no,
      s.fullname,
      s.first_name,
      s.middle_name,
      s.last_name,
      s.department,
      s.position,
      s.area,
      s.region,
      s.division,
      s.branch_id,
      b.code AS branch_code,
      b.name AS branch_name
    FROM staff s
    LEFT JOIN branches b ON b.id = s.branch_id
    WHERE s.id = $1
    LIMIT 1
    `,
    [employeeId]
  );

  return result.rows[0] || null;
}

const buildStaffName = (staff) => {
  if (!staff) return "-";

  return (
    toStr(staff.fullname) ||
    `${toStr(staff.last_name)}${
      staff.last_name && staff.first_name ? ", " : ""
    }${toStr(staff.first_name)}${
      staff.middle_name ? ` ${toStr(staff.middle_name)}` : ""
    }`
      .replace(/\s+/g, " ")
      .trim() ||
    "-"
  );
};

/* ======================================================
   GET ALL
====================================================== */

router.get(
  "/",
  requireAuth,
  requirePermission("reimbursement_request", "view"),
  async (req, res) => {
    try {
      if (
        isAdmin(req) ||
        isIT(req) ||
        isHR(req) ||
        isAccounting(req) ||
        isAccountingDeptManager(req) ||
        isITDeptManager(req) ||
        isTread(req) ||
        isVicePresident(req) ||
        isSeniorVicePresident(req) ||
        isPresident(req)
      ) {
        const result = await pool.query(`
          SELECT ${reimbursementSelect}
          FROM reimbursement_requests rr
          LEFT JOIN staff s ON s.id = rr.employee_id
          LEFT JOIN branches b ON b.id = s.branch_id
          ORDER BY rr.created_at DESC, rr.id DESC
        `);

        return res.json(result.rows);
      }

      if (isBranchManager(req)) {
        const branchId = userBranchId(req);
        if (!branchId) return res.json([]);

        const result = await pool.query(
          `
          SELECT ${reimbursementSelect}
          FROM reimbursement_requests rr
          LEFT JOIN staff s ON s.id = rr.employee_id
          LEFT JOIN branches b ON b.id = s.branch_id
          WHERE s.branch_id = $1
          ORDER BY rr.created_at DESC, rr.id DESC
          `,
          [branchId]
        );

        return res.json(result.rows);
      }

      if (isAreaManager(req)) {
        const area = userArea(req);
        if (!area) return res.json([]);

        const result = await pool.query(
          `
          SELECT ${reimbursementSelect}
          FROM reimbursement_requests rr
          LEFT JOIN staff s ON s.id = rr.employee_id
          LEFT JOIN branches b ON b.id = s.branch_id
          WHERE LOWER(TRIM(COALESCE(s.area, ''))) = LOWER(TRIM($1))
          ORDER BY rr.created_at DESC, rr.id DESC
          `,
          [area]
        );

        return res.json(result.rows);
      }

      if (isRegionalManager(req)) {
        const region = userRegion(req);
        if (!region) return res.json([]);

        const result = await pool.query(
          `
          SELECT ${reimbursementSelect}
          FROM reimbursement_requests rr
          LEFT JOIN staff s ON s.id = rr.employee_id
          LEFT JOIN branches b ON b.id = s.branch_id
          WHERE LOWER(TRIM(COALESCE(s.region, ''))) = LOWER(TRIM($1))
          ORDER BY rr.created_at DESC, rr.id DESC
          `,
          [region]
        );

        return res.json(result.rows);
      }

      if (isAssistantVicePresident(req)) {
        const division = userDivision(req);

        if (!division) {
          const result = await pool.query(`
            SELECT ${reimbursementSelect}
            FROM reimbursement_requests rr
            LEFT JOIN staff s ON s.id = rr.employee_id
            LEFT JOIN branches b ON b.id = s.branch_id
            ORDER BY rr.created_at DESC, rr.id DESC
          `);

          return res.json(result.rows);
        }

        const result = await pool.query(
          `
          SELECT ${reimbursementSelect}
          FROM reimbursement_requests rr
          LEFT JOIN staff s ON s.id = rr.employee_id
          LEFT JOIN branches b ON b.id = s.branch_id
          WHERE LOWER(TRIM(COALESCE(s.division, ''))) = LOWER(TRIM($1))
          ORDER BY rr.created_at DESC, rr.id DESC
          `,
          [division]
        );

        return res.json(result.rows);
      }

      return res.status(403).json({
        message: "Access denied.",
      });
    } catch (err) {
      console.error("GET reimbursement error:", err);
      return res.status(500).json({
        message: err.message || "Failed to fetch reimbursement requests.",
      });
    }
  }
);

/* ======================================================
   GET SINGLE
====================================================== */

router.get(
  "/:id",
  requireAuth,
  requirePermission("reimbursement_request", "view"),
  async (req, res) => {
    try {
      const id = toInt(req.params.id);

      if (!id) {
        return res.status(400).json({
          message: "Invalid reimbursement id.",
        });
      }

      const result = await pool.query(
        `
        SELECT ${reimbursementSelect}
        FROM reimbursement_requests rr
        LEFT JOIN staff s ON s.id = rr.employee_id
        LEFT JOIN branches b ON b.id = s.branch_id
        WHERE rr.id = $1
        LIMIT 1
        `,
        [id]
      );

      if (!result.rows.length) {
        return res.status(404).json({
          message: "Reimbursement request not found.",
        });
      }

      return res.json(result.rows[0]);
    } catch (err) {
      console.error("GET reimbursement/:id error:", err);
      return res.status(500).json({
        message: err.message || "Failed to fetch reimbursement request.",
      });
    }
  }
);

/* ======================================================
   CREATE
====================================================== */

router.post(
  "/",
  requireAuth,
  requirePermission("reimbursement_request", "create"),
  upload.single("attachment"),
  async (req, res) => {
    try {
      const employeeId = hasValue(req.body.employee_id)
        ? toInt(req.body.employee_id)
        : null;

      const description = toStr(req.body.description);
      const amount = toNum(req.body.amount);
      const requestDate = hasValue(req.body.request_date)
        ? req.body.request_date
        : null;
      const requestType = toStr(req.body.request_type) || null;

      if (!employeeId) {
        return res.status(400).json({
          message: "Employee is required.",
        });
      }

      if (!description) {
        return res.status(400).json({
          message: "Description is required.",
        });
      }

      if (amount <= 0) {
        return res.status(400).json({
          message: "Amount must be greater than zero.",
        });
      }

      if (!req.file) {
        return res.status(400).json({
          message: "Reimbursement request file is required.",
        });
      }

      const staff = await getStaffById(employeeId);

      if (!staff) {
        return res.status(404).json({
          message: "Staff not found.",
        });
      }

      if (!canCreateReimbursement(req, staff.department)) {
        return res.status(403).json({
          message: "Access denied. This role cannot create reimbursement for this department.",
        });
      }

      const chain = getApprovalChain(
        staff.department,
        staff.position
      );

      const isOperationSvpApplicant =
        isOperationDepartment(staff.department) &&
        norm(staff.position).includes("senior vice president");

      const approvalStage =
        isOperationSvpApplicant
          ? WAITING_FINAL_FILE
          : chain[0];

      const initialStatus =
        isOperationSvpApplicant
          ? WAITING_FINAL_FILE
          : "Pending";

      const attachmentPath = `/uploads/reimbursements/${req.file.filename}`;
      const attachmentName = req.file.originalname || null;

      const result = await pool.query(
        `
        INSERT INTO reimbursement_requests
        (
          employee_id,
          employee_no,
          staff_name,
          description,
          amount,
          request_date,
          request_type,
          reimbursement_date,

          status,
          approval_stage,
          approval_chain,

          branch_manager_status,
          area_manager_status,
          regional_manager_status,
          assistant_vice_president_status,
          vice_president_status,
          senior_vice_president_status,
          admin_status,

          attachment_path,
          attachment_name,

          created_by,
          created_at,
          updated_at
        )
        VALUES
        (
          $1, $2, $3, $4, $5, $6, $7, NULL,

          $8,
          $9,
          $10,

          $11, $12, $13, $14, $15, $16, $17,

          $18, $19,

          $20,
          NOW(),
          NOW()
        )
        RETURNING *
        `,
        [
          employeeId,
          staff.employee_no || req.body.employee_no || null,
          buildStaffName(staff),
          description,
          amount,
          requestDate,
          requestType,

          initialStatus,
          approvalStage,
          JSON.stringify(chain),

          allStageStatusesDefault.branch_manager_status,
          allStageStatusesDefault.area_manager_status,
          allStageStatusesDefault.regional_manager_status,
          allStageStatusesDefault.assistant_vice_president_status,
          allStageStatusesDefault.vice_president_status,
          allStageStatusesDefault.senior_vice_president_status,
          allStageStatusesDefault.admin_status,

          attachmentPath,
          attachmentName,

          req.user?.id || null,
        ]
      );

      return res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error("POST reimbursement error:", err);
      return res.status(500).json({
        message: err.message || "Failed to create reimbursement request.",
      });
    }
  }
);

/* ======================================================
   DOWNLOAD LATEST
====================================================== */

router.get(
  "/:id/download/latest",
  requireAuth,
  requirePermission("reimbursement_request", "view"),
  async (req, res) => {
    try {
      const id = toInt(req.params.id);

      if (!id) {
        return res.status(400).json({
          message: "Invalid reimbursement id.",
        });
      }

      const result = await pool.query(
        `
        SELECT attachment_path, attachment_name
        FROM reimbursement_requests
        WHERE id = $1
        LIMIT 1
        `,
        [id]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          message: "Reimbursement request not found.",
        });
      }

      const row = result.rows[0];

      if (!row.attachment_path) {
        return res.status(404).json({
          message: "No reimbursement file found.",
        });
      }

      const filePath = path.join(
        __dirname,
        "..",
        String(row.attachment_path).replace(/^\/+/, "")
      );

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({
          message: "File not found on server.",
        });
      }

      return res.download(
        filePath,
        row.attachment_name || path.basename(filePath)
      );
    } catch (err) {
      console.error("DOWNLOAD reimbursement error:", err);
      return res.status(500).json({
        message: err.message || "Failed to download reimbursement file.",
      });
    }
  }
);

/* ======================================================
   APPROVE / REJECT / VOID
====================================================== */

router.put(
  "/:id",
    requireAuth,
    requirePermission("reimbursement_request","approve"),
    upload.single("attachment"),

  async (req,res)=>{

    const client=await pool.connect();

      try{

        const id=toInt(req.params.id);
        const action=norm(req.body.action||"");

        await client.query("BEGIN");

        const q=await client.query(`
          SELECT rr.*,s.department AS staff_department,
          s.position AS staff_position
          FROM reimbursement_requests rr
          LEFT JOIN staff s
          ON s.id=rr.employee_id
          WHERE rr.id=$1
          FOR UPDATE OF rr
        `,[id]);

        if(!q.rows.length){
          await client.query("ROLLBACK");
          return res.status(404).json({
          message:"Request not found"
          });
        }

        const row=q.rows[0];

        if (action === "void") {
          if (!canBypassApproval(req)) {
            await client.query("ROLLBACK");

            return res.status(403).json({
              message:
                "Only Admin, IT, Accounting Department managers, or IT Department managers can void reimbursement.",
            });
          }

          if (norm(row.status) !== "approved") {
            await client.query("ROLLBACK");

            return res.status(400).json({
              message: "Only approved reimbursement requests can be voided.",
            });
          }

  const r = await client.query(
    `
    UPDATE reimbursement_requests
    SET
      status = 'Void',
      approval_stage = 'Void',
      updated_at = NOW()
    WHERE id = $1
      AND LOWER(TRIM(COALESCE(status, ''))) = 'approved'
    RETURNING *
    `,
    [id]
  );

  if (r.rowCount === 0) {
    await client.query("ROLLBACK");

    return res.status(400).json({
      message: "Reimbursement cannot be voided.",
    });
  }

  await client.query("COMMIT");

  return res.json(r.rows[0]);
}

if(
norm(row.status)==="approved"||
norm(row.status)==="void"||
norm(row.status)==="rejected"
){
await client.query("ROLLBACK");

return res.status(400).json({
message:`Already ${row.status}`
});
}

let chain=parseChain(row.approval_chain);

if(!chain.length){

chain=getApprovalChain(
row.staff_department,
row.staff_position
);

}

const current=
norm(
row.approval_stage||
chain[0]
);

if(
!canBypassApproval(req)&&
!canActOnStage(req,current)
){

await client.query("ROLLBACK");

return res.status(403).json({
message:"Not your approval stage"
});

}

  const col = stageColumnMap[current];
    const approvedAtCol = stageApprovedAtColumnMap[current];

    if (!col || !approvedAtCol) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        message: "Invalid stage"
      });
    }

if(
(action==="approve"||
action==="approved")
&&
!req.file
){

await client.query("ROLLBACK");

return res.status(400).json({
message:
"Upload signed file first"
});

}

if(
action==="reject"
){

const r=
await client.query(`
UPDATE reimbursement_requests
SET
status='Rejected',
${col}='Rejected',
approval_stage=$2,

rejected_by=$3,
rejected_at=NOW(),

rejection_reason=$4,
updated_at=NOW()

WHERE id=$1
RETURNING *
`,
[
id,
current,
req.user?.id,
req.body.reason||
req.body.rejection_reason||
"Rejected"
]);

await client.query("COMMIT");

return res.json(
r.rows[0]
);

}

const attachmentPath=
`/uploads/reimbursements/${req.file.filename}`;

const attachmentName=
req.file.originalname;

const nxt=
nextStage(
current,
chain
);

const isOperationRequest =
  isOperationDepartment(row.staff_department);

const applicantPosition =
  norm(row.staff_position);

const vpIsFinalForOperation =
  isOperationRequest &&
  (
    applicantPosition.includes("loan officer") ||
    applicantPosition.includes("branch manager")
  ) &&
  norm(current) === "vice president";


// =====================================================
// OPERATION LO / BM
// VICE PRESIDENT IS FINAL APPROVER
// =====================================================
if (vpIsFinalForOperation) {

  const r = await client.query(
    `
    UPDATE reimbursement_requests
    SET
      ${col} = 'Approved',
      ${approvedAtCol} = NOW(),

      status = 'Approved',
      approval_stage = 'approved',

      attachment_path = $2,
      attachment_name = $3,

      approved_by = $4,
      approved_at = NOW(),
      final_approved_at = NOW(),

      updated_at = NOW()

    WHERE id = $1
    RETURNING *
    `,
    [
      id,
      attachmentPath,
      attachmentName,
      req.user?.id
    ]
  );

  await client.query("COMMIT");

  return res.json({
    ...r.rows[0],
    requires_final_upload: false
  });
}


// =====================================================
// MOVE TO NEXT NORMAL APPROVER
// =====================================================
if (
  nxt &&
  norm(nxt) !== norm(WAITING_FINAL_FILE)
) {

const r=
await client.query(`
UPDATE reimbursement_requests
SET

${col}='Approved',
${approvedAtCol}=NOW(),

status='Pending',

approval_stage=$2,

attachment_path=$3,
attachment_name=$4,

approved_by=$5,
approved_at=NOW(),

updated_at=NOW()

WHERE id=$1
RETURNING *
`,
[
id,
nxt,
attachmentPath,
attachmentName,
req.user?.id
]);

await client.query(
"COMMIT"
);

return res.json(
r.rows[0]
);

}

const r=
await client.query(`
UPDATE reimbursement_requests
SET

${col}='Approved',
${approvedAtCol}=NOW(),

status=$2,

approval_stage=$2,

attachment_path=$3,
attachment_name=$4,

approved_by=$5,
approved_at=NOW(),

updated_at=NOW()

WHERE id=$1
RETURNING *
`,
[
id,
WAITING_FINAL_FILE,
attachmentPath,
attachmentName,
req.user?.id
]);

await client.query(
"COMMIT"
);

return res.json({
...r.rows[0],
requires_final_upload:true
});

}
catch(err){

await client.query(
"ROLLBACK"
);

console.log(err);

return res.status(500).json({
message:err.message
});

}
finally{

client.release();

}

}
);

/* ======================================================
   FINAL UPLOAD
====================================================== */

router.post(
  "/:id/approved-file",
  requireAuth,
  requirePermission("reimbursement_request", "approve"),
  upload.single("attachment"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const id = toInt(req.params.id);

      if (!id) {
        return res.status(400).json({
          message: "Invalid reimbursement id.",
        });
      }

      if (!req.file) {
        return res.status(400).json({
          message: "Final approved file is required.",
        });
      }

      if (!canFinalUpload(req)) {
        return res.status(403).json({
          message: "Only Admin, IT, Accounting, or HR can upload final reimbursement file.",
        });
      }

      await client.query("BEGIN");

      const existing = await client.query(
        `
        SELECT *
        FROM reimbursement_requests
        WHERE id = $1
        FOR UPDATE
        `,
        [id]
      );

      if (!existing.rows.length) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          message: "Reimbursement request not found.",
        });
      }

      const row = existing.rows[0];

      if (norm(row.status) === "approved") {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: "This reimbursement is already approved.",
        });
      }

      if (norm(row.status) === "rejected") {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: "This reimbursement is already rejected.",
        });
      }

      if (norm(row.status) === "void") {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: "This reimbursement is already voided.",
        });
      }

      if (
        norm(row.status) !== norm(WAITING_FINAL_FILE) &&
        !canBypassApproval(req)
      ) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message:
            "Final file can only be uploaded after final approver approval.",
        });
      }

      const reimbursementDate = hasValue(req.body.reimbursement_date)
        ? req.body.reimbursement_date
        : row.reimbursement_date;

      const attachmentPath = `/uploads/reimbursements/${req.file.filename}`;
      const attachmentName = req.file.originalname || null;

      const result = await client.query(
        `
        UPDATE reimbursement_requests
        SET
          status = 'Approved',
          approval_stage = 'approved',
          admin_status = 'Approved',

          approved_by = $2,
          approved_at = NOW(),
          final_approved_at = NOW(),

          reimbursement_date = $3,

          attachment_path = $4,
          attachment_name = $5,

          rejected_by = NULL,
          rejected_at = NULL,
          rejection_reason = NULL,

          updated_at = NOW()
        WHERE id = $1
        RETURNING *
        `,
        [
          id,
          req.user?.id || null,
          reimbursementDate,
          attachmentPath,
          attachmentName,
        ]
      );

      await client.query("COMMIT");
      return res.json(result.rows[0]);
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("POST reimbursement approved-file error:", err);

      return res.status(500).json({
        message:
          err.message || "Failed to upload final reimbursement approved file.",
      });
    } finally {
      client.release();
    }
  }
);

router.delete(
  "/:id",
  requireAuth,
  requirePermission("reimbursement_request", "delete"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const id = toInt(req.params.id);

      if (!id) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message: "Invalid reimbursement id.",
        });
      }

      if (!canBypassApproval(req)) {
        await client.query("ROLLBACK");

        return res.status(403).json({
          message:
            "Only Admin, IT, Accounting Department managers, or IT Department managers can delete reimbursement.",
        });
      }

      const existing = await client.query(
        `
        SELECT
          id,
          status,
          attachment_path
        FROM reimbursement_requests
        WHERE id = $1
        FOR UPDATE
        `,
        [id]
      );

      if (existing.rowCount === 0) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          message: "Reimbursement request not found.",
        });
      }

      const row = existing.rows[0];
      const currentStatus = norm(row.status);

      if (!["rejected", "void"].includes(currentStatus)) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message:
            "Only Rejected or Void reimbursement requests can be deleted.",
        });
      }

      await client.query(
        `
        DELETE FROM reimbursement_requests
        WHERE id = $1
        `,
        [id]
      );

      await client.query("COMMIT");

      if (row.attachment_path) {
        const filePath = path.join(
          __dirname,
          "..",
          String(row.attachment_path).replace(/^\/+/, "")
        );

        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        } catch (fileError) {
          console.warn(
            "Unable to remove reimbursement file:",
            fileError.message
          );
        }
      }

      return res.json({
        message: "Reimbursement request deleted successfully.",
      });
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch {}

      console.error("DELETE reimbursement error:", err);

      return res.status(500).json({
        message:
          err.message || "Failed to delete reimbursement request.",
      });
    } finally {
      client.release();
    }
  }
);

module.exports = router;