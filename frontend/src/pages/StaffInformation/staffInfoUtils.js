
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

export const compute13thMonthBreakdown = (staff, promotionRows = []) => {
  const currentBasicSalary = toNum(staff?.salary);
  const currentEcola = toNum(staff?.ecola);

  const startDateRaw = staff?.start_date;
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthIndex = now.getMonth();

  let startDate = null;
  if (startDateRaw) {
    const d = new Date(startDateRaw);
    if (!Number.isNaN(d.getTime())) startDate = d;
  }

  const approvedPromotions = (promotionRows || [])
    .filter((p) => norm(p.status || p.final_status) === "approved")
    .filter((p) => p.effective_date)
    .map((p) => ({
      effectiveDate: new Date(p.effective_date),
      oldSalary: toNum(p.old_salary),
      newSalary: toNum(p.new_salary),
      oldEcola: toNum(p.old_ecola),
      newEcola: toNum(p.new_ecola),
    }))
    .filter((p) => !Number.isNaN(p.effectiveDate.getTime()))
    .sort((a, b) => a.effectiveDate - b.effectiveDate);

  const getMonthlyAmount = (monthIndex) => {
    const monthStart = new Date(currentYear, monthIndex, 1);
    const monthEnd = new Date(currentYear, monthIndex + 1, 0);
    const daysInMonth = monthEnd.getDate();

    let salary = currentBasicSalary;
    let ecola = currentEcola;

    const promotionInMonth = approvedPromotions.find(
      (p) =>
        p.effectiveDate.getFullYear() === currentYear &&
        p.effectiveDate.getMonth() === monthIndex
    );

    const latestBeforeMonth = [...approvedPromotions]
      .reverse()
      .find((p) => p.effectiveDate < monthStart);

    const firstAfterMonth = approvedPromotions.find(
      (p) => p.effectiveDate > monthEnd
    );

    if (promotionInMonth) {
      const effectiveDay = promotionInMonth.effectiveDate.getDate();

      const oldDays = Math.max(0, effectiveDay - 1);
      const newDays = daysInMonth - oldDays;

      const oldMonthly =
        promotionInMonth.oldSalary + promotionInMonth.oldEcola;
      const newMonthly =
        promotionInMonth.newSalary + promotionInMonth.newEcola;

      return (oldMonthly / daysInMonth) * oldDays + (newMonthly / daysInMonth) * newDays;
    }

    if (latestBeforeMonth) {
      salary = latestBeforeMonth.newSalary;
      ecola = latestBeforeMonth.newEcola;
    } else if (firstAfterMonth) {
      salary = firstAfterMonth.oldSalary;
      ecola = firstAfterMonth.oldEcola;
    }

    return salary + ecola;
  };

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

    return {
      month,
      amount: showValue ? getMonthlyAmount(index) : null,
      eligible,
      passed,
    };
  });

  const totalCompensationEarned = rows.reduce(
    (sum, row) => sum + (row.amount != null ? row.amount : 0),
    0
  );

  const equivalent = totalCompensationEarned / 12;

  return {
    year: currentYear,
    rows,
    totalCompensationEarned,
    thirteenthMonth: equivalent,
    fourteenthMonth: equivalent,
    fifteenthMonth: equivalent,
    monthlyCompensation: currentBasicSalary + currentEcola,
    basicSalary: currentBasicSalary,
    ecola: currentEcola,
  };
};

const _signedUrlCache = new Map();
const EXPIRY_BUFFER_MS = 60_000;