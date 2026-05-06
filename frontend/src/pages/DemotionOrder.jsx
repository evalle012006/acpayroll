import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axiosClient";
import "../styles/DemotionOrder.css";

const clean = (v) => String(v ?? "").trim();
const toDate10 = (v) => (v ? String(v).slice(0, 10) : "");

const displayNameParts = (s) => {
  const ln = clean(s?.last_name);
  const fn = clean(s?.first_name);
  const mn = clean(s?.middle_name);
  const built = `${ln}${ln && fn ? ", " : ""}${fn}${mn ? ` ${mn}` : ""}`
    .replace(/\s+/g, " ")
    .trim();
  return built || clean(s?.fullname) || "-";
};

export default function DemotionOrder() {
  const navigate = useNavigate();
  const employeeBoxRef = useRef(null);

  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  }, []);

  const role = String(user?.role || "").trim().toLowerCase();
  const isAdmin = role === "admin";
  const isHr = role === "hr";
  const isAccounting = role === "accounting";
  const isAssistantVicePresident = role === "assistant vice president";

  const canCreate =
    isAdmin ||
    role === "branch manager" ||
    role === "area manager" ||
    role === "regional manager" ||
    isAssistantVicePresident;

  const canApprove = isAdmin || isHr || isAccounting;

  const [orders, setOrders] = useState([]);
  const [staff, setStaff] = useState([]);
  const [branches, setBranches] = useState([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const [showModal, setShowModal] = useState(false);

  const [rejecting, setRejecting] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectSaving, setRejectSaving] = useState(false);

  const [employeeSearch, setEmployeeSearch] = useState("");
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);

  const emptyForm = useMemo(
    () => ({
      employee_id: "",
      first_name: "",
      last_name: "",
      middle_name: "",
      prev_position: "",
      new_position: "",
      prev_branch_id: "",
      to_branch_id: "",
      effective_date: "",
      details: "",
    }),
    []
  );

  const [form, setForm] = useState(emptyForm);

  const branchMap = useMemo(() => {
    const m = new Map();
    (branches || []).forEach((b) => m.set(String(b.id), b));
    return m;
  }, [branches]);

  const filteredStaff = useMemo(() => {
    const q = employeeSearch.toLowerCase();

    if (!q) return staff.slice(0, 20);

    return staff.filter((s) => {
      const haystack = [
        s.id,
        s.employee_no,
        s.fullname,
        s.first_name,
        s.middle_name,
        s.last_name,
        displayNameParts(s),
        s.position,
      ]
        .map((x) => clean(x).toLowerCase())
        .join(" ");

      return haystack.includes(q);
    });
  }, [employeeSearch, staff]);

  const badgeClass = (status) => {
    const s = String(status || "Pending").toLowerCase();
    if (s === "approved") return "po-badge po-approved";
    if (s === "rejected") return "po-badge po-rejected";
    return "po-badge po-pending";
  };

  const loadData = async () => {
    setLoading(true);
    setErr("");
    try {
      const [oRes, sRes, bRes] = await Promise.all([
        api.get("/demotion-orders"),
        api.get("/staff"),
        api.get("/branches"),
      ]);
      setOrders(Array.isArray(oRes.data) ? oRes.data : []);
      setStaff(Array.isArray(sRes.data) ? sRes.data : []);
      setBranches(Array.isArray(bRes.data) ? bRes.data : []);
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to load demotion orders.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!showModal) return;

    const onMouseDown = (e) => {
      if (employeeBoxRef.current && !employeeBoxRef.current.contains(e.target)) {
        setShowEmployeeDropdown(false);
      }
    };

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        setShowEmployeeDropdown(false);
      }
    };

    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [showModal]);

  const openCreate = () => {
    setErr("");
    setForm(emptyForm);
    setEmployeeSearch("");
    setShowEmployeeDropdown(false);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSaving(false);
    setErr("");
    setForm(emptyForm);
    setEmployeeSearch("");
    setShowEmployeeDropdown(false);
  };

  const onSelectEmployee = (id) => {
    const emp = staff.find((x) => String(x.id) === String(id));
    setForm((p) => ({
      ...p,
      employee_id: String(id),
      first_name: clean(emp?.first_name),
      last_name: clean(emp?.last_name),
      middle_name: clean(emp?.middle_name),
      prev_position: clean(emp?.position || emp?.["position"]),
      prev_branch_id: emp?.branch_id != null ? String(emp.branch_id) : "",
    }));

    if (emp) {
      setEmployeeSearch(
        `${emp.id} — ${displayNameParts(emp)}${emp.employee_no ? ` (${emp.employee_no})` : ""}`
      );
    }
    setShowEmployeeDropdown(false);
  };

  const submitCreate = async (e) => {
    e.preventDefault();
    if (!canCreate || saving) return;

    setErr("");

    const payload = {
      employee_id: Number(form.employee_id),
      employee_name: displayNameParts({
        last_name: form.last_name,
        first_name: form.first_name,
        middle_name: form.middle_name,
      }),
      old_position: clean(form.prev_position) || null,
      new_position: clean(form.new_position),
      effective_date: toDate10(form.effective_date),
      details: clean(form.details) || null,
      to_branch_id: form.to_branch_id ? Number(form.to_branch_id) : null,
    };

    if (!payload.employee_id) return setErr("Select employee.");
    if (!payload.new_position) return setErr("New position is required.");
    if (!payload.effective_date) return setErr("Effective date is required.");
    if (!payload.to_branch_id) return setErr("Destination branch is required.");

    setSaving(true);
    try {
      await api.post("/demotion-orders", payload);
      closeModal();
      await loadData();
    } catch (e2) {
      setErr(e2?.response?.data?.message || "Failed to create demotion order.");
    } finally {
      setSaving(false);
    }
  };

  const approveOrder = async (o) => {
    if (!canApprove) return;
    const pending = String(o.status || "").toLowerCase() === "pending";
    if (!pending) return;

    if (!window.confirm(`Approve demotion order ${o.order_no || o.id}?`)) return;

    setErr("");
    try {
      await api.put(`/demotion-orders/${o.id}/approve`);
      await loadData();
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to approve.");
    }
  };

  const openReject = (o) => {
    if (!canApprove) return;
    const pending = String(o.status || "").toLowerCase() === "pending";
    if (!pending) return;

    setRejecting(o);
    setRejectReason("");
  };

  const closeReject = () => {
    setRejecting(null);
    setRejectReason("");
    setRejectSaving(false);
  };

  const submitReject = async (e) => {
    e.preventDefault();
    if (!canApprove || !rejecting || rejectSaving) return;

    const reason = clean(rejectReason);
    if (!reason) return setErr("Rejection reason is required.");

    setRejectSaving(true);
    setErr("");
    try {
      await api.put(`/demotion-orders/${rejecting.id}/reject`, { reason });
      closeReject();
      await loadData();
    } catch (e2) {
      setErr(e2?.response?.data?.message || "Failed to reject.");
    } finally {
      setRejectSaving(false);
    }
  };

  const branchLabel = (id) => {
    const b = branchMap.get(String(id));
    if (!b) return id ? String(id) : "-";
    return `${b.code} - ${b.name}`;
  };

  return (
    <div className="po-page">
      <div className="po-topbar">
        <div>
          <h2 className="po-title">Demotion</h2>
          <p className="po-subtitle">Create and manage demotion orders.</p>
        </div>

        <div className="po-topbar-actions">
          <button className="po-btn po-btn-outline" type="button" onClick={() => navigate(-1)}>
            ← Back
          </button>
          <button className="po-btn" type="button" onClick={loadData} disabled={loading}>
            Refresh
          </button>
          {canCreate ? (
            <button className="po-btn po-btn-primary" type="button" onClick={openCreate}>
              + Create Demotion
            </button>
          ) : null}
        </div>
      </div>

      {err ? <div style={{ color: "#ef4444", fontWeight: 900 }}>{err}</div> : null}

      <div className="po-card">
        <div className="po-table-wrap">
          <table className="po-table">
            <thead>
              <tr>
                <th style={{ width: 140 }}>Order No</th>
                <th>Employee</th>
                <th style={{ width: 190 }}>Prev Position</th>
                <th style={{ width: 190 }}>New Position</th>
                <th style={{ width: 220 }}>Prev Branch</th>
                <th style={{ width: 220 }}>Destination</th>
                <th style={{ width: 130 }}>Effective</th>
                <th style={{ width: 120 }}>Status</th>
                <th style={{ width: 240 }}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="po-empty">
                    Loading…
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="po-empty">
                    No demotion orders found.
                  </td>
                </tr>
              ) : (
                orders.map((o) => {
                  const statusLower = String(o.status || "Pending").toLowerCase();
                  const pending = statusLower === "pending";

                  return (
                    <tr key={o.id}>
                      <td className="mono">{o.order_no || "-"}</td>

                      <td>
                        <div className="td-strong">{o.employee_name}</div>
                        <div className="po-dash" style={{ fontSize: 12 }}>
                          ID: <span className="mono">{o.employee_id}</span>
                        </div>
                      </td>

                      <td>{o.old_position || <span className="po-dash">-</span>}</td>
                      <td>{o.new_position || <span className="po-dash">-</span>}</td>

                      <td>{o.prev_branch_id ? branchLabel(o.prev_branch_id) : "-"}</td>
                      <td>{o.to_branch_id ? branchLabel(o.to_branch_id) : "-"}</td>

                      <td className="mono">{toDate10(o.effective_date) || "-"}</td>

                      <td>
                        <span className={badgeClass(o.status)}>{o.status || "Pending"}</span>
                        {String(o.status || "").toLowerCase() === "rejected" && o.rejection_reason ? (
                          <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>
                            Reason: {o.rejection_reason}
                          </div>
                        ) : null}
                      </td>

                      <td>
                        <div className="po-row-actions">
                          {canApprove ? (
                            <>
                              <button
                                className="po-mini-btn po-approve"
                                type="button"
                                onClick={() => approveOrder(o)}
                                disabled={!pending}
                              >
                                Approve
                              </button>
                              <button
                                className="po-mini-btn po-reject"
                                type="button"
                                onClick={() => openReject(o)}
                                disabled={!pending}
                              >
                                Reject
                              </button>
                            </>
                          ) : (
                            <span className="po-dash" style={{ fontSize: 12 }}>
                              Admin approval required
                            </span>
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

      {showModal && (
        <div
          className="po-modal-overlay"
          onMouseDown={(e) => e.target.classList.contains("po-modal-overlay") && closeModal()}
        >
          <div className="po-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="po-modal-head">
              <div>
                <h3 className="po-modal-title">Create Demotion</h3>
                <div className="po-modal-sub">
                  Fields: Employee ID, Name, Prev Position, New Position, Prev Branch, Destination Branch, Effective Date, Details.
                </div>
              </div>
              <button className="po-x" type="button" onClick={closeModal}>
                ✕
              </button>
            </div>

            <form className="po-form" onSubmit={submitCreate}>
              <div className="po-grid">
                <div className="po-field full" ref={employeeBoxRef} style={{ position: "relative" }}>
                  <label>Employee (ID + Name)</label>

                  <input
                    type="text"
                    placeholder="Search employee ID, name, or employee no..."
                    value={employeeSearch}
                    onChange={(e) => {
                      setEmployeeSearch(e.target.value);
                      setShowEmployeeDropdown(true);
                      setForm((p) => ({
                        ...p,
                        employee_id: "",
                        first_name: "",
                        last_name: "",
                        middle_name: "",
                        prev_position: "",
                        prev_branch_id: "",
                      }));
                    }}
                    onFocus={() => setShowEmployeeDropdown(true)}
                  />

                  {showEmployeeDropdown && (
                    <div
                      style={{
                        position: "absolute",
                        top: "100%",
                        left: 0,
                        right: 0,
                        marginTop: 6,
                        maxHeight: 240,
                        overflowY: "auto",
                        background: "var(--card, #0f172a)",
                        border: "1px solid var(--border, rgba(255,255,255,0.1))",
                        borderRadius: 10,
                        zIndex: 50,
                        boxShadow: "0 12px 30px rgba(0,0,0,0.25)",
                      }}
                    >
                      {filteredStaff.length === 0 ? (
                        <div
                          style={{
                            padding: 12,
                            color: "var(--muted)",
                            fontSize: 14,
                          }}
                        >
                          No employee found
                        </div>
                      ) : (
                        filteredStaff.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => onSelectEmployee(s.id)}
                            style={{
                              width: "100%",
                              textAlign: "left",
                              padding: "10px 12px",
                              border: "none",
                              borderBottom: "1px solid var(--border, rgba(255,255,255,0.08))",
                              background: "transparent",
                              color: "inherit",
                              cursor: "pointer",
                            }}
                          >
                            {s.id} — {displayNameParts(s)} {s.employee_no ? `(${s.employee_no})` : ""}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                <div className="po-field">
                  <label>Employee ID</label>
                  <input value={form.employee_id} readOnly />
                </div>

                <div className="po-field">
                  <label>Last Name</label>
                  <input value={form.last_name} readOnly />
                </div>

                <div className="po-field">
                  <label>First Name</label>
                  <input value={form.first_name} readOnly />
                </div>

                <div className="po-field">
                  <label>Middle Name</label>
                  <input value={form.middle_name} readOnly />
                </div>

                <div className="po-field">
                  <label>Previous Position</label>
                  <input value={form.prev_position} readOnly />
                </div>

                <div className="po-field">
                  <label>New Position</label>
                  <input
                    value={form.new_position}
                    onChange={(e) => setForm((p) => ({ ...p, new_position: e.target.value }))}
                    placeholder="Enter new position"
                    required
                  />
                </div>

                <div className="po-field">
                  <label>Previous Branch</label>
                  <input value={form.prev_branch_id ? branchLabel(form.prev_branch_id) : "-"} readOnly />
                </div>

                <div className="po-field">
                  <label>Destination Branch</label>
                  <select
                    value={form.to_branch_id}
                    onChange={(e) => setForm((p) => ({ ...p, to_branch_id: e.target.value }))}
                    required
                  >
                    <option value="">Select branch</option>
                    {branches
                      .filter((b) => String(b.id) !== String(form.prev_branch_id))
                      .map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.code} - {b.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="po-field">
                  <label>Effective Date</label>
                  <input
                    type="date"
                    value={form.effective_date}
                    onChange={(e) => setForm((p) => ({ ...p, effective_date: e.target.value }))}
                    required
                  />
                </div>

                <div className="po-field">
                  <label>Details / Remarks</label>
                  <input
                    value={form.details}
                    onChange={(e) => setForm((p) => ({ ...p, details: e.target.value }))}
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div className="po-modal-actions">
                <button className="po-btn po-btn-outline" type="button" onClick={closeModal} disabled={saving}>
                  Cancel
                </button>
                <button className="po-btn po-btn-primary" type="submit" disabled={saving}>
                  {saving ? "Saving..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {rejecting && (
        <div
          className="po-modal-overlay"
          onMouseDown={(e) => e.target.classList.contains("po-modal-overlay") && closeReject()}
        >
          <div className="po-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="po-modal-head">
              <div>
                <h3 className="po-modal-title">Reject Demotion</h3>
                <div className="po-modal-sub">
                  Order <b>{rejecting.order_no || rejecting.id}</b> — {rejecting.employee_name}
                </div>
              </div>
              <button className="po-x" type="button" onClick={closeReject}>
                ✕
              </button>
            </div>

            <form className="po-form" onSubmit={submitReject}>
              <div className="po-grid">
                <div className="po-field full">
                  <label>Rejection Reason</label>
                  <input
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Type reason..."
                    required
                  />
                </div>
              </div>

              <div className="po-modal-actions">
                <button className="po-btn po-btn-outline" type="button" onClick={closeReject} disabled={rejectSaving}>
                  Cancel
                </button>
                <button className="po-btn po-btn-primary" type="submit" disabled={rejectSaving}>
                  {rejectSaving ? "Rejecting..." : "Reject"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}