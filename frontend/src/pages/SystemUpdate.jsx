import React from "react";
import { useNavigate } from "react-router-dom";
import "../styles/SystemUpdate.css";

export default function SystemUpdate() {
  const navigate = useNavigate();

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
        <button
          type="button"
          className="sys-card"
          onClick={() => navigate("/system-update/rates")}
        >
          <div className="sys-card-head">
            <div>
              <div className="sys-card-title">Salary & Allowance Rates</div>
              <div className="sys-card-meta">
                Configure salary, ECOLA, and allowance defaults.
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
          onClick={() => navigate("/system-update/area-configurations")}
        >
          <div className="sys-card-head">
            <div>
              <div className="sys-card-title">Area Configurations</div>
              <div className="sys-card-meta">
                Manage Area / Region / Division configuration.
              </div>
            </div>
            <span className="sys-pill">Manage</span>
          </div>

          <div className="sys-card-body">
            <p className="sys-mini">
              Create and maintain area, region, and division setup used by the system.
            </p>
            <div className="sys-actions">
              <span className="sys-link">Open →</span>
            </div>
          </div>
        </button>

        <button
          type="button"
          className="sys-card"
          onClick={() => navigate("/system-update/consolidation")}
        >
          <div className="sys-card-head">
            <div>
              <div className="sys-card-title">2316 Consolidation</div>
              <div className="sys-card-meta">
                Manage annual 2316 setup and consolidation records.
              </div>
            </div>
            <span className="sys-pill">Manage</span>
          </div>

          <div className="sys-card-body">
            <p className="sys-mini">
              Create, update, and maintain 2316 consolidation data used for annual tax reporting.
            </p>
            <div className="sys-actions">
              <span className="sys-link">Open →</span>
            </div>
          </div>
        </button>

        <button
          type="button"
          className="sys-card"
          onClick={() => navigate("/system-update/details-compensation")}
        >
          <div className="sys-card-head">
            <div>
              <div className="sys-card-title">Details & Compensation</div>
              <div className="sys-card-meta">
                Transportation Computations
              </div>
            </div>
            <span className="sys-pill">Manage</span>
          </div>

          <div className="sys-card-body">
            <p className="sys-mini">
              Computations of Loan Officer and Branch Manager transportation based on number of clients.
            </p>
            <div className="sys-actions">
              <span className="sys-link">Open →</span>
            </div>
          </div>
        </button>

        <button
          type="button"
          className="sys-card"
          onClick={() =>
            navigate("/system-update/pag-ibig-remittances")
          }
        >
          <div className="sys-card-head">
            <div>
              <div className="sys-card-title">
                Pag-IBIG Remittances
              </div>

              <div className="sys-card-meta">
                Manage employee Pag-IBIG contribution remittances.
              </div>
            </div>

            <span className="sys-pill">Manage</span>
          </div>

          <div className="sys-card-body">
            <p className="sys-mini">
              Create, review, and maintain employee and employer
              Pag-IBIG remittance records.
            </p>

            <div className="sys-actions">
              <span className="sys-link">
                Open →
              </span>
            </div>
          </div>
        </button>

        <button
          type="button"
          className="sys-card"
          onClick={() =>
            navigate("/system-update/pag-ibig-loan")
          }
        >
          <div className="sys-card-head">
            <div>
              <div className="sys-card-title">
                Pag-IBIG Loan
              </div>

              <div className="sys-card-meta">
                Manage Pag-IBIG loan setup and deductions.
              </div>
            </div>

            <span className="sys-pill">Manage</span>
          </div>

          <div className="sys-card-body">
            <p className="sys-mini">
              Configure employee Pag-IBIG loan balances,
              monthly deductions, and payment records.
            </p>

            <div className="sys-actions">
              <span className="sys-link">
                Open →
              </span>
            </div>
          </div>
        </button>

      </div>
    </div>
  );
}