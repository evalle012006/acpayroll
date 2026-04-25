import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import api from "../api/axiosClient";
import "../styles/Consolidation.css";

const toNum = (v) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const toStr = (v) => String(v ?? "").trim();
const norm = (v) => toStr(v).toLowerCase();
const fmtDate = (v) => (v ? String(v).split("T")[0] : "-");

const MONTHS = [
  { key: "01", label: "January" },
  { key: "02", label: "February" },
  { key: "03", label: "March" },
  { key: "04", label: "April" },
  { key: "05", label: "May" },
  { key: "06", label: "June" },
  { key: "07", label: "July" },
  { key: "08", label: "August" },
  { key: "09", label: "September" },
  { key: "10", label: "October" },
  { key: "11", label: "November" },
  { key: "12", label: "December" },
];

const displayName = (row) => {
  const ln = toStr(row?.last_name);
  const fn = toStr(row?.first_name);
  const mn = toStr(row?.middle_name);

  const built = `${ln}${ln && fn ? ", " : ""}${fn}${mn ? ` ${mn}` : ""}`
    .replace(/\s+/g, " ")
    .trim();

  return built || toStr(row?.fullname) || "-";
};

const uniqueSorted = (arr) =>
  Array.from(new Set(arr.map(toStr).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b)
  );

const POSITION_ORDER = [
  "president",
  "senior vice president",
  "vice president",
  "assistant vice president",
  "regional manager",
  "acting regional manager",
  "area manager",
  "acting area manager",
  "branch manager",
  "acting branch manager",
  "loan officer",
  "probationary loan officer",
];

const getPositionRank = (position) => {
  const value = norm(position);
  const idx = POSITION_ORDER.indexOf(value);
  return idx === -1 ? 999 : idx;
};

const monthStartDate = (year, monthKey) => `${year}-${monthKey}-01`;

const getMonthlyRate = (row, historyRows, year, monthKey) => {
  const today = new Date();
  const nowYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  const monthNum = Number(monthKey);

  if (year === nowYear && monthNum > currentMonth) {
    return {
      salary: null,
      ecola: null,
    };
  }

  const monthDate = monthStartDate(year, monthKey);

  const validHistory = Array.isArray(historyRows)
    ? historyRows
        .filter(
          (h) =>
            toStr(h.effective_date) &&
            String(h.effective_date).slice(0, 10) <= monthDate
        )
        .sort((a, b) =>
          String(a.effective_date)
            .slice(0, 10)
            .localeCompare(String(b.effective_date).slice(0, 10))
        )
    : [];

  const latest = validHistory[validHistory.length - 1];

  return {
    salary: latest ? toNum(latest.salary) : toNum(row.salary),
    ecola: latest ? toNum(latest.ecola) : toNum(row.ecola),
  };
};

