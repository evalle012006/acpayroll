import React, { useEffect, useMemo, useState } from "react";
import "../styles/Salary.css";
import logo from "../assets/amber.jpg";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import api from "../api/axiosClient";

/* ------------------------- Helpers ------------------------- */
const toStr = (v) => String(v ?? "").trim();
const toNum = (v) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};
const money = (v) =>
  `₱ ${toNum(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const displayName = (s) => {
  const ln = toStr(s?.last_name);
  const fn = toStr(s?.first_name);
  const mn = toStr(s?.middle_name);
  const built = `${ln}${ln && fn ? ", " : ""}${fn}${mn ? ` ${mn}` : ""}`.replace(/\s+/g, " ").trim();
  return built || toStr(s?.fullname) || "-";
};

const fmtBranch = (b) => `${toStr(b?.code)}${b?.name ? ` • ${b.name}` : ""}`.trim();

function Salary() {
  const [staff, setStaff] = useState([]);
  const [balances, setBalances] = useState([]);
  const [branches, setBranches] = useState([]);

  const [selectedStaff, setSelectedStaff] = useState(null);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [branchFilter, setBranchFilter] = useState("All");
  const [logoBase64, setLogoBase64] = useState("");

  /* ------------------------- Logo to base64 ------------------------- */
  useEffect(() => {
    const img = new Image();
    img.src = logo;
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0);
      setLogoBase64(c.toDataURL("image/jpeg"));
    };
  }, []);

  /* ------------------------- Load staff + balances + branches ------------------------- */
  useEffect(() => {
    const run = async () => {
      try {
        const [sRes, bRes, brRes] = await Promise.all([
          api.get("/staff"),
          api.get("/staff-balances"), // ✅ NOW EXISTS (after backend fix)
          api.get("/branches"),
        ]);

        setStaff(Array.isArray(sRes.data) ? sRes.data : []);
        setBalances(Array.isArray(bRes.data) ? bRes.data : []);
        setBranches(Array.isArray(brRes.data) ? brRes.data : []);
      } catch (err) {
        console.error("Salary fetch error:", err);
        setStaff([]);
        setBalances([]);
        setBranches([]);
      }
    };
    run();
  }, []);

  /* ------------------------- ESC closes modal + lock scroll ------------------------- */
  useEffect(() => {
    if (!selectedStaff) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") setSelectedStaff(null);
    };

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [selectedStaff]);

  const handleSearch = () => setSearch(searchInput);
  const handleClear = () => {
    setSearchInput("");
    setSearch("");
    setBranchFilter("All");
  };

  const branchMap = useMemo(() => {
    const m = new Map();
    (branches || []).forEach((b) => m.set(String(b.id), b));
    return m;
  }, [branches]);

  const balancesByEmp = useMemo(() => {
    const m = new Map();
    for (const b of balances || []) m.set(String(b.employee_id), b);
    return m;
  }, [balances]);

  /* ------------------------- Compute payroll breakdown ------------------------- */
  const staffWithComputed = useMemo(() => {
    return (staff || []).map((s) => {
      const bal = balancesByEmp.get(String(s.id)) || {};

      const salary = toNum(s.salary);
      const ecola = toNum(s.ecola);
      const transportation = toNum(s.transportation);

      // placeholders
      const hdmf_er = 0, sss_er = 0, ph_er = 0;
      const hdmf_ee = 0, sss_ee = 0, ph_ee = 0;
      const total_er = hdmf_er + sss_er + ph_er;
      const total_ee = hdmf_ee + sss_ee + ph_ee;

      const tax = 0;
      const utility_charge = 0;

      // balances
      const cbu = toNum(bal.cbu);
      const cashbond = toNum(bal.cashbond);
      const salary_advance = toNum(bal.salary_advance);
      const motorcycle_loan = toNum(bal.motorcycle_loan);
      const special_advance = toNum(bal.special_advance);
      const cash_advance = toNum(bal.cash_advance);
      const other_receivable = toNum(bal.other_receivable);
      const pagibig_mpl = 0;
      const sss_loan = 0;
      const staff_accounts_payable = toNum(bal.staff_accounts_payable);

      const totalCompensation = salary + ecola;
      const grossPay = totalCompensation + transportation;

      const total_deduction =
        total_ee +
        tax +
        utility_charge +
        cbu +
        cashbond +
        salary_advance +
        motorcycle_loan +
        special_advance +
        cash_advance +
        other_receivable +
        pagibig_mpl +
        sss_loan +
        staff_accounts_payable;

      const net_pay = totalCompensation - total_deduction;

      const br = branchMap.get(String(s.branch_id ?? "")) || null;

      // ✅ prefer staff name fields; fallback to balances name fields if needed
      const mergedNameObj = {
        ...s,
        last_name: s.last_name ?? bal.last_name,
        first_name: s.first_name ?? bal.first_name,
        middle_name: s.middle_name ?? bal.middle_name,
        fullname: s.fullname ?? bal.fullname,
      };

      return {
        ...s,
        display_name: displayName(mergedNameObj),

        branch_code: br?.code || "",
        branch_name: br?.name || "",

        hdmf_er, sss_er, ph_er, total_er,
        hdmf_ee, sss_ee, ph_ee, total_ee,

        tax,
        utility_charge,

        cbu,
        cashbond,
        salary_advance,
        motorcycle_loan,
        special_advance,
        cash_advance,
        other_receivable,
        pagibig_mpl,
        sss_loan,
        staff_accounts_payable,

        total_deduction,
        net_pay,
        payroll_date: new Date().toISOString(),
        grossPay,
      };
    });
  }, [staff, balancesByEmp, branchMap]);

  const filteredStaff = useMemo(() => {
    const q = toStr(search).toLowerCase();
    const bid = String(branchFilter || "All");

    return staffWithComputed.filter((emp) => {
      if (bid !== "All" && String(emp.branch_id ?? "") !== bid) return false;
      if (!q) return true;

      const hay = [
        emp.display_name,
        emp.fullname,
        emp.last_name,
        emp.first_name,
        emp.middle_name,
        emp.position,
        emp.area,
        emp.branch_code,
        emp.branch_name,
      ]
        .map((x) => toStr(x).toLowerCase())
        .join(" ");

      return hay.includes(q);
    });
  }, [staffWithComputed, search, branchFilter]);

  const buildPayslipHTML = (s, { autoPrint = false } = {}) => {
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
    const branchLabel =
      s.branch_code || s.branch_name ? `${s.branch_code || ""} • ${s.branch_name || ""}`.trim() : "-";

    const empName = s.display_name || displayName(s);

    return `
      <html>
        <head>
          <title>Payslip - ${empName}</title>
          <style>
            @page { margin: 14mm; }
            * { box-sizing: border-box; }
            body { font-family: Arial, sans-serif; color: #111; margin: 0; background: #fff; }
            .sheet { max-width: 820px; margin: 0 auto; padding: 0; }
            .header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #111; padding-bottom:10px; margin-bottom:14px; gap:10px; }
            .logo { height: 60px; }
            .company { flex: 1; }
            .company h1 { margin:0; font-size:18px; }
            .company .sub { margin-top:4px; font-size:12px; color:#333; }
            .meta { text-align:right; font-size:12px; color:#333; line-height:1.5; }
            .employee { display:grid; grid-template-columns:1fr 1fr; gap:10px 18px; border:1px solid #111; padding:10px; border-radius:8px; margin-bottom:14px; }
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
            .summary { margin-top:12px; border-top:2px solid #111; padding-top:10px; display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; }
            .pill { border:1px solid #111; border-radius:10px; padding:10px; text-align:center; }
            .pill .big { font-size:16px; font-weight:800; margin-top:4px; }
            .sign { margin-top:16px; display:grid; grid-template-columns:1fr 1fr; gap:16px; }
            .line { border-top:1px solid #111; padding-top:6px; font-size:11px; color:#333; text-align:center; }
            .foot { margin-top:14px; font-size:11px; color:#333; display:flex; justify-content:space-between; }
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
                <div><strong>Branch:</strong> ${branchLabel}</div>
                <div><strong>Area:</strong> ${s.area ?? "-"}</div>
              </div>
            </div>

            <div class="employee">
              <div class="row"><div class="label">Employee Name:</div><div class="value">${empName}</div></div>
              <div class="row"><div class="label">Position:</div><div class="value">${s.position ?? "-"}</div></div>
              <div class="row"><div class="label">Department:</div><div class="value">${s.department ?? "-"}</div></div>
              <div class="row"><div class="label">Payroll Month:</div><div class="value">${payrollDate}</div></div>
            </div>

            <div class="grid">
              <div class="card">
                <h3>Compensation</h3>
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
                  <tr><td>Motorcycle Loan</td><td>${money(s.motorcycle_loan)}</td></tr>
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
                <tr class="total-row"><td>Total Net Pay</td><td></td><td>${money(netPay)}</td></tr>
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

          ${
            autoPrint
              ? `
                <script>
                  window.onload = () => {
                    window.focus();
                    window.print();
                    window.close();
                  };
                </script>
              `
              : ""
          }
        </body>
      </html>
    `;
  };

  const printSalary = () => {
    if (!selectedStaff) return;
    const html = buildPayslipHTML(selectedStaff, { autoPrint: true });
    const w = window.open("", "_blank", "width=900,height=650");
    if (!w) return alert("Popup blocked. Allow popups then try again.");
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  const downloadPayslip = async () => {
    if (!selectedStaff) return;

    const html = buildPayslipHTML(selectedStaff, { autoPrint: false });
    const w = window.open("", "_blank", "width=900,height=650");
    if (!w) return alert("Popup blocked. Allow popups then try again.");

    w.document.open();
    w.document.write(html);
    w.document.close();

    w.onload = async () => {
      try {
        const element = w.document.querySelector(".sheet") || w.document.body;

        const canvas = await html2canvas(element, {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
        });

        const imgData = canvas.toDataURL("image/png");
        const pdf = new jsPDF("p", "mm", "a4");

        const pageWidth = pdf.internal.pageSize.getWidth();
        const imgWidth = pageWidth - 20;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        pdf.addImage(imgData, "PNG", 10, 10, imgWidth, imgHeight);

        const safeFile = (selectedStaff.display_name || "Payslip").replace(/[\\/:*?"<>|]/g, "").trim();
        pdf.save(`Payslip-${safeFile}.pdf`);
      } catch (err) {
        console.error("PDF generation error:", err);
        alert("Failed to generate PDF.");
      } finally {
        w.close();
      }
    };
  };

  return (
    <div className="salary-page">
      <div className="salary-page-header">
        <div>
          <h2 className="salary-title">Salary</h2>
          <p className="salary-subtitle">Search staff and generate payslips</p>
        </div>

        <div className="salary-actions">
          <select
            className="search-input"
            style={{ maxWidth: 280 }}
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
          >
            <option value="All">All Branches</option>
            {branches.map((b) => (
              <option key={b.id} value={String(b.id)}>
                {fmtBranch(b)}
              </option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Search name, position, area, branch..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="search-input"
          />

          <button className="btn-secondary" onClick={handleClear} type="button">
            Clear
          </button>
          <button className="btn-primary" onClick={handleSearch} type="button">
            Search
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
        <div className="pill">
          Branch:{" "}
          <strong>
            {branchFilter === "All"
              ? "All"
              : fmtBranch(branchMap.get(String(branchFilter)) || { code: "-", name: "" })}
          </strong>
        </div>
        <div className="pill">
          Results: <strong>{filteredStaff.length}</strong>
        </div>
      </div>

      <div className="salary-card">
        <div className="salary-card-header">
          <div className="salary-card-title">Staff List</div>
        </div>

        <div className="salary-table-wrapper">
          <table className="salary-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Position</th>
                <th>Branch</th>
                <th>Area</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredStaff.map((emp) => (
                <tr key={emp.id}>
                  <td>{emp.id}</td>
                  <td className="td-strong">{emp.display_name}</td>
                  <td>{emp.position || "-"}</td>
                  <td>{emp.branch_code || emp.branch_name ? `${emp.branch_code} • ${emp.branch_name}` : "-"}</td>
                  <td>{emp.area || "-"}</td>
                  <td>
                    <button className="view-btn" onClick={() => setSelectedStaff(emp)} type="button">
                      View
                    </button>
                  </td>
                </tr>
              ))}

              {filteredStaff.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty-state">
                    No staff found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedStaff && (
        <div
          className="modal-overlay"
          onMouseDown={(e) => e.target.classList.contains("modal-overlay") && setSelectedStaff(null)}
        >
          <div className="modal salary-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h3 className="modal-title">Salary Details</h3>
                <p className="modal-subtitle">
                  {selectedStaff.display_name}{" "}
                  <span style={{ opacity: 0.8 }}>
                    •{" "}
                    {selectedStaff.branch_code || selectedStaff.branch_name
                      ? `${selectedStaff.branch_code} • ${selectedStaff.branch_name}`
                      : "-"}
                  </span>
                </p>
              </div>
              <button className="modal-x" onClick={() => setSelectedStaff(null)} type="button">
                ✕
              </button>
            </div>

            <div className="salary-modal-grid">
              <div className="salary-box">
                <div className="box-title">Basic Pay</div>
                <div className="box-row">
                  <span>Salary</span>
                  <strong>{money(selectedStaff.salary)}</strong>
                </div>
                <div className="box-row">
                  <span>Ecola</span>
                  <strong>{money(selectedStaff.ecola)}</strong>
                </div>
                <div className="box-row total">
                  <span>Total Compensation</span>
                  <strong>{money(toNum(selectedStaff.salary) + toNum(selectedStaff.ecola))}</strong>
                </div>
              </div>

              <div className="salary-box">
                <div className="box-title">Allowances</div>
                <div className="box-row">
                  <span>Transportation</span>
                  <strong>{money(selectedStaff.transportation)}</strong>
                </div>
              </div>

              <div className="salary-box full">
                <div className="box-title">Deductions</div>
                <div className="box-row"><span>CBU</span><strong>{money(selectedStaff.cbu)}</strong></div>
                <div className="box-row"><span>Cashbond</span><strong>{money(selectedStaff.cashbond)}</strong></div>
                <div className="box-row"><span>Salary Advance</span><strong>{money(selectedStaff.salary_advance)}</strong></div>
                <div className="box-row"><span>Motorcycle Loan</span><strong>{money(selectedStaff.motorcycle_loan)}</strong></div>
                <div className="box-row"><span>Special Advance</span><strong>{money(selectedStaff.special_advance)}</strong></div>
                <div className="box-row"><span>Cash Advance</span><strong>{money(selectedStaff.cash_advance)}</strong></div>
                <div className="box-row"><span>Other Receivable</span><strong>{money(selectedStaff.other_receivable)}</strong></div>
                <div className="box-row"><span>Staff Accounts Payable</span><strong>{money(selectedStaff.staff_accounts_payable)}</strong></div>
                <div className="box-row total"><span>Total Deduction</span><strong>{money(selectedStaff.total_deduction)}</strong></div>
              </div>

              <div className="salary-box full">
                <div className="box-title">Net Pay</div>
                <div className="net-pay">{money(selectedStaff.net_pay)}</div>
              </div>
            </div>

            <div className="modal-buttons">
              <button className="btn-secondary" onClick={() => setSelectedStaff(null)} type="button">
                Close
              </button>
              <button className="btn-secondary" onClick={downloadPayslip} type="button">
                Download PDF
              </button>
              <button className="btn-primary" onClick={printSalary} type="button">
                Print Payslip
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Salary;