import { useCallback, useEffect, useRef, useState } from 'react';
import { contentPlanningApi } from '../services/contentPlanningApi';

/** Indexing lifecycle phases served by GET /strategy/sif-status (Phase 1). */
export type SifIndexingPhase =
  | 'pending'
  | 'running'
  | 'success'
  | 'skipped'
  | 'failed'
  | 'not_indexed'
  | 'no_active_strategy';

export interface StrategySifIndexingInfo {
  status?: string;
  phase?: SifIndexingPhase;
  summary?: string | null;
  error_message?: string | null;
  embedding_count?: number;
  attempt?: number;
  started_at?: string | null;
  finished_at?: string | null;
  updated_at?: string | null;
  source_id?: string;
}

/**
 * Read-only status of the content-strategy semantic index. Mirrors the
 * Phase 1 payload shape (services/intelligence/strategy_sif_status.py).
 */
export interface StrategySifStatus {
  activation: {
    strategy_id?: string | number;
    activated_at?: string | null;
  } | null;
  indexing: StrategySifIndexingInfo | null;
  watermark: {
    source_id?: string;
    source_hash?: string;
    embedding_count?: number;
    indexed_at?: string | null;
    notes?: string | null;
  } | null;
  vfs_mirror: {
    exists?: boolean;
    path?: string | null;
  } | null;
  document_kinds: {
    names: string[];
    doc_ids: string[];
    checked: boolean;
  } | null;
}

export const DEFAULT_SIF_POLL_INTERVAL_MS = 5000;

const ACTIVE_PHASES = new Set<SifIndexingPhase>(['pending', 'running']);

interface UseStrategySifStatusOptions {
  enabled?: boolean;
  pollIntervalMs?: number;
}

/**
 * Polls the read-only SIF status endpoint for the active content strategy.
 * Fetches immediately when enabled, re-fetches while the indexer is
 * pending/running, and stops on a terminal phase or on error — the reader
 * never hammers /strategy/sif-status once indexing has settled.
 */
export function useStrategySifStatus(
  options: UseStrategySifStatusOptions = {},
): { data: StrategySifStatus | null; loading: boolean; error: string | null; refresh: () => void } {
  const { enabled = true, pollIntervalMs = DEFAULT_SIF_POLL_INTERVAL_MS } = options;
  const [data, setData] = useState<StrategySifStatus | null>(null);
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
        const payload: StrategySifStatus | null = await contentPlanningApi.getStrategySifStatus();
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
        setError(e?.message || 'Could not load indexing status');
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