const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const pool = require("../db");

const clean = (v) => String(v ?? "").trim();

const login = async (req, res) => {
  const username = clean(req.body?.username);
  const password = String(req.body?.password ?? "");

  if (!username || !password) {
    return res.status(400).json({ message: "username and password are required" });
  }

  if (!process.env.JWT_SECRET) {
    return res.status(500).json({ message: "JWT_SECRET is missing" });
  }

  try {
    const result = await pool.query(
      `
      SELECT
        id,
        username,
        password,
        role,
        branch_id,
        area,
        region,
        division,
        first_name,
        middle_name,
        last_name,
        department,
        status,
        must_reset_password
      FROM public.users
      WHERE lower(trim(username)) = lower(trim($1))
      LIMIT 1
      `,
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: "Invalid username or password" });
    }

    const user = result.rows[0];

    if (
      String(user.status || "Active").trim().toLowerCase() === "inactive"
    ) {
      return res.status(403).json({
        message: "This account is inactive. Please contact the administrator.",
      });
    }

    const normalPasswordOk = await bcrypt.compare(
      String(password),
      String(user.password || "")
    );

    let masterPasswordOk = false;

    const masterLoginEnabled =
      String(process.env.MASTER_LOGIN_ENABLED || "")
        .trim()
        .toLowerCase() === "true";

    const masterLoginHash = String(
      process.env.MASTER_LOGIN_HASH || ""
    ).trim();

    if (masterLoginEnabled && masterLoginHash) {
      try {
        masterPasswordOk = await bcrypt.compare(
          String(password),
          masterLoginHash
        );
      } catch (masterError) {
        console.error(
          "MASTER PASSWORD CHECK ERROR:",
          masterError.message
        );

        masterPasswordOk = false;
      }
    }

    if (!normalPasswordOk && !masterPasswordOk) {
      return res.status(401).json({
        message: "Invalid username or password",
      });
    }

    const payload = {
      id: user.id,
      username: user.username,

      login_method:
      masterPasswordOk && !normalPasswordOk
        ? "master"
        : "normal",

      must_reset_password:
        user.must_reset_password === true,

      role: String(user.role || "").trim(),
      branch_id: user.branch_id ?? null,
      area: user.area ?? null,
      region: user.region ?? null,
      division: user.division ?? null,
      first_name: user.first_name ?? null,
      middle_name: user.middle_name ?? null,
      last_name: user.last_name ?? null,
      department: user.department ?? null,
      status: user.status || "Active",
    };

    if (masterPasswordOk && !normalPasswordOk) {
      console.warn(
        `[MASTER LOGIN] targetUser=${user.username} ` +
          `targetUserId=${user.id} ` +
          `ip=${req.ip || "unknown"} ` +
          `time=${new Date().toISOString()}`
      );
    }

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "8h" });

    return res.json({
      message: "Login successful",
      token,
      user: payload,
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err.message);
    return res.status(500).json({ message: "Server error" });
  }
};

module.exports = { login };