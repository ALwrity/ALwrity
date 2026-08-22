import React from "react";

interface YouTubeUrlPreviewActionsProps {
  error?: string | null;
  saving?: boolean;
  onCancel: () => void;
  onSave: () => void;
  onBrainstorm: () => void;
  onUse: () => void;
}

/** Plan Blog/URL footer — Save, Brainstorm, Use. Default-exported for Fast Refresh. */
function YouTubeUrlPreviewActions({
  error,
  saving = false,
  onCancel,
  onSave,
  onBrainstorm,
  onUse,
}: YouTubeUrlPreviewActionsProps) {
  return (
    <div className="yt-url-preview-actions">
      {error ? <p className="yt-url-preview-actions__error">{error}</p> : null}
      <div className="yt-url-preview-actions__row">
        <button type="button" className="yt-rail-btn" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button
          type="button"
          className="yt-rail-btn"
          onClick={onSave}
          disabled={saving}
        >
          {saving ? "Saving…" : "Save idea"}
        </button>
        <button type="button" className="yt-rail-btn" onClick={onBrainstorm} disabled={saving}>
          Brainstorm Idea
        </button>
        <button
          type="button"
          className="yt-rail-btn yt-rail-btn--primary"
          onClick={onUse}
          disabled={saving}
        >
          Use for video idea
        </button>
      </div>
    </div>
  );
}

export default YouTubeUrlPreviewActions;
