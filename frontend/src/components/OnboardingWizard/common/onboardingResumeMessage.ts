/**
 * Resume messaging for partially completed onboarding sessions.
 */

import { progressPercentAfterStepComplete } from './onboardingProgressState';

export interface OnboardingResumeMessageInput {
  completionPercentage: number;
  currentStep: number;
  totalSteps: number;
  isCompleted: boolean;
  stepLabels: string[];
}

export function getOnboardingResumeMessage({
  completionPercentage,
  currentStep,
  totalSteps,
  isCompleted,
  stepLabels,
}: OnboardingResumeMessageInput): string | null {
  if (isCompleted || completionPercentage <= 0) {
    return null;
  }

  const stepIndex = Math.max(
    0,
    Math.min(totalSteps - 1, currentStep - 1)
  );
  const stepLabel = stepLabels[stepIndex] || 'your next step';

  return `Welcome back! You're ${Math.round(completionPercentage)}% through setup — continue at ${stepLabel}.`;
}

export function buildStepSavedSuccessMessage(
  completedStepNumber: number,
  totalSteps: number
): string {
  const progressPct = progressPercentAfterStepComplete(completedStepNumber, totalSteps);
  return `Step saved — setup progress is now ${progressPct}%.`;
}
