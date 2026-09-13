import { useCallback, useEffect, useRef, useState } from 'react';
import { contentPlanningApi } from '../services/contentPlanningApi';

/** Indexing lifecycle phases served by GET /calendar-generation/calendar/sif-status. */
export type CalendarSifIndexingPhase =
  | 'pending'
  | 'running'
  | 'success'
  | 'skipped'
  | 'failed'
  | 'not_indexed';

export interface CalendarSifIndexingInfo {
  status?: string;
  phase?: CalendarSifIndexingPhase;
  error_message?: string | null;
  embedding_count?: number;
  attempt?: number;
  started_at?: string | null;
  finished_at?: string | null;
}

export interface CalendarSifWatermark {
  embedding_count?: number;
  indexed_at?: string | null;
  source_hash?: string;
}

export interface CalendarSifDocumentKinds {
  names: string[];
  doc_ids: string[];
  count: number;
}

export interface CalendarSifStatus {
  indexing: CalendarSifIndexingInfo | null;
  watermark: CalendarSifWatermark | null;
  document_kinds: CalendarSifDocumentKinds | null;
}

export const DEFAULT_SIF_POLL_INTERVAL_MS = 5000;

const ACTIVE_PHASES = new Set<CalendarSifIndexingPhase>(['pending', 'running']);

interface UseCalendarSifStatusOptions {
  enabled?: boolean;
  pollIntervalMs?: number;
}

/**
 * Polls the read-only calendar SIF status endpoint.
 * Fetches immediately when enabled, re-fetches while the indexer is
 * pending/running, and stops on a terminal phase or on error.
 */
export function useCalendarSifStatus(
  options: UseCalendarSifStatusOptions = {},
): { data: CalendarSifStatus | null; loading: boolean; error: string | null; refresh: () => void } {
  const { enabled = true, pollIntervalMs = DEFAULT_SIF_POLL_INTERVAL_MS } = options;
  const [data, setData] = useState<CalendarSifStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;
      setLoading(true);
      try {
        const payload: CalendarSifStatus | null = await contentPlanningApi.getCalendarSifStatus();
        if (cancelled) return;
        setData(payload);
        setError(null);
        setLoading(false);

        const phase = payload?.indexing?.phase;
        if (phase && ACTIVE_PHASES.has(phase)) {
          timerRef.current = setTimeout(tick, pollIntervalMs);
        }
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message || 'Could not load calendar indexing status');
        setData(null);
        setLoading(false);
      }
    };

    tick();

    return () => {
      cancelled = true;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [enabled, pollIntervalMs, refreshKey]);

  return { data, loading, error, refresh };
}
