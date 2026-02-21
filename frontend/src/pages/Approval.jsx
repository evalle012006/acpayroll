import React, { useState, useEffect } from "react";
import axios from "axios";
import { IoIosArrowDown } from "react-icons/io";
import "../styles/Approval.css";

const Approval = () => {
  const [active, setActive] = useState(null);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [loanRequests, setLoanRequests] = useState([]);

  const [selectedLeaveType, setSelectedLeaveType] = useState("All");
  const [selectedLoanType, setSelectedLoanType] = useState("All");

  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showLoanModal, setShowLoanModal] = useState(false);

  const [confirmModal, setConfirmModal] = useState({
    show: false,
    requestId: null,
    type: "", // "leave" or "loan"
    action: "", // "Approve" or "Reject"
  });

  useEffect(() => {
    fetchLeave();
    fetchLoan();
  }, []);

  const fetchLeave = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/leave-requests");
      setLeaveRequests(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchLoan = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/loan-requests");
      setLoanRequests(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const updateLeaveStatus = async (id, status) => {
    try {
      await axios.put(`http://localhost:5000/api/leave-requests/${id}`, { status });
      fetchLeave();
    } catch (err) {
      console.error(err);
    }
  };

  const updateLoanStatus = async (id, status) => {
    try {
      await axios.put(`http://localhost:5000/api/loan-requests/${id}`, { status });
      fetchLoan();
    } catch (err) {
      console.error(err);
    }
  };

  const handleActionClick = (id, type, action) => {
    setConfirmModal({ show: true, requestId: id, type, action });
  };

  const confirmAction = () => {
    const { requestId, type, action } = confirmModal;

    if (type === "leave") {
      updateLeaveStatus(requestId, action);
    } else {
      updateLoanStatus(requestId, action);
    }

    setConfirmModal({ show: false, requestId: null, type: "", action: "" });
  };

  const toggleSection = (section) => {
    setActive(active === section ? null : section);
  };

  return (
    <div className="approval-container">
      <h1>Approval Management</h1>

      <div className="accordion-item">
        <div className="accordion-header" onClick={() => toggleSection("leave")}>
          <span>Leave Approval</span>
          <IoIosArrowDown className={`arrow ${active === "leave" ? "rotate" : ""}`} />
        </div>

        {active === "leave" && (
          <div className="accordion-content open">
            <button className="view-btn" onClick={() => setShowLeaveModal(true)}>
              View Leave Requests
            </button>
          </div>
        )}
      </div>

      <div className="accordion-item">
        <div className="accordion-header" onClick={() => toggleSection("loan")}>
          <span>Loan Approval</span>
          <IoIosArrowDown className={`arrow ${active === "loan" ? "rotate" : ""}`} />
        </div>

        {active === "loan" && (
          <div className="accordion-content open">
            <button className="view-btn" onClick={() => setShowLoanModal(true)}>
              View Loan Requests
            </button>
          </div>
        )}
      </div>

      {showLeaveModal && (
        <div className="modal-overlay" onClick={() => setShowLeaveModal(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Leave Requests</h3>
            </div>

            <div className="leave-type-buttons">
              {["All","Annual Leave","Sick Leave","Maternity Leave","Paternity Leave","Emergency Leave","Indefinite Leave"]
                .map(type => (
                  <button
                    key={type}
                    className={`leave-btn ${selectedLeaveType === type ? "active" : ""}`}
                    onClick={() => setSelectedLeaveType(type)}
                  >
                    {type}
                  </button>
              ))}
            </div>

            <div className="modal-body">
              <table className="leave-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Start</th>
                    <th>End</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {leaveRequests
                    .filter(item =>
                      selectedLeaveType === "All" ? true : item.leave_type === selectedLeaveType
                    )
                    .map(item => (
                      <tr key={item.id}>
                        <td>{item.id}</td>
                        <td>{item.staff_name}</td>
                        <td>{item.leave_type}</td>
                        <td>{item.start_date}</td>
                        <td>{item.end_date}</td>
                        <td>
                            <span className={item.status === "Approved" ? "status-badge approved" : item.status === "Rejected"
                                ? "status-badge rejected" : "status-badge pending"}
                            >
                                {item.status}
                            </span>
                        </td>

                        <td>
                          {item.status === "Pending" ? (
                            <>
                            <button className="approve-btn" onClick={() => handleActionClick(item.id, "leave", "Approved")}>
                                Approve
                            </button>

                            <button className="reject-btn" onClick={() => handleActionClick(item.id, "leave", "Rejected")}>
                                Reject
                            </button>
                        </>

                          ) : "-"}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            <div className="modal-footer">
              <button className="cancel-btn" onClick={() => setShowLeaveModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {showLoanModal && (
        <div className="modal-overlay" onClick={() => setShowLoanModal(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Loan Requests</h3>
            </div>

            <div className="leave-type-buttons">
              {["All","Salary Advance","Special Advance","Cash Advance","Motorcycle Loan"]
                .map(type => (
                  <button key={type} className={`leave-btn ${selectedLoanType === type ? "active" : ""}`}
                    onClick={() => setSelectedLoanType(type)}>
                        {type}
                  </button>
              ))}
            </div>

            <div className="modal-body">
              <table className="leave-table">
                <thead>
                    <tr>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Loan Type</th>
                    <th>Amount</th>
                    <th>Term (Months)</th>
                    <th>Interest (%)</th>
                    <th>Per Month</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th>Action</th>
                    </tr>
                </thead>

                <tbody>
                  {loanRequests
                    .filter(item =>
                      selectedLoanType === "All" ? true : item.loan_type === selectedLoanType
                    )
                    .map(item => (
                      <tr key={item.id}>
                        <td>{item.id}</td>
                        <td>{item.staff_name}</td>
                        <td>{item.loan_type}</td>
                        <td>₱{Number(item.amount).toLocaleString()}</td>
                        <td>{item.term}</td>
                        <td>{item.interest}%</td>
                        <td>₱{Number(item.per_month).toLocaleString()}</td>
                        <td>₱{Number(item.total).toLocaleString()}</td>

                        <td>
                            <span className={item.status === "Approved" ? "status-badge approved" : item.status === "Rejected"
                                ? "status-badge rejected" : "status-badge pending"}>
                                    {item.status}
                            </span>
                        </td>
                        <td>
                          {item.status === "Pending" ? (
                            <>
                        <button className="approve-btn" onClick={() => handleActionClick(item.id, "loan", "Approved")}>
                            Approve
                        </button>
    
                        <button className="reject-btn" onClick={() => handleActionClick(item.id, "loan", "Rejected")}>
                            Reject
                        </button>
                    </>

                          ) : "-"}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            <div className="modal-footer">
              <button className="cancel-btn" onClick={() => setShowLoanModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {confirmModal.show && (
        <div className="modal-overlay" onClick={() => setConfirmModal({ show: false })}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Confirm {confirmModal.action}</h3>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to {confirmModal.action.toLowerCase()} this {confirmModal.type} request?</p>
            </div>
            <div className="modal-footer">
              <button className="approve-btn" onClick={confirmAction}>Yes</button>
              <button className="reject-btn" onClick={() => setConfirmModal({ show: false })}>No</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Approval;
