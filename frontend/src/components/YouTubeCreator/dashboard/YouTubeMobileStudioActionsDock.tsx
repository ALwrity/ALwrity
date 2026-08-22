import React from "react";
import { YouTubeChannelBibleChip } from "./YouTubeChannelBibleChip";
import { YouTubeTodayGrowth } from "./YouTubeTodayGrowth";
import { YouTubeResumeDraftChip } from "./YouTubeResumeDraftChip";
import { StartNewVideoButton } from "../components/StartNewVideoButton";
import type { YouTubeChannelBible } from "../../../services/youtubeApi";

interface YouTubeMobileStudioActionsDockProps {
  hasDraft: boolean;
  draftPreview: string;
  niche?: string | null;
  planAvatarUrl?: string | null;
  onBibleSaved?: (bible: YouTubeChannelBible) => void;
  onClearDraft: () => void;
  onStartNewVideo: () => void;
}

/** Four LinkedIn-style tabs: label above icon, Channel Bible boxed. */
export const YouTubeMobileStudioActionsDock: React.FC<
  YouTubeMobileStudioActionsDockProps
> = ({
  hasDraft,
  draftPreview,
  niche,
  planAvatarUrl,
  onBibleSaved,
  onClearDraft,
  onStartNewVideo,
}) => (
  <div
    className="yt-studio-mobile-dock"
    role="tablist"
    aria-label="Studio quick actions"
    data-tour="yt-mobile-studio-actions"
  >
    <YouTubeTodayGrowth layout="tab" />
    <YouTubeResumeDraftChip
      layout="tab"
      hasDraft={hasDraft}
      preview={draftPreview}
      onDiscard={onClearDraft}
    />
    <YouTubeChannelBibleChip
      layout="tab"
      niche={niche}
      planAvatarUrl={planAvatarUrl}
      onBibleSaved={onBibleSaved}
    />
    <StartNewVideoButton variant="hubTab" onConfirm={onStartNewVideo} />
  </div>
);
