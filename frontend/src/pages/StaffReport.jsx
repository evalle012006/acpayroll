import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axiosClient";
import "../styles/StaffReport.css";

const STATUS_AREA = "Waiting Area Manager Approval";
const STATUS_REGIONAL = "Waiting Regional Manager Approval";
const STATUS_AVP = "Waiting Assistant Vice President Approval";
const STATUS_VP = "Waiting Vice President Approval";
const STATUS_HR = "Waiting HR Department Approval";
const STATUS_WAITING_FINAL = "Waiting Final File Upload";
const STATUS_APPROVED = "Approved";
const STATUS_REJECTED = "Rejected";
const STATUS_VOID = "Voided";

const REPORT_TYPES = [
  "AWOL Report",
  "Incident Report",
];

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

const getReportType = (r) => toStr(r?.report_type) || "AWOL Report";

const dateLabel = (reportType) =>
  norm(reportType) === "incident report"
    ? "Incident Date"
    : "AWOL Date";

const fileLabel = (reportType) =>
  norm(reportType) === "incident report"
    ? "Upload Incident Report"
    : "Upload AWOL Report";

export default function StaffReport() {
  const navigate = useNavigate();
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
  const isBM = role === "branch manager";
  const isAM = role === "area manager";
  const isRM = role === "regional manager";
  const isAVP = role === "assistant vice president";
  const isVP = role === "vice president";
  const isSVP = role === "senior vice president";
  const isPresident = role === "president";

  const isOfficeOfThePresidentDept = dept === "office of the president";

  const isHRDepartment =
    isHR ||
    [
      "hr",
      "hr department",
      "human resources",
      "human resources department",
    ].includes(dept);

  const isAccountingDepartment =
    isAccounting ||
    [
      "accounting",
      "accounting department",
    ].includes(dept);

  const isAuditDepartment =
    ["audit", "audit department"].includes(dept);

  const isOperationDepartment =
    ["operation", "operation department"].includes(dept);

  const canCreate = isOperationDepartment
    ? (
        isAM ||
        isRM ||
        isAVP ||
        isVP
      )
    : (
        isAdmin ||
        isIT ||
        isHRDepartment ||
        isAccountingDepartment ||
        isAuditDepartment ||
        isBM ||
        isAM ||
        isRM ||
        isAVP ||
        isVP ||
        isSVP
      );

  const canBypassApprove =
  isAdmin ||
  isIT ||
  isHRDepartment ||
  isAccountingDepartment ||
  isAuditDepartment;

const canFinalUpload =
  isAdmin ||
  isIT ||
  isHRDepartment ||
  isAccountingDepartment ||
  isAuditDepartment;

const canVoid =
  isAdmin ||
  isIT ||
  isHRDepartment ||
  isAccountingDepartment ||
  isAuditDepartment;

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
  const [approvalHistory, setApprovalHistory] = useState([]);

  const [historyLoading, setHistoryLoading] = useState(false);

  const [employeeSearch, setEmployeeSearch] = useState("");
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);

  const [attachmentFile, setAttachmentFile] = useState(null);
  const [approvalFile, setApprovalFile] = useState(null);
  const [finalFile, setFinalFile] = useState(null);

  const [form, setForm] = useState({
    report_type: "AWOL Report",
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
      alert(err?.response?.data?.message || "Failed to load staff reports.");
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
      if (employeePickerRef.current && !employeePickerRef.current.contains(e.target)) {
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
      report_type: "AWOL Report",
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

  // =====================================================
  // LOAD APPROVAL HISTORY
  // =====================================================

  const loadApprovalHistory = async (reportId) => {
    try {
      setHistoryLoading(true);

      const response = await api.get(
        `/awol-reports/${reportId}/approval-history`
      );

      setApprovalHistory(
        Array.isArray(response.data)
          ? response.data
          : []
      );

    } catch (error) {
      console.error(
        "Failed to load approval history:",
        error
      );

      setApprovalHistory([]);

    } finally {
      setHistoryLoading(false);
    }
  };

  const openViewModal = (report) => {
    setSelectedReport(report);

    setApprovalHistory([]);

    setApprovalFile(null);
    setFinalFile(null);

    setShowViewModal(true);

    loadApprovalHistory(report.id);
  };

  const closeViewModal = () => {
    setSelectedReport(null);

    setApprovalHistory([]);

    setApprovalFile(null);
    setFinalFile(null);

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

  const updateReportInState = (updated) => {
    setReports((prev) =>
      prev.map((r) =>
        Number(r.id) === Number(updated.id)
          ? updated
          : r
      )
    );

    setSelectedReport(updated);

    loadApprovalHistory(updated.id);
  };

  const createReport = async (e) => {
    e.preventDefault();

    if (!form.report_type) return alert("Select report type.");
    if (!form.employee_id) return alert("Select employee.");
    if (!form.date_created) return alert("Date created required.");
    if (!form.awol_date) return alert(`${dateLabel(form.report_type)} required.`);

    try {
      setLoadingCreate(true);

      const fd = new FormData();
      fd.append("report_type", form.report_type);
      fd.append("employee_id", form.employee_id);
      fd.append("date_created", form.date_created);
      fd.append("awol_date", form.awol_date);
      fd.append("details", form.details || "");

      if (attachmentFile) fd.append("attachment", attachmentFile);

      await api.post("/awol-reports", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      alert(`${form.report_type} created.`);
      closeCreateModal();
      await fetchReports();
    } catch (err) {
      if (err?.response?.status === 401) return logout();
      alert(err?.response?.data?.message || "Failed to create staff report.");
    } finally {
      setLoadingCreate(false);
    }
  };

  const approveReportWithUpload = async (report) => {
    if (!approvalFile) {
      return alert("Please choose the approved file before approving.");
    }

    if (!window.confirm("Approve this report and replace the latest file?")) return;

    try {
      setActionLoading(true);

      const fd = new FormData();
      fd.append("attachment", approvalFile);

      const res = await api.post(`/awol-reports/${report.id}/approve-upload`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      updateReportInState(res.data);
      setApprovalFile(null);

      alert("Report approved. Uploaded file is now the latest file.");
    } catch (err) {
      if (err?.response?.status === 401) return logout();
      alert(err?.response?.data?.message || "Failed to approve with upload.");
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

      updateReportInState(res.data);
      alert("Staff report rejected.");
    } catch (err) {
      if (err?.response?.status === 401) return logout();
      alert(err?.response?.data?.message || "Failed to reject report.");
    } finally {
      setActionLoading(false);
    }
  };

  const bypassApprove = async (report) => {
    if (!window.confirm("Bypass approval and send this report to final file upload?")) return;

    try {
      setActionLoading(true);

      const res = await api.put(`/awol-reports/${report.id}/admin-bypass-approve`);
      updateReportInState(res.data);

      alert("Report bypass-approved.");
    } catch (err) {
      if (err?.response?.status === 401) return logout();
      alert(err?.response?.data?.message || "Failed to bypass approve report.");
    } finally {
      setActionLoading(false);
    }
  };

  const voidReport = async (report) => {
    if (!window.confirm("Void this staff report?")) return;

    try {
      setActionLoading(true);

      const res = await api.put(`/awol-reports/${report.id}/void`);
      updateReportInState(res.data);

      alert("Report voided.");
    } catch (err) {
      if (err?.response?.status === 401) return logout();
      alert(err?.response?.data?.message || "Failed to void report.");
    } finally {
      setActionLoading(false);
    }
  };

  const uploadFinalFile = async () => {
    if (!selectedReport?.id) return;
    if (!finalFile) return alert("Choose final file first.");

    try {
      setActionLoading(true);

      const fd = new FormData();
      fd.append("attachment", finalFile);

      const res = await api.post(`/awol-reports/${selectedReport.id}/hr-final-file`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      updateReportInState(res.data);
      setFinalFile(null);

      alert("Final file uploaded. Staff report approved.");
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
      a.download = name || `staff-report-${report.id}-${type}`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      window.URL.revokeObjectURL(url);
    } catch {
      alert("Failed to download file.");
    }
  };

  const isPendingStatus = (status) =>
    [
      STATUS_AREA,
      STATUS_REGIONAL,
      STATUS_AVP,
      STATUS_VP,
      STATUS_HR,
      STATUS_WAITING_FINAL,
    ].includes(status);

  const canApproveSelected = (report) => {
    if (!report) return false;
    if (canBypassApprove) return true;

    if (report.status === STATUS_AREA && isAM) return true;
    if (report.status === STATUS_REGIONAL && isRM) return true;
    if (report.status === STATUS_AVP && isAVP) return true;
    if (report.status === STATUS_VP && isVP) return true;

    return false;
  };

  const canRejectSelected = (report) => {
    if (!report) return false;
    if (!isPendingStatus(report.status)) return false;

    if (canBypassApprove) return true;
    if (report.status === STATUS_WAITING_FINAL && canFinalUpload) return true;

    return canApproveSelected(report);
  };

  const canShowApprovalUpload = (report) =>
    canApproveSelected(report) &&
    report.status !== STATUS_HR &&
    report.status !== STATUS_WAITING_FINAL &&
    report.status !== STATUS_APPROVED &&
    report.status !== STATUS_REJECTED &&
    report.status !== STATUS_VOID;

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

  const filteredReports = useMemo(() => {
    const q = norm(search);

    return (reports || [])
      .filter((r) =>
        ["awol report", "incident report"].includes(
          norm(getReportType(r))
        )
      )
      .filter((r) => {
      if (!q) return true;

      return [
        r.report_no,
        getReportType(r),
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

  const selectedReportType = selectedReport ? getReportType(selectedReport) : "Staff Report";

  const totalReports = filteredReports.length;
  const pendingReports = filteredReports.filter(
    (report) =>
      ![STATUS_APPROVED, STATUS_REJECTED, STATUS_VOID].includes(
        report.status
      )
  ).length;
  const approvedReports = filteredReports.filter(
    (report) => report.status === STATUS_APPROVED
  ).length;
  const closedReports = filteredReports.filter(
    (report) =>
      report.status === STATUS_REJECTED ||
      report.status === STATUS_VOID
  ).length;

  return (
    <div className="staff-report-page">
      <section className="staff-report-hero">
        <div className="staff-report-hero-main">
          <div>
            <span className="staff-report-eyebrow">
              HRIS TRANSACTIONS
            </span>

            <h1>Staff Reports</h1>

            <p>
              Create, review, and track AWOL and Incident Reports
              through the required approval process.
            </p>

            <div className="staff-report-flow">
              <span>APPROVAL FLOW</span>
              <b>
                AM / RM / AVP / VP → HR Department Approval
              </b>
            </div>
          </div>

          <div className="staff-report-hero-actions">
            <button
              className="staff-report-btn staff-report-btn-secondary"
              type="button"
              onClick={() => navigate(-1)}
            >
              ← Back
            </button>

            <button
              className="staff-report-btn staff-report-btn-secondary"
              type="button"
              onClick={refreshAll}
              disabled={loadingList}
            >
              {loadingList ? "Refreshing..." : "Refresh"}
            </button>

            {canCreate && (
              <button
                className="staff-report-btn staff-report-btn-primary"
                type="button"
                onClick={openCreateModal}
              >
                + Create Staff Report
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="staff-report-summary-grid">
        <article className="staff-report-summary-card staff-report-summary-total">
          <div className="staff-report-summary-icon">ALL</div>
          <div>
            <span>Total Reports</span>
            <strong>{totalReports}</strong>
            <small>AWOL and Incident records</small>
          </div>
        </article>

        <article className="staff-report-summary-card staff-report-summary-pending">
          <div className="staff-report-summary-icon">P</div>
          <div>
            <span>Pending</span>
            <strong>{pendingReports}</strong>
            <small>Awaiting approval or upload</small>
          </div>
        </article>

        <article className="staff-report-summary-card staff-report-summary-approved">
          <div className="staff-report-summary-icon">A</div>
          <div>
            <span>Approved</span>
            <strong>{approvedReports}</strong>
            <small>Completed reports</small>
          </div>
        </article>

        <article className="staff-report-summary-card staff-report-summary-closed">
          <div className="staff-report-summary-icon">R</div>
          <div>
            <span>Rejected / Voided</span>
            <strong>{closedReports}</strong>
            <small>Closed reports</small>
          </div>
        </article>
      </section>

      <section className="staff-report-list-card">
        <div className="staff-report-search-panel">
          <div className="staff-report-search-controls">
            <input
              className="staff-report-search-input"
              value={searchText}
              onChange={(event) =>
                setSearchText(event.target.value)
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  setSearch(searchText);
                }
              }}
              placeholder="Search report no, employee, branch, type, or status..."
            />

            <button
              className="staff-report-btn staff-report-btn-secondary"
              type="button"
              onClick={() => setSearch(searchText)}
            >
              Search
            </button>

            <button
              className="staff-report-btn staff-report-btn-secondary"
              type="button"
              onClick={() => {
                setSearchText("");
                setSearch("");
              }}
            >
              Clear
            </button>
          </div>

          <span className="staff-report-result-count">
            {filteredReports.length}{" "}
            {filteredReports.length === 1
              ? "result"
              : "results"}
          </span>
        </div>

        <div className="staff-report-table-wrap">
          <table className="staff-report-table">
            <thead>
              <tr>
                <th>Report No</th>
                <th>Type</th>
                <th>Employee</th>
                <th>Branch</th>
                <th>Area</th>
                <th>Region</th>
                <th>Date Created</th>
                <th>Report Date</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {loadingList ? (
                <tr>
                  <td colSpan={10} className="staff-report-empty">
                    Loading reports...
                  </td>
                </tr>
              ) : filteredReports.length === 0 ? (
                <tr>
                  <td colSpan={10} className="staff-report-empty">
                    No AWOL or Incident Reports found.
                  </td>
                </tr>
              ) : (
                pagedReports.map((report) => (
                  <tr key={report.id}>
                    <td className="staff-report-number">
                      {report.report_no}
                    </td>

                    <td>{getReportType(report)}</td>

                    <td className="staff-report-employee">
                      {report.employee_name}
                    </td>

                    <td>
                      {branchLabel({
                        branch_code: report.branch_code,
                        branch_name: report.branch_name,
                      })}
                    </td>

                    <td>{report.area || "-"}</td>
                    <td>{report.region || "-"}</td>
                    <td>{fmtDate(report.date_created)}</td>
                    <td>{fmtDate(report.awol_date)}</td>

                    <td>
                      <span className={badgeClass(report.status)}>
                        {report.status}
                      </span>
                    </td>

                    <td>
                      <div className="staff-report-row-actions">
                        <button
                          className="staff-report-view-btn"
                          type="button"
                          onClick={() => openViewModal(report)}
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

        <div className="staff-report-pager">
          <div className="staff-report-pager-left">
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

          <div className="staff-report-pager-right">
            <button
              className="staff-report-page-btn"
              type="button"
              disabled={page <= 1}
              onClick={() =>
                setPage((current) => Math.max(1, current - 1))
              }
            >
              ‹
            </button>

            {getPageNumbers().map((pageNumber) => (
              <button
                key={pageNumber}
                className={`staff-report-page-number ${
                  page === pageNumber ? "active" : ""
                }`}
                type="button"
                onClick={() => setPage(pageNumber)}
              >
                {pageNumber}
              </button>
            ))}

            <button
              className="staff-report-page-btn"
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

            <span className="staff-report-page-summary">
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
            className="modal saas-modal staff-report-create-modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <h3 className="modal-title">Create Staff Report</h3>
                <p className="modal-subtitle">
                  Create an AWOL Report or Incident Report and upload
                  the supporting file.
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

            <form onSubmit={createReport} className="modal-form">
              <div className="modal-grid staff-report-modal-grid">
                <div className="form-group">
                  <label>Report Type</label>

                  <select
                    value={form.report_type}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        report_type: event.target.value,
                      }))
                    }
                    required
                  >
                    {REPORT_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>

                <div
                  className="form-group staff-report-employee-picker"
                  ref={employeePickerRef}
                >
                  <label>Employee</label>

                  <input
                    type="text"
                    placeholder="Search employee..."
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
                    onFocus={() => setShowEmployeeDropdown(true)}
                    required={!form.employee_id}
                  />

                  {showEmployeeDropdown && (
                    <div className="approval-search-dropdown">
                      {filteredEmployees.length === 0 ? (
                        <div className="approval-search-empty">
                          No results
                        </div>
                      ) : (
                        filteredEmployees.map((employee) => (
                          <button
                            key={employee.id}
                            type="button"
                            className="approval-search-item"
                            onClick={() =>
                              handleChooseEmployee(employee)
                            }
                          >
                            {(employee.employee_no
                              ? `${employee.employee_no} - `
                              : "") + displayName(employee)}
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
                  <label>{dateLabel(form.report_type)}</label>
                  <input
                    type="date"
                    value={form.awol_date}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        awol_date: event.target.value,
                      }))
                    }
                    required
                  />
                </div>

                <div className="form-group">
                  <label>{fileLabel(form.report_type)}</label>
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
                  <label>Details</label>
                  <textarea
                    value={form.details}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        details: event.target.value,
                      }))
                    }
                    placeholder={`${form.report_type} details...`}
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
          onMouseDown={(event) =>
            event.target.classList.contains("modal-overlay") &&
            closeViewModal()
          }
        >
          <div
            className="modal saas-modal view-report-modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <h3 className="modal-title">
                  {selectedReportType} Details
                </h3>

                <p className="modal-subtitle">
                  {selectedReport.report_no} —{" "}
                  {selectedReport.status}
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

            <div className="modal-grid staff-report-view-grid">
              <div className="form-group">
                <label>Report Type</label>
                <input value={selectedReportType} readOnly />
              </div>

              <div className="form-group">
                <label>Employee</label>
                <input
                  value={toStr(selectedReport.employee_name)}
                  readOnly
                />
              </div>

              <div className="form-group">
                <label>Status</label>
                <input
                  value={toStr(selectedReport.status)}
                  readOnly
                />
              </div>

              <div className="form-group">
                <label>Branch</label>
                <input
                  value={branchLabel({
                    branch_code: selectedReport.branch_code,
                    branch_name: selectedReport.branch_name,
                  })}
                  readOnly
                />
              </div>

              <div className="form-group">
                <label>Area</label>
                <input
                  value={toStr(selectedReport.area)}
                  readOnly
                />
              </div>

              <div className="form-group">
                <label>Region</label>
                <input
                  value={toStr(selectedReport.region)}
                  readOnly
                />
              </div>

              <div className="form-group">
                <label>Division</label>
                <input
                  value={toStr(selectedReport.division)}
                  readOnly
                />
              </div>

              <div className="form-group">
                <label>Date Created</label>
                <input
                  value={fmtDate(selectedReport.date_created)}
                  readOnly
                />
              </div>

              <div className="form-group">
                <label>{dateLabel(selectedReportType)}</label>
                <input
                  value={fmtDate(selectedReport.awol_date)}
                  readOnly
                />
              </div>

              <div className="form-group full">
                <label>Details</label>
                <textarea
                  value={toStr(selectedReport.details)}
                  readOnly
                />
              </div>
            </div>

            <div className="staff-report-file-table table-card">
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
                      <td>{latestFileName(selectedReport)}</td>
                      <td>
                        {selectedReport.approved_attachment_path ||
                        selectedReport.request_attachment_path ? (
                          <button
                            className="btn-secondary"
                            type="button"
                            onClick={() =>
                              downloadFile(
                                selectedReport,
                                latestFileType(selectedReport)
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
                        {selectedReport.request_attachment_name ||
                          "-"}
                      </td>
                      <td>
                        {selectedReport.request_attachment_path ? (
                          <button
                            className="btn-secondary"
                            type="button"
                            onClick={() =>
                              downloadFile(selectedReport, "request")
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

            {/* =====================================================
                APPROVAL HISTORY
            ===================================================== */}

            <div className="staff-report-approval-history">

              <h4 className="staff-report-history-title">
                Approval History
              </h4>

              {historyLoading ? (

                <div className="staff-report-history-empty">
                  Loading approval history...
                </div>

              ) : approvalHistory.length === 0 ? (

                <div className="staff-report-history-empty">
                  No approval history recorded yet.
                </div>

              ) : (

                <div className="staff-report-history-list">

                  {approvalHistory.map((history, index) => {

                    const action = history.action || "-";

                    const isRejected =
                      action.toLowerCase().includes("reject");

                    const isVoided =
                      action.toLowerCase().includes("void");

                    const isApproved =
                      action.toLowerCase().includes("approv");

                    const statusLabel = isRejected
                      ? "Rejected"
                      : isVoided
                      ? "Voided"
                      : isApproved
                      ? "Approved"
                      : action;

                    const formattedDate = history.performed_at
                      ? new Intl.DateTimeFormat("en-PH", {
                          timeZone: "Asia/Manila",
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: true,
                        }).format(new Date(history.performed_at))
                      : "-";

                    return (

                      <div
                        key={history.id}
                        className="staff-report-history-item"
                      >

                        <div
                          className={`staff-report-history-number ${
                            isRejected || isVoided ? "history-red" : ""
                          }`}
                        >
                          {index + 1}
                        </div>

                        <div className="staff-report-history-content">

                          <strong>
                            {action}
                          </strong>

                          <div className="staff-report-history-person">
                            Performed by:{" "}
                            <b>{history.actor_name || "-"}</b>
                          </div>

                          <div className="staff-report-history-department">
                            {history.actor_department || history.actor_role || "-"}
                          </div>

                          <small className="staff-report-history-date">
                            {formattedDate}
                          </small>

                          {history.notes && (
                            <div className="staff-report-history-notes">
                              Reason: {history.notes}
                            </div>
                          )}

                        </div>

                        <span
                          className={`staff-report-history-status ${
                            isRejected || isVoided
                              ? "history-status-red"
                              : "history-status-green"
                          }`}
                        >
                          {statusLabel}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {canShowApprovalUpload(selectedReport) && (
              <div className="staff-report-upload-box">
                <div className="form-group">
                  <label>
                    Upload Approved File for Next Approver
                  </label>

                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                    onChange={(event) =>
                      setApprovalFile(
                        event.target.files?.[0] || null
                      )
                    }
                  />
                </div>

                <button
                  className="btn-success"
                  type="button"
                  onClick={() =>
                    approveReportWithUpload(selectedReport)
                  }
                  disabled={actionLoading}
                >
                  {actionLoading
                    ? "Approving..."
                    : "Upload File & Approve"}
                </button>
              </div>
            )}

            {(selectedReport.status === STATUS_WAITING_FINAL ||
              selectedReport.status === STATUS_HR) &&
              canFinalUpload && (
                <div className="staff-report-upload-box">
                  <div className="form-group">
                    <label>Upload Final Approved File</label>

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

                  <button
                    className="btn-primary"
                    type="button"
                    onClick={uploadFinalFile}
                    disabled={actionLoading}
                  >
                    {actionLoading
                      ? "Uploading..."
                      : "Upload Final File & Approve"}
                  </button>
                </div>
              )}

            <div className="staff-report-view-actions">
              <button
                className="btn-secondary"
                type="button"
                onClick={closeViewModal}
              >
                Close
              </button>

              {canRejectSelected(selectedReport) && (
                <button
                  className="btn-danger"
                  type="button"
                  disabled={actionLoading}
                  onClick={() => rejectReport(selectedReport)}
                >
                  Reject
                </button>
              )}

              {canBypassApprove &&
                selectedReport.status !== STATUS_WAITING_FINAL &&
                selectedReport.status !== STATUS_APPROVED &&
                selectedReport.status !== STATUS_REJECTED &&
                selectedReport.status !== STATUS_VOID && (
                  <button
                    className="btn-success"
                    type="button"
                    disabled={actionLoading}
                    onClick={() =>
                      bypassApprove(selectedReport)
                    }
                  >
                    Bypass Approval
                  </button>
                )}

              {selectedReport.status === STATUS_APPROVED &&
                canVoid && (
                  <button
                    className="btn-danger"
                    type="button"
                    disabled={actionLoading}
                    onClick={() => voidReport(selectedReport)}
                  >
                    Void
                  </button>
                )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}