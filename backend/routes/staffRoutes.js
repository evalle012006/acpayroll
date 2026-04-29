const express = require("express");
const router = express.Router();
const pool = require("../db");
const { requireAuth, requireRole } = require("../middlewares/authMiddleware");

const {
  uploadToTemp,
  moveFromTemp,
  deleteKey,
  getSignedDownloadUrl,
} = require("../services/spacesUpload");

const toStr = (v) => String(v ?? "").trim();

const toInt = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

const toNum = (v) => {
  const s = String(v ?? "").trim();
  if (!s) return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

const toNumOrNull = (v) => {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const toDateOrNull = (v) => {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const d = s.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
};

const toEmailOrNull = (v) => {
  const s = String(v ?? "").trim();
  return s ? s : null;
};

const buildFullname = ({ last_name, first_name, middle_name, fullname }) => {
  const ln = toStr(last_name);
  const fn = toStr(first_name);
  const mn = toStr(middle_name);

  if (ln || fn || mn) {
    const mid = mn ? ` ${mn}` : "";
    return `${ln}${ln && fn ? ", " : ""}${fn}${mid}`.trim().replace(/\s+/g, " ");
  }
  return toStr(fullname);
};

const roleLower = (req) => String(req.user?.role || "").trim().toLowerCase();
const isAdmin = (req) => roleLower(req) === "admin";
const isBranchManager = (req) => roleLower(req) === "branch manager";
const isHr = (req) => roleLower(req) === "hr";
const isAccounting = (req) => roleLower(req) === "accounting";
const isTread = (req) => roleLower(req) === "tread";
const isAreaManager = (req) => roleLower(req) === "area manager";
const isRegionalManager = (req) => roleLower(req) === "regional manager";
const isAssistantVicePresident = (req) => roleLower(req) === "assistant vice president";
const isVicePresident = (req) => roleLower(req) === "vice president";
const isSeniorVicePresident = (req) => roleLower(req) === "senior vice president";
const isPresident = (req) => roleLower(req) === "president";

const isTopManagement = (req) =>
  isAdmin(req) ||
  isHr(req) ||
  isAccounting(req) ||
  isTread(req) ||
  isVicePresident(req) ||
  isSeniorVicePresident(req) ||
  isPresident(req);

const getUserArea = (req) => toStr(req.user?.area);
const getUserBranchCode = (req) => toStr(req.user?.branch_id);
const getUserDivision = (req) => toStr(req.user?.division);
const getUserRegion = (req) => toStr(req.user?.region);

const toJsonbArray = (v) => {
  try {
    const parsed = typeof v === "string" ? JSON.parse(v) : v;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const computeTotals = (body) => {
  const salary = toNum(body.salary);
  const ecola = toNum(body.ecola);

  const cbu = toNum(body.cbu);
  const cashbond = toNum(body.cashbond);
  const utility_charge = toNum(body.utility ?? body.utility_charge);

  const transportation = toNum(body.transportation);
  const repairing = toNum(body.repairing);
  const postage = toNum(body.postage);
  const other_deduction = toNum(body.other_deduction);

  const additional_target = toNum(body.additional_target);
  const additional_monitoring = toNum(body.additional_monitoring);
  const motorcycle = toNum(body.motorcycle);
  const motorcycle_loan = toNum(body.motorcycle_loan);

  const sss_er = toNum(body.sss_er);
  const ph_er = toNum(body.ph_er);
  const hdmf_er = toNum(body.hdmf_er);

  const sss_ee = toNum(body.sss_ee);
  const ph_ee = toNum(body.ph_ee);
  const hdmf_ee = toNum(body.hdmf_ee);

  const salary_total = salary + ecola;
  const personal_deductions_total = cbu + cashbond + utility_charge;

  const transport_allowances_total =
    transportation +
    repairing +
    postage +
    other_deduction +
    additional_target +
    additional_monitoring +
    motorcycle +
    motorcycle_loan;

  const total_er = sss_er + ph_er + hdmf_er;
  const total_ee = sss_ee + ph_ee + hdmf_ee;

  return {
    salary_total,
    personal_deductions_total,
    transport_allowances_total,
    total_er,
    total_ee,
    utility_charge,
  };
};

const generateEmployeeNoFromId = (id) => `EMP-${String(id).padStart(6, "0")}`;

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

async function canAccessStaffById(client, req, staffId) {
  const id = toInt(staffId);
  if (!id) return false;

  if (isTopManagement(req)) {
    return true;
  }

  const r = await client.query(
    `
    SELECT id, branch_id, area, region, division
    FROM public.staff
    WHERE id = $1
    LIMIT 1
    `,
    [id]
  );

  if (r.rowCount === 0) return false;

  const row = r.rows[0];

  if (isBranchManager(req)) {
    const branchCode = getUserBranchCode(req);
    const bid = await getBranchIdFromCode(branchCode);
    return !!bid && Number(row.branch_id) === Number(bid);
  }

  if (isAreaManager(req)) {
    const area = getUserArea(req);
    return !!area && toStr(row.area).toLowerCase() === area.toLowerCase();
  }

  if (isRegionalManager(req)) {
    const region = getUserRegion(req);
    return !!region && toStr(row.region).toLowerCase() === region.toLowerCase();
  }

  if (isAssistantVicePresident(req)) {
    const division = getUserDivision(req);
    return !!division && toStr(row.division).toLowerCase() === division.toLowerCase();
  }

  return false;
}

async function insertStaffFromBody(client, body) {
  const last_name = toStr(body.last_name);
  const first_name = toStr(body.first_name);
  const middle_name = toStr(body.middle_name);
  const fullname = buildFullname({
    last_name,
    first_name,
    middle_name,
    fullname: body.fullname,
  });
  const position = toStr(body.position);

  if (!last_name || !first_name || !position) {
    throw new Error("last_name, first_name, and position are required");
  }

  const requestedEmployeeNo = toStr(body.employee_no) || null;
  if (requestedEmployeeNo) {
    const dup = await client.query(
      `
      SELECT 1
      FROM public.staff
      WHERE LOWER(TRIM(employee_no)) = LOWER(TRIM($1))
      LIMIT 1
      `,
      [requestedEmployeeNo]
    );
    if (dup.rowCount > 0) {
      const err = new Error("Employee No already exists");
      err.statusCode = 409;
      throw err;
    }
  }

  const totals = computeTotals(body);

  const children = toJsonbArray(body.children);
  const education = toJsonbArray(body.education);
  const employment_history = toJsonbArray(body.employment_history);
  const beneficiaries = toJsonbArray(body.beneficiaries);

  const status = String(body.status || "Active");
  const branchId = toInt(body.branch_id);
  let finalArea = toStr(body.area) || null;
  let finalRegion = toStr(body.region) || null;
  let finalDivision = toStr(body.division) || null;

  if (branchId) {
    const branchRes = await client.query(
      `
      SELECT area, region, division
      FROM public.branches
      WHERE id = $1
      LIMIT 1
      `,
      [branchId]
    );

    if (branchRes.rowCount > 0) {
      const b = branchRes.rows[0];

      finalArea = toStr(body.area) || toStr(b.area) || null;
      finalRegion = toStr(body.region) || toStr(b.region) || null;
      finalDivision = toStr(body.division) || toStr(b.division) || null;
    }
  }

  const ins = await client.query(
    `
    INSERT INTO public.staff
      (
        employee_no, last_name, first_name, middle_name, fullname,

        address, municipality, province, contact, email,
        date_of_birth, place_of_birth, gender, civil_status, citizenship,
        height, weight, religion, blood_type,

        "position", department, area, region, division,
        branch_id, status,
        start_date, regularization_date,

        salary, ecola,
        salary_total,

        cbu, cashbond, utility_charge,
        personal_deductions_total,

        transportation, postage, motorcycle_loan,
        additional_target, repairing, additional_monitoring,
        motorcycle, other_deduction,
        transport_allowances_total,

        hdmf_er, sss_er, ph_er, total_er,
        hdmf_ee, sss_ee, ph_ee, total_ee,
        tax,

        spouse_fullname, spouse_address, spouse_occupation, spouse_employer,
        father_fullname, father_address, father_occupation, father_employer, father_contact,
        mother_fullname, mother_address, mother_occupation, mother_employer, mother_contact,
        guardian_fullname, guardian_address, guardian_occupation, guardian_employer, guardian_contact,
        sss_no, philhealth_no, tin_no, pagibig_no,
        children, education, employment_history, beneficiaries
      )
    VALUES
      (
        $1,$2,$3,$4,$5,

        $6,$7,$8,$9,$10,
        $11,$12,$13,$14,$15,
        $16,$17,$18,$19,

        $20,$21,$22,$23,$24,
        $25,$26,
        $27,$28,

        $29,$30,
        $31,

        $32,$33,$34,
        $35,

        $36,$37,$38,
        $39,$40,$41,
        $42,$43,
        $44,

        $45,$46,$47,$48,
        $49,$50,$51,$52,
        $53,

        $54,$55,$56,$57,
        $58,$59,$60,$61,$62,
        $63,$64,$65,$66,$67,
        $68,$69,$70,$71,$72,
        $73,$74,$75,$76,
        $77::jsonb,$78::jsonb,$79::jsonb,$80::jsonb
      )
    RETURNING id;
    `,
    [
      requestedEmployeeNo,
      last_name,
      first_name,
      middle_name || null,
      fullname,

      toStr(body.address) || null,
      toStr(body.municipality) || null,
      toStr(body.province) || null,
      toStr(body.contact) || null,
      toEmailOrNull(body.email),

      toDateOrNull(body.date_of_birth),
      toStr(body.place_of_birth) || null,
      toStr(body.gender) || null,
      toStr(body.civil_status) || null,
      toStr(body.citizenship) || null,

      toNumOrNull(body.height),
      toNumOrNull(body.weight),
      toStr(body.religion) || null,
      toStr(body.blood_type) || null,

      position,
      toStr(body.department) || null,
      finalArea,
      finalRegion,
      finalDivision,

      branchId,
      status,

      toDateOrNull(body.start_date),
      toDateOrNull(body.regularization_date),

      toNumOrNull(body.salary),
      toNumOrNull(body.ecola),
      totals.salary_total,

      toNum(body.cbu),
      toNum(body.cashbond),
      totals.utility_charge,
      totals.personal_deductions_total,

      toNum(body.transportation),
      toNum(body.postage),
      toNum(body.motorcycle_loan),

      toNum(body.additional_target),
      toNum(body.repairing),
      toNum(body.additional_monitoring),

      toNum(body.motorcycle),
      toNum(body.other_deduction),
      totals.transport_allowances_total,

      toNum(body.hdmf_er),
      toNum(body.sss_er),
      toNum(body.ph_er),
      totals.total_er,

      toNum(body.hdmf_ee),
      toNum(body.sss_ee),
      toNum(body.ph_ee),
      totals.total_ee,

      toNum(body.tax),

      toStr(body.spouse_fullname) || null,
      toStr(body.spouse_address) || null,
      toStr(body.spouse_occupation) || null,
      toStr(body.spouse_employer) || null,

      toStr(body.father_fullname) || null,
      toStr(body.father_address) || null,
      toStr(body.father_occupation) || null,
      toStr(body.father_employer) || null,
      toStr(body.father_contact) || null,

      toStr(body.mother_fullname) || null,
      toStr(body.mother_address) || null,
      toStr(body.mother_occupation) || null,
      toStr(body.mother_employer) || null,
      toStr(body.mother_contact) || null,

      toStr(body.guardian_fullname) || null,
      toStr(body.guardian_address) || null,
      toStr(body.guardian_occupation) || null,
      toStr(body.guardian_employer) || null,
      toStr(body.guardian_contact) || null,

      toStr(body.sss_no) || null,
      toStr(body.philhealth_no) || null,
      toStr(body.tin_no) || null,
      toStr(body.pagibig_no) || null,

      JSON.stringify(children),
      JSON.stringify(education),
      JSON.stringify(employment_history),
      JSON.stringify(beneficiaries),
    ]
  );

  const newId = ins.rows[0].id;
  const finalEmployeeNo = requestedEmployeeNo || generateEmployeeNoFromId(newId);

  await client.query(
    `UPDATE public.staff SET employee_no = $1 WHERE id = $2`,
    [finalEmployeeNo, newId]
  );

  return { id: newId, employee_no: finalEmployeeNo };
}

router.get("/staff", requireAuth, async (req, res) => {
  try {
    if (isTopManagement(req)) {
      const r = await pool.query(`
        SELECT s.*,
               b.name AS branch_name,
               b.code AS branch_code
        FROM public.staff s
        LEFT JOIN public.branches b ON b.id = s.branch_id
        ORDER BY s.id DESC
      `);
      return res.json(r.rows);
    }

    if (isBranchManager(req)) {
      const branchCode = getUserBranchCode(req);
      if (!branchCode) return res.json([]);

      const bid = await getBranchIdFromCode(branchCode);
      if (!bid) return res.json([]);

      const r = await pool.query(
        `
        SELECT s.*,
               b.name AS branch_name,
               b.code AS branch_code
        FROM public.staff s
        LEFT JOIN public.branches b ON b.id = s.branch_id
        WHERE s.branch_id = $1
        ORDER BY s.id DESC
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
        SELECT s.*,
               b.name AS branch_name,
               b.code AS branch_code
        FROM public.staff s
        LEFT JOIN public.branches b ON b.id = s.branch_id
        WHERE LOWER(TRIM(COALESCE(s.area, ''))) = LOWER(TRIM($1))
        ORDER BY s.id DESC
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
        SELECT s.*,
               b.name AS branch_name,
               b.code AS branch_code
        FROM public.staff s
        LEFT JOIN public.branches b ON b.id = s.branch_id
        WHERE LOWER(TRIM(COALESCE(s.region, ''))) = LOWER(TRIM($1))
        ORDER BY s.id DESC
        `,
        [region]
      );
      return res.json(r.rows);
    }

    if (isAssistantVicePresident(req)) {
      const division = getUserDivision(req);
      if (!division) return res.json([]);

      const r = await pool.query(
        `
        SELECT s.*,
               b.name AS branch_name,
               b.code AS branch_code
        FROM public.staff s
        LEFT JOIN public.branches b ON b.id = s.branch_id
        WHERE LOWER(TRIM(COALESCE(s.division, ''))) = LOWER(TRIM($1))
        ORDER BY s.id DESC
        `,
        [division]
      );
      return res.json(r.rows);
    }

    return res.status(403).json({ message: "Access denied" });
  } catch (e) {
    console.error("GET /api/staff ERROR:", e.message);
    return res.status(500).json({ message: "Server error" });
  }
});

router.post(
  "/staff",
  requireAuth,
  requireRole(["admin", "hr", "accounting"]),
  async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const created = await insertStaffFromBody(client, req.body || {});
      await client.query("COMMIT");
      return res.json({ message: "Staff added", id: created.id, employee_no: created.employee_no });
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("POST /api/staff ERROR:", e.message);
      return res.status(e.statusCode || 500).json({ message: e?.message || "Server error" });
    } finally {
      client.release();
    }
  }
);

router.get(
  "/pending-staff",
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
    "president",
  ]),
  async (_req, res) => {
    try {
      const r = await pool.query(`
        SELECT
          id,
          payload,
          status,
          created_by,
          approved_by,
          approved_at,
          rejected_at,
          rejection_reason,
          created_at
        FROM public.pending_staff_requests
        ORDER BY created_at DESC, id DESC
      `);

      return res.json(r.rows);
    } catch (e) {
      console.error("GET /api/pending-staff ERROR:", e.message);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

router.post(
  "/pending-staff",
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
    "president",
  ]),
  async (req, res) => {
    try {
      const body = req.body || {};

      const last_name = toStr(body.last_name);
      const first_name = toStr(body.first_name);
      const position = toStr(body.position);

      if (!last_name || !first_name || !position) {
        return res.status(400).json({ message: "last_name, first_name, and position are required" });
      }

      const requestedEmployeeNo = toStr(body.employee_no);
      if (requestedEmployeeNo) {
        const dupStaff = await pool.query(
          `
          SELECT 1
          FROM public.staff
          WHERE LOWER(TRIM(employee_no)) = LOWER(TRIM($1))
          LIMIT 1
          `,
          [requestedEmployeeNo]
        );

        if (dupStaff.rowCount > 0) {
          return res.status(409).json({ message: "Employee No already exists" });
        }
      }

      const r = await pool.query(
        `
        INSERT INTO public.pending_staff_requests
          (payload, status, created_by)
        VALUES
          ($1::jsonb, 'Pending', $2)
        RETURNING id, status, created_at
        `,
        [JSON.stringify(body), req.user?.id || null]
      );

      return res.json({
        message: "Submitted for approval",
        request: r.rows[0],
      });
    } catch (e) {
      console.error("POST /api/pending-staff ERROR:", e.message);
      return res.status(500).json({ message: e?.message || "Server error" });
    }
  }
);

router.put(
  "/pending-staff/:id/approve",
  requireAuth,
  requireRole(["admin", "hr", "accounting"]),
  async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const id = toInt(req.params.id);
      if (!id) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Invalid pending staff id" });
      }

      const pendingRes = await client.query(
        `
        SELECT *
        FROM public.pending_staff_requests
        WHERE id = $1
        FOR UPDATE
        `,
        [id]
      );

      if (pendingRes.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Pending request not found" });
      }

      const pending = pendingRes.rows[0];

      if (String(pending.status || "").toLowerCase() !== "pending") {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Request already processed" });
      }

      const body =
        typeof pending.payload === "string"
          ? JSON.parse(pending.payload || "{}")
          : pending.payload || {};

      const created = await insertStaffFromBody(client, body);

      await client.query(
        `
        UPDATE public.pending_staff_requests
        SET
          status = 'Approved',
          approved_by = $2,
          approved_at = NOW()
        WHERE id = $1
        `,
        [id, req.user?.id || null]
      );

      await client.query("COMMIT");

      return res.json({
        message: "Approved and added to staff",
        staff_id: created.id,
        employee_no: created.employee_no,
      });
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("PUT /api/pending-staff/:id/approve ERROR:", e.message);
      return res.status(e.statusCode || 500).json({ message: e?.message || "Server error" });
    } finally {
      client.release();
    }
  }
);

