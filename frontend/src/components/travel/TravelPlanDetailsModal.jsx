import React from "react";

export default function TravelPlanDetailsModal({
      selectedPlan,
      closePlan,

      detailTab,
      setDetailTab,

      setShowNoteForm,

      normalizeValue,

      formatTime,
      getFirstPhotoTime,
      getTravelDuration,  

      setSelectedPlan,

      uploadPlanPhotos,

      renderPhotoGrid,
      renderNoteTab,

      updateTravelPlan,
      submitPlan,

      canDeleteTravelPlans,
      deleteTravelPlan,
    }) {
        return (
          <>
            {selectedPlan && (
              <div
                className="travel-plan-modal-backdrop"
                onMouseDown={(event) => {
                  if (
                    event.target.classList.contains(
                      "travel-plan-modal-backdrop"
                    )
                  ) {
                    closePlan();
                  }
                }}
              >
                <div
                  className="travel-plan-modal travel-plan-detail-modal"
                  onMouseDown={(event) =>
                    event.stopPropagation()
                  }
                >
                  {/* MODERN MODAL HEADER */}
                    <div className="travel-detail-header">
                      <div className="travel-detail-header-main">
                        <div className="travel-detail-title-row">
                          <div>
                            <span className="travel-detail-eyebrow">
                              Travel Plan Details
                            </span>

                            <h3>
                              {selectedPlan.title ||
                                "Untitled Travel Plan"}
                            </h3>
                          </div>

                          <b
                            className={`travel-detail-status ${
                              normalizeValue(selectedPlan.status) === "completed"
                                ? "completed"
                                : normalizeValue(selectedPlan.status) === "incomplete"
                                ? "incomplete"
                                : "pending"
                            }`}
                          >
                            {selectedPlan.status || "Pending"}
                          </b>
                        </div>

                        <div className="travel-detail-employee">
                          <div className="travel-detail-avatar">
                            {String(
                              selectedPlan.employee_name || "E"
                            )
                              .trim()
                              .charAt(0)
                              .toUpperCase()}
                          </div>

                          <div>
                            <strong>
                              {selectedPlan.employee_name ||
                                "No employee assigned"}
                            </strong>

                            <span>
                              {selectedPlan.position ||
                                "No position"}
                            </span>
                          </div>
                        </div>

                        <div className="travel-detail-location">
                          <span>Visited Branch</span>

                          <strong>
                            {selectedPlan.branch_name ||
                              "No branch selected"}
                          </strong>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="travel-detail-close"
                        onClick={closePlan}
                        aria-label="Close travel plan details"
                      >
                        ×
                      </button>
                    </div>

                    {/* MODERN STATUS SUMMARY */}
                    <div className="travel-detail-summary-grid">
                      <div className="travel-detail-summary-card status">
                        <span>Status</span>

                        <strong>
                          {selectedPlan.status || "Pending"}
                        </strong>
                      </div>

                      <div className="travel-detail-summary-card">
                        <span>Time In</span>

                        <strong>
                          {formatTime(
                            getFirstPhotoTime("CHECK_IN")
                          )}
                        </strong>
                      </div>

                      <div className="travel-detail-summary-card">
                        <span>Time Out</span>

                        <strong>
                          {formatTime(
                            getFirstPhotoTime("CHECK_OUT")
                          )}
                        </strong>
                      </div>

                      <div className="travel-detail-summary-card">
                        <span>Duration</span>

                        <strong>
                          {getTravelDuration()}
                        </strong>
                      </div>
                    </div>

                  {/* DETAILS FORM */}
                  <div className="travel-plan-form">
                    <label>
                      Title

                      <input
                        type="text"
                        value={selectedPlan.title || ""}
                        disabled={[
                          "completed",
                          "incomplete",
                        ].includes(
                          normalizeValue(selectedPlan.status)
                        )}
                        onChange={(event) =>
                          setSelectedPlan((previous) => ({
                            ...previous,
                            title: event.target.value,
                          }))
                        }
                      />
                    </label>

                    <label>
                      Employee

                      <input
                        type="text"
                        value={
                          selectedPlan.employee_name || ""
                        }
                        disabled
                      />
                    </label>

                    <label>
                      Position

                      <input
                        type="text"
                        value={
                          selectedPlan.position || ""
                        }
                        disabled
                      />
                    </label>

                    <label>
                      Date

                      <input
                        type="date"
                        value={String(
                          selectedPlan.plan_date || ""
                        ).slice(0, 10)}
                        disabled={[
                          "completed",
                          "incomplete",
                        ].includes(
                          normalizeValue(selectedPlan.status)
                        )}
                        onChange={(event) =>
                          setSelectedPlan((previous) => ({
                            ...previous,
                            plan_date: event.target.value,
                          }))
                        }
                      />
                    </label>

                    <label>
                      Branch

                      <input
                        type="text"
                        value={
                          selectedPlan.branch_name || ""
                        }
                        disabled={[
                          "completed",
                          "incomplete",
                        ].includes(
                          normalizeValue(selectedPlan.status)
                        )}
                        onChange={(event) =>
                          setSelectedPlan((previous) => ({
                            ...previous,
                            branch_name:
                              event.target.value,
                          }))
                        }
                      />
                    </label>

                    <label className="travel-plan-full-field">
                      Description

                      <textarea
                        rows={4}
                        value={
                          selectedPlan.description || ""
                        }
                        disabled={[
                          "completed",
                          "incomplete",
                        ].includes(
                          normalizeValue(selectedPlan.status)
                        )}
                        onChange={(event) =>
                          setSelectedPlan((previous) => ({
                            ...previous,
                            description:
                              event.target.value,
                          }))
                        }
                      />
                    </label>
                  </div>
                    
                  {/* FIVE-STEP TRAVEL WORKFLOW */}
                    <div className="travel-workflow-heading">
                      <div>
                        <span>Travel Progress</span>

                        <h4>Complete the five-step visit process</h4>
                      </div>
                    </div>

                    <div className="travel-stepper">
                      <button
                        type="button"
                        className={`travel-step ${
                          detailTab === "checkin" ? "active" : ""
                        }`}
                        onClick={() => {
                          setDetailTab("checkin");
                          setShowNoteForm(false);
                        }}
                      >
                        <span>1</span>
                        <label>Time In</label>
                      </button>

                      <div className="travel-step-line" />

                      <button
                        type="button"
                        className={`travel-step ${
                          detailTab === "review" ? "active" : ""
                        }`}
                        onClick={() => {
                          setDetailTab("review");
                          setShowNoteForm(false);
                        }}
                      >
                        <span>2</span>
                        <label>Branch Visit</label>
                      </button>

                      <div className="travel-step-line" />

                      <button
                        type="button"
                        className={`travel-step ${
                          detailTab === "findings" ? "active" : ""
                        }`}
                        onClick={() => {
                          setDetailTab("findings");
                          setShowNoteForm(false);
                        }}
                      >
                        <span>3</span>
                        <label>Group Visit</label>
                      </button>

                      <div className="travel-step-line" />

                      <button
                        type="button"
                        className={`travel-step ${
                          detailTab === "upload" ? "active" : ""
                        }`}
                        onClick={() => {
                          setDetailTab("upload");
                          setShowNoteForm(false);
                        }}
                      >
                        <span>4</span>
                        <label>Upload</label>
                      </button>

                      <div className="travel-step-line" />

                      <button
                        type="button"
                        className={`travel-step ${
                          detailTab === "checkout" ? "active" : ""
                        }`}
                        onClick={() => {
                          setDetailTab("checkout");
                          setShowNoteForm(false);
                        }}
                      >
                        <span>5</span>
                        <label>Time Out</label>
                      </button>
                    </div>

                    {/* STEP 1 — TIME IN */}
                    {detailTab === "checkin" && (
                      <div className="travel-tab-content">
                        <h3>Time In</h3>

                        <p>
                          Capture your check-in photo. Your current GPS
                          location and time will be saved automatically.
                        </p>

                        {![
                          "completed",
                          "incomplete",
                        ].includes(
                          normalizeValue(selectedPlan.status)
                        ) && (
                          <label className="travel-photo-upload-btn">
                            + Capture Time In Photo

                            <input
                              type="file"
                              hidden
                              accept="image/*"
                              capture="environment"
                              onChange={(event) =>
                                uploadPlanPhotos(
                                  "CHECK_IN",
                                  event.target.files
                                )
                              }
                            />
                          </label>
                        )}

                        {renderPhotoGrid("CHECK_IN")}
                      </div>
                    )}

                    {/* STEP 2 — BRANCH VISIT */}
                    {detailTab === "review" &&
                      renderNoteTab("REVIEW")}

                    {/* STEP 3 — GROUP VISIT */}
                    {detailTab === "findings" &&
                      renderNoteTab("FINDINGS")}

                    {/* STEP 4 — GENERAL UPLOAD */}
                    {detailTab === "upload" && (
                      <div className="travel-tab-content">
                        <h3>Supporting Photos</h3>

                        <p>
                          Upload supporting photos, documents, affidavits,
                          or other evidence related to this travel plan.
                        </p>

                        {![
                          "completed",
                          "incomplete",
                        ].includes(
                          normalizeValue(selectedPlan.status)
                        ) && (
                          <label className="travel-photo-upload-btn">
                            + Upload Supporting Photos

                            <input
                              type="file"
                              hidden
                              multiple
                              accept="image/*"
                              onChange={(event) =>
                                uploadPlanPhotos(
                                  "GENERAL",
                                  event.target.files
                                )
                              }
                            />
                          </label>
                        )}

                        {renderPhotoGrid("GENERAL")}
                      </div>
                    )}

                    {/* STEP 5 — TIME OUT */}
                    {detailTab === "checkout" && (
                      <div className="travel-tab-content">
                        <h3>Time Out</h3>

                        <p>
                          Capture your check-out photo. Your current GPS
                          location and time will be saved automatically.
                        </p>

                        {![
                          "completed",
                          "incomplete",
                        ].includes(
                          normalizeValue(selectedPlan.status)
                        ) && (
                          <label className="travel-photo-upload-btn">
                            + Capture Time Out Photo

                            <input
                              type="file"
                              hidden
                              accept="image/*"
                              capture="environment"
                              onChange={(event) =>
                                uploadPlanPhotos(
                                  "CHECK_OUT",
                                  event.target.files
                                )
                              }
                            />
                          </label>
                        )}

                        {renderPhotoGrid("CHECK_OUT")}

                        <div className="travel-time-summary">
                          <div>
                            <b>Time In</b>
                            <span>
                              {formatTime(
                                getFirstPhotoTime("CHECK_IN")
                              )}
                            </span>
                          </div>

                          <div>
                            <b>Time Out</b>
                            <span>
                              {formatTime(
                                getFirstPhotoTime("CHECK_OUT")
                              )}
                            </span>
                          </div>

                          <div>
                            <b>Duration</b>
                            <span>{getTravelDuration()}</span>
                          </div>
                        </div>
                      </div>
                    )}

                  {/* MODAL ACTIONS */}
                  <div className="travel-note-actions">
                    <button
                      type="button"
                      onClick={closePlan}
                    >
                      Close
                    </button>

                    {![
                      "completed",
                      "incomplete",
                    ].includes(
                      normalizeValue(selectedPlan.status)
                    ) && (
                      <>
                        <button
                          type="button"
                          onClick={updateTravelPlan}
                        >
                          Save Changes
                        </button>

                        <button
                          type="button"
                          onClick={submitPlan}
                        >
                          Submit as Completed
                        </button>
                      </>
                    )}

                    {canDeleteTravelPlans && (
                      <button
                        type="button"
                        className="travel-record-delete"
                        onClick={() =>
                          deleteTravelPlan(
                            selectedPlan.id
                          )
                        }
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
        </>
      );
    }