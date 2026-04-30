import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "../styles/Transportation.css";
import api from "../api/axiosClient";
import { HiDotsVertical } from "react-icons/hi";

/* ---------------- Helpers ---------------- */
const toNum = (v) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const toStr = (v) => String(v ?? "").trim();
const norm = (v) => toStr(v).toLowerCase();
const fmt = (n) => toNum(n).toLocaleString();
const fmtDate = (d) => (d ? String(d).split("T")[0] : "-");
const toDate10 = (v) => (v ? String(v).slice(0, 10) : "");

const POSITION_ORDER = [
  "president",
  "senior vice president",
  "vice president",
  "assistant vice president",
  "regional manager",
  "acting regional manager",
  "area manager",
  "acting area manager",
  "branch manager",
  "acting branch manager",
  "loan officer",
  "probationary loan officer",
];

const getPositionRank = (position) => {
  const idx = POSITION_ORDER.indexOf(norm(position));
  return idx === -1 ? 999 : idx;
};

const sortByPosition = (rows) => {
  return [...rows].sort((a, b) => {
    const rankA = getPositionRank(a?.position);
    const rankB = getPositionRank(b?.position);

    if (rankA !== rankB) return rankA - rankB;

    const posCompare = toStr(a?.position).localeCompare(toStr(b?.position));
    if (posCompare !== 0) return posCompare;

    const lastCompare = toStr(a?.last_name).localeCompare(toStr(b?.last_name));
    if (lastCompare !== 0) return lastCompare;

    const firstCompare = toStr(a?.first_name).localeCompare(toStr(b?.first_name));
    if (firstCompare !== 0) return firstCompare;

    return toStr(a?.employee_no).localeCompare(toStr(b?.employee_no));
  });
};

const isActiveStaff = (s) => norm(s.status || "Active") !== "inactive";

const readUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
};

const receivedKey = (branchKey) => `transportation_received::branch_${branchKey}`;
const makeReceivedId = (staffId, selectedMonth) => `${staffId}__${selectedMonth}`;

const OVERRIDE_FIELDS = [
  "postage",
  "transportation",
  "additional_target",
  "repairing",
  "additional_monitoring",
  "motorcycle_loan",
  "other_deduction",
];

const LABELS = {
  postage: "Postage",
  transportation: "Transportation",
  additional_target: "Target / 1200 / Less Excuses",
  repairing: "Repairing",
  additional_monitoring: "Monitoring",
  motorcycle_loan: "Motorcycle",
  other_deduction: "Other",
};

const emptyOverrideValues = () => {
  const obj = {};
  OVERRIDE_FIELDS.forEach((k) => {
    obj[k] = 0;
  });
  return obj;
};

const isExpired = (until) => {
  if (!until) return true;
  const end = new Date(`${until}T23:59:59`);
  return end.getTime() < Date.now();
};

const overlapsMonth = (startDate, endDate, selectedMonth) => {
  const start = toDate10(startDate);
  const end = toDate10(endDate);
  if (!start || !end || !selectedMonth) return false;

  const s = new Date(`${start}T00:00:00`);
  const e = new Date(`${end}T23:59:59`);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return false;

  const [year, month] = selectedMonth.split("-").map(Number);
  if (!year || !month) return false;

  const monthStart = new Date(year, month - 1, 1, 0, 0, 0);
  const monthEnd = new Date(year, month, 0, 23, 59, 59);

  return s <= monthEnd && e >= monthStart;
};

const splitTransportPay = (netPay) => {
  const net = toNum(netPay);

  if (net >= 0) {
    const pay10 = Math.floor(net / 2);
    const pay25 = net - pay10;
    return { pay10, pay25 };
  }

  const absNet = Math.abs(net);
  const abs10 = Math.floor(absNet / 2);
  const abs25 = absNet - abs10;

  return {
    pay10: -abs10,
    pay25: -abs25,
  };
};

