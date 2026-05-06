import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/ExitStaff.css";
import api from "../api/axiosClient";

const toStr = (v) => String(v ?? "").trim();
const norm = (v) => toStr(v).toLowerCase();
const toDate10 = (v) => (v ? String(v).slice(0, 10) : "");

const readUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
};

const displayNameParts = (s) => {
  const ln = toStr(s?.last_name);
  const fn = toStr(s?.first_name);
  const mn = toStr(s?.middle_name);
  const built = `${ln}${ln && fn ? ", " : ""}${fn}${mn ? ` ${mn}` : ""}`
    .replace(/\s+/g, " ")
    .trim();

  return built || toStr(s?.fullname) || toStr(s?.employee_name) || "-";
};

export default function ExitStaff() {
  const navigate = useNavigate();
  const user = useMemo(() => readUser(), []);

  const canManageOrders = ["admin", "hr", "accounting"].includes(norm(user?.role));

  const [viewStaff, setViewStaff] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [keyword, setKeyword] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const loadExitStaff = useCallback(async () => {
    try {
      setLoading(true);
      setErr("");
      const res = await api.get("/exit-staff");
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      setRows([]);
      setErr(e?.response?.data?.message || "Failed to load exit staff.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadExitStaff();
  }, [loadExitStaff]);

  useEffect(() => {
    if (!viewStaff) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") setViewStaff(null);
    };

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [viewStaff]);

  const filteredRows = useMemo(() => {
    const q = norm(keyword);

    return rows.filter((r) => {
      const exitType = norm(r.exit_type);
      const matchesType =
        typeFilter === "all" ? true : exitType === norm(typeFilter);

      const haystack = [
        r.id,
        r.employee_no,
        r.staff_code,
        r.fullname,
        r.last_name,
        r.first_name,
        r.middle_name,
        r.branch_code,
        r.branch_name,
        r.department,
        r.position,
        r.exit_type,
        r.exit_remarks,
      ]
        .map(toStr)
        .join(" ")
        .toLowerCase();

      return matchesType && (!q || haystack.includes(q));
    });
  }, [rows, keyword, typeFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));

  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [keyword, typeFilter, pageSize]);

  const stats = useMemo(() => {
    const awol = rows.filter((x) => norm(x.exit_type) === "awol").length;
    const resigned = rows.filter((x) => norm(x.exit_type) === "resigned").length;
    const terminated = rows.filter((x) => norm(x.exit_type) === "terminated").length;

    return {
      total: rows.length,
      awol,
      resigned,
      terminated,
    };
  }, [rows]);

  return (
    <div className="exit-page">
      <div className="exit-topbar">
        <div>
          <h2 className="exit-title">Exit Staff</h2>
          <p className="exit-subtitle">
            List of inactive staff tagged as AWOL, Resigned, or Terminated.
          </p>
        </div>

        <div className="exit-actions">
          <button
            className="exit-btn exit-btn-ghost"
            type="button"
            onClick={() => navigate(-1)}
          >
            ← Back
          </button>

          <button
            className="exit-btn exit-btn-outline"
            type="button"
            onClick={loadExitStaff}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>

          {canManageOrders && (
            <button
              className="exit-btn exit-btn-primary"
              type="button"
              onClick={() => navigate("/exit-staff-orders")}
            >
              Manage Orders
            </button>
          )}
        </div>
      </div>

      {err ? (
        <div style={{ marginBottom: 12, color: "#ef4444", fontWeight: 900 }}>
          {err}
        </div>
      ) : null}

      <div className="exit-stats">
        <div className="exit-card">
          <div className="exit-card-title">Total</div>
          <div className="exit-card-meta">{stats.total}</div>
        </div>

        <div className="exit-card">
          <div className="exit-card-title">AWOL</div>
          <div className="exit-card-meta">{stats.awol}</div>
        </div>

        <div className="exit-card">
          <div className="exit-card-title">Resigned</div>
          <div className="exit-card-meta">{stats.resigned}</div>
        </div>

        <div className="exit-card">
          <div className="exit-card-title">Terminated</div>
          <div className="exit-card-meta">{stats.terminated}</div>
        </div>
      </div>

      <div className="exit-card">
        <div className="exit-card-head">
          <div className="exit-card-title">Exit Staff List</div>
          <div className="exit-card-meta">
            {filteredRows.length} Record{filteredRows.length === 1 ? "" : "s"}
          </div>
        </div>

        <div className="exit-filter-bar">
          <div className="exit-search-box">
            <span className="exit-search-icon">⌕</span>
            <input
              className="exit-search-input"
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Search employee, branch, department..."
            />
          </div>

          <select
            className="exit-type-select"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="all">All Exit Types</option>
            <option value="awol">AWOL</option>
            <option value="resigned">Resigned</option>
            <option value="terminated">Terminated</option>
          </select>
        </div>

        <div className="exit-table-wrap">
          <table className="exit-table">
            <thead>
              <tr>
                <th>EMPLOYEE NO</th>
                <th>EMPLOYEE NAME</th>
                <th>BRANCH</th>
                <th>DEPARTMENT</th>
                <th>POSITION</th>
                <th>ACTION</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="exit-empty">
                    Loading exit staff...
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="exit-empty">
                    No exit staff found.
                  </td>
                </tr>
              ) : (
                pagedRows.map((r) => (
                  <tr key={r.id}>
                    <td className="exit-mono">
                      {r.staff_code || r.employee_no || "-"}
                    </td>
                    <td className="exit-strong">{displayNameParts(r)}</td>
                    <td>{`${r.branch_code || "-"} - ${r.branch_name || "-"}`}</td>
                    <td>{r.department || "-"}</td>
                    <td>{r.position || "-"}</td>
                    <td>
                      <button
                        className="exit-btn exit-btn-outline"
                        type="button"
                        onClick={() => setViewStaff(r)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="exit-pager">
          <div className="exit-page-size">
            <span>Rows per page:</span>
            <select
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

          <div className="exit-page-info">
            Page {page} of {totalPages}
          </div>

          <div className="exit-page-buttons">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>

            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {viewStaff && (
        <div
          className="modal-overlay"
          onMouseDown={(e) =>
            e.target.classList.contains("modal-overlay") && setViewStaff(null)
          }
        >
          <div
            className="modal saas-modal"
            style={{ maxWidth: 950, width: "95vw" }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <h3 className="modal-title">Exit Staff Details</h3>
                <p className="modal-subtitle">{displayNameParts(viewStaff)}</p>
              </div>

              <button
                className="modal-x"
                type="button"
                onClick={() => setViewStaff(null)}
              >
                ✕
              </button>
            </div>

            <div className="modal-form">
              <div className="modal-grid">
                <div className="form-group">
                  <label>Employee ID</label>
                  <input value={viewStaff.id || "-"} readOnly />
                </div>

                <div className="form-group">
                  <label>Employee No</label>
                  <input
                    value={viewStaff.staff_code || viewStaff.employee_no || "-"}
                    readOnly
                  />
                </div>

                <div className="form-group">
                  <label>Full Name</label>
                  <input value={displayNameParts(viewStaff)} readOnly />
                </div>

                <div className="form-group">
                  <label>Status</label>
                  <input value={viewStaff.status || "-"} readOnly />
                </div>

                <div className="form-group">
                  <label>Branch</label>
                  <input
                    value={`${viewStaff.branch_code || "-"} - ${
                      viewStaff.branch_name || "-"
                    }`}
                    readOnly
                  />
                </div>

                <div className="form-group">
                  <label>Department</label>
                  <input value={viewStaff.department || "-"} readOnly />
                </div>

                <div className="form-group">
                  <label>Position</label>
                  <input value={viewStaff.position || "-"} readOnly />
                </div>

                <div className="form-group">
                  <label>Date Start</label>
                  <input
                    value={
                      toDate10(viewStaff.date_start) ||
                      toDate10(viewStaff.start_date) ||
                      toDate10(viewStaff.hired_date) ||
                      toDate10(viewStaff.date_hired) ||
                      "-"
                    }
                    readOnly
                  />
                </div>

                <div className="form-group">
                  <label>Regularized Date</label>
                  <input
                    value={
                      toDate10(viewStaff.regularized_date) ||
                      toDate10(viewStaff.regularization_date) ||
                      "-"
                    }
                    readOnly
                  />
                </div>

                <div className="form-group">
                  <label>Exit Type</label>
                  <input value={viewStaff.exit_type || "-"} readOnly />
                </div>

                <div className="form-group">
                  <label>Exit Date</label>
                  <input value={toDate10(viewStaff.exit_date) || "-"} readOnly />
                </div>

                <div className="form-group">
                  <label>Area</label>
                  <input value={viewStaff.area || "-"} readOnly />
                </div>

                <div className="form-group">
                  <label>Region</label>
                  <input value={viewStaff.region || "-"} readOnly />
                </div>

                <div className="form-group">
                  <label>Division</label>
                  <input value={viewStaff.division || "-"} readOnly />
                </div>

                <div className="form-group full">
                  <label>Remarks</label>
                  <textarea value={viewStaff.exit_remarks || "-"} readOnly />
                </div>
              </div>

              <div className="modal-buttons">
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={() => setViewStaff(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}