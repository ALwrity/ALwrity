/**
 * Consolidated website session change actions for onboarding Connect step.
 * Single entry point for start-fresh / re-analyze / reset-related local clears.
 */

import {
  clearDownstreamForWebsiteChange,
  ONBOARDING_STORAGE_KEYS,
} from '../common/onboardingStorageKeys';
import {
  clearOnboardingWizardLocalState,
  shouldNotifyWebsiteAnalysisChanged,
  type WebsiteAnalysisChangeReason,
} from './onboardingWebsiteReset';

export type { WebsiteAnalysisChangeReason };

export function resetWebsiteInputForStartFresh(): void {
  console.log('[onboarding:session-change] Resetting website input for start fresh');
  clearDownstreamForWebsiteChange({ preserveActiveStep: true });
  try {
    localStorage.removeItem(ONBOARDING_STORAGE_KEYS.websiteUrl);
    localStorage.removeItem(ONBOARDING_STORAGE_KEYS.websiteAnalysisData);
  } catch (err) {
    console.warn('[onboarding:session-change] Failed to clear website storage on start fresh:', err);
  }
}

export function resetOnboardingWizardSession(reason: string): void {
  clearOnboardingWizardLocalState(reason);
}

export function resolveWebsiteAnalysisWizardNotify(params: {
  reason: WebsiteAnalysisChangeReason;
  didInvalidateDownstream: boolean;
}): boolean {
  return shouldNotifyWebsiteAnalysisChanged(params);
}
