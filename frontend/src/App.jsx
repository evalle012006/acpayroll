import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

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

import "./styles/layout.css";

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
    if (!allowed.includes(uRole)) return <Navigate to="/dashboard" replace />;
  }

  return children;
};

function AppShell() {
  const [collapsed, setCollapsed] = useState(false);
  const [authTick, setAuthTick] = useState(0);
  const navigate = useNavigate();

  const isLoggedIn = hasAuth();

  useEffect(() => {
    const onAuthChanged = () => {
      setAuthTick((t) => t + 1);

      if (!hasAuth()) navigate("/login", { replace: true });
    };

    window.addEventListener("auth-changed", onAuthChanged);
    window.addEventListener("storage", onAuthChanged);

    return () => {
      window.removeEventListener("auth-changed", onAuthChanged);
      window.removeEventListener("storage", onAuthChanged);
    };
  }, [navigate]);

  const _ = authTick;

  return (
    <div className={`layout ${collapsed ? "collapsed" : ""}`}>
      {isLoggedIn && <Sidebar collapsed={collapsed} />}

      <div className="main-content">
        {isLoggedIn && <Header toggleSidebar={() => setCollapsed((p) => !p)} />}

        <div className="page-content">
          <Routes>
            <Route path="/" element={<Navigate to={hasAuth() ? "/dashboard" : "/login"} replace />} />
            <Route path="/login" element={hasAuth() ? <Navigate to="/dashboard" replace /> : <Login />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>}/>
            <Route path="/staff" element={<ProtectedRoute><Staff /></ProtectedRoute>}/>
            <Route path="/staff-information" element={<ProtectedRoute allowedRoles={["admin", "branch manager"]}><StaffInformation /></ProtectedRoute>}/>
            <Route path="/departments" element={<ProtectedRoute allowedRoles={["admin", "branch manager"]}><Departments /></ProtectedRoute>}/>
            <Route path="/salary" element={<ProtectedRoute><Salary /></ProtectedRoute>}/>
            <Route path="/schedule-balances" element={<ProtectedRoute><ScheduleBalances /></ProtectedRoute>}/>
            <Route path="/approval" element={<ProtectedRoute><Approval /></ProtectedRoute>}/>
            <Route path="/branches" element={<ProtectedRoute><Branches /></ProtectedRoute>}/>
            <Route path="/system-update" element={<ProtectedRoute><SystemUpdate /></ProtectedRoute>}/>
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>}/>
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/transportation/:id" element={<ProtectedRoute><Transportation /></ProtectedRoute>}/>
            <Route path="/payroll" element={<ProtectedRoute><Payroll /></ProtectedRoute>}/>
            <Route path="/payroll/:branchId" element={<ProtectedRoute><Payroll /></ProtectedRoute>}/>
            <Route path="/transactions" element={<ProtectedRoute allowedRoles={["admin", "branch manager"]}><Transactions /></ProtectedRoute>}/>
            <Route path="/transactions/transfer" element={<ProtectedRoute allowedRoles={["admin", "branch manager"]}><TransferStaffOrder /></ProtectedRoute>}/>
            <Route path="/transactions/promotion" element={<ProtectedRoute allowedRoles={["admin", "branch manager"]}><PromotionOrder /></ProtectedRoute>}/>
            <Route path="/transactions/demotion" element={<ProtectedRoute allowedRoles={["admin", "branch manager"]}><DemotionOrder /></ProtectedRoute>}/>
            <Route path="/transactions/suspension" element={<ProtectedRoute allowedRoles={["admin", "branch manager"]}><SuspensionOrder /></ProtectedRoute>}/>
            <Route path="/bonus/:branchId" element={<Bonus />} />

            <Route path="/users" element={<ProtectedRoute allowedRoles={["admin"]}><Users /></ProtectedRoute>}/>

            <Route path="*" element={<Navigate to={hasAuth() ? "/dashboard" : "/login"} replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AppShell />
    </Router>
  );
}