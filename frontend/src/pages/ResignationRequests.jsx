import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axiosClient";
import "../styles/ExitStaffOrders.css";
import "../styles/Approval.css";

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

const STATUS_RM = "Pending Regional Manager";
const STATUS_AVP = "Pending Executive Approval";
const STATUS_ADMIN = "Pending Admin";
const STATUS_APPROVED = "Approved";
const STATUS_REJECTED = "Rejected";

export default function ResignationRequests() {
  const navigate = useNavigate();
  const baseUrl = useMemo(() => getBaseUrl(), []);

  const user = useMemo(() => readUser(), []);
  const role = norm(user?.role);

  const isAdmin = role === "admin";
  const isAreaManager = role === "area manager";
  const isRegionalManager = role === "regional manager";
  const isAssistantVicePresident = role === "assistant vice president";
  const isHr = role === "hr";
  const isAccounting = role === "accounting";
  const isTread = role === "tread";
  const isVicePresident = role === "vice president";
  const isSeniorVicePresident = role === "senior vice president";
  const isPresident = role === "president";

  const canCreate =
    isAdmin ||
    isHr ||
    isAccounting ||
    isTread ||
    isAreaManager ||
    isRegionalManager ||
    isAssistantVicePresident ||
    isVicePresident ||
    isSeniorVicePresident ||
    isPresident;

  const [rows, setRows] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
  const employeeBoxRef = useRef(null);

  const [rejectingRow, setRejectingRow] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [processingId, setProcessingId] = useState("");

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
      console.error(err);
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

    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
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
          display,
        ]
          .map((x) => toStr(x))
          .join(" ")
          .toLowerCase();

        return {
          ...s,
          _display: display,
          _searchBlob: searchBlob,
        };
      });
  }, [staffList, buildName]);

  const filteredEmployees = useMemo(() => {
    const q = norm(employeeSearch);
    if (!q) return searchableStaff.slice(0, 20);
    return searchableStaff.filter((s) => s._searchBlob.includes(q)).slice(0, 20);
  }, [searchableStaff, employeeSearch]);

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

    if (!form.staff_id) {
      alert("Please select employee.");
      return;
    }

    if (!form.effective_date) {
      alert("Please select effective date.");
      return;
    }

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

      if (form.attachment) {
        fd.append("attachment", form.attachment);
      }

      await api.post("/resignation-requests", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      alert("Resignation request created.");
      closeCreate();
      await fetchAll();
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.message || "Failed to create resignation request.");
    } finally {
      setSaving(false);
    }
  };

  const approveRequest = async (row) => {
    const ok = window.confirm("Approve this resignation request?");
    if (!ok) return;

    try {
      setProcessingId(`approve-${row.id}`);
      await api.put(`/resignation-requests/${row.id}/approve`);
      await fetchAll();
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.message || "Failed to approve request.");
    } finally {
      setProcessingId("");
    }
  };

  const rejectRequest = async () => {
    if (!rejectingRow?.id) return;
    if (!toStr(rejectionReason)) {
      alert("Rejection reason required.");
      return;
    }

    try {
      setProcessingId(`reject-${rejectingRow.id}`);
      await api.put(`/resignation-requests/${rejectingRow.id}/reject`, {
        reason: rejectionReason,
      });
      setRejectingRow(null);
      setRejectionReason("");
      await fetchAll();
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.message || "Failed to reject request.");
    } finally {
      setProcessingId("");
    }
  };

  const deleteRequest = async (row) => {
    const ok = window.confirm("Delete this resignation request?");
    if (!ok) return;

    try {
      setProcessingId(`delete-${row.id}`);
      await api.delete(`/resignation-requests/${row.id}`);
      await fetchAll();
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.message || "Failed to delete request.");
    } finally {
      setProcessingId("");
    }
  };

  const canApproveRow = (row) => {
    const status = toStr(row.status);

    if (isRegionalManager && status === STATUS_RM) return true;
    if (isAssistantVicePresident && status === STATUS_AVP) return true;
    if ((isAdmin || isHr || isAccounting) && status === STATUS_ADMIN) return true;

    return false;
  };

  const canRejectRow = (row) => {
    const status = toStr(row.status);

    if (isRegionalManager && status === STATUS_RM) return true;
    if (isAssistantVicePresident && status === STATUS_AVP) return true;
    if ((isAdmin || isHr || isAccounting) && status === STATUS_ADMIN) return true;

    return false;
  };

  const canDeleteRow = (row) => {
    const status = norm(row.status);
    return status !== norm(STATUS_APPROVED) && status !== norm(STATUS_REJECTED);
  };

  const badgeClass = (status) => {
    const s = norm(status);
    if (s === norm(STATUS_APPROVED)) return "po-badge po-approved";
    if (s === norm(STATUS_REJECTED)) return "po-badge po-rejected";
    return "po-badge po-pending";
  };

  const attachmentUrl = (row) => {
    if (!row?.attachment_path) return "";
    if (String(row.attachment_path).startsWith("http")) return row.attachment_path;
    return `${baseUrl}${row.attachment_path}`;
  };

  const actionLabel = (row) => {
    const status = toStr(row.status);
    if (status === STATUS_RM) return "For RM";
    if (status === STATUS_AVP) return "For AVP";
    if (status === STATUS_ADMIN) return "For Admin";
    if (status === STATUS_APPROVED) return "Approved";
    if (status === STATUS_REJECTED) return "Rejected";
    return "-";
  };

  return (
    <div className="po-page">
      <div className="po-topbar">
        <div>
          <h2 className="po-title">Resignation Requests</h2>
          <p className="po-subtitle">
            Area Manager → Regional Manager → Assistant Vice President → Admin/HR/Accounting
          </p>
        </div>

        <div className="po-topbar-actions">
          <button className="po-btn po-btn-outline" onClick={() => navigate("/transactions")} type="button">
            ← Back
          </button>
          <button className="po-btn po-btn-outline" onClick={fetchAll} type="button">
            Refresh
          </button>
          {canCreate && (
            <button className="po-btn po-btn-primary" onClick={openCreate} type="button">
              + Create Resignation Request
            </button>
          )}
        </div>
      </div>

      {error ? <div style={{ color: "#ff7e8b", fontWeight: 800 }}>{error}</div> : null}

      <div className="po-card">
        <div className="po-table-wrap">
          <table className="po-table">
            <thead>
              <tr>
                <th>Request No</th>
                <th>Employee No</th>
                <th>Employee</th>
                <th>Branch</th>
                <th>Resignation Date</th>
                <th>Effective Date</th>
                <th>Attachment</th>
                <th>Remarks</th>
                <th>Status</th>
                <th>Stage</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} className="po-empty">Loading...</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="po-empty">No resignation requests found.</td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id}>
                    <td className="mono">{row.request_no || row.id}</td>
                    <td className="mono">{row.employee_no || "-"}</td>
                    <td className="td-strong">{row.employee_name || "-"}</td>
                    <td>
                      {row.branch_code || row.branch_name
                        ? `${row.branch_code || ""}${row.branch_code && row.branch_name ? " - " : ""}${row.branch_name || ""}`
                        : "-"}
                    </td>
                    <td>{fmtDate(row.resignation_date)}</td>
                    <td>{fmtDate(row.effective_date)}</td>
                    <td>
                      {row.attachment_path ? (
                        <a
                          href={attachmentUrl(row)}
                          target="_blank"
                          rel="noreferrer"
                          className="po-mini-btn"
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
                    <td title={row.remarks || ""}>{row.remarks || "-"}</td>
                    <td>
                      <span className={badgeClass(row.status)}>{row.status || STATUS_RM}</span>
                    </td>
                    <td>{actionLabel(row)}</td>
                    <td>
                      <div className="po-row-actions">
                        {canApproveRow(row) ? (
                          <button
                            className="po-mini-btn po-approve"
                            type="button"
                            onClick={() => approveRequest(row)}
                            disabled={processingId === `approve-${row.id}`}
                          >
                            {processingId === `approve-${row.id}` ? "Approving..." : "Approve"}
                          </button>
                        ) : null}

                        {canRejectRow(row) ? (
                          <button
                            className="po-mini-btn po-reject"
                            type="button"
                            onClick={() => {
                              setRejectingRow(row);
                              setRejectionReason("");
                            }}
                            disabled={processingId === `reject-${row.id}`}
                          >
                            Reject
                          </button>
                        ) : null}

                        {canDeleteRow(row) ? (
                          <button
                            className="po-mini-btn"
                            type="button"
                            onClick={() => deleteRequest(row)}
                            disabled={processingId === `delete-${row.id}`}
                          >
                            Delete
                          </button>
                        ) : (
                          !canApproveRow(row) && !canRejectRow(row) ? (
                            <span style={{ opacity: 0.7 }}>-</span>
                          ) : null
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && (
        <div
          className="po-modal-overlay"
          onMouseDown={(e) => e.target.classList.contains("po-modal-overlay") && closeCreate()}
        >
          <div className="po-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="po-modal-head">
              <h3 className="po-modal-title">Create Resignation Request</h3>
              <button className="po-x" onClick={closeCreate} type="button">
                ✕
              </button>
            </div>

            <form className="po-form" onSubmit={submitCreate}>
              <div className="po-grid">
                <div className="po-field full" ref={employeeBoxRef} style={{ position: "relative" }}>
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

                <div className="po-field">
                  <label>Employee No</label>
                  <input value={form.employee_no} readOnly placeholder="Auto-filled" />
                </div>

                <div className="po-field">
                  <label>Last Name</label>
                  <input value={form.last_name} readOnly placeholder="Auto-filled" />
                </div>

                <div className="po-field">
                  <label>First Name</label>
                  <input value={form.first_name} readOnly placeholder="Auto-filled" />
                </div>

                <div className="po-field">
                  <label>Middle Name</label>
                  <input value={form.middle_name} readOnly placeholder="Auto-filled" />
                </div>

                <div className="po-field">
                  <label>Branch</label>
                  <input
                    value={
                      form.branch_code || form.branch_name
                        ? `${form.branch_code || ""}${form.branch_code && form.branch_name ? " - " : ""}${form.branch_name || ""}`
                        : ""
                    }
                    readOnly
                    placeholder="Auto-filled"
                  />
                </div>

                <div className="po-field">
                  <label>Resignation Date</label>
                  <input
                    type="date"
                    value={form.resignation_date}
                    onChange={(e) => setForm((prev) => ({ ...prev, resignation_date: e.target.value }))}
                    required
                  />
                </div>

                <div className="po-field">
                  <label>Effective Date</label>
                  <input
                    type="date"
                    value={form.effective_date}
                    onChange={(e) => setForm((prev) => ({ ...prev, effective_date: e.target.value }))}
                    required
                  />
                </div>

                <div className="po-field full">
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

                <div className="po-field full">
                  <label>Remarks</label>
                  <textarea
                    value={form.remarks}
                    onChange={(e) => setForm((prev) => ({ ...prev, remarks: e.target.value }))}
                    placeholder="Reason / remarks..."
                  />
                </div>
              </div>

              <div className="po-modal-actions">
                <button className="po-btn po-btn-outline" type="button" onClick={closeCreate}>
                  Cancel
                </button>
                <button className="po-btn po-btn-primary" type="submit" disabled={saving}>
                  {saving ? "Saving..." : "Create Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {rejectingRow && (
        <div
          className="po-modal-overlay"
          onMouseDown={(e) => e.target.classList.contains("po-modal-overlay") && setRejectingRow(null)}
        >
          <div className="po-modal po-modal-sm" onMouseDown={(e) => e.stopPropagation()}>
            <div className="po-modal-head">
              <h3 className="po-modal-title">Reject Resignation Request</h3>
              <button className="po-x" type="button" onClick={() => setRejectingRow(null)}>
                ✕
              </button>
            </div>

            <div className="po-form">
              <div className="po-field full">
                <label>Reason</label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Enter rejection reason..."
                />
              </div>

              <div className="po-modal-actions">
                <button className="po-btn po-btn-outline" type="button" onClick={() => setRejectingRow(null)}>
                  Cancel
                </button>
                <button
                  className="po-btn po-btn-primary"
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