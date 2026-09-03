import React, { useEffect, useMemo, useState, } from "react";
import "../../styles/CalendarSummaryReport.css";
import axios from "axios";

const SAMPLE_TRAVEL_ROWS = [
  {
    id: 1,
    date: "2026-08-27",
    employee_no: "000123",
    employee_name: "DELA CRUZ, JUAN",
    position: "AREA MANAGER",
    branch: "GUIWAN",
    area: "ZAMBOANGA CITY I",
    region: "ZAMBOANGA PENINSULA",
    division: "DIVISION IV",
    time_in: "8:15 AM",
    time_out: "4:32 PM",
    status: "Completed",
  },
  {
    id: 2,
    date: "2026-08-27",
    employee_no: "000456",
    employee_name: "SANTOS, MARIA",
    position: "REGIONAL MANAGER",
    branch: "TETUAN",
    area: "ZAMBOANGA CITY I",
    region: "ZAMBOANGA PENINSULA",
    division: "DIVISION IV",
    time_in: "9:02 AM",
    time_out: "-",
    status: "Incomplete",
  },
  {
    id: 3,
    date: "2026-08-26",
    employee_no: "000789",
    employee_name: "RAMOS, CARLO",
    position: "ASSISTANT VICE PRESIDENT",
    branch: "PAGADIAN",
    area: "PAGADIAN AREA",
    region: "REGION IX",
    division: "DIVISION IV",
    time_in: "8:40 AM",
    time_out: "5:10 PM",
    status: "Completed",
  },
];

const DEPARTMENT_OPTIONS = [
  "OPERATION DEPARTMENT",
  "ACCOUNTING DEPARTMENT",
  "HR DEPARTMENT",
  "IT DEPARTMENT",
  "AUDIT DEPARTMENT",
  "TREAD DEPARTMENT",
  "PRODUCTION & LOGISTIC DEPARTMENT",
  "OFFICE OF THE PRESIDENT",
];

const POSITION_OPTIONS = [
  "LOAN OFFICER",
  "BRANCH MANAGER",
  "AREA MANAGER",
  "REGIONAL MANAGER",
  "ASSISTANT VICE PRESIDENT",
  "VICE PRESIDENT",
  "SENIOR VICE PRESIDENT",
];

const SAMPLE_STAFF_SUMMARY = [
  {
    id: 1,
    employee_name: "DELA CRUZ, JUAN",
    position: "AREA MANAGER",
    travel_days: 12,
    branch_visits: 18,
    completed: 17,
    incomplete: 1,
    most_visited_branch: "GUIWAN",
  },
  {
    id: 2,
    employee_name: "SANTOS, MARIA",
    position: "REGIONAL MANAGER",
    travel_days: 8,
    branch_visits: 14,
    completed: 13,
    incomplete: 1,
    most_visited_branch: "TETUAN",
  },
  {
    id: 3,
    employee_name: "RAMOS, CARLO",
    position: "ASSISTANT VICE PRESIDENT",
    travel_days: 6,
    branch_visits: 10,
    completed: 10,
    incomplete: 0,
    most_visited_branch: "PAGADIAN",
  },
];

const SAMPLE_BRANCH_SUMMARY = [
  {
    id: 1,
    branch: "GUIWAN",
    area: "ZAMBOANGA CITY I",
    region: "ZAMBOANGA PENINSULA",
    visits: 28,
    unique_staff: 9,
    last_visit: "2026-08-27",
  },
  {
    id: 2,
    branch: "TETUAN",
    area: "ZAMBOANGA CITY I",
    region: "ZAMBOANGA PENINSULA",
    visits: 19,
    unique_staff: 7,
    last_visit: "2026-08-27",
  },
  {
    id: 3,
    branch: "PAGADIAN",
    area: "PAGADIAN AREA",
    region: "REGION IX",
    visits: 15,
    unique_staff: 6,
    last_visit: "2026-08-26",
  },
];

