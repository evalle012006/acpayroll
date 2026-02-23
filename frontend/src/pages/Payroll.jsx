import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "../styles/Payroll.css";
import api from "../api/axiosClient";

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

function Payroll() {
  const { branchId } = useParams();
  const navigate = useNavigate();

  const [staff, setStaff] = useState([]);
  const [branch, setBranch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError("");
      try {
        const [bRes, pRes] = await Promise.all([
          api.get(`/branches/${Number(branchId)}`),
          api.get(`/payroll/${Number(branchId)}`),
        ]);

        setBranch(bRes.data || null);
        setStaff(Array.isArray(pRes.data) ? pRes.data : []);
      } catch (err) {
        const msg = err?.response?.data?.message || err.message || "Failed to load payroll.";
        setError(msg);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [branchId]);

  const computedRows = useMemo(() => {
    return staff.map((s) => {
      const salary = toNum(s.salary);
      const ecola = toNum(s.ecola);
      const totalComp = salary + ecola;

      const total_ee = toNum(s.total_ee);
      const total_deduction =
        total_ee +
        toNum(s.tax) +
        toNum(s.utility_charge) +
        toNum(s.cbu) +
        toNum(s.cashbond) +
        toNum(s.salary_advance) +
        toNum(s.motorcycle_loan) +
        toNum(s.special_advance) +
        toNum(s.cash_advance) +
        toNum(s.other_receivable) +
        toNum(s.pagibig_mpl) +
        toNum(s.sss_loan) +
        toNum(s.staff_accounts_payable);

      const netPay = totalComp - total_deduction;

      return {
        ...s,
        salary,
        ecola,
        totalComp,
        total_deduction,
        netPay,
        netPayHalf: netPay / 2,
      };
    });
  }, [staff]);

  const sumColumn = (key) => computedRows.reduce((sum, s) => sum + toNum(s[key]), 0);

  if (loading) {
    return (
      <div className="payroll-page">
        <div className="payroll-card">
          <div className="payroll-loading">Loading payroll…</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="payroll-page">
        <div className="payroll-card">
          <div className="payroll-error">{error}</div>
          <button className="btn-secondary" onClick={() => navigate(-1)} type="button">
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="payroll-page">
      <div className="payroll-page-header">
        <div>
          <h2 className="payroll-title">Payroll Report</h2>
          <p className="payroll-subtitle">
            {branch ? `${branch.code} • ${branch.name} • ${branch.area}` : ""}
          </p>
        </div>

        <div className="payroll-actions">
          <button className="btn-secondary" onClick={() => navigate(-1)} type="button">
            ← Back
          </button>
          <button className="btn-primary" onClick={() => window.print()} type="button">
            Print
          </button>
        </div>
      </div>

      <div className="payroll-card">
        <div className="payroll-card-head">
          <div className="payroll-card-title">Salary and Wages</div>
          <div className="payroll-meta">
            Employees: <strong>{computedRows.length}</strong>
          </div>
        </div>

        <div className="payroll-table-wrap">
          <table className="payroll-table">
            <thead>
              <tr>
                <th rowSpan={2}>ID</th>
                <th rowSpan={2}>Full Name</th>
                <th rowSpan={2}>Position</th>
                <th rowSpan={2}>Date Regularized</th>

                <th colSpan={3}>EARNINGS</th>
                <th colSpan={4}>EMPLOYER (ER)</th>
                <th colSpan={4}>EMPLOYEE (EE)</th>
                <th colSpan={12}>DEDUCTIONS</th>

                <th rowSpan={2}>Total Deduction</th>
                <th rowSpan={2}>Net Pay</th>
                <th rowSpan={2}>10th</th>
                <th rowSpan={2}>25th</th>
              </tr>

              <tr>
                <th>Salary</th>
                <th>Ecola</th>
                <th>Total Comp</th>

                <th>HDMF</th>
                <th>SSS</th>
                <th>PH</th>
                <th>Total ER</th>

                <th>HDMF</th>
                <th>SSS</th>
                <th>PH</th>
                <th>Total EE</th>

                <th>Tax</th>
                <th>Utility</th>
                <th>CBU</th>
                <th>Cash Bond</th>
                <th>Salary Adv</th>
                <th>Motorcycle</th>
                <th>Special Adv</th>
                <th>Cash Adv</th>
                <th>Other Rec</th>
                <th>Pag-IBIG</th>
                <th>SSS Loan</th>
                <th>Staff A/P</th>
              </tr>
            </thead>

            <tbody>
              {computedRows.map((s) => (
                <tr key={s.id}>
                  <td className="mono">{s.id}</td>
                  <td className="td-strong">{s.fullname}</td>
                  <td>{s.position}</td>
                  <td>{s.regularization_date ? String(s.regularization_date).split("T")[0] : "-"}</td>

                  <td>{s.salary.toLocaleString()}</td>
                  <td>{s.ecola.toLocaleString()}</td>
                  <td className="td-strong">{s.totalComp.toLocaleString()}</td>

                  <td>{toNum(s.hdmf_er).toLocaleString()}</td>
                  <td>{toNum(s.sss_er).toLocaleString()}</td>
                  <td>{toNum(s.ph_er).toLocaleString()}</td>
                  <td className="td-strong">{toNum(s.total_er).toLocaleString()}</td>

                  <td>{toNum(s.hdmf_ee).toLocaleString()}</td>
                  <td>{toNum(s.sss_ee).toLocaleString()}</td>
                  <td>{toNum(s.ph_ee).toLocaleString()}</td>
                  <td className="td-strong">{toNum(s.total_ee).toLocaleString()}</td>

                  <td>{toNum(s.tax).toLocaleString()}</td>
                  <td>{toNum(s.utility_charge).toLocaleString()}</td>
                  <td>{toNum(s.cbu).toLocaleString()}</td>
                  <td>{toNum(s.cashbond).toLocaleString()}</td>
                  <td>{toNum(s.salary_advance).toLocaleString()}</td>
                  <td>{toNum(s.motorcycle_loan).toLocaleString()}</td>
                  <td>{toNum(s.special_advance).toLocaleString()}</td>
                  <td>{toNum(s.cash_advance).toLocaleString()}</td>
                  <td>{toNum(s.other_receivable).toLocaleString()}</td>
                  <td>{toNum(s.pagibig_mpl).toLocaleString()}</td>
                  <td>{toNum(s.sss_loan).toLocaleString()}</td>
                  <td>{toNum(s.staff_accounts_payable).toLocaleString()}</td>

                  <td className="td-strong">{toNum(s.total_deduction).toLocaleString()}</td>

                  <td className={`td-strong ${s.netPay < 0 ? "neg" : "pos"}`}>{toNum(s.netPay).toLocaleString()}</td>
                  <td className={`td-strong ${s.netPayHalf < 0 ? "neg" : "pos"}`}>{toNum(s.netPayHalf).toLocaleString()}</td>
                  <td className={`td-strong ${s.netPayHalf < 0 ? "neg" : "pos"}`}>{toNum(s.netPayHalf).toLocaleString()}</td>
                </tr>
              ))}

              <tr className="totals-row">
                <td colSpan={4} className="totals-label">Totals</td>
                <td>{sumColumn("salary").toLocaleString()}</td>
                <td>{sumColumn("ecola").toLocaleString()}</td>
                <td className="td-strong">{(sumColumn("salary") + sumColumn("ecola")).toLocaleString()}</td>

                <td>{sumColumn("hdmf_er").toLocaleString()}</td>
                <td>{sumColumn("sss_er").toLocaleString()}</td>
                <td>{sumColumn("ph_er").toLocaleString()}</td>
                <td className="td-strong">{sumColumn("total_er").toLocaleString()}</td>

                <td>{sumColumn("hdmf_ee").toLocaleString()}</td>
                <td>{sumColumn("sss_ee").toLocaleString()}</td>
                <td>{sumColumn("ph_ee").toLocaleString()}</td>
                <td className="td-strong">{sumColumn("total_ee").toLocaleString()}</td>

                <td>{sumColumn("tax").toLocaleString()}</td>
                <td>{sumColumn("utility_charge").toLocaleString()}</td>
                <td>{sumColumn("cbu").toLocaleString()}</td>
                <td>{sumColumn("cashbond").toLocaleString()}</td>
                <td>{sumColumn("salary_advance").toLocaleString()}</td>
                <td>{sumColumn("motorcycle_loan").toLocaleString()}</td>
                <td>{sumColumn("special_advance").toLocaleString()}</td>
                <td>{sumColumn("cash_advance").toLocaleString()}</td>
                <td>{sumColumn("other_receivable").toLocaleString()}</td>
                <td>{sumColumn("pagibig_mpl").toLocaleString()}</td>
                <td>{sumColumn("sss_loan").toLocaleString()}</td>
                <td>{sumColumn("staff_accounts_payable").toLocaleString()}</td>

                <td className="td-strong">{sumColumn("total_deduction").toLocaleString()}</td>
                <td className="td-strong">{sumColumn("netPay").toLocaleString()}</td>
                <td className="td-strong">{(sumColumn("netPay") / 2).toLocaleString()}</td>
                <td className="td-strong">{(sumColumn("netPay") / 2).toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="payroll-hint">Tip: scroll horizontally to view all columns.</div>
      </div>
    </div>
  );
}

export default Payroll;