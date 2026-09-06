import {
  buildWebsiteSessionKey,
  isSameWebsiteSession,
  normalizeOnboardingUrl,
  parseWebsiteSessionKey,
  type WebsiteAnalysisIdentity,
} from './onboardingSessionKey';

const LOG_PREFIX = '[onboarding:storage]';

export const ONBOARDING_STORAGE_KEYS = {
  websiteUrl: 'website_url',
  websiteAnalysisData: 'website_analysis_data',
  websiteSessionKey: 'website_session_key',
  competitorAnalysisData: 'competitor_analysis_data',
  competitorAnalysisUrl: 'competitor_analysis_url',
  competitorAnalysisTimestamp: 'competitor_analysis_timestamp',
  competitorAnalysisSessionKey: 'competitor_analysis_session_key',
  personaGenerationData: 'persona_generation_data',
  personaGenerationSessionKey: 'persona_generation_session_key',
  contentAuditResult: 'content_audit_result',
  siteHealthResult: 'site_health_result',
  seoPreviewResult: 'seo_preview_result',
  sitemapState: 'alwrity_sitemap_state',
  onboardingActiveStep: 'onboarding_active_step',
} as const;

const DOWNSTREAM_KEYS = [
  ONBOARDING_STORAGE_KEYS.competitorAnalysisData,
  ONBOARDING_STORAGE_KEYS.competitorAnalysisUrl,
  ONBOARDING_STORAGE_KEYS.competitorAnalysisTimestamp,
  ONBOARDING_STORAGE_KEYS.competitorAnalysisSessionKey,
  ONBOARDING_STORAGE_KEYS.personaGenerationData,
  ONBOARDING_STORAGE_KEYS.personaGenerationSessionKey,
  ONBOARDING_STORAGE_KEYS.contentAuditResult,
  ONBOARDING_STORAGE_KEYS.siteHealthResult,
  ONBOARDING_STORAGE_KEYS.seoPreviewResult,
  ONBOARDING_STORAGE_KEYS.sitemapState,
  ONBOARDING_STORAGE_KEYS.websiteSessionKey,
] as const;

const PERSONA_SERVER_CACHE_FLAG = 'persona_server_cache_checked';
export const PERSONA_REQUIRES_REGENERATION_FLAG = 'persona_requires_regeneration';

export interface ClearDownstreamOptions {
  preserveActiveStep?: boolean;
}

function safeRemoveLocalStorage(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (err) {
    console.warn(`${LOG_PREFIX} Failed to remove localStorage key "${key}":`, err);
  }
}

function safeRemoveSessionStorage(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch (err) {
    console.warn(`${LOG_PREFIX} Failed to remove sessionStorage key "${key}":`, err);
  }
}

export function getStoredWebsiteSessionKey(): string | null {
  try {
    return localStorage.getItem(ONBOARDING_STORAGE_KEYS.websiteSessionKey);
  } catch (err) {
    console.warn(`${LOG_PREFIX} Failed to read website session key:`, err);
    return null;
  }
}

export function storeWebsiteSessionKey(sessionKey: string): void {
  try {
    localStorage.setItem(ONBOARDING_STORAGE_KEYS.websiteSessionKey, sessionKey);
  } catch (err) {
    console.warn(`${LOG_PREFIX} Failed to store website session key:`, err);
  }
}

export function resolveCurrentWebsiteSessionKey(
  websiteUrl?: string,
  analysis?: WebsiteAnalysisIdentity | null
): string {
  let url = websiteUrl || '';
  let resolvedAnalysis = analysis ?? null;

  if (!url) {
    try {
      url = localStorage.getItem(ONBOARDING_STORAGE_KEYS.websiteUrl) || '';
    } catch {
      url = '';
    }
  }

  if (!resolvedAnalysis) {
    try {
      const raw = localStorage.getItem(ONBOARDING_STORAGE_KEYS.websiteAnalysisData);
      if (raw) resolvedAnalysis = JSON.parse(raw) as WebsiteAnalysisIdentity;
    } catch (err) {
      console.warn(`${LOG_PREFIX} Failed to parse website analysis for session key:`, err);
    }
  }

  return buildWebsiteSessionKey(url, resolvedAnalysis);
}

