import React from "react";

export default function StepTabs({ step, onSelectStep }) {
  return (
    <div className="step-tabs">
      <button
        type="button"
        className={`step-tab ${step === 1 ? "active" : ""}`}
        onClick={() => onSelectStep(1)}
      >
        Staff Details
      </button>

      <button
        type="button"
        className={`step-tab ${step === 2 ? "active" : ""}`}
        onClick={() => onSelectStep(2)}
      >
        Contract Details
      </button>
    </div>
  );
}
