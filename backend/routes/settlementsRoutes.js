const express = require("express");
const router = express.Router();
const pool = require("../db");
const { requireAuth, requireRole } = require("../middlewares/authMiddleware");

const toNum = (v) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const toInt = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

const toStr = (v) => String(v ?? "").trim();

router.get("/settlements", requireAuth, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT *
       FROM public.settlements
       ORDER BY id DESC`
    );
    return res.json(r.rows);
  } catch (e) {
    console.error("GET /api/settlements ERROR:", e.message);
    return res.status(500).json({ message: "Server error" });
  }
});

router.post(
  "/settlements",
  requireAuth,
  requireRole(["admin", "branch manager"]),
  async (req, res) => {
    try {
      const staff_id = toInt(req.body?.staff_id);
      const employee_id = toInt(req.body?.employee_id);
      const employee_name = toStr(req.body?.employee_name);
      const prev_branch = toStr(req.body?.prev_branch);

      if (!staff_id) return res.status(400).json({ message: "staff_id is required" });
      if (!employee_id) return res.status(400).json({ message: "employee_id is required" });
      if (!employee_name) return res.status(400).json({ message: "employee_name is required" });

      const s = await pool.query(
        `SELECT first_name, last_name, middle_name
         FROM public.staff
         WHERE id=$1`,
        [staff_id]
      );

      const first_name = s.rows[0]?.first_name ?? null;
      const last_name = s.rows[0]?.last_name ?? null;
      const middle_name = s.rows[0]?.middle_name ?? null;

      const cbu = toNum(req.body?.cbu);
      const cashbond = toNum(req.body?.cashbond);
      const utility = toNum(req.body?.utility);
      const thirteenth_month_pay = toNum(req.body?.thirteenth_month_pay);
      const last_pay = toNum(req.body?.last_pay);

      const separation_pay =
        req.body?.separation_pay === "" || req.body?.separation_pay == null
          ? null
          : toNum(req.body?.separation_pay);

      const cash_assistance =
        req.body?.cash_assistance === "" || req.body?.cash_assistance == null
          ? null
          : toNum(req.body?.cash_assistance);

      const liabilities = toNum(req.body?.liabilities);
      const total_benefits = toNum(req.body?.total_benefits);
      const net_settlement = toNum(req.body?.net_settlement);

      const r = await pool.query(
        `
        INSERT INTO public.settlements (
          staff_id,
          employee_id,
          employee_name,
          prev_branch,
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
          created_by,
          last_name,
          first_name,
          middle_name
        )
        VALUES (
          $1,$2,$3,$4,
          $5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,
          $16,$17,$18
        )
        RETURNING *;
        `,
        [
          staff_id,
          employee_id,
          employee_name,
          prev_branch || null,

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

          req.user?.id ?? null,

          last_name,
          first_name,
          middle_name,
        ]
      );

      return res.json(r.rows[0]);
    } catch (e) {
      console.error("POST /api/settlements ERROR:", e.message);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

router.delete(
  "/settlements/:id",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    try {
      const id = toInt(req.params.id);
      if (!id) return res.status(400).json({ message: "Invalid id" });

      const r = await pool.query(
        `DELETE FROM public.settlements WHERE id=$1 RETURNING id`,
        [id]
      );

      if (r.rowCount === 0) return res.status(404).json({ message: "Not found" });

      return res.json({ message: "Deleted", id: r.rows[0].id });
    } catch (e) {
      console.error("DELETE /api/settlements/:id ERROR:", e.message);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

module.exports = router;