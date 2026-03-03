import React, { useEffect, useMemo, useState, useCallback } from "react";
import "../styles/Approval.css";
import api from "../api/axiosClient";

const loanTypes = ["All", "Salary Advance", "Special Loan", "Cash Loan", "Motorcycle Loan"];

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

const Approval = () => {
  const user = useMemo(() => readUser(), []);
  const isAdmin = String(user?.role || "").trim().toLowerCase() === "admin";
  const [loanRequests, setLoanRequests] = useState([]);
  const [selectedLoanType, setSelectedLoanType] = useState("All");
  const [showLoanModal, setShowLoanModal] = useState(false);
  const [showSapModal, setShowSapModal] = useState(false);
  const [showCreateLoan, setShowCreateLoan] = useState(false);
  const [showCreateSAP, setShowCreateSAP] = useState(false);
  const [staffList, setStaffList] = useState([]);
  const [branches, setBranches] = useState([]);
  const [sapRows, setSapRows] = useState([]);
  const [creating, setCreating] = useState(false);
  const [loadingLoan, setLoadingLoan] = useState(false);
  const [loadingSap, setLoadingSap] = useState(false);
  const [loanForm, setLoanForm] = useState({
    employee_id: "",
    staff_name: "",
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
    staff_name: "",
    description: "",
    amount: "",
    term: "",
    balance: "",
  });

  const [confirmModal, setConfirmModal] = useState({
    show: false,
    requestId: null,
    type: "",
    action: "",
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
        return res.data || [];
      } catch (err) {
        const status = err?.response?.status;
        if (status === 401) logout();
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
      if (err?.response?.status === 401) logout();
      setStaffList([]);
    }
  }, [logout]);

  const fetchBranches = useCallback(async () => {
    try {
      const res = await api.get("/branches");
      setBranches(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      if (err?.response?.status === 401) logout();
      setBranches([]);
    }
  }, [logout]);

  const branchMap = useMemo(() => {
    const m = new Map();
    (branches || []).forEach((b) => m.set(Number(b.id), b));
    return m;
  }, [branches]);

  const fetchLoan = useCallback(async () => {
    const data = await safeGet("/loan-requests", setLoadingLoan);
    setLoanRequests(Array.isArray(data) ? data : []);
  }, [safeGet]);

  const fetchSap = useCallback(async () => {
    const data = await safeGet("/staff-accounts-payable", setLoadingSap);
    setSapRows(Array.isArray(data) ? data : []);
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
    fetchSap();
  }, [user, fetchStaff, fetchBranches, fetchLoan, fetchSap]);

  useEffect(() => {
    const isOpen = showLoanModal || showSapModal || showCreateLoan || showCreateSAP || confirmModal.show;
    if (!isOpen) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        setShowLoanModal(false);
        setShowSapModal(false);
        setShowCreateLoan(false);
        setShowCreateSAP(false);
        setConfirmModal({ show: false, requestId: null, type: "", action: "" });
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [showLoanModal, showSapModal, showCreateLoan, showCreateSAP, confirmModal.show]);

  const badgeClass = (status) => {
    if (status === "Approved") return "badge badge-approved";
    if (status === "Rejected") return "badge badge-rejected";
    return "badge badge-pending";
  };

  const renderEmployeeOptions = () =>
    staffList.map((s) => (
      <option key={s.id} value={s.id}>
        {(s.employee_no ? `${s.employee_no} - ` : "") + s.fullname}
      </option>
    ));

  const filteredLoan = useMemo(() => {
    return loanRequests.filter((item) => (selectedLoanType === "All" ? true : item.loan_type === selectedLoanType));
  }, [loanRequests, selectedLoanType]);

  const loanPreview = useMemo(() => {
    const amount = toNum(loanForm.amount);
    const interest = toNum(loanForm.interest);
    const term = Math.max(1, toNum(loanForm.term));
    const total = amount + (amount * interest) / 100;
    const per_month = total / term;
    return { total, per_month };
  }, [loanForm.amount, loanForm.interest, loanForm.term]);

  const sapPreview = useMemo(() => {
    const amount = toNum(sapForm.amount);
    const term = Math.max(1, toNum(sapForm.term));
    const per_month = term > 0 ? amount / term : 0;
    return { per_month };
  }, [sapForm.amount, sapForm.term]);

  const handleLoanEmployeeSelect = (employeeId) => {
    const emp = staffList.find((s) => String(s.id) === String(employeeId));
    const bid = emp?.branch_id ? Number(emp.branch_id) : null;
    const b = bid ? branchMap.get(bid) : null;

    setLoanForm((prev) => ({
      ...prev,
      employee_id: employeeId,
      staff_name: emp?.fullname || "",
      branch_id: bid ? String(bid) : "",
      branch_code: b?.code || "",
      branch_name: b?.name || "",
    }));
  };

  const handleSapEmployeeSelect = (employeeId) => {
    const emp = staffList.find((s) => String(s.id) === String(employeeId));
    setSapForm((prev) => ({
      ...prev,
      employee_id: employeeId,
      staff_name: emp?.fullname || "",
    }));
  };

  const handleCreateLoan = async (e) => {
    e.preventDefault();

    const amount = toNum(loanForm.amount);
    const interest = toNum(loanForm.interest);
    const term = Math.max(1, toNum(loanForm.term));
    const total = amount + (amount * interest) / 100;
    const per_month = total / term;

    try {
      setCreating(true);

      await api.post("/loan-requests", {
        employee_id: loanForm.employee_id,
        staff_name: loanForm.staff_name,

        branch_id: loanForm.branch_id ? Number(loanForm.branch_id) : null,
        branch_code: loanForm.branch_code,
        branch_name: loanForm.branch_name,

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

      alert("Loan request submitted!");
      setLoanForm({
        employee_id: "",
        staff_name: "",
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

      setShowCreateLoan(false);
      await fetchLoan();
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401) return logout();
      alert(err?.response?.data?.message || "Failed to submit loan request.");
    } finally {
      setCreating(false);
    }
  };

  const handleCreateSAP = async (e) => {
    e.preventDefault();

    const amount = toNum(sapForm.amount);
    const term = Math.max(1, toNum(sapForm.term));
    const per_month = term > 0 ? amount / term : 0;
    const balance = toNum(sapForm.balance) || amount;

    try {
      setCreating(true);

      await api.post("/staff-accounts-payable", {
        employee_id: sapForm.employee_id,
        staff_name: sapForm.staff_name,
        description: sapForm.description,
        amount,
        term,
        per_month,
        balance,
      });

      alert("Staff Accounts Payable added!");
      setSapForm({
        employee_id: "",
        staff_name: "",
        description: "",
        amount: "",
        term: "",
        balance: "",
      });

      setShowCreateSAP(false);
      await fetchSap();
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401) return logout();
      alert(err?.response?.data?.message || "Failed to add Staff Accounts Payable.");
    } finally {
      setCreating(false);
    }
  };

  const updateLoanStatus = async (id, status) => {
    try {
      await api.put(`/loan-requests/${id}`, { status });
      await fetchLoan();
    } catch (err) {
      const code = err?.response?.status;
      if (code === 401) return logout();
      if (code === 403) return alert("Access denied.");
      alert(err?.response?.data?.message || "Failed to update loan request");
    }
  };

  const updateSapStatus = async (id, status, reason = "") => {
    try {
      await api.put(`/staff-accounts-payable/${id}`, { status, reason });
      await fetchSap();
    } catch (err) {
      const code = err?.response?.status;
      if (code === 401) return logout();
      if (code === 403) return alert("Access denied.");
      alert(err?.response?.data?.message || "Failed to update SAP.");
    }
  };

  const handleActionClick = (id, type, action) => {
    setConfirmModal({ show: true, requestId: id, type, action });
  };

  const confirmAction = async () => {
    const { requestId, action, type } = confirmModal;
    setConfirmModal({ show: false, requestId: null, type: "", action: "" });
    if (!requestId) return;

    if (type === "loan") {
      await updateLoanStatus(requestId, action);
      return;
    }

    if (type === "sap") {
      if (action === "Approved") {
        await updateSapStatus(requestId, "Approved");
        return;
      }
      const reason = window.prompt("Reason for rejection?");
      if (!reason) return;
      await updateSapStatus(requestId, "Rejected", reason);
    }
  };

  const loanPendingCount = useMemo(() => loanRequests.filter((x) => x.status === "Pending").length, [loanRequests]);
  const sapPendingCount = useMemo(() => sapRows.filter((x) => x.status === "Pending").length, [sapRows]);

  return (
    <div className="approval-page">
      <div className="approval-page-header">
        <div>
          <h2 className="approval-title">Approvals</h2>
          <p className="approval-subtitle">Loan approvals + create loan / staff payable</p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="btn-primary" onClick={() => setShowCreateLoan(true)} type="button">
            + Add Loan
          </button>
          <button className="btn-secondary" onClick={() => setShowCreateSAP(true)} type="button">
            + Staff Accounts Payable
          </button>
        </div>
      </div>

      <div className="approval-grid">

        {/* LOANS CARD */}
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
            <div className="mini">{loadingLoan ? "Loading loan requests…" : "Filter by loan type • Approve/Reject with confirmation"}</div>
          </div>
        </div>

        {/* SAP CARD */}
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
            <div className="mini">{loadingSap ? "Loading SAP…" : "Create payable record • Approve/Reject is Admin only"}</div>
          </div>
        </div>
      </div>

      {/* CREATE LOAN MODAL */}
      {showCreateLoan && (
        <div className="modal-overlay" onMouseDown={(e) => e.target.classList.contains("modal-overlay") && setShowCreateLoan(false)}>
          <div className="modal saas-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h3 className="modal-title">Add Loan Request</h3>
                <p className="modal-subtitle">This will be submitted with status: Pending</p>
              </div>
              <button className="modal-x" type="button" onClick={() => setShowCreateLoan(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateLoan} className="modal-form">
              <div className="modal-grid">
                <div className="form-group">
                  <label>Employee</label>
                  <select value={loanForm.employee_id} onChange={(e) => handleLoanEmployeeSelect(e.target.value)} required>
                    <option value="">Select Employee</option>
                    {renderEmployeeOptions()}
                  </select>
                </div>

                <div className="form-group">
                  <label>Branch</label>
                  <input
                    value={loanForm.branch_code || loanForm.branch_name ? `${loanForm.branch_code} - ${loanForm.branch_name}` : ""}
                    readOnly
                    placeholder="Auto-filled"
                  />
                </div>

                <div className="form-group">
                  <label>Loan Type</label>
                  <select value={loanForm.loan_type} onChange={(e) => setLoanForm((p) => ({ ...p, loan_type: e.target.value }))} required>
                    <option value="">Select Loan Type</option>
                    <option value="Motorcycle Loan">Motorcycle Loan</option>
                    <option value="Salary Advance">Salary Advance</option>
                    <option value="Cash Loan">Cash Loan</option>
                    <option value="Special Loan">Special Loan</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Amount</label>
                  <input type="number" value={loanForm.amount} onChange={(e) => setLoanForm((p) => ({ ...p, amount: e.target.value }))} required />
                </div>

                <div className="form-group">
                  <label>Term (Months)</label>
                  <input type="number" value={loanForm.term} onChange={(e) => setLoanForm((p) => ({ ...p, term: e.target.value }))} required />
                </div>

                <div className="form-group">
                  <label>Interest (%)</label>
                  <input type="number" value={loanForm.interest} onChange={(e) => setLoanForm((p) => ({ ...p, interest: e.target.value }))} required />
                </div>

                <div className="form-group">
                  <label>Approved Date (Optional)</label>
                  <input type="date" value={loanForm.approved_at} onChange={(e) => setLoanForm((p) => ({ ...p, approved_at: e.target.value }))} />
                </div>

                <div className="form-group">
                  <label>Disbursement Date (Optional)</label>
                  <input type="date" value={loanForm.disbursement_date} onChange={(e) => setLoanForm((p) => ({ ...p, disbursement_date: e.target.value }))} />
                </div>

                <div className="form-group full">
                  <label>Reason</label>
                  <textarea value={loanForm.reason} onChange={(e) => setLoanForm((p) => ({ ...p, reason: e.target.value }))} required />
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
                <button className="btn-primary" type="submit" disabled={creating}>
                  {creating ? "Submitting..." : "Submit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE SAP MODAL */}
      {showCreateSAP && (
        <div className="modal-overlay" onMouseDown={(e) => e.target.classList.contains("modal-overlay") && setShowCreateSAP(false)}>
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
                  <select value={sapForm.employee_id} onChange={(e) => handleSapEmployeeSelect(e.target.value)} required>
                    <option value="">Select Employee</option>
                    {renderEmployeeOptions()}
                  </select>
                </div>

                <div className="form-group full">
                  <label>Description</label>
                  <textarea value={sapForm.description} onChange={(e) => setSapForm((p) => ({ ...p, description: e.target.value }))} required />
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
                        balance: p.balance === "" || String(p.balance) === String(p.amount) ? e.target.value : p.balance,
                      }))
                    }
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Term (Months)</label>
                  <input type="number" value={sapForm.term} onChange={(e) => setSapForm((p) => ({ ...p, term: e.target.value }))} required />
                </div>

                <div className="form-group">
                  <label>Balance</label>
                  <input type="number" value={sapForm.balance} onChange={(e) => setSapForm((p) => ({ ...p, balance: e.target.value }))} required />
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
                <button className="btn-primary" type="submit" disabled={creating}>
                  {creating ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LOAN VIEW MODAL */}
      {showLoanModal && (
        <div className="modal-overlay" onMouseDown={(e) => e.target.classList.contains("modal-overlay") && setShowLoanModal(false)}>
          <div className="modal saas-modal">
            <div className="modal-head">
              <div>
                <h3 className="modal-title">Loan Requests</h3>
                <p className="modal-subtitle">Filter by type, then approve or reject</p>
              </div>
              <button className="modal-x" type="button" onClick={() => setShowLoanModal(false)}>
                ✕
              </button>
            </div>

            <div className="filters">
              {loanTypes.map((t) => (
                <button key={t} className={`chip ${selectedLoanType === t ? "active" : ""}`} onClick={() => setSelectedLoanType(t)} type="button">
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
                      <th>Name</th>
                      <th>Loan Type</th>
                      <th>Amount</th>
                      <th>Term</th>
                      <th>Interest</th>
                      <th>Per Month</th>
                      <th>Total</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredLoan.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="empty-state">
                          No requests found.
                        </td>
                      </tr>
                    ) : (
                      filteredLoan.map((item) => (
                        <tr key={item.id}>
                          <td>{item.id}</td>
                          <td className="td-strong">{item.staff_name}</td>
                          <td>{item.loan_type}</td>
                          <td>₱ {Number(item.amount || 0).toLocaleString()}</td>
                          <td>{item.term}</td>
                          <td>{item.interest}%</td>
                          <td>₱ {Number(item.per_month || 0).toLocaleString()}</td>
                          <td>₱ {Number(item.total || 0).toLocaleString()}</td>
                          <td>
                            <span className={badgeClass(item.status)}>{item.status}</span>
                          </td>
                          <td>
                            {item.status === "Pending" ? (
                              <div className="row-actions">
                                <button className="btn-success" onClick={() => handleActionClick(item.id, "loan", "Approved")} type="button">
                                  Approve
                                </button>
                                <button className="btn-danger" onClick={() => handleActionClick(item.id, "loan", "Rejected")} type="button">
                                  Reject
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

      {/* SAP VIEW MODAL */}
      {showSapModal && (
        <div className="modal-overlay" onMouseDown={(e) => e.target.classList.contains("modal-overlay") && setShowSapModal(false)}>
          <div className="modal saas-modal">
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
                      <th>Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {sapRows.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="empty-state">
                          No SAP records found.
                        </td>
                      </tr>
                    ) : (
                      sapRows.map((x) => (
                        <tr key={x.id}>
                          <td>{x.id}</td>
                          <td className="td-strong">
                            {x.staff_name || "-"}
                            <div style={{ fontSize: 12, opacity: 0.8 }}>Employee ID: {x.employee_id || "-"}</div>
                          </td>
                          <td title={x.description || ""}>{x.description || "-"}</td>
                          <td>₱ {Number(x.amount || 0).toLocaleString()}</td>
                          <td>{x.term}</td>
                          <td>₱ {Number(x.per_month || 0).toLocaleString()}</td>
                          <td>₱ {Number(x.balance || 0).toLocaleString()}</td>
                          <td>
                            <span className={badgeClass(x.status)}>{x.status}</span>
                          </td>
                          <td>
                            {x.status === "Pending" ? (
                              isAdmin ? (
                                <div className="row-actions">
                                  <button className="btn-success" onClick={() => handleActionClick(x.id, "sap", "Approved")} type="button">
                                    Approve
                                  </button>
                                  <button className="btn-danger" onClick={() => handleActionClick(x.id, "sap", "Rejected")} type="button">
                                    Reject
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

      {/* CONFIRM MODAL (Loan + SAP) */}
      {confirmModal.show && (
        <div
          className="modal-overlay"
          onMouseDown={(e) => e.target.classList.contains("modal-overlay") && setConfirmModal({ show: false, requestId: null, type: "", action: "" })}
        >
          <div className="modal confirm-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h3 className="modal-title">Confirm {confirmModal.action}</h3>
                <p className="modal-subtitle">
                  Are you sure you want to {String(confirmModal.action).toLowerCase()} this {confirmModal.type === "sap" ? "SAP" : "loan"} request?
                </p>
              </div>
              <button className="modal-x" type="button" onClick={() => setConfirmModal({ show: false, requestId: null, type: "", action: "" })}>
                ✕
              </button>
            </div>

            <div className="modal-buttons">
              <button className="btn-secondary" type="button" onClick={() => setConfirmModal({ show: false, requestId: null, type: "", action: "" })}>
                Cancel
              </button>
              <button className="btn-primary" type="button" onClick={confirmAction}>
                Yes, {confirmModal.action}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Approval;