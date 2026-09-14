import { describe, it, expect } from 'vitest';
import {
  ONBOARDING_STEP_CONTENT_PADDING_X,
  WIZARD_CHROME_BAR_PADDING,
  WIZARD_CHROME_BAR_SX,
} from '../wizardChromeLayout';

describe('wizardChromeLayout', () => {
  it('uses matching padding for header and footer chrome bars', () => {
    expect(WIZARD_CHROME_BAR_SX.px).toEqual(WIZARD_CHROME_BAR_PADDING);
    expect(WIZARD_CHROME_BAR_SX.py).toEqual(WIZARD_CHROME_BAR_PADDING);
  });

  it('defines responsive min heights for chrome bars', () => {
    expect(WIZARD_CHROME_BAR_SX.minHeight.xs).toBe(56);
    expect(WIZARD_CHROME_BAR_SX.minHeight.md).toBe(72);
  });

  it('uses balanced horizontal padding for step content below the progress bar', () => {
    expect(ONBOARDING_STEP_CONTENT_PADDING_X.xs).toBeGreaterThanOrEqual(1);
    expect(ONBOARDING_STEP_CONTENT_PADDING_X.md).toBeGreaterThanOrEqual(1.5);
  });
});
