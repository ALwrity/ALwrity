import { useCallback, useEffect, useState } from 'react';
import {
  MonitoringHealth,
  MonitoringHealthError,
  monitoringHealthApi,
} from '../services/monitoringHealthApi';

interface UseMonitoringHealthOptions {
  strategyId: number | null;
  enabled?: boolean;
}

interface UseMonitoringHealthResult {
  data: MonitoringHealth | null;
  loading: boolean;
  /** Real backend error message, or null. Never a fabricated fallback. */
  error: string | null;
  /** True when tasks exist but no execution logs yet (truthful, not an error). */
  awaitingFirstRun: boolean;
  refresh: () => void;
}

/**
 * Fetches real monitoring health for a strategy.
 *
 * Follows the `useStrategySifStatus` pattern (fetch-once + manual refresh,
 * cancelled-guard) with one deliberate difference: errors are surfaced as
 * state for the caller to render — this hook never invents healthy data.
 * A backend 404 "no execution logs" becomes `awaitingFirstRun` so the UI
 * shows "scheduled, awaiting first run" instead of an error banner.
 */
export function useMonitoringHealth(
  options: UseMonitoringHealthOptions,
): UseMonitoringHealthResult {
  const { strategyId, enabled = true } = options;
  const [data, setData] = useState<MonitoringHealth | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [awaitingFirstRun, setAwaitingFirstRun] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (!enabled || strategyId === null) {
      setData(null);
      setError(null);
      setAwaitingFirstRun(false);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    monitoringHealthApi
      .getMonitoringHealth(strategyId)
      .then((payload) => {
        if (cancelled) return;
        setData(payload);
        setError(null);
        setAwaitingFirstRun(false);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        if (e instanceof MonitoringHealthError && e.code === 'awaiting-first-run') {
          // Truthful pending state: tasks are scheduled, the scheduler
          // simply hasn't completed the first run yet.
          setData(null);
          setError(null);
          setAwaitingFirstRun(true);
        } else {
          setData(null);
          setAwaitingFirstRun(false);
          setError(e instanceof Error ? e.message : 'Could not load monitoring health');
        }
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, strategyId, refreshKey]);

  return { data, loading, error, awaitingFirstRun, refresh };
}
