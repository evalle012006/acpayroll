import { useEffect, useMemo, useState } from "react";
import api from "../api/axiosClient";
import "../styles/Calendar.css";
import Select from "react-select";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

const emptyNoteForm = {
  title: "",
  involved_staff: "",
  content: "",
};



export default function TravelPlan() {
  const today = new Date();

  const [month, setMonth] = useState(today.getMonth());
  const [year, setYear] = useState(today.getFullYear());
  const [visitRange, setVisitRange] = useState("month");
  const [view, setView] = useState("Month");
  const [activeMenu, setActiveMenu] = useState("Travel Plan");
  const [activities, setActivities] = useState([]);

  const [selectedPlan, setSelectedPlan] = useState(null);
  const [detailTab, setDetailTab] = useState("photos");
  const [previewPhoto, setPreviewPhoto] = useState(null);

  const [staffRows, setStaffRows] = useState([]);
  const [staffPositionFilter, setStaffPositionFilter] = useState("");
  const [branchScopeRows, setBranchScopeRows] = useState([]);
  const [showCreatePlan, setShowCreatePlan] = useState(false);
  const [plans, setPlans] = useState([]);
  const [activityDateFilter, setActivityDateFilter] = useState("");
  const [planPhotos, setPlanPhotos] = useState([]);
  const [planNotes, setPlanNotes] = useState([]);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState("");
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [selectedBranchVisit, setSelectedBranchVisit] = useState(null);

  const [showNoteForm, setShowNoteForm] = useState(false);
  const [noteForm, setNoteForm] = useState(emptyNoteForm);
  const [showCreateActivity, setShowCreateActivity] = useState(false);

  const [activityForm, setActivityForm] = useState({
    title: "",
    date_from: "",
    date_to: "",
    days: "",
    subject: "",
    venue: "",
    description: "",
  });

  const [planForm, setPlanForm] = useState({
    title: "",
    plan_date: "",
    employee_name: "",
    position: "",
    branch_name: "",
    description: "",
  });

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDay = firstDay.getDay();
    const totalDays = lastDay.getDate();
    const prevLastDay = new Date(year, month, 0).getDate();

    const cells = [];

    for (let i = startDay - 1; i >= 0; i--) {
      cells.push({ day: prevLastDay - i, currentMonth: false });
    }

    for (let d = 1; d <= totalDays; d++) {
      cells.push({ day: d, currentMonth: true });
    }

    let nextDay = 1;
    while (cells.length < 42) {
      cells.push({ day: nextDay++, currentMonth: false });
    }

    return cells;
  }, [month, year]);

  const selectedDay =
    today.getMonth() === month && today.getFullYear() === year
      ? today.getDate()
      : null;

  const branchRows = useMemo(() => {
    return branchScopeRows;
  }, [branchScopeRows]);

  const staffOptions = useMemo(
    () =>
      staffRows.map((staff) => ({
        value: staff.employee_name,
        label: `${staff.employee_name} • ${staff.position} • ${staff.branch_name}`,
      })),
    [staffRows]
  );

  const staffPositionOptions = useMemo(() => {
    return [...new Set(staffRows.map((s) => s.position).filter(Boolean))];
  }, [staffRows]);

  const filteredStaffRows = useMemo(() => {
    if (!staffPositionFilter) return staffRows;

    return staffRows.filter(
      (s) => String(s.position || "") === staffPositionFilter
    );
  }, [staffRows, staffPositionFilter]);

  const selectedDateText = planForm.plan_date;

  const selectedDatePlans = plans.filter((p) => {
    const d = String(p.plan_date || "").slice(0, 10);
    return d === selectedDateText;
  });

  const filteredActivityPlans = useMemo(() => {
    if (!activityDateFilter) return plans;

    return plans.filter((p) => {
      const d = String(p.plan_date || "").slice(0, 10);
      return d === activityDateFilter;
    });
  }, [plans, activityDateFilter]);

  const mostVisitedBranches = useMemo(() => {
  const now = new Date();

  let filteredPlans = [...plans];

  if (visitRange === "week") {
    const weekAgo = new Date();
    weekAgo.setDate(now.getDate() - 7);

    filteredPlans = plans.filter(
      (p) => new Date(p.plan_date) >= weekAgo
    );
  }

  if (visitRange === "month") {
    filteredPlans = plans.filter((p) => {
      const d = new Date(p.plan_date);
      return (
        d.getMonth() === month &&
        d.getFullYear() === year
      );
    });
  }

  if (visitRange === "year") {
    filteredPlans = plans.filter((p) => {
      const d = new Date(p.plan_date);
      return d.getFullYear() === year;
    });
  }

  const counts = {};

  branchRows.forEach((branch) => {
    if (!branch.branch_name) return;
    counts[branch.branch_name] = 0;
  });

  filteredPlans.forEach((plan) => {
    if (!plan.branch_name) return;

    if (counts[plan.branch_name] !== undefined) {
      counts[plan.branch_name] += 1;
    }
  });

  return Object.entries(counts)
    .map(([branch, count]) => ({
      branch,
      count,
    }))
    .sort((a, b) => b.count - a.count);
}, [plans, branchRows, visitRange, month, year]);

