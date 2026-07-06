import { NavLink, useLocation } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";

import { MdDashboard } from "react-icons/md";
import { FaExchangeAlt, FaBuilding } from "react-icons/fa";
import { BsCash } from "react-icons/bs";
import { HiOutlineClipboardList } from "react-icons/hi";
import { AiOutlineCheckCircle } from "react-icons/ai";
import { TbGitBranch } from "react-icons/tb";
import { FiSettings } from "react-icons/fi";
import { FaUserGroup, FaIdBadge } from "react-icons/fa6";
import { RxExit } from "react-icons/rx";
import { LuFiles } from "react-icons/lu";
import { BiPackage } from "react-icons/bi";
import { FaCalendarAlt } from "react-icons/fa";
import { PiHandCoinsBold } from "react-icons/pi";
import { SiOpenaccess } from "react-icons/si";

import amber from "../assets/amber.jpg";
import api from "../api/axiosClient";
import "../styles/Sidebar.css";

const readUser = () => {
  try {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const norm = (v) => String(v ?? "").trim().toLowerCase();

const getDepartment = (user) =>
  String(
    user?.department ||
      user?.department_name ||
      user?.user_department ||
      user?.departmentName ||
      user?.dept ||
      ""
  ).trim();

const countPending = (rows) =>
  (Array.isArray(rows) ? rows : []).filter(
    (x) => norm(x?.status) === "pending"
  ).length;

const Sidebar = ({ collapsed }) => {
  const { pathname } = useLocation();

  const user = readUser();
  const role = norm(user?.role);
  const userDepartment = getDepartment(user) || "No Department";

  const ROLE_GROUP = [
    "branch manager",
    "area manager",
    "regional manager",
    "assistant vice president",
    "vice president",
    "senior vice president",
  ];

  const dept = norm(userDepartment);

  const isRoleGroup = ROLE_GROUP.includes(role);

  const isBackOfficeFullDept =
    dept.includes("hr") ||
    dept.includes("audit") ||
    dept.includes("accounting") ||
    dept.includes("tread") ||
    dept.includes("office of the president");

  const isITDept =
    dept === "it department" ||
    dept === "it";

  const isProductionLogisticDept =
    dept.includes("production") && dept.includes("logistic");

  const isOperationDept = dept.includes("operation");

  const allowedSidebar = () => {
    if (!isRoleGroup) return null;

    if (isITDept) {
      return [
        "/dashboard",
        "/departments",
        "/staff-information",
        "/schedule-balances",
        "/opening-loan-balances",
        "/transactions",
        "/approval",
        "/branches",
        "/salary",
        "/reports",
        "/exit-staff",
        "/system-update",
        "/permissions",
        "/users",
      ];
    }

    if (isBackOfficeFullDept) {
      return [
        "/dashboard",
        "/departments",
        "/staff-information",
        "/schedule-balances",
        "/opening-loan-balances",
        "/transactions",
        "/approval",
        "/branches",
        "/salary",
        "/reports",
        "/exit-staff",
        "/system-update",
      ];
    }

    if (isProductionLogisticDept) {
      return [
        "/dashboard",
        "/departments",
        "/staff-information",
        "/schedule-balances",
        "/transactions",
        "/approval",
      ];
    }

    if (isOperationDept) {
      if (role === "branch manager") {
        return [
          "/dashboard",
          "/staff-information",
          "/schedule-balances",
          "/transactions",
          "/approval",
          "/branches",
        ];
      }

      if (role === "area manager" || role === "regional manager") {
        return [
          "/dashboard",
          "/staff-information",
          "/schedule-balances",
          "/transactions",
          "/approval",
          "/branches",
          "/reports",
        ];
      }

      if (role === "assistant vice president") {
        return [
          "/dashboard",
          "/departments",
          "/staff-information",
          "/schedule-balances",
          "/transactions",
          "/approval",
          "/branches",
          "/reports",
        ];
      }

      if (role === "vice president") {
        return [
          "/dashboard",
          "/departments",
          "/staff-information",
          "/schedule-balances",
          "/opening-loan-balances",
          "/transactions",
          "/approval",
          "/branches",
          "/salary",
          "/reports",
        ];
      }

      if (role === "senior vice president") {
        return [
          "/dashboard",
          "/departments",
          "/staff-information",
          "/schedule-balances",
          "/opening-loan-balances",
          "/transactions",
          "/approval",
          "/branches",
          "/salary",
          "/reports",
          "/exit-staff",
          "/system-update",
        ];
      }
    }

    return null;
  };

  const [reportPending, setReportPending] = useState(0);
  const [financePending, setFinancePending] = useState(0);
  const [hrPending, setHrPending] = useState(0);
  const [openMenus, setOpenMenus] = useState({});
  const [permissionMap, setPermissionMap] = useState({});
  const [isSuperUser, setIsSuperUser] = useState(false);

  const can = (moduleName, actionName = "view") => {
    if (isSuperUser) return true;
    return Boolean(permissionMap?.[moduleName]?.[actionName]);
  };

  useEffect(() => {
    const loadPermissions = async () => {
      try {
        const res = await api.get("/me/permissions");
        setPermissionMap(res.data?.permissions || {});
        setIsSuperUser(Boolean(res.data?.is_super_user));
      } catch {
        setPermissionMap({});
        setIsSuperUser(false);
      }
    };

    loadPermissions();

    const onAuthChanged = () => loadPermissions();
    window.addEventListener("auth-changed", onAuthChanged);
    window.addEventListener("storage", onAuthChanged);

    return () => {
      window.removeEventListener("auth-changed", onAuthChanged);
      window.removeEventListener("storage", onAuthChanged);
    };
  }, []);

  useEffect(() => {
    const loadPending = async () => {
      try {
        const leaveReq = can("leave_request", "view")
          ? api.get("/leave-requests").catch(() => ({ data: [] }))
          : Promise.resolve({ data: [] });

        const loanReq = can("loan_request", "view")
          ? api.get("/loan-requests").catch(() => ({ data: [] }))
          : Promise.resolve({ data: [] });

        const sbfReq = can("sbf_order", "view")
          ? api.get("/sbf-orders").catch(() => ({ data: [] }))
          : Promise.resolve({ data: [] });

        const [leaveRes, loanRes, sbfRes] = await Promise.all([
          leaveReq,
          loanReq,
          sbfReq,
        ]);

        const total =
          countPending(leaveRes.data) +
          countPending(loanRes.data) +
          countPending(sbfRes.data);
        
        const financeTotal =
          countPending(loanRes.data) +
          countPending(sbfRes.data);

        const hrTotal = countPending(leaveRes.data);

        setFinancePending(financeTotal);
        setHrPending(hrTotal);

        setReportPending(total);
      } catch {
        setReportPending(0);
      }
    };

    loadPending();

    const timer = setInterval(loadPending, 15000);
    return () => clearInterval(timer);
  }, [permissionMap, isSuperUser]);

  const navItems = useMemo(() => {
    const items = [
      {
        to: "/dashboard",
        label: "Dashboard",
        icon: MdDashboard,
        module: "dashboard",
      },
      {
        to: "/departments",
        label: "Department",
        icon: FaBuilding,
        module: "department",
      },
      {
        to: "/staff-information",
        label: "Staff Information",
        icon: FaIdBadge,
        module: "staff",
      },
      {
        to: "/schedule-balances",
        label: "Schedule of Balances",
        icon: HiOutlineClipboardList,
        module: "schedule_balance",
      },
      {
        to: "/opening-loan-balances",
        label: "Opening Loan Balances",
        icon: PiHandCoinsBold,
        module: "staff_loan_opening_balance",
      },
      {
        to: "/transactions",
        label: "HRIS Transactions",
        icon: FaExchangeAlt,
        module: "hris_transactions",
      },
      {
        to: "/approval",
        label: "Finance Approval",
        icon: AiOutlineCheckCircle,
        anyModule: ["loan_request", "cbu_withdrawal", "reimbursement_request"],
      },
      {
        to: "/transactions/travel-plan",
        label: "Calendar",
        icon: FaCalendarAlt,
        module: "travel_plan",
      },
      {
        to: "/branches",
        label: "Branch Payroll",
        icon: TbGitBranch,
        module: "branch",
      },
      {
        to: "/logistic",
        label: "Logistic",
        icon: BiPackage,
        module: "logistic",
      },
      {
        to: "/salary",
        label: "Payslip",
        icon: BsCash,
        module: "payslip",
      },
      {
        label: "Requests",
        icon: LuFiles,
        module: "report",
        badge: reportPending > 0 ? reportPending : null,
        children: [
          {
            to: "/reports?filter=finance",
            label: "Finance Pending",
            badge: financePending > 0 ? financePending : null,
          },
          {
            to: "/reports?filter=hr",
            label: "HR Pending",
            badge: hrPending > 0 ? hrPending : null,
          },
        ],
      },
      {
        to: "/exit-staff",
        label: "Exit Staff",
        icon: RxExit,
        anyModule: ["exit_staff_order", "resignation_request"],
      },
      {
        to: "/system-update",
        label: "System Update",
        icon: FiSettings,
        module: "system_update",
      },
      {
        to: "/permissions",
        label: "Permissions",
        icon: SiOpenaccess,
        module: "permissions",
      },
      {
        to: "/users",
        label: "Users",
        icon: FaUserGroup,
        module: "users",
      },
    ];

    return items.filter((item) => {
      if (item.to === "/users" || item.to === "/permissions") {
        return role === "admin" || isITDept;
      }

      const isUserOrPermissionPage =
        item.to === "/users" ||
        item.to === "/permissions";

      if (isUserOrPermissionPage) {
        const isAdmin = role === "admin";

        if (!(isAdmin || isITDept)) {
          return false;
        }
      }

      if (item.to === "/transactions/travel-plan") {
        if (isSuperUser) return true;

        return (
          can("travel_plan", "view") &&
          dept.includes("operation") &&
          [
            "area manager",
            "regional manager",
            "assistant vice president",
            "vice president",
            "senior vice president",
          ].includes(role)
        );
      }

      if (isSuperUser) return true;

      const allowed = allowedSidebar();

      if (allowed) {
        return allowed.includes(item.to);
      }

      if (item.anyModule) {
        return item.anyModule.some((m) => can(m, "view"));
      }

      return can(item.module, "view");
    });
  }, [permissionMap, isSuperUser, reportPending, role, userDepartment]);

  const isPathActive = (basePath) => {
    if (basePath === "/transactions") {
      return pathname === "/transactions";
    }

    return pathname === basePath || pathname.startsWith(basePath + "/");
  };

  return (
    <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      <div className="sidebar-brand">
        <img src={amber} alt="logo" className="logo-img" />

        {!collapsed && (
          <div className="brand-text">
            <div className="brand-title">AmberCash PH</div>
            <div className="brand-subtitle">{userDepartment}</div>

            {user?.role && (
              <div className="brand-role">Role: {String(user.role)}</div>
            )}
          </div>
        )}
      </div>

      {!collapsed && <div className="sidebar-section-title">MAIN</div>}

      {navItems.map((item) => {
        const Icon = item.icon;

        if (item.children) {
          const isActiveParent = pathname.startsWith("/reports");
          const isOpen = Boolean(openMenus[item.label]);  

          return (
            <div key={item.label} className="sidebar-dropdown">
              <button
                type="button"
                className={`sidebar-link sidebar-dropdown-toggle ${
                  isActiveParent ? "active" : ""
                }`}
                onClick={() =>
                  setOpenMenus((prev) => ({
                    ...prev,
                    [item.label]: !prev[item.label],
                  }))
                }
              >
                <span className="sidebar-icon">
                  <Icon />
                </span>

                {!collapsed && (
                  <span className="sidebar-label-wrap">
                    <span className="sidebar-label">{item.label}</span>

                    <span className={`sidebar-arrow ${isOpen ? "open" : ""}`}>
                      ▾
                    </span>

                    {item.badge ? (
                      <span className="sidebar-badge">
                        {item.badge > 99 ? "99+" : item.badge}
                      </span>
                    ) : null}
                  </span>
                )}
              </button>

              {!collapsed && isOpen && (
                <div className="sidebar-submenu">
                  {item.children.map((child) => (
                    <NavLink
                      key={child.to}
                      to={child.to}
                      className="sidebar-sub-link"
                    >
                      <span>{child.label}</span>

                        {child.badge ? (
                          <span className="sidebar-sub-badge">
                            {child.badge > 99 ? "99+" : child.badge}
                          </span>
                        ) : null}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          );
        }

        const forcedActive = isPathActive(item.to);

        return (
          <NavLink
            key={item.to}
            to={item.to}
            className={() =>
              `sidebar-link ${forcedActive ? "active" : ""}`
            }
            title={collapsed ? item.label : undefined}
          >
            <span className="sidebar-icon">
              <Icon />
            </span>

            {!collapsed && (
              <span className="sidebar-label-wrap">
                <span className="sidebar-label">{item.label}</span>

                {item.badge ? (
                  <span className="sidebar-badge">
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                ) : null}
              </span>
            )}
          </NavLink>
        );
      })}
    </aside>
  );
};

export default Sidebar;