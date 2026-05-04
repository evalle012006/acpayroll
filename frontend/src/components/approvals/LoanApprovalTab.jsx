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

const STAGE_LABELS = {
  "area manager": "Area Manager",
  "regional manager": "Regional Manager",
  "assistant vice president": "Assistant Vice President",
  "vice president": "Vice President",
};

const FINAL_APPROVER_ROLES = ["vice president"];

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

const getDynamicApprovalChain = (item) => {
  const applicantRole = norm(item?.applicant_role);

  if (applicantRole === "vice president") {
    return ["vice president"];
  }

  if (applicantRole === "assistant vice president") {
    return ["vice president"];
  }

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
    admin: item.admin_status,
  };

  return toStr(keyMap[role] || "Pending") || "Pending";
};

const getCurrentStage = (item) => {
  const chain = getDynamicApprovalChain(item);
  const explicit = norm(item?.approval_stage);

  if (chain.includes(explicit)) return explicit;

  for (const role of chain) {
    const status = norm(getChainStatus(item, role));
    if (status !== "approved") return role;
  }

  return chain[chain.length - 1] || "admin";
};

const isFinalApprover = (role) => FINAL_APPROVER_ROLES.includes(norm(role));

const canUserActOnLoan = (item, role) => {
  const overall = norm(item?.status);
  if (overall === "approved" || overall === "rejected") return false;

  const stage = getCurrentStage(item);

  if (stage === "admin") {
    return isFinalApprover(role);
  }

  return norm(role) === stage;
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
    isHr ||
    isAccounting ||
    isAreaManager ||
    isRegionalManager ||
    isAssistantVicePresident ||
    isVicePresident;

  const canDownloadRequestFile =
    isAdmin ||
    isHr ||
    isAccounting ||
    isTread ||
    isAreaManager ||
    isRegionalManager ||
    isAssistantVicePresident ||
    isVicePresident ||
    isSeniorVicePresident ||
    isPresident;

  const canDownloadApprovedFile =
    isAdmin ||
    isHr ||
    isAccounting ||
    isTread ||
    isAreaManager ||
    isRegionalManager ||
    isAssistantVicePresident ||
    isVicePresident ||
    isSeniorVicePresident ||
    isPresident;

  const canUploadApprovedFile = isAdmin || isHr || isAccounting;

  const [loanRequests, setLoanRequests] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [branches, setBranches] = useState([]);

  const [selectedLoanType, setSelectedLoanType] = useState("All");

  const [showLoanModal, setShowLoanModal] = useState(false);
  const [showCreateLoan, setShowCreateLoan] = useState(false);
  const [showLoanView, setShowLoanView] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState(null);

  const [loadingLoan, setLoadingLoan] = useState(false);
  const [creatingLoan, setCreatingLoan] = useState(false);
  const [processingId, setProcessingId] = useState("");
  const [uploadingApproved, setUploadingApproved] = useState({});

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
    amount: "",
    term: "",
    interest: "",
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
      `${s.last_name || ""}${s.last_name && s.first_name ? ", " : ""}${s.first_name || ""}${
        s.middle_name ? ` ${s.middle_name}` : ""
      }`
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
        return String(staff.branch_id || "") === String(user?.branch_id || "");
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
    return loanRequests.filter((item) => {
      if (!canSeeLoanByScope(item)) return false;

      if (selectedLoanType === "All") return true;
      return item.loan_type === selectedLoanType;
    });
  }, [loanRequests, selectedLoanType, canSeeLoanByScope]);

  const filteredLoanEmployees = useMemo(() => {
    const q = norm(loanEmployeeSearch);
    if (!q) return searchableStaff.slice(0, 20);
    return searchableStaff.filter((s) => s._searchBlob.includes(q)).slice(0, 20);
  }, [searchableStaff, loanEmployeeSearch]);

  const badgeClass = (status) => {
    const s = String(status || "").trim().toLowerCase();
    if (s === "approved") return "badge badge-approved";
    if (s === "rejected") return "badge badge-rejected";
    return "badge badge-pending";
  };

  const loanPreview = useMemo(() => {
    const amount = toNum(loanForm.amount);
    const interest = toNum(loanForm.interest);
    const term = Math.max(1, toNum(loanForm.term));
    const total = amount + (amount * interest) / 100;
    const per_month = term ? total / term : total;
    return { total, per_month };
  }, [loanForm.amount, loanForm.interest, loanForm.term]);

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
        emp?.cbu ??
        emp?.current_cbu ??
        emp?.staff_cbu ??
        emp?.cbu_balance ??
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
      amount: "",
      term: "",
      interest: "",
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
    const per_month = term ? total / term : total;

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

      if (loanForm.attachment) {
        formData.append("attachment", loanForm.attachment);
      }

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

  const updateLoanStatus = async (id, action) => {
    if (!id) {
      alert("Loan record has no valid id.");
      return;
    }

    const ok = window.confirm(
      `Are you sure you want to ${String(action).toLowerCase()} this loan request?`
    );
    if (!ok) return;

    try {
      setProcessingId(`loan-${id}-${action}`);
      await api.put(`/loan-requests/${id}`, { action });
      alert(`Loan request ${String(action).toLowerCase()}d successfully.`);
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

  const downloadLoanFile = async (id, type, fallbackName = "") => {
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

  const uploadApprovedLoanFile = async (loanId, file) => {
    if (!file) return;

    try {
      setUploadingApproved((prev) => ({ ...prev, [loanId]: true }));

      const formData = new FormData();
      formData.append("attachment", file);

      await api.post(`/loan-requests/${loanId}/approved-file`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      alert("Approved signed loan file uploaded.");
      await fetchLoan();
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to upload approved signed file.");
    } finally {
      setUploadingApproved((prev) => ({ ...prev, [loanId]: false }));
    }
  };

  const openLoanView = (loan) => {
    setSelectedLoan(loan);
    setShowLoanView(true);
  };

  const closeLoanView = () => {
    setSelectedLoan(null);
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

              <button className="btn-primary" onClick={() => setShowLoanModal(true)} type="button">
                View
              </button>
            </div>
          </div>

          <div className="approval-card-body">
            <div className="mini">
              {loadingLoan
                ? "Loading loan requests..."
                : "Final approval is handled by Vice President."}
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
                  Initial approval stage: {STAGE_LABELS[getInitialStageForCurrentUser()]}
                </p>
              </div>

              <button className="modal-x" type="button" onClick={() => setShowCreateLoan(false)}>
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
                    onChange={(e) => setLoanForm((p) => ({ ...p, loan_type: e.target.value }))}
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
                  <label>Amount</label>
                  <input
                    type="number"
                    value={loanForm.amount}
                    onChange={(e) => setLoanForm((p) => ({ ...p, amount: e.target.value }))}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Term (Months)</label>
                  <input
                    type="number"
                    value={loanForm.term}
                    onChange={(e) => setLoanForm((p) => ({ ...p, term: e.target.value }))}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Interest (%)</label>
                  <input
                    type="number"
                    value={loanForm.interest}
                    onChange={(e) => setLoanForm((p) => ({ ...p, interest: e.target.value }))}
                    required
                  />
                </div>

                <div className="form-group full">
                  <label>Attach Request File</label>
                  <input
                    type="file"
                    onChange={(e) =>
                      setLoanForm((p) => ({
                        ...p,
                        attachment: e.target.files?.[0] || null,
                      }))
                    }
                  />
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
                  <strong>₱ {loanPreview.total.toFixed(2)}</strong>
                </div>
                <div>
                  <span>Per Month</span>
                  <strong>₱ {loanPreview.per_month.toFixed(2)}</strong>
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
                <p className="modal-subtitle">Filter by type and follow approval chain</p>
              </div>

              <button className="modal-x" type="button" onClick={() => setShowLoanModal(false)}>
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

            <div className="table-card">
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Employee</th>
                      <th>Applicant Role</th>
                      <th>Loan Type</th>
                      <th>Amount</th>
                      <th>Term</th>
                      <th>Interest</th>
                      <th>Per Month</th>
                      <th>Total</th>
                      <th>Status</th>
                      <th>Current Stage</th>
                      <th>Approval Chain</th>
                      <th>Files</th>
                      <th>Dates</th>
                      <th>Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredLoan.length === 0 ? (
                      <tr>
                        <td colSpan={15} className="empty-state">
                          No requests found.
                        </td>
                      </tr>
                    ) : (
                      filteredLoan.map((item) => {
                        const currentStage = getCurrentStage(item);
                        const canAct =
                          canParticipateInLoanApproval && canUserActOnLoan(item, role);

                        return (
                          <tr key={item.id}>
                            <td>{item.id ?? "-"}</td>

                            <td className="td-strong">
                              {item.staff_name || staffDisplayName(item.staff_id)}
                              <div style={{ fontSize: 12, opacity: 0.75 }}>
                                Emp No: {item.employee_no || "-"}
                              </div>
                            </td>

                            <td>{item.applicant_role || "-"}</td>
                            <td>{item.loan_type}</td>
                            <td>₱ {fmtMoney(item.amount)}</td>
                            <td>{item.term}</td>
                            <td>{item.interest}%</td>
                            <td>₱ {fmtMoney(item.per_month)}</td>
                            <td>₱ {fmtMoney(item.total)}</td>

                            <td>
                              <span className={badgeClass(item.status)}>{item.status}</span>
                            </td>

                            <td>{STAGE_LABELS[currentStage] || "-"}</td>

                            <td style={{ fontSize: 12, lineHeight: 1.5 }}>
                              {renderChainSummary(item)}
                            </td>

                            <td>
                              <div className="row-actions" style={{ flexWrap: "wrap" }}>
                                {item.attachment_path && canDownloadRequestFile ? (
                                  <button
                                    className="btn-secondary"
                                    type="button"
                                    onClick={() =>
                                      downloadLoanFile(
                                        item.id,
                                        "request",
                                        item.attachment_name || ""
                                      )
                                    }
                                  >
                                    Download Request File
                                  </button>
                                ) : null}

                                {item.approved_attachment_path && canDownloadApprovedFile ? (
                                  <button
                                    className="btn-secondary"
                                    type="button"
                                    onClick={() =>
                                      downloadLoanFile(
                                        item.id,
                                        "approved",
                                        item.approved_attachment_name || ""
                                      )
                                    }
                                  >
                                    Download Approved File
                                  </button>
                                ) : null}

                                {canUploadApprovedFile && norm(item.status) === "approved" ? (
                                  <label className="btn-secondary" style={{ cursor: "pointer" }}>
                                    {uploadingApproved[item.id]
                                      ? "Uploading..."
                                      : "Upload Approved Signed File"}
                                    <input
                                      type="file"
                                      style={{ display: "none" }}
                                      onChange={(e) =>
                                        uploadApprovedLoanFile(
                                          item.id,
                                          e.target.files?.[0] || null
                                        )
                                      }
                                    />
                                  </label>
                                ) : null}
                              </div>
                            </td>

                            <td style={{ fontSize: 12, opacity: 0.85 }}>
                              {norm(item.status) === "approved" ? (
                                <>
                                  <div>Approved: {fmtDate(item.approved_at)}</div>
                                  <div>Disbursed: {fmtDate(item.disbursement_date)}</div>
                                </>
                              ) : (
                                <>
                                  <div>Approved: -</div>
                                  <div>Disbursed: -</div>
                                </>
                              )}
                            </td>

                            <td>
                              <div className="row-actions">
                                <button
                                  className="btn-secondary"
                                  onClick={() => openLoanView(item)}
                                  type="button"
                                >
                                  View
                                </button>

                                {canAct ? (
                                  <>
                                    <button
                                      className="btn-success"
                                      onClick={() => updateLoanStatus(item.id, "approve")}
                                      type="button"
                                      disabled={processingId === `loan-${item.id}-approve`}
                                    >
                                      {processingId === `loan-${item.id}-approve`
                                        ? "Approving..."
                                        : "Approve"}
                                    </button>

                                    <button
                                      className="btn-danger"
                                      onClick={() => updateLoanStatus(item.id, "reject")}
                                      type="button"
                                      disabled={processingId === `loan-${item.id}-reject`}
                                    >
                                      {processingId === `loan-${item.id}-reject`
                                        ? "Rejecting..."
                                        : "Reject"}
                                    </button>
                                  </>
                                ) : null}
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

            <div className="modal-buttons">
              <button className="btn-secondary" type="button" onClick={() => setShowLoanModal(false)}>
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
                  <label>Loan Type</label>
                  <input value={selectedLoan.loan_type || "-"} readOnly />
                </div>

                <div className="form-group">
                  <label>Amount</label>
                  <input value={`₱ ${fmtMoney(selectedLoan.amount)}`} readOnly />
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
                  <input value={`₱ ${fmtMoney(selectedLoan.per_month)}`} readOnly />
                </div>

                <div className="form-group">
                  <label>Total</label>
                  <input value={`₱ ${fmtMoney(selectedLoan.total)}`} readOnly />
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
                  <label>Original Request File</label>
                  {selectedLoan.attachment_path ? (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() =>
                        downloadLoanFile(
                          selectedLoan.id,
                          "request",
                          selectedLoan.attachment_name || ""
                        )
                      }
                    >
                      Download Request File
                    </button>
                  ) : (
                    <input value="No request file" readOnly />
                  )}
                </div>

                <div className="form-group full">
                  <label>Approved Signed File</label>
                  {selectedLoan.approved_attachment_path ? (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() =>
                        downloadLoanFile(
                          selectedLoan.id,
                          "approved",
                          selectedLoan.approved_attachment_name || ""
                        )
                      }
                    >
                      Download Approved File
                    </button>
                  ) : (
                    <input value="No approved signed file" readOnly />
                  )}
                </div>

                <div className="form-group full">
                  <label>Reason</label>
                  <textarea value={selectedLoan.reason || "-"} readOnly />
                </div>
              </div>

              <div className="modal-buttons">
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