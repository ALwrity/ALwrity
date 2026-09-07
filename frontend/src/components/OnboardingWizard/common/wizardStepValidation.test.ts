import { describe, expect, it } from 'vitest';
import {
  isStepDataValid,
  resolveStepValidationData,
} from './wizardStepValidation';

/**
 * Documents the current Wizard.tsx bug (P0-3): step 1 passes the collector
 * function to validation instead of invoking it. This test MUST keep passing
 * until Phase 3 replaces Wizard inline logic with resolveStepValidationData.
 */
function simulateCurrentWizardValidationBug(
  activeStep: number,
  stepData: unknown,
  competitorDataCollector: (() => unknown) | null
): unknown {
  let dataToValidate = stepData;
  if (activeStep === 1 && competitorDataCollector) {
    dataToValidate = competitorDataCollector;
  }
  return dataToValidate;
}

describe('current Wizard step-1 validation bug (documented)', () => {
  it('passes the collector function object instead of calling it', () => {
    const collector = () => ({
      competitors: [{ url: 'https://competitor.com' }],
      researchSummary: { total_competitors: 1 },
    });

    const dataToValidate = simulateCurrentWizardValidationBug(1, {}, collector);
    expect(typeof dataToValidate).toBe('function');
    expect(isStepDataValid(1, dataToValidate, 'website')).toBe(false);
  });
});

describe('resolveStepValidationData', () => {
  it('calls competitorDataCollector for research step validation', () => {
    const collector = () => ({
      competitors: [{ url: 'https://competitor.com' }],
      researchSummary: { total_competitors: 1 },
    });

    const data = resolveStepValidationData({
      activeStep: 1,
      stepData: {},
      competitorDataCollector: collector,
      stepValidationStates: {},
    });

    expect(data).toEqual({
      competitors: [{ url: 'https://competitor.com' }],
      researchSummary: { total_competitors: 1 },
    });
  });

  it('prefers stepValidationStates for connect and personalization steps', () => {
    const data = resolveStepValidationData({
      activeStep: 0,
      stepData: { website: 'https://acme.com' },
      competitorDataCollector: null,
      stepValidationStates: { 0: false },
    });
    expect(data).toBe(false);
  });

  it('falls back to stepData when no collector is registered on research step', () => {
    const stepData = {
      competitors: [{ url: 'https://cached.com' }],
      researchSummary: { total_competitors: 1 },
    };

    const data = resolveStepValidationData({
      activeStep: 1,
      stepData,
      competitorDataCollector: null,
      stepValidationStates: {},
    });

    expect(data).toEqual(stepData);
  });
});

describe('isStepDataValid', () => {
  it('accepts research data when competitors array is non-empty', () => {
    expect(
      isStepDataValid(
        1,
        {
          competitors: [{ url: 'https://competitor.com' }],
        },
        'website'
      )
    ).toBe(true);
  });

  it('rejects empty competitors when no summary or sitemap is present', () => {
    expect(isStepDataValid(1, { competitors: [] }, 'website')).toBe(false);
  });

  it('accepts LinkedIn research when growth_summary is present', () => {
    expect(
      isStepDataValid(1, { growth_summary: 'Industry insights' }, 'linkedin')
    ).toBe(true);
  });

  it('requires brand avatar and voice clone for website personalization', () => {
    const personaOnly = {
      corePersona: { name: 'Brand' },
      platformPersonas: { linkedin: {} },
      qualityMetrics: { score: 0.9 },
    };
    expect(isStepDataValid(2, personaOnly, 'website')).toBe(false);

    expect(
      isStepDataValid(
        2,
        {
          ...personaOnly,
          brandAvatar: { set: true },
          voiceClone: { set: true },
        },
        'website'
      )
    ).toBe(true);
  });

  it('requires persona only for LinkedIn personalization', () => {
    expect(
      isStepDataValid(
        2,
        {
          corePersona: { name: 'Creator' },
          platformPersonas: { linkedin: {} },
          qualityMetrics: { score: 0.8 },
        },
        'linkedin'
      )
    ).toBe(true);
  });
});
