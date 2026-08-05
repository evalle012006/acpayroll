import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import api from "../../api/axiosClient";
import "../../styles/Calendar.css";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const DAYS = [
  "SUN",
  "MON",
  "TUE",
  "WED",
  "THU",
  "FRI",
  "SAT",
];

const emptyActivityForm = {
  title: "",
  date_from: "",
  date_to: "",
  subject: "",
  venue: "",
  description: "",
};

const normalizeValue = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const readUser = () => {
  try {
    const raw = localStorage.getItem("user");

    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const toDateString = (value) =>
  String(value || "").slice(0, 10);

export default function CalendarPage() {
  const today = new Date();
  const loggedInUser = readUser();

  const loggedInRole = normalizeValue(
    loggedInUser?.role
  );

  const loggedInDepartment = normalizeValue(
    loggedInUser?.department ||
      loggedInUser?.department_name ||
      loggedInUser?.user_department ||
      loggedInUser?.departmentName ||
      loggedInUser?.dept
  );

  const canManageCalendarActivities =
    loggedInRole === "admin" ||
    loggedInDepartment === "tread department";

  const [month, setMonth] = useState(
    today.getMonth()
  );

  const [year, setYear] = useState(
    today.getFullYear()
  );

  const [activities, setActivities] =
    useState([]);

  const [loading, setLoading] =
    useState(false);

  const [
    selectedCalendarDate,
    setSelectedCalendarDate,
  ] = useState("");

  const [
    selectedActivity,
    setSelectedActivity,
  ] = useState(null);

  const [
    showCreateActivity,
    setShowCreateActivity,
  ] = useState(false);

  const [
    editingActivityId,
    setEditingActivityId,
  ] = useState(null);

  const [activityForm, setActivityForm] =
    useState(emptyActivityForm);

  const fetchActivities = async () => {
    setLoading(true);

    try {
      const response = await api.get(
        "/calendar-activities"
      );

      setActivities(
        Array.isArray(response.data)
          ? response.data
          : []
      );
    } catch (error) {
      console.error(
        "Fetch activities error:",
        error
      );

      setActivities([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
  }, []);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(
      year,
      month,
      1
    );

    const lastDay = new Date(
      year,
      month + 1,
      0
    );

    const startDay = firstDay.getDay();
    const totalDays = lastDay.getDate();

    const previousMonthLastDay =
      new Date(year, month, 0).getDate();

    const cells = [];

    for (
      let index = startDay - 1;
      index >= 0;
      index -= 1
    ) {
      cells.push({
        day:
          previousMonthLastDay - index,
        currentMonth: false,
      });
    }

    for (
      let day = 1;
      day <= totalDays;
      day += 1
    ) {
      cells.push({
        day,
        currentMonth: true,
      });
    }

    let nextDay = 1;

    while (cells.length < 42) {
      cells.push({
        day: nextDay,
        currentMonth: false,
      });

      nextDay += 1;
    }

    return cells;
  }, [month, year]);

  const getCellDate = (cell) => {
    if (!cell.currentMonth) {
      return "";
    }

    return `${year}-${String(
      month + 1
    ).padStart(2, "0")}-${String(
      cell.day
    ).padStart(2, "0")}`;
  };

  const activityOccursOnDate = (
    activity,
    date
  ) => {
    const dateFrom = toDateString(
      activity.date_from
    );

    const dateTo = toDateString(
      activity.date_to ||
        activity.date_from
    );

    return (
      date >= dateFrom &&
      date <= dateTo
    );
  };

  const getActivitiesForDate = (date) => {
    if (!date) {
      return [];
    }

    return activities.filter((activity) =>
      activityOccursOnDate(
        activity,
        date
      )
    );
  };

  const selectedDateActivities =
    useMemo(
      () =>
        getActivitiesForDate(
          selectedCalendarDate
        ),
      [
        activities,
        selectedCalendarDate,
      ]
    );

  const openCreateActivity = (date = "") => {
    if (!canManageCalendarActivities) {
      return;
    }

    setEditingActivityId(null);

    setActivityForm({
      ...emptyActivityForm,
      date_from: date,
      date_to: date,
    });

    setShowCreateActivity(true);
  };

  const openEditActivity = (activity) => {
    if (!canManageCalendarActivities) {
      return;
    }

    setEditingActivityId(activity.id);

    setActivityForm({
      title: activity.title || "",
      date_from: toDateString(
        activity.date_from
      ),
      date_to: toDateString(
        activity.date_to
      ),
      subject: activity.subject || "",
      venue: activity.venue || "",
      description:
        activity.description || "",
    });

    setSelectedActivity(null);
    setShowCreateActivity(true);
  };

  const closeActivityForm = () => {
    setShowCreateActivity(false);
    setEditingActivityId(null);
    setActivityForm(emptyActivityForm);
  };

  const saveActivity = async () => {
    if (!canManageCalendarActivities) {
      alert(
        "Only Admin and TREAD Department can manage calendar activities."
      );

      return;
    }

    if (
      !activityForm.title.trim() ||
      !activityForm.date_from ||
      !activityForm.date_to
    ) {
      alert(
        "Title, Date From, and Date To are required."
      );

      return;
    }

    if (
      activityForm.date_to <
      activityForm.date_from
    ) {
      alert(
        "Date To cannot be earlier than Date From."
      );

      return;
    }

    try {
      if (editingActivityId) {
        await api.put(
          `/calendar-activities/${editingActivityId}`,
          activityForm
        );
      } else {
        await api.post(
          "/calendar-activities",
          activityForm
        );
      }

      closeActivityForm();
      await fetchActivities();

      alert(
        editingActivityId
          ? "Activity updated successfully."
          : "Activity created successfully."
      );
    } catch (error) {
      console.error(
        "Save activity error:",
        error
      );

      alert(
        error.response?.data?.message ||
          "Failed to save activity."
      );
    }
  };

  const deleteActivity = async (
    activityId
  ) => {
    if (!canManageCalendarActivities) {
      alert(
        "Only Admin and TREAD Department can delete calendar activities."
      );

      return;
    }

    if (!activityId) {
      return;
    }

    const confirmed = window.confirm(
      "Delete this calendar activity?"
    );

    if (!confirmed) {
      return;
    }

    try {
      await api.delete(
        `/calendar-activities/${activityId}`
      );

      setSelectedActivity(null);

      await fetchActivities();

      alert(
        "Activity deleted successfully."
      );
    } catch (error) {
      console.error(
        "Delete activity error:",
        error
      );

      alert(
        error.response?.data?.message ||
          "Failed to delete activity."
      );
    }
  };

  const goToPreviousMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear((previous) => previous - 1);
      return;
    }

    setMonth((previous) => previous - 1);
  };

  const goToNextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear((previous) => previous + 1);
      return;
    }

    setMonth((previous) => previous + 1);
  };

  const goToToday = () => {
    const current = new Date();

    setMonth(current.getMonth());
    setYear(current.getFullYear());

    setSelectedCalendarDate(
      `${current.getFullYear()}-${String(
        current.getMonth() + 1
      ).padStart(2, "0")}-${String(
        current.getDate()
      ).padStart(2, "0")}`
    );
  };

  return (
    <div className="travel-modern-page">
      <div className="travel-modern-layout">
        <main className="travel-calendar-main">
          <div className="travel-calendar-page-head">
            <div>
              <span>Schedule Management</span>

              <h1>Calendar</h1>

              <p>
                View activities and events by
                date.
              </p>
            </div>

            <div className="travel-calendar-page-actions">
              <button
                type="button"
                onClick={goToToday}
              >
                Today
              </button>

              {canManageCalendarActivities && (
                <button
                  type="button"
                  className="primary"
                  onClick={() =>
                    openCreateActivity(
                      selectedCalendarDate
                    )
                  }
                >
                  + Create Activity
                </button>
              )}
            </div>
          </div>

          <div className="travel-calendar-toolbar">
            <button
              type="button"
              onClick={goToPreviousMonth}
            >
              ‹
            </button>

            <div>
              <select
                value={month}
                onChange={(event) =>
                  setMonth(
                    Number(event.target.value)
                  )
                }
              >
                {MONTHS.map(
                  (monthName, index) => (
                    <option
                      key={monthName}
                      value={index}
                    >
                      {monthName}
                    </option>
                  )
                )}
              </select>

              <input
                type="number"
                value={year}
                min="2000"
                max="2100"
                onChange={(event) =>
                  setYear(
                    Number(event.target.value)
                  )
                }
              />
            </div>

            <button
              type="button"
              onClick={goToNextMonth}
            >
              ›
            </button>
          </div>

          <div className="travel-calendar-layout">
            <section className="travel-full-calendar-card">
              <div className="travel-full-calendar-grid">
                {DAYS.map((day) => (
                  <div
                    key={day}
                    className="travel-full-calendar-day-head"
                  >
                    {day}
                  </div>
                ))}

                {calendarDays.map(
                  (cell, index) => {
                    const date =
                      getCellDate(cell);

                    const dayActivities =
                      getActivitiesForDate(
                        date
                      );

                    const isSelected =
                      date &&
                      selectedCalendarDate ===
                        date;

                    const isToday =
                      date ===
                      `${today.getFullYear()}-${String(
                        today.getMonth() + 1
                      ).padStart(
                        2,
                        "0"
                      )}-${String(
                        today.getDate()
                      ).padStart(2, "0")}`;

                    return (
                      <button
                        key={index}
                        type="button"
                        disabled={
                          !cell.currentMonth
                        }
                        className={`travel-full-calendar-cell ${
                          !cell.currentMonth
                            ? "muted"
                            : ""
                        } ${
                          isSelected
                            ? "selected"
                            : ""
                        } ${
                          isToday
                            ? "today"
                            : ""
                        }`}
                        onClick={() => {
                          if (!date) {
                            return;
                          }

                          setSelectedCalendarDate(
                            date
                          );
                        }}
                        onDoubleClick={() => {
                          if (
                            date &&
                            canManageCalendarActivities
                          ) {
                            openCreateActivity(
                              date
                            );
                          }
                        }}
                      >
                        <div className="travel-full-calendar-date">
                          <span>
                            {cell.day}
                          </span>

                          {dayActivities.length >
                            0 && (
                            <b>
                              {
                                dayActivities.length
                              }
                            </b>
                          )}
                        </div>

                        <div className="travel-full-calendar-events">
                          {dayActivities
                            .slice(0, 3)
                            .map(
                              (activity) => (
                                <span
                                  key={
                                    activity.id
                                  }
                                  onClick={(
                                    event
                                  ) => {
                                    event.stopPropagation();

                                    setSelectedActivity(
                                      activity
                                    );
                                  }}
                                >
                                  {activity.title}
                                </span>
                              )
                            )}

                          {dayActivities.length >
                            3 && (
                            <small>
                              +
                              {dayActivities.length -
                                3}{" "}
                              more
                            </small>
                          )}
                        </div>
                      </button>
                    );
                  }
                )}
              </div>
            </section>

            <aside className="travel-calendar-agenda">
              <div className="travel-dashboard-head">
                <div>
                  <h3>
                    {selectedCalendarDate
                      ? `Activities — ${selectedCalendarDate}`
                      : "Select a date"}
                  </h3>

                  <p>
                    Activities scheduled for the
                    selected date.
                  </p>
                </div>

                {canManageCalendarActivities &&
                  selectedCalendarDate && (
                    <button
                      type="button"
                      className="travel-create-btn secondary"
                      onClick={() =>
                        openCreateActivity(
                          selectedCalendarDate
                        )
                      }
                    >
                      Add
                    </button>
                  )}
              </div>

              {loading ? (
                <div className="travel-empty">
                  Loading activities...
                </div>
              ) : !selectedCalendarDate ? (
                <div className="travel-empty">
                  Click a date to view its
                  activities.
                </div>
              ) : selectedDateActivities.length ===
                0 ? (
                <div className="travel-empty">
                  No activities for this date.
                </div>
              ) : (
                <div className="travel-calendar-agenda-list">
                  {selectedDateActivities.map(
                    (activity) => (
                      <button
                        key={activity.id}
                        type="button"
                        className="travel-calendar-agenda-item"
                        onClick={() =>
                          setSelectedActivity(
                            activity
                          )
                        }
                      >
                        <strong>
                          {activity.title}
                        </strong>

                        <span>
                          {activity.subject ||
                            "No subject"}
                        </span>

                        <small>
                          {activity.venue ||
                            "No venue"}
                        </small>
                      </button>
                    )
                  )}
                </div>
              )}
            </aside>
          </div>

          {showCreateActivity && (
            <div
              className="travel-plan-modal-backdrop"
              onMouseDown={(event) => {
                if (
                  event.target.classList.contains(
                    "travel-plan-modal-backdrop"
                  )
                ) {
                  closeActivityForm();
                }
              }}
            >
              <div
                className="travel-plan-modal"
                onMouseDown={(event) =>
                  event.stopPropagation()
                }
              >
                <div className="travel-plan-modal-head">
                  <h3>
                    {editingActivityId
                      ? "Edit Activity"
                      : "Create Activity"}
                  </h3>

                  <button
                    type="button"
                    onClick={
                      closeActivityForm
                    }
                  >
                    ×
                  </button>
                </div>

                <div className="travel-plan-form">
                  <label>
                    Title

                    <input
                      type="text"
                      value={
                        activityForm.title
                      }
                      onChange={(event) =>
                        setActivityForm(
                          (previous) => ({
                            ...previous,
                            title:
                              event.target
                                .value,
                          })
                        )
                      }
                    />
                  </label>

                  <label>
                    Subject

                    <input
                      type="text"
                      value={
                        activityForm.subject
                      }
                      onChange={(event) =>
                        setActivityForm(
                          (previous) => ({
                            ...previous,
                            subject:
                              event.target
                                .value,
                          })
                        )
                      }
                    />
                  </label>

                  <label>
                    Date From

                    <input
                      type="date"
                      value={
                        activityForm.date_from
                      }
                      onChange={(event) =>
                        setActivityForm(
                          (previous) => ({
                            ...previous,
                            date_from:
                              event.target
                                .value,
                          })
                        )
                      }
                    />
                  </label>

                  <label>
                    Date To

                    <input
                      type="date"
                      value={
                        activityForm.date_to
                      }
                      onChange={(event) =>
                        setActivityForm(
                          (previous) => ({
                            ...previous,
                            date_to:
                              event.target
                                .value,
                          })
                        )
                      }
                    />
                  </label>

                  <label className="travel-plan-form-full">
                    Venue

                    <input
                      type="text"
                      value={
                        activityForm.venue
                      }
                      onChange={(event) =>
                        setActivityForm(
                          (previous) => ({
                            ...previous,
                            venue:
                              event.target
                                .value,
                          })
                        )
                      }
                    />
                  </label>

                  <label className="travel-plan-form-full">
                    Description

                    <textarea
                      rows={5}
                      value={
                        activityForm.description
                      }
                      onChange={(event) =>
                        setActivityForm(
                          (previous) => ({
                            ...previous,
                            description:
                              event.target
                                .value,
                          })
                        )
                      }
                    />
                  </label>
                </div>

                <div className="travel-plan-modal-actions">
                  <button
                    type="button"
                    onClick={
                      closeActivityForm
                    }
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className="primary"
                    onClick={saveActivity}
                  >
                    {editingActivityId
                      ? "Update Activity"
                      : "Save Activity"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {selectedActivity && (
            <div
              className="travel-plan-modal-backdrop"
              onMouseDown={(event) => {
                if (
                  event.target.classList.contains(
                    "travel-plan-modal-backdrop"
                  )
                ) {
                  setSelectedActivity(null);
                }
              }}
            >
              <div
                className="travel-plan-modal"
                onMouseDown={(event) =>
                  event.stopPropagation()
                }
              >
                <div className="travel-plan-modal-head">
                  <div>
                    <h3>
                      {selectedActivity.title}
                    </h3>

                    <p className="travel-staff-modal-subtitle">
                      {toDateString(
                        selectedActivity.date_from
                      )}
                      {" — "}
                      {toDateString(
                        selectedActivity.date_to
                      )}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setSelectedActivity(null)
                    }
                  >
                    ×
                  </button>
                </div>

                <div className="travel-compliance-detail-grid">
                  <div>
                    <span>Subject</span>

                    <strong>
                      {selectedActivity.subject ||
                        "-"}
                    </strong>
                  </div>

                  <div>
                    <span>Venue</span>

                    <strong>
                      {selectedActivity.venue ||
                        "-"}
                    </strong>
                  </div>

                  <div>
                    <span>Date From</span>

                    <strong>
                      {toDateString(
                        selectedActivity.date_from
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>Date To</span>

                    <strong>
                      {toDateString(
                        selectedActivity.date_to
                      )}
                    </strong>
                  </div>
                </div>

                <div className="travel-compliance-details">
                  <span>Description</span>

                  <p>
                    {selectedActivity.description ||
                      "No description provided."}
                  </p>
                </div>

                <div className="travel-plan-modal-actions">
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedActivity(null)
                    }
                  >
                    Close
                  </button>

                  {canManageCalendarActivities && (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          openEditActivity(
                            selectedActivity
                          )
                        }
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        className="travel-record-delete"
                        onClick={() =>
                          deleteActivity(
                            selectedActivity.id
                          )
                        }
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}