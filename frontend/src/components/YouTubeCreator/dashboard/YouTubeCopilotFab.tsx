import React, { useState } from "react";
import { YouTubeActionModal } from "./YouTubeActionModal";

export const YouTubeCopilotFab: React.FC = () => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="yt-copilot-fab"
        data-tour="yt-ask-alwrity-fab"
        onClick={() => setOpen(true)}
      >
        Ask ALwrity Co-Pilot
      </button>
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
};
