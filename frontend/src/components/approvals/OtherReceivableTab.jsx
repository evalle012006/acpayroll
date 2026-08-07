import React, { useCallback, useEffect, useMemo, useRef, useState, } from "react";
import api from "../../api/axiosClient";
import "../../styles/OtherReceivable.css";
/* =========================================================
   HELPERS
========================================================= */
const readUser = () => {
  try {
    return JSON.parse(
      localStorage.getItem("user") || "null"
    );
  } catch {
    return null;
  }
};
const toNum = (v) => {
  const n = Number(v ?? 0);
    return Number.isFinite(n)
      ? n
    : 0;
};
const toStr = (v) => String(v ?? "").trim();
const norm = (v) => toStr(v).toLowerCase();
const fmtMoney = (v) =>
  Number(toNum(v)).toLocaleString(
    undefined,
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  );
const fmtDate = (d) =>
  d
    ? String(d).slice(0, 10)
    : "-";
const isOperationDepartment = (
  department
) =>
  [
    "operation",
    "operations",
    "operation department",
    "operations department",
  ].includes(
    norm(department)
  );
const isHrDepartment = (
  role,
  department
) =>
  role === "hr" ||
  department === "hr" ||
  department === "hr department" ||
  department ===
    "human resources" ||
  department ===
    "human resources department";
const isAccountingDepartment = (
  role,
  department
) =>
  role === "accounting" ||
  department === "accounting" ||
  department ===
    "accounting department";
const getBranchText = (s) =>
  toStr(
    s?.branch_name ||
      s?.branch ||
      s?.branch_code ||
      s?.present_branch_name ||
      s?.prev_branch_name ||
      s?.branch_id
  );
