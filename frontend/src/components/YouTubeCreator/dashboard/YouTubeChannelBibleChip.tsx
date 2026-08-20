import React, { useEffect, useState } from "react";
import { YouTubeChannelBibleEditorModal } from "./YouTubeChannelBibleEditorModal";
import { YT_OPEN_CHANNEL_BIBLE_EVENT } from "./youtubeStudioEvents";
import type { YouTubeChannelBible } from "../../../services/youtubeApi";

interface YouTubeChannelBibleChipProps {
  niche?: string | null;
  planAvatarUrl?: string | null;
  onBibleSaved?: (bible: YouTubeChannelBible) => void;
}

/**
 * Studio Hub toolbar shortcut — opens Channel Bible editor in-place (not Video Creator).
 * Also listens for openYouTubeChannelBible() (Knowledge Centre).
 */
export const YouTubeChannelBibleChip: React.FC<YouTubeChannelBibleChipProps> = ({
  niche,
  planAvatarUrl = null,
  onBibleSaved,
}) => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onOpen = () => {
      console.info("[YouTubeChannelBibleChip] Open via event");
      setOpen(true);
    };
    window.addEventListener(YT_OPEN_CHANNEL_BIBLE_EVENT, onOpen);
    return () => window.removeEventListener(YT_OPEN_CHANNEL_BIBLE_EVENT, onOpen);
  }, []);

  return (
    <>
      <button
        type="button"
        className="yt-rail-btn"
        data-tour="yt-channel-bible"
        aria-label={
          niche ? `Channel Bible — niche ${niche}` : "Open Channel Bible"
        }
        onClick={() => {
          console.info("[YouTubeChannelBibleChip] Open editor", {
            hasNiche: Boolean(niche?.trim()),
          });
          setOpen(true);
        }}
      >
        Channel Bible
      </button>

      <YouTubeChannelBibleEditorModal
        open={open}
        onClose={() => setOpen(false)}
        planAvatarUrl={planAvatarUrl}
        onSaved={(bible) => {
          onBibleSaved?.(bible);
        }}
      />
    </>
  );
};
