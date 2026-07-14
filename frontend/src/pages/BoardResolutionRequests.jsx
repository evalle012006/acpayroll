import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axiosClient";
import "../styles/Approval.css";

const readUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
};

const norm = (v) => String(v ?? "").trim().toLowerCase();
const fmtDate = (v) => (v ? String(v).slice(0, 10) : "-");
const todayDate = () => new Date().toISOString().slice(0, 10);

const defaultForm = () => ({
  date_created: todayDate(),
  to: "",
  thru: "",
  subject: "",
  body: "",
  attachment: null,
});

export default function BoardResolutionRequests() {
  const navigate = useNavigate();
  const user = useMemo(() => readUser(), []);
  const role = norm(user?.role);

  const department = norm(user?.department);

  const isITDepartment = department === "it department";

  const isITDepartmentManager =
    isITDepartment &&
    [
      "branch manager",
      "acting branch manager",
      "area manager",
      "acting area manager",
      "regional manager",
      "acting regional manager",
      "assistant vice president",
      "vice president",
      "senior vice president",
    ].includes(role);

  const isAdmin = ["admin", "it"].includes(role);
  
  const canApprove =
    isAdmin ||
    isHrDepartment ||
    isAccountingDepartment ||
    isITDepartment;

  const isHrDepartment = department === "hr department";
  const isAccountingDepartment = department === "accounting department";
  const isAreaManager = role === "area manager";
  const isRegionalManager = role === "regional manager";
  const isAssistantVicePresident = role === "assistant vice president";
  const isVp = role === "vice president";
  const isSvp = role === "senior vice president";
  const isPresident = role === "president";

  const canCreate =
    isAreaManager ||
    isRegionalManager ||
    isAssistantVicePresident ||
    isAdmin ||
    isITDepartmentManager;

  const canViewPage =
    canCreate ||
    canApprove ||
    isVp ||
    isSvp ||
    isPresident;

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [search, setSearch] = useState("");

  const loadRows = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/board-resolution-requests");
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to load board resolution requests.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canViewPage) loadRows();
  }, [canViewPage, loadRows]);

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) return rows;

    return rows.filter((row) =>
      [
        row.request_no,
        row.to_text,
        row.thru_text,
        row.title,
        row.details,
        row.created_by_role,
        row.status,
      ]
        .join(" ")
        .toLowerCase()
        .includes(keyword)
    );
  }, [rows, search]);

  const closeCreate = () => {
    setShowCreate(false);
    setForm(defaultForm());
  };

  const createRequest = async (e) => {
    e.preventDefault();

    if (!form.to.trim()) {
      alert("To is required.");
      return;
    }

    if (!form.subject.trim()) {
      alert("Subject is required.");
      return;
    }

    try {
      setSaving(true);

      const fd = new FormData();
      fd.append("date_created", form.date_created);
      fd.append("to", form.to.trim());
      fd.append("thru", form.thru.trim());
      fd.append("title", form.subject.trim());
      fd.append("details", form.body.trim());

      if (form.attachment) {
        fd.append("attachment", form.attachment);
      }

      await api.post("/board-resolution-requests", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      alert("Board Resolution Request created.");
      closeCreate();
      await loadRows();
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to create request.");
    } finally {
      setSaving(false);
    }
  };

  const downloadFile = async (row) => {
    try {
      const res = await api.get(`/board-resolution-requests/${row.id}/download`, {
        responseType: "blob",
      });

      const blob = new Blob([res.data]);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");

      a.href = url;
      a.download = row.request_attachment_name || `board-resolution-${row.id}`;

      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to download file.");
    }
  };

  const deleteRequest = async (row) => {
    if (!window.confirm("Delete this board resolution request?")) return;

    try {
      await api.delete(`/board-resolution-requests/${row.id}`);
      await loadRows();
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to delete.");
    }
  };

  const approveRequest = async (row) => {
    if (!window.confirm("Approve this request?")) return;

    try {
      await api.put(
        `/board-resolution-requests/${row.id}/approve`
      );

      await loadRows();
    } catch (err) {
      alert(
        err?.response?.data?.message ||
          "Failed to approve request."
      );
    }
  };

  const rejectRequest = async (row) => {
    const reason = window.prompt("Reason for rejection:");

    if (!reason) return;

    try {
      await api.put(
        `/board-resolution-requests/${row.id}/reject`,
        {
          reason,
        }
      );

      await loadRows();
    } catch (err) {
      alert(
        err?.response?.data?.message ||
          "Failed to reject request."
      );
    }
  };

  const canDeleteRow = (row) =>
    String(row.created_by) === String(user?.id) || isAdmin;

  if (!canViewPage) {
    return (
      <div className="approval-page">
        <h2 className="approval-title">Board Resolution Requests</h2>
        <p className="approval-subtitle">Access denied.</p>
      </div>
    );
  }

  return (
    <div className="approval-page">
      <div className="approval-page-header">
        <div>
          <h2 className="approval-title">Board Resolution Requests</h2>
          <p className="approval-subtitle">
            Area Managers, Regional Managers, Assistant Vice Presidents, and IT Department Managers can create requests.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="btn-secondary" type="button" onClick={() => navigate(-1)}>
            ← Back
          </button>

          <button className="btn-secondary" type="button" onClick={loadRows}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>

          {canCreate && (
            <button className="btn-primary" type="button" onClick={() => setShowCreate(true)}>
              + Compose
            </button>
          )}
        </div>
      </div>

      <div className="approval-toolbar">
        <input
          type="text"
          className="approval-search"
          placeholder="Search request no, subject, to, thru..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="table-card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Request No</th>
                <th>Date Created</th>
                <th>To</th>
                <th>Thru</th>
                <th>Subject</th>
                <th>Body</th>
                <th>Created</th>
                <th>Status</th>
                <th style={{ width: 260 }}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="empty-state">
                    Loading...
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="empty-state">
                    No board resolution requests found.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.request_no || row.id}</td>
                    <td>{fmtDate(row.date_created)}</td>
                    <td>{row.to_text || "-"}</td>
                    <td>{row.thru_text || "-"}</td>
                    <td className="td-strong">{row.title || "-"}</td>
                    <td title={row.details || ""}>
                      {row.details
                        ? row.details.length > 80
                          ? `${row.details.slice(0, 80)}...`
                          : row.details
                        : "-"}
                    </td>
                    <td>{fmtDate(row.created_at)}</td>
                    <td>{row.status}</td>
                    <td>
                      <div className="board-actions">

                        {canApprove &&
                          row.status === "Pending Approval" && (
                            <>
                              <button
                                className="board-btn approve"
                                onClick={() => approveRequest(row)}
                              >
                                ✓ Approve
                              </button>

                              <button
                                className="board-btn reject"
                                onClick={() => rejectRequest(row)}
                              >
                                ✕ Reject
                              </button>
                            </>
                        )}

                        {row.request_attachment_path && (
                          <button
                            className="board-btn download"
                            onClick={() => downloadFile(row)}
                          >
                            ⬇ Download
                          </button>
                        )}

                        {canDeleteRow(row) && (
                          <button
                            className="board-btn delete"
                            onClick={() => deleteRequest(row)}
                          >
                            🗑 Delete
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
      </div>

      {showCreate && (
        <div
          className="modal-overlay"
          onMouseDown={(e) =>
            e.target.classList.contains("modal-overlay") && closeCreate()
          }
        >
          <div
            className="modal saas-modal"
            onMouseDown={(e) => e.stopPropagation()}
            style={{ width: "min(850px, 96vw)", maxHeight: "92vh", overflowY: "auto" }}
          >
            <div className="modal-head">
              <div>
                <h3 className="modal-title">Compose Board Resolution Request</h3>
                <p className="modal-subtitle">Date Created, To, Thru, Subject, Body, and Upload File.</p>
              </div>

              <button className="modal-x" type="button" onClick={closeCreate}>
                ✕
              </button>
            </div>

            <form className="modal-form" onSubmit={createRequest}>
              <div className="modal-grid">
                <div className="form-group">
                  <label>Date Created</label>
                  <input
                    type="date"
                    value={form.date_created}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, date_created: e.target.value }))
                    }
                    required
                  />
                </div>

                <div className="form-group full">
                  <label>To</label>
                  <textarea
                    rows={3}
                    value={form.to}
                    onChange={(e) => setForm((p) => ({ ...p, to: e.target.value }))}
                    placeholder={"Name\nPosition\nCompany"}
                    required
                  />
                </div>

                <div className="form-group full">
                  <label>Thru</label>
                  <textarea
                    rows={3}
                    value={form.thru}
                    onChange={(e) => setForm((p) => ({ ...p, thru: e.target.value }))}
                    placeholder={"Name\nPosition\nDepartment"}
                  />
                </div>

                <div className="form-group full">
                  <label>Subject</label>
                  <input
                    value={form.subject}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, subject: e.target.value }))
                    }
                    placeholder="Request For Board Resolution for BIR Change Address"
                    required
                  />
                </div>

                <div className="form-group full">
                  <label>Body</label>
                  <textarea
                    rows={8}
                    value={form.body}
                    onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))}
                    placeholder="Write the request body here..."
                  />
                </div>

                <div className="form-group full">
                  <label>Upload File</label>
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                    onChange={(e) =>
                      setForm((p) => ({ ...p, attachment: e.target.files?.[0] || null }))
                    }
                  />
                </div>
              </div>

              <div className="modal-buttons">
                <button className="btn-secondary" type="button" onClick={closeCreate}>
                  Cancel
                </button>

                <button className="btn-primary" type="submit" disabled={saving}>
                  {saving ? "Creating..." : "Create Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}