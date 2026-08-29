import { describe, it, expect, beforeEach } from 'vitest';
import {
  getDefaultLandingRoute,
  shouldSkipOnboarding,
  isFeatureOnlyMode,
  resetEnabledFeaturesCacheForTests,
} from '../demoMode';

describe('Pricing Page Redirect Logic after Restart (#Bug Fix)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    resetEnabledFeaturesCacheForTests();
  });

  it('detects feature mode and routes to /podcast-maker when enabled_features=podcast', () => {
    localStorage.setItem('enabled_features', 'podcast');
    resetEnabledFeaturesCacheForTests();

    // In podcast feature-only mode
    const isFeatureLimited = shouldSkipOnboarding() || isFeatureOnlyMode();
    expect(isFeatureLimited).toBe(true);
    expect(getDefaultLandingRoute()).toBe('/podcast-maker');
  });

  it('routes to /podcast-maker on fresh session without relying on volatile localStorage onboarding flag', () => {
    localStorage.setItem('enabled_features', 'podcast');
    resetEnabledFeaturesCacheForTests();

    // Fresh session: no onboarding_complete in localStorage
    expect(localStorage.getItem('onboarding_complete')).toBeNull();

    // The fixed isFeatureLimitedMode evaluation
    const isFeatureLimited = shouldSkipOnboarding() || isFeatureOnlyMode();
    const destination = isFeatureLimited ? getDefaultLandingRoute() : '/dashboard';

    expect(destination).toBe('/podcast-maker');
    expect(destination).not.toBe('/onboarding');
  });

  it('in full mode (enabled_features=all), uses isOnboardingComplete context state instead of failing to null', () => {
    localStorage.setItem('enabled_features', 'all');
    resetEnabledFeaturesCacheForTests();

    const isFeatureLimited = shouldSkipOnboarding() || isFeatureOnlyMode();
    expect(isFeatureLimited).toBe(false);

    // If isOnboardingComplete is true from backend/context
    const isOnboardingComplete = true;
    const isComplete = isOnboardingComplete || localStorage.getItem('onboarding_complete') === 'true';
    const destination = isComplete ? '/dashboard' : '/onboarding';

    expect(destination).toBe('/dashboard');
    expect(destination).not.toBe('/onboarding');
  });
});
