import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import "./styles/layout.css";

import Sidebar from "./components/Sidebar";
import Header from "./components/Header";

import Dashboard from "./pages/Dashboard";
import Staff from "./pages/Staff";
import Transportation from "./pages/Transportation";
import Payroll from "./pages/Payroll";
import Branches from "./pages/Branches";
import Salary from "./pages/Salary";
import ScheduleBalances from "./pages/ScheduleBalances";
import Transactions from "./pages/Transactions";
import SystemUpdate from "./pages/SystemUpdate";
import SystemRates from "./pages/SystemRates";
import Users from "./pages/Users";
import Approval from "./pages/Approval";
import Login from "./pages/Login";
import Profile from "./pages/Profile";
import TransferStaffOrder from "./pages/TransferStaffOrder";
import PromotionOrder from "./pages/PromotionOrder";
import DemotionOrder from "./pages/DemotionOrder";
import SuspensionOrder from "./pages/SuspensionOrder";
import StaffInformation from "./pages/StaffInformation";
import Departments from "./pages/Departments";
import Bonus from "./pages/Bonus";
import Settings from "./pages/Settings";
import LeaveTransactions from "./pages/LeaveTransactions";
import ExitStaff from "./pages/ExitStaff";
import ExitStaffOrders from "./pages/ExitStaffOrders";
import Soa from "./pages/Soa";
import Deployment from "./pages/Deployment";
import SbfOrder from "./pages/SbfOrder";
import Reports from "./pages/Reports";
import AreaConfigurations from "./pages/AreaConfigurations";
import Consolidation from "./pages/Consolidation";
import TaxCalculator from "./pages/TaxCalculator";  
import { CompRatesProvider } from "./context/CompRatesContext";
import Logistic from "./pages/Logistic";
import DetailsCompensation from "./pages/DetailsCompensation";
import OpeningLoanBalances from "./pages/OpeningLoanBalances";
import RegularizationOrders from "./pages/RegularizationOrders";
import ResignationRequests from "./pages/ResignationRequests";

