const express = require("express");
const router = express.Router();
const pool = require("../db");
const { uploadAttachmentToTemp, moveFromTempKeepExisting, deleteKey, getSignedDownloadUrl, 
} = require("../services/spacesUpload");

const { requireAuth } = require("../middlewares/authMiddleware");
const {
  requirePermission,
} = require("../middlewares/permissionMiddleware");

// =====================================================
// HELPERS
// =====================================================

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const toStr = (v) => String(v ?? "").trim();
const norm = (v) => toStr(v).toLowerCase();

const roleLower = (req) => norm(req.user?.role);
const departmentLower = (req) => norm(req.user?.department);

const isOperationDepartment = (req) =>
  departmentLower(req).includes("operation");

const isBranchManager = (req) =>
  roleLower(req) === "branch manager";

const isAreaManager = (req) =>
  roleLower(req) === "area manager";

const isRegionalManager = (req) =>
  roleLower(req) === "regional manager";

const isAssistantVicePresident = (req) =>
  roleLower(req) === "assistant vice president";

const isVicePresident = (req) =>
  roleLower(req) === "vice president";

const isSeniorVicePresident = (req) =>
  roleLower(req) === "senior vice president";

const userBranchCode = (req) =>
  toStr(req.user?.branch_id);

const userArea = (req) =>
  toStr(req.user?.area);

const userRegion = (req) =>
  toStr(req.user?.region);

const userDivision = (req) =>
  toStr(req.user?.division);

const userFullName = (req) => {
  const firstName = toStr(
    req.user?.first_name
  );

  const middleName = toStr(
    req.user?.middle_name
  );

  const lastName = toStr(
    req.user?.last_name
  );

  const fullName = [
    firstName,
    middleName,
    lastName,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    fullName ||
    toStr(req.user?.username) ||
    null
  );
};

// =====================================================
// OPERATION DEPARTMENT SCOPE
// =====================================================
//
// Branch Manager
//   → own branch only
//
// Area Manager
//   → own area only
//
// Regional Manager
//   → own region only
//
// Assistant Vice President
//   → own division only
//
// Vice President / Senior Vice President
//   → all Operation Department
//
// Other Operation roles
//   → no records
//
// Non-Operation Department
//   → normal permission-based access
// =====================================================

const getOperationScope = (req) => {
  if (!isOperationDepartment(req)) {
    return {
      where: "",
      params: [],
    };
  }

  // =====================================================
  // VP / SVP
  // See ALL staff under OPERATION DEPARTMENT
  // =====================================================
  if (
    isVicePresident(req) ||
    isSeniorVicePresident(req)
  ) {
    return {
      where: `
        AND LOWER(TRIM(COALESCE(s.department, '')))
            LIKE '%operation%'
      `,
      params: [],
    };
  }

  // =====================================================
  // AVP
  // Own division
  // =====================================================
  if (isAssistantVicePresident(req)) {
    const division = userDivision(req);

    if (!division) {
      return {
        where: "AND 1 = 0",
        params: [],
      };
    }

    return {
      where: `
        AND LOWER(TRIM(COALESCE(s.department, '')))
            LIKE '%operation%'
        AND LOWER(TRIM(COALESCE(s.division, '')))
            = LOWER(TRIM($1))
      `,
      params: [division],
    };
  }

  // =====================================================
  // REGIONAL MANAGER
  // Own region
  // =====================================================
  if (isRegionalManager(req)) {
    const region = userRegion(req);

    if (!region) {
      return {
        where: "AND 1 = 0",
        params: [],
      };
    }

    return {
      where: `
        AND LOWER(TRIM(COALESCE(s.department, '')))
            LIKE '%operation%'
        AND LOWER(TRIM(COALESCE(s.region, '')))
            = LOWER(TRIM($1))
      `,
      params: [region],
    };
  }

  // =====================================================
  // AREA MANAGER
  // Own area
  // =====================================================
  if (isAreaManager(req)) {
    const area = userArea(req);

    if (!area) {
      return {
        where: "AND 1 = 0",
        params: [],
      };
    }

    return {
      where: `
        AND LOWER(TRIM(COALESCE(s.department, '')))
            LIKE '%operation%'
        AND LOWER(TRIM(COALESCE(s.area, '')))
            = LOWER(TRIM($1))
      `,
      params: [area],
    };
  }

  // =====================================================
  // BRANCH MANAGER
  // Own branch only
  // =====================================================
  if (isBranchManager(req)) {
    const branchValue = userBranchCode(req);

    if (!branchValue) {
      return {
        where: "AND 1 = 0",
        params: [],
      };
    }

    return {
      where: `
        AND LOWER(TRIM(COALESCE(s.department, '')))
            LIKE '%operation%'
        AND (
          CAST(s.branch_id AS TEXT) = TRIM($1)
          OR LOWER(TRIM(COALESCE(b.code, '')))
             = LOWER(TRIM($1))
          OR LOWER(TRIM(COALESCE(b.name, '')))
             = LOWER(TRIM($1))
        )
      `,
      params: [branchValue],
    };
  }

  // Other Operation roles
  return {
    where: "AND 1 = 0",
    params: [],
  };
};

