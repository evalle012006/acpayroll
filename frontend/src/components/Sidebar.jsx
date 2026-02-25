import { NavLink, useLocation } from "react-router-dom";
import { useMemo } from "react";

import { MdDashboard } from "react-icons/md";
import { FaExchangeAlt, FaBuilding } from "react-icons/fa";
import { BsCash } from "react-icons/bs";
import { HiOutlineClipboardList } from "react-icons/hi";
import { AiOutlineCheckCircle } from "react-icons/ai";
import { TbGitBranch } from "react-icons/tb";
import { FiSettings } from "react-icons/fi";
import { FaUserGroup } from "react-icons/fa6";
import { FaUsers, FaIdBadge } from "react-icons/fa"; // ✅ FaIdBadge for Staff Information

import amber from "../assets/amber.jpg";
import "../styles/Sidebar.css";

const readUser = () => {
  try {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const Sidebar = ({ collapsed }) => {
  const { pathname } = useLocation();

  const user = readUser();
  const role = String(user?.role || "").trim().toLowerCase();

  const navItems = useMemo(() => {
    const items = [
      { to: "/dashboard", label: "Dashboard", icon: MdDashboard, roles: ["admin", "branch manager"] },

      // ✅ existing Staff page
      { to: "/staff", label: "Staff", icon: FaUsers, roles: ["admin", "branch manager"] },

      // ✅ new buttons
      { to: "/staff-information", label: "Staff Information", icon: FaIdBadge, roles: ["admin", "branch manager"] },
      { to: "/departments", label: "Department", icon: FaBuilding, roles: ["admin", "branch manager"] },

      { to: "/salary", label: "Salary", icon: BsCash, roles: ["admin", "branch manager"] },
      { to: "/schedule-balances", label: "Schedule of Balances", icon: HiOutlineClipboardList, roles: ["admin", "branch manager"] },
      { to: "/transactions", label: "HRIS Transactions", icon: FaExchangeAlt, roles: ["admin", "branch manager"] },
      { to: "/approval", label: "Approval", icon: AiOutlineCheckCircle, roles: ["admin", "branch manager"] },
      { to: "/branches", label: "Branch Payroll", icon: TbGitBranch, roles: ["admin", "branch manager"] },

      { to: "/system-update", label: "System Update", icon: FiSettings, roles: ["admin"] },
      { to: "/users", label: "Users", icon: FaUserGroup, roles: ["admin"] },
    ];

    return items.filter((x) => !x.roles || x.roles.includes(role));
  }, [role]);

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
              {!collapsed && <span className="sidebar-label">{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
};

export default Sidebar;