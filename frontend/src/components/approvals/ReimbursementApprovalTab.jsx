import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "../../api/axiosClient";

const REQUEST_TYPE_OPTIONS = [
  "Transportation Reimbursement",
  "Gas Reimbursement",
  "Maintenance Reimbursement",
  "Food Allocation Reimbursement",
  "Other Reimbursement",
];

const DEFAULT_CHAIN = [
  "branch manager",
  "area manager",
  "regional manager",
  "assistant vice president",
  "vice president",
  "senior vice president",
];

const STAGE_LABELS = {
  "branch manager": "Branch Manager",
  "area manager": "Area Manager",
  "regional manager": "Regional Manager",
  "assistant vice president": "Assistant Vice President",
  "vice president": "Vice President",
  "senior vice president": "Senior Vice President",
  approved: "Approved",
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

const parseChain = (item) => {
  try {
    if (Array.isArray(item?.approval_chain)) {
      return item.approval_chain.map(norm).filter(Boolean);
    }

    if (item?.approval_chain) {
      const parsed = JSON.parse(item.approval_chain);
      if (Array.isArray(parsed)) return parsed.map(norm).filter(Boolean);
    }
  } catch {}

  return DEFAULT_CHAIN;
};

const getChainStatus = (item, role) => {
  const keyMap = {
    "branch manager": item?.branch_manager_status,
    "area manager": item?.area_manager_status,
    "regional manager": item?.regional_manager_status,
    "assistant vice president": item?.assistant_vice_president_status,
    "vice president": item?.vice_president_status,
    "senior vice president": item?.senior_vice_president_status,
  };

  return toStr(keyMap[role] || "Pending") || "Pending";
};

const getCurrentStage = (item) => {
  const explicit = norm(item?.approval_stage);
  const chain = parseChain(item);

  if (explicit === "approved") return "approved";
  if (chain.includes(explicit)) return explicit;

  for (const role of chain) {
    if (norm(getChainStatus(item, role)) !== "approved") return role;
  }

  return chain[chain.length - 1] || "branch manager";
};

const canBypass = (role) => ["admin", "it"].includes(norm(role));

const canUserActOnReimbursement = (item, role) => {
  const overall = norm(item?.status);
  if (overall === "approved" || overall === "rejected") return false;

  if (canBypass(role)) return true;

  return norm(role) === getCurrentStage(item);
};

const renderChainSummary = (item) => {
  const chain = parseChain(item);

  return chain
    .map((role) => {
      const status = getChainStatus(item, role);
      return `${STAGE_LABELS[role] || role}: ${status || "Pending"}`;
    })
    .join(" | ");
};

export default function ReimbursementApprovalTab() {
  const user = useMemo(() => readUser(), []);
  const role = norm(user?.role);

  const isAdmin = role === "admin";
  const isIt = role === "it";
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

  const canCreateReimbursement =
    isAdmin ||
    isIt ||
    isHr ||
    isAccounting ||
    isTread ||
    isAreaManager ||
    isRegionalManager ||
    isAssistantVicePresident ||
    isVicePresident ||
    isSeniorVicePresident;

  const canParticipateInApproval =
    isAdmin ||
    isIt ||
    isBranchManager ||
    isAreaManager ||
    isRegionalManager ||
    isAssistantVicePresident ||
    isVicePresident ||
    isSeniorVicePresident;

  const [reimbursementRows, setReimbursementRows] = useState([]);
  const [staffList, setStaffList] = useState([]);

  const [showReimbursementModal, setShowReimbursementModal] = useState(false);
  const [showCreateReimbursement, setShowCreateReimbursement] = useState(false);
  const [showReimbursementView, setShowReimbursementView] = useState(false);
  const [selectedReimbursement, setSelectedReimbursement] = useState(null);

  const [loadingReimbursement, setLoadingReimbursement] = useState(false);
  const [creatingReimbursement, setCreatingReimbursement] = useState(false);
  const [processingId, setProcessingId] = useState("");

  const [approvalFiles, setApprovalFiles] = useState({});
  const [selectedApprovalFile, setSelectedApprovalFile] = useState(null);

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
      `${s.last_name || ""}${s.last_name && s.first_name ? ", " : ""}${
        s.first_name || ""
      }${s.middle_name ? ` ${s.middle_name}` : ""}`
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
        s.area,
        s.region,
        s.division,
        s.branch_code,
        s.branch_name,
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
    const s = norm(status);
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

    if (!reimbursementForm.employee_id) return alert("Please select employee.");
    if (!reimbursementForm.attachment) return alert("Please attach reimbursement file.");

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
      formData.append("attachment", reimbursementForm.attachment);

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

  const downloadLatestFile = async (id, fallbackName = "") => {
    try {
      const res = await api.get(`/reimbursement-requests/${id}/download/latest`, {
        responseType: "blob",
      });

      const blob = new Blob([res.data]);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");

      a.href = url;
      a.download = fallbackName || `reimbursement-${id}`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to download file.");
    }
  };

  const updateReimbursementStatus = async (item, action, reimbursementDate = "") => {
    const id = item?.id;

    if (!id) return alert("Reimbursement record has no valid id.");

    if (action === "approve" && !approvalFiles[id]) {
      return alert("Please upload the signed reimbursement file before approving.");
    }

    const ok = window.confirm(
      action === "approve"
        ? "Approve and submit the uploaded signed file to the next approver?"
        : "Reject this reimbursement request?"
    );

    if (!ok) return;

    try {
      setProcessingId(`reimbursement-${id}-${action}`);

      const formData = new FormData();
      formData.append("action", action);

      if (action === "approve") {
        formData.append("attachment", approvalFiles[id]);
      }

      if ((isAdmin || isIt) && action === "approve" && reimbursementDate) {
        formData.append("reimbursement_date", reimbursementDate);
      }

      await api.put(`/reimbursement-requests/${id}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      alert(
        action === "approve"
          ? "Reimbursement approved and signed file uploaded."
          : "Reimbursement rejected successfully."
      );

      setApprovalFiles((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });

      setSelectedApprovalFile(null);
      setAdminReimbursementDate("");

      if (selectedReimbursement?.id === id) {
        setSelectedReimbursement(null);
        setShowReimbursementView(false);
      }

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
    setSelectedApprovalFile(null);
    setShowReimbursementView(true);
  };

  const closeReimbursementView = () => {
    setSelectedReimbursement(null);
    setSelectedApprovalFile(null);
    setShowReimbursementView(false);
  };

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
                : "Approvers must download latest file, upload signed file, then approve."}
            </div>
          </div>
        </div>
      </div>

      {canCreateReimbursement && showCreateReimbursement && (
        <div
          className="modal-overlay"
          onMouseDown={(e) =>
            e.target.classList.contains("modal-overlay") &&
            setShowCreateReimbursement(false)
          }
        >
          <div className="modal saas-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h3 className="modal-title">Add Reimbursement Request</h3>
                <p className="modal-subtitle">
                  Upload the initial reimbursement file for approval.
                </p>
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
                  <input
                    value={reimbursementForm.employee_no}
                    readOnly
                    placeholder="Auto-filled"
                  />
                </div>

                <div className="form-group">
                  <label>Staff Name</label>
                  <input
                    value={reimbursementForm.staff_name}
                    readOnly
                    placeholder="Auto-filled"
                  />
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
                      setReimbursementForm((p) => ({
                        ...p,
                        request_date: e.target.value,
                      }))
                    }
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Request Type</label>
                  <select
                    value={reimbursementForm.request_type}
                    onChange={(e) =>
                      setReimbursementForm((p) => ({
                        ...p,
                        request_type: e.target.value,
                      }))
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

                <div className="form-group full">
                  <label>Initial Reimbursement File</label>
                  <input
                    type="file"
                    required
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
                      setReimbursementForm((p) => ({
                        ...p,
                        description: e.target.value,
                      }))
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

                <button
                  className="btn-primary"
                  type="submit"
                  disabled={creatingReimbursement}
                >
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
            e.target.classList.contains("modal-overlay") &&
            setShowReimbursementModal(false)
          }
        >
          <div className="modal saas-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h3 className="modal-title">Reimbursement Requests</h3>
                <p className="modal-subtitle">
                  Download latest file, upload signed file, then approve.
                </p>
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
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Current Stage</th>
                      <th>Latest File</th>
                      <th>Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {reimbursementRows.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="empty-state">
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
                            <td>₱ {fmtMoney(item.amount)}</td>

                            <td>
                              <span className={badgeClass(item.status)}>
                                {item.status || "Pending"}
                              </span>
                            </td>

                            <td>{STAGE_LABELS[currentStage] || "-"}</td>

                            <td>
                              {item.attachment_path ? (
                                <button
                                  className="btn-secondary"
                                  type="button"
                                  onClick={() =>
                                    downloadLatestFile(
                                      item.id,
                                      item.attachment_name || ""
                                    )
                                  }
                                >
                                  Download Latest
                                </button>
                              ) : (
                                "-"
                              )}
                            </td>

                            <td>
                              <div className="row-actions loan-row-actions">
                                <button
                                  className="btn-secondary"
                                  onClick={() => openReimbursementView(item)}
                                  type="button"
                                >
                                  View
                                </button>

                                {canAct ? (
                                  <>
                                    <label className="loan-upload-pill">
                                      <input
                                        type="file"
                                        hidden
                                        onChange={(e) =>
                                          setApprovalFiles((prev) => ({
                                            ...prev,
                                            [item.id]: e.target.files?.[0] || null,
                                          }))
                                        }
                                      />
                                      📎{" "}
                                      {approvalFiles[item.id]?.name
                                        ? "Change File"
                                        : "Upload File"}
                                    </label>

                                    {approvalFiles[item.id]?.name ? (
                                      <span
                                        className="loan-file-name"
                                        title={approvalFiles[item.id].name}
                                      >
                                        {approvalFiles[item.id].name}
                                      </span>
                                    ) : null}

                                    <button
                                      className="btn-success"
                                      onClick={() =>
                                        updateReimbursementStatus(item, "approve")
                                      }
                                      type="button"
                                      disabled={
                                        processingId ===
                                        `reimbursement-${item.id}-approve`
                                      }
                                    >
                                      {processingId ===
                                      `reimbursement-${item.id}-approve`
                                        ? "Approving..."
                                        : "Upload + Approve"}
                                    </button>

                                    <button
                                      className="btn-danger"
                                      onClick={() =>
                                        updateReimbursementStatus(item, "reject")
                                      }
                                      type="button"
                                      disabled={
                                        processingId ===
                                        `reimbursement-${item.id}-reject`
                                      }
                                    >
                                      {processingId ===
                                      `reimbursement-${item.id}-reject`
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
                <p className="modal-subtitle">
                  {selectedReimbursement.staff_name || "-"}
                </p>
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
                  <input
                    value={fmtDate(selectedReimbursement.reimbursement_date)}
                    readOnly
                  />
                </div>

                <div className="form-group">
                  <label>Status</label>
                  <input value={selectedReimbursement.status || "-"} readOnly />
                </div>

                <div className="form-group">
                  <label>Current Approval Stage</label>
                  <input
                    value={
                      STAGE_LABELS[getCurrentStage(selectedReimbursement)] || "-"
                    }
                    readOnly
                  />
                </div>

                <div className="form-group full">
                  <label>Approval Chain</label>
                  <textarea value={renderChainSummary(selectedReimbursement)} readOnly />
                </div>

                <div className="form-group full">
                  <label>Latest File</label>
                  {selectedReimbursement.attachment_path ? (
                    <button
                      className="btn-secondary"
                      type="button"
                      onClick={() =>
                        downloadLatestFile(
                          selectedReimbursement.id,
                          selectedReimbursement.attachment_name || ""
                        )
                      }
                    >
                      Download Latest File
                    </button>
                  ) : (
                    <input value="No attachment" readOnly />
                  )}
                </div>

                {canParticipateInApproval &&
                canUserActOnReimbursement(selectedReimbursement, role) ? (
                  <div className="form-group full">
                    <label>Upload Signed File Before Approving</label>

                    <label className="loan-upload-pill" style={{ width: "fit-content" }}>
                      <input
                        type="file"
                        hidden
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          setSelectedApprovalFile(file);
                          setApprovalFiles((prev) => ({
                            ...prev,
                            [selectedReimbursement.id]: file,
                          }));
                        }}
                      />
                      📎 {selectedApprovalFile?.name ? "Change File" : "Upload File"}
                    </label>

                    {selectedApprovalFile?.name ? (
                      <span
                        className="loan-file-name"
                        title={selectedApprovalFile.name}
                      >
                        {selectedApprovalFile.name}
                      </span>
                    ) : null}
                  </div>
                ) : null}

                <div className="form-group full">
                  <label>Description</label>
                  <textarea value={selectedReimbursement.description || "-"} readOnly />
                </div>
              </div>

              <div className="modal-buttons">
                {canParticipateInApproval &&
                canUserActOnReimbursement(selectedReimbursement, role) ? (
                  <>
                    {(isAdmin || isIt) && (
                      <input
                        type="date"
                        value={adminReimbursementDate}
                        onChange={(e) => setAdminReimbursementDate(e.target.value)}
                      />
                    )}

                    <button
                      className="btn-success"
                      type="button"
                      disabled={
                        processingId ===
                        `reimbursement-${selectedReimbursement.id}-approve`
                      }
                      onClick={() =>
                        updateReimbursementStatus(
                          selectedReimbursement,
                          "approve",
                          adminReimbursementDate
                        )
                      }
                    >
                      {processingId ===
                      `reimbursement-${selectedReimbursement.id}-approve`
                        ? "Approving..."
                        : "Upload + Approve"}
                    </button>

                    <button
                      className="btn-danger"
                      type="button"
                      disabled={
                        processingId ===
                        `reimbursement-${selectedReimbursement.id}-reject`
                      }
                      onClick={() =>
                        updateReimbursementStatus(selectedReimbursement, "reject")
                      }
                    >
                      {processingId ===
                      `reimbursement-${selectedReimbursement.id}-reject`
                        ? "Rejecting..."
                        : "Reject"}
                    </button>
                  </>
                ) : null}

                <button
                  className="btn-secondary"
                  type="button"
                  onClick={closeReimbursementView}
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