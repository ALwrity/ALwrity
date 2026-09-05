import {
  isDownstreamDirty,
  stripDownstreamStepData,
} from './onboardingWebsiteReset';

type BackendStep = {
  step_number: number;
  status?: string;
  data?: Record<string, unknown> | null;
};

export function mergeBackendStepsIntoStepData(
  backendSteps: BackendStep[],
  prev: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  const downstreamDirty = isDownstreamDirty();
  let next: Record<string, unknown> = { ...(prev || {}) };

  const getStep = (frontendIndex: number) =>
    backendSteps.find((step) => step.step_number === frontendIndex + 1);

  const step1 = getStep(0);
  if (step1?.data) {
    const d = step1.data;
    if (downstreamDirty) {
      next = {
        ...next,
        email: d.email ?? next.email,
      };
    } else {
      next = {
        ...next,
        ...d,
        website: d.website || d.website_url,
        analysis: d.analysis || d,
      };
    }
  }

  if (!downstreamDirty) {
    const step2 = getStep(1);
    if (step2?.data) {
      next = { ...next, ...step2.data };
    }
    const step3 = getStep(2);
    if (step3?.data) {
      next = { ...next, ...step3.data };
    }
  } else {
    next = stripDownstreamStepData(next);
    delete next.analysis;
    delete next.crawlResult;
    delete next.domainName;
  }

  return next;
}
