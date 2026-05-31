const express = require("express");
const router = express.Router();
const pool = require("../db");
const { requireAuth } = require("../middlewares/authMiddleware");

const {
  uploadToTemp,
  moveFromTemp,
  deleteKey,
  getSignedDownloadUrl,
} = require("../services/spacesUpload");

const toStr = (v) => String(v ?? "").trim();
const norm = (v) => toStr(v).toLowerCase();

const DEPARTMENT_GROUPS = [
  { title: "Admin", department: "ADMIN", roleOnly: "admin" },
  { title: "IT Department", department: "IT DEPARTMENT" },
  { title: "Accounting Department", department: "ACCOUNTING DEPARTMENT" },
  { title: "Operation Department", department: "OPERATION DEPARTMENT" },
  { title: "Tread Department", department: "TREAD DEPARTMENT" },
  { title: "Audit Department", department: "AUDIT DEPARTMENT" },
  { title: "HR Department", department: "HR DEPARTMENT" },
  { title: "Production & Logistic Department", department: "PRODUCTION & LOGISTIC DEPARTMENT" },
  { title: "Office of the President", department: "OFFICE OF THE PRESIDENT" },
];

const fullNameSql = `
  TRIM(
    CONCAT(
      COALESCE(first_name, ''),
      CASE WHEN COALESCE(middle_name, '') <> '' THEN ' ' || middle_name ELSE '' END,
      CASE WHEN COALESCE(last_name, '') <> '' THEN ' ' || last_name ELSE '' END
    )
  )
`;

const userFullNameSql = `
  TRIM(
    CONCAT(
      COALESCE(u.first_name, ''),
      CASE WHEN COALESCE(u.middle_name, '') <> '' THEN ' ' || u.middle_name ELSE '' END,
      CASE WHEN COALESCE(u.last_name, '') <> '' THEN ' ' || u.last_name ELSE '' END
    )
  )
`;

const isAdminLike = (user) => {
  const role = norm(user?.role);
  const dept = norm(user?.department);

  return (
    role === "admin" ||
    role === "it" ||
    dept === "it department" ||
    dept === "hr department" ||
    dept === "accounting department" ||
    role === "president" ||
    role === "senior vice president"
  );
};

const canSeeUser = (viewer, target) => {
  if (!viewer || !target) return false;
  if (Number(viewer.id) === Number(target.id)) return false;

  const role = norm(viewer.role);

  if (isAdminLike(viewer)) return true;
  if (role === "vice president") return true;

  if (role === "assistant vice president") {
    return (
      (!!viewer.division && norm(viewer.division) === norm(target.division)) ||
      (!!viewer.department && norm(viewer.department) === norm(target.department))
    );
  }

  if (role === "regional manager") {
    return !!viewer.region && norm(viewer.region) === norm(target.region);
  }

  if (role === "area manager") {
    return !!viewer.area && norm(viewer.area) === norm(target.area);
  }

  if (role === "branch manager") {
    return (
      viewer.branch_id !== null &&
      viewer.branch_id !== undefined &&
      String(viewer.branch_id) === String(target.branch_id)
    );
  }

  return false;
};

const userBelongsToGroup = (user, group) => {
  if (!user || !group) return false;

  if (group.roleOnly === "admin") {
    return norm(user.role) === "admin";
  }

  return norm(user.department) === norm(group.department);
};

async function getUserById(client, id) {
  const r = await client.query(
    `
    SELECT
      id, username, role, branch_id, area, region, division, department,
      first_name, middle_name, last_name,
      ${fullNameSql} AS full_name
    FROM public.users
    WHERE id = $1
    LIMIT 1
    `,
    [id]
  );

  return r.rows[0] || null;
}

async function requireParticipant(client, conversationId, userId) {
  const r = await client.query(
    `
    SELECT 1
    FROM public.chat_participants
    WHERE conversation_id = $1
      AND user_id = $2
    LIMIT 1
    `,
    [conversationId, userId]
  );

  return r.rowCount > 0;
}

async function seedDepartmentGroups(client) {
  for (const g of DEPARTMENT_GROUPS) {
    await client.query(
      `
      INSERT INTO public.chat_conversations
        (title, is_group, group_name, department, created_by)
      SELECT
        CAST($1 AS VARCHAR(255)),
        true,
        CAST($1 AS VARCHAR(255)),
        CAST($2 AS VARCHAR(255)),
        NULL
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.chat_conversations
        WHERE COALESCE(is_group,false)=true
          AND UPPER(TRIM(COALESCE(department,'')))
              = UPPER(TRIM(CAST($2 AS VARCHAR(255))))
      )
      `,
      [g.title, g.department]
    );
  }
}

