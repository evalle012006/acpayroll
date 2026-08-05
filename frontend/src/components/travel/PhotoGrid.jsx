import React from "react";

export default function PhotoGrid({
  type,
  planPhotos,
  selectedPlan,
  formatTime,
  setPreviewPhoto,
  deletePlanPhoto,
}) {
  const filteredPhotos = planPhotos.filter(
    (photo) => photo.photo_type === type
  );

  if (filteredPhotos.length === 0) {
    return (
      <div className="travel-empty">
        No photos uploaded yet.
      </div>
    );
  }

  return (
    <div className="travel-photo-grid">
      {filteredPhotos.map((photo) => (
        <div
          key={photo.id}
          className="travel-photo-card"
        >
          <img
            src={photo.signed_url}
            alt={photo.photo_type}
            className="travel-photo-click"
            onClick={() =>
              setPreviewPhoto(photo.signed_url)
            }
          />

          {String(
            selectedPlan?.status || ""
          )
            .trim()
            .toLowerCase() !== "completed" && (
            <button
              type="button"
              className="travel-photo-delete"
              onClick={() =>
                deletePlanPhoto(photo.id)
              }
            >
              ×
            </button>
          )}

          <div>
            <b>{photo.photo_type}</b>

            <span>
              {formatTime(
                photo.captured_at ||
                  photo.created_at
              )}
            </span>

            {photo.latitude &&
              photo.longitude && (
                <small>
                  {photo.latitude},{" "}
                  {photo.longitude}
                </small>
              )}
          </div>
        </div>
      ))}
    </div>
  );
}