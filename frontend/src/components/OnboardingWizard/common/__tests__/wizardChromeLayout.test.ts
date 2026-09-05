import { describe, it, expect } from 'vitest';
import { WIZARD_CHROME_BAR_PADDING, WIZARD_CHROME_BAR_SX } from '../wizardChromeLayout';

describe('wizardChromeLayout', () => {
  it('uses matching padding for header and footer chrome bars', () => {
    expect(WIZARD_CHROME_BAR_SX.px).toEqual(WIZARD_CHROME_BAR_PADDING);
    expect(WIZARD_CHROME_BAR_SX.py).toEqual(WIZARD_CHROME_BAR_PADDING);
  });

  it('defines responsive min heights for chrome bars', () => {
    expect(WIZARD_CHROME_BAR_SX.minHeight.xs).toBe(56);
    expect(WIZARD_CHROME_BAR_SX.minHeight.md).toBe(72);
  });
});
