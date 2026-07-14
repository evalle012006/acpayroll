import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axiosClient";
import "../styles/DemotionOrder.css";

const clean = (v) => String(v ?? "").trim();
const norm = (v) => clean(v).toLowerCase();
const toDate10 = (v) => (v ? String(v).slice(0, 10) : "");

const displayNameParts = (s) => {
  const ln = clean(s?.last_name);
  const fn = clean(s?.first_name);
  const mn = clean(s?.middle_name);

  const built = `${ln}${ln && fn ? ", " : ""}${fn}${mn ? ` ${mn}` : ""}`
    .replace(/\s+/g, " ")
    .trim();

  return built || clean(s?.fullname) || "-";
};

const STAGE_LABELS = {
  "area manager": "Area Manager",
  "regional manager": "Regional Manager",
  "assistant vice president": "Assistant Vice President",
  "vice president": "Vice President",
  admin: "Admin / IT / HR / Accounting",
  approved: "Approved",
  rejected: "Rejected",
};

const BACK_OFFICE_DEPARTMENTS = [
  "it",
  "it department",
  "hr",
  "hr department",
  "human resources",
  "human resources department",
  "accounting",
  "accounting department",
  "audit",
  "audit department",
  "production & logistic",
  "production & logistic department",
  "production and logistic",
  "production and logistic department",
  "office of the president",
  "tread",
  "tread department",
  "treadt department",
];

const OPERATION_DEPARTMENTS = [
  "operation",
  "operations",
  "operation department",
  "operations department",
];

const isBackOfficeDepartment = (department) =>
  BACK_OFFICE_DEPARTMENTS.includes(norm(department));

const isOperationDepartment = (department) =>
  OPERATION_DEPARTMENTS.includes(norm(department));

const getApprovalChain = (department) => {
  if (isOperationDepartment(department)) {
    return [
      "area manager",
      "regional manager",
      "assistant vice president",
      "vice president",
      "admin",
    ];
  }

  if (isBackOfficeDepartment(department)) {
    return ["admin"];
  }

  return ["admin"];
};

const getStageStatus = (order, stage) => {
  const map = {
    "area manager": order?.area_manager_status,
    "regional manager": order?.regional_manager_status,
    "assistant vice president": order?.assistant_vice_president_status,
    "vice president": order?.vice_president_status,
    admin: order?.admin_status,
  };

  return clean(map[stage] || "Pending");
};

const getCurrentStage = (order) => {
  const status = norm(order?.status);

  if (status === "approved") return "approved";
  if (status === "rejected") return "rejected";

  const stage = norm(order?.approval_stage);

  if (stage && stage !== "approved") return stage;

  const chain = getApprovalChain(order?.department);
  return chain[0] || "admin";
};

const renderChainSummary = (order) => {
  const chain = getApprovalChain(order?.department);

  return chain
    .map((stage) => `${STAGE_LABELS[stage] || stage}: ${getStageStatus(order, stage)}`)
    .join(" | ");
};

