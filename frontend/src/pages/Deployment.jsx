import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axiosClient";
import "../styles/Deployments.css";

import StepTabs from "./Deployment/StepTabs";
import StaffDetailsStep from "./Deployment/StaffDetailsStep";
import ContractDetailsStep from "./Deployment/ContractDetailsStep";
import StaffCreateModal from "./Deployment/StaffCreateModal";
import {
  displayNameParts,
  norm,
  safeJsonArray,
  toDate10,
  toNum,
  toStr,
} from "./Deployment/deploymentUtils";

export default function Deployment() {
  const navigate = useNavigate();

  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  }, []);

  const role = String(user?.role || "").trim().toLowerCase();

  const isAdmin = role === "admin";
  const isIt = role === "it";
  const isHr = role === "hr";
  const isAccounting = role === "accounting";
  const isTread = role === "tread";
  const isAssistantVicePresident = role === "assistant vice president";
  const isVicePresident = role === "vice president";
  const isSeniorVicePresident = role === "senior vice president";
  const isPresident = role === "president";

  const canCreateDeployment = isAdmin || isIt || isHr || isAccounting;

  const canApproveDeployment =
    isAdmin ||
    isIt ||
    isHr ||
    isAccounting ||
    isAssistantVicePresident ||
    isVicePresident ||
    isSeniorVicePresident ||
    isPresident;

  const canDeleteDeployment = isAdmin || isIt || isHr || isAccounting;

  const canAddStaff = isAdmin || isIt || isHr || isAccounting;

  const canApprovePendingStaff = isAdmin || isIt || isHr || isAccounting;

  const [users, setUsers] = useState([]);
  const [deployments, setDeployments] = useState([]);
  const [staff, setStaff] = useState([]);
  const [branches, setBranches] = useState([]);
  const [compRates, setCompRates] = useState([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [approvingId, setApprovingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [err, setErr] = useState("");

  const [showFormModal, setShowFormModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [viewRow, setViewRow] = useState(null);

  const [pendingStaff, setPendingStaff] = useState([]);
  const [approvingPendingId, setApprovingPendingId] = useState(null);
  const [rejectingPendingId, setRejectingPendingId] = useState(null);

  const [showAddStaff, setShowAddStaff] = useState(false);
  const [editingPending, setEditingPending] = useState(null);
  const [pendingEditStep, setPendingEditStep] = useState(1);
  const [pendingSaving, setPendingSaving] = useState(false);

  const makeEmptyPendingForm = useCallback(
    () => ({
      employee_no: "",
      last_name: "",
      first_name: "",
      middle_name: "",

      address: "",
      municipality: "",
      province: "",
      contact: "",
      email: "",
      date_of_birth: "",
      place_of_birth: "",
      gender: "",
      civil_status: "",
      citizenship: "",
      height: "",
      weight: "",
      religion: "",
      blood_type: "",

      spouse_fullname: "",
      spouse_address: "",
      spouse_occupation: "",
      spouse_employer: "",

      children: JSON.stringify(
        [{ fullname: "", date_of_birth: "", place_of_birth: "", age: "" }],
        null,
        2
      ),

      father_fullname: "",
      father_address: "",
      father_occupation: "",
      father_employer: "",
      father_contact: "",

      mother_fullname: "",
      mother_address: "",
      mother_occupation: "",
      mother_employer: "",
      mother_contact: "",

      guardian_fullname: "",
      guardian_address: "",
      guardian_occupation: "",
      guardian_employer: "",
      guardian_contact: "",

      primary_school_name: "",
      primary_year_started: "",
      primary_year_graduated: "",

      secondary_school_name: "",
      secondary_year_started: "",
      secondary_year_graduated: "",

      tertiary_school_name: "",
      tertiary_course: "",
      tertiary_major: "",
      tertiary_year_started: "",
      tertiary_year_graduated: "",

      employment_history: JSON.stringify(
        [
          {
            company: "",
            position: "",
            year_started: "",
            year_ended: "",
            character_reference: "",
            contact_number: "",
          },
        ],
        null,
        2
      ),

      beneficiaries: JSON.stringify(
        [{ name: "", relation: "", contact_number: "" }],
        null,
        2
      ),

      sss_no: "",
      philhealth_no: "",
      pagibig_no: "",
      tin_no: "",

      position: "",
      department: "",
      area: "",
      region: "",
      division: "",
      branch_id: "",
      status: "Active",

      start_date: "",
      regularization_date: "",

      salary: "",
      ecola: "",

      cbu: "",
      cashbond: "",
      utility: "",

      transportation: "",
      postage: "",
      motorcycle_loan: "",
      additional_target: "",
      repairing: "",
      additional_monitoring: "",
      other_deduction: "",

      sss_er: "",
      ph_er: "",
      hdmf_er: "",
      total_er: "",

      sss_ee: "",
      ph_ee: "",
      hdmf_ee: "",
      total_ee: "",

      tax: "",
    }),
    []
  );

  const [pendingForm, setPendingForm] = useState(() => makeEmptyPendingForm());

  const branchConfigMap = useMemo(() => {
    const map = new Map();

    (branches || []).forEach((b) => {
      const key = String(b?.id ?? "").trim();
      if (!key) return;

      map.set(key, {
        area: toStr(b?.area),
        region: toStr(b?.region),
        division: toStr(b?.division),
      });
    });

    return map;
  }, [branches]);

  const onStaffCreated = async () => {
    await loadData();
    setShowAddStaff(false);
  };

  const setPendingBranchAndConfig = (branchId) => {
    const id = String(branchId || "").trim();

    const selectedBranch = (branches || []).find(
      (b) => String(b?.id ?? "").trim() === id
    );

    const cfg = branchConfigMap?.get(id);

    const nextArea = toStr(cfg?.area) || toStr(selectedBranch?.area) || "";
    const nextRegion = toStr(cfg?.region) || toStr(selectedBranch?.region) || "";
    const nextDivision =
      toStr(cfg?.division) || toStr(selectedBranch?.division) || "";

    setPendingForm((prev) => ({
      ...prev,
      branch_id: id,
      area: nextArea,
      region: nextRegion,
      division: nextDivision,
    }));
  };

  const makeEmptyDeploymentForm = useCallback(
    () => ({
      employee_id: "",
      last_name: "",
      first_name: "",
      middle_name: "",
      branch_code: "",
      deployment_date: "",
      details: "",
    }),
    []
  );

  const [form, setForm] = useState(() => makeEmptyDeploymentForm());

  const visiblePendingStaff = useMemo(() => {
    return (pendingStaff || []).filter((item) => norm(item.status) === "pending");
  }, [pendingStaff]);

  const fetchUsers = useCallback(async () => {
    if (!isAdmin && !isIt) {
      setUsers([]);
      return;
    }

    try {
      const res = await api.get("/users");
      setUsers(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err?.response?.data?.message || "Failed to load users");
      setUsers([]);
    }
  }, [isAdmin, isIt]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setErr("");

    try {
      const requests = [
        api.get("/deployments"),
        api.get("/staff"),
        api.get("/branches"),
        api.get("/comp-rates"),
      ];

      if (canApprovePendingStaff) {
        requests.push(api.get("/pending-staff"));
      }

      if (isAdmin || isIt) {
        requests.push(api.get("/users"));
      }

      const results = await Promise.all(requests);

      const d = results[0];
      const s = results[1];
      const b = results[2];
      const r = results[3];

      const p = canApprovePendingStaff ? results[4] : { data: [] };

      const u =
        isAdmin || isIt
          ? results[canApprovePendingStaff ? 5 : 4]
          : { data: [] };

      const deploymentsWithImages = await Promise.all(
        (Array.isArray(d.data) ? d.data : []).map(async (item) => {
          if (!item.photo) return item;

          try {
            const res = await api.get("/file-url", {
              params: { key: item.photo },
            });

            return {
              ...item,
              photo_url: res.data.url,
            };
          } catch (err) {
            console.error("Image load failed:", err);
            return item;
          }
        })
      );

      setDeployments(deploymentsWithImages);
      setStaff(Array.isArray(s.data) ? s.data : []);
      setBranches(Array.isArray(b.data) ? b.data : []);
      setCompRates(Array.isArray(r.data) ? r.data : []);
      setPendingStaff(Array.isArray(p.data) ? p.data : []);
      setUsers(Array.isArray(u.data) ? u.data : []);
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to load deployment data.");
    } finally {
      setLoading(false);
    }
  }, [isAdmin, isIt, canApprovePendingStaff]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const resetAllModals = useCallback(() => {
    setShowFormModal(false);
    setEditingId(null);
    setForm(makeEmptyDeploymentForm());
    setViewRow(null);
    setShowAddStaff(false);
    setErr("");
    setSaving(false);

    setEditingPending(null);
    setPendingEditStep(1);
    setPendingSaving(false);
    setPendingForm(makeEmptyPendingForm());
  }, [makeEmptyDeploymentForm, makeEmptyPendingForm]);

  useEffect(() => {
    const anyOpen = showFormModal || !!viewRow || showAddStaff || !!editingPending;
    if (!anyOpen) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") resetAllModals();
    };

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [showFormModal, viewRow, showAddStaff, editingPending, resetAllModals]);

  const branchLabel = useCallback(
    (branchCode) => {
      const code = toStr(branchCode).toLowerCase();
      const b = branches.find((x) => toStr(x.code).toLowerCase() === code);
      if (!b) return String(branchCode || "-");
      return `${b.code} • ${b.name}`.trim();
    },
    [branches]
  );

  const selectedEmployee = useMemo(() => {
    return staff.find((x) => String(x.id) === String(form.employee_id)) || null;
  }, [staff, form.employee_id]);

  const onSelectEmployee = (id) => {
    const emp = staff.find((x) => String(x.id) === String(id));

    setForm((p) => ({
      ...p,
      employee_id: id,
      last_name: toStr(emp?.last_name),
      first_name: toStr(emp?.first_name),
      middle_name: toStr(emp?.middle_name),
    }));
  };

  const openCreate = () => {
    if (!canCreateDeployment) return alert("Access denied.");

    setErr("");
    setEditingId(null);
    setForm(makeEmptyDeploymentForm());
    setShowFormModal(true);
  };

  const openEdit = (d) => {
    if (!canCreateDeployment) return alert("Access denied.");

    const statusLower = norm(d?.status || "pending");
    if (statusLower === "approved") {
      return alert("Approved deployments cannot be edited.");
    }

    setErr("");
    setEditingId(d.id);
    setForm({
      employee_id: d.employee_id ?? "",
      last_name: d.last_name ?? "",
      first_name: d.first_name ?? "",
      middle_name: d.middle_name ?? "",
      branch_code: d.branch_code ?? "",
      deployment_date: toDate10(d.deployment_date),
      details: toStr(d.details ?? ""),
    });
    setShowFormModal(true);
  };

  const closeFormModal = () => {
    setShowFormModal(false);
    setEditingId(null);
    setForm(makeEmptyDeploymentForm());
    setErr("");
    setSaving(false);
  };

  const openViewModal = async (d) => {
    setErr("");

    try {
      const res = await api.get(`/deployments/${d.id}`);
      setViewRow(res.data || d);
    } catch {
      setViewRow(d);
    }
  };

  const closeViewModal = () => setViewRow(null);

  const saveDeployment = async (e) => {
    e.preventDefault();
    if (saving) return;

    setErr("");

    const employeeId = Number(form.employee_id);
    const branchCode = toStr(form.branch_code);

    if (!employeeId) return setErr("Employee is required.");
    if (!branchCode) return setErr("Deployment branch is required.");
    if (!form.deployment_date) return setErr("Deployment date is required.");

    setSaving(true);

    try {
      const payload = {
        employee_id: employeeId,
        branch_code: branchCode,
        deployment_date: toDate10(form.deployment_date),
        details: toStr(form.details) || null,
      };

      if (editingId) {
        await api.put(`/deployments/${editingId}`, payload);
      } else {
        await api.post("/deployments", payload);
      }

      closeFormModal();
      await loadData();
    } catch (e2) {
      setErr(e2?.response?.data?.message || "Failed to save deployment.");
    } finally {
      setSaving(false);
    }
  };

  const approveDeployment = async (d) => {
    if (!canApproveDeployment) return alert("Access denied.");

    const statusLower = norm(d?.status || "pending");
    if (statusLower !== "pending") return;

    const ok = window.confirm(
      `Approve this deployment?\n\nEmployee: ${
        d.employee_name || displayNameParts(d)
      }\nTo Branch: ${
        d.branch_code || d.branch_name
          ? `${d.branch_code} • ${d.branch_name}`
          : branchLabel(d.branch_code)
      }\nDate: ${toDate10(
        d.deployment_date
      )}\n\nThis will UPDATE staff.branch_id.`
    );

    if (!ok) return;

    setApprovingId(d.id);
    setErr("");

    try {
      await api.put(`/deployments/${d.id}/approve`);
      await loadData();
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to approve deployment.");
    } finally {
      setApprovingId(null);
    }
  };

  const deleteDeployment = async (d) => {
    if (!canDeleteDeployment) return alert("Access denied.");
    if (!d?.id) return;

    const statusLower = norm(d?.status || "pending");

    if (statusLower === "approved") {
      return alert("Approved deployments cannot be deleted.");
    }

    const ok = window.confirm(
      `Delete this deployment?\n\nEmployee: ${
        d.employee_name || displayNameParts(d)
      }\nBranch: ${
        d.branch_code || d.branch_name
          ? `${d.branch_code} • ${d.branch_name}`
          : branchLabel(d.branch_code)
      }\nDate: ${toDate10(d.deployment_date)}`
    );

    if (!ok) return;

    setDeletingId(d.id);
    setErr("");

    try {
      await api.delete(`/deployments/${d.id}`);
      setDeployments((prev) => prev.filter((x) => x.id !== d.id));
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to delete deployment.");
    } finally {
      setDeletingId(null);
    }
  };

  const openEditPending = (item) => {
    const payload =
      typeof item.payload === "string"
        ? JSON.parse(item.payload || "{}")
        : item.payload || {};

    setEditingPending(item);
    setPendingEditStep(1);
    setPendingForm({
      ...makeEmptyPendingForm(),
      ...payload,
      children: JSON.stringify(
        Array.isArray(payload.children)
          ? payload.children
          : safeJsonArray(payload.children).length
          ? safeJsonArray(payload.children)
          : [{ fullname: "", date_of_birth: "", place_of_birth: "", age: "" }],
        null,
        2
      ),
      employment_history: JSON.stringify(
        Array.isArray(payload.employment_history)
          ? payload.employment_history
          : safeJsonArray(payload.employment_history).length
          ? safeJsonArray(payload.employment_history)
          : [
              {
                company: "",
                position: "",
                year_started: "",
                year_ended: "",
                character_reference: "",
                contact_number: "",
              },
            ],
        null,
        2
      ),
      beneficiaries: JSON.stringify(
        Array.isArray(payload.beneficiaries)
          ? payload.beneficiaries
          : safeJsonArray(payload.beneficiaries).length
          ? safeJsonArray(payload.beneficiaries)
          : [{ name: "", relation: "", contact_number: "" }],
        null,
        2
      ),
    });
  };

  const closeEditPending = () => {
    setEditingPending(null);
    setPendingEditStep(1);
    setPendingSaving(false);
    setPendingForm(makeEmptyPendingForm());
  };

  const buildPendingPayload = () => {
    const erTotal =
      toNum(pendingForm.sss_er) +
      toNum(pendingForm.ph_er) +
      toNum(pendingForm.hdmf_er);

    const eeTotal =
      toNum(pendingForm.sss_ee) +
      toNum(pendingForm.ph_ee) +
      toNum(pendingForm.hdmf_ee);

    return {
      ...pendingForm,
      branch_id: pendingForm.branch_id ? Number(pendingForm.branch_id) : null,

      date_of_birth: pendingForm.date_of_birth || null,
      start_date: pendingForm.start_date || null,
      regularization_date: pendingForm.regularization_date || null,

      height: pendingForm.height === "" ? null : Number(pendingForm.height),
      weight: pendingForm.weight === "" ? null : Number(pendingForm.weight),

      salary: pendingForm.salary === "" ? null : Number(pendingForm.salary),
      ecola: pendingForm.ecola === "" ? null : Number(pendingForm.ecola),

      cbu: toNum(pendingForm.cbu),
      cashbond: toNum(pendingForm.cashbond),
      utility: toNum(pendingForm.utility),

      transportation: toNum(pendingForm.transportation),
      postage: toNum(pendingForm.postage),
      motorcycle_loan: toNum(pendingForm.motorcycle_loan),
      additional_target: toNum(pendingForm.additional_target),
      repairing: toNum(pendingForm.repairing),
      additional_monitoring: toNum(pendingForm.additional_monitoring),
      other_deduction: toNum(pendingForm.other_deduction),

      sss_er: toNum(pendingForm.sss_er),
      ph_er: toNum(pendingForm.ph_er),
      hdmf_er: toNum(pendingForm.hdmf_er),
      total_er: erTotal,

      sss_ee: toNum(pendingForm.sss_ee),
      ph_ee: toNum(pendingForm.ph_ee),
      hdmf_ee: toNum(pendingForm.hdmf_ee),
      total_ee: eeTotal,

      tax: toNum(pendingForm.tax),

      children: safeJsonArray(pendingForm.children),
      employment_history: safeJsonArray(pendingForm.employment_history),
      beneficiaries: safeJsonArray(pendingForm.beneficiaries),

      spouse_fullname: toStr(pendingForm.spouse_fullname) || null,
      spouse_address: toStr(pendingForm.spouse_address) || null,
      spouse_occupation: toStr(pendingForm.spouse_occupation) || null,
      spouse_employer: toStr(pendingForm.spouse_employer) || null,

      sss_no: toStr(pendingForm.sss_no) || null,
      philhealth_no: toStr(pendingForm.philhealth_no) || null,
      pagibig_no: toStr(pendingForm.pagibig_no) || null,
      tin_no: toStr(pendingForm.tin_no) || null,

      father_fullname: toStr(pendingForm.father_fullname) || null,
      father_address: toStr(pendingForm.father_address) || null,
      father_occupation: toStr(pendingForm.father_occupation) || null,
      father_employer: toStr(pendingForm.father_employer) || null,
      father_contact: toStr(pendingForm.father_contact) || null,

      mother_fullname: toStr(pendingForm.mother_fullname) || null,
      mother_address: toStr(pendingForm.mother_address) || null,
      mother_occupation: toStr(pendingForm.mother_occupation) || null,
      mother_employer: toStr(pendingForm.mother_employer) || null,
      mother_contact: toStr(pendingForm.mother_contact) || null,

      guardian_fullname: toStr(pendingForm.guardian_fullname) || null,
      guardian_address: toStr(pendingForm.guardian_address) || null,
      guardian_occupation: toStr(pendingForm.guardian_occupation) || null,
      guardian_employer: toStr(pendingForm.guardian_employer) || null,
      guardian_contact: toStr(pendingForm.guardian_contact) || null,

      primary_school_name: toStr(pendingForm.primary_school_name) || null,
      primary_year_started: toStr(pendingForm.primary_year_started) || null,
      primary_year_graduated: toStr(pendingForm.primary_year_graduated) || null,

      secondary_school_name: toStr(pendingForm.secondary_school_name) || null,
      secondary_year_started: toStr(pendingForm.secondary_year_started) || null,
      secondary_year_graduated: toStr(pendingForm.secondary_year_graduated) || null,

      tertiary_school_name: toStr(pendingForm.tertiary_school_name) || null,
      tertiary_course: toStr(pendingForm.tertiary_course) || null,
      tertiary_major: toStr(pendingForm.tertiary_major) || null,
      tertiary_year_started: toStr(pendingForm.tertiary_year_started) || null,
      tertiary_year_graduated: toStr(pendingForm.tertiary_year_graduated) || null,
    };
  };

  const updatePendingStaff = async (e) => {
    e.preventDefault();

    if (!editingPending?.id) return;

    if (!toStr(pendingForm.last_name) || !toStr(pendingForm.first_name)) {
      alert("Last Name and First Name are required.");
      setPendingEditStep(1);
      return;
    }

    if (!toStr(pendingForm.position)) {
      alert("Position is required.");
      setPendingEditStep(2);
      return;
    }

    setPendingSaving(true);

    try {
      const payload = buildPendingPayload();

      const res = await api.put(`/pending-staff/${editingPending.id}`, {
        payload,
      });

      setPendingStaff((prev) =>
        prev.map((row) =>
          row.id === editingPending.id ? { ...row, ...res.data.request } : row
        )
      );

      closeEditPending();
      alert("Pending staff request updated.");
    } catch (err) {
      alert(
        err?.response?.data?.message || "Failed to update pending staff request."
      );
    } finally {
      setPendingSaving(false);
    }
  };

  const approvePendingStaff = async (id) => {
    if (!canApprovePendingStaff) return alert("Access denied.");

    const ok = window.confirm("Approve this pending staff request?");
    if (!ok) return;

    setApprovingPendingId(id);
    setErr("");

    try {
      await api.put(`/pending-staff/${id}/approve`);

      setPendingStaff((prev) => prev.filter((row) => row.id !== id));
      await loadData();

      alert("Pending staff approved.");
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to approve pending staff.");
    } finally {
      setApprovingPendingId(null);
    }
  };

  const rejectPendingStaff = async (id) => {
    if (!canApprovePendingStaff) return alert("Access denied.");

    const ok = window.confirm("Reject this pending staff request?");
    if (!ok) return;

    setRejectingPendingId(id);
    setErr("");

    try {
      await api.put(`/pending-staff/${id}/reject`, {
        rejection_reason: "",
      });

      setPendingStaff((prev) => prev.filter((row) => row.id !== id));
      await loadData();

      alert("Pending staff rejected.");
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to reject pending staff.");
    } finally {
      setRejectingPendingId(null);
    }
  };

  const modalTitle = editingId ? "Edit Deployment" : "Create Deployment";

  return (
    <div className="po-page">
      <div className="po-topbar">
        <h2 className="po-title">Deployment Orders</h2>

        <div className="po-topbar-actions">
          <button
            className="po-btn"
            type="button"
            onClick={() => navigate("/transactions")}
          >
            ← Back
          </button>

          <button className="po-btn" type="button" onClick={loadData} disabled={loading}>
            Refresh
          </button>

          {canCreateDeployment && (
            <button className="po-btn" type="button" onClick={openCreate}>
              + Create Deployment
            </button>
          )}

          {canAddStaff && (
            <button className="po-btn" type="button" onClick={() => setShowAddStaff(true)}>
              + Add Staff
            </button>
          )}
        </div>
      </div>

      {err ? (
        <div style={{ marginBottom: 12, color: "#ef4444", fontWeight: 800 }}>
          {err}
        </div>
      ) : null}

      {showAddStaff && canAddStaff && (
        <StaffCreateModal
          branches={branches}
          compRates={compRates}
          branchConfigMap={branchConfigMap}
          onClose={() => setShowAddStaff(false)}
          onCreated={onStaffCreated}
        />
      )}

      {showFormModal && (
        <div
          className="po-modal-overlay"
          onMouseDown={(e) =>
            e.target.classList.contains("po-modal-overlay") && closeFormModal()
          }
        >
          <div className="po-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0 }}>{modalTitle}</h3>
              <button className="po-x" type="button" onClick={closeFormModal}>
                ✕
              </button>
            </div>

            <form onSubmit={saveDeployment} className="po-form">
              <div className="po-field">
                <label>Employee</label>
                <select
                  value={form.employee_id}
                  onChange={(e) => onSelectEmployee(e.target.value)}
                  disabled={!!editingId}
                >
                  <option value="">Select Employee</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.id} - {displayNameParts(s)}{" "}
                      {s.employee_no ? `(${s.employee_no})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="po-grid">
                <div className="po-field">
                  <label>Employee ID</label>
                  <input value={form.employee_id || ""} readOnly />
                </div>

                <div className="po-field">
                  <label>Last Name</label>
                  <input value={form.last_name} readOnly />
                </div>

                <div className="po-field">
                  <label>First Name</label>
                  <input value={form.first_name} readOnly />
                </div>

                <div className="po-field">
                  <label>Middle Name</label>
                  <input value={form.middle_name} readOnly />
                </div>
              </div>

              <div className="po-field">
                <label>Deployment Branch</label>
                <select
                  value={form.branch_code}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      branch_code: e.target.value,
                    }))
                  }
                >
                  <option value="">Select Branch</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.code}>
                      {b.code} - {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="po-field">
                <label>Date of Deployment</label>
                <input
                  type="date"
                  value={form.deployment_date}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      deployment_date: e.target.value,
                    }))
                  }
                />
              </div>

              <div className="po-field">
                <label>Details / Remarks</label>
                <input
                  value={form.details}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      details: e.target.value,
                    }))
                  }
                  placeholder="Type details..."
                />
              </div>

              {selectedEmployee ? (
                <div style={{ fontSize: 12, opacity: 0.85, marginTop: 6 }}>
                  Preview: <b>{displayNameParts(selectedEmployee)}</b> →{" "}
                  <b>{branchLabel(form.branch_code) || "—"}</b> on{" "}
                  <b>{form.deployment_date || "—"}</b>
                </div>
              ) : null}

              {err ? (
                <div style={{ marginTop: 10, color: "#ef4444", fontWeight: 800 }}>
                  {err}
                </div>
              ) : null}

              <div className="po-modal-actions">
                <button className="po-btn" type="button" onClick={closeFormModal} disabled={saving}>
                  Cancel
                </button>

                <button className="po-btn po-btn-primary" type="submit" disabled={saving}>
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingPending && (
        <div className="modal-overlay" onMouseDown={closeEditPending}>
          <div
            className="modal staff-profile-modal"
            onMouseDown={(e) => e.stopPropagation()}
            style={{ maxWidth: 1200 }}
          >
            <div className="modal-head">
              <div>
                <h3>Edit Pending Staff</h3>
                <div className="mini">
                  {toStr(pendingForm.last_name)}
                  {pendingForm.last_name && pendingForm.first_name ? ", " : ""}
                  {toStr(pendingForm.first_name)} • {pendingForm.position || "-"} • Pending
                </div>
              </div>

              <button className="icon-btn" onClick={closeEditPending} type="button">
                ✕
              </button>
            </div>

            <form onSubmit={updatePendingStaff}>
              <div className="modal-body staff-profile-scroll">
                <StepTabs step={pendingEditStep} onSelectStep={setPendingEditStep} />
                <br />

                {pendingEditStep === 1 ? (
                  <StaffDetailsStep form={pendingForm} setForm={setPendingForm} />
                ) : (
                  <ContractDetailsStep
                    form={pendingForm}
                    branches={branches}
                    compRates={compRates}
                    setForm={setPendingForm}
                    branchConfigMap={branchConfigMap}
                    onBranchChange={setPendingBranchAndConfig}
                  />
                )}
              </div>

              <div className="modal-foot">
                {pendingEditStep === 1 ? (
                  <>
                    <button
                      className="btn btn-primary"
                      type="button"
                      onClick={() => setPendingEditStep(2)}
                    >
                      Next
                    </button>

                    <button className="btn btn-ghost" type="button" onClick={closeEditPending}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="btn btn-outline"
                      type="button"
                      onClick={() => setPendingEditStep(1)}
                    >
                      Back
                    </button>

                    <button className="btn btn-primary" type="submit" disabled={pendingSaving}>
                      {pendingSaving ? "Saving..." : "Save Changes"}
                    </button>

                    <button className="btn btn-ghost" type="button" onClick={closeEditPending}>
                      Cancel
                    </button>
                  </>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="po-card" style={{ marginTop: 16 }}>
        <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="po-title" style={{ fontSize: 18, margin: 0 }}>
            Pending Staff Approval
          </div>

          <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>
            Review staff requests before they move into Staff Information.
          </div>
        </div>

        <table className="po-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Position</th>
              <th>Branch</th>
              <th>Status</th>
              <th>Date Submitted</th>
              <th style={{ width: 320 }}>Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ padding: 16, opacity: 0.8 }}>
                  Loading...
                </td>
              </tr>
            ) : visiblePendingStaff.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 16, opacity: 0.8 }}>
                  No pending staff requests found.
                </td>
              </tr>
            ) : (
              visiblePendingStaff.map((item) => {
                const payload =
                  typeof item.payload === "string"
                    ? JSON.parse(item.payload || "{}")
                    : item.payload || {};

                const branch = branches.find(
                  (b) => String(b.id) === String(payload.branch_id)
                );

                const employeeName =
                  `${toStr(payload.last_name)}${
                    payload.last_name && payload.first_name ? ", " : ""
                  }${toStr(payload.first_name)}${
                    payload.middle_name ? ` ${payload.middle_name}` : ""
                  }`
                    .replace(/\s+/g, " ")
                    .trim() || "-";

                const pending = norm(item.status) === "pending";

                return (
                  <tr key={item.id}>
                    <td>
                      <div className="td-strong">{employeeName}</div>
                      <div style={{ fontSize: 12, opacity: 0.8 }}>
                        {payload.employee_no || "No employee no"}
                      </div>
                    </td>

                    <td>{payload.position || "-"}</td>

                    <td>{branch ? `${branch.code} • ${branch.name}` : "-"}</td>

                    <td>
                      <span className="mono">{item.status || "Pending"}</span>
                    </td>

                    <td className="mono">{toDate10(item.created_at) || "-"}</td>

                    <td>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          className="po-mini-btn"
                          type="button"
                          onClick={() => openEditPending(item)}
                          disabled={norm(item.status) !== "pending"}
                        >
                          Edit
                        </button>

                        {canApprovePendingStaff && (
                          <>
                            <button
                              className="po-mini-btn"
                              type="button"
                              onClick={() => approvePendingStaff(item.id)}
                              disabled={!pending || approvingPendingId === item.id}
                            >
                              {approvingPendingId === item.id ? "Approving..." : "Approve"}
                            </button>

                            <button
                              className="po-mini-btn"
                              type="button"
                              onClick={() => rejectPendingStaff(item.id)}
                              disabled={!pending || rejectingPendingId === item.id}
                            >
                              {rejectingPendingId === item.id ? "Rejecting..." : "Reject"}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}