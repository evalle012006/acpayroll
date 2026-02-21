import React, { useState } from "react";
import axios from "axios";
import "../styles/SystemUpdate.css";

const SystemUpdate = () => {
  const [showLoanModal, setShowLoanModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [loading, setLoading] = useState(false);

  /* ================= LOAN STATE ================= */
  const [loanForm, setLoanForm] = useState({
    staff_name: "",
    loan_type: "",
    amount: "",
    term: "",
    interest: "",
    reason: ""
  });

  /* ================= LEAVE STATE ================= */
  const [leaveForm, setLeaveForm] = useState({
    staff_name: "",
    leave_type: "",
    start_date: "",
    end_date: "",
  });

  /* ================= STAFF ACCOUNTS PAYABLE STATE ================= */
const [showSAPModal, setShowSAPModal] = useState(false);

const [sapForm, setSapForm] = useState({
  employee_id: "",
  staff_name: "",
  description: "",
  amount: "",
  term: "",
  balance: "",
});


  /* ================= LOAN INPUT HANDLER ================= */
  const handleLoanChange = (e) => {
  const { name, value } = e.target;

  setLoanForm((prev) => ({
    ...prev,
    [name]: value
  }));
};

  /* ================= SAP INPUT HANDLER ================= */
const handleSapChange = (e) => {
  const { name, value } = e.target;

  if (name === "amount") {
    setSapForm({
      ...sapForm,
      amount: value,
      balance: value,
    });
  } else {
    setSapForm({
      ...sapForm,
      [name]: value,
    });
  }
};

/* ================= SAP SUBMIT ================= */
const handleAddSAP = async (e) => {
  e.preventDefault();

  const amount = parseFloat(sapForm.amount) || 0;
  const term = parseFloat(sapForm.term) || 1;
  const per_month = amount / term;
  const balance = parseFloat(sapForm.balance) || amount;

  try {
    setLoading(true);

    await axios.post("http://localhost:5000/api/staff-accounts-payable", {
      ...sapForm,
      amount,
      term,
      per_month,
      balance,
    });

    alert("Staff Accounts Payable added successfully!");

    setSapForm({
      employee_id: "",
      staff_name: "",
      description: "",
      amount: "",
      term: "",
      balance: "",
    });

    setShowSAPModal(false);
  } catch (err) {
    console.error(err);
    alert("Failed to add Staff Accounts Payable.");
  } finally {
    setLoading(false);
  }
};

  /* ================= LOAN SUBMIT ================= */
  const handleAddLoan = async (e) => {
    e.preventDefault();

    const amount = parseFloat(loanForm.amount) || 0;
    const interest = parseFloat(loanForm.interest) || 0;
    const term = parseFloat(loanForm.term) || 1;

    const total = amount + (amount * interest) / 100;
    const per_month = total / term;

    try {
      setLoading(true);

      await axios.post("http://localhost:5000/api/loan-requests", {
        ...loanForm,
        total,
        per_month,
        status: "Pending",
      });

      alert("Loan added successfully!");

      setLoanForm({
        staff_name: "",
        loan_type: "",
        amount: "",
        term: "",
        interest: "",
        reason: "",
      });

      setShowLoanModal(false);
    } catch (err) {
      console.error(err);
      alert("Failed to add loan.");
    } finally {
      setLoading(false);
    }
  };

  /* ================= LEAVE INPUT HANDLER ================= */
  const handleLeaveChange = (e) => {
    const { name, value } = e.target;
    setLeaveForm({
      ...leaveForm,
      [name]: value,
    });
  };

  /* ================= LEAVE SUBMIT ================= */
  const handleAddLeave = async (e) => {
    e.preventDefault();

    try {
      setLoading(true);

      await axios.post("http://localhost:5000/api/leave-requests", {
        ...leaveForm,
        status: "Pending",
      });

      alert("Leave added successfully!");

      setLeaveForm({
        staff_name: "",
        leave_type: "",
        start_date: "",
        end_date: "",
      });

      setShowLeaveModal(false);
    } catch (err) {
      console.error(err);
      alert("Failed to add leave.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="system-update-container">
      <div className="page-header">
        <h2>System Update</h2>
        <p>Add new loan or leave requests easily.</p>
      </div>

      <div className="update-buttons">
        <button className="primary-btn" onClick={() => setShowLoanModal(true)}>
          + Add Loan
        </button>
        <button className="secondary-btn" onClick={() => setShowLeaveModal(true)}>
          + Add Leave
        </button>
        <button className="secondary-btn" onClick={() => setShowSAPModal(true)}>
          + Staff Accounts Payable
        </button>
      </div>

      {/* ================= LOAN MODAL ================= */}
      {showLoanModal && (
        <div className="modal-overlay" onClick={() => setShowLoanModal(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <h3>Add Loan Request</h3>

            <form onSubmit={handleAddLoan}>
              <div className="form-group">
                <label>Staff Name</label>
                <input
                  type="text"
                  name="staff_name"
                  value={loanForm.staff_name}
                  onChange={handleLoanChange}
                  required
                />
              </div>

        <div className="form-group">
            <label>Loan Type</label>
                <select
                    name="loan_type"
                    value={loanForm.loan_type}
                    onChange={handleLoanChange}
                    required
                >
                    <option value="">Select Loan Type</option>
                    <option value="Motorcycle Loan">Motorcycle Loan</option>
                    <option value="Advance Loan">Advance Loan</option>
                    <option value="Cash Loan">Cash Loan</option>
                    <option value="Special Loan">Special Loan</option>
                </select>
            </div>

              <div className="form-group">
                <label>Amount</label>
                <input
                  type="number"
                  name="amount"
                  value={loanForm.amount}
                  onChange={handleLoanChange}
                  required
                />
              </div>

              <div className="form-group">
                <label>Term (Months)</label>
                <input
                  type="number"
                  name="term"
                  value={loanForm.term}
                  onChange={handleLoanChange}
                  required
                />
              </div>

              <div className="form-group">
                <label>Interest (%)</label>
                <input
                  type="number"
                  name="interest"
                  value={loanForm.interest}
                  onChange={handleLoanChange}
                  required
                />
              </div>

              <div className="form-group">
                <label>Reason</label>
                <textarea
                  name="reason"
                  value={loanForm.reason}
                  onChange={handleLoanChange}
                  required
                />
              </div>

              <div className="loan-preview">
                <p>
                  <strong>Total with Interest:</strong>{" "}
                  ₱{" "}
                  {loanForm.amount && loanForm.interest
                    ? (
                        parseFloat(loanForm.amount) +
                        (parseFloat(loanForm.amount) *
                          parseFloat(loanForm.interest)) /
                          100
                      ).toFixed(2)
                    : "0.00"}
                </p>

                <p>
                  <strong>Per Month:</strong>{" "}
                  ₱{" "}
                  {loanForm.amount &&
                  loanForm.term &&
                  loanForm.interest
                    ? (
                        (
                          parseFloat(loanForm.amount) +
                          (parseFloat(loanForm.amount) *
                            parseFloat(loanForm.interest)) /
                            100
                        ) /
                        parseFloat(loanForm.term)
                      ).toFixed(2)
                    : "0.00"}
                </p>
              </div>

              <div className="modal-footer">
                <button type="submit" className="save-btn" disabled={loading}>
                  {loading ? "Saving..." : "Approved"}
                </button>
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={() => setShowLoanModal(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= LEAVE MODAL ================= */}
      {showLeaveModal && (
        <div className="modal-overlay" onClick={() => setShowLeaveModal(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <h3>Add Leave Request</h3>

            <form onSubmit={handleAddLeave}>
              <div className="form-group">
                <label>Staff Name</label>
                <input
                  type="text"
                  name="staff_name"
                  value={leaveForm.staff_name}
                  onChange={handleLeaveChange}
                  required
                />
              </div>

              <div className="form-group">
                <label>Leave Type</label>
                <select
                  name="leave_type"
                  value={leaveForm.leave_type}
                  onChange={handleLeaveChange}
                  required
                >
                  <option value="">Select Leave Type</option>
                  <option value="Annual Leave">Annual Leave</option>
                  <option value="Sick Leave">Sick Leave</option>
                  <option value="Maternity Leave">Maternity Leave</option>
                  <option value="Paternity Leave">Paternity Leave</option>
                  <option value="Emergency Leave">Emergency Leave</option>
                  <option value="Indefinite Leave">Indefinite Leave</option>
                </select>
              </div>

              <div className="form-group">
                <label>Start Date</label>
                <input
                  type="date"
                  name="start_date"
                  value={leaveForm.start_date}
                  onChange={handleLeaveChange}
                  required
                />
              </div>

              <div className="form-group">
                <label>End Date</label>
                <input
                  type="date"
                  name="end_date"
                  value={leaveForm.end_date}
                  onChange={handleLeaveChange}
                  required
                />
              </div>

              <div className="modal-footer">
                <button type="submit" className="save-btn" disabled={loading}>
                  {loading ? "Saving..." : "Approved"}
                </button>
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={() => setShowLeaveModal(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= STAFF ACCOUNTS PAYABLE MODAL ================= */}
{showSAPModal && (
  <div className="modal-overlay" onClick={() => setShowSAPModal(false)}>
    <div className="modal-container" onClick={(e) => e.stopPropagation()}>
      <h3>Add Staff Accounts Payable</h3>

      <form onSubmit={handleAddSAP}>
        <div className="form-group">
          <label>Employee ID</label>
          <input
            type="text"
            name="employee_id"
            value={sapForm.employee_id}
            onChange={handleSapChange}
            required
          />
        </div>

        <div className="form-group">
          <label>Staff Name</label>
          <input
            type="text"
            name="staff_name"
            value={sapForm.staff_name}
            onChange={handleSapChange}
            required
          />
        </div>

        <div className="form-group">
          <label>Description</label>
          <textarea
            name="description"
            value={sapForm.description}
            onChange={handleSapChange}
            required
          />
        </div>

        <div className="form-group">
          <label>Total Amount</label>
          <input
            type="number"
            name="amount"
            value={sapForm.amount}
            onChange={handleSapChange}
            required
          />
        </div>

        <div className="form-group">
          <label>Term (Months)</label>
          <input
            type="number"
            name="term"
            value={sapForm.term}
            onChange={handleSapChange}
            required
          />
        </div>

        <div className="form-group">
                <label>Balance</label>
                  <input
                    type="number"
                    name="balance"
                    value={sapForm.balance}
                    onChange={handleSapChange}
                    required
                  />
              </div>

        <div className="loan-preview">
          <p>
            <strong>Per Month:</strong> ₱{" "}
            {sapForm.amount && sapForm.term
              ? (parseFloat(sapForm.amount) /
                  parseFloat(sapForm.term)
                ).toFixed(2)
              : "0.00"}
          </p>
        </div>

        <div className="modal-footer">
          <button type="submit" className="save-btn" disabled={loading}>
            {loading ? "Saving..." : "Approved"}
          </button>
          <button
            type="button"
            className="cancel-btn"
            onClick={() => setShowSAPModal(false)}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  </div>
)}


    </div>
  );
};

export default SystemUpdate;
