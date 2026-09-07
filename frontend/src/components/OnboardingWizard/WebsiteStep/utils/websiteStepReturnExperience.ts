import { hasWebsiteChangedFromCommitted } from '../../utils/onboardingWebsiteReset';

export const ALL_FOLDER_TABS_VIEWED: Record<number, boolean> = {
  0: true,
  1: true,
  2: true,
};

export function shouldShowDashboardFirst(hasAnalysis: boolean): boolean {
  return hasAnalysis;
}

export interface ConnectStepPresentation {
  showWhereShouldIBegin: boolean;
  dashboardFirstMode: boolean;
  showInlineUrlBar: boolean;
  showUrlHoverPanel: boolean;
  showDashboardLoadingShell: boolean;
}

/**
 * Resolve Connect step layout to avoid start-fresh re-hydration flashes and
 * returning-user "Where should I begin?" flicker while analysis loads.
 */
export function resolveConnectStepPresentation(params: {
  hasWebsiteAnalysis: boolean;
  isConnectStepCompleted: boolean;
  isStartFreshSession: boolean;
  isHydratingAnalysis: boolean;
}): ConnectStepPresentation {
  const {
    hasWebsiteAnalysis,
    isConnectStepCompleted,
    isStartFreshSession,
    isHydratingAnalysis,
  } = params;

  if (isStartFreshSession) {
    return {
      showWhereShouldIBegin: true,
      dashboardFirstMode: false,
      showInlineUrlBar: true,
      showUrlHoverPanel: false,
      showDashboardLoadingShell: false,
    };
  }

  if (hasWebsiteAnalysis) {
    return {
      showWhereShouldIBegin: false,
      dashboardFirstMode: true,
      showInlineUrlBar: false,
      showUrlHoverPanel: true,
      showDashboardLoadingShell: false,
    };
  }

  if (isConnectStepCompleted) {
    const stillLoading = isHydratingAnalysis;
    return {
      showWhereShouldIBegin: false,
      dashboardFirstMode: true,
      showInlineUrlBar: !stillLoading,
      showUrlHoverPanel: false,
      showDashboardLoadingShell: stillLoading,
    };
  }

  return {
    showWhereShouldIBegin: true,
    dashboardFirstMode: false,
    showInlineUrlBar: true,
    showUrlHoverPanel: false,
    showDashboardLoadingShell: false,
  };
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
