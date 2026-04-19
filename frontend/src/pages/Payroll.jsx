import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "../styles/Payroll.css";
import api from "../api/axiosClient";
import { HiDotsVertical } from "react-icons/hi";

const toNum = (v) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const toStr = (v) => String(v ?? "").trim();
const norm = (v) => toStr(v).toLowerCase();
const fmt = (n) => toNum(n).toLocaleString();
const fmtDate = (d) => (d ? String(d).split("T")[0] : "-");
const toDate10 = (v) => (v ? String(v).slice(0, 10) : "");

const monthlyFromWhole = (v) => {
  const n = toNum(v);
  if (n <= 0) return 0;
  return n / 12;
};

const isActiveStaff = (s) => norm(s.status || "Active") !== "inactive";

const readUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
};

const overrideKey = (branchKey) => `payroll_manual_overrides::branch_${branchKey}`;

const OVERRIDE_FIELDS = [
  "salary",
  "ecola",
  "hdmf_er",
  "sss_er",
  "ph_er",
  "hdmf_ee",
  "sss_ee",
  "ph_ee",
  "tax",
  "utility_charge",
  "cbu",
  "cashbond",
  "salary_advance",
  "motorcycle_loan",
  "special_advance",
  "cash_advance",
  "other_receivable",
  "pagibig_mpl",
  "staff_accounts_payable",
];

const LABELS = {
  salary: "Salary",
  ecola: "Ecola",
  hdmf_er: "HDMF ER",
  sss_er: "SSS ER",
  ph_er: "PhilHealth ER",
  hdmf_ee: "HDMF EE",
  sss_ee: "SSS EE",
  ph_ee: "PhilHealth EE",
  tax: "Tax",
  utility_charge: "Utility",
  cbu: "CBU",
  cashbond: "Cash Bond",
  salary_advance: "Salary Advance",
  motorcycle_loan: "Motorcycle Loan",
  special_advance: "Special Advance",
  cash_advance: "Cash Advance",
  other_receivable: "Other Receivable",
  pagibig_mpl: "Pag-IBIG MPL",
  staff_accounts_payable: "Staff A/P",
};