async function syncGroupMembers(client) {
  await seedDepartmentGroups(client);

  const users = await client.query(`
    SELECT id, username, role, department
    FROM public.users
  `);

  const groups = await client.query(`
    SELECT id, title, department
    FROM public.chat_conversations
    WHERE COALESCE(is_group, false) = true
  `);

  for (const u of users.rows) {
    for (const g of DEPARTMENT_GROUPS) {
      if (!userBelongsToGroup(u, g)) continue;

      const conv = groups.rows.find(
        (x) => norm(x.department) === norm(g.department)
      );

      if (!conv) continue;

      await client.query(
        `
        INSERT INTO public.chat_participants
          (conversation_id, user_id)
        VALUES
          ($1, $2)
        ON CONFLICT DO NOTHING
        `,
        [conv.id, u.id]
      );
    }
  }
}

router.post("/groups/sync", requireAuth, async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await syncGroupMembers(client);
    await client.query("COMMIT");

    return res.json({ message: "Department groups synced" });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("POST /api/chat/groups/sync ERROR:", e);
    return res.status(500).json({ message: "Failed to sync groups" });
  } finally {
    client.release();
  }
});

router.get("/contacts", requireAuth, async (req, res) => {
  try {
    const r = await pool.query(
      `
      SELECT
        id, username, role, branch_id, area, region, division, department,
        first_name, middle_name, last_name,
        ${fullNameSql} AS full_name
      FROM public.users
      WHERE id <> $1
      ORDER BY first_name NULLS LAST, last_name NULLS LAST, username ASC
      `,
      [req.user.id]
    );

    return res.json(r.rows.filter((u) => canSeeUser(req.user, u)));
  } catch (e) {
    console.error("GET /api/chat/contacts ERROR:", e);
    return res.status(500).json({ message: "Failed to load chat contacts" });
  }
});

router.get("/unread-count", requireAuth, async (req, res) => {
  try {
    const r = await pool.query(
      `
      SELECT COUNT(*)::int AS unread_count
      FROM public.chat_messages m
      INNER JOIN public.chat_participants cp
        ON cp.conversation_id = m.conversation_id
       AND cp.user_id = $1
      WHERE m.sender_id <> $1
        AND COALESCE(m.is_read, false) = false
      `,
      [req.user.id]
    );

    return res.json({ unread_count: r.rows[0]?.unread_count || 0 });
  } catch (e) {
    console.error("GET /api/chat/unread-count ERROR:", e);
    return res.status(500).json({ message: "Failed to load unread count" });
  }
});

router.get("/conversations", requireAuth, async (req, res) => {
  const client = await pool.connect();

  try {
    await syncGroupMembers(client);

    const r = await client.query(
      `
      SELECT
        c.id,
        c.title,
        COALESCE(c.is_group, false) AS is_group,
        c.group_name,
        c.department,
        c.created_by,
        c.created_at,
        c.updated_at,

        other_user.id AS other_user_id,
        other_user.username AS other_username,
        other_user.role AS other_role,
        other_user.department AS other_department,
        TRIM(
          CONCAT(
            COALESCE(other_user.first_name, ''),
            CASE WHEN COALESCE(other_user.middle_name, '') <> '' THEN ' ' || other_user.middle_name ELSE '' END,
            CASE WHEN COALESCE(other_user.last_name, '') <> '' THEN ' ' || other_user.last_name ELSE '' END
          )
        ) AS other_full_name,

        last_msg.message AS last_message,
        last_msg.created_at AS last_message_at,

        COALESCE(unread.unread_count, 0) AS unread_count

      FROM public.chat_conversations c

      INNER JOIN public.chat_participants mep
        ON mep.conversation_id = c.id
       AND mep.user_id = $1

      LEFT JOIN public.chat_participants otherp
        ON otherp.conversation_id = c.id
       AND otherp.user_id <> $1
       AND COALESCE(c.is_group, false) = false

      LEFT JOIN public.users other_user
        ON other_user.id = otherp.user_id

      LEFT JOIN LATERAL (
        SELECT message, created_at
        FROM public.chat_messages
        WHERE conversation_id = c.id
        ORDER BY created_at DESC, id DESC
        LIMIT 1
      ) last_msg ON TRUE

      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS unread_count
        FROM public.chat_messages
        WHERE conversation_id = c.id
          AND sender_id <> $1
          AND COALESCE(is_read, false) = false
      ) unread ON TRUE

      ORDER BY
        COALESCE(last_msg.created_at, c.updated_at, c.created_at) DESC,
        c.id DESC
      `,
      [req.user.id]
    );

    return res.json(r.rows);
  } catch (e) {
    console.error("GET /api/chat/conversations ERROR:", e);
    return res.status(500).json({ message: "Failed to load conversations" });
  } finally {
    client.release();
  }
});

