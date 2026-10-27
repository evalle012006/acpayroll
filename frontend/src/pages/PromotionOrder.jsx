import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/PromotionOrder.css";
import api from "../api/axiosClient";

const toNum = (v) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const money = (v) => {
  const n = toNum(v);
  return n ? n.toLocaleString() : "0";
};

const toStr = (v) => String(v ?? "").trim();
const norm = (v) => toStr(v).toLowerCase();

const readUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
};

const fmtDate = (d) => (d ? String(d).slice(0, 10) : "-");

const fmtDateTime = (value) => {
  if (!value) return "-";

  const d = new Date(value);

  if (Number.isNaN(d.getTime())) {
    return String(value);
  }

  return d.toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const OPERATION_DEPTS = [
  "operation",
  "operations",
  "payroll",
  "operation department",
  "operations department",
];

const isOperationDepartment = (dept) => OPERATION_DEPTS.includes(norm(dept));

const STAGE_LABELS = {
  "branch manager": "Branch Manager",
  "area manager": "Area Manager",
  "regional manager": "Regional Manager",
  "assistant vice president": "Assistant Vice President",
  "vice president": "Vice President",
  "senior vice president": "Senior Vice President",
  tread: "TREAD Department",

  "admin order": "HR Department",
  "contract signing": "AVP / Upload Signed Contract by the Staff",
  "hr final": "Waiting for HR to Receive",

  approved: "Approved",
  rejected: "Rejected",
  voided: "Voided",
};

const getDepartment = (o) =>
  o?.department ||
  o?.staff_department ||
  o?.promoted_staff_department ||
  o?.employee_department ||
  "";

const normalizePosition = (position) =>
  norm(position)
    .replace(/^acting\s+/i, "")
    .replace(/\(acting\)/gi, "")
    .replace(/acting/gi, "")
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const getBaseChainByPosition = (position) => {
  const pos = normalizePosition(position);

  // SVP applicant:
  // no management approval before document processing
  if (pos.includes("senior vice president")) {
    return [];
  }

  // VP applicant -> SVP
  if (pos.includes("vice president")) {
    return [
      "senior vice president",
    ];
  }

  // AVP applicant -> VP -> SVP
  if (pos.includes("assistant vice president")) {
    return [
      "vice president",
      "senior vice president",
    ];
  }

  // RM applicant -> AVP -> VP
  if (pos.includes("regional manager")) {
    return [
      "assistant vice president",
      "vice president",
    ];
  }

  // AM applicant -> RM -> AVP -> VP
  if (pos.includes("area manager")) {
    return [
      "regional manager",
      "assistant vice president",
      "vice president",
    ];
  }

  // BM applicant -> AM -> RM -> AVP -> VP
  if (pos.includes("branch manager")) {
    return [
      "area manager",
      "regional manager",
      "assistant vice president",
      "vice president",
    ];
  }

  // LO / staff / other position
  return [
    "branch manager",
    "area manager",
    "regional manager",
    "assistant vice president",
    "vice president",
  ];
};

const getApprovalChain = (department, oldPosition) => {
  const baseChain = getBaseChainByPosition(oldPosition);

  // OPERATION:
  // management approval -> TREAD -> Admin Order
  // -> Contract Signing -> HR Final
  if (isOperationDepartment(department)) {
    return [
      ...baseChain,
      "tread",
      "admin order",
      "contract signing",
      "hr final",
    ];
  }

  // OTHER DEPARTMENTS:
  // management approval -> Admin Order
  // -> Contract Signing -> HR Final
  return [
    ...baseChain,
    "admin order",
    "contract signing",
    "hr final",
  ];
};

const getCurrentStageLabel = (o) => {
  const status = norm(o?.status);
  if (status === "approved") return "Approved";
  if (status === "rejected") return "Rejected";
  if (status === "voided") return "Voided";

  const stage = norm(o?.approval_stage);
  return STAGE_LABELS[stage] || "-";
};

const stageStatus = (o, stage) => {
  const map = {
    "branch manager": o?.branch_manager_status,
    "area manager": o?.area_manager_status,
    "regional manager": o?.regional_manager_status,
    "assistant vice president": o?.assistant_vice_president_status,
    "vice president": o?.vice_president_status,
    "senior vice president": o?.senior_vice_president_status,
    tread: o?.tread_status,

    "admin order": o?.admin_order_status,
    "contract signing": o?.contract_signing_status,
    "hr final": o?.hr_final_status,
  };

  return toStr(map[stage] || "Pending");
};

const getApprovalHistory = (o) => {
  if (!o) return [];

  const rows = [
    {
      key: "branch_manager",
      stage: "branch manager",
      label: "Branch Manager",
      status: o.branch_manager_status,
      approvedBy: o.branch_manager_approved_by_name,
      approvedAt: o.branch_manager_approved_at,
    },
    {
      key: "area_manager",
      stage: "area manager",
      label: "Area Manager",
      status: o.area_manager_status,
      approvedBy: o.area_manager_approved_by_name,
      approvedAt: o.area_manager_approved_at,
    },
    {
      key: "regional_manager",
      stage: "regional manager",
      label: "Regional Manager",
      status: o.regional_manager_status,
      approvedBy: o.regional_manager_approved_by_name,
      approvedAt: o.regional_manager_approved_at,
    },
    {
      key: "assistant_vice_president",
      stage: "assistant vice president",
      label: "Assistant Vice President",
      status: o.assistant_vice_president_status,
      approvedBy: o.assistant_vice_president_approved_by_name,
      approvedAt: o.assistant_vice_president_approved_at,
    },
    {
      key: "vice_president",
      stage: "vice president",
      label: "Vice President",
      status: o.vice_president_status,
      approvedBy: o.vice_president_approved_by_name,
      approvedAt: o.vice_president_approved_at,
    },
    {
      key: "senior_vice_president",
      stage: "senior vice president",
      label: "Senior Vice President",
      status: o.senior_vice_president_status,
      approvedBy: o.senior_vice_president_approved_by_name,
      approvedAt: o.senior_vice_president_approved_at,
    },
    {
      key: "tread",
      stage: "tread",
      label: "TREAD Department",
      status: o.tread_status,
      approvedBy: o.tread_approved_by_name,
      approvedAt: o.tread_approved_at,
    },
    {
      key: "admin_order",
      stage: "admin order",
      label: "Admin Order",
      status: o.admin_order_status,
      approvedBy: o.admin_order_approved_by_name,
      approvedAt: o.admin_order_approved_at,
    },
    {
      key: "contract_signing",
      stage: "contract signing",
      label: "Contract Signing",
      status: o.contract_signing_status,
      approvedBy: o.contract_signing_approved_by_name,
      approvedAt: o.contract_signing_approved_at,
    },
    {
      key: "hr_final",
      stage: "hr final",
      label: "HR Received",
      status: o.hr_final_status,
      approvedBy: o.hr_final_approved_by_name,
      approvedAt: o.hr_final_approved_at,
    },
  ];

  const chain = getApprovalChain(
    getDepartment(o),
    o?.old_position
  );

  return rows.filter((row) =>
    chain.includes(row.stage)
  );
};

const renderRecommendationFlow = (o) =>
  getApprovalChain(getDepartment(o), o?.old_position)
    .map((s) => `${STAGE_LABELS[s] || s}: ${stageStatus(o, s)}`)
    .join(" → ");

export default function PromotionOrder() {
  const navigate = useNavigate();
  const user = useMemo(() => readUser(), []);
  const role = norm(user?.role);

  const department = norm(
    user?.department ||
      user?.department_name ||
      user?.user_department ||
      user?.departmentName ||
      user?.dept
  );

  const userBranchId = String(
    user?.branch_id ?? ""
  ).trim();

  const userArea = norm(user?.area);
  const userRegion = norm(user?.region);
  const userDivision = norm(user?.division);

  const loggedInOperationUser =
    isOperationDepartment(department);

  const isAdmin = role === "admin";
  
  const isIt =
    role === "it" ||
    department === "it" ||
    department === "it department";
    
  const isHr =
    role === "hr" ||
    department === "hr" ||
    department === "hr department" ||
    department === "human resources" ||
    department === "human resources department";
  
  const isAccounting =
    role === "accounting" ||
    department === "accounting" ||
    department === "accounting department";

  const canEditPromotion =
    isAdmin ||
    isIt ||
    isHr ||
    isAccounting;

  const isTread =
    role === "tread" ||
    department === "tread" ||
    department === "tread department" ||
    department === "treadt department";
  const isBranchManager = role === "branch manager";
  const isAreaManager = role === "area manager";
  const isRegionalManager = role === "regional manager";
  const isAssistantVicePresident = role === "assistant vice president";
  const isVicePresident = role === "vice president";
  const isSeniorVicePresident = role === "senior vice president";
  const isPresident = role === "president";

  const canCreatePromotion =
    isAdmin ||
    isIt ||
    isHr ||
    isAccounting ||
    isBranchManager ||
    isAreaManager ||
    isRegionalManager ||
    isAssistantVicePresident ||
    isVicePresident ||
    isSeniorVicePresident ||
    isPresident;

  const canApproveStage = (o) => {
    if (!o || norm(o.status) !== "pending") return false;

    const stage = norm(o.approval_stage);

    if (isAdmin || isSeniorVicePresident || isHr || isAccounting)
      {
        return true;
      }

    if (stage === "branch manager") return isBranchManager;
    if (stage === "area manager") return isAreaManager;
    if (stage === "regional manager") return isRegionalManager;
    if (stage === "assistant vice president") return isAssistantVicePresident;
    if (stage === "vice president") return isVicePresident;
    if (stage === "senior vice president") return isSeniorVicePresident;
    if (stage === "tread") return isTread;
    if (stage === "admin order") return isHr;
    if (stage === "contract signing") return isAssistantVicePresident;
    if (stage === "hr final") return isHr;

    return false;
  };

  const [staff, setStaff] = useState([]);
  const [branches, setBranches] = useState([]);
  const [orders, setOrders] = useState([]);
  const [positionRates, setPositionRates] = useState([]);

  const [orderSearch, setOrderSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [loadingStaff, setLoadingStaff] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingRates, setLoadingRates] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingId, setUploadingId] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);

  const [approvalFiles, setApprovalFiles] = useState({});
  const [viewOrder, setViewOrder] = useState(null);

  const [form, setForm] = useState({
    employee_id: "",
    employee_name: "",
    department: "",
    old_position: "",
    new_position: "",
    old_salary: "",
    new_salary: "",
    old_ecola: "",
    new_ecola: "",
    effective_date: "",
    remarks: "",
    prev_branch_id: "",
    prev_branch_code: "",
    prev_branch_name: "",
    present_branch_id: "",
    present_branch_code: "",
    present_branch_name: "",
  });

  const [employeeSearch, setEmployeeSearch] = useState("");
  const [employeeQuery, setEmployeeQuery] = useState("");
  const [showEmployeeResults, setShowEmployeeResults] = useState(false);
  const [attachmentFile, setAttachmentFile] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  const [branchSearch, setBranchSearch] = useState("");
  const [showBranchResults, setShowBranchResults] = useState(false);

  const employeePickerRef = useRef(null);
  const branchPickerRef = useRef(null);

  const branchMap = useMemo(() => {
    const m = new Map();
    branches.forEach((b) => m.set(Number(b.id), b));
    return m;
  }, [branches]);

  const rateMap = useMemo(() => {
    const m = new Map();
    positionRates.forEach((r) => {
      const key = norm(r.position);
      if (key) m.set(key, r);
    });
    return m;
  }, [positionRates]);

  const positionOptions = useMemo(() => {
    const seen = new Set();

    return positionRates
      .filter((r) => {
        const key = norm(r.position);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => toStr(a.position).localeCompare(toStr(b.position)));
  }, [positionRates]);

  const scopedStaff = useMemo(() => {
    if (!Array.isArray(staff)) {
      return [];
    }

    /*
      Do not change HR, IT, Accounting,
      TREAD, Audit or other department access.
    */
    if (!loggedInOperationUser) {
      return staff;
    }

    return staff.filter((employee) => {
      const employeeDepartment = norm(
        employee?.department ||
          employee?.department_name
      );

      if (
        !isOperationDepartment(
          employeeDepartment
        )
      ) {
        return false;
      }

      if (isBranchManager) {
        return (
          String(
            employee?.branch_id ?? ""
          ).trim() === userBranchId
        );
      }

      if (isAreaManager) {
        return (
          norm(employee?.area) === userArea
        );
      }

      if (isRegionalManager) {
        return (
          norm(employee?.region) ===
          userRegion
        );
      }

      if (isAssistantVicePresident) {
        return (
          norm(employee?.division) ===
          userDivision
        );
      }

      if (
        isVicePresident ||
        isSeniorVicePresident
      ) {
        return true;
      }

      return false;
    });
  }, [
    staff,
    loggedInOperationUser,
    isBranchManager,
    isAreaManager,
    isRegionalManager,
    isAssistantVicePresident,
    isVicePresident,
    isSeniorVicePresident,
    userBranchId,
    userArea,
    userRegion,
    userDivision,
  ]);

  const filteredStaff = useMemo(() => {
    const q = norm(employeeQuery);

    const list = !q
      ? scopedStaff
      : scopedStaff.filter((s) => {
          const hay = [
            s.id,
            s.employee_no,
            s.fullname,
            s.first_name,
            s.last_name,
            s.middle_name,
            s.position,
            s.department,
            s.department_name,
            s.branch_id,
            s.area,
            s.region,
            s.division,
          ]
            .map(norm)
            .join(" ");

          return hay.includes(q);
        });

    return list.slice(0, 50);
  }, [scopedStaff, employeeQuery]);

  const filteredBranches = useMemo(() => {
    const q = norm(branchSearch);

    const list = !q
      ? branches
      : branches.filter((b) => {
          const hay = [b.id, b.code, b.name, b.area, b.region, b.division]
            .map(norm)
            .join(" ");

          return hay.includes(q);
        });

    return list.sort((a, b) =>
      `${a.code || ""} ${a.name || ""}`.localeCompare(`${b.code || ""} ${b.name || ""}`)
    );
  }, [branches, branchSearch]);

  const resetForm = () => {
    setForm({
      employee_id: "",
      employee_name: "",
      department: "",
      old_position: "",
      new_position: "",
      old_salary: "",
      new_salary: "",
      old_ecola: "",
      new_ecola: "",
      effective_date: "",
      remarks: "",
      prev_branch_id: "",
      prev_branch_code: "",
      prev_branch_name: "",
      present_branch_id: "",
      present_branch_code: "",
      present_branch_name: "",
    });
  };

  const openEditPromotion = (order) => {
  if (!order?.id) return;

  if (norm(order.status) !== "pending") {
    alert("Only pending promotion orders can be edited.");
    return;
  }

  if (!canEditPromotion) {
    alert(
      "Only Admin, IT Department, HR Department, and Accounting Department can edit."
    );
    return;
  }

  const employee =
    staff.find(
      (s) =>
        Number(s.id) === Number(order.employee_id)
    ) || null;

  const presentBranch =
    order.present_branch_id
      ? branchMap.get(
          Number(order.present_branch_id)
        )
      : null;

  setEditingOrder(order);
  setSelectedEmployee(employee);

  setForm({
    employee_id: String(order.employee_id || ""),

    employee_name:
      order.employee_name ||
      employee?.fullname ||
      "",

    department:
      getDepartment(order) ||
      employee?.department ||
      "",

    old_position:
      order.old_position || "",

    new_position:
      order.new_position || "",

    old_salary:
      String(toNum(order.old_salary)),

    new_salary:
      String(toNum(order.new_salary)),

    old_ecola:
      String(toNum(order.old_ecola)),

    new_ecola:
      String(toNum(order.new_ecola)),

    effective_date:
      fmtDate(order.effective_date) === "-"
        ? ""
        : fmtDate(order.effective_date),

    remarks:
      order.details ||
      order.remarks ||
      "",

    prev_branch_id:
      String(order.prev_branch_id || ""),

    prev_branch_code:
      order.prev_branch_code || "",

    prev_branch_name:
      order.prev_branch_name || "",

    present_branch_id:
      String(order.present_branch_id || ""),

    present_branch_code:
      order.present_branch_code || "",

    present_branch_name:
      order.present_branch_name || "",
  });

  setEmployeeSearch(
    employee
      ? `${employee.employee_no ? `${employee.employee_no} - ` : ""}${
          employee.fullname || ""
        }`
      : order.employee_name || ""
  );

  setEmployeeQuery(
    employee
      ? `${employee.employee_no ? `${employee.employee_no} - ` : ""}${
          employee.fullname || ""
        }`
      : order.employee_name || ""
  );

  setBranchSearch(
    presentBranch
      ? `${presentBranch.code || ""} - ${
          presentBranch.name || ""
        }`
      : `${order.present_branch_code || ""} - ${
          order.present_branch_name || ""
        }`
  );

  // Existing attachment remains unless user chooses another file
  setAttachmentFile(null);

  setViewOrder(null);
  setShowCreate(true);
};

  const closeModal = () => {
    setShowCreate(false);
    setEditingOrder(null);

    resetForm();

    setEmployeeSearch("");
    setEmployeeQuery("");
    setBranchSearch("");

    setSelectedEmployee(null);

    setShowEmployeeResults(false);
    setShowBranchResults(false);

    setAttachmentFile(null);
  };

  const loadStaff = useCallback(async () => {
    try {
      setLoadingStaff(true);
      const res = await api.get("/staff");
      setStaff(Array.isArray(res.data) ? res.data : []);
    } catch {
      setStaff([]);
    } finally {
      setLoadingStaff(false);
    }
  }, []);

  const loadBranches = useCallback(async () => {
    try {
      setLoadingBranches(true);
      const res = await api.get("/branches-all");
      setBranches(Array.isArray(res.data) ? res.data : []);
    } catch {
      setBranches([]);
    } finally {
      setLoadingBranches(false);
    }
  }, []);

  const loadOrders = useCallback(async () => {
    try {
      setLoadingOrders(true);
      const res = await api.get("/promotion-orders");
      setOrders(Array.isArray(res.data) ? res.data : []);
    } catch {
      setOrders([]);
    } finally {
      setLoadingOrders(false);
    }
  }, []);

  const loadRates = useCallback(async () => {
    try {
      setLoadingRates(true);
      const res = await api.get("/comp-rates");
      setPositionRates(Array.isArray(res.data) ? res.data : []);
    } catch {
      setPositionRates([]);
    } finally {
      setLoadingRates(false);
    }
  }, []);

  useEffect(() => {
    loadStaff();
    loadBranches();
    loadOrders();
    loadRates();
  }, [loadStaff, loadBranches, loadOrders, loadRates]);

  useEffect(() => {
    if (!showCreate) return;

    const onKey = (e) => e.key === "Escape" && closeModal();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [showCreate]);

  useEffect(() => {
    const onMouseDown = (e) => {
      if (employeePickerRef.current && !employeePickerRef.current.contains(e.target)) {
        setShowEmployeeResults(false);
      }

      if (branchPickerRef.current && !branchPickerRef.current.contains(e.target)) {
        setShowBranchResults(false);
      }
    };

    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  const onSelectEmployee = (employeeId) => {
    const s = staff.find((x) => String(x.id) === String(employeeId));
    if (!s) return;

    const prevBranchId = s?.branch_id ? Number(s.branch_id) : null;
    const prevBranch = prevBranchId ? branchMap.get(prevBranchId) : null;

    setSelectedEmployee(s);

    setForm((p) => ({
      ...p,
      employee_id: String(s.id),
      employee_name: s?.fullname || "",
      department: s?.department || s?.department_name || "",
      old_position: s?.position || "",
      new_position: "",
      old_salary: String(toNum(s?.salary)),
      new_salary: "",
      old_ecola: String(toNum(s?.ecola)),
      new_ecola: "",
      prev_branch_id: prevBranchId ? String(prevBranchId) : "",
      prev_branch_code: prevBranch?.code || "",
      prev_branch_name: prevBranch?.name || "",
      present_branch_id: prevBranchId ? String(prevBranchId) : "",
      present_branch_code: prevBranch?.code || "",
      present_branch_name: prevBranch?.name || "",
    }));

    const label = `${s.employee_no ? `${s.employee_no} - ` : ""}${s.fullname || ""}`;
    setEmployeeSearch(label);
    setEmployeeQuery(label);

    setBranchSearch(
      prevBranch ? `${prevBranch.code || ""} - ${prevBranch.name || ""}`.trim() : ""
    );

    setShowEmployeeResults(false);
  };

  const onSelectPresentBranch = (branchId) => {
    const bid = branchId ? Number(branchId) : null;
    const b = bid ? branchMap.get(bid) : null;

    setForm((p) => ({
      ...p,
      present_branch_id: branchId ? String(branchId) : "",
      present_branch_code: b?.code || "",
      present_branch_name: b?.name || "",
    }));

    setBranchSearch(b ? `${b.code || ""} - ${b.name || ""}`.trim() : "");
    setShowBranchResults(false);
  };

  const onSelectNewPosition = (positionValue) => {
    const picked = toStr(positionValue);
    const rate = rateMap.get(norm(picked));

    setForm((p) => ({
      ...p,
      new_position: picked,
      new_salary: rate ? String(toNum(rate.salary)) : "",
      new_ecola: rate ? String(toNum(rate.ecola)) : "",
    }));
  };

  const createOrder = async (e) => {
    e.preventDefault();

    if (!selectedEmployee || !form.employee_id) return alert("Employee is required");
    if (!form.department.trim()) return alert("Employee department is required.");
    if (!form.new_position.trim()) return alert("New position is required.");
    if (!form.effective_date.trim()) return alert("Effective date is required.");
    if (!form.present_branch_id.trim()) return alert("Present branch is required.");
    if (!editingOrder && !attachmentFile) {
      return alert("Promotion request file is required.");
    }

    try {
      setSaving(true);

      const formData = new FormData();
      formData.append("employee_id", parseInt(String(selectedEmployee.id), 10));
      formData.append("employee_name", form.employee_name.trim());
      formData.append("department", form.department.trim());
      formData.append("old_position", form.old_position.trim());
      formData.append("new_position", form.new_position.trim());
      formData.append("old_salary", toNum(form.old_salary));
      formData.append("new_salary", toNum(form.new_salary));
      formData.append("old_ecola", toNum(form.old_ecola));
      formData.append("new_ecola", toNum(form.new_ecola));
      formData.append("effective_date", form.effective_date.slice(0, 10));
      formData.append("remarks", form.remarks.trim());
      formData.append("prev_branch_id", form.prev_branch_id ? Number(form.prev_branch_id) : "");
      formData.append("prev_branch_code", form.prev_branch_code);
      formData.append("prev_branch_name", form.prev_branch_name);
      formData.append("present_branch_id", form.present_branch_id ? Number(form.present_branch_id) : "");
      formData.append("present_branch_code", form.present_branch_code);
      formData.append("present_branch_name", form.present_branch_name);
      if (attachmentFile) {
        formData.append("attachment", attachmentFile);
      }

      if (editingOrder?.id) {
        await api.put(
          `/promotion-orders/${editingOrder.id}`,
          formData,
          {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          }
        );

        alert("Promotion recommendation updated.");
      } else {
        await api.post(
          "/promotion-orders",
          formData,
          {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          }
        );

        alert("Promotion recommendation created.");
      }
      closeModal();
      await loadOrders();
    } catch (err) {
      alert(err?.response?.data?.message || err.message || "Failed to create promotion recommendation.");
    } finally {
      setSaving(false);
    }
  };

  const downloadFile = async (id, type = "latest", fallbackName = "") => {
    try {
      const res = await api.get(`/promotion-orders/${id}/download/${type}`, {
        responseType: "blob",
      });

      const blob = new Blob([res.data]);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");

      a.href = url;
      a.download = fallbackName || `promotion-${id}-${type}`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to download file.");
    }
  };

  const approve = async (order) => {
    const file = approvalFiles[order.id];
    const stage = norm(order.approval_stage);

    const fileRequiredStages = [
      "branch manager",
      "area manager",
      "regional manager",
      "assistant vice president",
      "vice president",
      "senior vice president",
      "tread",
      "admin order",
      "contract signing",
    ];

    if (fileRequiredStages.includes(stage) && !file) {
      let message = "Please upload the required promotion file before approving.";

      if (stage === "admin order") {
        message = "HR Department must upload the Admin Order before approving.";
      } else if (stage === "contract signing") {
        message = "AVP must upload the Receiving Copy before approving.";
      }

      alert(message);
      return;
    }

    try {
      setUploadingId(String(order.id));

      const formData = new FormData();

      if (file) {
        formData.append("attachment", file);
      }

      await api.put(`/promotion-orders/${order.id}/approve`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setApprovalFiles((prev) => {
        const copy = { ...prev };
        delete copy[order.id];
        return copy;
      });

      await loadOrders();
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to approve.");
    } finally {
      setUploadingId("");
    }
  };

 const canPowerAction = isAdmin;
    
  const voidPromotion = async (id) => {
    if (!window.confirm("Void this approved promotion? Staff will be reverted.")) return;

    try {
      await api.put(`/promotion-orders/${id}/void`);
      await loadOrders();
    } catch (e) {
      alert(e?.response?.data?.message || "Failed to void promotion.");
    }
  };

  const deletePromotion = async (id) => {
    if (!window.confirm("Delete this promotion order?")) return;

    try {
      await api.delete(`/promotion-orders/${id}`);
      await loadOrders();
    } catch (e) {
      alert(e?.response?.data?.message || "Failed to delete promotion.");
    }
  };

  const reject = async (id) => {
    const reason = prompt("Enter rejection reason:");
    if (!reason || !reason.trim()) return;

    try {
      await api.put(`/promotion-orders/${id}/reject`, { reason: reason.trim() });
      await loadOrders();
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to reject.");
    }
  };

  const resolvePrevBranchText = (o) => {
    if (o.prev_branch_code || o.prev_branch_name) {
      return `${o.prev_branch_code || ""} - ${o.prev_branch_name || ""}`.trim();
    }

    const b = o.prev_branch_id ? branchMap.get(Number(o.prev_branch_id)) : null;
    return b ? `${b.code || ""} - ${b.name || ""}`.trim() : "-";
  };

  const resolvePresentBranchText = (o) => {
    if (o.present_branch_code || o.present_branch_name) {
      return `${o.present_branch_code || ""} - ${o.present_branch_name || ""}`.trim();
    }

    const b = o.present_branch_id ? branchMap.get(Number(o.present_branch_id)) : null;
    return b ? `${b.code || ""} - ${b.name || ""}`.trim() : "-";
  };

  const filteredOrders = useMemo(() => {
    const q = norm(orderSearch);

    return orders.filter((o) => {
      const status = norm(o.status);

      if (statusFilter === "Pending" && status !== "pending") {
        return false;
      }

      if (statusFilter === "Approved" && status !== "approved") {
        return false;
      }

      const hay = [
        o.order_no,
        o.employee_name,
        o.employee_no,
        o.old_position,
        o.new_position,
        o.status,
        o.approval_stage,
        getDepartment(o),
        resolvePrevBranchText(o),
        resolvePresentBranchText(o),
        fmtDate(o.effective_date),
      ]
        .map(norm)
        .join(" ");

      return !q || hay.includes(q);
    });
  }, [orders, orderSearch, branchMap, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));

  const paginatedOrders = useMemo(() => {
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [filteredOrders, page, pageSize, totalPages]);

  useEffect(() => {
    setPage(1);
  }, [orderSearch, pageSize, statusFilter]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const countText = useMemo(() => {
    const total = Array.isArray(orders) ? orders.length : 0;
    const filtered = filteredOrders.length;

    if (orderSearch.trim()) {
      return `${filtered} of ${total} Record${total === 1 ? "" : "s"}`;
    }

    return `${total} Record${total === 1 ? "" : "s"}`;
  }, [orders, filteredOrders, orderSearch]);

  const promotionSummary = useMemo(() => {
    const rows = Array.isArray(orders)
      ? orders
      : [];

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let pending = 0;
    let approved = 0;
    let rejected = 0;
    let voided = 0;
    let thisMonth = 0;

    rows.forEach((order) => {
      const status = norm(order?.status);

      if (status === "pending") {
        pending += 1;
      } else if (status === "approved") {
        approved += 1;
      } else if (status === "rejected") {
        rejected += 1;
      } else if (status === "voided") {
        voided += 1;
      }

      const createdAt = order?.created_at
        ? new Date(order.created_at)
        : null;

      if (
        createdAt &&
        !Number.isNaN(createdAt.getTime()) &&
        createdAt.getMonth() === currentMonth &&
        createdAt.getFullYear() === currentYear
      ) {
        thisMonth += 1;
      }
    });

    return {
      total: rows.length,
      pending,
      approved,
      rejected,
      voided,
      thisMonth,
    };
  }, [orders]);

  const badgeClass = (status) => {
    const s = norm(status);

    if (s === "approved") return "po-badge po-approved";
    if (s === "rejected") return "po-badge po-rejected";
    if (s === "voided") return "po-badge po-rejected";

    return "po-badge po-pending";
  };

  const closeViewOrder = () => setViewOrder(null);

  const stageRequiresFile = (o) => {
    const stage = norm(o?.approval_stage);

    return [
      "branch manager",
      "area manager",
      "regional manager",
      "assistant vice president",
      "vice president",
      "senior vice president",
      "tread",
      "admin order",
      "contract signing",
    ].includes(stage);
  };

  const actionButtonLabel = (o) => {
    const stage = norm(o?.approval_stage);

    if (stage === "branch manager") {
      return "Upload + Approve BM";
    }

    if (stage === "area manager") {
      return "Upload + Approve AM";
    }

    if (stage === "regional manager") {
      return "Upload + Approve RM";
    }

    if (stage === "assistant vice president") {
      return "Upload + Approve AVP";
    }

    if (stage === "vice president") {
      return "Upload + Approve VP";
    }

    if (stage === "senior vice president") {
      return "Upload + Approve SVP";
    }

    if (stage === "tread") {
      return "Upload + Recommend";
    }

    if (stage === "admin order") {
      return "Approve";
    }

    if (stage === "contract signing") {
      return "Approve";
    }

    if (stage === "hr final") {
      return "Received";
    }

    return "Upload + Approve";
  };

  return (
    <div className="po-page">
      <section className="po-hero">
        <div className="po-hero-main">
          <div className="po-hero-copy">
            <span className="po-eyebrow">
              HRIS TRANSACTIONS
            </span>

            <h1 className="po-title">
              Promotion Recommendations
            </h1>

            <p className="po-subtitle">
              Create, review, and track employee
              promotion recommendations through the
              required approval process.
            </p>

            <div className="po-chain">
              <span>Approval Flow</span>

              <strong>
                BM → AM → RM → AVP → VP → TREAD →
                HR Department → AVP / Upload Signed Contract by the Staff →
                Waiting for HR to Receive → Completed
              </strong>
            </div>
          </div>

          <div className="po-actions">
            <button
              className="po-btn po-btn-ghost"
              type="button"
              onClick={() => navigate(-1)}
            >
              ← Back
            </button>

            <button
              className="po-btn po-btn-outline"
              type="button"
              onClick={loadOrders}
              disabled={loadingOrders}
            >
              {loadingOrders
                ? "Refreshing..."
                : "Refresh"}
            </button>

            {canCreatePromotion && (
              <button
                className="po-btn po-btn-primary"
                type="button"
                onClick={() => setShowCreate(true)}
              >
                + Create Recommendation
              </button>
            )}
          </div>
        </div>

        <div className="po-summary-grid">
          <button
            type="button"
            className={`po-summary-card total ${
              statusFilter === "All"
                ? "active"
                : ""
            }`}
            onClick={() => setStatusFilter("All")}
          >
            <div className="po-summary-icon">
              ALL
            </div>

            <div>
              <span>Total Recommendations</span>
              <strong>
                {promotionSummary.total}
              </strong>
              <small>
                All promotion records
              </small>
            </div>
          </button>

          <button
            type="button"
            className={`po-summary-card pending ${
              statusFilter === "Pending"
                ? "active"
                : ""
            }`}
            onClick={() =>
              setStatusFilter("Pending")
            }
          >
            <div className="po-summary-icon">
              P
            </div>

            <div>
              <span>Pending</span>
              <strong>
                {promotionSummary.pending}
              </strong>
              <small>
                Awaiting action
              </small>
            </div>
          </button>

          <button
            type="button"
            className={`po-summary-card approved ${
              statusFilter === "Approved"
                ? "active"
                : ""
            }`}
            onClick={() =>
              setStatusFilter("Approved")
            }
          >
            <div className="po-summary-icon">
              A
            </div>

            <div>
              <span>Approved</span>
              <strong>
                {promotionSummary.approved}
              </strong>
              <small>
                Completed recommendations
              </small>
            </div>
          </button>

          <div className="po-summary-card monthly">
            <div className="po-summary-icon">
              M
            </div>

            <div>
              <span>Created This Month</span>
              <strong>
                {promotionSummary.thisMonth}
              </strong>
              <small>
                New recommendations
              </small>
            </div>
          </div>
        </div>
      </section>

      <div className="po-card">
        <div className="po-card-head">
          <div className="po-toolbar">
            <input
              className="po-search-input"
              value={orderSearch}
              onChange={(e) => setOrderSearch(e.target.value)}
              placeholder="Search order no, employee, branch, position, status..."
            />

            <select
              className="po-page-size"
              value={pageSize}
              onChange={(e) =>
                setPageSize(Number(e.target.value))
              }
            >
              <option value={25}>25 rows</option>
              <option value={50}>50 rows</option>
              <option value={75}>75 rows</option>
              <option value={100}>100 rows</option>
            </select>
          </div>
        </div>

        <div className="po-table-wrap">
          <table className="po-table">
            <thead>
              <tr>
                <th>ORDER NO</th>
                <th>EMPLOYEE</th>
                <th>PREVIOUS BRANCH</th>
                <th>PRESENT BRANCH</th>
                <th>OLD POSITION</th>
                <th>NEW POSITION</th>
                <th>EFFECTIVE</th>
                <th>STATUS</th>
                <th>CURRENT STAGE</th>
                <th>LATEST FILE</th>
                <th>ACTION</th>
              </tr>
            </thead>

            <tbody>
              {loadingOrders ? (
                <tr>
                  <td colSpan={11} className="po-empty">
                    Loading promotion recommendations…
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={11} className="po-empty">
                    No promotion recommendations found.
                  </td>
                </tr>
              ) : (
                paginatedOrders.map((o) => {
                  const isPending = norm(o.status) === "pending";
                  const canAct = canApproveStage(o);

                  return (
                    <tr key={o.id}>
                      <td className="mono">{o.order_no || `PRO-${o.id}`}</td>
                      <td className="td-strong">{o.employee_name}</td>
                      <td>{resolvePrevBranchText(o)}</td>
                      <td>{resolvePresentBranchText(o)}</td>
                      <td>{o.old_position || "-"}</td>
                      <td>{o.new_position || "-"}</td>
                      <td>{fmtDate(o.effective_date)}</td>

                      <td>
                        <span className={badgeClass(o.status)}>
                          {o.status || "Pending"}
                        </span>
                      </td>

                      <td>{getCurrentStageLabel(o)}</td>

                      <td>
                        {o.attachment_path ? (
                          <button
                            className="po-mini-btn po-download-btn"
                            type="button"
                            onClick={() => downloadFile(o.id, "latest", o.attachment_name || "")}
                          >
                            Download Latest
                          </button>
                        ) : (
                          <span className="po-dash">No file</span>
                        )}
                      </td>

                      <td>
                        {canAct && isPending ? (
                          <div className="po-action-stack">
                            <div className="po-action-row">
                              <button
                                className="po-mini-btn po-view-btn"
                                type="button"
                                onClick={() => setViewOrder(o)}
                              >
                                View
                              </button>

                              {(stageRequiresFile(o) || isAdmin) && (
                                <label className="po-mini-btn po-upload-btn">
                                  {approvalFiles[o.id]?.name
                                    ? norm(o.approval_stage) === "admin order"
                                      ? "Change Admin Order"
                                      : norm(o.approval_stage) === "contract signing"
                                      ? "Change Receiving Copy"
                                      : "Change File"
                                    : norm(o.approval_stage) === "admin order"
                                    ? "Upload Admin Order"
                                    : norm(o.approval_stage) === "contract signing"
                                    ? "Upload Receiving Copy"
                                    : "Upload File"}

                                  <input
                                    type="file"
                                    hidden
                                    accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                                    onChange={(e) =>
                                      setApprovalFiles((prev) => ({
                                        ...prev,
                                        [o.id]: e.target.files?.[0] || null,
                                      }))
                                    }
                                  />
                                </label>
                              )}

                              <button
                                className="po-mini-btn po-approve"
                                type="button"
                                disabled={uploadingId === String(o.id)}
                                onClick={() => approve(o)}
                              >
                                {uploadingId === String(o.id)
                                  ? "Approving..."
                                  : actionButtonLabel(o)}
                              </button>

                              <button
                                className="po-mini-btn po-reject"
                                type="button"
                                onClick={() => reject(o.id)}
                              >
                                Reject
                              </button>
                            </div>

                            {approvalFiles[o.id]?.name && (
                              <div
                                className="po-file-name"
                                title={approvalFiles[o.id].name}
                              >
                                {approvalFiles[o.id].name}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="po-action-stack">
                            <div className="po-file-actions">
                              <button
                                className="po-mini-btn po-view-btn"
                                type="button"
                                onClick={() => setViewOrder(o)}
                              >
                                View
                              </button>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="po-pager">
          <button
            className="po-mini-btn"
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Prev
          </button>

          <span className="po-page-info">
            Page {page} of {totalPages}
          </span>

          <button
            className="po-mini-btn"
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
          </button>
        </div>
      </div>

      {viewOrder && (
        <div className="po-modal-overlay" onMouseDown={closeViewOrder}>
          <div className="po-record-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="po-modal-head">
              <div>
                <h3 className="po-modal-title">Promotion Recommendation Record</h3>
                <p className="po-modal-sub">
                  {viewOrder.employee_name || "-"} • Order No:{" "}
                  {viewOrder.order_no || `PRO-${viewOrder.id}`}
                </p>
              </div>

              <button className="po-x" type="button" onClick={closeViewOrder}>
                ✕
              </button>
            </div>

            <div className="po-record-badges">
              <span>Status: {viewOrder.status || "Pending"}</span>
              <span>Current Stage: {getCurrentStageLabel(viewOrder)}</span>
              <span>Department: {getDepartment(viewOrder) || "-"}</span>
            </div>

            {/* ==============================================
                PROMOTION REJECTION DETAILS
            ============================================== */}

            {norm(viewOrder.status) === "rejected" && (
              <div className="po-rejection-details">
                <div className="po-rejection-header">
                  <span className="po-rejection-icon">!</span>

                  <div>
                    <h4>Promotion Rejected</h4>
                    <p>
                      This promotion recommendation was rejected.
                    </p>
                  </div>
                </div>

                <div className="po-rejection-content">
                  <strong>Reason for Rejection</strong>

                  <p>
                    {viewOrder.rejection_reason ||
                      "No rejection reason recorded."}
                  </p>
                </div>

                {viewOrder.rejected_at && (
                  <div className="po-rejection-date">
                    <strong>Rejected On:</strong>{" "}
                    {fmtDateTime(viewOrder.rejected_at)}
                  </div>
                )}
              </div>
            )}

            <div className="po-record-table">
              <div><strong>Order No</strong><span>{viewOrder.order_no || `PRO-${viewOrder.id}`}</span></div>
              <div><strong>Employee Name</strong><span>{viewOrder.employee_name || "-"}</span></div>
              <div><strong>Department</strong><span>{getDepartment(viewOrder) || "-"}</span></div>
              <div><strong>Previous Branch</strong><span>{resolvePrevBranchText(viewOrder)}</span></div>
              <div><strong>Present Branch</strong><span>{resolvePresentBranchText(viewOrder)}</span></div>
              <div><strong>Old Position</strong><span>{viewOrder.old_position || "-"}</span></div>
              <div><strong>New Position</strong><span>{viewOrder.new_position || "-"}</span></div>
              <div><strong>Old Salary</strong><span>{money(viewOrder.old_salary)}</span></div>
              <div><strong>New Salary</strong><span>{money(viewOrder.new_salary)}</span></div>
              <div><strong>Old ECOLA</strong><span>{money(viewOrder.old_ecola)}</span></div>
              <div><strong>New ECOLA</strong><span>{money(viewOrder.new_ecola)}</span></div>
              <div><strong>Effective Date</strong><span>{fmtDate(viewOrder.effective_date)}</span></div>
              <div><strong>Details / Remarks</strong><span>{viewOrder.details || "-"}</span></div>

              <div>
                <strong>File</strong>
                <span>
                  {viewOrder.attachment_path ? (
                    <button
                      className="po-mini-btn po-download-btn"
                      type="button"
                      onClick={() =>
                        downloadFile(viewOrder.id, "latest", viewOrder.attachment_name || "")
                      }
                    >
                      Download File
                    </button>
                  ) : (
                    "No file"
                  )}
                </span>
              </div>

              <div>
                <strong>Created</strong>
                <span>{fmtDate(viewOrder.created_at)}</span>
              </div>
              </div>

              <div className="po-approval-history">
                <div className="po-approval-history-head">
                  <div>
                    <h4>Approval History</h4>
                    <p>
                      Approvers recorded for this promotion recommendation.
                    </p>
                  </div>
                </div>

                <div className="po-approval-history-list">
                  {getApprovalHistory(viewOrder).length === 0 ? (
                    <div className="po-approval-history-empty">
                      No approval history recorded yet.
                    </div>
                  ) : (
                    getApprovalHistory(viewOrder).map((item) => {
                      const status = toStr(item.status || "Pending");

                      return (
                        <div
                          className="po-approval-history-row"
                          key={item.key}
                        >
                          <div className="po-approval-history-stage">
                            <strong>{item.label}</strong>

                            <span className={badgeClass(status)}>
                              {status}
                            </span>
                          </div>

                          <div className="po-approval-history-person">
                            <small>Approved / Recommended By</small>

                            <strong>
                              {item.approvedBy || "-"}
                            </strong>
                          </div>

                          <div className="po-approval-history-date">
                            <small>Date & Time</small>

                            <span>
                              {fmtDateTime(item.approvedAt)}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="po-modal-actions">
                {/* EDIT - only while Pending */}
                {canEditPromotion && norm(viewOrder.status) === "pending" && (
                  <button
                    className="po-btn po-edit-btn"
                    type="button"
                    onClick={() => openEditPromotion(viewOrder)}
                  >
                    Edit
                  </button>
                )}

                {/* VOID - only when Approved */}
                {canPowerAction && norm(viewOrder.status) === "approved" && (
                  <button
                    className="po-btn po-reject"
                    type="button"
                    onClick={async () => {
                      await voidPromotion(viewOrder.id);
                      closeViewOrder();
                    }}
                  >
                    Void
                  </button>
                )}

                {/* DELETE - only when Rejected or Voided */}
                {canPowerAction &&
                  ["rejected", "voided"].includes(norm(viewOrder.status)) && (
                    <button
                      className="po-btn po-reject"
                      type="button"
                      onClick={async () => {
                        await deletePromotion(viewOrder.id);
                        closeViewOrder();
                      }}
                    >
                      Delete
                    </button>
                  )}

                <button
                  className="po-btn po-btn-primary"
                  type="button"
                  onClick={closeViewOrder}
                >
                  Close
                </button>
              </div>
          </div>
        </div>
      )}

      {canCreatePromotion && showCreate && (
        <div
          className="po-modal-overlay"
          onMouseDown={(e) =>
            e.target.classList.contains("po-modal-overlay") && closeModal()
          }
        >
          <div className="po-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="po-modal-head">
              <div>
                <h3 className="po-modal-title">
                  {editingOrder
                    ? "Edit Promotion Recommendation"
                    : "Create Promotion Recommendation"}</h3>
                <p className="po-modal-sub">
                  Approval chain is based on the staff department and current position.
                </p>
              </div>

              <button className="po-x" type="button" onClick={closeModal}>
                ✕
              </button>
            </div>

            <form onSubmit={createOrder} className="po-form">
              <div className="po-grid">
                <div className="po-field" ref={employeePickerRef} style={{ position: "relative", overflow: "visible" }}>
                  <label>Employee</label>

                  <input
                    value={employeeSearch}
                    onChange={(e) => {
                      const value = e.target.value;
                      setEmployeeSearch(value);
                      setEmployeeQuery(value);
                      setShowEmployeeResults(true);
                      setSelectedEmployee(null);
                      resetForm();
                      setBranchSearch("");
                    }}
                    onFocus={() => setShowEmployeeResults(true)}
                    placeholder="Search employee no or name..."
                  />

                  {showEmployeeResults && (
                    <div className="po-search-dropdown">
                      {loadingStaff ? (
                        <div className="po-search-empty">Loading staff...</div>
                      ) : filteredStaff.length === 0 ? (
                        <div className="po-search-empty">No employee found.</div>
                      ) : (
                        filteredStaff.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            className="po-search-item"
                            onClick={() => onSelectEmployee(s.id)}
                          >
                            {(s.employee_no ? `${s.employee_no} - ` : "") + (s.fullname || "-")}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                <div className="po-field">
                  <label>Department</label>
                  <input value={form.department} readOnly placeholder="Auto-filled" />
                </div>

                <div className="po-field">
                  <label>Effective Date</label>
                  <input
                    type="date"
                    value={form.effective_date}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, effective_date: e.target.value }))
                    }
                    required
                  />
                </div>

                <div className="po-field">
                  <label>Previous Branch</label>
                  <input
                    value={`${form.prev_branch_code || ""}${
                      form.prev_branch_name ? ` - ${form.prev_branch_name}` : ""
                    }`}
                    readOnly
                    placeholder="Auto-filled"
                  />
                </div>

                <div className="po-field" ref={branchPickerRef} style={{ position: "relative", overflow: "visible" }}>
                  <label>Present Branch</label>

                  <input
                    value={branchSearch}
                    onChange={(e) => {
                      const value = e.target.value;
                      setBranchSearch(value);
                      setShowBranchResults(true);

                      setForm((p) => ({
                        ...p,
                        present_branch_id: "",
                        present_branch_code: "",
                        present_branch_name: "",
                      }));
                    }}
                    onFocus={() => setShowBranchResults(true)}
                    placeholder={loadingBranches ? "Loading branches..." : "Search branch code or name..."}
                    required
                  />

                  {showBranchResults && (
                    <div className="po-search-dropdown">
                      {loadingBranches ? (
                        <div className="po-search-empty">Loading branches...</div>
                      ) : filteredBranches.length === 0 ? (
                        <div className="po-search-empty">No branch found.</div>
                      ) : (
                        filteredBranches.map((b) => (
                          <button
                            key={b.id}
                            type="button"
                            className="po-search-item"
                            onClick={() => onSelectPresentBranch(b.id)}
                          >
                            {`${b.code || ""} - ${b.name || ""}`.trim()}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                <div className="po-field">
                  <label>Previous Position</label>
                  <input value={form.old_position} readOnly placeholder="Auto-filled" />
                </div>

                <div className="po-field">
                  <label>New Position</label>
                  <select
                    value={form.new_position}
                    onChange={(e) => onSelectNewPosition(e.target.value)}
                    required
                  >
                    <option value="">
                      {loadingRates ? "Loading positions..." : "Select New Position"}
                    </option>
                    {positionOptions.map((r) => (
                      <option key={r.id || r.position} value={r.position}>
                        {r.position}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="po-field full">
                  <label>
                    {editingOrder
                      ? "Replace Recommendation File (Optional)"
                      : "Attach Recommendation File"}
                  </label>

                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                    required={!editingOrder}
                    onChange={(e) =>
                      setAttachmentFile(e.target.files?.[0] || null)
                    }
                  />
                </div>

                <div className="po-field full">
                  <label>Remarks</label>
                  <textarea
                    value={form.remarks}
                    onChange={(e) => setForm((p) => ({ ...p, remarks: e.target.value }))}
                    placeholder="Optional notes / reason"
                    rows={3}
                  />
                </div>
              </div>

              <div className="po-modal-actions">
                <button className="po-btn po-btn-ghost" type="button" onClick={closeModal}>
                  Cancel
                </button>

                <button
                  className="po-btn po-btn-primary"
                  type="submit"
                  disabled={saving || !form.employee_id}
                >
                  {saving
                    ? editingOrder
                      ? "Updating..."
                      : "Creating..."
                    : editingOrder
                    ? "Update Promotion"
                    : "Create Promotion"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}