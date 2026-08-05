import { useEffect, useMemo, useState } from "react";
import api from "../../api/axiosClient";
import "../../styles/Calendar.css";

import TravelTopbar from "../../components/travel/TravelTopbar";
import TravelPlanDetailsModal from "../../components/travel/TravelPlanDetailsModal";
import CreateTravelPlanModal from "../../components/travel/CreateTravelPlanModal";
import StaffScopePlansModal from "../../components/travel/StaffScopePlansModal";
import BranchVisitPlansModal from "../../components/travel/BranchVisitPlansModal";
import StaffScope from "../../components/travel/StaffScope";
import TravelDashboard from "../../components/travel/TravelDashboard";
import TravelPlanNoteTab from "../../components/travel/TravelPlanNoteTab";
import PhotoGrid from "../../components/travel/PhotoGrid";
import TravelPlanNote from "../../components/travel/TravelPlanNote";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

const emptyPlanForm = {
  title: "",
  plan_date: "",
  employee_name: "",
  position: "",
  branch_name: "",
  description: "",
};

const emptyNoteForm = {
  title: "",

  // Branch Visit Findings / REVIEW
  review_coh: "",
  review_cashbook_vs_voucher: "",
  review_lor: "",
  review_los: "",
  review_ldf: "",
  review_dcs: "",
  review_bms: "",
  review_other_findings: "",

  // Group Visit Findings / FINDINGS
  passbook_reconciliation: "",
  past_due_delinquent_report: "",
  group_collection_record: "",
  other_findings: "",

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

export default function TravelPlanPage() {
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

  const canDeleteTravelPlans =
    loggedInRole === "admin" ||
    loggedInRole === "it" ||
    loggedInDepartment === "tread department";

  const [month, setMonth] = useState(today.getMonth());
  const [year, setYear] = useState(today.getFullYear());
  const [visitRange, setVisitRange] = useState("month");

  const [branchSearch, setBranchSearch] = useState("");
  const [branchStaffFilter, setBranchStaffFilter] = useState("");
  const [branchDivisionFilter, setBranchDivisionFilter] = useState("");
  const [branchRegionFilter, setBranchRegionFilter] = useState("");
  const [branchAreaFilter, setBranchAreaFilter] = useState("");
  
  const [findingPhoto, setFindingPhoto] =
    useState(null);

  const [reviewPhoto, setReviewPhoto] =
    useState(null);

  const [selectedPlan, setSelectedPlan] = useState(null);
  const [detailTab, setDetailTab] = useState("checkin");
  const [previewPhoto, setPreviewPhoto] = useState(null);

  const [staffRows, setStaffRows] = useState([]);

  // Used only for Create Travel Plan.
  const [staffDropdownRows, setStaffDropdownRows] = useState([]);

  // Used only for Review and Findings.
  const [
    involvedStaffDropdownRows,
    setInvolvedStaffDropdownRows,
  ] = useState([]);

  const [staffPositionFilter, setStaffPositionFilter] = useState("");
  const [staffDepartmentFilter, setStaffDepartmentFilter] = useState("");
  const [staffSearch, setStaffSearch] = useState("");

  const [branchScopeRows, setBranchScopeRows] = useState([]);
  const [showCreatePlan, setShowCreatePlan] = useState(false);
  const [plans, setPlans] = useState([]);
  
  const [planPhotos, setPlanPhotos] = useState([]);
  const [planNotes, setPlanNotes] = useState([]);
  const [selectedBranchVisit, setSelectedBranchVisit] = useState(null);

  const [selectedStaffScope, setSelectedStaffScope] = useState(null);
  const [staffPlanSearch, setStaffPlanSearch] = useState("");
  const [staffPlanDateFilter, setStaffPlanDateFilter] = useState("");

  const [showNoteForm, setShowNoteForm] = useState(false);
  const [noteForm, setNoteForm] = useState(emptyNoteForm);
  const [editingNoteId, setEditingNoteId] = useState(null);

  const [editingNoteType, setEditingNoteType] = useState(null);
  const [staffScopeDate, setStaffScopeDate] = useState(
    new Date().toISOString().slice(0, 10)
  );

  const [planForm, setPlanForm] = useState(emptyPlanForm);

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

  const involvedStaffOptions = useMemo(
    () =>
      involvedStaffDropdownRows.map((staff) => ({
        value: Number(staff.id),

        employee_name: staff.employee_name,
        employee_no: staff.employee_no,
        position: staff.position,
        branch_name: staff.branch_name,
        status: staff.status,

        label: [
          staff.employee_name,
          staff.employee_no
            ? `Emp No: ${staff.employee_no}`
            : "",
          staff.position,
          staff.branch_name,
          staff.status
            ? `Status: ${staff.status}`
            : "",
        ]
          .filter(Boolean)
          .join(" • "),
      })),
    [involvedStaffDropdownRows]
  );

  const staffPositionOptions = useMemo(() => {
    return [...new Set(staffRows.map((s) => s.position).filter(Boolean))];
  }, [staffRows]);

  const staffDepartmentOptions = useMemo(() => {
    return [
      ...new Set(
        staffRows
          .map((staff) =>
            String(staff.department || "").trim()
          )
          .filter(Boolean)
      ),
    ].sort((a, b) => a.localeCompare(b));
  }, [staffRows]);

  const branchStaffOptions = useMemo(() => {
    const names = plans
      .map((plan) =>
        String(plan.employee_name || "").trim()
      )
      .filter(Boolean);

    return [...new Set(names)].sort((a, b) =>
      a.localeCompare(b)
    );
  }, [plans]);

  const filteredStaffRows = useMemo(() => {
    const search = normalizeValue(staffSearch);

    return staffRows.filter((staff) => {
      const matchesDepartment =
        !staffDepartmentFilter ||
        normalizeValue(staff.department) ===
          normalizeValue(staffDepartmentFilter);

      const matchesPosition =
        !staffPositionFilter ||
        normalizeValue(staff.position) ===
          normalizeValue(staffPositionFilter);

      const searchableText = normalizeValue(
        [
          staff.employee_no,
          staff.employee_name,
          staff.position,
          staff.department,
          staff.branch_name,
          staff.area,
          staff.region,
          staff.division,
          staff.travel_status,
        ]
          .filter(Boolean)
          .join(" ")
      );

      const matchesSearch =
        !search ||
        searchableText.includes(search);

      return (
        matchesDepartment &&
        matchesPosition &&
        matchesSearch
      );
    });
  }, [
    staffRows,
    staffDepartmentFilter,
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

    // Filter by selected staff.
    if (branchStaffFilter) {
      filteredPlans = filteredPlans.filter(
        (plan) =>
          normalizeValue(plan.employee_name) ===
          normalizeValue(branchStaffFilter)
      );
    }

    // Filter by selected period.
    if (visitRange === "week") {
      const weekAgo = new Date();

      weekAgo.setDate(now.getDate() - 7);

      filteredPlans = filteredPlans.filter(
        (plan) =>
          new Date(plan.plan_date) >= weekAgo
      );
    }

    if (visitRange === "month") {
      filteredPlans = filteredPlans.filter(
        (plan) => {
          const planDate = new Date(
            plan.plan_date
          );

          return (
            planDate.getMonth() === month &&
            planDate.getFullYear() === year
          );
        }
      );
    }

    if (visitRange === "year") {
      filteredPlans = filteredPlans.filter(
        (plan) => {
          const planDate = new Date(
            plan.plan_date
          );

          return (
            planDate.getFullYear() === year
          );
        }
      );
    }

    const counts = {};

    // Keep every scoped branch visible.
    branchRows.forEach((branch) => {
      const branchName = String(
        branch.branch_name || ""
      ).trim();

      if (!branchName) {
        return;
      }

      counts[branchName] = 0;
    });

    // Count visits after date and staff filtering.
    filteredPlans.forEach((plan) => {
      const branchName = String(
        plan.branch_name || ""
      ).trim();

      if (!branchName) {
        return;
      }

      if (
        Object.prototype.hasOwnProperty.call(
          counts,
          branchName
        )
      ) {
        counts[branchName] += 1;
      }
    });

    return Object.entries(counts)
      .map(([branch, count]) => ({
        branch,
        count,
      }))
      .sort((a, b) => {
        if (b.count !== a.count) {
          return b.count - a.count;
        }

        return a.branch.localeCompare(
          b.branch
        );
      });
  }, [
    plans,
    branchRows,
    visitRange,
    month,
    year,
    branchStaffFilter,
  ]);

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

  const fetchInvolvedStaffDropdown = async () => {
    try {
      const res = await api.get(
        "/travel-plans/involved-staff-dropdown"
      );

      setInvolvedStaffDropdownRows(
        Array.isArray(res.data)
          ? res.data
          : []
      );
    } catch (err) {
      console.error(
        "Fetch involved staff dropdown error:",
        err
      );

      setInvolvedStaffDropdownRows([]);
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
    fetchStaffDropdown();
    fetchInvolvedStaffDropdown();
    fetchScopedBranches();
    fetchPlans();
  }, []);

  useEffect(() => {
   fetchScopedStaff();
  }, [staffScopeDate]);

  const saveTravelPlan = async () => {
    if (!planForm.title.trim()) {
      alert("Title is required.");
      return;
    }

    if (!planForm.plan_date) {
      alert("Travel plan date is required.");
      return;
    }

    if (!planForm.employee_name.trim()) {
      alert("Employee is required.");
      return;
    }

    if (!planForm.branch_name.trim()) {
      alert("Branch is required.");
      return;
    }

    try {
      await api.post("/travel-plans", planForm);

      setShowCreatePlan(false);
      setPlanForm(emptyPlanForm);

      await Promise.all([
        fetchPlans(),
        fetchScopedStaff(),
      ]);
    } catch (err) {
      console.error("Save plan error:", err);
      alert(err.response?.data?.message || "Failed to save plan.");
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

      await Promise.all([
        fetchPlans(),
        fetchScopedStaff(),
      ]);

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
    setDetailTab("checkin");
    setShowNoteForm(false);
    setNoteForm(emptyNoteForm);

    setEditingNoteId(null);
    setEditingNoteType(null);
    setFindingPhoto(null);
    setReviewPhoto(null);

    fetchPlanPhotos(plan.id);
    fetchPlanNotes(plan.id);
  };

  const closePlan = () => {
    setSelectedPlan(null);
    setPlanPhotos([]);
    setPlanNotes([]);
    setShowNoteForm(false);
    setNoteForm(emptyNoteForm);

    setEditingNoteId(null);
    setEditingNoteType(null);

    setFindingPhoto(null);
    setReviewPhoto(null);
  };

  const createNote = async (type) => {
    if (!selectedPlan?.id) return;

    if (type === "REVIEW") {
      const hasReviewFinding =
        noteForm.review_coh.trim() ||
        noteForm.review_cashbook_vs_voucher.trim() ||
        noteForm.review_bms.trim() ||
        noteForm.review_other_findings.trim();

      if (!hasReviewFinding) {
        alert(
          "Enter at least one Branch Visit Finding."
        );
        return;
      }

      if (
        noteForm.involved_staff_ids.length === 0
      ) {
        alert(
          "Select at least one involved staff member."
        );
        return;
      }

      if (
        !editingNoteId &&
        !reviewPhoto
      ) {
        alert(
          "Upload a Branch Visit Findings photo."
        );
        return;
      }
    }

    if (type === "FINDINGS") {
      const hasFinding =
        noteForm.passbook_reconciliation.trim() ||
        noteForm.past_due_delinquent_report.trim() ||
        noteForm.group_collection_record.trim() ||
        noteForm.other_findings.trim();

      if (!hasFinding) {
        alert(
          "Enter at least one Group Visit Finding."
        );
        return;
      }
    }

    if (
      type === "FINDINGS" &&
      !editingNoteId &&
      !findingPhoto
    ) {
      alert(
        "Upload a Group Visit Findings photo."
      );
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

    if (
      type === "FINDINGS" &&
      !noteForm.due_date
    ) {
      alert(
        "Select a compliance due date."
      );

      return;
    }

    try {
      const formData = new FormData();

      formData.append("note_type", type);

      formData.append(
        "title",
        type === "FINDINGS"
          ? "Group Visit Findings"
          : "Branch Visit Findings"
      );

      formData.append(
        "review_coh",
        type === "REVIEW"
          ? noteForm.review_coh.trim()
          : ""
      );

      formData.append(
        "review_cashbook_vs_voucher",
        type === "REVIEW"
          ? noteForm.review_cashbook_vs_voucher.trim()
          : ""
      );

      formData.append(
        "review_lor",
        noteForm.review_lor || ""
      );

      formData.append(
        "review_los",
        noteForm.review_los || ""
      );

      formData.append(
        "review_ldf",
        noteForm.review_ldf || ""
      );

      formData.append(
        "review_dcs",
        noteForm.review_dcs || ""
      );

      formData.append(
        "review_bms",
        type === "REVIEW"
          ? noteForm.review_bms.trim()
          : ""
      );

      formData.append(
        "review_other_findings",
        type === "REVIEW"
          ? noteForm.review_other_findings.trim()
          : ""
      );

      formData.append(
        "passbook_reconciliation",
        type === "FINDINGS"
          ? noteForm.passbook_reconciliation.trim()
          : ""
      );

      formData.append(
        "past_due_delinquent_report",
        type === "FINDINGS"
          ? noteForm.past_due_delinquent_report.trim()
          : ""
      );

      formData.append(
        "group_collection_record",
        type === "FINDINGS"
          ? noteForm.group_collection_record.trim()
          : ""
      );

      formData.append(
        "other_findings",
        type === "FINDINGS"
          ? noteForm.other_findings.trim()
          : ""
      );

      formData.append(
        "involved_staff",
        noteForm.involved_staff.join(", ")
      );

      formData.append(
        "involved_staff_ids",
        JSON.stringify(
          noteForm.involved_staff_ids
        )
      );

      formData.append(
        "due_date",
        type === "FINDINGS"
          ? noteForm.due_date || ""
          : ""
      );

      formData.append(
        "content",
        ""
      );

      if (
        type === "FINDINGS" &&
        findingPhoto
      ) {
        formData.append(
          "photos",
          findingPhoto
        );
      }

      if (
        type === "REVIEW" &&
        reviewPhoto
      ) {
        formData.append(
          "photos",
          reviewPhoto
        );
      }

      if (
        editingNoteId &&
        editingNoteType === type
      ) {
        await api.put(
          `/travel-plans/notes/${editingNoteId}`,
          formData,
          {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          }
        );
      } else {
        await api.post(
          `/travel-plans/${selectedPlan.id}/notes`,
          formData,
          {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          }
        );
      }

      setNoteForm(emptyNoteForm);

      setEditingNoteId(null);
      setEditingNoteType(null);

      setFindingPhoto(null);
      setReviewPhoto(null);

      setShowNoteForm(false);

      fetchPlanNotes(selectedPlan.id);
    } catch (err) {
      console.error("Create note error:", err);
      alert(err.response?.data?.message || "Failed to save.");
    }
  };

  const openEditNote = (note) => {
    if (!note?.id) {
      return;
    }

    const noteType =
      String(note.note_type || "")
        .trim()
        .toUpperCase();

    const selectedNames = String(
      note.involved_staff || ""
    )
      .split(", ")
      .map((name) => name.trim())
      .filter(Boolean);

    const selectedStaff = involvedStaffOptions.filter(
      (option) =>
        selectedNames.some(
          (name) =>
            normalizeValue(name) ===
            normalizeValue(option.employee_name)
        )
    );

    setEditingNoteId(note.id);
    setEditingNoteType(noteType);

    setNoteForm({
      ...emptyNoteForm,

      title:
        noteType === "FINDINGS"
          ? "Group Visit Findings"
          : "Branch Visit Findings",

      review_coh:
        note.review_coh || "",

      review_cashbook_vs_voucher:
        note.review_cashbook_vs_voucher || "",

      review_bms:
        note.review_bms || "",

      review_other_findings:
        note.review_other_findings || "",

      passbook_reconciliation:
        note.passbook_reconciliation || "",

      past_due_delinquent_report:
        note.past_due_delinquent_report || "",

      group_collection_record:
        note.group_collection_record || "",

      other_findings:
        note.other_findings || "",

      involved_staff:
        selectedStaff.map(
          (option) => option.employee_name
        ),

      involved_staff_ids:
        selectedStaff.map(
          (option) => Number(option.value)
        ),

      due_date:
        note.due_date || "",

      content:
        note.content || "",
    });

    setFindingPhoto(null);
    setReviewPhoto(null);

    setShowNoteForm(true);
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
    <PhotoGrid
      type={type}
      planPhotos={planPhotos}
      selectedPlan={selectedPlan}
      formatTime={formatTime}
      setPreviewPhoto={setPreviewPhoto}
      deletePlanPhoto={deletePlanPhoto}
    />
  );

  const renderNotes = (type) => (
    <TravelPlanNote
      type={type}
      planNotes={planNotes}
      selectedPlan={selectedPlan}
      formatTime={formatTime}
      openEditNote={openEditNote}
      deleteNote={deleteNote}
      setPreviewPhoto={setPreviewPhoto}
    />
  );

  const renderNoteTab = (type) => (
    <TravelPlanNoteTab
      type={type}

      selectedPlan={selectedPlan}

      showNoteForm={showNoteForm}
      setShowNoteForm={setShowNoteForm}

      noteForm={noteForm}
      setNoteForm={setNoteForm}
      emptyNoteForm={emptyNoteForm}

      editingNoteId={editingNoteId}
      setEditingNoteId={setEditingNoteId}

      editingNoteType={editingNoteType}
      setEditingNoteType={
        setEditingNoteType
      }

      findingPhoto={findingPhoto}
      setFindingPhoto={setFindingPhoto}

      reviewPhoto={reviewPhoto}
      setReviewPhoto={setReviewPhoto}

      involvedStaffOptions={
        involvedStaffOptions
      }

      createNote={createNote}
      renderNotes={renderNotes}
    />
  );

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

  return (
    <div className="travel-modern-page">
      <div className="travel-modern-layout">
        <main className="travel-calendar-main">
          <TravelTopbar
            month={month}
            year={year}
            today={today}
            MONTHS={MONTHS}
            setMonth={setMonth}
            setYear={setYear}
            onCreatePlan={() => {
              setPlanForm(emptyPlanForm);
              setShowCreatePlan(true);
            }}
        />

            <TravelDashboard
              DAYS={DAYS}
              calendarDays={calendarDays}

              year={year}
              month={month}

              planForm={planForm}
              emptyPlanForm={emptyPlanForm}
              setPlanForm={setPlanForm}
              setShowCreatePlan={setShowCreatePlan}

              branchStaffOptions={branchStaffOptions}
              branchStaffFilter={branchStaffFilter}
              setBranchStaffFilter={
                setBranchStaffFilter
              }

              branchDivisionFilter={
                branchDivisionFilter
              }
              setBranchDivisionFilter={
                setBranchDivisionFilter
              }
              divisionOptions={divisionOptions}

              branchRegionFilter={
                branchRegionFilter
              }
              setBranchRegionFilter={
                setBranchRegionFilter
              }
              regionOptions={regionOptions}

              branchAreaFilter={branchAreaFilter}
              setBranchAreaFilter={
                setBranchAreaFilter
              }
              areaOptions={areaOptions}

              visitRange={visitRange}
              setVisitRange={setVisitRange}

              filteredMostVisitedBranches={
                filteredMostVisitedBranches
              }
              selectedBranchVisit={
                selectedBranchVisit
              }
              setSelectedBranchVisit={
                setSelectedBranchVisit
              }

              maxBranchVisits={maxBranchVisits}
            />
            
            <StaffScope
              staffSearch={staffSearch}
              setStaffSearch={setStaffSearch}

              staffScopeDate={staffScopeDate}
              setStaffScopeDate={setStaffScopeDate}

              staffPositionFilter={staffPositionFilter}
              setStaffPositionFilter={setStaffPositionFilter}
              staffPositionOptions={staffPositionOptions}

              staffDepartmentFilter={staffDepartmentFilter}
              setStaffDepartmentFilter={
                setStaffDepartmentFilter
              }
              staffDepartmentOptions={
                staffDepartmentOptions
              }

              staffCounts={staffCounts}
              filteredStaffRows={filteredStaffRows}

              setSelectedStaffScope={
                setSelectedStaffScope
              }
              setStaffPlanSearch={setStaffPlanSearch}
              setStaffPlanDateFilter={
                setStaffPlanDateFilter
              }
            />

            <CreateTravelPlanModal
              showCreatePlan={showCreatePlan}
              setShowCreatePlan={setShowCreatePlan}
              planForm={planForm}
              setPlanForm={setPlanForm}
              staffOptions={staffOptions}
              branchRows={branchRows}
              saveTravelPlan={saveTravelPlan}
            />

            <TravelPlanDetailsModal
              selectedPlan={selectedPlan}
              closePlan={closePlan}

              detailTab={detailTab}
              setDetailTab={setDetailTab}

              setShowNoteForm={setShowNoteForm}

              normalizeValue={normalizeValue}

              formatTime={formatTime}
              getFirstPhotoTime={getFirstPhotoTime}
              getTravelDuration={getTravelDuration}

              setSelectedPlan={setSelectedPlan}

              uploadPlanPhotos={uploadPlanPhotos}

              renderPhotoGrid={renderPhotoGrid}
              renderNoteTab={renderNoteTab}

              updateTravelPlan={updateTravelPlan}
              submitPlan={submitPlan}

              canDeleteTravelPlans={canDeleteTravelPlans}
              deleteTravelPlan={deleteTravelPlan}
            />

            <StaffScopePlansModal
              selectedStaffScope={selectedStaffScope}
              setSelectedStaffScope={setSelectedStaffScope}
              staffPlanSearch={staffPlanSearch}
              setStaffPlanSearch={setStaffPlanSearch}
              staffPlanDateFilter={staffPlanDateFilter}
              setStaffPlanDateFilter={setStaffPlanDateFilter}
              selectedStaffPlans={selectedStaffPlans}
              normalizeValue={normalizeValue}
              openPlan={openPlan}
              canDeleteTravelPlans={canDeleteTravelPlans}
              deleteTravelPlan={deleteTravelPlan}
            />

            <BranchVisitPlansModal
              selectedBranchVisit={selectedBranchVisit}
              setSelectedBranchVisit={setSelectedBranchVisit}
              selectedBranchPlans={selectedBranchPlans}
              normalizeValue={normalizeValue}
              openPlan={openPlan}
            />

        </main>
      </div>
    </div>
  );
}