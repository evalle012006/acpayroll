/**
 * Webhook API Key Middleware
 *
 * Validates the X-API-Key header against WEBHOOK_API_KEY in .env.
 * Used exclusively on external-facing webhook/integration routes.
 * Intentionally separate from JWT auth — external systems use a
 * long-lived API key, not session tokens.
 */

const requireApiKey = (req, res, next) => {
  const apiKey = req.headers["x-api-key"];

  if (!process.env.WEBHOOK_API_KEY) {
    console.error("[webhookAuth] WEBHOOK_API_KEY is not set in environment.");
    return res.status(500).json({ error: "Server misconfiguration." });
  }

  if (!apiKey) {
    return res.status(401).json({ error: "Missing X-API-Key header." });
  }

  // Constant-time comparison to prevent timing attacks
  const expected = process.env.WEBHOOK_API_KEY;
  if (apiKey.length !== expected.length) {
    return res.status(403).json({ error: "Invalid API key." });
  }

  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= apiKey.charCodeAt(i) ^ expected.charCodeAt(i);
  }

  if (mismatch !== 0) {
    return res.status(403).json({ error: "Invalid API key." });
  }

  return next();
};

module.exports = { requireApiKey };