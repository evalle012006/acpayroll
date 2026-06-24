/**
 * =============================================================================
 * Webhook: Staff Data Feed
 * Base URL : /api/webhook
 * Auth     : X-API-Key header (set WEBHOOK_API_KEY in .env)
 * =============================================================================
 *
 * SECURITY
 *   All routes require the header:
 *     X-API-Key: <your-secret-key>
 *   Responds 401 if missing, 403 if invalid.
 *
 * EXCLUDED FIELDS
 *   Salary, government IDs (SSS/TIN/PhilHealth/Pag-IBIG),
 *   family info, and deductions are intentionally never returned.
 *
 * =============================================================================
 * ENDPOINTS
 * =============================================================================
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ 1. LIST STAFF                                                           │
 * │    GET /api/webhook/staff                                               │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │ Query Parameters:                                                       │
 * │   page    (int)    Page number. Default: 1                              │
 * │   limit   (int)    Records per page. Default: 50. Max: 200              │
 * │   status  (string) Filter by status. Values: "Active" | "Inactive"      │
 * │   branch  (int)    Filter by branch_id                                  │
 * │                                                                         │
 * │ Examples:                                                               │
 * │   GET /api/webhook/staff                                                │
 * │   GET /api/webhook/staff?status=Active                                  │
 * │   GET /api/webhook/staff?status=Active&branch=1                         │
 * │   GET /api/webhook/staff?page=2&limit=10                                │
 * │   GET /api/webhook/staff?status=Inactive&page=1&limit=5                 │
 * │                                                                         │
 * │ Sample Response:                                                        │
 * │ {                                                                       │
 * │   "meta": {                                                             │
 * │     "page": 1, "limit": 50, "total": 2,                                 │
 * │     "total_pages": 1, "has_next": false, "has_prev": false              │
 * │   },                                                                    │
 * │   "data": [                                                             │
 * │     {                                                                   │
 * │       "id": 1,                                                          │
 * │       "employee_no": "EMP-0001",                                        │
 * │       "fullname": "Juan Dela Cruz",                                     │
 * │       "last_name": "Dela Cruz",                                         │
 * │       "first_name": "Juan",                                             │
 * │       "middle_name": "Santos",                                          │
 * │       "status": "Active",                                               │
 * │       "position": "Branch Manager",                                     │
 * │       "department": "Department Operations",                                       │
 * │       "area": "Area 1",                                                 │
 * │       "region": "",                                                     │
 * │       "division": "",                                                   │
 * │       "branch_id": 1,                                                   │
 * │       "branch_name": "Baras Main Branch",                               │
 * │       "branch_code": "BR001",                                           │
 * │       "start_date": null,                                               │
 * │       "regularization_date": null,                                      │
 * │       "email": null,                                                    │
 * │       "contact": null,                                                  │
 * │       "address": null,                                                  │
 * │       "municipality": null,                                             │
 * │       "province": null                                                  │
 * │     },                                                                  │
 * │     {                                                                   │
 * │       "id": 2,                                                          │
 * │       "employee_no": "EMP-0002",                                        │
 * │       "fullname": "Maria Santos",                                       │
 * │       "last_name": "Santos",                                            │
 * │       "first_name": "Maria",                                            │
 * │       "middle_name": "Lopez",                                           │
 * │       "status": "Active",                                               │
 * │       "position": "Cashier",                                            │
 * │       "department": "Accounting",                                       │
 * │       "area": "Area 1",                                                 │
 * │       "region": "",                                                     │
 * │       "division": "",                                                   │
 * │       "branch_id": 2,                                                   │
 * │       "branch_name": "Tanay Branch",                                    │
 * │       "branch_code": "BR002",                                           │
 * │       "start_date": null,                                               │
 * │       "regularization_date": null,                                      │
 * │       "email": null,                                                    │
 * │       "contact": null,                                                  │
 * │       "address": null,                                                  │
 * │       "municipality": null,                                             │
 * │       "province": null                                                  │
 * │     }                                                                   │
 * │   ]                                                                     │
 * │ }                                                                       │
 * └─────────────────────────────────────────────────────────────────────────┘
 *  
 * 
 * 
 * 
 * 
 * 
 * 
 * 
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ 2. SINGLE STAFF                                                         │
 * │    GET /api/webhook/staff/:ref                                          │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │ :ref accepts either the numeric id OR the employee_no (case-insensitive)│
 * │                                                                         │
 * │ Examples:                                                               │
 * │   GET /api/webhook/staff/1                                              │
 * │   GET /api/webhook/staff/EMP-0001                                       │
 * │   GET /api/webhook/staff/emp-0001     ← same result, case-insensitive   │
 * │                                                                         │
 * │ Sample Response:                                                        │
 * │ {                                                                       │
 * │   "data": {                                                             │
 * │     "id": 1,                                                            │
 * │     "employee_no": "EMP-0001",                                          │
 * │     "fullname": "Juan Dela Cruz",                                       │
 * │     "status": "Active",                                                 │
 * │     "position": "Branch Manager",                                       │
 * │     "department": "Operations",                                         │
 * │     "area": "Area 1",                                                   │
 * │     "branch_id": 1,                                                     │
 * │     "branch_name": "Baras Main Branch",                                 │
 * │     "branch_code": "BR001",                                             │
 * │     "start_date": null,                                                 │
 * │     "email": null,                                                      │
 * │     "contact": null,                                                    │
 * │     "address": null                                                     │
 * │   }                                                                     │
 * │ }                                                                       │
 * │                                                                         │
 * │ 404 if not found.                                                       │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ 3. STAFF EMPLOYMENT STATUS                                              │
 * │    GET /api/webhook/staff/:ref/status                                   │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │ :ref accepts either the numeric id OR the employee_no (case-insensitive)│
 * │ Only APPROVED orders are returned — pending/rejected are not exposed.   │
 * │                                                                         │
 * │ Examples:                                                               │
 * │   GET /api/webhook/staff/1/status                                       │
 * │   GET /api/webhook/staff/EMP-0001/status                                │
 * │                                                                         │
 * │ Sample Response:                                                        │
 * │ {                                                                       │
 * │   "staff_id": 1,                                                        │
 * │   "employee_no": "EMP-0001",                                            │
 * │   "fullname": "Juan Dela Cruz",                                         │
 * │   "current_status": "Active",                                           │
 * │   "current_position": "Branch Manager",                                 │
 * │   "current_branch": {                                                   │
 * │     "id": 1, "name": "Baras Main Branch", "code": "BR001"               │
 * │   },                                                                    │
 * │   "on_leave": {                                                         │
 * │     "active": false,                                                    │
 * │     "current": [],                                                      │
 * │     "history": [                                                        │
 * │       {                                                                 │
 * │         "id": 10,                                                       │
 * │         "transaction_code": "LR-2025-01-0001",                          │
 * │         "leave_type": "Sick Leave",                                     │
 * │         "start_date": "2025-01-10",                                     │
 * │         "end_date": "2025-01-12",                                       │
 * │         "status": "Approved"                                            │
 * │       }                                                                 │
 * │     ]                                                                   │
 * │   },                                                                    │
 * │   "transfers": [                                                        │
 * │     {                                                                   │
 * │       "order_no": "TSO-2025-03-0001",                                   │
 * │       "prev_branch_name": "Tanay Branch",                               │
 * │       "to_branch_name": "Baras Main Branch",                            │
 * │       "effective_date": "2025-03-01",                                   │
 * │       "status": "Approved"                                              │
 * │     }                                                                   │
 * │   ],                                                                    │
 * │   "promotions": [                                                       │
 * │     {                                                                   │
 * │       "order_no": "PRO-2025-02-0001",                                   │
 * │       "old_position": "Cashier",                                        │
 * │       "new_position": "Branch Manager",                                 │
 * │       "effective_date": "2025-02-01",                                   │
 * │       "is_upcoming": false,                                             │
 * │       "status": "Approved"                                              │
 * │     }                                                                   │
 * │   ],                                                                    │
 * │   "demotions": [],                                                      │
 * │   "exit": { "exited": false, "source": null, "record": null }           │
 * │ }                                                                       │
 * └─────────────────────────────────────────────────────────────────────────┘
 * 
 * 
 * 
 * 
 * 
 * 
 */

