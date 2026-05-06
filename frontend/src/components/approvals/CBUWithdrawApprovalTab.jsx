import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "../../api/axiosClient";

const readUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
};

const toStr = (v) => String(v ?? "").trim();
const norm = (v) => toStr(v).toLowerCase();

const money = (v) =>
  Number(v || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtDate = (d) => (d ? String(d).slice(0, 10) : "-");
const todayDate = () => new Date().toISOString().slice(0, 10);

const staffName = (x) =>
  x?.staff_name ||
  x?.fullname ||
  x?.employee_name ||
  `${x?.last_name || ""}${x?.last_name && x?.first_name ? ", " : ""}${
    x?.first_name || ""
  }${x?.middle_name ? ` ${x.middle_name}` : ""}`
    .replace(/\s+/g, " ")
    .trim() ||
  "-";

const stageLabel = (stage) => {
  const s = norm(stage);

  if (s === "branch manager") return "Branch Manager";
  if (s === "area manager") return "Area Manager";
  if (s === "regional manager") return "Regional Manager";
  if (s === "assistant vice president") return "Assistant Vice President";
  if (s === "vice president") return "Vice President";
  if (s === "svp") return "Senior Vice President";
  if (s === "senior vice president") return "Senior Vice President";
  if (s === "final") return "HR/Admin/Accounting";
  if (s === "approved") return "Approved";

  return stage || "Pending";
};

const canApproveStage = (role, stage) => {
  const r = norm(role);
  const s = norm(stage);

  if (s === "branch manager") return r === "branch manager";
  if (s === "area manager") return r === "area manager";
  if (s === "regional manager") return r === "regional manager";
  if (s === "assistant vice president") return r === "assistant vice president";
  if (s === "vice president") return r === "vice president";
  if (s === "svp" || s === "senior vice president") return r === "senior vice president";
  if (s === "final") return ["admin", "hr", "accounting"].includes(r);

  return false;
};

const chainText = (x) => {
  const mainOffice = ["svp", "senior vice president", "final"].includes(
    norm(x?.approval_stage)
  );

  if (mainOffice) {
    return "Senior Vice President → HR/Admin/Accounting";
  }

  return "Branch Manager → Area Manager → Regional Manager → Assistant Vice President → Vice President";
};

export default function CBUWithdrawApprovalTab() {
  const user = useMemo(() => readUser(), []);
  const role = norm(user?.role);

  const canCreate = ["admin", "hr", "accounting"].includes(role);
  const canUploadApprovedFile = ["admin", "hr", "accounting"].includes(role);

  const [rows, setRows] = useState([]);
  const [staffList, setStaffList] = useState([]);

  const [showModal, setShowModal] = useState(false);
  const [showView, setShowView] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [processingId, setProcessingId] = useState("");
  const [uploadingId, setUploadingId] = useState("");

  const [employeeSearch, setEmployeeSearch] = useState("");
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
  const employeeBoxRef = useRef(null);

  const [form, setForm] = useState({
    employee_id: "",
    employee_no: "",
    staff_name: "",
    branch: "",
    position: "",
    department: "",
    cbu_balance: "",
    date_created: todayDate(),
    disbursement_date: "",
    amount: "",
    reason: "",
    attachment: null,
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/cbu-withdrawals");
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to load CBU withdrawals.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadStaff = useCallback(async () => {
    try {
      const res = await api.get("/staff");
      setStaffList(Array.isArray(res.data) ? res.data : []);
    } catch {
      setStaffList([]);
    }
  }, []);

  useEffect(() => {
    loadData();
    loadStaff();
  }, [loadData, loadStaff]);

  useEffect(() => {
    if (!showCreate && !showView && !showModal) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        setShowCreate(false);
        setShowView(false);
        setShowModal(false);
        setShowEmployeeDropdown(false);
      }
    };

    const onMouseDown = (e) => {
      if (employeeBoxRef.current && !employeeBoxRef.current.contains(e.target)) {
        setShowEmployeeDropdown(false);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onMouseDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, [showCreate, showView, showModal]);

  const searchableStaff = useMemo(() => {
    return staffList.map((s) => {
      const display = staffName(s);
      const branch =
        s.branch_name ||
        (s.branch_code ? `${s.branch_code} - ${s.branch_name || ""}` : "") ||
        s.branch ||
        "";

      const searchBlob = [
        s.id,
        s.employee_no,
        s.fullname,
        s.first_name,
        s.middle_name,
        s.last_name,
        display,
        s.position,
        s.department,
        s.branch_code,
        s.branch_name,
        s.branch,
      ]
        .map(toStr)
        .join(" ")
        .toLowerCase();

      return {
        ...s,
        _display: display,
        _branch: branch,
        _searchBlob: searchBlob,
      };
    });
  }, [staffList]);

  const filteredEmployees = useMemo(() => {
    const q = norm(employeeSearch);
    if (!q) return searchableStaff.slice(0, 20);
    return searchableStaff.filter((s) => s._searchBlob.includes(q)).slice(0, 20);
  }, [searchableStaff, employeeSearch]);

  const resetForm = () => {
    setForm({
      employee_id: "",
      employee_no: "",
      staff_name: "",
      branch: "",
      position: "",
      department: "",
      cbu_balance: "",
      date_created: todayDate(),
      disbursement_date: "",
      amount: "",
      reason: "",
      attachment: null,
    });
    setEmployeeSearch("");
    setShowEmployeeDropdown(false);
  };

  const handleEmployeeSelect = (employeeId) => {
    const emp = searchableStaff.find((s) => String(s.id) === String(employeeId));
    const display = staffName(emp);

    setForm((prev) => ({
      ...prev,
      employee_id: String(employeeId || ""),
      employee_no: emp?.employee_no || "",
      staff_name: display || "-",
      branch: emp?._branch || emp?.branch_name || emp?.branch || "",
      position: emp?.position || "",
      department: emp?.department || "",
      cbu_balance:
        emp?.cbu_balance ??
        emp?.staff_balance_cbu ??
        emp?.current_cbu ??
        emp?.staff_cbu ??
        emp?.cbu ??
        "",
      date_created: todayDate(),
    }));

    setEmployeeSearch(
      emp ? `${emp.employee_no ? `${emp.employee_no} - ` : ""}${display}` : ""
    );
    setShowEmployeeDropdown(false);
  };

  const handleCreate = async (e) => {
    e.preventDefault();

    if (!form.employee_id) return alert("Please select employee.");
    if (!form.amount || Number(form.amount) <= 0) return alert("Amount is required.");
    if (!toStr(form.reason)) return alert("Reason is required.");

    try {
      setCreating(true);

      const fd = new FormData();
      fd.append("employee_id", form.employee_id);
      fd.append("amount", Number(form.amount));
      fd.append("reason", form.reason);
      fd.append("date_created", form.date_created || todayDate());
      fd.append("disbursement_date", form.disbursement_date || "");

      if (form.attachment) fd.append("photo", form.attachment);

      await api.post("/cbu-withdrawals", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      alert("CBU Withdraw request submitted.");
      resetForm();
      setShowCreate(false);
      await loadData();
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to submit CBU withdrawal.");
    } finally {
      setCreating(false);
    }
  };

  const updateStatus = async (item, status) => {
    if (!item?.id) return;

    let reason = "";

    if (status === "Rejected") {
      reason = window.prompt("Reason for rejection?");
      if (!reason || !reason.trim()) {
        alert("Rejection reason is required.");
        return;
      }
    }

    if (!window.confirm(`${status} this CBU withdrawal?`)) return;

    try {
      setProcessingId(`${item.id}-${status}`);

      await api.put(`/cbu-withdrawals/${item.id}`, {
        status,
        rejection_reason: reason,
        approval_stage: item.approval_stage,
      });

      await loadData();
    } catch (err) {
      alert(err?.response?.data?.message || `Failed to ${status.toLowerCase()}.`);
    } finally {
      setProcessingId("");
    }
  };

  const downloadFile = async (id, type) => {
    try {
      const res = await api.get(`/cbu-withdrawals/${id}/download/${type}`);

      if (res.data?.url) {
        window.open(res.data.url, "_blank", "noopener,noreferrer");
        return;
      }

      alert("Download URL not returned by server.");
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to download file.");
    }
  };

  const uploadApprovedFile = async (id, file) => {
    if (!id || !file) return;

    try {
      setUploadingId(String(id));

      const fd = new FormData();
      fd.append("photo", file);

      await api.post(`/cbu-withdrawals/${id}/approved-file`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      alert("Approved CBU withdrawal file uploaded.");
      await loadData();
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to upload approved file.");
    } finally {
      setUploadingId("");
    }
  };

  const badgeClass = (status) => {
    const s = norm(status);
    if (s === "approved") return "badge badge-approved";
    if (s === "rejected") return "badge badge-rejected";
    return "badge badge-pending";
  };

  const pendingCount = rows.filter((x) => norm(x.status) === "pending").length;

  const openView = (item) => {
    setSelected(item);
    setShowView(true);
  };

  const closeView = () => {
    setSelected(null);
    setShowView(false);
  };

  return (
    <>
      <div className="approval-grid">
        <div className="approval-card">
          <div className="approval-card-head">
            <div>
              <div className="approval-card-title">CBU Withdraw Requests</div>
              <div className="approval-card-meta">
                Pending: <span className="pill">{pendingCount}</span>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {canCreate && (
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={() => setShowCreate(true)}
                >
                  + Withdraw
                </button>
              )}

              <button className="btn-secondary" type="button" onClick={loadData}>
                Refresh
              </button>

              <button
                className="btn-primary"
                type="button"
                onClick={() => setShowModal(true)}
              >
                View
              </button>
            </div>
          </div>

          <div className="approval-card-body">
            <div className="mini">
              {loading
                ? "Loading CBU withdraw requests..."
                : "Review and approve or reject CBU withdraw requests."}
            </div>
          </div>
        </div>
      </div>

      {showCreate && (
        <div
          className="modal-overlay"
          onMouseDown={(e) =>
            e.target.classList.contains("modal-overlay") && setShowCreate(false)
          }
        >
          <div className="modal saas-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h3 className="modal-title">CBU Withdraw</h3>
                <p className="modal-subtitle">Submit CBU withdraw request</p>
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
                        branch: "",
                        position: "",
                        department: "",
                        cbu_balance: "",
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
                  <label>Employee Name</label>
                  <input value={form.staff_name} readOnly placeholder="Auto-filled" />
                </div>

                <div className="form-group">
                  <label>Branch</label>
                  <input value={form.branch} readOnly placeholder="Auto-filled" />
                </div>

                <div className="form-group">
                  <label>Department</label>
                  <input value={form.department} readOnly placeholder="Auto-filled" />
                </div>

                <div className="form-group">
                  <label>Position</label>
                  <input value={form.position} readOnly placeholder="Auto-filled" />
                </div>

                <div className="form-group">
                  <label>Date Created</label>
                  <input
                    type="date"
                    value={form.date_created}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, date_created: e.target.value }))
                    }
                  />
                </div>

                <div className="form-group">
                  <label>Date of Disbursement</label>
                  <input
                    type="date"
                    value={form.disbursement_date}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, disbursement_date: e.target.value }))
                    }
                  />
                </div>

                <div className="form-group">
                  <label>CBU Balance</label>
                  <input
                    value={form.cbu_balance !== "" ? `₱ ${money(form.cbu_balance)}` : ""}
                    readOnly
                    placeholder="Auto-filled"
                  />
                </div>

                <div className="form-group">
                  <label>Amount of Withdraw</label>
                  <input
                    type="number"
                    value={form.amount}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, amount: e.target.value }))
                    }
                    required
                  />
                </div>

                <div className="form-group full">
                  <label>Reason</label>
                  <textarea
                    value={form.reason}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, reason: e.target.value }))
                    }
                    required
                  />
                </div>

                <div className="form-group full">
                  <label>Request File</label>
                  <input
                    type="file"
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        attachment: e.target.files?.[0] || null,
                      }))
                    }
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

                <button className="btn-primary" type="submit" disabled={creating}>
                  {creating ? "Submitting..." : "Submit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showModal && (
        <div
          className="modal-overlay"
          onMouseDown={(e) =>
            e.target.classList.contains("modal-overlay") && setShowModal(false)
          }
        >
          <div className="modal saas-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h3 className="modal-title">CBU Withdraw Requests</h3>
                <p className="modal-subtitle">
                  Approve or reject CBU withdrawal requests
                </p>
              </div>

              <button
                className="modal-x"
                type="button"
                onClick={() => setShowModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="table-card">
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Employee</th>
                      <th>Employee No</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Stage</th>
                      <th>Date Filed</th>
                      <th>Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={8} className="empty-state">
                          Loading...
                        </td>
                      </tr>
                    ) : rows.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="empty-state">
                          No CBU withdraw requests found.
                        </td>
                      </tr>
                    ) : (
                      rows.map((x) => {
                        const stage = x.approval_stage || "Pending";
                        const canApproveThis =
                          norm(x.status) === "pending" && canApproveStage(role, stage);

                        return (
                          <tr key={x.id}>
                            <td>{x.id}</td>
                            <td className="td-strong">{staffName(x)}</td>
                            <td>{x.employee_no || "-"}</td>
                            <td>₱ {money(x.amount)}</td>
                            <td>
                              <span className={badgeClass(x.status)}>
                                {x.status || "Pending"}
                              </span>
                            </td>
                            <td>{stageLabel(stage)}</td>
                            <td>{fmtDate(x.created_at)}</td>
                            <td>
                              <div className="row-actions">
                                <button
                                  className="btn-secondary"
                                  type="button"
                                  onClick={() => openView(x)}
                                >
                                  View
                                </button>

                                {canApproveThis ? (
                                  <>
                                    <button
                                      className="btn-success"
                                      type="button"
                                      disabled={processingId === `${x.id}-Approved`}
                                      onClick={() => updateStatus(x, "Approved")}
                                    >
                                      {processingId === `${x.id}-Approved`
                                        ? "Approving..."
                                        : "Approve"}
                                    </button>

                                    <button
                                      className="btn-danger"
                                      type="button"
                                      disabled={processingId === `${x.id}-Rejected`}
                                      onClick={() => updateStatus(x, "Rejected")}
                                    >
                                      {processingId === `${x.id}-Rejected`
                                        ? "Rejecting..."
                                        : "Reject"}
                                    </button>
                                  </>
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

            <div className="modal-buttons">
              <button
                className="btn-secondary"
                type="button"
                onClick={() => setShowModal(false)}
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
                <h3 className="modal-title">CBU Withdraw Details</h3>
                <p className="modal-subtitle">{staffName(selected)}</p>
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
                  <label>Employee</label>
                  <input value={staffName(selected)} readOnly />
                </div>

                <div className="form-group">
                  <label>Branch</label>
                  <input
                    value={
                      selected.branch ||
                      selected.branch_name ||
                      (selected.branch_code
                        ? `${selected.branch_code} - ${selected.branch_name || ""}`
                        : "-")
                    }
                    readOnly
                  />
                </div>

                <div className="form-group">
                  <label>Department</label>
                  <input value={selected.department || "-"} readOnly />
                </div>

                <div className="form-group">
                  <label>Position</label>
                  <input value={selected.position || "-"} readOnly />
                </div>

                <div className="form-group">
                  <label>Approval Chain</label>
                  <input value={chainText(selected)} readOnly />
                </div>

                <div className="form-group">
                  <label>Current Stage</label>
                  <input value={stageLabel(selected.approval_stage)} readOnly />
                </div>

                <div className="form-group">
                  <label>CBU Balance</label>
                  <input
                    value={
                      selected.cbu_balance != null || selected.cbu != null
                        ? `₱ ${money(selected.cbu_balance ?? selected.cbu)}`
                        : "-"
                    }
                    readOnly
                  />
                </div>

                <div className="form-group">
                  <label>Amount of Withdraw</label>
                  <input value={`₱ ${money(selected.amount)}`} readOnly />
                </div>

                <div className="form-group">
                  <label>Status</label>
                  <input value={selected.status || "Pending"} readOnly />
                </div>

                <div className="form-group">
                  <label>Date Filed</label>
                  <input value={fmtDate(selected.created_at)} readOnly />
                </div>

                <div className="form-group">
                  <label>Date of Disbursement</label>
                  <input value={fmtDate(selected.disbursement_date)} readOnly />
                </div>

                <div className="form-group full">
                  <label>Reason</label>
                  <textarea value={selected.reason || "-"} readOnly />
                </div>

                {selected.rejection_reason ? (
                  <div className="form-group full">
                    <label>Rejection Reason</label>
                    <textarea value={selected.rejection_reason} readOnly />
                  </div>
                ) : null}

                <div className="form-group full">
                  <label>Files</label>
                  <div className="row-actions" style={{ gap: 10, flexWrap: "wrap" }}>
                    {selected.attachment_path ? (
                      <button
                        className="btn-secondary"
                        type="button"
                        onClick={() => downloadFile(selected.id, "request")}
                      >
                        Download Request File
                      </button>
                    ) : (
                      <span className="mini">No request file.</span>
                    )}

                    {selected.approved_attachment_path ? (
                      <button
                        className="btn-secondary"
                        type="button"
                        onClick={() => downloadFile(selected.id, "approved")}
                      >
                        Download Approved File
                      </button>
                    ) : null}

                    {canUploadApprovedFile && norm(selected.status) === "approved" ? (
                      <label className="btn-secondary" style={{ cursor: "pointer" }}>
                        {uploadingId === String(selected.id)
                          ? "Uploading..."
                          : "Upload Approved File"}
                        <input
                          type="file"
                          hidden
                          onChange={(e) =>
                            uploadApprovedFile(selected.id, e.target.files?.[0] || null)
                          }
                        />
                      </label>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="modal-buttons">
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