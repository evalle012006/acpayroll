import React, { useEffect, useMemo, useState, useCallback } from "react";
import "../styles/SystemUpdate.css";
import api from "../api/axiosClient";

const SystemUpdate = () => {
  const [showLoanModal, setShowLoanModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showSAPModal, setShowSAPModal] = useState(false);
  const [loading, setLoading] = useState(false);

  const [staffList, setStaffList] = useState([]);

  const [loanForm, setLoanForm] = useState({
    employee_id: "",
    staff_name: "",
    loan_type: "",
    amount: "",
    term: "",
    interest: "",
    reason: "",
    approved_at: "",
    disbursement_date: "",
  });

  const [leaveForm, setLeaveForm] = useState({
    employee_id: "",
    staff_name: "",
    leave_type: "",
    start_date: "",
    end_date: "",
  });

  const [sapForm, setSapForm] = useState({
    employee_id: "",
    staff_name: "",
    description: "",
    amount: "",
    term: "",
    balance: "",
  });

  const anyModalOpen = showLoanModal || showLeaveModal || showSAPModal;

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/login";
  }, []);

  const toNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  const loanPreview = useMemo(() => {
    const amount = toNum(loanForm.amount);
    const interest = toNum(loanForm.interest);
    const term = Math.max(1, toNum(loanForm.term));
    const total = amount + (amount * interest) / 100;
    const per_month = total / term;
    return { total, per_month };
  }, [loanForm.amount, loanForm.interest, loanForm.term]);

  const sapPreview = useMemo(() => {
    const amount = toNum(sapForm.amount);
    const term = Math.max(1, toNum(sapForm.term));
    const per_month = amount / term;
    return { per_month };
  }, [sapForm.amount, sapForm.term]);

  const closeAll = () => {
    setShowLoanModal(false);
    setShowLeaveModal(false);
    setShowSAPModal(false);
  };

  useEffect(() => {
    const fetchStaff = async () => {
      try {
        const res = await api.get("/staff");
        setStaffList(res.data || []);
      } catch (err) {
        const status = err?.response?.status;
        if (status === 401) logout();
        setStaffList([]);
      }
    };
    fetchStaff();
  }, [logout]);

  useEffect(() => {
    if (!anyModalOpen) return;

    const onKeyDown = (e) => e.key === "Escape" && closeAll();
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [anyModalOpen]);

  const handleLoanChange = (e) => {
    const { name, value } = e.target;
    setLoanForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleLeaveChange = (e) => {
    const { name, value } = e.target;
    setLeaveForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSapChange = (e) => {
    const { name, value } = e.target;

    if (name === "amount") {
      setSapForm((prev) => ({ ...prev, amount: value, balance: value }));
      return;
    }
    setSapForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleLoanEmployeeSelect = (employeeId) => {
    const emp = staffList.find((s) => String(s.id) === String(employeeId));
    setLoanForm((prev) => ({ ...prev, employee_id: employeeId, staff_name: emp?.fullname || "" }));
  };

  const handleLeaveEmployeeSelect = (employeeId) => {
    const emp = staffList.find((s) => String(s.id) === String(employeeId));
    setLeaveForm((prev) => ({ ...prev, employee_id: employeeId, staff_name: emp?.fullname || "" }));
  };

  const handleSapEmployeeSelect = (employeeId) => {
    const emp = staffList.find((s) => String(s.id) === String(employeeId));
    setSapForm((prev) => ({ ...prev, employee_id: employeeId, staff_name: emp?.fullname || "" }));
  };

  const handleAddLoan = async (e) => {
    e.preventDefault();

    const amount = toNum(loanForm.amount);
    const interest = toNum(loanForm.interest);
    const term = Math.max(1, toNum(loanForm.term));
    const total = amount + (amount * interest) / 100;
    const per_month = total / term;

    try {
      setLoading(true);

      await api.post("/loan-requests", {
        employee_id: loanForm.employee_id,
        staff_name: loanForm.staff_name,
        loan_type: loanForm.loan_type,
        reason: loanForm.reason,
        amount,
        interest,
        term,
        total,
        per_month,
        status: "Pending",
        approved_at: loanForm.approved_at || null,
        disbursement_date: loanForm.disbursement_date || null,
      });

      alert("Loan request submitted!");

      setLoanForm({
        employee_id: "",
        staff_name: "",
        loan_type: "",
        amount: "",
        term: "",
        interest: "",
        reason: "",
        approved_at: "",
        disbursement_date: "",
      });

      setShowLoanModal(false);
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401) return logout();
      alert(err?.response?.data?.message || "Failed to submit loan request.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddLeave = async (e) => {
    e.preventDefault();

    try {
      setLoading(true);

      await api.post("/leave-requests", {
        employee_id: leaveForm.employee_id,
        staff_name: leaveForm.staff_name,
        leave_type: leaveForm.leave_type,
        start_date: leaveForm.start_date,
        end_date: leaveForm.end_date,
        status: "Pending",
      });

      alert("Leave request submitted!");

      setLeaveForm({
        employee_id: "",
        staff_name: "",
        leave_type: "",
        start_date: "",
        end_date: "",
      });

      setShowLeaveModal(false);
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401) return logout();
      alert(err?.response?.data?.message || "Failed to submit leave request.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddSAP = async (e) => {
    e.preventDefault();

    const amount = toNum(sapForm.amount);
    const term = Math.max(1, toNum(sapForm.term));
    const per_month = amount / term;
    const balance = toNum(sapForm.balance) || amount;

    try {
      setLoading(true);

      await api.post("/staff-accounts-payable", {
        ...sapForm,
        amount,
        term,
        per_month,
        balance,
      });

      alert("Staff Accounts Payable added!");

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
      const status = err?.response?.status;
      if (status === 401) return logout();
      alert(err?.response?.data?.message || "Failed to add Staff Accounts Payable.");
    } finally {
      setLoading(false);
    }
  };

  const renderEmployeeOptions = () =>
    staffList.map((s) => (
      <option key={s.id} value={s.id}>
        {(s.employee_no ? `${s.employee_no} - ` : "") + s.fullname}
      </option>
    ));

  return (
    <div className="sys-page">
      <div className="sys-header">
        <div>
          <h2 className="sys-title">System Update</h2>
          <p className="sys-subtitle">Create requests for approvals and staff payable records</p>
        </div>
      </div>

      <div className="sys-card">
        <div className="sys-card-head">
          <div className="sys-card-title">Quick Actions</div>
          <div className="sys-card-meta">These submissions will appear in Approvals</div>
        </div>

        <div className="sys-actions">
          <button className="btn-primary" onClick={() => setShowLoanModal(true)} type="button">
            + Add Loan
          </button>

          <button className="btn-secondary" onClick={() => setShowLeaveModal(true)} type="button">
            + Add Leave
          </button>

          <button className="btn-secondary" onClick={() => setShowSAPModal(true)} type="button">
            + Staff Accounts Payable
          </button>
        </div>
      </div>

      {showLoanModal && (
        <div className="modal-overlay" onMouseDown={(e) => e.target.classList.contains("modal-overlay") && closeAll()}>
          <div className="modal saas-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h3 className="modal-title">Add Loan Request</h3>
                <p className="modal-subtitle">This will be submitted with status: Pending</p>
              </div>
              <button className="modal-x" type="button" onClick={closeAll}>✕</button>
            </div>

            <form onSubmit={handleAddLoan} className="modal-form">
              <div className="modal-grid">
                <div className="form-group">
                  <label>Employee</label>
                  <select value={loanForm.employee_id} onChange={(e) => handleLoanEmployeeSelect(e.target.value)} required>
                    <option value="">Select Employee</option>
                    {renderEmployeeOptions()}
                  </select>
                </div>

                <div className="form-group">
                  <label>Loan Type</label>
                  <select name="loan_type" value={loanForm.loan_type} onChange={handleLoanChange} required>
                    <option value="">Select Loan Type</option>
                    <option value="Motorcycle Loan">Motorcycle Loan</option>
                    <option value="Advance Loan">Advance Loan</option>
                    <option value="Cash Loan">Cash Loan</option>
                    <option value="Special Loan">Special Loan</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Amount</label>
                  <input type="number" name="amount" value={loanForm.amount} onChange={handleLoanChange} required />
                </div>

                <div className="form-group">
                  <label>Term (Months)</label>
                  <input type="number" name="term" value={loanForm.term} onChange={handleLoanChange} required />
                </div>

                <div className="form-group">
                  <label>Interest (%)</label>
                  <input type="number" name="interest" value={loanForm.interest} onChange={handleLoanChange} required />
                </div>

                <div className="form-group">
                  <label>Approved Date (Optional)</label>
                  <input type="date" name="approved_at" value={loanForm.approved_at} onChange={handleLoanChange} />
                </div>

                <div className="form-group">
                  <label>Disbursement Date (Optional)</label>
                  <input type="date" name="disbursement_date" value={loanForm.disbursement_date} onChange={handleLoanChange} />
                </div>

                <div className="form-group full">
                  <label>Reason</label>
                  <textarea name="reason" value={loanForm.reason} onChange={handleLoanChange} required />
                </div>
              </div>

              <div className="preview-box">
                <div>
                  <span>Total with Interest</span>
                  <strong>₱ {loanPreview.total.toFixed(2)}</strong>
                </div>
                <div>
                  <span>Per Month</span>
                  <strong>₱ {loanPreview.per_month.toFixed(2)}</strong>
                </div>
              </div>

              <div className="modal-buttons">
                <button className="btn-secondary" type="button" onClick={closeAll}>Cancel</button>
                <button className="btn-primary" type="submit" disabled={loading}>
                  {loading ? "Submitting..." : "Submit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showLeaveModal && (
        <div className="modal-overlay" onMouseDown={(e) => e.target.classList.contains("modal-overlay") && closeAll()}>
          <div className="modal saas-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h3 className="modal-title">Add Leave Request</h3>
                <p className="modal-subtitle">This will be submitted with status: Pending</p>
              </div>
              <button className="modal-x" type="button" onClick={closeAll}>✕</button>
            </div>

            <form onSubmit={handleAddLeave} className="modal-form">
              <div className="modal-grid">
                <div className="form-group">
                  <label>Employee</label>
                  <select value={leaveForm.employee_id} onChange={(e) => handleLeaveEmployeeSelect(e.target.value)} required>
                    <option value="">Select Employee</option>
                    {renderEmployeeOptions()}
                  </select>
                </div>

                <div className="form-group">
                  <label>Leave Type</label>
                  <select name="leave_type" value={leaveForm.leave_type} onChange={handleLeaveChange} required>
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
                  <input type="date" name="start_date" value={leaveForm.start_date} onChange={handleLeaveChange} required />
                </div>

                <div className="form-group">
                  <label>End Date</label>
                  <input type="date" name="end_date" value={leaveForm.end_date} onChange={handleLeaveChange} required />
                </div>
              </div>

              <div className="modal-buttons">
                <button className="btn-secondary" type="button" onClick={closeAll}>Cancel</button>
                <button className="btn-primary" type="submit" disabled={loading}>
                  {loading ? "Submitting..." : "Submit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SAP Modal */}
      {showSAPModal && (
        <div className="modal-overlay" onMouseDown={(e) => e.target.classList.contains("modal-overlay") && closeAll()}>
          <div className="modal saas-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h3 className="modal-title">Add Staff Accounts Payable</h3>
                <p className="modal-subtitle">Creates a payable record for the employee</p>
              </div>
              <button className="modal-x" type="button" onClick={closeAll}>✕</button>
            </div>

            <form onSubmit={handleAddSAP} className="modal-form">
              <div className="modal-grid">
                <div className="form-group full">
                  <label>Employee</label>
                  <select value={sapForm.employee_id} onChange={(e) => handleSapEmployeeSelect(e.target.value)} required>
                    <option value="">Select Employee</option>
                    {renderEmployeeOptions()}
                  </select>
                </div>

                <div className="form-group full">
                  <label>Description</label>
                  <textarea name="description" value={sapForm.description} onChange={handleSapChange} required />
                </div>

                <div className="form-group">
                  <label>Total Amount</label>
                  <input type="number" name="amount" value={sapForm.amount} onChange={handleSapChange} required />
                </div>

                <div className="form-group">
                  <label>Term (Months)</label>
                  <input type="number" name="term" value={sapForm.term} onChange={handleSapChange} required />
                </div>

                <div className="form-group">
                  <label>Balance</label>
                  <input type="number" name="balance" value={sapForm.balance} onChange={handleSapChange} required />
                </div>
              </div>

              <div className="preview-box">
                <div>
                  <span>Per Month</span>
                  <strong>₱ {sapPreview.per_month.toFixed(2)}</strong>
                </div>
              </div>

              <div className="modal-buttons">
                <button className="btn-secondary" type="button" onClick={closeAll}>Cancel</button>
                <button className="btn-primary" type="submit" disabled={loading}>
                  {loading ? "Saving..." : "Save"}
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