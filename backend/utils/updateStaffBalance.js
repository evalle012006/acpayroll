const pool = require("../db");

const toNum = (v) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

async function updateStaffBalance(employee_id, column, amount) {
  if (!employee_id || !column) return;

  try {
    await pool.query(
      `
      UPDATE staff_balances
      SET ${column} = COALESCE(${column},0) + $1,
          updated_at = NOW()
      WHERE employee_id = $2
      `,
      [toNum(amount), employee_id]
    );
  } catch (err) {
    console.error("updateStaffBalance error:", err.message);
  }
}

module.exports = updateStaffBalance;