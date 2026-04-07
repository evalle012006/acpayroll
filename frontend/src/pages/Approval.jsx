import React, { useCallback, useEffect, useMemo, useState } from "react";
import "../styles/Approval.css";
import api from "../api/axiosClient";

const loanTypes = [
  "All",
  "Salary Advance",
  "Special Loan",
  "Cash Loan",
  "Motorcycle Loan",
  "Pag-ibig Loan",
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

const fmtMoney = (v) =>
  Number(toNum(v)).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtDate = (d) => (d ? String(d).slice(0, 10) : "-");
const norm = (v) => String(v ?? "").trim().toLowerCase();

export default function Approval() {
  const user = useMemo(() => readUser(), []);
  const role = norm(user?.role);

  const isAdmin = role === "admin";
  const isHr = role === "hr";
  const isAccounting = role === "accounting";
  const isAreaManager = role === "area manager";
  const isBranchManager = role === "branch manager";
  const isRegionalManager = role === "regional manager";
  const isAssistantVicePresident = role === "assistant vice president";
  const isVicePresident = role === "vice president";
  const isSeniorVicePresident = role === "senior vice president";
  const isPresident = role === "president";

  const canApproveLoan = isAdmin || isHr || isAccounting;
  const canCreateLoan =
    isAdmin ||
    isHr ||
    isAccounting ||
    isBranchManager ||
    isAreaManager ||
    isRegionalManager ||
    isAssistantVicePresident ||
    isVicePresident ||
    isSeniorVicePresident ||
    isPresident;

  const canViewSAP = !( isAreaManager || isRegionalManager || isAssistantVicePresident);
  const canCreateSAP = (isAdmin || isBranchManager) && !isAssistantVicePresident;

  const [loanRequests, setLoanRequests] = useState([]);
  const [sapRows, setSapRows] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [branches, setBranches] = useState([]);

  const [selectedLoanType, setSelectedLoanType] = useState("All");

  const [showLoanModal, setShowLoanModal] = useState(false);
  const [showSapModal, setShowSapModal] = useState(false);
  const [showCreateLoan, setShowCreateLoan] = useState(false);
  const [showCreateSAP, setShowCreateSAP] = useState(false);

  const [loadingLoan, setLoadingLoan] = useState(false);
  const [loadingSap, setLoadingSap] = useState(false);
  const [creatingLoan, setCreatingLoan] = useState(false);
  const [creatingSap, setCreatingSap] = useState(false);
  const [processingId, setProcessingId] = useState("");

  const [loanForm, setLoanForm] = useState({
    staff_id: "",
    branch_id: "",
    branch_code: "",
    branch_name: "",
    loan_type: "",
    amount: "",
    term: "",
    interest: "",
    reason: "",
    approved_at: "",
    disbursement_date: "",
  });

  const [sapForm, setSapForm] = useState({
    employee_id: "",
    employee_no: "",
    staff_name: "",
    description: "",
    amount: "",
    term: "",
    balance: "",
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

  const fetchSap = useCallback(async () => {
    const data = await safeGet("/staff-accounts-payable", setLoadingSap);
    setSapRows(data);
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

    if (canViewSAP) {
      fetchSap();
    } else {
      setSapRows([]);
    }
  }, [user, canViewSAP, fetchStaff, fetchBranches, fetchLoan, fetchSap]);

  useEffect(() => {
    const isOpen = showLoanModal || showSapModal || showCreateLoan || showCreateSAP;
    if (!isOpen) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        setShowLoanModal(false);
        setShowSapModal(false);
        setShowCreateLoan(false);
        setShowCreateSAP(false);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [showLoanModal, showSapModal, showCreateLoan, showCreateSAP]);

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

  const staffDisplayName = useCallback(
    (staffId) => {
      const s = staffMap.get(String(staffId));
      if (!s) return "-";

      const built = `${s.last_name || ""}${s.last_name && s.first_name ? ", " : ""}${s.first_name || ""}${
        s.middle_name ? ` ${s.middle_name}` : ""
      }`
        .replace(/\s+/g, " ")
        .trim();

      return s.fullname || built || "-";
    },
    [staffMap]
  );

  const badgeClass = (status) => {
    const s = String(status || "").trim();
    if (s === "Approved") return "badge badge-approved";
    if (s === "Rejected") return "badge badge-rejected";
    return "badge badge-pending";
  };

  const renderEmployeeOptions = () =>
    staffList.map((s) => (
      <option key={s.id} value={s.id}>
        {(s.employee_no ? `${s.employee_no} - ` : "") +
          (s.fullname || `${s.last_name || ""}, ${s.first_name || ""}`)}
      </option>
    ));

  const filteredLoan = useMemo(() => {
    return loanRequests.filter((item) => {
      if (selectedLoanType === "All") return true;
      return item.loan_type === selectedLoanType;
    });
  }, [loanRequests, selectedLoanType]);

  const loanPreview = useMemo(() => {
    const amount = toNum(loanForm.amount);
    const interest = toNum(loanForm.interest);
    const term = Math.max(1, toNum(loanForm.term));
    const total = amount + (amount * interest) / 100;
    const per_month = term ? total / term : total;
    return { total, per_month };
  }, [loanForm.amount, loanForm.interest, loanForm.term]);

  const sapPreview = useMemo(() => {
    const amount = toNum(sapForm.amount);
    const term = Math.max(1, toNum(sapForm.term));
    const per_month = term ? amount / term : 0;
    return { per_month };
  }, [sapForm.amount, sapForm.term]);

  const handleLoanEmployeeSelect = (staffId) => {
    const emp = staffList.find((s) => String(s.id) === String(staffId));
    const bid = emp?.branch_id ? String(emp.branch_id) : "";
    const b = bid ? branchMap.get(bid) : null;

    setLoanForm((prev) => ({
      ...prev,
      staff_id: String(staffId || ""),
      branch_id: bid,
      branch_code: b?.code || "",
      branch_name: b?.name || "",
    }));
  };

  const handleSapEmployeeSelect = (employeeId) => {
    const emp = staffList.find((s) => String(s.id) === String(employeeId));
    const display =
      emp?.fullname ||
      `${emp?.last_name || ""}${emp?.last_name && emp?.first_name ? ", " : ""}${emp?.first_name || ""}${
        emp?.middle_name ? ` ${emp.middle_name}` : ""
      }`.trim();

    setSapForm((prev) => ({
      ...prev,
      employee_id: String(employeeId || ""),
      employee_no: emp?.employee_no || "",
      staff_name: display || "-",
    }));
  };

  const resetLoanForm = () => {
    setLoanForm({
      staff_id: "",
      branch_id: "",
      branch_code: "",
      branch_name: "",
      loan_type: "",
      amount: "",
      term: "",
      interest: "",
      reason: "",
      approved_at: "",
      disbursement_date: "",
    });
  };

  const resetSapForm = () => {
    setSapForm({
      employee_id: "",
      employee_no: "",
      staff_name: "",
      description: "",
      amount: "",
      term: "",
      balance: "",
    });
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

      await api.post("/loan-requests", {
        staff_id: loanForm.staff_id,
        loan_type: loanForm.loan_type,
        reason: loanForm.reason,
        amount,
        interest,
        term,
        total,
        per_month,
        status: "Pending",
        approved_at: loanForm.approved_at || null,
        disbursement_date: loanForm.disbursement_date || null,
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

  const handleCreateSAP = async (e) => {
    e.preventDefault();

    const amount = toNum(sapForm.amount);
    const term = Math.max(1, toNum(sapForm.term));
    const per_month = term ? amount / term : 0;
    const balance =
      sapForm.balance === "" || sapForm.balance == null ? amount : toNum(sapForm.balance);

    try {
      setCreatingSap(true);

      await api.post("/staff-accounts-payable", {
        employee_no: sapForm.employee_no,
        staff_name: sapForm.staff_name,
        description: sapForm.description,
        amount,
        term,
        per_month,
        balance,
      });

      alert("Staff Accounts Payable added successfully.");
      resetSapForm();
      setShowCreateSAP(false);
      await fetchSap();
    } catch (err) {
      console.error("Failed to create SAP:", err?.response?.data || err.message);
      if (err?.response?.status === 401) return logout();
      alert(err?.response?.data?.message || "Failed to add Staff Accounts Payable.");
    } finally {
      setCreatingSap(false);
    }
  };

  const updateLoanStatus = async (id, status) => {
    if (!id) {
      alert("Loan record has no valid id.");
      return;
    }

    const ok = window.confirm(
      `Are you sure you want to ${String(status).toLowerCase()} this loan request?`
    );
    if (!ok) return;

    try {
      setProcessingId(`loan-${id}-${status}`);
      await api.put(`/loan-requests/${id}`, { status });
      alert(`Loan request ${status.toLowerCase()} successfully.`);
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

  const updateSapStatus = async (id, status, reason = "") => {
    if (!id) {
      alert("SAP record has no valid id.");
      return;
    }

    const ok = window.confirm(
      `Are you sure you want to ${String(status).toLowerCase()} this SAP record?`
    );
    if (!ok) return;

    try {
      setProcessingId(`sap-${id}-${status}`);
      await api.put(`/staff-accounts-payable/${id}`, { status, reason });
      alert(`SAP ${status.toLowerCase()} successfully.`);
      await fetchSap();
    } catch (err) {
      console.error("SAP update error:", err?.response?.data || err.message);
      if (err?.response?.status === 401) return logout();
      if (err?.response?.status === 403) return alert("Access denied.");
      alert(err?.response?.data?.message || "Failed to update SAP.");
    } finally {
      setProcessingId("");
    }
  };

  const loanPendingCount = useMemo(
    () => loanRequests.filter((x) => x.status === "Pending").length,
    [loanRequests]
  );

  const sapPendingCount = useMemo(
    () => sapRows.filter((x) => x.status === "Pending").length,
    [sapRows]
  );

  return (
    <div className="approval-page">
      <div className="approval-page-header">
        <div>
          <h2 className="approval-title">Approvals</h2>
          <p className="approval-subtitle">Loan approvals and staff accounts payable</p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {canCreateLoan && (
            <button className="btn-primary" onClick={() => setShowCreateLoan(true)} type="button">
              + Add Loan
            </button>
          )}

          {canCreateSAP && (
            <button className="btn-secondary" onClick={() => setShowCreateSAP(true)} type="button">
              + Staff Accounts Payable
            </button>
          )}
        </div>
      </div>

      <div className="approval-grid">
        <div className="approval-card">
          <div className="approval-card-head">
            <div>
              <div className="approval-card-title">Loan Requests</div>
              <div className="approval-card-meta">
                Pending: <span className="pill">{loanPendingCount}</span>
              </div>
            </div>
            <button className="btn-primary" onClick={() => setShowLoanModal(true)} type="button">
              View
            </button>
          </div>
          <div className="approval-card-body">
            <div className="mini">
              {loadingLoan ? "Loading loan requests..." : "Filter by loan type and view requests."}
            </div>
          </div>
        </div>

        {canViewSAP && (
          <div className="approval-card">
            <div className="approval-card-head">
              <div>
                <div className="approval-card-title">Staff Accounts Payable</div>
                <div className="approval-card-meta">
                  Pending: <span className="pill">{sapPendingCount}</span>
                </div>
              </div>
              <button className="btn-primary" onClick={() => setShowSapModal(true)} type="button">
                View
              </button>
            </div>
            <div className="approval-card-body">
              <div className="mini">
                {loadingSap ? "Loading SAP..." : "Create payable records and approve/reject them."}
              </div>
            </div>
          </div>
        )}
      </div>

      {canCreateLoan && showCreateLoan && (
        <div
          className="modal-overlay"
          onMouseDown={(e) => e.target.classList.contains("modal-overlay") && setShowCreateLoan(false)}
        >
          <div className="modal saas-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h3 className="modal-title">Add Loan Request</h3>
                <p className="modal-subtitle">This request will be submitted with status: Pending</p>
              </div>
              <button className="modal-x" type="button" onClick={() => setShowCreateLoan(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateLoan} className="modal-form">
              <div className="modal-grid">
                <div className="form-group">
                  <label>Employee</label>
                  <select
                    value={loanForm.staff_id}
                    onChange={(e) => handleLoanEmployeeSelect(e.target.value)}
                    required
                  >
                    <option value="">Select Employee</option>
                    {renderEmployeeOptions()}
                  </select>
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
                    <option value="Cash Loan">Cash Advance</option>
                    <option value="Special Loan">Special Loan</option>
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

                <div className="form-group">
                  <label>Approved Date (Optional)</label>
                  <input
                    type="date"
                    value={loanForm.approved_at}
                    onChange={(e) => setLoanForm((p) => ({ ...p, approved_at: e.target.value }))}
                  />
                </div>

                <div className="form-group">
                  <label>Disbursement Date (Optional)</label>
                  <input
                    type="date"
                    value={loanForm.disbursement_date}
                    onChange={(e) =>
                      setLoanForm((p) => ({ ...p, disbursement_date: e.target.value }))
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
                <button className="btn-secondary" type="button" onClick={() => setShowCreateLoan(false)}>
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

      {canCreateSAP && showCreateSAP && (
        <div
          className="modal-overlay"
          onMouseDown={(e) => e.target.classList.contains("modal-overlay") && setShowCreateSAP(false)}
        >
          <div className="modal saas-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h3 className="modal-title">Add Staff Accounts Payable</h3>
                <p className="modal-subtitle">Creates a payable record for the employee</p>
              </div>
              <button className="modal-x" type="button" onClick={() => setShowCreateSAP(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSAP} className="modal-form">
              <div className="modal-grid">
                <div className="form-group full">
                  <label>Employee</label>
                  <select
                    value={sapForm.employee_id}
                    onChange={(e) => handleSapEmployeeSelect(e.target.value)}
                    required
                  >
                    <option value="">Select Employee</option>
                    {renderEmployeeOptions()}
                  </select>
                </div>

                <div className="form-group">
                  <label>Employee No</label>
                  <input value={sapForm.employee_no} readOnly placeholder="Auto-filled" />
                </div>

                <div className="form-group">
                  <label>Staff Name</label>
                  <input value={sapForm.staff_name} readOnly placeholder="Auto-filled" />
                </div>

                <div className="form-group full">
                  <label>Description</label>
                  <textarea
                    value={sapForm.description}
                    onChange={(e) => setSapForm((p) => ({ ...p, description: e.target.value }))}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Total Amount</label>
                  <input
                    type="number"
                    value={sapForm.amount}
                    onChange={(e) =>
                      setSapForm((p) => ({
                        ...p,
                        amount: e.target.value,
                        balance:
                          p.balance === "" || String(p.balance) === String(p.amount)
                            ? e.target.value
                            : p.balance,
                      }))
                    }
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Term (Months)</label>
                  <input
                    type="number"
                    value={sapForm.term}
                    onChange={(e) => setSapForm((p) => ({ ...p, term: e.target.value }))}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Balance</label>
                  <input
                    type="number"
                    value={sapForm.balance}
                    onChange={(e) => setSapForm((p) => ({ ...p, balance: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="preview-box">
                <div>
                  <span>Per Month</span>
                  <strong>₱ {sapPreview.per_month.toFixed(2)}</strong>
                </div>
              </div>

              <div className="modal-buttons">
                <button className="btn-secondary" type="button" onClick={() => setShowCreateSAP(false)}>
                  Cancel
                </button>
                <button className="btn-primary" type="submit" disabled={creatingSap}>
                  {creatingSap ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showLoanModal && (
        <div
          className="modal-overlay"
          onMouseDown={(e) => e.target.classList.contains("modal-overlay") && setShowLoanModal(false)}
        >
          <div className="modal saas-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h3 className="modal-title">Loan Requests</h3>
                <p className="modal-subtitle">Filter by type and view requests</p>
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
                      <th>Loan Type</th>
                      <th>Amount</th>
                      <th>Term</th>
                      <th>Interest</th>
                      <th>Per Month</th>
                      <th>Total</th>
                      <th>Status</th>
                      <th>Dates</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLoan.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="empty-state">
                          No requests found.
                        </td>
                      </tr>
                    ) : (
                      filteredLoan.map((item) => (
                        <tr key={item.id}>
                          <td>{item.id ?? "-"}</td>
                          <td className="td-strong">
                            {item.staff_name || staffDisplayName(item.staff_id)}
                            <div style={{ fontSize: 12, opacity: 0.75 }}>
                              Emp No: {item.employee_no || "-"}
                            </div>
                          </td>
                          <td>{item.loan_type}</td>
                          <td>₱ {fmtMoney(item.amount)}</td>
                          <td>{item.term}</td>
                          <td>{item.interest}%</td>
                          <td>₱ {fmtMoney(item.per_month)}</td>
                          <td>₱ {fmtMoney(item.total)}</td>
                          <td>
                            <span className={badgeClass(item.status)}>{item.status}</span>
                          </td>
                          <td style={{ fontSize: 12, opacity: 0.85 }}>
                            <div>Approved: {fmtDate(item.approved_at)}</div>
                            <div>Disbursed: {fmtDate(item.disbursement_date)}</div>
                          </td>
                          <td>
                            {canApproveLoan && item.status === "Pending" ? (
                              <div className="row-actions">
                                <button
                                  className="btn-success"
                                  onClick={() => updateLoanStatus(item.id, "Approved")}
                                  type="button"
                                  disabled={processingId === `loan-${item.id}-Approved`}
                                >
                                  {processingId === `loan-${item.id}-Approved` ? "Approving..." : "Approve"}
                                </button>
                                <button
                                  className="btn-danger"
                                  onClick={() => updateLoanStatus(item.id, "Rejected")}
                                  type="button"
                                  disabled={processingId === `loan-${item.id}-Rejected`}
                                >
                                  {processingId === `loan-${item.id}-Rejected` ? "Rejecting..." : "Reject"}
                                </button>
                              </div>
                            ) : (
                              "-"
                            )}
                          </td>
                        </tr>
                      ))
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

      {canViewSAP && showSapModal && (
        <div
          className="modal-overlay"
          onMouseDown={(e) => e.target.classList.contains("modal-overlay") && setShowSapModal(false)}
        >
          <div className="modal saas-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h3 className="modal-title">Staff Accounts Payable</h3>
                <p className="modal-subtitle">Approve/Reject is Admin only</p>
              </div>
              <button className="modal-x" type="button" onClick={() => setShowSapModal(false)}>
                ✕
              </button>
            </div>

            <div className="table-card">
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Employee</th>
                      <th>Description</th>
                      <th>Amount</th>
                      <th>Term</th>
                      <th>Per Month</th>
                      <th>Balance</th>
                      <th>Status</th>
                      <th>Dates</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sapRows.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="empty-state">
                          No SAP records found.
                        </td>
                      </tr>
                    ) : (
                      sapRows.map((x) => (
                        <tr key={x.id ?? `${x.employee_id}-${x.description}`}>
                          <td>{x.id ?? "-"}</td>
                          <td className="td-strong">
                            {x.staff_name || staffDisplayName(x.employee_id)}
                            <div style={{ fontSize: 12, opacity: 0.8 }}>
                              Employee ID: {x.employee_id || "-"} • Employee No: {x.employee_no || "-"}
                            </div>
                          </td>
                          <td title={x.description || ""}>{x.description || "-"}</td>
                          <td>₱ {fmtMoney(x.amount)}</td>
                          <td>{x.term}</td>
                          <td>₱ {fmtMoney(x.per_month)}</td>
                          <td>₱ {fmtMoney(x.balance)}</td>
                          <td>
                            <span className={badgeClass(x.status)}>{x.status}</span>
                          </td>
                          <td style={{ fontSize: 12, opacity: 0.85 }}>
                            <div>Approved: {fmtDate(x.approved_at)}</div>
                            <div>Rejected: {fmtDate(x.rejected_at)}</div>
                          </td>
                          <td>
                            {x.status === "Pending" ? (
                              isAdmin ? (
                                <div className="row-actions">
                                  <button
                                    className="btn-success"
                                    onClick={() => updateSapStatus(x.id, "Approved")}
                                    type="button"
                                    disabled={processingId === `sap-${x.id}-Approved`}
                                  >
                                    {processingId === `sap-${x.id}-Approved` ? "Approving..." : "Approve"}
                                  </button>
                                  <button
                                    className="btn-danger"
                                    onClick={() => {
                                      const reason = window.prompt("Reason for rejection?");
                                      if (!reason || !String(reason).trim()) {
                                        alert("Rejection reason is required.");
                                        return;
                                      }
                                      updateSapStatus(x.id, "Rejected", String(reason).trim());
                                    }}
                                    type="button"
                                    disabled={processingId === `sap-${x.id}-Rejected`}
                                  >
                                    {processingId === `sap-${x.id}-Rejected` ? "Rejecting..." : "Reject"}
                                  </button>
                                </div>
                              ) : (
                                "-"
                              )
                            ) : (
                              "-"
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="modal-buttons">
              <button className="btn-secondary" type="button" onClick={() => setShowSapModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}