router.post("/conversations/open", requireAuth, async (req, res) => {
  const client = await pool.connect();

  try {
    const otherUserId = Number(req.body?.user_id);

    if (!otherUserId || otherUserId === Number(req.user.id)) {
      return res.status(400).json({ message: "Invalid user" });
    }

    const otherUser = await getUserById(client, otherUserId);

    if (!otherUser) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!canSeeUser(req.user, otherUser)) {
      return res.status(403).json({
        message: "You are not allowed to chat with this user",
      });
    }

    await client.query("BEGIN");

    const existing = await client.query(
      `
      SELECT cp1.conversation_id
      FROM public.chat_participants cp1
      INNER JOIN public.chat_participants cp2
        ON cp2.conversation_id = cp1.conversation_id
      INNER JOIN public.chat_conversations c
        ON c.id = cp1.conversation_id
      WHERE cp1.user_id = $1
        AND cp2.user_id = $2
        AND COALESCE(c.is_group, false) = false
        AND (
          SELECT COUNT(*)
          FROM public.chat_participants cp3
          WHERE cp3.conversation_id = cp1.conversation_id
        ) = 2
      LIMIT 1
      `,
      [req.user.id, otherUserId]
    );

    let conversationId = existing.rows[0]?.conversation_id;

    if (!conversationId) {
      const conv = await client.query(
        `
        INSERT INTO public.chat_conversations
          (title, is_group, created_by)
        VALUES
          (NULL, false, $1)
        RETURNING id
        `,
        [req.user.id]
      );

      conversationId = conv.rows[0].id;

      await client.query(
        `
        INSERT INTO public.chat_participants
          (conversation_id, user_id)
        VALUES
          ($1, $2),
          ($1, $3)
        ON CONFLICT DO NOTHING
        `,
        [conversationId, req.user.id, otherUserId]
      );
    }

    await client.query("COMMIT");

    return res.json({
      id: conversationId,
      is_group: false,
      other_user_id: otherUser.id,
      other_username: otherUser.username,
      other_role: otherUser.role,
      other_department: otherUser.department,
      other_full_name: otherUser.full_name || otherUser.username,
    });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("POST /api/chat/conversations/open ERROR:", e);
    return res.status(500).json({ message: "Failed to open conversation" });
  } finally {
    client.release();
  }
});

router.get("/conversations/:id/messages", requireAuth, async (req, res) => {
  const client = await pool.connect();

  try {
    const conversationId = Number(req.params.id);

    if (!conversationId) {
      return res.status(400).json({ message: "Invalid conversation" });
    }

    const allowed = await requireParticipant(client, conversationId, req.user.id);

    if (!allowed) {
      return res.status(403).json({ message: "Access denied" });
    }

    await client.query(
      `
      UPDATE public.chat_messages
      SET is_read = true,
          read_at = NOW()
      WHERE conversation_id = $1
        AND sender_id <> $2
        AND COALESCE(is_read, false) = false
      `,
      [conversationId, req.user.id]
    );

    const r = await client.query(
      `
      SELECT
        m.id,
        m.conversation_id,
        m.sender_id,
        m.message,
        m.is_read,
        m.read_at,
        m.created_at,
        u.username AS sender_username,
        ${userFullNameSql} AS sender_full_name,

        COALESCE(
          json_agg(
            json_build_object(
              'id', ca.id,
              'file_name', ca.file_name,
              'original_name', ca.original_name,
              'mime_type', ca.mime_type,
              'created_at', ca.created_at
            )
            ORDER BY ca.id
          ) FILTER (WHERE ca.id IS NOT NULL),
          '[]'
        ) AS attachments

      FROM public.chat_messages m
      LEFT JOIN public.users u
        ON u.id = m.sender_id
      LEFT JOIN public.chat_attachments ca
        ON ca.message_id = m.id
      WHERE m.conversation_id = $1
      GROUP BY
        m.id,
        u.username,
        u.first_name,
        u.middle_name,
        u.last_name
      ORDER BY m.created_at ASC, m.id ASC
      `,
      [conversationId]
    );

    return res.json(r.rows);
  } catch (e) {
    console.error("GET /api/chat/conversations/:id/messages ERROR:", e);
    return res.status(500).json({ message: "Failed to load messages" });
  } finally {
    client.release();
  }
});