// =====================================================
// GENERATE ORDER NUMBER
// =====================================================

async function makeOrderNo() {
  const result = await pool.query(`
    SELECT
      'SBF-' ||
      LPAD(
        (COALESCE(MAX(id), 0) + 1)::text,
        6,
        '0'
      ) AS order_no
    FROM public.sbf_orders
  `);

  return (
    result.rows[0]?.order_no ||
    "SBF-000001"
  );
}

// =====================================================
// SELECT FIELDS
// =====================================================
//
// Used when sbf_orders has alias "so"
// =====================================================

const selectSbfFields = `
  so.id,
  so.order_no,
  so.employee_no,
  so.employee_name,
  so.branch_code,
  so.branch_name,
  so.assistance_type,
  so.amount,
  so.reason,
  so.date_created,
  so.effective_date,
  so.status,
  so.attachment_path,
  so.attachment_name,
  so.attachment_mime,
  so.approved_by,
  so.approved_at
`;

// =====================================================
// RETURNING FIELDS
// =====================================================
//
// INSERT / UPDATE do not use "so" alias,
// therefore these fields must NOT contain "so."
// =====================================================

const returningSbfFields = `
  id,
  order_no,
  employee_no,
  employee_name,
  branch_code,
  branch_name,
  assistance_type,
  amount,
  reason,
  date_created,
  effective_date,
  status,
  attachment_path,
  attachment_name,
  attachment_mime,
  approved_by,
  approved_at
`;

// =====================================================
// GET ALL SBF ORDERS
// =====================================================

router.get(
  "/sbf-orders",
  requireAuth,
  requirePermission("sbf_order", "view"),
  async (req, res) => {
    try {
      const scope = getOperationScope(req);

      let query = "";
      let params = [];

      // =================================================
      // OPERATION DEPARTMENT
      // Needs staff JOIN because BM/AM/RM/AVP scope
      // depends on branch/area/region/division.
      // =================================================
      if (isOperationDepartment(req)) {
        query = `
          SELECT DISTINCT
            ${selectSbfFields}

          FROM public.sbf_orders so

          LEFT JOIN public.staff s
            ON TRIM(COALESCE(s.employee_no::TEXT, ''))
              = TRIM(COALESCE(so.employee_no::TEXT, ''))

          LEFT JOIN public.branches b
            ON TRIM(COALESCE(b.id::TEXT, ''))
              = TRIM(COALESCE(s.branch_id::TEXT, ''))

          WHERE 1 = 1

          ${scope.where}

          ORDER BY so.id DESC
        `;

        params = scope.params;
      }

      // =================================================
      // ADMIN / IT / HR / ACCOUNTING / OTHER DEPARTMENTS
      // No staff JOIN is needed.
      // =================================================
      else {
        query = `
          SELECT
            ${selectSbfFields}

          FROM public.sbf_orders so

          ORDER BY so.id DESC
        `;

        params = [];
      }

      const result = await pool.query(query, params);

      return res.json(result.rows);
    } catch (err) {
      console.error("GET SBF ORDERS ERROR:", err);

      return res.status(500).json({
        message: err.message,
      });
    }
  }
);

// =====================================================
// GET SINGLE SBF ORDER
// =====================================================

