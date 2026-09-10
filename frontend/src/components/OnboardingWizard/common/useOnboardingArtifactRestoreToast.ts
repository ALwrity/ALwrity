import { useCallback, useEffect, useRef, useState } from 'react';
import type { OnboardingArtifactStep } from './onboardingArtifactRestore';
import {
  getArtifactRestoreMessage,
  hasRestoreToastBeenShown,
  mapFrontendStepToArtifactStep,
  markRestoreToastShown,
} from './onboardingArtifactRestoreMessage';

export const ARTIFACT_RESTORE_TOAST_DISMISS_MS = 4000;

interface BackendInitStep {
  step_number: number;
  has_data?: boolean;
}

interface UseOnboardingArtifactRestoreToastInput {
  loading: boolean;
  activeStep: number;
  backendSteps?: BackendInitStep[] | null;
  isStartFreshSession: boolean;
  /** Steps restored during the latest seed merge (optional extra signal). */
  restoredSteps?: OnboardingArtifactStep[];
}

export function useOnboardingArtifactRestoreToast({
  loading,
  activeStep,
  backendSteps,
  isStartFreshSession,
  restoredSteps = [],
}: UseOnboardingArtifactRestoreToastInput) {
  const [restoreToast, setRestoreToast] = useState<string | null>(null);
  const lastShownStepRef = useRef<OnboardingArtifactStep | null>(null);

  const dismissRestoreToast = useCallback(() => {
    setRestoreToast(null);
  }, []);

  useEffect(() => {
    if (loading || isStartFreshSession) {
      return;
    }

    const artifactStep = mapFrontendStepToArtifactStep(activeStep);
    if (!artifactStep) {
      return;
    }

    const backendStepNumber =
      artifactStep === 'connect' ? 1 : artifactStep === 'research' ? 2 : 3;
    const backendStep = backendSteps?.find((s) => s.step_number === backendStepNumber);
    const backendHasData = backendStep?.has_data === true;
    const mergedThisSession = restoredSteps.includes(artifactStep);

    if (!backendHasData && !mergedThisSession) {
      return;
    }

    if (hasRestoreToastBeenShown(artifactStep)) {
      return;
    }

    if (lastShownStepRef.current === artifactStep) {
      return;
    }

    lastShownStepRef.current = artifactStep;
    markRestoreToastShown(artifactStep);
    setRestoreToast(getArtifactRestoreMessage(artifactStep));

    const timer = window.setTimeout(() => {
      setRestoreToast(null);
    }, ARTIFACT_RESTORE_TOAST_DISMISS_MS);

    return () => window.clearTimeout(timer);
  }, [
    loading,
    activeStep,
    backendSteps,
    isStartFreshSession,
    restoredSteps,
  ]);

  return { restoreToast, dismissRestoreToast };
}
