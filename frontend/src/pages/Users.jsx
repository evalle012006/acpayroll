import { useEffect, useMemo, useState } from "react";
import "../styles/Users.css";
import api from "../api/axiosClient";

const roleOptions = [
  { label: "Admin", value: "admin" },
  { label: "Branch Manager", value: "branch manager" },
  { label: "Area Manager", value: "area manager" },
  { label: "Regional Manager", value: "regional manager" },
  { label: "Assistant Vice President", value: "assistant vice president" },
  { label: "Vice President", value: "vice president" },
  { label: "Senior Vice President", value: "senior vice president" },
];

const Users = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({
    username: "",
    password: "",
    role: "admin",
    branch_id: null,
  });

  // reset password modal
  const [resetId, setResetId] = useState(null);
  const [resetUser, setResetUser] = useState(null);
  const [resetPw, setResetPw] = useState("");
  const [resetSaving, setResetSaving] = useState(false);

  const handle401 = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/login";
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await api.get("/users");
      // backend returns: {id, username, role, created_at, branch_id}
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401) return handle401();
      if (status === 403) return alert("Access denied.");
      alert(err?.response?.data?.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // escape key closes any modal
  useEffect(() => {
    if (!showModal && !resetId) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        if (resetId) closeReset();
        else closeModal();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [showModal, resetId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        String(r.username || "").toLowerCase().includes(q) ||
        String(r.role || "").toLowerCase().includes(q) ||
        String(r.id || "").toLowerCase().includes(q)
    );
  }, [rows, search]);

  const openAdd = () => {
    setEditId(null);
    setForm({ username: "", password: "", role: "admin", branch_id: null });
    setShowModal(true);
  };

  const openEdit = (u) => {
    setEditId(u.id);
    setForm({
      username: u.username || "",
      password: "",
      role: String(u.role || "admin").toLowerCase(),
      branch_id: u.branch_id ?? null,
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditId(null);
  };

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;

    setSaving(true);
    try {
      const payload = {
        username: String(form.username || "").trim(),
        role: String(form.role || "").trim().toLowerCase(),
        branch_id: form.branch_id === "" ? null : form.branch_id ?? null,
      };

      // password optional on edit
      if (!editId) {
        payload.password = String(form.password || "");
      } else if (String(form.password || "").trim() !== "") {
        payload.password = String(form.password || "");
      }

      if (editId) await api.put(`/users/${editId}`, payload);
      else await api.post("/users", payload);

      await fetchUsers();
      closeModal();
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401) return handle401();
      if (status === 403) return alert("Access denied.");
      alert(err?.response?.data?.message || "Failed to save user");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (id) => {
    if (!window.confirm("Delete this user?")) return;
    try {
      await api.delete(`/users/${id}`);
      await fetchUsers();
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401) return handle401();
      if (status === 403) return alert("Access denied.");
      alert(err?.response?.data?.message || "Failed to delete user");
    }
  };

  // ---------------- RESET PASSWORD ----------------
  const openReset = (u) => {
    setResetId(u.id);
    setResetUser(u);
    setResetPw("");
  };

  const closeReset = () => {
    setResetId(null);
    setResetUser(null);
    setResetPw("");
  };

  const submitReset = async (e) => {
    e.preventDefault();
    if (resetSaving) return;

    const pw = String(resetPw || "").trim();
    if (pw.length < 6) return alert("Password must be at least 6 characters.");

    setResetSaving(true);
    try {
      await api.put(`/users/${resetId}/reset-password`, { new_password: pw });
      closeReset();
      alert("Password reset successfully.");
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401) return handle401();
      if (status === 403) return alert("Access denied.");
      alert(err?.response?.data?.message || "Failed to reset password");
    } finally {
      setResetSaving(false);
    }
  };

  const roleLabel = (value) => {
    const found = roleOptions.find((r) => r.value === String(value || "").toLowerCase());
    return found ? found.label : String(value || "");
  };

  return (
    <div className="users-page">
      <div className="users-header">
        <div>
          <h2 className="users-title">Users</h2>
          <p className="users-subtitle">Add, edit, and manage user accounts</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn-secondary" onClick={fetchUsers} type="button">
            Refresh
          </button>
          <button className="btn-primary" onClick={openAdd} type="button">
            + Add User
          </button>
        </div>
      </div>

      <div className="users-card">
        <div className="users-controls">
          <input
            className="input"
            placeholder="Search by id, username, or role..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="pill">
            Results: <strong>{filtered.length}</strong>
          </div>
        </div>

        <div className="table-wrap">
          {loading ? (
            <div className="loading">Loading users…</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 90 }}>ID</th>
                  <th>Username</th>
                  <th style={{ width: 220 }}>Role</th>
                  <th style={{ width: 120 }}>Branch ID</th>
                  <th style={{ width: 140 }}>Created</th>
                  <th style={{ width: 320 }}>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="empty">
                      No users found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((u) => (
                    <tr key={u.id}>
                      <td className="mono">{u.id}</td>
                      <td className="strong">{u.username}</td>
                      <td>{roleLabel(u.role)}</td>
                      <td className="mono">{u.branch_id ?? "-"}</td>
                      <td>{u.created_at ? String(u.created_at).split("T")[0] : "-"}</td>

                      <td>
                        <div className="row-actions">
                          <button className="btn-secondary" type="button" onClick={() => openEdit(u)}>
                            Edit
                          </button>

                          <button className="btn-secondary" type="button" onClick={() => openReset(u)}>
                            Reset Password
                          </button>

                          <button className="btn-danger" type="button" onClick={() => onDelete(u.id)}>
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

      {/* ADD/EDIT MODAL */}
      {showModal && (
        <div
          className="modal-overlay"
          onMouseDown={(e) => e.target.classList.contains("modal-overlay") && closeModal()}
        >
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h3 className="modal-title">{editId ? "Edit User" : "Add User"}</h3>
                <p className="modal-subtitle">
                  {editId ? "Leave password blank to keep current password." : "Create a new account."}
                </p>
              </div>
              <button className="modal-x" type="button" onClick={closeModal}>
                ✕
              </button>
            </div>

            <form onSubmit={onSubmit} className="modal-form">
              <div className="grid">
                <div className="field">
                  <label>Username</label>
                  <input className="input" name="username" value={form.username} onChange={onChange} required />
                </div>

                <div className="field">
                  <label>Role</label>
                  <select className="input" name="role" value={form.role} onChange={onChange} required>
                    {roleOptions.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label>Branch ID (required for Branch Manager)</label>
                  <input
                    className="input"
                    name="branch_id"
                    value={form.branch_id ?? ""}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        branch_id: e.target.value === "" ? null : Number(e.target.value),
                      }))
                    }
                    placeholder="e.g. 1"
                  />
                </div>

                <div className="field full">
                  <label>Password</label>
                  <input
                    className="input"
                    name="password"
                    type="password"
                    value={form.password}
                    onChange={onChange}
                    placeholder={editId ? "(leave blank to keep current)" : "Enter password"}
                    required={!editId}
                  />
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

      {/* RESET PASSWORD MODAL */}
      {resetId && (
        <div
          className="modal-overlay"
          onMouseDown={(e) => e.target.classList.contains("modal-overlay") && closeReset()}
        >
          <div className="modal confirm-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h3 className="modal-title">Reset Password</h3>
                <p className="modal-subtitle">
                  Set a new password for <b>{resetUser?.username}</b>
                </p>
              </div>
              <button className="modal-x" type="button" onClick={closeReset}>
                ✕
              </button>
            </div>

            <form onSubmit={submitReset} className="modal-form">
              <div className="grid">
                <div className="field full">
                  <label>New Password</label>
                  <input
                    className="input"
                    type="password"
                    value={resetPw}
                    onChange={(e) => setResetPw(e.target.value)}
                    placeholder="Minimum 6 characters"
                    required
                  />
                </div>
              </div>

              <div className="modal-actions">
                <button className="btn-secondary" type="button" onClick={closeReset} disabled={resetSaving}>
                  Cancel
                </button>
                <button className="btn-primary" type="submit" disabled={resetSaving}>
                  {resetSaving ? "Resetting..." : "Reset Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;