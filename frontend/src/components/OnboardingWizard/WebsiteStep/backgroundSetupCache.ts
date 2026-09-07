import { ONBOARDING_STORAGE_KEYS } from '../common/onboardingStorageKeys';
import { isSameWebsiteSession } from '../common/onboardingSessionKey';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const LOG_PREFIX = '[onboarding:background-cache]';

export type BackgroundSetupCacheKind = 'contentAudit' | 'siteHealth' | 'seoPreview';

const STORAGE_BY_KIND: Record<BackgroundSetupCacheKind, string> = {
  contentAudit: ONBOARDING_STORAGE_KEYS.contentAuditResult,
  siteHealth: ONBOARDING_STORAGE_KEYS.siteHealthResult,
  seoPreview: ONBOARDING_STORAGE_KEYS.seoPreviewResult,
};

export interface BackgroundSetupCacheValidationInput {
  cachedSessionKey: string | null | undefined;
  currentSessionKey: string;
  cacheTimestamp: string | null | undefined;
}

export interface BackgroundSetupCachedPayload {
  website_session_key?: string;
  timestamp?: string;
  [key: string]: unknown;
}

export function isBackgroundSetupCacheValid(
  input: BackgroundSetupCacheValidationInput
): boolean {
  const { cachedSessionKey, currentSessionKey, cacheTimestamp } = input;

  if (!cacheTimestamp) {
    return false;
  }

  const parsedTime = Date.parse(cacheTimestamp);
  if (Number.isNaN(parsedTime) || Date.now() - parsedTime >= CACHE_TTL_MS) {
    return false;
  }

  return Boolean(
    cachedSessionKey && isSameWebsiteSession(cachedSessionKey, currentSessionKey)
  );
}

export function readBackgroundSetupCache<T extends BackgroundSetupCachedPayload>(
  kind: BackgroundSetupCacheKind,
  currentSessionKey: string
): T | null {
  try {
    const raw = localStorage.getItem(STORAGE_BY_KIND[kind]);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as T;
    if (
      !isBackgroundSetupCacheValid({
        cachedSessionKey: parsed.website_session_key,
        currentSessionKey,
        cacheTimestamp: parsed.timestamp,
      })
    ) {
      localStorage.removeItem(STORAGE_BY_KIND[kind]);
      console.debug(`${LOG_PREFIX} Invalid ${kind} cache for session`, { currentSessionKey });
      return null;
    }

    return parsed;
  } catch (err) {
    console.warn(`${LOG_PREFIX} Failed to read ${kind} cache:`, err);
    return null;
  }
}

export function writeBackgroundSetupCache<T extends Record<string, unknown>>(
  kind: BackgroundSetupCacheKind,
  currentSessionKey: string,
  data: T
): void {
  try {
    const payload: BackgroundSetupCachedPayload = {
      ...data,
      website_session_key: currentSessionKey,
      timestamp: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_BY_KIND[kind], JSON.stringify(payload));
  } catch (err) {
    console.warn(`${LOG_PREFIX} Failed to write ${kind} cache:`, err);
  }
}
