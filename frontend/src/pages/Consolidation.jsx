import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axiosClient";
import "../styles/Consolidation.css";

const toNum = (v) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const toStr = (v) => String(v ?? "").trim();
const norm = (v) => toStr(v).toLowerCase();
const fmtDate = (v) => (v ? String(v).split("T")[0] : "-");

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

export default function Consolidation() {
  const navigate = useNavigate();

  const [staff, setStaff] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [search, setSearch] = useState("");

  const [divisionFilter, setDivisionFilter] = useState("");
  const [regionFilter, setRegionFilter] = useState("");
  const [areaFilter, setAreaFilter] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const fetchSources = async () => {
    try {
      setLoadingStaff(true);

      const [staffRes, branchesRes] = await Promise.all([
        api.get("/staff"),
        api.get("/branches"),
      ]);

      setStaff(Array.isArray(staffRes.data) ? staffRes.data : []);
      setBranches(Array.isArray(branchesRes.data) ? branchesRes.data : []);
    } catch (err) {
      console.error("Failed to fetch staff/branches:", err);
      alert("Failed to load staff source list.");
    } finally {
      setLoadingStaff(false);
    }
  };

  useEffect(() => {
    fetchSources();
  }, []);

  const branchMap = useMemo(() => {
    const map = new Map();
    branches.forEach((b) => {
      map.set(String(b.id), b);
    });
    return map;
  }, [branches]);

  const enrichedStaff = useMemo(() => {
    return staff.map((s) => {
      const branch = branchMap.get(String(s.branch_id));

      const division = toStr(s.division || branch?.division);
      const region = toStr(s.region || branch?.region);
      const area = toStr(s.area || branch?.area);
      const branchCode = toStr(branch?.code);
      const branchName = toStr(branch?.name);
      const branchLabel =
        branchCode || branchName ? `${branchCode} - ${branchName}`.trim() : "-";

      return {
        ...s,
        _division: division,
        _region: region,
        _area: area,
        _branchCode: branchCode,
        _branchName: branchName,
        _branchLabel: branchLabel,
        _status: toStr(s.status || "Active"),
      };
    });
  }, [staff, branchMap]);

  const divisionOptions = useMemo(() => {
    return uniqueSorted(enrichedStaff.map((s) => s._division));
  }, [enrichedStaff]);

  const regionOptions = useMemo(() => {
    return uniqueSorted(
      enrichedStaff
        .filter((s) => !divisionFilter || norm(s._division) === norm(divisionFilter))
        .map((s) => s._region)
    );
  }, [enrichedStaff, divisionFilter]);

  const areaOptions = useMemo(() => {
    return uniqueSorted(
      enrichedStaff
        .filter((s) => {
          if (divisionFilter && norm(s._division) !== norm(divisionFilter)) return false;
          if (regionFilter && norm(s._region) !== norm(regionFilter)) return false;
          return true;
        })
        .map((s) => s._area)
    );
  }, [enrichedStaff, divisionFilter, regionFilter]);

  const branchOptions = useMemo(() => {
    return uniqueSorted(
      enrichedStaff
        .filter((s) => {
          if (divisionFilter && norm(s._division) !== norm(divisionFilter)) return false;
          if (regionFilter && norm(s._region) !== norm(regionFilter)) return false;
          if (areaFilter && norm(s._area) !== norm(areaFilter)) return false;
          return true;
        })
        .map((s) => s._branchLabel)
    );
  }, [enrichedStaff, divisionFilter, regionFilter, areaFilter]);

  const totalBeforeSearch = useMemo(() => {
    return enrichedStaff.filter((s) => {
      if (divisionFilter && norm(s._division) !== norm(divisionFilter)) return false;
      if (regionFilter && norm(s._region) !== norm(regionFilter)) return false;
      if (areaFilter && norm(s._area) !== norm(areaFilter)) return false;
      if (branchFilter && norm(s._branchLabel) !== norm(branchFilter)) return false;

      const status = norm(s._status || "active");
      if (statusFilter !== "All" && status !== norm(statusFilter)) return false;

      return true;
    }).length;
  }, [
    enrichedStaff,
    divisionFilter,
    regionFilter,
    areaFilter,
    branchFilter,
    statusFilter,
  ]);

  const filteredStaff = useMemo(() => {
    const q = search.toLowerCase().trim();

    const filtered = enrichedStaff.filter((s) => {
      if (divisionFilter && norm(s._division) !== norm(divisionFilter)) return false;
      if (regionFilter && norm(s._region) !== norm(regionFilter)) return false;
      if (areaFilter && norm(s._area) !== norm(areaFilter)) return false;
      if (branchFilter && norm(s._branchLabel) !== norm(branchFilter)) return false;

      const status = norm(s._status || "active");
      if (statusFilter !== "All" && status !== norm(statusFilter)) return false;

      const employeeNo = toStr(s.employee_no);
      const employeeName = displayName(s);
      const position = toStr(s.position);
      const branchName = toStr(s._branchName);
      const branchCode = toStr(s._branchCode);
      const division = toStr(s._division);
      const region = toStr(s._region);
      const area = toStr(s._area);
      const tinNo = toStr(s.tin_no);

      const hay =
        `${employeeNo} ${employeeName} ${position} ${branchName} ${branchCode} ${division} ${region} ${area} ${status} ${tinNo}`.toLowerCase();

      return !q || hay.includes(q);
    });

    return [...filtered].sort((a, b) => {
      const rankA = getPositionRank(a.position);
      const rankB = getPositionRank(b.position);

      if (rankA !== rankB) return rankA - rankB;

      const posCompare = toStr(a.position).localeCompare(toStr(b.position));
      if (posCompare !== 0) return posCompare;

      const nameCompare = displayName(a).localeCompare(displayName(b));
      if (nameCompare !== 0) return nameCompare;

      return toStr(a.employee_no).localeCompare(toStr(b.employee_no));
    });
  }, [
    enrichedStaff,
    search,
    divisionFilter,
    regionFilter,
    areaFilter,
    branchFilter,
    statusFilter,
  ]);

  const totals = useMemo(() => {
    return filteredStaff.reduce(
      (acc, row) => {
        const salary = toNum(row.salary);
        const ecola = toNum(row.ecola);
        const sssEe = toNum(row.sss_ee);
        const philhealthEe = toNum(row.ph_ee ?? row.philhealth_ee);
        const pagibigEe = toNum(row.hdmf_ee ?? row.pagibig_ee);
        const tax = toNum(row.tax);

        acc.salary += salary;
        acc.ecola += ecola;
        acc.total_compensation += salary + ecola;

        acc.sss_ee += sssEe;
        acc.philhealth_ee += philhealthEe;
        acc.pagibig_ee += pagibigEe;
        acc.total_ee += sssEe + philhealthEe + pagibigEe;

        acc.tax += tax;
        return acc;
      },
      {
        salary: 0,
        ecola: 0,
        total_compensation: 0,
        sss_ee: 0,
        philhealth_ee: 0,
        pagibig_ee: 0,
        total_ee: 0,
        tax: 0,
      }
    );
  }, [filteredStaff]);

  const clearFilters = () => {
    setDivisionFilter("");
    setRegionFilter("");
    setAreaFilter("");
    setBranchFilter("");
    setStatusFilter("All");
    setSearch("");
  };

  return (
    <div className="sys-page">
      <div className="sys-header">
        <div>
          <h2 className="sys-title">2316 Consolidation</h2>
          <p className="sys-subtitle">
            Employee list result for 2316 consolidation reference.
          </p>
        </div>

        <button
          type="button"
          className="conso-btn conso-btn-secondary"
          onClick={() => navigate("/system-update")}
        >
          ← Back
        </button>
      </div>

      <div className="sys-card conso-card">
        <div className="sys-card-head">
          <div>
            <div className="sys-card-title">Employee List</div>
            <div className="sys-card-meta">
              Salary, employee contributions, and tax reference.
            </div>
          </div>
        </div>

        <div className="sys-card-body">
          <div className="conso-filters-grid">
            <input
              className="conso-input"
              list="conso-division-list"
              placeholder="Division..."
              value={divisionFilter}
              onChange={(e) => {
                setDivisionFilter(e.target.value);
                setRegionFilter("");
                setAreaFilter("");
                setBranchFilter("");
              }}
            />
            <datalist id="conso-division-list">
              {divisionOptions.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>

            <input
              className="conso-input"
              list="conso-region-list"
              placeholder="Region..."
              value={regionFilter}
              onChange={(e) => {
                setRegionFilter(e.target.value);
                setAreaFilter("");
                setBranchFilter("");
              }}
            />
            <datalist id="conso-region-list">
              {regionOptions.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>

            <input
              className="conso-input"
              list="conso-area-list"
              placeholder="Area..."
              value={areaFilter}
              onChange={(e) => {
                setAreaFilter(e.target.value);
                setBranchFilter("");
              }}
            />
            <datalist id="conso-area-list">
              {areaOptions.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>

            <input
              className="conso-input"
              list="conso-branch-list"
              placeholder="Branch..."
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
            />
            <datalist id="conso-branch-list">
              {branchOptions.map((item) => (
                <option key={item} value={item} />
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

          <div className="conso-summary">
            <div className="summary-card">
              <div className="summary-label">Salary</div>
              <div className="summary-value">{totals.salary.toLocaleString()}</div>
            </div>
            <div className="summary-card">
              <div className="summary-label">ECOLA</div>
              <div className="summary-value">{totals.ecola.toLocaleString()}</div>
            </div>
            <div className="summary-card">
              <div className="summary-label">Total Compensation</div>
              <div className="summary-value">{totals.total_compensation.toLocaleString()}</div>
            </div>
            <div className="summary-card">
              <div className="summary-label">SSS</div>
              <div className="summary-value">{totals.sss_ee.toLocaleString()}</div>
            </div>
            <div className="summary-card">
              <div className="summary-label">PH</div>
              <div className="summary-value">{totals.philhealth_ee.toLocaleString()}</div>
            </div>
            <div className="summary-card">
              <div className="summary-label">Pag-IBIG</div>
              <div className="summary-value">{totals.pagibig_ee.toLocaleString()}</div>
            </div>
            <div className="summary-card">
              <div className="summary-label">Total EE</div>
              <div className="summary-value">{totals.total_ee.toLocaleString()}</div>
            </div>
            <div className="summary-card">
              <div className="summary-label">Tax</div>
              <div className="summary-value">{totals.tax.toLocaleString()}</div>
            </div>
          </div>

          <div className="conso-search-row">
            <div className="pill">
              Total before search: <strong>{totalBeforeSearch}</strong>
            </div>

            <input
              className="conso-input conso-search-grow"
              type="text"
              placeholder="Search employee no, name, TIN, position, or branch..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <button
              type="button"
              className="conso-btn conso-btn-secondary"
              onClick={clearFilters}
            >
              Clear Filters
            </button>
          </div>

          {loadingStaff ? (
            <p className="sys-mini">Loading staff list...</p>
          ) : filteredStaff.length === 0 ? (
            <p className="sys-mini">No staff found.</p>
          ) : (
            <div className="conso-payroll-card">
              <div className="conso-payroll-head">
                <div>
                  <div className="conso-payroll-title">Consolidation:</div>
                  <div className="conso-payroll-sub">
                    Employees: {filteredStaff.length}
                  </div>
                </div>
              </div>

              <div className="conso-payroll-wrap">
                <table className="conso-payroll-table">
                  <thead>
                    <tr>
                      <th rowSpan={2}>ID</th>
                      <th rowSpan={2}>Employee No</th>
                      <th rowSpan={2}>Full Name</th>
                      <th rowSpan={2}>Position</th>
                      <th rowSpan={2}>Division</th>
                      <th rowSpan={2}>Region</th>
                      <th rowSpan={2}>Area</th>
                      <th rowSpan={2}>Branch</th>
                      <th rowSpan={2}>Status</th>
                      <th rowSpan={2}>Start Date</th>
                      <th rowSpan={2}>Date Regularized</th>
                      <th rowSpan={2}>TIN No</th>
                      <th colSpan={3}>Earnings</th>
                      <th colSpan={5}>Employee (EE)</th>
                    </tr>
                    <tr>
                      <th>Salary</th>
                      <th>ECOLA</th>
                      <th>Total Compensation</th>
                      <th>SSS</th>
                      <th>PH</th>
                      <th>Pag-IBIG</th>
                      <th>Total EE</th>
                      <th>Tax</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredStaff.map((item, idx) => {
                      const salary = toNum(item.salary);
                      const ecola = toNum(item.ecola);
                      const sssEe = toNum(item.sss_ee);
                      const philhealthEe = toNum(item.ph_ee ?? item.philhealth_ee);
                      const pagibigEe = toNum(item.hdmf_ee ?? item.pagibig_ee);
                      const totalEe = sssEe + philhealthEe + pagibigEe;

                      return (
                        <tr key={item.id}>
                          <td>{idx + 1}</td>
                          <td>{toStr(item.employee_no) || "-"}</td>
                          <td className="td-strong">{displayName(item)}</td>
                          <td>{item.position || "-"}</td>
                          <td>{item._division || "-"}</td>
                          <td>{item._region || "-"}</td>
                          <td>{item._area || "-"}</td>
                          <td>{item._branchLabel || "-"}</td>
                          <td>{item._status || "-"}</td>
                          <td>{fmtDate(item.start_date)}</td>
                          <td>{fmtDate(item.regularization_date)}</td>
                          <td>{toStr(item.tin_no) || "-"}</td>

                          <td>{salary.toLocaleString()}</td>
                          <td>{ecola.toLocaleString()}</td>
                          <td>{(salary + ecola).toLocaleString()}</td>

                          <td>{sssEe.toLocaleString()}</td>
                          <td>{philhealthEe.toLocaleString()}</td>
                          <td>{pagibigEe.toLocaleString()}</td>
                          <td>{totalEe.toLocaleString()}</td>
                          <td>{toNum(item.tax).toLocaleString()}</td>
                        </tr>
                      );
                    })}

                    <tr className="conso-total-row">
                      <td colSpan={12}>Totals</td>
                      <td>{totals.salary.toLocaleString()}</td>
                      <td>{totals.ecola.toLocaleString()}</td>
                      <td>{totals.total_compensation.toLocaleString()}</td>
                      <td>{totals.sss_ee.toLocaleString()}</td>
                      <td>{totals.philhealth_ee.toLocaleString()}</td>
                      <td>{totals.pagibig_ee.toLocaleString()}</td>
                      <td>{totals.total_ee.toLocaleString()}</td>
                      <td>{totals.tax.toLocaleString()}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="conso-payroll-tip">
                Tip: scroll horizontally to view all columns.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}