router.get(
  "/sbf-orders/:id",
  requireAuth,
  requirePermission("sbf_order", "view"),
  async (req, res) => {
    try {
      const id = Number(req.params.id);

      if (!Number.isFinite(id)) {
        return res.status(400).json({
          message: "Invalid SBF order id",
        });
      }

      const scope =
        getOperationScope(req);

      /*
        Scope uses $1.

        Since this query already uses:
          $1 = SBF id

        move the scope parameter to:
          $2
      */

      const shiftedWhere =
        scope.where.replace(
          /\$1/g,
          "$2"
        );

      const result = await pool.query(
        `
        SELECT
          ${selectSbfFields}

        FROM public.sbf_orders so

        LEFT JOIN public.staff s
        ON TRIM(COALESCE(s.employee_no::TEXT, ''))
          = TRIM(COALESCE(so.employee_no::TEXT, ''))

        LEFT JOIN public.branches b
        ON TRIM(COALESCE(b.id::TEXT, ''))
          = TRIM(COALESCE(s.branch_id::TEXT, ''))

        WHERE so.id = $1

        ${shiftedWhere}
        `,
        [id, ...scope.params]
      );

      if (!result.rows.length) {
        return res.status(404).json({
          message:
            "SBF order not found",
        });
      }

      return res.json(
        result.rows[0]
      );
    } catch (err) {
      console.error(
        "GET SINGLE SBF ORDER ERROR:",
        err
      );

      return res.status(500).json({
        message: err.message,
      });
    }
  }
);

// =====================================================
// CREATE SBF ORDER
// =====================================================
//
// OPERATION:
//
// BM  → NO
// AM  → NO
// RM  → NO
// AVP → NO
// VP  → YES
// SVP → YES
//
// Other departments still follow role_permissions.
// =====================================================