const readUser = () => {
  try {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const hasAuth = () => {
  const token = localStorage.getItem("token");
  const user = localStorage.getItem("user");
  return !!token && !!user;
};

const roleLower = (u) => String(u?.role || "").trim().toLowerCase();

const ProtectedRoute = ({ allowedRoles, children }) => {
  if (!hasAuth()) return <Navigate to="/login" replace />;

  if (allowedRoles?.length) {
    const u = readUser();
    const uRole = roleLower(u);
    const allowed = allowedRoles.map((r) => String(r).trim().toLowerCase());

    if (!allowed.includes(uRole)) {
      if (uRole === "branch manager" || uRole === "area manager" || uRole === "regional manager" || uRole === "assistant vice president") {
        return <Navigate to="/staff-information" replace />;
      }
      return <Navigate to="/dashboard" replace />;
    }
  }

  return children;
};

function ProtectedLayout({ children }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <CompRatesProvider>
      <div className={`layout ${collapsed ? "collapsed" : ""}`}>
        <Sidebar collapsed={collapsed} />

        <div className="main-content">
          <Header toggleSidebar={() => setCollapsed((p) => !p)} />
          <div className="page-content">{children}</div>
        </div>
      </div>
    </CompRatesProvider>
  );
}

function AppShell() {
  const [authTick, setAuthTick] = useState(0);
  const navigate = useNavigate();

  const user = useMemo(() => readUser(), [authTick]);
  const uRole = useMemo(() => roleLower(user), [user]);

  useEffect(() => {
    const onAuthChanged = () => {
      setAuthTick((t) => t + 1);

      if (!hasAuth()) {
        navigate("/login", { replace: true });
      }
    };

    window.addEventListener("auth-changed", onAuthChanged);
    window.addEventListener("storage", onAuthChanged);

    return () => {
      window.removeEventListener("auth-changed", onAuthChanged);
      window.removeEventListener("storage", onAuthChanged);
    };
  }, [navigate]);

  const homeRedirect = () => {
    if (!hasAuth()) return "/login";
    if (uRole === "branch manager" || uRole === "area manager" || uRole === "regional manager" || uRole === "assistant vice president") return "/staff-information";
    return "/dashboard";
  };

  return (
    <Routes>
      <Route path="/" element={<Navigate to={homeRedirect()} replace />} />
      <Route path="/login" element={hasAuth() ? <Navigate to={homeRedirect()} replace /> : <Login />}/>
      <Route path="/staff-information" element={ <ProtectedRoute allowedRoles={["admin", "branch manager", "accounting", "hr", "area manager", "regional manager", "vice president", "assistant vice president", "president", "tread"]}><ProtectedLayout><StaffInformation /></ProtectedLayout></ProtectedRoute>}/>
      <Route path="/salary" element={ <ProtectedRoute allowedRoles={["admin", "accounting", "hr", "president", "assistant vice president", "senior vice president", "vice president", "tread"]}><ProtectedLayout><Salary /></ProtectedLayout></ProtectedRoute>}/>
      <Route path="/payroll/:branchId" element={ <ProtectedRoute allowedRoles={["admin", "branch manager", "accounting", "hr", "area manager", "regional manager", "assistant vice president","vice president", "senior vice president", "president"]}><ProtectedLayout><Payroll /></ProtectedLayout></ProtectedRoute>}/>
      <Route path="/profile" element={ <ProtectedRoute allowedRoles={["admin", "branch manager", "accounting", "hr", "area manager", "regional manager", "assistant vice president","vice president", "senior vice president", "president", "tread"]}><ProtectedLayout><Profile /></ProtectedLayout></ProtectedRoute>}/>
      <Route path="/settings" element={ <ProtectedRoute allowedRoles={["admin", "branch manager", "accounting", "hr", "tread","area manager", "regional manager", "assistant vice president", "vice president", "senior vice president", "president", "tread"]}><ProtectedLayout><Settings /></ProtectedLayout></ProtectedRoute>}/>
      <Route path="/dashboard" element={ <ProtectedRoute allowedRoles={["admin", "branch manager", "accounting", "hr", "area manager", "regional manager", "assistant vice president", "vice president", "senior vice president", "president", "tread"]}><ProtectedLayout><Dashboard /></ProtectedLayout></ProtectedRoute>}/>
      <Route path="/payroll" element={ <ProtectedRoute allowedRoles={["admin", "accounting", "hr", "branch manager", "area manager", "regional manager", "assistant vice president", "vice president", "senior vice president", "president"]}><ProtectedLayout><Payroll /></ProtectedLayout></ProtectedRoute>}/>
      <Route path="/staff" element={ <ProtectedRoute allowedRoles={["admin", "accounting", "hr", "president", "vice president", "senior vice president"]}><ProtectedLayout><Staff /></ProtectedLayout></ProtectedRoute>}/>
      <Route path="/transportation/:id" element={ <ProtectedRoute allowedRoles={["admin", "branch manager", "accounting", "hr", "area manager", "regional manager", "assistant vice president","vice president", "senior vice president", "president"]}><ProtectedLayout><Transportation /></ProtectedLayout></ProtectedRoute>}/>
      <Route path="/schedule-balances" element={ <ProtectedRoute allowedRoles={["admin", "accounting", "hr", "branch manager", "area manager", "regional manager", "assistant vice president", "vice president", "senior vice president", "president"]}><ProtectedLayout><ScheduleBalances /></ProtectedLayout></ProtectedRoute>}/>
      <Route path="/approval" element={ <ProtectedRoute allowedRoles={["admin", "accounting", "hr", "branch manager", "area manager", "regional manager", "assistant vice president", "vice president", "senior vice president", "president", "tread"]}><ProtectedLayout><Approval /></ProtectedLayout></ProtectedRoute>}/>
      <Route path="/branches" element={ <ProtectedRoute allowedRoles={["admin", "accounting", "hr", "branch manager", "area manager", "regional manager", "assistant vice president", "vice president", "senior vice president", "president", "tread"]}><ProtectedLayout><Branches /></ProtectedLayout></ProtectedRoute>}/>
      <Route path="/departments" element={ <ProtectedRoute allowedRoles={["admin", "accounting", "hr", "vice president", "senior vice president", "president", "tread"]}><ProtectedLayout><Departments /></ProtectedLayout></ProtectedRoute>}/>
      <Route path="/bonus/:branchId" element={ <ProtectedRoute allowedRoles={["admin", "branch manager", "accounting", "hr", "area manager", "regional manager", "assistant vice president", "vice president", "senior vice president", "president"]}><ProtectedLayout><Bonus /></ProtectedLayout></ProtectedRoute>}/>
      <Route path="/system-update" element={ <ProtectedRoute allowedRoles={["admin", "accounting", "hr", "vice president","senior vice president" ,"president"]}><ProtectedLayout><SystemUpdate /></ProtectedLayout></ProtectedRoute>}/>
      <Route path="/system-update/rates" element={ <ProtectedRoute allowedRoles={["admin", "accounting", "hr", "vice president", "senior vice president", "president"]}><ProtectedLayout><SystemRates /></ProtectedLayout></ProtectedRoute>}/>
      <Route path="/users" element={ <ProtectedRoute allowedRoles={["admin", "president"]}><ProtectedLayout><Users /></ProtectedLayout></ProtectedRoute>}/>
      <Route path="/transactions" element={ <ProtectedRoute allowedRoles={["admin", "accounting", "hr", "branch manager", "area manager", "regional manager", "assistant vice president", "vice president", "senior vice president", "president", "tread"]}><ProtectedLayout><Transactions /></ProtectedLayout></ProtectedRoute>}/>
      <Route path="/transactions/promotion" element={ <ProtectedRoute allowedRoles={["admin", "accounting", "hr", "regional manager", "assistant vice president", "vice president", "senior vice president", "president","tread"]}><ProtectedLayout><PromotionOrder /></ProtectedLayout></ProtectedRoute>}/>
      <Route path="/transactions/transfer" element={ <ProtectedRoute allowedRoles={["admin", "accounting", "hr", "area manager", "regional manager", "assistant vice president", "vice president", "senior vice president", "president", "tread"]}><ProtectedLayout><TransferStaffOrder /></ProtectedLayout></ProtectedRoute>}/>
      <Route path="/transactions/demotion" element={ <ProtectedRoute allowedRoles={["admin", "accounting", "hr", "area manager", "regional manager", "assistant vice president", "vice president", "senior vice president", "president", "tread"]}><ProtectedLayout><DemotionOrder /></ProtectedLayout></ProtectedRoute>}/>
      <Route path="/transactions/suspension" element={ <ProtectedRoute allowedRoles={["admin", "accounting", "hr", "area manager", "regional manager", "assistant vice president", "vice president", "senior vice president", "president", "tread"]}><ProtectedLayout><SuspensionOrder /></ProtectedLayout></ProtectedRoute>}/>
      <Route path="/transactions/exit" element={ <ProtectedRoute allowedRoles={["admin", "accounting", "hr", "vice president", "senior vice president", "president", "tread"]}><ProtectedLayout><ExitStaffOrders /></ProtectedLayout></ProtectedRoute>}/>
      <Route path="/transactions/leave" element={ <ProtectedRoute allowedRoles={["admin", "accounting", "hr", "branch manager", "area manager", "regional manager", "assistant vice president", "vice president", "senior vice president", "president", "tread"]}><ProtectedLayout><LeaveTransactions /></ProtectedLayout></ProtectedRoute>}/>
      <Route path="/transactions/soa" element={ <ProtectedRoute allowedRoles={["admin", "accounting", "hr", "vice president", "senior vice president", "president"]}><ProtectedLayout><Soa /></ProtectedLayout></ProtectedRoute>}/>
      <Route path="/transactions/deployment" element={ <ProtectedRoute allowedRoles={["admin", "accounting", "hr", "branch manager", "area manager", "regional manager", "assistant vice president", "vice president", "senior vice president", "president"]}><ProtectedLayout><Deployment /></ProtectedLayout></ProtectedRoute>}/>
      <Route path="/exit-staff" element={ <ProtectedRoute allowedRoles={["admin", "accounting", "hr", "vice president", "senior vice president", "president", "tread"]}><ProtectedLayout><ExitStaff /></ProtectedLayout></ProtectedRoute>}/>
      <Route path="/exit-staff-orders" element={ <ProtectedRoute allowedRoles={["admin", "accounting", "hr", "vice president", "senior vice president", "president", "tread"]}><ProtectedLayout><ExitStaffOrders /></ProtectedLayout></ProtectedRoute>}/>
      <Route path="/transactions/sbf" element={ <ProtectedRoute allowedRoles={["admin", "accounting", "hr", "vice president", "senior vice president", "president"]}><ProtectedLayout><SbfOrder /></ProtectedLayout></ProtectedRoute>}/>
      <Route path="/transactions/regularization" element={<ProtectedRoute allowedRoles={["admin", "hr", "accounting", "vice president", "senior vice president", "president"]}><ProtectedLayout><RegularizationOrders /></ProtectedLayout></ProtectedRoute>} />
      <Route path="/reports" element={ <ProtectedRoute allowedRoles={["admin", "accounting", "hr", "vice president", "senior vice president", "president", "tread"]}><ProtectedLayout><Reports /></ProtectedLayout></ProtectedRoute>}/>
      <Route path="/system-update/area-configurations" element={ <ProtectedRoute allowedRoles={["admin", "accounting", "hr", "vice president", "senior vice president","president"]}><ProtectedLayout><AreaConfigurations /></ProtectedLayout></ProtectedRoute>}/>
      <Route path="/system-update/consolidation" element={ <ProtectedRoute allowedRoles={["admin", "accounting", "hr", "vice president", "senior vice president", "president"]}><ProtectedLayout><Consolidation /></ProtectedLayout></ProtectedRoute>}/>
      <Route path="/system-update/tax-calculator" element={ <ProtectedRoute allowedRoles={["admin", "accounting", "hr", "president"]}><ProtectedLayout><TaxCalculator /></ProtectedLayout></ProtectedRoute>}/>
      <Route path="/logistic"element={<ProtectedRoute allowedRoles={["admin", "accounting", "hr", "area manager", "regional manager", "assitant vice president", "vice president", "senior vice president", "president", "tread"]}><ProtectedLayout><Logistic /></ProtectedLayout></ProtectedRoute>}/>
      <Route path="/system-update/details-compensation" element={<ProtectedRoute allowedRoles={["admin", "accounting", "hr","vice president", "senior vice president", "president"]}><ProtectedLayout><DetailsCompensation /></ProtectedLayout></ProtectedRoute>}/>
      <Route path="/opening-loan-balances" element={ <ProtectedRoute allowedRoles={["admin", "hr", "accounting", "branch manager", "area manager", "regional manager", "assistant vice president", "vice president", "president", "tread"]}><ProtectedLayout><OpeningLoanBalances /></ProtectedLayout></ProtectedRoute>}/>
      <Route path="/transactions/resignation" element={ <ProtectedRoute allowedRoles={["admin", "hr", "accounting", "branch manager", "area manager", "regional manager", "assistant vice president", "vice president", "president", "tread"]}><ProtectedLayout><ResignationRequests /></ProtectedLayout></ProtectedRoute>}/>
      <Route path="*" element={<Navigate to={homeRedirect()} replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <Router>
      <AppShell />
    </Router>
  );
}