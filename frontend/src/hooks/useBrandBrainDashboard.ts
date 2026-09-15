import { useCallback, useEffect, useState } from 'react';
import {
  getBrandBrainDashboard,
  BrandBrainDashboardPayload,
} from '../services/brandBrainApi';

/**
 * Read-only Brand Brain dashboard aggregate hook.
 *
 * Fetches the page's one-request payload (onboarding canonical envelope +
 * strategy SIF status + calendar SIF status) on mount and exposes a manual
 * ``refresh``. No polling: the shell stays honest and cheap; live polling is
 * scoped to the Phase 5 health strip if it ever needs it.
 *
 * Pass ``enabled=false`` for the soft-disabled page state: no request is ever
 * fired, no loading/error flicker — the caller renders the feature-flag-off
 * alert instead. Hooks rules stay satisfied (the hook is always called).
 */
export function useBrandBrainDashboard(enabled = true): {
  data: BrandBrainDashboardPayload | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
} {
  const [data, setData] = useState<BrandBrainDashboardPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => {
    setRefreshKey((key) => key + 1);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const payload = await getBrandBrainDashboard();
        if (cancelled) return;
        setData(payload);
        setError(null);
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message || 'Could not load Brand Brain dashboard');
        setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [refreshKey, enabled]);

  return { data, loading, error, refresh };
}