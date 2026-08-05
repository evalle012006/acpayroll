import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import api from "../../api/axiosClient";
import "../../styles/Calendar.css";

const normalizeValue = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const readUser = () => {
  try {
    const raw = localStorage.getItem("user");

    return raw
      ? JSON.parse(raw)
      : null;
  } catch {
    return null;
  }
};

const formatDate = (value) => {
  if (!value) {
    return "-";
  }

  return String(value).slice(0, 10);
};

const formatDateTime = (value) => {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString(
    "en-PH",
    {
      timeZone: "Asia/Manila",
      month: "short",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }
  );
};

const getStatusClass = (status) => {
  return normalizeValue(status)
    .replace(/\s+/g, "-");
};

export default function ComplyPage() {
  const loggedInUser = readUser();

  const loggedInRole = normalizeValue(
    loggedInUser?.role
  );

  const complianceReviewerRoles = [
    "area manager",
    "acting area manager",
    "regional manager",
    "acting regional manager",
    "assistant vice president",
    "vice president",
    "senior vice president",
  ];

  const canReviewCompliance =
    loggedInRole === "admin" ||
    loggedInRole === "it" ||
    complianceReviewerRoles.includes(
      loggedInRole
    );

  const [complyView, setComplyView] =
    useState("my");

  const [
    complianceRows,
    setComplianceRows,
  ] = useState([]);

  const [
    reviewComplianceRows,
    setReviewComplianceRows,
  ] = useState([]);

  const [
    complianceLoading,
    setComplianceLoading,
  ] = useState(false);

  const [
    reviewComplianceLoading,
    setReviewComplianceLoading,
  ] = useState(false);

  const [
    complianceSearch,
    setComplianceSearch,
  ] = useState("");

  const [
    complianceStatusFilter,
    setComplianceStatusFilter,
  ] = useState("");

  const [
    selectedCompliance,
    setSelectedCompliance,
  ] = useState(null);

  const [
    complianceResponse,
    setComplianceResponse,
  ] = useState("");

  const [
    selectedReviewCompliance,
    setSelectedReviewCompliance,
  ] = useState(null);

  const [
    reviewRemarks,
    setReviewRemarks,
  ] = useState("");

  const [
    complianceCheckHistory,
    setComplianceCheckHistory,
  ] = useState([]);

  const [
    checkHistoryLoading,
    setCheckHistoryLoading,
  ] = useState(false);

  const fetchMyCompliances = async () => {
    setComplianceLoading(true);

    try {
      const response = await api.get(
        "/travel-plan-compliances/my"
      );

      setComplianceRows(
        Array.isArray(response.data)
          ? response.data
          : []
      );
    } catch (error) {
      console.error(
        "Fetch my compliance error:",
        error
      );

      setComplianceRows([]);
    } finally {
      setComplianceLoading(false);
    }
  };

  const fetchReviewCompliances = async () => {
    if (!canReviewCompliance) {
      setReviewComplianceRows([]);
      return;
    }

    setReviewComplianceLoading(true);

    try {
      const response = await api.get(
        "/travel-plan-compliances/review-scope"
      );

      setReviewComplianceRows(
        Array.isArray(response.data)
          ? response.data
          : []
      );
    } catch (error) {
      console.error(
        "Fetch compliance review scope error:",
        error
      );

      setReviewComplianceRows([]);
    } finally {
      setReviewComplianceLoading(false);
    }
  };

  const fetchComplianceCheckHistory =
    async (complianceId) => {
      if (!complianceId) {
        setComplianceCheckHistory([]);
        return;
      }

      setCheckHistoryLoading(true);

      try {
        const response = await api.get(
          `/travel-plan-compliances/${complianceId}/checks`
        );

        setComplianceCheckHistory(
          Array.isArray(response.data)
            ? response.data
            : []
        );
      } catch (error) {
        console.error(
          "Fetch compliance history error:",
          error
        );

        setComplianceCheckHistory([]);
      } finally {
        setCheckHistoryLoading(false);
      }
    };

  useEffect(() => {
    fetchMyCompliances();

    if (canReviewCompliance) {
      fetchReviewCompliances();
    }
  }, []);

  useEffect(() => {
    const handleComplianceUpdated = () => {
      fetchMyCompliances();

      if (canReviewCompliance) {
        fetchReviewCompliances();
      }
    };

    window.addEventListener(
      "travel-compliance-updated",
      handleComplianceUpdated
    );

    return () => {
      window.removeEventListener(
        "travel-compliance-updated",
        handleComplianceUpdated
      );
    };
  }, [canReviewCompliance]);

  const filteredComplianceRows =
    useMemo(() => {
      const search = normalizeValue(
        complianceSearch
      );

      return complianceRows.filter((row) => {
        const matchesStatus =
          !complianceStatusFilter ||
          normalizeValue(row.status) ===
            normalizeValue(
              complianceStatusFilter
            );

        const searchableText =
          normalizeValue(
            [
              row.finding_title,
              row.finding_details,
              row.travel_plan_title,
              row.employee_name,
              row.employee_no,
              row.position,
              row.branch_name,
              row.visited_branch_name,
              row.status,
              row.due_date,
              row.compliance_response,
            ]
              .filter(Boolean)
              .join(" ")
          );

        const matchesSearch =
          !search ||
          searchableText.includes(search);

        return (
          matchesStatus &&
          matchesSearch
        );
      });
    }, [
      complianceRows,
      complianceSearch,
      complianceStatusFilter,
    ]);

  const filteredReviewComplianceRows =
    useMemo(() => {
      const search = normalizeValue(
        complianceSearch
      );

      return reviewComplianceRows.filter(
        (row) => {
          const matchesStatus =
            !complianceStatusFilter ||
            normalizeValue(row.status) ===
              normalizeValue(
                complianceStatusFilter
              );

          const searchableText =
            normalizeValue(
              [
                row.finding_title,
                row.finding_details,
                row.travel_plan_title,
                row.employee_name,
                row.employee_no,
                row.position,
                row.branch_name,
                row.visited_branch_name,
                row.status,
                row.latest_checked_by_name,
                row.latest_checked_by_role,
                row.due_date,
                row.compliance_response,
              ]
                .filter(Boolean)
                .join(" ")
            );

          const matchesSearch =
            !search ||
            searchableText.includes(search);

          return (
            matchesStatus &&
            matchesSearch
          );
        }
      );
    }, [
      reviewComplianceRows,
      complianceSearch,
      complianceStatusFilter,
    ]);

  const complianceCounts = useMemo(() => {
    return {
      total: complianceRows.length,

      pending:
        complianceRows.filter(
          (row) =>
            normalizeValue(row.status) ===
            "pending"
        ).length,

      submitted:
        complianceRows.filter(
          (row) =>
            normalizeValue(row.status) ===
            "submitted"
        ).length,

      checked:
        complianceRows.filter(
          (row) =>
            normalizeValue(row.status) ===
            "checked"
        ).length,

      complied:
        complianceRows.filter(
          (row) =>
            normalizeValue(row.status) ===
            "complied"
        ).length,
    };
  }, [complianceRows]);

  const reviewComplianceCounts =
    useMemo(() => {
      return {
        total: reviewComplianceRows.length,

        submitted:
          reviewComplianceRows.filter(
            (row) =>
              normalizeValue(
                row.status
              ) === "submitted"
          ).length,

        checked:
          reviewComplianceRows.filter(
            (row) =>
              normalizeValue(
                row.status
              ) === "checked"
          ).length,
      };
    }, [reviewComplianceRows]);

  const visibleRows =
    complyView === "checking"
      ? filteredReviewComplianceRows
      : filteredComplianceRows;

  const loading =
    complyView === "checking"
      ? reviewComplianceLoading
      : complianceLoading;

  const openMyCompliance = (row) => {
    setSelectedCompliance(row);

    setComplianceResponse(
      row.compliance_response || ""
    );
  };

  const closeMyCompliance = () => {
    setSelectedCompliance(null);
    setComplianceResponse("");
  };

  const openReviewCompliance = async (
    row
  ) => {
    setSelectedReviewCompliance(row);
    setReviewRemarks("");
    setComplianceCheckHistory([]);

    await fetchComplianceCheckHistory(
      row.id
    );
  };

  const closeReviewCompliance = () => {
    setSelectedReviewCompliance(null);
    setReviewRemarks("");
    setComplianceCheckHistory([]);
  };

  const submitCompliance = async () => {
    if (!selectedCompliance?.id) {
      return;
    }

    if (!complianceResponse.trim()) {
      alert(
        "Compliance response is required."
      );

      return;
    }

    try {
      await api.put(
        `/travel-plan-compliances/${selectedCompliance.id}/comply`,
        {
          compliance_response:
            complianceResponse.trim(),
        }
      );

      closeMyCompliance();

      await fetchMyCompliances();

      window.dispatchEvent(
        new Event(
          "travel-compliance-updated"
        )
      );

      alert(
        "Compliance submitted successfully."
      );
    } catch (error) {
      console.error(
        "Submit compliance error:",
        error
      );

      alert(
        error.response?.data?.message ||
          "Failed to submit compliance."
      );
    }
  };

  const checkCompliance = async () => {
    if (
      !selectedReviewCompliance?.id
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `Check the compliance submitted by ${
          selectedReviewCompliance.employee_name ||
          "this employee"
        }?`
      );

    if (!confirmed) {
      return;
    }

    try {
      await api.put(
        `/travel-plan-compliances/${selectedReviewCompliance.id}/check`,
        {
          remarks:
            reviewRemarks.trim() || null,
        }
      );

      closeReviewCompliance();

      await Promise.all([
        fetchReviewCompliances(),
        fetchMyCompliances(),
      ]);

      window.dispatchEvent(
        new Event(
          "travel-compliance-updated"
        )
      );

      alert(
        "Compliance checked successfully."
      );
    } catch (error) {
      console.error(
        "Check compliance error:",
        error
      );

      alert(
        error.response?.data?.message ||
          "Failed to check compliance."
      );
    }
  };

  const currentCounts =
    complyView === "checking"
      ? reviewComplianceCounts
      : complianceCounts;

  return (
    <div className="travel-modern-page">
      <div className="travel-modern-layout">
        <main className="travel-calendar-main">
          <div className="travel-dashboard-card">
            <div className="travel-dashboard-head">
              <div>
                <h3>Travel Plan Compliance</h3>

                <p>
                  Submit required compliance and
                  review compliance within your
                  approval scope.
                </p>
              </div>

              <button
                type="button"
                className="travel-create-btn secondary"
                onClick={() => {
                  fetchMyCompliances();

                  if (
                    canReviewCompliance
                  ) {
                    fetchReviewCompliances();
                  }
                }}
              >
                Refresh
              </button>
            </div>

            <div className="travel-comply-view-tabs">
              <button
                type="button"
                className={
                  complyView === "my"
                    ? "active"
                    : ""
                }
                onClick={() => {
                  setComplyView("my");
                  setComplianceStatusFilter("");
                }}
              >
                My Compliance
              </button>

              {canReviewCompliance && (
                <button
                  type="button"
                  className={
                    complyView ===
                    "checking"
                      ? "active"
                      : ""
                  }
                  onClick={() => {
                    setComplyView(
                      "checking"
                    );

                    setComplianceStatusFilter(
                      ""
                    );

                    fetchReviewCompliances();
                  }}
                >
                  For Checking
                </button>
              )}
            </div>

            <div className="travel-compliance-counts">
              <button
                type="button"
                className={
                  !complianceStatusFilter
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setComplianceStatusFilter(
                    ""
                  )
                }
              >
                <span>Total</span>
                <b>{currentCounts.total}</b>
              </button>

              {complyView === "my" && (
                <>
                  <button
                    type="button"
                    className={
                      complianceStatusFilter ===
                      "Pending"
                        ? "active"
                        : ""
                    }
                    onClick={() =>
                      setComplianceStatusFilter(
                        "Pending"
                      )
                    }
                  >
                    <span>Pending</span>
                    <b>
                      {
                        complianceCounts.pending
                      }
                    </b>
                  </button>

                  <button
                    type="button"
                    className={
                      complianceStatusFilter ===
                      "Submitted"
                        ? "active"
                        : ""
                    }
                    onClick={() =>
                      setComplianceStatusFilter(
                        "Submitted"
                      )
                    }
                  >
                    <span>Submitted</span>
                    <b>
                      {
                        complianceCounts.submitted
                      }
                    </b>
                  </button>

                  <button
                    type="button"
                    className={
                      complianceStatusFilter ===
                      "Checked"
                        ? "active"
                        : ""
                    }
                    onClick={() =>
                      setComplianceStatusFilter(
                        "Checked"
                      )
                    }
                  >
                    <span>Checked</span>
                    <b>
                      {
                        complianceCounts.checked
                      }
                    </b>
                  </button>
                </>
              )}

              {complyView === "checking" && (
                <>
                  <button
                    type="button"
                    className={
                      complianceStatusFilter ===
                      "Submitted"
                        ? "active"
                        : ""
                    }
                    onClick={() =>
                      setComplianceStatusFilter(
                        "Submitted"
                      )
                    }
                  >
                    <span>Submitted</span>
                    <b>
                      {
                        reviewComplianceCounts.submitted
                      }
                    </b>
                  </button>

                  <button
                    type="button"
                    className={
                      complianceStatusFilter ===
                      "Checked"
                        ? "active"
                        : ""
                    }
                    onClick={() =>
                      setComplianceStatusFilter(
                        "Checked"
                      )
                    }
                  >
                    <span>Checked</span>
                    <b>
                      {
                        reviewComplianceCounts.checked
                      }
                    </b>
                  </button>
                </>
              )}
            </div>

            <div className="travel-compliance-filters">
              <input
                type="search"
                value={complianceSearch}
                placeholder="Search finding, staff, branch, status..."
                onChange={(event) =>
                  setComplianceSearch(
                    event.target.value
                  )
                }
              />

              <select
                value={
                  complianceStatusFilter
                }
                onChange={(event) =>
                  setComplianceStatusFilter(
                    event.target.value
                  )
                }
              >
                <option value="">
                  All Status
                </option>

                <option value="Pending">
                  Pending
                </option>

                <option value="Submitted">
                  Submitted
                </option>

                <option value="Checked">
                  Checked
                </option>

                <option value="Complied">
                  Complied
                </option>
              </select>

              <button
                type="button"
                disabled={
                  !complianceSearch &&
                  !complianceStatusFilter
                }
                onClick={() => {
                  setComplianceSearch("");
                  setComplianceStatusFilter("");
                }}
              >
                Clear
              </button>
            </div>

            {loading ? (
              <div className="travel-empty">
                Loading compliance records...
              </div>
            ) : visibleRows.length === 0 ? (
              <div className="travel-empty">
                No compliance records found.
              </div>
            ) : (
              <div className="travel-compliance-list">
                {visibleRows.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    className="travel-compliance-card"
                    onClick={() => {
                      if (
                        complyView ===
                        "checking"
                      ) {
                        openReviewCompliance(
                          row
                        );
                      } else {
                        openMyCompliance(row);
                      }
                    }}
                  >
                    <div className="travel-compliance-card-main">
                      <strong>
                        {row.finding_title ||
                          "Travel Plan Finding"}
                      </strong>

                      <span>
                        {row.travel_plan_title ||
                          "Untitled Travel Plan"}
                      </span>

                      <small>
                        {row.employee_name ||
                          "-"}

                        {row.position
                          ? ` • ${row.position}`
                          : ""}
                      </small>

                      <small>
                        Branch:{" "}
                        {row.visited_branch_name ||
                          row.branch_name ||
                          "-"}
                      </small>

                      {row.due_date && (
                        <small>
                          Due:{" "}
                          {formatDate(
                            row.due_date
                          )}
                        </small>
                      )}
                    </div>

                    <div className="travel-compliance-card-side">
                      <span
                        className={`travel-compliance-status ${getStatusClass(
                          row.status
                        )}`}
                      >
                        {row.status ||
                          "Pending"}
                      </span>

                      {row.latest_checked_by_name && (
                        <small>
                          Checked by:{" "}
                          {
                            row.latest_checked_by_name
                          }
                        </small>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedCompliance && (
            <div
              className="travel-plan-modal-backdrop"
              onMouseDown={(event) => {
                if (
                  event.target.classList.contains(
                    "travel-plan-modal-backdrop"
                  )
                ) {
                  closeMyCompliance();
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
                  <div>
                    <h3>
                      {selectedCompliance.finding_title ||
                        "Compliance Details"}
                    </h3>

                    <p className="travel-staff-modal-subtitle">
                      {selectedCompliance.travel_plan_title ||
                        "Travel Plan"}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={closeMyCompliance}
                  >
                    ×
                  </button>
                </div>

                <div className="travel-compliance-detail-grid">
                  <div>
                    <span>Employee</span>
                    <strong>
                      {selectedCompliance.employee_name ||
                        "-"}
                    </strong>
                  </div>

                  <div>
                    <span>Position</span>
                    <strong>
                      {selectedCompliance.position ||
                        "-"}
                    </strong>
                  </div>

                  <div>
                    <span>Branch</span>
                    <strong>
                      {selectedCompliance.visited_branch_name ||
                        selectedCompliance.branch_name ||
                        "-"}
                    </strong>
                  </div>

                  <div>
                    <span>Due Date</span>
                    <strong>
                      {formatDate(
                        selectedCompliance.due_date
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>Status</span>
                    <strong>
                      {selectedCompliance.status ||
                        "Pending"}
                    </strong>
                  </div>

                  <div>
                    <span>Review Level</span>
                    <strong>
                      {selectedCompliance.review_level ||
                        "-"}
                    </strong>
                  </div>
                </div>

                <div className="travel-compliance-details">
                  <span>Finding Details</span>

                  <p>
                    {selectedCompliance.finding_details ||
                      "No finding details provided."}
                  </p>
                </div>

                {selectedCompliance.latest_checked_by_name && (
                  <div className="travel-compliance-details">
                    <span>Latest Check</span>

                    <p>
                      Checked by{" "}
                      <b>
                        {
                          selectedCompliance.latest_checked_by_name
                        }
                      </b>

                      {selectedCompliance.latest_checked_by_role
                        ? ` (${selectedCompliance.latest_checked_by_role})`
                        : ""}

                      {selectedCompliance.latest_checked_at
                        ? ` on ${formatDateTime(
                            selectedCompliance.latest_checked_at
                          )}`
                        : ""}
                    </p>

                    {selectedCompliance.latest_check_remarks && (
                      <p>
                        Remarks:{" "}
                        {
                          selectedCompliance.latest_check_remarks
                        }
                      </p>
                    )}
                  </div>
                )}

                <label className="travel-compliance-response-field">
                  Compliance Response

                  <textarea
                    rows={6}
                    value={
                      complianceResponse
                    }
                    placeholder="Explain the action taken to comply with this finding..."
                    onChange={(event) =>
                      setComplianceResponse(
                        event.target.value
                      )
                    }
                    disabled={
                      normalizeValue(
                        selectedCompliance.status
                      ) === "checked"
                    }
                  />
                </label>

                <div className="travel-plan-modal-actions">
                  <button
                    type="button"
                    onClick={closeMyCompliance}
                  >
                    Close
                  </button>

                  {normalizeValue(
                    selectedCompliance.status
                  ) !== "checked" && (
                    <button
                      type="button"
                      className="primary"
                      onClick={
                        submitCompliance
                      }
                    >
                      Submit Compliance
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {selectedReviewCompliance && (
            <div
              className="travel-plan-modal-backdrop"
              onMouseDown={(event) => {
                if (
                  event.target.classList.contains(
                    "travel-plan-modal-backdrop"
                  )
                ) {
                  closeReviewCompliance();
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
                  <div>
                    <h3>
                      Review Compliance
                    </h3>

                    <p className="travel-staff-modal-subtitle">
                      {selectedReviewCompliance.employee_name ||
                        "Employee"}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={
                      closeReviewCompliance
                    }
                  >
                    ×
                  </button>
                </div>

                <div className="travel-compliance-detail-grid">
                  <div>
                    <span>Finding</span>
                    <strong>
                      {selectedReviewCompliance.finding_title ||
                        "-"}
                    </strong>
                  </div>

                  <div>
                    <span>Status</span>
                    <strong>
                      {selectedReviewCompliance.status ||
                        "-"}
                    </strong>
                  </div>

                  <div>
                    <span>Employee</span>
                    <strong>
                      {selectedReviewCompliance.employee_name ||
                        "-"}
                    </strong>
                  </div>

                  <div>
                    <span>Branch</span>
                    <strong>
                      {selectedReviewCompliance.visited_branch_name ||
                        selectedReviewCompliance.branch_name ||
                        "-"}
                    </strong>
                  </div>

                  <div>
                    <span>Due Date</span>
                    <strong>
                      {formatDate(
                        selectedReviewCompliance.due_date
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>Review Level</span>
                    <strong>
                      {selectedReviewCompliance.review_level ||
                        "-"}
                    </strong>
                  </div>
                </div>

                <div className="travel-compliance-details">
                  <span>Finding Details</span>

                  <p>
                    {selectedReviewCompliance.finding_details ||
                      "-"}
                  </p>
                </div>

                <div className="travel-compliance-details">
                  <span>
                    Compliance Response
                  </span>

                  <p>
                    {selectedReviewCompliance.compliance_response ||
                      "No response submitted."}
                  </p>
                </div>

                <label className="travel-compliance-response-field">
                  Reviewer Remarks

                  <textarea
                    rows={5}
                    value={reviewRemarks}
                    placeholder="Enter review remarks, optional..."
                    onChange={(event) =>
                      setReviewRemarks(
                        event.target.value
                      )
                    }
                  />
                </label>

                <div className="travel-compliance-history">
                  <h4>Check History</h4>

                  {checkHistoryLoading ? (
                    <div className="travel-empty">
                      Loading check history...
                    </div>
                  ) : complianceCheckHistory.length ===
                    0 ? (
                    <div className="travel-empty">
                      No previous checks.
                    </div>
                  ) : (
                    complianceCheckHistory.map(
                      (history) => (
                        <div
                          key={history.id}
                          className="travel-compliance-history-item"
                        >
                          <div>
                            <strong>
                              {history.checked_by_name ||
                                history.reviewer_name ||
                                "-"}
                            </strong>

                            <span>
                              {history.checked_by_role ||
                                history.reviewer_role ||
                                "-"}
                            </span>
                          </div>

                          <small>
                            {formatDateTime(
                              history.checked_at ||
                                history.created_at
                            )}
                          </small>

                          {history.remarks && (
                            <p>
                              {history.remarks}
                            </p>
                          )}
                        </div>
                      )
                    )
                  )}
                </div>

                <div className="travel-plan-modal-actions">
                  <button
                    type="button"
                    onClick={
                      closeReviewCompliance
                    }
                  >
                    Close
                  </button>

                  {normalizeValue(
                    selectedReviewCompliance.status
                  ) === "submitted" && (
                    <button
                      type="button"
                      className="primary"
                      onClick={
                        checkCompliance
                      }
                    >
                      Mark as Checked
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}