router.put(
  "/pending-staff/:id/reject",
  requireAuth,
  requireRole(["admin", "hr", "accounting"]),
  async (req, res) => {
    try {
      const id = toInt(req.params.id);
      if (!id) {
        return res.status(400).json({ message: "Invalid pending staff id" });
      }

      const rejection_reason = toStr(req.body?.rejection_reason) || null;

      const r = await pool.query(
        `
        UPDATE public.pending_staff_requests
        SET
          status = 'Rejected',
          rejected_at = NOW(),
          rejection_reason = $2
        WHERE id = $1
          AND status = 'Pending'
        RETURNING id
        `,
        [id, rejection_reason]
      );

      if (r.rowCount === 0) {
        return res.status(404).json({ message: "Pending request not found or already processed" });
      }

      return res.json({ message: "Rejected" });
    } catch (e) {
      console.error("PUT /api/pending-staff/:id/reject ERROR:", e.message);
      return res.status(500).json({ message: e?.message || "Server error" });
    }
  }
);

router.put(
  "/staff/:id",
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
    "president",
  ]),
  async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const id = toInt(req.params.id);
      if (!id) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Invalid staff id" });
      }

      const allowed = await canAccessStaffById(client, req, id);
      if (!allowed) {
        await client.query("ROLLBACK");
        return res.status(403).json({ message: "Access denied" });
      }

      const existing = await client.query(
        `
        SELECT id, employee_no, status
        FROM public.staff
        WHERE id = $1
        FOR UPDATE
        `,
        [id]
      );

      if (existing.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Staff not found" });
      }

      const body = req.body || {};

      console.log("PUT /api/staff/:id BODY =", body);

      const last_name = toStr(body.last_name);
      const first_name = toStr(body.first_name);
      const middle_name = toStr(body.middle_name);
      const fullname = buildFullname({
        last_name,
        first_name,
        middle_name,
        fullname: body.fullname,
      });
      const position = toStr(body.position);

      if (!last_name || !first_name || !position) {
        await client.query("ROLLBACK");
        return res
          .status(400)
          .json({ message: "last_name, first_name, and position are required" });
      }

      const employeeNo = toStr(body.employee_no) || null;
      const finalEmployeeNo = employeeNo || toStr(existing.rows[0]?.employee_no) || null;

      if (finalEmployeeNo) {
        const dup = await client.query(
          `
          SELECT 1
          FROM public.staff
          WHERE LOWER(TRIM(employee_no)) = LOWER(TRIM($1))
            AND id <> $2
          LIMIT 1
          `,
          [finalEmployeeNo, id]
        );

        if (dup.rowCount > 0) {
          await client.query("ROLLBACK");
          return res.status(409).json({ message: "Employee No already exists" });
        }
      }

      const totals = computeTotals(body);

      const children = toJsonbArray(body.children);
      const education = toJsonbArray(body.education);
      const employment_history = toJsonbArray(body.employment_history);
      const beneficiaries = toJsonbArray(body.beneficiaries);

      const oldStatus = toStr(existing.rows[0]?.status || "Active");
      const newStatus = toStr(body.status || oldStatus || "Active");

      const branchId = toInt(body.branch_id);

      let finalArea = toStr(body.area) || null;
      let finalRegion = toStr(body.region) || null;
      let finalDivision = toStr(body.division) || null;

      if (branchId) {
        const branchRes = await client.query(
          `
          SELECT area, region, division
          FROM public.branches
          WHERE id = $1
          LIMIT 1
          `,
          [branchId]
        );

        if (branchRes.rowCount > 0) {
          const b = branchRes.rows[0];

          finalArea = toStr(body.area) || toStr(b.area) || null;
          finalRegion = toStr(body.region) || toStr(b.region) || null;
          finalDivision = toStr(body.division) || toStr(b.division) || null;
        }
      }

      const r = await client.query(
        `
        UPDATE public.staff
        SET
          employee_no=$1, last_name=$2, first_name=$3, middle_name=$4, fullname=$5,

          address=$6, municipality=$7, province=$8, contact=$9, email=$10,
          date_of_birth=$11, place_of_birth=$12, gender=$13, civil_status=$14, citizenship=$15,
          height=$16, weight=$17, religion=$18, blood_type=$19,

          "position"=$20, department=$21, area=$22, region=$23, division=$24,
          branch_id=$25, status=$26,
          start_date=$27, regularization_date=$28,

          salary=$29, ecola=$30,
          salary_total=$31,

          cbu=$32, cashbond=$33, utility_charge=$34,
          personal_deductions_total=$35,

          transportation=$36, postage=$37, motorcycle_loan=$38,
          additional_target=$39, repairing=$40, additional_monitoring=$41,
          motorcycle=$42, other_deduction=$43,
          transport_allowances_total=$44,

          hdmf_er=$45, sss_er=$46, ph_er=$47, total_er=$48,
          hdmf_ee=$49, sss_ee=$50, ph_ee=$51, total_ee=$52,
          tax=$53,

          spouse_fullname=$54, spouse_address=$55, spouse_occupation=$56, spouse_employer=$57,
          father_fullname=$58, father_address=$59, father_occupation=$60, father_employer=$61, father_contact=$62,
          mother_fullname=$63, mother_address=$64, mother_occupation=$65, mother_employer=$66, mother_contact=$67,
          guardian_fullname=$68, guardian_address=$69, guardian_occupation=$70, guardian_employer=$71, guardian_contact=$72,
          sss_no=$73, philhealth_no=$74, pagibig_no=$75, tin_no=$76,
          children=$77::jsonb,
            education=$78::jsonb,
            employment_history=$79::jsonb,
            beneficiaries=$80::jsonb,

            annual_leave=$81,
            sick_leave=$82,
            emergency_leave=$83,
            maternity_leave=$84,
            parental_leave=$85

            WHERE id=$86
        RETURNING id, employee_no, status
        `,
        [
          finalEmployeeNo,
          last_name,
          first_name,
          middle_name || null,
          fullname,

          toStr(body.address) || null,
          toStr(body.municipality) || null,
          toStr(body.province) || null,
          toStr(body.contact) || null,
          toEmailOrNull(body.email),

          toDateOrNull(body.date_of_birth),
          toStr(body.place_of_birth) || null,
          toStr(body.gender) || null,
          toStr(body.civil_status) || null,
          toStr(body.citizenship) || null,

          toNumOrNull(body.height),
          toNumOrNull(body.weight),
          toStr(body.religion) || null,
          toStr(body.blood_type) || null,

          position,
          toStr(body.department) || null,
          finalArea,
          finalRegion,
          finalDivision,

          branchId,
          newStatus || "Active",

          toDateOrNull(body.start_date),
          toDateOrNull(body.regularization_date),

          toNumOrNull(body.salary),
          toNumOrNull(body.ecola),
          totals.salary_total,

          toNum(body.cbu),
          toNum(body.cashbond),
          totals.utility_charge,
          totals.personal_deductions_total,

          toNum(body.transportation),
          toNum(body.postage),
          toNum(body.motorcycle_loan),

          toNum(body.additional_target),
          toNum(body.repairing),
          toNum(body.additional_monitoring),

          toNum(body.motorcycle),
          toNum(body.other_deduction),
          totals.transport_allowances_total,

          toNum(body.hdmf_er),
          toNum(body.sss_er),
          toNum(body.ph_er),
          totals.total_er,

          toNum(body.hdmf_ee),
          toNum(body.sss_ee),
          toNum(body.ph_ee),
          totals.total_ee,

          toNum(body.tax),

          toStr(body.spouse_fullname) || null,
          toStr(body.spouse_address) || null,
          toStr(body.spouse_occupation) || null,
          toStr(body.spouse_employer) || null,

          toStr(body.father_fullname) || null,
          toStr(body.father_address) || null,
          toStr(body.father_occupation) || null,
          toStr(body.father_employer) || null,
          toStr(body.father_contact) || null,

          toStr(body.mother_fullname) || null,
          toStr(body.mother_address) || null,
          toStr(body.mother_occupation) || null,
          toStr(body.mother_employer) || null,
          toStr(body.mother_contact) || null,

          toStr(body.guardian_fullname) || null,
          toStr(body.guardian_address) || null,
          toStr(body.guardian_occupation) || null,
          toStr(body.guardian_employer) || null,
          toStr(body.guardian_contact) || null,

          toStr(body.sss_no) || null,
          toStr(body.philhealth_no) || null,
          toStr(body.pagibig_no) || null,
          toStr(body.tin_no) || null,

          JSON.stringify(children),
          JSON.stringify(education),
          JSON.stringify(employment_history),
          JSON.stringify(beneficiaries),

          toNum(body.annual_leave),
          toNum(body.sick_leave),
          toNum(body.emergency_leave),
          toNum(body.maternity_leave),
          toNum(body.parental_leave),

          id,
        ]
      );

      if (r.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Staff not found" });
      }

      if (finalEmployeeNo && oldStatus !== newStatus) {
        const effectiveDate =
          toDateOrNull(body.status_effective_date) ||
          toDateOrNull(body.reactivation_date) ||
          toDateOrNull(body.exit_date) ||
          new Date().toISOString().slice(0, 10);

        await client.query(
          `
          INSERT INTO public.status_history
            (employee_no, effective_date, status, reason, remarks)
          VALUES
            ($1, $2::date, $3, $4, $5)
          ON CONFLICT DO NOTHING
          `,
          [
            finalEmployeeNo,
            effectiveDate,
            newStatus === "Inactive" ? "Inactive" : "Active",
            newStatus === "Inactive" ? "Manual Inactive" : "Reactivated",
            toStr(body.status_remarks) || null,
          ]
        );
      }

      await client.query("COMMIT");
      return res.json({ message: "Staff updated" });
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("PUT /api/staff/:id ERROR:", e);
      return res.status(500).json({
        message: e?.message || "Server error",
        detail: e?.detail || null,
      });
    } finally {
      client.release();
    }
  }
);

