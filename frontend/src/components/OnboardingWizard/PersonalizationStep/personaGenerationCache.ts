import { ONBOARDING_STORAGE_KEYS } from '../common/onboardingStorageKeys';
import { isSameWebsiteSession } from '../common/onboardingSessionKey';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const LOG_PREFIX = '[onboarding:persona-cache]';
const PERSONA_SERVER_CACHE_FLAG = 'persona_server_cache_checked';

export interface PersonaCachePayload {
  core_persona?: Record<string, unknown>;
  platform_personas?: Record<string, unknown>;
  quality_metrics?: Record<string, unknown>;
  completeness?: Record<string, unknown> | null;
  data_sufficiency?: number | null;
  timestamp?: string;
  selected_platforms?: string[];
  website_session_key?: string;
  [key: string]: unknown;
}

export interface PersonaCacheValidationInput {
  cachedSessionKey: string | null;
  currentSessionKey: string;
  cacheTimestamp: string | null;
}

export function readPersonaCacheSessionKey(): string | null {
  try {
    return localStorage.getItem(ONBOARDING_STORAGE_KEYS.personaGenerationSessionKey);
  } catch (err) {
    console.warn(`${LOG_PREFIX} Failed to read persona session key:`, err);
    return null;
  }
}

export function writePersonaCacheSessionKey(sessionKey: string): void {
  try {
    localStorage.setItem(ONBOARDING_STORAGE_KEYS.personaGenerationSessionKey, sessionKey);
  } catch (err) {
    console.warn(`${LOG_PREFIX} Failed to write persona session key:`, err);
  }
}

export function isPersonaCacheValid(input: PersonaCacheValidationInput): boolean {
  const { cachedSessionKey, currentSessionKey, cacheTimestamp } = input;

  if (!cacheTimestamp) {
    console.debug(`${LOG_PREFIX} Rejecting cache: missing timestamp`);
    return false;
  }

  const parsedTime = Date.parse(cacheTimestamp);
  if (Number.isNaN(parsedTime)) {
    console.debug(`${LOG_PREFIX} Rejecting cache: invalid timestamp`);
    return false;
  }

  if (Date.now() - parsedTime >= CACHE_TTL_MS) {
    console.debug(`${LOG_PREFIX} Rejecting cache: expired`);
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

export function readPersonaCache(currentSessionKey: string): PersonaCachePayload | null {
  try {
    const raw = localStorage.getItem(ONBOARDING_STORAGE_KEYS.personaGenerationData);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as PersonaCachePayload;
    const cachedSessionKey =
      readPersonaCacheSessionKey() || parsed.website_session_key || null;

    if (
      !isPersonaCacheValid({
        cachedSessionKey,
        currentSessionKey,
        cacheTimestamp: parsed.timestamp ?? null,
      })
    ) {
      console.log(`${LOG_PREFIX} Invalid persona cache for session`, { currentSessionKey });
      clearPersonaCache();
      return null;
    }

    return parsed;
  } catch (err) {
    console.warn(`${LOG_PREFIX} Failed to read persona cache:`, err);
    return null;
  }
}

export function writePersonaCache(sessionKey: string, data: PersonaCachePayload): void {
  try {
    const payload: PersonaCachePayload = {
      ...data,
      timestamp: data.timestamp || new Date().toISOString(),
      website_session_key: sessionKey,
    };
    localStorage.setItem(
      ONBOARDING_STORAGE_KEYS.personaGenerationData,
      JSON.stringify(payload)
    );
    writePersonaCacheSessionKey(sessionKey);
    try {
      sessionStorage.removeItem('persona_requires_regeneration');
    } catch {
      /* ignore */
    }
  } catch (err) {
    console.warn(`${LOG_PREFIX} Failed to write persona cache:`, err);
  }
}

export function mergePlatformPersonaIntoCache(
  sessionKey: string,
  platformId: string,
  persona: Record<string, unknown>
): void {
  const cached = readPersonaCache(sessionKey);
  if (!cached) {
    console.debug(`${LOG_PREFIX} Skipping platform merge: no valid cache`);
    return;
  }

  writePersonaCache(sessionKey, {
    ...cached,
    platform_personas: {
      ...(cached.platform_personas || {}),
      [platformId]: persona,
    },
  });
}

export function clearPersonaCache(): void {
  try {
    localStorage.removeItem(ONBOARDING_STORAGE_KEYS.personaGenerationData);
    localStorage.removeItem(ONBOARDING_STORAGE_KEYS.personaGenerationSessionKey);
  } catch (err) {
    console.warn(`${LOG_PREFIX} Failed to clear persona cache:`, err);
  }
}

function parseServerCacheFlag(): { sessionKey: string; status: 'found' | '404' } | null {
  try {
    const raw = sessionStorage.getItem(PERSONA_SERVER_CACHE_FLAG);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as { sessionKey?: string; status?: string };
    if (!parsed.sessionKey) return null;
    if (parsed.status !== 'found' && parsed.status !== '404') return null;

    return { sessionKey: parsed.sessionKey, status: parsed.status };
  } catch (err) {
    console.warn(`${LOG_PREFIX} Failed to parse server cache flag:`, err);
    return null;
  }
}

export function getPersonaServerCacheStatus(
  currentSessionKey: string
): 'found' | '404' | null {
  const parsed = parseServerCacheFlag();
  if (!parsed) return null;
  if (!isSameWebsiteSession(parsed.sessionKey, currentSessionKey)) return null;
  return parsed.status;
}

export function setPersonaServerCacheStatus(
  sessionKey: string,
  status: 'found' | '404'
): void {
  try {
    sessionStorage.setItem(
      PERSONA_SERVER_CACHE_FLAG,
      JSON.stringify({ sessionKey, status })
    );
  } catch (err) {
    console.warn(`${LOG_PREFIX} Failed to set server cache status:`, err);
  }
}

export function clearPersonaServerCacheStatus(): void {
  try {
    sessionStorage.removeItem(PERSONA_SERVER_CACHE_FLAG);
  } catch (err) {
    console.warn(`${LOG_PREFIX} Failed to clear server cache status:`, err);
  }
}
