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

const toDate = (v) => {
  const s = String(v ?? "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};

const toStr = (v) => String(v ?? "").trim();

const roleLower = (req) => String(req.user?.role || "").trim().toLowerCase();
const isAdmin = (req) => roleLower(req) === "admin";
const isHr = (req) => roleLower(req) === "hr";
const isAccounting = (req) => roleLower(req) === "accounting";
const isBranchManager = (req) => roleLower(req) === "branch manager";
const isAreaManager = (req) => roleLower(req) === "area manager";
const isRegionalManager = (req) => roleLower(req) === "regional manager";
const isAssistantVicePresident = (req) =>
  roleLower(req) === "assistant vice president";

const getUserBranchCode = (req) => toStr(req.user?.branch_id);
const getUserArea = (req) => toStr(req.user?.area);
const getUserRegion = (req) => toStr(req.user?.region);

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
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
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
  COALESCE(s.fullname, '') AS staff_name,
  s.first_name,
  s.last_name,
  s.middle_name
`;

/* ---------------- GET all loans ---------------- */
router.get("/loan-requests", requireAuth, async (req, res) => {
  try {
    if (isAdmin(req) || isHr(req) || isAccounting(req) || isAssistantVicePresident(req)) {
      const r = await pool.query(
        `
        SELECT
          ${loanSelectFields}
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
        SELECT
          ${loanSelectFields}
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
        SELECT
          ${loanSelectFields}
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
        SELECT
          ${loanSelectFields}
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
      SELECT
        ${loanSelectFields}
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
    "branch manager",
    "area manager",
    "regional manager",
    "assistant vice president",
    "vice president",
    "senior vice president",
  ]),
  upload.single("attachment"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const staff_id = toInt(req.body?.staff_id ?? req.body?.employee_id);
      const loan_type = String(req.body?.loan_type || "").trim();
      const reason = String(req.body?.reason || "").trim();

      const amount = toNum(req.body?.amount);
      const term = Math.max(1, toInt(req.body?.term) || 1);
      const interest = toNum(req.body?.interest);

      const computedTotal = amount + (amount * interest) / 100;
      const total = toNum(req.body?.total) || computedTotal;
      const per_month = toNum(req.body?.per_month) || (term ? total / term : total);

      const status = String(req.body?.status || "Pending").trim() || "Pending";

      const approved_at = req.body?.approved_at ? toDate(req.body.approved_at) : null;
      const disbursement_date = req.body?.disbursement_date
        ? toDate(req.body.disbursement_date)
        : null;

      const attachment_path = req.file ? `/uploads/loans/${req.file.filename}` : null;
      const attachment_name = req.file ? req.file.originalname : null;
      const attachment_mime = req.file ? req.file.mimetype : null;

      if (!staff_id) return res.status(400).json({ message: "staff_id is required" });
      if (!loan_type) return res.status(400).json({ message: "loan_type is required" });
      if (!amount) return res.status(400).json({ message: "amount is required" });
      if (!term) return res.status(400).json({ message: "term is required" });
      if (!reason) return res.status(400).json({ message: "reason is required" });

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
            approved_at,
            disbursement_date,
            attachment_path,
            attachment_name,
            attachment_mime
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
            $11::date,
            $12::date,
            $13::text,
            $14::text,
            $15::text
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
          approved_at,
          disbursement_date,
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

/* ---------------- UPDATE loan request status ---------------- */
router.put("/loan-requests/:id", requireAuth, async (req, res) => {
  const client = await pool.connect();

  try {
    const id = toInt(req.params.id);
    const action = String(req.body?.action || "").toLowerCase();

    if (!id) return res.status(400).json({ message: "Invalid id" });
    if (!["approve", "reject"].includes(action)) {
      return res.status(400).json({ message: "Invalid action" });
    }

    const role = roleLower(req);

    await client.query("BEGIN");

    const cur = await client.query(
      `SELECT * FROM loan_requests WHERE id = $1 FOR UPDATE`,
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

    const chain = [
      "branch manager",
      "area manager",
      "regional manager",
      "assistant vice president",
      "admin",
    ];

    let currentStage = loan.approval_stage || "branch manager";

    if (role !== currentStage) {
      await client.query("ROLLBACK");
      return res.status(403).json({ message: "Not your approval stage" });
    }

    const statusColumnMap = {
      "branch manager": "branch_manager_status",
      "area manager": "area_manager_status",
      "regional manager": "regional_manager_status",
      "assistant vice president": "assistant_vice_president_status",
      admin: "admin_status",
    };

    const column = statusColumnMap[role];

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

    // APPROVE FLOW
    const currentIndex = chain.indexOf(role);
    const nextStage = chain[currentIndex + 1];

    if (!nextStage) {
      // FINAL APPROVAL (ADMIN)
      await client.query(
        `
        UPDATE loan_requests
        SET
          status = 'Approved',
          ${column} = 'Approved',
          approved_at = CURRENT_DATE
        WHERE id = $1
        `,
        [id]
      );

      // APPLY TO BALANCE
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

    // MOVE TO NEXT STAGE
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