router.post(
  "/sbf-orders",
  requireAuth,
  requirePermission(
    "sbf_order",
    "create"
  ),
  uploadAttachmentToTemp,
  async (req, res) => {
    try {
      // -----------------------------------------------
      // Operation Department create restriction
      // -----------------------------------------------

      if (
        isOperationDepartment(req) &&
        !isVicePresident(req) &&
        !isSeniorVicePresident(req)
      ) {
        return res.status(403).json({
          message:
            "Only Vice President and Senior Vice President of Operation Department can create SBF orders.",
        });
      }

      const {
        employee_no,
        employee_name,
        branch_code,
        branch_name,
        assistance_type,
        amount,
        reason,
        date_created,
        effective_date,
      } = req.body;

      const order_no =
        await makeOrderNo();

      let attachmentPath = null;

      const attachmentName =
        req.file?.originalname || null;

      const attachmentMime =
        req.file?.mimetype || null;

      if (req.file?.key) {
        attachmentPath =
          await moveFromTempKeepExisting(
            req.file.key,
            "sbf-orders",
            order_no,
            req.file.originalname || "sbf-file"
          );
      }
      const client = await pool.connect();

      try {
        await client.query("BEGIN");

        const result = await client.query(
          `
            INSERT INTO public.sbf_orders (
              order_no,
              employee_no,
              employee_name,
              branch_code,
              branch_name,
              assistance_type,
              amount,
              reason,
              date_created,
              effective_date,
              status,
              attachment_path,
              attachment_name,
              attachment_mime
            )
            VALUES (
              $1,
              $2,
              $3,
              $4,
              $5,
              $6,
              $7,
              $8,
              $9,
              $10,
              $11,
              $12,
              $13,
              $14
            )

            RETURNING
              ${returningSbfFields}
          `,
          [
            order_no,
            employee_no,
            employee_name,
            branch_code,
            branch_name,
            assistance_type,
            toNum(amount),
            reason,
            date_created || null,
            effective_date || null,
            "Pending",
            attachmentPath,
            attachmentName,
            attachmentMime,
          ]
        );

        const createdOrder = result.rows[0];

        await client.query(
          `
            INSERT INTO public.sbf_order_approval_history (
              sbf_order_id,
              action,
              acted_by_user_id,
              acted_by_name,
              acted_by_role,
              acted_by_department,
              remarks
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `,
          [
            createdOrder.id,
            "Created",
            req.user?.id ?? null,
            userFullName(req),
            req.user?.role ?? null,
            req.user?.department ?? null,
            "SBF Order created",
          ]
        );

        await client.query("COMMIT");

        return res
          .status(201)
          .json(createdOrder);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    } catch (err) {
      console.error(
        "CREATE SBF ORDER ERROR:",
        err
      );

      if (req.file?.key) {
        await deleteKey(
          req.file.key
        ).catch(() => {});
      }

      return res.status(500).json({
        message:
          err.message ||
          "Failed to create SBF order",
      });
    }
  }
);

// =====================================================
// DOWNLOAD SBF ATTACHMENT
// =====================================================
//
// Uses the SAME Operation scope.
// This prevents a user from manually changing the ID
// in the URL and downloading an SBF outside their scope.
// =====================================================

router.get(
  "/sbf-orders/:id/download",
  requireAuth,
  requirePermission("sbf_order", "view"),
  async (req, res) => {
    try {
      const id = Number(req.params.id);

      if (!Number.isFinite(id)) {
        return res.status(400).json({
          message: "Invalid SBF order id",
        });
      }

      const scope =
        getOperationScope(req);

      const shiftedWhere =
        scope.where.replace(
          /\$1/g,
          "$2"
        );

      const result =
        await pool.query(
          `
          SELECT
            so.attachment_path,
            so.attachment_name,
            so.attachment_mime

          FROM public.sbf_orders so

          LEFT JOIN public.staff s
          ON TRIM(COALESCE(s.employee_no::TEXT, ''))
            = TRIM(COALESCE(so.employee_no::TEXT, ''))

          LEFT JOIN public.branches b
          ON TRIM(COALESCE(b.id::TEXT, ''))
            = TRIM(COALESCE(s.branch_id::TEXT, ''))

          WHERE so.id = $1

          ${shiftedWhere}
          `,
          [id, ...scope.params]
        );

      if (!result.rows.length) {
        return res.status(404).json({
          message:
            "SBF order not found or outside your scope",
        });
      }

      const row =
        result.rows[0];

      if (!row.attachment_path) {
        return res.status(404).json({
          message:
            "No attachment uploaded",
        });
      }

      const url =
        await getSignedDownloadUrl(
          row.attachment_path,
          3600
        );

      return res.json({
        url,
        file_name:
          row.attachment_name ||
          `SBF-${id}-attachment`,
        expiresIn: 3600,
      });
    } catch (err) {
      console.error(
        "DOWNLOAD SBF FILE ERROR:",
        err
      );

      return res.status(500).json({
        message:
          err.message ||
          "Failed to download SBF attachment",
      });
    }
  }
);

// =====================================================
// APPROVE SBF ORDER
// =====================================================
//
// Approval behavior is intentionally kept the same.
// It continues to use role_permissions.
// =====================================================

router.put(
  "/sbf-orders/:id/approve",
  requireAuth,
  requirePermission(
    "sbf_order",
    "approve"
  ),
  async (req, res) => {
    const client = await pool.connect();

    try {
      if (isOperationDepartment(req)) {
        return res.status(403).json({
          message:
            "Operation Department users are not allowed to approve SBF orders.",
        });
      }

      const id = Number(req.params.id);

      if (!Number.isFinite(id)) {
        return res.status(400).json({
          message: "Invalid SBF order id",
        });
      }

      const approvedBy = Number(
        req.user?.id ??
          req.user?.user_id ??
          req.user?.employee_id
      );

      if (!Number.isFinite(approvedBy)) {
        return res.status(400).json({
          message:
            "Invalid approver id. Check req.user.id / user_id / employee_id",
        });
      }

      await client.query("BEGIN");

      const result = await client.query(
        `
          UPDATE public.sbf_orders
          SET
            status = 'Approved',
            approved_by = $2,
            approved_at = NOW()
          WHERE id = $1

          RETURNING
            ${returningSbfFields}
        `,
        [id, approvedBy]
      );

      if (!result.rows.length) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          message: "SBF order not found",
        });
      }

      const approvedOrder = result.rows[0];

      await client.query(
        `
          INSERT INTO public.sbf_order_approval_history (
            sbf_order_id,
            action,
            acted_by_user_id,
            acted_by_name,
            acted_by_role,
            acted_by_department,
            remarks
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          id,
          "Approved",
          approvedBy,
          userFullName(req),
          req.user?.role ?? null,
          req.user?.department ?? null,
          req.body?.remarks ?? "SBF Order approved",
        ]
      );

      await client.query("COMMIT");

      return res.json(approvedOrder);
    } catch (err) {
      await client.query("ROLLBACK");

      console.error(
        "APPROVE SBF ORDER ERROR:",
        err
      );

      return res.status(500).json({
        message: err.message,
      });
    } finally {
      client.release();
    }
  }
);

// =====================================================
// REJECT SBF ORDER
// =====================================================
//
// Reject behavior is intentionally kept the same.
// It continues to use role_permissions.
// =====================================================

router.put(
  "/sbf-orders/:id/reject",
  requireAuth,
  requirePermission(
    "sbf_order",
    "reject"
  ),
  async (req, res) => {
    const client = await pool.connect();

    try {
      if (isOperationDepartment(req)) {
        return res.status(403).json({
          message:
            "Operation Department users are not allowed to reject SBF orders.",
        });
      }

      const id = Number(req.params.id);

      if (!Number.isFinite(id)) {
        return res.status(400).json({
          message: "Invalid SBF order id",
        });
      }

      const rejectedBy = Number(
        req.user?.id ??
          req.user?.user_id ??
          req.user?.employee_id
      );

      if (!Number.isFinite(rejectedBy)) {
        return res.status(400).json({
          message:
            "Invalid rejector id. Check req.user.id / user_id / employee_id",
        });
      }

      await client.query("BEGIN");

      const result = await client.query(
        `
          UPDATE public.sbf_orders
          SET
            status = 'Rejected'
          WHERE id = $1

          RETURNING
            ${returningSbfFields}
        `,
        [id]
      );

      if (!result.rows.length) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          message: "SBF order not found",
        });
      }

      const rejectedOrder = result.rows[0];

      await client.query(
        `
          INSERT INTO public.sbf_order_approval_history (
            sbf_order_id,
            action,
            acted_by_user_id,
            acted_by_name,
            acted_by_role,
            acted_by_department,
            remarks
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          id,
          "Rejected",
          rejectedBy,
          userFullName(req),
          req.user?.role ?? null,
          req.user?.department ?? null,
          req.body?.remarks ?? "SBF Order rejected",
        ]
      );

      await client.query("COMMIT");

      return res.json(rejectedOrder);
    } catch (err) {
      await client.query("ROLLBACK");

      console.error(
        "REJECT SBF ORDER ERROR:",
        err
      );

      return res.status(500).json({
        message: err.message,
      });
    } finally {
      client.release();
    }
  }
);

