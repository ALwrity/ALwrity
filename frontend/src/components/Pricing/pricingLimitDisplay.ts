import type { LimitFields, PlanTier } from './pricingGridConfig';

type ZeroMeans = 'disabled' | 'unlimited' | 'limited';

export function formatLimitCell(
  limits: LimitFields,
  field: keyof LimitFields,
  tier: PlanTier,
  isCost = false
): string {
  if (field === '_zero_means') return '—';

  const value = Number(limits[field] ?? 0);
  const zeroMeans = limits._zero_means?.[field as string] as ZeroMeans | undefined;

  if (isCost) {
    return `$${value}`;
  }

  if (zeroMeans === 'unlimited' || (tier === 'enterprise' && field !== 'monthly_cost' && value === 0)) {
    return 'Unlimited';
  }

  if (value === 0 && zeroMeans === 'disabled') {
    return '—';
  }

  if (value > 0) {
    return `${value} / month`;
  }

  return '—';
}
