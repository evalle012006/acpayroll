import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axiosClient";
import "../styles/Deployments.css";

import StepTabs from "./Deployment/StepTabs";
import StaffDetailsStep from "./Deployment/StaffDetailsStep";
import ContractDetailsStep from "./Deployment/ContractDetailsStep";
import StaffCreateModal from "./Deployment/StaffCreateModal";
import {
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

  const department = String(
    user?.department ||
      user?.department_name ||
      user?.user_department ||
      user?.departmentName ||
      user?.dept ||
      ""
  )
    .trim()
    .toLowerCase();

  const isAdmin = role === "admin";
  const isIt = role === "it";

  const isHrDepartment = department === "hr department";
  const isAccountingDepartment = department === "accounting department";

  const canAddStaff =
    isAdmin || isIt || isHrDepartment || isAccountingDepartment;

  const canApprovePendingStaff =
    isAdmin || isIt || isHrDepartment || isAccountingDepartment;

  const [users, setUsers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [compRates, setCompRates] = useState([]);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

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

  const visiblePendingStaff = useMemo(() => {
    return (pendingStaff || []).filter((item) => norm(item.status) === "pending");
  }, [pendingStaff]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setErr("");

    try {
      const requests = [
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

      const branchesRes = results[0];
      const compRatesRes = results[1];

      const pendingRes = canApprovePendingStaff
        ? results[2]
        : { data: [] };

      const usersRes =
        isAdmin || isIt
          ? results[canApprovePendingStaff ? 3 : 2]
          : { data: [] };

      setBranches(Array.isArray(branchesRes.data) ? branchesRes.data : []);
      setCompRates(Array.isArray(compRatesRes.data) ? compRatesRes.data : []);
      setPendingStaff(Array.isArray(pendingRes.data) ? pendingRes.data : []);
      setUsers(Array.isArray(usersRes.data) ? usersRes.data : []);
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to load deployment data.");
    } finally {
      setLoading(false);
    }
  }, [isAdmin, isIt, canApprovePendingStaff]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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

  const resetAllModals = useCallback(() => {
    setShowAddStaff(false);
    setErr("");

    setEditingPending(null);
    setPendingEditStep(1);
    setPendingSaving(false);
    setPendingForm(makeEmptyPendingForm());
  }, [makeEmptyPendingForm]);

  useEffect(() => {
    const anyOpen = showAddStaff || !!editingPending;
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
  }, [showAddStaff, editingPending, resetAllModals]);

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

          <button
            className="po-btn"
            type="button"
            onClick={loadData}
            disabled={loading}
          >
            Refresh
          </button>

          {canAddStaff && (
            <button
              className="po-btn"
              type="button"
              onClick={() => setShowAddStaff(true)}
            >
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

              <button
                className="icon-btn"
                onClick={closeEditPending}
                type="button"
              >
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

                    <button
                      className="btn btn-ghost"
                      type="button"
                      onClick={closeEditPending}
                    >
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

                    <button
                      className="btn btn-primary"
                      type="submit"
                      disabled={pendingSaving}
                    >
                      {pendingSaving ? "Saving..." : "Save Changes"}
                    </button>

                    <button
                      className="btn btn-ghost"
                      type="button"
                      onClick={closeEditPending}
                    >
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
        <div
          style={{
            padding: "14px 16px",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
          }}
        >
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
                              {approvingPendingId === item.id
                                ? "Approving..."
                                : "Approve"}
                            </button>

                            <button
                              className="po-mini-btn"
                              type="button"
                              onClick={() => rejectPendingStaff(item.id)}
                              disabled={!pending || rejectingPendingId === item.id}
                            >
                              {rejectingPendingId === item.id
                                ? "Rejecting..."
                                : "Reject"}
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