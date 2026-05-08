import React, { useEffect, useMemo, useState, useCallback } from "react";
import "../styles/Departments.css";
import api from "../api/axiosClient";

const toStr = (v) => String(v ?? "").trim();
const norm = (v) => toStr(v).toLowerCase();

const getBase = () => {
  const base = api.defaults.baseURL || "";
  return base.endsWith("/api") ? base.slice(0, -4) : base;
};

const uniqSorted = (arr) =>
  Array.from(new Set((arr || []).map((x) => toStr(x)).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b)
  );

const isPosition = (position, names = []) => {
  const p = norm(position);
  return names.some((x) => p === norm(x));
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
  const [staffSearch, setStaffSearch] = useState("");

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

  const branchLabel = (s) => {
    const code = toStr(s?.branch_code);
    const name = toStr(s?.branch_name);
    if (code && name) return `${code} (${name})`;
    return name || code || "-";
  };

  const enrichedDeptStaff = useMemo(() => {
    return (deptStaff || []).map((s) => ({
      ...s,
      _division: toStr(s.division),
      _region: toStr(s.region),
      _area: toStr(s.area),
      _branchLabel: branchLabel(s),
    }));
  }, [deptStaff]);

  const divisionOptions = useMemo(() => {
    return ["All", ...uniqSorted(enrichedDeptStaff.map((x) => x._division))];
  }, [enrichedDeptStaff]);

  const regionOptions = useMemo(() => {
    return [
      "All",
      ...uniqSorted(
        enrichedDeptStaff
          .filter((x) => divisionFilter === "All" || x._division === divisionFilter)
          .map((x) => x._region)
      ),
    ];
  }, [enrichedDeptStaff, divisionFilter]);

  const areaOptions = useMemo(() => {
    return [
      "All",
      ...uniqSorted(
        enrichedDeptStaff
          .filter((x) => {
            if (divisionFilter !== "All" && x._division !== divisionFilter) return false;
            if (regionFilter !== "All" && x._region !== regionFilter) return false;
            return true;
          })
          .map((x) => x._area)
      ),
    ];
  }, [enrichedDeptStaff, divisionFilter, regionFilter]);

  const branchOptions = useMemo(() => {
    return [
      "All",
      ...uniqSorted(
        enrichedDeptStaff
          .filter((x) => {
            if (divisionFilter !== "All" && x._division !== divisionFilter) return false;
            if (regionFilter !== "All" && x._region !== regionFilter) return false;
            if (areaFilter !== "All" && x._area !== areaFilter) return false;
            return true;
          })
          .map((x) => x._branchLabel)
      ),
    ];
  }, [enrichedDeptStaff, divisionFilter, regionFilter, areaFilter]);

  const hasStaffFilter = useMemo(() => {
    return (
      !!norm(staffSearch) ||
      divisionFilter !== "All" ||
      regionFilter !== "All" ||
      areaFilter !== "All" ||
      branchFilter !== "All"
    );
  }, [staffSearch, divisionFilter, regionFilter, areaFilter, branchFilter]);

  const filteredDeptStaff = useMemo(() => {
    if (!hasStaffFilter) return [];

    const q = norm(staffSearch);

    return enrichedDeptStaff.filter((s) => {
      if (divisionFilter !== "All" && s._division !== divisionFilter) return false;
      if (regionFilter !== "All" && s._region !== regionFilter) return false;
      if (areaFilter !== "All" && s._area !== areaFilter) return false;
      if (branchFilter !== "All" && s._branchLabel !== branchFilter) return false;

      const hay = [
        s.id,
        s.employee_no,
        s.fullname,
        s.first_name,
        s.last_name,
        s.middle_name,
        s.position,
        s.status,
        s._division,
        s._region,
        s._area,
        s._branchLabel,
        s.branch_name,
        s.branch_code,
      ]
        .map((x) => norm(x))
        .join(" ");

      return !q || hay.includes(q);
    });
  }, [
    hasStaffFilter,
    enrichedDeptStaff,
    divisionFilter,
    regionFilter,
    areaFilter,
    branchFilter,
    staffSearch,
  ]);

  const hierarchyRows = useMemo(() => {
    if (!hasStaffFilter) return [];

    const selectedDivisionStaff = enrichedDeptStaff.filter((s) => {
      if (divisionFilter !== "All" && s._division !== divisionFilter) return false;
      if (regionFilter !== "All" && s._region !== regionFilter) return false;
      if (areaFilter !== "All" && s._area !== areaFilter) return false;
      if (branchFilter !== "All" && s._branchLabel !== branchFilter) return false;
      return true;
    });

    if (divisionFilter !== "All" && regionFilter === "All" && areaFilter === "All") {
      const managers = selectedDivisionStaff.filter((s) =>
        isPosition(s.position, [
          "Regional Manager",
          "Acting Regional Manager",
          "Area Manager",
          "Acting Area Manager",
          "Assistant Vice President",
          "Vice President",
        ])
      );

      return managers.map((m) => {
        const handledRegions = uniqSorted(
          selectedDivisionStaff
            .filter((x) => {
              if (isPosition(m.position, ["Area Manager", "Acting Area Manager"])) {
                return x._area === m._area;
              }
              if (isPosition(m.position, ["Regional Manager", "Acting Regional Manager"])) {
                return x._region === m._region;
              }
              return x._division === m._division;
            })
            .map((x) => x._region)
        );

        const handledAreas = uniqSorted(
          selectedDivisionStaff
            .filter((x) => {
              if (isPosition(m.position, ["Area Manager", "Acting Area Manager"])) {
                return x._area === m._area;
              }
              if (isPosition(m.position, ["Regional Manager", "Acting Regional Manager"])) {
                return x._region === m._region;
              }
              return x._division === m._division;
            })
            .map((x) => x._area)
        );

        return {
          manager: m,
          title: m.position || "Manager",
          handledRegions,
          handledAreas,
          handledBranches: uniqSorted(
            selectedDivisionStaff
              .filter((x) => handledAreas.includes(x._area))
              .map((x) => x._branchLabel)
          ),
        };
      });
    }

    if (regionFilter !== "All" && areaFilter === "All") {
      const managers = selectedDivisionStaff.filter((s) =>
        isPosition(s.position, ["Regional Manager", "Acting Regional Manager"])
      );

      return managers.map((m) => ({
        manager: m,
        title: m.position || "Regional Manager",
        handledRegions: [m._region].filter(Boolean),
        handledAreas: uniqSorted(
          selectedDivisionStaff.filter((x) => x._region === m._region).map((x) => x._area)
        ),
        handledBranches: uniqSorted(
          selectedDivisionStaff.filter((x) => x._region === m._region).map((x) => x._branchLabel)
        ),
      }));
    }

    if (areaFilter !== "All") {
      const managers = selectedDivisionStaff.filter((s) =>
        isPosition(s.position, ["Area Manager", "Acting Area Manager"])
      );

      return managers.map((m) => ({
        manager: m,
        title: m.position || "Area Manager",
        handledRegions: [m._region].filter(Boolean),
        handledAreas: [m._area].filter(Boolean),
        handledBranches: uniqSorted(
          selectedDivisionStaff.filter((x) => x._area === m._area).map((x) => x._branchLabel)
        ),
      }));
    }

    return [];
  }, [
    hasStaffFilter,
    enrichedDeptStaff,
    divisionFilter,
    regionFilter,
    areaFilter,
    branchFilter,
  ]);

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
    setStaffSearch("");
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

  const onChange = (e) =>
    setForm((p) => ({
      ...p,
      [e.target.name]: e.target.value,
    }));

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

    return departments.filter((d) =>
      [d.id, d.code, d.name, d.description]
        .map((x) => norm(x))
        .join(" ")
        .includes(q)
    );
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
          <button
            className="btn btn-ghost"
            onClick={() => {
              setSearch("");
              setSearchInput("");
            }}
            type="button"
          >
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
                          <button
                            className="action-btn btn-view"
                            onClick={() => openView(d)}
                            type="button"
                          >
                            View
                          </button>
                          <button
                            className="action-btn btn-edit"
                            onClick={() => openEdit(d)}
                            type="button"
                          >
                            Edit
                          </button>
                          <button
                            className="action-btn btn-danger"
                            onClick={() => deleteDepartment(d.id)}
                            type="button"
                          >
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
                  <input
                    className="input"
                    name="name"
                    value={form.name}
                    onChange={onChange}
                    required
                  />
                </div>

                <div className="field">
                  <label>Description</label>
                  <textarea
                    className="input"
                    name="description"
                    value={form.description}
                    onChange={onChange}
                  />
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
          <div
            className="modal staff-profile-modal"
            onMouseDown={(e) => e.stopPropagation()}
            style={{ maxWidth: 1180 }}
          >
            <div className="modal-head">
              <div>
                <h3>Department: {viewDept.name}</h3>
                <div className="mini">
                  Select Division, Region, Area, Branch, or Search to show staff hierarchy.
                </div>
              </div>
              <button className="icon-btn" onClick={closeView} type="button">
                ✕
              </button>
            </div>

            <div className="modal-body" style={{ padding: 10 }}>
              <div className="dept-view-search">
                <input
                  className="input"
                  type="text"
                  placeholder="Search employee no, name, position, division, region, area, or branch..."
                  value={staffSearch}
                  onChange={(e) => setStaffSearch(e.target.value)}
                />
              </div>

              <div className="dept-view-filters-grid">
                <div className="pill dept-view-pill">
                  Showing: <strong>{filteredDeptStaff.length}</strong>
                </div>

                <div>
                  <input
                    className="input"
                    list="dept-division-list"
                    placeholder="Division: All"
                    value={divisionFilter === "All" ? "" : divisionFilter}
                    onChange={(e) => {
                      const value = toStr(e.target.value) || "All";
                      setDivisionFilter(value);
                      setRegionFilter("All");
                      setAreaFilter("All");
                      setBranchFilter("All");
                    }}
                  />
                  <datalist id="dept-division-list">
                    {divisionOptions.filter((v) => v !== "All").map((v) => (
                      <option key={`div-${v}`} value={v} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <input
                    className="input"
                    list="dept-region-list"
                    placeholder="Region: All"
                    value={regionFilter === "All" ? "" : regionFilter}
                    onChange={(e) => {
                      const value = toStr(e.target.value) || "All";
                      setRegionFilter(value);
                      setAreaFilter("All");
                      setBranchFilter("All");
                    }}
                  />
                  <datalist id="dept-region-list">
                    {regionOptions.filter((v) => v !== "All").map((v) => (
                      <option key={`reg-${v}`} value={v} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <input
                    className="input"
                    list="dept-area-list"
                    placeholder="Area: All"
                    value={areaFilter === "All" ? "" : areaFilter}
                    onChange={(e) => {
                      const value = toStr(e.target.value) || "All";
                      setAreaFilter(value);
                      setBranchFilter("All");
                    }}
                  />
                  <datalist id="dept-area-list">
                    {areaOptions.filter((v) => v !== "All").map((v) => (
                      <option key={`area-${v}`} value={v} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <input
                    className="input"
                    list="dept-branch-list"
                    placeholder="Branch: All"
                    value={branchFilter === "All" ? "" : branchFilter}
                    onChange={(e) => {
                      const value = toStr(e.target.value) || "All";
                      setBranchFilter(value);
                    }}
                  />
                  <datalist id="dept-branch-list">
                    {branchOptions.filter((v) => v !== "All").map((v) => (
                      <option key={`br-${v}`} value={v} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <button className="btn btn-ghost" type="button" onClick={resetViewFilters}>
                    Clear Filters
                  </button>
                </div>
              </div>

              {hasStaffFilter && (
                <div className="card" style={{ padding: 12, marginBottom: 12 }}>
                  <h4 style={{ margin: "0 0 10px" }}>In-Charge / Handled Areas</h4>

                  {hierarchyRows.length === 0 ? (
                    <div className="mini">
                      No manager found for the selected filter. Check if staff position is Regional Manager,
                      Acting Regional Manager, Area Manager, or Acting Area Manager.
                    </div>
                  ) : (
                    <div style={{ display: "grid", gap: 10 }}>
                      {hierarchyRows.map((row) => (
                        <div
                          key={`hier-${row.manager.id}`}
                          style={{
                            border: "1px solid rgba(255,255,255,0.12)",
                            borderRadius: 12,
                            padding: 12,
                          }}
                        >
                          <div className="strong">
                            {row.manager.fullname || "-"}{" "}
                            <span className="mini">({row.title})</span>
                          </div>

                          <div className="mini" style={{ marginTop: 4 }}>
                            Employee No: {row.manager.employee_no || "-"} • Division:{" "}
                            {row.manager._division || "-"}
                          </div>

                          <div style={{ marginTop: 8 }}>
                            <strong>Region handled:</strong>{" "}
                            {row.handledRegions.length ? row.handledRegions.join(", ") : "-"}
                          </div>

                          <div style={{ marginTop: 4 }}>
                            <strong>Area handled:</strong>{" "}
                            {row.handledAreas.length ? row.handledAreas.join(", ") : "-"}
                          </div>

                          <div style={{ marginTop: 4 }}>
                            <strong>Branches handled:</strong>{" "}
                            {row.handledBranches.length ? row.handledBranches.join(", ") : "-"}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="table-scroll">
                {loadingDeptStaff ? (
                  <div style={{ padding: 12 }}>Loading...</div>
                ) : (
                  <table className="saas-table">
                    <thead>
                      <tr>
                        <th style={{ width: 140 }}>Employee No</th>
                        <th>Name</th>
                        <th style={{ width: 200 }}>Position</th>
                        <th style={{ width: 160 }}>Division</th>
                        <th style={{ width: 160 }}>Region</th>
                        <th style={{ width: 160 }}>Area</th>
                        <th style={{ width: 220 }}>Branch</th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredDeptStaff.length === 0 ? (
                        <tr>
                          <td colSpan={7}>
                            {!hasStaffFilter
                              ? "Please search or choose Division, Region, Area, or Branch to show staff."
                              : "No staff found for this filter."}
                          </td>
                        </tr>
                      ) : (
                        filteredDeptStaff.map((s) => (
                          <tr key={s.id}>
                            <td className="mono">{s.employee_no || "-"}</td>
                            <td className="strong">{s.fullname}</td>
                            <td>{s.position || "-"}</td>
                            <td>{s._division || "-"}</td>
                            <td>{s._region || "-"}</td>
                            <td>{s._area || "-"}</td>
                            <td>{s._branchLabel || "-"}</td>
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
