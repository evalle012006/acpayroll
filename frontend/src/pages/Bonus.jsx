import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api/axiosClient";
import "../styles/Bonus.css";
import { BsThreeDotsVertical } from "react-icons/bs";

const toNum = (v) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const toStr = (v) => String(v ?? "").trim();
const norm = (v) => toStr(v).toLowerCase();
const isActiveStaff = (s) => norm(s.status || "Active") !== "inactive";

const fmtMoney = (v) =>
  toNum(v).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const todayDate = () => new Date().toISOString().slice(0, 10);

const formatDisplayDate = (value) => {
  if (!value) return "-";

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";

  return d.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
};

const isValidDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || "").trim());

const parseDate = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

const monthKey = (dateLike) => {
  const d = parseDate(dateLike);
  if (!d) return null;
  return d.getFullYear() * 12 + d.getMonth();
};

const currentBonusMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
};

const getYearFromBonusMonth = (bonusMonth) => {
  const d = parseDate(bonusMonth);
  return d ? d.getFullYear() : new Date().getFullYear();
};

const getMonthIndexFromBonusMonth = (bonusMonth) => {
  const d = parseDate(bonusMonth);
  return d ? d.getMonth() : new Date().getMonth();
};

const formatMonthYearLabel = (value) => {
  const d = parseDate(value);
  if (!d) return value;
  return `${d.toLocaleString("default", { month: "long" })} ${d.getFullYear()}`;
};

