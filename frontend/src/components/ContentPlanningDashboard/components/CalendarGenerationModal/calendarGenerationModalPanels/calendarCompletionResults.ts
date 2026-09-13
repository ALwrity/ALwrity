/**
 * Pure builder for the modal's onComplete payload.
 *
 * Prefers the real backend result delivered via progress.result; falls back
 * to the legacy step-12 derivation so the flow stays functional for
 * pre-result payloads. Extracted pure for unit testing (no React).
 */

export interface CompletionResults {
  calendar: Record<string, any>;
  qualityScores: any;
  insights: any;
  recommendations: any;
  exportData: {
    calendarJson: string;
    insightsCsv: string;
    recommendationsPdf: string;
    qualityReport: string;
  };
}

export function buildCompletionResults(
  progressData: any,
  sessionId: string
): CompletionResults {
  const result =
    progressData?.result && typeof progressData.result === 'object'
      ? progressData.result
      : null;

  const step12Result = progressData?.stepResults?.[12];
  const step12Data = step12Result?.data ?? step12Result?.results ?? {};

  const calendar = result ?? {
    id: sessionId,
    title: step12Data?.title || 'Generated Calendar',
    description: step12Data?.description || '',
    startDate: step12Data?.start_date || '',
    endDate: step12Data?.end_date || '',
    content: step12Data?.daily_schedule?.map?.((item: any, i: number) => ({
      id: item.id || `event_${i}`,
      title: item.title || '',
      description: item.description || '',
      contentType: item.content_type || item.contentType || 'post',
      platform: item.platform || '',
      scheduledDate: item.scheduled_date || item.date || '',
      theme: item.theme || '',
      keywords: item.keywords || []
    })) || [],
    themes: progressData?.stepResults?.[7]?.data?.themes?.map?.((t: any, i: number) => ({
      id: t.id || `theme_${i}`,
      name: t.name || '',
      description: t.description || '',
      weekNumber: t.week_number || i + 1,
      contentTypes: t.content_types || []
    })) || [],
    platforms: step12Data?.platform_strategies?.map?.((p: any, i: number) => ({
      id: p.id || `platform_${i}`,
      name: p.name || p.platform || '',
      contentCount: p.content_count || 0,
      postingSchedule: p.schedule || []
    })) || []
  };

  return {
    calendar,
    qualityScores: progressData?.qualityScores,
    insights: result?.ai_insights ?? step12Data?.insights ?? {},
    recommendations: result?.content_recommendations ?? step12Data?.recommendations ?? {},
    exportData: {
      calendarJson: JSON.stringify(result ?? step12Data),
      insightsCsv: '',
      recommendationsPdf: '',
      qualityReport: ''
    }
  };
}
