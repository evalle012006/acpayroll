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

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const fmtMoney = (v) =>
  `₱ ${toNum(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (v) => {
  if (!v) return "-";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleDateString();
};

const ScheduleBalances = () => {
  const [rows, setRows] = useState([]);
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [loading, setLoading] = useState(false);

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
      setBranches(res.data || []);
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401) logout();
      setBranches([]);
    }
  }, [logout]);

  const fetchStaffBalances = useCallback(
    async (branchId = "") => {
      try {
        setLoading(true);
        const res = await api.get("/staff-balances", {
          params: branchId ? { branchId } : {},
        });
        setRows(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        const status = err?.response?.status;
        if (status === 401) logout();
        setRows([]);
      } finally {
        setLoading(false);
      }
    },
    [logout]
  );

  useEffect(() => {
    fetchBranches();
    fetchStaffBalances("");
  }, [fetchBranches, fetchStaffBalances]);

  const handleBranchChange = (e) => {
    const branchId = e.target.value;
    setSelectedBranch(branchId);
    fetchStaffBalances(branchId);
  };

  const handleSearch = () => setSearch(searchInput);
  const handleClear = () => {
    setSearch("");
    setSearchInput("");
  };

  const filteredRows = useMemo(() => {
    const list = Array.isArray(rows) ? rows : [];
    const q = (search || "").toLowerCase().trim();
    if (!q) return list;

    return list.filter((r) => {
      const empId = String(r.employee_id ?? "").toLowerCase();
      const name = String(r.fullname ?? "").toLowerCase();
      const pos = String(r.position ?? "").toLowerCase();
      return empId.includes(q) || name.includes(q) || pos.includes(q);
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
    const data = filteredRows.map((r) => ({
      ID: r.id,
      "Employee ID": r.employee_id,
      "Full Name": r.fullname,
      Position: r.position || "",
      "Regularization Date": r.regularization_date ? String(r.regularization_date).split("T")[0] : "",
      CBU: toNum(r.cbu),
      Cashbond: toNum(r.cashbond),
      "Salary Advance": toNum(r.salary_advance),
      "Motorcycle Loan": toNum(r.motorcycle_loan),
      "Special Advance": toNum(r.special_advance),
      "Cash Advance": toNum(r.cash_advance),
      "Other Receivable": toNum(r.other_receivable),
      "Staff Accounts Payable": toNum(r.staff_accounts_payable),
    }));

    data.push({
      ID: "",
      "Employee ID": "",
      "Full Name": "TOTAL",
      Position: "",
      "Regularization Date": "",
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
    const fileName = branchObj ? `ScheduleBalances_${branchObj.code}_${branchObj.name}.xlsx` : "ScheduleBalances_AllBranches.xlsx";

    XLSX.writeFile(wb, fileName);
  };

  return (
    <div className="balances-page">
      <div className="balances-page-header">
        <div>
          <h2 className="balances-title">Schedule of Balances</h2>
          <p className="balances-subtitle">Search staff balances and export reports</p>
        </div>

        <div className="balances-actions">
          <input
            className="search-input"
            type="text"
            placeholder="Search employee id, name, or position..."
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

          <button className="btn-secondary" onClick={handleSearch} type="button">Search</button>
          <button className="btn-secondary" onClick={handleClear} type="button">Clear</button>
          <button className="btn-primary" onClick={exportToExcel} type="button">Export Excel</button>
        </div>
      </div>

      <div className="balances-card">
        <div className="balances-card-header">
          <div className="balances-card-title">
            Records <span className="balances-count">{filteredRows.length}</span>
          </div>
          {loading && <div className="balances-loading">Loading…</div>}
        </div>

        <div className="balances-table-wrapper">
          <table className="balances-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Employee ID</th>
                <th>Full Name</th>
                <th>Position</th>
                <th>Regularization Date</th>
                {MONEY_COLS.map((c) => (
                  <th key={c.key}>{c.label}</th>
                ))}
              </tr>
            </thead>

            <tbody>
              {!loading && filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={5 + MONEY_COLS.length} className="empty-state">
                    No data available
                  </td>
                </tr>
              ) : (
                filteredRows.map((item, idx) => (
                  <tr key={item.id ?? `${item.employee_id}-${idx}`}>
                    <td>{item.id}</td>
                    <td>{item.employee_id}</td>
                    <td className="td-strong">{item.fullname}</td>
                    <td>{item.position || "-"}</td>
                    <td>{fmtDate(item.regularization_date)}</td>
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
};

export default ScheduleBalances;