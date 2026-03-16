import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/Dashboard.css";
import api from "../api/axiosClient";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

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
  inactiveEmployees: 0,
  totalEmployees: 0,

  pendingLeaves: 0,
  approvedLeaves: 0,
  rejectedLeaves: 0,
  totalLeaves: 0,

  pendingLoans: 0,
  approvedLoans: 0,
  rejectedLoans: 0,
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

const getStaffStatus = (s) => String(s?.status || "Active").trim().toLowerCase();

export default function Dashboard() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(emptyStats);

  const token = localStorage.getItem("token");
  const user = useMemo(() => readUser(), [token]);
  const theme = (localStorage.getItem("theme") || "light").toLowerCase();
  const isDark = theme === "dark";

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

  const countStatus = (rows, key = "status") => {
    const norm = (v) => String(v || "").trim().toLowerCase();
    const pending = rows.filter((x) => norm(x[key]) === "pending").length;
    const approved = rows.filter((x) => norm(x[key]) === "approved").length;
    const rejected = rows.filter((x) => norm(x[key]) === "rejected").length;
    return { pending, approved, rejected, total: rows.length };
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

      const activeEmployees = (staffData || []).filter((s) => getStaffStatus(s) !== "inactive").length;
      const inactiveEmployees = (staffData || []).filter((s) => getStaffStatus(s) === "inactive").length;
      const totalEmployees = (staffData || []).length;

      const leaveCounts = countStatus(leaveData || [], "status");
      const loanCounts = countStatus(loanData || [], "status");

      const totals = computeTotals(balances);

      setStats({
        activeEmployees,
        inactiveEmployees,
        totalEmployees,

        pendingLeaves: leaveCounts.pending,
        approvedLeaves: leaveCounts.approved,
        rejectedLeaves: leaveCounts.rejected,
        totalLeaves: leaveCounts.total,

        pendingLoans: loanCounts.pending,
        approvedLoans: loanCounts.approved,
        rejectedLoans: loanCounts.rejected,
        totalLoans: loanCounts.total,

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

  const pct = (a, b) => {
    const denom = Math.max(1, toNum(b));
    return Math.max(0, Math.min(100, Math.round((toNum(a) / denom) * 100)));
  };

  const leaveApprovalPct = pct(stats.approvedLeaves, stats.totalLeaves);
  const loanApprovalPct = pct(stats.approvedLoans, stats.totalLoans);

  const totalReceivable =
    toNum(stats.totalCBU) +
    toNum(stats.totalCashbond) +
    toNum(stats.totalSalaryAdvance) +
    toNum(stats.totalMotorcycleLoan) +
    toNum(stats.totalSpecialAdvance) +
    toNum(stats.totalCashAdvance) +
    toNum(stats.totalOtherReceivable);

  const payableRatio = Math.min(
    99,
    Math.max(
      1,
      Math.round(
        (toNum(stats.totalStaffAccountsPayable) /
          Math.max(1, totalReceivable + toNum(stats.totalStaffAccountsPayable))) *
          100
      )
    )
  );

  const balanceLineData = [
    { name: "CBU", value: toNum(stats.totalCBU) },
    { name: "Cashbond", value: toNum(stats.totalCashbond) },
    { name: "Salary Advance", value: toNum(stats.totalSalaryAdvance) },
    { name: "Motorcycle Loan", value: toNum(stats.totalMotorcycleLoan) },
    { name: "Special Advance", value: toNum(stats.totalSpecialAdvance) },
    { name: "Cash Advance", value: toNum(stats.totalCashAdvance) },
    { name: "Other Receivable", value: toNum(stats.totalOtherReceivable) },
    { name: "Staff Payable", value: toNum(stats.totalStaffAccountsPayable) },
  ];

  const approvalLineData = [
    {
      name: "Leaves",
      Pending: toNum(stats.pendingLeaves),
      Approved: toNum(stats.approvedLeaves),
      Rejected: toNum(stats.rejectedLeaves),
    },
    {
      name: "Loans",
      Pending: toNum(stats.pendingLoans),
      Approved: toNum(stats.approvedLoans),
      Rejected: toNum(stats.rejectedLoans),
    },
  ];

  const chartTooltipMoney = (value) =>
    `₱ ${toNum(value).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  return (
    <div className="dash" data-theme={isDark ? "dark" : "light"}>
      <div className="dash__head">
        <div>
          <div className="dash__title">Dashboard Overview</div>
          <div className="dash__sub">Workforce, leaves, loans, and balances snapshot</div>
        </div>
        {loading && <div className="pill">Loading…</div>}
      </div>

      <div className="dash__kpis">
        <EmployeeKpiCard
          title="TOTAL EMPLOYEES"
          active={stats.activeEmployees}
          inactive={stats.inactiveEmployees}
          total={stats.totalEmployees}
          badge={leaveApprovalPct}
          accent="blue"
        />

        <LeaveKpiCard
          title="LEAVE REQUESTS"
          pending={stats.pendingLeaves}
          approved={stats.approvedLeaves}
          rejected={stats.rejectedLeaves}
          total={stats.totalLeaves}
          badge={leaveApprovalPct}
          accent="red"
        />

        <LoanKpiCard
          title="LOAN REQUESTS"
          pending={stats.pendingLoans}
          approved={stats.approvedLoans}
          rejected={stats.rejectedLoans}
          total={stats.totalLoans}
          badge={loanApprovalPct}
          accent="orange"
        />

        <KpiCard
          title="TOTAL PAYABLE"
          value={money(stats.totalStaffAccountsPayable)}
          subtitle="Staff Accounts Payable"
          badge={payableRatio}
          trend="up"
          accent="green"
        />
      </div>

      <div className="dash__panels">
        <div className="card card--panel">
          <div className="card__head">
            <div>
              <div className="card__title">Balances Trend</div>
              <div className="card__sub">Line graph of all balance totals</div>
            </div>
            <button className="btn btn--ghost" type="button">
              Actions
            </button>
          </div>

          <div className="chart">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart
                data={balanceLineData}
                margin={{ top: 10, right: 20, left: 0, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.16)" />
                <XAxis
                  dataKey="name"
                  stroke="#94a3b8"
                  tick={{ fontSize: 11 }}
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                  height={60}
                />
                <YAxis
                  stroke="#94a3b8"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => `₱${Math.round(v / 1000)}k`}
                />
                <Tooltip
                  formatter={(value) => chartTooltipMoney(value)}
                  contentStyle={{
                    background: "#0f172a",
                    border: "1px solid rgba(148,163,184,0.2)",
                    borderRadius: 12,
                    color: "#fff",
                  }}
                  labelStyle={{ color: "#cbd5e1" }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="value"
                  name="Amount"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="legend">
            <span className="dot dot--blue" /> Balance totals
          </div>
        </div>

        <div className="card card--panel">
          <div className="card__head">
            <div>
              <div className="card__title">Approval Trends</div>
              <div className="card__sub">Leave and loan request status comparison</div>
            </div>
            <div className="icons">
              <button className="iconBtn" aria-label="settings" type="button">
                ⚙
              </button>
              <button className="iconBtn" aria-label="menu" type="button">
                ≡
              </button>
            </div>
          </div>

          <div className="chart">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart
                data={approvalLineData}
                margin={{ top: 10, right: 20, left: 0, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.16)" />
                <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    background: "#0f172a",
                    border: "1px solid rgba(148,163,184,0.2)",
                    borderRadius: 12,
                    color: "#fff",
                  }}
                  labelStyle={{ color: "#cbd5e1" }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="Pending"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="Approved"
                  stroke="#22c55e"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="Rejected"
                  stroke="#ef4444"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmployeeKpiCard({ title, active, inactive, total, badge, accent }) {
  return (
    <div className={`kpi kpi--${accent}`}>
      <div className="kpi__top">
        <div className="kpi__title">{title}</div>
        <div className="kpi__badge">{badge}</div>
      </div>

      <div style={{ marginTop: 10 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            <tr>
              <td style={{ opacity: 0.9 }}>Active</td>
              <td style={{ textAlign: "right", fontWeight: 700 }}>{active}</td>
            </tr>
            <tr>
              <td style={{ opacity: 0.9 }}>Inactive</td>
              <td style={{ textAlign: "right", fontWeight: 700 }}>{inactive}</td>
            </tr>
            <tr>
              <td style={{ opacity: 0.9 }}>Total</td>
              <td style={{ textAlign: "right", fontWeight: 800 }}>{total}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="kpi__subtitle" style={{ marginTop: 8 }}>
        Employee status summary
      </div>
      <div className="kpi__bar" />
    </div>
  );
}

function LeaveKpiCard({ title, pending, approved, rejected, total, badge, accent }) {
  return (
    <div className={`kpi kpi--${accent}`}>
      <div className="kpi__top">
        <div className="kpi__title">{title}</div>
        <div className="kpi__badge">{badge}</div>
      </div>

      <div style={{ marginTop: 10 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            <tr>
              <td style={{ opacity: 0.9 }}>Pending</td>
              <td style={{ textAlign: "right", fontWeight: 700 }}>{pending}</td>
            </tr>
            <tr>
              <td style={{ opacity: 0.9 }}>Approved</td>
              <td style={{ textAlign: "right", fontWeight: 700 }}>{approved}</td>
            </tr>
            <tr>
              <td style={{ opacity: 0.9 }}>Rejected</td>
              <td style={{ textAlign: "right", fontWeight: 700 }}>{rejected}</td>
            </tr>
            <tr>
              <td style={{ opacity: 0.9 }}>Total</td>
              <td style={{ textAlign: "right", fontWeight: 800 }}>{total}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="kpi__subtitle" style={{ marginTop: 8 }}>
        Leave status summary
      </div>
      <div className="kpi__bar" />
    </div>
  );
}

function LoanKpiCard({ title, pending, approved, rejected, total, badge, accent }) {
  return (
    <div className={`kpi kpi--${accent}`}>
      <div className="kpi__top">
        <div className="kpi__title">{title}</div>
        <div className="kpi__badge">{badge}</div>
      </div>

      <div style={{ marginTop: 10 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            <tr>
              <td style={{ opacity: 0.9 }}>Pending</td>
              <td style={{ textAlign: "right", fontWeight: 700 }}>{pending}</td>
            </tr>
            <tr>
              <td style={{ opacity: 0.9 }}>Approved</td>
              <td style={{ textAlign: "right", fontWeight: 700 }}>{approved}</td>
            </tr>
            <tr>
              <td style={{ opacity: 0.9 }}>Rejected</td>
              <td style={{ textAlign: "right", fontWeight: 700 }}>{rejected}</td>
            </tr>
            <tr>
              <td style={{ opacity: 0.9 }}>Total</td>
              <td style={{ textAlign: "right", fontWeight: 800 }}>{total}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="kpi__subtitle" style={{ marginTop: 8 }}>
        Loan status summary
      </div>
      <div className="kpi__bar" />
    </div>
  );
}

function KpiCard({ title, value, subtitle, trend, badge, accent }) {
  return (
    <div className={`kpi kpi--${accent}`}>
      <div className="kpi__top">
        <div className="kpi__title">{title}</div>
        <div className="kpi__badge">{badge}</div>
      </div>
      <div className="kpi__valueRow">
        <span className={`kpi__trend kpi__trend--${trend}`}>
          {trend === "up" ? "▲" : trend === "down" ? "▼" : "•"}
        </span>
        <div className="kpi__value">{value}</div>
      </div>
      <div className="kpi__subtitle">{subtitle}</div>
      <div className="kpi__bar" />
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="mini">
      <div className="mini__label">{label}</div>
      <div className="mini__row">
        <div className="mini__value">{value}</div>
      </div>
    </div>
  );
}

function TargetBar({ label, percent, accent }) {
  const p = Math.max(0, Math.min(100, toNum(percent)));
  return (
    <div className="target">
      <div className="target__top">
        <div className={`target__pct target__pct--${accent}`}>{p}%</div>
        <div className="target__label">{label}</div>
      </div>
      <div className={`target__bar target__bar--${accent}`}>
        <span style={{ width: `${p}%` }} />
      </div>
    </div>
  );
}

function InfoCard({ title, value, strong }) {
  return (
    <div className={`infoCard ${strong ? "infoCard--strong" : ""}`}>
      <div className="infoCard__title">{title}</div>
      <div className="infoCard__value">{value}</div>
    </div>
  );
}