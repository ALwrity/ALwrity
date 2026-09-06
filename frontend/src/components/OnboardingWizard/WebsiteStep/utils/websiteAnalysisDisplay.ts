/**
 * Display helpers for latest-only website analysis check-existing responses.
 */

import type { ExistingAnalysis } from './constants';

export function resolveExistingAnalysisTimestamp(
  existing: Pick<ExistingAnalysis, 'last_analyzed_at' | 'updated_at' | 'analysis_date'>
): string | undefined {
  return existing.last_analyzed_at || existing.updated_at || existing.analysis_date;
}

export function formatLastAnalyzedLabel(
  existing: Pick<ExistingAnalysis, 'last_analyzed_at' | 'updated_at' | 'analysis_date'>
): string {
  const timestamp = resolveExistingAnalysisTimestamp(existing);
  if (!timestamp) {
    return 'Last analyzed on a previous session';
  }

  const formatted = new Date(timestamp).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  return `Last analyzed on ${formatted}`;
}

export function mapCheckExistingResponse(payload: Record<string, unknown>): ExistingAnalysis | null {
  if (!payload?.exists) {
    return null;
  }

  return {
    exists: true,
    analysis_id: payload.analysis_id as number | undefined,
    analysis_date: payload.analysis_date as string | undefined,
    updated_at: payload.updated_at as string | undefined,
    last_analyzed_at: payload.last_analyzed_at as string | undefined,
    summary: payload.summary as ExistingAnalysis['summary'],
    error: payload.error as string | undefined,
  };
}