function Transportation() {
  const params = useParams();
  const rawBranchParam = params.branchId ?? params.id;
  const branchParam = toStr(rawBranchParam);

  const navigate = useNavigate();

  const user = useMemo(() => readUser(), []);
  const role = norm(user?.role);

  const canManualEdit =
    role === "admin" ||
    role === "hr" ||
    role === "accounting";

  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7)
  );

  const [branch, setBranch] = useState(null);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [overrides, setOverrides] = useState({});
  const [approvedSuspensions, setApprovedSuspensions] = useState({});
  const [receivedMap, setReceivedMap] = useState({});

  const [menuOpenFor, setMenuOpenFor] = useState(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const menuWrapRef = useRef(null);

  const [editModalStaff, setEditModalStaff] = useState(null);
  const [editUntil, setEditUntil] = useState("");
  const [editValues, setEditValues] = useState(() => emptyOverrideValues());
  const [savingOverride, setSavingOverride] = useState(false);

  const closeMenu = useCallback(() => setMenuOpenFor(null), []);

  const closeModal = useCallback(() => {
    if (savingOverride) return;
    setEditModalStaff(null);
    setEditUntil("");
    setEditValues(emptyOverrideValues());
  }, [savingOverride]);

  const openMenuFor = useCallback((staffId, event) => {
    const rect = event.currentTarget.getBoundingClientRect();

    setMenuPos({
      top: rect.bottom + 6,
      left: Math.max(8, rect.right - 190),
    });

    setMenuOpenFor((prev) => (prev === staffId ? null : staffId));
  }, []);

  const loadOverrides = useCallback(async (resolvedBranchId) => {
    if (!resolvedBranchId) return;

    try {
      const res = await api.get(`/transport-overrides/branch/${resolvedBranchId}`);
      const map = {};

      (Array.isArray(res.data) ? res.data : []).forEach((r) => {
        const staffId = String(r.staff_id);

        map[staffId] = {
          until: toDate10(r.until_date),
          values: {
            postage: toNum(r.postage),
            transportation: toNum(r.transportation),
            additional_target: toNum(r.additional_target),
            repairing: toNum(r.repairing),
            additional_monitoring: toNum(r.additional_monitoring),
            motorcycle_loan: toNum(r.motorcycle_loan),
            other_deduction: toNum(r.other_deduction),
          },
        };
      });

      setOverrides(map);
    } catch (err) {
      console.error("loadOverrides failed:", err?.response?.data || err?.message || err);
      setOverrides({});
    }
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(receivedKey(branchParam));
      const parsed = raw ? JSON.parse(raw) : {};
      setReceivedMap(parsed && typeof parsed === "object" ? parsed : {});
    } catch {
      setReceivedMap({});
    }
  }, [branchParam]);

  const persistReceivedMap = useCallback(
    (next) => {
      setReceivedMap(next);
      try {
        localStorage.setItem(receivedKey(branchParam), JSON.stringify(next));
      } catch {}
    },
    [branchParam]
  );

  useEffect(() => {
    const onDown = (e) => {
      if (!menuOpenFor) return;
      if (menuWrapRef.current && !menuWrapRef.current.contains(e.target)) {
        closeMenu();
      }
    };

    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpenFor, closeMenu]);

  useEffect(() => {
    const run = async () => {
      if (!branchParam) {
        setError("No branch ID provided.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const [branchesRes, staffRes, suspensionRes] = await Promise.all([
          api.get("/branches"),
          api.get("/staff"),
          api.get("/suspension-orders").catch(() => ({ data: [] })),
        ]);

        const branches = Array.isArray(branchesRes.data) ? branchesRes.data : [];

        const foundBranch = branches.find((x) => {
          const idMatch =
            Number.isFinite(Number(branchParam)) &&
            Number(x.id) === Number(branchParam);
          const codeMatch = norm(x.code) === norm(branchParam);
          return idMatch || codeMatch;
        });

        if (!foundBranch) {
          setError("Branch not found.");
          setLoading(false);
          return;
        }

        setBranch(foundBranch);

        const allStaff = Array.isArray(staffRes.data) ? staffRes.data : [];

        const byBranchId = allStaff.filter(
          (s) => Number(s.branch_id) === Number(foundBranch.id)
        );

        const byBranchCode = allStaff.filter(
          (s) => norm(s.branch_code) === norm(foundBranch.code)
        );

        const searchParams = new URLSearchParams(window.location.search);
        const departmentId = searchParams.get("department_id");
        const departmentName = searchParams.get("department");

        const filteredRaw = allStaff.filter((s) => {
          const matchBranch =
            Number(s.branch_id) === Number(foundBranch.id) ||
            norm(s.branch_code) === norm(foundBranch.code);

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

        await loadOverrides(foundBranch.id);

        const suspensions = Array.isArray(suspensionRes.data) ? suspensionRes.data : [];
        const map = {};

        suspensions.forEach((row) => {
          if (norm(row.status) !== "approved") return;

          if (
            !overlapsMonth(
              row.start_date || row.suspension_start,
              row.end_date || row.suspension_end,
              selectedMonth
            )
          ) {
            return;
          }

          const key = String(row.employee_id ?? "").trim();
          if (!key) return;

          if (!map[key]) {
            map[key] = {
              deduction_transportation: 0,
              days_of_suspension: 0,
            };
          }

          map[key].deduction_transportation += toNum(row.deduction_transportation);
          map[key].days_of_suspension += toNum(row.days_of_suspension);
        });

        setApprovedSuspensions(map);
      } catch (err) {
        const status = err?.response?.status;
        if (status === 404) setError("Branch not found.");
        else if (status === 401) setError("Session expired. Please login again.");
        else if (status === 403) setError("Access denied.");
        else setError(err?.response?.data?.message || "Error fetching data from server.");
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [branchParam, selectedMonth, loadOverrides]);

  const applyOverrideToStaffRow = useCallback(
    (s) => {
      const ov = overrides?.[String(s.id)];
      if (!ov?.until || !ov?.values) return s;
      if (isExpired(ov.until)) return s;

      const patched = { ...s };
      for (const k of OVERRIDE_FIELDS) {
        if (Object.prototype.hasOwnProperty.call(ov.values, k)) {
          patched[k] = toNum(ov.values[k]);
        }
      }
      return patched;
    },
    [overrides]
  );

  const computedRows = useMemo(() => {
    const rows = (staff || []).map((raw) => {
      const s = applyOverrideToStaffRow(raw);

      const postage = toNum(s.postage);
      const transportation = toNum(s.transportation);
      const additionalTarget = toNum(s.additional_target);
      const repairing = toNum(s.repairing);
      const additionalMonitoring = toNum(s.additional_monitoring);

      const motorcycle = toNum(s.motorcycle_loan);
      const other = toNum(s.other_deduction);

      const suspension = approvedSuspensions[String(s.id)] || {
        deduction_transportation: 0,
        days_of_suspension: 0,
      };

      const suspensionTransportation = toNum(suspension.deduction_transportation);

      const noOfClients =
        toNum(s.no_of_clients) ||
        toNum(s.client_count) ||
        toNum(s.number_of_clients);

      const totalAllowance =
        postage +
        transportation +
        additionalTarget +
        repairing +
        additionalMonitoring;

      // Suspension transportation is automatically deducted from approved suspension orders.
      // It is intentionally hidden as a separate table column.
      const totalDeduction =
        motorcycle +
        other +
        suspensionTransportation;

      const netPay = totalAllowance - totalDeduction;
      const { pay10, pay25 } = splitTransportPay(netPay);

      return {
        ...s,
        id: s.id,
        employee_no: s.employee_no || "",
        fullname: s.fullname || "",
        first_name: s.first_name || "",
        middle_name: s.middle_name || "",
        last_name: s.last_name || "",
        position: s.position || "",
        regularization_date: s.regularization_date,
        noOfClients,

        postage,
        transportation,
        additionalTarget,
        repairing,
        additionalMonitoring,
        totalAllowance,

        motorcycle,
        other,
        suspensionTransportation,
        suspensionDays: toNum(suspension.days_of_suspension),
        totalDeduction,

        netPay,
        pay10,
        pay25,
      };
    });

    return sortByPosition(rows);
  }, [staff, applyOverrideToStaffRow, approvedSuspensions]);

  const sumColumn = (key) =>
    computedRows.reduce((sum, row) => sum + toNum(row[key]), 0);

  const getReceivedRecord = useCallback(
    (staffId) => {
      const id = makeReceivedId(staffId, selectedMonth);
      return receivedMap?.[id] || null;
    },
    [receivedMap, selectedMonth]
  );

  const isAlreadyReceived = useCallback(
    (staffId, cutOff) => {
      const rec = receivedMap?.[makeReceivedId(staffId, selectedMonth)];
      if (!rec) return false;

      return cutOff === "10th"
        ? toNum(rec.received_10th) > 0
        : toNum(rec.received_25th) > 0;
    },
    [receivedMap, selectedMonth]
  );

  const getRemainingPay10 = useCallback(
    (row) => {
      const rec = getReceivedRecord(row.id);
      return toNum(row.pay10) - toNum(rec?.received_10th);
    },
    [getReceivedRecord]
  );

  const getRemainingPay25 = useCallback(
    (row) => {
      const rec = getReceivedRecord(row.id);
      return toNum(row.pay25) - toNum(rec?.received_25th);
    },
    [getReceivedRecord]
  );

  const getTotalReceived = useCallback(
    (row) => {
      const rec = getReceivedRecord(row.id);
      return toNum(rec?.total_received);
    },
    [getReceivedRecord]
  );

  const openManualEdit = (row) => {
    if (!canManualEdit) {
      alert("Only Admin, HR, and Accounting can edit manually.");
      return;
    }

    closeMenu();
    setEditModalStaff(row);

    const today = new Date().toISOString().slice(0, 10);
    setEditUntil(today);

    setEditValues(emptyOverrideValues());
  };

  const saveManualEdit = async () => {
    if (!canManualEdit) {
      alert("Only Admin, HR, and Accounting can edit manually.");
      return;
    }

    if (!editModalStaff?.id || !branch?.id) return;

    const until = toDate10(editUntil);
    if (!until) return alert("Please set Effective date until.");

    if (isExpired(until)) {
      return alert("Effective date until is already expired. Please pick a future date.");
    }

    setSavingOverride(true);

    try {
      await api.post("/transport-overrides", {
        branch_id: Number(branch.id),
        staff_id: Number(editModalStaff.id),
        until,
        values: editValues,
      });

      await loadOverrides(branch.id);
      closeModal();
      alert("Manual override saved.");
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to save override");
    } finally {
      setSavingOverride(false);
    }
  };

  const clearOverrideForStaff = async (staffId) => {
    if (!canManualEdit) {
      alert("Only Admin, HR, and Accounting can remove manual edits.");
      return;
    }

    if (!branch?.id) return;

    try {
      await api.delete(`/transport-overrides/branch/${branch.id}/staff/${staffId}`);
      await loadOverrides(branch.id);
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to remove override");
    }
  };

  const markAsReceived = (row, cutOff) => {
    const recordId = makeReceivedId(row.id, selectedMonth);

    const existing = receivedMap?.[recordId] || {
      id: recordId,
      staff_id: row.id,
      employee_no: row.employee_no || "",
      fullname: row.fullname || "",
      position: row.position || "",
      regularization_date: row.regularization_date || "",
      transportation_month: selectedMonth,
      received_10th: 0,
      received_25th: 0,
      total_received: 0,
      received_at: null,
      branch_id: branch?.id || "",
      branch_code: branch?.code || "",
      branch_name: branch?.name || "",
    };

    if (cutOff === "10th" && toNum(existing.received_10th) > 0) {
      closeMenu();
      return alert("10th already received.");
    }

    if (cutOff === "25th" && toNum(existing.received_25th) > 0) {
      closeMenu();
      return alert("25th already received.");
    }

    const amount = cutOff === "10th" ? toNum(row.pay10) : toNum(row.pay25);

    const nextRecord = {
      ...existing,
      received_10th:
        cutOff === "10th" ? amount : toNum(existing.received_10th),
      received_25th:
        cutOff === "25th" ? amount : toNum(existing.received_25th),
      total_received:
        (cutOff === "10th" ? amount : toNum(existing.received_10th)) +
        (cutOff === "25th" ? amount : toNum(existing.received_25th)),
      received_at: new Date().toISOString(),
    };

    const next = {
      ...(receivedMap || {}),
      [recordId]: nextRecord,
    };

    persistReceivedMap(next);
    closeMenu();
    alert(`${cutOff} marked as received.`);
  };

  if (loading) {
    return (
      <div className="transpo-page">
        <div className="transpo-card">
          <div className="transpo-loading">Loading transportation…</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="transpo-page">
        <div className="transpo-card">
          <div className="transpo-error">{error}</div>
          <button className="btn-secondary" onClick={() => navigate(-1)} type="button">
            Back
          </button>
        </div>
      </div>
    );
  }

  const printedAt = new Date().toLocaleString();
  const transportMonth = new Date(`${selectedMonth}-01T00:00:00`).toLocaleDateString(
    undefined,
    {
      year: "numeric",
      month: "short",
    }
  );

  return (
    <div className="transpo-page">
      <div className="transpo-page-header no-print">
        <div>
          <h2 className="transpo-title">Transportation Report</h2>
          <p className="transpo-subtitle">
            {branch ? `${branch.code} • ${branch.name} • ${branch.area}` : ""}
          </p>
        </div>

        <div className="transpo-actions">
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="btn-secondary"
            style={{ padding: "9px 12px" }}
          />

          <button className="btn-secondary" onClick={() => navigate(-1)} type="button">
            ← Back
          </button>

          <button className="btn-primary" onClick={() => window.print()} type="button">
            Print
          </button>
        </div>
      </div>

      <div className="transpo-card no-print">
        <div className="transpo-card-head">
          <div className="transpo-card-title">Transportation Allowances</div>
          <div className="transpo-meta">
            Month: <strong>{selectedMonth}</strong> • Employees:{" "}
            <strong>{computedRows.length}</strong>
          </div>
        </div>

        <div className="transpo-table-wrap">
          <table className="transpo-table">
            <thead>
              <tr>
                <th rowSpan={2}>ID</th>
                <th rowSpan={2}>Employee No</th>
                <th rowSpan={2}>Full Name</th>
                <th rowSpan={2}>Position</th>
                <th rowSpan={2}>Date Regularized</th>
                <th rowSpan={2}>No. of Clients</th>

                <th colSpan={6}>ALLOWANCES & INCENTIVES</th>
                <th colSpan={3}>DEDUCTIONS</th>

                <th rowSpan={2}>Net Pay</th>
                <th rowSpan={2}>10th</th>
                <th rowSpan={2}>25th</th>
                <th rowSpan={2}>Received</th>
                <th rowSpan={2}>Action</th>
              </tr>

              <tr>
                <th>Postage</th>
                <th>Transportation</th>
                <th>Target / 1200 / Less Excuses</th>
                <th>Repairing</th>
                <th>Monitoring</th>
                <th>Total Allowance</th>

                <th>Motorcycle</th>
                <th>Other</th>
                <th>Total Deduction</th>
              </tr>
            </thead>

            <tbody>
              {computedRows.length === 0 ? (
                <tr>
                  <td colSpan={19} className="empty-state">
                    No staff found for this branch.
                  </td>
                </tr>
              ) : (
                computedRows.map((r) => {
                  const staffId = String(r.id);
                  const ov = overrides?.[staffId];
                  const hasOverride = !!ov && !isExpired(ov?.until);

                  return (
                    <tr key={r.id}>
                      <td className="mono">{r.id}</td>
                      <td className="mono">{r.employee_no || "-"}</td>
                      <td className="td-strong td-left">
                        {r.fullname}
                        {hasOverride ? (
                          <span style={{ marginLeft: 8, fontSize: 11, opacity: 0.9 }}>
                            (Manual until {ov?.until})
                          </span>
                        ) : null}
                      </td>
                      <td>{r.position || "-"}</td>
                      <td>{fmtDate(r.regularization_date)}</td>
                      <td className="num">{fmt(r.noOfClients)}</td>

                      <td className="num">{fmt(r.postage)}</td>
                      <td className="num">{fmt(r.transportation)}</td>
                      <td className="num">{fmt(r.additionalTarget)}</td>
                      <td className="num">{fmt(r.repairing)}</td>
                      <td className="num">{fmt(r.additionalMonitoring)}</td>
                      <td className="num td-strong">{fmt(r.totalAllowance)}</td>

                      <td className="num">{fmt(r.motorcycle)}</td>
                      <td className="num">{fmt(r.other)}</td>
                      <td className="num td-strong">{fmt(r.totalDeduction)}</td>

                      <td className={`num td-strong ${r.netPay < 0 ? "neg" : "pos"}`}>
                        {fmt(r.netPay)}
                      </td>
                      <td className={`num td-strong ${getRemainingPay10(r) < 0 ? "neg" : "pos"}`}>
                        {fmt(getRemainingPay10(r))}
                      </td>
                      <td className={`num td-strong ${getRemainingPay25(r) < 0 ? "neg" : "pos"}`}>
                        {fmt(getRemainingPay25(r))}
                      </td>
                      <td className="num td-strong">{fmt(getTotalReceived(r))}</td>

                      <td>
                        <button
                          type="button"
                          className="transpo-dots-btn"
                          onClick={(e) => openMenuFor(r.id, e)}
                          title="Actions"
                        >
                          <HiDotsVertical />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}

              {computedRows.length > 0 && (
                <tr className="totals-row">
                  <td colSpan={5} className="totals-label">
                    Totals
                  </td>

                  <td className="num">{fmt(sumColumn("noOfClients"))}</td>

                  <td className="num">{fmt(sumColumn("postage"))}</td>
                  <td className="num">{fmt(sumColumn("transportation"))}</td>
                  <td className="num">{fmt(sumColumn("additionalTarget"))}</td>
                  <td className="num">{fmt(sumColumn("repairing"))}</td>
                  <td className="num">{fmt(sumColumn("additionalMonitoring"))}</td>
                  <td className="num td-strong">{fmt(sumColumn("totalAllowance"))}</td>

                  <td className="num">{fmt(sumColumn("motorcycle"))}</td>
                  <td className="num">{fmt(sumColumn("other"))}</td>
                  <td className="num td-strong">{fmt(sumColumn("totalDeduction"))}</td>

                  <td className="num td-strong">{fmt(sumColumn("netPay"))}</td>
                  <td className="num td-strong">
                    {fmt(computedRows.reduce((sum, r) => sum + getRemainingPay10(r), 0))}
                  </td>
                  <td className="num td-strong">
                    {fmt(computedRows.reduce((sum, r) => sum + getRemainingPay25(r), 0))}
                  </td>
                  <td className="num td-strong">
                    {fmt(computedRows.reduce((sum, r) => sum + getTotalReceived(r), 0))}
                  </td>
                  <td />
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="transpo-hint">Tip: scroll horizontally to view all columns.</div>
      </div>

      {menuOpenFor ? (
        <div
          ref={menuWrapRef}
          className="transpo-action-menu transpo-action-menu--floating"
          style={{
            top: `${menuPos.top}px`,
            left: `${menuPos.left}px`,
          }}
        >
          {(() => {
            const r = computedRows.find((row) => row.id === menuOpenFor);
            if (!r) return null;

            const hasOverride =
              !!overrides?.[String(r.id)] && !isExpired(overrides?.[String(r.id)]?.until);

            return (
              <>
                <button
                  type="button"
                  className="transpo-action-item"
                  onClick={() => markAsReceived(r, "10th")}
                  disabled={isAlreadyReceived(r.id, "10th")}
                >
                  {isAlreadyReceived(r.id, "10th") ? "10th Received" : "Received 10th"}
                </button>

                <button
                  type="button"
                  className="transpo-action-item"
                  onClick={() => markAsReceived(r, "25th")}
                  disabled={isAlreadyReceived(r.id, "25th")}
                >
                  {isAlreadyReceived(r.id, "25th") ? "25th Received" : "Received 25th"}
                </button>

                {canManualEdit ? (
                  <button
                    type="button"
                    className="transpo-action-item"
                    onClick={() => openManualEdit(r)}
                  >
                    Edit manually
                  </button>
                ) : null}

                {canManualEdit && hasOverride ? (
                  <button
                    type="button"
                    className="transpo-action-item danger"
                    onClick={() => {
                      closeMenu();
                      const ok = window.confirm(
                        "Remove manual override and revert to normal?"
                      );
                      if (ok) clearOverrideForStaff(r.id);
                    }}
                  >
                    Remove manual edit
                  </button>
                ) : null}
              </>
            );
          })()}
        </div>
      ) : null}

      {editModalStaff && canManualEdit ? (
        <div
          className="transpo-modal-overlay"
          onMouseDown={(e) =>
            e.target.classList.contains("transpo-modal-overlay") && closeModal()
          }
        >
          <div className="transpo-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="transpo-modal-head">
              <div>
                <div className="transpo-modal-title">Edit manually</div>
                <div className="transpo-modal-sub">
                  Employee: <b>{editModalStaff.fullname}</b> (ID:{" "}
                  <span className="mono">{editModalStaff.id}</span>)
                </div>
                <div style={{ fontSize: 12, opacity: 0.85, marginTop: 6 }}>
                  Note: Values start at <b>0</b>. This is a temporary override and
                  will revert automatically.
                </div>
              </div>

              <button
                type="button"
                className="transpo-modal-x"
                onClick={closeModal}
                disabled={savingOverride}
              >
                ✕
              </button>
            </div>

            <div className="transpo-modal-body">
              <div className="transpo-modal-row">
                <label>Effective date until</label>
                <input
                  type="date"
                  value={editUntil}
                  onChange={(e) => setEditUntil(e.target.value)}
                  disabled={savingOverride}
                />
              </div>

              <div className="transpo-modal-grid">
                {OVERRIDE_FIELDS.map((k) => (
                  <div key={k} className="transpo-modal-field">
                    <label>{LABELS[k] || k}</label>
                    <input
                      type="number"
                      step="0.01"
                      value={toNum(editValues[k])}
                      onChange={(e) =>
                        setEditValues((p) => ({
                          ...p,
                          [k]: toNum(e.target.value),
                        }))
                      }
                      disabled={savingOverride}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="transpo-modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={closeModal}
                disabled={savingOverride}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={saveManualEdit}
                disabled={savingOverride}
              >
                {savingOverride ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="print-only">
        <div className="branch-transpo-print">
          <div className="branch-payroll-print__title">
            AmberCash PH Micro Lending Corp.
          </div>
          <div className="branch-payroll-print__subtitle">
            TRANSPORTATION ALLOWANCE
          </div>
          <div className="branch-payroll-print__branch">
            {branch ? `${branch.code} ${branch.name}` : "-"}
          </div>
          <div className="branch-payroll-print__period">{transportMonth}</div>

          <div className="branch-payroll-print__meta">
            <div>
              <strong>AREA:</strong> {branch?.area || "-"}
            </div>
            <div>
              <strong>BRANCH:</strong>{" "}
              {branch ? `${branch.code} - ${branch.name}` : "-"}
            </div>
            <div>
              <strong>As of:</strong> {printedAt}
            </div>
          </div>

          <table className="branch-transpo-print-table">
            <thead>
              <tr>
                <th rowSpan={2}>#</th>
                <th rowSpan={2}>Family Name</th>
                <th rowSpan={2}>First/Given Name</th>
                <th rowSpan={2}>Middle Name</th>
                <th rowSpan={2}>ID No</th>
                <th rowSpan={2}>Position</th>
                <th rowSpan={2}>Date Regularized</th>
                <th rowSpan={2}>Clients</th>

                <th colSpan={6}>ALLOWANCES & INCENTIVES</th>
                <th colSpan={3}>DEDUCTIONS</th>

                <th rowSpan={2}>Total Net Pay</th>
                <th rowSpan={2}>10th</th>
                <th rowSpan={2}>25th</th>
                <th rowSpan={2}>Received</th>
              </tr>

              <tr>
                <th>Postage</th>
                <th>Transportation</th>
                <th>Target</th>
                <th>Repairing</th>
                <th>Monitoring</th>
                <th>Total</th>

                <th>Motorcycle</th>
                <th>Other</th>
                <th>Total</th>
              </tr>
            </thead>

            <tbody>
              {computedRows.length === 0 ? (
                <tr>
                  <td colSpan={21}>No staff found for this branch.</td>
                </tr>
              ) : (
                computedRows.map((r, idx) => {
                  const family = toStr(r.last_name);
                  const first = toStr(r.first_name);
                  const middle = toStr(r.middle_name);

                  return (
                    <tr key={`print-${r.id}`}>
                      <td>{idx + 1}</td>
                      <td>{family || "-"}</td>
                      <td>{first || "-"}</td>
                      <td>{middle || "-"}</td>
                      <td>{r.employee_no || r.id}</td>
                      <td>{r.position || "-"}</td>
                      <td>{fmtDate(r.regularization_date)}</td>
                      <td>{fmt(r.noOfClients)}</td>

                      <td>{fmt(r.postage)}</td>
                      <td>{fmt(r.transportation)}</td>
                      <td>{fmt(r.additionalTarget)}</td>
                      <td>{fmt(r.repairing)}</td>
                      <td>{fmt(r.additionalMonitoring)}</td>
                      <td>{fmt(r.totalAllowance)}</td>

                      <td>{fmt(r.motorcycle)}</td>
                      <td>{fmt(r.other)}</td>
                      <td>{fmt(r.totalDeduction)}</td>

                      <td>{fmt(r.netPay)}</td>
                      <td>{fmt(getRemainingPay10(r))}</td>
                      <td>{fmt(getRemainingPay25(r))}</td>
                      <td>{fmt(getTotalReceived(r))}</td>
                    </tr>
                  );
                })
              )}

              {computedRows.length > 0 && (
                <tr className="totals-row">
                  <td colSpan={7}>TOTAL</td>
                  <td>{fmt(sumColumn("noOfClients"))}</td>

                  <td>{fmt(sumColumn("postage"))}</td>
                  <td>{fmt(sumColumn("transportation"))}</td>
                  <td>{fmt(sumColumn("additionalTarget"))}</td>
                  <td>{fmt(sumColumn("repairing"))}</td>
                  <td>{fmt(sumColumn("additionalMonitoring"))}</td>
                  <td>{fmt(sumColumn("totalAllowance"))}</td>

                  <td>{fmt(sumColumn("motorcycle"))}</td>
                  <td>{fmt(sumColumn("other"))}</td>
                  <td>{fmt(sumColumn("totalDeduction"))}</td>

                  <td>{fmt(sumColumn("netPay"))}</td>
                  <td>{fmt(computedRows.reduce((sum, r) => sum + getRemainingPay10(r), 0))}</td>
                  <td>{fmt(computedRows.reduce((sum, r) => sum + getRemainingPay25(r), 0))}</td>
                  <td>{fmt(computedRows.reduce((sum, r) => sum + getTotalReceived(r), 0))}</td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="branch-payroll-print__signatures">
            <div className="branch-payroll-print__sign-box">
              <div className="branch-payroll-print__sign-line"></div>
              <div>Prepared by:</div>
            </div>

            <div className="branch-payroll-print__sign-box">
              <div className="branch-payroll-print__sign-line"></div>
              <div>Checked by:</div>
            </div>

            <div className="branch-payroll-print__sign-box">
              <div className="branch-payroll-print__sign-line"></div>
              <div>Approved by:</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Transportation;