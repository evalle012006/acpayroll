import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/SystemUpdate.css";
import "../styles/TaxCalculator.css";

const toNum = (value) => {
  const n = Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
};

const peso = (value) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(Number(value || 0));

/* ===============================
   BIR MONTHLY TAX TABLE (2026)
================================= */
function computeMonthlyTax(taxableIncome) {
  const income = toNum(taxableIncome);

  if (income <= 20833) {
    return { bracket: "P 20,833 and below", tax: 0 };
  }

  if (income <= 33332) {
    const tax = 0.15 * (income - 20833);
    return { bracket: "P 20,834 - P 33,332", tax };
  }

  if (income <= 66666) {
    const tax = 2500 + 0.2 * (income - 33333);
    return { bracket: "P 33,333 - P 66,666", tax };
  }

  if (income <= 166666) {
    const tax = 8541.8 + 0.25 * (income - 66667);
    return { bracket: "P 66,667 - P 166,666", tax };
  }

  if (income <= 666666) {
    const tax = 33541.8 + 0.3 * (income - 166667);
    return { bracket: "P 166,667 - P 666,666", tax };
  }

  const tax = 183541.8 + 0.35 * (income - 666667);
  return { bracket: "Over P 666,666", tax };
}

export default function TaxCalculator() {
  const navigate = useNavigate();

  /* ===============================
     STATE
  ================================= */
  const [basicSalary, setBasicSalary] = useState("");
  const [ecola, setEcola] = useState("");
  const [nonTax, setNonTax] = useState("");

  /* ===============================
     AUTO COMPUTATIONS
  ================================= */
  const finalBasicSalary = toNum(basicSalary);
  const finalEcola = toNum(ecola);
  const grossIncome = finalBasicSalary + finalEcola;

  // SSS = 5% of (Basic Salary + ECOLA)
  const finalSss = useMemo(() => {
    return grossIncome * 0.05;
  }, [grossIncome]);

  // PhilHealth = 2.5% of Basic Salary only
  const finalPhilhealth = useMemo(() => {
    return finalBasicSalary * 0.025;
  }, [finalBasicSalary]);

  // Fixed Pag-IBIG
  const finalPagibig = 200;

  const finalNonTax = toNum(nonTax);

  const totalDeductions = finalSss + finalPhilhealth + finalPagibig;

  const taxableIncome = Math.max(
    0,
    grossIncome - totalDeductions - finalNonTax
  );

  const result = computeMonthlyTax(taxableIncome);

  /* ===============================
     UI
  ================================= */
  return (
    <div className="sys-page">
      <div className="sys-header">
        <div>
          <h2 className="sys-title">Taxable Income Calculator</h2>
          <p className="sys-subtitle">
            Payroll tax is computed using Basic Salary and ECOLA.
          </p>
        </div>

        <button
          className="tax-btn tax-btn-secondary"
          onClick={() => navigate("/system-update")}
          type="button"
        >
          ← Back
        </button>
      </div>

      <div className="tax-grid">
        {/* ================= INPUT ================= */}
        <div className="sys-card tax-card">
          <div className="sys-card-head">
            <div>
              <div className="sys-card-title">Inputs</div>
              <div className="sys-card-meta">
                Enter payroll values for monthly tax computation.
              </div>
            </div>
          </div>

          <div className="sys-card-body">
            <div className="tax-form-grid">
              <div>
                <label className="tax-label">Basic Salary</label>
                <input
                  className="tax-input"
                  type="number"
                  value={basicSalary}
                  onChange={(e) => setBasicSalary(e.target.value)}
                  placeholder="Enter basic salary"
                />
              </div>

              <div>
                <label className="tax-label">Ecola</label>
                <input
                  className="tax-input"
                  type="number"
                  value={ecola}
                  onChange={(e) => setEcola(e.target.value)}
                  placeholder="Enter Ecola"
                />
              </div>

              <div>
                <label className="tax-label">SSS (5% of Basic + ECOLA)</label>
                <input
                  className="tax-input"
                  type="number"
                  value={finalSss.toFixed(2)}
                  disabled
                />
              </div>

              <div>
                <label className="tax-label">PhilHealth (2.5% of Basic Salary)</label>
                <input
                  className="tax-input"
                  type="number"
                  value={finalPhilhealth.toFixed(2)}
                  disabled
                />
              </div>

              <div>
                <label className="tax-label">Pag-ibig</label>
                <input
                  className="tax-input"
                  type="number"
                  value={finalPagibig}
                  disabled
                />
              </div>

              <div className="tax-span-3">
                <label className="tax-label">Non-taxable Items</label>
                <input
                  className="tax-input"
                  type="number"
                  value={nonTax}
                  onChange={(e) => setNonTax(e.target.value)}
                  placeholder="13th month, rice subsidy, etc."
                />
              </div>
            </div>
          </div>
        </div>

        {/* ================= RESULT ================= */}
        <div className="sys-card tax-card">
          <div className="sys-card-head">
            <div>
              <div className="sys-card-title">Computation Result</div>
              <div className="sys-card-meta">
                Based on BIR monthly tax table.
              </div>
            </div>
          </div>

          <div className="sys-card-body">
            <div className="tax-result-grid">
              <div className="tax-result-item">
                <span className="tax-result-label">Basic Salary</span>
                <strong>{peso(finalBasicSalary)}</strong>
              </div>

              <div className="tax-result-item">
                <span className="tax-result-label">Ecola</span>
                <strong>{peso(finalEcola)}</strong>
              </div>

              <div className="tax-result-item">
                <span className="tax-result-label">Gross Income</span>
                <strong>{peso(grossIncome)}</strong>
              </div>

              <div className="tax-result-item">
                <span className="tax-result-label">SSS</span>
                <strong>{peso(finalSss)}</strong>
              </div>

              <div className="tax-result-item">
                <span className="tax-result-label">PhilHealth</span>
                <strong>{peso(finalPhilhealth)}</strong>
              </div>

              <div className="tax-result-item">
                <span className="tax-result-label">Pag-ibig</span>
                <strong>{peso(finalPagibig)}</strong>
              </div>

              <div className="tax-result-item">
                <span className="tax-result-label">Total Deductions</span>
                <strong>{peso(totalDeductions)}</strong>
              </div>

              <div className="tax-result-item">
                <span className="tax-result-label">Non-taxable</span>
                <strong>{peso(finalNonTax)}</strong>
              </div>

              <div className="tax-result-item tax-result-highlight">
                <span className="tax-result-label">Taxable Income</span>
                <strong>{peso(taxableIncome)}</strong>
              </div>

              <div className="tax-result-item">
                <span className="tax-result-label">Tax Bracket</span>
                <strong>{result.bracket}</strong>
              </div>

              <div className="tax-result-item tax-result-tax">
                <span className="tax-result-label">Monthly Tax</span>
                <strong>{peso(result.tax)}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* ================= FORMULA ================= */}
        <div className="sys-card tax-card">
          <div className="sys-card-head">
            <div>
              <div className="sys-card-title">Formula</div>
            </div>
          </div>

          <div className="sys-card-body">
            <div className="tax-reference">
              <p>
                <strong>Gross Income</strong> = Basic Salary + ECOLA
              </p>
              <p>
                <strong>SSS</strong> = (Basic Salary + ECOLA) × 5%
              </p>
              <p>
                <strong>PhilHealth</strong> = Basic Salary × 2.5%
              </p>
              <p>
                <strong>Pag-IBIG</strong> = Fixed amount
              </p>
              <p>
                <strong>Taxable Income</strong> =
              </p>
              <p>
                (Basic Salary + ECOLA) - (SSS + PhilHealth + Pag-IBIG) - Non-taxable Items
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}