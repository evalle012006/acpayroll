import React from "react";
import Select from "react-select";

export default function TravelPlanNoteTab({
  type,

  selectedPlan,

  showNoteForm,
  setShowNoteForm,

  noteForm,
  setNoteForm,
  emptyNoteForm,

  editingNoteId,
  setEditingNoteId,

  editingNoteType,
  setEditingNoteType,

  findingPhoto,
  setFindingPhoto,

  reviewPhoto,
  setReviewPhoto,

  involvedStaffOptions,

  createNote,
  renderNotes,
}) {
  const isReview = type === "REVIEW";

  const isCompleted =
    String(selectedPlan?.status || "")
      .trim()
      .toLowerCase() === "completed";

  const resetForm = () => {
    setShowNoteForm(false);

    setNoteForm(emptyNoteForm);

    setEditingNoteId(null);
    setEditingNoteType(null);

    setFindingPhoto(null);
    setReviewPhoto(null);
  };

  return (
    <div className="travel-tab-content">
      {!showNoteForm ? (
        !isCompleted && (
          <button
            type="button"
            className="travel-create-note-btn"
            onClick={() => {
              setEditingNoteId(null);
              setEditingNoteType(null);

              setShowNoteForm(true);

              setNoteForm({
                ...emptyNoteForm,

                title: isReview
                  ? "Branch Visit Findings"
                  : "Group Visit Findings",
              });

              setFindingPhoto(null);
              setReviewPhoto(null);
            }}
          >
            + Create{" "}
            {isReview
              ? "Review"
              : "Findings"}
          </button>
        )
      ) : (
        <div className="travel-note-form">
          {isReview ? (
            <>
              <h3 className="travel-findings-title">
                Branch Visit Findings
              </h3>

              <label>
                COH

                <textarea
                  rows={4}
                  placeholder="Enter COH findings..."
                  value={noteForm.review_coh}
                  onChange={(event) =>
                    setNoteForm((previous) => ({
                      ...previous,

                      review_coh:
                        event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                Cashbook vs Voucher

                <textarea
                  rows={4}
                  placeholder="Enter Cashbook vs Voucher findings..."
                  value={
                    noteForm.review_cashbook_vs_voucher
                  }
                  onChange={(event) =>
                    setNoteForm((previous) => ({
                      ...previous,

                      review_cashbook_vs_voucher:
                        event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                LOR

                <textarea
                  rows={4}
                  placeholder="Enter LOR findings..."
                  value={noteForm.review_lor || ""}
                  onChange={(event) =>
                    setNoteForm((previous) => ({
                      ...previous,
                      review_lor: event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                LOS

                <textarea
                  rows={4}
                  placeholder="Enter LOS findings..."
                  value={noteForm.review_los || ""}
                  onChange={(event) =>
                    setNoteForm((previous) => ({
                      ...previous,
                      review_los: event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                LDF

                <textarea
                  rows={4}
                  placeholder="Enter LDF findings..."
                  value={noteForm.review_ldf || ""}
                  onChange={(event) =>
                    setNoteForm((previous) => ({
                      ...previous,
                      review_ldf: event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                DCS

                <textarea
                  rows={4}
                  placeholder="Enter DCS findings..."
                  value={noteForm.review_dcs || ""}
                  onChange={(event) =>
                    setNoteForm((previous) => ({
                      ...previous,
                      review_dcs: event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                BMS

                <textarea
                  rows={4}
                  placeholder="Enter BMS findings..."
                  value={noteForm.review_bms}
                  onChange={(event) =>
                    setNoteForm((previous) => ({
                      ...previous,

                      review_bms:
                        event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                Others

                <textarea
                  rows={4}
                  placeholder="Enter other findings..."
                  value={
                    noteForm.review_other_findings
                  }
                  onChange={(event) =>
                    setNoteForm((previous) => ({
                      ...previous,

                      review_other_findings:
                        event.target.value,
                    }))
                  }
                />
              </label>
            </>
          ) : (
            <>
              <h3 className="travel-findings-title">
                Group Visit Findings
              </h3>

              <label>
                Passbook Reconciliation

                <textarea
                  rows={4}
                  placeholder="Enter Passbook Reconciliation findings..."
                  value={
                    noteForm.passbook_reconciliation
                  }
                  onChange={(event) =>
                    setNoteForm((previous) => ({
                      ...previous,

                      passbook_reconciliation:
                        event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                Past Due & Delinquent Report

                <textarea
                  rows={4}
                  placeholder="Enter Past Due & Delinquent Report findings..."
                  value={
                    noteForm.past_due_delinquent_report
                  }
                  onChange={(event) =>
                    setNoteForm((previous) => ({
                      ...previous,

                      past_due_delinquent_report:
                        event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                Group Collection Record

                <textarea
                  rows={4}
                  placeholder="Enter Group Collection Record findings..."
                  value={
                    noteForm.group_collection_record
                  }
                  onChange={(event) =>
                    setNoteForm((previous) => ({
                      ...previous,

                      group_collection_record:
                        event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                Others

                <textarea
                  rows={4}
                  placeholder="Enter other findings..."
                  value={noteForm.other_findings}
                  onChange={(event) =>
                    setNoteForm((previous) => ({
                      ...previous,

                      other_findings:
                        event.target.value,
                    }))
                  }
                />
              </label>
            </>
          )}

          <label>
            Involved Staff

            <Select
              className="travel-staff-search"
              classNamePrefix="select"
              options={involvedStaffOptions}
              placeholder="Search and select staff..."
              isMulti
              isClearable
              closeMenuOnSelect={false}
              value={involvedStaffOptions.filter(
                (option) =>
                  noteForm.involved_staff_ids.includes(
                    Number(option.value)
                  )
              )}
              onChange={(selectedOptions) => {
                const selected =
                  Array.isArray(selectedOptions)
                    ? selectedOptions
                    : [];

                setNoteForm((previous) => ({
                  ...previous,

                  involved_staff_ids:
                    selected.map((option) =>
                      Number(option.value)
                    ),

                  involved_staff:
                    selected.map(
                      (option) =>
                        option.employee_name
                    ),
                }));
              }}
              noOptionsMessage={() =>
                "No staff found"
              }
            />
          </label>

          {!isReview && (
            <label>
              Compliance Due Date

              <input
                type="date"
                value={noteForm.due_date}
                onChange={(event) =>
                  setNoteForm((previous) => ({
                    ...previous,

                    due_date:
                      event.target.value,
                  }))
                }
              />
            </label>
          )}

          <label>
            Upload Photo

            <input
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              onChange={(event) => {
                const file =
                  event.target.files?.[0] ||
                  null;

                if (isReview) {
                  setReviewPhoto(file);
                } else {
                  setFindingPhoto(file);
                }
              }}
            />

            {isReview &&
              reviewPhoto?.name && (
                <small className="travel-note-file-name">
                  Selected:{" "}
                  {reviewPhoto.name}
                </small>
              )}

            {!isReview &&
              findingPhoto?.name && (
                <small className="travel-note-file-name">
                  Selected:{" "}
                  {findingPhoto.name}
                </small>
              )}
          </label>

          <div className="travel-note-actions">
            <button
              type="button"
              onClick={resetForm}
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={() =>
                createNote(type)
              }
            >
              {editingNoteId &&
              editingNoteType === type
                ? "Update"
                : "Save"}
            </button>
          </div>
        </div>
      )}

      {renderNotes(type)}
    </div>
  );
}