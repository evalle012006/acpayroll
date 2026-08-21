import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "../../api/axiosClient";
import "../../styles/TerminationOfContract.css";

const STATUS_WAITING_FINAL = "Waiting Final File Upload";
const STATUS_APPROVED = "Approved";
const STATUS_REJECTED = "Rejected";
const STATUS_VOID = "Voided";

const readUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
};

const toStr = (v) => String(v ?? "").trim();
const norm = (v) => toStr(v).toLowerCase();
const fmtDate = (d) => (d ? String(d).split("T")[0] : "-");
const todayDate = () => new Date().toISOString().slice(0, 10);

const displayName = (s) => {
  const ln = toStr(s?.last_name);
  const fn = toStr(s?.first_name);
  const mn = toStr(s?.middle_name);

  const built = `${ln}${ln && fn ? ", " : ""}${fn}${mn ? ` ${mn}` : ""}`
    .replace(/\s+/g, " ")
    .trim();

  return built || toStr(s?.fullname) || "-";
};

const branchLabel = (s) => {
  const code = toStr(s?.branch_code);
  const name = toStr(s?.branch_name);
  return code || name ? `${code}${code && name ? " - " : ""}${name}` : "-";
};

export default function TerminationApprovalTab({ embedded = false }) {
  const user = useMemo(() => readUser(), []);
  const role = norm(user?.role);

  const dept = norm(
    user?.department ||
      user?.department_name ||
      user?.departmentName ||
      user?.user_department ||
      user?.dept ||
      ""
  );

  const isAdmin = role === "admin";
  const isIT = role === "it";
  const isHR = role === "hr";
  const isAccounting = role === "accounting";

  const isOperationViewer =
    dept === "operation department" &&
    [
      "branch manager",
      "area manager",
      "regional manager",
      "assistant vice president",
      "vice president",
      "senior vice president",
    ].includes(role);

  const canManage =
    isAdmin ||
    isIT ||
    isHR ||
    isAccounting ||
    dept === "it department" ||
    dept === "hr department" ||
    dept === "accounting department";

  const canView =
    canManage ||
    isOperationViewer;

  const canCreate = canManage;

  const canFinalUpload = canManage;
  const canReject = canManage;
  const canVoid = canManage;
  const canDelete = isAdmin || isIT;

  const employeePickerRef = useRef(null);

  const [staffList, setStaffList] = useState([]);
  const [requests, setRequests] = useState([]);

  const [loadingList, setLoadingList] = useState(false);
  const [loadingCreate, setLoadingCreate] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);

  const [employeeSearch, setEmployeeSearch] = useState("");
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);

  const [attachmentFile, setAttachmentFile] = useState(null);
  const [finalFile, setFinalFile] = useState(null);

  const [form, setForm] = useState({
    employee_id: "",
    employee_name: "",
    branch_id: "",
    branch_code: "",
    branch_name: "",
    area: "",
    region: "",
    division: "",
    date_created: todayDate(),
    effective_date: "",
    reason: "",
    remarks: "",
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
      if (err?.response?.status === 401) return logout();
      setStaffList([]);
    }
  }, [logout]);

  const fetchRequests = useCallback(async () => {
    try {
      setLoadingList(true);
      const res = await api.get("/termination-requests");
      setRequests(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      if (err?.response?.status === 401) return logout();
      setRequests([]);
      alert(err?.response?.data?.message || "Failed to load Termination requests.");
    } finally {
      setLoadingList(false);
    }
  }, [logout]);

  const refreshAll = useCallback(async () => {
    await Promise.all([fetchStaff(), fetchRequests()]);
  }, [fetchStaff, fetchRequests]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    const onMouseDown = (e) => {
      if (employeePickerRef.current && !employeePickerRef.current.contains(e.target)) {
        setShowEmployeeDropdown(false);
      }
    };

    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  const resetForm = () => {
    setForm({
      employee_id: "",
      employee_name: "",
      branch_id: "",
      branch_code: "",
      branch_name: "",
      area: "",
      region: "",
      division: "",
      date_created: todayDate(),
      effective_date: "",
      reason: "",
      remarks: "",
    });

    setEmployeeSearch("");
    setAttachmentFile(null);
    setShowEmployeeDropdown(false);
  };

  const openCreateModal = () => {
    resetForm();
    setShowCreateModal(true);
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    resetForm();
  };

  const openViewModal = (row) => {
    setSelectedRequest(row);
    setFinalFile(null);
    setShowViewModal(true);
  };

  const closeViewModal = () => {
    setSelectedRequest(null);
    setFinalFile(null);
    setShowViewModal(false);
  };

  const filteredEmployees = useMemo(() => {
    const q = norm(employeeSearch);

    return (staffList || [])
      .filter((s) => {
        if (!q) return true;

        return [
          s.employee_no,
          s.fullname,
          s.first_name,
          s.middle_name,
          s.last_name,
          displayName(s),
          s.branch_code,
          s.branch_name,
          s.area,
          s.region,
          s.division,
        ]
          .map(toStr)
          .join(" ")
          .toLowerCase()
          .includes(q);
      })
      .slice(0, 30);
  }, [staffList, employeeSearch]);

  const handleChooseEmployee = (s) => {
    setForm((prev) => ({
      ...prev,
      employee_id: String(s.id || ""),
      employee_name: displayName(s),
      branch_id: String(s.branch_id || ""),
      branch_code: toStr(s.branch_code),
      branch_name: toStr(s.branch_name),
      area: toStr(s.area),
      region: toStr(s.region),
      division: toStr(s.division),
    }));

    setEmployeeSearch(
      `${toStr(s.employee_no) ? `${toStr(s.employee_no)} - ` : ""}${displayName(s)}`
    );

    setShowEmployeeDropdown(false);
  };

  const updateRequestInState = (updated) => {
    setRequests((prev) =>
      prev.map((r) => (Number(r.id) === Number(updated.id) ? updated : r))
    );
    setSelectedRequest(updated);
  };

  const createRequest = async (e) => {
    e.preventDefault();

    if (!form.employee_id) return alert("Select employee.");
    if (!form.date_created) return alert("Date created is required.");
    if (!form.effective_date) return alert("Effective date is required.");
    if (!form.reason) return alert("Reason is required.");

    try {
      setLoadingCreate(true);

      const fd = new FormData();
      fd.append("employee_id", form.employee_id);
      fd.append("date_created", form.date_created);
      fd.append("effective_date", form.effective_date);
      fd.append("reason", form.reason || "");
      fd.append("remarks", form.remarks || "");

      if (attachmentFile) fd.append("attachment", attachmentFile);

      await api.post("/termination-requests", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      alert("Termination of Contract created.");
      closeCreateModal();
      await fetchRequests();
    } catch (err) {
      if (err?.response?.status === 401) return logout();
      alert(err?.response?.data?.message || "Failed to create Termination request.");
    } finally {
      setLoadingCreate(false);
    }
  };

  const rejectRequest = async (row) => {
    const reason = prompt("Enter rejection reason:");
    if (!reason || !reason.trim()) return;

    try {
      setActionLoading(true);

      const res = await api.put(`/termination-requests/${row.id}/reject`, {
        reason: reason.trim(),
      });

      updateRequestInState(res.data);
      alert("Termination request rejected.");
    } catch (err) {
      if (err?.response?.status === 401) return logout();
      alert(err?.response?.data?.message || "Failed to reject request.");
    } finally {
      setActionLoading(false);
    }
  };

  const voidRequest = async (row) => {
    const reason = prompt("Enter void reason, optional:");
    if (!window.confirm("Void this approved Termination request?")) return;

    try {
      setActionLoading(true);

      const res = await api.put(`/termination-requests/${row.id}/void`, {
        reason: reason || "",
      });

      updateRequestInState(res.data);
      alert("Termination request voided.");
    } catch (err) {
      if (err?.response?.status === 401) return logout();
      alert(err?.response?.data?.message || "Failed to void request.");
    } finally {
      setActionLoading(false);
    }
  };

  const deleteRequest = async (row) => {
    if (!window.confirm("Delete this Termination request permanently?")) return;

    try {
      setActionLoading(true);

      await api.delete(`/termination-requests/${row.id}`);

      setRequests((prev) => prev.filter((r) => Number(r.id) !== Number(row.id)));
      closeViewModal();
      alert("Termination request deleted.");
    } catch (err) {
      if (err?.response?.status === 401) return logout();
      alert(err?.response?.data?.message || "Failed to delete request.");
    } finally {
      setActionLoading(false);
    }
  };

  const uploadFinalFile = async () => {
    if (!selectedRequest?.id) return;
    if (!finalFile) return alert("Choose final approved file first.");

    try {
      setActionLoading(true);

      const fd = new FormData();
      fd.append("attachment", finalFile);

      const res = await api.post(
        `/termination-requests/${selectedRequest.id}/final-file`,
        fd,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );

      updateRequestInState(res.data);
      setFinalFile(null);
      alert("Final file uploaded. Termination request approved.");
    } catch (err) {
      if (err?.response?.status === 401) return logout();
      alert(err?.response?.data?.message || "Failed to upload final file.");
    } finally {
      setActionLoading(false);
    }
  };

  const downloadFile = async (row, type) => {
    try {
      const res = await api.get(`/termination-requests/${row.id}/download/${type}`, {
        responseType: "blob",
      });

      const blob = new Blob([res.data]);
      const url = window.URL.createObjectURL(blob);

      const name =
        type === "approved"
          ? row.approved_attachment_name
          : row.request_attachment_name;

      const a = document.createElement("a");
      a.href = url;
      a.download = name || `termination-${row.id}-${type}`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      window.URL.revokeObjectURL(url);
    } catch {
      alert("Failed to download file.");
    }
  };

  const badgeClass = (status) => {
    if (status === STATUS_APPROVED) return "badge badge-approved";
    if (status === STATUS_REJECTED) return "badge badge-rejected";
    if (status === STATUS_VOID) return "badge badge-rejected";
    return "badge badge-pending";
  };

  const latestFileName = (r) =>
    r?.approved_attachment_name || r?.request_attachment_name || "-";

  const latestFileType = (r) =>
    r?.approved_attachment_path ? "approved" : "request";

  const filteredRequests = useMemo(() => {
    const q = norm(search);

    return (requests || []).filter((r) => {
      if (!q) return true;

      return [
        r.request_no,
        r.employee_name,
        r.branch_code,
        r.branch_name,
        r.area,
        r.region,
        r.division,
        r.department,
        r.position,
        r.status,
        r.reason,
        r.remarks,
        r.date_created,
        r.effective_date,
      ]
        .map(toStr)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [requests, search]);

  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / pageSize));

  const pagedRequests = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRequests.slice(start, start + pageSize);
  }, [filteredRequests, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [search, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const getPageNumbers = () => {
    const pages = [];
    const maxButtons = 5;

    let start = Math.max(1, page - 2);
    let end = Math.min(totalPages, start + maxButtons - 1);

    if (end - start < maxButtons - 1) {
      start = Math.max(1, end - maxButtons + 1);
    }

    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  };

  if (!canView) {
    return (
      <div className="empty-state">
        You do not have access to Termination of Contract.
      </div>
    );
  }

  const totalRequests = filteredRequests.length;

  const pendingRequests = filteredRequests.filter(
    (request) =>
      ![
        STATUS_APPROVED,
        STATUS_REJECTED,
        STATUS_VOID,
      ].includes(request.status)
  ).length;

  const approvedRequests = filteredRequests.filter(
    (request) => request.status === STATUS_APPROVED
  ).length;

  const closedRequests = filteredRequests.filter(
    (request) =>
      request.status === STATUS_REJECTED ||
      request.status === STATUS_VOID
  ).length;

  return (
    <div
      className={
        embedded
          ? "termination-page termination-page-embedded"
          : "termination-page"
      }
    >
      {!embedded && (
        <section className="termination-hero">
          <div className="termination-hero-main">
            <div className="termination-hero-copy">
              <span className="termination-eyebrow">
                HRIS TRANSACTIONS
              </span>

              <h1>Termination of Contract</h1>

              <p>
                Create, review, and process employee termination
                requests through the required final approval workflow.
              </p>

              <div className="termination-flow">
                <span>APPROVAL FLOW</span>
                <b>
                  HR / Accounting / IT / Admin → Final File Upload
                </b>
              </div>
            </div>

            <div className="termination-hero-actions">
              <button
                className="termination-btn termination-btn-secondary"
                type="button"
                onClick={() => window.history.back()}
              >
                ← Back
              </button>

              <button
                className="termination-btn termination-btn-secondary"
                type="button"
                onClick={refreshAll}
                disabled={loadingList}
              >
                {loadingList ? "Refreshing..." : "Refresh"}
              </button>

              {canCreate && (
                <button
                  className="termination-btn termination-btn-primary"
                  type="button"
                  onClick={openCreateModal}
                >
                  + Create Termination
                </button>
              )}
            </div>
          </div>
        </section>
      )}

      {embedded && (
        <div className="termination-embedded-toolbar">
          <button
            className="termination-btn termination-btn-secondary"
            type="button"
            onClick={refreshAll}
            disabled={loadingList}
          >
            {loadingList ? "Refreshing..." : "Refresh"}
          </button>

          {canCreate && (
            <button
              className="termination-btn termination-btn-primary"
              type="button"
              onClick={openCreateModal}
            >
              + Create Termination
            </button>
          )}
        </div>
      )}

      <section className="termination-summary-grid">
        <article className="termination-summary-card termination-summary-total">
          <div className="termination-summary-icon">ALL</div>

          <div>
            <span>Total Requests</span>
            <strong>{totalRequests}</strong>
            <small>All termination records</small>
          </div>
        </article>

        <article className="termination-summary-card termination-summary-pending">
          <div className="termination-summary-icon">P</div>

          <div>
            <span>Pending</span>
            <strong>{pendingRequests}</strong>
            <small>Awaiting final action</small>
          </div>
        </article>

        <article className="termination-summary-card termination-summary-approved">
          <div className="termination-summary-icon">A</div>

          <div>
            <span>Approved</span>
            <strong>{approvedRequests}</strong>
            <small>Completed requests</small>
          </div>
        </article>

        <article className="termination-summary-card termination-summary-closed">
          <div className="termination-summary-icon">R</div>

          <div>
            <span>Rejected / Voided</span>
            <strong>{closedRequests}</strong>
            <small>Closed requests</small>
          </div>
        </article>
      </section>

      <section className="termination-list-card">
        <div className="termination-search-panel">
          <div className="termination-search-controls">
            <input
              className="termination-search-input"
              value={searchText}
              onChange={(event) =>
                setSearchText(event.target.value)
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  setSearch(searchText);
                }
              }}
              placeholder="Search request no, employee, branch, status..."
            />

            <button
              className="termination-btn termination-btn-secondary"
              type="button"
              onClick={() => setSearch(searchText)}
            >
              Search
            </button>

            <button
              className="termination-btn termination-btn-secondary"
              type="button"
              onClick={() => {
                setSearchText("");
                setSearch("");
              }}
            >
              Clear
            </button>
          </div>

          <span className="termination-result-count">
            {filteredRequests.length}{" "}
            {filteredRequests.length === 1
              ? "result"
              : "results"}
          </span>
        </div>

        <div className="termination-table-wrap">
          <table className="termination-table">
            <thead>
              <tr>
                <th>Request No</th>
                <th>Employee</th>
                <th>Branch</th>
                <th>Area</th>
                <th>Region</th>
                <th>Date Created</th>
                <th>Effective Date</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {loadingList ? (
                <tr>
                  <td
                    colSpan={9}
                    className="termination-empty"
                  >
                    Loading termination requests...
                  </td>
                </tr>
              ) : filteredRequests.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="termination-empty"
                  >
                    No termination requests found.
                  </td>
                </tr>
              ) : (
                pagedRequests.map((request) => (
                  <tr key={request.id}>
                    <td className="termination-request-no">
                      {request.request_no || "-"}
                    </td>

                    <td className="termination-employee">
                      {request.employee_name || "-"}
                    </td>

                    <td>
                      {branchLabel({
                        branch_code: request.branch_code,
                        branch_name: request.branch_name,
                      })}
                    </td>

                    <td>{request.area || "-"}</td>
                    <td>{request.region || "-"}</td>
                    <td>{fmtDate(request.date_created)}</td>
                    <td>{fmtDate(request.effective_date)}</td>

                    <td>
                      <span className={badgeClass(request.status)}>
                        {request.status || "Pending"}
                      </span>
                    </td>

                    <td>
                      <div className="termination-row-actions">
                        <button
                          className="termination-view-btn"
                          type="button"
                          onClick={() =>
                            openViewModal(request)
                          }
                        >
                          View
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="termination-pager">
          <div className="termination-pager-left">
            <span>Rows per page</span>

            <select
              value={pageSize}
              onChange={(event) =>
                setPageSize(Number(event.target.value))
              }
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={75}>75</option>
              <option value={100}>100</option>
            </select>
          </div>

          <div className="termination-pager-right">
            <button
              className="termination-page-btn"
              type="button"
              disabled={page <= 1}
              onClick={() =>
                setPage((current) =>
                  Math.max(1, current - 1)
                )
              }
            >
              ‹
            </button>

            {getPageNumbers().map((pageNumber) => (
              <button
                key={pageNumber}
                className={`termination-page-number ${
                  page === pageNumber ? "active" : ""
                }`}
                type="button"
                onClick={() => setPage(pageNumber)}
              >
                {pageNumber}
              </button>
            ))}

            <button
              className="termination-page-btn"
              type="button"
              disabled={page >= totalPages}
              onClick={() =>
                setPage((current) =>
                  Math.min(totalPages, current + 1)
                )
              }
            >
              ›
            </button>

            <span className="termination-page-summary">
              Page {page} of {totalPages}
            </span>
          </div>
        </div>
      </section>

      {showCreateModal && (
        <div
          className="modal-overlay"
          onMouseDown={(event) =>
            event.target.classList.contains("modal-overlay") &&
            closeCreateModal()
          }
        >
          <div
            className="modal saas-modal termination-create-modal"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            <div className="modal-head">
              <div>
                <h3 className="modal-title">
                  Create Termination of Contract
                </h3>

                <p className="modal-subtitle">
                  Select an employee, set the effective date,
                  provide the reason, and upload the supporting
                  request file.
                </p>
              </div>

              <button
                className="modal-x"
                onClick={closeCreateModal}
                type="button"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={createRequest}
              className="modal-form"
            >
              <div className="modal-grid termination-modal-grid">
                <div
                  className="form-group termination-employee-picker"
                  ref={employeePickerRef}
                >
                  <label>Employee</label>

                  <input
                    type="text"
                    placeholder="Search Employee..."
                    value={employeeSearch}
                    onChange={(event) => {
                      setEmployeeSearch(event.target.value);
                      setShowEmployeeDropdown(true);

                      setForm((previous) => ({
                        ...previous,
                        employee_id: "",
                        employee_name: "",
                        branch_id: "",
                        branch_code: "",
                        branch_name: "",
                        area: "",
                        region: "",
                        division: "",
                      }));
                    }}
                    onFocus={() =>
                      setShowEmployeeDropdown(true)
                    }
                    required={!form.employee_id}
                  />

                  {showEmployeeDropdown && (
                    <div className="approval-search-dropdown">
                      {filteredEmployees.length === 0 ? (
                        <div className="approval-search-empty">
                          No results
                        </div>
                      ) : (
                        filteredEmployees.map((staff) => (
                          <button
                            key={staff.id}
                            type="button"
                            className="approval-search-item"
                            onClick={() =>
                              handleChooseEmployee(staff)
                            }
                          >
                            {(staff.employee_no
                              ? `${staff.employee_no} - `
                              : "") + displayName(staff)}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label>Branch</label>

                  <input
                    value={branchLabel(form)}
                    readOnly
                    placeholder="Auto-filled"
                  />
                </div>

                <div className="form-group">
                  <label>Area</label>

                  <input
                    value={form.area}
                    readOnly
                    placeholder="Auto-filled"
                  />
                </div>

                <div className="form-group">
                  <label>Region</label>

                  <input
                    value={form.region}
                    readOnly
                    placeholder="Auto-filled"
                  />
                </div>

                <div className="form-group">
                  <label>Division</label>

                  <input
                    value={form.division}
                    readOnly
                    placeholder="Auto-filled"
                  />
                </div>

                <div className="form-group">
                  <label>Date Created</label>

                  <input
                    type="date"
                    value={form.date_created}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        date_created: event.target.value,
                      }))
                    }
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Effective Date</label>

                  <input
                    type="date"
                    value={form.effective_date}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        effective_date: event.target.value,
                      }))
                    }
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Upload Request File</label>

                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                    onChange={(event) =>
                      setAttachmentFile(
                        event.target.files?.[0] || null
                      )
                    }
                  />
                </div>

                <div className="form-group full">
                  <label>Reason</label>

                  <textarea
                    value={form.reason}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        reason: event.target.value,
                      }))
                    }
                    placeholder="Reason for termination..."
                    required
                  />
                </div>

                <div className="form-group full">
                  <label>Remarks</label>

                  <textarea
                    value={form.remarks}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        remarks: event.target.value,
                      }))
                    }
                    placeholder="Remarks..."
                  />
                </div>
              </div>

              <div className="modal-buttons">
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={closeCreateModal}
                  disabled={loadingCreate}
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

      {showViewModal && selectedRequest && (
        <div
          className="modal-overlay"
          onMouseDown={(event) =>
            event.target.classList.contains("modal-overlay") &&
            closeViewModal()
          }
        >
          <div
            className="modal saas-modal view-report-modal termination-view-modal"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            <div className="modal-head">
              <div>
                <h3 className="modal-title">
                  Termination Details
                </h3>

                <p className="modal-subtitle">
                  {selectedRequest.request_no} —{" "}
                  {selectedRequest.status}
                </p>
              </div>

              <button
                className="modal-x"
                onClick={closeViewModal}
                type="button"
              >
                ✕
              </button>
            </div>

            <div className="modal-grid termination-view-grid">
              <div className="form-group">
                <label>Employee</label>
                <input
                  value={toStr(
                    selectedRequest.employee_name
                  )}
                  readOnly
                />
              </div>

              <div className="form-group">
                <label>Status</label>
                <input
                  value={toStr(selectedRequest.status)}
                  readOnly
                />
              </div>

              <div className="form-group">
                <label>Branch</label>
                <input
                  value={branchLabel({
                    branch_code:
                      selectedRequest.branch_code,
                    branch_name:
                      selectedRequest.branch_name,
                  })}
                  readOnly
                />
              </div>

              <div className="form-group">
                <label>Area</label>
                <input
                  value={toStr(selectedRequest.area)}
                  readOnly
                />
              </div>

              <div className="form-group">
                <label>Region</label>
                <input
                  value={toStr(selectedRequest.region)}
                  readOnly
                />
              </div>

              <div className="form-group">
                <label>Division</label>
                <input
                  value={toStr(
                    selectedRequest.division
                  )}
                  readOnly
                />
              </div>

              <div className="form-group">
                <label>Date Created</label>
                <input
                  value={fmtDate(
                    selectedRequest.date_created
                  )}
                  readOnly
                />
              </div>

              <div className="form-group">
                <label>Effective Date</label>
                <input
                  value={fmtDate(
                    selectedRequest.effective_date
                  )}
                  readOnly
                />
              </div>

              <div className="form-group full">
                <label>Reason</label>
                <textarea
                  value={toStr(selectedRequest.reason)}
                  readOnly
                />
              </div>

              <div className="form-group full">
                <label>Remarks</label>
                <textarea
                  value={toStr(selectedRequest.remarks)}
                  readOnly
                />
              </div>
            </div>

            <div className="termination-file-table table-card">
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>File Type</th>
                      <th>File Name</th>
                      <th>Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    <tr>
                      <td>Latest File</td>
                      <td>
                        {latestFileName(selectedRequest)}
                      </td>
                      <td>
                        {selectedRequest.approved_attachment_path ||
                        selectedRequest.request_attachment_path ? (
                          <button
                            className="btn-secondary"
                            type="button"
                            onClick={() =>
                              downloadFile(
                                selectedRequest,
                                latestFileType(
                                  selectedRequest
                                )
                              )
                            }
                          >
                            Download Latest
                          </button>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>

                    <tr>
                      <td>Original Request File</td>
                      <td>
                        {selectedRequest.request_attachment_name ||
                          "-"}
                      </td>
                      <td>
                        {selectedRequest.request_attachment_path ? (
                          <button
                            className="btn-secondary"
                            type="button"
                            onClick={() =>
                              downloadFile(
                                selectedRequest,
                                "request"
                              )
                            }
                          >
                            Download
                          </button>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {selectedRequest.status === STATUS_WAITING_FINAL &&
              canFinalUpload && (
                <div className="termination-upload-box">
                  <div className="form-group">
                    <label>
                      Upload Final Approved File
                    </label>

                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                      onChange={(event) =>
                        setFinalFile(
                          event.target.files?.[0] || null
                        )
                      }
                    />
                  </div>
                </div>
              )}

            <div className="termination-view-actions">
              <button
                className="btn-secondary"
                type="button"
                onClick={closeViewModal}
              >
                Close
              </button>

              {selectedRequest.status ===
                STATUS_WAITING_FINAL &&
                canReject && (
                  <button
                    className="btn-danger"
                    type="button"
                    disabled={actionLoading}
                    onClick={() =>
                      rejectRequest(selectedRequest)
                    }
                  >
                    Reject
                  </button>
                )}

              {selectedRequest.status ===
                STATUS_APPROVED &&
                canVoid && (
                  <button
                    className="btn-danger"
                    type="button"
                    disabled={actionLoading}
                    onClick={() =>
                      voidRequest(selectedRequest)
                    }
                  >
                    Void
                  </button>
                )}

              {(selectedRequest.status ===
                STATUS_REJECTED ||
                selectedRequest.status ===
                  STATUS_VOID) &&
                canDelete && (
                  <button
                    className="btn-danger"
                    type="button"
                    disabled={actionLoading}
                    onClick={() =>
                      deleteRequest(selectedRequest)
                    }
                  >
                    Delete
                  </button>
                )}
              
              {selectedRequest.status === STATUS_WAITING_FINAL &&
                canFinalUpload && (
                  <button
                    className="btn-primary"
                    type="button"
                    onClick={uploadFinalFile}
                    disabled={actionLoading || !finalFile}
                  >
                    {actionLoading
                      ? "Uploading..."
                      : "Upload Final File & Approve"}
                  </button>
                )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}