/* =========================================================
   COMPONENT
========================================================= */
export default function OtherReceivableTab() {
  const user = useMemo(
    () => readUser(),
    []
  );
  /* =======================================================
     USER / PERMISSION
  ======================================================= */
  const role = norm(
    user?.role
  );
  const department = norm(
    user?.department
  );
  const isAdmin = role === "admin";
  const isIT = role === "it";
  const isHr =
    isHrDepartment(
      role,
      department
    );
  const isAccounting =
    isAccountingDepartment(
      role,
      department
    );
  const isBranchManager =
    role === "branch manager";
  const isAreaManager =
    role === "area manager" ||
    role ===
      "acting area manager";
  const isRegionalManager =
    role ===
      "regional manager" ||
    role ===
      "acting regional manager";
  const isAssistantVicePresident =
    role ===
    "assistant vice president";
  const isVicePresident =
    role === "vice president";
  const isSeniorVicePresident =
    role ===
    "senior vice president";
  const isPresident =
    role === "president";
  const isTread =
    role === "tread";
  const isOperationVP =
    role ===
      "vice president" &&
    isOperationDepartment(
      department
    );
  const isITDepartment =
    department ===
    "it department";
  const canCreateOR =
    isAdmin ||
    isIT ||
    isHr ||
    isAccounting ||
    isOperationVP ||
    (
      isITDepartment &&
      (
        isBranchManager ||
        isAreaManager ||
        isRegionalManager ||
        isAssistantVicePresident ||
        isVicePresident ||
        isSeniorVicePresident
      )
    );
  const canViewOR =
    isAdmin ||
    isIT ||
    isHr ||
    isAccounting ||
    isBranchManager ||
    isAreaManager ||
    isRegionalManager ||
    isAssistantVicePresident ||
    isVicePresident ||
    isSeniorVicePresident ||
    isPresident ||
    isTread;
  const isITManager =
    isITDepartment &&
    (
      isBranchManager ||
      isAreaManager ||
      isRegionalManager ||
      isAssistantVicePresident ||
      isVicePresident ||
      isSeniorVicePresident
    );
  const canApproveOR =
    isHr ||
    isAccounting ||
    isSeniorVicePresident ||
    isITManager;
  const canRejectOR =
    isHr ||
    isAccounting ||
    isIT ||
    isSeniorVicePresident ||
    isITManager;
  const canVoidOR =
    isAccounting ||
    isHr ||
    isAdmin ||
    isIT ||
    isITManager;
  const canDeleteOR =
    isAdmin ||
    isIT ||
    department === "it" ||
    department ===
      "it department";
  const canBypassOR =
    isAdmin ||
    isIT;
  /* =======================================================
     STATE
  ======================================================= */
  const [rows, setRows] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [viewRow, setViewRow] = useState(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [processingId, setProcessingId,] = useState("");
  /* SEARCH */
  const [searchInput, setSearchInput,] = useState("");
  const [search, setSearch] = useState("");
  /* PAGINATION */
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  /* EMPLOYEE SEARCH */
  const [employeeSearch, setEmployeeSearch,] = useState("");
  const [showEmployeeDropdown, setShowEmployeeDropdown,] = useState(false);
  const employeeBoxRef = useRef(null);
  /* FILE */
  const [attachment, setAttachment,] = useState(null);
  /* FORM */
  const [form, setForm] =
    useState({
      employee_id: "",
      employee_no: "",
      employee_name: "",
      branch: "",
      area: "",
      region: "",
      division: "",
      department: "",
      description: "",
      amount: "",
      term: "",
      per_month: "",
      deduction_start_date: "",
      release_date: "",
    });
  /* =======================================================
     LOGOUT
  ======================================================= */
  const logout =
    useCallback(() => {
      localStorage.removeItem(
        "token"
      );
      localStorage.removeItem(
        "user"
      );
      window.location.href =
        "/login";
    }, []);
  /* =======================================================
     FETCH STAFF
  ======================================================= */
  const fetchStaff =
    useCallback(async () => {
      try {
        const res =
          await api.get(
            "/staff"
          );
        setStaffList(
          Array.isArray(
            res.data
          )
            ? res.data
            : []
        );
      } catch (err) {
        if (
          err?.response?.status ===
          401
        ) {
          logout();
        }
        setStaffList([]);
      }
    }, [logout]);
  /* =======================================================
     FETCH OTHER RECEIVABLES
  ======================================================= */
  const fetchRows = useCallback(async () => {
      try {
        setLoading(true);
        const res =
          await api.get(
            "/other-receivables"
          );
        setRows(
          Array.isArray(
            res.data
          )
            ? res.data
            : []
        );
      } catch (err) {
        if (
          err?.response?.status ===
          401
        ) {
          logout();
        }
        setRows([]);
      } finally {
        setLoading(false);
      }
    }, [logout]);
  /* =======================================================
     INITIAL LOAD
  ======================================================= */
  useEffect(() => {
    const token =
      localStorage.getItem(
        "token"
      );
    if (
      !user ||
      !token
    ) {
      window.location.href =
        "/login";
      return;
    }
    if (!canViewOR) {
      return;
    }
    fetchStaff();
    fetchRows();
  }, [
    user,
    canViewOR,
    fetchStaff,
    fetchRows,
  ]);
  /* =======================================================
     MODAL ESCAPE / CLICK OUTSIDE
  ======================================================= */
  useEffect(() => {
    if (
      !showCreate &&
      !viewRow
    ) {
      return;
    }
    const onKeyDown = (
      event
    ) => {
      if (
        event.key ===
        "Escape"
      ) {
        setShowCreate(false);
        setShowEmployeeDropdown(
          false
        );
        setViewRow(null);
      }
    };
    const onMouseDown = (
      event
    ) => {
      if (
        employeeBoxRef.current &&
        !employeeBoxRef.current.contains(
          event.target
        )
      ) {
        setShowEmployeeDropdown(
          false
        );
      }
    };
    document.addEventListener(
      "keydown",
      onKeyDown
    );
    document.addEventListener(
      "mousedown",
      onMouseDown
    );
    document.body.style.overflow =
      "hidden";
    return () => {
      document.removeEventListener(
        "keydown",
        onKeyDown
      );
      document.removeEventListener(
        "mousedown",
        onMouseDown
      );
      document.body.style.overflow =
        "";
    };
  }, [
    showCreate,
    viewRow,
  ]);
  /* =======================================================
     STAFF DISPLAY
  ======================================================= */
  const buildStaffDisplay =
    useCallback((staff) => {
      if (!staff) {
        return "-";
      }
      const built =
        staff.fullname ||
        `${staff.last_name || ""}${
          staff.last_name &&
          staff.first_name
            ? ", "
            : ""
        }${
          staff.first_name || ""
        }${
          staff.middle_name
            ? ` ${staff.middle_name}`
            : ""
        }`
          .replace(
            /\s+/g,
            " "
          )
          .trim();
      return built || "-";
    }, []);
  const staffMap =
    useMemo(() => {
      const map =
        new Map();
      staffList.forEach(
        (staff) =>
          map.set(
            String(staff.id),
            staff
          )
      );
      return map;
    }, [staffList]);
  const staffDisplayName =
    useCallback(
      (staffId) =>
        buildStaffDisplay(
          staffMap.get(
            String(staffId)
          )
        ),
      [
        staffMap,
        buildStaffDisplay,
      ]
    );
  /* =======================================================
     SEARCHABLE STAFF
  ======================================================= */
  const searchableStaff =
    useMemo(() => {
      return staffList.map(
        (staff) => {
          const display =
            buildStaffDisplay(
              staff
            );
          const branchText =
            getBranchText(
              staff
            );
          const searchBlob =
            [
              staff.id,
              staff.employee_no,
              staff.fullname,
              staff.first_name,
              staff.last_name,
              staff.middle_name,
              display,
              staff.position,
              staff.branch_id,
              branchText,
              staff.area,
              staff.region,
              staff.division,
              staff.department,
            ]
              .map((value) =>
                toStr(value)
              )
              .join(" ")
              .toLowerCase();
          return {
            ...staff,
            _display: display,
            _branchText:
              branchText,
            _searchBlob:
              searchBlob,
          };
        }
      );
    }, [
      staffList,
      buildStaffDisplay,
    ]);
  const filteredEmployees =
    useMemo(() => {
      const q =
        norm(
          employeeSearch
        );
      if (!q) {
        return searchableStaff.slice(
          0,
          20
        );
      }
      return searchableStaff
        .filter((staff) =>
          staff._searchBlob.includes(
            q
          )
        )
        .slice(
          0,
          20
        );
    }, [
      searchableStaff,
      employeeSearch,
    ]);
  /* =======================================================
     SEARCH OTHER RECEIVABLES
  ======================================================= */
  const filteredRows =
    useMemo(() => {
      const q =
        norm(search);
      if (!q) {
        return rows;
      }
      return rows.filter(
        (row) => {
          const haystack =
            [
              row.id,
              row.employee_id,
              row.employee_no,
              row.employee_name,
              staffDisplayName(
                row.employee_id
              ),
              row.description,
              row.amount,
              row.release_date,
              row.status,
              row.created_at,
              row.approved_at,
              row.rejected_at,
              row.rejection_reason,
              row.area,
              row.region,
              row.division,
              row.department,
            ]
              .map((value) =>
                toStr(
                  value
                ).toLowerCase()
              )
              .join(" ");
          return haystack.includes(
            q
          );
        }
      );
    }, [
      rows,
      search,
      staffDisplayName,
    ]);
  /* =======================================================
     PAGINATION
  ======================================================= */
  const totalPages =
    Math.max(
      1,
      Math.ceil(
        filteredRows.length /
          pageSize
      )
    );
  const pagedRows =
    useMemo(() => {
      const start =
        (page - 1) *
        pageSize;
      return filteredRows.slice(
        start,
        start +
          pageSize
      );
    }, [
      filteredRows,
      page,
      pageSize,
    ]);
  useEffect(() => {
    setPage(1);
  }, [
    search,
    pageSize,
  ]);
  useEffect(() => {
    if (
      page > totalPages
    ) {
      setPage(
        totalPages
      );
    }
  }, [
    page,
    totalPages,
  ]);
  const getPageNumbers = () => {
    const pages = [];
    const maxButtons = 5;
    let start =
      Math.max(
        1,
        page - 2
      );
    let end =
      Math.min(
        totalPages,
        start +
          maxButtons -
          1
      );
    if (
      end - start <
      maxButtons - 1
    ) {
      start =
        Math.max(
          1,
          end -
            maxButtons +
            1
        );
    }
    for (
      let i = start;
      i <= end;
      i++
    ) {
      pages.push(i);
    }
    return pages;
  };
  /* =======================================================
     STATUS BADGE
  ======================================================= */
  const badgeClass = (
    status
  ) => {
    const value =
      norm(status);
    if (
      value ===
      "approved"
    ) {
      return "badge badge-approved";
    }
    if (
      value ===
        "rejected" ||
      value ===
        "void" ||
      value ===
        "voided"
    ) {
      return "badge badge-rejected";
    }
    return "badge badge-pending";
  };
  /* =======================================================
     EMPLOYEE SELECT
  ======================================================= */
  const handleEmployeeSelect = (
    employeeId
  ) => {
    const employee =
      staffList.find(
        (staff) =>
          String(staff.id) ===
          String(employeeId)
      );
    const display =
      buildStaffDisplay(
        employee
      );
    setForm(
      (previous) => ({
        ...previous,
        employee_id:
          String(
            employeeId || ""
          ),
        employee_no:
          employee?.employee_no ||
          "",
        employee_name:
          display || "-",
        branch:
          getBranchText(
            employee
          ),
        area:
          employee?.area ||
          "",
        region:
          employee?.region ||
          "",
        division:
          employee?.division ||
          "",
        department:
          employee?.department ||
          "",
      })
    );
    setEmployeeSearch(
      employee
        ? `${
            employee.employee_no
              ? `${employee.employee_no} - `
              : ""
          }${display}`
        : ""
    );
    setShowEmployeeDropdown(
      false
    );
  };
  /* =======================================================
     RESET FORM
  ======================================================= */
  const resetForm = () => {
    setForm({
      employee_id: "",
      employee_no: "",
      employee_name: "",
      branch: "",
      area: "",
      region: "",
      division: "",
      department: "",
      description: "",
      amount: "",
      term: "",
      per_month: "",
      deduction_start_date: "",
      release_date: "",
    });
    setAttachment(null);
    setEmployeeSearch("");
    setShowEmployeeDropdown(
      false
    );
  };
  const closeCreate = () => {
    setShowCreate(false);
    resetForm();
  };
  /* =======================================================
     CREATE
  ======================================================= */
  const handleCreate =
    async (event) => {
      event.preventDefault();
      const amount =
        toNum(
          form.amount
        );
      const term =
        Math.max(
          1,
          toNum(
            form.term
          )
        );
      const perMonth =
        toNum(
          form.per_month
        ) > 0
          ? toNum(
              form.per_month
            )
          : amount / term;
      try {
        setCreating(true);
        const fd =
          new FormData();
        fd.append(
          "employee_id",
          form.employee_id ||
            ""
        );
        fd.append(
          "employee_no",
          form.employee_no
        );
        fd.append(
          "employee_name",
          form.employee_name
        );
        fd.append(
          "branch",
          form.branch
        );
        fd.append(
          "area",
          form.area
        );
        fd.append(
          "region",
          form.region
        );
        fd.append(
          "division",
          form.division
        );
        fd.append(
          "department",
          form.department
        );
        fd.append(
          "description",
          form.description
        );
        fd.append(
          "amount",
          amount
        );
        fd.append(
          "release_date",
          form.release_date
        );
        fd.append(
          "term",
          term
        );
        fd.append(
          "per_month",
          perMonth
        );
        fd.append(
          "deduction_start_date",
          form.deduction_start_date
        );
        if (attachment) {
          fd.append(
            "attachment",
            attachment
          );
        }
        await api.post(
          "/other-receivables",
          fd,
          {
            headers: {
              "Content-Type":
                "multipart/form-data",
            },
          }
        );
        alert(
          "Other Receivable submitted successfully."
        );
        closeCreate();
        await fetchRows();
      } catch (err) {
        if (
          err?.response?.status ===
          401
        ) {
          return logout();
        }
        alert(
          err?.response?.data?.message ||
            "Failed to add Other Receivable."
        );
      } finally {
        setCreating(false);
      }
    };
  /* =======================================================
     APPROVE
  ======================================================= */
  const approveRow =
    async (row) => {
      const ok =
        window.confirm(
          "Approve this Other Receivable record?"
        );
      if (!ok) {
        return;
      }
      try {
        setProcessingId(
          `or-${row.id}-Approved`
        );
        await api.put(
          `/other-receivables/${row.id}`,
          {
            status:
              "Approved",
          }
        );
        alert(
          "Other Receivable approved successfully."
        );
        await fetchRows();
      } catch (err) {
        if (
          err?.response?.status ===
          401
        ) {
          return logout();
        }
        if (
          err?.response?.status ===
          403
        ) {
          return alert(
            "Access denied."
          );
        }
        alert(
          err?.response?.data?.message ||
            "Failed to approve Other Receivable."
        );
      } finally {
        setProcessingId("");
      }
    };
  /* =======================================================
     REJECT
  ======================================================= */
  const rejectRow =
    async (row) => {
      const reason =
        window.prompt(
          "Reason for rejection?"
        );
      if (
        !reason ||
        !String(
          reason
        ).trim()
      ) {
        alert(
          "Rejection reason is required."
        );
        return;
      }
      const ok =
        window.confirm(
          "Reject this Other Receivable record?"
        );
      if (!ok) {
        return;
      }
      try {
        setProcessingId(
          `or-${row.id}-Rejected`
        );
        await api.put(
          `/other-receivables/${row.id}`,
          {
            status:
              "Rejected",
            reason:
              String(
                reason
              ).trim(),
          }
        );
        alert(
          "Other Receivable rejected successfully."
        );
        await fetchRows();
      } catch (err) {
        if (
          err?.response?.status ===
          401
        ) {
          return logout();
        }
        if (
          err?.response?.status ===
          403
        ) {
          return alert(
            "Access denied."
          );
        }
        alert(
          err?.response?.data?.message ||
            "Failed to reject Other Receivable."
        );
      } finally {
        setProcessingId("");
      }
    };
  /* =======================================================
     BYPASS
  ======================================================= */
  const bypassRow =
    async (row) => {
      const ok =
        window.confirm(
          "Bypass approval and approve this Other Receivable?"
        );
      if (!ok) {
        return;
      }
      try {
        setProcessingId(
          `or-${row.id}-Bypass`
        );
        await api.put(
          `/other-receivables/${row.id}/bypass`
        );
        alert(
          "Other Receivable bypass approved successfully."
        );
        await fetchRows();
      } catch (err) {
        if (
          err?.response?.status ===
          401
        ) {
          return logout();
        }
        if (
          err?.response?.status ===
          403
        ) {
          return alert(
            "Access denied."
          );
        }
        alert(
          err?.response?.data?.message ||
            "Failed to bypass approve Other Receivable."
        );
      } finally {
        setProcessingId("");
      }
    };
  /* =======================================================
     VOID
  ======================================================= */
  const voidRow =
    async (row) => {
      const reason =
        window.prompt(
          "Reason for void?"
        );
      if (
        !reason ||
        !String(
          reason
        ).trim()
      ) {
        alert(
          "Void reason is required."
        );
        return;
      }
      const ok =
        window.confirm(
          "Void this approved Other Receivable record?"
        );
      if (!ok) {
        return;
      }
      try {
        setProcessingId(
          `or-${row.id}-Void`
        );
        await api.put(
          `/other-receivables/${row.id}/void`,
          {
            reason:
              String(
                reason
              ).trim(),
          }
        );
        alert(
          "Other Receivable voided successfully."
        );
        await fetchRows();
      } catch (err) {
        if (
          err?.response?.status ===
          401
        ) {
          return logout();
        }
        if (
          err?.response?.status ===
          403
        ) {
          return alert(
            "Access denied."
          );
        }
        alert(
          err?.response?.data?.message ||
            "Failed to void Other Receivable."
        );
      } finally {
        setProcessingId("");
      }
    };
  /* =======================================================
     DELETE
  ======================================================= */
  const deleteRow =
    async (row) => {
      const ok =
        window.confirm(
          "Delete this Other Receivable record?"
        );
      if (!ok) {
        return;
      }
      try {
        setProcessingId(
          `or-${row.id}-Delete`
        );
        await api.delete(
          `/other-receivables/${row.id}`
        );
        alert(
          "Other Receivable deleted successfully."
        );
        await fetchRows();
      } catch (err) {
        if (
          err?.response?.status ===
          401
        ) {
          return logout();
        }
        if (
          err?.response?.status ===
          403
        ) {
          return alert(
            "Access denied."
          );
        }
        alert(
          err?.response?.data?.message ||
            "Failed to delete Other Receivable."
        );
      } finally {
        setProcessingId("");
      }
    };
  /* =======================================================
     DOWNLOAD
  ======================================================= */
  const downloadFile =
    async (row) => {
      try {
        const res =
          await api.get(
            `/other-receivables/${row.id}/download`,
            {
              responseType:
                "blob",
            }
          );
        const blob =
          new Blob([
            res.data,
          ]);
        const url =
          window.URL.createObjectURL(
            blob
          );
        const link =
          document.createElement(
            "a"
          );
        link.href = url;
        link.download =
          row.attachment_name ||
          `other-receivable-${row.id}`;
        document.body.appendChild(
          link
        );
        link.click();
        link.remove();
        window.URL.revokeObjectURL(
          url
        );
      } catch (err) {
        alert(
          err?.response?.data?.message ||
            "Failed to download file."
        );
      }
    };
  /* =======================================================
     SUMMARY
  ======================================================= */
  const totalCount =
    filteredRows.length;
  const pendingCount =
    filteredRows.filter(
      (row) =>
        norm(
          row.status
        ) === "pending"
    ).length;
  const approvedCount =
    filteredRows.filter(
      (row) =>
        norm(
          row.status
        ) === "approved"
    ).length;
  const closedCount =
    filteredRows.filter(
      (row) =>
        [
          "rejected",
          "void",
          "voided",
        ].includes(
          norm(
            row.status
          )
        )
    ).length;
  /* =======================================================
     ACCESS DENIED
  ======================================================= */
  if (!canViewOR) {
    return (
      <div className="or-page">
        <div className="empty-state">
          You do not have access to Other Receivable.
        </div>
      </div>
    );
  }
  /* =======================================================
     RENDER
  ======================================================= */
  return (
    <div className="or-page">
      {/* ===================================================
          HERO
      =================================================== */}
      <section className="or-hero">
        <div className="or-hero-main">
          <div className="or-hero-copy">
            <span className="or-eyebrow">
              HRIS TRANSACTIONS
            </span>
            <h1>
              Other Receivable
            </h1>
            <p>
              Create, review, approve and manage
              employee liabilities and receivables
              charged to staff.
            </p>
            <div className="or-flow">
              <span>
                WORKFLOW
              </span>
              <b>
                Create → Approval → Monthly Deduction
              </b>
            </div>
          </div>
          <div className="or-hero-actions">
            <button
              type="button"
              className="or-btn or-btn-secondary"
              onClick={() =>
                window.history.back()
              }
            >
              ← Back
            </button>
            <button
              type="button"
              className="or-btn or-btn-secondary"
              onClick={
                fetchRows
              }
              disabled={
                loading
              }
            >
              {loading
                ? "Refreshing..."
                : "Refresh"}
            </button>
            {canCreateOR && (
              <button
                type="button"
                className="or-btn or-btn-primary"
                onClick={() =>
                  setShowCreate(
                    true
                  )
                }
              >
                + Create
              </button>
            )}
          </div>
        </div>
      </section>
      {/* ===================================================
          SUMMARY
      =================================================== */}
      <section className="or-summary-grid">
        <article className="or-summary-card or-summary-total">
          <div className="or-summary-icon">
            ALL
          </div>
          <div>
            <span>
              Total Records
            </span>
            <strong>
              {totalCount}
            </strong>
            <small>
              All receivable records
            </small>
          </div>
        </article>
        <article className="or-summary-card or-summary-pending">
          <div className="or-summary-icon">
            P
          </div>
          <div>
            <span>
              Pending
            </span>
            <strong>
              {pendingCount}
            </strong>
            <small>
              Awaiting approval
            </small>
          </div>
        </article>
        <article className="or-summary-card or-summary-approved">
          <div className="or-summary-icon">
            A
          </div>
          <div>
            <span>
              Approved
            </span>
            <strong>
              {approvedCount}
            </strong>
            <small>
              Active receivables
            </small>
          </div>
        </article>
        <article className="or-summary-card or-summary-closed">
          <div className="or-summary-icon">
            R
          </div>
          <div>
            <span>
              Rejected / Voided
            </span>
            <strong>
              {closedCount}
            </strong>
            <small>
              Closed records
            </small>
          </div>
        </article>
      </section>
      {/* ===================================================
          SEARCH
      =================================================== */}
      <section className="or-search-panel">
        <div className="or-search-controls">
          <input
            className="or-search-input"
            type="text"
            value={
              searchInput
            }
            onChange={(
              event
            ) =>
              setSearchInput(
                event.target.value
              )
            }
            onKeyDown={(
              event
            ) => {
              if (
                event.key ===
                "Enter"
              ) {
                setSearch(
                  searchInput
                );
              }
            }}
            placeholder="Search employee, employee no, amount, status..."
          />
          <button
            className="or-btn or-btn-secondary"
            type="button"
            onClick={() =>
              setSearch(
                searchInput
              )
            }
          >
            Search
          </button>
          <button
            className="or-btn or-btn-secondary"
            type="button"
            onClick={() => {
              setSearchInput("");
              setSearch("");
            }}
          >
            Clear
          </button>
        </div>
        <span className="or-result-count">
          {filteredRows.length}{" "}
          {filteredRows.length === 1
            ? "result"
            : "results"}
        </span>
      </section>
      {/* ===================================================
          TABLE
      =================================================== */}
      <section className="or-list-card">
        <div className="or-table-wrap">
          <table className="or-table">
            <thead>
              <tr>
                <th>
                  Employee ID
                </th>
                <th>
                  Employee Name
                </th>
                <th>
                  Amount
                </th>
                <th>
                  Date of Release
                </th>
                <th>
                  Status
                </th>
                <th>
                  File
                </th>
                <th>
                  Dates
                </th>
                <th>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={8}
                    className="or-empty"
                  >
                    Loading Other Receivable records...
                  </td>
                </tr>
              ) : filteredRows.length ===
                0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="or-empty"
                  >
                    No Other Receivable records found.
                  </td>
                </tr>
              ) : (
                pagedRows.map(
                  (row) => {
                    const status =
                      norm(
                        row.status ||
                          "Pending"
                      );
                    const isPending =
                      status ===
                      "pending";
                    const isApproved =
                      status ===
                      "approved";
                    return (
                      <tr
                        key={
                          row.id ??
                          `${row.employee_id}-${row.description}`
                        }
                      >
                        <td className="or-employee-no">
                          {row.employee_no ||
                            row.employee_id ||
                            "-"}
                        </td>
                        <td>
                          <div className="or-employee-name">
                            {row.employee_name ||
                              staffDisplayName(
                                row.employee_id
                              )}
                          </div>
                          <div className="or-sub-info">
                            Record ID:{" "}
                            {row.id || "-"}
                          </div>
                          {row.department && (
                            <div className="or-sub-info">
                              {row.department}
                            </div>
                          )}
                        </td>
                        <td className="or-amount">
                          ₱{" "}
                          {fmtMoney(
                            row.amount
                          )}
                        </td>
                        <td>
                          {fmtDate(
                            row.release_date
                          )}
                        </td>
                        <td>
                          <span
                            className={badgeClass(
                              row.status
                            )}
                          >
                            {row.status ||
                              "Pending"}
                          </span>
                        </td>
                        <td>
                          {row.attachment_path ? (
                            <button
                              className="or-action-btn or-action-download"
                              type="button"
                              onClick={() =>
                                downloadFile(
                                  row
                                )
                              }
                            >
                              File
                            </button>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="or-date-cell">
                          <div>
                            Approved:{" "}
                            {fmtDate(
                              row.approved_at
                            )}
                          </div>
                          <div>
                            Rejected/Void:{" "}
                            {fmtDate(
                              row.rejected_at
                            )}
                          </div>
                        </td>
                        <td>
                          <div className="or-row-actions">
                            <button
                              className="or-action-btn or-action-view"
                              type="button"
                              onClick={() =>
                                setViewRow(
                                  row
                                )
                              }
                            >
                              View
                            </button>
                            {isPending &&
                              canApproveOR && (
                                <button
                                  className="or-action-btn or-action-approve"
                                  type="button"
                                  onClick={() =>
                                    approveRow(
                                      row
                                    )
                                  }
                                  disabled={
                                    processingId ===
                                    `or-${row.id}-Approved`
                                  }
                                >
                                  {processingId ===
                                  `or-${row.id}-Approved`
                                    ? "Approving..."
                                    : "Approve"}
                                </button>
                              )}
                            {isPending &&
                              canBypassOR && (
                                <button
                                  className="or-action-btn or-action-bypass"
                                  type="button"
                                  onClick={() =>
                                    bypassRow(
                                      row
                                    )
                                  }
                                  disabled={
                                    processingId ===
                                    `or-${row.id}-Bypass`
                                  }
                                >
                                  {processingId ===
                                  `or-${row.id}-Bypass`
                                    ? "Bypassing..."
                                    : "Bypass"}
                                </button>
                              )}
                            {isPending &&
                              canRejectOR && (
                                <button
                                  className="or-action-btn or-action-reject"
                                  type="button"
                                  onClick={() =>
                                    rejectRow(
                                      row
                                    )
                                  }
                                  disabled={
                                    processingId ===
                                    `or-${row.id}-Rejected`
                                  }
                                >
                                  {processingId ===
                                  `or-${row.id}-Rejected`
                                    ? "Rejecting..."
                                    : "Reject"}
                                </button>
                              )}
                            {isApproved &&
                              canVoidOR && (
                                <button
                                  className="or-action-btn or-action-reject"
                                  type="button"
                                  onClick={() =>
                                    voidRow(
                                      row
                                    )
                                  }
                                  disabled={
                                    processingId ===
                                    `or-${row.id}-Void`
                                  }
                                >
                                  {processingId ===
                                  `or-${row.id}-Void`
                                    ? "Voiding..."
                                    : "Void"}
                                </button>
                              )}
                            {[
                              "rejected",
                              "void",
                              "voided",
                            ].includes(
                              status
                            ) &&
                              canDeleteOR && (
                                <button
                                  className="or-action-btn or-action-delete"
                                  type="button"
                                  onClick={() =>
                                    deleteRow(
                                      row
                                    )
                                  }
                                  disabled={
                                    processingId ===
                                    `or-${row.id}-Delete`
                                  }
                                >
                                  {processingId ===
                                  `or-${row.id}-Delete`
                                    ? "Deleting..."
                                    : "Delete"}
                                </button>
                              )}
                          </div>
                        </td>
                      </tr>
                    );
                  }
                )
              )}
            </tbody>
          </table>
        </div>
        {/* =================================================
            PAGINATION
        ================================================= */}
        <div className="or-pager">
          <div className="or-pager-left">
            <span>
              Rows per page
            </span>
            <select
              value={
                pageSize
              }
              onChange={(
                event
              ) =>
                setPageSize(
                  Number(
                    event.target
                      .value
                  )
                )
              }
            >
              {[25, 50, 75, 100].map(
                (size) => (
                  <option
                    key={
                      size
                    }
                    value={
                      size
                    }
                  >
                    {size}
                  </option>
                )
              )}
            </select>
          </div>
          <div className="or-pager-right">
            <button
              type="button"
              className="or-page-btn"
              disabled={
                page <= 1
              }
              onClick={() =>
                setPage(
                  (current) =>
                    Math.max(
                      1,
                      current - 1
                    )
                )
              }
            >
              ‹
            </button>
            {getPageNumbers().map(
              (
                pageNumber
              ) => (
                <button
                  type="button"
                  key={
                    pageNumber
                  }
                  className={`or-page-number ${
                    page ===
                    pageNumber
                      ? "active"
                      : ""
                  }`}
                  onClick={() =>
                    setPage(
                      pageNumber
                    )
                  }
                >
                  {pageNumber}
                </button>
              )
            )}
            <button
              type="button"
              className="or-page-btn"
              disabled={
                page >=
                totalPages
              }
              onClick={() =>
                setPage(
                  (current) =>
                    Math.min(
                      totalPages,
                      current + 1
                    )
                )
              }
            >
              ›
            </button>
            <span className="or-page-summary">
              Page {page} of{" "}
              {totalPages}
            </span>
          </div>
        </div>
      </section>
      {/* ===================================================
          CREATE MODAL
      =================================================== */}
      {canCreateOR &&
        showCreate && (
          <div
            className="reg-modal-overlay"
            onMouseDown={(
              event
            ) => {
              if (
                event.target.classList.contains(
                  "reg-modal-overlay"
                )
              ) {
                closeCreate();
              }
            }}
          >
            <div
              className="reg-modal or-create-modal"
              onMouseDown={(
                event
              ) =>
                event.stopPropagation()
              }
            >
              <div className="reg-modal-head">
                <div>
                  <h3 className="reg-modal-title">
                    Add Other Receivable
                  </h3>
                  <p className="reg-subtitle">
                    Create employee liability charge.
                  </p>
                </div>
                <button
                  className="reg-x"
                  type="button"
                  onClick={
                    closeCreate
                  }
                >
                  ✕
                </button>
              </div>
              <form
                onSubmit={
                  handleCreate
                }
                className="reg-form"
              >
                <div className="reg-grid">
                  {/* EMPLOYEE SEARCH */}
                  <div
                    className="reg-field full"
                    ref={
                      employeeBoxRef
                    }
                    style={{
                      position:
                        "relative",
                    }}
                  >
                    <label>
                      Employee
                    </label>
                    <input
                      type="text"
                      value={
                        employeeSearch
                      }
                      onChange={(
                        event
                      ) => {
                        setEmployeeSearch(
                          event.target
                            .value
                        );
                        setShowEmployeeDropdown(
                          true
                        );
                        setForm(
                          (
                            previous
                          ) => ({
                            ...previous,
                            employee_id:
                              "",
                            employee_no:
                              "",
                            employee_name:
                              "",
                            branch:
                              "",
                            area:
                              "",
                            region:
                              "",
                            division:
                              "",
                            department:
                              "",
                          })
                        );
                      }}
                      onFocus={() =>
                        setShowEmployeeDropdown(
                          true
                        )
                      }
                      placeholder="Search employee ID or name..."
                      required={
                        !form.employee_id
                      }
                    />
                    {showEmployeeDropdown && (
                      <div className="reg-search-dropdown">
                        {filteredEmployees.length ===
                        0 ? (
                          <div className="reg-search-empty">
                            No employee found
                          </div>
                        ) : (
                          filteredEmployees.map(
                            (
                              staff
                            ) => (
                              <button
                                key={
                                  staff.id
                                }
                                type="button"
                                className="reg-search-item"
                                onClick={() =>
                                  handleEmployeeSelect(
                                    staff.id
                                  )
                                }
                              >
                                {staff.employee_no
                                  ? `${staff.employee_no} - `
                                  : ""}
                                {
                                  staff._display
                                }
                              </button>
                            )
                          )
                        )}
                      </div>
                    )}
                  </div>
                  {/* EMPLOYEE ID */}
                  <div className="reg-field">
                    <label>
                      Employee ID
                    </label>
                    <input
                      value={
                        form.employee_no
                      }
                      readOnly
                      placeholder="Auto-filled"
                    />
                  </div>
                  {/* EMPLOYEE NAME */}
                  <div className="reg-field">
                    <label>
                      Employee Name
                    </label>
                    <input
                      value={
                        form.employee_name
                      }
                      readOnly
                      placeholder="Auto-filled"
                    />
                  </div>
                  {/* BRANCH */}
                  <div className="reg-field">
                    <label>
                      Branch
                    </label>
                    <input
                      value={
                        form.branch
                      }
                      readOnly
                      placeholder="Auto-filled"
                    />
                  </div>
                  {/* AREA */}
                  <div className="reg-field">
                    <label>
                      Area
                    </label>
                    <input
                      value={
                        form.area
                      }
                      readOnly
                      placeholder="Auto-filled"
                    />
                  </div>
                  {/* REGION */}
                  <div className="reg-field">
                    <label>
                      Region
                    </label>
                    <input
                      value={
                        form.region
                      }
                      readOnly
                      placeholder="Auto-filled"
                    />
                  </div>
                  {/* DIVISION */}
                  <div className="reg-field">
                    <label>
                      Division
                    </label>
                    <input
                      value={
                        form.division
                      }
                      readOnly
                      placeholder="Auto-filled"
                    />
                  </div>
                  {/* DEPARTMENT */}
                  <div className="reg-field full">
                    <label>
                      Department
                    </label>
                    <input
                      value={
                        form.department
                      }
                      readOnly
                      placeholder="Auto-filled"
                    />
                  </div>
                  {/* DESCRIPTION */}
                  <div className="reg-field full">
                    <label>
                      Description
                    </label>
                    <textarea
                      value={
                        form.description
                      }
                      onChange={(
                        event
                      ) =>
                        setForm(
                          (
                            previous
                          ) => ({
                            ...previous,
                            description:
                              event.target
                                .value,
                          })
                        )
                      }
                      required
                    />
                  </div>
                  {/* AMOUNT */}
                  <div className="reg-field">
                    <label>
                      Amount
                    </label>
                    <input
                      type="number"
                      value={
                        form.amount
                      }
                      onChange={(
                        event
                      ) =>
                        setForm(
                          (
                            previous
                          ) => ({
                            ...previous,
                            amount:
                              event.target
                                .value,
                          })
                        )
                      }
                      required
                    />
                  </div>
                  {/* RELEASE DATE */}
                  <div className="reg-field">
                    <label>
                      Date of Release
                    </label>
                    <input
                      type="date"
                      value={
                        form.release_date
                      }
                      onChange={(
                        event
                      ) =>
                        setForm(
                          (
                            previous
                          ) => ({
                            ...previous,
                            release_date:
                              event.target
                                .value,
                          })
                        )
                      }
                      required
                    />
                  </div>
                  {/* TERMS */}
                  <div className="reg-field">
                    <label>
                      Terms
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={
                        form.term
                      }
                      onChange={(
                        event
                      ) =>
                        setForm(
                          (
                            previous
                          ) => ({
                            ...previous,
                            term:
                              event.target
                                .value,
                          })
                        )
                      }
                      required
                    />
                  </div>
                  {/* PER MONTH */}
                  <div className="reg-field">
                    <label>
                      Per Month
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={
                        form.per_month
                      }
                      onChange={(
                        event
                      ) =>
                        setForm(
                          (
                            previous
                          ) => ({
                            ...previous,
                            per_month:
                              event.target
                                .value,
                          })
                        )
                      }
                      placeholder="Auto if blank"
                    />
                  </div>
                  {/* DEDUCTION START */}
                  <div className="reg-field">
                    <label>
                      Start Date of Deduction
                    </label>
                    <input
                      type="date"
                      value={
                        form.deduction_start_date
                      }
                      onChange={(
                        event
                      ) =>
                        setForm(
                          (
                            previous
                          ) => ({
                            ...previous,
                            deduction_start_date:
                              event.target
                                .value,
                          })
                        )
                      }
                      required
                    />
                  </div>
                  {/* FILE */}
                  <div className="reg-field full">
                    <label>
                      File Upload
                    </label>
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                      onChange={(
                        event
                      ) =>
                        setAttachment(
                          event.target
                            .files?.[0] ||
                            null
                        )
                      }
                    />
                  </div>
                </div>
                <div className="reg-modal-actions">
                  <button
                    className="reg-btn reg-btn-outline"
                    type="button"
                    onClick={
                      closeCreate
                    }
                    disabled={
                      creating
                    }
                  >
                    Cancel
                  </button>
                  <button
                    className="reg-btn reg-btn-primary"
                    type="submit"
                    disabled={
                      creating
                    }
                  >
                    {creating
                      ? "Saving..."
                      : "Save"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      {/* ===================================================
          VIEW MODAL
      =================================================== */}
      {viewRow && (
        <div
          className="reg-modal-overlay"
          onMouseDown={(
            event
          ) => {
            if (
              event.target.classList.contains(
                "reg-modal-overlay"
              )
            ) {
              setViewRow(
                null
              );
            }
          }}
        >
          <div
            className="reg-modal or-view-modal"
            onMouseDown={(
              event
            ) =>
              event.stopPropagation()
            }
          >
            <div className="reg-modal-head">
              <div>
                <h3 className="reg-modal-title">
                  Other Receivable Details
                </h3>
                <p className="reg-subtitle">
                  {viewRow.employee_name ||
                    staffDisplayName(
                      viewRow.employee_id
                    )}
                </p>
              </div>
              <button
                className="reg-x"
                type="button"
                onClick={() =>
                  setViewRow(
                    null
                  )
                }
              >
                ✕
              </button>
            </div>
            <div className="reg-form">
              <div className="or-view-status">
                <span
                  className={badgeClass(
                    viewRow.status
                  )}
                >
                  {viewRow.status ||
                    "Pending"}
                </span>
                <strong>
                  {viewRow.employee_name ||
                    staffDisplayName(
                      viewRow.employee_id
                    )}
                </strong>
              </div>
              <div className="reg-grid">
                <div className="reg-field">
                  <label>
                    Record ID
                  </label>
                  <input
                    value={
                      viewRow.id ??
                      "-"
                    }
                    readOnly
                  />
                </div>
                <div className="reg-field">
                  <label>
                    Employee ID
                  </label>
                  <input
                    value={
                      viewRow.employee_no ||
                      viewRow.employee_id ||
                      "-"
                    }
                    readOnly
                  />
                </div>
                <div className="reg-field">
                  <label>
                    Employee Name
                  </label>
                  <input
                    value={
                      viewRow.employee_name ||
                      staffDisplayName(
                        viewRow.employee_id
                      )
                    }
                    readOnly
                  />
                </div>
                <div className="reg-field">
                  <label>
                    Branch
                  </label>
                  <input
                    value={
                      viewRow.branch ||
                      viewRow.branch_id ||
                      "-"
                    }
                    readOnly
                  />
                </div>
                <div className="reg-field">
                  <label>
                    Area
                  </label>
                  <input
                    value={
                      viewRow.area ||
                      "-"
                    }
                    readOnly
                  />
                </div>
                <div className="reg-field">
                  <label>Region</label>
                  <input
                    value={
                      viewRow.region ||
                      "-"
                    }
                    readOnly
                  />
                </div>
                <div className="reg-field">
                  <label>Division</label>
                    <input value={viewRow.division || "-"}
                      readOnly
                    />
                </div>
                <div className="reg-field">
                  <label>Department</label>
                    <input value={viewRow.department || "-"}
                      readOnly
                    />
                </div>
                <div className="reg-field full">
                  <label>Description</label>
                    <textarea value={viewRow.description || "-"}
                      readOnly
                    />
                </div>
                <div className="reg-field">
                  <label>
                    Amount
                  </label>
                  <input
                    value={`₱ ${fmtMoney(
                      viewRow.amount
                    )}`}
                    readOnly
                  />
                </div>
                <div className="reg-field">
                  <label>
                    Terms
                  </label>
                  <input
                    value={
                      viewRow.term ??
                      "-"
                    }
                    readOnly
                  />
                </div>
                <div className="reg-field">
                  <label>
                    Per Month
                  </label>
                  <input
                    value={`₱ ${fmtMoney(
                      viewRow.per_month
                    )}`}
                    readOnly
                  />
                </div>
                <div className="reg-field">
                  <label>
                    Date of Release
                  </label>
                  <input
                    value={
                      fmtDate(
                        viewRow.release_date
                      )
                    }
                    readOnly
                  />
                </div>
                <div className="reg-field">
                  <label>
                    Deduction Start Date
                  </label>
                  <input
                    value={
                      fmtDate(
                        viewRow.deduction_start_date
                      )
                    }
                    readOnly
                  />
                </div>
                <div className="reg-field">
                  <label>
                    Status
                  </label>
                  <input
                    value={
                      viewRow.status ||
                      "Pending"
                    }
                    readOnly
                  />
                </div>
                <div className="reg-field">
                  <label>
                    Created Date
                  </label>
                  <input
                    value={
                      fmtDate(
                        viewRow.created_at
                      )
                    }
                    readOnly
                  />
                </div>
                <div className="reg-field">
                  <label>
                    Approved Date
                  </label>
                  <input
                    value={
                      fmtDate(
                        viewRow.approved_at
                      )
                    }
                    readOnly
                  />
                </div>
                <div className="reg-field">
                  <label>
                    Rejected / Void Date
                  </label>
                  <input
                    value={
                      fmtDate(
                        viewRow.rejected_at
                      )
                    }
                    readOnly
                  />
                </div>
                <div className="reg-field full">
                  <label>
                    File
                  </label>
                  <div className="or-view-file-row">
                    {viewRow.attachment_path ? (
                      <button
                        className="or-action-btn or-action-download"
                        type="button"
                        onClick={() =>
                          downloadFile(
                            viewRow
                          )
                        }
                      >
                        Download File
                      </button>
                    ) : (
                      <span>
                        No attachment
                      </span>
                    )}
                  </div>
                </div>
                {viewRow.rejection_reason && (
                  <div className="reg-field full">
                    <label>
                      Rejection / Void Reason
                    </label>
                      <textarea value={viewRow.rejection_reason}
                        readOnly
                      />
                  </div>
                )}
              </div>
              <div className="reg-modal-actions">
                <button
                  className="reg-btn reg-btn-outline"
                  type="button"
                  onClick={() =>
                    setViewRow(
                      null
                    )
                  }
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}