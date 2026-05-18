import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axiosClient";
import "../styles/LeaveTransactions.css";
import "../styles/ResignationRequests.css";

const toStr = (v) => String(v ?? "").trim();
const norm = (v) => toStr(v).toLowerCase();
const toDate10 = (v) => (v ? String(v).slice(0, 10) : "");
const fmtDate = (v) => (v ? String(v).slice(0, 10) : "-");

const readUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
};

const getBaseUrl = () => {
  const base = api.defaults.baseURL || "";
  return base.endsWith("/api") ? base.slice(0, -4) : base;
};

const STATUS_BRANCH = "Pending Branch Manager";
const STATUS_AREA = "Pending Area Manager";
const STATUS_RM = "Pending Regional Manager";
const STATUS_AVP = "Pending Assistant Vice President";
const STATUS_VP = "Pending Vice President";
const STATUS_SVP = "Pending Senior Vice President";
const STATUS_ADMIN = "Pending Admin";
const STATUS_APPROVED = "Approved";
const STATUS_REJECTED = "Rejected";

export default function ResignationRequests() {
  const navigate = useNavigate();
  const baseUrl = useMemo(() => getBaseUrl(), []);

  const user = useMemo(() => readUser(), []);
  const role = norm(user?.role);

  const isAdmin = ["admin", "it"].includes(role);
  const isAreaManager = role === "area manager";
  const isRegionalManager = role === "regional manager";
  const isAssistantVicePresident = role === "assistant vice president";
  const isHr = role === "hr";
  const isAccounting = role === "accounting";
  const isTread = role === "tread";
  const isVicePresident = role === "vice president";
  const isSeniorVicePresident = role === "senior vice president";
  const isBranchManager = role === "branch manager";

  const canCreate =
    isAdmin ||
    isHr ||
    isAccounting ||
    isTread ||
    isBranchManager ||
    isAreaManager ||
    isRegionalManager ||
    isAssistantVicePresident ||
    isVicePresident ||
    isSeniorVicePresident;

  const [rows, setRows] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [showCreate, setShowCreate] = useState(false);
  const [viewRow, setViewRow] = useState(null);

  const [employeeSearch, setEmployeeSearch] = useState("");
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
  const employeeBoxRef = useRef(null);

  const [rejectingRow, setRejectingRow] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [processingId, setProcessingId] = useState("");

  const [finalFiles, setFinalFiles] = useState({});

  const [form, setForm] = useState({
    staff_id: "",
    employee_no: "",
    employee_name: "",
    last_name: "",
    first_name: "",
    middle_name: "",
    branch_id: "",
    branch_code: "",
    branch_name: "",
    resignation_date: toDate10(new Date().toISOString()),
    effective_date: "",
    remarks: "",
    attachment: null,
  });

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [reqRes, staffRes, branchRes] = await Promise.all([
        api.get("/resignation-requests").catch(() => ({ data: [] })),
        api.get("/staff").catch(() => ({ data: [] })),
        api.get("/branches").catch(() => ({ data: [] })),
      ]);

      setRows(Array.isArray(reqRes.data) ? reqRes.data : []);
      setStaffList(Array.isArray(staffRes.data) ? staffRes.data : []);
      setBranches(Array.isArray(branchRes.data) ? branchRes.data : []);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load resignation requests.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    const onMouseDown = (e) => {
      if (employeeBoxRef.current && !employeeBoxRef.current.contains(e.target)) {
        setShowEmployeeDropdown(false);
      }
    };

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        setViewRow(null);
        setRejectingRow(null);
        setShowEmployeeDropdown(false);
      }
    };

    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const buildName = useCallback((s) => {
    const ln = toStr(s?.last_name);
    const fn = toStr(s?.first_name);
    const mn = toStr(s?.middle_name);

    const full = `${ln}${ln && fn ? ", " : ""}${fn}${mn ? ` ${mn}` : ""}`
      .replace(/\s+/g, " ")
      .trim();

    return full || toStr(s?.fullname) || "-";
  }, []);

  const branchMap = useMemo(() => {
    const m = new Map();
    branches.forEach((b) => m.set(String(b.id), b));
    return m;
  }, [branches]);

  const searchableStaff = useMemo(() => {
    return staffList
      .filter((s) => norm(s.status || "active") === "active")
      .map((s) => {
        const display = buildName(s);
        const searchBlob = [
          s.id,
          s.employee_no,
          s.fullname,
          s.last_name,
          s.first_name,
          s.middle_name,
          s.position,
          s.area,
          s.region,
          s.department,
          display,
        ]
          .map(toStr)
          .join(" ")
          .toLowerCase();

        return { ...s, _display: display, _searchBlob: searchBlob };
      });
  }, [staffList, buildName]);

  const filteredEmployees = useMemo(() => {
    const q = norm(employeeSearch);
    if (!q) return searchableStaff.slice(0, 20);
    return searchableStaff.filter((s) => s._searchBlob.includes(q)).slice(0, 20);
  }, [searchableStaff, employeeSearch]);

  const filteredRows = useMemo(() => {
    const q = norm(search);
    if (!q) return rows;

    return rows.filter((r) =>
      [
        r.request_no,
        r.employee_no,
        r.employee_name,
        r.branch_code,
        r.branch_name,
        r.resignation_date,
        r.effective_date,
        r.remarks,
        r.status,
      ]
        .map(toStr)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [rows, search]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));

  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page, pageSize]);

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

  const handleEmployeeSelect = (staffId) => {
    const s = staffList.find((x) => String(x.id) === String(staffId));
    if (!s) return;

    const b = s.branch_id ? branchMap.get(String(s.branch_id)) : null;
    const name = buildName(s);

    setForm((prev) => ({
      ...prev,
      staff_id: String(s.id || ""),
      employee_no: toStr(s.employee_no),
      employee_name: name,
      last_name: toStr(s.last_name),
      first_name: toStr(s.first_name),
      middle_name: toStr(s.middle_name),
      branch_id: String(s.branch_id || ""),
      branch_code: toStr(b?.code),
      branch_name: toStr(b?.name),
    }));

    setEmployeeSearch(`${toStr(s.employee_no)} - ${name}`);
    setShowEmployeeDropdown(false);
  };

  const resetForm = () => {
    setForm({
      staff_id: "",
      employee_no: "",
      employee_name: "",
      last_name: "",
      first_name: "",
      middle_name: "",
      branch_id: "",
      branch_code: "",
      branch_name: "",
      resignation_date: toDate10(new Date().toISOString()),
      effective_date: "",
      remarks: "",
      attachment: null,
    });

    setEmployeeSearch("");
    setShowEmployeeDropdown(false);
  };

  const closeCreate = () => {
    setShowCreate(false);
    resetForm();
  };

  const openCreate = () => {
    resetForm();
    setShowCreate(true);
  };

  const submitCreate = async (e) => {
    e.preventDefault();

    if (!form.staff_id) return alert("Please select employee.");
    if (!form.effective_date) return alert("Please select effective date.");

    try {
      setSaving(true);

      const fd = new FormData();
      fd.append("staff_id", form.staff_id);
      fd.append("employee_no", form.employee_no);
      fd.append("employee_name", form.employee_name);
      fd.append("last_name", form.last_name);
      fd.append("first_name", form.first_name);
      fd.append("middle_name", form.middle_name);
      fd.append("branch_id", form.branch_id || "");
      fd.append("branch_code", form.branch_code || "");
      fd.append("branch_name", form.branch_name || "");
      fd.append("resignation_date", form.resignation_date || "");
      fd.append("effective_date", form.effective_date || "");
      fd.append("remarks", form.remarks || "");

      if (form.attachment) fd.append("attachment", form.attachment);

      await api.post("/resignation-requests", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      alert("Resignation request created.");
      closeCreate();
      await fetchAll();
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to create resignation request.");
    } finally {
      setSaving(false);
    }
  };

  const approveRequest = async (row) => {
    const isFinalStage = toStr(row.status) === STATUS_ADMIN;

    if (isFinalStage && !finalFiles[row.id]) {
      return alert("Please upload the final approved file first.");
    }

    if (!window.confirm("Approve this resignation request?")) return;

    try {
      setProcessingId(`approve-${row.id}`);

      if (isFinalStage) {
        const fd = new FormData();
        fd.append("attachment", finalFiles[row.id]);

        await api.put(`/resignation-requests/${row.id}/approve`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      } else {
        await api.put(`/resignation-requests/${row.id}/approve`);
      }

      setFinalFiles((prev) => {
        const copy = { ...prev };
        delete copy[row.id];
        return copy;
      });

      await fetchAll();
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to approve request.");
    } finally {
      setProcessingId("");
    }
  };

  const rejectRequest = async () => {
    if (!rejectingRow?.id) return;
    if (!toStr(rejectionReason)) return alert("Rejection reason required.");

    try {
      setProcessingId(`reject-${rejectingRow.id}`);

      await api.put(`/resignation-requests/${rejectingRow.id}/reject`, {
        reason: rejectionReason,
      });

      setRejectingRow(null);
      setRejectionReason("");
      await fetchAll();
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to reject request.");
    } finally {
      setProcessingId("");
    }
  };

  const deleteRequest = async (row) => {
    if (!window.confirm("Delete this resignation request?")) return;

    try {
      setProcessingId(`delete-${row.id}`);
      await api.delete(`/resignation-requests/${row.id}`);
      await fetchAll();
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to delete request.");
    } finally {
      setProcessingId("");
    }
  };

  const canApproveRow = (row) => {
    const status = toStr(row.status);

    if (
      (isAdmin || isHr || isAccounting) &&
      status !== STATUS_APPROVED &&
      status !== STATUS_REJECTED
    ) {
      return true;
    }

    if (isBranchManager && status === STATUS_BRANCH) return true;
    if (isAreaManager && status === STATUS_AREA) return true;
    if (isRegionalManager && status === STATUS_RM) return true;
    if (isAssistantVicePresident && status === STATUS_AVP) return true;
    if (isVicePresident && status === STATUS_VP) return true;
    if (isSeniorVicePresident && status === STATUS_SVP) return true;

    return false;
  };

  const canRejectRow = (row) => canApproveRow(row);

  const canDeleteRow = (row) => {
    const status = norm(row.status);
    return status !== norm(STATUS_APPROVED) && status !== norm(STATUS_REJECTED);
  };

  const badgeClass = (status) => {
    const s = norm(status);
    if (s === norm(STATUS_APPROVED)) return "badge badge-approved";
    if (s === norm(STATUS_REJECTED)) return "badge badge-rejected";
    return "badge badge-pending";
  };

  const attachmentUrl = (row) => {
    if (!row?.attachment_path) return "";
    if (String(row.attachment_path).startsWith("http")) return row.attachment_path;
    return `${baseUrl}${row.attachment_path}`;
  };

  const actionLabel = (row) => {
    const status = toStr(row.status);

    if (status === STATUS_BRANCH) return "For Branch Manager";
    if (status === STATUS_AREA) return "For Area Manager";
    if (status === STATUS_RM) return "For RM";
    if (status === STATUS_AVP) return "For AVP";
    if (status === STATUS_VP) return "For VP";
    if (status === STATUS_SVP) return "For SVP";
    if (status === STATUS_ADMIN) return "For Admin";
    if (status === STATUS_APPROVED) return "Approved";
    if (status === STATUS_REJECTED) return "Rejected";

    return "-";
  };

  const branchLabel = (row) => {
    if (row.branch_code || row.branch_name) {
      return `${row.branch_code || ""}${
        row.branch_code && row.branch_name ? " - " : ""
      }${row.branch_name || ""}`;
    }

    return "-";
  };

  return (
    <div className="approval-page resignation-page">
      <div className="approval-page-header">
        <div>
          <h2 className="approval-title">Resignation</h2>
          <p className="approval-subtitle">
            Branch Manager → Area Manager → Regional Manager → Assistant Vice
            President → Vice President → Admin/HR/Accounting.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            className="btn-secondary"
            onClick={() => navigate("/transactions")}
            type="button"
          >
            ← Back
          </button>

          <button className="btn-secondary" onClick={fetchAll} type="button">
            Refresh
          </button>

          {canCreate && (
            <button className="btn-primary" onClick={openCreate} type="button">
              + Add
            </button>
          )}
        </div>
      </div>

      {error ? (
        <div style={{ color: "#ff7e8b", fontWeight: 800 }}>{error}</div>
      ) : null}

      <div className="leave-searchbar">
        <input
          className="leave-search-input"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && setSearch(searchText)}
          placeholder="Search request no, employee, branch, status..."
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

        <span className="leave-search-count">{filteredRows.length} result(s)</span>
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
          <table className="table resignation-table">
            <thead>
              <tr>
                <th>Request No</th>
                <th>Employee No</th>
                <th>Employee</th>
                <th>Branch</th>
                <th>Resignation Date</th>
                <th>Effective Date</th>
                <th>Attachment</th>
                <th>Status</th>
                <th>Stage</th>
                <th style={{ width: 160 }}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="empty-state">
                    Loading...
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="empty-state">
                    No resignation requests found.
                  </td>
                </tr>
              ) : (
                pagedRows.map((row) => {
                  const isFinalStage = toStr(row.status) === STATUS_ADMIN;
                  const canApprove = canApproveRow(row);

                  return (
                    <tr key={row.id}>
                      <td className="td-strong">{row.request_no || row.id}</td>
                      <td>{row.employee_no || "-"}</td>
                      <td className="td-strong">{row.employee_name || "-"}</td>
                      <td>{branchLabel(row)}</td>
                      <td>{fmtDate(row.resignation_date)}</td>
                      <td>{fmtDate(row.effective_date)}</td>

                      <td>
                        {row.attachment_path ? (
                          <a
                            href={attachmentUrl(row)}
                            target="_blank"
                            rel="noreferrer"
                            className="btn-secondary"
                            style={{
                              textDecoration: "none",
                              display: "inline-flex",
                              alignItems: "center",
                            }}
                          >
                            View File
                          </a>
                        ) : (
                          "-"
                        )}
                      </td>

                      <td>
                        <span className={badgeClass(row.status)}>
                          {row.status || STATUS_RM}
                        </span>
                      </td>

                      <td>{actionLabel(row)}</td>

                      <td>
                        <div className="row-actions">
                          <button
                            className="btn-secondary"
                            type="button"
                            onClick={() => setViewRow(row)}
                          >
                            View
                          </button>

                          {canApprove && isFinalStage ? (
                            <label className="btn-secondary" style={{ cursor: "pointer" }}>
                              {finalFiles[row.id]?.name ? "Change File" : "Final File"}
                              <input
                                type="file"
                                style={{ display: "none" }}
                                onChange={(e) =>
                                  setFinalFiles((prev) => ({
                                    ...prev,
                                    [row.id]: e.target.files?.[0] || null,
                                  }))
                                }
                              />
                            </label>
                          ) : null}

                          {finalFiles[row.id]?.name ? (
                            <span style={{ fontSize: 11, maxWidth: 130 }}>
                              {finalFiles[row.id].name}
                            </span>
                          ) : null}

                          {canApprove && (
                            <button
                              className="btn-success"
                              type="button"
                              onClick={() => approveRequest(row)}
                              disabled={processingId === `approve-${row.id}`}
                            >
                              {processingId === `approve-${row.id}`
                                ? "Approving..."
                                : isFinalStage
                                ? "Upload + Approve"
                                : "Approve"}
                            </button>
                          )}

                          {canRejectRow(row) && (
                            <button
                              className="btn-danger"
                              type="button"
                              onClick={() => {
                                setRejectingRow(row);
                                setRejectionReason("");
                              }}
                              disabled={processingId === `reject-${row.id}`}
                            >
                              Reject
                            </button>
                          )}

                          {canDeleteRow(row) ? (
                            <button
                              className="btn-secondary"
                              type="button"
                              onClick={() => deleteRequest(row)}
                              disabled={processingId === `delete-${row.id}`}
                            >
                              Delete
                            </button>
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

      {showCreate && (
        <div
          className="modal-overlay"
          onMouseDown={(e) =>
            e.target.classList.contains("modal-overlay") && closeCreate()
          }
        >
          <div className="modal saas-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h3 className="modal-title">Create Resignation Request</h3>
                <p className="modal-subtitle">
                  Submitted into approval chain automatically.
                </p>
              </div>

              <button className="modal-x" onClick={closeCreate} type="button">
                ✕
              </button>
            </div>

            <form className="modal-form" onSubmit={submitCreate}>
              <div className="modal-grid">
                <div
                  className="form-group full"
                  ref={employeeBoxRef}
                  style={{ position: "relative", zIndex: 50 }}
                >
                  <label>Employee</label>
                  <input
                    type="text"
                    value={employeeSearch}
                    onChange={(e) => {
                      setEmployeeSearch(e.target.value);
                      setShowEmployeeDropdown(true);
                      setForm((prev) => ({
                        ...prev,
                        staff_id: "",
                        employee_no: "",
                        employee_name: "",
                        last_name: "",
                        first_name: "",
                        middle_name: "",
                        branch_id: "",
                        branch_code: "",
                        branch_name: "",
                      }));
                    }}
                    onFocus={() => setShowEmployeeDropdown(true)}
                    placeholder="Search employee no or name..."
                    required={!form.staff_id}
                  />

                  {showEmployeeDropdown && (
                    <div className="approval-search-dropdown">
                      {filteredEmployees.length === 0 ? (
                        <div className="approval-search-empty">No employee found</div>
                      ) : (
                        filteredEmployees.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            className="approval-search-item"
                            onClick={() => handleEmployeeSelect(s.id)}
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
                  <input value={form.employee_no} readOnly placeholder="Auto-filled" />
                </div>

                <div className="form-group">
                  <label>Last Name</label>
                  <input value={form.last_name} readOnly placeholder="Auto-filled" />
                </div>

                <div className="form-group">
                  <label>First Name</label>
                  <input value={form.first_name} readOnly placeholder="Auto-filled" />
                </div>

                <div className="form-group">
                  <label>Middle Name</label>
                  <input value={form.middle_name} readOnly placeholder="Auto-filled" />
                </div>

                <div className="form-group">
                  <label>Branch</label>
                  <input
                    value={
                      form.branch_code || form.branch_name
                        ? `${form.branch_code || ""}${
                            form.branch_code && form.branch_name ? " - " : ""
                          }${form.branch_name || ""}`
                        : ""
                    }
                    readOnly
                    placeholder="Auto-filled"
                  />
                </div>

                <div className="form-group">
                  <label>Resignation Date</label>
                  <input
                    type="date"
                    value={form.resignation_date}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, resignation_date: e.target.value }))
                    }
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Effective Date</label>
                  <input
                    type="date"
                    value={form.effective_date}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, effective_date: e.target.value }))
                    }
                    required
                  />
                </div>

                <div className="form-group full">
                  <label>Attachment</label>
                  <input
                    type="file"
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        attachment: e.target.files?.[0] || null,
                      }))
                    }
                  />
                </div>

                <div className="form-group full">
                  <label>Remarks</label>
                  <textarea
                    value={form.remarks}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, remarks: e.target.value }))
                    }
                    placeholder="Reason / remarks..."
                  />
                </div>
              </div>

              <div className="modal-buttons">
                <button className="btn-secondary" type="button" onClick={closeCreate}>
                  Cancel
                </button>

                <button className="btn-primary" type="submit" disabled={saving}>
                  {saving ? "Saving..." : "Create Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewRow && (
        <div
          className="modal-overlay"
          onMouseDown={(e) =>
            e.target.classList.contains("modal-overlay") && setViewRow(null)
          }
        >
          <div className="modal saas-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h3 className="modal-title">Resignation Details</h3>
                <p className="modal-subtitle">
                  {viewRow.request_no || viewRow.id} — {viewRow.employee_name || "-"}
                </p>
              </div>

              <button className="modal-x" type="button" onClick={() => setViewRow(null)}>
                ✕
              </button>
            </div>

            <div className="modal-form">
              <div className="modal-grid">
                <div className="form-group">
                  <label>Employee No</label>
                  <input value={viewRow.employee_no || "-"} readOnly />
                </div>

                <div className="form-group">
                  <label>Branch</label>
                  <input value={branchLabel(viewRow)} readOnly />
                </div>

                <div className="form-group">
                  <label>Resignation Date</label>
                  <input value={fmtDate(viewRow.resignation_date)} readOnly />
                </div>

                <div className="form-group">
                  <label>Effective Date</label>
                  <input value={fmtDate(viewRow.effective_date)} readOnly />
                </div>

                <div className="form-group">
                  <label>Status</label>
                  <input value={viewRow.status || "-"} readOnly />
                </div>

                <div className="form-group">
                  <label>Stage</label>
                  <input value={actionLabel(viewRow)} readOnly />
                </div>

                <div className="form-group full">
                  <label>Remarks</label>
                  <textarea value={viewRow.remarks || "No remarks"} readOnly />
                </div>

                {viewRow.rejection_reason ? (
                  <div className="form-group full">
                    <label>Rejection Reason</label>
                    <textarea value={viewRow.rejection_reason} readOnly />
                  </div>
                ) : null}

                {viewRow.attachment_path ? (
                  <div className="form-group full">
                    <label>Attachment</label>
                    <a
                      href={attachmentUrl(viewRow)}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-secondary"
                      style={{
                        textDecoration: "none",
                        display: "inline-flex",
                        width: "fit-content",
                      }}
                    >
                      View File
                    </a>
                  </div>
                ) : null}
              </div>

              <div className="modal-buttons">
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={() => setViewRow(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {rejectingRow && (
        <div
          className="modal-overlay"
          onMouseDown={(e) =>
            e.target.classList.contains("modal-overlay") && setRejectingRow(null)
          }
        >
          <div
            className="modal saas-modal"
            onMouseDown={(e) => e.stopPropagation()}
            style={{ maxWidth: 560 }}
          >
            <div className="modal-head">
              <div>
                <h3 className="modal-title">Reject Resignation Request</h3>
                <p className="modal-subtitle">
                  Add reason before rejecting this request.
                </p>
              </div>

              <button className="modal-x" type="button" onClick={() => setRejectingRow(null)}>
                ✕
              </button>
            </div>

            <div className="modal-form">
              <div className="form-group full">
                <label>Reason</label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Enter rejection reason..."
                />
              </div>

              <div className="modal-buttons">
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={() => setRejectingRow(null)}
                >
                  Cancel
                </button>

                <button
                  className="btn-danger"
                  type="button"
                  onClick={rejectRequest}
                  disabled={processingId === `reject-${rejectingRow.id}`}
                >
                  {processingId === `reject-${rejectingRow.id}` ? "Rejecting..." : "Reject"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}