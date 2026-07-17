import React, { useEffect, useMemo, useState, useCallback } from "react";
import * as XLSX from "xlsx";
import "../styles/ScheduleBalances.css";
import api from "../api/axiosClient";

const MONEY_COLS = [
  { key: "cbu", label: "CBU" },
  { key: "cashbond", label: "Cashbond" },
  { key: "utility", label: "Utility" },
  { key: "salary_advance", label: "Salary Advance" },
  { key: "motorcycle_loan", label: "Motorcycle Loan" },
  { key: "special_advance", label: "Special Advance" },
  { key: "cash_advance", label: "Cash Advance" },
  { key: "other_receivable", label: "Other Receivable" },
  { key: "staff_accounts_payable", label: "Staff Accounts Payable" },
];

const OPENING_LOAN_TYPES = [
  "Salary Advance",
  "Special Advance",
  "Cash Advance",
  "Motorcycle Loan",
  "Other Loan",
];

const OPENING_LOAN_STATUSES = ["Active", "Paid", "Cancelled"];

const EMPTY_OPENING_LOAN_FORM = {
  id: null,
  staff_id: "",
  loan_type: "Salary Advance",
  original_amount: "",
  interest: "",
  interest_amount: "",
  total_amount: "",
  term_months: "",
  months_paid: "",
  per_month: "",
  remaining_balance: "",
  start_date: "",
  effective_date: "",
  status: "Active",
  remarks: "",
};

const toStr = (v) => String(v ?? "").trim();

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const fmtMoney = (v) =>
  `₱ ${toNum(v).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const getCurrentMonth = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}`;
};

const isCurrentMonth = (monthValue) => {
  return monthValue === getCurrentMonth();
};

const readUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
};

const displayName = (r) => {
  const ln = toStr(r?.last_name);
  const fn = toStr(r?.first_name);
  const mn = toStr(r?.middle_name);

  const built = `${ln}${ln && fn ? ", " : ""}${fn}${mn ? ` ${mn}` : ""}`
    .replace(/\s+/g, " ")
    .trim();

  return built || toStr(r?.fullname) || "-";
};

