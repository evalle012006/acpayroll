import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "../../api/axiosClient";

const REQUEST_TYPE_OPTIONS = [
  "Transportation Reimbursement",
  "Gas Reimbursement",
  "Maintenance Reimbursement",
  "Food Allocation Reimbursement",
  "Other Reimbursement",
];

const APPROVAL_CHAIN = [
  "area manager",
  "regional manager",
  "assistant vice president",
  "admin",
];

const STAGE_LABELS = {
  "area manager": "Area Manager",
  "regional manager": "Regional Manager",
  "assistant vice president": "Assistant Vice President",
  admin: "Admin",
};

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

const getBaseUrl = () => {
  const base = api.defaults.baseURL || "";
  return base.endsWith("/api") ? base.slice(0, -4) : base;
};

const getChainStatus = (item, role) => {
  if (!item) return "Pending";

  const keyMap = {
    "area manager": item.area_manager_status,
    "regional manager": item.regional_manager_status,
    "assistant vice president": item.assistant_vice_president_status,
    admin: item.admin_status,
  };

  return toStr(keyMap[role] || "Pending") || "Pending";
};

const getCurrentStage = (item) => {
  const explicit = norm(item?.approval_stage);
  if (APPROVAL_CHAIN.includes(explicit)) return explicit;

  for (const role of APPROVAL_CHAIN) {
    const status = norm(getChainStatus(item, role));
    if (status !== "approved") return role;
  }

  return "admin";
};

const canUserActOnReimbursement = (item, role) => {
  const overall = norm(item?.status);
  if (overall === "approved" || overall === "rejected") return false;

  const stage = getCurrentStage(item);
  return role === stage;
};

const renderChainSummary = (item) => {
  return APPROVAL_CHAIN.map((role) => {
    const status = getChainStatus(item, role);
    return `${STAGE_LABELS[role]}: ${status || "Pending"}`;
  }).join(" | ");
};

