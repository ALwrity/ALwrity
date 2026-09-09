/**
 * Artifact-aware onboarding seed merge (Phase 3 SSOT).
 * Uses has_data + website match — not official step completion.
 */

import { shouldRestoreStepArtifacts, type OnboardingArtifactStep } from './onboardingArtifactRestore';
import { hasPersistedResearchPayload } from '../CompetitorAnalysisStep/competitorResearchRestore';
import {
  applyLiveWebsiteSessionToStepData,
  shouldMergeBackendDownstreamSteps,
} from './wizardLiveWebsiteSession';

const LOG_PREFIX = '[onboarding:seed-merge]';

export interface BackendStepSeed {
  data: Record<string, unknown> | null;
  hasData: boolean;
}

export interface OnboardingSeedSteps {
  connect?: BackendStepSeed | Record<string, unknown> | null;
  research?: BackendStepSeed | Record<string, unknown> | null;
  personalization?: BackendStepSeed | Record<string, unknown> | null;
}

export interface MergeOnboardingSeedOptions {
  /** Skip backend connect seed during Analyze New Website. */
  suppressBackendConnectSeed?: boolean;
}

export interface MergeSeedResult {
  stepData: Record<string, unknown>;
  restoredSteps: OnboardingArtifactStep[];
}

export function normalizeBackendStepSeed(
  seed?: BackendStepSeed | Record<string, unknown> | null
): BackendStepSeed {
  if (!seed) {
    return { data: null, hasData: false };
  }
  if ('hasData' in seed && 'data' in seed) {
    return seed as BackendStepSeed;
  }
  const data = seed as Record<string, unknown>;
  return { data, hasData: false };
}

export function hasConnectArtifactData(
  data?: Record<string, unknown> | null
): boolean {
  if (!data) return false;
  return !!(
    data.website ||
    data.website_url ||
    data.writing_style ||
    data.analysis
  );
}

export function hasPersonaArtifactData(
  data?: Record<string, unknown> | null
): boolean {
  if (!data) return false;
  if (data.corePersona) return true;
  const platforms = data.platformPersonas;
  return (
    !!platforms &&
    typeof platforms === 'object' &&
    Object.keys(platforms as object).length > 0
  );
}

function resolveArtifactHasData(
  seed: BackendStepSeed,
  detector: (data?: Record<string, unknown> | null) => boolean
): boolean {
  return seed.hasData || detector(seed.data);
}

export function mergeArtifactAwareSeedIntoStepData(
  previous: Record<string, unknown> | null | undefined,
  backend: OnboardingSeedSteps,
  liveWebsiteUrl: string,
  liveAnalysis?: Record<string, unknown> | null,
  options?: MergeOnboardingSeedOptions
): MergeSeedResult {
  const connectSeed = normalizeBackendStepSeed(backend.connect);
  const researchSeed = normalizeBackendStepSeed(backend.research);
  const personaSeed = normalizeBackendStepSeed(backend.personalization);
  const isStartFreshSession = options?.suppressBackendConnectSeed ?? false;
  const restoredSteps: OnboardingArtifactStep[] = [];

  const backendWebsite = String(
    connectSeed.data?.website || connectSeed.data?.website_url || ''
  ).trim();
  const websiteMatch = shouldMergeBackendDownstreamSteps(
    backendWebsite,
    liveWebsiteUrl
  );

  if (isStartFreshSession && !liveWebsiteUrl.trim()) {
    console.log(`${LOG_PREFIX} Skipping backend seed during start-fresh session`);
    return { stepData: { ...(previous || {}) }, restoredSteps };
  }

  if (!websiteMatch) {
    return {
      stepData: applyLiveWebsiteSessionToStepData(previous, {
        website: liveWebsiteUrl,
        analysis: liveAnalysis ?? null,
      }),
      restoredSteps,
    };
  }

  const next: Record<string, unknown> = { ...(previous || {}) };

  const shouldMergeConnect =
    connectSeed.data &&
    resolveArtifactHasData(connectSeed, hasConnectArtifactData) &&
    !(isStartFreshSession && !liveWebsiteUrl.trim());

  if (shouldMergeConnect) {
    Object.assign(next, connectSeed.data);
    next.website = connectSeed.data!.website || connectSeed.data!.website_url;
    next.analysis = connectSeed.data!.analysis || connectSeed.data;
    if (!hasConnectArtifactData(previous)) {
      restoredSteps.push('connect');
    }
  }

  const restoreCtx = {
    websiteMatch,
    isStartFreshSession,
  };

  if (
    researchSeed.data &&
    shouldRestoreStepArtifacts({
      hasData: resolveArtifactHasData(researchSeed, hasPersistedResearchPayload),
      ...restoreCtx,
      stepDataAlreadyHasPayload: hasPersistedResearchPayload(previous),
    })
  ) {
    Object.assign(next, researchSeed.data);
    restoredSteps.push('research');
  }

  if (
    personaSeed.data &&
    shouldRestoreStepArtifacts({
      hasData: resolveArtifactHasData(personaSeed, hasPersonaArtifactData),
      ...restoreCtx,
      stepDataAlreadyHasPayload: hasPersonaArtifactData(previous),
    })
  ) {
    Object.assign(next, personaSeed.data);
    restoredSteps.push('personalization');
  }

  return { stepData: next, restoredSteps };
}
