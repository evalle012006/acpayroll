/**
 * lmsRoutes.js  ->  acpayroll/backend/routes/lmsRoutes.js
 * -------------------------------------------------------
 * Admin-only endpoints behind the "LMS seat" panel. The browser never sees the
 * LMS key: it calls these, and these call the LMS.
 *
 *   GET  /api/lms/staff/:id/seats        open seats for this staff member + the seat they hold
 *   POST /api/lms/staff/:id/assign-seat  { seat_id } -> assigns, returns the temp password ONCE
 *   POST /api/lms/sync-now               { dry_run?, allow_vacate? } -> run a sync immediately
 *
 * Position and branch are read from the SAVED staff row, never from the request,
 * so the browser cannot ask for a seat the staff member is not entitled to.
 */
const express = require("express");
const router = express.Router();
const pool = require("../db");
const { requireAuth, requireRole } = require("../middlewares/authMiddleware");
const { fetchSnapshots } = require("../services/lmsSnapshots");
const lms = require("../services/lmsClient");
const { runLmsSync } = require("../services/lmsSync");

router.use(requireAuth, requireRole(["admin"]));
router.use((_req, res, next) => {
  res.set("Cache-Control", "no-store"); // assign responses carry a one-time password
  next();
});

const toId = (v) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const actorOf = (req) =>
  String(req.user?.username || req.user?.email || req.user?.id || "hris-admin");

const lmsDown = (res, err) => {
  console.error("[lmsRoutes] LMS call failed:", err.message);
  return res.status(502).json({ message: "Could not reach the LMS. Try again in a moment." });
};

router.get("/staff/:id/seats", async (req, res) => {
  try {
    const id = toId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid staff id" });

    const [staff] = await fetchSnapshots(pool, { staffId: id });
    if (!staff) return res.status(404).json({ message: "Staff not found" });

    const summary = {
      id: staff.id,
      employee_no: staff.employee_no,
      position: staff.position,
      branch_code: staff.branch_code,
      status: staff.status,
    };

    if (!String(staff.employee_no || "").trim()) {
      return res.json({ staff: summary, needs_employee_no: true, seats: [], current: null });
    }

    const data = await lms.getSeats({
      position: staff.position,
      branch_code: staff.branch_code,
      employee_no: staff.employee_no,
    });
    return res.json({ staff: summary, ...data });
  } catch (err) {
    return lmsDown(res, err);
  }
});

router.post("/staff/:id/assign-seat", async (req, res) => {
  try {
    const id = toId(req.params.id);
    const seatId = String(req.body?.seat_id || "").trim();
    if (!id || !seatId) return res.status(400).json({ message: "staff id and seat_id are required" });

    const [staff] = await fetchSnapshots(pool, { staffId: id });
    if (!staff) return res.status(404).json({ message: "Staff not found" });

    const result = await lms.assignSeat({ seat_id: seatId, staff, actor: actorOf(req) });

    // business refusals (seat taken, wrong branch...) come back as success:false
    if (!result?.success) return res.status(409).json(result);
    return res.json(result);
  } catch (err) {
    return lmsDown(res, err);
  }
});

router.post("/sync-now", async (req, res) => {
  try {
    const dryRun = req.body?.dry_run !== false; // default to a DRY run from the API
    const allowVacate = req.body?.allow_vacate === true ? true : undefined; // undefined = use .env
    const result = await runLmsSync({ dryRun, allowVacate });
    return res.json(result);
  } catch (err) {
    return lmsDown(res, err);
  }
});

module.exports = router;
