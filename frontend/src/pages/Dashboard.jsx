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

// normalize staff status
const getStaffStatus = (s) => String(s?.status || "Active").trim().toLowerCase(); // <- change here if needed

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
        {/* TOTAL EMPLOYEES (table inside) */}
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

      {/* keep the rest of your dashboard the same */}
      <div className="dash__panels">
        <div className="card card--panel">
          <div className="card__head">
            <div>
              <div className="card__title">Balances Breakdown</div>
              <div className="card__sub">Receivables vs Payables</div>
            </div>
            <button className="btn btn--ghost" type="button">
              Actions
            </button>
          </div>

          <div className="chart">
            <div className="chart__placeholder">Chart placeholder (CBU/Cashbond/Advances/Loans…)</div>
          </div>

          <div className="legend">
            <span className="dot dot--blue" /> Receivables
            <span className="legend__spacer" />
            <span className="dot dot--green" /> Payables
          </div>
        </div>

        <div className="card card--panel">
          <div className="card__head">
            <div className="card__title">Approval Rate</div>
            <div className="icons">
              <button className="iconBtn" aria-label="settings" type="button">
                ⚙
              </button>
              <button className="iconBtn" aria-label="menu" type="button">
                ≡
              </button>
            </div>
          </div>

          <div className="donutWrap">
            <Donut percent={leaveApprovalPct} label="Leaves" />
            <div className="donutMeta">
              <div className="donutMeta__label">Loan Approval Target</div>
              <div className="donutMeta__bar">
                <span style={{ width: `${loanApprovalPct}%` }} />
              </div>
              <div className="donutMeta__pct">{loanApprovalPct}%</div>
            </div>
          </div>
        </div>
      </div>

      <div className="dash__mini">
        <MiniStat label="Total CBU" value={money(stats.totalCBU)} />
        <MiniStat label="Total Cashbond" value={money(stats.totalCashbond)} />
        <MiniStat label="Salary Advance" value={money(stats.totalSalaryAdvance)} />
        <MiniStat label="Motorcycle Loan" value={money(stats.totalMotorcycleLoan)} />
      </div>

      <div className="dash__targetHead">
        <div className="dash__targetTitle">Target Section</div>
        <a className="link" href="#details">
          View Details
        </a>
      </div>

      <div className="dash__targets" id="details">
        <TargetBar label="Income Target (CBU)" percent={pct(stats.totalCBU, totalReceivable)} accent="blue" />
        <TargetBar label="Expenses Target (Cashbond)" percent={pct(stats.totalCashbond, totalReceivable)} accent="green" />
        <TargetBar
          label="Spendings Target (Advances)"
          percent={pct(stats.totalSalaryAdvance + stats.totalCashAdvance + stats.totalSpecialAdvance, totalReceivable)}
          accent="orange"
        />
        <TargetBar label="Totals Target (Other)" percent={pct(stats.totalOtherReceivable, totalReceivable)} accent="red" />
      </div>

      <div className="dash__grid">
        <InfoCard title="Total Special Advance" value={money(stats.totalSpecialAdvance)} />
        <InfoCard title="Total Cash Advance" value={money(stats.totalCashAdvance)} />
        <InfoCard title="Total Other Receivable" value={money(stats.totalOtherReceivable)} />
        <InfoCard title="Total Staff Accounts Payable" value={money(stats.totalStaffAccountsPayable)} strong />
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

      {/* mini table */}
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

function Donut({ percent = 75, label = "Percent" }) {
  const p = Math.max(0, Math.min(100, toNum(percent)));
  const deg = (p / 100) * 360;
  return (
    <div className="donut" style={{ "--deg": `${deg}deg` }}>
      <div className="donut__inner">
        <div className="donut__label">{label}</div>
        <div className="donut__value">{p}</div>
      </div>
    </div>
  );
}