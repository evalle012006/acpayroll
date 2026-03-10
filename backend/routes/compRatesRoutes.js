const express = require("express");
const router = express.Router();
const pool = require("../db");
const { requireAuth, requireRole } = require("../middlewares/authMiddleware");

const toNum = (v) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const clean = (v) => String(v ?? "").trim();

router.get(
  "/comp-rates",
  requireAuth,
  requireRole(["admin", "branch manager"]),
  async (_req, res) => {
    try {
      const r = await pool.query(`
        SELECT
          id,
          position,
          salary,
          ecola,
          transportation,
          cbu,
          cashbond,
          utility,
          updated_at,
          created_at
        FROM public.position_comp_rates
        ORDER BY position ASC
      `);

      return res.json(r.rows);
    } catch (e) {
      console.error("GET /api/comp-rates ERROR:", e.message);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

router.post(
  "/comp-rates",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    try {
      const position = clean(req.body?.position);
      const salary = toNum(req.body?.salary);
      const ecola = toNum(req.body?.ecola);
      const transportation = toNum(req.body?.transportation);
      const cbu = toNum(req.body?.cbu);
      const cashbond = toNum(req.body?.cashbond);
      const utility = toNum(req.body?.utility);

      if (!position)
        return res.status(400).json({ message: "position is required" });

      const r = await pool.query(
        `
        INSERT INTO public.position_comp_rates
        (
          position,
          salary,
          ecola,
          transportation,
          cbu,
          cashbond,
          utility
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        RETURNING
          id,
          position,
          salary,
          ecola,
          transportation,
          cbu,
          cashbond,
          utility,
          updated_at,
          created_at
        `,
        [position, salary, ecola, transportation, cbu, cashbond, utility]
      );

      return res.json({ message: "Created", rate: r.rows[0] });
    } catch (e) {
      if (String(e.code) === "23505") {
        return res.status(409).json({ message: "Position already exists" });
      }

      console.error("POST /api/comp-rates ERROR:", e.message);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

router.put(
  "/comp-rates/:id",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id) || id <= 0)
        return res.status(400).json({ message: "Invalid id" });

      const position = clean(req.body?.position);
      const salary = toNum(req.body?.salary);
      const ecola = toNum(req.body?.ecola);
      const transportation = toNum(req.body?.transportation);
      const cbu = toNum(req.body?.cbu);
      const cashbond = toNum(req.body?.cashbond);
      const utility = toNum(req.body?.utility);

      if (!position)
        return res.status(400).json({ message: "position is required" });

      const r = await pool.query(
        `
        UPDATE public.position_comp_rates
        SET
          position=$1,
          salary=$2,
          ecola=$3,
          transportation=$4,
          cbu=$5,
          cashbond=$6,
          utility=$7,
          updated_at=NOW()
        WHERE id=$8
        RETURNING
          id,
          position,
          salary,
          ecola,
          transportation,
          cbu,
          cashbond,
          utility,
          updated_at,
          created_at
        `,
        [
          position,
          salary,
          ecola,
          transportation,
          cbu,
          cashbond,
          utility,
          id,
        ]
      );

      if (r.rowCount === 0)
        return res.status(404).json({ message: "Not found" });

      return res.json({ message: "Updated", rate: r.rows[0] });
    } catch (e) {
      if (String(e.code) === "23505") {
        return res.status(409).json({ message: "Position already exists" });
      }

      console.error("PUT /api/comp-rates/:id ERROR:", e.message);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

router.delete(
  "/comp-rates/:id",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id) || id <= 0)
        return res.status(400).json({ message: "Invalid id" });

      const r = await pool.query(
        `DELETE FROM public.position_comp_rates WHERE id=$1 RETURNING id`,
        [id]
      );

      if (r.rowCount === 0)
        return res.status(404).json({ message: "Not found" });

      return res.json({ message: "Deleted" });
    } catch (e) {
      console.error("DELETE /api/comp-rates/:id ERROR:", e.message);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

module.exports = router;