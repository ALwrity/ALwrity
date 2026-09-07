export interface ReviewGateResult {
  canProceed: boolean;
  unreviewed: string[];
}

export const canProceedWithCreation = (
  reviewedCategories: Set<string> | string[],
  canonicalCategories: readonly string[],
): ReviewGateResult => {
  const reviewed = reviewedCategories instanceof Set
    ? reviewedCategories
    : new Set(reviewedCategories);
  const unreviewed = canonicalCategories.filter(category => !reviewed.has(category));
  return { canProceed: unreviewed.length === 0, unreviewed };
};