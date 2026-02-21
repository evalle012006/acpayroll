import { useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import "../styles/Branches.css";

const API = "http://localhost:5000";

const Branches = () => {
  const navigate = useNavigate();

  const [branches, setBranches] = useState([]);
  const [loadingTable, setLoadingTable] = useState(false);

  // form
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [editId, setEditId] = useState(null);

  // ui
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [viewData, setViewData] = useState(null);

  // search
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  // ✅ pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const fetchBranches = async () => {
    try {
      setLoadingTable(true);
      const res = await axios.get(`${API}/branches`);
      setBranches(res.data || []);
    } catch (err) {
      console.error("Fetch branches error:", err);
      alert("Failed to load branches.");
    } finally {
      setLoadingTable(false);
    }
  };

  useEffect(() => {
    fetchBranches();
  }, []);

  const filteredBranches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return branches;

    return branches.filter((b) => {
      return (
        String(b.code || "").toLowerCase().includes(q) ||
        String(b.name || "").toLowerCase().includes(q) ||
        String(b.area || "").toLowerCase().includes(q) ||
        String(b.id || "").toLowerCase().includes(q)
      );
    });
  }, [branches, search]);

  // ✅ reset page when filter/pageSize changes
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

  const openAdd = () => {
    setEditId(null);
    setCode("");
    setName("");
    setArea("");
    setShowModal(true);
  };

  const openEdit = (b) => {
    setEditId(b.id);
    setCode(b.code || "");
    setName(b.name || "");
    setArea(b.area || "");
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editId) {
        await axios.put(`${API}/branches/${editId}`, { code, name, area });
      } else {
        await axios.post(`${API}/branches`, { code, name, area });
      }

      await fetchBranches();
      closeModal();
    } catch (err) {
      console.error("Save branch error:", err);
      alert("Something went wrong saving the branch.");
    } finally {
      setSaving(false);
    }
  };

  const deleteBranch = async (id) => {
    const ok = window.confirm("Delete this branch?");
    if (!ok) return;

    try {
      await axios.delete(`${API}/branches/${id}`);
      await fetchBranches();
    } catch (err) {
      console.error("Delete branch error:", err);
      alert("Failed to delete branch.");
    }
  };

  const goPrev = () => setPage((p) => Math.max(1, p - 1));
  const goNext = () => setPage((p) => Math.min(totalPages, p + 1));

  return (
    <div className="saas-page">
      {/* Top Bar */}
      <div className="saas-header">
        <div className="saas-title">
          <h2>Branch Management</h2>
          <p>Manage branch codes, names, and areas.</p>
        </div>

        <div className="saas-actions">
          <button className="btn btn-primary" onClick={openAdd}>
            + Add Branch
          </button>
        </div>
      </div>

      {/* Controls Card */}
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
            <button className="btn btn-outline" onClick={() => setSearch(searchInput)}>
              Search
            </button>
            <button
              className="btn btn-ghost"
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

          {/* ✅ page size selector */}
          <div className="page-size">
            <span>Rows</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table Card */}
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
                            <button
                              className="action-btn btn-payroll"
                              onClick={() => navigate(`/payroll/${Number(b.id)}`)}
                            >
                              Payroll
                            </button>

                            <button
                              className="action-btn btn-transpo"
                              onClick={() => navigate(`/transportation/${Number(b.id)}`)}
                            >
                              Transpo
                            </button>

                            <button className="action-btn btn-view" onClick={() => setViewData(b)}>
                              View
                            </button>

                            <button className="action-btn btn-edit" onClick={() => openEdit(b)}>
                              Edit
                            </button>

                            <button className="action-btn btn-delete" onClick={() => deleteBranch(b.id)}>
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

            {/* ✅ Pagination Footer */}
            <div className="pager">
              <div className="pager-left">{rangeText}</div>

              <div className="pager-right">
                <button className="btn btn-outline btn-sm" onClick={() => setPage(1)} disabled={page === 1}>
                  ⏮ First
                </button>
                <button className="btn btn-outline btn-sm" onClick={goPrev} disabled={page === 1}>
                  ◀ Prev
                </button>

                <div className="pager-page">
                  Page <strong>{page}</strong> / {totalPages}
                </div>

                <button className="btn btn-outline btn-sm" onClick={goNext} disabled={page === totalPages}>
                  Next ▶
                </button>
                <button className="btn btn-outline btn-sm" onClick={() => setPage(totalPages)} disabled={page === totalPages}>
                  Last ⏭
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* View Modal */}
      {viewData && (
        <div className="modal-overlay" onMouseDown={() => setViewData(null)}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Branch Details</h3>
              <button className="icon-btn" onClick={() => setViewData(null)}>
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
              <button className="btn btn-outline" onClick={() => setViewData(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onMouseDown={closeModal}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{editId ? "Update Branch" : "Add Branch"}</h3>
              <button className="icon-btn" onClick={closeModal}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body grid-2">
                <div className="field">
                  <label>Branch Code</label>
                  <input
                    className="input"
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    required
                  />
                </div>

                <div className="field">
                  <label>Area</label>
                  <input
                    className="input"
                    type="text"
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    required
                  />
                </div>

                <div className="field full">
                  <label>Branch Name</label>
                  <input
                    className="input"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="modal-foot">
                <button className="btn btn-primary" type="submit" disabled={saving}>
                  {saving ? "Saving..." : editId ? "Update" : "Save"}
                </button>
                <button className="btn btn-ghost" type="button" onClick={closeModal}>
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