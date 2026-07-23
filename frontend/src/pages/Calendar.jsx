import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
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
  involved_staff: [],
  involved_staff_ids: [],
  due_date: "",
  content: "",
};

const readUser = () => {
  try {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const normalizeValue = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

export default function TravelPlan() {
  const today = new Date();

  const loggedInUser = readUser();

  const loggedInRole = normalizeValue(loggedInUser?.role);

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

  const canDeleteTravelPlans =
    loggedInRole === "admin" ||
    loggedInRole === "it" ||
    loggedInDepartment === "tread department";

  const complianceReviewerRoles = [
    "area manager",
    "acting area manager",
    "regional manager",
    "acting regional manager",
    "assistant vice president",
    "vice president",
    "senior vice president",
  ];

  const canReviewCompliance =
    loggedInRole === "admin" ||
    loggedInRole === "it" ||
    complianceReviewerRoles.includes(
      loggedInRole
    );

  const [month, setMonth] = useState(today.getMonth());
  const [year, setYear] = useState(today.getFullYear());
  const [visitRange, setVisitRange] = useState("month");
  const location = useLocation();

  const currentTab =
    new URLSearchParams(location.search).get("tab") || "travel-plan";

  const activeMenu =
    currentTab === "calendar"
      ? "Calendar"
      : currentTab === "forecast"
      ? "Forecast"
      : currentTab === "history"
      ? "Comply"
      : "Travel Plan";

  const [activities, setActivities] = useState([]);
  const [branchSearch, setBranchSearch] = useState("");
  const [branchDivisionFilter, setBranchDivisionFilter] = useState("");
  const [branchRegionFilter, setBranchRegionFilter] = useState("");
  const [branchAreaFilter, setBranchAreaFilter] = useState("");
  const [complianceRows, setComplianceRows] = useState([]);
  const [complianceLoading, setComplianceLoading] = useState(false);
  const [complianceSearch, setComplianceSearch] = useState("");
  const [complianceStatusFilter, setComplianceStatusFilter] =
    useState("");

  const [selectedCompliance, setSelectedCompliance] =
    useState(null);

  const [complianceResponse, setComplianceResponse] =
    useState("");

  const [complyView, setComplyView] =
    useState("my");

  const [reviewComplianceRows, setReviewComplianceRows] =
    useState([]);

  const [reviewComplianceLoading, setReviewComplianceLoading] =
    useState(false);

  const [
    selectedReviewCompliance,
    setSelectedReviewCompliance,
  ] = useState(null);

  const [reviewRemarks, setReviewRemarks] =
    useState("");

  const [complianceCheckHistory, setComplianceCheckHistory] =
    useState([]);

  const [checkHistoryLoading, setCheckHistoryLoading] =
    useState(false);

  const [selectedPlan, setSelectedPlan] = useState(null);
  const [detailTab, setDetailTab] = useState("photos");
  const [previewPhoto, setPreviewPhoto] = useState(null);

  const [staffRows, setStaffRows] = useState([]);
  const [staffDropdownRows, setStaffDropdownRows] = useState([]);
  const [staffPositionFilter, setStaffPositionFilter] = useState("");
  const [staffSearch, setStaffSearch] = useState("");

  const [branchScopeRows, setBranchScopeRows] = useState([]);
  const [showCreatePlan, setShowCreatePlan] = useState(false);
  const [plans, setPlans] = useState([]);
  
  const [planPhotos, setPlanPhotos] = useState([]);
  const [planNotes, setPlanNotes] = useState([]);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState("");
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [selectedBranchVisit, setSelectedBranchVisit] = useState(null);

  const [selectedStaffScope, setSelectedStaffScope] = useState(null);
  const [staffPlanSearch, setStaffPlanSearch] = useState("");
  const [staffPlanDateFilter, setStaffPlanDateFilter] = useState("");

  const [showNoteForm, setShowNoteForm] = useState(false);
  const [noteForm, setNoteForm] = useState(emptyNoteForm);
  const [showCreateActivity, setShowCreateActivity] = useState(false);
  const [editingActivityId, setEditingActivityId] = useState(null);
  const [staffScopeDate, setStaffScopeDate] = useState(
    new Date().toISOString().slice(0, 10)
  );

  const [activityForm, setActivityForm] = useState({
    title: "",
    date_from: "",
    date_to: "",
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

    result.setDate(result.getDate() + distanceFromMonday);
    result.setHours(0, 0, 0, 0);

    return result;
  };

  const [forecastSelectedDate, setForecastSelectedDate] =
    useState(getManilaDateString(new Date()));

  const forecastWeek = useMemo(() => {
    const selected = new Date(
      `${forecastSelectedDate}T00:00:00`
    );

    const monday = getStartOfWeek(selected);

    return Array.from({ length: 7 }).map((_, index) => {
      const current = new Date(monday);
      current.setDate(monday.getDate() + index);

      const date = getManilaDateString(current);

      const dayPlans = plans.filter(
        (plan) =>
          String(plan.plan_date || "").slice(0, 10) === date
      );

      return {
        date,
        shortName: current.toLocaleDateString("en-US", {
          weekday: "short",
        }),
        fullName: current.toLocaleDateString("en-US", {
          weekday: "long",
        }),
        dayNumber: current.getDate(),
        total: dayPlans.length,
        completed: dayPlans.filter(
          (plan) => plan.status === "Completed"
        ).length,
        pending: dayPlans.filter(
          (plan) => plan.status !== "Completed"
        ).length,
        plans: dayPlans,
      };
    });
  }, [plans, forecastSelectedDate]);

  const forecastSelectedDay = useMemo(() => {
    const selectedDay =
      forecastWeek.find(
        (day) => day.date === forecastSelectedDate
      ) || forecastWeek[0];

    if (!selectedDay) {
      return {
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

    const date = new Date(`${selectedDay.date}T00:00:00`);

    return {
      ...selectedDay,
      dayName: date.toLocaleDateString("en-US", {
        weekday: "long",
      }),
      monthName: date.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      }),
      fullDate: date.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
    };
  }, [forecastWeek, forecastSelectedDate]);

  const filteredComplianceRows = useMemo(() => {
    const search = normalizeValue(complianceSearch);

    return complianceRows.filter((row) => {
      const matchesStatus =
        !complianceStatusFilter ||
        normalizeValue(row.status) ===
          normalizeValue(complianceStatusFilter);

      const searchableText = normalizeValue(
        [
          row.finding_title,
          row.finding_details,
          row.travel_plan_title,
          row.employee_name,
          row.employee_no,
          row.position,
          row.branch_name,
          row.visited_branch_name,
          row.status,
          row.due_date,
          row.compliance_response,
        ]
          .filter(Boolean)
          .join(" ")
      );

      const matchesSearch =
        !search ||
        searchableText.includes(search);

      return matchesStatus && matchesSearch;
    });
  }, [
    complianceRows,
    complianceSearch,
    complianceStatusFilter,
  ]);

  const complianceCounts = useMemo(() => {
    return {
      total: complianceRows.length,

      pending: complianceRows.filter(
        (row) =>
          normalizeValue(row.status) === "pending"
      ).length,

      submitted: complianceRows.filter(
        (row) =>
          normalizeValue(row.status) === "submitted"
      ).length,

      checked: complianceRows.filter(
        (row) =>
          normalizeValue(row.status) === "checked"
      ).length,

      complied: complianceRows.filter(
        (row) =>
          normalizeValue(row.status) === "complied"
      ).length,
    };
  }, [complianceRows]);

  const filteredReviewComplianceRows = useMemo(() => {
    const search = normalizeValue(
      complianceSearch
    );

    return reviewComplianceRows.filter((row) => {
      const matchesStatus =
        !complianceStatusFilter ||
        normalizeValue(row.status) ===
          normalizeValue(
            complianceStatusFilter
          );

      const searchableText =
        normalizeValue(
          [
            row.finding_title,
            row.finding_details,
            row.travel_plan_title,
            row.employee_name,
            row.employee_no,
            row.position,
            row.branch_name,
            row.visited_branch_name,
            row.status,
            row.latest_checked_by_name,
            row.latest_checked_by_role,
            row.due_date,
            row.compliance_response,
          ]
            .filter(Boolean)
            .join(" ")
        );

      const matchesSearch =
        !search ||
        searchableText.includes(search);

      return matchesStatus && matchesSearch;
    });
  }, [
    reviewComplianceRows,
    complianceSearch,
    complianceStatusFilter,
  ]);

  const reviewComplianceCounts = useMemo(() => {
    return {
      total: reviewComplianceRows.length,

      submitted: reviewComplianceRows.filter(
        (row) =>
          normalizeValue(row.status) ===
          "submitted"
      ).length,

      checked: reviewComplianceRows.filter(
        (row) =>
          normalizeValue(row.status) ===
          "checked"
      ).length,
    };
  }, [reviewComplianceRows]);

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

  const divisionOptions = useMemo(() => {
    return [
      ...new Set(
        branchRows
          .map((branch) => String(branch.division || "").trim())
          .filter(Boolean)
      ),
    ].sort();
  }, [branchRows]);

  const regionOptions = useMemo(() => {
    return [
      ...new Set(
        branchRows
          .filter(
            (branch) =>
              !branchDivisionFilter ||
              String(branch.division || "").trim() ===
                branchDivisionFilter
          )
          .map((branch) => String(branch.region || "").trim())
          .filter(Boolean)
      ),
    ].sort();
  }, [branchRows, branchDivisionFilter]);

  const areaOptions = useMemo(() => {
    return [
      ...new Set(
        branchRows
          .filter((branch) => {
            const matchesDivision =
              !branchDivisionFilter ||
              String(branch.division || "").trim() ===
                branchDivisionFilter;

            const matchesRegion =
              !branchRegionFilter ||
              String(branch.region || "").trim() ===
                branchRegionFilter;

            return matchesDivision && matchesRegion;
          })
          .map((branch) => String(branch.area || "").trim())
          .filter(Boolean)
      ),
    ].sort();
  }, [
    branchRows,
    branchDivisionFilter,
    branchRegionFilter,
  ]);

  const staffOptions = useMemo(
    () =>
      staffDropdownRows.map((staff) => ({
        value: Number(staff.id),

        employee_name: staff.employee_name,
        employee_no: staff.employee_no,
        position: staff.position,
        branch_name: staff.branch_name,

        label: [
          staff.employee_name,
          staff.position,
          staff.branch_name,
        ]
          .filter(Boolean)
          .join(" • "),
      })),
    [staffDropdownRows]
  );

  const staffPositionOptions = useMemo(() => {
    return [...new Set(staffRows.map((s) => s.position).filter(Boolean))];
  }, [staffRows]);

  const filteredStaffRows = useMemo(() => {
    const search = normalizeValue(staffSearch);

    return staffRows.filter((staff) => {
      const matchesPosition =
        !staffPositionFilter ||
        String(staff.position || "") ===
          staffPositionFilter;

      const searchableText = normalizeValue(
        [
          staff.employee_no,
          staff.employee_name,
          staff.position,
          staff.branch_name,
          staff.area,
          staff.region,
          staff.department,
          staff.travel_status,
        ]
          .filter(Boolean)
          .join(" ")
      );

      const matchesSearch =
        !search || searchableText.includes(search);

      return matchesPosition && matchesSearch;
    });
  }, [
    staffRows,
    staffPositionFilter,
    staffSearch,
  ]);

  const staffCounts = useMemo(() => {
    const rows = filteredStaffRows;

    return {
      total: rows.length,

      submitted: rows.filter(
        (s) =>
          String(s.travel_status || "")
            .trim()
            .toLowerCase() === "submitted"
      ).length,

      pending: rows.filter(
        (s) =>
          String(s.travel_status || "")
            .trim()
            .toLowerCase() === "pending"
      ).length,

      onLeave: rows.filter((s) => {
        const status = String(s.travel_status || "")
          .trim()
          .toLowerCase();

        return (
          status === "on leave" ||
          status === "indefinite leave"
        );
      }).length,
    };
  }, [filteredStaffRows]);

  const selectedStaffPlans = useMemo(() => {
    if (!selectedStaffScope) {
      return [];
    }

    const selectedEmployeeName = normalizeValue(
      selectedStaffScope.employee_name
    );

    const search = normalizeValue(staffPlanSearch);

    return plans
      .filter((plan) => {
        const planEmployeeName = normalizeValue(
          plan.employee_name
        );

        const belongsToSelectedStaff =
          planEmployeeName === selectedEmployeeName;

        const matchesDate =
          !staffPlanDateFilter ||
          String(plan.plan_date || "").slice(0, 10) ===
            staffPlanDateFilter;

        const searchableText = normalizeValue(
          [
            plan.title,
            plan.employee_name,
            plan.position,
            plan.branch_name,
            plan.description,
            plan.status,
            plan.plan_date,
          ]
            .filter(Boolean)
            .join(" ")
        );

        const matchesSearch =
          !search || searchableText.includes(search);

        return (
          belongsToSelectedStaff &&
          matchesDate &&
          matchesSearch
        );
      })
      .sort((a, b) => {
        const dateA = String(a.plan_date || "");
        const dateB = String(b.plan_date || "");

        return dateB.localeCompare(dateA);
      });
  }, [
    plans,
    selectedStaffScope,
    staffPlanSearch,
    staffPlanDateFilter,
  ]);

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

  const filteredMostVisitedBranches = mostVisitedBranches.filter((item) => {
    const branchInfo = branchRows.find(
      (branch) =>
        String(branch.branch_name || "")
          .trim()
          .toLowerCase() ===
        String(item.branch || "")
          .trim()
          .toLowerCase()
    );

    const matchesSearch = String(item.branch || "")
      .toLowerCase()
      .includes(branchSearch.trim().toLowerCase());

    const matchesDivision =
      !branchDivisionFilter ||
      String(branchInfo?.division || "").trim() ===
        branchDivisionFilter;

    const matchesRegion =
      !branchRegionFilter ||
      String(branchInfo?.region || "").trim() ===
        branchRegionFilter;

    const matchesArea =
      !branchAreaFilter ||
      String(branchInfo?.area || "").trim() ===
        branchAreaFilter;

    return (
      matchesSearch &&
      matchesDivision &&
      matchesRegion &&
      matchesArea
    );
  });

  const maxBranchVisits = Math.max(
    1,
    ...mostVisitedBranches.map((b) => b.count)
  );

  const fetchMyCompliances = async () => {
    setComplianceLoading(true);

    try {
      const res = await api.get(
        "/travel-plan-compliances/my"
      );

      setComplianceRows(
        Array.isArray(res.data)
          ? res.data
          : []
      );
    } catch (err) {
      console.error(
        "Fetch compliance records error:",
        err
      );

      setComplianceRows([]);
    } finally {
      setComplianceLoading(false);
    }
  };

  const fetchReviewCompliances = async () => {
    if (!canReviewCompliance) {
      setReviewComplianceRows([]);
      return;
    }

    setReviewComplianceLoading(true);

    try {
      const res = await api.get(
        "/travel-plan-compliances/review-scope"
      );

      setReviewComplianceRows(
        Array.isArray(res.data)
          ? res.data
          : []
      );
    } catch (err) {
      console.error(
        "Fetch compliance review scope error:",
        err
      );

      setReviewComplianceRows([]);
    } finally {
      setReviewComplianceLoading(false);
    }
  };

  const fetchComplianceCheckHistory = async (
    complianceId
  ) => {
    if (!complianceId) {
      setComplianceCheckHistory([]);
      return;
    }

    setCheckHistoryLoading(true);

    try {
      const res = await api.get(
        `/travel-plan-compliances/${complianceId}/checks`
      );

      setComplianceCheckHistory(
        Array.isArray(res.data)
          ? res.data
          : []
      );
    } catch (err) {
      console.error(
        "Fetch compliance check history error:",
        err
      );

      setComplianceCheckHistory([]);
    } finally {
      setCheckHistoryLoading(false);
    }
  };

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
      const res = await api.get(`/travel-plans/staff-scope?date=${staffScopeDate}`);
      setStaffRows(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Fetch travel staff scope error:", err);
      setStaffRows([]);
    }
  };

  const fetchStaffDropdown = async () => {
    try {
      const res = await api.get(
        "/travel-plans/staff-dropdown"
      );

      setStaffDropdownRows(
        Array.isArray(res.data)
          ? res.data
          : []
      );
    } catch (err) {
      console.error(
        "Fetch travel staff dropdown error:",
        err
      );

      setStaffDropdownRows([]);
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
    if (activeMenu === "Comply") {
      fetchMyCompliances();

      if (canReviewCompliance) {
        fetchReviewCompliances();
      }

      return;
    }

    fetchActivities();
    fetchStaffDropdown();
    fetchScopedBranches();
    fetchPlans();
  }, [
    activeMenu,
    canReviewCompliance,
  ]);

  useEffect(() => {
    if (activeMenu === "Travel Plan") {
      fetchScopedStaff();
    }
  }, [
    activeMenu,
    staffScopeDate,
  ]);

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
    if (!canManageCalendarActivities) {
      alert("Only Admin and TREAD Department can manage calendar activities.");
      return;
    }
    if (
      !activityForm.title ||
      !activityForm.date_from ||
      !activityForm.date_to
    ) {
      alert("Title, Date From, and Date To are required.");
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

      setShowCreateActivity(false);
      setEditingActivityId(null);

      setActivityForm({
        title: "",
        date_from: "",
        date_to: "",
        subject: "",
        venue: "",
        description: "",
      });

      await fetchActivities();

      alert(
        editingActivityId
          ? "Activity updated successfully."
          : "Activity saved successfully."
      );
    } catch (err) {
      console.error("Save activity error:", err);

      alert(
        err.response?.data?.message ||
          "Failed to save activity."
      );
    }
  };

  const openEditActivity = (activity) => {
    if (!canManageCalendarActivities) {
      return;
    }
    setEditingActivityId(activity.id);

    setActivityForm({
      title: activity.title || "",
      date_from: String(
        activity.date_from || ""
      ).slice(0, 10),
      date_to: String(
        activity.date_to || ""
      ).slice(0, 10),
      subject: activity.subject || "",
      venue: activity.venue || "",
      description: activity.description || "",
    });

    setSelectedActivity(null);
    setSelectedCalendarDate("");
    setShowCreateActivity(true);
  };

  const deleteActivity = async (activityId) => {
    if (!canManageCalendarActivities) {
      alert("Only Admin and TREAD Department can delete calendar activities.");
      return;
    }
    if (!activityId) return;

    if (
      !window.confirm(
        "Delete this calendar activity?"
      )
    ) {
      return;
    }

    try {
      await api.delete(
        `/calendar-activities/${activityId}`
      );

      setSelectedActivity(null);
      setSelectedCalendarDate("");

      await fetchActivities();

      alert("Activity deleted successfully.");
    } catch (err) {
      console.error(
        "Delete calendar activity error:",
        err
      );

      alert(
        err.response?.data?.message ||
          "Failed to delete activity."
      );
    }
  };


  const deleteTravelPlan = async (planId) => {
    if (!planId) {
      return;
    }

    const confirmed = window.confirm(
      "Delete this travel plan? This will also delete its notes and photos."
    );

    if (!confirmed) {
      return;
    }

    try {
      await api.delete(`/travel-plans/${planId}`);

      if (selectedPlan?.id === planId) {
        closePlan();
      }

      setSelectedStaffScope((currentStaff) => {
        if (!currentStaff) {
          return null;
        }

        return {
          ...currentStaff,
        };
      });

      await fetchPlans();
      await fetchScopedStaff();

      alert("Travel plan deleted successfully.");
    } catch (err) {
      console.error(
        "Delete travel plan error:",
        err
      );

      alert(
        err.response?.data?.message ||
          "Failed to delete travel plan."
      );
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

    if (
      type === "FINDINGS" &&
      noteForm.involved_staff_ids.length === 0
    ) {
      alert(
        "Select at least one involved staff member."
      );

      return;
    }

    try {
      await api.post(
        `/travel-plans/${selectedPlan.id}/notes`,
        {
          note_type: type,

          title: noteForm.title.trim(),

          involved_staff:
            noteForm.involved_staff.join(", "),

          involved_staff_ids:
            noteForm.involved_staff_ids,

          due_date:
            type === "FINDINGS"
              ? noteForm.due_date || null
              : null,

          content: noteForm.content.trim(),
        }
      );

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
                <div className="travel-involved-list">
                  <b>Involved Staff:</b>

                  <div className="travel-involved-tags">
                    {String(note.involved_staff)
                      .split(", ")
                      .filter(Boolean)
                      .map((staffName, index) => (
                        <span
                          key={`${staffName}-${index}`}
                          className="travel-involved-tag"
                        >
                          {staffName}
                        </span>
                      ))}
                  </div>
                </div>
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
              Involved Staff
              <Select
                className="travel-staff-search"
                classNamePrefix="select"
                options={staffOptions}
                placeholder="Search and select staff..."
                isMulti
                isClearable
                closeMenuOnSelect={false}
                value={staffOptions.filter((option) =>
                  noteForm.involved_staff_ids.includes(
                    Number(option.value)
                  )
                )}
                onChange={(selectedOptions) => {
                  const selected = Array.isArray(
                    selectedOptions
                  )
                    ? selectedOptions
                    : [];

                  setNoteForm((previous) => ({
                    ...previous,

                    involved_staff_ids:
                      selected.map((option) =>
                        Number(option.value)
                      ),

                    involved_staff:
                      selected.map(
                        (option) =>
                          option.employee_name
                      ),
                  }));
                }}
                noOptionsMessage={() => "No staff found"}
              />
            </label>

            {!isReview && (
              <label>
                Compliance Due Date

                <input
                  type="date"
                  value={noteForm.due_date}
                  onChange={(event) =>
                    setNoteForm((previous) => ({
                      ...previous,
                      due_date: event.target.value,
                    }))
                  }
                />
              </label>
            )}

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

  const updateTravelPlan = async () => {
    if (!selectedPlan?.id) return;

    if (!selectedPlan.title || !selectedPlan.plan_date) {
      alert("Title and date are required.");
      return;
    }

    try {
      const res = await api.put(`/travel-plans/${selectedPlan.id}`, {
        title: selectedPlan.title,
        plan_date: String(selectedPlan.plan_date).slice(0, 10),
        employee_name: selectedPlan.employee_name,
        position: selectedPlan.position,
        branch_name: selectedPlan.branch_name,
        description: selectedPlan.description,
      });

      setSelectedPlan(res.data.plan);
      fetchPlans();

      alert("Travel plan updated.");
    } catch (err) {
      console.error("Update travel plan error:", err);
      alert(err.response?.data?.message || "Failed to update travel plan.");
    }
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

  const submitCompliance = async () => {
    if (!selectedCompliance?.id) {
      return;
    }

    if (!complianceResponse.trim()) {
      alert(
        "Compliance response is required."
      );

      return;
    }

    try {
      await api.put(
        `/travel-plan-compliances/${selectedCompliance.id}/comply`,
        {
          compliance_response:
            complianceResponse.trim(),
        }
      );

      setSelectedCompliance(null);
      setComplianceResponse("");

      await fetchMyCompliances();

      window.dispatchEvent(
        new Event("travel-compliance-updated")
      );

      alert(
        "Compliance submitted successfully."
      );
    } catch (err) {
      console.error(
        "Submit compliance error:",
        err
      );

      alert(
        err.response?.data?.message ||
          "Failed to submit compliance."
      );
    }
  };

  const checkCompliance = async () => {
    if (!selectedReviewCompliance?.id) {
      return;
    }

    const confirmed = window.confirm(
      `Check the compliance submitted by ${
        selectedReviewCompliance.employee_name ||
        "this employee"
      }?`
    );

    if (!confirmed) {
      return;
    }

    try {
      await api.put(
        `/travel-plan-compliances/${selectedReviewCompliance.id}/check`,
        {
          remarks: reviewRemarks.trim() || null,
        }
      );

      setSelectedReviewCompliance(null);
      setReviewRemarks("");
      setComplianceCheckHistory([]);

      await Promise.all([
        fetchReviewCompliances(),
        fetchMyCompliances(),
      ]);

      window.dispatchEvent(
        new Event(
          "travel-compliance-updated"
        )
      );

      alert(
        "Compliance checked successfully."
      );
    } catch (err) {
      console.error(
        "Check compliance error:",
        err
      );

      alert(
        err.response?.data?.message ||
          "Failed to check compliance."
      );
    }
  };

  return (
    <div className="travel-modern-page">
      <div className="travel-modern-layout">
        <main className="travel-calendar-main">
          <div className="travel-topbar">
            <div className="travel-view-tabs">
              <button className="active" type="button">
                Month
              </button>
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
              {activeMenu !== "Comply" && (
                <>
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

                  {canManageCalendarActivities && (
                    <button
                      className="travel-create-btn secondary"
                      type="button"
                      onClick={() => {
                        setEditingActivityId(null);

                        setActivityForm({
                          title: "",
                          date_from: "",
                          date_to: "",
                          subject: "",
                          venue: "",
                          description: "",
                        });

                        setShowCreateActivity(true);
                      }}
                    >
                      + Create Activity
                    </button>
                  )}
                </>
              )}
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

                        <input
                          type="text"
                          placeholder="Search branch..."
                          value={branchSearch}
                          onChange={(e) => setBranchSearch(e.target.value)}
                          className="travel-branch-search"
                        />
                        <div className="travel-branch-location-filters">
                          <label>
                            <span>Division</span>

                            <select
                              value={branchDivisionFilter}
                              onChange={(e) => {
                                setBranchDivisionFilter(e.target.value);
                                setBranchRegionFilter("");
                                setBranchAreaFilter("");
                              }}
                            >
                              <option value="">All</option>

                              {divisionOptions.map((division) => (
                                <option key={division} value={division}>
                                  {division}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label>
                            <span>Region</span>

                            <select
                              value={branchRegionFilter}
                              onChange={(e) => {
                                setBranchRegionFilter(e.target.value);
                                setBranchAreaFilter("");
                              }}
                            >
                              <option value="">All</option>

                              {regionOptions.map((region) => (
                                <option key={region} value={region}>
                                  {region}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label>
                            <span>Area</span>

                            <select
                              value={branchAreaFilter}
                              onChange={(e) =>
                                setBranchAreaFilter(e.target.value)
                              }
                            >
                              <option value="">All</option>

                              {areaOptions.map((area) => (
                                <option key={area} value={area}>
                                  {area}
                                </option>
                              ))}
                            </select>
                          </label>

                          {(branchDivisionFilter ||
                            branchRegionFilter ||
                            branchAreaFilter) && (
                            <button
                              type="button"
                              className="travel-branch-filter-clear"
                              onClick={() => {
                                setBranchDivisionFilter("");
                                setBranchRegionFilter("");
                                setBranchAreaFilter("");
                              }}
                            >
                              Clear
                            </button>
                          )}
                        </div>
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

                    {filteredMostVisitedBranches.length === 0 ? (
                      <div className="travel-empty">
                        No branch visits yet.
                      </div>
                    ) : (
                      <div className="branch-visit-chart">
                        {filteredMostVisitedBranches.map((item) => (
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


              {/* STAFF SCOPE */}
                <div className="travel-dashboard-card">
                  <div className="travel-dashboard-head">
                    <div>
                      <h3>Staff Scope</h3>
                      <p>Staff visible based on your position.</p>
                    </div>

                    <div className="travel-staff-filter">

                      <input
                        type="search"
                        className="travel-staff-search-input"
                        placeholder="Search staff, position, branch..."
                        value={staffSearch}
                        onChange={(event) =>
                          setStaffSearch(event.target.value)
                        }
                      />

                      <div className="travel-staff-date">
                        <input
                          type="date"
                          className="travel-date-input"
                          value={staffScopeDate}
                          onChange={(e) => setStaffScopeDate(e.target.value)}
                        />
                      </div>

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

                      <div className="travel-staff-counts">
                        <span className="travel-count-pill">
                          {staffCounts.total} Staff
                        </span>

                        <span className="travel-count-pill submitted">
                          {staffCounts.submitted} Submitted
                        </span>

                        <span className="travel-count-pill pending">
                          {staffCounts.pending} Pending
                        </span>

                        {staffCounts.onLeave > 0 && (
                          <span className="travel-count-pill leave">
                            {staffCounts.onLeave} On Leave
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {filteredStaffRows.length === 0 ? (
                    <div className="travel-empty">
                      No staff found.
                    </div>
                  ) : (
                    <div className="travel-staff-list">
                      {filteredStaffRows.map((staff) => (
                        <button
                          key={staff.employee_no}
                          type="button"
                          className="travel-staff-card travel-staff-card-button"
                          onClick={() => {
                            setSelectedStaffScope(staff);
                            setStaffPlanSearch("");
                            setStaffPlanDateFilter("");
                          }}
                        >
                          <div>
                            <strong>{staff.employee_name}</strong>

                            <p>{staff.position}</p>

                            <small>{staff.branch_name}</small>
                          </div>

                          <div className="travel-staff-right">
                            <span>{staff.area}</span>

                            <span>{staff.region}</span>

                            <div className="travel-staff-status-wrap">
                              <div
                                className={`travel-staff-status ${String(
                                  staff.travel_status || "Pending"
                                )
                                  .trim()
                                  .toLowerCase()
                                  .replace(/\s+/g, "-")}`}
                              >
                                {staff.travel_status || "Pending"}
                              </div>

                              {staff.travel_status === "On Leave" && (
                                <small className="travel-staff-leave-date">
                                  {staff.leave_start_date} - {staff.leave_end_date}
                                </small>
                              )}

                              {staff.travel_status === "Indefinite Leave" && (
                                <small className="travel-staff-leave-date">
                                  No Return Date
                                </small>
                              )}
                            </div>
                          </div>
                        </button>
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

          {activeMenu === "Forecast" && (
            <div className="travel-forecast-page">
              <div className="travel-forecast-sidebar">
                <div className="travel-forecast-brand">
                  Travel Forecast
                </div>

                <div className="travel-forecast-current">
                  <span>{forecastSelectedDay.dayName}</span>

                  <strong>
                    {forecastSelectedDay.dayNumber}
                  </strong>

                  <small>
                    {forecastSelectedDay.monthName}
                  </small>
                </div>

                <div className="travel-forecast-summary">
                  <div>
                    <span>Total Plans</span>
                    <b>{forecastSelectedDay.total}</b>
                  </div>

                  <div>
                    <span>Completed</span>
                    <b>{forecastSelectedDay.completed}</b>
                  </div>

                  <div>
                    <span>Pending</span>
                    <b>{forecastSelectedDay.pending}</b>
                  </div>
                </div>
              </div>

              <div className="travel-forecast-main">
                <div className="travel-forecast-hero">
                  <div>
                    <span className="travel-forecast-date">
                      {forecastSelectedDay.fullDate}
                    </span>

                    <h1>
                      {forecastSelectedDay.total === 0
                        ? "No Travel Plans"
                        : forecastSelectedDay.total === 1
                        ? "1 Travel Plan"
                        : `${forecastSelectedDay.total} Travel Plans`}
                    </h1>

                    <p>
                      {forecastSelectedDay.total === 0
                        ? "No scheduled branch visits for this day."
                        : "Scheduled branch visits and activities for the selected day."}
                    </p>
                  </div>

                  <div className="travel-forecast-count">
                    {forecastSelectedDay.total}
                  </div>
                </div>

                <div className="travel-forecast-plan-list">
                  {forecastSelectedDay.plans.length === 0 ? (
                    <div className="travel-forecast-empty">
                      No travel plans scheduled.
                    </div>
                  ) : (
                    forecastSelectedDay.plans.map((plan) => (
                      <button
                        key={plan.id}
                        type="button"
                        className="travel-forecast-plan-card"
                        onClick={() => openPlan(plan)}
                      >
                        <div>
                          <strong>
                            {plan.title || "Untitled Travel Plan"}
                          </strong>

                          <span>
                            {plan.employee_name || "No employee assigned"}
                          </span>

                          <small>
                            {plan.branch_name || "No branch selected"}
                          </small>
                        </div>

                        <b
                          className={`travel-status ${
                            plan.status === "Completed"
                              ? "completed"
                              : "pending"
                          }`}
                        >
                          {plan.status || "Pending"}
                        </b>
                      </button>
                    ))
                  )}
                </div>

                <div className="travel-forecast-week">
                  {forecastWeek.map((day) => (
                    <button
                      key={day.date}
                      type="button"
                      className={`travel-forecast-day ${
                        forecastSelectedDate === day.date
                          ? "active"
                          : ""
                      }`}
                      onClick={() =>
                        setForecastSelectedDate(day.date)
                      }
                    >
                      <span>{day.shortName}</span>

                      <strong>{day.dayNumber}</strong>

                      <small>
                        {day.total}{" "}
                        {day.total === 1 ? "Plan" : "Plans"}
                      </small>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeMenu === "Comply" && (
            <div className="travel-dashboard-card">
              <div className="travel-dashboard-head">
                <div>
                  <h3>Travel Plan Comply</h3>

                  <p>
                    Submit assigned findings and check staff compliance.
                  </p>
                </div>

                <div className="travel-comply-counts">
                  {complyView === "my" ? (
                    <>
                      <span className="travel-count-pill">
                        {complianceCounts.total} Records
                      </span>

                      <span className="travel-count-pill pending">
                        {complianceCounts.pending} Pending
                      </span>

                      <span className="travel-count-pill submitted">
                        {complianceCounts.submitted} Submitted
                      </span>

                      <span className="travel-count-pill checked">
                        {complianceCounts.checked} Checked
                      </span>

                      <span className="travel-count-pill completed">
                        {complianceCounts.complied} Complied
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="travel-count-pill">
                        {reviewComplianceCounts.total} For Checking
                      </span>

                      <span className="travel-count-pill pending">
                        {reviewComplianceCounts.submitted} Submitted
                      </span>

                      <span className="travel-count-pill submitted">
                        {reviewComplianceCounts.checked} Checked
                      </span>
                    </>
                  )}
                </div>
              </div>

              {canReviewCompliance && (
                <div className="travel-comply-view-tabs">
                  <button
                    type="button"
                    className={complyView === "my" ? "active" : ""}
                    onClick={() => setComplyView("my")}
                  >
                    My Compliance
                  </button>

                  <button
                    type="button"
                    className={complyView === "review" ? "active" : ""}
                    onClick={() => setComplyView("review")}
                  >
                    For Checking
                  </button>
                </div>
              )}

              <div className="travel-comply-filters">
                <input
                  type="search"
                  placeholder={
                    complyView === "my"
                      ? "Search finding, branch, travel plan..."
                      : "Search staff, branch, finding..."
                  }
                  value={complianceSearch}
                  onChange={(event) =>
                    setComplianceSearch(
                      event.target.value
                    )
                  }
                />

                <select
                  value={complianceStatusFilter}
                  onChange={(event) =>
                    setComplianceStatusFilter(
                      event.target.value
                    )
                  }
                >
                  <option value="">
                    All Statuses
                  </option>

                  {complyView === "my" ? (
                    <>
                      <option value="Pending">
                        Pending
                      </option>

                      <option value="Submitted">
                        Submitted
                      </option>

                      <option value="Checked">
                        Checked
                      </option>

                      <option value="Complied">
                        Complied
                      </option>
                    </>
                  ) : (
                    <>
                      <option value="Submitted">
                        Submitted
                      </option>

                      <option value="Checked">
                        Checked
                      </option>
                    </>
                  )}
                </select>

                {(complianceSearch ||
                  complianceStatusFilter) && (
                  <button
                    type="button"
                    onClick={() => {
                      setComplianceSearch("");
                      setComplianceStatusFilter("");
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>

              {complyView === "my" ? (
                complianceLoading ? (
                  <div className="travel-empty">
                    Loading compliance records...
                  </div>
                ) : filteredComplianceRows.length === 0 ? (
                  <div className="travel-empty">
                    No compliance findings assigned to your account.
                  </div>
                ) : (
                  <div className="travel-comply-list">
                    {filteredComplianceRows.map(
                      (item) => {
                        const status =
                          normalizeValue(item.status);

                        return (
                          <button
                            key={item.id}
                            type="button"
                            className="travel-comply-card"
                            onClick={() => {
                              setSelectedCompliance(item);

                              setComplianceResponse(
                                item.compliance_response ||
                                  ""
                              );
                            }}
                          >
                            <div className="travel-comply-main">
                              <div className="travel-comply-title-row">
                                <strong>
                                  {item.finding_title ||
                                    "Untitled Finding"}
                                </strong>

                                <span
                                  className={`travel-status ${status}`}
                                >
                                  {item.status}
                                </span>
                              </div>

                              <p>
                                {item.travel_plan_title ||
                                  "No travel plan title"}
                              </p>

                              <small>
                                Staff:{" "}
                                {item.employee_name || "-"}
                                {" • "}
                                Branch:{" "}
                                {item.branch_name || "-"}
                              </small>

                              {item.latest_checked_by_role && (
                                <div className="travel-checked-by">
                                  ✓ Checked by{" "}
                                  {item.latest_checked_by_role}

                                  {item.latest_checked_by_name && (
                                    <>
                                      {" — "}
                                      {item.latest_checked_by_name}
                                    </>
                                  )}
                                </div>
                              )}

                              {item.finding_details && (
                                <div className="travel-comply-preview">
                                  {item.finding_details}
                                </div>
                              )}
                            </div>

                            <div className="travel-comply-meta">
                              <span>
                                Assigned:{" "}
                                {String(
                                  item.created_at || ""
                                ).slice(0, 10)}
                              </span>

                              <span>
                                Due:{" "}
                                {item.due_date ||
                                  "No due date"}
                              </span>

                              <b>
                                {status === "pending"
                                  ? "Submit Compliance"
                                  : "View Compliance"}
                              </b>
                            </div>
                          </button>
                        );
                      }
                    )}
                  </div>
                )
              ) : reviewComplianceLoading ? (
                <div className="travel-empty">
                  Loading records for checking...
                </div>
              ) : filteredReviewComplianceRows.length === 0 ? (
                <div className="travel-empty">
                  No staff compliance is currently waiting for your checking level.
                </div>
              ) : (
                <div className="travel-comply-list">
                  {filteredReviewComplianceRows.map(
                    (item) => (
                      <button
                        key={item.id}
                        type="button"
                        className="travel-comply-card travel-comply-review-card"
                        onClick={() => {
                          setSelectedReviewCompliance(
                            item
                          );

                          setReviewRemarks("");

                          fetchComplianceCheckHistory(
                            item.id
                          );
                        }}
                      >
                        <div className="travel-comply-main">
                          <div className="travel-comply-title-row">
                            <strong>
                              {item.finding_title ||
                                "Untitled Finding"}
                            </strong>

                            <span className="travel-status pending">
                              For Checking
                            </span>
                          </div>

                          <p>
                            {item.employee_name ||
                              "No employee"}
                          </p>

                          <small>
                            {item.position || "No position"}
                            {" • "}
                            Staff Branch:{" "}
                            {item.branch_name || "-"}
                            {" • "}
                            Visited Branch:{" "}
                            {item.visited_branch_name ||
                              "-"}
                          </small>

                          {item.latest_checked_by_role && (
                            <div className="travel-checked-by">
                              Latest: Checked by{" "}
                              {item.latest_checked_by_role}

                              {item.latest_checked_by_name && (
                                <>
                                  {" — "}
                                  {item.latest_checked_by_name}
                                </>
                              )}
                            </div>
                          )}

                          {item.compliance_response && (
                            <div className="travel-comply-preview">
                              Response:{" "}
                              {item.compliance_response}
                            </div>
                          )}
                        </div>

                        <div className="travel-comply-meta">
                          <span>
                            Current Level:{" "}
                            {item.review_level || 1}
                          </span>

                          <span>
                            Due:{" "}
                            {item.due_date ||
                              "No due date"}
                          </span>

                          <b>Open and Check</b>
                        </div>
                      </button>
                    )
                  )}
                </div>
              )}
            </div>
          )}

          {selectedCompliance && (
            <div className="travel-plan-modal-backdrop">
              <div className="travel-plan-modal travel-comply-modal">
                <div className="travel-plan-modal-head">
                  <div>
                    <h3>
                      {selectedCompliance.finding_title}
                    </h3>

                    <p className="travel-staff-modal-subtitle">
                      {selectedCompliance.travel_plan_title ||
                        "Travel Plan Finding"}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCompliance(null);
                      setComplianceResponse("");
                    }}
                  >
                    ×
                  </button>
                </div>

                <div className="travel-comply-detail-grid">
                  <div>
                    <span>Assigned Staff</span>

                    <b>
                      {selectedCompliance.employee_name ||
                        "-"}
                    </b>
                  </div>

                  <div>
                    <span>Staff Branch</span>

                    <b>
                      {selectedCompliance.branch_name ||
                        "-"}
                    </b>
                  </div>

                  <div>
                    <span>Visited Branch</span>

                    <b>
                      {selectedCompliance.visited_branch_name ||
                        "-"}
                    </b>
                  </div>

                  <div>
                    <span>Due Date</span>

                    <b>
                      {selectedCompliance.due_date ||
                        "No due date"}
                    </b>
                  </div>

                  <div>
                    <span>Status</span>

                    <b>
                      {selectedCompliance.status}
                    </b>
                  </div>

                  <div>
                    <span>Travel Plan Date</span>

                    <b>
                      {selectedCompliance.travel_plan_date ||
                        "-"}
                    </b>
                  </div>
                </div>

                <div className="travel-comply-finding">
                  <span>Finding Details</span>

                  <p>
                    {selectedCompliance.finding_details ||
                      "No finding details."}
                  </p>
                </div>

                <label className="travel-comply-response">
                  Compliance Response

                  <textarea
                    rows={7}
                    placeholder="Write the action taken or your compliance response..."
                    value={complianceResponse}
                    disabled={
                      normalizeValue(
                        selectedCompliance.status
                      ) !== "pending"
                    }
                    onChange={(event) =>
                      setComplianceResponse(
                        event.target.value
                      )
                    }
                  />
                </label>

                {selectedCompliance.complied_at && (
                  <div className="travel-comply-submitted-at">
                    Submitted:{" "}
                    {formatTime(
                      selectedCompliance.complied_at
                    )}
                  </div>
                )}

                <div className="travel-plan-modal-actions">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCompliance(null);
                      setComplianceResponse("");
                    }}
                  >
                    Close
                  </button>

                  {normalizeValue(
                    selectedCompliance.status
                  ) === "pending" && (
                    <button
                      type="button"
                      className="primary"
                      onClick={submitCompliance}
                    >
                      Submit Compliance
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {selectedReviewCompliance && canReviewCompliance && (
            <div className="travel-plan-modal-backdrop">
              <div className="travel-plan-modal travel-comply-modal">
                <div className="travel-plan-modal-head">
                  <div>
                    <h3>
                      Check Staff Compliance
                    </h3>

                    <p className="travel-staff-modal-subtitle">
                      {selectedReviewCompliance.finding_title ||
                        "Travel Plan Finding"}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedReviewCompliance(null);
                      setReviewRemarks("");
                      setComplianceCheckHistory([]);
                    }}
                  >
                    ×
                  </button>
                </div>

                <div className="travel-comply-detail-grid">
                  <div>
                    <span>Staff</span>

                    <b>
                      {selectedReviewCompliance.employee_name ||
                        "-"}
                    </b>
                  </div>

                  <div>
                    <span>Position</span>

                    <b>
                      {selectedReviewCompliance.position ||
                        "-"}
                    </b>
                  </div>

                  <div>
                    <span>Staff Branch</span>

                    <b>
                      {selectedReviewCompliance.branch_name ||
                        "-"}
                    </b>
                  </div>

                  <div>
                    <span>Visited Branch</span>

                    <b>
                      {selectedReviewCompliance.visited_branch_name ||
                        "-"}
                    </b>
                  </div>

                  <div>
                    <span>Current Status</span>

                    <b>
                      {selectedReviewCompliance.status}
                    </b>
                  </div>

                  <div>
                    <span>Current Level</span>

                    <b>
                      Level{" "}
                      {selectedReviewCompliance.review_level ||
                        1}
                    </b>
                  </div>
                </div>

                <div className="travel-comply-finding">
                  <span>Finding Details</span>

                  <p>
                    {selectedReviewCompliance.finding_details ||
                      "No finding details."}
                  </p>
                </div>

                <div className="travel-comply-finding">
                  <span>Staff Compliance Response</span>

                  <p>
                    {selectedReviewCompliance.compliance_response ||
                      "No compliance response."}
                  </p>
                </div>

                <div className="travel-check-history">
                  <h4>Checking History</h4>

                  {checkHistoryLoading ? (
                    <div className="travel-empty">
                      Loading checking history...
                    </div>
                  ) : complianceCheckHistory.length === 0 ? (
                    <div className="travel-empty">
                      No manager has checked this yet.
                    </div>
                  ) : (
                    <div className="travel-check-history-list">
                      {complianceCheckHistory.map(
                        (check) => (
                          <div
                            key={check.id}
                            className="travel-check-history-item"
                          >
                            <div>
                              <strong>
                                ✓ Checked by{" "}
                                {check.checked_by_role}
                              </strong>

                              <span>
                                {check.checked_by_name ||
                                  "Unknown checker"}
                              </span>
                            </div>

                            <div>
                              <span>
                                {formatTime(
                                  check.checked_at
                                )}
                              </span>

                              {check.remarks && (
                                <small>
                                  {check.remarks}
                                </small>
                              )}
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>

                <label className="travel-comply-response">
                  Checking Remarks

                  <textarea
                    rows={5}
                    placeholder="Add remarks about the staff compliance..."
                    value={reviewRemarks}
                    onChange={(event) =>
                      setReviewRemarks(
                        event.target.value
                      )
                    }
                  />
                </label>

                <div className="travel-plan-modal-actions">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedReviewCompliance(null);
                      setReviewRemarks("");
                      setComplianceCheckHistory([]);
                    }}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className="primary"
                    onClick={checkCompliance}
                  >
                    ✓ Check Compliance
                  </button>
                </div>
              </div>
            </div>
          )}

          {showCreateActivity && canManageCalendarActivities && (
            <div className="travel-plan-modal-backdrop">
              <div className="travel-plan-modal">
                <div className="travel-plan-modal-head">
                  <h3>
                    {editingActivityId
                      ? "Edit Activity"
                      : "Create Activity"}
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateActivity(false);
                      setEditingActivityId(null);
                    }}
                  >
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
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateActivity(false);
                      setEditingActivityId(null);
                    }}
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

                      options={staffDropdownRows.map((staff) => ({
                        value: staff.employee_no,

                        label: [
                          staff.employee_name,
                          staff.position,
                          staff.branch_name,
                        ]
                          .filter(Boolean)
                          .join(" • "),
                      }))}

                      value={
                        staffDropdownRows
                          .filter((s) => s.employee_name === planForm.employee_name)
                          .map((s) => ({
                            value: s.employee_no,
                            label: [
                              s.employee_name,
                              s.position,
                              s.branch_name,
                            ]
                              .filter(Boolean)
                              .join(" • "),
                          }))[0] || null
                      }

                      onChange={(option) => {
                        const staff = staffDropdownRows.find(
                          (s) =>
                            String(s.employee_no) ===
                            String(option?.value)
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
                              {activity.days || 0} day
                              {Number(activity.days) > 1 ? "s" : ""}
                            </b>

                            {canManageCalendarActivities && (
                              <div className="travel-record-actions">
                                <button
                                  type="button"
                                  className="travel-record-edit"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    openEditActivity(activity);
                                  }}
                                >
                                  Edit
                                </button>

                                {canDeleteTravelPlans && (
                                  <button
                                    type="button"
                                    className="travel-record-delete"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      deleteActivity(activity.id);
                                    }}
                                  >
                                    Delete
                                  </button>
                                )}
                              </div>
                            )}
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

                    {canManageCalendarActivities && (
                      <div className="travel-activity-detail-actions">
                        <button
                          type="button"
                          className="travel-record-edit"
                          onClick={() =>
                            openEditActivity(selectedActivity)
                          }
                        >
                          Edit Activity
                        </button>

                        <button
                          type="button"
                          className="travel-record-delete"
                          onClick={() =>
                            deleteActivity(selectedActivity.id)
                          }
                        >
                          Delete Activity
                        </button>
                      </div>
                    )}

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
                  <div className="travel-edit-grid">
                    <label>
                      Title
                      <input
                        type="text"
                        value={selectedPlan.title || ""}
                        disabled={selectedPlan.status === "Completed"}
                        onChange={(e) =>
                          setSelectedPlan((prev) => ({
                            ...prev,
                            title: e.target.value,
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
                        isDisabled={selectedPlan.status === "Completed"}
                        placeholder="Search branch..."
                        options={branchRows.map((branch) => ({
                          value: branch.branch_name,
                          label: branch.branch_name,
                        }))}
                        value={
                          selectedPlan.branch_name
                            ? {
                                value: selectedPlan.branch_name,
                                label: selectedPlan.branch_name,
                              }
                            : null
                        }
                        onChange={(option) =>
                          setSelectedPlan((prev) => ({
                            ...prev,
                            branch_name: option?.value || "",
                          }))
                        }
                      />
                    </label>

                    <label>
                      Date
                      <input
                        type="date"
                        value={String(selectedPlan.plan_date || "").slice(0, 10)}
                        disabled={selectedPlan.status === "Completed"}
                        onChange={(e) =>
                          setSelectedPlan((prev) => ({
                            ...prev,
                            plan_date: e.target.value,
                          }))
                        }
                      />
                    </label>

                    <label className="full">
                      Description
                      <textarea
                        rows="4"
                        value={selectedPlan.description || ""}
                        disabled={selectedPlan.status === "Completed"}
                        onChange={(e) =>
                          setSelectedPlan((prev) => ({
                            ...prev,
                            description: e.target.value,
                          }))
                        }
                      />
                    </label>

                    {selectedPlan.status !== "Completed" && (
                      <button
                        type="button"
                        className="travel-save-changes-btn"
                        onClick={updateTravelPlan}
                      >
                        Save Changes
                      </button>
                    )}
                  </div>

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
                          Take Time In Picture
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
                        Take Time Out Picture
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

          {selectedStaffScope && (
            <div className="travel-plan-modal-backdrop">
              <div className="travel-plan-modal travel-staff-plans-modal">
                <div className="travel-plan-modal-head">
                  <div>
                    <h3>
                      {selectedStaffScope.employee_name}
                    </h3>

                    <p className="travel-staff-modal-subtitle">
                      {selectedStaffScope.position || "No position"}
                      {" • "}
                      {selectedStaffScope.branch_name || "No branch"}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedStaffScope(null);
                      setStaffPlanSearch("");
                      setStaffPlanDateFilter("");
                    }}
                  >
                    ×
                  </button>
                </div>

                <div className="travel-staff-plan-summary">
                  <div>
                    <span>Employee No.</span>
                    <b>
                      {selectedStaffScope.employee_no || "-"}
                    </b>
                  </div>

                  <div>
                    <span>Status</span>
                    <b>
                      {selectedStaffScope.travel_status || "Pending"}
                    </b>
                  </div>

                  <div>
                    <span>Total Plans</span>
                    <b>{selectedStaffPlans.length}</b>
                  </div>
                </div>

                <div className="travel-staff-plan-filters">
                  <input
                    type="search"
                    placeholder="Search title, branch, description, status..."
                    value={staffPlanSearch}
                    onChange={(event) =>
                      setStaffPlanSearch(event.target.value)
                    }
                  />

                  <input
                    type="date"
                    value={staffPlanDateFilter}
                    onChange={(event) =>
                      setStaffPlanDateFilter(event.target.value)
                    }
                  />

                  <button
                    type="button"
                    disabled={
                      !staffPlanSearch &&
                      !staffPlanDateFilter
                    }
                    onClick={() => {
                      setStaffPlanSearch("");
                      setStaffPlanDateFilter("");
                    }}
                  >
                    Clear
                  </button>

                  <span className="travel-count-pill">
                    {selectedStaffPlans.length}{" "}
                    {selectedStaffPlans.length === 1
                      ? "Plan"
                      : "Plans"}
                  </span>
                </div>

                {selectedStaffPlans.length === 0 ? (
                  <div className="travel-empty">
                    No travel plans found for this staff member.
                  </div>
                ) : (
                  <div className="travel-staff-plan-list">
                    {selectedStaffPlans.map((plan) => (
                      <div
                        key={plan.id}
                        className="travel-staff-plan-item"
                        onClick={() => {
                          setSelectedStaffScope(null);
                          openPlan(plan);
                        }}
                      >
                        <div className="travel-staff-plan-main">
                          <strong>
                            {plan.title || "Untitled Travel Plan"}
                          </strong>

                          <span>
                            {plan.branch_name || "No branch selected"}
                          </span>

                          {plan.description && (
                            <small>{plan.description}</small>
                          )}
                        </div>

                        <div className="travel-staff-plan-meta">
                          <span>
                            {String(plan.plan_date || "").slice(0, 10)}
                          </span>

                          <b
                            className={`travel-status ${
                              normalizeValue(plan.status) === "completed"
                                ? "completed"
                                : "pending"
                            }`}
                          >
                            {plan.status || "Pending"}
                          </b>

                          <div className="travel-staff-plan-actions">
                            {normalizeValue(plan.status) !== "completed" && (
                              <button
                                type="button"
                                className="travel-record-edit"
                                onClick={(event) => {
                                  event.stopPropagation();

                                  setSelectedStaffScope(null);
                                  openPlan(plan);
                                }}
                              >
                                Edit
                              </button>
                            )}

                            <button
                              type="button"
                              className="travel-record-delete"
                              onClick={(event) => {
                                event.stopPropagation();
                                deleteTravelPlan(plan.id);
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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