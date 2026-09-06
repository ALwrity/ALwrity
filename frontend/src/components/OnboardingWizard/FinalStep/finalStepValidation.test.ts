import { describe, expect, it } from 'vitest';
import { validateFinalStepCompletion } from './finalStepValidation';
import type { OnboardingData } from './types';

describe('validateFinalStepCompletion', () => {
  it('requires website analysis for website onboarding', () => {
    const result = validateFinalStepCompletion({}, 'website');
    expect(result.isValid).toBe(false);
    expect(result.missingSteps).toContain('Website Analysis');
  });

  it('passes website onboarding when API-backed data is complete', () => {
    const data: OnboardingData = {
      websiteUrl: 'https://acme.com',
      researchPreferences: { research_depth: 'deep' },
      personalizationSettings: { writing_style: 'professional' },
      personaReadiness: { isReady: true },
    };

    expect(validateFinalStepCompletion(data, 'website')).toEqual({
      isValid: true,
      missingSteps: [],
    });
  });

  it('accepts persona readiness from backend ready flag', () => {
    const data: OnboardingData = {
      websiteUrl: 'https://acme.com',
      researchPreferences: { research_depth: 'deep' },
      personaReadiness: { ready: true },
    };

    const result = validateFinalStepCompletion(data, 'website');
    expect(result.isValid).toBe(true);
  });

  it('requires LinkedIn research and persona data', () => {
    const result = validateFinalStepCompletion(
      { personalizationSettings: { writing_style: 'professional' } },
      'linkedin'
    );

    expect(result.isValid).toBe(false);
    expect(result.missingSteps).toContain('LinkedIn Research');
  });

  it('passes LinkedIn onboarding when research and persona are present', () => {
    const data: OnboardingData = {
      researchPreferences: { growth_summary: 'Authority' },
      personalizationSettings: { persona: { persona_name: 'Founder' } },
      personaReadiness: { ready: true },
    };

    expect(validateFinalStepCompletion(data, 'linkedin').isValid).toBe(true);
  });
});
