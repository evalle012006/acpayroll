import { useEffect, useMemo, useState } from "react";
import "../styles/Users.css";
import api from "../api/axiosClient";
import { RxReset } from "react-icons/rx";
import { MdDelete } from "react-icons/md";
import { FaEdit } from "react-icons/fa";

const roleOptions = [
  { label: "Admin", value: "admin" },
  { label: "IT", value: "it" },
  { label: "Hr", value: "hr" },
  { label: "Accounting", value: "accounting" },
  { label: "Branch Manager", value: "branch manager" },
  { label: "Area Manager", value: "area manager" },
  { label: "Regional Manager", value: "regional manager" },
  { label: "Assistant Vice President", value: "assistant vice president" },
  { label: "Vice President", value: "vice president" },
  { label: "Senior Vice President", value: "senior vice president" },
  { label: "President", value: "president" },
  { label: "Tread", value: "tread" },
];

const departmentOptions = [
  "OPERATION DEPARTMENT",
  "HR DEPARTMENT",
  "ACCOUNTING DEPARTMENT",
  "IT DEPARTMENT",
  "AUDIT DEPARTMENT",
  "TREAD DEPARTMENT",
  "PRODUCTION & LOGISTIC DEPARTMENT",
  "OFFICE OF THE PRESIDENT",
];

const emptyForm = {
  username: "",
  password: "",
  role: "admin",
  branch_id: "",
  area: "",
  region: "",
  division: "",
  first_name: "",
  middle_name: "",
  last_name: "",
  department: "",
  department_scopes: [],
  status: "Active",
};

const toStr = (v) => String(v ?? "").trim();

