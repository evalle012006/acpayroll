const express = require("express");
const router = express.Router();
const pool = require("../db");

const {
  requireAuth,
} = require("../middlewares/authMiddleware");

const {
  requirePermission,
} = require("../middlewares/permissionMiddleware");

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

const toInt = (v) => {
  const n = Number(v);

  return Number.isFinite(n)
    ? Math.trunc(n)
    : null;
};

const clean = (v) =>
  String(v ?? "").trim();

const toStr = (v) =>
  String(v ?? "").trim();

const getUserBranchCode = (req) =>
  toStr(req.user?.branch_id);

const getUserArea = (req) =>
  toStr(req.user?.area);

const getUserRegion = (req) =>
  toStr(req.user?.region);

const getUserDivision = (req) =>
  toStr(req.user?.division);

async function getBranchIdFromCode(branchCode) {
  const code =
    toStr(branchCode);

  if (!code) return null;

  const r =
    await pool.query(
      `
      SELECT id
      FROM public.branches
      WHERE LOWER(TRIM(code)) =
            LOWER(TRIM($1))
      LIMIT 1
      `,
      [code]
    );

  if (
    r.rowCount === 0
  ) {
    return null;
  }

  return r.rows[0].id;
}

function canViewAllDepartments(req) {
  return (
    isAdmin(req) ||
    isIT(req) ||
    isHr(req) ||
    isAccounting(req) ||
    isTread(req) ||
    isVicePresident(req) ||
    isSeniorVicePresident(req) ||
    isPresident(req)
  );
}

/*
  GET DEPARTMENTS
*/
router.get(
  "/departments",
  requireAuth,
  requirePermission(
    "department",
    "view"
  ),
  async (_req, res) => {
    try {
      const r =
        await pool.query(`
          SELECT
            id,
            code,
            name,
            description,
            created_at,
            updated_at
          FROM public.departments
          ORDER BY id ASC
        `);

      return res.json(
        r.rows
      );
    } catch (e) {
      console.error(
        "GET /api/departments ERROR:",
        e.message
      );

      return res.status(500).json({
        message:
          "Server error",
      });
    }
  }
);