// =====================================================
// GET SBF APPROVAL HISTORY
// =====================================================

router.get(
  "/sbf-orders/:id/history",
  requireAuth,
  requirePermission(
    "sbf_order",
    "view"
  ),
  async (req, res) => {
    try {
      const id = Number(req.params.id);

      if (!Number.isFinite(id)) {
        return res.status(400).json({
          message: "Invalid SBF order id",
        });
      }

      const scope = getOperationScope(req);

      const shiftedWhere = scope.where.replace(
        /\$1/g,
        "$2"
      );

      const result = await pool.query(
        `
          SELECT
            h.id,
            h.sbf_order_id,
            h.action,
            h.acted_by_user_id,
            h.acted_by_name,
            h.acted_by_role,
            h.acted_by_department,
            h.remarks,
            h.created_at

          FROM public.sbf_order_approval_history h

          INNER JOIN public.sbf_orders so
            ON so.id = h.sbf_order_id

          LEFT JOIN public.staff s
            ON TRIM(COALESCE(s.employee_no::TEXT, ''))
            = TRIM(COALESCE(so.employee_no::TEXT, ''))

          LEFT JOIN public.branches b
            ON TRIM(COALESCE(b.id::TEXT, ''))
            = TRIM(COALESCE(s.branch_id::TEXT, ''))

          WHERE h.sbf_order_id = $1

          ${shiftedWhere}

          ORDER BY h.created_at ASC, h.id ASC
        `,
        [id, ...scope.params]
      );

      return res.json(result.rows);
    } catch (err) {
      console.error(
        "GET SBF APPROVAL HISTORY ERROR:",
        err
      );

      return res.status(500).json({
        message:
          err.message ||
          "Failed to load SBF approval history",
      });
    }
  }
);

module.exports = router;