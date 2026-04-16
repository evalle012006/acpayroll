import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axiosClient";
import "../styles/SuspensionOrder.css";

const clean = (v) => String(v ?? "").trim();
const toDate10 = (v) => (v ? String(v).slice(0, 10) : "");
const toNum = (v) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const displayNameParts = (s) => {
  const ln = clean(s?.last_name);
  const fn = clean(s?.first_name);
  const mn = clean(s?.middle_name);
  const built = `${ln}${ln && fn ? ", " : ""}${fn}${mn ? ` ${mn}` : ""}`
    .replace(/\s+/g, " ")
    .trim();
  return built || clean(s?.fullname) || "-";
};

const daysBetweenInclusive = (start, end) => {
  const s = toDate10(start);
  const e = toDate10(end);
  if (!s || !e) return 0;

  const sd = new Date(`${s}T00:00:00`);
  const ed = new Date(`${e}T00:00:00`);
  if (Number.isNaN(sd.getTime()) || Number.isNaN(ed.getTime())) return 0;
  if (ed < sd) return 0;

  const diffMs = ed.getTime() - sd.getTime();
  return Math.floor(diffMs / 86400000) + 1;
};

export default function SuspensionOrder() {
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
    isAdmin || role === "branch manager" || isAssistantVicePresident;

  const canApprove = isAdmin || isHr || isAccounting;

  const [orders, setOrders] = useState([]);
  const [staff, setStaff] = useState([]);

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
      employee_name: "",
      suspension_type: "",
      suspension_start: "",
      suspension_end: "",
      days_of_suspension: "",
      basic_salary: 0,
      ecola: 0,
      transportation: 0,
      deduction_basic: 0,
      deduction_ecola: 0,
      deduction_transportation: 0,
      total_deduction: 0,
      reason: "",
    }),
    []
  );

  const [form, setForm] = useState(emptyForm);
  const [attachFile, setAttachFile] = useState(null);

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

  const computeDeductions = (next) => {
    const days =
      toNum(next.days_of_suspension) > 0
        ? toNum(next.days_of_suspension)
        : daysBetweenInclusive(next.suspension_start, next.suspension_end);

    const basic = toNum(next.basic_salary);
    const ecola = toNum(next.ecola);
    const transportation = toNum(next.transportation);

    const perDayBasic = basic / 30;
    const perDayEcola = ecola / 30;
    const perDayTransportation = transportation / 30;

    const deduction_basic = perDayBasic * days;
    const deduction_ecola = perDayEcola * days;
    const deduction_transportation = perDayTransportation * days;
    const total_deduction =
      deduction_basic + deduction_ecola + deduction_transportation;

    return {
      ...next,
      days_of_suspension: days > 0 ? String(days) : "",
      deduction_basic,
      deduction_ecola,
      deduction_transportation,
      total_deduction,
    };
  };

  const setFormAndCompute = (patch) => {
    setForm((prev) => computeDeductions({ ...prev, ...patch }));
  };

  const loadData = async () => {
    setLoading(true);
    setErr("");
    try {
      const [oRes, sRes] = await Promise.all([
        api.get("/suspension-orders"),
        api.get("/staff"),
      ]);

      setOrders(Array.isArray(oRes.data) ? oRes.data : []);
      setStaff(Array.isArray(sRes.data) ? sRes.data : []);
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to load suspension orders.");
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
    setAttachFile(null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSaving(false);
    setErr("");
    setForm(emptyForm);
    setEmployeeSearch("");
    setShowEmployeeDropdown(false);
    setAttachFile(null);
  };

  const onSelectEmployee = (id) => {
    const emp = staff.find((x) => String(x.id) === String(id));

    const next = {
      ...form,
      employee_id: String(id),
      employee_name: emp?.fullname || displayNameParts(emp),
      basic_salary: toNum(emp?.salary),
      ecola: toNum(emp?.ecola),
      transportation: toNum(emp?.transportation),
    };

    setForm(computeDeductions(next));

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

    if (!form.employee_id) return setErr("Select employee.");
    if (!clean(form.suspension_type)) return setErr("Suspension type required.");
    if (!toDate10(form.suspension_start)) return setErr("Start date required.");
    if (!toDate10(form.suspension_end)) return setErr("End date required.");
    if (!clean(form.reason)) return setErr("Reason required.");

    const days = toNum(form.days_of_suspension);
    if (days <= 0) return setErr("Days of suspension must be greater than 0.");

    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("employee_id", Number(form.employee_id));
      formData.append("employee_name", clean(form.employee_name));
      formData.append("suspension_type", clean(form.suspension_type));
      formData.append("suspension_start", toDate10(form.suspension_start));
      formData.append("suspension_end", toDate10(form.suspension_end));
      formData.append("days_of_suspension", String(days));
      formData.append("basic_salary", String(toNum(form.basic_salary)));
      formData.append("ecola", String(toNum(form.ecola)));
      formData.append("transportation", String(toNum(form.transportation)));
      formData.append("deduction_basic", String(toNum(form.deduction_basic)));
      formData.append("deduction_ecola", String(toNum(form.deduction_ecola)));
      formData.append(
        "deduction_transportation",
        String(toNum(form.deduction_transportation))
      );
      formData.append("total_deduction", String(toNum(form.total_deduction)));
      formData.append("reason", clean(form.reason));

      if (attachFile) {
        formData.append("attachment", attachFile);
      }

      await api.post("/suspension-orders", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      closeModal();
      await loadData();
    } catch (e2) {
      setErr(e2?.response?.data?.message || "Failed to create suspension order.");
    } finally {
      setSaving(false);
    }
  };

  const approveOrder = async (o) => {
    if (!canApprove) return;

    const pending = String(o.status || "").toLowerCase() === "pending";
    if (!pending) return;

    if (!window.confirm("Approve this suspension order?")) return;

    try {
      await api.put(`/suspension-orders/${o.id}/approve`);
      await loadData();
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to approve.");
    }
  };

  const openReject = (o) => {
    if (!canApprove) return;
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
    if (!rejecting) return;

    if (!clean(rejectReason)) return setErr("Rejection reason required.");

    setRejectSaving(true);
    try {
      await api.put(`/suspension-orders/${rejecting.id}/reject`, {
        reason: rejectReason,
      });
      closeReject();
      await loadData();
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to reject.");
    } finally {
      setRejectSaving(false);
    }
  };

  return (
    <div className="po-page">
      <div className="po-topbar">
        <div>
          <h2 className="po-title">Suspension Orders</h2>
          <p className="po-subtitle">Create and manage suspension orders.</p>
        </div>

        <div className="po-topbar-actions">
          <button
            className="po-btn po-btn-outline"
            onClick={() => navigate(-1)}
            type="button"
          >
            ← Back
          </button>

          <button
            className="po-btn"
            onClick={loadData}
            disabled={loading}
            type="button"
          >
            Refresh
          </button>

          {canCreate && (
            <button
              className="po-btn po-btn-primary"
              onClick={openCreate}
              type="button"
            >
              + Create Suspension
            </button>
          )}
        </div>
      </div>

      {err && <div style={{ color: "#ef4444", fontWeight: 900 }}>{err}</div>}

      <div className="po-card">
        <div className="po-table-wrap">
          <table className="po-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Type</th>
                <th>Start</th>
                <th>End</th>
                <th>Days</th>
                <th>Total Deduction</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="po-empty">
                    Loading...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="po-empty">
                    No suspension orders found.
                  </td>
                </tr>
              ) : (
                orders.map((o) => {
                  const pending =
                    String(o.status || "").toLowerCase() === "pending";

                  return (
                    <tr key={o.id}>
                      <td>{o.employee_name}</td>
                      <td>{o.suspension_type || "-"}</td>
                      <td>{toDate10(o.start_date || o.suspension_start)}</td>
                      <td>{toDate10(o.end_date || o.suspension_end)}</td>
                      <td>{o.days_of_suspension ?? "-"}</td>
                      <td>{toNum(o.total_deduction).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td>{o.reason}</td>
                      <td>
                        <span className={badgeClass(o.status)}>
                          {o.status || "Pending"}
                        </span>
                      </td>
                      <td>
                        <div className="po-row-actions">
                          {canApprove ? (
                            <>
                              <button
                                className="po-mini-btn po-approve"
                                onClick={() => approveOrder(o)}
                                disabled={!pending}
                                type="button"
                              >
                                Approve
                              </button>
                              <button
                                className="po-mini-btn po-reject"
                                onClick={() => openReject(o)}
                                disabled={!pending}
                                type="button"
                              >
                                Reject
                              </button>
                            </>
                          ) : (
                            <span style={{ opacity: 0.7 }}>-</span>
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
          onMouseDown={(e) =>
            e.target.classList.contains("po-modal-overlay") && closeModal()
          }
        >
          <div className="po-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="po-modal-head">
              <h3 className="po-modal-title">Create Suspension</h3>
              <button className="po-x" onClick={closeModal} type="button">
                ✕
              </button>
            </div>

            <form className="po-form" onSubmit={submitCreate}>
              <div className="po-grid">
                <div
                  className="po-field"
                  ref={employeeBoxRef}
                  style={{ position: "relative" }}
                >
                  <label>Employee</label>

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
                        employee_name: "",
                        basic_salary: 0,
                        ecola: 0,
                        transportation: 0,
                        deduction_basic: 0,
                        deduction_ecola: 0,
                        deduction_transportation: 0,
                        total_deduction: 0,
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
                              borderBottom:
                                "1px solid var(--border, rgba(255,255,255,0.08))",
                              background: "transparent",
                              color: "inherit",
                              cursor: "pointer",
                            }}
                          >
                            {s.id} — {displayNameParts(s)}{" "}
                            {s.employee_no ? `(${s.employee_no})` : ""}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                <div className="po-field">
                  <label>Employee Name</label>
                  <input value={form.employee_name} readOnly />
                </div>

                <div className="po-field">
                  <label>Suspension Type</label>
                  <select
                    value={form.suspension_type}
                    onChange={(e) =>
                      setFormAndCompute({ suspension_type: e.target.value })
                    }
                    required
                  >
                    <option value="">Select suspension type</option>
                    <option value="Suspension">Suspension</option>
                    <option value="Preventive Suspension">Preventive Suspension</option>
                    <option value="Notice of Admin Hearing">Notice of Admin Hearing</option>
                  </select>
                </div>

                <div className="po-field">
                  <label>Start Date</label>
                  <input
                    type="date"
                    value={form.suspension_start}
                    onChange={(e) =>
                      setFormAndCompute({
                        suspension_start: e.target.value,
                      })
                    }
                    required
                  />
                </div>

                <div className="po-field">
                  <label>End Date</label>
                  <input
                    type="date"
                    value={form.suspension_end}
                    onChange={(e) =>
                      setFormAndCompute({
                        suspension_end: e.target.value,
                      })
                    }
                    required
                  />
                </div>

                <div className="po-field">
                  <label>Days of Suspension</label>
                  <input
                    type="number"
                    min="1"
                    value={form.days_of_suspension}
                    onChange={(e) =>
                      setFormAndCompute({
                        days_of_suspension: e.target.value,
                      })
                    }
                    placeholder="Enter days"
                    required
                  />
                </div>

                <div className="po-field">
                  <label>Basic Salary</label>
                  <input
                    value={toNum(form.basic_salary).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                    readOnly
                  />
                </div>

                <div className="po-field">
                  <label>Ecola</label>
                  <input
                    value={toNum(form.ecola).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                    readOnly
                  />
                </div>

                <div className="po-field">
                  <label>Transportation</label>
                  <input
                    value={toNum(form.transportation).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                    readOnly
                  />
                </div>

                <div className="po-field">
                  <label>Deduction in Basic</label>
                  <input
                    value={toNum(form.deduction_basic).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                    readOnly
                  />
                </div>

                <div className="po-field">
                  <label>Deduction in Ecola</label>
                  <input
                    value={toNum(form.deduction_ecola).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                    readOnly
                  />
                </div>

                <div className="po-field">
                  <label>Deduction in Transportation</label>
                  <input
                    value={toNum(form.deduction_transportation).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                    readOnly
                  />
                </div>

                <div className="po-field">
                  <label>Total Deduction</label>
                  <input
                    value={toNum(form.total_deduction).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                    readOnly
                  />
                </div>

                <div className="po-field">
                  <label>Attach File</label>
                  <input
                    type="file"
                    onChange={(e) => setAttachFile(e.target.files?.[0] || null)}
                  />
                </div>

                <div className="po-field full">
                  <label>Reason</label>
                  <textarea
                    value={form.reason}
                    onChange={(e) =>
                      setFormAndCompute({ reason: e.target.value })
                    }
                    required
                  />
                </div>
              </div>

              <div className="po-modal-actions">
                <button
                  className="po-btn po-btn-outline"
                  type="button"
                  onClick={closeModal}
                >
                  Cancel
                </button>
                <button
                  className="po-btn po-btn-primary"
                  type="submit"
                  disabled={saving}
                >
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
          onMouseDown={(e) =>
            e.target.classList.contains("po-modal-overlay") && closeReject()
          }
        >
          <div className="po-modal po-modal-sm" onMouseDown={(e) => e.stopPropagation()}>
            <div className="po-modal-head">
              <h3 className="po-modal-title">Reject Suspension</h3>
              <button className="po-x" onClick={closeReject} type="button">
                ✕
              </button>
            </div>

            <form className="po-form" onSubmit={submitReject}>
              <div className="po-grid">
                <div className="po-field full">
                  <label>Reason for rejection</label>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="po-modal-actions">
                <button
                  className="po-btn po-btn-outline"
                  type="button"
                  onClick={closeReject}
                >
                  Cancel
                </button>
                <button
                  className="po-btn po-reject"
                  type="submit"
                  disabled={rejectSaving}
                >
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