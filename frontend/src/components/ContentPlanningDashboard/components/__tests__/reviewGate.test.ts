/**
 * A2 (#40 inverted review gate): creation must be BLOCKED until all canonical
 * categories are reviewed. The pure gate helper keeps the rule testable
 * without a DOM renderer.
 */
import { describe, it, expect } from 'vitest';
import { canProceedWithCreation } from '../ContentStrategyBuilder/utils/reviewGate';

const CANONICAL_CATEGORIES = [
  'business_context',
  'audience_intelligence',
  'competitive_intelligence',
  'content_strategy',
  'performance_analytics',
];

describe('canProceedWithCreation — A2 review gate', () => {
  it('blocks when zero categories are reviewed and lists all as unreviewed', () => {
    const result = canProceedWithCreation([], CANONICAL_CATEGORIES);
    expect(result.canProceed).toBe(false);
    expect(result.unreviewed).toEqual(CANONICAL_CATEGORIES);
  });

  it('blocks when only 4 of 5 categories are reviewed', () => {
    const reviewed = CANONICAL_CATEGORIES.slice(0, 4);
    const result = canProceedWithCreation(reviewed, CANONICAL_CATEGORIES);
    expect(result.canProceed).toBe(false);
    expect(result.unreviewed).toEqual(['performance_analytics']);
  });

  it('allows when all 5 canonical categories are reviewed', () => {
    const result = canProceedWithCreation(CANONICAL_CATEGORIES, CANONICAL_CATEGORIES);
    expect(result.canProceed).toBe(true);
    expect(result.unreviewed).toEqual([]);
  });

  it('accepts a Set of reviewed categories', () => {
    const result = canProceedWithCreation(
      new Set(CANONICAL_CATEGORIES),
      CANONICAL_CATEGORIES,
    );
    expect(result.canProceed).toBe(true);
  });
});