import React from "react";
import { useNavigate } from "react-router-dom";
import OtherReceivableTab from "../components/approvals/OtherReceivableTab";
import "../styles/Approval.css";

export default function OtherReceivable() {
  const navigate = useNavigate();

  return (
    <div className="approval-page">
      <div className="approval-page-header">
        <div>
          <h2 className="approval-title">Other Receivable</h2>
          <p className="approval-subtitle">
            Create and manage employee liabilities.
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

      <OtherReceivableTab embedded />
    </div>
  );
}