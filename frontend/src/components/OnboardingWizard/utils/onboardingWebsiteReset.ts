/**
 * Utilities for invalidating downstream onboarding state when the website
 * analysis changes (new URL or re-analyze).
 */

export const ONBOARDING_STEP1_WEBSITE_KEY = 'onboarding_step1_website_url';
export const ONBOARDING_DOWNSTREAM_DIRTY_KEY = 'onboarding_downstream_dirty';

const DOWNSTREAM_CACHE_KEYS = [
  'competitor_analysis_data',
  'competitor_analysis_url',
  'competitor_analysis_timestamp',
  'persona_generation_data',
  'alwrity_sitemap_state',
] as const;

const DOWNSTREAM_STEP_FIELDS = [
  'competitors',
  'researchSummary',
  'sitemapAnalysis',
  'social_media_accounts',
  'social_media_citations',
  'content_pillars',
  'corePersona',
  'platformPersonas',
  'qualityMetrics',
  'selectedPlatforms',
  'brandAvatar',
  'voiceClone',
  'growth_summary',
  'research_depth',
  'content_types',
] as const;

export function normalizeWebsiteUrl(url: string): string {
  if (!url) return '';
  return url
    .trim()
    .toLowerCase()
    .replace(/\/$/, '')
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '');
}

export function getStoredWebsiteUrl(): string {
  try {
    return localStorage.getItem('website_url') || '';
  } catch {
    return '';
  }
}

export function getCommittedStep1WebsiteUrl(): string {
  try {
    return localStorage.getItem(ONBOARDING_STEP1_WEBSITE_KEY) || '';
  } catch {
    return '';
  }
}

export function setCommittedStep1WebsiteUrl(url: string): void {
  try {
    const normalized = normalizeWebsiteUrl(url);
    if (normalized) {
      localStorage.setItem(ONBOARDING_STEP1_WEBSITE_KEY, normalized);
      localStorage.removeItem(ONBOARDING_DOWNSTREAM_DIRTY_KEY);
    }
  } catch (err) {
    console.warn('[onboardingWebsiteReset] Failed to persist step1 website URL:', err);
  }
}

export function markDownstreamDirty(): void {
  try {
    localStorage.setItem(ONBOARDING_DOWNSTREAM_DIRTY_KEY, 'true');
  } catch (err) {
    console.warn('[onboardingWebsiteReset] Failed to mark downstream dirty:', err);
  }
}

export function isDownstreamDirty(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_DOWNSTREAM_DIRTY_KEY) === 'true';
  } catch {
    return false;
  }
}

/** True after Analyze New Website — downstream dirty and no live URL in storage. */
export function isWebsiteStartFreshSession(): boolean {
  if (!isDownstreamDirty()) return false;
  try {
    return !localStorage.getItem('website_url');
  } catch {
    return true;
  }
}

export function hasWebsiteChangedFromCommitted(currentUrl: string): boolean {
  const committed = getCommittedStep1WebsiteUrl();
  if (!committed) return false;
  const current = normalizeWebsiteUrl(currentUrl);
  if (!current) return false;
  return committed !== current;
}

export function clearDownstreamLocalCaches(): void {
  try {
    for (const key of DOWNSTREAM_CACHE_KEYS) {
      localStorage.removeItem(key);
    }
    sessionStorage.removeItem('persona_server_cache_checked');
    console.log('[onboardingWebsiteReset] Cleared downstream local caches');
  } catch (err) {
    console.warn('[onboardingWebsiteReset] Failed to clear downstream caches:', err);
  }
}

export function stripDownstreamStepData<T extends Record<string, unknown>>(
  stepData: T | null | undefined
): T {
  if (!stepData || typeof stepData !== 'object') {
    return {} as T;
  }

  const next = { ...stepData } as Record<string, unknown>;
  for (const field of DOWNSTREAM_STEP_FIELDS) {
    delete next[field];
  }
  return next as T;
}

export function shouldInvalidateDownstream(params: {
  previousUrl: string;
  nextUrl: string;
  isExplicitReanalyze?: boolean;
  isStartFresh?: boolean;
}): boolean {
  if (params.isStartFresh) return true;
  if (params.isExplicitReanalyze) return true;

  const prev = normalizeWebsiteUrl(params.previousUrl);
  const next = normalizeWebsiteUrl(params.nextUrl);
  if (!next) return false;
  if (!prev) return false;
  return prev !== next;
}

export const DEFAULT_VIEWED_TABS: Record<number, boolean> = {
  0: true,
  1: false,
  2: false,
};

export interface OnboardingProgressSnapshot {
  percent: number;
  completedCount: number;
  completedFrontier: number;
  furthestAccessibleStep: number;
}

/** While step 1 is being re-done, lock wizard progress to step 0 only. */
export function applyDownstreamDirtyProgressOverride(
  state: OnboardingProgressSnapshot
): OnboardingProgressSnapshot {
  if (!isDownstreamDirty()) {
    return state;
  }
  return {
    percent: 0,
    completedCount: 0,
    completedFrontier: -1,
    furthestAccessibleStep: 0,
  };
}

export function clearDownstreamDirtyFlag(): void {
  try {
    localStorage.removeItem(ONBOARDING_DOWNSTREAM_DIRTY_KEY);
  } catch (err) {
    console.warn('[onboardingWebsiteReset] Failed to clear downstream dirty flag:', err);
  }
}

const WIZARD_RESET_LOCAL_KEYS = [
  'onboarding_step_data',
  'onboarding_active_step',
  'onboarding_complete',
  'primary_website',
  'website_url',
  'website_analysis_data',
  'website_session_key',
  ONBOARDING_STEP1_WEBSITE_KEY,
  ONBOARDING_DOWNSTREAM_DIRTY_KEY,
  ...DOWNSTREAM_CACHE_KEYS,
] as const;

export type WebsiteAnalysisChangeReason =
  | 'reanalyze'
  | 'new_website'
  | 'start_fresh'
  | 'load_existing';

/**
 * Full local wipe for account reset / clean-slate onboarding.
 * Call onboardingCache.clearCache() separately when the cache service is available.
 */
export function clearOnboardingWizardLocalState(reason: string): void {
  console.log('[onboardingWebsiteReset] Clearing wizard local state:', reason);
  try {
    for (const key of WIZARD_RESET_LOCAL_KEYS) {
      localStorage.removeItem(key);
    }
    sessionStorage.removeItem('onboarding_init');
    sessionStorage.removeItem('persona_server_cache_checked');
    clearDownstreamLocalCaches();
  } catch (err) {
    console.warn('[onboardingWebsiteReset] Failed to clear wizard local state:', err);
  }
}

/** Skip wizard downstream invalidation on first-ever analysis after reset. */
export function shouldNotifyWebsiteAnalysisChanged(params: {
  reason: WebsiteAnalysisChangeReason;
  didInvalidateDownstream: boolean;
}): boolean {
  if (params.didInvalidateDownstream) {
    return true;
  }
  if (params.reason === 'reanalyze' || params.reason === 'start_fresh') {
    return true;
  }
  if (params.reason === 'load_existing') {
    return !!getCommittedStep1WebsiteUrl();
  }
  if (params.reason === 'new_website') {
    return !!getCommittedStep1WebsiteUrl();
  }
  return false;
}
