import { aiApiClient } from "../api/client";

// Optional token getter - will be set by the app
let authTokenGetter: (() => Promise<string | null>) | null = null;

// Simple cache to prevent repeated requests
const blobUrlCache = new Map<string, string | null>();
const pendingRequests = new Map<string, Promise<string | null>>();

export const setMediaAuthTokenGetter = (getter: (() => Promise<string | null>) | null) => {
  authTokenGetter = getter;
};

// Clear cache for specific URL or all URLs
/**
 * Appends the current auth token as a ?token= query parameter.
 * Use this for <img> / <video> / <audio> src attributes on internal API endpoints
 * that support get_current_user_with_query_token (can't send Authorization headers).
 * Falls back to the original URL if no token is available.
 */
export async function appendAuthTokenToUrl(pathOrUrl: string): Promise<string> {
  const isAbsolute = /^https?:\/\//i.test(pathOrUrl);
  const url = isAbsolute ? pathOrUrl : pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;

  if (!authTokenGetter) return url;

  try {
    const token = await authTokenGetter();
    if (token) {
      const separator = url.includes('?') ? '&' : '?';
      return `${url}${separator}token=${encodeURIComponent(token)}`;
    }
  } catch (err) {
    console.warn('[appendAuthTokenToUrl] Failed to get auth token:', err);
  }
  return url;
}

export const clearMediaCache = (url?: string) => {
  if (url) {
    blobUrlCache.delete(url);
    pendingRequests.delete(url);
  } else {
    blobUrlCache.clear();
    pendingRequests.clear();
  }
};

function sanitizeMediaUrl(url: string): string {
  return url.split('?')[0];
}

export async function downloadMediaBlob(mediaUrl: string, filename?: string): Promise<void> {
  const safeUrl = sanitizeMediaUrl(mediaUrl);
  const downloadName = filename || `media-${Date.now()}.mp4`;

  console.info('[downloadMediaBlob] Starting download', {
    url: safeUrl,
    filename: downloadName,
  });

  const cachedBlobUrl = await fetchMediaBlobUrl(mediaUrl);
  if (!cachedBlobUrl) {
    console.warn('[downloadMediaBlob] No blob URL available for download', {
      url: safeUrl,
    });
    return;
  }

  // Clone the blob into a separate object URL so preview cache stays valid.
  try {
    const response = await fetch(cachedBlobUrl);
    if (!response.ok) {
      console.error('[downloadMediaBlob] Failed to read cached blob for download', {
        url: safeUrl,
        status: response.status,
      });
      throw new Error(`Failed to read cached blob for download (${response.status})`);
    }

    const blob = await response.blob();
    if (!blob.size) {
      console.error('[downloadMediaBlob] Cached blob is empty', { url: safeUrl });
      throw new Error('Cached media blob is empty');
    }

    const downloadUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = downloadUrl;
    anchor.download = downloadName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    setTimeout(() => {
      URL.revokeObjectURL(downloadUrl);
      console.debug('[downloadMediaBlob] Revoked download clone URL', { url: safeUrl });
    }, 1000);

    console.info('[downloadMediaBlob] Download triggered', {
      url: safeUrl,
      filename: downloadName,
      bytes: blob.size,
    });
  } catch (err) {
    console.error('[downloadMediaBlob] Failed to create download from cached blob', {
      url: safeUrl,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

export async function fetchMediaBlobUrl(pathOrUrl: string): Promise<string | null> {
  try {
    // Check cache first
    if (blobUrlCache.has(pathOrUrl)) {
      return blobUrlCache.get(pathOrUrl) || null;
    }

    // Check if there's already a pending request for this URL
    if (pendingRequests.has(pathOrUrl)) {
      return pendingRequests.get(pathOrUrl) || null;
    }

    // Create new request
    const requestPromise = (async () => {
      // If full URL (http/https), use as-is; otherwise ensure leading slash
      const isAbsolute = /^https?:\/\//i.test(pathOrUrl);
      const rel = isAbsolute ? pathOrUrl : pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
      
      // Try to get token and add as query parameter as fallback for endpoints that support it
      // This helps with endpoints that use get_current_user_with_query_token
      let url = rel;
      if (authTokenGetter) {
        try {
          const token = await authTokenGetter();
          if (token) {
            // Add token as query parameter for endpoints that support it
            const separator = url.includes('?') ? '&' : '?';
            url = `${url}${separator}token=${encodeURIComponent(token)}`;
          }
        } catch (tokenError) {
          console.warn(`[fetchMediaBlobUrl] Failed to get token for query param:`, tokenError);
        }
      }
      
      const res = await aiApiClient.get(url, { responseType: "blob" });
      const blobUrl = URL.createObjectURL(res.data);
      
      // Cache the result
      blobUrlCache.set(pathOrUrl, blobUrl);
      pendingRequests.delete(pathOrUrl);
      
      return blobUrl;
    })();

    // Store pending request
    pendingRequests.set(pathOrUrl, requestPromise);
    
    return await requestPromise;
  } catch (err: any) {
    // Cache the failure to prevent repeated requests
    blobUrlCache.set(pathOrUrl, null);
    pendingRequests.delete(pathOrUrl);
    
    // Gracefully handle 404s and other errors - file might not exist or was regenerated
    if (err?.response?.status === 404) {
      console.warn(`[fetchMediaBlobUrl] Media file not found (404): ${sanitizeMediaUrl(pathOrUrl)}`);
      return null;
    }
    if (err?.response?.status === 401) {
      console.warn('[fetchMediaBlobUrl] Media request unauthorized (401), caller may use token fallback', {
        url: sanitizeMediaUrl(pathOrUrl),
      });
    }
    console.warn('[fetchMediaBlobUrl] Blob load failed', {
      url: sanitizeMediaUrl(pathOrUrl),
      status: err?.response?.status,
    });
    throw err;
  }
}


