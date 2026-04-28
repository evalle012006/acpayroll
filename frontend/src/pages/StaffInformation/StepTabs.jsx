import React from "react";

export default function StepTabs({ step, onSelectStep, canGoContract, canGoBalances }) {
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
