import React, { useEffect, useMemo, useState, useCallback } from "react";
import * as XLSX from "xlsx";
import "../styles/ScheduleBalances.css";
import api from "../api/axiosClient";

const MONEY_COLS = [
  { key: "cbu", label: "CBU" },
  { key: "cashbond", label: "Cashbond" },
  { key: "utility", label: "Utility" },
  { key: "salary_loan", label: "Salary Loan" },
  { key: "salary_advance", label: "Salary Advance" },
  { key: "motorcycle_loan", label: "Motorcycle Loan" },
  { key: "special_advance", label: "Special Advance" },
  { key: "cash_advance", label: "Cash Advance" },
  { key: "other_receivable", label: "Other Receivable" },
  { key: "staff_accounts_payable", label: "Staff Accounts Payable" },
];

const toStr = (v) => String(v ?? "").trim();

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const fmtMoney = (v) =>
  `₱ ${toNum(v).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const getCurrentMonth = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}`;
};

const readUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
};

const displayName = (r) => {
  const ln = toStr(r?.last_name);
  const fn = toStr(r?.first_name);
  const mn = toStr(r?.middle_name);
  const built = `${ln}${ln && fn ? ", " : ""}${fn}${mn ? ` ${mn}` : ""}`.replace(/\s+/g, " ").trim();
  return built || toStr(r?.fullname) || "-";
};