export default function ScheduleBalances() {
  const user = useMemo(() => readUser(), []);

  const role = String(user?.role || "").trim().toLowerCase();
  const isAdmin = role === "admin";
  const isBranchManager = role === "branch manager";
  const isAreaManager = role === "area manager";

  const department = String(user?.department || "")
    .trim()
    .toLowerCase();

  const isHRDepartment =
    department === "hr" ||
    department === "hr department" ||
    department === "human resources" ||
    department === "human resources department";

  const isITDepartment =
    department === "it" ||
    department === "it department";

  const isAccountingDepartment =
    department === "accounting" ||
    department === "accounting department";

  const canEditHistory =
    isAdmin ||
    isHRDepartment ||
    isITDepartment ||
    isAccountingDepartment;

  const canManageOpeningLoans = canEditHistory || isAreaManager;

  const userBranchRaw = useMemo(() => {
    const raw = user?.branch_id;
    return raw === null || raw === undefined || raw === "" ? "" : String(raw).trim();
  }, [user]);

  const userArea = useMemo(() => {
    return String(user?.area || "").trim();
  }, [user]);

  const [rows, setRows] = useState([]);
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [month, setMonth] = useState(getCurrentMonth());
  const [loading, setLoading] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [viewBranch, setViewBranch] = useState(null);
  const [branchStaffSearch, setBranchStaffSearch] = useState("");
  const [editingHistory, setEditingHistory] = useState(null);

  const [viewingYearlySavings, setViewingYearlySavings] =
    useState(null);

  const [yearlySavingsRows, setYearlySavingsRows] =
    useState([]);

  const [yearlySavingsLoading, setYearlySavingsLoading] =
    useState(false);

  const [yearlySavingsError, setYearlySavingsError] =
    useState("");

  const [yearlySavingsYear, setYearlySavingsYear] =
    useState(new Date().getFullYear());

  const [historyForm, setHistoryForm] = useState({
    cbu: "",
    cashbond: "",
    utility: "",
  });

  const [historySaving, setHistorySaving] = useState(false);
  const [historyError, setHistoryError] = useState("");

  const [openingLoanRows, setOpeningLoanRows] = useState([]);
  const [openingLoanLoading, setOpeningLoanLoading] = useState(false);
  const [openingLoanSaving, setOpeningLoanSaving] = useState(false);
  const [openingLoanError, setOpeningLoanError] = useState("");
  const [openingLoanForm, setOpeningLoanForm] = useState(
    EMPTY_OPENING_LOAN_FORM
  );

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/login";
  }, []);

  const fetchBranches = useCallback(async () => {
    try {
      const res = await api.get("/branches");
      const list = Array.isArray(res.data) ? res.data : [];
      setBranches(list);
    } catch (err) {
      if (err?.response?.status === 401) logout();
      setBranches([]);
    }
  }, [logout]);

  const filteredViewBranchStaff = useMemo(() => {
    const staffRows = Array.isArray(viewBranch?.staff_rows)
      ? viewBranch.staff_rows
      : [];

    const q = toStr(branchStaffSearch).toLowerCase();

    if (!q) {
      return staffRows;
    }

    return staffRows.filter((row) => {
      const searchableText = [
        row.employee_no,
        row.fullname,
        displayName(row),
        row.first_name,
        row.middle_name,
        row.last_name,
        row.position,
      ]
        .map((value) => toStr(value).toLowerCase())
        .join(" ");

      return searchableText.includes(q);
    });
  }, [viewBranch, branchStaffSearch]);

  const branchMap = useMemo(() => {
    const m = new Map();
    (branches || []).forEach((b) => m.set(String(b.id), b));
    return m;
  }, [branches]);

  const branchLabel = useCallback(
    (branchId) => {
      const b = branchMap.get(String(branchId));
      return b ? `${b.code} - ${b.name}` : "";
    },
    [branchMap]
  );

  const resolvedUserBranchId = useMemo(() => {
    if (!userBranchRaw) return "";

    const exactId = branches.find((b) => String(b.id) === String(userBranchRaw));
    if (exactId) return String(exactId.id);

    const byCode = branches.find(
      (b) => String(b.code || "").trim().toLowerCase() === userBranchRaw.toLowerCase()
    );
    if (byCode) return String(byCode.id);

    return "";
  }, [branches, userBranchRaw]);

  const visibleBranches = useMemo(() => {
    if (isBranchManager) {
      return branches.filter((b) => String(b.id) === String(resolvedUserBranchId));
    }

    if (isAreaManager) {
      return branches.filter(
        (b) => String(b.area || "").trim().toLowerCase() === userArea.toLowerCase()
      );
    }

    return branches;
  }, [branches, isBranchManager, isAreaManager, resolvedUserBranchId, userArea]);

  const effectiveBranchId = useMemo(() => {
    if (isBranchManager) return resolvedUserBranchId;
    if (isAreaManager) return "";
    return selectedBranch;
  }, [isBranchManager, isAreaManager, resolvedUserBranchId, selectedBranch]);

  const fetchLiveBalances = useCallback(
    async (branchId = effectiveBranchId, m = month) => {
      if (!m) return;

      setLoading(true);

      try {
        const finalBranchId = isBranchManager
          ? resolvedUserBranchId
          : branchId;

        /*
          Current month:
          Read changing values from staff_balances and transactions.

          Previous month:
          Read permanent records from schedule_balance_snapshots.
        */
        const endpoint = isCurrentMonth(m)
          ? "/schedule-balances/live"
          : "/schedule-balances";

        const res = await api.get(endpoint, {
          params: {
            month: m,
            ...(finalBranchId ? { branchId: finalBranchId } : {}),
          },
        });

        let data = Array.isArray(res.data) ? res.data : [];

        if (isBranchManager && finalBranchId) {
          data = data.filter(
            (r) => String(r.branch_id) === String(finalBranchId)
          );
        }

        if (isAreaManager) {
          const allowedIds = new Set(
            visibleBranches.map((b) => String(b.id))
          );

          data = data.filter((r) =>
            allowedIds.has(String(r.branch_id))
          );
        }

        setRows(data);
      } catch (err) {
        if (err?.response?.status === 401) {
          logout();
          return;
        }

        console.error("LOAD SCHEDULE BALANCES ERROR:", err);
        setRows([]);
      } finally {
        setLoading(false);
      }
    },
    [
      logout,
      effectiveBranchId,
      month,
      isBranchManager,
      isAreaManager,
      resolvedUserBranchId,
      visibleBranches,
    ]
  );

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  useEffect(() => {
    if (isBranchManager) {
      setSelectedBranch(resolvedUserBranchId);
    } else if (isAreaManager) {
      setSelectedBranch("");
    }
  }, [isBranchManager, isAreaManager, resolvedUserBranchId]);

  useEffect(() => {
    if (isBranchManager && !resolvedUserBranchId && branches.length > 0) {
      setRows([]);
      return;
    }

    fetchLiveBalances(effectiveBranchId, month);
  }, [
    effectiveBranchId,
    month,
    fetchLiveBalances,
    isBranchManager,
    resolvedUserBranchId,
    branches.length,
  ]);


  useEffect(() => {
    if (!viewBranch) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        setViewBranch(null);
        setBranchStaffSearch("");
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [viewBranch]);

  const handleSearch = () => setSearch(searchInput);

  const handleClear = () => {
    setSearch("");
    setSearchInput("");

    if (isBranchManager) {
      setSelectedBranch(resolvedUserBranchId);
    } else {
      setSelectedBranch("");
    }
  };

  const handleRefresh = () => fetchLiveBalances(effectiveBranchId, month);

  const resetOpeningLoanForm = useCallback((staffId = "") => {
    setOpeningLoanForm({
      ...EMPTY_OPENING_LOAN_FORM,
      staff_id: staffId ? String(staffId) : "",
    });
    setOpeningLoanError("");
  }, []);

  const fetchOpeningLoans = useCallback(async (staffId) => {
    if (!staffId) {
      setOpeningLoanRows([]);
      return;
    }

    try {
      setOpeningLoanLoading(true);
      setOpeningLoanError("");

      const res = await api.get(
        `/staff-loan-opening-balances/staff/${staffId}`
      );

      setOpeningLoanRows(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      if (err?.response?.status === 401) {
        logout();
        return;
      }

      setOpeningLoanRows([]);
      setOpeningLoanError(
        err?.response?.data?.message ||
          "Failed to load opening loan balances."
      );
    } finally {
      setOpeningLoanLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    const original = toNum(openingLoanForm.original_amount);
    const interest = toNum(openingLoanForm.interest);
    const term = toNum(openingLoanForm.term_months);
    const paid = toNum(openingLoanForm.months_paid);

    const interestAmount = Number(
      (original * (interest / 100)).toFixed(2)
    );

    const totalAmount = Number(
      (original + interestAmount).toFixed(2)
    );

    const perMonth =
      totalAmount > 0 && term > 0
        ? Number((totalAmount / term).toFixed(2))
        : 0;

    const safePaid = term > 0 ? Math.min(paid, term) : paid;

    const remainingBalance =
      totalAmount > 0
        ? Math.max(
            0,
            Number((totalAmount - perMonth * safePaid).toFixed(2))
          )
        : 0;

    setOpeningLoanForm((previous) => {
      const next = {
        ...previous,
        months_paid:
          term > 0 && paid > term ? String(term) : previous.months_paid,
        interest_amount: String(interestAmount),
        total_amount: String(totalAmount),
        per_month: String(perMonth),
        remaining_balance: String(remainingBalance),
      };

      if (
        next.months_paid === previous.months_paid &&
        next.interest_amount === previous.interest_amount &&
        next.total_amount === previous.total_amount &&
        next.per_month === previous.per_month &&
        next.remaining_balance === previous.remaining_balance
      ) {
        return previous;
      }

      return next;
    });
  }, [
    openingLoanForm.original_amount,
    openingLoanForm.interest,
    openingLoanForm.term_months,
    openingLoanForm.months_paid,
  ]);

  const openYearlySavings = async (row) => {
    const staffId = row?.staff_id || row?.id;

    if (!staffId) {
      alert("Staff ID is missing.");
      return;
    }

    const selectedYear = Number(
      String(month || getCurrentMonth()).slice(0, 4)
    );

    try {
      setYearlySavingsLoading(true);
      setYearlySavingsError("");
      setYearlySavingsRows([]);
      setYearlySavingsYear(selectedYear);
      setViewingYearlySavings(row);

      const response = await api.get(
        `/schedule-balances/staff/${staffId}/yearly-savings`,
        {
          params: {
            year: selectedYear,
          },
        }
      );

      setYearlySavingsRows(
        Array.isArray(response.data?.months)
          ? response.data.months
          : []
      );
    } catch (error) {
      if (error?.response?.status === 401) {
        logout();
        return;
      }

      setYearlySavingsError(
        error?.response?.data?.message ||
          "Failed to load yearly savings."
      );
    } finally {
      setYearlySavingsLoading(false);
    }
  };

  const openHistoryEdit = async (row) => {
    const staffId = row?.staff_id || row?.id;

    if (!staffId) {
      alert("Staff ID is missing.");
      return;
    }

    if (!isCurrentMonth(month) && !row?.id) {
      alert("Historical snapshot ID is missing.");
      return;
    }

    setEditingHistory(row);

    setHistoryForm({
      cbu: String(toNum(row.cbu)),
      cashbond: String(toNum(row.cashbond)),
      utility: String(toNum(row.utility)),
    });

    setHistoryError("");
    resetOpeningLoanForm(staffId);
    await fetchOpeningLoans(staffId);
  };

  const reloadYearlySavings = async (
    staffRow = viewingYearlySavings,
    yearValue = yearlySavingsYear
  ) => {
    const staffId = staffRow?.staff_id || staffRow?.id;

    if (!staffId) return;

    try {
      setYearlySavingsLoading(true);
      setYearlySavingsError("");

      const response = await api.get(
        `/schedule-balances/staff/${staffId}/yearly-savings`,
        {
          params: {
            year: yearValue,
          },
        }
      );

      setYearlySavingsRows(
        Array.isArray(response.data?.months)
          ? response.data.months
          : []
      );
    } catch (error) {
      setYearlySavingsError(
        error?.response?.data?.message ||
          "Failed to reload yearly savings."
      );
    } finally {
      setYearlySavingsLoading(false);
    }
  };

  const editYearlySavingsMonth = async (yearRow) => {
    if (!viewingYearlySavings) return;

    const source = String(
      yearRow?.balance_source || ""
    )
      .trim()
      .toLowerCase();

    if (source === "future") {
      alert("Future months cannot be edited.");
      return;
    }

    if (source === "missing") {
      alert(
        "No historical snapshot exists for this month."
      );
      return;
    }

    const currentStaffId =
      viewingYearlySavings.staff_id ||
      viewingYearlySavings.id;

    if (!currentStaffId) {
      alert("Staff ID is missing.");
      return;
    }

    if (
      source === "historical" &&
      !yearRow.snapshot_id
    ) {
      alert("Historical snapshot ID is missing.");
      return;
    }

    setHistoryForm({
      cbu: String(toNum(yearRow.cbu)),
      cashbond: String(toNum(yearRow.cashbond)),
      utility: String(toNum(yearRow.utility)),
    });

    setHistoryError("");

    resetOpeningLoanForm(currentStaffId);
    await fetchOpeningLoans(currentStaffId);

    setMonth(yearRow.month_label);

    if (source === "current") {
      setEditingHistory({
        ...viewingYearlySavings,

        id: currentStaffId,
        staff_id: currentStaffId,

        cbu: yearRow.cbu,
        cashbond: yearRow.cashbond,
        utility: yearRow.utility,

        yearly_source: "current",
        yearly_month_label: yearRow.month_label,
      });

      return;
    }

    setEditingHistory({
      ...viewingYearlySavings,

      id: yearRow.snapshot_id,
      staff_id: currentStaffId,

      cbu: yearRow.cbu,
      cashbond: yearRow.cashbond,
      utility: yearRow.utility,

      yearly_source: "historical",
      yearly_month_label: yearRow.month_label,
    });
  };

  const closeHistoryEdit = () => {
    if (historySaving || openingLoanSaving) return;

    setEditingHistory(null);

    setHistoryForm({
      cbu: "",
      cashbond: "",
      utility: "",
    });

    setHistoryError("");
    setOpeningLoanRows([]);
    resetOpeningLoanForm("");
  };

  const saveCurrentBalanceEdit = async (e) => {
    e.preventDefault();

    if (
      !isCurrentMonth(month) ||
      !editingHistory ||
      historySaving
    ) {
      return;
    }

    const staffId =
      editingHistory.staff_id ||
      editingHistory.id;

    if (!staffId) {
      setHistoryError("Staff ID is missing.");
      return;
    }

    const cbu = Number(historyForm.cbu);
    const cashbond = Number(historyForm.cashbond);
    const utility = Number(historyForm.utility);

    if (
      !Number.isFinite(cbu) ||
      !Number.isFinite(cashbond) ||
      !Number.isFinite(utility)
    ) {
      setHistoryError(
        "CBU, Cashbond, and Utility must be valid numbers."
      );
      return;
    }

    if (cbu < 0 || cashbond < 0 || utility < 0) {
      setHistoryError(
        "CBU, Cashbond, and Utility cannot be negative."
      );
      return;
    }

    try {
      setHistorySaving(true);
      setHistoryError("");

      await api.put(
        `/schedule-balances/current/${staffId}/manual-edit`,
        {
          cbu,
          cashbond,
          utility,
        }
      );

      setEditingHistory((previous) => ({
        ...previous,
        cbu,
        cashbond,
        utility,
      }));

      await fetchLiveBalances(effectiveBranchId, month);

      if (viewingYearlySavings) {
        await reloadYearlySavings(
          viewingYearlySavings,
          yearlySavingsYear
        );
      }

      alert("Current staff balance updated successfully.");
    } catch (err) {
      if (err?.response?.status === 401) {
        logout();
        return;
      }

      setHistoryError(
        err?.response?.data?.message ||
          "Failed to update current staff balance."
      );
    } finally {
      setHistorySaving(false);
    }
  };

  const saveHistoryEdit = async (e) => {
    e.preventDefault();

    if (
      isCurrentMonth(month) ||
      !editingHistory?.id ||
      historySaving
    ) {
      return;
    }

    const cbu = Number(historyForm.cbu);
    const cashbond = Number(historyForm.cashbond);
    const utility = Number(historyForm.utility);

    if (
      !Number.isFinite(cbu) ||
      !Number.isFinite(cashbond) ||
      !Number.isFinite(utility)
    ) {
      setHistoryError("CBU, Cashbond, and Utility must be valid numbers.");
      return;
    }

    if (cbu < 0 || cashbond < 0 || utility < 0) {
      setHistoryError("CBU, Cashbond, and Utility cannot be negative.");
      return;
    }

    setHistorySaving(true);
    setHistoryError("");

    try {
      await api.put(
        `/schedule-balances/snapshot/${editingHistory.id}/manual-edit`,
        {
          cbu,
          cashbond,
          utility,
        }
      );

      setEditingHistory((previous) => ({
        ...previous,
        cbu,
        cashbond,
        utility,
      }));

      await fetchLiveBalances(
        effectiveBranchId,
        month
      );

      if (viewingYearlySavings) {
        await reloadYearlySavings(
          viewingYearlySavings,
          yearlySavingsYear
        );
      }
    } catch (err) {
      if (err?.response?.status === 401) {
        logout();
        return;
      }

      setHistoryError(
        err?.response?.data?.message ||
          "Failed to update historical balance."
      );
    } finally {
      setHistorySaving(false);
    }
  };

  const editOpeningLoan = (row) => {
    setOpeningLoanForm({
      id: row.id,
      staff_id: row.staff_id,
      loan_type: row.loan_type || "Salary Advance",
      original_amount: row.original_amount ?? "",
      interest: row.interest ?? "",
      interest_amount: row.interest_amount ?? "",
      total_amount: row.total_amount ?? "",
      term_months: row.term_months ?? "",
      months_paid: row.months_paid ?? "",
      per_month: row.per_month ?? "",
      remaining_balance: row.remaining_balance ?? "",
      start_date: row.start_date
        ? String(row.start_date).slice(0, 10)
        : "",
      effective_date: row.effective_date
        ? String(row.effective_date).slice(0, 10)
        : "",
      status: row.status || "Active",
      remarks: row.remarks || "",
    });

    setOpeningLoanError("");
  };

  const saveOpeningLoan = async (e) => {
    e.preventDefault();

    if (!canManageOpeningLoans || openingLoanSaving) return;

    const staffId = editingHistory?.staff_id || editingHistory?.id;

    if (!staffId) {
      setOpeningLoanError("Staff ID is missing.");
      return;
    }

    if (!toStr(openingLoanForm.loan_type)) {
      setOpeningLoanError("Loan type is required.");
      return;
    }

    if (toNum(openingLoanForm.original_amount) <= 0) {
      setOpeningLoanError("Original amount must be greater than zero.");
      return;
    }

    if (toNum(openingLoanForm.term_months) <= 0) {
      setOpeningLoanError("Term months must be greater than zero.");
      return;
    }

    try {
      setOpeningLoanSaving(true);
      setOpeningLoanError("");

      const payload = {
        ...openingLoanForm,
        staff_id: Number(staffId),
      };

      if (openingLoanForm.id) {
        await api.put(
          `/staff-loan-opening-balances/${openingLoanForm.id}`,
          payload
        );
      } else {
        await api.post("/staff-loan-opening-balances", payload);
      }

      resetOpeningLoanForm(staffId);
      await fetchOpeningLoans(staffId);
      await fetchLiveBalances(effectiveBranchId, month);
    } catch (err) {
      if (err?.response?.status === 401) {
        logout();
        return;
      }

      setOpeningLoanError(
        err?.response?.data?.message ||
          "Failed to save opening loan balance."
      );
    } finally {
      setOpeningLoanSaving(false);
    }
  };

  const deleteOpeningLoan = async (id) => {
    if (!canManageOpeningLoans || openingLoanSaving) return;

    if (!window.confirm("Delete this opening loan balance?")) return;

    const staffId = editingHistory?.staff_id || editingHistory?.id;

    try {
      setOpeningLoanSaving(true);
      setOpeningLoanError("");

      await api.delete(`/staff-loan-opening-balances/${id}`);

      resetOpeningLoanForm(staffId);
      await fetchOpeningLoans(staffId);
      await fetchLiveBalances(effectiveBranchId, month);
    } catch (err) {
      if (err?.response?.status === 401) {
        logout();
        return;
      }

      setOpeningLoanError(
        err?.response?.data?.message ||
          "Failed to delete opening loan balance."
      );
    } finally {
      setOpeningLoanSaving(false);
    }
  };

  const filteredEmployeeRows = useMemo(() => {
    const q = toStr(search).toLowerCase();
    if (!q) return rows;

    return rows.filter((r) => {
      const hay = [
        r.employee_no,
        r.fullname,
        displayName(r),
        r.position,
        branchLabel(r.branch_id),
      ]
        .map((x) => String(x ?? "").toLowerCase())
        .join(" ");

      return hay.includes(q);
    });
  }, [rows, search, branchLabel]);

  const groupedBranches = useMemo(() => {
    const map = new Map();

    for (const r of filteredEmployeeRows) {
      const rawBranchId = r.branch_id;

      if (rawBranchId === null || rawBranchId === undefined || String(rawBranchId).trim() === "") {
        continue;
      }

      const branch = branchMap.get(String(rawBranchId));

      if (!branch) {
        continue;
      }

      if (isBranchManager && String(rawBranchId) !== String(resolvedUserBranchId)) continue;

      if (isAreaManager) {
        const branchArea = String(branch?.area || "").trim().toLowerCase();
        if (branchArea !== userArea.toLowerCase()) continue;
      }

      const key = String(rawBranchId);

      const existing = map.get(key) || {
        branch_id: rawBranchId,
        branch_label: `${toStr(branch.code)} - ${toStr(branch.name)}`,
        staff_count: 0,
        staff_rows: [],
        cbu: 0,
        cashbond: 0,
        utility: 0,
        salary_advance: 0,
        motorcycle_loan: 0,
        special_advance: 0,
        cash_advance: 0,
        other_receivable: 0,
        staff_accounts_payable: 0,
      };

      existing.staff_count += 1;
      existing.staff_rows.push(r);

      for (const c of MONEY_COLS) {
        existing[c.key] += toNum(r[c.key]);
      }

      map.set(key, existing);
    }

    return Array.from(map.values()).sort((a, b) =>
      a.branch_label.localeCompare(b.branch_label)
    );
  }, [
    filteredEmployeeRows,
    isBranchManager,
    isAreaManager,
    resolvedUserBranchId,
    branchMap,
    userArea,
  ]);

  useEffect(() => {
    if (!viewBranch) return;

    const refreshedBranch = groupedBranches.find(
      (branch) =>
        String(branch.branch_id) === String(viewBranch.branch_id)
    );

    if (refreshedBranch) {
      setViewBranch(refreshedBranch);
    }
  }, [groupedBranches, viewBranch?.branch_id]);

  const totals = useMemo(() => {
    const t = Object.fromEntries(MONEY_COLS.map((c) => [c.key, 0]));
    for (const row of groupedBranches) {
      for (const c of MONEY_COLS) {
        t[c.key] += toNum(row[c.key]);
      }
    }
    return t;
  }, [groupedBranches]);

  const totalStaffCount = useMemo(
    () => groupedBranches.reduce((sum, r) => sum + Number(r.staff_count || 0), 0),
    [groupedBranches]
  );

  const exportToExcel = () => {
    const data = groupedBranches.map((r) => ({
      "Month Label": month,
      "Branch ID": r.branch_id ?? "",
      Branch: r.branch_label,
      "Staff Count": r.staff_count,
      CBU: toNum(r.cbu),
      Cashbond: toNum(r.cashbond),
      Utility: toNum(r.utility),
      "Salary Advance": toNum(r.salary_advance),
      "Motorcycle Loan": toNum(r.motorcycle_loan),
      "Special Advance": toNum(r.special_advance),
      "Cash Advance": toNum(r.cash_advance),
      "Other Receivable": toNum(r.other_receivable),
      "Staff Accounts Payable": toNum(r.staff_accounts_payable),
    }));

    data.unshift({
      "Month Label": month,
      "Branch ID": "",
      Branch: "TOTAL",
      "Staff Count": totalStaffCount,
      CBU: totals.cbu,
      Cashbond: totals.cashbond,
      Utility: totals.utility,
      "Salary Advance": totals.salary_advance,
      "Motorcycle Loan": totals.motorcycle_loan,
      "Special Advance": totals.special_advance,
      "Cash Advance": totals.cash_advance,
      "Other Receivable": totals.other_receivable,
      "Staff Accounts Payable": totals.staff_accounts_payable,
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ScheduleBalancesByBranch");
    XLSX.writeFile(wb, `ScheduleBalances_ByBranch_${month}.xlsx`);
  };

  const currentBranchText = useMemo(() => {
    if (isAreaManager) {
      return userArea || "My Area";
    }
    if (effectiveBranchId) return branchLabel(effectiveBranchId) || effectiveBranchId;
    if (isBranchManager && userBranchRaw) return userBranchRaw;
    return "All";
  }, [effectiveBranchId, branchLabel, isBranchManager, isAreaManager, userBranchRaw, userArea]);

  return (
    <div className="balances-page">
      <div className="balances-page-header">
        <div>
          <h2 className="balances-title">Schedule of Balances</h2>
          <p className="balances-subtitle">
            Per-branch balances from current transactions and staff balances.
          </p>
        </div>

        <div className="balances-actions">
          <input
            className="search-input"
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />

          <input
            className="search-input"
            type="text"
            placeholder="Search employee no, name, or position..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />

          <select
            className="branch-select"
            value={effectiveBranchId}
            onChange={(e) => {
              if (isBranchManager || isAreaManager) return;
              setSelectedBranch(e.target.value);
            }}
            disabled={isBranchManager || isAreaManager}
          >
            {!isBranchManager && !isAreaManager && <option value="">All Branches</option>}
            {visibleBranches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.code} - {b.name}
              </option>
            ))}
          </select>

          <button className="btn-secondary" onClick={handleSearch} type="button">
            Search
          </button>

          <button className="btn-secondary" onClick={handleClear} type="button">
            Clear
          </button>

          <button
            className="btn-secondary"
            onClick={handleRefresh}
            type="button"
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>

          <button
            className="btn-primary"
            onClick={exportToExcel}
            type="button"
            disabled={groupedBranches.length === 0}
          >
            Export Excel
          </button>
        </div>
      </div>

      <div className="balances-card">
        <div className="balances-card-header">
          <div className="balances-card-title">
            Branch Records <span className="balances-count">{groupedBranches.length}</span>
            <span style={{ marginLeft: 10, fontSize: 12, opacity: 0.8 }}>
              Month Label: <b>{month || "-"}</b> • Branch/Area: <b>{currentBranchText}</b>
            </span>
          </div>
          {loading && <div className="balances-loading">Loading…</div>}
        </div>

        <div className="balances-table-wrapper">
          <table className="balances-table">
            <thead>
              <tr>
                <th>Branch</th>
                <th>Staff Count</th>
                {MONEY_COLS.map((c) => (
                  <th key={c.key}>{c.label}</th>
                ))}
                <th>Action</th>
              </tr>

              {!loading && groupedBranches.length > 0 && (
                <tr className="totals-row">
                  <th className="totals-label">TOTAL</th>
                  <th className="totals-money">{totalStaffCount}</th>

                  {MONEY_COLS.map((c) => (
                    <th key={c.key} className="totals-money">
                      {fmtMoney(totals[c.key])}
                    </th>
                  ))}

                  <th></th>
                </tr>
              )}
            </thead>

            <tbody>
              {!loading && groupedBranches.length === 0 ? (
                <tr>
                  <td colSpan={MONEY_COLS.length + 3} className="empty-state">
                    No data found.
                  </td>
                </tr>
              ) : (
                groupedBranches.map((item, idx) => (
                  <tr key={`${item.branch_id}-${idx}`}>
                    <td className="td-strong">{item.branch_label}</td>
                    <td>{item.staff_count}</td>

                    {MONEY_COLS.map((c) => (
                      <td key={c.key} className="td-money">
                        {fmtMoney(item[c.key])}
                      </td>
                    ))}

                    <td>
                      <button
                        className="btn-secondary"
                        type="button"
                        onClick={() => {
                          setBranchStaffSearch("");
                          setViewBranch(item);
                        }}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {viewBranch && (
        <div
          className="modal-overlay"
          onMouseDown={(e) => {
            if (e.target.classList.contains("modal-overlay")) {
              setViewBranch(null);
              setBranchStaffSearch("");
            }
          }}
        >
          <div
            className="modal saas-modal"
            style={{ maxWidth: 1200, width: "95vw" }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <h3 className="modal-title">{viewBranch.branch_label}</h3>
                <p className="modal-subtitle">Staff assigned to this branch</p>
              </div>

              <button
                className="modal-x"
                type="button"
                onClick={() => {
                  setViewBranch(null);
                  setBranchStaffSearch("");
                }}
              >
                ✕
              </button>
            </div>

            <div className="branch-staff-search-bar">
              <input
                className="branch-staff-search-input"
                type="text"
                placeholder="Search employee number, staff name, or position..."
                value={branchStaffSearch}
                onChange={(e) => setBranchStaffSearch(e.target.value)}
                autoFocus
              />

              {branchStaffSearch ? (
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={() => setBranchStaffSearch("")}
                >
                  Clear
                </button>
              ) : null}

              <span className="branch-staff-search-count">
                Showing {filteredViewBranchStaff.length} of{" "}
                {viewBranch.staff_rows.length}
              </span>
            </div>

            <div className="table-card">
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Employee No</th>
                      <th>Full Name</th>
                      <th>Position</th>

                      {MONEY_COLS.map((c) => (
                        <th key={c.key}>{c.label}</th>
                      ))}

                      <th>Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredViewBranchStaff.length === 0 ? (
                      <tr>
                        <td
                          colSpan={MONEY_COLS.length + 4}
                          className="empty-state"
                        >
                          {branchStaffSearch
                            ? "No staff matched your search."
                            : "No staff found."}
                        </td>
                      </tr>
                    ) : (
                      filteredViewBranchStaff.map((r, idx) => (
                        <tr key={`${r.employee_no || idx}-${idx}`}>
                          <td>{r.employee_no ?? "-"}</td>

                          <td className="td-strong">
                            {displayName(r)}
                          </td>

                          <td>{r.position ?? "-"}</td>

                          {MONEY_COLS.map((c) => (
                            <td key={c.key} className="td-money">
                              {fmtMoney(r[c.key])}
                            </td>
                          ))}

                          <td>
                            <div className="staff-action-cell">
                              <button
                                type="button"
                                className="staff-view-btn"
                                onClick={() => openYearlySavings(r)}
                              >
                                View
                              </button>

                              {canEditHistory || canManageOpeningLoans ? (
                                <button
                                  type="button"
                                  className="staff-edit-btn"
                                  onClick={() => openHistoryEdit(r)}
                                >
                                  {isCurrentMonth(month)
                                    ? "Edit Current"
                                    : "Edit History"}
                                </button>
                              ) : (
                                <span
                                  style={{
                                    fontSize: 12,
                                    opacity: 0.7,
                                  }}
                                >
                                  View only
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="modal-buttons">
              <button
                className="btn-secondary"
                type="button"
                onClick={() => {
                  setViewBranch(null);
                  setBranchStaffSearch("");
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {viewingYearlySavings && !editingHistory && (
        <div
          className="modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target.classList.contains(
                "modal-overlay"
              )
            ) {
              setViewingYearlySavings(null);
              setYearlySavingsRows([]);
              setYearlySavingsError("");
            }
          }}
        >
          <div
            className="modal saas-modal yearly-savings-modal"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            <div className="modal-head">
              <div>
                <h3 className="modal-title">
                  Yearly Savings
                </h3>

                <p className="modal-subtitle">
                  {viewingYearlySavings.employee_no || "-"}
                  {" — "}
                  {displayName(viewingYearlySavings)}
                </p>
              </div>

              <button
                className="modal-x"
                type="button"
                onClick={() => {
                  setViewingYearlySavings(null);
                  setYearlySavingsRows([]);
                  setYearlySavingsError("");
                }}
              >
                ✕
              </button>
            </div>

            <div className="yearly-savings-toolbar">
              <label>
                Year
                <input
                  type="number"
                  min="2000"
                  max="2100"
                  value={yearlySavingsYear}
                  onChange={(event) => {
                    const nextYear = Number(
                      event.target.value
                    );

                    setYearlySavingsYear(nextYear);
                  }}
                />
              </label>

              <button
                className="btn-secondary"
                type="button"
                disabled={yearlySavingsLoading}
                onClick={() =>
                  reloadYearlySavings(
                    viewingYearlySavings,
                    yearlySavingsYear
                  )
                }
              >
                {yearlySavingsLoading
                  ? "Loading..."
                  : "Load Year"}
              </button>
            </div>

            {yearlySavingsError && (
              <div className="yearly-savings-error">
                {yearlySavingsError}
              </div>
            )}

            <div className="table-wrap yearly-savings-table-wrap">
              <table className="table yearly-savings-table">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>CBU</th>
                    <th>Cashbond</th>
                    <th>Utility</th>
                    <th>Record Type</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {yearlySavingsLoading ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="empty-state"
                      >
                        Loading yearly savings...
                      </td>
                    </tr>
                  ) : yearlySavingsRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="empty-state"
                      >
                        No yearly savings data found.
                      </td>
                    </tr>
                  ) : (
                    yearlySavingsRows.map((row) => {
                      const source =
                        String(
                          row.balance_source || ""
                        ).toLowerCase();

                      const canEditRow =
                        canEditHistory &&
                        ["current", "historical"].includes(
                          source
                        );

                      return (
                        <tr key={row.month_label}>
                          <td className="td-strong">
                            {String(
                              row.month_name || ""
                            ).trim()}
                          </td>

                          <td className="td-money">
                            {row.cbu === null
                              ? "-"
                              : fmtMoney(row.cbu)}
                          </td>

                          <td className="td-money">
                            {row.cashbond === null
                              ? "-"
                              : fmtMoney(row.cashbond)}
                          </td>

                          <td className="td-money">
                            {row.utility === null
                              ? "-"
                              : fmtMoney(row.utility)}
                          </td>

                          <td>
                            <span
                              className={`yearly-source-badge ${source}`}
                            >
                              {source === "current"
                                ? "Current"
                                : source === "historical"
                                  ? "Historical"
                                  : source === "future"
                                    ? "Future"
                                    : "No Snapshot"}
                            </span>
                          </td>

                          <td>
                            {canEditRow ? (
                              <button
                                className="staff-edit-btn"
                                type="button"
                                onClick={() =>
                                  editYearlySavingsMonth(row)
                                }
                              >
                                Edit
                              </button>
                            ) : (
                              <span
                                style={{
                                  color: "var(--muted)",
                                  fontSize: 12,
                                }}
                              >
                                —
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="modal-buttons">
              <button
                className="btn-secondary"
                type="button"
                onClick={() => {
                  setViewingYearlySavings(null);
                  setYearlySavingsRows([]);
                  setYearlySavingsError("");
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {editingHistory && (
        <div
          className="modal-overlay"
          onMouseDown={(e) => {
            if (
              !historySaving &&
              !openingLoanSaving &&
              e.target.classList.contains("modal-overlay")
            ) {
              closeHistoryEdit();
            }
          }}
        >
          <div
            className="modal saas-modal"
            style={{
              maxWidth: 1180,
              width: "96vw",
              maxHeight: "92vh",
              overflowY: "auto",
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <h3 className="modal-title">
                  {isCurrentMonth(month)
                    ? "Current Balances and Opening Loans"
                    : "Edit Historical Balance"}
                </h3>

                <p className="modal-subtitle">
                  {editingHistory.employee_no || "-"} —{" "}
                  {displayName(editingHistory)} — {month}
                </p>
              </div>

              <button
                className="modal-x"
                type="button"
                onClick={closeHistoryEdit}
                disabled={historySaving || openingLoanSaving}
              >
                ✕
              </button>
            </div>

            {isCurrentMonth(month) && canEditHistory && (
              <form onSubmit={saveCurrentBalanceEdit}>
                <h4 style={{ margin: "0 0 6px" }}>
                  Current Staff Savings and Utility
                </h4>

                <p
                  style={{
                    margin: "0 0 14px",
                    color: "var(--muted)",
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  Updating these values changes the staff&apos;s current
                  CBU, Cashbond, and Utility balance.
                </p>

                <div className="form-grid">
                  <div className="field">
                    <label>Current CBU</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={historyForm.cbu}
                      onChange={(e) =>
                        setHistoryForm((previous) => ({
                          ...previous,
                          cbu: e.target.value,
                        }))
                      }
                      required
                    />
                  </div>

                  <div className="field">
                    <label>Current Cashbond</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={historyForm.cashbond}
                      onChange={(e) =>
                        setHistoryForm((previous) => ({
                          ...previous,
                          cashbond: e.target.value,
                        }))
                      }
                      required
                    />
                  </div>

                  <div className="field">
                    <label>Current Utility</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={historyForm.utility}
                      onChange={(e) =>
                        setHistoryForm((previous) => ({
                          ...previous,
                          utility: e.target.value,
                        }))
                      }
                      required
                    />
                  </div>
                </div>

                {historyError && (
                  <div
                    style={{
                      marginTop: 12,
                      color: "#ef4444",
                      fontWeight: 800,
                    }}
                  >
                    {historyError}
                  </div>
                )}

                <div className="modal-buttons">
                  <button
                    className="btn-primary"
                    type="submit"
                    disabled={historySaving}
                  >
                    {historySaving
                      ? "Saving..."
                      : "Save Current Balances"}
                  </button>
                </div>
              </form>
            )}

            {!isCurrentMonth(month) && canEditHistory && (
              <form onSubmit={saveHistoryEdit}>
                <h4 style={{ margin: "0 0 12px" }}>
                  Historical Balance Correction
                </h4>

                <div className="form-grid">
                  <div className="field">
                    <label>CBU</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={historyForm.cbu}
                      onChange={(e) =>
                        setHistoryForm((previous) => ({
                          ...previous,
                          cbu: e.target.value,
                        }))
                      }
                      required
                    />
                  </div>

                  <div className="field">
                    <label>Cashbond</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={historyForm.cashbond}
                      onChange={(e) =>
                        setHistoryForm((previous) => ({
                          ...previous,
                          cashbond: e.target.value,
                        }))
                      }
                      required
                    />
                  </div>

                  <div className="field">
                    <label>Utility</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={historyForm.utility}
                      onChange={(e) =>
                        setHistoryForm((previous) => ({
                          ...previous,
                          utility: e.target.value,
                        }))
                      }
                      required
                    />
                  </div>
                </div>

                {historyError && (
                  <div
                    style={{
                      marginTop: 12,
                      color: "#ef4444",
                      fontWeight: 800,
                    }}
                  >
                    {historyError}
                  </div>
                )}

                <div className="modal-buttons">
                  <button
                    className="btn-primary"
                    type="submit"
                    disabled={historySaving}
                  >
                    {historySaving
                      ? "Saving..."
                      : "Save Historical Correction"}
                  </button>
                </div>
              </form>
            )}

            <div
              style={{
                borderTop: "1px solid var(--border)",
                marginTop: 18,
                paddingTop: 18,
              }}
            >
              <h4 style={{ margin: "0 0 12px" }}>
                Opening Loan Balance
              </h4>

              <form onSubmit={saveOpeningLoan}>
                <div className="form-grid">
                  <div className="field">
                    <label>Loan Type</label>
                    <select
                      value={openingLoanForm.loan_type}
                      onChange={(e) =>
                        setOpeningLoanForm((previous) => ({
                          ...previous,
                          loan_type: e.target.value,
                        }))
                      }
                      required
                    >
                      {OPENING_LOAN_TYPES.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label>Original Amount</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={openingLoanForm.original_amount}
                      onChange={(e) =>
                        setOpeningLoanForm((previous) => ({
                          ...previous,
                          original_amount: e.target.value,
                        }))
                      }
                      required
                    />
                  </div>

                  <div className="field">
                    <label>Interest (%)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={openingLoanForm.interest}
                      onChange={(e) =>
                        setOpeningLoanForm((previous) => ({
                          ...previous,
                          interest: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="field">
                    <label>Interest Amount</label>
                    <input
                      value={openingLoanForm.interest_amount}
                      readOnly
                    />
                  </div>

                  <div className="field">
                    <label>Total Amount</label>
                    <input
                      value={openingLoanForm.total_amount}
                      readOnly
                    />
                  </div>

                  <div className="field">
                    <label>Term Months</label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={openingLoanForm.term_months}
                      onChange={(e) =>
                        setOpeningLoanForm((previous) => ({
                          ...previous,
                          term_months: e.target.value,
                        }))
                      }
                      required
                    />
                  </div>

                  <div className="field">
                    <label>Months Paid</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={openingLoanForm.months_paid}
                      onChange={(e) =>
                        setOpeningLoanForm((previous) => ({
                          ...previous,
                          months_paid: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="field">
                    <label>Per Month</label>
                    <input value={openingLoanForm.per_month} readOnly />
                  </div>

                  <div className="field">
                    <label>Remaining Balance</label>
                    <input
                      value={openingLoanForm.remaining_balance}
                      readOnly
                    />
                  </div>

                  <div className="field">
                    <label>Start Date</label>
                    <input
                      type="date"
                      value={openingLoanForm.start_date}
                      onChange={(e) =>
                        setOpeningLoanForm((previous) => ({
                          ...previous,
                          start_date: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="field">
                    <label>Effective Date</label>
                    <input
                      type="date"
                      value={openingLoanForm.effective_date}
                      onChange={(e) =>
                        setOpeningLoanForm((previous) => ({
                          ...previous,
                          effective_date: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="field">
                    <label>Status</label>
                    <select
                      value={openingLoanForm.status}
                      onChange={(e) =>
                        setOpeningLoanForm((previous) => ({
                          ...previous,
                          status: e.target.value,
                        }))
                      }
                    >
                      {OPENING_LOAN_STATUSES.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field" style={{ gridColumn: "1 / -1" }}>
                    <label>Remarks</label>
                    <textarea
                      rows={3}
                      value={openingLoanForm.remarks}
                      onChange={(e) =>
                        setOpeningLoanForm((previous) => ({
                          ...previous,
                          remarks: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                {openingLoanError && (
                  <div
                    style={{
                      marginTop: 12,
                      color: "#ef4444",
                      fontWeight: 800,
                    }}
                  >
                    {openingLoanError}
                  </div>
                )}

                <div className="modal-buttons">
                  <button
                    className="btn-secondary"
                    type="button"
                    onClick={() =>
                      resetOpeningLoanForm(
                        editingHistory.staff_id || editingHistory.id
                      )
                    }
                    disabled={openingLoanSaving}
                  >
                    Clear
                  </button>

                  <button
                    className="btn-primary"
                    type="submit"
                    disabled={
                      !canManageOpeningLoans || openingLoanSaving
                    }
                  >
                    {openingLoanSaving
                      ? "Saving..."
                      : openingLoanForm.id
                        ? "Update Opening Loan"
                        : "Save Opening Loan"}
                  </button>
                </div>
              </form>

              <div className="table-card" style={{ marginTop: 18 }}>
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Loan Type</th>
                        <th>Original</th>
                        <th>Interest</th>
                        <th>Total</th>
                        <th>Term</th>
                        <th>Paid</th>
                        <th>Per Month</th>
                        <th>Remaining</th>
                        <th>Status</th>
                        <th>Effective</th>
                        <th>Action</th>
                      </tr>
                    </thead>

                    <tbody>
                      {openingLoanLoading ? (
                        <tr>
                          <td colSpan={11} className="empty-state">
                            Loading...
                          </td>
                        </tr>
                      ) : openingLoanRows.length === 0 ? (
                        <tr>
                          <td colSpan={11} className="empty-state">
                            No opening loan balances found.
                          </td>
                        </tr>
                      ) : (
                        openingLoanRows.map((row) => (
                          <tr key={row.id}>
                            <td>{row.loan_type}</td>
                            <td>{fmtMoney(row.original_amount)}</td>
                            <td>{toNum(row.interest).toFixed(2)}%</td>
                            <td>{fmtMoney(row.total_amount)}</td>
                            <td>{row.term_months}</td>
                            <td>{row.months_paid}</td>
                            <td>{fmtMoney(row.per_month)}</td>
                            <td>{fmtMoney(row.remaining_balance)}</td>
                            <td>{row.status}</td>
                            <td>
                              {row.effective_date
                                ? String(row.effective_date).slice(0, 10)
                                : "-"}
                            </td>
                            <td>
                              <div className="row-actions">
                                <button
                                  className="btn-secondary"
                                  type="button"
                                  onClick={() => editOpeningLoan(row)}
                                  disabled={openingLoanSaving}
                                >
                                  Edit
                                </button>

                                <button
                                  className="btn-danger"
                                  type="button"
                                  onClick={() => deleteOpeningLoan(row.id)}
                                  disabled={openingLoanSaving}
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="modal-buttons">
              <button
                className="btn-secondary"
                type="button"
                onClick={closeHistoryEdit}
                disabled={historySaving || openingLoanSaving}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}