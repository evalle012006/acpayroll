const express = require("express");
const router = express.Router();
const pool = require("../db");

const {
  requireAuth,
} = require("../middlewares/authMiddleware");

const {
  requirePermission,
} = require("../middlewares/permissionMiddleware");

const toInt = (v) => {
  const n = Number(v);
  return Number.isFinite(n)
    ? Math.trunc(n)
    : null;
};

const toYear = (v) => {
  const n = Number(v);

  if (
    !Number.isFinite(n) ||
    n < 1900 ||
    n > 9999
  ) {
    return null;
  }

  return Math.trunc(n);
};

const clean = (v) =>
  String(v ?? "").trim();

/*
  GET ALL CONSOLIDATION
*/
router.get(
  "/consolidation",
  requireAuth,
  requirePermission(
    "consolidation",
    "view"
  ),
  async (_req, res) => {
    try {
      const result =
        await pool.query(`
          SELECT
            id,
            year,
            company_name,
            tin,
            created_at,
            updated_at
          FROM public.consolidation_2316
          ORDER BY year DESC, id DESC
        `);

      return res.json(
        result.rows
      );
    } catch (err) {
      console.error(
        "GET /consolidation error:",
        err
      );

      return res.status(500).json({
        message:
          "Failed to fetch consolidation records",
      });
    }
  }
);

/*
  CREATE
*/
router.post(
  "/consolidation",
  requireAuth,
  requirePermission(
    "consolidation",
    "create"
  ),
  async (req, res) => {
    try {
      const year = toYear(
        req.body?.year
      );

      const company_name =
        clean(
          req.body
            ?.company_name
        );

      const tin = clean(
        req.body?.tin
      );

      if (!year) {
        return res.status(400).json({
          message:
            "Valid year is required",
        });
      }

      if (!company_name) {
        return res.status(400).json({
          message:
            "company_name is required",
        });
      }

      if (!tin) {
        return res.status(400).json({
          message:
            "tin is required",
        });
      }

      const dup =
        await pool.query(
          `
          SELECT id
          FROM public.consolidation_2316
          WHERE year = $1
            AND LOWER(TRIM(company_name)) =
                LOWER(TRIM($2))
          LIMIT 1
          `,
          [
            year,
            company_name,
          ]
        );

      if (
        dup.rowCount > 0
      ) {
        return res.status(409).json({
          message:
            "Consolidation record already exists",
        });
      }

      const result =
        await pool.query(
          `
          INSERT INTO public.consolidation_2316
          (
            year,
            company_name,
            tin,
            created_at,
            updated_at
          )
          VALUES
          (
            $1,
            $2,
            $3,
            NOW(),
            NOW()
          )
          RETURNING *
          `,
          [
            year,
            company_name,
            tin,
          ]
        );

      return res
        .status(201)
        .json(
          result.rows[0]
        );
    } catch (err) {
      console.error(
        "POST /consolidation error:",
        err
      );

      return res.status(500).json({
        message:
          "Failed to create consolidation record",
      });
    }
  }
);

/*
  UPDATE
*/
router.put(
  "/consolidation/:id",
  requireAuth,
  requirePermission(
    "consolidation",
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
            "Invalid id",
        });
      }

      const year = toYear(
        req.body?.year
      );

      const company_name =
        clean(
          req.body
            ?.company_name
        );

      const tin = clean(
        req.body?.tin
      );

      if (!year) {
        return res.status(400).json({
          message:
            "Valid year is required",
        });
      }

      if (!company_name) {
        return res.status(400).json({
          message:
            "company_name is required",
        });
      }

      if (!tin) {
        return res.status(400).json({
          message:
            "tin is required",
        });
      }

      const dup =
        await pool.query(
          `
          SELECT id
          FROM public.consolidation_2316
          WHERE year = $1
            AND LOWER(TRIM(company_name)) =
                LOWER(TRIM($2))
            AND id <> $3
          LIMIT 1
          `,
          [
            year,
            company_name,
            id,
          ]
        );

      if (
        dup.rowCount > 0
      ) {
        return res.status(409).json({
          message:
            "Consolidation record already exists",
        });
      }

      const result =
        await pool.query(
          `
          UPDATE public.consolidation_2316
          SET
            year = $1,
            company_name = $2,
            tin = $3,
            updated_at = NOW()
          WHERE id = $4
          RETURNING *
          `,
          [
            year,
            company_name,
            tin,
            id,
          ]
        );

      if (
        result.rowCount ===
        0
      ) {
        return res.status(404).json({
          message:
            "Consolidation record not found",
        });
      }

      return res.json(
        result.rows[0]
      );
    } catch (err) {
      console.error(
        "PUT /consolidation/:id error:",
        err
      );

      return res.status(500).json({
        message:
          "Failed to update consolidation record",
      });
    }
  }
);

/*
  DELETE
*/
router.delete(
  "/consolidation/:id",
  requireAuth,
  requirePermission(
    "consolidation",
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
            "Invalid id",
        });
      }

      const result =
        await pool.query(
          `
          DELETE FROM public.consolidation_2316
          WHERE id = $1
          RETURNING id
          `,
          [id]
        );

      if (
        result.rowCount ===
        0
      ) {
        return res.status(404).json({
          message:
            "Consolidation record not found",
        });
      }

      return res.json({
        message:
          "Consolidation record deleted successfully",
      });
    } catch (err) {
      console.error(
        "DELETE /consolidation/:id error:",
        err
      );

      return res.status(500).json({
        message:
          "Failed to delete consolidation record",
      });
    }
  }
);

module.exports = router;