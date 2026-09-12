import { describe, it, expect } from 'vitest';
import {
  BACKGROUND_SETUP_SEO_DASHBOARD_NOTE,
  getBackgroundSetupTaskSummary,
  getBackgroundSetupTaskSummaryLines,
} from '../researchStepBackgroundSetupConstants';

describe('researchStepBackgroundSetupConstants', () => {
  it('uses the SEO dashboard note copy', () => {
    expect(BACKGROUND_SETUP_SEO_DASHBOARD_NOTE).toBe(
      'Full results for these tasks appear in the SEO Dashboard once you finish onboarding.'
    );
  });

  it('builds live task summary from preferences', () => {
    expect(getBackgroundSetupTaskSummary(null)).toBe('Loading tasks…');

    const summary = getBackgroundSetupTaskSummary({
      success: true,
      tasks: {
        deep_competitor_analysis: {
          enabled: true,
          delay_mins: 5,
          label: 'Deep analysis',
          description: 'Runs competitor deep dive',
        },
        sif_indexing: {
          enabled: true,
          delay_mins: 10,
          label: 'SIF',
          description: 'Indexes site',
        },
        market_trends: {
          enabled: false,
          delay_mins: 15,
          label: 'Trends',
          description: 'Market trends',
        },
      },
    });

    expect(summary).toBe(
      '2 of 3 tasks enabled — these run in the background so ALwrity keeps learning while you finish setup. Run any task now to test immediately under Smart Background Setup.'
    );
  });

  it('builds two-line task summary for the automation tab caption', () => {
    const lines = getBackgroundSetupTaskSummaryLines({
      success: true,
      tasks: {
        deep_competitor_analysis: { enabled: true, delay_mins: 5, label: 'Deep', description: '' },
        sif_indexing: { enabled: true, delay_mins: 10, label: 'SIF', description: '' },
        market_trends: { enabled: true, delay_mins: 15, label: 'Trends', description: '' },
      },
    });

    expect(lines.line1).toBe(
      '3 of 3 tasks enabled — these run in the background so ALwrity keeps learning while you finish setup.'
    );
    expect(lines.line2).toBe('Run any task now to test immediately under Smart Background Setup.');
  });
});
