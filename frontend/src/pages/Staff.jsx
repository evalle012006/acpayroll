import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import axios from "axios";
import "../styles/Staff.css";

const API = "http://localhost:5000";

const Staff = () => {
  const location = useLocation();
  const [staff, setStaff] = useState([]);

  // form fields
  const [fullname, setFullname] = useState("");
  const [position, setPosition] = useState("");
  const [department, setDepartment] = useState("");
  const [area, setArea] = useState("");
  const [salary, setSalary] = useState("");
  const [ecola, setEcola] = useState("");
  const [branchId, setBranchId] = useState("");

  // ✅ new fields
  const [regularizationDate, setRegularizationDate] = useState("");
  const [motorcycleLoan, setMotorcycleLoan] = useState("");

  // allowances/deductions
  const [postage, setPostage] = useState("");
  const [transportation, setTransportation] = useState("");
  const [additionalTarget, setAdditionalTarget] = useState("");
  const [repairing, setRepairing] = useState("");
  const [additionalMonitoring, setAdditionalMonitoring] = useState("");
  const [motorcycle, setMotorcycle] = useState("");
  const [otherDeduction, setOtherDeduction] = useState("");
  const [payrollDate, setPayrollDate] = useState("");

  // ui state
  const [editId, setEditId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  // ---------------------------
  // Helpers
  // ---------------------------
  const resetForm = () => {
    setFullname("");
    setPosition("");
    setDepartment("");
    setArea("");
    setSalary("");
    setEcola("");
    setBranchId("");

    setRegularizationDate("");
    setMotorcycleLoan("");

    setPostage("");
    setTransportation("");
    setAdditionalTarget("");
    setRepairing("");
    setAdditionalMonitoring("");
    setMotorcycle("");
    setOtherDeduction("");
    setPayrollDate("");

    setEditId(null);
  };

  const closeModal = () => {
    setShowModal(false);
    resetForm();
  };

  // ---------------------------
  // Fetch staff
  // ---------------------------
  const fetchStaff = async () => {
    try {
      const res = await axios.get(`${API}/staff`);
      setStaff(res.data || []);
    } catch (err) {
      console.error("FETCH STAFF ERROR:", err);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  // ---------------------------
  // Add / Update
  // ---------------------------
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        fullname,
        position,
        department,
        area,
        salary,
        ecola,

        postage,
        transportation,
        additional_target: additionalTarget,
        repairing,
        additional_monitoring: additionalMonitoring,
        motorcycle,
        other_deduction: otherDeduction,

        payroll_date: payrollDate,
        branch_id: branchId,

        // ✅ new fields saved to DB
        regularization_date: regularizationDate,
        motorcycle_loan: motorcycleLoan,
      };

      if (editId) {
        await axios.put(`${API}/staff/${editId}`, payload);
      } else {
        await axios.post(`${API}/staff`, payload);
      }

      await fetchStaff();
      closeModal();
    } catch (err) {
      console.error("SAVE STAFF ERROR:", err);
      alert(err.response?.data?.message || "Something went wrong!");
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------
  // Delete
  // ---------------------------
  const deleteStaff = async (id) => {
    const ok = window.confirm("Do you want to Delete this staff?");
    if (!ok) return;

    try {
      await axios.delete(`${API}/staff/${id}`);
      await fetchStaff();
    } catch (err) {
      console.error("DELETE STAFF ERROR:", err);
      alert("Failed to delete staff.");
    }
  };

  // ---------------------------
  // Edit
  // ---------------------------
  const editStaff = (item) => {
    setFullname(item.fullname || "");
    setPosition(item.position || "");
    setDepartment(item.department || "");
    setArea(item.area || "");
    setSalary(item.salary ?? "");
    setEcola(item.ecola ?? "");

    // ✅ important: load these too
    setBranchId(item.branch_id ?? "");
    setRegularizationDate(
      item.regularization_date ? String(item.regularization_date).split("T")[0] : ""
    );
    setMotorcycleLoan(item.motorcycle_loan ?? "");

    setPostage(item.postage ?? "");
    setTransportation(item.transportation ?? "");
    setAdditionalTarget(item.additional_target ?? "");
    setRepairing(item.repairing ?? "");
    setAdditionalMonitoring(item.additional_monitoring ?? "");
    setMotorcycle(item.motorcycle ?? "");
    setOtherDeduction(item.other_deduction ?? "");
    setPayrollDate(item.payroll_date ? String(item.payroll_date).split("T")[0] : "");

    setEditId(item.id);
    setShowModal(true);
  };

  // ---------------------------
  // Filter
  // ---------------------------
  const filteredStaff = staff.filter((item) => {
    const name = String(item.fullname || "").toLowerCase();
    const pos = String(item.position || "").toLowerCase();
    const q = search.toLowerCase();
    return name.includes(q) || pos.includes(q);
  });

  return (
    <div className="staff-container">
      <h2 className="staff-title">Staff Management</h2>

      {/* Open Modal */}
      <button
        className="open-modal-btn"
        onClick={() => {
          resetForm();
          setShowModal(true);
        }}
      >
        + Add Staff
      </button>

      {/* Search */}
      <div className="search-container">
        <input
          type="text"
          placeholder="Search by name or position..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input"
        />
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal large-modal">
            <h3>{editId ? "Edit Employee" : "Add Staff"}</h3>

            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-group">
                <label>Full Name</label>
                <input value={fullname} onChange={(e) => setFullname(e.target.value)} required />
              </div>

              <div className="form-group">
                <label>Branch ID</label>
                <input
                  type="number"
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  required
                  readOnly={!!location.state?.branchId}
                />
              </div>

              {/* ✅ new fields */}
              <div className="form-group">
                <label>Regularization Date</label>
                <input
                  type="date"
                  value={regularizationDate}
                  onChange={(e) => setRegularizationDate(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Motorcycle Loan</label>
                <input
                  type="number"
                  value={motorcycleLoan}
                  onChange={(e) => setMotorcycleLoan(e.target.value)}
                  placeholder="Motorcycle Loan"
                />
              </div>

              <div className="form-group">
                <label>Position</label>
                <input value={position} onChange={(e) => setPosition(e.target.value)} required />
              </div>

              <div className="form-group">
                <label>Department</label>
                <input value={department} onChange={(e) => setDepartment(e.target.value)} required />
              </div>

              <div className="form-group">
                <label>Area</label>
                <input value={area} onChange={(e) => setArea(e.target.value)} required />
              </div>

              <div className="form-group">
                <label>Salary</label>
                <input type="number" value={salary} onChange={(e) => setSalary(e.target.value)} required />
              </div>

              <div className="form-group">
                <label>Ecola</label>
                <input type="number" value={ecola} onChange={(e) => setEcola(e.target.value)} required />
              </div>

              <div className="form-group">
                <label>Postage Allowance</label>
                <input type="number" value={postage} onChange={(e) => setPostage(e.target.value)} />
              </div>

              <div className="form-group">
                <label>Transportation Allowance</label>
                <input type="number" value={transportation} onChange={(e) => setTransportation(e.target.value)} />
              </div>

              <div className="form-group">
                <label>Additional Target Allowance</label>
                <input type="number" value={additionalTarget} onChange={(e) => setAdditionalTarget(e.target.value)} />
              </div>

              <div className="form-group">
                <label>Repairing Allowance</label>
                <input type="number" value={repairing} onChange={(e) => setRepairing(e.target.value)} />
              </div>

              <div className="form-group">
                <label>Additional Monitoring Allowance</label>
                <input type="number" value={additionalMonitoring} onChange={(e) => setAdditionalMonitoring(e.target.value)} />
              </div>

              <div className="form-group">
                <label>Motorcycle Deduction</label>
                <input type="number" value={motorcycle} onChange={(e) => setMotorcycle(e.target.value)} />
              </div>

              <div className="form-group">
                <label>Other Deduction</label>
                <input type="number" value={otherDeduction} onChange={(e) => setOtherDeduction(e.target.value)} />
              </div>

              <div className="form-group">
                <label>Payroll Date</label>
                <input type="date" value={payrollDate} onChange={(e) => setPayrollDate(e.target.value)} />
              </div>

              <div className="modal-buttons">
                <button type="submit" className="save-btn" disabled={loading}>
                  {loading ? "Saving..." : editId ? "Update" : "Save"}
                </button>

                <button type="button" className="cancel-btn" onClick={closeModal}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="staff-table-wrapper">
        <table className="staff-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Full Name</th>
              <th>Position</th>
              <th>Department</th>
              <th>Area</th>
              <th>Salary</th>
              <th>Ecola</th>
              <th>Payroll Date</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {filteredStaff.map((item) => (
              <tr key={item.id}>
                <td>{item.id}</td>
                <td>{item.fullname}</td>
                <td>{item.position}</td>
                <td>{item.department}</td>
                <td>{item.area}</td>
                <td>₱ {Number(item.salary || 0).toLocaleString()}</td>
                <td>₱ {Number(item.ecola || 0).toLocaleString()}</td>
                <td>{item.payroll_date ? String(item.payroll_date).split("T")[0] : "-"}</td>
                <td className="action-cell">
                  <button className="edit-btn" onClick={() => editStaff(item)}>Edit</button>
                  <button className="delete-btn" onClick={() => deleteStaff(item.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Staff;
