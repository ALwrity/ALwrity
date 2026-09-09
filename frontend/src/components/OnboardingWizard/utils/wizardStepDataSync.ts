import {
  mergeArtifactAwareSeedIntoStepData,
  normalizeBackendStepSeed,
  type BackendStepSeed,
} from '../common/onboardingSeedMerge';
import {
  readLiveWebsiteAnalysisFromStorage,
  readLiveWebsiteUrlFromStorage,
} from '../common/wizardLiveWebsiteSession';
import {
  isDownstreamDirty,
  stripDownstreamStepData,
} from './onboardingWebsiteReset';

type BackendStep = {
  step_number: number;
  status?: string;
  has_data?: boolean;
  data?: Record<string, unknown> | null;
};

function toBackendStepSeed(step?: BackendStep): BackendStepSeed | null {
  if (!step) return null;
  return normalizeBackendStepSeed({
    data: step.data || null,
    hasData: step.has_data === true,
  });
}

export function mergeBackendStepsIntoStepData(
  backendSteps: BackendStep[],
  prev: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  const getStep = (frontendIndex: number) =>
    backendSteps.find((step) => step.step_number === frontendIndex + 1);

  if (isDownstreamDirty()) {
    let next: Record<string, unknown> = { ...(prev || {}) };
    const step1 = getStep(0);
    if (step1?.data) {
      next = {
        ...next,
        email: step1.data.email ?? next.email,
      };
    }
    next = stripDownstreamStepData(next);
    delete next.analysis;
    delete next.crawlResult;
    delete next.domainName;
    return next;
  }

  const { stepData } = mergeArtifactAwareSeedIntoStepData(
    prev,
    {
      connect: toBackendStepSeed(getStep(0)),
      research: toBackendStepSeed(getStep(1)),
      personalization: toBackendStepSeed(getStep(2)),
    },
    readLiveWebsiteUrlFromStorage(),
    readLiveWebsiteAnalysisFromStorage(),
    { suppressBackendConnectSeed: false }
  );

  return stepData;
}
