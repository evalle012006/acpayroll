const express = require("express");
const router = express.Router();
const pool = require("../db");
const { requireAuth, requireRole } = require("../middlewares/authMiddleware");

/* ================= HELPERS ================= */
const toInt = (v) => {
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
};

const toNum = (v) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const toStr = (v) => String(v ?? "").trim();
const norm = (v) => toStr(v).toLowerCase();

const toDate = (v) => {
  const s = String(v ?? "").trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};

const asObject = (v) => {
  if (!v) return {};
  if (typeof v === "object") return v;
  try {
    return JSON.parse(v);
  } catch {
    return {};
  }
};

const safeJsonArray = (v) => {
  try {
    const parsed = typeof v === "string" ? JSON.parse(v) : v;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const cleanText = (v) => {
  const s = toStr(v);
  if (!s) return "";
  if (s === "-") return "";
  if (s.toLowerCase() === "null") return "";
  if (s.toLowerCase() === "undefined") return "";
  return s;
};

const roleLower = (req) => toStr(req.user?.role).toLowerCase();
const isBranchManager = (req) => roleLower(req) === "branch manager";

async function getBranchById(client, branchId) {
  const id = toInt(branchId);
  if (!id) return null;

  const result = await client.query(
    `
    SELECT
      id,
      code,
      name,
      area,
      region,
      division
    FROM public.branches
    WHERE id = $1
    LIMIT 1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function syncStaffBalancesFromStaff(client, staffId) {
  const staffRes = await client.query(
    `
    SELECT
      employee_no,
      cbu,
      cashbond,
      utility_charge,
      utility,
      other_receivable,
      staff_accounts_payable
    FROM public.staff
    WHERE id = $1
    LIMIT 1
    `,
    [staffId]
  );

  if (staffRes.rowCount === 0) return;

  const s = staffRes.rows[0];
  const employeeNo = toStr(s.employee_no);
  if (!employeeNo) return;

  await client.query(
    `
    INSERT INTO public.staff_balances
      (
        employee_no,
        cbu,
        cashbond,
        utility,
        other_receivable,
        staff_accounts_payable
      )
    VALUES
      ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (employee_no)
    DO UPDATE SET
      cbu = EXCLUDED.cbu,
      cashbond = EXCLUDED.cashbond,
      utility = EXCLUDED.utility,
      other_receivable = EXCLUDED.other_receivable,
      staff_accounts_payable = EXCLUDED.staff_accounts_payable
    `,
    [
      employeeNo,
      toNum(s.cbu),
      toNum(s.cashbond),
      toNum(s.utility ?? s.utility_charge),
      toNum(s.other_receivable),
      toNum(s.staff_accounts_payable),
    ]
  );
}

/* =========================================================
   GET ALL PENDING STAFF
   (Branch Manager = only their branch)
========================================================= */
router.get(
  "/pending-staff",
  requireAuth,
  requireRole(["admin", "hr", "accounting", "branch manager"]),
  async (req, res) => {
    try {
      const userBranch = toStr(req.user?.branch_id);

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
        WHERE LOWER(COALESCE(status, '')) = 'pending'
        ORDER BY created_at DESC, id DESC
      `);

      let rows = result.rows.map((row) => {
        const payload = asObject(row.payload);
        return {
          ...row,
          payload,
        };
      });

      if (isBranchManager(req)) {
        rows = rows.filter((r) => {
          const branch = toStr(r.payload?.branch_id || r.payload?.branch_code);
          return branch === userBranch;
        });
      }

      return res.json(rows);
    } catch (err) {
      console.error("GET /pending-staff error:", err);
      return res.status(500).json({ message: "Failed to load pending staff requests" });
    }
  }
);

