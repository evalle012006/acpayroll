import React, { useEffect, useMemo, useState, useCallback } from "react";
import "../styles/Approval.css";
import api from "../api/axiosClient";

const leaveTypes = [
  "All",
  "Annual Leave",
  "Sick Leave",
  "Maternity Leave",
  "Paternity Leave",
  "Emergency Leave",
  "Indefinite Leave",
];

const loanTypes = ["All", "Salary Advance", "Special Loan", "Cash Loan", "Motorcycle Loan"];

const readUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
};

const Approval = () => {
  const user = useMemo(() => readUser(), []);

  const [leaveRequests, setLeaveRequests] = useState([]);
  const [loanRequests, setLoanRequests] = useState([]);

  const [transferOrders, setTransferOrders] = useState([]);
  const [loadingTransfer, setLoadingTransfer] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);

  const [selectedLeaveType, setSelectedLeaveType] = useState("All");
  const [selectedLoanType, setSelectedLoanType] = useState("All");

  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showLoanModal, setShowLoanModal] = useState(false);

  const [confirmModal, setConfirmModal] = useState({
    show: false,
    requestId: null,
    type: "",
    action: "",
  });

  const [loadingLeave, setLoadingLeave] = useState(false);
  const [loadingLoan, setLoadingLoan] = useState(false);

  const isAdmin = String(user?.role || "").trim().toLowerCase() === "admin";

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

  const fetchLeave = useCallback(async () => {
    const data = await safeGet("/leave-requests", setLoadingLeave);
    setLeaveRequests(data);
  }, [safeGet]);

  const fetchLoan = useCallback(async () => {
    const data = await safeGet("/loan-requests", setLoadingLoan);
    setLoanRequests(data);
  }, [safeGet]);

  const fetchTransfer = useCallback(async () => {
    const data = await safeGet("/transfer-staff-orders", setLoadingTransfer);
    setTransferOrders(data);
  }, [safeGet]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!user || !token) {
      window.location.href = "/login";
      return;
    }
    fetchLeave();
    fetchLoan();

    fetchTransfer();
  }, [user, fetchLeave, fetchLoan, fetchTransfer]);

  useEffect(() => {
    const isOpen = showLeaveModal || showLoanModal || showTransferModal || confirmModal.show;
    if (!isOpen) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        setShowLeaveModal(false);
        setShowLoanModal(false);

        setShowTransferModal(false);

        setConfirmModal({ show: false, requestId: null, type: "", action: "" });
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [showLeaveModal, showLoanModal, showTransferModal, confirmModal.show]);

  const updateLeaveStatus = async (id, status) => {
    try {
      await api.put(`/leave-requests/${id}`, { status });
      await fetchLeave();
    } catch (err) {
      const code = err?.response?.status;
      if (code === 401) return logout();
      if (code === 403) return alert("Access denied.");
      alert(err?.response?.data?.message || "Failed to update leave request");
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

  const approveTransfer = async (id) => {
    try {
      await api.put(`/transfer-staff-orders/${id}/approve`);
      await fetchTransfer();
    } catch (err) {
      const code = err?.response?.status;
      if (code === 401) return logout();
      if (code === 403) return alert("Access denied.");
      alert(err?.response?.data?.message || "Failed to approve transfer order");
    }
  };

  const rejectTransfer = async (id) => {
    const reason = prompt("Enter rejection reason:");
    if (!reason || !reason.trim()) return;

    try {
      await api.put(`/transfer-staff-orders/${id}/reject`, { reason: reason.trim() });
      await fetchTransfer();
    } catch (err) {
      const code = err?.response?.status;
      if (code === 401) return logout();
      if (code === 403) return alert("Access denied.");
      alert(err?.response?.data?.message || "Failed to reject transfer order");
    }
  };

  const handleActionClick = (id, type, action) => {
    setConfirmModal({ show: true, requestId: id, type, action });
  };

  const confirmAction = async () => {
    const { requestId, type, action } = confirmModal;
    setConfirmModal({ show: false, requestId: null, type: "", action: "" });
    if (!requestId) return;

    if (type === "leave") await updateLeaveStatus(requestId, action);
    else await updateLoanStatus(requestId, action);
  };

  const filteredLeave = useMemo(() => {
    return leaveRequests.filter((item) =>
      selectedLeaveType === "All" ? true : item.leave_type === selectedLeaveType
    );
  }, [leaveRequests, selectedLeaveType]);

  const filteredLoan = useMemo(() => {
    return loanRequests.filter((item) =>
      selectedLoanType === "All" ? true : item.loan_type === selectedLoanType
    );
  }, [loanRequests, selectedLoanType]);

  const pendingTransfer = useMemo(() => {
    return (transferOrders || []).filter(
      (o) => String(o.status || "").trim().toLowerCase() === "pending"
    );
  }, [transferOrders]);

  const badgeClass = (status) => {
    if (status === "Approved") return "badge badge-approved";
    if (status === "Rejected") return "badge badge-rejected";
    return "badge badge-pending";
  };

  return (
    <div className="approval-page">
      <div className="approval-page-header">
        <div>
          <h2 className="approval-title">Approvals</h2>
          <p className="approval-subtitle">Review and approve leave and loan requests</p>
        </div>
      </div>

      <div className="approval-grid">
        {/* LEAVE CARD (UNCHANGED) */}
        <div className="approval-card">
          <div className="approval-card-head">
            <div>
              <div className="approval-card-title">Leave Requests</div>
              <div className="approval-card-meta">
                Pending:{" "}
                <span className="pill">{leaveRequests.filter((x) => x.status === "Pending").length}</span>
              </div>
            </div>

            <button className="btn-primary" onClick={() => setShowLeaveModal(true)} type="button">
              View
            </button>
          </div>

          <div className="approval-card-body">
            <div className="mini">
              {loadingLeave ? "Loading leave requests…" : "Filter in modal • Approve/Reject with confirmation"}
            </div>
          </div>
        </div>

        {/* LOAN CARD (UNCHANGED) */}
        <div className="approval-card">
          <div className="approval-card-head">
            <div>
              <div className="approval-card-title">Loan Requests</div>
              <div className="approval-card-meta">
                Pending:{" "}
                <span className="pill">{loanRequests.filter((x) => x.status === "Pending").length}</span>
              </div>
            </div>

            <button className="btn-primary" onClick={() => setShowLoanModal(true)} type="button">
              View
            </button>
          </div>

          <div className="approval-card-body">
            <div className="mini">
              {loadingLoan ? "Loading loan requests…" : "Filter by loan type • View amounts, terms, totals"}
            </div>
          </div>
        </div>

        {isAdmin && (
          <div className="approval-card">
            <div className="approval-card-head">
              <div>
                <div className="approval-card-title">Transfer Orders</div>
                <div className="approval-card-meta">
                  Pending: <span className="pill">{pendingTransfer.length}</span>
                </div>
              </div>

              <button className="btn-primary" onClick={() => setShowTransferModal(true)} type="button">
                View
              </button>
            </div>

            <div className="approval-card-body">
              <div className="mini">
                {loadingTransfer ? "Loading transfer orders…" : "Lists only pending transfer orders • Approve/Reject"}
              </div>
            </div>
          </div>
        )}
      </div>

      {showLeaveModal && (
        <div
          className="modal-overlay"
          onMouseDown={(e) => e.target.classList.contains("modal-overlay") && setShowLeaveModal(false)}
        >
          <div className="modal saas-modal">
            <div className="modal-head">
              <div>
                <h3 className="modal-title">Leave Requests</h3>
                <p className="modal-subtitle">Filter by type, then approve or reject</p>
              </div>
              <button className="modal-x" type="button" onClick={() => setShowLeaveModal(false)}>
                ✕
              </button>
            </div>

            <div className="filters">
              {leaveTypes.map((t) => (
                <button
                  key={t}
                  className={`chip ${selectedLeaveType === t ? "active" : ""}`}
                  onClick={() => setSelectedLeaveType(t)}
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
                      <th>Name</th>
                      <th>Type</th>
                      <th>Start</th>
                      <th>End</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredLeave.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="empty-state">
                          No requests found.
                        </td>
                      </tr>
                    ) : (
                      filteredLeave.map((item) => (
                        <tr key={item.id}>
                          <td>{item.id}</td>
                          <td className="td-strong">{item.staff_name}</td>
                          <td>{item.leave_type}</td>
                          <td>{String(item.start_date || "").split("T")[0]}</td>
                          <td>{String(item.end_date || "").split("T")[0]}</td>
                          <td>
                            <span className={badgeClass(item.status)}>{item.status}</span>
                          </td>
                          <td>
                            {item.status === "Pending" ? (
                              <div className="row-actions">
                                <button
                                  className="btn-success"
                                  onClick={() => handleActionClick(item.id, "leave", "Approved")}
                                  type="button"
                                >
                                  Approve
                                </button>
                                <button
                                  className="btn-danger"
                                  onClick={() => handleActionClick(item.id, "leave", "Rejected")}
                                  type="button"
                                >
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
              <button className="btn-secondary" type="button" onClick={() => setShowLeaveModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showLoanModal && (
        <div
          className="modal-overlay"
          onMouseDown={(e) => e.target.classList.contains("modal-overlay") && setShowLoanModal(false)}
        >
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
                                <button
                                  className="btn-success"
                                  onClick={() => handleActionClick(item.id, "loan", "Approved")}
                                  type="button"
                                >
                                  Approve
                                </button>
                                <button
                                  className="btn-danger"
                                  onClick={() => handleActionClick(item.id, "loan", "Rejected")}
                                  type="button"
                                >
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

      {showTransferModal && (
        <div
          className="modal-overlay"
          onMouseDown={(e) => e.target.classList.contains("modal-overlay") && setShowTransferModal(false)}
        >
          <div className="modal saas-modal">
            <div className="modal-head">
              <div>
                <h3 className="modal-title">Transfer Orders</h3>
                <p className="modal-subtitle">Pending transfer orders only</p>
              </div>
              <button className="modal-x" type="button" onClick={() => setShowTransferModal(false)}>
                ✕
              </button>
            </div>

            <div className="table-card">
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Order No</th>
                      <th>Employee</th>
                      <th>From</th>
                      <th>To</th>
                      <th>Division</th>
                      <th>Area</th>
                      <th>Date Created</th>
                      <th>Effective Date</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {pendingTransfer.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="empty-state">
                          No pending transfer orders.
                        </td>
                      </tr>
                    ) : (
                      pendingTransfer.map((o) => (
                        <tr key={o.id}>
                          <td className="td-strong">{o.order_no}</td>
                          <td>{o.employee_name}</td>
                          <td>
                            {o.prev_branch_code} - {o.prev_branch_name}
                          </td>
                          <td>
                            {o.to_branch_code} - {o.to_branch_name}
                          </td>
                          <td>{o.division}</td>
                          <td>{o.area}</td>
                          <td>{String(o.date_created).slice(0, 10)}</td>
                          <td>{String(o.effective_date).slice(0, 10)}</td>
                          <td>
                            <span className={badgeClass(o.status)}>{o.status}</span>
                          </td>
                          <td>
                            <div className="row-actions">
                              <button className="btn-success" type="button" onClick={() => approveTransfer(o.id)}>
                                Approve
                              </button>
                              <button className="btn-danger" type="button" onClick={() => rejectTransfer(o.id)}>
                                Reject
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="modal-buttons">
              <button className="btn-secondary" type="button" onClick={() => setShowTransferModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmModal.show && (
        <div
          className="modal-overlay"
          onMouseDown={(e) =>
            e.target.classList.contains("modal-overlay") &&
            setConfirmModal({ show: false, requestId: null, type: "", action: "" })
          }
        >
          <div className="modal confirm-modal">
            <div className="modal-head">
              <div>
                <h3 className="modal-title">Confirm {confirmModal.action}</h3>
                <p className="modal-subtitle">
                  Are you sure you want to {String(confirmModal.action).toLowerCase()} this{" "}
                  {confirmModal.type} request?
                </p>
              </div>
              <button
                className="modal-x"
                type="button"
                onClick={() => setConfirmModal({ show: false, requestId: null, type: "", action: "" })}
              >
                ✕
              </button>
            </div>

            <div className="modal-buttons">
              <button
                className="btn-secondary"
                type="button"
                onClick={() => setConfirmModal({ show: false, requestId: null, type: "", action: "" })}
              >
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