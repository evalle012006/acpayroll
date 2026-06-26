console.log("LOADED travelPlanRoutes.js");

const express = require("express");
const router = express.Router();
const pool = require("../db");

const { requireAuth } = require("../middlewares/authMiddleware");

const {
  isAreaManager,
  isRegionalManager,
  isAssistantVicePresident,
  isVicePresident,
  isSeniorVicePresident,
} = require("../utils/roleAccess");

const toStr = (v) => String(v ?? "").trim();

const getUserArea = (req) => toStr(req.user?.area);
const getUserRegion = (req) => toStr(req.user?.region);
const getUserDivision = (req) => toStr(req.user?.division);

router.get("/travel-plans", requireAuth, async (_req, res) => {
  return res.json([]);
});

router.get("/travel-plans/staff-scope", async (req, res) => {
  return res.json([
    {
      id: 1,
      employee_no: "0001",
      employee_name: "TEST USER",
      position: "ADMIN",
      branch_name: "MAIN",
      area: "AREA 1",
      region: "REGION 1",
      division: "DIVISION 1",
    },
  ]);
});

module.exports = router;