router.post(
  "/conversations/:id/messages",
  requireAuth,
  uploadToTemp,
  async (req, res) => {
    const client = await pool.connect();

    try {
      const conversationId = Number(req.params.id);
      const message = toStr(req.body?.message);

      if (!conversationId) {
        if (req.file?.key) await deleteKey(req.file.key).catch(() => {});
        return res.status(400).json({ message: "Invalid conversation" });
      }

      if (!message && !req.file?.key) {
        return res.status(400).json({
          message: "Message or file is required",
        });
      }

      const allowed = await requireParticipant(client, conversationId, req.user.id);

      if (!allowed) {
        if (req.file?.key) await deleteKey(req.file.key).catch(() => {});
        return res.status(403).json({ message: "Access denied" });
      }

      await client.query("BEGIN");

      const msg = await client.query(
        `
        INSERT INTO public.chat_messages
          (conversation_id, sender_id, message, is_read)
        VALUES
          ($1, $2, $3, false)
        RETURNING *
        `,
        [conversationId, req.user.id, message || ""]
      );

      const newMessage = msg.rows[0];

      if (req.file?.key) {
        const finalKey = await moveFromTemp(
          req.file.key,
          "chat-attachments",
          String(conversationId),
          req.file.originalname || "chat-file"
        );

        await client.query(
          `
          INSERT INTO public.chat_attachments
            (
              message_id,
              file_name,
              original_name,
              file_key,
              mime_type,
              uploaded_by
            )
          VALUES
            ($1, $2, $3, $4, $5, $6)
          `,
          [
            newMessage.id,
            toStr(req.body?.file_name) || req.file.originalname,
            req.file.originalname,
            finalKey,
            req.file.mimetype,
            req.user.id,
          ]
        );
      }

      await client.query(
        `
        UPDATE public.chat_conversations
        SET updated_at = NOW()
        WHERE id = $1
        `,
        [conversationId]
      );

      await client.query("COMMIT");

      return res.json(newMessage);
    } catch (e) {
      await client.query("ROLLBACK");

      if (req.file?.key) {
        await deleteKey(req.file.key).catch(() => {});
      }

      console.error("POST /api/chat/conversations/:id/messages ERROR:", e);

      return res.status(500).json({
        message: e?.message || "Failed to send message",
      });
    } finally {
      client.release();
    }
  }
);

router.get("/attachments/:id/download", requireAuth, async (req, res) => {
  const client = await pool.connect();

  try {
    const id = Number(req.params.id);

    if (!id) {
      return res.status(400).json({
        message: "Invalid attachment id",
      });
    }

    const r = await client.query(
      `
      SELECT
        ca.*,
        m.conversation_id
      FROM public.chat_attachments ca
      INNER JOIN public.chat_messages m
        ON m.id = ca.message_id
      WHERE ca.id = $1
      LIMIT 1
      `,
      [id]
    );

    if (!r.rowCount) {
      return res.status(404).json({
        message: "Attachment not found",
      });
    }

    const row = r.rows[0];

    const allowed = await requireParticipant(
      client,
      row.conversation_id,
      req.user.id
    );

    if (!allowed) {
      return res.status(403).json({
        message: "Access denied",
      });
    }

    const url = await getSignedDownloadUrl(row.file_key, 3600);

    return res.json({
      url,
      file_name: row.file_name || row.original_name,
      mime_type: row.mime_type,
    });
  } catch (e) {
    console.error("GET /api/chat/attachments/:id/download ERROR:", e);
    return res.status(500).json({
      message: e?.message || "Failed to download attachment",
    });
  } finally {
    client.release();
  }
});

module.exports = router;