const express = require("express");
const router = express.Router();
const pool = require("../db");
const { requireApiKey } = require("../middlewares/webhookAuth");

router.use(requireApiKey);

/* ── HELPERS ── */
const toInt = (v, fallback) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};
const toStr = (v) => String(v ?? "").trim();

/* ── Resolve :ref param as either numeric id or employee_no ── */
const resolveStaffWhere = (ref) => {
  const numeric = parseInt(ref, 10);
  if (Number.isFinite(numeric) && String(numeric) === String(ref).trim()) {
    return { clause: "s.id = $1", param: numeric };
  }
  return { clause: "LOWER(TRIM(s.employee_no)) = LOWER(TRIM($1))", param: String(ref).trim() };
};

/* ── STAFF BASE SELECT (reused) ── */
const STAFF_SELECT = `
  SELECT
    s.id, s.employee_no, s.fullname, s.last_name, s.first_name, s.middle_name, s.status,
    s."position", s.department, s.area, s.region, s.division,
    s.branch_id, b.name AS branch_name, b.code AS branch_code,
    s.start_date, s.regularization_date,
    s.email, s.contact, s.address, s.municipality, s.province
  FROM public.staff s
  LEFT JOIN public.branches b ON b.id = s.branch_id
`;

/* ── GET /api/webhook/staff ── */
router.get("/staff", async (req, res) => {
  try {
    const page   = toInt(req.query.page, 1);
    const limit  = Math.min(toInt(req.query.limit, 50), 200);
    const offset = (page - 1) * limit;

    const statusFilter = toStr(req.query.status);
    const branchFilter = parseInt(req.query.branch, 10);

    const conditions = [];
    const params = [];

    if (statusFilter) {
      params.push(statusFilter);
      conditions.push(`s.status = $${params.length}`);
    }
    if (Number.isFinite(branchFilter)) {
      params.push(branchFilter);
      conditions.push(`s.branch_id = $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countResult = await pool.query(
      `SELECT COUNT(*) AS total FROM public.staff s ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total, 10);

    params.push(limit);
    params.push(offset);

    const dataResult = await pool.query(
      `${STAFF_SELECT} ${whereClause} ORDER BY s.id ASC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const totalPages = Math.ceil(total / limit);
    return res.json({
      meta: { page, limit, total, total_pages: totalPages, has_next: page < totalPages, has_prev: page > 1 },
      data: dataResult.rows,
    });
  } catch (err) {
    console.error("[webhook/staff] GET ERROR:", err.message);
    return res.status(500).json({ error: "Internal server error." });
  }
});

/* ── GET /api/webhook/staff/:ref ── */
router.get("/staff/:id", async (req, res) => {
  try {
    const ref = toStr(req.params.id);
    if (!ref) return res.status(400).json({ error: "Invalid staff identifier." });

    const { clause, param } = resolveStaffWhere(ref);
    const result = await pool.query(`${STAFF_SELECT} WHERE ${clause}`, [param]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Staff member not found." });

    return res.json({ data: result.rows[0] });
  } catch (err) {
    console.error("[webhook/staff/:id] GET ERROR:", err.message);
    return res.status(500).json({ error: "Internal server error." });
  }
});

/* ── GET /api/webhook/staff/:ref/status ── */
router.get("/staff/:id/status", async (req, res) => {
  try {
    const ref = toStr(req.params.id);
    if (!ref) return res.status(400).json({ error: "Invalid staff identifier." });

    const { clause, param } = resolveStaffWhere(ref);

    // 1. Staff identity
    const staffResult = await pool.query(
      `SELECT s.id, s.employee_no, s.fullname, s.status, s."position", s.department,
              s.branch_id, b.name AS branch_name, b.code AS branch_code
       FROM public.staff s
       LEFT JOIN public.branches b ON b.id = s.branch_id
       WHERE ${clause}`,
      [param]
    );
    if (staffResult.rows.length === 0) return res.status(404).json({ error: "Staff member not found." });
    const staff = staffResult.rows[0];

    const today = new Date().toISOString().slice(0, 10);

    // 2. Leave — approved only
    const leaveResult = await pool.query(
      `SELECT id, transaction_code, leave_type, start_date, end_date, entry_date, status
       FROM public.leave_requests
       WHERE employee_id = $1 AND LOWER(TRIM(status)) = 'approved'
       ORDER BY start_date DESC`,
      [staff.id]
    );
    const leaveRecords = leaveResult.rows;
    const activeLeave  = leaveRecords.filter(
      (r) => String(r.start_date).slice(0, 10) <= today && String(r.end_date).slice(0, 10) >= today
    );

    // 3. Transfers — approved only, most recent first
    const transferResult = await pool.query(
      `SELECT id, order_no, prev_branch_id, prev_branch_code, prev_branch_name,
              to_branch_id, to_branch_code, to_branch_name,
              area, region, division, effective_date, date_created, details, status, approved_at
       FROM public.transfer_staff_orders
       WHERE employee_id = $1 AND LOWER(TRIM(status)) = 'approved'
       ORDER BY effective_date DESC`,
      [staff.id]
    );

    // 4. Promotions — approved only, most recent first
    const promotionResult = await pool.query(
      `SELECT id, order_no, old_position, new_position, old_ecola, new_ecola,
              effective_date, details, status, approved_at
       FROM public.promotion_orders
       WHERE employee_id = $1 AND LOWER(TRIM(status)) = 'approved'
       ORDER BY effective_date DESC`,
      [staff.id]
    );

    // 5. Demotions — approved only, most recent first
    const demotionResult = await pool.query(
      `SELECT id, order_no, old_position, new_position, effective_date, details, status, approved_at
       FROM public.demotion_orders
       WHERE employee_id = $1 AND LOWER(TRIM(status)) = 'approved'
       ORDER BY effective_date DESC`,
      [staff.id]
    );

    // 6. Exit — check approved exit order (keyed on employee_no).
    //    Fallback: exit data is also stored directly on the staff row (exit_type, exit_date, exit_remarks).
    const exitOrderResult = await pool.query(
      `SELECT id, order_no, exit_type, effective_date, settlement_date, remarks, status, approved_at
       FROM public.exit_staff_orders
       WHERE LOWER(TRIM(employee_no)) = LOWER(TRIM($1)) AND LOWER(TRIM(status)) = 'approved'
       ORDER BY effective_date DESC LIMIT 1`,
      [staff.employee_no]
    );

    // Re-fetch staff exit fields (exit_type, exit_date, exit_remarks set when staff goes Inactive)
    const staffExitResult = await pool.query(
      `SELECT exit_type, exit_date, exit_remarks FROM public.staff WHERE id = $1`,
      [staff.id]
    );
    const staffExitRow = staffExitResult.rows[0] || {};

    const exitOrder = exitOrderResult.rows[0] || null;
    const hasStaffExit = !!staffExitRow.exit_type;

    const exitData = exitOrder
      ? { exited: true, source: "exit_order", record: exitOrder }
      : hasStaffExit
      ? { exited: true, source: "staff_record", record: { exit_type: staffExitRow.exit_type, exit_date: staffExitRow.exit_date, exit_remarks: staffExitRow.exit_remarks } }
      : { exited: false, source: null, record: null };

    // 7. Compose response
    return res.json({
      staff_id:         staff.id,
      employee_no:      staff.employee_no,
      fullname:         staff.fullname,
      current_status:   staff.status,
      current_position: staff.position,
      current_branch: {
        id:   staff.branch_id,
        name: staff.branch_name,
        code: staff.branch_code,
      },

      on_leave: {
        active:  activeLeave.length > 0,
        current: activeLeave,
        history: leaveRecords,
      },

      transfers: transferResult.rows,

      promotions: promotionResult.rows.map((r) => ({
        ...r,
        is_upcoming: String(r.effective_date).slice(0, 10) > today,
      })),

      demotions: demotionResult.rows.map((r) => ({
        ...r,
        is_upcoming: String(r.effective_date).slice(0, 10) > today,
      })),

      exit: exitData,
    });
  } catch (err) {
    console.error("[webhook/staff/:id/status] GET ERROR:", err.message);
    return res.status(500).json({ error: "Internal server error." });
  }
});

module.exports = router;