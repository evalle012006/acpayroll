const express = require("express");
const router = express.Router();
const pool = require("../db");
const { requireAuth, requireRole } = require("../middlewares/authMiddleware");

const toStr = (v) => String(v ?? "").trim();

router.get("/area-configurations", requireAuth, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT * FROM public.area_configurations ORDER BY id DESC`
    );
    res.json(r.rows);
  } catch (err) {
    console.error("GET area-configurations ERROR:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.post(
  "/area-configurations",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    try {
      const area = toStr(req.body.area);
      const region = toStr(req.body.region);
      const division = toStr(req.body.division);

      if (!area || !region || !division) {
        return res
          .status(400)
          .json({ message: "Area, Region, and Division are required" });
      }

      const r = await pool.query(
        `
        INSERT INTO public.area_configurations
        (area, region, division)
        VALUES ($1,$2,$3)
        RETURNING *
        `,
        [area, region, division]
      );

      res.json(r.rows[0]);
    } catch (err) {
      console.error("POST area-configurations ERROR:", err.message);
      res.status(500).json({ message: "Server error" });
    }
  }
);

router.put(
  "/area-configurations/:id",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    try {
      const id = Number(req.params.id);
      const area = toStr(req.body.area);
      const region = toStr(req.body.region);
      const division = toStr(req.body.division);

      const r = await pool.query(
        `
        UPDATE public.area_configurations
        SET area=$1, region=$2, division=$3
        WHERE id=$4
        RETURNING *
        `,
        [area, region, division, id]
      );

      res.json(r.rows[0]);
    } catch (err) {
      console.error("PUT area-configurations ERROR:", err.message);
      res.status(500).json({ message: "Server error" });
    }
  }
);

router.delete(
  "/area-configurations/:id",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    try {
      const id = Number(req.params.id);

      await pool.query(
        `DELETE FROM public.area_configurations WHERE id=$1`,
        [id]
      );

      res.json({ message: "Deleted" });
    } catch (err) {
      console.error("DELETE area-configurations ERROR:", err.message);
      res.status(500).json({ message: "Server error" });
    }
  }
);

module.exports = router;