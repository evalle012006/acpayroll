import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axiosClient";
import "../styles/TransferStaffOrder.css";

const readUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
};

const toStr = (v) => String(v ?? "").trim();
const norm = (v) => toStr(v).toLowerCase();
const fmtDate = (d) => (d ? String(d).slice(0, 10) : "-");

const displayName = (s) => {
  const ln = toStr(s?.last_name);
  const fn = toStr(s?.first_name);
  const mn = toStr(s?.middle_name);
  const built = `${ln}${ln && fn ? ", " : ""}${fn}${mn ? ` ${mn}` : ""}`
    .replace(/\s+/g, " ")
    .trim();

  return built || toStr(s?.fullname) || "-";
};

const branchLabel = (b) =>
  b ? `${toStr(b.code)} - ${toStr(b.name)}`.trim() : "-";

const fileSizeLabel = (bytes) => {
  const n = Number(bytes || 0);
  if (!Number.isFinite(n) || n <= 0) return "-";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

export default function TransferStaffOrder() {
  const navigate = useNavigate();

  const user = useMemo(() => readUser(), []);
  const role = norm(user?.role);
  const canApprove = role === "admin";

  const [showModal, setShowModal] = useState(false);
  const [isRedeploy, setIsRedeploy] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");

  const [branches, setBranches] = useState([]);
  const [staff, setStaff] = useState([]);

  const [orders, setOrders] = useState([]);
  const [loadingRefs, setLoadingRefs] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");

  const [dateCreated, setDateCreated] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [division, setDivision] = useState("");
  const [area, setArea] = useState("");
  const [region, setRegion] = useState("");
  const [details, setDetails] = useState("");

  const [employeeId, setEmployeeId] = useState("");
  const [employeeQuery, setEmployeeQuery] = useState("");
  const [showEmployeeResults, setShowEmployeeResults] = useState(false);

  const [fromBranchId, setFromBranchId] = useState("");
  const [toBranchId, setToBranchId] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");

  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [orderFiles, setOrderFiles] = useState([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [filesError, setFilesError] = useState("");

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/login";
  }, []);

  useEffect(() => {
    const loadRefs = async () => {
      setLoadingRefs(true);
      setError("");

      try {
        const [bRes, sRes] = await Promise.all([
          api.get("/branches"),
          api.get("/staff"),
        ]);

        setBranches(Array.isArray(bRes.data) ? bRes.data : []);
        setStaff(Array.isArray(sRes.data) ? sRes.data : []);
      } catch (err) {
        const status = err?.response?.status;
        if (status === 401) return logout();
        setError(
          err?.response?.data?.message ||
            "Failed to load branches and staff."
        );
      } finally {
        setLoadingRefs(false);
      }
    };

    loadRefs();
  }, [logout]);

  const fetchOrders = useCallback(async () => {
    setLoadingOrders(true);
    setError("");

    try {
      const res = await api.get("/transfer-staff-orders");
      const list = Array.isArray(res.data) ? res.data : [];
      setOrders(list);

      setSelectedOrder((prev) => {
        if (!prev) return null;
        const updated = list.find((o) => Number(o.id) === Number(prev.id));
        return updated || null;
      });
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401) return logout();

      setError(
        err?.response?.data?.message || "Failed to load transfer orders."
      );
      setOrders([]);
      setSelectedOrder(null);
    } finally {
      setLoadingOrders(false);
    }
  }, [logout]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const fetchOrderFiles = useCallback(
    async (orderId) => {
      if (!orderId) {
        setOrderFiles([]);
        return;
      }

      setLoadingFiles(true);
      setFilesError("");

      try {
        const res = await api.get(`/transfer-staff-orders/${orderId}/files`);
        setOrderFiles(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        const status = err?.response?.status;
        if (status === 401) return logout();

        setFilesError(
          err?.response?.data?.message || "Failed to load transfer files."
        );
        setOrderFiles([]);
      } finally {
        setLoadingFiles(false);
      }
    },
    [logout]
  );

  useEffect(() => {
    if (!selectedOrder?.id) {
      setOrderFiles([]);
      setFilesError("");
      return;
    }

    fetchOrderFiles(selectedOrder.id);
  }, [selectedOrder, fetchOrderFiles]);

  const selectedEmployee = useMemo(
    () => staff.find((s) => Number(s.id) === Number(employeeId)) || null,
    [staff, employeeId]
  );

  const fromBranch = useMemo(
    () => branches.find((b) => Number(b.id) === Number(fromBranchId)) || null,
    [branches, fromBranchId]
  );

  const toBranch = useMemo(
    () => branches.find((b) => Number(b.id) === Number(toBranchId)) || null,
    [branches, toBranchId]
  );

  const filteredOrders = useMemo(() => {
    const q = toStr(appliedSearch).toLowerCase();
    if (!q) return orders;

    return orders.filter((o) => {
      const haystack = [
        o.order_no,
        o.employee_name,
        o.prev_branch_code,
        o.prev_branch_name,
        o.to_branch_code,
        o.to_branch_name,
        o.division,
        o.area,
        o.region,
        o.status,
        o.rejection_reason,
        fmtDate(o.date_created),
        fmtDate(o.effective_date),
      ]
        .map(toStr)
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [orders, appliedSearch]);

  const filteredStaff = useMemo(() => {
    const q = toStr(employeeQuery).toLowerCase();

    if (!q) {
      return staff.slice(0, 15);
    }

    return staff
      .filter((s) => {
        const branch = branches.find((b) => Number(b.id) === Number(s.branch_id));
        const haystack = [
          s.id,
          s.employee_no,
          s.fullname,
          s.first_name,
          s.middle_name,
          s.last_name,
          displayName(s),
          s.position,
          s.branch_name,
          branch?.code,
          branch?.name,
        ]
          .map(toStr)
          .join(" ")
          .toLowerCase();

        return haystack.includes(q);
      })
      .slice(0, 20);
  }, [staff, employeeQuery, branches]);

  useEffect(() => {
    if (!showModal || !selectedEmployee) return;

    if (selectedEmployee.branch_id && !fromBranchId) {
      setFromBranchId(String(selectedEmployee.branch_id));
    }
  }, [showModal, selectedEmployee, fromBranchId]);

  const approveOrder = async (id) => {
    if (!canApprove) return;
    setError("");

    try {
      const res = await api.put(`/transfer-staff-orders/${id}/approve`);
      const updatedOrder = res.data;

      setOrders((prev) =>
        prev.map((o) => (Number(o.id) === Number(id) ? updatedOrder : o))
      );
      setSelectedOrder((prev) =>
        prev && Number(prev.id) === Number(id) ? updatedOrder : prev
      );
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401) return logout();

      setError(err?.response?.data?.message || "Failed to approve order.");
    }
  };

  const rejectOrder = async (id) => {
    if (!canApprove) return;

    const reason = prompt("Enter rejection reason:");
    if (!reason || !reason.trim()) return;

    setError("");

    try {
      const res = await api.put(`/transfer-staff-orders/${id}/reject`, {
        reason: reason.trim(),
      });
      const updatedOrder = res.data;

      setOrders((prev) =>
        prev.map((o) => (Number(o.id) === Number(id) ? updatedOrder : o))
      );
      setSelectedOrder((prev) =>
        prev && Number(prev.id) === Number(id) ? updatedOrder : prev
      );
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401) return logout();

      setError(err?.response?.data?.message || "Failed to reject order.");
    }
  };

  const resetForm = () => {
    setDateCreated(new Date().toISOString().slice(0, 10));
    setDivision("");
    setArea("");
    setRegion("");
    setDetails("");

    setEmployeeId("");
    setEmployeeQuery("");
    setShowEmployeeResults(false);

    setFromBranchId("");
    setToBranchId("");
    setEffectiveDate("");

    setSelectedFiles([]);

    setIsRedeploy(false);
    setError("");
  };

  const openModal = () => {
    resetForm();
    setIsRedeploy(false);
    setShowModal(true);
  };

  const handleRedeploy = (order) => {
    if (!order) {
      setError("Select an approved order first.");
      return;
    }

    if (toStr(order.status).toLowerCase() !== "approved") {
      setError("Only approved orders can be re-deployed.");
      return;
    }

    resetForm();

    setIsRedeploy(true);
    setShowModal(true);

    setEmployeeId(String(order.employee_id || ""));
    setEmployeeQuery(toStr(order.employee_name));
    setFromBranchId(String(order.to_branch_id || ""));
    setToBranchId("");

    setDivision(toStr(order.division));
    setArea("");
    setRegion("");
    setDateCreated(new Date().toISOString().slice(0, 10));
    setEffectiveDate("");
    setDetails(
      `Re-deployment of ${toStr(order.employee_name)} from ${toStr(
        order.to_branch_code
      )} - ${toStr(order.to_branch_name)}.`
    );
  };

  const openRedeployFromTop = () => {
    setError("");

    if (!selectedOrder) {
      setError("Select an approved order from the table first.");
      return;
    }

    if (toStr(selectedOrder.status).toLowerCase() !== "approved") {
      setError("Only approved orders can be re-deployed.");
      return;
    }

    handleRedeploy(selectedOrder);
  };

  const closeModal = () => {
    setShowModal(false);
    resetForm();
  };

  useEffect(() => {
    if (!showModal) return;

    const onKeyDown = (e) => e.key === "Escape" && closeModal();
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [showModal]);

  const handleApplyOrderSearch = () => {
    setAppliedSearch(search);
  };

  const handleClearOrderSearch = () => {
    setSearch("");
    setAppliedSearch("");
  };

  const handleChooseEmployee = (s) => {
    setEmployeeId(String(s.id || ""));
    setEmployeeQuery(
      `${displayName(s)}${s.employee_no ? ` (${s.employee_no})` : ""}`
    );
    setShowEmployeeResults(false);

    if (s.branch_id) {
      setFromBranchId(String(s.branch_id));
    }
  };

  const saveOrder = async () => {
    setError("");

    if (!employeeId) return setError("Select employee.");
    if (!fromBranchId) return setError("Select previous branch.");
    if (!toBranchId) return setError("Select transfer branch.");
    if (String(fromBranchId) === String(toBranchId)) {
      return setError("Previous and transfer branch must differ.");
    }
    if (!toStr(division)) return setError("Division required.");
    if (!toStr(area)) return setError("Area required.");
    if (!toStr(region)) return setError("Region required.");
    if (!dateCreated) return setError("Date Created required.");
    if (!effectiveDate) return setError("Effective date required.");
    if (!toStr(details)) return setError("Details required.");

    const payload = {
      employee_id: Number(employeeId),
      employee_name: displayName(selectedEmployee),

      prev_branch_id: Number(fromBranchId),
      prev_branch_code: toStr(fromBranch?.code),
      prev_branch_name: toStr(fromBranch?.name),

      to_branch_id: Number(toBranchId),
      to_branch_code: toStr(toBranch?.code),
      to_branch_name: toStr(toBranch?.name),

      area: toStr(area),
      region: toStr(region),
      division: toStr(division),
      date_created: dateCreated,
      effective_date: effectiveDate,
      details: toStr(details),
    };

    setSaving(true);

    try {
      const res = await api.post("/transfer-staff-orders", payload);
      const created = res.data;

      setOrders((prev) => [created, ...prev]);
      setSelectedOrder(created);

      if (selectedFiles.length > 0 && created?.id) {
        const formData = new FormData();
        selectedFiles.forEach((file) => formData.append("files", file));
        await api.post(`/transfer-staff-orders/${created.id}/files`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }

      closeModal();
      fetchOrders();
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401) return logout();

      setError(err?.response?.data?.message || "Failed to save transfer order.");
    } finally {
      setSaving(false);
    }
  };

  const uploadFilesForSelectedOrder = async () => {
    if (!selectedOrder?.id) {
      setFilesError("Select a transfer order first.");
      return;
    }

    if (!selectedFiles.length) {
      setFilesError("Choose file first.");
      return;
    }

    setUploadingFiles(true);
    setFilesError("");

    try {
      const formData = new FormData();
      selectedFiles.forEach((file) => formData.append("files", file));

      await api.post(`/transfer-staff-orders/${selectedOrder.id}/files`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setSelectedFiles([]);
      fetchOrderFiles(selectedOrder.id);
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401) return logout();

      setFilesError(
        err?.response?.data?.message || "Failed to upload transfer files."
      );
    } finally {
      setUploadingFiles(false);
    }
  };

  const handleDownloadFile = async (fileItem) => {
    try {
      const res = await api.get(
        `/transfer-staff-orders/files/${fileItem.id}/download`,
        { responseType: "blob" }
      );

      const blob = new Blob([res.data]);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileItem.original_name || fileItem.filename || "download";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401) return logout();

      setFilesError(
        err?.response?.data?.message || "Failed to download file."
      );
    }
  };

  const colCount = canApprove ? 11 : 10;

  return (
    <div className="order-page">
      <div className="order-page-header">
        <div>
          <h2 className="order-title">Transfer Staff Orders</h2>
          <p className="order-subtitle">
            Manage staff transfers between branches.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            className="btn-secondary"
            onClick={() => navigate("/transactions")}
            type="button"
          >
            ← Back
          </button>

          <button
            className="btn-secondary"
            onClick={openRedeployFromTop}
            type="button"
          >
            Re-deploy
          </button>

          <button className="btn-primary" onClick={openModal} type="button">
            + Create Transfer Order
          </button>
        </div>
      </div>

      {error && (
        <div
          className="card"
          style={{
            padding: 12,
            border: "1px solid var(--border)",
            marginBottom: 12,
          }}
        >
          <strong style={{ color: "#ef4444" }}>{error}</strong>
        </div>
      )}

      {selectedOrder ? (
        <div
          className="order-selected"
          onClick={() => {
            setSelectedOrder(null);
            setError("");
            setFilesError("");
            setOrderFiles([]);
          }}
          style={{ cursor: "pointer" }}
          title="Click to clear selected order"
        >
          <strong>Selected Order:</strong> {toStr(selectedOrder.order_no)} —{" "}
          {toStr(selectedOrder.employee_name)} ({toStr(selectedOrder.status)})
        </div>
      ) : null}

      <div className="order-card">
        <div
          className="order-card-head"
          style={{
            display: "flex",
            gap: 12,
            justifyContent: "space-between",
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div className="order-card-title">Transfer Orders</div>

            <div className="order-search-wrap">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleApplyOrderSearch()}
                placeholder="Search order no, employee, branch, division, area, region..."
                className="order-search-input"
              />
              <button
                className="btn-primary"
                type="button"
                onClick={handleApplyOrderSearch}
              >
                Search
              </button>
              <button
                className="btn-secondary"
                type="button"
                onClick={handleClearOrderSearch}
              >
                Clear
              </button>
            </div>
          </div>

          <div className="order-card-meta">{filteredOrders.length} Records</div>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Order No</th>
                <th>Employee</th>
                <th>From</th>
                <th>To</th>
                <th>Division</th>
                <th>Area</th>
                <th>Region</th>
                <th>Date Created</th>
                <th>Effective Date</th>
                <th>Status</th>
                {canApprove && <th>Actions</th>}
              </tr>
            </thead>

            <tbody>
              {loadingOrders ? (
                <tr>
                  <td colSpan={colCount} className="empty-state">
                    Loading orders…
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="empty-state">
                    {toStr(appliedSearch)
                      ? "No matching transfer orders found."
                      : "No transfer orders found."}
                  </td>
                </tr>
              ) : (
                filteredOrders.map((o) => {
                  const isSelected = Number(selectedOrder?.id) === Number(o.id);

                  return (
                    <tr
                      key={o.id}
                      onClick={() => {
                        setSelectedOrder(o);
                        setError("");
                        setFilesError("");
                      }}
                      style={{
                        cursor: "pointer",
                        background: isSelected ? "rgba(59,130,246,0.12)" : "",
                      }}
                    >
                      <td className="td-strong">{o.order_no}</td>
                      <td>{o.employee_name}</td>
                      <td>
                        {toStr(o.prev_branch_code)} - {toStr(o.prev_branch_name)}
                      </td>
                      <td>
                        {toStr(o.to_branch_code)} - {toStr(o.to_branch_name)}
                      </td>
                      <td>{o.division}</td>
                      <td>{o.area}</td>
                      <td>{o.region || "-"}</td>
                      <td>{fmtDate(o.date_created)}</td>
                      <td>{fmtDate(o.effective_date)}</td>
                      <td>
                        {o.status}
                        {o.status === "Rejected" && o.rejection_reason ? (
                          <div
                            style={{
                              fontSize: 12,
                              color: "var(--muted)",
                              marginTop: 4,
                            }}
                          >
                            Reason: {o.rejection_reason}
                          </div>
                        ) : null}
                      </td>

                      {canApprove && (
                        <td onClick={(e) => e.stopPropagation()}>
                          {o.status === "Pending" ? (
                            <div
                              style={{
                                display: "flex",
                                gap: 8,
                                flexWrap: "wrap",
                              }}
                            >
                              <button
                                className="btn-primary"
                                type="button"
                                onClick={() => approveOrder(o.id)}
                              >
                                Approve
                              </button>
                              <button
                                className="btn-secondary"
                                type="button"
                                onClick={() => rejectOrder(o.id)}
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontWeight: 800 }}>{o.status}</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div
          style={{
            padding: 12,
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <button
            className="btn-secondary"
            onClick={fetchOrders}
            type="button"
            disabled={loadingOrders}
          >
            {loadingOrders ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      <div className="order-card" style={{ marginTop: 16 }}>
        <div
          className="order-card-head"
          style={{
            display: "flex",
            gap: 12,
            justifyContent: "space-between",
            flexWrap: "wrap",
          }}
        >
          <div className="order-card-title">Transfer Files</div>
          <div className="order-card-meta">
            {selectedOrder
              ? `For ${toStr(selectedOrder.order_no)}`
              : "Select a transfer order"}
          </div>
        </div>

        <div style={{ padding: 12 }}>
          {!selectedOrder ? (
            <div className="empty-state">
              Select a transfer order first to upload or download files.
            </div>
          ) : (
            <>
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  flexWrap: "wrap",
                  alignItems: "center",
                  marginBottom: 12,
                }}
              >
                <input
                  type="file"
                  multiple
                  onChange={(e) =>
                    setSelectedFiles(Array.from(e.target.files || []))
                  }
                />
                <button
                  className="btn-primary"
                  type="button"
                  onClick={uploadFilesForSelectedOrder}
                  disabled={uploadingFiles}
                >
                  {uploadingFiles ? "Uploading..." : "Upload Files"}
                </button>
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={() => fetchOrderFiles(selectedOrder.id)}
                  disabled={loadingFiles}
                >
                  {loadingFiles ? "Loading..." : "Refresh Files"}
                </button>
              </div>

              {selectedFiles.length > 0 ? (
                <div style={{ marginBottom: 12 }}>
                  <strong>Selected:</strong>{" "}
                  {selectedFiles.map((f) => f.name).join(", ")}
                </div>
              ) : null}

              {filesError ? (
                <div style={{ marginBottom: 12, color: "#ef4444", fontWeight: 700 }}>
                  {filesError}
                </div>
              ) : null}

              {loadingFiles ? (
                <div className="empty-state">Loading transfer files…</div>
              ) : orderFiles.length === 0 ? (
                <div className="empty-state">No transfer files uploaded yet.</div>
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>File Name</th>
                        <th>Size</th>
                        <th>Uploaded At</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orderFiles.map((f) => (
                        <tr key={f.id}>
                          <td>{toStr(f.original_name || f.filename)}</td>
                          <td>{fileSizeLabel(f.file_size)}</td>
                          <td>{fmtDate(f.created_at || f.uploaded_at)}</td>
                          <td>
                            <button
                              className="btn-secondary"
                              type="button"
                              onClick={() => handleDownloadFile(f)}
                            >
                              Download
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onMouseDown={closeModal}>
          <div
            className="modal saas-modal"
            onMouseDown={(e) => e.stopPropagation()}
            style={{ maxWidth: 1100 }}
          >
            <div className="modal-head">
              <div>
                <h3 className="modal-title">
                  {isRedeploy ? "Re-deploy Staff" : "Create Transfer Order"}
                </h3>
                <p className="modal-subtitle">
                  {isRedeploy
                    ? "Create a new deployment order from the selected approved order."
                    : "Order No. will be auto-generated on save."}
                </p>
              </div>

              <button className="modal-x" onClick={closeModal} type="button">
                ✕
              </button>
            </div>

            {loadingRefs ? (
              <div className="empty-state">Loading staff & branches…</div>
            ) : (
              <>
                <div className="form-grid">
                  <div className="field">
                    <label>Date Created</label>
                    <input
                      type="date"
                      value={dateCreated}
                      onChange={(e) => setDateCreated(e.target.value)}
                    />
                  </div>

                  <div className="field">
                    <label>Effective Date</label>
                    <input
                      type="date"
                      value={effectiveDate}
                      onChange={(e) => setEffectiveDate(e.target.value)}
                    />
                  </div>

                  <div className="field full" style={{ position: "relative" }}>
                    <label>Employee</label>
                    <input
                      type="text"
                      value={employeeQuery}
                      disabled={isRedeploy}
                      placeholder="Search employee no, name, position, branch..."
                      onChange={(e) => {
                        setEmployeeQuery(e.target.value);
                        setEmployeeId("");
                        setShowEmployeeResults(true);
                      }}
                      onFocus={() => {
                        if (!isRedeploy) setShowEmployeeResults(true);
                      }}
                    />

                    {!isRedeploy && showEmployeeResults && (
                      <div
                        style={{
                          position: "absolute",
                          left: 0,
                          right: 0,
                          top: "100%",
                          marginTop: 6,
                          maxHeight: 240,
                          overflowY: "auto",
                          background: "var(--card, #0f172a)",
                          border: "1px solid var(--border, rgba(255,255,255,0.1))",
                          borderRadius: 12,
                          zIndex: 20,
                          boxShadow: "0 12px 30px rgba(0,0,0,0.25)",
                        }}
                      >
                        {filteredStaff.length === 0 ? (
                          <div
                            style={{
                              padding: 12,
                              color: "var(--muted)",
                              fontSize: 14,
                            }}
                          >
                            No employee found.
                          </div>
                        ) : (
                          filteredStaff.map((s) => (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => handleChooseEmployee(s)}
                              style={{
                                width: "100%",
                                textAlign: "left",
                                padding: "10px 12px",
                                border: "none",
                                borderBottom: "1px solid var(--border, rgba(255,255,255,0.08))",
                                background: "transparent",
                                color: "inherit",
                                cursor: "pointer",
                              }}
                            >
                              <div style={{ fontWeight: 700 }}>
                                {displayName(s)}
                                {s.employee_no ? ` (${s.employee_no})` : ""}
                              </div>
                              <div
                                style={{
                                  fontSize: 12,
                                  opacity: 0.8,
                                  marginTop: 2,
                                }}
                              >
                                {toStr(s.position) || "No position"}
                                {s.branch_id
                                  ? ` • ${
                                      branchLabel(
                                        branches.find(
                                          (b) => Number(b.id) === Number(s.branch_id)
                                        )
                                      ) || "-"
                                    }`
                                  : ""}
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  <div className="field">
                    <label>Previous Branch</label>
                    <select
                      value={fromBranchId}
                      onChange={(e) => setFromBranchId(e.target.value)}
                    >
                      <option value="">Select branch…</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {branchLabel(b)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label>Transfer To</label>
                    <select
                      value={toBranchId}
                      onChange={(e) => setToBranchId(e.target.value)}
                    >
                      <option value="">Select branch…</option>
                      {branches
                        .filter((b) => String(b.id) !== String(fromBranchId))
                        .map((b) => (
                          <option key={b.id} value={b.id}>
                            {branchLabel(b)}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="field">
                    <label>Division</label>
                    <input
                      value={division}
                      onChange={(e) => setDivision(e.target.value)}
                    />
                  </div>

                  <div className="field">
                    <label>Area</label>
                    <input value={area} onChange={(e) => setArea(e.target.value)} />
                  </div>

                  <div className="field">
                    <label>Region</label>
                    <input
                      value={region}
                      onChange={(e) => setRegion(e.target.value)}
                    />
                  </div>

                  <div className="field full">
                    <label>Details</label>
                    <textarea
                      rows={3}
                      value={details}
                      onChange={(e) => setDetails(e.target.value)}
                      placeholder="Write transfer details…"
                    />
                  </div>

                  <div className="field full">
                    <label>Transfer Files</label>
                    <input
                      type="file"
                      multiple
                      onChange={(e) =>
                        setSelectedFiles(Array.from(e.target.files || []))
                      }
                    />
                    {selectedFiles.length > 0 ? (
                      <div style={{ marginTop: 8, fontSize: 13 }}>
                        {selectedFiles.map((f) => f.name).join(", ")}
                      </div>
                    ) : null}
                  </div>
                </div>

                {selectedEmployee && !isRedeploy ? (
                  <div
                    style={{
                      marginTop: 10,
                      fontSize: 13,
                      color: "var(--muted)",
                    }}
                  >
                    Selected: <strong>{displayName(selectedEmployee)}</strong>
                    {selectedEmployee?.employee_no
                      ? ` (${selectedEmployee.employee_no})`
                      : ""}
                  </div>
                ) : null}

                {error ? (
                  <div style={{ marginTop: 10, color: "#ef4444", fontWeight: 800 }}>
                    {error}
                  </div>
                ) : null}

                <div className="modal-buttons">
                  <button
                    className="btn-secondary"
                    onClick={closeModal}
                    type="button"
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn-primary"
                    onClick={saveOrder}
                    type="button"
                    disabled={saving}
                  >
                    {saving ? "Saving..." : "Save Order"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}