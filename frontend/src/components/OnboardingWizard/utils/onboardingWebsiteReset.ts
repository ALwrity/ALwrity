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
