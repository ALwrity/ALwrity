/**
 * Progress-first SSOT: derive all wizard step UI from backend completion_percentage
 * (OnboardingSession.progress), which is updated only when Continue completes a step.
 */

export interface OnboardingProgressState {
  /** Setup progress ring percentage (0–100). */
  percent: number;
  /** Count of officially completed steps (0–totalSteps). */
  completedCount: number;
  /** Last completed step index (0-based); -1 when none completed. */
  completedFrontier: number;
  /** Highest step index the user may open (completed + current in-progress). */
  furthestAccessibleStep: number;
}

export function getOnboardingProgressState(
  completionPercentage: number,
  totalSteps: number,
  isCompleted: boolean
): OnboardingProgressState {
  if (!Number.isFinite(totalSteps) || totalSteps <= 0) {
    console.error(
      'getOnboardingProgressState: invalid totalSteps',
      totalSteps
    );
    return {
      percent: 0,
      completedCount: 0,
      completedFrontier: -1,
      furthestAccessibleStep: 0,
    };
  }

  const percent = isCompleted
    ? 100
    : Math.max(0, Math.min(100, completionPercentage));

  const completedCount = isCompleted
    ? totalSteps
    : Math.min(totalSteps, Math.round((percent / 100) * totalSteps));

  const completedFrontier = completedCount > 0 ? completedCount - 1 : -1;
  const furthestAccessibleStep = Math.min(completedCount, totalSteps - 1);

  return {
    percent,
    completedCount,
    completedFrontier,
    furthestAccessibleStep,
  };
}

/** Matches backend complete_step: round(stepNumber / totalSteps * 100). */
export function progressPercentAfterStepComplete(
  stepNumber: number,
  totalSteps: number
): number {
  if (!Number.isFinite(totalSteps) || totalSteps <= 0 || stepNumber <= 0) {
    return 0;
  }
  return Math.min(100, Math.round((stepNumber / totalSteps) * 100));
}
