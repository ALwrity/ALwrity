import type { OnboardingArtifactStep } from './onboardingArtifactRestore';

const RESTORE_TOAST_SHOWN_PREFIX = 'onboarding_restore_toast_shown_';

export function getArtifactRestoreMessage(step: OnboardingArtifactStep): string {
  switch (step) {
    case 'connect':
      return 'Restored your website analysis.';
    case 'research':
      return 'Restored your competitor research.';
    case 'personalization':
      return 'Restored your brand persona.';
    default:
      return 'Restored your previous analysis.';
  }
}

export function mapFrontendStepToArtifactStep(
  activeStep: number
): OnboardingArtifactStep | null {
  if (activeStep === 0) return 'connect';
  if (activeStep === 1) return 'research';
  if (activeStep === 2) return 'personalization';
  return null;
}

export function hasRestoreToastBeenShown(step: OnboardingArtifactStep): boolean {
  try {
    return sessionStorage.getItem(`${RESTORE_TOAST_SHOWN_PREFIX}${step}`) === '1';
  } catch {
    return false;
  }
}

export function markRestoreToastShown(step: OnboardingArtifactStep): void {
  try {
    sessionStorage.setItem(`${RESTORE_TOAST_SHOWN_PREFIX}${step}`, '1');
  } catch {
    // ignore
  }
}

export function clearRestoreToastFlags(): void {
  try {
    for (const step of ['connect', 'research', 'personalization']) {
      sessionStorage.removeItem(`${RESTORE_TOAST_SHOWN_PREFIX}${step}`);
    }
  } catch {
    // ignore
  }
}
