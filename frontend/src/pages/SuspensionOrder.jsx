import React, { useEffect, useMemo, useRef, useState } from "react";
import { FaEdit, FaTrash, FaCheck, FaTimes } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import api from "../api/axiosClient";
import "../styles/SuspensionOrder.css";

const clean = (v) => String(v ?? "").trim();
const norm = (v) => clean(v).toLowerCase();
const toDate10 = (v) => (v ? String(v).slice(0, 10) : "");

const toNum = (v) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const money = (v) =>
  toNum(v).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const displayNameParts = (s) => {
  const ln = clean(s?.last_name);
  const fn = clean(s?.first_name);
  const mn = clean(s?.middle_name);

  const built = `${ln}${ln && fn ? ", " : ""}${fn}${mn ? ` ${mn}` : ""}`
    .replace(/\s+/g, " ")
    .trim();

  return built || clean(s?.fullname) || "-";
};

export default function SuspensionOrder() {
  const navigate = useNavigate();
  const employeeBoxRef = useRef(null);

  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  }, []);

  const role = norm(user?.role);

  const department = norm(
    user?.department ||
      user?.department_name ||
      user?.departmentName ||
      user?.user_department ||
      user?.dept ||
      ""
  );

  const isOfficeOfThePresident = department === "office of the president";

  const isAdmin = role === "admin";
  const isIt = role === "it";
  const isHr = role === "hr";
  const isAccounting = role === "accounting";
  const isTread = role === "tread";
  const isBranchManager = role === "branch manager";
  const isAreaManager = role === "area manager";
  const isRegionalManager = role === "regional manager";
  const isAssistantVicePresident = role === "assistant vice president";
  const isVicePresident = role === "vice president";
  const isSeniorVicePresident = role === "senior vice president";
  const isPresident = role === "president";

  const isITDepartment = department === "it department";

  const isITDepartmentManager =
    isITDepartment &&
    (
      isBranchManager ||
      isAreaManager ||
      isRegionalManager ||
      isAssistantVicePresident ||
      isVicePresident ||
      isSeniorVicePresident
    );


  const isHRDepartment = department === "hr department";
  const isOperationDepartment = department === "operation department";

  const isHRDepartmentManager =
    isHRDepartment &&
    (
      isBranchManager ||
      isAreaManager ||
      isRegionalManager ||
      isAssistantVicePresident ||
      isVicePresident ||
      isSeniorVicePresident
    );
    
  const canCreate =
    isOfficeOfThePresident ||
    isAdmin ||
    isIt ||
    isHr ||
    isAccounting ||
    isSeniorVicePresident ||
    isPresident ||
    isITDepartmentManager ||
    isHRDepartmentManager;

  const canEditDelete =
    isAdmin ||
    isIt ||
    isHr ||
    isAccounting ||
    isSeniorVicePresident ||
    isPresident ||
    isITDepartmentManager ||
    isHRDepartmentManager;

  const canApproveStage = (order) => {
    const stage = norm(order?.approval_stage);

    if (isHRDepartmentManager) {
      return stage === "admin";
    }

    if (!isOperationDepartment && isAreaManager && stage === "area manager") return true;
    if (!isOperationDepartment && isRegionalManager && stage === "regional manager") return true;
    if (!isOperationDepartment && isAssistantVicePresident && stage === "assistant vice president") return true;
    if ((isAdmin || isIt || isHr || isAccounting) && stage === "admin") return true;

    return false;
  };

  const canRejectStage = canApproveStage;

  const canDownloadRequestFile =
    isRegionalManager ||
    isAssistantVicePresident ||
    isVicePresident ||
    isAdmin ||
    isIt ||
    isHr ||
    isITDepartmentManager ||
    isHRDepartmentManager ||
    isAccounting;

  const canUploadApprovedFile =
    isAdmin || isIt || isHr || isAccounting || isITDepartmentManager || isHRDepartmentManager;

  const canDownloadApprovedFile = (order) => {
    const approved = norm(order?.status) === "approved";

    if (
      isAdmin ||
      isIt ||
      isHr ||
      isAccounting ||
      isHRDepartmentManager
    ) {
      return true;
    }

    if (
      isRegionalManager ||
      isAssistantVicePresident ||
      isVicePresident
    ) {
      return true;
    }

    if (isAreaManager && approved) {
      return true;
    }

    if (isBranchManager && approved) {
      return true;
    }

    return false;
  };

  const stageLabel = (o) => {
    const status = clean(o?.status);

    if (status === "Approved") return "Approved";
    if (status === "Rejected") return "Rejected";

    const stage = norm(o?.approval_stage);

    if (stage === "area manager") return "Pending Area Manager";
    if (stage === "regional manager") return "Pending Regional Manager";
    if (stage === "assistant vice president") return "Pending Assistant Vice President";
    if (stage === "admin") return "Pending Admin/HR/Accounting";

    return status || "Pending";
  };

  const [orders, setOrders] = useState([]);
  const [staff, setStaff] = useState([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [uploadingApproved, setUploadingApproved] = useState({});

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [showModal, setShowModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [viewOrder, setViewOrder] = useState(null);

  const [rejecting, setRejecting] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectSaving, setRejectSaving] = useState(false);

  const [employeeSearch, setEmployeeSearch] = useState("");
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);

  const emptyForm = useMemo(
    () => ({
      employee_id: "",
      employee_name: "",
      suspension_type: "",
      suspension_start: "",
      suspension_end: "",
      days_of_suspension: "",
      basic_salary: 0,
      ecola: 0,
      transportation: 0,
      prorated_salary: "",
      prorated_ecola: "",
      prorated_transportation: "",
      prorated_repairing: "",
      prorated_allowance: "",
      prorated_postage: "",
      total_deduction: 0,
      reason: "",
    }),
    []
  );

  const [form, setForm] = useState(emptyForm);
  const [attachFile, setAttachFile] = useState(null);

  const branchMatchesUser = (staffRow) => {
    const userBranch = norm(user?.branch_id);

    if (!userBranch || !staffRow) return false;

    const branchValues = [
      staffRow.branch_id,
      staffRow.branch_code,
      staffRow.code,
      staffRow.branch_name,
      staffRow.branch,
    ].map(norm);

    return branchValues.includes(userBranch);
  };

  const getStaffForOrder = (order) => {
    return staff.find(
      (s) =>
        String(s.id) === String(order.employee_id) ||
        String(s.employee_no) === String(order.employee_no)
    );
  };

  const visibleOrders = useMemo(() => {
    if (
      isOfficeOfThePresident ||
      isITDepartmentManager ||
      isHRDepartmentManager ||
      isAdmin ||
      isIt ||
      isHr ||
      isAccounting ||
      isTread ||
      isSeniorVicePresident ||
      isPresident
    ) {
      return orders;
    }

    if (isBranchManager) {
      return orders.filter((order) => {
        const staffRow = getStaffForOrder(order);
        return branchMatchesUser(staffRow);
      });
    }

    if (isAreaManager) {
      const userArea = norm(user?.area);

      return orders.filter((order) => {
        const staffRow = getStaffForOrder(order);
        return norm(staffRow?.area || order?.area) === userArea;
      });
    }

    if (isRegionalManager) {
      const userRegion = norm(user?.region);

      return orders.filter((order) => {
        const staffRow = getStaffForOrder(order);
        return norm(staffRow?.region || order?.region) === userRegion;
      });
    }

    if (isAssistantVicePresident || isVicePresident) {
      const userDivision = norm(user?.division);

      return orders.filter((order) => {
        const staffRow = getStaffForOrder(order);
        return norm(staffRow?.division || order?.division) === userDivision;
      });
    }

    return [];
  }, [
      orders,
      staff,
      user,
      isAdmin,
      isIt,
      isHr,
      isAccounting,
      isTread,
      isBranchManager,
      isAreaManager,
      isRegionalManager,
      isAssistantVicePresident,
    ]);

  const filteredOrders = useMemo(() => {
    const q = norm(search);

    if (!q) return visibleOrders;

    return visibleOrders.filter((o) => {
      const haystack = [
        o.id,
        o.employee_id,
        o.employee_no,
        o.employee_name,
        o.suspension_type,
        o.start_date,
        o.suspension_start,
        o.end_date,
        o.suspension_end,
        o.days_of_suspension,
        o.total_deduction,
        o.reason,
        o.status,
        o.approval_stage,
        stageLabel(o),
      ]
        .map((x) => norm(x))
        .join(" ");

      return haystack.includes(q);
    });
  }, [visibleOrders, search]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));

  const pagedOrders = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [filteredOrders, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [search, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const filteredStaff = useMemo(() => {
    let scopedStaff = staff;

    if (!isHRDepartmentManager && isBranchManager) {
      scopedStaff = staff.filter((s) => branchMatchesUser(s));
    }

    if (!isHRDepartmentManager && isAreaManager) {
      scopedStaff = staff.filter((s) => norm(s.area) === norm(user?.area));
    }

    if (!isHRDepartmentManager && isAssistantVicePresident) {
      scopedStaff = staff.filter(
        (s) => norm(s.division) === norm(user?.division)
      );
    }

    const q = norm(employeeSearch);

    if (!q) return scopedStaff.slice(0, 20);

    return scopedStaff
      .filter((s) => {
        const haystack = [
          s.id,
          s.employee_no,
          s.fullname,
          s.first_name,
          s.middle_name,
          s.last_name,
          displayNameParts(s),
          s.position,
          s.branch_id,
          s.branch,
          s.branch_name,
          s.area,
        ]
          .map((x) => norm(x))
          .join(" ");

        return haystack.includes(q);
      })
      .slice(0, 20);
        }, [
        employeeSearch,
        staff,
        user,
        isBranchManager,
        isAreaManager,
        isAssistantVicePresident,
      ]);

  const badgeClass = (status) => {
    const s = norm(status || "Pending");

    if (s === "approved") return "po-badge po-approved";
    if (s === "rejected") return "po-badge po-rejected";

    return "po-badge po-pending";
  };

  const computeTotals = (next) => {
    const total_deduction =
      toNum(next.prorated_salary) +
      toNum(next.prorated_ecola) +
      toNum(next.prorated_transportation) +
      toNum(next.prorated_repairing) +
      toNum(next.prorated_allowance) +
      toNum(next.prorated_postage);

    return {
      ...next,
      total_deduction,
    };
  };

  const setFormAndCompute = (patch) => {
    setForm((prev) => computeTotals({ ...prev, ...patch }));
  };

  const hydrateFormFromOrder = (o) => {
    const next = {
      employee_id: String(o.employee_id ?? ""),
      employee_name: clean(o.employee_name),
      suspension_type: clean(o.suspension_type),
      suspension_start: toDate10(o.start_date || o.suspension_start),
      suspension_end: toDate10(o.end_date || o.suspension_end),
      days_of_suspension: String(o.days_of_suspension ?? ""),
      basic_salary: toNum(o.basic_salary),
      ecola: toNum(o.ecola),
      transportation: toNum(o.transportation),
      prorated_salary: o.prorated_salary ?? "",
      prorated_ecola: o.prorated_ecola ?? "",
      prorated_transportation: o.prorated_transportation ?? "",
      prorated_repairing: o.prorated_repairing ?? "",
      prorated_allowance: o.prorated_allowance ?? "",
      prorated_postage: o.prorated_postage ?? "",
      total_deduction: toNum(o.total_deduction),
      reason: clean(o.reason),
    };

    return computeTotals(next);
  };

  const loadData = async () => {
    setLoading(true);
    setErr("");

    try {
      const [oRes, sRes] = await Promise.all([
        api.get("/suspension-orders"),
        api.get("/staff"),
      ]);

      setOrders(Array.isArray(oRes.data) ? oRes.data : []);
      setStaff(Array.isArray(sRes.data) ? sRes.data : []);
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to load suspension orders.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const modalOpen = showModal || viewOrder || rejecting;

    if (!modalOpen) return;

    const onMouseDown = (e) => {
      if (employeeBoxRef.current && !employeeBoxRef.current.contains(e.target)) {
        setShowEmployeeDropdown(false);
      }
    };

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        setShowEmployeeDropdown(false);
        setViewOrder(null);
        closeReject();
      }
    };

    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [showModal, viewOrder, rejecting]);

  const openCreate = () => {
    if (!canCreate) return;

    setErr("");
    setEditingOrder(null);
    setForm(emptyForm);
    setEmployeeSearch("");
    setShowEmployeeDropdown(false);
    setAttachFile(null);
    setShowModal(true);
  };

  const openEdit = (order) => {
    if (!canEditDelete) return;

    setErr("");
    setEditingOrder(order);
    setForm(hydrateFormFromOrder(order));
    setEmployeeSearch(`${order.employee_id ?? ""} — ${clean(order.employee_name)}`);
    setShowEmployeeDropdown(false);
    setAttachFile(null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingOrder(null);
    setSaving(false);
    setErr("");
    setForm(emptyForm);
    setEmployeeSearch("");
    setShowEmployeeDropdown(false);
    setAttachFile(null);
  };

  const onSelectEmployee = (id) => {
    const emp = staff.find((x) => String(x.id) === String(id));

    const next = {
      ...form,
      employee_id: String(id),
      employee_name: emp?.fullname || displayNameParts(emp),
      basic_salary: toNum(emp?.salary),
      ecola: toNum(emp?.ecola),
      transportation: toNum(emp?.transportation),
    };

    setForm(computeTotals(next));

    if (emp) {
      setEmployeeSearch(
        `${emp.id} — ${displayNameParts(emp)}${emp.employee_no ? ` (${emp.employee_no})` : ""}`
      );
    }

    setShowEmployeeDropdown(false);
  };

  const submitCreateOrUpdate = async (e) => {
    e.preventDefault();

    if (!canCreate || saving) return;

    setErr("");

    if (!form.employee_id) return setErr("Select employee.");
    if (!clean(form.suspension_type)) return setErr("Suspension type required.");
    if (!toDate10(form.suspension_start)) return setErr("Start date required.");
    if (!toDate10(form.suspension_end)) return setErr("End date required.");
    if (!clean(form.reason)) return setErr("Reason required.");

    const days = toNum(form.days_of_suspension);

    if (days <= 0) return setErr("Days of suspension must be greater than 0.");

    setSaving(true);

    try {
      const formData = new FormData();

      formData.append("employee_id", Number(form.employee_id));
      formData.append("employee_name", clean(form.employee_name));
      formData.append("suspension_type", clean(form.suspension_type));
      formData.append("suspension_start", toDate10(form.suspension_start));
      formData.append("suspension_end", toDate10(form.suspension_end));
      formData.append("days_of_suspension", String(days));
      formData.append("basic_salary", String(toNum(form.basic_salary)));
      formData.append("ecola", String(toNum(form.ecola)));
      formData.append("transportation", String(toNum(form.transportation)));
      formData.append("prorated_salary", String(toNum(form.prorated_salary)));
      formData.append("prorated_ecola", String(toNum(form.prorated_ecola)));
      formData.append("prorated_transportation", String(toNum(form.prorated_transportation)));
      formData.append("prorated_repairing", String(toNum(form.prorated_repairing)));
      formData.append("prorated_allowance", String(toNum(form.prorated_allowance)));
      formData.append("prorated_postage", String(toNum(form.prorated_postage)));
      formData.append("total_deduction", String(toNum(form.total_deduction)));
      formData.append("reason", clean(form.reason));

      if (attachFile) {
        formData.append("attachment", attachFile);
      }

      if (editingOrder?.id) {
        await api.put(`/suspension-orders/${editingOrder.id}`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      } else {
        await api.post("/suspension-orders", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }

      closeModal();
      await loadData();
    } catch (e2) {
      setErr(
        e2?.response?.data?.message ||
          `Failed to ${editingOrder ? "update" : "create"} suspension order.`
      );
    } finally {
      setSaving(false);
    }
  };

  const approveOrder = async (o) => {
    if (!canApproveStage(o)) return;
    if (!window.confirm("Approve this suspension order?")) return;

    try {
      await api.put(`/suspension-orders/${o.id}/approve`);
      await loadData();
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to approve.");
    }
  };

  const openReject = (o) => {
    if (!canRejectStage(o)) return;

    setRejecting(o);
    setRejectReason("");
  };

  const closeReject = () => {
    setRejecting(null);
    setRejectReason("");
    setRejectSaving(false);
  };

  const submitReject = async (e) => {
    e.preventDefault();

    if (!rejecting) return;
    if (!clean(rejectReason)) return setErr("Rejection reason required.");

    setRejectSaving(true);

    try {
      await api.put(`/suspension-orders/${rejecting.id}/reject`, {
        reason: rejectReason,
      });

      closeReject();
      await loadData();
    } catch (e2) {
      setErr(e2?.response?.data?.message || "Failed to reject.");
    } finally {
      setRejectSaving(false);
    }
  };

  const deleteOrder = async (o) => {
    const approved = norm(o.status) === "approved";

    if (!canEditDelete || approved) return;
    if (!window.confirm("Delete this suspension order?")) return;

    try {
      await api.delete(`/suspension-orders/${o.id}`);
      await loadData();
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to delete.");
    }
  };

  const downloadFile = async (orderId, type, fallbackName) => {
    try {
      const res = await api.get(`/suspension-orders/${orderId}/download/${type}`, {
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");

      a.href = url;
      a.download = fallbackName || `suspension-${orderId}-${type}`;

      document.body.appendChild(a);
      a.click();
      a.remove();

      window.URL.revokeObjectURL(url);
    } catch (e) {
      alert(e?.response?.data?.message || "Failed to download file.");
    }
  };

  const uploadApprovedFile = async (orderId, file) => {
    if (!file) return;

    try {
      setUploadingApproved((prev) => ({ ...prev, [orderId]: true }));

      const formData = new FormData();
      formData.append("attachment", file);

      await api.post(`/suspension-orders/${orderId}/approved-file`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      await loadData();
    } catch (e) {
      alert(e?.response?.data?.message || "Failed to upload approved file.");
    } finally {
      setUploadingApproved((prev) => ({ ...prev, [orderId]: false }));
    }
  };

  return (
    <div className="po-page">
      <div className="po-topbar">
        <div>
          <h2 className="po-title">Suspension Orders</h2>
          <p className="po-subtitle">
            Area Manager → Regional Manager → Assistant Vice President → Admin/HR/Accounting
          </p>
        </div>

        <div className="po-topbar-actions">
          <button className="po-btn po-btn-outline" onClick={() => navigate(-1)} type="button">
            ← Back
          </button>

          <button className="po-btn" onClick={loadData} disabled={loading} type="button">
            Refresh
          </button>

          {canCreate && (
            <button className="po-btn po-btn-primary" onClick={openCreate} type="button">
              + Create Suspension
            </button>
          )}
        </div>
      </div>

      {isBranchManager && (
        <div className="po-card" style={{ marginBottom: 14, padding: 14 }}>
          <strong>Branch Manager View:</strong> Showing suspension orders only for your branch.
          Approved files are downloadable only after the order is approved.
        </div>
      )}

      {err && <div style={{ color: "#ef4444", fontWeight: 900 }}>{err}</div>}

      <div className="po-card po-toolbar">
        <div className="po-toolbar-left">
          <input
            className="po-search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search employee, type, status, stage..."
          />

          <select
            className="po-page-size"
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
          >
            <option value={25}>25 rows</option>
            <option value={50}>50 rows</option>
            <option value={75}>75 rows</option>
            <option value={100}>100 rows</option>
          </select>

          <span className="po-result-pill">Results: {filteredOrders.length}</span>
          <span className="po-result-pill">Showing: {pagedOrders.length}</span>
        </div>
      </div>

      <div className="po-card">
        <div className="po-table-wrap">
          <table className="po-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Type</th>
                <th>Start</th>
                <th>End</th>
                <th>Days</th>
                <th>Total Deduction</th>
                <th>Status</th>
                <th>Stage</th>
                <th>Files</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="po-empty">
                    Loading...
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={10} className="po-empty">
                    No suspension orders found.
                  </td>
                </tr>
              ) : (
                pagedOrders.map((o) => {
                  const approved = norm(o.status) === "approved";

                  return (
                    <tr key={o.id}>
                      <td>{o.employee_name}</td>
                      <td>{o.suspension_type || "-"}</td>
                      <td>{toDate10(o.start_date || o.suspension_start)}</td>
                      <td>{toDate10(o.end_date || o.suspension_end)}</td>
                      <td>{o.days_of_suspension ?? "-"}</td>
                      <td>{money(o.total_deduction)}</td>

                      <td>
                        <span className={badgeClass(o.status)}>{o.status || "Pending"}</span>
                      </td>

                      <td>{stageLabel(o)}</td>

                      <td>
                        <div className="po-file-actions">
                          {o.attachment_path && canDownloadRequestFile ? (
                            <button
                              className="po-mini-btn"
                              type="button"
                              onClick={() =>
                                downloadFile(o.id, "request", o.attachment_name || "")
                              }
                            >
                              Download Request
                            </button>
                          ) : null}

                          {o.approved_attachment_path && canDownloadApprovedFile(o) ? (
                            <button
                              className="po-mini-btn"
                              type="button"
                              onClick={() =>
                                downloadFile(
                                  o.id,
                                  "approved",
                                  o.approved_attachment_name || ""
                                )
                              }
                            >
                              Download Approved
                            </button>
                          ) : null}

                          {canUploadApprovedFile ? (
                            <label className="po-mini-btn" style={{ cursor: "pointer" }}>
                              {uploadingApproved[o.id] ? "Uploading..." : "Upload Approved"}
                              <input
                                type="file"
                                style={{ display: "none" }}
                                onChange={(e) =>
                                  uploadApprovedFile(o.id, e.target.files?.[0] || null)
                                }
                              />
                            </label>
                          ) : null}

                          {!o.attachment_path &&
                          !o.approved_attachment_path &&
                          !canUploadApprovedFile ? (
                            <span style={{ opacity: 0.7 }}>-</span>
                          ) : null}
                        </div>
                      </td>

                      <td>
                        <div className="po-action-buttons">
                          <button
                            className="po-mini-btn po-view-btn"
                            type="button"
                            onClick={() => setViewOrder(o)}
                          >
                            View
                          </button>

                          {canEditDelete && (
                            <>
                              <button
                                className="po-mini-btn po-icon-btn"
                                onClick={() => openEdit(o)}
                                disabled={approved}
                                type="button"
                                title="Edit"
                              >
                                <FaEdit />
                              </button>

                              <button
                                className="po-mini-btn po-icon-btn po-reject"
                                onClick={() => deleteOrder(o)}
                                disabled={approved}
                                type="button"
                                title="Delete"
                              >
                                <FaTrash />
                              </button>
                            </>
                          )}

                          {canApproveStage(o) ? (
                            <>
                              <button
                                className="po-mini-btn po-icon-btn po-approve"
                                onClick={() => approveOrder(o)}
                                type="button"
                                title="Approve"
                              >
                                <FaCheck />
                              </button>

                              <button
                                className="po-mini-btn po-icon-btn po-reject"
                                onClick={() => openReject(o)}
                                type="button"
                                title="Reject"
                              >
                                <FaTimes />
                              </button>
                            </>
                          ) : !canEditDelete ? (
                            <span style={{ opacity: 0.7 }}>View only</span>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="po-card po-pager">
        <div className="po-pager-inner">
          <button
            className="po-page-btn"
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </button>

          <span className="po-page-info">
            Page {page} of {totalPages}
          </span>

          <button
            className="po-page-btn"
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
          </button>
        </div>
      </div>

      {showModal && (
        <div
          className="po-modal-overlay"
          onMouseDown={(e) =>
            e.target.classList.contains("po-modal-overlay") && closeModal()
          }
        >
          <div className="po-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="po-modal-head">
              <h3 className="po-modal-title">
                {editingOrder ? "Edit Suspension" : "Create Suspension"}
              </h3>

              <button className="po-x" onClick={closeModal} type="button">
                ✕
              </button>
            </div>

            <form className="po-form" onSubmit={submitCreateOrUpdate}>
              <div className="po-grid">
                <div className="po-field" ref={employeeBoxRef} style={{ position: "relative" }}>
                  <label>Employee</label>

                  <input
                    type="text"
                    placeholder="Search employee ID, name, or employee no..."
                    value={employeeSearch}
                    onChange={(e) => {
                      setEmployeeSearch(e.target.value);
                      setShowEmployeeDropdown(true);

                      setForm((p) =>
                        computeTotals({
                          ...p,
                          employee_id: "",
                          employee_name: "",
                          basic_salary: 0,
                          ecola: 0,
                          transportation: 0,
                        })
                      );
                    }}
                    onFocus={() => setShowEmployeeDropdown(true)}
                  />

                  {showEmployeeDropdown && (
                    <div
                      style={{
                        position: "absolute",
                        top: "100%",
                        left: 0,
                        right: 0,
                        marginTop: 6,
                        maxHeight: 240,
                        overflowY: "auto",
                        background: "var(--card, #0f172a)",
                        border: "1px solid var(--border, rgba(255,255,255,0.1))",
                        borderRadius: 10,
                        zIndex: 99999,
                        boxShadow: "0 12px 30px rgba(0,0,0,0.25)",
                      }}
                    >
                      {filteredStaff.length === 0 ? (
                        <div style={{ padding: 12, color: "var(--muted)", fontSize: 14 }}>
                          No employee found
                        </div>
                      ) : (
                        filteredStaff.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => onSelectEmployee(s.id)}
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
                            {s.id} — {displayNameParts(s)}{" "}
                            {s.employee_no ? `(${s.employee_no})` : ""}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                <div className="po-field">
                  <label>Employee Name</label>
                  <input value={form.employee_name} readOnly />
                </div>

                <div className="po-field">
                  <label>Suspension Type</label>
                  <select
                    value={form.suspension_type}
                    onChange={(e) => setFormAndCompute({ suspension_type: e.target.value })}
                    required
                  >
                    <option value="">Select suspension type</option>
                    <option value="Suspension">Suspension</option>
                    <option value="Preventive Suspension">Preventive Suspension</option>
                    <option value="Notice of Admin Hearing">Notice of Admin Hearing</option>
                  </select>
                </div>

                <div className="po-field">
                  <label>Start Date</label>
                  <input
                    type="date"
                    value={form.suspension_start}
                    onChange={(e) => setFormAndCompute({ suspension_start: e.target.value })}
                    required
                  />
                </div>

                <div className="po-field">
                  <label>End Date</label>
                  <input
                    type="date"
                    value={form.suspension_end}
                    onChange={(e) => setFormAndCompute({ suspension_end: e.target.value })}
                    required
                  />
                </div>

                <div className="po-field">
                  <label>Days of Suspension</label>
                  <input
                    type="number"
                    min="1"
                    value={form.days_of_suspension}
                    onChange={(e) => setFormAndCompute({ days_of_suspension: e.target.value })}
                    placeholder="Enter days"
                    required
                  />
                </div>

                <div className="po-field">
                  <label>Basic Salary</label>
                  <input value={money(form.basic_salary)} readOnly />
                </div>

                <div className="po-field">
                  <label>Ecola</label>
                  <input value={money(form.ecola)} readOnly />
                </div>

                <div className="po-field">
                  <label>Transportation</label>
                  <input value={money(form.transportation)} readOnly />
                </div>

                <div className="po-field full">
                  <h3>Pro-rated Computation</h3>
                </div>

                <div className="po-field">
                  <label>Pro-rated Salary</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.prorated_salary}
                    onChange={(e) => setFormAndCompute({ prorated_salary: e.target.value })}
                    placeholder="Enter pro-rated salary"
                  />
                </div>

                <div className="po-field">
                  <label>Pro-rated Ecola</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.prorated_ecola}
                    onChange={(e) => setFormAndCompute({ prorated_ecola: e.target.value })}
                    placeholder="Enter pro-rated ecola"
                  />
                </div>

                <div className="po-field">
                  <label>Deduction in Transportation</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.prorated_transportation}
                    onChange={(e) =>
                      setFormAndCompute({ prorated_transportation: e.target.value })
                    }
                    placeholder="Enter deduction in transportation"
                  />
                </div>

                <div className="po-field">
                  <label>Deduction in Repairing</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.prorated_repairing}
                    onChange={(e) => setFormAndCompute({ prorated_repairing: e.target.value })}
                    placeholder="Enter deduction in repairing"
                  />
                </div>

                <div className="po-field">
                  <label>Deduction in Allowance</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.prorated_allowance}
                    onChange={(e) => setFormAndCompute({ prorated_allowance: e.target.value })}
                    placeholder="Enter deduction in allowance"
                  />
                </div>

                <div className="po-field">
                  <label>Deduction in Postage</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.prorated_postage}
                    onChange={(e) => setFormAndCompute({ prorated_postage: e.target.value })}
                    placeholder="Enter deduction in postage"
                  />
                </div>

                <div className="po-field">
                  <label>Total Deduction</label>
                  <input value={money(form.total_deduction)} readOnly />
                </div>

                <div className="po-field">
                  <label>Attach Request File</label>
                  <input
                    type="file"
                    onChange={(e) => setAttachFile(e.target.files?.[0] || null)}
                  />
                </div>

                <div className="po-field full">
                  <label>Reason</label>
                  <textarea
                    value={form.reason}
                    onChange={(e) => setFormAndCompute({ reason: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="po-modal-actions">
                <button className="po-btn po-btn-outline" type="button" onClick={closeModal}>
                  Cancel
                </button>

                <button className="po-btn po-btn-primary" type="submit" disabled={saving}>
                  {saving
                    ? editingOrder
                      ? "Updating..."
                      : "Saving..."
                    : editingOrder
                    ? "Update"
                    : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewOrder && (
        <div
          className="po-modal-overlay"
          onMouseDown={(e) =>
            e.target.classList.contains("po-modal-overlay") && setViewOrder(null)
          }
        >
          <div className="po-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="po-modal-head">
              <div>
                <h3 className="po-modal-title">Suspension Details</h3>
                <div className="po-modal-sub">
                  {viewOrder.employee_name || "-"} • {stageLabel(viewOrder)}
                </div>
              </div>

              <button className="po-x" type="button" onClick={() => setViewOrder(null)}>
                ✕
              </button>
            </div>

            <div className="po-form">
              <div className="po-grid">
                <div className="po-field">
                  <label>Employee</label>
                  <input value={viewOrder.employee_name || "-"} readOnly />
                </div>

                <div className="po-field">
                  <label>Type</label>
                  <input value={viewOrder.suspension_type || "-"} readOnly />
                </div>

                <div className="po-field">
                  <label>Start Date</label>
                  <input value={toDate10(viewOrder.start_date || viewOrder.suspension_start) || "-"} readOnly />
                </div>

                <div className="po-field">
                  <label>End Date</label>
                  <input value={toDate10(viewOrder.end_date || viewOrder.suspension_end) || "-"} readOnly />
                </div>

                <div className="po-field">
                  <label>Days</label>
                  <input value={viewOrder.days_of_suspension ?? "-"} readOnly />
                </div>

                <div className="po-field">
                  <label>Total Deduction</label>
                  <input value={money(viewOrder.total_deduction)} readOnly />
                </div>

                <div className="po-field">
                  <label>Status</label>
                  <input value={viewOrder.status || "Pending"} readOnly />
                </div>

                <div className="po-field">
                  <label>Stage</label>
                  <input value={stageLabel(viewOrder)} readOnly />
                </div>

                <div className="po-field full">
                  <label>Reason</label>
                  <textarea value={viewOrder.reason || "-"} readOnly />
                </div>

                {viewOrder.rejection_reason ? (
                  <div className="po-field full">
                    <label>Rejection Reason</label>
                    <textarea value={viewOrder.rejection_reason} readOnly />
                  </div>
                ) : null}
              </div>

              <div className="po-modal-actions">
                <button
                  className="po-btn po-btn-outline"
                  type="button"
                  onClick={() => setViewOrder(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {rejecting && (
        <div
          className="po-modal-overlay"
          onMouseDown={(e) =>
            e.target.classList.contains("po-modal-overlay") && closeReject()
          }
        >
          <div className="po-modal po-modal-sm" onMouseDown={(e) => e.stopPropagation()}>
            <div className="po-modal-head">
              <h3 className="po-modal-title">Reject Suspension</h3>

              <button className="po-x" onClick={closeReject} type="button">
                ✕
              </button>
            </div>

            <form className="po-form" onSubmit={submitReject}>
              <div className="po-grid">
                <div className="po-field full">
                  <label>Reason for rejection</label>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="po-modal-actions">
                <button className="po-btn po-btn-outline" type="button" onClick={closeReject}>
                  Cancel
                </button>

                <button className="po-btn po-reject" type="submit" disabled={rejectSaving}>
                  {rejectSaving ? "Rejecting..." : "Reject"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}