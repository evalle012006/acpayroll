import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/Dashboard.css";
import api from "../api/axiosClient";

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const money = (v) =>
  `₱ ${toNum(v).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const readUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
};

const emptyStats = {
  activeEmployees: 0,
  pendingLeaves: 0,
  approvedLeaves: 0,
  totalLeaves: 0,
  pendingLoans: 0,
  approvedLoans: 0,
  totalLoans: 0,

  totalStaffAccountsPayable: 0,
  totalCBU: 0,
  totalCashbond: 0,
  totalSalaryAdvance: 0,
  totalMotorcycleLoan: 0,
  totalSpecialAdvance: 0,
  totalCashAdvance: 0,
  totalOtherReceivable: 0,
};

export default function Dashboard() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(emptyStats);

  const token = localStorage.getItem("token");
  const user = useMemo(() => readUser(), [token]);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login", { replace: true });
  }, [navigate]);

  const safeGet = useCallback(
    async (url) => {
      try {
        const res = await api.get(url);
        return res.data || [];
      } catch (err) {
        const status = err?.response?.status;
        if (status === 401) logout();
        return [];
      }
    },
    [logout]
  );

  const computeTotals = (balances) => {
    return (balances || []).reduce(
      (acc, r) => {
        acc.totalCBU += toNum(r.cbu);
        acc.totalCashbond += toNum(r.cashbond);
        acc.totalSalaryAdvance += toNum(r.salary_advance);
        acc.totalMotorcycleLoan += toNum(r.motorcycle_loan);
        acc.totalSpecialAdvance += toNum(r.special_advance);
        acc.totalCashAdvance += toNum(r.cash_advance);
        acc.totalOtherReceivable += toNum(r.other_receivable);
        acc.totalStaffAccountsPayable += toNum(r.staff_accounts_payable);
        return acc;
      },
      {
        totalCBU: 0,
        totalCashbond: 0,
        totalSalaryAdvance: 0,
        totalMotorcycleLoan: 0,
        totalSpecialAdvance: 0,
        totalCashAdvance: 0,
        totalOtherReceivable: 0,
        totalStaffAccountsPayable: 0,
      }
    );
  };

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const [staffData, leaveData, loanData, balances] = await Promise.all([
        safeGet("/staff"),
        safeGet("/leave-requests"),
        safeGet("/loan-requests"),
        safeGet("/staff-balances"),
      ]);

      const totals = computeTotals(balances);

      setStats({
        activeEmployees: (staffData || []).length,
        pendingLeaves: (leaveData || []).filter((l) => l.status === "Pending").length,
        approvedLeaves: (leaveData || []).filter((l) => l.status === "Approved").length,
        totalLeaves: (leaveData || []).length,
        pendingLoans: (loanData || []).filter((l) => l.status === "Pending").length,
        approvedLoans: (loanData || []).filter((l) => l.status === "Approved").length,
        totalLoans: (loanData || []).length,
        ...totals,
      });
    } finally {
      setLoading(false);
    }
  }, [safeGet]);

  useEffect(() => {
    if (!token || !user) {
      navigate("/login", { replace: true });
      return;
    }

    fetchDashboardData();
  }, [token, user, fetchDashboardData, navigate]);

  return (
    <div className="dashboard-container">
      <h1>Dashboard Overview</h1>

      {loading && <div className="loading">Loading dashboard…</div>}

      <div className="dashboard-section">
        <h2>Workforce Summary</h2>
        <div className="dashboard-cards">
          <div className="card primary">
            <h3>{stats.activeEmployees}</h3>
            <p>Total Employees</p>
          </div>
        </div>
      </div>

      <div className="dashboard-section">
        <h2>Leave Overview</h2>
        <div className="dashboard-cards">
          <div className="card">
            <h3>{stats.pendingLeaves}</h3>
            <p>Pending Leaves</p>
          </div>

          <div className="card approved">
            <h3>{stats.approvedLeaves}</h3>
            <p>Approved Leaves</p>
          </div>

          <div className="card info">
            <h3>{stats.totalLeaves}</h3>
            <p>Total Leave Requests</p>
          </div>
        </div>
      </div>

      <div className="dashboard-section">
        <h2>Loan Overview</h2>
        <div className="dashboard-cards">
          <div className="card">
            <h3>{stats.pendingLoans}</h3>
            <p>Pending Loans</p>
          </div>

          <div className="card approved">
            <h3>{stats.approvedLoans}</h3>
            <p>Approved Loans</p>
          </div>

          <div className="card info">
            <h3>{stats.totalLoans}</h3>
            <p>Total Loan Requests</p>
          </div>
        </div>
      </div>

      <div className="dashboard-section">
        <h2>Balances Summary</h2>
        <div className="dashboard-cards">
          <div className="card info">
            <h3>{money(stats.totalCBU)}</h3>
            <p>Total CBU</p>
          </div>

          <div className="card info">
            <h3>{money(stats.totalCashbond)}</h3>
            <p>Total Cashbond</p>
          </div>

          <div className="card info">
            <h3>{money(stats.totalSalaryAdvance)}</h3>
            <p>Total Salary Advance</p>
          </div>

          <div className="card info">
            <h3>{money(stats.totalMotorcycleLoan)}</h3>
            <p>Total Motorcycle Loan</p>
          </div>

          <div className="card info">
            <h3>{money(stats.totalSpecialAdvance)}</h3>
            <p>Total Special Advance</p>
          </div>

          <div className="card info">
            <h3>{money(stats.totalCashAdvance)}</h3>
            <p>Total Cash Advance</p>
          </div>

          <div className="card info">
            <h3>{money(stats.totalOtherReceivable)}</h3>
            <p>Total Other Receivable</p>
          </div>

          <div className="card primary">
            <h3>{money(stats.totalStaffAccountsPayable)}</h3>
            <p>Total Staff Accounts Payable</p>
          </div>
        </div>
      </div>
    </div>
  );
}