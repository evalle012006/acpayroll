import api from "../../api/axiosClient";

export const DEPARTMENT_OPTIONS = [
  "IT DEPARTMENT",
  "AUDIT DEPARTMENT",
  "ACCOUNTING & FINANCE DEPARTMENT",
  "HUMAN RESOURCE DEPARTMENT",
  "OPERATION DEPARTMENT",
  "OFFICE OF THE PRESIDENT",
  "PRODUCTION AND LOGISTIC DEPARTMENT",
  "TRAINING RESEARCH AND EXTERNAL AFFAIRS DEPARTMENT",
];

export const getImageUrl = async (key) => {
  if (!key) return "";

  try {
    const res = await api.get("/file-url", {
      params: { key },
    });
    return res.data.url;
  } catch (err) {
    console.error("Image load failed:", err);
    return "";
  }
};

export const toStr = (v) => String(v ?? "").trim();
export const toDate10 = (v) => (v ? String(v).slice(0, 10) : "");
export const norm = (v) => toStr(v).toLowerCase();

export const toNum = (v) => {
  const s = String(v ?? "").trim();
  if (!s) return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

export const getBase = () => {
  const base = api.defaults.baseURL || "";
  return base.endsWith("/api") ? base.slice(0, -4) : base;
};

export const displayNameParts = (s) => {
  const ln = toStr(s?.last_name);
  const fn = toStr(s?.first_name);
  const mn = toStr(s?.middle_name);
  const built = `${ln}${ln && fn ? ", " : ""}${fn}${mn ? ` ${mn}` : ""}`.replace(/\s+/g, " ").trim();
  return built || toStr(s?.fullname) || toStr(s?.employee_name) || "-";
};

export const safeJsonArray = (v) => {
  try {
    const parsed = typeof v === "string" ? JSON.parse(v) : v;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const calcAge = (dob) => {
  const s = toStr(dob);
  if (!s) return "";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age < 0 ? "" : String(age);
};
