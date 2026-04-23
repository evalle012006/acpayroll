import React, { useCallback, useEffect, useMemo, useState } from "react";
import "../styles/StaffInformation.css";
import api from "../api/axiosClient";

const safeJsonArray = (v) => {
  try {
    const parsed = typeof v === "string" ? JSON.parse(v) : v;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const jsonText = (v) => {
  try {
    return JSON.stringify(Array.isArray(v) ? v : [], null, 2);
  } catch {
    return "[]";
  }
};

const toStr = (v) => String(v ?? "").trim();
const norm = (v) => toStr(v).toLowerCase();

const fmtDate = (d) => {
  if (!d) return "-";
  const s = String(d);
  return s.includes("T") ? s.split("T")[0] : s.slice(0, 10);
};

const toNum = (v) => {
  const s = String(v ?? "").trim();
  if (!s) return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

const money = (v) =>
  toNum(v).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

const getBase = () => {
  const base = api.defaults.baseURL || "";
  return base.endsWith("/api") ? base.slice(0, -4) : base;
};

const displayName = (s) => {
  const ln = toStr(s?.last_name);
  const fn = toStr(s?.first_name);
  const mn = toStr(s?.middle_name);
  if (ln || fn || mn) {
    return `${ln}${ln && fn ? ", " : ""}${fn}${mn ? ` ${mn}` : ""}`.replace(/\s+/g, " ").trim();
  }
  return toStr(s?.fullname) || "-";
};

const displayFormName = (form) => {
  const ln = toStr(form?.last_name);
  const fn = toStr(form?.first_name);
  const mn = toStr(form?.middle_name);
  const built = `${ln}${ln && fn ? ", " : ""}${fn}${mn ? ` ${mn}` : ""}`.replace(/\s+/g, " ").trim();
  return built || "New staff";
};

const loanDisplayDate = (l) =>
  l?.entry_date || l?.approved_at || l?.disbursement_date || l?.created_at || l?.updated_at || null;

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const compute13thMonthBreakdown = (staff) => {
  const basicSalary = toNum(staff?.salary);
  const ecola = toNum(staff?.ecola);
  const monthlyCompensation = basicSalary + ecola;

  const startDateRaw = staff?.start_date;
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthIndex = now.getMonth();

  if (!monthlyCompensation) {
    return {
      year: currentYear,
      rows: MONTH_NAMES.map((month) => ({
        month,
        amount: null,
        eligible: false,
        passed: false,
      })),
      totalCompensationEarned: 0,
      thirteenthMonth: 0,
      fourteenthMonth: 0,
      fifteenthMonth: 0,
      monthlyCompensation: 0,
      basicSalary: 0,
      ecola: 0,
    };
  }

  let startDate = null;
  if (startDateRaw) {
    const d = new Date(startDateRaw);
    if (!Number.isNaN(d.getTime())) startDate = d;
  }

  const rows = MONTH_NAMES.map((month, index) => {
    let eligible = true;

    if (startDate) {
      const startYear = startDate.getFullYear();
      const startMonth = startDate.getMonth();

      if (startYear > currentYear) {
        eligible = false;
      } else if (startYear === currentYear && index < startMonth) {
        eligible = false;
      }
    }

    const passed = index <= currentMonthIndex;
    const showValue = eligible && passed;

    return {
      month,
      amount: showValue ? monthlyCompensation : null,
      eligible,
      passed,
    };
  });

  const totalCompensationEarned = rows.reduce((sum, row) => {
    return sum + (row.amount != null ? row.amount : 0);
  }, 0);

  const equivalent = totalCompensationEarned / 12;

  return {
    year: currentYear,
    rows,
    totalCompensationEarned,
    thirteenthMonth: equivalent,
    fourteenthMonth: equivalent,
    fifteenthMonth: equivalent,
    monthlyCompensation,
    basicSalary,
    ecola,
  };
};

function StepTabs({ step, onSelectStep, canGoContract, canGoBalances }) {
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

      <button
        type="button"
        className={`step-tab ${step === 3 ? "active" : ""}`}
        onClick={() => onSelectStep(3)}
        disabled={!canGoBalances}
        title={!canGoBalances ? "Complete Contract Details first" : ""}
      >
        Personal Balances
      </button>
    </div>
  );
}

function StaffDetailsStep({ form, onChange }) {

    const childrenFormRows = useMemo(() => safeJsonArray(form.children), [form.children]);
      const educationRows = useMemo(() => safeJsonArray(form.education), [form.education]);
      const employmentRows = useMemo(() => safeJsonArray(form.employment_history), [form.employment_history]);
      const beneficiaryRows = useMemo(() => safeJsonArray(form.beneficiaries), [form.beneficiaries]);

      const setJsonField = (name, rows) => {
        onChange({
          target: {
            name,
            value: JSON.stringify(Array.isArray(rows) ? rows : [], null, 2),
          },
        });
      };

      const addEducationRow = () => {
        setJsonField("education", [
          ...educationRows,
          {
            school: "",
            level: "",
            course: "",
            year_graduated: "",
            remarks: "",
          },
        ]);
      };

      const removeEducationRow = (index) => {
        setJsonField(
          "education",
          educationRows.filter((_, i) => i !== index)
        );
      };

      const updateEducationRow = (index, key, value) => {
        const next = [...educationRows];
        next[index] = {
          ...next[index],
          [key]: value,
        };
        setJsonField("education", next);
      };

      const addEmploymentRow = () => {
        setJsonField("employment_history", [
          ...employmentRows,
          {
            company: "",
            position: "",
            year_started: "",
            year_ended: "",
            contact_number: "",
            character_reference: "",
          },
        ]);
      };

      const removeEmploymentRow = (index) => {
        setJsonField(
          "employment_history",
          employmentRows.filter((_, i) => i !== index)
        );
      };

      const updateEmploymentRow = (index, key, value) => {
        const next = [...employmentRows];
        next[index] = {
          ...next[index],
          [key]: value,
        };
        setJsonField("employment_history", next);
      };

      const addBeneficiaryRow = () => {
        setJsonField("beneficiaries", [
          ...beneficiaryRows,
          {
            name: "",
            relation: "",
            contact_number: "",
          },
        ]);
      };

      const removeBeneficiaryRow = (index) => {
        setJsonField(
          "beneficiaries",
          beneficiaryRows.filter((_, i) => i !== index)
        );
      };

      const updateBeneficiaryRow = (index, key, value) => {
        const next = [...beneficiaryRows];
        next[index] = {
          ...next[index],
          [key]: value,
        };
        setJsonField("beneficiaries", next);
      };

    const setChildrenFormRows = (rows) => {
      onChange({
        target: {
          name: "children",
          value: JSON.stringify(Array.isArray(rows) ? rows : [], null, 2),
        },
      });
    };

    const addChildRow = () => {
      setChildrenFormRows([
        ...childrenFormRows,
        {
          fullname: "",
          age: "",
          date_of_birth: "",
          place_of_birth: "",
        },
      ]);
    };

    const removeChildRow = (index) => {
      setChildrenFormRows(childrenFormRows.filter((_, i) => i !== index));
    };

    const getAgeFromDob = (dob) => {
      if (!dob) return "";
      const birth = new Date(dob);
      if (Number.isNaN(birth.getTime())) return "";

      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();

      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
        age--;
      }

      return age >= 0 ? String(age) : "";
    };

    const updateChildRow = (index, key, value) => {
      const next = [...childrenFormRows];
      const row = { ...next[index], [key]: value };

      if (key === "date_of_birth") {
        row.age = getAgeFromDob(value);
      }

      next[index] = row;
      setChildrenFormRows(next);
    };

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
            <option value="Separated">Separated</option>
            <option value="Widowed">Widowed</option>
          </select>
        </div>

        <div className="field">
          <label>Citizenship</label>
          <input className="input" name="citizenship" value={form.citizenship} onChange={onChange} />
        </div>

        <div className="field">
          <label>Height</label>
          <input className="input" name="height" value={form.height} onChange={onChange} />
        </div>

        <div className="field">
          <label>Weight</label>
          <input className="input" name="weight" value={form.weight} onChange={onChange} />
        </div>

        <div className="field">
          <label>Religion</label>
          <input className="input" name="religion" value={form.religion} onChange={onChange} />
        </div>

        <div className="field">
          <label>Blood Type</label>
          <input className="input" name="blood_type" value={form.blood_type} onChange={onChange} />
        </div>

        <div className="field" style={{ marginTop: 14 }}>
          <h3 style={{ margin: 0 }}>Spouse & Family</h3>
        </div>

        <div className="field">
          <label>Spouse Fullname</label>
          <input className="input" name="spouse_fullname" value={form.spouse_fullname} onChange={onChange} />
        </div>

        <div className="field">
          <label>Spouse Address</label>
          <input className="input" name="spouse_address" value={form.spouse_address} onChange={onChange} />
        </div>

        <div className="field">
          <label>Spouse Occupation</label>
          <input className="input" name="spouse_occupation" value={form.spouse_occupation} onChange={onChange} />
        </div>

        <div className="field">
          <label>Spouse Employer</label>
          <input className="input" name="spouse_employer" value={form.spouse_employer} onChange={onChange} />
        </div>

        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 10,
            }}
          >
            <label style={{ margin: 0 }}>Children</label>
            <button type="button" className="btn" onClick={addChildRow}>
              + Add Child
            </button>
          </div>

          {!childrenFormRows.length ? (
            <div
              style={{
                padding: "14px",
                border: "1px dashed rgba(255,255,255,0.2)",
                borderRadius: 12,
                opacity: 0.8,
              }}
            >
              No children added yet.
            </div>
          ) : (
            childrenFormRows.map((child, index) => (
              <div
                key={index}
                style={{
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 14,
                  padding: 14,
                  marginBottom: 12,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                  <strong>Child #{index + 1}</strong>
                  <button type="button" className="btn" onClick={() => removeChildRow(index)}>
                    Remove
                  </button>
                </div>

                <div className="form-grid">
                  <div className="field">
                    <label>Fullname</label>
                    <input
                      className="input"
                      value={child.fullname || ""}
                      onChange={(e) => updateChildRow(index, "fullname", e.target.value)}
                    />
                  </div>

                  <div className="field">
                    <label>Age</label>
                    <input
                      className="input"
                      value={child.age || ""}
                      onChange={(e) => updateChildRow(index, "age", e.target.value)}
                    />
                  </div>

                  <div className="field">
                    <label>Date of Birth</label>
                    <input
                      type="date"
                      className="input"
                      value={child.date_of_birth || ""}
                      onChange={(e) => updateChildRow(index, "date_of_birth", e.target.value)}
                    />
                  </div>

                  <div className="field">
                    <label>Place of Birth</label>
                    <input
                      className="input"
                      value={child.place_of_birth || ""}
                      onChange={(e) => updateChildRow(index, "place_of_birth", e.target.value)}
                    />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="field" style={{ marginTop: 14 }}>
          <h3 style={{ margin: 0 }}>Parents / Guardian</h3>
        </div>

        <div className="field">
          <label>Father Fullname</label>
          <input className="input" name="father_fullname" value={form.father_fullname} onChange={onChange} />
        </div>
        <div className="field">
          <label>Father Address</label>
          <input className="input" name="father_address" value={form.father_address} onChange={onChange} />
        </div>
        <div className="field">
          <label>Father Occupation</label>
          <input className="input" name="father_occupation" value={form.father_occupation} onChange={onChange} />
        </div>
        <div className="field">
          <label>Father Employer</label>
          <input className="input" name="father_employer" value={form.father_employer} onChange={onChange} />
        </div>
        <div className="field">
          <label>Father Contact</label>
          <input className="input" name="father_contact" value={form.father_contact} onChange={onChange} />
        </div>

        <div className="field">
          <label>Mother Fullname</label>
          <input className="input" name="mother_fullname" value={form.mother_fullname} onChange={onChange} />
        </div>
        <div className="field">
          <label>Mother Address</label>
          <input className="input" name="mother_address" value={form.mother_address} onChange={onChange} />
        </div>
        <div className="field">
          <label>Mother Occupation</label>
          <input className="input" name="mother_occupation" value={form.mother_occupation} onChange={onChange} />
        </div>
        <div className="field">
          <label>Mother Employer</label>
          <input className="input" name="mother_employer" value={form.mother_employer} onChange={onChange} />
        </div>
        <div className="field">
          <label>Mother Contact</label>
          <input className="input" name="mother_contact" value={form.mother_contact} onChange={onChange} />
        </div>

        <div className="field">
          <label>Guardian Fullname</label>
          <input className="input" name="guardian_fullname" value={form.guardian_fullname} onChange={onChange} />
        </div>
        <div className="field">
          <label>Guardian Address</label>
          <input className="input" name="guardian_address" value={form.guardian_address} onChange={onChange} />
        </div>
        <div className="field">
          <label>Guardian Occupation</label>
          <input className="input" name="guardian_occupation" value={form.guardian_occupation} onChange={onChange} />
        </div>
        <div className="field">
          <label>Guardian Employer</label>
          <input className="input" name="guardian_employer" value={form.guardian_employer} onChange={onChange} />
        </div>
        <div className="field">
          <label>Guardian Contact</label>
          <input className="input" name="guardian_contact" value={form.guardian_contact} onChange={onChange} />
        </div>

        <div className="field full" style={{ marginTop: 14 }}>
          <h3 style={{ margin: 0 }}>Background</h3>
        </div>

        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 10,
            }}
          >
            <label style={{ margin: 0 }}>Education</label>
            <button type="button" className="btn" onClick={addEducationRow}>
              + Add Education
            </button>
          </div>

          {!educationRows.length ? (
            <div
              style={{
                padding: "14px",
                border: "1px dashed rgba(255,255,255,0.2)",
                borderRadius: 12,
                opacity: 0.8,
              }}
            >
              No education added yet.
            </div>
          ) : (
            educationRows.map((row, index) => (
              <div
                key={index}
                style={{
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 14,
                  padding: 14,
                  marginBottom: 12,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                  <strong>Education #{index + 1}</strong>
                  <button type="button" className="btn" onClick={() => removeEducationRow(index)}>
                    Remove
                  </button>
                </div>

                <div className="form-grid">
                  <div className="field">
                    <label>School</label>
                    <input
                      className="input"
                      value={row.school || ""}
                      onChange={(e) => updateEducationRow(index, "school", e.target.value)}
                    />
                  </div>

                  <div className="field">
                    <label>Level</label>
                    <input
                      className="input"
                      value={row.level || ""}
                      onChange={(e) => updateEducationRow(index, "level", e.target.value)}
                    />
                  </div>

                  <div className="field">
                    <label>Course</label>
                    <input
                      className="input"
                      value={row.course || ""}
                      onChange={(e) => updateEducationRow(index, "course", e.target.value)}
                    />
                  </div>

                  <div className="field">
                    <label>Year Graduated</label>
                    <input
                      className="input"
                      value={row.year_graduated || ""}
                      onChange={(e) => updateEducationRow(index, "year_graduated", e.target.value)}
                    />
                  </div>

                  <div className="field" style={{ gridColumn: "1 / -1" }}>
                    <label>Remarks</label>
                    <input
                      className="input"
                      value={row.remarks || ""}
                      onChange={(e) => updateEducationRow(index, "remarks", e.target.value)}
                    />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 10,
            }}
          >
            <label style={{ margin: 0 }}>Employment History</label>
            <button type="button" className="btn" onClick={addEmploymentRow}>
              + Add Employment
            </button>
          </div>

          {!employmentRows.length ? (
            <div
              style={{
                padding: "14px",
                border: "1px dashed rgba(255,255,255,0.2)",
                borderRadius: 12,
                opacity: 0.8,
              }}
            >
              No employment history added yet.
            </div>
          ) : (
            employmentRows.map((row, index) => (
              <div
                key={index}
                style={{
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 14,
                  padding: 14,
                  marginBottom: 12,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                  <strong>Employment #{index + 1}</strong>
                  <button type="button" className="btn" onClick={() => removeEmploymentRow(index)}>
                    Remove
                  </button>
                </div>

                <div className="form-grid">
                  <div className="field">
                    <label>Company</label>
                    <input
                      className="input"
                      value={row.company || ""}
                      onChange={(e) => updateEmploymentRow(index, "company", e.target.value)}
                    />
                  </div>

                  <div className="field">
                    <label>Position</label>
                    <input
                      className="input"
                      value={row.position || ""}
                      onChange={(e) => updateEmploymentRow(index, "position", e.target.value)}
                    />
                  </div>

                  <div className="field">
                    <label>Year Started</label>
                    <input
                      className="input"
                      value={row.year_started || ""}
                      onChange={(e) => updateEmploymentRow(index, "year_started", e.target.value)}
                    />
                  </div>

                  <div className="field">
                    <label>Year Ended</label>
                    <input
                      className="input"
                      value={row.year_ended || ""}
                      onChange={(e) => updateEmploymentRow(index, "year_ended", e.target.value)}
                    />
                  </div>

                  <div className="field">
                    <label>Contact Number</label>
                    <input
                      className="input"
                      value={row.contact_number || ""}
                      onChange={(e) => updateEmploymentRow(index, "contact_number", e.target.value)}
                    />
                  </div>

                  <div className="field">
                    <label>Character Reference</label>
                    <input
                      className="input"
                      value={row.character_reference || ""}
                      onChange={(e) => updateEmploymentRow(index, "character_reference", e.target.value)}
                    />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 10,
            }}
          >
            <label style={{ margin: 0 }}>Beneficiaries</label>
            <button type="button" className="btn" onClick={addBeneficiaryRow}>
              + Add Beneficiary
            </button>
          </div>

          {!beneficiaryRows.length ? (
            <div
              style={{
                padding: "14px",
                border: "1px dashed rgba(255,255,255,0.2)",
                borderRadius: 12,
                opacity: 0.8,
              }}
            >
              No beneficiaries added yet.
            </div>
          ) : (
            beneficiaryRows.map((row, index) => (
              <div
                key={index}
                style={{
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 14,
                  padding: 14,
                  marginBottom: 12,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                  <strong>Beneficiary #{index + 1}</strong>
                  <button type="button" className="btn" onClick={() => removeBeneficiaryRow(index)}>
                    Remove
                  </button>
                </div>

                <div className="form-grid">
                  <div className="field">
                    <label>Name</label>
                    <input
                      className="input"
                      value={row.name || ""}
                      onChange={(e) => updateBeneficiaryRow(index, "name", e.target.value)}
                    />
                  </div>

                  <div className="field">
                    <label>Relation</label>
                    <input
                      className="input"
                      value={row.relation || ""}
                      onChange={(e) => updateBeneficiaryRow(index, "relation", e.target.value)}
                    />
                  </div>

                  <div className="field">
                    <label>Contact Number</label>
                    <input
                      className="input"
                      value={row.contact_number || ""}
                      onChange={(e) => updateBeneficiaryRow(index, "contact_number", e.target.value)}
                    />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="field" style={{ marginTop: 14 }}>
          <h3 style={{ margin: 0 }}>Remittances IDs</h3>
        </div>

        <div className="field">
          <label>SSS No.</label>
          <input className="input" name="sss_no" value={form.sss_no} onChange={onChange} />
        </div>
        <div className="field">
          <label>PhilHealth No.</label>
          <input className="input" name="philhealth_no" value={form.philhealth_no} onChange={onChange} />
        </div>
        <div className="field">
          <label>Pag-IBIG No.</label>
          <input className="input" name="pagibig_no" value={form.pagibig_no} onChange={onChange} />
        </div>
        <div className="field">
          <label>TIN No.</label>
          <input className="input" name="tin_no" value={form.tin_no} onChange={onChange} />
        </div>
      </div>
    </div>
  );
}

function ContractDetailsStep({form, branches, positionRates = [], onChange, branchSearch, setBranchSearch, }) {
  const positionOptions = Array.isArray(positionRates)
    ? [...new Map(
        positionRates
          .filter((r) => String(r?.position || "").trim())
          .map((r) => [String(r.position).trim().toLowerCase(), r])
      ).values()].sort((a, b) =>
        String(a.position || "").localeCompare(String(b.position || ""))
      )
    : [];

    const filteredBranches = useMemo(() => {
    const q = norm(branchSearch);
    if (!q) return branches.slice(0, 30);

    return branches.filter((b) => {
      const hay = [b.id, b.code, b.name, b.area, b.region, b.division]
        .map((x) => norm(x))
        .join(" ");
      return hay.includes(q);
    });
  }, [branches, branchSearch]);

  const handleBranchSelect = (branch) => {
    onChange({
      target: {
        name: "branch_id",
        value: String(branch?.id ?? ""),
      },
    });

    onChange({
      target: {
        name: "area",
        value: branch?.area ?? "",
      },
    });

    onChange({
      target: {
        name: "region",
        value: branch?.region ?? "",
      },
    });

    onChange({
      target: {
        name: "division",
        value: branch?.division ?? "",
      },
    });

    setBranchSearch(
      `${toStr(branch?.code)}${branch?.name ? ` - ${toStr(branch.name)}` : ""}`.trim()
    );
  };

  const handlePositionChange = (e) => {
    const selectedPosition = String(e.target.value || "").trim();
    const matched = positionOptions.find(
      (r) => String(r.position || "").trim().toLowerCase() === selectedPosition.toLowerCase()
    );

    onChange({
      target: {
        name: "position",
        value: selectedPosition,
      },
    });

    if (matched) {
      onChange({
        target: {
          name: "salary",
          value: matched.salary ?? "",
        },
      });

      onChange({
        target: {
          name: "ecola",
          value: matched.ecola ?? "",
        },
      });

      onChange({
        target: {
          name: "cbu",
          value: matched.cbu ?? "",
        },
      });

      onChange({
        target: {
          name: "cashbond",
          value: matched.cashbond ?? "",
        },
      });

      onChange({
        target: {
          name: "utility",
          value: matched.utility ?? "",
        },
      });

      onChange({
        target: {
          name: "sss_er",
          value: matched.sss_er ?? "",
        },
      });

      onChange({
        target: {
          name: "ph_er",
          value: matched.philhealth_er ?? matched.ph_er ?? "",
        },
      });

      onChange({
        target: {
          name: "hdmf_er",
          value: matched.pagibig_er ?? matched.hdmf_er ?? "",
        },
      });

      onChange({
        target: {
          name: "sss_ee",
          value: matched.sss_ee ?? "",
        },
      });

      onChange({
        target: {
          name: "ph_ee",
          value: matched.philhealth_ee ?? matched.ph_ee ?? "",
        },
      });

      onChange({
        target: {
          name: "hdmf_ee",
          value: matched.pagibig_ee ?? matched.hdmf_ee ?? "",
        },
      });

      onChange({
        target: {
          name: "tax",
          value: matched.tax ?? "",
        },
      });
    }
  };

  return (
    <div className="modal-body staff-add-grid">
      <div className="staff-add-left" style={{ width: "100%" }}>
        <div className="field">
          <label>Position *</label>
          <select
            className="input"
            name="position"
            value={form.position}
            onChange={handlePositionChange}
            required
          >
            <option value="">Select position...</option>
            {positionOptions.map((r) => (
              <option key={r.id || r.position} value={r.position}>
                {r.position}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Department</label>
          <input className="input" name="department" value={form.department} onChange={onChange} />
        </div>

        <div className="field">
          <label>Area</label>
          <input className="input" name="area" value={form.area} onChange={onChange} readOnly />
        </div>

        <div className="field">
          <label>Region</label>
          <input className="input" name="region" value={form.region} onChange={onChange} readOnly />
        </div>

        <div className="field">
          <label>Division</label>
          <input className="input" name="division" value={form.division} onChange={onChange} readOnly />
        </div>

        <div className="field" style={{ position: "relative" }}>
          <label>Branch</label>
          <input
            className="input"
            value={branchSearch}
            onChange={(e) => {
              setBranchSearch(e.target.value);
              onChange({
                target: {
                  name: "branch_id",
                  value: "",
                },
              });
              onChange({
                target: {
                  name: "area",
                  value: "",
                },
              });
              onChange({
                target: {
                  name: "region",
                  value: "",
                },
              });
              onChange({
                target: {
                  name: "division",
                  value: "",
                },
              });
            }}
            placeholder="Search branch code or name..."
          />

          {!!filteredBranches.length && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                right: 0,
                zIndex: 50,
                marginTop: 6,
                maxHeight: 240,
                overflowY: "auto",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "#0f1a2e",
                boxShadow: "0 12px 30px rgba(0,0,0,0.35)",
              }}
            >
              {filteredBranches.map((b) => (
                <div
                  key={b.id}
                  onClick={() => handleBranchSelect(b)}
                  style={{
                    padding: "10px 12px",
                    cursor: "pointer",
                    borderBottom: "1px solid rgba(255,255,255,0.05)",
                    color: "#e7edf7",
                  }}
                >
                  {`${toStr(b.code)} - ${toStr(b.name)}`.trim()}
                </div>
              ))}
            </div>
          )}
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

        <div className="field">
          <label>Basic Salary</label>
          <input className="input" name="salary" value={form.salary} onChange={onChange} />
        </div>

        <div className="field">
          <label>Ecola</label>
          <input className="input" name="ecola" value={form.ecola} onChange={onChange} />
        </div>

        <div className="field">
          <label>CBU (staff table default)</label>
          <input className="input" name="cbu" value={form.cbu} onChange={onChange} />
        </div>

        <div className="field">
          <label>Cashbond (staff table default)</label>
          <input className="input" name="cashbond" value={form.cashbond} onChange={onChange} />
        </div>

        <div className="field">
          <label>Utility (staff table default)</label>
          <input className="input" name="utility" value={form.utility} onChange={onChange} />
        </div>

        <div className="field">
          <label>Transportation</label>
          <input className="input" name="transportation" value={form.transportation} onChange={onChange} />
        </div>

        <div className="field">
          <label>Repairing</label>
          <input className="input" name="repairing" value={form.repairing} onChange={onChange} />
        </div>

        <div className="field">
          <label>Postage</label>
          <input className="input" name="postage" value={form.postage} onChange={onChange} />
        </div>

        <div className="field">
          <label>Additional Target</label>
          <input className="input" name="additional_target" value={form.additional_target} onChange={onChange} />
        </div>

        <div className="field">
          <label>Additional Monitoring</label>
          <input className="input" name="additional_monitoring" value={form.additional_monitoring} onChange={onChange} />
        </div>

        <div className="field">
          <label>Other Deduction</label>
          <input className="input" name="other_deduction" value={form.other_deduction} onChange={onChange} />
        </div>

        <div className="field">
          <label>SSS ER</label>
          <input className="input" name="sss_er" value={form.sss_er} onChange={onChange} />
        </div>
        <div className="field">
          <label>PhilHealth ER</label>
          <input className="input" name="ph_er" value={form.ph_er} onChange={onChange} />
        </div>
        <div className="field">
          <label>HDMF ER</label>
          <input className="input" name="hdmf_er" value={form.hdmf_er} onChange={onChange} />
        </div>

        <div className="field">
          <label>SSS EE</label>
          <input className="input" name="sss_ee" value={form.sss_ee} onChange={onChange} />
        </div>
        <div className="field">
          <label>PhilHealth EE</label>
          <input className="input" name="ph_ee" value={form.ph_ee} onChange={onChange} />
        </div>
        <div className="field">
          <label>HDMF EE</label>
          <input className="input" name="hdmf_ee" value={form.hdmf_ee} onChange={onChange} />
        </div>

        <div className="field">
          <label>Withheld Tax</label>
          <input className="input" name="tax" value={form.tax} onChange={onChange} />
        </div>
      </div>
    </div>
  );
}

function PersonalBalancesStep({ balanceForm, onBalanceChange, readOnlyLoans = false, openingLoanRows = [] }) {
  const totalSavings =
    toNum(balanceForm.cbu) + toNum(balanceForm.cashbond) + toNum(balanceForm.utility);

  const totalBalances =
    toNum(balanceForm.salary_advance) +
    toNum(balanceForm.special_advance) +
    toNum(balanceForm.cash_advance) +
    toNum(balanceForm.motorcycle_loan) +
    toNum(balanceForm.pag_ibig_loan) +
    toNum(balanceForm.other_receivable) +
    toNum(balanceForm.staff_accounts_payable);

  return (
    <div className="modal-body staff-add-grid">
      <div className="staff-add-left" style={{ width: "100%" }}>
        <div className="field full" style={{ marginTop: 8 }}>
          <h3 style={{ margin: 0 }}>Personal Savings</h3>
        </div>

        <div className="field">
          <label>CBU</label>
          <input className="input" name="cbu" value={balanceForm.cbu} onChange={onBalanceChange} />
        </div>

        <div className="field">
          <label>Cashbond</label>
          <input className="input" name="cashbond" value={balanceForm.cashbond} onChange={onBalanceChange} />
        </div>

        <div className="field">
          <label>Utility</label>
          <input className="input" name="utility" value={balanceForm.utility} onChange={onBalanceChange} />
        </div>

        <div className="field full">
          <label>Total Personal Savings</label>
          <div className="input" style={{ background: "var(--panel-2)" }}>{money(totalSavings)}</div>
        </div>

        <div className="field full" style={{ marginTop: 16 }}>
          <h3 style={{ margin: 0 }}>Personal Balances</h3>
        </div>

        <div className="field">
          <label>Salary Advance</label>
          <input
            className="input"
            name="salary_advance"
            value={balanceForm.salary_advance}
            onChange={onBalanceChange}
            readOnly={readOnlyLoans}
          />
        </div>

        <div className="field">
          <label>Special Advance</label>
          <input
            className="input"
            name="special_advance"
            value={balanceForm.special_advance}
            onChange={onBalanceChange}
            readOnly={readOnlyLoans}
          />
        </div>

        <div className="field">
          <label>Cash Advance</label>
          <input
            className="input"
            name="cash_advance"
            value={balanceForm.cash_advance}
            onChange={onBalanceChange}
            readOnly={readOnlyLoans}
          />
        </div>

        <div className="field">
          <label>Motorcycle Loan</label>
          <input
            className="input"
            name="motorcycle_loan"
            value={balanceForm.motorcycle_loan}
            onChange={onBalanceChange}
            readOnly={readOnlyLoans}
          />
        </div>

        <div className="field">
          <label>Pag-ibig Loan</label>
          <input className="input" name="pag_ibig_loan" value={balanceForm.pag_ibig_loan} onChange={onBalanceChange} />
        </div>

        <div className="field">
          <label>Other Receivable</label>
          <input className="input" name="other_receivable" value={balanceForm.other_receivable} onChange={onBalanceChange} />
        </div>

        <div className="field">
          <label>Staff Accounts Payable</label>
          <input className="input" name="staff_accounts_payable" value={balanceForm.staff_accounts_payable} onChange={onBalanceChange} />
        </div>

        <div className="field full">
          <label>Total Personal Balance</label>
          <div className="input" style={{ background: "var(--panel-2)" }}>{money(totalBalances)}</div>
        </div>

        {readOnlyLoans ? (
          <div className="field full" style={{ marginTop: 16 }}>
            <label>Opening Loan Balances</label>
            <div className="input" style={{ background: "var(--panel-2)", minHeight: 80 }}>
              {!openingLoanRows.length ? (
                <div style={{ opacity: 0.8 }}>No opening loan balances found.</div>
              ) : (
                openingLoanRows.map((row) => (
                  <div key={row.id} style={{ marginBottom: 8 }}>
                    <strong>{row.loan_type}</strong> — Remaining: ₱ {money(row.remaining_balance)}
                    {row.interest != null ? ` • Interest: ${toNum(row.interest)}%` : ""}
                    {row.term_months ? ` • Term: ${row.term_months}` : ""}
                    {row.months_paid != null ? ` • Paid: ${row.months_paid}` : ""}
                  </div>
                ))
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function StaffProfileModal({ staff, avatarUrl, onClose, branchNameById }) {
  const [tab, setTab] = useState("staff");
  const [leaveKind, setLeaveKind] = useState("All");
  const [leaveRows, setLeaveRows] = useState([]);
  const [loadingLeave, setLoadingLeave] = useState(false);
  const [errLeave, setErrLeave] = useState("");

  const [historyKind, setHistoryKind] = useState("All");
  const [loanRows, setLoanRows] = useState([]);
  const [loadingLoan, setLoadingLoan] = useState(false);
  const [errLoan, setErrLoan] = useState("");

  const [sapHistoryRows, setSapHistoryRows] = useState([]);
  const [loadingSapHist, setLoadingSapHist] = useState(false);
  const [errSapHist, setErrSapHist] = useState("");

  const [demotionRows, setDemotionRows] = useState([]);
  const [loadingDemotion, setLoadingDemotion] = useState(false);
  const [errDemotion, setErrDemotion] = useState("");

  const [openingLoanRows, setOpeningLoanRows] = useState([]);
  const [loadingOpeningLoans, setLoadingOpeningLoans] = useState(false);
  const [errOpeningLoans, setErrOpeningLoans] = useState("");

  const [balances, setBalances] = useState(null);
  const [loadingBal, setLoadingBal] = useState(false);
  const [errBal, setErrBal] = useState("");

  const [bonus15Data, setBonus15Data] = useState({
    percentage: 0,
    result: 0,
    bonus_month: "",
  });
  const [loadingBonus15, setLoadingBonus15] = useState(false);
  const [errBonus15, setErrBonus15] = useState("");

  const childrenArr = useMemo(() => safeJsonArray(staff?.children), [staff?.children]);
  const educationArr = useMemo(() => safeJsonArray(staff?.education), [staff?.education]);
  const employmentArr = useMemo(() => safeJsonArray(staff?.employment_history), [staff?.employment_history]);
  const beneficiariesArr = useMemo(() => safeJsonArray(staff?.beneficiaries), [staff?.beneficiaries]);

  const thirteenthMonthData = useMemo(() => {
    return compute13thMonthBreakdown(staff);
  }, [staff]);

  const Chip = ({ label, active, onClick }) => (
    <button type="button" className={`chip ${active ? "active" : ""}`} onClick={onClick}>
      {label}
    </button>
  );

  const EmptyState = ({ title, hint }) => (
    <div style={{ padding: 14, opacity: 0.9 }}>
      <div style={{ fontWeight: 900 }}>{title}</div>
      <div style={{ fontSize: 12, marginTop: 6 }}>{hint}</div>
    </div>
  );

  const totals = useMemo(() => {
    const salaryTotal = toNum(staff.salary) + toNum(staff.ecola);
    const personalTotal = toNum(staff.cbu) + toNum(staff.cashbond) + toNum(staff.utility_charge ?? staff.utility);
    const transpoTotal =
      toNum(staff.transportation) +
      toNum(staff.repairing) +
      toNum(staff.postage) +
      toNum(staff.additional_target) +
      toNum(staff.additional_monitoring) +
      toNum(staff.other_deduction);

    const totalER = toNum(staff.sss_er) + toNum(staff.ph_er) + toNum(staff.hdmf_er);
    const totalEE = toNum(staff.sss_ee) + toNum(staff.ph_ee) + toNum(staff.hdmf_ee);

    return { salaryTotal, personalTotal, transpoTotal, totalER, totalEE };
  }, [staff]);

  const loadLeaves = useCallback(async () => {
    if (!staff?.id) return;
    setLoadingLeave(true);
    setErrLeave("");
    try {
      const res = await api.get(`/leave-requests/staff/${staff.id}`);
      setLeaveRows(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      setErrLeave(e?.response?.data?.message || "Failed to load leave details.");
      setLeaveRows([]);
    } finally {
      setLoadingLeave(false);
    }
  }, [staff?.id]);

  const loadSapHistory = useCallback(async () => {
    if (!staff?.id) return;
    setLoadingSapHist(true);
    setErrSapHist("");
    try {
      const res = await api.get(`/staff-accounts-payable/employee/${staff.employee_no}`);
      setSapHistoryRows(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      setErrSapHist(e?.response?.data?.message || "Failed to load staff payable history.");
      setSapHistoryRows([]);
    } finally {
      setLoadingSapHist(false);
    }
  }, [staff?.id, staff?.employee_no]);

  const loadLoans = useCallback(async () => {
    if (!staff?.id) return;
    setLoadingLoan(true);
    setErrLoan("");
    try {
      const res = await api.get(`/loan-requests/staff/${staff.id}`);
      setLoanRows(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      setErrLoan(e?.response?.data?.message || "Failed to load loan history.");
      setLoanRows([]);
    } finally {
      setLoadingLoan(false);
    }
  }, [staff?.id]);

  const loadDemotions = useCallback(async () => {
    if (!staff?.id) return;
    setLoadingDemotion(true);
    setErrDemotion("");

    try {
      let rows = [];

      const user = (() => {
        try {
          return JSON.parse(localStorage.getItem("user") || "null");
        } catch {
          return null;
        }
      })();

      const role = String(user?.role || "").trim().toLowerCase();

      const canUseStaffEndpoint =
        role === "admin" ||
        role === "hr" ||
        role === "accounting";

      if (canUseStaffEndpoint) {
        const res = await api.get(`/demotion-orders/staff/${staff.id}`);
        rows = Array.isArray(res.data) ? res.data : [];
      } else {
        const res2 = await api.get(`/demotion-orders`);
        const all = Array.isArray(res2.data) ? res2.data : [];
        rows = all.filter((x) => String(x.employee_id) === String(staff.id));
      }

      setDemotionRows(rows);
    } catch (e) {
      setErrDemotion(e?.response?.data?.message || "Failed to load demotion orders.");
      setDemotionRows([]);
    } finally {
      setLoadingDemotion(false);
    }
  }, [staff?.id]);

  const loadOpeningLoans = useCallback(async () => {
    if (!staff?.id) return;
    setLoadingOpeningLoans(true);
    setErrOpeningLoans("");

    try {
      const res = await api.get(`/staff-loan-opening-balances/staff/${staff.id}`);
      setOpeningLoanRows(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      setErrOpeningLoans(
        e?.response?.data?.message || "Failed to load opening loan balances."
      );
      setOpeningLoanRows([]);
    } finally {
      setLoadingOpeningLoans(false);
    }
  }, [staff?.id]);

  const loadBalances = useCallback(async () => {
    if (!staff?.employee_no) return;

    setLoadingBal(true);
    setErrBal("");

    try {
      const now = new Date();
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

      const res = await api.get(`/schedule-balances/live`, {
        params: { month },
      });

      const rows = Array.isArray(res.data) ? res.data : [];

      const found =
        rows.find((r) => String(r.staff_id) === String(staff.id)) ||
        rows.find((r) => String(r.employee_no) === String(staff.employee_no)) ||
        null;

      setBalances(found || {});
    } catch (e) {
      setErrBal(e?.response?.data?.message || "Failed to load personal balances.");
      setBalances({});
    } finally {
      setLoadingBal(false);
    }
  }, [staff?.id, staff?.employee_no]);

  const loadBonus15Data = useCallback(async () => {
  if (!staff?.id || !staff?.branch_id) return;

  setLoadingBonus15(true);
  setErrBonus15("");

  try {
    const now = new Date();
    const bonusMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

    const res = await api.get(`/bonus/branch/${staff.branch_id}`, {
      params: { bonus_month: bonusMonth },
    });

    const rows = Array.isArray(res.data) ? res.data : [];

    const found =
      rows.find((r) => String(r.employee_id) === String(staff.id)) || null;

    setBonus15Data({
      base: toNum(found?.month_13),
      percentage: toNum(found?.percentage),
      result: toNum(found?.result),
      bonus_month: bonusMonth,
    });
  } catch (e) {
    setErrBonus15(e?.response?.data?.message || "Failed to load 15th month bonus data.");
    setBonus15Data({
      percentage: 0,
      result: 0,
      bonus_month: "",
    });
  } finally {
    setLoadingBonus15(false);
  }
}, [staff?.id, staff?.branch_id]);

  useEffect(() => {
    if (tab === "leave") loadLeaves();

    if (tab === "history") {
      loadLoans();
      loadOpeningLoans();
      loadDemotions();
      loadSapHistory();
    }

    if (tab === "balances") {
      loadBalances();
      loadLoans();
      loadOpeningLoans();
      loadSapHistory();
      loadBonus15Data();
    }
  }, [
    tab,
    loadLeaves,
    loadLoans,
    loadOpeningLoans,
    loadDemotions,
    loadSapHistory,
    loadBalances,
    loadBonus15Data,
  ]);

  const historyItems = useMemo(() => {
    const items = [];

    if (historyKind === "All" || historyKind === "Loans") {
      for (const l of loanRows || []) {
        const date = loanDisplayDate(l);
        const title = l.loan_type || "Loan";
        const ref = l.transaction_code || l.employee_no || l.id;
        const amount = `₱ ${money(l.amount)}`;
        const term = l.term || "-";
        const interest = `${Number(l.interest || 0)}%`;
        const total = `₱ ${money(l.total)}`;
        const perMonth = `₱ ${money(l.per_month)}`;
        const status = l.status || "Pending";

        const extraDates = [
          l.entry_date ? `Entry: ${fmtDate(l.entry_date)}` : null,
          l.approved_at ? `Approved: ${fmtDate(l.approved_at)}` : null,
          l.disbursement_date ? `Disbursed: ${fmtDate(l.disbursement_date)}` : null,
        ]
          .filter(Boolean)
          .join(" • ");

        items.push({
          _type: "LOAN",
          id: l.id,
          ref,
          date,
          status,
          title,
          subtitle: `Amount: ${amount} • Term: ${term} • Interest: ${interest}`,
          extra: `Total: ${total} • Per Month: ${perMonth}${extraDates ? ` • ${extraDates}` : ""}`,
          reason: l.reason || "",
          rejection_reason: l.rejection_reason || "",
        });
      }
    }

    if (historyKind === "All" || historyKind === "SAP") {
      for (const x of sapHistoryRows || []) {
        items.push({
          _type: "SAP",
          id: x.id,
          ref: x.id,
          date: x.entry_date || x.created_at || x.approved_at || x.rejected_at || null,
          status: x.status || "Pending",
          title: "Staff Accounts Payable",
          subtitle: `Amount: ₱ ${money(x.amount)} • Term: ${x.term || "-"} • Per Month: ₱ ${money(x.per_month)}`,
          extra: `Balance: ₱ ${money(x.balance)} • Description: ${x.description || "-"}`,
          reason: "",
          rejection_reason: x.rejection_reason || "",
        });
      }
    }

    if (historyKind === "All" || historyKind === "Demotions") {
      for (const d of demotionRows || []) {
        items.push({
          _type: "DEMOTION",
          id: d.id,
          ref: d.order_no || d.id,
          date: d.created_at || d.updated_at || d.effective_date || null,
          status: d.status || "Pending",
          title: "Demotion Order",
          subtitle: `Prev: ${d.old_position || "-"} → New: ${d.new_position || "-"}`,
          extra: `Effective: ${fmtDate(d.effective_date) || "-"} • To Branch: ${
            `${d.to_branch_code || ""} ${d.to_branch_name || ""}`.trim() || (d.to_branch_id ?? "-")
          }`,
          reason: d.details || "",
          rejection_reason: d.rejection_reason || "",
        });
      }
    }

    items.sort((a, b) => {
      const ad = a.date ? new Date(a.date).getTime() : 0;
      const bd = b.date ? new Date(b.date).getTime() : 0;
      return bd - ad;
    });

    return items;
  }, [loanRows, sapHistoryRows, demotionRows, historyKind]);

  const filteredLeaves = useMemo(() => {
    const list = Array.isArray(leaveRows) ? leaveRows : [];
    if (leaveKind === "All") return list;
    return list.filter((r) => String(r.status || "").toLowerCase() === leaveKind.toLowerCase());
  }, [leaveRows, leaveKind]);

  const bal = balances || {};
  const openingLoanTotals = useMemo(() => {
    const totals = {
      salary_advance: 0,
      special_advance: 0,
      cash_advance: 0,
      motorcycle_loan: 0,
      other_loan: 0,
    };

    for (const row of openingLoanRows || []) {
      const type = String(row?.loan_type || "").trim().toLowerCase();
      const remaining = toNum(row?.remaining_balance);

      if (String(row?.status || "").trim().toLowerCase() !== "active") continue;

      if (type === "salary advance") totals.salary_advance += remaining;
      else if (type === "special advance") totals.special_advance += remaining;
      else if (type === "cash advance") totals.cash_advance += remaining;
      else if (type === "motorcycle loan") totals.motorcycle_loan += remaining;
      else totals.other_loan += remaining;
    }

    return totals;
  }, [openingLoanRows]);

  const approvedLoanTotals = useMemo(() => {
    const totals = {
      salary_advance: 0,
      special_advance: 0,
      cash_advance: 0,
      motorcycle_loan: 0,
    };

    for (const row of loanRows || []) {
      const status = String(row?.status || "").trim().toLowerCase();
      if (status !== "approved") continue;

      const type = String(row?.loan_type || "").trim().toLowerCase();
      const amount =
        toNum(row?.balance) ||
        toNum(row?.remaining_balance) ||
        toNum(row?.total) ||
        toNum(row?.amount);

      if (type === "salary advance") totals.salary_advance += amount;
      else if (type === "special advance" || type === "special loan") totals.special_advance += amount;
      else if (type === "cash advance" || type === "cash loan") totals.cash_advance += amount;
      else if (type === "motorcycle loan") totals.motorcycle_loan += amount;
    }

    return totals;
  }, [loanRows]);

  const combinedBalances = useMemo(() => {
    return {
      cbu: toNum(bal.cbu),
      cashbond: toNum(bal.cashbond),
      utility: toNum(bal.utility ?? staff.utility_charge ?? staff.utility),
      salary_advance: toNum(bal.salary_advance),
      special_advance: toNum(bal.special_advance),
      cash_advance: toNum(bal.cash_advance),
      motorcycle_loan: toNum(bal.motorcycle_loan),
      pag_ibig_loan: toNum(bal.pag_ibig_loan),
      other_receivable: toNum(bal.other_receivable),
      staff_accounts_payable: toNum(bal.staff_accounts_payable),
      other_opening_loan: 0,
    };
  }, [bal, staff]);
  
  const utilityValue = toNum(bal.utility ?? staff.utility_charge ?? staff.utility);
  const headerName = displayName(staff);
  const headerPosition = toStr(staff?.position) || "-";
  const headerStatus = toStr(staff?.status) || "Active";

    const renderEducation = () => {
      if (!educationArr.length) {
        return <tr><td colSpan="2">-</td></tr>;
      }

      return educationArr.map((e, idx) => (
        <React.Fragment key={`edu-${idx}`}>
          <tr><td style={{ fontWeight: 800 }}>School</td><td>{e?.school || e?.school_name || "-"}</td></tr>
          <tr><td>Level</td><td>{e?.level || "-"}</td></tr>
          <tr><td>Course</td><td>{e?.course || "-"}</td></tr>
          <tr><td>Year Graduated</td><td>{e?.year_graduated || e?.year_completed || "-"}</td></tr>
          <tr><td>Remarks</td><td>{e?.remarks || "-"}</td></tr>
          {idx !== educationArr.length - 1 && (
            <tr><td colSpan="2"><hr /></td></tr>
          )}
        </React.Fragment>
      ));
    };

    const renderEmployment = () => {
      if (!employmentArr.length) {
        return <tr><td colSpan="2">-</td></tr>;
      }

      return employmentArr.map((e, idx) => (
        <React.Fragment key={`emp-${idx}`}>
          <tr><td style={{ fontWeight: 800 }}>Company</td><td>{e?.company || "-"}</td></tr>
          <tr><td>Position</td><td>{e?.position || "-"}</td></tr>
          <tr><td>Year Started</td><td>{e?.year_started || "-"}</td></tr>
          <tr><td>Year Ended</td><td>{e?.year_ended || "-"}</td></tr>
          <tr><td>Contact Number</td><td>{e?.contact_number || "-"}</td></tr>
          <tr><td>Character Reference</td><td>{e?.character_reference || "-"}</td></tr>
          {idx !== employmentArr.length - 1 && (
            <tr><td colSpan="2"><hr /></td></tr>
          )}
        </React.Fragment>
      ));
    };

    const renderBeneficiaries = () => {
      if (!beneficiariesArr.length) {
        return <tr><td colSpan="2">-</td></tr>;
      }

      return beneficiariesArr.map((b, idx) => (
        <React.Fragment key={`ben-${idx}`}>
          <tr><td style={{ fontWeight: 800 }}>Name</td><td>{b?.name || "-"}</td></tr>
          <tr><td>Relation</td><td>{b?.relation || "-"}</td></tr>
          <tr><td>Contact Number</td><td>{b?.contact_number || "-"}</td></tr>
          {idx !== beneficiariesArr.length - 1 && (
            <tr><td colSpan="2"><hr /></td></tr>
          )}
        </React.Fragment>
      ));
    };

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal staff-profile-modal" onMouseDown={(e) => e.stopPropagation()} style={{ maxWidth: 1200 }}>
        <div className="modal-head">
          <div>
            <h3>Staff Profile</h3>
          </div>
          <button className="icon-btn" onClick={onClose} type="button">
            ✕
          </button>
        </div>

        <div className="modal-body staff-profile-scroll">
          <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "8px 0 14px 0" }}>
            {avatarUrl(staff) ? (
              <img src={avatarUrl(staff)} alt="staff" style={{ width: 92, height: 92, borderRadius: "50%", objectFit: "cover", flex: "0 0 auto" }} />
            ) : (
              <div
                className="staff-avatar-lg staff-avatar--fallback"
                style={{ width: 92, height: 92, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}
              >
                {headerName.slice(0, 1).toUpperCase()}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
              <div style={{ fontWeight: 900, fontSize: 16, lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {headerName}
              </div>
              <div style={{ opacity: 0.85, marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {headerPosition}
              </div>
              <div style={{ marginTop: 6, fontWeight: 800, color: String(headerStatus).toLowerCase() === "inactive" ? "#ef4444" : "#22c55e" }}>
                {headerStatus}
              </div>
            </div>
          </div>

          <div className="staff-tabs" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {["staff", "contract", "leave", "attachments", "history", "balances"].map((t) => (
              <button key={t} className={`tab-btn ${tab === t ? "active" : ""}`} onClick={() => setTab(t)} type="button">
                {t === "staff"
                  ? "Staff Details"
                  : t === "contract"
                  ? "Contract Details"
                  : t === "leave"
                  ? "Leave Details"
                  : t === "attachments"
                  ? "Attachments"
                  : t === "history"
                  ? "Transaction History"
                  : "Personal Balances"}
              </button>
            ))}
          </div>

          <br />

          {tab === "staff" && (
            <table className="profile-table">
              <tbody>
                <tr><td><h2>Employee Details</h2></td></tr>
                <tr><td>ID</td><td>{staff.id}</td></tr>
                <tr><td>Employee No</td><td>{staff.employee_no || "-"}</td></tr>
                <tr><td>Name</td><td>{displayName(staff)}</td></tr>
                <tr><td>Start Date</td><td>{fmtDate(staff.start_date)}</td></tr>
                <tr><td>Address</td><td>{staff.address || "-"}</td></tr>
                <tr><td>Municipality</td><td>{staff.municipality || "-"}</td></tr>
                <tr><td>Province</td><td>{staff.province || "-"}</td></tr>
                <tr><td>Contact</td><td>{staff.contact || "-"}</td></tr>
                <tr><td>Email</td><td>{staff.email || "-"}</td></tr>

                <tr><td><h2>Employee Background</h2></td></tr>
                <tr><td>Date of Birth</td><td>{fmtDate(staff.date_of_birth)}</td></tr>
                <tr><td>Place of Birth</td><td>{staff.place_of_birth || "-"}</td></tr>
                <tr><td>Gender</td><td>{staff.gender || "-"}</td></tr>
                <tr><td>Civil Status</td><td>{staff.civil_status || "-"}</td></tr>
                <tr><td>Citizenship</td><td>{staff.citizenship || "-"}</td></tr>
                <tr><td>Height</td><td>{toStr(staff.height) || "-"}</td></tr>
                <tr><td>Weight</td><td>{toStr(staff.weight) || "-"}</td></tr>
                <tr><td>Religion</td><td>{staff.religion || "-"}</td></tr>
                <tr><td>Blood Type</td><td>{staff.blood_type || "-"}</td></tr>

                <tr><td><h2>Spouse & Children Information</h2></td></tr>
                <tr><td>Spouse Fullname</td><td>{staff.spouse_fullname || "-"}</td></tr>
                <tr><td>Spouse Address</td><td>{staff.spouse_address || "-"}</td></tr>
                <tr><td>Spouse Occupation</td><td>{staff.spouse_occupation || "-"}</td></tr>
                <tr><td>Spouse Employer</td><td>{staff.spouse_employer || "-"}</td></tr>
                <tr><td><h3>Children</h3></td></tr>

                {childrenArr.length === 0 ? (
                  <tr><td colSpan="2">-</td></tr>
                ) : (
                  childrenArr.map((c, idx) => (
                    <React.Fragment key={idx}>
                      <tr><td>Fullname</td><td>{c?.fullname || "-"}</td></tr>
                      <tr><td>Date of Birth</td><td>{c?.date_of_birth || "-"}</td></tr>
                      <tr><td>Place of Birth</td><td>{c?.place_of_birth || "-"}</td></tr>
                      <tr><td colSpan="2"><hr /></td></tr>
                    </React.Fragment>
                  ))
                )}

                <tr><td><h2>Parents / Guardian</h2></td></tr>
                <tr><td>Father Fullname</td><td>{staff.father_fullname || "-"}</td></tr>
                <tr><td>Father Address</td><td>{staff.father_address || "-"}</td></tr>
                <tr><td>Father Occupation</td><td>{staff.father_occupation || "-"}</td></tr>
                <tr><td>Father Employer</td><td>{staff.father_employer || "-"}</td></tr>
                <tr><td>Father Contact</td><td>{staff.father_contact || "-"}</td></tr>

                <tr><td>Mother Fullname</td><td>{staff.mother_fullname || "-"}</td></tr>
                <tr><td>Mother Address</td><td>{staff.mother_address || "-"}</td></tr>
                <tr><td>Mother Occupation</td><td>{staff.mother_occupation || "-"}</td></tr>
                <tr><td>Mother Employer</td><td>{staff.mother_employer || "-"}</td></tr>
                <tr><td>Mother Contact</td><td>{staff.mother_contact || "-"}</td></tr>

                <tr><td>Guardian Fullname</td><td>{staff.guardian_fullname || "-"}</td></tr>
                <tr><td>Guardian Address</td><td>{staff.guardian_address || "-"}</td></tr>
                <tr><td>Guardian Occupation</td><td>{staff.guardian_occupation || "-"}</td></tr>
                <tr><td>Guardian Employer</td><td>{staff.guardian_employer || "-"}</td></tr>
                <tr><td>Guardian Contact</td><td>{staff.guardian_contact || "-"}</td></tr>

                <tr><td colSpan="2"><h2>Education</h2></td></tr>
                  {renderEducation()}

                <tr><td colSpan="2"><h2>Employment</h2></td></tr>
                  {renderEmployment()}

                <tr><td colSpan="2"><h2>Beneficiaries</h2></td></tr>
                  {renderBeneficiaries()}

                <tr><td><h2>Remittances</h2></td></tr>
                <tr><td>SSS No.</td><td>{staff.sss_no || "-"}</td></tr>
                <tr><td>PhilHealth No.</td><td>{staff.philhealth_no || "-"}</td></tr>
                <tr><td>Pag-Ibig No.</td><td>{staff.pagibig_no || "-"}</td></tr>
                <tr><td>TIN No.</td><td>{staff.tin_no || "-"}</td></tr>
              </tbody>
            </table>
          )}

          {tab === "contract" && (
            <table className="profile-table">
              <tbody>
                <tr><td><h2>Others</h2></td></tr>
                <tr><td>Position</td><td>{staff.position || "-"}</td></tr>
                <tr><td>Branch</td><td>{branchNameById(staff.branch_id) || "-"}</td></tr>
                <tr><td>Department</td><td>{staff.department || "-"}</td></tr>
                <tr><td>Area</td><td>{staff.area || "-"}</td></tr>
                <tr><td>Region</td><td>{staff.region || "-"}</td></tr>
                <tr><td>Division</td><td>{staff.division || "-"}</td></tr>
                <tr><td>Status</td><td>{staff.status || "Active"}</td></tr>
                <tr><td>Start Date</td><td>{fmtDate(staff.start_date)}</td></tr>
                <tr><td>Regularization Date</td><td>{fmtDate(staff.regularization_date)}</td></tr>
                <tr><td><h2>Salary Details</h2></td></tr>
                <tr><td>Basic Salary</td><td>{money(staff.salary)}</td></tr>
                <tr><td>Ecola</td><td>{money(staff.ecola)}</td></tr>
                <tr><td><h3>Total</h3></td><td>{money(totals.salaryTotal)}</td></tr>
                <tr><td><h2>Personal Deductions</h2></td></tr>
                <tr><td>CBU</td><td>{money(staff.cbu)}</td></tr>
                <tr><td>Cashbond</td><td>{money(staff.cashbond)}</td></tr>
                <tr><td>Utility</td><td>{money(staff.utility_charge ?? staff.utility)}</td></tr>
              </tbody>
            </table>
          )}

          {tab === "leave" && (
            <>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                {["All", "Pending", "Approved", "Rejected"].map((k) => (
                  <Chip key={k} label={k} active={leaveKind === k} onClick={() => setLeaveKind(k)} />
                ))}
              </div>

              {loadingLeave && <div className="empty-state">Loading leave details…</div>}
              {!loadingLeave && errLeave ? <div className="empty-state" style={{ color: "#ef4444" }}>{errLeave}</div> : null}
              {!loadingLeave && !errLeave && filteredLeaves.length === 0 ? <EmptyState title="No leave records yet." hint="Requests will show here." /> : null}

              {!loadingLeave && !errLeave && filteredLeaves.length > 0 ? (
                <div className="table-scroll">
                  <table className="saas-table staffinfo-table">
                    <thead>
                      <tr>
                        <th style={{ width: 190 }}>Code</th>
                        <th style={{ width: 170 }}>Type</th>
                        <th style={{ width: 130 }}>Start</th>
                        <th style={{ width: 130 }}>End</th>
                        <th style={{ width: 140 }}>Entry Date</th>
                        <th style={{ width: 120 }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLeaves.map((r) => (
                        <tr key={r.id}>
                          <td className="mono">{r.transaction_code || r.id}</td>
                          <td>{r.leave_type || "-"}</td>
                          <td className="mono">{fmtDate(r.start_date)}</td>
                          <td className="mono">{fmtDate(r.end_date)}</td>
                          <td className="mono">{fmtDate(r.entry_date)}</td>
                          <td className="mono">{r.status || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </>
          )}

          {tab === "attachments" && <EmptyState title="No attachments yet." hint="Add upload routes later and this will show files." />}

          {tab === "history" && (
            <>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                <Chip label="All" active={historyKind === "All"} onClick={() => setHistoryKind("All")} />
                <Chip label="Loans" active={historyKind === "Loans"} onClick={() => setHistoryKind("Loans")} />
                <Chip label="Demotions" active={historyKind === "Demotions"} onClick={() => setHistoryKind("Demotions")} />
                <Chip label="SAP" active={historyKind === "SAP"} onClick={() => setHistoryKind("SAP")} />
              </div>

              {(loadingLoan || loadingDemotion || loadingSapHist) && <div className="empty-state">Loading transaction history…</div>}
              {!loadingLoan && errLoan ? <div className="empty-state" style={{ color: "#ef4444" }}>{errLoan}</div> : null}
              {!loadingDemotion && errDemotion ? <div className="empty-state" style={{ color: "#ef4444" }}>{errDemotion}</div> : null}
              {!loadingSapHist && errSapHist ? <div className="empty-state" style={{ color: "#ef4444" }}>{errSapHist}</div> : null}

              {!loadingLoan && !loadingDemotion && !errLoan && !errDemotion && historyItems.length === 0 ? (
                <EmptyState title="No transaction history yet." hint="Loans + Demotion orders will appear here." />
              ) : null}

              {!loadingLoan && !loadingDemotion && historyItems.length > 0 ? (
                <div className="table-scroll">
                  <table className="saas-table staffinfo-table">
                    <thead>
                      <tr>
                        <th style={{ width: 120 }}>Type</th>
                        <th style={{ width: 200 }}>Ref</th>
                        <th>Details</th>
                        <th style={{ width: 140 }}>Date</th>
                        <th style={{ width: 130 }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyItems.map((it) => (
                        <tr key={`${it._type}-${it.id}`}>
                          <td className="mono">{it._type}</td>
                          <td className="mono">{it.ref}</td>
                          <td>
                            <div className="strong">{it.title}</div>
                            <div style={{ fontSize: 12, opacity: 0.9, marginTop: 4 }}>{it.subtitle}</div>
                            {it.extra ? <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>{it.extra}</div> : null}
                            {it.reason ? <div style={{ fontSize: 12, opacity: 0.85, marginTop: 6 }}>Remarks: {it.reason}</div> : null}
                            {it.rejection_reason ? <div style={{ fontSize: 12, color: "#ef4444", marginTop: 6 }}>Rejection: {it.rejection_reason}</div> : null}
                          </td>
                          <td className="mono">{it.date ? fmtDate(it.date) : "-"}</td>
                          <td className="mono">{it.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </>
          )}

          {tab === "balances" && (
            <>
              {loadingBal ? <div className="empty-state">Loading balances…</div> : null}
              {errBal ? <div className="empty-state" style={{ color: "#ef4444" }}>{errBal}</div> : null}

              {!loadingBal && !errBal ? (
                <>
                  <table className="profile-table">
                    <tbody>
                      <tr><td colSpan="2"><h2>Personal Savings</h2></td></tr>
                      <tr><td>CBU</td><td>{money(combinedBalances.cbu)}</td></tr>
                      <tr><td>Cashbond</td><td>{money(combinedBalances.cashbond)}</td></tr>
                      <tr><td>Utility</td><td>{money(combinedBalances.utility)}</td></tr>
                      <tr>
                        <td><strong>Total Personal Savings</strong></td>
                        <td>{money(combinedBalances.cbu + combinedBalances.cashbond + combinedBalances.utility)}</td>
                      </tr>

                      <tr><td>Salary Advance</td><td>{money(combinedBalances.salary_advance)}</td></tr>
                      <tr><td>Special Advance</td><td>{money(combinedBalances.special_advance)}</td></tr>
                      <tr><td>Cash Advance</td><td>{money(combinedBalances.cash_advance)}</td></tr>
                      <tr><td>Motorcycle Loan</td><td>{money(combinedBalances.motorcycle_loan)}</td></tr>
                      <tr><td>Pag-ibig Loan</td><td>{money(combinedBalances.pag_ibig_loan)}</td></tr>
                      <tr><td>Other Receivable</td><td>{money(combinedBalances.other_receivable)}</td></tr>
                      <tr><td>Staff Accounts Payable</td><td>{money(combinedBalances.staff_accounts_payable)}</td></tr>
                      <tr>
                        <td><strong>Total Personal Balance</strong></td>
                        <td>
                          {money(
                            combinedBalances.salary_advance +
                              combinedBalances.special_advance +
                              combinedBalances.cash_advance +
                              combinedBalances.motorcycle_loan +
                              combinedBalances.pag_ibig_loan +
                              combinedBalances.other_receivable +
                              combinedBalances.staff_accounts_payable
                          )}
                        </td>
                      </tr>

                      <tr><td colSpan="2"><h2>Tax Contribution (2316)</h2></td></tr>
                      <tr><td>Basic Salary</td><td>{money(staff.salary)}</td></tr>
                      <tr><td>Ecola</td><td>{money(staff.ecola)}</td></tr>
                      <tr><td><strong>Total Contribution</strong></td><td>{money(toNum(staff.salary) + toNum(staff.ecola))}</td></tr>

                      <tr><td colSpan="2"><h2>Remittances (EE)</h2></td></tr>
                      <tr><td>SSS</td><td>{money(staff.sss_ee)}</td></tr>
                      <tr><td>Philhealth</td><td>{money(staff.ph_ee)}</td></tr>
                      <tr><td>Pag-ibig</td><td>{money(staff.hdmf_ee)}</td></tr>
                      <tr><td><strong>Total (EE)</strong></td><td>{money(toNum(staff.sss_ee) + toNum(staff.ph_ee) + toNum(staff.hdmf_ee))}</td></tr>

                      <tr><td colSpan="2"><h2>Tax</h2></td></tr>
                      <tr><td>Tax</td><td>{money(staff.tax)}</td></tr>
                      <tr><td><strong>Total Tax</strong></td><td>{money(toNum(staff.tax))}</td></tr>

                      <tr><td colSpan="2"><h2>13th / 14th / 15th Month Computation ({thirteenthMonthData.year})</h2></td></tr>
                      <tr><td>Basic Salary</td><td>{money(thirteenthMonthData.basicSalary)}</td></tr>
                      <tr><td>Ecola</td><td>{money(thirteenthMonthData.ecola)}</td></tr>
                      <tr><td><strong>Monthly Compensation</strong></td><td>{money(thirteenthMonthData.monthlyCompensation)}</td></tr>

                      {thirteenthMonthData.rows.map((row) => (
                        <tr key={row.month}>
                          <td>{row.month}</td>
                          <td>{row.amount == null ? "-" : money(row.amount)}</td>
                        </tr>
                      ))}

                      <tr><td><strong>Total Compensation Earned</strong></td><td>{money(thirteenthMonthData.totalCompensationEarned)}</td></tr>
                      <tr><td><strong>13th Month Pay</strong></td><td>{money(thirteenthMonthData.thirteenthMonth)}</td></tr>
                      <tr><td><strong>14th Month Pay</strong></td><td>{money(thirteenthMonthData.fourteenthMonth)}</td></tr>
                      <tr><td><strong>15th Month Pay</strong></td><td>{money(thirteenthMonthData.fifteenthMonth)}</td></tr>
                    </tbody>
                  </table>

                  <div style={{ marginTop: 20 }}>
                    {loadingBonus15 ? (
                      <div className="empty-state">Loading bonus data…</div>
                    ) : null}

                    {errBonus15 ? (
                      <div className="empty-state" style={{ color: "#ef4444" }}>
                        {errBonus15}
                      </div>
                    ) : null}

                    {!loadingBonus15 && !errBonus15 ? (
                      <table className="profile-table">
                        <thead>
                          <tr>
                            <th>2025 13th Month</th>
                            <th>Percentage</th>
                            <th>Result</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            {/* THIS is the 2025 13th month base from bonus */}
                            <td>{money(bonus15Data.base || 0)}</td>

                            {/* percentage from bonus.jsx */}
                            <td>{bonus15Data.percentage}%</td>

                            {/* result from bonus.jsx */}
                            <td>{money(bonus15Data.result)}</td>
                          </tr>
                        </tbody>
                      </table>
                    ) : null}
                  </div>
                </>
              ) : null}
            </>
          )}
        </div>

        <div className="modal-foot">
          <button className="btn btn-outline" onClick={onClose} type="button">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default function StaffInformation() {
  const readUser = () => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  };

  const user = useMemo(() => readUser(), []);
  const role = useMemo(() => norm(user?.role), [user]);

  const canEditStaff =
    role === "admin" ||
    role === "hr" ||
    role === "accounting" ||
    role === "branch manager" ||
    role === "area manager" ||
    role === "regional manager" ||
    role === "assistant vice president";

  const [staff, setStaff] = useState([]);
  const [branches, setBranches] = useState([]);
  const [positionRates, setPositionRates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [branchSearch, setBranchSearch] = useState("");

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const [viewStaff, setViewStaff] = useState(null);
  const [editStaff, setEditStaff] = useState(null);

  const [saving, setSaving] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");

  const [formStep, setFormStep] = useState(1);
  const base = useMemo(() => getBase(), []);

  const [balanceForm, setBalanceForm] = useState({
    cbu: "",
    cashbond: "",
    utility: "",
    salary_advance: "",
    special_advance: "",
    cash_advance: "",
    motorcycle_loan: "",
    pag_ibig_loan: "",
    other_receivable: "",
    staff_accounts_payable: "",
  });

  const branchMap = useMemo(() => {
    const m = new Map();
    (branches || []).forEach((b) => m.set(String(b.id), b));
    return m;
  }, [branches]);

  const branchNameById = useCallback(
    (id) => {
      if (id == null || id === "") return "";
      const b = branchMap.get(String(id));
      return b ? b.name : String(id);
    },
    [branchMap]
  );

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
    sss_no: "",
    philhealth_no: "",
    pagibig_no: "",
    tin_no: "",
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
    children: "[]",
    education: "[]",
    employment_history: "[]",
    beneficiaries: "[]",
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
    additional_target: "",
    repairing: "",
    additional_monitoring: "",
    other_deduction: "",
    sss_er: "",
    ph_er: "",
    hdmf_er: "",
    sss_ee: "",
    ph_ee: "",
    hdmf_ee: "",
    tax: "",
  });

  const avatarUrl = (s) => {
    const p = s?.photo_url;
    if (!p) return "";

    if (String(p).startsWith("http")) return p;

    const cleanPath = p.startsWith("/") ? p : `/${p}`;
    return `${base}${cleanPath}`;
  };

  const resetForm = () => {
    setForm({
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
      sss_no: "",
      philhealth_no: "",
      pagibig_no: "",
      tin_no: "",
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
      children: "[]",
      education: "[]",
      employment_history: "[]",
      beneficiaries: "[]",
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
      additional_target: "",
      repairing: "",
      additional_monitoring: "",
      other_deduction: "",
      sss_er: "",
      ph_er: "",
      hdmf_er: "",
      sss_ee: "",
      ph_ee: "",
      hdmf_ee: "",
      tax: "",
    });

    setBalanceForm({
      cbu: "",
      cashbond: "",
      utility: "",
      salary_advance: "",
      special_advance: "",
      cash_advance: "",
      motorcycle_loan: "",
      pag_ibig_loan: "",
      other_receivable: "",
      staff_accounts_payable: "",
    });

    setPhotoFile(null);
    setPhotoPreview("");
    setFormStep(1);
  };

  const closeAllModals = () => {
    setViewStaff(null);
    setEditStaff(null);
    resetForm();
  };

  const onChange = (e) =>
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const onBalanceChange = (e) =>
    setBalanceForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const onPickPhoto = (file) => {
    setPhotoFile(file || null);
    if (!file) return setPhotoPreview("");
    const r = new FileReader();
    r.onload = () => setPhotoPreview(String(r.result || ""));
    r.readAsDataURL(file);
  };

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [staffRes, branchesRes] = await Promise.allSettled([
        api.get("/staff"),
        api.get("/branches"),
      ]);

      if (staffRes.status === "fulfilled") {
        setStaff(Array.isArray(staffRes.value.data) ? staffRes.value.data : []);
      } else {
        setStaff([]);
      }

      if (branchesRes.status === "fulfilled") {
        setBranches(Array.isArray(branchesRes.value.data) ? branchesRes.value.data : []);
      } else {
        setBranches([]);
      }

      if (staffRes.status === "rejected") {
        setError(
          staffRes.reason?.response?.data?.message ||
            staffRes.reason?.message ||
            "Failed to load staff data."
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPositionRates = useCallback(async () => {
    try {
      const res = await api.get("/comp-rates");
      setPositionRates(Array.isArray(res.data) ? res.data : []);
    } catch {
      setPositionRates([]);
    }
  }, []);

  useEffect(() => {
    loadAll();
    loadPositionRates();
  }, [loadAll, loadPositionRates]);

  useEffect(() => {
    const isAnyModalOpen = !!viewStaff || !!editStaff;
    if (!isAnyModalOpen) return;

    const onKey = (e) => e.key === "Escape" && closeAllModals();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [viewStaff, editStaff]);

  const filteredStaff = useMemo(() => {
    const q = norm(search);
    return staff.filter((s) => {
      const st = String(s.status || "Active");
      if (statusFilter !== "All" && st !== statusFilter) return false;
      if (!q) return true;

      const hay = [
        s.id,
        s.employee_no,
        s.fullname,
        s.last_name,
        s.first_name,
        s.middle_name,
        s.position,
        s.department,
        s.area,
        s.region,
        s.division,
        s.branch_id,
        branchNameById(s.branch_id),
        s.status,
        s.address,
        s.municipality,
        s.province,
        s.contact,
        s.email,
      ]
        .map((x) => norm(x))
        .join(" ");

      return hay.includes(q);
    });
  }, [staff, search, statusFilter, branchNameById]);

  const isStaffStepValid = useMemo(
    () => !!toStr(form.last_name) && !!toStr(form.first_name),
    [form.last_name, form.first_name]
  );

  const isContractStepValid = useMemo(
    () => !!toStr(form.position),
    [form.position]
  );

  const setStepGuarded = (nextStep) => {
    if (nextStep === 2 && !isStaffStepValid) {
      alert("Please complete required fields in Staff Details (Last Name, First Name).");
      return;
    }
    if (nextStep === 3 && !isContractStepValid) {
      alert("Position is required in Contract Details.");
      return;
    }
    setFormStep(nextStep);
  };

  const openEdit = async (s) => {
    if (!canEditStaff) {
      alert("Only Admin, HR, Accounting, and Branch Manager can edit staff.");
      return;
    }

    setEditStaff(s);

    setForm({
      employee_no: s.employee_no || "",
      last_name: s.last_name || "",
      first_name: s.first_name || "",
      middle_name: s.middle_name || "",
      address: String(s.address ?? ""),
      municipality: String(s.municipality ?? ""),
      province: String(s.province ?? ""),
      contact: String(s.contact ?? ""),
      email: String(s.email ?? ""),
      date_of_birth: s.date_of_birth ? String(s.date_of_birth).slice(0, 10) : "",
      place_of_birth: String(s.place_of_birth ?? ""),
      gender: String(s.gender ?? ""),
      civil_status: String(s.civil_status ?? ""),
      citizenship: String(s.citizenship ?? ""),
      height: String(s.height ?? ""),
      weight: String(s.weight ?? ""),
      religion: String(s.religion ?? ""),
      blood_type: String(s.blood_type ?? ""),
      spouse_fullname: String(s.spouse_fullname ?? ""),
      spouse_address: String(s.spouse_address ?? ""),
      spouse_occupation: String(s.spouse_occupation ?? ""),
      spouse_employer: String(s.spouse_employer ?? ""),
      sss_no: String(s.sss_no ?? ""),
      philhealth_no: String(s.philhealth_no ?? ""),
      pagibig_no: String(s.pagibig_no ?? ""),
      tin_no: String(s.tin_no ?? ""),
      father_fullname: String(s.father_fullname ?? ""),
      father_address: String(s.father_address ?? ""),
      father_occupation: String(s.father_occupation ?? ""),
      father_employer: String(s.father_employer ?? ""),
      father_contact: String(s.father_contact ?? ""),
      mother_fullname: String(s.mother_fullname ?? ""),
      mother_address: String(s.mother_address ?? ""),
      mother_occupation: String(s.mother_occupation ?? ""),
      mother_employer: String(s.mother_employer ?? ""),
      mother_contact: String(s.mother_contact ?? ""),
      guardian_fullname: String(s.guardian_fullname ?? ""),
      guardian_address: String(s.guardian_address ?? ""),
      guardian_occupation: String(s.guardian_occupation ?? ""),
      guardian_employer: String(s.guardian_employer ?? ""),
      guardian_contact: String(s.guardian_contact ?? ""),
      children: typeof s.children === "string" ? s.children : JSON.stringify(s.children ?? [], null, 2),
      education: typeof s.education === "string" ? s.education : JSON.stringify(s.education ?? [], null, 2),
      employment_history:
        typeof s.employment_history === "string"
          ? s.employment_history
          : JSON.stringify(s.employment_history ?? [], null, 2),
      beneficiaries:
        typeof s.beneficiaries === "string"
          ? s.beneficiaries
          : JSON.stringify(s.beneficiaries ?? [], null, 2),

      position: String(s.position ?? ""),
      department: String(s.department ?? ""),
      area: String(s.area ?? ""),
      region: String(s.region ?? ""),
      division: String(s.division ?? ""),
      branch_id: s.branch_id ? String(s.branch_id) : "",
      status: String(s.status ?? "Active"),
      start_date: s.start_date ? String(s.start_date).slice(0, 10) : "",
      regularization_date: s.regularization_date ? String(s.regularization_date).slice(0, 10) : "",
      salary: String(s.salary ?? ""),
      ecola: String(s.ecola ?? ""),
      cbu: String(s.cbu ?? ""),
      cashbond: String(s.cashbond ?? ""),
      utility: String(s.utility ?? ""),
      transportation: String(s.transportation ?? ""),
      repairing: String(s.repairing ?? ""),
      postage: String(s.postage ?? ""),
      additional_target: String(s.additional_target ?? ""),
      additional_monitoring: String(s.additional_monitoring ?? ""),
      other_deduction: String(s.other_deduction ?? ""),
      sss_er: String(s.sss_er ?? ""),
      ph_er: String(s.ph_er ?? ""),
      hdmf_er: String(s.hdmf_er ?? ""),
      sss_ee: String(s.sss_ee ?? ""),
      ph_ee: String(s.ph_ee ?? ""),
      hdmf_ee: String(s.hdmf_ee ?? ""),
      tax: String(s.tax ?? ""),
    });

    const selectedBranch = branches.find(
      (b) => String(b.id) === String(s.branch_id)
    );

    setBranchSearch(
      selectedBranch
        ? `${toStr(selectedBranch.code)} - ${toStr(selectedBranch.name)}`.trim()
        : ""
    );

    setPhotoPreview();
    setFormStep(1);
  };

  const buildPayload = () => {
    const total_er = toNum(form.sss_er) + toNum(form.ph_er) + toNum(form.hdmf_er);
    const total_ee = toNum(form.sss_ee) + toNum(form.ph_ee) + toNum(form.hdmf_ee);

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
      additional_target: toNum(form.additional_target),
      repairing: toNum(form.repairing),
      additional_monitoring: toNum(form.additional_monitoring),
      other_deduction: toNum(form.other_deduction),
      sss_er: toNum(form.sss_er),
      ph_er: toNum(form.ph_er),
      hdmf_er: toNum(form.hdmf_er),
      total_er,
      sss_ee: toNum(form.sss_ee),
      ph_ee: toNum(form.ph_ee),
      hdmf_ee: toNum(form.hdmf_ee),
      total_ee,
      tax: toNum(form.tax),
      children: safeJsonArray(form.children),
      education: safeJsonArray(form.education),
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
    };
  };

  const buildBalancePayload = () => ({
    cbu: toNum(balanceForm.cbu),
    cashbond: toNum(balanceForm.cashbond),
    utility: toNum(balanceForm.utility),
    salary_advance: toNum(balanceForm.salary_advance),
    special_advance: toNum(balanceForm.special_advance),
    cash_advance: toNum(balanceForm.cash_advance),
    motorcycle_loan: toNum(balanceForm.motorcycle_loan),
    pag_ibig_loan: toNum(balanceForm.pag_ibig_loan),
    other_receivable: toNum(balanceForm.other_receivable),
    staff_accounts_payable: toNum(balanceForm.staff_accounts_payable),
  });

  const updateStaff = async (e) => {
    e.preventDefault();

    if (!canEditStaff) {
      alert("Only Admin, HR, and Accounting can edit staff.");
      return;
    }

    if (!editStaff) return;

    if (!isStaffStepValid) {
      alert("Please complete required fields in Staff Details (Last Name, First Name).");
      setFormStep(1);
      return;
    }

    if (formStep === 1) {
      setFormStep(2);
      return;
    }

    if (!isContractStepValid) {
      alert("Position is required in Contract Details.");
      setFormStep(2);
      return;
    }

    if (formStep === 2) {
      setFormStep(3);
      return;
    }

    setSaving(true);
    try {
      const payload = buildPayload();
      await api.put(`/staff/${editStaff.id}`, payload);

      await api.put(`/staff-balances/${payload.employee_no}`, buildBalancePayload());

      if (photoFile) {
        const fd = new FormData();
        fd.append("photo", photoFile);
        await api.post(`/staff/${editStaff.id}/photo`, fd);
      }

      closeAllModals();
      await loadAll();
      alert("Staff updated.");
    } catch (err) {
      alert(err?.response?.data?.message || err.message || "Failed to update staff.");
    } finally {
      setSaving(false);
    }
  };

  const statusBadgeClass = (s) =>
    String(s || "Active") === "Inactive" ? "status-badge inactive" : "status-badge active";

  return (
    <div className="staffinfo-page">
      <div className="staffinfo-header">
        <div>
          <h2>Staff Information</h2>
          <p>View staff, edit staff, upload photo, and set Active/Inactive status.</p>
        </div>

        <div className="staffinfo-actions">
          <button className="btn btn-outline" onClick={loadAll} type="button">
            Refresh
          </button>
        </div>
      </div>

      <div className="card staffinfo-controls">
        <div className="search-wrap" style={{ gap: 10 }}>
          <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ width: 160 }}>
            <option value="All">All Status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>

          <input
            className="input"
            placeholder="Search by ID, name, position, department, area, region, division, branch..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && setSearch(searchInput)}
          />

          <button className="btn btn-outline" onClick={() => setSearch(searchInput)} type="button">
            Search
          </button>

          <button
            className="btn btn-ghost"
            type="button"
            onClick={() => {
              setSearch("");
              setSearchInput("");
            }}
          >
            Clear
          </button>

          <div className="pill">
            Results: <strong>{filteredStaff.length}</strong>
          </div>
        </div>
      </div>

      <div className="card staffinfo-table-card">
        {loading ? (
          <div className="table-loading">Loading staff…</div>
        ) : error ? (
          <div className="table-loading" style={{ color: "#ef4444" }}>
            {error}
          </div>
        ) : (
          <div className="table-scroll">
            <table className="saas-table staffinfo-table">
              <thead>
                <tr>
                  <th style={{ width: 70 }}></th>
                  <th style={{ width: 90 }}>Slot</th>
                  <th style={{ width: 120 }}>Emp No</th>
                  <th>Name</th>
                  <th style={{ width: 180 }}>Position</th>
                  <th style={{ width: 180 }}>Department</th>
                  <th style={{ width: 200 }}>Branch</th>
                  <th style={{ width: 120 }}>Status</th>
                  <th style={{ width: 140 }}>Start Date</th>
                  <th style={{ width: 140 }}>Regularized</th>
                  <th style={{ width: 260 }}>Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredStaff.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="empty">
                      No staff found.
                    </td>
                  </tr>
                ) : (
                  filteredStaff.map((s) => (
                    <tr key={s.id}>
                      <td>
                        {avatarUrl(s) ? (
                          <img className="staff-avatar" src={avatarUrl(s)} alt="staff" />
                        ) : (
                          <div className="staff-avatar staff-avatar--fallback">
                            {displayName(s).slice(0, 1).toUpperCase() || "?"}
                          </div>
                        )}
                      </td>

                      <td className="mono">{s.id}</td>
                      <td className="mono">{s.employee_no || "-"}</td>
                      <td className="strong">{displayName(s)}</td>
                      <td>{s.position || "-"}</td>
                      <td>{s.department || "-"}</td>
                      <td>{branchNameById(s.branch_id) || "-"}</td>

                      <td>
                        <span className={statusBadgeClass(s.status)}>{String(s.status || "Active")}</span>
                      </td>

                      <td>{fmtDate(s.start_date)}</td>
                      <td>{fmtDate(s.regularization_date)}</td>

                      <td>
                        <div className="actions">
                          <button className="action-btn btn-view" onClick={() => setViewStaff(s)} type="button">
                            View
                          </button>
                          <button className="action-btn btn-edit" onClick={() => openEdit(s)} type="button">
                            Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {viewStaff && (
        <StaffProfileModal
          staff={viewStaff}
          avatarUrl={avatarUrl}
          onClose={closeAllModals}
          branchNameById={branchNameById}
        />
      )}

      {editStaff && (
        <div className="modal-overlay" onMouseDown={closeAllModals}>
          <div className="modal staff-profile-modal" onMouseDown={(e) => e.stopPropagation()} style={{ maxWidth: 1200 }}>
            <div className="modal-head">
              <div>
                <h3>Edit Staff</h3>
                <div className="mini">
                  {displayFormName(form) || displayName(editStaff)} • {form.position || "-"} • {form.status || "Active"}
                </div>
              </div>
              <button className="icon-btn" onClick={closeAllModals} type="button">
                ✕
              </button>
            </div>

            <form onSubmit={updateStaff}>
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

                <StepTabs
                  step={formStep}
                  onSelectStep={setStepGuarded}
                  canGoContract={isStaffStepValid}
                  canGoBalances={isContractStepValid}
                />
                <br />

                {formStep === 1 && <StaffDetailsStep form={form} onChange={onChange} />}
                
                {formStep === 2 && (
                  <ContractDetailsStep
                    form={form}
                    branches={branches}
                    positionRates={positionRates}
                    onChange={onChange}
                    branchSearch={branchSearch}
                    setBranchSearch={setBranchSearch}
                  />
                )}
                
                {formStep === 3 && <PersonalBalancesStep balanceForm={balanceForm} onBalanceChange={onBalanceChange} />}
              </div>

              <div className="modal-foot">
                {formStep === 1 && (
                  <>
                    <button className="btn btn-primary" type="button" onClick={() => setStepGuarded(2)} disabled={!isStaffStepValid}>
                      Next
                    </button>
                    <button className="btn btn-ghost" type="button" onClick={closeAllModals}>
                      Cancel
                    </button>
                  </>
                )}

                {formStep === 2 && (
                  <>
                    <button className="btn btn-outline" type="button" onClick={() => setFormStep(1)}>
                      Back
                    </button>
                    <button className="btn btn-primary" type="button" onClick={() => setStepGuarded(3)} disabled={!isContractStepValid}>
                      Next
                    </button>
                    <button className="btn btn-ghost" type="button" onClick={closeAllModals}>
                      Cancel
                    </button>
                  </>
                )}

                {formStep === 3 && (
                  <>
                    <button className="btn btn-outline" type="button" onClick={() => setFormStep(2)}>
                      Back
                    </button>
                    <button className="btn btn-primary" type="submit" disabled={saving}>
                      {saving ? "Updating..." : "Update Staff"}
                    </button>
                    <button className="btn btn-ghost" type="button" onClick={closeAllModals}>
                      Cancel
                    </button>
                  </>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}