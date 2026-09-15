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

/** R3.5: one search hit as labeled by GET .../calendar/sif-search. */
export interface CalendarSifSearchHit {
  id: string;
  kind?: string;
  kind_label?: string;
  score?: number;
  text?: string;
}

/** R3.5: the search endpoint's response (soft errors ride inside the 200). */
export interface CalendarSifSearchResponse {
  query: string;
  source_id: string;
  hits: CalendarSifSearchHit[];
  error?: string;
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
): {
  data: CalendarSifStatus | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refresh: () => void;
} {
  const { enabled = true, pollIntervalMs = DEFAULT_SIF_POLL_INTERVAL_MS } = options;
  const [data, setData] = useState<CalendarSifStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // R3.4: last-known payload mirrored into a ref so poll closures can keep
  // it on an error without a state dependency.
  const dataRef = useRef<CalendarSifStatus | null>(null);
  const retryRef = useRef(0);

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    // R3.3: no sync setState in the effect body — the disabled surface is
    // derived at the return site instead of cleared here.
    if (!enabled) {
      return;
    }

    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;
      if (dataRef.current === null) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      try {
        const payload: CalendarSifStatus | null = await contentPlanningApi.getCalendarSifStatus();
        if (cancelled) return;
        setData(payload);
        dataRef.current = payload;
        setError(null);
        setLoading(false);
        setRefreshing(false);
        retryRef.current = 0;

        const phase = payload?.indexing?.phase;
        if (phase && ACTIVE_PHASES.has(phase)) {
          timerRef.current = setTimeout(tick, pollIntervalMs);
        }
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message || 'Could not load calendar indexing status');
        setLoading(false);
        setRefreshing(false);
        // R3.4: initial failure degrades to nothing; a poll failing once we
        // HOLD data keeps the last payload and retries a bounded number of
        // times instead of vanishing.
        if (dataRef.current !== null && retryRef.current < 3) {
          retryRef.current += 1;
          timerRef.current = setTimeout(tick, pollIntervalMs);
        }
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

  return {
    data: enabled ? data : null,
    loading: enabled ? loading : false,
    refreshing: enabled ? refreshing : false,
    error: enabled ? error : null,
    refresh,
  };
}