const buildMonthYearOptions = (staffRows = []) => {
  const current = new Date();
  let minDate = new Date(current.getFullYear(), 0, 1);

  for (const s of staffRows) {
    const start = parseDate(s?.start_date);
    if (start) {
      const normalized = new Date(start.getFullYear(), start.getMonth(), 1);
      if (normalized < minDate) minDate = normalized;
    }
  }

  const options = [];
  const cursor = new Date(current.getFullYear(), current.getMonth(), 1);

  while (cursor >= minDate) {
    const value = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-01`;
    options.push({
      value,
      label: formatMonthYearLabel(value),
    });
    cursor.setMonth(cursor.getMonth() - 1);
  }

  return options;
};

const computeProratedBonusFromHistory = ({
  employeeNo,
  historyRows,
  statusRows,
  fallbackSalary,
  fallbackEcola,
  startDate,
  bonusMonth,
}) => {
  const cleanHistory = Array.isArray(historyRows)
    ? historyRows
        .map((row) => ({
          employee_no: toStr(row.employee_no || employeeNo),
          effective_date: toStr(row.effective_date),
          salary: toNum(row.salary),
          ecola: toNum(row.ecola),
        }))
        .filter((row) => row.effective_date)
        .sort((a, b) => monthKey(a.effective_date) - monthKey(b.effective_date))
    : [];

  const cleanStatuses = Array.isArray(statusRows)
    ? statusRows
        .map((row) => ({
          employee_no: toStr(row.employee_no || employeeNo),
          effective_date: toStr(row.effective_date),
          status: toStr(row.status || "Active"),
        }))
        .filter((row) => row.effective_date && row.status)
        .sort((a, b) => monthKey(a.effective_date) - monthKey(b.effective_date))
    : [];

  const year = getYearFromBonusMonth(bonusMonth);
  const lastMonthIndex = getMonthIndexFromBonusMonth(bonusMonth);

  const staffStart = parseDate(startDate);
  const staffStartKey = staffStart ? monthKey(staffStart) : null;

  let totalCompensation = 0;
  let countedMonths = 0;

  for (let m = 0; m <= lastMonthIndex; m++) {
    const currentMonth = new Date(year, m, 1);
    const currentMonthKey = monthKey(currentMonth);

    if (staffStartKey !== null && currentMonthKey < staffStartKey) {
      continue;
    }

    let applicableSalary = null;
    for (let i = 0; i < cleanHistory.length; i++) {
      const rowMonthKey = monthKey(cleanHistory[i].effective_date);
      if (rowMonthKey !== null && currentMonthKey >= rowMonthKey) {
        applicableSalary = cleanHistory[i];
      } else {
        break;
      }
    }

    let applicableStatus = "Active";
    for (let i = 0; i < cleanStatuses.length; i++) {
      const rowMonthKey = monthKey(cleanStatuses[i].effective_date);
      if (rowMonthKey !== null && currentMonthKey >= rowMonthKey) {
        applicableStatus = cleanStatuses[i].status;
      } else {
        break;
      }
    }

    if (norm(applicableStatus) !== "active") {
      continue;
    }

    const salary = applicableSalary ? toNum(applicableSalary.salary) : toNum(fallbackSalary);
    const ecola = applicableSalary ? toNum(applicableSalary.ecola) : toNum(fallbackEcola);
    const monthlyCompensation = salary + ecola;

    totalCompensation += monthlyCompensation;
    countedMonths += 1;
  }

  const equivalent = totalCompensation / 12;

  return {
    total_compensation: totalCompensation,
    counted_months: countedMonths,
    month_13: equivalent,
    month_14: equivalent,
    month_15: equivalent,
  };
};

const getPreviousYear13thMonthRecord = (rows = [], selectedBonusMonth) => {
  const selectedDate = parseDate(selectedBonusMonth);
  if (!selectedDate) return null;

  const previousYear = selectedDate.getFullYear() - 1;

  const candidates = (Array.isArray(rows) ? rows : [])
    .filter((row) => {
      const type = norm(row?.bonus_type);
      const d = parseDate(row?.bonus_month || row?.release_date || row?.created_at);
      return type === "13th month" && d && d.getFullYear() === previousYear;
    })
    .sort((a, b) => {
      const ad = parseDate(a?.bonus_month || a?.release_date || a?.created_at)?.getTime() || 0;
      const bd = parseDate(b?.bonus_month || b?.release_date || b?.created_at)?.getTime() || 0;
      return bd - ad;
    });

  return candidates.length ? candidates[0] : null;
};

export default function Bonus() {
  const params = useParams();
  const branchParam = toStr(params.branchId ?? params.id);
  const navigate = useNavigate();

  const [branch, setBranch] = useState(null);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [salaryHistoryMap, setSalaryHistoryMap] = useState({});
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [statusHistoryMap, setStatusHistoryMap] = useState({});
  const [loadingStatusHistory, setLoadingStatusHistory] = useState(false);

  const [bonusHistoryMap, setBonusHistoryMap] = useState({});
  const [loadingBonusHistory, setLoadingBonusHistory] = useState(false);

  const [openMenuId, setOpenMenuId] = useState(null);
  const menuRef = useRef(null);

  const [printType, setPrintType] = useState(null);

  const [showCalcModal, setShowCalcModal] = useState(false);
  const [showReleaseModal, setShowReleaseModal] = useState(false);
  const [showEdit13Modal, setShowEdit13Modal] = useState(false);

  const [selectedRow, setSelectedRow] = useState(null);
  const [percentage, setPercentage] = useState("");
  const [releaseDate, setReleaseDate] = useState(todayDate());

  const [edit13Id, setEdit13Id] = useState(null);
  const [edit13Amount, setEdit13Amount] = useState("");
  const [edit13ReleaseDate, setEdit13ReleaseDate] = useState(todayDate());
  const [edit13Remarks, setEdit13Remarks] = useState("");

  const [saving, setSaving] = useState(false);
  const [bonusMonth, setBonusMonth] = useState(currentBonusMonth());
  const [bonusType, setBonusType] = useState("13th Month");
  const [runId, setRunId] = useState(null);
  const [savedResults, setSavedResults] = useState({});

  const readUser = () => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  };

  const user = useMemo(() => readUser(), []);
  const role = norm(user?.role);

  const canManageBonus =
    role === "admin" ||
    role === "hr" ||
    role === "accounting";

  const refreshBonusHistory = useCallback(async (staffRows) => {
    if (!staffRows.length) {
      setBonusHistoryMap({});
      return;
    }

    try {
      setLoadingBonusHistory(true);

      const results = await Promise.all(
        staffRows.map(async (s) => {
          const staffId = Number(s?.id);
          if (!staffId) return { staffId: "", rows: [] };

          try {
            const res = await api.get(`/staff-bonus-history/staff/${staffId}`);
            return {
              staffId: String(staffId),
              rows: Array.isArray(res.data) ? res.data : [],
            };
          } catch {
            return {
              staffId: String(staffId),
              rows: [],
            };
          }
        })
      );

      const mapped = {};
      results.forEach(({ staffId, rows }) => {
        if (!staffId) return;
        mapped[staffId] = rows;
      });

      setBonusHistoryMap(mapped);
    } finally {
      setLoadingBonusHistory(false);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError("");

        const [branchesRes, staffRes] = await Promise.all([
          api.get("/branches"),
          api.get("/staff"),
        ]);

        const branches = Array.isArray(branchesRes.data) ? branchesRes.data : [];

        const found = branches.find((b) => {
          const idMatch =
            Number.isFinite(Number(branchParam)) && Number(b.id) === Number(branchParam);
          const codeMatch = norm(b.code) === norm(branchParam);
          return idMatch || codeMatch;
        });

        if (!found) {
          setError("Branch not found.");
          return;
        }

        setBranch(found);

        const allStaff = Array.isArray(staffRes.data) ? staffRes.data : [];

        const byBranch = allStaff.filter((s) => Number(s.branch_id) === Number(found.id));
        const byBranchCode = allStaff.filter((s) => norm(s.branch_code) === norm(found.code));

        const searchParams = new URLSearchParams(window.location.search);
        const departmentId = searchParams.get("department_id");
        const departmentName = searchParams.get("department");

        const filteredRaw = allStaff.filter((s) => {
          const matchBranch =
            Number(s.branch_id) === Number(found.id) ||
            norm(s.branch_code) === norm(found.code);

          const matchDepartment =
            !departmentId && !departmentName
              ? true
              : String(s.department_id || "") === String(departmentId || "") ||
                norm(s.department) === norm(departmentName) ||
                norm(s.department_name) === norm(departmentName);

          return matchBranch && matchDepartment;
        });

        const filtered = filteredRaw.filter(isActiveStaff);

        setStaff(filtered);
        await refreshBonusHistory(filtered);

        const options = buildMonthYearOptions(filtered);
        if (options.length && !options.some((opt) => opt.value === bonusMonth)) {
          setBonusMonth(options[0].value);
        }
      } catch (err) {
        setError(err?.response?.data?.message || "Failed to load bonus.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [branchParam, bonusMonth, refreshBonusHistory]);

  useEffect(() => {
    const loadSavedForBranch = async () => {
      try {
        if (!branch?.id) return;

        const res = await api.get(`/bonus/branch/${branch.id}`, {
          params: {
            bonus_month: bonusMonth,
            bonus_type: bonusType,
          },
        });

        const lines = Array.isArray(res.data) ? res.data : [];

        const mapped = {};
        let latestRunId = null;

        lines.forEach((line) => {
          const key = String(line.employee_id ?? "");
          if (!key) return;

          mapped[key] = {
            line_id: line.id,
            bonus_run_id: line.bonus_run_id,
            percentage: toNum(line.percentage),
            result: toNum(line.result),
            is_released: !!line.is_released,
            release_date: line.release_date || null,
          };

          if (!latestRunId && line.bonus_run_id) latestRunId = line.bonus_run_id;
        });

        setSavedResults(mapped);
        setRunId(latestRunId || null);
      } catch {
        setSavedResults({});
        setRunId(null);
      }
    };

    loadSavedForBranch();
  }, [branch, bonusMonth]);

  useEffect(() => {
    const loadStatusHistory = async () => {
      if (!staff.length) {
        setStatusHistoryMap({});
        return;
      }

      try {
        setLoadingStatusHistory(true);

        const results = await Promise.all(
          staff.map(async (s) => {
            const employeeNo = toStr(s.employee_no);
            if (!employeeNo) return { employeeNo: "", rows: [] };

            try {
              const res = await api.get(`/status-history/${employeeNo}`);
              return {
                employeeNo,
                rows: Array.isArray(res.data) ? res.data : [],
              };
            } catch {
              return {
                employeeNo,
                rows: [],
              };
            }
          })
        );

        const mapped = {};
        results.forEach(({ employeeNo, rows }) => {
          if (!employeeNo) return;
          mapped[employeeNo] = rows;
        });

        setStatusHistoryMap(mapped);
      } finally {
        setLoadingStatusHistory(false);
      }
    };

    loadStatusHistory();
  }, [staff]);

  useEffect(() => {
    const loadSalaryHistory = async () => {
      if (!staff.length) {
        setSalaryHistoryMap({});
        return;
      }

      try {
        setLoadingHistory(true);

        const results = await Promise.all(
          staff.map(async (s) => {
            const employeeNo = toStr(s.employee_no);
            if (!employeeNo) return { employeeNo: "", rows: [] };

            try {
              const res = await api.get(`/salary-history/${employeeNo}`);
              return {
                employeeNo,
                rows: Array.isArray(res.data) ? res.data : [],
              };
            } catch {
              return {
                employeeNo,
                rows: [],
              };
            }
          })
        );

        const mapped = {};
        results.forEach(({ employeeNo, rows }) => {
          if (!employeeNo) return;
          mapped[employeeNo] = rows;
        });

        setSalaryHistoryMap(mapped);
      } finally {
        setLoadingHistory(false);
      }
    };

    loadSalaryHistory();
  }, [staff]);

  useEffect(() => {
    const onDocClick = (e) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target)) {
        setOpenMenuId(null);
      }
    };

    const onEsc = (e) => {
      if (e.key === "Escape") {
        setOpenMenuId(null);
        setShowCalcModal(false);
        setShowReleaseModal(false);
        setShowEdit13Modal(false);
      }
    };

    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);

    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  useEffect(() => {
    const anyOpen = showCalcModal || showReleaseModal || showEdit13Modal;
    if (!anyOpen) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [showCalcModal, showReleaseModal, showEdit13Modal]);

  const monthYearOptions = useMemo(() => buildMonthYearOptions(staff), [staff]);

  const computed = useMemo(() => {
    return staff.map((s) => {
      const employeeNo = toStr(s.employee_no);
      const historyRows = salaryHistoryMap[employeeNo] || [];
      const statusRows = statusHistoryMap[employeeNo] || [];
      const bonusHistoryRows = bonusHistoryMap[String(s.id)] || [];

      const bonus = computeProratedBonusFromHistory({
        employeeNo,
        historyRows,
        statusRows,
        fallbackSalary: s.salary,
        fallbackEcola: s.ecola,
        startDate: s.start_date,
        bonusMonth,
      });

      const previousYearRecord = getPreviousYear13thMonthRecord(
        bonusHistoryRows,
        bonusMonth
      );

      const previousYear13thMonth = previousYearRecord
        ? toNum(previousYearRecord.amount)
        : 0;

      const salary = toNum(s.salary);
      const releaseBase15th = previousYear13thMonth > 0 ? previousYear13thMonth : bonus.month_15;

      const saved = savedResults[String(s.id)] || {
        percentage: 0,
        result: 0,
        line_id: null,
        bonus_run_id: null,
        is_released: false,
        release_date: null,
      };

      return {
        ...s,
        employee_id: s.id,
        salary,
        previous_year_13th_month: previousYear13thMonth,
        previous_year_13th_record: previousYearRecord,
        total_compensation: bonus.total_compensation,
        counted_months: bonus.counted_months,
        month_13: bonus.month_13,
        month_14: bonus.month_14,
        month_15: bonus.month_15,
        release_base_15th: releaseBase15th,
        saved_percentage: toNum(saved.percentage),
        saved_result: toNum(saved.result),
        saved_line_id: saved.line_id ?? null,
        saved_bonus_run_id: saved.bonus_run_id ?? null,
        saved_is_released: !!saved.is_released,
        saved_release_date: saved.release_date || null,
      };
    });
  }, [staff, salaryHistoryMap, statusHistoryMap, bonusHistoryMap, savedResults, bonusMonth]);

  const previousYearLabel = useMemo(() => {
    const d = parseDate(bonusMonth);
    const year = d ? d.getFullYear() - 1 : new Date().getFullYear() - 1;
    return `${year} 13th Month`;
  }, [bonusMonth]);

  const totalPreviousYear13th = computed.reduce(
    (sum, s) => sum + toNum(s.previous_year_13th_month),
    0
  );
  const total13 = computed.reduce((sum, s) => sum + toNum(s.month_13), 0);
  const total14 = computed.reduce((sum, s) => sum + toNum(s.month_14), 0);
  const total15 = computed.reduce((sum, s) => sum + toNum(s.month_15), 0);
  const totalResult = computed.reduce((sum, s) => sum + toNum(s.saved_result), 0);

  const getTotalGross = (row) => {
    return toNum(row.salary) + toNum(row.ecola);
  };

  const getDeductions = (row) => {
    return toNum(row.deductions);
  };

  const getTotalBenefits = (row) => {
    const totalGross = getTotalGross(row);

    return (
      totalGross +
      toNum(row.month_13) +
      toNum(row.month_14) -
      getDeductions(row)
    );
  };

  const totalBasicSalary = computed.reduce(
    (sum, row) => sum + toNum(row.salary),
    0
  );

  const totalEcola = computed.reduce(
    (sum, row) => sum + toNum(row.ecola),
    0
  );

  const totalGross = computed.reduce(
    (sum, row) => sum + getTotalGross(row),
    0
  );

  const totalDeductions = computed.reduce(
    (sum, row) => sum + getDeductions(row),
    0
  );

  const grandTotalBenefits = computed.reduce(
    (sum, row) => sum + getTotalBenefits(row),
    0
  );

  const toggleMenu = (id) => {
    setOpenMenuId((prev) => (prev === id ? null : id));
  };

  const getAnnualBasic = (row) => {
    const employeeNo = toStr(row.employee_no);
    const historyRows = salaryHistoryMap[employeeNo] || [];
    const statusRows = statusHistoryMap[employeeNo] || [];

    const year = getYearFromBonusMonth(bonusMonth);

    const staffStart = parseDate(row.start_date);
    const staffStartKey = staffStart ? monthKey(staffStart) : null;

    const cleanHistory = [...historyRows]
      .map((item) => ({
        effective_date: toStr(item.effective_date),
        salary: toNum(item.salary),
        ecola: toNum(item.ecola),
      }))
      .filter((item) => item.effective_date)
      .sort(
        (a, b) =>
          monthKey(a.effective_date) - monthKey(b.effective_date)
      );

    const cleanStatuses = [...statusRows]
      .map((item) => ({
        effective_date: toStr(item.effective_date),
        status: toStr(item.status || "Active"),
      }))
      .filter((item) => item.effective_date)
      .sort(
        (a, b) =>
          monthKey(a.effective_date) - monthKey(b.effective_date)
      );

    let annualBasic = 0;

    for (let month = 0; month < 12; month += 1) {
      const currentMonth = new Date(year, month, 1);
      const currentKey = monthKey(currentMonth);

      if (staffStartKey !== null && currentKey < staffStartKey) {
        continue;
      }

      let applicableSalary = null;

      for (const item of cleanHistory) {
        const itemKey = monthKey(item.effective_date);

        if (itemKey !== null && currentKey >= itemKey) {
          applicableSalary = item;
        } else {
          break;
        }
      }

      let applicableStatus = "Active";

      for (const item of cleanStatuses) {
        const itemKey = monthKey(item.effective_date);

        if (itemKey !== null && currentKey >= itemKey) {
          applicableStatus = item.status;
        } else {
          break;
        }
      }

      if (norm(applicableStatus) !== "active") {
        continue;
      }

      annualBasic += applicableSalary
        ? toNum(applicableSalary.salary)
        : toNum(row.salary);
    }

    return annualBasic;
  };

  const getAnnualEcola = (row) => {
    return Math.max(
      0,
      toNum(row.total_compensation) - getAnnualBasic(row)
    );
  };

  const getPrintBonus = (row) => {
    return toNum(row.total_compensation) / 12;
  };

  const totalAnnualBasic = computed.reduce(
    (sum, row) => sum + getAnnualBasic(row),
    0
  );

  const totalAnnualEcola = computed.reduce(
    (sum, row) => sum + getAnnualEcola(row),
    0
  );

  const totalAnnualCompensation = computed.reduce(
    (sum, row) => sum + toNum(row.total_compensation),
    0
  );

  const totalPrintBonus = computed.reduce(
    (sum, row) => sum + getPrintBonus(row),
    0
  );

  const totalSelectedPrintBenefit =
    printType === "13th"
      ? total13
      : printType === "14th"
      ? total14
      : printType === "15th"
      ? total15
      : totalPrintBonus;

  const handlePrintReport = (type) => {
    setOpenMenuId(null);
    setPrintType(type);

    setTimeout(() => {
      window.print();
    }, 150);
  };

  const ensureRun = async () => {
    if (runId) return runId;
    if (!branch?.id) throw new Error("Branch not found.");

    const res = await api.post("/bonus/run", {
      branch_id: Number(branch.id),
      bonus_month: bonusMonth,
      notes: null,
    });

    const newRunId = res?.data?.bonus_run_id;
    if (!newRunId) throw new Error("Failed to create bonus run.");

    setRunId(newRunId);
    return newRunId;
  };

  const openCalculateModal = (row) => {
    setOpenMenuId(null);
    setSelectedRow(row);
    setPercentage(
      savedResults[String(row.employee_id)]?.percentage != null
        ? String(savedResults[String(row.employee_id)].percentage)
        : ""
    );
    setShowCalcModal(true);
  };

  const closeCalculateModal = () => {
    setShowCalcModal(false);
    setSelectedRow(null);
    setPercentage("");
  };

  const openReleaseModal = (row) => {
    setOpenMenuId(null);

    if (!row?.saved_result || toNum(row.saved_result) <= 0) {
      alert("Save the calculation first before releasing.");
      return;
    }

    setSelectedRow(row);
    setReleaseDate(row.saved_release_date || todayDate());
    setShowReleaseModal(true);
  };

  const closeReleaseModal = () => {
    setShowReleaseModal(false);
    setSelectedRow(null);
    setReleaseDate(todayDate());
  };

  const handleOpen13Month = (row) => {
    setOpenMenuId(null);
    setSelectedRow(row);

    const record = row?.previous_year_13th_record;

    if (record?.id) {
      setEdit13Id(record.id);
      setEdit13Amount(String(toNum(record.amount)));
      setEdit13ReleaseDate(
        record.release_date ? String(record.release_date).slice(0, 10) : todayDate()
      );
      setEdit13Remarks(toStr(record.remarks));
    } else {
      setEdit13Id(null);
      setEdit13Amount("");
      setEdit13ReleaseDate(todayDate());
      setEdit13Remarks("");
    }

    setShowEdit13Modal(true);
  };

  const closeEdit13Modal = () => {
    setShowEdit13Modal(false);
    setSelectedRow(null);
    setEdit13Id(null);
    setEdit13Amount("");
    setEdit13ReleaseDate(todayDate());
    setEdit13Remarks("");
  };

  const percentageValue = toNum(percentage);
  const result = selectedRow
    ? (toNum(selectedRow.release_base_15th) * percentageValue) / 100
    : 0;

  const handleSaveCalculation = async () => {
    if (!selectedRow) return;

    try {
      setSaving(true);

      const currentRunId = await ensureRun();

      const payload = {
        lines: [
          {
            employee_id: selectedRow.employee_id,
            salary: toNum(selectedRow.salary),
            month_13: toNum(selectedRow.month_13),
            month_14: toNum(selectedRow.month_14),
            month_15: toNum(selectedRow.release_base_15th),
            percentage: percentageValue,
            result: toNum(result),
          },
        ],
      };

      await api.post(`/bonus/run/${currentRunId}/lines`, payload);

      const lineRefresh = await api.get(`/bonus/branch/${branch.id}`, {
        params: { bonus_month: bonusMonth },
      });
      const lines = Array.isArray(lineRefresh.data) ? lineRefresh.data : [];

      const mapped = {};
      lines.forEach((line) => {
        const key = String(line.employee_id ?? "");
        if (!key) return;

        mapped[key] = {
          line_id: line.id,
          bonus_run_id: line.bonus_run_id,
          percentage: toNum(line.percentage),
          result: toNum(line.result),
          is_released: !!line.is_released,
          release_date: line.release_date || null,
        };
      });

      setSavedResults(mapped);

      closeCalculateModal();
      alert("15th month result saved.");
    } catch (err) {
      alert(err?.response?.data?.message || err?.message || "Failed to save bonus.");
    } finally {
      setSaving(false);
    }
  };

  const handleReleaseBonus = async () => {
    if (!selectedRow) return;

    try {
      if (!selectedRow.saved_line_id) {
        alert("Save the calculation first before releasing.");
        return;
      }

      if (!isValidDate(releaseDate)) {
        alert("Please select a valid release date.");
        return;
      }

      setSaving(true);

      await api.put(`/bonus/line/${selectedRow.saved_line_id}/release`, {
        release_date: releaseDate,
      });

      setSavedResults((prev) => ({
        ...prev,
        [String(selectedRow.employee_id)]: {
          ...prev[String(selectedRow.employee_id)],
          is_released: true,
          release_date: releaseDate,
        },
      }));

      await refreshBonusHistory(staff);

      closeReleaseModal();
      alert("15th month pay released.");
    } catch (err) {
      alert(err?.response?.data?.message || err?.message || "Failed to release bonus.");
    } finally {
      setSaving(false);
    }
  };

  const handleSave13thMonth = async () => {
    try {
      if (!selectedRow) return;

      if (toNum(edit13Amount) <= 0) {
        alert("Enter valid amount");
        return;
      }

      if (!isValidDate(edit13ReleaseDate)) {
        alert("Please select a valid release date.");
        return;
      }

      setSaving(true);

      if (edit13Id) {
        await api.put(`/staff-bonus-history/${edit13Id}`, {
          amount: toNum(edit13Amount),
          release_date: edit13ReleaseDate,
          remarks: edit13Remarks,
        });
      } else {
        const previousYear = getYearFromBonusMonth(bonusMonth) - 1;

        await api.post(`/staff-bonus-history`, {
          staff_id: selectedRow.id,
          employee_no: selectedRow.employee_no,
          bonus_type: "13th Month",
          bonus_month: `${previousYear}-12-01`,
          amount: toNum(edit13Amount),
          release_date: edit13ReleaseDate,
          remarks: edit13Remarks,
        });
      }

      await refreshBonusHistory(staff);

      closeEdit13Modal();
      alert(edit13Id ? "Updated successfully" : "Added successfully");
    } catch (err) {
      alert(err?.response?.data?.message || err?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="bonus-page">Loading bonus...</div>;
  if (error) return <div className="bonus-page error">{error}</div>;

  const printedAt = new Date().toLocaleString();

  return (
    <div className="bonus-page">
      <div className="bonus-header no-print">
        <div>
          <h2>Branch Bonus</h2>
          <p>
            {branch?.code} • {branch?.name} • {branch?.area}
          </p>
          <small>
            Bonus & Benefits Summary • {getYearFromBonusMonth(bonusMonth)}
            {loadingHistory || loadingStatusHistory || loadingBonusHistory
              ? " • Loading data..."
              : ""}
          </small>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <select
            className="input"
            value={bonusMonth}
            onChange={(e) => {
              setBonusMonth(e.target.value);
              setOpenMenuId(null);
            }}
            style={{ width: 220 }}
          >
            {monthYearOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <button className="btn-secondary" onClick={() => navigate(-1)} type="button">
            ← Back
          </button>
        </div>
      </div>

      <div className="bonus-card no-print bonus-summary-card">
        <div className="bonus-table-scroll">
          <table className="bonus-table bonus-summary-table">
            <thead>
              <tr>
                <th>No.</th>
                <th>Employee No.</th>
                <th>Employee Name</th>
                <th>Position</th>
                <th>Date of Deployment</th>
                <th>Date of Regularization</th>
                <th className="money-head">Basic Salary</th>
                <th className="money-head">ECOLA</th>
                <th className="money-head">Deductions</th>
                <th className="money-head">Total Gross</th>
                <th className="money-head">
                  {getYearFromBonusMonth(bonusMonth)} 13th Month
                </th>
                <th className="money-head">
                  {getYearFromBonusMonth(bonusMonth)} 14th Month
                </th>
                <th className="money-head">
                  {getYearFromBonusMonth(bonusMonth)} 15th Month
                </th>

                <th className="total-benefits-head">
                  Total Benefits
                </th>

                <th className="print-head">Print</th>

                {canManageBonus && (
                  <th className="action-head">Action</th>
                )}
              </tr>
            </thead>

            <tbody>
              {computed.map((s, index) => (
                <tr key={s.id}>
                  <td className="row-number">{index + 1}</td>

                  <td>{s.employee_no || "-"}</td>

                  <td className="employee-name">
                    {s.fullname || "-"}
                  </td>

                  <td>{s.position || "-"}</td>

                  <td>
                    {formatDisplayDate(s.start_date)}
                  </td>

                  <td>
                    {formatDisplayDate(s.regularization_date)}
                  </td>

                  <td className="money-cell">
                    ₱ {fmtMoney(s.salary)}
                  </td>

                  <td className="money-cell">
                    ₱ {fmtMoney(s.ecola)}
                  </td>

                  <td className="money-cell deduction-cell">
                    ₱ {fmtMoney(getDeductions(s))}
                  </td>

                  <td className="money-cell gross-cell">
                    ₱ {fmtMoney(getTotalGross(s))}
                  </td>

                  <td className="money-cell">
                    ₱ {fmtMoney(s.month_13)}
                  </td>

                  <td className="money-cell">
                    ₱ {fmtMoney(s.month_14)}
                  </td>

                  <td className="money-cell">
                    ₱ {fmtMoney(s.month_15)}
                  </td>

                  <td className="money-cell total-benefits-cell">
                    <div className="total-benefits-amount">
                      ₱ {fmtMoney(getTotalBenefits(s))}
                    </div>
                  </td>

                  <td className="bonus-print-cell">
                    <div className="bonus-print-dropdown">
                      <button
                        type="button"
                        className="bonus-print-btn"
                        onClick={() =>
                          setOpenMenuId(
                            openMenuId === `print-${s.id}`
                              ? null
                              : `print-${s.id}`
                          )
                        }
                      >
                        Print ▾
                      </button>

                      {openMenuId === `print-${s.id}` && (
                        <div
                          className={`bonus-print-menu ${
                            index === computed.length - 1 ? "open-up" : ""
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => handlePrintReport("bonus")}
                          >
                            Bonus
                          </button>

                          <button
                            type="button"
                            onClick={() => handlePrintReport("13th")}
                          >
                            13th Month Pay
                          </button>

                          <button
                            type="button"
                            onClick={() => handlePrintReport("14th")}
                          >
                            14th Month Pay
                          </button>

                          <button
                            type="button"
                            onClick={() => handlePrintReport("15th")}
                          >
                            15th Month Pay
                          </button>
                        </div>
                      )}
                    </div>
                  </td>

                  {canManageBonus && (
                    <td className="bonus-action-cell">
                      <div
                        className="bonus-action-wrap"
                        ref={openMenuId === s.id ? menuRef : null}
                      >
                        <button
                          type="button"
                          className="bonus-kebab-btn"
                          onClick={() => toggleMenu(s.id)}
                        >
                          <BsThreeDotsVertical />
                        </button>

                        {openMenuId === s.id && (
                          <div
                            className={`bonus-menu ${
                              index >= computed.length - 2
                                ? "open-up"
                                : ""
                            }`}
                          >
                            <button
                              type="button"
                              className="bonus-menu-item"
                              onClick={() => openCalculateModal(s)}
                            >
                              Calculate
                            </button>

                            <button
                              type="button"
                              className="bonus-menu-item"
                              onClick={() => openReleaseModal(s)}
                            >
                              {s.saved_is_released
                                ? "Released"
                                : "Release"}
                            </button>

                            <button
                              type="button"
                              className="bonus-menu-item"
                              onClick={() => handleOpen13Month(s)}
                            >
                              {s.previous_year_13th_month > 0
                                ? "Edit"
                                : "Add"}{" "}
                              {previousYearLabel}
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}

              <tr className="total-row bonus-grand-total">
                <td colSpan={6}>
                  GRAND TOTAL
                </td>

                <td className="money-cell">
                  ₱ {fmtMoney(totalBasicSalary)}
                </td>

                <td className="money-cell">
                  ₱ {fmtMoney(totalEcola)}
                </td>

                <td className="money-cell">
                  ₱ {fmtMoney(totalDeductions)}
                </td>

                <td className="money-cell">
                  ₱ {fmtMoney(totalGross)}
                </td>

                <td className="money-cell">
                  ₱ {fmtMoney(total13)}
                </td>

                <td className="money-cell">
                  ₱ {fmtMoney(total14)}
                </td>

                <td className="money-cell">
                  ₱ {fmtMoney(total15)}
                </td>

                <td className="money-cell total-benefits-cell">
                  <div className="total-benefits-amount">
                    ₱ {fmtMoney(grandTotalBenefits)}
                  </div>
                </td>

                <td></td>

                {canManageBonus && <td></td>}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {showCalcModal && selectedRow && (
        <div
          className="modal-overlay"
          onMouseDown={(e) =>
            e.target.classList.contains("modal-overlay") && closeCalculateModal()
          }
        >
          <div className="modal bonus-calc-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h3 className="modal-title">Calculate 15th Month Result</h3>
                <p className="modal-subtitle">
                  {selectedRow.fullname} • {previousYearLabel} base, released as 15th month pay:{" "}
                  <b>₱ {fmtMoney(selectedRow.release_base_15th)}</b>
                </p>
              </div>

              <button className="modal-x" type="button" onClick={closeCalculateModal}>
                ✕
              </button>
            </div>

            <div className="modal-form">
              <div className="grid">
                <div className="field full">
                  <label>Percentage (%)</label>
                  <input
                    className="input"
                    type="number"
                    value={percentage}
                    onChange={(e) => setPercentage(e.target.value)}
                    placeholder="Enter percentage"
                  />
                </div>

                <div className="field full">
                  <label>Formula</label>
                  <div className="bonus-result-box">
                    ₱ {fmtMoney(selectedRow.release_base_15th)} × {percentageValue || 0}% ={" "}
                    <strong>₱ {fmtMoney(result)}</strong>
                  </div>
                </div>

                <div className="field full">
                  <label>Result</label>
                  <div className="bonus-result-final">₱ {fmtMoney(result)}</div>
                </div>
              </div>

              <div className="modal-actions">
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={closeCalculateModal}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  className="btn-primary"
                  type="button"
                  onClick={handleSaveCalculation}
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showReleaseModal && selectedRow && (
        <div
          className="modal-overlay"
          onMouseDown={(e) =>
            e.target.classList.contains("modal-overlay") && closeReleaseModal()
          }
        >
          <div className="modal bonus-calc-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h3 className="modal-title">Release {previousYearLabel} as 15th Month Pay</h3>
                <p className="modal-subtitle">
                  {selectedRow.fullname} • Release Amount: <b>₱ {fmtMoney(selectedRow.saved_result)}</b>
                </p>
              </div>

              <button className="modal-x" type="button" onClick={closeReleaseModal}>
                ✕
              </button>
            </div>

            <div className="modal-form">
              <div className="grid">
                <div className="field full">
                  <label>Employee</label>
                  <div className="bonus-result-box">{selectedRow.fullname}</div>
                </div>

                <div className="field full">
                  <label>Release Date</label>
                  <input
                    className="input"
                    type="date"
                    value={releaseDate}
                    onChange={(e) => setReleaseDate(e.target.value)}
                  />
                </div>

                <div className="field full">
                  <label>Released Amount</label>
                  <div className="bonus-result-final">₱ {fmtMoney(selectedRow.saved_result)}</div>
                </div>
              </div>

              <div className="modal-actions">
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={closeReleaseModal}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  className="btn-primary"
                  type="button"
                  onClick={handleReleaseBonus}
                  disabled={saving}
                >
                  {saving ? "Releasing..." : "Release"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEdit13Modal && selectedRow && (
        <div
          className="modal-overlay"
          onMouseDown={(e) =>
            e.target.classList.contains("modal-overlay") && closeEdit13Modal()
          }
        >
          <div className="modal bonus-calc-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h3 className="modal-title">
                  {edit13Id ? "Edit" : "Add"} {previousYearLabel}
                </h3>
                <p className="modal-subtitle">{selectedRow.fullname}</p>
              </div>

              <button className="modal-x" type="button" onClick={closeEdit13Modal}>
                ✕
              </button>
            </div>

            <div className="modal-form">
              <div className="grid">
                <div className="field full">
                  <label>Employee</label>
                  <div className="bonus-result-box">{selectedRow.fullname}</div>
                </div>

                <div className="field full">
                  <label>{previousYearLabel} Amount</label>
                  <input
                    className="input"
                    type="number"
                    value={edit13Amount}
                    onChange={(e) => setEdit13Amount(e.target.value)}
                    placeholder="Enter amount"
                  />
                </div>

                <div className="field full">
                  <label>Release Date</label>
                  <input
                    className="input"
                    type="date"
                    value={edit13ReleaseDate}
                    onChange={(e) => setEdit13ReleaseDate(e.target.value)}
                  />
                </div>

                <div className="field full">
                  <label>Remarks</label>
                  <textarea
                    className="input"
                    value={edit13Remarks}
                    onChange={(e) => setEdit13Remarks(e.target.value)}
                    placeholder="Remarks"
                  />
                </div>
              </div>

              <div className="modal-actions">
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={closeEdit13Modal}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  className="btn-primary"
                  type="button"
                  onClick={handleSave13thMonth}
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : `${edit13Id ? "Save" : "Add"} ${previousYearLabel}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {(printType === "bonus" ||
        printType === "13th" ||
        printType === "14th" ||
        printType === "15th") && (

        <div className="print-only">
          <div className="admin-order-print">

            {/* COMPANY HEADER */}
            <div className="admin-order-company">
              <div className="admin-order-company-name">
                AmberCash PH Micro Lending Corp
              </div>

              <div className="admin-order-address">
                Don Toribio St., Josefina Drive, Tetuan, Zamboanga City,
                Zamboanga del Sur 7000
              </div>
            </div>

            {/* TITLE */}
            <div className="admin-order-title-row">
              <div className="admin-order-title">
                ADMINISTRATIVE ORDER
              </div>

              <div className="admin-order-date">
                {new Date().toLocaleDateString("en-US", {
                  month: "long",
                  day: "2-digit",
                  year: "numeric",
                }).toUpperCase()}
              </div>
            </div>

            <div className="admin-order-description">
              The following hereunder is the computation of the{" "}
              {printType === "13th"
                ? "13th Month Pay"
                : printType === "14th"
                ? "14th Month Pay"
                : printType === "15th"
                ? "15th Month Pay"
                : "Bonus"}{" "}
              of the Branch Staff:
            </div>

            {/* BRANCH */}
            <div className="admin-order-branch">
              Branch{" "}
              <strong>
                {branch
                  ? `${branch.code} ${branch.name}`
                  : "-"}
              </strong>
            </div>

            {/* TABLE */}
            <table className="admin-order-table">
              <thead>
                <tr>
                  <th rowSpan="2" className="col-no">
                    No.
                  </th>

                  <th rowSpan="2" className="col-name">
                    Name of Employee
                    <small>
                      (Family Name, First Name Middle Name)
                    </small>
                  </th>

                  <th rowSpan="2">
                    ID
                    <br />
                    No.
                  </th>

                  <th rowSpan="2">
                    Designation
                  </th>

                  <th rowSpan="2">
                    Date
                    <br />
                    Deployment
                  </th>

                  <th rowSpan="2">
                    DATE
                    <br />
                    Regularized
                  </th>

                  <th colSpan="3" className="group-head">
                    SALARIES AND WAGES
                  </th>

                  <th colSpan="4" className="group-head">
                    BONUS AND PRIVILEGES
                  </th>
                </tr>

                <tr>
                  <th className="salary-head">
                    BASIC
                  </th>

                  <th className="salary-head">
                    ECOLA
                  </th>

                  <th className="salary-head">
                    Current
                  </th>

                  <th className="bonus-head">
                    Divided by # of months in a year
                  </th>

                  <th className="bonus-head">
                    {printType === "13th"
                      ? "13TH MONTH PAY"
                      : printType === "14th"
                      ? "14TH MONTH PAY"
                      : printType === "15th"
                      ? "15TH MONTH PAY"
                      : "BONUS"}
                  </th>

                  <th>
                    TOTAL
                    <br />
                    BENEFITS
                  </th>

                  <th className="signature-print-head">
                    SIGNATURE OVER
                    <br />
                    PRINTED NAME
                  </th>
                </tr>
              </thead>

              <tbody>
                {computed.map((row, index) => {
                  const annualBasic = getAnnualBasic(row);
                  const annualEcola = getAnnualEcola(row);
                  const annualCompensation =
                    toNum(row.total_compensation);

                  const bonus = getPrintBonus(row);

                  const printBenefit =
                    printType === "13th"
                      ? toNum(row.month_13)
                      : printType === "14th"
                      ? toNum(row.month_14)
                      : printType === "15th"
                      ? toNum(row.month_15)
                      : bonus;

                  return (
                    <tr key={`bonus-print-${row.id}`}>
                      <td>{index + 1}</td>

                      <td className="print-name">
                        {row.fullname || "-"}
                      </td>

                      <td>
                        {row.employee_no || "-"}
                      </td>

                      <td>
                        {row.position || "-"}
                      </td>

                      <td>
                        {formatDisplayDate(row.start_date)}
                      </td>

                      <td>
                        {formatDisplayDate(
                          row.regularization_date
                        )}
                      </td>

                      <td className="print-money">
                        {fmtMoney(annualBasic)}
                      </td>

                      <td className="print-money">
                        {fmtMoney(annualEcola)}
                      </td>

                      <td className="print-money">
                        {fmtMoney(annualCompensation)}
                      </td>

                      <td>
                        {row.counted_months || 0}
                      </td>

                      <td className="print-money bonus-value">
                        {fmtMoney(printBenefit)}
                      </td>

                      <td className="print-money">
                        {fmtMoney(printBenefit)}
                      </td>

                      <td className="employee-signature-cell"></td>
                    </tr>
                  );
                })}

                <tr className="admin-order-total">
                  <td colSpan="6">
                    TOTAL
                  </td>

                  <td className="print-money">
                    {fmtMoney(totalAnnualBasic)}
                  </td>

                  <td className="print-money">
                    {fmtMoney(totalAnnualEcola)}
                  </td>

                  <td className="print-money">
                    {fmtMoney(totalAnnualCompensation)}
                  </td>

                  <td></td>

                  <td className="print-money total-red">
                    {fmtMoney(totalSelectedPrintBenefit)}
                  </td>

                  <td className="print-money total-red">
                    {fmtMoney(totalSelectedPrintBenefit)}
                  </td>

                  <td></td>
                </tr>
              </tbody>
            </table>

            {/* SIGNATURES */}
            <div className="admin-order-signatures">

              <div className="signature-block">
                <div className="signature-label">
                  PREPARED BY:
                </div>

                <div className="signature-sgd">
                  (SGD)
                </div>

                <div className="signature-name">
                  EVELYN E. RUBIO
                </div>

                <div className="signature-line"></div>

                <div className="signature-position">
                  SVP/CFO
                </div>
              </div>

              <div className="signature-block">
                <div className="signature-label">
                  APPROVED BY:
                </div>

                <div className="signature-sgd">
                  (SGD)
                </div>

                <div className="signature-name">
                  AL-FARHAM E. SARABI
                </div>

                <div className="signature-line"></div>

                <div className="signature-position">
                  President / CEO
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}