import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, } from "react-router-dom";
import { createContext, useContext, useEffect, useMemo, useState, } from "react";
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
import PagIbigRemittances from "./pages/PagIbigRemittances";
import RegularizationOrders from "./pages/RegularizationOrders";
import ResignationRequests from "./pages/ResignationRequests";
import StaffAccountsPayable from "./pages/StaffAccountsPayable";
import OtherReceivable from "./pages/OtherReceivable";
import BoardResolutionRequests from "./pages/BoardResolutionRequests";
import TravelPlan from "./pages/Calendar";
import Permissions from "./pages/Permissions";
import StaffReport from "./pages/StaffReport";
import NoticeToExplain from "./pages/NoticeToExplain";
import TerminationOfContract from "./pages/TerminationOfContract";
import Chat from "./pages/Chat";
import ChangePassword from "./pages/ChangePassword";

import TravelPlanPage from "./pages/travel/TravelPlanPage";
import ForecastPage from "./pages/travel/ForecastPage";
import ComplyPage from "./pages/travel/ComplyPage";
import CalendarPage from "./pages/travel/CalendarPage";
import CalendarSummaryReport from "./pages/travel/CalendarSummaryReport";

import api from "./api/axiosClient";

const PermissionContext = createContext(null);

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

const norm = (v) => String(v ?? "").trim().toLowerCase();

const getUserDepartment = (user) =>
  norm(
    user?.department ||
      user?.department_name ||
      user?.user_department ||
      user?.departmentName ||
      user?.dept
  );

const isAdminOrITDepartment = () => {
  const user = readUser();
  const role = norm(user?.role);
  const department = getUserDepartment(user);

  return role === "admin" || department.includes("it");
};

const usePermissions = () => {
  const ctx = useContext(PermissionContext);

  if (!ctx) {
    return {
      loading: false,
      isSuperUser: false,
      permissions: {},
      can: () => false,
      canAny: () => false,
      refreshPermissions: () => {},
    };
  }

  return ctx;
};

