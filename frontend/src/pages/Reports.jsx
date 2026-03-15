import { useEffect, useMemo, useState } from "react";
import "../styles/Reports.css";
import api from "../api/axiosClient";
import * as XLSX from "xlsx";

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const money = (v) =>
  `₱ ${toNum(v).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const countByStatus = (rows, key = "status") => {
  const norm = (v) => String(v || "").trim().toLowerCase();
  return {
    pending: rows.filter((x) => norm(x[key]) === "pending").length,
    approved: rows.filter((x) => norm(x[key]) === "approved").length,
    rejected: rows.filter((x) => norm(x[key]) === "rejected").length,
    total: rows.length,
  };
};

const getStaffStatus = (s) =>
  String(s?.status || "Active").trim().toLowerCase();

const getEmployeeName = (item) => {
  return (
    item?.employee_name ||
    item?.staff_name ||
    item?.fullname ||
    item?.full_name ||
    `${item?.first_name || ""} ${item?.last_name || ""}`.trim() ||
    "-"
  );
};

export default function Reports() {
  const [loading, setLoading] = useState(false);

  const [staff, setStaff] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [loans, setLoans] = useState([]);
  const [sbfOrders, setSbfOrders] = useState([]);
  const [balances, setBalances] = useState([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState("");

  const safeGet = async (url) => {
    try {
      const res = await api.get(url);
      return res.data || [];
    } catch (err) {
      console.error(`Failed to fetch ${url}:`, err);
      return [];
    }
  };

  useEffect(() => {
    const fetchReports = async () => {
      setLoading(true);
      try {
        const [staffData, leaveData, loanData, sbfData, balanceData] =
          await Promise.all([
            safeGet("/staff"),
            safeGet("/leave-requests"),
            safeGet("/loan-requests"),
            safeGet("/sbf-orders"),
            safeGet("/staff-balances"),
          ]);

        setStaff(Array.isArray(staffData) ? staffData : []);
        setLeaves(Array.isArray(leaveData) ? leaveData : []);
        setLoans(Array.isArray(loanData) ? loanData : []);
        setSbfOrders(Array.isArray(sbfData) ? sbfData : []);
        setBalances(Array.isArray(balanceData) ? balanceData : []);
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
  }, []);

  useEffect(() => {
    if (!modalOpen) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        setModalOpen(false);
        setModalType("");
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [modalOpen]);

  const openModal = (type) => {
    setModalType(type);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalType("");
  };

  const employeeSummary = useMemo(() => {
    const active = staff.filter((x) => getStaffStatus(x) !== "inactive").length;
    const inactive = staff.filter((x) => getStaffStatus(x) === "inactive").length;

    return {
      active,
      inactive,
      total: staff.length,
    };
  }, [staff]);

  const leaveSummary = useMemo(() => countByStatus(leaves), [leaves]);
  const loanSummary = useMemo(() => countByStatus(loans), [loans]);
  const sbfSummary = useMemo(() => countByStatus(sbfOrders), [sbfOrders]);

  const balanceSummary = useMemo(() => {
    return balances.reduce(
      (acc, row) => {
        acc.cbu += toNum(row.cbu);
        acc.cashbond += toNum(row.cashbond);
        acc.salaryAdvance += toNum(row.salary_advance);
        acc.specialAdvance += toNum(row.special_advance);
        acc.cashAdvance += toNum(row.cash_advance);
        acc.motorcycleLoan += toNum(row.motorcycle_loan);
        acc.pagIbigLoan += toNum(row.pag_ibig_loan);
        acc.otherReceivable += toNum(row.other_receivable);
        acc.staffAccountsPayable += toNum(row.staff_accounts_payable);
        return acc;
      },
      {
        cbu: 0,
        cashbond: 0,
        salaryAdvance: 0,
        specialAdvance: 0,
        cashAdvance: 0,
        motorcycleLoan: 0,
        pagIbigLoan: 0,
        otherReceivable: 0,
        staffAccountsPayable: 0,
      }
    );
  }, [balances]);

  const exportData = () => [
    {
      total_employees: employeeSummary.total,
      active_employees: employeeSummary.active,
      inactive_employees: employeeSummary.inactive,
      total_leaves: leaveSummary.total,
      pending_leaves: leaveSummary.pending,
      approved_leaves: leaveSummary.approved,
      rejected_leaves: leaveSummary.rejected,
      total_loans: loanSummary.total,
      pending_loans: loanSummary.pending,
      approved_loans: loanSummary.approved,
      rejected_loans: loanSummary.rejected,
      total_sbf_orders: sbfSummary.total,
      pending_sbf_orders: sbfSummary.pending,
      approved_sbf_orders: sbfSummary.approved,
      rejected_sbf_orders: sbfSummary.rejected,
      cbu: balanceSummary.cbu,
      cashbond: balanceSummary.cashbond,
      salary_advance: balanceSummary.salaryAdvance,
      special_advance: balanceSummary.specialAdvance,
      cash_advance: balanceSummary.cashAdvance,
      motorcycle_loan: balanceSummary.motorcycleLoan,
      pag_ibig_loan: balanceSummary.pagIbigLoan,
      other_receivable: balanceSummary.otherReceivable,
      staff_accounts_payable: balanceSummary.staffAccountsPayable,
    },
  ];

  const exportCSV = () => {
    const data = exportData();
    if (!data.length) {
      alert("No data to export.");
      return;
    }

    const ws = XLSX.utils.json_to_sheet(data);
    const csv = XLSX.utils.sheet_to_csv(ws);

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");

    link.href = URL.createObjectURL(blob);
    link.download = "dashboard_summary.csv";
    link.click();
  };

  const exportExcel = () => {
    const data = exportData();
    if (!data.length) {
      alert("No data to export.");
      return;
    }

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(wb, ws, "Summary");
    XLSX.writeFile(wb, "dashboard_summary.xlsx");
  };

  const getModalPendingCount = () => {
    if (modalType === "employees") {
      return staff.filter((x) => String(x?.status || "").trim().toLowerCase() === "pending").length;
    }

    if (modalType === "leaves") {
      return leaves.filter((x) => String(x?.status || "").trim().toLowerCase() === "pending").length;
    }

    if (modalType === "loans") {
      return loans.filter((x) => String(x?.status || "").trim().toLowerCase() === "pending").length;
    }

    if (modalType === "sbf") {
      return sbfOrders.filter((x) => String(x?.status || "").trim().toLowerCase() === "pending").length;
    }

    return 0;
  };

  return (
    <div className="reports-page">
      <div className="reports-topbar">
        <div>
          <h2 className="reports-title">Reports / Follow Up</h2>
          <p className="reports-subtitle">
            View summary and detailed operational reports.
          </p>
        </div>
      </div>

      <div className="reports-toolbar">
        <button className="reports-btn" onClick={exportCSV} type="button">
          Export CSV
        </button>

        <button className="reports-btn" onClick={exportExcel} type="button">
          Export Excel
        </button>
      </div>

      {loading ? (
        <div className="reports-card">
          <div className="reports-empty">Loading reports...</div>
        </div>
      ) : (
        <>
          <div className="reports-grid">
            <button
              type="button"
              className="reports-stat clickable"
              onClick={() => openModal("employees")}
            >
              <div className="reports-stat-head">
                <div className="reports-stat-label">Employees</div>
              </div>
              <div className="reports-stat-value">{employeeSummary.total}</div>
              <div className="reports-stat-sub">
                Active: {employeeSummary.active} | Inactive: {employeeSummary.inactive}
              </div>
            </button>

            <button
              type="button"
              className="reports-stat clickable"
              onClick={() => openModal("leaves")}
            >
              <div className="reports-stat-head">
                <div className="reports-stat-label">Leave Requests</div>
                {leaveSummary.pending > 0 && (
                  <span className="reports-badge">{leaveSummary.pending}</span>
                )}
              </div>
              <div className="reports-stat-value">{leaveSummary.total}</div>
              <div className="reports-stat-sub">
                Pending: {leaveSummary.pending} | Approved: {leaveSummary.approved} | Rejected: {leaveSummary.rejected}
              </div>
            </button>

            <button
              type="button"
              className="reports-stat clickable"
              onClick={() => openModal("loans")}
            >
              <div className="reports-stat-head">
                <div className="reports-stat-label">Loan Requests</div>
                {loanSummary.pending > 0 && (
                  <span className="reports-badge">{loanSummary.pending}</span>
                )}
              </div>
              <div className="reports-stat-value">{loanSummary.total}</div>
              <div className="reports-stat-sub">
                Pending: {loanSummary.pending} | Approved: {loanSummary.approved} | Rejected: {loanSummary.rejected}
              </div>
            </button>

            <button
              type="button"
              className="reports-stat clickable"
              onClick={() => openModal("sbf")}
            >
              <div className="reports-stat-head">
                <div className="reports-stat-label">SBF Orders</div>
                {sbfSummary.pending > 0 && (
                  <span className="reports-badge">{sbfSummary.pending}</span>
                )}
              </div>
              <div className="reports-stat-value">{sbfSummary.total}</div>
              <div className="reports-stat-sub">
                Pending: {sbfSummary.pending} | Approved: {sbfSummary.approved} | Rejected: {sbfSummary.rejected}
              </div>
            </button>
          </div>

          <div className="reports-card">
            <div className="reports-card-head">
              <div className="reports-card-title">Balances Summary</div>
            </div>

            <div className="reports-mini-grid">
              <div className="reports-mini-stat">
                <span>CBU</span>
                <strong>{money(balanceSummary.cbu)}</strong>
              </div>
              <div className="reports-mini-stat">
                <span>Cashbond</span>
                <strong>{money(balanceSummary.cashbond)}</strong>
              </div>
              <div className="reports-mini-stat">
                <span>Salary Advance</span>
                <strong>{money(balanceSummary.salaryAdvance)}</strong>
              </div>
              <div className="reports-mini-stat">
                <span>Special Advance</span>
                <strong>{money(balanceSummary.specialAdvance)}</strong>
              </div>
              <div className="reports-mini-stat">
                <span>Cash Advance</span>
                <strong>{money(balanceSummary.cashAdvance)}</strong>
              </div>
              <div className="reports-mini-stat">
                <span>Motorcycle Loan</span>
                <strong>{money(balanceSummary.motorcycleLoan)}</strong>
              </div>
              <div className="reports-mini-stat">
                <span>Pag-ibig Loan</span>
                <strong>{money(balanceSummary.pagIbigLoan)}</strong>
              </div>
              <div className="reports-mini-stat">
                <span>Other Receivable</span>
                <strong>{money(balanceSummary.otherReceivable)}</strong>
              </div>
              <div className="reports-mini-stat">
                <span>Staff Accounts Payable</span>
                <strong>{money(balanceSummary.staffAccountsPayable)}</strong>
              </div>
            </div>
          </div>
        </>
      )}

      {modalOpen && (
        <div className="reports-modal-overlay" onMouseDown={closeModal}>
          <div className="reports-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="reports-modal-header">
              <h3 className="reports-modal-title">
                {modalType === "employees" && "Employees"}
                {modalType === "leaves" && "Leave Requests"}
                {modalType === "loans" && "Loan Requests"}
                {modalType === "sbf" && "SBF Orders"}
              </h3>

              <div className="reports-modal-header-right">
                {getModalPendingCount() > 0 && (
                  <span className="reports-modal-badge-circle">
                    {getModalPendingCount()}
                  </span>
                )}

                <button
                  className="reports-modal-close"
                  type="button"
                  onClick={closeModal}
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="reports-modal-body">
              {modalType === "employees" && (
                <div className="reports-table-wrap">
                  <table className="reports-table">
                    <thead>
                      <tr>
                        <th>Employee No</th>
                        <th>Name</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {staff.length === 0 ? (
                        <tr>
                          <td colSpan="3" className="reports-empty-cell">
                            No employee records found.
                          </td>
                        </tr>
                      ) : (
                        staff.map((item, idx) => (
                          <tr key={item.id || idx}>
                            <td>{item.employee_no || "-"}</td>
                            <td>{getEmployeeName(item)}</td>
                            <td>{item.status || "Active"}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {modalType === "leaves" && (
                <div className="reports-table-wrap">
                  <table className="reports-table">
                    <thead>
                      <tr>
                        <th>Employee No</th>
                        <th>Employee Name</th>
                        <th>Leave Type</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaves.length === 0 ? (
                        <tr>
                          <td colSpan="4" className="reports-empty-cell">
                            No leave records found.
                          </td>
                        </tr>
                      ) : (
                        leaves.map((item, idx) => (
                          <tr key={item.id || idx}>
                            <td>{item.employee_no || "-"}</td>
                            <td>{getEmployeeName(item)}</td>
                            <td>{item.leave_type || "-"}</td>
                            <td>{item.status || "-"}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {modalType === "loans" && (
                <div className="reports-table-wrap">
                  <table className="reports-table">
                    <thead>
                      <tr>
                        <th>Employee No</th>
                        <th>Employee Name</th>
                        <th>Loan Type</th>
                        <th>Amount</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loans.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="reports-empty-cell">
                            No loan records found.
                          </td>
                        </tr>
                      ) : (
                        loans.map((item, idx) => (
                          <tr key={item.id || idx}>
                            <td>{item.employee_no || "-"}</td>
                            <td>{getEmployeeName(item)}</td>
                            <td>{item.loan_type || "-"}</td>
                            <td>{money(item.amount)}</td>
                            <td>{item.status || "-"}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {modalType === "sbf" && (
                <div className="reports-table-wrap">
                  <table className="reports-table">
                    <thead>
                      <tr>
                        <th>Order No</th>
                        <th>Employee No</th>
                        <th>Employee Name</th>
                        <th>Assistance Type</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sbfOrders.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="reports-empty-cell">
                            No SBF records found.
                          </td>
                        </tr>
                      ) : (
                        sbfOrders.map((item, idx) => (
                          <tr key={item.id || idx}>
                            <td>{item.order_no || "-"}</td>
                            <td>{item.employee_no || "-"}</td>
                            <td>{getEmployeeName(item)}</td>
                            <td>{item.assistance_type || "-"}</td>
                            <td>{item.status || "-"}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}