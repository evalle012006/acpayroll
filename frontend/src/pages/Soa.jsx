import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/Soa.css";
import api from "../api/axiosClient";

const toStr = (v) => String(v ?? "").trim();
const toNum = (v) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};
const fmtDate = (d) => (d ? String(d).split("T")[0] : "-");

export default function Soa() {
  const navigate = useNavigate();

  const [staffList, setStaffList] = useState([]);
  const [branches, setBranches] = useState([]);

  const [settlements, setSettlements] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [saving, setSaving] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [viewRow, setViewRow] = useState(null);

  const [form, setForm] = useState({
    staff_id: "",

    prev_branch: "",
    employee_id: "",
    employee_name: "",

    cbu: "",
    cashbond: "",
    utility: "",
    liabilities: "",
    thirteenth_month_pay: "",
    last_pay: "",

    separation_pay: "",
    cash_assistance: "",
  });

  const branchMap = useMemo(() => {
    const m = new Map();
    (branches || []).forEach((b) => m.set(Number(b.id), b));
    return m;
  }, [branches]);

  const loadStaff = useCallback(async () => {
    try {
      const res = await api.get("/staff");
      setStaffList(Array.isArray(res.data) ? res.data : []);
    } catch {
      setStaffList([]);
    }
  }, []);

  const loadBranches = useCallback(async () => {
    try {
      const res = await api.get("/branches");
      setBranches(Array.isArray(res.data) ? res.data : []);
    } catch {
      setBranches([]);
    }
  }, []);

  const loadSettlements = useCallback(async () => {
    try {
      setLoadingList(true);
      const res = await api.get("/settlements");
      setSettlements(Array.isArray(res.data) ? res.data : []);
    } catch {
      setSettlements([]);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    loadStaff();
    loadBranches();
    loadSettlements();
  }, [loadStaff, loadBranches, loadSettlements]);

  useEffect(() => {
    if (!showCreate) return;
    const onKeyDown = (e) => e.key === "Escape" && setShowCreate(false);
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [showCreate]);

  const resetForm = () => {
    setForm({
      staff_id: "",
      prev_branch: "",
      employee_id: "",
      employee_name: "",

      cbu: "",
      cashbond: "",
      utility: "",
      liabilities: "",
      thirteenth_month_pay: "",
      last_pay: "",

      separation_pay: "",
      cash_assistance: "",
    });
  };

  const onChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const pickStaff = (staffId) => {
    const s = staffList.find((x) => String(x.id) === String(staffId));
    if (!s) {
      resetForm();
      return;
    }

    const bid = s.branch_id ? Number(s.branch_id) : null;
    const b = bid ? branchMap.get(bid) : null;
    const prevBranchLabel = b ? `${toStr(b.code)} - ${toStr(b.name)}` : "-";

    setForm((p) => ({
      ...p,
      staff_id: String(s.id),
      employee_id: String(s.id),
      employee_name: toStr(s.fullname),
      prev_branch: prevBranchLabel,
    }));
  };

  const totalBenefits = useMemo(() => {
    return (
      toNum(form.cbu) +
      toNum(form.cashbond) +
      toNum(form.utility) +
      toNum(form.thirteenth_month_pay) +
      toNum(form.last_pay) +
      toNum(form.separation_pay) +
      toNum(form.cash_assistance)
    );
  }, [form]);

  const liabilitiesNum = useMemo(() => toNum(form.liabilities), [form.liabilities]);

  const netSettlement = useMemo(() => totalBenefits - liabilitiesNum, [totalBenefits, liabilitiesNum]);

  const createSettlement = async (e) => {
    e.preventDefault();

    if (!toStr(form.staff_id)) return alert("Select staff.");
    if (!toStr(form.employee_id) || !toStr(form.employee_name)) return alert("Employee fields not set.");

    setSaving(true);
    try {
      await api.post("/settlements", {
        staff_id: Number(form.staff_id),

        prev_branch: toStr(form.prev_branch),
        employee_id: Number(form.employee_id),
        employee_name: toStr(form.employee_name),

        cbu: toNum(form.cbu),
        cashbond: toNum(form.cashbond),
        utility: toNum(form.utility),
        liabilities: toNum(form.liabilities),
        thirteenth_month_pay: toNum(form.thirteenth_month_pay),
        last_pay: toNum(form.last_pay),

        separation_pay: form.separation_pay === "" ? null : toNum(form.separation_pay),
        cash_assistance: form.cash_assistance === "" ? null : toNum(form.cash_assistance),

        total_benefits: totalBenefits,
        net_settlement: netSettlement,
      });

      alert("Settlement saved.");
      setShowCreate(false);
      resetForm();
      await loadSettlements();
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to save settlement.");
    } finally {
      setSaving(false);
    }
  };

  const deleteSettlement = async (id) => {
    if (!window.confirm("Delete this settlement record?")) return;
    try {
      await api.delete(`/settlements/${id}`);
      await loadSettlements();
    } catch {
      alert("Delete failed.");
    }
  };

  const money = (v) => toNum(v).toLocaleString();

  return (
    <div className="approval-page">
      <div className="approval-page-header">
        <div>
          <h2 className="approval-title">Statement of Accounts</h2>
          <p className="approval-subtitle">Create and review settlement computations</p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="btn-secondary" onClick={() => navigate(-1)} type="button">
            ← Back
          </button>

          <button className="btn-primary" onClick={() => setShowCreate(true)} type="button">
            + Create Settlement
          </button>
        </div>
      </div>

      <div className="table-card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Employee</th>
                <th>Prev Branch</th>
                <th>Benefits</th>
                <th>Liabilities</th>
                <th>Net</th>
                <th>Created</th>
                <th style={{ width: 220 }}>Action</th>
              </tr>
            </thead>

            <tbody>
              {loadingList ? (
                <tr>
                  <td colSpan={8} className="empty-state">
                    Loading…
                  </td>
                </tr>
              ) : settlements.length === 0 ? (
                <tr>
                  <td colSpan={8} className="empty-state">
                    No settlement records found.
                  </td>
                </tr>
              ) : (
                settlements.map((r) => (
                  <tr key={r.id}>
                    <td>{r.id}</td>
                    <td className="td-strong">
                      {r.employee_name || "-"}
                      <div style={{ fontSize: 12, opacity: 0.8 }}>Employee ID: {r.employee_id || "-"}</div>
                    </td>
                    <td>{r.prev_branch || "-"}</td>
                    <td>{money(r.total_benefits)}</td>
                    <td>{money(r.liabilities)}</td>
                    <td>{money(r.net_settlement)}</td>
                    <td>{fmtDate(r.created_at)}</td>
                    <td>
                      <div className="row-actions">
                        <button className="btn-secondary" type="button" onClick={() => setViewRow(r)}>
                          View
                        </button>
                        <button className="btn-danger" type="button" onClick={() => deleteSettlement(r.id)}>
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

      {showCreate && (
        <div className="modal-overlay" onMouseDown={(e) => e.target.classList.contains("modal-overlay") && setShowCreate(false)}>
          <div className="modal saas-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h3 className="modal-title">Create Settlement</h3>
                <p className="modal-subtitle">Employee and Previous Branch are auto-filled from staff</p>
              </div>
              <button className="modal-x" type="button" onClick={() => setShowCreate(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={createSettlement} className="modal-form">
              <div className="modal-grid">
                <div className="form-group full">
                  <label>Staff</label>
                  <select value={form.staff_id} onChange={(e) => pickStaff(e.target.value)} required>
                    <option value="">Select staff</option>
                    {staffList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {(s.employee_no ? `${s.employee_no} - ` : "") + s.fullname}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Employee ID</label>
                  <input value={form.employee_id} readOnly placeholder="Auto-filled" />
                </div>

                <div className="form-group">
                  <label>Employee Name</label>
                  <input value={form.employee_name} readOnly placeholder="Auto-filled" />
                </div>

                <div className="form-group full">
                  <label>Previous Branch</label>
                  <input value={form.prev_branch} readOnly placeholder="Auto-filled" />
                </div>

                <div className="form-group">
                  <label>CBU</label>
                  <input type="number" step="0.01" name="cbu" value={form.cbu} onChange={onChange} />
                </div>

                <div className="form-group">
                  <label>Cashbond</label>
                  <input type="number" step="0.01" name="cashbond" value={form.cashbond} onChange={onChange} />
                </div>

                <div className="form-group">
                  <label>Utility</label>
                  <input type="number" step="0.01" name="utility" value={form.utility} onChange={onChange} />
                </div>

                <div className="form-group">
                  <label>Liabilities</label>
                  <input type="number" step="0.01" name="liabilities" value={form.liabilities} onChange={onChange} />
                </div>

                <div className="form-group">
                  <label>13th Month Pay</label>
                  <input type="number" step="0.01" name="thirteenth_month_pay" value={form.thirteenth_month_pay} onChange={onChange} />
                </div>

                <div className="form-group">
                  <label>Last Pay</label>
                  <input type="number" step="0.01" name="last_pay" value={form.last_pay} onChange={onChange} />
                </div>

                <div className="form-group">
                  <label>Separation Pay (Optional)</label>
                  <input type="number" step="0.01" name="separation_pay" value={form.separation_pay} onChange={onChange} placeholder="0 or blank" />
                </div>

                <div className="form-group">
                  <label>Cash Assistance (Optional)</label>
                  <input type="number" step="0.01" name="cash_assistance" value={form.cash_assistance} onChange={onChange} placeholder="0 or blank" />
                </div>
              </div>

              <div style={{ padding: "10px 0", display: "flex", gap: 12, flexWrap: "wrap" }}>
                <div className="pill">
                  Benefits: <strong>{money(totalBenefits)}</strong>
                </div>
                <div className="pill">
                  Liabilities: <strong>{money(liabilitiesNum)}</strong>
                </div>
                <div className="pill">
                  Net Settlement: <strong>{money(netSettlement)}</strong>
                </div>
              </div>

              <div className="modal-buttons">
                <button className="btn-secondary" type="button" onClick={() => setShowCreate(false)}>
                  Cancel
                </button>
                <button className="btn-primary" type="submit" disabled={saving}>
                  {saving ? "Saving..." : "Save Settlement"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewRow && (
        <div className="modal-overlay" onMouseDown={() => setViewRow(null)}>
          <div className="modal saas-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h3 className="modal-title">Settlement Record</h3>
                <p className="modal-subtitle">
                  {viewRow.employee_name} • Employee ID: {viewRow.employee_id} • Prev Branch: {viewRow.prev_branch}
                </p>
              </div>
              <button className="modal-x" type="button" onClick={() => setViewRow(null)}>
                ✕
              </button>
            </div>

            <div style={{ padding: 16 }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
                <div className="pill">
                  Benefits: <strong>{money(viewRow.total_benefits)}</strong>
                </div>
                <div className="pill">
                  Liabilities: <strong>{money(viewRow.liabilities)}</strong>
                </div>
                <div className="pill">
                  Net Settlement: <strong>{money(viewRow.net_settlement)}</strong>
                </div>
              </div>

              <table className="table">
                <tbody>
                  <tr><td>CBU</td><td>{money(viewRow.cbu)}</td></tr>
                  <tr><td>Cashbond</td><td>{money(viewRow.cashbond)}</td></tr>
                  <tr><td>Utility</td><td>{money(viewRow.utility)}</td></tr>
                  <tr><td>Liabilities</td><td>{money(viewRow.liabilities)}</td></tr>
                  <tr><td>13th Month Pay</td><td>{money(viewRow.thirteenth_month_pay)}</td></tr>
                  <tr><td>Last Pay</td><td>{money(viewRow.last_pay)}</td></tr>
                  <tr><td>Separation Pay</td><td>{money(viewRow.separation_pay)}</td></tr>
                  <tr><td>Cash Assistance</td><td>{money(viewRow.cash_assistance)}</td></tr>
                  <tr><td>Created</td><td>{fmtDate(viewRow.created_at)}</td></tr>
                </tbody>
              </table>
            </div>

            <div className="modal-buttons">
              <button className="btn-primary" type="button" onClick={() => setViewRow(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}