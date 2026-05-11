import React, { useCallback, useEffect, useMemo, useRef, useState, } from "react";
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
    return JSON.parse(
      localStorage.getItem("user") || "null"
    );
  } catch {
    return null;
  }
};

const fmtDate = (d) =>
  d ? String(d).split("T")[0] : "-";

const todayDate = () =>
  new Date().toISOString().slice(0, 10);

const toNum = (v) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const diffDaysInclusive = (
  startDate,
  endDate
) => {
  if (!startDate || !endDate) return 0;

  const a = new Date(startDate);
  const b = new Date(endDate);

  if (
    Number.isNaN(a.getTime()) ||
    Number.isNaN(b.getTime())
  ) {
    return 0;
  }

  const ms =
    b.setHours(0, 0, 0, 0) -
    a.setHours(0, 0, 0, 0);

  return Math.floor(ms / 86400000) + 1;
};

const isPdfFile = (mime, name) =>
  String(mime || "").toLowerCase() ===
    "application/pdf" ||
  String(name || "")
    .toLowerCase()
    .endsWith(".pdf");

export default function LeaveTransactions() {
  const navigate = useNavigate();

  const user = useMemo(() => readUser(), []);

  const role = String(user?.role || "")
    .trim()
    .toLowerCase();

  const isAdmin = ["admin", "it"].includes(role);
  const isIT = role === "it";
  const isHr = role === "hr";
  const isAccounting = role === "accounting";
  const isTread = role === "tread";

  const isBranchManager =
    role === "branch manager";

  const isAreaManager =
    role === "area manager";

  const isRegionalManager =
    role === "regional manager";

  const isAssistantVicePresident =
    role === "assistant vice president";

  const isVicePresident =
    role === "vice president";

  const isSeniorVicePresident =
    role === "senior vice president";

  const isPresident =
    role === "president";

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
    isAssistantVicePresident ||
    isVicePresident ||
    isSeniorVicePresident ||
    isPresident;

  const canViewApprovedFile =
    isAdmin ||
    isHr ||
    isAccounting ||
    isRegionalManager ||
    isAssistantVicePresident ||
    isAreaManager ||
    isVicePresident ||
    isSeniorVicePresident ||
    isPresident;

  const canUploadApprovedFile =
    isAdmin ||
    isIT ||
    isHr ||
    isAccounting;

  const employeePickerRef = useRef(null);
  const [staffList, setStaffList] = useState([]);
  const [branches, setBranches] = useState([]);
  const [leaveRequests, setLeaveRequests] =
    useState([]);

  const [loadingCreate, setLoadingCreate] =
    useState(false);

  const [loadingList, setLoadingList] =
    useState(false);

  const [
    uploadingApproved,
    setUploadingApproved,
  ] = useState({});

  const [selectedLeaveType, setSelectedLeaveType,] = useState("All");

  const [page, setPage] = useState(1);
  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(25);
  const [showCreateLeave, setShowCreateLeave,] = useState(false);
  const [leaveForm, setLeaveForm] =
    useState({
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

  const isIndefiniteLeave =
    leaveForm.leave_type ===
    "Indefinite Leave";

  const [attachmentFile, setAttachmentFile] = useState(null);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [showEmployeeDropdown, setShowEmployeeDropdown,] = useState(false);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/login";
  }, []);

  const fetchStaff = useCallback(async () => {
    try {
      const res = await api.get("/staff");

      setStaffList(
        Array.isArray(res.data)
          ? res.data
          : []
      );
    } catch (err) {
      if (err?.response?.status === 401) {
        logout();
      }

      setStaffList([]);
    }
  }, [logout]);

  const fetchBranches = useCallback(
    async () => {
      try {
        const res = await api.get(
          "/branches"
        );

        setBranches(
          Array.isArray(res.data)
            ? res.data
            : []
        );
      } catch (err) {
        if (
          err?.response?.status === 401
        ) {
          logout();
        }

        setBranches([]);
      }
    },
    [logout]
  );

  const branchMap = useMemo(() => {
    const m = new Map();

    (branches || []).forEach((b) =>
      m.set(Number(b.id), b)
    );

    return m;
  }, [branches]);

  const fetchLeave = useCallback(async () => {
    try {
      setLoadingList(true);

      const res = await api.get(
        "/leave-requests"
      );

      setLeaveRequests(
        Array.isArray(res.data)
          ? res.data
          : []
      );
    } catch (err) {
      if (err?.response?.status === 401) {
        logout();
      }

      setLeaveRequests([]);
    } finally {
      setLoadingList(false);
    }
  }, [logout]);

  const handleRefresh = useCallback(async () => {
    await Promise.all([
      fetchStaff(),
      fetchBranches(),
      fetchLeave(),
    ]);
  }, [
    fetchStaff,
    fetchBranches,
    fetchLeave,
  ]);

  useEffect(() => {
    const token =
      localStorage.getItem("token");

    if (!user || !token) {
      window.location.href = "/login";
      return;
    }

    fetchStaff();
    fetchBranches();
    fetchLeave();
  }, [
    user,
    fetchStaff,
    fetchBranches,
    fetchLeave,
  ]);

  useEffect(() => {
    if (!showCreateLeave) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        setShowCreateLeave(false);
      }
    };

    document.addEventListener(
      "keydown",
      onKeyDown
    );

    document.body.style.overflow =
      "hidden";

    return () => {
      document.removeEventListener(
        "keydown",
        onKeyDown
      );

      document.body.style.overflow = "";
    };
  }, [showCreateLeave]);

  useEffect(() => {
    const onMouseDown = (e) => {
      if (
        employeePickerRef.current &&
        !employeePickerRef.current.contains(
          e.target
        )
      ) {
        setShowEmployeeDropdown(false);
      }
    };

    document.addEventListener(
      "mousedown",
      onMouseDown
    );

    return () =>
      document.removeEventListener(
        "mousedown",
        onMouseDown
      );
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
      total_no_of_days:
        diffDaysInclusive(
          prev.start_date,
          prev.end_date
        ),
    }));
  }, [
    leaveForm.start_date,
    leaveForm.end_date,
    isIndefiniteLeave,
  ]);

    const filteredEmployees = useMemo(() => {
    const q = employeeSearch.toLowerCase();

    if (!q) return staffList.slice(0, 30);

    return (staffList || [])
      .filter((s) => {
        const name = String(s.fullname || "").toLowerCase();
        const empNo = String(s.employee_no || "").toLowerCase();
        return name.includes(q) || empNo.includes(q);
      })
      .slice(0, 30);
  }, [staffList, employeeSearch]);

  const handleLeaveEmployeeSelect = (employeeId) => {
    const emp = staffList.find((s) => String(s.id) === String(employeeId));
    const bid = emp?.branch_id ? Number(emp.branch_id) : null;
    const b = bid ? branchMap.get(bid) : null;

    setLeaveForm((prev) => ({
      ...prev,
      employee_id: String(employeeId || ""),
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
            (toNum(l.total_no_of_days) ||
              diffDaysInclusive(l.start_date, l.end_date))
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
    const used = getApprovedUsedLeave(
      leaveForm.employee_id,
      leaveForm.leave_type
    );

    return available - used;
  }, [
    leaveForm.employee_id,
    leaveForm.leave_type,
    staffList,
    getApprovedUsedLeave,
  ]);

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

      const requestedDays = diffDaysInclusive(
        leaveForm.start_date,
        leaveForm.end_date
      );

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

      alert("Leave request submitted.");
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

    if (status === "Pending Branch Manager") return isBranchManager;
    if (status === "Pending Area Manager") return isAreaManager;
    if (status === "Pending Regional Manager") return isRegionalManager;
    if (status === "Pending Assistant Vice President") return isAssistantVicePresident;
    if (status === "Pending Vice President") return isVicePresident;
    if (status === "Pending Senior Vice President") return isSeniorVicePresident || isPresident;

    if (status === "Pending Admin") {
      return isAdmin || isIT || isHr || isAccounting || isTread || isSeniorVicePresident;
    }

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
    const q = String(search || "").trim().toLowerCase();

    return (leaveRequests || []).filter((x) => {
      const matchType =
        selectedLeaveType === "All"
          ? true
          : String(x.leave_type) === selectedLeaveType;

      const haystack = [
        x.transaction_code,
        x.staff_name,
        x.employee_no,
        x.leave_type,
        x.status,
        x.reason,
        x.date_created,
        x.start_date,
        x.end_date,
      ]
        .map((v) => String(v ?? "").toLowerCase())
        .join(" ");

      return matchType && (!q || haystack.includes(q));
    });
  }, [leaveRequests, selectedLeaveType, search]);

  const totalPages = Math.max(1, Math.ceil(filteredLeave.length / pageSize));

  const pagedLeave = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredLeave.slice(start, start + pageSize);
  }, [filteredLeave, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [selectedLeaveType, pageSize, search]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const getApprovalLabel = (status) => {
    switch (String(status || "").trim()) {
      case "Pending Branch Manager":
        return "Waiting Branch Manager";
      case "Pending Area Manager":
        return "Waiting Area Manager";
      case "Pending Regional Manager":
        return "Waiting Regional Manager";
      case "Pending Assistant Vice President":
        return "Waiting AVP";
      case "Pending Vice President":
        return "Waiting VP";
      case "Pending Senior Vice President":
        return "Waiting SVP";
      case "Pending Admin":
        return "Waiting HR/Admin";
      default:
        return status || "-";
    }
  };

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
      setUploadingApproved((prev) => ({
        ...prev,
        [leaveId]: true,
      }));

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
      setUploadingApproved((prev) => ({
        ...prev,
        [leaveId]: false,
      }));
    }
  };

  const renderRequestFileAction = (item) => {
    if (!item.request_attachment_path) return null;

    if (!canViewRequestFile) return null;

    const label = isPdfFile(
      item.request_attachment_mime,
      item.request_attachment_name
    )
      ? "Request PDF"
      : "Request File";

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
  };

  const renderApprovedFileAction = (item) => {
    if (!item.approved_attachment_path || !canViewApprovedFile) return null;

    const label = isPdfFile(
      item.approved_attachment_mime,
      item.approved_attachment_name
    )
      ? "Approved PDF"
      : "Approved File";

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

    const getPageNumbers = () => {
    const pages = [];
    const maxButtons = 5;

    let start = Math.max(1, page - 2);
    let end = Math.min(totalPages, start + maxButtons - 1);

    if (end - start < maxButtons - 1) {
      start = Math.max(1, end - maxButtons + 1);
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    return pages;
  };

  return (
    <div className="approval-page">
      <div className="approval-page-header">
        <div>
          <h2 className="approval-title">
            Leave Transactions
          </h2>

          <p className="approval-subtitle">
            Create and manage leave requests
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
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
            {loadingList
              ? "Refreshing..."
              : "Refresh"}
          </button>

          {canCreateLeave && (
            <button
              className="btn-primary"
              onClick={() =>
                setShowCreateLeave(true)
              }
              type="button"
            >
              + Add Leave
            </button>
          )}
        </div>
      </div>

      <div className="filters">
        {leaveTypes.map((t) => (
          <button
            key={t}
            className={`chip ${
              selectedLeaveType === t
                ? "active"
                : ""
            }`}
            onClick={() =>
              setSelectedLeaveType(t)
            }
            type="button"
          >
            {t}
          </button>
        ))}
      </div>
      
      <div className="leave-searchbar">
        <input
          className="leave-search-input"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              setSearch(searchText);
            }
          }}
          placeholder="Search code, name, employee no, status..."
        />

        <button
          className="btn-secondary"
          type="button"
          onClick={() => setSearch(searchText)}
        >
          Search
        </button>

        <button
          className="btn-secondary"
          type="button"
          onClick={() => {
            setSearchText("");
            setSearch("");
          }}
        >
          Clear
        </button>

        <span className="leave-search-count">
          {filteredLeave.length} result(s)
        </span>
      </div>
      <div className="leave-pager">
        <div className="leave-pager-left">
          <span>Rows per page</span>

          <select
            value={pageSize}
            onChange={(e) =>
              setPageSize(
                Number(e.target.value)
              )
            }
          >
            <option value={25}>
              25
            </option>

            <option value={50}>
              50
            </option>

            <option value={75}>
              75
            </option>

            <option value={100}>
              100
            </option>
          </select>
        </div>

        <div className="leave-pager-right">
          <button
            className="leave-page-btn"
            type="button"
            disabled={page <= 1}
            onClick={() =>
              setPage((p) =>
                Math.max(1, p - 1)
              )
            }
          >
            ‹
          </button>

          {getPageNumbers().map((p) => (
            <button
              key={p}
              className={`leave-page-number ${
                page === p ? "active" : ""
              }`}
              type="button"
              onClick={() => setPage(p)}
            >
              {p}
            </button>
          ))}

          <button
            className="leave-page-btn"
            type="button"
            disabled={page >= totalPages}
            onClick={() =>
              setPage((p) =>
                Math.min(
                  totalPages,
                  p + 1
                )
              )
            }
          >
            ›
          </button>

          <span className="leave-page-summary">
            Page {page} of {totalPages}
          </span>
        </div>
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
                <th style={{ width: 460 }}>
                  Action
                </th>
              </tr>
            </thead>

            <tbody>
              {loadingList ? (
                <tr>
                  <td
                    colSpan={9}
                    className="empty-state"
                  >
                    Loading…
                  </td>
                </tr>
              ) : filteredLeave.length ===
                0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="empty-state"
                  >
                    No requests found.
                  </td>
                </tr>
              ) : (
                pagedLeave.map((item) => (
                  <tr key={item.id}>
                    <td>
                      {item.transaction_code ||
                        item.id}
                    </td>

                    <td className="td-strong">
                      {item.staff_name ||
                        `Employee #${item.employee_id}` ||
                        "-"}
                    </td>

                    <td>
                      {item.leave_type}
                    </td>

                    <td>
                      {fmtDate(
                        item.date_created
                      )}
                    </td>

                    <td>
                      {fmtDate(
                        item.start_date
                      )}
                    </td>

                    <td>
                      {fmtDate(
                        item.end_date
                      )}
                    </td>

                    <td>
                      {item.leave_type ===
                      "Indefinite Leave"
                        ? ""
                        : item.total_no_of_days ??
                          0}
                    </td>

                    <td>
                      <span
                        className={badgeClass(
                          item.status
                        )}
                      >
                        {getApprovalLabel(
                          item.status
                        )}
                      </span>
                    </td>

                    <td>
                      <div className="row-actions">
                        {renderRequestFileAction(
                          item
                        )}

                        {renderApprovedFileAction(
                          item
                        )}

                        {canUploadApprovedFile &&
                        item.status ===
                          "Approved" ? (
                          <label
                            className="btn-secondary"
                            style={{
                              cursor:
                                "pointer",
                            }}
                          >
                            {uploadingApproved[
                              item.id
                            ]
                              ? "Uploading..."
                              : "Upload Approved File"}

                            <input
                              type="file"
                              accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                              style={{
                                display:
                                  "none",
                              }}
                              onChange={(
                                e
                              ) =>
                                uploadApprovedFile(
                                  item.id,
                                  e.target
                                    .files?.[0] ||
                                    null
                                )
                              }
                            />
                          </label>
                        ) : null}

                        {canApproveThisRow(
                          item
                        ) ? (
                          <>
                            <button
                              className="btn-success"
                              type="button"
                              onClick={() =>
                                updateLeaveStatus(
                                  item.id,
                                  "approve"
                                )
                              }
                            >
                              Approve
                            </button>

                            <button
                              className="btn-danger"
                              type="button"
                              onClick={() =>
                                updateLeaveStatus(
                                  item.id,
                                  "reject"
                                )
                              }
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
            e.target.classList.contains("modal-overlay") &&
            setShowCreateLeave(false)
          }
        >
          <div
            className="modal saas-modal"
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              overflow: "visible",
              maxWidth: "950px",
              width: "95%",
            }}
          >
            <div className="modal-head">
              <div>
                <h3 className="modal-title">
                  Add Leave Request
                </h3>

                <p className="modal-subtitle">
                  Submitted into approval chain automatically
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

            <form
              onSubmit={handleCreateLeave}
              className="modal-form"
              style={{
                overflow: "visible",
              }}
            >
              <div
                className="modal-grid"
                style={{
                  overflow: "visible",
                }}
              >
                <div
                  className="form-group"
                  ref={employeePickerRef}
                  style={{
                    position: "relative",
                    zIndex: 50,
                  }}
                >
                  <label>Employee</label>

                  <input
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
                    onFocus={() =>
                      setShowEmployeeDropdown(true)
                    }
                    required={!leaveForm.employee_id}
                  />

                  {showEmployeeDropdown && (
                    <div className="approval-search-dropdown">
                      {filteredEmployees.length === 0 ? (
                        <div className="approval-search-empty">
                          No results
                        </div>
                      ) : (
                        filteredEmployees.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            className="approval-search-item"
                            onClick={() =>
                              handleLeaveEmployeeSelect(
                                s.id
                              )
                            }
                          >
                            {(s.employee_no
                              ? `${s.employee_no} - `
                              : "") +
                              (s.fullname || "-")}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label>Branch</label>

                  <input
                    value={
                      leaveForm.branch_code ||
                      leaveForm.branch_name
                        ? `${leaveForm.branch_code} - ${leaveForm.branch_name}`
                        : ""
                    }
                    readOnly
                    placeholder="Auto-filled"
                  />
                </div>

                <div className="form-group">
                  <label>Leave Type</label>

                  <select
                    value={leaveForm.leave_type}
                    onChange={(e) =>
                      setLeaveForm((p) => ({
                        ...p,
                        leave_type: e.target.value,
                        start_date:
                          e.target.value ===
                          "Indefinite Leave"
                            ? ""
                            : p.start_date,
                        end_date:
                          e.target.value ===
                          "Indefinite Leave"
                            ? ""
                            : p.end_date,
                        total_no_of_days:
                          e.target.value ===
                          "Indefinite Leave"
                            ? ""
                            : p.total_no_of_days,
                      }))
                    }
                    required
                  >
                    <option value="">
                      Select Leave Type
                    </option>

                    {leaveTypes
                      .filter((x) => x !== "All")
                      .map((x) => (
                        <option
                          key={x}
                          value={x}
                        >
                          {x}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Date Created</label>

                  <input
                    type="date"
                    value={leaveForm.date_created}
                    onChange={(e) =>
                      setLeaveForm((p) => ({
                        ...p,
                        date_created:
                          e.target.value,
                      }))
                    }
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Start Date</label>

                  <input
                    type="date"
                    value={leaveForm.start_date}
                    disabled={isIndefiniteLeave}
                    onChange={(e) =>
                      setLeaveForm((p) => ({
                        ...p,
                        start_date:
                          e.target.value,
                      }))
                    }
                    required={!isIndefiniteLeave}
                  />
                </div>

                <div className="form-group">
                  <label>End Date</label>

                  <input
                    type="date"
                    value={leaveForm.end_date}
                    disabled={isIndefiniteLeave}
                    onChange={(e) =>
                      setLeaveForm((p) => ({
                        ...p,
                        end_date:
                          e.target.value,
                      }))
                    }
                    required={!isIndefiniteLeave}
                  />
                </div>

                <div className="form-group">
                  <label>Total No. of Days</label>

                  <input
                    value={
                      isIndefiniteLeave
                        ? ""
                        : leaveForm.total_no_of_days
                    }
                    readOnly
                    placeholder={
                      isIndefiniteLeave
                        ? "N/A for indefinite leave"
                        : "Auto-calculated"
                    }
                  />
                </div>

                <div className="form-group">
                  <label>
                    Upload Leave File
                  </label>

                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                    onChange={(e) =>
                      setAttachmentFile(
                        e.target.files?.[0] ||
                          null
                      )
                    }
                  />
                </div>

                <div className="form-group full">
                  <label>Reason</label>

                  <textarea
                    value={leaveForm.reason}
                    onChange={(e) =>
                      setLeaveForm((p) => ({
                        ...p,
                        reason:
                          e.target.value,
                      }))
                    }
                    placeholder="Optional reason"
                  />
                </div>
              </div>

              <div className="modal-buttons">
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={() =>
                    setShowCreateLeave(false)
                  }
                >
                  Cancel
                </button>

                <button
                  className="btn-primary"
                  type="submit"
                  disabled={loadingCreate}
                >
                  {loadingCreate
                    ? "Submitting..."
                    : "Submit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}