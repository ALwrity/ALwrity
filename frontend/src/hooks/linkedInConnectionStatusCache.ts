/**
 * Module-level shared LinkedIn connection status cache.
 * Prevents multiple useLinkedInSocialConnection mounts from each
 * firing a separate GET /connection/status request.
 *
 * Logic moved from useLinkedInSocialConnection.ts (connection resilience).
 */

import {
  invalidateLinkedInConnectionStatusCache,
  type LinkedInConnectionStatus,
} from '../api/linkedinSocial';

const SHARED_CACHE_TTL_MS = 30_000;

let sharedStatusCache: LinkedInConnectionStatus | null = null;
let sharedStatusTimestamp = 0;
let sharedStatusPromise: Promise<LinkedInConnectionStatus> | null = null;

export function cacheSharedConnectionStatus(status: LinkedInConnectionStatus): void {
  sharedStatusCache = status;
  sharedStatusTimestamp = Date.now();
}

export function invalidateSharedConnectionStatus(): void {
  sharedStatusCache = null;
  sharedStatusTimestamp = 0;
  sharedStatusPromise = null;
  invalidateLinkedInConnectionStatusCache();
}

export function getCachedConnectionStatus(): LinkedInConnectionStatus | null {
  if (
    sharedStatusCache &&
    Date.now() - sharedStatusTimestamp < SHARED_CACHE_TTL_MS
  ) {
    return sharedStatusCache;
  }
  invalidateSharedConnectionStatus();
  return null;
}

/**
 * Deduplicate concurrent status fetches: reuse an in-flight promise when present.
 */
export function getOrCreateSharedStatusPromise(
  fetcher: () => Promise<LinkedInConnectionStatus>
): Promise<LinkedInConnectionStatus> {
  if (!sharedStatusPromise) {
    sharedStatusPromise = fetcher().finally(() => {
      sharedStatusPromise = null;
    });
  }
  return sharedStatusPromise;
}
