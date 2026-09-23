const express = require("express");
const router = express.Router();
const pool = require("../db");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const { requireAuth } = require("../middlewares/authMiddleware");
const { requirePermission } = require("../middlewares/permissionMiddleware");

const {
  isAdmin,
  isIT,
  isHr,
  isAccounting,
  isTread,
  isBranchManager,
  isAreaManager,
  isRegionalManager,
  isAssistantVicePresident,
  isVicePresident,
  isSeniorVicePresident,
  isPresident,
} = require("../utils/roleAccess");

// ============================================================
// HELPERS
// ============================================================

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

const getUserId = (req) => toInt(req.user?.id);

const getUserBranchId = (req) => {
  return toInt(
    req.user?.branch_id ??
      req.user?.branchId ??
      req.user?.branch?.id ??
      req.user?.staff?.branch_id
  );
};

const getUserBranchCode = (req) =>
  toStr(
    req.user?.branch_code ??
      req.user?.branchCode ??
      req.user?.branch?.code
  );

const getUserArea = (req) => toStr(req.user?.area);
const getUserRegion = (req) => toStr(req.user?.region);
const getUserDivision = (req) => toStr(req.user?.division);

const getUserDepartment = (req) =>
  toStr(
    req.user?.department ||
      req.user?.department_name ||
      req.user?.departmentName ||
      req.user?.user_department ||
      req.user?.dept
  );

const getUserRole = (req) =>
  toStr(req.user?.role || req.user?.position);

  // ============================================================
  // DEPARTMENT HELPERS
  // ============================================================

const isHRDepartmentUser = (req) => {
  const dept = norm(getUserDepartment(req));

  return (
    dept === "hr" ||
    dept === "hr department" ||
    dept === "human resources" ||
    dept === "human resources department"
  );
};

const isActingBranchManager = (req) =>
  norm(getUserRole(req)) === "acting branch manager";

const isSettlementBranchManager = (req) =>
  isBranchManager(req) || isActingBranchManager(req);

const isAccountingDepartmentUser = (req) => {
  const dept = norm(getUserDepartment(req));

  return (
    dept === "accounting" ||
    dept === "accounting department"
  );
};

const isITDepartmentManager = (req) => {
  const dept = norm(getUserDepartment(req));
  const role = norm(getUserRole(req));

  return (
    (dept === "it" || dept === "it department") &&
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
    ].includes(role)
  );
};

// ============================================================
// GENERAL VIEW ACCESS
// ============================================================

const canViewSettlements = (req) =>
  isAdmin(req) ||
  isIT(req) ||
  isHr(req) ||
  isAccounting(req) ||
  isHRDepartmentUser(req) ||
  isAccountingDepartmentUser(req) ||
  isTread(req) ||
  isSettlementBranchManager(req) ||
  isAreaManager(req) ||
  isRegionalManager(req) ||
  isAssistantVicePresident(req) ||
  isVicePresident(req) ||
  isSeniorVicePresident(req) ||
  isPresident(req) ||
  isITDepartmentManager(req);

// ============================================================
// WORKFLOW ACCESS
//
// hr_initial = HR uploads first document
// branch     = selected Settlement Branch uploads document
// hr_final   = HR uploads final document
// completed  = finished
// ============================================================

const canActAsHR = (req) => {
  return (
    isAdmin(req) ||
    isHr(req) ||
    isHRDepartmentUser(req)
  );
};

const isSelectedSettlementBranch = async (req, settlement) => {
  let userBranchId = getUserBranchId(req);
  let userBranchCode = getUserBranchCode(req);

  const settlementBranchId = toInt(
    settlement?.settlement_branch_id
  );

  const settlementBranchCode = toStr(
    settlement?.settlement_branch_code
  );

  // If branch is missing from req.user/JWT,
  // resolve it from the deployed users table.
  if (!userBranchId && !userBranchCode) {
    const userId = getUserId(req);

    if (userId) {
      const result = await pool.query(
        `
        SELECT
          u.branch_id,
          b.code AS branch_code
        FROM public.users u
        LEFT JOIN public.branches b
          ON b.id = u.branch_id
        WHERE u.id = $1
        LIMIT 1
        `,
        [userId]
      );

      if (result.rowCount > 0) {
        userBranchId = toInt(result.rows[0].branch_id);
        userBranchCode = toStr(result.rows[0].branch_code);
      }
    }
  }

  if (
    userBranchId &&
    settlementBranchId &&
    userBranchId === settlementBranchId
  ) {
    return true;
  }

  if (
    userBranchCode &&
    settlementBranchCode &&
    norm(userBranchCode) === norm(settlementBranchCode)
  ) {
    return true;
  }

  return false;
};

const canActAtSettlementStage = async (req, settlement) => {
  const stage = norm(settlement?.approval_stage);

  if (stage === "hr_initial") {
    return canActAsHR(req);
  }

  if (stage === "branch") {
    return await isSelectedSettlementBranch(req, settlement);
  }

  if (stage === "hr_final") {
    return canActAsHR(req);
  }

  return false;
};

// ============================================================
// FILE UPLOAD
// ============================================================

