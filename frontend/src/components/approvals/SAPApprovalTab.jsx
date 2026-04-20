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

export default function SAPApprovalTab() {
  const user = useMemo(() => readUser(), []);
  const role = norm(user?.role);

  const isAdmin = role === "admin";
  const isAreaManager = role === "area manager";
  const isBranchManager = role === "branch manager";
  const isRegionalManager = role === "regional manager";
  const isAssistantVicePresident = role === "assistant vice president";

  const canViewSAP = !(isAreaManager || isRegionalManager || isAssistantVicePresident);
  const canCreateSAP = (isAdmin || isBranchManager) && !isAssistantVicePresident;

  const [sapRows, setSapRows] = useState([]);
  const [staffList, setStaffList] = useState([]);

  const [showSapModal, setShowSapModal] = useState(false);
  const [showCreateSAP, setShowCreateSAP] = useState(false);

  const [loadingSap, setLoadingSap] = useState(false);
  const [creatingSap, setCreatingSap] = useState(false);
  const [processingId, setProcessingId] = useState("");

  const [sapEmployeeSearch, setSapEmployeeSearch] = useState("");
  const [showSapEmployeeDropdown, setShowSapEmployeeDropdown] = useState(false);
  const sapEmployeeBoxRef = useRef(null);

  const [sapForm, setSapForm] = useState({
    employee_id: "",
    employee_no: "",
    staff_name: "",
    description: "",
    amount: "",
    term: "",
    balance: "",
  });

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

  const fetchSap = useCallback(async () => {
    const data = await safeGet("/staff-accounts-payable", setLoadingSap);
    setSapRows(data);
  }, [safeGet]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!user || !token) {
      window.location.href = "/login";
      return;
    }

    fetchStaff();

    if (canViewSAP) {
      fetchSap();
    } else {
      setSapRows([]);
    }
  }, [user, canViewSAP, fetchStaff, fetchSap]);

  useEffect(() => {
    const isOpen = showSapModal || showCreateSAP;
    if (!isOpen) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        setShowSapModal(false);
        setShowCreateSAP(false);
        setShowSapEmployeeDropdown(false);
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
  }, [showSapModal, showCreateSAP]);

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

  const staffMap = useMemo(() => {
    const m = new Map();
    staffList.forEach((s) => m.set(String(s.id), s));
    return m;
  }, [staffList]);

  const staffDisplayName = useCallback(
    (staffId) => {
      const s = staffMap.get(String(staffId));
      return buildStaffDisplay(s);
    },
    [staffMap, buildStaffDisplay]
  );

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

  const filteredSapEmployees = useMemo(() => {
    const q = norm(sapEmployeeSearch);
    if (!q) return searchableStaff.slice(0, 20);
    return searchableStaff.filter((s) => s._searchBlob.includes(q)).slice(0, 20);
  }, [searchableStaff, sapEmployeeSearch]);

  const badgeClass = (status) => {
    const s = String(status || "").trim();
    if (s === "Approved") return "badge badge-approved";
    if (s === "Rejected") return "badge badge-rejected";
    return "badge badge-pending";
  };

  const sapPreview = useMemo(() => {
    const amount = toNum(sapForm.amount);
    const term = Math.max(1, toNum(sapForm.term));
    const per_month = term ? amount / term : 0;
    return { per_month };
  }, [sapForm.amount, sapForm.term]);

  const handleSapEmployeeSelect = (employeeId) => {
    const emp = staffList.find((s) => String(s.id) === String(employeeId));
    const display = buildStaffDisplay(emp);

    setSapForm((prev) => ({
      ...prev,
      employee_id: String(employeeId || ""),
      employee_no: emp?.employee_no || "",
      staff_name: display || "-",
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
      description: "",
      amount: "",
      term: "",
      balance: "",
    });
    setSapEmployeeSearch("");
    setShowSapEmployeeDropdown(false);
  };

  const handleCreateSAP = async (e) => {
    e.preventDefault();

    const amount = toNum(sapForm.amount);
    const term = Math.max(1, toNum(sapForm.term));
    const per_month = term ? amount / term : 0;
    const balance =
      sapForm.balance === "" || sapForm.balance == null ? amount : toNum(sapForm.balance);

    try {
      setCreatingSap(true);

      await api.post("/staff-accounts-payable", {
        employee_no: sapForm.employee_no,
        staff_name: sapForm.staff_name,
        description: sapForm.description,
        amount,
        term,
        per_month,
        balance,
      });

      alert("Staff Accounts Payable added successfully.");
      resetSapForm();
      setShowCreateSAP(false);
      await fetchSap();
    } catch (err) {
      console.error("Failed to create SAP:", err?.response?.data || err.message);
      if (err?.response?.status === 401) return logout();
      alert(err?.response?.data?.message || "Failed to add Staff Accounts Payable.");
    } finally {
      setCreatingSap(false);
    }
  };

  const updateSapStatus = async (id, status, reason = "") => {
    if (!id) {
      alert("SAP record has no valid id.");
      return;
    }

    const ok = window.confirm(
      `Are you sure you want to ${String(status).toLowerCase()} this SAP record?`
    );
    if (!ok) return;

    try {
      setProcessingId(`sap-${id}-${status}`);
      await api.put(`/staff-accounts-payable/${id}`, { status, reason });
      alert(`SAP ${status.toLowerCase()} successfully.`);
      await fetchSap();
    } catch (err) {
      console.error("SAP update error:", err?.response?.data || err.message);
      if (err?.response?.status === 401) return logout();
      if (err?.response?.status === 403) return alert("Access denied.");
      alert(err?.response?.data?.message || "Failed to update SAP.");
    } finally {
      setProcessingId("");
    }
  };

  const sapPendingCount = useMemo(
    () => sapRows.filter((x) => x.status === "Pending").length,
    [sapRows]
  );

  if (!canViewSAP) {
    return (
      <div className="approval-grid">
        <div className="approval-card">
          <div className="approval-card-body">
            <div className="mini">Access denied for Staff Accounts Payable.</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="approval-grid">
        <div className="approval-card">
          <div className="approval-card-head">
            <div>
              <div className="approval-card-title">Staff Accounts Payable</div>
              <div className="approval-card-meta">
                Pending: <span className="pill">{sapPendingCount}</span>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {canCreateSAP && (
                <button
                  className="btn-secondary"
                  onClick={() => setShowCreateSAP(true)}
                  type="button"
                >
                  + Staff Accounts Payable
                </button>
              )}
              <button className="btn-primary" onClick={() => setShowSapModal(true)} type="button">
                View
              </button>
            </div>
          </div>

          <div className="approval-card-body">
            <div className="mini">
              {loadingSap ? "Loading SAP..." : "Create payable records and approve/reject them."}
            </div>
          </div>
        </div>
      </div>

      {canCreateSAP && showCreateSAP && (
        <div
          className="modal-overlay"
          onMouseDown={(e) =>
            e.target.classList.contains("modal-overlay") && setShowCreateSAP(false)
          }
        >
          <div className="modal saas-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h3 className="modal-title">Add Staff Accounts Payable</h3>
                <p className="modal-subtitle">Creates a payable record for the employee</p>
              </div>
              <button className="modal-x" type="button" onClick={() => setShowCreateSAP(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSAP} className="modal-form">
              <div className="modal-grid">
                <div className="form-group full approval-search-select" ref={sapEmployeeBoxRef}>
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
                      }));
                    }}
                    onFocus={() => setShowSapEmployeeDropdown(true)}
                    placeholder="Search employee no or name..."
                    required={!sapForm.employee_id}
                  />

                  {showSapEmployeeDropdown && (
                    <div className="approval-search-dropdown">
                      {filteredSapEmployees.length === 0 ? (
                        <div className="approval-search-empty">No employee found</div>
                      ) : (
                        filteredSapEmployees.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => handleSapEmployeeSelect(s.id)}
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
                  <input value={sapForm.employee_no} readOnly placeholder="Auto-filled" />
                </div>

                <div className="form-group">
                  <label>Staff Name</label>
                  <input value={sapForm.staff_name} readOnly placeholder="Auto-filled" />
                </div>

                <div className="form-group full">
                  <label>Description</label>
                  <textarea
                    value={sapForm.description}
                    onChange={(e) => setSapForm((p) => ({ ...p, description: e.target.value }))}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Total Amount</label>
                  <input
                    type="number"
                    value={sapForm.amount}
                    onChange={(e) =>
                      setSapForm((p) => ({
                        ...p,
                        amount: e.target.value,
                        balance:
                          p.balance === "" || String(p.balance) === String(p.amount)
                            ? e.target.value
                            : p.balance,
                      }))
                    }
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Term (Months)</label>
                  <input
                    type="number"
                    value={sapForm.term}
                    onChange={(e) => setSapForm((p) => ({ ...p, term: e.target.value }))}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Balance</label>
                  <input
                    type="number"
                    value={sapForm.balance}
                    onChange={(e) => setSapForm((p) => ({ ...p, balance: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="preview-box">
                <div>
                  <span>Per Month</span>
                  <strong>₱ {sapPreview.per_month.toFixed(2)}</strong>
                </div>
              </div>

              <div className="modal-buttons">
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={() => setShowCreateSAP(false)}
                >
                  Cancel
                </button>
                <button className="btn-primary" type="submit" disabled={creatingSap}>
                  {creatingSap ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showSapModal && (
        <div
          className="modal-overlay"
          onMouseDown={(e) => e.target.classList.contains("modal-overlay") && setShowSapModal(false)}
        >
          <div className="modal saas-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h3 className="modal-title">Staff Accounts Payable</h3>
                <p className="modal-subtitle">Approve/Reject is Admin only</p>
              </div>
              <button className="modal-x" type="button" onClick={() => setShowSapModal(false)}>
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
                      <th>Description</th>
                      <th>Amount</th>
                      <th>Term</th>
                      <th>Per Month</th>
                      <th>Balance</th>
                      <th>Status</th>
                      <th>Dates</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sapRows.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="empty-state">
                          No SAP records found.
                        </td>
                      </tr>
                    ) : (
                      sapRows.map((x) => (
                        <tr key={x.id ?? `${x.employee_id}-${x.description}`}>
                          <td>{x.id ?? "-"}</td>
                          <td className="td-strong">
                            {x.staff_name || staffDisplayName(x.employee_id)}
                            <div style={{ fontSize: 12, opacity: 0.8 }}>
                              Employee ID: {x.employee_id || "-"} • Employee No: {x.employee_no || "-"}
                            </div>
                          </td>
                          <td title={x.description || ""}>{x.description || "-"}</td>
                          <td>₱ {fmtMoney(x.amount)}</td>
                          <td>{x.term}</td>
                          <td>₱ {fmtMoney(x.per_month)}</td>
                          <td>₱ {fmtMoney(x.balance)}</td>
                          <td>
                            <span className={badgeClass(x.status)}>{x.status}</span>
                          </td>
                          <td style={{ fontSize: 12, opacity: 0.85 }}>
                            <div>Approved: {fmtDate(x.approved_at)}</div>
                            <div>Rejected: {fmtDate(x.rejected_at)}</div>
                          </td>
                          <td>
                            {x.status === "Pending" ? (
                              isAdmin ? (
                                <div className="row-actions">
                                  <button
                                    className="btn-success"
                                    onClick={() => updateSapStatus(x.id, "Approved")}
                                    type="button"
                                    disabled={processingId === `sap-${x.id}-Approved`}
                                  >
                                    {processingId === `sap-${x.id}-Approved`
                                      ? "Approving..."
                                      : "Approve"}
                                  </button>
                                  <button
                                    className="btn-danger"
                                    onClick={() => {
                                      const reason = window.prompt("Reason for rejection?");
                                      if (!reason || !String(reason).trim()) {
                                        alert("Rejection reason is required.");
                                        return;
                                      }
                                      updateSapStatus(x.id, "Rejected", String(reason).trim());
                                    }}
                                    type="button"
                                    disabled={processingId === `sap-${x.id}-Rejected`}
                                  >
                                    {processingId === `sap-${x.id}-Rejected`
                                      ? "Rejecting..."
                                      : "Reject"}
                                  </button>
                                </div>
                              ) : (
                                "-"
                              )
                            ) : (
                              "-"
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="modal-buttons">
              <button className="btn-secondary" type="button" onClick={() => setShowSapModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}