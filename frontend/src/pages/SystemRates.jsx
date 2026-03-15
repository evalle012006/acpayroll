import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axiosClient";
import { useCompRates } from "../context/CompRatesContext";
import "../styles/SystemRates.css";

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const toStr = (v) => String(v ?? "").trim();

export default function SystemRates() {
  const navigate = useNavigate();
  const { rates, loading, error, refresh } = useCompRates();

  const [errLocal, setErrLocal] = useState("");

  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  }, []);

  const role = String(user?.role || "").trim().toLowerCase();
  const isAdmin = role === "admin";

  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState("view"); // view | edit | create
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  const emptyForm = {
    position: "",
    salary: "",
    ecola: "",
    transportation: "",
    cbu: "",
    cashbond: "",
    utility: "",
  };

  const [form, setForm] = useState(emptyForm);

  const err = errLocal || error;

  const openCreateModal = () => {
    setErrLocal("");
    setSelectedId(null);
    setModalMode("create");
    setForm(emptyForm);
    setShowModal(true);
  };

  const openViewModal = (row) => {
    setErrLocal("");
    setSelectedId(row.id);
    setModalMode(isAdmin ? "edit" : "view");
    setForm({
      position: row.position ?? "",
      salary: row.salary ?? 0,
      ecola: row.ecola ?? 0,
      transportation: row.transportation ?? 0,
      cbu: row.cbu ?? 0,
      cashbond: row.cashbond ?? 0,
      utility: row.utility ?? 0,
    });
    setShowModal(true);
  };

  const closeModal = () => {
    if (saving) return;
    setShowModal(false);
    setSelectedId(null);
    setForm(emptyForm);
    setModalMode("view");
    setErrLocal("");
  };

  const handleSave = async () => {
    setErrLocal("");

    try {
      setSaving(true);

      const payload = {
        position: toStr(form.position),
        salary: toNum(form.salary),
        ecola: toNum(form.ecola),
        transportation: toNum(form.transportation),
        cbu: toNum(form.cbu),
        cashbond: toNum(form.cashbond),
        utility: toNum(form.utility),
      };

      if (!payload.position) {
        setErrLocal("Position is required.");
        return;
      }

      if (modalMode === "create") {
        await api.post("/comp-rates", payload);
      } else {
        await api.put(`/comp-rates/${selectedId}`, payload);
      }

      await refresh();
      closeModal();
    } catch (e) {
      setErrLocal(e?.response?.data?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!isAdmin) return;
    if (!window.confirm("Delete this position rate?")) return;

    setErrLocal("");

    try {
      await api.delete(`/comp-rates/${id}`);
      await refresh();

      if (showModal && selectedId === id) {
        closeModal();
      }
    } catch (e) {
      setErrLocal(e?.response?.data?.message || "Failed to delete");
    }
  };

  return (
    <div className="sys-page">
      <div className="sys-header">
        <div>
          <h2 className="sys-title">Salary & Allowance Rates</h2>
          <p className="sys-subtitle">
            Manage default <b>Salary</b>, <b>ECOLA</b>, <b>Transportation</b>, <b>CBU</b>, <b>Cash Bond</b>, and <b>Utility</b> per position.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="btn-secondary" onClick={() => navigate("/system-update")}>
            ← Back
          </button>

          <button className="btn-primary" onClick={refresh} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>

          {isAdmin && (
            <button className="btn-primary" onClick={openCreateModal}>
              + Add Rate
            </button>
          )}
        </div>
      </div>

      {err && <div className="sys-error">{err}</div>}

      <div className="sys-card">
        <div className="sys-card-head">
          <div>
            <div className="sys-card-title">Position Rates</div>
            <div className="sys-card-meta">
              {loading ? "Loading..." : `${rates.length} positions`}
            </div>
          </div>
        </div>

        <div className="sys-table">
          <div className="sys-row sys-row-head">
            <div>Position</div>
            <div>Salary</div>
            <div>ECOLA</div>
            <div>Transportation</div>
            <div>CBU</div>
            <div>Cash Bond</div>
            <div>Utility</div>
            <div>Actions</div>
          </div>

          {rates.map((r) => (
            <div className="sys-row" key={r.id}>
              <div>{r.position || "-"}</div>
              <div>{r.salary ?? 0}</div>
              <div>{r.ecola ?? 0}</div>
              <div>{r.transportation ?? 0}</div>
              <div>{r.cbu ?? 0}</div>
              <div>{r.cashbond ?? 0}</div>
              <div>{r.utility ?? 0}</div>

              <div className="sys-actions">
                <button className="sys-btn" onClick={() => openViewModal(r)}>
                  {isAdmin ? "Edit" : "View"}
                </button>

                {isAdmin && (
                  <button className="sys-btn danger" onClick={() => handleDelete(r.id)}>
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}

          {!loading && rates.length === 0 && (
            <div className="sys-note">No position rates found.</div>
          )}

          {!isAdmin && (
            <div className="sys-note">
              Note: Only <b>Admin</b> can edit rates. You can view them here.
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="sys-modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && closeModal()}>
          <div className="sys-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="sys-modal-head">
              <div>
                <h3 className="sys-modal-title">
                  {modalMode === "create"
                    ? "Add Position Rate"
                    : isAdmin
                    ? "View / Edit Position Rate"
                    : "View Position Rate"}
                </h3>
                <p className="sys-modal-sub">
                  {modalMode === "create"
                    ? "Create a new default compensation rate."
                    : "Review the position compensation details."}
                </p>
              </div>

              <button className="sys-modal-close" type="button" onClick={closeModal}>
                ✕
              </button>
            </div>

            <div className="sys-modal-body">
              <div className="sys-form-grid">
                <div className="sys-field full">
                  <label>Position</label>
                  <input
                    type="text"
                    value={form.position}
                    onChange={(e) => setForm((p) => ({ ...p, position: e.target.value }))}
                    disabled={!isAdmin && modalMode !== "create"}
                  />
                </div>

                <div className="sys-field">
                  <label>Salary</label>
                  <input
                    type="number"
                    value={form.salary}
                    onChange={(e) => setForm((p) => ({ ...p, salary: e.target.value }))}
                    disabled={!isAdmin && modalMode !== "create"}
                  />
                </div>

                <div className="sys-field">
                  <label>ECOLA</label>
                  <input
                    type="number"
                    value={form.ecola}
                    onChange={(e) => setForm((p) => ({ ...p, ecola: e.target.value }))}
                    disabled={!isAdmin && modalMode !== "create"}
                  />
                </div>

                <div className="sys-field">
                  <label>Transportation</label>
                  <input
                    type="number"
                    value={form.transportation}
                    onChange={(e) => setForm((p) => ({ ...p, transportation: e.target.value }))}
                    disabled={!isAdmin && modalMode !== "create"}
                  />
                </div>

                <div className="sys-field">
                  <label>CBU</label>
                  <input
                    type="number"
                    value={form.cbu}
                    onChange={(e) => setForm((p) => ({ ...p, cbu: e.target.value }))}
                    disabled={!isAdmin && modalMode !== "create"}
                  />
                </div>

                <div className="sys-field">
                  <label>Cash Bond</label>
                  <input
                    type="number"
                    value={form.cashbond}
                    onChange={(e) => setForm((p) => ({ ...p, cashbond: e.target.value }))}
                    disabled={!isAdmin && modalMode !== "create"}
                  />
                </div>

                <div className="sys-field">
                  <label>Utility</label>
                  <input
                    type="number"
                    value={form.utility}
                    onChange={(e) => setForm((p) => ({ ...p, utility: e.target.value }))}
                    disabled={!isAdmin && modalMode !== "create"}
                  />
                </div>
              </div>

              {err && <div className="sys-error" style={{ marginTop: 14 }}>{err}</div>}
            </div>

            <div className="sys-modal-actions">
              <button className="btn-secondary" type="button" onClick={closeModal} disabled={saving}>
                Close
              </button>

              {isAdmin && (
                <button className="btn-primary" type="button" onClick={handleSave} disabled={saving}>
                  {saving
                    ? modalMode === "create"
                      ? "Creating..."
                      : "Saving..."
                    : modalMode === "create"
                    ? "Create"
                    : "Save Changes"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}