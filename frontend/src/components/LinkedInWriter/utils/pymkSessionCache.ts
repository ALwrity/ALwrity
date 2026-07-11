import type {
  PymkCohort,
  PymkCohortDefaults,
  PymkListResponse,
} from '../../../services/linkedInPymkApi';

/** Mirrors post analytics session cache TTL (usePostAnalytics). */
export const PYMK_SESSION_CACHE_TTL_MS = 30 * 60 * 1000;

const SUGGESTIONS_KEY = 'alwrity_pymk_suggestions';
const DEFAULTS_KEY = 'alwrity_pymk_cohort_defaults';

export interface PymkCacheKey {
  cohort: PymkCohort;
  cohortId: string;
}

interface PymkCacheEntry {
  key: PymkCacheKey;
  data: PymkListResponse;
  fetchedAt: number;
}

interface PymkCacheStore {
  entries: Record<string, PymkCacheEntry>;
}

interface PymkDefaultsCacheEntry {
  data: PymkCohortDefaults;
  fetchedAt: number;
}

export function pymkCacheKeyString(key: PymkCacheKey): string {
  return `${key.cohort}::${key.cohortId.trim()}`;
}

function readStore(): PymkCacheStore {
  try {
    const raw = sessionStorage.getItem(SUGGESTIONS_KEY);
    if (!raw) return { entries: {} };
    const parsed = JSON.parse(raw) as PymkCacheStore;
    return parsed?.entries ? parsed : { entries: {} };
  } catch {
    return { entries: {} };
  }
}

function writeStore(store: PymkCacheStore): void {
  try {
    sessionStorage.setItem(SUGGESTIONS_KEY, JSON.stringify(store));
  } catch {
    // ignore quota / private mode errors
  }
}

/** Return cached PYMK suggestions for a cohort key when still within TTL. */
export function getPymkSessionCache(key: PymkCacheKey): PymkListResponse | null {
  try {
    const store = readStore();
    const entry = store.entries[pymkCacheKeyString(key)];
    if (!entry) return null;
    if (Date.now() - entry.fetchedAt > PYMK_SESSION_CACHE_TTL_MS) {
      delete store.entries[pymkCacheKeyString(key)];
      writeStore(store);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

/** Persist PYMK suggestions for fast modal reopen (per cohort + cohort id). */
export function setPymkSessionCache(key: PymkCacheKey, data: PymkListResponse): void {
  try {
    const store = readStore();
    store.entries[pymkCacheKeyString(key)] = {
      key,
      data,
      fetchedAt: Date.now(),
    };
    writeStore(store);
  } catch {
    // ignore storage errors
  }
}

/** Clear one cohort entry or the entire PYMK session cache. */
export function clearPymkSessionCache(key?: PymkCacheKey): void {
  try {
    if (!key) {
      sessionStorage.removeItem(SUGGESTIONS_KEY);
      return;
    }
    const store = readStore();
    delete store.entries[pymkCacheKeyString(key)];
    writeStore(store);
  } catch {
    // ignore
  }
}

export function getPymkDefaultsSessionCache(): PymkCohortDefaults | null {
  try {
    const raw = sessionStorage.getItem(DEFAULTS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PymkDefaultsCacheEntry;
    if (Date.now() - parsed.fetchedAt > PYMK_SESSION_CACHE_TTL_MS) {
      sessionStorage.removeItem(DEFAULTS_KEY);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

export function setPymkDefaultsSessionCache(data: PymkCohortDefaults): void {
  try {
    sessionStorage.setItem(
      DEFAULTS_KEY,
      JSON.stringify({ data, fetchedAt: Date.now() } satisfies PymkDefaultsCacheEntry),
    );
  } catch {
    // ignore
  }
}
