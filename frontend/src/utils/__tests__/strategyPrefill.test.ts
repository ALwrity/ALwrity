import { describe, it, expect } from 'vitest';
import { strategyPrefill, mapOnboardingToStrategy } from '../strategyPrefill';
import type { OnboardingData, StrategyPrefillInput } from '../strategyPrefill';

function createOnboardingData(overrides: Partial<OnboardingData> = {}): OnboardingData {
  return {
    persona: {
      target_audience: 'marketing professionals',
      writing_style: 'professional',
      industry: 'SaaS',
      business_size: 'mid-market',
      goals: ['increase traffic', 'generate leads'],
      ...overrides.persona,
    },
    website_analysis: {
      brand_analysis: {
        business_type: 'saas',
        industry: 'technology',
        company_stage: 'growth',
        ...overrides.website_analysis?.brand_analysis,
      },
      performance_metrics: {
        monthly_visitors: 50000,
        conversion_rate: 2.5,
        ...overrides.website_analysis?.performance_metrics,
      },
      ...overrides.website_analysis,
    },
    seo_audit: {
      keywords: ['AI marketing', 'content strategy', 'automation'],
      traffic_potential: 100000,
      competition_level: 'medium',
      ...overrides.seo_audit,
    },
    competitor_analysis: {
      competitors: [
        { name: 'Competitor A', strengths: ['SEO', 'Content'], weaknesses: ['Pricing'] },
        { name: 'Competitor B', strengths: ['Brand'], weaknesses: ['Support'] },
      ],
      ...overrides.competitor_analysis,
    },
    ...overrides,
  };
}

function createStrategyInput(overrides: Partial<StrategyPrefillInput> = {}): StrategyPrefillInput {
  return {
    fromOnboarding: false,
    quickInputs: {
      primary_goal: 'traffic',
      budget_range: 'medium',
      timeline: '12 months',
    },
    ...overrides,
  };
}

describe('strategyPrefill', () => {
  describe('mapOnboardingToStrategy', () => {
    it('maps persona to strategy fields', () => {
      const onboardingData = createOnboardingData();
      const result = mapOnboardingToStrategy(onboardingData);

      expect(result.business_type).toBe('saas');
      expect(result.target_audience).toBe('marketing professionals');
      expect(result.industry).toBe('technology');
    });

    it('maps website analysis brand data', () => {
      const onboardingData = createOnboardingData({
        website_analysis: {
          brand_analysis: {
            business_type: 'ecommerce',
            industry: 'retail',
            company_stage: 'startup',
          },
          performance_metrics: { monthly_visitors: 10000, conversion_rate: 1.5 },
        },
      });
      const result = mapOnboardingToStrategy(onboardingData);

      expect(result.business_type).toBe('ecommerce');
      expect(result.industry).toBe('retail');
    });

    it('maps SEO audit keywords to content pillars', () => {
      const onboardingData = createOnboardingData({
        seo_audit: {
          keywords: ['AI tools', 'automation', 'marketing automation'],
          traffic_potential: 50000,
          competition_level: 'low',
        },
      });
      const result = mapOnboardingToStrategy(onboardingData);

      expect(result.content_pillars).toContain('AI tools');
      expect(result.content_pillars).toContain('automation');
    });

    it('maps competitor analysis', () => {
      const onboardingData = createOnboardingData({
        competitor_analysis: {
          competitors: [
            { name: 'HubSpot', strengths: ['Marketing'], weaknesses: ['Price'] },
          ],
        },
      });
      const result = mapOnboardingToStrategy(onboardingData);

      expect(result.competitors).toHaveLength(1);
      expect(result.competitors[0]).toBe('HubSpot');
    });

    it('handles missing data gracefully', () => {
      const onboardingData = createOnboardingData({
        persona: undefined,
        website_analysis: undefined,
        seo_audit: undefined,
        competitor_analysis: undefined,
      });
      const result = mapOnboardingToStrategy(onboardingData);

      expect(result.business_type).toBeUndefined();
      expect(result.target_audience).toBeUndefined();
    });
  });

  describe('strategyPrefill', () => {
    it('prefills from onboarding data when fromOnboarding flag set', () => {
      const onboardingData = createOnboardingData();
      const input = createStrategyInput({
        fromOnboarding: true,
        quickInputs: {
          primary_goal: 'sales',
          budget_range: 'high',
          timeline: '6 months',
        },
      });

      const result = strategyPrefill(onboardingData, input);

      expect(result.business_type).toBe('saas');
      expect(result.target_audience).toBe('marketing professionals');
      expect(result.primary_goal).toBe('sales');
      expect(result.budget_range).toBe('high');
      expect(result.timeline).toBe('6 months');
    });

    it('does not prefill when fromOnboarding flag is false', () => {
      const onboardingData = createOnboardingData();
      const input = createStrategyInput({ fromOnboarding: false });

      const result = strategyPrefill(onboardingData, input);

      expect(result.business_type).toBeUndefined();
      expect(result.target_audience).toBeUndefined();
    });

    it('uses quick inputs for goal/budget/timeline when provided', () => {
      const onboardingData = createOnboardingData();
      const input = createStrategyInput({
        fromOnboarding: true,
        quickInputs: {
          primary_goal: 'engagement',
          budget_range: 'low',
          timeline: '3 months',
        },
      });

      const result = strategyPrefill(onboardingData, input);

      expect(result.primary_goal).toBe('engagement');
      expect(result.budget_range).toBe('low');
      expect(result.timeline).toBe('3 months');
    });

    it('provides defaults for quick inputs when not specified', () => {
      const onboardingData = createOnboardingData();
      const input = createStrategyInput({
        fromOnboarding: true,
        quickInputs: undefined,
      });

      const result = strategyPrefill(onboardingData, input);

      expect(result.primary_goal).toBe('traffic');
      expect(result.budget_range).toBe('medium');
      expect(result.timeline).toBe('12 months');
    });

    it('merges onboarding data with quick inputs', () => {
      const onboardingData = createOnboardingData({
        persona: {
          target_audience: 'developers',
          writing_style: 'technical',
          industry: 'Software',
          business_size: 'enterprise',
          goals: ['adoption'],
        },
        website_analysis: {
          brand_analysis: {
            business_type: 'platform',
            industry: 'developer tools',
            company_stage: 'scale-up',
          },
          performance_metrics: { monthly_visitors: 100000, conversion_rate: 5 },
        },
      });
      const input = createStrategyInput({
        fromOnboarding: true,
        quickInputs: {
          primary_goal: 'adoption',
          budget_range: 'high',
          timeline: '24 months',
        },
      });

      const result = strategyPrefill(onboardingData, input);

      expect(result.business_type).toBe('platform');
      expect(result.target_audience).toBe('developers');
      expect(result.industry).toBe('developer tools');
      expect(result.primary_goal).toBe('adoption');
    });

    it('handles partial onboarding data', () => {
      const onboardingData = createOnboardingData({
        persona: undefined,
        website_analysis: {
          brand_analysis: {
            business_type: 'agency',
            industry: 'marketing services',
          },
          performance_metrics: undefined,
        },
        seo_audit: undefined,
        competitor_analysis: undefined,
      });
      const input = createStrategyInput({ fromOnboarding: true });

      const result = strategyPrefill(onboardingData, input);

      expect(result.business_type).toBe('agency');
      expect(result.industry).toBe('marketing services');
      expect(result.target_audience).toBeUndefined();
    });
  });
});