const uploadDir = path.join(
  __dirname,
  "..",
  "uploads",
  "settlements"
);

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },

  filename: (_req, file, cb) => {
    const unique =
      Date.now() + "-" + Math.round(Math.random() * 1e9);

    cb(
      null,
      unique + path.extname(file.originalname || "")
    );
  },
});

const upload = multer({
  storage,

  limits: {
    fileSize: 15 * 1024 * 1024,
  },
});

// ============================================================
// REMOVE UPLOADED FILE IF REQUEST FAILS
// ============================================================

const removeUploadedFile = (file) => {
  if (!file?.path) return;

  try {
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
  } catch (err) {
    console.error(
      "Failed to remove uploaded settlement file:",
      err
    );
  }
};

// ============================================================
// BRANCH LOOKUP
// ============================================================

async function getBranchByIdOrCode(
  { id, code },
  db = pool
) {
  if (id) {
    const r = await db.query(
      `
      SELECT
        id,
        code,
        name
      FROM public.branches
      WHERE id = $1
      LIMIT 1
      `,
      [id]
    );

    if (r.rowCount > 0) {
      return r.rows[0];
    }
  }

  if (code) {
    const r = await db.query(
      `
      SELECT
        id,
        code,
        name
      FROM public.branches
      WHERE LOWER(TRIM(code)) = LOWER(TRIM($1))
      LIMIT 1
      `,
      [code]
    );

    if (r.rowCount > 0) {
      return r.rows[0];
    }
  }

  return null;
}

// ============================================================
// SETTLEMENT LOOKUP
// ============================================================

async function getSettlementById(id, db = pool) {
  const r = await db.query(
    `
    SELECT *
    FROM public.settlements
    WHERE id = $1
    LIMIT 1
    `,
    [id]
  );

  return r.rows[0] || null;
}

// ============================================================
// CHECK WHETHER USER CAN ACCESS A SPECIFIC SETTLEMENT
// Used mainly for file downloads.
// ============================================================

async function canAccessSettlement(req, settlement) {
  if (!settlement) return false;

  if (
    isAdmin(req) ||
    isIT(req) ||
    isHr(req) ||
    isAccounting(req) ||
    isHRDepartmentUser(req) ||
    isAccountingDepartmentUser(req) ||
    isITDepartmentManager(req) ||
    isVicePresident(req) ||
    isSeniorVicePresident(req) ||
    isPresident(req)
  ) {
    return true;
  }

  // Branch Manager:
  // access based on selected settlement branch.

  if (isSettlementBranchManager(req)) {
    return await isSelectedSettlementBranch(req, settlement);
  }

  const staffId = toInt(settlement.staff_id);

  if (!staffId) {
    return false;
  }

  const staffResult = await pool.query(
    `
    SELECT
      area,
      region,
      division
    FROM public.staff
    WHERE id = $1
    LIMIT 1
    `,
    [staffId]
  );

  if (staffResult.rowCount === 0) {
    return false;
  }

  const staff = staffResult.rows[0];

  if (isAreaManager(req)) {
    return (
      norm(staff.area) ===
      norm(getUserArea(req))
    );
  }

  if (isRegionalManager(req)) {
    return (
      norm(staff.region) ===
      norm(getUserRegion(req))
    );
  }

  if (isAssistantVicePresident(req)) {
    return (
      norm(staff.division) ===
      norm(getUserDivision(req))
    );
  }

  if (isTread(req)) {
    return true;
  }

  return false;
}

// ============================================================
// GET SETTLEMENTS
// ============================================================

