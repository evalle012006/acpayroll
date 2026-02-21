import React, { useState } from "react"; // ✅ import useState
import { Link } from "react-router-dom";
import { FaUsers, FaMoneyBill } from "react-icons/fa";
import { MdDashboard } from "react-icons/md";
import { TbGitBranch } from "react-icons/tb";
import { AiOutlineCheckCircle } from "react-icons/ai";
import { BsCash } from "react-icons/bs";
import { FiSettings } from "react-icons/fi";
import { HiOutlineClipboardList } from "react-icons/hi";
import { FaUserGroup } from "react-icons/fa6";

import amber from "../assets/amber.jpg";
import "../styles/Sidebar.css";

const Sidebar = ({ collapsed }) => {

  return (
    <div className={`sidebar ${collapsed ? "collapsed" : ""}`}>

      {/* Logo Section */}
      <div className="logo-container">
        <img src={amber} alt="logo" className="logo-img"/>
        {!collapsed && <span className="logo-text"></span>}
      </div>

      <ul>
        <li>
          <Link to="/">
            <MdDashboard className="icon" />
            {!collapsed && <span>Dashboard</span>}
          </Link>
        </li>

        <li>
          <Link to="/staff">
            <FaUsers className="icon" />
            {!collapsed && <span>Staff</span>}
          </Link>
        </li>

        <li>
          <Link to="/salary">
            <BsCash className="icon" />
            {!collapsed && <span>Salary</span>}
          </Link>
        </li>

        <li>
          <Link to="/schedule-balances">
            <HiOutlineClipboardList className="icon" />
            {!collapsed && <span>Schedule of Balances</span>}
          </Link>
        </li>

        <li>
          <Link to="/approval">
            <AiOutlineCheckCircle className="icon" />
            {!collapsed && <span>Approval</span>}
          </Link>
        </li>

        <li>
          <Link to="/branches">
            <TbGitBranch className="icon" />
            {!collapsed && <span>Branches</span>}
          </Link>
        </li>
        <li>
          <Link to="/system-update">
            <FiSettings className="icon" />
            {!collapsed && <span>System Update</span>}
          </Link>
        </li>
        <li>
          <Link to="/Users">
            <FaUserGroup className="icon" />
            {!collapsed && <span>Users</span>}
          </Link>
        </li>
      </ul>
    </div>
  );
};

export default Sidebar;
