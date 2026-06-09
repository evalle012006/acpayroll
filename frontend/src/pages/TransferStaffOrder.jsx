import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axiosClient";
import "../styles/TransferStaffOrder.css";

const STATUS_WAITING_HR_FILE = "Waiting HR File";
const STATUS_APPROVED = "Approved";
const STATUS_REJECTED = "Rejected";
const OLD_STATUS_PENDING_VP = "Pending VP Approval";

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

const money = (v) => {
  const n = Number(v || 0);
  return n.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

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

const getStaffAmount = (s, keys) => {
  for (const key of keys) {
    if (s?.[key] !== undefined && s?.[key] !== null && s?.[key] !== "") {
      return s[key];
    }
  }
  return 0;
};

export default function TransferStaffOrder() {
  const navigate = useNavigate();

  const employeeBoxRef = useRef(null);
  const fromBranchBoxRef = useRef(null);
  const toBranchBoxRef = useRef(null);

  const user = useMemo(() => readUser(), []);
  const role = norm(user?.role);

  const isAdmin = role === "admin";
  const isIT = role === "it";
  const isHR = role === "hr";
  const isBM = role === "branch manager";
  const isAM = role === "area manager";
  const isRM = role === "regional manager";
  const isAVP = role === "assistant vice president";
  const isVP = role === "vice president";
  const isSVP = role === "senior vice president";

  const userDepartment = norm(user?.department);

  const isHRDepartment =
    userDepartment === "hr" ||
    userDepartment === "hr department" ||
    userDepartment === "human resources" ||
    userDepartment === "human resources department";

  const canCreate = true;
  const canHRUpload = isAdmin || isHRDepartment;
  const canReject = isAdmin || isHRDepartment;

  const userBranchId = String(user?.branch_id || "");
  const userArea = norm(user?.area);
  const userRegion = norm(user?.region);
  const userDivision = norm(user?.division);

  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");

  const [tablePage, setTablePage] = useState(1);
  const [tablePageSize, setTablePageSize] = useState(25);

  const [branches, setBranches] = useState([]);
  const [staff, setStaff] = useState([]);
  const [orders, setOrders] = useState([]);

  const [loadingRefs, setLoadingRefs] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [error, setError] = useState("");

  const [dateCreated, setDateCreated] = useState(() => new Date().toISOString().slice(0, 10));

  const [department, setDepartment] = useState("");
  const [division, setDivision] = useState("");
  const [area, setArea] = useState("");
  const [region, setRegion] = useState("");
  const [details, setDetails] = useState("");

  const [employeeId, setEmployeeId] = useState("");
  const [employeeQuery, setEmployeeQuery] = useState("");
  const [showEmployeeResults, setShowEmployeeResults] = useState(false);

  const [fromBranchId, setFromBranchId] = useState("");
  const [fromBranchQuery, setFromBranchQuery] = useState("");
  const [showFromBranchResults, setShowFromBranchResults] = useState(false);

  const [toBranchId, setToBranchId] = useState("");
  const [toBranchQuery, setToBranchQuery] = useState("");
  const [showToBranchResults, setShowToBranchResults] = useState(false);

  const [effectiveDate, setEffectiveDate] = useState("");

  const [viewFiles, setViewFiles] = useState([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [filesError, setFilesError] = useState("");
  const [hrFinalFile, setHrFinalFile] = useState(null);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/login";
  }, []);

  const isUploadStage = (status) =>
    status === STATUS_WAITING_HR_FILE || status === OLD_STATUS_PENDING_VP;

  const canAccessStaff = useCallback(
    (s) => {
      if (
        [
          "admin",
          "it",
          "hr",
          "accounting",
          "vice president",
          "senior vice president",
          "president",
        ].includes(role)
      ) {
        return true;
      }

      if (role === "branch manager") {
        const myBranch = String(
          user?.branch_id || user?.branch_code || user?.branch || ""
        )
          .trim()
          .toLowerCase();

        const staffBranchId = String(s?.branch_id || "").trim().toLowerCase();
        const staffBranchCode = String(s?.branch_code || "").trim().toLowerCase();
        const staffBranchName = String(s?.branch_name || s?.branch || "")
          .trim()
          .toLowerCase();

        return (
          staffBranchId === myBranch ||
          staffBranchCode === myBranch ||
          staffBranchName === myBranch
        );
      }

      if (role === "area manager") {
        return norm(s?.area) === userArea;
      }

      if (role === "regional manager") {
        return norm(s?.region) === userRegion;
      }

      if (role === "assistant vice president") {
        return norm(s?.division) === userDivision;
      }

      return false;
    },
    [role, userBranchId, userArea, userRegion, userDivision]
  );

  const canAccessFromBranch = useCallback(
    (b) => {
      if (
        [
          "admin",
          "it",
          "hr",
          "accounting",
          "vice president",
          "senior vice president",
          "president",
        ].includes(role)
      ) {
        return true;
      }

      if (role === "branch manager") {
        const myBranch = String(
          user?.branch_id || user?.branch_code || user?.branch || ""
        )
          .trim()
          .toLowerCase();

        return (
          String(b?.id || "").trim().toLowerCase() === myBranch ||
          String(b?.code || "").trim().toLowerCase() === myBranch ||
          String(b?.name || "").trim().toLowerCase() === myBranch
        );
      }

      if (role === "area manager") {
        return norm(b?.area) === userArea;
      }

      if (role === "regional manager") {
        return norm(b?.region) === userRegion;
      }

      if (role === "assistant vice president") {
        return norm(b?.division) === userDivision;
      }

      return false;
    },
    [role, userBranchId, userArea, userRegion, userDivision]
  );

  useEffect(() => {
    const loadRefs = async () => {
      setLoadingRefs(true);
      setError("");

      try {
        const [bRes, sRes] = await Promise.all([
          api.get("/branches-all"),
          api.get("/staff"),
        ]);

        setBranches(Array.isArray(bRes.data) ? bRes.data : []);
        setStaff(Array.isArray(sRes.data) ? sRes.data : []);
      } catch (err) {
        if (err?.response?.status === 401) return logout();
        setError(err?.response?.data?.message || "Failed to load references.");
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
        return list.find((o) => Number(o.id) === Number(prev.id)) || prev;
      });
    } catch (err) {
      if (err?.response?.status === 401) return logout();
      setError(err?.response?.data?.message || "Failed to load transfer orders.");
    } finally {
      setLoadingOrders(false);
    }
  }, [logout]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

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
    const q = norm(appliedSearch);
    if (!q) return orders;

    return orders.filter((o) =>
      [
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
        fmtDate(o.date_created),
        fmtDate(o.effective_date),
      ]
        .map(toStr)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [orders, appliedSearch]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / tablePageSize));

  const pagedOrders = useMemo(() => {
    const start = (tablePage - 1) * tablePageSize;
    return filteredOrders.slice(start, start + tablePageSize);
  }, [filteredOrders, tablePage, tablePageSize]);

  useEffect(() => {
    setTablePage(1);
  }, [appliedSearch, tablePageSize]);

  const filteredStaff = useMemo(() => {
    const q = norm(employeeQuery);

    return staff
      .filter(canAccessStaff)
      .filter((s) => {
        if (!q) return true;

        const branch = branches.find((b) => Number(b.id) === Number(s.branch_id));

        return [
          s.id,
          s.employee_no,
          s.fullname,
          s.first_name,
          s.middle_name,
          s.last_name,
          displayName(s),
          s.position,
          branch?.code,
          branch?.name,
          s.area,
          s.region,
          s.division,
        ]
          .map(toStr)
          .join(" ")
          .toLowerCase()
          .includes(q);
      })
      .slice(0, 20);
  }, [staff, employeeQuery, branches, canAccessStaff]);

  const filteredFromBranches = useMemo(() => {
    const q = norm(fromBranchQuery);

    return branches
      .filter(canAccessFromBranch)
      .filter((b) => {
        if (!q) return true;

        return [b.id, b.code, b.name, b.area, b.region, b.division]
          .map(toStr)
          .join(" ")
          .toLowerCase()
          .includes(q);
      })
      .slice(0, 20);
  }, [branches, fromBranchQuery, canAccessFromBranch]);

  const filteredToBranches = useMemo(() => {
    const q = norm(toBranchQuery);

    return branches
      .filter((b) => {
        if (!q) return true;

        return [b.id, b.code, b.name, b.area, b.region, b.division]
          .map(toStr)
          .join(" ")
          .toLowerCase()
          .includes(q);
      })
      .slice(0, 100);
  }, [branches, toBranchQuery]);

  useEffect(() => {
    if (!showModal || !selectedEmployee) return;

    if (selectedEmployee.branch_id && !fromBranchId) {
      const branch = branches.find(
        (b) => Number(b.id) === Number(selectedEmployee.branch_id)
      );

      setFromBranchId(String(selectedEmployee.branch_id));
      setFromBranchQuery(branch ? branchLabel(branch) : "");
    }
  }, [showModal, selectedEmployee, fromBranchId, branches]);

  useEffect(() => {
    if (!showModal) return;

    const onMouseDown = (e) => {
      if (employeeBoxRef.current && !employeeBoxRef.current.contains(e.target)) {
        setShowEmployeeResults(false);
      }

      if (fromBranchBoxRef.current && !fromBranchBoxRef.current.contains(e.target)) {
        setShowFromBranchResults(false);
      }

      if (toBranchBoxRef.current && !toBranchBoxRef.current.contains(e.target)) {
        setShowToBranchResults(false);
      }
    };

    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [showModal]);

  const resetForm = () => {
    setDateCreated(new Date().toISOString().slice(0, 10));
    setDepartment("");
    setDivision("");
    setArea("");
    setRegion("");
    setDetails("");
    setEmployeeId("");
    setEmployeeQuery("");
    setFromBranchId("");
    setFromBranchQuery("");
    setToBranchId("");
    setToBranchQuery("");
    setEffectiveDate("");
    setError("");
  };

  const openModal = () => {
    resetForm();
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    resetForm();
  };

  const openViewModal = async (order) => {
    setSelectedOrder(order);
    setShowViewModal(true);
    setHrFinalFile(null);
    setFilesError("");
    setViewFiles([]);

    setLoadingFiles(true);

    try {
      const res = await api.get(`/transfer-staff-orders/${order.id}/files`);
      setViewFiles(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      if (err?.response?.status === 401) return logout();
      setFilesError(err?.response?.data?.message || "Failed to load files.");
    } finally {
      setLoadingFiles(false);
    }
  };

  const closeViewModal = () => {
    setShowViewModal(false);
    setHrFinalFile(null);
    setFilesError("");
  };

  const handleChooseEmployee = (s) => {
    setEmployeeId(String(s.id || ""));
    setEmployeeQuery(`${displayName(s)}${s.employee_no ? ` (${s.employee_no})` : ""}`);
    setShowEmployeeResults(false);

    if (s.branch_id) {
      const branch = branches.find(
        (b) => Number(b.id) === Number(s.branch_id)
      );

      setFromBranchId(String(s.branch_id));
      setFromBranchQuery(branch ? branchLabel(branch) : "");

      if (branch) {
        setArea(toStr(branch.area));
        setRegion(toStr(branch.region));
        setDivision(toStr(branch.division));
        setDepartment(toStr(s.department));
      }
    }
  };

  const handleChooseFromBranch = (b) => {
    setFromBranchId(String(b.id || ""));
    setFromBranchQuery(branchLabel(b));
    setShowFromBranchResults(false);
  };

  const handleChooseToBranch = (b) => {
    setToBranchId(String(b.id || ""));
    setToBranchQuery(branchLabel(b));
    setShowToBranchResults(false);
  };

  const saveOrder = async () => {
    setError("");

    if (!employeeId) return setError("Select employee.");
    if (!fromBranchId) return setError("Select previous branch.");
    if (!toBranchId) return setError("Select transfer branch.");
    if (!division) return setError("Division required.");
    if (!area) return setError("Area required.");
    if (!region) return setError("Region required.");
    if (!department) return setError("Department required.");
    if (!dateCreated) return setError("Date Created required.");
    if (!effectiveDate) return setError("Effective date required.");
    if (!details) return setError("Details required.");

    const payload = {
      employee_id: Number(employeeId),
      employee_name: displayName(selectedEmployee),

      prev_branch_id: Number(fromBranchId),
      prev_branch_code: toStr(fromBranch?.code),
      prev_branch_name: toStr(fromBranch?.name),

      to_branch_id: Number(toBranchId),
      to_branch_code: toStr(toBranch?.code),
      to_branch_name: toStr(toBranch?.name),

      area,
      region,
      division,
      department,
      date_created: dateCreated,
      effective_date: effectiveDate,
      details,
    };

    setSaving(true);

    try {
      const res = await api.post("/transfer-staff-orders", payload);
      const created = res.data;

      setOrders((prev) => [created, ...prev]);
      setSelectedOrder(created);
      closeModal();
      fetchOrders();
    } catch (err) {
      if (err?.response?.status === 401) return logout();
      setError(err?.response?.data?.message || "Failed to save transfer order.");
    } finally {
      setSaving(false);
    }
  };

  const rejectOrder = async (order) => {
    const reason = prompt("Enter rejection reason:");
    if (!reason || !reason.trim()) return;

    setActionLoading(true);
    setFilesError("");

    try {
      const res = await api.put(`/transfer-staff-orders/${order.id}/reject`, {
        reason: reason.trim(),
      });

      const updated = res.data;

      setOrders((prev) =>
        prev.map((o) => (Number(o.id) === Number(updated.id) ? updated : o))
      );
      setSelectedOrder(updated);
      setShowViewModal(false);
    } catch (err) {
      if (err?.response?.status === 401) return logout();
      setFilesError(err?.response?.data?.message || "Failed to reject transfer.");
    } finally {
      setActionLoading(false);
    }
  };

  const uploadHRFinalFile = async () => {
    if (!selectedOrder?.id) return;

    if (!hrFinalFile) {
      setFilesError("Choose final file first.");
      return;
    }

    setActionLoading(true);
    setFilesError("");

    try {
      const formData = new FormData();
      formData.append("file", hrFinalFile);

      const res = await api.post(
        `/transfer-staff-orders/${selectedOrder.id}/hr-final-file`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );

      const updated = res.data?.order;

      if (updated) {
        setOrders((prev) =>
          prev.map((o) => (Number(o.id) === Number(updated.id) ? updated : o))
        );
        setSelectedOrder(updated);
      }

      setHrFinalFile(null);
      setShowViewModal(false);
      fetchOrders();
    } catch (err) {
      if (err?.response?.status === 401) return logout();
      setFilesError(
        err?.response?.data?.message || "Failed to upload final approved file."
      );
    } finally {
      setActionLoading(false);
    }
  };

  const voidOrder = async (order) => {
    const reason = prompt("Enter void reason:");
    if (!reason?.trim()) return;

    try {
      await api.put(`/transfer-staff-orders/${order.id}/void`, {
        reason: reason.trim(),
      });

      fetchOrders();
      setShowViewModal(false);
    } catch (err) {
      setFilesError(
        err?.response?.data?.message || "Failed to void transfer order."
      );
    }
  };

  const deleteOrder = async (order) => {
    if (!window.confirm("Delete this transfer order?")) return;

    try {
      await api.delete(`/transfer-staff-orders/${order.id}`);

      fetchOrders();
      setShowViewModal(false);
    } catch (err) {
      setFilesError(
        err?.response?.data?.message || "Failed to delete transfer order."
      );
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
      if (err?.response?.status === 401) return logout();
      setFilesError(err?.response?.data?.message || "Failed to download file.");
    }
  };

  const accountRows = selectedEmployee
    ? [
        {
          label: "Basic Salary",
          value: getStaffAmount(selectedEmployee, [
            "basic_salary",
            "salary",
            "rate",
            "monthly_salary",
          ]),
        },
        {
          label: "ECOLA",
          value: getStaffAmount(selectedEmployee, ["ecola", "e_cola"]),
        },
        {
          label: "CBU Deduction",
          value: getStaffAmount(selectedEmployee, [
            "cbu_deduction",
            "cbu",
            "cbu_balance",
          ]),
        },
        {
          label: "Cashbond Deduction",
          value: getStaffAmount(selectedEmployee, [
            "cashbond_deduction",
            "cash_bond_deduction",
            "cashbond",
            "cash_bond",
          ]),
        },
        {
          label: "Utility",
          value: getStaffAmount(selectedEmployee, [
            "utility",
            "utility_deduction",
            "utility_balance",
          ]),
        },
        {
          label: "Salary Advance Remaining",
          value: getStaffAmount(selectedEmployee, [
            "salary_advance_remaining",
            "salary_advance_balance",
            "salary_advance",
          ]),
        },
        {
          label: "Cash Advance Remaining",
          value: getStaffAmount(selectedEmployee, [
            "cash_advance_remaining",
            "cash_advance_balance",
            "cash_advance",
          ]),
        },
        {
          label: "Special Advance Remaining",
          value: getStaffAmount(selectedEmployee, [
            "special_advance_remaining",
            "special_advance_balance",
            "special_advance",
          ]),
        },
        {
          label: "SSS Loan",
          value: getStaffAmount(selectedEmployee, [
            "sss_loan",
            "sss_loan_remaining",
            "sss_loan_balance",
          ]),
        },
        {
          label: "Pag-IBIG Loan",
          value: getStaffAmount(selectedEmployee, [
            "pag_ibig_loan",
            "pagibig_loan",
            "pag_ibig_loan_remaining",
            "pagibig_loan_remaining",
            "pag_ibig_loan_balance",
            "pagibig_loan_balance",
          ]),
        },
      ]
    : [];

  const colCount = 11;

  return (
    <div className="order-page">
      <div className="order-page-header">
        <div>
          <h2 className="order-title">Transfer Staff</h2>
          <p className="order-subtitle">
            All departments can create transfer Staff Order and after creating wait for the HR to upload the Approved File.
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

          {canCreate ? (
            <button className="btn-primary" onClick={openModal} type="button">
              + Create Transfer
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="card" style={{ padding: 12, marginBottom: 12 }}>
          <strong style={{ color: "#ef4444" }}>{error}</strong>
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
                onKeyDown={(e) => e.key === "Enter" && setAppliedSearch(search)}
                placeholder="Search order no, employee, branch..."
                className="order-search-input"
              />

              <button
                className="btn-primary"
                type="button"
                onClick={() => setAppliedSearch(search)}
              >
                Search
              </button>

              <button
                className="btn-secondary"
                type="button"
                onClick={() => {
                  setSearch("");
                  setAppliedSearch("");
                }}
              >
                Clear
              </button>
            </div>
          </div>

          <div className="order-card-meta">{filteredOrders.length} Records</div>
        </div>

        <div className="leave-pager">
          <div className="leave-pager-left">
            <span>Rows per page</span>
            <select
              value={tablePageSize}
              onChange={(e) => setTablePageSize(Number(e.target.value))}
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={75}>75</option>
              <option value={100}>100</option>
            </select>
          </div>

          <div className="leave-pager-right">
            <button
              className="leave-page-btn"
              type="button"
              disabled={tablePage <= 1}
              onClick={() => setTablePage((p) => Math.max(1, p - 1))}
            >
              ‹
            </button>

            <button className="leave-page-number active" type="button">
              {tablePage}
            </button>

            <button
              className="leave-page-btn"
              type="button"
              disabled={tablePage >= totalPages}
              onClick={() => setTablePage((p) => Math.min(totalPages, p + 1))}
            >
              ›
            </button>

            <span className="leave-page-summary">
              Page {tablePage} of {totalPages}
            </span>
          </div>
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
                <th>Actions</th>
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
                    No transfer orders found.
                  </td>
                </tr>
              ) : (
                pagedOrders.map((o) => (
                  <tr key={o.id}>
                    <td className="td-strong">{o.order_no}</td>
                    <td>{o.employee_name}</td>
                    <td>
                      {toStr(o.prev_branch_code)} - {toStr(o.prev_branch_name)}
                    </td>
                    <td>
                      {toStr(o.to_branch_code)} - {toStr(o.to_branch_name)}
                    </td>
                    <td>{o.division || "-"}</td>
                    <td>{o.area || "-"}</td>
                    <td>{o.region || "-"}</td>
                    <td>{fmtDate(o.date_created)}</td>
                    <td>{fmtDate(o.effective_date)}</td>
                    <td>
                      <strong>{o.status}</strong>
                      {o.status === STATUS_REJECTED && o.rejection_reason ? (
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
                    <td>
                      <button
                        className="btn-secondary"
                        type="button"
                        onClick={() => openViewModal(o)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div style={{ padding: 12, display: "flex", justifyContent: "flex-end" }}>
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

      {showModal && (
        <div className="modal-overlay" onMouseDown={closeModal}>
          <div
            className="modal saas-modal"
            onMouseDown={(e) => e.stopPropagation()}
            style={{ maxWidth: 1180 }}
          >
            <div className="modal-head">
              <div>
                <h3 className="modal-title">Create Transfer Order</h3>
                <p className="modal-subtitle">
                  Order No. will be auto-generated on save.
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

                  <div
                    className="field full"
                    style={{ position: "relative" }}
                    ref={employeeBoxRef}
                  >
                    <label>Employee</label>
                    <input
                      type="text"
                      value={employeeQuery}
                      placeholder="Search employee no, name, position, branch..."
                      onChange={(e) => {
                        setEmployeeQuery(e.target.value);
                        setEmployeeId("");
                        setShowEmployeeResults(true);
                      }}
                      onFocus={() => setShowEmployeeResults(true)}
                    />

                    {showEmployeeResults && (
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
                          border:
                            "1px solid var(--border, rgba(255,255,255,0.1))",
                          borderRadius: 12,
                          zIndex: 30,
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
                                borderBottom: "1px solid var(--border)",
                                background: "transparent",
                                color: "inherit",
                                cursor: "pointer",
                              }}
                            >
                              <div style={{ fontWeight: 800 }}>
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
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  <div
                    className="field"
                    style={{ position: "relative" }}
                    ref={fromBranchBoxRef}
                  >
                    <label>Previous Branch</label>
                    <input
                      type="text"
                      value={fromBranchQuery}
                      placeholder="Search previous branch..."
                      onChange={(e) => {
                        setFromBranchQuery(e.target.value);
                        setFromBranchId("");
                        setShowFromBranchResults(true);
                      }}
                      onFocus={() => setShowFromBranchResults(true)}
                    />

                    {showFromBranchResults && (
                      <div
                        style={{
                          position: "absolute",
                          left: 0,
                          right: 0,
                          top: "100%",
                          marginTop: 6,
                          maxHeight: 220,
                          overflowY: "auto",
                          background: "var(--card, #0f172a)",
                          border: "1px solid var(--border)",
                          borderRadius: 12,
                          zIndex: 25,
                        }}
                      >
                        {filteredFromBranches.map((b) => (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => handleChooseFromBranch(b)}
                            style={{
                              width: "100%",
                              textAlign: "left",
                              padding: "10px 12px",
                              border: "none",
                              borderBottom: "1px solid var(--border)",
                              background: "transparent",
                              color: "inherit",
                              cursor: "pointer",
                            }}
                          >
                            <div style={{ fontWeight: 800 }}>{branchLabel(b)}</div>
                            <div style={{ fontSize: 12, opacity: 0.8 }}>
                              {toStr(b.area) || "No area"}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div
                    className="field"
                    style={{ position: "relative" }}
                    ref={toBranchBoxRef}
                  >
                    <label>Transfer To</label>
                    <input
                      type="text"
                      value={toBranchQuery}
                      placeholder="Search transfer branch..."
                      onChange={(e) => {
                      setToBranchQuery(e.target.value);
                      setToBranchId("");
                      setShowToBranchResults(true);
                    }}
                      onFocus={() => setShowToBranchResults(true)}
                    />

                    {showToBranchResults && (
                      <div
                        style={{
                          position: "absolute",
                          left: 0,
                          right: 0,
                          top: "100%",
                          marginTop: 6,
                          maxHeight: 220,
                          overflowY: "auto",
                          background: "var(--card, #0f172a)",
                          border: "1px solid var(--border)",
                          borderRadius: 12,
                          zIndex: 25,
                        }}
                      >
                        {filteredToBranches.map((b) => (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => handleChooseToBranch(b)}
                            style={{
                              width: "100%",
                              textAlign: "left",
                              padding: "10px 12px",
                              border: "none",
                              borderBottom: "1px solid var(--border)",
                              background: "transparent",
                              color: "inherit",
                              cursor: "pointer",
                            }}
                          >
                            <div style={{ fontWeight: 800 }}>{branchLabel(b)}</div>
                            <div style={{ fontSize: 12, opacity: 0.8 }}>
                              Division: {toStr(b.division) || "-"} • Area:{" "}
                              {toStr(b.area) || "-"} • Region:{" "}
                              {toStr(b.region) || "-"}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="field">
                    <label>Division</label>
                    <input
                      list="division-options"
                      value={division}
                      onChange={(e) => setDivision(e.target.value)}
                      placeholder="Search or select division"
                    />
                    <datalist id="division-options">
                      {[...new Set(branches.map((b) => toStr(b.division)).filter(Boolean))].map((x) => (
                        <option key={x} value={x} />
                      ))}
                    </datalist>
                  </div>

                  <div className="field">
                    <label>Area</label>
                    <input
                      list="area-options"
                      value={area}
                      onChange={(e) => setArea(e.target.value)}
                      placeholder="Search or select area"
                    />
                    <datalist id="area-options">
                      {[...new Set(branches.map((b) => toStr(b.area)).filter(Boolean))].map((x) => (
                        <option key={x} value={x} />
                      ))}
                    </datalist>
                  </div>

                  <div className="field">
                    <label>Region</label>
                    <input
                      list="region-options"
                      value={region}
                      onChange={(e) => setRegion(e.target.value)}
                      placeholder="Search or select region"
                    />
                    <datalist id="region-options">
                      {[...new Set(branches.map((b) => toStr(b.region)).filter(Boolean))].map((x) => (
                        <option key={x} value={x} />
                      ))}
                    </datalist>
                  </div>

                  <div className="field">
                    <label>Department</label>
                    <input
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      placeholder="Department"
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
                </div>

                {selectedEmployee ? (
                  <div className="order-card" style={{ marginTop: 14 }}>
                    <div className="order-card-head">
                      <div>
                        <div className="order-card-title">Details of Account</div>
                        <div className="order-card-meta">
                          Auto-filled from selected staff record.
                        </div>
                      </div>
                    </div>

                    <div
                      className="form-grid account-details-grid"
                      style={{ padding: 12 }}
                    >
                      {accountRows.map((row) => (
                        <div className="field" key={row.label}>
                          <label>{row.label}</label>
                          <input value={money(row.value)} readOnly />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {error ? (
                  <div
                    style={{
                      marginTop: 10,
                      color: "#ef4444",
                      fontWeight: 800,
                    }}
                  >
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

      {showViewModal && selectedOrder && (
        <div className="modal-overlay" onMouseDown={closeViewModal}>
          <div
            className="modal saas-modal"
            onMouseDown={(e) => e.stopPropagation()}
            style={{ maxWidth: 950 }}
          >
            <div className="modal-head">
              <div>
                <h3 className="modal-title">Transfer Order Details</h3>
                <p className="modal-subtitle">
                  {selectedOrder.order_no} — {selectedOrder.status}
                </p>
              </div>

              <button className="modal-x" onClick={closeViewModal} type="button">
                ✕
              </button>
            </div>

            <div className="form-grid">
              <div className="field">
                <label>Employee</label>
                <input value={toStr(selectedOrder.employee_name)} readOnly />
              </div>

              <div className="field">
                <label>Status</label>
                <input value={toStr(selectedOrder.status)} readOnly />
              </div>

              <div className="field">
                <label>From</label>
                <input
                  value={`${toStr(selectedOrder.prev_branch_code)} - ${toStr(
                    selectedOrder.prev_branch_name
                  )}`}
                  readOnly
                />
              </div>

              <div className="field">
                <label>To</label>
                <input
                  value={`${toStr(selectedOrder.to_branch_code)} - ${toStr(
                    selectedOrder.to_branch_name
                  )}`}
                  readOnly
                />
              </div>

              <div className="field">
                <label>Division</label>
                <input value={toStr(selectedOrder.division)} readOnly />
              </div>

              <div className="field">
                <label>Area</label>
                <input value={toStr(selectedOrder.area)} readOnly />
              </div>

              <div className="field">
                <label>Region</label>
                <input value={toStr(selectedOrder.region)} readOnly />
              </div>

              <div className="field">
                <label>Effective Date</label>
                <input value={fmtDate(selectedOrder.effective_date)} readOnly />
              </div>

              <div className="field full">
                <label>Details</label>
                <textarea value={toStr(selectedOrder.details)} readOnly rows={3} />
              </div>
            </div>

            <div className="order-card" style={{ marginTop: 14 }}>
              <div className="order-card-head">
                <div className="order-card-title">Transfer File</div>
              </div>

              <div style={{ padding: 12 }}>
                {loadingFiles ? (
                  <div className="empty-state">Loading files…</div>
                ) : viewFiles.length === 0 ? (
                  <div className="empty-state">No final file uploaded yet.</div>
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
                        {viewFiles.map((f) => (
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

                {isUploadStage(selectedOrder.status) && canHRUpload ? (
                  <div style={{ marginTop: 14 }}>
                    <div className="field">
                      <label>
                        {isAdmin ? "Final Approved File" : "HR Final Approved File"}
                      </label>
                      <input
                        type="file"
                        onChange={(e) => setHrFinalFile(e.target.files?.[0] || null)}
                      />
                    </div>

                    <button
                      className="btn-primary"
                      type="button"
                      style={{ marginTop: 10 }}
                      onClick={uploadHRFinalFile}
                      disabled={actionLoading}
                    >
                      {actionLoading
                        ? "Uploading..."
                        : isAdmin
                        ? "Upload Final File & Bypass Approve"
                        : "Upload Final File & Approve"}
                    </button>
                  </div>
                ) : null}

                {filesError ? (
                  <div
                    style={{
                      marginTop: 10,
                      color: "#ef4444",
                      fontWeight: 800,
                    }}
                  >
                    {filesError}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="modal-buttons">
              <button
                className="btn-secondary"
                type="button"
                onClick={closeViewModal}
              >
                Close
              </button>

              {isUploadStage(selectedOrder.status) && canReject ? (
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={() => rejectOrder(selectedOrder)}
                  disabled={actionLoading}
                >
                  Reject
                </button>
              ) : null}

              {selectedOrder.status === "Approved" && (isAdmin || isHRDepartment) ? (
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={() => voidOrder(selectedOrder)}
                >
                  Void
                </button>
              ) : null}

              {["Rejected", "Void"].includes(selectedOrder.status) && isAdmin ? (
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={() => deleteOrder(selectedOrder)}
                >
                  Delete
                </button>
              ) : null}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}