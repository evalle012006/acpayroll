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

export default function SAPApprovalTab() {
  const user = useMemo(() => readUser(), []);
  const role = norm(user?.role);
  const department = norm(user?.department);

  const isAdmin = role === "admin";
  const isIT = role === "it";
  const isHr = isHrDepartment(role, department);
  const isAccounting = isAccountingDepartment(role, department);

  const isBranchManager = role === "branch manager";
  const isAreaManager = role === "area manager" || role === "acting area manager";
  const isRegionalManager =
    role === "regional manager" || role === "acting regional manager";
  const isAssistantVicePresident = role === "assistant vice president";
  const isVicePresident = role === "vice president";
  const isSeniorVicePresident = role === "senior vice president";
  const isPresident = role === "president";
  const isTread = role === "tread";

  const isOperationVP =
    role === "vice president" && isOperationDepartment(department);

  const canCreateSAP =
    isAdmin || isIT || isHr || isAccounting || isOperationVP;

  const canViewSAP =
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

  const canApproveSAP = isHr || isAccounting || isSeniorVicePresident;
  const canRejectSAP = isHr || isAccounting || isIT || isSeniorVicePresident;
  const canVoidSAP = isAccounting || isHr || isAdmin || isIT;
  const canDeleteSAP =
    isAdmin ||
    isIT ||
    department === "it" ||
    department === "it department";

  const canBypassSAP = isAdmin || isIT;
  const canUploadFinalFile = isHr || isAccounting || isAdmin || isIT;

  const [sapRows, setSapRows] = useState([]);
  const [staffList, setStaffList] = useState([]);

  const [showCreateSAP, setShowCreateSAP] = useState(false);
  const [viewSap, setViewSap] = useState(null);

  const [loadingSap, setLoadingSap] = useState(false);
  const [creatingSap, setCreatingSap] = useState(false);
  const [processingId, setProcessingId] = useState("");

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [sapEmployeeSearch, setSapEmployeeSearch] = useState("");
  const [showSapEmployeeDropdown, setShowSapEmployeeDropdown] = useState(false);
  const sapEmployeeBoxRef = useRef(null);

  const [sapAttachment, setSapAttachment] = useState(null);
  const [sapApprovedFiles, setSapApprovedFiles] = useState({});

  const [sapForm, setSapForm] = useState({
    employee_id: "",
    employee_no: "",
    staff_name: "",
    branch: "",
    area: "",
    region: "",
    division: "",
    department: "",
    description: "",
    amount: "",
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

  const fetchSap = useCallback(async () => {
    try {
      setLoadingSap(true);
      const res = await api.get("/staff-accounts-payable");
      setSapRows(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      if (err?.response?.status === 401) logout();
      setSapRows([]);
    } finally {
      setLoadingSap(false);
    }
  }, [logout]);

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!user || !token) {
      window.location.href = "/login";
      return;
    }

    if (!canViewSAP) return;

    fetchStaff();
    fetchSap();
  }, [user, canViewSAP, fetchStaff, fetchSap]);

  useEffect(() => {
    if (!showCreateSAP && !viewSap) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        setShowCreateSAP(false);
        setShowSapEmployeeDropdown(false);
        setViewSap(null);
      }
    };

    const onMouseDown = (e) => {
      if (sapEmployeeBoxRef.current && !sapEmployeeBoxRef.current.contains(e.target)) {
        setShowSapEmployeeDropdown(false);
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
  }, [showCreateSAP, viewSap]);

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

  const filteredSapEmployees = useMemo(() => {
    const q = norm(sapEmployeeSearch);
    if (!q) return searchableStaff.slice(0, 20);
    return searchableStaff.filter((s) => s._searchBlob.includes(q)).slice(0, 20);
  }, [searchableStaff, sapEmployeeSearch]);

  const filteredRows = useMemo(() => {
    const q = norm(search);

    if (!q) return sapRows;

    return sapRows.filter((x) => {
      const haystack = [
        x.id,
        x.employee_id,
        x.employee_no,
        x.staff_name,
        staffDisplayName(x.employee_id),
        x.description,
        x.amount,
        x.term,
        x.per_month,
        x.balance,
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
  }, [sapRows, search, staffDisplayName]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));

  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [search, pageSize]);

  const handleSearch = () => setSearch(searchInput);

  const handleClearSearch = () => {
    setSearchInput("");
    setSearch("");
  };

  const badgeClass = (status) => {
    const s = String(status || "").trim();
    if (s === "Approved") return "badge badge-approved";
    if (s === "Rejected") return "badge badge-rejected";
    if (s === "Void") return "badge badge-rejected";
    return "badge badge-pending";
  };

  const handleSapEmployeeSelect = (employeeId) => {
    const emp = staffList.find((s) => String(s.id) === String(employeeId));
    const display = buildStaffDisplay(emp);

    setSapForm((prev) => ({
      ...prev,
      employee_id: String(employeeId || ""),
      employee_no: emp?.employee_no || "",
      staff_name: display || "-",
      branch: getBranchText(emp),
      area: emp?.area || "",
      region: emp?.region || "",
      division: emp?.division || "",
      department: emp?.department || "",
    }));

    setSapEmployeeSearch(
      emp ? `${emp.employee_no ? `${emp.employee_no} - ` : ""}${display}` : ""
    );
    setShowSapEmployeeDropdown(false);
  };

  const resetSapForm = () => {
    setSapForm({
      employee_id: "",
      employee_no: "",
      staff_name: "",
      branch: "",
      area: "",
      region: "",
      division: "",
      department: "",
      description: "",
      amount: "",
      release_date: "",
    });
    setSapAttachment(null);
    setSapEmployeeSearch("");
    setShowSapEmployeeDropdown(false);
  };

  const handleCreateSAP = async (e) => {
    e.preventDefault();

    const amount = toNum(sapForm.amount);

    try {
      setCreatingSap(true);

      const fd = new FormData();
      fd.append("employee_id", sapForm.employee_id || "");
      fd.append("employee_no", sapForm.employee_no);
      fd.append("staff_name", sapForm.staff_name);

      fd.append("branch", sapForm.branch);
      fd.append("area", sapForm.area);
      fd.append("region", sapForm.region);
      fd.append("division", sapForm.division);
      fd.append("department", sapForm.department);

      fd.append("description", sapForm.description);
      fd.append("amount", amount);
      fd.append("release_date", sapForm.release_date);

      if (sapAttachment) {
        fd.append("attachment", sapAttachment);
      }

      await api.post("/staff-accounts-payable", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      alert("SAP request submitted successfully.");
      resetSapForm();
      setShowCreateSAP(false);
      await fetchSap();
    } catch (err) {
      if (err?.response?.status === 401) return logout();
      alert(err?.response?.data?.message || "Failed to add Staff Accounts Payable.");
    } finally {
      setCreatingSap(false);
    }
  };

  const approveSap = async (row) => {
    const file = sapApprovedFiles[row.id];

    if (canUploadFinalFile && !file) {
      alert("Please upload the latest approved file before approving.");
      return;
    }

    const ok = window.confirm("Approve this SAP record?");
    if (!ok) return;

    try {
      setProcessingId(`sap-${row.id}-Approved`);

      const fd = new FormData();
      fd.append("status", "Approved");

      if (file) {
        fd.append("attachment", file);
      }

      await api.put(`/staff-accounts-payable/${row.id}`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setSapApprovedFiles((prev) => {
        const copy = { ...prev };
        delete copy[row.id];
        return copy;
      });

      alert("SAP approved successfully.");
      await fetchSap();
    } catch (err) {
      if (err?.response?.status === 401) return logout();
      if (err?.response?.status === 403) return alert("Access denied.");
      alert(err?.response?.data?.message || "Failed to approve SAP.");
    } finally {
      setProcessingId("");
    }
  };

  const rejectSap = async (row) => {
    const reason = window.prompt("Reason for rejection?");
    if (!reason || !String(reason).trim()) {
      alert("Rejection reason is required.");
      return;
    }

    const ok = window.confirm("Reject this SAP record?");
    if (!ok) return;

    try {
      setProcessingId(`sap-${row.id}-Rejected`);

      await api.put(`/staff-accounts-payable/${row.id}`, {
        status: "Rejected",
        reason: String(reason).trim(),
      });

      alert("SAP rejected successfully.");
      await fetchSap();
    } catch (err) {
      if (err?.response?.status === 401) return logout();
      if (err?.response?.status === 403) return alert("Access denied.");
      alert(err?.response?.data?.message || "Failed to reject SAP.");
    } finally {
      setProcessingId("");
    }
  };

  const bypassSap = async (row) => {
    const file = sapApprovedFiles[row.id];

    if (!file) {
      alert("Final approved attachment is required for bypass approval.");
      return;
    }

    const ok = window.confirm("Bypass approval and approve this SAP record?");
    if (!ok) return;

    try {
      setProcessingId(`sap-${row.id}-Bypass`);

      const fd = new FormData();
      fd.append("attachment", file);

      await api.put(`/staff-accounts-payable/${row.id}/bypass`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setSapApprovedFiles((prev) => {
        const copy = { ...prev };
        delete copy[row.id];
        return copy;
      });

      alert("SAP bypass approved successfully.");
      await fetchSap();
    } catch (err) {
      if (err?.response?.status === 401) return logout();
      if (err?.response?.status === 403) return alert("Access denied.");
      alert(err?.response?.data?.message || "Failed to bypass approve SAP.");
    } finally {
      setProcessingId("");
    }
  };

  const voidSap = async (row) => {
    const reason = window.prompt("Reason for void?");
    if (!reason || !String(reason).trim()) {
      alert("Void reason is required.");
      return;
    }

    const ok = window.confirm(
      "Void this approved SAP record?"
    );
    if (!ok) return;

    try {
      setProcessingId(`sap-${row.id}-Void`);

      await api.put(`/staff-accounts-payable/${row.id}/void`, {
        reason: String(reason).trim(),
      });

      alert("SAP voided successfully.");
      await fetchSap();
    } catch (err) {
      if (err?.response?.status === 401) return logout();
      if (err?.response?.status === 403) return alert("Access denied.");
      alert(err?.response?.data?.message || "Failed to void SAP.");
    } finally {
      setProcessingId("");
    }
  };

  const deleteSap = async (row) => {
    const ok = window.confirm(
      "Delete this SAP record? Approved records must be voided first."
    );
    if (!ok) return;

    try {
      setProcessingId(`sap-${row.id}-Delete`);

      await api.delete(`/staff-accounts-payable/${row.id}`);

      alert("SAP deleted successfully.");
      await fetchSap();
    } catch (err) {
      if (err?.response?.status === 401) return logout();
      if (err?.response?.status === 403) return alert("Access denied.");
      alert(err?.response?.data?.message || "Failed to delete SAP.");
    } finally {
      setProcessingId("");
    }
  };

  const downloadSapFile = async (row, type = "request") => {
    try {
      const res = await api.get(`/staff-accounts-payable/${row.id}/download/${type}`, {
        responseType: "blob",
      });

      const blob = new Blob([res.data]);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");

      const fallback =
        type === "approved"
          ? row.approved_attachment_name || `sap-approved-${row.id}`
          : row.attachment_name || `sap-request-${row.id}`;

      a.href = url;
      a.download = fallback;
      document.body.appendChild(a);
      a.click();
      a.remove();

      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to download file.");
    }
  };

  const sapPendingCount = useMemo(
    () => sapRows.filter((x) => norm(x.status) === "pending").length,
    [sapRows]
  );

  if (!canViewSAP) return null;

  return (
    <>
      <div className="reg-card-head">
        <div className="reg-topbar-actions">
          <button type="button" className="reg-btn reg-btn-outline" onClick={fetchSap}>
            Refresh
          </button>

          {canCreateSAP && (
            <button
              type="button"
              className="reg-btn reg-btn-primary"
              onClick={() => setShowCreateSAP(true)}
            >
              + Create
            </button>
          )}
        </div>
      </div>

      <div className="reg-card">
        <div className="reg-card-head">
          <div>
            <div className="reg-card-title">Staff Accounts Payable List</div>
            <div className="reg-subtitle">
              Admin, IT, HR, Accounting, and VP Operations can create SAP.
            </div>
            <div className="reg-subtitle">
              Pending: <b>{sapPendingCount}</b> • Results: <b>{filteredRows.length}</b>
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
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Search employee, employee no, status, amount..."
            />
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button className="reg-btn reg-btn-outline" type="button" onClick={handleSearch}>
              Search
            </button>

            <button className="reg-btn reg-btn-outline" type="button" onClick={handleClearSearch}>
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
                <th>Date Released</th>
                <th>Status</th>
                <th>Files</th>
                <th>Dates</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {loadingSap ? (
                <tr>
                  <td colSpan={10} className="reg-empty">
                    Loading...
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="reg-empty">
                    No Staff Accounts Payable records found.
                  </td>
                </tr>
              ) : (
                pagedRows.map((x) => {
                  const status = norm(x.status || "Pending");
                  const isPending = status === "pending";
                  const isApproved = status === "approved";
                  const isVoid = status === "void";

                  return (
                    <tr key={x.id ?? `${x.employee_id}-${x.description}`}>
                      <td>{x.employee_no || x.employee_id || "-"}</td>

                      <td>
                        <strong>{x.staff_name || staffDisplayName(x.employee_id)}</strong>
                        <div style={{ fontSize: 12, opacity: 0.75 }}>
                          Record ID: {x.id || "-"}
                        </div>
                      </td>

                      <td>₱ {fmtMoney(x.amount)}</td>
                      <td>{fmtDate(x.release_date)}</td>

                      <td>
                        <span className={badgeClass(x.status)}>{x.status || "Pending"}</span>
                      </td>

                      <td>
                        <div className="reg-row-actions">
                          {x.attachment_path ? (
                            <button
                              className="reg-mini-btn"
                              type="button"
                              onClick={() => downloadSapFile(x, "request")}
                            >
                              Request File
                            </button>
                          ) : null}

                          {x.approved_attachment_path ? (
                            <button
                              className="reg-mini-btn"
                              type="button"
                              onClick={() => downloadSapFile(x, "approved")}
                            >
                              Approved File
                            </button>
                          ) : null}

                          {!x.attachment_path && !x.approved_attachment_path ? "-" : null}
                        </div>
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
                            onClick={() => setViewSap(x)}
                          >
                            View
                          </button>

                          {isPending && canUploadFinalFile ? (
                            <label className="reg-mini-btn" style={{ cursor: "pointer" }}>
                              {sapApprovedFiles[x.id]?.name ? "Change File" : "Upload File"}
                              <input
                                type="file"
                                hidden
                                onChange={(e) =>
                                  setSapApprovedFiles((prev) => ({
                                    ...prev,
                                    [x.id]: e.target.files?.[0] || null,
                                  }))
                                }
                              />
                            </label>
                          ) : null}

                          {isPending && canApproveSAP ? (
                            <button
                              className="reg-mini-btn reg-approve"
                              onClick={() => approveSap(x)}
                              type="button"
                              disabled={processingId === `sap-${x.id}-Approved`}
                            >
                              {processingId === `sap-${x.id}-Approved`
                                ? "Approving..."
                                : "Approve"}
                            </button>
                          ) : null}

                          {isPending && canBypassSAP ? (
                            <button
                              className="reg-mini-btn reg-approve"
                              onClick={() => bypassSap(x)}
                              type="button"
                              disabled={processingId === `sap-${x.id}-Bypass`}
                            >
                              {processingId === `sap-${x.id}-Bypass`
                                ? "Bypassing..."
                                : "Bypass"}
                            </button>
                          ) : null}

                          {isPending && canRejectSAP ? (
                            <button
                              className="reg-mini-btn reg-reject"
                              onClick={() => rejectSap(x)}
                              type="button"
                              disabled={processingId === `sap-${x.id}-Rejected`}
                            >
                              {processingId === `sap-${x.id}-Rejected`
                                ? "Rejecting..."
                                : "Reject"}
                            </button>
                          ) : null}

                          {(status === "rejected" || status === "void") && canDeleteSAP ? (
                            <button
                              className="reg-mini-btn reg-reject"
                              onClick={() => deleteSap(x)}
                              type="button"
                              disabled={processingId === `sap-${x.id}-Delete`}
                            >
                              {processingId === `sap-${x.id}-Delete` ? "Deleting..." : "Delete"}
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

      {canCreateSAP && showCreateSAP && (
        <div
          className="reg-modal-overlay"
          onMouseDown={(e) =>
            e.target.classList.contains("reg-modal-overlay") && setShowCreateSAP(false)
          }
        >
          <div className="reg-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="reg-modal-head">
              <div>
                <h3 className="reg-modal-title">Add Staff Accounts Payable</h3>
                <p className="reg-subtitle">
                  Admin, IT, HR, Accounting, and VP Operations can create SAP.
                </p>
              </div>

              <button className="reg-x" type="button" onClick={() => setShowCreateSAP(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSAP} className="reg-form">
              <div className="reg-grid">
                <div
                  className="reg-field full"
                  ref={sapEmployeeBoxRef}
                  style={{ position: "relative" }}
                >
                  <label>Employee</label>
                  <input
                    type="text"
                    value={sapEmployeeSearch}
                    onChange={(e) => {
                      setSapEmployeeSearch(e.target.value);
                      setShowSapEmployeeDropdown(true);
                      setSapForm((p) => ({
                        ...p,
                        employee_id: "",
                        employee_no: "",
                        staff_name: "",
                        branch: "",
                        area: "",
                        region: "",
                        division: "",
                        department: "",
                      }));
                    }}
                    onFocus={() => setShowSapEmployeeDropdown(true)}
                    placeholder="Search employee ID or name..."
                    required={!sapForm.employee_id}
                  />

                  {showSapEmployeeDropdown && (
                    <div className="reg-search-dropdown">
                      {filteredSapEmployees.length === 0 ? (
                        <div className="reg-search-empty">No employee found</div>
                      ) : (
                        filteredSapEmployees.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => handleSapEmployeeSelect(s.id)}
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
                  <input value={sapForm.employee_no} readOnly placeholder="Auto-filled" />
                </div>

                <div className="reg-field">
                  <label>Employee Name</label>
                  <input value={sapForm.staff_name} readOnly placeholder="Auto-filled" />
                </div>

                <div className="reg-field">
                  <label>Branch</label>
                  <input value={sapForm.branch} readOnly placeholder="Auto-filled" />
                </div>

                <div className="reg-field">
                  <label>Area</label>
                  <input value={sapForm.area} readOnly placeholder="Auto-filled" />
                </div>

                <div className="reg-field">
                  <label>Region</label>
                  <input value={sapForm.region} readOnly placeholder="Auto-filled" />
                </div>

                <div className="reg-field">
                  <label>Division</label>
                  <input value={sapForm.division} readOnly placeholder="Auto-filled" />
                </div>

                <div className="reg-field full">
                  <label>Department</label>
                  <input value={sapForm.department} readOnly placeholder="Auto-filled" />
                </div>

                <div className="reg-field full">
                  <label>Description</label>
                  <textarea
                    value={sapForm.description}
                    onChange={(e) => setSapForm((p) => ({ ...p, description: e.target.value }))}
                    required
                  />
                </div>

                <div className="reg-field">
                  <label>Amount</label>
                  <input
                    type="number"
                    value={sapForm.amount}
                    onChange={(e) =>
                      setSapForm((p) => ({
                        ...p,
                        amount: e.target.value,
                      }))
                    }
                    required
                  />
                </div>

                <div className="reg-field">
                  <label>Date of Release</label>
                  <input
                    type="date"
                    value={sapForm.release_date}
                    onChange={(e) =>
                      setSapForm((p) => ({
                        ...p,
                        release_date: e.target.value,
                      }))
                    }
                    required
                  />
                </div>

                <div className="reg-field full">
                  <label>File Upload</label>
                  <input
                    type="file"
                    onChange={(e) => setSapAttachment(e.target.files?.[0] || null)}
                  />
                </div>
              </div>

              <div className="reg-modal-actions">
                <button
                  className="reg-btn reg-btn-outline"
                  type="button"
                  onClick={() => setShowCreateSAP(false)}
                >
                  Cancel
                </button>

                <button className="reg-btn reg-btn-primary" type="submit" disabled={creatingSap}>
                  {creatingSap ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewSap && (
        <div
          className="reg-modal-overlay"
          onMouseDown={(e) =>
            e.target.classList.contains("reg-modal-overlay") && setViewSap(null)
          }
        >
          <div className="reg-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="reg-modal-head">
              <div>
                <h3 className="reg-modal-title">Staff Accounts Payable Details</h3>
                <p className="reg-subtitle">{viewSap.staff_name || "-"}</p>
              </div>

              <button className="reg-x" type="button" onClick={() => setViewSap(null)}>
                ✕
              </button>
            </div>

            <div className="reg-form">
              <div className="reg-grid">
                <div className="reg-field">
                  <label>Record ID</label>
                  <input value={viewSap.id ?? "-"} readOnly />
                </div>

                <div className="reg-field">
                  <label>Employee ID</label>
                  <input value={viewSap.employee_no || viewSap.employee_id || "-"} readOnly />
                </div>

                <div className="reg-field">
                  <label>Employee Name</label>
                  <input
                    value={viewSap.staff_name || staffDisplayName(viewSap.employee_id)}
                    readOnly
                  />
                </div>

                <div className="reg-field">
                  <label>Branch</label>
                  <input value={viewSap.branch || viewSap.branch_id || "-"} readOnly />
                </div>

                <div className="reg-field">
                  <label>Area</label>
                  <input value={viewSap.area || "-"} readOnly />
                </div>

                <div className="reg-field">
                  <label>Region</label>
                  <input value={viewSap.region || "-"} readOnly />
                </div>

                <div className="reg-field">
                  <label>Division</label>
                  <input value={viewSap.division || "-"} readOnly />
                </div>

                <div className="reg-field">
                  <label>Department</label>
                  <input value={viewSap.department || "-"} readOnly />
                </div>

                <div className="reg-field full">
                  <label>Description</label>
                  <textarea value={viewSap.description || "-"} readOnly />
                </div>

                <div className="reg-field">
                  <label>Amount</label>
                  <input value={`₱ ${fmtMoney(viewSap.amount)}`} readOnly />
                </div>

                <div className="reg-field">
                  <label>Date Released</label>
                  <input value={fmtDate(viewSap.release_date)} readOnly />
                </div>

                <div className="reg-field">
                  <label>Status</label>
                  <input value={viewSap.status || "Pending"} readOnly />
                </div>

                <div className="reg-field">
                  <label>Created Date</label>
                  <input value={fmtDate(viewSap.created_at)} readOnly />
                </div>

                <div className="reg-field">
                  <label>Approved Date</label>
                  <input value={fmtDate(viewSap.approved_at)} readOnly />
                </div>

                <div className="reg-field">
                  <label>Rejected/Void Date</label>
                  <input value={fmtDate(viewSap.rejected_at)} readOnly />
                </div>

                <div className="reg-field full">
                  <label>Files</label>
                  <div className="reg-row-actions">
                    {viewSap.attachment_path ? (
                      <button
                        className="reg-mini-btn"
                        type="button"
                        onClick={() => downloadSapFile(viewSap, "request")}
                      >
                        Download Request File
                      </button>
                    ) : null}

                    {viewSap.approved_attachment_path ? (
                      <button
                        className="reg-mini-btn"
                        type="button"
                        onClick={() => downloadSapFile(viewSap, "approved")}
                      >
                        Download Approved File
                      </button>
                    ) : null}

                    {!viewSap.attachment_path && !viewSap.approved_attachment_path ? (
                      <span>-</span>
                    ) : null}
                  </div>
                </div>

                {viewSap.rejection_reason ? (
                  <div className="reg-field full">
                    <label>Rejection/Void Reason</label>
                    <textarea value={viewSap.rejection_reason} readOnly />
                  </div>
                ) : null}
              </div>

              <div className="reg-modal-actions">
                <button
                  className="reg-btn reg-btn-outline"
                  type="button"
                  onClick={() => setViewSap(null)}
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