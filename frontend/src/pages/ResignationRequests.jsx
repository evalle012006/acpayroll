import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axiosClient";
import "../styles/ResignationRequests.css";

const toStr = (v) => String(v ?? "").trim();
const norm = (v) => toStr(v).toLowerCase();
const toDate10 = (v) => (v ? String(v).slice(0, 10) : "");
const fmtDate = (v) => (v ? String(v).slice(0, 10) : "-");

const fmtDateTime = (v) => {
  if (!v) return "-";

  try {
    return new Intl.DateTimeFormat("en-PH", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(v));
  } catch {
    return "-";
  }
};

const readUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
};

const getBaseUrl = () => {
  const base = api.defaults.baseURL || "";
  return base.endsWith("/api") ? base.slice(0, -4) : base;
};

const STATUS_BRANCH = "Pending Branch Manager";
const STATUS_AREA = "Pending Area Manager";
const STATUS_RM = "Pending Regional Manager";
const STATUS_AVP = "Pending Assistant Vice President";
const STATUS_VP = "Pending Vice President";
const STATUS_SVP = "Pending Senior Vice President";

const STATUS_HR = "Pending HR Department";
const STATUS_AVP_SIGNATURE = "Pending AVP Signature";
const STATUS_HR_FINAL = "Pending HR Final Approval";

const STATUS_APPROVED = "Approved";
const STATUS_REJECTED = "Rejected";
const STATUS_REVOKED = "Revoked";