const SAMPLE_STAFF_TRAVEL_PLANS = {
  1: [
    {
      id: 101,
      date: "2026-08-27",
      title: "Branch Monitoring",
      branch: "GUIWAN",
      description:
        "Conducted regular branch monitoring, cash verification, document review, and client validation.",
      status: "Completed",
      time_in: "8:15 AM",
      time_out: "4:32 PM",
      duration: "8 hr 17 min",

      branch_findings: {
        coh: "Cash on hand was verified and properly accounted for.",
        cashbook:
          "Cashbook entries were compared against supporting vouchers.",
        bms: "BMS records were reviewed and found updated.",
        others:
          "Recommended improvement in filing and document organization.",
      },

      group_findings: {
        passbook:
          "Selected client passbooks were reconciled against branch records.",
        past_due:
          "Past due and delinquent accounts were reviewed with branch staff.",
        collection:
          "Group collection records were checked and properly documented.",
        others:
          "Follow-up monitoring is recommended for selected accounts.",
      },

      involved_staff: [
        "SANTOS, MARIA",
        "REYES, JOHN",
      ],

      due_date: "2026-09-05",

      photos: [
        {
          id: 1,
          label: "Time In",
          url: "https://placehold.co/600x400?text=Time+In",
        },
        {
          id: 2,
          label: "Branch Visit",
          url: "https://placehold.co/600x400?text=Branch+Visit",
        },
        {
          id: 3,
          label: "Group Visit",
          url: "https://placehold.co/600x400?text=Group+Visit",
        },
        {
          id: 4,
          label: "Time Out",
          url: "https://placehold.co/600x400?text=Time+Out",
        },
      ],
    },

    {
      id: 102,
      date: "2026-08-25",
      title: "Client Account Validation",
      branch: "TETUAN",
      description:
        "Visited branch and selected client groups for account validation.",
      status: "Completed",
      time_in: "8:40 AM",
      time_out: "3:55 PM",
      duration: "7 hr 15 min",

      branch_findings: {
        coh: "Verified.",
        cashbook: "Reviewed.",
        bms: "Updated.",
        others: "",
      },

      group_findings: {
        passbook: "Passbooks checked.",
        past_due: "Delinquent accounts discussed.",
        collection: "Collection records verified.",
        others: "",
      },

      involved_staff: ["CRUZ, MARK"],
      due_date: "2026-09-02",
      photos: [],
    },
  ],

  2: [
    {
      id: 201,
      date: "2026-08-27",
      title: "Regional Branch Inspection",
      branch: "TETUAN",
      description:
        "Performed branch inspection and reviewed branch operations.",
      status: "Incomplete",
      time_in: "9:02 AM",
      time_out: "-",
      duration: "Not complete",

      branch_findings: {
        coh: "Initial verification completed.",
        cashbook: "",
        bms: "",
        others: "Inspection is still ongoing.",
      },

      group_findings: {
        passbook: "",
        past_due: "",
        collection: "",
        others: "",
      },

      involved_staff: ["DELA CRUZ, JUAN"],
      due_date: "",
      photos: [],
    },
  ],

  3: [
    {
      id: 301,
      date: "2026-08-26",
      title: "Division Monitoring Visit",
      branch: "PAGADIAN",
      description:
        "Conducted division-level monitoring of branch operations.",
      status: "Completed",
      time_in: "8:40 AM",
      time_out: "5:10 PM",
      duration: "8 hr 30 min",

      branch_findings: {
        coh: "Verified.",
        cashbook: "No discrepancies noted.",
        bms: "Records updated.",
        others: "",
      },

      group_findings: {
        passbook: "Reconciled.",
        past_due: "Reviewed.",
        collection: "Reviewed.",
        others: "",
      },

      involved_staff: ["SANTOS, MARIA"],
      due_date: "2026-09-10",
      photos: [],
    },
  ],
};

