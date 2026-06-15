const express = require("express");
const router = express.Router();
const db = require("../db");

const { requireAuth } = require("../middlewares/authMiddleware");
const { requirePermission } = require("../middlewares/permissionMiddleware");

const {
  uploadToTemp,
  moveFromTemp,
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
  getUserRole(req) === "it" || getUserDepartment(req) === "it department";
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

const isAVPPos = (position) => hasRole(position, "assistant vice president");
const isVPPos = (position) =>
  hasRole(position, "vice president") && !hasRole(position, "senior vice president");
const isSVPPos = (position) => hasRole(position, "senior vice president");

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
    if (isSVPPos(pos)) return [ACCOUNTING_FINAL];

    // If Vice President is the applicant:
    // SVP approves, then Accounting final upload/approve
    if (isVPPos(pos)) return ["Senior Vice President", ACCOUNTING_FINAL];

    // Normal Operation flow:
    // Vice President is final uploader/approver
    if (isAVPPos(pos)) return ["Vice President"];

    if (isRegionalManagerPos(pos)) {
      return ["Assistant Vice President", "Vice President"];
    }

    if (isAreaManagerPos(pos)) {
      return ["Regional Manager", "Assistant Vice President", "Vice President"];
    }

    if (isBranchManagerPos(pos)) {
      return [
        "Area Manager",
        "Regional Manager",
        "Assistant Vice President",
        "Vice President",
      ];
    }

    return [
      "Branch Manager",
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
    if (isSVPPos(pos)) return [ACCOUNTING_FINAL];
    if (isVPPos(pos)) return ["Senior Vice President", ACCOUNTING_FINAL];
    if (isAVPPos(pos)) {
      return ["Vice President", "Senior Vice President", ACCOUNTING_FINAL];
    }

    return ["Assistant Vice President", "Senior Vice President", ACCOUNTING_FINAL];
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

const canApproveCurrentStage = (req, stage) => {
  if (norm(stage) === norm(ACCOUNTING_FINAL)) {
    return roleMatchesStage(req, stage);
  }

  return roleMatchesStage(req, stage) || canBypassApproval(req);
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
  if (norm(stage) === norm(ACCOUNTING_FINAL)) return true;

  const cols = await getUserColumns(client);
  if (!cols.includes("role")) return true;

  const where = [`LOWER(TRIM(COALESCE(role, ''))) = $1`];
  const params = [norm(stage)];

  if (cols.includes("status")) {
    where.push(`LOWER(TRIM(COALESCE(status, 'active'))) <> 'inactive'`);
  }

  if (isOperationDepartment(staff.department)) {
    if (norm(stage) === "branch manager" && cols.includes("branch_id")) {
      params.push(staff.branch_id || null);
      where.push(`branch_id = $${params.length}`);
    }

    if (norm(stage) === "area manager" && cols.includes("area")) {
      params.push(norm(staff.area));
      where.push(`LOWER(TRIM(COALESCE(area, ''))) = $${params.length}`);
    }

    if (norm(stage) === "regional manager" && cols.includes("region")) {
      params.push(norm(staff.region));
      where.push(`LOWER(TRIM(COALESCE(region, ''))) = $${params.length}`);
    }

    if (norm(stage) === "assistant vice president" && cols.includes("division")) {
      params.push(norm(staff.division));
      where.push(`LOWER(TRIM(COALESCE(division, ''))) = $${params.length}`);
    }

    if (norm(stage) === "vice president" && cols.includes("department")) {
      params.push("operation department");
      where.push(`LOWER(TRIM(COALESCE(department, ''))) IN ($${params.length}, 'operations department')`);
    }
  } else if (cols.includes("department")) {
    if (
      ["assistant vice president", "vice president", "senior vice president"].includes(
        norm(stage)
      )
    ) {
      params.push(norm(staff.department));
      where.push(`LOWER(TRIM(COALESCE(department, ''))) = $${params.length}`);
    }
  }

  try {
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
  } catch {
    return true;
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
    SET status = 'Approved',
        approval_stage = 'Approved',
        approved_at = NOW(),
        attachment_path = $1,
        attachment_name = $2,
        approved_attachment_path = $1,
        approved_attachment_name = $2,
        final_status = 'Approved',
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

      const attachmentPath = await moveFromTemp(
        req.file.key,
        "cbu-withdrawals/latest",
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

      const currentStage =
        clean(row.approval_stage) || (await getInitialStage(client, staff));
      const col = stageColumn(currentStage);

      if (!canApproveCurrentStage(req, currentStage)) {
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

      const latestFileKey = await moveFromTemp(
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
          SET ${col} = 'Approved',
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
        SET status = 'Pending',
            approval_stage = $1,
            attachment_path = $2,
            attachment_name = $3,
            updated_at = NOW()
        WHERE id = $4
        RETURNING *
        `,
        [next, latestFileKey, latestFileName, id]
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

      const finalKey = await moveFromTemp(
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