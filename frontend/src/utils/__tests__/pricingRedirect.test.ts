import { describe, it, expect, beforeEach } from 'vitest';
import {
  getDefaultLandingRoute,
  shouldSkipOnboarding,
  isFeatureOnlyMode,
  isPodcastOnlyDemoMode,
  resetEnabledFeaturesCacheForTests,
} from '../demoMode';

describe('Pricing Page Redirect Logic & Feature Gating (#Bug Fix)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    resetEnabledFeaturesCacheForTests();
  });

  describe('Podcast-Only Feature Mode (ALWRITY_ENABLED_FEATURES=podcast)', () => {
    beforeEach(() => {
      localStorage.setItem('enabled_features', 'podcast');
      resetEnabledFeaturesCacheForTests();
    });

    it('identifies podcast-only mode correctly', () => {
      expect(shouldSkipOnboarding()).toBe(true);
      expect(isFeatureOnlyMode()).toBe(true);
      expect(isPodcastOnlyDemoMode()).toBe(true);
      expect(getDefaultLandingRoute()).toBe('/podcast-maker');
    });

    it('routes to /podcast-maker when onboarding is incomplete (never lands on /onboarding)', () => {
      const isOnboardingComplete = false;
      const isFeatureLimited = shouldSkipOnboarding() || isFeatureOnlyMode() || isPodcastOnlyDemoMode();
      expect(isFeatureLimited).toBe(true);

      const destination = isFeatureLimited
        ? getDefaultLandingRoute()
        : isOnboardingComplete
          ? '/dashboard'
          : '/onboarding';

      expect(destination).toBe('/podcast-maker');
      expect(destination).not.toBe('/onboarding');
    });

    it('routes to /podcast-maker on fresh session with empty localStorage', () => {
      expect(localStorage.getItem('onboarding_complete')).toBeNull();

      const isFeatureLimited = shouldSkipOnboarding() || isFeatureOnlyMode() || isPodcastOnlyDemoMode();
      const destination = isFeatureLimited ? getDefaultLandingRoute() : '/dashboard';

      expect(destination).toBe('/podcast-maker');
      expect(destination).not.toBe('/onboarding');
    });

    it('blocks direct /onboarding route access and signals redirect to /podcast-maker', () => {
      const shouldRedirect = shouldSkipOnboarding();
      expect(shouldRedirect).toBe(true);
      expect(getDefaultLandingRoute()).toBe('/podcast-maker');
    });
  });

  describe('Full Platform Mode (ALWRITY_ENABLED_FEATURES=all)', () => {
    beforeEach(() => {
      localStorage.setItem('enabled_features', 'all');
      resetEnabledFeaturesCacheForTests();
    });

    it('identifies full platform mode correctly', () => {
      expect(shouldSkipOnboarding()).toBe(false);
      expect(isFeatureOnlyMode()).toBe(false);
      expect(isPodcastOnlyDemoMode()).toBe(false);
      expect(getDefaultLandingRoute()).toBe('/dashboard');
    });

    it('CASE: full mode + onboarding complete -> routes to /dashboard', () => {
      const isOnboardingComplete = true;
      const isFeatureLimited = shouldSkipOnboarding() || isFeatureOnlyMode() || isPodcastOnlyDemoMode();
      expect(isFeatureLimited).toBe(false);

      const isComplete = isOnboardingComplete || localStorage.getItem('onboarding_complete') === 'true';
      const destination = isFeatureLimited
        ? getDefaultLandingRoute()
        : isComplete
          ? '/dashboard'
          : '/onboarding';

      expect(destination).toBe('/dashboard');
    });

    it('CASE: full mode + onboarding incomplete -> routes to /onboarding', () => {
      const isOnboardingComplete = false;
      const isFeatureLimited = shouldSkipOnboarding() || isFeatureOnlyMode() || isPodcastOnlyDemoMode();
      expect(isFeatureLimited).toBe(false);

      const isComplete = isOnboardingComplete || localStorage.getItem('onboarding_complete') === 'true';
      const destination = isFeatureLimited
        ? getDefaultLandingRoute()
        : isComplete
          ? '/dashboard'
          : '/onboarding';

      expect(destination).toBe('/onboarding');
    });
  });
});