router.get(
  "/settlements",
  requireAuth,
  requirePermission("statement_of_account", "view"),
  async (req, res) => {
    try {
      if (!canViewSettlements(req)) {
        return res.status(403).json({
          message: "Access denied",
        });
      }

      // ------------------------------------------------------
      // USERS WHO CAN VIEW ALL SETTLEMENTS
      // ------------------------------------------------------

      if (
        isAdmin(req) ||
        isIT(req) ||
        isHr(req) ||
        isAccounting(req) ||
        isHRDepartmentUser(req) ||
        isAccountingDepartmentUser(req) ||
        isITDepartmentManager(req) ||
        isVicePresident(req) ||
        isSeniorVicePresident(req) ||
        isPresident(req) ||
        isTread(req)
      ) {
        const r = await pool.query(
          `
          SELECT *
          FROM public.settlements
          ORDER BY id DESC
          `
        );

        return res.json(r.rows);
      }

      // ------------------------------------------------------
      // BRANCH MANAGER
      //
      // IMPORTANT:
      // settlement_branch_id is compared with user.branch_id.
      // ------------------------------------------------------

      if (isSettlementBranchManager(req)) {
        const userId = getUserId(req);
        let branchId = getUserBranchId(req);
        let branchCode = getUserBranchCode(req);

        // If branch information is not included in req.user/JWT,
        // get it directly from the deployed users table.
        if ((!branchId && !branchCode) && userId) {
          const userResult = await pool.query(
            `
            SELECT
              u.branch_id,
              b.code AS branch_code
            FROM public.users u
            LEFT JOIN public.branches b
              ON b.id = u.branch_id
            WHERE u.id = $1
            LIMIT 1
            `,
            [userId]
          );

          if (userResult.rowCount > 0) {
            branchId = toInt(userResult.rows[0].branch_id);
            branchCode = toStr(userResult.rows[0].branch_code);
          }
        }

        if (!branchId && !branchCode) {
          return res.json([]);
        }

        const r = await pool.query(
          `
          SELECT *
          FROM public.settlements
          WHERE
            (
              NULLIF(TRIM($1::text), '') IS NOT NULL
              AND TRIM(COALESCE(settlement_branch_id::text, ''))
                  = TRIM($1::text)
            )
            OR
            (
              NULLIF(TRIM($2::text), '') IS NOT NULL
              AND LOWER(TRIM(COALESCE(settlement_branch_code::text, '')))
                  = LOWER(TRIM($2::text))
            )
          ORDER BY id DESC
          `,
          [
            branchId || null,
            branchCode || null,
          ]
        );

        const rows = r.rows.map((row) => ({
          ...row,

          // Backend is the authority for whether this branch
          // can act on the current settlement stage.
          can_act_current_stage:
            norm(row.approval_stage) === "branch",
        }));

        return res.json(rows);
      }

      // ------------------------------------------------------
      // AREA MANAGER
      // ------------------------------------------------------

      if (isAreaManager(req)) {
        const area = getUserArea(req);

        if (!area) {
          return res.json([]);
        }

        const r = await pool.query(
          `
          SELECT st.*
          FROM public.settlements st
          LEFT JOIN public.staff s
            ON s.id = st.staff_id
          WHERE LOWER(
            TRIM(COALESCE(s.area, ''))
          ) = LOWER(TRIM($1))
          ORDER BY st.id DESC
          `,
          [area]
        );

        return res.json(r.rows);
      }

      // ------------------------------------------------------
      // REGIONAL MANAGER
      // ------------------------------------------------------

      if (isRegionalManager(req)) {
        const region = getUserRegion(req);

        if (!region) {
          return res.json([]);
        }

        const r = await pool.query(
          `
          SELECT st.*
          FROM public.settlements st
          LEFT JOIN public.staff s
            ON s.id = st.staff_id
          WHERE LOWER(
            TRIM(COALESCE(s.region, ''))
          ) = LOWER(TRIM($1))
          ORDER BY st.id DESC
          `,
          [region]
        );

        return res.json(r.rows);
      }

      // ------------------------------------------------------
      // ASSISTANT VICE PRESIDENT
      // ------------------------------------------------------

      if (isAssistantVicePresident(req)) {
        const division = getUserDivision(req);

        if (!division) {
          return res.json([]);
        }

        const r = await pool.query(
          `
          SELECT st.*
          FROM public.settlements st
          LEFT JOIN public.staff s
            ON s.id = st.staff_id
          WHERE LOWER(
            TRIM(COALESCE(s.division, ''))
          ) = LOWER(TRIM($1))
          ORDER BY st.id DESC
          `,
          [division]
        );

        return res.json(r.rows);
      }

      return res.json([]);
    } catch (err) {
      console.error(
        "GET /api/settlements FULL ERROR:",
        err
      );

      return res.status(500).json({
        message: err.message || "Server error",
      });
    }
  }
);

// ============================================================
// UPDATE SETTLEMENT
//
// Editing is allowed only BEFORE HR Initial approval.
// Once HR Initial approves, the financial data and selected
// settlement branch are locked.
// ============================================================

