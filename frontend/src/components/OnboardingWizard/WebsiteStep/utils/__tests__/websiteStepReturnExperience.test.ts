import { describe, it, expect } from 'vitest';
import {
  ALL_FOLDER_TABS_VIEWED,
  resolveViewedTabsForReturn,
  shouldShowDashboardFirst,
} from '../websiteStepReturnExperience';

describe('websiteStepReturnExperience', () => {
  it('shows dashboard-first layout when analysis exists', () => {
    expect(shouldShowDashboardFirst(true)).toBe(true);
    expect(shouldShowDashboardFirst(false)).toBe(false);
  });

  it('unlocks all folder tabs when Connect step is completed', () => {
    expect(
      resolveViewedTabsForReturn(true, { 0: true, 1: false, 2: false })
    ).toEqual(ALL_FOLDER_TABS_VIEWED);
  });

  it('preserves tab progress when Connect step is not yet completed', () => {
    const partial = { 0: true, 1: false, 2: false };
    expect(resolveViewedTabsForReturn(false, partial)).toEqual(partial);
  });
});
