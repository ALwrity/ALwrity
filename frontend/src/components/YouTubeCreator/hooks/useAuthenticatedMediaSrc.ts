/**
 * Load media for native <video>/<audio>/<img> tags.
 *
 * Reuses the podcast SceneCard pattern:
 * 1) fetch an authenticated blob URL
 * 2) if that fails, fall back to the same path with ?token=
 *
 * Never return a raw unauthenticated API path when a token is available.
 */

import { useEffect, useState } from 'react';
import { appendAuthTokenToUrl, fetchMediaBlobUrl } from '../../../utils/fetchMediaBlobUrl';

interface UseAuthenticatedMediaSrcResult {
  src: string | null;
  loading: boolean;
  error: string | null;
}

function sanitizeMediaUrl(url: string): string {
  return url.split('?')[0];
}

export function useAuthenticatedMediaSrc(
  mediaUrl?: string | null,
  enabled: boolean = true,
): UseAuthenticatedMediaSrcResult {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadMedia(): Promise<void> {
      if (!mediaUrl || !enabled) {
        setBlobUrl(null);
        setAuthUrl(null);
        setError(null);
        setLoading(false);
        return;
      }

      const safeUrl = sanitizeMediaUrl(mediaUrl);
      setLoading(true);
      setError(null);
      console.info('[useAuthenticatedMediaSrc] Loading media preview', { url: safeUrl });

      try {
        const [blob, authenticated] = await Promise.all([
          fetchMediaBlobUrl(mediaUrl).catch((err) => {
            const status = (err as { response?: { status?: number } })?.response?.status;
            console.warn(
              '[useAuthenticatedMediaSrc] Blob load failed, using authenticated URL fallback',
              {
                url: safeUrl,
                status,
                fallback: 'token-url',
                error: err instanceof Error ? err.message : String(err),
              },
            );
            return null;
          }),
          appendAuthTokenToUrl(mediaUrl).catch((err) => {
            console.error(
              '[useAuthenticatedMediaSrc] Failed to append auth token',
              { url: safeUrl, error: err instanceof Error ? err.message : String(err) },
            );
            return null;
          }),
        ]);

        if (cancelled) {
          console.debug('[useAuthenticatedMediaSrc] Ignoring stale media load', { url: safeUrl });
          return;
        }

        setBlobUrl(blob);
        setAuthUrl(authenticated || null);
        if (blob) {
          console.info('[useAuthenticatedMediaSrc] Using blob preview', { url: safeUrl });
          setError(null);
        } else if (authenticated) {
          console.info('[useAuthenticatedMediaSrc] Using authenticated URL fallback', { url: safeUrl });
          setError('Preview stream is temporarily unavailable.');
        } else {
          console.error('[useAuthenticatedMediaSrc] No blob or authenticated URL available', { url: safeUrl });
          setError('Preview stream is temporarily unavailable.');
        }
      } catch (err) {
        console.error(
          '[useAuthenticatedMediaSrc] Failed to resolve media src',
          { url: safeUrl, error: err instanceof Error ? err.message : String(err) },
        );
        if (!cancelled) {
          setBlobUrl(null);
          setAuthUrl(null);
          setError('Unable to load secure preview.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadMedia().catch((err) => {
      console.error(
        '[useAuthenticatedMediaSrc] Unhandled media load error',
        { error: err instanceof Error ? err.message : String(err) },
      );
    });

    return () => {
      cancelled = true;
    };
  }, [mediaUrl, enabled]);

  return {
    src: blobUrl || authUrl,
    loading,
    error,
  };
}
