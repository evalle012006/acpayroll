import React, { useMemo, useState } from "react";
import api from "../../api/axiosClient";
import StepTabs from "./StepTabs";
import StaffDetailsStep from "./StaffDetailsStep";
import ContractDetailsStep from "./ContractDetailsStep";
import { getBase, safeJsonArray, toNum, toStr } from "./deploymentUtils";

export default function StaffCreateModal({ branches, compRates = [], branchConfigMap, onClose, onCreated }) {
  useMemo(() => getBase(), []);
  const [step, setStep] = useState(1);

  const [saving, setSaving] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");

  const [form, setForm] = useState({
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

    children: JSON.stringify([{ fullname: "", date_of_birth: "", place_of_birth: "", age: "" }], null, 2),

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
    beneficiaries: JSON.stringify([{ name: "", relation: "", contact_number: "" }], null, 2),

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
  });

  const avatarUrl = () => (photoPreview ? photoPreview : "");

  const onPickPhoto = (file) => {
    setPhotoFile(file || null);
    if (!file) return setPhotoPreview("");
    const r = new FileReader();
    r.onload = () => setPhotoPreview(String(r.result || ""));
    r.readAsDataURL(file);
  };

  const canGoContract = useMemo(() => !!toStr(form.last_name) && !!toStr(form.first_name), [form.last_name, form.first_name]);
  const isContractValid = useMemo(() => !!toStr(form.position), [form.position]);

  const setStepGuarded = (next) => {
    setStep(next);
  };

  const buildPayload = () => {
    const erTotal = toNum(form.sss_er) + toNum(form.ph_er) + toNum(form.hdmf_er);
    const eeTotal = toNum(form.sss_ee) + toNum(form.ph_ee) + toNum(form.hdmf_ee);

    return {
      ...form,
      branch_id: form.branch_id ? Number(form.branch_id) : null,

      date_of_birth: form.date_of_birth || null,
      start_date: form.start_date || null,
      regularization_date: form.regularization_date || null,

      height: form.height === "" ? null : Number(form.height),
      weight: form.weight === "" ? null : Number(form.weight),

      salary: form.salary === "" ? null : Number(form.salary),
      ecola: form.ecola === "" ? null : Number(form.ecola),

      cbu: toNum(form.cbu),
      cashbond: toNum(form.cashbond),
      utility: toNum(form.utility),

      transportation: toNum(form.transportation),
      postage: toNum(form.postage),
      motorcycle_loan: toNum(form.motorcycle_loan),
      additional_target: toNum(form.additional_target),
      repairing: toNum(form.repairing),
      additional_monitoring: toNum(form.additional_monitoring),
      other_deduction: toNum(form.other_deduction),

      sss_er: toNum(form.sss_er),
      ph_er: toNum(form.ph_er),
      hdmf_er: toNum(form.hdmf_er),
      total_er: erTotal,

      sss_ee: toNum(form.sss_ee),
      ph_ee: toNum(form.ph_ee),
      hdmf_ee: toNum(form.hdmf_ee),
      total_ee: eeTotal,

      tax: toNum(form.tax),

      children: safeJsonArray(form.children),
      employment_history: safeJsonArray(form.employment_history),
      beneficiaries: safeJsonArray(form.beneficiaries),

      spouse_fullname: toStr(form.spouse_fullname) || null,
      spouse_address: toStr(form.spouse_address) || null,
      spouse_occupation: toStr(form.spouse_occupation) || null,
      spouse_employer: toStr(form.spouse_employer) || null,

      sss_no: toStr(form.sss_no) || null,
      philhealth_no: toStr(form.philhealth_no) || null,
      pagibig_no: toStr(form.pagibig_no) || null,
      tin_no: toStr(form.tin_no) || null,

      father_fullname: toStr(form.father_fullname) || null,
      father_address: toStr(form.father_address) || null,
      father_occupation: toStr(form.father_occupation) || null,
      father_employer: toStr(form.father_employer) || null,
      father_contact: toStr(form.father_contact) || null,

      mother_fullname: toStr(form.mother_fullname) || null,
      mother_address: toStr(form.mother_address) || null,
      mother_occupation: toStr(form.mother_occupation) || null,
      mother_employer: toStr(form.mother_employer) || null,
      mother_contact: toStr(form.mother_contact) || null,

      guardian_fullname: toStr(form.guardian_fullname) || null,
      guardian_address: toStr(form.guardian_address) || null,
      guardian_occupation: toStr(form.guardian_occupation) || null,
      guardian_employer: toStr(form.guardian_employer) || null,
      guardian_contact: toStr(form.guardian_contact) || null,

      primary_school_name: toStr(form.primary_school_name) || null,
      primary_year_started: toStr(form.primary_year_started) || null,
      primary_year_graduated: toStr(form.primary_year_graduated) || null,

      secondary_school_name: toStr(form.secondary_school_name) || null,
      secondary_year_started: toStr(form.secondary_year_started) || null,
      secondary_year_graduated: toStr(form.secondary_year_graduated) || null,

      tertiary_school_name: toStr(form.tertiary_school_name) || null,
      tertiary_course: toStr(form.tertiary_course) || null,
      tertiary_major: toStr(form.tertiary_major) || null,
      tertiary_year_started: toStr(form.tertiary_year_started) || null,
      tertiary_year_graduated: toStr(form.tertiary_year_graduated) || null,
    };
  };

  const submit = async (e) => {
    e.preventDefault();

    if (!canGoContract) return alert("Last Name and First Name are required.");
    if (step !== 2) return setStepGuarded(2);
    if (!isContractValid) return alert("Position is required.");

    setSaving(true);
    
    try {
      const payload = buildPayload();
      const res = await api.post("/pending-staff", payload);
      const requestId = res.data?.request?.id;

      await onCreated?.();
      onClose?.();

      alert("Submitted for approval.");
    } catch (err) { 
      alert(err?.response?.data?.message || err.message || "Failed to create staff.");
    } finally {
      setSaving(false);
    }
  };

  const miniTitle =
    `${toStr(form.last_name)}${form.last_name && form.first_name ? ", " : ""}${toStr(form.first_name)}`.trim() || "New staff";

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal staff-profile-modal" onMouseDown={(e) => e.stopPropagation()} style={{ maxWidth: 1200 }}>
        <div className="modal-head">
          <div>
            <h3>Add Staff</h3>
            <div className="mini">
              {miniTitle} • {form.position || "-"} • {form.status || "Active"}
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} type="button">
            ✕
          </button>
        </div>

        <form onSubmit={submit}>
          <div className="modal-body staff-profile-scroll">
            <div className="staff-view-top">
              {avatarUrl() ? (
                <img className="staff-avatar-lg" src={avatarUrl()} alt="staff" />
              ) : (
                <div className="staff-avatar-lg staff-avatar--fallback">
                  {toStr(form.last_name || form.first_name || "?").slice(0, 1).toUpperCase() || "?"}
                </div>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "center", marginTop: 10, marginBottom: 10 }}>
              <label className="btn btn-outline photo-upload">
                Upload Photo
                <input type="file" accept="image/*" hidden onChange={(e) => onPickPhoto(e.target.files?.[0] || null)} />
              </label>
            </div>

            <StepTabs step={step} onSelectStep={setStepGuarded} />
            <br />

            {step === 1 ? (
              <StaffDetailsStep form={form} setForm={setForm} />
            ) : (
              <ContractDetailsStep
                form={form}
                branches={branches}
                compRates={compRates}
                setForm={setForm}
                branchConfigMap={branchConfigMap}
              />
            )}
          </div>

          <div className="modal-foot">
            {step === 1 ? (
              <>
                <button className="btn btn-primary" type="button" onClick={() => setStepGuarded(2)}>
                  Next
                </button>
                <button className="btn btn-ghost" type="button" onClick={onClose}>
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button className="btn btn-outline" type="button" onClick={() => setStep(1)}>
                  Back
                </button>
                <button className="btn btn-primary" type="submit" disabled={saving}>
                  {saving ? "Submitting..." : "Submit for Approval"}
                </button>
                <button className="btn btn-ghost" type="button" onClick={onClose}>
                  Cancel
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
