import React, { useState } from "react";
import { YouTubeActionModal } from "./YouTubeActionModal";
import { openYouTubeCreator } from "./youtubeStudioEvents";

interface YouTubeChannelBibleChipProps {
  niche?: string | null;
}

/**
 * Dashboard shortcut for Channel Bible — sits under Today's Growth, not in Plan wedge.
 */
export const YouTubeChannelBibleChip: React.FC<YouTubeChannelBibleChipProps> = ({
  niche,
}) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="yt-rail-btn"
        data-tour="yt-channel-bible"
        onClick={() => setOpen(true)}
      >
        Channel Bible
      </button>

      <YouTubeActionModal
        open={open}
        title="Channel Bible"
        intro={
          niche
            ? `Niche: ${niche} — keep voice and CTA consistent across videos.`
            : "Set niche, audience, CTA, and tone once — apply to every video."
        }
        onClose={() => setOpen(false)}
        maxWidth={480}
      >
        <button
          type="button"
          className="yt-rail-btn yt-rail-btn--primary"
          onClick={() => {
            setOpen(false);
            openYouTubeCreator({ step: 0 });
          }}
        >
          Open Channel Bible in Plan
        </button>
      </YouTubeActionModal>
    </>
  );
};
