import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axiosClient";
import "../styles/AreaConfigurations.css";

const emptyForm = {
  area: "",
  region: "",
  division: "",
};

const toStr = (v) => String(v ?? "").trim();
const norm = (v) => toStr(v).toLowerCase();

export default function AreaConfigurations() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const navigate = useNavigate();

  const handle401 = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/login";
  };

  const fetchRows = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/area-configurations");
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401) return handle401();
      if (status === 403) return alert("Access denied.");
      alert(err?.response?.data?.message || "Failed to load area configurations.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  useEffect(() => {
    if (!showModal) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") closeModal();
    };

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [showModal]);

  const filtered = useMemo(() => {
    const q = norm(search);
    if (!q) return rows;

    return rows.filter(
      (r) =>
        norm(r.id).includes(q) ||
        norm(r.area).includes(q) ||
        norm(r.region).includes(q) ||
        norm(r.division).includes(q)
    );
  }, [rows, search]);

  const openAdd = () => {
    setEditId(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (row) => {
    setEditId(row.id);
    setForm({
      area: row.area || "",
      region: row.region || "",
      division: row.division || "",
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditId(null);
    setForm(emptyForm);
  };

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;

    const payload = {
      area: toStr(form.area),
      region: toStr(form.region),
      division: toStr(form.division),
    };

    if (!payload.area || !payload.region || !payload.division) {
      return alert("Area, Region, and Division are required.");
    }

    setSaving(true);
    try {
      if (editId) {
        await api.put(`/area-configurations/${editId}`, payload);
      } else {
        await api.post("/area-configurations", payload);
      }

      await fetchRows();
      closeModal();
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401) return handle401();
      if (status === 403) return alert("Access denied.");
      alert(err?.response?.data?.message || "Failed to save configuration.");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (id) => {
    if (!window.confirm("Delete this configuration?")) return;

    try {
      await api.delete(`/area-configurations/${id}`);
      await fetchRows();
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401) return handle401();
      if (status === 403) return alert("Access denied.");
      alert(err?.response?.data?.message || "Failed to delete configuration.");
    }
  };

  return (
    <div className="ac-page">
      <div className="ac-header">
        <div>
          <h2 className="ac-title">Area Configurations</h2>
          <p className="ac-subtitle">Manage area, region, and division setup.</p>
        </div>
            <div style={{ display: "flex", gap: 10 }}>
                <button
                    className="btn-secondary"
                    type="button"
                    onClick={() => navigate("/system-update")}
                >
                    ← Back
                </button>

                <button
                    className="btn-secondary"
                    onClick={fetchRows}
                    type="button"
                >
                    Refresh
                </button>

                <button
                    className="btn-primary"
                    onClick={openAdd}
                    type="button"
                >
                    + Add Configuration
                </button>
            </div>
        </div>

      <div className="ac-card">
        <div className="ac-controls">
          <input
            className="input"
            placeholder="Search by id, area, region, or division..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && setSearch(searchInput)}
          />

          <button className="btn-secondary" type="button" onClick={() => setSearch(searchInput)}>
            Search
          </button>

          <button
            className="btn-secondary"
            type="button"
            onClick={() => {
              setSearch("");
              setSearchInput("");
            }}
          >
            Clear
          </button>

          <div className="ac-pill">
            Results: <strong>{filtered.length}</strong>
          </div>
        </div>

        <div className="ac-table-wrap">
          {loading ? (
            <div className="ac-loading">Loading configurations…</div>
          ) : (
            <table className="ac-table">
              <thead>
                <tr>
                  <th style={{ width: 90 }}>ID</th>
                  <th>Area</th>
                  <th>Region</th>
                  <th>Division</th>
                  <th style={{ width: 220 }}>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="ac-empty">
                      No configurations found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((row) => (
                    <tr key={row.id}>
                      <td className="mono">{row.id}</td>
                      <td className="strong">{row.area}</td>
                      <td>{row.region}</td>
                      <td>{row.division}</td>
                      <td>
                        <div className="ac-row-actions">
                          <button className="btn-secondary" type="button" onClick={() => openEdit(row)}>
                            Edit
                          </button>
                          <button className="btn-danger" type="button" onClick={() => onDelete(row.id)}>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showModal && (
        <div
          className="modal-overlay"
          onMouseDown={(e) => e.target.classList.contains("modal-overlay") && closeModal()}
        >
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h3 className="modal-title">{editId ? "Edit Configuration" : "Add Configuration"}</h3>
                <p className="modal-subtitle">
                  {editId ? "Update the selected setup." : "Create a new area setup."}
                </p>
              </div>

              <button className="modal-x" type="button" onClick={closeModal}>
                ✕
              </button>
            </div>

            <form onSubmit={onSubmit} className="modal-form">
              <div className="grid">
                <div className="field full">
                  <label>Area</label>
                  <input className="input" name="area" value={form.area} onChange={onChange} required />
                </div>

                <div className="field">
                  <label>Region</label>
                  <input className="input" name="region" value={form.region} onChange={onChange} required />
                </div>

                <div className="field">
                  <label>Division</label>
                  <input className="input" name="division" value={form.division} onChange={onChange} required />
                </div>
              </div>

              <div className="modal-actions">
                <button className="btn-secondary" type="button" onClick={closeModal}>
                  Cancel
                </button>
                <button className="btn-primary" type="submit" disabled={saving}>
                  {saving ? "Saving..." : editId ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}