const splitPayroll = (netPay) => {
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

const overlapsCurrentMonth = (startDate, endDate) => {
  const start = toDate10(startDate);
  const end = toDate10(endDate);
  if (!start || !end) return false;

  const s = new Date(`${start}T00:00:00`);
  const e = new Date(`${end}T23:59:59`);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return false;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  return s <= monthEnd && e >= monthStart;
};

function Payroll() {
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

  const [staff, setStaff] = useState([]);
  const [branch, setBranch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [overrides, setOverrides] = useState({});
  const [menuOpenFor, setMenuOpenFor] = useState(null);
  const [scheduleBalances, setScheduleBalances] = useState({});
  const [approvedSuspensions, setApprovedSuspensions] = useState({});
  const [editModalStaff, setEditModalStaff] = useState(null);
  const [editUntil, setEditUntil] = useState("");
  const [editValues, setEditValues] = useState(() => {
    const obj = {};
    for (const k of OVERRIDE_FIELDS) obj[k] = 0;
    return obj;
  });

  const closeMenu = useCallback(() => setMenuOpenFor(null), []);
  const closeModal = useCallback(() => {
    setEditModalStaff(null);
    setEditUntil("");
    const obj = {};
    for (const k of OVERRIDE_FIELDS) obj[k] = 0;
    setEditValues(obj);
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(overrideKey(branchParam));
      const parsed = raw ? JSON.parse(raw) : {};
      setOverrides(parsed && typeof parsed === "object" ? parsed : {});
    } catch {
      setOverrides({});
    }
  }, [branchParam]);

  const persistOverrides = useCallback(
    (next) => {
      setOverrides(next);
      try {
        localStorage.setItem(overrideKey(branchParam), JSON.stringify(next));
      } catch {}
    },
    [branchParam]
  );

  useEffect(() => {
    if (!branchParam) return;

    const today = new Date();
    const isExpired = (until) => {
      if (!until) return true;
      const end = new Date(`${until}T23:59:59`);
      return end.getTime() < today.getTime();
    };

    const next = { ...overrides };
    let changed = false;

    Object.keys(next).forEach((staffId) => {
      if (isExpired(next[staffId]?.until)) {
        delete next[staffId];
        changed = true;
      }
    });

    if (changed) persistOverrides(next);
  }, [overrides, branchParam, persistOverrides]);

  useEffect(() => {
    const run = async () => {
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

        const filteredRaw =
          byBranchId.length > 0
            ? byBranchId
            : byBranchCode.length > 0
            ? byBranchCode
            : allStaff.filter((s) => norm(s.area) === norm(foundBranch.area));

        const filtered = filteredRaw.filter(isActiveStaff);

        setStaff(filtered);

        const suspensions = Array.isArray(suspensionRes.data) ? suspensionRes.data : [];
        const map = {};

        suspensions.forEach((row) => {
          if (norm(row.status) !== "approved") return;
          if (
            !overlapsCurrentMonth(
              row.start_date || row.suspension_start,
              row.end_date || row.suspension_end
            )
          ) {
            return;
          }

          const key = String(row.employee_id ?? "").trim();
          if (!key) return;

          if (!map[key]) {
            map[key] = {
              prorated_salary: 0,
              prorated_ecola: 0,
              days_of_suspension: 0,
            };
          }

          map[key].prorated_salary += toNum(row.prorated_salary);
          map[key].prorated_ecola += toNum(row.prorated_ecola);
          map[key].days_of_suspension += toNum(row.days_of_suspension);
        });

        setApprovedSuspensions(map);
      } catch (err) {
        const status = err?.response?.status;
        if (status === 401) setError("Session expired. Please login again.");
        else if (status === 403) setError("Access denied.");
        else setError(err?.response?.data?.message || err.message || "Failed to load payroll.");
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [branchParam]);

  useEffect(() => {
    const loadBalances = async () => {
      try {
        if (!branch) {
          setScheduleBalances({});
          return;
        }

        const month = new Date().toISOString().slice(0, 7);

        const res = await api.get("/schedule-balances/live", {
          params: { month, branchId: branch.id },
        });

        const rows = Array.isArray(res.data) ? res.data : [];
        const map = {};

        rows.forEach((r) => {
          if (r?.employee_id != null && String(r.employee_id).trim() !== "") {
            map[String(r.employee_id)] = r;
          }
          if (r?.staff_id != null && String(r.staff_id).trim() !== "") {
            map[String(r.staff_id)] = r;
          }
          if (r?.employee_no != null && String(r.employee_no).trim() !== "") {
            map[String(r.employee_no)] = r;
          }
        });

        setScheduleBalances(map);
      } catch (err) {
        console.error("Failed loading schedule balances", err);
        setScheduleBalances({});
      }
    };

    loadBalances();
  }, [branch]);

  const applyOverrideToStaffRow = useCallback(
    (s) => {
      const ov = overrides?.[String(s.id)];
      if (!ov?.until || !ov?.values) return s;

      const end = new Date(`${ov.until}T23:59:59`);
      if (end.getTime() < Date.now()) return s;

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

  const getBalanceForStaff = useCallback(
    (s) => {
      const keys = [String(s.id ?? ""), String(s.employee_no ?? ""), String(s.employee_id ?? "")]
        .map((x) => x.trim())
        .filter(Boolean);

      for (const k of keys) {
        if (scheduleBalances[k]) return scheduleBalances[k];
      }
      return {};
    },
    [scheduleBalances]
  );

  const computedRows = useMemo(() => {
    return (staff || []).map((raw) => {
      const s = applyOverrideToStaffRow(raw);
      const balance = getBalanceForStaff(s);

      const suspension = approvedSuspensions[String(s.id)] || {
        prorated_salary: 0,
        prorated_ecola: 0,
        days_of_suspension: 0,
      };

      const baseSalary = toNum(s.salary);
      const baseEcola = toNum(s.ecola);

      const suspensionSalary = toNum(suspension.prorated_salary);
      const suspensionEcola = toNum(suspension.prorated_ecola);

      const salary = Math.max(0, baseSalary - suspensionSalary);
      const ecola = Math.max(0, baseEcola - suspensionEcola);
      const totalComp = salary + ecola;

      const total_er = toNum(s.hdmf_er) + toNum(s.sss_er) + toNum(s.ph_er);
      const total_ee = toNum(s.hdmf_ee) + toNum(s.sss_ee) + toNum(s.ph_ee);

      const salary_advance =
        toNum(s.salary_advance) > 0 ? toNum(s.salary_advance) : monthlyFromWhole(balance.salary_advance);

      const motorcycle_loan =
        toNum(s.motorcycle_loan) > 0 ? toNum(s.motorcycle_loan) : monthlyFromWhole(balance.motorcycle_loan);

      const special_advance =
        toNum(s.special_advance) > 0 ? toNum(s.special_advance) : monthlyFromWhole(balance.special_advance);

      const cash_advance =
        toNum(s.cash_advance) > 0 ? toNum(s.cash_advance) : monthlyFromWhole(balance.cash_advance);

      const other_receivable =
        toNum(s.other_receivable) > 0 ? toNum(s.other_receivable) : toNum(balance.other_receivable);

      const staff_accounts_payable =
        toNum(s.staff_accounts_payable) > 0
          ? toNum(s.staff_accounts_payable)
          : monthlyFromWhole(balance.staff_accounts_payable);

      const total_deduction =
        total_ee +
        toNum(s.tax) +
        toNum(s.utility_charge) +
        toNum(s.cbu) +
        toNum(s.cashbond) +
        salary_advance +
        motorcycle_loan +
        special_advance +
        cash_advance +
        other_receivable +
        toNum(s.pagibig_mpl) +
        staff_accounts_payable;

      const netPay = totalComp - total_deduction;
      const { pay10, pay25 } = splitPayroll(netPay);

      return {
        ...s,
        original_salary: baseSalary,
        original_ecola: baseEcola,
        suspension_days: toNum(suspension.days_of_suspension),
        suspension_basic: suspensionSalary,
        suspension_ecola: suspensionEcola,
        salary,
        ecola,
        totalComp,
        total_er,
        total_ee,
        salary_advance,
        motorcycle_loan,
        special_advance,
        cash_advance,
        other_receivable,
        staff_accounts_payable,
        whole_salary_advance: toNum(balance.salary_advance),
        whole_motorcycle_loan: toNum(balance.motorcycle_loan),
        whole_special_advance: toNum(balance.special_advance),
        whole_cash_advance: toNum(balance.cash_advance),
        whole_other_receivable: toNum(balance.other_receivable),
        whole_staff_accounts_payable: toNum(balance.staff_accounts_payable),
        total_deduction,
        netPay,
        pay10,
        pay25,
      };
    });
  }, [staff, applyOverrideToStaffRow, getBalanceForStaff, approvedSuspensions]);

  const sumColumn = (key) => computedRows.reduce((sum, s) => sum + toNum(s[key]), 0);

  const menuWrapRef = useRef(null);
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

  const openManualEdit = (row) => {
    if (!canManualEdit) {
      alert("Only Admin, HR, and Accounting can edit manually.");
      return;
    }

    closeMenu();
    setEditModalStaff(row);

    const today = new Date().toISOString().slice(0, 10);
    setEditUntil(today);

    const obj = {};
    for (const k of OVERRIDE_FIELDS) obj[k] = 0;
    setEditValues(obj);
  };

  const saveManualEdit = () => {
    if (!canManualEdit) {
      alert("Only Admin, HR, and Accounting can edit manually.");
      return;
    }

    if (!editModalStaff?.id) return;

    const until = toDate10(editUntil);
    if (!until) return alert("Please set Effective date until.");

    const staffId = String(editModalStaff.id);
    const next = { ...(overrides || {}) };

    next[staffId] = {
      until,
      values: { ...editValues },
    };

    persistOverrides(next);
    closeModal();
    alert("Manual override saved.");
  };

  const clearOverrideForStaff = (staffId) => {
    if (!canManualEdit) {
      alert("Only Admin, HR, and Accounting can remove manual edits.");
      return;
    }

    const next = { ...(overrides || {}) };
    delete next[String(staffId)];
    persistOverrides(next);
  };

  if (loading) {
    return (
      <div className="payroll-page">
        <div className="payroll-card">
          <div className="payroll-loading">Loading payroll…</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="payroll-page">
        <div className="payroll-card">
          <div className="payroll-error">{error}</div>
          <button className="btn-secondary" onClick={() => navigate(-1)} type="button">
            Back
          </button>
        </div>
      </div>
    );
  }

  const printedAt = new Date().toLocaleString();
  const payrollMonth = new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
  });

  return (
    <div className="payroll-page">
      <div className="payroll-page-header no-print">
        <div>
          <h2 className="payroll-title">Payroll Report</h2>
          <p className="payroll-subtitle">
            {branch ? `${branch.code} • ${branch.name} • ${branch.area}` : ""}
          </p>
        </div>

        <div className="payroll-actions">
          <button className="btn-secondary" onClick={() => navigate(-1)} type="button">
            ← Back
          </button>
          <button className="btn-primary" onClick={() => window.print()} type="button">
            Print
          </button>
        </div>
      </div>

      <div className="payroll-card no-print">
        <div className="payroll-card-head">
          <div className="payroll-card-title">Salary and Wages</div>
          <div className="payroll-meta">
            Employees: <strong>{computedRows.length}</strong>
          </div>
        </div>

        <div className="payroll-table-wrap">
          <table className="payroll-table">
            <thead>
              <tr>
                <th rowSpan={2}>ID</th>
                <th rowSpan={2}>Employee No</th>
                <th rowSpan={2}>Full Name</th>
                <th rowSpan={2}>Position</th>
                <th rowSpan={2}>Date Regularized</th>
                <th colSpan={3}>EARNINGS</th>
                <th colSpan={4}>EMPLOYER (ER)</th>
                <th colSpan={4}>EMPLOYEE (EE)</th>
                <th colSpan={11}>DEDUCTIONS</th>
                <th rowSpan={2}>Total Deduction</th>
                <th rowSpan={2}>Net Pay</th>
                <th rowSpan={2}>10th</th>
                <th rowSpan={2}>25th</th>
                <th rowSpan={2}>Action</th>
              </tr>

              <tr>
                <th>Salary</th>
                <th>Ecola</th>
                <th>Total Comp</th>

                <th>HDMF</th>
                <th>SSS</th>
                <th>PH</th>
                <th>Total ER</th>

                <th>HDMF</th>
                <th>SSS</th>
                <th>PH</th>
                <th>Total EE</th>

                <th>Tax</th>
                <th>Utility</th>
                <th>CBU</th>
                <th>Cash Bond</th>
                <th>Salary Adv</th>
                <th>Motorcycle</th>
                <th>Special Adv</th>
                <th>Cash Adv</th>
                <th>Other Rec</th>
                <th>Pag-IBIG</th>
                <th>Staff A/P</th>
              </tr>
            </thead>

            <tbody>
              {computedRows.map((s) => {
                const hasOverride = !!overrides?.[String(s.id)];

                return (
                  <tr key={s.id}>
                    <td className="mono">{s.id}</td>
                    <td className="mono">{s.employee_no || "-"}</td>
                    <td className="td-strong">
                      {s.fullname}
                      {hasOverride ? (
                        <span style={{ marginLeft: 8, fontSize: 11, opacity: 0.9 }}>
                          (Manual until {overrides[String(s.id)]?.until})
                        </span>
                      ) : null}
                    </td>
                    <td>{s.position}</td>
                    <td>{fmtDate(s.regularization_date)}</td>

                    <td className="num">{fmt(s.salary)}</td>
                    <td className="num">{fmt(s.ecola)}</td>
                    <td className="num td-strong">{fmt(s.totalComp)}</td>

                    <td className="num">{fmt(s.hdmf_er)}</td>
                    <td className="num">{fmt(s.sss_er)}</td>
                    <td className="num">{fmt(s.ph_er)}</td>
                    <td className="num td-strong">{fmt(s.total_er)}</td>

                    <td className="num">{fmt(s.hdmf_ee)}</td>
                    <td className="num">{fmt(s.sss_ee)}</td>
                    <td className="num">{fmt(s.ph_ee)}</td>
                    <td className="num td-strong">{fmt(s.total_ee)}</td>

                    <td className="num">{fmt(s.tax)}</td>
                    <td className="num">{fmt(s.utility_charge)}</td>
                    <td className="num">{fmt(s.cbu)}</td>
                    <td className="num">{fmt(s.cashbond)}</td>
                    <td className="num">{fmt(s.salary_advance)}</td>
                    <td className="num">{fmt(s.motorcycle_loan)}</td>
                    <td className="num">{fmt(s.special_advance)}</td>
                    <td className="num">{fmt(s.cash_advance)}</td>
                    <td className="num">{fmt(s.other_receivable)}</td>
                    <td className="num">{fmt(s.pagibig_mpl)}</td>
                    <td className="num">{fmt(s.staff_accounts_payable)}</td>

                    <td className="num td-strong">{fmt(s.total_deduction)}</td>
                    <td className={`num td-strong ${s.netPay < 0 ? "neg" : "pos"}`}>{fmt(s.netPay)}</td>
                    <td className={`num td-strong ${s.pay10 < 0 ? "neg" : "pos"}`}>{fmt(s.pay10)}</td>
                    <td className={`num td-strong ${s.pay25 < 0 ? "neg" : "pos"}`}>{fmt(s.pay25)}</td>

                    <td style={{ position: "relative" }}>
                      <div
                        ref={menuOpenFor === s.id ? menuWrapRef : null}
                        style={{ display: "inline-block" }}
                      >
                        <button
                          type="button"
                          className="payroll-dots-btn"
                          onClick={() => setMenuOpenFor((p) => (p === s.id ? null : s.id))}
                          title="Actions"
                        >
                          <HiDotsVertical />
                        </button>

                        {menuOpenFor === s.id ? (
                          <div className="payroll-action-menu">
                            {canManualEdit ? (
                              <button
                                type="button"
                                className="payroll-action-item"
                                onClick={() => openManualEdit(s)}
                              >
                                Edit manually
                              </button>
                            ) : null}

                            {canManualEdit && overrides?.[String(s.id)] ? (
                              <button
                                type="button"
                                className="payroll-action-item danger"
                                onClick={() => {
                                  closeMenu();
                                  const ok = window.confirm(
                                    "Remove manual override and revert to normal?"
                                  );
                                  if (ok) clearOverrideForStaff(s.id);
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
              })}

              <tr className="totals-row">
                <td colSpan={5} className="totals-label">
                  Totals
                </td>

                <td className="num">{sumColumn("salary").toLocaleString()}</td>
                <td className="num">{sumColumn("ecola").toLocaleString()}</td>
                <td className="num td-strong">{sumColumn("totalComp").toLocaleString()}</td>

                <td className="num">{sumColumn("hdmf_er").toLocaleString()}</td>
                <td className="num">{sumColumn("sss_er").toLocaleString()}</td>
                <td className="num">{sumColumn("ph_er").toLocaleString()}</td>
                <td className="num td-strong">{sumColumn("total_er").toLocaleString()}</td>

                <td className="num">{sumColumn("hdmf_ee").toLocaleString()}</td>
                <td className="num">{sumColumn("sss_ee").toLocaleString()}</td>
                <td className="num">{sumColumn("ph_ee").toLocaleString()}</td>
                <td className="num td-strong">{sumColumn("total_ee").toLocaleString()}</td>

                <td className="num">{sumColumn("tax").toLocaleString()}</td>
                <td className="num">{sumColumn("utility_charge").toLocaleString()}</td>
                <td className="num">{sumColumn("cbu").toLocaleString()}</td>
                <td className="num">{sumColumn("cashbond").toLocaleString()}</td>
                <td className="num">{sumColumn("salary_advance").toLocaleString()}</td>
                <td className="num">{sumColumn("motorcycle_loan").toLocaleString()}</td>
                <td className="num">{sumColumn("special_advance").toLocaleString()}</td>
                <td className="num">{sumColumn("cash_advance").toLocaleString()}</td>
                <td className="num">{sumColumn("other_receivable").toLocaleString()}</td>
                <td className="num">{sumColumn("pagibig_mpl").toLocaleString()}</td>
                <td className="num">{sumColumn("staff_accounts_payable").toLocaleString()}</td>

                <td className="num td-strong">{sumColumn("total_deduction").toLocaleString()}</td>
                <td className="num td-strong">{sumColumn("netPay").toLocaleString()}</td>
                <td className="num td-strong">{sumColumn("pay10").toLocaleString()}</td>
                <td className="num td-strong">{sumColumn("pay25").toLocaleString()}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>

        <div className="payroll-hint">Tip: scroll horizontally to view all columns.</div>
      </div>

      {editModalStaff && canManualEdit ? (
        <div
          className="payroll-modal-overlay"
          onMouseDown={(e) =>
            e.target.classList.contains("payroll-modal-overlay") && closeModal()
          }
        >
          <div className="payroll-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="payroll-modal-head">
              <div>
                <div className="payroll-modal-title">Edit manually</div>
                <div className="payroll-modal-sub">
                  Employee: <b>{editModalStaff.fullname}</b> (ID:{" "}
                  <span className="mono">{editModalStaff.id}</span>)
                </div>
              </div>
            </div>

            <div className="payroll-modal-body">
              <div className="payroll-field">
                <label>Effective date until</label>
                <input
                  type="date"
                  value={editUntil}
                  onChange={(e) => setEditUntil(e.target.value)}
                />
              </div>

              <div className="payroll-grid-2">
                {OVERRIDE_FIELDS.map((k) => (
                  <div key={k} className="payroll-field">
                    <label>{LABELS[k] || k}</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editValues[k]}
                      onChange={(e) =>
                        setEditValues((p) => ({
                          ...p,
                          [k]: toNum(e.target.value),
                        }))
                      }
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="payroll-modal-actions">
              <button type="button" className="btn-secondary" onClick={closeModal}>
                Cancel
              </button>
              <button type="button" className="btn-primary" onClick={saveManualEdit}>
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="print-only">
        <div className="branch-payroll-print">
          <div className="branch-payroll-print__title">AmberCash PH Micro Lending Corp.</div>
          <div className="branch-payroll-print__subtitle">SALARIES AND WAGES</div>
          <div className="branch-payroll-print__branch">
            {branch ? `${branch.code} ${branch.name}` : "-"}
          </div>
          <div className="branch-payroll-print__period">{payrollMonth}</div>

          <div className="branch-payroll-print__meta">
            <div>
              <strong>AREA:</strong> {branch?.area || "-"}
            </div>
            <div>
              <strong>BRANCH:</strong> {branch ? `${branch.code} - ${branch.name}` : "-"}
            </div>
            <div>
              <strong>As of:</strong> {printedAt}
            </div>
          </div>

          <table className="branch-payroll-print-table">
            <thead>
              <tr>
                <th rowSpan={2}>#</th>
                <th rowSpan={2}>Family Name</th>
                <th rowSpan={2}>First/Given Name</th>
                <th rowSpan={2}>Middle Name</th>
                <th rowSpan={2}>ID No</th>
                <th rowSpan={2}>Position</th>
                <th rowSpan={2}>Date Regularized</th>

                <th colSpan={3}>SALARIES AND WAGES</th>
                <th colSpan={4}>EMPLOYER'S CONTRIBUTION</th>
                <th colSpan={4}>EMPLOYEE'S CONTRIBUTION</th>
                <th colSpan={11}>OTHER STAFF'S ADVANCES AND DEDUCTION</th>

                <th rowSpan={2}>Total Deductions</th>
                <th rowSpan={2}>Total Net Pay</th>
                <th rowSpan={2}>10th</th>
                <th rowSpan={2}>25th</th>
              </tr>
              <tr>
                <th>Salary</th>
                <th>Ecola</th>
                <th>Total</th>

                <th>HDMF</th>
                <th>SSS</th>
                <th>PH</th>
                <th>Total</th>

                <th>HDMF</th>
                <th>SSS</th>
                <th>PH</th>
                <th>Total</th>

                <th>Tax</th>
                <th>Utility</th>
                <th>CBU</th>
                <th>Cash Bond</th>
                <th>Salary Adv</th>
                <th>Motorcycle</th>
                <th>Special Adv</th>
                <th>Cash Adv</th>
                <th>Other Rec</th>
                <th>Pag-IBIG</th>
                <th>Staff A/P</th>
              </tr>
            </thead>

            <tbody>
              {computedRows.map((s, idx) => {
                const family = toStr(s.last_name);
                const first = toStr(s.first_name);
                const middle = toStr(s.middle_name);

                return (
                  <tr key={s.id}>
                    <td>{idx + 1}</td>
                    <td>{family || "-"}</td>
                    <td>{first || "-"}</td>
                    <td>{middle || "-"}</td>
                    <td>{s.employee_no || s.id}</td>
                    <td>{s.position || "-"}</td>
                    <td>{fmtDate(s.regularization_date)}</td>

                    <td>{fmt(s.salary)}</td>
                    <td>{fmt(s.ecola)}</td>
                    <td>{fmt(s.totalComp)}</td>

                    <td>{fmt(s.hdmf_er)}</td>
                    <td>{fmt(s.sss_er)}</td>
                    <td>{fmt(s.ph_er)}</td>
                    <td>{fmt(s.total_er)}</td>

                    <td>{fmt(s.hdmf_ee)}</td>
                    <td>{fmt(s.sss_ee)}</td>
                    <td>{fmt(s.ph_ee)}</td>
                    <td>{fmt(s.total_ee)}</td>

                    <td>{fmt(s.tax)}</td>
                    <td>{fmt(s.utility_charge)}</td>
                    <td>{fmt(s.cbu)}</td>
                    <td>{fmt(s.cashbond)}</td>
                    <td>{fmt(s.salary_advance)}</td>
                    <td>{fmt(s.motorcycle_loan)}</td>
                    <td>{fmt(s.special_advance)}</td>
                    <td>{fmt(s.cash_advance)}</td>
                    <td>{fmt(s.other_receivable)}</td>
                    <td>{fmt(s.pagibig_mpl)}</td>
                    <td>{fmt(s.staff_accounts_payable)}</td>

                    <td>{fmt(s.total_deduction)}</td>
                    <td>{fmt(s.netPay)}</td>
                    <td>{fmt(s.pay10)}</td>
                    <td>{fmt(s.pay25)}</td>
                  </tr>
                );
              })}

              <tr className="totals-row">
                <td colSpan={7}>TOTAL</td>
                <td>{fmt(sumColumn("salary"))}</td>
                <td>{fmt(sumColumn("ecola"))}</td>
                <td>{fmt(sumColumn("totalComp"))}</td>

                <td>{fmt(sumColumn("hdmf_er"))}</td>
                <td>{fmt(sumColumn("sss_er"))}</td>
                <td>{fmt(sumColumn("ph_er"))}</td>
                <td>{fmt(sumColumn("total_er"))}</td>

                <td>{fmt(sumColumn("hdmf_ee"))}</td>
                <td>{fmt(sumColumn("sss_ee"))}</td>
                <td>{fmt(sumColumn("ph_ee"))}</td>
                <td>{fmt(sumColumn("total_ee"))}</td>

                <td>{fmt(sumColumn("tax"))}</td>
                <td>{fmt(sumColumn("utility_charge"))}</td>
                <td>{fmt(sumColumn("cbu"))}</td>
                <td>{fmt(sumColumn("cashbond"))}</td>
                <td>{fmt(sumColumn("salary_advance"))}</td>
                <td>{fmt(sumColumn("motorcycle_loan"))}</td>
                <td>{fmt(sumColumn("special_advance"))}</td>
                <td>{fmt(sumColumn("cash_advance"))}</td>
                <td>{fmt(sumColumn("other_receivable"))}</td>
                <td>{fmt(sumColumn("pagibig_mpl"))}</td>
                <td>{fmt(sumColumn("staff_accounts_payable"))}</td>

                <td>{fmt(sumColumn("total_deduction"))}</td>
                <td>{fmt(sumColumn("netPay"))}</td>
                <td>{fmt(sumColumn("pay10"))}</td>
                <td>{fmt(sumColumn("pay25"))}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default Payroll;