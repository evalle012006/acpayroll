console.log("LOADED calendarRoutes.js");

const express = require("express");
const router = express.Router();
const pool = require("../db");
const { requireAuth } = require("../middlewares/authMiddleware");

const {
  uploadPhotosToTemp,
  moveFromTempKeepExisting,
  getSignedDownloadUrl,
  deleteKey,
} = require("../services/spacesUpload");

const toStr = (v) => String(v ?? "").trim();
const norm = (v) => String(v ?? "").trim().toLowerCase();

const canCreatePlan = (req) => {
  const role = norm(req.user?.role);
  const dept = norm(req.user?.department);

  if (role === "admin" || role === "it") return true;

  return (
    dept.includes("operation") &&
    [
      "area manager",
      "regional manager",
      "assistant vice president",
      "vice president",
      "senior vice president",
    ].includes(role)
  );
};

const travelPlanSelect = `
  id,
  title,
  TO_CHAR(plan_date, 'YYYY-MM-DD') AS plan_date,
  branch_name,
  description,
  review,
  findings,
  photo_url,
  photo_uploaded_at,
  photo_latitude,
  photo_longitude,
  check_in_photo_url,
  check_in_at,
  check_in_latitude,
  check_in_longitude,
  check_out_photo_url,
  check_out_at,
  check_out_latitude,
  check_out_longitude,
  created_by,
  created_at,
  status,
  submitted_at,
  submitted_by,
  updated_at
`;

