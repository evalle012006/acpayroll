import React, { useMemo } from "react";
import EditableCell from "./EditableCell";
import DividerRow from "./DividerRow";
import { calcAge, safeJsonArray, toStr } from "./deploymentUtils";

export default function StaffDetailsStep({ form, setForm }) {

  const setField = (name, v) => {
    setForm ((p) =>({
      ...p,
      [name]: v,
    }));
  };

  const children = useMemo(() => {
    const arr = safeJsonArray(form.children);
    return arr.length ? arr : [{ fullname: "", date_of_birth: "", place_of_birth: "", age: "" }];
  }, [form.children]);

  const employmentHistory = useMemo(() => {
    const arr = safeJsonArray(form.employment_history);
    return arr.length
      ? arr
      : [
          {
            company: "",
            position: "",
            year_started: "",
            year_ended: "",
            character_reference: "",
            contact_number: "",
          },
        ];
  }, [form.employment_history]);

  const beneficiaries = useMemo(() => {
    const arr = safeJsonArray(form.beneficiaries);
    return arr.length ? arr : [{ name: "", relation: "", contact_number: "" }];
  }, [form.beneficiaries]);

  const setChildren = (arr) => setField("children", JSON.stringify(arr, null, 2));
  const setEmploymentHistory = (arr) => setField("employment_history", JSON.stringify(arr, null, 2));
  const setBeneficiaries = (arr) => setField("beneficiaries", JSON.stringify(arr, null, 2));

  const setChildField = (idx, key, value) => {
    const next = [...children];
    const row = { ...(next[idx] || { fullname: "", date_of_birth: "", place_of_birth: "", age: "" }) };

    row[key] = value;
    if (key === "date_of_birth") row.age = calcAge(value);

    next[idx] = row;
    setChildren(next);
  };

  const addChild = () =>
    setChildren([...children, { fullname: "", date_of_birth: "", place_of_birth: "", age: "" }]);

  const removeChild = (idx) => {
    const next = [...children];
    next.splice(idx, 1);
    setChildren(next.length ? next : [{ fullname: "", date_of_birth: "", place_of_birth: "", age: "" }]);
  };

  const setEmploymentField = (idx, key, value) => {
    const next = [...employmentHistory];
    next[idx] = {
      ...(next[idx] || {
        company: "",
        position: "",
        year_started: "",
        year_ended: "",
        character_reference: "",
        contact_number: "",
      }),
      [key]: value,
    };
    setEmploymentHistory(next);
  };

  const addEmployment = () =>
    setEmploymentHistory([
      ...employmentHistory,
      {
        company: "",
        position: "",
        year_started: "",
        year_ended: "",
        character_reference: "",
        contact_number: "",
      },
    ]);

  const removeEmployment = (idx) => {
    const next = [...employmentHistory];
    next.splice(idx, 1);
    setEmploymentHistory(
      next.length
        ? next
        : [
            {
              company: "",
              position: "",
              year_started: "",
              year_ended: "",
              character_reference: "",
              contact_number: "",
            },
          ]
    );
  };

  const setBeneficiaryField = (idx, key, value) => {
    const next = [...beneficiaries];
    next[idx] = {
      ...(next[idx] || { name: "", relation: "", contact_number: "" }),
      [key]: value,
    };
    setBeneficiaries(next);
  };

  const addBeneficiary = () =>
    setBeneficiaries([...beneficiaries, { name: "", relation: "", contact_number: "" }]);

  const removeBeneficiary = (idx) => {
    const next = [...beneficiaries];
    next.splice(idx, 1);
    setBeneficiaries(next.length ? next : [{ name: "", relation: "", contact_number: "" }]);
  };

  return (
    <div className="staff-add-grid">
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
                  <EditableCell value={form.father_occupation} placeholder="Type father occupation..." onChange={(v) => setField("father_occupation", v)} /></td>
            </tr>
            <tr>
              <td>Father Employer</td>
                <td>
                  <EditableCell value={form.father_employer} placeholder="Type father employer..." onChange={(v) => setField("father_employer", v)} /></td>
            </tr>
            <tr>
              <td>Father Contact</td>
                <td><EditableCell value={form.father_contact} placeholder="Type father contact..." onChange={(v) => setField("father_contact", v)} /></td>
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
                Employment History
              </td>
            </tr>

            {employmentHistory.map((item, idx) => (
              <React.Fragment key={idx}>
                <tr>
                  <td style={{ fontWeight: 900 }}>Employment #{idx + 1}</td>
                  <td style={{ textAlign: "right" }}>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => removeEmployment(idx)}
                      disabled={employmentHistory.length <= 1}
                      style={{ padding: "6px 10px" }}
                      title={employmentHistory.length <= 1 ? "At least one employment row is required" : "Remove employment"}
                    >
                      Remove
                    </button>
                  </td>
                </tr>

                <tr>
                  <td>Company</td>
                  <td>
                    <EditableCell
                      value={toStr(item?.company)}
                      placeholder="Type company..."
                      onChange={(v) => setEmploymentField(idx, "company", v)}
                    />
                  </td>
                </tr>

                <tr>
                  <td>Position</td>
                  <td>
                    <EditableCell
                      value={toStr(item?.position)}
                      placeholder="Type position..."
                      onChange={(v) => setEmploymentField(idx, "position", v)}
                    />
                  </td>
                </tr>

                <tr>
                  <td>Year Started</td>
                  <td>
                    <EditableCell
                      value={toStr(item?.year_started)}
                      placeholder="e.g., 2020"
                      onChange={(v) => setEmploymentField(idx, "year_started", v)}
                    />
                  </td>
                </tr>

                <tr>
                  <td>Year Ended</td>
                  <td>
                    <EditableCell
                      value={toStr(item?.year_ended)}
                      placeholder="e.g., 2023"
                      onChange={(v) => setEmploymentField(idx, "year_ended", v)}
                    />
                  </td>
                </tr>

                <tr>
                  <td>Character Reference</td>
                  <td>
                    <EditableCell
                      value={toStr(item?.character_reference)}
                      placeholder="Type character reference..."
                      onChange={(v) => setEmploymentField(idx, "character_reference", v)}
                    />
                  </td>
                </tr>

                <tr>
                  <td>Contact Number</td>
                  <td>
                    <EditableCell
                      value={toStr(item?.contact_number)}
                      placeholder="Type contact number..."
                      onChange={(v) => setEmploymentField(idx, "contact_number", v)}
                    />
                  </td>
                </tr>

                <DividerRow />
              </React.Fragment>
            ))}

            <tr>
              <td />
              <td style={{ textAlign: "right" }}>
                <button type="button" className="btn btn-outline" onClick={addEmployment}>
                  + Add Employment
                </button>
              </td>
            </tr>

            <tr>
              <td className="editable-section" colSpan={2}>
                Beneficiaries
              </td>
            </tr>

            {beneficiaries.map((item, idx) => (
              <React.Fragment key={idx}>
                <tr>
                  <td style={{ fontWeight: 900 }}>Beneficiary #{idx + 1}</td>
                  <td style={{ textAlign: "right" }}>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => removeBeneficiary(idx)}
                      disabled={beneficiaries.length <= 1}
                      style={{ padding: "6px 10px" }}
                      title={beneficiaries.length <= 1 ? "At least one beneficiary row is required" : "Remove beneficiary"}
                    >
                      Remove
                    </button>
                  </td>
                </tr>

                <tr>
                  <td>Name</td>
                  <td>
                    <EditableCell
                      value={toStr(item?.name)}
                      placeholder="Type beneficiary name..."
                      onChange={(v) => setBeneficiaryField(idx, "name", v)}
                    />
                  </td>
                </tr>

                <tr>
                  <td>Relation</td>
                  <td>
                    <EditableCell
                      value={toStr(item?.relation)}
                      placeholder="Type relation..."
                      onChange={(v) => setBeneficiaryField(idx, "relation", v)}
                    />
                  </td>
                </tr>

                <tr>
                  <td>Contact Number</td>
                  <td>
                    <EditableCell
                      value={toStr(item?.contact_number)}
                      placeholder="Type contact number..."
                      onChange={(v) => setBeneficiaryField(idx, "contact_number", v)}
                    />
                  </td>
                </tr>

                <DividerRow />
              </React.Fragment>
            ))}

            <tr>
              <td />
              <td style={{ textAlign: "right" }}>
                <button type="button" className="btn btn-outline" onClick={addBeneficiary}>
                  + Add Beneficiary
                </button>
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
