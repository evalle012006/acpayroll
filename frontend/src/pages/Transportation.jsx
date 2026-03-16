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
  const o = {};
  OVERRIDE_FIELDS.forEach((k) => {
    o[k] = 0;
  });
  return o;
};

const isExpired = (until) => {
  if (!until) return true;
  const end = new Date(`${until}T23:59:59`);
  return end.getTime() < Date.now();
};

export default function Transportation() {
  const params = useParams();
  const branchParam = toStr(params.branchId ?? params.id);
  const navigate = useNavigate();

  const [branch, setBranch] = useState(null);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const money = (v) => toNum(v).toLocaleString();

  const [overrides, setOverrides] = useState({});
  const [menuOpenFor, setMenuOpenFor] = useState(null);
  const menuWrapRef = useRef(null);

  const [editModalStaff, setEditModalStaff] = useState(null);
  const [editUntil, setEditUntil] = useState("");
  const [editValues, setEditValues] = useState(() => emptyOverrideValues());
  const [savingOverride, setSavingOverride] = useState(false);

  /* ---------------- Load overrides from PostgreSQL ---------------- */
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
    }
  }, []);

  /* ---------------- Click outside menu ---------------- */
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

  /* ---------------- Data load ---------------- */
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
        const branchesRes = await api.get("/branches");
        const branches = Array.isArray(branchesRes.data) ? branchesRes.data : [];

        const foundBranch = branches.find((x) => {
          const idMatch = Number.isFinite(Number(branchParam)) && Number(x.id) === Number(branchParam);
          const codeMatch = norm(x.code) === norm(branchParam);
          return idMatch || codeMatch;
        });

        if (!foundBranch) {
          setError("Branch not found.");
          setLoading(false);
          return;
        }

        setBranch(foundBranch);

        const staffRes = await api.get("/staff");
        const all = Array.isArray(staffRes.data) ? staffRes.data : [];

        const byBranchId = all.filter((s) => Number(s.branch_id) === Number(foundBranch.id));
        const byBranchCode = all.filter((s) => norm(s.branch_code) === norm(foundBranch.code));

        const filtered =
          byBranchId.length > 0
            ? byBranchId
            : byBranchCode.length > 0
            ? byBranchCode
            : all.filter((s) => norm(s.area) === norm(foundBranch.area));

        setStaff(filtered);
        await loadOverrides(foundBranch.id);
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
  }, [branchParam, loadOverrides]);

  /* ---------------- Apply override (if active) ---------------- */
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

  /* ---------------- Compute rows ---------------- */
  const rows = useMemo(() => {
    return (staff || []).map((raw) => {
      const s = applyOverrideToStaffRow(raw);

      const postage = toNum(s.postage);
      const transportation = toNum(s.transportation);
      const additionalTarget = toNum(s.additional_target);
      const repairing = toNum(s.repairing);
      const additionalMonitoring = toNum(s.additional_monitoring);

      const motorcycle = toNum(s.motorcycle_loan);
      const other = toNum(s.other_deduction);

      const totalAllowance =
        postage + transportation + additionalTarget + repairing + additionalMonitoring;
      const totalDeduction = motorcycle + other;
      const netPay = totalAllowance - totalDeduction;

      return {
        id: s.id,
        employee_no: s.employee_no || "",
        fullname: s.fullname,
        position: s.position,
        regularization_date: s.regularization_date,

        postage,
        transportation,
        additionalTarget,
        repairing,
        additionalMonitoring,
        totalAllowance,

        motorcycle,
        other,
        totalDeduction,

        netPay,
        netPay10: netPay / 2,
        netPay25: netPay / 2,
      };
    });
  }, [staff, applyOverrideToStaffRow]);

  const totals = useMemo(() => {
    return rows.reduce(
      (t, r) => {
        t.postage += r.postage;
        t.transportation += r.transportation;
        t.additionalTarget += r.additionalTarget;
        t.repairing += r.repairing;
        t.additionalMonitoring += r.additionalMonitoring;
        t.totalAllowance += r.totalAllowance;
        t.motorcycle += r.motorcycle;
        t.other += r.other;
        t.totalDeduction += r.totalDeduction;
        t.netPay += r.netPay;
        t.netPay10 += r.netPay10;
        t.netPay25 += r.netPay25;
        return t;
      },
      {
        postage: 0,
        transportation: 0,
        additionalTarget: 0,
        repairing: 0,
        additionalMonitoring: 0,
        totalAllowance: 0,
        motorcycle: 0,
        other: 0,
        totalDeduction: 0,
        netPay: 0,
        netPay10: 0,
        netPay25: 0,
      }
    );
  }, [rows]);

  /* ---------------- Modal actions ---------------- */
  const openManualEdit = (row) => {
    setMenuOpenFor(null);
    setEditModalStaff(row);

    const today = new Date().toISOString().slice(0, 10);
    setEditUntil(today);

    setEditValues(emptyOverrideValues());
  };

  const closeModal = () => {
    if (savingOverride) return;
    setEditModalStaff(null);
    setEditUntil("");
    setEditValues(emptyOverrideValues());
  };

  const saveManualEdit = async () => {
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
    if (!branch?.id) return;

    try {
      await api.delete(`/transport-overrides/branch/${branch.id}/staff/${staffId}`);
      await loadOverrides(branch.id);
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to remove override");
    }
  };

  /* ---------------- UI states ---------------- */
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

  return (
    <div className="transpo-page">
      <div className="transpo-page-header">
        <div>
          <h2 className="transpo-title">Transportation Report</h2>
          <p className="transpo-subtitle">
            {branch ? `${branch.code} • ${branch.name} • ${branch.area}` : ""}
          </p>
        </div>

        <div className="transpo-actions">
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

                <th colSpan={6}>Allowances & Incentives</th>
                <th colSpan={3}>Deductions</th>
                <th colSpan={3}>Net Pay</th>

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

                <th>Total Net Pay</th>
                <th>10th</th>
                <th>25th</th>
              </tr>
            </thead>

            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={18} className="empty-state">
                    No staff found for this branch.
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
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
                      <td>{r.regularization_date ? String(r.regularization_date).split("T")[0] : "-"}</td>

                      <td>₱ {money(r.postage)}</td>
                      <td>₱ {money(r.transportation)}</td>
                      <td>₱ {money(r.additionalTarget)}</td>
                      <td>₱ {money(r.repairing)}</td>
                      <td>₱ {money(r.additionalMonitoring)}</td>
                      <td className="td-strong">₱ {money(r.totalAllowance)}</td>

                      <td>₱ {money(r.motorcycle)}</td>
                      <td>₱ {money(r.other)}</td>
                      <td className="td-strong">₱ {money(r.totalDeduction)}</td>

                      <td className={`td-strong ${r.netPay < 0 ? "neg" : "pos"}`}>
                        ₱ {money(r.netPay)}
                      </td>
                      <td className={`${r.netPay10 < 0 ? "neg" : "pos"}`}>₱ {money(r.netPay10)}</td>
                      <td className={`${r.netPay25 < 0 ? "neg" : "pos"}`}>₱ {money(r.netPay25)}</td>

                      <td style={{ position: "relative" }}>
                        <div
                          ref={menuOpenFor === r.id ? menuWrapRef : null}
                          style={{ display: "inline-block" }}
                        >
                          <button
                            type="button"
                            className="transpo-dots-btn"
                            onClick={() => setMenuOpenFor((p) => (p === r.id ? null : r.id))}
                            title="Actions"
                          >
                            <HiDotsVertical />
                          </button>

                          {menuOpenFor === r.id ? (
                            <div className="transpo-action-menu">
                              <button
                                type="button"
                                className="transpo-action-item"
                                onClick={() => openManualEdit(r)}
                              >
                                Edit manually
                              </button>

                              {hasOverride ? (
                                <button
                                  type="button"
                                  className="transpo-action-item danger"
                                  onClick={() => {
                                    setMenuOpenFor(null);
                                    const ok = window.confirm(
                                      "Remove manual override and revert to normal?"
                                    );
                                    if (ok) clearOverrideForStaff(r.id);
                                  }}
                                >
                                  Remove manual edit
                                </button>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}

              {rows.length > 0 && (
                <tr className="totals-row">
                  <td colSpan={5} className="totals-label">
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
                  <td className="td-strong">₱ {money(totals.totalDeduction)}</td>

                  <td className="td-strong">₱ {money(totals.netPay)}</td>
                  <td className="td-strong">₱ {money(totals.netPay10)}</td>
                  <td className="td-strong">₱ {money(totals.netPay25)}</td>

                  <td />
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="transpo-hint">Tip: scroll horizontally to view all columns.</div>
      </div>

      {editModalStaff ? (
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
                  Note: Values start at <b>0</b>. This is a temporary override and will
                  revert automatically.
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
    </div>
  );
}