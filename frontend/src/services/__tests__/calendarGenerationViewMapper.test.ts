import { describe, it, expect } from 'vitest';
import { buildGeneratedCalendarView } from '../calendarGenerationViewMapper';

// Realistic backend orchestrator calendar payload shape (surfaced via
// /progress `result`). Mirrors the step-12 assembly + orchestrator projection
// contract: daily_schedule[].content_items, weekly_themes[], etc.
const orchestratorResult = {
  user_id: 'user_123',
  strategy_id: 'strategy_456',
  calendar_type: 'monthly',
  industry: 'technology',
  business_size: 'sme',
  generated_at: '2026-01-05T09:30:00Z',
  content_pillars: ['Product Education', 'Thought Leadership'],
  platform_strategies: { linkedin: { type: 'B2B' } },
  content_mix: { blog: 0.5, video: 0.5 },
  daily_schedule: [
    {
      date: '2026-01-05',
      week_number: 1,
      theme: 'Product Launch',
      content_items: [
        {
          title: 'Launch Announcement',
          description: 'Introducing the new feature',
          key_message: 'Ship it',
          content_type: 'blog',
          target_platform: 'linkedin',
          optimal_posting_time: '09:00',
        },
        {
          title: 'Video Teaser',
          content_type: 'video',
          target_platform: 'youtube',
          estimated_engagement: 0.42,
        },
      ],
      platform_distribution: { linkedin: 1, youtube: 1 },
      quality_metrics: { overall_score: 0.87 },
      optimization_notes: ['Post at 9am'],
    },
    {
      date: '2026-01-06',
      week_number: 1,
      theme: 'Product Launch',
      content_items: [],
      content_pieces: [
        {
          title: 'Social Post',
          content_type: 'social',
          target_platform: 'twitter',
        },
      ],
      platform_distribution: { twitter: 1 },
      quality_metrics: { overall_score: 0.8 },
      optimization_notes: [],
    },
  ],
  weekly_themes: [
    { week_number: 1, theme: 'Product Launch', content_count: 3, platforms: ['linkedin', 'youtube'] },
    { week_number: 2, weekly_theme: 'Education Series', total_per_week: 2, platforms: ['blog'] },
  ],
  content_recommendations: [
    { type: 'blog', topic: 'Deep dive', priority: 'high', estimated_roi: 0.25 },
    { title: 'No type fallback', priority: 'medium' },
  ],
  optimal_timing: { best_days: ['Tue', 'Thu'] },
  performance_predictions: {
    overall_performance_score: 0.71,
    prediction_confidence: 0.88,
    optimization_validation: {},
    risk_assessment: {},
  },
  trending_topics: [{ topic: 'AI' }],
  repurposing_opportunities: [],
  ai_insights: [
    { confidence: 0.9, insight: 'Thought leadership wins', action: 'Lead with case studies' },
  ],
  competitor_analysis: { strengths: [] },
  gap_analysis_insights: { content_gaps: [] },
  strategy_insights: { goal_alignment_score: 0.76, content_pillars: ['Product Education'] },
  onboarding_insights: {},
  strategy_digest: { content_frequency: '3x weekly' },
  processing_time: 12.5,
  ai_confidence: 0.8,
  quality_score: 0.82,
  step_results_summary: {},
};

