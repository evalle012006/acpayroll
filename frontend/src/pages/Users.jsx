import { useEffect, useMemo, useState } from "react";
import "../styles/Users.css";
import { FiEye, FiEyeOff } from "react-icons/fi";
import api from "../api/axiosClient";

const roleOptions = [
  "Admin",
  "Branch Manager",
  "Area Manager",
  "Regional Manager",
  "Assistant Vice President",
  "Vice President",
  "Senior Vice President",
];

const Users = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ username: "", password: "", role: "Admin", branch_id: null });

  const [showPwMap, setShowPwMap] = useState({});

  const handle401 = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/login";
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await api.get("/users");
      setRows(res.data || []);
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
    setForm({ username: "", password: "", role: "Admin", branch_id: null });
    setShowModal(true);
  };

  const openEdit = (u) => {
    setEditId(u.id);
    setForm({
      username: u.username || "",
      password: "",
      role: u.role || "Admin",
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
    setSaving(true);
    try {
      if (editId) await api.put(`/users/${editId}`, form);
      else await api.post("/users", form);

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

  const toggleRowPw = (id) => setShowPwMap((p) => ({ ...p, [id]: !p[id] }));

  const mask = (pw) => {
    const s = String(pw ?? "");
    if (!s) return "-";
    return "•".repeat(Math.min(10, s.length));
  };

  return (
    <div className="users-page">
      <div className="users-header">
        <div>
          <h2 className="users-title">Users</h2>
          <p className="users-subtitle">Add, edit, and manage user accounts</p>
        </div>
        <button className="btn-primary" onClick={openAdd} type="button">
          + Add User
        </button>
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
                  <th style={{ width: 260 }}>Password</th>
                  <th style={{ width: 220 }}>Role</th>
                  <th style={{ width: 120 }}>Branch ID</th>
                  <th style={{ width: 140 }}>Created</th>
                  <th style={{ width: 220 }}>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="empty">
                      No users found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((u) => {
                    const visible = !!showPwMap[u.id];
                    return (
                      <tr key={u.id}>
                        <td className="mono">{u.id}</td>
                        <td className="strong">{u.username}</td>

                        <td>
                          <div className="pw-cell">
                            <span className="mono">{visible ? String(u.password ?? "-") : mask(u.password)}</span>
                            <button type="button" className="pw-icon-btn" onClick={() => toggleRowPw(u.id)}>
                              {visible ? <FiEyeOff /> : <FiEye />}
                            </button>
                          </div>
                        </td>

                        <td>{u.role}</td>
                        <td className="mono">{u.branch_id ?? "-"}</td>
                        <td>{u.created_at ? String(u.created_at).split("T")[0] : "-"}</td>

                        <td>
                          <div className="row-actions">
                            <button className="btn-secondary" type="button" onClick={() => openEdit(u)}>
                              Edit
                            </button>
                            <button className="btn-danger" type="button" onClick={() => onDelete(u.id)}>
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
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
                      <option key={r} value={r}>
                        {r}
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
    </div>
  );
};

export default Users;