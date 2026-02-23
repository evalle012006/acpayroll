const jwt = require("jsonwebtoken");

const normalizeRole = (role) => String(role || "").trim().toLowerCase();

const getBearerToken = (req) => {
  const header = req.headers.authorization || req.headers.Authorization || "";
  const raw = String(header);

  if (raw.toLowerCase().startsWith("bearer ")) {
    return raw.slice(7).trim();
  }
  return null;
};

const requireAuth = (req, res, next) => {
  const token = getBearerToken(req);

  if (!token) return res.status(401).json({ message: "Missing token" });
  if (!process.env.JWT_SECRET) return res.status(500).json({ message: "JWT_SECRET is missing" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = {
      ...decoded,
      role: normalizeRole(decoded?.role),
    };

    return next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

const requireRole = (roles = [], options = { adminOverride: true }) => {
  const allowed = Array.isArray(roles) ? roles : [roles];
  const allowedNormalized = allowed.map(normalizeRole).filter(Boolean);

  const adminOverride = options?.adminOverride !== false;

  return (req, res, next) => {
    const userRole = normalizeRole(req.user?.role);

    if (!userRole) return res.status(403).json({ message: "Access denied" });

    if (adminOverride && userRole === "admin") return next();

    if (!allowedNormalized.includes(userRole)) {
      return res.status(403).json({ message: "Access denied" });
    }

    return next();
  };
};

module.exports = { requireAuth, requireRole, normalizeRole };