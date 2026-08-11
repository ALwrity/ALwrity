import { useState, useEffect } from 'react';
import { appendAuthTokenToUrl } from '../utils/fetchMediaBlobUrl';
import { ContentAsset } from './useContentAssets';

interface UseAssetAuthUrlsResult {
  /** Map of asset ID to its authenticated URL (with ?token= query parameter) */
  imageAuthUrls: Map<number, string>;
  /** Set of asset IDs currently loading their authenticated URLs */
  loadingImages: Set<number>;
  /** Authenticated URL for the onboarding brand avatar */
  brandAvatarAuthUrl: string | null;
}

// Check if a URL requires authentication (internal API endpoints)
export const isAuthenticatedAssetUrl = (url: string): boolean => {
  if (!url) return false;
  return url.includes('/api/podcast/') || 
         url.includes('/api/youtube/') || 
         url.includes('/api/story/') ||
         (url.startsWith('/') && !url.startsWith('//'));
};

/**
 * Custom hook to securely and efficiently append authentication tokens to asset URLs
 * for use in <img> tags, avoiding heavy and leak-prone blob URL lifecycles.
 */
export const useAssetAuthUrls = (
  open: boolean,
  assets: ContentAsset[],
  brandAvatarUrl: string | null | undefined
): UseAssetAuthUrlsResult => {
  const [imageAuthUrls, setImageAuthUrls] = useState<Map<number, string>>(new Map());
  const [loadingImages, setLoadingImages] = useState<Set<number>>(new Set());
  const [brandAvatarAuthUrl, setBrandAvatarAuthUrl] = useState<string | null>(null);

  // Generate a stable key from assets to prevent infinite re-render loops
  // when the parent component passes a new array reference on every render.
  const assetsKey = assets.map((a) => `${a.id}-${a.file_url}`).join(',');

  // 1. Process asset list URLs
  useEffect(() => {
    if (!open || assets.length === 0) {
      setImageAuthUrls(new Map());
      setLoadingImages(new Set());
      return;
    }

    let isMounted = true;

    // Set initial loading state for all authenticated URLs
    const initialLoading = new Set<number>();
    assets.forEach((asset) => {
      if (asset.file_url && isAuthenticatedAssetUrl(asset.file_url)) {
        initialLoading.add(asset.id);
      }
    });
    setLoadingImages(initialLoading);

    const loadAuthUrls = async () => {
      const newUrls = new Map<number, string>();

      // Process all URLs in parallel for maximum performance
      await Promise.all(
        assets.map(async (asset) => {
          if (!asset.file_url) return;

          if (isAuthenticatedAssetUrl(asset.file_url)) {
            try {
              const cleanPath = asset.file_url.split('?')[0];
              const authUrl = await appendAuthTokenToUrl(cleanPath);
              newUrls.set(asset.id, authUrl);
            } catch (err) {
              console.error(`[useAssetAuthUrls] Failed to build auth URL for asset ${asset.id}:`, err);
              newUrls.set(asset.id, asset.file_url); // fallback
            }
          } else {
            // External URL, use directly
            newUrls.set(asset.id, asset.file_url);
          }
        })
      );

      if (isMounted) {
        setImageAuthUrls(newUrls);
        setLoadingImages(new Set()); // Clear loading state once all are resolved
      }
    };

    loadAuthUrls();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, assetsKey]);

  // 2. Process onboarding brand avatar URL
  useEffect(() => {
    if (!open || !brandAvatarUrl) {
      setBrandAvatarAuthUrl(null);
      return;
    }

    let isMounted = true;

    const loadBrandAvatarUrl = async () => {
      if (isAuthenticatedAssetUrl(brandAvatarUrl)) {
        try {
          const cleanPath = brandAvatarUrl.split('?')[0];
          const authUrl = await appendAuthTokenToUrl(cleanPath);
          if (isMounted) {
            setBrandAvatarAuthUrl(authUrl);
          }
        } catch (err) {
          console.error('[useAssetAuthUrls] Failed to build auth URL for brand avatar:', err);
          if (isMounted) {
            setBrandAvatarAuthUrl(brandAvatarUrl);
          }
        }
      } else {
        if (isMounted) {
          setBrandAvatarAuthUrl(brandAvatarUrl);
        }
      }
    };

    loadBrandAvatarUrl();

    return () => {
      isMounted = false;
    };
  }, [open, brandAvatarUrl]);

  return {
    imageAuthUrls,
    loadingImages,
    brandAvatarAuthUrl,
  };
};
