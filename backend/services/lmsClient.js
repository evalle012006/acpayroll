/**
 * lmsClient.js  ->  acpayroll/backend/services/lmsClient.js
 * ---------------------------------------------------------
 * The ONLY place ACPayroll talks to the LMS. Uses the HRIS-scoped key, which
 * works on /api/v2/hris/* and nothing else in the LMS.
 *
 * .env
 *   LMS_API_URL   e.g. https://lms.ambercashph.com        (no trailing /api)
 *   LMS_API_KEY   must equal HRIS_API_KEY in the LMS .env
 */

const baseUrl = () => String(process.env.LMS_API_URL || "").trim().replace(/\/+$/, "");

async function call(method, path, { query, body, timeoutMs = 60000 } = {}) {
  const base = baseUrl();
  const key = process.env.LMS_API_KEY;
  if (!base || !key) {
    throw new Error("LMS_API_URL and LMS_API_KEY must be set in backend/.env");
  }

  const url = new URL(`${base}/api/v2/hris/${path}`);
  Object.entries(query || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && String(v) !== "") url.searchParams.set(k, String(v));
  });

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const resp = await fetch(url, {
      method,
      headers: {
        "x-hris-api-key": key,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });

    const text = await resp.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* non-JSON error page */ }

    if (!resp.ok) {
      // never echo request bodies: assign responses can contain a temp password
      throw new Error(`LMS ${method} ${path} failed: ${resp.status} ${json?.message || text.slice(0, 160)}`);
    }
    return json;
  } finally {
    clearTimeout(timer);
  }
}

/** Open seats for a staff member + the seat they already hold. */
const getSeats = ({ position, branch_code, employee_no }) =>
  call("GET", "seats", { query: { position, branch_code, employee_no } });

/** Give a vacant seat to a staff member. Response contains temp_password ONCE. */
const assignSeat = ({ seat_id, staff, actor }) =>
  call("POST", "assign", { body: { seat_id, staff, actor } });

/** Push a batch of staff snapshots (max 500). */
const syncStaff = ({ staff, dry_run, allow_vacate, actor }) =>
  call("POST", "sync", { body: { staff, dry_run, allow_vacate, actor } });

module.exports = { getSeats, assignSeat, syncStaff };
