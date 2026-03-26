import React from "react";
import { useNavigate } from "react-router-dom";
import "../styles/SystemRates.css";
import "../styles/DetailsCompensation.css";

const bmAbmRows = [
  {
    role: "BM",
    clients: "1200 up W/ 7 LO,s",
    transportation: 3000,
    repairing: 1500,
    monitoring: 3500,
    incentive: 5000,
    total: 13000,
  },
  {
    role: "BM",
    clients: "1200 below W/ 5 LO,s",
    transportation: 3000,
    repairing: 1500,
    monitoring: 3500,
    incentive: 0,
    total: 8000,
  },
  {
    role: "ABM",
    clients: "1200 Up W/ 6 LO,s",
    transportation: 3500,
    repairing: 1500,
    monitoring: 3000,
    incentive: 1200,
    total: 9200,
  },
  {
    role: "ABM",
    clients: "1200 below W/ 5 LO,s",
    transportation: 3000,
    repairing: 1500,
    monitoring: 3500,
    incentive: 0,
    total: 8000,
  },
];

const dailyRows = [
  { range: "0-60", transportation: 700, repairing: 500, incentive: 0, total: 1200 },
  { range: "61-99", transportation: 1000, repairing: 500, incentive: 0, total: 1500 },
  { range: "100-130", transportation: 1500, repairing: 500, incentive: 0, total: 2000 },
  { range: "131-159", transportation: 2000, repairing: 500, incentive: 0, total: 2500 },
  { range: "160-179", transportation: 2000, repairing: 1000, incentive: 500, total: 3500 },
  { range: "180-200", transportation: 2000, repairing: 1000, incentive: 1000, total: 4000 },
  { range: "201-209", transportation: 3500, repairing: 1000, incentive: 1000, total: 5500 },
  { range: "210- up", transportation: 3500, repairing: 1000, incentive: 3000, total: 7500 },
];

const weeklyRows = [
  { range: "0-100", transportation: 1700, repairing: 1000, incentive: 0, total: 2700 },
  { range: "101-199", transportation: 2200, repairing: 1000, incentive: 0, total: 3200 },
  { range: "200-299", transportation: 2500, repairing: 1000, incentive: 0, total: 3500 },
  { range: "300-349", transportation: 3000, repairing: 1000, incentive: 0, total: 4000 },
  { range: "350-400", transportation: 4000, repairing: 1000, incentive: 1500, total: 6500 },
  { range: "401-450", transportation: 4500, repairing: 1000, incentive: 2000, total: 7500 },
];

const salaryRows = [
  { role: "BM", basic: 30000, ecola: 5000, total: 35000 },
  { role: "ABM", basic: 18000, ecola: 2000, total: 20000 },
  { role: "LO Regular", basic: 18000, ecola: 2000, total: 20000 },
  { role: "LO Regular Non-Target", basic: 0, ecola: 0, total: 0, textTotal: "-" },
  { role: "LO Probationary", basic: 13000, ecola: 2000, total: 15000 },
];

const peso = (n) =>
  Number(n || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

export default function DetailsCompensation() {
  const navigate = useNavigate();

  return (
    <div className="sys-page">
      <div className="sys-header">
        <div>
          <h2 className="sys-title">Details & Compensation</h2>
          <p className="sys-subtitle">
            Transportation computation and salary reference based on handled clients.
          </p>
        </div>

        <button
          className="btn-secondary"
          onClick={() => navigate("/system-update")}
          type="button"
        >
          ← Back
        </button>
      </div>

      <div className="sys-card">
        <div className="sys-card-head">
          <div>
            <div className="sys-card-title">Transportation Computation</div>
            <div className="sys-card-meta">Based on number of clients</div>
          </div>
        </div>

        <div className="sys-modal-body">
          {/* BM / ABM */}
          <div className="dc-block">
            <div className="dc-table-wrap">
              <table className="dc-table">
                <thead>
                  <tr>
                    <th>Position</th>
                    <th>No. of Client</th>
                    <th>Transportation Allowance</th>
                    <th>Repairing Maintenance</th>
                    <th>Monitoring Allowance</th>
                    <th>Incentives Reaching Required No. of Client</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {bmAbmRows.map((row, idx) => (
                    <tr key={`${row.role}-${idx}`}>
                      <td className="dc-strong">{row.role}</td>
                      <td>{row.clients}</td>
                      <td>₱ {peso(row.transportation)}</td>
                      <td>₱ {peso(row.repairing)}</td>
                      <td>₱ {peso(row.monitoring)}</td>
                      <td>{row.incentive ? `₱ ${peso(row.incentive)}` : "-"}</td>
                      <td className="dc-total">₱ {peso(row.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* DAILY */}
          <div className="dc-section-title">Daily Transaction</div>
          <div className="dc-block">
            <div className="dc-table-wrap">
              <table className="dc-table">
                <thead>
                  <tr>
                    <th>Position</th>
                    <th>Range</th>
                    <th>Transportation Allowance</th>
                    <th>Repairing Maintenance</th>
                    <th>Incentives</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyRows.map((row, idx) => (
                    <tr key={`daily-${idx}`}>
                      <td className="dc-strong">{idx === 0 ? "LO" : ""}</td>
                      <td>{row.range}</td>
                      <td>₱ {peso(row.transportation)}</td>
                      <td>₱ {peso(row.repairing)}</td>
                      <td>{row.incentive ? `₱ ${peso(row.incentive)}` : "-"}</td>
                      <td className="dc-total">₱ {peso(row.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* WEEKLY */}
          <div className="dc-section-title">Weekly Transaction</div>
          <div className="dc-block">
            <div className="dc-table-wrap">
              <table className="dc-table">
                <thead>
                  <tr>
                    <th>Position</th>
                    <th>Range</th>
                    <th>Transportation Allowance</th>
                    <th>Repairing Maintenance</th>
                    <th>Incentives</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {weeklyRows.map((row, idx) => (
                    <tr key={`weekly-${idx}`}>
                      <td className="dc-strong">{idx === 0 ? "LO" : ""}</td>
                      <td>{row.range}</td>
                      <td>₱ {peso(row.transportation)}</td>
                      <td>₱ {peso(row.repairing)}</td>
                      <td>{row.incentive ? `₱ ${peso(row.incentive)}` : "-"}</td>
                      <td className="dc-total">₱ {peso(row.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* SALARIES */}
          <div className="dc-section-title">Salaries & Wages</div>
          <div className="dc-block">
            <div className="dc-table-wrap">
              <table className="dc-table dc-table-small">
                <thead>
                  <tr>
                    <th>Position</th>
                    <th>Basic Salary</th>
                    <th>Ecola</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {salaryRows.map((row) => (
                    <tr key={row.role}>
                      <td className="dc-strong">{row.role}</td>
                      <td>{row.basic ? `₱ ${peso(row.basic)}` : "-"}</td>
                      <td>{row.ecola ? `₱ ${peso(row.ecola)}` : "-"}</td>
                      <td className="dc-total">
                        {row.textTotal ? row.textTotal : `₱ ${peso(row.total)}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="sys-note" style={{ paddingLeft: 0 }}>
            Note: This is currently a fixed reference setup in the frontend. The next step is to
            move these values into database tables so you can edit them from the system.
          </div>
        </div>
      </div>
    </div>
  );
}