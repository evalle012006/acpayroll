import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axiosClient";
import "../styles/RegularizationOrder.css";

const clean = (v) => String(v ?? "").trim();
const toNum = (v) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};
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

const readUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
};

export default function RegularizationOrders() {
  const navigate = useNavigate();
  const employeeBoxRef = useRef(null);

  const user = useMemo(() => readUser(), []);
  const role = String(user?.role || "").trim().toLowerCase();

  const canCreate = [
    "admin",
    "hr",
    "accounting",
    "vice president",
    "senior vice president",
    "president",
  ].includes(role);

  const canApprove = ["admin", "hr", "accounting"].includes(role);

  const emptyForm = useMemo(
    () => ({
      employee_id: "",
      employee_no: "",
      employee_name: "",
      branch_id: "",
      branch_label: "",
      date_created: toDate10(new Date().toISOString()),
      effective_date: "",
      previous_position: "",
      present_position: "",
      previous_salary: "",
      present_salary: "",
      previous_ecola: "",
      present_ecola: "",
      remarks: "",
    }),
    []
  );

  const [orders, setOrders] = useState([]);
  const [staff, setStaff] = useState([]);
  const [positions, setPositions] = useState([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
  const [attachFile, setAttachFile] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const badgeClass = (status) => {
    const s = String(status || "Pending").toLowerCase();
    if (s === "approved") return "reg-badge reg-approved";
    if (s === "rejected") return "reg-badge reg-rejected";
    return "reg-badge reg-pending";
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    setErr("");

    try {
      const [oRes, sRes, dRes] = await Promise.all([
        api.get("/regularization-orders"),
        api.get("/staff"),
        api.get("/departments").catch(() => ({ data: [] })),
      ]);

      const orderRows = Array.isArray(oRes.data) ? oRes.data : [];
      const staffRows = Array.isArray(sRes.data) ? sRes.data : [];
      const deptRows = Array.isArray(dRes.data) ? dRes.data : [];

      setOrders(orderRows);
      setStaff(staffRows);

      const posSet = new Set();

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

  const filteredStaff = useMemo(() => {
    const q = employeeSearch.toLowerCase();
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
        s.branch_name,
        s.branch_code,
      ]
        .map((x) => clean(x).toLowerCase())
        .join(" ");

      return haystack.includes(q);
    });
  }, [employeeSearch, staff]);

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

    const branchLabel = [clean(emp.branch_code), clean(emp.branch_name || emp.branch)]
      .filter(Boolean)
      .join(" - ");

    const next = {
      employee_id: String(emp.id),
      employee_no: clean(emp.employee_no),
      employee_name: clean(emp.fullname) || displayNameParts(emp),
      branch_id: emp.branch_id ? String(emp.branch_id) : "",
      branch_label: branchLabel,
      date_created: toDate10(new Date().toISOString()),
      effective_date: "",
      previous_position: clean(emp.position),
      present_position: clean(emp.position),
      previous_salary: String(toNum(emp.salary)),
      present_salary: String(toNum(emp.salary)),
      previous_ecola: String(toNum(emp.ecola)),
      present_ecola: String(toNum(emp.ecola)),
      remarks: "",
    };

    setForm(next);
    setEmployeeSearch(
      `${emp.id} — ${displayNameParts(emp)}${emp.employee_no ? ` (${emp.employee_no})` : ""}`
    );
    setShowEmployeeDropdown(false);
  };

  const submitCreate = async (e) => {
    e.preventDefault();
    if (!canCreate || saving) return;

    setErr("");

    if (!clean(form.employee_id)) return setErr("Select employee.");
    if (!clean(form.effective_date)) return setErr("Effective date required.");
    if (!clean(form.present_position)) return setErr("Present position required.");

    setSaving(true);

    try {
      const formData = new FormData();
      formData.append("employee_id", clean(form.employee_id));
      formData.append("employee_no", clean(form.employee_no));
      formData.append("employee_name", clean(form.employee_name));
      formData.append("branch_id", clean(form.branch_id));
      formData.append("branch_label", clean(form.branch_label));
      formData.append("date_created", clean(form.date_created));
      formData.append("effective_date", clean(form.effective_date));
      formData.append("previous_position", clean(form.previous_position));
      formData.append("present_position", clean(form.present_position));
      formData.append("previous_salary", String(toNum(form.previous_salary)));
      formData.append("present_salary", String(toNum(form.present_salary)));
      formData.append("previous_ecola", String(toNum(form.previous_ecola)));
      formData.append("present_ecola", String(toNum(form.present_ecola)));
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

  const downloadAttachment = async (id) => {
    try {
      const res = await api.get(`/regularization-orders/${id}/download`, {
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `regularization-order-${id}`;
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
          <h2 className="reg-title">Regularization Orders</h2>
          <p className="reg-subtitle">Create and manage staff regularization orders.</p>
        </div>

        <div className="reg-topbar-actions">
          <button
            className="reg-btn reg-btn-outline"
            onClick={() => navigate(-1)}
            type="button"
          >
            ← Back
          </button>

          <button className="reg-btn reg-btn-outline" onClick={loadData} disabled={loading} type="button">
            Refresh
          </button>

          {canCreate && (
            <button className="reg-btn reg-btn-primary" onClick={openCreate} type="button">
              + Create Regularization
            </button>
          )}
        </div>
      </div>

      {err ? (
        <div style={{ color: "#ef4444", fontWeight: 800, marginBottom: 12 }}>{err}</div>
      ) : null}

      <div className="reg-card">
        <div className="reg-table-wrap">
          <table className="reg-table">
            <thead>
              <tr>
                <th>Order No</th>
                <th>Employee No</th>
                <th>Employee</th>
                <th>Branch</th>
                <th>Previous Position</th>
                <th>Present Position</th>
                <th>Effective Date</th>
                <th>Status</th>
                <th>Attachment</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="reg-empty">Loading...</td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={10} className="reg-empty">No regularization orders found.</td>
                </tr>
              ) : (
                orders.map((o) => {
                  const pending = String(o.status || "").toLowerCase() === "pending";

                  return (
                    <tr key={o.id}>
                      <td>{o.order_no}</td>
                      <td>{o.employee_no || "-"}</td>
                      <td>{o.employee_name}</td>
                      <td>{o.branch_label || "-"}</td>
                      <td>{o.previous_position || "-"}</td>
                      <td>{o.present_position || "-"}</td>
                      <td>{toDate10(o.effective_date)}</td>
                      <td>
                        <span className={badgeClass(o.status)}>
                          {o.status || "Pending"}
                        </span>
                      </td>
                      <td>
                        {o.attachment_path ? (
                          <button
                            className="reg-mini-btn reg-download"
                            type="button"
                            onClick={() => downloadAttachment(o.id)}
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
      </div>

      {showModal && (
        <div
          className="reg-modal-overlay"
          onMouseDown={(e) =>
            e.target.classList.contains("reg-modal-overlay") && closeModal()
          }
        >
          <div className="reg-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="reg-modal-head">
              <h3 className="reg-modal-title">Create Regularization Order</h3>
              <button className="reg-x" onClick={closeModal} type="button">
                ✕
              </button>
            </div>

            <form className="reg-form" onSubmit={submitCreate}>
              <div className="reg-grid">
                <div
                  className="reg-field"
                  ref={employeeBoxRef}
                  style={{ position: "relative" }}
                >
                  <label>Select Employee</label>
                  <input
                    type="text"
                    placeholder="Search employee ID, employee no, or name..."
                    value={employeeSearch}
                    onChange={(e) => {
                      setEmployeeSearch(e.target.value);
                      setShowEmployeeDropdown(true);
                      setForm((p) => ({
                        ...p,
                        employee_id: "",
                        employee_no: "",
                        employee_name: "",
                        branch_id: "",
                        branch_label: "",
                        previous_position: "",
                        present_position: "",
                        previous_salary: "",
                        present_salary: "",
                        previous_ecola: "",
                        present_ecola: "",
                      }));
                    }}
                    onFocus={() => setShowEmployeeDropdown(true)}
                  />

                  {showEmployeeDropdown && (
                    <div className="reg-search-dropdown">
                      {filteredStaff.length === 0 ? (
                        <div className="reg-search-empty">No employee found</div>
                      ) : (
                        filteredStaff.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            className="reg-search-item"
                            onClick={() => onSelectEmployee(s.id)}
                          >
                            {s.id} — {displayNameParts(s)}{" "}
                            {s.employee_no ? `(${s.employee_no})` : ""}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                <div className="reg-field">
                  <label>Employee No</label>
                  <input value={form.employee_no} readOnly />
                </div>

                <div className="reg-field">
                  <label>Employee Name</label>
                  <input value={form.employee_name} readOnly />
                </div>

                <div className="reg-field">
                  <label>Branch</label>
                  <input value={form.branch_label} readOnly />
                </div>

                <div className="reg-field">
                  <label>Date Created</label>
                  <input type="date" value={form.date_created} readOnly />
                </div>

                <div className="reg-field">
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

                <div className="reg-field">
                  <label>Previous Position</label>
                  <input value={form.previous_position} readOnly />
                </div>

                <div className="reg-field">
                  <label>Present Position</label>
                  <select
                    value={form.present_position}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, present_position: e.target.value }))
                    }
                    required
                  >
                    <option value="">Select new position</option>
                    {positions.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="reg-field">
                  <label>Previous Salary</label>
                  <input value={toNum(form.previous_salary).toLocaleString()} readOnly />
                </div>

                <div className="reg-field">
                  <label>Present Salary</label>
                  <input
                    type="number"
                    value={form.present_salary}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, present_salary: e.target.value }))
                    }
                  />
                </div>

                <div className="reg-field">
                  <label>Previous Ecola</label>
                  <input value={toNum(form.previous_ecola).toLocaleString()} readOnly />
                </div>

                <div className="reg-field">
                  <label>Present Ecola</label>
                  <input
                    type="number"
                    value={form.present_ecola}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, present_ecola: e.target.value }))
                    }
                  />
                </div>

                <div className="reg-field">
                  <label>Attach File</label>
                  <input
                    type="file"
                    onChange={(e) => setAttachFile(e.target.files?.[0] || null)}
                  />
                </div>

                <div className="reg-field full">
                  <label>Remarks</label>
                  <textarea
                    value={form.remarks}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, remarks: e.target.value }))
                    }
                    placeholder="Remarks"
                  />
                </div>
              </div>

              <div className="reg-modal-actions">
                <button
                  className="reg-btn reg-btn-outline"
                  type="button"
                  onClick={closeModal}
                >
                  Cancel
                </button>
                <button
                  className="reg-btn reg-btn-primary"
                  type="submit"
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}