/**
 * Studio Hub Channel Bible modal — reuses ChannelBiblePanel + useChannelBibleStore
 * (same GET/PUT as Video Creator Plan).
 */

import React, { useCallback } from "react";
import { YouTubeActionModal } from "./YouTubeActionModal";
import { ChannelBiblePanel } from "../components/ChannelBiblePanel";
import { useChannelBibleStore } from "../hooks/useChannelBibleStore";
import { notifyYouTubeChannelBibleUpdated } from "./youtubeStudioEvents";
import {
  youtubeWedgeShellProps,
  type YouTubeModalShellProps,
} from "./youtubeWedgeModalUi";
import type { YouTubeChannelBible } from "../../../services/youtubeApi";

export interface YouTubeChannelBibleEditorModalProps {
  open: boolean;
  onClose: () => void;
  planAvatarUrl?: string | null;
  showApplyToVideo?: boolean;
  onSaved?: (bible: YouTubeChannelBible) => void;
  onApplyToThisVideo?: (bible: YouTubeChannelBible) => string | void;
  /** Override Back / width (Plan drill-down). Defaults to Hub-sized shell. */
  shell?: YouTubeModalShellProps;
}

export const YouTubeChannelBibleEditorModal: React.FC<
  YouTubeChannelBibleEditorModalProps
> = ({
  open,
  onClose,
  planAvatarUrl = null,
  showApplyToVideo = false,
  onSaved,
  onApplyToThisVideo,
  shell,
}) => {
  const {
    channelBible,
    bibleLoading,
    bibleSaving,
    bibleError,
    setChannelBible,
    setBibleError,
    saveChannelBible,
  } = useChannelBibleStore({ enabled: open });

  const resolvedShell: YouTubeModalShellProps =
    shell ?? youtubeWedgeShellProps(onClose);

  const handleSave = useCallback(async () => {
    try {
      const saved = await saveChannelBible();
      notifyYouTubeChannelBibleUpdated(saved);
      onSaved?.(saved);
      console.info("[YouTubeChannelBibleEditorModal] Saved from Studio Hub");
    } catch (err) {
      console.error("[YouTubeChannelBibleEditorModal] Save failed", err);
    }
  }, [onSaved, saveChannelBible]);

  const handleChange = useCallback(
    (bible: YouTubeChannelBible) => {
      setChannelBible(bible);
    },
    [setChannelBible],
  );

  const handleApply = useCallback(() => {
    if (!channelBible) {
      const message = "Channel bible is not loaded yet.";
      console.error("[YouTubeChannelBibleEditorModal] Apply skipped", message);
      setBibleError(message);
      return;
    }
    if (!onApplyToThisVideo) {
      console.warn("[YouTubeChannelBibleEditorModal] Apply requested without handler");
      return;
    }
    try {
      const error = onApplyToThisVideo(channelBible);
      if (error) {
        setBibleError(error);
        return;
      }
      setBibleError(null);
      console.info("[YouTubeChannelBibleEditorModal] Applied bible to this video", {
        hasNiche: Boolean(channelBible.niche?.trim()),
      });
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Could not apply channel defaults to this video.";
      console.error("[YouTubeChannelBibleEditorModal] Apply failed", err);
      setBibleError(message);
    }
  }, [channelBible, onApplyToThisVideo, setBibleError]);

  return (
    <YouTubeActionModal
      open={open}
      title="Channel Bible"
      intro={
        showApplyToVideo
          ? "Set niche, audience, CTA, and tone — Save for all videos, or Apply to fill Plan fields for the video you are creating now."
          : "Set niche, audience, CTA, and tone once — every video plan and brainstorm can reuse these defaults."
      }
      onClose={onClose}
      maxWidth={resolvedShell.maxWidth}
      onBack={resolvedShell.onBack}
      backLabel={resolvedShell.backLabel}
      titleSize={resolvedShell.titleSize}
      headerLayout={resolvedShell.headerLayout}
    >
      <ChannelBiblePanel
        bible={channelBible}
        loading={bibleLoading}
        saving={bibleSaving}
        error={bibleError}
        planAvatarUrl={planAvatarUrl}
        variant="standalone"
        showApplyToVideo={showApplyToVideo}
        onChange={handleChange}
        onSave={() => void handleSave()}
        onApplyToThisVideo={showApplyToVideo ? handleApply : undefined}
      />
    </YouTubeActionModal>
  );
};

export default YouTubeChannelBibleEditorModal;