router.get("/travel-plans", requireAuth, async (_req, res) => {
  try {
    const r = await pool.query(`
      SELECT ${travelPlanSelect}
      FROM public.travel_plans
      ORDER BY plan_date DESC, id DESC
    `);

    return res.json(r.rows);
  } catch (err) {
    console.error("GET /travel-plans ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

router.post("/travel-plans", requireAuth, async (req, res) => {
  try {
    if (!canCreatePlan(req)) {
      return res.status(403).json({
        message: "Only Operation Department Area Manager and above can create plan.",
      });
    }

    const title = toStr(req.body.title);
    const plan_date = toStr(req.body.plan_date);
    const branch_name = toStr(req.body.branch_name);
    const description = toStr(req.body.description);

    if (!title || !plan_date) {
      return res.status(400).json({ message: "Title and date are required" });
    }

    const r = await pool.query(
      `
      INSERT INTO public.travel_plans
        (title, plan_date, branch_name, description, created_by, created_at, updated_at)
      VALUES
        ($1, $2::date, $3, $4, $5, NOW(), NOW())
      RETURNING ${travelPlanSelect}
      `,
      [title, plan_date, branch_name || null, description || null, req.user?.id || null]
    );

    return res.json({ message: "Travel plan created", plan: r.rows[0] });
  } catch (err) {
    console.error("POST /travel-plans ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

router.get("/travel-plans/:id/notes", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isFinite(id)) {
      return res.status(400).json({ message: "Invalid plan id" });
    }

    const r = await pool.query(
      `
      SELECT *
      FROM public.travel_plan_notes
      WHERE travel_plan_id = $1
      ORDER BY created_at DESC, id DESC
      `,
      [id]
    );

    return res.json(r.rows);
  } catch (err) {
    console.error("GET /travel-plans/:id/notes ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

router.post("/travel-plans/:id/notes", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isFinite(id)) {
      return res.status(400).json({ message: "Invalid plan id" });
    }

    const note_type = toStr(req.body.note_type).toUpperCase();
    const title = toStr(req.body.title);
    const involved_staff = toStr(req.body.involved_staff);
    const content = toStr(req.body.content);

    if (!["REVIEW", "FINDINGS"].includes(note_type)) {
      return res.status(400).json({ message: "Invalid note type" });
    }

    if (!title) {
      return res.status(400).json({ message: "Title is required" });
    }

    const r = await pool.query(
      `
      INSERT INTO public.travel_plan_notes
        (travel_plan_id, note_type, title, involved_staff, content, created_by, created_at)
      VALUES
        ($1, $2, $3, $4, $5, $6, NOW() AT TIME ZONE 'Asia/Manila')
      RETURNING *
      `,
      [
        id,
        note_type,
        title,
        involved_staff || null,
        content || null,
        req.user?.id || null,
      ]
    );

    return res.json({ message: "Note created", note: r.rows[0] });
  } catch (err) {
    console.error("POST /travel-plans/:id/notes ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

router.delete("/travel-plans/notes/:noteId", requireAuth, async (req, res) => {
  try {
    const noteId = Number(req.params.noteId);

    if (!Number.isFinite(noteId)) {
      return res.status(400).json({ message: "Invalid note id" });
    }

    const r = await pool.query(
      `DELETE FROM public.travel_plan_notes WHERE id = $1 RETURNING *`,
      [noteId]
    );

    if (!r.rowCount) {
      return res.status(404).json({ message: "Note not found" });
    }

    return res.json({ message: "Note deleted" });
  } catch (err) {
    console.error("DELETE /travel-plans/notes/:noteId ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

router.post(
  "/travel-plans/:id/photos",
  requireAuth,
  uploadPhotosToTemp,
  async (req, res) => {
    try {
      const id = Number(req.params.id);

      if (!Number.isFinite(id)) {
        return res.status(400).json({ message: "Invalid plan id" });
      }

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: "At least one photo is required" });
      }

      const photoType = toStr(req.body.type || "GENERAL").toUpperCase();
      const latitude = req.body.latitude ? Number(req.body.latitude) : null;
      const longitude = req.body.longitude ? Number(req.body.longitude) : null;

      const inserted = [];

      for (const file of req.files) {
        const photoKey = await moveFromTempKeepExisting(
          file.key,
          "travel-plans",
          String(id),
          file.originalname || "photo.jpg"
        );

        const r = await pool.query(
          `
          INSERT INTO public.travel_plan_photos
            (
              travel_plan_id,
              photo_type,
              photo_url,
              latitude,
              longitude,
              captured_at,
              uploaded_by,
              created_at
            )
          VALUES
            ($1, $2, $3, $4, $5, NOW() AT TIME ZONE 'Asia/Manila', $6, NOW())
          RETURNING *
          `,
          [id, photoType, photoKey, latitude, longitude, req.user?.id || null]
        );

        inserted.push(r.rows[0]);
      }

      return res.json({ message: "Photos uploaded", photos: inserted });
    } catch (err) {
      console.error("POST /travel-plans/:id/photos ERROR:", err);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

router.get("/travel-plans/:id/photos", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isFinite(id)) {
      return res.status(400).json({ message: "Invalid plan id" });
    }

    const r = await pool.query(
      `
      SELECT *
      FROM public.travel_plan_photos
      WHERE travel_plan_id = $1
      ORDER BY created_at DESC, id DESC
      `,
      [id]
    );

    const photos = await Promise.all(
      r.rows.map(async (photo) => ({
        ...photo,
        signed_url: photo.photo_url
          ? await getSignedDownloadUrl(photo.photo_url, 3600)
          : null,
      }))
    );

    return res.json(photos);
  } catch (err) {
    console.error("GET /travel-plans/:id/photos ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

router.delete("/travel-plans/photos/:photoId", requireAuth, async (req, res) => {
  try {
    const photoId = Number(req.params.photoId);

    if (!Number.isFinite(photoId)) {
      return res.status(400).json({ message: "Invalid photo id" });
    }

    const found = await pool.query(
      `SELECT * FROM public.travel_plan_photos WHERE id = $1`,
      [photoId]
    );

    if (!found.rowCount) {
      return res.status(404).json({ message: "Photo not found" });
    }

    const photo = found.rows[0];

    await deleteKey(photo.photo_url);

    await pool.query(`DELETE FROM public.travel_plan_photos WHERE id = $1`, [
      photoId,
    ]);

    return res.json({ message: "Photo deleted" });
  } catch (err) {
    console.error("DELETE /travel-plans/photos/:photoId ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

router.get("/travel-plans/staff-scope", requireAuth, async (_req, res) => {
  try {
    const r = await pool.query(`
      SELECT
        s.id,
        s.employee_no,
        s.fullname AS employee_name,
        s.position,
        b.name AS branch_name,
        b.code AS branch_code,
        s.area,
        s.region,
        s.division
      FROM public.staff s
      LEFT JOIN public.branches b ON b.id = s.branch_id
      WHERE LOWER(COALESCE(s.status, 'active')) = 'active'
      ORDER BY
        b.name ASC,
        CASE LOWER(COALESCE(s.position, ''))
          WHEN 'branch manager' THEN 1
          WHEN 'acting branch manager' THEN 2
          WHEN 'loan officer' THEN 3
          WHEN 'probationary loan officer' THEN 4
          ELSE 99
        END,
        s.fullname ASC
    `);

    return res.json(r.rows);
  } catch (err) {
    console.error("GET /travel-plans/staff-scope ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

router.put("/travel-plans/:id/submit", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isFinite(id)) {
      return res.status(400).json({ message: "Invalid plan id" });
    }

    const r = await pool.query(
      `
      UPDATE public.travel_plans
      SET
        status = 'Completed',
        submitted_at = NOW() AT TIME ZONE 'Asia/Manila',
        submitted_by = $2,
        updated_at = NOW()
      WHERE id = $1
      RETURNING ${travelPlanSelect}
      `,
      [id, req.user?.id || null]
    );

    if (!r.rowCount) {
      return res.status(404).json({ message: "Plan not found" });
    }

    return res.json({
      message: "Travel plan submitted",
      plan: r.rows[0],
    });
  } catch (err) {
    console.error("PUT /travel-plans/:id/submit ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;