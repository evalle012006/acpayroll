import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axiosClient";
import "../styles/Deployments.css";
import StaffFormModal from "../components/StaffFormModal";

/* ---------------- Helpers ---------------- */
const toStr = (v) => String(v ?? "").trim();
const toDate10 = (v) => (v ? String(v).slice(0, 10) : "");
const norm = (v) => toStr(v).toLowerCase();

const displayNameParts = (s) => {
  const ln = toStr(s?.last_name);
  const fn = toStr(s?.first_name);
  const mn = toStr(s?.middle_name);
  const built = `${ln}${ln && fn ? ", " : ""}${fn}${mn ? ` ${mn}` : ""}`.replace(/\s+/g, " ").trim();
  return built || toStr(s?.fullname) || toStr(s?.employee_name) || "-";
};

export default function Deployment() {
  const navigate = useNavigate();

  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  }, []);

  const role = norm(user?.role);
  const isAdmin = role === "admin";

  const [deployments, setDeployments] = useState([]);
  const [staff, setStaff] = useState([]);
  const [branches, setBranches] = useState([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [approvingId, setApprovingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [err, setErr] = useState("");

  // deployment modal
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // view modal
  const [viewRow, setViewRow] = useState(null);

  // ✅ staff add modal (from StaffInformation features)
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);

  const emptyForm = useMemo(
    () => ({
      employee_id: "",
      last_name: "",
      first_name: "",
      middle_name: "",
      branch_id: "",
      deployment_date: "",
      details: "",
    }),
    []
  );

  const [form, setForm] = useState(emptyForm);

  /* ---------------- LOAD DATA ---------------- */
  const loadData = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const [d, s, b] = await Promise.all([api.get("/deployments"), api.get("/staff"), api.get("/branches")]);
      setDeployments(Array.isArray(d.data) ? d.data : []);
      setStaff(Array.isArray(s.data) ? s.data : []);
      setBranches(Array.isArray(b.data) ? b.data : []);
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to load deployment data.");
    } finally {
      setLoading(false);
    }
  }, []);

  // reload only staff (after adding staff inside deployment)
  const loadStaffOnly = useCallback(async () => {
    try {
      const s = await api.get("/staff");
      setStaff(Array.isArray(s.data) ? s.data : []);
    } catch {
      // do not hard fail page
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /* ---------------- ESC close modals ---------------- */
  useEffect(() => {
    const anyOpen = showFormModal || !!viewRow || showAddStaffModal;
    if (!anyOpen) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        closeFormModal();
        closeViewModal();
        setShowAddStaffModal(false);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showFormModal, viewRow, showAddStaffModal]);

  /* ---------------- Branch label ---------------- */
  const branchLabel = useCallback(
    (branchId) => {
      const b = branches.find((x) => String(x.id) === String(branchId));
      if (!b) return String(branchId || "-");
      // ✅ show name (your request), but keep code visible as context in orders
      return `${b.name}`.trim();
    },
    [branches]
  );

  /* ---------------- SELECT EMPLOYEE ---------------- */
  const selectedEmployee = useMemo(() => {
    return staff.find((x) => String(x.id) === String(form.employee_id)) || null;
  }, [staff, form.employee_id]);

  const onSelectEmployee = (id) => {
    const emp = staff.find((x) => String(x.id) === String(id));
    setForm((p) => ({
      ...p,
      employee_id: id,
      last_name: toStr(emp?.last_name),
      first_name: toStr(emp?.first_name),
      middle_name: toStr(emp?.middle_name),
    }));
  };

  /* ---------------- Modal helpers ---------------- */
  const openCreate = () => {
    setErr("");
    setEditingId(null);
    setForm(emptyForm);
    setShowFormModal(true);
  };

  const openEdit = (d) => {
    const statusLower = norm(d?.status || "pending");
    if (statusLower === "approved") return alert("Approved deployments cannot be edited.");

    setErr("");
    setEditingId(d.id);
    setForm({
      employee_id: d.employee_id ?? "",
      last_name: d.last_name ?? "",
      first_name: d.first_name ?? "",
      middle_name: d.middle_name ?? "",
      branch_id: d.branch_id ?? "",
      deployment_date: toDate10(d.deployment_date),
      details: toStr(d.details ?? ""),
    });
    setShowFormModal(true);
  };

  const closeFormModal = () => {
    setShowFormModal(false);
    setEditingId(null);
    setForm(emptyForm);
    setErr("");
    setSaving(false);
  };

  const openViewModal = async (d) => {
    setErr("");
    try {
      const res = await api.get(`/deployments/${d.id}`);
      setViewRow(res.data || d);
    } catch {
      setViewRow(d);
    }
  };

  const closeViewModal = () => setViewRow(null);

  /* ---------------- CREATE / UPDATE ---------------- */
  const saveDeployment = async (e) => {
    e.preventDefault();
    if (saving) return;

    setErr("");

    const employeeId = Number(form.employee_id);
    const branchId = Number(form.branch_id);

    if (!employeeId) return setErr("Employee is required.");
    if (!branchId) return setErr("Deployment branch is required.");
    if (!form.deployment_date) return setErr("Deployment date is required.");

    setSaving(true);
    try {
      const payload = {
        employee_id: employeeId,
        branch_id: branchId,
        deployment_date: toDate10(form.deployment_date),
        details: toStr(form.details) || null,
      };

      if (editingId) await api.put(`/deployments/${editingId}`, payload);
      else await api.post("/deployments", payload);

      closeFormModal();
      await loadData();
    } catch (e2) {
      setErr(e2?.response?.data?.message || "Failed to save deployment.");
    } finally {
      setSaving(false);
    }
  };

  /* ---------------- APPROVE ---------------- */
  const approveDeployment = async (d) => {
    if (!isAdmin) return alert("Admin only.");

    const statusLower = norm(d?.status || "pending");
    if (statusLower !== "pending") return;

    const ok = window.confirm(
      `Approve this deployment?\n\nEmployee: ${d.employee_name || displayNameParts(d)}\nTo Branch: ${
        d.branch_name ? d.branch_name : branchLabel(d.branch_id)
      }\nDate: ${toDate10(d.deployment_date)}\n\nThis will UPDATE staff.branch_id.`
    );
    if (!ok) return;

    setApprovingId(d.id);
    setErr("");
    try {
      const res = await api.put(`/deployments/${d.id}/approve`);
      const updated = res.data;
      setDeployments((prev) => prev.map((x) => (x.id === d.id ? updated : x)));
      // staff branch updated -> refresh staff list
      loadStaffOnly();
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to approve deployment.");
    } finally {
      setApprovingId(null);
    }
  };

  /* ---------------- DELETE ---------------- */
  const deleteDeployment = async (d) => {
    if (!isAdmin) return alert("Admin only.");
    if (!d?.id) return;

    const statusLower = norm(d?.status || "pending");
    if (statusLower === "approved") return alert("Approved deployments cannot be deleted (recommended).");

    const ok = window.confirm(
      `Delete this deployment?\n\nEmployee: ${d.employee_name || displayNameParts(d)}\nBranch: ${
        d.branch_name ? d.branch_name : branchLabel(d.branch_id)
      }\nDate: ${toDate10(d.deployment_date)}`
    );
    if (!ok) return;

    setDeletingId(d.id);
    setErr("");
    try {
      await api.delete(`/deployments/${d.id}`);
      setDeployments((prev) => prev.filter((x) => x.id !== d.id));
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to delete deployment.");
    } finally {
      setDeletingId(null);
    }
  };

  /* ---------------- ADD STAFF (inside Deployment) ---------------- */
  const createStaffFromDeployment = async ({ payload, photoFile }) => {
    // same behavior as StaffInformation save
    const res = await api.post("/staff", payload);
    const newId = res.data?.id;

    if (photoFile && newId) {
      const fd = new FormData();
      fd.append("photo", photoFile);
      await api.post(`/staff/${newId}/photo`, fd);
    }

    // refresh staff so it appears in employee dropdown
    await loadStaffOnly();

    alert("Staff saved. You can now select the new staff in the Deployment form.");
  };

  const modalTitle = editingId ? "Edit Deployment" : "Create Deployment";

  return (
    <div className="po-page">
      <div className="po-topbar">
        <h2 className="po-title">Deployment Orders</h2>

        <div className="po-topbar-actions">
          <button className="po-btn" type="button" onClick={() => navigate("/transactions")}>
            ← Back
          </button>

          <button className="po-btn" type="button" onClick={loadData} disabled={loading}>
            Refresh
          </button>

          {/* ✅ this now means: create deployment order */}
          <button className="po-btn po-btn-primary" type="button" onClick={openCreate}>
            + Create Deployment
          </button>

          {/* ✅ this is your new: Add Staff with same features */}
          <button className="po-btn" type="button" onClick={() => setShowAddStaffModal(true)}>
            + Add Staff
          </button>
        </div>
      </div>

      {err ? <div style={{ marginBottom: 12, color: "#ef4444", fontWeight: 800 }}>{err}</div> : null}

      <div className="po-card">
        <table className="po-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Deployment Branch</th>
              <th>Date</th>
              <th style={{ width: 320 }}>Details / Remarks</th>
              <th style={{ width: 320 }}>Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={{ padding: 16, opacity: 0.8 }}>
                  Loading...
                </td>
              </tr>
            ) : deployments.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: 16, opacity: 0.8 }}>
                  No deployment orders found.
                </td>
              </tr>
            ) : (
              deployments.map((d) => {
                const statusLower = norm(d?.status || "pending");
                const pending = statusLower === "pending";

                const branchText = d.branch_name ? `${d.branch_name}` : branchLabel(d.branch_id);

                return (
                  <tr key={d.id}>
                    <td>
                      <div className="td-strong">{d.employee_name || displayNameParts(d)}</div>
                      <div style={{ fontSize: 12, opacity: 0.8 }}>
                        ID: <span className="mono">{d.employee_id}</span>
                        {d.status ? (
                          <>
                            {" "}
                            • <span className="mono">{d.status}</span>
                          </>
                        ) : null}
                      </div>
                    </td>

                    <td>{branchText}</td>
                    <td className="mono">{toDate10(d.deployment_date) || "-"}</td>

                    <td title={toStr(d.details)}>
                      {toStr(d.details) ? toStr(d.details) : <span style={{ opacity: 0.75 }}>-</span>}
                    </td>

                    <td>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button className="po-mini-btn" type="button" onClick={() => openEdit(d)} disabled={!pending}>
                          Edit
                        </button>

                        <button className="po-mini-btn" type="button" onClick={() => openViewModal(d)}>
                          View
                        </button>

                        {isAdmin && (
                          <>
                            <button
                              className="po-mini-btn"
                              type="button"
                              onClick={() => approveDeployment(d)}
                              disabled={!pending || approvingId === d.id}
                              title={!pending ? "Only pending can be approved" : "Approve"}
                            >
                              {approvingId === d.id ? "Approving..." : "Approve"}
                            </button>

                            <button
                              className="po-mini-btn"
                              type="button"
                              onClick={() => deleteDeployment(d)}
                              disabled={!pending || deletingId === d.id}
                              title={!pending ? "Only pending can be deleted" : "Delete"}
                            >
                              {deletingId === d.id ? "Deleting..." : "Delete"}
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

      {/* ✅ ADD STAFF MODAL (same as StaffInformation) */}
      <StaffFormModal
        open={showAddStaffModal}
        mode="add"
        branches={branches}
        onClose={() => setShowAddStaffModal(false)}
        onSubmit={createStaffFromDeployment}
      />

      {/* CREATE / EDIT DEPLOYMENT MODAL */}
      {showFormModal && (
        <div className="po-modal-overlay" onMouseDown={(e) => e.target.classList.contains("po-modal-overlay") && closeFormModal()}>
          <div className="po-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0 }}>{modalTitle}</h3>
              <button className="po-x" type="button" onClick={closeFormModal}>
                ✕
              </button>
            </div>

            <form onSubmit={saveDeployment} className="po-form">
              <div className="po-field">
                <label>Employee</label>
                <select value={form.employee_id} onChange={(e) => onSelectEmployee(e.target.value)} disabled={!!editingId}>
                  <option value="">Select Employee</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.id} - {displayNameParts(s)} {s.employee_no ? `(${s.employee_no})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="po-grid">
                <div className="po-field">
                  <label>Employee ID</label>
                  <input value={form.employee_id || ""} readOnly />
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
              </div>

              <div className="po-field">
                <label>Deployment Branch</label>
                <select value={form.branch_id} onChange={(e) => setForm((p) => ({ ...p, branch_id: e.target.value }))}>
                  <option value="">Select Branch</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="po-field">
                <label>Date of Deployment</label>
                <input
                  type="date"
                  value={form.deployment_date}
                  onChange={(e) => setForm((p) => ({ ...p, deployment_date: e.target.value }))}
                />
              </div>

              <div className="po-field">
                <label>Details / Remarks</label>
                <input value={form.details} onChange={(e) => setForm((p) => ({ ...p, details: e.target.value }))} placeholder="Type details..." />
              </div>

              {selectedEmployee ? (
                <div style={{ fontSize: 12, opacity: 0.85, marginTop: 6 }}>
                  Preview: <b>{displayNameParts(selectedEmployee)}</b> → <b>{branchLabel(form.branch_id) || "—"}</b> on <b>{form.deployment_date || "—"}</b>
                </div>
              ) : null}

              {err ? <div style={{ marginTop: 10, color: "#ef4444", fontWeight: 800 }}>{err}</div> : null}

              <div className="po-modal-actions">
                <button className="po-btn" type="button" onClick={closeFormModal} disabled={saving}>
                  Cancel
                </button>
                <button className="po-btn po-btn-primary" type="submit" disabled={saving}>
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW DEPLOYMENT MODAL */}
      {viewRow && (
        <div className="po-modal-overlay" onMouseDown={(e) => e.target.classList.contains("po-modal-overlay") && closeViewModal()}>
          <div className="po-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0 }}>View Deployment</h3>
              <button className="po-x" type="button" onClick={closeViewModal}>
                ✕
              </button>
            </div>

            <div className="po-form">
              <div className="po-grid">
                <div className="po-field">
                  <label>Employee ID</label>
                  <input value={viewRow.employee_id ?? ""} readOnly />
                </div>
                <div className="po-field">
                  <label>Last Name</label>
                  <input value={toStr(viewRow.last_name)} readOnly />
                </div>
                <div className="po-field">
                  <label>First Name</label>
                  <input value={toStr(viewRow.first_name)} readOnly />
                </div>
                <div className="po-field">
                  <label>Middle Name</label>
                  <input value={toStr(viewRow.middle_name)} readOnly />
                </div>
              </div>

              <div className="po-field">
                <label>Deployment Branch</label>
                <input value={viewRow.branch_name ? `${viewRow.branch_name}` : branchLabel(viewRow.branch_id)} readOnly />
              </div>

              <div className="po-field">
                <label>Date of Deployment</label>
                <input value={toDate10(viewRow.deployment_date) || "-"} readOnly />
              </div>

              <div className="po-field">
                <label>Status</label>
                <input value={toStr(viewRow.status || "Pending")} readOnly />
              </div>

              <div className="po-field">
                <label>Details / Remarks</label>
                <input value={toStr(viewRow.details || "-")} readOnly />
              </div>

              <div className="po-modal-actions">
                <button className="po-btn po-btn-primary" type="button" onClick={closeViewModal}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}