export default function DemotionOrder() {
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
  const department = norm(user?.department);

  const isAdmin = role === "admin";
  const isIt = role === "it";

  const isHr =
    role === "hr" ||
    department === "hr" ||
    department === "hr department" ||
    department === "human resources" ||
    department === "human resources department";

  const isAccounting = role === "accounting";
  const isBranchManager = role === "branch manager";
  const isAreaManager = role === "area manager";
  const isRegionalManager = role === "regional manager";
  const isAssistantVicePresident = role === "assistant vice president";
  const isVicePresident = role === "vice president";
  const isSeniorVicePresident = role === "senior vice president";
  const isPresident = role === "president";

  const isITDepartment =
    department === "it" ||
    department === "it department";

  const isHRDepartment =
    department === "hr" ||
    department === "hr department" ||
    department === "human resources" ||
    department === "human resources department";

  const isAccountingDepartment =
    department === "accounting" ||
    department === "accounting department";

  const canCreate =
    isAdmin ||
    isHRDepartment ||
    isITDepartment ||
    isAccountingDepartment;

  const canFinalUpload =
    isAdmin ||
    isHRDepartment ||
    isITDepartment ||
    isAccountingDepartment;

  const canDownloadFile =
    isAdmin ||
    isIt ||
    isHr ||
    isHRDepartment ||
    isAccounting ||
    isBranchManager ||
    isAreaManager ||
    isRegionalManager ||
    isAssistantVicePresident ||
    isVicePresident ||
    isSeniorVicePresident ||
    isPresident;

  const canActOnStage = (order) => {
    const status = norm(order?.status);

    if (status === "approved" || status === "rejected") {
      return false;
    }

    return (
      isAdmin ||
      isHRDepartment ||
      isITDepartment ||
      isAccountingDepartment
    );
  };

  const [orders, setOrders] = useState([]);
  const [staff, setStaff] = useState([]);
  const [branches, setBranches] = useState([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [showModal, setShowModal] = useState(false);
  const [viewOrder, setViewOrder] = useState(null);

  const [rejecting, setRejecting] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectSaving, setRejectSaving] = useState(false);

  const [approvalFiles, setApprovalFiles] = useState({});
  const [finalUploadFiles, setFinalUploadFiles] = useState({});
  const [processingId, setProcessingId] = useState("");

  const [employeeSearch, setEmployeeSearch] = useState("");
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);

  const emptyForm = useMemo(
    () => ({
      employee_id: "",
      first_name: "",
      last_name: "",
      middle_name: "",
      prev_position: "",
      prev_branch_id: "",
      to_branch_id: "",
      effective_date: "",
      details: "",
      attachment: null,
    }),
    []
  );

  const [form, setForm] = useState(emptyForm);

  const branchMap = useMemo(() => {
    const m = new Map();
    (branches || []).forEach((b) => m.set(String(b.id), b));
    return m;
  }, [branches]);

  const filteredStaff = useMemo(() => {
    const q = norm(employeeSearch);

    if (!q) return staff.slice(0, 20);

    return staff.filter((s) => {
      const haystack = [
        s.id,
        s.employee_no,
        s.fullname,
        s.first_name,
        s.middle_name,
        s.last_name,
        displayNameParts(s),
        s.position,
        s.department,
        s.area,
        s.region,
        s.division,
      ]
        .map((x) => norm(x))
        .join(" ");

      return haystack.includes(q);
    });
  }, [employeeSearch, staff]);

  const filteredOrders = useMemo(() => {
    const q = norm(search);

    if (!q) return orders;

    return orders.filter((o) => {
      const currentStage = getCurrentStage(o);
      const haystack = [
        o.id,
        o.order_no,
        o.employee_id,
        o.employee_name,
        o.department,
        o.old_position,
        o.new_position,
        o.prev_branch_code,
        o.prev_branch_name,
        o.to_branch_code,
        o.to_branch_name,
        o.effective_date,
        o.status,
        currentStage,
        STAGE_LABELS[currentStage],
        o.details,
        o.rejection_reason,
      ]
        .map((x) => norm(x))
        .join(" ");

      return haystack.includes(q);
    });
  }, [orders, search]);

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

  const badgeClass = (status) => {
    const s = norm(status || "Pending");

    if (s === "approved") return "po-badge po-approved";
    if (s === "rejected") return "po-badge po-rejected";

    return "po-badge po-pending";
  };

  const loadData = async () => {
    setLoading(true);
    setErr("");

    try {
      const [oRes, sRes, bRes] = await Promise.all([
        api.get("/demotion-orders"),
        api.get("/staff"),
        api.get("/branches"),
      ]);

      setOrders(Array.isArray(oRes.data) ? oRes.data : []);
      setStaff(Array.isArray(sRes.data) ? sRes.data : []);
      setBranches(Array.isArray(bRes.data) ? bRes.data : []);
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to load demotion orders.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const isOpen = showModal || viewOrder || rejecting;

    if (!isOpen) return;

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
    setErr("");
    setForm(emptyForm);
    setEmployeeSearch("");
    setShowEmployeeDropdown(false);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSaving(false);
    setErr("");
    setForm(emptyForm);
    setEmployeeSearch("");
    setShowEmployeeDropdown(false);
  };

  const onSelectEmployee = (id) => {
    const emp = staff.find((x) => String(x.id) === String(id));

    setForm((p) => ({
      ...p,
      employee_id: String(id),
      first_name: clean(emp?.first_name),
      last_name: clean(emp?.last_name),
      middle_name: clean(emp?.middle_name),
      prev_position: clean(emp?.position || emp?.["position"]),
      prev_branch_id: emp?.branch_id != null ? String(emp.branch_id) : "",
    }));

    if (emp) {
      setEmployeeSearch(
        `${emp.id} — ${displayNameParts(emp)}${emp.employee_no ? ` (${emp.employee_no})` : ""}`
      );
    }

    setShowEmployeeDropdown(false);
  };

  const submitCreate = async (e) => {
    e.preventDefault();

    if (!canCreate || saving) return;

    setErr("");

    if (!form.employee_id) return setErr("Select employee.");
    if (!clean(form.new_position)) return setErr("New position is required.");
    if (!toDate10(form.effective_date)) return setErr("Effective date is required.");
    if (!form.to_branch_id) return setErr("Destination branch is required.");
    if (!form.attachment) return setErr("Demotion request file is required.");

    const formData = new FormData();

    formData.append("employee_id", Number(form.employee_id));
    formData.append(
      "employee_name",
      displayNameParts({
        last_name: form.last_name,
        first_name: form.first_name,
        middle_name: form.middle_name,
      })
    );
    formData.append("old_position", clean(form.prev_position) || "");
    formData.append("new_position", clean(form.new_position));
    formData.append("effective_date", toDate10(form.effective_date));
    formData.append("details", clean(form.details) || "");
    formData.append("to_branch_id", Number(form.to_branch_id));
    formData.append("attachment", form.attachment);

    setSaving(true);

    try {
      await api.post("/demotion-orders", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      closeModal();
      await loadData();
    } catch (e2) {
      setErr(e2?.response?.data?.message || "Failed to create demotion order.");
    } finally {
      setSaving(false);
    }
  };

  const updateOrder = async (order, action) => {
    const id = order?.id;

    if (!id) return alert("Invalid demotion order.");

    if (!canActOnStage(order)) {
      return alert("Not your approval stage.");
    }

    if (action === "approve" && !approvalFiles[id]) {
      return alert("Upload the signed/approved file first.");
    }

    const ok = window.confirm(
      action === "approve"
        ? `Approve demotion order ${order.order_no || id}?`
        : `Reject demotion order ${order.order_no || id}?`
    );

    if (!ok) return;

    try {
      setProcessingId(`${id}-${action}`);

      const formData = new FormData();
      formData.append("action", action);

      if (action === "approve") {
        formData.append("attachment", approvalFiles[id]);
      }

      if (action === "reject") {
        formData.append("reason", clean(rejectReason));
      }

      await api.put(`/demotion-orders/${id}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setApprovalFiles((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });

      closeReject();
      await loadData();
    } catch (e) {
      setErr(e?.response?.data?.message || `Failed to ${action}.`);
    } finally {
      setProcessingId("");
    }
  };

  const openReject = (order) => {
    if (!canActOnStage(order)) return;

    setRejecting(order);
    setRejectReason("");
  };

  const closeReject = () => {
    setRejecting(null);
    setRejectReason("");
    setRejectSaving(false);
  };

  const submitReject = async (e) => {
    e.preventDefault();

    if (!rejecting || rejectSaving) return;

    if (!clean(rejectReason)) {
      return setErr("Rejection reason is required.");
    }

    setRejectSaving(true);
    await updateOrder(rejecting, "reject");
    setRejectSaving(false);
  };

  const uploadFinalFile = async (order) => {
    const id = order?.id;
    const file = finalUploadFiles[id];

    if (!id) return alert("Invalid order.");
    if (!file) return alert("Please select final approved file.");
    if (!canFinalUpload) return alert("Only Admin, IT, HR, and Accounting can upload final file.");

    if (!window.confirm(`Upload final approved file for ${order.order_no || id}?`)) return;

    try {
      setProcessingId(`${id}-final`);

      const formData = new FormData();
      formData.append("attachment", file);

      await api.post(`/demotion-orders/${id}/approved-file`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setFinalUploadFiles((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });

      await loadData();
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to upload final approved file.");
    } finally {
      setProcessingId("");
    }
  };

  const downloadFile = async (order, type = "latest") => {
    try {
      const res = await api.get(`/demotion-orders/${order.id}/download/${type}`, {
        responseType: "blob",
      });

      const blob = new Blob([res.data]);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");

      a.href = url;
      a.download =
        type === "approved"
          ? order.approved_attachment_name || order.attachment_name || `demotion-${order.id}`
          : order.attachment_name || order.approved_attachment_name || `demotion-${order.id}`;

      document.body.appendChild(a);
      a.click();
      a.remove();

      window.URL.revokeObjectURL(url);
    } catch (e) {
      alert(e?.response?.data?.message || "Failed to download file.");
    }
  };

  const branchLabel = (id) => {
    const b = branchMap.get(String(id));
    if (!b) return id ? String(id) : "-";
    return `${b.code} - ${b.name}`;
  };

  const isWaitingFinalUpload = (order) =>
    norm(order?.status) === "wait for admin order" || norm(order?.approval_stage) === "admin";

  return (
    <div className="po-page">
      <div className="po-topbar">
        <div>
          <h2 className="po-title">Demotion</h2>
          <p className="po-subtitle">
            Operations approval goes through managers. Back office goes directly to Admin / IT / HR / Accounting.
          </p>
        </div>

        <div className="po-topbar-actions">
          <button className="po-btn po-btn-outline" type="button" onClick={() => navigate(-1)}>
            ← Back
          </button>

          <button className="po-btn" type="button" onClick={loadData} disabled={loading}>
            Refresh
          </button>

          {canCreate ? (
            <button className="po-btn po-btn-primary" type="button" onClick={openCreate}>
              + Create Demotion
            </button>
          ) : null}
        </div>
      </div>

      {err ? <div style={{ color: "#ef4444", fontWeight: 900 }}>{err}</div> : null}

      <div className="po-card po-toolbar">
        <div className="po-toolbar-left">
          <input
            className="po-search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search order, employee, department, status, stage..."
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
                <th style={{ width: 130 }}>Order No</th>
                <th>Employee</th>
                <th style={{ width: 180 }}>Department</th>
                <th style={{ width: 170 }}>Prev Position</th>
                <th style={{ width: 170 }}>New Position</th>
                <th style={{ width: 210 }}>Destination</th>
                <th style={{ width: 130 }}>Effective</th>
                <th style={{ width: 150 }}>Status</th>
                <th style={{ width: 220 }}>Current Stage</th>
                <th style={{ width: 300 }}>Files</th>
                <th style={{ width: 380 }}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} className="po-empty">
                    Loading…
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={11} className="po-empty">
                    No demotion orders found.
                  </td>
                </tr>
              ) : (
                pagedOrders.map((o) => {
                  const statusLower = norm(o.status || "Pending");
                  const approved = statusLower === "approved";
                  const rejected = statusLower === "rejected";
                  const currentStage = getCurrentStage(o);
                  const canAct = canActOnStage(o);
                  const waitingFinal = isWaitingFinalUpload(o) && !approved && !rejected;

                  return (
                    <tr key={o.id}>
                      <td className="mono">{o.order_no || "-"}</td>

                      <td>
                        <div className="td-strong">{o.employee_name}</div>
                        <div className="po-dash" style={{ fontSize: 12 }}>
                          ID: <span className="mono">{o.employee_id}</span>
                        </div>
                      </td>

                      <td>{o.department || "-"}</td>
                      <td>{o.old_position || <span className="po-dash">-</span>}</td>
                      <td>{o.new_position || <span className="po-dash">-</span>}</td>
                      <td>{o.to_branch_id ? branchLabel(o.to_branch_id) : "-"}</td>
                      <td className="mono">{toDate10(o.effective_date) || "-"}</td>

                      <td>
                        <span className={badgeClass(o.status)}>{o.status || "Pending"}</span>
                      </td>

                      <td>
                        {approved ? (
                          <span>Approved</span>
                        ) : rejected ? (
                          <span>Rejected</span>
                        ) : (
                          <span>
                            Pending: {STAGE_LABELS[currentStage] || currentStage || "-"}
                          </span>
                        )}
                      </td>

                      <td>
                        <div className="po-row-actions" style={{ flexWrap: "wrap" }}>
                          {o.attachment_path && canDownloadFile ? (
                            <button
                              className="po-mini-btn"
                              type="button"
                              onClick={() => downloadFile(o, "latest")}
                            >
                              Download Latest
                            </button>
                          ) : null}

                          {!o.attachment_path && !o.approved_attachment_path ? (
                            <span className="po-dash" style={{ fontSize: 12 }}>
                              No file
                            </span>
                          ) : null}
                        </div>
                      </td>

                      <td>
                        <div className="po-row-actions" style={{ flexWrap: "wrap" }}>
                          <button
                            className="po-mini-btn"
                            type="button"
                            onClick={() => setViewOrder(o)}
                          >
                            View
                          </button>

                          {canAct && !waitingFinal && !approved && !rejected ? (
                            <>
                              <label className="po-mini-btn" style={{ cursor: "pointer" }}>
                                {approvalFiles[o.id]?.name ? "Change File" : "Upload File"}
                                <input
                                  type="file"
                                  style={{ display: "none" }}
                                  onChange={(e) =>
                                    setApprovalFiles((prev) => ({
                                      ...prev,
                                      [o.id]: e.target.files?.[0] || null,
                                    }))
                                  }
                                />
                              </label>

                              {approvalFiles[o.id]?.name ? (
                                <span style={{ fontSize: 11, maxWidth: 120 }}>
                                  {approvalFiles[o.id].name}
                                </span>
                              ) : null}

                              <button
                                className="po-mini-btn po-approve"
                                type="button"
                                disabled={processingId === `${o.id}-approve`}
                                onClick={() => updateOrder(o, "approve")}
                              >
                                {processingId === `${o.id}-approve`
                                  ? "Approving..."
                                  : "Upload + Approve"}
                              </button>

                              <button
                                className="po-mini-btn po-reject"
                                type="button"
                                disabled={processingId === `${o.id}-reject`}
                                onClick={() => openReject(o)}
                              >
                                Reject
                              </button>
                            </>
                          ) : null}

                          {waitingFinal && canFinalUpload ? (
                            <>
                              <label className="po-mini-btn" style={{ cursor: "pointer" }}>
                                {finalUploadFiles[o.id]?.name ? "Change Final File" : "Final File"}
                                <input
                                  type="file"
                                  style={{ display: "none" }}
                                  onChange={(e) =>
                                    setFinalUploadFiles((prev) => ({
                                      ...prev,
                                      [o.id]: e.target.files?.[0] || null,
                                    }))
                                  }
                                />
                              </label>

                              {finalUploadFiles[o.id]?.name ? (
                                <span style={{ fontSize: 11, maxWidth: 120 }}>
                                  {finalUploadFiles[o.id].name}
                                </span>
                              ) : null}

                              <button
                                className="po-mini-btn po-approve"
                                type="button"
                                disabled={processingId === `${o.id}-final`}
                                onClick={() => uploadFinalFile(o)}
                              >
                                {processingId === `${o.id}-final`
                                  ? "Uploading..."
                                  : "Upload Final + Approve"}
                              </button>
                            </>
                          ) : null}

                          {!canAct && !waitingFinal && !approved && !rejected ? (
                            <span className="po-dash" style={{ fontSize: 12 }}>
                              Waiting
                            </span>
                          ) : null}

                          {approved ? (
                            <span className="po-dash" style={{ fontSize: 12 }}>
                              Approved
                            </span>
                          ) : null}

                          {rejected ? (
                            <span className="po-dash" style={{ fontSize: 12 }}>
                              Rejected
                            </span>
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
          onMouseDown={(e) => e.target.classList.contains("po-modal-overlay") && closeModal()}
        >
          <div className="po-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="po-modal-head">
              <div>
                <h3 className="po-modal-title">Create Demotion</h3>
                <div className="po-modal-sub">
                  Upload the first demotion file. Each approver uploads a signed file replacing the previous one.
                </div>
              </div>

              <button className="po-x" type="button" onClick={closeModal}>
                ✕
              </button>
            </div>

            <form className="po-form" onSubmit={submitCreate}>
              <div className="po-grid">
                <div className="po-field full" ref={employeeBoxRef} style={{ position: "relative" }}>
                  <label>Employee</label>

                  <input
                    type="text"
                    placeholder="Search employee ID, name, or employee no..."
                    value={employeeSearch}
                    onChange={(e) => {
                      setEmployeeSearch(e.target.value);
                      setShowEmployeeDropdown(true);
                      setForm((p) => ({
                        ...p,
                        employee_id: "",
                        first_name: "",
                        last_name: "",
                        middle_name: "",
                        prev_position: "",
                        prev_branch_id: "",
                      }));
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
                        zIndex: 50,
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
                  <label>Employee ID</label>
                  <input value={form.employee_id} readOnly />
                </div>

                <div className="po-field">
                  <label>Last Name</label>
                  <input value={form.last_name} readOnly />
                </div>

                <div className="po-field">
                  <label>First Name</label>
                  <input value={form.first_name} readOnly />
                </div>

                <div className="po-field">
                  <label>Middle Name</label>
                  <input value={form.middle_name} readOnly />
                </div>

                <div className="po-field">
                  <label>Previous Position</label>
                  <input value={form.prev_position} readOnly />
                </div>

                <div className="po-field">
                  <label>New Position</label>
                  <input
                    value={form.new_position}
                    onChange={(e) => setForm((p) => ({ ...p, new_position: e.target.value }))}
                    placeholder="Enter new position"
                    required
                  />
                </div>

                <div className="po-field">
                  <label>Previous Branch</label>
                  <input value={form.prev_branch_id ? branchLabel(form.prev_branch_id) : "-"} readOnly />
                </div>

                <div className="po-field">
                  <label>Destination Branch</label>
                  <select
                    value={form.to_branch_id}
                    onChange={(e) => setForm((p) => ({ ...p, to_branch_id: e.target.value }))}
                    required
                  >
                    <option value="">Select branch</option>
                    {branches
                      .filter((b) => String(b.id) !== String(form.prev_branch_id))
                      .map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.code} - {b.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="po-field">
                  <label>Effective Date</label>
                  <input
                    type="date"
                    value={form.effective_date}
                    onChange={(e) => setForm((p) => ({ ...p, effective_date: e.target.value }))}
                    required
                  />
                </div>

                <div className="po-field">
                  <label>Attach Demotion File</label>
                  <input
                    type="file"
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        attachment: e.target.files?.[0] || null,
                      }))
                    }
                    required
                  />
                </div>

                <div className="po-field full">
                  <label>Details / Remarks</label>
                  <input
                    value={form.details}
                    onChange={(e) => setForm((p) => ({ ...p, details: e.target.value }))}
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div className="po-modal-actions">
                <button className="po-btn po-btn-outline" type="button" onClick={closeModal} disabled={saving}>
                  Cancel
                </button>

                <button className="po-btn po-btn-primary" type="submit" disabled={saving}>
                  {saving ? "Saving..." : "Create"}
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
                <h3 className="po-modal-title">Demotion Details</h3>
                <div className="po-modal-sub">
                  Order <b>{viewOrder.order_no || viewOrder.id}</b> — {viewOrder.employee_name}
                </div>
              </div>

              <button className="po-x" type="button" onClick={() => setViewOrder(null)}>
                ✕
              </button>
            </div>

            <div className="po-form">
              <div className="po-grid">
                <div className="po-field">
                  <label>Current Pending Stage</label>
                  <input
                    value={
                      norm(viewOrder.status) === "approved"
                        ? "Approved"
                        : norm(viewOrder.status) === "rejected"
                        ? "Rejected"
                        : STAGE_LABELS[getCurrentStage(viewOrder)] || getCurrentStage(viewOrder)
                    }
                    readOnly
                  />
                </div>

                <div className="po-field">
                  <label>Status</label>
                  <input value={viewOrder.status || "Pending"} readOnly />
                </div>

                <div className="po-field">
                  <label>Employee</label>
                  <input value={viewOrder.employee_name || "-"} readOnly />
                </div>

                <div className="po-field">
                  <label>Department</label>
                  <input value={viewOrder.department || "-"} readOnly />
                </div>

                <div className="po-field">
                  <label>Old Position</label>
                  <input value={viewOrder.old_position || "-"} readOnly />
                </div>

                <div className="po-field">
                  <label>New Position</label>
                  <input value={viewOrder.new_position || "-"} readOnly />
                </div>

                <div className="po-field">
                  <label>Destination Branch</label>
                  <input
                    value={viewOrder.to_branch_id ? branchLabel(viewOrder.to_branch_id) : "-"}
                    readOnly
                  />
                </div>

                <div className="po-field">
                  <label>Effective Date</label>
                  <input value={toDate10(viewOrder.effective_date) || "-"} readOnly />
                </div>

                <div className="po-field full">
                  <label>Approval Chain</label>
                  <textarea value={renderChainSummary(viewOrder)} readOnly />
                </div>

                <div className="po-field full">
                  <label>Remarks / Details</label>
                  <textarea value={viewOrder.details || "-"} readOnly />
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
          onMouseDown={(e) => e.target.classList.contains("po-modal-overlay") && closeReject()}
        >
          <div className="po-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="po-modal-head">
              <div>
                <h3 className="po-modal-title">Reject Demotion</h3>
                <div className="po-modal-sub">
                  Order <b>{rejecting.order_no || rejecting.id}</b> — {rejecting.employee_name}
                </div>
              </div>

              <button className="po-x" type="button" onClick={closeReject}>
                ✕
              </button>
            </div>

            <form className="po-form" onSubmit={submitReject}>
              <div className="po-grid">
                <div className="po-field full">
                  <label>Rejection Reason</label>
                  <input
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Type reason..."
                    required
                  />
                </div>
              </div>

              <div className="po-modal-actions">
                <button className="po-btn po-btn-outline" type="button" onClick={closeReject} disabled={rejectSaving}>
                  Cancel
                </button>

                <button className="po-btn po-btn-primary" type="submit" disabled={rejectSaving}>
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