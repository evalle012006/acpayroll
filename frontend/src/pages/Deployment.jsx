import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axiosClient";
import "../styles/Deployments.css";
import "../styles/StaffInformation.css";

const toStr = (v) => String(v ?? "").trim();
const toDate10 = (v) => (v ? String(v).slice(0, 10) : "");
const norm = (v) => toStr(v).toLowerCase();

const toNum = (v) => {
  const s = String(v ?? "").trim();
  if (!s) return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

const getBase = () => {
  const base = api.defaults.baseURL || "";
  return base.endsWith("/api") ? base.slice(0, -4) : base;
};

const displayNameParts = (s) => {
  const ln = toStr(s?.last_name);
  const fn = toStr(s?.first_name);
  const mn = toStr(s?.middle_name);
  const built = `${ln}${ln && fn ? ", " : ""}${fn}${mn ? ` ${mn}` : ""}`.replace(/\s+/g, " ").trim();
  return built || toStr(s?.fullname) || toStr(s?.employee_name) || "-";
};

const safeJsonArray = (v) => {
  try {
    const parsed = typeof v === "string" ? JSON.parse(v) : v;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const calcAge = (dob) => {
  const s = toStr(dob);
  if (!s) return "";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age < 0 ? "" : String(age);
};

const DividerRow = () => (
  <tr>
    <td colSpan={2}>
      <div style={{ height: 1, background: "rgba(255,255,255,0.08)" }} />
    </td>
  </tr>
);

function EditableCell({ value, placeholder, align = "right", onChange }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    const next = String(value ?? "");
    if (ref.current.innerText !== next) ref.current.innerText = next;
  }, [value]);

  const emit = () => {
    const txt = String(ref.current?.innerText ?? "")
      .replace(/\u00A0/g, " ")
      .replace(/\n/g, " ")
      .trim();
    onChange?.(txt);
  };

  return (
    <span
      ref={ref}
      className="editable-value editable-placeholder"
      data-placeholder={placeholder || ""}
      contentEditable
      suppressContentEditableWarning
      style={{ textAlign: align, display: "inline-block" }}
      onInput={emit}
      onBlur={emit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.preventDefault();
      }}
    />
  );
}

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

