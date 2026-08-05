import React from "react";

export default function StaffScopePlansModal({
  selectedStaffScope,
  setSelectedStaffScope,

  staffPlanSearch,
  setStaffPlanSearch,

  staffPlanDateFilter,
  setStaffPlanDateFilter,

  selectedStaffPlans,

  normalizeValue,
  openPlan,

  canDeleteTravelPlans,
  deleteTravelPlan,
}) {
  if (!selectedStaffScope) {
    return null;
  }

  const closeModal = () => {
    setSelectedStaffScope(null);
    setStaffPlanSearch("");
    setStaffPlanDateFilter("");
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
        className="travel-plan-modal travel-staff-plans-modal"
        onMouseDown={(event) =>
          event.stopPropagation()
        }
      >
        <div className="travel-plan-modal-head">
          <div>
            <h3>
              {selectedStaffScope.employee_name}
            </h3>

            <p className="travel-staff-modal-subtitle">
              {selectedStaffScope.position ||
                "No position"}
              {" • "}
              {selectedStaffScope.branch_name ||
                "No branch"}
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
            <span>Employee No.</span>

            <b>
              {selectedStaffScope.employee_no ||
                "-"}
            </b>
          </div>

          <div>
            <span>Status</span>

            <b>
              {selectedStaffScope.travel_status ||
                "Pending"}
            </b>
          </div>

          <div>
            <span>Total Plans</span>

            <b>{selectedStaffPlans.length}</b>
          </div>
        </div>

        <div className="travel-staff-plan-filters">
          <input
            type="search"
            placeholder="Search title, branch, description, status..."
            value={staffPlanSearch}
            onChange={(event) =>
              setStaffPlanSearch(
                event.target.value
              )
            }
          />

          <input
            type="date"
            value={staffPlanDateFilter}
            onChange={(event) =>
              setStaffPlanDateFilter(
                event.target.value
              )
            }
          />

          <button
            type="button"
            disabled={
              !staffPlanSearch &&
              !staffPlanDateFilter
            }
            onClick={() => {
              setStaffPlanSearch("");
              setStaffPlanDateFilter("");
            }}
          >
            Clear
          </button>

          <span className="travel-count-pill">
            {selectedStaffPlans.length}{" "}
            {selectedStaffPlans.length === 1
              ? "Plan"
              : "Plans"}
          </span>
        </div>

        {selectedStaffPlans.length === 0 ? (
          <div className="travel-empty">
            No travel plans found for this staff
            member.
          </div>
        ) : (
          <div className="travel-staff-plan-list">
            {selectedStaffPlans.map((plan) => (
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
                    {plan.branch_name ||
                      "No branch selected"}
                  </span>

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
                      normalizeValue(
                        plan.status
                      ) === "completed"
                        ? "completed"
                        : "pending"
                    }`}
                  >
                    {plan.status || "Pending"}
                  </b>

                  <div className="travel-staff-plan-actions">
                    <button
                      type="button"
                      className="travel-record-edit"
                      onClick={(event) => {
                        event.stopPropagation();

                        closeModal();
                        openPlan(plan);
                      }}
                    >
                      {normalizeValue(
                        plan.status
                      ) === "completed"
                        ? "View"
                        : "Edit"}
                    </button>

                    {canDeleteTravelPlans && (
                      <button
                        type="button"
                        className="travel-record-delete"
                        onClick={(event) => {
                          event.stopPropagation();

                          deleteTravelPlan(plan.id);
                        }}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}