export default function ResignationRequests() {
  const navigate = useNavigate();
  const baseUrl = useMemo(() => getBaseUrl(), []);

  const user = useMemo(() => readUser(), []);
  const role = norm(user?.role);
  const dept = norm(
    user?.department ||
    user?.department_name ||
    user?.departmentName ||
    user?.user_department ||
    user?.dept ||
    ""
  );

  const isHRDepartment =
    dept === "hr department";

  const isAccountingDepartment =
    dept === "accounting department";

  const isIT =
    role === "it";

const isHRDeptManager =
  dept.includes("hr") &&
  [
    "branch manager",
    "area manager",
    "regional manager",
    "assistant vice president",
    "vice president",
    "senior vice president",
  ].includes(role);

  const isAdmin = ["admin", "it"].includes(role);
  const isSystemAdmin = role === "admin";

  const isBranchManager = role === "branch manager";
  const isAreaManager = role === "area manager";
  const isRegionalManager = role === "regional manager";
  const isAssistantVicePresident = role === "assistant vice president";
  const isHr = role === "hr";
  const isAccounting = role === "accounting";
  const isTread = role === "tread";
  const isVicePresident = role === "vice president";
  const isSeniorVicePresident = role === "senior vice president";
  const isPresident = role === "president";

  const canCreate =
    isAdmin ||
    isHr ||
    isAccounting ||
    isTread ||
    isBranchManager ||
    isAreaManager ||
    isRegionalManager ||
    isAssistantVicePresident ||
    isVicePresident ||
    isSeniorVicePresident ||
    isPresident;

  const canFinalAction =
    isSystemAdmin ||
    isHRDepartment;

    const canManageResignationReturn =
      isSystemAdmin ||
      isHRDepartment ||
      isAccountingDepartment;

    const canDeleteAction =
      isSystemAdmin ||
      isIT ||
      isHRDepartment ||
      isAccountingDepartment;
  
  const [rows, setRows] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [showCreate, setShowCreate] = useState(false);
  const [viewRow, setViewRow] = useState(null);

  const [employeeSearch, setEmployeeSearch] = useState("");
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
  const employeeBoxRef = useRef(null);

  const [rejectingRow, setRejectingRow] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [processingId, setProcessingId] = useState("");

  const [uploadFiles, setUploadFiles] = useState({});
  const [finalApproveRow, setFinalApproveRow] = useState(null);

  const [finalApproveForm, setFinalApproveForm] = useState({
    effective_date: "",
    attachment: null,
  });

  const [revokeRow, setRevokeRow] = useState(null);
  const [revokeRemarks, setRevokeRemarks] = useState("");

  const [reapplyRow, setReapplyRow] = useState(null);
  const [reapplyForm, setReapplyForm] = useState({
    effective_date: "",
    branch_id: "",
    department: "",
    position: "",
    remarks: "",
    attachment: null,
  });

  const [form, setForm] = useState({
    staff_id: "",
    employee_no: "",
    employee_name: "",
    last_name: "",
    first_name: "",
    middle_name: "",
    branch_id: "",
    branch_code: "",
    branch_name: "",
    resignation_date: toDate10(new Date().toISOString()),
    remarks: "",
    attachment: null,
  });

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [reqRes, staffRes, branchRes] = await Promise.all([
        api.get("/resignation-requests").catch(() => ({ data: [] })),
        api.get("/staff").catch(() => ({ data: [] })),
        api.get("/branches").catch(() => ({ data: [] })),
      ]);

      setRows(Array.isArray(reqRes.data) ? reqRes.data : []);
      setStaffList(Array.isArray(staffRes.data) ? staffRes.data : []);
      setBranches(Array.isArray(branchRes.data) ? branchRes.data : []);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load resignation requests.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    const onMouseDown = (e) => {
      if (employeeBoxRef.current && !employeeBoxRef.current.contains(e.target)) {
        setShowEmployeeDropdown(false);
      }
    };

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        setViewRow(null);
        setRejectingRow(null);
        setShowEmployeeDropdown(false);
      }
    };

    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const buildName = useCallback((s) => {
    const ln = toStr(s?.last_name);
    const fn = toStr(s?.first_name);
    const mn = toStr(s?.middle_name);

    const full = `${ln}${ln && fn ? ", " : ""}${fn}${mn ? ` ${mn}` : ""}`
      .replace(/\s+/g, " ")
      .trim();

    return full || toStr(s?.fullname) || "-";
  }, []);

  const branchMap = useMemo(() => {
    const m = new Map();
    branches.forEach((b) => m.set(String(b.id), b));
    return m;
  }, [branches]);

  const searchableStaff = useMemo(() => {
    let scopedStaff = staffList || [];

    if (isBranchManager && !isHRDeptManager) {
      scopedStaff = scopedStaff.filter(
        (s) => String(s.branch_id) === String(user?.branch_id)
      );
    }

    if (isAreaManager && !isHRDeptManager) {
      scopedStaff = scopedStaff.filter(
        (s) => norm(s.area) === norm(user?.area)
      );
    }

    if (isRegionalManager && !isHRDeptManager) {
      scopedStaff = scopedStaff.filter(
        (s) => norm(s.region) === norm(user?.region)
      );
    }

    if (isAssistantVicePresident && !isHRDeptManager) {
      scopedStaff = scopedStaff.filter(
        (s) => norm(s.division) === norm(user?.division)
      );
    }

    return scopedStaff
      .filter((s) => norm(s.status || "active") === "active")
      .map((s) => {
        const display = buildName(s);
        const searchBlob = [
          s.id,
          s.employee_no,
          s.fullname,
          s.last_name,
          s.first_name,
          s.middle_name,
          s.position,
          s.area,
          s.region,
          s.department,
          display,
        ]
          .map(toStr)
          .join(" ")
          .toLowerCase();

        return { ...s, _display: display, _searchBlob: searchBlob };
      });
    }, [
    staffList,
    buildName,
    user,
    isBranchManager,
    isAreaManager,
    isRegionalManager,
    isAssistantVicePresident,
  ]);

  const filteredEmployees = useMemo(() => {
    const q = norm(employeeSearch);
    if (!q) return searchableStaff.slice(0, 20);
    return searchableStaff.filter((s) => s._searchBlob.includes(q)).slice(0, 20);
  }, [searchableStaff, employeeSearch]);

  const filteredRows = useMemo(() => {
    const q = norm(search);
    if (!q) return rows;

    return rows.filter((r) =>
      [
        r.request_no,
        r.employee_no,
        r.employee_name,
        r.branch_code,
        r.branch_name,
        r.resignation_date,
        r.effective_date,
        r.remarks,
        r.status,
      ]
        .map(toStr)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [rows, search]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));

  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [search, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const getPageNumbers = () => {
    const pages = [];
    const maxButtons = 5;
    let start = Math.max(1, page - 2);
    let end = Math.min(totalPages, start + maxButtons - 1);

    if (end - start < maxButtons - 1) {
      start = Math.max(1, end - maxButtons + 1);
    }

    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  };

  const handleEmployeeSelect = (staffId) => {
    const s = staffList.find((x) => String(x.id) === String(staffId));
    if (!s) return;

    const b = s.branch_id ? branchMap.get(String(s.branch_id)) : null;
    const name = buildName(s);

    setForm((prev) => ({
      ...prev,
      staff_id: String(s.id || ""),
      employee_no: toStr(s.employee_no),
      employee_name: name,
      last_name: toStr(s.last_name),
      first_name: toStr(s.first_name),
      middle_name: toStr(s.middle_name),
      branch_id: String(s.branch_id || ""),
      branch_code: toStr(b?.code),
      branch_name: toStr(b?.name),
    }));

    setEmployeeSearch(`${toStr(s.employee_no)} - ${name}`);
    setShowEmployeeDropdown(false);
  };

  const resetForm = () => {
    setForm({
      staff_id: "",
      employee_no: "",
      employee_name: "",
      last_name: "",
      first_name: "",
      middle_name: "",
      branch_id: "",
      branch_code: "",
      branch_name: "",
      resignation_date: toDate10(new Date().toISOString()),
      remarks: "",
      attachment: null,
    });

    setEmployeeSearch("");
    setShowEmployeeDropdown(false);
  };

  const closeCreate = () => {
    setShowCreate(false);
    resetForm();
  };

  const openCreate = () => {
    resetForm();
    setShowCreate(true);
  };

  const submitCreate = async (e) => {
    e.preventDefault();

    if (!form.staff_id) {
      return alert("Please select employee.");
    }

    if (!form.resignation_date) {
      return alert("Please select resignation date.");
    }

    try {
      setSaving(true);

      const fd = new FormData();

      fd.append("staff_id", form.staff_id);
      fd.append("employee_no", form.employee_no);
      fd.append("employee_name", form.employee_name);
      fd.append("last_name", form.last_name);
      fd.append("first_name", form.first_name);
      fd.append("middle_name", form.middle_name);
      fd.append("branch_id", form.branch_id || "");
      fd.append("branch_code", form.branch_code || "");
      fd.append("branch_name", form.branch_name || "");
      fd.append("resignation_date", form.resignation_date || "");
      fd.append("remarks", form.remarks || "");

      if (form.attachment) {
        fd.append("attachment", form.attachment);
      }

      await api.post("/resignation-requests", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      alert("Resignation request created.");
      closeCreate();
      await fetchAll();
    } catch (err) {
      alert(
        err?.response?.data?.message ||
          "Failed to create resignation request."
      );
    } finally {
      setSaving(false);
    }
  };

  const setRowFile = (rowId, file) => {
    setUploadFiles((prev) => ({
      ...prev,
      [rowId]: file || null,
    }));
  };

  const approveRequest = async (row) => {
    const file = uploadFiles[row.id];

    const status = toStr(row.status);

    const requiresFile =
      isSystemAdmin ||
      status === STATUS_HR ||
      status === STATUS_AVP_SIGNATURE;

    if (requiresFile && !file) {
      return alert(
        status === STATUS_AVP_SIGNATURE
          ? "Please choose the signed file before AVP approval."
          : "Please choose a file before approval."
      );
    }

    if (!window.confirm("Approve this resignation request?")) return;

    try {
      setProcessingId(`approve-${row.id}`);

      // System Admin uses backend bypass for ANY pending stage.
      const shouldBypass =
        isSystemAdmin &&
        ![
          STATUS_APPROVED,
          STATUS_REJECTED,
          STATUS_REVOKED,
        ].includes(toStr(row.status));

      if (file) {
        const fd = new FormData();

        fd.append("attachment", file);

        if (shouldBypass) {
          fd.append("bypass", "true");
        }

        await api.put(
          `/resignation-requests/${row.id}/approve`,
          fd,
          {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          }
        );
      } else {
        await api.put(
          `/resignation-requests/${row.id}/approve`
        );
      }

      setUploadFiles((prev) => {
        const copy = { ...prev };
        delete copy[row.id];
        return copy;
      });

      await fetchAll();
    } catch (err) {
      console.error("Approve resignation error:", err);

      alert(
        err?.response?.data?.message ||
          "Failed to approve request."
      );
    } finally {
      setProcessingId("");
    }
  };

  const isFinalApprovalRow = (row) => {
    if (!row) return false;

    const status = toStr(row.status);

    return (
      status === STATUS_HR_FINAL &&
      (isSystemAdmin || isHRDepartment)
    );
  };

  const closeFinalApproveModal = () => {
    setFinalApproveRow(null);

    setFinalApproveForm({
      effective_date: "",
      attachment: null,
    });
  };

  const submitFinalApproval = async (e) => {
    e.preventDefault();

    if (!finalApproveRow?.id) return;

    if (!finalApproveForm.effective_date) {
      return alert(
        "Effective date is required for final approval."
      );
    }

    // Admin bypass requires a file.
    // Normal HR Final Approval may reuse the AVP signed file.
    if (isSystemAdmin && !finalApproveForm.attachment) {
      return alert(
        "Attachment file is required for Admin final approval."
      );
    }

    if (
      !window.confirm(
        "Final approve this resignation request?"
      )
    ) {
      return;
    }

    try {
      setProcessingId(
        `approve-${finalApproveRow.id}`
      );

      const fd = new FormData();

      fd.append(
        "effective_date",
        finalApproveForm.effective_date
      );

      if (finalApproveForm.attachment) {
        fd.append(
          "attachment",
          finalApproveForm.attachment
        );
      }

      // IMPORTANT:
      // Admin must enter the backend ADMIN BYPASS handler.
      if (isSystemAdmin) {
        fd.append("bypass", "true");
      }

      await api.put(
        `/resignation-requests/${finalApproveRow.id}/approve`,
        fd,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      alert(
        "Resignation approved successfully."
      );

      closeFinalApproveModal();

      await fetchAll();
    } catch (err) {
      console.error(
        "Final approve resignation error:",
        err
      );

      alert(
        err?.response?.data?.message ||
          "Failed to final approve resignation request."
      );
    } finally {
      setProcessingId("");
    }
  };

  const rejectRequest = async () => {
    if (!rejectingRow?.id) return;
    if (!toStr(rejectionReason)) return alert("Rejection reason required.");

    try {
      setProcessingId(`reject-${rejectingRow.id}`);

      await api.put(`/resignation-requests/${rejectingRow.id}/reject`, {
        reason: rejectionReason,
      });

      setRejectingRow(null);
      setRejectionReason("");
      await fetchAll();
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to reject request.");
    } finally {
      setProcessingId("");
    }
  };

  const openRevokeModal = (row) => {
    setRevokeRow(row);
    setRevokeRemarks("");
  };

  const closeRevokeModal = () => {
    setRevokeRow(null);
    setRevokeRemarks("");
  };

  const submitRevokeRequest = async (e) => {
  e.preventDefault();

  if (!revokeRow?.id) return;

  if (!window.confirm("Revoke this resignation before its effective date?")) {
    return;
  }

  try {
    setProcessingId(`revoke-${revokeRow.id}`);

    await api.put(`/resignation-requests/${revokeRow.id}/revoke`, {
      remarks: revokeRemarks || "",
    });

    alert("Resignation revoked successfully.");

    closeRevokeModal();
    await fetchAll();
  } catch (err) {
    alert(
      err?.response?.data?.message ||
        "Failed to revoke resignation request."
    );
  } finally {
    setProcessingId("");
  }
};

const openReapplyModal = (row) => {
  setReapplyRow(row);

  setReapplyForm({
    effective_date: "",
    branch_id: "",
    department: "",
    position: "",
    remarks: "",
    attachment: null,
  });
};

const closeReapplyModal = () => {
  setReapplyRow(null);

  setReapplyForm({
    effective_date: "",
    branch_id: "",
    department: "",
    position: "",
    remarks: "",
    attachment: null,
  });
};

const submitReapplyRequest = async (e) => {
  e.preventDefault();

  if (!reapplyRow?.id) return;

  if (!reapplyForm.effective_date) {
    return alert("Re-Apply effective date is required.");
  }

  if (!reapplyForm.branch_id) {
    return alert("Branch resume is required.");
  }

  if (!reapplyForm.department) {
    return alert("Department is required.");
  }

  if (!reapplyForm.position) {
    return alert("New position is required.");
  }

  if (!reapplyForm.attachment) {
    return alert("Re-Apply file is required.");
  }

  try {
    setProcessingId(`reapply-${reapplyRow.id}`);

    const fd = new FormData();

    fd.append("effective_date", reapplyForm.effective_date);
    fd.append("branch_id", reapplyForm.branch_id);
    fd.append("department", reapplyForm.department);
    fd.append("position", reapplyForm.position);
    fd.append("remarks", reapplyForm.remarks || "");
    fd.append("attachment", reapplyForm.attachment);

    await api.put(
      `/resignation-requests/${reapplyRow.id}/reapply`,
      fd,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );

    alert("Re-Apply request submitted for approval.");

    closeReapplyModal();
    await fetchAll();
  } catch (err) {
    alert(
      err?.response?.data?.message ||
        "Failed to submit Re-Apply request."
    );
  } finally {
    setProcessingId("");
  }
};

  const deleteRequest = async (row) => {
    if (!window.confirm("Delete this resignation request?")) return;

    try {
      setProcessingId(`delete-${row.id}`);
      await api.delete(`/resignation-requests/${row.id}`);
      await fetchAll();
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to delete request.");
    } finally {
      setProcessingId("");
    }
  };

  const canApproveRow = (row) => {
    const status = toStr(row?.status);

    if (
      status === STATUS_APPROVED ||
      status === STATUS_REJECTED ||
      status === STATUS_REVOKED
    ) {
      return false;
    }

    // SYSTEM ADMIN:
    // can bypass approve the CURRENT pending stage.
    if (isSystemAdmin) {
      return true;
    }

    // HR DEPARTMENT:
    // 1st HR approval
    // 2nd/final HR approval
    if (
      isHRDepartment &&
      (
        status === STATUS_HR ||
        status === STATUS_HR_FINAL
      )
    ) {
      return true;
    }

    // Normal management approval stages
    if (isBranchManager && status === STATUS_BRANCH) {
      return true;
    }

    if (isAreaManager && status === STATUS_AREA) {
      return true;
    }

    if (isRegionalManager && status === STATUS_RM) {
      return true;
    }

    // AVP has TWO possible stages:
    // normal AVP approval + signed-file approval
    if (
      isAssistantVicePresident &&
      (
        status === STATUS_AVP ||
        status === STATUS_AVP_SIGNATURE
      )
    ) {
      return true;
    }

    if (isVicePresident && status === STATUS_VP) {
      return true;
    }

    if (isSeniorVicePresident && status === STATUS_SVP) {
      return true;
    }

    return false;
  };

  const canRejectRow = (row) => {
    const status = toStr(row?.status);

    if (
      status === STATUS_APPROVED ||
      status === STATUS_REJECTED ||
      status === STATUS_REVOKED
    ) {
      return false;
    }

    // Admin / IT / HR Department / Accounting Department
    // can reject any pending stage.
    if (
      isSystemAdmin ||
      isIT ||
      isHRDepartment ||
      isAccountingDepartment
    ) {
      return true;
    }

    if (
      isBranchManager &&
      status === STATUS_BRANCH
    ) {
      return true;
    }

    if (
      isAreaManager &&
      status === STATUS_AREA
    ) {
      return true;
    }

    if (
      isRegionalManager &&
      status === STATUS_RM
    ) {
      return true;
    }

    // AVP can reject both:
    // normal AVP approval and AVP signature stage.
    if (
      isAssistantVicePresident &&
      (
        status === STATUS_AVP ||
        status === STATUS_AVP_SIGNATURE
      )
    ) {
      return true;
    }

    if (
      isVicePresident &&
      status === STATUS_VP
    ) {
      return true;
    }

    if (
      isSeniorVicePresident &&
      status === STATUS_SVP
    ) {
      return true;
    }

    return false;
  };

  const canDeleteRow = (row) => {
    const status = norm(row.status);

    return (
      canDeleteAction &&
      status !== norm(STATUS_APPROVED)
    );
  };

  const getToday = () => {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  };

  const canRevokeRow = (row) => {
    const effectiveDate = toDate10(row.effective_date);
    const today = getToday();

    return (
      canManageResignationReturn &&
      norm(row.status) === norm(STATUS_APPROVED) &&
      effectiveDate &&
      effectiveDate > today
    );
  };

  const canReapplyRow = (row) => {
    const effectiveDate = toDate10(row.effective_date);
    const today = getToday();

    return (
      canManageResignationReturn &&
      norm(row.status) === norm(STATUS_APPROVED) &&
      effectiveDate &&
      effectiveDate <= today
    );
  };

  const badgeClass = (status) => {
    const s = norm(status);
    if (s === norm(STATUS_APPROVED)) return "badge badge-approved";
    if (s === norm(STATUS_REJECTED)) return "badge badge-rejected";
    if (s === norm(STATUS_REVOKED)) return "badge badge-rejected";
    return "badge badge-pending";
  };

  const attachmentUrl = (row) => {
    const p = row?.approved_attachment_path || row?.attachment_path;
    if (!p) return "";
    if (String(p).startsWith("http")) return p;
    return `${baseUrl}${p}`;
  };

  const actionLabel = (row) => {
    const status = toStr(row.status);

    if (status === STATUS_BRANCH) return "For Branch Manager";
    if (status === STATUS_AREA) return "For Area Manager";
    if (status === STATUS_RM) return "For RM";
    if (status === STATUS_AVP) return "For AVP";
    if (status === STATUS_VP) return "For VP";
    if (status === STATUS_SVP) return "For SVP";
    if (status === STATUS_HR) return "For HR Department";
    if (status === STATUS_AVP_SIGNATURE) return "For AVP Signature";
    if (status === STATUS_HR_FINAL) return "For HR Final Approval";
    if (status === STATUS_APPROVED) return "Approved";
    if (status === STATUS_REJECTED) return "Rejected";
    if (status === STATUS_REVOKED) return "Revoked";

    return "-";
  };

  const branchLabel = (row) => {
    if (row.branch_code || row.branch_name) {
      return `${row.branch_code || ""}${
        row.branch_code && row.branch_name ? " - " : ""
      }${row.branch_name || ""}`;
    }

    return "-";
  };

  const fileNameLabel = (row) => {
    return (
      row?.approved_attachment_name ||
      row?.attachment_name ||
      row?.attachment_path?.split("/")?.pop() ||
      "Latest File"
    );
  };  

  const getApprovalHistory = (row) => {
    if (!row) return [];

    const history = [
      {
        role: "Branch Manager",
        approvedBy: row.branch_manager_approved_by_name,
        approvedAt: row.branch_manager_approved_at,
      },
      {
        role: "Area Manager",
        approvedBy: row.area_manager_approved_by_name,
        approvedAt: row.area_manager_approved_at,
      },
      {
        role: "Regional Manager",
        approvedBy: row.regional_manager_approved_by_name,
        approvedAt: row.regional_manager_approved_at,
      },
      {
        role: "Assistant Vice President",
        approvedBy: row.avp_approved_by_name,
        approvedAt: row.avp_approved_at,
      },
      {
        role: "Vice President",
        approvedBy: row.vp_approved_by_name,
        approvedAt: row.vp_approved_at,
      },
      {
        role: "Senior Vice President",
        approvedBy: row.svp_approved_by_name,
        approvedAt: row.svp_approved_at,
      },

      // NEW WORKFLOW
      {
        role: "HR Department - Initial Approval",
        approvedBy: row.hr_initial_approved_by_name,
        approvedAt: row.hr_initial_approved_at,
      },
      {
        role: "AVP - Signature Approval",
        approvedBy: row.avp_signature_approved_by_name,
        approvedAt: row.avp_signature_approved_at,
      },
      {
        role: "HR Department - Final Approval",
        approvedBy:
          row.hr_final_approved_by_name ||
          row.approved_by_name,
        approvedAt:
          row.hr_final_approved_at ||
          row.approved_at,
      },
    ];

    return history.filter(
      (item) => item.approvedBy || item.approvedAt
    );
  };

  const totalRequests=filteredRows.length;
  const pendingRequests = filteredRows.filter((r) => {
    const s = norm(r.status);

    return (
      s !== norm(STATUS_APPROVED) &&
      s !== norm(STATUS_REJECTED) &&
      s !== norm(STATUS_REVOKED)
    );
  }).length;

  const approvedRequests=filteredRows.filter((r)=>norm(r.status)===norm(STATUS_APPROVED)).length;
  const rejectedRequests=filteredRows.filter((r)=>norm(r.status)===norm(STATUS_REJECTED)).length;

  return(
    <div className="reg-page">

      {/* HERO */}
      <section className="reg-hero">
        <div className="reg-hero-main">
          <div className="reg-hero-copy">
            <span className="reg-eyebrow">HRIS TRANSACTIONS</span>

            <h1>Resignation Requests</h1>

            <p>
              Create, review, approve and manage employee resignation
              requests through the required approval process.
            </p>

            <div className="reg-flow">
              <span>APPROVAL FLOW</span>
              <b>
                Branch Manager → Area Manager → Regional Manager →
                Assistant Vice President → Vice President →
                HR Department → AVP Signature → HR Final Approval
              </b>
            </div>
          </div>

          <div className="reg-hero-actions">
            <button
              className="reg-btn reg-btn-secondary"
              type="button"
              onClick={()=>navigate("/transactions")}
            >
              ← Back
            </button>

            <button
              className="reg-btn reg-btn-secondary"
              type="button"
              onClick={fetchAll}
              disabled={loading}
            >
              {loading?"Refreshing...":"Refresh"}
            </button>

            {canCreate&&(
              <button
                className="reg-btn reg-btn-primary"
                type="button"
                onClick={openCreate}
              >
                + Add Resignation
              </button>
            )}
          </div>
        </div>
      </section>

      {/* SUMMARY */}
      <section className="reg-summary-grid">
        <article className="reg-summary-card reg-summary-total">
          <div className="reg-summary-icon">ALL</div>
          <div>
            <span>Total Requests</span>
            <strong>{totalRequests}</strong>
            <small>All resignation records</small>
          </div>
        </article>

        <article className="reg-summary-card reg-summary-pending">
          <div className="reg-summary-icon">P</div>
          <div>
            <span>Pending</span>
            <strong>{pendingRequests}</strong>
            <small>Awaiting approval</small>
          </div>
        </article>

        <article className="reg-summary-card reg-summary-approved">
          <div className="reg-summary-icon">A</div>
          <div>
            <span>Approved</span>
            <strong>{approvedRequests}</strong>
            <small>Completed requests</small>
          </div>
        </article>

        <article className="reg-summary-card reg-summary-rejected">
          <div className="reg-summary-icon">R</div>
          <div>
            <span>Rejected</span>
            <strong>{rejectedRequests}</strong>
            <small>Rejected requests</small>
          </div>
        </article>
      </section>

      {error&&(
        <div className="reg-error">{error}</div>
      )}

      {/* SEARCH */}
      <section className="reg-search-panel">
        <div className="reg-search-controls">
          <input
            className="reg-search-input"
            type="text"
            value={searchText}
            onChange={(e)=>setSearchText(e.target.value)}
            onKeyDown={(e)=>{
              if(e.key==="Enter") setSearch(searchText);
            }}
            placeholder="Search request no, employee, branch, status..."
          />

          <button
            className="reg-btn reg-btn-secondary"
            type="button"
            onClick={()=>setSearch(searchText)}
          >
            Search
          </button>

          <button
            className="reg-btn reg-btn-secondary"
            type="button"
            onClick={()=>{
              setSearchText("");
              setSearch("");
            }}
          >
            Clear
          </button>
        </div>

        <span className="reg-result-count">
          {filteredRows.length}{" "}
          {filteredRows.length===1?"result":"results"}
        </span>
      </section>

      {/* TABLE */}
      <section className="reg-list-card">
        <div className="reg-table-wrap">
          <table className="reg-table">
            <thead>
              <tr>
                <th>Request No</th>
                <th>Employee</th>
                <th>Branch</th>
                <th>Resignation Date</th>
                <th>Effective Date</th>
                <th>Status</th>
                <th>Stage</th>
                <th>File</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading?(
                <tr>
                  <td colSpan={9} className="reg-empty">
                    Loading resignation requests...
                  </td>
                </tr>
              ):filteredRows.length===0?(
                <tr>
                  <td colSpan={9} className="reg-empty">
                    No resignation requests found.
                  </td>
                </tr>
              ):(
                pagedRows.map((row)=>{
                  const canApprove=canApproveRow(row);
                  const selectedFile=uploadFiles[row.id];
                  const hasFile=Boolean(
                    row.attachment_path||row.approved_attachment_path
                  );
                  const approved=norm(row.status)===norm(STATUS_APPROVED);
                  const rejected=norm(row.status)===norm(STATUS_REJECTED);
                  const revoked=norm(row.status)===norm(STATUS_REVOKED);

                  return(
                    <tr key={row.id}>
                      <td className="reg-request-no">
                        {row.request_no||row.id}
                      </td>

                      <td>
                        <div className="reg-employee-name">
                          {row.employee_name||"-"}
                        </div>

                        <div className="reg-sub-info">
                          Employee No: {row.employee_no||"-"}
                        </div>
                      </td>

                      <td>{branchLabel(row)}</td>
                      <td>{fmtDate(row.resignation_date)}</td>
                      <td>{fmtDate(row.effective_date)}</td>

                      <td>
                        <span className={badgeClass(row.status)}>
                          {row.status||STATUS_RM}
                        </span>
                      </td>

                      <td>
                        <span className="reg-stage">
                          {actionLabel(row)}
                        </span>
                      </td>

                      <td>
                        {hasFile?(
                          <a
                            href={attachmentUrl(row)}
                            target="_blank"
                            rel="noreferrer"
                            className="reg-action-btn reg-action-download"
                          >
                            View File
                          </a>
                        ):"-"}
                      </td>

                      <td>
                        <div className="reg-row-actions">
                          <button
                            className="reg-action-btn reg-action-view"
                            type="button"
                            onClick={()=>setViewRow(row)}
                          >
                            View
                          </button>

                          {canApprove && !approved && !rejected && !revoked && (
                            <>
                              <label className="reg-action-btn reg-action-upload">
                                {selectedFile?.name?"Change File":"Choose File"}
                                <input
                                  type="file"
                                  hidden
                                  onChange={(e)=>
                                    setRowFile(row.id,e.target.files?.[0]||null)
                                  }
                                />
                              </label>

                              <button
                                className="reg-action-btn reg-action-approve"
                                type="button"
                                onClick={() => {
                                  if (isFinalApprovalRow(row)) {
                                    setFinalApproveRow(row);

                                    setFinalApproveForm({
                                      effective_date: "",
                                      attachment: null,
                                    });

                                    return;
                                  }
                                  approveRequest(row);
                                }}
                                disabled={processingId===`approve-${row.id}`}
                              >
                                {processingId===`approve-${row.id}`
                                  ?"Approving..."
                                  :"Approve"}
                              </button>
                            </>
                          )}

                          {canRejectRow(row) && !approved && !rejected && !revoked && (
                            <button
                              className="reg-action-btn reg-action-reject"
                              type="button"
                              onClick={()=>{
                                setRejectingRow(row);
                                setRejectionReason("");
                              }}
                              disabled={processingId===`reject-${row.id}`}
                            >
                              Reject
                            </button>
                          )}

                          {canRevokeRow(row)&&(
                            <button
                              className="reg-action-btn reg-action-reject"
                              type="button"
                              onClick={()=>openRevokeModal(row)}
                              disabled={processingId===`revoke-${row.id}`}
                            >
                              {processingId===`revoke-${row.id}`
                                ?"Revoking..."
                                :"Revoke"}
                            </button>
                          )}

                          {canReapplyRow(row) && (
                            <button
                              className="reg-action-btn reg-action-approve"
                              type="button"
                              onClick={() => openReapplyModal(row)}
                              disabled={processingId === `reapply-${row.id}`}
                            >
                              {processingId === `reapply-${row.id}`
                                ? "Submitting..."
                                : "Re-Apply"}
                            </button>
                          )}

                          {canDeleteRow(row)&&(
                            <button
                              className="reg-action-btn reg-action-delete"
                              type="button"
                              onClick={()=>deleteRequest(row)}
                              disabled={processingId===`delete-${row.id}`}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}
        <div className="reg-pager">
          <div className="reg-pager-left">
            <span>Rows per page</span>

            <select
              value={pageSize}
              onChange={(e)=>setPageSize(Number(e.target.value))}
            >
              {[25,50,75,100].map((size)=>(
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>

          <div className="reg-pager-right">
            <button
              type="button"
              className="reg-page-btn"
              disabled={page<=1}
              onClick={()=>setPage((p)=>Math.max(1,p-1))}
            >
              ‹
            </button>

            {getPageNumbers().map((pageNumber)=>(
              <button
                key={pageNumber}
                type="button"
                className={`reg-page-number ${
                  page===pageNumber?"active":""
                }`}
                onClick={()=>setPage(pageNumber)}
              >
                {pageNumber}
              </button>
            ))}

            <button
              type="button"
              className="reg-page-btn"
              disabled={page>=totalPages}
              onClick={()=>setPage((p)=>Math.min(totalPages,p+1))}
            >
              ›
            </button>

            <span className="reg-page-summary">
              Page {page} of {totalPages}
            </span>
          </div>
        </div>
      </section>

      {showCreate && (
        <div
          className="modal-overlay"
          onMouseDown={(e) =>
            e.target.classList.contains("modal-overlay") && closeCreate()
          }
        >
          <div className="modal saas-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h3 className="modal-title">Create Resignation Request</h3>
                <p className="modal-subtitle">
                  Submitted into approval chain automatically.
                </p>
              </div>

              <button className="modal-x" onClick={closeCreate} type="button">
                ✕
              </button>
            </div>

            <form className="modal-form" onSubmit={submitCreate}>
              <div className="modal-grid">
                <div
                  className="form-group full"
                  ref={employeeBoxRef}
                  style={{ position: "relative", zIndex: 50 }}
                >
                  <label>Employee</label>
                  <input
                    type="text"
                    value={employeeSearch}
                    onChange={(e) => {
                      setEmployeeSearch(e.target.value);
                      setShowEmployeeDropdown(true);
                      setForm((prev) => ({
                        ...prev,
                        staff_id: "",
                        employee_no: "",
                        employee_name: "",
                        last_name: "",
                        first_name: "",
                        middle_name: "",
                        branch_id: "",
                        branch_code: "",
                        branch_name: "",
                      }));
                    }}
                    onFocus={() => setShowEmployeeDropdown(true)}
                    placeholder="Search employee no or name..."
                    required={!form.staff_id}
                  />

                  {showEmployeeDropdown && (
                    <div className="approval-search-dropdown">
                      {filteredEmployees.length === 0 ? (
                        <div className="approval-search-empty">No employee found</div>
                      ) : (
                        filteredEmployees.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            className="approval-search-item"
                            onClick={() => handleEmployeeSelect(s.id)}
                          >
                            {s.employee_no ? `${s.employee_no} - ` : ""}
                            {s._display}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label>Employee No</label>
                  <input value={form.employee_no} readOnly placeholder="Auto-filled" />
                </div>

                <div className="form-group">
                  <label>Last Name</label>
                  <input value={form.last_name} readOnly placeholder="Auto-filled" />
                </div>

                <div className="form-group">
                  <label>First Name</label>
                  <input value={form.first_name} readOnly placeholder="Auto-filled" />
                </div>

                <div className="form-group">
                  <label>Middle Name</label>
                  <input value={form.middle_name} readOnly placeholder="Auto-filled" />
                </div>

                <div className="form-group">
                  <label>Branch</label>
                  <input
                    value={
                      form.branch_code || form.branch_name
                        ? `${form.branch_code || ""}${
                            form.branch_code && form.branch_name ? " - " : ""
                          }${form.branch_name || ""}`
                        : ""
                    }
                    readOnly
                    placeholder="Auto-filled"
                  />
                </div>

                <div className="form-group">
                  <label>Resignation Date</label>
                  <input
                    type="date"
                    value={form.resignation_date}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        resignation_date: e.target.value,
                      }))
                    }
                    required
                  />
                </div>

                <div className="form-group full">
                  <label>Attachment</label>
                  <input
                    type="file"
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        attachment: e.target.files?.[0] || null,
                      }))
                    }
                  />
                </div>

                <div className="form-group full">
                  <label>Remarks</label>
                  <textarea
                    value={form.remarks}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, remarks: e.target.value }))
                    }
                    placeholder="Reason / remarks..."
                  />
                </div>
              </div>

              <div className="modal-buttons">
                <button className="btn-secondary" type="button" onClick={closeCreate}>
                  Cancel
                </button>

                <button className="btn-primary" type="submit" disabled={saving}>
                  {saving ? "Saving..." : "Create Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewRow && (
        <div
          className="modal-overlay"
          onMouseDown={(e) =>
            e.target.classList.contains("modal-overlay") && setViewRow(null)
          }
        >
          <div className="modal saas-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h3 className="modal-title">Resignation Details</h3>
                <p className="modal-subtitle">
                  {viewRow.request_no || viewRow.id} — {viewRow.employee_name || "-"}
                </p>
              </div>

              <button className="modal-x" type="button" onClick={() => setViewRow(null)}>
                ✕
              </button>
            </div>

            <div className="modal-form">
              <div className="modal-grid">
                <div className="form-group">
                  <label>Employee No</label>
                  <input value={viewRow.employee_no || "-"} readOnly />
                </div>

                <div className="form-group">
                  <label>Branch</label>
                  <input value={branchLabel(viewRow)} readOnly />
                </div>

                <div className="form-group">
                  <label>Resignation Date</label>
                  <input value={fmtDate(viewRow.resignation_date)} readOnly />
                </div>

                <div className="form-group">
                  <label>Effective Date</label>
                  <input value={fmtDate(viewRow.effective_date)} readOnly />
                </div>

                <div className="form-group">
                  <label>Status</label>
                  <input value={viewRow.status || "-"} readOnly />
                </div>

                <div className="form-group">
                  <label>Stage</label>
                  <input value={actionLabel(viewRow)} readOnly />
                </div>

                <div className="form-group full">
                  <label>Remarks</label>
                  <textarea value={viewRow.remarks || "No remarks"} readOnly />
                </div>

                {viewRow.rejection_reason ? (
                  <div className="form-group full">
                    <label>Rejection Reason</label>
                    <textarea value={viewRow.rejection_reason} readOnly />
                  </div>
                ) : null}

                {viewRow.attachment_path || viewRow.approved_attachment_path ? (
                  <div className="form-group full">
                    <label>Attachment</label>
                    <a
                      href={attachmentUrl(viewRow)}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-secondary"
                      style={{
                        textDecoration: "none",
                        display: "inline-flex",
                        width: "fit-content",
                      }}
                    >
                      Download Latest - {fileNameLabel(viewRow)}
                    </a>
                  </div>
                ) : null}

                <div className="form-group full">
                  <label>Approval History</label>

                  {getApprovalHistory(viewRow).length === 0 ? (
                    <div className="reg-approval-empty">
                      No approval history yet.
                    </div>
                  ) : (
                    <div className="reg-approval-history">
                      {getApprovalHistory(viewRow).map((item, index) => (
                        <div
                          className="reg-approval-history-item"
                          key={`${item.role}-${index}`}
                        >
                          <div className="reg-approval-history-step">
                            {index + 1}
                          </div>

                          <div className="reg-approval-history-info">
                            <strong>{item.role}</strong>

                            <span>
                              Approved by:{" "}
                              <b>{item.approvedBy || "-"}</b>
                            </span>

                            <small>
                              {fmtDateTime(item.approvedAt)}
                            </small>
                          </div>

                          <div className="reg-approval-history-status">
                            Approved
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="modal-buttons">
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={() => setViewRow(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {finalApproveRow && (
        <div
          className="modal-overlay"
          onMouseDown={(e) =>
            e.target.classList.contains("modal-overlay") &&
            closeFinalApproveModal()
          }
        >
          <div
            className="modal saas-modal"
            onMouseDown={(e) => e.stopPropagation()}
            style={{ maxWidth: 620 }}
          >
            <div className="modal-head">
              <div>
                <h3 className="modal-title">
                  Final Approve Resignation
                </h3>

                <p className="modal-subtitle">
                  {finalApproveRow.employee_name || "-"}
                </p>
              </div>

              <button
                className="modal-x"
                type="button"
                onClick={closeFinalApproveModal}
              >
                ✕
              </button>
            </div>

            <form
              className="modal-form"
              onSubmit={submitFinalApproval}
            >
              <div className="modal-grid">
                <div className="form-group">
                  <label>Employee No</label>

                  <input
                    value={
                      finalApproveRow.employee_no || "-"
                    }
                    readOnly
                  />
                </div>

                <div className="form-group">
                  <label>Employee Name</label>

                  <input
                    value={
                      finalApproveRow.employee_name || "-"
                    }
                    readOnly
                  />
                </div>

                <div className="form-group">
                  <label>Resignation Date</label>

                  <input
                    value={fmtDate(
                      finalApproveRow.resignation_date
                    )}
                    readOnly
                  />
                </div>

                <div className="form-group">
                  <label>Effective Date</label>

                  <input
                    type="date"
                    value={
                      finalApproveForm.effective_date
                    }
                    onChange={(e) =>
                      setFinalApproveForm((prev) => ({
                        ...prev,
                        effective_date: e.target.value,
                      }))
                    }
                    required
                  />
                </div>

                <div className="form-group full">
                  <label>
                    Final Approved File (Optional)
                  </label>

                  <input
                    type="file"
                    onChange={(e) =>
                      setFinalApproveForm((prev) => ({
                        ...prev,
                        attachment:
                          e.target.files?.[0] || null,
                      }))
                    }
                  />

                  <small>
                    Leave blank to use the AVP signed file.
                  </small>
                </div>
              </div>

              <div className="modal-buttons">
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={closeFinalApproveModal}
                >
                  Cancel
                </button>

                <button
                  className="btn-primary"
                  type="submit"
                  disabled={
                    processingId ===
                    `approve-${finalApproveRow.id}`
                  }
                >
                  {processingId ===
                  `approve-${finalApproveRow.id}`
                    ? "Approving..."
                    : "Final Approve"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {revokeRow && (
        <div
          className="modal-overlay"
          onMouseDown={(e) =>
            e.target.classList.contains("modal-overlay") &&
            closeRevokeModal()
          }
        >
          <div
            className="modal saas-modal"
            onMouseDown={(e) => e.stopPropagation()}
            style={{ maxWidth: 560 }}
          >
            <div className="modal-head">
              <div>
                <h3 className="modal-title">
                  Revoke Resignation
                </h3>

                <p className="modal-subtitle">
                  {revokeRow.employee_name || "-"} has not yet reached the resignation effective date.
                </p>
              </div>

              <button
                className="modal-x"
                type="button"
                onClick={closeRevokeModal}
              >
                ✕
              </button>
            </div>

            <form
              className="modal-form"
              onSubmit={submitRevokeRequest}
            >
              <div className="modal-grid">
                <div className="form-group full">
                  <label>Remarks</label>

                  <textarea
                    value={revokeRemarks}
                    onChange={(e) =>
                      setRevokeRemarks(e.target.value)
                    }
                    placeholder="Reason for revoking resignation..."
                  />
                </div>
              </div>

              <div className="modal-buttons">
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={closeRevokeModal}
                >
                  Cancel
                </button>

                <button
                  className="btn-danger"
                  type="submit"
                  disabled={
                    processingId === `revoke-${revokeRow.id}`
                  }
                >
                  {processingId === `revoke-${revokeRow.id}`
                    ? "Revoking..."
                    : "Revoke Resignation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {reapplyRow && (
        <div
          className="modal-overlay"
          onMouseDown={(e) =>
            e.target.classList.contains("modal-overlay") &&
            closeReapplyModal()
          }
        >
          <div
            className="modal saas-modal"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <h3 className="modal-title">
                  Re-Apply Staff
                </h3>

                <p className="modal-subtitle">
                  {reapplyRow.employee_name || "-"} will return to Active status after final approval.
                </p>
              </div>

              <button
                className="modal-x"
                type="button"
                onClick={closeReapplyModal}
              >
                ✕
              </button>
            </div>

            <form
              className="modal-form"
              onSubmit={submitReapplyRequest}
            >
              <div className="modal-grid">
                <div className="form-group">
                  <label>Employee No</label>
                  <input
                    value={reapplyRow.employee_no || "-"}
                    readOnly
                  />
                </div>

                <div className="form-group">
                  <label>Employee Name</label>
                  <input
                    value={reapplyRow.employee_name || "-"}
                    readOnly
                  />
                </div>

                <div className="form-group">
                  <label>Re-Apply Effective Date</label>
                  <input
                    type="date"
                    value={reapplyForm.effective_date}
                    onChange={(e) =>
                      setReapplyForm((p) => ({
                        ...p,
                        effective_date: e.target.value,
                      }))
                    }
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Branch Resume</label>
                  <select
                    value={reapplyForm.branch_id}
                    onChange={(e) =>
                      setReapplyForm((p) => ({
                        ...p,
                        branch_id: e.target.value,
                      }))
                    }
                    required
                  >
                    <option value="">Select branch</option>

                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.code
                          ? `${b.code} - ${b.name}`
                          : b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Department</label>

                  <select
                    value={reapplyForm.department}
                    onChange={(e) =>
                      setReapplyForm((p) => ({
                        ...p,
                        department: e.target.value,
                      }))
                    }
                    required
                  >
                    <option value="">Select department</option>
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

                <div className="form-group">
                  <label>New Position</label>

                  <input
                    value={reapplyForm.position}
                    onChange={(e) =>
                      setReapplyForm((p) => ({
                        ...p,
                        position: e.target.value,
                      }))
                    }
                    placeholder="Enter new position"
                    required
                  />
                </div>

                <div className="form-group full">
                  <label>Re-Apply File</label>

                  <input
                    type="file"
                    onChange={(e) =>
                      setReapplyForm((p) => ({
                        ...p,
                        attachment:
                          e.target.files?.[0] || null,
                      }))
                    }
                    required
                  />
                </div>

                <div className="form-group full">
                  <label>Remarks</label>

                  <textarea
                    value={reapplyForm.remarks}
                    onChange={(e) =>
                      setReapplyForm((p) => ({
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
                  onClick={closeReapplyModal}
                >
                  Cancel
                </button>

                <button
                  className="btn-primary"
                  type="submit"
                  disabled={
                    processingId === `reapply-${reapplyRow.id}`
                  }
                >
                  {processingId === `reapply-${reapplyRow.id}`
                    ? "Submitting..."
                    : "Submit Re-Apply"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {rejectingRow && (
        <div
          className="modal-overlay"
          onMouseDown={(e) =>
            e.target.classList.contains("modal-overlay") && setRejectingRow(null)
          }
        >
          <div
            className="modal saas-modal"
            onMouseDown={(e) => e.stopPropagation()}
            style={{ maxWidth: 560 }}
          >
            <div className="modal-head">
              <div>
                <h3 className="modal-title">Reject Resignation Request</h3>
                <p className="modal-subtitle">
                  Add reason before rejecting this request.
                </p>
              </div>

              <button
                className="modal-x"
                type="button"
                onClick={() => setRejectingRow(null)}
              >
                ✕
              </button>
            </div>

            <div className="modal-form">
              <div className="form-group full">
                <label>Reason</label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Enter rejection reason..."
                />
              </div>

              <div className="modal-buttons">
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={() => setRejectingRow(null)}
                >
                  Cancel
                </button>

                <button
                  className="btn-danger"
                  type="button"
                  onClick={rejectRequest}
                  disabled={processingId === `reject-${rejectingRow.id}`}
                >
                  {processingId === `reject-${rejectingRow.id}`
                    ? "Rejecting..."
                    : "Reject"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}