import React from "react";
import EditableCell from "./EditableCell";
import { DEPARTMENT_OPTIONS, toNum, toStr } from "./deploymentUtils";

export default function ContractDetailsStep({ form, branches, compRates = [], setForm, branchConfigMap }) {
  const setField = (name, value) =>
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));

  const setBranchAndConfig = (branchId) => {
    const id = String(branchId || "").trim();

    const selectedBranch = (branches || []).find(
      (b) => String(b?.id ?? "").trim() === id
    );

    const cfg = branchConfigMap?.get(id);

    const nextArea =
      toStr(cfg?.area) ||
      toStr(selectedBranch?.area) ||
      "";

    const nextRegion =
      toStr(cfg?.region) ||
      toStr(selectedBranch?.region) ||
      "";

    const nextDivision =
      toStr(cfg?.division) ||
      toStr(selectedBranch?.division) ||
      "";

    setForm((prev) => ({
      ...prev,
      branch_id: id,
      area: nextArea,
      region: nextRegion,
      division: nextDivision,
    }));
  };

  const applyRateByPosition = (positionValue) => {
    const pos = toStr(positionValue);
    if (!pos) return;

    const matched = (compRates || []).find(
      (r) => toStr(r.position).toLowerCase() === pos.toLowerCase()
    );

    if (!matched) {
      setField("position", pos);
      return;
    }

    setForm((prev) => ({
      ...prev,
      position: pos,
      salary: matched.salary ?? prev.salary ?? "",
      ecola: matched.ecola ?? prev.ecola ?? "",
      cbu: matched.cbu ?? prev.cbu ?? "",
      cashbond: matched.cashbond ?? prev.cashbond ?? "",
      utility: matched.utility ?? prev.utility ?? "",
      sss_er: matched.sss_er ?? prev.sss_er ?? "",
      ph_er: matched.philhealth_er ?? prev.ph_er ?? "",
      hdmf_er: matched.pagibig_er ?? prev.hdmf_er ?? "",
      sss_ee: matched.sss_ee ?? prev.sss_ee ?? "",
      ph_ee: matched.philhealth_ee ?? prev.ph_ee ?? "",
      hdmf_ee: matched.pagibig_ee ?? prev.hdmf_ee ?? "",
      tax: matched.tax ?? prev.tax ?? "",
    }));
  };

  const salaryTotal = toNum(form.salary) + toNum(form.ecola);
  const personalTotal = toNum(form.cbu) + toNum(form.cashbond) + toNum(form.utility);

  const transpoTotal =
    toNum(form.transportation) +
    toNum(form.repairing) +
    toNum(form.postage) +
    toNum(form.other_deduction) +
    toNum(form.additional_target) +
    toNum(form.additional_monitoring) +
    toNum(form.motorcycle_loan);

  const erTotal = toNum(form.sss_er) + toNum(form.ph_er) + toNum(form.hdmf_er);
  const eeTotal = toNum(form.sss_ee) + toNum(form.ph_ee) + toNum(form.hdmf_ee);

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
              <td>Position *</td>
              <td style={{ textAlign: "right" }}>
                <select
                  className="input"
                  style={{ width: 280, textAlignLast: "right" }}
                  value={form.position}
                  onChange={(e) => applyRateByPosition(e.target.value)}
                >
                  <option value="">Select position...</option>
                  {(compRates || []).map((r) => (
                    <option key={r.id} value={r.position}>
                      {r.position}
                    </option>
                  ))}
                </select>
              </td>
            </tr>

            <tr>
              <td>Department</td>
              <td style={{ textAlign: "right" }}>
                <select
                  className="input"
                  style={{ width: 280, textAlignLast: "right" }}
                  value={form.department}
                  onChange={(e) => setField("department", e.target.value)}
                >
                  <option value="">Select department...</option>
                  {DEPARTMENT_OPTIONS.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </td>
            </tr>

            <tr>
              <td>Branch</td>
              <td style={{ textAlign: "right" }}>
                <select
                  className="input"
                  style={{ width: 280, textAlignLast: "right" }}
                  value={form.branch_id}
                  onChange={(e) => setBranchAndConfig(e.target.value)}
                >
                  <option value="">Select branch...</option>
                  {(branches || []).map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.code ? `${b.code} - ${b.name}` : b.name}
                    </option>
                  ))}
                </select>
              </td>
            </tr>

            <tr>
              <td>Area</td>
              <td style={{ textAlign: "right" }}>
                <input
                  className="input"
                  style={{ width: 280, textAlign: "right" }}
                  value={form.area || ""}
                  readOnly
                  placeholder="Auto-filled"
                />
              </td>
            </tr>

            <tr>
              <td>Region</td>
              <td style={{ textAlign: "right" }}>
                <input
                  className="input"
                  style={{ width: 280, textAlign: "right" }}
                  value={form.region || ""}
                  readOnly
                  placeholder="Auto-filled"
                />
              </td>
            </tr>

            <tr>
              <td>Division</td>
              <td style={{ textAlign: "right" }}>
                <input
                  className="input"
                  style={{ width: 280, textAlign: "right" }}
                  value={form.division || ""}
                  readOnly
                  placeholder="Auto-filled"
                />
              </td>
            </tr>

            <tr>
              <td>Status</td>
              <td style={{ textAlign: "right" }}>
                <select
                  className="input"
                  style={{ width: 280, textAlignLast: "right" }}
                  value={form.status}
                  onChange={(e) => setField("status", e.target.value)}
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </td>
            </tr>

            <tr>
              <td>Start Date</td>
              <td>
                <EditableCell
                  value={form.start_date}
                  placeholder="YYYY-MM-DD"
                  onChange={(v) => setField("start_date", v)}
                />
              </td>
            </tr>

            <tr>
              <td>Regularization Date</td>
              <td>
                <EditableCell
                  value={form.regularization_date}
                  placeholder="YYYY-MM-DD"
                  onChange={(v) => setField("regularization_date", v)}
                />
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
              <td className="editable-section" colSpan={2}>Remittances: ER</td>
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
              <td className="editable-section" colSpan={2}>Remittances: EE</td>
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
              <td className="editable-section" colSpan={2}>Remittances: Tax</td>
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
