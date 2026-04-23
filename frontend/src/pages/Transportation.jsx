import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
const toDate10 = (v) => (v ? String(v).slice(0, 10) : "");

const isActiveStaff = (s) => norm(s.status || "Active") !== "inactive";

const readUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
};

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

const emptyHistoryValues = () => {
  const o = {};
  OVERRIDE_FIELDS.forEach((k) => {
    o[k] = 0;
  });
  return o;
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
  "assistant branch manager",
  "supervisor",
  "collector",
  "loan officer",
  "probationary loan officer",
  "staff",
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

    return toStr(a?.fullname).localeCompare(toStr(b?.fullname));
  });
};

export default function Transportation() {
  const params = useParams();
  const branchParam = toStr(params.branchId ?? params.id);
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

  const money = (v) => toNum(v).toLocaleString();

  const [historyMap, setHistoryMap] = useState({});
  const [approvedSuspensions, setApprovedSuspensions] = useState({});
  const [receivedMap, setReceivedMap] = useState({});
  const [menuOpenFor, setMenuOpenFor] = useState(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const menuWrapRef = useRef(null);

  const [editModalStaff, setEditModalStaff] = useState(null);
  const [editValues, setEditValues] = useState(() => emptyHistoryValues());
  const [savingHistory, setSavingHistory] = useState(false);

  const receivedStorageKey = useMemo(
    () => `transport_received::${branchParam}::${selectedMonth}`,
    [branchParam, selectedMonth]
  );

  const loadHistory = useCallback(async (resolvedBranchId, month) => {
    if (!resolvedBranchId || !month) return;

    try {
      const res = await api.get(`/transport-history/branch/${resolvedBranchId}`, {
        params: { month },
      });

      const map = {};

      (Array.isArray(res.data) ? res.data : []).forEach((r) => {
        const staffId = String(r.staff_id);

        map[staffId] = {
          history_month: r.history_month,
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

      setHistoryMap(map);
    } catch (err) {
      console.error("loadHistory failed:", err?.response?.data || err?.message || err);
      setHistoryMap({});
    }
  }, []);

  const openMenuFor = useCallback((staffId, event) => {
    const rect = event.currentTarget.getBoundingClientRect();

    setMenuPos({
      top: rect.bottom + 6,
      left: Math.max(8, rect.right - 210),
    });

    setMenuOpenFor((prev) => (prev === staffId ? null : staffId));
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(receivedStorageKey);
      const parsed = raw ? JSON.parse(raw) : {};
      setReceivedMap(parsed && typeof parsed === "object" ? parsed : {});
    } catch {
      setReceivedMap({});
    }
  }, [receivedStorageKey]);

  const persistReceivedMap = useCallback(
    (next) => {
      setReceivedMap(next);
      try {
        localStorage.setItem(receivedStorageKey, JSON.stringify(next));
      } catch {}
    },
    [receivedStorageKey]
  );

  useEffect(() => {
    const onDown = (e) => {
      if (!menuOpenFor) return;
      if (menuWrapRef.current && !menuWrapRef.current.contains(e.target)) {
        setMenuOpenFor(null);
      }
    };

    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpenFor]);

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
          api.get("/suspension-orders"),
        ]);

        const branches = Array.isArray(branchesRes.data) ? branchesRes.data : [];

        const foundBranch = branches.find((x) => {
          const idMatch =
            Number.isFinite(Number(branchParam)) && Number(x.id) === Number(branchParam);
          const codeMatch = norm(x.code) === norm(branchParam);
          return idMatch || codeMatch;
        });

        if (!foundBranch) {
          setError("Branch not found.");
          setLoading(false);
          return;
        }

        setBranch(foundBranch);

        const all = Array.isArray(staffRes.data) ? staffRes.data : [];

        const byBranchId = all.filter((s) => Number(s.branch_id) === Number(foundBranch.id));
        const byBranchCode = all.filter((s) => norm(s.branch_code) === norm(foundBranch.code));

        const filteredRaw =
          byBranchId.length > 0
            ? byBranchId
            : byBranchCode.length > 0
              ? byBranchCode
              : all.filter((s) => norm(s.area) === norm(foundBranch.area));

        const filtered = filteredRaw.filter(isActiveStaff);

        setStaff(filtered);
        await loadHistory(foundBranch.id, selectedMonth);

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
  }, [branchParam, selectedMonth, loadHistory]);

  const applyHistoryToStaffRow = useCallback(
    (s) => {
      const hist = historyMap?.[String(s.id)];
      if (!hist?.values) return s;

      const patched = { ...s };
      for (const k of OVERRIDE_FIELDS) {
        if (Object.prototype.hasOwnProperty.call(hist.values, k)) {
          patched[k] = toNum(hist.values[k]);
        }
      }
      return patched;
    },
    [historyMap]
  );

  const rows = useMemo(() => {
    const mapped = (staff || []).map((raw) => {
      const s = applyHistoryToStaffRow(raw);

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
        postage + transportation + additionalTarget + repairing + additionalMonitoring;
      const totalDeduction = motorcycle + other + suspensionTransportation;
      const netPay = totalAllowance - totalDeduction;

      const received = receivedMap[String(s.id)] || {
        r10: false,
        r25: false,
      };

      const half10 = netPay / 2;
      const half25 = netPay / 2;

      const netPay10 = received.r10 ? 0 : half10;
      const netPay25 = received.r25 ? 0 : half25;
      const receivedTotal =
        (received.r10 ? half10 : 0) +
        (received.r25 ? half25 : 0);

      return {
        id: s.id,
        employee_no: s.employee_no || "",
        fullname: s.fullname,
        position: s.position,
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
        netPay10,
        netPay25,
        receivedTotal,
      };
    });

    return sortByPosition(mapped);
  }, [staff, applyHistoryToStaffRow, approvedSuspensions, receivedMap]);

  const totals = useMemo(() => {
    return rows.reduce(
      (t, r) => {
        t.noOfClients += r.noOfClients;
        t.postage += r.postage;
        t.transportation += r.transportation;
        t.additionalTarget += r.additionalTarget;
        t.repairing += r.repairing;
        t.additionalMonitoring += r.additionalMonitoring;
        t.totalAllowance += r.totalAllowance;
        t.motorcycle += r.motorcycle;
        t.other += r.other;
        t.suspensionTransportation += r.suspensionTransportation;
        t.totalDeduction += r.totalDeduction;
        t.netPay += r.netPay;
        t.netPay10 += r.netPay10;
        t.netPay25 += r.netPay25;
        t.received += r.receivedTotal;
        return t;
      },
      {
        noOfClients: 0,
        postage: 0,
        transportation: 0,
        additionalTarget: 0,
        repairing: 0,
        additionalMonitoring: 0,
        totalAllowance: 0,
        motorcycle: 0,
        other: 0,
        suspensionTransportation: 0,
        totalDeduction: 0,
        netPay: 0,
        netPay10: 0,
        netPay25: 0,
        received: 0,
      }
    );
  }, [rows]);

  const openManualEdit = (row) => {
    if (!canManualEdit) {
      alert("Only Admin, HR, and Accounting can edit manually.");
      return;
    }

    setMenuOpenFor(null);
    setEditModalStaff(row);

    const existing = historyMap?.[String(row.id)]?.values;
    setEditValues(
      existing
        ? {
            postage: toNum(existing.postage),
            transportation: toNum(existing.transportation),
            additional_target: toNum(existing.additional_target),
            repairing: toNum(existing.repairing),
            additional_monitoring: toNum(existing.additional_monitoring),
            motorcycle_loan: toNum(existing.motorcycle_loan),
            other_deduction: toNum(existing.other_deduction),
          }
        : emptyHistoryValues()
    );
  };

  const closeModal = () => {
    if (savingHistory) return;
    setEditModalStaff(null);
    setEditValues(emptyHistoryValues());
  };

  const saveManualEdit = async () => {
    if (!canManualEdit) {
      alert("Only Admin, HR, and Accounting can edit manually.");
      return;
    }

    if (!editModalStaff?.id || !branch?.id) return;

    setSavingHistory(true);
    try {
      await api.post("/transport-history", {
        branch_id: Number(branch.id),
        staff_id: Number(editModalStaff.id),
        employee_no: editModalStaff.employee_no || "",
        history_month: selectedMonth,
        values: editValues,
      });

      await loadHistory(branch.id, selectedMonth);
      closeModal();
      alert("Transportation history saved.");
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to save transportation history");
    } finally {
      setSavingHistory(false);
    }
  };

  const clearOverrideForStaff = async (staffId) => {
    if (!canManualEdit) {
      alert("Only Admin, HR, and Accounting can remove manual edits.");
      return;
    }

    if (!branch?.id) return;

    try {
      await api.delete(`/transport-history/branch/${branch.id}/staff/${staffId}`, {
        params: { month: selectedMonth },
      });
      await loadHistory(branch.id, selectedMonth);
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to remove transportation history");
    }
  };

  const markAsReceived = (staffId, which) => {
    const next = {
      ...(receivedMap || {}),
      [String(staffId)]: {
        ...(receivedMap[String(staffId)] || {}),
        [which]: true,
      },
    };
    persistReceivedMap(next);
    setMenuOpenFor(null);
  };

  if (loading) {
    return (
      <div className="transpo-page">
        <div className="transpo-card">
          <div className="transpo-loading">Loading report…</div>
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

  const printMonth = new Date(`${selectedMonth}-01T00:00:00`).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
  });

  return (
    <>
      <div className="transpo-page no-print">
        <div className="transpo-page-header">
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

        <div className="transpo-card">
          <div className="transpo-card-head">
            <div className="transpo-card-title">Allowances, Deductions & Net Pay</div>
            <div className="transpo-meta">
              Month: <strong>{selectedMonth}</strong>
            </div>
          </div>

          <div className="transpo-table-wrap">
            <table className="transpo-table">
              <thead>
                <tr>
                  <th rowSpan={2}>ID</th>
                  <th rowSpan={2}>Employee No</th>
                  <th rowSpan={2}>Staff Name</th>
                  <th rowSpan={2}>Position</th>
                  <th rowSpan={2}>Date Regularized</th>
                  <th rowSpan={2}>No. of Clients</th>

                  <th colSpan={6}>Allowances & Incentives</th>
                  <th colSpan={4}>Deductions</th>
                  <th colSpan={4}>Net Pay</th>

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
                  <th>Suspension Transpo</th>
                  <th>Total Deduction</th>

                  <th>Total Net Pay</th>
                  <th>10th</th>
                  <th>25th</th>
                  <th>Received</th>
                </tr>
              </thead>

              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={21} className="empty-state">
                      No staff found for this branch.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => {
                    const staffId = String(r.id);
                    const hist = historyMap?.[staffId];
                    const hasHistory = !!hist?.values;
                    const received = receivedMap?.[staffId] || {};

                    return (
                      <tr key={r.id}>
                        <td className="mono">{r.id}</td>
                        <td className="mono">{r.employee_no || "-"}</td>
                        <td className="td-strong td-left">
                          {r.fullname}
                          {hasHistory ? (
                            <span style={{ marginLeft: 8, fontSize: 11, opacity: 0.9 }}>
                              ({selectedMonth})
                            </span>
                          ) : null}
                        </td>
                        <td>{r.position || "-"}</td>
                        <td>{r.regularization_date ? String(r.regularization_date).split("T")[0] : "-"}</td>
                        <td>{r.noOfClients || 0}</td>

                        <td>₱ {money(r.postage)}</td>
                        <td>₱ {money(r.transportation)}</td>
                        <td>₱ {money(r.additionalTarget)}</td>
                        <td>₱ {money(r.repairing)}</td>
                        <td>₱ {money(r.additionalMonitoring)}</td>
                        <td className="td-strong">₱ {money(r.totalAllowance)}</td>

                        <td>₱ {money(r.motorcycle)}</td>
                        <td>₱ {money(r.other)}</td>
                        <td>₱ {money(r.suspensionTransportation)}</td>
                        <td className="td-strong">₱ {money(r.totalDeduction)}</td>

                        <td className={`td-strong ${r.netPay < 0 ? "neg" : "pos"}`}>
                          ₱ {money(r.netPay)}
                        </td>
                        <td className={`${r.netPay10 < 0 ? "neg" : "pos"}`}>₱ {money(r.netPay10)}</td>
                        <td className={`${r.netPay25 < 0 ? "neg" : "pos"}`}>₱ {money(r.netPay25)}</td>
                        <td className="td-strong">₱ {money(r.receivedTotal)}</td>

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

                {rows.length > 0 && (
                  <tr className="totals-row">
                    <td colSpan={6} className="totals-label">
                      Total
                    </td>

                    <td>₱ {money(totals.postage)}</td>
                    <td>₱ {money(totals.transportation)}</td>
                    <td>₱ {money(totals.additionalTarget)}</td>
                    <td>₱ {money(totals.repairing)}</td>
                    <td>₱ {money(totals.additionalMonitoring)}</td>
                    <td className="td-strong">₱ {money(totals.totalAllowance)}</td>

                    <td>₱ {money(totals.motorcycle)}</td>
                    <td>₱ {money(totals.other)}</td>
                    <td>₱ {money(totals.suspensionTransportation)}</td>
                    <td className="td-strong">₱ {money(totals.totalDeduction)}</td>

                    <td className="td-strong">₱ {money(totals.netPay)}</td>
                    <td className="td-strong">₱ {money(totals.netPay10)}</td>
                    <td className="td-strong">₱ {money(totals.netPay25)}</td>
                    <td className="td-strong">₱ {money(totals.received)}</td>

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
              const r = rows.find((row) => row.id === menuOpenFor);
              if (!r) return null;

              const hasHistory = !!historyMap?.[String(r.id)]?.values;
              const received = receivedMap?.[String(r.id)] || {};

              return (
                <>
                  <button
                    type="button"
                    className="transpo-action-item"
                    onClick={() => markAsReceived(r.id, "r10")}
                    disabled={!!received.r10}
                  >
                    {received.r10 ? "10th Received" : "Mark 10th Received"}
                  </button>

                  <button
                    type="button"
                    className="transpo-action-item"
                    onClick={() => markAsReceived(r.id, "r25")}
                    disabled={!!received.r25}
                  >
                    {received.r25 ? "25th Received" : "Mark 25th Received"}
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

                  {canManualEdit && hasHistory ? (
                    <button
                      type="button"
                      className="transpo-action-item danger"
                      onClick={() => {
                        setMenuOpenFor(null);
                        const ok = window.confirm(
                          `Remove transportation history for ${selectedMonth}?`
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
                    Editing month: <b>{selectedMonth}</b>
                  </div>
                </div>
                <button
                  type="button"
                  className="transpo-modal-x"
                  onClick={closeModal}
                  disabled={savingHistory}
                >
                  ✕
                </button>
              </div>

              <div className="transpo-modal-body">
                <div className="transpo-modal-grid">
                  {OVERRIDE_FIELDS.map((k) => (
                    <div key={k} className="transpo-modal-field">
                      <label>{LABELS[k] || k}</label>
                      <input
                        type="number"
                        value={toNum(editValues[k])}
                        onChange={(e) =>
                          setEditValues((p) => ({
                            ...p,
                            [k]: toNum(e.target.value),
                          }))
                        }
                        disabled={savingHistory}
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
                  disabled={savingHistory}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={saveManualEdit}
                  disabled={savingHistory}
                >
                  {savingHistory ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="print-only">
        <div className="branch-transpo-print">
          <div className="branch-transpo-print__title">TRANSPORTATION REPORT</div>
          <div className="branch-transpo-print__branch">
            {branch ? `${branch.code} • ${branch.name}` : ""}
          </div>
          <div className="branch-transpo-print__period">
            {branch?.area || ""} • {printMonth}
          </div>

          <table className="branch-transpo-print-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Employee No</th>
                <th>Name</th>
                <th>Position</th>
                <th>Date Regularized</th>
                <th>Clients</th>
                <th>Postage</th>
                <th>Transportation</th>
                <th>Target</th>
                <th>Repairing</th>
                <th>Monitoring</th>
                <th>Total Allowance</th>
                <th>Motorcycle</th>
                <th>Other</th>
                <th>Suspension Transpo</th>
                <th>Total Deduction</th>
                <th>Total Net Pay</th>
                <th>10th</th>
                <th>25th</th>
                <th>Received</th>
              </tr>
            </thead>

            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={20}>No staff found for this branch.</td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={`print-${r.id}`}>
                    <td>{r.id}</td>
                    <td>{r.employee_no || "-"}</td>
                    <td>{r.fullname}</td>
                    <td>{r.position || "-"}</td>
                    <td>{r.regularization_date ? String(r.regularization_date).split("T")[0] : "-"}</td>
                    <td>{r.noOfClients || 0}</td>
                    <td>{money(r.postage)}</td>
                    <td>{money(r.transportation)}</td>
                    <td>{money(r.additionalTarget)}</td>
                    <td>{money(r.repairing)}</td>
                    <td>{money(r.additionalMonitoring)}</td>
                    <td>{money(r.totalAllowance)}</td>
                    <td>{money(r.motorcycle)}</td>
                    <td>{money(r.other)}</td>
                    <td>{money(r.suspensionTransportation)}</td>
                    <td>{money(r.totalDeduction)}</td>
                    <td>{money(r.netPay)}</td>
                    <td>{money(r.netPay10)}</td>
                    <td>{money(r.netPay25)}</td>
                    <td>{money(r.receivedTotal)}</td>
                  </tr>
                ))
              )}

              {rows.length > 0 && (
                <tr className="branch-transpo-print-total">
                  <td colSpan={6}>TOTAL</td>
                  <td>{money(totals.postage)}</td>
                  <td>{money(totals.transportation)}</td>
                  <td>{money(totals.additionalTarget)}</td>
                  <td>{money(totals.repairing)}</td>
                  <td>{money(totals.additionalMonitoring)}</td>
                  <td>{money(totals.totalAllowance)}</td>
                  <td>{money(totals.motorcycle)}</td>
                  <td>{money(totals.other)}</td>
                  <td>{money(totals.suspensionTransportation)}</td>
                  <td>{money(totals.totalDeduction)}</td>
                  <td>{money(totals.netPay)}</td>
                  <td>{money(totals.netPay10)}</td>
                  <td>{money(totals.netPay25)}</td>
                  <td>{money(totals.received)}</td>
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
    </>
  );
}