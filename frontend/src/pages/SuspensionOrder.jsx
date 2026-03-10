import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axiosClient";
import "../styles/SuspensionOrder.css";

const clean = (v) => String(v ?? "").trim();
const toDate10 = (v) => (v ? String(v).slice(0, 10) : "");

export default function SuspensionOrder() {
  const navigate = useNavigate();

  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  }, []);

  const role = String(user?.role || "").trim().toLowerCase();
  const isAdmin = role === "admin";
  const canCreate = role === "admin" || role === "branch manager";

  const [orders, setOrders] = useState([]);
  const [staff, setStaff] = useState([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const [showModal, setShowModal] = useState(false);

  const [rejecting, setRejecting] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectSaving, setRejectSaving] = useState(false);

  const emptyForm = useMemo(
    () => ({
      employee_id: "",
      employee_name: "",
      suspension_start: "",
      suspension_end: "",
      reason: "",
    }),
    []
  );

  const [form, setForm] = useState(emptyForm);

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

  const openCreate = () => {
    setErr("");
    setForm(emptyForm);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSaving(false);
    setErr("");
    setForm(emptyForm);
  };

  const onSelectEmployee = (id) => {
    const emp = staff.find((x) => String(x.id) === String(id));
    setForm((p) => ({
      ...p,
      employee_id: id,
      employee_name: emp?.fullname || "",
    }));
  };

  const submitCreate = async (e) => {
    e.preventDefault();
    if (!canCreate || saving) return;

    setErr("");

    const payload = {
      employee_id: Number(form.employee_id),
      employee_name: clean(form.employee_name),
      suspension_start: toDate10(form.suspension_start),
      suspension_end: toDate10(form.suspension_end),
      reason: clean(form.reason),
    };

    if (!payload.employee_id) return setErr("Select employee.");
    if (!payload.suspension_start) return setErr("Start date required.");
    if (!payload.suspension_end) return setErr("End date required.");
    if (!payload.reason) return setErr("Reason required.");

    setSaving(true);
    try {
      await api.post("/suspension-orders", payload);
      closeModal();
      await loadData();
    } catch (e2) {
      setErr(e2?.response?.data?.message || "Failed to create suspension order.");
    } finally {
      setSaving(false);
    }
  };

  const approveOrder = async (o) => {
    if (!isAdmin) return;

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
    if (!isAdmin) return;
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

      {err && (
        <div style={{ color: "#ef4444", fontWeight: 900 }}>{err}</div>
      )}

      <div className="po-card">
        <div className="po-table-wrap">
          <table className="po-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Start</th>
                <th>End</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="po-empty">
                    Loading...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="po-empty">
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
                      <td>{toDate10(o.suspension_start)}</td>
                      <td>{toDate10(o.suspension_end)}</td>
                      <td>{o.reason}</td>
                      <td>
                        <span className={badgeClass(o.status)}>
                          {o.status || "Pending"}
                        </span>
                      </td>
                      <td>
                        <div className="po-row-actions">
                          {isAdmin && (
                            <>
                              <button
                                className="po-mini-btn po-approve"
                                onClick={() => approveOrder(o)}
                                disabled={!pending}
                              >
                                Approve
                              </button>
                              <button
                                className="po-mini-btn po-reject"
                                onClick={() => openReject(o)}
                                disabled={!pending}
                              >
                                Reject
                              </button>
                            </>
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
              <button className="po-x" onClick={closeModal}>
                ✕
              </button>
            </div>

            <form className="po-form" onSubmit={submitCreate}>
              <div className="po-grid">
                <div className="po-field">
                  <label>Employee</label>
                  <select
                    value={form.employee_id}
                    onChange={(e) => onSelectEmployee(e.target.value)}
                  >
                    <option value="">Select Employee</option>
                    {staff.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.fullname}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="po-field">
                  <label>Employee Name</label>
                  <input value={form.employee_name} readOnly />
                </div>

                <div className="po-field">
                  <label>Start Date</label>
                  <input
                    type="date"
                    value={form.suspension_start}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        suspension_start: e.target.value,
                      }))
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
                      setForm((p) => ({
                        ...p,
                        suspension_end: e.target.value,
                      }))
                    }
                    required
                  />
                </div>

                <div className="po-field full">
                  <label>Reason</label>
                  <textarea
                    value={form.reason}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, reason: e.target.value }))
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
    </div>
  );
}