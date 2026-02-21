import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import "../styles/ScheduleBalances.css";

const API = "http://localhost:5000";

const ScheduleBalances = () => {
  const [rows, setRows] = useState([]);
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [loading, setLoading] = useState(false);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const toNum = (v) => Number(v ?? 0);

  const money = (v) =>
    `₱ ${toNum(v).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const toDate = (v) => {
    if (!v) return "-";
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? "-" : d.toLocaleDateString();
  };

  // ✅ money columns
  const moneyColumns = [
    { key: "cbu", label: "CBU" },
    { key: "cashbond", label: "Cashbond" },
    { key: "salary_advance", label: "Salary Advance" },
    { key: "motorcycle_loan", label: "Motorcycle Loan" },
    { key: "special_advance", label: "Special Advance" },
    { key: "cash_advance", label: "Cash Advance" },
    { key: "other_receivable", label: "Other Receivable" },
    { key: "staff_accounts_payable", label: "Staff Accounts Payable" },
  ];

  // ✅ search filter
  const filteredRows = useMemo(() => {
    if (!search) return rows;

    const q = search.toLowerCase();

    return rows.filter(
      (r) =>
        String(r.fullname || "").toLowerCase().includes(q) ||
        String(r.position || "").toLowerCase().includes(q)
    );
  }, [rows, search]);

  // ✅ totals based on filtered rows
  const totals = useMemo(() => {
    const t = {};
    for (const col of moneyColumns) t[col.key] = 0;

    for (const r of filteredRows) {
      for (const col of moneyColumns) {
        t[col.key] += toNum(r[col.key]);
      }
    }
    return t;
  }, [filteredRows]);

  // ✅ fetch branches
  const fetchBranches = async () => {
    try {
      const res = await axios.get(`${API}/branches`);
      setBranches(res.data || []);
    } catch (err) {
      console.error("Error fetching branches:", err);
    }
  };

  // ✅ fetch staff data (branch filter optional)
  const fetchStaffBalances = async (branchId = "") => {
    try {
      setLoading(true);
      const url = branchId ? `${API}/salary/${branchId}` : `${API}/staff`;
      const res = await axios.get(url);
      setRows(res.data || []);
    } catch (error) {
      console.error("Error fetching staff balances:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
    fetchStaffBalances();
  }, []);

  const handleBranchChange = (e) => {
    const branchId = e.target.value;
    setSelectedBranch(branchId);
    fetchStaffBalances(branchId);
  };

  // ✅ Export to Excel
  const exportToExcel = () => {
    const data = filteredRows.map((r) => ({
      ID: r.id,
      "Full Name": r.fullname,
      Position: r.position,
      "Regularization Date": r.regularization_date
        ? String(r.regularization_date).split("T")[0]
        : "",
      CBU: toNum(r.cbu),
      Cashbond: toNum(r.cashbond),
      "Salary Advance": toNum(r.salary_advance),
      "Motorcycle Loan": toNum(r.motorcycle_loan),
      "Special Advance": toNum(r.special_advance),
      "Cash Advance": toNum(r.cash_advance),
      "Other Receivable": toNum(r.other_receivable),
      "Staff Accounts Payable": toNum(r.staff_accounts_payable),
    }));

    // ✅ totals row
    data.push({
      ID: "",
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

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "ScheduleBalances");

    const branchObj = branches.find((b) => String(b.id) === String(selectedBranch));
    const fileName = branchObj
      ? `ScheduleBalances_${branchObj.code}_${branchObj.name}.xlsx`
      : "ScheduleBalances_AllBranches.xlsx";

    XLSX.writeFile(workbook, fileName);
  };

  return (
    <div className="balances-container">
      <h1>Schedule of Balances</h1>

      {/* TOP CONTROLS */}
      <div className="top-controls">
        {/* SEARCH LEFT */}
        <div className="search-box">
          <input
            type="text"
            placeholder="Search by name or position..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && setSearch(searchInput)}
          />
          <button className="btn btn-primary" onClick={() => setSearch(searchInput)}><span className="dot" />Search</button>
          <button className="btn btn-outline" onClick={() => {setSearch(""); setSearchInput("");}}>Clear</button>
            <button className="btn btn-primary" onClick={exportToExcel}>Export Excel</button>
        </div>

        {/* BRANCH RIGHT */}
        <div className="branch-selector">
          <label>Select Branch: </label>
          <select value={selectedBranch} onChange={handleBranchChange}>
            <option value="">All Branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.code} - {b.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <table className="balances-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Full Name</th>
              <th>Position</th>
              <th>Regularization Date</th>
              {moneyColumns.map((c) => (
                <th key={c.key}>{c.label}</th>
              ))}
            </tr>
          </thead>

          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td
                  colSpan={4 + moneyColumns.length}
                  style={{ textAlign: "center", padding: 20 }}
                >
                  No data available
                </td>
              </tr>
            ) : (
              filteredRows.map((item, idx) => (
                <tr key={item.id ?? `${item.fullname}-${idx}`}>
                  <td>{item.id}</td>
                  <td>{item.fullname}</td>
                  <td>{item.position || "-"}</td>
                  <td>{toDate(item.regularization_date)}</td>
                  {moneyColumns.map((c) => (
                    <td key={c.key}>{money(item[c.key])}</td>
                  ))}
                </tr>
              ))
            )}

            {/* ✅ TOTALS ROW (must follow filteredRows) */}
            {filteredRows.length > 0 && (
              <tr className="totals-row">
                <td colSpan={4} style={{ fontWeight: "bold", textAlign: "right" }}>
                  TOTAL
                </td>
                {moneyColumns.map((c) => (
                  <td key={c.key} style={{ fontWeight: "bold" }}>
                    {money(totals[c.key])}
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default ScheduleBalances;