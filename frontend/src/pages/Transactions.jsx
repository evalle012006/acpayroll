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
          <h2 className="transactions-title">Admin Orders</h2>
          <p className="transactions-subtitle">
            Choose an order type to create and manage transactions.
          </p>
        </div>
      </div>

      <div className="transactions-grid">
        <button type="button" className="transactions-card" onClick={() => go("/transactions/transfer")}>
          <div className="transactions-card-head">
            <div>
              <div className="transactions-card-title">Transfer Staff Order</div>
              <div className="transactions-card-meta">Move staff to another branch/area.</div>
            </div>
            <span className="transactions-pill">Open</span>
          </div>

          <div className="transactions-card-body">
            <p className="transactions-mini">Create transfer orders with effective date and remarks.</p>
            <div className="transactions-actions">
              <span className="transactions-link">Proceed →</span>
            </div>
          </div>
        </button>

        <button type="button" className="transactions-card" onClick={() => go("/transactions/leave")}>
          <div className="transactions-card-head">
            <div>
              <div className="transactions-card-title">Leave Requests</div>
              <div className="transactions-card-meta">Create and manage leave requests.</div>
            </div>
            <span className="transactions-pill">Open</span>
          </div>

          <div className="transactions-card-body">
            <p className="transactions-mini">Submit leave requests (pending/approved/rejected).</p>
            <div className="transactions-actions">
              <span className="transactions-link">Proceed →</span>
            </div>
          </div>
        </button>

        <button type="button" className="transactions-card" onClick={() => go("/transactions/promotion")}>
          <div className="transactions-card-head">
            <div>
              <div className="transactions-card-title">Promotion Order</div>
              <div className="transactions-card-meta">Change position and/or salary upward.</div>
            </div>
            <span className="transactions-pill">Open</span>
          </div>

          <div className="transactions-card-body">
            <p className="transactions-mini">Record promotions, new role/position, and approvals.</p>
            <div className="transactions-actions">
              <span className="transactions-link">Proceed →</span>
            </div>
          </div>
        </button>

        <button type="button" className="transactions-card" onClick={() => go("/transactions/demotion")}>
          <div className="transactions-card-head">
            <div>
              <div className="transactions-card-title">Demotion Order</div>
              <div className="transactions-card-meta">Adjust role/position downward.</div>
            </div>
            <span className="transactions-pill">Open</span>
          </div>

          <div className="transactions-card-body">
            <p className="transactions-mini">Create demotion orders with reason and effective date.</p>
            <div className="transactions-actions">
              <span className="transactions-link">Proceed →</span>
            </div>
          </div>
        </button>

        <button type="button" className="transactions-card" onClick={() => go("/transactions/deployment")}>
          <div className="transactions-card-head">
            <div>
              <div className="transactions-card-title">Deployment Order</div>
              <div className="transactions-card-meta">Staff newly Hired and Service Recommence.</div>
            </div>
            <span className="transactions-pill">Open</span>
          </div>

          <div className="transactions-card-body">
            <p className="transactions-mini">Deploy Staff to other Branches.</p>
            <div className="transactions-actions">
              <span className="transactions-link">Proceed →</span>
            </div>
          </div>
        </button>

        <button type="button" className="transactions-card" onClick={() => go("/transactions/suspension")}>
          <div className="transactions-card-head">
            <div>
              <div className="transactions-card-title">Suspension Order</div>
              <div className="transactions-card-meta">Temporarily suspend staff work status.</div>
            </div>
            <span className="transactions-pill">Open</span>
          </div>

          <div className="transactions-card-body">
            <p className="transactions-mini">Record suspension duration, reason, and status.</p>
            <div className="transactions-actions">
              <span className="transactions-link">Proceed →</span>
            </div>
          </div>
        </button>

        <button type="button" className="transactions-card" onClick={() => go("/transactions/soa")}>
          <div className="transactions-card-head">
            <div>
              <div className="transactions-card-title">Statement of Accounts</div>
              <div className="transactions-card-meta">Register Exit Staff Last Pay / Liabilities.</div>
            </div>
            <span className="transactions-pill">Open</span>
          </div>

          <div className="transactions-card-body">
            <p className="transactions-mini">Calculate staff account liabilities, last pay, and other income.</p>
            <div className="transactions-actions">
              <span className="transactions-link">Proceed →</span>
            </div>
          </div>
        </button>

        <button type="button" className="transactions-card" onClick={() => go("/transactions/exit")}>
          <div className="transactions-card-head">
            <div>
              <div className="transactions-card-title">Exit Staff</div>
              <div className="transactions-card-meta">Process employee resignation or termination.</div>
            </div>
            <span className="transactions-pill">Open</span>
          </div>

          <div className="transactions-card-body">
            <p className="transactions-mini">Record exit date, clearance status, and final remarks.</p>
            <div className="transactions-actions">
              <span className="transactions-link">Proceed →</span>
            </div>
          </div>
        </button>

        <button type="button" className="transactions-card" onClick={() => go("/transactions/sbf")}>
          <div className="transactions-card-head">
            <div>
              <div className="transactions-card-title">SBF Order</div>
              <div className="transactions-card-meta">Staff Benevolent Fund assistance request.</div>
            </div>
            <span className="transactions-pill">Open</span>
          </div>

          <div className="transactions-card-body">
            <p className="transactions-mini">Create and manage Staff Benevolent Fund orders and approvals.</p>
            <div className="transactions-actions">
              <span className="transactions-link">Proceed →</span>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}