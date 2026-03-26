import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axiosClient";
import "../styles/Consolidation.css";

const toNum = (v) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const toStr = (v) => String(v ?? "").trim();

const displayName = (row) => {
  const ln = toStr(row?.last_name);
  const fn = toStr(row?.first_name);
  const mn = toStr(row?.middle_name);

  const built = `${ln}${ln && fn ? ", " : ""}${fn}${mn ? ` ${mn}` : ""}`
    .replace(/\s+/g, " ")
    .trim();

  return built || toStr(row?.fullname) || "-";
};

export default function Consolidation() {
  const navigate = useNavigate();

  const [staff, setStaff] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [search, setSearch] = useState("");

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

  const filteredStaff = useMemo(() => {
    const q = search.toLowerCase().trim();

    return staff.filter((s) => {
      const employeeNo = toStr(s.employee_no);
      const employeeName = displayName(s);
      const position = toStr(s.position);
      const branch = branchMap.get(String(s.branch_id));
      const branchName = toStr(branch?.name);
      const branchCode = toStr(branch?.code);

      const hay =
        `${employeeNo} ${employeeName} ${position} ${branchName} ${branchCode}`.toLowerCase();

      return !q || hay.includes(q);
    });
  }, [staff, search, branchMap]);

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
          <div style={{ marginBottom: 14 }}>
            <input
              className="conso-input"
              type="text"
              placeholder="Search employee no, name, position, or branch..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
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
                      <th rowSpan={2}>Branch</th>
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
                      const branch = branchMap.get(String(item.branch_id));
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
                          <td>{branch ? `${branch.code} - ${branch.name}` : "-"}</td>

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
                      <td colSpan={5}>Totals</td>
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