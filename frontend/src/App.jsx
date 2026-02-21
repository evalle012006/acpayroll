import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useState } from "react";

import Sidebar from "./components/Sidebar";
import Header from "./components/Header";

import Dashboard from "./pages/Dashboard";
import Staff from "./pages/Staff";
import Transportation from "./pages/Transportation";
import Payroll from "./pages/Payroll";
import Branches from "./pages/Branches";
import Salary from "./pages/Salary";
import ScheduleBalances from "./pages/ScheduleBalances";
import SystemUpdate from "./pages/SystemUpdate";
import LeaveApproval from "./pages/LeaveApproval";
import LoanApproval from "./pages/LoanApproval";
import Approval from "./pages/Approval";
import Login from "./pages/Login";
import Profile from "./pages/Profile";

import "./styles/layout.css";

function App() {
  const [collapsed, setCollapsed] = useState(false);

  const user = JSON.parse(localStorage.getItem("user"));

  return (
    <Router>
      <div className={`layout ${collapsed ? "collapsed" : ""}`}>
        {user && <Sidebar collapsed={collapsed} />}
        <div className="main-content">
          {user && <Header toggleSidebar={() => setCollapsed(!collapsed)} />}

          <div className="page-content">
            <Routes>
              {/* ✅ LOGIN (PUBLIC) */}
              <Route
                path="/login"
                element={!user ? <Login /> : <Navigate to="/dashboard" />}
              />

              {/* ✅ PROTECTED */}
              <Route path="/dashboard" element={user ? <Dashboard /> : <Navigate to="/login" />} />
              <Route path="/staff" element={user ? <Staff /> : <Navigate to="/login" />} />
              <Route path="/transportation/:id" element={user ? <Transportation /> : <Navigate to="/login" />} />
              <Route path="/payroll" element={user ? <Payroll /> : <Navigate to="/login" />} />
              <Route path="/payroll/:branchId" element={user ? <Payroll /> : <Navigate to="/login" />} />
              <Route path="/salary" element={user ? <Salary /> : <Navigate to="/login" />} />
              <Route path="/schedule-balances" element={user ? <ScheduleBalances /> : <Navigate to="/login" />} />
              <Route path="/branches" element={user ? <Branches /> : <Navigate to="/login" />} />
              <Route path="/leave-approval" element={user ? <LeaveApproval /> : <Navigate to="/login" />} />
              <Route path="/loan-approval" element={user ? <LoanApproval /> : <Navigate to="/login" />} />
              <Route path="/approval" element={user ? <Approval /> : <Navigate to="/login" />} />
              <Route path="/system-update" element={user ? <SystemUpdate /> : <Navigate to="/login" />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/settings" element={<div>Settings Page</div>} />
              {/* ✅ DEFAULT */}
              <Route path="*" element={<Navigate to={user ? "/dashboard" : "/login"} />} />
            </Routes>
          </div>
        </div>
      </div>
    </Router>
  );
}

export default App;