const selectedBranchPlans = useMemo(() => {
  let filtered = [...plans];

  if (visitRange === "week") {
    const weekAgo = new Date();
    weekAgo.setDate(new Date().getDate() - 7);

    filtered = filtered.filter((p) => new Date(p.plan_date) >= weekAgo);
  }

  if (visitRange === "month") {
    filtered = filtered.filter((p) => {
      const d = new Date(p.plan_date);
      return d.getMonth() === month && d.getFullYear() === year;
    });
  }

  if (visitRange === "year") {
    filtered = filtered.filter((p) => {
      const d = new Date(p.plan_date);
      return d.getFullYear() === year;
    });
  }

  return filtered.filter((p) => p.branch_name === selectedBranchVisit);
}, [plans, selectedBranchVisit, visitRange, month, year]);

  const maxBranchVisits = Math.max(
    1,
    ...mostVisitedBranches.map((b) => b.count)
  );

  const fetchActivities = async () => {
    try {
      const res = await api.get("/calendar-activities");
      setActivities(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Fetch activities error:", err);
      setActivities([]);
    }
  };

  const fetchScopedStaff = async () => {
    try {
      const res = await api.get("/travel-plans/staff-scope");
      setStaffRows(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Fetch travel staff scope error:", err);
      setStaffRows([]);
    }
  };

  const fetchScopedBranches = async () => {
    try {
      const res = await api.get("/travel-plans/branch-scope");
      setBranchScopeRows(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Fetch branch scope error:", err);
      setBranchScopeRows([]);
    }
  };

  const fetchPlans = async () => {
    try {
      const res = await api.get("/travel-plans");
      setPlans(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Fetch plans error:", err);
      setPlans([]);
    }
  };

  const fetchPlanPhotos = async (planId) => {
    try {
      const res = await api.get(`/travel-plans/${planId}/photos`);
      setPlanPhotos(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Fetch plan photos error:", err);
      setPlanPhotos([]);
    }
  };

  const fetchPlanNotes = async (planId) => {
    try {
      const res = await api.get(`/travel-plans/${planId}/notes`);
      setPlanNotes(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Fetch plan notes error:", err);
      setPlanNotes([]);
    }
  };

  useEffect(() => {
    fetchActivities();
    fetchScopedStaff();
    fetchScopedBranches();
    fetchPlans();
  }, []);

  const saveTravelPlan = async () => {
    if (!planForm.title || !planForm.plan_date) {
      alert("Title and date are required.");
      return;
    }

    try {
      await api.post("/travel-plans", planForm);

      setShowCreatePlan(false);
      setPlanForm({
        title: "",
        plan_date: "",
        employee_name: "",
        position: "",
        branch_name: "",
        description: "",
      });

      fetchPlans();
    } catch (err) {
      console.error("Save plan error:", err);
      alert(err.response?.data?.message || "Failed to save plan.");
    }
  };

  const saveActivity = async () => {
    if (!activityForm.title || !activityForm.date_from || !activityForm.date_to) {
      alert("Title, Date From, and Date To are required.");
      return;
    }

    try {
      await api.post("/calendar-activities", activityForm);

      setShowCreateActivity(false);
      setActivityForm({
        title: "",
        date_from: "",
        date_to: "",
        days: "",
        subject: "",
        venue: "",
        description: "",
      });

      fetchActivities();

      alert("Activity saved successfully.");
    } catch (err) {
      console.error("Save activity error:", err);
      alert(err.response?.data?.message || "Failed to save activity.");
    }
  };

  const uploadPlanPhotos = async (type, files) => {
    if (!selectedPlan?.id || !files?.length) return;

    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
        });
      });

      const formData = new FormData();

      Array.from(files).forEach((file) => {
        formData.append("photos", file);
      });

      formData.append("type", type);
      formData.append("latitude", position.coords.latitude);
      formData.append("longitude", position.coords.longitude);

      await api.post(`/travel-plans/${selectedPlan.id}/photos`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      fetchPlanPhotos(selectedPlan.id);
      fetchPlans();
      alert("Photo uploaded successfully.");
    } catch (err) {
      console.error("Upload photos error:", err);
      alert("Failed to upload photo. Please allow camera/location permission.");
    }
  };

  const deletePlanPhoto = async (photoId) => {
    if (!selectedPlan?.id) return;
    if (!window.confirm("Delete this photo?")) return;

    try {
      await api.delete(`/travel-plans/photos/${photoId}`);
      fetchPlanPhotos(selectedPlan.id);
    } catch (err) {
      console.error("Delete photo error:", err);
      alert("Failed to delete photo.");
    }
  };

  const openPlan = (plan) => {
    setSelectedPlan(plan);
    setDetailTab("photos");
    setShowNoteForm(false);
    setNoteForm(emptyNoteForm);
    fetchPlanPhotos(plan.id);
    fetchPlanNotes(plan.id);
  };

  const closePlan = () => {
    setSelectedPlan(null);
    setPlanPhotos([]);
    setPlanNotes([]);
    setShowNoteForm(false);
    setNoteForm(emptyNoteForm);
  };

  const createNote = async (type) => {
    if (!selectedPlan?.id) return;

    if (!noteForm.title.trim()) {
      alert("Title is required.");
      return;
    }

    try {
      await api.post(`/travel-plans/${selectedPlan.id}/notes`, {
        note_type: type,
        title: noteForm.title,
        involved_staff: noteForm.involved_staff,
        content: noteForm.content,
      });

      setNoteForm(emptyNoteForm);
      setShowNoteForm(false);
      fetchPlanNotes(selectedPlan.id);
    } catch (err) {
      console.error("Create note error:", err);
      alert(err.response?.data?.message || "Failed to save.");
    }
  };

  const deleteNote = async (noteId) => {
    if (!selectedPlan?.id) return;
    if (!window.confirm("Delete this record?")) return;

    try {
      await api.delete(`/travel-plans/notes/${noteId}`);
      fetchPlanNotes(selectedPlan.id);
    } catch (err) {
      console.error("Delete note error:", err);
      alert("Failed to delete.");
    }
  };

  const getFirstPhotoTime = (type) => {
    const photo = planPhotos.find((p) => p.photo_type === type);
    return photo?.captured_at || photo?.created_at || null;
  };

  const formatTime = (value) => {
    if (!value) return "Not yet";

    return new Date(value).toLocaleString("en-PH", {
      timeZone: "Asia/Manila",
      month: "short",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const getTravelDuration = () => {
    const checkIn = getFirstPhotoTime("CHECK_IN");
    const checkOut = getFirstPhotoTime("CHECK_OUT");

    if (!checkIn || !checkOut) return "Not complete";

    const diffMs = new Date(checkOut) - new Date(checkIn);
    if (diffMs < 0) return "Invalid time";

    const hours = Math.floor(diffMs / 1000 / 60 / 60);
    const minutes = Math.floor((diffMs / 1000 / 60) % 60);

    return `${hours} hr ${minutes} min`;
  };

  const renderPhotoGrid = (type) => (
    <div className="travel-photo-grid">
      {planPhotos
        .filter((p) => p.photo_type === type)
        .map((photo) => (
          <div key={photo.id} className="travel-photo-card">
            <img
              src={photo.signed_url}
              alt={photo.photo_type}
              className="travel-photo-click"
              onClick={() => setPreviewPhoto(photo.signed_url)}
            />

            {selectedPlan?.status !== "Completed" && (
              <button
                type="button"
                className="travel-photo-delete"
                onClick={() => deletePlanPhoto(photo.id)}
              >
                ×
              </button>
            )}

            <div>
              <b>{photo.photo_type}</b>
              <span>{formatTime(photo.captured_at || photo.created_at)}</span>

              {photo.latitude && photo.longitude && (
                <small>
                  {photo.latitude}, {photo.longitude}
                </small>
              )}
            </div>
          </div>
        ))}
    </div>
  );

  const renderNotes = (type) => {
    const notes = planNotes.filter((n) => n.note_type === type);

    return (
      <div className="travel-note-list">
        {notes.length === 0 ? (
          <div className="travel-empty">No records yet.</div>
        ) : (
          notes.map((note) => (
            <div key={note.id} className="travel-note-card">
              <div className="travel-note-head">
                <div>
                  <h4>{note.title}</h4>
                  <span>{formatTime(note.created_at)}</span>
                </div>

                {selectedPlan?.status !== "Completed" && (
                  <button
                    type="button"
                    onClick={() => deleteNote(note.id)}
                  >
                    ×
                  </button>
                )}
              </div>

              {note.involved_staff && (
                <p>
                  <b>Involved:</b> {note.involved_staff}
                </p>
              )}

              {note.content && <p>{note.content}</p>}
            </div>
          ))
        )}
      </div>
    );
  };

  const renderNoteTab = (type) => {
    const isReview = type === "REVIEW";
    const isCompleted = selectedPlan?.status === "Completed";


    return (
      <div className="travel-tab-content">
        {!showNoteForm ? (
          !isCompleted && (
            <button
              type="button"
              className="travel-create-note-btn"
              onClick={() => {
                setShowNoteForm(true);
                setNoteForm(emptyNoteForm);
              }}
            >
              + Create {isReview ? "Review" : "Findings"}
            </button>
          )
        ) : (
          <div className="travel-note-form">
            <label>
              Title
              <input
                type="text"
                placeholder="Enter title"
                value={noteForm.title}
                onChange={(e) =>
                  setNoteForm((p) => ({ ...p, title: e.target.value }))
                }
              />
            </label>

            <label>
              Involved
              <Select
                className="travel-staff-search"
                classNamePrefix="select"
                options={staffOptions}
                placeholder="Search staff..."
                isClearable
                value={
                  staffOptions.find((o) => o.value === noteForm.involved_staff) || null
                }
                onChange={(option) =>
                  setNoteForm((p) => ({
                    ...p,
                    involved_staff: option?.value || "",
                  }))
                }
              />
            </label>

            <label>
              Write
              <textarea
                rows={6}
                placeholder={isReview ? "Write review..." : "Write findings..."}
                value={noteForm.content}
                onChange={(e) =>
                  setNoteForm((p) => ({ ...p, content: e.target.value }))
                }
              />
            </label>

            <div className="travel-note-actions">
              <button
                type="button"
                onClick={() => {
                  setShowNoteForm(false);
                  setNoteForm(emptyNoteForm);
                }}
              >
                Cancel
              </button>

              <button type="button" onClick={() => createNote(type)}>
                Save
              </button>
            </div>
          </div>
        )}

        {renderNotes(type)}
      </div>
    );
  };

  const submitPlan = async () => {
    if (!selectedPlan?.id) return;

    if (!window.confirm("Submit this travel plan as completed?")) return;

    try {
      const res = await api.put(`/travel-plans/${selectedPlan.id}/submit`);

      setSelectedPlan(res.data.plan);
      fetchPlans();

      alert("Travel plan completed.");
    } catch (err) {
      console.error("Submit plan error:", err);
      alert(err.response?.data?.message || "Failed to submit plan.");
    }
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
              "Travel Plan",
              "Calendar",
              "History",
            ].map((menu) => (
              <button
                key={menu}
                type="button"
                className={activeMenu === menu ? "active" : ""}
                onClick={() => setActiveMenu(menu)}
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

            <div className="travel-top-actions">
              <button
                className="travel-create-btn"
                type="button"
                onClick={() => {
                  setPlanForm({
                    title: "",
                    plan_date: "",
                    employee_name: "",
                    position: "",
                    branch_name: "",
                    description: "",
                  });
                  setShowCreatePlan(true);
                }}
              >
                + Create Plan
              </button>

              <button
                className="travel-create-btn secondary"
                type="button"
                onClick={() => setShowCreateActivity(true)}
              >
                + Create Activity
              </button>

            </div>
          </div>

          {activeMenu === "Travel Plan" && (
            <>
              <div className="travel-plan-layout">
                {/* LEFT SIDE */}
                <div className="travel-plan-calendar-card">
                  <div className="travel-mini-calendar">
                    {DAYS.map((d) => (
                      <div key={d} className="travel-mini-day-header">
                        {d}
                      </div>
                    ))}

                    {calendarDays.map((cell, idx) => {
                      const date = `${year}-${String(month + 1).padStart(
                        2,
                        "0"
                      )}-${String(cell.day).padStart(2, "0")}`;

                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            if (!cell.currentMonth) return;
                            setPlanForm((p) => ({
                              ...p,
                              plan_date: date,
                            }));
                          }}
                          className={`travel-mini-date ${
                            cell.currentMonth ? "" : "muted"
                          } ${planForm.plan_date === date ? "selected" : ""}`}
                        >
                          {cell.day}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* RIGHT SIDE */}
                <div className="travel-right-column">

                  <div className="travel-events-card">
                    <div className="travel-card-header">
                      <div>
                        <h3>Most Visited Branches</h3>
                        <p>Based on created travel plans.</p>
                      </div>

                      <select
                        value={visitRange}
                        onChange={(e) => setVisitRange(e.target.value)}
                        className="travel-range-select"
                      >
                        <option value="week">Week</option>
                        <option value="month">Month</option>
                        <option value="year">Year</option>
                      </select>
                    </div>

                    {mostVisitedBranches.length === 0 ? (
                      <div className="travel-empty">
                        No branch visits yet.
                      </div>
                    ) : (
                      <div className="branch-visit-chart">
                        {mostVisitedBranches.map((item) => (
                          <div
                            key={item.branch}
                            className={`travel-branch-item ${
                              selectedBranchVisit === item.branch ? "active" : ""
                            }`}
                            onClick={() =>
                              setSelectedBranchVisit(
                                selectedBranchVisit === item.branch
                                  ? null
                                  : item.branch
                              )
                            }
                          >
                            <div className="branch-visit-info">
                              <span className="travel-branch-name">
                                {item.branch}
                              </span>

                              <b className="travel-branch-count">
                                {item.count}
                              </b>
                            </div>

                            <div className="branch-visit-bar">
                              <div
                                style={{
                                  width: `${
                                    (item.count / maxBranchVisits) * 100
                                  }%`,
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                </div>

              </div>

              {/* ACTIVITIES */}
              <div className="travel-dashboard-card travel-activities-card">

                <div className="travel-dashboard-head">
                  <div>
                    <h3>Activities & Events</h3>
                    <p>All travel plans for your scope.</p>
                  </div>

                  <div className="travel-activity-filter">
                    <input
                      type="date"
                      value={activityDateFilter}
                      onChange={(e) => setActivityDateFilter(e.target.value)}
                    />

                    {activityDateFilter && (
                      <button
                        type="button"
                        onClick={() => setActivityDateFilter("")}
                      >
                        Clear
                      </button>
                    )}

                    <span>{filteredActivityPlans.length} Plans</span>
                  </div>
                </div>

                {filteredActivityPlans.length === 0 ? (
                  <div className="travel-empty">
                    No activities yet.
                  </div>
                ) : (
                  <div className="travel-activity-list">
                    {filteredActivityPlans.map((plan) => (
                      <div
                        key={plan.id}
                        className="travel-activity-card"
                        onClick={() => openPlan(plan)}
                      >
                        <div>
                          <strong>{plan.title}</strong>
                          <p>{plan.branch_name || "No Branch"}</p>
                          <small>
                            {plan.description || "No description"}
                          </small>
                        </div>

                        <div className="travel-activity-right">
                          <span>
                            {String(plan.plan_date).slice(0, 10)}
                          </span>

                          <b
                            className={`travel-status ${
                              plan.status === "Completed"
                                ? "completed"
                                : "pending"
                            }`}
                          >
                            {plan.status || "Pending"}
                          </b>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

              </div>

              {/* STAFF SCOPE */}
              <div className="travel-dashboard-card">
                <div className="travel-dashboard-head">
                  <div>
                    <h3>Staff Scope</h3>
                    <p>Staff visible based on your position.</p>
                  </div>

                  <div className="travel-staff-filter">
                    <select
                      value={staffPositionFilter}
                      onChange={(e) => setStaffPositionFilter(e.target.value)}
                    >
                      <option value="">All Positions</option>
                      {staffPositionOptions.map((pos) => (
                        <option key={pos} value={pos}>
                          {pos}
                        </option>
                      ))}
                    </select>

                    <span>{filteredStaffRows.length} Staff</span>
                  </div>
                </div>

                {filteredStaffRows.length === 0 ? (
                  <div className="travel-empty">
                    No staff found.
                  </div>
                ) : (
                  <div className="travel-staff-list">
                    {filteredStaffRows.map((staff) => (
                      <div
                        key={staff.employee_no}
                        className="travel-staff-card"
                      >
                        <div>
                          <strong>{staff.employee_name}</strong>

                          <p>{staff.position}</p>

                          <small>{staff.branch_name}</small>
                        </div>

                        <div className="travel-staff-right">
                          <span>{staff.area}</span>
                          <span>{staff.region}</span>
                          <div
                            className={
                              staff.travel_status === "Submitted"
                                ? "travel-staff-status submitted"
                                : "travel-staff-status pending"
                            }
                          >
                            {staff.travel_status}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {activeMenu === "Calendar" && (
            <div className="travel-month-grid">
              {DAYS.map((d) => (
                <div key={d} className="travel-day-header">
                  {d}
                </div>
              ))}

              {calendarDays.map((cell, idx) => {
                const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(
                  cell.day
                ).padStart(2, "0")}`;

                const dayActivities = activities.filter((a) => {
                  const from = String(a.date_from || "").slice(0, 10);
                  const to = String(a.date_to || "").slice(0, 10);

                  return date >= from && date <= to;
                });

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      if (!cell.currentMonth) return;

                      setSelectedCalendarDate(date);
                    }}
                    className={`travel-date-cell ${
                      cell.currentMonth ? "" : "muted"
                    } ${
                      cell.currentMonth && cell.day === selectedDay ? "selected" : ""
                    }`}
                  >
                    <span className="travel-date-number">
                      {String(cell.day).padStart(2, "0")}
                    </span>

                    {dayActivities.length > 0 && (
                      <span className="travel-date-plan-count">
                        {dayActivities.length} activity{dayActivities.length > 1 ? "ies" : ""}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}


          {["History"].includes(activeMenu) && (
            <div className="travel-dashboard-card">
              <div className="travel-empty">No data yet.</div>
            </div>
          )}

          {showCreateActivity && (
            <div className="travel-plan-modal-backdrop">
              <div className="travel-plan-modal">
                <div className="travel-plan-modal-head">
                  <h3>Create Activity</h3>
                  <button type="button" onClick={() => setShowCreateActivity(false)}>
                    ×
                  </button>
                </div>

                <div className="travel-plan-form">
                  <label>
                    Title
                    <input
                      type="text"
                      value={activityForm.title}
                      onChange={(e) =>
                        setActivityForm((p) => ({ ...p, title: e.target.value }))
                      }
                    />
                  </label>

                  <label>
                    Date From
                    <input
                      type="date"
                      value={activityForm.date_from}
                      onChange={(e) =>
                        setActivityForm((p) => ({ ...p, date_from: e.target.value }))
                      }
                    />
                  </label>

                  <label>
                    Date To
                    <input
                      type="date"
                      value={activityForm.date_to}
                      onChange={(e) =>
                        setActivityForm((p) => ({ ...p, date_to: e.target.value }))
                      }
                    />
                  </label>

                  <label>
                    Days
                    <input
                      type="number"
                      value={activityForm.days}
                      onChange={(e) =>
                        setActivityForm((p) => ({ ...p, days: e.target.value }))
                      }
                    />
                  </label>

                  <label>
                    Subject
                    <input
                      type="text"
                      value={activityForm.subject}
                      onChange={(e) =>
                        setActivityForm((p) => ({ ...p, subject: e.target.value }))
                      }
                    />
                  </label>

                  <label>
                    Venue
                    <input
                      type="text"
                      value={activityForm.venue}
                      onChange={(e) =>
                        setActivityForm((p) => ({ ...p, venue: e.target.value }))
                      }
                    />
                  </label>

                  <label>
                    Description
                    <textarea
                      rows="4"
                      value={activityForm.description}
                      onChange={(e) =>
                        setActivityForm((p) => ({ ...p, description: e.target.value }))
                      }
                    />
                  </label>
                </div>

                <div className="travel-plan-modal-actions">
                  <button type="button" onClick={() => setShowCreateActivity(false)}>
                    Cancel
                  </button>

                  <button type="button" className="primary" onClick={saveActivity}>
                    Save Activity
                  </button>
                </div>
              </div>
            </div>
          )}

          {showCreatePlan && (
            <div className="travel-plan-modal-backdrop">
              <div className="travel-plan-modal">
                <div className="travel-plan-modal-head">
                  <h3>Create Travel Plan</h3>
                  <button type="button" onClick={() => setShowCreatePlan(false)}>
                    ×
                  </button>
                </div>

                <div className="travel-plan-form">
                  <label>
                    Title
                    <input
                      type="text"
                      placeholder="Enter plan title"
                      value={planForm.title}
                      onChange={(e) =>
                        setPlanForm((p) => ({
                          ...p,
                          title: e.target.value,
                        }))
                      }
                    />
                  </label>

                  <label>
                    Employee

                    <Select
                      className="travel-staff-search"
                      classNamePrefix="select"
                      isSearchable
                      isClearable
                      placeholder="Search employee..."

                      options={staffRows.map((staff) => ({
                        value: staff.employee_no,
                        label: `${staff.employee_name} • ${staff.position}`,
                      }))}

                      value={
                        staffRows
                          .filter((s) => s.employee_name === planForm.employee_name)
                          .map((s) => ({
                            value: s.employee_no,
                            label: `${s.employee_name} • ${s.position}`,
                          }))[0] || null
                      }

                      onChange={(option) => {
                        const staff = staffRows.find(
                          (s) => s.employee_no === option?.value
                        );

                        setPlanForm((prev) => ({
                          ...prev,
                          employee_name: staff?.employee_name || "",
                          position: staff?.position || "",
                        }));
                      }}

                      filterOption={(option, input) =>
                        option.label
                          .toLowerCase()
                          .includes(input.toLowerCase())
                      }
                    />
                  </label>

                  <label>
                    Position
                    <input
                      type="text"
                      value={planForm.position}
                      readOnly
                    />
                  </label>

                  <label>
                    Date
                    <input
                      type="date"
                      value={planForm.plan_date}
                      onChange={(e) =>
                        setPlanForm((p) => ({
                          ...p,
                          plan_date: e.target.value,
                        }))
                      }
                    />
                  </label>

                  <label>
                    Branch

                    <Select
                      className="travel-staff-search"
                      classNamePrefix="select"
                      isSearchable
                      isClearable
                      placeholder="Search branch..."

                      options={branchRows.map((branch) => ({
                        value: branch.branch_name,
                        label: branch.branch_name,
                      }))}

                      value={
                        planForm.branch_name
                          ? {
                              value: planForm.branch_name,
                              label: planForm.branch_name,
                            }
                          : null
                      }

                      onChange={(option) =>
                        setPlanForm((prev) => ({
                          ...prev,
                          branch_name: option?.value || "",
                        }))
                      }

                      filterOption={(option, input) =>
                        option.label
                          .toLowerCase()
                          .includes(input.toLowerCase())
                      }
                    />
                  </label>

                  <label>
                    Description
                    <textarea
                      rows="4"
                      placeholder="Enter details"
                      value={planForm.description}
                      onChange={(e) =>
                        setPlanForm((p) => ({
                          ...p,
                          description: e.target.value,
                        }))
                      }
                    />
                  </label>
                </div>

                <div className="travel-plan-modal-actions">
                  <button type="button" onClick={() => setShowCreatePlan(false)}>
                    Cancel
                  </button>

                  <button
                    type="button"
                    className="primary"
                    onClick={saveTravelPlan}
                  >
                    Save Plan
                  </button>
                </div>
              </div>
            </div>
          )}

          {selectedCalendarDate && (
            <div className="travel-plan-modal-backdrop">
              <div className="travel-plan-modal">
                <div className="travel-plan-modal-head">
                  <h3>Activities for {selectedCalendarDate}</h3>
                  <button type="button" onClick={() => setSelectedCalendarDate("")}>
                    ×
                  </button>
                </div>

                {activities.filter((a) => {
                  const from = String(a.date_from || "").slice(0, 10);
                  const to = String(a.date_to || "").slice(0, 10);
                  return selectedCalendarDate >= from && selectedCalendarDate <= to;
                }).length === 0 ? (
                  <div className="travel-empty">No activity for this date.</div>
                ) : (
                  <div className="travel-activity-list">
                    {activities
                      .filter((a) => {
                        const from = String(a.date_from || "").slice(0, 10);
                        const to = String(a.date_to || "").slice(0, 10);
                        return selectedCalendarDate >= from && selectedCalendarDate <= to;
                      })
                      .map((activity) => (
                        <div
                          key={activity.id}
                          className="travel-activity-card"
                          onClick={() => {
                            setSelectedCalendarDate("");
                            setSelectedActivity(activity);
                          }}
                        >
                          <div>
                            <strong>{activity.title}</strong>
                            <p>{activity.subject || "No subject"}</p>
                            <small>{activity.description || "No description"}</small>
                          </div>

                          <div className="travel-activity-right">
                            <span>
                              {activity.date_from} to {activity.date_to}
                            </span>
                            <b className="travel-status pending">
                              {activity.days || 0} day{Number(activity.days) > 1 ? "s" : ""}
                            </b>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {selectedActivity && (
            <div className="travel-plan-modal-backdrop">
              <div className="travel-plan-modal">
                <div className="travel-plan-modal-head activity-close-only">
                  <button
                    type="button"
                    onClick={() => setSelectedActivity(null)}
                  >
                    ×
                  </button>
                </div>

                <div className="travel-plan-detail">
                  <div className="activity-detail-modal">
                    <div className="activity-detail-hero">
                      <h3>{selectedActivity.title}</h3>
                      <span>{selectedActivity.days} Days</span>
                    </div>

                    <div className="activity-detail-grid">
                      <div>
                        <small>Date From</small>
                        <b>{selectedActivity.date_from}</b>
                      </div>

                      <div>
                        <small>Date To</small>
                        <b>{selectedActivity.date_to}</b>
                      </div>

                      <div>
                        <small>Subject</small>
                        <b>{selectedActivity.subject || "No subject"}</b>
                      </div>

                      <div>
                        <small>Venue</small>
                        <b>{selectedActivity.venue || "No venue"}</b>
                      </div>
                    </div>

                    <div className="activity-detail-description">
                      <small>Description</small>
                      <p>{selectedActivity.description || "No description"}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {selectedPlan && (
            <div className="travel-plan-modal-backdrop">
              <div className="travel-plan-modal">
                <div className="travel-plan-modal-head">
                  <h3>{selectedPlan.title}</h3>

                  <button type="button" onClick={closePlan}>
                    ×
                  </button>
                </div>

                <div className="travel-plan-detail">
                  <p>
                    <b>Branch:</b> {selectedPlan.branch_name}
                  </p>
                  <p>
                    <b>Date:</b> {String(selectedPlan.plan_date).slice(0, 10)}
                  </p>
                  <p>
                    <b>Description:</b>{" "}
                    {selectedPlan.description || "No description"}
                  </p>

                  <div className="travel-time-summary">
                    <div>
                      <b>Time In:</b>
                      <span>{formatTime(getFirstPhotoTime("CHECK_IN"))}</span>
                    </div>

                    <div>
                      <b>Time Out:</b>
                      <span>{formatTime(getFirstPhotoTime("CHECK_OUT"))}</span>
                    </div>

                    <div>
                      <b>Duration:</b>
                      <span>{getTravelDuration()}</span>
                    </div>
                  </div>

                  <div className="travel-submit-area">
                    {selectedPlan.status !== "Completed" ? (
                      <button
                        type="button"
                        className="travel-submit-btn"
                        onClick={submitPlan}
                      >
                        ✔ Submit Travel Report
                      </button>
                    ) : (
                      <div className="travel-completed-badge">
                        ✔ Completed
                      </div>
                    )}
                  </div>

                  <div className="travel-stepper">
                    <button
                      className={`travel-step ${detailTab==="checkin"?"active":""}`}
                      onClick={()=>{
                        setDetailTab("checkin");
                        setShowNoteForm(false);
                      }}
                    >
                        <span>1</span>
                        <label>Time In</label>
                    </button>

                    <div className="travel-step-line"></div>

                    <button
                      className={`travel-step ${detailTab==="review"?"active":""}`}
                      onClick={()=>{
                        setDetailTab("review");
                        setShowNoteForm(false);
                      }}
                    >
                        <span>2</span>
                        <label>Review</label>
                    </button>

                    <div className="travel-step-line"></div>

                    <button
                      className={`travel-step ${detailTab==="findings"?"active":""}`}
                      onClick={()=>{
                        setDetailTab("findings");
                        setShowNoteForm(false);
                      }}
                    >
                        <span>3</span>
                        <label>Findings</label>
                    </button>

                    <div className="travel-step-line"></div>

                    <button
                      className={`travel-step ${detailTab==="photos"?"active":""}`}
                      onClick={()=>{
                        setDetailTab("photos");
                        setShowNoteForm(false);
                      }}
                    >
                        <span>4</span>
                        <label>Upload</label>
                    </button>

                    <div className="travel-step-line"></div>

                    <button
                      className={`travel-step ${detailTab==="checkout"?"active":""}`}
                      onClick={()=>{
                        setDetailTab("checkout");
                        setShowNoteForm(false);
                      }}
                    >
                        <span>5</span>
                        <label>Time Out</label>
                    </button>

                  </div>

                  {detailTab === "review" && renderNoteTab("REVIEW")}
                  {detailTab === "findings" && renderNoteTab("FINDINGS")}

                  {detailTab === "photos" && (
                    <div className="travel-tab-content">
                      {selectedPlan.status !== "Completed" && (
                        <label className="travel-photo-upload-btn">
                          + Upload Photos
                          <input
                            type="file"
                            hidden
                            multiple
                            accept="image/*"
                            onChange={(e) =>
                              uploadPlanPhotos("GENERAL", e.target.files)
                            }
                          />
                        </label>
                      )}

                      {renderPhotoGrid("GENERAL")}
                    </div>
                  )}

                  {detailTab === "checkin" && (
                    <div className="travel-tab-content">
                      {selectedPlan.status !== "Completed" && (
                        <label className="travel-photo-upload-btn">
                          Take Check In Picture
                          <input
                            type="file"
                            hidden
                            capture="environment"
                            accept="image/*"
                            onChange={(e) =>
                              uploadPlanPhotos("CHECK_IN", e.target.files)
                            }
                          />
                        </label>
                      )}

                      {renderPhotoGrid("CHECK_IN")}
                    </div>
                  )}

                  {detailTab === "checkout" && (
                    <div className="travel-tab-content">
                      <label className="travel-photo-upload-btn">
                        Take Check Out Picture
                        <input
                          type="file"
                          hidden
                          capture="environment"
                          accept="image/*"
                          onChange={(e) =>
                            uploadPlanPhotos("CHECK_OUT", e.target.files)
                          }
                        />
                      </label>

                      {renderPhotoGrid("CHECK_OUT")}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {selectedBranchVisit && (
            <div className="travel-plan-modal-backdrop">
              <div className="travel-plan-modal">
                <div className="travel-plan-modal-head">
                  <h3>
                      {selectedBranchVisit} Visit History
                  </h3>
                    <div className="travel-visit-total">
                      <span>Total Visits</span>
                      <b>{selectedBranchPlans.length}</b>
                    </div>
                  <button type="button" onClick={() => setSelectedBranchVisit(null)}>
                    ×
                  </button>
                </div>

                <div className="travel-activity-list">
                  {selectedBranchPlans.length === 0 ? (
  <div className="travel-empty">
    No visits found for this period.
  </div>
) : (
  selectedBranchPlans.map((plan) => (
                      <div key={plan.id} className="travel-activity-card">
                        <div>
                          <strong>{plan.employee_name || "No employee"}</strong>
                            <p>{plan.position || "No position"}</p>
                            <p>
                              <b>Activity:</b> {plan.title || "-"}
                            </p>
                            <small>{plan.description || "No description"}</small>
                        </div>

                        <div className="travel-activity-right">
                          <span>{String(plan.plan_date).slice(0, 10)}</span>
                          <b
                            className={`travel-status ${
                              plan.status === "Completed" ? "completed" : "pending"
                            }`}
                          >
                            {plan.status || "Pending"}
                          </b>
                        </div>
                      </div>
                      ))
                    )}
                </div>
              </div>
            </div>
          )}

          {previewPhoto && (
            <div
              className="travel-photo-preview-backdrop"
              onClick={() => setPreviewPhoto(null)}
            >
              <div
                className="travel-photo-preview-modal"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  className="travel-photo-close"
                  onClick={() => setPreviewPhoto(null)}
                >
                  ✕
                </button>

                <img
                  src={previewPhoto}
                  alt="Preview"
                  className="travel-photo-preview-image"
                />
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}