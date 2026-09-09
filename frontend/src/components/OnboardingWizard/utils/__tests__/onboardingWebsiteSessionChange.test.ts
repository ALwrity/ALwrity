import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  resetOnboardingWizardSession,
  resetWebsiteInputForStartFresh,
  resolveWebsiteAnalysisWizardNotify,
} from '../onboardingWebsiteSessionChange';
import {
  ONBOARDING_STEP1_WEBSITE_KEY,
  setCommittedStep1WebsiteUrl,
} from '../onboardingWebsiteReset';
import { ONBOARDING_STORAGE_KEYS } from '../../common/onboardingStorageKeys';

describe('onboardingWebsiteSessionChange', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('resetOnboardingWizardSession clears committed connect step URL', () => {
    localStorage.setItem(ONBOARDING_STEP1_WEBSITE_KEY, 'brand-a.com');
    resetOnboardingWizardSession('test');
    expect(localStorage.getItem(ONBOARDING_STEP1_WEBSITE_KEY)).toBeNull();
  });

  it('resetWebsiteInputForStartFresh clears live website storage only', () => {
    localStorage.setItem(ONBOARDING_STORAGE_KEYS.websiteUrl, 'https://a.com');
    localStorage.setItem(ONBOARDING_STORAGE_KEYS.websiteAnalysisData, '{}');
    localStorage.setItem(ONBOARDING_STEP1_WEBSITE_KEY, 'brand-a.com');

    resetWebsiteInputForStartFresh();

    expect(localStorage.getItem(ONBOARDING_STORAGE_KEYS.websiteUrl)).toBeNull();
    expect(localStorage.getItem(ONBOARDING_STORAGE_KEYS.websiteAnalysisData)).toBeNull();
    expect(localStorage.getItem(ONBOARDING_STEP1_WEBSITE_KEY)).toBe('brand-a.com');
  });

  it('resolveWebsiteAnalysisWizardNotify delegates to SSOT rules', () => {
    expect(
      resolveWebsiteAnalysisWizardNotify({
        reason: 'new_website',
        didInvalidateDownstream: false,
      })
    ).toBe(false);

    setCommittedStep1WebsiteUrl('https://brand-a.com');
    expect(
      resolveWebsiteAnalysisWizardNotify({
        reason: 'reanalyze',
        didInvalidateDownstream: false,
      })
    ).toBe(true);
  });
});