const formatDate = (value) => {
  if (!value) return "-";

  return new Date(`${value}T00:00:00`).toLocaleDateString("en-PH", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
};

export default function CalendarSummaryReport() {
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [selectedTravelPlan, setSelectedTravelPlan] = useState(null);
  const [activeTab, setActiveTab] = useState("travel");
  const [dateFrom, setDateFrom] = useState("2026-08-01");
  const [dateTo, setDateTo] = useState("2026-08-31");
  const [department, setDepartment] = useState("all");
  const [position, setPosition] = useState("all");

  const [division, setDivision] = useState("");
  const [region, setRegion] = useState("");
  const [area, setArea] = useState("");
  const [branch, setBranch] = useState("");
  const [employee, setEmployee] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");

  const [reportData, setReportData] = useState({
    summary: {
      staff_traveled: 0,
      total_travels: 0,
      branches_visited: 0,
      completed: 0,
      incomplete: 0,
    },

    travel_details: [],
    staff_summary: [],
    branch_summary: [],

    filters: {
      divisions: [],
      regions: [],
      areas: [],
      branches: [],
      departments: [],
      positions: [],
      employees: [],
    },
  });

  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const loadSummaryReport = async () => {
      try {
        setLoading(true);
        setLoadError("");

        const params = {
          dateFrom,
          dateTo,
        };

        if (division && division !== "all") {
          params.division = division;
        }

        if (region && region !== "all") {
          params.region = region;
        }

        if (area && area !== "all") {
          params.area = area;
        }

        if (branch && branch !== "all") {
          params.branch = branch;
        }

        if (
          department &&
          department !== "all"
        ) {
          params.department = department;
        }

        if (
          position &&
          position !== "all"
        ) {
          params.position = position;
        }

        if (
          employee &&
          employee !== "all"
        ) {
          params.employee = employee;
        }

        if (status && status !== "all") {
          params.status = status;
        }

        if (search.trim()) {
          params.search = search.trim();
        }

        const token = localStorage.getItem("token");

        const response = await axios.get(
          "http://localhost:5000/api/travel-plans/summary-report",
          {
            params,
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!cancelled) {
          setReportData({
            summary: response.data?.summary || {},
            travel_details:
              response.data?.travel_details || [],
            staff_summary:
              response.data?.staff_summary || [],
            branch_summary:
              response.data?.branch_summary || [],
            filters:
              response.data?.filters || {},
          });
        }
      } catch (error) {
        console.error(
          "CALENDAR SUMMARY REPORT ERROR:",
          error
        );

        if (!cancelled) {
          setLoadError(
            error?.response?.data?.message ||
              error?.message ||
              "Failed to load Calendar Summary Report."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    const timer = setTimeout(
      loadSummaryReport,
      300
    );

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    dateFrom,
    dateTo,
    division,
    region,
    area,
    branch,
    department,
    position,
    employee,
    status,
    search,
  ]);

  const summary = useMemo(() => {
    return {
      staffTraveled: Number(
        reportData.summary?.staff_traveled || 0
      ),

      totalTravels: Number(
        reportData.summary?.total_travels || 0
      ),

      branchesVisited: Number(
        reportData.summary?.branches_visited || 0
      ),

      completed: Number(
        reportData.summary?.completed || 0
      ),

      incomplete: Number(
        reportData.summary?.incomplete || 0
      ),
    };
  }, [reportData.summary]);

  return (
    <div className="calendar-summary-page">
      <div className="calendar-summary-header">
        <div>
          <h1>Calendar Summary Report</h1>

          <p>
            View summarized travel activity, staff travel performance, and
            branch visit records.
          </p>
        </div>

        <div className="calendar-summary-header-actions">
          <button type="button" className="calendar-summary-btn secondary">
            Print
          </button>

          <button type="button" className="calendar-summary-btn primary">
            Export Excel
          </button>
        </div>
      </div>

      <div className="calendar-summary-filter-card">
        <div className="calendar-summary-filter-grid">
          <label>
            <span>Date From</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </label>

          <label>
            <span>Date To</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </label>

          <label>
            <span>Division</span>
            <select
              value={division}
              onChange={(e) => setDivision(e.target.value)}
            >
              <option value="all">All Divisions</option>
              <option value="DIVISION IV">DIVISION IV</option>
            </select>
          </label>

          <label>
            <span>Region</span>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
            >
              <option value="all">All Regions</option>
              <option value="ZAMBOANGA PENINSULA">
                ZAMBOANGA PENINSULA
              </option>
              <option value="REGION IX">REGION IX</option>
            </select>
          </label>

          <label>
            <span>Area</span>
            <select
              value={area}
              onChange={(e) => setArea(e.target.value)}
            >
              <option value="all">All Areas</option>
              <option value="ZAMBOANGA CITY I">
                ZAMBOANGA CITY I
              </option>
              <option value="PAGADIAN AREA">
                PAGADIAN AREA
              </option>
            </select>
          </label>

          <label>
            <span>Branch</span>
            <select
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
            >
              <option value="all">All Branches</option>
              <option value="GUIWAN">GUIWAN</option>
              <option value="TETUAN">TETUAN</option>
              <option value="PAGADIAN">PAGADIAN</option>
            </select>
          </label>

          {/* NEW - DEPARTMENT */}
          <label>
            <span>Department</span>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            >
              <option value="all">All Departments</option>

              {DEPARTMENT_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          {/* NEW - POSITION */}
          <label>
            <span>Position</span>
            <select
              value={position}
              onChange={(e) => setPosition(e.target.value)}
            >
              <option value="all">All Positions</option>

              {POSITION_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Employee</span>
            <select
              value={employee}
              onChange={(e) => setEmployee(e.target.value)}
            >
              <option value="all">All Employees</option>
              <option value="000123">DELA CRUZ, JUAN</option>
              <option value="000456">SANTOS, MARIA</option>
              <option value="000789">RAMOS, CARLO</option>
            </select>
          </label>

          <label>
            <span>Status</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="Completed">Completed</option>
              <option value="Incomplete">Incomplete</option>
            </select>
          </label>
        </div>

        <div className="calendar-summary-search-row">
          <input
            type="text"
            placeholder="Search employee, branch, position, area, region..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <button
            type="button"
            className="calendar-summary-clear-btn"
            onClick={() => {
              setDivision("");
              setRegion("");
              setArea("");
              setBranch("");
              setDepartment("all");
              setPosition("all");
              setEmployee("");
              setStatus("");
              setSearch("");
            }}
          >
            Clear Filters
          </button>
        </div>
      </div>

      <div className="calendar-summary-cards">
        <div className="calendar-summary-stat">
          <span>Staff Traveled</span>
          <strong>{summary.staffTraveled}</strong>
          <small>Unique employees</small>
        </div>

        <div className="calendar-summary-stat">
          <span>Total Travels</span>
          <strong>{summary.totalTravels}</strong>
          <small>Travel records</small>
        </div>

        <div className="calendar-summary-stat">
          <span>Branches Visited</span>
          <strong>{summary.branchesVisited}</strong>
          <small>Unique branches</small>
        </div>

        <div className="calendar-summary-stat completed">
          <span>Completed</span>
          <strong>{summary.completed}</strong>
          <small>Completed travels</small>
        </div>

        <div className="calendar-summary-stat incomplete">
          <span>Incomplete</span>
          <strong>{summary.incomplete}</strong>
          <small>Incomplete travels</small>
        </div>
      </div>

      <div className="calendar-summary-main-card">
        <div className="calendar-summary-tabs">
          <button
            type="button"
            className={activeTab === "travel" ? "active" : ""}
            onClick={() => setActiveTab("travel")}
          >
            Travel Details
          </button>

          <button
            type="button"
            className={activeTab === "staff" ? "active" : ""}
            onClick={() => setActiveTab("staff")}
          >
            Staff Summary
          </button>

          <button
            type="button"
            className={activeTab === "branch" ? "active" : ""}
            onClick={() => setActiveTab("branch")}
          >
            Branch Summary
          </button>
        </div>

        <div className="calendar-summary-card-head">
          <div>
            <h3>
              {activeTab === "travel"
                ? "Travel Details"
                : activeTab === "staff"
                ? "Staff Summary"
                : "Branch Summary"}
            </h3>

            <p>
              {formatDate(dateFrom)} - {formatDate(dateTo)}
            </p>
          </div>
        </div>

        <div className="calendar-summary-table-wrap">
          {activeTab === "travel" && (
            <table className="calendar-summary-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Employee No.</th>
                  <th>Employee Name</th>
                  <th>Position</th>
                  <th>Branch Visited</th>
                  <th>Area</th>
                  <th>Region</th>
                  <th>Division</th>
                  <th>Time In</th>
                  <th>Time Out</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {reportData.travel_details.map((row) => (
                  <tr key={row.id}>
                    <td>{formatDate(row.date)}</td>
                    <td>{row.employee_no}</td>
                    <td className="calendar-summary-name">
                      {row.employee_name}
                    </td>
                    <td>{row.position}</td>
                    <td>{row.branch}</td>
                    <td>{row.area}</td>
                    <td>{row.region}</td>
                    <td>{row.division}</td>
                    <td>{row.time_in}</td>
                    <td>{row.time_out}</td>

                    <td>
                      <span
                        className={`calendar-summary-status ${row.status
                          .toLowerCase()
                          .replace(/\s+/g, "-")}`}
                      >
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === "staff" && (
            <table className="calendar-summary-table">
              <thead>
                <tr>
                  <th>Employee Name</th>
                  <th>Position</th>
                  <th>Travel Days</th>
                  <th>Total Branch Visits</th>
                  <th>Completed</th>
                  <th>Incomplete</th>
                  <th>Most Visited Branch</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {reportData.staff_summary.map((row) => (
                  <tr
                    key={
                      row.staff_id ||
                      row.employee_no ||
                      row.employee_name
                    }
                  >
                    <td className="calendar-summary-name">
                      {row.employee_name}
                    </td>
                    <td>{row.position}</td>
                    <td>{row.travel_days}</td>
                    <td>{row.branch_visits}</td>
                    <td>{row.completed}</td>
                    <td>{row.incomplete}</td>
                    <td>{row.most_visited_branch}</td>
                    <td>
                      <button
                        type="button"
                        className="calendar-summary-view-btn"
                        onClick={() => setSelectedStaff(row)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === "branch" && (
            <table className="calendar-summary-table">
              <thead>
                <tr>
                  <th>Branch</th>
                  <th>Area</th>
                  <th>Region</th>
                  <th>Total Visits</th>
                  <th>Unique Staff Visitors</th>
                  <th>Last Visit</th>
                </tr>
              </thead>

              <tbody>
                {reportData.branch_summary.map((row) => (
                  <tr key={row.branch}>
                    <td className="calendar-summary-name">{row.branch}</td>
                    <td>{row.area}</td>
                    <td>{row.region}</td>
                    <td>{row.visits}</td>
                    <td>{row.unique_staff}</td>
                    <td>{formatDate(row.last_visit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      
      {selectedStaff && !selectedTravelPlan && (
        <div className="calendar-summary-modal-backdrop">
          <div className="calendar-summary-modal staff-travel-modal">
            <div className="calendar-summary-modal-head">
              <div>
                <span className="calendar-summary-modal-eyebrow">
                  Staff Travel History
                </span>

                <h2>{selectedStaff.employee_name}</h2>

                <p>{selectedStaff.position}</p>
              </div>

              <button
                type="button"
                className="calendar-summary-modal-close"
                onClick={() => {
                  setSelectedTravelPlan(null);
                  setSelectedStaff(null);
                }}
              >
                ×
              </button>
            </div>

            <div className="calendar-summary-staff-overview">
              <div>
                <span>Travel Days</span>
                <strong>{selectedStaff.travel_days}</strong>
              </div>

              <div>
                <span>Branch Visits</span>
                <strong>{selectedStaff.branch_visits}</strong>
              </div>

              <div>
                <span>Completed</span>
                <strong>{selectedStaff.completed}</strong>
              </div>

              <div>
                <span>Incomplete</span>
                <strong>{selectedStaff.incomplete}</strong>
              </div>

              <div>
                <span>Most Visited</span>
                <strong>
                  {selectedStaff.most_visited_branch}
                </strong>
              </div>
            </div>

            <div className="calendar-summary-modal-section-head">
              <div>
                <h3>Travel Plans</h3>
                <p>
                  Select a Travel Plan to view the complete
                  activity and findings.
                </p>
              </div>

              <span>
                {
                  (
                    SAMPLE_STAFF_TRAVEL_PLANS[
                      selectedStaff.id
                    ] || []
                  ).length
                }{" "}
                records
              </span>
            </div>

            <div className="calendar-summary-travel-list">
              {(
                SAMPLE_STAFF_TRAVEL_PLANS[
                  selectedStaff.id
                ] || []
              ).map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  className="calendar-summary-travel-item"
                  onClick={() =>
                    setSelectedTravelPlan(plan)
                  }
                >
                  <div className="calendar-summary-travel-date">
                    <span>
                      {new Date(
                        `${plan.date}T00:00:00`
                      ).toLocaleDateString("en-PH", {
                        month: "short",
                      })}
                    </span>

                    <strong>
                      {new Date(
                        `${plan.date}T00:00:00`
                      ).getDate()}
                    </strong>

                    <small>
                      {new Date(
                        `${plan.date}T00:00:00`
                      ).getFullYear()}
                    </small>
                  </div>

                  <div className="calendar-summary-travel-main">
                    <div className="calendar-summary-travel-title">
                      <strong>{plan.title}</strong>

                      <span
                        className={`calendar-summary-status ${plan.status
                          .toLowerCase()
                          .replace(/\s+/g, "-")}`}
                      >
                        {plan.status}
                      </span>
                    </div>

                    <p>{plan.description}</p>

                    <div className="calendar-summary-travel-meta">
                      <span>
                        Branch: <b>{plan.branch}</b>
                      </span>

                      <span>
                        Time In: <b>{plan.time_in}</b>
                      </span>

                      <span>
                        Time Out: <b>{plan.time_out}</b>
                      </span>
                    </div>
                  </div>

                  <div className="calendar-summary-travel-arrow">
                    View →
                  </div>
                </button>
              ))}
            </div>

            <div className="calendar-summary-modal-footer">
              <button
                type="button"
                onClick={() => {
                  setSelectedTravelPlan(null);
                  setSelectedStaff(null);
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedStaff && selectedTravelPlan && (
        <div className="calendar-summary-modal-backdrop">
          <div className="calendar-summary-modal travel-detail-modal">
            <div className="calendar-summary-modal-head">
              <div>
                <span className="calendar-summary-modal-eyebrow">
                  Travel Plan Details
                </span>

                <h2>{selectedTravelPlan.title}</h2>

                <p>
                  {selectedStaff.employee_name} •{" "}
                  {selectedStaff.position}
                </p>
              </div>

              <button
                type="button"
                className="calendar-summary-modal-close"
                onClick={() =>
                  setSelectedTravelPlan(null)
                }
              >
                ×
              </button>
            </div>

            <div className="calendar-summary-detail-hero">
              <div>
                <span>Date</span>
                <strong>
                  {formatDate(selectedTravelPlan.date)}
                </strong>
              </div>

              <div>
                <span>Branch Visited</span>
                <strong>
                  {selectedTravelPlan.branch}
                </strong>
              </div>

              <div>
                <span>Time In</span>
                <strong>
                  {selectedTravelPlan.time_in}
                </strong>
              </div>

              <div>
                <span>Time Out</span>
                <strong>
                  {selectedTravelPlan.time_out}
                </strong>
              </div>

              <div>
                <span>Duration</span>
                <strong>
                  {selectedTravelPlan.duration}
                </strong>
              </div>

              <div>
                <span>Status</span>

                <span
                  className={`calendar-summary-status ${selectedTravelPlan.status
                    .toLowerCase()
                    .replace(/\s+/g, "-")}`}
                >
                  {selectedTravelPlan.status}
                </span>
              </div>
            </div>

            <div className="calendar-summary-detail-description">
              <span>Purpose / Description</span>

              <p>
                {selectedTravelPlan.description}
              </p>
            </div>

            <div className="calendar-summary-findings-grid">
              <div className="calendar-summary-finding-card">
                <div className="calendar-summary-finding-title">
                  <span>01</span>

                  <div>
                    <h3>Branch Visit Findings</h3>
                    <p>
                      Findings recorded during branch
                      monitoring.
                    </p>
                  </div>
                </div>

                <div className="calendar-summary-finding-list">
                  <div>
                    <span>COH</span>
                    <p>
                      {selectedTravelPlan
                        .branch_findings.coh ||
                        "No finding recorded."}
                    </p>
                  </div>

                  <div>
                    <span>Cashbook vs Voucher</span>
                    <p>
                      {selectedTravelPlan
                        .branch_findings.cashbook ||
                        "No finding recorded."}
                    </p>
                  </div>

                  <div>
                    <span>BMS</span>
                    <p>
                      {selectedTravelPlan
                        .branch_findings.bms ||
                        "No finding recorded."}
                    </p>
                  </div>

                  <div>
                    <span>Others</span>
                    <p>
                      {selectedTravelPlan
                        .branch_findings.others ||
                        "No additional finding."}
                    </p>
                  </div>
                </div>
              </div>

              <div className="calendar-summary-finding-card">
                <div className="calendar-summary-finding-title">
                  <span>02</span>

                  <div>
                    <h3>Group Visit Findings</h3>
                    <p>
                      Client and group-level validation
                      findings.
                    </p>
                  </div>
                </div>

                <div className="calendar-summary-finding-list">
                  <div>
                    <span>
                      Passbook Reconciliation
                    </span>

                    <p>
                      {selectedTravelPlan
                        .group_findings.passbook ||
                        "No finding recorded."}
                    </p>
                  </div>

                  <div>
                    <span>
                      Past Due & Delinquent Report
                    </span>

                    <p>
                      {selectedTravelPlan
                        .group_findings.past_due ||
                        "No finding recorded."}
                    </p>
                  </div>

                  <div>
                    <span>
                      Group Collection Record
                    </span>

                    <p>
                      {selectedTravelPlan
                        .group_findings.collection ||
                        "No finding recorded."}
                    </p>
                  </div>

                  <div>
                    <span>Others</span>

                    <p>
                      {selectedTravelPlan
                        .group_findings.others ||
                        "No additional finding."}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="calendar-summary-detail-bottom">
              <div className="calendar-summary-involved-card">
                <span>Involved Staff</span>

                <div className="calendar-summary-involved-tags">
                  {selectedTravelPlan.involved_staff
                    .length > 0 ? (
                    selectedTravelPlan.involved_staff.map(
                      (name) => (
                        <span key={name}>{name}</span>
                      )
                    )
                  ) : (
                    <p>No involved staff.</p>
                  )}
                </div>
              </div>

              <div className="calendar-summary-due-card">
                <span>Compliance Due Date</span>

                <strong>
                  {selectedTravelPlan.due_date
                    ? formatDate(
                        selectedTravelPlan.due_date
                      )
                    : "No due date"}
                </strong>
              </div>
            </div>

            <div className="calendar-summary-photo-section">
              <div>
                <h3>Travel Photos</h3>
                <p>
                  Supporting photos submitted with this
                  Travel Plan.
                </p>
              </div>

              {selectedTravelPlan.photos.length === 0 ? (
                <div className="calendar-summary-no-photos">
                  No sample photos available.
                </div>
              ) : (
                <div className="calendar-summary-photo-grid">
                  {selectedTravelPlan.photos.map(
                    (photo) => (
                      <div
                        key={photo.id}
                        className="calendar-summary-photo-card"
                      >
                        <img
                          src={photo.url}
                          alt={photo.label}
                        />

                        <span>{photo.label}</span>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>

            <div className="calendar-summary-modal-footer">
              <button
                type="button"
                onClick={() =>
                  setSelectedTravelPlan(null)
                }
              >
                ← Back to Travel Plans
              </button>

              <button
                type="button"
                className="primary"
                onClick={() => {
                  setSelectedTravelPlan(null);
                  setSelectedStaff(null);
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}