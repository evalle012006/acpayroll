import React from "react";
import Select from "react-select";

export default function CreateTravelPlanModal({
  showCreatePlan,
  setShowCreatePlan,

  planForm,
  setPlanForm,

  staffOptions,
  branchRows,

  saveTravelPlan,
}) {
  if (!showCreatePlan) {
    return null;
  }

  return (
    <div
      className="travel-plan-modal-backdrop"
      onMouseDown={(event) => {
        if (
          event.target.classList.contains(
            "travel-plan-modal-backdrop"
          )
        ) {
          setShowCreatePlan(false);
        }
      }}
    >
      <div
        className="travel-plan-modal"
        onMouseDown={(event) =>
          event.stopPropagation()
        }
      >
        <div className="travel-plan-modal-head">
          <h3>Create Travel Plan</h3>

          <button
            type="button"
            onClick={() =>
              setShowCreatePlan(false)
            }
          >
            ×
          </button>
        </div>

        <div className="travel-plan-form">
          <label>
            Title

            <input
              type="text"
              placeholder="Enter plan title"
              value={planForm.title}
              onChange={(event) =>
                setPlanForm((previous) => ({
                  ...previous,
                  title: event.target.value,
                }))
              }
            />
          </label>

          <label>
            Employee

            <Select
              className="travel-staff-search"
              classNamePrefix="select"
              isSearchable
              isClearable
              placeholder="Search employee..."
              options={staffOptions}
              value={
                staffOptions.find(
                  (option) =>
                    option.employee_name ===
                    planForm.employee_name
                ) || null
              }
              onChange={(option) => {
                if (!option) {
                  setPlanForm((previous) => ({
                    ...previous,
                    employee_name: "",
                    position: "",
                  }));

                  return;
                }

                setPlanForm((previous) => ({
                  ...previous,
                  employee_name:
                    option.employee_name || "",
                  position:
                    option.position || "",
                }));
              }}
              noOptionsMessage={() =>
                "No employee found"
              }
            />
          </label>

          <label>
            Position

            <input
              type="text"
              value={planForm.position}
              readOnly
            />
          </label>

          <label>
            Date

            <input
              type="date"
              value={planForm.plan_date}
              onChange={(event) =>
                setPlanForm((previous) => ({
                  ...previous,
                  plan_date: event.target.value,
                }))
              }
            />
          </label>

          <label>
            Branch

            <Select
              className="travel-staff-search"
              classNamePrefix="select"
              isSearchable
              isClearable
              placeholder="Search branch..."
              options={branchRows.map(
                (branch) => ({
                  value:
                    branch.branch_name || "",
                  label:
                    branch.branch_name || "",
                })
              )}
              value={
                planForm.branch_name
                  ? {
                      value:
                        planForm.branch_name,
                      label:
                        planForm.branch_name,
                    }
                  : null
              }
              onChange={(option) =>
                setPlanForm((previous) => ({
                  ...previous,
                  branch_name:
                    option?.value || "",
                }))
              }
              noOptionsMessage={() =>
                "No branch found"
              }
            />
          </label>

          <label className="travel-plan-form-full">
            Description

            <textarea
              rows={5}
              placeholder="Enter travel plan description"
              value={planForm.description}
              onChange={(event) =>
                setPlanForm((previous) => ({
                  ...previous,
                  description:
                    event.target.value,
                }))
              }
            />
          </label>
        </div>

        <div className="travel-plan-modal-actions">
          <button
            type="button"
            onClick={() =>
              setShowCreatePlan(false)
            }
          >
            Cancel
          </button>

          <button
            type="button"
            className="primary"
            onClick={saveTravelPlan}
          >
            Save Travel Plan
          </button>
        </div>
      </div>
    </div>
  );
}