//BonusComputation.jsx

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

/* =========================================================
   SAFE SAVING HELPERS
========================================================= */

const roundBonusMoney = (value) =>
  Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const normalizeBonusMonth = (item, monthNumber) => ({
  month: monthNumber,

  exists: item?.exists === true,

  total_compensation: Number(
    item?.total_compensation ?? 0
  ),

  deductions: Number(
    item?.deductions ?? 0
  ),

  month_13: Number(
    item?.month_13 ?? 0
  ),

  month_14: Number(
    item?.month_14 ?? 0
  ),

  month_15: Number(
    item?.month_15 ?? 0
  ),

  is_manual_override:
    item?.is_manual_override === true,
});

const bonusMonthChanged = (current, original) => {
  if (!original) return false;

  const fields = [
    "total_compensation",
    "month_13",
  ];

  return fields.some((field) => {
    const currentValue = current[field];
    const originalValue = original[field];

    // An empty input is always considered a change.
    if (
      currentValue === "" ||
      currentValue === null ||
      currentValue === undefined
    ) {
      return true;
    }

    return (
      roundBonusMoney(currentValue) !==
      roundBonusMoney(originalValue)
    );
  });
};

/* =========================================================
   BONUS COMPUTATION PERMISSIONS
========================================================= */

const norm = (value) =>
  String(value ?? "").trim().toLowerCase();

const readUser = () => {
  try {
    return JSON.parse(
      localStorage.getItem("user") || "null"
    );
  } catch {
    return null;
  }
};

const canManageBonus = (user) => {
  if (!user) return false;

  const role = norm(user.role);

  const department = norm(
    user.department ||
    user.department_name ||
    user.user_department ||
    user.departmentName ||
    user.dept
  );

  // System administrators
  if (role === "admin" || role === "it") {
    return true;
  }

  // HR and Accounting Departments
  return [
    "hr",
    "hr department",
    "accounting",
    "accounting department",
  ].includes(department);
};

