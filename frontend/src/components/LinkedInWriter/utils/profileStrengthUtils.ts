import type { LinkedInProfileValidation } from '../../../api/linkedinSocial';

/**
 * Display score for header / profile hub.
 * Uses rubric-based optimization_score when profile is complete;
 * otherwise falls back to Phase 3 completeness_score.
 */
export function getDisplayProfileStrengthPercent(
  validation: LinkedInProfileValidation | null | undefined
): number | null {
  if (!validation) return null;

  if (
    validation.is_profile_complete &&
    validation.optimization_score != null &&
    (validation.score_basis === 'rubric' || validation.score_basis === 'rubric_with_progress')
  ) {
    return validation.optimization_score;
  }

  if (validation.optimization_score != null) {
    return validation.optimization_score;
  }

  return validation.completeness_score ?? null;
}

export function getProfileStrengthLabel(percent: number): string {
  if (percent >= 85) return 'Well optimized';
  if (percent >= 65) return 'Good — room to grow';
  if (percent >= 40) return 'Needs work';
  return 'Needs improvement';
}

/** Label for header / hub — differs from score bands when profile is incomplete. */
export function getProfileStrengthDisplayLabel(
  validation: LinkedInProfileValidation | null | undefined,
  percent: number | null
): string {
  if (!validation?.is_profile_complete) {
    return 'Complete profile first';
  }
  if (percent == null) {
    return '';
  }
  return getProfileStrengthLabel(percent);
}

/** Map 0–100 score to filled segment count (default 7 segments). */
export function getProfileStrengthSegmentFillCount(
  percent: number,
  segments = 7
): number {
  const clamped = Math.max(0, Math.min(100, percent));
  return Math.max(0, Math.min(segments, Math.round((clamped / 100) * segments)));
}

export function getProfileStrengthTooltip(
  validation: LinkedInProfileValidation | null | undefined
): string {
  if (!validation) {
    return 'Connect LinkedIn to see your profile strength score.';
  }
  if (!validation.is_profile_complete) {
    return 'Complete required profile fields to unlock your optimization score.';
  }
  if (validation.score_basis === 'rubric' || validation.score_basis === 'rubric_with_progress') {
    const gaps = validation.optimization_gaps_count ?? 0;
    const progressNote =
      validation.score_basis === 'rubric_with_progress'
        ? ' Includes credit for optimization tasks you have completed.'
        : '';
    return gaps > 0
      ? `Based on LinkedIn best practices (${gaps} improvement area${gaps === 1 ? '' : 's'} detected).${progressNote}`
      : `Your profile meets LinkedIn best-practice checks.${progressNote}`;
  }
  return 'Profile completeness score.';
}