function PermissionProvider({ children }) {
  const [permissions, setPermissions] = useState({});
  const [isSuperUser, setIsSuperUser] = useState(false);
  const [loading, setLoading] = useState(true);

  const refreshPermissions = async () => {
    if (!hasAuth()) {
      setPermissions({});
      setIsSuperUser(false);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const res = await api.get("/me/permissions");

      setPermissions(res.data?.permissions || {});
      setIsSuperUser(Boolean(res.data?.is_super_user));
    } catch {
      setPermissions({});
      setIsSuperUser(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshPermissions();

    const onAuthChanged = () => refreshPermissions();

    window.addEventListener("auth-changed", onAuthChanged);
    window.addEventListener("storage", onAuthChanged);

    return () => {
      window.removeEventListener("auth-changed", onAuthChanged);
      window.removeEventListener("storage", onAuthChanged);
    };
  }, []);

  const can = (moduleName, actionName = "view") => {
    if (isSuperUser) return true;
    return Boolean(permissions?.[moduleName]?.[actionName]);
  };

  const canAny = (modules = [], actionName = "view") => {
    if (isSuperUser) return true;
    return modules.some((m) => can(m, actionName));
  };

  return (
    <PermissionContext.Provider
      value={{
        loading,
        permissions,
        isSuperUser,
        can,
        canAny,
        refreshPermissions,
      }}
    >
      {children}
    </PermissionContext.Provider>
  );
}

const fallbackPath = () => {
  if (!hasAuth()) return "/login";
  return "/staff-information";
};

const PasswordResetGuard = ({ children }) => {
  const user = readUser();

  if (!hasAuth()) {
    return <Navigate to="/login" replace />;
  }

  if (
    user?.must_reset_password === true &&
    window.location.pathname !==
      "/change-password"
  ) {
    return (
      <Navigate
        to="/change-password"
        replace
      />
    );
  }

  return children;
};

const ProtectedRoute = ({ module, anyModule, action = "view", children }) => {
  const { loading, can, canAny } = usePermissions();

  if (!hasAuth()) return <Navigate to="/login" replace />;

  if (loading) return null;

  if (anyModule?.length) {
    if (!canAny(anyModule, action)) {
      return <Navigate to={fallbackPath()} replace />;
    }
  } else if (module) {
    if (!can(module, action)) {
      return <Navigate to={fallbackPath()} replace />;
    }
  }

  return (
    <PasswordResetGuard>
      {children}
    </PasswordResetGuard>
  );
};

const AdminITOnly = ({ children }) => {
  if (!hasAuth()) return <Navigate to="/login" replace />;

  if (!isAdminOrITDepartment()) {
    return <Navigate to="/staff-information" replace />;
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

const Page = ({ module, anyModule, children }) => (
  <ProtectedRoute module={module} anyModule={anyModule}>
    <ProtectedLayout>{children}</ProtectedLayout>
  </ProtectedRoute>
);

function AppShell() {
  const [authTick, setAuthTick] = useState(0);
  const navigate = useNavigate();
  const { loading, can, canAny } = usePermissions();

  useMemo(() => readUser(), [authTick]);

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
    if (loading) return "/staff-information";

    if (can("dashboard", "view")) return "/dashboard";
    if (can("staff", "view")) return "/staff-information";
    if (can("schedule_balance", "view")) return "/schedule-balances";

    if (canAny(["loan_request", "cbu_withdrawal", "reimbursement_request"])) {
      return "/approval";
    }

    return "/staff-information";
  };

  return (
    <Routes>
      <Route path="/" element={<Navigate to={homeRedirect()} replace />} />

      <Route
        path="/login"
        element={
          hasAuth() ? <Navigate to={homeRedirect()} replace /> : <Login />
        }
      />

      <Route
        path="/dashboard"
        element={
          <Page module="dashboard">
            <Dashboard />
          </Page>
        }
      />

      <Route
        path="/staff-information"
        element={
          <Page module="staff">
            <StaffInformation />
          </Page>
        }
      />

      <Route
        path="/staff"
        element={
          <Page module="staff">
            <Staff />
          </Page>
        }
      />

      <Route
        path="/salary"
        element={
          <Page module="payslip">
            <Salary />
          </Page>
        }
      />

      <Route
        path="/payroll"
        element={
          <Page module="branch">
            <Payroll />
          </Page>
        }
      />

      <Route
        path="/payroll/:branchId"
        element={
          <Page module="branch">
            <Payroll />
          </Page>
        }
      />

      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <ProtectedLayout>
              <Profile />
            </ProtectedLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <ProtectedLayout>
              <Settings />
            </ProtectedLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/transportation/:id"
        element={
          <Page module="transportation_history">
            <Transportation />
          </Page>
        }
      />

      <Route
        path="/schedule-balances"
        element={
          <Page module="schedule_balance">
            <ScheduleBalances />
          </Page>
        }
      />

      <Route
        path="/approval"
        element={
          <Page
            anyModule={[
              "loan_request",
              "cbu_withdrawal",
              "reimbursement_request",
            ]}
          >
            <Approval />
          </Page>
        }
      />

      <Route
        path="/branches"
        element={
          <Page module="branch">
            <Branches />
          </Page>
        }
      />

      <Route
        path="/departments"
        element={
          <Page module="department">
            <Departments />
          </Page>
        }
      />

      <Route
        path="/bonus/:branchId"
        element={
          <Page module="bonus">
            <Bonus />
          </Page>
        }
      />

      <Route
        path="/system-update"
        element={
          <Page module="system_update">
            <SystemUpdate />
          </Page>
        }
      />

      <Route
        path="/system-update/rates"
        element={
          <Page module="comp_rate">
            <SystemRates />
          </Page>
        }
      />

      <Route
        path="/system-update/area-configurations"
        element={
          <Page module="area_configuration">
            <AreaConfigurations />
          </Page>
        }
      />

      <Route
        path="/system-update/consolidation"
        element={
          <Page module="consolidation">
            <Consolidation />
          </Page>
        }
      />

      <Route
        path="/system-update/tax-calculator"
        element={
          <Page module="system_update">
            <TaxCalculator />
          </Page>
        }
      />

      <Route
        path="/system-update/pag-ibig-remittances"
        element={
          <Page module="system_update">
            <PagIbigRemittances />
          </Page>
        }
      />

      <Route
        path="/system-update/details-compensation"
        element={
          <Page module="comp_rate">
            <DetailsCompensation />
          </Page>
        }
      />

      <Route
        path="/users"
        element={
          <AdminITOnly>
            <ProtectedLayout>
              <Users />
            </ProtectedLayout>
          </AdminITOnly>
        }
      />

      <Route
        path="/permissions"
        element={
          <AdminITOnly>
            <ProtectedLayout>
              <Permissions />
            </ProtectedLayout>
          </AdminITOnly>
        }
      />

      <Route
        path="/transactions"
        element={
          <Page module="hris_transactions">
            <Transactions />
          </Page>
        }
      />

      <Route
        path="/transactions/travel-plan"
        element={
          <Page module="travel_plan">
            <TravelPlanPage />
          </Page>
        }
      />

      <Route
        path="/transactions/travel-plan/forecast"
        element={
          <Page module="travel_plan">
            <ForecastPage />
          </Page>
        }
      />

      <Route
        path="/transactions/travel-plan/comply"
        element={
          <Page module="travel_plan">
            <ComplyPage />
          </Page>
        }
      />

      <Route
        path="/transactions/travel-plan/summary-report"
        element={
          <Page module="travel_plan">
            <CalendarSummaryReport />
          </Page>
        }
      />

      <Route
        path="/transactions/travel-plan/calendar"
        element={
          <Page module="travel_plan">
            <CalendarPage />
          </Page>
        }
      />

      <Route
        path="/transactions/promotion"
        element={
          <Page module="promotion_order">
            <PromotionOrder />
          </Page>
        }
      />

      <Route
        path="/transactions/transfer"
        element={
          <Page module="transfer_staff_order">
            <TransferStaffOrder />
          </Page>
        }
      />

      <Route
        path="/transactions/demotion"
        element={
          <Page module="demotion_order">
            <DemotionOrder />
          </Page>
        }
      />

      <Route
        path="/transactions/suspension"
        element={
          <Page module="suspension_order">
            <SuspensionOrder />
          </Page>
        }
      />

      <Route
        path="/transactions/exit"
        element={
          <Page module="exit_staff_order">
            <ExitStaffOrders />
          </Page>
        }
      />

      <Route
        path="/transactions/leave"
        element={
          <Page module="leave_request">
            <LeaveTransactions />
          </Page>
        }
      />

      <Route
        path="/transactions/soa"
        element={
          <Page module="statement_of_account">
            <Soa />
          </Page>
        }
      />

      <Route
        path="/transactions/deployment"
        element={
          <Page module="deployment_order">
            <Deployment />
          </Page>
        }
      />

      <Route
        path="/transactions/sbf"
        element={
          <Page module="sbf_order">
            <SbfOrder />
          </Page>
        }
      />

      <Route
        path="/transactions/regularization"
        element={
          <Page module="regularization_order">
            <RegularizationOrders />
          </Page>
        }
      />

      <Route
        path="/transactions/resignation"
        element={
          <Page module="resignation_request">
            <ResignationRequests />
          </Page>
        }
      />

      <Route
        path="/transactions/other-receivable"
        element={
          <Page module="other_receivable">
            <OtherReceivable />
          </Page>
        }
      />

      <Route
        path="/transactions/staff-accounts-payable"
        element={
          <Page module="staff_accounts_payable">
            <StaffAccountsPayable />
          </Page>
        }
      />

      <Route
        path="/transactions/board-resolution"
        element={
          <Page module="board_resolution">
            <BoardResolutionRequests />
          </Page>
        }
      />

      <Route
        path="/transactions/staff-report"
        element={
          <Page module="staff_report">
            <StaffReport />
          </Page>
        }
      />

      <Route
        path="/transactions/notice-to-explain"
        element={
          <Page module="staff_report">
            <NoticeToExplain />
          </Page>
        }
      />

      <Route
        path="/transactions/termination-of-contract"
        element={
          <Page module="staff_report">
            <TerminationOfContract />
          </Page>
        }
      />

      <Route
        path="/exit-staff"
        element={
          <Page module="exit_staff_order">
            <ExitStaff />
          </Page>
        }
      />

      <Route
        path="/exit-staff-orders"
        element={
          <Page module="exit_staff_order">
            <ExitStaffOrders />
          </Page>
        }
      />

      <Route
        path="/reports"
        element={
          <Page module="report">
            <Reports />
          </Page>
        }
      />

      <Route
        path="/logistic"
        element={
          <Page module="logistic_package">
            <Logistic />
          </Page>
        }
      />

      <Route
        path="/chat"
        element={
          <ProtectedRoute>
            <ProtectedLayout>
              <Chat />
            </ProtectedLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/change-password"
        element={
          hasAuth() ? (
            <ChangePassword />
          ) : (
            <Navigate
              to="/login"
              replace
            />
          )
        }
      />

      <Route path="*" element={<Navigate to={homeRedirect()} replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <Router>
      <PermissionProvider>
        <AppShell />
      </PermissionProvider>
    </Router>
  );
}