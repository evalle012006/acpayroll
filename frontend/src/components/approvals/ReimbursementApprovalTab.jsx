import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import api from "../../api/axiosClient";

const WAITING_FINAL_FILE = "Waiting Final File Upload";

const REQUEST_TYPE_OPTIONS = [
  "Transportation Reimbursement",
  "Gas Reimbursement",
  "Maintenance Reimbursement",
  "Food Allocation Reimbursement",
  "Other Reimbursement",
];

const readUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
};

const toNum = (v) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const toStr = (v) => String(v ?? "").trim();
const norm = (v) => toStr(v).toLowerCase();

const fmtMoney = (v) =>
  Number(toNum(v)).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtDate = (v) =>
  v ? String(v).slice(0, 10) : "-";

const STAGE_LABELS = {
  "branch manager": "Branch Manager",
  "area manager": "Area Manager",
  "regional manager": "Regional Manager",
  "assistant vice president": "Assistant Vice President",
  "vice president": "Vice President",
  "senior vice president": "Senior Vice President",
  approved: "Approved",
  rejected: "Rejected",
  void: "Void",
  [WAITING_FINAL_FILE.toLowerCase()]: WAITING_FINAL_FILE,
};

const parseChain = (item) => {
  try {
    if (Array.isArray(item?.approval_chain)) {
      return item.approval_chain.map(norm);
    }

    if (item?.approval_chain) {
      const parsed = JSON.parse(item.approval_chain);

      if (Array.isArray(parsed)) {
        return parsed.map(norm);
      }
    }
  } catch {}

  return [];
};

const canBypass = (role) =>
  ["admin", "it"].includes(norm(role));

const canFinalUpload = (role) =>
  ["admin", "it", "accounting", "hr"].includes(norm(role));

const canVoid = (role) =>
  ["admin", "it"].includes(norm(role));

const getCurrentStage = (item) => {
  const explicit = norm(item?.approval_stage);

  if (
    explicit === "approved" ||
    explicit === "void" ||
    explicit === "rejected"
  ) {
    return explicit;
  }

  if (explicit === norm(WAITING_FINAL_FILE)) {
    return WAITING_FINAL_FILE;
  }

  const chain = parseChain(item);

  if (chain.includes(explicit)) {
    return explicit;
  }

  return chain[0] || "";
};

const canApprove = (item, role) => {
  const status = norm(item?.status);

  if (
    status === "approved" ||
    status === "rejected" ||
    status === "void" ||
    status === norm(WAITING_FINAL_FILE)
  ) {
    return false;
  }

  if (canBypass(role)) {
    return true;
  }

  return getCurrentStage(item) === norm(role);
};

const canUploadFinal = (item, role) =>
  norm(item?.status) === norm(WAITING_FINAL_FILE) &&
  canFinalUpload(role);

const badgeClass = (status) => {
  const s = norm(status);

  if (s === "approved") {
    return "badge badge-approved";
  }

  if (
    s === "rejected" ||
    s === "void"
  ) {
    return "badge badge-rejected";
  }

  return "badge badge-pending";
};

