const express = require("express");
const router = express.Router();
const pool = require("../db");
const { requireAuth } = require("../middlewares/authMiddleware");

const clean = (v) => String(v ?? "").trim();

router.get("/", requireAuth, async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT *
      FROM public.logistic_packages
      ORDER BY id DESC
    `);
    return res.json(result.rows);
  } catch (e) {
    console.error("GET /api/logistic ERROR:", e.message);
    return res.status(500).json({ message: "Error loading packages" });
  }
});

router.get("/:id/history", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid package id" });
    }

    const result = await pool.query(
      `
      SELECT *
      FROM public.logistic_tracking_history
      WHERE package_id = $1
      ORDER BY created_at DESC, id DESC
      `,
      [id]
    );

    return res.json(result.rows);
  } catch (e) {
    console.error("GET /api/logistic/:id/history ERROR:", e.message);
    return res.status(500).json({ message: "Error loading history" });
  }
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const tracking_no = clean(req.body?.tracking_no);
    const sender_name = clean(req.body?.sender_name);
    const receiver_name = clean(req.body?.receiver_name);
    const origin_branch = clean(req.body?.origin_branch);
    const destination_branch = clean(req.body?.destination_branch);
    const assigned_to = clean(req.body?.assigned_to);
    const remarks = clean(req.body?.remarks);
    const courier_name = clean(req.body?.courier_name) || "Internal";
    const external_tracking_no = clean(req.body?.external_tracking_no) || null;

    if (!tracking_no) {
      return res.status(400).json({ message: "tracking_no is required" });
    }

    const exists = await pool.query(
      `SELECT id FROM public.logistic_packages WHERE lower(trim(tracking_no)) = lower(trim($1))`,
      [tracking_no]
    );
    if (exists.rows.length > 0) {
      return res.status(409).json({ message: "Tracking number already exists" });
    }

    const result = await pool.query(
      `
      INSERT INTO public.logistic_packages
      (
        tracking_no,
        sender_name,
        receiver_name,
        origin_branch,
        destination_branch,
        current_location,
        current_status,
        assigned_to,
        remarks,
        courier_name,
        external_tracking_no,
        sync_source,
        created_at,
        updated_at
      )
      VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW(),NOW())
      RETURNING *
      `,
      [
        tracking_no,
        sender_name || null,
        receiver_name || null,
        origin_branch || null,
        destination_branch || null,
        origin_branch || null,
        "Pending",
        assigned_to || null,
        remarks || null,
        courier_name,
        external_tracking_no,
        courier_name === "Internal" ? "manual" : "external",
      ]
    );

    const pkg = result.rows[0];

    await pool.query(
      `
      INSERT INTO public.logistic_tracking_history
      (
        package_id,
        location,
        status,
        remarks,
        updated_by,
        created_at
      )
      VALUES ($1,$2,$3,$4,$5,NOW())
      `,
      [
        pkg.id,
        origin_branch || null,
        "Pending",
        remarks || "Package created",
        "System",
      ]
    );

    return res.json({ message: "Package created", package: pkg });
  } catch (e) {
    console.error("POST /api/logistic ERROR:", e.message);
    return res.status(500).json({ message: "Error creating package" });
  }
});

router.post("/:id/update-status", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid package id" });
    }

    const location = clean(req.body?.location);
    const status = clean(req.body?.status);
    const remarks = clean(req.body?.remarks);
    const updated_by = clean(req.body?.updated_by) || "System";

    if (!status) {
      return res.status(400).json({ message: "status is required" });
    }

    const updated = await pool.query(
      `
      UPDATE public.logistic_packages
      SET
        current_location = $1,
        current_status = $2,
        remarks = $3,
        updated_at = NOW()
      WHERE id = $4
      RETURNING *
      `,
      [location || null, status, remarks || null, id]
    );

    if (updated.rows.length === 0) {
      return res.status(404).json({ message: "Package not found" });
    }

    await pool.query(
      `
      INSERT INTO public.logistic_tracking_history
      (
        package_id,
        location,
        status,
        remarks,
        updated_by,
        created_at
      )
      VALUES ($1,$2,$3,$4,$5,NOW())
      `,
      [id, location || null, status, remarks || null, updated_by]
    );

    return res.json({
      message: "Tracking updated",
      package: updated.rows[0],
    });
  } catch (e) {
    console.error("POST /api/logistic/:id/update-status ERROR:", e.message);
    return res.status(500).json({ message: "Error updating status" });
  }
});

/**
 * Future external sync endpoint
 * This is where you can later connect J&T partner API,
 * AfterShip, TrackingMore, 17TRACK, etc.
 */
router.post("/:id/sync-external", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid package id" });
    }

    const pkgRes = await pool.query(
      `SELECT * FROM public.logistic_packages WHERE id = $1`,
      [id]
    );

    if (pkgRes.rows.length === 0) {
      return res.status(404).json({ message: "Package not found" });
    }

    const pkg = pkgRes.rows[0];

    // Placeholder for future integration
    // Example:
    // 1. call external API using pkg.external_tracking_no || pkg.tracking_no
    // 2. map returned events
    // 3. insert new events into logistic_tracking_history
    // 4. update logistic_packages current status/location

    return res.json({
      message: "External sync is ready for integration",
      package: pkg,
    });
  } catch (e) {
    console.error("POST /api/logistic/:id/sync-external ERROR:", e.message);
    return res.status(500).json({ message: "Error syncing external tracking" });
  }
});

module.exports = router;