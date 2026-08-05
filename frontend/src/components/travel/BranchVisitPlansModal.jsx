import React from "react";

export default function BranchVisitPlansModal({
  selectedBranchVisit,
  setSelectedBranchVisit,
  selectedBranchPlans,
  normalizeValue,
  openPlan,
}) {
  if (!selectedBranchVisit) {
    return null;
  }

  const closeModal = () => {
    setSelectedBranchVisit(null);
  };

  return (
    <div
      className="travel-plan-modal-backdrop"
      onMouseDown={(event) => {
        if (
          event.target.classList.contains(
            "travel-plan-modal-backdrop"
          )
        ) {
          closeModal();
        }
      }}
    >
      <div
        className="travel-plan-modal travel-branch-plans-modal"
        onMouseDown={(event) =>
          event.stopPropagation()
        }
      >
        <div className="travel-plan-modal-head">
          <div>
            <h3>{selectedBranchVisit}</h3>

            <p className="travel-staff-modal-subtitle">
              Travel plans created for this branch.
            </p>
          </div>

          <button
            type="button"
            onClick={closeModal}
          >
            ×
          </button>
        </div>

        <div className="travel-staff-plan-summary">
          <div>
            <span>Branch</span>
            <b>{selectedBranchVisit}</b>
          </div>

          <div>
            <span>Total Visits</span>
            <b>{selectedBranchPlans.length}</b>
          </div>

          <div>
            <span>Completed</span>

            <b>
              {
                selectedBranchPlans.filter(
                  (plan) =>
                    normalizeValue(plan.status) ===
                    "completed"
                ).length
              }
            </b>
          </div>
        </div>

        {selectedBranchPlans.length === 0 ? (
          <div className="travel-empty">
            No travel plans found for this branch.
          </div>
        ) : (
          <div className="travel-staff-plan-list">
            {selectedBranchPlans.map((plan) => (
              <div
                key={plan.id}
                className="travel-staff-plan-item"
                onClick={() => {
                  closeModal();
                  openPlan(plan);
                }}
              >
                <div className="travel-staff-plan-main">
                  <strong>
                    {plan.title ||
                      "Untitled Travel Plan"}
                  </strong>

                  <span>
                    {plan.employee_name ||
                      "No employee"}
                  </span>

                  {plan.position && (
                    <small>{plan.position}</small>
                  )}

                  {plan.description && (
                    <small>
                      {plan.description}
                    </small>
                  )}
                </div>

                <div className="travel-staff-plan-meta">
                  <span>
                    {String(
                      plan.plan_date || ""
                    ).slice(0, 10)}
                  </span>

                  <b
                    className={`travel-status ${
                      normalizeValue(plan.status) ===
                      "completed"
                        ? "completed"
                        : "pending"
                    }`}
                  >
                    {plan.status || "Pending"}
                  </b>

                  <button
                    type="button"
                    className="travel-record-edit"
                    onClick={(event) => {
                      event.stopPropagation();

                      closeModal();
                      openPlan(plan);
                    }}
                  >
                    {normalizeValue(plan.status) ===
                    "completed"
                      ? "View"
                      : "Edit"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}