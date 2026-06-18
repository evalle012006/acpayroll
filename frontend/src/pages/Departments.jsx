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

  const [selectedDivision, setSelectedDivision] = useState(null);
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [selectedArea, setSelectedArea] = useState(null);
  const [selectedBranch, setSelectedBranch] = useState(null);

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
    setSelectedDivision(null);
    setSelectedRegion(null);
    setSelectedArea(null);
    setSelectedBranch(null);
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

  const departmentName = norm(viewDept?.name);

  const isOperationDept = departmentName.includes("operation");
  const isITDept = departmentName.includes("it");
  const isHRDept = departmentName.includes("hr");
  const isAccountingDept = departmentName.includes("accounting");
  const isAuditDept = departmentName.includes("audit");
  const isTreadDept = departmentName.includes("tread");
  const isProductionDept =
    departmentName.includes("production") ||
    departmentName.includes("logistic");

  const operationHeads = useMemo(() => {
    const rank = {
      "senior vice president": 1,
      "vice president": 2,
    };

    return enrichedDeptStaff
      .filter((s) =>
        isPosition(s.position, ["Senior Vice President", "Vice President"])
      )
      .sort((a, b) => {
        const aRank = rank[norm(a.position)] || 999;
        const bRank = rank[norm(b.position)] || 999;
        return aRank - bRank;
      });
  }, [enrichedDeptStaff]);

  const divisionsList = useMemo(() => {
    return uniqSorted(
      enrichedDeptStaff
        .map((s) => s._division)
        .filter(
          (d) =>
            d &&
            d !== "-" &&
            norm(d) !== "unknown"
        )
    );
  }, [enrichedDeptStaff]);

  const regionsList = useMemo(() => {
    return uniqSorted(enrichedDeptStaff.map((s) => s._region));
  }, [enrichedDeptStaff]);

  const areasList = useMemo(() => {
    return uniqSorted(enrichedDeptStaff.map((s) => s._area));
  }, [enrichedDeptStaff]);

  const divisionManagers = useMemo(() => {
    if (!selectedDivision) return [];

    const rank = {
      "assistant vice president": 1,
      "acting assistant vice president": 2,
    };

    return enrichedDeptStaff
      .filter(
        (s) =>
          s._division === selectedDivision &&
          isPosition(s.position, [
            "Assistant Vice President",
            "Acting Assistant Vice President",
          ])
      )
      .sort((a, b) => {
        const aRank = rank[norm(a.position)] || 999;
        const bRank = rank[norm(b.position)] || 999;
        return aRank - bRank;
      });
  }, [enrichedDeptStaff, selectedDivision]);

  const selectedDivisionRegions = useMemo(() => {
    if (!selectedDivision) return [];
    return uniqSorted(
      enrichedDeptStaff
        .filter((s) => s._division === selectedDivision)
        .map((s) => s._region)
    );
  }, [enrichedDeptStaff, selectedDivision]);

  const selectedDivisionStaff = useMemo(() => {
    if (!selectedDivision) return [];
    return enrichedDeptStaff.filter((s) => s._division === selectedDivision);
  }, [enrichedDeptStaff, selectedDivision]);

  const selectedRegionStaff = useMemo(() => {
    if (!selectedRegion) return [];
    return selectedDivisionStaff.filter((s) => s._region === selectedRegion);
  }, [selectedDivisionStaff, selectedRegion]);

  const selectedAreaStaff = useMemo(() => {
    if (!selectedArea) return [];
    return selectedRegionStaff.filter((s) => s._area === selectedArea);
  }, [selectedRegionStaff, selectedArea]);

  const selectedRegionManagers = useMemo(() => {
    if (!selectedRegion) return [];

    const rank = {
      "regional manager": 1,
      "acting regional manager": 2,
    };

    return selectedRegionStaff
      .filter((s) =>
        isPosition(s.position, ["Regional Manager", "Acting Regional Manager"])
      )
      .sort((a, b) => (rank[norm(a.position)] || 999) - (rank[norm(b.position)] || 999));
  }, [selectedRegionStaff, selectedRegion]);

  const selectedAreaManagers = useMemo(() => {
    if (!selectedArea) return [];

    const rank = {
      "area manager": 1,
      "acting area manager": 2,
    };

    return selectedAreaStaff
      .filter((s) =>
        isPosition(s.position, ["Area Manager", "Acting Area Manager"])
      )
      .sort((a, b) => (rank[norm(a.position)] || 999) - (rank[norm(b.position)] || 999));
  }, [selectedAreaStaff, selectedArea]);

  const selectedRegionAreas = useMemo(() => {
    if (!selectedRegion) return [];
    return uniqSorted(
      selectedRegionStaff
        .map((s) => s._area)
        .filter((a) => a && a !== "-" && norm(a) !== "unknown")
    );
  }, [selectedRegionStaff, selectedRegion]);

  const selectedAreaBranches = useMemo(() => {
    if (!selectedArea) return [];
    return uniqSorted(
      selectedAreaStaff
        .map((s) => s._branchLabel)
        .filter((b) => b && b !== "-" && norm(b) !== "unknown")
    );
  }, [selectedAreaStaff, selectedArea]);

  const selectedBranchStaff = useMemo(() => {
    if (!selectedBranch) return [];

    const branchStaff = selectedAreaStaff.filter(
      (s) => s._branchLabel === selectedBranch
    );

    const managers = branchStaff.filter((s) =>
      isPosition(s.position, [
        "Branch Manager",
        "Acting Branch Manager",
      ])
    );

    const staff = branchStaff.filter(
      (s) =>
        !isPosition(s.position, [
          "Branch Manager",
          "Acting Branch Manager",
        ])
    );

    return {
      managers,
      staff,
    };
  }, [selectedAreaStaff, selectedBranch]);
  
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
            className="modal staff-profile-modal dept-org-modal"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <h3>{viewDept.name}</h3>
                <div className="mini">
                  Department hierarchy view
                </div>
              </div>

              <button className="icon-btn" onClick={closeView} type="button">
                ✕
              </button>
            </div>

            <div className="modal-body dept-org-body">
              {loadingDeptStaff ? (
                <div className="table-loading">Loading department hierarchy...</div>
              ) : selectedBranch ? (
                <>
                  <button
                    className="btn btn-ghost dept-back-btn"
                    type="button"
                    onClick={() => setSelectedBranch(null)}
                  >
                    ← Back to Area Details
                  </button>

                  <h2 className="dept-org-title">Branch Details</h2>

                  <div className="dept-detail-card">
                    <div className="dept-detail-label">Division</div>
                    <div className="dept-detail-value">{selectedDivision}</div>

                    <div className="dept-detail-label">Region</div>
                    <div className="dept-detail-value">{selectedRegion}</div>

                    <div className="dept-detail-label">Area</div>
                    <div className="dept-detail-value">{selectedArea}</div>

                    <div className="dept-detail-label">Branch</div>
                    <div className="dept-detail-value">{selectedBranch}</div>
                  </div>

                  <section className="dept-org-section">
                    <section className="dept-org-section">
                      <h3>Branch Manager</h3>

                      <div className="dept-person-table">
                        <div className="dept-person-head">
                          <span>Name</span>
                          <span>Start Date</span>
                          <span>Contact #</span>
                          <span>Email</span>
                          <span>Birth Date</span>
                        </div>

                        {selectedBranchStaff.managers.length === 0 ? (
                          <div className="dept-empty-row">
                            No Branch Manager found.
                          </div>
                        ) : (
                          selectedBranchStaff.managers.map((s) => (
                            <div className="dept-person-row" key={s.id}>
                              <div className="dept-person-name">
                                {avatarUrl(s) ? (
                                  <img src={avatarUrl(s)} alt="" />
                                ) : (
                                  <div className="dept-avatar-fallback">
                                    {toStr(s.fullname).charAt(0) || "?"}
                                  </div>
                                )}

                                <div>
                                  <strong>{s.fullname}</strong>
                                  <small>{s.position}</small>
                                </div>
                              </div>

                              <div>{s.start_date || s.date_hired || "-"}</div>
                              <div>{s.contact_no || s.phone || "-"}</div>
                              <div>{s.email || "-"}</div>
                              <div>{s.birth_date || "-"}</div>
                            </div>
                          ))
                        )}
                      </div>
                    </section>

                    <h3>Staff</h3>

                    <div className="table-scroll">
                      <table className="saas-table">
                        <thead>
                          <tr>
                            <th>Employee No</th>
                            <th>Name</th>
                            <th>Position</th>
                            <th>Contact #</th>
                            <th>Email</th>
                          </tr>
                        </thead>

                        <tbody>
                          {selectedBranchStaff.staff.length === 0 ? (
                            <tr>
                              <td colSpan={5}>No staff found inside this branch.</td>
                            </tr>
                          ) : (
                            selectedBranchStaff.staff.map((s) => (
                              <tr key={s.id}>
                                <td>{s.employee_no || "-"}</td>
                                <td className="strong">{s.fullname || "-"}</td>
                                <td>{s.position || "-"}</td>
                                <td>{s.contact_no || s.phone || "-"}</td>
                                <td>{s.email || "-"}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </>
              ) : selectedArea ? (
                <>
                  <button
                    className="btn btn-ghost dept-back-btn"
                    type="button"
                    onClick={() => setSelectedArea(null)}
                  >
                    ← Back to Region Details
                  </button>

                  <h2 className="dept-org-title">Area Details</h2>

                  <div className="dept-detail-card">
                    <div className="dept-detail-label">Division</div>
                    <div className="dept-detail-value">{selectedDivision}</div>

                    <div className="dept-detail-label">Region</div>
                    <div className="dept-detail-value">{selectedRegion}</div>

                    <div className="dept-detail-label">Area</div>
                    <div className="dept-detail-value">{selectedArea}</div>
                  </div>

                  <section className="dept-org-section">
                    <h3>Manager</h3>

                    <div className="dept-person-table">
                      <div className="dept-person-head">
                        <span>Name</span>
                        <span>Start Date</span>
                        <span>Contact #</span>
                        <span>Email</span>
                        <span>Birth Date</span>
                      </div>

                      {selectedAreaManagers.length === 0 ? (
                        <div className="dept-empty-row">No Area Manager found for this area.</div>
                      ) : (
                        selectedAreaManagers.map((s) => (
                          <div className="dept-person-row" key={s.id}>
                            <div className="dept-person-name">
                              {avatarUrl(s) ? (
                                <img src={avatarUrl(s)} alt="" />
                              ) : (
                                <div className="dept-avatar-fallback">
                                  {toStr(s.fullname).charAt(0) || "?"}
                                </div>
                              )}

                              <div>
                                <strong>{s.fullname || "-"}</strong>
                                <small>{s.position || "-"}</small>
                              </div>
                            </div>

                            <div>{s.start_date || s.date_hired || "-"}</div>
                            <div>{s.contact_no || s.phone || "-"}</div>
                            <div>{s.email || "-"}</div>
                            <div>{s.birth_date || "-"}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </section>

                  <section className="dept-org-section">
                    <h3>Branches</h3>

                    <div className="dept-simple-table">
                      <div className="dept-simple-head">Name</div>

                      {selectedAreaBranches.length === 0 ? (
                        <div className="dept-empty-row">No branches found.</div>
                      ) : (
                        selectedAreaBranches.map((b) => (
                          <button
                            className="dept-simple-row dept-click-row"
                            key={b}
                            type="button"
                            onClick={() => setSelectedBranch(b)}
                          >
                            {b}
                          </button>
                        ))
                      )}
                    </div>
                  </section>
                </>
              ) : selectedRegion ? (
                <>
                  <button
                    className="btn btn-ghost dept-back-btn"
                    type="button"
                    onClick={() => setSelectedRegion(null)}
                  >
                    ← Back to Division Details
                  </button>

                  <h2 className="dept-org-title">Region Details</h2>

                  <div className="dept-detail-card">
                    <div className="dept-detail-label">Division</div>
                    <div className="dept-detail-value">{selectedDivision}</div>

                    <div className="dept-detail-label">Region</div>
                    <div className="dept-detail-value">{selectedRegion}</div>

                    <div className="dept-detail-label">Type</div>
                    <div className="dept-detail-value">Operation</div>
                  </div>

                  <section className="dept-org-section">
                    <h3>Manager</h3>

                    <div className="dept-person-table">
                      <div className="dept-person-head">
                        <span>Name</span>
                        <span>Start Date</span>
                        <span>Contact #</span>
                        <span>Email</span>
                        <span>Birth Date</span>
                      </div>

                      {selectedRegionManagers.length === 0 ? (
                        <div className="dept-empty-row">No Regional Manager found for this region.</div>
                      ) : (
                        selectedRegionManagers.map((s) => (
                          <div className="dept-person-row" key={s.id}>
                            <div className="dept-person-name">
                              {avatarUrl(s) ? (
                                <img src={avatarUrl(s)} alt="" />
                              ) : (
                                <div className="dept-avatar-fallback">
                                  {toStr(s.fullname).charAt(0) || "?"}
                                </div>
                              )}

                              <div>
                                <strong>{s.fullname || "-"}</strong>
                                <small>{s.position || "-"}</small>
                              </div>
                            </div>

                            <div>{s.start_date || s.date_hired || "-"}</div>
                            <div>{s.contact_no || s.phone || "-"}</div>
                            <div>{s.email || "-"}</div>
                            <div>{s.birth_date || "-"}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </section>

                  <section className="dept-org-section">
                    <h3>Areas</h3>

                    <div className="dept-simple-table">
                      <div className="dept-simple-head">Name</div>

                      {selectedRegionAreas.length === 0 ? (
                        <div className="dept-empty-row">No areas found.</div>
                      ) : (
                        selectedRegionAreas.map((a) => (
                          <button
                            className="dept-simple-row dept-click-row"
                            key={a}
                            type="button"
                            onClick={() => {
                              setSelectedArea(a);
                              setSelectedBranch(null);
                            }}
                          >
                            {a}
                          </button>
                        ))
                      )}
                    </div>
                  </section>
                </>
              ) : selectedDivision ? (
                <>
                  <button
                    className="btn btn-ghost dept-back-btn"
                    type="button"
                    onClick={() => {
                      setSelectedDivision(null);
                      setSelectedRegion(null);
                      setSelectedArea(null);
                      setSelectedBranch(null);
                    }}
                  >
                    ← Back to Operation Department
                  </button>

                  <h2 className="dept-org-title">Division Details</h2>

                  <div className="dept-detail-card">
                    <div className="dept-detail-label">Name</div>
                    <div className="dept-detail-value">{selectedDivision}</div>

                    <div className="dept-detail-label">Type</div>
                    <div className="dept-detail-value">Operation</div>
                  </div>

                  <section className="dept-org-section">
                    <h3>Manager</h3>

                    <div className="dept-person-table">
                      <div className="dept-person-head">
                        <span>Name</span>
                        <span>Start Date</span>
                        <span>Contact #</span>
                        <span>Email</span>
                        <span>Birth Date</span>
                      </div>

                      {divisionManagers.length === 0 ? (
                        <div className="dept-empty-row">
                          No Assistant Vice President found for this division.
                        </div>
                      ) : (
                        divisionManagers.map((s) => (
                          <div className="dept-person-row" key={s.id}>
                            <div className="dept-person-name">
                              {avatarUrl(s) ? (
                                <img src={avatarUrl(s)} alt="" />
                              ) : (
                                <div className="dept-avatar-fallback">
                                  {toStr(s.fullname).charAt(0) || "?"}
                                </div>
                              )}

                              <div>
                                <strong>{s.fullname || "-"}</strong>
                                <small>{s.position || "-"}</small>
                              </div>
                            </div>

                            <div>{s.start_date || s.date_hired || "-"}</div>
                            <div>{s.contact_no || s.phone || "-"}</div>
                            <div>{s.email || "-"}</div>
                            <div>{s.birth_date || "-"}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </section>

                  <section className="dept-org-section">
                    <h3>Regions</h3>

                    <div className="dept-simple-table">
                      <div className="dept-simple-head">Name</div>

                      {selectedDivisionRegions.filter((r) => r && r !== "-" && norm(r) !== "unknown")
                        .length === 0 ? (
                        <div className="dept-empty-row">No regions found.</div>
                      ) : (
                        selectedDivisionRegions
                          .filter((r) => r && r !== "-" && norm(r) !== "unknown")
                          .map((r) => (
                            <button
                              className="dept-simple-row dept-click-row"
                              key={r}
                              type="button"
                              onClick={() => {
                                setSelectedRegion(r);
                                setSelectedArea(null);
                                setSelectedBranch(null);
                              }}
                            >
                              {r}
                            </button>
                          ))
                      )}
                    </div>
                  </section>
                </>
              ) : (
                <>
                  <section className="dept-org-section">
                    <h3>Head of Department</h3>

                    <div className="dept-person-table">
                      <div className="dept-person-head">
                        <span>Name</span>
                        <span>Start Date</span>
                        <span>Contact #</span>
                        <span>Email</span>
                        <span>Birth Date</span>
                      </div>

                      {operationHeads.length === 0 ? (
                        <div className="dept-empty-row">
                          No Senior Vice President or Vice President found.
                        </div>
                      ) : (
                        operationHeads.map((s) => (
                          <div className="dept-person-row" key={s.id}>
                            <div className="dept-person-name">
                              {avatarUrl(s) ? (
                                <img src={avatarUrl(s)} alt="" />
                              ) : (
                                <div className="dept-avatar-fallback">
                                  {toStr(s.fullname).charAt(0) || "?"}
                                </div>
                              )}

                              <div>
                                <strong>{s.fullname || "-"}</strong>
                                <small>{s.position || "-"}</small>
                              </div>
                            </div>

                            <div>{s.start_date || s.date_hired || "-"}</div>
                            <div>{s.contact_no || s.phone || "-"}</div>
                            <div>{s.email || "-"}</div>
                            <div>{s.birth_date || "-"}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </section>

                  <section className="dept-org-section">
                    <h2 className="dept-blue-title">Divisions</h2>

                    <div className="dept-simple-table">
                      <div className="dept-simple-head">Name</div>

                      {divisionsList.length === 0 ? (
                        <div className="dept-empty-row">No divisions found.</div>
                      ) : (
                        divisionsList.map((d) => (
                          <button
                            className="dept-simple-row dept-click-row"
                            key={d}
                            type="button"
                            onClick={() => {
                              setSelectedDivision(d);
                              setSelectedRegion(null);
                              setSelectedArea(null);
                              setSelectedBranch(null);
                            }}
                          >
                            {d}
                          </button>
                        ))
                      )}
                    </div>
                  </section>
                </>
              )}
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
