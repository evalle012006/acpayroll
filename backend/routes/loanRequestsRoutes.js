const express = require("express");
const router = express.Router();
const pool = require("../db");
const { requireAuth, requireRole } = require("../middlewares/authMiddleware");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

/* ---------------- helpers ---------------- */
const toNum = (v) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const toInt = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

const toStr = (v) => String(v ?? "").trim();
const roleLower = (req) => String(req.user?.role || "").trim().toLowerCase();

const isAdmin = (req) => roleLower(req) === "admin";
const isHr = (req) => roleLower(req) === "hr";
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

const isFinalApprover = (req) => isAdmin(req) || isHr(req) || isAccounting(req);

const canViewAllLoans = (req) =>
  isAdmin(req) ||
  isHr(req) ||
  isAccounting(req) ||
  isTread(req) ||
  isAssistantVicePresident(req) ||
  isVicePresident(req) ||
  isSeniorVicePresident(req) ||
  isPresident(req);

const canDownloadLoanFiles = (req) =>
  isAdmin(req) ||
  isHr(req) ||
  isAccounting(req) ||
  isTread(req) ||
  isAreaManager(req) ||
  isRegionalManager(req) ||
  isAssistantVicePresident(req) ||
  isVicePresident(req) ||
  isSeniorVicePresident(req) ||
  isPresident(req);

const getUserBranchCode = (req) => toStr(req.user?.branch_id);
const getUserArea = (req) => toStr(req.user?.area);
const getUserRegion = (req) => toStr(req.user?.region);

const getInitialApprovalStage = (applicantRole) => {
  const role = String(applicantRole || "").trim().toLowerCase();

  if (role === "vice president") return "admin";
  if (role === "assistant vice president") return "vice president";
  if (role === "regional manager") return "assistant vice president";
  if (role === "area manager") return "regional manager";

  return "area manager";
};

