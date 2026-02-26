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

  const isAdmin = norm(user?.role) === "admin";

  const [branches, setBranches] = useState([]);
  const [loadingTable, setLoadingTable] = useState(false);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [viewData, setViewData] = useState(null);

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

  useEffect(() => {
    if (!user || !token) {
      window.location.href = "/login";
      return;
    }
    fetchBranches();
  }, [user, token, fetchBranches]);

  const resetForm = () => {
    setCode("");
    setName("");
    setArea("");
    setEditId(null);
  };

  const openAdd = () => {
    if (!isAdmin) return;
    resetForm();
    setShowModal(true);
  };

  const openEdit = (b) => {
    if (!isAdmin) return;
    setEditId(b.id);
    setCode(b.code || "");
    setName(b.name || "");
    setArea(b.area || "");
    setShowModal(true);
  };

  const closeFormModal = () => {
    setShowModal(false);
    resetForm();
  };

  const closeViewModal = () => setViewData(null);

  useEffect(() => {
    const isAnyModalOpen = showModal || !!viewData;
    if (!isAnyModalOpen) return;

    const onKeyDown = (e) => e.key === "Escape" && (closeFormModal(), closeViewModal());
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [showModal, viewData]);

  const filteredBranches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return branches;
    return branches.filter((b) =>
      String(b.code || "").toLowerCase().includes(q) ||
      String(b.name || "").toLowerCase().includes(q) ||
      String(b.area || "").toLowerCase().includes(q) ||
      String(b.id || "").toLowerCase().includes(q)
    );
  }, [branches, search]);

  useEffect(() => setPage(1), [search, pageSize]);

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

  const goPrev = () => setPage((p) => Math.max(1, p - 1));
  const goNext = () => setPage((p) => Math.min(totalPages, p + 1));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isAdmin) return;

    setSaving(true);
    try {
      const payload = { code, name, area };

      if (editId) await api.put(`/branches/${editId}`, payload);
      else await api.post(`/branches`, payload);

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
    if (!isAdmin) return;
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
          <p>Manage branch codes, names, and areas.</p>
        </div>

        {isAdmin && (
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
              placeholder="Search by ID, code, name, or area..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && setSearch(searchInput)}
            />
            <button className="btn btn-outline" onClick={() => setSearch(searchInput)} type="button">
              Search
            </button>
            <button className="btn btn-ghost" type="button" onClick={() => (setSearch(""), setSearchInput(""))}>
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
                    <th style={{ width: 160 }}>Branch Code</th>
                    <th>Branch Name</th>
                    <th style={{ width: 220 }}>Area</th>
                    <th style={{ width: 420 }}>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {pagedBranches.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="empty">
                        No branches found.
                      </td>
                    </tr>
                  ) : (
                    pagedBranches.map((b) => (
                      <tr key={b.id}>
                        <td className="mono">{b.id}</td>
                        <td className="mono">{b.code}</td>
                        <td className="strong">{b.name}</td>
                        <td>{b.area}</td>

                        <td>
                          <div className="actions">
                            <button className="action-btn btn-payroll" onClick={() => navigate(`/payroll/${Number(b.id)}`)} type="button">
                              Payroll
                            </button>

                            <button
                              className="action-btn btn-transpo"
                              onClick={() => navigate(`/transportation/${Number(b.id)}`)}
                              type="button"
                            >
                              Transpo
                            </button>

                            <button
                              className="action-btn btn-bonus"
                              onClick={() => navigate(`/bonus/${Number(b.id)}`)}
                              type="button"
                            >
                              Bonus
                            </button>

                            <button className="action-btn btn-view" onClick={() => setViewData(b)} type="button">
                              View
                            </button>

                            {isAdmin && (
                              <>
                                <button className="action-btn btn-edit" onClick={() => openEdit(b)} type="button">
                                  Edit
                                </button>
                                <button className="action-btn btn-delete" onClick={() => deleteBranch(b.id)} type="button">
                                  Delete
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

      {viewData && (
        <div className="modal-overlay" onMouseDown={closeViewModal}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Branch Details</h3>
              <button className="icon-btn" onClick={closeViewModal} type="button">
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="kv">
                <span>Branch ID</span>
                <strong className="mono">{viewData.id}</strong>
              </div>
              <div className="kv">
                <span>Code</span>
                <strong className="mono">{viewData.code}</strong>
              </div>
              <div className="kv">
                <span>Name</span>
                <strong>{viewData.name}</strong>
              </div>
              <div className="kv">
                <span>Area</span>
                <strong>{viewData.area}</strong>
              </div>
            </div>

            <div className="modal-foot">
              <button className="btn btn-outline" onClick={closeViewModal} type="button">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {isAdmin && showModal && (
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

                <div className="field full">
                  <label>Branch Name</label>
                  <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
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
    </div>
  );
};

export default Branches;