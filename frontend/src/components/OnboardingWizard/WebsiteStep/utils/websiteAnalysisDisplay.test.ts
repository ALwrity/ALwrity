import { describe, it, expect } from 'vitest';
import {
  formatLastAnalyzedLabel,
  mapCheckExistingResponse,
  resolveExistingAnalysisTimestamp,
} from './websiteAnalysisDisplay';

describe('websiteAnalysisDisplay', () => {
  describe('resolveExistingAnalysisTimestamp', () => {
    it('prefers last_analyzed_at over analysis_date', () => {
      expect(
        resolveExistingAnalysisTimestamp({
          analysis_date: '2026-08-31T00:00:00',
          last_analyzed_at: '2026-09-06T12:00:00',
        })
      ).toBe('2026-09-06T12:00:00');
    });

    it('falls back to updated_at then analysis_date', () => {
      expect(
        resolveExistingAnalysisTimestamp({
          updated_at: '2026-09-05T08:00:00',
          analysis_date: '2026-08-31T00:00:00',
        })
      ).toBe('2026-09-05T08:00:00');
    });
  });

  describe('formatLastAnalyzedLabel', () => {
    it('returns Last analyzed on with a formatted date', () => {
      const label = formatLastAnalyzedLabel({
        last_analyzed_at: '2026-09-06T12:00:00',
      });
      expect(label).toMatch(/^Last analyzed on /);
      expect(label).toContain('2026');
    });

    it('returns a clear fallback when no timestamp exists', () => {
      expect(formatLastAnalyzedLabel({})).toBe('Last analyzed on a previous session');
    });
  });

  describe('mapCheckExistingResponse', () => {
    it('maps nested API payload into ExistingAnalysis shape', () => {
      expect(
        mapCheckExistingResponse({
          exists: true,
          analysis_id: 99,
          analysis_date: '2026-08-31T00:00:00',
          last_analyzed_at: '2026-09-06T12:00:00',
          summary: { writing_style: { tone: 'friendly' } },
        })
      ).toEqual({
        exists: true,
        analysis_id: 99,
        analysis_date: '2026-08-31T00:00:00',
        last_analyzed_at: '2026-09-06T12:00:00',
        summary: { writing_style: { tone: 'friendly' } },
      });
    });

    it('returns null when analysis does not exist', () => {
      expect(mapCheckExistingResponse({ exists: false })).toBeNull();
    });
  });
});