export default function ScheduleBalances() {
  const user = useMemo(() => readUser(), []);
  const isAdmin = String(user?.role || "").trim().toLowerCase() === "admin";

  const [rows, setRows] = useState([]);
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [month, setMonth] = useState(getCurrentMonth());

  const [loading, setLoading] = useState(false);
  const [savingSnap, setSavingSnap] = useState(false);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [viewBranch, setViewBranch] = useState(null);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/login";
  }, []);

  const fetchBranches = useCallback(async () => {
    try {
      const res = await api.get("/branches");
      setBranches(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      if (err?.response?.status === 401) logout();
      setBranches([]);
    }
  }, [logout]);

  const branchMap = useMemo(() => {
    const m = new Map();
    (branches || []).forEach((b) => m.set(String(b.id), b));
    return m;
  }, [branches]);

  const branchLabel = useCallback(
    (branchId) => {
      const b = branchMap.get(String(branchId));
      return b ? `${b.code} - ${b.name}` : String(branchId || "-");
    },
    [branchMap]
  );

  const fetchLiveBalances = useCallback(
    async (branchId = selectedBranch, m = month) => {
      if (!m) return;

      setLoading(true);
      try {
        const res = await api.get("/schedule-balances/live", {
          params: {
            month: m,
            ...(branchId ? { branchId } : {}),
          },
        });

        setRows(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        if (err?.response?.status === 401) logout();
        setRows([]);
      } finally {
        setLoading(false);
      }
    },
    [logout, selectedBranch, month]
  );

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  useEffect(() => {
    fetchLiveBalances(selectedBranch, month);
  }, [selectedBranch, month, fetchLiveBalances]);

  useEffect(() => {
    if (!viewBranch) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") setViewBranch(null);
    };

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [viewBranch]);

  const handleSearch = () => setSearch(searchInput);

  const handleClear = () => {
    setSearch("");
    setSearchInput("");
    setSelectedBranch("");
  };

  const handleRefresh = () => fetchLiveBalances(selectedBranch, month);

  const saveSnapshotFromCurrent = async () => {
    if (!isAdmin) return alert("Admin only.");
    if (!month) return alert("Select month first.");
    if (!window.confirm(`Save snapshot for ${month}? This will overwrite if already saved.`)) return;

    setSavingSnap(true);
    try {
      await api.post("/schedule-balances/snapshot/from-current", { month });
      alert("Snapshot saved.");
    } catch (err) {
      if (err?.response?.status === 401) return logout();
      if (err?.response?.status === 403) return alert("Access denied.");
      alert(err?.response?.data?.message || "Failed to save snapshot.");
    } finally {
      setSavingSnap(false);
    }
  };

  const filteredEmployeeRows = useMemo(() => {
    const q = toStr(search).toLowerCase();
    if (!q) return rows;

    return rows.filter((r) => {
      const hay = [
        r.staff_id,
        r.employee_id,
        r.fullname,
        displayName(r),
        r.position,
        branchLabel(r.branch_id),
      ]
        .map((x) => String(x ?? "").toLowerCase())
        .join(" ");

      return hay.includes(q);
    });
  }, [rows, search, branchLabel]);

  const groupedBranches = useMemo(() => {
    const map = new Map();

    for (const r of filteredEmployeeRows) {
      const key = String(r.branch_id || "unassigned");

      const existing = map.get(key) || {
        branch_id: r.branch_id || "",
        branch_label: branchLabel(r.branch_id),
        staff_count: 0,
        staff_rows: [],
        cbu: 0,
        cashbond: 0,
        utility: 0,
        salary_loan: 0,
        salary_advance: 0,
        motorcycle_loan: 0,
        special_advance: 0,
        cash_advance: 0,
        other_receivable: 0,
        staff_accounts_payable: 0,
      };

      existing.staff_count += 1;
      existing.staff_rows.push(r);

      for (const c of MONEY_COLS) {
        existing[c.key] += toNum(r[c.key]);
      }

      map.set(key, existing);
    }

    return Array.from(map.values()).sort((a, b) => a.branch_label.localeCompare(b.branch_label));
  }, [filteredEmployeeRows, branchLabel]);

  const totals = useMemo(() => {
    const t = Object.fromEntries(MONEY_COLS.map((c) => [c.key, 0]));
    for (const row of groupedBranches) {
      for (const c of MONEY_COLS) {
        t[c.key] += toNum(row[c.key]);
      }
    }
    return t;
  }, [groupedBranches]);

  const totalStaffCount = useMemo(
    () => groupedBranches.reduce((sum, r) => sum + Number(r.staff_count || 0), 0),
    [groupedBranches]
  );

  const exportToExcel = () => {
    const data = groupedBranches.map((r) => ({
      "Month Label": month,
      "Branch ID": r.branch_id ?? "",
      Branch: r.branch_label,
      "Staff Count": r.staff_count,
      CBU: toNum(r.cbu),
      Cashbond: toNum(r.cashbond),
      Utility: toNum(r.utility),
      "Salary Loan": toNum(r.salary_loan),
      "Salary Advance": toNum(r.salary_advance),
      "Motorcycle Loan": toNum(r.motorcycle_loan),
      "Special Advance": toNum(r.special_advance),
      "Cash Advance": toNum(r.cash_advance),
      "Other Receivable": toNum(r.other_receivable),
      "Staff Accounts Payable": toNum(r.staff_accounts_payable),
    }));

    data.unshift({
      "Month Label": month,
      "Branch ID": "",
      Branch: "TOTAL",
      "Staff Count": totalStaffCount,
      CBU: totals.cbu,
      Cashbond: totals.cashbond,
      Utility: totals.utility,
      "Salary Loan": totals.salary_loan,
      "Salary Advance": totals.salary_advance,
      "Motorcycle Loan": totals.motorcycle_loan,
      "Special Advance": totals.special_advance,
      "Cash Advance": totals.cash_advance,
      "Other Receivable": totals.other_receivable,
      "Staff Accounts Payable": totals.staff_accounts_payable,
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ScheduleBalancesByBranch");
    XLSX.writeFile(wb, `ScheduleBalances_ByBranch_${month}.xlsx`);
  };

  return (
    <div className="balances-page">
      <div className="balances-page-header">
        <div>
          <h2 className="balances-title">Schedule of Balances</h2>
          <p className="balances-subtitle">Per-branch balances from current transactions and staff balances.</p>
        </div>

        <div className="balances-actions">
          <input className="search-input" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />

          <input
            className="search-input"
            type="text"
            placeholder="Search staff id, employee id, name, or position..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />

          <select className="branch-select" value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)}>
            <option value="">All Branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.code} - {b.name}
              </option>
            ))}
          </select>

          <button className="btn-secondary" onClick={handleSearch} type="button">
            Search
          </button>

          <button className="btn-secondary" onClick={handleClear} type="button">
            Clear
          </button>

          <button className="btn-secondary" onClick={handleRefresh} type="button" disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>

          {isAdmin && (
            <button className="btn-primary" onClick={saveSnapshotFromCurrent} type="button" disabled={savingSnap}>
              {savingSnap ? "Saving..." : "Save Snapshot"}
            </button>
          )}

          <button className="btn-primary" onClick={exportToExcel} type="button" disabled={groupedBranches.length === 0}>
            Export Excel
          </button>
        </div>
      </div>

      <div className="balances-card">
        <div className="balances-card-header">
          <div className="balances-card-title">
            Branch Records <span className="balances-count">{groupedBranches.length}</span>
            <span style={{ marginLeft: 10, fontSize: 12, opacity: 0.8 }}>
              Month Label: <b>{month || "-"}</b> • Branch: <b>{selectedBranch ? branchLabel(selectedBranch) : "All"}</b>
            </span>
          </div>
          {loading && <div className="balances-loading">Loading…</div>}
        </div>

        <div className="balances-table-wrapper">
          <table className="balances-table">
            <thead>
              <tr>
                <th>Branch</th>
                <th>Staff Count</th>
                {MONEY_COLS.map((c) => (
                  <th key={c.key}>{c.label}</th>
                ))}
                <th>Action</th>
              </tr>

              {!loading && groupedBranches.length > 0 && (
                <tr className="totals-row">
                  <th className="totals-label">TOTAL</th>
                  <th className="totals-money">{totalStaffCount}</th>

                  {MONEY_COLS.map((c) => (
                    <th key={c.key} className="totals-money">
                      {fmtMoney(totals[c.key])}
                    </th>
                  ))}

                  <th></th>
                </tr>
              )}
            </thead>

            <tbody>
              {!loading && groupedBranches.length === 0 ? (
                <tr>
                  <td colSpan={MONEY_COLS.length + 3} className="empty-state">
                    No data found.
                  </td>
                </tr>
              ) : (
                groupedBranches.map((item, idx) => (
                  <tr key={`${item.branch_id}-${idx}`}>
                    <td className="td-strong">{item.branch_label}</td>
                    <td>{item.staff_count}</td>

                    {MONEY_COLS.map((c) => (
                      <td key={c.key} className="td-money">
                        {fmtMoney(item[c.key])}
                      </td>
                    ))}

                    <td>
                      <button className="btn-secondary" type="button" onClick={() => setViewBranch(item)}>
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {viewBranch && (
        <div
          className="modal-overlay"
          onMouseDown={(e) => e.target.classList.contains("modal-overlay") && setViewBranch(null)}
        >
          <div
            className="modal saas-modal"
            style={{ maxWidth: 1200, width: "95vw" }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <h3 className="modal-title">{viewBranch.branch_label}</h3>
                <p className="modal-subtitle">Staff assigned to this branch</p>
              </div>
              <button className="modal-x" type="button" onClick={() => setViewBranch(null)}>
                ✕
              </button>
            </div>

            <div className="table-card">
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Staff ID</th>
                      <th>Employee ID</th>
                      <th>Full Name</th>
                      <th>Position</th>
                      {MONEY_COLS.map((c) => (
                        <th key={c.key}>{c.label}</th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {viewBranch.staff_rows.length === 0 ? (
                      <tr>
                        <td colSpan={MONEY_COLS.length + 4} className="empty-state">
                          No staff found.
                        </td>
                      </tr>
                    ) : (
                      viewBranch.staff_rows.map((r, idx) => (
                        <tr key={`${r.staff_id}-${idx}`}>
                          <td>{r.staff_id ?? "-"}</td>
                          <td>{r.employee_id ?? "-"}</td>
                          <td className="td-strong">{displayName(r)}</td>
                          <td>{r.position ?? "-"}</td>

                          {MONEY_COLS.map((c) => (
                            <td key={c.key} className="td-money">
                              {fmtMoney(r[c.key])}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="modal-buttons">
              <button className="btn-secondary" type="button" onClick={() => setViewBranch(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}