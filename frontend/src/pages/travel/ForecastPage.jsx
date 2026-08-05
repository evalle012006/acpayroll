import React, { useEffect, useMemo, useState } from "react";
import api from "../../api/axiosClient";
import "../../styles/Calendar.css";

const normalizeValue = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const getManilaDateString = (date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

const getStartOfWeek = (date) => {
  const result = new Date(date);
  const currentDay = result.getDay();

  const distanceFromMonday =
    currentDay === 0 ? -6 : 1 - currentDay;

  result.setDate(
    result.getDate() + distanceFromMonday
  );

  result.setHours(0, 0, 0, 0);

  return result;
};

export default function ForecastPage() {
  const [plans, setPlans] = useState([]);

  const [forecastSelectedDate, setForecastSelectedDate] =
    useState(getManilaDateString(new Date()));

  const [forecastStaffRows, setForecastStaffRows] =
    useState([]);

  const [forecastStaffLoading, setForecastStaffLoading] =
    useState(false);

  const [plansLoading, setPlansLoading] =
    useState(false);

  const [forecastFilter, setForecastFilter] =
    useState("total");

  const [
    selectedForecastStaff,
    setSelectedForecastStaff,
  ] = useState(null);

  const [
    selectedForecastPlan,
    setSelectedForecastPlan,
  ] = useState(null);

  const fetchPlans = async () => {
    setPlansLoading(true);

    try {
      const response = await api.get("/travel-plans");

      setPlans(
        Array.isArray(response.data)
          ? response.data
          : []
      );
    } catch (error) {
      console.error(
        "Fetch forecast travel plans error:",
        error
      );

      setPlans([]);
    } finally {
      setPlansLoading(false);
    }
  };

  const fetchForecastStaff = async (date) => {
    if (!date) {
      setForecastStaffRows([]);
      return;
    }

    setForecastStaffLoading(true);

    try {
      const response = await api.get(
        `/travel-plans/staff-scope?date=${date}`
      );

      setForecastStaffRows(
        Array.isArray(response.data)
          ? response.data
          : []
      );
    } catch (error) {
      console.error(
        "Fetch forecast staff error:",
        error
      );

      setForecastStaffRows([]);
    } finally {
      setForecastStaffLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  useEffect(() => {
    fetchForecastStaff(forecastSelectedDate);
  }, [forecastSelectedDate]);

  const forecastWeek = useMemo(() => {
    const selected = new Date(
      `${forecastSelectedDate}T00:00:00`
    );

    const monday = getStartOfWeek(selected);

    return Array.from({ length: 7 }).map(
      (_, index) => {
        const current = new Date(monday);

        current.setDate(
          monday.getDate() + index
        );

        const date =
          getManilaDateString(current);

        const dayPlans = plans.filter(
          (plan) =>
            String(
              plan.plan_date || ""
            ).slice(0, 10) === date
        );

        return {
          date,

          shortName:
            current.toLocaleDateString(
              "en-US",
              {
                weekday: "short",
              }
            ),

          fullName:
            current.toLocaleDateString(
              "en-US",
              {
                weekday: "long",
              }
            ),

          dayNumber: current.getDate(),

          total: dayPlans.length,

          completed: dayPlans.filter(
            (plan) =>
              normalizeValue(plan.status) ===
              "completed"
          ).length,

          pending: dayPlans.filter(
            (plan) =>
              normalizeValue(plan.status) !==
              "completed"
          ).length,

          plans: dayPlans,
        };
      }
    );
  }, [plans, forecastSelectedDate]);

  const forecastSelectedDay = useMemo(() => {
    const selectedDay =
      forecastWeek.find(
        (day) =>
          day.date === forecastSelectedDate
      ) || forecastWeek[0];

    if (!selectedDay) {
      return {
        date: "",
        dayName: "",
        dayNumber: "",
        monthName: "",
        fullDate: "",
        total: 0,
        completed: 0,
        pending: 0,
        plans: [],
      };
    }

    const date = new Date(
      `${selectedDay.date}T00:00:00`
    );

    return {
      ...selectedDay,

      dayName:
        date.toLocaleDateString("en-US", {
          weekday: "long",
        }),

      monthName:
        date.toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        }),

      fullDate:
        date.toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        }),
    };
  }, [
    forecastWeek,
    forecastSelectedDate,
  ]);

  const forecastCreatedPlans = useMemo(
    () =>
      Array.isArray(
        forecastSelectedDay.plans
      )
        ? forecastSelectedDay.plans
        : [],
    [forecastSelectedDay]
  );

  const forecastCompletedPlans = useMemo(
    () =>
      forecastCreatedPlans.filter(
        (plan) =>
          normalizeValue(plan.status) ===
          "completed"
      ),
    [forecastCreatedPlans]
  );

  const forecastStaffWithPlans = useMemo(
    () =>
      new Set(
        forecastCreatedPlans
          .map((plan) =>
            normalizeValue(
              plan.employee_name
            )
          )
          .filter(Boolean)
      ),
    [forecastCreatedPlans]
  );

  const forecastPendingStaff = useMemo(
    () =>
      forecastStaffRows.filter((staff) => {
        const staffStatus =
          normalizeValue(
            staff.travel_status
          );

        if (
          staffStatus === "on leave" ||
          staffStatus ===
            "indefinite leave"
        ) {
          return false;
        }

        const employeeName =
          normalizeValue(
            staff.employee_name
          );

        if (!employeeName) {
          return false;
        }

        return !forecastStaffWithPlans.has(
          employeeName
        );
      }),
    [
      forecastStaffRows,
      forecastStaffWithPlans,
    ]
  );

  const forecastDisplayRows = useMemo(() => {
    if (forecastFilter === "completed") {
      return forecastCompletedPlans;
    }

    if (forecastFilter === "pending") {
      return forecastPendingStaff;
    }

    return forecastCreatedPlans;
  }, [
    forecastFilter,
    forecastCreatedPlans,
    forecastCompletedPlans,
    forecastPendingStaff,
  ]);

  const forecastDisplayInfo = useMemo(() => {
    if (forecastFilter === "completed") {
      const count = forecastCompletedPlans.length;

      return {
        title:
          count === 0
            ? "No Completed Travel Plans"
            : count === 1
            ? "1 Completed Travel Plan"
            : `${count} Completed Travel Plans`,

        description:
          count === 0
            ? "No travel plans have been completed for this date."
            : "Completed travel plans for the selected date.",

        countLabel:
          count === 1 ? "Plan" : "Plans",
      };
    }

    if (forecastFilter === "pending") {
      const count = forecastPendingStaff.length;

      return {
        title:
          count === 0
            ? "All Staff Submitted"
            : count === 1
            ? "1 Staff Has Not Submitted"
            : `${count} Staff Have Not Submitted`,

        description:
          count === 0
            ? "All monitored staff have created a travel plan for this date."
            : "Staff members who have not created a travel plan for the selected date.",

        countLabel:
          count === 1 ? "Staff" : "Staff",
      };
    }

    const count = forecastCreatedPlans.length;

    return {
      title:
        count === 0
          ? "No Travel Plans"
          : count === 1
          ? "1 Travel Plan"
          : `${count} Travel Plans`,

      description:
        count === 0
          ? "No scheduled branch visits for this date."
          : "Scheduled branch visits for the selected date.",

      countLabel:
        count === 1 ? "Plan" : "Plans",
    };
  }, [
    forecastFilter,
    forecastCreatedPlans,
    forecastCompletedPlans,
    forecastPendingStaff,
  ]);

  const selectedForecastStaffWeek =
    useMemo(() => {
      if (!selectedForecastStaff) {
        return [];
      }

      const selectedEmployeeName =
        normalizeValue(
          selectedForecastStaff.employee_name
        );

      return forecastWeek.map((day) => {
        const staffPlans =
          day.plans.filter(
            (plan) =>
              normalizeValue(
                plan.employee_name
              ) === selectedEmployeeName
          );

        const completedPlans =
          staffPlans.filter(
            (plan) =>
              normalizeValue(
                plan.status
              ) === "completed"
          );

        let monitoringStatus =
          "Not Submitted";

        if (completedPlans.length > 0) {
          monitoringStatus = "Completed";
        } else if (staffPlans.length > 0) {
          monitoringStatus = "Submitted";
        }

        return {
          ...day,
          staffPlans,
          completedPlans,
          monitoringStatus,
        };
      });
    }, [
      selectedForecastStaff,
      forecastWeek,
    ]);

  return (
    <div className="travel-modern-page">
      <div className="travel-modern-layout">
        <main className="travel-calendar-main">
          <div className="travel-forecast-layout">
            <section className="travel-forecast-side">
              <span>Travel Forecast</span>

              <h2>
                {forecastSelectedDay.dayName}
              </h2>

              <strong>
                {forecastSelectedDay.dayNumber}
              </strong>

              <p>
                {forecastSelectedDay.monthName}
              </p>

              <input
                type="date"
                value={forecastSelectedDate}
                onChange={(event) =>
                  setForecastSelectedDate(
                    event.target.value
                  )
                }
              />

              <div className="travel-forecast-stats">
                <button
                  type="button"
                  className={
                    forecastFilter === "total"
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    setForecastFilter("total")
                  }
                >
                  <span>Total Plans</span>
                  <b>
                    {
                      forecastCreatedPlans.length
                    }
                  </b>
                </button>

                <button
                  type="button"
                  className={
                    forecastFilter ===
                    "completed"
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    setForecastFilter(
                      "completed"
                    )
                  }
                >
                  <span>Completed</span>
                  <b>
                    {
                      forecastCompletedPlans.length
                    }
                  </b>
                </button>

                <button
                  type="button"
                  className={
                    forecastFilter ===
                    "pending"
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    setForecastFilter("pending")
                  }
                >
                  <span>Not Submitted</span>
                  <b>
                    {
                      forecastPendingStaff.length
                    }
                  </b>
                </button>
              </div>
            </section>

            <section className="travel-forecast-content">
              <div className="travel-forecast-head">
                <div>
                  <span>
                    {
                      forecastSelectedDay.fullDate
                    }
                  </span>

                  <h1>{forecastDisplayInfo.title}</h1>

                  <p>{forecastDisplayInfo.description}</p>
                </div>

                <div className="travel-forecast-count">
                  <strong>
                    {forecastDisplayRows.length}
                  </strong>

                  <span>
                    {forecastDisplayInfo.countLabel}
                  </span>
                </div>
              </div>

              <div className="travel-forecast-plan-list">
                {plansLoading ||
                forecastStaffLoading ? (
                  <div className="travel-forecast-empty">
                    Loading forecast...
                  </div>
                ) : forecastDisplayRows.length ===
                  0 ? (
                  <div className="travel-forecast-empty">
                    {forecastFilter ===
                    "completed"
                      ? "No completed travel plans."
                      : forecastFilter ===
                        "pending"
                      ? "All monitored staff have created a travel plan."
                      : "No travel plans scheduled."}
                  </div>
                ) : forecastFilter ===
                  "pending" ? (
                  forecastDisplayRows.map(
                    (staff) => (
                      <button
                        key={
                          staff.id ||
                          staff.employee_id ||
                          staff.employee_no ||
                          staff.employee_name
                        }
                        type="button"
                        className="travel-forecast-plan-card"
                        onClick={() =>
                          setSelectedForecastStaff(
                            staff
                          )
                        }
                      >
                        <div>
                          <strong>
                            {staff.employee_name ||
                              "Unknown Employee"}
                          </strong>

                          <span>
                            {staff.position ||
                              "No position"}
                          </span>

                          <small>
                            {staff.branch_name ||
                              "No branch"}

                            {staff.area
                              ? ` • ${staff.area}`
                              : ""}

                            {staff.region
                              ? ` • ${staff.region}`
                              : ""}
                          </small>
                        </div>

                        <b className="travel-status pending">
                          Not Submitted
                        </b>
                      </button>
                    )
                  )
                ) : (
                  forecastDisplayRows.map(
                    (plan) => (
                      <button
                        key={plan.id}
                        type="button"
                        className="travel-forecast-plan-card"
                        onClick={() =>
                          setSelectedForecastPlan(plan)
                        }
                      >
                        <div>
                          <strong>
                            {plan.title ||
                              "Untitled Travel Plan"}
                          </strong>

                          <span>
                            {plan.employee_name ||
                              "No employee assigned"}
                          </span>

                          <small>
                            {plan.branch_name ||
                              "No branch selected"}
                          </small>
                        </div>

                        <b
                          className={`travel-status ${
                            normalizeValue(
                              plan.status
                            ) === "completed"
                              ? "completed"
                              : "pending"
                          }`}
                        >
                          {normalizeValue(
                            plan.status
                          ) === "completed"
                            ? "Completed"
                            : "Submitted"}
                        </b>
                      </button>
                    )
                  )
                )}
              </div>

              <div className="travel-forecast-week">
                {forecastWeek.map((day) => (
                  <button
                    key={day.date}
                    type="button"
                    className={`travel-forecast-day ${
                      forecastSelectedDate ===
                      day.date
                        ? "active"
                        : ""
                    }`}
                    onClick={() =>
                      setForecastSelectedDate(
                        day.date
                      )
                    }
                  >
                    <span>{day.shortName}</span>

                    <strong>
                      {day.dayNumber}
                    </strong>

                    <small>
                      {day.total}{" "}
                      {day.total === 1
                        ? "Plan"
                        : "Plans"}
                    </small>
                  </button>
                ))}
              </div>
            </section>
          </div>

          {selectedForecastPlan && (
            <div
              className="travel-plan-modal-backdrop"
              onMouseDown={(event) => {
                if (
                  event.target.classList.contains(
                    "travel-plan-modal-backdrop"
                  )
                ) {
                  setSelectedForecastPlan(null);
                }
              }}
            >
              <div
                className="travel-plan-modal travel-forecast-plan-modal"
                onMouseDown={(event) =>
                  event.stopPropagation()
                }
              >
                <div className="travel-plan-modal-head">
                  <div>
                    <h3>
                      {selectedForecastPlan.title ||
                        "Travel Plan Details"}
                    </h3>

                    <p className="travel-staff-modal-subtitle">
                      {selectedForecastPlan.employee_name ||
                        "No employee assigned"}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setSelectedForecastPlan(null)
                    }
                  >
                    ×
                  </button>
                </div>

                <div className="travel-compliance-detail-grid">
                  <div>
                    <span>Employee</span>

                    <strong>
                      {selectedForecastPlan.employee_name ||
                        "-"}
                    </strong>
                  </div>

                  <div>
                    <span>Position</span>

                    <strong>
                      {selectedForecastPlan.position ||
                        "-"}
                    </strong>
                  </div>

                  <div>
                    <span>Date</span>

                    <strong>
                      {String(
                        selectedForecastPlan.plan_date ||
                          ""
                      ).slice(0, 10) || "-"}
                    </strong>
                  </div>

                  <div>
                    <span>Status</span>

                    <strong>
                      {selectedForecastPlan.status ||
                        "Pending"}
                    </strong>
                  </div>

                  <div>
                    <span>Visited Branch</span>

                    <strong>
                      {selectedForecastPlan.branch_name ||
                        "-"}
                    </strong>
                  </div>

                  <div>
                    <span>Employee Number</span>

                    <strong>
                      {selectedForecastPlan.employee_no ||
                        "-"}
                    </strong>
                  </div>
                </div>

                <div className="travel-compliance-details">
                  <span>Description</span>

                  <p>
                    {selectedForecastPlan.description ||
                      "No description provided."}
                  </p>
                </div>

                <div className="travel-plan-modal-actions">
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedForecastPlan(null)
                    }
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {selectedForecastStaff && (
            <div
              className="travel-plan-modal-backdrop"
              onMouseDown={(event) => {
                if (
                  event.target.classList.contains(
                    "travel-plan-modal-backdrop"
                  )
                ) {
                  setSelectedForecastStaff(
                    null
                  );
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
                      {
                        selectedForecastStaff.employee_name
                      }
                    </h3>

                    <p>
                      Weekly travel-plan monitoring
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setSelectedForecastStaff(
                        null
                      )
                    }
                  >
                    ×
                  </button>
                </div>

                <div className="travel-forecast-staff-week">
                  {selectedForecastStaffWeek.map(
                    (day) => (
                      <div
                        key={day.date}
                        className="travel-forecast-staff-day"
                      >
                        <div>
                          <strong>
                            {day.fullName}
                          </strong>

                          <span>{day.date}</span>
                        </div>

                        <b
                          className={`travel-status ${
                            day.monitoringStatus ===
                            "Completed"
                              ? "completed"
                              : "pending"
                          }`}
                        >
                          {
                            day.monitoringStatus
                          }
                        </b>
                      </div>
                    )
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