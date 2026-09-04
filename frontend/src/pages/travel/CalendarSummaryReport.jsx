import React, { useEffect, useMemo, useState, } from "react";
import "../../styles/CalendarSummaryReport.css";
import api from "../../api/axiosClient";

const formatDate = (value) => {
  if (!value) return "-";

  return new Date(`${value}T00:00:00`).toLocaleDateString("en-PH", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
};

const formatTime = (value) => {
  if (!value || value === "-") return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleTimeString("en-PH", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Manila",
  });
};

export default function CalendarSummaryReport() {
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [selectedTravelPlan, setSelectedTravelPlan] = useState(null);
  const [travelDetailLoading, setTravelDetailLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState("2026-08-01");
  const [dateTo, setDateTo] = useState("2026-08-31");
  const [department, setDepartment] = useState("all");
  const [position, setPosition] = useState("all");

  const [division, setDivision] = useState("all");
  const [region, setRegion] = useState("all");
  const [area, setArea] = useState("all");
  const [branch, setBranch] = useState("all");
  const [employee, setEmployee] = useState("all");
  const [status, setStatus] = useState("all");

  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);

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

        const response = await api.get(
          "/travel-plans/summary-report",
          {
            params,
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

  const selectedStaffTravels = useMemo(() => {
    if (!selectedStaff) return [];

    return reportData.travel_details.filter((row) => {
      const sameEmployeeNo =
        selectedStaff.employee_no &&
        row.employee_no &&
        String(selectedStaff.employee_no).trim() ===
          String(row.employee_no).trim();

      const sameName =
        String(selectedStaff.employee_name || "")
          .trim()
          .toLowerCase() ===
        String(row.employee_name || "")
          .trim()
          .toLowerCase();

      return sameEmployeeNo || sameName;
    });
  }, [selectedStaff, reportData.travel_details]);

  const openTravelPlanDetails = async (plan) => {
    try {
      setTravelDetailLoading(true);

      const [planResponse, notesResponse, photosResponse] =
        await Promise.all([
          api.get(`/travel-plans/${plan.id}`),
          api.get(`/travel-plans/${plan.id}/notes`),
          api.get(`/travel-plans/${plan.id}/photos`),
        ]);

      const fullPlan = planResponse.data || {};
      const notes = Array.isArray(notesResponse.data)
        ? notesResponse.data
        : [];

      const planPhotos = Array.isArray(photosResponse.data)
        ? photosResponse.data
        : [];

      const reviewNote =
        notes.find(
          (note) =>
            String(note.note_type || "").toUpperCase() === "REVIEW"
        ) || {};

      const findingNote =
        notes.find(
          (note) =>
            String(note.note_type || "").toUpperCase() === "FINDINGS"
        ) || {};

      const involvedStaff = Array.isArray(
        findingNote.involved_staff
      )
        ? findingNote.involved_staff
        : Array.isArray(reviewNote.involved_staff)
        ? reviewNote.involved_staff
        : [];

      const photos = planPhotos
        .filter((photo) => photo.signed_url)
        .map((photo) => {
          const photoType = String(
            photo.photo_type || "GENERAL"
          ).toUpperCase();

          let label = "Travel Photo";

          if (photoType === "CHECK_IN") {
            label = "Check In";
          } else if (photoType === "CHECK_OUT") {
            label = "Check Out";
          } else if (photoType === "GENERAL") {
            label = "General";
          }

          return {
            id: `travel-${photo.id}`,
            label,
            url: photo.signed_url,
            photo_type: photoType,
            captured_at:
              photo.captured_at ||
              photo.created_at ||
              null,
            latitude: photo.latitude,
            longitude: photo.longitude,
          };
        });

      if (reviewNote.review_photo_signed_url) {
        photos.push({
          id: `review-${reviewNote.id}`,
          label: "Branch Visit Finding",
          url: reviewNote.review_photo_signed_url,
          photo_type: "REVIEW",
        });
      }

      if (findingNote.finding_photo_signed_url) {
        photos.push({
          id: `finding-${findingNote.id}`,
          label: "Group Visit Finding",
          url: findingNote.finding_photo_signed_url,
          photo_type: "FINDINGS",
        });
      }

      setSelectedTravelPlan({
        id: fullPlan.id ?? plan.id,

        date:
          fullPlan.plan_date ||
          plan.date,

        title:
          fullPlan.title ||
          plan.title ||
          "Travel Plan",

        branch:
          fullPlan.branch_name ||
          plan.branch ||
          "-",

        description:
          fullPlan.description ||
          plan.description ||
          "",

        status:
          fullPlan.status ||
          plan.status ||
          "Incomplete",

        time_in:
          fullPlan.check_in_at ||
          plan.time_in ||
          null,

        time_out:
          fullPlan.check_out_at ||
          plan.time_out ||
          null,

        duration:
          fullPlan.duration_label ||
          plan.duration ||
          "Not complete",

        branch_findings: {
          coh:
            reviewNote.review_coh || "",

          cashbook:
            reviewNote.review_cashbook_vs_voucher || "",

          lor:
            reviewNote.review_lor || "",

          los:
            reviewNote.review_los || "",

          ldf:
            reviewNote.review_ldf || "",

          dcs:
            reviewNote.review_dcs || "",

          bms:
            reviewNote.review_bms || "",

          others:
            reviewNote.review_other_findings || "",
        },

        group_findings: {
          passbook:
            findingNote.passbook_reconciliation || "",

          past_due:
            findingNote.past_due_delinquent_report || "",

          collection:
            findingNote.group_collection_record || "",

          others:
            findingNote.other_findings || "",
        },

        involved_staff: involvedStaff,

        due_date:
          findingNote.due_date ||
          reviewNote.due_date ||
          "",

        photos,
      });
    } catch (error) {
      console.error(
        "OPEN TRAVEL PLAN DETAILS ERROR:",
        error
      );

      alert(
        error?.response?.data?.message ||
          "Unable to load Travel Plan details."
      );
    } finally {
      setTravelDetailLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = () => {
    const rows = reportData.travel_details || [];

    if (rows.length === 0) {
      alert("No travel records to export.");
      return;
    }

    const headers = [
      "Date",
      "Employee No.",
      "Employee Name",
      "Position",
      "Department",
      "Branch Visited",
      "Area",
      "Region",
      "Division",
      "Time In",
      "Time Out",
      "Duration",
      "Status",
    ];

    const escapeCsv = (value) => {
      const text = String(value ?? "");

      return `"${text.replace(/"/g, '""')}"`;
    };

    const csvRows = [
      headers.map(escapeCsv).join(","),
      ...rows.map((row) =>
        [
          row.date || "",
          row.employee_no || "",
          row.employee_name || "",
          row.position || "",
          row.department || "",
          row.branch || "",
          row.area || "",
          row.region || "",
          row.division || "",
          formatTime(row.time_in),
          formatTime(row.time_out),
          row.duration || "",
          row.status || "",
        ]
          .map(escapeCsv)
          .join(",")
      ),
    ];

    const csvContent =
      "\uFEFF" + csvRows.join("\n");

    const blob = new Blob(
      [csvContent],
      {
        type: "text/csv;charset=utf-8;",
      }
    );

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;
    link.download =
      `calendar-summary-${dateFrom}-to-${dateTo}.csv`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  };

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
          <button
            type="button"
            className="calendar-summary-btn secondary"
            onClick={handlePrint}
          >
            Print
          </button>

          <button
            type="button"
            className="calendar-summary-btn primary"
            onClick={handleExportExcel}
          >
            Export Excel
          </button>
        </div>
      </div>

      <div className="calendar-summary-filter-card">
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
            onClick={() => setShowFilters((prev) => !prev)}
          >
            {showFilters ? "Hide Filters" : "Show Filters"}
          </button>
        </div>

        {showFilters && (
          <>
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

                  {(reportData.filters?.divisions || []).map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Region</span>
                <select
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                >
                  <option value="all">All Regions</option>

                  {(reportData.filters?.regions || []).map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Area</span>
                <select
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                >
                  <option value="all">All Areas</option>

                  {(reportData.filters?.areas || []).map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Branch</span>
                <select
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                >
                  <option value="all">All Branches</option>

                  {(reportData.filters?.branches || []).map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Department</span>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                >
                  <option value="all">
                    All Departments
                  </option>

                  {(reportData.filters?.departments || []).map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Position</span>
                <select
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                >
                  <option value="all">
                    All Positions
                  </option>

                  {(reportData.filters?.positions || []).map((item) => (
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

                  {(reportData.filters?.employees || []).map((item) => {
                    const value =
                      item.employee_no ||
                      item.employee_name ||
                      "";

                    const label = item.employee_no
                      ? `${item.employee_no} - ${item.employee_name}`
                      : item.employee_name;

                    return (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    );
                  })}
                </select>
              </label>

              <label>
                <span>Status</span>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="all">All Status</option>
                  <option value="Completed">
                    Completed
                  </option>
                  <option value="Incomplete">
                    Incomplete
                  </option>
                </select>
              </label>
            </div>

            <div className="calendar-summary-filter-actions">
              <button
                type="button"
                className="calendar-summary-clear-btn"
                onClick={() => {
                  setDivision("all");
                  setRegion("all");
                  setArea("all");
                  setBranch("all");
                  setDepartment("all");
                  setPosition("all");
                  setEmployee("all");
                  setStatus("all");
                  setSearch("");
                }}
              >
                Clear Filters
              </button>
            </div>
          </>
        )}
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
        <div className="calendar-summary-card-head">
          <div>
            <h3>Travel Details</h3>

            <p>
              {formatDate(dateFrom)} - {formatDate(dateTo)}
            </p>
          </div>
        </div>

        <div className="calendar-summary-table-wrap">
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
              {reportData.travel_details.length === 0 ? (
                <tr>
                  <td
                    colSpan="11"
                    style={{
                      textAlign: "center",
                      padding: "30px",
                    }}
                  >
                    No travel records found.
                  </td>
                </tr>
              ) : (
                reportData.travel_details.map((row) => (
                  <tr
                    key={row.id}
                    className="calendar-summary-clickable-row"
                    onClick={() => {
                      const staff =
                        reportData.staff_summary.find(
                          (item) =>
                            String(item.employee_no || "") ===
                              String(row.employee_no || "") ||
                            String(item.employee_name || "")
                              .trim()
                              .toLowerCase() ===
                              String(row.employee_name || "")
                                .trim()
                                .toLowerCase()
                        );

                      setSelectedTravelPlan(null);

                      setSelectedStaff(
                        staff || {
                          ...row,
                          travel_days: 0,
                          branch_visits: 0,
                          completed: 0,
                          incomplete: 0,
                          most_visited_branch: "-",
                        }
                      );
                    }}
                  >
                    <td>{formatDate(row.date)}</td>
                    <td>{row.employee_no || "-"}</td>
                    <td className="calendar-summary-name">{row.employee_name || "-"}</td>
                    <td>{row.position || "-"}</td>
                    <td>{row.branch || "-"}</td>
                    <td>{row.area || "-"}</td>
                    <td>{row.region || "-"}</td>
                    <td>{row.division || "-"}</td>
                    <td>{formatTime(row.time_in)}</td>
                    <td>{formatTime(row.time_out)}</td>
                    <td>
                      <span
                        className={`calendar-summary-status ${String(
                          row.status || ""
                        )
                          .toLowerCase()
                          .replace(/\s+/g, "-")}`}
                      >
                        {row.status || "-"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
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
                {selectedStaffTravels.length}{" "}
                {selectedStaffTravels.length === 1 ? "record" : "records"}
              </span>
            </div>

            <div className="calendar-summary-travel-list">
              {selectedStaffTravels.length === 0 ? (
                <div
                  style={{
                    padding: "30px",
                    textAlign: "center",
                  }}
                >
                  No travel records found for this employee.
                </div>
              ) : (
                selectedStaffTravels.map((plan) => (
                  <button
                    key={plan.id}
                    type="button"
                    className="calendar-summary-travel-item"
                    disabled={travelDetailLoading}
                    onClick={() => {
                      openTravelPlanDetails(plan);
                    }}
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
                        <strong>
                          {plan.title || "Travel Plan"}
                        </strong>

                        <span
                          className={`calendar-summary-status ${String(
                            plan.status || ""
                          )
                            .toLowerCase()
                            .replace(/\s+/g, "-")}`}
                        >
                          {plan.status || "-"}
                        </span>
                      </div>

                      <p>
                        {plan.description ||
                          `Travel visit to ${plan.branch || "-"}`}
                      </p>

                      <div className="calendar-summary-travel-meta">
                        <span>
                          Branch: <b>{plan.branch || "-"}</b>
                        </span>

                        <span>
                          Time In: <b>{formatTime(plan.time_in)}</b>
                        </span>

                        <span>
                          Time Out: <b>{formatTime(plan.time_out)}</b>
                        </span>
                      </div>
                    </div>

                    <div className="calendar-summary-travel-arrow">
                      {travelDetailLoading ? "Loading..." : "View →"}
                    </div>
                  </button>
                ))
              )}
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
                  {formatTime(selectedTravelPlan.time_in)}
                </strong>
              </div>

              <div>
                <span>Time Out</span>
                <strong>
                  {formatTime(selectedTravelPlan.time_out)}
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
                    <span>LOR</span>
                    <p>
                      {selectedTravelPlan
                        .branch_findings.lor ||
                        "No finding recorded."}
                    </p>
                  </div>

                  <div>
                    <span>LOS</span>
                    <p>
                      {selectedTravelPlan
                        .branch_findings.los ||
                        "No finding recorded."}
                    </p>
                  </div>

                  <div>
                    <span>LDF</span>
                    <p>
                      {selectedTravelPlan
                        .branch_findings.ldf ||
                        "No finding recorded."}
                    </p>
                  </div>

                  <div>
                    <span>DCS</span>
                    <p>
                      {selectedTravelPlan
                        .branch_findings.dcs ||
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
                  No travel photos available.
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

                        <div className="calendar-summary-photo-info">
                          <span>{photo.label}</span>

                          {photo.captured_at && (
                            <small>
                              {new Date(photo.captured_at).toLocaleString("en-PH", {
                                timeZone: "Asia/Manila",
                                month: "short",
                                day: "2-digit",
                                year: "numeric",
                                hour: "numeric",
                                minute: "2-digit",
                                hour12: true,
                              })}
                            </small>
                          )}

                          {photo.latitude && photo.longitude && (
                            <small>
                              GPS: {Number(photo.latitude).toFixed(6)},{" "}
                              {Number(photo.longitude).toFixed(6)}
                            </small>
                          )}
                        </div>
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