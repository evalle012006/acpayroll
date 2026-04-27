const express = require("express");
const router = express.Router();
const pool = require("../db");
const { requireAuth } = require("../middlewares/authMiddleware");
const axios = require("axios");

const clean = (v) => String(v ?? "").trim();

const COURIER_CODE_MAP = {
  "J&T": "jtexpress-ph",
  "J&T Express": "jtexpress-ph",
  "J&T Express Philippines": "jtexpress-ph",
  LBC: "lbc-express",
  "Ninja Van": "ninjavan-ph",
  "Flash Express": "flashexpress-ph",
};

const normalizeCourierCode = (courierName) => {
  const name = clean(courierName);
  return COURIER_CODE_MAP[name] || name.toLowerCase().replace(/\s+/g, "");
};

async function detectCourierCode(apiKey, trackingNumber) {
  try {
    const res = await axios.post(
      "https://api.trackingmore.com/v4/couriers/detect",
      {
        tracking_number: trackingNumber,
      },
      {
        headers: {
          "Tracking-Api-Key": apiKey,
          "Content-Type": "application/json",
        },
        timeout: 20000,
      }
    );

    const list = Array.isArray(res.data?.data) ? res.data.data : [];
    const first = list[0];

    return (
      clean(first?.courier_code) ||
      clean(first?.code) ||
      clean(first?.slug) ||
      ""
    );
  } catch (err) {
    console.error("COURIER DETECT ERROR:", err?.response?.data || err.message);
    return "";
  }
}

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

router.post("/:id/sync-external", requireAuth, async (req, res) => {
  const client = await pool.connect();

  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid package id" });
    }

    const apiKey = process.env.TRACKINGMORE_API_KEY || process.env.TRACKING_API_KEY;

    if (!apiKey) {
      return res.status(400).json({
        message: "Tracking API key is missing. Add TRACKINGMORE_API_KEY to backend .env",
      });
    }

    const pkgRes = await client.query(
      `SELECT * FROM public.logistic_packages WHERE id = $1`,
      [id]
    );

    if (pkgRes.rows.length === 0) {
      return res.status(404).json({ message: "Package not found" });
    }

    const pkg = pkgRes.rows[0];

    if (clean(pkg.courier_name).toLowerCase() === "internal") {
      return res.status(400).json({
        message: "Internal packages do not support external sync. Use Update Status instead.",
      });
    }

    const trackingNumber = clean(pkg.external_tracking_no || pkg.tracking_no);
    let courierCode = normalizeCourierCode(pkg.courier_name);

      if (
        !courierCode ||
        clean(pkg.courier_name).toLowerCase() === "auto" ||
        clean(pkg.courier_name).toLowerCase() === "auto detect"
      ) {
        const detected = await detectCourierCode(apiKey, trackingNumber);

        if (detected) {
          courierCode = detected;
          console.log("AUTO DETECTED COURIER:", courierCode);
        }
      }

      if (!courierCode) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: "Unable to detect courier. Please select manually.",
        });
      }

    if (!trackingNumber) {
      return res.status(400).json({ message: "External tracking number is required" });
    }

    await client.query("BEGIN");

    let trackingData = null;

    try {
      const getRes = await axios.get(
        `https://api.trackingmore.com/v4/trackings/get`,
        {
          headers: {
            "Tracking-Api-Key": apiKey,
            "Content-Type": "application/json",
          },
          params: {
            tracking_number: trackingNumber,
            courier_code: courierCode,
          },
          timeout: 20000,
        }
      );

      trackingData = getRes.data?.data || null;
    } catch (getErr) {
      const statusCode = getErr?.response?.status;

      if (statusCode === 404 || statusCode === 400) {
        try {
          await axios.post(
            `https://api.trackingmore.com/v4/trackings/create`,
            {
              tracking_number: trackingNumber,
              courier_code: courierCode,
            },
            {
              headers: {
                "Tracking-Api-Key": apiKey,
                "Content-Type": "application/json",
              },
              timeout: 20000,
            }
          );
        } catch (createErr) {
          const alreadyExists =
            createErr?.response?.data?.meta?.message ||
            createErr?.response?.data?.message ||
            "";

          if (!String(alreadyExists).toLowerCase().includes("exist")) {
            throw createErr;
          }
        }

        const retryRes = await axios.get(
          `https://api.trackingmore.com/v4/trackings/get`,
          {
            headers: {
              "Tracking-Api-Key": apiKey,
              "Content-Type": "application/json",
            },
            params: {
              tracking_number: trackingNumber,
              courier_code: courierCode,
            },
            timeout: 20000,
          }
        );

        trackingData = retryRes.data?.data || null;
      } else {
        throw getErr;
      }
    }

    if (!trackingData) {
      await client.query("ROLLBACK");
      return res.json({ message: "No tracking data found yet", package: pkg });
    }

    const originInfo = trackingData.origin_info || {};
    const trackInfo = Array.isArray(originInfo.trackinfo)
      ? originInfo.trackinfo
      : Array.isArray(trackingData.tracking_details)
        ? trackingData.tracking_details
        : [];

    const events = trackInfo.map((ev) => ({
      location: clean(ev.location || ev.checkpoint_location || ""),
      status: clean(ev.status || ev.checkpoint_status || trackingData.delivery_status || ""),
      remarks: clean(ev.description || ev.message || ev.checkpoint_status || ""),
      time: ev.time || ev.checkpoint_time || ev.datetime || null,
    }));

    for (const ev of events) {
      const eventTime = ev.time ? new Date(ev.time) : new Date();
      const validTime = Number.isNaN(eventTime.getTime()) ? new Date() : eventTime;

      await client.query(
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
        SELECT $1,$2,$3,$4,$5,$6
        WHERE NOT EXISTS (
          SELECT 1
          FROM public.logistic_tracking_history
          WHERE package_id = $1
            AND COALESCE(location, '') = COALESCE($2, '')
            AND COALESCE(status, '') = COALESCE($3, '')
            AND COALESCE(remarks, '') = COALESCE($4, '')
            AND created_at = $6
        )
        `,
        [
          id,
          ev.location || null,
          ev.status || null,
          ev.remarks || null,
          "External API",
          validTime,
        ]
      );
    }

    const latest = events.length > 0 ? events[0] : null;

    const latestStatus =
      clean(latest?.status) ||
      clean(trackingData.delivery_status) ||
      clean(trackingData.status) ||
      pkg.current_status ||
      "Pending";

    const latestLocation =
      clean(latest?.location) ||
      clean(trackingData.destination_info?.location) ||
      pkg.current_location ||
      null;

    const latestRemarks =
      clean(latest?.remarks) ||
      clean(trackingData.substatus) ||
      clean(trackingData.delivery_status) ||
      pkg.remarks ||
      null;

    const updatedPkg = await client.query(
      `
      UPDATE public.logistic_packages
      SET
        current_location = $1,
        current_status = $2,
        remarks = $3,
        sync_source = 'external',
        updated_at = NOW()
      WHERE id = $4
      RETURNING *
      `,
      [latestLocation || null, latestStatus || null, latestRemarks || null, id]
    );

    await client.query("COMMIT");

    return res.json({
      message: "External tracking synced successfully",
      package: updatedPkg.rows[0],
      events_added: events.length,
    });
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {}

    console.error(
      "POST /api/logistic/:id/sync-external ERROR:",
      e?.response?.data || e.message
    );

    return res.status(500).json({
      message:
        e?.response?.data?.meta?.message ||
        e?.response?.data?.message ||
        e?.message ||
        "Error syncing external tracking",
    });
  } finally {
    client.release();
  }
});

module.exports = router;