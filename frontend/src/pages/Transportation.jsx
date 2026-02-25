import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "../styles/Transportation.css";
import api from "../api/axiosClient";

const toNum = (v) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const norm = (v) => String(v ?? "").trim().toLowerCase();

function Transportation() {
  const { id } = useParams(); // branch id from route: /transportation/:id
  const navigate = useNavigate();

  const [branch, setBranch] = useState(null);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(""); // UI only (backend not filtering yet)
  const [error, setError] = useState("");

  const money = (v) => toNum(v).toLocaleString();

  useEffect(() => {
    const run = async () => {
      if (!id) {
        setError("No branch ID provided.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        // 1) get branches list then pick the branch
        const branchesRes = await api.get("/branches");
        const branches = Array.isArray(branchesRes.data) ? branchesRes.data : [];
        const b = branches.find((x) => Number(x.id) === Number(id));

        if (!b) {
          setError("Branch not found.");
          setLoading(false);
          return;
        }

        setBranch(b);

        // 2) get staff list then filter by branch_id (preferred), fallback by area
        const staffRes = await api.get("/staff");
        const all = Array.isArray(staffRes.data) ? staffRes.data : [];

        const byBranchId = all.filter((s) => Number(s.branch_id) === Number(b.id));
        const filtered =
          byBranchId.length > 0
            ? byBranchId
            : all.filter((s) => norm(s.area) === norm(b.area));

        // month currently not supported by backend; if you later support it, filter here too.
        setStaff(filtered);
      } catch (err) {
        const status = err?.response?.status;
        if (status === 404) setError("Branch not found.");
        else if (status === 401) setError("Session expired. Please login again.");
        else if (status === 403) setError("Access denied.");
        else setError(err?.response?.data?.message || "Error fetching data from server.");
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [id, month]);

  const rows = useMemo(() => {
    return (staff || []).map((s) => {
      const postage = toNum(s.postage);
      const transportation = toNum(s.transportation);
      const additionalTarget = toNum(s.additional_target);
      const repairing = toNum(s.repairing);
      const additionalMonitoring = toNum(s.additional_monitoring);

      const motorcycle = toNum(s.motorcycle_loan);
      const other = toNum(s.other_deduction);

      const totalAllowance = postage + transportation + additionalTarget + repairing + additionalMonitoring;
      const totalDeduction = motorcycle + other;
      const netPay = totalAllowance - totalDeduction;

      return {
        id: s.id,
        fullname: s.fullname,
        position: s.position,
        regularization_date: s.regularization_date,

        postage,
        transportation,
        additionalTarget,
        repairing,
        additionalMonitoring,
        totalAllowance,

        motorcycle,
        other,
        totalDeduction,

        netPay,
        netPay10: netPay / 2,
        netPay25: netPay / 2,
      };
    });
  }, [staff]);

  const totals = useMemo(() => {
    return rows.reduce(
      (t, r) => {
        t.postage += r.postage;
        t.transportation += r.transportation;
        t.additionalTarget += r.additionalTarget;
        t.repairing += r.repairing;
        t.additionalMonitoring += r.additionalMonitoring;
        t.totalAllowance += r.totalAllowance;
        t.motorcycle += r.motorcycle;
        t.other += r.other;
        t.totalDeduction += r.totalDeduction;
        t.netPay += r.netPay;
        t.netPay10 += r.netPay10;
        t.netPay25 += r.netPay25;
        return t;
      },
      {
        postage: 0,
        transportation: 0,
        additionalTarget: 0,
        repairing: 0,
        additionalMonitoring: 0,
        totalAllowance: 0,
        motorcycle: 0,
        other: 0,
        totalDeduction: 0,
        netPay: 0,
        netPay10: 0,
        netPay25: 0,
      }
    );
  }, [rows]);

  if (loading) {
    return (
      <div className="transpo-page">
        <div className="transpo-card">
          <div className="transpo-loading">Loading report…</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="transpo-page">
        <div className="transpo-card">
          <div className="transpo-error">{error}</div>
          <button className="btn-secondary" onClick={() => navigate(-1)} type="button">
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="transpo-page">
      <div className="transpo-page-header">
        <div>
          <h2 className="transpo-title">Transportation Report</h2>
          <p className="transpo-subtitle">
            {branch ? `${branch.code} • ${branch.name} • ${branch.area}` : ""}
          </p>
        </div>

        <div className="transpo-actions">
          <button className="btn-secondary" onClick={() => navigate(-1)} type="button">
            ← Back
          </button>
          <button className="btn-primary" onClick={() => window.print()} type="button">
            Print
          </button>
        </div>
      </div>

      <div className="transpo-card">
        <div className="transpo-card-head">
          <div className="transpo-card-title">Allowances, Deductions & Net Pay</div>

          <div className="transpo-controls">
            <label className="month-label">
              Payroll Month
              <input className="month-input" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
            </label>
          </div>
        </div>

        <div className="transpo-table-wrap">
          <table className="transpo-table">
            <thead>
              <tr>
                <th rowSpan={2}>ID</th>
                <th rowSpan={2}>Staff Name</th>
                <th rowSpan={2}>Position</th>
                <th rowSpan={2}>Date Regularized</th>

                <th colSpan={6}>Allowances & Incentives</th>
                <th colSpan={3}>Deductions</th>
                <th colSpan={3}>Net Pay</th>
              </tr>

              <tr>
                <th>Postage</th>
                <th>Transportation</th>
                <th>Target / 1200 / Less Excuses </th>
                <th>Repairing</th>
                <th>Monitoring</th>
                <th>Total Allowance</th>

                <th>Motorcycle</th>
                <th>Other</th>
                <th>Total Deduction</th>

                <th>Total Net Pay</th>
                <th>10th</th>
                <th>25th</th>
              </tr>
            </thead>

            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={16} className="empty-state">
                    No staff found for this branch.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id}>
                    <td className="mono">{r.id}</td>
                    <td className="td-strong td-left">{r.fullname}</td>
                    <td>{r.position || "-"}</td>
                    <td>{r.regularization_date ? String(r.regularization_date).split("T")[0] : "-"}</td>

                    <td>₱ {money(r.postage)}</td>
                    <td>₱ {money(r.transportation)}</td>
                    <td>₱ {money(r.additionalTarget)}</td>
                    <td>₱ {money(r.repairing)}</td>
                    <td>₱ {money(r.additionalMonitoring)}</td>
                    <td className="td-strong">₱ {money(r.totalAllowance)}</td>

                    <td>₱ {money(r.motorcycle)}</td>
                    <td>₱ {money(r.other)}</td>
                    <td className="td-strong">₱ {money(r.totalDeduction)}</td>

                    <td className={`td-strong ${r.netPay < 0 ? "neg" : "pos"}`}>₱ {money(r.netPay)}</td>
                    <td className={`${r.netPay10 < 0 ? "neg" : "pos"}`}>₱ {money(r.netPay10)}</td>
                    <td className={`${r.netPay25 < 0 ? "neg" : "pos"}`}>₱ {money(r.netPay25)}</td>
                  </tr>
                ))
              )}

              {rows.length > 0 && (
                <tr className="totals-row">
                  <td colSpan={4} className="totals-label">Total</td>

                  <td>₱ {money(totals.postage)}</td>
                  <td>₱ {money(totals.transportation)}</td>
                  <td>₱ {money(totals.additionalTarget)}</td>
                  <td>₱ {money(totals.repairing)}</td>
                  <td>₱ {money(totals.additionalMonitoring)}</td>
                  <td className="td-strong">₱ {money(totals.totalAllowance)}</td>

                  <td>₱ {money(totals.motorcycle)}</td>
                  <td>₱ {money(totals.other)}</td>
                  <td className="td-strong">₱ {money(totals.totalDeduction)}</td>

                  <td className="td-strong">₱ {money(totals.netPay)}</td>
                  <td className="td-strong">₱ {money(totals.netPay10)}</td>
                  <td className="td-strong">₱ {money(totals.netPay25)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="transpo-hint">Tip: scroll horizontally to view all columns.</div>
      </div>
    </div>
  );
}

export default Transportation;