import React, { useState } from "react";
import { YouTubeActionModal } from "./YouTubeActionModal";

interface YouTubeCopilotFabProps {
  variant?: "corner" | "fixed";
}

export const YouTubeCopilotFab: React.FC<YouTubeCopilotFabProps> = ({
  variant = "corner",
}) => {
  const [open, setOpen] = useState(false);
  const isFixed = variant === "fixed";

  const inner = (
    <>
      <button
        type="button"
        className="yt-copilot-fab-btn"
        data-tour="yt-ask-alwrity-fab"
        onClick={() => setOpen(true)}
        aria-label="Ask ALwrity Co-Pilot"
        title="Ask ALwrity Co-Pilot"
      >
        <span className="yt-copilot-fab-btn-photo" aria-hidden>
          <img src="/ask-alwrity-girl.png" alt="" />
        </span>
      </button>
      <span className="yt-copilot-fab-label">Ask ALwrity Co-Pilot</span>
      <YouTubeActionModal
        open={open}
        title="Ask ALwrity Co-Pilot"
        intro="Live Copilot chat ships next. Use Knowledge Centre → Ask ALwrity for curated Q&A today."
        onClose={() => setOpen(false)}
        maxWidth={420}
      >
        <p className="yt-modal-intro">
          Tip: Start with the Plan wedge, then Create with HITL review on titles and scenes before
          you render.
        </p>
      </YouTubeActionModal>
    </>
  );

  if (isFixed) {
    return <div className="yt-copilot-fab-fixed-inner">{inner}</div>;
  }

  return <div className="yt-copilot-fab-corner-inner">{inner}</div>;
};
