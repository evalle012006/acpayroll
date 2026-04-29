import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/PromotionOrder.css";
import api from "../api/axiosClient";

const toNum = (v) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const toStr = (v) => String(v ?? "").trim();
const norm = (v) => toStr(v).toLowerCase();

const readUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
};

const fmtDate = (d) => (d ? String(d).slice(0, 10) : "-");

const STAGE_LABELS = {
  "area manager": "Area Manager",
  "regional manager": "Regional Manager",
  "assistant vice president": "Assistant Vice President",
  "vice president": "Vice President",
  tread: "Tread",
  final: "Admin / HR / Finance",
};

const getPromotionChain = (oldPosition) => {
  const r = norm(oldPosition);

  if (r === "area manager") {
    return ["regional manager", "assistant vice president", "vice president", "tread", "final"];
  }

  if (r === "regional manager") {
    return ["assistant vice president", "vice president", "tread", "final"];
  }

  if (r === "assistant vice president") {
    return ["vice president", "tread", "final"];
  }

  if (r === "vice president" || r === "senior vice president" || r === "president") {
    return ["tread", "final"];
  }

  return ["area manager", "regional manager", "assistant vice president", "vice president", "tread", "final"];
};

const getStageStatus = (o, stage) => {
  const map = {
    "area manager": o.area_manager_status,
    "regional manager": o.regional_manager_status,
    "assistant vice president": o.assistant_vice_president_status,
    "vice president": o.vice_president_status,
    tread: o.tread_status,
    final: o.final_status,
  };

  return map[stage] || "Pending";
};

const renderChainSummary = (o) => {
  return getPromotionChain(o.old_position)
    .map((stage) => `${STAGE_LABELS[stage]}: ${getStageStatus(o, stage)}`)
    .join(" | ");
};

