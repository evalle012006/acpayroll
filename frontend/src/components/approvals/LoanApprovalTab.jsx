import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "../../api/axiosClient";

const loanTypes = [
  "All",
  "Salary Advance",
  "Special Advance",
  "Cash Advance",
  "Motorcycle Loan",
  "Pag-ibig Loan",
];

const loanPurposes = [
  "Emergency",
  "Medical",
  "Hospital Bill",
  "Drivers License",
  "Motorcycle",
  "Financial",
  "Travel",
  "Mortgage",
  "Business",
  "Bill Payment",
];

const STAGE_LABELS = {
  "area manager": "Area Manager",
  "regional manager": "Regional Manager",
  "assistant vice president": "Assistant Vice President",
  "vice president": "Vice President",
  "senior vice president": "Senior Vice President",
  admin: "Admin / Final Approval",
  accounting: "Accounting / Final Upload",
};

const FINAL_APPROVER_ROLES = [
  "admin",
  "it",
  "hr",
  "accounting",
  "tread",
  "vice president",
  "senior vice president",
  "president",
];

const readUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
};

const toNum = (v) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const toStr = (v) => String(v ?? "").trim();
const norm = (v) => toStr(v).toLowerCase();
const todayDate = () => new Date().toISOString().slice(0, 10);

const fmtMoney = (v) =>
  Number(toNum(v)).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtDate = (d) => (d ? String(d).slice(0, 10) : "-");

const BACK_OFFICE_DEPARTMENTS = [
  "it",
  "it department",
  "audit",
  "audit department",
  "hr",
  "hr department",
  "human resources",
  "human resources department",
  "accounting",
  "accounting department",
  "tread",
  "tread department",
  "production & logistic",
  "production & logistic department",
  "production and logistic",
  "production and logistic department",
  "office of the president",
  "main office",
];

const isBackOfficeDepartment = (department) =>
  BACK_OFFICE_DEPARTMENTS.includes(norm(department));

const getDynamicApprovalChain = (item) => {
  const department = item?.department || item?.staff_department || "";

  const dept = norm(department);

    if (
      dept === "audit" ||
      dept === "audit department"
    ) {
      return [
        "assistant vice president",
        "senior vice president",
      ];
    }

    if (isBackOfficeDepartment(department)) {
      return ["assistant vice president"];
    }

  const applicantRole = norm(item?.applicant_role);

  if (applicantRole === "vice president") return ["vice president"];
  if (applicantRole === "assistant vice president") return ["vice president"];

  if (applicantRole === "regional manager") {
    return ["assistant vice president", "vice president"];
  }

  if (applicantRole === "area manager") {
    return ["regional manager", "assistant vice president", "vice president"];
  }

  return [
    "area manager",
    "regional manager",
    "assistant vice president",
    "vice president",
  ];
};

const getChainStatus = (item, role) => {
  if (!item) return "Pending";

  const keyMap = {
    "area manager": item.area_manager_status,
    "regional manager": item.regional_manager_status,
    "assistant vice president": item.assistant_vice_president_status,
    "vice president": item.vice_president_status,
    "senior vice president": item.senior_vice_president_status,
    admin: item.admin_status,
  };

  return toStr(keyMap[role] || "Pending") || "Pending";
};

const getCurrentStage = (item) => {
  const chain = getDynamicApprovalChain(item);
  const explicit = norm(item?.approval_stage);

  if (chain.includes(explicit)) return explicit;
  if (explicit === "admin") return "admin";
  if (explicit === "accounting") return "accounting";

  for (const role of chain) {
    const status = norm(getChainStatus(item, role));
    if (status !== "approved") return role;
  }

  return chain[chain.length - 1] || "admin";
};

const isFinalApprover = (role) => FINAL_APPROVER_ROLES.includes(norm(role));

const canUserActOnLoan = (item, role) => {
  const overall = norm(item?.status);
    if (overall === "pending accounting") {
    return false;
  }

  if (overall === "approved" || overall === "rejected" || overall === "voided") {
    return false;
  }

  const normalizedRole = norm(role);

  if (
    normalizedRole === "admin" ||
    normalizedRole === "it" ||
    normalizedRole === "hr" ||
    normalizedRole === "accounting" ||
    normalizedRole === "tread" ||
    normalizedRole === "senior vice president"
  ) {
    return true;
  }

  const stage = getCurrentStage(item);

  if (stage === "admin") {
    return isFinalApprover(role);
  }

  return normalizedRole === stage;
};

const renderChainSummary = (item) => {
  const chain = getDynamicApprovalChain(item);

  return chain
    .map((role) => {
      const status = getChainStatus(item, role);
      return `${STAGE_LABELS[role]}: ${status || "Pending"}`;
    })
    .join(" | ");
};

