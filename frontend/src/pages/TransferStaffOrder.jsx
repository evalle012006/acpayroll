import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axiosClient";
import "../styles/TransferStaffOrder.css";

const readUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
};

export default function TransferStaffOrder() {
  const navigate = useNavigate();

  const [showModal, setShowModal] = useState(false);

  const [branches, setBranches] = useState([]);
  const [staff, setStaff] = useState([]);

  const [orders, setOrders] = useState([]);
  const [loadingRefs, setLoadingRefs] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");

  const [dateCreated, setDateCreated] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [division, setDivision] = useState("");
  const [area, setArea] = useState("");
  const [details, setDetails] = useState("");

  const [employeeId, setEmployeeId] = useState("");
  const [fromBranchId, setFromBranchId] = useState("");
  const [toBranchId, setToBranchId] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");

  // ✅ Admin-only approve/reject
  const user = readUser();
  const role = String(user?.role || "").trim().toLowerCase();
  const canApprove = role === "admin";

  // ==========================
  // Load Branches & Staff
  // ==========================
  useEffect(() => {
    const loadRefs = async () => {
      setLoadingRefs(true);
      setError("");
      try {
        const [bRes, sRes] = await Promise.all([
          api.get("/branches"),
          api.get("/staff"),
        ]);
        setBranches(Array.isArray(bRes.data) ? bRes.data : []);
        setStaff(Array.isArray(sRes.data) ? sRes.data : []);
      } catch (err) {
        setError(
          err?.response?.data?.message || "Failed to load branches and staff."
        );
      } finally {
        setLoadingRefs(false);
      }
    };
    loadRefs();
  }, []);

  // ==========================
  // Fetch Orders
  // ==========================
  const fetchOrders = async () => {
    setLoadingOrders(true);
    setError("");
    try {
      const res = await api.get("/transfer-staff-orders");
      setOrders(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setError(
        err?.response?.data?.message || "Failed to load transfer orders."
      );
    } finally {
      setLoadingOrders(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  // ==========================
  // Derived refs
  // ==========================
  const selectedEmployee = useMemo(
    () => staff.find((s) => Number(s.id) === Number(employeeId)) || null,
    [staff, employeeId]
  );

  const fromBranch = useMemo(
    () =>
      branches.find((b) => Number(b.id) === Number(fromBranchId)) || null,
    [branches, fromBranchId]
  );

  const toBranch = useMemo(
    () => branches.find((b) => Number(b.id) === Number(toBranchId)) || null,
    [branches, toBranchId]
  );

  // Auto-fill from branch/area
  useEffect(() => {
    if (!showModal || !selectedEmployee) return;

    if (selectedEmployee.branch_id && !fromBranchId) {
      setFromBranchId(String(selectedEmployee.branch_id));
    }

    if (!area) {
      setArea(String(selectedEmployee.area || fromBranch?.area || ""));
    }
  }, [showModal, selectedEmployee, fromBranchId, area, fromBranch]);

  // ==========================
  // Approve / Reject
  // ==========================
  const approveOrder = async (id) => {
    setError("");
    try {
      const res = await api.put(`/transfer-staff-orders/${id}/approve`);
      setOrders((prev) => prev.map((o) => (o.id === id ? res.data : o)));
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to approve order.");
    }
  };

  const rejectOrder = async (id) => {
    const reason = prompt("Enter rejection reason:");
    if (!reason || !reason.trim()) return;

    setError("");
    try {
      const res = await api.put(`/transfer-staff-orders/${id}/reject`, {
        reason: reason.trim(),
      });
      setOrders((prev) => prev.map((o) => (o.id === id ? res.data : o)));
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to reject order.");
    }
  };

  // ==========================
  // Modal handlers
  // ==========================
  const resetForm = () => {
    setDateCreated(new Date().toISOString().slice(0, 10));
    setDivision("");
    setArea("");
    setDetails("");

    setEmployeeId("");
    setFromBranchId("");
    setToBranchId("");
    setEffectiveDate("");

    setError("");
  };

  const openModal = () => {
    resetForm();
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    resetForm();
  };

  // ==========================
  // Save Order to DB
  // ==========================
  const saveOrder = async () => {
    setError("");

    if (!employeeId) return setError("Select employee.");
    if (!fromBranchId) return setError("Select previous branch.");
    if (!toBranchId) return setError("Select transfer branch.");
    if (String(fromBranchId) === String(toBranchId))
      return setError("Previous and transfer branch must differ.");
    if (!division.trim()) return setError("Division required.");
    if (!area.trim()) return setError("Area required.");
    if (!dateCreated) return setError("Date Created required.");
    if (!effectiveDate) return setError("Effective date required.");
    if (!details.trim()) return setError("Details required.");

    const payload = {
      employee_id: Number(employeeId),
      employee_name: selectedEmployee?.fullname || "",
      prev_branch_id: Number(fromBranchId),
      prev_branch_code: fromBranch?.code || "",
      prev_branch_name: fromBranch?.name || "",
      to_branch_id: Number(toBranchId),
      to_branch_code: toBranch?.code || "",
      to_branch_name: toBranch?.name || "",
      area: area.trim(),
      division: division.trim(),
      date_created: dateCreated,
      effective_date: effectiveDate,
      details: details.trim(),
    };

    setSaving(true);
    try {
      const res = await api.post("/transfer-staff-orders", payload);
      setOrders((prev) => [res.data, ...prev]);
      closeModal();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to save transfer order.");
    } finally {
      setSaving(false);
    }
  };

  // ✅ Dynamic column count
  const colCount = canApprove ? 10 : 9;

  // ==========================
  // UI
  // ==========================
  return (
    <div className="order-page">
      <div className="order-page-header">
        <div>
          <h2 className="order-title">Transfer Staff Order</h2>
          <p className="order-subtitle">
            Manage staff transfers between branches.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            className="btn-secondary"
            onClick={() => navigate("/transactions")}
            type="button"
          >
            ← Back
          </button>
          <button className="btn-primary" onClick={openModal} type="button">
            + Create Transfer Order
          </button>
        </div>
      </div>

      {error && (
        <div
          className="card"
          style={{ padding: 12, border: "1px solid var(--border)" }}
        >
          <strong style={{ color: "#ef4444" }}>{error}</strong>
        </div>
      )}

      <div className="order-card">
        <div className="order-card-head">
          <div className="order-card-title">Transfer Orders</div>
          <div className="order-card-meta">{orders.length} Records</div>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Order No</th>
                <th>Employee</th>
                <th>From</th>
                <th>To</th>
                <th>Division</th>
                <th>Area</th>
                <th>Date Created</th>
                <th>Effective Date</th>
                <th>Status</th>
                {canApprove && <th>Actions</th>}
              </tr>
            </thead>

            <tbody>
              {loadingOrders ? (
                <tr>
                  <td colSpan={colCount} className="empty-state">
                    Loading orders…
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="empty-state">
                    No transfer orders found.
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.id}>
                    <td className="td-strong">{o.order_no}</td>
                    <td>{o.employee_name}</td>
                    <td>
                      {o.prev_branch_code} - {o.prev_branch_name}
                    </td>
                    <td>
                      {o.to_branch_code} - {o.to_branch_name}
                    </td>
                    <td>{o.division}</td>
                    <td>{o.area}</td>
                    <td>{String(o.date_created).slice(0, 10)}</td>
                    <td>{String(o.effective_date).slice(0, 10)}</td>

                    {/* Status + show rejection reason */}
                    <td>
                      {o.status}
                      {o.status === "Rejected" && o.rejection_reason ? (
                        <div
                          style={{
                            fontSize: 12,
                            color: "var(--muted)",
                            marginTop: 4,
                          }}
                        >
                          Reason: {o.rejection_reason}
                        </div>
                      ) : null}
                    </td>

                    {/* Admin-only Actions */}
                    {canApprove && (
                      <td>
                        {o.status === "Pending" ? (
                          <div style={{ display: "flex", gap: 8 }}>
                            <button
                              className="btn-primary"
                              type="button"
                              onClick={() => approveOrder(o.id)}
                            >
                              Approve
                            </button>
                            <button
                              className="btn-secondary"
                              type="button"
                              onClick={() => rejectOrder(o.id)}
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontWeight: 800 }}>{o.status}</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div style={{ padding: 12, display: "flex", justifyContent: "flex-end" }}>
          <button className="btn-secondary" onClick={fetchOrders} type="button">
            Refresh
          </button>
        </div>
      </div>

      {/* MODAL */}
      {showModal && (
        <div className="modal-overlay" onMouseDown={closeModal}>
          <div
            className="modal saas-modal"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <h3 className="modal-title">Create Transfer Order</h3>
                <p className="modal-subtitle">
                  Order No. will be auto-generated on save.
                </p>
              </div>

              <button className="modal-x" onClick={closeModal} type="button">
                ✕
              </button>
            </div>

            {loadingRefs ? (
              <div className="empty-state">Loading staff & branches…</div>
            ) : (
              <>
                <div className="form-grid">
                  <div className="field">
                    <label>Date Created</label>
                    <input
                      type="date"
                      value={dateCreated}
                      onChange={(e) => setDateCreated(e.target.value)}
                    />
                  </div>

                  <div className="field">
                    <label>Effective Date</label>
                    <input
                      type="date"
                      value={effectiveDate}
                      onChange={(e) => setEffectiveDate(e.target.value)}
                    />
                  </div>

                  <div className="field full">
                    <label>Employee</label>
                    <select
                      value={employeeId}
                      onChange={(e) => setEmployeeId(e.target.value)}
                    >
                      <option value="">Select employee…</option>
                      {staff.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.fullname} {s.employee_no ? `(${s.employee_no})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label>Previous Branch</label>
                    <select
                      value={fromBranchId}
                      onChange={(e) => setFromBranchId(e.target.value)}
                    >
                      <option value="">Select branch…</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.code} - {b.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label>Transfer To</label>
                    <select
                      value={toBranchId}
                      onChange={(e) => setToBranchId(e.target.value)}
                    >
                      <option value="">Select branch…</option>
                      {branches
                        .filter((b) => String(b.id) !== String(fromBranchId))
                        .map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.code} - {b.name}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="field">
                    <label>Division</label>
                    <input
                      value={division}
                      onChange={(e) => setDivision(e.target.value)}
                    />
                  </div>

                  <div className="field">
                    <label>Area</label>
                    <input value={area} onChange={(e) => setArea(e.target.value)} />
                  </div>

                  <div className="field full">
                    <label>Details</label>
                    <textarea
                      rows={3}
                      value={details}
                      onChange={(e) => setDetails(e.target.value)}
                      placeholder="Write transfer details…"
                    />
                  </div>
                </div>

                {error && (
                  <div style={{ marginTop: 10, color: "#ef4444", fontWeight: 800 }}>
                    {error}
                  </div>
                )}

                <div className="modal-buttons">
                  <button
                    className="btn-secondary"
                    onClick={closeModal}
                    type="button"
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn-primary"
                    onClick={saveOrder}
                    type="button"
                    disabled={saving}
                  >
                    {saving ? "Saving..." : "Save Order"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}