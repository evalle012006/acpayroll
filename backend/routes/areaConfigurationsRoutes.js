const express = require("express");
const router = express.Router();
const pool = require("../db");

const {
  requireAuth,
} = require("../middlewares/authMiddleware");

const {
  requirePermission,
} = require("../middlewares/permissionMiddleware");

const toStr = (v) =>
  String(v ?? "").trim();

const toInt = (v) => {
  const n = Number(v);
  return Number.isFinite(n)
    ? Math.trunc(n)
    : null;
};

/*
  GET ALL
*/
router.get(
  "/area-configurations",
  requireAuth,
  requirePermission(
    "area_configuration",
    "view"
  ),
  async (_req, res) => {
    try {
      const r = await pool.query(`
        SELECT
          id,
          area,
          region,
          division,
          created_at,
          updated_at
        FROM public.area_configurations
        ORDER BY id DESC
      `);

      return res.json(r.rows);
    } catch (err) {
      console.error(
        "GET area-configurations ERROR:",
        err.message
      );

      return res.status(500).json({
        message: "Server error",
      });
    }
  }
);

/*
  CREATE
*/
router.post(
  "/area-configurations",
  requireAuth,
  requirePermission(
    "area_configuration",
    "create"
  ),
  async (req, res) => {
    try {
      const area = toStr(
        req.body?.area
      );

      const region = toStr(
        req.body?.region
      );

      const division = toStr(
        req.body?.division
      );

      if (!area) {
        return res.status(400).json({
          message:
            "Area is required",
        });
      }

      if (!region) {
        return res.status(400).json({
          message:
            "Region is required",
        });
      }

      if (!division) {
        return res.status(400).json({
          message:
            "Division is required",
        });
      }

      /*
        DUPLICATE CHECK
      */

      const dup =
        await pool.query(
          `
          SELECT id
          FROM public.area_configurations
          WHERE
            LOWER(TRIM(area)) = LOWER(TRIM($1))
            AND LOWER(TRIM(region)) = LOWER(TRIM($2))
            AND LOWER(TRIM(division)) = LOWER(TRIM($3))
          LIMIT 1
          `,
          [
            area,
            region,
            division,
          ]
        );

      if (dup.rowCount > 0) {
        return res.status(409).json({
          message:
            "Configuration already exists",
        });
      }

      const r =
        await pool.query(
          `
          INSERT INTO public.area_configurations
          (
            area,
            region,
            division,
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
          RETURNING
            id,
            area,
            region,
            division,
            created_at,
            updated_at
          `,
          [
            area,
            region,
            division,
          ]
        );

      return res.json(r.rows[0]);
    } catch (err) {
      console.error(
        "POST area-configurations ERROR:",
        err.message
      );

      return res.status(500).json({
        message: "Server error",
      });
    }
  }
);

/*
  UPDATE
*/
router.put(
  "/area-configurations/:id",
  requireAuth,
  requirePermission(
    "area_configuration",
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
            "Invalid configuration id",
        });
      }

      const area = toStr(
        req.body?.area
      );

      const region = toStr(
        req.body?.region
      );

      const division = toStr(
        req.body?.division
      );

      if (!area) {
        return res.status(400).json({
          message:
            "Area is required",
        });
      }

      if (!region) {
        return res.status(400).json({
          message:
            "Region is required",
        });
      }

      if (!division) {
        return res.status(400).json({
          message:
            "Division is required",
        });
      }

      /*
        DUPLICATE CHECK
      */

      const dup =
        await pool.query(
          `
          SELECT id
          FROM public.area_configurations
          WHERE
            LOWER(TRIM(area)) = LOWER(TRIM($1))
            AND LOWER(TRIM(region)) = LOWER(TRIM($2))
            AND LOWER(TRIM(division)) = LOWER(TRIM($3))
            AND id <> $4
          LIMIT 1
          `,
          [
            area,
            region,
            division,
            id,
          ]
        );

      if (dup.rowCount > 0) {
        return res.status(409).json({
          message:
            "Configuration already exists",
        });
      }

      const r =
        await pool.query(
          `
          UPDATE public.area_configurations
          SET
            area = $1,
            region = $2,
            division = $3,
            updated_at = NOW()
          WHERE id = $4
          RETURNING
            id,
            area,
            region,
            division,
            created_at,
            updated_at
          `,
          [
            area,
            region,
            division,
            id,
          ]
        );

      if (r.rowCount === 0) {
        return res.status(404).json({
          message:
            "Configuration not found",
        });
      }

      return res.json(r.rows[0]);
    } catch (err) {
      console.error(
        "PUT area-configurations ERROR:",
        err.message
      );

      return res.status(500).json({
        message: "Server error",
      });
    }
  }
);

/*
  DELETE
*/
router.delete(
  "/area-configurations/:id",
  requireAuth,
  requirePermission(
    "area_configuration",
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
            "Invalid configuration id",
        });
      }

      const r =
        await pool.query(
          `
          DELETE FROM public.area_configurations
          WHERE id = $1
          RETURNING id
          `,
          [id]
        );

      if (r.rowCount === 0) {
        return res.status(404).json({
          message:
            "Configuration not found",
        });
      }

      return res.json({
        message:
          "Area configuration deleted",
        id: r.rows[0].id,
      });
    } catch (err) {
      console.error(
        "DELETE area-configurations ERROR:",
        err.message
      );

      return res.status(500).json({
        message: "Server error",
      });
    }
  }
);

module.exports = router;