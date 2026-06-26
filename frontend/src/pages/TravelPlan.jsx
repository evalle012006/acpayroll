import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axiosClient";
import "../styles/TravelPlan.css";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

export default function TravelPlan() {
  const navigate = useNavigate();

  const today = new Date();

  const [month, setMonth] = useState(today.getMonth());
  const [year, setYear] = useState(today.getFullYear());
  const [view, setView] = useState("Month");
  const [activeMenu, setActiveMenu] = useState("Dashboard");

  const [staffRows, setStaffRows] = useState([]);
  const [loadingStaff, setLoadingStaff] = useState(false);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const startDay = firstDay.getDay();
    const totalDays = lastDay.getDate();
    const prevLastDay = new Date(year, month, 0).getDate();

    const cells = [];

    for (let i = startDay - 1; i >= 0; i--) {
      cells.push({
        day: prevLastDay - i,
        currentMonth: false,
      });
    }

    for (let d = 1; d <= totalDays; d++) {
      cells.push({
        day: d,
        currentMonth: true,
      });
    }

    let nextDay = 1;

    while (cells.length < 42) {
      cells.push({
        day: nextDay++,
        currentMonth: false,
      });
    }

    return cells;
  }, [month, year]);

  const selectedDay =
    today.getMonth() === month && today.getFullYear() === year
      ? today.getDate()
      : null;

  const [selectedBranch, setSelectedBranch] = useState(null);

const branchRows = useMemo(() => {
  const map = new Map();

  staffRows.forEach((s) => {
    const key = s.branch_code || s.branch_name || "NO_BRANCH";

    if (!map.has(key)) {
      map.set(key, {
        branch_code: s.branch_code,
        branch_name: s.branch_name || "No Branch",
        area: s.area,
        region: s.region,
        division: s.division,
        staff: [],
      });
    }

    map.get(key).staff.push(s);
  });

  return Array.from(map.values());
}, [staffRows]);

const selectedBranchStaff = selectedBranch?.staff || [];

  const fetchScopedStaff = async () => {
    try {
      setLoadingStaff(true);

      const res = await api.get("/travel-plans/staff-scope");

      setStaffRows(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Fetch travel staff scope error:", err);
      setStaffRows([]);
    } finally {
      setLoadingStaff(false);
    }
  };

  useEffect(() => {
    fetchScopedStaff();
  }, []);

  const handleMenuClick = (menu) => {
    setActiveMenu(menu);
  };

  return (
    <div className="travel-modern-page">
      <div className="travel-modern-layout">
        <aside className="travel-side-panel">
          <div className="travel-big-day">{selectedDay || 1}</div>

          <div className="travel-big-month">
            {MONTHS[month]} {year}
          </div>

          <div className="travel-side-menu">
            {[
              "Dashboard",
              "Calendar",
              "Events",
              "Graph",
              "Documents",
              "History",
            ].map((menu) => (
              <button
                key={menu}
                type="button"
                className={activeMenu === menu ? "active" : ""}
                onClick={() => handleMenuClick(menu)}
              >
                {menu}
              </button>
            ))}
          </div>
        </aside>

        <main className="travel-calendar-main">
          <div className="travel-topbar">
            <div className="travel-view-tabs">
              {["Year", "Month", "Week"].map((v) => (
                <button
                  key={v}
                  className={view === v ? "active" : ""}
                  onClick={() => setView(v)}
                  type="button"
                >
                  {v}
                </button>
              ))}
            </div>

            <div className="travel-view-selects">
              <span>View:</span>

              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
              >
                {MONTHS.map((m, i) => (
                  <option key={m} value={i}>
                    {m}
                  </option>
                ))}
              </select>

              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
              >
                {Array.from({ length: 10 }).map((_, i) => {
                  const y = today.getFullYear() - 5 + i;

                  return (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  );
                })}
              </select>
            </div>

            <button className="travel-create-btn" type="button">
              + Create Travel Plan
            </button>
          </div>

          {activeMenu === "Dashboard" && (
            <div className="travel-dashboard-card">
                <div className="travel-dashboard-head">
                <div>
                    <h3>
                    {selectedBranch
                        ? selectedBranch.branch_name
                        : "Dashboard Branch Scope"}
                    </h3>

                    <p>
                    {selectedBranch
                        ? "Staff inside this branch."
                        : "Branches visible based on your area, region, or division."}
                    </p>
                </div>

                <span>
                    {selectedBranch
                    ? `${selectedBranchStaff.length} Staff`
                    : `${branchRows.length} Branches`}
                </span>
                </div>

                {selectedBranch && (
                <button
                    type="button"
                    className="travel-mini-back"
                    onClick={() => setSelectedBranch(null)}
                >
                    ← Back to Branches
                </button>
                )}

                {loadingStaff ? (
                <div className="travel-empty">Loading...</div>
                ) : !selectedBranch && branchRows.length === 0 ? (
                <div className="travel-empty">No branch found.</div>
                ) : selectedBranch ? (
                <div className="travel-table-wrap">
                    <table className="travel-table">
                    <thead>
                        <tr>
                        <th>Employee No</th>
                        <th>Name</th>
                        <th>Position</th>
                        <th>Branch</th>
                        <th>Area</th>
                        <th>Region</th>
                        <th>Division</th>
                        </tr>
                    </thead>

                    <tbody>
                        {selectedBranchStaff.map((s) => (
                        <tr key={s.id || s.employee_no}>
                            <td>{s.employee_no}</td>
                            <td>{s.employee_name || s.full_name || s.name || ""}</td>
                            <td>{s.position}</td>
                            <td>{s.branch_name}</td>
                            <td>{s.area}</td>
                            <td>{s.region}</td>
                            <td>{s.division}</td>
                        </tr>
                        ))}
                    </tbody>
                    </table>
                </div>
                ) : (
                <div className="travel-branch-grid">
                    {branchRows.map((b) => (
                    <button
                        key={b.branch_code || b.branch_name}
                        type="button"
                        className="travel-branch-card"
                        onClick={() => setSelectedBranch(b)}
                    >
                        <div className="travel-branch-title">{b.branch_name}</div>
                        <div className="travel-branch-code">{b.branch_code}</div>

                        <div className="travel-branch-meta">
                        <span>{b.staff.length} Staff</span>
                        <span>{b.area}</span>
                        </div>
                    </button>
                    ))}
                </div>
                )}
            </div>
            )}

          {activeMenu === "Calendar" && (
            <div className="travel-month-grid">
              {DAYS.map((d) => (
                <div key={d} className="travel-day-header">
                  {d}
                </div>
              ))}

              {calendarDays.map((cell, idx) => (
                <button
                  key={idx}
                  type="button"
                  className={`travel-date-cell ${
                    cell.currentMonth ? "" : "muted"
                  } ${
                    cell.currentMonth && cell.day === selectedDay
                      ? "selected"
                      : ""
                  }`}
                >
                  {String(cell.day).padStart(2, "0")}
                </button>
              ))}
            </div>
          )}

          {activeMenu === "Events" && (
            <div className="travel-dashboard-card">
              <div className="travel-empty">No events yet.</div>
            </div>
          )}

          {activeMenu === "Graph" && (
            <div className="travel-dashboard-card">
              <div className="travel-empty">No graph data yet.</div>
            </div>
          )}

          {activeMenu === "Documents" && (
            <div className="travel-dashboard-card">
              <div className="travel-empty">No documents yet.</div>
            </div>
          )}

          {activeMenu === "History" && (
            <div className="travel-dashboard-card">
              <div className="travel-empty">No history yet.</div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}