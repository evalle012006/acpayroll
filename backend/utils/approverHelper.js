const pool = require("../db");

const toStr = (value) => String(value ?? "").trim();

async function findActiveApprover({
  role,
  department = null,
  branchId = null,
  area = null,
  region = null,
  division = null,
}) {
  const values = [toStr(role)];
  const conditions = [
    `LOWER(TRIM(COALESCE(u.role, ''))) = LOWER(TRIM($1))`,
    `LOWER(TRIM(COALESCE(u.status, 'Active'))) = 'active'`,
  ];

  if (department) {
    values.push(toStr(department));
    conditions.push(
      `LOWER(TRIM(COALESCE(u.department, ''))) = LOWER(TRIM($${values.length}))`
    );
  }

  if (branchId) {
    values.push(String(branchId));
    conditions.push(
      `LOWER(TRIM(COALESCE(u.branch_id::text, ''))) = LOWER(TRIM($${values.length}))`
    );
  }

  if (area) {
    values.push(toStr(area));
    conditions.push(
      `LOWER(TRIM(COALESCE(u.area, ''))) = LOWER(TRIM($${values.length}))`
    );
  }

  if (region) {
    values.push(toStr(region));
    conditions.push(
      `LOWER(TRIM(COALESCE(u.region, ''))) = LOWER(TRIM($${values.length}))`
    );
  }

  if (division) {
    values.push(toStr(division));
    conditions.push(
      `LOWER(TRIM(COALESCE(u.division, ''))) = LOWER(TRIM($${values.length}))`
    );
  }

  const result = await pool.query(
    `
    SELECT
      u.id,
      u.username,
      u.role,
      u.department,
      u.branch_id,
      u.area,
      u.region,
      u.division,
      u.status,
      u.first_name,
      u.middle_name,
      u.last_name
    FROM public.users u
    WHERE ${conditions.join("\n      AND ")}
    ORDER BY u.id ASC
    LIMIT 1
    `,
    values
  );

  return result.rows[0] || null;
}

module.exports = {
  findActiveApprover,
};