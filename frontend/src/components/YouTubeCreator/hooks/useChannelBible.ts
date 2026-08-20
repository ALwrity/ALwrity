/**
 * Load, prefill, save, and apply the YouTube Channel Bible for Video Creator.
 * Persistence is shared via useChannelBibleStore (same GET/PUT as Studio Hub).
 */

import { useCallback, useEffect, useRef } from "react";
import { getLatestBrandAvatar } from "../../../api/brandAssets";
import type { YouTubeChannelBible } from "../../../services/youtubeApi";
import type { YouTubeContentLanguage } from "../constants";
import type { YouTubeCreatorState } from "../../../hooks/useYouTubeCreatorState";
import { buildPlanFieldUpdatesFromChannelBible } from "../utils/channelBibleContext";
import {
  EMPTY_CHANNEL_BIBLE,
  useChannelBibleStore,
} from "./useChannelBibleStore";

export { EMPTY_CHANNEL_BIBLE };

interface UseChannelBibleArgs {
  targetAudience: string;
  videoGoal: string;
  brandStyle: string;
  referenceImage: string;
  avatarUrl: string | null;
  language: YouTubeContentLanguage;
  updateState: (updates: Partial<YouTubeCreatorState>) => void;
}

function applyBibleToEmptyFields(
  bible: YouTubeChannelBible,
  current: Pick<
    UseChannelBibleArgs,
    "targetAudience" | "videoGoal" | "brandStyle" | "referenceImage" | "avatarUrl" | "language"
  >,
): Partial<YouTubeCreatorState> {
  const updates: Partial<YouTubeCreatorState> = {};
  if (!current.targetAudience.trim() && bible.target_audience?.trim()) {
    updates.targetAudience = bible.target_audience;
  }
  if (!current.videoGoal.trim() && bible.default_video_goal?.trim()) {
    updates.videoGoal = bible.default_video_goal;
  }
  if (!current.brandStyle.trim() && bible.brand_style?.trim()) {
    updates.brandStyle = bible.brand_style;
  }
  if (!current.referenceImage.trim() && bible.visual_style_guide?.trim()) {
    updates.referenceImage = bible.visual_style_guide;
  }
  if (!current.language.trim() && bible.default_language?.trim()) {
    updates.language = bible.default_language as YouTubeContentLanguage;
  }
  if (!current.avatarUrl && bible.default_avatar_url?.trim()) {
    updates.avatarUrl = bible.default_avatar_url;
  }
  return updates;
}

export function useChannelBible({
  targetAudience,
  videoGoal,
  brandStyle,
  referenceImage,
  avatarUrl,
  language,
  updateState,
}: UseChannelBibleArgs) {
  const {
    channelBible,
    bibleLoading,
    bibleSaving,
    bibleError,
    setChannelBible,
    setBibleError,
    saveChannelBible: persistBible,
  } = useChannelBibleStore();

  const fieldsRef = useRef({
    targetAudience,
    videoGoal,
    brandStyle,
    referenceImage,
    avatarUrl,
    language,
  });
  fieldsRef.current = {
    targetAudience,
    videoGoal,
    brandStyle,
    referenceImage,
    avatarUrl,
    language,
  };
  const updateStateRef = useRef(updateState);
  updateStateRef.current = updateState;
  const prefilledRef = useRef(false);

  useEffect(() => {
    if (bibleLoading || !channelBible || prefilledRef.current) return;
    prefilledRef.current = true;
    const emptyUpdates = applyBibleToEmptyFields(channelBible, fieldsRef.current);
    if (Object.keys(emptyUpdates).length > 0) {
      updateStateRef.current(emptyUpdates);
    }

    const currentAvatar = emptyUpdates.avatarUrl || fieldsRef.current.avatarUrl;
    if (!channelBible.default_avatar_url?.trim() && !currentAvatar) {
      void (async () => {
        try {
          const avatarResp = await getLatestBrandAvatar();
          if (avatarResp.success && avatarResp.image_url) {
            updateStateRef.current({ avatarUrl: avatarResp.image_url });
          }
        } catch (avatarErr) {
          console.warn("[useChannelBible] Latest brand avatar unavailable", avatarErr);
        }
      })();
    }
  }, [bibleLoading, channelBible]);

  const saveChannelBible = useCallback(async () => {
    try {
      await persistBible();
    } catch {
      /* bibleError already set on store */
    }
  }, [persistBible]);

  const applyBibleToThisVideo = useCallback(() => {
    if (!channelBible) return;
    try {
      const updates = buildPlanFieldUpdatesFromChannelBible(channelBible);
      updateState(updates);
      console.info("[useChannelBible] Applied bible to this video", {
        fields: Object.keys(updates),
      });
    } catch (err) {
      console.error("[useChannelBible] Apply failed", err);
      setBibleError("Could not apply channel defaults to this video.");
    }
  }, [channelBible, setBibleError, updateState]);

  return {
    channelBible,
    bibleLoading,
    bibleSaving,
    bibleError,
    setChannelBible,
    saveChannelBible,
    applyBibleToThisVideo,
  };
}

export default useChannelBible;
