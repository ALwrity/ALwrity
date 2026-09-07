import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  ALL_FOLDER_TABS_VIEWED,
  isConnectStepFullyUnlocked,
  isWebsiteStepValidForContinue,
  resolveConnectStepPresentation,
  resolveViewedTabsForReturn,
  shouldShowFolderTabExploreHint,
} from '../websiteStepReturnExperience';

describe('websiteStepReturnExperience', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('unlocks folder tabs when connect step is officially completed', () => {
    localStorage.setItem('onboarding_step1_website_url', 'brand-a.com');

    expect(isConnectStepFullyUnlocked(true, 'https://www.brand-a.com')).toBe(true);
    expect(isConnectStepFullyUnlocked(true, 'https://brand-b.com')).toBe(false);
    expect(isConnectStepFullyUnlocked(false, 'https://brand-a.com')).toBe(false);
  });

  it('does not re-lock returning users from stale localStorage dirty flag alone', () => {
    localStorage.setItem('onboarding_step1_website_url', 'brand-a.com');
    localStorage.setItem('onboarding_downstream_dirty', 'true');

    expect(isConnectStepFullyUnlocked(true, 'https://brand-a.com')).toBe(true);
  });

  it('returns all viewed tabs for fully unlocked returning users', () => {
    localStorage.setItem('onboarding_step1_website_url', 'brand-a.com');
    expect(
      resolveViewedTabsForReturn(true, { 0: true, 1: false, 2: false }, 'https://brand-a.com')
    ).toEqual(ALL_FOLDER_TABS_VIEWED);
  });

  it('skips folder-tab gating for continue when connect step is already completed', () => {
    expect(
      isWebsiteStepValidForContinue({
        isConnectStepCompleted: true,
        website: 'https://brand-a.com',
        analysis: { id: 1 },
        allTabsViewed: false,
        linkedinConnected: false,
      })
    ).toBe(true);
  });

  it('requires all folder tabs before first-time connect step completion', () => {
    expect(
      isWebsiteStepValidForContinue({
        isConnectStepCompleted: false,
        website: 'https://brand-a.com',
        analysis: { id: 1 },
        allTabsViewed: false,
        linkedinConnected: false,
      })
    ).toBe(false);

    expect(
      isWebsiteStepValidForContinue({
        isConnectStepCompleted: false,
        website: 'https://brand-a.com',
        analysis: { id: 1 },
        allTabsViewed: true,
        linkedinConnected: false,
      })
    ).toBe(true);
  });

  it('hides explore hint when all folder tabs are marked viewed', () => {
    expect(shouldShowFolderTabExploreHint({ 0: true, 1: true, 2: true })).toBe(false);
    expect(shouldShowFolderTabExploreHint({ 0: true, 1: false, 2: false })).toBe(true);
  });

  it('shows URL input during start-fresh session', () => {
    expect(
      resolveConnectStepPresentation({
        hasWebsiteAnalysis: false,
        isConnectStepCompleted: true,
        isStartFreshSession: true,
        isHydratingAnalysis: false,
      })
    ).toEqual({
      showWhereShouldIBegin: true,
      dashboardFirstMode: false,
      showInlineUrlBar: true,
      showUrlHoverPanel: false,
      showDashboardLoadingShell: false,
    });
  });

  it('hides Where should I begin while returning user hydrates analysis', () => {
    expect(
      resolveConnectStepPresentation({
        hasWebsiteAnalysis: false,
        isConnectStepCompleted: true,
        isStartFreshSession: false,
        isHydratingAnalysis: true,
      })
    ).toMatchObject({
      showWhereShouldIBegin: false,
      dashboardFirstMode: true,
      showDashboardLoadingShell: true,
      showUrlHoverPanel: false,
    });
  });

  it('uses dashboard-first layout with hover URL panel when analysis exists', () => {
    expect(
      resolveConnectStepPresentation({
        hasWebsiteAnalysis: true,
        isConnectStepCompleted: true,
        isStartFreshSession: false,
        isHydratingAnalysis: false,
      })
    ).toMatchObject({
      showWhereShouldIBegin: false,
      dashboardFirstMode: true,
      showInlineUrlBar: false,
      showUrlHoverPanel: true,
    });
  });
});
