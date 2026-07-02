/**
 * lmsSyncService.js
 * =================
 * Handles outbound push notifications to LMS whenever a staff event is
 * approved in acpayroll.
 *
 * FLOW (per approval):
 *   1. Caller writes event row to staff_sync_events INSIDE the approval
 *      DB transaction (so it's atomic with the approval itself).
 *   2. After the transaction commits, caller invokes dispatchSyncEvent().
 *   3. dispatchSyncEvent() POSTs to LMS_WEBHOOK_URL.
 *   4. On success → marks event row as 'sent'.
 *      On failure → marks event row as 'failed' with error; row stays for
 *      manual retry via /api/webhook/sync-events/:id/retry.
 *
 * EVENT TYPES:
 *   leave_approved   — staff leave request fully approved
 *   promoted         — promotion order approved
 *   demoted          — demotion order approved
 *   transferred      — transfer order approved
 *   exited           — exit order approved (resigned / AWOL / terminated)
 *
 * ENV VARS REQUIRED:
 *   LMS_WEBHOOK_URL     The LMS endpoint to POST events to
 *   LMS_WEBHOOK_SECRET  Shared secret sent as X-Webhook-Secret header
 */

const pool = require("../db");

const LMS_URL    = process.env.LMS_WEBHOOK_URL;
const LMS_SECRET = process.env.LMS_WEBHOOK_SECRET;

/**
 * Write a sync event row inside an existing DB transaction.
 * Must be called BEFORE client.query("COMMIT").
 *
 * @param {object} client  - pg PoolClient (already in transaction)
 * @param {object} opts
 * @param {string} opts.event_type   - 'leave_approved' | 'promoted' | 'demoted' | 'transferred' | 'exited'
 * @param {number} opts.employee_id
 * @param {string} opts.employee_no
 * @param {string} opts.source_table - table name of the order (e.g. 'promotion_orders')
 * @param {string|number} opts.source_id  - PK of the order row
 * @param {object} opts.payload      - data to send to LMS
 * @returns {number} inserted event id
 */
const writeEvent = async (client, { event_type, employee_id, employee_no, source_table, source_id, payload }) => {
  const r = await client.query(
    `INSERT INTO public.staff_sync_events
       (event_type, employee_id, employee_no, source_table, source_id, payload, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'pending')
     RETURNING id`,
    [event_type, employee_id, employee_no || null, source_table || null, String(source_id ?? ""), JSON.stringify(payload)]
  );
  return r.rows[0].id;
};

/**
 * Fire the POST to LMS and update the event row status.
 * Call this AFTER the approval transaction has committed.
 *
 * Never throws — failures are logged and stored on the event row.
 *
 * @param {number} eventId  - id from staff_sync_events
 */
const dispatchSyncEvent = async (eventId) => {
  if (!LMS_URL) {
    console.warn(`[lmsSync] LMS_WEBHOOK_URL not set — event ${eventId} queued but not sent.`);
    return;
  }

  // Fetch the event row
  let eventRow;
  try {
    const r = await pool.query(
      `SELECT * FROM public.staff_sync_events WHERE id = $1`,
      [eventId]
    );
    if (r.rowCount === 0) {
      console.error(`[lmsSync] Event ${eventId} not found.`);
      return;
    }
    eventRow = r.rows[0];
  } catch (err) {
    console.error(`[lmsSync] Failed to fetch event ${eventId}:`, err.message);
    return;
  }

  // Bump attempt counter
  await pool.query(
    `UPDATE public.staff_sync_events SET attempts = attempts + 1 WHERE id = $1`,
    [eventId]
  );

  // POST to LMS
  try {
    const body = JSON.stringify({
      event_id:   eventRow.id,
      event_type: eventRow.event_type,
      occurred_at: eventRow.created_at,
      data: eventRow.payload,
    });

    const headers = {
      "Content-Type": "application/json",
      "X-Source": "acpayroll",
    };
    if (LMS_SECRET) headers["X-Webhook-Secret"] = LMS_SECRET;

    const response = await fetch(LMS_URL, { method: "POST", headers, body });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`);
    }

    // Success
    await pool.query(
      `UPDATE public.staff_sync_events
       SET status = 'sent', sent_at = NOW(), last_error = NULL
       WHERE id = $1`,
      [eventId]
    );
    console.log(`[lmsSync] Event ${eventId} (${eventRow.event_type}) sent successfully.`);
  } catch (err) {
    // Failure — store error, leave status as 'failed' for retry
    await pool.query(
      `UPDATE public.staff_sync_events
       SET status = 'failed', last_error = $2
       WHERE id = $1`,
      [eventId, err.message]
    );
    console.error(`[lmsSync] Event ${eventId} (${eventRow.event_type}) FAILED:`, err.message);
  }
};

module.exports = { writeEvent, dispatchSyncEvent };