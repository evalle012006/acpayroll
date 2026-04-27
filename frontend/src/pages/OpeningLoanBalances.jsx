import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "../api/axiosClient";
import "../styles/LeaveTransactions.css";

const toNum = (v) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const toStr = (v) => String(v ?? "").trim();

const fmtMoney = (v) =>
  `₱ ${toNum(v).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const loanTypes = [
  "Salary Advance",
  "Special Advance",
  "Cash Advance",
  "Motorcycle Loan",
  "Other Loan",
];

const statuses = ["Active", "Paid", "Cancelled"];

const readUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
};

const displayStaffLabel = (s) => {
  const employeeNo = toStr(s?.employee_no);
  const fullname = toStr(s?.fullname);
  return `${employeeNo ? `${employeeNo} - ` : ""}${fullname || "-"}`;
};

export default function OpeningLoanBalances() {
  const user = useMemo(() => readUser(), []);
  const role = String(user?.role || "").trim().toLowerCase();
  const canManage = role === "admin" || role === "hr" || role === "accounting" || role === "area manager";

  const staffPickerRef = useRef(null);

  const [staffList, setStaffList] = useState([]);
  const [rows, setRows] = useState([]);
  const [staffId, setStaffId] = useState("");
  const [staffQuery, setStaffQuery] = useState("");
  const [showStaffResults, setShowStaffResults] = useState(false);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    id: null,
    staff_id: "",
    loan_type: "Salary Advance",
    original_amount: "",
    interest: "",
    interest_amount: "",
    total_amount: "",
    term_months: "",
    months_paid: "",
    per_month: "",
    remaining_balance: "",
    start_date: "",
    effective_date: "",
    status: "Active",
    remarks: "",
  });

  const fetchStaff = useCallback(async () => {
    try {
      const res = await api.get("/staff");
      setStaffList(Array.isArray(res.data) ? res.data : []);
    } catch {
      setStaffList([]);
    }
  }, []);

  const fetchRows = useCallback(async (id) => {
    if (!id) {
      setRows([]);
      return;
    }

    try {
      setLoading(true);
      const res = await api.get(`/staff-loan-opening-balances/staff/${id}`);
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setRows([]);
      alert(err?.response?.data?.message || "Failed to load opening loan balances.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  useEffect(() => {
    fetchRows(staffId);
  }, [staffId, fetchRows]);

  useEffect(() => {
    const onMouseDown = (e) => {
      if (staffPickerRef.current && !staffPickerRef.current.contains(e.target)) {
        setShowStaffResults(false);
      }
    };

    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  const selectedStaff = useMemo(
    () => staffList.find((s) => String(s.id) === String(staffId)) || null,
    [staffId, staffList]
  );

  const filteredStaffList = useMemo(() => {
    const q = toStr(staffQuery).toLowerCase();

    if (!q) return staffList.slice(0, 20);

    return staffList
      .filter((s) => {
        const haystack = [
          s.id,
          s.employee_no,
          s.fullname,
          s.last_name,
          s.first_name,
          s.middle_name,
          s.position,
          s.area,
          s.region,
          s.division,
        ]
          .map((x) => toStr(x).toLowerCase())
          .join(" ");

        return haystack.includes(q);
      })
      .slice(0, 30);
  }, [staffList, staffQuery]);

  useEffect(() => {
    const original = toNum(form.original_amount);
    const interest = toNum(form.interest);
    const term = toNum(form.term_months);
    const paid = toNum(form.months_paid);

    const interestAmount = Number((original * (interest / 100)).toFixed(2));
    const totalAmount = Number((original + interestAmount).toFixed(2));

    const perMonth =
      totalAmount > 0 && term > 0
        ? Number((totalAmount / term).toFixed(2))
        : 0;

    const remaining =
      totalAmount > 0
        ? Math.max(0, Number((totalAmount - perMonth * paid).toFixed(2)))
        : 0;

    setForm((prev) => ({
      ...prev,
      interest_amount: String(interestAmount),
      total_amount: String(totalAmount),
      per_month: String(perMonth),
      remaining_balance: String(remaining),
    }));
  }, [form.original_amount, form.interest, form.term_months, form.months_paid]);

  useEffect(() => {
    const term = toNum(form.term_months);
    const paid = toNum(form.months_paid);

    if (term > 0 && paid > term) {
      setForm((prev) => ({
        ...prev,
        months_paid: String(term),
      }));
    }
  }, [form.term_months, form.months_paid]);

  const resetForm = () => {
    setForm({
      id: null,
      staff_id: staffId || "",
      loan_type: "Salary Advance",
      original_amount: "",
      interest: "",
      interest_amount: "",
      total_amount: "",
      term_months: "",
      months_paid: "",
      per_month: "",
      remaining_balance: "",
      start_date: "",
      effective_date: "",
      status: "Active",
      remarks: "",
    });
  };

  const handleChooseStaff = (staffRow) => {
    setStaffId(String(staffRow.id));
    setStaffQuery(displayStaffLabel(staffRow));
    setShowStaffResults(false);

    setForm((prev) => ({
      ...prev,
      id: null,
      staff_id: staffRow.id,
      loan_type: "Salary Advance",
      original_amount: "",
      interest: "",
      interest_amount: "",
      total_amount: "",
      term_months: "",
      months_paid: "",
      per_month: "",
      remaining_balance: "",
      start_date: "",
      effective_date: "",
      status: "Active",
      remarks: "",
    }));
  };

  const onEdit = (row) => {
    setForm({
      id: row.id,
      staff_id: row.staff_id,
      loan_type: row.loan_type || "Salary Advance",
      original_amount: row.original_amount ?? "",
      interest: row.interest ?? "",
      interest_amount: row.interest_amount ?? "",
      total_amount: row.total_amount ?? "",
      term_months: row.term_months ?? "",
      months_paid: row.months_paid ?? "",
      per_month: row.per_month ?? "",
      remaining_balance: row.remaining_balance ?? "",
      start_date: row.start_date ? String(row.start_date).slice(0, 10) : "",
      effective_date: row.effective_date ? String(row.effective_date).slice(0, 10) : "",
      status: row.status || "Active",
      remarks: row.remarks || "",
    });
  };

  const onSave = async (e) => {
    e.preventDefault();

    if (!canManage) return alert("Access denied.");
    if (!staffId) return alert("Select staff first.");

    try {
      setSaving(true);

      const payload = {
        ...form,
        staff_id: Number(staffId),
      };

      if (form.id) {
        await api.put(`/staff-loan-opening-balances/${form.id}`, payload);
      } else {
        await api.post("/staff-loan-opening-balances", payload);
      }

      resetForm();
      await fetchRows(staffId);
      alert("Saved.");
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (id) => {
    if (!canManage) return alert("Access denied.");
    if (!window.confirm("Delete this record?")) return;

    try {
      await api.delete(`/staff-loan-opening-balances/${id}`);
      await fetchRows(staffId);
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to delete.");
    }
  };

  return (
    <div className="approval-page">
      <div className="approval-page-header">
        <div>
          <h2 className="approval-title">Opening Loan Balances</h2>
          <p className="approval-subtitle">Encode carried loan balances per staff</p>
        </div>
      </div>

      <div
        className="table-card"
        style={{
          marginBottom: 16,
          overflow: "visible",
          position: "relative",
          zIndex: 30,
        }}
      >
        <div
          className="modal-form"
          style={{
            padding: 16,
            overflow: "visible",
            position: "relative",
            zIndex: 30,
          }}
        >
          <div
            className="modal-grid"
            style={{
              overflow: "visible",
              position: "relative",
              zIndex: 30,
            }}
          >
            <div
              className="form-group"
              style={{ position: "relative", zIndex: 50 }}
              ref={staffPickerRef}
            >
              <label>Staff</label>
              <input
                value={staffQuery}
                placeholder="Type employee no or staff name..."
                onChange={(e) => {
                  setStaffQuery(e.target.value);
                  setStaffId("");
                  setShowStaffResults(true);
                  setRows([]);
                }}
                onFocus={() => setShowStaffResults(true)}
              />

              {showStaffResults && (
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
                    border: "1px solid var(--border, rgba(255,255,255,0.1))",
                    borderRadius: 12,
                    zIndex: 9999,
                    boxShadow: "0 12px 30px rgba(0,0,0,0.25)",
                  }}
                >
                  {filteredStaffList.length === 0 ? (
                    <div style={{ padding: 12, opacity: 0.8 }}>
                      No staff found.
                    </div>
                  ) : (
                    filteredStaffList.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => handleChooseStaff(s)}
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
                        <div style={{ fontWeight: 700 }}>
                          {displayStaffLabel(s)}
                        </div>
                        <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>
                          {toStr(s.position) || "No position"}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="form-group">
              <label>Employee No</label>
              <input value={selectedStaff?.employee_no || ""} readOnly />
            </div>
          </div>
        </div>
      </div>

      <div className="table-card" style={{ marginBottom: 16 }}>
        <form onSubmit={onSave} className="modal-form" style={{ padding: 16 }}>
          <div className="modal-grid">
            <div className="form-group">
              <label>Loan Type</label>
              <select
                value={form.loan_type}
                onChange={(e) => setForm((p) => ({ ...p, loan_type: e.target.value }))}
                required
              >
                {loanTypes.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Original Amount</label>
              <input
                value={form.original_amount}
                onChange={(e) => setForm((p) => ({ ...p, original_amount: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label>Interest (%)</label>
              <input
                value={form.interest}
                onChange={(e) => setForm((p) => ({ ...p, interest: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label>Interest Amount</label>
              <input value={form.interest_amount} readOnly />
            </div>

            <div className="form-group">
              <label>Total Amount</label>
              <input value={form.total_amount} readOnly />
            </div>

            <div className="form-group">
              <label>Term Months</label>
              <input
                value={form.term_months}
                onChange={(e) => setForm((p) => ({ ...p, term_months: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label>Months Paid</label>
              <input
                value={form.months_paid}
                onChange={(e) => setForm((p) => ({ ...p, months_paid: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label>Per Month</label>
              <input value={form.per_month} readOnly />
            </div>

            <div className="form-group">
              <label>Remaining Balance</label>
              <input value={form.remaining_balance} readOnly />
            </div>

            <div className="form-group">
              <label>Start Date</label>
              <input
                type="date"
                value={form.start_date}
                onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label>Effective Date</label>
              <input
                type="date"
                value={form.effective_date}
                onChange={(e) => setForm((p) => ({ ...p, effective_date: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label>Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
              >
                {statuses.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group full">
              <label>Remarks</label>
              <textarea
                value={form.remarks}
                onChange={(e) => setForm((p) => ({ ...p, remarks: e.target.value }))}
              />
            </div>
          </div>

          <div className="modal-buttons">
            <button type="button" className="btn-secondary" onClick={resetForm}>
              Clear
            </button>
            <button type="submit" className="btn-primary" disabled={!canManage || saving}>
              {saving ? "Saving..." : form.id ? "Update" : "Save"}
            </button>
          </div>
        </form>
      </div>

      <div className="table-card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Loan Type</th>
                <th>Original</th>
                <th>Interest %</th>
                <th>Interest Amt</th>
                <th>Total</th>
                <th>Term</th>
                <th>Paid</th>
                <th>Per Month</th>
                <th>Remaining</th>
                <th>Status</th>
                <th>Effective</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {!staffId ? (
                <tr>
                  <td colSpan={12} className="empty-state">
                    Select staff first.
                  </td>
                </tr>
              ) : loading ? (
                <tr>
                  <td colSpan={12} className="empty-state">
                    Loading...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={12} className="empty-state">
                    No opening loan balances found.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.loan_type}</td>
                    <td>{fmtMoney(row.original_amount)}</td>
                    <td>{toNum(row.interest).toFixed(2)}%</td>
                    <td>{fmtMoney(row.interest_amount)}</td>
                    <td>{fmtMoney(row.total_amount)}</td>
                    <td>{row.term_months}</td>
                    <td>{row.months_paid}</td>
                    <td>{fmtMoney(row.per_month)}</td>
                    <td>{fmtMoney(row.remaining_balance)}</td>
                    <td>{row.status}</td>
                    <td>{row.effective_date ? String(row.effective_date).slice(0, 10) : "-"}</td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="btn-secondary"
                          type="button"
                          onClick={() => onEdit(row)}
                        >
                          Edit
                        </button>
                        <button
                          className="btn-danger"
                          type="button"
                          onClick={() => onDelete(row.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}