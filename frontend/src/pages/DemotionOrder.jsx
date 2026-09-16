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

  admin: "HR Admin Order",
  "hr order": "HR Admin Order",
  "avp signed order": "AVP Staff-Signed Admin Order",
  "hr final": "HR Final Approval",

  approved: "Approved",
  rejected: "Rejected",
  voided: "Voided",
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
    ];
  }

  // Back Office does not use the Operation management chain.
  // It proceeds to the HR workflow according to backend logic.
  if (isBackOfficeDepartment(department)) {
    return [];
  }

  return [];
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
  if (status === "voided") return "voided";

  if (
    status === "wait for hr order" ||
    status === "wait for admin order"
  ) {
    return "hr order";
  }

  if (status === "wait for avp signed order") {
    return "avp signed order";
  }

  if (
    status === "wait for hr final approval" ||
    status === "wait for hr final"
  ) {
    return "hr final";
  }

  const stage = norm(order?.approval_stage);

  if (stage === "admin") {
    return "hr order";
  }

  if (stage) {
    return stage;
  }

  const chain = getApprovalChain(order?.department);

  return chain[0] || "hr order";
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

  const canHrWorkflow =
    isAdmin ||
    isHRDepartment;

  const canVoidOrDelete =
    isAdmin ||
    isHRDepartment ||
    isITDepartment ||
    isAccountingDepartment;
  
  const canBypass =
    isAdmin ||
    isIt ||
    isHr ||
    isAccounting ||
    isSeniorVicePresident ||
    isHRDepartment ||
    isITDepartment ||
    isAccountingDepartment;

  const canOperationDownload =
  isOperationDepartment(department) &&
  (
    isBranchManager ||
    isAreaManager ||
    isRegionalManager ||
    isAssistantVicePresident ||
    isVicePresident
  );

  const canDownloadFile =
    isAdmin ||
    isIt ||
    isHr ||
    isHRDepartment ||
    isAccounting ||
    isAccountingDepartment ||
    canOperationDownload ||
    isSeniorVicePresident ||
    isPresident;

  const canActOnStage = (order) => {
    const status = norm(order?.status);

    if (
      status === "approved" ||
      status === "rejected" ||
      status === "voided"
    ) {
      return false;
    }

    const stage = getCurrentStage(order);

    // HR workflow stages are handled by their own buttons,
    // not the normal management Approve/Reject buttons.
    if (
      stage === "admin" ||
      stage === "hr order" ||
      stage === "avp signed order" ||
      stage === "hr final"
    ) {
      return false;
    }

    if (!isOperationDepartment(order?.department)) {
      return false;
    }

    if (stage === "area manager") {
      return isAreaManager;
    }

    if (stage === "regional manager") {
      return isRegionalManager;
    }

    if (stage === "assistant vice president") {
      return isAssistantVicePresident;
    }

    if (stage === "vice president") {
      return isVicePresident;
    }

    return false;
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

  // HR uploads the prepared Admin Order
  const [hrOrderFiles, setHrOrderFiles] = useState({});

  // AVP uploads the Admin Order signed by the employee
  const [avpSignedFiles, setAvpSignedFiles] = useState({});

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
      new_position: "",
      prev_branch_id: "",

      to_branch_id: "",
      to_division: "",
      to_region: "",
      to_area: "",
      to_department: "",

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

    if (s === "approved") {
      return "po-badge po-approved";
    }

    if (s === "rejected") {
      return "po-badge po-rejected";
    }

    if (s === "voided") {
      return "po-badge po-voided";
    }

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
    if (!form.to_department) { return setErr("Destination department is required.");}
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
    formData.append("to_division", clean(form.to_division));
    formData.append("to_region", clean(form.to_region));
    formData.append("to_area", clean(form.to_area));
    formData.append("to_department", clean(form.to_department));
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

  const bypassOrder = async (order, action) => {
    const id = order?.id;

    if (!id) {
      return alert("Invalid demotion order.");
    }

    if (!canBypass) {
      return alert(
        "You are not allowed to bypass demotion approval."
      );
    }

    const stage = getCurrentStage(order);

    const managementStages = [
      "area manager",
      "regional manager",
      "assistant vice president",
      "vice president",
    ];

    if (!managementStages.includes(stage)) {
      return alert(
        "Bypass is only available during management approval."
      );
    }

    if (action === "approve" && !approvalFiles[id]) {
      return alert(
        "Upload the signed/approved file before bypass approval."
      );
    }

    let reason = "";

    if (action === "reject") {
      reason = window.prompt(
        `Enter rejection reason for ${
          order.order_no || id
        }:`
      );

      if (reason === null) return;

      if (!clean(reason)) {
        return alert("Rejection reason is required.");
      }
    }

    const confirmed = window.confirm(
      action === "approve"
        ? `Bypass the remaining management approvals for ${
            order.order_no || id
          } and send it to HR Admin Order?`
        : `Reject ${
            order.order_no || id
          } through bypass?`
    );

    if (!confirmed) return;

    try {
      setProcessingId(`${id}-bypass-${action}`);

      const formData = new FormData();

      formData.append("action", action);

      if (action === "approve") {
        formData.append(
          "attachment",
          approvalFiles[id]
        );
      }

      if (action === "reject") {
        formData.append(
          "reason",
          clean(reason)
        );
      }

      await api.put(
        `/demotion-orders/${id}/bypass`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      setApprovalFiles((previous) => {
        const copy = { ...previous };
        delete copy[id];
        return copy;
      });

      await loadData();

      alert(
        action === "approve"
          ? "Management approval bypassed. Waiting for HR Admin Order."
          : "Demotion rejected through bypass."
      );
    } catch (e) {
      setErr(
        e?.response?.data?.message ||
          "Failed to bypass demotion approval."
      );
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

  const uploadHrOrder = async (order) => {
    const id = order?.id;
    const file = hrOrderFiles[id];

    if (!id) return alert("Invalid demotion order.");

    if (!canHrWorkflow) {
      return alert("Only HR or Admin can upload the Admin Order.");
    }

    if (!file) {
      return alert("Please select the Admin Order file.");
    }

    const confirmed = window.confirm(
      `Upload Admin Order for ${order.order_no || id}?`
    );

    if (!confirmed) return;

    try {
      setProcessingId(`${id}-hr-order`);

      const formData = new FormData();
      formData.append("attachment", file);

      await api.post(
        `/demotion-orders/${id}/hr-order`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      setHrOrderFiles((previous) => {
        const copy = { ...previous };
        delete copy[id];
        return copy;
      });

      await loadData();

      alert(
        "Admin Order uploaded successfully. Waiting for AVP to upload the staff-signed Admin Order."
      );
    } catch (e) {
      setErr(
        e?.response?.data?.message ||
          "Failed to upload Admin Order."
      );
    } finally {
      setProcessingId("");
    }
  };


  const uploadAvpSignedOrder = async (order) => {
    const id = order?.id;
    const file = avpSignedFiles[id];

    if (!id) return alert("Invalid demotion order.");

    if (!isAssistantVicePresident) {
      return alert(
        "Only the responsible Assistant Vice President can upload the staff-signed Admin Order."
      );
    }

    if (!file) {
      return alert(
        "Please select the staff-signed Admin Order."
      );
    }

    const confirmed = window.confirm(
      `Upload staff-signed Admin Order for ${
        order.order_no || id
      }?`
    );

    if (!confirmed) return;

    try {
      setProcessingId(`${id}-avp-signed`);

      const formData = new FormData();
      formData.append("attachment", file);

      await api.post(
        `/demotion-orders/${id}/avp-signed-order`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      setAvpSignedFiles((previous) => {
        const copy = { ...previous };
        delete copy[id];
        return copy;
      });

      await loadData();

      alert(
        "Staff-signed Admin Order uploaded successfully. Waiting for HR Final Approval."
      );
    } catch (e) {
      setErr(
        e?.response?.data?.message ||
          "Failed to upload staff-signed Admin Order."
      );
    } finally {
      setProcessingId("");
    }
  };


  const hrFinalApprove = async (order) => {
    const id = order?.id;

    if (!id) return alert("Invalid demotion order.");

    if (!canHrWorkflow) {
      return alert(
        "Only HR or Admin can perform HR Final Approval."
      );
    }

    const confirmed = window.confirm(
      `Final approve demotion order ${
        order.order_no || id
      }?\n\nThis will apply the employee's new position and assignment.`
    );

    if (!confirmed) return;

    try {
      setProcessingId(`${id}-hr-final`);

      await api.post(
        `/demotion-orders/${id}/hr-final`
      );

      await loadData();

      alert(
        "Demotion approved successfully. Employee information has been updated."
      );
    } catch (e) {
      setErr(
        e?.response?.data?.message ||
          "Failed to complete HR Final Approval."
      );
    } finally {
      setProcessingId("");
    }
  };

  const voidOrder = async (order) => {
    const id = order?.id;

    if (!id) {
      return alert("Invalid demotion order.");
    }

    if (!canVoidOrDelete) {
      return alert(
        "Only Admin, HR, IT, and Accounting can void demotion orders."
      );
    }

    const reason = window.prompt(
      `Enter the reason for voiding ${
        order.order_no || id
      }:`
    );

    if (reason === null) return;

    if (!clean(reason)) {
      return alert("Void reason is required.");
    }

    const confirmed = window.confirm(
      "Void this approved demotion? The employee's previous position and branch will be restored."
    );

    if (!confirmed) return;

    try {
      setProcessingId(`${id}-void`);

      await api.put(`/demotion-orders/${id}/void`, {
        reason: clean(reason),
      });

      await loadData();

      alert("Demotion order voided successfully.");
    } catch (e) {
      setErr(
        e?.response?.data?.message ||
          "Failed to void demotion order."
      );
    } finally {
      setProcessingId("");
    }
  };

  const deleteOrder = async (order) => {
    const id = order?.id;

    if (!id) {
      return alert("Invalid demotion order.");
    }

    if (!canVoidOrDelete) {
      return alert(
        "Only Admin, HR, IT, and Accounting can delete demotion orders."
      );
    }

    const confirmed = window.confirm(
      `Permanently delete demotion order ${
        order.order_no || id
      }? This cannot be undone.`
    );

    if (!confirmed) return;

    try {
      setProcessingId(`${id}-delete`);

      await api.delete(`/demotion-orders/${id}`);

      await loadData();

      alert("Demotion order deleted successfully.");
    } catch (e) {
      setErr(
        e?.response?.data?.message ||
          "Failed to delete demotion order."
      );
    } finally {
      setProcessingId("");
    }
  };

  const downloadFile = async (order, type = "latest") => {
    try {
      if (!order?.id) {
        return alert("Invalid demotion order.");
      }

      const res = await api.get(
        `/demotion-orders/${order.id}/download/${type}`,
        {
          responseType: "blob",
        }
      );

      const blob = new Blob([res.data]);
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;

      a.download =
        type === "approved"
          ? order.approved_attachment_name ||
            order.attachment_name ||
            `demotion-${order.id}`
          : order.attachment_name ||
            order.approved_attachment_name ||
            `demotion-${order.id}`;

      document.body.appendChild(a);
      a.click();
      a.remove();

      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Demotion download error:", e);

      let message = "Failed to download file.";

      const data = e?.response?.data;

      if (data instanceof Blob) {
        try {
          const text = await data.text();
          const parsed = JSON.parse(text);

          if (parsed?.message) {
            message = parsed.message;
          }
        } catch {
          // keep default message
        }
      } else if (data?.message) {
        message = data.message;
      }

      alert(message);
    }
  };

  const branchLabel = (id) => {
    const b = branchMap.get(String(id));
    if (!b) return id ? String(id) : "-";
    return `${b.code} - ${b.name}`;
  };

  const isWaitingHrOrder = (order) => {
    const status = norm(order?.status);
    const stage = norm(order?.approval_stage);

    return (
      status === "wait for hr order" ||
      status === "wait for admin order" ||
      stage === "admin" ||
      stage === "hr order"
    );
  };

  const isWaitingAvpSignedOrder = (order) => {
    const status = norm(order?.status);
    const stage = norm(order?.approval_stage);

    return (
      status === "wait for avp signed order" ||
      stage === "avp signed order"
    );
  };

  const isWaitingHrFinal = (order) => {
    const status = norm(order?.status);
    const stage = norm(order?.approval_stage);

    return (
      status === "wait for hr final approval" ||
      status === "wait for hr final" ||
      stage === "hr final"
    );
  };

  const totalDemotions = filteredOrders.length;
  const pendingDemotions = filteredOrders.filter((order) => {
    const status = norm(order?.status);
    return !["approved", "rejected", "voided"].includes(status);
  }).length;
  const approvedDemotions = filteredOrders.filter(
    (order) => norm(order?.status) === "approved"
  ).length;
  const closedDemotions = filteredOrders.filter((order) =>
    ["rejected", "voided"].includes(norm(order?.status))
  ).length;

  const getPageNumbers = () => {
    const pages = [];
    const maxButtons = 5;

    let first = Math.max(1, page - 2);
    let last = Math.min(totalPages, first + maxButtons - 1);

    if (last - first < maxButtons - 1) {
      first = Math.max(1, last - maxButtons + 1);
    }

    for (let number = first; number <= last; number += 1) {
      pages.push(number);
    }

    return pages;
  };

  return (
    <div className="demotion-page">
      <section className="demotion-hero">
        <div className="demotion-hero-main">
          <div className="demotion-hero-copy">
            <span className="demotion-hero-eyebrow">HRIS TRANSACTIONS</span>

            <h1 className="demotion-hero-title">Demotion Orders</h1>

            <p className="demotion-hero-subtitle">
              Create, review, approve, and manage employee demotion orders
              through the required approval process.
            </p>

            <div className="demotion-flow">
              <span>APPROVAL FLOW</span>
              <b>
                Operation: AM → RM → AVP → VP → HR Admin Order → AVP Staff-Signed Order → HR Final
                <br />
                Back Office: HR Admin Order → HR Final
              </b>
            </div>
          </div>

          <div className="demotion-hero-actions">
            <button
              className="demotion-btn demotion-btn-secondary"
              type="button"
              onClick={() => navigate(-1)}
            >
              ← Back
            </button>

            <button
              className="demotion-btn demotion-btn-secondary"
              type="button"
              onClick={loadData}
              disabled={loading}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>

            {canCreate && (
              <button
                className="demotion-btn demotion-btn-primary"
                type="button"
                onClick={openCreate}
              >
                + Create Demotion
              </button>
            )}
          </div>
        </div>
      </section>

      {err && <div className="demotion-error">{err}</div>}

      <section className="demotion-summary-grid" aria-label="Demotion summary">
        <article className="demotion-summary-card demotion-summary-total">
          <div className="demotion-summary-icon">ALL</div>
          <div>
            <span>Total Orders</span>
            <strong>{totalDemotions}</strong>
            <small>All demotion records</small>
          </div>
        </article>

        <article className="demotion-summary-card demotion-summary-pending">
          <div className="demotion-summary-icon">P</div>
          <div>
            <span>Pending</span>
            <strong>{pendingDemotions}</strong>
            <small>Awaiting action or upload</small>
          </div>
        </article>

        <article className="demotion-summary-card demotion-summary-approved">
          <div className="demotion-summary-icon">A</div>
          <div>
            <span>Approved</span>
            <strong>{approvedDemotions}</strong>
            <small>Completed demotions</small>
          </div>
        </article>

        <article className="demotion-summary-card demotion-summary-closed">
          <div className="demotion-summary-icon">R</div>
          <div>
            <span>Rejected / Voided</span>
            <strong>{closedDemotions}</strong>
            <small>Closed without effect</small>
          </div>
        </article>
      </section>

      <section className="demotion-list-card">
        <div className="demotion-search-panel">
          <div className="demotion-search-controls">
            <input
              className="demotion-search-input"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search order no, employee, department, branch, status, or stage..."
            />

            {search && (
              <button
                className="demotion-btn demotion-btn-secondary"
                type="button"
                onClick={() => setSearch("")}
              >
                Clear
              </button>
            )}
          </div>

          <span className="demotion-result-count">
            {filteredOrders.length}{" "}
            {filteredOrders.length === 1 ? "result" : "results"}
          </span>
        </div>

        <div className="demotion-table-wrap">
          <table className="demotion-table">
            <thead>
              <tr>
                <th>Order No</th>
                <th>Employee</th>
                <th>Department</th>
                <th>Position Change</th>
                <th>Destination</th>
                <th>Effective Date</th>
                <th>Status</th>
                <th>Current Stage</th>
                <th>File</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="demotion-empty">
                    Loading demotion orders...
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={10} className="demotion-empty">
                    No demotion orders found.
                  </td>
                </tr>
              ) : (
                pagedOrders.map((order) => {
                  const orderStatus = norm(order.status || "Pending");
                  const approved = orderStatus === "approved";
                  const rejected = orderStatus === "rejected";
                  const voided = orderStatus === "voided";
                  const currentStage = getCurrentStage(order);
                  const canAct = canActOnStage(order);
                  const waitingHrOrder =
                    isWaitingHrOrder(order) &&
                    !approved &&
                    !rejected &&
                    !voided;

                  const waitingAvpSigned =
                    isWaitingAvpSignedOrder(order) &&
                    !approved &&
                    !rejected &&
                    !voided;

                  const waitingHrFinal =
                    isWaitingHrFinal(order) &&
                    !approved &&
                    !rejected &&
                    !voided;

                  const waitingWorkflow =
                    waitingHrOrder ||
                    waitingAvpSigned ||
                    waitingHrFinal;

                  return (
                    <tr key={order.id}>
                      <td>
                        <strong className="demotion-order-no">
                          {order.order_no || "-"}
                        </strong>
                      </td>

                      <td>
                        <div className="demotion-employee-name">
                          {order.employee_name || "-"}
                        </div>
                        <small>Employee ID: {order.employee_id || "-"}</small>
                      </td>

                      <td>{order.department || "-"}</td>

                      <td>
                        <div className="demotion-position-change">
                          <span>{order.old_position || "-"}</span>
                          <b>→</b>
                          <span>{order.new_position || "-"}</span>
                        </div>
                      </td>

                      <td>
                        {order.to_branch_id
                          ? branchLabel(order.to_branch_id)
                          : "-"}
                      </td>

                      <td>{toDate10(order.effective_date) || "-"}</td>

                      <td>
                        <span className={badgeClass(order.status)}>
                          {order.status || "Pending"}
                        </span>
                      </td>

                      <td>
                        {approved
                          ? "Approved"
                          : rejected
                          ? "Rejected"
                          : voided
                          ? "Voided"
                          : STAGE_LABELS[currentStage] ||
                            currentStage ||
                            "-"}
                      </td>

                      <td>
                        {canDownloadFile &&
                          (order.attachment_path || order.approved_attachment_path) ? (
                            <button
                              className="demotion-mini-btn"
                              type="button"
                              onClick={() => downloadFile(order, "latest")}
                            >
                              Download
                            </button>
                          ) : (
                            <span className="demotion-muted">No file</span>
                          )}
                      </td>

                      <td>
                        <div className="demotion-row-actions">
                          <button
                            className="demotion-mini-btn"
                            type="button"
                            onClick={() => setViewOrder(order)}
                          >
                            View
                          </button>

                          {canAct &&
                            !waitingWorkflow &&
                            !approved &&
                            !rejected &&
                            !voided && (
                              <>
                                <label className="demotion-mini-btn demotion-file-btn">
                                  {approvalFiles[order.id]?.name
                                    ? "Change File"
                                    : "Upload File"}
                                  <input
                                    type="file"
                                    onChange={(event) =>
                                      setApprovalFiles((previous) => ({
                                        ...previous,
                                        [order.id]:
                                          event.target.files?.[0] || null,
                                      }))
                                    }
                                  />
                                </label>

                                <button
                                  className="demotion-mini-btn demotion-approve"
                                  type="button"
                                  disabled={
                                    processingId === `${order.id}-approve`
                                  }
                                  onClick={() =>
                                    updateOrder(order, "approve")
                                  }
                                >
                                  {processingId === `${order.id}-approve`
                                    ? "Approving..."
                                    : "Approve"}
                                </button>

                                <button
                                  className="demotion-mini-btn demotion-danger"
                                  type="button"
                                  disabled={
                                    processingId === `${order.id}-reject`
                                  }
                                  onClick={() => openReject(order)}
                                >
                                  Reject
                                </button>
                              </>
                            )}

                          {canBypass &&
                            !canAct &&
                            !waitingWorkflow &&
                            !approved &&
                            !rejected &&
                            !voided &&
                            [
                              "area manager",
                              "regional manager",
                              "assistant vice president",
                              "vice president",
                            ].includes(currentStage) && (
                              <>
                                <label className="demotion-mini-btn demotion-file-btn">
                                  {approvalFiles[order.id]?.name
                                    ? "Change File"
                                    : "Upload File"}

                                  <input
                                    type="file"
                                    onChange={(event) =>
                                      setApprovalFiles((previous) => ({
                                        ...previous,
                                        [order.id]:
                                          event.target.files?.[0] || null,
                                      }))
                                    }
                                  />
                                </label>

                                <button
                                  className="demotion-mini-btn demotion-approve"
                                  type="button"
                                  disabled={
                                    processingId ===
                                    `${order.id}-bypass-approve`
                                  }
                                  onClick={() =>
                                    bypassOrder(order, "approve")
                                  }
                                >
                                  {processingId ===
                                  `${order.id}-bypass-approve`
                                    ? "Bypassing..."
                                    : "Bypass Approve"}
                                </button>

                                <button
                                  className="demotion-mini-btn demotion-danger"
                                  type="button"
                                  disabled={
                                    processingId ===
                                    `${order.id}-bypass-reject`
                                  }
                                  onClick={() =>
                                    bypassOrder(order, "reject")
                                  }
                                >
                                  Bypass Reject
                                </button>
                              </>
                            )}

                          {/* HR PREPARES / UPLOADS ADMIN ORDER */}
                            {waitingHrOrder && canHrWorkflow && (
                              <>
                                <label className="demotion-mini-btn demotion-file-btn">
                                  {hrOrderFiles[order.id]?.name
                                    ? "Change Admin Order"
                                    : "Admin Order"}

                                  <input
                                    type="file"
                                    onChange={(event) =>
                                      setHrOrderFiles((previous) => ({
                                        ...previous,
                                        [order.id]:
                                          event.target.files?.[0] || null,
                                      }))
                                    }
                                  />
                                </label>

                                <button
                                  className="demotion-mini-btn demotion-approve"
                                  type="button"
                                  disabled={
                                    processingId === `${order.id}-hr-order`
                                  }
                                  onClick={() => uploadHrOrder(order)}
                                >
                                  {processingId === `${order.id}-hr-order`
                                    ? "Uploading..."
                                    : "Submit Admin Order"}
                                </button>
                              </>
                            )}


                            {/* AVP RETURNS EMPLOYEE-SIGNED ADMIN ORDER */}
                            {waitingAvpSigned &&
                              isAssistantVicePresident && (
                                <>
                                  <label className="demotion-mini-btn demotion-file-btn">
                                    {avpSignedFiles[order.id]?.name
                                      ? "Change Signed Order"
                                      : "Staff-Signed Order"}

                                    <input
                                      type="file"
                                      onChange={(event) =>
                                        setAvpSignedFiles((previous) => ({
                                          ...previous,
                                          [order.id]:
                                            event.target.files?.[0] || null,
                                        }))
                                      }
                                    />
                                  </label>

                                  <button
                                    className="demotion-mini-btn demotion-approve"
                                    type="button"
                                    disabled={
                                      processingId === `${order.id}-avp-signed`
                                    }
                                    onClick={() =>
                                      uploadAvpSignedOrder(order)
                                    }
                                  >
                                    {processingId === `${order.id}-avp-signed`
                                      ? "Uploading..."
                                      : "Submit Signed Order"}
                                  </button>
                                </>
                              )}


                            {/* HR FINAL VERIFICATION / APPROVAL */}
                            {waitingHrFinal && canHrWorkflow && (
                              <button
                                className="demotion-mini-btn demotion-approve"
                                type="button"
                                disabled={
                                  processingId === `${order.id}-hr-final`
                                }
                                onClick={() => hrFinalApprove(order)}
                              >
                                {processingId === `${order.id}-hr-final`
                                  ? "Approving..."
                                  : "HR Final Approve"}
                              </button>
                            )}

                          {!canAct &&
                            !(
                              canBypass &&
                              !waitingWorkflow &&
                              [
                                "area manager",
                                "regional manager",
                                "assistant vice president",
                                "vice president",
                              ].includes(currentStage)
                            ) &&
                            !approved &&
                            !rejected &&
                            !voided &&
                            !(
                              waitingHrOrder && canHrWorkflow
                            ) &&
                            !(
                              waitingAvpSigned &&
                              isAssistantVicePresident
                            ) &&
                            !(
                              waitingHrFinal && canHrWorkflow
                            ) && (
                              <span className="demotion-muted">
                                Waiting
                              </span>
                          )}

                          {approved && canVoidOrDelete && (
                            <button
                              className="demotion-mini-btn demotion-warning"
                              type="button"
                              disabled={processingId === `${order.id}-void`}
                              onClick={() => voidOrder(order)}
                            >
                              {processingId === `${order.id}-void`
                                ? "Voiding..."
                                : "Void"}
                            </button>
                          )}

                          {(rejected || voided) && canVoidOrDelete && (
                            <button
                              className="demotion-mini-btn demotion-danger"
                              type="button"
                              disabled={
                                processingId === `${order.id}-delete`
                              }
                              onClick={() => deleteOrder(order)}
                            >
                              {processingId === `${order.id}-delete`
                                ? "Deleting..."
                                : "Delete"}
                            </button>
                          )}
                        </div>

                        {approvalFiles[order.id]?.name && (
                          <small className="demotion-selected-file">
                            {approvalFiles[order.id].name}
                          </small>
                        )}

                        {hrOrderFiles[order.id]?.name && (
                          <small className="demotion-selected-file">
                            Admin Order: {hrOrderFiles[order.id].name}
                          </small>
                        )}

                        {avpSignedFiles[order.id]?.name && (
                          <small className="demotion-selected-file">
                            Staff-Signed Order:{" "}
                            {avpSignedFiles[order.id].name}
                          </small>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="demotion-pager">
          <div className="demotion-pager-left">
            <span>Rows per page</span>

            <select
              value={pageSize}
              onChange={(event) =>
                setPageSize(Number(event.target.value))
              }
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={75}>75</option>
              <option value={100}>100</option>
            </select>
          </div>

          <div className="demotion-pager-right">
            <button
              className="demotion-page-btn"
              type="button"
              disabled={page <= 1}
              onClick={() =>
                setPage((current) => Math.max(1, current - 1))
              }
            >
              ‹
            </button>

            {getPageNumbers().map((pageNumber) => (
              <button
                key={pageNumber}
                className={`demotion-page-number ${
                  page === pageNumber ? "active" : ""
                }`}
                type="button"
                onClick={() => setPage(pageNumber)}
              >
                {pageNumber}
              </button>
            ))}

            <button
              className="demotion-page-btn"
              type="button"
              disabled={page >= totalPages}
              onClick={() =>
                setPage((current) =>
                  Math.min(totalPages, current + 1)
                )
              }
            >
              ›
            </button>

            <span className="demotion-page-summary">
              Page {page} of {totalPages}
            </span>
          </div>
        </div>
      </section>

      {showModal && (
        <div
          className="demotion-modal-overlay"
          onMouseDown={(event) =>
            event.target.classList.contains("demotion-modal-overlay") &&
            closeModal()
          }
        >
          <div
            className="demotion-modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="demotion-modal-head">
              <div>
                <span className="demotion-modal-eyebrow">
                  NEW TRANSACTION
                </span>
                <h3>Create Demotion Order</h3>
                <p>
                  Select an employee, define the new position and branch,
                  then upload the supporting demotion file.
                </p>
              </div>

              <button
                className="demotion-modal-close"
                type="button"
                onClick={closeModal}
              >
                ✕
              </button>
            </div>

            <form className="demotion-form" onSubmit={submitCreate}>
              <div className="demotion-form-grid">
                <div
                  className="demotion-field demotion-field-full demotion-picker"
                  ref={employeeBoxRef}
                >
                  <label>Employee</label>

                  <input
                    type="text"
                    placeholder="Search employee ID, name, or employee number..."
                    value={employeeSearch}
                    onChange={(event) => {
                      setEmployeeSearch(event.target.value);
                      setShowEmployeeDropdown(true);
                      setForm((previous) => ({
                        ...previous,
                        employee_id: "",
                        first_name: "",
                        last_name: "",
                        middle_name: "",
                        prev_position: "",
                        new_position: "",
                        prev_branch_id: "",

                        to_branch_id: "",
                        to_division: "",
                        to_region: "",
                        to_area: "",
                        to_department: "",
                      }));
                    }}
                    onFocus={() => setShowEmployeeDropdown(true)}
                  />

                  {showEmployeeDropdown && (
                    <div className="demotion-search-dropdown">
                      {filteredStaff.length === 0 ? (
                        <div className="demotion-search-empty">
                          No employee found.
                        </div>
                      ) : (
                        filteredStaff.slice(0, 30).map((employee) => (
                          <button
                            key={employee.id}
                            type="button"
                            className="demotion-search-item"
                            onClick={() => onSelectEmployee(employee.id)}
                          >
                            <strong>{displayNameParts(employee)}</strong>
                            <small>
                              {employee.employee_no || employee.id} •{" "}
                              {employee.position || "No position"}
                            </small>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                <div className="demotion-field">
                  <label>Employee ID</label>
                  <input value={form.employee_id} readOnly />
                </div>

                <div className="demotion-field">
                  <label>Employee Name</label>
                  <input
                    value={displayNameParts({
                      last_name: form.last_name,
                      first_name: form.first_name,
                      middle_name: form.middle_name,
                    })}
                    readOnly
                  />
                </div>

                <div className="demotion-field">
                  <label>Previous Position</label>
                  <input value={form.prev_position} readOnly />
                </div>

                <div className="demotion-field">
                  <label>New Position</label>
                  <input
                    value={form.new_position}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        new_position: event.target.value,
                      }))
                    }
                    placeholder="Enter new position"
                    required
                  />
                </div>

                <div className="demotion-field">
                  <label>Previous Branch</label>
                  <input
                    value={
                      form.prev_branch_id
                        ? branchLabel(form.prev_branch_id)
                        : "-"
                    }
                    readOnly
                  />
                </div>

                <div className="demotion-field">
                  <label>Destination Branch</label>
                  <select
                    value={form.to_branch_id}
                    onChange={(event) => {
                      const branchId = event.target.value;

                      const selectedBranch = branches.find(
                        (branch) =>
                          String(branch.id) === String(branchId)
                      );

                      setForm((previous) => ({
                        ...previous,

                        to_branch_id: branchId,

                        to_division: clean(
                          selectedBranch?.division
                        ),

                        to_region: clean(
                          selectedBranch?.region
                        ),

                        to_area: clean(
                          selectedBranch?.area
                        ),
                      }));
                    }}
                    required
                  >
                    <option value="">Select branch</option>

                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.code} - {branch.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="demotion-field">
                  <label>Destination Division</label>
                  <input
                    value={form.to_division}
                    readOnly
                    placeholder="Auto-filled from branch"
                  />
                </div>

                <div className="demotion-field">
                  <label>Destination Region</label>
                  <input
                    value={form.to_region}
                    readOnly
                    placeholder="Auto-filled from branch"
                  />
                </div>

                <div className="demotion-field">
                  <label>Destination Area</label>
                  <input
                    value={form.to_area}
                    readOnly
                    placeholder="Auto-filled from branch"
                  />
                </div>

                <div className="demotion-field">
                  <label>Destination Department</label>

                  <select
                    value={form.to_department}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        to_department: event.target.value,
                      }))
                    }
                    required
                  >
                    <option value="">
                      Select destination department
                    </option>

                    <option value="OPERATION DEPARTMENT">
                      OPERATION DEPARTMENT
                    </option>

                    <option value="IT DEPARTMENT">
                      IT DEPARTMENT
                    </option>

                    <option value="HR DEPARTMENT">
                      HR DEPARTMENT
                    </option>

                    <option value="ACCOUNTING DEPARTMENT">
                      ACCOUNTING DEPARTMENT
                    </option>

                    <option value="AUDIT DEPARTMENT">
                      AUDIT DEPARTMENT
                    </option>

                    <option value="TREAD DEPARTMENT">
                      TREAD DEPARTMENT
                    </option>

                    <option value="PRODUCTION & LOGISTIC DEPARTMENT">
                      PRODUCTION & LOGISTIC DEPARTMENT
                    </option>

                    <option value="OFFICE OF THE PRESIDENT">
                      OFFICE OF THE PRESIDENT
                    </option>
                  </select>
                </div>

                <div className="demotion-field">
                  <label>Effective Date</label>
                  <input
                    type="date"
                    value={form.effective_date}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        effective_date: event.target.value,
                      }))
                    }
                    required
                  />
                </div>

                <div className="demotion-field">
                  <label>Demotion File</label>
                  <input
                    type="file"
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        attachment:
                          event.target.files?.[0] || null,
                      }))
                    }
                    required
                  />
                </div>

                <div className="demotion-field demotion-field-full">
                  <label>Details / Remarks</label>
                  <textarea
                    value={form.details}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        details: event.target.value,
                      }))
                    }
                    placeholder="Enter demotion details or remarks..."
                    rows={4}
                  />
                </div>
              </div>

              {err && <div className="demotion-form-error">{err}</div>}

              <div className="demotion-modal-actions">
                <button
                  className="demotion-btn demotion-btn-secondary"
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  className="demotion-btn demotion-btn-primary"
                  type="submit"
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Create Demotion"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewOrder && (
        <div
          className="demotion-modal-overlay"
          onMouseDown={(event) =>
            event.target.classList.contains("demotion-modal-overlay") &&
            setViewOrder(null)
          }
        >
          <div
            className="demotion-modal demotion-view-modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="demotion-modal-head">
              <div>
                <span className="demotion-modal-eyebrow">ORDER DETAILS</span>
                <h3>Demotion Details</h3>
                <p>
                  {viewOrder.order_no || viewOrder.id} —{" "}
                  {viewOrder.employee_name}
                </p>
              </div>

              <button
                className="demotion-modal-close"
                type="button"
                onClick={() => setViewOrder(null)}
              >
                ✕
              </button>
            </div>

            <div className="demotion-form">
              <div className="demotion-detail-banner">
                <span className={badgeClass(viewOrder.status)}>
                  {viewOrder.status || "Pending"}
                </span>

                <strong>
                  Current Stage:{" "}
                  {norm(viewOrder.status) === "approved"
                    ? "Approved"
                    : norm(viewOrder.status) === "rejected"
                    ? "Rejected"
                    : norm(viewOrder.status) === "voided"
                    ? "Voided"
                    : STAGE_LABELS[getCurrentStage(viewOrder)] ||
                      getCurrentStage(viewOrder)}
                </strong>
              </div>

              <div className="demotion-form-grid">
                <div className="demotion-field">
                  <label>Employee</label>
                  <input value={viewOrder.employee_name || "-"} readOnly />
                </div>

                <div className="demotion-field">
                  <label>Department</label>
                  <input value={viewOrder.department || "-"} readOnly />
                </div>

                <div className="demotion-field">
                  <label>Previous Position</label>
                  <input value={viewOrder.old_position || "-"} readOnly />
                </div>

                <div className="demotion-field">
                  <label>New Position</label>
                  <input value={viewOrder.new_position || "-"} readOnly />
                </div>

                <div className="demotion-field">
                  <label>Destination Branch</label>
                  <input
                    value={
                      viewOrder.to_branch_id
                        ? branchLabel(viewOrder.to_branch_id)
                        : "-"
                    }
                    readOnly
                  />
                </div>

                <div className="demotion-field">
                  <label>Destination Division</label>
                  <input
                    value={viewOrder.to_division || "-"}
                    readOnly
                  />
                </div>

                <div className="demotion-field">
                  <label>Destination Region</label>
                  <input
                    value={viewOrder.to_region || "-"}
                    readOnly
                  />
                </div>

                <div className="demotion-field">
                  <label>Destination Area</label>
                  <input
                    value={viewOrder.to_area || "-"}
                    readOnly
                  />
                </div>

                <div className="demotion-field">
                  <label>Destination Department</label>
                  <input
                    value={viewOrder.to_department || "-"}
                    readOnly
                  />
                </div>

                <div className="demotion-field">
                  <label>Effective Date</label>
                  <input
                    value={toDate10(viewOrder.effective_date) || "-"}
                    readOnly
                  />
                </div>

                <div className="demotion-field demotion-field-full">
                  <label>Approval Chain</label>
                  <textarea
                    value={renderChainSummary(viewOrder)}
                    readOnly
                    rows={3}
                  />
                </div>

                <div className="demotion-field demotion-field-full">
                  <label>Details / Remarks</label>
                  <textarea
                    value={viewOrder.details || "-"}
                    readOnly
                    rows={4}
                  />
                </div>

                {viewOrder.rejection_reason && (
                  <div className="demotion-field demotion-field-full">
                    <label>Rejection Reason</label>
                    <textarea
                      value={viewOrder.rejection_reason}
                      readOnly
                      rows={3}
                    />
                  </div>
                )}
              </div>

              <div className="demotion-modal-actions">
                <button
                  className="demotion-btn demotion-btn-secondary"
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
          className="demotion-modal-overlay"
          onMouseDown={(event) =>
            event.target.classList.contains("demotion-modal-overlay") &&
            closeReject()
          }
        >
          <div
            className="demotion-modal demotion-reject-modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="demotion-modal-head">
              <div>
                <span className="demotion-modal-eyebrow">REJECTION</span>
                <h3>Reject Demotion</h3>
                <p>
                  {rejecting.order_no || rejecting.id} —{" "}
                  {rejecting.employee_name}
                </p>
              </div>

              <button
                className="demotion-modal-close"
                type="button"
                onClick={closeReject}
              >
                ✕
              </button>
            </div>

            <form className="demotion-form" onSubmit={submitReject}>
              <div className="demotion-field">
                <label>Rejection Reason</label>
                <textarea
                  value={rejectReason}
                  onChange={(event) =>
                    setRejectReason(event.target.value)
                  }
                  placeholder="Explain why this demotion order is being rejected..."
                  rows={5}
                  required
                />
              </div>

              <div className="demotion-modal-actions">
                <button
                  className="demotion-btn demotion-btn-secondary"
                  type="button"
                  onClick={closeReject}
                  disabled={rejectSaving}
                >
                  Cancel
                </button>

                <button
                  className="demotion-btn demotion-btn-danger"
                  type="submit"
                  disabled={rejectSaving}
                >
                  {rejectSaving ? "Rejecting..." : "Reject Demotion"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}