const money = (value) => {
  const amount = Number(value ?? 0);

  return amount.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const formatDate = (value) => {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
};

const emptyMonths = () =>
  MONTHS.map((_, index) => ({
    month: index + 1,

    exists: false,

    total_compensation: 0,
    deductions: 0,

    month_13: 0,
    month_14: 0,
    month_15: 0,

    is_manual_override: false,
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
  const [originalMonths, setOriginalMonths] = useState(emptyMonths());

  const [modalLoading, setModalLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [recalculating, setRecalculating] = useState(false);

  const [resettingMonth, setResettingMonth] = useState(null);

  const [currentUser, setCurrentUser] = useState(readUser);

  useEffect(() => {
    const refreshUser = () => {
      setCurrentUser(readUser());
    };

    window.addEventListener("auth-changed", refreshUser);
    window.addEventListener("storage", refreshUser);

    return () => {
      window.removeEventListener("auth-changed", refreshUser);
      window.removeEventListener("storage", refreshUser);
    };
  }, []);

  const canManage = canManageBonus(currentUser);

  useEffect(() => {
    if (!canManage && modalMode === "edit") {
      setModalMode("view");
    }
  }, [canManage, modalMode]);

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

  /* =========================================================
    GENERATE / RECALCULATE YEAR
  ========================================================= */

  const recalculateYear = async () => {
    if (!canManage) {
      alert("You do not have permission to generate bonus computations.");
      return;
    }

    const confirmed = window.confirm(
      `Generate / recalculate bonus computations for ${year}?\n\n` +
        "Basic Salary and De Minimis will be recalculated from Salary History.\n" +
        "Suspension deductions will be recalculated from Received Suspension Orders.\n" +
        "Manually adjusted months will not be overwritten."
    );

    if (!confirmed) {
      return;
    }

    try {
      setRecalculating(true);

      const res = await api.post(
        "/bonus-computations/recalculate",
        {
          year,
        }
      );

      await loadRows();

      alert(
        res.data?.message ||
          `Bonus computations for ${year} generated successfully.`
      );
    } catch (err) {
      console.error(
        "Failed to recalculate bonus computations:",
        err
      );

      alert(
        err?.response?.data?.message ||
          "Failed to recalculate bonus computations."
      );
    } finally {
      setRecalculating(false);
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

      const id = String(row.branch_id);

      branchMap.set(id, {
        id,
        code: String(row.branch_code || "").trim(),
        name:
          String(row.branch_name || "").trim() ||
          `Branch ${row.branch_id}`,
      });
    });

    return [...branchMap.values()].sort((a, b) => {
      const codeA = String(a.code || "");
      const codeB = String(b.code || "");

      return codeA.localeCompare(codeB, undefined, {
        numeric: true,
        sensitivity: "base",
      });
    });
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
      setOriginalMonths(emptyMonths());

      setModalOpen(true);
      setModalLoading(true);

      const res = await api.get(
        `/bonus-computations/staff/${row.staff_id}`,
        {
          params: { year },
        }
      );

      if (res.data?.staff) {
        setSelectedStaff(res.data.staff);
      }

      if (Array.isArray(res.data?.months)) {
        const loadedMonths = MONTHS.map((_, index) => {
          const monthNumber = index + 1;

          const saved = res.data.months.find(
            (item) =>
              Number(item.month) === monthNumber
          );

          return normalizeBonusMonth(
            saved,
            monthNumber
          );
        });

        setMonths(loadedMonths);

        // Keep a separate snapshot of database values.
        setOriginalMonths(
          loadedMonths.map((item) => ({ ...item }))
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
    if (saving || resettingMonth !== null) return;

    setModalOpen(false);

    setSelectedStaff(null);

    setMonths(emptyMonths());
    setOriginalMonths(emptyMonths());

    setModalMode("view");
  };

  /* =========================================================
     UPDATE MONTH INPUT
  ========================================================= */

  const updateMonth = (index, field, value) => {
    setMonths((prev) =>
      prev.map((item, itemIndex) => {
        if (itemIndex !== index) {
          return item;
        }

        if (field === "month_13") {
          return {
            ...item,
            month_13: value,
            month_14: value,
            month_15: value,
          };
        }

        return {
          ...item,
          [field]: value,
        };
      })
    );
  };

  /* =========================================================
    RESET SELECTED MONTH TO AUTOMATIC
  ========================================================= */

  const resetMonthToAutomatic = async (monthNumber) => {
    if (!selectedStaff?.staff_id) {
      return;
    }

    if (!canManage) {
      alert("You do not have permission to reset bonus computations.");
      return;
    }

    if (saving || resettingMonth !== null) {
      return;
    }

    if (modalMode === "edit") {
      alert(
        "Please save or cancel your edits before resetting a month."
      );
      return;
    }

    const monthName = MONTHS[monthNumber - 1];

    const confirmed = window.confirm(
      `Reset ${monthName} ${year} to Automatic?\n\n` +
        "The manually adjusted compensation and bonus amounts " +
        "for this month will be replaced using Salary History.\n\n" +
        "Suspension deductions will be recalculated from Received Suspension Orders.\n\n" +
        "This action cannot be undone automatically."
    );

    if (!confirmed) {
      return;
    }

    try {
      setResettingMonth(monthNumber);

      const res = await api.post(
        `/bonus-computations/staff/${selectedStaff.staff_id}/reset-automatic`,
        {
          year,
          month: monthNumber,
        }
      );

      const updated = res.data?.computation;

      if (updated) {
        const normalizedUpdated = normalizeBonusMonth(
          {
            ...updated,
            exists: true,
            is_manual_override: false,
          },
          monthNumber
        );

        setMonths((prev) =>
          prev.map((item) =>
            Number(item.month) === monthNumber
              ? { ...normalizedUpdated }
              : item
          )
        );

        setOriginalMonths((prev) =>
          prev.map((item) =>
            Number(item.month) === monthNumber
              ? { ...normalizedUpdated }
              : item
          )
        );
      }

      await loadRows();

      alert(
        res.data?.message ||
          `${monthName} reset to automatic successfully.`
      );
    } catch (err) {
      console.error(
        "Failed to reset bonus computation:",
        err
      );

      alert(
        err?.response?.data?.message ||
          "Failed to reset bonus computation."
      );
    } finally {
      setResettingMonth(null);
    }
  };

  /* =========================================================
     TOTALS
  ========================================================= */

  const totals = useMemo(() => {
    return months.reduce(
      (acc, item) => {
        const totalCompensation = Number(
          item.total_compensation || 0
        );

        const deductions = Number(
          item.deductions || 0
        );

        const month13 = Number(
          item.month_13 || 0
        );

        const month14 = Number(
          item.month_14 || 0
        );

        const month15 = Number(
          item.month_15 || 0
        );

        const totalBonus =
          month13 +
          month14 +
          month15;


        acc.total_compensation +=
          totalCompensation;

        acc.deductions += deductions;
        acc.month_13 += month13;
        acc.month_14 += month14;
        acc.month_15 += month15;
        acc.total_bonus += totalBonus;

        return acc;
      },
      {
        total_compensation: 0,
        deductions: 0,
        month_13: 0,
        month_14: 0,
        month_15: 0,
        total_bonus: 0,
      }
    );
  }, [months]);

  const totalBenefits = useMemo(() => {
    return (
      Number(totals.month_13 || 0) +
      Number(totals.month_14 || 0) +
      Number(totals.month_15 || 0)
    );
  }, [totals]);

  const saveBonus = async () => {
    if (!selectedStaff?.staff_id) {
      return;
    }

    if (!canManage) {
      alert("You do not have permission to edit bonus computations.");
      return;
    }

    if (saving || modalLoading) {
      return;
    }

    const changedMonths = months.filter((item) => {
      const original = originalMonths.find(
        (saved) =>
          Number(saved.month) === Number(item.month)
      );

      return bonusMonthChanged(item, original);
    });

    if (changedMonths.length === 0) {
      alert("No changes were made.");

      setModalMode("view");
      return;
    }

    /* =====================================================
      VALIDATE BLANK INPUTS
    ===================================================== */

    const blankMonth = changedMonths.find(
      (item) =>
        String(item.total_compensation).trim() === "" ||
        String(item.month_13).trim() === ""
    );

    if (blankMonth) {
      alert(
        `Please complete all amounts for ${
          MONTHS[blankMonth.month - 1]
        }.`
      );

      return;
    }

    /* =====================================================
      VALIDATE RAW NUMERIC VALUES
    ===================================================== */

    const invalidRawMonth = changedMonths.find((item) => {
      const values = [
        item.total_compensation,
        item.month_13,
      ];

      return values.some((value) => {
        const amount = Number(value);

        return (
          !Number.isFinite(amount) ||
          amount < 0
        );
      });
    });

    if (invalidRawMonth) {
      alert(
        `Invalid amounts for ${
          MONTHS[invalidRawMonth.month - 1]
        }. Please enter valid non-negative values.`
      );

      return;
    }

    /* =====================================================
      PREPARE REQUEST PAYLOAD
    ===================================================== */

    const payloadMonths = changedMonths.map((item) => {
      const original = originalMonths.find(
        (saved) =>
          Number(saved.month) === Number(item.month)
      );

      return {
        month: Number(item.month),

        total_compensation: roundBonusMoney(
          item.total_compensation
        ),

        month_13: roundBonusMoney(
          item.month_13
        ),

        original: {
          exists: original.exists,

          total_compensation: roundBonusMoney(
            original.total_compensation
          ),

          deductions: roundBonusMoney(
            original.deductions
          ),

          month_13: roundBonusMoney(
            original.month_13
          ),

          month_14: roundBonusMoney(
            original.month_14
          ),

          month_15: roundBonusMoney(
            original.month_15
          ),

          is_manual_override:
            original.is_manual_override === true,
        },
      };
    });

    /* =====================================================
      VALIDATE AMOUNTS
    ===================================================== */

    const invalidMonth = payloadMonths.find((item) => {
      return (
        !Number.isFinite(item.total_compensation) ||
        !Number.isFinite(item.month_13) ||
        item.total_compensation < 0 ||
        item.month_13 < 0
      );
    });

    if (invalidMonth) {
      alert(
        `Invalid amounts for ${
          MONTHS[invalidMonth.month - 1]
        }. Please enter valid non-negative values.`
      );

      return;
    }

    try {
      setSaving(true);

      const res = await api.put(
        `/bonus-computations/staff/${selectedStaff.staff_id}`,
        {
          year,
          months: payloadMonths,
        }
      );

      /* =====================================================
        RELOAD UPDATED DATA
      ===================================================== */

      const refreshed = await api.get(
        `/bonus-computations/staff/${selectedStaff.staff_id}`,
        {
          params: { year },
        }
      );

      if (Array.isArray(refreshed.data?.months)) {
        const refreshedMonths = MONTHS.map(
          (_, index) => {
            const monthNumber = index + 1;

            const saved = refreshed.data.months.find(
              (item) =>
                Number(item.month) === monthNumber
            );

            return normalizeBonusMonth(
              saved,
              monthNumber
            );
          }
        );

        setMonths(refreshedMonths);

        setOriginalMonths(
          refreshedMonths.map((item) => ({
            ...item,
          }))
        );
      }

      await loadRows();

      setModalMode("view");

      alert(
        res.data?.message ||
          "Bonus computation saved successfully."
      );
    } catch (err) {
      console.error(
        "Failed to save bonus computation:",
        err
      );

      /* =====================================================
        CONCURRENT EDITING CONFLICT
      ===================================================== */

      if (err?.response?.status === 409) {
        const conflictMonths =
          err.response.data?.conflict_months || [];

        const monthNames = conflictMonths
          .map(
            (month) =>
              MONTHS[Number(month) - 1] ||
              `Month ${month}`
          )
          .join(", ");

        alert(
          "Another user modified the bonus computation " +
            "while you were editing.\n\n" +
            (monthNames
              ? `Affected months: ${monthNames}\n\n`
              : "") +
            "Your changes were not saved.\n\n" +
            "Click Cancel to reload the latest values."
        );

        return;
      }

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

        {canManage && (
          <button
            type="button"
            className="bonus-btn primary"
            onClick={recalculateYear}
            disabled={recalculating || loading}
          >
            {recalculating
              ? `Recalculating ${year}...`
              : `Generate / Recalculate ${year}`}
          </button>
        )}
      </div>

      {/* FILTERS */}

      <div className="bonus-comp-filters">
        <div className="bonus-filter">
          <label>Year</label>

          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            disabled={modalOpen || saving || resettingMonth !== null}
          >
            {Array.from(
              { length: 11 },
              (_, index) => currentYear - 5 + index
            ).map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </div>

        <div className="bonus-filter">
          <label>Department</label>

          <select value={department} onChange={(e) => setDepartment(e.target.value)}>
            <option value="ALL">All Departments</option>

            {departments.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </div>

        <div className="bonus-filter">
          <label>Branch</label>

          <select value={branch} onChange={(e) => setBranch(e.target.value)}>
            <option value="ALL">All Branches</option>

            {branches.map((item) => (
              <option key={item.id} value={item.id}>
                {item.code
                  ? `${item.code} - ${item.name}`
                  : item.name}
              </option>
            ))}
          </select>
        </div>

        <div className="bonus-filter bonus-search">
          <label>Search Employee</label>

          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Employee no., name or position..."
          />
        </div>
      </div>

      {/* MAIN TABLE */}

      <div className="bonus-comp-table-wrap">
        <table className="bonus-comp-table">
          <thead>
            <tr>
              <th>Employee No.</th>
              <th>Employee Name</th>
              <th>Position</th>
              <th>Date of Deployment</th>
              <th>Date of Regularization</th>
              <th className="num">Salary</th>
              <th className="num">De Minimis</th>
              <th className="num">Total Gross</th>
              <th className="num">Total Bonus Base {year}</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan="10"
                  className="bonus-empty"
                >
                  Loading bonus computations...
                </td>
              </tr>
            ) : filteredRows.length === 0 ? (
              <tr>
                <td
                  colSpan="10"
                  className="bonus-empty"
                >
                  No employees found.
                </td>
              </tr>
            ) : (
              paginatedRows.map((row) => (
                <tr key={row.staff_id}>
                  <td>{row.employee_no || "-"}</td>
                  <td className="employee-name">{row.fullname || "-"}</td>
                  <td>{row.position || "-"}</td>
                  <td>{formatDate(row.start_date)}</td>
                  <td>{formatDate(row.regularization_date)}</td>
                  <td className="num">{money(row.salary)}</td>
                  <td className="num">{money(row.ecola)}</td>
                  <td className="num">{money(row.total_gross)}</td>
                  <td className="num">
                    {money(
                      Number(row.month_13 || 0) +
                        Number(row.month_14 || 0) +
                        Number(row.month_15 || 0)
                    )}
                  </td>

                  <td>
                    <div className="bonus-actions">
                      <button type="button" className="bonus-btn view" onClick={() => openEmployee(row,"view")}>
                        View
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
            <button type="button" className="bonus-page-btn" disabled={page <= 1} onClick={() =>
                setPage((prev) => Math.max(1, prev - 1))}
            >
              Previous
            </button>

            <span className="bonus-page-number">
              Page {page} of {totalPages}
            </span>

            <button type="button" className="bonus-page-btn" disabled={page >= totalPages} onClick={() =>
                setPage((prev) => Math.min(totalPages, prev + 1))}
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
              !saving &&
              resettingMonth === null
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

                <p>Monthly bonus computation for{" "}{year}</p>
              </div>

              <button type="button" className="bonus-modal-close" onClick={closeModal} disabled={saving || resettingMonth !== null}>
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
                  <span>Date of Deployment</span>
                  <strong>
                    {formatDate(selectedStaff.start_date)}
                  </strong>
                </div>

                <div>
                  <span>Date of Regularization</span>
                  <strong>
                    {formatDate(selectedStaff.regularization_date)}
                  </strong>
                </div>

                <div>
                  <span>Salary</span>
                  <strong>
                    ₱{" "}
                    {money(selectedStaff.salary)}
                  </strong>
                </div>

                <div>
                  <span>De Minimis</span>
                  <strong>
                    ₱{" "}
                    {money(selectedStaff.ecola)}
                  </strong>
                </div>

                <div>
                  <span>Total Gross</span>
                  <strong>
                    ₱{" "}
                    {money(selectedStaff.total_gross)}
                  </strong>
                </div>

                <div>
                  <span>Year</span>
                  <strong>{year}</strong>
                </div>
              </div>
            )}

            {selectedStaff && !modalLoading && (
              <div className="bonus-benefit-summary">
                <div>
                  <span>Total Gross</span>
                  <strong>
                    ₱ {money(selectedStaff.total_gross)}
                  </strong>
                </div>

                <div>
                  <span>13th Month Total</span>
                  <strong>
                    ₱ {money(totals.month_13)}
                  </strong>
                </div>

                <div>
                  <span>14th Month Total</span>
                  <strong>
                    ₱ {money(totals.month_14)}
                  </strong>
                </div>

                <div>
                  <span>15th Month Base</span>
                  <strong>
                    ₱ {money(totals.month_15)}
                  </strong>
                </div>

                <div>
                  <span>Deductions</span>
                  <strong>
                    ₱ {money(totals.deductions)}
                  </strong>
                </div>

                <div className="bonus-benefit-highlight">
                  <span>Total Bonus Base</span>
                  <strong>
                    ₱ {money(totalBenefits)}
                  </strong>
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
                      <th>Total Compensation</th>
                      <th>Suspension Deductions</th>
                      <th>13th Month</th>
                      <th>14th Month</th>
                      <th>15th Month Base</th>
                      <th>Total Bonus Base</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {months.map(
                      (item, index) => (
                        <tr key={item.month}>
                          <td>{MONTHS[index]}</td>

                          <td>
                            {modalMode === "edit" ? (
                              <input type="number" min="0" step="0.01" value={item.total_compensation}
                                onChange={(e) => updateMonth( index, "total_compensation", e.target.value)}
                              />
                            ) : (
                              money(item.total_compensation)
                            )}
                          </td>

                          <td>
                            {money(item.deductions)}
                          </td>

                          <td>
                            {modalMode === "edit" ? (
                              <input type="number" min="0" step="0.01" value={item.month_13}
                                onChange={(e) => updateMonth(index, "month_13", e.target.value)}/>
                            ) : ( money(item.month_13))}
                          </td>

                          <td>{money(item.month_14)}</td>
                          <td>{money(item.month_15)}</td>
                          <td>
                            {money(
                              Number(item.month_13 || 0) +
                              Number(item.month_14 || 0) +
                              Number(item.month_15 || 0)
                            )}
                          </td>
                          <td>
                            <span
                              className={
                                item.is_manual_override
                                  ? "bonus-status manual"
                                  : "bonus-status automatic"
                              }
                            >
                              {item.is_manual_override
                                ? "Manually Adjusted"
                                : "Automatic"}
                            </span>
                          </td>

                          <td>
                            {canManage &&
                              item.is_manual_override &&
                              modalMode === "view" ? (
                                <button
                                  type="button"
                                  className="bonus-btn secondary"
                                  onClick={() =>
                                    resetMonthToAutomatic(item.month)
                                  }
                                  disabled={
                                    resettingMonth !== null ||
                                    saving ||
                                    modalLoading
                                  }
                                >
                                {resettingMonth === item.month
                                  ? "Resetting..."
                                  : "Reset to Automatic"}
                              </button>
                            ) : (
                              <span>-</span>
                            )}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>

                  <tfoot>
                    <tr>
                      <th>Total</th>
                      <th>{money(totals.total_compensation)}</th>
                      <th>{money(totals.deductions)}</th>
                      <th>{money(totals.month_13)}</th>
                      <th>{money(totals.month_14)}</th>
                      <th>{money(totals.month_15)}</th>
                      <th>{money(totals.total_bonus)}</th>
                      <th colSpan={2}>-</th>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            <div className="bonus-modal-footer">
              {modalMode === "view" ? (
                <>
                  <button
                    type="button" className="bonus-btn secondary" onClick={closeModal} disabled={saving || resettingMonth !== null}>
                    Close
                  </button>

                  {canManage && (
                    <button
                      type="button"
                      className="bonus-btn primary"
                      onClick={() => {
                        if (!canManage || modalLoading) return;

                        setModalMode("edit");
                      }}
                      disabled={modalLoading || resettingMonth !== null}
                    >
                      Edit
                    </button>
                  )}
                </>
              ) : (
                <>
                  <button type="button" className="bonus-btn secondary" onClick={() => openEmployee(selectedStaff, "view")} disabled={saving}>
                    Cancel
                  </button>

                  <button type="button" className="bonus-btn primary" onClick={saveBonus} disabled={saving || modalLoading}>
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

