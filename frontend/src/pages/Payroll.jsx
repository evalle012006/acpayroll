import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "../styles/Payroll.css";

function Payroll() {
  const { branchId } = useParams();
  const navigate = useNavigate();

  const [staff, setStaff] = useState([]);
  const [branch, setBranch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Helper to safely convert to number
  const toNumber = (val) => (val ? Number(val) : 0);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const branchRes = await fetch(`http://localhost:5000/branches/${Number(branchId)}`);
        if (!branchRes.ok) throw new Error("Branch not found");
        const branchData = await branchRes.json();
        setBranch(branchData);

        const payrollRes = await fetch(`http://localhost:5000/salary/${Number(branchId)}`);
        if (!payrollRes.ok) throw new Error("Failed to fetch payroll");
        const payrollData = await payrollRes.json();
        setStaff(payrollData);
      } catch (err) {
        console.error("Payroll fetch error:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [branchId]);

  if (loading) return <p>Loading payroll...</p>;
  if (error) return <p style={{ color: "red" }}>{error}</p>;

  // Functions to sum columns for totals row
  const sumColumn = (key) =>
    staff.reduce((sum, s) => sum + toNumber(s[key]), 0);

  const sumSalaryEcola = () =>
    staff.reduce((sum, s) => sum + toNumber(s.salary) + toNumber(s.ecola), 0);

  return (
    <div className="report-container">
      <button onClick={() => navigate(-1)} className="back-btn">⬅ Back</button>
      <button onClick={() => window.print()} className="print-btn">🖨 Print</button>

      <h2>Payroll Report - {branch ? branch.name : ""}</h2>

      {branch && (
        <div className="branch-info">
          <p><strong>Code:</strong> {branch.code}</p>
          <p><strong>Name:</strong> {branch.name}</p>
          <p><strong>Area:</strong> {branch.area}</p>
        </div>
      )}

      <h2 style={{ fontStyle: "italic", textAlign: "center" }}>Salary and Wages</h2>
      <div className="table-wrapper">
        <table className="payroll-table">
          <thead>
  {/* GROUP HEADER */}
  <tr>
    <th rowSpan={2}>ID</th>
    <th rowSpan={2}>Full Name</th>
    <th rowSpan={2}>Position</th>
    <th rowSpan={2}>Date Regularized</th>

    <th colSpan={3}>EARNINGS</th>
    <th colSpan={4}>EMPLOYER&apos;S CONTRIBUTION (ER)</th>
    <th colSpan={4}>EMPLOYEE&apos;S CONTRIBUTION (EE)</th>
    <th colSpan={12}>DEDUCTIONS</th>

    <th rowSpan={2}>Total Deduction</th>
    <th rowSpan={2}>Net Pay</th>
    <th rowSpan={2}>10th</th>
    <th rowSpan={2}>25th</th>
  </tr>

  {/* SUB HEADER */}
  <tr>
    {/* Earnings */}
    <th>Salary</th>
    <th>Ecola</th>
    <th>Total Compensation</th>

    {/* ER */}
    <th>HDMF</th>
    <th>SSS</th>
    <th>PH</th>
    <th>Total ER</th>

    {/* EE */}
    <th>HDMF</th>
    <th>SSS</th>
    <th>PH</th>
    <th>Total EE</th>

    {/* Deductions */}
    <th>Tax</th>
    <th>Utility</th>
    <th>CBU</th>
    <th>Cash Bond</th>
    <th>Salary Advance</th>
    <th>Special Advance</th>
    <th>Cash Advance</th>
    <th>Other Receivables</th>
    <th>Pag-IBIG MPL</th>
    <th>SSS Loan</th>
    <th>Staff Accounts Payable</th>
    <th>Motorcycle Loan</th>
  </tr>
</thead>
          <tbody>
            {staff.map((s) => {
              const salary = toNumber(s.salary);
              const ecola = toNumber(s.ecola);
              const totalComp = salary + ecola;

              const hdmf_er = toNumber(s.hdmf_er);
              const sss_er = toNumber(s.sss_er);
              const ph_er = toNumber(s.ph_er);
              const total_er = toNumber(s.total_er);

              const hdmf_ee = toNumber(s.hdmf_ee);
              const sss_ee = toNumber(s.sss_ee);
              const ph_ee = toNumber(s.ph_ee);
              const total_ee = toNumber(s.total_ee);

              const tax = toNumber(s.tax);
              const utility_charge = toNumber(s.utility_charge);
              const cbu = toNumber(s.cbu);
              const cashbond = toNumber(s.cashbond);
              const salary_advance = toNumber(s.salary_advance);
              const motorcycle_loan = toNumber(s.motorcycle_loan);
              const special_advance = toNumber(s.special_advance);
              const cash_advance = toNumber(s.cash_advance);
              const other_receivable = toNumber(s.other_receivable);
              const pagibig_mpl = toNumber(s.pagibig_mpl);
              const sss_loan = toNumber(s.sss_loan);
              const staff_accounts_payable = toNumber(s.staff_accounts_payable);

              const total_deduction =
                total_ee +
                tax +
                utility_charge +
                cbu +
                cashbond +
                salary_advance +
                special_advance +
                cash_advance +
                other_receivable +
                pagibig_mpl +
                sss_loan +
                staff_accounts_payable;
                motorcycle_loan;

              const netPay = totalComp - total_deduction;
              const netPayHalf = netPay / 2;

              return (
                <tr key={s.id}>
                  <td>{s.id}</td>
                  <td>{s.fullname}</td>
                  <td>{s.position}</td>
                  <td>{s.regularization_date ? s.regularization_date.split("T")[0] : "-"}</td>
                  <td>{salary.toLocaleString()}</td>
                  <td>{ecola.toLocaleString()}</td>
                  <td>{totalComp.toLocaleString()}</td>
                  <td>{hdmf_er.toLocaleString()}</td>
                  <td>{sss_er.toLocaleString()}</td>
                  <td>{ph_er.toLocaleString()}</td>
                  <td>{total_er.toLocaleString()}</td>
                  <td>{hdmf_ee.toLocaleString()}</td>
                  <td>{sss_ee.toLocaleString()}</td>
                  <td>{ph_ee.toLocaleString()}</td>
                  <td>{total_ee.toLocaleString()}</td>
                  <td>{tax.toLocaleString()}</td>
                  <td>{utility_charge.toLocaleString()}</td>
                  <td>{cbu.toLocaleString()}</td>
                  <td>{cashbond.toLocaleString()}</td>
                  <td>{salary_advance.toLocaleString()}</td>
                  <td>{motorcycle_loan.toLocaleString()}</td>
                  <td>{special_advance.toLocaleString()}</td>
                  <td>{cash_advance.toLocaleString()}</td>
                  <td>{other_receivable.toLocaleString()}</td>
                  <td>{pagibig_mpl.toLocaleString()}</td>
                  <td>{sss_loan.toLocaleString()}</td>
                  <td>{staff_accounts_payable.toLocaleString()}</td>
                  <td style={{ fontWeight: "bold" }}>{total_deduction.toLocaleString()}</td>
                  <td style={{ fontWeight: "bold", color: netPay < 0 ? "red" : "green" }}>
                    {netPay.toLocaleString()}
                  </td>
                  <td style={{ fontWeight: "bold", color: netPayHalf < 0 ? "red" : "green" }}>
                    {netPayHalf.toLocaleString()}
                  </td>
                  <td style={{ fontWeight: "bold", color: netPayHalf < 0 ? "red" : "green" }}>
                    {netPayHalf.toLocaleString()}
                  </td>
                </tr>
              );
            })}

            {/* Totals Row */}
            <tr className="totals-row">
              <td colSpan={4}>Totals</td>
              <td>{sumColumn("salary").toLocaleString()}</td>
              <td>{sumColumn("ecola").toLocaleString()}</td>
              <td>{sumSalaryEcola().toLocaleString()}</td>
              <td>{sumColumn("hdmf_er").toLocaleString()}</td>
              <td>{sumColumn("sss_er").toLocaleString()}</td>
              <td>{sumColumn("ph_er").toLocaleString()}</td>
              <td>{sumColumn("total_er").toLocaleString()}</td>
              <td>{sumColumn("hdmf_ee").toLocaleString()}</td>
              <td>{sumColumn("sss_ee").toLocaleString()}</td>
              <td>{sumColumn("ph_ee").toLocaleString()}</td>
              <td>{sumColumn("total_ee").toLocaleString()}</td>
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
              <td>{sumColumn("total_deduction").toLocaleString()}</td>
              <td>{sumColumn("net_pay").toLocaleString()}</td>
              <td>{(sumColumn("net_pay") / 2).toLocaleString()}</td>
              <td>{(sumColumn("net_pay") / 2).toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Payroll;
