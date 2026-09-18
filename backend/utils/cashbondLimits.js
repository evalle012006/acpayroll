// backend/utils/cashbondLimits.js

const normalizePosition = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

/*
  Cashbond maximum accumulated balance per position.

  IMPORTANT:
  - Add/edit the actual limits here.
  - A position not listed here returns null.
  - null means there is no configured maximum for that position.
*/
const CASHBOND_LIMITS = {
  "loan officer": 30000,
  "branch manager": 50000,
  "area manager": 75000,
  "regional manager": 100000,
  "assistant vice president": 125000,
  "vice president": 150000,
  "senior vice president": 175000,
  "president": 200000,
};

const getCashbondLimit = (position) => {
  const normalizedPosition = normalizePosition(position);

  if (!normalizedPosition) {
    return null;
  }

  const limit = CASHBOND_LIMITS[normalizedPosition];

  return Number.isFinite(limit) ? limit : null;
};

module.exports = {
  CASHBOND_LIMITS,
  getCashbondLimit,
};