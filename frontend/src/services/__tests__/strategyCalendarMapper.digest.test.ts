import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { buildStrategyDigest, SimplifiedStrategyCalendarMapper } from '../strategyCalendarMapper';

const CREATE_TAB_PATH = resolve(
  __dirname,
  '../../components/ContentPlanningDashboard/tabs/CreateTab.tsx',
);

describe('buildStrategyDigest (QA-6 strategy->calendar handoff)', () => {
  it('returns an empty digest for a null strategy', () => {
    expect(buildStrategyDigest(null)).toEqual({});
  });

  it('extracts pillars/formats/frequency/voice/timing from EnhancedStrategy shape', () => {
    const digest = buildStrategyDigest({
      industry: 'technology',
      content_frequency: '3x weekly',
      preferred_formats: ['Blog', 'Video'],
      brand_voice: 'Professional and approachable',
      optimal_timing: 'Weekday mornings before 9 AM',
    });

    expect(digest).toEqual({
      content_pillars: undefined,
      preferred_formats: ['Blog', 'Video'],
      content_frequency: '3x weekly',
      brand_voice: 'Professional and approachable',
      best_timing: 'Weekday mornings before 9 AM',
    });
  });

  it('merges base_strategy over top-level comprehensive fields', () => {
    const digest = buildStrategyDigest({
      strategic_insights: {},
      competitive_analysis: {},
      metadata: { strategy_name: 'SaaS Launch' },
      base_strategy: {
        content_type: 'Long-form articles',
        brand_voice: 'Deeply technical',
      },
      content_pillars: ['Product Education'],
      content_frequency: '2x weekly',
      optimal_timing: 'Roadmap: 12 months',
    });

    expect(digest).toEqual({
      content_pillars: ['Product Education'],
      preferred_formats: ['Long-form articles'],
      content_frequency: '2x weekly',
      brand_voice: 'Deeply technical',
      best_timing: 'Roadmap: 12 months',
    });
  });

  it('falls back to roadmap timeline and summary implementation_timeline for timing', () => {
    expect(
      buildStrategyDigest({
        implementation_roadmap: { timeline: 'Quarter 2' },
      }).best_timing,
    ).toBe('Quarter 2');

    expect(
      buildStrategyDigest({
        summary: { implementation_timeline: '6 months' },
      }).best_timing,
    ).toBe('6 months');
  });

  it('normalizes comma-separated strings and {label} dicts', () => {
    const digest = buildStrategyDigest({
      content_pillars: 'Thought Leadership, Case Studies',
      preferred_formats: [{ label: 'Podcast' }],
      brand_voice: { voice_description: 'Warm and concise' },
    });

    expect(digest.content_pillars).toEqual(['Thought Leadership', 'Case Studies']);
    expect(digest.preferred_formats).toEqual(['Podcast']);
    expect(digest.brand_voice).toBe('Warm and concise');
  });

  it('only emits concrete values - no invented defaults', () => {
    const digest = buildStrategyDigest({ industry: 'finance', team_size: 3 });

    expect(digest).toEqual({});
  });

  it('supports exporting a convenience wrapper', () => {
    expect(typeof buildStrategyDigest).toBe('function');
    expect(typeof SimplifiedStrategyCalendarMapper.buildStrategyDigest).toBe('function');
  });
});

describe('CreateTab wires the digest into the calendar start request', () => {
  const source = readFileSync(CREATE_TAB_PATH, 'utf-8');

  it('imports buildStrategyDigest from the mapper service', () => {
    expect(source).toContain("buildStrategyDigest } from '../../../services/strategyCalendarMapper'");
  });

  it('builds the digest from strategyContext data', () => {
    expect(source).toContain('buildStrategyDigest(strategyContext.strategyData)');
  });

  it('sends strategy_digest in the /start payload only when non-empty', () => {
    expect(source).toContain('strategy_digest: strategyDigest');
    expect(source).toContain('Object.keys(strategyDigest).length > 0 && { strategy_digest: strategyDigest }');
  });
});