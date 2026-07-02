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
  const [view, setView] = useState("Month");
  const [activeMenu, setActiveMenu] = useState("Travel Plan");

  const [selectedPlan, setSelectedPlan] = useState(null);
  const [detailTab, setDetailTab] = useState("photos");
  const [previewPhoto, setPreviewPhoto] = useState(null);

  const [staffRows, setStaffRows] = useState([]);
  const [showCreatePlan, setShowCreatePlan] = useState(false);
  const [plans, setPlans] = useState([]);
  const [planPhotos, setPlanPhotos] = useState([]);
  const [planNotes, setPlanNotes] = useState([]);

  const [showNoteForm, setShowNoteForm] = useState(false);
  const [noteForm, setNoteForm] = useState(emptyNoteForm);

  const [planForm, setPlanForm] = useState({
    title: "",
    plan_date: "",
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

  const staffOptions = useMemo(
    () =>
      staffRows.map((staff) => ({
        value: staff.employee_name,
        label: `${staff.employee_name} • ${staff.position} • ${staff.branch_name}`,
      })),
    [staffRows]
  );

  const selectedDateText = planForm.plan_date;

  const selectedDatePlans = plans.filter((p) => {
    const d = String(p.plan_date || "").slice(0, 10);
    return d === selectedDateText;
  });

  const fetchScopedStaff = async () => {
    try {
      const res = await api.get("/travel-plans/staff-scope");
      setStaffRows(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Fetch travel staff scope error:", err);
      setStaffRows([]);
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
    fetchScopedStaff();
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
        branch_name: "",
        description: "",
      });

      fetchPlans();
    } catch (err) {
      console.error("Save plan error:", err);
      alert(err.response?.data?.message || "Failed to save plan.");
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
              "Activities & Events",
              "Graph",
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

            <button
              className="travel-create-btn"
              type="button"
              onClick={() => setShowCreatePlan(true)}
            >
              + Create Plan
            </button>
          </div>

          {activeMenu === "Travel Plan" && (
            <div className="travel-plan-layout">
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
                          setPlanForm((p) => ({ ...p, plan_date: date }));
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

              <div className="travel-events-card">
                <h3>Events</h3>
                <p>
                  {selectedDateText
                    ? `Travel plans for ${selectedDateText}`
                    : "Select a date to view travel plan events."}
                </p>

                {selectedDatePlans.length === 0 ? (
                  <div className="travel-empty">No events for this date.</div>
                ) : (
                  <div className="travel-event-list">
                    {selectedDatePlans.map((plan) => (
                      <div
                        key={plan.id}
                        className="travel-event-item"
                        onClick={() => openPlan(plan)}
                      >
                        <strong>{plan.title}</strong>
                          <div className="travel-event-header">
                            <span>{plan.branch_name || "No branch"}</span>

                              <div className={`travel-status ${plan.status === "Completed"
                                    ? "completed"
                                    : "pending"
                                }`}
                              >
                                {plan.status || "Pending"}
                              </div>
                          </div>
                          <p>{plan.description}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
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

          {activeMenu === "Activities & Events" && (
            <div className="travel-dashboard-card">
              <div className="travel-dashboard-head">
                <div>
                  <h3>Activities & Events</h3>
                  <p>All travel plans, reviews, findings, and completed branch visits.</p>
                </div>
                <span>{plans.length} Plans</span>
              </div>

              {plans.length === 0 ? (
                <div className="travel-empty">No activities yet.</div>
              ) : (
                <div className="travel-activity-list">
                  {plans.map((plan) => (
                    <div
                      key={plan.id}
                      className="travel-activity-card"
                      onClick={() => openPlan(plan)}
                    >
                      <div>
                        <strong>{plan.title}</strong>
                        <p>{plan.branch_name || "No branch"}</p>
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
                  ))}
                </div>
              )}
            </div>
          )}

          {["Graph", "History"].includes(activeMenu) && (
            <div className="travel-dashboard-card">
              <div className="travel-empty">No data yet.</div>
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
                    <select
                      value={planForm.branch_name}
                      onChange={(e) =>
                        setPlanForm((p) => ({
                          ...p,
                          branch_name: e.target.value,
                        }))
                      }
                    >
                      <option value="">Select branch</option>
                      {branchRows.map((b) => (
                        <option
                          key={b.branch_code || b.branch_name}
                          value={b.branch_name}
                        >
                          {b.branch_name}
                        </option>
                      ))}
                    </select>
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
                      <b>Check In:</b>
                      <span>{formatTime(getFirstPhotoTime("CHECK_IN"))}</span>
                    </div>

                    <div>
                      <b>Check Out:</b>
                      <span>{formatTime(getFirstPhotoTime("CHECK_OUT"))}</span>
                    </div>

                    <div>
                      <b>Total Time:</b>
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

                  <div className="travel-tabs">
                    <button
                      className={detailTab === "review" ? "active" : ""}
                      onClick={() => {
                        setDetailTab("review");
                        setShowNoteForm(false);
                      }}
                    >
                      Review
                    </button>

                    <button
                      className={detailTab === "findings" ? "active" : ""}
                      onClick={() => {
                        setDetailTab("findings");
                        setShowNoteForm(false);
                      }}
                    >
                      Findings
                    </button>

                    <button
                      className={detailTab === "photos" ? "active" : ""}
                      onClick={() => {
                        setDetailTab("photos");
                        setShowNoteForm(false);
                      }}
                    >
                      Gallery
                    </button>

                    <button
                      className={detailTab === "checkin" ? "active" : ""}
                      onClick={() => {
                        setDetailTab("checkin");
                        setShowNoteForm(false);
                      }}
                    >
                      Check In
                    </button>

                    <button
                      className={detailTab === "checkout" ? "active" : ""}
                      onClick={() => {
                        setDetailTab("checkout");
                        setShowNoteForm(false);
                      }}
                    >
                      Check Out
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