import React, { useEffect, useMemo, useState, useCallback } from "react";
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

  totalERContribution: 0,
  totalEEContribution: 0,
  totalTax: 0,

  totalSssEr: 0,
  totalPhEr: 0,
  totalHdmfEr: 0,

  totalSssEe: 0,
  totalPhEe: 0,
  totalHdmfEe: 0,

  totalManagementExpenses: 0,
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

      const totalSssEr = (staffData || []).reduce((sum, s) => sum + toNum(s.sss_er), 0);
      const totalPhEr = (staffData || []).reduce((sum, s) => sum + toNum(s.ph_er), 0);
      const totalHdmfEr = (staffData || []).reduce((sum, s) => sum + toNum(s.hdmf_er), 0);

      const totalSssEe = (staffData || []).reduce((sum, s) => sum + toNum(s.sss_ee), 0);
      const totalPhEe = (staffData || []).reduce((sum, s) => sum + toNum(s.ph_ee), 0);
      const totalHdmfEe = (staffData || []).reduce((sum, s) => sum + toNum(s.hdmf_ee), 0);

      const totalERContribution = totalSssEr + totalPhEr + totalHdmfEr;
      const totalEEContribution = totalSssEe + totalPhEe + totalHdmfEe;
      const totalTax = (staffData || []).reduce((sum, s) => sum + toNum(s.tax), 0);

      const totalManagementExpenses = (staffData || []).reduce(
        (sum, s) =>
          sum +
          toNum(s.transportation) +
          toNum(s.repairing) +
          toNum(s.postage) +
          toNum(s.additional_target) +
          toNum(s.additional_monitoring) +
          toNum(s.motorcycle) +
          toNum(s.other_deduction),
        0
      );

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

        totalERContribution,
        totalEEContribution,
        totalTax,

        totalSssEr,
        totalPhEr,
        totalHdmfEr,

        totalSssEe,
        totalPhEe,
        totalHdmfEe,

        totalManagementExpenses,
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

  const contributionTotal =
    toNum(stats.totalERContribution) +
    toNum(stats.totalEEContribution) +
    toNum(stats.totalTax);

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
          <div className="dash__sub">Workforce, leaves, loans, balances, and expense snapshot</div>
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

        <ContributionDropdownCard
          title="TOTAL CONTRIBUTION"
          totalER={stats.totalERContribution}
          totalEE={stats.totalEEContribution}
          totalTax={stats.totalTax}
          totalSssEr={stats.totalSssEr}
          totalPhEr={stats.totalPhEr}
          totalHdmfEr={stats.totalHdmfEr}
          totalSssEe={stats.totalSssEe}
          totalPhEe={stats.totalPhEe}
          totalHdmfEe={stats.totalHdmfEe}
          accent="green"
        />

        <KpiCard
          title="MANAGEMENT EXPENSES"
          value={money(stats.totalManagementExpenses)}
          subtitle="Transportation, repairing, postage, target, monitoring, motorcycle, others"
          badge={Math.min(99, Math.max(1, pct(stats.totalManagementExpenses, contributionTotal || 1)))}
          trend="up"
          accent="violet"
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

function ContributionDropdownCard({
  title,
  totalER,
  totalEE,
  totalTax,
  totalSssEr,
  totalPhEr,
  totalHdmfEr,
  totalSssEe,
  totalPhEe,
  totalHdmfEe,
  accent,
}) {
  const [open, setOpen] = useState(false);

  const total = toNum(totalER) + toNum(totalEE) + toNum(totalTax);

  return (
    <div className={`kpi kpi--${accent}`}>
      <div className="kpi__top">
        <div className="kpi__title">{title}</div>
        <button
          type="button"
          onClick={() => setOpen((p) => !p)}
          style={{
            background: "transparent",
            border: "none",
            color: "inherit",
            cursor: "pointer",
            fontWeight: 800,
            fontSize: 14,
          }}
        >
          {open ? "▲" : "▼"}
        </button>
      </div>

      <div className="kpi__valueRow">
        <span className="kpi__trend kpi__trend--up">▲</span>
        <div className="kpi__value">{money(total)}</div>
      </div>

      <div className="kpi__subtitle">ER + EE + Tax contributions</div>

      {open && (
        <div style={{ marginTop: 10 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              <tr>
                <td style={{ opacity: 0.9, fontWeight: 800 }}>ER Breakdown</td>
                <td />
              </tr>
              <tr>
                <td style={{ opacity: 0.9 }}>SSS ER</td>
                <td style={{ textAlign: "right", fontWeight: 700 }}>{money(totalSssEr)}</td>
              </tr>
              <tr>
                <td style={{ opacity: 0.9 }}>PhilHealth ER</td>
                <td style={{ textAlign: "right", fontWeight: 700 }}>{money(totalPhEr)}</td>
              </tr>
              <tr>
                <td style={{ opacity: 0.9 }}>HDMF ER</td>
                <td style={{ textAlign: "right", fontWeight: 700 }}>{money(totalHdmfEr)}</td>
              </tr>
              <tr>
                <td style={{ opacity: 0.9, fontWeight: 800 }}>Total ER</td>
                <td style={{ textAlign: "right", fontWeight: 800 }}>{money(totalER)}</td>
              </tr>

              <tr>
                <td colSpan={2} style={{ height: 8 }}></td>
              </tr>

              <tr>
                <td style={{ opacity: 0.9, fontWeight: 800 }}>EE Breakdown</td>
                <td />
              </tr>
              <tr>
                <td style={{ opacity: 0.9 }}>SSS EE</td>
                <td style={{ textAlign: "right", fontWeight: 700 }}>{money(totalSssEe)}</td>
              </tr>
              <tr>
                <td style={{ opacity: 0.9 }}>PhilHealth EE</td>
                <td style={{ textAlign: "right", fontWeight: 700 }}>{money(totalPhEe)}</td>
              </tr>
              <tr>
                <td style={{ opacity: 0.9 }}>HDMF EE</td>
                <td style={{ textAlign: "right", fontWeight: 700 }}>{money(totalHdmfEe)}</td>
              </tr>
              <tr>
                <td style={{ opacity: 0.9, fontWeight: 800 }}>Total EE</td>
                <td style={{ textAlign: "right", fontWeight: 800 }}>{money(totalEE)}</td>
              </tr>

              <tr>
                <td colSpan={2} style={{ height: 8 }}></td>
              </tr>

              <tr>
                <td style={{ opacity: 0.9 }}>Total Tax</td>
                <td style={{ textAlign: "right", fontWeight: 700 }}>{money(totalTax)}</td>
              </tr>
              <tr>
                <td style={{ opacity: 0.9, fontWeight: 900 }}>Grand Total</td>
                <td style={{ textAlign: "right", fontWeight: 900 }}>{money(total)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

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