router.put(
  "/settlements/:id",
  requireAuth,
  requirePermission("statement_of_account", "edit"),
  upload.single("attachment"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const id = toInt(req.params.id);

      if (!id) {
        removeUploadedFile(req.file);

        return res.status(400).json({
          message: "Invalid settlement id",
        });
      }

      await client.query("BEGIN");

      const currentResult = await client.query(
        `
        SELECT *
        FROM public.settlements
        WHERE id = $1
        FOR UPDATE
        `,
        [id]
      );

      if (currentResult.rowCount === 0) {
        await client.query("ROLLBACK");
        removeUploadedFile(req.file);

        return res.status(404).json({
          message: "Settlement not found",
        });
      }

      const current = currentResult.rows[0];

      if (norm(current.status) === "void") {
        await client.query("ROLLBACK");
        removeUploadedFile(req.file);

        return res.status(400).json({
          message: "Voided settlement cannot be edited.",
        });
      }

      if (norm(current.status) === "approved") {
        await client.query("ROLLBACK");
        removeUploadedFile(req.file);

        return res.status(400).json({
          message: "Approved settlement cannot be edited.",
        });
      }

      if (
        norm(current.approval_stage) !== "hr_initial" ||
        norm(current.hr_initial_status) === "approved"
      ) {
        await client.query("ROLLBACK");
        removeUploadedFile(req.file);

        return res.status(400).json({
          message:
            "Settlement can no longer be edited because the approval workflow has already started.",
        });
      }

      // Resolve the settlement branch again so that the
      // frontend cannot submit an invalid branch name/code.
      const requestedBranchId = toInt(
        req.body?.settlement_branch_id
      );

      const requestedBranchCode = toStr(
        req.body?.settlement_branch_code
      );

      const branch = await getBranchByIdOrCode(
        {
          id:
            requestedBranchId ||
            toInt(current.settlement_branch_id),

          code:
            requestedBranchCode ||
            toStr(current.settlement_branch_code),
        },
        client
      );

      if (!branch) {
        await client.query("ROLLBACK");
        removeUploadedFile(req.file);

        return res.status(400).json({
          message: "Invalid settlement branch",
        });
      }

      const attachmentPath = req.file
        ? `/uploads/settlements/${req.file.filename}`
        : null;

      const attachmentName = req.file
        ? req.file.originalname
        : null;

      const attachmentMime = req.file
        ? req.file.mimetype
        : null;

      const r = await client.query(
        `
        UPDATE public.settlements
        SET
          description = $2,
          cbu = $3,
          cashbond = $4,
          utility = $5,
          thirteenth_month_pay = $6,
          last_pay = $7,
          separation_pay = $8,
          cash_assistance = $9,
          liabilities = $10,
          total_benefits = $11,
          net_settlement = $12,

          settlement_branch_id = $13,
          settlement_branch_code = $14,
          settlement_branch_name = $15,

          attachment_path =
            COALESCE($16, attachment_path),

          attachment_name =
            COALESCE($17, attachment_name),

          attachment_mime =
            COALESCE($18, attachment_mime)

        WHERE id = $1
        RETURNING *
        `,
        [
          id,

          toStr(req.body?.description) || null,
          toNum(req.body?.cbu),
          toNum(req.body?.cashbond),
          toNum(req.body?.utility),
          toNum(req.body?.thirteenth_month_pay),
          toNum(req.body?.last_pay),

          req.body?.separation_pay === "" ||
          req.body?.separation_pay == null
            ? null
            : toNum(req.body?.separation_pay),

          req.body?.cash_assistance === "" ||
          req.body?.cash_assistance == null
            ? null
            : toNum(req.body?.cash_assistance),

          toNum(req.body?.liabilities),
          toNum(req.body?.total_benefits),
          toNum(req.body?.net_settlement),

          branch.id,
          branch.code,
          branch.name,

          attachmentPath,
          attachmentName,
          attachmentMime,
        ]
      );

      await client.query("COMMIT");

      return res.json(r.rows[0]);
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch {}

      removeUploadedFile(req.file);

      console.error(
        "PUT /api/settlements/:id FULL ERROR:",
        err
      );

      return res.status(500).json({
        message: err.message || "Server error",
      });
    } finally {
      client.release();
    }
  }
);

// ============================================================
// VOID SETTLEMENT
// ============================================================

router.put(
  "/settlements/:id/void",
  requireAuth,
  requirePermission("statement_of_account", "delete"),
  async (req, res) => {
    try {
      const id = toInt(req.params.id);

      if (!id) {
        return res.status(400).json({
          message: "Invalid settlement id",
        });
      }

      const r = await pool.query(
        `
        UPDATE public.settlements
        SET
          status = 'VOID'
        WHERE id = $1
          AND LOWER(COALESCE(status, '')) <> 'void'
        RETURNING *
        `,
        [id]
      );

      if (!r.rowCount) {
        return res.status(404).json({
          message:
            "Settlement not found or already voided",
        });
      }

      return res.json({
        message: "Settlement voided",
        settlement: r.rows[0],
      });
    } catch (err) {
      console.error(
        "PUT /api/settlements/:id/void FULL ERROR:",
        err
      );

      return res.status(500).json({
        message: err.message || "Server error",
      });
    }
  }
);

// ============================================================
// CREATE SETTLEMENT
//
// Newly created settlement always starts:
//
// status         = Pending
// approval_stage = hr_initial
//
// The generic attachment is kept as the creator/source file.
// It is NOT the HR Initial approval document.
// ============================================================

