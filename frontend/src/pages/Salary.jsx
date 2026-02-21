import React, { useState, useEffect } from "react";
import "../styles/Salary.css";
import logo from "../assets/amber.jpg";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

function Salary() {
  const [staff, setStaff] = useState([]);
  const [selectedStaff, setSelectedStaff] = useState(null);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const toNum = (v) => Number(v ?? 0);
  const money = (v) => `₱${toNum(v).toLocaleString()}`;

  // ✅ Convert imported logo to base64 so it works inside print HTML and PDF
  const [logoBase64, setLogoBase64] = useState("");

  useEffect(() => {
    const img = new Image();
    img.src = logo;
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      setLogoBase64(canvas.toDataURL("image/jpeg"));
    };
  }, []);

  useEffect(() => {
    fetch("http://localhost:5000/staff")
      .then((res) => {
        if (!res.ok) throw new Error("Network response was not ok");
        return res.json();
      })
      .then((data) => setStaff(data || []))
      .catch((err) => console.error("Staff fetch error:", err));
  }, []);

  const handleSearch = () => setSearch(searchInput);
  const handleClear = () => {
    setSearchInput("");
    setSearch("");
  };

  const filteredStaff = staff.filter((emp) => {
    const q = search.toLowerCase();
    return (
      String(emp.fullname || "").toLowerCase().includes(q) ||
      String(emp.position || "").toLowerCase().includes(q) ||
      String(emp.area || "").toLowerCase().includes(q)
    );
  });

  // ✅ Build Payslip HTML (used by PRINT and PDF)
  const buildPayslipHTML = (s) => {
    const salary = toNum(s.salary);
    const ecola = toNum(s.ecola);
    const transportation = toNum(s.transportation);

    const totalCompensation = salary + ecola;
    const grossPay = totalCompensation + transportation;

    const totalER = toNum(s.hdmf_er) + toNum(s.sss_er) + toNum(s.ph_er);
    const totalEE = toNum(s.hdmf_ee) + toNum(s.sss_ee) + toNum(s.ph_ee);

    const totalDeduction = toNum(s.total_deduction);
    const netPay = toNum(s.net_pay);
    const pay10th = netPay / 2;
    const pay25th = netPay / 2;

    const today = new Date().toLocaleDateString();
    const payrollDate = s.payroll_date ? String(s.payroll_date).split("T")[0] : "-";

    return `
      <html>
        <head>
          <title>Payslip - ${s.fullname}</title>
          <style>
            @page { margin: 14mm; }
            * { box-sizing: border-box; }
            body { font-family: Arial, sans-serif; color: #111; margin: 0; }
            .sheet { max-width: 820px; margin: 0 auto; }

            .header {
              display:flex; justify-content:space-between; align-items:flex-start;
              border-bottom:2px solid #111; padding-bottom:10px; margin-bottom:14px;
              gap: 10px;
            }
            .logo { height: 60px; }
            .company { flex: 1; }
            .company h1 { margin:0; font-size:18px; }
            .company .sub { margin-top:4px; font-size:12px; color:#333; }
            .meta { text-align:right; font-size:12px; color:#333; line-height:1.5; }
            .meta strong { color:#111; }

            .employee {
              display:grid; grid-template-columns:1fr 1fr; gap:10px 18px;
              border:1px solid #111; padding:10px; border-radius:8px; margin-bottom:14px;
            }
            .row { font-size:12px; display:flex; gap:8px; }
            .label { min-width:130px; color:#333; }
            .value { font-weight:600; }

            .grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
            .card { border:1px solid #111; border-radius:8px; padding:10px; }
            .card h3 { margin:0 0 8px 0; font-size:13px; text-transform:uppercase; }

            table { width:100%; border-collapse:collapse; font-size:12px; }
            td { padding:6px 0; border-bottom:1px dashed #bbb; }
            td:last-child { text-align:right; font-weight:600; }
            .total-row td { border-bottom:none; padding-top:8px; font-weight:700; }

            .summary {
              margin-top:12px; border-top:2px solid #111; padding-top:10px;
              display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px;
            }
            .pill {
              border:1px solid #111; border-radius:10px; padding:10px; text-align:center;
            }
            .pill .big { font-size:16px; font-weight:800; margin-top:4px; }

            .sign {
              margin-top:16px; display:grid; grid-template-columns:1fr 1fr; gap:16px;
            }
            .line { border-top:1px solid #111; padding-top:6px; font-size:11px; color:#333; text-align:center; }

            .foot {
              margin-top:14px; font-size:11px; color:#333; display:flex; justify-content:space-between;
            }

            @media print { button, a { display:none !important; } }
          </style>
        </head>
        <body>
          <div class="sheet">

            <div class="header">
              ${logoBase64 ? `<img src="${logoBase64}" class="logo" />` : ""}
              <div class="company">
                <h1>AmberCash PH Micro Lending Corp.</h1>
                <div class="sub">Payslip / Salary Details</div>
              </div>
              <div class="meta">
                <div><strong>Date:</strong> ${today}</div>
                <div><strong>Employee ID:</strong> ${s.id}</div>
                <div><strong>Area:</strong> ${s.area ?? "-"}</div>
              </div>
            </div>

            <div class="employee">
              <div class="row"><div class="label">Employee Name:</div><div class="value">${s.fullname}</div></div>
              <div class="row"><div class="label">Position:</div><div class="value">${s.position ?? "-"}</div></div>
              <div class="row"><div class="label">Department:</div><div class="value">${s.department ?? "-"}</div></div>
              <div class="row"><div class="label">Payroll Month:</div><div class="value">${payrollDate}</div></div>
            </div>

            <div class="grid">
              <div class="card">
                <h3>Compensation:</h3>
                <table>
                  <tr><td>Salary</td><td>${money(salary)}</td></tr>
                  <tr><td>Ecola</td><td>${money(ecola)}</td></tr>
                  <tr><td>Transportation</td><td>${money(transportation)}</td></tr>
                  <tr class="total-row"><td>Gross Pay</td><td>${money(grossPay)}</td></tr>
                </table>
              </div>

              <div class="card">
                <h3>Deductions</h3>
                <table>
                  <tr><td>Tax</td><td>${money(s.tax)}</td></tr>
                  <tr><td>Utility Charge</td><td>${money(s.utility_charge)}</td></tr>
                  <tr><td>CBU</td><td>${money(s.cbu)}</td></tr>
                  <tr><td>Cashbond</td><td>${money(s.cashbond)}</td></tr>
                  <tr><td>Salary Advance</td><td>${money(s.salary_advance)}</td></tr>
                  <tr><td>Special Advance</td><td>${money(s.special_advance)}</td></tr>
                  <tr><td>Cash Advance</td><td>${money(s.cash_advance)}</td></tr>
                  <tr><td>Other Receivable</td><td>${money(s.other_receivable)}</td></tr>
                  <tr><td>Pag-IBIG MPL</td><td>${money(s.pagibig_mpl)}</td></tr>
                  <tr><td>SSS Loan</td><td>${money(s.sss_loan)}</td></tr>
                  <tr><td>Staff Accounts Payable</td><td>${money(s.staff_accounts_payable)}</td></tr>
                  <tr class="total-row"><td>Total Deduction</td><td>${money(totalDeduction)}</td></tr>
                </table>
              </div>
            </div>

            <div class="grid" style="margin-top:12px;">
              <div class="card">
                <h3>Employer Contributions (ER)</h3>
                <table>
                  <tr><td>HDMF</td><td>${money(s.hdmf_er)}</td></tr>
                  <tr><td>SSS</td><td>${money(s.sss_er)}</td></tr>
                  <tr><td>PhilHealth</td><td>${money(s.ph_er)}</td></tr>
                  <tr class="total-row"><td>Total ER</td><td>${money(totalER)}</td></tr>
                </table>
              </div>

              <div class="card">
                <h3>Employee Contributions (EE)</h3>
                <table>
                  <tr><td>HDMF</td><td>${money(s.hdmf_ee)}</td></tr>
                  <tr><td>SSS</td><td>${money(s.sss_ee)}</td></tr>
                  <tr><td>PhilHealth</td><td>${money(s.ph_ee)}</td></tr>
                  <tr class="total-row"><td>Total EE</td><td>${money(totalEE)}</td></tr>
                </table>
              </div>
            </div>

            <div class="summary">
              <div class="pill"><div>Gross Pay</div><div class="big">${money(grossPay)}</div></div>
              <div class="pill"><div>Total Deduction</div><div class="big">${money(totalDeduction)}</div></div>
              <div class="pill"><div>Net Pay</div><div class="big">${money(netPay)}</div></div>
            </div>

            <div style="height: 10px;"></div>

            <div class="card">
              <h3>Payroll Release Breakdown</h3>
              <table>
                <tr><td>1st Half</td><td>10th</td><td>${money(pay10th)}</td></tr>
                <tr><td>2nd Half</td><td>25th</td><td>${money(pay25th)}</td></tr>
                <tr class="total-row"><td>Total Net Pay</td><td>${money(netPay)}</td></tr>
              </table>
            </div>

            <div class="sign">
              <div class="line">Prepared By</div>
              <div class="line">Received By / Employee Signature</div>
            </div>

            <div class="foot">
              <div>Note: This payslip is system-generated.</div>
              <div>AmberCash PH • Payroll System</div>
            </div>

          </div>

          <script>
            window.onload = () => {
              window.focus();
              window.print();
              window.close();
            };
          </script>
        </body>
      </html>
    `;
  };

  // ✅ Print
  const printSalary = () => {
    if (!selectedStaff) return;
    const html = buildPayslipHTML(selectedStaff);
    const w = window.open("", "_blank", "width=900,height=650");
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  // ✅ Download PDF from the same payslip layout
  const downloadPayslip = async () => {
    if (!selectedStaff) return;

    const html = buildPayslipHTML(selectedStaff);
    const w = window.open("", "_blank", "width=900,height=650");

    w.document.open();
    w.document.write(html);
    w.document.close();

    // Wait for content to render
    setTimeout(async () => {
      const element = w.document.body;

      const canvas = await html2canvas(element, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL("image/png");

      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const imgWidth = pageWidth - 20;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.addImage(imgData, "PNG", 10, 10, imgWidth, imgHeight);
      pdf.save(`Payslip-${selectedStaff.fullname}.pdf`);

      w.close();
    }, 600);
  };

  // totals for modal display
  const totalER = selectedStaff
    ? toNum(selectedStaff.hdmf_er) + toNum(selectedStaff.sss_er) + toNum(selectedStaff.ph_er)
    : 0;

  const totalEE = selectedStaff
    ? toNum(selectedStaff.hdmf_ee) + toNum(selectedStaff.sss_ee) + toNum(selectedStaff.ph_ee)
    : 0;

  const totalCompensation = selectedStaff
    ? toNum(selectedStaff.salary) + toNum(selectedStaff.ecola)
    : 0;

  return (
    <div className="salary-container">
      <h2 className="salary-title">Salary - All Staff</h2>

      {/* Search */}
      <div className="search-container">
        <input
          type="text"
          placeholder="Search by name, position, or area..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          className="search-input"
        />
        <button className="search-btn" onClick={handleSearch}>Search</button>
        <button className="clear-btn" onClick={handleClear}>Clear</button>
      </div>

      {/* Staff Table */}
      <div className="table-wrapper">
        <table className="salary-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Full Name</th>
              <th>Position</th>
              <th>Area</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredStaff.map((emp) => (
              <tr key={emp.id}>
                <td>{emp.id}</td>
                <td>{emp.fullname}</td>
                <td>{emp.position}</td>
                <td>{emp.area}</td>
                <td>
                  <button className="view-btn" onClick={() => setSelectedStaff(emp)}>
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {selectedStaff && (
        <div className="modal-overlay">
          <div className="modal" id="salary-modal-content">
            <h2>Salary Details - {selectedStaff.fullname}</h2>

            <h3>Basic Pay</h3>
            <p>Salary: {money(selectedStaff.salary)}</p>
            <p>Ecola: {money(selectedStaff.ecola)}</p>
            <p><strong>Total Compensation: ₱{totalCompensation.toLocaleString()}</strong></p>

            <h3>Allowances</h3>
            <p>Transportation: {money(selectedStaff.transportation)}</p>

            <h3>Employer Contributions (ER)</h3>
            <p>HDMF: {money(selectedStaff.hdmf_er)}</p>
            <p>SSS: {money(selectedStaff.sss_er)}</p>
            <p>PhilHealth: {money(selectedStaff.ph_er)}</p>
            <p><strong>Total ER: ₱{totalER.toLocaleString()}</strong></p>

            <h3>Employee Contributions (EE)</h3>
            <p>HDMF: {money(selectedStaff.hdmf_ee)}</p>
            <p>SSS: {money(selectedStaff.sss_ee)}</p>
            <p>PhilHealth: {money(selectedStaff.ph_ee)}</p>
            <p><strong>Total EE: ₱{totalEE.toLocaleString()}</strong></p>

            <h3>Deductions</h3>
            <p>Tax: {money(selectedStaff.tax)}</p>
            <p>Utility Charge: {money(selectedStaff.utility_charge)}</p>
            <p>CBU: {money(selectedStaff.cbu)}</p>
            <p>Cashbond: {money(selectedStaff.cashbond)}</p>
            <p>Salary Advance: {money(selectedStaff.salary_advance)}</p>
            <p>Special Advance: {money(selectedStaff.special_advance)}</p>
            <p>Cash Advance: {money(selectedStaff.cash_advance)}</p>
            <p>Other Receivable: {money(selectedStaff.other_receivable)}</p>
            <p>Pag-IBIG MPL: {money(selectedStaff.pagibig_mpl)}</p>
            <p>SSS Loan: {money(selectedStaff.sss_loan)}</p>
            <p>Staff Accounts Payable: {money(selectedStaff.staff_accounts_payable)}</p>

            <p><strong>Total Deduction: {money(selectedStaff.total_deduction)}</strong></p>

            <h3>Net Pay</h3>
            <p><strong>{money(selectedStaff.net_pay)}</strong></p>

            <div className="modal-buttons">
              <button className="save-btn" onClick={printSalary}>Print Payslip</button>
              <button className="download-btn" onClick={downloadPayslip}>Download PDF</button>
              <button className="cancel-btn" onClick={() => setSelectedStaff(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Salary;