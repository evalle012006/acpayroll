import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/PromotionOrder.css";
import api from "../api/axiosClient";

const toNum = (v) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const readUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
};

const fmtDate = (d) => (d ? String(d).slice(0, 10) : "-");

export default function PromotionOrder() {
  const navigate = useNavigate();
  const user = useMemo(() => readUser(), []);
  const isAdmin = String(user?.role || "").trim().toLowerCase() === "admin";

  const [staff, setStaff] = useState([]);
  const [branches, setBranches] = useState([]);
  const [orders, setOrders] = useState([]);

  const [loadingStaff, setLoadingStaff] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [saving, setSaving] = useState(false);

  const [showCreate, setShowCreate] = useState(false);

  const [form, setForm] = useState({
    employee_id: "",
    employee_name: "",
    old_position: "",
    new_position: "",
    old_salary: "",
    new_salary: "",
    old_ecola: "",
    new_ecola: "",
    effective_date: "",
    remarks: "",

    prev_branch_id: "",
    prev_branch_code: "",
    prev_branch_name: "",
    present_branch_id: "",
    present_branch_code: "",
    present_branch_name: "",
  });

  const branchMap = useMemo(() => {
    const m = new Map();
    (branches || []).forEach((b) => m.set(Number(b.id), b));
    return m;
  }, [branches]);

  const branchLabel = (b) => (b ? `${b.code} - ${b.name}` : "-");

  const closeModal = () => {
    setShowCreate(false);
    setForm({
      employee_id: "",
      employee_name: "",
      old_position: "",
      new_position: "",
      old_salary: "",
      new_salary: "",
      effective_date: "",
      remarks: "",

      prev_branch_id: "",
      prev_branch_code: "",
      prev_branch_name: "",
      present_branch_id: "",
      present_branch_code: "",
      present_branch_name: "",
    });
  };

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
      const res = await api.get("/promotion-orders");
      setOrders(Array.isArray(res.data) ? res.data : []);
    } catch {
      setOrders([]);
    } finally {
      setLoadingOrders(false);
    }
  }, []);

  useEffect(() => {
    loadStaff();
    loadBranches();
    loadOrders();
  }, [loadStaff, loadBranches, loadOrders]);

  // ESC close modal + lock scroll
  useEffect(() => {
    if (!showCreate) return;
    const onKey = (e) => e.key === "Escape" && closeModal();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [showCreate]);

  const onSelectEmployee = (employeeId) => {
    const s = staff.find((x) => String(x.id) === String(employeeId));
    const prevBranchId = s?.branch_id ? Number(s.branch_id) : null;
    const prevBranch = prevBranchId ? branchMap.get(prevBranchId) : null;

    // default present branch = previous branch
    setForm((p) => ({
      ...p,
      employee_id: employeeId,
      employee_name: s?.fullname || "",
      old_position: s?.position || "",
      old_salary: String(toNum(s?.salary)),
      old_ecola: String(toNum(s?.ecola)),

      prev_branch_id: prevBranchId ? String(prevBranchId) : "",
      prev_branch_code: prevBranch?.code || "",
      prev_branch_name: prevBranch?.name || "",

      present_branch_id: prevBranchId ? String(prevBranchId) : "",
      present_branch_code: prevBranch?.code || "",
      present_branch_name: prevBranch?.name || "",
    }));
  };

  const onSelectPresentBranch = (branchId) => {
    const bid = branchId ? Number(branchId) : null;
    const b = bid ? branchMap.get(bid) : null;
    setForm((p) => ({
      ...p,
      present_branch_id: branchId,
      present_branch_code: b?.code || "",
      present_branch_name: b?.name || "",
    }));
  };

  const createOrder = async (e) => {
    e.preventDefault();

    if (!form.employee_id) return alert("Select employee.");
    if (!String(form.new_position).trim()) return alert("New position is required.");
    if (!String(form.effective_date).trim()) return alert("Effective date is required.");
    if (!String(form.present_branch_id).trim()) return alert("Present branch is required.");

    const payload = {
      employee_id: Number(form.employee_id),
      employee_name: String(form.employee_name || "").trim(),
      old_position: String(form.old_position || "").trim(),
      new_position: String(form.new_position || "").trim(),
      old_salary: toNum(form.old_salary),
      new_salary: toNum(form.new_salary),
      old_ecola: toNum(form.old_ecola),
      new_ecola: toNum(form.new_ecola),

      effective_date: String(form.effective_date).slice(0, 10),
      remarks: String(form.remarks || "").trim(),

      prev_branch_id: form.prev_branch_id ? Number(form.prev_branch_id) : null,
      prev_branch_code: String(form.prev_branch_code || ""),
      prev_branch_name: String(form.prev_branch_name || ""),
      present_branch_id: form.present_branch_id ? Number(form.present_branch_id) : null,
      present_branch_code: String(form.present_branch_code || ""),
      present_branch_name: String(form.present_branch_name || ""),
    };

    try {
      setSaving(true);
      await api.post("/promotion-orders", payload);
      alert("Promotion order created (Pending).");
      closeModal();
      await loadOrders();
    } catch (err) {
      alert(err?.response?.data?.message || err.message || "Failed to create promotion order.");
    } finally {
      setSaving(false);
    }
  };

  // Optional Admin actions
  const approve = async (id) => {
    try {
      await api.put(`/promotion-orders/${id}/approve`);
      await loadOrders();
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to approve.");
    }
  };

  const reject = async (id) => {
    const reason = prompt("Enter rejection reason:");
    if (!reason || !reason.trim()) return;
    try {
      await api.put(`/promotion-orders/${id}/reject`, { reason: reason.trim() });
      await loadOrders();
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to reject.");
    }
  };

  const countText = useMemo(() => {
    const n = Array.isArray(orders) ? orders.length : 0;
    return `${n} Record${n === 1 ? "" : "s"}`;
  }, [orders]);

  const badgeClass = (status) => {
    const s = String(status || "").toLowerCase();
    if (s === "approved") return "po-badge po-approved";
    if (s === "rejected") return "po-badge po-rejected";
    return "po-badge po-pending";
  };

  const resolvePrevBranchText = (o) => {
    // Prefer fields from DB; fallback to branch map by id
    if (o.prev_branch_code || o.prev_branch_name) return `${o.prev_branch_code || ""} - ${o.prev_branch_name || ""}`.trim();
    const b = o.prev_branch_id ? branchMap.get(Number(o.prev_branch_id)) : null;
    return branchLabel(b);
  };

  const resolvePresentBranchText = (o) => {
    if (o.present_branch_code || o.present_branch_name) return `${o.present_branch_code || ""} - ${o.present_branch_name || ""}`.trim();
    const b = o.present_branch_id ? branchMap.get(Number(o.present_branch_id)) : null;
    return branchLabel(b);
  };

  return (
    <div className="po-page">
      <div className="po-topbar">
        <div>
          <h2 className="po-title">Promotion Orders</h2>
          <p className="po-subtitle">Manage staff promotions and approvals.</p>
        </div>

        <div className="po-actions">
          <button className="po-btn po-btn-ghost" type="button" onClick={() => navigate(-1)}>
            ← Back
          </button>
          <button className="po-btn po-btn-outline" type="button" onClick={loadOrders} disabled={loadingOrders}>
            {loadingOrders ? "Refreshing..." : "Refresh"}
          </button>
          <button className="po-btn po-btn-primary" type="button" onClick={() => setShowCreate(true)}>
            + Create Promotion Order
          </button>
        </div>
      </div>

      <div className="po-card">
        <div className="po-card-head">
          <div className="po-card-title">Promotion Orders</div>
          <div className="po-card-meta">{countText}</div>
        </div>

        <div className="po-table-wrap">
          <table className="po-table">
            <thead>
              <tr>
                <th>ORDER NO</th>
                <th>EMPLOYEE</th>

                <th>PREVIOUS BRANCH</th>
                <th>PRESENT BRANCH</th>

                <th>OLD POSITION</th>
                <th>NEW POSITION</th>
                <th className="num">OLD SALARY</th>
                <th className="num">NEW SALARY</th>
                <th>EFFECTIVE</th>
                <th>STATUS</th>
                <th style={{ width: 180 }}>ACTIONS</th>
              </tr>
            </thead>

            <tbody>
              {loadingOrders ? (
                <tr>
                  <td colSpan={11} className="po-empty">
                    Loading promotion orders…
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={11} className="po-empty">
                    No promotion orders found.
                  </td>
                </tr>
              ) : (
                orders.map((o) => {
                  const isPending = String(o.status || "").toLowerCase() === "pending";
                  return (
                    <tr key={o.id}>
                      <td className="mono">{o.order_no || `PRO-${o.id}`}</td>
                      <td className="td-strong">{o.employee_name}</td>

                      <td>{resolvePrevBranchText(o) || "-"}</td>
                      <td>{resolvePresentBranchText(o) || "-"}</td>

                      <td>{o.old_position || "-"}</td>
                      <td>{o.new_position || "-"}</td>
                      <td className="num">{toNum(o.old_salary).toLocaleString()}</td>
                      <td className="num">{toNum(o.new_salary).toLocaleString()}</td>
                      <td>{fmtDate(o.effective_date)}</td>
                      <td>
                        <span className={badgeClass(o.status)}>{o.status || "Pending"}</span>
                      </td>
                      <td>
                        {isAdmin && isPending ? (
                          <div className="po-row-actions">
                            <button className="po-mini-btn po-approve" type="button" onClick={() => approve(o.id)}>
                              Approve
                            </button>
                            <button className="po-mini-btn po-reject" type="button" onClick={() => reject(o.id)}>
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="po-dash">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && (
        <div className="po-modal-overlay" onMouseDown={(e) => e.target.classList.contains("po-modal-overlay") && closeModal()}>
          <div className="po-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="po-modal-head">
              <div>
                <h3 className="po-modal-title">Create Promotion Order</h3>
                <p className="po-modal-sub">Order will be Pending until approved by Admin.</p>
              </div>
              <button className="po-x" type="button" onClick={closeModal}>
                ✕
              </button>
            </div>

            <form onSubmit={createOrder} className="po-form">
              <div className="po-grid">
                <div className="po-field">
                  <label>Employee</label>
                  <select value={form.employee_id} onChange={(e) => onSelectEmployee(e.target.value)} required>
                    <option value="">{loadingStaff ? "Loading staff..." : "Select Employee"}</option>
                    {staff.map((s) => (
                      <option key={s.id} value={s.id}>
                        {(s.employee_no ? `${s.employee_no} - ` : "") + s.fullname}
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
                  <label>Previous Branch</label>
                  <input value={`${form.prev_branch_code || ""}${form.prev_branch_name ? ` - ${form.prev_branch_name}` : ""}` || ""} readOnly placeholder="Auto-filled" />
                </div>

                <div className="po-field">
                  <label>Present Branch</label>
                  <select
                    value={form.present_branch_id}
                    onChange={(e) => onSelectPresentBranch(e.target.value)}
                    required
                  >
                    <option value="">
                      {loadingBranches ? "Loading branches..." : "Select Branch"}
                    </option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.code} - {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="po-field">
                  <label>Previous Position</label>
                  <input value={form.old_position} readOnly placeholder="Auto-filled" />
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
                  <label>Previous Salary</label>
                  <input value={form.old_salary} readOnly placeholder="Auto-filled" />
                </div>

                <div className="po-field">
                  <label>New Salary</label>
                  <input
                    type="number"
                    value={form.new_salary}
                    onChange={(e) => setForm((p) => ({ ...p, new_salary: e.target.value }))}
                    placeholder="Enter new salary"
                  />
                </div>
                <div className="po-field">
                  <label>Previous Ecola</label>
                  <input value={form.old_ecola} readOnly placeholder="Auto-filled" />
                </div>

                <div className="po-field">
                  <label>New Ecola</label>
                  <input
                    type="number"
                    value={form.new_ecola}
                    onChange={(e) => setForm((p) => ({ ...p, new_ecola: e.target.value }))}
                    placeholder="Enter new ecola"
                  />
                </div>

                <div className="po-field full">
                  <label>Remarks</label>
                  <textarea
                    value={form.remarks}
                    onChange={(e) => setForm((p) => ({ ...p, remarks: e.target.value }))}
                    placeholder="Optional notes / reason"
                    rows={3}
                  />
                </div>
              </div>

              <div className="po-modal-actions">
                <button className="po-btn po-btn-ghost" type="button" onClick={closeModal}>
                  Cancel
                </button>
                <button className="po-btn po-btn-primary" type="submit" disabled={saving}>
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