router.delete("/staff/:id", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid staff id" });

    const r = await pool.query("DELETE FROM public.staff WHERE id=$1 RETURNING id", [id]);
    if (r.rowCount === 0) return res.status(404).json({ message: "Staff not found" });

    return res.json({ message: "Staff deleted" });
  } catch (e) {
    console.error("DELETE /api/staff/:id ERROR:", e.message);
    return res.status(500).json({ message: "Server error" });
  }
});

router.post(
  "/staff/:id/photo",
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
    "president",
  ]),
  uploadToTemp,
  async (req, res) => {
    const client = await pool.connect();

    try {
      const staffId = toInt(req.params.id);

      if (!staffId) {
        if (req.file?.key) await deleteKey(req.file.key).catch(() => {});
        return res.status(400).json({ message: "Invalid staff id." });
      }

      if (!req.file?.key) {
        return res.status(400).json({ message: "No file uploaded." });
      }

      const allowed = await canAccessStaffById(client, req, staffId);

      if (!allowed) {
        if (req.file?.key) await deleteKey(req.file.key).catch(() => {});
        return res.status(403).json({ message: "Access denied" });
      }

      const finalKey = await moveFromTemp(
        req.file.key,
        "staff",
        String(staffId),
        req.file.originalname || "photo.jpg"
      );

      await client.query(
        `UPDATE public.staff SET photo_url = $1 WHERE id = $2`,
        [finalKey, staffId]
      );

      return res.json({
        message: "Photo uploaded",
        photo_key: finalKey,
      });
    } catch (e) {
      console.error("POST /api/staff/:id/photo ERROR:", e);

      if (req.file?.key) {
        await deleteKey(req.file.key).catch(() => {});
      }

      return res.status(500).json({
        message: e?.message || "Server error",
      });
    } finally {
      client.release();
    }
  }
);

router.get("/file-url", requireAuth, async (req, res) => {
  try {
    const { key } = req.query;

    if (!key) {
      return res.status(400).json({ message: "Key is required" });
    }

    const url = await getSignedDownloadUrl(key);

    res.json({ url });
  } catch (err) {
    console.error("SIGNED URL ERROR:", err);
    res.status(500).json({ message: "Failed to generate signed URL" });
  }
});

router.get(
  "/staff/:id/photo-url",
  requireAuth,
  async (req, res) => {
    const client = await pool.connect();
    try {
      const staffId = toInt(req.params.id);
      if (!staffId) return res.status(400).json({ message: "Invalid staff id." });

      const result = await client.query(
        `SELECT photo_url FROM public.staff WHERE id = $1`,
        [staffId]
      );

      const key = result.rows[0]?.photo_url;
      if (!key) return res.status(404).json({ message: "No photo on file." });

      const signedUrl = await getSignedDownloadUrl(key, 3600);
      return res.json({ url: signedUrl, expiresIn: 3600 });
    } catch (e) {
      console.error("GET /staff/:id/photo-url ERROR:", e.message);
      return res.status(500).json({ message: "Server error" });
    } finally {
      client.release();
    }
  }
);

module.exports = router;