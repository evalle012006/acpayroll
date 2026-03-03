import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axiosClient";
import { useCompRates } from "../context/CompRatesContext";
import "../styles/SystemRates.css";

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

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

  const [newRow, setNewRow] = useState({
    position: "",
    salary: "",
    ecola: "",
    transportation: "",
  });

  const [drafts, setDrafts] = useState({});

  const mergedRates = useMemo(() => {
    return rates.map((r) => ({ ...r, ...(drafts[r.id] || {}) }));
  }, [rates, drafts]);

  const setDraft = (id, patch) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || {}), ...patch },
    }));
  };

  const saveRate = async (row) => {
    setErrLocal("");
    try {
      await api.put(`/comp-rates/${row.id}`, {
        position: String(row.position || "").trim(),
        salary: toNum(row.salary),
        ecola: toNum(row.ecola),
        transportation: toNum(row.transportation),
      });

      setDrafts((prev) => {
        const copy = { ...prev };
        delete copy[row.id];
        return copy;
      });

      await refresh();
    } catch (e) {
      setErrLocal(e?.response?.data?.message || "Failed to update");
    }
  };

  const deleteRate = async (id) => {
    if (!window.confirm("Delete this position rate?")) return;
    setErrLocal("");

    try {
      await api.delete(`/comp-rates/${id}`);

      setDrafts((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });

      await refresh();
    } catch (e) {
      setErrLocal(e?.response?.data?.message || "Failed to delete");
    }
  };

  const createRate = async () => {
    setErrLocal("");
    try {
      await api.post("/comp-rates", {
        position: String(newRow.position || "").trim(),
        salary: toNum(newRow.salary),
        ecola: toNum(newRow.ecola),
        transportation: toNum(newRow.transportation),
      });

      setNewRow({
        position: "",
        salary: "",
        ecola: "",
        transportation: "",
      });

      await refresh();
    } catch (e) {
      setErrLocal(e?.response?.data?.message || "Failed to create");
    }
  };

  const err = errLocal || error;

  return (
    <div className="sys-page">
      <div className="sys-header">
        <div>
          <h2 className="sys-title">Salary & Allowance Rates</h2>
          <p className="sys-subtitle">
            Manage default <b>Salary</b>, <b>ECOLA</b>, and{" "}
            <b>Transportation</b> per position.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            className="btn-secondary"
            onClick={() => navigate("/system-update")}
          >
            ← Back
          </button>

          <button
            className="btn-primary"
            onClick={refresh}
            disabled={loading}
          >
            Refresh
          </button>
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
            <div>Actions</div>
          </div>

          {mergedRates.map((r) => (
            <div className="sys-row" key={r.id}>
                <input value={r.position ?? ""} onChange={(e) => setDraft(r.id, { position: e.target.value })} disabled={!isAdmin}/>
                <input value={r.salary ?? 0} onChange={(e) => setDraft(r.id, { salary: e.target.value })} disabled={!isAdmin}/>
                <input value={r.ecola ?? 0} onChange={(e) => setDraft(r.id, { ecola: e.target.value })} disabled={!isAdmin}/>
                <input value={r.transportation ?? 0} onChange={(e) => setDraft(r.id, { transportation: e.target.value })} disabled={!isAdmin}/>

            <div className="sys-actions">
                <button className="sys-btn" onClick={() => saveRate(r)} disabled={!isAdmin}>
                  Save
                </button>

                <button className="sys-btn danger" onClick={() => deleteRate(r.id)} disabled={!isAdmin}>
                  Delete
                </button>
              </div>
            </div>
          ))}

          <div className="sys-row sys-row-new">
            <input
              placeholder="New position..."
              value={newRow.position}
              onChange={(e) =>
                setNewRow((p) => ({ ...p, position: e.target.value }))
              }
              disabled={!isAdmin}
            />

            <input
              placeholder="0"
              value={newRow.salary}
              onChange={(e) =>
                setNewRow((p) => ({ ...p, salary: e.target.value }))
              }
              disabled={!isAdmin}
            />

            <input
              placeholder="0"
              value={newRow.ecola}
              onChange={(e) =>
                setNewRow((p) => ({ ...p, ecola: e.target.value }))
              }
              disabled={!isAdmin}
            />

            <input
              placeholder="0"
              value={newRow.transportation}
              onChange={(e) =>
                setNewRow((p) => ({
                  ...p,
                  transportation: e.target.value,
                }))
              }
              disabled={!isAdmin}
            />

            <div className="sys-actions">
              <button
                className="sys-btn"
                onClick={createRate}
                disabled={!isAdmin}
              >
                Add
              </button>
            </div>
          </div>

          {!isAdmin && (
            <div className="sys-note">
              Note: Only <b>Admin</b> can edit rates. You can view them here.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}