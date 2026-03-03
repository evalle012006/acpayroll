import React, { useEffect, useMemo, useState, useCallback } from "react";
import * as XLSX from "xlsx";
import "../styles/ScheduleBalances.css";
import api from "../api/axiosClient";

const MONEY_COLS = [
  { key: "cbu", label: "CBU" },
  { key: "cashbond", label: "Cashbond" },
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
  `₱ ${toNum(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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
    (branches || []).forEach((b) => m.set(Number(b.id), b));
    return m;
  }, [branches]);

  const fetchSnapshots = useCallback(
    async (branchId = selectedBranch, m = month) => {
      if (!m) return;

      setLoading(true);
      try {
        const res = await api.get("/schedule-balances", {
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
    [logout, month, selectedBranch]
  );

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  useEffect(() => {
    fetchSnapshots(selectedBranch, month);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  const handleBranchChange = (e) => {
    const branchId = e.target.value;
    setSelectedBranch(branchId);
    fetchSnapshots(branchId, month);
  };

  const handleSearch = () => setSearch(searchInput);
  const handleClear = () => {
    setSearch("");
    setSearchInput("");
  };

  const handleRefresh = () => fetchSnapshots(selectedBranch, month);

  const saveSnapshotFromCurrent = async () => {
    if (!isAdmin) return alert("Admin only.");
    if (!month) return alert("Select month first.");
    if (!window.confirm(`Save snapshot for ${month}? This will overwrite if already saved.`)) return;

    setSavingSnap(true);
    try {
      await api.post("/schedule-balances/snapshot/from-current", { month });
      alert("Snapshot saved.");
      await fetchSnapshots(selectedBranch, month);
    } catch (err) {
      if (err?.response?.status === 401) return logout();
      if (err?.response?.status === 403) return alert("Access denied.");
      alert(err?.response?.data?.message || "Failed to save snapshot.");
    } finally {
      setSavingSnap(false);
    }
  };

  const filteredRows = useMemo(() => {
    const list = Array.isArray(rows) ? rows : [];
    const q = (search || "").toLowerCase().trim();
    if (!q) return list;

    return list.filter((r) => {
      const hay = [
        r.employee_id,
        r.staff_id ?? r.id,
        r.position,
        r.fullname,
        r.last_name,
        r.first_name,
        r.middle_name,
        displayName(r),
      ]
        .map((x) => String(x ?? "").toLowerCase())
        .join(" ");

      return hay.includes(q);
    });
  }, [rows, search]);

  const totals = useMemo(() => {
    const t = Object.fromEntries(MONEY_COLS.map((c) => [c.key, 0]));
    for (const r of filteredRows) {
      for (const c of MONEY_COLS) t[c.key] += toNum(r?.[c.key]);
    }
    return t;
  }, [filteredRows]);

  const exportToExcel = () => {
    const data = filteredRows.map((r) => {
      const bid = r.branch_id ? Number(r.branch_id) : null;
      const b = bid ? branchMap.get(bid) : null;

      return {
        "Snapshot Month": month,
        "Staff ID": r.staff_id ?? r.id ?? "",
        "Employee ID": r.employee_id ?? "",
        "Full Name": displayName(r),
        Position: r.position ?? "",
        "Branch ID": bid ?? "",
        Branch: b ? `${b.code} - ${b.name}` : "",
        CBU: toNum(r.cbu),
        Cashbond: toNum(r.cashbond),
        "Salary Advance": toNum(r.salary_advance),
        "Motorcycle Loan": toNum(r.motorcycle_loan),
        "Special Advance": toNum(r.special_advance),
        "Cash Advance": toNum(r.cash_advance),
        "Other Receivable": toNum(r.other_receivable),
        "Staff Accounts Payable": toNum(r.staff_accounts_payable),
      };
    });

    data.push({
      "Snapshot Month": month,
      "Staff ID": "",
      "Employee ID": "",
      "Full Name": "TOTAL",
      Position: "",
      "Branch ID": "",
      Branch: "",
      CBU: totals.cbu,
      Cashbond: totals.cashbond,
      "Salary Advance": totals.salary_advance,
      "Motorcycle Loan": totals.motorcycle_loan,
      "Special Advance": totals.special_advance,
      "Cash Advance": totals.cash_advance,
      "Other Receivable": totals.other_receivable,
      "Staff Accounts Payable": totals.staff_accounts_payable,
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ScheduleBalances");

    const branchObj = branches.find((b) => String(b.id) === String(selectedBranch));
    const fileName = branchObj
      ? `ScheduleBalances_${month}_${branchObj.code}_${branchObj.name}.xlsx`
      : `ScheduleBalances_${month}_AllBranches.xlsx`;

    XLSX.writeFile(wb, fileName);
  };

  const branchLabel = (branchId) => {
    const bid = branchId ? Number(branchId) : null;
    if (!bid) return "-";
    const b = branchMap.get(bid);
    return b ? `${b.code} - ${b.name}` : String(bid);
  };

  return (
    <div className="balances-page">
      <div className="balances-page-header">
        <div>
          <h2 className="balances-title">Schedule of Balances</h2>
          <p className="balances-subtitle">Monthly stored (bank record). Select month and branch to view.</p>
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

          <select className="branch-select" value={selectedBranch} onChange={handleBranchChange}>
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

          <button className="btn-primary" onClick={exportToExcel} type="button" disabled={filteredRows.length === 0}>
            Export Excel
          </button>
        </div>
      </div>

      <div className="balances-card">
        <div className="balances-card-header">
          <div className="balances-card-title">
            Records <span className="balances-count">{filteredRows.length}</span>
            <span style={{ marginLeft: 10, fontSize: 12, opacity: 0.8 }}>
              Month: <b>{month || "-"}</b> • Branch: <b>{selectedBranch ? branchLabel(selectedBranch) : "All"}</b>
            </span>
          </div>
          {loading && <div className="balances-loading">Loading…</div>}
        </div>

        <div className="balances-table-wrapper">
          <table className="balances-table">
            <thead>
              <tr>
                <th>Staff ID</th>
                <th>Employee ID</th>
                <th>Full Name</th>
                <th>Position</th>
                <th>Branch</th>
                {MONEY_COLS.map((c) => (
                  <th key={c.key}>{c.label}</th>
                ))}
              </tr>
            </thead>

            <tbody>
              {!loading && filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={5 + MONEY_COLS.length} className="empty-state">
                    No Data for this Month.
                    <div style={{ marginTop: 8, fontSize: 12, opacity: 0.85 }}>
                      {isAdmin ? "Tip: Click “Save Snapshot” to store current balances for this month." : ""}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRows.map((item, idx) => (
                  <tr key={item.id ?? `${item.staff_id}-${idx}`}>
                    <td>{item.staff_id ?? "-"}</td>
                    <td>{item.employee_id ?? "-"}</td>
                    <td className="td-strong">{displayName(item)}</td>
                    <td>{item.position ?? "-"}</td>
                    <td>{branchLabel(item.branch_id)}</td>
                    {MONEY_COLS.map((c) => (
                      <td key={c.key} className="td-money">
                        {fmtMoney(item?.[c.key])}
                      </td>
                    ))}
                  </tr>
                ))
              )}

              {!loading && filteredRows.length > 0 && (
                <tr className="totals-row">
                  <td colSpan={5} className="totals-label">
                    TOTAL
                  </td>
                  {MONEY_COLS.map((c) => (
                    <td key={c.key} className="totals-money">
                      {fmtMoney(totals[c.key])}
                    </td>
                  ))}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}