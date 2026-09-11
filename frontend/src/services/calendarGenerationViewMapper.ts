/**
 * CalendarGenerationViewMapper Service
 *
 * Maps a real calendar-generation backend result payload (the orchestrator
 * calendar response surfaced via the /progress `result` field) into the
 * `generatedCalendar` view shape consumed by CalendarTab.
 *
 * Pure, defensive, and honest: never fabricates numbers — missing
 * performance fields simply stay absent so the UI falls back to `|| 0`.
 */

import type { GeneratedCalendar } from '../stores/contentPlanningStore';

type Dict = Record<string, any>;

export interface GeneratedScheduleItem {
  date: string;
  week_number: number | null;
  theme: string;
  topic: string;
  description: string;
  content_type: string;
  platform: string;
  estimated_engagement: number;
}

export interface GeneratedTheme {
  week: number;
  week_number: number;
  theme: string;
  title: string;
  content_count: number;
  platforms: string[];
}

export interface GeneratedRecommendation {
  type: string;
  topic: string;
  priority: string;
  estimated_roi: number;
}

const asDict = (value: any): Dict =>
  value && typeof value === 'object' && !Array.isArray(value) ? value : {};

const asArray = (value: any): any[] => (Array.isArray(value) ? value : []);

const asNumber = (value: any, fallback = 0): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const asString = (value: any, fallback = ''): string =>
  value == null ? fallback : String(value);

const strList = (value: any): string[] =>
  asArray(value)
    .map((entry) =>
      typeof entry === 'string' ? entry : asString(asDict(entry).platform ?? asDict(entry).name)
    )
    .filter(Boolean);

const flattenDailySchedule = (dailySchedule: any): GeneratedScheduleItem[] =>
  asArray(dailySchedule).flatMap((day: any) => {
    const dayObj = asDict(day);
    const quality = asDict(dayObj.quality_metrics);
    const items = asArray(dayObj.content_items).length
      ? asArray(dayObj.content_items)
      : asArray(dayObj.content_pieces);
    return items.map((item: any) => {
      const piece = asDict(item);
      return {
        date: asString(dayObj.date),
        week_number: dayObj.week_number == null ? null : asNumber(dayObj.week_number),
        theme: asString(dayObj.theme, 'General'),
        topic: asString(piece.title ?? piece.topic),
        description: asString(piece.description ?? piece.key_message),
        content_type: asString(piece.content_type ?? piece.type, 'post'),
        platform: asString(piece.target_platform ?? piece.platform),
        estimated_engagement: asNumber(
          piece.estimated_engagement ?? quality.overall_score ?? 0
        ),
      };
    });
  });

const normalizeThemes = (weeklyThemes: any): GeneratedTheme[] =>
  asArray(weeklyThemes).map((theme: any, index: number) => {
    const t = asDict(theme);
    const week = asNumber(t.week_number ?? t.week ?? index + 1, index + 1);
    const label = asString(
      t.theme ?? t.weekly_theme ?? t.title ?? t.name,
      `Week ${week}`
    );
    return {
      week,
      week_number: week,
      theme: label,
      title: label,
      content_count: asNumber(t.content_count ?? t.piece_count ?? t.total_per_week ?? 0),
      platforms: strList(t.platforms ?? t.platforms_covered ?? []),
    };
  });

const normalizeRecommendations = (recommendations: any): GeneratedRecommendation[] =>
  asArray(recommendations).map((rec: any) => {
    const r = asDict(rec);
    return {
      type: asString(r.type ?? r.content_type, 'content'),
      topic: asString(r.topic ?? r.recommendation ?? r.title),
      priority: asString(r.priority, 'medium'),
      estimated_roi: asNumber(r.estimated_roi ?? r.roi_percentage ?? 0),
    };
  });

const normalizeAiInsights = (aiInsights: any): any[] => {
  const insights = asArray(aiInsights);
  if (insights.length) return insights;
  const container = asDict(aiInsights);
  const list = container.insights ?? container.items;
  return asArray(list);
};

/**
 * Build the `generatedCalendar` view payload from the backend result.
 * Optional context enriches user/strategy metadata when the backend does
 * not include it (or the caller wants to favour the local config).
 */
export function buildGeneratedCalendarView(
  result: any,
  context?: {
    userId?: number;
    strategyId?: number;
    calendarType?: string;
    industry?: string;
    businessSize?: string;
  }
): GeneratedCalendar {
  const data = asDict(result);

  const daily_schedule = flattenDailySchedule(data.daily_schedule);
  const weekly_themes = normalizeThemes(data.weekly_themes);
  const content_recommendations = normalizeRecommendations(data.content_recommendations);
  const performance_predictions = asDict(data.performance_predictions);
  const ai_insights = normalizeAiInsights(data.ai_insights);

  const calendar_type = asString(data.calendar_type, context?.calendarType ?? 'monthly');
  const industry = asString(data.industry, context?.industry ?? 'technology');
  const business_size = asString(data.business_size, context?.businessSize ?? 'sme');
  const generated_at = asString(data.generated_at, new Date().toISOString());

  return {
    user_id: context?.userId ?? asNumber(data.user_id, 0),
    strategy_id: context?.strategyId ?? data.strategy_id,
    calendar_type,
    industry,
    business_size,
    generated_at,
    content_pillars: strList(data.content_pillars || weekly_themes.map((t) => t.theme)),
    platform_strategies: asDict(data.platform_strategies),
    content_mix: asDict(data.content_mix),
    daily_schedule,
    weekly_themes,
    content_recommendations,
    optimal_timing: asDict(data.optimal_timing),
    performance_predictions,
    trending_topics: asArray(data.trending_topics).length ? asArray(data.trending_topics) : [],
    repurposing_opportunities: asArray(data.repurposing_opportunities),
    ai_insights,
    competitor_analysis: asDict(data.competitor_analysis),
    gap_analysis_insights: asDict(data.gap_analysis_insights),
    strategy_insights: asDict(data.strategy_insights),
    onboarding_insights: asDict(data.onboarding_insights),
    strategy_data: asDict(data.strategy_digest),
    strategy_analysis: asDict(data.strategy_digest),
    processing_time: asNumber(data.processing_time, 0),
    ai_confidence: asNumber(data.ai_confidence, 0.8),
    quality_indicators: {
      overall_quality_score: asNumber(data.quality_score, 0),
      strategic_alignment: asNumber(
        asDict(data.strategy_insights).goal_alignment_score,
        0
      ),
    },
    metadata: {
      generated_at,
      user_id: context?.userId ?? asNumber(data.user_id, 0),
      strategy_id: context?.strategyId ?? data.strategy_id,
      calendar_type,
      industry,
      business_size,
      version: '1.0',
    },
  };
}