/*
  GET STAFF BY DEPARTMENT
*/
router.get(
  "/departments/:id/staff",
  requireAuth,
  requirePermission(
    "staff_information",
    "view"
  ),
  async (req, res) => {
    try {
      const id = toInt(
        req.params.id
      );

      if (!id) {
        return res.status(400).json({
          message:
            "Invalid department id",
        });
      }

      const dep =
        await pool.query(
          `
          SELECT id, name
          FROM public.departments
          WHERE id = $1
          `,
          [id]
        );

      if (
        dep.rowCount === 0
      ) {
        return res.status(404).json({
          message:
            "Department not found",
        });
      }

      const depName =
        clean(
          dep.rows[0].name
        );

      /*
        FULL ACCESS
      */

      if (
        canViewAllDepartments(
          req
        )
      ) {
        const r =
          await pool.query(
            `
            SELECT
              s.*,
              br.code AS branch_code,
              br.name AS branch_name

            FROM public.staff s

            LEFT JOIN public.branches br
              ON br.id = s.branch_id

            WHERE COALESCE(
                    s.department,
                    ''
                  ) = $1

            ORDER BY s.fullname ASC
            `,
            [depName]
          );

        return res.json(
          r.rows
        );
      }

      /*
        BRANCH MANAGER
      */

      if (
        isBranchManager(
          req
        )
      ) {
        const branchCode =
          getUserBranchCode(
            req
          );

        if (!branchCode) {
          return res.json([]);
        }

        const branchId =
          await getBranchIdFromCode(
            branchCode
          );

        if (!branchId) {
          return res.json([]);
        }

        const r =
          await pool.query(
            `
            SELECT
              s.*,
              br.code AS branch_code,
              br.name AS branch_name

            FROM public.staff s

            LEFT JOIN public.branches br
              ON br.id = s.branch_id

            WHERE COALESCE(
                    s.department,
                    ''
                  ) = $1

              AND s.branch_id = $2

            ORDER BY s.fullname ASC
            `,
            [
              depName,
              branchId,
            ]
          );

        return res.json(
          r.rows
        );
      }

      /*
        AREA MANAGER
      */

      if (
        isAreaManager(req)
      ) {
        const area =
          getUserArea(req);

        if (!area) {
          return res.json([]);
        }

        const r =
          await pool.query(
            `
            SELECT
              s.*,
              br.code AS branch_code,
              br.name AS branch_name

            FROM public.staff s

            LEFT JOIN public.branches br
              ON br.id = s.branch_id

            WHERE COALESCE(
                    s.department,
                    ''
                  ) = $1

              AND LOWER(
                    TRIM(
                      COALESCE(
                        s.area,
                        ''
                      )
                    )
                  ) =
                  LOWER(
                    TRIM($2)
                  )

            ORDER BY s.fullname ASC
            `,
            [
              depName,
              area,
            ]
          );

        return res.json(
          r.rows
        );
      }

      /*
        REGIONAL MANAGER
      */

      if (
        isRegionalManager(
          req
        )
      ) {
        const region =
          getUserRegion(req);

        if (!region) {
          return res.json([]);
        }

        const r =
          await pool.query(
            `
            SELECT
              s.*,
              br.code AS branch_code,
              br.name AS branch_name

            FROM public.staff s

            LEFT JOIN public.branches br
              ON br.id = s.branch_id

            WHERE COALESCE(
                    s.department,
                    ''
                  ) = $1

              AND LOWER(
                    TRIM(
                      COALESCE(
                        s.region,
                        ''
                      )
                    )
                  ) =
                  LOWER(
                    TRIM($2)
                  )

            ORDER BY s.fullname ASC
            `,
            [
              depName,
              region,
            ]
          );

        return res.json(
          r.rows
        );
      }

      /*
        AVP
      */

      if (
        isAssistantVicePresident(
          req
        )
      ) {
        const division =
          getUserDivision(
            req
          );

        if (!division) {
          return res.json([]);
        }

        const r =
          await pool.query(
            `
            SELECT
              s.*,
              br.code AS branch_code,
              br.name AS branch_name

            FROM public.staff s

            LEFT JOIN public.branches br
              ON br.id = s.branch_id

            WHERE COALESCE(
                    s.department,
                    ''
                  ) = $1

              AND LOWER(
                    TRIM(
                      COALESCE(
                        s.division,
                        ''
                      )
                    )
                  ) =
                  LOWER(
                    TRIM($2)
                  )

            ORDER BY s.fullname ASC
            `,
            [
              depName,
              division,
            ]
          );

        return res.json(
          r.rows
        );
      }

      return res.status(403).json({
        message:
          "Access denied",
      });
    } catch (e) {
      console.error(
        "GET /api/departments/:id/staff ERROR:",
        e.message
      );

      return res.status(500).json({
        message:
          "Server error",
      });
    }
  }
);

/*
  CREATE DEPARTMENT
*/
router.post(
  "/departments",
  requireAuth,
  requirePermission(
    "department",
    "create"
  ),
  async (req, res) => {
    try {
      const code = clean(
        req.body?.code
      );

      const name = clean(
        req.body?.name
      );

      const description =
        clean(
          req.body
            ?.description
        );

      if (!name) {
        return res.status(400).json({
          message:
            "name is required",
        });
      }

      if (code) {
        const exists =
          await pool.query(
            `
            SELECT id
            FROM public.departments
            WHERE LOWER(TRIM(code)) =
                  LOWER(TRIM($1))
            LIMIT 1
            `,
            [code]
          );

        if (
          exists.rowCount >
          0
        ) {
          return res.status(409).json({
            message:
              "Department code already exists",
          });
        }
      }

      const r =
        await pool.query(
          `
          INSERT INTO public.departments
            (
              code,
              name,
              description
            )
          VALUES
            (
              $1,
              $2,
              $3
            )

          RETURNING
            id,
            code,
            name,
            description,
            created_at,
            updated_at
          `,
          [
            code || null,
            name,
            description ||
              null,
          ]
        );

      return res.json({
        message:
          "Department created",

        department:
          r.rows[0],
      });
    } catch (e) {
      console.error(
        "POST /api/departments ERROR:",
        e.message
      );

      return res.status(500).json({
        message:
          "Server error",
      });
    }
  }
);