export default function ReimbursementApprovalTab() {
  const user = useMemo(() => readUser(), []);

  const role = norm(user?.role);

  const canCreate =
    [
      "admin",
      "it",
      "accounting",
      "hr",
      "area manager",
      "regional manager",
      "assistant vice president",
      "vice president",
      "senior vice president",
    ].includes(role);

  const [rows, setRows] = useState([]);
  const [staffList, setStaffList] = useState([]);

  const [loading, setLoading] = useState(false);

  const [showCreate, setShowCreate] =
    useState(false);

  const [showTable, setShowTable] =
    useState(false);

  const [showView, setShowView] =
    useState(false);

  const [selected, setSelected] =
    useState(null);

  const [processingId, setProcessingId] =
    useState("");

  const [approvalFiles, setApprovalFiles] =
    useState({});

  const [finalFiles, setFinalFiles] =
    useState({});

  const [selectedApprovalFile,
    setSelectedApprovalFile] =
    useState(null);

  const [selectedFinalFile,
    setSelectedFinalFile] =
    useState(null);

  const [search,
    setSearch] =
    useState("");

  const [appliedSearch,
    setAppliedSearch] =
    useState("");

  const [page,
    setPage] =
    useState(1);

  const [pageSize,
    setPageSize] =
    useState(25);

  const employeeBoxRef =
    useRef(null);

  const [
    employeeSearch,
    setEmployeeSearch,
  ] = useState("");

  const [
    showEmployeeDropdown,
    setShowEmployeeDropdown,
  ] = useState(false);

  const [form,
    setForm] =
    useState({
      employee_id: "",
      employee_no: "",
      staff_name: "",
      amount: "",
      request_date: "",
      request_type: "",
      description: "",
      attachment: null,
    });

  const logout =
    useCallback(() => {
      localStorage.removeItem("token");
      localStorage.removeItem("user");

      window.location.href =
        "/login";
    }, []);

  const loadRows =
    useCallback(async () => {
      try {
        setLoading(true);

        const res =
          await api.get(
            "/reimbursement-requests"
          );

        setRows(
          Array.isArray(
            res.data
          )
            ? res.data
            : []
        );
      } catch (err) {
        if (
          err?.response?.status ===
          401
        ) {
          logout();
        }

        alert(
          err?.response?.data
            ?.message ||
            "Failed to load reimbursement."
        );
      } finally {
        setLoading(false);
      }
    }, [logout]);

  const loadStaff =
    useCallback(async () => {
      try {
        const res =
          await api.get(
            "/staff"
          );

        setStaffList(
          Array.isArray(
            res.data
          )
            ? res.data
            : []
        );
      } catch {
        setStaffList([]);
      }
    }, []);

  useEffect(() => {
    loadRows();
    loadStaff();
  }, [loadRows, loadStaff]);

  const filteredRows =
    useMemo(() => {
      const q =
        norm(
          appliedSearch
        );

      if (!q)
        return rows;

      return rows.filter(
        (r) =>
          [
            r.staff_name,
            r.employee_no,
            r.request_type,
            r.status,
            r.amount,
            r.approval_stage,
          ]
            .join(" ")
            .toLowerCase()
            .includes(q)
      );
    }, [
      rows,
      appliedSearch,
    ]);

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        filteredRows.length /
          pageSize
      )
    );

  const pagedRows =
    useMemo(() => {
      const start =
        (page - 1) *
        pageSize;

      return filteredRows.slice(
        start,
        start +
          pageSize
      );
    }, [
      filteredRows,
      page,
      pageSize,
    ]);

      useEffect(() => {
    setPage(1);
  }, [appliedSearch, pageSize]);

  useEffect(() => {
    const isOpen = showCreate || showTable || showView;

    if (!isOpen) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        setShowCreate(false);
        setShowTable(false);
        setShowView(false);
        setShowEmployeeDropdown(false);
      }
    };

    const onMouseDown = (e) => {
      if (
        employeeBoxRef.current &&
        !employeeBoxRef.current.contains(e.target)
      ) {
        setShowEmployeeDropdown(false);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onMouseDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onMouseDown);
      document.body.style.overflow = "";
    };
  }, [showCreate, showTable, showView]);

  const buildStaffDisplay = useCallback((s) => {
    if (!s) return "-";

    const built =
      s.fullname ||
      `${s.last_name || ""}${s.last_name && s.first_name ? ", " : ""}${
        s.first_name || ""
      }${s.middle_name ? ` ${s.middle_name}` : ""}`
        .replace(/\s+/g, " ")
        .trim();

    return built || "-";
  }, []);

  const searchableStaff = useMemo(() => {
    return staffList.map((s) => {
      const display = buildStaffDisplay(s);

      const searchBlob = [
        s.id,
        s.employee_no,
        s.fullname,
        s.first_name,
        s.last_name,
        s.middle_name,
        display,
        s.position,
        s.department,
        s.area,
        s.region,
        s.division,
        s.branch_code,
        s.branch_name,
      ]
        .map(toStr)
        .join(" ")
        .toLowerCase();

      return {
        ...s,
        _display: display,
        _searchBlob: searchBlob,
      };
    });
  }, [staffList, buildStaffDisplay]);

  const filteredEmployees = useMemo(() => {
    const q = norm(employeeSearch);

    if (!q) return searchableStaff.slice(0, 20);

    return searchableStaff
      .filter((s) => s._searchBlob.includes(q))
      .slice(0, 20);
  }, [searchableStaff, employeeSearch]);

  const handleEmployeeSelect = (employeeId) => {
    const emp = searchableStaff.find(
      (s) => String(s.id) === String(employeeId)
    );

    const display = buildStaffDisplay(emp);

    setForm((prev) => ({
      ...prev,
      employee_id: String(employeeId || ""),
      employee_no: emp?.employee_no || "",
      staff_name: display || "-",
    }));

    setEmployeeSearch(
      emp ? `${emp.employee_no ? `${emp.employee_no} - ` : ""}${display}` : ""
    );

    setShowEmployeeDropdown(false);
  };

  const resetForm = () => {
    setForm({
      employee_id: "",
      employee_no: "",
      staff_name: "",
      amount: "",
      request_date: "",
      request_type: "",
      description: "",
      attachment: null,
    });

    setEmployeeSearch("");
    setShowEmployeeDropdown(false);
  };

  const openView = (item) => {
    setSelected(item);
    setSelectedApprovalFile(null);
    setSelectedFinalFile(null);
    setShowView(true);
  };

  const closeView = () => {
    setSelected(null);
    setSelectedApprovalFile(null);
    setSelectedFinalFile(null);
    setShowView(false);
  };

  const pendingCount = useMemo(
    () => rows.filter((x) => norm(x.status) === "pending").length,
    [rows]
  );

  const finalUploadCount = useMemo(
    () =>
      rows.filter((x) => norm(x.status) === norm(WAITING_FINAL_FILE)).length,
    [rows]
  );

  const renderChainSummary = (item) => {
    const chain = parseChain(item);

    if (!chain.length) return "-";

    return chain
      .map((stage) => `${STAGE_LABELS[stage] || stage}: ${stage === getCurrentStage(item) ? "Current" : "Pending"}`)
      .join(" | ");
  };

  const handleCreate = async (e) => {
    e.preventDefault();

    if (!form.employee_id) return alert("Please select employee.");
    if (!form.amount || Number(form.amount) <= 0) {
      return alert("Amount is required.");
    }
    if (!form.request_date) return alert("Request date is required.");
    if (!form.request_type) return alert("Request type is required.");
    if (!toStr(form.description)) return alert("Description is required.");
    if (!form.attachment) return alert("Please attach reimbursement file.");

    try {
      setProcessingId("create-reimbursement");

      const fd = new FormData();

      fd.append("employee_id", form.employee_id);
      fd.append("employee_no", form.employee_no);
      fd.append("staff_name", form.staff_name);
      fd.append("description", form.description);
      fd.append("amount", toNum(form.amount));
      fd.append("request_date", form.request_date || "");
      fd.append("request_type", form.request_type || "");
      fd.append("attachment", form.attachment);

      await api.post("/reimbursement-requests", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      alert("Reimbursement request submitted successfully.");

      resetForm();
      setShowCreate(false);

      await loadRows();
    } catch (err) {
      if (err?.response?.status === 401) return logout();

      alert(
        err?.response?.data?.message ||
          "Failed to submit reimbursement request."
      );
    } finally {
      setProcessingId("");
    }
  };

  const downloadLatestFile = async (id, fallbackName = "") => {
    try {
      const res = await api.get(
        `/reimbursement-requests/${id}/download/latest`,
        {
          responseType: "blob",
        }
      );

      const blob = new Blob([res.data]);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");

      a.href = url;
      a.download = fallbackName || `reimbursement-${id}`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to download file.");
    }
  };

  const updateStatus = async (item, action) => {
    const id = item?.id;

    if (!id) return alert("Reimbursement record has no valid id.");

    if (action === "approve" && !approvalFiles[id]) {
      return alert("Please upload the signed reimbursement file before approving.");
    }

    if (action === "void" && !canVoid(role)) {
      return alert("Only Admin/IT can void reimbursement.");
    }

    let rejectionReason = "";

    if (action === "reject") {
      rejectionReason = window.prompt("Reason for rejection?");

      if (!rejectionReason || !rejectionReason.trim()) {
        return alert("Rejection reason is required.");
      }
    }

    const confirmMessage =
      action === "approve"
        ? "Approve and submit uploaded signed file to the next approver?"
        : action === "void"
        ? "Void this reimbursement request?"
        : "Reject this reimbursement request?";

    if (!window.confirm(confirmMessage)) return;

    try {
      setProcessingId(`reimbursement-${id}-${action}`);

      const fd = new FormData();
      fd.append("action", action);

      if (action === "approve") {
        fd.append("attachment", approvalFiles[id]);
      }

      if (action === "reject") {
        fd.append("rejection_reason", rejectionReason);
      }

      await api.put(`/reimbursement-requests/${id}`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      alert(
        action === "approve"
          ? "Reimbursement approved and signed file uploaded."
          : action === "void"
          ? "Reimbursement voided successfully."
          : "Reimbursement rejected successfully."
      );

      setApprovalFiles((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });

      setSelectedApprovalFile(null);

      if (selected?.id === id) {
        setSelected(null);
        setShowView(false);
      }

      await loadRows();
    } catch (err) {
      if (err?.response?.status === 401) return logout();

      alert(
        err?.response?.data?.message ||
          "Failed to update reimbursement request."
      );
    } finally {
      setProcessingId("");
    }
  };

  const uploadFinalFile = async (item) => {
    const id = item?.id;

    if (!id) return alert("Reimbursement record has no valid id.");

    if (!finalFiles[id]) {
      return alert("Please upload the final approved file first.");
    }

    if (!canFinalUpload(role)) {
      return alert("Only Admin/IT/Accounting/HR can upload final file.");
    }

    if (
      !window.confirm(
        "Upload final file and fully approve this reimbursement?"
      )
    ) {
      return;
    }

    try {
      setProcessingId(`reimbursement-${id}-final`);

      const fd = new FormData();

      fd.append("attachment", finalFiles[id]);

      await api.post(`/reimbursement-requests/${id}/approved-file`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      alert("Final approved file uploaded. Reimbursement fully approved.");

      setFinalFiles((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });

      setSelectedFinalFile(null);

      if (selected?.id === id) {
        setSelected(null);
        setShowView(false);
      }

      await loadRows();
    } catch (err) {
      if (err?.response?.status === 401) return logout();

      alert(
        err?.response?.data?.message ||
          "Failed to upload final approved file."
      );
    } finally {
      setProcessingId("");
    }
  };

    return (
    <>
      <div className="approval-grid">
        <div className="approval-card">
          <div className="approval-card-head">
            <div>
              <div className="approval-card-title">Reimbursement Requests</div>
              <div className="approval-card-meta">
                Pending: <span className="pill">{pendingCount}</span>{" "}
                Final Upload: <span className="pill">{finalUploadCount}</span>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {canCreate && (
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={() => setShowCreate(true)}
                >
                  + Reimbursement Request
                </button>
              )}

              <button
                className="btn-secondary"
                type="button"
                onClick={loadRows}
              >
                Refresh
              </button>

              <button
                className="btn-primary"
                type="button"
                onClick={() => setShowTable(true)}
              >
                View
              </button>
            </div>
          </div>

          <div className="approval-card-body">
            <div className="mini">
              {loading
                ? "Loading reimbursement requests..."
                : "Open View for full details, file download, approval upload, reject, void, and final upload."}
            </div>
          </div>
        </div>
      </div>

      {canCreate && showCreate && (
        <div
          className="modal-overlay"
          onMouseDown={(e) =>
            e.target.classList.contains("modal-overlay") && setShowCreate(false)
          }
        >
          <div className="modal saas-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h3 className="modal-title">Add Reimbursement Request</h3>
                <p className="modal-subtitle">
                  Upload the initial reimbursement file for approval.
                </p>
              </div>

              <button
                className="modal-x"
                type="button"
                onClick={() => setShowCreate(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="modal-form">
              <div className="modal-grid">
                <div
                  className="form-group full approval-search-select"
                  ref={employeeBoxRef}
                >
                  <label>Employee</label>

                  <input
                    type="text"
                    value={employeeSearch}
                    onChange={(e) => {
                      setEmployeeSearch(e.target.value);
                      setShowEmployeeDropdown(true);
                      setForm((p) => ({
                        ...p,
                        employee_id: "",
                        employee_no: "",
                        staff_name: "",
                      }));
                    }}
                    onFocus={() => setShowEmployeeDropdown(true)}
                    placeholder="Search employee no or name..."
                    required={!form.employee_id}
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
                            onClick={() => handleEmployeeSelect(s.id)}
                            className="approval-search-item"
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
                  <label>Staff Name</label>
                  <input value={form.staff_name} readOnly placeholder="Auto-filled" />
                </div>

                <div className="form-group">
                  <label>Amount</label>
                  <input
                    type="number"
                    value={form.amount}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, amount: e.target.value }))
                    }
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Request Date</label>
                  <input
                    type="date"
                    value={form.request_date}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, request_date: e.target.value }))
                    }
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Request Type</label>
                  <select
                    value={form.request_type}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, request_type: e.target.value }))
                    }
                    required
                  >
                    <option value="">Select Request Type</option>
                    {REQUEST_TYPE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group full">
                  <label>Initial Reimbursement File</label>
                  <input
                    type="file"
                    required
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        attachment: e.target.files?.[0] || null,
                      }))
                    }
                  />
                </div>

                <div className="form-group full">
                  <label>Description</label>
                  <textarea
                    value={form.description}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, description: e.target.value }))
                    }
                    required
                  />
                </div>
              </div>

              <div className="modal-buttons">
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={() => setShowCreate(false)}
                >
                  Cancel
                </button>

                <button
                  className="btn-primary"
                  type="submit"
                  disabled={processingId === "create-reimbursement"}
                >
                  {processingId === "create-reimbursement"
                    ? "Submitting..."
                    : "Submit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showTable && (
        <div
          className="modal-overlay"
          onMouseDown={(e) =>
            e.target.classList.contains("modal-overlay") && setShowTable(false)
          }
        >
          <div className="modal saas-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h3 className="modal-title">Reimbursement Requests</h3>
                <p className="modal-subtitle">
                  Use View to download, upload signed files, approve, reject, void, or final upload.
                </p>
              </div>

              <button
                className="modal-x"
                type="button"
                onClick={() => setShowTable(false)}
              >
                ✕
              </button>
            </div>

            <div className="table-card">
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
                  className="order-search-input"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && setAppliedSearch(search)}
                  placeholder="Search employee, status, stage, amount..."
                  style={{ minWidth: 280 }}
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

                <select
                  className="order-search-input"
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  style={{ width: 110 }}
                >
                  {[25, 50, 75, 100].map((n) => (
                    <option key={n} value={n}>
                      {n} / page
                    </option>
                  ))}
                </select>
              </div>

              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Employee</th>
                      <th>Type</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Current Stage</th>
                      <th>Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="empty-state">
                          Loading...
                        </td>
                      </tr>
                    ) : pagedRows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="empty-state">
                          No reimbursement requests found.
                        </td>
                      </tr>
                    ) : (
                      pagedRows.map((item) => {
                        const currentStage = getCurrentStage(item);

                        return (
                          <tr key={item.id}>
                            <td>{item.id ?? "-"}</td>

                            <td className="td-strong">
                              {item.staff_name || "-"}
                              <div style={{ fontSize: 12, opacity: 0.75 }}>
                                Emp No: {item.employee_no || "-"}
                              </div>
                            </td>

                            <td>{item.request_type || "-"}</td>
                            <td>₱ {fmtMoney(item.amount)}</td>

                            <td>
                              <span className={badgeClass(item.status)}>
                                {item.status || "Pending"}
                              </span>
                            </td>

                            <td>
                              {STAGE_LABELS[norm(currentStage)] ||
                                currentStage ||
                                "-"}
                            </td>

                            <td>
                              <div className="row-actions loan-row-actions">
                                <button
                                  className="btn-secondary"
                                  type="button"
                                  title="View details and actions"
                                  onClick={() => openView(item)}
                                >
                                  👁 View
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  marginTop: 12,
                  flexWrap: "wrap",
                }}
              >
                <div className="mini">
                  Page {page} of {totalPages} • {filteredRows.length} records
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    className="btn-secondary"
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Prev
                  </button>

                  <button
                    className="btn-secondary"
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>

            <div className="modal-buttons">
              <button
                className="btn-secondary"
                type="button"
                onClick={() => setShowTable(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showView && selected && (
        <div
          className="modal-overlay"
          onMouseDown={(e) =>
            e.target.classList.contains("modal-overlay") && closeView()
          }
        >
          <div className="modal saas-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h3 className="modal-title">Reimbursement Request Details</h3>
                <p className="modal-subtitle">{selected.staff_name || "-"}</p>
              </div>

              <button className="modal-x" type="button" onClick={closeView}>
                ✕
              </button>
            </div>

            <div className="modal-form">
              <div className="modal-grid">
                <div className="form-group">
                  <label>ID</label>
                  <input value={selected.id ?? "-"} readOnly />
                </div>

                <div className="form-group">
                  <label>Employee No</label>
                  <input value={selected.employee_no || "-"} readOnly />
                </div>

                <div className="form-group">
                  <label>Staff Name</label>
                  <input value={selected.staff_name || "-"} readOnly />
                </div>

                <div className="form-group">
                  <label>Request Type</label>
                  <input value={selected.request_type || "-"} readOnly />
                </div>

                <div className="form-group">
                  <label>Amount</label>
                  <input value={`₱ ${fmtMoney(selected.amount)}`} readOnly />
                </div>

                <div className="form-group">
                  <label>Request Date</label>
                  <input value={fmtDate(selected.request_date)} readOnly />
                </div>

                <div className="form-group">
                  <label>Reimbursement Date</label>
                  <input value={fmtDate(selected.reimbursement_date)} readOnly />
                </div>

                <div className="form-group">
                  <label>Status</label>
                  <input value={selected.status || "-"} readOnly />
                </div>

                <div className="form-group">
                  <label>Current Approval Stage</label>
                  <input
                    value={
                      STAGE_LABELS[norm(getCurrentStage(selected))] ||
                      getCurrentStage(selected) ||
                      "-"
                    }
                    readOnly
                  />
                </div>

                <div className="form-group full">
                  <label>Approval Chain</label>
                  <textarea value={renderChainSummary(selected)} readOnly />
                </div>

                <div className="form-group full">
                  <label>Latest File</label>
                  {selected.attachment_path ? (
                    <button
                      className="btn-secondary"
                      type="button"
                      onClick={() =>
                        downloadLatestFile(selected.id, selected.attachment_name || "")
                      }
                    >
                      Download Latest File
                    </button>
                  ) : (
                    <input value="No attachment" readOnly />
                  )}
                </div>

                {canApprove(selected, role) ? (
                  <div className="form-group full">
                    <label>Upload Signed File Before Approving</label>

                    <label className="loan-upload-pill" style={{ width: "fit-content" }}>
                      <input
                        type="file"
                        hidden
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          setSelectedApprovalFile(file);
                          setApprovalFiles((prev) => ({
                            ...prev,
                            [selected.id]: file,
                          }));
                        }}
                      />
                      📎 {selectedApprovalFile?.name ? "Change File" : "Upload File"}
                    </label>

                    {selectedApprovalFile?.name ? (
                      <span className="loan-file-name" title={selectedApprovalFile.name}>
                        {selectedApprovalFile.name}
                      </span>
                    ) : null}

                    <small style={{ opacity: 0.75, display: "block", marginTop: 8 }}>
                      This file replaces the previous file. The next approver downloads this new file.
                    </small>
                  </div>
                ) : null}

                {canUploadFinal(selected, role) ? (
                  <div className="form-group full">
                    <label>Upload Final Approved File</label>

                    <label className="loan-upload-pill" style={{ width: "fit-content" }}>
                      <input
                        type="file"
                        hidden
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          setSelectedFinalFile(file);
                          setFinalFiles((prev) => ({
                            ...prev,
                            [selected.id]: file,
                          }));
                        }}
                      />
                      📎{" "}
                      {selectedFinalFile?.name
                        ? "Change Final File"
                        : "Upload Final File"}
                    </label>

                    {selectedFinalFile?.name ? (
                      <span className="loan-file-name" title={selectedFinalFile.name}>
                        {selectedFinalFile.name}
                      </span>
                    ) : null}

                    <small style={{ opacity: 0.75, display: "block", marginTop: 8 }}>
                      Admin/IT/Accounting/HR final upload will fully approve this reimbursement.
                    </small>
                  </div>
                ) : null}

                <div className="form-group full">
                  <label>Description</label>
                  <textarea value={selected.description || "-"} readOnly />
                </div>

                {selected.rejection_reason ? (
                  <div className="form-group full">
                    <label>Rejection Reason</label>
                    <textarea value={selected.rejection_reason} readOnly />
                  </div>
                ) : null}
              </div>

              <div className="modal-buttons">
                {canApprove(selected, role) ? (
                  <>
                    <button
                      className="btn-success"
                      type="button"
                      disabled={
                        processingId === `reimbursement-${selected.id}-approve`
                      }
                      onClick={() => updateStatus(selected, "approve")}
                    >
                      {processingId === `reimbursement-${selected.id}-approve`
                        ? "Approving..."
                        : canBypass(role)
                        ? "Bypass Approve"
                        : "Upload + Approve"}
                    </button>

                    <button
                      className="btn-danger"
                      type="button"
                      disabled={
                        processingId === `reimbursement-${selected.id}-reject`
                      }
                      onClick={() => updateStatus(selected, "reject")}
                    >
                      {processingId === `reimbursement-${selected.id}-reject`
                        ? "Rejecting..."
                        : "Reject"}
                    </button>
                  </>
                ) : null}

                {canUploadFinal(selected, role) ? (
                  <button
                    className="btn-success"
                    type="button"
                    disabled={
                      processingId === `reimbursement-${selected.id}-final`
                    }
                    onClick={() => uploadFinalFile(selected)}
                  >
                    {processingId === `reimbursement-${selected.id}-final`
                      ? "Uploading..."
                      : "Final Upload + Approve"}
                  </button>
                ) : null}

                {canVoid(role) &&
                !["void", "rejected"].includes(norm(selected.status)) ? (
                  <button
                    className="btn-danger"
                    type="button"
                    disabled={processingId === `reimbursement-${selected.id}-void`}
                    onClick={() => updateStatus(selected, "void")}
                  >
                    {processingId === `reimbursement-${selected.id}-void`
                      ? "Voiding..."
                      : "Void"}
                  </button>
                ) : null}

                <button className="btn-secondary" type="button" onClick={closeView}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}