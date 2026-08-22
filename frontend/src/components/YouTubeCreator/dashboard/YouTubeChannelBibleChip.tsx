import React, { useEffect, useState } from "react";
import { YouTubeChannelBibleEditorModal } from "./YouTubeChannelBibleEditorModal";
import { YouTubeStudioTabButton } from "../components/YouTubeStudioTabButton";
import { YT_OPEN_CHANNEL_BIBLE_EVENT } from "./youtubeStudioEvents";
import type { YouTubeChannelBible } from "../../../services/youtubeApi";

interface YouTubeChannelBibleChipProps {
  niche?: string | null;
  planAvatarUrl?: string | null;
  onBibleSaved?: (bible: YouTubeChannelBible) => void;
  layout?: "pill" | "tab";
}

/**
 * Studio Hub toolbar shortcut — opens Channel Bible editor in-place (not Video Creator).
 * Also listens for openYouTubeChannelBible() (Knowledge Centre).
 */
export const YouTubeChannelBibleChip: React.FC<YouTubeChannelBibleChipProps> = ({
  niche,
  planAvatarUrl = null,
  onBibleSaved,
  layout = "pill",
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
      {layout === "tab" ? (
        <YouTubeStudioTabButton
          label={niche ? `Channel Bible — niche ${niche}` : "Open Channel Bible"}
          stackedLabel={["Channel", "Bible"]}
          icon="📖"
          boxed
          open={open}
          onClick={() => {
            console.info("[YouTubeChannelBibleChip] Open editor", {
              hasNiche: Boolean(niche?.trim()),
            });
            setOpen(true);
          }}
          dataTour="yt-channel-bible"
        />
      ) : (
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
      )}

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