export default function Consolidation() {
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();

  const [selectedYear, setSelectedYear] = useState(currentYear);

  const [staff, setStaff] = useState([]);
  const [branches, setBranches] = useState([]);
  const [salaryHistoryMap, setSalaryHistoryMap] = useState({});
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [search, setSearch] = useState("");

  const [branchFilter, setBranchFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const fetchSources = async () => {
    try {
      setLoadingStaff(true);

      const [staffRes, branchesRes] = await Promise.all([
        api.get("/staff"),
        api.get("/branches"),
      ]);

      const staffRows = Array.isArray(staffRes.data) ? staffRes.data : [];
      setStaff(staffRows);
      setBranches(Array.isArray(branchesRes.data) ? branchesRes.data : []);

      const historyPairs = await Promise.all(
        staffRows
          .filter((s) => toStr(s.employee_no))
          .map(async (s) => {
            try {
              const res = await api.get(
                `/salary-history/${encodeURIComponent(s.employee_no)}`
              );
              return [
                String(s.employee_no),
                Array.isArray(res.data) ? res.data : [],
              ];
            } catch {
              return [String(s.employee_no), []];
            }
          })
      );

      setSalaryHistoryMap(Object.fromEntries(historyPairs));
    } catch (err) {
      console.error("Failed to fetch:", err);
      alert("Failed to load staff list.");
    } finally {
      setLoadingStaff(false);
    }
  };

  useEffect(() => {
    fetchSources();
  }, []);

  const branchMap = useMemo(() => {
    const map = new Map();
    branches.forEach((b) => map.set(String(b.id), b));
    return map;
  }, [branches]);

  const enrichedStaff = useMemo(() => {
    return staff.map((s) => {
      const branch = branchMap.get(String(s.branch_id));

      const branchCode = toStr(branch?.code);
      const branchName = toStr(branch?.name);
      const branchLabel =
        branchCode || branchName ? `${branchCode} - ${branchName}`.trim() : "-";

      return {
        ...s,
        _branchCode: branchCode,
        _branchName: branchName,
        _branchLabel: branchLabel,
        _status: toStr(s.status || "Active"),
      };
    });
  }, [staff, branchMap]);

  const branchOptions = useMemo(() => {
    return uniqueSorted(enrichedStaff.map((s) => s._branchLabel));
  }, [enrichedStaff]);

  const filteredStaff = useMemo(() => {
    const q = search.toLowerCase().trim();

    const filtered = enrichedStaff.filter((s) => {
      if (branchFilter && norm(s._branchLabel) !== norm(branchFilter)) return false;

      const status = norm(s._status || "active");
      if (statusFilter !== "All" && status !== norm(statusFilter)) return false;

      const hay =
        `${s.employee_no} ${displayName(s)} ${s.position} ${s._branchLabel} ${s.tin_no} ${status}`.toLowerCase();

      return !q || hay.includes(q);
    });

    return [...filtered].sort((a, b) => {
      const rankA = getPositionRank(a.position);
      const rankB = getPositionRank(b.position);

      if (rankA !== rankB) return rankA - rankB;

      return displayName(a).localeCompare(displayName(b));
    });
  }, [enrichedStaff, search, branchFilter, statusFilter]);

  const buildExportRows = () => {
    return filteredStaff.map((row, i) => {
      const historyRows = salaryHistoryMap[String(row.employee_no)] || [];

      let totalSalary = 0;
      let totalEcola = 0;

      const exportRow = {
        ID: i + 1,
        "Employee No": row.employee_no || "-",
        Name: displayName(row),
        Position: row.position || "-",
        Branch: row._branchLabel || "-",
        Status: row._status || "-",
        "Start Date": fmtDate(row.start_date),
        Regularization: fmtDate(row.regularization_date),
        TIN: row.tin_no || "-",
        Tax: toNum(row.tax),
      };

      MONTHS.forEach((m) => {
        const rate = getMonthlyRate(row, historyRows, selectedYear, m.key);

        if (rate.salary !== null) totalSalary += rate.salary;
        if (rate.ecola !== null) totalEcola += rate.ecola;

        exportRow[`${m.label} Salary`] =
          rate.salary === null ? "-" : rate.salary;
        exportRow[`${m.label} ECOLA`] =
          rate.ecola === null ? "-" : rate.ecola;
      });

      exportRow["Total Salary"] = totalSalary;
      exportRow["Total ECOLA"] = totalEcola;
      exportRow["Total Compensation"] = totalSalary + totalEcola;

      return exportRow;
    });
  };

  const exportExcel = () => {
    const rows = buildExportRows();

    if (!rows.length) {
      alert("No data to export.");
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();

    worksheet["!cols"] = Object.keys(rows[0]).map((key) => ({
      wch: Math.max(14, key.length + 2),
    }));

    XLSX.utils.book_append_sheet(workbook, worksheet, "2316 Consolidation");
    XLSX.writeFile(workbook, `2316-Consolidation-${selectedYear}.xlsx`);
  };

  const clearFilters = () => {
    setBranchFilter("");
    setStatusFilter("All");
    setSearch("");
  };

  return (
    <div className="sys-page">
      <div className="sys-header">
        <div>
          <h2 className="sys-title">2316 Consolidation</h2>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            className="conso-btn conso-btn-secondary"
            onClick={exportExcel}
            type="button"
          >
            Export Excel
          </button>

          <button
            className="conso-btn conso-btn-secondary"
            onClick={() => navigate("/system-update")}
            type="button"
          >
            ← Back
          </button>
        </div>
      </div>

      <div className="sys-card conso-card">
        <div className="sys-card-body">
          <div className="conso-filters-grid">
            <select
              className="conso-input"
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
            >
              {Array.from({ length: 8 }).map((_, i) => {
                const year = currentYear - i;
                return (
                  <option key={year} value={year}>
                    Year: {year}
                  </option>
                );
              })}
            </select>

            <input
              className="conso-input"
              list="branch-list"
              placeholder="Branch..."
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
            />
            <datalist id="branch-list">
              {branchOptions.map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>

            <select
              className="conso-input"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="All">Status: All</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>

          <div className="conso-search-row">
            <input
              className="conso-input conso-search-grow"
              type="text"
              placeholder="Search employee..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <button
              className="conso-btn conso-btn-secondary"
              onClick={clearFilters}
              type="button"
            >
              Clear
            </button>
          </div>

          {loadingStaff ? (
            <p className="sys-mini">Loading staff list...</p>
          ) : (
            <div className="conso-payroll-wrap">
              <table className="conso-payroll-table">
                <thead>
                  <tr>
                    <th rowSpan={2}>ID</th>
                    <th rowSpan={2}>Employee No</th>
                    <th rowSpan={2}>Name</th>
                    <th rowSpan={2}>Position</th>
                    <th rowSpan={2}>Branch</th>
                    <th rowSpan={2}>Status</th>
                    <th rowSpan={2}>Start Date</th>
                    <th rowSpan={2}>Regularization</th>
                    <th rowSpan={2}>TIN</th>
                    <th rowSpan={2}>Tax</th>

                    {MONTHS.map((m) => (
                      <th key={m.key} colSpan={2}>
                        {m.label}
                      </th>
                    ))}

                    <th rowSpan={2}>Total Salary</th>
                    <th rowSpan={2}>Total ECOLA</th>
                    <th rowSpan={2}>Total Compensation</th>
                  </tr>

                  <tr>
                    {MONTHS.map((m) => (
                      <React.Fragment key={m.key}>
                        <th>Salary</th>
                        <th>ECOLA</th>
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {filteredStaff.map((row, i) => {
                    const historyRows = salaryHistoryMap[String(row.employee_no)] || [];

                    let totalSalary = 0;
                    let totalEcola = 0;

                    const monthlyValues = MONTHS.map((m) => {
                      const rate = getMonthlyRate(
                        row,
                        historyRows,
                        selectedYear,
                        m.key
                      );

                      if (rate.salary !== null) totalSalary += rate.salary;
                      if (rate.ecola !== null) totalEcola += rate.ecola;

                      return rate;
                    });

                    const totalComp = totalSalary + totalEcola;

                    return (
                      <tr key={row.id}>
                        <td>{i + 1}</td>
                        <td>{row.employee_no || "-"}</td>
                        <td>{displayName(row)}</td>
                        <td>{row.position || "-"}</td>
                        <td>{row._branchLabel}</td>
                        <td>{row._status}</td>
                        <td>{fmtDate(row.start_date)}</td>
                        <td>{fmtDate(row.regularization_date)}</td>
                        <td>{row.tin_no || "-"}</td>
                        <td>{toNum(row.tax).toLocaleString()}</td>

                        {monthlyValues.map((rate, idx) => (
                          <React.Fragment key={idx}>
                            <td>
                              {rate.salary === null
                                ? "-"
                                : rate.salary.toLocaleString()}
                            </td>
                            <td>
                              {rate.ecola === null
                                ? "-"
                                : rate.ecola.toLocaleString()}
                            </td>
                          </React.Fragment>
                        ))}

                        <td>{totalSalary.toLocaleString()}</td>
                        <td>{totalEcola.toLocaleString()}</td>
                        <td>{totalComp.toLocaleString()}</td>
                      </tr>
                    );
                  })}

                  {filteredStaff.length === 0 && (
                    <tr>
                      <td colSpan={37}>No staff found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}