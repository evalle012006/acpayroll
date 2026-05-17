import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axiosClient";
import "../styles/StaffReport.css";

const STATUS_PENDING_VP = "Pending Vice President";
const STATUS_WAITING_HR = "Waiting HR Final File";
const STATUS_APPROVED = "Approved";
const STATUS_REJECTED = "Rejected";

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

export default function StaffReport() {
  const navigate = useNavigate();
  const user = useMemo(() => readUser(), []);
  const role = norm(user?.role);

  const isAdmin = role === "admin";
  const isIT = role === "it";
  const isHR = role === "hr";
  const isVP = role === "vice president";
  const isBM = role === "branch manager";
  const isAM = role === "area manager";
  const isRM = role === "regional manager";
  const isAVP = role === "assistant vice president";

  const canCreate = isAdmin || isIT || isBM || isAM || isRM || isAVP;
  const canVPApprove = isAdmin || isIT || isVP;
  const canHRUpload = isAdmin || isIT || isHR;

  const employeePickerRef = useRef(null);

  const [staffList, setStaffList] = useState([]);
  const [reports, setReports] = useState([]);

  const [loadingList, setLoadingList] = useState(false);
  const [loadingCreate, setLoadingCreate] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);

  const [employeeSearch, setEmployeeSearch] = useState("");
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
  const [attachmentFile, setAttachmentFile] = useState(null);
  const [hrFinalFile, setHrFinalFile] = useState(null);

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
    awol_date: "",
    details: "",
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

  const fetchReports = useCallback(async () => {
    try {
      setLoadingList(true);
      const res = await api.get("/awol-reports");
      setReports(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      if (err?.response?.status === 401) return logout();
      setReports([]);
      alert(err?.response?.data?.message || "Failed to load AWOL reports.");
    } finally {
      setLoadingList(false);
    }
  }, [logout]);

  const refreshAll = useCallback(async () => {
    await Promise.all([fetchStaff(), fetchReports()]);
  }, [fetchStaff, fetchReports]);

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!user || !token) {
      window.location.href = "/login";
      return;
    }

    refreshAll();
  }, [user, refreshAll]);

  useEffect(() => {
    const onMouseDown = (e) => {
      if (
        employeePickerRef.current &&
        !employeePickerRef.current.contains(e.target)
      ) {
        setShowEmployeeDropdown(false);
      }
    };

    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

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
      awol_date: "",
      details: "",
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

  const openViewModal = (report) => {
    setSelectedReport(report);
    setHrFinalFile(null);
    setShowViewModal(true);
  };

  const closeViewModal = () => {
    setSelectedReport(null);
    setHrFinalFile(null);
    setShowViewModal(false);
  };

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

  const createReport = async (e) => {
    e.preventDefault();

    if (!form.employee_id) return alert("Select employee.");
    if (!form.date_created) return alert("Date created required.");
    if (!form.awol_date) return alert("AWOL date required.");

    try {
      setLoadingCreate(true);

      const fd = new FormData();
      fd.append("employee_id", form.employee_id);
      fd.append("date_created", form.date_created);
      fd.append("awol_date", form.awol_date);
      fd.append("details", form.details || "");

      if (attachmentFile) {
        fd.append("attachment", attachmentFile);
      }

      await api.post("/awol-reports", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      alert("AWOL report created.");
      closeCreateModal();
      await fetchReports();
    } catch (err) {
      if (err?.response?.status === 401) return logout();
      alert(err?.response?.data?.message || "Failed to create AWOL report.");
    } finally {
      setLoadingCreate(false);
    }
  };

  const approveVP = async (report) => {
    try {
      setActionLoading(true);

      const res = await api.put(`/awol-reports/${report.id}/vp-approve`);
      const updated = res.data;

      setReports((prev) =>
        prev.map((r) => (Number(r.id) === Number(updated.id) ? updated : r))
      );

      setSelectedReport(updated);
      alert("Approved by Vice President. Waiting HR final file.");
    } catch (err) {
      if (err?.response?.status === 401) return logout();
      alert(err?.response?.data?.message || "Failed to approve report.");
    } finally {
      setActionLoading(false);
    }
  };

  const rejectReport = async (report) => {
    const reason = prompt("Enter rejection reason:");
    if (!reason || !reason.trim()) return;

    try {
      setActionLoading(true);

      const res = await api.put(`/awol-reports/${report.id}/reject`, {
        reason: reason.trim(),
      });

      const updated = res.data;

      setReports((prev) =>
        prev.map((r) => (Number(r.id) === Number(updated.id) ? updated : r))
      );

      setSelectedReport(updated);
      alert("AWOL report rejected.");
    } catch (err) {
      if (err?.response?.status === 401) return logout();
      alert(err?.response?.data?.message || "Failed to reject report.");
    } finally {
      setActionLoading(false);
    }
  };

  const uploadHRFinalFile = async () => {
    if (!selectedReport?.id) return;
    if (!hrFinalFile) return alert("Choose final HR file first.");

    try {
      setActionLoading(true);

      const fd = new FormData();
      fd.append("attachment", hrFinalFile);

      const res = await api.post(
        `/awol-reports/${selectedReport.id}/hr-final-file`,
        fd,
        { headers: { "Content-Type": "multipart/form-data" } }
      );

      const updated = res.data;

      setReports((prev) =>
        prev.map((r) => (Number(r.id) === Number(updated.id) ? updated : r))
      );

      setSelectedReport(updated);
      setHrFinalFile(null);
      alert("HR final file uploaded. AWOL report approved.");
    } catch (err) {
      if (err?.response?.status === 401) return logout();
      alert(err?.response?.data?.message || "Failed to upload final file.");
    } finally {
      setActionLoading(false);
    }
  };

  const downloadFile = async (report, type) => {
    try {
      const res = await api.get(`/awol-reports/${report.id}/download/${type}`, {
        responseType: "blob",
      });

      const blob = new Blob([res.data]);
      const url = window.URL.createObjectURL(blob);

      const name =
        type === "approved"
          ? report.approved_attachment_name
          : report.request_attachment_name;

      const a = document.createElement("a");
      a.href = url;
      a.download = name || `awol-${report.id}-${type}`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to download file.");
    }
  };

  const badgeClass = (status) => {
    if (status === STATUS_APPROVED) return "badge badge-approved";
    if (status === STATUS_REJECTED) return "badge badge-rejected";
    return "badge badge-pending";
  };

  const filteredReports = useMemo(() => {
    const q = norm(search);

    return (reports || []).filter((r) => {
      if (!q) return true;

      return [
        r.report_no,
        r.employee_name,
        r.branch_code,
        r.branch_name,
        r.area,
        r.region,
        r.division,
        r.status,
        r.details,
        r.date_created,
        r.awol_date,
      ]
        .map(toStr)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [reports, search]);

  const totalPages = Math.max(1, Math.ceil(filteredReports.length / pageSize));

  const pagedReports = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredReports.slice(start, start + pageSize);
  }, [filteredReports, page, pageSize]);

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

  return (
    <div className="approval-page staff-report-page">
      <div className="approval-page-header">
        <div>
          <h2 className="approval-title">Staff Report</h2>
          <p className="approval-subtitle">
            Create and manage AWOL staff reports.
          </p>
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
            onClick={refreshAll}
            type="button"
            disabled={loadingList}
          >
            {loadingList ? "Refreshing..." : "Refresh"}
          </button>

          {canCreate ? (
            <button className="btn-primary" onClick={openCreateModal} type="button">
              + Create AWOL Report
            </button>
          ) : null}
        </div>
      </div>

      <div className="leave-searchbar">
        <input
          className="leave-search-input"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && setSearch(searchText)}
          placeholder="Search report no, name, branch, status..."
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
          {filteredReports.length} result(s)
        </span>
      </div>

      <div className="leave-pager">
        <div className="leave-pager-left">
          <span>Rows per page</span>

          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={75}>75</option>
            <option value={100}>100</option>
          </select>
        </div>

        <div className="leave-pager-right">
          <button
            className="leave-page-btn"
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            ‹
          </button>

          {getPageNumbers().map((p) => (
            <button
              key={p}
              className={`leave-page-number ${page === p ? "active" : ""}`}
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
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
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
                <th>Report No</th>
                <th>Employee</th>
                <th>Branch</th>
                <th>Area</th>
                <th>Region</th>
                <th>Date Created</th>
                <th>AWOL Date</th>
                <th>Status</th>
                <th style={{ width: 150 }}>Action</th>
              </tr>
            </thead>

            <tbody>
              {loadingList ? (
                <tr>
                  <td colSpan={9} className="empty-state">
                    Loading…
                  </td>
                </tr>
              ) : filteredReports.length === 0 ? (
                <tr>
                  <td colSpan={9} className="empty-state">
                    No AWOL reports found.
                  </td>
                </tr>
              ) : (
                pagedReports.map((r) => (
                  <tr key={r.id}>
                    <td className="td-strong">{r.report_no}</td>
                    <td>{r.employee_name}</td>
                    <td>
                      {toStr(r.branch_code)} - {toStr(r.branch_name)}
                    </td>
                    <td>{r.area || "-"}</td>
                    <td>{r.region || "-"}</td>
                    <td>{fmtDate(r.date_created)}</td>
                    <td>{fmtDate(r.awol_date)}</td>
                    <td>
                      <span className={badgeClass(r.status)}>{r.status}</span>
                      {r.status === STATUS_REJECTED && r.rejection_reason ? (
                        <div
                          style={{
                            marginTop: 6,
                            fontSize: 12,
                            color: "var(--muted)",
                          }}
                        >
                          Reason: {r.rejection_reason}
                        </div>
                      ) : null}
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="btn-secondary"
                          type="button"
                          onClick={() => openViewModal(r)}
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
      </div>

      {showCreateModal && (
        <div
          className="modal-overlay"
          onMouseDown={(e) =>
            e.target.classList.contains("modal-overlay") && closeCreateModal()
          }
        >
          <div
            className="modal saas-modal"
            onMouseDown={(e) => e.stopPropagation()}
            style={{ overflow: "visible", maxWidth: 950, width: "95%" }}
          >
            <div className="modal-head">
              <div>
                <h3 className="modal-title">Create AWOL Report</h3>
                <p className="modal-subtitle">
                  Report will go directly to Vice President approval.
                </p>
              </div>

              <button className="modal-x" onClick={closeCreateModal} type="button">
                ✕
              </button>
            </div>

            <form onSubmit={createReport} className="modal-form">
              <div className="modal-grid" style={{ overflow: "visible" }}>
                <div
                  className="form-group"
                  ref={employeePickerRef}
                  style={{ position: "relative", zIndex: 50 }}
                >
                  <label>Employee</label>

                  <input
                    type="text"
                    placeholder="Search Employee..."
                    value={employeeSearch}
                    onChange={(e) => {
                      setEmployeeSearch(e.target.value);
                      setShowEmployeeDropdown(true);
                      setForm((prev) => ({
                        ...prev,
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
                    onFocus={() => setShowEmployeeDropdown(true)}
                    required={!form.employee_id}
                  />

                  {showEmployeeDropdown ? (
                    <div className="approval-search-dropdown">
                      {filteredEmployees.length === 0 ? (
                        <div className="approval-search-empty">No results</div>
                      ) : (
                        filteredEmployees.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            className="approval-search-item"
                            onClick={() => handleChooseEmployee(s)}
                          >
                            {(s.employee_no ? `${s.employee_no} - ` : "") +
                              displayName(s)}
                          </button>
                        ))
                      )}
                    </div>
                  ) : null}
                </div>

                <div className="form-group">
                  <label>Branch</label>
                  <input value={branchLabel(form)} readOnly placeholder="Auto-filled" />
                </div>

                <div className="form-group">
                  <label>Area</label>
                  <input value={form.area} readOnly placeholder="Auto-filled" />
                </div>

                <div className="form-group">
                  <label>Region</label>
                  <input value={form.region} readOnly placeholder="Auto-filled" />
                </div>

                <div className="form-group">
                  <label>Division</label>
                  <input value={form.division} readOnly placeholder="Auto-filled" />
                </div>

                <div className="form-group">
                  <label>Date Created</label>
                  <input
                    type="date"
                    value={form.date_created}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, date_created: e.target.value }))
                    }
                    required
                  />
                </div>

                <div className="form-group">
                  <label>AWOL Date</label>
                  <input
                    type="date"
                    value={form.awol_date}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, awol_date: e.target.value }))
                    }
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Upload AWOL File</label>
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                    onChange={(e) => setAttachmentFile(e.target.files?.[0] || null)}
                  />
                </div>

                <div className="form-group full">
                  <label>Details</label>
                  <textarea
                    value={form.details}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, details: e.target.value }))
                    }
                    placeholder="AWOL report details..."
                  />
                </div>
              </div>

              <div className="modal-buttons">
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={closeCreateModal}
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

      {showViewModal && selectedReport && (
        <div
          className="modal-overlay"
          onMouseDown={(e) =>
            e.target.classList.contains("modal-overlay") && closeViewModal()
          }
        >
          <div
            className="modal saas-modal"
            onMouseDown={(e) => e.stopPropagation()}
            style={{ maxWidth: 950, width: "95%" }}
          >
            <div className="modal-head">
              <div>
                <h3 className="modal-title">AWOL Report Details</h3>
                <p className="modal-subtitle">
                  {selectedReport.report_no} — {selectedReport.status}
                </p>
              </div>

              <button className="modal-x" onClick={closeViewModal} type="button">
                ✕
              </button>
            </div>

            <div className="modal-grid">
              <div className="form-group">
                <label>Employee</label>
                <input value={toStr(selectedReport.employee_name)} readOnly />
              </div>

              <div className="form-group">
                <label>Status</label>
                <input value={toStr(selectedReport.status)} readOnly />
              </div>

              <div className="form-group">
                <label>Branch</label>
                <input
                  value={`${toStr(selectedReport.branch_code)} - ${toStr(
                    selectedReport.branch_name
                  )}`}
                  readOnly
                />
              </div>

              <div className="form-group">
                <label>Area</label>
                <input value={toStr(selectedReport.area)} readOnly />
              </div>

              <div className="form-group">
                <label>Region</label>
                <input value={toStr(selectedReport.region)} readOnly />
              </div>

              <div className="form-group">
                <label>Division</label>
                <input value={toStr(selectedReport.division)} readOnly />
              </div>

              <div className="form-group">
                <label>Date Created</label>
                <input value={fmtDate(selectedReport.date_created)} readOnly />
              </div>

              <div className="form-group">
                <label>AWOL Date</label>
                <input value={fmtDate(selectedReport.awol_date)} readOnly />
              </div>

              <div className="form-group full">
                <label>Details</label>
                <textarea value={toStr(selectedReport.details)} readOnly />
              </div>
            </div>

            <div className="table-card" style={{ marginTop: 14 }}>
              <div className="table-wrap" style={{ maxHeight: "unset" }}>
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
                      <td>Request File</td>
                      <td>{selectedReport.request_attachment_name || "-"}</td>
                      <td>
                        {selectedReport.request_attachment_path ? (
                          <button
                            className="btn-secondary"
                            type="button"
                            onClick={() => downloadFile(selectedReport, "request")}
                          >
                            Download
                          </button>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>

                    <tr>
                      <td>HR Final File</td>
                      <td>{selectedReport.approved_attachment_name || "-"}</td>
                      <td>
                        {selectedReport.approved_attachment_path ? (
                          <button
                            className="btn-secondary"
                            type="button"
                            onClick={() => downloadFile(selectedReport, "approved")}
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

            {selectedReport.status === STATUS_WAITING_HR && canHRUpload ? (
              <div style={{ marginTop: 14 }}>
                <div className="form-group">
                  <label>HR Final Approved File</label>
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                    onChange={(e) => setHrFinalFile(e.target.files?.[0] || null)}
                  />
                </div>

                <button
                  className="btn-primary"
                  type="button"
                  style={{ marginTop: 10 }}
                  onClick={uploadHRFinalFile}
                  disabled={actionLoading}
                >
                  {actionLoading ? "Uploading..." : "Upload Final File & Approve"}
                </button>
              </div>
            ) : null}

            <div className="modal-buttons">
              <button className="btn-secondary" type="button" onClick={closeViewModal}>
                Close
              </button>

              {selectedReport.status === STATUS_PENDING_VP && canVPApprove ? (
                <>
                  <button
                    className="btn-danger"
                    type="button"
                    disabled={actionLoading}
                    onClick={() => rejectReport(selectedReport)}
                  >
                    Reject
                  </button>

                  <button
                    className="btn-success"
                    type="button"
                    disabled={actionLoading}
                    onClick={() => approveVP(selectedReport)}
                  >
                    {actionLoading ? "Approving..." : "VP Approve"}
                  </button>
                </>
              ) : null}

              {selectedReport.status === STATUS_WAITING_HR && canHRUpload ? (
                <button
                  className="btn-danger"
                  type="button"
                  disabled={actionLoading}
                  onClick={() => rejectReport(selectedReport)}
                >
                  Reject
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}