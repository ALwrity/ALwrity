export const ALL_FOLDER_TABS_VIEWED: Record<number, boolean> = {
  0: true,
  1: true,
  2: true,
};

export function shouldShowDashboardFirst(hasAnalysis: boolean): boolean {
  return hasAnalysis;
}

/**
 * When Connect Platforms (step 1) is officially complete, unlock all folder tabs
 * so returning users can navigate freely without re-exploring.
 */
export function resolveViewedTabsForReturn(
  isConnectStepCompleted: boolean,
  currentViewedTabs: Record<number, boolean>
): Record<number, boolean> {
  if (isConnectStepCompleted) {
    return ALL_FOLDER_TABS_VIEWED;
  }
  return currentViewedTabs;
}
