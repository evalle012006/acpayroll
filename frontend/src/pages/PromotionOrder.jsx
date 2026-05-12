import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/PromotionOrder.css";
import api from "../api/axiosClient";

const toNum = (v) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const money = (v) => {
  const n = toNum(v);
  return n ? n.toLocaleString() : "0";
};

const toStr = (v) => String(v ?? "").trim();
const norm = (v) => toStr(v).toLowerCase();

const readUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
};

const fmtDate = (d) => (d ? String(d).slice(0, 10) : "-");

const OPERATION_DEPTS = ["operation", "operations", "payroll", "operation department"];
const BACK_OFFICE_DEPTS = [
  "it",
  "it department",
  "accounting",
  "accounting department",
  "hr",
  "hr department",
  "human resources",
  "tread",
  "tread department",
  "office of the president",
];

const isOperationDept = (dept) => OPERATION_DEPTS.includes(norm(dept));
const isBackOfficeDept = (dept) => BACK_OFFICE_DEPTS.includes(norm(dept));

const STAGE_LABELS = {
  "branch manager": "Branch Manager",
  "area manager": "Area Manager",
  "regional manager": "Regional Manager",
  "assistant vice president": "Assistant Vice President",
  "vice president": "Vice President",
  "senior vice president": "Senior Vice President",
  "final upload": "Final File Upload",
};

const getDepartment = (o) =>
  o?.department ||
  o?.staff_department ||
  o?.promoted_staff_department ||
  o?.employee_department ||
  "";

const getCurrentStageLabel = (o) => {
  const stage = norm(o?.approval_stage);
  return STAGE_LABELS[stage] || "-";
};

