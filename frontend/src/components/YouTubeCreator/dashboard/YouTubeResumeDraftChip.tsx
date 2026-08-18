import React, { useState } from "react";
import { YouTubeActionModal } from "./YouTubeActionModal";
import { resumeYouTubeDraft } from "./youtubeStudioEvents";

interface YouTubeResumeDraftChipProps {
  hasDraft: boolean;
  preview: string;
  onDiscard: () => void;
}

export const YouTubeResumeDraftChip: React.FC<YouTubeResumeDraftChipProps> = ({
  hasDraft,
  preview,
  onDiscard,
}) => {
  const [open, setOpen] = useState(false);
  if (!hasDraft) return null;

  return (
    <>
      <button
        type="button"
        className="yt-rail-btn yt-rail-btn--badge"
        data-tour="yt-resume-draft"
        onClick={() => setOpen(true)}
      >
        Resume Draft
      </button>
      <YouTubeActionModal
        open={open}
        title="Resume Draft"
        intro="Pick up where you left off in Video Creator."
        onClose={() => setOpen(false)}
        maxWidth={420}
      >
        <div
          style={{
            background: "#fafafa",
            border: "1px solid #e5e5e5",
            borderRadius: 10,
            padding: 12,
            fontSize: 13,
            marginBottom: 12,
          }}
        >
          {preview || "Untitled video draft"}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            className="yt-rail-btn yt-rail-btn--primary"
            onClick={() => {
              setOpen(false);
              resumeYouTubeDraft();
            }}
          >
            Continue editing →
          </button>
          <button
            type="button"
            className="yt-rail-btn"
            onClick={() => {
              setOpen(false);
              onDiscard();
            }}
          >
            Discard
          </button>
        </div>
      </YouTubeActionModal>
    </>
  );
};
