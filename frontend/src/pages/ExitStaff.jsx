import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/ExitStaff.css";
import api from "../api/axiosClient";

const toStr = (v) => String(v ?? "").trim();
const norm = (v) => toStr(v).toLowerCase();
const toDate10 = (v) => (v ? String(v).slice(0, 10) : "");
const todayDate = () => new Date().toISOString().slice(0, 10);

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

  const role = norm(user?.role);

  const canManageOrders =
    role === "admin" ||
    role === "it" ||
    role === "hr" ||
    role === "accounting";

  const [viewStaff, setViewStaff] = useState(null);
  const [showReApply, setShowReApply] = useState(false);
  const [reApplyStaffRow, setReApplyStaffRow] = useState(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [rows, setRows] = useState([]);
  const [branches, setBranches] = useState([]);

  const [loading, setLoading] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [err, setErr] = useState("");

  const [keyword, setKeyword] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [reApplyingId, setReApplyingId] = useState("");

  const [reApplyForm, setReApplyForm] = useState({
    branch_id: "",
    branch_code: "",
    branch_name: "",
    area: "",
    region: "",
    division: "",
    position: "",
    start_date: todayDate(),
    remarks: "",
  });

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

  const loadBranches = useCallback(async () => {
    try {
      setLoadingBranches(true);

      const res = await api.get("/branches-all");
      setBranches(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error("Failed to load branches:", e?.response?.data || e.message);
      setBranches([]);
    } finally {
      setLoadingBranches(false);
    }
  }, []);

  useEffect(() => {
    loadExitStaff();
    loadBranches();
  }, [loadExitStaff, loadBranches]);

  useEffect(() => {
    const isOpen = viewStaff || showReApply;

    if (!isOpen) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        setViewStaff(null);
        closeReApplyModal();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [viewStaff, showReApply]);

  const closeReApplyModal = () => {
    setShowReApply(false);
    setReApplyStaffRow(null);
    setReApplyForm({
      branch_id: "",
      branch_code: "",
      branch_name: "",
      area: "",
      region: "",
      division: "",
      position: "",
      start_date: todayDate(),
      remarks: "",
    });
  };

  const openReApplyModal = (row) => {
    if (!canManageOrders) {
      alert("Access denied.");
      return;
    }

    const currentBranchId = row?.branch_id ? String(row.branch_id) : "";
    const currentBranch = branches.find(
      (b) => String(b.id) === String(currentBranchId)
    );

    setReApplyStaffRow(row);
    setViewStaff(null);

    setReApplyForm({
      branch_id: currentBranchId,
      branch_code: currentBranch?.code || row?.branch_code || "",
      branch_name: currentBranch?.name || row?.branch_name || "",
      area: currentBranch?.area || row?.area || "",
      region: currentBranch?.region || row?.region || "",
      division: currentBranch?.division || row?.division || "",
      position: row?.position || "",
      start_date: todayDate(),
      remarks: "",
    });

    setShowReApply(true);
  };

  const handleReApplyBranchChange = (branchId) => {
    const branch = branches.find((b) => String(b.id) === String(branchId));

    setReApplyForm((prev) => ({
      ...prev,
      branch_id: branch ? String(branch.id) : "",
      branch_code: branch?.code || "",
      branch_name: branch?.name || "",
      area: branch?.area || "",
      region: branch?.region || "",
      division: branch?.division || "",
    }));
  };

  const submitReApplyStaff = async (e) => {
    e.preventDefault();

    if (!canManageOrders) return alert("Access denied.");

    const staffId = reApplyStaffRow?.id;

    if (!staffId) {
      alert("Invalid staff id.");
      return;
    }

    if (!reApplyForm.branch_id) {
      alert("Branch is required.");
      return;
    }

    if (!toStr(reApplyForm.position)) {
      alert("Position is required.");
      return;
    }

    if (!reApplyForm.start_date) {
      alert("Start date is required.");
      return;
    }

    if (!window.confirm("Re-apply this staff and make them active again?")) {
      return;
    }

    try {
      setReApplyingId(String(staffId));

      await api.put(`/exit-staff/${staffId}/reapply`, {
        branch_id: Number(reApplyForm.branch_id),
        area: reApplyForm.area,
        region: reApplyForm.region,
        division: reApplyForm.division,
        position: reApplyForm.position,
        start_date: reApplyForm.start_date,
        remarks: reApplyForm.remarks,
      });

      alert("Staff re-applied successfully.");
      closeReApplyModal();
      await loadExitStaff();
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to re-apply staff.");
    } finally {
      setReApplyingId("");
    }
  };

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
        r.area,
        r.region,
        r.division,
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
                <th>EXIT TYPE</th>
                <th>ACTION</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="exit-empty">
                    Loading exit staff...
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="exit-empty">
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
                      <span
                        className={`exit-type-badge ${
                          norm(r.exit_type) === "awol"
                            ? "awol"
                            : norm(r.exit_type) === "terminated"
                            ? "terminated"
                            : "resigned"
                        }`}
                      >
                        {r.exit_type || "-"}
                      </span>
                    </td>
                    <td>
                      <div className="exit-action-icons">
                        <button
                          className="exit-icon-btn view"
                          type="button"
                          title="View Staff"
                          onClick={() => setViewStaff(r)}
                        >
                          👁
                        </button>

                        {canManageOrders && (
                          <button
                            className="exit-icon-btn reapply"
                            type="button"
                            title="Re-Apply Staff"
                            disabled={reApplyingId === String(r.id) || loadingBranches}
                            onClick={() => openReApplyModal(r)}
                          >
                            ↺
                          </button>
                        )}
                      </div>
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
                {canManageOrders && (
                  <button
                    className="btn-primary"
                    type="button"
                    onClick={() => openReApplyModal(viewStaff)}
                  >
                    Re-Apply Staff
                  </button>
                )}

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

      {showReApply && reApplyStaffRow && (
        <div
          className="modal-overlay"
          onMouseDown={(e) =>
            e.target.classList.contains("modal-overlay") && closeReApplyModal()
          }
        >
          <div
            className="modal saas-modal"
            style={{ maxWidth: 850, width: "95vw" }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <h3 className="modal-title">Re-Apply Staff</h3>
                <p className="modal-subtitle">
                  {displayNameParts(reApplyStaffRow)} • Employee No:{" "}
                  {reApplyStaffRow.employee_no || "-"}
                </p>
              </div>

              <button
                className="modal-x"
                type="button"
                onClick={closeReApplyModal}
              >
                ✕
              </button>
            </div>

            <form className="modal-form" onSubmit={submitReApplyStaff}>
              <div className="modal-grid">
                <div className="form-group">
                  <label>Employee Name</label>
                  <input value={displayNameParts(reApplyStaffRow)} readOnly />
                </div>

                <div className="form-group">
                  <label>Employee No</label>
                  <input value={reApplyStaffRow.employee_no || "-"} readOnly />
                </div>

                <div className="form-group full">
                  <label>Branch</label>
                  <select
                    value={reApplyForm.branch_id}
                    onChange={(e) => handleReApplyBranchChange(e.target.value)}
                    required
                  >
                    <option value="">Select Branch</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.code} - {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Area</label>
                  <input value={reApplyForm.area || ""} readOnly />
                </div>

                <div className="form-group">
                  <label>Region</label>
                  <input value={reApplyForm.region || ""} readOnly />
                </div>

                <div className="form-group">
                  <label>Division</label>
                  <input value={reApplyForm.division || ""} readOnly />
                </div>

                <div className="form-group">
                  <label>Position</label>
                  <input
                    value={reApplyForm.position}
                    onChange={(e) =>
                      setReApplyForm((p) => ({
                        ...p,
                        position: e.target.value,
                      }))
                    }
                    placeholder="Enter new/current position"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Re-Apply Start Date</label>
                  <input
                    type="date"
                    value={reApplyForm.start_date}
                    onChange={(e) =>
                      setReApplyForm((p) => ({
                        ...p,
                        start_date: e.target.value,
                      }))
                    }
                    required
                  />
                </div>

                <div className="form-group full">
                  <label>Remarks</label>
                  <textarea
                    value={reApplyForm.remarks}
                    onChange={(e) =>
                      setReApplyForm((p) => ({
                        ...p,
                        remarks: e.target.value,
                      }))
                    }
                    placeholder="Optional remarks..."
                  />
                </div>
              </div>

              <div className="modal-buttons">
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={closeReApplyModal}
                >
                  Cancel
                </button>

                <button
                  className="btn-primary"
                  type="submit"
                  disabled={reApplyingId === String(reApplyStaffRow.id)}
                >
                  {reApplyingId === String(reApplyStaffRow.id)
                    ? "Saving..."
                    : "Confirm Re-Apply"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}