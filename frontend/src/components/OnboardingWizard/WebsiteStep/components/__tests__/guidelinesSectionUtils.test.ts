import { describe, it, expect } from 'vitest';
import { hasArrayContent, hasRenderableGuidelines } from '../guidelinesSectionUtils';

describe('guidelinesSectionUtils', () => {
  it('hasArrayContent returns false for empty arrays', () => {
    expect(hasArrayContent([])).toBe(false);
    expect(hasArrayContent(undefined)).toBe(false);
  });

  it('hasRenderableGuidelines detects populated guideline arrays', () => {
    expect(
      hasRenderableGuidelines({
        brand_alignment: ['Align with core values'],
      })
    ).toBe(true);
  });

  it('hasRenderableGuidelines returns false when all fields are empty', () => {
    expect(
      hasRenderableGuidelines({
        brand_alignment: [],
        conversion_optimization: [],
      })
    ).toBe(false);
  });
});
