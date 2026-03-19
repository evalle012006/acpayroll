import React, { useState, useEffect, useCallback } from "react";
import AddBranchModal from "../components/AddBranchModal";
import api from "../api/axiosClient";
import "../styles/Branch.css";

const Branch = () => {
  const [branches, setBranches] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchBranches = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const res = await api.get("/branches");
      setBranches(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to fetch branches:", err);
      setError("Failed to load branches.");
      setBranches([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  const handleView = (branch) => {
    alert(
      `Code: ${branch.code || ""}\nName: ${branch.name || ""}\nArea: ${branch.area || ""}`
    );
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="branch-container">
      <div className="branch-header">
        <h2>Branch Management</h2>
        <button className="add-btn" onClick={() => setShowModal(true)}>
          + Add Branch
        </button>
      </div>

      {loading && <p>Loading branches...</p>}
      {error && <p className="error-text">{error}</p>}

      {!loading && !error && (
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
            {branches.length > 0 ? (
              branches.map((branch) => (
                <tr key={branch.id}>
                  <td>{branch.code}</td>
                  <td>{branch.name}</td>
                  <td>{branch.area}</td>
                  <td>
                    <button onClick={() => handleView(branch)}>View</button>
                    <button onClick={handlePrint}>Print</button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4">No branches found.</td>
              </tr>
            )}
          </tbody>
        </table>
      )}

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