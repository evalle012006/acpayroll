import React, { useMemo, useState } from "react";
import "../styles/Approval.css";

import LoanApprovalTab from "../components/approvals/LoanApprovalTab";
import ReimbursementApprovalTab from "../components/approvals/ReimbursementApprovalTab";
import CBUWithdrawApprovalTab from "../components/approvals/CBUWithdrawApprovalTab";

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

  const isAdmin = role === "admin";
  const isIt = role === "it";
  const isHr = role === "hr";
  const isAccounting = role === "accounting";
  const isTread = role === "tread";

  const isBranchManager = role === "branch manager";
  const isAreaManager = role === "area manager";
  const isRegionalManager = role === "regional manager";
  const isAssistantVicePresident =
    role === "assistant vice president";

  const isVicePresident = role === "vice president";
  const isSeniorVicePresident =
    role === "senior vice president";

  const isPresident = role === "president";

  const canAccessLoanApproval =
    isAdmin ||
    isIt ||
    isHr ||
    isAccounting ||
    isTread ||
    isBranchManager ||
    isAreaManager ||
    isRegionalManager ||
    isAssistantVicePresident ||
    isVicePresident ||
    isSeniorVicePresident ||
    isPresident;

  const [activeTab, setActiveTab] = useState(
    canAccessLoanApproval ? "loan" : "cbu"
  );

  const safeActiveTab = activeTab;

  return (
    <div className="approval-page">
      <div className="approval-page-header">
        <div>
          <h2 className="approval-title">Approvals</h2>

          <p className="approval-subtitle">
            Loan approvals, CBU withdrawals, and reimbursement requests
          </p>
        </div>
      </div>

      <div className="approval-tabs">
        {canAccessLoanApproval && (
          <button
            type="button"
            className={safeActiveTab === "loan" ? "active" : ""}
            onClick={() => setActiveTab("loan")}
          >
            Loan Requests
          </button>
        )}

        <button
          type="button"
          className={safeActiveTab === "cbu" ? "active" : ""}
          onClick={() => setActiveTab("cbu")}
        >
          CBU Withdraw
        </button>

        <button
          type="button"
          className={safeActiveTab === "reimbursement" ? "active" : ""}
          onClick={() => setActiveTab("reimbursement")}
        >
          Reimbursement Requests
        </button>
      </div>

      <div className="approval-content">
        {safeActiveTab === "loan" &&
          canAccessLoanApproval && <LoanApprovalTab />}

        {safeActiveTab === "cbu" && (
          <CBUWithdrawApprovalTab />
        )}

        {safeActiveTab === "reimbursement" && (
          <ReimbursementApprovalTab />
        )}
      </div>
    </div>
  );
}