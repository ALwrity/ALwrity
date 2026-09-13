import { describe, expect, it } from 'vitest';
import { buildCompletionResults } from './calendarCompletionResults';

const realResult = {
  daily_schedule: [{ date: '2026-01-05', content_items: [{ title: 'AI 101' }] }],
  weekly_themes: [{ week_number: 1, theme: 'AI Foundations' }],
  ai_insights: [{ insight: 'Post mornings' }],
  content_recommendations: [{ recommendation: 'Repurpose' }],
};

describe('buildCompletionResults', () => {
  it('prefers the real backend result when present', () => {
    const out = buildCompletionResults(
      { result: realResult, qualityScores: { overall: 0.9 } },
      'sid-1'
    );

    expect(out.calendar).toEqual(realResult);
    expect(out.qualityScores).toEqual({ overall: 0.9 });
    expect(out.insights).toEqual(realResult.ai_insights);
    expect(out.recommendations).toEqual(realResult.content_recommendations);
    expect(JSON.parse(out.exportData.calendarJson)).toEqual(realResult);
  });

  it('falls back to the legacy step-12 derivation without a result', () => {
    const out = buildCompletionResults(
      {
        stepResults: {
          12: {
            data: {
              title: 'Legacy Cal',
              daily_schedule: [{ title: 'T', content_type: 'blog', platform: 'LinkedIn' }],
            },
          },
          7: { data: { themes: [{ name: 'Theme A', week_number: 2 }] } },
        },
      },
      'sid-9'
    );

    expect(out.calendar.id).toBe('sid-9');
    expect(out.calendar.title).toBe('Legacy Cal');
    expect(out.calendar.content).toHaveLength(1);
    expect(out.calendar.content[0].contentType).toBe('blog');
    expect(out.calendar.themes[0]).toMatchObject({ name: 'Theme A', weekNumber: 2 });
  });

  it('builds an empty shell when nothing is available (never mock content)', () => {
    const out = buildCompletionResults({}, 'sid-0');

    expect(out.calendar.id).toBe('sid-0');
    expect(out.calendar.title).toBe('Generated Calendar');
    expect(out.calendar.content).toEqual([]);
    expect(out.insights).toEqual({});
  });
});
