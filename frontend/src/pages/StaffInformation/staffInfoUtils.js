
export const safeJsonArray = (v) => {
  try {
    const parsed = typeof v === "string" ? JSON.parse(v) : v;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const jsonText = (v) => {
  try {
    return JSON.stringify(Array.isArray(v) ? v : [], null, 2);
  } catch {
    return "[]";
  }
};

export const toStr = (v) => String(v ?? "").trim();
export const norm = (v) => toStr(v).toLowerCase();

export const fmtDate = (d) => {
  if (!d) return "-";
  const s = String(d);
  return s.includes("T") ? s.split("T")[0] : s.slice(0, 10);
};

export const toNum = (v) => {
  const s = String(v ?? "").trim();
  if (!s) return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

export const money = (v) =>
  toNum(v).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

export const displayName = (s) => {
  const ln = toStr(s?.last_name);
  const fn = toStr(s?.first_name);
  const mn = toStr(s?.middle_name);
  if (ln || fn || mn) {
    return `${ln}${ln && fn ? ", " : ""}${fn}${mn ? ` ${mn}` : ""}`.replace(/\s+/g, " ").trim();
  }
  return toStr(s?.fullname) || "-";
};

export const displayFormName = (form) => {
  const ln = toStr(form?.last_name);
  const fn = toStr(form?.first_name);
  const mn = toStr(form?.middle_name);
  const built = `${ln}${ln && fn ? ", " : ""}${fn}${mn ? ` ${mn}` : ""}`.replace(/\s+/g, " ").trim();
  return built || "New staff";
};

export const loanDisplayDate = (l) =>
  l?.entry_date || l?.approved_at || l?.disbursement_date || l?.created_at || l?.updated_at || null;

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const compute13thMonthBreakdown = (staff) => {
  const basicSalary = toNum(staff?.salary);
  const ecola = toNum(staff?.ecola);
  const monthlyCompensation = basicSalary + ecola;

  const startDateRaw = staff?.start_date;
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthIndex = now.getMonth();

  if (!monthlyCompensation) {
    return {
      year: currentYear,
      rows: MONTH_NAMES.map((month) => ({ month, amount: null, eligible: false, passed: false })),
      totalCompensationEarned: 0,
      thirteenthMonth: 0,
      fourteenthMonth: 0,
      fifteenthMonth: 0,
      monthlyCompensation: 0,
      basicSalary: 0,
      ecola: 0,
    };
  }

  let startDate = null;
  if (startDateRaw) {
    const d = new Date(startDateRaw);
    if (!Number.isNaN(d.getTime())) startDate = d;
  }

  const rows = MONTH_NAMES.map((month, index) => {
    let eligible = true;
    if (startDate) {
      const startYear = startDate.getFullYear();
      const startMonth = startDate.getMonth();
      if (startYear > currentYear) eligible = false;
      else if (startYear === currentYear && index < startMonth) eligible = false;
    }
    const passed = index <= currentMonthIndex;
    const showValue = eligible && passed;
    return { month, amount: showValue ? monthlyCompensation : null, eligible, passed };
  });

  const totalCompensationEarned = rows.reduce((sum, row) => sum + (row.amount != null ? row.amount : 0), 0);
  const equivalent = totalCompensationEarned / 12;

  return {
    year: currentYear,
    rows,
    totalCompensationEarned,
    thirteenthMonth: equivalent,
    fourteenthMonth: equivalent,
    fifteenthMonth: equivalent,
    monthlyCompensation,
    basicSalary,
    ecola,
  };
};

const _signedUrlCache = new Map();
const EXPIRY_BUFFER_MS = 60_000;
