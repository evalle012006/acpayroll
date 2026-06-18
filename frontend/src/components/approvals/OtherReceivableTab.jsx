import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "../../api/axiosClient";

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

const toStr = (v) => String(v ?? "").trim();
const norm = (v) => toStr(v).toLowerCase();

const fmtMoney = (v) =>
  Number(toNum(v)).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtDate = (d) => (d ? String(d).slice(0, 10) : "-");

const isOperationDepartment = (department) =>
  ["operation", "operations", "operation department", "operations department"].includes(
    norm(department)
  );

const isHrDepartment = (role, department) =>
  role === "hr" ||
  department === "hr" ||
  department === "hr department" ||
  department === "human resources" ||
  department === "human resources department";

const isAccountingDepartment = (role, department) =>
  role === "accounting" ||
  department === "accounting" ||
  department === "accounting department";

const getBranchText = (s) =>
  toStr(
    s?.branch_name ||
      s?.branch ||
      s?.branch_code ||
      s?.present_branch_name ||
      s?.prev_branch_name ||
      s?.branch_id
  );

export default function OtherReceivableTab() {
  const user = useMemo(() => readUser(), []);
  const role = norm(user?.role);
  const department = norm(user?.department);

  const isAdmin = role === "admin";
  const isIT = role === "it";
  const isHr = isHrDepartment(role, department);
  const isAccounting = isAccountingDepartment(role, department);

  const isBranchManager = role === "branch manager";
  const isAreaManager = role === "area manager" || role === "acting area manager";
  const isRegionalManager = role === "regional manager" || role === "acting regional manager";
  const isAssistantVicePresident = role === "assistant vice president";
  const isVicePresident = role === "vice president";
  const isSeniorVicePresident = role === "senior vice president";
  const isPresident = role === "president";
  const isTread = role === "tread";
  const isOperationVP = role === "vice president" && isOperationDepartment(department);

  const isITDepartment =
    department === "it department";

  const canCreateOR =
    isAdmin ||
    isIT ||
    isHr ||
    isAccounting ||
    isOperationVP ||
    (
      isITDepartment &&
      (
        isBranchManager ||
        isAreaManager ||
        isRegionalManager ||
        isAssistantVicePresident ||
        isVicePresident ||
        isSeniorVicePresident
      )
    );

  const canViewOR =
    isAdmin ||
    isIT ||
    isHr ||
    isAccounting ||
    isBranchManager ||
    isAreaManager ||
    isRegionalManager ||
    isAssistantVicePresident ||
    isVicePresident ||
    isSeniorVicePresident ||
    isPresident ||
    isTread;

  const isITManager =
    isITDepartment &&
    (
      isBranchManager ||
      isAreaManager ||
      isRegionalManager ||
      isAssistantVicePresident ||
      isVicePresident ||
      isSeniorVicePresident
    );

  const canApproveOR =
    isHr ||
    isAccounting ||
    isSeniorVicePresident ||
    isITManager;

  const canRejectOR =
    isHr ||
    isAccounting ||
    isIT ||
    isSeniorVicePresident ||
    isITManager;

  const canVoidOR =
    isAccounting ||
    isHr ||
    isAdmin ||
    isIT ||
    isITManager;

  const canDeleteOR = isAdmin || isIT || department === "it" || department === "it department";
  const canBypassOR = isAdmin || isIT;

  const [rows, setRows] = useState([]);
  const [staffList, setStaffList] = useState([]);

  const [showCreate, setShowCreate] = useState(false);
  const [viewRow, setViewRow] = useState(null);

  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [processingId, setProcessingId] = useState("");

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [employeeSearch, setEmployeeSearch] = useState("");
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
  const employeeBoxRef = useRef(null);

  const [attachment, setAttachment] = useState(null);

  const [form, setForm] = useState({
    employee_id: "",
    employee_no: "",
    employee_name: "",
    branch: "",
    area: "",
    region: "",
    division: "",
    department: "",
    description: "",
    amount: "",
    term: "",
    per_month: "",
    deduction_start_date: "",
    release_date: "",
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

  const fetchRows = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/other-receivables");
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      if (err?.response?.status === 401) logout();
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!user || !token) {
      window.location.href = "/login";
      return;
    }

    if (!canViewOR) return;

    fetchStaff();
    fetchRows();
  }, [user, canViewOR, fetchStaff, fetchRows]);

  useEffect(() => {
    if (!showCreate && !viewRow) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        setShowCreate(false);
        setShowEmployeeDropdown(false);
        setViewRow(null);
      }
    };

    const onMouseDown = (e) => {
      if (employeeBoxRef.current && !employeeBoxRef.current.contains(e.target)) {
        setShowEmployeeDropdown(false);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onMouseDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onMouseDown);
      document.body.style.overflow = "";
    };
  }, [showCreate, viewRow]);

  const buildStaffDisplay = useCallback((s) => {
    if (!s) return "-";

    const built =
      s.fullname ||
      `${s.last_name || ""}${s.last_name && s.first_name ? ", " : ""}${
        s.first_name || ""
      }${s.middle_name ? ` ${s.middle_name}` : ""}`
        .replace(/\s+/g, " ")
        .trim();

    return built || "-";
  }, []);

  const staffMap = useMemo(() => {
    const m = new Map();
    staffList.forEach((s) => m.set(String(s.id), s));
    return m;
  }, [staffList]);

  const staffDisplayName = useCallback(
    (staffId) => buildStaffDisplay(staffMap.get(String(staffId))),
    [staffMap, buildStaffDisplay]
  );

  const searchableStaff = useMemo(() => {
    return staffList.map((s) => {
      const display = buildStaffDisplay(s);
      const branchText = getBranchText(s);

      const searchBlob = [
        s.id,
        s.employee_no,
        s.fullname,
        s.first_name,
        s.last_name,
        s.middle_name,
        display,
        s.position,
        s.branch_id,
        branchText,
        s.area,
        s.region,
        s.division,
        s.department,
      ]
        .map((x) => toStr(x))
        .join(" ")
        .toLowerCase();

      return {
        ...s,
        _display: display,
        _branchText: branchText,
        _searchBlob: searchBlob,
      };
    });
  }, [staffList, buildStaffDisplay]);

  const filteredEmployees = useMemo(() => {
    const q = norm(employeeSearch);
    if (!q) return searchableStaff.slice(0, 20);
    return searchableStaff.filter((s) => s._searchBlob.includes(q)).slice(0, 20);
  }, [searchableStaff, employeeSearch]);

  const filteredRows = useMemo(() => {
    const q = norm(search);
    if (!q) return rows;

    return rows.filter((x) => {
      const haystack = [
        x.id,
        x.employee_id,
        x.employee_no,
        x.employee_name,
        staffDisplayName(x.employee_id),
        x.description,
        x.amount,
        x.release_date,
        x.status,
        x.created_at,
        x.approved_at,
        x.rejected_at,
        x.rejection_reason,
        x.area,
        x.region,
        x.division,
        x.department,
      ]
        .map((v) => toStr(v).toLowerCase())
        .join(" ");

      return haystack.includes(q);
    });
  }, [rows, search, staffDisplayName]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));

  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [search, pageSize]);

  const badgeClass = (status) => {
    const s = String(status || "").trim();
    if (s === "Approved") return "badge badge-approved";
    if (s === "Rejected") return "badge badge-rejected";
    if (s === "Void") return "badge badge-rejected";
    return "badge badge-pending";
  };

  const handleEmployeeSelect = (employeeId) => {
    const emp = staffList.find((s) => String(s.id) === String(employeeId));
    const display = buildStaffDisplay(emp);

    setForm((prev) => ({
      ...prev,
      employee_id: String(employeeId || ""),
      employee_no: emp?.employee_no || "",
      employee_name: display || "-",
      branch: getBranchText(emp),
      area: emp?.area || "",
      region: emp?.region || "",
      division: emp?.division || "",
      department: emp?.department || "",
    }));

    setEmployeeSearch(
      emp ? `${emp.employee_no ? `${emp.employee_no} - ` : ""}${display}` : ""
    );
    setShowEmployeeDropdown(false);
  };

  const resetForm = () => {
    setForm({
      employee_id: "",
      employee_no: "",
      employee_name: "",
      branch: "",
      area: "",
      region: "",
      division: "",
      department: "",
      description: "",
      amount: "",
      term: "",
      per_month: "",
      deduction_start_date: "",
      release_date: "",
    });
    setAttachment(null);
    setEmployeeSearch("");
    setShowEmployeeDropdown(false);
  };

  const handleCreate = async (e) => {
    e.preventDefault();

    const amount = toNum(form.amount);

    const term = Math.max(1, toNum(form.term));
    const perMonth =
      toNum(form.per_month) > 0 ? toNum(form.per_month) : amount / term;

    try {
      setCreating(true);

      const fd = new FormData();
      fd.append("employee_id", form.employee_id || "");
      fd.append("employee_no", form.employee_no);
      fd.append("employee_name", form.employee_name);

      fd.append("branch", form.branch);
      fd.append("area", form.area);
      fd.append("region", form.region);
      fd.append("division", form.division);
      fd.append("department", form.department);

      fd.append("description", form.description);
      fd.append("amount", amount);
      fd.append("release_date", form.release_date);

      fd.append("term", term);
      fd.append("per_month", perMonth);
      fd.append("deduction_start_date", form.deduction_start_date);

      if (attachment) {
        fd.append("attachment", attachment);
      }

      await api.post("/other-receivables", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      alert("Other Receivable submitted successfully.");
      resetForm();
      setShowCreate(false);
      await fetchRows();
    } catch (err) {
      if (err?.response?.status === 401) return logout();
      alert(err?.response?.data?.message || "Failed to add Other Receivable.");
    } finally {
      setCreating(false);
    }
  };

  const approveRow = async (row) => {
    const ok = window.confirm("Approve this Other Receivable record?");
    if (!ok) return;

    try {
      setProcessingId(`or-${row.id}-Approved`);

      await api.put(`/other-receivables/${row.id}`, {
        status: "Approved",
      });

      alert("Other Receivable approved successfully.");
      await fetchRows();
    } catch (err) {
      if (err?.response?.status === 401) return logout();
      if (err?.response?.status === 403) return alert("Access denied.");
      alert(err?.response?.data?.message || "Failed to approve Other Receivable.");
    } finally {
      setProcessingId("");
    }
  };

  const rejectRow = async (row) => {
    const reason = window.prompt("Reason for rejection?");
    if (!reason || !String(reason).trim()) {
      alert("Rejection reason is required.");
      return;
    }

    const ok = window.confirm("Reject this Other Receivable record?");
    if (!ok) return;

    try {
      setProcessingId(`or-${row.id}-Rejected`);

      await api.put(`/other-receivables/${row.id}`, {
        status: "Rejected",
        reason: String(reason).trim(),
      });

      alert("Other Receivable rejected successfully.");
      await fetchRows();
    } catch (err) {
      if (err?.response?.status === 401) return logout();
      if (err?.response?.status === 403) return alert("Access denied.");
      alert(err?.response?.data?.message || "Failed to reject Other Receivable.");
    } finally {
      setProcessingId("");
    }
  };

  const bypassRow = async (row) => {
    const ok = window.confirm("Bypass approval and approve this Other Receivable?");
    if (!ok) return;

    try {
      setProcessingId(`or-${row.id}-Bypass`);

      await api.put(`/other-receivables/${row.id}/bypass`);

      alert("Other Receivable bypass approved successfully.");
      await fetchRows();
    } catch (err) {
      if (err?.response?.status === 401) return logout();
      if (err?.response?.status === 403) return alert("Access denied.");
      alert(err?.response?.data?.message || "Failed to bypass approve Other Receivable.");
    } finally {
      setProcessingId("");
    }
  };

  const voidRow = async (row) => {
    const reason = window.prompt("Reason for void?");
    if (!reason || !String(reason).trim()) {
      alert("Void reason is required.");
      return;
    }

    const ok = window.confirm("Void this approved Other Receivable record?");
    if (!ok) return;

    try {
      setProcessingId(`or-${row.id}-Void`);

      await api.put(`/other-receivables/${row.id}/void`, {
        reason: String(reason).trim(),
      });

      alert("Other Receivable voided successfully.");
      await fetchRows();
    } catch (err) {
      if (err?.response?.status === 401) return logout();
      if (err?.response?.status === 403) return alert("Access denied.");
      alert(err?.response?.data?.message || "Failed to void Other Receivable.");
    } finally {
      setProcessingId("");
    }
  };

  const deleteRow = async (row) => {
    const ok = window.confirm("Delete this Other Receivable record?");
    if (!ok) return;

    try {
      setProcessingId(`or-${row.id}-Delete`);

      await api.delete(`/other-receivables/${row.id}`);

      alert("Other Receivable deleted successfully.");
      await fetchRows();
    } catch (err) {
      if (err?.response?.status === 401) return logout();
      if (err?.response?.status === 403) return alert("Access denied.");
      alert(err?.response?.data?.message || "Failed to delete Other Receivable.");
    } finally {
      setProcessingId("");
    }
  };

  const downloadFile = async (row) => {
    try {
      const res = await api.get(`/other-receivables/${row.id}/download`, {
        responseType: "blob",
      });

      const blob = new Blob([res.data]);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");

      a.href = url;
      a.download = row.attachment_name || `other-receivable-${row.id}`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to download file.");
    }
  };

  const pendingCount = useMemo(
    () => rows.filter((x) => norm(x.status) === "pending").length,
    [rows]
  );

  if (!canViewOR) return null;

  return (
    <>
      <div className="reg-card-head">
        <div className="reg-topbar-actions">
          <button type="button" className="reg-btn reg-btn-outline" onClick={fetchRows}>
            Refresh
          </button>

          {canCreateOR && (
            <button
              type="button"
              className="reg-btn reg-btn-primary"
              onClick={() => setShowCreate(true)}
            >
              + Create
            </button>
          )}
        </div>
      </div>

      <div className="reg-card">
        <div className="reg-card-head">
          <div>
            <div className="reg-card-title">Other Receivable List</div>
            <div className="reg-subtitle">
              Employee liabilities and receivables charged to staff.
            </div>
            <div className="reg-subtitle">
              Pending: <b>{pendingCount}</b> • Results: <b>{filteredRows.length}</b>
            </div>
          </div>
        </div>

        <div className="exit-filter-bar">
          <div className="exit-search-box">
            <span className="exit-search-icon">⌕</span>
            <input
              className="exit-search-input"
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && setSearch(searchInput)}
              placeholder="Search employee, employee no, status, amount..."
            />
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              className="reg-btn reg-btn-outline"
              type="button"
              onClick={() => setSearch(searchInput)}
            >
              Search
            </button>

            <button
              className="reg-btn reg-btn-outline"
              type="button"
              onClick={() => {
                setSearchInput("");
                setSearch("");
              }}
            >
              Clear
            </button>
          </div>
        </div>

        <div className="reg-table-wrap">
          <table className="reg-table">
            <thead>
              <tr>
                <th>Employee ID</th>
                <th>Employee Name</th>
                <th>Amount</th>
                <th>Date of Release</th>
                <th>Status</th>
                <th>Files</th>
                <th>Dates</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="reg-empty">
                    Loading...
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="reg-empty">
                    No Other Receivable records found.
                  </td>
                </tr>
              ) : (
                pagedRows.map((x) => {
                  const status = norm(x.status || "Pending");
                  const isPending = status === "pending";
                  const isApproved = status === "approved";

                  return (
                    <tr key={x.id ?? `${x.employee_id}-${x.description}`}>
                      <td>{x.employee_no || x.employee_id || "-"}</td>

                      <td>
                        <strong>
                          {x.employee_name || staffDisplayName(x.employee_id)}
                        </strong>
                        <div style={{ fontSize: 12, opacity: 0.75 }}>
                          Record ID: {x.id || "-"}
                        </div>
                      </td>

                      <td>₱ {fmtMoney(x.amount)}</td>
                      <td>{fmtDate(x.release_date)}</td>

                      <td>
                        <span className={badgeClass(x.status)}>
                          {x.status || "Pending"}
                        </span>
                      </td>

                      <td>
                        {x.attachment_path ? (
                          <button
                            className="reg-mini-btn"
                            type="button"
                            onClick={() => downloadFile(x)}
                          >
                            File
                          </button>
                        ) : (
                          "-"
                        )}
                      </td>

                      <td style={{ fontSize: 12 }}>
                        <div>Approved: {fmtDate(x.approved_at)}</div>
                        <div>Rejected/Void: {fmtDate(x.rejected_at)}</div>
                      </td>

                      <td>
                        <div className="reg-row-actions">
                          <button
                            className="reg-mini-btn"
                            type="button"
                            onClick={() => setViewRow(x)}
                          >
                            View
                          </button>

                          {isPending && canApproveOR ? (
                            <button
                              className="reg-mini-btn reg-approve"
                              onClick={() => approveRow(x)}
                              type="button"
                              disabled={processingId === `or-${x.id}-Approved`}
                            >
                              {processingId === `or-${x.id}-Approved`
                                ? "Approving..."
                                : "Approve"}
                            </button>
                          ) : null}

                          {isPending && canBypassOR ? (
                            <button
                              className="reg-mini-btn reg-approve"
                              onClick={() => bypassRow(x)}
                              type="button"
                              disabled={processingId === `or-${x.id}-Bypass`}
                            >
                              {processingId === `or-${x.id}-Bypass`
                                ? "Bypassing..."
                                : "Bypass"}
                            </button>
                          ) : null}

                          {isPending && canRejectOR ? (
                            <button
                              className="reg-mini-btn reg-reject"
                              onClick={() => rejectRow(x)}
                              type="button"
                              disabled={processingId === `or-${x.id}-Rejected`}
                            >
                              {processingId === `or-${x.id}-Rejected`
                                ? "Rejecting..."
                                : "Reject"}
                            </button>
                          ) : null}

                          {isApproved && canVoidOR ? (
                            <button
                              className="reg-mini-btn reg-reject"
                              onClick={() => voidRow(x)}
                              type="button"
                              disabled={processingId === `or-${x.id}-Void`}
                            >
                              {processingId === `or-${x.id}-Void`
                                ? "Voiding..."
                                : "Void"}
                            </button>
                          ) : null}

                          {(status === "rejected" || status === "void") && canDeleteOR ? (
                            <button
                              className="reg-mini-btn reg-reject"
                              onClick={() => deleteRow(x)}
                              type="button"
                              disabled={processingId === `or-${x.id}-Delete`}
                            >
                              {processingId === `or-${x.id}-Delete`
                                ? "Deleting..."
                                : "Delete"}
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

        <div className="exit-pager">
          <div className="exit-page-size">
            <span>Rows per page:</span>
            <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
              {[25, 50, 75, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>

          <div className="exit-page-info">
            Page {page} of {totalPages}
          </div>

          <div className="exit-page-buttons">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>

            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {canCreateOR && showCreate && (
        <div
          className="reg-modal-overlay"
          onMouseDown={(e) =>
            e.target.classList.contains("reg-modal-overlay") && setShowCreate(false)
          }
        >
          <div className="reg-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="reg-modal-head">
              <div>
                <h3 className="reg-modal-title">Add Other Receivable</h3>
                <p className="reg-subtitle">Create employee liability charge.</p>
              </div>

              <button className="reg-x" type="button" onClick={() => setShowCreate(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="reg-form">
              <div className="reg-grid">
                <div
                  className="reg-field full"
                  ref={employeeBoxRef}
                  style={{ position: "relative" }}
                >
                  <label>Employee</label>
                  <input
                    type="text"
                    value={employeeSearch}
                    onChange={(e) => {
                      setEmployeeSearch(e.target.value);
                      setShowEmployeeDropdown(true);
                      setForm((p) => ({
                        ...p,
                        employee_id: "",
                        employee_no: "",
                        employee_name: "",
                        branch: "",
                        area: "",
                        region: "",
                        division: "",
                        department: "",
                      }));
                    }}
                    onFocus={() => setShowEmployeeDropdown(true)}
                    placeholder="Search employee ID or name..."
                    required={!form.employee_id}
                  />

                  {showEmployeeDropdown && (
                    <div className="reg-search-dropdown">
                      {filteredEmployees.length === 0 ? (
                        <div className="reg-search-empty">No employee found</div>
                      ) : (
                        filteredEmployees.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => handleEmployeeSelect(s.id)}
                            className="reg-search-item"
                          >
                            {s.employee_no ? `${s.employee_no} - ` : ""}
                            {s._display}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                <div className="reg-field">
                  <label>Employee ID</label>
                  <input value={form.employee_no} readOnly placeholder="Auto-filled" />
                </div>

                <div className="reg-field">
                  <label>Employee Name</label>
                  <input value={form.employee_name} readOnly placeholder="Auto-filled" />
                </div>

                <div className="reg-field">
                  <label>Branch</label>
                  <input value={form.branch} readOnly placeholder="Auto-filled" />
                </div>

                <div className="reg-field">
                  <label>Area</label>
                  <input value={form.area} readOnly placeholder="Auto-filled" />
                </div>

                <div className="reg-field">
                  <label>Region</label>
                  <input value={form.region} readOnly placeholder="Auto-filled" />
                </div>

                <div className="reg-field">
                  <label>Division</label>
                  <input value={form.division} readOnly placeholder="Auto-filled" />
                </div>

                <div className="reg-field full">
                  <label>Department</label>
                  <input value={form.department} readOnly placeholder="Auto-filled" />
                </div>

                <div className="reg-field full">
                  <label>Description</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                    required
                  />
                </div>

                <div className="reg-field">
                  <label>Amount</label>
                  <input
                    type="number"
                    value={form.amount}
                    onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
                    required
                  />
                </div>

                <div className="reg-field">
                  <label>Date of Release</label>
                  <input
                    type="date"
                    value={form.release_date}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        release_date: e.target.value,
                      }))
                    }
                    required
                  />
                </div>

                <div className="reg-field">
                  <label>Terms</label>
                  <input
                    type="number"
                    value={form.term}
                    onChange={(e) => setForm((p) => ({ ...p, term: e.target.value }))}
                    required
                  />
                </div>

                <div className="reg-field">
                  <label>Per Month</label>
                  <input
                    type="number"
                    value={form.per_month}
                    onChange={(e) => setForm((p) => ({ ...p, per_month: e.target.value }))}
                    placeholder="Auto if blank"
                  />
                </div>

                <div className="reg-field">
                  <label>Start Date of Deduction</label>
                  <input
                    type="date"
                    value={form.deduction_start_date}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        deduction_start_date: e.target.value,
                      }))
                    }
                    required
                  />
                </div>

                <div className="reg-field full">
                  <label>File Upload</label>
                  <input
                    type="file"
                    onChange={(e) => setAttachment(e.target.files?.[0] || null)}
                  />
                </div>
              </div>

              <div className="reg-modal-actions">
                <button
                  className="reg-btn reg-btn-outline"
                  type="button"
                  onClick={() => setShowCreate(false)}
                >
                  Cancel
                </button>

                <button className="reg-btn reg-btn-primary" type="submit" disabled={creating}>
                  {creating ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewRow && (
        <div
          className="reg-modal-overlay"
          onMouseDown={(e) =>
            e.target.classList.contains("reg-modal-overlay") && setViewRow(null)
          }
        >
          <div className="reg-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="reg-modal-head">
              <div>
                <h3 className="reg-modal-title">Other Receivable Details</h3>
                <p className="reg-subtitle">{viewRow.employee_name || "-"}</p>
              </div>

              <button className="reg-x" type="button" onClick={() => setViewRow(null)}>
                ✕
              </button>
            </div>

            <div className="reg-form">
              <div className="reg-grid">
                <div className="reg-field">
                  <label>Record ID</label>
                  <input value={viewRow.id ?? "-"} readOnly />
                </div>

                <div className="reg-field">
                  <label>Employee ID</label>
                  <input value={viewRow.employee_no || viewRow.employee_id || "-"} readOnly />
                </div>

                <div className="reg-field">
                  <label>Employee Name</label>
                  <input
                    value={viewRow.employee_name || staffDisplayName(viewRow.employee_id)}
                    readOnly
                  />
                </div>

                <div className="reg-field">
                  <label>Branch</label>
                  <input value={viewRow.branch || viewRow.branch_id || "-"} readOnly />
                </div>

                <div className="reg-field">
                  <label>Area</label>
                  <input value={viewRow.area || "-"} readOnly />
                </div>

                <div className="reg-field">
                  <label>Region</label>
                  <input value={viewRow.region || "-"} readOnly />
                </div>

                <div className="reg-field">
                  <label>Division</label>
                  <input value={viewRow.division || "-"} readOnly />
                </div>

                <div className="reg-field">
                  <label>Department</label>
                  <input value={viewRow.department || "-"} readOnly />
                </div>

                <div className="reg-field full">
                  <label>Description</label>
                  <textarea value={viewRow.description || "-"} readOnly />
                </div>

                <div className="reg-field">
                  <label>Amount</label>
                  <input value={`₱ ${fmtMoney(viewRow.amount)}`} readOnly />
                </div>

                <div className="reg-field">
                  <label>Date of Release</label>
                  <input value={fmtDate(viewRow.release_date)} readOnly />
                </div>

                <div className="reg-field">
                  <label>Status</label>
                  <input value={viewRow.status || "Pending"} readOnly />
                </div>

                <div className="reg-field">
                  <label>Created Date</label>
                  <input value={fmtDate(viewRow.created_at)} readOnly />
                </div>

                <div className="reg-field">
                  <label>Approved Date</label>
                  <input value={fmtDate(viewRow.approved_at)} readOnly />
                </div>

                <div className="reg-field">
                  <label>Rejected/Void Date</label>
                  <input value={fmtDate(viewRow.rejected_at)} readOnly />
                </div>

                <div className="reg-field full">
                  <label>Files</label>
                  <div className="reg-row-actions">
                    {viewRow.attachment_path ? (
                      <button
                        className="reg-mini-btn"
                        type="button"
                        onClick={() => downloadFile(viewRow)}
                      >
                        Download File
                      </button>
                    ) : (
                      <span>-</span>
                    )}
                  </div>
                </div>

                {viewRow.rejection_reason ? (
                  <div className="reg-field full">
                    <label>Rejection/Void Reason</label>
                    <textarea value={viewRow.rejection_reason} readOnly />
                  </div>
                ) : null}
              </div>

              <div className="reg-modal-actions">
                <button
                  className="reg-btn reg-btn-outline"
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
    </>
  );
}