function StaffDetailsStep({ form, setForm }) {
  const setField = (name, v) => setForm((p) => ({ ...p, [name]: v }));

  const children = useMemo(() => {
    const arr = safeJsonArray(form.children);
    return arr.length ? arr : [{ fullname: "", date_of_birth: "", place_of_birth: "", age: "" }];
  }, [form.children]);

  const setChildren = (arr) => setField("children", JSON.stringify(arr, null, 2));

  const setChildField = (idx, key, value) => {
    const next = [...children];
    const row = { ...(next[idx] || { fullname: "", date_of_birth: "", place_of_birth: "", age: "" }) };

    row[key] = value;
    if (key === "date_of_birth") row.age = calcAge(value);

    next[idx] = row;
    setChildren(next);
  };

  const addChild = () => setChildren([...children, { fullname: "", date_of_birth: "", place_of_birth: "", age: "" }]);

  const removeChild = (idx) => {
    const next = [...children];
    next.splice(idx, 1);
    setChildren(next.length ? next : [{ fullname: "", date_of_birth: "", place_of_birth: "", age: "" }]);
  };

  return (
    <div className="modal-body staff-add-grid">
      <div className="staff-add-left" style={{ width: "100%" }}>
        <table className="editable-table">
          <tbody>
            <tr>
              <td className="editable-section" colSpan={2}>
                Employee Details
              </td>
            </tr>

            <tr>
              <td>Employee No</td>
              <td>
                <EditableCell
                  value={form.employee_no}
                  placeholder="Type employee no..."
                  onChange={(v) => setField("employee_no", v)}
                />
              </td>
            </tr>

            <tr>
              <td>Last Name *</td>
              <td>
                <EditableCell value={form.last_name} placeholder="Type last name..." onChange={(v) => setField("last_name", v)} />
              </td>
            </tr>

            <tr>
              <td>First Name *</td>
              <td>
                <EditableCell value={form.first_name} placeholder="Type first name..." onChange={(v) => setField("first_name", v)} />
              </td>
            </tr>

            <tr>
              <td>Middle Name</td>
              <td>
                <EditableCell value={form.middle_name} placeholder="Type middle name..." onChange={(v) => setField("middle_name", v)} />
              </td>
            </tr>

            <tr>
              <td className="editable-section" colSpan={2}>
                Contact Details
              </td>
            </tr>

            <tr>
              <td>Address</td>
              <td>
                <EditableCell value={form.address} placeholder="Type address..." onChange={(v) => setField("address", v)} />
              </td>
            </tr>

            <tr>
              <td>Municipality</td>
              <td>
                <EditableCell value={form.municipality} placeholder="Type municipality..." onChange={(v) => setField("municipality", v)} />
              </td>
            </tr>

            <tr>
              <td>Province</td>
              <td>
                <EditableCell value={form.province} placeholder="Type province..." onChange={(v) => setField("province", v)} />
              </td>
            </tr>

            <tr>
              <td>Contact</td>
              <td>
                <EditableCell value={form.contact} placeholder="Type contact..." onChange={(v) => setField("contact", v)} />
              </td>
            </tr>

            <tr>
              <td>Email</td>
              <td>
                <EditableCell value={form.email} placeholder="Type email..." onChange={(v) => setField("email", v)} />
              </td>
            </tr>

            <tr>
              <td className="editable-section" colSpan={2}>
                Employee Background
              </td>
            </tr>

            <tr>
              <td>Date of Birth</td>
              <td>
                <EditableCell value={form.date_of_birth} placeholder="YYYY-MM-DD" onChange={(v) => setField("date_of_birth", v)} />
              </td>
            </tr>

            <tr>
              <td>Place of Birth</td>
              <td>
                <EditableCell value={form.place_of_birth} placeholder="Type place of birth..." onChange={(v) => setField("place_of_birth", v)} />
              </td>
            </tr>

            <tr>
              <td>Gender</td>
              <td style={{ textAlign: "right" }}>
                <select
                  className="input"
                  style={{ width: 280, textAlignLast: "right" }}
                  value={form.gender}
                  onChange={(e) => setField("gender", e.target.value)}
                >
                  <option value="">Select...</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </select>
              </td>
            </tr>

            <tr>
              <td>Civil Status</td>
              <td style={{ textAlign: "right" }}>
                <select
                  className="input"
                  style={{ width: 280, textAlignLast: "right" }}
                  value={form.civil_status}
                  onChange={(e) => setField("civil_status", e.target.value)}
                >
                  <option value="">Select...</option>
                  <option value="Single">Single</option>
                  <option value="Married">Married</option>
                  <option value="Separated">Separated</option>
                  <option value="Widowed">Widowed</option>
                </select>
              </td>
            </tr>

            <tr>
              <td>Citizenship</td>
              <td>
                <EditableCell value={form.citizenship} placeholder="Type citizenship..." onChange={(v) => setField("citizenship", v)} />
              </td>
            </tr>

            <tr>
              <td>Height</td>
              <td>
                <EditableCell value={form.height} placeholder="e.g., 170" onChange={(v) => setField("height", v)} />
              </td>
            </tr>

            <tr>
              <td>Weight</td>
              <td>
                <EditableCell value={form.weight} placeholder="e.g., 65" onChange={(v) => setField("weight", v)} />
              </td>
            </tr>

            <tr>
              <td>Religion</td>
              <td>
                <EditableCell value={form.religion} placeholder="Type religion..." onChange={(v) => setField("religion", v)} />
              </td>
            </tr>

            <tr>
              <td>Blood Type</td>
              <td>
                <EditableCell value={form.blood_type} placeholder="e.g., O+" onChange={(v) => setField("blood_type", v)} />
              </td>
            </tr>

            <tr>
              <td className="editable-section" colSpan={2}>
                Spouse & Family
              </td>
            </tr>

            <tr>
              <td>Spouse Fullname</td>
              <td>
                <EditableCell value={form.spouse_fullname} placeholder="Type spouse fullname..." onChange={(v) => setField("spouse_fullname", v)} />
              </td>
            </tr>

            <tr>
              <td>Spouse Address</td>
              <td>
                <EditableCell value={form.spouse_address} placeholder="Type spouse address..." onChange={(v) => setField("spouse_address", v)} />
              </td>
            </tr>

            <tr>
              <td>Spouse Occupation</td>
              <td>
                <EditableCell value={form.spouse_occupation} placeholder="Type spouse occupation..." onChange={(v) => setField("spouse_occupation", v)} />
              </td>
            </tr>

            <tr>
              <td>Spouse Employer</td>
              <td>
                <EditableCell value={form.spouse_employer} placeholder="Type spouse employer..." onChange={(v) => setField("spouse_employer", v)} />
              </td>
            </tr>

            <tr>
              <td className="editable-section" colSpan={2}>
                Children
              </td>
            </tr>

            {children.map((c, idx) => (
              <React.Fragment key={idx}>
                <tr>
                  <td style={{ fontWeight: 900 }}>Child #{idx + 1}</td>
                  <td style={{ textAlign: "right" }}>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => removeChild(idx)}
                      disabled={children.length <= 1}
                      style={{ padding: "6px 10px" }}
                      title={children.length <= 1 ? "At least one child row is required" : "Remove child"}
                    >
                      Remove
                    </button>
                  </td>
                </tr>

                <tr>
                  <td>Fullname</td>
                  <td>
                    <EditableCell
                      value={toStr(c?.fullname)}
                      placeholder="Type child fullname..."
                      onChange={(v) => setChildField(idx, "fullname", v)}
                    />
                  </td>
                </tr>

                <tr>
                  <td>Date of Birth</td>
                  <td>
                    <EditableCell
                      value={toStr(c?.date_of_birth)}
                      placeholder="YYYY-MM-DD"
                      onChange={(v) => setChildField(idx, "date_of_birth", v)}
                    />
                  </td>
                </tr>

                <tr>
                  <td>Place of Birth</td>
                  <td>
                    <EditableCell
                      value={toStr(c?.place_of_birth)}
                      placeholder="Type place of birth..."
                      onChange={(v) => setChildField(idx, "place_of_birth", v)}
                    />
                  </td>
                </tr>

                <tr>
                  <td>Age</td>
                  <td>
                    <EditableCell value={toStr(c?.age)} placeholder="Auto" onChange={(v) => setChildField(idx, "age", v)} />
                  </td>
                </tr>

                <DividerRow />
              </React.Fragment>
            ))}

            <tr>
              <td />
              <td style={{ textAlign: "right" }}>
                <button type="button" className="btn btn-outline" onClick={addChild}>
                  + Add Child
                </button>
              </td>
            </tr>

            <tr>
              <td className="editable-section" colSpan={2}>
                Parents / Guardian
              </td>
            </tr>

            <tr>
              <td>Father Fullname</td>
              <td>
                <EditableCell value={form.father_fullname} placeholder="Type father fullname..." onChange={(v) => setField("father_fullname", v)} />
              </td>
            </tr>
            <tr>
              <td>Father Address</td>
              <td>
                <EditableCell value={form.father_address} placeholder="Type father address..." onChange={(v) => setField("father_address", v)} />
              </td>
            </tr>
            <tr>
              <td>Father Occupation</td>
              <td>
                <EditableCell value={form.father_occupation} placeholder="Type father occupation..." onChange={(v) => setField("father_occupation", v)} />
              </td>
            </tr>
            <tr>
              <td>Father Employer</td>
              <td>
                <EditableCell value={form.father_employer} placeholder="Type father employer..." onChange={(v) => setField("father_employer", v)} />
              </td>
            </tr>
            <tr>
              <td>Father Contact</td>
              <td>
                <EditableCell value={form.father_contact} placeholder="Type father contact..." onChange={(v) => setField("father_contact", v)} />
              </td>
            </tr>

            <tr>
              <td>Mother Fullname</td>
              <td>
                <EditableCell value={form.mother_fullname} placeholder="Type mother fullname..." onChange={(v) => setField("mother_fullname", v)} />
              </td>
            </tr>
            <tr>
              <td>Mother Address</td>
              <td>
                <EditableCell value={form.mother_address} placeholder="Type mother address..." onChange={(v) => setField("mother_address", v)} />
              </td>
            </tr>
            <tr>
              <td>Mother Occupation</td>
              <td>
                <EditableCell value={form.mother_occupation} placeholder="Type mother occupation..." onChange={(v) => setField("mother_occupation", v)} />
              </td>
            </tr>
            <tr>
              <td>Mother Employer</td>
              <td>
                <EditableCell value={form.mother_employer} placeholder="Type mother employer..." onChange={(v) => setField("mother_employer", v)} />
              </td>
            </tr>
            <tr>
              <td>Mother Contact</td>
              <td>
                <EditableCell value={form.mother_contact} placeholder="Type mother contact..." onChange={(v) => setField("mother_contact", v)} />
              </td>
            </tr>

            <tr>
              <td>Guardian Fullname</td>
              <td>
                <EditableCell value={form.guardian_fullname} placeholder="Type guardian fullname..." onChange={(v) => setField("guardian_fullname", v)} />
              </td>
            </tr>
            <tr>
              <td>Guardian Address</td>
              <td>
                <EditableCell value={form.guardian_address} placeholder="Type guardian address..." onChange={(v) => setField("guardian_address", v)} />
              </td>
            </tr>
            <tr>
              <td>Guardian Occupation</td>
              <td>
                <EditableCell value={form.guardian_occupation} placeholder="Type guardian occupation..." onChange={(v) => setField("guardian_occupation", v)} />
              </td>
            </tr>
            <tr>
              <td>Guardian Employer</td>
              <td>
                <EditableCell value={form.guardian_employer} placeholder="Type guardian employer..." onChange={(v) => setField("guardian_employer", v)} />
              </td>
            </tr>
            <tr>
              <td>Guardian Contact</td>
              <td>
                <EditableCell value={form.guardian_contact} placeholder="Type guardian contact..." onChange={(v) => setField("guardian_contact", v)} />
              </td>
            </tr>

            <tr>
              <td className="editable-section" colSpan={2}>
                Education
              </td>
            </tr>

            <tr>
              <td style={{ fontWeight: 900, opacity: 0.95 }} colSpan={2}>
                Primary
              </td>
            </tr>
            <tr>
              <td>School Name</td>
              <td>
                <EditableCell
                  value={form.primary_school_name}
                  placeholder="Type primary school name..."
                  onChange={(v) => setField("primary_school_name", v)}
                />
              </td>
            </tr>
            <tr>
              <td>Year Started</td>
              <td>
                <EditableCell
                  value={form.primary_year_started}
                  placeholder="e.g., 2008"
                  onChange={(v) => setField("primary_year_started", v)}
                />
              </td>
            </tr>
            <tr>
              <td>Year Graduated</td>
              <td>
                <EditableCell
                  value={form.primary_year_graduated}
                  placeholder="e.g., 2014"
                  onChange={(v) => setField("primary_year_graduated", v)}
                />
              </td>
            </tr>

            <DividerRow />

            <tr>
              <td style={{ fontWeight: 900, opacity: 0.95 }} colSpan={2}>
                Secondary
              </td>
            </tr>
            <tr>
              <td>School Name</td>
              <td>
                <EditableCell
                  value={form.secondary_school_name}
                  placeholder="Type secondary school name..."
                  onChange={(v) => setField("secondary_school_name", v)}
                />
              </td>
            </tr>
            <tr>
              <td>Year Started</td>
              <td>
                <EditableCell
                  value={form.secondary_year_started}
                  placeholder="e.g., 2014"
                  onChange={(v) => setField("secondary_year_started", v)}
                />
              </td>
            </tr>
            <tr>
              <td>Year Graduated</td>
              <td>
                <EditableCell
                  value={form.secondary_year_graduated}
                  placeholder="e.g., 2018"
                  onChange={(v) => setField("secondary_year_graduated", v)}
                />
              </td>
            </tr>

            <DividerRow />

            <tr>
              <td style={{ fontWeight: 900, opacity: 0.95 }} colSpan={2}>
                Tertiary
              </td>
            </tr>
            <tr>
              <td>School Name</td>
              <td>
                <EditableCell
                  value={form.tertiary_school_name}
                  placeholder="Type tertiary school name..."
                  onChange={(v) => setField("tertiary_school_name", v)}
                />
              </td>
            </tr>
            <tr>
              <td>Course</td>
              <td>
                <EditableCell value={form.tertiary_course} placeholder="Type course..." onChange={(v) => setField("tertiary_course", v)} />
              </td>
            </tr>
            <tr>
              <td>Major</td>
              <td>
                <EditableCell value={form.tertiary_major} placeholder="Type major..." onChange={(v) => setField("tertiary_major", v)} />
              </td>
            </tr>
            <tr>
              <td>Year Started</td>
              <td>
                <EditableCell
                  value={form.tertiary_year_started}
                  placeholder="e.g., 2018"
                  onChange={(v) => setField("tertiary_year_started", v)}
                />
              </td>
            </tr>
            <tr>
              <td>Year Graduated</td>
              <td>
                <EditableCell
                  value={form.tertiary_year_graduated}
                  placeholder="e.g., 2022"
                  onChange={(v) => setField("tertiary_year_graduated", v)}
                />
              </td>
            </tr>

            <tr>
              <td className="editable-section" colSpan={2}>
                Background (JSON arrays)
              </td>
            </tr>

            <tr>
              <td>Employment History (JSON)</td>
              <td>
                <textarea
                  className="input"
                  style={{ width: 280, textAlign: "left" }}
                  rows={5}
                  value={form.employment_history}
                  onChange={(e) => setField("employment_history", e.target.value)}
                />
              </td>
            </tr>

            <tr>
              <td>Beneficiaries (JSON)</td>
              <td>
                <textarea
                  className="input"
                  style={{ width: 280, textAlign: "left" }}
                  rows={5}
                  value={form.beneficiaries}
                  onChange={(e) => setField("beneficiaries", e.target.value)}
                />
              </td>
            </tr>

            <tr>
              <td className="editable-section" colSpan={2}>
                Remittances IDs
              </td>
            </tr>

            <tr>
              <td>SSS No.</td>
              <td>
                <EditableCell value={form.sss_no} placeholder="Type SSS no..." onChange={(v) => setField("sss_no", v)} />
              </td>
            </tr>
            <tr>
              <td>PhilHealth No.</td>
              <td>
                <EditableCell value={form.philhealth_no} placeholder="Type PhilHealth no..." onChange={(v) => setField("philhealth_no", v)} />
              </td>
            </tr>
            <tr>
              <td>Pag-Ibig No.</td>
              <td>
                <EditableCell value={form.pagibig_no} placeholder="Type Pag-Ibig no..." onChange={(v) => setField("pagibig_no", v)} />
              </td>
            </tr>
            <tr>
              <td>TIN No.</td>
              <td>
                <EditableCell value={form.tin_no} placeholder="Type TIN no..." onChange={(v) => setField("tin_no", v)} />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ContractDetailsStep({ form, branches, setForm }) {
  const setField = (name, v) => setForm((p) => ({ ...p, [name]: v }));

  const salaryTotal = toNum(form.salary) + toNum(form.ecola);
  const personalTotal = toNum(form.cbu) + toNum(form.cashbond) + toNum(form.utility);

  const transpoTotal =
    toNum(form.transportation) +
    toNum(form.repairing) +
    toNum(form.postage) +
    toNum(form.other_deduction) +
    toNum(form.additional_target) +
    toNum(form.additional_monitoring) +
    toNum(form.motorcycle) +
    toNum(form.motorcycle_loan);

  const erTotal = toNum(form.sss_er) + toNum(form.ph_er) + toNum(form.hdmf_er);
  const eeTotal = toNum(form.sss_ee) + toNum(form.ph_ee) + toNum(form.hdmf_ee);

  return (
    <div className="modal-body staff-add-grid">
      <div className="staff-add-left" style={{ width: "100%" }}>
        <table className="editable-table">
          <tbody>
            <tr>
              <td className="editable-section" colSpan={2}>
                Employee Details
              </td>
            </tr>

            <tr>
              <td>Position *</td>
              <td>
                <EditableCell value={form.position} placeholder="Type position..." onChange={(v) => setField("position", v)} />
              </td>
            </tr>

            <tr>
              <td>Department</td>
              <td>
                <EditableCell value={form.department} placeholder="Type department..." onChange={(v) => setField("department", v)} />
              </td>
            </tr>

            <tr>
              <td>Area</td>
              <td>
                <EditableCell value={form.area} placeholder="Type area..." onChange={(v) => setField("area", v)} />
              </td>
            </tr>

            <tr>
              <td>Region</td>
              <td>
                <EditableCell value={form.region} placeholder="Type region..." onChange={(v) => setField("region", v)} />
              </td>
            </tr>

            <tr>
              <td>Division</td>
              <td>
                <EditableCell value={form.division} placeholder="Type division..." onChange={(v) => setField("division", v)} />
              </td>
            </tr>

            <tr>
              <td>Branch</td>
              <td style={{ textAlign: "right" }}>
                <select className="input" style={{ width: 280, textAlignLast: "right" }} value={form.branch_id} onChange={(e) => setField("branch_id", e.target.value)}>
                  <option value="">Select branch...</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </td>
            </tr>

            <tr>
              <td>Status</td>
              <td style={{ textAlign: "right" }}>
                <select className="input" style={{ width: 280, textAlignLast: "right" }} value={form.status} onChange={(e) => setField("status", e.target.value)}>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </td>
            </tr>

            <tr>
              <td>Start Date</td>
              <td>
                <EditableCell value={form.start_date} placeholder="YYYY-MM-DD" onChange={(v) => setField("start_date", v)} />
              </td>
            </tr>

            <tr>
              <td>Regularization Date</td>
              <td>
                <EditableCell value={form.regularization_date} placeholder="YYYY-MM-DD" onChange={(v) => setField("regularization_date", v)} />
              </td>
            </tr>

            <tr>
              <td className="editable-section" colSpan={2}>
                Salary Details
              </td>
            </tr>

            <tr>
              <td>Basic Salary</td>
              <td>
                <EditableCell value={form.salary} placeholder="0" onChange={(v) => setField("salary", v)} />
              </td>
            </tr>

            <tr>
              <td>Ecola</td>
              <td>
                <EditableCell value={form.ecola} placeholder="0" onChange={(v) => setField("ecola", v)} />
              </td>
            </tr>

            <tr>
              <td style={{ fontWeight: 900 }}>Total</td>
              <td style={{ fontWeight: 900 }}>{salaryTotal.toLocaleString()}</td>
            </tr>

            <tr>
              <td className="editable-section" colSpan={2}>
                Personal Deductions
              </td>
            </tr>

            <tr>
              <td>CBU</td>
              <td>
                <EditableCell value={form.cbu} placeholder="0" onChange={(v) => setField("cbu", v)} />
              </td>
            </tr>

            <tr>
              <td>Cashbond</td>
              <td>
                <EditableCell value={form.cashbond} placeholder="0" onChange={(v) => setField("cashbond", v)} />
              </td>
            </tr>

            <tr>
              <td>Utility</td>
              <td>
                <EditableCell value={form.utility} placeholder="0" onChange={(v) => setField("utility", v)} />
              </td>
            </tr>

            <tr>
              <td style={{ fontWeight: 900 }}>Total</td>
              <td style={{ fontWeight: 900 }}>{personalTotal.toLocaleString()}</td>
            </tr>

            <tr>
              <td className="editable-section" colSpan={2}>
                Transportation & Allowances
              </td>
            </tr>

            <tr>
              <td>Transportation</td>
              <td>
                <EditableCell value={form.transportation} placeholder="0" onChange={(v) => setField("transportation", v)} />
              </td>
            </tr>

            <tr>
              <td>Repairing</td>
              <td>
                <EditableCell value={form.repairing} placeholder="0" onChange={(v) => setField("repairing", v)} />
              </td>
            </tr>

            <tr>
              <td>Postage</td>
              <td>
                <EditableCell value={form.postage} placeholder="0" onChange={(v) => setField("postage", v)} />
              </td>
            </tr>

            <tr>
              <td>Motorcycle Loan</td>
              <td>
                <EditableCell value={form.motorcycle_loan} placeholder="0" onChange={(v) => setField("motorcycle_loan", v)} />
              </td>
            </tr>

            <tr>
              <td>Additional Target</td>
              <td>
                <EditableCell value={form.additional_target} placeholder="0" onChange={(v) => setField("additional_target", v)} />
              </td>
            </tr>

            <tr>
              <td>Additional Monitoring</td>
              <td>
                <EditableCell value={form.additional_monitoring} placeholder="0" onChange={(v) => setField("additional_monitoring", v)} />
              </td>
            </tr>

            <tr>
              <td>Motorcycle</td>
              <td>
                <EditableCell value={form.motorcycle} placeholder="0" onChange={(v) => setField("motorcycle", v)} />
              </td>
            </tr>

            <tr>
              <td>Others</td>
              <td>
                <EditableCell value={form.other_deduction} placeholder="0" onChange={(v) => setField("other_deduction", v)} />
              </td>
            </tr>

            <tr>
              <td style={{ fontWeight: 900 }}>Total</td>
              <td style={{ fontWeight: 900 }}>{transpoTotal.toLocaleString()}</td>
            </tr>

            <tr>
              <td className="editable-section" colSpan={2}>
                Remittances: ER
              </td>
            </tr>

            <tr>
              <td>SSS ER</td>
              <td>
                <EditableCell value={form.sss_er} placeholder="0" onChange={(v) => setField("sss_er", v)} />
              </td>
            </tr>

            <tr>
              <td>PhilHealth ER</td>
              <td>
                <EditableCell value={form.ph_er} placeholder="0" onChange={(v) => setField("ph_er", v)} />
              </td>
            </tr>

            <tr>
              <td>HDMF ER</td>
              <td>
                <EditableCell value={form.hdmf_er} placeholder="0" onChange={(v) => setField("hdmf_er", v)} />
              </td>
            </tr>

            <tr>
              <td style={{ fontWeight: 900 }}>Total ER</td>
              <td style={{ fontWeight: 900 }}>{erTotal.toLocaleString()}</td>
            </tr>

            <tr>
              <td className="editable-section" colSpan={2}>
                Remittances: EE
              </td>
            </tr>

            <tr>
              <td>SSS EE</td>
              <td>
                <EditableCell value={form.sss_ee} placeholder="0" onChange={(v) => setField("sss_ee", v)} />
              </td>
            </tr>

            <tr>
              <td>PhilHealth EE</td>
              <td>
                <EditableCell value={form.ph_ee} placeholder="0" onChange={(v) => setField("ph_ee", v)} />
              </td>
            </tr>

            <tr>
              <td>HDMF EE</td>
              <td>
                <EditableCell value={form.hdmf_ee} placeholder="0" onChange={(v) => setField("hdmf_ee", v)} />
              </td>
            </tr>

            <tr>
              <td style={{ fontWeight: 900 }}>Total EE</td>
              <td style={{ fontWeight: 900 }}>{eeTotal.toLocaleString()}</td>
            </tr>

            <tr>
              <td className="editable-section" colSpan={2}>
                Remittances: Tax
              </td>
            </tr>

            <tr>
              <td>Withheld Tax</td>
              <td>
                <EditableCell value={form.tax} placeholder="0" onChange={(v) => setField("tax", v)} />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StaffCreateModal({ branches, onClose, onCreated }) {
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

    employment_history: "[]",
    beneficiaries: "[]",

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
    motorcycle: "",
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
    if (next === 2 && !canGoContract) {
      alert("Please complete required fields in Staff Details (Last Name, First Name).");
      return;
    }
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
      motorcycle: toNum(form.motorcycle),
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
      const res = await api.post("/staff", payload);
      const newId = res.data?.id;

      if (photoFile && newId) {
        const fd = new FormData();
        fd.append("photo", photoFile);
        await api.post(`/staff/${newId}/photo`, fd);
      }

      await onCreated?.(newId);
      onClose?.();
      alert("Staff created.");
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

            <StepTabs step={step} onSelectStep={setStepGuarded} canGoContract={canGoContract} />
            <br />

            {step === 1 ? (
              <StaffDetailsStep form={form} setForm={setForm} />
            ) : (
              <ContractDetailsStep form={form} branches={branches} setForm={setForm} />
            )}
          </div>

          <div className="modal-foot">
            {step === 1 ? (
              <>
                <button className="btn btn-primary" type="button" onClick={() => setStepGuarded(2)} disabled={!canGoContract}>
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
                  {saving ? "Saving..." : "Save Staff"}
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

export default function Deployment() {
  const navigate = useNavigate();

  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  }, []);

  const role = norm(user?.role);
  const isAdmin = role === "admin";

  const [deployments, setDeployments] = useState([]);
  const [staff, setStaff] = useState([]);
  const [branches, setBranches] = useState([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [approvingId, setApprovingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [err, setErr] = useState("");

  const [showFormModal, setShowFormModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [viewRow, setViewRow] = useState(null);

  const [showAddStaff, setShowAddStaff] = useState(false);

  const makeEmptyDeploymentForm = useCallback(
    () => ({
      employee_id: "",
      last_name: "",
      first_name: "",
      middle_name: "",
      branch_id: "",
      deployment_date: "",
      details: "",
    }),
    []
  );

  const [form, setForm] = useState(() => makeEmptyDeploymentForm());

  const loadData = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const [d, s, b] = await Promise.all([api.get("/deployments"), api.get("/staff"), api.get("/branches")]);
      setDeployments(Array.isArray(d.data) ? d.data : []);
      setStaff(Array.isArray(s.data) ? s.data : []);
      setBranches(Array.isArray(b.data) ? b.data : []);
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to load deployment data.");
    } finally {
      setLoading(false);
    }
  }, []);

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
  }, [makeEmptyDeploymentForm]);

  useEffect(() => {
    const anyOpen = showFormModal || !!viewRow || showAddStaff;
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
  }, [showFormModal, viewRow, showAddStaff, resetAllModals]);

  const branchLabel = useCallback(
    (branchId) => {
      const b = branches.find((x) => String(x.id) === String(branchId));
      if (!b) return String(branchId || "-");
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
    setErr("");
    setEditingId(null);
    setForm(makeEmptyDeploymentForm());
    setShowFormModal(true);
  };

  const openEdit = (d) => {
    const statusLower = norm(d?.status || "pending");
    if (statusLower === "approved") return alert("Approved deployments cannot be edited.");

    setErr("");
    setEditingId(d.id);
    setForm({
      employee_id: d.employee_id ?? "",
      last_name: d.last_name ?? "",
      first_name: d.first_name ?? "",
      middle_name: d.middle_name ?? "",
      branch_id: d.branch_id ?? "",
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
    const branchId = Number(form.branch_id);

    if (!employeeId) return setErr("Employee is required.");
    if (!branchId) return setErr("Deployment branch is required.");
    if (!form.deployment_date) return setErr("Deployment date is required.");

    setSaving(true);
    try {
      const payload = {
        employee_id: employeeId,
        branch_id: branchId,
        deployment_date: toDate10(form.deployment_date),
        details: toStr(form.details) || null,
      };

      if (editingId) await api.put(`/deployments/${editingId}`, payload);
      else await api.post("/deployments", payload);

      closeFormModal();
      await loadData();
    } catch (e2) {
      setErr(e2?.response?.data?.message || "Failed to save deployment.");
    } finally {
      setSaving(false);
    }
  };

  const approveDeployment = async (d) => {
    if (!isAdmin) return alert("Admin only.");

    const statusLower = norm(d?.status || "pending");
    if (statusLower !== "pending") return;

    const ok = window.confirm(
      `Approve this deployment?\n\nEmployee: ${d.employee_name || displayNameParts(d)}\nTo Branch: ${
        d.branch_code || d.branch_name ? `${d.branch_code} • ${d.branch_name}` : branchLabel(d.branch_id)
      }\nDate: ${toDate10(d.deployment_date)}\n\nThis will UPDATE staff.branch_id.`
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
    if (!isAdmin) return alert("Admin only.");
    if (!d?.id) return;

    const statusLower = norm(d?.status || "pending");
    if (statusLower === "approved") return alert("Approved deployments cannot be deleted.");

    const ok = window.confirm(
      `Delete this deployment?\n\nEmployee: ${d.employee_name || displayNameParts(d)}\nBranch: ${
        d.branch_code || d.branch_name ? `${d.branch_code} • ${d.branch_name}` : branchLabel(d.branch_id)
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

  const modalTitle = editingId ? "Edit Deployment" : "Create Deployment";

  const onStaffCreated = async (newStaffId) => {
    await loadData();
    if (newStaffId) setForm((p) => ({ ...p, employee_id: String(newStaffId) }));
  };

  return (
    <div className="po-page">
      <div className="po-topbar">
        <h2 className="po-title">Deployment Orders</h2>

        <div className="po-topbar-actions">
          <button className="po-btn" type="button" onClick={() => navigate("/transactions")}>
            ← Back
          </button>

          <button className="po-btn" type="button" onClick={loadData} disabled={loading}>
            Refresh
          </button>

          <button className="po-btn" type="button" onClick={() => setShowAddStaff(true)}>
            + Add Staff
          </button>

        </div>
      </div>

      {err ? <div style={{ marginBottom: 12, color: "#ef4444", fontWeight: 800 }}>{err}</div> : null}

      <div className="po-card">
        <table className="po-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Deployment Branch</th>
              <th>Date</th>
              <th style={{ width: 320 }}>Details / Remarks</th>
              <th style={{ width: 320 }}>Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={{ padding: 16, opacity: 0.8 }}>
                  Loading...
                </td>
              </tr>
            ) : deployments.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: 16, opacity: 0.8 }}>
                  No deployment orders found.
                </td>
              </tr>
            ) : (
              deployments.map((d) => {
                const statusLower = norm(d?.status || "pending");
                const pending = statusLower === "pending";
                const branchText = d.branch_code || d.branch_name ? `${d.branch_code} • ${d.branch_name}` : branchLabel(d.branch_id);

                return (
                  <tr key={d.id}>
                    <td>
                      <div className="td-strong">{d.employee_name || displayNameParts(d)}</div>
                      <div style={{ fontSize: 12, opacity: 0.8 }}>
                        ID: <span className="mono">{d.employee_id}</span>
                        {d.status ? (
                          <>
                            {" "}
                            • <span className="mono">{d.status}</span>
                          </>
                        ) : null}
                      </div>
                    </td>

                    <td>{branchText}</td>
                    <td className="mono">{toDate10(d.deployment_date) || "-"}</td>

                    <td title={toStr(d.details)}>{toStr(d.details) ? toStr(d.details) : <span style={{ opacity: 0.75 }}>-</span>}</td>

                    <td>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button className="po-mini-btn" type="button" onClick={() => openEdit(d)} disabled={!pending}>
                          Edit
                        </button>

                        <button className="po-mini-btn" type="button" onClick={() => openViewModal(d)}>
                          View
                        </button>

                        {isAdmin && (
                          <>
                            <button
                              className="po-mini-btn"
                              type="button"
                              onClick={() => approveDeployment(d)}
                              disabled={!pending || approvingId === d.id}
                              title={!pending ? "Only pending can be approved" : "Approve"}
                            >
                              {approvingId === d.id ? "Approving..." : "Approve"}
                            </button>

                            <button
                              className="po-mini-btn"
                              type="button"
                              onClick={() => deleteDeployment(d)}
                              disabled={!pending || deletingId === d.id}
                              title={!pending ? "Only pending can be deleted" : "Delete"}
                            >
                              {deletingId === d.id ? "Deleting..." : "Delete"}
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

      {showAddStaff && <StaffCreateModal branches={branches} onClose={() => setShowAddStaff(false)} onCreated={onStaffCreated} />}

      {showFormModal && (
        <div className="po-modal-overlay" onMouseDown={(e) => e.target.classList.contains("po-modal-overlay") && closeFormModal()}>
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
                <select value={form.employee_id} onChange={(e) => onSelectEmployee(e.target.value)} disabled={!!editingId}>
                  <option value="">Select Employee</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.id} - {displayNameParts(s)} {s.employee_no ? `(${s.employee_no})` : ""}
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
                <select value={form.branch_id} onChange={(e) => setForm((p) => ({ ...p, branch_id: e.target.value }))}>
                  <option value="">Select Branch</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.code} - {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="po-field">
                <label>Date of Deployment</label>
                <input type="date" value={form.deployment_date} onChange={(e) => setForm((p) => ({ ...p, deployment_date: e.target.value }))} />
              </div>

              <div className="po-field">
                <label>Details / Remarks</label>
                <input value={form.details} onChange={(e) => setForm((p) => ({ ...p, details: e.target.value }))} placeholder="Type details..." />
              </div>

              {selectedEmployee ? (
                <div style={{ fontSize: 12, opacity: 0.85, marginTop: 6 }}>
                  Preview: <b>{displayNameParts(selectedEmployee)}</b> → <b>{branchLabel(form.branch_id) || "—"}</b> on <b>{form.deployment_date || "—"}</b>
                </div>
              ) : null}

              {err ? <div style={{ marginTop: 10, color: "#ef4444", fontWeight: 800 }}>{err}</div> : null}

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

      {viewRow && (
        <div className="po-modal-overlay" onMouseDown={(e) => e.target.classList.contains("po-modal-overlay") && closeViewModal()}>
          <div className="po-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0 }}>View Deployment</h3>
              <button className="po-x" type="button" onClick={closeViewModal}>
                ✕
              </button>
            </div>

            <div className="po-form">
              <div className="po-grid">
                <div className="po-field">
                  <label>Employee ID</label>
                  <input value={viewRow.employee_id ?? ""} readOnly />
                </div>
                <div className="po-field">
                  <label>Last Name</label>
                  <input value={toStr(viewRow.last_name)} readOnly />
                </div>
                <div className="po-field">
                  <label>First Name</label>
                  <input value={toStr(viewRow.first_name)} readOnly />
                </div>
                <div className="po-field">
                  <label>Middle Name</label>
                  <input value={toStr(viewRow.middle_name)} readOnly />
                </div>
              </div>

              <div className="po-field">
                <label>Deployment Branch</label>
                <input
                  value={
                    viewRow.branch_code || viewRow.branch_name
                      ? `${viewRow.branch_code} • ${viewRow.branch_name}`
                      : branchLabel(viewRow.branch_id)
                  }
                  readOnly
                />
              </div>

              <div className="po-field">
                <label>Date of Deployment</label>
                <input value={toDate10(viewRow.deployment_date) || "-"} readOnly />
              </div>

              <div className="po-field">
                <label>Status</label>
                <input value={toStr(viewRow.status || "Pending")} readOnly />
              </div>

              <div className="po-field">
                <label>Details / Remarks</label>
                <input value={toStr(viewRow.details || "-")} readOnly />
              </div>

              <div className="po-modal-actions">
                <button className="po-btn po-btn-primary" type="button" onClick={closeViewModal}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}