/**
 * Load, prefill, save, and apply the YouTube Channel Bible.
 * Database is the source of truth; localStorage session fields are not overwritten when nonempty.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { getLatestBrandAvatar } from '../../../api/brandAssets';
import { youtubeApi, type YouTubeChannelBible } from '../../../services/youtubeApi';
import type { YouTubeContentLanguage } from '../constants';
import type { YouTubeCreatorState } from '../../../hooks/useYouTubeCreatorState';

export const EMPTY_CHANNEL_BIBLE: YouTubeChannelBible = {
  channel_name: '',
  niche: '',
  target_audience: '',
  default_video_goal: '',
  default_cta: '',
  brand_style: '',
  visual_style_guide: '',
  tone: '',
  default_avatar_url: null,
  default_language: '',
};

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
    'targetAudience' | 'videoGoal' | 'brandStyle' | 'referenceImage' | 'avatarUrl' | 'language'
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
  const [channelBible, setChannelBible] = useState<YouTubeChannelBible | null>(null);
  const [bibleLoading, setBibleLoading] = useState(true);
  const [bibleSaving, setBibleSaving] = useState(false);
  const [bibleError, setBibleError] = useState<string | null>(null);
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

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setBibleLoading(true);
      setBibleError(null);
      try {
        const response = await youtubeApi.getChannelBible();
        if (cancelled) return;
        const bible = response.bible || { ...EMPTY_CHANNEL_BIBLE };
        setChannelBible(bible);
        const emptyUpdates = applyBibleToEmptyFields(bible, fieldsRef.current);
        if (Object.keys(emptyUpdates).length > 0) {
          updateStateRef.current(emptyUpdates);
        }

        const currentAvatar = emptyUpdates.avatarUrl || fieldsRef.current.avatarUrl;
        if (!bible.default_avatar_url?.trim() && !currentAvatar) {
          try {
            const avatarResp = await getLatestBrandAvatar();
            if (!cancelled && avatarResp.success && avatarResp.image_url) {
              updateStateRef.current({ avatarUrl: avatarResp.image_url });
            }
          } catch (avatarErr) {
            console.warn('[useChannelBible] Latest brand avatar unavailable', avatarErr);
          }
        }
        console.info('[useChannelBible] Loaded', {
          source: response.source,
          hasNiche: Boolean(bible.niche?.trim()),
        });
      } catch (err: any) {
        if (cancelled) return;
        const message = err?.message || 'Failed to load channel bible';
        console.error('[useChannelBible] GET failed', message);
        setBibleError(message);
        setChannelBible(null);
      } finally {
        if (!cancelled) setBibleLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const saveChannelBible = useCallback(async () => {
    if (!channelBible) return;
    setBibleSaving(true);
    setBibleError(null);
    try {
      const response = await youtubeApi.saveChannelBible(channelBible);
      setChannelBible(response.bible);
      console.info('[useChannelBible] Saved channel defaults');
    } catch (err: any) {
      const message = err?.message || 'Failed to save channel bible';
      console.error('[useChannelBible] PUT failed', message);
      setBibleError(message);
    } finally {
      setBibleSaving(false);
    }
  }, [channelBible]);

  const applyBibleToThisVideo = useCallback(() => {
    if (!channelBible) return;
    try {
      const updates: Partial<YouTubeCreatorState> = {
        targetAudience: channelBible.target_audience || '',
        videoGoal: channelBible.default_video_goal || '',
        brandStyle: channelBible.brand_style || '',
        referenceImage: channelBible.visual_style_guide || '',
      };
      if (channelBible.default_language) {
        updates.language = channelBible.default_language as YouTubeContentLanguage;
      }
      if (channelBible.default_avatar_url) {
        updates.avatarUrl = channelBible.default_avatar_url;
      }
      updateState(updates);
      console.info('[useChannelBible] Applied bible to this video', {
        fields: Object.keys(updates),
      });
    } catch (err) {
      console.error('[useChannelBible] Apply failed', err);
      setBibleError('Could not apply channel defaults to this video.');
    }
  }, [channelBible, updateState]);

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