router.post(
  "/settlements",
  requireAuth,
  requirePermission("statement_of_account", "create"),
  upload.single("attachment"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const staffId = toInt(req.body?.staff_id);
      const employeeNo = toStr(req.body?.employee_no);
      const employeeName = toStr(
        req.body?.employee_name
      );

      const prevBranch = toStr(req.body?.prev_branch);
      const description = toStr(
        req.body?.description
      );

      const settlementBranchId = toInt(
        req.body?.settlement_branch_id
      );

      const settlementBranchCode = toStr(
        req.body?.settlement_branch_code
      );

      if (!staffId) {
        removeUploadedFile(req.file);

        return res.status(400).json({
          message: "staff_id is required",
        });
      }

      if (!employeeNo) {
        removeUploadedFile(req.file);

        return res.status(400).json({
          message: "employee_no is required",
        });
      }

      if (!employeeName) {
        removeUploadedFile(req.file);

        return res.status(400).json({
          message: "employee_name is required",
        });
      }

      if (
        !settlementBranchId &&
        !settlementBranchCode
      ) {
        removeUploadedFile(req.file);

        return res.status(400).json({
          message: "Settlement branch is required",
        });
      }

      await client.query("BEGIN");

      const branch = await getBranchByIdOrCode(
        {
          id: settlementBranchId,
          code: settlementBranchCode,
        },
        client
      );

      if (!branch) {
        await client.query("ROLLBACK");
        removeUploadedFile(req.file);

        return res.status(400).json({
          message: "Invalid settlement branch",
        });
      }

      const staffResult = await client.query(
        `
        SELECT
          first_name,
          last_name,
          middle_name
        FROM public.staff
        WHERE id = $1
        LIMIT 1
        `,
        [staffId]
      );

      if (staffResult.rowCount === 0) {
        await client.query("ROLLBACK");
        removeUploadedFile(req.file);

        return res.status(400).json({
          message:
            "Invalid staff_id. Staff record not found.",
        });
      }

      const staff = staffResult.rows[0];

      const firstName = staff.first_name || null;
      const lastName = staff.last_name || null;
      const middleName = staff.middle_name || null;

      const cbu = toNum(req.body?.cbu);
      const cashbond = toNum(req.body?.cashbond);
      const utility = toNum(req.body?.utility);

      const thirteenthMonthPay = toNum(
        req.body?.thirteenth_month_pay
      );

      const lastPay = toNum(req.body?.last_pay);

      const separationPay =
        req.body?.separation_pay === "" ||
        req.body?.separation_pay == null
          ? null
          : toNum(req.body?.separation_pay);

      const cashAssistance =
        req.body?.cash_assistance === "" ||
        req.body?.cash_assistance == null
          ? null
          : toNum(req.body?.cash_assistance);

      const liabilities = toNum(
        req.body?.liabilities
      );

      const totalBenefits = toNum(
        req.body?.total_benefits
      );

      const netSettlement = toNum(
        req.body?.net_settlement
      );

      const attachmentPath = req.file
        ? `/uploads/settlements/${req.file.filename}`
        : null;

      const attachmentName = req.file
        ? req.file.originalname
        : null;

      const attachmentMime = req.file
        ? req.file.mimetype
        : null;

      const r = await client.query(
        `
        INSERT INTO public.settlements (
          staff_id,
          employee_no,
          employee_name,
          prev_branch,
          description,

          cbu,
          cashbond,
          utility,
          thirteenth_month_pay,
          last_pay,
          separation_pay,
          cash_assistance,
          liabilities,
          total_benefits,
          net_settlement,

          settlement_branch_id,
          settlement_branch_code,
          settlement_branch_name,

          attachment_path,
          attachment_name,
          attachment_mime,

          created_by,
          last_name,
          first_name,
          middle_name,

          status,
          approval_stage,

          hr_initial_status,
          branch_status,
          hr_final_status
        )
        VALUES (
          $1,$2,$3,$4,$5,
          $6,$7,$8,$9,$10,
          $11,$12,$13,$14,$15,
          $16,$17,$18,
          $19,$20,$21,
          $22,$23,$24,$25,
          $26,$27,$28,$29,$30
        )
        RETURNING *
        `,
        [
          staffId,
          employeeNo,
          employeeName,
          prevBranch || null,
          description || null,

          cbu,
          cashbond,
          utility,
          thirteenthMonthPay,
          lastPay,
          separationPay,
          cashAssistance,
          liabilities,
          totalBenefits,
          netSettlement,

          branch.id,
          branch.code,
          branch.name,

          attachmentPath,
          attachmentName,
          attachmentMime,

          getUserId(req),
          lastName,
          firstName,
          middleName,

          "Pending",
          "hr_initial",
          "Pending",
          "Pending",
          "Pending",
        ]
      );

      await client.query("COMMIT");

      return res.status(201).json({
        message:
          "Settlement created. Pending HR Initial approval.",
        settlement: r.rows[0],
      });
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch {}

      removeUploadedFile(req.file);

      console.error(
        "POST /api/settlements FULL ERROR:",
        err
      );

      return res.status(500).json({
        message: err.message || "Server error",
      });
    } finally {
      client.release();
    }
  }
);

// ============================================================
// APPROVE CURRENT WORKFLOW STAGE
//
// PUT /api/settlements/:id/approve
//
// multipart/form-data:
// attachment = PDF/document
//
// STAGES:
//
// hr_initial
//   HR uploads
//   -> branch
//
// branch
//   selected settlement branch uploads
//   -> hr_final
//
// hr_final
//   HR uploads
//   -> completed / Approved
// ============================================================

