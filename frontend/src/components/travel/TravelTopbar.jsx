export default function TravelTopbar({
  month,
  year,
  today,
  MONTHS,
  setMonth,
  setYear,
  onCreatePlan,
  onCreateActivity,
  canManageCalendarActivities,
}) {
  return (
    <div className="travel-topbar">
      <div className="travel-view-tabs">
        <button className="active" type="button">
          Month
        </button>
      </div>

      <div className="travel-view-selects">
        <span>View:</span>

        <select
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
        >
          {MONTHS.map((m, i) => (
            <option key={m} value={i}>
              {m}
            </option>
          ))}
        </select>

        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
        >
          {Array.from({ length: 10 }).map((_, i) => {
            const y = today.getFullYear() - 5 + i;

            return (
              <option key={y} value={y}>
                {y}
              </option>
            );
          })}
        </select>
      </div>

      <div className="travel-top-actions">
        <button
          className="travel-create-btn"
          type="button"
          onClick={onCreatePlan}
        >
          + Create
        </button>

        {canManageCalendarActivities && (
          <button
            className="travel-create-btn secondary"
            type="button"
            onClick={onCreateActivity}
          >
            + Create Activity
          </button>
        )}
      </div>
    </div>
  );
}