export default function PromotionOrder() {
  const navigate = useNavigate();
  const user = useMemo(() => readUser(), []);
  const role = norm(user?.role);

  const isAdmin = role === "admin";
  const isHr = role === "hr";
  const isAccounting = role === "accounting";
  const isTread = role === "tread";
  const isBranchManager = role === "branch manager";
  const isAreaManager = role === "area manager";
  const isRegionalManager = role === "regional manager";
  const isAssistantVicePresident = role === "assistant vice president";
  const isVicePresident = role === "vice president";
  const isSeniorVicePresident = role === "senior vice president";
  const isPresident = role === "president";

  const canCreatePromotion =
    isAdmin ||
    isHr ||
    isAccounting ||
    isBranchManager ||
    isAreaManager ||
    isRegionalManager ||
    isAssistantVicePresident ||
    isVicePresident ||
    isSeniorVicePresident ||
    isPresident;

  const canApproveStage = (o) => {
    if (!o || norm(o.status) !== "pending") return false;

    const stage = norm(o.approval_stage);

    if (stage === "area manager") return isAreaManager;
    if (stage === "regional manager") return isRegionalManager;
    if (stage === "assistant vice president") return isAssistantVicePresident;
    if (stage === "vice president") return isVicePresident;
    if (stage === "tread") return isTread;
    if (stage === "final") return isAdmin || isHr || isAccounting;

    return false;
  };

  const canUploadApprovedFile = (o) =>
    (isAdmin || isHr || isAccounting) && norm(o?.status) === "approved";

  const canDownloadFile = true;

  const [staff, setStaff] = useState([]);
  const [branches, setBranches] = useState([]);
  const [orders, setOrders] = useState([]);
  const [positionRates, setPositionRates] = useState([]);

  const [loadingStaff, setLoadingStaff] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingRates, setLoadingRates] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingId, setUploadingId] = useState("");

  const [showCreate, setShowCreate] = useState(false);

  const [form, setForm] = useState({
    employee_id: "",
    employee_name: "",
    old_position: "",
    new_position: "",
    old_salary: "",
    new_salary: "",
    old_ecola: "",
    new_ecola: "",
    effective_date: "",
    remarks: "",
    prev_branch_id: "",
    prev_branch_code: "",
    prev_branch_name: "",
    present_branch_id: "",
    present_branch_code: "",
    present_branch_name: "",
  });

  const [employeeSearch, setEmployeeSearch] = useState("");
  const [employeeQuery, setEmployeeQuery] = useState("");
  const [showEmployeeResults, setShowEmployeeResults] = useState(false);
  const [attachmentFile, setAttachmentFile] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  const [branchSearch, setBranchSearch] = useState("");
  const [showBranchResults, setShowBranchResults] = useState(false);

  const employeePickerRef = useRef(null);
  const branchPickerRef = useRef(null);

  const branchMap = useMemo(() => {
    const m = new Map();
    branches.forEach((b) => m.set(Number(b.id), b));
    return m;
  }, [branches]);

  const rateMap = useMemo(() => {
    const m = new Map();
    positionRates.forEach((r) => {
      const key = norm(r.position);
      if (key) m.set(key, r);
    });
    return m;
  }, [positionRates]);

  const positionOptions = useMemo(() => {
    const seen = new Set();

    return positionRates
      .filter((r) => {
        const key = norm(r.position);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => toStr(a.position).localeCompare(toStr(b.position)));
  }, [positionRates]);

  const filteredStaff = useMemo(() => {
    const q = norm(employeeQuery);
    const list = !q
      ? staff
      : staff.filter((s) => {
          const hay = [
            s.id,
            s.employee_no,
            s.fullname,
            s.first_name,
            s.last_name,
            s.middle_name,
            s.position,
            s.area,
            s.region,
            s.division,
          ]
            .map(norm)
            .join(" ");

          return hay.includes(q);
        });

    return list.slice(0, 50);
  }, [staff, employeeQuery]);

  const filteredBranches = useMemo(() => {
    const q = norm(branchSearch);

    const list = !q
      ? branches
      : branches.filter((b) => {
          const hay = [
            b.id,
            b.code,
            b.name,
            b.area,
            b.region,
            b.division,
          ]
            .map(norm)
            .join(" ");

          return hay.includes(q);
        });

    return list.sort((a, b) =>
      `${a.code || ""} ${a.name || ""}`.localeCompare(
        `${b.code || ""} ${b.name || ""}`
      )
    );
  }, [branches, branchSearch]);

  const closeModal = () => {
    setShowCreate(false);
    setForm({
      employee_id: "",
      employee_name: "",
      old_position: "",
      new_position: "",
      old_salary: "",
      new_salary: "",
      old_ecola: "",
      new_ecola: "",
      effective_date: "",
      remarks: "",
      prev_branch_id: "",
      prev_branch_code: "",
      prev_branch_name: "",
      present_branch_id: "",
      present_branch_code: "",
      present_branch_name: "",
    });
    setEmployeeSearch("");
    setEmployeeQuery("");
    setBranchSearch("");
    setSelectedEmployee(null);
    setShowEmployeeResults(false);
    setShowBranchResults(false);
    setAttachmentFile(null);
  };

  const loadStaff = useCallback(async () => {
    try {
      setLoadingStaff(true);
      const res = await api.get("/staff");
      setStaff(Array.isArray(res.data) ? res.data : []);
    } catch {
      setStaff([]);
    } finally {
      setLoadingStaff(false);
    }
  }, []);

  const loadBranches = useCallback(async () => {
    try {
      setLoadingBranches(true);

      const res = await api.get("/branches-all");

      setBranches(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to load all branches:", err?.response?.data || err.message);
      setBranches([]);
    } finally {
      setLoadingBranches(false);
    }
  }, []);

  const loadOrders = useCallback(async () => {
    try {
      setLoadingOrders(true);
      const res = await api.get("/promotion-orders");
      setOrders(Array.isArray(res.data) ? res.data : []);
    } catch {
      setOrders([]);
    } finally {
      setLoadingOrders(false);
    }
  }, []);

  const loadRates = useCallback(async () => {
    try {
      setLoadingRates(true);
      const res = await api.get("/comp-rates");
      setPositionRates(Array.isArray(res.data) ? res.data : []);
    } catch {
      setPositionRates([]);
    } finally {
      setLoadingRates(false);
    }
  }, []);

  useEffect(() => {
    loadStaff();
    loadBranches();
    loadOrders();
    loadRates();
  }, [loadStaff, loadBranches, loadOrders, loadRates]);

  useEffect(() => {
    if (!showCreate) return;

    const onKey = (e) => e.key === "Escape" && closeModal();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [showCreate]);

  useEffect(() => {
    const onMouseDown = (e) => {
      if (employeePickerRef.current && !employeePickerRef.current.contains(e.target)) {
        setShowEmployeeResults(false);
      }

      if (branchPickerRef.current && !branchPickerRef.current.contains(e.target)) {
        setShowBranchResults(false);
      }
    };

    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  const onSelectEmployee = (employeeId) => {
    const s = staff.find((x) => String(x.id) === String(employeeId));
    if (!s) return;

    const prevBranchId = s?.branch_id ? Number(s.branch_id) : null;
    const prevBranch = prevBranchId ? branchMap.get(prevBranchId) : null;
    const idStr = String(s.id);

    setSelectedEmployee(s);

    setForm((p) => ({
      ...p,
      employee_id: idStr,
      employee_name: s?.fullname || "",
      old_position: s?.position || "",
      new_position: "",
      old_salary: String(toNum(s?.salary)),
      new_salary: "",
      old_ecola: String(toNum(s?.ecola)),
      new_ecola: "",
      prev_branch_id: prevBranchId ? String(prevBranchId) : "",
      prev_branch_code: prevBranch?.code || "",
      prev_branch_name: prevBranch?.name || "",
      present_branch_id: prevBranchId ? String(prevBranchId) : "",
      present_branch_code: prevBranch?.code || "",
      present_branch_name: prevBranch?.name || "",
    }));

    const label = `${s.employee_no ? `${s.employee_no} - ` : ""}${s.fullname || ""}`;
    setEmployeeSearch(label);
    setEmployeeQuery(label);

    const presentBranchLabel = prevBranch
      ? `${prevBranch.code || ""} - ${prevBranch.name || ""}`.trim()
      : "";

    setBranchSearch(presentBranchLabel);
    setShowEmployeeResults(false);
  };

  const onSelectPresentBranch = (branchId) => {
    const bid = branchId ? Number(branchId) : null;
    const b = bid ? branchMap.get(bid) : null;

    setForm((p) => ({
      ...p,
      present_branch_id: branchId ? String(branchId) : "",
      present_branch_code: b?.code || "",
      present_branch_name: b?.name || "",
    }));

    setBranchSearch(b ? `${b.code || ""} - ${b.name || ""}`.trim() : "");
    setShowBranchResults(false);
  };

  const onSelectNewPosition = (positionValue) => {
    const picked = toStr(positionValue);
    const rate = rateMap.get(norm(picked));

    setForm((p) => ({
      ...p,
      new_position: picked,
      new_salary: rate ? String(toNum(rate.salary)) : "",
      new_ecola: rate ? String(toNum(rate.ecola)) : "",
    }));
  };

  const createOrder = async (e) => {
    e.preventDefault();

    if (!selectedEmployee || !form.employee_id) return alert("Employee is required");
    if (!form.new_position.trim()) return alert("New position is required.");
    if (!form.effective_date.trim()) return alert("Effective date is required.");
    if (!form.present_branch_id.trim()) return alert("Present branch is required.");

    try {
      setSaving(true);

      const formData = new FormData();
      formData.append("employee_id", parseInt(String(selectedEmployee.id), 10));
      formData.append("employee_name", form.employee_name.trim());
      formData.append("old_position", form.old_position.trim());
      formData.append("new_position", form.new_position.trim());
      formData.append("old_salary", toNum(form.old_salary));
      formData.append("new_salary", toNum(form.new_salary));
      formData.append("old_ecola", toNum(form.old_ecola));
      formData.append("new_ecola", toNum(form.new_ecola));
      formData.append("effective_date", form.effective_date.slice(0, 10));
      formData.append("remarks", form.remarks.trim());

      formData.append("prev_branch_id", form.prev_branch_id ? Number(form.prev_branch_id) : "");
      formData.append("prev_branch_code", form.prev_branch_code);
      formData.append("prev_branch_name", form.prev_branch_name);
      formData.append("present_branch_id", form.present_branch_id ? Number(form.present_branch_id) : "");
      formData.append("present_branch_code", form.present_branch_code);
      formData.append("present_branch_name", form.present_branch_name);

      if (attachmentFile) {
        formData.append("attachment", attachmentFile);
      }

      await api.post("/promotion-orders", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      alert("Promotion order created and sent to approval chain.");
      closeModal();
      await loadOrders();
    } catch (err) {
      alert(err?.response?.data?.message || err.message || "Failed to create promotion order.");
    } finally {
      setSaving(false);
    }
  };

  const approve = async (id) => {
    try {
      await api.put(`/promotion-orders/${id}/approve`);
      await loadOrders();
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to approve.");
    }
  };

  const reject = async (id) => {
    const reason = prompt("Enter rejection reason:");
    if (!reason || !reason.trim()) return;

    try {
      await api.put(`/promotion-orders/${id}/reject`, { reason: reason.trim() });
      await loadOrders();
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to reject.");
    }
  };

  const downloadFile = async (id, type, fallbackName = "") => {
    try {
      const res = await api.get(`/promotion-orders/${id}/download/${type}`, {
        responseType: "blob",
      });

      const blob = new Blob([res.data]);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");

      a.href = url;
      a.download = fallbackName || `promotion-${id}-${type}`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to download file.");
    }
  };

  const uploadApprovedFile = async (orderId, file) => {
    if (!file) return;

    try {
      setUploadingId(String(orderId));

      const formData = new FormData();
      formData.append("attachment", file);

      await api.post(`/promotion-orders/${orderId}/approved-file`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      alert("Approved promotion file uploaded.");
      await loadOrders();
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to upload approved file.");
    } finally {
      setUploadingId("");
    }
  };

  const countText = useMemo(() => {
    const n = Array.isArray(orders) ? orders.length : 0;
    return `${n} Record${n === 1 ? "" : "s"}`;
  }, [orders]);

  const badgeClass = (status) => {
    const s = norm(status);
    if (s === "approved") return "po-badge po-approved";
    if (s === "rejected") return "po-badge po-rejected";
    return "po-badge po-pending";
  };

  const resolvePrevBranchText = (o) => {
    if (o.prev_branch_code || o.prev_branch_name) {
      return `${o.prev_branch_code || ""} - ${o.prev_branch_name || ""}`.trim();
    }

    const b = o.prev_branch_id ? branchMap.get(Number(o.prev_branch_id)) : null;
    return b ? `${b.code || ""} - ${b.name || ""}`.trim() : "-";
  };

  const resolvePresentBranchText = (o) => {
    if (o.present_branch_code || o.present_branch_name) {
      return `${o.present_branch_code || ""} - ${o.present_branch_name || ""}`.trim();
    }

    const b = o.present_branch_id ? branchMap.get(Number(o.present_branch_id)) : null;
    return b ? `${b.code || ""} - ${b.name || ""}`.trim() : "-";
  };

  return (
    <div className="po-page">
      <div className="po-topbar">
        <div>
          <h2 className="po-title">Promotion Orders</h2>
          <p className="po-subtitle">Manage staff promotions and approval chain.</p>
        </div>

        <div className="po-actions">
          <button className="po-btn po-btn-ghost" type="button" onClick={() => navigate(-1)}>
            ← Back
          </button>

          <button className="po-btn po-btn-outline" type="button" onClick={loadOrders} disabled={loadingOrders}>
            {loadingOrders ? "Refreshing..." : "Refresh"}
          </button>

          {canCreatePromotion && (
            <button className="po-btn po-btn-primary" type="button" onClick={() => setShowCreate(true)}>
              + Create Promotion Order
            </button>
          )}
        </div>
      </div>

      <div className="po-card">
        <div className="po-card-head">
          <div className="po-card-title">Promotion Orders</div>
          <div className="po-card-meta">{countText}</div>
        </div>

        <div className="po-table-wrap">
          <table className="po-table">
            <thead>
              <tr>
                <th>ORDER NO</th>
                <th>EMPLOYEE</th>
                <th>PREVIOUS BRANCH</th>
                <th>PRESENT BRANCH</th>
                <th>OLD POSITION</th>
                <th>NEW POSITION</th>
                <th className="num">OLD SALARY</th>
                <th className="num">NEW SALARY</th>
                <th>EFFECTIVE</th>
                <th>STATUS</th>
                <th>CURRENT STAGE</th>
                <th>APPROVAL CHAIN</th>
                <th>FILES</th>
                <th style={{ width: 180 }}>ACTIONS</th>
              </tr>
            </thead>

            <tbody>
              {loadingOrders ? (
                <tr>
                  <td colSpan={14} className="po-empty">
                    Loading promotion orders…
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={14} className="po-empty">
                    No promotion orders found.
                  </td>
                </tr>
              ) : (
                orders.map((o) => {
                  const isPending = norm(o.status) === "pending";
                  const canAct = canApproveStage(o);

                  return (
                    <tr key={o.id}>
                      <td className="mono">{o.order_no || `PRO-${o.id}`}</td>
                      <td className="td-strong">{o.employee_name}</td>
                      <td>{resolvePrevBranchText(o)}</td>
                      <td>{resolvePresentBranchText(o)}</td>
                      <td>{o.old_position || "-"}</td>
                      <td>{o.new_position || "-"}</td>
                      <td className="num">{toNum(o.old_salary).toLocaleString()}</td>
                      <td className="num">{toNum(o.new_salary).toLocaleString()}</td>
                      <td>{fmtDate(o.effective_date)}</td>

                      <td>
                        <span className={badgeClass(o.status)}>{o.status || "Pending"}</span>
                      </td>

                      <td>{STAGE_LABELS[norm(o.approval_stage)] || "-"}</td>

                      <td style={{ fontSize: 12, lineHeight: 1.5 }}>
                        {renderChainSummary(o)}
                      </td>

                      <td>
                        <div className="po-row-actions">
                          {o.attachment_path && canDownloadFile ? (
                            <button
                              className="po-mini-btn"
                              type="button"
                              onClick={() => downloadFile(o.id, "request", o.attachment_name || "")}
                            >
                              Request File
                            </button>
                          ) : null}

                          {o.approved_attachment_path && canDownloadFile ? (
                            <button
                              className="po-mini-btn"
                              type="button"
                              onClick={() =>
                                downloadFile(o.id, "approved", o.approved_attachment_name || "")
                              }
                            >
                              Approved File
                            </button>
                          ) : null}

                          {canUploadApprovedFile(o) ? (
                            <label className="po-mini-btn" style={{ cursor: "pointer" }}>
                              {uploadingId === String(o.id) ? "Uploading..." : "Upload Approved"}
                              <input
                                type="file"
                                hidden
                                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                                onChange={(e) => uploadApprovedFile(o.id, e.target.files?.[0] || null)}
                              />
                            </label>
                          ) : null}
                        </div>
                      </td>

                      <td>
                        {canAct && isPending ? (
                          <div className="po-row-actions">
                            <button className="po-mini-btn po-approve" type="button" onClick={() => approve(o.id)}>
                              Approve
                            </button>

                            <button className="po-mini-btn po-reject" type="button" onClick={() => reject(o.id)}>
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="po-dash">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {canCreatePromotion && showCreate && (
        <div
          className="po-modal-overlay"
          onMouseDown={(e) => e.target.classList.contains("po-modal-overlay") && closeModal()}
        >
          <div className="po-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="po-modal-head">
              <div>
                <h3 className="po-modal-title">Create Promotion Order</h3>
                <p className="po-modal-sub">Order will follow approval chain based on the employee’s current position.</p>
              </div>

              <button className="po-x" type="button" onClick={closeModal}>
                ✕
              </button>
            </div>

            <form onSubmit={createOrder} className="po-form">
              <div className="po-grid">
                <div className="po-field" ref={employeePickerRef} style={{ position: "relative", overflow: "visible" }}>
                  <label>Employee</label>

                  <input
                    value={employeeSearch}
                    onChange={(e) => {
                      const value = e.target.value;
                      setEmployeeSearch(value);
                      setEmployeeQuery(value);
                      setShowEmployeeResults(true);
                      setSelectedEmployee(null);

                      setForm((p) => ({
                        ...p,
                        employee_id: "",
                        employee_name: "",
                        old_position: "",
                        new_position: "",
                        old_salary: "",
                        new_salary: "",
                        old_ecola: "",
                        new_ecola: "",
                        prev_branch_id: "",
                        prev_branch_code: "",
                        prev_branch_name: "",
                        present_branch_id: "",
                        present_branch_code: "",
                        present_branch_name: "",
                      }));

                      setBranchSearch("");
                    }}
                    onFocus={() => setShowEmployeeResults(true)}
                    placeholder="Search employee no or name..."
                  />

                  {showEmployeeResults && (
                    <div
                      style={{
                        position: "absolute",
                        top: "100%",
                        left: 0,
                        right: 0,
                        marginTop: 6,
                        maxHeight: 240,
                        overflowY: "auto",
                        background: "#0f1a2e",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 10,
                        zIndex: 9999,
                        boxShadow: "0 12px 30px rgba(0,0,0,0.35)",
                      }}
                    >
                      {loadingStaff ? (
                        <div style={{ padding: 12, color: "#9aa7bd" }}>Loading staff...</div>
                      ) : filteredStaff.length === 0 ? (
                        <div style={{ padding: 12, color: "#9aa7bd" }}>No employee found.</div>
                      ) : (
                        filteredStaff.map((s) => (
                          <div
                            key={s.id}
                            style={{
                              padding: "10px 12px",
                              cursor: "pointer",
                              borderBottom: "1px solid rgba(255,255,255,0.05)",
                              color: "#e7edf7",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = "#1e293b";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = "transparent";
                            }}
                            onClick={() => onSelectEmployee(s.id)}
                          >
                            {(s.employee_no ? `${s.employee_no} - ` : "") + (s.fullname || "-")}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                <div className="po-field">
                  <label>Effective Date</label>
                  <input
                    type="date"
                    value={form.effective_date}
                    onChange={(e) => setForm((p) => ({ ...p, effective_date: e.target.value }))}
                    required
                  />
                </div>

                <div className="po-field">
                  <label>Previous Branch</label>
                  <input
                    value={`${form.prev_branch_code || ""}${form.prev_branch_name ? ` - ${form.prev_branch_name}` : ""}`}
                    readOnly
                    placeholder="Auto-filled"
                  />
                </div>

                <div className="po-field" ref={branchPickerRef} style={{ position: "relative", overflow: "visible" }}>
                  <label>Present Branch</label>

                  <input
                    value={branchSearch}
                    onChange={(e) => {
                      const value = e.target.value;
                      setBranchSearch(value);
                      setShowBranchResults(true);

                      setForm((p) => ({
                        ...p,
                        present_branch_id: "",
                        present_branch_code: "",
                        present_branch_name: "",
                      }));
                    }}
                    onFocus={() => setShowBranchResults(true)}
                    placeholder={loadingBranches ? "Loading branches..." : "Search branch code or name..."}
                    required
                  />

                  {showBranchResults && (
                    <div
                      style={{
                        position: "absolute",
                        top: "100%",
                        left: 0,
                        right: 0,
                        marginTop: 6,
                        maxHeight: 240,
                        overflowY: "auto",
                        background: "#0f1a2e",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 10,
                        zIndex: 9999,
                        boxShadow: "0 12px 30px rgba(0,0,0,0.35)",
                      }}
                    >
                      {loadingBranches ? (
                        <div style={{ padding: 12, color: "#9aa7bd" }}>Loading branches...</div>
                      ) : filteredBranches.length === 0 ? (
                        <div style={{ padding: 12, color: "#9aa7bd" }}>No branch found.</div>
                      ) : (
                        filteredBranches.map((b) => (
                          <div
                            key={b.id}
                            style={{
                              padding: "10px 12px",
                              cursor: "pointer",
                              borderBottom: "1px solid rgba(255,255,255,0.05)",
                              color: "#e7edf7",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = "#1e293b";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = "transparent";
                            }}
                            onClick={() => onSelectPresentBranch(b.id)}
                          >
                            {`${b.code || ""} - ${b.name || ""}`.trim()}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                <div className="po-field">
                  <label>Previous Position</label>
                  <input value={form.old_position} readOnly placeholder="Auto-filled" />
                </div>

                <div className="po-field">
                  <label>New Position</label>
                  <select value={form.new_position} onChange={(e) => onSelectNewPosition(e.target.value)} required>
                    <option value="">{loadingRates ? "Loading positions..." : "Select New Position"}</option>
                    {positionOptions.map((r) => (
                      <option key={r.id || r.position} value={r.position}>
                        {r.position}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="po-field">
                  <label>Previous Salary</label>
                  <input value={form.old_salary} readOnly placeholder="Auto-filled" />
                </div>

                <div className="po-field">
                  <label>New Salary</label>
                  <input
                    type="number"
                    value={form.new_salary}
                    onChange={(e) => setForm((p) => ({ ...p, new_salary: e.target.value }))}
                    placeholder="Auto-filled from System Rates"
                  />
                </div>

                <div className="po-field">
                  <label>Previous Ecola</label>
                  <input value={form.old_ecola} readOnly placeholder="Auto-filled" />
                </div>

                <div className="po-field">
                  <label>New Ecola</label>
                  <input
                    type="number"
                    value={form.new_ecola}
                    onChange={(e) => setForm((p) => ({ ...p, new_ecola: e.target.value }))}
                    placeholder="Auto-filled from System Rates"
                  />
                </div>

                <div className="po-field full">
                  <label>Attach Request File</label>
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                    onChange={(e) => setAttachmentFile(e.target.files?.[0] || null)}
                  />
                </div>

                <div className="po-field full">
                  <label>Remarks</label>
                  <textarea
                    value={form.remarks}
                    onChange={(e) => setForm((p) => ({ ...p, remarks: e.target.value }))}
                    placeholder="Optional notes / reason"
                    rows={3}
                  />
                </div>
              </div>

              <div className="po-modal-actions">
                <button className="po-btn po-btn-ghost" type="button" onClick={closeModal}>
                  Cancel
                </button>

                <button className="po-btn po-btn-primary" type="submit" disabled={saving || !form.employee_id}>
                  {saving ? "Creating..." : "Create Order"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}