/*
  UPDATE DEPARTMENT
*/
router.put(
  "/departments/:id",
  requireAuth,
  requirePermission(
    "department",
    "edit"
  ),
  async (req, res) => {
    try {
      const id = toInt(
        req.params.id
      );

      if (!id) {
        return res.status(400).json({
          message:
            "Invalid department id",
        });
      }

      const code = clean(
        req.body?.code
      );

      const name = clean(
        req.body?.name
      );

      const description =
        clean(
          req.body
            ?.description
        );

      if (!name) {
        return res.status(400).json({
          message:
            "name is required",
        });
      }

      if (code) {
        const exists =
          await pool.query(
            `
            SELECT id
            FROM public.departments
            WHERE LOWER(TRIM(code)) =
                  LOWER(TRIM($1))
              AND id <> $2
            LIMIT 1
            `,
            [
              code,
              id,
            ]
          );

        if (
          exists.rowCount >
          0
        ) {
          return res.status(409).json({
            message:
              "Department code already exists",
          });
        }
      }

      const r =
        await pool.query(
          `
          UPDATE public.departments
          SET
            code = $1,
            name = $2,
            description = $3,
            updated_at = NOW()

          WHERE id = $4

          RETURNING
            id,
            code,
            name,
            description,
            created_at,
            updated_at
          `,
          [
            code || null,
            name,
            description ||
              null,
            id,
          ]
        );

      if (
        r.rowCount ===
        0
      ) {
        return res.status(404).json({
          message:
            "Department not found",
        });
      }

      return res.json({
        message:
          "Department updated",

        department:
          r.rows[0],
      });
    } catch (e) {
      console.error(
        "PUT /api/departments/:id ERROR:",
        e.message
      );

      return res.status(500).json({
        message:
          "Server error",
      });
    }
  }
);

/*
  DELETE DEPARTMENT
*/
router.delete(
  "/departments/:id",
  requireAuth,
  requirePermission(
    "department",
    "delete"
  ),
  async (req, res) => {
    try {
      const id = toInt(
        req.params.id
      );

      if (!id) {
        return res.status(400).json({
          message:
            "Invalid department id",
        });
      }

      const staffCheck =
        await pool.query(
          `
          SELECT id
          FROM public.staff
          WHERE LOWER(
                  TRIM(
                    COALESCE(
                      department,
                      ''
                    )
                  )
                ) = LOWER(
                      TRIM(
                        (
                          SELECT name
                          FROM public.departments
                          WHERE id = $1
                        )
                      )
                    )
          LIMIT 1
          `,
          [id]
        );

      if (
        staffCheck.rowCount >
        0
      ) {
        return res.status(400).json({
          message:
            "Cannot delete department because it is already assigned to staff",
        });
      }

      const r =
        await pool.query(
          `
          DELETE FROM public.departments
          WHERE id = $1
          RETURNING id
          `,
          [id]
        );

      if (
        r.rowCount ===
        0
      ) {
        return res.status(404).json({
          message:
            "Department not found",
        });
      }

      return res.json({
        message:
          "Department deleted",
      });
    } catch (e) {
      console.error(
        "DELETE /api/departments/:id ERROR:",
        e.message
      );

      return res.status(500).json({
        message:
          "Server error",
      });
    }
  }
);

module.exports = router;