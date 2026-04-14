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
  const [runId, setRunId] = useState(null);

  const [savedResults, setSavedResults] = useState({});

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

        const filteredRaw =
          byBranch.length > 0
            ? byBranch
            : byBranchCode.length > 0
            ? byBranchCode
            : allStaff.filter((s) => norm(s.area) === norm(found.area));

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
          params: { bonus_month: bonusMonth },
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

  const toggleMenu = (id) => {
    setOpenMenuId((prev) => (prev === id ? null : id));
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

  return (
    <div className="bonus-page">
      <div className="bonus-header">
        <div>
          <h2>Branch Bonus</h2>
          <p>
            {branch?.code} • {branch?.name} • {branch?.area}
          </p>
          <small>
            Showing {formatMonthYearLabel(bonusMonth)} bonus computation
            {loadingHistory || loadingStatusHistory || loadingBonusHistory
              ? " • Loading history..."
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

          <button className="btn-back" onClick={() => navigate(-1)} type="button">
            ← Back
          </button>
        </div>
      </div>

      <div className="bonus-card">
        <table className="bonus-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Employee No</th>
              <th>Employee</th>
              <th>Position</th>
              <th>Salary</th>
              <th>{previousYearLabel}</th>
              <th>15th Month</th>
              <th>13th Month</th>
              <th>14th Month</th>
              <th>Result</th>
              <th>Release Date</th>
              <th style={{ width: 90 }}>Action</th>
            </tr>
          </thead>

          <tbody>
            {computed.map((s, index) => (
              <tr key={s.id}>
                <td>{s.id}</td>
                <td>{s.employee_no ?? "-"}</td>
                <td>{s.fullname}</td>
                <td>{s.position}</td>
                <td>{fmtMoney(s.salary)}</td>
                <td className="strong">
                  {s.previous_year_13th_month > 0 ? fmtMoney(s.previous_year_13th_month) : "-"}
                </td>
                <td className="strong">{fmtMoney(s.month_15)}</td>
                <td className="strong">{fmtMoney(s.month_13)}</td>
                <td className="strong">{fmtMoney(s.month_14)}</td>
                <td className="bonus-result">
                  {s.saved_result > 0 ? `₱ ${fmtMoney(s.saved_result)}` : "-"}
                  {s.saved_percentage > 0 ? (
                    <div className="bonus-result-note">{s.saved_percentage}%</div>
                  ) : null}
                </td>
                <td>{s.saved_is_released && s.saved_release_date ? s.saved_release_date : "-"}</td>

                <td className="bonus-action-cell">
                  <div className="bonus-action-wrap" ref={openMenuId === s.id ? menuRef : null}>
                    <button
                      type="button"
                      className="bonus-kebab-btn"
                      onClick={() => toggleMenu(s.id)}
                    >
                      <BsThreeDotsVertical />
                    </button>

                    {openMenuId === s.id && (
                      <div className={`bonus-menu ${index >= computed.length - 2 ? "open-up" : ""}`}>
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
                          {s.saved_is_released ? "Released" : "Release"}
                        </button>

                        <button
                          type="button"
                          className="bonus-menu-item"
                          onClick={() => handleOpen13Month(s)}
                        >
                          {s.previous_year_13th_month > 0 ? "Edit" : "Add"} {previousYearLabel}
                        </button>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}

            <tr className="total-row">
              <td colSpan={5}>TOTAL</td>
              <td className="strong">{fmtMoney(totalPreviousYear13th)}</td>
              <td className="strong">{fmtMoney(total15)}</td>
              <td className="strong">{fmtMoney(total13)}</td>
              <td className="strong">{fmtMoney(total14)}</td>
              <td className="bonus-result">{fmtMoney(totalResult)}</td>
              <td></td>
              <td></td>
            </tr>
          </tbody>
        </table>
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
    </div>
  );
}