import { useState, useEffect, useRef } from 'react';
import { aiApiClient } from '../api/client';

/**
 * Fetches a media file (image, audio, video) via authenticated API and returns a blob URL.
 * Handles cleanup (revoking old blob URLs) automatically on URL change and unmount.
 *
 * Usage:
 *   const { blobUrl, isLoading } = useMediaBlobLoader(sceneImageUrl);
 *   // Use blobUrl as <img src={blobUrl} />, check isLoading for loading spinner
 */
export function useMediaBlobLoader(mediaUrl: string | null | undefined): {
  blobUrl: string | null;
  isLoading: boolean;
} {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const blobRef = useRef<string | null>(null);

  useEffect(() => {
    if (!mediaUrl) {
      setBlobUrl(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    const load = async () => {
      try {
        const cleanUrl = mediaUrl.split('?')[0];
        const url = cleanUrl.startsWith('/') ? cleanUrl : `/${cleanUrl}`;
        const response = await aiApiClient.get(url, { responseType: 'blob' });
        if (cancelled) return;

        const newBlobUrl = URL.createObjectURL(response.data);

        // Revoke old blob to prevent memory leaks
        if (blobRef.current) {
          URL.revokeObjectURL(blobRef.current);
        }
        blobRef.current = newBlobUrl;
        setBlobUrl(newBlobUrl);
      } catch (err) {
        if (!cancelled) {
          console.error('[useMediaBlobLoader] Failed to load media:', err);
          setBlobUrl(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
      if (blobRef.current) {
        URL.revokeObjectURL(blobRef.current);
        blobRef.current = null;
      }
    };
  }, [mediaUrl]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (blobRef.current) {
        URL.revokeObjectURL(blobRef.current);
        blobRef.current = null;
      }
    };
  }, []);

  return { blobUrl, isLoading };
}

/**
 * Directly fetches a media URL and returns a blob URL.
 * For use in async handlers (not components).
 */
export async function fetchMediaAsBlob(mediaUrl: string): Promise<string> {
  const cleanUrl = mediaUrl.split('?')[0];
  const url = cleanUrl.startsWith('/') ? cleanUrl : `/${cleanUrl}`;
  const response = await aiApiClient.get(url, { responseType: 'blob' });
  return URL.createObjectURL(response.data);
}
