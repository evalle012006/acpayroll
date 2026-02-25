import React from "react";
import { useNavigate } from "react-router-dom";
import "../styles/TransferStaffOrder.css";

export default function PromotionOrder() {
  const navigate = useNavigate();
  return (
    <div className="saas-page">
      <div className="saas-header">
        <div className="saas-title">
          <h2>Promotion Order</h2>
          <p>Create/record promotion orders.</p>
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