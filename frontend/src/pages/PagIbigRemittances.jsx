import React, { useMemo, useState } from "react";
import "../styles/PagIbigRemittances.css";

const SAMPLE_ROWS = [
  {
    id: 1,
    employee_no: "000666",
    employee_name: "DOMINGO, JOHNSON SANTA",
    position: "BRANCH MANAGER",
    hdmf: 200,
    sss: 900,
    philhealth: 450,
    tax: 300,
    contribution: 1850,
    status: "Pending",
  },
  {
    id: 2,
    employee_no: "000667",
    employee_name: "DELA CRUZ, JUAN",
    position: "LOAN OFFICER",
    hdmf: 200,
    sss: 850,
    philhealth: 450,
    tax: 250,
    contribution: 1750,
    status: "Remitted",
  },
];

const money = (value) =>
  Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function PagIbigRemittances() {
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7)
  );

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [rows, setRows] = useState(SAMPLE_ROWS);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();

    return rows.filter((row) => {
      const matchesSearch =
        !q ||
        String(row.employee_no || "")
          .toLowerCase()
          .includes(q) ||
        String(row.employee_name || "")
          .toLowerCase()
          .includes(q) ||
        String(row.position || "")
          .toLowerCase()
          .includes(q);

      const matchesStatus =
        statusFilter === "all" ||
        String(row.status || "").toLowerCase() ===
          statusFilter.toLowerCase();

      return matchesSearch && matchesStatus;
    });
  }, [rows, search, statusFilter]);

  const totals = useMemo(() => {
    return filteredRows.reduce(
      (acc, row) => {
        acc.hdmf += Number(row.hdmf || 0);
        acc.sss += Number(row.sss || 0);
        acc.philhealth += Number(row.philhealth || 0);
        acc.tax += Number(row.tax || 0);
        acc.contribution += Number(row.contribution || 0);

        return acc;
      },
      {
        hdmf: 0,
        sss: 0,
        philhealth: 0,
        tax: 0,
        contribution: 0,
      }
    );
  }, [filteredRows]);

  const markAsRemitted = (id) => {
    setRows((prev) =>
      prev.map((row) =>
        row.id === id
          ? {
              ...row,
              status: "Remitted",
            }
          : row
      )
    );
  };

  const exportExcel = () => {
    alert(
      "Excel export will be connected after we finish the backend/database."
    );
  };

  return (
    <div className="pgr-page">
      <div className="pgr-header">
        <div>
          <h2 className="pgr-title">Pag-IBIG Remittances</h2>
          <p className="pgr-subtitle">
            Monthly employee government contributions and remittance records.
          </p>
        </div>

        <button
          type="button"
          className="pgr-export-btn"
          onClick={exportExcel}
        >
          Export Excel
        </button>
      </div>

      <div className="pgr-filter-card">
        <div className="pgr-filter-group">
          <label>Month</label>

          <input
            type="month"
            value={selectedMonth}
            onChange={(e) =>
              setSelectedMonth(e.target.value)
            }
          />
        </div>

        <div className="pgr-filter-group pgr-filter-grow">
          <label>Search</label>

          <input
            type="text"
            placeholder="Search employee no, employee name, or position..."
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
          />
        </div>

        <div className="pgr-filter-group">
          <label>Status</label>

          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value)
            }
          >
            <option value="all">
              All Status
            </option>

            <option value="Pending">
              Pending
            </option>

            <option value="Remitted">
              Remitted
            </option>
          </select>
        </div>
      </div>

      <div className="pgr-card">
        <div className="pgr-card-head">
          <div>
            <h3>Monthly Remittance Records</h3>

            <span>
              Month: {selectedMonth}
            </span>
          </div>

          <div className="pgr-count">
            Showing {filteredRows.length} of {rows.length}
          </div>
        </div>

        <div className="pgr-table-wrap">
          <table className="pgr-table">
            <thead>
              <tr>
                <th>Employee No.</th>
                <th>Employee Name</th>
                <th>Position</th>
                <th>HDMF</th>
                <th>SSS</th>
                <th>PhilHealth</th>
                <th>Tax</th>
                <th>Contribution</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="pgr-empty"
                  >
                    No remittance records found.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.employee_no}</td>

                    <td className="pgr-name">
                      {row.employee_name}
                    </td>

                    <td>{row.position}</td>

                    <td className="pgr-num">
                      ₱{money(row.hdmf)}
                    </td>

                    <td className="pgr-num">
                      ₱{money(row.sss)}
                    </td>

                    <td className="pgr-num">
                      ₱{money(row.philhealth)}
                    </td>

                    <td className="pgr-num">
                      ₱{money(row.tax)}
                    </td>

                    <td className="pgr-num pgr-strong">
                      ₱{money(row.contribution)}
                    </td>

                    <td>
                      <span
                        className={`pgr-status ${
                          String(
                            row.status
                          ).toLowerCase() ===
                          "remitted"
                            ? "remitted"
                            : "pending"
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>

                    <td>
                      {String(
                        row.status
                      ).toLowerCase() ===
                      "remitted" ? (
                        <button
                          type="button"
                          className="pgr-action-btn disabled"
                          disabled
                        >
                          Remitted
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="pgr-action-btn"
                          onClick={() =>
                            markAsRemitted(
                              row.id
                            )
                          }
                        >
                          Mark Remitted
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>

            <tfoot>
              <tr>
                <td colSpan={3}>
                  TOTAL
                </td>

                <td className="pgr-num">
                  ₱{money(totals.hdmf)}
                </td>

                <td className="pgr-num">
                  ₱{money(totals.sss)}
                </td>

                <td className="pgr-num">
                  ₱{money(
                    totals.philhealth
                  )}
                </td>

                <td className="pgr-num">
                  ₱{money(totals.tax)}
                </td>

                <td className="pgr-num pgr-strong">
                  ₱{money(
                    totals.contribution
                  )}
                </td>

                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}