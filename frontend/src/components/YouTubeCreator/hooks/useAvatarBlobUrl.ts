/**
 * Hook for loading YouTube avatar images from authenticated endpoints.
 * Uses query-token authentication (?token=) so <img> tags can load images
 * directly without needing blob URL lifecycle management.
 */

import { useState, useEffect } from 'react';
import { appendAuthTokenToUrl } from '../../../utils/fetchMediaBlobUrl';

interface UseAvatarBlobUrlResult {
  /** Authenticated URL ready to use as <img src>. null while loading or on error. */
  avatarBlobUrl: string | null;
  avatarLoading: boolean;
}

export const useAvatarBlobUrl = (avatarUrl: string | null | undefined): UseAvatarBlobUrlResult => {
  const [avatarBlobUrl, setAvatarBlobUrl] = useState<string | null>(null);
  const [avatarLoading, setAvatarLoading] = useState(false);

  useEffect(() => {
    if (!avatarUrl) {
      setAvatarBlobUrl(null);
      setAvatarLoading(false);
      return;
    }

    // data URLs (FileReader output) are used directly — no auth token needed
    if (avatarUrl.startsWith('data:')) {
      setAvatarBlobUrl(avatarUrl);
      setAvatarLoading(false);
      return;
    }

    // External URLs (http/https) are used as-is
    if (/^https?:\/\//i.test(avatarUrl)) {
      setAvatarBlobUrl(avatarUrl);
      setAvatarLoading(false);
      return;
    }

    // Internal YouTube API paths — append auth token so <img> can load them
    const isYouTubeMedia = avatarUrl.includes('/api/youtube/');
    if (!isYouTubeMedia) {
      setAvatarBlobUrl(avatarUrl);
      setAvatarLoading(false);
      return;
    }

    let isMounted = true;
    setAvatarLoading(true);

    const cleanPath = avatarUrl.split('?')[0];

    appendAuthTokenToUrl(cleanPath)
      .then((authenticatedUrl) => {
        if (isMounted) {
          setAvatarBlobUrl(authenticatedUrl);
          setAvatarLoading(false);
        }
      })
      .catch((err) => {
        console.error('[useAvatarBlobUrl] Failed to build authenticated URL:', err);
        if (isMounted) {
          // Fallback: use original path — browser will show broken image, not crash
          setAvatarBlobUrl(cleanPath);
          setAvatarLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [avatarUrl]);

  return { avatarBlobUrl, avatarLoading };
};
