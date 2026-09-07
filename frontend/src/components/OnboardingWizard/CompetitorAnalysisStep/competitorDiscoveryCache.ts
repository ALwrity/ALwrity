import { ONBOARDING_STORAGE_KEYS } from '../common/onboardingStorageKeys';
import { isSameWebsiteSession, normalizeOnboardingUrl } from '../common/onboardingSessionKey';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const LOG_PREFIX = '[onboarding:competitor-cache]';

export interface CompetitorCacheValidationInput {
  cachedUrl: string;
  cachedSessionKey: string | null;
  currentSessionKey: string;
  userUrl: string;
  cacheTimestamp: string | null;
}

export function readCompetitorCacheSessionKey(): string | null {
  try {
    return localStorage.getItem(ONBOARDING_STORAGE_KEYS.competitorAnalysisSessionKey);
  } catch (err) {
    console.warn(`${LOG_PREFIX} Failed to read competitor session key:`, err);
    return null;
  }
}

export function writeCompetitorCacheSessionKey(sessionKey: string): void {
  try {
    localStorage.setItem(ONBOARDING_STORAGE_KEYS.competitorAnalysisSessionKey, sessionKey);
  } catch (err) {
    console.warn(`${LOG_PREFIX} Failed to write competitor session key:`, err);
  }
}

export function isCompetitorCacheValid(input: CompetitorCacheValidationInput): boolean {
  const {
    cachedUrl,
    cachedSessionKey,
    currentSessionKey,
    userUrl,
    cacheTimestamp,
  } = input;

  if (!cacheTimestamp) {
    console.debug(`${LOG_PREFIX} Rejecting cache: missing timestamp`);
    return false;
  }

  const parsedTimestamp = parseInt(cacheTimestamp, 10);
  if (Number.isNaN(parsedTimestamp)) {
    console.debug(`${LOG_PREFIX} Rejecting cache: invalid timestamp`);
    return false;
  }

  if (Date.now() - parsedTimestamp >= CACHE_TTL_MS) {
    console.debug(`${LOG_PREFIX} Rejecting cache: expired`);
    return false;
  }

  if (normalizeOnboardingUrl(cachedUrl) !== normalizeOnboardingUrl(userUrl)) {
    console.debug(`${LOG_PREFIX} Rejecting cache: URL mismatch`);
    return false;
  }

  if (!cachedSessionKey || !isSameWebsiteSession(cachedSessionKey, currentSessionKey)) {
    console.debug(`${LOG_PREFIX} Rejecting cache: session key mismatch`, {
      cachedSessionKey,
      currentSessionKey,
    });
    return false;
  }

  return true;
}
