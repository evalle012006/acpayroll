import React, { useState } from "react";
import "../styles/Approval.css";

const LoanApproval = () => {
  const [open, setOpen] = useState(false);

  return (
    <div className="approval-container">
      <h2>Loan Approval</h2>

      <button 
        className="approval-btn"
        onClick={() => setOpen(!open)}
      >
        Approval
      </button>

      {open && (
        <div className="approval-content">
          <p>Here is the loan request list...</p>
          {/* Your loan approval table here */}
        </div>
      )}
    </div>
  );
};

export default LoanApproval;
