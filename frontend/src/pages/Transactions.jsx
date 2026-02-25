import React from "react";
import { useNavigate } from "react-router-dom";
import "../styles/Transactions.css";

export default function Transactions() {
  const navigate = useNavigate();

  const go = (path) => navigate(path);

  return (
    <div className="transactions-page">
      <div className="transactions-page-header">
        <div>
          <h2 className="transactions-title">Transactions</h2>
          <p className="transactions-subtitle">
            Choose an order type to create and manage transactions.
          </p>
        </div>
      </div>

      <div className="transactions-grid">
        <button
          type="button"
          className="transactions-card"
          onClick={() => go("/transactions/transfer")}
        >
          <div className="transactions-card-head">
            <div>
              <div className="transactions-card-title">Transfer Staff Order</div>
              <div className="transactions-card-meta">
                Move staff to another branch/area.
              </div>
            </div>
            <span className="transactions-pill">Open</span>
          </div>

          <div className="transactions-card-body">
            <p className="transactions-mini">
              Create transfer orders with effective date and remarks.
            </p>
            <div className="transactions-actions">
              <span className="transactions-link">Proceed →</span>
            </div>
          </div>
        </button>

        <button
          type="button"
          className="transactions-card"
          onClick={() => go("/transactions/promotion")}
        >
          <div className="transactions-card-head">
            <div>
              <div className="transactions-card-title">Promotion Order</div>
              <div className="transactions-card-meta">
                Change position and/or salary upward.
              </div>
            </div>
            <span className="transactions-pill">Open</span>
          </div>

          <div className="transactions-card-body">
            <p className="transactions-mini">
              Record promotions, new role/position, and approvals.
            </p>
            <div className="transactions-actions">
              <span className="transactions-link">Proceed →</span>
            </div>
          </div>
        </button>

        <button
          type="button"
          className="transactions-card"
          onClick={() => go("/transactions/demotion")}
        >
          <div className="transactions-card-head">
            <div>
              <div className="transactions-card-title">Demotion Order</div>
              <div className="transactions-card-meta">
                Adjust role/position downward.
              </div>
            </div>
            <span className="transactions-pill">Open</span>
          </div>

          <div className="transactions-card-body">
            <p className="transactions-mini">
              Create demotion orders with reason and effective date.
            </p>
            <div className="transactions-actions">
              <span className="transactions-link">Proceed →</span>
            </div>
          </div>
        </button>

        <button
          type="button"
          className="transactions-card"
          onClick={() => go("/transactions/suspension")}
        >
          <div className="transactions-card-head">
            <div>
              <div className="transactions-card-title">Suspension Order</div>
              <div className="transactions-card-meta">
                Temporarily suspend staff work status.
              </div>
            </div>
            <span className="transactions-pill">Open</span>
          </div>

          <div className="transactions-card-body">
            <p className="transactions-mini">
              Record suspension duration, reason, and status.
            </p>
            <div className="transactions-actions">
              <span className="transactions-link">Proceed →</span>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}