/**
 * lmsSync.js  ->  acpayroll/backend/services/lmsSync.js
 * -----------------------------------------------------
 * Pushes every staff snapshot to the LMS in chunks. The LMS decides what to do
 * (mirror, vacate, block, unblock, refresh). Idempotent, so a failed run is
 * simply retried on the next tick: no queue or outbox needed.
 *
 *   LMS_SYNC_ALLOW_VACATE=false  (default) the LMS only REPORTS what it would vacate
 *   LMS_SYNC_ALLOW_VACATE=true   the LMS really vacates. Flip only after a clean review.
 */
const pool = require("../db");
const { fetchSnapshots } = require("./lmsSnapshots");
const { syncStaff } = require("./lmsClient");

const CHUNK = 200;
let running = false;

const envBool = (v, fallback = false) =>
  v === undefined || v === null || v === "" ? fallback : /^(1|true|yes)$/i.test(String(v).trim());

async function runLmsSync({ dryRun = false, allowVacate } = {}) {
  if (running) return { skipped: true, reason: "a sync is already running" };
  running = true;
  const startedAt = Date.now();

  try {
    const allow = allowVacate ?? envBool(process.env.LMS_SYNC_ALLOW_VACATE, false);
    const staff = await fetchSnapshots(pool);

    const totals = {};
    const warnings = [];
    const errors = [];
    const actions = [];

    for (let i = 0; i < staff.length; i += CHUNK) {
      const result = await syncStaff({
        staff: staff.slice(i, i + CHUNK),
        dry_run: dryRun,
        allow_vacate: allow,
        actor: "acpayroll-sync",
      });

      Object.entries(result.summary || {}).forEach(([k, v]) => {
        totals[k] = (totals[k] || 0) + Number(v || 0);
      });
      warnings.push(...(result.warnings || []));
      errors.push(...(result.errors || []));
      actions.push(...(result.actions || []));
    }

    return {
      skipped: false,
      dry_run: dryRun,
      allow_vacate: allow,
      staff_total: staff.length,
      staff_without_employee_no: staff.filter((s) => !String(s.employee_no || "").trim()).length,
      summary: totals,
      warnings: warnings.slice(0, 200),
      errors: errors.slice(0, 200),
      actions: actions.slice(0, 300),
      ms: Date.now() - startedAt,
    };
  } finally {
    running = false;
  }
}

module.exports = { runLmsSync };