describe('buildGeneratedCalendarView', () => {
  it('flattens daily_schedule content_items into CalendarTab schedule items', () => {
    const view = buildGeneratedCalendarView(orchestratorResult);

    expect(view.daily_schedule).toHaveLength(3);
    const first = view.daily_schedule[0];
    expect(first).toMatchObject({
      date: '2026-01-05',
      week_number: 1,
      theme: 'Product Launch',
      topic: 'Launch Announcement',
      description: 'Introducing the new feature',
      content_type: 'blog',
      platform: 'linkedin',
    });
    expect(first.estimated_engagement).toBe(0.87);
  });

  it('uses per-item estimated_engagement when present', () => {
    const video = buildGeneratedCalendarView(orchestratorResult).daily_schedule[1];
    expect(video).toMatchObject({
      topic: 'Video Teaser',
      content_type: 'video',
      platform: 'youtube',
    });
    expect(video.estimated_engagement).toBe(0.42);
  });

  it('falls back to content_pieces when content_items is empty', () => {
    const social = buildGeneratedCalendarView(orchestratorResult).daily_schedule[2];
    expect(social).toMatchObject({
      topic: 'Social Post',
      content_type: 'social',
      platform: 'twitter',
    });
  });

  it('normalizes weekly_themes to {week, theme, content_count, platforms}', () => {
    const themes = buildGeneratedCalendarView(orchestratorResult).weekly_themes;
    expect(themes).toHaveLength(2);
    expect(themes[0]).toEqual({
      week: 1,
      week_number: 1,
      theme: 'Product Launch',
      title: 'Product Launch',
      content_count: 3,
      platforms: ['linkedin', 'youtube'],
    });
    expect(themes[1]).toMatchObject({ week: 2, theme: 'Education Series', content_count: 2, platforms: ['blog'] });
  });

  it('normalizes content_recommendations with fallbacks for optional fields', () => {
    const recs = buildGeneratedCalendarView(orchestratorResult).content_recommendations;
    expect(recs[0]).toEqual({
      type: 'blog',
      topic: 'Deep dive',
      priority: 'high',
      estimated_roi: 0.25,
    });
    expect(recs[1]).toEqual({
      type: 'content',
      topic: 'No type fallback',
      priority: 'medium',
      estimated_roi: 0,
    });
  });

  it('passes performance_predictions through honestly (no fabricated metrics)', () => {
    const { performance_predictions } = buildGeneratedCalendarView(orchestratorResult);
    expect(performance_predictions).toEqual(orchestratorResult.performance_predictions);
  });

  it('maps ai_insights through for the AI Insights section', () => {
    const insights = buildGeneratedCalendarView(orchestratorResult).ai_insights;
    expect(insights).toHaveLength(1);
    expect(insights[0]).toMatchObject({ insight: 'Thought leadership wins', action: 'Lead with case studies' });
  });

  it('derives content_pillars from the payload (not theme names) when present', () => {
    const view = buildGeneratedCalendarView(orchestratorResult);
    expect(view.content_pillars).toEqual(['Product Education', 'Thought Leadership']);
  });

  it('exposes strategy_data/strategy_analysis from the strategy digest echo', () => {
    const view = buildGeneratedCalendarView(orchestratorResult);
    expect(view.strategy_data).toEqual({ content_frequency: '3x weekly' });
    expect(view.strategy_analysis).toEqual({ content_frequency: '3x weekly' });
  });

  it('wires quality_indicators.overall_quality_score from quality_score', () => {
    const view = buildGeneratedCalendarView(orchestratorResult);
    expect(view.quality_indicators.overall_quality_score).toBe(0.82);
    expect(view.quality_indicators.strategic_alignment).toBe(0.76);
  });

  it('echoes metadata for the CalendarTab header', () => {
    const view = buildGeneratedCalendarView(orchestratorResult);
    expect(view.metadata).toMatchObject({
      generated_at: '2026-01-05T09:30:00Z',
      calendar_type: 'monthly',
      industry: 'technology',
      business_size: 'sme',
    });
  });

  it('respects payload fields over context when present', () => {
    const view = buildGeneratedCalendarView(orchestratorResult, {
      userId: 99,
      strategyId: 42,
      calendarType: 'quarterly',
      industry: 'finance',
      businessSize: 'enterprise',
    });
    expect(view.calendar_type).toBe('monthly');
    expect(view.industry).toBe('technology');
    expect(view.business_size).toBe('sme');
  });

  it('fills user/strategy context defaults when the payload omits them', () => {
    const view = buildGeneratedCalendarView(
      { quality_score: 0.5 },
      { userId: 99, strategyId: 42, calendarType: 'quarterly', industry: 'finance', businessSize: 'enterprise' }
    );
    expect(view.user_id).toBe(99);
    expect(view.strategy_id).toBe(42);
    expect(view.calendar_type).toBe('quarterly');
    expect(view.industry).toBe('finance');
    expect(view.business_size).toBe('enterprise');
  });

  it('returns a safe, renderable view for an empty/partial payload', () => {
    const view = buildGeneratedCalendarView(null);
    expect(view.daily_schedule).toEqual([]);
    expect(view.weekly_themes).toEqual([]);
    expect(view.content_recommendations).toEqual([]);
    expect(view.ai_insights).toEqual([]);
    expect(view.performance_predictions).toEqual({});
    expect(view.quality_indicators.overall_quality_score).toBe(0);
  });
});