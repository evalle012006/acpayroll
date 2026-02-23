import React, { useEffect, useMemo, useState } from "react";
import "../styles/Staff.css";
import api from "../api/axiosClient";

const readUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
};

const Staff = () => {
  const user = useMemo(() => readUser(), []);
  const isAdmin = String(user?.role || "").toLowerCase() === "admin";

  const [staff, setStaff] = useState([]);

  const [employeeNo, setEmployeeNo] = useState("");
  const [fullname, setFullname] = useState("");
  const [position, setPosition] = useState("");
  const [department, setDepartment] = useState("");
  const [area, setArea] = useState("");
  const [salary, setSalary] = useState("");
  const [ecola, setEcola] = useState("");
  const [branchId, setBranchId] = useState("");

  const [regularizationDate, setRegularizationDate] = useState("");
  const [motorcycleLoan, setMotorcycleLoan] = useState("");

  const [postage, setPostage] = useState("");
  const [transportation, setTransportation] = useState("");
  const [additionalTarget, setAdditionalTarget] = useState("");
  const [repairing, setRepairing] = useState("");
  const [additionalMonitoring, setAdditionalMonitoring] = useState("");
  const [motorcycle, setMotorcycle] = useState("");
  const [otherDeduction, setOtherDeduction] = useState("");

  const [editId, setEditId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/login";
  };

  const resetForm = () => {
    setEmployeeNo("");
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
    setEditId(null);
  };

  const closeModal = () => {
    setShowModal(false);
    resetForm();
  };

  const openCreate = () => {
    if (!isAdmin) return;
    resetForm();
    setShowModal(true);
  };

  const fetchStaff = async () => {
    try {
      const res = await api.get("/staff");
      setStaff(res.data || []);
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401) return logout();
      if (status === 403) return alert("Access denied.");
      console.error("FETCH STAFF ERROR:", err);
      alert(err?.response?.data?.message || "Failed to load staff");
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!user || !token) {
      window.location.href = "/login";
      return;
    }
    fetchStaff();
  }, []);

  useEffect(() => {
    if (!showModal) return;
    const onKeyDown = (e) => e.key === "Escape" && closeModal();
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [showModal]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isAdmin) return;

    setSaving(true);
    try {
      const payload = {
        employee_no: employeeNo || null,
        fullname,
        position,
        department,
        area,
        salary,
        ecola,
        branch_id: branchId,
        regularization_date: regularizationDate || null,
        motorcycle_loan: motorcycleLoan || 0,
        postage: postage || 0,
        transportation: transportation || 0,
        additional_target: additionalTarget || 0,
        repairing: repairing || 0,
        additional_monitoring: additionalMonitoring || 0,
        motorcycle: motorcycle || 0,
        other_deduction: otherDeduction || 0,
      };

      if (editId) await api.put(`/staff/${editId}`, payload);
      else await api.post(`/staff`, payload);

      await fetchStaff();
      closeModal();
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401) return logout();
      if (status === 403) return alert("Access denied.");
      alert(err?.response?.data?.message || "Something went wrong!");
    } finally {
      setSaving(false);
    }
  };

  const deleteStaff = async (id) => {
    if (!isAdmin) return;
    if (!window.confirm("Do you want to delete this staff?")) return;

    try {
      await api.delete(`/staff/${id}`);
      await fetchStaff();
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401) return logout();
      if (status === 403) return alert("Access denied.");
      alert(err?.response?.data?.message || "Failed to delete staff.");
    }
  };

  const editStaff = (item) => {
    if (!isAdmin) return;

    setEmployeeNo(item.employee_no || "");
    setFullname(item.fullname || "");
    setPosition(item.position || "");
    setDepartment(item.department || "");
    setArea(item.area || "");
    setSalary(item.salary ?? "");
    setEcola(item.ecola ?? "");
    setBranchId(item.branch_id ?? "");

    setRegularizationDate(item.regularization_date ? String(item.regularization_date).split("T")[0] : "");
    setMotorcycleLoan(item.motorcycle_loan ?? "");

    setPostage(item.postage ?? "");
    setTransportation(item.transportation ?? "");
    setAdditionalTarget(item.additional_target ?? "");
    setRepairing(item.repairing ?? "");
    setAdditionalMonitoring(item.additional_monitoring ?? "");
    setMotorcycle(item.motorcycle ?? "");
    setOtherDeduction(item.other_deduction ?? "");

    setEditId(item.id);
    setShowModal(true);
  };

  const filteredStaff = useMemo(() => {
    const q = String(search || "").toLowerCase().trim();
    if (!q) return staff;

    return staff.filter((item) => {
      const emp = String(item.employee_no || "").toLowerCase();
      const name = String(item.fullname || "").toLowerCase();
      const pos = String(item.position || "").toLowerCase();
      return emp.includes(q) || name.includes(q) || pos.includes(q);
    });
  }, [staff, search]);

  return (
    <div className="staff-page">
      <div className="staff-page-header">
        <div>
          <h2 className="staff-title">Staff</h2>
          <p className="staff-subtitle">Manage employees, allowances, and deductions</p>
        </div>

        <div className="staff-actions">
          <div className="staff-search">
            <input
              type="text"
              placeholder="Search employee id, name, or position..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="search-input"
            />
          </div>

          {isAdmin && (
            <button className="open-modal-btn" onClick={openCreate} type="button">
              + Add Staff
            </button>
          )}
        </div>
      </div>

      <div className="staff-card">
        <div className="staff-card-header">
          <div className="staff-card-title">
            Employees <span className="staff-count">{filteredStaff.length}</span>
          </div>
        </div>

        <div className="staff-table-wrapper">
          <table className="staff-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Employee No</th>
                <th>Full Name</th>
                <th>Position</th>
                <th>Department</th>
                <th>Area</th>
                <th>Salary</th>
                <th>Ecola</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredStaff.map((item) => (
                <tr key={item.id}>
                  <td>{item.id}</td>
                  <td>{item.employee_no || "-"}</td>
                  <td className="td-strong">{item.fullname}</td>
                  <td>{item.position}</td>
                  <td>{item.department}</td>
                  <td>{item.area}</td>
                  <td>₱ {Number(item.salary || 0).toLocaleString()}</td>
                  <td>₱ {Number(item.ecola || 0).toLocaleString()}</td>

                  <td className="action-cell">
                    {isAdmin ? (
                      <>
                        <button className="edit-btn" onClick={() => editStaff(item)} type="button">
                          Edit
                        </button>
                        <button className="delete-btn" onClick={() => deleteStaff(item.id)} type="button">
                          Delete
                        </button>
                      </>
                    ) : (
                      <span className="muted">View only</span>
                    )}
                  </td>
                </tr>
              ))}

              {filteredStaff.length === 0 && (
                <tr>
                  <td colSpan={9} className="empty-state">
                    No staff found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isAdmin && showModal && (
        <div
          className="modal-overlay"
          onMouseDown={(e) => e.target.classList.contains("modal-overlay") && closeModal()}
        >
          <div className="modal modal-saas" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h3 className="modal-title">{editId ? "Edit Staff" : "Add Staff"}</h3>
                <p className="modal-subtitle">Fill in employee details and payroll setup</p>
              </div>

              <button className="modal-x" type="button" onClick={closeModal} aria-label="Close">
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="modal-form">
              <div className="modal-grid">
                <div className="form-group">
                  <label>Employee No</label>
                  <input value={employeeNo} onChange={(e) => setEmployeeNo(e.target.value)} placeholder="e.g. EMP-0001" />
                </div>

                <div className="form-group">
                  <label>Full Name</label>
                  <input value={fullname} onChange={(e) => setFullname(e.target.value)} required />
                </div>

                <div className="form-group">
                  <label>Branch ID</label>
                  <input type="number" value={branchId} onChange={(e) => setBranchId(e.target.value)} required />
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
                  <label>Regularization Date</label>
                  <input type="date" value={regularizationDate} onChange={(e) => setRegularizationDate(e.target.value)} />
                </div>

                <div className="form-group">
                  <label>Motorcycle Loan</label>
                  <input type="number" value={motorcycleLoan} onChange={(e) => setMotorcycleLoan(e.target.value)} placeholder="0" />
                </div>
              </div>

              <div className="modal-divider" />

              <div className="modal-grid">
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
              </div>

              <div className="modal-buttons">
                <button type="button" className="btn-secondary" onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? "Saving..." : editId ? "Update Staff" : "Save Staff"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Staff;