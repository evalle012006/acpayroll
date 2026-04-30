import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  "Leave Without Pay",
];

const LEAVE_CREDIT_MAP = {
  "Annual Leave": "annual_leave",
  "Sick Leave": "sick_leave",
  "Emergency Leave": "emergency_leave",
  "Maternity Leave": "maternity_leave",
  "Paternity Leave": "parental_leave",
};

const readUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
};

const fmtDate = (d) => (d ? String(d).split("T")[0] : "-");
const todayDate = () => new Date().toISOString().slice(0, 10);

const toNum = (v) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const diffDaysInclusive = (startDate, endDate) => {
  if (!startDate || !endDate) return 0;
  const a = new Date(startDate);
  const b = new Date(endDate);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  const ms = b.setHours(0, 0, 0, 0) - a.setHours(0, 0, 0, 0);
  return Math.floor(ms / 86400000) + 1;
};

const isPdfFile = (mime, name) =>
  String(mime || "").toLowerCase() === "application/pdf" ||
  String(name || "").toLowerCase().endsWith(".pdf");

export default function LeaveTransactions() {
  const navigate = useNavigate();
  const user = useMemo(() => readUser(), []);
  const role = String(user?.role || "").trim().toLowerCase();

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

  const canCreateLeave =
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

  const canViewRequestFile =
    isAdmin ||
    isHr ||
    isAccounting ||
    isTread ||
    isRegionalManager ||
    isAssistantVicePresident;

  const canViewApprovedFile =
    isAdmin ||
    isHr ||
    isAccounting ||
    isTread ||
    isRegionalManager ||
    isAssistantVicePresident ||
    isAreaManager;

  const canUploadApprovedFile = isAdmin || isHr || isAccounting || isTread;

  const employeePickerRef = useRef(null);

  const [staffList, setStaffList] = useState([]);
  const [branches, setBranches] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);

  const [loadingCreate, setLoadingCreate] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [uploadingApproved, setUploadingApproved] = useState({});

  const [selectedLeaveType, setSelectedLeaveType] = useState("All");
  const [showCreateLeave, setShowCreateLeave] = useState(false);

  const [leaveForm, setLeaveForm] = useState({
    employee_id: "",
    staff_name: "",
    branch_id: "",
    branch_code: "",
    branch_name: "",
    leave_type: "",
    date_created: todayDate(),
    start_date: "",
    end_date: "",
    total_no_of_days: 0,
    reason: "",
  });

  const isIndefiniteLeave = leaveForm.leave_type === "Indefinite Leave";

  const [attachmentFile, setAttachmentFile] = useState(null);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);

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

  useEffect(() => {
    const onMouseDown = (e) => {
      if (employeePickerRef.current && !employeePickerRef.current.contains(e.target)) {
        setShowEmployeeDropdown(false);
      }
    };

    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  useEffect(() => {
    if (isIndefiniteLeave) {
      setLeaveForm((prev) => ({
        ...prev,
        start_date: "",
        end_date: "",
        total_no_of_days: "",
      }));
      return;
    }

    setLeaveForm((prev) => ({
      ...prev,
      total_no_of_days: diffDaysInclusive(prev.start_date, prev.end_date),
    }));
  }, [leaveForm.start_date, leaveForm.end_date, isIndefiniteLeave]);

  const filteredEmployees = useMemo(() => {
    const q = employeeSearch.toLowerCase();
    if (!q) return staffList.slice(0, 30);

    return (staffList || []).filter((s) => {
      const name = String(s.fullname || "").toLowerCase();
      const empNo = String(s.employee_no || "").toLowerCase();
      return name.includes(q) || empNo.includes(q);
    });
  }, [staffList, employeeSearch]);

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

    setEmployeeSearch(
      emp ? `${emp.employee_no ? `${emp.employee_no} - ` : ""}${emp.fullname || "-"}` : ""
    );
    setShowEmployeeDropdown(false);
  };

  const resetForm = () => {
    setLeaveForm({
      employee_id: "",
      staff_name: "",
      branch_id: "",
      branch_code: "",
      branch_name: "",
      leave_type: "",
      date_created: todayDate(),
      start_date: "",
      end_date: "",
      total_no_of_days: 0,
      reason: "",
    });
    setAttachmentFile(null);
    setEmployeeSearch("");
    setShowEmployeeDropdown(false);
  };

  const getApprovedUsedLeave = useCallback(
    (employeeId, leaveType) => {
      return (leaveRequests || [])
        .filter(
          (l) =>
            String(l.employee_id) === String(employeeId) &&
            String(l.leave_type) === String(leaveType) &&
            String(l.status).toLowerCase() === "approved"
        )
        .reduce((sum, l) => {
          return (
            sum +
            (toNum(l.total_no_of_days) || diffDaysInclusive(l.start_date, l.end_date))
          );
        }, 0);
    },
    [leaveRequests]
  );

  const getLeaveRemaining = useCallback(() => {
    const creditField = LEAVE_CREDIT_MAP[leaveForm.leave_type];

    if (!creditField) return Infinity;

    const selectedStaff = staffList.find(
      (s) => String(s.id) === String(leaveForm.employee_id)
    );

    const available = toNum(selectedStaff?.[creditField]);
    const used = getApprovedUsedLeave(leaveForm.employee_id, leaveForm.leave_type);

    return available - used;
  }, [leaveForm.employee_id, leaveForm.leave_type, staffList, getApprovedUsedLeave]);

  const handleCreateLeave = async (e) => {
    e.preventDefault();

    if (!leaveForm.employee_id) return alert("Select an employee.");
    if (!leaveForm.leave_type) return alert("Select leave type.");
    if (!leaveForm.date_created) return alert("Select date created.");

    if (!isIndefiniteLeave) {
      if (!leaveForm.start_date || !leaveForm.end_date) {
        return alert("Select start/end date.");
      }

      if (String(leaveForm.start_date) > String(leaveForm.end_date)) {
        return alert("Start date must be on or before end date.");
      }

      const requestedDays = diffDaysInclusive(leaveForm.start_date, leaveForm.end_date);
      const remainingLeave = getLeaveRemaining();

      if (remainingLeave <= 0) {
        return alert("Insufficient leave balance. Remaining leave is 0.");
      }

      if (requestedDays > remainingLeave) {
        return alert(
          `Insufficient leave balance. Remaining: ${remainingLeave}, Requested: ${requestedDays}.`
        );
      }
    }

    try {
      setLoadingCreate(true);

      const formData = new FormData();
      formData.append("employee_id", leaveForm.employee_id);
      formData.append("leave_type", leaveForm.leave_type);
      formData.append("date_created", leaveForm.date_created);
      formData.append("start_date", isIndefiniteLeave ? "" : leaveForm.start_date);
      formData.append("end_date", isIndefiniteLeave ? "" : leaveForm.end_date);
      formData.append("reason", leaveForm.reason || "");

      if (attachmentFile) {
        formData.append("attachment", attachmentFile);
      }

      await api.post("/leave-requests", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      alert("Leave request submitted!");
      resetForm();
      setShowCreateLeave(false);
      await fetchLeave();
      await fetchStaff();
    } catch (err) {
      if (err?.response?.status === 401) return logout();
      if (err?.response?.status === 403) return alert("Access denied.");
      alert(err?.response?.data?.message || "Failed to submit leave request.");
    } finally {
      setLoadingCreate(false);
    }
  };

  const canApproveThisRow = (item) => {
    const status = String(item.status || "").trim();

    if (status === "Pending Area Manager") return isAreaManager;
    if (status === "Pending Regional Manager") return isRegionalManager;
    if (status === "Pending Assistant Vice President") return isAssistantVicePresident;
    if (status === "Pending Admin") return isAdmin || isHr || isAccounting || isTread;

    return false;
  };

  const updateLeaveStatus = async (id, action) => {
    try {
      await api.put(`/leave-requests/${id}`, {
        action,
        rejection_reason: action === "reject" ? "Rejected by approver" : "",
      });
      await fetchLeave();
      await fetchStaff();
    } catch (err) {
      if (err?.response?.status === 401) return logout();
      if (err?.response?.status === 403) return alert("Access denied.");
      alert(err?.response?.data?.message || "Failed to update leave request");
    }
  };

  const filteredLeave = useMemo(() => {
    return (leaveRequests || []).filter((x) =>
      selectedLeaveType === "All" ? true : String(x.leave_type) === selectedLeaveType
    );
  }, [leaveRequests, selectedLeaveType]);

  const badgeClass = (status) => {
    if (status === "Approved") return "badge badge-approved";
    if (status === "Rejected") return "badge badge-rejected";
    if (String(status || "").includes("Pending")) return "badge badge-pending";
    return "badge badge-pending";
  };

  const downloadAttachment = async (id, type, fallbackName = "") => {
    try {
      const res = await api.get(`/leave-requests/${id}/download/${type}`, {
        responseType: "blob",
      });

      const blob = new Blob([res.data]);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fallbackName || `leave-${id}-${type}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to download file.");
    }
  };

  const uploadApprovedFile = async (leaveId, file) => {
    if (!file) return;
    try {
      setUploadingApproved((prev) => ({ ...prev, [leaveId]: true }));

      const formData = new FormData();
      formData.append("attachment", file);

      await api.post(`/leave-requests/${leaveId}/approved-file`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      alert("Approved leave file uploaded.");
      await fetchLeave();
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to upload approved file.");
    } finally {
      setUploadingApproved((prev) => ({ ...prev, [leaveId]: false }));
    }
  };

  const renderRequestFileAction = (item) => {
    if (!item.request_attachment_path) return null;

    if (canViewRequestFile) {
      const label = isPdfFile(item.request_attachment_mime, item.request_attachment_name)
        ? "Download Request PDF"
        : "Download Request File";

      return (
        <button
          className="btn-secondary"
          type="button"
          onClick={() =>
            downloadAttachment(item.id, "request", item.request_attachment_name || "")
          }
        >
          {label}
        </button>
      );
    }

    if (isAreaManager) {
      return (
        <button className="btn-secondary" type="button" disabled>
          Request File Uploaded
        </button>
      );
    }

    return null;
  };

  const renderApprovedFileAction = (item) => {
    if (!item.approved_attachment_path || !canViewApprovedFile) return null;

    const label = isPdfFile(item.approved_attachment_mime, item.approved_attachment_name)
      ? "Download Approved PDF"
      : "Download Approved File";

    return (
      <button
        className="btn-secondary"
        type="button"
        onClick={() =>
          downloadAttachment(item.id, "approved", item.approved_attachment_name || "")
        }
      >
        {label}
      </button>
    );
  };

  return (
    <div className="approval-page">
      <div className="approval-page-header">
        <div>
          <h2 className="approval-title">Leave Transactions</h2>
          <p className="approval-subtitle">Create and manage leave requests</p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="btn-secondary" onClick={() => navigate(-1)} type="button">
            ← Back
          </button>

          <button className="btn-secondary" onClick={handleRefresh} type="button" disabled={loadingList}>
            {loadingList ? "Refreshing..." : "Refresh"}
          </button>

          {canCreateLeave && (
            <button className="btn-primary" onClick={() => setShowCreateLeave(true)} type="button">
              + Add Leave
            </button>
          )}
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
                <th>Date Created</th>
                <th>Start</th>
                <th>End</th>
                <th>Days</th>
                <th>Status</th>
                <th style={{ width: 460 }}>Action</th>
              </tr>
            </thead>

            <tbody>
              {loadingList ? (
                <tr>
                  <td colSpan={9} className="empty-state">
                    Loading…
                  </td>
                </tr>
              ) : filteredLeave.length === 0 ? (
                <tr>
                  <td colSpan={9} className="empty-state">
                    No requests found.
                  </td>
                </tr>
              ) : (
                filteredLeave.map((item) => (
                  <tr key={item.id}>
                    <td>{item.id}</td>
                    <td className="td-strong">{item.staff_name || "-"}</td>
                    <td>{item.leave_type}</td>
                    <td>{fmtDate(item.date_created)}</td>
                    <td>{fmtDate(item.start_date)}</td>
                    <td>{fmtDate(item.end_date)}</td>
                    <td>
                      {item.leave_type === "Indefinite Leave"
                        ? ""
                        : item.total_no_of_days ?? 0}
                    </td>
                    <td>
                      <span className={badgeClass(item.status)}>{item.status}</span>
                    </td>
                    <td>
                      <div className="row-actions" style={{ flexWrap: "wrap" }}>
                        {renderRequestFileAction(item)}
                        {renderApprovedFileAction(item)}

                        {canUploadApprovedFile && item.status === "Approved" ? (
                          <label className="btn-secondary" style={{ cursor: "pointer" }}>
                            {uploadingApproved[item.id] ? "Uploading..." : "Upload Approved File"}
                            <input
                              type="file"
                              accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                              style={{ display: "none" }}
                              onChange={(e) => uploadApprovedFile(item.id, e.target.files?.[0] || null)}
                            />
                          </label>
                        ) : null}

                        {canApproveThisRow(item) ? (
                          <>
                            <button
                              className="btn-success"
                              type="button"
                              onClick={() => updateLeaveStatus(item.id, "approve")}
                            >
                              Approve
                            </button>
                            <button
                              className="btn-danger"
                              type="button"
                              onClick={() => updateLeaveStatus(item.id, "reject")}
                            >
                              Reject
                            </button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {canCreateLeave && showCreateLeave && (
        <div
          className="modal-overlay"
          onMouseDown={(e) =>
            e.target.classList.contains("modal-overlay") && setShowCreateLeave(false)
          }
        >
          <div
            className="modal saas-modal"
            onMouseDown={(e) => e.stopPropagation()}
            style={{ overflow: "visible" }}
          >
            <div className="modal-head">
              <div>
                <h3 className="modal-title">Add Leave Request</h3>
                <p className="modal-subtitle">Submitted into approval chain automatically</p>
              </div>
              <button className="modal-x" type="button" onClick={() => setShowCreateLeave(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateLeave} className="modal-form" style={{ overflow: "visible" }}>
              <div className="modal-grid" style={{ overflow: "visible" }}>
                <div
                  className="form-group"
                  ref={employeePickerRef}
                  style={{ position: "relative", zIndex: 50 }}
                >
                  <label htmlFor="employee_id_search">Employee</label>

                  <input
                    id="employee_id_search"
                    name="employee_id_search"
                    type="text"
                    placeholder="Search Employee..."
                    value={employeeSearch}
                    onChange={(e) => {
                      setEmployeeSearch(e.target.value);
                      setShowEmployeeDropdown(true);
                      setLeaveForm((prev) => ({
                        ...prev,
                        employee_id: "",
                        staff_name: "",
                        branch_id: "",
                        branch_code: "",
                        branch_name: "",
                      }));
                    }}
                    onFocus={() => setShowEmployeeDropdown(true)}
                    autoComplete="off"
                    required={!leaveForm.employee_id}
                  />

                  {showEmployeeDropdown && (
                    <div
                      style={{
                        position: "absolute",
                        top: "100%",
                        left: 0,
                        right: 0,
                        marginTop: 6,
                        maxHeight: 220,
                        overflowY: "auto",
                        background: "#0f1a2e",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 8,
                        zIndex: 9999,
                        boxShadow: "0 10px 24px rgba(0,0,0,0.4)",
                      }}
                    >
                      {filteredEmployees.length === 0 ? (
                        <div style={{ padding: 10, color: "#9aa7bd" }}>No results</div>
                      ) : (
                        filteredEmployees.map((s) => (
                          <div
                            key={s.id}
                            style={{
                              padding: 10,
                              cursor: "pointer",
                              borderBottom: "1px solid rgba(255,255,255,0.05)",
                              color: "#e7edf7",
                              transition: "background 0.15s ease",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = "#1e293b";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = "transparent";
                            }}
                            onClick={() => handleLeaveEmployeeSelect(s.id)}
                          >
                            {(s.employee_no ? `${s.employee_no} - ` : "") + (s.fullname || "-")}
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  <input type="hidden" name="employee_id" value={leaveForm.employee_id} />
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
                        start_date: e.target.value === "Indefinite Leave" ? "" : p.start_date,
                        end_date: e.target.value === "Indefinite Leave" ? "" : p.end_date,
                        total_no_of_days: e.target.value === "Indefinite Leave" ? "" : p.total_no_of_days,
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
                    <option value="Leave Without Pay">Leave Without Pay</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="date_created">Date Created</label>
                  <input
                    id="date_created"
                    name="date_created"
                    type="date"
                    value={leaveForm.date_created}
                    onChange={(e) =>
                      setLeaveForm((p) => ({
                        ...p,
                        date_created: e.target.value,
                      }))
                    }
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="start_date">Start Date</label>
                  <input
                    id="start_date"
                    name="start_date"
                    type="date"
                    value={leaveForm.start_date}
                    disabled={isIndefiniteLeave}
                    onChange={(e) =>
                      setLeaveForm((p) => ({
                        ...p,
                        start_date: e.target.value,
                      }))
                    }
                    required={!isIndefiniteLeave}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="end_date">End Date</label>
                  <input
                    id="end_date"
                    name="end_date"
                    type="date"
                    value={leaveForm.end_date}
                    disabled={isIndefiniteLeave}
                    onChange={(e) =>
                      setLeaveForm((p) => ({
                        ...p,
                        end_date: e.target.value,
                      }))
                    }
                    required={!isIndefiniteLeave}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="total_no_of_days">Total No. of Days</label>
                  <input
                    id="total_no_of_days"
                    name="total_no_of_days"
                    value={isIndefiniteLeave ? "" : leaveForm.total_no_of_days}
                    readOnly
                    placeholder={isIndefiniteLeave ? "N/A for indefinite leave" : "Auto-calculated"}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="attachment">Upload Leave File</label>
                  <input
                    id="attachment"
                    name="attachment"
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                    onChange={(e) => setAttachmentFile(e.target.files?.[0] || null)}
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
                    placeholder="Optional reason"
                  />
                </div>
              </div>

              <div className="modal-buttons">
                <button className="btn-secondary" type="button" onClick={() => setShowCreateLeave(false)}>
                  Cancel
                </button>
                <button className="btn-primary" type="submit" disabled={loadingCreate}>
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