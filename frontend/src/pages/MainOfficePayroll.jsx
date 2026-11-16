import { useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState, useCallback } from "react";
import "../styles/Branches.css";
import api from "../api/axiosClient";
import { FaEdit, FaTrash } from "react-icons/fa";

const readUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
};

const norm = (v) => String(v ?? "").trim().toLowerCase();

const MainOfficePayroll = () => {
  const navigate = useNavigate();
  const user = useMemo(() => readUser(), []);
  const token = useMemo(() => localStorage.getItem("token"), []);

  const role = norm(user?.role);

  const department = norm(
    user?.department ||
    user?.department_name ||
    user?.user_department ||
    user?.departmentName ||
    user?.dept
  );

  const isAdmin = role === "admin";

  const isHR =
    role === "hr" ||
    department === "hr" ||
    department === "hr department";

  const isAccounting =
    role === "accounting" ||
    department === "accounting" ||
    department === "accounting department";

  const isBranchManager = role === "branch manager";

  const canManageBranches =
    isAdmin ||
    isHR ||
    isAccounting;

  const canOpenBonus =
    isAdmin ||
    isHR ||
    isAccounting ||
    isBranchManager;

  const [branches, setBranches] = useState([]);
  const [payrollGroups, setPayrollGroups] = useState([]);
  const [loadingPayrollGroups, setLoadingPayrollGroups] = useState(false);
  const [showPayrollGroupModal, setShowPayrollGroupModal] = useState(false);
  const [editingPayrollGroup, setEditingPayrollGroup] = useState(null);
  const [payrollGroupName, setPayrollGroupName] = useState("");
  const [savingPayrollGroup, setSavingPayrollGroup] = useState(false);
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
  
  const fetchPayrollGroups = useCallback(async () => {
  try {
    setLoadingPayrollGroups(true);
    const res = await api.get("/main-office-payroll-groups");
    setPayrollGroups(Array.isArray(res.data) ? res.data : []);
  } catch (err) {
    const status = err?.response?.status;
    if (status === 401) return logout();
    if (status === 403) return alert("Access denied.");
    alert(err?.response?.data?.message || "Failed to load payroll groups.");
  } finally {
    setLoadingPayrollGroups(false);
  }
}, [logout]);
  const openEditPayrollGroup = (group) => {
  setEditingPayrollGroup(group);
  setPayrollGroupName(group.group_name);
  setShowPayrollGroupModal(true);
};

  const deactivatePayrollGroup = async (group) => {
    if (
      !window.confirm(
        `Delete "${group.group_name}" from the active list? Staff assignments will be kept.`
      )
    ) {
      return;
    }

    try {
      await api.patch(
        `/main-office-payroll-groups/${group.id}/status`,
        { is_active: false }
      );
      await fetchPayrollGroups();
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401) return logout();
      if (status === 403) return alert("Only an admin can delete a payroll group.");
      alert(err?.response?.data?.message || "Failed to delete payroll group.");
    }
  };
  const handlePayrollGroupSubmit = async (e) => {
  e.preventDefault();
  if (!isAdmin) return;

  const groupName = payrollGroupName.trim();
  if (!groupName) return;

  try {
    setSavingPayrollGroup(true);

    if (editingPayrollGroup) {
    await api.put(
      `/main-office-payroll-groups/${editingPayrollGroup.id}`,
      { group_name: groupName }
    );
  } else {
    await api.post("/main-office-payroll-groups", {
      group_name: groupName,
    });
  }

    setShowPayrollGroupModal(false);
    setPayrollGroupName("");
    setEditingPayrollGroup(null);
    await fetchPayrollGroups();
  } catch (err) {
    const status = err?.response?.status;
    if (status === 401) return logout();
    if (status === 403) return alert("Only an admin can add a payroll group.");
    alert(err?.response?.data?.message || "Failed to add payroll group.");
  } finally {
    setSavingPayrollGroup(false);
  }
};

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
    fetchPayrollGroups();
  }, [user, token, fetchBranches, fetchDepartments, fetchPayrollGroups]);

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

  const mainOfficeBranch = useMemo(
  () =>
    branches.find((branch) => norm(branch.code) === "b000") ||
    branches.find((branch) => norm(branch.name).includes("main office")) ||
    null,
  [branches]
  );

  const payrollRows = useMemo(
  () =>
    mainOfficeBranch
      ? payrollGroups.map((group) => ({
          group,
          branch: mainOfficeBranch,
        }))
      : [],
  [mainOfficeBranch, payrollGroups]
);

  const filteredBranches = useMemo(() => {
    const q = search.trim().toLowerCase();

    return payrollRows.filter(({ group, branch }) =>
      [
        group.id,
        group.group_name,
        group.group_key,
        branch.code,
        branch.name,
        branch.area,
        branch.region,
        branch.division,
      ].some((value) => String(value ?? "").toLowerCase().includes(q))
    );
  }, [payrollRows, search]);

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
          <h2>Main Office Payroll</h2>
          <p>Payroll groups for Main Office bank reports.</p>
        </div>
        {isAdmin && (
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => {
              setPayrollGroupName("");
              setShowPayrollGroupModal(true);
            }}
          >
            + Add Payroll Group
          </button>
        )}
      </div>

      <div className="card controls-card">
        <div className="controls-left">
          <div className="search-wrap">
            <input
              className="input"
              type="text"
              placeholder="Search by payroll name..."
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
        {loadingTable || loadingPayrollGroups ? (
          <div className="table-loading">Loading branches…</div>
        ) : (
          <>
            <div className="table-scroll">
              <table className="saas-table">
                <thead>
                  <tr>
                    <th style={{ width: 60 }}>ID</th>
                    <th style={{ width: 180 }}>Payroll</th>
                    <th style={{ width: 150 }}>Branch Name</th>
                    <th style={{ width: 85 }}>Area</th>
                    <th style={{ width: 110 }}>Region</th>
                    <th style={{ width: 120 }}>Division</th>
                    <th style={{ width: 230 }}>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {pagedBranches.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="empty">
                        No Main Office payroll groups found.
                      </td>
                    </tr>
                  ) : (
                    pagedBranches.map(({ group, branch }, index) => (
                      <tr key={group.group_key}>
                        <td className="mono">{(page - 1) * pageSize + index + 1}</td>
                        <td className="strong">{group.group_name}</td>
                        <td className="strong">{branch.name || "MAIN OFFICE"}</td>
                        <td>{branch.area || "-"}</td>
                        <td>{branch.region || "-"}</td>
                        <td>{branch.division || "-"}</td>
                        <td>
                          <div className="actions" style={{ justifyContent: "center" }}>
                            <button
                              className="action-btn btn-payroll"
                              onClick={() =>
                                navigate(
                                  `/payroll/${encodeURIComponent(branch.code || "B000")}?main_office_group=${encodeURIComponent(group.group_key)}`
                                )
                              }
                              type="button"
                            >
                              Payroll
                            </button>
                            <button
                              className="action-btn btn-transpo"
                              type="button"
                              onClick={() =>
                                navigate(
                                  `/transportation/${encodeURIComponent(branch.code || "B000")}?main_office_group=${encodeURIComponent(group.group_key)}`
                                )
                              }
                            >
                              Transpo
                            </button>

                            {isAdmin && (
                              <>
                               <button
                                  className="action-btn btn-edit icon-only"
                                  type="button"
                                  onClick={() => openEditPayrollGroup(group)}
                                >
                                  <FaEdit />
                                </button>

                                <button
                                  className="action-btn btn-delete icon-only"
                                  type="button"
                                  onClick={() => deactivatePayrollGroup(group)}
                                >
                                  <FaTrash />
                                </button>
                              </>
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
      {showPayrollGroupModal && (
      <div
        className="modal-overlay"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) {
            setShowPayrollGroupModal(false);
          }
        }}
      >
        <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
          <div className="modal-head">
            <h3>{editingPayrollGroup ? "Edit Payroll Group" : "Add Payroll Group"}</h3>
            <button
              className="icon-btn"
              type="button"
              onClick={() => setShowPayrollGroupModal(false)}
            >
              ✕
            </button>
          </div>

          <form onSubmit={handlePayrollGroupSubmit}>
            <div className="modal-body">
              <div className="field">
                <label>Payroll Group Name</label>
                <input
                  className="input"
                  value={payrollGroupName}
                  onChange={(e) => setPayrollGroupName(e.target.value)}
                  placeholder="e.g. TREAD & LMS"
                  maxLength={80}
                  required
                />
              </div>
            </div>

            <div className="modal-foot">
              <button
                className="btn btn-primary"
                type="submit"
                disabled={savingPayrollGroup}
              >
                {savingPayrollGroup ? "Saving..." : editingPayrollGroup ? "Update Group" : "Save Group"}
              </button>
              <button
                className="btn btn-ghost"
                type="button"
                onClick={() => setShowPayrollGroupModal(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    )}
    </div>
  );
};

export default MainOfficePayroll;