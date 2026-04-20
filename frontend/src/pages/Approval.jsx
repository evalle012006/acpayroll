import React, { useState } from "react";
import "../styles/Approval.css";

import LoanApprovalTab from "../components/approvals/LoanApprovalTab";
import SAPApprovalTab from "../components/approvals/SAPApprovalTab";
import ReimbursementApprovalTab from "../components/approvals/ReimbursementApprovalTab";

export default function Approval() {
  const [activeTab, setActiveTab] = useState("loan");

  return (
    <div className="approval-page">
      <div className="approval-page-header">
        <div>
          <h2 className="approval-title">Approvals</h2>
          <p className="approval-subtitle">
            Loan approvals, staff accounts payable, and reimbursement requests
          </p>
        </div>
      </div>

      <div className="approval-tabs">
        <button
          type="button"
          className={activeTab === "loan" ? "active" : ""}
          onClick={() => setActiveTab("loan")}
        >
          Loan Requests
        </button>

        <button
          type="button"
          className={activeTab === "sap" ? "active" : ""}
          onClick={() => setActiveTab("sap")}
        >
          Staff Accounts Payable
        </button>

        <button
          type="button"
          className={activeTab === "reimbursement" ? "active" : ""}
          onClick={() => setActiveTab("reimbursement")}
        >
          Reimbursement Requests
        </button>
      </div>

      <div className="approval-content">
        {activeTab === "loan" && <LoanApprovalTab />}
        {activeTab === "sap" && <SAPApprovalTab />}
        {activeTab === "reimbursement" && <ReimbursementApprovalTab />}
      </div>
    </div>
  );
}