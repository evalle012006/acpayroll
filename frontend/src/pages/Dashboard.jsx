import React, { useEffect, useState } from "react";
import axios from "axios";
import "../styles/Dashboard.css";

function Dashboard() {
  const [stats, setStats] = useState({
    activeEmployees: 0,
    pendingLeaves: 0,
    approvedLeaves: 0,
    rejectedLeaves: 0,
    pendingLoans: 0,
    approvedLoans: 0,
    rejectedLoans: 0,
  });

  useEffect(() => {
    const user = localStorage.getItem("user");
    if (!user) {
      window.location.href = "/login";
      return;
    }

    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [staffRes, leaveRes, loanRes] = await Promise.all([
        axios.get("http://localhost:5000/staff"), // ✅ correct
        axios.get("http://localhost:5000/api/leave-requests"),
        axios.get("http://localhost:5000/api/loan-requests"),
      ]);

      const staffData = staffRes.data;
      const leaveData = leaveRes.data;
      const loanData = loanRes.data;

      setStats({
        // ✅ if you don't have staff.status column, just count all staff
        activeEmployees: staffData.length,

        pendingLeaves: leaveData.filter((l) => l.status === "Pending").length,
        approvedLeaves: leaveData.filter((l) => l.status === "Approved").length,
        rejectedLeaves: leaveData.filter((l) => l.status === "Rejected").length,

        pendingLoans: loanData.filter((l) => l.status === "Pending").length,
        approvedLoans: loanData.filter((l) => l.status === "Approved").length,
        rejectedLoans: loanData.filter((l) => l.status === "Rejected").length,
      });
    } catch (error) {
      console.error("Dashboard fetch error:", error);
    }
  };

  return (
    <div className="dashboard-container">
      <h1>Dashboard Overview</h1>

      <div className="dashboard-cards">
        <div className="card">
          <h3>{stats.activeEmployees}</h3>
          <p>Employees</p>
        </div>

        <div className="card">
          <h3>{stats.pendingLeaves}</h3>
          <p>Pending Leave Approvals</p>
        </div>

        <div className="card approved">
          <h3>{stats.approvedLeaves}</h3>
          <p>Approved Leaves</p>
        </div>

        <div className="card rejected">
          <h3>{stats.rejectedLeaves}</h3>
          <p>Rejected Leaves</p>
        </div>

        <div className="card">
          <h3>{stats.pendingLoans}</h3>
          <p>Pending Loan Approvals</p>
        </div>

        <div className="card approved">
          <h3>{stats.approvedLoans}</h3>
          <p>Approved Loans</p>
        </div>

        <div className="card rejected">
          <h3>{stats.rejectedLoans}</h3>
          <p>Rejected Loans</p>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
