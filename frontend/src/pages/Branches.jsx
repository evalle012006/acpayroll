import { useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState, useCallback } from "react";
import "../styles/Branches.css";
import api from "../api/axiosClient";

const readUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
};

const norm = (v) => String(v ?? "").trim().toLowerCase();

const Branches = () => {
  const navigate = useNavigate();
  const user = useMemo(() => readUser(), []);
  const token = useMemo(() => localStorage.getItem("token"), []);

  const role = norm(user?.role);
  const isAdmin = role === "admin";
  const isHR = role === "hr";
  const isAccounting = role === "accounting";
  const isBranchManager = role === "branch manager";

  const canManageBranches = isAdmin || isHR || isAccounting;
  const canOpenBonus = isAdmin || isHR || isAccounting || isBranchManager;

  const [branches, setBranches] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loadingTable, setLoadingTable] = useState(false);
  const [loadingDepartments, setLoadingDepartments] = useState(false);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [region, setRegion] = useState("");
  const [division, setDivision] = useState("");
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);
  const [selectedBranchMap, setSelectedBranchMap] = useState(null);

  const [showDeptModal, setShowDeptModal] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [selectedModule, setSelectedModule] = useState("payroll");

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/login";
  }, []);

  const fetchBranches = useCallback(async () => {
    try {
      setLoadingTable(true);
      const res = await api.get("/branches");
      setBranches(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401) return logout();
      if (status === 403) return alert("Access denied.");
      alert(err?.response?.data?.message || "Failed to load branches.");
    } finally {
      setLoadingTable(false);
    }
  }, [logout]);

  const fetchDepartments = useCallback(async () => {
    try {
      setLoadingDepartments(true);
      const res = await api.get("/departments");
      setDepartments(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401) return logout();
      setDepartments([]);
      alert(err?.response?.data?.message || "Failed to load departments.");
    } finally {
      setLoadingDepartments(false);
    }
  }, [logout]);

  useEffect(() => {
    if (!user || !token) {
      window.location.href = "/login";
      return;
    }

    fetchBranches();
    fetchDepartments();
  }, [user, token, fetchBranches, fetchDepartments]);

  const resetForm = () => {
    setCode("");
    setName("");
    setArea("");
    setRegion("");
    setDivision("");
    setAddress("");
    setLatitude("");
    setLongitude("");
    setEditId(null);
  };

  const openAdd = () => {
    if (!canManageBranches) return;
    resetForm();
    setShowModal(true);
  };

  const openEdit = (branch) => {
    if (!canManageBranches) return;

    setEditId(branch.id);
    setCode(branch.code || "");
    setName(branch.name || "");
    setArea(branch.area || "");
    setRegion(branch.region || "");
    setDivision(branch.division || "");
    setAddress(branch.address || "");
    setLatitude(branch.latitude ?? "");
    setLongitude(branch.longitude ?? "");
    setShowModal(true);
  };

  const closeFormModal = () => {
    setShowModal(false);
    resetForm();
  };

  const openDepartmentSelector = (branch, moduleName = "payroll") => {
    setSelectedBranch(branch);
    setSelectedModule(moduleName);
    setShowDeptModal(true);

    if (!departments.length) fetchDepartments();
  };

  const closeDepartmentSelector = () => {
    setShowDeptModal(false);
    setSelectedBranch(null);
    setSelectedModule("payroll");
  };

  const openModuleForDepartment = (dept) => {
    if (!selectedBranch) return;

    const branchCode = encodeURIComponent(selectedBranch.code || "");
    const departmentId = encodeURIComponent(dept.id || "");
    const departmentName = encodeURIComponent(dept.name || "");

    closeDepartmentSelector();

    navigate(
      `/${selectedModule}/${branchCode}?department_id=${departmentId}&department=${departmentName}`
    );
  };

  const moduleTitle =
    selectedModule === "transportation"
      ? "Transportation"
      : selectedModule === "bonus"
      ? "Bonus"
      : "Payroll";

  const openMapModal = (branch) => {
    const lat = String(branch?.latitude ?? "").trim();
    const lng = String(branch?.longitude ?? "").trim();
    const addr = String(branch?.address ?? "").trim();

    if ((!lat || !lng) && !addr) {
      alert("No location available for this branch.");
      return;
    }

    setSelectedBranchMap(branch);
    setShowMapModal(true);
  };

  const closeMapModal = () => {
    setShowMapModal(false);
    setSelectedBranchMap(null);
  };

  const getMapEmbedUrl = (branch) => {
    const lat = String(branch?.latitude ?? "").trim();
    const lng = String(branch?.longitude ?? "").trim();
    const addr = String(branch?.address ?? "").trim();

    if (lat && lng) {
      return `https://maps.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}&z=16&output=embed`;
    }

    return `https://maps.google.com/maps?q=${encodeURIComponent(addr)}&z=16&output=embed`;
  };

  const openInGoogleMaps = (branch) => {
    const lat = String(branch?.latitude ?? "").trim();
    const lng = String(branch?.longitude ?? "").trim();
    const addr = String(branch?.address ?? "").trim();

    let url = "";

    if (lat && lng) {
      url = `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}`;
    } else if (addr) {
      url = `https://www.google.com/maps?q=${encodeURIComponent(addr)}`;
    } else {
      alert("No location available for this branch.");
      return;
    }

    window.open(url, "_blank", "noopener,noreferrer");
  };

  useEffect(() => {
    if (!showModal && !showMapModal && !showDeptModal) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        if (showMapModal) closeMapModal();
        else if (showDeptModal) closeDepartmentSelector();
        else closeFormModal();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [showModal, showMapModal, showDeptModal]);

  const filteredBranches = useMemo(() => {
    const q = search.trim().toLowerCase();

    return branches.filter((branch) => {
      return (
        !q ||
        String(branch.id || "").toLowerCase().includes(q) ||
        String(branch.code || "").toLowerCase().includes(q) ||
        String(branch.name || "").toLowerCase().includes(q) ||
        String(branch.area || "").toLowerCase().includes(q) ||
        String(branch.region || "").toLowerCase().includes(q) ||
        String(branch.division || "").toLowerCase().includes(q) ||
        String(branch.address || "").toLowerCase().includes(q)
      );
    });
  }, [branches, search]);

  useEffect(() => {
    setPage(1);
  }, [search, pageSize]);

  const totalRows = filteredBranches.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));

  const pagedBranches = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredBranches.slice(start, start + pageSize);
  }, [filteredBranches, page, pageSize]);

  const rangeText = useMemo(() => {
    if (totalRows === 0) return "0 results";
    const start = (page - 1) * pageSize + 1;
    const end = Math.min(page * pageSize, totalRows);
    return `${start}-${end} of ${totalRows}`;
  }, [page, pageSize, totalRows]);

  const goPrev = () => setPage((prev) => Math.max(1, prev - 1));
  const goNext = () => setPage((prev) => Math.min(totalPages, prev + 1));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canManageBranches) return;

    setSaving(true);
    try {
      const payload = {
        code,
        name,
        area,
        region,
        division,
        address,
        latitude: latitude === "" ? null : Number(latitude),
        longitude: longitude === "" ? null : Number(longitude),
      };

      if (editId) {
        await api.put(`/branches/${editId}`, payload);
      } else {
        await api.post("/branches", payload);
      }

      await fetchBranches();
      closeFormModal();
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401) return logout();
      if (status === 403) return alert("Access denied.");
      alert(err?.response?.data?.message || "Failed to save branch.");
    } finally {
      setSaving(false);
    }
  };

  const deleteBranch = async (id) => {
    if (!canManageBranches) return;
    if (!window.confirm("Delete this branch?")) return;

    try {
      await api.delete(`/branches/${id}`);
      await fetchBranches();
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401) return logout();
      if (status === 403) return alert("Access denied.");
      alert(err?.response?.data?.message || "Failed to delete branch.");
    }
  };

  return (
    <div className="saas-page">
      <div className="saas-header">
        <div className="saas-title">
          <h2>Branches</h2>
          <p>
            {isBranchManager
              ? "Open payroll, transpo, bonus, or map view for your branch."
              : "Manage branch codes, names, areas, regions, and divisions."}
          </p>
        </div>

        {canManageBranches && (
          <div className="saas-actions">
            <button className="btn btn-primary" onClick={openAdd} type="button">
              + Add Branch
            </button>
          </div>
        )}
      </div>

      <div className="card controls-card">
        <div className="controls-left">
          <div className="search-wrap">
            <input
              className="input"
              type="text"
              placeholder="Search by ID, code, name, area, region, division, or address..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") setSearch(searchInput);
              }}
            />

            <button className="btn btn-outline" onClick={() => setSearch(searchInput)} type="button">
              Search
            </button>

            <button
              className="btn btn-ghost"
              type="button"
              onClick={() => {
                setSearch("");
                setSearchInput("");
              }}
            >
              Clear
            </button>
          </div>
        </div>

        <div className="controls-right">
          <div className="pill">
            Results: <strong>{totalRows}</strong>
          </div>

          <div className="page-size">
            <span>Rows</span>
            <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card table-card">
        {loadingTable ? (
          <div className="table-loading">Loading branches…</div>
        ) : (
          <>
            <div className="table-scroll">
              <table className="saas-table">
                <thead>
                  <tr>
                    <th style={{ width: 90 }}>ID</th>
                    <th style={{ width: 150 }}>Branch Code</th>
                    <th style={{ width: 240 }}>Branch Name</th>
                    <th style={{ width: 150 }}>Area</th>
                    <th style={{ width: 150 }}>Region</th>
                    <th style={{ width: 170 }}>Division</th>
                    <th style={{ width: 500 }}>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {pagedBranches.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="empty">
                        No branches found.
                      </td>
                    </tr>
                  ) : (
                    pagedBranches.map((branch) => (
                      <tr key={branch.id}>
                        <td className="mono">{branch.id}</td>
                        <td className="mono">{branch.code}</td>
                        <td className="strong">{branch.name}</td>
                        <td>{branch.area}</td>
                        <td>{branch.region || "-"}</td>
                        <td>{branch.division || "-"}</td>

                        <td>
                          <div className="actions">
                            <div className="action-group">
                              <button
                                className="action-btn btn-payroll"
                                onClick={() => openDepartmentSelector(branch, "payroll")}
                                type="button"
                              >
                                Payroll
                              </button>

                              <button
                                className="action-btn btn-transpo"
                                onClick={() => openDepartmentSelector(branch, "transportation")}
                                type="button"
                              >
                                Transpo
                              </button>

                              <button className="action-btn btn-view" onClick={() => openMapModal(branch)} type="button">
                                View Location
                              </button>

                              {canOpenBonus && (
                                <button
                                  className="action-btn btn-bonus"
                                  onClick={() => openDepartmentSelector(branch, "bonus")}
                                  type="button"
                                >
                                  Bonus
                                </button>
                              )}
                            </div>

                            {canManageBranches && (
                              <div className="action-group">
                                <button className="action-btn btn-edit" onClick={() => openEdit(branch)} type="button">
                                  Edit
                                </button>

                                <button className="action-btn btn-delete" onClick={() => deleteBranch(branch.id)} type="button">
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="pager">
              <div className="pager-left">{rangeText}</div>

              <div className="pager-right">
                <button className="btn btn-outline btn-sm" onClick={() => setPage(1)} disabled={page === 1} type="button">
                  ⏮ First
                </button>

                <button className="btn btn-outline btn-sm" onClick={goPrev} disabled={page === 1} type="button">
                  ◀ Prev
                </button>

                <div className="pager-page">
                  Page <strong>{page}</strong> / {totalPages}
                </div>

                <button className="btn btn-outline btn-sm" onClick={goNext} disabled={page === totalPages} type="button">
                  Next ▶
                </button>

                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => setPage(totalPages)}
                  disabled={page === totalPages}
                  type="button"
                >
                  Last ⏭
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {canManageBranches && showModal && (
        <div className="modal-overlay" onMouseDown={closeFormModal}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{editId ? "Update Branch" : "Add Branch"}</h3>
              <button className="icon-btn" onClick={closeFormModal} type="button">
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body grid-2">
                <div className="field">
                  <label>Branch Code</label>
                  <input className="input" value={code} onChange={(e) => setCode(e.target.value)} required />
                </div>

                <div className="field">
                  <label>Area</label>
                  <input className="input" value={area} onChange={(e) => setArea(e.target.value)} required />
                </div>

                <div className="field">
                  <label>Region</label>
                  <input className="input" value={region} onChange={(e) => setRegion(e.target.value)} required />
                </div>

                <div className="field">
                  <label>Division</label>
                  <input className="input" value={division} onChange={(e) => setDivision(e.target.value)} required />
                </div>

                <div className="field full">
                  <label>Branch Name</label>
                  <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>

                <div className="field full">
                  <label>Branch Address</label>
                  <input
                    className="input"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Enter branch address"
                  />
                </div>

                <div className="field">
                  <label>Latitude</label>
                  <input className="input" value={latitude} onChange={(e) => setLatitude(e.target.value)} placeholder="14.5995" />
                </div>

                <div className="field">
                  <label>Longitude</label>
                  <input className="input" value={longitude} onChange={(e) => setLongitude(e.target.value)} placeholder="120.9842" />
                </div>
              </div>

              <div className="modal-foot">
                <button className="btn btn-primary" type="submit" disabled={saving}>
                  {saving ? "Saving..." : editId ? "Update" : "Save"}
                </button>
                <button className="btn btn-ghost" type="button" onClick={closeFormModal}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeptModal && selectedBranch && (
        <div className="modal-overlay" onMouseDown={closeDepartmentSelector}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h3>Select Department for {moduleTitle}</h3>
                <div className="mini">
                  Branch:{" "}
                  <strong>
                    {selectedBranch.code} - {selectedBranch.name}
                  </strong>
                </div>
              </div>

              <button className="icon-btn" type="button" onClick={closeDepartmentSelector}>
                ✕
              </button>
            </div>

            <div className="modal-body">
              {loadingDepartments ? (
                <div className="table-loading">Loading departments…</div>
              ) : departments.length === 0 ? (
                <div className="empty">No departments found.</div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {departments.map((dept) => (
                    <button
                      key={dept.id}
                      className="btn btn-outline"
                      type="button"
                      onClick={() => openModuleForDepartment(dept)}
                      style={{
                        justifyContent: "flex-start",
                        textAlign: "left",
                        padding: "12px 14px",
                      }}
                    >
                      <span>
                        <strong>
                          {dept.code ? `${dept.code} - ` : ""}
                          {dept.name}
                        </strong>
                        {dept.description ? (
                          <span style={{ display: "block", opacity: 0.75, marginTop: 4 }}>
                            {dept.description}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="modal-foot">
              <button className="btn btn-ghost" type="button" onClick={closeDepartmentSelector}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showMapModal && selectedBranchMap && (
        <div className="modal-overlay" onMouseDown={closeMapModal}>
          <div className="modal map-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Branch Location</h3>
              <button className="icon-btn" onClick={closeMapModal} type="button">
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="branch-map-meta">
                <div className="branch-map-title">{selectedBranchMap.name || "-"}</div>
                <div className="branch-map-address">{selectedBranchMap.address || "No address provided"}</div>
                <div className="branch-map-coords">
                  Area: {selectedBranchMap.area || "-"} | Region: {selectedBranchMap.region || "-"} | Division:{" "}
                  {selectedBranchMap.division || "-"}
                </div>
                <div className="branch-map-coords">
                  Latitude: {selectedBranchMap.latitude ?? "-"} | Longitude: {selectedBranchMap.longitude ?? "-"}
                </div>
              </div>

              <div className="branch-map-frame">
                <iframe title="Branch Location Map" src={getMapEmbedUrl(selectedBranchMap)} loading="lazy" allowFullScreen />
              </div>
            </div>

            <div className="modal-foot">
              <button className="btn btn-outline" type="button" onClick={() => openInGoogleMaps(selectedBranchMap)}>
                Open in Google Maps
              </button>

              <button className="btn btn-ghost" type="button" onClick={closeMapModal}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Branches;