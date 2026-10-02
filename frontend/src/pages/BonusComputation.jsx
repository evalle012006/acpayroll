import { useEffect, useMemo, useState } from "react";
import api from "../api/axiosClient";
import "../styles/BonusComputation.css";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const currentYear = new Date().getFullYear();

const money = (value) => {
  const amount = Number(value ?? 0);

  return amount.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const emptyMonths = () =>
  MONTHS.map((_, index) => ({
    month: index + 1,
    month_13: 0,
    month_14: 0,
    month_15: 0,
  }));

export default function BonusComputation() {
  const [year, setYear] = useState(currentYear);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("ALL");
  const [branch, setBranch] = useState("ALL");

  const [page, setPage] = useState(1);
  const pageSize = 25;

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("view");

  const [selectedStaff, setSelectedStaff] = useState(null);
  const [months, setMonths] = useState(emptyMonths());

  const [modalLoading, setModalLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  /* =========================================================
     LOAD MAIN TABLE
  ========================================================= */

  const loadRows = async () => {
    try {
      setLoading(true);

      const res = await api.get("/bonus-computations", {
        params: {
          year,
        },
      });

      setRows(
        Array.isArray(res.data?.rows)
          ? res.data.rows
          : []
      );
    } catch (err) {
      console.error(
        "Failed to load bonus computations:",
        err
      );

      alert(
        err?.response?.data?.message ||
          "Failed to load bonus computations."
      );

      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRows();
  }, [year]);

  /* =========================================================
     DEPARTMENTS
  ========================================================= */

  const departments = useMemo(() => {
    const values = rows
      .map((row) => String(row.department || "").trim())
      .filter(Boolean);

    return [...new Set(values)].sort((a, b) =>
      a.localeCompare(b)
    );
  }, [rows]);

  /* =========================================================
     FILTER TABLE
  ========================================================= */

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();

    return rows.filter((row) => {
      const rowDepartment = String(
        row.department || ""
      ).trim();

      const departmentMatch =
        department === "ALL" ||
        rowDepartment === department;

      const branchMatch =
        branch === "ALL" ||
        String(row.branch_id || "") === branch;

      if (!departmentMatch || !branchMatch) {
        return false;
      }

      if (!q) {
        return true;
      }

      const haystack = [
        row.employee_no,
        row.fullname,
        row.position,
        row.department,
      ]
        .map((value) =>
          String(value || "").toLowerCase()
        )
        .join(" ");

      return haystack.includes(q);
    });
  }, [rows, search, department, branch]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredRows.length / pageSize)
  );

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;

    return filteredRows.slice(start, end);
  }, [filteredRows, page]);

  const showingFrom =
    filteredRows.length === 0
      ? 0
      : (page - 1) * pageSize + 1;

  const showingTo = Math.min(
    page * pageSize,
    filteredRows.length
  );

  const branches = useMemo(() => {
    const departmentRows =
      department === "ALL"
        ? rows
        : rows.filter(
            (row) =>
              String(row.department || "").trim() ===
              department
          );

    const branchMap = new Map();

    departmentRows.forEach((row) => {
      if (!row.branch_id) return;

      branchMap.set(
        String(row.branch_id),
        row.branch_name || `Branch ${row.branch_id}`
      );
    });

    return [...branchMap.entries()]
      .map(([id, name]) => ({
        id,
        name,
      }))
      .sort((a, b) =>
        String(a.name).localeCompare(String(b.name))
      );
    }, [rows, department]);

    useEffect(() => {
      setBranch("ALL");
    }, [department]);

    useEffect(() => {
      setPage(1);
    }, [year, department, branch, search]);

    useEffect(() => {
      if (page > totalPages) {
        setPage(totalPages);
      }
    }, [page, totalPages]);
    /* =========================================================
      OPEN VIEW / EDIT MODAL
    ========================================================= */

  const openEmployee = async (row, mode) => {
    try {
      setModalMode(mode);
      setSelectedStaff(row);
      setMonths(emptyMonths());
      setModalOpen(true);
      setModalLoading(true);

      const res = await api.get(
        `/bonus-computations/staff/${row.staff_id}`,
        {
          params: {
            year,
          },
        }
      );

      if (res.data?.staff) {
        setSelectedStaff(res.data.staff);
      }

      if (Array.isArray(res.data?.months)) {
        setMonths(
          MONTHS.map((_, index) => {
            const monthNumber = index + 1;

            const saved = res.data.months.find(
              (item) =>
                Number(item.month) === monthNumber
            );

            return {
              month: monthNumber,
              month_13: Number(
                saved?.month_13 ?? 0
              ),
              month_14: Number(
                saved?.month_14 ?? 0
              ),
              month_15: Number(
                saved?.month_15 ?? 0
              ),
            };
          })
        );
      }
    } catch (err) {
      console.error(
        "Failed to load employee bonus:",
        err
      );

      alert(
        err?.response?.data?.message ||
          "Failed to load employee bonus computation."
      );

      setModalOpen(false);
    } finally {
      setModalLoading(false);
    }
  };

  /* =========================================================
     CLOSE MODAL
  ========================================================= */

  const closeModal = () => {
    if (saving) return;

    setModalOpen(false);
    setSelectedStaff(null);
    setMonths(emptyMonths());
    setModalMode("view");
  };

  /* =========================================================
     UPDATE MONTH INPUT
  ========================================================= */

  const updateMonth = (index, field, value) => {
    setMonths((prev) =>
      prev.map((item, i) =>
        i === index
          ? {
              ...item,
              [field]:
                value === ""
                  ? ""
                  : Number(value),
            }
          : item
      )
    );
  };

  /* =========================================================
     TOTALS
  ========================================================= */

  const totals = useMemo(() => {
    return months.reduce(
      (acc, item) => {
        acc.month_13 += Number(
          item.month_13 || 0
        );

        acc.month_14 += Number(
          item.month_14 || 0
        );

        acc.month_15 += Number(
          item.month_15 || 0
        );

        return acc;
      },
      {
        month_13: 0,
        month_14: 0,
        month_15: 0,
      }
    );
  }, [months]);

  /* =========================================================
     SAVE MONTHLY VALUES
  ========================================================= */

  const saveBonus = async () => {
    if (!selectedStaff?.staff_id) {
      return;
    }

    try {
      setSaving(true);

      await api.put(
        `/bonus-computations/staff/${selectedStaff.staff_id}`,
        {
          year,
          months: months.map((item) => ({
            month: item.month,

            month_13: Number(
              item.month_13 || 0
            ),

            month_14: Number(
              item.month_14 || 0
            ),

            month_15: Number(
              item.month_15 || 0
            ),
          })),
        }
      );

      alert("Bonus computation saved successfully.");

      await loadRows();

      setModalMode("view");
    } catch (err) {
      console.error(
        "Failed to save bonus computation:",
        err
      );

      alert(
        err?.response?.data?.message ||
          "Failed to save bonus computation."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bonus-comp-page">
      {/* HEADER */}

      <div className="bonus-comp-header">
        <div>
          <h1>Bonus Computations</h1>

          <p>
            Manage employee monthly 13th, 14th and
            15th month bonus computations.
          </p>
        </div>
      </div>

      {/* FILTERS */}

      <div className="bonus-comp-filters">
        <div className="bonus-filter">
          <label>Year</label>

          <select
            value={year}
            onChange={(e) =>
              setYear(Number(e.target.value))
            }
          >
            {Array.from(
              { length: 11 },
              (_, index) => currentYear - 5 + index
            ).map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        <div className="bonus-filter">
          <label>Department</label>

          <select
            value={department}
            onChange={(e) =>
              setDepartment(e.target.value)
            }
          >
            <option value="ALL">
              All Departments
            </option>

            {departments.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        <div className="bonus-filter">
          <label>Branch</label>

          <select
            value={branch}
            onChange={(e) =>
              setBranch(e.target.value)
            }
          >
            <option value="ALL">
              All Branches
            </option>

            {branches.map((item) => (
              <option
                key={item.id}
                value={item.id}
              >
                {item.name}
              </option>
            ))}
          </select>
        </div>

        <div className="bonus-filter bonus-search">
          <label>Search Employee</label>

          <input
            type="text"
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
            placeholder="Employee no., name or position..."
          />
        </div>
      </div>

      {/* MAIN TABLE */}

      <div className="bonus-comp-table-wrap">
        <table className="bonus-comp-table">
          <thead>
            <tr>
              <th>Department</th>
              <th>Employee No.</th>
              <th>Employee Name</th>
              <th>Position</th>
              <th className="num">Salary</th>
              <th className="num">ECOLA</th>
              <th className="num">Total Gross</th>
              <th className="num">Total Bonus {year}</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan="9"
                  className="bonus-empty"
                >
                  Loading bonus computations...
                </td>
              </tr>
            ) : filteredRows.length === 0 ? (
              <tr>
                <td
                  colSpan="9"
                  className="bonus-empty"
                >
                  No employees found.
                </td>
              </tr>
            ) : (
              paginatedRows.map((row) => (
                <tr key={row.staff_id}>
                  <td>
                    {row.department || "-"}
                  </td>

                  <td>
                    {row.employee_no || "-"}
                  </td>

                  <td className="employee-name">
                    {row.fullname || "-"}
                  </td>

                  <td>
                    {row.position || "-"}
                  </td>

                  <td className="num">
                    {money(row.salary)}
                  </td>

                  <td className="num">
                    {money(row.ecola)}
                  </td>

                  <td className="num">
                    {money(row.total_gross)}
                  </td>

                  <td className="num">
                    {money(
                      Number(row.month_13 || 0) +
                      Number(row.month_14 || 0) +
                      Number(row.month_15 || 0)
                    )}
                  </td>

                  <td>
                    <div className="bonus-actions">
                      <button
                        type="button"
                        className="bonus-btn view"
                        onClick={() =>
                          openEmployee(
                            row,
                            "view"
                          )
                        }
                      >
                        View
                      </button>

                      <button
                        type="button"
                        className="bonus-btn edit"
                        onClick={() =>
                          openEmployee(
                            row,
                            "edit"
                          )
                        }
                      >
                        Edit
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!loading && filteredRows.length > 0 && (
        <div className="bonus-pagination">
          <div className="bonus-pagination-info">
            Showing {showingFrom}–{showingTo} of{" "}
            {filteredRows.length} employees
          </div>

          <div className="bonus-pagination-actions">
            <button
              type="button"
              className="bonus-page-btn"
              disabled={page <= 1}
              onClick={() =>
                setPage((prev) => Math.max(1, prev - 1))
              }
            >
              Previous
            </button>

            <span className="bonus-page-number">
              Page {page} of {totalPages}
            </span>

            <button
              type="button"
              className="bonus-page-btn"
              disabled={page >= totalPages}
              onClick={() =>
                setPage((prev) =>
                  Math.min(totalPages, prev + 1)
                )
              }
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* MODAL */}

      {modalOpen && (
        <div
          className="bonus-modal-backdrop"
          onMouseDown={(e) => {
            if (
              e.target === e.currentTarget &&
              !saving
            ) {
              closeModal();
            }
          }}
        >
          <div className="bonus-modal">
            <div className="bonus-modal-header">
              <div>
                <h2>
                  {modalMode === "edit"
                    ? "Edit Bonus Computation"
                    : "View Bonus Computation"}
                </h2>

                <p>
                  Monthly bonus computation for{" "}
                  {year}
                </p>
              </div>

              <button
                type="button"
                className="bonus-modal-close"
                onClick={closeModal}
                disabled={saving}
              >
                ×
              </button>
            </div>

            {selectedStaff && (
              <div className="bonus-employee-info">
                <div>
                  <span>Employee No.</span>
                  <strong>
                    {selectedStaff.employee_no ||
                      "-"}
                  </strong>
                </div>

                <div>
                  <span>Employee Name</span>
                  <strong>
                    {selectedStaff.fullname ||
                      "-"}
                  </strong>
                </div>

                <div>
                  <span>Department</span>
                  <strong>
                    {selectedStaff.department ||
                      "-"}
                  </strong>
                </div>

                <div>
                  <span>Position</span>
                  <strong>
                    {selectedStaff.position ||
                      "-"}
                  </strong>
                </div>

                <div>
                  <span>Salary</span>
                  <strong>
                    ₱{" "}
                    {money(
                      selectedStaff.salary
                    )}
                  </strong>
                </div>

                <div>
                  <span>ECOLA</span>
                  <strong>
                    ₱{" "}
                    {money(
                      selectedStaff.ecola
                    )}
                  </strong>
                </div>

                <div>
                  <span>Total Gross</span>
                  <strong>
                    ₱{" "}
                    {money(
                      selectedStaff.total_gross
                    )}
                  </strong>
                </div>

                <div>
                  <span>Year</span>
                  <strong>{year}</strong>
                </div>
              </div>
            )}

            {modalLoading ? (
              <div className="bonus-modal-loading">
                Loading monthly computation...
              </div>
            ) : (
              <div className="bonus-month-table-wrap">
                <table className="bonus-month-table">
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th>13th Month</th>
                      <th>14th Month</th>
                      <th>15th Month</th>
                    </tr>
                  </thead>

                  <tbody>
                    {months.map(
                      (item, index) => (
                        <tr key={item.month}>
                          <td>
                            {MONTHS[index]}
                          </td>

                          <td>
                            {modalMode ===
                            "edit" ? (
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={
                                  item.month_13
                                }
                                onChange={(e) =>
                                  updateMonth(
                                    index,
                                    "month_13",
                                    e.target
                                      .value
                                  )
                                }
                              />
                            ) : (
                              money(
                                item.month_13
                              )
                            )}
                          </td>

                          <td>
                            {modalMode ===
                            "edit" ? (
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={
                                  item.month_14
                                }
                                onChange={(e) =>
                                  updateMonth(
                                    index,
                                    "month_14",
                                    e.target
                                      .value
                                  )
                                }
                              />
                            ) : (
                              money(
                                item.month_14
                              )
                            )}
                          </td>

                          <td>
                            {modalMode ===
                            "edit" ? (
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={
                                  item.month_15
                                }
                                onChange={(e) =>
                                  updateMonth(
                                    index,
                                    "month_15",
                                    e.target
                                      .value
                                  )
                                }
                              />
                            ) : (
                              money(
                                item.month_15
                              )
                            )}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>

                  <tfoot>
                    <tr>
                      <th>Total</th>

                      <th>
                        {money(
                          totals.month_13
                        )}
                      </th>

                      <th>
                        {money(
                          totals.month_14
                        )}
                      </th>

                      <th>
                        {money(
                          totals.month_15
                        )}
                      </th>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            <div className="bonus-modal-footer">
              {modalMode === "view" ? (
                <>
                  <button
                    type="button"
                    className="bonus-btn secondary"
                    onClick={closeModal}
                  >
                    Close
                  </button>

                  <button
                    type="button"
                    className="bonus-btn primary"
                    onClick={() =>
                      setModalMode("edit")
                    }
                    disabled={modalLoading}
                  >
                    Edit
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="bonus-btn secondary"
                    onClick={closeModal}
                    disabled={saving}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className="bonus-btn primary"
                    onClick={saveBonus}
                    disabled={
                      saving ||
                      modalLoading
                    }
                  >
                    {saving
                      ? "Saving..."
                      : "Save"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}