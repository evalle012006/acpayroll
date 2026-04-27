import { useEffect, useMemo, useState } from "react";
import api from "../api/axiosClient";
import "../styles/Users.css";
import "../styles/Logistic.css";

const emptyPackageForm = {
  tracking_no: "",
  sender_name: "",
  receiver_name: "",
  origin_branch: "",
  destination_branch: "",
  assigned_to: "",
  remarks: "",
  courier_name: "Internal",
  external_tracking_no: "",
};

const emptyStatusForm = {
  location: "",
  status: "Pending",
  remarks: "",
};

const statusOptions = [
  "Pending",
  "Picked Up",
  "Packed",
  "Departed",
  "In Transit",
  "Arrived",
  "Out for Delivery",
  "Delivered",
  "Failed Delivery",
  "Returned",
];

const toStr = (v) => String(v ?? "").trim();

const formatDateTime = (value) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).replace("T", " ").slice(0, 16);
  return d.toLocaleString();
};

const formatDateOnly = (value) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toISOString().slice(0, 10);
};

export default function Logistic() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [savingCreate, setSavingCreate] = useState(false);
  const [packageForm, setPackageForm] = useState(emptyPackageForm);

  const [showStatusModal, setShowStatusModal] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);
  const [statusForm, setStatusForm] = useState(emptyStatusForm);

  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyRows, setHistoryRows] = useState([]);
  const [historyRow, setHistoryRow] = useState(null);

  const [syncingId, setSyncingId] = useState(null);

  const handle401 = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/login";
  };

  const readUser = () => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  };

  const fetchPackages = async () => {
    try {
      setLoading(true);
      const res = await api.get("/logistic");
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401) return handle401();
      alert(err?.response?.data?.message || "Failed to load packages");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPackages();
  }, []);

  useEffect(() => {
    if (!showCreateModal && !showStatusModal && !showHistoryModal) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        closeCreateModal();
        closeStatusModal();
        closeHistoryModal();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [showCreateModal, showStatusModal, showHistoryModal]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;

    return rows.filter(
      (row) =>
        String(row.id || "").toLowerCase().includes(q) ||
        String(row.tracking_no || "").toLowerCase().includes(q) ||
        String(row.external_tracking_no || "").toLowerCase().includes(q) ||
        String(row.courier_name || "").toLowerCase().includes(q) ||
        String(row.sender_name || "").toLowerCase().includes(q) ||
        String(row.receiver_name || "").toLowerCase().includes(q) ||
        String(row.origin_branch || "").toLowerCase().includes(q) ||
        String(row.destination_branch || "").toLowerCase().includes(q) ||
        String(row.current_location || "").toLowerCase().includes(q) ||
        String(row.current_status || "").toLowerCase().includes(q) ||
        String(row.assigned_to || "").toLowerCase().includes(q) ||
        String(row.remarks || "").toLowerCase().includes(q)
    );
  }, [rows, search]);

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setPackageForm(emptyPackageForm);
  };

  const closeStatusModal = () => {
    setShowStatusModal(false);
    setSelectedRow(null);
    setStatusForm(emptyStatusForm);
  };

  const closeHistoryModal = () => {
    setShowHistoryModal(false);
    setHistoryLoading(false);
    setHistoryRows([]);
    setHistoryRow(null);
  };

  const openCreateModal = () => {
    setPackageForm(emptyPackageForm);
    setShowCreateModal(true);
  };

  const openStatusModal = (row) => {
    setSelectedRow(row);
    setStatusForm({
      location: row.current_location || "",
      status: row.current_status || "Pending",
      remarks: row.remarks || "",
    });
    setShowStatusModal(true);
  };

  const openHistoryModal = async (row) => {
    setHistoryRow(row);
    setShowHistoryModal(true);
    setHistoryLoading(true);

    try {
      const res = await api.get(`/logistic/${row.id}/history`);
      const list = Array.isArray(res.data) ? res.data : [];
      list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setHistoryRows(list);
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401) return handle401();
      alert(err?.response?.data?.message || "Failed to load tracking history");
      setHistoryRows([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const submitCreate = async (e) => {
    e.preventDefault();
    if (savingCreate) return;

    const trackingNo = toStr(packageForm.tracking_no);
    if (!trackingNo) {
      return alert("Tracking number is required.");
    }

    setSavingCreate(true);
    try {
      await api.post("/logistic", {
        tracking_no: trackingNo,
        sender_name: toStr(packageForm.sender_name),
        receiver_name: toStr(packageForm.receiver_name),
        origin_branch: toStr(packageForm.origin_branch),
        destination_branch: toStr(packageForm.destination_branch),
        assigned_to: toStr(packageForm.assigned_to),
        remarks: toStr(packageForm.remarks),
        courier_name: toStr(packageForm.courier_name || "Internal"),
        external_tracking_no: toStr(packageForm.courier_name) === "Internal"
          ? ""
          : toStr(packageForm.external_tracking_no || packageForm.tracking_no),
            });

      await fetchPackages();
      closeCreateModal();
      alert("Package created.");
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401) return handle401();
      alert(err?.response?.data?.message || "Failed to create package");
    } finally {
      setSavingCreate(false);
    }
  };

  const submitStatus = async (e) => {
    e.preventDefault();
    if (savingStatus || !selectedRow) return;

    const user = readUser();

    setSavingStatus(true);
    try {
      await api.post(`/logistic/${selectedRow.id}/update-status`, {
        location: toStr(statusForm.location),
        status: toStr(statusForm.status),
        remarks: toStr(statusForm.remarks),
        updated_by: toStr(user?.username || user?.role || "System"),
      });

      await fetchPackages();
      closeStatusModal();
      alert("Package status updated.");
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401) return handle401();
      alert(err?.response?.data?.message || "Failed to update package");
    } finally {
      setSavingStatus(false);
    }
  };

  const syncExternal = async (row) => {
    if (!row?.id) return;
    setSyncingId(row.id);
    try {
      await api.post(`/logistic/${row.id}/sync-external`);
      await fetchPackages();
      alert("External sync requested.");
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401) return handle401();
      alert(err?.response?.data?.message || "Failed to sync external tracking");
    } finally {
      setSyncingId(null);
    }
  };

  return (
    <div className="users-page">
      <div className="users-header">
        <div>
          <h2 className="users-title">Logistic</h2>
          <p className="users-subtitle">Track, view, and update package location and status</p>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn-secondary" onClick={fetchPackages} type="button">
            Refresh
          </button>
          <button className="btn-primary" onClick={openCreateModal} type="button">
            + Add Package
          </button>
        </div>
      </div>

      <div className="users-card">
        <div className="users-controls">
          <input
            className="input"
            placeholder="Search by tracking no, courier, sender, receiver, branch, location, or status..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="pill">
            Results: <strong>{filtered.length}</strong>
          </div>
        </div>

        <div className="table-wrap">
          {loading ? (
            <div className="loading">Loading packages…</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 70 }}>ID</th>
                  <th style={{ width: 170 }}>Tracking No</th>
                  <th style={{ width: 130 }}>Courier</th>
                  <th style={{ width: 170 }}>External Tracking</th>
                  <th>Sender</th>
                  <th>Receiver</th>
                  <th style={{ width: 160 }}>Current Location</th>
                  <th style={{ width: 150 }}>Status</th>
                  <th style={{ width: 160 }}>Assigned To</th>
                  <th style={{ width: 140 }}>Updated</th>
                  <th style={{ width: 390 }}>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="empty">
                      No packages found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((row) => (
                    <tr key={row.id}>
                      <td className="mono">{row.id}</td>
                      <td className="strong">{row.tracking_no}</td>
                      <td>{row.courier_name || "Internal"}</td>
                      <td>{row.external_tracking_no || "-"}</td>
                      <td>{row.sender_name || "-"}</td>
                      <td>{row.receiver_name || "-"}</td>
                      <td>{row.current_location || "-"}</td>
                      <td>{row.current_status || "-"}</td>
                      <td>{row.assigned_to || "-"}</td>
                      <td>{formatDateOnly(row.updated_at)}</td>
                      <td>
                        <div className="row-actions">
                          <button
                            className="btn-secondary"
                            type="button"
                            onClick={() => openStatusModal(row)}
                          >
                            Update Status
                          </button>

                          <button
                            className="btn-secondary"
                            type="button"
                            onClick={() => openHistoryModal(row)}
                          >
                            View History
                          </button>

                          <button
                            className="btn-secondary"
                            type="button"
                            onClick={() => syncExternal(row)}
                            disabled={
                              syncingId === row.id ||
                              String(row.courier_name || "").toLowerCase() === "internal"
                            }
                          >
                            {syncingId === row.id ? "Syncing..." : "Sync External"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showCreateModal && (
        <div
          className="modal-overlay"
          onMouseDown={(e) => e.target.classList.contains("modal-overlay") && closeCreateModal()}
        >
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h3 className="modal-title">Add Package</h3>
                <p className="modal-subtitle">Create a new package for tracking.</p>
              </div>
              <button className="modal-x" type="button" onClick={closeCreateModal}>
                ✕
              </button>
            </div>

            <form onSubmit={submitCreate} className="modal-form">
              <div className="grid">
                <div className="field">
                  <label>Tracking No *</label>
                  <input
                    className="input"
                    value={packageForm.tracking_no}
                    onChange={(e) =>
                      setPackageForm((p) => ({ ...p, tracking_no: e.target.value }))
                    }
                    required
                  />
                </div>

                <div className="field">
                  <label>Courier</label>
                  <select
                    className="input"
                    value={packageForm.courier_name}
                    onChange={(e) =>
                      setPackageForm((p) => ({ ...p, courier_name: e.target.value }))
                    }
                  >
                    <option value="Internal">Internal</option>
                    <option value="Auto">Auto Detect</option>
                    <option value="J&T">J&amp;T</option>
                    <option value="LBC">LBC</option>
                    <option value="Ninja Van">Ninja Van</option>
                    <option value="Flash Express">Flash Express</option>
                  </select>
                </div>

                <div className="field">
                  <label>External Tracking No</label>
                  <input
                    className="input"
                    value={packageForm.external_tracking_no}
                    onChange={(e) =>
                      setPackageForm((p) => ({
                        ...p,
                        external_tracking_no: e.target.value,
                      }))
                    }
                    placeholder={
                      packageForm.courier_name === "Auto"
                        ? "Auto detect from tracking number"
                        : "Use courier tracking number if external"
                    }
                  />
                </div>

                <div className="field">
                  <label>Assigned To</label>
                  <input
                    className="input"
                    value={packageForm.assigned_to}
                    onChange={(e) =>
                      setPackageForm((p) => ({ ...p, assigned_to: e.target.value }))
                    }
                    placeholder="e.g. Rider - Mark"
                  />
                </div>

                <div className="field">
                  <label>Sender Name</label>
                  <input
                    className="input"
                    value={packageForm.sender_name}
                    onChange={(e) =>
                      setPackageForm((p) => ({ ...p, sender_name: e.target.value }))
                    }
                  />
                </div>

                <div className="field">
                  <label>Receiver Name</label>
                  <input
                    className="input"
                    value={packageForm.receiver_name}
                    onChange={(e) =>
                      setPackageForm((p) => ({ ...p, receiver_name: e.target.value }))
                    }
                  />
                </div>

                <div className="field">
                  <label>Origin Branch</label>
                  <input
                    className="input"
                    value={packageForm.origin_branch}
                    onChange={(e) =>
                      setPackageForm((p) => ({ ...p, origin_branch: e.target.value }))
                    }
                  />
                </div>

                <div className="field">
                  <label>Destination Branch</label>
                  <input
                    className="input"
                    value={packageForm.destination_branch}
                    onChange={(e) =>
                      setPackageForm((p) => ({ ...p, destination_branch: e.target.value }))
                    }
                  />
                </div>

                <div className="field full">
                  <label>Remarks</label>
                  <input
                    className="input"
                    value={packageForm.remarks}
                    onChange={(e) =>
                      setPackageForm((p) => ({ ...p, remarks: e.target.value }))
                    }
                    placeholder="Optional remarks..."
                  />
                </div>
              </div>

              <div className="modal-actions">
                <button className="btn-secondary" type="button" onClick={closeCreateModal}>
                  Cancel
                </button>
                <button className="btn-primary" type="submit" disabled={savingCreate}>
                  {savingCreate ? "Saving..." : "Create Package"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showStatusModal && (
        <div
          className="modal-overlay"
          onMouseDown={(e) => e.target.classList.contains("modal-overlay") && closeStatusModal()}
        >
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h3 className="modal-title">Update Status</h3>
                <p className="modal-subtitle">
                  Tracking No: <b>{selectedRow?.tracking_no}</b>
                </p>
              </div>
              <button className="modal-x" type="button" onClick={closeStatusModal}>
                ✕
              </button>
            </div>

            <form onSubmit={submitStatus} className="modal-form">
              <div className="grid">
                <div className="field">
                  <label>Current Location</label>
                  <input
                    className="input"
                    value={statusForm.location}
                    onChange={(e) =>
                      setStatusForm((p) => ({ ...p, location: e.target.value }))
                    }
                    required
                  />
                </div>

                <div className="field">
                  <label>Status</label>
                  <select
                    className="input"
                    value={statusForm.status}
                    onChange={(e) =>
                      setStatusForm((p) => ({ ...p, status: e.target.value }))
                    }
                    required
                  >
                    {statusOptions.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field full">
                  <label>Remarks</label>
                  <input
                    className="input"
                    value={statusForm.remarks}
                    onChange={(e) =>
                      setStatusForm((p) => ({ ...p, remarks: e.target.value }))
                    }
                    placeholder="e.g. Your package arrived at Pasig hub"
                  />
                </div>
              </div>

              <div className="modal-actions">
                <button className="btn-secondary" type="button" onClick={closeStatusModal}>
                  Cancel
                </button>
                <button className="btn-primary" type="submit" disabled={savingStatus}>
                  {savingStatus ? "Updating..." : "Update Status"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showHistoryModal && (
        <div
          className="modal-overlay"
          onMouseDown={(e) => e.target.classList.contains("modal-overlay") && closeHistoryModal()}
        >
          <div className="modal confirm-modal logistic-history-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h3 className="modal-title">Tracking History</h3>
                <p className="modal-subtitle">
                  Tracking No: <b>{historyRow?.tracking_no}</b>
                </p>
              </div>
              <button className="modal-x" type="button" onClick={closeHistoryModal}>
                ✕
              </button>
            </div>

            <div className="modal-form">
              <div className="logistic-summary">
                <div><strong>Courier:</strong> {historyRow?.courier_name || "Internal"}</div>
                <div><strong>External Tracking:</strong> {historyRow?.external_tracking_no || "-"}</div>
                <div><strong>Origin:</strong> {historyRow?.origin_branch || "-"}</div>
                <div><strong>Destination:</strong> {historyRow?.destination_branch || "-"}</div>
                <div><strong>Current Status:</strong> {historyRow?.current_status || "-"}</div>
                <div><strong>Current Location:</strong> {historyRow?.current_location || "-"}</div>
              </div>

              {historyLoading ? (
                <div className="loading">Loading history…</div>
              ) : historyRows.length === 0 ? (
                <div className="empty">No tracking history found.</div>
              ) : (
                <div className="tracking-timeline">
                  {historyRows.map((item, index) => (
                    <div key={item.id} className="tracking-item">
                      <div className="tracking-left">
                        <div className="tracking-time">{formatDateTime(item.created_at)}</div>
                      </div>

                      <div className="tracking-center">
                        <div className="tracking-dot" />
                        {index !== historyRows.length - 1 && <div className="tracking-line" />}
                      </div>

                      <div className="tracking-right">
                        <div className="tracking-status">{item.status || "-"}</div>
                        <div className="tracking-location">Location: {item.location || "-"}</div>
                        <div className="tracking-remarks">{item.remarks || "-"}</div>
                        <div className="tracking-updated-by">Updated by: {item.updated_by || "-"}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="modal-actions">
                <button className="btn-primary" type="button" onClick={closeHistoryModal}>
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