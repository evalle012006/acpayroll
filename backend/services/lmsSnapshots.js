/**
 * lmsSnapshots.js  ->  acpayroll/backend/services/lmsSnapshots.js
 * ---------------------------------------------------------------
 * Builds the staff snapshot the LMS expects. Salary, government IDs, family
 * info and deductions are deliberately NOT selected (same rule as /api/webhook).
 * `on_leave` = an APPROVED leave covers today (Asia/Manila).
 */

const SNAPSHOT_SELECT = `
  SELECT
    s.id, s.employee_no, s.fullname, s.last_name, s.first_name, s.middle_name, s.status,
    s."position", s.department, s.area, s.region, s.division,
    s.branch_id, b.code AS branch_code, b.name AS branch_name,
    to_char(s.start_date, 'YYYY-MM-DD')           AS start_date,
    to_char(s.regularization_date, 'YYYY-MM-DD')  AS regularization_date,
    s.email, s.contact, s.address, s.municipality, s.province,
    EXISTS (
      SELECT 1
      FROM public.leave_requests lr
      WHERE lr.employee_id::text = s.id::text
        AND LOWER(TRIM(lr.status)) = 'approved'
        AND lr.start_date::date <= (NOW() AT TIME ZONE 'Asia/Manila')::date
        AND lr.end_date::date   >= (NOW() AT TIME ZONE 'Asia/Manila')::date
    ) AS on_leave
  FROM public.staff s
  LEFT JOIN public.branches b ON b.id = s.branch_id
`;

/** All staff, or one staff member when staffId is given. */
async function fetchSnapshots(pool, { staffId } = {}) {
  if (staffId !== undefined) {
    const r = await pool.query(`${SNAPSHOT_SELECT} WHERE s.id = $1`, [staffId]);
    return r.rows;
  }
  const r = await pool.query(`${SNAPSHOT_SELECT} ORDER BY s.id ASC`);
  return r.rows;
}

module.exports = { fetchSnapshots };