export default function ReimbursementApprovalTab() {
  const user = useMemo(() => readUser(), []);
  const role = norm(user?.role);
  const baseUrl = useMemo(() => getBaseUrl(), []);

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

  const canViewReimbursement = true;

  const canCreateReimbursement =
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

  const canParticipateInApproval =
    isAdmin || isAreaManager || isRegionalManager || isAssistantVicePresident;

  const [reimbursementRows, setReimbursementRows] = useState([]);
  const [staffList, setStaffList] = useState([]);

  const [showReimbursementModal, setShowReimbursementModal] = useState(false);
  const [showCreateReimbursement, setShowCreateReimbursement] = useState(false);
  const [showReimbursementView, setShowReimbursementView] = useState(false);
  const [selectedReimbursement, setSelectedReimbursement] = useState(null);

  const [loadingReimbursement, setLoadingReimbursement] = useState(false);
  const [creatingReimbursement, setCreatingReimbursement] = useState(false);
  const [processingId, setProcessingId] = useState("");

  const [reimbursementEmployeeSearch, setReimbursementEmployeeSearch] = useState("");
  const [showReimbursementEmployeeDropdown, setShowReimbursementEmployeeDropdown] =
    useState(false);
  const reimbursementEmployeeBoxRef = useRef(null);

  const [reimbursementForm, setReimbursementForm] = useState({
    employee_id: "",
    employee_no: "",
    staff_name: "",
    description: "",
    amount: "",
    request_date: "",
    request_type: "",
    attachment: null,
  });

  const [adminReimbursementDate, setAdminReimbursementDate] = useState("");

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/login";
  }, []);

  const safeGet = useCallback(
    async (url, setLoading) => {
      try {
        setLoading(true);
        const res = await api.get(url);
        return Array.isArray(res.data) ? res.data : [];
      } catch (err) {
        console.error(`GET ${url} failed:`, err?.response?.data || err.message);
        if (err?.response?.status === 401) logout();
        return [];
      } finally {
        setLoading(false);
      }
    },
    [logout]
  );

  const fetchStaff = useCallback(async () => {
    try {
      const res = await api.get("/staff");
      setStaffList(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to fetch staff:", err?.response?.data || err.message);
      if (err?.response?.status === 401) logout();
      setStaffList([]);
    }
  }, [logout]);

  const fetchReimbursement = useCallback(async () => {
    const data = await safeGet("/reimbursement-requests", setLoadingReimbursement);
    setReimbursementRows(data);
  }, [safeGet]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!user || !token) {
      window.location.href = "/login";
      return;
    }

    fetchStaff();
    fetchReimbursement();
  }, [user, fetchStaff, fetchReimbursement]);

  useEffect(() => {
    const isOpen =
      showReimbursementModal || showCreateReimbursement || showReimbursementView;

    if (!isOpen) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        setShowReimbursementModal(false);
        setShowCreateReimbursement(false);
        setShowReimbursementView(false);
        setShowReimbursementEmployeeDropdown(false);
      }
    };

    const onMouseDown = (e) => {
      if (
        reimbursementEmployeeBoxRef.current &&
        !reimbursementEmployeeBoxRef.current.contains(e.target)
      ) {
        setShowReimbursementEmployeeDropdown(false);
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
  }, [showReimbursementModal, showCreateReimbursement, showReimbursementView]);

  const buildStaffDisplay = useCallback((s) => {
    if (!s) return "-";

    const built =
      s.fullname ||
      `${s.last_name || ""}${s.last_name && s.first_name ? ", " : ""}${s.first_name || ""}${
        s.middle_name ? ` ${s.middle_name}` : ""
      }`
        .replace(/\s+/g, " ")
        .trim();

    return built || "-";
  }, []);

  const searchableStaff = useMemo(() => {
    return staffList.map((s) => {
      const display = buildStaffDisplay(s);
      const searchBlob = [
        s.id,
        s.employee_no,
        s.fullname,
        s.first_name,
        s.last_name,
        s.middle_name,
        display,
        s.position,
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
  }, [staffList, buildStaffDisplay]);

  const filteredReimbursementEmployees = useMemo(() => {
    const q = norm(reimbursementEmployeeSearch);
    if (!q) return searchableStaff.slice(0, 20);
    return searchableStaff.filter((s) => s._searchBlob.includes(q)).slice(0, 20);
  }, [searchableStaff, reimbursementEmployeeSearch]);

  const badgeClass = (status) => {
    const s = String(status || "").trim().toLowerCase();
    if (s === "approved") return "badge badge-approved";
    if (s === "rejected") return "badge badge-rejected";
    return "badge badge-pending";
  };

  const handleReimbursementEmployeeSelect = (employeeId) => {
    const emp = staffList.find((s) => String(s.id) === String(employeeId));
    const display = buildStaffDisplay(emp);

    setReimbursementForm((prev) => ({
      ...prev,
      employee_id: String(employeeId || ""),
      employee_no: emp?.employee_no || "",
      staff_name: display || "-",
    }));

    setReimbursementEmployeeSearch(
      emp ? `${emp.employee_no ? `${emp.employee_no} - ` : ""}${display}` : ""
    );
    setShowReimbursementEmployeeDropdown(false);
  };

  const resetReimbursementForm = () => {
    setReimbursementForm({
      employee_id: "",
      employee_no: "",
      staff_name: "",
      description: "",
      amount: "",
      request_date: "",
      request_type: "",
      attachment: null,
    });
    setReimbursementEmployeeSearch("");
    setShowReimbursementEmployeeDropdown(false);
  };

  const handleCreateReimbursement = async (e) => {
    e.preventDefault();

    try {
      setCreatingReimbursement(true);

      const formData = new FormData();
      formData.append("employee_id", reimbursementForm.employee_id);
      formData.append("employee_no", reimbursementForm.employee_no);
      formData.append("staff_name", reimbursementForm.staff_name);
      formData.append("description", reimbursementForm.description);
      formData.append("amount", toNum(reimbursementForm.amount));
      formData.append("request_date", reimbursementForm.request_date || "");
      formData.append("request_type", reimbursementForm.request_type || "");
      formData.append("status", "Pending");
      formData.append("approval_stage", "area manager");

      if (reimbursementForm.attachment) {
        formData.append("attachment", reimbursementForm.attachment);
      }

      await api.post("/reimbursement-requests", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      alert("Reimbursement request submitted successfully.");
      resetReimbursementForm();
      setShowCreateReimbursement(false);
      await fetchReimbursement();
    } catch (err) {
      console.error("Failed to create reimbursement:", err?.response?.data || err.message);
      if (err?.response?.status === 401) return logout();
      if (err?.response?.status === 403) return alert("Access denied.");
      alert(err?.response?.data?.message || "Failed to submit reimbursement request.");
    } finally {
      setCreatingReimbursement(false);
    }
  };

  const updateReimbursementStatus = async (id, action, reimbursementDate = "") => {
    if (!id) {
      alert("Reimbursement record has no valid id.");
      return;
    }

    const ok = window.confirm(
      `Are you sure you want to ${String(action).toLowerCase()} this reimbursement request?`
    );
    if (!ok) return;

    try {
      setProcessingId(`reimbursement-${id}-${action}`);

      const payload = { action };
      if (isAdmin && action === "approve" && reimbursementDate) {
        payload.reimbursement_date = reimbursementDate;
      }

      await api.put(`/reimbursement-requests/${id}`, payload);

      alert(`Reimbursement request ${action === "approve" ? "approved" : "rejected"} successfully.`);
      setAdminReimbursementDate("");
      await fetchReimbursement();
    } catch (err) {
      console.error("Reimbursement update error:", err?.response?.data || err.message);
      if (err?.response?.status === 401) return logout();
      if (err?.response?.status === 403) return alert("Access denied.");
      alert(err?.response?.data?.message || "Failed to update reimbursement request.");
    } finally {
      setProcessingId("");
    }
  };

  const reimbursementPendingCount = useMemo(
    () => reimbursementRows.filter((x) => norm(x.status) === "pending").length,
    [reimbursementRows]
  );

  const openReimbursementView = (item) => {
    setSelectedReimbursement(item);
    setShowReimbursementView(true);
  };

  const closeReimbursementView = () => {
    setSelectedReimbursement(null);
    setShowReimbursementView(false);
  };

  if (!canViewReimbursement) {
    return null;
  }

  return (
    <>
      <div className="approval-grid">
        <div className="approval-card">
          <div className="approval-card-head">
            <div>
              <div className="approval-card-title">Reimbursement Requests</div>
              <div className="approval-card-meta">
                Pending: <span className="pill">{reimbursementPendingCount}</span>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {canCreateReimbursement && (
                <button
                  className="btn-secondary"
                  onClick={() => setShowCreateReimbursement(true)}
                  type="button"
                >
                  + Reimbursement Request
                </button>
              )}
              <button
                className="btn-primary"
                onClick={() => setShowReimbursementModal(true)}
                type="button"
              >
                View
              </button>
            </div>
          </div>

          <div className="approval-card-body">
            <div className="mini">
              {loadingReimbursement
                ? "Loading reimbursement requests..."
                : "Reimbursement requests follow Area Manager → Regional Manager → Assistant Vice President → Admin."}
            </div>
          </div>
        </div>
      </div>

      {canCreateReimbursement && showCreateReimbursement && (
        <div
          className="modal-overlay"
          onMouseDown={(e) =>
            e.target.classList.contains("modal-overlay") && setShowCreateReimbursement(false)
          }
        >
          <div className="modal saas-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h3 className="modal-title">Add Reimbursement Request</h3>
                <p className="modal-subtitle">Submit reimbursement request for approval</p>
              </div>
              <button
                className="modal-x"
                type="button"
                onClick={() => setShowCreateReimbursement(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateReimbursement} className="modal-form">
              <div className="modal-grid">
                <div
                  className="form-group full approval-search-select"
                  ref={reimbursementEmployeeBoxRef}
                >
                  <label>Employee</label>
                  <input
                    type="text"
                    value={reimbursementEmployeeSearch}
                    onChange={(e) => {
                      setReimbursementEmployeeSearch(e.target.value);
                      setShowReimbursementEmployeeDropdown(true);
                      setReimbursementForm((p) => ({
                        ...p,
                        employee_id: "",
                        employee_no: "",
                        staff_name: "",
                      }));
                    }}
                    onFocus={() => setShowReimbursementEmployeeDropdown(true)}
                    placeholder="Search employee no or name..."
                    required={!reimbursementForm.employee_id}
                  />

                  {showReimbursementEmployeeDropdown && (
                    <div className="approval-search-dropdown">
                      {filteredReimbursementEmployees.length === 0 ? (
                        <div className="approval-search-empty">No employee found</div>
                      ) : (
                        filteredReimbursementEmployees.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => handleReimbursementEmployeeSelect(s.id)}
                            className="approval-search-item"
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
                  <input value={reimbursementForm.employee_no} readOnly placeholder="Auto-filled" />
                </div>

                <div className="form-group">
                  <label>Staff Name</label>
                  <input value={reimbursementForm.staff_name} readOnly placeholder="Auto-filled" />
                </div>

                <div className="form-group">
                  <label>Amount</label>
                  <input
                    type="number"
                    value={reimbursementForm.amount}
                    onChange={(e) =>
                      setReimbursementForm((p) => ({ ...p, amount: e.target.value }))
                    }
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Request Date</label>
                  <input
                    type="date"
                    value={reimbursementForm.request_date}
                    onChange={(e) =>
                      setReimbursementForm((p) => ({ ...p, request_date: e.target.value }))
                    }
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Request Type</label>
                  <select
                    value={reimbursementForm.request_type}
                    onChange={(e) =>
                      setReimbursementForm((p) => ({ ...p, request_type: e.target.value }))
                    }
                    required
                  >
                    <option value="">Select Request Type</option>
                    {REQUEST_TYPE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Date of Reimbursement</label>
                  <input
                    type="date"
                    value=""
                    readOnly
                    placeholder="Admin will set after final approval"
                  />
                </div>

                <div className="form-group full">
                  <label>Attach File</label>
                  <input
                    type="file"
                    onChange={(e) =>
                      setReimbursementForm((p) => ({
                        ...p,
                        attachment: e.target.files?.[0] || null,
                      }))
                    }
                  />
                </div>

                <div className="form-group full">
                  <label>Description</label>
                  <textarea
                    value={reimbursementForm.description}
                    onChange={(e) =>
                      setReimbursementForm((p) => ({ ...p, description: e.target.value }))
                    }
                    required
                  />
                </div>
              </div>

              <div className="modal-buttons">
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={() => setShowCreateReimbursement(false)}
                >
                  Cancel
                </button>
                <button className="btn-primary" type="submit" disabled={creatingReimbursement}>
                  {creatingReimbursement ? "Submitting..." : "Submit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showReimbursementModal && (
        <div
          className="modal-overlay"
          onMouseDown={(e) =>
            e.target.classList.contains("modal-overlay") && setShowReimbursementModal(false)
          }
        >
          <div className="modal saas-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h3 className="modal-title">Reimbursement Requests</h3>
                <p className="modal-subtitle">Approve or reject reimbursement requests</p>
              </div>
              <button
                className="modal-x"
                type="button"
                onClick={() => setShowReimbursementModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="table-card">
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Employee</th>
                      <th>Type</th>
                      <th>Description</th>
                      <th>Amount</th>
                      <th>Request Date</th>
                      <th>Reimbursement Date</th>
                      <th>Status</th>
                      <th>Current Stage</th>
                      <th>Approval Chain</th>
                      <th>Attachment</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reimbursementRows.length === 0 ? (
                      <tr>
                        <td colSpan={12} className="empty-state">
                          No reimbursement requests found.
                        </td>
                      </tr>
                    ) : (
                      reimbursementRows.map((item) => {
                        const currentStage = getCurrentStage(item);
                        const canAct =
                          canParticipateInApproval &&
                          canUserActOnReimbursement(item, role);

                        return (
                          <tr key={item.id}>
                            <td>{item.id ?? "-"}</td>
                            <td className="td-strong">
                              {item.staff_name || "-"}
                              <div style={{ fontSize: 12, opacity: 0.75 }}>
                                Emp No: {item.employee_no || "-"}
                              </div>
                            </td>
                            <td>{item.request_type || "-"}</td>
                            <td title={item.description || ""}>{item.description || "-"}</td>
                            <td>₱ {fmtMoney(item.amount)}</td>
                            <td>{fmtDate(item.request_date)}</td>
                            <td>{fmtDate(item.reimbursement_date)}</td>
                            <td>
                              <span className={badgeClass(item.status)}>{item.status}</span>
                            </td>
                            <td>{STAGE_LABELS[currentStage] || "-"}</td>
                            <td style={{ fontSize: 12, lineHeight: 1.5 }}>
                              {renderChainSummary(item)}
                            </td>
                            <td>
                              {item.attachment_path ? (
                                <a
                                  href={`${baseUrl}${item.attachment_path}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="btn-secondary"
                                >
                                  View File
                                </a>
                              ) : (
                                "-"
                              )}
                            </td>
                            <td>
                              <div className="row-actions">
                                <button
                                  className="btn-secondary"
                                  onClick={() => openReimbursementView(item)}
                                  type="button"
                                >
                                  View
                                </button>

                                {canAct ? (
                                  <>
                                    {isAdmin && (
                                      <input
                                        type="date"
                                        value={selectedReimbursement?.id === item.id ? adminReimbursementDate : ""}
                                        onChange={(e) => {
                                          setSelectedReimbursement(item);
                                          setAdminReimbursementDate(e.target.value);
                                        }}
                                        style={{ minWidth: 150 }}
                                      />
                                    )}

                                    <button
                                      className="btn-success"
                                      onClick={() =>
                                        updateReimbursementStatus(
                                          item.id,
                                          "approve",
                                          selectedReimbursement?.id === item.id
                                            ? adminReimbursementDate
                                            : ""
                                        )
                                      }
                                      type="button"
                                      disabled={processingId === `reimbursement-${item.id}-approve`}
                                    >
                                      {processingId === `reimbursement-${item.id}-approve`
                                        ? "Approving..."
                                        : "Approve"}
                                    </button>
                                    <button
                                      className="btn-danger"
                                      onClick={() => updateReimbursementStatus(item.id, "reject")}
                                      type="button"
                                      disabled={processingId === `reimbursement-${item.id}-reject`}
                                    >
                                      {processingId === `reimbursement-${item.id}-reject`
                                        ? "Rejecting..."
                                        : "Reject"}
                                    </button>
                                  </>
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

            <div className="modal-buttons">
              <button
                className="btn-secondary"
                type="button"
                onClick={() => setShowReimbursementModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showReimbursementView && selectedReimbursement && (
        <div
          className="modal-overlay"
          onMouseDown={(e) =>
            e.target.classList.contains("modal-overlay") && closeReimbursementView()
          }
        >
          <div className="modal saas-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h3 className="modal-title">Reimbursement Request Details</h3>
                <p className="modal-subtitle">{selectedReimbursement.staff_name || "-"}</p>
              </div>
              <button className="modal-x" type="button" onClick={closeReimbursementView}>
                ✕
              </button>
            </div>

            <div className="modal-form">
              <div className="modal-grid">
                <div className="form-group">
                  <label>ID</label>
                  <input value={selectedReimbursement.id ?? "-"} readOnly />
                </div>

                <div className="form-group">
                  <label>Employee No</label>
                  <input value={selectedReimbursement.employee_no || "-"} readOnly />
                </div>

                <div className="form-group">
                  <label>Staff Name</label>
                  <input value={selectedReimbursement.staff_name || "-"} readOnly />
                </div>

                <div className="form-group">
                  <label>Request Type</label>
                  <input value={selectedReimbursement.request_type || "-"} readOnly />
                </div>

                <div className="form-group">
                  <label>Amount</label>
                  <input value={`₱ ${fmtMoney(selectedReimbursement.amount)}`} readOnly />
                </div>

                <div className="form-group">
                  <label>Request Date</label>
                  <input value={fmtDate(selectedReimbursement.request_date)} readOnly />
                </div>

                <div className="form-group">
                  <label>Reimbursement Date</label>
                  <input value={fmtDate(selectedReimbursement.reimbursement_date)} readOnly />
                </div>

                <div className="form-group">
                  <label>Status</label>
                  <input value={selectedReimbursement.status || "-"} readOnly />
                </div>

                <div className="form-group">
                  <label>Current Approval Stage</label>
                  <input value={STAGE_LABELS[getCurrentStage(selectedReimbursement)] || "-"} readOnly />
                </div>

                <div className="form-group full">
                  <label>Approval Chain</label>
                  <textarea value={renderChainSummary(selectedReimbursement)} readOnly />
                </div>

                <div className="form-group full">
                  <label>Attachment</label>
                  {selectedReimbursement.attachment_path ? (
                    <a
                      href={`${baseUrl}${selectedReimbursement.attachment_path}`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-secondary"
                      style={{
                        display: "inline-block",
                        textAlign: "center",
                        padding: "10px 12px",
                      }}
                    >
                      View Attached File
                    </a>
                  ) : (
                    <input value="No attachment" readOnly />
                  )}
                </div>

                <div className="form-group full">
                  <label>Description</label>
                  <textarea value={selectedReimbursement.description || "-"} readOnly />
                </div>
              </div>

              <div className="modal-buttons">
                <button className="btn-secondary" type="button" onClick={closeReimbursementView}>
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