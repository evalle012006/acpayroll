import React, { useEffect, useMemo, useState, useCallback } from "react";
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

const toStr = (v) => String(v ?? "").trim();
const norm = (v) => toStr(v).toLowerCase();
const fmtDate = (d) => (d ? String(d).slice(0, 10) : "-");

const displayName = (s) => {
  const ln = toStr(s?.last_name);
  const fn = toStr(s?.first_name);
  const mn = toStr(s?.middle_name);
  const built = `${ln}${ln && fn ? ", " : ""}${fn}${mn ? ` ${mn}` : ""}`
    .replace(/\s+/g, " ")
    .trim();
  return built || toStr(s?.fullname) || "-";
};

const branchLabel = (b) => (b ? `${toStr(b.code)} - ${toStr(b.name)}`.trim() : "-");

export default function TransferStaffOrder() {
  const navigate = useNavigate();

  const user = useMemo(() => readUser(), []);
  const role = norm(user?.role);
  const canApprove = role === "admin";

  const [showModal, setShowModal] = useState(false);
  const [isRedeploy, setIsRedeploy] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [search, setSearch] = useState("");

  const [branches, setBranches] = useState([]);
  const [staff, setStaff] = useState([]);

  const [orders, setOrders] = useState([]);
  const [loadingRefs, setLoadingRefs] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");

  const [dateCreated, setDateCreated] = useState(() => new Date().toISOString().slice(0, 10));
  const [division, setDivision] = useState("");
  const [area, setArea] = useState("");
  const [region, setRegion] = useState("");
  const [details, setDetails] = useState("");

  const [employeeId, setEmployeeId] = useState("");
  const [fromBranchId, setFromBranchId] = useState("");
  const [toBranchId, setToBranchId] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/login";
  }, []);

  useEffect(() => {
    const loadRefs = async () => {
      setLoadingRefs(true);
      setError("");
      try {
        const [bRes, sRes] = await Promise.all([api.get("/branches"), api.get("/staff")]);
        setBranches(Array.isArray(bRes.data) ? bRes.data : []);
        setStaff(Array.isArray(sRes.data) ? sRes.data : []);
      } catch (err) {
        const status = err?.response?.status;
        if (status === 401) return logout();
        setError(err?.response?.data?.message || "Failed to load branches and staff.");
      } finally {
        setLoadingRefs(false);
      }
    };
    loadRefs();
  }, [logout]);

  const fetchOrders = useCallback(async () => {
    setLoadingOrders(true);
    setError("");
    try {
      const res = await api.get("/transfer-staff-orders");
      const list = Array.isArray(res.data) ? res.data : [];
      setOrders(list);

      setSelectedOrder((prev) => {
        if (!prev) return null;
        const updated = list.find((o) => Number(o.id) === Number(prev.id));
        return updated || null;
      });
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401) return logout();
      setError(err?.response?.data?.message || "Failed to load transfer orders.");
      setOrders([]);
      setSelectedOrder(null);
    } finally {
      setLoadingOrders(false);
    }
  }, [logout]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const selectedEmployee = useMemo(
    () => staff.find((s) => Number(s.id) === Number(employeeId)) || null,
    [staff, employeeId]
  );

  const fromBranch = useMemo(
    () => branches.find((b) => Number(b.id) === Number(fromBranchId)) || null,
    [branches, fromBranchId]
  );

  const toBranch = useMemo(
    () => branches.find((b) => Number(b.id) === Number(toBranchId)) || null,
    [branches, toBranchId]
  );

  const filteredOrders = useMemo(() => {
    const q = toStr(search).toLowerCase();
    if (!q) return orders;

    return orders.filter((o) => {
      const haystack = [
        o.order_no,
        o.employee_name,
        o.prev_branch_code,
        o.prev_branch_name,
        o.to_branch_code,
        o.to_branch_name,
        o.division,
        o.area,
        o.region,
        o.status,
        o.rejection_reason,
        fmtDate(o.date_created),
        fmtDate(o.effective_date),
      ]
        .map(toStr)
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [orders, search]);

  useEffect(() => {
    if (!showModal || !selectedEmployee) return;

    if (selectedEmployee.branch_id && !fromBranchId) {
      setFromBranchId(String(selectedEmployee.branch_id));
    }
  }, [showModal, selectedEmployee, fromBranchId]);

  const approveOrder = async (id) => {
    if (!canApprove) return;
    setError("");
    try {
      const res = await api.put(`/transfer-staff-orders/${id}/approve`);
      const updatedOrder = res.data;

      setOrders((prev) => prev.map((o) => (o.id === id ? updatedOrder : o)));
      setSelectedOrder((prev) => (prev && Number(prev.id) === Number(id) ? updatedOrder : prev));
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401) return logout();
      setError(err?.response?.data?.message || "Failed to approve order.");
    }
  };

  const rejectOrder = async (id) => {
    if (!canApprove) return;

    const reason = prompt("Enter rejection reason:");
    if (!reason || !reason.trim()) return;

    setError("");
    try {
      const res = await api.put(`/transfer-staff-orders/${id}/reject`, { reason: reason.trim() });
      const updatedOrder = res.data;

      setOrders((prev) => prev.map((o) => (o.id === id ? updatedOrder : o)));
      setSelectedOrder((prev) => (prev && Number(prev.id) === Number(id) ? updatedOrder : prev));
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401) return logout();
      setError(err?.response?.data?.message || "Failed to reject order.");
    }
  };

  const resetForm = () => {
    setDateCreated(new Date().toISOString().slice(0, 10));
    setDivision("");
    setArea("");
    setRegion("");
    setDetails("");

    setEmployeeId("");
    setFromBranchId("");
    setToBranchId("");
    setEffectiveDate("");

    setIsRedeploy(false);
    setError("");
  };

  const openModal = () => {
    resetForm();
    setIsRedeploy(false);
    setShowModal(true);
  };

  const handleRedeploy = (order) => {
    if (!order) {
      setError("Select an approved order first.");
      return;
    }

    if (toStr(order.status).toLowerCase() !== "approved") {
      setError("Only approved orders can be re-deployed.");
      return;
    }

    resetForm();

    setIsRedeploy(true);
    setShowModal(true);

    setEmployeeId(String(order.employee_id || ""));
    setFromBranchId(String(order.to_branch_id || ""));
    setToBranchId("");

    setDivision(toStr(order.division));
    setArea("");
    setRegion("");
    setDateCreated(new Date().toISOString().slice(0, 10));
    setEffectiveDate("");
    setDetails(
      `Re-deployment of ${toStr(order.employee_name)} from ${toStr(order.to_branch_code)} - ${toStr(
        order.to_branch_name
      )}.`
    );
  };

  const openRedeployFromTop = () => {
    setError("");

    if (!selectedOrder) {
      setError("Select an approved order from the table first.");
      return;
    }

    if (toStr(selectedOrder.status).toLowerCase() !== "approved") {
      setError("Only approved orders can be re-deployed.");
      return;
    }

    handleRedeploy(selectedOrder);
  };

  const closeModal = () => {
    setShowModal(false);
    resetForm();
  };

  useEffect(() => {
    if (!showModal) return;
    const onKeyDown = (e) => e.key === "Escape" && closeModal();
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [showModal]);

  const saveOrder = async () => {
    setError("");

    if (!employeeId) return setError("Select employee.");
    if (!fromBranchId) return setError("Select previous branch.");
    if (!toBranchId) return setError("Select transfer branch.");
    if (String(fromBranchId) === String(toBranchId)) return setError("Previous and transfer branch must differ.");
    if (!toStr(division)) return setError("Division required.");
    if (!toStr(area)) return setError("Area required.");
    if (!toStr(region)) return setError("Region required.");
    if (!dateCreated) return setError("Date Created required.");
    if (!effectiveDate) return setError("Effective date required.");
    if (!toStr(details)) return setError("Details required.");

    const payload = {
      employee_id: Number(employeeId),
      employee_name: displayName(selectedEmployee),

      prev_branch_id: Number(fromBranchId),
      prev_branch_code: toStr(fromBranch?.code),
      prev_branch_name: toStr(fromBranch?.name),

      to_branch_id: Number(toBranchId),
      to_branch_code: toStr(toBranch?.code),
      to_branch_name: toStr(toBranch?.name),

      area: toStr(area),
      region: toStr(region),
      division: toStr(division),
      date_created: dateCreated,
      effective_date: effectiveDate,
      details: toStr(details),
    };

    setSaving(true);
    try {
      const res = await api.post("/transfer-staff-orders", payload);
      const created = res.data;
      setOrders((prev) => [created, ...prev]);
      setSelectedOrder(created);
      closeModal();
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401) return logout();
      setError(err?.response?.data?.message || "Failed to save transfer order.");
    } finally {
      setSaving(false);
    }
  };

  const colCount = canApprove ? 11 : 10;

  return (
    <div className="order-page">
      <div className="order-page-header">
        <div>
          <h2 className="order-title">Transfer Staff Orders</h2>
          <p className="order-subtitle">Manage staff transfers between branches.</p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="btn-secondary" onClick={() => navigate("/transactions")} type="button">
            ← Back
          </button>

          <button className="btn-secondary" onClick={openRedeployFromTop} type="button">
            Re-deploy
          </button>

          <button className="btn-primary" onClick={openModal} type="button">
            + Create Transfer Order
          </button>
        </div>
      </div>

      {error && (
        <div className="card" style={{ padding: 12, border: "1px solid var(--border)", marginBottom: 12 }}>
          <strong style={{ color: "#ef4444" }}>{error}</strong>
        </div>
      )}

      {selectedOrder ? (
        <div
          className="order-selected"
          onClick={() => {
            setSelectedOrder(null);
            setError("");
          }}
          style={{ cursor: "pointer" }}
          title="Click to clear selected order"
        >
          <strong>Selected Order:</strong> {toStr(selectedOrder.order_no)} — {toStr(selectedOrder.employee_name)} (
          {toStr(selectedOrder.status)})
        </div>
      ) : null}

      <div className="order-card">
        <div
          className="order-card-head"
          style={{ display: "flex", gap: 12, justifyContent: "space-between", flexWrap: "wrap" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div className="order-card-title">Transfer Orders</div>

            <div className="order-search-wrap">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search order no, employee, branch, division, area, region..."
                className="order-search-input"
              />
              <button className="btn-secondary" type="button" onClick={() => setSearch("")}>
                Clear
              </button>
            </div>
          </div>

          <div className="order-card-meta">{filteredOrders.length} Records</div>
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
                <th>Region</th>
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
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="empty-state">
                    {toStr(search) ? "No matching transfer orders found." : "No transfer orders found."}
                  </td>
                </tr>
              ) : (
                filteredOrders.map((o) => {
                  const isSelected = Number(selectedOrder?.id) === Number(o.id);

                  return (
                    <tr
                      key={o.id}
                      onClick={() => {
                        setSelectedOrder(o);
                        setError("");
                      }}
                      style={{
                        cursor: "pointer",
                        background: isSelected ? "rgba(59,130,246,0.12)" : "",
                      }}
                    >
                      <td className="td-strong">{o.order_no}</td>
                      <td>{o.employee_name}</td>

                      <td>
                        {toStr(o.prev_branch_code)} - {toStr(o.prev_branch_name)}
                      </td>
                      <td>
                        {toStr(o.to_branch_code)} - {toStr(o.to_branch_name)}
                      </td>

                      <td>{o.division}</td>
                      <td>{o.area}</td>
                      <td>{o.region || "-"}</td>

                      <td>{fmtDate(o.date_created)}</td>
                      <td>{fmtDate(o.effective_date)}</td>

                      <td>
                        {o.status}
                        {o.status === "Rejected" && o.rejection_reason ? (
                          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                            Reason: {o.rejection_reason}
                          </div>
                        ) : null}
                      </td>

                      {canApprove && (
                        <td onClick={(e) => e.stopPropagation()}>
                          {o.status === "Pending" ? (
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              <button className="btn-primary" type="button" onClick={() => approveOrder(o.id)}>
                                Approve
                              </button>
                              <button className="btn-secondary" type="button" onClick={() => rejectOrder(o.id)}>
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontWeight: 800 }}>{o.status}</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div style={{ padding: 12, display: "flex", justifyContent: "flex-end" }}>
          <button className="btn-secondary" onClick={fetchOrders} type="button" disabled={loadingOrders}>
            {loadingOrders ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onMouseDown={closeModal}>
          <div className="modal saas-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h3 className="modal-title">{isRedeploy ? "Re-deploy Staff" : "Create Transfer Order"}</h3>
                <p className="modal-subtitle">
                  {isRedeploy
                    ? "Create a new deployment order from the selected approved order."
                    : "Order No. will be auto-generated on save."}
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
                    <input type="date" value={dateCreated} onChange={(e) => setDateCreated(e.target.value)} />
                  </div>

                  <div className="field">
                    <label>Effective Date</label>
                    <input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
                  </div>

                  <div className="field full">
                    <label>Employee</label>
                    <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} disabled={isRedeploy}>
                      <option value="">Select employee…</option>
                      {staff.map((s) => (
                        <option key={s.id} value={s.id}>
                          {displayName(s)} {s.employee_no ? `(${s.employee_no})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label>Previous Branch</label>
                    <select value={fromBranchId} onChange={(e) => setFromBranchId(e.target.value)}>
                      <option value="">Select branch…</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {branchLabel(b)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label>Transfer To</label>
                    <select value={toBranchId} onChange={(e) => setToBranchId(e.target.value)}>
                      <option value="">Select branch…</option>
                      {branches
                        .filter((b) => String(b.id) !== String(fromBranchId))
                        .map((b) => (
                          <option key={b.id} value={b.id}>
                            {branchLabel(b)}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="field">
                    <label>Division</label>
                    <input value={division} onChange={(e) => setDivision(e.target.value)} />
                  </div>

                  <div className="field">
                    <label>Area</label>
                    <input value={area} onChange={(e) => setArea(e.target.value)} />
                  </div>

                  <div className="field">
                    <label>Region</label>
                    <input value={region} onChange={(e) => setRegion(e.target.value)} />
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

                {error && <div style={{ marginTop: 10, color: "#ef4444", fontWeight: 800 }}>{error}</div>}

                <div className="modal-buttons">
                  <button className="btn-secondary" onClick={closeModal} type="button" disabled={saving}>
                    Cancel
                  </button>
                  <button className="btn-primary" onClick={saveOrder} type="button" disabled={saving}>
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