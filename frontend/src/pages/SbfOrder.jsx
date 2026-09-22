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

const formatAmount = (value) =>
  Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatDate = (value) => {
  if (!value) return "—";
  return String(value).slice(0, 10);
};

const getInitial = (name) => {
  const value = String(name || "").trim();
  return value ? value.charAt(0).toUpperCase() : "?";
};

const getStatusClass = (status) => {
  const s = norm(status);

  if (s === "approved") return "approved";
  if (s === "rejected") return "rejected";

  return "pending";
};

export default function SbfOrder() {
  const navigate = useNavigate();

  const user = useMemo(() => readUser(), []);

  const role = norm(user?.role);
  const department = norm(user?.department);

  /* =========================================================
     USER / ROLE FLAGS
  ========================================================= */

  const isAdmin = role === "admin";
  const isIt = role === "it";
  const isHr = role === "hr";
  const isAccounting = role === "accounting";
  const isPresident = role === "president";

  const isBranchManager = role === "branch manager";
  const isAreaManager = role === "area manager";
  const isRegionalManager = role === "regional manager";
  const isAssistantVicePresident = role === "assistant vice president";
  const isVicePresident = role === "vice president";
  const isSeniorVicePresident = role === "senior vice president";

  const isOperationDepartment = department === "operation department";
  const isOfficeOfPresident = department === "office of the president";
  const isTreadDepartment = department === "tread department";
  const isItDepartment = department === "it department";
  const isHrDepartment = department === "hr department";
  const isAccountingDepartment = department === "accounting department";

  const managerRole =
    isBranchManager ||
    isAreaManager ||
    isRegionalManager ||
    isAssistantVicePresident ||
    isVicePresident ||
    isSeniorVicePresident;

  const itManager = isItDepartment && managerRole;
  const hrManager = isHrDepartment && managerRole;
  const accountingManager = isAccountingDepartment && managerRole;
  const treadAvp = isTreadDepartment && isAssistantVicePresident;

  /*
    OPERATION:
    BM   = view/download branch only
    AM   = view/download area only
    RM   = view/download region only
    AVP  = view/download division only
    VP   = view/download Operation + CREATE
    SVP  = view/download Operation + CREATE

    Backend handles the actual record scoping.
  */

  const operationCanView =
    isOperationDepartment &&
    (isBranchManager ||
      isAreaManager ||
      isRegionalManager ||
      isAssistantVicePresident ||
      isVicePresident ||
      isSeniorVicePresident);

  const operationCanCreate =
    isOperationDepartment &&
    (isVicePresident || isSeniorVicePresident);

  const canView =
    isAdmin ||
    isIt ||
    isHr ||
    isAccounting ||
    isPresident ||
    isOfficeOfPresident ||
    isTreadDepartment ||
    accountingManager ||
    itManager ||
    hrManager ||
    operationCanView;

  const canCreate =
    isAdmin ||
    isIt ||
    isHr ||
    isAccounting ||
    isPresident ||
    isOfficeOfPresident ||
    accountingManager ||
    itManager ||
    hrManager ||
    treadAvp ||
    operationCanCreate;

  const canApprove =
    isAdmin ||
    isIt ||
    isHr ||
    isAccounting ||
    isPresident ||
    isOfficeOfPresident ||
    accountingManager ||
    itManager ||
    hrManager;

  /* =========================================================
     STATE
  ========================================================= */

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [statusFilter, setStatusFilter] = useState("All");

  const [showCreate, setShowCreate] = useState(false);
  const [showView, setShowView] = useState(false);

  const [selectedOrder, setSelectedOrder] = useState(null);

  const [approvalHistory, setApprovalHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [attachment, setAttachment] = useState(null);

  const [employees, setEmployees] = useState([]);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
  const [employeesLoading, setEmployeesLoading] = useState(false);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

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

  /* =========================================================
     LOAD DATA
  ========================================================= */

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

  /* =========================================================
     COUNTS
  ========================================================= */

  const counts = useMemo(() => {
    const total = orders.length;

    const pending = orders.filter(
      (item) => norm(item.status) === "pending"
    ).length;

    const approved = orders.filter(
      (item) => norm(item.status) === "approved"
    ).length;

    const rejected = orders.filter(
      (item) => norm(item.status) === "rejected"
    ).length;

    return {
      total,
      pending,
      approved,
      rejected,
    };
  }, [orders]);

  /* =========================================================
     FILTER
  ========================================================= */

  const filteredOrders = useMemo(() => {
    const q = norm(search);

    return orders.filter((item) => {
      const searchable = [
        item.order_no,
        item.employee_no,
        item.employee_name,
        item.branch_code,
        item.branch_name,
        item.assistance_type,
        item.status,
      ]
        .map((v) => String(v || ""))
        .join(" ")
        .toLowerCase();

      const matchesSearch = !q || searchable.includes(q);

      const matchesStatus =
        statusFilter === "All" ||
        norm(item.status) === norm(statusFilter);

      return matchesSearch && matchesStatus;
    });
  }, [orders, search, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, pageSize]);

  /* =========================================================
     PAGINATION
  ========================================================= */

  const totalPages = Math.max(
    1,
    Math.ceil(filteredOrders.length / pageSize)
  );

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const paginatedOrders = useMemo(() => {
    const start = (page - 1) * pageSize;

    return filteredOrders.slice(start, start + pageSize);
  }, [filteredOrders, page, pageSize]);

  /* =========================================================
     SEARCH
  ========================================================= */

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  const handleClearSearch = () => {
    setSearchInput("");
    setSearch("");
    setStatusFilter("All");
    setPage(1);
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  /* =========================================================
     MODALS
  ========================================================= */

  const closeCreateModal = () => {
    setShowCreate(false);
  };

  const openViewModal = async (order) => {
    setSelectedOrder(order);
    setShowView(true);

    setApprovalHistory([]);
    setHistoryLoading(true);

    try {
      const res = await api.get(
        `/sbf-orders/${order.id}/history`
      );

      setApprovalHistory(
        Array.isArray(res.data) ? res.data : []
      );
    } catch (err) {
      console.error(
        "Failed to load SBF approval history:",
        err
      );

      setApprovalHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const closeViewModal = () => {
    setSelectedOrder(null);
    setApprovalHistory([]);
    setHistoryLoading(false);
    setShowView(false);
  };

  /* =========================================================
     FORM
  ========================================================= */

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
    setEmployeeSearch("");
    setShowEmployeeDropdown(false);

    const fileInput = document.getElementById(
      "sbf-attachment-input"
    );

    if (fileInput) {
      fileInput.value = "";
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const fetchEmployees = async () => {
    try {
      setEmployeesLoading(true);

      const res = await api.get("/staff");

      const rows = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.staff)
        ? res.data.staff
        : Array.isArray(res.data?.data)
        ? res.data.data
        : [];

      setEmployees(rows);
    } catch (err) {
      console.error("Failed to load employees:", err);
      setEmployees([]);
    } finally {
      setEmployeesLoading(false);
    }
  };

  useEffect(() => {
    if (showCreate && canCreate && employees.length === 0) {
      fetchEmployees();
    }
  }, [showCreate, canCreate]);

  const filteredEmployees = useMemo(() => {
  const q = norm(employeeSearch);

  if (!q) {
    return employees.slice(0, 30);
  }

  return employees
    .filter((employee) => {
      const searchable = [
        employee.employee_no,
        employee.id,
        employee.fullname,
        employee.first_name,
        employee.middle_name,
        employee.last_name,
        employee.branch_code,
        employee.branch_name,
      ]
        .map((value) => String(value || ""))
        .join(" ")
        .toLowerCase();

      return searchable.includes(q);
    })
    .slice(0, 30);
}, [employees, employeeSearch]);

const handleSelectEmployee = (employee) => {
  const employeeName =
    employee.fullname ||
    [
      employee.last_name,
      employee.first_name,
      employee.middle_name,
    ]
      .filter(Boolean)
      .join(", ");

  setForm((prev) => ({
    ...prev,
    employee_no: employee.employee_no || "",
    employee_name: employeeName,
    branch_code: employee.branch_code || "",
    branch_name: employee.branch_name || "",
  }));

  setEmployeeSearch(employeeName);
  setShowEmployeeDropdown(false);
};

  /* =========================================================
     CREATE
  ========================================================= */

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

      await fetchOrders();
    } catch (err) {
      console.error("Create SBF error:", err);

      alert(
        err?.response?.data?.message ||
          "Failed to create SBF order"
      );
    } finally {
      setSubmitting(false);
    }
  };

  /* =========================================================
     APPROVE
  ========================================================= */

  const handleApprove = async (id) => {
    if (!canApprove) {
      alert("Access denied");
      return;
    }

    const ok = window.confirm(
      "Are you sure you want to approve this SBF order?"
    );

    if (!ok) return;

    try {
      await api.put(`/sbf-orders/${id}/approve`);

      alert("SBF Order approved");

      await fetchOrders();
    } catch (err) {
      console.error("Approve error:", err);

      alert(
        err?.response?.data?.message ||
          "Failed to approve order"
      );
    }
  };

  /* =========================================================
     REJECT
  ========================================================= */

  const handleReject = async (id) => {
    if (!canApprove) {
      alert("Access denied");
      return;
    }

    const ok = window.confirm(
      "Are you sure you want to reject this SBF order?"
    );

    if (!ok) return;

    try {
      await api.put(`/sbf-orders/${id}/reject`);

      alert("SBF Order rejected");

      await fetchOrders();
    } catch (err) {
      console.error("Reject error:", err);

      alert(
        err?.response?.data?.message ||
          "Failed to reject order"
      );
    }
  };

  /* =========================================================
     DOWNLOAD
  ========================================================= */

  const handleDownload = async (order) => {
    if (!order?.id) return;

    try {
      const res = await api.get(
        `/sbf-orders/${order.id}/download`
      );

      const url = res.data?.url;
      const fileName =
        res.data?.file_name ||
        order.attachment_name ||
        `SBF-${order.id}-attachment`;

      if (!url) {
        throw new Error(
          "Download URL was not returned by the server."
        );
      }

      const link = document.createElement("a");

      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.download = fileName;

      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error(
        "Download SBF file error:",
        err
      );

      alert(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to download file"
      );
    }
  };

  /* =========================================================
     ACCESS DENIED
  ========================================================= */

  if (!canView) {
    return (
      <div className="sbf-page">
        <section className="sbf-hero">
          <div className="sbf-hero-copy">
            <span className="sbf-eyebrow">
              HRIS TRANSACTIONS
            </span>

            <h1>SBF Orders</h1>

            <p>
              You do not have permission to view Staff
              Benevolent Fund orders.
            </p>
          </div>

          <div className="sbf-hero-actions">
            <button
              type="button"
              className="sbf-main-btn secondary"
              onClick={() => navigate(-1)}
            >
              ← Back
            </button>
          </div>
        </section>
      </div>
    );
  }

  /* =========================================================
     PAGE
  ========================================================= */

  return (
    <div className="sbf-page">

      {/* =====================================================
          HERO
      ===================================================== */}

      <section className="sbf-hero">
        <div className="sbf-hero-copy">
          <span className="sbf-eyebrow">
            HRIS TRANSACTIONS
          </span>

          <h1>SBF Orders</h1>

          <p>
            Create and manage Staff Benevolent Fund requests,
            supporting documents, approvals and assistance
            records.
          </p>

          <div className="sbf-flow">
            <span>PROCESS</span>

            <strong>
              Create SBF → Review Request → Approval
            </strong>
          </div>
        </div>

        <div className="sbf-hero-actions">

          <button
            type="button"
            className="sbf-main-btn secondary"
            onClick={() => navigate(-1)}
          >
            ← Back
          </button>

          <button
            type="button"
            className="sbf-main-btn secondary"
            onClick={fetchOrders}
            disabled={loading}
          >
            {loading ? "Loading..." : "Refresh"}
          </button>

          {canCreate && (
            <button
              type="button"
              className="sbf-main-btn primary"
              onClick={() => setShowCreate(true)}
            >
              + Create SBF
            </button>
          )}
        </div>
      </section>

      {/* =====================================================
          SUMMARY CARDS
      ===================================================== */}

      <section className="sbf-summary-grid">
        <button
          type="button"
          className={`sbf-summary-card ${
            statusFilter === "All" ? "active" : ""
          }`}
          onClick={() => setStatusFilter("All")}
        >
          <div className="sbf-summary-icon">
            ALL
          </div>

          <div className="sbf-summary-content">
            <small>Total Orders</small>
            <strong>{counts.total}</strong>
            <em>All SBF records</em>
          </div>
        </button>

        <button
          type="button"
          className={`sbf-summary-card pending ${
            statusFilter === "Pending" ? "active" : ""
          }`}
          onClick={() => setStatusFilter("Pending")}
        >
          <div className="sbf-summary-icon">
            P
          </div>

          <div className="sbf-summary-content">
            <small>Pending</small>
            <strong>{counts.pending}</strong>
            <em>Awaiting completion</em>
          </div>
        </button>

        <button
          type="button"
          className={`sbf-summary-card approved ${
            statusFilter === "Approved" ? "active" : ""
          }`}
          onClick={() => setStatusFilter("Approved")}
        >
          <div className="sbf-summary-icon">
            A
          </div>

          <div className="sbf-summary-content">
            <small>Approved</small>
            <strong>{counts.approved}</strong>
            <em>Completed SBF orders</em>
          </div>
        </button>

        <button
          type="button"
          className={`sbf-summary-card rejected ${
            statusFilter === "Rejected" ? "active" : ""
          }`}
          onClick={() => setStatusFilter("Rejected")}
        >
          <div className="sbf-summary-icon">
            R
          </div>

          <div className="sbf-summary-content">
            <small>Rejected</small>
            <strong>{counts.rejected}</strong>
            <em>Rejected requests</em>
          </div>
        </button>
      </section>

      {/* =====================================================
          SEARCH
      ===================================================== */}

      <section className="sbf-search-panel">
        <div className="sbf-search-copy">
          <strong>Search SBF Orders</strong>

          <span>
            Search by order number, employee, branch,
            assistance type or status.
          </span>
        </div>

        <div className="sbf-search-controls">
          <input
            type="text"
            className="sbf-search-input"
            placeholder="Search order no, employee, branch..."
            value={searchInput}
            onChange={(e) =>
              setSearchInput(e.target.value)
            }
            onKeyDown={handleSearchKeyDown}
          />

          <button
            type="button"
            className="sbf-search-btn primary"
            onClick={handleSearch}
          >
            Search
          </button>

          <button
            type="button"
            className="sbf-search-btn secondary"
            onClick={handleClearSearch}
          >
            Clear
          </button>
        </div>

        <div className="sbf-result-count">
          {filteredOrders.length}{" "}
          {filteredOrders.length === 1
            ? "result"
            : "results"}
        </div>
      </section>

      {/* =====================================================
          TABLE
      ===================================================== */}

      <section className="sbf-table-card">
        <div className="sbf-table-wrap">
          <table className="sbf-table">
            <thead>
              <tr>
                <th>Order No</th>
                <th>Employee</th>
                <th>Branch</th>
                <th>Assistance Type</th>
                <th>Amount</th>
                <th>Date Created</th>
                <th>File</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan="9"
                    className="sbf-empty-state"
                  >
                    Loading SBF orders...
                  </td>
                </tr>
              ) : paginatedOrders.length === 0 ? (
                <tr>
                  <td
                    colSpan="9"
                    className="sbf-empty-state"
                  >
                    No SBF orders found.
                  </td>
                </tr>
              ) : (
                paginatedOrders.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <span className="sbf-order-no">
                        {item.order_no || "—"}
                      </span>
                    </td>

                    <td>
                      <div className="sbf-employee-cell">
                        <div className="sbf-avatar">
                          {getInitial(
                            item.employee_name
                          )}
                        </div>

                        <div>
                          <strong>
                            {item.employee_name || "—"}
                          </strong>

                          <small>
                            {item.employee_no || "—"}
                          </small>
                        </div>
                      </div>
                    </td>

                    <td>
                      <div className="sbf-branch-cell">
                        <strong>
                          {item.branch_code || "—"}
                        </strong>

                        <span>
                          {item.branch_name || "—"}
                        </span>
                      </div>
                    </td>

                    <td>
                      <span className="sbf-assistance">
                        {item.assistance_type || "—"}
                      </span>
                    </td>

                    <td>
                      <strong className="sbf-amount">
                        ₱{formatAmount(item.amount)}
                      </strong>
                    </td>

                    <td>
                      {formatDate(item.date_created)}
                    </td>

                    <td>
                      {item.attachment_path ? (
                        <button
                          type="button"
                          className="sbf-file-btn"
                          onClick={() =>
                            handleDownload(item)
                          }
                        >
                          Download
                        </button>
                      ) : (
                        <span className="sbf-no-file">
                          No File
                        </span>
                      )}
                    </td>

                    <td>
                      <span
                        className={`sbf-status ${getStatusClass(
                          item.status
                        )}`}
                      >
                        {item.status || "Pending"}
                      </span>
                    </td>

                    <td>
                      <div className="sbf-row-actions">
                        <button
                          type="button"
                          className="sbf-view-btn"
                          onClick={() =>
                            openViewModal(item)
                          }
                        >
                          View
                        </button>

                        {canApprove &&
                          norm(item.status) ===
                            "pending" && (
                            <>
                              <button
                                type="button"
                                className="sbf-action-btn approve"
                                onClick={() =>
                                  handleApprove(item.id)
                                }
                              >
                                Approve
                              </button>

                              <button
                                type="button"
                                className="sbf-action-btn reject"
                                onClick={() =>
                                  handleReject(item.id)
                                }
                              >
                                Reject
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
      </section>

      {/* =====================================================
          PAGINATION
      ===================================================== */}

      {!loading && filteredOrders.length > 0 && (
        <div className="sbf-pager">
          <div className="sbf-pager-left">
            <span>Rows per page</span>
            <select
              value={pageSize}
              onChange={(e) =>
                setPageSize(Number(e.target.value))
              }
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>

            <span>
              Showing{" "}
              {(page - 1) * pageSize + 1}–
              {Math.min(
                page * pageSize,
                filteredOrders.length
              )}{" "}
              of {filteredOrders.length}
            </span>
          </div>

          <div className="sbf-pager-right">
            <button
              type="button"
              className="sbf-page-btn"
              disabled={page <= 1}
              onClick={() =>
                setPage((p) => Math.max(1, p - 1))
              }
            >
              ‹
            </button>

            <div className="sbf-page-current">
              {page}
            </div>

            <span className="sbf-page-summary">
              of {totalPages}
            </span>

            <button
              type="button"
              className="sbf-page-btn"
              disabled={page >= totalPages}
              onClick={() =>
                setPage((p) =>
                  Math.min(totalPages, p + 1)
                )
              }
            >
              ›
            </button>
          </div>
        </div>
      )}

      {/* =====================================================
          CREATE MODAL
      ===================================================== */}

      {showCreate && canCreate && (
        <div
          className="sbf-modal-overlay"
          onMouseDown={(e) => {
            if (
              e.target.classList.contains(
                "sbf-modal-overlay"
              )
            ) {
              closeCreateModal();
            }
          }}
        >

          <div
            className="sbf-modal"
            onMouseDown={(e) =>
              e.stopPropagation()
            }
          >

            <div className="sbf-modal-head">

              <div>
                <span className="sbf-modal-eyebrow">
                  STAFF BENEVOLENT FUND
                </span>

                <h3>Create SBF Order</h3>

                <p>
                  Create a new Staff Benevolent Fund
                  request.
                </p>
              </div>

              <button
                type="button"
                className="sbf-modal-close"
                onClick={closeCreateModal}
              >
                ✕
              </button>

            </div>

            <form
              className="sbf-form"
              onSubmit={handleSubmit}
            >

              <div className="sbf-form-grid">

                <div className="sbf-field">
                  <label>Employee No</label>

                  <input
                    type="text"
                    name="employee_no"
                    value={form.employee_no}
                    placeholder="Auto-filled"
                    readOnly
                    required
                  />
                </div>

                <div className="sbf-field sbf-employee-picker">
                  <label>Employee Name</label>

                  <input
                    type="text"
                    value={employeeSearch}
                    placeholder="Search employee name or employee no..."
                    autoComplete="off"
                    onFocus={() => setShowEmployeeDropdown(true)}
                    onChange={(e) => {
                      setEmployeeSearch(e.target.value);
                      setShowEmployeeDropdown(true);

                      setForm((prev) => ({
                        ...prev,
                        employee_no: "",
                        employee_name: "",
                        branch_code: "",
                        branch_name: "",
                      }));
                    }}
                    required
                  />

                  {showEmployeeDropdown && (
                    <div className="sbf-employee-dropdown">
                      {employeesLoading ? (
                        <div className="sbf-employee-empty">
                          Loading employees...
                        </div>
                      ) : filteredEmployees.length === 0 ? (
                        <div className="sbf-employee-empty">
                          No employee found.
                        </div>
                      ) : (
                        filteredEmployees.map((employee) => {
                          const name =
                            employee.fullname ||
                            [
                              employee.last_name,
                              employee.first_name,
                              employee.middle_name,
                            ]
                              .filter(Boolean)
                              .join(", ");

                          return (
                            <button
                              key={employee.id || employee.employee_no}
                              type="button"
                              className="sbf-employee-option"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                handleSelectEmployee(employee);
                              }}
                            >
                              <strong>{name}</strong>

                              <span>
                                {employee.employee_no || "No employee no."}
                                {" • "}
                                {employee.branch_name || "No branch"}
                              </span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>

                <div className="sbf-field">
                  <label>Branch Code</label>

                  <input
                    type="text"
                    name="branch_code"
                    value={form.branch_code}
                    placeholder="Auto-filled"
                    readOnly
                    required
                  />
                </div>

                <div className="sbf-field">
                  <label>Branch Name</label>

                  <input
                    type="text"
                    name="branch_name"
                    value={form.branch_name}
                    placeholder="Auto-filled"
                    readOnly
                    required
                  />
                </div>

                <div className="sbf-field">
                  <label>Assistance Type</label>

                  <select
                    name="assistance_type"
                    value={form.assistance_type}
                    onChange={handleChange}
                    required
                  >
                    <option value="">
                      Select assistance type
                    </option>

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

                <div className="sbf-field">
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

                <div className="sbf-field">
                  <label>Date Created</label>

                  <input
                    type="date"
                    name="date_created"
                    value={form.date_created}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="sbf-field">
                  <label>Effective Date</label>

                  <input
                    type="date"
                    name="effective_date"
                    value={form.effective_date}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="sbf-field full">
                  <label>Attachment</label>

                  <input
                    id="sbf-attachment-input"
                    type="file"
                    onChange={(e) =>
                      setAttachment(
                        e.target.files?.[0] || null
                      )
                    }
                  />

                  {attachment && (
                    <small className="sbf-selected-file">
                      Selected: {attachment.name}
                    </small>
                  )}
                </div>

                <div className="sbf-field full">
                  <label>Description</label>

                  <textarea
                    name="reason"
                    rows={4}
                    value={form.reason}
                    onChange={handleChange}
                    placeholder="Enter reason"
                    required
                  />
                </div>
              </div>
              <div className="sbf-modal-actions">

                <button
                  type="button"
                  className="sbf-main-btn modal-secondary"
                  onClick={closeCreateModal}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="sbf-main-btn primary"
                  disabled={submitting}
                >
                  {submitting
                    ? "Saving..."
                    : "Create Order"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================
          VIEW MODAL
      ===================================================== */}

      {showView && selectedOrder && (

        <div
          className="sbf-modal-overlay"
          onMouseDown={(e) => {
            if (
              e.target.classList.contains(
                "sbf-modal-overlay"
              )
            ) {
              closeViewModal();
            }
          }}
        >

          <div
            className="sbf-modal sbf-view-modal"
            onMouseDown={(e) =>
              e.stopPropagation()
            }
          >

            <div className="sbf-modal-head">

              <div>
                <span className="sbf-modal-eyebrow">
                  {selectedOrder.order_no}
                </span>

                <h3>SBF Order Details</h3>

                <p>
                  Staff Benevolent Fund request
                  information.
                </p>
              </div>

              <button
                type="button"
                className="sbf-modal-close"
                onClick={closeViewModal}
              >
                ✕
              </button>

            </div>

            <div className="sbf-view-grid">

              <div className="sbf-view-item">
                <span>Order No</span>
                <strong>
                  {selectedOrder.order_no || "—"}
                </strong>
              </div>

              <div className="sbf-view-item">
                <span>Status</span>

                <div>
                  <span
                    className={`sbf-status ${getStatusClass(
                      selectedOrder.status
                    )}`}
                  >
                    {selectedOrder.status ||
                      "Pending"}
                  </span>
                </div>
              </div>

              <div className="sbf-view-item">
                <span>Employee No</span>
                <strong>
                  {selectedOrder.employee_no || "—"}
                </strong>
              </div>

              <div className="sbf-view-item">
                <span>Employee Name</span>
                <strong>
                  {selectedOrder.employee_name ||
                    "—"}
                </strong>
              </div>

              <div className="sbf-view-item">
                <span>Branch Code</span>
                <strong>
                  {selectedOrder.branch_code || "—"}
                </strong>
              </div>

              <div className="sbf-view-item">
                <span>Branch Name</span>
                <strong>
                  {selectedOrder.branch_name || "—"}
                </strong>
              </div>

              <div className="sbf-view-item">
                <span>Assistance Type</span>
                <strong>
                  {selectedOrder.assistance_type ||
                    "—"}
                </strong>
              </div>

              <div className="sbf-view-item">
                <span>Amount</span>
                <strong>
                  ₱
                  {formatAmount(
                    selectedOrder.amount
                  )}
                </strong>
              </div>

              <div className="sbf-view-item">
                <span>Date Created</span>
                <strong>
                  {formatDate(
                    selectedOrder.date_created
                  )}
                </strong>
              </div>

              <div className="sbf-view-item">
                <span>Effective Date</span>
                <strong>
                  {formatDate(
                    selectedOrder.effective_date
                  )}
                </strong>
              </div>

              <div className="sbf-view-item full">
                <span>Description</span>

                <div className="sbf-view-box">
                  {selectedOrder.reason || "—"}
                </div>
              </div>

              <div className="sbf-view-item full">
                <span>Attachment</span>

                <div className="sbf-view-box">

                  {selectedOrder.attachment_path ? (
                    <div className="sbf-attachment-row">

                      <strong>
                        {selectedOrder.attachment_name ||
                          "Uploaded File"}
                      </strong>

                      <button
                        type="button"
                        className="sbf-main-btn primary"
                        onClick={() =>
                          handleDownload(
                            selectedOrder
                          )
                        }
                      >
                        Download File
                      </button>

                    </div>
                  ) : (
                    "No file uploaded"
                  )}

                </div>
              </div>

              <div className="sbf-view-item full sbf-history-section">
                <span>Approval History</span>

                <div className="sbf-history-box">
                  {historyLoading ? (
                    <div className="sbf-history-empty">
                      Loading approval history...
                    </div>
                  ) : approvalHistory.length === 0 ? (
                    <div className="sbf-history-empty">
                      No approval history available.
                    </div>
                  ) : (
                    <div className="sbf-history-list">
                      {approvalHistory.map((history) => (
                        <div
                          key={history.id}
                          className={`sbf-history-item ${norm(
                            history.action
                          )}`}
                        >
                          <div className="sbf-history-marker">
                            <span />
                          </div>

                          <div className="sbf-history-content">
                            <div className="sbf-history-top">
                              <strong>
                                {history.action || "Activity"}
                              </strong>

                              <span className="sbf-history-date">
                                {history.created_at
                                  ? new Date(
                                      history.created_at
                                    ).toLocaleString("en-PH", {
                                      year: "numeric",
                                      month: "short",
                                      day: "2-digit",
                                      hour: "numeric",
                                      minute: "2-digit",
                                    })
                                  : "—"}
                              </span>
                            </div>

                            <div className="sbf-history-person">
                              {history.acted_by_name ||
                                "Unknown User"}
                            </div>

                            <div className="sbf-history-role">
                              {history.acted_by_role || "—"}
                              {history.acted_by_department
                                ? ` • ${history.acted_by_department}`
                                : ""}
                            </div>

                            {history.remarks && (
                              <div className="sbf-history-remarks">
                                {history.remarks}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

            </div>

            <div className="sbf-modal-actions">

              <button
                type="button"
                className="sbf-main-btn modal-secondary"
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