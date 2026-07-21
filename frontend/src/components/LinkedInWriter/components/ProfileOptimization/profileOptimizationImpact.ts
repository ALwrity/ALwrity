import type { LinkedInProfileOptimizationItem } from '../../../../api/linkedinSocial';

const IMPACT_STRENGTH_POINTS: Record<string, number> = {
  High: 6,
  Medium: 3,
  Low: 1,
};

export interface ProfileOptimizationImpactProjection {
  currentPercent: number;
  projectedPercent: number;
  gainPoints: number;
  highImpactCount: number;
}

/** Estimated profile strength lift if the active batch suggestions are applied. */
export function computeBatchImpactProjection(
  currentPercent: number | null | undefined,
  items: LinkedInProfileOptimizationItem[]
): ProfileOptimizationImpactProjection {
  const currentPercentClamped = Math.round(
    Math.max(0, Math.min(100, currentPercent ?? 0))
  );
  const rawGain = items.reduce(
    (sum, item) => sum + (IMPACT_STRENGTH_POINTS[item.impact] ?? 0),
    0
  );
  const projectedPercent = Math.min(100, currentPercentClamped + rawGain);
  const gainPoints = projectedPercent - currentPercentClamped;
  const highImpactCount = items.filter((item) => item.impact === 'High').length;

  return {
    currentPercent: currentPercentClamped,
    projectedPercent,
    gainPoints,
    highImpactCount,
  };
}
