import React, { useMemo, useState } from "react";
import "../styles/Approval.css";

import LoanApprovalTab from "../components/approvals/LoanApprovalTab";
import SAPApprovalTab from "../components/approvals/SAPApprovalTab";
import ReimbursementApprovalTab from "../components/approvals/ReimbursementApprovalTab";

const readUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
};

const norm = (v) => String(v ?? "").trim().toLowerCase();

export default function Approval() {
  const user = useMemo(() => readUser(), []);
  const role = norm(user?.role);

  const canSeeSAP =
    role === "admin" ||
    role === "president" ||
    role === "hr" ||
    role === "accounting";

  const [activeTab, setActiveTab] = useState("loan");

  const safeActiveTab =
    activeTab === "sap" && !canSeeSAP ? "loan" : activeTab;

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
          className={safeActiveTab === "loan" ? "active" : ""}
          onClick={() => setActiveTab("loan")}
        >
          Loan Requests
        </button>

        {canSeeSAP && (
          <button
            type="button"
            className={safeActiveTab === "sap" ? "active" : ""}
            onClick={() => setActiveTab("sap")}
          >
            Staff Accounts Payable
          </button>
        )}

        <button
          type="button"
          className={safeActiveTab === "reimbursement" ? "active" : ""}
          onClick={() => setActiveTab("reimbursement")}
        >
          Reimbursement Requests
        </button>
      </div>

      <div className="approval-content">
        {safeActiveTab === "loan" && <LoanApprovalTab />}
        {safeActiveTab === "sap" && canSeeSAP && <SAPApprovalTab />}
        {safeActiveTab === "reimbursement" && <ReimbursementApprovalTab />}
      </div>
    </div>
  );
}