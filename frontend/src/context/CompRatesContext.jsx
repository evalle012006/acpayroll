//CompRatesContext.jsx

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, } from "react";
import api from "../api/axiosClient";

const toNum = (v) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const norm = (v) => String(v ?? "").trim().toLowerCase();

const readUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
};

const hasAuth = () => {
  const token = localStorage.getItem("token");
  const user = localStorage.getItem("user");
  return !!token && !!user;
};

const isPublicPath = () => {
  const p = window.location.pathname;
  return p === "/login" || p === "/" || p === "/forgot-password";
};

const canFetchCompRates = () => {
  const user = readUser();
  const role = norm(user?.role);
  const dept = norm(
    user?.department ||
      user?.department_name ||
      user?.user_department ||
      user?.departmentName ||
      user?.dept
  );

  const isOperationDept = dept.includes("operation");
  const isBackOfficeAllowed =
    dept.includes("accounting") ||
    dept.includes("hr") ||
    dept.includes("it");

  if (dept.includes("audit")) return false;

  return (
    role === "admin" ||
    role === "it" ||
    role === "hr" ||
    role === "accounting" ||
    role === "tread" ||
    isBackOfficeAllowed ||
    (
      isOperationDept &&
      [
        "branch manager",
        "area manager",
        "regional manager",
        "assistant vice president",
        "vice president",
        "senior vice president",
        "president",
      ].includes(role)
    )
  );
};

const CompRatesContext = createContext(null);

export const CompRatesProvider = ({ children }) => {
  const [rates, setRates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!hasAuth() || isPublicPath() || !canFetchCompRates()) {
      setRates([]);
      setLoading(false);
      setError("");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await api.get("/comp-rates");
      setRates(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      const status = e?.response?.status;

      if (status === 401 || status === 403) {
        setRates([]);
        setError("");
        return;
      }

      setRates([]);
      setError(e?.response?.data?.message || "Failed to load compensation rates");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();

    const onAuthChanged = () => {
      refresh();
    };

    window.addEventListener("auth-changed", onAuthChanged);
    window.addEventListener("storage", onAuthChanged);

    return () => {
      window.removeEventListener("auth-changed", onAuthChanged);
      window.removeEventListener("storage", onAuthChanged);
    };
  }, [refresh]);

  const ratesByPosition = useMemo(() => {
    const m = new Map();
    for (const r of rates) m.set(String(r.position || ""), r);
    return m;
  }, [rates]);

  const getCompByPosition = useCallback(
    (position) => {
      const row = ratesByPosition.get(String(position || "")) || null;

      return {
        salary: toNum(row?.salary),
        ecola: toNum(row?.ecola),
        transportation: toNum(row?.transportation),
      };
    },
    [ratesByPosition]
  );

  const value = useMemo(
    () => ({
      rates,
      loading,
      error,
      refresh,
      ratesByPosition,
      getCompByPosition,
    }),
    [rates, loading, error, refresh, ratesByPosition, getCompByPosition]
  );

  return (
    <CompRatesContext.Provider value={value}>
      {children}
    </CompRatesContext.Provider>
  );
};

export const useCompRates = () => {
  const ctx = useContext(CompRatesContext);

  if (!ctx) {
    throw new Error("useCompRates must be used inside <CompRatesProvider>");
  }

  return ctx;
};