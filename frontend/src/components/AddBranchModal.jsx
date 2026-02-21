import React, { useState, useEffect } from "react";
import axios from "axios";
import AddBranchModal from "../components/AddBranchModal";
import "../styles/Branch.css";

const Branch = () => {
  const [branches, setBranches] = useState([]);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetchBranches();
  }, []);

  const fetchBranches = async () => {
    const res = await axios.get("http://localhost:5000/branches");
    setBranches(res.data);
  };

  const handleView = (branch) => {
    alert(
      `Code: ${branch.code}\nName: ${branch.name}\nArea: ${branch.area}`
    );
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="branch-container">
      <div className="branch-header">
        <h2>Branch Management</h2>
        <button
          className="add-btn"
          onClick={() => setShowModal(true)}
        >
          + Add Branch
        </button>
      </div>

      <table className="branch-table">
        <thead>
          <tr>
            <th>Branch Code</th>
            <th>Branch Name</th>
            <th>Area</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {branches.map((branch) => (
            <tr key={branch.id}>
              <td>{branch.code}</td>
              <td>{branch.name}</td>
              <td>{branch.area}</td>
              <td>
                <button onClick={() => handleView(branch)}>View</button>
                <button onClick={handlePrint}>Print</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {showModal && (
        <AddBranchModal
          onClose={() => setShowModal(false)}
          onSuccess={fetchBranches}
        />
      )}
    </div>
  );
};

export default Branch;