export default function PromotionOrder() {
  const navigate = useNavigate();
  const user = useMemo(() => readUser(), []);
  const role = norm(user?.role);

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

  const canCreatePromotion =
    isAdmin ||
    isIt ||
    isHr ||
    isAccounting ||
    isBranchManager ||
    isAreaManager ||
    isRegionalManager ||
    isAssistantVicePresident ||
    isVicePresident ||
    isSeniorVicePresident ||
    isPresident;

  const canApproveStage = (o) => {
    if (!o || norm(o.status) !== "pending") return false;

    const stage = norm(o.approval_stage);

    if (stage === "branch manager")
      return isBranchManager || isAdmin || isIt;

    if (stage === "area manager")
      return isAreaManager || isAdmin || isIt;

    if (stage === "regional manager")
      return isRegionalManager || isAdmin || isIt;

    if (stage === "assistant vice president")
      return isAssistantVicePresident || isAdmin || isIt;

    if (stage === "vice president")
      return isVicePresident || isAdmin || isIt;

    if (stage === "senior vice president")
      return isSeniorVicePresident || isAdmin || isIt;

    return false;
  };

  const canFinalUpload = (o) => {
    if (!o || norm(o.status) !== "pending") return false;
    if (norm(o.approval_stage) !== "final upload") return false;

    const dept = getDepartment(o);

    if (isOperationDept(dept)) return isAdmin || isHr || isAccounting || isIt;
    if (isBackOfficeDept(dept)) return isAdmin || isHr || isAccounting;

    return isAdmin || isHr || isAccounting;
  };

  const [staff, setStaff] = useState([]);
  const [branches, setBranches] = useState([]);
  const [orders, setOrders] = useState([]);
  const [positionRates, setPositionRates] = useState([]);

  const [orderSearch, setOrderSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [loadingStaff, setLoadingStaff] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingRates, setLoadingRates] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingId, setUploadingId] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [approvalFiles, setApprovalFiles] = useState({});
  const [viewOrder, setViewOrder] = useState(null);

  const [form, setForm] = useState({
    employee_id: "",
    employee_name: "",
    department: "",
    old_position: "",
    new_position: "",
    old_salary: "",
    new_salary: "",
    old_ecola: "",
    new_ecola: "",
    effective_date: "",
    remarks: "",
    prev_branch_id: "",
    prev_branch_code: "",
    prev_branch_name: "",
    present_branch_id: "",
    present_branch_code: "",
    present_branch_name: "",
  });

  const [employeeSearch, setEmployeeSearch] = useState("");
  const [employeeQuery, setEmployeeQuery] = useState("");
  const [showEmployeeResults, setShowEmployeeResults] = useState(false);
  const [attachmentFile, setAttachmentFile] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  const [branchSearch, setBranchSearch] = useState("");
  const [showBranchResults, setShowBranchResults] = useState(false);

  const employeePickerRef = useRef(null);
  const branchPickerRef = useRef(null);

  const branchMap = useMemo(() => {
    const m = new Map();
    branches.forEach((b) => m.set(Number(b.id), b));
    return m;
  }, [branches]);

  const rateMap = useMemo(() => {
    const m = new Map();
    positionRates.forEach((r) => {
      const key = norm(r.position);
      if (key) m.set(key, r);
    });
    return m;
  }, [positionRates]);

  const positionOptions = useMemo(() => {
    const seen = new Set();

    return positionRates
      .filter((r) => {
        const key = norm(r.position);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => toStr(a.position).localeCompare(toStr(b.position)));
  }, [positionRates]);

  const filteredStaff = useMemo(() => {
    const q = norm(employeeQuery);

    const list = !q
      ? staff
      : staff.filter((s) => {
          const hay = [
            s.id,
            s.employee_no,
            s.fullname,
            s.first_name,
            s.last_name,
            s.middle_name,
            s.position,
            s.department,
            s.department_name,
            s.area,
            s.region,
            s.division,
          ]
            .map(norm)
            .join(" ");

          return hay.includes(q);
        });

    return list.slice(0, 50);
  }, [staff, employeeQuery]);

  const filteredBranches = useMemo(() => {
    const q = norm(branchSearch);

    const list = !q
      ? branches
      : branches.filter((b) => {
          const hay = [b.id, b.code, b.name, b.area, b.region, b.division]
            .map(norm)
            .join(" ");

          return hay.includes(q);
        });

    return list.sort((a, b) =>
      `${a.code || ""} ${a.name || ""}`.localeCompare(`${b.code || ""} ${b.name || ""}`)
    );
  }, [branches, branchSearch]);

  const resetForm = () => {
    setForm({
      employee_id: "",
      employee_name: "",
      department: "",
      old_position: "",
      new_position: "",
      old_salary: "",
      new_salary: "",
      old_ecola: "",
      new_ecola: "",
      effective_date: "",
      remarks: "",
      prev_branch_id: "",
      prev_branch_code: "",
      prev_branch_name: "",
      present_branch_id: "",
      present_branch_code: "",
      present_branch_name: "",
    });
  };

  const closeModal = () => {
    setShowCreate(false);
    resetForm();
    setEmployeeSearch("");
    setEmployeeQuery("");
    setBranchSearch("");
    setSelectedEmployee(null);
    setShowEmployeeResults(false);
    setShowBranchResults(false);
    setAttachmentFile(null);
  };

  const loadStaff = useCallback(async () => {
    try {
      setLoadingStaff(true);
      const res = await api.get("/staff");
      setStaff(Array.isArray(res.data) ? res.data : []);
    } catch {
      setStaff([]);
    } finally {
      setLoadingStaff(false);
    }
  }, []);

  const loadBranches = useCallback(async () => {
    try {
      setLoadingBranches(true);
      const res = await api.get("/branches-all");
      setBranches(Array.isArray(res.data) ? res.data : []);
    } catch {
      setBranches([]);
    } finally {
      setLoadingBranches(false);
    }
  }, []);

  const loadOrders = useCallback(async () => {
    try {
      setLoadingOrders(true);
      const res = await api.get("/promotion-orders");
      setOrders(Array.isArray(res.data) ? res.data : []);
    } catch {
      setOrders([]);
    } finally {
      setLoadingOrders(false);
    }
  }, []);

  const loadRates = useCallback(async () => {
    try {
      setLoadingRates(true);
      const res = await api.get("/comp-rates");
      setPositionRates(Array.isArray(res.data) ? res.data : []);
    } catch {
      setPositionRates([]);
    } finally {
      setLoadingRates(false);
    }
  }, []);

  useEffect(() => {
    loadStaff();
    loadBranches();
    loadOrders();
    loadRates();
  }, [loadStaff, loadBranches, loadOrders, loadRates]);

  useEffect(() => {
    if (!showCreate) return;

    const onKey = (e) => e.key === "Escape" && closeModal();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [showCreate]);

  useEffect(() => {
    const onMouseDown = (e) => {
      if (employeePickerRef.current && !employeePickerRef.current.contains(e.target)) {
        setShowEmployeeResults(false);
      }

      if (branchPickerRef.current && !branchPickerRef.current.contains(e.target)) {
        setShowBranchResults(false);
      }
    };

    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  const onSelectEmployee = (employeeId) => {
    const s = staff.find((x) => String(x.id) === String(employeeId));
    if (!s) return;

    const prevBranchId = s?.branch_id ? Number(s.branch_id) : null;
    const prevBranch = prevBranchId ? branchMap.get(prevBranchId) : null;
    const idStr = String(s.id);

    setSelectedEmployee(s);

    setForm((p) => ({
      ...p,
      employee_id: idStr,
      employee_name: s?.fullname || "",
      department: s?.department || s?.department_name || "",
      old_position: s?.position || "",
      new_position: "",
      old_salary: String(toNum(s?.salary)),
      new_salary: "",
      old_ecola: String(toNum(s?.ecola)),
      new_ecola: "",
      prev_branch_id: prevBranchId ? String(prevBranchId) : "",
      prev_branch_code: prevBranch?.code || "",
      prev_branch_name: prevBranch?.name || "",
      present_branch_id: prevBranchId ? String(prevBranchId) : "",
      present_branch_code: prevBranch?.code || "",
      present_branch_name: prevBranch?.name || "",
    }));

    const label = `${s.employee_no ? `${s.employee_no} - ` : ""}${s.fullname || ""}`;
    setEmployeeSearch(label);
    setEmployeeQuery(label);

    const presentBranchLabel = prevBranch
      ? `${prevBranch.code || ""} - ${prevBranch.name || ""}`.trim()
      : "";

    setBranchSearch(presentBranchLabel);
    setShowEmployeeResults(false);
  };

  const onSelectPresentBranch = (branchId) => {
    const bid = branchId ? Number(branchId) : null;
    const b = bid ? branchMap.get(bid) : null;

    setForm((p) => ({
      ...p,
      present_branch_id: branchId ? String(branchId) : "",
      present_branch_code: b?.code || "",
      present_branch_name: b?.name || "",
    }));

    setBranchSearch(b ? `${b.code || ""} - ${b.name || ""}`.trim() : "");
    setShowBranchResults(false);
  };

  const onSelectNewPosition = (positionValue) => {
    const picked = toStr(positionValue);
    const rate = rateMap.get(norm(picked));

    setForm((p) => ({
      ...p,
      new_position: picked,
      new_salary: rate ? String(toNum(rate.salary)) : "",
      new_ecola: rate ? String(toNum(rate.ecola)) : "",
    }));
  };

  const createOrder = async (e) => {
    e.preventDefault();

    if (!selectedEmployee || !form.employee_id) return alert("Employee is required");
    if (!form.department.trim()) return alert("Employee department is required.");
    if (!form.new_position.trim()) return alert("New position is required.");
    if (!form.effective_date.trim()) return alert("Effective date is required.");
    if (!form.present_branch_id.trim()) return alert("Present branch is required.");
    if (!attachmentFile) return alert("Promotion request file is required.");

    try {
      setSaving(true);

      const formData = new FormData();
      formData.append("employee_id", parseInt(String(selectedEmployee.id), 10));
      formData.append("employee_name", form.employee_name.trim());
      formData.append("department", form.department.trim());
      formData.append("old_position", form.old_position.trim());
      formData.append("new_position", form.new_position.trim());
      formData.append("old_salary", toNum(form.old_salary));
      formData.append("new_salary", toNum(form.new_salary));
      formData.append("old_ecola", toNum(form.old_ecola));
      formData.append("new_ecola", toNum(form.new_ecola));
      formData.append("effective_date", form.effective_date.slice(0, 10));
      formData.append("remarks", form.remarks.trim());
      formData.append("prev_branch_id", form.prev_branch_id ? Number(form.prev_branch_id) : "");
      formData.append("prev_branch_code", form.prev_branch_code);
      formData.append("prev_branch_name", form.prev_branch_name);
      formData.append("present_branch_id", form.present_branch_id ? Number(form.present_branch_id) : "");
      formData.append("present_branch_code", form.present_branch_code);
      formData.append("present_branch_name", form.present_branch_name);
      formData.append("attachment", attachmentFile);

      await api.post("/promotion-orders", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      alert("Promotion order created.");
      closeModal();
      await loadOrders();
    } catch (err) {
      alert(err?.response?.data?.message || err.message || "Failed to create promotion order.");
    } finally {
      setSaving(false);
    }
  };

  const downloadFile = async (id, type = "latest", fallbackName = "") => {
    try {
      const res = await api.get(`/promotion-orders/${id}/download/${type}`, {
        responseType: "blob",
      });

      const blob = new Blob([res.data]);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");

      a.href = url;
      a.download = fallbackName || `promotion-${id}-${type}`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to download file.");
    }
  };

  const approve = async (order) => {
    const file = approvalFiles[order.id];

    if (!file) {
      alert("Please upload the signed/approved promotion file before approving.");
      return;
    }

    try {
      setUploadingId(String(order.id));

      const formData = new FormData();
      formData.append("attachment", file);

      await api.put(`/promotion-orders/${order.id}/approve`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setApprovalFiles((prev) => {
        const copy = { ...prev };
        delete copy[order.id];
        return copy;
      });

      await loadOrders();
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to approve.");
    } finally {
      setUploadingId("");
    }
  };

  const finalUpload = async (order) => {
    const file = approvalFiles[order.id];

    if (!file) {
      alert("Please upload the final approved promotion file.");
      return;
    }

    try {
      setUploadingId(String(order.id));

      const formData = new FormData();
      formData.append("attachment", file);

      await api.put(`/promotion-orders/${order.id}/final-upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setApprovalFiles((prev) => {
        const copy = { ...prev };
        delete copy[order.id];
        return copy;
      });

      await loadOrders();
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to upload final file.");
    } finally {
      setUploadingId("");
    }
  };

  const reject = async (id) => {
    const reason = prompt("Enter rejection reason:");
    if (!reason || !reason.trim()) return;

    try {
      await api.put(`/promotion-orders/${id}/reject`, { reason: reason.trim() });
      await loadOrders();
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to reject.");
    }
  };

  const resolvePrevBranchText = (o) => {
  if (o.prev_branch_code || o.prev_branch_name) {
    return `${o.prev_branch_code || ""} - ${o.prev_branch_name || ""}`.trim();
  }

  const b = o.prev_branch_id
    ? branchMap.get(Number(o.prev_branch_id))
    : null;

  return b
    ? `${b.code || ""} - ${b.name || ""}`.trim()
    : "-";
};

const resolvePresentBranchText = (o) => {
  if (o.present_branch_code || o.present_branch_name) {
    return `${o.present_branch_code || ""} - ${o.present_branch_name || ""}`.trim();
  }

  const b = o.present_branch_id
    ? branchMap.get(Number(o.present_branch_id))
    : null;

  return b
    ? `${b.code || ""} - ${b.name || ""}`.trim()
    : "-";
};

const filteredOrders = useMemo(() => {
  const q = norm(orderSearch);

  if (!q) return orders;

  return orders.filter((o) => {
    const hay = [
      o.order_no,
      o.employee_name,
      o.employee_no,
      o.old_position,
      o.new_position,
      o.status,
      o.approval_stage,
      getDepartment(o),
      resolvePrevBranchText(o),
      resolvePresentBranchText(o),
      fmtDate(o.effective_date),
    ]
      .map(norm)
      .join(" ");

    return hay.includes(q);
  });
}, [orders, orderSearch, branchMap]);

const totalPages = Math.max(
  1,
  Math.ceil(filteredOrders.length / pageSize)
);

const paginatedOrders = useMemo(() => {
  const safePage = Math.min(page, totalPages);

  const start = (safePage - 1) * pageSize;

  return filteredOrders.slice(
    start,
    start + pageSize
  );
}, [
  filteredOrders,
  page,
  pageSize,
  totalPages,
]);

useEffect(() => {
  setPage(1);
}, [orderSearch, pageSize]);

useEffect(() => {
  if (page > totalPages) {
    setPage(totalPages);
  }
}, [page, totalPages]);

const countText = useMemo(() => {
  const total = Array.isArray(orders)
    ? orders.length
    : 0;

  const filtered =
    filteredOrders.length;

  if (orderSearch.trim()) {
    return `${filtered} of ${total} Record${
      total === 1 ? "" : "s"
    }`;
  }

  return `${total} Record${
    total === 1 ? "" : "s"
  }`;
}, [
  orders,
  filteredOrders,
  orderSearch,
]);

const badgeClass = (status) => {
  const s = norm(status);

  if (s === "approved") {
    return "po-badge po-approved";
  }

  if (s === "rejected") {
    return "po-badge po-rejected";
  }

  return "po-badge po-pending";
};

const closeViewOrder = () =>
  setViewOrder(null);

  return (
    <div className="po-page">
      <div className="po-topbar">
        <div>
          <h2 className="po-title">Promotion Orders</h2>
          <p className="po-subtitle">
            Operation: Branch Manager to Vice President, then final upload.
            Back office: Senior Vice President, then final upload.
          </p>
        </div>

        <div className="po-actions">
          <button className="po-btn po-btn-ghost" type="button" onClick={() => navigate(-1)}>
            ← Back
          </button>

          <button className="po-btn po-btn-outline" type="button" onClick={loadOrders} disabled={loadingOrders}>
            {loadingOrders ? "Refreshing..." : "Refresh"}
          </button>

          {canCreatePromotion && (
            <button className="po-btn po-btn-primary" type="button" onClick={() => setShowCreate(true)}>
              + Create Promotion
            </button>
          )}
        </div>
      </div>

      <div className="po-card">
        <div className="po-card-head">
          <div className="po-toolbar">
            <input
              className="po-search-input"
              value={orderSearch}
              onChange={(e) => setOrderSearch(e.target.value)}
              placeholder="Search order no, employee, branch, position, status..."
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
          </div>
          <div className="po-card-title">Promotion Orders</div>
          <div className="po-card-meta">{countText}</div>
        </div>

        <div className="po-table-wrap">
          <table className="po-table">
            <thead>
              <tr>
                <th>ORDER NO</th>
                <th>EMPLOYEE</th>
                <th>PREVIOUS BRANCH</th>
                <th>PRESENT BRANCH</th>
                <th>OLD POSITION</th>
                <th>NEW POSITION</th>
                <th>EFFECTIVE</th>
                <th>STATUS</th>
                <th>CURRENT STAGE</th>
                <th>LATEST FILE</th>
                <th>ACTION</th>
              </tr>
            </thead>

            <tbody>
              {loadingOrders ? (
                <tr>
                  <td colSpan={11} className="po-empty">
                    Loading promotion orders…
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={11} className="po-empty">
                    No promotion orders found.
                  </td>
                </tr>
              ) : (
                paginatedOrders.map((o) => {
                  const isPending = norm(o.status) === "pending";
                  const canAct = canApproveStage(o);
                  const canUploadFinal = canFinalUpload(o);

                  return (
                    <tr key={o.id}>
                      <td className="mono">{o.order_no || `PRO-${o.id}`}</td>
                      <td className="td-strong">{o.employee_name}</td>
                      <td>{resolvePrevBranchText(o)}</td>
                      <td>{resolvePresentBranchText(o)}</td>
                      <td>{o.old_position || "-"}</td>
                      <td>{o.new_position || "-"}</td>
                      <td>{fmtDate(o.effective_date)}</td>

                      <td>
                        <span className={badgeClass(o.status)}>
                          {o.status || "Pending"}
                        </span>
                      </td>

                      <td>{getCurrentStageLabel(o)}</td>

                      <td>
                        {o.attachment_path ? (
                          <button
                            className="po-mini-btn po-download-btn"
                            type="button"
                            onClick={() => downloadFile(o.id, "latest", o.attachment_name || "")}
                          >
                            Download Latest
                          </button>
                        ) : (
                          <span className="po-dash">No file</span>
                        )}
                      </td>

                      <td>
                        {canAct && isPending ? (
                          <div className="po-action-stack">
                            <div className="po-file-actions">
                              <button
                                className="po-mini-btn po-view-btn"
                                type="button"
                                onClick={() => setViewOrder(o)}
                              >
                                View
                              </button>

                              <label className="po-mini-btn po-upload-btn">
                                {approvalFiles[o.id]?.name ? "Change File" : "Upload File"}
                                <input
                                  type="file"
                                  hidden
                                  accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                                  onChange={(e) =>
                                    setApprovalFiles((prev) => ({
                                      ...prev,
                                      [o.id]: e.target.files?.[0] || null,
                                    }))
                                  }
                                />
                              </label>
                            </div>

                            {approvalFiles[o.id]?.name ? (
                              <div className="po-file-name" title={approvalFiles[o.id].name}>
                                {approvalFiles[o.id].name}
                              </div>
                            ) : null}

                            <div className="po-file-actions">
                              <button
                                className="po-mini-btn po-approve"
                                type="button"
                                disabled={uploadingId === String(o.id)}
                                onClick={() => approve(o)}
                              >
                                {uploadingId === String(o.id) ? "Approving..." : "Upload + Approve"}
                              </button>

                              <button
                                className="po-mini-btn po-reject"
                                type="button"
                                onClick={() => reject(o.id)}
                              >
                                Reject
                              </button>
                            </div>
                          </div>
                        ) : canUploadFinal && isPending ? (
                          <div className="po-action-stack">
                            <div className="po-file-actions">
                              <button
                                className="po-mini-btn po-view-btn"
                                type="button"
                                onClick={() => setViewOrder(o)}
                              >
                                View
                              </button>

                              <label className="po-mini-btn po-upload-btn">
                                {approvalFiles[o.id]?.name ? "Change File" : "Upload Final"}
                                <input
                                  type="file"
                                  hidden
                                  accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                                  onChange={(e) =>
                                    setApprovalFiles((prev) => ({
                                      ...prev,
                                      [o.id]: e.target.files?.[0] || null,
                                    }))
                                  }
                                />
                              </label>
                            </div>

                            {approvalFiles[o.id]?.name ? (
                              <div className="po-file-name" title={approvalFiles[o.id].name}>
                                {approvalFiles[o.id].name}
                              </div>
                            ) : null}

                            <button
                              className="po-mini-btn po-approve"
                              type="button"
                              disabled={uploadingId === String(o.id)}
                              onClick={() => finalUpload(o)}
                            >
                              {uploadingId === String(o.id) ? "Uploading..." : "Submit Final"}
                            </button>
                          </div>
                        ) : (
                          <button
                            className="po-mini-btn po-view-btn"
                            type="button"
                            onClick={() => setViewOrder(o)}
                          >
                            View
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="po-pager">
          <button
            className="po-mini-btn"
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Prev
          </button>

          <span className="po-page-info">
            Page {page} of {totalPages}
          </span>

          <button
            className="po-mini-btn"
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
          </button>
        </div>
      </div>

      {viewOrder && (
        <div className="po-modal-overlay" onMouseDown={closeViewOrder}>
          <div className="po-record-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="po-modal-head">
              <div>
                <h3 className="po-modal-title">Promotion Record</h3>
                <p className="po-modal-sub">
                  {viewOrder.employee_name || "-"} • Order No:{" "}
                  {viewOrder.order_no || `PRO-${viewOrder.id}`}
                </p>
              </div>

              <button className="po-x" type="button" onClick={closeViewOrder}>
                ✕
              </button>
            </div>

            <div className="po-record-badges">
              <span>Status: {viewOrder.status || "Pending"}</span>
              <span>Current Stage: {getCurrentStageLabel(viewOrder)}</span>
              <span>Department: {getDepartment(viewOrder) || "-"}</span>
            </div>

            <div className="po-record-table">
              <div><strong>Order No</strong><span>{viewOrder.order_no || `PRO-${viewOrder.id}`}</span></div>
              <div><strong>Employee Name</strong><span>{viewOrder.employee_name || "-"}</span></div>
              <div><strong>Department</strong><span>{getDepartment(viewOrder) || "-"}</span></div>
              <div><strong>Previous Branch</strong><span>{resolvePrevBranchText(viewOrder)}</span></div>
              <div><strong>Present Branch</strong><span>{resolvePresentBranchText(viewOrder)}</span></div>
              <div><strong>Old Position</strong><span>{viewOrder.old_position || "-"}</span></div>
              <div><strong>New Position</strong><span>{viewOrder.new_position || "-"}</span></div>
              <div><strong>Old Salary</strong><span>{money(viewOrder.old_salary)}</span></div>
              <div><strong>New Salary</strong><span>{money(viewOrder.new_salary)}</span></div>
              <div><strong>Old ECOLA</strong><span>{money(viewOrder.old_ecola)}</span></div>
              <div><strong>New ECOLA</strong><span>{money(viewOrder.new_ecola)}</span></div>
              <div><strong>Effective Date</strong><span>{fmtDate(viewOrder.effective_date)}</span></div>
              <div><strong>Details / Remarks</strong><span>{viewOrder.details || "-"}</span></div>
              <div><strong>Branch Manager Status</strong><span>{viewOrder.branch_manager_status || "-"}</span></div>
              <div><strong>Area Manager Status</strong><span>{viewOrder.area_manager_status || "-"}</span></div>
              <div><strong>Regional Manager Status</strong><span>{viewOrder.regional_manager_status || "-"}</span></div>
              <div><strong>Assistant VP Status</strong><span>{viewOrder.assistant_vice_president_status || "-"}</span></div>
              <div><strong>Vice President Status</strong><span>{viewOrder.vice_president_status || "-"}</span></div>
              <div><strong>Senior VP Status</strong><span>{viewOrder.senior_vice_president_status || "-"}</span></div>
              <div><strong>Final Status</strong><span>{viewOrder.final_status || "-"}</span></div>

              <div>
                <strong>File</strong>
                <span>
                  {viewOrder.attachment_path ? (
                    <button
                      className="po-mini-btn po-download-btn"
                      type="button"
                      onClick={() =>
                        downloadFile(viewOrder.id, "latest", viewOrder.attachment_name || "")
                      }
                    >
                      Download File
                    </button>
                  ) : (
                    "No file"
                  )}
                </span>
              </div>

              <div><strong>Created</strong><span>{fmtDate(viewOrder.created_at)}</span></div>
            </div>

            <div className="po-modal-actions">
              <button className="po-btn po-btn-primary" type="button" onClick={closeViewOrder}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {canCreatePromotion && showCreate && (
        <div
          className="po-modal-overlay"
          onMouseDown={(e) =>
            e.target.classList.contains("po-modal-overlay") && closeModal()
          }
        >
          <div className="po-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="po-modal-head">
              <div>
                <h3 className="po-modal-title">Create Promotion Order</h3>
                <p className="po-modal-sub">
                  Approval chain will be based on the promoted staff department.
                </p>
              </div>

              <button className="po-x" type="button" onClick={closeModal}>
                ✕
              </button>
            </div>

            <form onSubmit={createOrder} className="po-form">
              <div className="po-grid">
                <div className="po-field" ref={employeePickerRef} style={{ position: "relative", overflow: "visible" }}>
                  <label>Employee</label>

                  <input
                    value={employeeSearch}
                    onChange={(e) => {
                      const value = e.target.value;
                      setEmployeeSearch(value);
                      setEmployeeQuery(value);
                      setShowEmployeeResults(true);
                      setSelectedEmployee(null);
                      resetForm();
                      setBranchSearch("");
                    }}
                    onFocus={() => setShowEmployeeResults(true)}
                    placeholder="Search employee no or name..."
                  />

                  {showEmployeeResults && (
                    <div className="po-search-dropdown">
                      {loadingStaff ? (
                        <div className="po-search-empty">Loading staff...</div>
                      ) : filteredStaff.length === 0 ? (
                        <div className="po-search-empty">No employee found.</div>
                      ) : (
                        filteredStaff.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            className="po-search-item"
                            onClick={() => onSelectEmployee(s.id)}
                          >
                            {(s.employee_no ? `${s.employee_no} - ` : "") + (s.fullname || "-")}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                <div className="po-field">
                  <label>Department</label>
                  <input value={form.department} readOnly placeholder="Auto-filled" />
                </div>

                <div className="po-field">
                  <label>Effective Date</label>
                  <input
                    type="date"
                    value={form.effective_date}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, effective_date: e.target.value }))
                    }
                    required
                  />
                </div>

                <div className="po-field">
                  <label>Previous Branch</label>
                  <input
                    value={`${form.prev_branch_code || ""}${
                      form.prev_branch_name ? ` - ${form.prev_branch_name}` : ""
                    }`}
                    readOnly
                    placeholder="Auto-filled"
                  />
                </div>

                <div className="po-field" ref={branchPickerRef} style={{ position: "relative", overflow: "visible" }}>
                  <label>Present Branch</label>

                  <input
                    value={branchSearch}
                    onChange={(e) => {
                      const value = e.target.value;
                      setBranchSearch(value);
                      setShowBranchResults(true);

                      setForm((p) => ({
                        ...p,
                        present_branch_id: "",
                        present_branch_code: "",
                        present_branch_name: "",
                      }));
                    }}
                    onFocus={() => setShowBranchResults(true)}
                    placeholder={loadingBranches ? "Loading branches..." : "Search branch code or name..."}
                    required
                  />

                  {showBranchResults && (
                    <div className="po-search-dropdown">
                      {loadingBranches ? (
                        <div className="po-search-empty">Loading branches...</div>
                      ) : filteredBranches.length === 0 ? (
                        <div className="po-search-empty">No branch found.</div>
                      ) : (
                        filteredBranches.map((b) => (
                          <button
                            key={b.id}
                            type="button"
                            className="po-search-item"
                            onClick={() => onSelectPresentBranch(b.id)}
                          >
                            {`${b.code || ""} - ${b.name || ""}`.trim()}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                <div className="po-field">
                  <label>Previous Position</label>
                  <input value={form.old_position} readOnly placeholder="Auto-filled" />
                </div>

                <div className="po-field">
                  <label>New Position</label>
                  <select
                    value={form.new_position}
                    onChange={(e) => onSelectNewPosition(e.target.value)}
                    required
                  >
                    <option value="">
                      {loadingRates ? "Loading positions..." : "Select New Position"}
                    </option>
                    {positionOptions.map((r) => (
                      <option key={r.id || r.position} value={r.position}>
                        {r.position}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="po-field full">
                  <label>Attach Request File</label>
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                    required
                    onChange={(e) => setAttachmentFile(e.target.files?.[0] || null)}
                  />
                </div>

                <div className="po-field full">
                  <label>Remarks</label>
                  <textarea
                    value={form.remarks}
                    onChange={(e) => setForm((p) => ({ ...p, remarks: e.target.value }))}
                    placeholder="Optional notes / reason"
                    rows={3}
                  />
                </div>
              </div>

              <div className="po-modal-actions">
                <button className="po-btn po-btn-ghost" type="button" onClick={closeModal}>
                  Cancel
                </button>

                <button className="po-btn po-btn-primary" type="submit" disabled={saving || !form.employee_id}>
                  {saving ? "Creating..." : "Create Order"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}