router.put(
  "/settlements/:id/approve",
  requireAuth,
  requirePermission("statement_of_account", "edit"),
  upload.single("attachment"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const id = toInt(req.params.id);

      if (!id) {
        removeUploadedFile(req.file);

        return res.status(400).json({
          message: "Invalid settlement id",
        });
      }

      if (!req.file) {
        return res.status(400).json({
          message:
            "A document is required before approval.",
        });
      }

      await client.query("BEGIN");

      const settlementResult = await client.query(
        `
        SELECT *
        FROM public.settlements
        WHERE id = $1
        FOR UPDATE
        `,
        [id]
      );

      if (settlementResult.rowCount === 0) {
        await client.query("ROLLBACK");
        removeUploadedFile(req.file);

        return res.status(404).json({
          message: "Settlement not found",
        });
      }

      const settlement =
        settlementResult.rows[0];

      const status = norm(settlement.status);
      const stage = norm(
        settlement.approval_stage
      );

      if (status === "void") {
        await client.query("ROLLBACK");
        removeUploadedFile(req.file);

        return res.status(400).json({
          message:
            "Voided settlement cannot be approved.",
        });
      }

      if (
        status === "approved" ||
        stage === "completed"
      ) {
        await client.query("ROLLBACK");
        removeUploadedFile(req.file);

        return res.status(400).json({
          message:
            "Settlement is already completed.",
        });
      }

      if (status === "rejected") {
        await client.query("ROLLBACK");
        removeUploadedFile(req.file);

        return res.status(400).json({
          message:
            "Rejected settlement cannot be approved.",
        });
      }

      if (
        !["hr_initial", "branch", "hr_final"].includes(
          stage
        )
      ) {
        await client.query("ROLLBACK");
        removeUploadedFile(req.file);

        return res.status(400).json({
          message:
            "Settlement has an invalid approval stage.",
        });
      }

      if (
        !(await canActAtSettlementStage(
          req,
          settlement
        ))
      ) {
        await client.query("ROLLBACK");
        removeUploadedFile(req.file);

        if (stage === "branch") {
          return res.status(403).json({
            message:
              "Only an account assigned to the selected Settlement Branch can approve this stage.",
          });
        }

        return res.status(403).json({
          message:
            "Only HR can approve this stage.",
        });
      }

      const userId = getUserId(req);

      if (!userId) {
        await client.query("ROLLBACK");
        removeUploadedFile(req.file);

        return res.status(400).json({
          message:
            "Unable to identify the approving user.",
        });
      }

      const attachmentPath =
        `/uploads/settlements/${req.file.filename}`;

      const attachmentName =
        req.file.originalname || req.file.filename;

      const attachmentMime =
        req.file.mimetype ||
        "application/octet-stream";

      let updated;
      let message;

      // ======================================================
      // HR INITIAL
      // ======================================================

      if (stage === "hr_initial") {
        const r = await client.query(
          `
          UPDATE public.settlements
          SET
            hr_initial_status = 'Approved',
            hr_initial_approved_by = $2,
            hr_initial_approved_at = NOW(),

            hr_initial_attachment_path = $3,
            hr_initial_attachment_name = $4,
            hr_initial_attachment_mime = $5,

            approval_stage = 'branch',
            status = 'Pending',

            rejected_by = NULL,
            rejected_at = NULL,
            rejection_reason = NULL
          WHERE id = $1
          RETURNING *
          `,
          [
            id,
            userId,
            attachmentPath,
            attachmentName,
            attachmentMime,
          ]
        );

        updated = r.rows[0];

        message =
          "HR Initial approved. Pending Settlement Branch approval.";
      }

      // ======================================================
      // SETTLEMENT BRANCH
      // ======================================================

      if (stage === "branch") {
        const r = await client.query(
          `
          UPDATE public.settlements
          SET
            branch_status = 'Approved',
            branch_approved_by = $2,
            branch_approved_at = NOW(),

            branch_attachment_path = $3,
            branch_attachment_name = $4,
            branch_attachment_mime = $5,

            approval_stage = 'hr_final',
            status = 'Pending',

            rejected_by = NULL,
            rejected_at = NULL,
            rejection_reason = NULL
          WHERE id = $1
          RETURNING *
          `,
          [
            id,
            userId,
            attachmentPath,
            attachmentName,
            attachmentMime,
          ]
        );

        updated = r.rows[0];

        message =
          "Settlement Branch approved. Pending HR Final approval.";
      }

      // ======================================================
      // HR FINAL
      // ======================================================

      if (stage === "hr_final") {
        const r = await client.query(
          `
          UPDATE public.settlements
          SET
            hr_final_status = 'Approved',
            hr_final_approved_by = $2,
            hr_final_approved_at = NOW(),

            hr_final_attachment_path = $3,
            hr_final_attachment_name = $4,
            hr_final_attachment_mime = $5,

            approval_stage = 'completed',
            status = 'Approved',

            completed_by = $2,
            completed_at = NOW(),

            rejected_by = NULL,
            rejected_at = NULL,
            rejection_reason = NULL
          WHERE id = $1
          RETURNING *
          `,
          [
            id,
            userId,
            attachmentPath,
            attachmentName,
            attachmentMime,
          ]
        );

        updated = r.rows[0];

        message =
          "HR Final approved. Settlement completed.";
      }

      await client.query("COMMIT");

      return res.json({
        message,
        settlement: updated,
      });
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch {}

      removeUploadedFile(req.file);

      console.error(
        "PUT /api/settlements/:id/approve FULL ERROR:",
        err
      );

      return res.status(500).json({
        message: err.message || "Server error",
      });
    } finally {
      client.release();
    }
  }
);

