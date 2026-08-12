const express = require("express");
const router = express.Router();
const pool = require("../db");

const fs = require("fs");
const path = require("path");
const multer = require("multer");

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

const userBranchId = (req) =>
  Number(req.user?.branch_id || 0);

const userArea = (req) =>
  toStr(req.user?.area);

const userRegion = (req) =>
  toStr(req.user?.region);

const userDivision = (req) =>
  toStr(req.user?.division);

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

  // VP / SVP → all Operation Department
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

  // AVP → own division
  if (isAssistantVicePresident(req)) {
    return {
      where: `
        AND LOWER(TRIM(COALESCE(s.department, '')))
            LIKE '%operation%'

        AND LOWER(TRIM(COALESCE(s.division, '')))
            = LOWER(TRIM($1))
      `,
      params: [userDivision(req)],
    };
  }

  // RM → own region
  if (isRegionalManager(req)) {
    return {
      where: `
        AND LOWER(TRIM(COALESCE(s.department, '')))
            LIKE '%operation%'

        AND LOWER(TRIM(COALESCE(s.region, '')))
            = LOWER(TRIM($1))
      `,
      params: [userRegion(req)],
    };
  }

  // AM → own area
  if (isAreaManager(req)) {
    return {
      where: `
        AND LOWER(TRIM(COALESCE(s.department, '')))
            LIKE '%operation%'

        AND LOWER(TRIM(COALESCE(s.area, '')))
            = LOWER(TRIM($1))
      `,
      params: [userArea(req)],
    };
  }

  // BM → own branch
  if (isBranchManager(req)) {
    return {
      where: `
        AND LOWER(TRIM(COALESCE(s.department, '')))
            LIKE '%operation%'

        AND s.branch_id = $1
      `,
      params: [userBranchId(req)],
    };
  }

  // Any other Operation role → no SBF records
  return {
    where: "AND 1 = 0",
    params: [],
  };
};

// =====================================================
// FILE UPLOAD
// =====================================================

const uploadDir = path.join(
  __dirname,
  "..",
  "uploads",
  "sbf-orders"
);

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, {
    recursive: true,
  });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },

  filename: (_req, file, cb) => {
    const safeName = String(
      file.originalname || "file"
    )
      .replace(/[^\w.\-() ]+/g, "_")
      .replace(/\s+/g, "_");

    cb(
      null,
      `${Date.now()}-${safeName}`
    );
  },
});

const upload = multer({
  storage,

  limits: {
    fileSize: 50 * 1024 * 1024,
  },
});

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
            ON LOWER(TRIM(COALESCE(s.employee_no, '')))
             = LOWER(TRIM(COALESCE(so.employee_no, '')))

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
          ON LOWER(
               TRIM(
                 COALESCE(
                   s.employee_no,
                   ''
                 )
               )
             )
           =
             LOWER(
               TRIM(
                 COALESCE(
                   so.employee_no,
                   ''
                 )
               )
             )

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
  upload.single("attachment"),
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

      const attachmentPath =
        req.file
          ? `/uploads/sbf-orders/${req.file.filename}`
          : null;

      const attachmentName =
        req.file?.originalname ||
        null;

      const attachmentMime =
        req.file?.mimetype ||
        null;

      const result =
        await pool.query(
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

      return res
        .status(201)
        .json(result.rows[0]);
    } catch (err) {
      console.error(
        "CREATE SBF ORDER ERROR:",
        err
      );

      return res.status(500).json({
        message: err.message,
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
          message:
            "Invalid SBF order id",
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
            ON LOWER(
                 TRIM(
                   COALESCE(
                     s.employee_no,
                     ''
                   )
                 )
               )
             =
               LOWER(
                 TRIM(
                   COALESCE(
                     so.employee_no,
                     ''
                   )
                 )
               )

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

      const row =
        result.rows[0];

      if (!row.attachment_path) {
        return res.status(404).json({
          message:
            "No attachment uploaded",
        });
      }

      const filename =
        path.basename(
          row.attachment_path
        );

      const filePath =
        path.join(
          uploadDir,
          filename
        );

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({
          message:
            "File not found on server",
        });
      }

      if (row.attachment_mime) {
        res.setHeader(
          "Content-Type",
          row.attachment_mime
        );
      }

      return res.download(
        filePath,
        row.attachment_name ||
          filename
      );
    } catch (err) {
      console.error(
        "DOWNLOAD SBF FILE ERROR:",
        err
      );

      return res.status(500).json({
        message: err.message,
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
    try {
      const id =
        Number(req.params.id);

      if (!Number.isFinite(id)) {
        return res.status(400).json({
          message:
            "Invalid SBF order id",
        });
      }

      const approvedBy = Number(
        req.user?.id ??
          req.user?.user_id ??
          req.user?.employee_id
      );

      if (
        !Number.isFinite(
          approvedBy
        )
      ) {
        return res.status(400).json({
          message:
            "Invalid approver id. Check req.user.id / user_id / employee_id",
        });
      }

      const result =
        await pool.query(
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
          [
            id,
            approvedBy,
          ]
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
        "APPROVE SBF ORDER ERROR:",
        err
      );

      return res.status(500).json({
        message: err.message,
      });
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
    try {
      const id =
        Number(req.params.id);

      if (!Number.isFinite(id)) {
        return res.status(400).json({
          message:
            "Invalid SBF order id",
        });
      }

      const result =
        await pool.query(
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
        "REJECT SBF ORDER ERROR:",
        err
      );

      return res.status(500).json({
        message: err.message,
      });
    }
  }
);

module.exports = router;