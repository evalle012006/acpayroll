import React from "react";

export default function TravelPlanNote({
  type,
  planNotes,
  selectedPlan,
  formatTime,
  openEditNote,
  deleteNote,
  setPreviewPhoto,
}) {
  const notes = planNotes.filter(
    (note) => note.note_type === type
  );

  const isCompleted =
    String(selectedPlan?.status || "")
      .trim()
      .toLowerCase() === "completed";

  if (notes.length === 0) {
    return (
      <div className="travel-note-list">
        <div className="travel-empty">
          No records yet.
        </div>
      </div>
    );
  }

  return (
    <div className="travel-note-list">
      {notes.map((note) => (
        <div
          key={note.id}
          className="travel-note-card"
        >
          <div className="travel-note-head">
            <div>
              <h4>
                {note.title ||
                  "Travel Plan Finding"}
              </h4>

              <span>
                {formatTime(note.created_at)}
              </span>
            </div>

            {!isCompleted && (
              <div className="travel-note-head-actions">
                <button
                  type="button"
                  className="travel-note-edit-btn"
                  onClick={() =>
                    openEditNote(note)
                  }
                >
                  Edit
                </button>

                <button
                  type="button"
                  className="travel-note-delete-btn"
                  onClick={() =>
                    deleteNote(note.id)
                  }
                >
                  ×
                </button>
              </div>
            )}
          </div>

          {note.involved_staff && (
            <div className="travel-involved-list">
              <b>Involved Staff:</b>

              <div className="travel-involved-tags">
                {String(note.involved_staff)
                  .split(", ")
                  .filter(Boolean)
                  .map(
                    (staffName, index) => (
                      <span
                        key={`${staffName}-${index}`}
                        className="travel-involved-tag"
                      >
                        {staffName}
                      </span>
                    )
                  )}
              </div>
            </div>
          )}

          {note.note_type ===
          "FINDINGS" ? (
            <div className="travel-saved-findings">
              {note.passbook_reconciliation && (
                <div className="travel-saved-finding-item">
                  <b>
                    Passbook Reconciliation
                  </b>

                  <p>
                    {
                      note.passbook_reconciliation
                    }
                  </p>
                </div>
              )}

              {note.past_due_delinquent_report && (
                <div className="travel-saved-finding-item">
                  <b>
                    Past Due &amp; Delinquent
                    Report
                  </b>

                  <p>
                    {
                      note.past_due_delinquent_report
                    }
                  </p>
                </div>
              )}

              {note.group_collection_record && (
                <div className="travel-saved-finding-item">
                  <b>
                    Group Collection Record
                  </b>

                  <p>
                    {
                      note.group_collection_record
                    }
                  </p>
                </div>
              )}

              {note.other_findings && (
                <div className="travel-saved-finding-item">
                  <b>Others</b>

                  <p>
                    {note.other_findings}
                  </p>
                </div>
              )}

              {note.due_date && (
                <div className="travel-note-due-date">
                  <b>
                    Compliance Due Date:
                  </b>{" "}
                  {String(
                    note.due_date
                  ).slice(0, 10)}
                </div>
              )}

              {note.finding_photo_signed_url && (
                <img
                  src={
                    note.finding_photo_signed_url
                  }
                  alt="Group Visit Findings"
                  className="travel-finding-photo"
                  onClick={() =>
                    setPreviewPhoto(
                      note.finding_photo_signed_url
                    )
                  }
                />
              )}
            </div>
          ) : (
            <div className="travel-saved-findings">
              {note.review_coh && (
                <div className="travel-saved-finding-item">
                  <b>COH</b>

                  <p>{note.review_coh}</p>
                </div>
              )}

              {note.review_cashbook_vs_voucher && (
                <div className="travel-saved-finding-item">
                  <b>
                    Cashbook vs Voucher
                  </b>

                  <p>
                    {note.review_cashbook_vs_voucher}
                  </p>
                </div>
              )}

              {note.review_lor && (
                <div className="travel-saved-finding-item">
                  <b>LOR</b>
                  <p>{note.review_lor}</p>
                </div>
              )}

              {note.review_los && (
                <div className="travel-saved-finding-item">
                  <b>LOS</b>
                  <p>{note.review_los}</p>
                </div>
              )}

              {note.review_ldf && (
                <div className="travel-saved-finding-item">
                  <b>LDF</b>
                  <p>{note.review_ldf}</p>
                </div>
              )}

              {note.review_dcs && (
                <div className="travel-saved-finding-item">
                  <b>DCS</b>
                  <p>{note.review_dcs}</p>
                </div>
              )}

              {note.review_bms && (
                <div className="travel-saved-finding-item">
                  <b>BMS</b>

                  <p>{note.review_bms}</p>
                </div>
              )}

              {note.review_other_findings && (
                <div className="travel-saved-finding-item">
                  <b>Others</b>

                  <p>
                    {note.review_other_findings}
                  </p>
                </div>
              )}

              {note.review_photo_signed_url && (
                <img
                  src={
                    note.review_photo_signed_url
                  }
                  alt="Branch Visit Findings"
                  className="travel-finding-photo"
                  onClick={() =>
                    setPreviewPhoto(
                      note.review_photo_signed_url
                    )
                  }
                />
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}