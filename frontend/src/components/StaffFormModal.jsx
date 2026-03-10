import React, { useMemo, useState } from "react";

const toStr = (v) => String(v ?? "").trim();

const toNum = (v) => {
  const s = String(v ?? "").trim();
  if (!s) return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

const displayFormName = (form) => {
  const ln = toStr(form?.last_name);
  const fn = toStr(form?.first_name);
  const mn = toStr(form?.middle_name);
  const built = `${ln}${ln && fn ? ", " : ""}${fn}${mn ? ` ${mn}` : ""}`.replace(/\s+/g, " ").trim();
  return built || "New staff";
};

function StepTabs({ step, onSelectStep, canGoContract }) {
  return (
    <div className="step-tabs">
      <button type="button" className={`step-tab ${step === 1 ? "active" : ""}`} onClick={() => onSelectStep(1)}>
        Staff Details
      </button>

      <button
        type="button"
        className={`step-tab ${step === 2 ? "active" : ""}`}
        onClick={() => onSelectStep(2)}
        disabled={!canGoContract}
        title={!canGoContract ? "Complete Staff Details first" : ""}
      >
        Contract Details
      </button>
    </div>
  );
}

function StaffDetailsStep({ form, onChange }) {
  return (
    <div className="modal-body staff-add-grid">
      <div className="staff-add-left" style={{ width: "100%" }}>
        <div className="field">
          <label>Employee No</label>
          <input className="input" name="employee_no" value={form.employee_no} onChange={onChange} />
        </div>

        <div className="field">
          <label>Last Name *</label>
          <input className="input" name="last_name" value={form.last_name} onChange={onChange} required />
        </div>

        <div className="field">
          <label>First Name *</label>
          <input className="input" name="first_name" value={form.first_name} onChange={onChange} required />
        </div>

        <div className="field">
          <label>Middle Name</label>
          <input className="input" name="middle_name" value={form.middle_name} onChange={onChange} />
        </div>

        <div className="field">
          <label>Address</label>
          <input className="input" name="address" value={form.address} onChange={onChange} />
        </div>

        <div className="field">
          <label>Municipality</label>
          <input className="input" name="municipality" value={form.municipality} onChange={onChange} />
        </div>

        <div className="field">
          <label>Province</label>
          <input className="input" name="province" value={form.province} onChange={onChange} />
        </div>

        <div className="field">
          <label>Contact</label>
          <input className="input" name="contact" value={form.contact} onChange={onChange} />
        </div>

        <div className="field">
          <label>Email</label>
          <input className="input" name="email" value={form.email} onChange={onChange} />
        </div>

        <div className="field">
          <label>Date of Birth</label>
          <input className="input" type="date" name="date_of_birth" value={form.date_of_birth} onChange={onChange} />
        </div>

        <div className="field">
          <label>Place of Birth</label>
          <input className="input" name="place_of_birth" value={form.place_of_birth} onChange={onChange} />
        </div>

        <div className="field">
          <label>Gender</label>
          <select className="input" name="gender" value={form.gender} onChange={onChange}>
            <option value="">Select...</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Prefer not to say">Prefer not to say</option>
          </select>
        </div>

        <div className="field">
          <label>Civil Status</label>
          <select className="input" name="civil_status" value={form.civil_status} onChange={onChange}>
            <option value="">Select...</option>
            <option value="Single">Single</option>
            <option value="Married">Married</option>
            <option value="Separated">Complicated</option>
            <option value="Widowed">Widowed</option>
          </select>
        </div>

        <div className="field">
          <label>Citizenship</label>
          <input className="input" name="citizenship" value={form.citizenship} onChange={onChange} />
        </div>

        <div className="field">
          <label>Height</label>
          <input className="input" name="height" value={form.height} onChange={onChange} placeholder="e.g., 170" />
        </div>

        <div className="field">
          <label>Weight</label>
          <input className="input" name="weight" value={form.weight} onChange={onChange} placeholder="e.g., 65" />
        </div>

        <div className="field">
          <label>Religion</label>
          <input className="input" name="religion" value={form.religion} onChange={onChange} />
        </div>

        <div className="field">
          <label>Blood Type</label>
          <input className="input" name="blood_type" value={form.blood_type} onChange={onChange} placeholder="e.g., O+" />
        </div>
      </div>
    </div>
  );
}

function ContractDetailsStep({ form, branches, onChange }) {
  return (
    <div className="modal-body staff-add-grid">
      <div className="staff-add-left" style={{ width: "100%" }}>
        <div className="field">
          <label>Position *</label>
          <input className="input" name="position" value={form.position} onChange={onChange} required />
        </div>

        <div className="field">
          <label>Department</label>
          <input className="input" name="department" value={form.department} onChange={onChange} />
        </div>

        <div className="field">
          <label>Area</label>
          <input className="input" name="area" value={form.area} onChange={onChange} />
        </div>

        <div className="field">
          <label>Region</label>
          <input className="input" name="region" value={form.region} onChange={onChange} />
        </div>

        <div className="field">
          <label>Division</label>
          <input className="input" name="division" value={form.division} onChange={onChange} />
        </div>

        <div className="field">
          <label>Branch</label>
          <select className="input" name="branch_id" value={form.branch_id} onChange={onChange}>
            <option value="">Select branch...</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Status</label>
          <select className="input" name="status" value={form.status} onChange={onChange}>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>

        <div className="field">
          <label>Start Date</label>
          <input className="input" name="start_date" type="date" value={form.start_date} onChange={onChange} />
        </div>

        <div className="field">
          <label>Regularization Date</label>
          <input className="input" name="regularization_date" type="date" value={form.regularization_date} onChange={onChange} />
        </div>
      </div>
    </div>
  );
}

export default function StaffFormModal({
  open,
  mode = "add",
  branches = [],
  initial = null,
  photoPreviewInitial = "",
  onClose,
  onSubmit,
}) {
  const [saving, setSaving] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(photoPreviewInitial || "");
  const [formStep, setFormStep] = useState(1);

  const [form, setForm] = useState(() => ({
    employee_no: initial?.employee_no || "",
    last_name: initial?.last_name || "",
    first_name: initial?.first_name || "",
    middle_name: initial?.middle_name || "",

    address: String(initial?.address ?? ""),
    municipality: String(initial?.municipality ?? ""),
    province: String(initial?.province ?? ""),
    contact: String(initial?.contact ?? ""),
    email: String(initial?.email ?? ""),
    date_of_birth: initial?.date_of_birth ? String(initial.date_of_birth).split("T")[0] : "",
    place_of_birth: String(initial?.place_of_birth ?? ""),
    gender: String(initial?.gender ?? ""),
    civil_status: String(initial?.civil_status ?? ""),
    citizenship: String(initial?.citizenship ?? ""),
    height: String(initial?.height ?? ""),
    weight: String(initial?.weight ?? ""),
    religion: String(initial?.religion ?? ""),
    blood_type: String(initial?.blood_type ?? ""),

    position: initial?.position || "",
    department: initial?.department || "",
    area: String(initial?.area ?? ""),
    region: String(initial?.region ?? ""),
    division: String(initial?.division ?? ""),
    branch_id: String(initial?.branch_id ?? ""),
    status: String(initial?.status || "Active"),

    start_date: initial?.start_date ? String(initial.start_date).split("T")[0] : "",
    regularization_date: initial?.regularization_date ? String(initial.regularization_date).split("T")[0] : "",

    cbu: String(initial?.cbu ?? ""),
    cashbond: String(initial?.cashbond ?? ""),
    utility: String(initial?.utility_charge ?? initial?.utility ?? ""),

    transportation: String(initial?.transportation ?? ""),
    postage: String(initial?.postage ?? ""),
    motorcycle_loan: String(initial?.motorcycle_loan ?? ""),
    additional_target: String(initial?.additional_target ?? ""),
    repairing: String(initial?.repairing ?? ""),
    additional_monitoring: String(initial?.additional_monitoring ?? ""),
    motorcycle: String(initial?.motorcycle ?? ""),
    other_deduction: String(initial?.other_deduction ?? ""),
  }));

  const isStaffStepValid = useMemo(() => !!toStr(form.last_name) && !!toStr(form.first_name), [form.last_name, form.first_name]);
  const isContractStepValid = useMemo(() => !!toStr(form.position), [form.position]);

  const setStepGuarded = (nextStep) => {
    if (nextStep === 2 && !isStaffStepValid) return alert("Please complete required fields in Staff Details (Last Name, First Name).");
    setFormStep(nextStep);
  };

  const onChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const onPickPhoto = (file) => {
    setPhotoFile(file || null);
    if (!file) return setPhotoPreview("");
    const r = new FileReader();
    r.onload = () => setPhotoPreview(String(r.result || ""));
    r.readAsDataURL(file);
  };

  const buildPayload = () => ({
    ...form,
    branch_id: form.branch_id ? Number(form.branch_id) : null,
    date_of_birth: form.date_of_birth || null,
    start_date: form.start_date || null,
    regularization_date: form.regularization_date || null,
    height: form.height === "" ? null : Number(form.height),
    weight: form.weight === "" ? null : Number(form.weight),

    cbu: toNum(form.cbu),
    cashbond: toNum(form.cashbond),
    utility: toNum(form.utility),

    transportation: toNum(form.transportation),
    postage: toNum(form.postage),
    motorcycle_loan: toNum(form.motorcycle_loan),
    additional_target: toNum(form.additional_target),
    repairing: toNum(form.repairing),
    additional_monitoring: toNum(form.additional_monitoring),
    motorcycle: toNum(form.motorcycle),
    other_deduction: toNum(form.other_deduction),
  });

  const submit = async (e) => {
    e.preventDefault();

    if (!isStaffStepValid) {
      setFormStep(1);
      return alert("Please complete required fields in Staff Details (Last Name, First Name).");
    }
    if (formStep !== 2) return setFormStep(2);
    if (!isContractStepValid) return alert("Position is required in Contract Details.");

    setSaving(true);
    try {
      await onSubmit({ payload: buildPayload(), photoFile });
      onClose?.();
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal staff-profile-modal" onMouseDown={(e) => e.stopPropagation()} style={{ maxWidth: 1200 }}>
        <div className="modal-head">
          <div>
            <h3>{mode === "edit" ? "Edit Staff" : "Add Staff"}</h3>
            <div className="mini">
              {displayFormName(form)} • {form.position || "-"} • {form.status || "Active"}
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} type="button">
            ✕
          </button>
        </div>

        <form onSubmit={submit}>
          <div className="modal-body staff-profile-scroll">
            <div className="staff-view-top">
              {photoPreview ? (
                <img className="staff-avatar-lg" src={photoPreview} alt="staff" />
              ) : (
                <div className="staff-avatar-lg staff-avatar--fallback">
                  {(toStr(form.last_name || form.first_name || "?").slice(0, 1).toUpperCase() || "?")}
                </div>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "center", marginTop: 10, marginBottom: 10 }}>
              <label className="btn btn-outline photo-upload">
                Upload Photo
                <input type="file" accept="image/*" hidden onChange={(e) => onPickPhoto(e.target.files?.[0] || null)} />
              </label>
            </div>

            <StepTabs step={formStep} onSelectStep={setStepGuarded} canGoContract={isStaffStepValid} />
            <br />

            {formStep === 1 ? (
              <StaffDetailsStep form={form} onChange={onChange} />
            ) : (
              <ContractDetailsStep form={form} branches={branches} onChange={onChange} />
            )}
          </div>

          <div className="modal-foot">
            {formStep === 1 ? (
              <>
                <button className="btn btn-primary" type="button" onClick={() => setStepGuarded(2)} disabled={!isStaffStepValid}>
                  Next
                </button>
                <button className="btn btn-ghost" type="button" onClick={onClose}>
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button className="btn btn-outline" type="button" onClick={() => setFormStep(1)}>
                  Back
                </button>
                <button className="btn btn-primary" type="submit" disabled={saving}>
                  {saving ? (mode === "edit" ? "Updating..." : "Saving...") : mode === "edit" ? "Update Staff" : "Save Staff"}
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