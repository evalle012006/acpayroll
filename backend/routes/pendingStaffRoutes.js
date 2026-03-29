const express = require("express");
const router = express.Router();
const pool = require("../db");
const { requireAuth, requireRole } = require("../middlewares/authMiddleware");

const toInt = (v) => {
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
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

const norm = (v) => String(v ?? "").trim().toLowerCase();

router.get(
  "/pending-staff",
  requireAuth,
  requireRole(["admin"]),
  async (_req, res) => {
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
        WHERE LOWER(COALESCE(status, '')) = 'pending'
        ORDER BY created_at DESC, id DESC
      `);

      const rows = result.rows.map((row) => {
        const payload = asObject(row.payload);

        return {
          ...row,
          payload,
          employee_no: payload.employee_no || "",
          first_name: payload.first_name || "",
          last_name: payload.last_name || "",
          middle_name: payload.middle_name || "",
          fullname:
            payload.fullname ||
            [payload.last_name, payload.first_name, payload.middle_name]
              .filter(Boolean)
              .join(", ")
              .replace(", ,", ",")
              .trim(),
          position: payload.position || "",
          branch_id: payload.branch_id ?? "",
          branch_name: payload.branch_name || "",
        };
      });

      return res.json(rows);
    } catch (err) {
      console.error("GET /pending-staff error:", err);
      return res.status(500).json({ message: "Failed to load pending staff requests" });
    }
  }
);

router.get(
  "/pending-staff/:id",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    try {
      const id = toInt(req.params.id);
      if (!id) {
        return res.status(400).json({ message: "Invalid pending staff request id" });
      }

      const result = await pool.query(
        `
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
        WHERE id = $1
        LIMIT 1
        `,
        [id]
      );

      if (!result.rows.length) {
        return res.status(404).json({ message: "Pending staff request not found" });
      }

      const row = result.rows[0];
      return res.json({
        ...row,
        payload: asObject(row.payload),
      });
    } catch (err) {
      console.error("GET /pending-staff/:id error:", err);
      return res.status(500).json({ message: "Failed to load pending staff request" });
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
        return res.status(400).json({ message: "This request is already processed" });
      }

      const payload = asObject(pending.payload);

      const insertQ = await client.query(
        `
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
          children,
          education,
          employment_history,
          beneficiaries,
          sss_no,
          philhealth_no,
          pagibig_no,
          tin_no,
          position,
          department,
          area,
          region,
          division,
          branch_id,
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
          additional_target,
          repairing,
          additional_monitoring,
          other_deduction,
          sss_er,
          ph_er,
          hdmf_er,
          sss_ee,
          ph_ee,
          hdmf_ee,
          tax,
          photo_url
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
          $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
          $21,$22,$23,$24,$25,$26,$27,$28,$29,$30,
          $31,$32,$33,$34,$35,$36,$37,$38,$39,$40,
          $41,$42,$43,$44,$45,$46,$47,$48,$49,$50,
          $51,$52,$53,$54,$55,$56,$57,$58,$59,$60,
          $61,$62,$63,$64,$65,$66,$67,$68,$69,$70,
          $71,$72,$73,$74,$75
        )
        RETURNING *
        `,
        [
          payload.employee_no || null,
          payload.first_name || null,
          payload.last_name || null,
          payload.middle_name || null,
          payload.fullname || null,
          payload.address || null,
          payload.municipality || null,
          payload.province || null,
          payload.contact || null,
          payload.email || null,
          payload.date_of_birth || null,
          payload.place_of_birth || null,
          payload.gender || null,
          payload.civil_status || null,
          payload.citizenship || null,
          payload.height || null,
          payload.weight || null,
          payload.religion || null,
          payload.blood_type || null,
          payload.spouse_fullname || null,
          payload.spouse_address || null,
          payload.spouse_occupation || null,
          payload.spouse_employer || null,
          payload.father_fullname || null,
          payload.father_address || null,
          payload.father_occupation || null,
          payload.father_employer || null,
          payload.father_contact || null,
          payload.mother_fullname || null,
          payload.mother_address || null,
          payload.mother_occupation || null,
          payload.mother_employer || null,
          payload.mother_contact || null,
          payload.guardian_fullname || null,
          payload.guardian_address || null,
          payload.guardian_occupation || null,
          payload.guardian_employer || null,
          payload.guardian_contact || null,
          Array.isArray(payload.children) ? JSON.stringify(payload.children) : payload.children || "[]",
          Array.isArray(payload.education) ? JSON.stringify(payload.education) : payload.education || "[]",
          Array.isArray(payload.employment_history)
            ? JSON.stringify(payload.employment_history)
            : payload.employment_history || "[]",
          Array.isArray(payload.beneficiaries)
            ? JSON.stringify(payload.beneficiaries)
            : payload.beneficiaries || "[]",
          payload.sss_no || null,
          payload.philhealth_no || null,
          payload.pagibig_no || null,
          payload.tin_no || null,
          payload.position || null,
          payload.department || null,
          payload.area || null,
          payload.region || null,
          payload.division || null,
          payload.branch_id || null,
          payload.status || "Active",
          payload.start_date || null,
          payload.regularization_date || null,
          payload.salary || 0,
          payload.ecola || 0,
          payload.cbu || 0,
          payload.cashbond || 0,
          payload.utility || 0,
          payload.transportation || 0,
          payload.postage || 0,
          payload.additional_target || 0,
          payload.repairing || 0,
          payload.additional_monitoring || 0,
          payload.other_deduction || 0,
          payload.sss_er || 0,
          payload.ph_er || 0,
          payload.hdmf_er || 0,
          payload.sss_ee || 0,
          payload.ph_ee || 0,
          payload.hdmf_ee || 0,
          payload.tax || 0,
          payload.photo_url || null,
        ]
      );

      const staffRow = insertQ.rows[0];

      await client.query(
        `
        INSERT INTO public.staff_balances (
          employee_id,
          fullname,
          position,
          cbu,
          cashbond,
          utility,
          salary_advance,
          special_advance,
          cash_advance,
          motorcycle_loan,
          pag_ibig_loan,
          other_receivable,
          staff_accounts_payable,
          updated_at
        )
        VALUES (
          $1,$2,$3,
          COALESCE($4, 0),
          COALESCE($5, 0),
          COALESCE($6, 0),
          0,0,0,0,0,0,0,
          NOW()
        )
        ON CONFLICT (employee_id)
        DO UPDATE SET
          fullname = EXCLUDED.fullname,
          position = EXCLUDED.position,
          cbu = COALESCE(EXCLUDED.cbu, public.staff_balances.cbu),
          cashbond = COALESCE(EXCLUDED.cashbond, public.staff_balances.cashbond),
          utility = COALESCE(EXCLUDED.utility, public.staff_balances.utility),
          updated_at = NOW()
        `,
        [
          staffRow.employee_no,
          staffRow.fullname,
          staffRow.position,
          payload.cbu || 0,
          payload.cashbond || 0,
          payload.utility || 0,
        ]
      );

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
      return res.status(500).json({ message: "Failed to approve pending staff" });
    } finally {
      client.release();
    }
  }
);

router.put(
  "/pending-staff/:id",
  requireAuth,
  requireRole(["admin", "hr", "accounting", "branch manager"]),
  async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) {
        return res.status(400).json({ message: "Invalid pending staff request id" });
      }

      const check = await pool.query(
        `
        SELECT id, payload, status
        FROM public.pending_staff_requests
        WHERE id = $1
        LIMIT 1
        `,
        [id]
      );

      if (!check.rows.length) {
        return res.status(404).json({ message: "Pending staff request not found" });
      }

      const existing = check.rows[0];

      if (String(existing.status || "").toLowerCase() !== "pending") {
        return res.status(400).json({ message: "Only pending requests can be edited" });
      }

      const body = req.body || {};
      const last_name = String(body.last_name ?? "").trim();
      const first_name = String(body.first_name ?? "").trim();
      const position = String(body.position ?? "").trim();

      if (!last_name || !first_name || !position) {
        return res.status(400).json({
          message: "last_name, first_name, and position are required",
        });
      }

      const employeeNo = String(body.employee_no ?? "").trim();
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
        UPDATE public.pending_staff_requests
        SET payload = $1::jsonb
        WHERE id = $2
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
        [JSON.stringify(body), id]
      );

      return res.json({
        message: "Pending staff request updated successfully",
        request: result.rows[0],
      });
    } catch (err) {
      console.error("PUT /pending-staff/:id ERROR:", err.message);
      return res.status(500).json({
        message: err?.message || "Server error",
      });
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
        return res.status(400).json({ message: "Invalid pending staff request id" });
      }

      const rejection_reason = String(req.body?.rejection_reason ?? "").trim();

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
        [rejection_reason || null, id]
      );

      if (!result.rows.length) {
        return res.status(404).json({ message: "Pending staff request not found or already processed" });
      }

      return res.json({ message: "Pending staff rejected successfully" });
    } catch (err) {
      console.error("PUT /pending-staff/:id/reject error:", err);
      return res.status(500).json({ message: "Failed to reject pending staff" });
    }
  }
);

module.exports = router;