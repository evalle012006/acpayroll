const express = require("express");
const router = express.Router();
const pool = require("../db");
const { requireAuth, requireRole } = require("../middlewares/authMiddleware");

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
const isBranchManager = (req) => roleLower(req) === "branch manager";
const getUserBranchCode = (req) => toStr(req.user?.branch_id);

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
    const err = new Error("last_name, first_name, and position are required");
    err.statusCode = 400;
    throw err;
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
      toStr(body.area) || null,
      toStr(body.region) || null,
      toStr(body.division) || null,

      toInt(body.branch_id),
      String(body.status || "Active"),

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

router.get(
  "/pending-staff",
  requireAuth,
  requireRole(["admin", "hr", "accounting", "branch manager"]),
  async (req, res) => {
    try {
      const result = await pool.query(`
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

      let rows = result.rows;

      if (isBranchManager(req)) {
        const branchCode = getUserBranchCode(req);
        const branchId = await getBranchIdFromCode(branchCode);

        rows = rows.filter((r) => {
          const payload =
            typeof r.payload === "string"
              ? JSON.parse(r.payload || "{}")
              : r.payload || {};

          return String(payload.branch_id || "") === String(branchId || "");
        });
      }

      return res.json(rows);
    } catch (err) {
      console.error("GET /pending-staff ERROR:", err.message);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

router.post(
  "/pending-staff",
  requireAuth,
  requireRole(["admin", "hr", "accounting", "branch manager"]),
  async (req, res) => {
    try {
      const body = req.body || {};

      const last_name = toStr(body.last_name);
      const first_name = toStr(body.first_name);
      const position = toStr(body.position);

      if (!last_name || !first_name || !position) {
        return res.status(400).json({
          message: "last_name, first_name, and position are required",
        });
      }

      const employeeNo = toStr(body.employee_no);
      if (employeeNo) {
        const dup = await pool.query(
          `
          SELECT 1
          FROM public.staff
          WHERE LOWER(TRIM(employee_no)) = LOWER(TRIM($1))
          LIMIT 1
          `,
          [employeeNo]
        );

        if (dup.rowCount > 0) {
          return res.status(409).json({
            message: "Employee No already exists",
          });
        }
      }

      const result = await pool.query(
        `
        INSERT INTO public.pending_staff_requests
          (payload, status, created_by)
        VALUES
          ($1::jsonb, 'Pending', $2)
        RETURNING
          id,
          payload,
          status,
          created_by,
          approved_by,
          approved_at,
          rejected_at,
          rejection_reason,
          created_at
        `,
        [JSON.stringify(body), req.user?.id || null]
      );

      return res.json({
        message: "Submitted for approval",
        request: result.rows[0],
      });
    } catch (err) {
      console.error("POST /pending-staff ERROR:", err.message);
      return res.status(500).json({
        message: err?.message || "Server error",
      });
    }
  }
);

router.put(
  "/pending-staff/:id/approve",
  requireAuth,
  requireRole(["admin"]),
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
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("PUT /pending-staff/:id/approve ERROR:", err.message);
      return res.status(err.statusCode || 500).json({
        message: err?.message || "Server error",
      });
    } finally {
      client.release();
    }
  }
);

router.put(
  "/pending-staff/:id/reject",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    try {
      const id = toInt(req.params.id);
      if (!id) {
        return res.status(400).json({ message: "Invalid pending staff id" });
      }

      const rejection_reason = toStr(req.body?.rejection_reason) || null;

      const result = await pool.query(
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

      if (result.rowCount === 0) {
        return res.status(404).json({
          message: "Pending request not found or already processed",
        });
      }

      return res.json({ message: "Rejected" });
    } catch (err) {
      console.error("PUT /pending-staff/:id/reject ERROR:", err.message);
      return res.status(500).json({
        message: err?.message || "Server error",
      });
    }
  }
);

module.exports = router;