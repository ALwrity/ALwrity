import { describe, expect, it } from 'vitest';
import { mapFinalStepOnboardingData } from './finalStepDataMapper';

describe('mapFinalStepOnboardingData', () => {
  it('maps onboarding data from API responses only', () => {
    const result = mapFinalStepOnboardingData({
      summary: {
        website_url: 'https://acme.com',
        style_analysis: { tone: 'professional' },
        research_preferences: { research_depth: 'deep' },
        personalization_settings: { writing_style: 'professional' },
        persona_readiness: { ready: true, reason: 'All required data available' },
        configuration_and_capabilities: {
          configuration_details: { cms: 'wordpress' },
        },
        canonical_profile: { brand: 'Acme' },
      },
      websiteAnalysis: {
        website_url: 'https://acme.com',
        style_analysis: { tone: 'professional' },
      },
      researchPreferences: { research_depth: 'deep', content_types: ['blog'] },
    });

    expect(result.errors).toHaveLength(0);
    expect(result.data.websiteUrl).toBe('https://acme.com');
    expect(result.data.styleAnalysis).toEqual({ tone: 'professional' });
    expect(result.data.researchPreferences).toEqual({
      research_depth: 'deep',
      content_types: ['blog'],
    });
    expect(result.data.personaReadiness?.isReady).toBe(true);
    expect(result.data.canonicalProfile).toEqual({ brand: 'Acme' });
  });

  it('does not fabricate website data when APIs return empty website analysis', () => {
    const result = mapFinalStepOnboardingData({
      summary: {
        website_url: null,
        style_analysis: null,
        research_preferences: {},
        personalization_settings: {},
      },
      websiteAnalysis: {},
      researchPreferences: null,
    });

    expect(result.data.websiteUrl).toBeUndefined();
    expect(result.data.styleAnalysis).toBeUndefined();
    expect(result.errors.some((e) => e.code === 'website_analysis_missing')).toBe(true);
  });

  it('uses summary research preferences when dedicated endpoint returns empty', () => {
    const result = mapFinalStepOnboardingData({
      summary: {
        research_preferences: { research_depth: 'standard' },
        personalization_settings: { writing_style: 'casual' },
      },
      websiteAnalysis: { website_url: 'https://acme.com' },
      researchPreferences: null,
    });

    expect(result.data.researchPreferences).toEqual({ research_depth: 'standard' });
    expect(result.errors.some((e) => e.code === 'research_preferences_missing')).toBe(false);
  });

  it('maps LinkedIn integrations from summary configuration details', () => {
    const result = mapFinalStepOnboardingData(
      {
        summary: {
          research_preferences: { growth_summary: 'Build authority' },
          personalization_settings: { persona: { persona_name: 'Founder' } },
          configuration_and_capabilities: {
            configuration_details: {
              postingCadence: '3x/week',
              preferredFormats: ['text'],
            },
          },
        },
        websiteAnalysis: {},
        researchPreferences: { growth_summary: 'Build authority' },
      },
      'linkedin'
    );

    expect(result.data.integrations).toEqual({
      postingCadence: '3x/week',
      preferredFormats: ['text'],
    });
    expect(result.errors.some((e) => e.code === 'website_analysis_missing')).toBe(false);
  });
});
