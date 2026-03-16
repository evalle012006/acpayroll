import React, { useEffect, useMemo, useState, useCallback } from "react";
import "../styles/Salary.css";
import logo from "../assets/amber.jpg";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import api from "../api/axiosClient";

const toStr = (v) => String(v ?? "").trim();

const toNum = (v) => {
  const s = String(v ?? "").trim();
  if (!s) return 0;
  const n = Number(s);
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
const norm = (v) => toStr(v).toLowerCase();

export default function Salary() {
  const [staff, setStaff] = useState([]);
  const [balances, setBalances] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loanRequests, setLoanRequests] = useState([]);
  const [sapRows, setSapRows] = useState([]);

  const [selectedStaff, setSelectedStaff] = useState(null);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [branchFilter, setBranchFilter] = useState("All");
  const [logoBase64, setLogoBase64] = useState("");

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

  useEffect(() => {
    const run = async () => {
      try {
        const [sRes, brRes, lrRes, sapRes] = await Promise.all([
          api.get("/staff"),
          api.get("/branches"),
          api.get("/loan-requests").catch(() => ({ data: [] })),
          api.get("/staff-accounts-payable").catch(() => ({ data: [] })),
        ]);

        setStaff(Array.isArray(sRes.data) ? sRes.data : []);
        setBranches(Array.isArray(brRes.data) ? brRes.data : []);
        setLoanRequests(Array.isArray(lrRes.data) ? lrRes.data : []);
        setSapRows(Array.isArray(sapRes.data) ? sapRes.data : []);

        try {
          const bRes = await api.get("/staff-balances");
          setBalances(Array.isArray(bRes.data) ? bRes.data : []);
        } catch (e) {
          console.warn("Balances list not available, will lazy-fetch per staff:", e?.response?.status);
          setBalances([]);
        }
      } catch (err) {
        console.error("Salary fetch error:", err);
        setStaff([]);
        setBalances([]);
        setBranches([]);
        setLoanRequests([]);
        setSapRows([]);
      }
    };
    run();
  }, []);

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

  const handleSearch = useCallback(() => setSearch(searchInput), [searchInput]);

  const handleClear = useCallback(() => {
    setSearchInput("");
    setSearch("");
    setBranchFilter("All");
  }, []);

  const branchMap = useMemo(() => {
    const m = new Map();
    (branches || []).forEach((b) => m.set(String(b.id), b));
    return m;
  }, [branches]);

  const balancesByEmpNo = useMemo(() => {
    const m = new Map();
    for (const b of balances || []) {
      const key = toStr(b.employee_no);
      if (key) m.set(key, b);
    }
    return m;
  }, [balances]);

  const approvedLoansByEmp = useMemo(() => {
    const map = new Map();

    for (const row of loanRequests || []) {
      if (norm(row.status) !== "approved") continue;

      const empId = String(row.staff_id ?? row.employee_id ?? "");
      if (!empId) continue;

      const existing = map.get(empId) || {
        salary_advance: 0,
        motorcycle_loan: 0,
        special_advance: 0,
        cash_advance: 0,
        other_receivable: 0,
      };

      const perMonth = toNum(row.per_month);
      const loanType = norm(row.loan_type);

      if (loanType === "salary advance") existing.salary_advance += perMonth;
      else if (loanType === "motorcycle loan") existing.motorcycle_loan += perMonth;
      else if (loanType === "special loan" || loanType === "special advance") existing.special_advance += perMonth;
      else if (loanType === "cash loan" || loanType === "cash advance") existing.cash_advance += perMonth;
      else existing.other_receivable += perMonth;

      map.set(empId, existing);
    }

    return map;
  }, [loanRequests]);

  const approvedSapByEmp = useMemo(() => {
    const map = new Map();

    for (const row of sapRows || []) {
      if (norm(row.status) !== "approved") continue;

      const empId = String(row.employee_id ?? "");
      if (!empId) continue;

      map.set(empId, (map.get(empId) || 0) + toNum(row.per_month));
    }

    return map;
  }, [sapRows]);

  const fetchBalanceForEmp = useCallback(
    async (employeeNo) => {
      const key = toStr(employeeNo);
      if (!key) return null;
      if (balancesByEmpNo.has(key)) return balancesByEmpNo.get(key);

      try {
        const res = await api.get(`/staff-balances/${encodeURIComponent(key)}`);
        const row = res.data || null;

        if (row) {
          setBalances((prev) => {
            const next = Array.isArray(prev) ? [...prev] : [];
            const idx = next.findIndex((x) => toStr(x.employee_no) === key);
            if (idx >= 0) next[idx] = row;
            else next.push(row);
            return next;
          });
        }

        return row;
      } catch (e) {
        console.error("Fetch staff balance failed:", e);
        return null;
      }
    },
    [balancesByEmpNo]
  );

  const staffWithComputed = useMemo(() => {
    return (staff || []).map((s) => {
      const bal = balancesByEmpNo.get(toStr(s.employee_no)) || {};
      const monthlyLoans = approvedLoansByEmp.get(String(s.id)) || {
        salary_advance: 0,
        motorcycle_loan: 0,
        special_advance: 0,
        cash_advance: 0,
        other_receivable: 0,
      };
      const monthlySap = approvedSapByEmp.get(String(s.id)) || 0;

      const salary = toNum(s.salary);
      const ecola = toNum(s.ecola);
      const totalCompensation = salary + ecola;

      const transportation = toNum(s.transportation);
      const repairing = toNum(s.repairing);
      const postage = toNum(s.postage);
      const additional_target = toNum(s.additional_target);
      const additional_monitoring = toNum(s.additional_monitoring);
      const others_allowance = toNum(s.other_deduction);

      const total_allowances =
        transportation + repairing + postage + additional_target + additional_monitoring + others_allowance;

      const grossPay = totalCompensation + total_allowances;

      const hdmf_er = toNum(s.hdmf_er);
      const sss_er = toNum(s.sss_er);
      const ph_er = toNum(s.ph_er);
      const total_er = hdmf_er + sss_er + ph_er;

      const hdmf_ee = toNum(s.hdmf_ee);
      const sss_ee = toNum(s.sss_ee);
      const ph_ee = toNum(s.ph_ee);
      const total_ee = hdmf_ee + sss_ee + ph_ee;

      const tax = toNum(s.tax);
      const utility_charge = toNum(s.utility_charge ?? bal.utility ?? s.utility);

      const cbu = toNum(bal.cbu);
      const cashbond = toNum(bal.cashbond);

      const salary_advance = toNum(monthlyLoans.salary_advance);
      const motorcycle_loan = toNum(monthlyLoans.motorcycle_loan);
      const special_advance = toNum(monthlyLoans.special_advance);
      const cash_advance = toNum(monthlyLoans.cash_advance);
      const other_receivable = toNum(monthlyLoans.other_receivable);
      const staff_accounts_payable = toNum(monthlySap);

      const total_deduction =
        tax +
        utility_charge +
        total_ee +
        cbu +
        cashbond +
        salary_advance +
        motorcycle_loan +
        special_advance +
        cash_advance +
        other_receivable +
        staff_accounts_payable;

      const net_pay = grossPay - total_deduction;

      const br = branchMap.get(String(s.branch_id ?? "")) || null;

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

        salary,
        ecola,
        totalCompensation,

        transportation,
        repairing,
        postage,
        additional_target,
        additional_monitoring,
        others_allowance,
        total_allowances,

        grossPay,

        hdmf_er,
        sss_er,
        ph_er,
        total_er,
        hdmf_ee,
        sss_ee,
        ph_ee,
        total_ee,

        tax,
        utility_charge,

        cbu,
        cashbond,

        salary_advance,
        motorcycle_loan,
        special_advance,
        cash_advance,
        other_receivable,
        staff_accounts_payable,

        total_deduction,
        net_pay,

        payroll_date: new Date().toISOString(),
      };
    });
  }, [staff, balancesByEmpNo, approvedLoansByEmp, approvedSapByEmp, branchMap]);

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
        emp.employee_no,
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
    const repairing = toNum(s.repairing);
    const postage = toNum(s.postage);
    const additional_target = toNum(s.additional_target);
    const additional_monitoring = toNum(s.additional_monitoring);
    const others_allowance = toNum(s.others_allowance ?? s.other_deduction);

    const total_allowances =
      transportation + repairing + postage + additional_target + additional_monitoring + others_allowance;

    const totalCompensation = salary + ecola;
    const grossPay = totalCompensation + total_allowances;

    const totalER = toNum(s.total_er);
    const totalEE = toNum(s.total_ee);

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
                <div><strong>Employee No:</strong> ${s.employee_no || "-"}</div>
                <div><strong>Branch:</strong> ${branchLabel}</div>
                <div><strong>Area:</strong> ${s.area ?? "-"}</div>
              </div>
            </div>

            <div class="employee">
              <div class="row"><div class="label">Employee Name:</div><div class="value">${empName}</div></div>
              <div class="row"><div class="label">Position:</div><div class="value">${s.position ?? "-"}</div></div>
              <div class="row"><div class="label">Department:</div><div class="value">${s.department ?? "-"}</div></div>
              <div class="row"><div class="label">Payroll Date:</div><div class="value">${payrollDate}</div></div>
            </div>

            <div class="grid">
              <div class="card">
                <h3>Compensation</h3>
                <table>
                  <tr><td>Salary</td><td>${money(salary)}</td></tr>
                  <tr><td>Ecola</td><td>${money(ecola)}</td></tr>

                  <tr><td>Transportation</td><td>${money(transportation)}</td></tr>
                  <tr><td>Repairing</td><td>${money(repairing)}</td></tr>
                  <tr><td>Postage</td><td>${money(postage)}</td></tr>
                  <tr><td>Additional Target</td><td>${money(additional_target)}</td></tr>
                  <tr><td>Additional Monitoring</td><td>${money(additional_monitoring)}</td></tr>
                  <tr><td>Others</td><td>${money(others_allowance)}</td></tr>
                  <tr class="total-row"><td>Total Allowances</td><td>${money(total_allowances)}</td></tr>

                  <tr class="total-row"><td>Gross Pay</td><td>${money(grossPay)}</td></tr>
                </table>
              </div>

              <div class="card">
                <h3>Deductions (Monthly)</h3>
                <table>
                  <tr><td>Withheld Tax</td><td>${money(s.tax)}</td></tr>
                  <tr><td>Utility</td><td>${money(s.utility_charge)}</td></tr>
                  <tr><td>SSS (EE)</td><td>${money(s.sss_ee)}</td></tr>
                  <tr><td>PhilHealth (EE)</td><td>${money(s.ph_ee)}</td></tr>
                  <tr><td>HDMF (EE)</td><td>${money(s.hdmf_ee)}</td></tr>
                  <tr><td>CBU</td><td>${money(s.cbu)}</td></tr>
                  <tr><td>Cashbond</td><td>${money(s.cashbond)}</td></tr>
                  <tr><td>Salary Advance</td><td>${money(s.salary_advance)}</td></tr>
                  <tr><td>Motorcycle Loan</td><td>${money(s.motorcycle_loan)}</td></tr>
                  <tr><td>Special Advance</td><td>${money(s.special_advance)}</td></tr>
                  <tr><td>Cash Advance</td><td>${money(s.cash_advance)}</td></tr>
                  <tr><td>Other Receivable</td><td>${money(s.other_receivable)}</td></tr>
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

  const openStaff = async (emp) => {
    const empNo = toStr(emp.employee_no);
    const hasBal = balancesByEmpNo.has(empNo);

    if (!hasBal && empNo) {
      await fetchBalanceForEmp(empNo);
    }

    const latest = staffWithComputed.find((x) => String(x.id) === String(emp.id)) || emp;
    setSelectedStaff(latest);
  };

  useEffect(() => {
    if (!selectedStaff) return;
    const latest = staffWithComputed.find((x) => String(x.id) === String(selectedStaff.id));
    if (!latest) return;
    setSelectedStaff(latest);
  }, [staffWithComputed, selectedStaff?.id]);

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
                <th>Employee No</th>
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
                  <td>{emp.employee_no || "-"}</td>
                  <td className="td-strong">{emp.display_name}</td>
                  <td>{emp.position || "-"}</td>
                  <td>{emp.branch_code || emp.branch_name ? `${emp.branch_code} • ${emp.branch_name}` : "-"}</td>
                  <td>{emp.area || "-"}</td>
                  <td>
                    <button className="view-btn" onClick={() => openStaff(emp)} type="button">
                      View
                    </button>
                  </td>
                </tr>
              ))}

              {filteredStaff.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty-state">
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
                  <strong>{money(selectedStaff.totalCompensation)}</strong>
                </div>
              </div>

              <div className="salary-box">
                <div className="box-title">Transportation & Allowances</div>

                <div className="box-row">
                  <span>Transportation</span>
                  <strong>{money(selectedStaff.transportation)}</strong>
                </div>
                <div className="box-row">
                  <span>Repairing</span>
                  <strong>{money(selectedStaff.repairing)}</strong>
                </div>
                <div className="box-row">
                  <span>Postage</span>
                  <strong>{money(selectedStaff.postage)}</strong>
                </div>
                <div className="box-row">
                  <span>Additional Target</span>
                  <strong>{money(selectedStaff.additional_target)}</strong>
                </div>
                <div className="box-row">
                  <span>Additional Monitoring</span>
                  <strong>{money(selectedStaff.additional_monitoring)}</strong>
                </div>
                <div className="box-row">
                  <span>Others</span>
                  <strong>{money(selectedStaff.others_allowance)}</strong>
                </div>

                <div className="box-row total">
                  <span>Total</span>
                  <strong>{money(selectedStaff.total_allowances)}</strong>
                </div>

                <div className="box-row total">
                  <span>Gross Pay</span>
                  <strong>{money(selectedStaff.grossPay)}</strong>
                </div>
              </div>

              <div className="salary-box full">
                <div className="box-title">Deductions (Monthly)</div>

                <div className="box-row">
                  <span>Withheld Tax</span>
                  <strong>{money(selectedStaff.tax)}</strong>
                </div>
                <div className="box-row">
                  <span>Utility</span>
                  <strong>{money(selectedStaff.utility_charge)}</strong>
                </div>

                <div className="box-row">
                  <span>SSS (EE)</span>
                  <strong>{money(selectedStaff.sss_ee)}</strong>
                </div>
                <div className="box-row">
                  <span>PhilHealth (EE)</span>
                  <strong>{money(selectedStaff.ph_ee)}</strong>
                </div>
                <div className="box-row">
                  <span>HDMF (EE)</span>
                  <strong>{money(selectedStaff.hdmf_ee)}</strong>
                </div>

                <div className="box-row">
                  <span>CBU</span>
                  <strong>{money(selectedStaff.cbu)}</strong>
                </div>
                <div className="box-row">
                  <span>Cashbond</span>
                  <strong>{money(selectedStaff.cashbond)}</strong>
                </div>

                <div className="box-row">
                  <span>Salary Advance</span>
                  <strong>{money(selectedStaff.salary_advance)}</strong>
                </div>
                <div className="box-row">
                  <span>Motorcycle Loan</span>
                  <strong>{money(selectedStaff.motorcycle_loan)}</strong>
                </div>
                <div className="box-row">
                  <span>Special Advance</span>
                  <strong>{money(selectedStaff.special_advance)}</strong>
                </div>
                <div className="box-row">
                  <span>Cash Advance</span>
                  <strong>{money(selectedStaff.cash_advance)}</strong>
                </div>
                <div className="box-row">
                  <span>Other Receivable</span>
                  <strong>{money(selectedStaff.other_receivable)}</strong>
                </div>
                <div className="box-row">
                  <span>Staff Accounts Payable</span>
                  <strong>{money(selectedStaff.staff_accounts_payable)}</strong>
                </div>

                <div className="box-row total">
                  <span>Total Deduction</span>
                  <strong>{money(selectedStaff.total_deduction)}</strong>
                </div>
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