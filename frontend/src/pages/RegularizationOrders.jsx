import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axiosClient";
import "../styles/RegularizationOrder.css";

const clean = (v) => String(v ?? "").trim();

const norm = (v) => clean(v).toLowerCase();

const toNum = (v) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const toDate10 = (v) => (v ? String(v).slice(0, 10) : "");

const money = (v) =>
  `₱ ${toNum(v).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const displayNameParts = (s) => {
  const ln = clean(s?.last_name);
  const fn = clean(s?.first_name);
  const mn = clean(s?.middle_name);

  const built = `${ln}${ln && fn ? ", " : ""}${fn}${mn ? ` ${mn}` : ""}`
    .replace(/\s+/g, " ")
    .trim();

  return built || clean(s?.fullname) || "-";
};

const readUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
};

const isProbationaryLoanOfficer = (s) => {
  const p = norm(s?.position).replace(/[_-]/g, " ").replace(/\s+/g, " ");
  return p === "probationary loan officer" || p.includes("probationary loan officer");
};

const LEAVE_FIELDS = [
  { name: "annual_leave", label: "Annual Leave" },
  { name: "sick_leave", label: "Sick Leave" },
  { name: "emergency_leave", label: "Emergency Leave" },
  { name: "maternity_leave", label: "Maternity Leave" },
  { name: "parental_leave", label: "Parental Leave" },
  { name: "slw_leave", label: "Special Leave for Women (SLW)" },
  { name: "vawc_leave", label: "VAWC Leave" },
];

export default function RegularizationOrders() {
  const navigate = useNavigate();
  const employeeBoxRef = useRef(null);

  const user = useMemo(() => readUser(), []);
  const role = norm(user?.role);

  const canCreate = [
    "admin",
    "it",
    "hr",
    "accounting",
    "vice president",
    "senior vice president",
    "president",
  ].includes(role);

  const canApprove = ["admin", "it", "hr", "accounting"].includes(role);

  const emptyForm = useMemo(
    () => ({
      employee_id: "",
      employee_no: "",
      employee_name: "",

      branch_id: "",
      branch_label: "",

      regularization_branch_id: "",
      regularization_branch_label: "",

      date_created: toDate10(new Date().toISOString()),
      effective_date: "",

      previous_position: "",
      present_position: "Loan Officer",

      previous_salary: "",
      present_salary: "",
      previous_ecola: "",
      present_ecola: "",

      annual_leave: "",
      sick_leave: "",
      emergency_leave: "",
      maternity_leave: "",
      parental_leave: "",
      slw_leave: "",
      vawc_leave: "",

      remarks: "",
    }),
    []
  );

  const [orders, setOrders] = useState([]);
  const [staff, setStaff] = useState([]);
  const [positions, setPositions] = useState([]);
  const [branches, setBranches] = useState([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
  const [attachFile, setAttachFile] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const badgeClass = (status) => {
    const s = norm(status || "Pending");

    if (s === "approved") return "reg-badge reg-approved";
    if (s === "rejected") return "reg-badge reg-rejected";

    return "reg-badge reg-pending";
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    setErr("");

    try {
      const [oRes, sRes, dRes, bRes] = await Promise.all([
        api.get("/regularization-orders"),
        api.get("/staff"),
        api.get("/departments").catch(() => ({ data: [] })),
        api.get("/branches").catch(() => ({ data: [] })),
      ]);

      const orderRows = Array.isArray(oRes.data) ? oRes.data : [];
      const staffRows = Array.isArray(sRes.data) ? sRes.data : [];
      const deptRows = Array.isArray(dRes.data) ? dRes.data : [];
      const branchRows = Array.isArray(bRes.data) ? bRes.data : [];

      setOrders(orderRows);
      setStaff(staffRows);
      setBranches(branchRows);

      const posSet = new Set(["Loan Officer"]);

      staffRows.forEach((s) => {
        if (clean(s.position)) posSet.add(clean(s.position));
      });

      deptRows.forEach((d) => {
        if (clean(d.name)) posSet.add(clean(d.name));
        if (clean(d.position)) posSet.add(clean(d.position));
      });

      setPositions(Array.from(posSet).sort((a, b) => a.localeCompare(b)));
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to load regularization orders.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!showModal) return;

    const onMouseDown = (e) => {
      if (employeeBoxRef.current && !employeeBoxRef.current.contains(e.target)) {
        setShowEmployeeDropdown(false);
      }
    };

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        setShowEmployeeDropdown(false);
        closeModal();
      }
    };

    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [showModal]);

  const branchLabelFromRow = (b) => {
    if (!b) return "";
    return [clean(b.code), clean(b.name)].filter(Boolean).join(" - ");
  };

  const getStaffBranchLabel = (emp) => {
    const direct = [clean(emp?.branch_code), clean(emp?.branch_name || emp?.branch)]
      .filter(Boolean)
      .join(" - ");

    if (direct) return direct;

    const b = branches.find((x) => String(x.id) === String(emp?.branch_id));
    return branchLabelFromRow(b);
  };

  const filteredStaff = useMemo(() => {
    const q = norm(employeeSearch);

    return staff
      .filter(isProbationaryLoanOfficer)
      .filter((s) => {
        if (!q) return true;

        const haystack = [
          s.id,
          s.employee_no,
          s.fullname,
          s.first_name,
          s.middle_name,
          s.last_name,
          displayNameParts(s),
          s.position,
          s.branch_name,
          s.branch_code,
          s.area,
          s.region,
          s.division,
        ]
          .map((x) => norm(x))
          .join(" ");

        return haystack.includes(q);
      })
      .sort((a, b) => displayNameParts(a).localeCompare(displayNameParts(b)));
  }, [employeeSearch, staff]);

  const filteredOrders = useMemo(() => {
    const q = norm(search);

    if (!q) return orders;

    return orders.filter((o) => {
      const haystack = [
        o.order_no,
        o.employee_no,
        o.employee_name,
        o.branch_label,
        o.regularization_branch_label,
        o.previous_position,
        o.present_position,
        o.status,
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

  const openCreate = () => {
    setErr("");
    setForm({
      ...emptyForm,
      date_created: toDate10(new Date().toISOString()),
    });
    setAttachFile(null);
    setEmployeeSearch("");
    setShowEmployeeDropdown(false);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSaving(false);
    setAttachFile(null);
    setEmployeeSearch("");
    setShowEmployeeDropdown(false);
    setForm({
      ...emptyForm,
      date_created: toDate10(new Date().toISOString()),
    });
  };

  const onSelectEmployee = (id) => {
    const emp = staff.find((x) => String(x.id) === String(id));
    if (!emp) return;

    const currentBranchLabel = getStaffBranchLabel(emp);

    const next = {
      ...emptyForm,

      employee_id: String(emp.id),
      employee_no: clean(emp.employee_no),
      employee_name: clean(emp.fullname) || displayNameParts(emp),

      branch_id: emp.branch_id ? String(emp.branch_id) : "",
      branch_label: currentBranchLabel,

      regularization_branch_id: emp.branch_id ? String(emp.branch_id) : "",
      regularization_branch_label: currentBranchLabel,

      date_created: toDate10(new Date().toISOString()),
      effective_date: "",

      previous_position: clean(emp.position),
      present_position: "Loan Officer",

      previous_salary: String(toNum(emp.salary || emp.basic_salary)),
      present_salary: String(toNum(emp.salary || emp.basic_salary)),

      previous_ecola: String(toNum(emp.ecola)),
      present_ecola: String(toNum(emp.ecola)),

      annual_leave: String(toNum(emp.annual_leave)),
      sick_leave: String(toNum(emp.sick_leave)),
      emergency_leave: String(toNum(emp.emergency_leave)),
      maternity_leave: String(toNum(emp.maternity_leave)),
      parental_leave: String(toNum(emp.parental_leave)),
      slw_leave: String(toNum(emp.slw_leave)),
      vawc_leave: String(toNum(emp.vawc_leave)),

      remarks: "",
    };

    setForm(next);
    setEmployeeSearch(
      `${clean(emp.employee_no) ? `${clean(emp.employee_no)} — ` : ""}${displayNameParts(emp)}`
    );
    setShowEmployeeDropdown(false);
  };

  const handleRegularizationBranchChange = (branchId) => {
    const selected = branches.find((b) => String(b.id) === String(branchId));

    setForm((prev) => ({
      ...prev,
      regularization_branch_id: branchId,
      regularization_branch_label: selected ? branchLabelFromRow(selected) : "",
    }));
  };

  const submitCreate = async (e) => {
    e.preventDefault();

    if (!canCreate || saving) return;

    setErr("");

    if (!clean(form.employee_id)) return setErr("Select employee.");
    if (!clean(form.effective_date)) return setErr("Regularization date required.");
    if (!clean(form.present_position)) return setErr("Present position required.");
    if (!clean(form.regularization_branch_id)) return setErr("Regularization branch required.");

    setSaving(true);

    try {
      const formData = new FormData();

      formData.append("employee_id", clean(form.employee_id));
      formData.append("employee_no", clean(form.employee_no));
      formData.append("employee_name", clean(form.employee_name));

      formData.append("branch_id", clean(form.branch_id));
      formData.append("branch_label", clean(form.branch_label));

      formData.append("regularization_branch_id", clean(form.regularization_branch_id));
      formData.append("regularization_branch_label", clean(form.regularization_branch_label));

      formData.append("date_created", clean(form.date_created));
      formData.append("effective_date", clean(form.effective_date));

      formData.append("previous_position", clean(form.previous_position));
      formData.append("present_position", clean(form.present_position));

      formData.append("previous_salary", String(toNum(form.previous_salary)));
      formData.append("present_salary", String(toNum(form.present_salary)));

      formData.append("previous_ecola", String(toNum(form.previous_ecola)));
      formData.append("present_ecola", String(toNum(form.present_ecola)));

      LEAVE_FIELDS.forEach((field) => {
        formData.append(field.name, String(toNum(form[field.name])));
      });

      formData.append("remarks", clean(form.remarks));

      if (attachFile) {
        formData.append("attachment", attachFile);
      }

      await api.post("/regularization-orders", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      closeModal();
      await loadData();
    } catch (e2) {
      setErr(e2?.response?.data?.message || "Failed to create regularization order.");
    } finally {
      setSaving(false);
    }
  };

  const approveOrder = async (row) => {
    if (!canApprove) return;

    if (!window.confirm("Approve this regularization order?")) return;

    try {
      await api.put(`/regularization-orders/${row.id}/approve`);
      await loadData();
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to approve.");
    }
  };

  const rejectOrder = async (row) => {
    if (!canApprove) return;

    const reason = window.prompt("Enter rejection reason:");
    if (!clean(reason)) return;

    try {
      await api.put(`/regularization-orders/${row.id}/reject`, { reason });
      await loadData();
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to reject.");
    }
  };

  const downloadAttachment = async (row) => {
    try {
      const res = await api.get(`/regularization-orders/${row.id}/download`, {
        responseType: "blob",
      });

      const blob = new Blob([res.data]);
      const url = window.URL.createObjectURL(blob);

      const fileName =
        row.approved_attachment_name ||
        row.attachment_name ||
        `regularization-order-${row.id}.pdf`;

      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;

      document.body.appendChild(a);
      a.click();
      a.remove();

      window.URL.revokeObjectURL(url);
    } catch (e) {
      alert(e?.response?.data?.message || "Failed to download attachment.");
    }
  };

  return (
    <div className="reg-page">
      <div className="reg-topbar">
        <div>
          <h2 className="reg-title">Regularization</h2>
          <p className="reg-subtitle">Create and manage staff regularization orders.</p>
        </div>

        <div className="reg-topbar-actions">
          <button className="reg-btn reg-btn-outline" onClick={() => navigate(-1)} type="button">
            ← Back
          </button>

          <button className="reg-btn reg-btn-outline" onClick={loadData} disabled={loading} type="button">
            Refresh
          </button>

          {canCreate && (
            <button className="reg-btn reg-btn-primary" onClick={openCreate} type="button" disabled={saving}>
              + Create
            </button>
          )}
        </div>
      </div>

      {err ? (
        <div style={{ color: "#ef4444", fontWeight: 800, marginBottom: 12 }}>
          {err}
        </div>
      ) : null}

      <div className="reg-card">
        <div className="reg-toolbar">
          <div className="reg-toolbar-left">
            <input
              type="text"
              className="reg-search-main"
              placeholder="Search order no, employee, branch, position..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <select
              className="reg-page-size"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={75}>75</option>
              <option value={100}>100</option>
            </select>
          </div>

          <div className="reg-toolbar-count">{filteredOrders.length} result(s)</div>
        </div>

        <div className="reg-table-wrap">
          <table className="reg-table">
            <thead>
              <tr>
                <th>Order No</th>
                <th>Employee No</th>
                <th>Employee</th>
                <th>Current Branch</th>
                <th>Regularization Branch</th>
                <th>Previous Position</th>
                <th>Present Position</th>
                <th>Regularization Date</th>
                <th>Status</th>
                <th>Attachment</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} className="reg-empty">
                    Loading...
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={11} className="reg-empty">
                    No regularization orders found.
                  </td>
                </tr>
              ) : (
                pagedOrders.map((o) => {
                  const pending = norm(o.status) === "pending";

                  return (
                    <tr key={o.id}>
                      <td>{o.order_no}</td>
                      <td>{o.employee_no || "-"}</td>
                      <td>{o.employee_name}</td>
                      <td>{o.branch_label || "-"}</td>
                      <td>{o.regularization_branch_label || o.branch_label || "-"}</td>
                      <td>{o.previous_position || "-"}</td>
                      <td>{o.present_position || "-"}</td>
                      <td>{toDate10(o.effective_date)}</td>
                      <td>
                        <span className={badgeClass(o.status)}>{o.status || "Pending"}</span>
                      </td>

                      <td>
                        {o.attachment_path ? (
                          <button
                            className="reg-mini-btn reg-download"
                            type="button"
                            onClick={() => downloadAttachment(o)}
                          >
                            Download
                          </button>
                        ) : (
                          "-"
                        )}
                      </td>

                      <td>
                        <div className="reg-row-actions">
                          {canApprove ? (
                            <>
                              <button
                                className="reg-mini-btn reg-approve"
                                onClick={() => approveOrder(o)}
                                disabled={!pending}
                                type="button"
                              >
                                Approve
                              </button>

                              <button
                                className="reg-mini-btn reg-reject"
                                onClick={() => rejectOrder(o)}
                                disabled={!pending}
                                type="button"
                              >
                                Reject
                              </button>
                            </>
                          ) : (
                            <span style={{ opacity: 0.7 }}>-</span>
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

        <div className="reg-pager">
          <div className="reg-page-info">
            Page {page} of {totalPages}
          </div>

          <div className="reg-page-buttons">
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Previous
            </button>

            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="reg-modal-overlay">
          <div className="reg-modal">
            <form onSubmit={submitCreate}>
              <div className="reg-modal-head">
                <h3 className="reg-modal-title">Create Regularization</h3>

                <button type="button" className="reg-x" onClick={closeModal}>
                  ×
                </button>
              </div>

              <div className="reg-form">
                <div className="reg-field full" ref={employeeBoxRef}>
                  <label>Employee</label>

                  <input
                    type="text"
                    value={employeeSearch}
                    placeholder="Search probationary loan officer..."
                    onChange={(e) => {
                      setEmployeeSearch(e.target.value);
                      setShowEmployeeDropdown(true);
                    }}
                    onFocus={() => setShowEmployeeDropdown(true)}
                  />

                  {showEmployeeDropdown && (
                    <div className="reg-search-dropdown">
                      {filteredStaff.length === 0 ? (
                        <div className="reg-search-empty">No probationary loan officer found</div>
                      ) : (
                        filteredStaff.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            className="reg-search-item"
                            onClick={() => onSelectEmployee(s.id)}
                          >
                            {clean(s.employee_no) ? `${clean(s.employee_no)} — ` : ""}
                            {displayNameParts(s)}
                            {clean(s.branch_code || s.branch_name) ? ` • ${getStaffBranchLabel(s)}` : ""}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                <div className="reg-grid">
                  <div className="reg-field">
                    <label>Date Created</label>
                    <input
                      type="date"
                      value={form.date_created}
                      onChange={(e) => setForm({ ...form, date_created: e.target.value })}
                    />
                  </div>

                  <div className="reg-field">
                    <label>Regularization Date</label>
                    <input
                      type="date"
                      value={form.effective_date}
                      onChange={(e) => setForm({ ...form, effective_date: e.target.value })}
                    />
                  </div>

                  <div className="reg-field">
                    <label>Current Branch</label>
                    <input value={form.branch_label} readOnly placeholder="Auto-filled" />
                  </div>

                  <div className="reg-field">
                    <label>Regularization Branch</label>
                    <select
                      value={form.regularization_branch_id}
                      onChange={(e) => handleRegularizationBranchChange(e.target.value)}
                    >
                      <option value="">Select Branch</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {branchLabelFromRow(b)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="reg-field">
                    <label>Previous Position</label>
                    <input value={form.previous_position} readOnly placeholder="Auto-filled" />
                  </div>

                  <div className="reg-field">
                    <label>Present Position</label>
                    <select
                      value={form.present_position}
                      onChange={(e) => setForm({ ...form, present_position: e.target.value })}
                    >
                      <option value="">Select Position</option>
                      {positions.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="reg-field">
                    <label>Basic Salary</label>
                    <input
                      type="number"
                      value={form.present_salary}
                      onChange={(e) => setForm({ ...form, present_salary: e.target.value })}
                    />
                  </div>

                  <div className="reg-field">
                    <label>ECOLA</label>
                    <input
                      type="number"
                      value={form.present_ecola}
                      onChange={(e) => setForm({ ...form, present_ecola: e.target.value })}
                    />
                  </div>

                  <div className="reg-field full">
                    <label>Attachment</label>
                    <input type="file" onChange={(e) => setAttachFile(e.target.files?.[0] || null)} />
                  </div>

                  <div className="reg-field full">
                    <label>Remarks</label>
                    <textarea
                      rows={4}
                      value={form.remarks}
                      onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="reg-modal-actions">
                <button type="button" className="reg-btn reg-btn-outline" onClick={closeModal}>
                  Cancel
                </button>

                <button type="submit" className="reg-btn reg-btn-primary" disabled={saving}>
                  {saving ? "Saving..." : "Save Order"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}