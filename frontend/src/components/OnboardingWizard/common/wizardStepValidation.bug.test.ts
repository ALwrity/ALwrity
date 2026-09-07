import { describe, expect, it } from 'vitest';

/**
 * Phase 1 — documents P0-3 without importing future modules.
 * Wizard.tsx currently assigns competitorDataCollector (a function) to
 * dataToValidate instead of calling it, so step-1 Continue stays disabled
 * after fresh discovery unless stepData already has research fields.
 */
function isStepDataValidWebsiteResearch(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const record = data as Record<string, unknown>;
  return !!(record.competitors || record.researchSummary || record.sitemapAnalysis);
}

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

describe('Wizard step-1 validation bug (Phase 1 baseline)', () => {
  it('passes the collector function object instead of calling it', () => {
    const collector = () => ({
      competitors: [{ url: 'https://competitor.com' }],
      researchSummary: { total_competitors: 1 },
    });

    const dataToValidate = simulateCurrentWizardValidationBug(1, {}, collector);
    expect(typeof dataToValidate).toBe('function');
    expect(isStepDataValidWebsiteResearch(dataToValidate)).toBe(false);
  });

  it('would validate successfully if the collector were invoked (Phase 3 target)', () => {
    const collector = () => ({
      competitors: [{ url: 'https://competitor.com' }],
      researchSummary: { total_competitors: 1 },
    });

    const dataToValidate = collector();
    expect(isStepDataValidWebsiteResearch(dataToValidate)).toBe(true);
  });
});
