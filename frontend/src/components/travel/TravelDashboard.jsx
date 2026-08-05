import React from "react";
import Select from "react-select";

export default function TravelDashboard({
  DAYS,
  calendarDays,

  year,
  month,

  planForm,
  emptyPlanForm,
  setPlanForm,
  setShowCreatePlan,

  branchStaffOptions,
  branchStaffFilter,
  setBranchStaffFilter,

  branchDivisionFilter,
  setBranchDivisionFilter,
  divisionOptions,

  branchRegionFilter,
  setBranchRegionFilter,
  regionOptions,

  branchAreaFilter,
  setBranchAreaFilter,
  areaOptions,

  visitRange,
  setVisitRange,

  filteredMostVisitedBranches,
  selectedBranchVisit,
  setSelectedBranchVisit,

  maxBranchVisits,
}) {
  return (
    <div className="travel-plan-layout">
      <div className="travel-plan-calendar-card">
        <div className="travel-mini-calendar">
          {DAYS.map((day) => (
            <div
              key={day}
              className="travel-mini-day-header"
            >
              {day}
            </div>
          ))}

          {calendarDays.map((cell, index) => {
            const date = `${year}-${String(
              month + 1
            ).padStart(2, "0")}-${String(
              cell.day
            ).padStart(2, "0")}`;

            return (
              <button
                key={index}
                type="button"
                className={`travel-mini-date ${
                  cell.currentMonth ? "" : "muted"
                } ${
                  planForm.plan_date === date
                    ? "selected"
                    : ""
                }`}
                onClick={() => {
                  if (!cell.currentMonth) {
                    return;
                  }

                  setPlanForm({
                    ...emptyPlanForm,
                    plan_date: date,
                  });

                  setShowCreatePlan(true);
                }}
              >
                {cell.day}
              </button>
            );
          })}
        </div>
      </div>

      <div className="travel-right-column">
        <div className="travel-events-card">
          <div className="travel-card-header">
            <div>
              <h3>Most Visited Branches</h3>

              <p>
                Based on created travel plans.
              </p>

              <div className="travel-branch-staff-filter">
                <label className="travel-branch-staff-field">
                  <span>Staff</span>

                  <Select
                    className="travel-staff-search"
                    classNamePrefix="select"
                    isSearchable
                    isClearable
                    placeholder="Search staff..."
                    options={[
                      {
                        value: "",
                        label: "All Staff",
                      },

                      ...branchStaffOptions.map(
                        (employeeName) => ({
                          value: employeeName,
                          label: employeeName,
                        })
                      ),
                    ]}
                    value={
                      branchStaffFilter
                        ? {
                            value:
                              branchStaffFilter,
                            label:
                              branchStaffFilter,
                          }
                        : {
                            value: "",
                            label: "All Staff",
                          }
                    }
                    onChange={(option) =>
                      setBranchStaffFilter(
                        option?.value || ""
                      )
                    }
                    noOptionsMessage={() =>
                      "No staff found"
                    }
                  />
                </label>
              </div>

              <div className="travel-branch-location-filters">
                <label>
                  <span>Division</span>

                  <select
                    value={branchDivisionFilter}
                    onChange={(event) => {
                      setBranchDivisionFilter(
                        event.target.value
                      );

                      setBranchRegionFilter("");
                      setBranchAreaFilter("");
                    }}
                  >
                    <option value="">All</option>

                    {divisionOptions.map(
                      (division) => (
                        <option
                          key={division}
                          value={division}
                        >
                          {division}
                        </option>
                      )
                    )}
                  </select>
                </label>

                <label>
                  <span>Region</span>

                  <select
                    value={branchRegionFilter}
                    onChange={(event) => {
                      setBranchRegionFilter(
                        event.target.value
                      );

                      setBranchAreaFilter("");
                    }}
                  >
                    <option value="">All</option>

                    {regionOptions.map(
                      (region) => (
                        <option
                          key={region}
                          value={region}
                        >
                          {region}
                        </option>
                      )
                    )}
                  </select>
                </label>

                <label>
                  <span>Area</span>

                  <select
                    value={branchAreaFilter}
                    onChange={(event) =>
                      setBranchAreaFilter(
                        event.target.value
                      )
                    }
                  >
                    <option value="">All</option>

                    {areaOptions.map((area) => (
                      <option
                        key={area}
                        value={area}
                      >
                        {area}
                      </option>
                    ))}
                  </select>
                </label>

                {(branchDivisionFilter ||
                  branchRegionFilter ||
                  branchAreaFilter) && (
                  <button
                    type="button"
                    className="travel-branch-filter-clear"
                    onClick={() => {
                      setBranchDivisionFilter("");
                      setBranchRegionFilter("");
                      setBranchAreaFilter("");
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            <select
              value={visitRange}
              onChange={(event) =>
                setVisitRange(
                  event.target.value
                )
              }
              className="travel-range-select"
            >
              <option value="week">
                Week
              </option>

              <option value="month">
                Month
              </option>

              <option value="year">
                Year
              </option>
            </select>
          </div>

          {filteredMostVisitedBranches.length ===
          0 ? (
            <div className="travel-empty">
              No branch visits yet.
            </div>
          ) : (
            <div className="branch-visit-chart">
              {filteredMostVisitedBranches.map(
                (item) => (
                  <div
                    key={item.branch}
                    className={`travel-branch-item ${
                      selectedBranchVisit ===
                      item.branch
                        ? "active"
                        : ""
                    }`}
                    onClick={() =>
                      setSelectedBranchVisit(
                        selectedBranchVisit ===
                          item.branch
                          ? null
                          : item.branch
                      )
                    }
                  >
                    <div className="branch-visit-info">
                      <span className="travel-branch-name">
                        {item.branch}
                      </span>

                      <b className="travel-branch-count">
                        {item.count}
                      </b>
                    </div>

                    <div className="branch-visit-bar">
                      <div
                        style={{
                          width: `${
                            (item.count /
                              maxBranchVisits) *
                            100
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}