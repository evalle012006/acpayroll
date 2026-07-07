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

const isManagerToSVP = (role) =>
  [
    "branch manager",
    "area manager",
    "regional manager",
    "assistant vice president",
    "vice president",
    "senior vice president",
  ].includes(role);

const canViewAllTravelScope = (role, dept) =>
  role === "admin" ||
  role === "it" ||
  (
    dept.includes("tread") &&
    isManagerToSVP(role)
  );

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

  employee_name,
  position,

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

    const employee_name = toStr(req.body.employee_name);
    const position = toStr(req.body.position);

    const branch_name = toStr(req.body.branch_name);
    const description = toStr(req.body.description);

    if (!title || !plan_date) {
      return res.status(400).json({ message: "Title and date are required" });
    }

    const r = await pool.query(
      `
      INSERT INTO public.travel_plans
        (
        title,
        plan_date,
        employee_name,
        position,
        branch_name,
        description,
        created_by,
        created_at,
        updated_at
        )
      VALUES
        (
        $1,
        $2::date,
        $3,
        $4,
        $5,
        $6,
        $7,
        NOW(),
        NOW()
        )
      RETURNING ${travelPlanSelect}
      `,
      [
        title,
        plan_date,
        employee_name || null,
        position || null,
        branch_name || null,
        description || null,
        req.user?.id || null,
        ]
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

router.get("/travel-plans/staff-scope", requireAuth, async (req, res) => {
  try {
    const role = norm(req.user?.role);
    const dept = norm(req.user?.department);

    if (
      !canViewAllTravelScope(role, dept) &&
      !dept.includes("operation")
    ) {
      return res.json([]);
    }

    const baseSelect = `
      SELECT
        s.id,
        s.employee_no,
        s.fullname AS employee_name,
        s.position,
        b.name AS branch_name,
        b.code AS branch_code,
        s.area,
        s.region,
        s.division,
        s.department,
          CASE
          WHEN EXISTS (
              SELECT 1
              FROM travel_plans tp
              WHERE tp.employee_name = s.fullname
                AND tp.plan_date = CURRENT_DATE
          )
          THEN 'Submitted'
          ELSE 'Pending'
          END AS travel_status

      FROM public.staff s
      LEFT JOIN public.branches b ON b.id = s.branch_id
      WHERE LOWER(COALESCE(s.status, 'active')) = 'active'
    `;

    let sql = "";
    let params = [];

    if (canViewAllTravelScope(role, dept)) {
      sql = `
        ${baseSelect}
        AND LOWER(TRIM(COALESCE(s.department,''))) = 'operation department'
        AND LOWER(TRIM(COALESCE(s.position,''))) IN (
          'area manager',
          'acting area manager',
          'regional manager',
          'acting regional manager',
          'assistant vice president',
          'vice president',
          'senior vice president'
        )
        ORDER BY
          CASE LOWER(TRIM(COALESCE(s.position,'')))
            WHEN 'senior vice president' THEN 1
            WHEN 'vice president' THEN 2
            WHEN 'assistant vice president' THEN 3
            WHEN 'regional manager' THEN 4
            WHEN 'acting regional manager' THEN 5
            WHEN 'area manager' THEN 6
            WHEN 'acting area manager' THEN 7
            ELSE 99
          END,
          s.fullname ASC
      `;
    }

    else if (role === "area manager" || role === "acting area manager") {
      sql = `
        ${baseSelect}
        AND LOWER(TRIM(COALESCE(s.area,''))) = LOWER(TRIM($1))
        ORDER BY b.name ASC, s.fullname ASC
      `;
      params = [req.user?.area || ""];
    }

    else if (role === "regional manager" || role === "acting regional manager") {
      sql = `
        ${baseSelect}
        AND LOWER(TRIM(COALESCE(s.region,''))) = LOWER(TRIM($1))
        AND LOWER(TRIM(COALESCE(s.position,''))) IN (
          'area manager',
          'acting area manager'
        )
        ORDER BY s.area ASC, s.fullname ASC
      `;
      params = [req.user?.region || ""];
    }

    else if (role === "assistant vice president") {
      sql = `
        ${baseSelect}
        AND LOWER(TRIM(COALESCE(s.division,''))) = LOWER(TRIM($1))
        AND LOWER(TRIM(COALESCE(s.position,''))) IN (
          'regional manager',
          'acting regional manager',
          'area manager',
          'acting area manager'
        )
        ORDER BY
          CASE LOWER(COALESCE(s.position,''))
            WHEN 'regional manager' THEN 1
            WHEN 'acting regional manager' THEN 2
            WHEN 'area manager' THEN 3
            WHEN 'acting area manager' THEN 4
            ELSE 99
          END,
          s.fullname ASC
      `;
      params = [req.user?.division || ""];
    }

    else if (role === "vice president") {
      sql = `
        ${baseSelect}
        AND LOWER(TRIM(COALESCE(s.department,''))) = 'operation department'
        AND LOWER(TRIM(COALESCE(s.position,''))) IN (
          'assistant vice president',
          'regional manager',
          'acting regional manager',
          'area manager',
          'acting area manager'
        )
        ORDER BY
          CASE LOWER(COALESCE(s.position,''))
            WHEN 'assistant vice president' THEN 1
            WHEN 'regional manager' THEN 2
            WHEN 'acting regional manager' THEN 3
            WHEN 'area manager' THEN 4
            WHEN 'acting area manager' THEN 5
            ELSE 99
          END,
          s.fullname ASC
      `;
    }

    else if (
      canViewAllTravelScope(role, dept) ||
      role === "senior vice president"
    ) {
      sql = `
        ${baseSelect}
        AND LOWER(TRIM(COALESCE(s.department,''))) = 'operation department'
        AND LOWER(TRIM(COALESCE(s.position,''))) IN (
          'area manager',
          'acting area manager',
          'regional manager',
          'acting regional manager',
          'assistant vice president',
          'vice president',
          'senior vice president'
        )
        ORDER BY
          CASE LOWER(TRIM(COALESCE(s.position,'')))
            WHEN 'senior vice president' THEN 1
            WHEN 'vice president' THEN 2
            WHEN 'assistant vice president' THEN 3
            WHEN 'regional manager' THEN 4
            WHEN 'acting regional manager' THEN 5
            WHEN 'area manager' THEN 6
            WHEN 'acting area manager' THEN 7
            ELSE 99
          END,
          s.fullname ASC
      `;
    }

    else {
      return res.json([]);
    }

    const r = await pool.query(sql, params);
    return res.json(r.rows);
  } catch (err) {
    console.error("GET /travel-plans/staff-scope ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

router.get("/travel-plans/branch-scope", requireAuth, async (req, res) => {
  try {
    const role = norm(req.user?.role);
    const dept = norm(req.user?.department);

    if (
      !canViewAllTravelScope(role, dept) &&
      !dept.includes("operation")
    ) {
      return res.json([]);
    }

    let sql = "";
    let params = [];

    const baseSelect = `
      SELECT DISTINCT
        b.id,
        b.code AS branch_code,
        b.name AS branch_name,
        b.area,
        b.region,
        b.division
      FROM public.branches b
      WHERE b.name IS NOT NULL
    `;

    if (canViewAllTravelScope(role, dept)) {
      sql = `
        ${baseSelect}
        ORDER BY b.division ASC, b.region ASC, b.area ASC, b.name ASC
      `;
    }

    else if (role === "area manager" || role === "acting area manager") {
      sql = `
        ${baseSelect}
        AND LOWER(TRIM(COALESCE(b.area,''))) = LOWER(TRIM($1))
        ORDER BY b.name ASC
      `;
      params = [req.user?.area || ""];
    }

    else if (role === "regional manager" || role === "acting regional manager") {
      sql = `
        ${baseSelect}
        AND LOWER(TRIM(COALESCE(b.region,''))) = LOWER(TRIM($1))
        ORDER BY b.area ASC, b.name ASC
      `;
      params = [req.user?.region || ""];
    }

    else if (role === "assistant vice president") {
      sql = `
        ${baseSelect}
        AND LOWER(TRIM(COALESCE(b.division,''))) = LOWER(TRIM($1))
        ORDER BY b.region ASC, b.area ASC, b.name ASC
      `;
      params = [req.user?.division || ""];
    }

    else if (
      role === "vice president" ||  
      role === "senior vice president"
    ) {
      sql = `
        ${baseSelect}
        ORDER BY b.division ASC, b.region ASC, b.area ASC, b.name ASC
      `;
    }

    else {
      return res.json([]);
    }

    console.log("=================================");
    console.log("ROLE:", req.user.role);
    console.log("AREA:", req.user.area);
    console.log("REGION:", req.user.region);
    console.log("DIVISION:", req.user.division);
    console.log("PARAMS:", params);
    console.log("=================================");

    const r = await pool.query(sql, params);
    return res.json(r.rows);
  } catch (err) {
    console.error("GET /travel-plans/branch-scope ERROR:", err);
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

router.post("/calendar-activities", requireAuth, async (req, res) => {
  try {
    const title = toStr(req.body.title);
    const date_from = toStr(req.body.date_from);
    const date_to = toStr(req.body.date_to);
    const days = req.body.days ? Number(req.body.days) : null;
    const subject = toStr(req.body.subject);
    const venue = toStr(req.body.venue);
    const description = toStr(req.body.description);

    if (!title || !date_from || !date_to) {
      return res.status(400).json({
        message: "Title, Date From, and Date To are required.",
      });
    }

    const r = await pool.query(
      `
      INSERT INTO public.calendar_activities
        (
          title,
          date_from,
          date_to,
          days,
          subject,
          venue,
          description,
          created_by,
          created_at,
          updated_at
        )
      VALUES
        ($1, $2::date, $3::date, $4, $5, $6, $7, $8, NOW(), NOW())
      RETURNING *
      `,
      [
        title,
        date_from,
        date_to,
        days,
        subject || null,
        venue || null,
        description || null,
        req.user?.id || null,
      ]
    );

    return res.json({
      message: "Activity created",
      activity: r.rows[0],
    });
  } catch (err) {
    console.error("POST /calendar-activities ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

router.get("/calendar-activities", requireAuth, async (_req, res) => {
  try {
    const r = await pool.query(`
      SELECT
        id,
        title,
        TO_CHAR(date_from, 'YYYY-MM-DD') AS date_from,
        TO_CHAR(date_to, 'YYYY-MM-DD') AS date_to,
        days,
        subject,
        venue,
        description,
        created_by,
        created_at,
        updated_at
      FROM public.calendar_activities
      ORDER BY date_from DESC, id DESC
    `);

    return res.json(r.rows);
  } catch (err) {
    console.error("GET /calendar-activities ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

router.get("/travel-plans/branch/:branch",
  requireAuth,
  async (req, res) => {
    try {
      const branch = req.params.branch;

      const r = await pool.query(
        `
        SELECT
          id,
          title,
          employee_name,
          position,
          branch_name,
          description,
          review,
          findings,
          status,
          TO_CHAR(plan_date,'YYYY-MM-DD') AS plan_date
        FROM public.travel_plans
        WHERE branch_name = $1
        ORDER BY plan_date DESC,id DESC
        `,
        [branch]
      );

      return res.json(r.rows);
    } catch (err) {
      console.error(err);
      return res.status(500).json({
        message: "Server error",
      });
    }
  }
);

module.exports = router;