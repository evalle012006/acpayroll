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

const toDateOnly = (v) => {
  if (!v) return "";
  const s = String(v);
  if (s.includes("T")) return s.split("T")[0];
  return s.slice(0, 10);
};

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

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

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

  const openEdit = (branch) => {
    if (!isAdmin) return;
    setEditId(branch.id);
    setCode(branch.code || "");
    setName(branch.name || "");
    setArea(branch.area || "");
    setShowModal(true);
  };

  const closeFormModal = () => {
    setShowModal(false);
    resetForm();
  };

  useEffect(() => {
    if (!showModal) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") closeFormModal();
    };

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [showModal]);

  const filteredBranches = useMemo(() => {
    const q = search.trim().toLowerCase();

    return branches.filter((branch) => {
      const matchesSearch =
        !q ||
        String(branch.id || "").toLowerCase().includes(q) ||
        String(branch.code || "").toLowerCase().includes(q) ||
        String(branch.name || "").toLowerCase().includes(q) ||
        String(branch.area || "").toLowerCase().includes(q);

      if (!matchesSearch) return false;

      const branchDate = toDateOnly(branch.updated_at || branch.created_at);

      if (dateFrom && branchDate && branchDate < dateFrom) return false;
      if (dateTo && branchDate && branchDate > dateTo) return false;

      if ((dateFrom || dateTo) && !branchDate) return false;

      return true;
    });
  }, [branches, search, dateFrom, dateTo]);

  useEffect(() => {
    setPage(1);
  }, [search, pageSize, dateFrom, dateTo]);

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
    if (!isAdmin) return;

    setSaving(true);
    try {
      const payload = { code, name, area };

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
              onKeyDown={(e) => {
                if (e.key === "Enter") setSearch(searchInput);
              }}
            />

            <input
              className="input"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              title="Date From"
            />

            <input
              className="input"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              title="Date To"
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
                setDateFrom("");
                setDateTo("");
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
                    <th style={{ width: 180 }}>Branch Code</th>
                    <th style={{ width: 260 }}>Branch Name</th>
                    <th style={{ width: 180 }}>Area</th>
                    <th style={{ width: 140 }}>Date</th>
                    <th style={{ width: 380 }}>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {pagedBranches.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="empty">
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
                        <td className="mono">{toDateOnly(branch.updated_at || branch.created_at) || "-"}</td>
                        <td>
                          <div className="actions">
                            <div className="action-group">
                              <button
                                className="action-btn btn-payroll"
                                onClick={() => navigate(`/payroll/${Number(branch.id)}`)}
                                type="button"
                              >
                                Payroll
                              </button>

                              <button
                                className="action-btn btn-transpo"
                                onClick={() => navigate(`/transportation/${Number(branch.id)}`)}
                                type="button"
                              >
                                Transpo
                              </button>

                              <button
                                className="action-btn btn-bonus"
                                onClick={() => navigate(`/bonus/${Number(branch.id)}`)}
                                type="button"
                              >
                                Bonus
                              </button>
                            </div>

                            {isAdmin && (
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

                <button className="btn btn-outline btn-sm" onClick={() => setPage(totalPages)} disabled={page === totalPages} type="button">
                  Last ⏭
                </button>
              </div>
            </div>
          </>
        )}
      </div>

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