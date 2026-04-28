import { useEffect, useMemo, useState } from "react";
import "../styles/Reports.css";
import api from "../api/axiosClient";

const norm = (v) => String(v || "").trim().toLowerCase();

const fmtDate = (v) => {
  if (!v) return "-";
  const s = String(v);
  return s.includes("T") ? s.split("T")[0] : s.slice(0, 10);
};

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const money = (v) =>
  `₱ ${toNum(v).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const getEmployeeName = (item) => {
  return (
    item?.employee_name ||
    item?.staff_name ||
    item?.fullname ||
    item?.full_name ||
    `${item?.first_name || ""} ${item?.last_name || ""}`.trim() ||
    "-"
  );
};

const isPendingLike = (status) => {
  const s = norm(status);
  return s === "pending" || s.includes("pending");
};

const isDoneLike = (status) => {
  const s = norm(status);
  return s === "approved" || s === "rejected" || s === "completed" || s === "done";
};

const getStatusClass = (status) => {
  const s = norm(status);
  if (s === "approved" || s === "completed" || s === "done") return "reports-status approved";
  if (s === "rejected") return "reports-status rejected";
  if (s.includes("pending")) return "reports-status pending";
  return "reports-status";
};

const requestDepartments = [
  "All",
  "HR",
  "Finance",
  "Accounting",
  "Operations",
];

const requestTypes = [
  "All",
  "Leave",
  "Loan",
  "SBF",
  "Reimbursement",
  "Regularization",
  "Suspension",
  "Exit Staff",
  "Resignation",
];

export default function Reports() {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [leaves, setLeaves] = useState([]);
  const [loans, setLoans] = useState([]);
  const [sbfOrders, setSbfOrders] = useState([]);
  const [reimbursements, setReimbursements] = useState([]);
  const [regularizations, setRegularizations] = useState([]);
  const [suspensions, setSuspensions] = useState([]);
  const [exitOrders, setExitOrders] = useState([]);
  const [resignations, setResignations] = useState([]);

  const [selectedDepartment, setSelectedDepartment] = useState("All");
  const [selectedType, setSelectedType] = useState("All");
  const [selectedStatus, setSelectedStatus] = useState("Pending");
  const [search, setSearch] = useState("");
  const [selectedRequest, setSelectedRequest] = useState(null);

  const safeGet = async (url) => {
    try {
      const res = await api.get(url);
      return Array.isArray(res.data) ? res.data : [];
    } catch (error) {
      console.warn(`Failed to fetch ${url}:`, error?.response?.data?.message || error.message);
      return [];
    }
  };

  const loadRequests = async () => {
    setLoading(true);
    setErr("");

    try {
      const [
        leaveData,
        loanData,
        sbfData,
        reimbursementData,
        regularizationData,
        suspensionData,
        exitData,
        resignationData,
      ] = await Promise.all([
        safeGet("/leave-requests"),
        safeGet("/loan-requests"),
        safeGet("/sbf-orders"),
        safeGet("/reimbursement-requests"),
        safeGet("/regularization-orders"),
        safeGet("/suspension-orders"),
        safeGet("/exit-staff-orders"),
        safeGet("/resignation-requests"),
      ]);

      setLeaves(leaveData);
      setLoans(loanData);
      setSbfOrders(sbfData);
      setReimbursements(reimbursementData);
      setRegularizations(regularizationData);
      setSuspensions(suspensionData);
      setExitOrders(exitData);
      setResignations(resignationData);
    } catch (error) {
      setErr(error?.response?.data?.message || "Failed to load requests.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  useEffect(() => {
    if (!selectedRequest) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") setSelectedRequest(null);
    };

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [selectedRequest]);

  const allRequests = useMemo(() => {
    const rows = [];

    leaves.forEach((item) => {
      rows.push({
        id: `leave-${item.id}`,
        rawId: item.id,
        type: "Leave",
        department: "HR",
        title: item.leave_type || "Leave Request",
        employeeNo: item.employee_no || "-",
        employeeName: getEmployeeName(item),
        date: item.date_created || item.created_at || item.entry_date,
        effectiveDate: item.start_date,
        endDate: item.end_date,
        status: item.status || "Pending",
        amount: null,
        remarks: item.reason || "",
        source: item,
      });
    });

    loans.forEach((item) => {
      rows.push({
        id: `loan-${item.id}`,
        rawId: item.id,
        type: "Loan",
        department: "Finance",
        title: item.loan_type || "Loan Request",
        employeeNo: item.employee_no || "-",
        employeeName: getEmployeeName(item),
        date: item.entry_date || item.created_at || item.approved_at,
        effectiveDate: item.disbursement_date,
        endDate: null,
        status: item.status || "Pending",
        amount: item.amount ?? item.total ?? null,
        remarks: item.reason || item.description || "",
        source: item,
      });
    });

    sbfOrders.forEach((item) => {
      rows.push({
        id: `sbf-${item.id}`,
        rawId: item.id,
        type: "SBF",
        department: "Finance",
        title: item.assistance_type || "SBF Order",
        employeeNo: item.employee_no || "-",
        employeeName: getEmployeeName(item),
        date: item.date_created || item.created_at,
        effectiveDate: item.effective_date,
        endDate: null,
        status: item.status || "Pending",
        amount: item.amount ?? null,
        remarks: item.remarks || item.reason || "",
        source: item,
      });
    });

    reimbursements.forEach((item) => {
      rows.push({
        id: `reimbursement-${item.id}`,
        rawId: item.id,
        type: "Reimbursement",
        department: "Finance",
        title: item.reimbursement_type || item.expense_type || "Reimbursement Request",
        employeeNo: item.employee_no || "-",
        employeeName: getEmployeeName(item),
        date: item.date_created || item.created_at || item.entry_date,
        effectiveDate: item.transaction_date,
        endDate: null,
        status: item.status || "Pending",
        amount: item.amount ?? item.total_amount ?? null,
        remarks: item.remarks || item.reason || item.description || "",
        source: item,
      });
    });

    regularizations.forEach((item) => {
      rows.push({
        id: `regularization-${item.id}`,
        rawId: item.id,
        type: "Regularization",
        department: "HR",
        title: item.order_no || "Regularization Order",
        employeeNo: item.employee_no || "-",
        employeeName: getEmployeeName(item),
        date: item.date_created || item.created_at,
        effectiveDate: item.effective_date,
        endDate: null,
        status: item.status || "Pending",
        amount: item.present_salary ?? null,
        remarks: item.remarks || "",
        source: item,
      });
    });

    suspensions.forEach((item) => {
      rows.push({
        id: `suspension-${item.id}`,
        rawId: item.id,
        type: "Suspension",
        department: "HR",
        title: item.suspension_type || "Suspension Order",
        employeeNo: item.employee_no || "-",
        employeeName: getEmployeeName(item),
        date: item.date_created || item.created_at,
        effectiveDate: item.start_date || item.suspension_start,
        endDate: item.end_date || item.suspension_end,
        status: item.status || "Pending",
        amount: item.total_deduction ?? null,
        remarks: item.reason || item.remarks || "",
        source: item,
      });
    });

    exitOrders.forEach((item) => {
      rows.push({
        id: `exit-${item.id}`,
        rawId: item.id,
        type: "Exit Staff",
        department: "HR",
        title: item.exit_type || item.order_no || "Exit Staff Order",
        employeeNo: item.employee_no || "-",
        employeeName: getEmployeeName(item),
        date: item.date_created || item.created_at,
        effectiveDate: item.effective_date,
        endDate: item.settlement_date,
        status: item.status || "Pending",
        amount: null,
        remarks: item.remarks || item.rejection_reason || "",
        source: item,
      });
    });

    resignations.forEach((item) => {
      rows.push({
        id: `resignation-${item.id}`,
        rawId: item.id,
        type: "Resignation",
        department: "HR",
        title: item.order_no || "Resignation Request",
        employeeNo: item.employee_no || "-",
        employeeName: getEmployeeName(item),
        date: item.date_created || item.created_at,
        effectiveDate: item.effective_date || item.resignation_date,
        endDate: null,
        status: item.status || "Pending",
        amount: null,
        remarks: item.remarks || item.reason || "",
        source: item,
      });
    });

    rows.sort((a, b) => {
      const ap = isPendingLike(a.status) ? 1 : 0;
      const bp = isPendingLike(b.status) ? 1 : 0;
      if (ap !== bp) return bp - ap;

      const ad = a.date ? new Date(a.date).getTime() : 0;
      const bd = b.date ? new Date(b.date).getTime() : 0;
      return bd - ad;
    });

    return rows;
  }, [
    leaves,
    loans,
    sbfOrders,
    reimbursements,
    regularizations,
    suspensions,
    exitOrders,
    resignations,
  ]);

  const summary = useMemo(() => {
    const pending = allRequests.filter((x) => isPendingLike(x.status)).length;
    const completed = allRequests.filter((x) => isDoneLike(x.status)).length;
    const hr = allRequests.filter((x) => x.department === "HR" && isPendingLike(x.status)).length;
    const finance = allRequests.filter((x) => x.department === "Finance" && isPendingLike(x.status)).length;
    const accounting = allRequests.filter((x) => x.department === "Accounting" && isPendingLike(x.status)).length;

    return {
      total: allRequests.length,
      pending,
      completed,
      hr,
      finance,
      accounting,
    };
  }, [allRequests]);

  const filteredRequests = useMemo(() => {
    const q = norm(search);

    return allRequests.filter((item) => {
      const statusOk =
        selectedStatus === "All"
          ? true
          : selectedStatus === "Pending"
          ? isPendingLike(item.status)
          : norm(item.status) === norm(selectedStatus);

      const departmentOk =
        selectedDepartment === "All" ? true : item.department === selectedDepartment;

      const typeOk = selectedType === "All" ? true : item.type === selectedType;

      const searchOk =
        !q ||
        [
          item.type,
          item.department,
          item.title,
          item.employeeNo,
          item.employeeName,
          item.status,
          item.remarks,
        ]
          .map((x) => norm(x))
          .join(" ")
          .includes(q);

      return statusOk && departmentOk && typeOk && searchOk;
    });
  }, [allRequests, selectedDepartment, selectedType, selectedStatus, search]);

  const copyFollowUpText = async (item) => {
    const message = `Follow up request