export default function LoanApprovalTab() {
  const user = useMemo(() => readUser(), []);
  const role = norm(user?.role);

  const isAdmin = role === "admin";
  const isIt = role === "it";
  const isHr = role === "hr";
  const isAccounting = role === "accounting";
  const isTread = role === "tread";
  const isAreaManager = role === "area manager";
  const isBranchManager = role === "branch manager";
  const isRegionalManager = role === "regional manager";
  const isAssistantVicePresident = role === "assistant vice president";
  const isVicePresident = role === "vice president";
  const isSeniorVicePresident = role === "senior vice president";
  const isPresident = role === "president";

  const canCreateLoan =
    isAdmin ||
    isIt ||
    isHr ||
    isAccounting ||
    isTread ||
    isBranchManager ||
    isAreaManager ||
    isRegionalManager ||
    isAssistantVicePresident ||
    isVicePresident ||
    isSeniorVicePresident ||
    isPresident;

  const canParticipateInLoanApproval =
    isAdmin ||
    isIt ||
    isHr ||
    isAccounting ||
    isTread ||
    isBranchManager ||
    isAreaManager ||
    isRegionalManager ||
    isAssistantVicePresident ||
    isVicePresident ||
    isSeniorVicePresident ||
    isPresident;

  const canDownloadLoanFile =
    isAdmin ||
    isIt ||
    isHr ||
    isAccounting ||
    isTread ||
    isBranchManager ||
    isAreaManager ||
    isRegionalManager ||
    isAssistantVicePresident ||
    isVicePresident ||
    isSeniorVicePresident ||
    isPresident;

  const canVoidLoan = isAdmin || isIt;
  const isPendingAccounting = (item) =>
    norm(item?.status) === "pending accounting";

  const canUploadFinalLoanFile = isAdmin || isIt || isAccounting;

  const [loanRequests, setLoanRequests] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [branches, setBranches] = useState([]);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [selectedLoanType, setSelectedLoanType] = useState("All");

  const [showLoanModal, setShowLoanModal] = useState(false);
  const [showCreateLoan, setShowCreateLoan] = useState(false);
  const [showLoanView, setShowLoanView] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState(null);

  const [loadingLoan, setLoadingLoan] = useState(false);
  const [creatingLoan, setCreatingLoan] = useState(false);
  const [processingId, setProcessingId] = useState("");
  const [approvalFiles, setApprovalFiles] = useState({});
  const [finalApprovalData, setFinalApprovalData] = useState({});
  const [viewApprovalFile, setViewApprovalFile] = useState(null);

  const [loanEmployeeSearch, setLoanEmployeeSearch] = useState("");
  const [showLoanEmployeeDropdown, setShowLoanEmployeeDropdown] = useState(false);
  const loanEmployeeBoxRef = useRef(null);

  const [loanForm, setLoanForm] = useState({
    staff_id: "",
    employee_no: "",
    staff_name: "",
    position: "",
    area: "",
    salary: "",
    ecola: "",
    cbu: "",
    date_created: todayDate(),
    branch_id: "",
    branch_code: "",
    branch_name: "",
    loan_type: "",
    loan_purpose: "",
    amount: "",
    term: "",
    interest: "",
    per_month: "",
    reason: "",
    attachment: null,
  });

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/login";
  }, []);

  const safeGet = useCallback(
    async (url, setLoading) => {
      try {
        setLoading(true);
        const res = await api.get(url);
        return Array.isArray(res.data) ? res.data : [];
      } catch (err) {
        console.error(`GET ${url} failed:`, err?.response?.data || err.message);
        if (err?.response?.status === 401) logout();
        return [];
      } finally {
        setLoading(false);
      }
    },
    [logout]
  );

  const fetchStaff = useCallback(async () => {
    try {
      const res = await api.get("/staff");
      setStaffList(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to fetch staff:", err?.response?.data || err.message);
      if (err?.response?.status === 401) logout();
      setStaffList([]);
    }
  }, [logout]);

  const fetchBranches = useCallback(async () => {
    try {
      const res = await api.get("/branches");
      setBranches(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to fetch branches:", err?.response?.data || err.message);
      if (err?.response?.status === 401) logout();
      setBranches([]);
    }
  }, [logout]);

  const fetchLoan = useCallback(async () => {
    const data = await safeGet("/loan-requests", setLoadingLoan);
    setLoanRequests(data);
  }, [safeGet]);

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!user || !token) {
      window.location.href = "/login";
      return;
    }

    fetchStaff();
    fetchBranches();
    fetchLoan();
  }, [user, fetchStaff, fetchBranches, fetchLoan]);

  useEffect(() => {
    const isOpen = showLoanModal || showCreateLoan || showLoanView;

    if (!isOpen) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        setShowLoanModal(false);
        setShowCreateLoan(false);
        setShowLoanView(false);
        setShowLoanEmployeeDropdown(false);
      }
    };

    const onMouseDown = (e) => {
      if (loanEmployeeBoxRef.current && !loanEmployeeBoxRef.current.contains(e.target)) {
        setShowLoanEmployeeDropdown(false);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onMouseDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onMouseDown);
      document.body.style.overflow = "";
    };
  }, [showLoanModal, showCreateLoan, showLoanView]);

  const branchMap = useMemo(() => {
    const m = new Map();
    branches.forEach((b) => m.set(String(b.id), b));
    return m;
  }, [branches]);

  const staffMap = useMemo(() => {
    const m = new Map();
    staffList.forEach((s) => m.set(String(s.id), s));
    return m;
  }, [staffList]);

  const buildStaffDisplay = useCallback((s) => {
    if (!s) return "-";

    const built =
      s.fullname ||
      `${s.last_name || ""}${s.last_name && s.first_name ? ", " : ""}${
        s.first_name || ""
      }${s.middle_name ? ` ${s.middle_name}` : ""}`
        .replace(/\s+/g, " ")
        .trim();

    return built || "-";
  }, []);

  const staffDisplayName = useCallback(
    (staffId) => {
      const s = staffMap.get(String(staffId));
      return buildStaffDisplay(s);
    },
    [staffMap, buildStaffDisplay]
  );

  const searchableStaff = useMemo(() => {
    return staffList.map((s) => {
      const display = buildStaffDisplay(s);

      const searchBlob = [
        s.id,
        s.employee_no,
        s.fullname,
        s.first_name,
        s.last_name,
        s.middle_name,
        display,
        s.position,
        s.area,
        s.region,
        s.division,
      ]
        .map((x) => toStr(x))
        .join(" ")
        .toLowerCase();

      return {
        ...s,
        _display: display,
        _searchBlob: searchBlob,
      };
    });
  }, [staffList, buildStaffDisplay]);

  const canSeeLoanByScope = useCallback(
    (item) => {
      if (
        isAdmin ||
        isIt ||
        isHr ||
        isAccounting ||
        isTread ||
        isVicePresident ||
        isSeniorVicePresident ||
        isPresident
      ) {
        return true;
      }

      const staff =
        staffMap.get(String(item.staff_id)) ||
        staffList.find((s) => String(s.employee_no) === String(item.employee_no));

      if (!staff) return false;

      if (isBranchManager) {
        const userBranch = norm(user?.branch_id);

        const staffBranchValues = [
          staff.branch_id,
          staff.branch_code,
          staff.code,
          staff.branch_name,
          staff.branch,
        ].map(norm);

        return staffBranchValues.includes(userBranch);
      }

      if (isAreaManager) {
        return norm(staff.area) === norm(user?.area);
      }

      if (isRegionalManager) {
        return norm(staff.region) === norm(user?.region);
      }

      if (isAssistantVicePresident) {
        return norm(staff.division) === norm(user?.division);
      }

      return false;
    },
    [
      isAdmin,
      isIt,
      isHr,
      isAccounting,
      isTread,
      isVicePresident,
      isSeniorVicePresident,
      isPresident,
      isBranchManager,
      isAreaManager,
      isRegionalManager,
      isAssistantVicePresident,
      staffMap,
      staffList,
      user,
    ]
  );

  const filteredLoan = useMemo(() => {
    const q = norm(search);

    return loanRequests.filter((item) => {
      if (!canSeeLoanByScope(item)) return false;

      if (selectedLoanType !== "All" && item.loan_type !== selectedLoanType) {
        return false;
      }

      if (!q) return true;

      const haystack = [
        item.id,
        item.staff_id,
        item.employee_no,
        item.staff_name,
        staffDisplayName(item.staff_id),
        item.applicant_role,
        item.loan_type,
        item.loan_purpose,
        item.amount,
        item.term,
        item.interest,
        item.per_month,
        item.total,
        item.status,
        item.approval_stage,
        item.attachment_name,
        item.approved_attachment_name,
        renderChainSummary(item),
        item.reason,
        item.created_at,
        item.approved_at,
        item.disbursement_date,
      ]
        .map((v) => toStr(v).toLowerCase())
        .join(" ");

      return haystack.includes(q);
    });
  }, [loanRequests, selectedLoanType, canSeeLoanByScope, search, staffDisplayName]);

  const totalPages = Math.max(1, Math.ceil(filteredLoan.length / pageSize));

  const pagedLoan = useMemo(() => {
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * pageSize;
    return filteredLoan.slice(start, start + pageSize);
  }, [filteredLoan, page, pageSize, totalPages]);

  useEffect(() => {
    setPage(1);
  }, [search, selectedLoanType, pageSize]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const handleSearch = () => {
    setSearch(searchInput);
  };

  const handleClearSearch = () => {
    setSearchInput("");
    setSearch("");
  };

  const filteredLoanEmployees = useMemo(() => {
    const q = norm(loanEmployeeSearch);

    if (!q) return searchableStaff.slice(0, 20);

    return searchableStaff.filter((s) => s._searchBlob.includes(q)).slice(0, 20);
  }, [searchableStaff, loanEmployeeSearch]);

  const badgeClass = (status) => {
    const s = norm(status);

    if (s === "approved") return "badge badge-approved";
    if (s === "rejected") return "badge badge-rejected";
    if (s === "voided") return "badge badge-rejected";

    return "badge badge-pending";
  };

  const loanPreview = useMemo(() => {
    const amount = toNum(loanForm.amount);
    const interest = toNum(loanForm.interest);
    const term = Math.max(1, toNum(loanForm.term));
    const total = amount + (amount * interest) / 100;
    const per_month =
      loanForm.loan_type === "Motorcycle Loan"
        ? toNum(loanForm.per_month)
        : term
        ? total / term
        : total;

    return { total, per_month };
  }, [loanForm.amount, loanForm.interest, loanForm.term, loanForm.loan_type, loanForm.per_month]);

  const handleLoanEmployeeSelect = (staffId) => {
    const emp = staffList.find((s) => String(s.id) === String(staffId));
    const bid = emp?.branch_id ? String(emp.branch_id) : "";
    const b = bid ? branchMap.get(bid) : null;

    setLoanForm((prev) => ({
      ...prev,
      staff_id: String(staffId || ""),
      employee_no: emp?.employee_no || "",
      staff_name: emp?.fullname || buildStaffDisplay(emp),
      position: emp?.position || "",
      area: emp?.area || "",
      salary: emp?.salary ?? "",
      ecola: emp?.ecola ?? "",
      cbu:
        emp?.cbu_balance ??
        emp?.staff_balance_cbu ??
        emp?.current_cbu ??
        emp?.staff_cbu ??
        emp?.cbu ??
        "",
      date_created: todayDate(),
      branch_id: bid,
      branch_code: b?.code || "",
      branch_name: b?.name || "",
    }));

    setLoanEmployeeSearch(
      emp ? `${emp.employee_no ? `${emp.employee_no} - ` : ""}${buildStaffDisplay(emp)}` : ""
    );

    setShowLoanEmployeeDropdown(false);
  };

  const resetLoanForm = () => {
    setLoanForm({
      staff_id: "",
      employee_no: "",
      staff_name: "",
      position: "",
      area: "",
      salary: "",
      ecola: "",
      cbu: "",
      date_created: todayDate(),
      branch_id: "",
      branch_code: "",
      branch_name: "",
      loan_type: "",
      loan_purpose: "",
      amount: "",
      term: "",
      interest: "",
      per_month: "",
      reason: "",
      attachment: null,
    });

    setLoanEmployeeSearch("");
    setShowLoanEmployeeDropdown(false);
  };

  const getInitialStageForCurrentUser = () => {
    if (role === "vice president") return "admin";
    if (role === "assistant vice president") return "vice president";
    if (role === "regional manager") return "assistant vice president";
    if (role === "area manager") return "regional manager";

    return "area manager";
  };

  const handleCreateLoan = async (e) => {
    e.preventDefault();

    const amount = toNum(loanForm.amount);
    const interest = toNum(loanForm.interest);
    const term = Math.max(1, toNum(loanForm.term));
    const total = amount + (amount * interest) / 100;
    const per_month =
      loanForm.loan_type === "Motorcycle Loan"
        ? toNum(loanForm.per_month)
        : term
        ? total / term
        : total;

    if (loanForm.loan_type === "Cash Advance") {
      if (amount < 1000 || amount > 5000) {
        alert("Cash Advance amount must be between ₱1,000 and ₱5,000.");
        return;
      }

      if (term !== 1) {
        alert("Cash Advance term must be 1 month only.");
        return;
      }

      if (interest !== 0) {
        alert("Cash Advance interest must be 0%.");
        return;
      }
    }

    if (loanForm.loan_type === "Motorcycle Loan" && per_month <= 0) {
      alert("Please enter the motorcycle loan monthly payment.");
      return;
    }

    if (!loanForm.attachment) {
      alert("Please attach the loan request file before submitting.");
      return;
    }

    try {
      setCreatingLoan(true);

      const formData = new FormData();

      formData.append("staff_id", loanForm.staff_id);
      formData.append("loan_type", loanForm.loan_type);
      formData.append("reason", loanForm.reason);
      formData.append("amount", amount);
      formData.append("interest", interest);
      formData.append("term", term);
      formData.append("total", total);
      formData.append("per_month", per_month);
      formData.append("status", "Pending");
      formData.append("approval_stage", getInitialStageForCurrentUser());
      formData.append("applicant_role", role);
      formData.append("date_created", loanForm.date_created || todayDate());
      formData.append("loan_purpose", loanForm.loan_purpose);
      formData.append("attachment", loanForm.attachment);

      await api.post("/loan-requests", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      alert("Loan request submitted successfully.");
      resetLoanForm();
      setShowCreateLoan(false);
      await fetchLoan();
    } catch (err) {
      console.error("Failed to create loan:", err?.response?.data || err.message);
      if (err?.response?.status === 401) return logout();
      if (err?.response?.status === 403) return alert("Access denied.");
      alert(err?.response?.data?.message || "Failed to submit loan request.");
    } finally {
      setCreatingLoan(false);
    }
  };

  const downloadLoanFile = async (id, type = "latest", fallbackName = "") => {
    try {
      const res = await api.get(`/loan-requests/${id}/download/${type}`, {
        responseType: "blob",
      });

      const blob = new Blob([res.data]);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");

      a.href = url;
      a.download = fallbackName || `loan-${id}-${type}`;

      document.body.appendChild(a);
      a.click();
      a.remove();

      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to download file.");
    }
  };

  const updateLoanStatus = async (item, action) => {
    const id = item?.id;

    if (!id) {
      alert("Loan record has no valid id.");
      return;
    }

    if (action === "approve" && !approvalFiles[id]) {
      alert(
        "Please upload the signed/approved file first. The uploaded file will replace the previous file for the next approver."
      );
      return;
    }

    const ok = window.confirm(
      action === "approve"
        ? "Approve this loan and submit the newly uploaded signed file to the next approver?"
        : "Reject this loan request?"
    );

    if (!ok) return;

    try {
      setProcessingId(`loan-${id}-${action}`);

      const formData = new FormData();
      formData.append("action", action);

      if (action === "approve") {
        formData.append("attachment", approvalFiles[id]);
      }

      await api.put(`/loan-requests/${id}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      alert(
        action === "approve"
          ? "Loan approved and signed file submitted successfully."
          : "Loan request rejected successfully."
      );

      setApprovalFiles((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });

      if (selectedLoan?.id === id) {
        setViewApprovalFile(null);
        setShowLoanView(false);
        setSelectedLoan(null);
      }

      await fetchLoan();
    } catch (err) {
      console.error("Loan update error:", err?.response?.data || err.message);
      if (err?.response?.status === 401) return logout();
      if (err?.response?.status === 403) return alert("Access denied.");
      alert(err?.response?.data?.message || "Failed to update loan request.");
    } finally {
      setProcessingId("");
    }
  };

  const uploadFinalApprovedLoanFile = async (item) => {
    const id = item?.id;

    if (!id) return alert("Loan record has no valid id.");

    if (!approvalFiles[id]) {
      alert("Please upload the final Accounting file first.");
      return;
    }

    if (toNum(finalApprovalData[id]?.approved_amount) <= 0) {
      alert("Please enter the final approved amount.");
      return;
    }

    const ok = window.confirm(
      "Upload final Accounting file and fully approve this loan?"
    );

    if (!ok) return;

    try {
      setProcessingId(`loan-${id}-final-upload`);

      const formData = new FormData();

      formData.append("attachment", approvalFiles[id]);

      formData.append(
        "approved_amount",
        finalApprovalData[id]?.approved_amount || ""
      );

      formData.append(
        "approved_total",
        finalApprovalData[id]?.approved_total || ""
      );

      formData.append(
        "approved_per_month",
        finalApprovalData[id]?.approved_per_month || ""
      );

      await api.post(`/loan-requests/${id}/approved-file`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      alert("Final file uploaded. Loan is now fully approved.");

      setApprovalFiles((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });

      setViewApprovalFile(null);
      setShowLoanView(false);
      setSelectedLoan(null);

      await fetchLoan();
    } catch (err) {
      console.error("Final upload error:", err?.response?.data || err.message);
      if (err?.response?.status === 401) return logout();
      if (err?.response?.status === 403) return alert("Access denied.");
      alert(err?.response?.data?.message || "Failed to upload final file.");
    } finally {
      setProcessingId("");
    }
  };

  const voidLoan = async (item) => {
    if (!canVoidLoan) {
      return alert("Only Admin and IT can void loans.");
    }

    const id = item?.id;

    if (!id) {
      return alert("Loan record has no valid id.");
    }

    if (norm(item?.status) !== "approved") {
      return alert("Only approved loans can be voided.");
    }

    const reason = window.prompt("Enter void reason:");

    if (reason === null) {
      return;
    }

    const ok = window.confirm(
      "Void this approved loan? This will remove/reverse it from staff balances."
    );

    if (!ok) return;

    try {
      setProcessingId(`loan-${id}-void`);

      await api.put(`/loan-requests/${id}/void`, {
        reason: reason || "Loan voided",
      });

      alert("Loan successfully voided.");

      if (selectedLoan?.id === id) {
        setViewApprovalFile(null);
        setShowLoanView(false);
        setSelectedLoan(null);
      }

      await fetchLoan();
    } catch (err) {
      console.error("Void loan error:", err?.response?.data || err.message);

      if (err?.response?.status === 401) {
        return logout();
      }

      if (err?.response?.status === 403) {
        return alert("Access denied.");
      }

      alert(err?.response?.data?.message || "Failed to void loan.");
    } finally {
      setProcessingId("");
    }
  };

  const openLoanView = (loan) => {
    setSelectedLoan(loan);
    setViewApprovalFile(null);
    setShowLoanView(true);
  };

  const closeLoanView = () => {
    setSelectedLoan(null);
    setViewApprovalFile(null);
    setShowLoanView(false);
  };

  const loanPendingCount = useMemo(
    () => filteredLoan.filter((x) => norm(x.status) === "pending").length,
    [filteredLoan]
  );

  return (
    <>
      <div className="approval-grid">
        <div className="approval-card">
          <div className="approval-card-head">
            <div>
              <div className="approval-card-title">Loan Requests</div>
              <div className="approval-card-meta">
                Pending: <span className="pill">{loanPendingCount}</span>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {canCreateLoan && (
                <button
                  className="btn-primary"
                  onClick={() => setShowCreateLoan(true)}
                  type="button"
                >
                  + Add Loan
                </button>
              )}

              <button
                className="btn-primary"
                onClick={() => setShowLoanModal(true)}
                type="button"
              >
                View
              </button>
            </div>
          </div>

          <div className="approval-card-body">
            <div className="mini">
              {loadingLoan
                ? "Loading loan requests..."
                : "Approvers must download the latest file, sign it, upload it, then approve."}
            </div>
          </div>
        </div>
      </div>

      {canCreateLoan && showCreateLoan && (
        <div
          className="modal-overlay"
          onMouseDown={(e) =>
            e.target.classList.contains("modal-overlay") && setShowCreateLoan(false)
          }
        >
          <div className="modal saas-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h3 className="modal-title">Add Loan Request</h3>
                <p className="modal-subtitle">
                  Upload the first loan file. Every approver will replace it with the newly signed file.
                </p>
              </div>

              <button
                className="modal-x"
                type="button"
                onClick={() => setShowCreateLoan(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateLoan} className="modal-form">
              <div className="modal-grid">
                <div className="form-group approval-search-select" ref={loanEmployeeBoxRef}>
                  <label>Employee</label>

                  <input
                    type="text"
                    value={loanEmployeeSearch}
                    onChange={(e) => {
                      setLoanEmployeeSearch(e.target.value);
                      setShowLoanEmployeeDropdown(true);

                      setLoanForm((p) => ({
                        ...p,
                        staff_id: "",
                        employee_no: "",
                        staff_name: "",
                        position: "",
                        area: "",
                        salary: "",
                        ecola: "",
                        cbu: "",
                        branch_id: "",
                        branch_code: "",
                        branch_name: "",
                      }));
                    }}
                    onFocus={() => setShowLoanEmployeeDropdown(true)}
                    placeholder="Search employee no or name..."
                    required={!loanForm.staff_id}
                  />

                  {showLoanEmployeeDropdown && (
                    <div className="approval-search-dropdown">
                      {filteredLoanEmployees.length === 0 ? (
                        <div className="approval-search-empty">No employee found</div>
                      ) : (
                        filteredLoanEmployees.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => handleLoanEmployeeSelect(s.id)}
                            className="approval-search-item"
                          >
                            {s.employee_no ? `${s.employee_no} - ` : ""}
                            {s._display}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label>Employee No</label>
                  <input value={loanForm.employee_no} readOnly placeholder="Auto-filled" />
                </div>

                <div className="form-group">
                  <label>Employee Name</label>
                  <input value={loanForm.staff_name} readOnly placeholder="Auto-filled" />
                </div>

                <div className="form-group">
                  <label>Position</label>
                  <input value={loanForm.position} readOnly placeholder="Auto-filled" />
                </div>

                <div className="form-group">
                  <label>Area</label>
                  <input value={loanForm.area} readOnly placeholder="Auto-filled" />
                </div>

                <div className="form-group">
                  <label>Basic Salary</label>
                  <input
                    value={loanForm.salary === "" ? "" : `₱ ${fmtMoney(loanForm.salary)}`}
                    readOnly
                    placeholder="Auto-filled"
                  />
                </div>

                <div className="form-group">
                  <label>ECOLA</label>
                  <input
                    value={loanForm.ecola === "" ? "" : `₱ ${fmtMoney(loanForm.ecola)}`}
                    readOnly
                    placeholder="Auto-filled"
                  />
                </div>

                <div className="form-group">
                  <label>Current Staff CBU</label>
                  <input
                    value={loanForm.cbu === "" ? "" : `₱ ${fmtMoney(loanForm.cbu)}`}
                    readOnly
                    placeholder="Auto-filled"
                  />
                </div>

                <div className="form-group">
                  <label>Date Created</label>
                  <input
                    type="date"
                    value={loanForm.date_created}
                    onChange={(e) =>
                      setLoanForm((p) => ({ ...p, date_created: e.target.value }))
                    }
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Branch</label>
                  <input
                    value={
                      loanForm.branch_code || loanForm.branch_name
                        ? `${loanForm.branch_code} - ${loanForm.branch_name}`
                        : ""
                    }
                    readOnly
                    placeholder="Auto-filled"
                  />
                </div>

                <div className="form-group">
                  <label>Loan Type</label>
                  <select
                    value={loanForm.loan_type}
                    onChange={(e) => {
                      const value = e.target.value;

                      if (value === "Cash Advance") {
                        setLoanForm((p) => ({
                          ...p,
                          loan_type: value,
                          amount: "",
                          term: 1,
                          interest: 0,
                          per_month: "",
                        }));
                      } else if (value === "Motorcycle Loan") {
                        setLoanForm((p) => ({
                          ...p,
                          loan_type: value,
                          per_month: p.per_month || "",
                        }));
                      } else {
                        setLoanForm((p) => ({
                          ...p,
                          loan_type: value,
                          per_month: "",
                        }));
                      }
                    }}
                    required
                  >
                    <option value="">Select Loan Type</option>
                    <option value="Motorcycle Loan">Motorcycle Loan</option>
                    <option value="Salary Advance">Salary Advance</option>
                    <option value="Cash Advance">Cash Advance</option>
                    <option value="Special Advance">Special Advance</option>
                    <option value="Pag-ibig Loan">Pag-ibig Loan</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Loan Purpose</label>
                  <select
                    value={loanForm.loan_purpose}
                    onChange={(e) =>
                      setLoanForm((p) => ({ ...p, loan_purpose: e.target.value }))
                    }
                    required
                  >
                    <option value="">Select Purpose</option>
                    {loanPurposes.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Amount</label>
                  <input
                    type="number"
                    value={loanForm.amount}
                    onChange={(e) => {
                      let value = e.target.value;

                      if (loanForm.loan_type === "Cash Advance") {
                        const n = Number(value);

                        if (n > 5000) value = "5000";
                        if (n < 0) value = "";
                      }

                      setLoanForm((p) => ({
                        ...p,
                        amount: value,
                      }));
                    }}
                    min={loanForm.loan_type === "Cash Advance" ? 1000 : undefined}
                    max={loanForm.loan_type === "Cash Advance" ? 5000 : undefined}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Term (Months)</label>
                  <input
                    type="number"
                    value={loanForm.term}
                    onChange={(e) => setLoanForm((p) => ({ ...p, term: e.target.value }))}
                    readOnly={loanForm.loan_type === "Cash Advance"}
                    required
                  />
                </div>

                {loanForm.loan_type === "Motorcycle Loan" && (
                  <div className="form-group">
                    <label>Per Month</label>
                    <input
                      type="number"
                      value={loanForm.per_month}
                      onChange={(e) =>
                        setLoanForm((p) => ({ ...p, per_month: e.target.value }))
                      }
                      min="1"
                      step="0.01"
                      placeholder="Enter monthly payment manually"
                      required
                    />
                  </div>
                )}

                <div className="form-group">
                  <label>Interest (%)</label>
                  <input
                    type="number"
                    value={loanForm.interest}
                    onChange={(e) => setLoanForm((p) => ({ ...p, interest: e.target.value }))}
                    readOnly={loanForm.loan_type === "Cash Advance"}
                    required
                  />
                </div>

                <div className="form-group full">
                  <label>Attach Initial Loan File</label>
                  <input
                    type="file"
                    required
                    onChange={(e) =>
                      setLoanForm((p) => ({
                        ...p,
                        attachment: e.target.files?.[0] || null,
                      }))
                    }
                  />
                  <small style={{ opacity: 0.75 }}>
                    This is the first file. Each approver will replace it with the latest signed file.
                  </small>
                </div>

                <div className="form-group full">
                  <label>Reason</label>
                  <textarea
                    value={loanForm.reason}
                    onChange={(e) => setLoanForm((p) => ({ ...p, reason: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="preview-box">
                <div>
                  <span>Total with Interest</span>
                  <strong>₱ {fmtMoney(loanPreview.total)}</strong>
                </div>

                <div>
                  <span>Per Month</span>
                  <strong>₱ {fmtMoney(loanPreview.per_month)}</strong>
                </div>
              </div>

              <div className="modal-buttons">
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={() => setShowCreateLoan(false)}
                >
                  Cancel
                </button>

                <button className="btn-primary" type="submit" disabled={creatingLoan}>
                  {creatingLoan ? "Submitting..." : "Submit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showLoanModal && (
        <div
          className="modal-overlay"
          onMouseDown={(e) =>
            e.target.classList.contains("modal-overlay") && setShowLoanModal(false)
          }
        >
          <div className="modal saas-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h3 className="modal-title">Loan Requests</h3>
                <p className="modal-subtitle">
                  Download latest file, upload signed file, then approve.
                </p>
              </div>

              <button
                className="modal-x"
                type="button"
                onClick={() => setShowLoanModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="filters">
              {loanTypes.map((t) => (
                <button
                  key={t}
                  className={`chip ${selectedLoanType === t ? "active" : ""}`}
                  onClick={() => setSelectedLoanType(t)}
                  type="button"
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="exit-filter-bar">
              <div className="exit-search-box">
                <span className="exit-search-icon">⌕</span>
                <input
                  className="exit-search-input"
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder="Search employee, loan type, status, amount..."
                />
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button className="btn-secondary" type="button" onClick={handleSearch}>
                  Search
                </button>

                <button className="btn-secondary" type="button" onClick={handleClearSearch}>
                  Clear
                </button>
              </div>
            </div>

            <div className="table-card">
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Applicant Role</th>
                      <th>Loan Type</th>
                      <th>Status</th>
                      <th>Current Stage</th>
                      <th>Latest File</th>
                      <th>Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredLoan.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="empty-state">
                          No requests found.
                        </td>
                      </tr>
                    ) : (
                      pagedLoan.map((item) => {
                        const currentStage = getCurrentStage(item);
                        const canAct =
                          canParticipateInLoanApproval && canUserActOnLoan(item, role);

                        return (
                          <tr key={item.id}>
                            <td className="td-strong">
                              {item.staff_name || staffDisplayName(item.staff_id)}
                              <div style={{ fontSize: 12, opacity: 0.75 }}>
                                Emp No: {item.employee_no || "-"}
                              </div>
                            </td>

                            <td>{item.applicant_role || "-"}</td>
                            <td>{item.loan_type}</td>

                            <td>
                              <span className={badgeClass(item.status)}>
                                {item.status}
                              </span>
                            </td>

                            <td>{STAGE_LABELS[currentStage] || "-"}</td>

                            <td style={{ fontSize: 12 }}>
                              {item.attachment_path && canDownloadLoanFile ? (
                                <button
                                  className="btn-secondary"
                                  type="button"
                                  onClick={() =>
                                    downloadLoanFile(
                                      item.id,
                                      "latest",
                                      item.attachment_name || item.approved_attachment_name || ""
                                    )
                                  }
                                >
                                  Download Latest
                                </button>
                              ) : (
                                "No file"
                              )}
                            </td>

                            <td>
                              <div className="row-actions loan-row-actions">
                                <button
                                  className="btn-secondary"
                                  onClick={() => openLoanView(item)}
                                  type="button"
                                >
                                  View
                                </button>

                                {canAct && (
                                  <>
                                    <label className="loan-upload-pill">
                                      <input
                                        type="file"
                                        hidden
                                        onChange={(e) =>
                                          setApprovalFiles((prev) => ({
                                            ...prev,
                                            [item.id]: e.target.files?.[0] || null,
                                          }))
                                        }
                                      />
                                      📎 {approvalFiles[item.id]?.name ? "Change File" : "Upload File"}
                                    </label>

                                    {approvalFiles[item.id]?.name && (
                                      <span className="loan-file-name" title={approvalFiles[item.id].name}>
                                        {approvalFiles[item.id].name}
                                      </span>
                                    )}

                                    <button
                                      className="btn-success"
                                      onClick={() => updateLoanStatus(item, "approve")}
                                      type="button"
                                      disabled={processingId === `loan-${item.id}-approve`}
                                    >
                                      {processingId === `loan-${item.id}-approve`
                                        ? "Approving..."
                                        : "Submit"}
                                    </button>

                                    <button
                                      className="btn-danger"
                                      onClick={() => updateLoanStatus(item, "reject")}
                                      type="button"
                                      disabled={processingId === `loan-${item.id}-reject`}
                                    >
                                      {processingId === `loan-${item.id}-reject`
                                        ? "Rejecting..."
                                        : "Reject"}
                                    </button>
                                  </>
                                )}

                                {canVoidLoan && norm(item.status) === "approved" && (
                                  <button
                                    className="btn-danger"
                                    onClick={() => voidLoan(item)}
                                    type="button"
                                    disabled={processingId === `loan-${item.id}-void`}
                                  >
                                    {processingId === `loan-${item.id}-void`
                                      ? "Voiding..."
                                      : "Void Loan"}
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="exit-pager">
              <div className="exit-page-size">
                <span>Rows per page:</span>

                <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
                  {[25, 50, 75, 100].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>

              <div className="exit-page-info">
                Page {page} of {totalPages}
              </div>

              <div className="exit-page-buttons">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </button>

                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </button>
              </div>
            </div>

            <div className="modal-buttons">
              <button
                className="btn-secondary"
                type="button"
                onClick={() => setShowLoanModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showLoanView && selectedLoan && (
        <div
          className="modal-overlay"
          onMouseDown={(e) => e.target.classList.contains("modal-overlay") && closeLoanView()}
        >
          <div className="modal saas-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h3 className="modal-title">Loan Application Details</h3>
                <p className="modal-subtitle">
                  {selectedLoan.staff_name || staffDisplayName(selectedLoan.staff_id)}
                </p>
              </div>

              <button className="modal-x" type="button" onClick={closeLoanView}>
                ✕
              </button>
            </div>

            <div className="modal-form">
              <div className="modal-grid">
                <div className="form-group">
                  <label>ID</label>
                  <input value={selectedLoan.id ?? "-"} readOnly />
                </div>

                <div className="form-group">
                  <label>Employee Name</label>
                  <input
                    value={selectedLoan.staff_name || staffDisplayName(selectedLoan.staff_id)}
                    readOnly
                  />
                </div>

                <div className="form-group">
                  <label>Employee No</label>
                  <input value={selectedLoan.employee_no || "-"} readOnly />
                </div>

                <div className="form-group">
                  <label>Applicant Role</label>
                  <input value={selectedLoan.applicant_role || "-"} readOnly />
                </div>

                <div className="form-group">
                  <label>Branch</label>
                  <input
                    value={
                      selectedLoan.branch_code || selectedLoan.branch_name
                        ? `${selectedLoan.branch_code || ""} - ${selectedLoan.branch_name || ""}`
                        : selectedLoan.branch || "-"
                    }
                    readOnly
                  />
                </div>

                <div className="form-group">
                  <label>Loan Type</label>
                  <input value={selectedLoan.loan_type || "-"} readOnly />
                </div>

                <div className="form-group">
                  <label>Loan Purpose</label>
                  <input value={selectedLoan.loan_purpose || "-"} readOnly />
                </div>

                <div className="form-group">
                  <label>Amount</label>
                    <input
                      value={`₱ ${fmtMoney(
                        selectedLoan.approved_amount || selectedLoan.amount
                      )}`}
                      readOnly
                    />
                </div>

                <div className="form-group">
                  <label>Interest</label>
                  <input value={`${selectedLoan.interest || 0}%`} readOnly />
                </div>

                <div className="form-group">
                  <label>Term</label>
                  <input value={selectedLoan.term || "-"} readOnly />
                </div>

                <div className="form-group">
                  <label>Per Month</label>
                    <input
                      value={`₱ ${fmtMoney(
                        selectedLoan.approved_per_month || selectedLoan.per_month
                      )}`}
                      readOnly
                    />
                </div>

                <div className="form-group">
                  <label>Total</label>
                    <input
                      value={`₱ ${fmtMoney(
                        selectedLoan.approved_total || selectedLoan.total
                      )}`}
                      readOnly
                    />
                </div>

                <div className="form-group">
                  <label>Status</label>
                  <input value={selectedLoan.status || "-"} readOnly />
                </div>

                <div className="form-group">
                  <label>Current Approval Stage</label>
                  <input value={STAGE_LABELS[getCurrentStage(selectedLoan)] || "-"} readOnly />
                </div>

                <div className="form-group">
                  <label>Approved Date</label>
                  <input value={fmtDate(selectedLoan.approved_at)} readOnly />
                </div>

                <div className="form-group">
                  <label>Disbursement Date</label>
                  <input value={fmtDate(selectedLoan.disbursement_date)} readOnly />
                </div>

                <div className="form-group full">
                  <label>Approval Chain</label>
                  <textarea value={renderChainSummary(selectedLoan)} readOnly />
                </div>

                <div className="form-group full">
                  <label>Latest Loan File</label>
                  {selectedLoan.attachment_path && canDownloadLoanFile ? (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() =>
                        downloadLoanFile(
                          selectedLoan.id,
                          "latest",
                          selectedLoan.attachment_name || selectedLoan.approved_attachment_name || ""
                        )
                      }
                    >
                      Download Latest File
                    </button>
                  ) : (
                    <input value="No loan file" readOnly />
                  )}
                </div>

                {norm(selectedLoan.status) !== "approved" &&
                  norm(selectedLoan.status) !== "voided" &&
                  !isPendingAccounting(selectedLoan) &&
                  canParticipateInLoanApproval &&
                  canUserActOnLoan(selectedLoan, role) && (
                    <div className="form-group full">
                      <label>Upload Signed File Before Approving</label>
                      <input
                        type="file"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          setViewApprovalFile(file);
                          setApprovalFiles((prev) => ({
                            ...prev,
                            [selectedLoan.id]: file,
                          }));
                        }}
                      />
                      <small style={{ opacity: 0.75 }}>
                        This file replaces the previous file. The next approver will download this new file.
                      </small>
                    </div>
                  )}

                {viewApprovalFile && (
                  <div className="form-group full">
                    <label>Selected File</label>
                    <input value={viewApprovalFile.name} readOnly />
                  </div>
                )}

                {isPendingAccounting(selectedLoan) && canUploadFinalLoanFile && (
                  <div className="form-group full">
                    <label>Upload Final Accounting File</label>

                    <input
                      type="number"
                      placeholder="Final Approved Amount"
                      value={finalApprovalData[selectedLoan.id]?.approved_amount || ""}
                      onChange={(e) =>
                        setFinalApprovalData((prev) => ({
                          ...prev,
                          [selectedLoan.id]: {
                            ...prev[selectedLoan.id],
                            approved_amount: e.target.value,
                          },
                        }))
                      }
                    />

                    <input
                      type="number"
                      placeholder="Final Approved Total"
                      value={finalApprovalData[selectedLoan.id]?.approved_total || ""}
                      onChange={(e) =>
                        setFinalApprovalData((prev) => ({
                          ...prev,
                          [selectedLoan.id]: {
                            ...prev[selectedLoan.id],
                            approved_total: e.target.value,
                          },
                        }))
                      }
                    />

                    <input
                      type="number"
                      placeholder="Final Approved Per Month"
                      value={finalApprovalData[selectedLoan.id]?.approved_per_month || ""}
                      onChange={(e) =>
                        setFinalApprovalData((prev) => ({
                          ...prev,
                          [selectedLoan.id]: {
                            ...prev[selectedLoan.id],
                            approved_per_month: e.target.value,
                          },
                        }))
                      }
                    />

                    <input
                      type="file"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setViewApprovalFile(file);
                        setApprovalFiles((prev) => ({
                          ...prev,
                          [selectedLoan.id]: file,
                        }));
                      }}
                    />
                    <small style={{ opacity: 0.75 }}>
                      Accounting uploads the final file. After this, the loan becomes Approved.
                    </small>
                  </div>
                )}

                <div className="form-group full">
                  <label>Reason</label>
                  <textarea value={selectedLoan.reason || "-"} readOnly />
                </div>
              </div>

              <div className="modal-buttons">
                {norm(selectedLoan.status) !== "approved" &&
                  norm(selectedLoan.status) !== "voided" &&
                  !isPendingAccounting(selectedLoan) &&
                  canParticipateInLoanApproval &&
                  canUserActOnLoan(selectedLoan, role) && (
                    <>
                      <button
                        className="btn-success"
                        type="button"
                        disabled={processingId === `loan-${selectedLoan.id}-approve`}
                        onClick={() => updateLoanStatus(selectedLoan, "approve")}
                      >
                        {processingId === `loan-${selectedLoan.id}-approve`
                          ? "Approving..."
                          : "Upload + Approve"}
                      </button>

                      <button
                        className="btn-danger"
                        type="button"
                        disabled={processingId === `loan-${selectedLoan.id}-reject`}
                        onClick={() => updateLoanStatus(selectedLoan, "reject")}
                      >
                        {processingId === `loan-${selectedLoan.id}-reject`
                          ? "Rejecting..."
                          : "Reject"}
                      </button>
                    </>
                  )}

                {canVoidLoan && norm(selectedLoan.status) === "approved" && (
                  <button
                    className="btn-danger"
                    type="button"
                    disabled={processingId === `loan-${selectedLoan.id}-void`}
                    onClick={() => voidLoan(selectedLoan)}
                  >
                    {processingId === `loan-${selectedLoan.id}-void`
                      ? "Voiding..."
                      : "Void Loan"}
                  </button>
                )}

                {isPendingAccounting(selectedLoan) && canUploadFinalLoanFile && (
                  <button
                    className="btn-success"
                    type="button"
                    disabled={processingId === `loan-${selectedLoan.id}-final-upload`}
                    onClick={() => uploadFinalApprovedLoanFile(selectedLoan)}
                  >
                    {processingId === `loan-${selectedLoan.id}-final-upload`
                      ? "Uploading..."
                      : "Upload Final File"}
                  </button>
                )}

                <button className="btn-secondary" type="button" onClick={closeLoanView}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}