import { normalizeOnboardingUrl } from './onboardingSessionKey';

const LOG_PREFIX = '[onboarding:live-session]';

const DOWNSTREAM_STEP_DATA_KEYS = [
  'competitors',
  'researchSummary',
  'research_summary',
  'sitemapAnalysis',
  'content_pillars',
  'social_media_accounts',
  'corePersona',
  'platformPersonas',
  'qualityMetrics',
  'selectedPlatforms',
  'completeness',
  'data_sufficiency',
  'industryContext',
] as const;

export interface LiveWebsiteSessionPayload {
  website: string;
  analysis?: Record<string, unknown> | null;
}

export function applyLiveWebsiteSessionToStepData(
  previous: Record<string, unknown> | null | undefined,
  live: LiveWebsiteSessionPayload
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...(previous || {}) };

  const previousUrl = normalizeOnboardingUrl(
    String(previous?.website || previous?.website_url || '')
  );
  const nextUrl = normalizeOnboardingUrl(live.website || '');
  const websiteChanged =
    !!previousUrl && !!nextUrl && previousUrl !== nextUrl;
  const websiteCleared = !!previousUrl && !nextUrl;

  if (websiteChanged || websiteCleared || (!previousUrl && nextUrl)) {
    for (const key of DOWNSTREAM_STEP_DATA_KEYS) {
      delete next[key];
    }
  }

  const website = (live.website || '').trim();
  next.website = website;
  next.website_url = website;

  if (live.analysis && typeof live.analysis === 'object') {
    next.analysis = live.analysis;
  } else {
    delete next.analysis;
  }

  console.log(`${LOG_PREFIX} Applied live website session to wizard stepData`, {
    website,
    websiteChanged,
    preservedDownstream: !websiteChanged,
    analysisId: (live.analysis as { id?: unknown } | null)?.id ?? null,
  });

  return next;
}

export function shouldMergeBackendDownstreamSteps(
  backendWebsiteUrl: string | undefined,
  liveWebsiteUrl: string | undefined
): boolean {
  const backend = normalizeOnboardingUrl(backendWebsiteUrl || '');
  const live = normalizeOnboardingUrl(liveWebsiteUrl || '');
  if (!live) return true;
  if (!backend) return true;
  return backend === live;
}

export function readLiveWebsiteUrlFromStorage(): string {
  try {
    return localStorage.getItem('website_url') || '';
  } catch (err) {
    console.warn(`${LOG_PREFIX} Failed to read live website URL:`, err);
    return '';
  }
}

export function readLiveWebsiteAnalysisFromStorage(): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem('website_analysis_data');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (err) {
    console.warn(`${LOG_PREFIX} Failed to read live website analysis:`, err);
    return null;
  }
}

export function stageTypedWebsiteUrl(typedUrl: string): boolean {
  const next = (typedUrl || '').trim();
  if (!next) return false;

  const stored = readLiveWebsiteUrlFromStorage();
  if (!stored || normalizeOnboardingUrl(stored) === normalizeOnboardingUrl(next)) {
    return false;
  }

  console.log(`${LOG_PREFIX} Typed website differs from stored session`, {
    stored,
    next,
  });

  try {
    localStorage.setItem('website_url', next);
    localStorage.removeItem('website_analysis_data');
  } catch (err) {
    console.warn(`${LOG_PREFIX} Failed to stage typed website URL:`, err);
  }

  return true;
}

export type {
  BackendStepSeed,
  MergeOnboardingSeedOptions,
  MergeSeedResult,
  OnboardingSeedSteps,
} from './onboardingSeedMerge';

export { mergeArtifactAwareSeedIntoStepData } from './onboardingSeedMerge';

import {
  mergeArtifactAwareSeedIntoStepData,
  type MergeOnboardingSeedOptions,
  type OnboardingSeedSteps,
} from './onboardingSeedMerge';

/** @deprecated Prefer mergeArtifactAwareSeedIntoStepData for restoredSteps metadata. */
export function mergeOnboardingSeedIntoStepData(
  previous: Record<string, unknown> | null | undefined,
  backend: OnboardingSeedSteps,
  liveWebsiteUrl: string,
  liveAnalysis?: Record<string, unknown> | null,
  options?: MergeOnboardingSeedOptions
): Record<string, unknown> {
  return mergeArtifactAwareSeedIntoStepData(
    previous,
    backend,
    liveWebsiteUrl,
    liveAnalysis,
    options
  ).stepData;
}

export function canReuseServerPersona(
  liveWebsiteUrl: string,
  personaWebsiteUrl?: string,
  committedWebsiteUrl?: string
): boolean {
  void committedWebsiteUrl;
  const live = normalizeOnboardingUrl(liveWebsiteUrl || '');
  if (!live) return true;

  const personaSite = normalizeOnboardingUrl(personaWebsiteUrl || '');
  if (personaSite) {
    return personaSite === live;
  }

  // Unscoped personas cannot be proven to belong to the live website.
  return false;
}

export function resolveLoadedAnalysisWebsiteUrl(
  typedUrl: string,
  analysis?: { website_url?: string } | null
): { url: string; error?: string } {
  const typed = (typedUrl || '').trim();
  const recorded = (analysis?.website_url || '').trim();

  if (
    typed &&
    recorded &&
    normalizeOnboardingUrl(typed) !== normalizeOnboardingUrl(recorded)
  ) {
    console.error(`${LOG_PREFIX} Saved analysis URL does not match the entered website`, {
      typed,
      recorded,
    });
    return {
      url: '',
      error:
        'This saved analysis belongs to a different website. Enter that site to load it, or analyze the URL you typed.',
    };
  }

  return { url: typed || recorded };
}
