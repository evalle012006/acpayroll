import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import api from "../api/axiosClient";

const toNum = (v) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const hasAuth = () => {
  const token = localStorage.getItem("token");
  const user = localStorage.getItem("user");
  return !!token && !!user;
};

const CompRatesContext = createContext(null);

export const CompRatesProvider = ({ children }) => {
  const [rates, setRates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    // ✅ don't fetch if not logged in
    if (!hasAuth()) {
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

      // ✅ if token missing/expired, don't show error spam
      if (status === 401) {
        setRates([]);
        setError("");
      } else {
        setRates([]);
        setError(e?.response?.data?.message || "Failed to load compensation rates");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // initial load (only if logged in)
    refresh();

    // ✅ re-fetch after login/logout changes
    const onAuthChanged = () => refresh();
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

  return <CompRatesContext.Provider value={value}>{children}</CompRatesContext.Provider>;
};

export const useCompRates = () => {
  const ctx = useContext(CompRatesContext);
  if (!ctx) throw new Error("useCompRates must be used inside <CompRatesProvider>");
  return ctx;
};