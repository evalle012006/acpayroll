import React from "react";
import { useNavigate } from "react-router-dom";
import SAPApprovalTab from "../components/approvals/SAPApprovalTab";
import "../styles/Approval.css";

export default function StaffAccountsPayable() {
  const navigate = useNavigate();

  return (
    <div className="approval-page">
      <div className="approval-page-header">
        <div>
          <h2 className="approval-title">Staff Accounts Payable</h2>
          <p className="approval-subtitle">
            Create and manage staff accounts payable records.
          </p>
        </div>

        <div className="approval-header-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => navigate(-1)}
          >
            ← Back
          </button>
        </div>
      </div>

      <SAPApprovalTab embedded />
    </div>
  );
}