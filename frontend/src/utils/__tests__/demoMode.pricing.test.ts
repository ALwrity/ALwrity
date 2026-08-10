import {
  getPricingRoute,
  getDefaultLandingRoute,
  isPricingPath,
  MAIN_PRICING_ROUTE,
  LINKEDIN_PRICING_ROUTE,
  resetEnabledFeaturesCacheForTests,
} from '../demoMode';

describe('demoMode pricing routes', () => {
  const originalEnv = process.env.REACT_APP_ENABLED_FEATURES;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.REACT_APP_ENABLED_FEATURES;
    } else {
      process.env.REACT_APP_ENABLED_FEATURES = originalEnv;
    }
    resetEnabledFeaturesCacheForTests();
    localStorage.clear();
  });

  it('returns main pricing route when all features are enabled', () => {
    process.env.REACT_APP_ENABLED_FEATURES = 'all';
    resetEnabledFeaturesCacheForTests();

    expect(getPricingRoute()).toBe(MAIN_PRICING_ROUTE);
  });

  it('returns LinkedIn pricing route in linkedin-only mode', () => {
    process.env.REACT_APP_ENABLED_FEATURES = 'linkedin';
    resetEnabledFeaturesCacheForTests();

    expect(getPricingRoute()).toBe(LINKEDIN_PRICING_ROUTE);
  });

  it('returns main pricing route for non-linkedin feature-only modes', () => {
    process.env.REACT_APP_ENABLED_FEATURES = 'youtube';
    resetEnabledFeaturesCacheForTests();

    expect(getPricingRoute()).toBe(MAIN_PRICING_ROUTE);
  });

  it('returns youtube creator as default landing route in youtube-only mode', () => {
    process.env.REACT_APP_ENABLED_FEATURES = 'youtube';
    resetEnabledFeaturesCacheForTests();

    expect(getDefaultLandingRoute()).toBe('/youtube-creator');
  });

  it('detects both main and LinkedIn pricing paths', () => {
    expect(isPricingPath('/pricing')).toBe(true);
    expect(isPricingPath('/linkedin-studio/pricing')).toBe(true);
    expect(isPricingPath('/linkedin-studio')).toBe(false);
    expect(isPricingPath('/dashboard')).toBe(false);
  });
});
