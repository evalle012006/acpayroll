import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import "../styles/Transportation.css";

const API = "http://localhost:5000";

function Transportation() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [branch, setBranch] = useState(null);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState("");
  const [error, setError] = useState(null);

  const toNum = (v) => Number(v ?? 0);
  const money = (v) => toNum(v).toLocaleString();

  useEffect(() => {
    const fetchData = async () => {
      if (!id) {
        setError("No branch ID provided");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const branchRes = await axios.get(`${API}/branches/${Number(id)}`);
        if (!branchRes.data) throw new Error("Branch not found");
        setBranch(branchRes.data);

        const staffRes = await axios.get(
          `${API}/staff/area/${encodeURIComponent(branchRes.data.area)}`,
          { params: { month } }
        );
        setStaff(staffRes.data || []);
      } catch (err) {
        console.error("Error fetching data:", err);
        if (err.response?.status === 404) setError("Branch not found");
        else setError("Error fetching data from server");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, month]);

  const payrollRows = useMemo(() => {
    return (staff || []).map((s) => {
      const postage = toNum(s.postage);
      const transportation = toNum(s.transportation);
      const additionalTarget = toNum(s.additional_target);
      const repairing = toNum(s.repairing);
      const additionalMonitoring = toNum(s.additional_monitoring);

      const motorcycle = toNum(s.motorcycle_loan);
      const other = toNum(s.other_deduction);

      const totalAllowance =
        postage + transportation + additionalTarget + repairing + additionalMonitoring;

      const totalDeduction = motorcycle + other;
      const netPay = totalAllowance - totalDeduction;

      return {
        id: s.id,
        name: s.fullname,
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
    return payrollRows.reduce(
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
  }, [payrollRows]);

  if (loading) return <p>Loading report...</p>;
  if (error) return <p style={{ color: "red" }}>{error}</p>;

  const exportToExcel = () => {
  const data = filteredRows.map((r) => ({
    ID: r.id,
    "Full Name": r.fullname,
    Position: r.position,
    "Regularization Date": r.regularization_date
      ? String(r.regularization_date).split("T")[0]
      : "",
    CBU: toNum(r.cbu),
    Cashbond: toNum(r.cashbond),
    "Salary Advance": toNum(r.salary_advance),
    "Motorcycle Loan": toNum(r.motorcycle_loan),
    "Special Advance": toNum(r.special_advance),
    "Cash Advance": toNum(r.cash_advance),
    "Other Receivable": toNum(r.other_receivable),
    "Staff Accounts Payable": toNum(r.staff_accounts_payable),
  }));

  data.push({
    ID: "",
    "Full Name": "TOTAL",
    Position: "",
    "Regularization Date": "",
    CBU: totals.cbu,
    Cashbond: totals.cashbond,
    "Salary Advance": totals.salary_advance,
    "Motorcycle Loan": totals.motorcycle_loan,
    "Special Advance": totals.special_advance,
    "Cash Advance": totals.cash_advance,
    "Other Receivable": totals.other_receivable,
    "Staff Accounts Payable": totals.staff_accounts_payable,
  });

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "ScheduleBalances");

  const fileName = selectedBranch
    ? `ScheduleBalances_Branch_${selectedBranch}.xlsx`
    : "ScheduleBalances_AllBranches.xlsx";

  XLSX.writeFile(workbook, fileName);
};

  return (
    <div className="report-container">
      <div className="top-actions">
        <button onClick={() => navigate(-1)} className="back-btn">
          ⬅ Back
        </button>
        <button className="print-btn" onClick={() => window.print()}>
          🖨 Print
        </button>
      </div>

      <h2 style={{ textAlign: "left" }}>
        Transportation Report {branch ? `- ${branch.name}` : ""}
      </h2>

      {month && (
        <p style={{ textAlign: "left", fontStyle: "italic" }}>
          Payroll Month: {month}
        </p>
      )}

      {/* Branch Info */}
      {branch && (
        <div className="branch-info">
          <p>
            <strong>Branch Code:</strong> {branch.code}
          </p>
          <p>
            <strong>Branch Name:</strong> {branch.name}
          </p>
          <p>
            <strong>Area:</strong> {branch.area}
          </p>
        </div>
      )}

      {/* Month Picker */}
      <div style={{ margin: "15px 0" }}>
        <label>
          <strong>Select Month: </strong>
        </label>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
      </div>

      <h3 style={{ fontStyle: "italic" }}>Allowances, Deductions & Net Pay</h3>

      {payrollRows.length === 0 ? (
        <p>No staff found for this branch area.</p>
      ) : (
        <div className="table-wrapper">
          <table className="transportation-table">
            <thead>
              {/* GROUP HEADER */}
              <tr>
                <th rowSpan={2}>ID</th>
                <th rowSpan={2}>Staff Name</th>
                <th rowSpan={2}>Position</th>
                <th rowSpan={2}>Date Regularized</th>

                <th colSpan={6}>Transportations & Repairing Allowance + Incentives</th>
                <th colSpan={3}>Staff Deductions</th>
                <th colSpan={3}>Net Incentives & Allowances</th>
              </tr>

              {/* SUB HEADER */}
              <tr>
                <th>Postage</th>
                <th>Transportation</th>
                <th>Target</th>
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
              {payrollRows.map((r) => (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td style={{ textAlign: "left" }}>{r.name}</td>
                  <td>{r.position}</td>
                  <td>{r.regularization_date ? String(r.regularization_date).split("T")[0] : "-"}</td>

                  <td>₱ {money(r.postage)}</td>
                  <td>₱ {money(r.transportation)}</td>
                  <td>₱ {money(r.additionalTarget)}</td>
                  <td>₱ {money(r.repairing)}</td>
                  <td>₱ {money(r.additionalMonitoring)}</td>
                  <td style={{ fontWeight: "bold" }}>₱ {money(r.totalAllowance)}</td>

                  <td>₱ {money(r.motorcycle)}</td>
                  <td>₱ {money(r.other)}</td>
                  <td style={{ fontWeight: "bold" }}>₱ {money(r.totalDeduction)}</td>

                  <td style={{ fontWeight: "bold", color: r.netPay < 0 ? "red" : "green" }}>
                    ₱ {money(r.netPay)}
                  </td>
                  <td style={{ color: r.netPay10 < 0 ? "red" : "green" }}>
                    ₱ {money(r.netPay10)}
                  </td>
                  <td style={{ color: r.netPay25 < 0 ? "red" : "green" }}>
                    ₱ {money(r.netPay25)}
                  </td>
                </tr>
              ))}

              {/* TOTALS */}
              <tr className="totals-row">
                <td colSpan={4} style={{ textAlign: "right", fontWeight: "bold" }}>Total</td>

                <td>₱ {money(totals.postage)}</td>
                <td>₱ {money(totals.transportation)}</td>
                <td>₱ {money(totals.additionalTarget)}</td>
                <td>₱ {money(totals.repairing)}</td>
                <td>₱ {money(totals.additionalMonitoring)}</td>
                <td style={{ fontWeight: "bold" }}>₱ {money(totals.totalAllowance)}</td>

                <td>₱ {money(totals.motorcycle)}</td>
                <td>₱ {money(totals.other)}</td>
                <td style={{ fontWeight: "bold" }}>₱ {money(totals.totalDeduction)}</td>

                <td style={{ fontWeight: "bold" }}>₱ {money(totals.netPay)}</td>
                <td style={{ fontWeight: "bold" }}>₱ {money(totals.netPay10)}</td>
                <td style={{ fontWeight: "bold" }}>₱ {money(totals.netPay25)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default Transportation;