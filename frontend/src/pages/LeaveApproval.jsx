import React, { useState } from "react";
import "../styles/Approval.css";

const LeaveApproval = () => {
  const [open, setOpen] = useState(false);

  return (
    <div className="approval-container">
      <h2>Leave Approval</h2>

      <button 
        className="approval-btn"
        onClick={() => setOpen(!open)}
      >
        Approval
      </button>

      {open && (
        <div className="approval-content">
          <p>Here is the leave request list...</p>
          {/* Your leave approval table here */}
        </div>
      )}
    </div>
  );
};

export default LeaveApproval;
