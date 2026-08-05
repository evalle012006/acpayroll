import React from "react";

export default function StaffScope({
  staffSearch,
  setStaffSearch,

  staffScopeDate,
  setStaffScopeDate,

  staffPositionFilter,
  setStaffPositionFilter,
  staffPositionOptions,

  staffDepartmentFilter,
  setStaffDepartmentFilter,
  staffDepartmentOptions,

  staffCounts,
  filteredStaffRows,

  setSelectedStaffScope,
  setStaffPlanSearch,
  setStaffPlanDateFilter,
}) {
  return (
    <div className="travel-dashboard-card">
      <div className="travel-dashboard-head">
        <div>
          <h3>Staff Scope</h3>

          <p>
            Staff visible based on your position.
          </p>
        </div>

        <div className="travel-staff-filter">
          <input
            type="search"
            className="travel-staff-search-input"
            placeholder="Search staff, position, branch..."
            value={staffSearch}
            onChange={(event) =>
              setStaffSearch(event.target.value)
            }
          />

          <div className="travel-staff-date">
            <input
              type="date"
              className="travel-date-input"
              value={staffScopeDate}
              onChange={(event) =>
                setStaffScopeDate(
                  event.target.value
                )
              }
            />
          </div>

          <select
            value={staffPositionFilter}
            onChange={(event) =>
              setStaffPositionFilter(
                event.target.value
              )
            }
          >
            <option value="">
              All Positions
            </option>

            {staffPositionOptions.map(
              (position) => (
                <option
                  key={position}
                  value={position}
                >
                  {position}
                </option>
              )
            )}
          </select>

          <select
            value={staffDepartmentFilter}
            onChange={(event) => {
              setStaffDepartmentFilter(
                event.target.value
              );

              setStaffPositionFilter("");
            }}
          >
            <option value="">
              All Departments
            </option>

            {staffDepartmentOptions.map(
              (department) => (
                <option
                  key={department}
                  value={department}
                >
                  {department}
                </option>
              )
            )}
          </select>

          <div className="travel-staff-counts">
            <span className="travel-count-pill">
              {staffCounts.total} Staff
            </span>

            <span className="travel-count-pill submitted">
              {staffCounts.submitted} Submitted
            </span>

            <span className="travel-count-pill pending">
              {staffCounts.pending} Pending
            </span>

            {staffCounts.onLeave > 0 && (
              <span className="travel-count-pill leave">
                {staffCounts.onLeave} On Leave
              </span>
            )}
          </div>
        </div>
      </div>

      {filteredStaffRows.length === 0 ? (
        <div className="travel-empty">
          No staff found.
        </div>
      ) : (
        <div className="travel-staff-list">
          {filteredStaffRows.map((staff) => (
            <button
              key={
                staff.employee_no ||
                staff.id ||
                staff.employee_name
              }
              type="button"
              className="travel-staff-card travel-staff-card-button"
              onClick={() => {
                setSelectedStaffScope(staff);
                setStaffPlanSearch("");
                setStaffPlanDateFilter("");
              }}
            >
              <div>
                <strong>
                  {staff.employee_name}
                </strong>

                <p>
                  {staff.position ||
                    "No position"}
                </p>

                <small>
                  {staff.branch_name ||
                    "No branch"}
                </small>
              </div>

              <div className="travel-staff-right">
                <span>{staff.area || "-"}</span>

                <span>
                  {staff.region || "-"}
                </span>

                <div className="travel-staff-status-wrap">
                  <div
                    className={`travel-staff-status ${String(
                      staff.travel_status ||
                        "Pending"
                    )
                      .trim()
                      .toLowerCase()
                      .replace(/\s+/g, "-")}`}
                  >
                    {staff.travel_status ||
                      "Pending"}
                  </div>

                  {staff.travel_status ===
                    "On Leave" && (
                    <small className="travel-staff-leave-date">
                      {staff.leave_start_date ||
                        "-"}{" "}
                      -{" "}
                      {staff.leave_end_date ||
                        "-"}
                    </small>
                  )}

                  {staff.travel_status ===
                    "Indefinite Leave" && (
                    <small className="travel-staff-leave-date">
                      No Return Date
                    </small>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}