const Users = () => {
  const [rows, setRows] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(false);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const [branchSearch, setBranchSearch] = useState("");
  const [areaSearch, setAreaSearch] = useState("");
  const [regionSearch, setRegionSearch] = useState("");
  const [divisionSearch, setDivisionSearch] = useState("");
  const [scopeDepartment, setScopeDepartment] = useState("");
  const addDepartmentScope = () => {
  const department = String(scopeDepartment || "").trim();
    if (!department) return;

    setForm((prev) => {
      const current = Array.isArray(prev.department_scopes)
        ? prev.department_scopes
        : [];

      const exists = current.some(
        (x) =>
          String(x).trim().toLowerCase() ===
          department.toLowerCase()
      );

      if (exists) return prev;

      return {
        ...prev,
        department_scopes: [...current, department],
      };
    });

    setScopeDepartment("");
  };

  const removeDepartmentScope = (department) => {
    const isPrimary =
      String(form.department || "").trim().toLowerCase() ===
      String(department || "").trim().toLowerCase();

    if (isPrimary) return;

    setForm((prev) => ({
      ...prev,
      department_scopes: (prev.department_scopes || []).filter(
        (x) =>
          String(x).trim().toLowerCase() !==
          String(department).trim().toLowerCase()
      ),
    }));
  };

  const [showBranchOptions, setShowBranchOptions] = useState(false);
  const [showAreaOptions, setShowAreaOptions] = useState(false);
  const [showRegionOptions, setShowRegionOptions] = useState(false);
  const [showDivisionOptions, setShowDivisionOptions] = useState(false);

  const handle401 = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/login";
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await api.get("/users");
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

  const fetchBranches = async () => {
    try {
      const res = await api.get("/branches");
      setBranches(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401) return handle401();
      if (status === 403) return;
      console.error(err?.response?.data?.message || "Failed to load branches");
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchBranches();
  }, []);

  useEffect(() => {
    if (!showModal) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        closeModal();
      }
    };

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
        String(r.id || "").toLowerCase().includes(q) ||
        String(r.username || "").toLowerCase().includes(q) ||
        String(r.role || "").toLowerCase().includes(q) ||
        String(r.branch_id || "").toLowerCase().includes(q) ||
        String(r.branch_name || "").toLowerCase().includes(q) ||
        String(r.area || "").toLowerCase().includes(q) ||
        String(r.region || "").toLowerCase().includes(q) ||
        String(r.division || "").toLowerCase().includes(q) ||
        String(r.first_name || "").toLowerCase().includes(q) ||
        String(r.middle_name || "").toLowerCase().includes(q) ||
        String(r.last_name || "").toLowerCase().includes(q) ||
        String(r.department || "").toLowerCase().includes(q)
    );
  }, [rows, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [search, pageSize]);

  const uniqueAreas = useMemo(() => {
    const set = new Set(rows.map((r) => toStr(r.area)).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const uniqueRegions = useMemo(() => {
    const set = new Set(rows.map((r) => toStr(r.region)).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const uniqueDivisions = useMemo(() => {
    const set = new Set(rows.map((r) => toStr(r.division)).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const filteredBranches = useMemo(() => {
    const q = branchSearch.trim().toLowerCase();
    if (!q) return branches;

    return branches.filter(
      (b) =>
        String(b.name || "").toLowerCase().includes(q) ||
        String(b.code || "").toLowerCase().includes(q)
    );
  }, [branches, branchSearch]);

  const filteredAreas = useMemo(() => {
    const q = areaSearch.trim().toLowerCase();
    if (!q) return uniqueAreas;
    return uniqueAreas.filter((x) => x.toLowerCase().includes(q));
  }, [uniqueAreas, areaSearch]);

  const filteredRegions = useMemo(() => {
    const q = regionSearch.trim().toLowerCase();
    if (!q) return uniqueRegions;
    return uniqueRegions.filter((x) => x.toLowerCase().includes(q));
  }, [uniqueRegions, regionSearch]);

  const filteredDivisions = useMemo(() => {
    const q = divisionSearch.trim().toLowerCase();
    if (!q) return uniqueDivisions;
    return uniqueDivisions.filter((x) => x.toLowerCase().includes(q));
  }, [uniqueDivisions, divisionSearch]);

  const openAdd = () => {
    setEditId(null);
    setForm(emptyForm);
    setBranchSearch("");
    setAreaSearch("");
    setRegionSearch("");
    setDivisionSearch("");
    setShowBranchOptions(false);
    setShowAreaOptions(false);
    setShowRegionOptions(false);
    setShowDivisionOptions(false);
    setShowModal(true);
    setScopeDepartment("");
  };

  const openEdit = (u) => {
    setEditId(u.id);
    setForm({
      username: u.username || "",
      password: "",
      role: String(u.role || "admin").toLowerCase(),
      branch_id: String(u.branch_id || ""),
      area: u.area || "",
      region: u.region || "",
      division: u.division || "",
      first_name: u.first_name || "",
      middle_name: u.middle_name || "",
      last_name: u.last_name || "",
      department: u.department || "",
      department_scopes: Array.isArray(u.department_scopes)
        ? u.department_scopes
        : u.department
        ? [u.department]
        : [],
      status: u.status || "Active",
    });

    setBranchSearch(u.branch_name || "");
    setAreaSearch(u.area || "");
    setRegionSearch(u.region || "");
    setDivisionSearch(u.division || "");
    setShowBranchOptions(false);
    setShowAreaOptions(false);
    setShowRegionOptions(false);
    setShowDivisionOptions(false);
    setShowModal(true);
    setScopeDepartment("");
  };

  const closeModal = () => {
    setShowModal(false);
    setEditId(null);
    setShowBranchOptions(false);
    setShowAreaOptions(false);
    setShowRegionOptions(false);
    setShowDivisionOptions(false);
  };

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  };

  const toggleDepartmentScope = (department) => {
    setForm((prev) => {
      const current = Array.isArray(prev.department_scopes)
        ? prev.department_scopes
        : [];

      const exists = current.some(
        (x) =>
          String(x).trim().toLowerCase() ===
          String(department).trim().toLowerCase()
      );

      return {
        ...prev,
        department_scopes: exists
          ? current.filter(
              (x) =>
                String(x).trim().toLowerCase() !==
                String(department).trim().toLowerCase()
            )
          : [...current, department],
      };
    });
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;

    const normalizedRole = String(form.role || "").trim().toLowerCase();

    if (!form.branch_id) {
      alert("Please select a valid branch from the list.");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        username: String(form.username || "").trim(),
        role: normalizedRole,
        branch_id: String(form.branch_id || "").trim(),
        area: String(form.area || "").trim(),
        region: String(form.region || "").trim(),
        division: String(form.division || "").trim(),
        first_name: String(form.first_name || "").trim(),
        middle_name: String(form.middle_name || "").trim(),
        last_name: String(form.last_name || "").trim(),
        department: String(form.department || "").trim(),

        department_scopes: Array.isArray(form.department_scopes)
          ? form.department_scopes
          : [],

        status: form.status,
      };

      if (!editId) {
        payload.password = String(form.password || "");
      } else if (String(form.password || "").trim() !== "") {
        payload.password = String(form.password || "");
      }

      console.log("USER PAYLOAD:", payload);

      if (editId) {
        await api.put(`/users/${editId}`, payload);
      } else {
        await api.post("/users", payload);
      }

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

  const toggleStatus = async (user) => {
    const newStatus =
      user.status === "Active"
        ? "Inactive"
        : "Active";

    if (
      !window.confirm(
        `Change ${user.username} to ${newStatus}?`
      )
    ) {
      return;
    }

    try {
      await api.put(`/users/${user.id}/status`, {
        status: newStatus,
      });

      await fetchUsers();
    } catch (err) {
      const status = err?.response?.status;

      if (status === 401) return handle401();

      alert(
        err?.response?.data?.message ||
          "Failed to update status."
      );
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

  const requirePasswordReset = async (user) => {
    const confirmed = window.confirm(
      `Require ${user.username} to create a new password on their next login?`
    );

    if (!confirmed) {
      return;
    }

    try {
      await api.put(
        `/users/${user.id}/require-password-reset`
      );

      await fetchUsers();

      alert(
        `${user.username} must create a new password on their next login.`
      );
    } catch (err) {
      const status = err?.response?.status;

      if (status === 401) {
        return handle401();
      }

      if (status === 403) {
        return alert("Access denied.");
      }

      alert(
        err?.response?.data?.message ||
          "Failed to require password reset."
      );
    }
  };

  const roleLabel = (value) => {
    const found = roleOptions.find(
      (r) => r.value === String(value || "").toLowerCase()
    );

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
            placeholder="Search by id, username, name, department, role, branch, area, region, division..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div className="pill">
            Results: <strong>{filtered.length}</strong> • Showing{" "}
            <strong>{pagedRows.length}</strong>
          </div>
        </div>

        <div className="table-wrap">
          {loading ? (
            <div className="loading">Loading users…</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 80 }}>ID</th>
                  <th style={{ width: 150 }}>Username</th>
                  <th style={{ width: 150 }}>First Name</th>
                  <th style={{ width: 150 }}>Middle Name</th>
                  <th style={{ width: 150 }}>Last Name</th>
                  <th style={{ width: 160 }}>Department</th>
                  <th style={{ width: 280 }}>Approval Scope</th>
                  <th style={{ width: 220 }}>Role</th>
                  <th style={{ width: 180 }}>Branch</th>
                  <th style={{ width: 160 }}>Area</th>
                  <th style={{ width: 160 }}>Region</th>
                  <th style={{ width: 180 }}>Division</th>
                  <th style={{ width: 120 }}>Status</th>
                  <th style={{ width: 240 }}>Created</th>
                  <th style={{ width: 170 }}>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="empty">
                      No users found.
                    </td>
                  </tr>
                ) : (
                  pagedRows.map((u) => (
                    <tr key={u.id}>
                      <td className="mono">{u.id}</td>
                      <td className="strong">{u.username}</td>
                      <td>{u.first_name ?? "-"}</td>
                      <td>{u.middle_name ?? "-"}</td>
                      <td>{u.last_name ?? "-"}</td>
                      <td>{u.department ?? "-"}</td>

                      <td>
                        <div className="users-scope-list">
                          {(Array.isArray(u.department_scopes)
                            ? u.department_scopes
                            : []
                          ).map((department) => (
                            <span key={department} className="users-scope-pill">
                              {department}
                            </span>
                          ))}
                        </div>
                      </td>

                      <td>{roleLabel(u.role)}</td>
                      <td>{u.branch_name ?? u.branch_id ?? "-"}</td>
                      <td>{u.area ?? "-"}</td>
                      <td>{u.region ?? "-"}</td>
                      <td>{u.division ?? "-"}</td>
                      <td>
                        <span
                          className={
                            u.status === "Inactive"
                              ? "status-badge inactive"
                              : "status-badge active"
                          }
                        >
                          {u.status || "Active"}
                        </span>
                      </td>

                      <td>
                        {u.created_at ? String(u.created_at).split("T")[0] : "-"}
                      </td>

                      <td>
                        <div className="row-actions">
                          <label className="users-switch">
                            <input
                              type="checkbox"
                              checked={(u.status || "Active") === "Active"}
                              onChange={() => toggleStatus(u)}
                            />

                            <span className="users-slider"></span>
                          </label>

                          <button
                            className="users-icon-btn edit"
                            type="button"
                            onClick={() => openEdit(u)}
                            title="Edit User"
                          >
                            <FaEdit />
                          </button>

                          <button
                            className="users-icon-btn reset"
                            type="button"
                            onClick={() => requirePasswordReset(u)}
                            title="Require Password Reset"
                          >
                            <RxReset />
                          </button>

                          <button
                            className="users-icon-btn delete"
                            type="button"
                            onClick={() => onDelete(u.id)}
                            title="Delete User"
                          >
                            <MdDelete />
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

          <div className="users-pager">
            <div className="users-page-size">
              <span>Rows per page:</span>
              <select
                className="input"
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
              >
                {[25, 50, 75, 100].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>

            <div className="users-page-info">
              Page {page} of {totalPages}
            </div>

            <div className="users-page-buttons">
              <button
                className="btn-secondary"
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>

              <button
                className="btn-secondary"
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </button>
            </div>
          </div>

      </div>

      {showModal && (
        <div
          className="modal-overlay"
          onMouseDown={(e) =>
            e.target.classList.contains("modal-overlay") && closeModal()
          }
        >
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h3 className="modal-title">
                  {editId ? "Edit User" : "Add User"}
                </h3>

                <p className="modal-subtitle">
                  {editId
                    ? "Leave password blank to keep current password."
                    : "Create a new account."}
                </p>
              </div>

              <button className="modal-x" type="button" onClick={closeModal}>
                ✕
              </button>
            </div>

            <form onSubmit={onSubmit} className="modal-form">
              <div className="grid">
                <div className="field">
                  <label>First Name</label>
                  <input
                    className="input"
                    name="first_name"
                    value={form.first_name}
                    onChange={onChange}
                    placeholder="Enter first name"
                  />
                </div>

                <div className="field">
                  <label>Middle Name</label>
                  <input
                    className="input"
                    name="middle_name"
                    value={form.middle_name}
                    onChange={onChange}
                    placeholder="Enter middle name"
                  />
                </div>

                <div className="field">
                  <label>Last Name</label>
                  <input
                    className="input"
                    name="last_name"
                    value={form.last_name}
                    onChange={onChange}
                    placeholder="Enter last name"
                  />
                </div>

                <div className="field">
                  <label>Primary Department</label>

                  <select
                    className="input"
                    name="department"
                    value={form.department}
                    onChange={(e) => {
                      const department = e.target.value;

                      setForm((prev) => {
                        const scopes = Array.isArray(prev.department_scopes)
                          ? prev.department_scopes
                          : [];

                        const alreadyIncluded = scopes.some(
                          (x) =>
                            String(x).trim().toLowerCase() ===
                            department.trim().toLowerCase()
                        );

                        return {
                          ...prev,
                          department,
                          department_scopes:
                            department && !alreadyIncluded
                              ? [...scopes, department]
                              : scopes,
                        };
                      });
                    }}
                  >
                    <option value="">Select department</option>

                    {departmentOptions.map((department) => (
                      <option key={department} value={department}>
                        {department}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field full">
                  <label>Approval Department Scope</label>

                  <div className="users-scope-picker">
                    <select
                      className="input"
                      value={scopeDepartment}
                      onChange={(e) => setScopeDepartment(e.target.value)}
                    >
                      <option value="">Select department to add</option>

                      {departmentOptions
                        .filter(
                          (department) =>
                            !(form.department_scopes || []).some(
                              (x) =>
                                String(x).trim().toLowerCase() ===
                                department.toLowerCase()
                            )
                        )
                        .map((department) => (
                          <option key={department} value={department}>
                            {department}
                          </option>
                        ))}
                    </select>

                    <button
                      type="button"
                      className="users-add-scope-btn"
                      onClick={addDepartmentScope}
                      disabled={!scopeDepartment}
                    >
                      + Add
                    </button>
                  </div>

                  <div className="users-selected-scopes">
                    {(Array.isArray(form.department_scopes)
                      ? form.department_scopes
                      : []
                    ).map((department) => {
                      const isPrimary =
                        String(form.department || "").trim().toLowerCase() ===
                        String(department || "").trim().toLowerCase();

                      return (
                        <div
                          key={department}
                          className={`users-selected-scope ${
                            isPrimary ? "primary" : ""
                          }`}
                        >
                          <span>{department}</span>

                          {isPrimary ? (
                            <small>Primary</small>
                          ) : (
                            <button
                              type="button"
                              onClick={() => removeDepartmentScope(department)}
                              title={`Remove ${department}`}
                            >
                              ×
                            </button>
                          )}
                        </div>
                      );
                    })}

                    {(!form.department_scopes ||
                      form.department_scopes.length === 0) && (
                      <div className="users-no-scope">
                        Select a primary department first.
                      </div>
                    )}
                  </div>

                  <small className="users-field-help">
                    Add the departments where this account can approve requests.
                    The primary department is always included.
                  </small>
                </div>

                <div className="field">
                  <label>Username</label>
                  <input
                    className="input"
                    name="username"
                    value={form.username}
                    onChange={onChange}
                    required
                  />
                </div>

                <div className="field">
                  <label>Role</label>
                  <select
                    className="input"
                    name="role"
                    value={form.role}
                    onChange={onChange}
                    required
                  >
                    {roleOptions.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field full" style={{ position: "relative" }}>
                  <label>Branch</label>
                  <input
                    className="input"
                    value={branchSearch}
                    onChange={(e) => {
                      setBranchSearch(e.target.value);
                      setShowBranchOptions(true);
                    }}
                    onFocus={() => setShowBranchOptions(true)}
                    placeholder="Search branch..."
                  />

                  {showBranchOptions && filteredBranches.length > 0 && (
                    <div className="users-search-dropdown">
                      {filteredBranches.map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          className="users-search-option"
                          onClick={() => {
                            setForm((p) => ({
                              ...p,
                              branch_id: String(b.code || b.id || ""),
                            }));
                            setBranchSearch(b.name || "");
                            setShowBranchOptions(false);
                          }}
                        >
                          {b.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="field" style={{ position: "relative" }}>
                  <label>Area</label>
                  <input
                    className="input"
                    value={areaSearch}
                    onChange={(e) => {
                      setAreaSearch(e.target.value);
                      setForm((p) => ({ ...p, area: e.target.value }));
                      setShowAreaOptions(true);
                    }}
                    onFocus={() => setShowAreaOptions(true)}
                    placeholder="Search area..."
                  />

                  {showAreaOptions && filteredAreas.length > 0 && (
                    <div className="users-search-dropdown">
                      {filteredAreas.map((item) => (
                        <button
                          key={item}
                          type="button"
                          className="users-search-option"
                          onClick={() => {
                            setForm((p) => ({ ...p, area: item }));
                            setAreaSearch(item);
                            setShowAreaOptions(false);
                          }}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="field" style={{ position: "relative" }}>
                  <label>Region</label>
                  <input
                    className="input"
                    value={regionSearch}
                    onChange={(e) => {
                      setRegionSearch(e.target.value);
                      setForm((p) => ({ ...p, region: e.target.value }));
                      setShowRegionOptions(true);
                    }}
                    onFocus={() => setShowRegionOptions(true)}
                    placeholder="Search region..."
                  />

                  {showRegionOptions && filteredRegions.length > 0 && (
                    <div className="users-search-dropdown">
                      {filteredRegions.map((item) => (
                        <button
                          key={item}
                          type="button"
                          className="users-search-option"
                          onClick={() => {
                            setForm((p) => ({ ...p, region: item }));
                            setRegionSearch(item);
                            setShowRegionOptions(false);
                          }}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="field" style={{ position: "relative" }}>
                  <label>Division</label>
                  <input
                    className="input"
                    value={divisionSearch}
                    onChange={(e) => {
                      setDivisionSearch(e.target.value);
                      setForm((p) => ({ ...p, division: e.target.value }));
                      setShowDivisionOptions(true);
                    }}
                    onFocus={() => setShowDivisionOptions(true)}
                    placeholder="Search division..."
                  />

                  {showDivisionOptions && filteredDivisions.length > 0 && (
                    <div className="users-search-dropdown">
                      {filteredDivisions.map((item) => (
                        <button
                          key={item}
                          type="button"
                          className="users-search-option"
                          onClick={() => {
                            setForm((p) => ({ ...p, division: item }));
                            setDivisionSearch(item);
                            setShowDivisionOptions(false);
                          }}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="field full">
                  <label>Password</label>
                  <input
                    className="input"
                    name="password"
                    type="password"
                    value={form.password}
                    onChange={onChange}
                    placeholder={
                      editId ? "(leave blank to keep current)" : "Enter password"
                    }
                    required={!editId}
                  />
                </div>
              </div>

              <div className="modal-actions">
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={closeModal}
                >
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