export function clearDownstreamForWebsiteChange(
  options: ClearDownstreamOptions = {}
): void {
  const { preserveActiveStep = false } = options;

  console.log(`${LOG_PREFIX} Clearing downstream onboarding caches`, {
    preserveActiveStep,
  });

  for (const key of DOWNSTREAM_KEYS) {
    safeRemoveLocalStorage(key);
  }

  safeRemoveSessionStorage(PERSONA_SERVER_CACHE_FLAG);
  try {
    sessionStorage.setItem(PERSONA_REQUIRES_REGENERATION_FLAG, '1');
  } catch (err) {
    console.warn(`${LOG_PREFIX} Failed to mark persona regeneration required:`, err);
  }

  if (!preserveActiveStep) {
    safeRemoveLocalStorage(ONBOARDING_STORAGE_KEYS.onboardingActiveStep);
  }
}

export interface SyncWebsiteAnalysisStorageResult {
  sessionKey: string;
  didInvalidateDownstream: boolean;
}

function readStorageItem(key: string): string {
  try {
    return localStorage.getItem(key) || '';
  } catch (err) {
    console.warn(`${LOG_PREFIX} Failed to read "${key}":`, err);
    return '';
  }
}

function storedIdentityBelongsToOtherWebsite(websiteUrl: string): boolean {
  const nextUrl = normalizeOnboardingUrl(websiteUrl);
  if (!nextUrl) return false;

  const previousUrl = readStorageItem(ONBOARDING_STORAGE_KEYS.websiteUrl);
  if (previousUrl && normalizeOnboardingUrl(previousUrl) !== nextUrl) {
    return true;
  }

  const competitorUrl = readStorageItem(ONBOARDING_STORAGE_KEYS.competitorAnalysisUrl);
  if (competitorUrl && normalizeOnboardingUrl(competitorUrl) !== nextUrl) {
    return true;
  }

  const personaKey = readStorageItem(ONBOARDING_STORAGE_KEYS.personaGenerationSessionKey);
  if (personaKey) {
    const personaUrl = parseWebsiteSessionKey(personaKey).url;
    if (personaUrl && personaUrl !== nextUrl) {
      return true;
    }
  }

  return false;
}

function markPersonaRegenerationIfCacheDoesNotMatch(sessionKey: string): void {
  try {
    const personaKey = readStorageItem(ONBOARDING_STORAGE_KEYS.personaGenerationSessionKey);
    if (!personaKey || !isSameWebsiteSession(personaKey, sessionKey)) {
      sessionStorage.setItem(PERSONA_REQUIRES_REGENERATION_FLAG, '1');
      console.log(`${LOG_PREFIX} Persona must be regenerated for website session`, {
        sessionKey,
      });
    }
  } catch (err) {
    console.warn(`${LOG_PREFIX} Failed to mark persona regeneration:`, err);
  }
}

/**
 * Persist website URL/analysis and invalidate downstream caches when the
 * website identity changes — including load-saved-analysis of a previous site.
 */
export function syncWebsiteAnalysisStorage(
  websiteUrl: string,
  analysis: WebsiteAnalysisIdentity | null | undefined
): SyncWebsiteAnalysisStorageResult {
  const sessionKey = buildWebsiteSessionKey(websiteUrl, analysis ?? null);
  const previousKey = getStoredWebsiteSessionKey();
  const didInvalidateDownstream =
    storedIdentityBelongsToOtherWebsite(websiteUrl) ||
    (!!previousKey && !isSameWebsiteSession(previousKey, sessionKey));

  if (didInvalidateDownstream) {
    console.log(`${LOG_PREFIX} Website session changed`, {
      previousKey,
      sessionKey,
    });
    clearDownstreamForWebsiteChange({ preserveActiveStep: true });
  }

  try {
    localStorage.setItem(ONBOARDING_STORAGE_KEYS.websiteUrl, websiteUrl);
    if (analysis) {
      localStorage.setItem(
        ONBOARDING_STORAGE_KEYS.websiteAnalysisData,
        JSON.stringify(analysis)
      );
    }
    storeWebsiteSessionKey(sessionKey);
  } catch (err) {
    console.error(`${LOG_PREFIX} Failed to sync website analysis storage:`, err);
  }

  markPersonaRegenerationIfCacheDoesNotMatch(sessionKey);

  return { sessionKey, didInvalidateDownstream };
}