router.put(
  "/settlements/:id/reject",
  requireAuth,
  requirePermission("statement_of_account", "edit"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const id = toInt(req.params.id);
      const reason = toStr(
        req.body?.reason ||
          req.body?.rejection_reason
      );

      if (!id) {
        return res.status(400).json({
          message: "Invalid settlement id",
        });
      }

      if (!reason) {
        return res.status(400).json({
          message: "Rejection reason is required.",
        });
      }

      await client.query("BEGIN");

      const settlementResult = await client.query(
        `
        SELECT *
        FROM public.settlements
        WHERE id = $1
        FOR UPDATE
        `,
        [id]
      );

      if (settlementResult.rowCount === 0) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          message: "Settlement not found",
        });
      }

      const settlement =
        settlementResult.rows[0];

      const status = norm(settlement.status);
      const stage = norm(
        settlement.approval_stage
      );

      if (status === "void") {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message:
            "Voided settlement cannot be rejected.",
        });
      }

      if (
        status === "approved" ||
        stage === "completed"
      ) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message:
            "Completed settlement cannot be rejected.",
        });
      }

      if (status === "rejected") {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message:
            "Settlement is already rejected.",
        });
      }

      if (
        !["hr_initial", "branch", "hr_final"].includes(
          stage
        )
      ) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message:
            "Settlement has an invalid approval stage.",
        });
      }

      if (
        !(await canActAtSettlementStage(
          req,
          settlement
        ))
      ) {
        await client.query("ROLLBACK");

        if (stage === "branch") {
          return res.status(403).json({
            message:
              "Only an account assigned to the selected Settlement Branch can reject this stage.",
          });
        }

        return res.status(403).json({
          message:
            "Only HR can reject this stage.",
        });
      }

      const userId = getUserId(req);

      if (!userId) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message:
            "Unable to identify the rejecting user.",
        });
      }

      let updated;

      // ======================================================
      // HR INITIAL REJECTION
      // ======================================================

      if (stage === "hr_initial") {
        const r = await client.query(
          `
          UPDATE public.settlements
          SET
            hr_initial_status = 'Rejected',
            status = 'Rejected',
            approval_stage = 'rejected',

            rejected_by = $2,
            rejected_at = NOW(),
            rejection_reason = $3
          WHERE id = $1
          RETURNING *
          `,
          [id, userId, reason]
        );

        updated = r.rows[0];
      }

      // ======================================================
      // SETTLEMENT BRANCH REJECTION
      // ======================================================

      if (stage === "branch") {
        const r = await client.query(
          `
          UPDATE public.settlements
          SET
            branch_status = 'Rejected',
            status = 'Rejected',
            approval_stage = 'rejected',

            rejected_by = $2,
            rejected_at = NOW(),
            rejection_reason = $3
          WHERE id = $1
          RETURNING *
          `,
          [id, userId, reason]
        );

        updated = r.rows[0];
      }

      // ======================================================
      // HR FINAL REJECTION
      // ======================================================

      if (stage === "hr_final") {
        const r = await client.query(
          `
          UPDATE public.settlements
          SET
            hr_final_status = 'Rejected',
            status = 'Rejected',
            approval_stage = 'rejected',

            rejected_by = $2,
            rejected_at = NOW(),
            rejection_reason = $3
          WHERE id = $1
          RETURNING *
          `,
          [id, userId, reason]
        );

        updated = r.rows[0];
      }

      await client.query("COMMIT");

      return res.json({
        message: "Settlement rejected.",
        settlement: updated,
      });
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch {}

      console.error(
        "PUT /api/settlements/:id/reject FULL ERROR:",
        err
      );

      return res.status(500).json({
        message: err.message || "Server error",
      });
    } finally {
      client.release();
    }
  }
);

// ============================================================
// RESOLVE WHICH ATTACHMENT TO DOWNLOAD
// ============================================================

const resolveSettlementAttachment = (
  settlement,
  requestedType
) => {
  const type = norm(requestedType);

  if (
    type === "source" ||
    type === "original"
  ) {
    return {
      type: "source",
      path: settlement.attachment_path,
      name: settlement.attachment_name,
      mime: settlement.attachment_mime,
    };
  }

  if (type === "hr_initial") {
    return {
      type: "hr_initial",
      path:
        settlement.hr_initial_attachment_path,
      name:
        settlement.hr_initial_attachment_name,
      mime:
        settlement.hr_initial_attachment_mime,
    };
  }

  if (type === "branch") {
    return {
      type: "branch",
      path:
        settlement.branch_attachment_path,
      name:
        settlement.branch_attachment_name,
      mime:
        settlement.branch_attachment_mime,
    };
  }

  if (type === "hr_final") {
    return {
      type: "hr_final",
      path:
        settlement.hr_final_attachment_path,
      name:
        settlement.hr_final_attachment_name,
      mime:
        settlement.hr_final_attachment_mime,
    };
  }

  if (type === "latest") {
    if (
      settlement.hr_final_attachment_path
    ) {
      return {
        type: "hr_final",
        path:
          settlement.hr_final_attachment_path,
        name:
          settlement.hr_final_attachment_name,
        mime:
          settlement.hr_final_attachment_mime,
      };
    }

    if (
      settlement.branch_attachment_path
    ) {
      return {
        type: "branch",
        path:
          settlement.branch_attachment_path,
        name:
          settlement.branch_attachment_name,
        mime:
          settlement.branch_attachment_mime,
      };
    }

    if (
      settlement.hr_initial_attachment_path
    ) {
      return {
        type: "hr_initial",
        path:
          settlement.hr_initial_attachment_path,
        name:
          settlement.hr_initial_attachment_name,
        mime:
          settlement.hr_initial_attachment_mime,
      };
    }

    if (settlement.attachment_path) {
      return {
        type: "source",
        path: settlement.attachment_path,
        name: settlement.attachment_name,
        mime: settlement.attachment_mime,
      };
    }
  }

  return null;
};

