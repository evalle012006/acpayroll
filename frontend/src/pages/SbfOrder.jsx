import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/SbfOrder.css";
import api from "../api/axiosClient";

const readUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
};

const norm = (v) => String(v ?? "").trim().toLowerCase();

export default function SbfOrder() {
  const navigate = useNavigate();
  const user = useMemo(() => readUser(), []);
  const role = norm(user?.role);
  const department = norm(user?.department);

const isAdmin = role === "admin";
const isIt = role === "it";
const isHr = role === "hr";
const isAccounting = role === "accounting";
const isBranchManager = role === "branch manager";
const isAreaManager = role === "area manager";
const isRegionalManager = role === "regional manager";
const isAssistantVicePresident = role === "assistant vice president";
const isVicePresident = role === "vice president";
const isSeniorVicePresident = role === "senior vice president";
const isPresident = role === "president";

const isOfficeOfPresident = department === "office of the president";
const isOperationDepartment = department === "operation department";
const isAuditDepartment = department === "audit department";
const isItDepartment = department === "it department";
const isTreadDepartment = department === "tread department";
const isHrDepartment = department === "hr department";
const isAccountingDepartment = department === "accounting department";

  const accountingManager =
    isAccountingDepartment &&
    (
      isBranchManager ||
      isAreaManager ||
      isRegionalManager ||
      isAssistantVicePresident ||
      isVicePresident ||
      isSeniorVicePresident
    );

  const canView =
    isAdmin ||
    isIt ||
    isHr ||
    isAccounting ||
    isPresident ||
    isOfficeOfPresident ||
    accountingManager;

  const canCreate =
    isAdmin ||
    isIt ||
    isHr ||
    isAccounting ||
    isPresident ||
    isOfficeOfPresident ||
    accountingManager;

  const canApprove =
    isAdmin ||
    isIt ||
    isHr ||
    isAccounting ||
    isPresident ||
    isOfficeOfPresident ||
    accountingManager;

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const [showCreate, setShowCreate] = useState(false);
  const [showView, setShowView] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [attachment, setAttachment] = useState(null);

  const [form, setForm] = useState({
    employee_no: "",
    employee_name: "",
    branch_code: "",
    branch_name: "",
    assistance_type: "",
    amount: "",
    reason: "",
    date_created: "",
    effective_date: "",
  });

  const filteredOrders = orders.filter((o) => {
    const text = `${o.order_no || ""} ${o.employee_no || ""} ${
      o.employee_name || ""
    } ${o.branch_code || ""} ${o.branch_name || ""} ${
      o.assistance_type || ""
    }`.toLowerCase();

    const matchesSearch = text.includes(search.toLowerCase());
    const matchesStatus = statusFilter === "All" || o.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const closeModal = () => {
    setShowCreate(false);
  };

  const openViewModal = (order) => {
    setSelectedOrder(order);
    setShowView(true);
  };

  const closeViewModal = () => {
    setSelectedOrder(null);
    setShowView(false);
  };

  const resetForm = () => {
    setForm({
      employee_no: "",
      employee_name: "",
      branch_code: "",
      branch_name: "",
      assistance_type: "",
      amount: "",
      reason: "",
      date_created: "",
      effective_date: "",
    });

    setAttachment(null);

    const fileInput = document.getElementById("sbf-attachment-input");
    if (fileInput) fileInput.value = "";
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await api.get("/sbf-orders");
      setOrders(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to fetch SBF orders:", err);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canView) {
      fetchOrders();
    }
  }, [canView]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!canCreate) {
      alert("Access denied");
      return;
    }

    try {
      setSubmitting(true);

      const data = new FormData();

      Object.entries(form).forEach(([key, value]) => {
        data.append(key, value ?? "");
      });

      data.set("amount", Number(form.amount || 0));

      if (attachment) {
        data.append("attachment", attachment);
      }

      await api.post("/sbf-orders", data, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      alert("SBF Order created successfully");
      resetForm();
      setShowCreate(false);
      fetchOrders();
    } catch (err) {
      console.error("Create SBF error:", err);
      alert(err?.response?.data?.message || "Failed to create SBF order");
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (id) => {
    if (!canApprove) {
      alert("Access denied");
      return;
    }

    try {
      await api.put(`/sbf-orders/${id}/approve`);
      alert("SBF Order approved");
      fetchOrders();
    } catch (err) {
      console.error("Approve error:", err);
      alert(err?.response?.data?.message || "Failed to approve order");
    }
  };

  const handleReject = async (id) => {
    if (!canApprove) {
      alert("Access denied");
      return;
    }

    const ok = window.confirm("Are you sure you want to reject this SBF order?");
    if (!ok) return;

    try {
      await api.put(`/sbf-orders/${id}/reject`);
      alert("SBF Order rejected");
      fetchOrders();
    } catch (err) {
      console.error("Reject error:", err);
      alert(err?.response?.data?.message || "Failed to reject order");
    }
  };

  const handleDownload = async (order) => {
    if (!order?.id) return;

    try {
      const res = await api.get(`/sbf-orders/${order.id}/download`, {
        responseType: "blob",
      });

      const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");

      link.href = blobUrl;
      link.download = order.attachment_name || `SBF-${order.id}-attachment`;
      document.body.appendChild(link);
      link.click();

      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Download SBF file error:", err);
      alert(err?.response?.data?.message || "Failed to download file");
    }
  };

  const formatAmount = (value) => {
    return Number(value || 0).toLocaleString();
  };

  const formatDate = (value) => {
    return value ? String(value).slice(0, 10) : "";
  };

  if (!canView) {
    return (
      <div className="exit-page">
        <div className="exit-topbar">
          <div>
            <h2 className="exit-title">SBF Order</h2>
            <p className="exit-subtitle">Access denied</p>
          </div>

          <div className="exit-actions">
            <button
              className="exit-btn exit-btn-ghost"
              type="button"
              onClick={() => navigate(-1)}
            >
              ← Back
            </button>
          </div>
        </div>

        <div className="exit-card">
          <div className="exit-empty">You do not have access to this page.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="exit-page">
      <div className="exit-topbar">
        <div>
          <h2 className="exit-title">SBF Order</h2>
          <p className="exit-subtitle">
            Manage Staff Benevolent Fund requests and approvals.
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

          {canCreate && (
            <button
              className="exit-btn exit-btn-primary"
              type="button"
              onClick={() => setShowCreate(true)}
            >
              + Create SBF
            </button>
          )}
        </div>
      </div>

      <div className="exit-card">
        <div className="exit-card-head">
          <div className="exit-card-title">Staff Benevolent Fund</div>
          <div className="exit-card-meta">{orders.length} Records</div>
        </div>

        <br />

        {loading ? (
          <div className="exit-empty">Loading...</div>
        ) : orders.length === 0 ? (
          <div className="exit-empty">No SBF orders found.</div>
        ) : (
          <div className="exit-table-wrap">
            <div className="exit-filters">
              <input
                className="exit-field exit-search"
                placeholder="Search order, employee..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              <select
                className="exit-field exit-filter-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="All">All Status</option>
                <option value="Pending">Pending</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>

            <table className="exit-table">
              <thead>
                <tr>
                  <th>Order No</th>
                  <th>Employee No</th>
                  <th>Employee Name</th>
                  <th>Branch Code</th>
                  <th>Branch Name</th>
                  <th>Assistance Type</th>
                  <th>Date Created</th>
                  <th>File</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredOrders.map((item) => (
                  <tr key={item.id}>
                    <td>{item.order_no}</td>
                    <td>{item.employee_no}</td>
                    <td>{item.employee_name}</td>
                    <td>{item.branch_code}</td>
                    <td>{item.branch_name}</td>
                    <td>{item.assistance_type}</td>
                    <td>{formatDate(item.date_created)}</td>
                    <td>
                      {item.attachment_path ? (
                        <button
                          className="sbf-btn sbf-btn-view"
                          type="button"
                          onClick={() => handleDownload(item)}
                        >
                          Download
                        </button>
                      ) : (
                        <span className="sbf-done">No File</span>
                      )}
                    </td>
                    <td>
                      <span
                        className={
                          item.status === "Approved"
                            ? "badge badge-approved"
                            : item.status === "Rejected"
                            ? "badge badge-rejected"
                            : "badge badge-pending"
                        }
                      >
                        {item.status || "Pending"}
                      </span>
                    </td>
                    <td>
                      <div className="sbf-actions">
                        <button
                          className="sbf-btn sbf-btn-view"
                          type="button"
                          onClick={() => openViewModal(item)}
                        >
                          View
                        </button>

                        {canApprove && item.status === "Pending" ? (
                          <>
                            <button
                              className="sbf-btn sbf-btn-approve"
                              type="button"
                              onClick={() => handleApprove(item.id)}
                            >
                              Approve
                            </button>

                            <button
                              className="sbf-btn sbf-btn-reject"
                              type="button"
                              onClick={() => handleReject(item.id)}
                            >
                              Reject
                            </button>
                          </>
                        ) : item.status === "Pending" ? (
                          <span className="sbf-done">Pending</span>
                        ) : (
                          <span className="sbf-done">Done</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredOrders.length === 0 && (
              <div className="exit-empty">No matching SBF orders found.</div>
            )}
          </div>
        )}
      </div>

      {showCreate && canCreate && (
        <div
          className="exit-modal-overlay"
          onMouseDown={(e) => {
            if (e.target.classList.contains("exit-modal-overlay")) {
              closeModal();
            }
          }}
        >
          <div className="exit-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="exit-modal-head">
              <div>
                <h3 className="exit-modal-title">Create SBF Order</h3>
                <p className="exit-modal-sub">
                  Create a new Staff Benevolent Fund request.
                </p>
              </div>

              <button className="exit-x" type="button" onClick={closeModal}>
                ✕
              </button>
            </div>

            <form className="exit-form" onSubmit={handleSubmit}>
              <div className="exit-grid">
                <div className="exit-field">
                  <label>Employee No</label>
                  <input
                    type="text"
                    name="employee_no"
                    value={form.employee_no}
                    onChange={handleChange}
                    placeholder="Enter employee no"
                    required
                  />
                </div>

                <div className="exit-field">
                  <label>Employee Name</label>
                  <input
                    type="text"
                    name="employee_name"
                    value={form.employee_name}
                    onChange={handleChange}
                    placeholder="Enter employee name"
                    required
                  />
                </div>

                <div className="exit-field">
                  <label>Branch Code</label>
                  <input
                    type="text"
                    name="branch_code"
                    value={form.branch_code}
                    onChange={handleChange}
                    placeholder="Enter branch code"
                    required
                  />
                </div>

                <div className="exit-field">
                  <label>Branch Name</label>
                  <input
                    type="text"
                    name="branch_name"
                    value={form.branch_name}
                    onChange={handleChange}
                    placeholder="Enter branch name"
                    required
                  />
                </div>

                <div className="exit-field">
                  <label>Assistance Type</label>
                  <select
                    name="assistance_type"
                    value={form.assistance_type}
                    onChange={handleChange}
                    required
                  >
                    <option value="">Select assistance type</option>
                    <option value="Medical Assistance">
                      Medical Assistance
                    </option>
                    <option value="Cash Gift Assistance (Child Birth)">
                      Cash Gift Assistance (Child Birth)
                    </option>
                    <option value="Financial Assistance">
                      Financial Assistance
                    </option>
                    <option value="Death Benefits Assistance">
                      Death Benefits Assistance
                    </option>
                    <option value="Burial Assistance (Immediate Family)">
                      Burial Assistance (Immediate Family)
                    </option>
                    <option value="Calamity Financial Assistance">
                      Calamity Financial Assistance
                    </option>
                  </select>
                </div>

                <div className="exit-field">
                  <label>Amount</label>
                  <input
                    type="number"
                    name="amount"
                    value={form.amount}
                    onChange={handleChange}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    required
                  />
                </div>

                <div className="exit-field">
                  <label>Date Created</label>
                  <input
                    type="date"
                    name="date_created"
                    value={form.date_created}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="exit-field">
                  <label>Effective Date</label>
                  <input
                    type="date"
                    name="effective_date"
                    value={form.effective_date}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="exit-field full">
                  <label>Attachment</label>
                  <input
                    id="sbf-attachment-input"
                    type="file"
                    onChange={(e) =>
                      setAttachment(e.target.files?.[0] || null)
                    }
                  />

                  {attachment && (
                    <small className="view-value">
                      Selected file: {attachment.name}
                    </small>
                  )}
                </div>

                <div className="exit-field full">
                  <label>Reason</label>
                  <textarea
                    rows={3}
                    name="reason"
                    value={form.reason}
                    onChange={handleChange}
                    placeholder="Enter reason"
                    required
                  />
                </div>
              </div>

              <div className="exit-modal-actions">
                <button
                  className="exit-btn exit-btn-ghost"
                  type="button"
                  onClick={closeModal}
                >
                  Cancel
                </button>

                <button
                  className="exit-btn exit-btn-primary"
                  type="submit"
                  disabled={submitting}
                >
                  {submitting ? "Saving..." : "Create Order"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showView && selectedOrder && (
        <div
          className="exit-modal-overlay"
          onMouseDown={(e) => {
            if (e.target.classList.contains("exit-modal-overlay")) {
              closeViewModal();
            }
          }}
        >
          <div
            className="exit-modal view-modal"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="exit-modal-head">
              <h3 className="exit-modal-title">SBF Order Details</h3>

              <button className="exit-x" type="button" onClick={closeViewModal}>
                ✕
              </button>
            </div>

            <div className="view-grid">
              <div className="view-row">
                <span className="view-label">Order No</span>
                <span className="view-value">{selectedOrder.order_no}</span>
              </div>

              <div className="view-row">
                <span className="view-label">Employee No</span>
                <span className="view-value">{selectedOrder.employee_no}</span>
              </div>

              <div className="view-row">
                <span className="view-label">Employee Name</span>
                <span className="view-value">
                  {selectedOrder.employee_name}
                </span>
              </div>

              <div className="view-row">
                <span className="view-label">Branch</span>
                <span className="view-value">
                  {selectedOrder.branch_code} - {selectedOrder.branch_name}
                </span>
              </div>

              <div className="view-row">
                <span className="view-label">Assistance Type</span>
                <span className="view-value">
                  {selectedOrder.assistance_type}
                </span>
              </div>

              <div className="view-row">
                <span className="view-label">Amount</span>
                <span className="view-value">
                  {formatAmount(selectedOrder.amount)}
                </span>
              </div>

              <div className="view-row">
                <span className="view-label">Status</span>
                <span className="view-value">{selectedOrder.status}</span>
              </div>

              <div className="view-row">
                <span className="view-label">Date Created</span>
                <span className="view-value">
                  {formatDate(selectedOrder.date_created)}
                </span>
              </div>

              <div className="view-row">
                <span className="view-label">Effective Date</span>
                <span className="view-value">
                  {formatDate(selectedOrder.effective_date)}
                </span>
              </div>

              <div className="view-row full">
                <span className="view-label">Attachment</span>

                {selectedOrder.attachment_path ? (
                  <div className="view-reason">
                    <div>
                      {selectedOrder.attachment_name || "Uploaded File"}
                    </div>

                    <br />

                    <button
                      className="exit-btn exit-btn-primary"
                      type="button"
                      onClick={() => handleDownload(selectedOrder)}
                    >
                      Download File
                    </button>
                  </div>
                ) : (
                  <div className="view-reason">No file uploaded</div>
                )}
              </div>

              <div className="view-row full">
                <span className="view-label">Reason</span>
                <div className="view-reason">{selectedOrder.reason}</div>
              </div>
            </div>

            <div className="exit-modal-actions">
              <button
                className="exit-btn exit-btn-primary"
                type="button"
                onClick={closeViewModal}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}