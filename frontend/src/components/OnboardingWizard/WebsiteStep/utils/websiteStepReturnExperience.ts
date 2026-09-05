import { hasWebsiteChangedFromCommitted } from '../../utils/onboardingWebsiteReset';

export const ALL_FOLDER_TABS_VIEWED: Record<number, boolean> = {
  0: true,
  1: true,
  2: true,
};

export function shouldShowDashboardFirst(hasAnalysis: boolean): boolean {
  return hasAnalysis;
}

/**
 * Folder tabs are fully unlocked when Connect Platforms is officially complete
 * (Wizard already accounts for downstream re-analyse lock via isConnectStepCompleted).
 * URL mismatch only blocks when the user has typed a different site without re-committing.
 */
export function isConnectStepFullyUnlocked(
  isConnectStepCompleted: boolean,
  currentWebsiteUrl: string
): boolean {
  if (!isConnectStepCompleted) return false;
  if (hasWebsiteChangedFromCommitted(currentWebsiteUrl)) return false;
  return true;
}

export function resolveViewedTabsForReturn(
  isConnectStepCompleted: boolean,
  currentViewedTabs: Record<number, boolean>,
  currentWebsiteUrl = ''
): Record<number, boolean> {
  if (isConnectStepFullyUnlocked(isConnectStepCompleted, currentWebsiteUrl)) {
    return ALL_FOLDER_TABS_VIEWED;
  }
  return currentViewedTabs;
}

/** Continue button + footer validation for Connect Platforms step. */
export function isWebsiteStepValidForContinue(params: {
  isConnectStepCompleted: boolean;
  website: string;
  analysis: unknown;
  allTabsViewed: boolean;
  linkedinConnected: boolean;
}): boolean {
  const hasWebsiteAnalysis = !!(params.website.trim() && params.analysis);

  if (params.isConnectStepCompleted) {
    return hasWebsiteAnalysis || params.linkedinConnected;
  }

  return (hasWebsiteAnalysis && params.allTabsViewed) || params.linkedinConnected;
}

export function shouldShowFolderTabExploreHint(viewedTabs: Record<number, boolean>): boolean {
  return !(viewedTabs[0] && viewedTabs[1] && viewedTabs[2]);
}