const getApprovalChain = (applicantRole) => {
  const role = String(applicantRole || "").trim().toLowerCase();

  if (role === "vice president") {
    return ["admin"];
  }

  if (role === "assistant vice president") {
    return ["vice president", "admin"];
  }

  if (role === "regional manager") {
    return ["assistant vice president", "vice president", "admin"];
  }

  if (role === "area manager") {
    return [
      "regional manager",
      "assistant vice president",
      "vice president",
      "admin",
    ];
  }

  return [
    "area manager",
    "regional manager",
    "assistant vice president",
    "vice president",
    "admin",
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

  if (r.rowCount === 0) return null;
  return r.rows[0].id;
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

function loanTypeToBalanceColumn(loanType) {
  const lt = String(loanType || "").trim().toLowerCase();

  if (lt === "salary advance") return "salary_advance";
  if (lt === "special loan" || lt === "special advance") return "special_advance";
  if (lt === "cash loan" || lt === "cash advance") return "cash_advance";
  if (lt === "motorcycle loan") return "motorcycle_loan";
  if (lt === "pag-ibig loan" || lt === "pag ibig loan") return "pag_ibig_loan";

  return null;
}

/* ---------------- upload config ---------------- */
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

const upload = multer({ storage });

/* ---------------- shared select fields ---------------- */
const loanSelectFields = `
  lr.id,
  lr.staff_id,
  lr.employee_no,
  lr.loan_type,
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
  s.middle_name
`;

/* ---------------- GET all loans ---------------- */
router.get("/loan-requests", requireAuth, async (req, res) => {
  try {
    if (canViewAllLoans(req)) {
      const r = await pool.query(
        `
        SELECT ${loanSelectFields}
        FROM public.loan_requests lr
        LEFT JOIN public.staff s ON s.id = lr.staff_id
        ORDER BY lr.id DESC
        `
      );

      return res.json(r.rows);
    }

    if (isBranchManager(req)) {
      const branchCode = getUserBranchCode(req);
      if (!branchCode) return res.json([]);

      const bid = await getBranchIdFromCode(branchCode);
      if (!bid) return res.json([]);

      const r = await pool.query(
        `
        SELECT ${loanSelectFields}
        FROM public.loan_requests lr
        LEFT JOIN public.staff s ON s.id = lr.staff_id
        WHERE s.branch_id = $1
        ORDER BY lr.id DESC
        `,
        [bid]
      );

      return res.json(r.rows);
    }

    if (isAreaManager(req)) {
      const area = getUserArea(req);
      if (!area) return res.json([]);

      const r = await pool.query(
        `
        SELECT ${loanSelectFields}
        FROM public.loan_requests lr
        LEFT JOIN public.staff s ON s.id = lr.staff_id
        WHERE LOWER(TRIM(COALESCE(s.area, ''))) = LOWER(TRIM($1))
        ORDER BY lr.id DESC
        `,
        [area]
      );

      return res.json(r.rows);
    }

    if (isRegionalManager(req)) {
      const region = getUserRegion(req);
      if (!region) return res.json([]);

      const r = await pool.query(
        `
        SELECT ${loanSelectFields}
        FROM public.loan_requests lr
        LEFT JOIN public.staff s ON s.id = lr.staff_id
        WHERE LOWER(TRIM(COALESCE(s.region, ''))) = LOWER(TRIM($1))
        ORDER BY lr.id DESC
        `,
        [region]
      );

      return res.json(r.rows);
    }

    return res.status(403).json({ message: "Access denied" });
  } catch (e) {
    console.error("GET /api/loan-requests ERROR:", e);
    return res.status(500).json({ message: e?.message || "Server error" });
  }
});

/* ---------------- GET loans by staff ---------------- */
router.get("/loan-requests/staff/:staffId", requireAuth, async (req, res) => {
  try {
    const staffId = toInt(req.params.staffId);
    if (!staffId) return res.status(400).json({ message: "Invalid staff id" });

    if (canViewAllLoans(req)) {
      const r = await pool.query(
        `
        SELECT ${loanSelectFields}
        FROM public.loan_requests lr
        LEFT JOIN public.staff s ON s.id = lr.staff_id
        WHERE lr.staff_id = $1::int
        ORDER BY lr.id DESC
        `,
        [staffId]
      );

      return res.json(r.rows);
    }

    const s = await pool.query(
      `
      SELECT id, branch_id, area, region
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

    if (isBranchManager(req)) {
      const branchCode = getUserBranchCode(req);
      const bid = await getBranchIdFromCode(branchCode);

      if (!bid || Number(staffRow.branch_id) !== Number(bid)) {
        return res.status(403).json({ message: "Access denied" });
      }
    }

    if (isAreaManager(req)) {
      const area = getUserArea(req);

      if (!area || toStr(staffRow.area).toLowerCase() !== area.toLowerCase()) {
        return res.status(403).json({ message: "Access denied" });
      }
    }

    if (isRegionalManager(req)) {
      const region = getUserRegion(req);

      if (!region || toStr(staffRow.region).toLowerCase() !== region.toLowerCase()) {
        return res.status(403).json({ message: "Access denied" });
      }
    }

    const r = await pool.query(
      `
      SELECT ${loanSelectFields}
      FROM public.loan_requests lr
      LEFT JOIN public.staff s ON s.id = lr.staff_id
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
});

/* ---------------- CREATE loan request ---------------- */
router.post(
  "/loan-requests",
  requireAuth,
  requireRole([
    "admin",
    "hr",
    "accounting",
    "tread",
    "branch manager",
    "area manager",
    "regional manager",
    "assistant vice president",
    "vice president",
    "senior vice president",
    "president",
  ]),
  upload.single("attachment"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const staff_id = toInt(req.body?.staff_id ?? req.body?.employee_id);
      const loan_type = toStr(req.body?.loan_type);
      const reason = toStr(req.body?.reason);

      const amount = toNum(req.body?.amount);
      const term = Math.max(1, toInt(req.body?.term) || 1);
      const interest = toNum(req.body?.interest);

      const computedTotal = amount + (amount * interest) / 100;
      const total = toNum(req.body?.total) || computedTotal;
      const per_month = toNum(req.body?.per_month) || (term ? total / term : total);

      const applicant_role = roleLower(req);
      const approval_stage = getInitialApprovalStage(applicant_role);
      const status = "Pending";

      const attachment_path = req.file ? `/uploads/loans/${req.file.filename}` : null;
      const attachment_name = req.file ? req.file.originalname : null;
      const attachment_mime = req.file ? req.file.mimetype : null;

      if (!staff_id) {
        return res.status(400).json({ message: "staff_id is required" });
      }

      if (!loan_type) {
        return res.status(400).json({ message: "loan_type is required" });
      }

      if (!amount) {
        return res.status(400).json({ message: "amount is required" });
      }

      if (!term) {
        return res.status(400).json({ message: "term is required" });
      }

      if (!reason) {
        return res.status(400).json({ message: "reason is required" });
      }

      await client.query("BEGIN");

      const s = await client.query(
        `
        SELECT id, employee_no, branch_id, area, region
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

        if (!area || toStr(staffRow.area).toLowerCase() !== area.toLowerCase()) {
          await client.query("ROLLBACK");
          return res.status(403).json({ message: "Access denied" });
        }
      }

      if (isRegionalManager(req)) {
        const region = getUserRegion(req);

        if (!region || toStr(staffRow.region).toLowerCase() !== region.toLowerCase()) {
          await client.query("ROLLBACK");
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const ins = await client.query(
        `
        INSERT INTO public.loan_requests
          (
            staff_id,
            employee_no,
            loan_type,
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
            $4::text,
            $5::numeric,
            $6::int,
            $7::numeric,
            $8::numeric,
            $9::numeric,
            $10::varchar,
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
          reason,
          amount,
          term,
          interest,
          total,
          per_month,
          status,
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

/* ---------------- upload approved signed file ---------------- */
router.post(
  "/loan-requests/:id/approved-file",
  requireAuth,
  requireRole([
    "admin",
    "hr",
    "accounting",
    "tread",
    "vice president",
    "senior vice president",
    "president",
  ]),
  upload.single("attachment"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const id = toInt(req.params.id);

      if (!id) {
        return res.status(400).json({ message: "Invalid id" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "Attachment is required" });
      }

      await client.query("BEGIN");

      const cur = await client.query(
        `
        SELECT id, status
        FROM loan_requests
        WHERE id = $1
        LIMIT 1
        `,
        [id]
      );

      if (cur.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Loan not found" });
      }

      if (String(cur.rows[0].status || "") !== "Approved") {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: "Approved signed file can only be uploaded after final approval",
        });
      }

      const approved_attachment_path = `/uploads/loans/${req.file.filename}`;
      const approved_attachment_name = req.file.originalname || null;
      const approved_attachment_mime = req.file.mimetype || null;

      await client.query(
        `
        UPDATE loan_requests
        SET
          approved_attachment_path = $2,
          approved_attachment_name = $3,
          approved_attachment_mime = $4
        WHERE id = $1
        `,
        [id, approved_attachment_path, approved_attachment_name, approved_attachment_mime]
      );

      await client.query("COMMIT");
      return res.json({ message: "Approved signed file uploaded successfully" });
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

/* ---------------- download original / approved loan file ---------------- */
router.get("/loan-requests/:id/download/:type", requireAuth, async (req, res) => {
  try {
    const id = toInt(req.params.id);
    const type = toStr(req.params.type).toLowerCase();

    if (!id) {
      return res.status(400).json({ message: "Invalid id" });
    }

    if (!["request", "approved"].includes(type)) {
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
      FROM loan_requests
      WHERE id = $1
      LIMIT 1
      `,
      [id]
    );

    if (r.rowCount === 0) {
      return res.status(404).json({ message: "Loan not found" });
    }

    const row = r.rows[0];

    if (!canDownloadLoanFiles(req)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const targetPath =
      type === "request" ? row.attachment_path : row.approved_attachment_path;
    const targetName =
      type === "request" ? row.attachment_name : row.approved_attachment_name;

    if (!targetPath) {
      return res.status(404).json({
        message: type === "request" ? "No request file found" : "No approved file found",
      });
    }

    const rel = String(targetPath).replace(/^\/uploads\//, "");
    const filePath = path.join(__dirname, "..", "uploads", rel);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        message: type === "request" ? "Request file not found" : "Approved file not found",
      });
    }

    return res.download(filePath, targetName || path.basename(filePath));
  } catch (e) {
    console.error("GET /api/loan-requests/:id/download/:type ERROR:", e);
    return res.status(500).json({ message: e?.message || "Server error" });
  }
});

/* ---------------- UPDATE loan request status ---------------- */
router.put("/loan-requests/:id", requireAuth, async (req, res) => {
  const client = await pool.connect();

  try {
    const id = toInt(req.params.id);
    const action = toStr(req.body?.action).toLowerCase();

    if (!id) {
      return res.status(400).json({ message: "Invalid id" });
    }

    if (!["approve", "reject"].includes(action)) {
      return res.status(400).json({ message: "Invalid action" });
    }

    const role = roleLower(req);

    await client.query("BEGIN");

    const cur = await client.query(
      `
      SELECT *
      FROM loan_requests
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

    const applicantRole = toStr(loan.applicant_role) || "";
    const chain = getApprovalChain(applicantRole);

    let currentStage = toStr(loan.approval_stage).toLowerCase();

    if (!chain.includes(currentStage)) {
      currentStage = chain[0] || "admin";
    }

    const canAct =
      currentStage === "admin" ? isFinalApprover(req) : role === currentStage;

    const highLevelOverride = isSeniorVicePresident(req) || isPresident(req);

    if (!canAct && !highLevelOverride) {
      await client.query("ROLLBACK");
      return res.status(403).json({ message: "Not your approval stage" });
    }

    const effectiveRole = currentStage;

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
        UPDATE loan_requests
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

    const currentIndex = chain.indexOf(effectiveRole);
    const nextStage = chain[currentIndex + 1];

    if (!nextStage) {
      await client.query(
        `
        UPDATE loan_requests
        SET
          status = 'Approved',
          ${column} = 'Approved',
          approved_at = CURRENT_DATE,
          disbursement_date = CURRENT_DATE
        WHERE id = $1
        `,
        [id]
      );

      const employeeNo = loan.employee_no;
      const total = toNum(loan.total) || toNum(loan.amount);
      const col = loanTypeToBalanceColumn(loan.loan_type);

      if (employeeNo && col) {
        await ensureBalanceRow(client, employeeNo);

        await client.query(
          `
          UPDATE staff_balances
          SET ${col} = COALESCE(${col}, 0) + $1,
              updated_at = NOW()
          WHERE employee_no = $2
          `,
          [total, employeeNo]
        );
      }

      await client.query("COMMIT");
      return res.json({ message: "Fully Approved" });
    }

    await client.query(
      `
      UPDATE loan_requests
      SET
        ${column} = 'Approved',
        approval_stage = $1
      WHERE id = $2
      `,
      [nextStage, id]
    );

    await client.query("COMMIT");
    return res.json({ message: `Moved to ${nextStage}` });
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {}

    console.error("Loan approval chain error:", err);
    return res.status(500).json({ message: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;