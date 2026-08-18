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
      {/* =========================
          PAGE HEADER
      ========================== */}
      <section className="approval-main-header">
        <div className="approval-main-header-content">
          <div>
            <div className="approval-header-label">
              FINANCE APPROVAL
            </div>

            <h1 className="approval-title">
              Approvals
            </h1>

            <p className="approval-subtitle">
              Review and manage loan requests, CBU withdrawals,
              and reimbursement requests.
            </p>
          </div>

          <div className="approval-header-decoration">
            <div className="approval-decoration-circle circle-one" />
            <div className="approval-decoration-circle circle-two" />
          </div>
        </div>
      </section>

      {/* =========================
          APPROVAL TYPE NAVIGATION
      ========================== */}
      <section className="approval-navigation">
        <div className="approval-navigation-title">
          <span>Approval Type</span>
          <small>Select a transaction to review</small>
        </div>

        <div className="approval-tabs">
          {canAccessLoanApproval && (
            <button
              type="button"
              className={safeActiveTab === "loan" ? "active" : ""}
              onClick={() => setActiveTab("loan")}
            >
              <span className="approval-tab-icon">₱</span>

              <span className="approval-tab-text">
                <strong>Loan Requests</strong>
                <small>Employee loan applications</small>
              </span>
            </button>
          )}

          <button
            type="button"
            className={safeActiveTab === "cbu" ? "active" : ""}
            onClick={() => setActiveTab("cbu")}
          >
            <span className="approval-tab-icon">CBU</span>

            <span className="approval-tab-text">
              <strong>CBU Withdrawals</strong>
              <small>Capital build-up requests</small>
            </span>
          </button>

          <button
            type="button"
            className={
              safeActiveTab === "reimbursement" ? "active" : ""
            }
            onClick={() => setActiveTab("reimbursement")}
          >
            <span className="approval-tab-icon">R</span>

            <span className="approval-tab-text">
              <strong>Reimbursements</strong>
              <small>Expense reimbursement requests</small>
            </span>
          </button>
        </div>
      </section>

      {/* =========================
          ACTIVE APPROVAL CONTENT
      ========================== */}
      <section className="approval-workspace">
        <div className="approval-workspace-header">
          <div>
            <span className="approval-workspace-label">
              CURRENT VIEW
            </span>

            <h2>
              {safeActiveTab === "loan" && "Loan Requests"}
              {safeActiveTab === "cbu" && "CBU Withdrawals"}
              {safeActiveTab === "reimbursement" &&
                "Reimbursement Requests"}
            </h2>
          </div>
        </div>

        <div className="approval-content">
          {safeActiveTab === "loan" &&
            canAccessLoanApproval && (
              <LoanApprovalTab />
            )}

          {safeActiveTab === "cbu" && (
            <CBUWithdrawApprovalTab />
          )}

          {safeActiveTab === "reimbursement" && (
            <ReimbursementApprovalTab />
          )}
        </div>
      </section>
    </div>
  );
}