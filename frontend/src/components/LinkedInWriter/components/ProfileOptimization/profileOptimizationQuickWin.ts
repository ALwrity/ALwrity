import type { LinkedInProfileOptimizationItem } from "../../../../api/linkedinSocial";

const IMPACT_RANK: Record<string, number> = { High: 0, Medium: 1, Low: 2 };
const EFFORT_RANK: Record<string, number> = { Low: 0, Medium: 1, High: 2 };

function computePriorityScore(item: LinkedInProfileOptimizationItem): number {
  const impactScore = IMPACT_RANK[item.impact] ?? 99;
  const effortScore = EFFORT_RANK[item.effort] ?? 99;
  return impactScore * 10 + effortScore;
}

export function findProfileOptimizationQuickWin(
  items: LinkedInProfileOptimizationItem[] | null | undefined,
): LinkedInProfileOptimizationItem | null {
  if (!items?.length) return null;
  return (
    items.find((item) => item.impact === "High" && item.effort === "Low") ??
    items.find((item) => item.impact === "High" && item.effort === "Medium") ??
    items.find((item) => item.impact === "Medium" && item.effort === "Low") ??
    [...items].sort(
      (a, b) => computePriorityScore(a) - computePriorityScore(b),
    )[0] ??
    null
  );
}
