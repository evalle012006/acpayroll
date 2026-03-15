import React, { useEffect, useMemo, useState, useCallback } from "react";
import "../styles/Departments.css";
import api from "../api/axiosClient";

const toStr = (v) => String(v ?? "").trim();
const norm = (v) => toStr(v).toLowerCase();

const getBase = () => {
  const base = api.defaults.baseURL || "";
  return base.endsWith("/api") ? base.slice(0, -4) : base; // remove trailing /api if present
};

export default function Departments() {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editDept, setEditDept] = useState(null);
  const [saving, setSaving] = useState(false);

  const [viewDept, setViewDept] = useState(null);
  const [deptStaff, setDeptStaff] = useState([]);
  const [loadingDeptStaff, setLoadingDeptStaff] = useState(false);

  const [divisionFilter, setDivisionFilter] = useState("All");
  const [regionFilter, setRegionFilter] = useState("All");
  const [areaFilter, setAreaFilter] = useState("All");
  const [branchFilter, setBranchFilter] = useState("All");

  const [form, setForm] = useState({
    code: "",
    name: "",
    description: "",
  });

  const base = useMemo(() => getBase(), []);

  const avatarUrl = (s) => {
    const p = s?.photo_url;
    if (!p) return "";
    if (String(p).startsWith("http")) return p;
    return `${base}${p}`;
  };

  const uniq = (arr) => Array.from(new Set((arr || []).map((x) => toStr(x)).filter(Boolean)));

  const branchLabel = (s) => {
    const code = toStr(s?.branch_code);
    const name = toStr(s?.branch_name);
    if (code && name) return `${code} (${name})`;
    return name || code || "-";
  };

  const divisionOptions = useMemo(() => ["All", ...uniq(deptStaff.map((x) => x.division))], [deptStaff]);
  const regionOptions = useMemo(() => ["All", ...uniq(deptStaff.map((x) => x.region))], [deptStaff]);
  const areaOptions = useMemo(() => ["All", ...uniq(deptStaff.map((x) => x.area))], [deptStaff]);
  const branchOptions = useMemo(() => ["All", ...uniq(deptStaff.map((x) => branchLabel(x)))], [deptStaff]);

  const filteredDeptStaff = useMemo(() => {
    return (deptStaff || []).filter((s) => {
      if (divisionFilter !== "All" && toStr(s.division) !== divisionFilter) return false;
      if (regionFilter !== "All" && toStr(s.region) !== regionFilter) return false;
      if (areaFilter !== "All" && toStr(s.area) !== areaFilter) return false;
      if (branchFilter !== "All" && branchLabel(s) !== branchFilter) return false;
      return true;
    });
  }, [deptStaff, divisionFilter, regionFilter, areaFilter, branchFilter]);

  const loadDepartments = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/departments");
      setDepartments(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load departments.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDepartments();
  }, []);

  const resetForm = () => {
    setForm({ code: "", name: "", description: "" });
    setEditDept(null);
  };

  const openAdd = () => {
    resetForm();
    setShowModal(true);
  };

  const openEdit = (d) => {
    setEditDept(d);
    setForm({
      code: d.code || "",
      name: d.name || "",
      description: d.description || "",
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    resetForm();
  };

  const resetViewFilters = () => {
    setDivisionFilter("All");
    setRegionFilter("All");
    setAreaFilter("All");
    setBranchFilter("All");
  };

  const closeView = () => {
    setViewDept(null);
    setDeptStaff([]);
    resetViewFilters();
  };

  useEffect(() => {
    const isAnyOpen = showModal || !!viewDept;
    if (!isAnyOpen) return;

    const onKey = (e) => {
      if (e.key === "Escape") {
        closeModal();
        closeView();
      }
    };

    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [showModal, viewDept]);

  const onChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const saveDepartment = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (editDept) {
        await api.put(`/departments/${editDept.id}`, form);
        alert("Department updated.");
      } else {
        await api.post("/departments", form);
        alert("Department added.");
      }

      closeModal();
      await loadDepartments();
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to save department.");
    } finally {
      setSaving(false);
    }
  };

  const deleteDepartment = async (id) => {
    if (!window.confirm("Delete this department?")) return;
    try {
      await api.delete(`/departments/${id}`);
      await loadDepartments();
    } catch {
      alert("Delete failed.");
    }
  };

  const openView = useCallback(async (d) => {
    setViewDept(d);
    setDeptStaff([]);
    resetViewFilters();
    setLoadingDeptStaff(true);
    try {
      const res = await api.get(`/departments/${d.id}/staff`);
      setDeptStaff(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setDeptStaff([]);
      alert(err?.response?.data?.message || "Failed to load staff for this department.");
    } finally {
      setLoadingDeptStaff(false);
    }
  }, []);

  const filteredDepartments = useMemo(() => {
    const q = norm(search);
    if (!q) return departments;

    return departments.filter((d) => [d.id, d.code, d.name, d.description].map((x) => norm(x)).join(" ").includes(q));
  }, [departments, search]);

  return (
    <div className="staffinfo-page">
      <div className="staffinfo-header">
        <div>
          <h2>Departments</h2>
          <p>Manage company departments</p>
        </div>

        <div className="staffinfo-actions">
          <button className="btn btn-outline" onClick={loadDepartments} type="button">
            Refresh
          </button>
          <button className="btn btn-primary" onClick={openAdd} type="button">
            + Add Department
          </button>
        </div>
      </div>

      <div className="card staffinfo-controls">
        <div className="search-wrap">
          <input
            className="input"
            placeholder="Search department..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && setSearch(searchInput)}
          />
          <button className="btn btn-outline" onClick={() => setSearch(searchInput)} type="button">
            Search
          </button>
          <button className="btn btn-ghost" onClick={() => (setSearch(""), setSearchInput(""))} type="button">
            Clear
          </button>

          <div className="pill">
            Results: <strong>{filteredDepartments.length}</strong>
          </div>
        </div>
      </div>

      <div className="card staffinfo-table-card">
        {loading ? (
          <div className="table-loading">Loading departments…</div>
        ) : error ? (
          <div className="table-loading" style={{ color: "red" }}>
            {error}
          </div>
        ) : (
          <div className="table-scroll">
            <table className="saas-table">
              <thead>
                <tr>
                  <th style={{ width: 80 }}>ID</th>
                  <th style={{ width: 150 }}>Code</th>
                  <th>Name</th>
                  <th>Description</th>
                  <th style={{ width: 220 }}>Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredDepartments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="empty">
                      No departments found.
                    </td>
                  </tr>
                ) : (
                  filteredDepartments.map((d) => (
                    <tr key={d.id}>
                      <td>{d.id}</td>
                      <td>{d.code || "-"}</td>
                      <td className="strong">{d.name}</td>
                      <td>{d.description || "-"}</td>
                      <td>
                        <div className="actions">
                          <button className="action-btn btn-view" onClick={() => openView(d)} type="button">
                            View
                          </button>
                          <button className="action-btn btn-edit" onClick={() => openEdit(d)} type="button">
                            Edit
                          </button>
                          <button className="action-btn btn-danger" onClick={() => deleteDepartment(d.id)} type="button">
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onMouseDown={closeModal}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{editDept ? "Edit Department" : "Add Department"}</h3>
              <button className="icon-btn" onClick={closeModal} type="button">
                ✕
              </button>
            </div>

            <form onSubmit={saveDepartment}>
              <div className="modal-body">
                <div className="field">
                  <label>Department Code</label>
                  <input className="input" name="code" value={form.code} onChange={onChange} />
                </div>

                <div className="field">
                  <label>Department Name</label>
                  <input className="input" name="name" value={form.name} onChange={onChange} required />
                </div>

                <div className="field">
                  <label>Description</label>
                  <textarea className="input" name="description" value={form.description} onChange={onChange} />
                </div>
              </div>

              <div className="modal-foot">
                <button className="btn btn-primary" disabled={saving} type="submit">
                  {saving ? (editDept ? "Updating..." : "Saving...") : editDept ? "Update" : "Save"}
                </button>
                <button className="btn btn-ghost" type="button" onClick={closeModal}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewDept && (
        <div className="modal-overlay" onMouseDown={closeView}>
          <div className="modal staff-profile-modal" onMouseDown={(e) => e.stopPropagation()} style={{ maxWidth: 1100 }}>
            <div className="modal-head">
              <div>
                <h3>Department: {viewDept.name}</h3>
                <div className="mini">Staff list under this department</div>
              </div>
              <button className="icon-btn" onClick={closeView} type="button">
                ✕
              </button>
            </div>

            <div className="modal-body" style={{ padding: 10 }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12, alignItems: "center" }}>
                <div className="pill">
                  Showing: <strong>{filteredDeptStaff.length}</strong>
                </div>

                <select className="input" value={divisionFilter} onChange={(e) => setDivisionFilter(e.target.value)} style={{ width: 220 }}>
                  {divisionOptions.map((v) => (
                    <option key={`div-${v}`} value={v}>
                      {v === "All" ? "Division: All" : `Division: ${v}`}
                    </option>
                  ))}
                </select>

                <select className="input" value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)} style={{ width: 240 }}>
                  {regionOptions.map((v) => (
                    <option key={`reg-${v}`} value={v}>
                      {v === "All" ? "Region: All" : `Region: ${v}`}
                    </option>
                  ))}
                </select>

                <select className="input" value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)} style={{ width: 240 }}>
                  {areaOptions.map((v) => (
                    <option key={`area-${v}`} value={v}>
                      {v === "All" ? "Area: All" : `Area: ${v}`}
                    </option>
                  ))}
                </select>

                <select className="input" value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} style={{ width: 280 }}>
                  {branchOptions.map((v) => (
                    <option key={`br-${v}`} value={v}>
                      {v === "All" ? "Branch: All" : `Branch: ${v}`}
                    </option>
                  ))}
                </select>

                <button className="btn btn-ghost" type="button" onClick={resetViewFilters}>
                  Clear Filters
                </button>
              </div>

              <div className="table-scroll">
                {loadingDeptStaff ? (
                  <div style={{ padding: 12 }}>Loading...</div>
                ) : (
                  <table className="saas-table">
                    <thead>
                      <tr>
                        <th style={{ width: 70 }}></th>
                        <th style={{ width: 90 }}>ID</th>
                        <th style={{ width: 140 }}>Employee No</th>
                        <th>Name</th>
                        <th style={{ width: 200 }}>Position</th>
                        <th style={{ width: 180 }}>Branch</th>
                        <th style={{ width: 120 }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDeptStaff.length === 0 ? (
                        <tr>
                          <td colSpan={7}>No staff found for this filter.</td>
                        </tr>
                      ) : (
                        filteredDeptStaff.map((s) => (
                          <tr key={s.id}>
                            <td>
                              {avatarUrl(s) ? (
                                <img
                                  src={avatarUrl(s)}
                                  alt="staff"
                                  style={{ width: 38, height: 38, borderRadius: "50%", objectFit: "cover" }}
                                />
                              ) : (
                                <div
                                  style={{
                                    width: 38,
                                    height: 38,
                                    borderRadius: "50%",
                                    display: "grid",
                                    placeItems: "center",
                                    border: "1px solid rgba(255,255,255,0.15)",
                                    fontWeight: 700,
                                  }}
                                >
                                  {toStr(s.fullname).slice(0, 1).toUpperCase() || "?"}
                                </div>
                              )}
                            </td>
                            <td className="mono">{s.id}</td>
                            <td className="mono">{s.employee_no || "-"}</td>
                            <td className="strong">{s.fullname}</td>
                            <td>{s.position || "-"}</td>
                            <td>{s.branch_name || "-"}</td>
                            <td>{s.status || "Active"}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className="modal-foot">
              <button className="btn btn-outline" onClick={closeView} type="button">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}