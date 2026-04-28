import React, { useMemo } from "react";
import { safeJsonArray } from "./staffInfoUtils";

export default function StaffDetailsStep({ form, onChange }) {
  const childrenFormRows = useMemo(() => safeJsonArray(form.children), [form.children]);
  const educationRows = useMemo(() => safeJsonArray(form.education), [form.education]);
  const employmentRows = useMemo(() => safeJsonArray(form.employment_history), [form.employment_history]);
  const beneficiaryRows = useMemo(() => safeJsonArray(form.beneficiaries), [form.beneficiaries]);

  const setJsonField = (name, rows) => {
    onChange({ target: { name, value: JSON.stringify(Array.isArray(rows) ? rows : [], null, 2) } });
  };

  const addEducationRow = () => setJsonField("education", [...educationRows, { school: "", level: "", course: "", year_graduated: "", remarks: "" }]);
  const removeEducationRow = (index) => setJsonField("education", educationRows.filter((_, i) => i !== index));
  const updateEducationRow = (index, key, value) => { const next = [...educationRows]; next[index] = { ...next[index], [key]: value }; setJsonField("education", next); };

  const addEmploymentRow = () => setJsonField("employment_history", [...employmentRows, { company: "", position: "", year_started: "", year_ended: "", contact_number: "", character_reference: "" }]);
  const removeEmploymentRow = (index) => setJsonField("employment_history", employmentRows.filter((_, i) => i !== index));
  const updateEmploymentRow = (index, key, value) => { const next = [...employmentRows]; next[index] = { ...next[index], [key]: value }; setJsonField("employment_history", next); };

  const addBeneficiaryRow = () => setJsonField("beneficiaries", [...beneficiaryRows, { name: "", relation: "", contact_number: "" }]);
  const removeBeneficiaryRow = (index) => setJsonField("beneficiaries", beneficiaryRows.filter((_, i) => i !== index));
  const updateBeneficiaryRow = (index, key, value) => { const next = [...beneficiaryRows]; next[index] = { ...next[index], [key]: value }; setJsonField("beneficiaries", next); };

  const setChildrenFormRows = (rows) => onChange({ target: { name: "children", value: JSON.stringify(Array.isArray(rows) ? rows : [], null, 2) } });
  const addChildRow = () => setChildrenFormRows([...childrenFormRows, { fullname: "", age: "", date_of_birth: "", place_of_birth: "" }]);
  const removeChildRow = (index) => setChildrenFormRows(childrenFormRows.filter((_, i) => i !== index));

  const getAgeFromDob = (dob) => {
    if (!dob) return "";
    const birth = new Date(dob);
    if (Number.isNaN(birth.getTime())) return "";
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age >= 0 ? String(age) : "";
  };

  const updateChildRow = (index, key, value) => {
    const next = [...childrenFormRows];
    const row = { ...next[index], [key]: value };
    if (key === "date_of_birth") row.age = getAgeFromDob(value);
    next[index] = row;
    setChildrenFormRows(next);
  };

  return (
    <div className="modal-body staff-add-grid">
      <div className="staff-add-left" style={{ width: "100%" }}>
        <div className="field"><label>Employee No</label><input className="input" name="employee_no" value={form.employee_no} onChange={onChange} /></div>
        <div className="field"><label>Last Name *</label><input className="input" name="last_name" value={form.last_name} onChange={onChange} required /></div>
        <div className="field"><label>First Name *</label><input className="input" name="first_name" value={form.first_name} onChange={onChange} required /></div>
        <div className="field"><label>Middle Name</label><input className="input" name="middle_name" value={form.middle_name} onChange={onChange} /></div>
        <div className="field"><label>Address</label><input className="input" name="address" value={form.address} onChange={onChange} /></div>
        <div className="field"><label>Municipality</label><input className="input" name="municipality" value={form.municipality} onChange={onChange} /></div>
        <div className="field"><label>Province</label><input className="input" name="province" value={form.province} onChange={onChange} /></div>
        <div className="field"><label>Contact</label><input className="input" name="contact" value={form.contact} onChange={onChange} /></div>
        <div className="field"><label>Email</label><input className="input" name="email" value={form.email} onChange={onChange} /></div>
        <div className="field"><label>Date of Birth</label><input className="input" type="date" name="date_of_birth" value={form.date_of_birth} onChange={onChange} /></div>
        <div className="field"><label>Place of Birth</label><input className="input" name="place_of_birth" value={form.place_of_birth} onChange={onChange} /></div>
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
            <option value="Separated">Separated</option>
            <option value="Widowed">Widowed</option>
          </select>
        </div>
        <div className="field"><label>Citizenship</label><input className="input" name="citizenship" value={form.citizenship} onChange={onChange} /></div>
        <div className="field"><label>Height</label><input className="input" name="height" value={form.height} onChange={onChange} /></div>
        <div className="field"><label>Weight</label><input className="input" name="weight" value={form.weight} onChange={onChange} /></div>
        <div className="field"><label>Religion</label><input className="input" name="religion" value={form.religion} onChange={onChange} /></div>
        <div className="field"><label>Blood Type</label><input className="input" name="blood_type" value={form.blood_type} onChange={onChange} /></div>

        <div className="field" style={{ marginTop: 14 }}><h3 style={{ margin: 0 }}>Spouse & Family</h3></div>
        <div className="field"><label>Spouse Fullname</label><input className="input" name="spouse_fullname" value={form.spouse_fullname} onChange={onChange} /></div>
        <div className="field"><label>Spouse Address</label><input className="input" name="spouse_address" value={form.spouse_address} onChange={onChange} /></div>
        <div className="field"><label>Spouse Occupation</label><input className="input" name="spouse_occupation" value={form.spouse_occupation} onChange={onChange} /></div>
        <div className="field"><label>Spouse Employer</label><input className="input" name="spouse_employer" value={form.spouse_employer} onChange={onChange} /></div>

        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <label style={{ margin: 0 }}>Children</label>
            <button type="button" className="btn" onClick={addChildRow}>+ Add Child</button>
          </div>
          {!childrenFormRows.length ? (
            <div style={{ padding: "14px", border: "1px dashed rgba(255,255,255,0.2)", borderRadius: 12, opacity: 0.8 }}>No children added yet.</div>
          ) : (
            childrenFormRows.map((child, index) => (
              <div key={index} style={{ border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, padding: 14, marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                  <strong>Child #{index + 1}</strong>
                  <button type="button" className="btn" onClick={() => removeChildRow(index)}>Remove</button>
                </div>
                <div className="form-grid">
                  <div className="field"><label>Fullname</label><input className="input" value={child.fullname || ""} onChange={(e) => updateChildRow(index, "fullname", e.target.value)} /></div>
                  <div className="field"><label>Age</label><input className="input" value={child.age || ""} onChange={(e) => updateChildRow(index, "age", e.target.value)} /></div>
                  <div className="field"><label>Date of Birth</label><input type="date" className="input" value={child.date_of_birth || ""} onChange={(e) => updateChildRow(index, "date_of_birth", e.target.value)} /></div>
                  <div className="field"><label>Place of Birth</label><input className="input" value={child.place_of_birth || ""} onChange={(e) => updateChildRow(index, "place_of_birth", e.target.value)} /></div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="field" style={{ marginTop: 14 }}><h3 style={{ margin: 0 }}>Parents / Guardian</h3></div>
        <div className="field"><label>Father Fullname</label><input className="input" name="father_fullname" value={form.father_fullname} onChange={onChange} /></div>
        <div className="field"><label>Father Address</label><input className="input" name="father_address" value={form.father_address} onChange={onChange} /></div>
        <div className="field"><label>Father Occupation</label><input className="input" name="father_occupation" value={form.father_occupation} onChange={onChange} /></div>
        <div className="field"><label>Father Employer</label><input className="input" name="father_employer" value={form.father_employer} onChange={onChange} /></div>
        <div className="field"><label>Father Contact</label><input className="input" name="father_contact" value={form.father_contact} onChange={onChange} /></div>
        <div className="field"><label>Mother Fullname</label><input className="input" name="mother_fullname" value={form.mother_fullname} onChange={onChange} /></div>
        <div className="field"><label>Mother Address</label><input className="input" name="mother_address" value={form.mother_address} onChange={onChange} /></div>
        <div className="field"><label>Mother Occupation</label><input className="input" name="mother_occupation" value={form.mother_occupation} onChange={onChange} /></div>
        <div className="field"><label>Mother Employer</label><input className="input" name="mother_employer" value={form.mother_employer} onChange={onChange} /></div>
        <div className="field"><label>Mother Contact</label><input className="input" name="mother_contact" value={form.mother_contact} onChange={onChange} /></div>
        <div className="field"><label>Guardian Fullname</label><input className="input" name="guardian_fullname" value={form.guardian_fullname} onChange={onChange} /></div>
        <div className="field"><label>Guardian Address</label><input className="input" name="guardian_address" value={form.guardian_address} onChange={onChange} /></div>
        <div className="field"><label>Guardian Occupation</label><input className="input" name="guardian_occupation" value={form.guardian_occupation} onChange={onChange} /></div>
        <div className="field"><label>Guardian Employer</label><input className="input" name="guardian_employer" value={form.guardian_employer} onChange={onChange} /></div>
        <div className="field"><label>Guardian Contact</label><input className="input" name="guardian_contact" value={form.guardian_contact} onChange={onChange} /></div>

        <div className="field full" style={{ marginTop: 14 }}><h3 style={{ margin: 0 }}>Background</h3></div>

        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <label style={{ margin: 0 }}>Education</label>
            <button type="button" className="btn" onClick={addEducationRow}>+ Add Education</button>
          </div>
          {!educationRows.length ? (
            <div style={{ padding: "14px", border: "1px dashed rgba(255,255,255,0.2)", borderRadius: 12, opacity: 0.8 }}>No education added yet.</div>
          ) : (
            educationRows.map((row, index) => (
              <div key={index} style={{ border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, padding: 14, marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                  <strong>Education #{index + 1}</strong>
                  <button type="button" className="btn" onClick={() => removeEducationRow(index)}>Remove</button>
                </div>
                <div className="form-grid">
                  <div className="field"><label>School</label><input className="input" value={row.school || ""} onChange={(e) => updateEducationRow(index, "school", e.target.value)} /></div>
                  <div className="field"><label>Level</label><input className="input" value={row.level || ""} onChange={(e) => updateEducationRow(index, "level", e.target.value)} /></div>
                  <div className="field"><label>Course</label><input className="input" value={row.course || ""} onChange={(e) => updateEducationRow(index, "course", e.target.value)} /></div>
                  <div className="field"><label>Year Graduated</label><input className="input" value={row.year_graduated || ""} onChange={(e) => updateEducationRow(index, "year_graduated", e.target.value)} /></div>
                  <div className="field" style={{ gridColumn: "1 / -1" }}><label>Remarks</label><input className="input" value={row.remarks || ""} onChange={(e) => updateEducationRow(index, "remarks", e.target.value)} /></div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <label style={{ margin: 0 }}>Employment History</label>
            <button type="button" className="btn" onClick={addEmploymentRow}>+ Add Employment</button>
          </div>
          {!employmentRows.length ? (
            <div style={{ padding: "14px", border: "1px dashed rgba(255,255,255,0.2)", borderRadius: 12, opacity: 0.8 }}>No employment history added yet.</div>
          ) : (
            employmentRows.map((row, index) => (
              <div key={index} style={{ border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, padding: 14, marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                  <strong>Employment #{index + 1}</strong>
                  <button type="button" className="btn" onClick={() => removeEmploymentRow(index)}>Remove</button>
                </div>
                <div className="form-grid">
                  <div className="field"><label>Company</label><input className="input" value={row.company || ""} onChange={(e) => updateEmploymentRow(index, "company", e.target.value)} /></div>
                  <div className="field"><label>Position</label><input className="input" value={row.position || ""} onChange={(e) => updateEmploymentRow(index, "position", e.target.value)} /></div>
                  <div className="field"><label>Year Started</label><input className="input" value={row.year_started || ""} onChange={(e) => updateEmploymentRow(index, "year_started", e.target.value)} /></div>
                  <div className="field"><label>Year Ended</label><input className="input" value={row.year_ended || ""} onChange={(e) => updateEmploymentRow(index, "year_ended", e.target.value)} /></div>
                  <div className="field"><label>Contact Number</label><input className="input" value={row.contact_number || ""} onChange={(e) => updateEmploymentRow(index, "contact_number", e.target.value)} /></div>
                  <div className="field"><label>Character Reference</label><input className="input" value={row.character_reference || ""} onChange={(e) => updateEmploymentRow(index, "character_reference", e.target.value)} /></div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <label style={{ margin: 0 }}>Beneficiaries</label>
            <button type="button" className="btn" onClick={addBeneficiaryRow}>+ Add Beneficiary</button>
          </div>
          {!beneficiaryRows.length ? (
            <div style={{ padding: "14px", border: "1px dashed rgba(255,255,255,0.2)", borderRadius: 12, opacity: 0.8 }}>No beneficiaries added yet.</div>
          ) : (
            beneficiaryRows.map((row, index) => (
              <div key={index} style={{ border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, padding: 14, marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                  <strong>Beneficiary #{index + 1}</strong>
                  <button type="button" className="btn" onClick={() => removeBeneficiaryRow(index)}>Remove</button>
                </div>
                <div className="form-grid">
                  <div className="field"><label>Name</label><input className="input" value={row.name || ""} onChange={(e) => updateBeneficiaryRow(index, "name", e.target.value)} /></div>
                  <div className="field"><label>Relation</label><input className="input" value={row.relation || ""} onChange={(e) => updateBeneficiaryRow(index, "relation", e.target.value)} /></div>
                  <div className="field"><label>Contact Number</label><input className="input" value={row.contact_number || ""} onChange={(e) => updateBeneficiaryRow(index, "contact_number", e.target.value)} /></div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="field" style={{ marginTop: 14 }}><h3 style={{ margin: 0 }}>Remittances IDs</h3></div>
        <div className="field"><label>SSS No.</label><input className="input" name="sss_no" value={form.sss_no} onChange={onChange} /></div>
        <div className="field"><label>PhilHealth No.</label><input className="input" name="philhealth_no" value={form.philhealth_no} onChange={onChange} /></div>
        <div className="field"><label>Pag-IBIG No.</label><input className="input" name="pagibig_no" value={form.pagibig_no} onChange={onChange} /></div>
        <div className="field"><label>TIN No.</label><input className="input" name="tin_no" value={form.tin_no} onChange={onChange} /></div>
      </div>
    </div>
  );
}
