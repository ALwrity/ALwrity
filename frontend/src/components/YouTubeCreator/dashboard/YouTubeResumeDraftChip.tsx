import React, { useState } from "react";
import { YouTubeActionModal } from "./YouTubeActionModal";
import { YouTubeStudioTabButton } from "../components/YouTubeStudioTabButton";
import { resumeYouTubeDraft } from "./youtubeStudioEvents";

interface YouTubeResumeDraftChipProps {
  hasDraft: boolean;
  preview: string;
  onDiscard: () => void;
  layout?: "pill" | "tab";
}

export const YouTubeResumeDraftChip: React.FC<YouTubeResumeDraftChipProps> = ({
  hasDraft,
  preview,
  onDiscard,
  layout = "pill",
}) => {
  const [open, setOpen] = useState(false);
  if (layout !== "tab" && !hasDraft) return null;

  return (
    <>
      {layout === "tab" ? (
        <YouTubeStudioTabButton
          label="Resume Work"
          stackedLabel={["Resume", "Work"]}
          icon="📄"
          showBadge={hasDraft}
          open={open}
          onClick={() => setOpen(true)}
          dataTour="yt-resume-draft"
        />
      ) : (
        <button
          type="button"
          className="yt-rail-btn yt-rail-btn--badge"
          data-tour="yt-resume-draft"
          onClick={() => setOpen(true)}
        >
          Resume Draft
        </button>
      )}
      <YouTubeActionModal
        open={open}
        title="Resume Draft"
        intro={
          hasDraft
            ? "Pick up where you left off in Video Creator."
            : "No in-progress video draft was found."
        }
        onClose={() => setOpen(false)}
        maxWidth={420}
      >
        {hasDraft ? (
          <>
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
          </>
        ) : (
          <p className="yt-modal-intro">
            Start a video from Create, or use Start New, before Resume can continue a draft.
          </p>
        )}
      </YouTubeActionModal>
    </>
  );
};
