import React from "react";
import { useNavigate } from "react-router-dom";
import "../styles/SystemUpdate.css";

export default function SystemUpdate() {
  const navigate = useNavigate();
  const go = (path) => navigate(path);

  return (
    <div className="sys-page">
      <div className="sys-header">
        <div>
          <h2 className="sys-title">System Configuration</h2>
          <p className="sys-subtitle">
            Manage global system rules and computation settings.
          </p>
        </div>
      </div>

      <div className="sys-grid">

        <button type="button" className="sys-card" onClick={() => go("/system-update/rates")}>
          <div className="sys-card-head">
            <div>
              <div className="sys-card-title">Salary & Allowance Rates</div>
              <div className="sys-card-meta">
                Configure salary, ECOLA, and transportation defaults.
              </div>
            </div>
            <span className="sys-pill">Manage</span>
          </div>

          <div className="sys-card-body">
            <p className="sys-mini">
              Update compensation rules used across payroll and computations.
            </p>
            <div className="sys-actions">
              <span className="sys-link">Open →</span>
            </div>
          </div>
        </button>

        <button
          type="button"
          className="sys-card"
          onClick={() => go("/system-update/overtime")}
        >
          <div className="sys-card-head">
            <div>
              <div className="sys-card-title">Area Configurations</div>
              <div className="sys-card-meta">
                Area / Region / Division Configuration.
              </div>
            </div>
            <span className="sys-pill">Soon</span>
          </div>

          <div className="sys-card-body">
            <p className="sys-mini">
              Manage overtime rates and computation logic.
            </p>
            <div className="sys-actions">
              <span className="sys-link">Coming Soon</span>
            </div>
          </div>
        </button>

      </div>
    </div>
  );
}