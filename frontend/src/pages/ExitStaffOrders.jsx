import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/ExitStaffOrders.css";
import api from "../api/axiosClient";

/* ---------------- Helpers ---------------- */
const toStr = (v) => String(v ?? "").trim();
const norm = (v) => toStr(v).toLowerCase();
const toDate10 = (v) => (v ? String(v).slice(0, 10) : "");
const today10 = () => new Date().toISOString().slice(0, 10);

const toNum = (v) => {
  const s = String(v ?? "").trim();
  if (!s) return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

const money = (v) =>
  toNum(v).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

const readUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
};

const displayNameParts = (s) => {
  const ln = toStr(s?.last_name);
  const fn = toStr(s?.first_name);
  const mn = toStr(s?.middle_name);
  const built = `${ln}${ln && fn ? ", " : ""}${fn}${mn ? ` ${mn}` : ""}`
    .replace(/\s+/g, " ")
    .trim();
  return built || toStr(s?.fullname) || toStr(s?.employee_name) || "-";
};

export default function ExitStaffOrders() {
  const navigate = useNavigate();

  const user = useMemo(() => readUser(), []);
  const userRole = norm(user?.role);

  const canCreate = [
    "admin",
    "hr",
    "accounting",
    "branch manager",
    "assistant vice president",
    "vice president",
    "senior vice president",
    "president",
  ].includes(userRole);

  const canApprove = [
    "admin",
    "hr",
    "accounting",
    "assistant vice president",
    "vice president",
    "senior vice president",
    "president",
  ].includes(userRole);

  const canDelete = ["admin", "hr", "accounting"].includes(userRole);

  const [showCreate, setShowCreate] = useState(false);

  const [staff, setStaff] = useState([]);
  const [branches, setBranches] = useState([]);
  const [orders, setOrders] = useState([]);
  const [balancesByKey, setBalancesByKey] = useState({});

  const [loadingStaff, setLoadingStaff] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingBalances, setLoadingBalances] = useState(false);

  const [saving, setSaving] = useState(false);
  const [approvingId, setApprovingId] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const [employeeSearch, setEmployeeSearch] = useState("");
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);

  const [err, setErr] = useState("");

  const emptyForm = useMemo(
    () => ({
      staff_id: "",
      employee_no: "",
      last_name: "",
      first_name: "",
      middle_name: "",
      prev_branch_id: "",
      prev_branch_code: "",
      prev_branch_name: "",
      exit_type: "",
      date_created: today10(),
      effective_date: "",
      settlement_date: "",
      settlement_branch_id: "",
      remarks: "",
    }),
    []
  );

  const [form, setForm] = useState(emptyForm);

  const filteredStaff = useMemo(() => {
    const q = norm(employeeSearch);
    if (!q) return staff;

    return staff.filter((s) => {
      const name = norm(displayNameParts(s));
      const empNo = norm(s.employee_no);
      const id = String(s.id || "");
      return name.includes(q) || empNo.includes(q) || id.includes(q);
    });
  }, [staff, employeeSearch]);

  const branchMap = useMemo(() => {
    const m = new Map();
    (branches || []).forEach((b) => m.set(String(b.id), b));
    return m;
  }, [branches]);

  const settlementBranchLabel = (id) => {
    if (!id) return "-";
    const b = branchMap.get(String(id));
    return b ? `${b.code || ""} - ${b.name || ""}`.trim() : String(id);
  };

  const closeModal = useCallback(() => {
    setShowCreate(false);
    setErr("");
    setSaving(false);
    setForm(emptyForm);
    setEmployeeSearch("");
    setShowEmployeeDropdown(false);
  }, [emptyForm]);

  const loadStaff = useCallback(async () => {
    try {
      setLoadingStaff(true);
      const res = await api.get("/staff");
      setStaff(Array.isArray(res.data) ? res.data : []);
    } catch {
      setStaff([]);
    } finally {
      setLoadingStaff(false);
    }
  }, []);

  const loadBranches = useCallback(async () => {
    try {
      setLoadingBranches(true);
      const res = await api.get("/branches");
      setBranches(Array.isArray(res.data) ? res.data : []);
    } catch {
      setBranches([]);
    } finally {
      setLoadingBranches(false);
    }
  }, []);

  const loadOrders = useCallback(async () => {
    try {
      setLoadingOrders(true);
      setErr("");
      const res = await api.get("/exit-staff-orders");
      setOrders(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      setOrders([]);
      setErr(e?.response?.data?.message || "Failed to load exit staff orders.");
    } finally {
      setLoadingOrders(false);
    }
  }, []);

  const loadBalances = useCallback(async () => {
    try {
      setLoadingBalances(true);

      const now = new Date();
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

      const res = await api.get("/schedule-balances/live", {
        params: { month },
      });

      const rows = Array.isArray(res.data) ? res.data : [];
      const map = {};

      rows.forEach((r) => {
        if (r?.staff_id != null && String(r.staff_id).trim() !== "") {
          map[`staff:${String(r.staff_id)}`] = r;
        }
        if (r?.employee_no != null && String(r.employee_no).trim() !== "") {
          map[`emp:${String(r.employee_no)}`] = r;
        }
        if (r?.employee_id != null && String(r.employee_id).trim() !== "") {
          map[`empid:${String(r.employee_id)}`] = r;
        }
      });

      setBalancesByKey(map);
    } catch {
      setBalancesByKey({});
    } finally {
      setLoadingBalances(false);
    }
  }, []);

  useEffect(() => {
    loadStaff();
    loadBranches();
    loadOrders();
    loadBalances();
  }, [loadStaff, loadBranches, loadOrders, loadBalances]);

  useEffect(() => {
    if (!showCreate) return;

    const onKey = (e) => {
      if (e.key === "Escape") closeModal();
    };

    const onClickOutside = (e) => {
      const dropdown = document.querySelector(".employee-dropdown");
      const searchInput = document.querySelector(".employee-search-input");
      if (
        dropdown &&
        !dropdown.contains(e.target) &&
        searchInput &&
        !searchInput.contains(e.target)
      ) {
        setShowEmployeeDropdown(false);
      }
    };

    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClickOutside);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClickOutside);
      document.body.style.overflow = "";
    };
  }, [showCreate, closeModal]);

  const selectedStaff = useMemo(() => {
    return staff.find((x) => String(x.id) === String(form.staff_id)) || null;
  }, [staff, form.staff_id]);

  const selectedBalanceRow = useMemo(() => {
    if (!selectedStaff) return null;

    return (
      balancesByKey[`staff:${String(selectedStaff.id)}`] ||
      balancesByKey[`emp:${String(selectedStaff.employee_no)}`] ||
      balancesByKey[`empid:${String(selectedStaff.employee_id)}`] ||
      null
    );
  }, [selectedStaff, balancesByKey]);

  const selectedSavings = useMemo(() => {
    if (!selectedStaff) {
      return {
        cbu: 0,
        cashbond: 0,
        utility: 0,
        totalSavings: 0,
        salaryAdvance: 0,
        specialAdvance: 0,
        cashAdvance: 0,
        motorcycleLoan: 0,
        pagIbigLoan: 0,
        otherReceivable: 0,
        staffAccountsPayable: 0,
        totalBalances: 0,
        netPersonal: 0,
      };
    }

    const bal = selectedBalanceRow || {};

    const cbu = toNum(bal.cbu ?? selectedStaff.cbu);
    const cashbond = toNum(bal.cashbond ?? selectedStaff.cashbond);
    const utility = toNum(
      bal.utility ??
        bal.utility_charge ??
        selectedStaff.utility ??
        selectedStaff.utility_charge
    );

    const salaryAdvance = toNum(
      bal.salary_advance ?? selectedStaff.salary_advance
    );
    const specialAdvance = toNum(
      bal.special_advance ?? selectedStaff.special_advance
    );
    const cashAdvance = toNum(
      bal.cash_advance ?? selectedStaff.cash_advance
    );
    const motorcycleLoan = toNum(
      bal.motorcycle_loan ?? selectedStaff.motorcycle_loan
    );
    const pagIbigLoan = toNum(
      bal.pag_ibig_loan ?? selectedStaff.pag_ibig_loan
    );
    const otherReceivable = toNum(
      bal.other_receivable ?? selectedStaff.other_receivable
    );
    const staffAccountsPayable = toNum(
      bal.staff_accounts_payable ?? selectedStaff.staff_accounts_payable
    );

    const totalSavings = cbu + cashbond + utility;
    const totalBalances =
      salaryAdvance +
      specialAdvance +
      cashAdvance +
      motorcycleLoan +
      pagIbigLoan +
      otherReceivable +
      staffAccountsPayable;

    return {
      cbu,
      cashbond,
      utility,
      totalSavings,
      salaryAdvance,
      specialAdvance,
      cashAdvance,
      motorcycleLoan,
      pagIbigLoan,
      otherReceivable,
      staffAccountsPayable,
      totalBalances,
      netPersonal: totalSavings - totalBalances,
    };
  }, [selectedStaff, selectedBalanceRow]);

  const onSelectEmployee = (id) => {
    const s = staff.find((x) => String(x.id) === String(id));
    const prevBid = s?.branch_id != null ? String(s.branch_id) : "";
    const prevB = prevBid ? branchMap.get(prevBid) : null;

    setForm((p) => ({
      ...p,
      staff_id: String(id),
      employee_no: toStr(s?.employee_no),
      last_name: toStr(s?.last_name),
      first_name: toStr(s?.first_name),
      middle_name: toStr(s?.middle_name),
      prev_branch_id: prevBid,
      prev_branch_code: toStr(prevB?.code),
      prev_branch_name: toStr(prevB?.name),
    }));
  };

  const createOrder = async (e) => {
    e.preventDefault();
    if (saving) return;
    if (!canCreate) return alert("Access denied.");

    setErr("");

    const staffId = Number(form.staff_id);
    if (!staffId) return setErr("Select employee.");
    if (!toStr(form.exit_type)) return setErr("Exit type is required.");
    if (!toStr(form.date_created)) return setErr("Date created is required.");
    if (!toStr(form.effective_date)) return setErr("Effective date is required.");

    const payload = {
      staff_id: staffId,
      employee_no: toStr(form.employee_no),
      employee_name: selectedStaff ? displayNameParts(selectedStaff) : "",
      exit_type: toStr(form.exit_type),
      date_created: toDate10(form.date_created),
      effective_date: toDate10(form.effective_date),
      settlement_date: form.settlement_date ? toDate10(form.settlement_date) : null,
      settlement_branch_id: form.settlement_branch_id
        ? Number(form.settlement_branch_id)
        : null,
      remarks: toStr(form.remarks) || null,
    };

    setSaving(true);
    try {
      await api.post("/exit-staff-orders", payload);
      closeModal();
      await loadOrders();
      alert("Exit staff order created (Pending).");
    } catch (e2) {
      setErr(
        e2?.response?.data?.message ||
          e2?.message ||
          "Failed to create exit staff order."
      );
    } finally {
      setSaving(false);
    }
  };

  const approve = async (o) => {
    if (!canApprove) return alert("Access denied.");
    if (!o?.id) return;

    const ok = window.confirm(
      `Approve Exit Staff Order ${o.order_no || o.id}?\n\nEmployee: ${o.employee_name}`
    );
    if (!ok) return;

    setApprovingId(o.id);
    setErr("");
    try {
      await api.put(`/exit-staff-orders/${o.id}/approve`);
      await loadOrders();
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to approve.");
    } finally {
      setApprovingId(null);
    }
  };

  const reject = async (o) => {
    if (!canApprove) return alert("Access denied.");
    if (!o?.id) return;

    const reason = prompt("Enter rejection reason:");
    if (!reason || !reason.trim()) return;

    setRejectingId(o.id);
    setErr("");
    try {
      await api.put(`/exit-staff-orders/${o.id}/reject`, { reason: reason.trim() });
      await loadOrders();
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to reject.");
    } finally {
      setRejectingId(null);
    }
  };

  const del = async (o) => {
    if (!canDelete) return alert("Access denied.");
    if (!o?.id) return;
    if (String(o.status || "").toLowerCase() === "approved") return;

    const ok = window.confirm(
      `Delete this Exit Staff Order?\n\nOrder: ${o.order_no || o.id}\nEmployee: ${o.employee_name}\nStatus: ${o.status}`
    );
    if (!ok) return;

    setDeletingId(o.id);
    setErr("");
    try {
      await api.delete(`/exit-staff-orders/${o.id}`);
      setOrders((prev) => prev.filter((x) => x.id !== o.id));
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to delete.");
    } finally {
      setDeletingId(null);
    }
  };

  const badgeClass = (status) => {
    const s = String(status || "Pending").toLowerCase();
    if (s === "approved") return "exit-badge exit-approved";
    if (s === "rejected") return "exit-badge exit-rejected";
    return "exit-badge exit-pending";
  };

  const countText = useMemo(() => {
    const n = Array.isArray(orders) ? orders.length : 0;
    return `${n} Record${n === 1 ? "" : "s"}`;
  }, [orders]);

  return (
    <div className="exit-page">
      <div className="exit-topbar">
        <div>
          <h2 className="exit-title">Exit Staff Orders</h2>
          <p className="exit-subtitle">Manage staff resignations, AWOL, and terminations.</p>
        </div>

        <div className="exit-actions">
          <button className="exit-btn exit-btn-ghost" type="button" onClick={() => navigate(-1)}>
            ← Back
          </button>

          <button className="exit-btn exit-btn-outline" type="button" onClick={loadOrders} disabled={loadingOrders}>
            {loadingOrders ? "Refreshing..." : "Refresh"}
          </button>

          <button className="exit-btn exit-btn-outline" type="button" onClick={loadBalances} disabled={loadingBalances}>
            {loadingBalances ? "Refreshing balances..." : "Refresh Balances"}
          </button>

          {canCreate && (
            <button className="exit-btn exit-btn-primary" type="button" onClick={() => setShowCreate(true)}>
              + Create Exit Staff
            </button>
          )}
        </div>
      </div>

      {err ? <div style={{ marginBottom: 12, color: "#ef4444", fontWeight: 900 }}>{err}</div> : null}

      <div className="exit-card">
        <div className="exit-card-head">
          <div className="exit-card-title">Exit Staff Orders</div>
          <div className="exit-card-meta">{countText}</div>
        </div>

        <div className="exit-table-wrap">
          <table className="exit-table">
            <thead>
              <tr>
                <th>ORDER NO</th>
                <th>EMPLOYEE NO</th>
                <th>EMPLOYEE</th>
                <th>PREV BRANCH</th>
                <th>EXIT TYPE</th>
                <th>DATE CREATED</th>
                <th>EFFECTIVE DATE</th>
                <th>SETTLEMENT</th>
                <th>STATUS</th>
                <th style={{ width: 260 }}>ACTIONS</th>
              </tr>
            </thead>

            <tbody>
              {loadingOrders ? (
                <tr>
                  <td colSpan={10} className="exit-empty">
                    Loading exit staff orders...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={10} className="exit-empty">
                    No exit staff orders found.
                  </td>
                </tr>
              ) : (
                orders.map((o) => {
                  const pending = String(o.status || "").toLowerCase() === "pending";
                  const approved = String(o.status || "").toLowerCase() === "approved";
                  const canAct = canApprove && pending;

                  const settlementText =
                    o.settlement_date || o.settlement_branch_name || o.settlement_branch_id
                      ? `${toDate10(o.settlement_date) || "-"} • ${
                          o.settlement_branch_code || o.settlement_branch_name
                            ? `${o.settlement_branch_code || ""} ${o.settlement_branch_name || ""}`.trim()
                            : o.settlement_branch_id || "-"
                        }`
                      : "-";

                  return (
                    <tr key={o.id}>
                      <td className="exit-mono">{o.order_no || "-"}</td>
                      <td className="exit-mono">{o.employee_no}</td>
                      <td className="exit-strong">{o.employee_name || displayNameParts(o)}</td>
                      <td>{`${o.branch_code || "-"} - ${o.branch_name || "-"}`}</td>
                      <td>{o.exit_type || "-"}</td>
                      <td>{toDate10(o.date_created || o.created_at) || "-"}</td>
                      <td>{toDate10(o.effective_date) || "-"}</td>
                      <td title={settlementText}>{settlementText}</td>
                      <td>
                        <span className={badgeClass(o.status)}>{o.status || "Pending"}</span>
                      </td>
                      <td>
                        <div className="po-row-actions">
                          {canAct ? (
                            <>
                              <button
                                className="po-mini-btn po-approve"
                                type="button"
                                onClick={() => approve(o)}
                                disabled={approvingId === o.id}
                              >
                                {approvingId === o.id ? "Approving..." : "Approve"}
                              </button>

                              <button
                                className="po-mini-btn po-reject"
                                type="button"
                                onClick={() => reject(o)}
                                disabled={rejectingId === o.id}
                              >
                                {rejectingId === o.id ? "Rejecting..." : "Reject"}
                              </button>
                            </>
                          ) : (
                            <span className="exit-dash">-</span>
                          )}

                          {canDelete && (
                            <button
                              className="po-mini-btn"
                              type="button"
                              onClick={() => del(o)}
                              disabled={approved || deletingId === o.id}
                              title={approved ? "Approved records cannot be deleted" : "Delete"}
                              style={{
                                marginLeft: 8,
                                opacity: approved || deletingId === o.id ? 0.5 : 1,
                                cursor: approved ? "not-allowed" : "pointer",
                              }}
                            >
                              {deletingId === o.id ? "Deleting..." : "Delete"}
                            </button>
                          )}
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

      {showCreate && canCreate && (
        <div
          className="exit-modal-overlay"
          onMouseDown={(e) => e.target.classList.contains("exit-modal-overlay") && closeModal()}
        >
          <div
            className="exit-modal"
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <div className="exit-modal-head">
              <div>
                <h3 className="exit-modal-title">Create Exit Staff</h3>
                <p className="exit-modal-sub">Order will be Pending until approved.</p>
              </div>
              <button className="exit-x" type="button" onClick={closeModal}>
                ✕
              </button>
            </div>

            {err ? <div style={{ marginBottom: 10, color: "#ef4444", fontWeight: 900 }}>{err}</div> : null}

            <form
              className="exit-form"
              onSubmit={createOrder}
              style={{
                display: "flex",
                flexDirection: "column",
                minHeight: 0,
                flex: 1,
                overflow: "hidden",
              }}
            >
              <div
                className="exit-grid-scroll"
                style={{
                  overflowY: "auto",
                  paddingRight: 8,
                  flex: 1,
                  minHeight: 0,
                }}
              >
                <div className="exit-grid">
                  <div className="exit-field">
                    <label>Employee</label>

                    <input
                      className="employee-search-input"
                      type="text"
                      placeholder={loadingStaff ? "Loading staff..." : "Search employee..."}
                      value={employeeSearch}
                      onChange={(e) => {
                        setEmployeeSearch(e.target.value);
                        setShowEmployeeDropdown(true);
                      }}
                      onFocus={() => setShowEmployeeDropdown(true)}
                    />

                    {showEmployeeDropdown && (
                      <div className="employee-dropdown">
                        {filteredStaff.length === 0 ? (
                          <div className="employee-item empty">No results</div>
                        ) : (
                          filteredStaff.slice(0, 20).map((s) => (
                            <div
                              key={s.id}
                              className="employee-item"
                              onClick={() => {
                                onSelectEmployee(s.id);
                                setEmployeeSearch(`${displayNameParts(s)} (${s.employee_no || s.id})`);
                                setShowEmployeeDropdown(false);
                              }}
                            >
                              {displayNameParts(s)} ({s.employee_no || s.id})
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  <div className="exit-field">
                    <label>Employee No</label>
                    <input value={form.employee_no || ""} readOnly />
                  </div>

                  <div className="exit-field">
                    <label>Last Name</label>
                    <input value={form.last_name} readOnly placeholder="Auto-filled" />
                  </div>

                  <div className="exit-field">
                    <label>First Name</label>
                    <input value={form.first_name} readOnly placeholder="Auto-filled" />
                  </div>

                  <div className="exit-field">
                    <label>Middle Name</label>
                    <input value={form.middle_name} readOnly placeholder="Auto-filled" />
                  </div>

                  <div className="exit-field">
                    <label>Previous Branch</label>
                    <input
                      value={
                        form.prev_branch_code || form.prev_branch_name
                          ? `${form.prev_branch_code || "-"} - ${form.prev_branch_name || "-"}`
                          : loadingBranches
                          ? "Loading branches..."
                          : "Auto-filled"
                      }
                      readOnly
                      placeholder="Auto-filled"
                    />
                  </div>

                  <div className="exit-field">
                    <label>Exit Type</label>
                    <select
                      value={form.exit_type}
                      onChange={(e) => setForm((p) => ({ ...p, exit_type: e.target.value }))}
                      required
                    >
                      <option value="">Select Exit Type</option>
                      <option value="Resigned">Resigned</option>
                      <option value="AWOL">AWOL</option>
                      <option value="Terminated">Terminated</option>
                      <option value="Deceased">Deceased</option>
                    </select>
                  </div>

                  <div className="exit-field">
                    <label>Date Created</label>
                    <input
                      type="date"
                      value={form.date_created}
                      onChange={(e) => setForm((p) => ({ ...p, date_created: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="exit-field">
                    <label>Effective Date</label>
                    <input
                      type="date"
                      value={form.effective_date}
                      onChange={(e) => setForm((p) => ({ ...p, effective_date: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="exit-field">
                    <label>Settlement Date (optional)</label>
                    <input
                      type="date"
                      value={form.settlement_date}
                      onChange={(e) => setForm((p) => ({ ...p, settlement_date: e.target.value }))}
                    />
                  </div>

                  <div className="exit-field">
                    <label>Settlement Branch (optional)</label>
                    <select
                      value={form.settlement_branch_id}
                      onChange={(e) => setForm((p) => ({ ...p, settlement_branch_id: e.target.value }))}
                    >
                      <option value="">Select Branch (optional)</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.code} - {b.name}
                        </option>
                      ))}
                    </select>

                    <div style={{ marginTop: 6, fontSize: 12, opacity: 0.85 }}>
                      Selected: <b>{settlementBranchLabel(form.settlement_branch_id)}</b>
                    </div>
                  </div>

                  <div className="exit-field full">
                    <label>Remarks</label>
                    <textarea
                      rows={3}
                      value={form.remarks}
                      onChange={(e) => setForm((p) => ({ ...p, remarks: e.target.value }))}
                      placeholder="Optional remarks"
                    />
                  </div>

                  {selectedStaff && (
                    <div className="exit-field full" style={{ marginTop: 8 }}>
                      <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 12 }}>
                        <div>
                          Preview: <b>{displayNameParts(selectedStaff)}</b>
                        </div>
                        <div style={{ marginTop: 4 }}>
                          Exit: <b>{form.exit_type || "—"}</b>
                        </div>
                        <div style={{ marginTop: 4 }}>
                          Effective: <b>{form.effective_date || "—"}</b>
                        </div>
                      </div>

                      <div
                        style={{
                          border: "1px solid var(--border)",
                          borderRadius: 12,
                          background: "var(--panel-2)",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            padding: "12px 14px",
                            borderBottom: "1px solid var(--border)",
                            fontWeight: 900,
                            position: "sticky",
                            top: 0,
                            background: "var(--panel-2)",
                            zIndex: 2,
                          }}
                        >
                          Personal Savings & Balances
                        </div>

                        <div
                          style={{
                            maxHeight: 320,
                            overflowY: "auto",
                            padding: "10px 14px",
                            display: "grid",
                            gridTemplateColumns: "1fr auto",
                            rowGap: 8,
                          }}
                        >
                          <div style={{ gridColumn: "1 / -1", fontWeight: 900, marginTop: 4 }}>
                            Personal Savings
                          </div>

                          <div>CBU</div>
                          <div>{money(selectedSavings.cbu)}</div>

                          <div>Cashbond</div>
                          <div>{money(selectedSavings.cashbond)}</div>

                          <div>Utility</div>
                          <div>{money(selectedSavings.utility)}</div>

                          <div style={{ fontWeight: 900, paddingTop: 6 }}>
                            Total Personal Savings
                          </div>
                          <div style={{ fontWeight: 900, paddingTop: 6 }}>
                            {money(selectedSavings.totalSavings)}
                          </div>

                          <div
                            style={{
                              gridColumn: "1 / -1",
                              fontWeight: 900,
                              marginTop: 12,
                              borderTop: "1px solid var(--border)",
                              paddingTop: 10,
                            }}
                          >
                            Personal Balances
                          </div>

                          <div>Salary Advance</div>
                          <div>{money(selectedSavings.salaryAdvance)}</div>

                          <div>Special Advance</div>
                          <div>{money(selectedSavings.specialAdvance)}</div>

                          <div>Cash Advance</div>
                          <div>{money(selectedSavings.cashAdvance)}</div>

                          <div>Motorcycle Loan</div>
                          <div>{money(selectedSavings.motorcycleLoan)}</div>

                          <div>Pag-ibig Loan</div>
                          <div>{money(selectedSavings.pagIbigLoan)}</div>

                          <div>Other Receivable</div>
                          <div>{money(selectedSavings.otherReceivable)}</div>

                          <div>Staff Accounts Payable</div>
                          <div>{money(selectedSavings.staffAccountsPayable)}</div>

                          <div style={{ fontWeight: 900, paddingTop: 6 }}>
                            Total Personal Balance
                          </div>
                          <div style={{ fontWeight: 900, paddingTop: 6 }}>
                            {money(selectedSavings.totalBalances)}
                          </div>

                          <div
                            style={{
                              gridColumn: "1 / -1",
                              borderTop: "1px solid var(--border)",
                              marginTop: 12,
                              paddingTop: 10,
                              fontWeight: 900,
                              display: "grid",
                              gridTemplateColumns: "1fr auto",
                            }}
                          >
                            <div>Total Savings less Balances</div>
                            <div>{money(selectedSavings.netPersonal)}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="exit-modal-actions">
                <button className="exit-btn exit-btn-ghost" type="button" onClick={closeModal} disabled={saving}>
                  Cancel
                </button>
                <button className="exit-btn exit-btn-primary" type="submit" disabled={saving}>
                  {saving ? "Creating..." : "Create Order"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}