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

const countPending = (rows) =>
  (Array.isArray(rows) ? rows : []).filter((x) => norm(x?.status) === "pending").length;

const Sidebar = ({ collapsed }) => {
  const { pathname } = useLocation();
  const user = readUser();
  const role = norm(user?.role);

  const [reportPending, setReportPending] = useState(0);

  useEffect(() => {
    const loadPending = async () => {
      try {
        const [leaveRes, loanRes, sbfRes] = await Promise.all([
          api.get("/leave-requests").catch(() => ({ data: [] })),
          api.get("/loan-requests").catch(() => ({ data: [] })),
          api.get("/sbf-orders").catch(() => ({ data: [] })),
        ]);

        const total =
          countPending(leaveRes.data) +
          countPending(loanRes.data) +
          countPending(sbfRes.data);

        setReportPending(total);
      } catch {
        setReportPending(0);
      }
    };

    loadPending();
    const timer = setInterval(loadPending, 15000);
    return () => clearInterval(timer);
  }, []);

  const navItems = useMemo(() => {
    const items = [
      {
        to: "/dashboard",
        label: "Dashboard",
        icon: MdDashboard,
        roles: ["admin", "hr", "accounting", "branch manager", "area manager", "regional manager", "assistant vice president", "vice president", "senior vice president", "president"],
      },
      {
        to: "/departments",
        label: "Department",
        icon: FaBuilding,
        roles: ["admin", "hr", "accounting", "vice president", "senior vice president", "president"],
      },
      {
        to: "/staff-information",
        label: "Staff Information",
        icon: FaIdBadge,
        roles: ["admin", "hr", "accounting", "branch manager", "area manager", "regional manager", "assistant vice president", "vice president", "senior vice president", "president"],
      },
      {
        to: "/schedule-balances",
        label: "Schedule of Balances",
        icon: HiOutlineClipboardList,
        roles: ["admin", "hr", "accounting", "branch manager", "area manager", "regional manager", "assistant vice president", "vice president", "senior vice president", "president"],
      },
      {
        to: "/transactions",
        label: "HRIS Transactions",
        icon: FaExchangeAlt,
        roles: ["admin", "hr", "accounting", "branch manager", "area manager", "regional manager", "assistant vice president", "vice president", "senior vice president", "president"],
      },
      {
        to: "/approval",
        label: "Finance Approval",
        icon: AiOutlineCheckCircle,
        roles: ["admin", "hr", "accounting", "area manager", "regional manager", "assistant vice president", "vice president", "senior vice president", "president"],
      },
      {
        to: "/branches",
        label: "Branch Payroll",
        icon: TbGitBranch,
        roles: ["admin", "hr", "accounting", "branch manager", "area manager", "regional manager", "assistant vice president", "vice president", "senior vice president", "president"],
      },
      {
        to: "/logistic",
        label: "Logistic",
        icon: BiPackage,
        roles: ["admin", "hr", "accounting", "area manager", "regional manager", "assistant vice president", "vice president", "senior vice president", "president"],
      },
      {
        to: "/salary",
        label: "Payslip",
        icon: BsCash,
        roles: ["admin", "hr", "accounting", "assistant vice president", "vice president", "senior vice president", "president"],
      },
      {
        to: "/reports",
        label: "Reports",
        icon: LuFiles,
        roles: ["admin", "hr", "accounting", "vice president", "senior vice president", "president"],
        badge: reportPending > 0 ? reportPending : null,
      },
      {
        to: "/exit-staff",
        label: "Exit Staff",
        icon: RxExit,
        roles: ["admin", "hr", "accounting", "vice president", "senior vice president", "president"],
      },
      {
        to: "/system-update",
        label: "System Update",
        icon: FiSettings,
        roles: ["admin", "hr", "accounting", "vice president", "senior vice president", "president"],
      },
      {
        to: "/users",
        label: "Users",
        icon: FaUserGroup,
        roles: ["admin", "president"],
      },
    ];

    return items.filter((x) => !x.roles || x.roles.includes(role));
  }, [role, reportPending]);

  const isPathActive = (basePath) =>
    pathname === basePath || pathname.startsWith(basePath + "/");

  return (
    <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      <div className="sidebar-brand">
        <img src={amber} alt="logo" className="logo-img" />
        {!collapsed && (
          <div className="brand-text">
            <div className="brand-title">AmberCash PH</div>
            <div className="brand-subtitle">Payroll System</div>
            {user?.role && <div className="brand-role">Role: {String(user.role)}</div>}
          </div>
        )}
      </div>

      {!collapsed && <div className="sidebar-section-title">MAIN</div>}

      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const Icon = item.icon;
          const forcedActive = isPathActive(item.to);

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={() => `sidebar-link ${forcedActive ? "active" : ""}`}
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
      </nav>
    </aside>
  );
};

export default Sidebar;