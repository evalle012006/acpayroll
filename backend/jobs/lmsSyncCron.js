/**
 * lmsSyncCron.js  ->  acpayroll/backend/jobs/lmsSyncCron.js
 * ---------------------------------------------------------
 * Runs the LMS sync every N minutes (and once, 30s after start).
 * OFF by default. Turn on with LMS_SYNC_ENABLED=true.
 *
 *   LMS_SYNC_ENABLED=false
 *   LMS_SYNC_INTERVAL_MIN=10      1-59
 *   LMS_SYNC_ALLOW_VACATE=false   see services/lmsSync.js
 */
const cron = require("node-cron");
const { runLmsSync } = require("../services/lmsSync");

let job = null;

const tick = async () => {
  try {
    const r = await runLmsSync();
    if (r.skipped) return console.log(`[lmsSync] skipped: ${r.reason}`);
    console.log(
      `[lmsSync] ${r.staff_total} staff in ${r.ms}ms ->`,
      JSON.stringify(r.summary),
      `warnings=${r.warnings.length} errors=${r.errors.length}`
    );
    if (r.errors.length) console.error("[lmsSync] errors (first 5):", JSON.stringify(r.errors.slice(0, 5)));
  } catch (err) {
    console.error("[lmsSync] run failed:", err.message);
  }
};

const startLmsSyncCron = () => {
  if (!/^(1|true|yes)$/i.test(String(process.env.LMS_SYNC_ENABLED || "").trim())) {
    console.log("[lmsSync] disabled (set LMS_SYNC_ENABLED=true to enable)");
    return null;
  }
  if (!process.env.LMS_API_URL || !process.env.LMS_API_KEY) {
    console.error("[lmsSync] LMS_API_URL / LMS_API_KEY missing; sync NOT started");
    return null;
  }

  const minutes = Math.min(59, Math.max(1, parseInt(process.env.LMS_SYNC_INTERVAL_MIN || "10", 10) || 10));

  job = cron.schedule(`*/${minutes} * * * *`, tick, { scheduled: true, timezone: "Asia/Manila" });
  console.log(`[lmsSync] scheduled every ${minutes} min (allow_vacate=${process.env.LMS_SYNC_ALLOW_VACATE || "false"})`);

  setTimeout(tick, 30_000);
  return job;
};

module.exports = { startLmsSyncCron };