Department: ${item.department}
Request Type: ${item.type}
Reference: ${item.rawId}
Employee: ${item.employeeName}
Employee No: ${item.employeeNo}
Status: ${item.status}
Date Filed: ${fmtDate(item.date)}
Effective Date: ${fmtDate(item.effectiveDate)}
Remarks: ${item.remarks || "-"}`;

    try {
      await navigator.clipboard.writeText(message);
      alert("Follow-up message copied.");
    } catch {
      window.prompt("Copy this follow-up message:", message);
    }
  };

  const getRequestRoute = (item) => {
    switch (item.type) {
      case "Leave":
        return "/transactions/leave";

      case "Loan":
        return "/transactions";

      case "SBF":
        return "/transactions/sbf";

      case "Reimbursement":
        return "/transactions";

      case "Regularization":
        return "/transactions/regularization";

      case "Suspension":
        return "/transactions/suspension";

      case "Exit Staff":
        return "/transactions/exit";

      case "Resignation":
        return "/transactions/resignation";

      default:
        return "";
    }
  };

  const openSourcePage = (item) => {
    const route = getRequestRoute(item);
    if (!route) return alert("No page route configured for this request.");
    window.location.href = route;
  };

  return (
    <div className="reports-page">
      <div className="reports-topbar">
        <div>
          <h2 className="reports-title">Requests / Follow Up</h2>
          <p className="reports-subtitle">
            Track pending requests and follow up with HR, Finance, Accounting, or Operations.
          </p>
        </div>

        <button className="reports-btn" type="button" onClick={loadRequests} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {err ? (
        <div className="reports-card" style={{ color: "#ef4444", fontWeight: 800 }}>
          {err}
        </div>
      ) : null}

      <div className="reports-grid">
        <button
          type="button"
          className="reports-stat clickable"
          onClick={() => {
            setSelectedDepartment("All");
            setSelectedStatus("All");
          }}
        >
          <div className="reports-stat-label">All Requests</div>
          <div className="reports-stat-value">{summary.total}</div>
          <div className="reports-stat-sub">All departments and statuses</div>
        </button>

        <button
          type="button"
          className="reports-stat clickable"
          onClick={() => {
            setSelectedDepartment("All");
            setSelectedStatus("Pending");
          }}
        >
          <div className="reports-stat-head">
            <div className="reports-stat-label">Pending Follow Ups</div>
            {summary.pending > 0 && <span className="reports-badge">{summary.pending}</span>}
          </div>
          <div className="reports-stat-value">{summary.pending}</div>
          <div className="reports-stat-sub">Needs action or follow up</div>
        </button>

        <button
          type="button"
          className="reports-stat clickable"
          onClick={() => {
            setSelectedDepartment("HR");
            setSelectedStatus("Pending");
          }}
        >
          <div className="reports-stat-head">
            <div className="reports-stat-label">HR Pending</div>
            {summary.hr > 0 && <span className="reports-badge">{summary.hr}</span>}
          </div>
          <div className="reports-stat-value">{summary.hr}</div>
          <div className="reports-stat-sub">Leave, regularization, suspension, exit</div>
        </button>

        <button
          type="button"
          className="reports-stat clickable"
          onClick={() => {
            setSelectedDepartment("Finance");
            setSelectedStatus("Pending");
          }}
        >
          <div className="reports-stat-head">
            <div className="reports-stat-label">Finance Pending</div>
            {summary.finance > 0 && <span className="reports-badge">{summary.finance}</span>}
          </div>
          <div className="reports-stat-value">{summary.finance}</div>
          <div className="reports-stat-sub">Loans, SBF, reimbursement</div>
        </button>
      </div>

      <div className="reports-card">
        <div className="reports-toolbar" style={{ marginBottom: 14 }}>
          <input
            className="reports-input"
            placeholder="Search employee, request type, status, remarks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            className="reports-input"
            value={selectedDepartment}
            onChange={(e) => setSelectedDepartment(e.target.value)}
          >
            {requestDepartments.map((d) => (
              <option key={d} value={d}>
                {d === "All" ? "All Departments" : d}
              </option>
            ))}
          </select>

          <select
            className="reports-input"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
          >
            {requestTypes.map((t) => (
              <option key={t} value={t}>
                {t === "All" ? "All Request Types" : t}
              </option>
            ))}
          </select>

          <select
            className="reports-input"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
          >
            <option value="Pending">Pending Only</option>
            <option value="All">All Statuses</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>

        <div className="reports-table-wrap">
          <table className="reports-table">
            <thead>
              <tr>
                <th>Department</th>
                <th>Request Type</th>
                <th>Employee</th>
                <th>Date Filed</th>
                <th>Effective</th>
                <th>Amount</th>
                <th>Status</th>
                <th style={{ width: 280 }}>Follow Up</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" className="reports-empty-cell">
                    Loading requests...
                  </td>
                </tr>
              ) : filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan="8" className="reports-empty-cell">
                    No requests found.
                  </td>
                </tr>
              ) : (
                filteredRequests.map((item) => (
                  <tr key={item.id}>
                    <td>{item.department}</td>
                    <td>
                      <strong>{item.type}</strong>
                      <div style={{ opacity: 0.75, fontSize: 12, marginTop: 4 }}>
                        {item.title}
                      </div>
                    </td>
                    <td>
                      <strong>{item.employeeName}</strong>
                      <div style={{ opacity: 0.75, fontSize: 12, marginTop: 4 }}>
                        {item.employeeNo}
                      </div>
                    </td>
                    <td>{fmtDate(item.date)}</td>
                    <td>
                      {fmtDate(item.effectiveDate)}
                      {item.endDate ? ` → ${fmtDate(item.endDate)}` : ""}
                    </td>
                    <td>{item.amount == null ? "-" : money(item.amount)}</td>
                    <td>
                      <span className={getStatusClass(item.status)}>
                        {item.status || "Pending"}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          className="reports-btn"
                          type="button"
                          onClick={() => setSelectedRequest(item)}
                        >
                          View
                        </button>

                        <button
                          className="reports-btn"
                          type="button"
                          onClick={() => copyFollowUpText(item)}
                        >
                          Copy Follow Up
                        </button>

                        <button
                          className="reports-btn"
                          type="button"
                          onClick={() => openSourcePage(item)}
                        >
                          Open
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

      {selectedRequest && (
        <div className="reports-modal-overlay" onMouseDown={() => setSelectedRequest(null)}>
          <div className="reports-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="reports-modal-header">
              <h3 className="reports-modal-title">Request Follow Up</h3>

              <button
                className="reports-modal-close"
                type="button"
                onClick={() => setSelectedRequest(null)}
              >
                ✕
              </button>
            </div>

            <div className="reports-modal-body">
              <table className="reports-table">
                <tbody>
                  <tr>
                    <th>Department</th>
                    <td>{selectedRequest.department}</td>
                  </tr>
                  <tr>
                    <th>Request Type</th>
                    <td>{selectedRequest.type}</td>
                  </tr>
                  <tr>
                    <th>Reference</th>
                    <td>{selectedRequest.rawId}</td>
                  </tr>
                  <tr>
                    <th>Employee</th>
                    <td>{selectedRequest.employeeName}</td>
                  </tr>
                  <tr>
                    <th>Employee No</th>
                    <td>{selectedRequest.employeeNo}</td>
                  </tr>
                  <tr>
                    <th>Date Filed</th>
                    <td>{fmtDate(selectedRequest.date)}</td>
                  </tr>
                  <tr>
                    <th>Effective Date</th>
                    <td>{fmtDate(selectedRequest.effectiveDate)}</td>
                  </tr>
                  <tr>
                    <th>Status</th>
                    <td>{selectedRequest.status}</td>
                  </tr>
                  <tr>
                    <th>Remarks</th>
                    <td>{selectedRequest.remarks || "-"}</td>
                  </tr>
                </tbody>
              </table>

              <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
                <button
                  className="reports-btn"
                  type="button"
                  onClick={() => copyFollowUpText(selectedRequest)}
                >
                  Copy Follow-Up Message
                </button>

                <button
                  className="reports-btn"
                  type="button"
                  onClick={() => openSourcePage(selectedRequest)}
                >
                  Open Request Page
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