// ============================================================
// DOWNLOAD A SPECIFIC WORKFLOW DOCUMENT
// ============================================================

router.get(
  "/settlements/:id/download/:type",
  requireAuth,
  requirePermission("statement_of_account", "view"),
  async (req, res) => {
    try {
      const id = toInt(req.params.id);
      const type = norm(req.params.type);

      if (!id) {
        return res.status(400).json({
          message: "Invalid settlement id",
        });
      }

      const allowedTypes = [
        "source",
        "original",
        "hr_initial",
        "branch",
        "hr_final",
        "latest",
      ];

      if (!allowedTypes.includes(type)) {
        return res.status(400).json({
          message: "Invalid document type",
        });
      }

      const settlement =
        await getSettlementById(id);

      if (!settlement) {
        return res.status(404).json({
          message: "Settlement not found",
        });
      }

      const allowed =
        await canAccessSettlement(
          req,
          settlement
        );

      if (!allowed) {
        return res.status(403).json({
          message: "Access denied",
        });
      }

      const attachment =
        resolveSettlementAttachment(
          settlement,
          type
        );

      if (!attachment?.path) {
        return res.status(404).json({
          message:
            "No document found for this stage.",
        });
      }

      const rel = String(
        attachment.path
      ).replace(/^\/uploads\//, "");

      const filePath = path.join(
        __dirname,
        "..",
        "uploads",
        rel
      );

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({
          message: "File not found",
        });
      }

      if (attachment.mime) {
        res.setHeader(
          "Content-Type",
          attachment.mime
        );
      }

      return res.download(
        filePath,
        attachment.name ||
          path.basename(filePath)
      );
    } catch (err) {
      console.error(
        "GET /api/settlements/:id/download/:type FULL ERROR:",
        err
      );

      return res.status(500).json({
        message: err.message || "Server error",
      });
    }
  }
);

// ============================================================
// OLD DOWNLOAD ROUTE
// ============================================================

router.get(
  "/settlements/:id/download",
  requireAuth,
  requirePermission("statement_of_account", "view"),
  async (req, res) => {
    try {
      const id = toInt(req.params.id);

      if (!id) {
        return res.status(400).json({
          message: "Invalid settlement id",
        });
      }

      const settlement =
        await getSettlementById(id);

      if (!settlement) {
        return res.status(404).json({
          message: "Settlement not found",
        });
      }

      const allowed =
        await canAccessSettlement(
          req,
          settlement
        );

      if (!allowed) {
        return res.status(403).json({
          message: "Access denied",
        });
      }

      const attachment =
        resolveSettlementAttachment(
          settlement,
          "latest"
        );

      if (!attachment?.path) {
        return res.status(404).json({
          message:
            "No settlement document found.",
        });
      }

      const rel = String(
        attachment.path
      ).replace(/^\/uploads\//, "");

      const filePath = path.join(
        __dirname,
        "..",
        "uploads",
        rel
      );

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({
          message: "File not found",
        });
      }

      if (attachment.mime) {
        res.setHeader(
          "Content-Type",
          attachment.mime
        );
      }

      return res.download(
        filePath,
        attachment.name ||
          path.basename(filePath)
      );
    } catch (err) {
      console.error(
        "GET /api/settlements/:id/download FULL ERROR:",
        err
      );

      return res.status(500).json({
        message: err.message || "Server error",
      });
    }
  }
);

// ============================================================
// DELETE SETTLEMENT
// ============================================================

router.delete(
  "/settlements/:id",
  requireAuth,
  requirePermission(
    "statement_of_account",
    "delete"
  ),
  async (req, res) => {
    try {
      const id = toInt(req.params.id);

      if (!id) {
        return res.status(400).json({
          message: "Invalid settlement id",
        });
      }

      const r = await pool.query(
        `
        DELETE FROM public.settlements
        WHERE id = $1
        RETURNING id
        `,
        [id]
      );

      if (r.rowCount === 0) {
        return res.status(404).json({
          message: "Settlement not found",
        });
      }

      return res.json({
        message: "Settlement deleted",
        id: r.rows[0].id,
      });
    } catch (err) {
      console.error(
        "DELETE /api/settlements/:id FULL ERROR:",
        err
      );

      return res.status(500).json({
        message: err.message || "Server error",
      });
    }
  }
);

module.exports = router;