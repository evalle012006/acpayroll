import axios from "axios";

const rawBase = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const baseURL = String(rawBase).trim().replace(/\/+$/, "");

const api = axios.create({
  baseURL,
  withCredentials: false,
});

const emitAuthChanged = () => {
  window.dispatchEvent(new Event("auth-changed"));
};

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");

    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const url = String(error?.config?.url || "");

    if (status === 401) {
      if (url.includes("/notifications")) {
        console.warn("Notifications unauthorized, skipping logout.");
        return Promise.reject(error);
      }

      console.warn("Session expired. Logging out.");

      localStorage.removeItem("token");
      localStorage.removeItem("user");

      emitAuthChanged();

      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  }
);

export const getApiBase = () => {
  return baseURL.endsWith("/api") ? baseURL.slice(0, -4) : baseURL;
};

export const buildUploadUrl = (photoUrl) => {
  const raw = String(photoUrl || "").trim();
  if (!raw) return "";

  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }

  const apiBase = getApiBase();
  const cleaned = raw.replace(/^\/+/, "");

  if (cleaned.startsWith("uploads/")) {
    return `${apiBase}/${cleaned}`;
  }

  if (cleaned.startsWith("staff/")) {
    return `${apiBase}/uploads/${cleaned}`;
  }

  return `${apiBase}/uploads/staff/${cleaned}`;
};

export default api;