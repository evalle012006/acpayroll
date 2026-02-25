import React from "react";
import { useNavigate } from "react-router-dom";

export default function SuspensionOrder() {
  const navigate = useNavigate();
  return (
    <div className="saas-page">
      <div className="saas-header">
        <div className="saas-title">
          <h2>Suspension Order</h2>
          <p>Create/record suspension orders.</p>
        </div>
        <button className="btn btn-outline" onClick={() => navigate(-1)} type="button">
          ← Back
        </button>
        
      </div>

      <div className="card" style={{ padding: 16 }}>
        Coming soon…
      </div>
    </div>
  );
}