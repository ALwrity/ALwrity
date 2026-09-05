import { describe, it, expect } from 'vitest';
import {
  STEP0_NAV_TITLE,
  WEBSITE_STEP_HEADER_BASE_TOP_SPACING,
  WEBSITE_STEP_HEADER_TOP_MARGIN,
} from '../websiteStepLayout';

describe('websiteStepLayout', () => {
  it('defines step 0 navigation title', () => {
    expect(STEP0_NAV_TITLE).toBe('Build Your Brand Engine');
  });

  it('adds 40% extra spacing above the website step header', () => {
    expect(WEBSITE_STEP_HEADER_TOP_MARGIN.xs).toBeCloseTo(
      WEBSITE_STEP_HEADER_BASE_TOP_SPACING.xs * 0.4
    );
    expect(WEBSITE_STEP_HEADER_TOP_MARGIN.md).toBeCloseTo(
      WEBSITE_STEP_HEADER_BASE_TOP_SPACING.md * 0.4
    );
  });
});
