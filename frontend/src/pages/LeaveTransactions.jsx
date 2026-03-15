import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/LeaveTransactions.css";
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

const readUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
};

const fmtDate = (d) => (d ? String(d).split("T")[0] : "-");

export default function LeaveTransactions() {
  const navigate = useNavigate();
  const user = useMemo(() => readUser(), []);
  const isAdmin = String(user?.role || "").trim().toLowerCase() === "admin";

  const [staffList, setStaffList] = useState([]);
  const [branches, setBranches] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);

  const [loadingCreate, setLoadingCreate] = useState(false);
  const [loadingList, setLoadingList] = useState(false);

  const [selectedLeaveType, setSelectedLeaveType] = useState("All");
  const [showCreateLeave, setShowCreateLeave] = useState(false);

  const [leaveForm, setLeaveForm] = useState({
    employee_id: "",
    staff_name: "",
    branch_id: "",
    branch_code: "",
    branch_name: "",
    leave_type: "",
    start_date: "",
    end_date: "",
    reason: "",
  });

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/login";
  }, []);

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

  const fetchLeave = useCallback(async () => {
    try {
      setLoadingList(true);
      const res = await api.get("/leave-requests");
      setLeaveRequests(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      if (err?.response?.status === 401) logout();
      setLeaveRequests([]);
    } finally {
      setLoadingList(false);
    }
  }, [logout]);

  const handleRefresh = useCallback(async () => {
    await Promise.all([fetchStaff(), fetchBranches(), fetchLeave()]);
  }, [fetchStaff, fetchBranches, fetchLeave]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!user || !token) {
      window.location.href = "/login";
      return;
    }
    fetchStaff();
    fetchBranches();
    fetchLeave();
  }, [user, fetchStaff, fetchBranches, fetchLeave]);

  useEffect(() => {
    if (!showCreateLeave) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") setShowCreateLeave(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [showCreateLeave]);

  const renderEmployeeOptions = () =>
    staffList.map((s) => (
      <option key={s.id} value={s.id}>
        {(s.employee_no ? `${s.employee_no} - ` : "") + s.fullname}
      </option>
    ));

  const handleLeaveEmployeeSelect = (employeeId) => {
    const emp = staffList.find((s) => String(s.id) === String(employeeId));
    const bid = emp?.branch_id ? Number(emp.branch_id) : null;
    const b = bid ? branchMap.get(bid) : null;

    setLeaveForm((prev) => ({
      ...prev,
      employee_id: employeeId,
      staff_name: emp?.fullname || "",
      branch_id: bid ? String(bid) : "",
      branch_code: b?.code || "",
      branch_name: b?.name || "",
    }));
  };

  const resetForm = () => {
    setLeaveForm({
      employee_id: "",
      staff_name: "",
      branch_id: "",
      branch_code: "",
      branch_name: "",
      leave_type: "",
      start_date: "",
      end_date: "",
      reason: "",
    });
  };

  const handleCreateLeave = async (e) => {
    e.preventDefault();

    if (!leaveForm.employee_id) return alert("Select an employee.");
    if (!leaveForm.leave_type) return alert("Select leave type.");
    if (!leaveForm.start_date || !leaveForm.end_date)
      return alert("Select start/end date.");
    if (String(leaveForm.start_date) > String(leaveForm.end_date)) {
      return alert("Start date must be on or before end date.");
    }

    try {
      setLoadingCreate(true);

      await api.post("/leave-requests", {
        employee_id: leaveForm.employee_id,
        leave_type: leaveForm.leave_type,
        start_date: leaveForm.start_date,
        end_date: leaveForm.end_date,
      });

      alert("Leave request submitted!");
      resetForm();
      setShowCreateLeave(false);
      await fetchLeave();
    } catch (err) {
      if (err?.response?.status === 401) return logout();
      alert(err?.response?.data?.message || "Failed to submit leave request.");
    } finally {
      setLoadingCreate(false);
    }
  };

  const updateLeaveStatus = async (id, status) => {
    try {
      await api.put(`/leave-requests/${id}`, { status });
      await fetchLeave();
    } catch (err) {
      if (err?.response?.status === 401) return logout();
      if (err?.response?.status === 403) return alert("Access denied.");
      alert(err?.response?.data?.message || "Failed to update leave request");
    }
  };

  const filteredLeave = useMemo(() => {
    return (leaveRequests || []).filter((x) =>
      selectedLeaveType === "All"
        ? true
        : String(x.leave_type) === selectedLeaveType
    );
  }, [leaveRequests, selectedLeaveType]);

  const badgeClass = (status) => {
    if (status === "Approved") return "badge badge-approved";
    if (status === "Rejected") return "badge badge-rejected";
    return "badge badge-pending";
  };

  return (
    <div className="approval-page">
      <div className="approval-page-header">
        <div>
          <h2 className="approval-title">Leave Transactions</h2>
          <p className="approval-subtitle">Create and manage leave requests</p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            className="btn-secondary"
            onClick={() => navigate(-1)}
            type="button"
          >
            ← Back
          </button>

          <button
            className="btn-secondary"
            onClick={handleRefresh}
            type="button"
            disabled={loadingList}
          >
            {loadingList ? "Refreshing..." : "Refresh"}
          </button>

          <button
            className="btn-primary"
            onClick={() => setShowCreateLeave(true)}
            type="button"
          >
            + Add Leave
          </button>
        </div>
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
                <th>Code</th>
                <th>Name</th>
                <th>Type</th>
                <th>Start</th>
                <th>End</th>
                <th>Status</th>
                <th style={{ width: 220 }}>Action</th>
              </tr>
            </thead>

            <tbody>
              {loadingList ? (
                <tr>
                  <td colSpan={7} className="empty-state">
                    Loading…
                  </td>
                </tr>
              ) : filteredLeave.length === 0 ? (
                <tr>
                  <td colSpan={7} className="empty-state">
                    No requests found.
                  </td>
                </tr>
              ) : (
                filteredLeave.map((item) => (
                  <tr key={item.id}>
                    <td>{item.id}</td>
                    <td className="td-strong">{item.staff_name || "-"}</td>
                    <td>{item.leave_type}</td>
                    <td>{fmtDate(item.start_date)}</td>
                    <td>{fmtDate(item.end_date)}</td>
                    <td>
                      <span className={badgeClass(item.status)}>
                        {item.status}
                      </span>
                    </td>
                    <td>
                      {isAdmin && item.status === "Pending" ? (
                        <div className="row-actions">
                          <button
                            className="btn-success"
                            type="button"
                            onClick={() =>
                              updateLeaveStatus(item.id, "Approved")
                            }
                          >
                            Approve
                          </button>
                          <button
                            className="btn-danger"
                            type="button"
                            onClick={() =>
                              updateLeaveStatus(item.id, "Rejected")
                            }
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
      
      {showCreateLeave && (
        <div
          className="modal-overlay"
          onMouseDown={(e) =>
            e.target.classList.contains("modal-overlay") &&
            setShowCreateLeave(false)
          }
        >
          <div className="modal saas-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h3 className="modal-title">Add Leave Request</h3>
                <p className="modal-subtitle">
                  This will be submitted with status: Pending
                </p>
              </div>
              <button
                className="modal-x"
                type="button"
                onClick={() => setShowCreateLeave(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateLeave} className="modal-form">
              <div className="modal-grid">
                <div className="form-group">
                  <label htmlFor="employee_id">Employee</label>
                  <select
                    id="employee_id"
                    name="employee_id"
                    value={leaveForm.employee_id}
                    onChange={(e) =>
                      handleLeaveEmployeeSelect(e.target.value)
                    }
                    required
                  >
                    <option value="">Select Employee</option>
                    {renderEmployeeOptions()}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="branch_snapshot">Branch</label>
                  <input
                    id="branch_snapshot"
                    name="branch_snapshot"
                    value={
                      leaveForm.branch_code || leaveForm.branch_name
                        ? `${leaveForm.branch_code} - ${leaveForm.branch_name}`
                        : ""
                    }
                    readOnly
                    placeholder="Auto-filled"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="leave_type">Leave Type</label>
                  <select
                    id="leave_type"
                    name="leave_type"
                    value={leaveForm.leave_type}
                    onChange={(e) =>
                      setLeaveForm((p) => ({
                        ...p,
                        leave_type: e.target.value,
                      }))
                    }
                    required
                  >
                    <option value="">Select Leave Type</option>
                    <option value="Annual Leave">Annual Leave</option>
                    <option value="Sick Leave">Sick Leave</option>
                    <option value="Maternity Leave">Maternity Leave</option>
                    <option value="Paternity Leave">Paternity Leave</option>
                    <option value="Emergency Leave">Emergency Leave</option>
                    <option value="Indefinite Leave">Indefinite Leave</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="start_date">Start Date</label>
                  <input
                    id="start_date"
                    name="start_date"
                    type="date"
                    value={leaveForm.start_date}
                    onChange={(e) =>
                      setLeaveForm((p) => ({
                        ...p,
                        start_date: e.target.value,
                      }))
                    }
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="end_date">End Date</label>
                  <input
                    id="end_date"
                    name="end_date"
                    type="date"
                    value={leaveForm.end_date}
                    onChange={(e) =>
                      setLeaveForm((p) => ({
                        ...p,
                        end_date: e.target.value,
                      }))
                    }
                    required
                  />
                </div>

                <div className="form-group full">
                  <label htmlFor="reason">Reason (optional)</label>
                  <textarea
                    id="reason"
                    name="reason"
                    value={leaveForm.reason}
                    onChange={(e) =>
                      setLeaveForm((p) => ({
                        ...p,
                        reason: e.target.value,
                      }))
                    }
                    placeholder="Optional (not saved yet)"
                  />
                </div>
              </div>

              <div className="modal-buttons">
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={() => setShowCreateLeave(false)}
                >
                  Cancel
                </button>
                <button
                  className="btn-primary"
                  type="submit"
                  disabled={loadingCreate}
                >
                  {loadingCreate ? "Submitting..." : "Submit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}