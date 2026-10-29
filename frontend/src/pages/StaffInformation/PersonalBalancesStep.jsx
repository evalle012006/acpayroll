//PersonalBalanceStep.jsx
import React from "react";
import { money, toNum } from "./staffInfoUtils";

export default function PersonalBalancesStep({
  balanceForm,
  onBalanceChange,
  readOnlyLoans = false,
  openingLoanRows = [],
  cashbondLimit = null,
}) {
  const totalSavings =
    toNum(balanceForm.cbu) +
    toNum(balanceForm.cashbond) +
    toNum(balanceForm.utility ?? balanceForm.utility_charge);

  const totalBalances =
    toNum(balanceForm.salary_advance) + toNum(balanceForm.special_advance) + toNum(balanceForm.cash_advance) +
    toNum(balanceForm.motorcycle_loan) + toNum(balanceForm.pag_ibig_loan) + toNum(balanceForm.other_receivable) +
    toNum(balanceForm.staff_accounts_payable);
  
  const currentCashbond = toNum(balanceForm.cashbond);

  const normalizedCashbondLimit =
    cashbondLimit === null ||
    cashbondLimit === undefined ||
    cashbondLimit === ""
      ? null
      : toNum(cashbondLimit);

  const hasCashbondLimit =
    normalizedCashbondLimit !== null &&
    normalizedCashbondLimit > 0;

  const cashbondRemaining = hasCashbondLimit
    ? Math.max(normalizedCashbondLimit - currentCashbond, 0)
    : null;

  const cashbondLimitReached =
    hasCashbondLimit &&
    currentCashbond >= normalizedCashbondLimit;

  return (
    <div className="modal-body staff-add-grid">
      <div className="staff-add-left" style={{ width: "100%" }}>
        <div className="field full" style={{ marginTop: 8 }}><h3 style={{ margin: 0 }}>Personal Savings</h3></div>
        <div className="field"><label>CBU</label><input className="input" name="cbu" value={balanceForm.cbu} onChange={onBalanceChange} /></div>
        <div className="field">
          <label>
            Cashbond
            {hasCashbondLimit
              ? ` — Maximum: ${money(normalizedCashbondLimit)}`
              : ""}
          </label>

          <input
            className="input"
            name="cashbond"
            type="number"
            min="0"
            step="0.01"
            value={balanceForm.cashbond}
            onChange={onBalanceChange}
          />

          {hasCashbondLimit ? (
            <div
              style={{
                marginTop: 6,
                fontSize: 12,
                opacity: 0.8,
              }}
            >
              {cashbondLimitReached
                ? `Maximum Cashbond reached (${money(normalizedCashbondLimit)})`
                : `Remaining before maximum: ${money(cashbondRemaining)}`}
            </div>
          ) : null}
        </div>
        <div className="field"><label>Utility</label><input className="input" name="utility" value={balanceForm.utility ?? balanceForm.utility_charge ?? ""} onChange={onBalanceChange} /></div>
        <div className="field full"><label>Total Personal Savings</label><div className="input" style={{ background: "var(--panel-2)" }}>{money(totalSavings)}</div></div>
        <div className="field full" style={{ marginTop: 16 }}><h3 style={{ margin: 0 }}>Personal Balances</h3></div>
        <div className="field"><label>Salary Advance</label><input className="input" name="salary_advance" value={balanceForm.salary_advance} onChange={onBalanceChange} readOnly={readOnlyLoans} /></div>
        <div className="field"><label>Special Advance</label><input className="input" name="special_advance" value={balanceForm.special_advance} onChange={onBalanceChange} readOnly={readOnlyLoans} /></div>
        <div className="field"><label>Cash Advance</label><input className="input" name="cash_advance" value={balanceForm.cash_advance} onChange={onBalanceChange} readOnly={readOnlyLoans} /></div>
        <div className="field"><label>Motorcycle Loan</label><input className="input" name="motorcycle_loan" value={balanceForm.motorcycle_loan} onChange={onBalanceChange} readOnly={readOnlyLoans} /></div>
        <div className="field"><label>Pag-ibig Loan</label><input className="input" name="pag_ibig_loan" value={balanceForm.pag_ibig_loan} onChange={onBalanceChange} /></div>
        <div className="field"><label>Other Receivable</label><input className="input" name="other_receivable" value={balanceForm.other_receivable} onChange={onBalanceChange} /></div>
        <div className="field"><label>Staff Accounts Payable</label><input className="input" name="staff_accounts_payable" value={balanceForm.staff_accounts_payable} onChange={onBalanceChange} /></div>
        <div className="field full"><label>Total Personal Balance</label><div className="input" style={{ background: "var(--panel-2)" }}>{money(totalBalances)}</div></div>
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
