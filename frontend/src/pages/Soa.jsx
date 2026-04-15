import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  const staffBoxRef = useRef(null);

  const [staffList, setStaffList] = useState([]);
  const [branches, setBranches] = useState([]);

  const [settlements, setSettlements] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [saving, setSaving] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [viewRow, setViewRow] = useState(null);

  const [staffSearch, setStaffSearch] = useState("");
  const [showStaffDropdown, setShowStaffDropdown] = useState(false);

  const [form, setForm] = useState({
    staff_id: "",
    prev_branch: "",
    employee_no: "",
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

  const filteredStaff = useMemo(() => {
    const q = staffSearch.toLowerCase();

    if (!q) return staffList.slice(0, 20);

    return staffList.filter((s) => {
      const hay = [
        s.id,
        s.employee_no,
        s.fullname,
        s.first_name,
        s.last_name,
        s.middle_name,
        s.position,
      ]
        .map((x) => toStr(x).toLowerCase())
        .join(" ");

      return hay.includes(q);
    });
  }, [staffSearch, staffList]);

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

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        setShowCreate(false);
        setShowStaffDropdown(false);
      }
    };

    const onMouseDown = (e) => {
      if (staffBoxRef.current && !staffBoxRef.current.contains(e.target)) {
        setShowStaffDropdown(false);
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
  }, [showCreate]);

  const resetForm = () => {
    setForm({
      staff_id: "",
      prev_branch: "",
      employee_no: "",
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
    setStaffSearch("");
    setShowStaffDropdown(false);
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
      employee_no: toStr(s.employee_no),
      employee_name: toStr(s.fullname),
      prev_branch: prevBranchLabel,
    }));

    setStaffSearch(
      `${toStr(s.employee_no) || s.id} — ${toStr(s.fullname)}`
    );
    setShowStaffDropdown(false);
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
    if (!toStr(form.employee_no) || !toStr(form.employee_name)) {
      return alert("Employee fields not set.");
    }

    setSaving(true);
    try {
      await api.post("/settlements", {
        staff_id: Number(form.staff_id),

        prev_branch: toStr(form.prev_branch),
        employee_no: toStr(form.employee_no),
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
                      <div style={{ fontSize: 12, opacity: 0.8 }}>
                        Employee No: {r.employee_no || "-"}
                      </div>
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
        <div
          className="modal-overlay"
          onMouseDown={(e) => e.target.classList.contains("modal-overlay") && setShowCreate(false)}
        >
          <div className="modal saas-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h3 className="modal-title">Create Settlement</h3>
                <p className="modal-subtitle">Employee No, Employee Name, and Previous Branch are auto-filled from staff</p>
              </div>
              <button
                className="modal-x"
                type="button"
                onClick={() => {
                  setShowCreate(false);
                  resetForm();
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={createSettlement} className="modal-form">
              <div className="modal-grid">
                <div className="form-group full" ref={staffBoxRef} style={{ position: "relative" }}>
                  <label>Staff</label>

                  <input
                    type="text"
                    placeholder="Search staff..."
                    value={staffSearch}
                    onChange={(e) => {
                      const value = e.target.value;
                      setStaffSearch(value);
                      setShowStaffDropdown(true);

                      setForm((p) => ({
                        ...p,
                        staff_id: "",
                        prev_branch: "",
                        employee_no: "",
                        employee_name: "",
                      }));
                    }}
                    onFocus={() => setShowStaffDropdown(true)}
                    required={!form.staff_id}
                  />

                  {showStaffDropdown && (
                    <div
                      style={{
                        position: "absolute",
                        top: "100%",
                        left: 0,
                        right: 0,
                        background: "#0f172a",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 10,
                        maxHeight: 220,
                        overflowY: "auto",
                        zIndex: 50,
                        boxShadow: "0 12px 30px rgba(0,0,0,0.25)",
                        marginTop: 6,
                      }}
                    >
                      {filteredStaff.length === 0 ? (
                        <div style={{ padding: 10, color: "#cbd5e1" }}>No staff found</div>
                      ) : (
                        filteredStaff.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => pickStaff(s.id)}
                            style={{
                              width: "100%",
                              textAlign: "left",
                              padding: "10px 12px",
                              border: "none",
                              borderBottom: "1px solid rgba(255,255,255,0.08)",
                              background: "transparent",
                              color: "white",
                              cursor: "pointer",
                            }}
                          >
                            {toStr(s.employee_no) || s.id} — {toStr(s.fullname)}
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
                  <input
                    type="number"
                    step="0.01"
                    name="thirteenth_month_pay"
                    value={form.thirteenth_month_pay}
                    onChange={onChange}
                  />
                </div>

                <div className="form-group">
                  <label>Last Pay</label>
                  <input type="number" step="0.01" name="last_pay" value={form.last_pay} onChange={onChange} />
                </div>

                <div className="form-group">
                  <label>Separation Pay (Optional)</label>
                  <input
                    type="number"
                    step="0.01"
                    name="separation_pay"
                    value={form.separation_pay}
                    onChange={onChange}
                    placeholder="0 or blank"
                  />
                </div>

                <div className="form-group">
                  <label>Cash Assistance (Optional)</label>
                  <input
                    type="number"
                    step="0.01"
                    name="cash_assistance"
                    value={form.cash_assistance}
                    onChange={onChange}
                    placeholder="0 or blank"
                  />
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
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={() => {
                    setShowCreate(false);
                    resetForm();
                  }}
                >
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
                  {viewRow.employee_name} • Employee No: {viewRow.employee_no} • Prev Branch: {viewRow.prev_branch}
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
                  <tr><td>Employee No</td><td>{viewRow.employee_no || "-"}</td></tr>
                  <tr><td>Employee Name</td><td>{viewRow.employee_name || "-"}</td></tr>
                  <tr><td>Previous Branch</td><td>{viewRow.prev_branch || "-"}</td></tr>
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