/* =========================================================
   GET ONE
========================================================= */
router.get(
  "/pending-staff/:id",
  requireAuth,
  requireRole(["admin", "hr", "accounting", "branch manager"]),
  async (req, res) => {
    try {
      const id = toInt(req.params.id);
      if (!id) {
        return res.status(400).json({ message: "Invalid pending staff request id" });
      }

      const result = await pool.query(
        `
        SELECT *
        FROM public.pending_staff_requests
        WHERE id = $1
        LIMIT 1
        `,
        [id]
      );

      if (!result.rows.length) {
        return res.status(404).json({ message: "Pending staff request not found" });
      }

      const row = result.rows[0];
      const payload = asObject(row.payload);

      if (isBranchManager(req)) {
        const userBranch = toStr(req.user?.branch_id);
        const branch = toStr(payload?.branch_id || payload?.branch_code);

        if (branch !== userBranch) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      return res.json({
        ...row,
        payload,
      });
    } catch (err) {
      console.error("GET /pending-staff/:id error:", err);
      return res.status(500).json({ message: "Failed to load pending staff request" });
    }
  }
);

/* =========================================================
   UPDATE (EDIT)
========================================================= */
router.put(
  "/pending-staff/:id",
  requireAuth,
  requireRole(["admin", "hr", "accounting", "branch manager"]),
  async (req, res) => {
    try {
      const id = toInt(req.params.id);
      if (!id) {
        return res.status(400).json({ message: "Invalid pending staff request id" });
      }

      const existingQ = await pool.query(
        `
        SELECT id, payload, status
        FROM public.pending_staff_requests
        WHERE id = $1
        LIMIT 1
        `,
        [id]
      );

      if (!existingQ.rows.length) {
        return res.status(404).json({ message: "Pending staff request not found" });
      }

      const existing = existingQ.rows[0];

      if (norm(existing.status) !== "pending") {
        return res.status(400).json({ message: "Only pending requests can be edited" });
      }

      const payloadOld = asObject(existing.payload);

      if (isBranchManager(req)) {
        const userBranch = toStr(req.user?.branch_id);
        const branch = toStr(payloadOld?.branch_id || payloadOld?.branch_code);

        if (branch !== userBranch) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const incoming = req.body?.payload ?? req.body ?? {};
      const payload = asObject(incoming);

      const last_name = toStr(payload.last_name);
      const first_name = toStr(payload.first_name);
      const position = toStr(payload.position);

      if (!last_name || !first_name || !position) {
        return res.status(400).json({
          message: "last_name, first_name, and position are required",
        });
      }

      const employeeNo = toStr(payload.employee_no);
      if (employeeNo) {
        const dupStaff = await pool.query(
          `
          SELECT 1
          FROM public.staff
          WHERE LOWER(TRIM(COALESCE(employee_no, ''))) = LOWER(TRIM($1))
          LIMIT 1
          `,
          [employeeNo]
        );

        if (dupStaff.rowCount > 0) {
          return res.status(409).json({ message: "Employee No already exists in staff" });
        }
      }

      const result = await pool.query(
        `
        UPDATE public.pending_staff_requests
        SET payload = $1::jsonb
        WHERE id = $2
        RETURNING *
        `,
        [JSON.stringify(payload), id]
      );

      return res.json({
        message: "Pending staff request updated successfully",
        request: {
          ...result.rows[0],
          payload: asObject(result.rows[0].payload),
        },
      });
    } catch (err) {
      console.error("PUT /pending-staff/:id error:", err);
      return res.status(500).json({ message: "Failed to update pending staff request" });
    }
  }
);

/* =========================================================
   APPROVE (ADMIN ONLY)
========================================================= */
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
        return res.status(400).json({ message: "Invalid pending staff request id" });
      }

      const pendingQ = await client.query(
        `
        SELECT *
        FROM public.pending_staff_requests
        WHERE id = $1
        LIMIT 1
        `,
        [id]
      );

      if (!pendingQ.rows.length) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Pending staff request not found" });
      }

      const pending = pendingQ.rows[0];

      if (norm(pending.status) !== "pending") {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Pending staff request already processed" });
      }

      const payload = asObject(pending.payload);

      const branchId = toInt(payload.branch_id);
      if (!branchId) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Branch is required" });
      }

      const branch = await getBranchById(client, branchId);
      if (!branch) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Invalid branch" });
      }

      const finalArea = cleanText(branch.area) || cleanText(payload.area);
      const finalRegion = cleanText(branch.region) || cleanText(payload.region);
      const finalDivision = cleanText(branch.division) || cleanText(payload.division);

      console.log("APPROVE HIT");
      console.log("pending id =", id);
      console.log("payload.branch_id =", payload.branch_id);
      console.log("branch =", branch);
      console.log("finalArea =", finalArea);
      console.log("finalRegion =", finalRegion);
      console.log("finalDivision =", finalDivision);

      if (!finalArea || !finalRegion || !finalDivision) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: "Branch missing area, region, or division",
        });
      }

      const employeeNo = toStr(payload.employee_no);
      const firstName = toStr(payload.first_name);
      const lastName = toStr(payload.last_name);
      const middleName = toStr(payload.middle_name);

      if (!employeeNo) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Employee No is required" });
      }

      if (!firstName || !lastName) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "First Name and Last Name are required" });
      }

      const dupStaff = await client.query(
        `
        SELECT id
        FROM public.staff
        WHERE LOWER(TRIM(COALESCE(employee_no, ''))) = LOWER(TRIM($1))
        LIMIT 1
        `,
        [employeeNo]
      );

      if (dupStaff.rowCount > 0) {
        await client.query("ROLLBACK");
        return res.status(409).json({ message: "Employee No already exists in staff" });
      }

      const fullname = `${lastName}${firstName ? `, ${firstName}` : ""}${middleName ? ` ${middleName}` : ""}`
        .replace(/\s+/g, " ")
        .trim();

      const insertSql = `
        INSERT INTO public.staff (
          employee_no,
          first_name,
          last_name,
          middle_name,
          fullname,

          address,
          municipality,
          province,
          contact,
          email,
          date_of_birth,
          place_of_birth,
          gender,
          civil_status,
          citizenship,
          height,
          weight,
          religion,
          blood_type,

          spouse_fullname,
          spouse_address,
          spouse_occupation,
          spouse_employer,

          children,

          father_fullname,
          father_address,
          father_occupation,
          father_employer,
          father_contact,

          mother_fullname,
          mother_address,
          mother_occupation,
          mother_employer,
          mother_contact,

          guardian_fullname,
          guardian_address,
          guardian_occupation,
          guardian_employer,
          guardian_contact,

          primary_school_name,
          primary_year_started,
          primary_year_graduated,

          secondary_school_name,
          secondary_year_started,
          secondary_year_graduated,

          tertiary_school_name,
          tertiary_course,
          tertiary_major,
          tertiary_year_started,
          tertiary_year_graduated,

          employment_history,
          beneficiaries,

          sss_no,
          philhealth_no,
          pagibig_no,
          tin_no,

          position,
          department,
          branch_id,
          area,
          region,
          division,
          status,

          start_date,
          regularization_date,

          salary,
          ecola,

          cbu,
          cashbond,
          utility,

          transportation,
          postage,
          motorcycle_loan,
          additional_target,
          repairing,
          additional_monitoring,
          other_deduction,

          sss_er,
          ph_er,
          hdmf_er,
          total_er,

          sss_ee,
          ph_ee,
          hdmf_ee,
          total_ee,

          tax,

          created_at,
          updated_at
        )
        VALUES (
          $1,  $2,  $3,  $4,  $5,

          $6,  $7,  $8,  $9,  $10, $11, $12, $13, $14, $15, $16, $17, $18, $19,

          $20, $21, $22, $23,

          $24::jsonb,

          $25, $26, $27, $28, $29,

          $30, $31, $32, $33, $34,

          $35, $36, $37, $38, $39,

          $40, $41, $42,

          $43, $44, $45,

          $46, $47, $48, $49, $50,

          $51::jsonb,
          $52::jsonb,

          $53, $54, $55, $56,

          $57, $58, $59, $60, $61, $62, $63,

          $64, $65,

          $66, $67,

          $68, $69, $70,

          $71, $72, $73, $74, $75, $76, $77,

          $78, $79, $80, $81,

          $82, $83, $84, $85,

          $86,

          NOW(),
          NOW()
        )
        RETURNING *;
      `;

      const insertValues = [
        employeeNo,
        firstName,
        lastName,
        middleName || null,
        fullname,

        cleanText(payload.address) || null,
        cleanText(payload.municipality) || null,
        cleanText(payload.province) || null,
        cleanText(payload.contact) || null,
        cleanText(payload.email) || null,
        toDate(payload.date_of_birth),
        cleanText(payload.place_of_birth) || null,
        cleanText(payload.gender) || null,
        cleanText(payload.civil_status) || null,
        cleanText(payload.citizenship) || null,
        payload.height === "" || payload.height == null ? null : Number(payload.height),
        payload.weight === "" || payload.weight == null ? null : Number(payload.weight),
        cleanText(payload.religion) || null,
        cleanText(payload.blood_type) || null,

        cleanText(payload.spouse_fullname) || null,
        cleanText(payload.spouse_address) || null,
        cleanText(payload.spouse_occupation) || null,
        cleanText(payload.spouse_employer) || null,

        JSON.stringify(safeJsonArray(payload.children)),

        cleanText(payload.father_fullname) || null,
        cleanText(payload.father_address) || null,
        cleanText(payload.father_occupation) || null,
        cleanText(payload.father_employer) || null,
        cleanText(payload.father_contact) || null,

        cleanText(payload.mother_fullname) || null,
        cleanText(payload.mother_address) || null,
        cleanText(payload.mother_occupation) || null,
        cleanText(payload.mother_employer) || null,
        cleanText(payload.mother_contact) || null,

        cleanText(payload.guardian_fullname) || null,
        cleanText(payload.guardian_address) || null,
        cleanText(payload.guardian_occupation) || null,
        cleanText(payload.guardian_employer) || null,
        cleanText(payload.guardian_contact) || null,

        cleanText(payload.primary_school_name) || null,
        cleanText(payload.primary_year_started) || null,
        cleanText(payload.primary_year_graduated) || null,

        cleanText(payload.secondary_school_name) || null,
        cleanText(payload.secondary_year_started) || null,
        cleanText(payload.secondary_year_graduated) || null,

        cleanText(payload.tertiary_school_name) || null,
        cleanText(payload.tertiary_course) || null,
        cleanText(payload.tertiary_major) || null,
        cleanText(payload.tertiary_year_started) || null,
        cleanText(payload.tertiary_year_graduated) || null,

        JSON.stringify(safeJsonArray(payload.employment_history)),
        JSON.stringify(safeJsonArray(payload.beneficiaries)),

        cleanText(payload.sss_no) || null,
        cleanText(payload.philhealth_no) || null,
        cleanText(payload.pagibig_no) || null,
        cleanText(payload.tin_no) || null,

       
        cleanText(payload.position) || null,   // $57
        cleanText(payload.department) || null, // $58
        branch.id,                             // $59

        finalArea || "N/A",                    // $60
        finalRegion || "N/A",                  // $61
        finalDivision || "N/A",                // $62

        cleanText(payload.status) || "Active", // $63

        toDate(payload.start_date),
        toDate(payload.regularization_date),

        payload.salary === "" || payload.salary == null ? null : Number(payload.salary),
        payload.ecola === "" || payload.ecola == null ? null : Number(payload.ecola),

        toNum(payload.cbu),
        toNum(payload.cashbond),
        toNum(payload.utility),

        toNum(payload.transportation),
        toNum(payload.postage),
        toNum(payload.motorcycle_loan),
        toNum(payload.additional_target),
        toNum(payload.repairing),
        toNum(payload.additional_monitoring),
        toNum(payload.other_deduction),

        toNum(payload.sss_er),
        toNum(payload.ph_er),
        toNum(payload.hdmf_er),
        toNum(payload.total_er),

        toNum(payload.sss_ee),
        toNum(payload.ph_ee),
        toNum(payload.hdmf_ee),
        toNum(payload.total_ee),

        toNum(payload.tax),
      ];

      console.log("insertValues[58..63] =", insertValues.slice(58, 64));
      console.log("insertValues length =", insertValues.length);
      console.log(insertValues);


      const insertQ = await client.query(insertSql, insertValues);
      const staffRow = insertQ.rows[0];

      await syncStaffBalancesFromStaff(client, staffRow.id);

      await client.query(
        `
        UPDATE public.pending_staff_requests
        SET
          status = 'Approved',
          approved_by = $1,
          approved_at = NOW(),
          rejected_at = NULL,
          rejection_reason = NULL
        WHERE id = $2
        `,
        [req.user?.id || null, id]
      );

      await client.query("COMMIT");

      return res.json({
        message: "Pending staff approved successfully",
        staff: staffRow,
      });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("PUT /pending-staff/:id/approve error:", err);
      return res.status(500).json({ message: err.message || "Failed to approve pending staff" });
    } finally {
      client.release();
    }
  }
);

/* =========================================================
   REJECT (ADMIN ONLY)
========================================================= */
router.put(
  "/pending-staff/:id/reject",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    try {
      const id = toInt(req.params.id);
      if (!id) {
        return res.status(400).json({ message: "Invalid pending staff request id" });
      }

      const rejection_reason = toStr(req.body?.rejection_reason) || null;

      const result = await pool.query(
        `
        UPDATE public.pending_staff_requests
        SET
          status = 'Rejected',
          rejected_at = NOW(),
          rejection_reason = $1,
          approved_by = NULL,
          approved_at = NULL
        WHERE id = $2
          AND LOWER(COALESCE(status, '')) = 'pending'
        RETURNING *
        `,
        [rejection_reason, id]
      );

      if (!result.rows.length) {
        return res.status(404).json({
          message: "Pending staff request not found or already processed",
        });
      }

      return res.json({ message: "Pending staff rejected successfully" });
    } catch (err) {
      console.error("PUT /pending-staff/:id/reject error:", err);
      return res.status(500).json({ message: "Failed to reject pending staff" });
    }
  }
);

module.exports = router;