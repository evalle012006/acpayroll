import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/Soa.css";
import api from "../api/axiosClient";

const toStr = (v) => String(v ?? "").trim();

const toNum = (v) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const fmtDate = (d) => (d ? String(d).split("T")[0] : "-");

export default function Soa() {
  const navigate = useNavigate();

  const staffBoxRef = useRef(null);
  const branchBoxRef = useRef(null);

  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  }, []);

  const role = String(user?.role || "").trim().toLowerCase();

  const department = String(
    user?.department ||
    user?.department_name ||
    user?.user_department ||
    user?.departmentName ||
    user?.dept ||
    ""
  ).trim().toLowerCase();

  const isAccountingDepartment = department.includes("accounting");
  const isHrDepartment = department.includes("hr");

  const isAdmin = role === "admin";
  const isIt = role === "it";
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
  
  const isActingBranchManager = role === "acting branch manager";
  const isActingAreaManager = role === "acting area manager";
  const isActingRegionalManager = role === "acting regional manager";

  const isITDepartment = department === "it department";
  const isITDepartmentManager =
    isITDepartment &&
    (
      isBranchManager ||
      isActingBranchManager ||
      isAreaManager ||
      isActingAreaManager ||
      isRegionalManager ||
      isActingRegionalManager ||
      isAssistantVicePresident ||
      isVicePresident ||
      isSeniorVicePresident
    );

  const canEdit =
    isAdmin ||
    isIt ||
    isHr ||
    isAccounting ||
    isITDepartmentManager ||
    isAccountingDepartment;

  const canView =
    isAdmin ||
    isIt ||
    isHr ||
    isAccounting ||
    isTread ||
    isBranchManager ||
    isAreaManager ||
    isRegionalManager ||
    isAssistantVicePresident ||
    isVicePresident ||
    isSeniorVicePresident ||
    isITDepartmentManager ||
    isPresident;

  const canCreate =
    isAdmin ||
    isIt ||
    isHr ||
    isAccounting ||
    isTread ||
    isAccountingDepartment ||
    isITDepartmentManager ||
    isHrDepartment;

  const canDelete = 
    isAdmin || 
    isITDepartmentManager ||
    isIt;

  const [staffList, setStaffList] = useState([]);
  const [branches, setBranches] = useState([]);
  const [settlements, setSettlements] = useState([]);

  const [loadingList, setLoadingList] = useState(false);
  const [saving, setSaving] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [viewRow, setViewRow] = useState(null);
  const [editingRow, setEditingRow] = useState(null);

  const [staffSearch, setStaffSearch] = useState("");
  const [branchSearch, setBranchSearch] = useState("");

  const [showStaffDropdown, setShowStaffDropdown] = useState(false);
  const [showBranchDropdown, setShowBranchDropdown] = useState(false);

  const [attachmentFile, setAttachmentFile] = useState(null);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [form, setForm] = useState({
    staff_id: "",
    prev_branch: "",
    employee_no: "",
    employee_name: "",

    settlement_branch_id: "",
    settlement_branch_code: "",
    settlement_branch_name: "",

    cbu: "",
    cashbond: "",
    utility: "",
    liabilities: "",
    thirteenth_month_pay: "",
    last_pay: "",

    separation_pay: "",
    cash_assistance: "",
    description: "",
  });

  const branchMap = useMemo(() => {
    const m = new Map();
    (branches || []).forEach((b) => m.set(Number(b.id), b));
    return m;
  }, [branches]);

  const filteredStaff = useMemo(() => {
    const q = staffSearch.toLowerCase();

    const list = !q
      ? staffList
      : staffList.filter((s) => {
          const hay = [
            s.id,
            s.employee_no,
            s.fullname,
            s.first_name,
            s.last_name,
            s.middle_name,
            s.position,
            s.branch_name,
            s.branch_code,
            s.area,
            s.region,
            s.division,
          ]
            .map((x) => toStr(x).toLowerCase())
            .join(" ");

          return hay.includes(q);
        });

    return list.slice(0, 50);
  }, [staffSearch, staffList]);

  const filteredBranches = useMemo(() => {
    const q = branchSearch.toLowerCase();

    const list = !q
      ? branches
      : branches.filter((b) => {
          const hay = [b.id, b.code, b.name, b.area, b.region, b.division]
            .map((x) => toStr(x).toLowerCase())
            .join(" ");

          return hay.includes(q);
        });

    return list.sort((a, b) =>
      `${a.code || ""} ${a.name || ""}`.localeCompare(
        `${b.code || ""} ${b.name || ""}`
      )
    );
  }, [branchSearch, branches]);

  const filteredSettlements = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return settlements;

    return settlements.filter((r) =>
      [
        r.id,
        r.employee_no,
        r.employee_name,
        r.prev_branch,
        r.settlement_branch_code,
        r.settlement_branch_name,
        r.total_benefits,
        r.liabilities,
        r.net_settlement,
        r.description,
        r.created_at,
      ]
        .map((x) => toStr(x).toLowerCase())
        .join(" ")
        .includes(q)
    );
  }, [settlements, search]);

  const totalPages = Math.max(1, Math.ceil(filteredSettlements.length / pageSize));

  const pagedSettlements = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredSettlements.slice(start, start + pageSize);
  }, [filteredSettlements, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [search, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const loadStaff = useCallback(async () => {
    try {
      const res = await api.get("/staff");
      setStaffList(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to load staff:", err?.response?.data || err.message);
      setStaffList([]);
    }
  }, []);

  const loadBranches = useCallback(async () => {
    try {
      const res = await api.get("/branches-all");
      setBranches(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to load branches:", err?.response?.data || err.message);
      setBranches([]);
    }
  }, []);

  const loadSettlements = useCallback(async () => {
    try {
      setLoadingList(true);
      const res = await api.get("/settlements");
      setSettlements(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to load settlements:", err?.response?.data || err.message);
      setSettlements([]);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    if (!canView) return;

    loadStaff();
    loadBranches();
    loadSettlements();
  }, [canView, loadStaff, loadBranches, loadSettlements]);

  useEffect(() => {
    if (!showCreate) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        closeCreateModal();
      }
    };

    const onMouseDown = (e) => {
      if (staffBoxRef.current && !staffBoxRef.current.contains(e.target)) {
        setShowStaffDropdown(false);
      }

      if (branchBoxRef.current && !branchBoxRef.current.contains(e.target)) {
        setShowBranchDropdown(false);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onMouseDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onMouseDown);
      document.body.style.overflow = "";
    };
  }, [showCreate]);

  const resetForm = () => {
    setForm({
      staff_id: "",
      prev_branch: "",
      employee_no: "",
      employee_name: "",

      settlement_branch_id: "",
      settlement_branch_code: "",
      settlement_branch_name: "",

      cbu: "",
      cashbond: "",
      utility: "",
      liabilities: "",
      thirteenth_month_pay: "",
      last_pay: "",

      separation_pay: "",
      cash_assistance: "",
      description: "",
    });

    setStaffSearch("");
    setBranchSearch("");
    setShowStaffDropdown(false);
    setShowBranchDropdown(false);
    setAttachmentFile(null);
  };

  const closeCreateModal = () => {
    setShowCreate(false);
    setEditingRow(null);
    resetForm();
  };

  const openEditSettlement = (row) => {
    setEditingRow(row);

    setForm({
      staff_id: row.staff_id || "",
      prev_branch: row.prev_branch || "",
      employee_no: row.employee_no || "",
      employee_name: row.employee_name || "",

      settlement_branch_id: row.settlement_branch_id || "",
      settlement_branch_code: row.settlement_branch_code || "",
      settlement_branch_name: row.settlement_branch_name || "",

      cbu: row.cbu || "",
      cashbond: row.cashbond || "",
      utility: row.utility || "",
      liabilities: row.liabilities || "",
      thirteenth_month_pay: row.thirteenth_month_pay || "",
      last_pay: row.last_pay || "",

      separation_pay: row.separation_pay || "",
      cash_assistance: row.cash_assistance || "",
      description: row.description || "",
    });

    setShowCreate(true);
  };

  const onChange = (e) => {
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  };

  const pickStaff = (staffId) => {
    const s = staffList.find((x) => String(x.id) === String(staffId));

    if (!s) {
      resetForm();
      return;
    }

    const bid = s.branch_id ? Number(s.branch_id) : null;
    const b = bid ? branchMap.get(bid) : null;
    const prevBranchLabel = b ? `${toStr(b.code)} - ${toStr(b.name)}` : "-";

    setForm((p) => ({
      ...p,
      staff_id: String(s.id),
      employee_no: toStr(s.employee_no),
      employee_name: toStr(s.fullname),
      prev_branch: prevBranchLabel,
    }));

    setStaffSearch(`${toStr(s.employee_no) || s.id} — ${toStr(s.fullname)}`);
    setShowStaffDropdown(false);
  };

  const pickSettlementBranch = (branchId) => {
    const b = branches.find((x) => String(x.id) === String(branchId));

    if (!b) {
      setForm((p) => ({
        ...p,
        settlement_branch_id: "",
        settlement_branch_code: "",
        settlement_branch_name: "",
      }));
      setBranchSearch("");
      return;
    }

    setForm((p) => ({
      ...p,
      settlement_branch_id: String(b.id),
      settlement_branch_code: toStr(b.code),
      settlement_branch_name: toStr(b.name),
    }));

    setBranchSearch(`${toStr(b.code)} - ${toStr(b.name)}`);
    setShowBranchDropdown(false);
  };

  const totalBenefits = useMemo(() => {
    return (
      toNum(form.cbu) +
      toNum(form.cashbond) +
      toNum(form.utility) +
      toNum(form.thirteenth_month_pay) +
      toNum(form.last_pay) +
      toNum(form.separation_pay) +
      toNum(form.cash_assistance)
    );
  }, [form]);

  const liabilitiesNum = useMemo(() => toNum(form.liabilities), [form.liabilities]);

  const netSettlement = useMemo(
    () => totalBenefits - liabilitiesNum,
    [totalBenefits, liabilitiesNum]
  );

  const createSettlement = async (e) => {
    e.preventDefault();

    if (!canCreate) return alert("Access denied.");

    if (!toStr(form.staff_id)) return alert("Select staff.");

    if (!toStr(form.employee_no) || !toStr(form.employee_name)) {
      return alert("Employee fields not set.");
    }

    if (!toStr(form.settlement_branch_id) && !toStr(form.settlement_branch_code)) {
      return alert("Select settlement branch.");
    }

    setSaving(true);

    try {
      const formData = new FormData();

      formData.append("staff_id", Number(form.staff_id));
      formData.append("prev_branch", toStr(form.prev_branch));
      formData.append("employee_no", toStr(form.employee_no));
      formData.append("employee_name", toStr(form.employee_name));

      formData.append("settlement_branch_id", form.settlement_branch_id);
      formData.append("settlement_branch_code", form.settlement_branch_code);
      formData.append("settlement_branch_name", form.settlement_branch_name);

      formData.append("cbu", form.cbu === "" ? 0 : toNum(form.cbu));
      formData.append("cashbond", form.cashbond === "" ? 0 : toNum(form.cashbond));
      formData.append("utility", form.utility === "" ? 0 : toNum(form.utility));
      formData.append("liabilities", form.liabilities === "" ? 0 : toNum(form.liabilities));
      formData.append(
        "thirteenth_month_pay",
        form.thirteenth_month_pay === "" ? 0 : toNum(form.thirteenth_month_pay)
      );
      formData.append("last_pay", form.last_pay === "" ? 0 : toNum(form.last_pay));

      if (form.separation_pay !== "") {
        formData.append("separation_pay", toNum(form.separation_pay));
      }

      if (form.cash_assistance !== "") {
        formData.append("cash_assistance", toNum(form.cash_assistance));
      }

      formData.append("total_benefits", totalBenefits);
      formData.append("net_settlement", netSettlement);
      formData.append("description", toStr(form.description));

      if (attachmentFile) {
        formData.append("attachment", attachmentFile);
      }

      if (editingRow) {
        await api.put(`/settlements/${editingRow.id}`, formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });
      } else {
        await api.post("/settlements", formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });
      }

      alert(
        editingRow
          ? "Settlement updated successfully."
          : "Settlement saved successfully."
      );
      closeCreateModal();
      await loadSettlements();
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to save settlement.");
    } finally {
      setSaving(false);
    }
  };

  const deleteSettlement = async (id) => {
    if (!canDelete) return alert("Access denied.");
    if (!window.confirm("Delete this settlement record?")) return;

    try {
      await api.delete(`/settlements/${id}`);
      await loadSettlements();
    } catch (err) {
      alert(err?.response?.data?.message || "Delete failed.");
    }
  };

  const downloadSettlementFile = async (id, fallbackName = "") => {
    try {
      const res = await api.get(`/settlements/${id}/download`, {
        responseType: "blob",
      });

      const blob = new Blob([res.data]);
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = fallbackName || `settlement-${id}`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to download settlement file.");
    }
  };

  const money = (v) => toNum(v).toLocaleString();

  if (!canView) {
    return (
      <div className="approval-page">
        <div className="approval-page-header">
          <div>
            <h2 className="approval-title">Statement of Accounts</h2>
            <p className="approval-subtitle">Access denied</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="approval-page">
      <div className="approval-page-header">
        <div>
          <h2 className="approval-title">Statement of Accounts</h2>
          <p className="approval-subtitle">
            Create settlements, assign to a branch, and upload settlement files.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="btn-secondary" onClick={() => navigate(-1)} type="button">
            ← Back
          </button>

          <button className="btn-secondary" onClick={loadSettlements} type="button">
            Refresh
          </button>

          {canCreate && (
            <button className="btn-primary" onClick={() => setShowCreate(true)} type="button">
              + Create
            </button>
          )}
        </div>
      </div>

      <div className="soa-toolbar" style={{ marginBottom: 14 }}>
        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <input
            className="soa-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search employee, branch, description..."
            style={{ maxWidth: 420 }}
          />

          <select
            className="soa-page-size"
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            style={{ maxWidth: 140 }}
          >
            <option value={25}>25 rows</option>
            <option value={50}>50 rows</option>
            <option value={75}>75 rows</option>
            <option value={100}>100 rows</option>
          </select>

          <span className="soa-count-pill">Results: {filteredSettlements.length}</span>
          <span className="soa-count-pill">Showing: {pagedSettlements.length}</span>
        </div>
      </div>

      <div className="table-card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Employee</th>
                <th>Prev Branch</th>
                <th>Settlement Branch</th>
                <th>Benefits</th>
                <th>Liabilities</th>
                <th>Net</th>
                <th>Description</th>
                <th>File</th>
                <th>Created</th>
                <th style={{ width: 240 }}>Action</th>
              </tr>
            </thead>

            <tbody>
              {loadingList ? (
                <tr>
                  <td colSpan={11} className="empty-state">
                    Loading…
                  </td>
                </tr>
              ) : filteredSettlements.length === 0 ? (
                <tr>
                  <td colSpan={11} className="empty-state">
                    No settlement records found.
                  </td>
                </tr>
              ) : (
                pagedSettlements.map((r) => (
                  <tr key={r.id}>
                    <td>{r.id}</td>

                    <td className="td-strong">
                      {r.employee_name || "-"}
                      <div style={{ fontSize: 12, opacity: 0.8 }}>
                        Employee No: {r.employee_no || "-"}
                      </div>
                    </td>

                    <td>{r.prev_branch || "-"}</td>

                    <td>
                      {r.settlement_branch_code || r.settlement_branch_name
                        ? `${r.settlement_branch_code || ""} - ${
                            r.settlement_branch_name || ""
                          }`
                        : "-"}
                    </td>

                    <td>{money(r.total_benefits)}</td>
                    <td>{money(r.liabilities)}</td>
                    <td>{money(r.net_settlement)}</td>
                    <td>
                      {r.description
                        ? r.description.length > 60
                          ? `${r.description.slice(0, 60)}...`
                          : r.description
                        : "-"}
                    </td>

                    <td>
                      {r.attachment_path ? (
                        <button
                          className="btn-secondary"
                          type="button"
                          onClick={() => downloadSettlementFile(r.id, r.attachment_name)}
                        >
                          Download File
                        </button>
                      ) : (
                        "-"
                      )}
                    </td>

                    <td>{fmtDate(r.created_at)}</td>

                    <td>
                      <div className="row-actions">
                        <button
                          className="btn-secondary"
                          type="button"
                          onClick={() => setViewRow(r)}
                        >
                          View
                        </button>

                        {canEdit && (
                          <button
                            className="btn-secondary"
                            type="button"
                            onClick={() => openEditSettlement(r)}
                          >
                            Edit
                          </button>
                        )}

                        {canDelete && (
                          <button
                            className="btn-danger"
                            type="button"
                            onClick={() => deleteSettlement(r.id)}
                          >
                            Delete
                          </button>
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

      <div className="soa-pager" style={{ marginTop: 14 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <button
            className="soa-page-btn"
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </button>

          <strong className="soa-page-info">Page {page} of {totalPages}</strong>

          <button
            className="soa-page-btn"
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
          </button>
        </div>
      </div>

      {showCreate && canCreate && (
        <div
          className="modal-overlay"
          onMouseDown={(e) =>
            e.target.classList.contains("modal-overlay") && closeCreateModal()
          }
        >
          <div className="modal saas-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h3 className="modal-title">Create Settlement</h3>
                <p className="modal-subtitle">
                  Pick the settlement branch. Managers can view based on their scope.
                </p>
              </div>

              <button className="modal-x" type="button" onClick={closeCreateModal}>
                ✕
              </button>
            </div>

            <form onSubmit={createSettlement} className="modal-form">
              <div className="modal-grid">
                <div
                  className="form-group full"
                  ref={staffBoxRef}
                  style={{ position: "relative" }}
                >
                  <label>Staff</label>

                  <input
                    type="text"
                    placeholder="Search staff..."
                    value={staffSearch}
                    onChange={(e) => {
                      const value = e.target.value;
                      setStaffSearch(value);
                      setShowStaffDropdown(true);

                      setForm((p) => ({
                        ...p,
                        staff_id: "",
                        prev_branch: "",
                        employee_no: "",
                        employee_name: "",
                      }));
                    }}
                    onFocus={() => setShowStaffDropdown(true)}
                    required={!form.staff_id}
                  />

                  {showStaffDropdown && (
                    <div
                      style={{
                        position: "absolute",
                        top: "100%",
                        left: 0,
                        right: 0,
                        background: "#0f172a",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 10,
                        maxHeight: 220,
                        overflowY: "auto",
                        zIndex: 50,
                        boxShadow: "0 12px 30px rgba(0,0,0,0.25)",
                        marginTop: 6,
                      }}
                    >
                      {filteredStaff.length === 0 ? (
                        <div style={{ padding: 10, color: "#cbd5e1" }}>
                          No staff found
                        </div>
                      ) : (
                        filteredStaff.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => pickStaff(s.id)}
                            style={{
                              width: "100%",
                              textAlign: "left",
                              padding: "10px 12px",
                              border: "none",
                              borderBottom: "1px solid rgba(255,255,255,0.08)",
                              background: "transparent",
                              color: "white",
                              cursor: "pointer",
                            }}
                          >
                            {toStr(s.employee_no) || s.id} — {toStr(s.fullname)}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                <div
                  className="form-group full"
                  ref={branchBoxRef}
                  style={{ position: "relative" }}
                >
                  <label>Settlement Branch</label>

                  <input
                    type="text"
                    placeholder="Search settlement branch..."
                    value={branchSearch}
                    onChange={(e) => {
                      const value = e.target.value;
                      setBranchSearch(value);
                      setShowBranchDropdown(true);

                      setForm((p) => ({
                        ...p,
                        settlement_branch_id: "",
                        settlement_branch_code: "",
                        settlement_branch_name: "",
                      }));
                    }}
                    onFocus={() => setShowBranchDropdown(true)}
                    required={!form.settlement_branch_id}
                  />

                  {showBranchDropdown && (
                    <div
                      style={{
                        position: "absolute",
                        top: "100%",
                        left: 0,
                        right: 0,
                        background: "#0f172a",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 10,
                        maxHeight: 220,
                        overflowY: "auto",
                        zIndex: 50,
                        boxShadow: "0 12px 30px rgba(0,0,0,0.25)",
                        marginTop: 6,
                      }}
                    >
                      {filteredBranches.length === 0 ? (
                        <div style={{ padding: 10, color: "#cbd5e1" }}>
                          No branch found
                        </div>
                      ) : (
                        filteredBranches.map((b) => (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => pickSettlementBranch(b.id)}
                            style={{
                              width: "100%",
                              textAlign: "left",
                              padding: "10px 12px",
                              border: "none",
                              borderBottom: "1px solid rgba(255,255,255,0.08)",
                              background: "transparent",
                              color: "white",
                              cursor: "pointer",
                            }}
                          >
                            {toStr(b.code)} - {toStr(b.name)}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label>Employee No</label>
                  <input value={form.employee_no} readOnly placeholder="Auto-filled" />
                </div>

                <div className="form-group">
                  <label>Employee Name</label>
                  <input value={form.employee_name} readOnly placeholder="Auto-filled" />
                </div>

                <div className="form-group full">
                  <label>Previous Branch</label>
                  <input value={form.prev_branch} readOnly placeholder="Auto-filled" />
                </div>

                <div className="form-group">
                  <label>CBU</label>
                  <input
                    type="number"
                    step="0.01"
                    name="cbu"
                    value={form.cbu}
                    onChange={onChange}
                  />
                </div>

                <div className="form-group">
                  <label>Cashbond</label>
                  <input
                    type="number"
                    step="0.01"
                    name="cashbond"
                    value={form.cashbond}
                    onChange={onChange}
                  />
                </div>

                <div className="form-group">
                  <label>Utility</label>
                  <input
                    type="number"
                    step="0.01"
                    name="utility"
                    value={form.utility}
                    onChange={onChange}
                  />
                </div>

                <div className="form-group">
                  <label>Liabilities</label>
                  <input
                    type="number"
                    step="0.01"
                    name="liabilities"
                    value={form.liabilities}
                    onChange={onChange}
                  />
                </div>

                <div className="form-group">
                  <label>13th Month Pay</label>
                  <input
                    type="number"
                    step="0.01"
                    name="thirteenth_month_pay"
                    value={form.thirteenth_month_pay}
                    onChange={onChange}
                  />
                </div>

                <div className="form-group">
                  <label>Last Pay</label>
                  <input
                    type="number"
                    step="0.01"
                    name="last_pay"
                    value={form.last_pay}
                    onChange={onChange}
                  />
                </div>

                <div className="form-group">
                  <label>Separation Pay (Optional)</label>
                  <input
                    type="number"
                    step="0.01"
                    name="separation_pay"
                    value={form.separation_pay}
                    onChange={onChange}
                    placeholder="0 or blank"
                  />
                </div>

                <div className="form-group">
                  <label>Cash Assistance (Optional)</label>
                  <input
                    type="number"
                    step="0.01"
                    name="cash_assistance"
                    value={form.cash_assistance}
                    onChange={onChange}
                    placeholder="0 or blank"
                  />
                </div>

                <div className="form-group full">
                  <label>Upload Settlement File</label>
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                    onChange={(e) => setAttachmentFile(e.target.files?.[0] || null)}
                  />
                </div>

                <div className="form-group full">
                  <label>Description</label>

                  <textarea
                    name="description"
                    value={form.description}
                    onChange={onChange}
                    rows={4}
                    placeholder="Settlement description..."
                  />
                </div>
              </div>

              <div
                style={{
                  padding: "10px 0",
                  display: "flex",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div className="pill">
                  Benefits: <strong>{money(totalBenefits)}</strong>
                </div>

                <div className="pill">
                  Liabilities: <strong>{money(liabilitiesNum)}</strong>
                </div>

                <div className="pill">
                  Net Settlement: <strong>{money(netSettlement)}</strong>
                </div>
              </div>

              <div className="modal-buttons">
                <button className="btn-secondary" type="button" onClick={closeCreateModal}>
                  Cancel
                </button>

                <button className="btn-primary" type="submit" disabled={saving}>
                  {saving ? "Saving..." : "Save Settlement"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewRow && (
        <div className="modal-overlay" onMouseDown={() => setViewRow(null)}>
          <div className="modal saas-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h3 className="modal-title">Settlement Record</h3>
                <p className="modal-subtitle">
                  {viewRow.employee_name} • Employee No: {viewRow.employee_no} •
                  Settlement Branch: {viewRow.settlement_branch_code || "-"} -{" "}
                  {viewRow.settlement_branch_name || "-"}
                </p>
              </div>

              <button className="modal-x" type="button" onClick={() => setViewRow(null)}>
                ✕
              </button>
            </div>

            <div style={{ padding: 16 }}>
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  flexWrap: "wrap",
                  marginBottom: 12,
                }}
              >
                <div className="pill">
                  Benefits: <strong>{money(viewRow.total_benefits)}</strong>
                </div>

                <div className="pill">
                  Liabilities: <strong>{money(viewRow.liabilities)}</strong>
                </div>

                <div className="pill">
                  Net Settlement: <strong>{money(viewRow.net_settlement)}</strong>
                </div>
              </div>

              <table className="table">
                <tbody>
                  <tr>
                    <td>Employee No</td>
                    <td>{viewRow.employee_no || "-"}</td>
                  </tr>

                  <tr>
                    <td>Employee Name</td>
                    <td>{viewRow.employee_name || "-"}</td>
                  </tr>

                  <tr>
                    <td>Previous Branch</td>
                    <td>{viewRow.prev_branch || "-"}</td>
                  </tr>

                  <tr>
                    <td>Settlement Branch</td>
                    <td>
                      {viewRow.settlement_branch_code || "-"} -{" "}
                      {viewRow.settlement_branch_name || "-"}
                    </td>
                  </tr>

                  <tr>
                    <td>CBU</td>
                    <td>{money(viewRow.cbu)}</td>
                  </tr>

                  <tr>
                    <td>Cashbond</td>
                    <td>{money(viewRow.cashbond)}</td>
                  </tr>

                  <tr>
                    <td>Utility</td>
                    <td>{money(viewRow.utility)}</td>
                  </tr>

                  <tr>
                    <td>Liabilities</td>
                    <td>{money(viewRow.liabilities)}</td>
                  </tr>

                  <tr>
                    <td>13th Month Pay</td>
                    <td>{money(viewRow.thirteenth_month_pay)}</td>
                  </tr>

                  <tr>
                    <td>Last Pay</td>
                    <td>{money(viewRow.last_pay)}</td>
                  </tr>

                  <tr>
                    <td>Separation Pay</td>
                    <td>{money(viewRow.separation_pay)}</td>
                  </tr>

                  <tr>
                    <td>Cash Assistance</td>
                    <td>{money(viewRow.cash_assistance)}</td>
                  </tr>

                  <tr>
                    <td>File</td>
                    <td>
                      {viewRow.attachment_path ? (
                        <button
                          className="btn-secondary"
                          type="button"
                          onClick={() =>
                            downloadSettlementFile(viewRow.id, viewRow.attachment_name)
                          }
                        >
                          Download File
                        </button>
                      ) : (
                        "No file"
                      )}
                    </td>
                  </tr>

                  <tr>
                    <td>Created</td>
                    <td>{fmtDate(viewRow.created_at)}</td>
                  </tr>

                  <tr>
                    <td>Description</td>
                    <td>{viewRow.description || "-"}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="modal-buttons">
              <button className="btn-primary" type="button" onClick={() => setViewRow(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}