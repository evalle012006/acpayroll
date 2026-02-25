import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "../styles/Payroll.css";
import api from "../api/axiosClient";

const toNum = (v) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};
const norm = (v) => String(v ?? "").trim().toLowerCase();
const fmt = (n) => toNum(n).toLocaleString();
const fmtDate = (d) => (d ? String(d).split("T")[0] : "-");

function Payroll() {
  const params = useParams();
  const branchId = params.branchId ?? params.id;
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
        const [branchesRes, staffRes] = await Promise.all([api.get("/branches"), api.get("/staff")]);

        const branches = Array.isArray(branchesRes.data) ? branchesRes.data : [];
        const foundBranch = branches.find((x) => Number(x.id) === Number(branchId));
        if (!foundBranch) {
          setError("Branch not found.");
          setLoading(false);
          return;
        }
        setBranch(foundBranch);

        const allStaff = Array.isArray(staffRes.data) ? staffRes.data : [];
        const byBranchId = allStaff.filter((s) => Number(s.branch_id) === Number(branchId));
        const filtered =
          byBranchId.length > 0
            ? byBranchId
            : allStaff.filter((s) => norm(s.area) === norm(foundBranch.area));

        setStaff(filtered);
      } catch (err) {
        const status = err?.response?.status;
        if (status === 401) setError("Session expired. Please login again.");
        else if (status === 403) setError("Access denied.");
        else setError(err?.response?.data?.message || err.message || "Failed to load payroll.");
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [branchId]);

  const computedRows = useMemo(() => {
    return (staff || []).map((s) => {
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

  const printedAt = new Date().toLocaleString();

  return (
    <div className="payroll-page">
      {/* SCREEN HEADER */}
      <div className="payroll-page-header no-print">
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

      {/* SCREEN TABLE (unchanged) */}
      <div className="payroll-card no-print">
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
                  <td>{fmtDate(s.regularization_date)}</td>

                  <td className="num">{fmt(s.salary)}</td>
                  <td className="num">{fmt(s.ecola)}</td>
                  <td className="num td-strong">{fmt(s.totalComp)}</td>

                  <td className="num">{fmt(s.hdmf_er)}</td>
                  <td className="num">{fmt(s.sss_er)}</td>
                  <td className="num">{fmt(s.ph_er)}</td>
                  <td className="num td-strong">{fmt(s.total_er)}</td>

                  <td className="num">{fmt(s.hdmf_ee)}</td>
                  <td className="num">{fmt(s.sss_ee)}</td>
                  <td className="num">{fmt(s.ph_ee)}</td>
                  <td className="num td-strong">{fmt(s.total_ee)}</td>

                  <td className="num">{fmt(s.tax)}</td>
                  <td className="num">{fmt(s.utility_charge)}</td>
                  <td className="num">{fmt(s.cbu)}</td>
                  <td className="num">{fmt(s.cashbond)}</td>
                  <td className="num">{fmt(s.salary_advance)}</td>
                  <td className="num">{fmt(s.motorcycle_loan)}</td>
                  <td className="num">{fmt(s.special_advance)}</td>
                  <td className="num">{fmt(s.cash_advance)}</td>
                  <td className="num">{fmt(s.other_receivable)}</td>
                  <td className="num">{fmt(s.pagibig_mpl)}</td>
                  <td className="num">{fmt(s.sss_loan)}</td>
                  <td className="num">{fmt(s.staff_accounts_payable)}</td>

                  <td className="num td-strong">{fmt(s.total_deduction)}</td>

                  <td className={`num td-strong ${s.netPay < 0 ? "neg" : "pos"}`}>{fmt(s.netPay)}</td>
                  <td className={`num td-strong ${s.netPayHalf < 0 ? "neg" : "pos"}`}>{fmt(s.netPayHalf)}</td>
                  <td className={`num td-strong ${s.netPayHalf < 0 ? "neg" : "pos"}`}>{fmt(s.netPayHalf)}</td>
                </tr>
              ))}

              <tr className="totals-row">
                <td colSpan={4} className="totals-label">Totals</td>
                <td className="num">{sumColumn("salary").toLocaleString()}</td>
                <td className="num">{sumColumn("ecola").toLocaleString()}</td>
                <td className="num td-strong">
                  {(sumColumn("salary") + sumColumn("ecola")).toLocaleString()}
                </td>

                <td className="num">{sumColumn("hdmf_er").toLocaleString()}</td>
                <td className="num">{sumColumn("sss_er").toLocaleString()}</td>
                <td className="num">{sumColumn("ph_er").toLocaleString()}</td>
                <td className="num td-strong">{sumColumn("total_er").toLocaleString()}</td>

                <td className="num">{sumColumn("hdmf_ee").toLocaleString()}</td>
                <td className="num">{sumColumn("sss_ee").toLocaleString()}</td>
                <td className="num">{sumColumn("ph_ee").toLocaleString()}</td>
                <td className="num td-strong">{sumColumn("total_ee").toLocaleString()}</td>

                <td className="num">{sumColumn("tax").toLocaleString()}</td>
                <td className="num">{sumColumn("utility_charge").toLocaleString()}</td>
                <td className="num">{sumColumn("cbu").toLocaleString()}</td>
                <td className="num">{sumColumn("cashbond").toLocaleString()}</td>
                <td className="num">{sumColumn("salary_advance").toLocaleString()}</td>
                <td className="num">{sumColumn("motorcycle_loan").toLocaleString()}</td>
                <td className="num">{sumColumn("special_advance").toLocaleString()}</td>
                <td className="num">{sumColumn("cash_advance").toLocaleString()}</td>
                <td className="num">{sumColumn("other_receivable").toLocaleString()}</td>
                <td className="num">{sumColumn("pagibig_mpl").toLocaleString()}</td>
                <td className="num">{sumColumn("sss_loan").toLocaleString()}</td>
                <td className="num">{sumColumn("staff_accounts_payable").toLocaleString()}</td>

                <td className="num td-strong">{sumColumn("total_deduction").toLocaleString()}</td>
                <td className="num td-strong">{sumColumn("netPay").toLocaleString()}</td>
                <td className="num td-strong">{(sumColumn("netPay") / 2).toLocaleString()}</td>
                <td className="num td-strong">{(sumColumn("netPay") / 2).toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="payroll-hint">Tip: scroll horizontally to view all columns.</div>
      </div>

      {/* PRINT: MULTIPLE PAYSLIPS (1 staff = 1 page) */}
      <div className="print-only">
        <div className="payslip-batch">
          {computedRows.map((s) => {
            const grossPay = toNum(s.totalComp);
            const totalDed = toNum(s.total_deduction);
            const netPay = toNum(s.netPay);

            const deductions = [
              ["Tax", s.tax],
              ["Utility Charge", s.utility_charge],
              ["CBU", s.cbu],
              ["Cashbond", s.cashbond],
              ["Salary Advance", s.salary_advance],
              ["Motorcycle Loan", s.motorcycle_loan],
              ["Special Advance", s.special_advance],
              ["Cash Advance", s.cash_advance],
              ["Other Receivable", s.other_receivable],
              ["Pag-IBIG MPL", s.pagibig_mpl],
              ["SSS Loan", s.sss_loan],
              ["Staff Accounts Payable", s.staff_accounts_payable],
            ].filter(([, v]) => toNum(v) !== 0);

            return (
              <section key={s.id} className="payslip-page">
                <div className="payslip">
                  <div className="ps-head">
                    <div>
                      <div className="ps-company">AmberCash PH Micro Lending Corp.</div>
                      <div className="ps-sub">Payroll • Salary Details</div>
                    </div>
                    <div className="ps-meta">
                      <div><span>Date:</span> {printedAt}</div>
                      <div><span>Employee ID:</span> {s.id}</div>
                      <div><span>Area:</span> {branch?.area || "-"}</div>
                    </div>
                  </div>

                  <div className="ps-info">
                    <div className="ps-info-row">
                      <div><span>Employee Name</span><b>{s.fullname}</b></div>
                      <div><span>Position</span><b>{s.position || "-"}</b></div>
                      <div><span>Date Regularized</span><b>{fmtDate(s.regularization_date)}</b></div>
                    </div>
                    <div className="ps-info-row">
                      <div><span>Department</span><b>Operation</b></div>
                      <div><span>Payroll Month</span><b>{new Date().toISOString().slice(0, 7)}</b></div>
                      <div><span>Branch</span><b>{branch ? `${branch.code} - ${branch.name}` : "-"}</b></div>
                    </div>
                  </div>

                  <div className="ps-grid">
                    <div className="ps-box">
                      <div className="ps-box-title">COMPENSATION</div>
                      <div className="ps-lines">
                        <div className="ps-line"><span>Salary</span><b>₱ {fmt(s.salary)}</b></div>
                        <div className="ps-line"><span>Ecola</span><b>₱ {fmt(s.ecola)}</b></div>
                        <div className="ps-line"><span>Transportation</span><b>₱ 0</b></div>
                        <div className="ps-line ps-strong"><span>Gross Pay</span><b>₱ {grossPay.toLocaleString()}</b></div>
                      </div>
                    </div>

                    <div className="ps-box">
                      <div className="ps-box-title">DEDUCTIONS</div>
                      <div className="ps-lines">
                        {deductions.length === 0 ? (
                          <div className="ps-line"><span>None</span><b>₱ 0</b></div>
                        ) : (
                          deductions.map(([label, v]) => (
                            <div key={label} className="ps-line">
                              <span>{label}</span>
                              <b>₱ {toNum(v).toLocaleString()}</b>
                            </div>
                          ))
                        )}
                        <div className="ps-line ps-strong">
                          <span>Total Deduction</span>
                          <b>₱ {totalDed.toLocaleString()}</b>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="ps-grid">
                    <div className="ps-box">
                      <div className="ps-box-title">EMPLOYER CONTRIBUTIONS (ER)</div>
                      <div className="ps-lines">
                        <div className="ps-line"><span>HDMF</span><b>₱ {fmt(s.hdmf_er)}</b></div>
                        <div className="ps-line"><span>SSS</span><b>₱ {fmt(s.sss_er)}</b></div>
                        <div className="ps-line"><span>PhilHealth</span><b>₱ {fmt(s.ph_er)}</b></div>
                        <div className="ps-line ps-strong"><span>Total ER</span><b>₱ {fmt(s.total_er)}</b></div>
                      </div>
                    </div>

                    <div className="ps-box">
                      <div className="ps-box-title">EMPLOYEE CONTRIBUTIONS (EE)</div>
                      <div className="ps-lines">
                        <div className="ps-line"><span>HDMF</span><b>₱ {fmt(s.hdmf_ee)}</b></div>
                        <div className="ps-line"><span>SSS</span><b>₱ {fmt(s.sss_ee)}</b></div>
                        <div className="ps-line"><span>PhilHealth</span><b>₱ {fmt(s.ph_ee)}</b></div>
                        <div className="ps-line ps-strong"><span>Total EE</span><b>₱ {fmt(s.total_ee)}</b></div>
                      </div>
                    </div>
                  </div>

                  <div className="ps-summary">
                    <div className="ps-sum-box">
                      <div className="ps-sum-label">Gross Pay</div>
                      <div className="ps-sum-value">₱ {grossPay.toLocaleString()}</div>
                    </div>
                    <div className="ps-sum-box">
                      <div className="ps-sum-label">Total Deduction</div>
                      <div className="ps-sum-value">₱ {totalDed.toLocaleString()}</div>
                    </div>
                    <div className="ps-sum-box">
                      <div className="ps-sum-label">Net Pay</div>
                      <div className="ps-sum-value">₱ {netPay.toLocaleString()}</div>
                    </div>
                  </div>

                  <div className="ps-release">
                    <div className="ps-release-title">PAYROLL RELEASE BREAKDOWN</div>
                    <div className="ps-lines">
                      <div className="ps-line"><span>1st Half (10th)</span><b>₱ {fmt(s.netPayHalf)}</b></div>
                      <div className="ps-line"><span>2nd Half (25th)</span><b>₱ {fmt(s.netPayHalf)}</b></div>
                      <div className="ps-line ps-strong"><span>Total Net Pay</span><b>₱ {netPay.toLocaleString()}</b></div>
                    </div>
                  </div>

                  <div className="ps-foot">
                    <div className="ps-note">Note: This payslip is system-generated.</div>

                    <div className="ps-sign">
                      <div className="ps-sig">
                        <div className="ps-sig-line" />
                        <div className="ps-sig-label">Prepared By</div>
                      </div>
                      <div className="ps-sig">
                        <div className="ps-sig-line" />
                        <div className="ps-sig-label">Received By / Employee</div>
                      </div>
                    </div>

                    <div className="ps-system">AmberCash PH • Payroll System</div>
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default Payroll;