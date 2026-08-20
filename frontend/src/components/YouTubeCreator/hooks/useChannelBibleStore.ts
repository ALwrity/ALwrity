/**
 * Shared Channel Bible load/save against GET/PUT /api/youtube/channel-bible.
 * Used by Video Creator (via useChannelBible) and Studio Hub modal.
 */

import { useCallback, useEffect, useState } from "react";
import { youtubeApi, type YouTubeChannelBible } from "../../../services/youtubeApi";

export const EMPTY_CHANNEL_BIBLE: YouTubeChannelBible = {
  channel_name: "",
  niche: "",
  target_audience: "",
  default_video_goal: "",
  default_cta: "",
  brand_style: "",
  visual_style_guide: "",
  tone: "",
  default_avatar_url: null,
  default_language: "",
};

export interface UseChannelBibleStoreOptions {
  /** When false, skip the initial GET (e.g. modal closed). Default true. */
  enabled?: boolean;
}

export function useChannelBibleStore(options: UseChannelBibleStoreOptions = {}) {
  const enabled = options.enabled !== false;
  const [channelBible, setChannelBible] = useState<YouTubeChannelBible | null>(null);
  const [bibleLoading, setBibleLoading] = useState(enabled);
  const [bibleSaving, setBibleSaving] = useState(false);
  const [bibleError, setBibleError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setBibleLoading(true);
    setBibleError(null);
    try {
      const response = await youtubeApi.getChannelBible();
      if (response && response.success === false) {
        throw new Error("Failed to load channel bible.");
      }
      const bible = response?.bible ? { ...response.bible } : { ...EMPTY_CHANNEL_BIBLE };
      setChannelBible(bible);
      console.info("[useChannelBibleStore] Loaded", {
        source: response.source,
        hasNiche: Boolean(bible.niche?.trim()),
      });
      return bible;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to load channel bible";
      console.error("[useChannelBibleStore] GET failed", message);
      setBibleError(message);
      setChannelBible(null);
      throw err instanceof Error ? err : new Error(message);
    } finally {
      setBibleLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setBibleLoading(false);
      return undefined;
    }
    let cancelled = false;
    void (async () => {
      try {
        await reload();
      } catch {
        /* error already stored */
      }
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, reload]);

  const saveChannelBible = useCallback(async () => {
    if (!channelBible) {
      const message = "Nothing to save — channel bible failed to load.";
      console.error("[useChannelBibleStore] PUT skipped", message);
      setBibleError(message);
      throw new Error(message);
    }
    setBibleSaving(true);
    setBibleError(null);
    try {
      const response = await youtubeApi.saveChannelBible(channelBible);
      if (response && response.success === false) {
        throw new Error("Failed to save channel bible.");
      }
      const saved = response?.bible ? { ...response.bible } : { ...channelBible };
      setChannelBible(saved);
      console.info("[useChannelBibleStore] Saved channel defaults", {
        hasNiche: Boolean(saved.niche?.trim()),
      });
      return saved;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to save channel bible";
      console.error("[useChannelBibleStore] PUT failed", message);
      setBibleError(message);
      throw err instanceof Error ? err : new Error(message);
    } finally {
      setBibleSaving(false);
    }
  }, [channelBible]);

  return {
    channelBible,
    bibleLoading,
    bibleSaving,
    bibleError,
    setChannelBible,
    setBibleError,
    saveChannelBible,
    reload,
  };
}

export default useChannelBibleStore;
