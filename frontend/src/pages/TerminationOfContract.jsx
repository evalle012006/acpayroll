import React from "react";
import { useNavigate } from "react-router-dom";
import TerminationApprovalTab from "../components/approvals/TerminationApprovalTab";
import "../styles/StaffReport.css";

export default function TerminationOfContract() {
  const navigate = useNavigate();

  return (
    <div className="approval-page">
      <div className="approval-page-header">
        <div>
          <h2 className="approval-title">
            Termination of Contract
          </h2>

          <p className="approval-subtitle">
            Create and manage Termination of Contract requests.
          </p>
        </div>

        <button
          className="btn-secondary"
          onClick={() => navigate(-1)}
        >
          ← Back
        </button>
      </div>

      <TerminationApprovalTab embedded />
    </div>
  );
}