import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiClient, longRunningApiClient } from '../../../../api/client';
import {
  readBackgroundSetupCache,
  writeBackgroundSetupCache,
} from '../backgroundSetupCache';
import {
  AdvertoolsStatusResponse,
  BACKGROUND_SETUP_TAG,
  TASK_DEFAULTS,
  TaskConfig,
} from './constants';

interface UseBackgroundSetupStateOptions {
  websiteUrl: string;
  websiteSessionKey: string;
  brandAnalysis?: any;
  seoAudit?: any;
  onConfigChange?: (prefs: Record<string, { enabled: boolean; delay_mins: number }>) => void;
}

export function useBackgroundSetupState({
  websiteUrl,
  websiteSessionKey,
  brandAnalysis,
  seoAudit,
  onConfigChange,
}: UseBackgroundSetupStateOptions) {
  const [prefs, setPrefs] = useState<Record<string, TaskConfig>>(TASK_DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSeoPreview, setShowSeoPreview] = useState(false);
  const [showSeoResults, setShowSeoResults] = useState(false);
  const [hasSeoResults, setHasSeoResults] = useState(false);
  const [showContentAudit, setShowContentAudit] = useState(false);
  const [advStatus, setAdvStatus] = useState<AdvertoolsStatusResponse | null>(null);
  const [runLoading, setRunLoading] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [lastRunResult, setLastRunResult] = useState<any>(null);
  const [showSiteHealth, setShowSiteHealth] = useState(false);
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [lastHealthRun, setLastHealthRun] = useState<any>(null);

  const fetchAdvStatus = useCallback(async () => {
    try {
      const res = await apiClient.get('/api/onboarding/content-audit/status');
      if (res.data?.success) {
        setAdvStatus(res.data);
        return res.data as AdvertoolsStatusResponse;
      }
    } catch (err) {
      console.error(BACKGROUND_SETUP_TAG, 'Failed to fetch content audit status', err);
    }
    return null;
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiClient.get('/api/onboarding/step2/task-preferences'),
      fetchAdvStatus(),
    ])
      .then(([prefRes]) => {
        if (!cancelled && prefRes.data?.success) {
          setPrefs(prefRes.data.tasks);
          onConfigChange?.(prefRes.data.tasks);
        }
      })
      .catch(() => {
        if (!cancelled) setError('Could not load task preferences');
      });
    return () => {
      cancelled = true;
    };
  }, [fetchAdvStatus, onConfigChange]);

  useEffect(() => {
    if (advStatus?.has_results) {
      if (brandAnalysis && !lastRunResult) {
        setLastRunResult({ audit: brandAnalysis });
      }
      if (seoAudit && !lastHealthRun) {
        setLastHealthRun({ site_health: seoAudit?.site_health || seoAudit });
      }
    }
  }, [advStatus?.has_results, brandAnalysis, seoAudit, lastRunResult, lastHealthRun]);

  useEffect(() => {
    const cachedAudit = readBackgroundSetupCache<{ audit?: unknown }>(
      'contentAudit',
      websiteSessionKey
    );
    if (cachedAudit?.audit) {
      setLastRunResult(cachedAudit);
    }

    const cachedHealth = readBackgroundSetupCache<{ site_health?: unknown; success?: boolean }>(
      'siteHealth',
      websiteSessionKey
    );
    if (cachedHealth?.site_health || cachedHealth?.success) {
      setLastHealthRun(cachedHealth);
    }

    const cachedPreview = readBackgroundSetupCache<{ success?: boolean; pages?: unknown[] }>(
      'seoPreview',
      websiteSessionKey
    );
    if (cachedPreview?.success && cachedPreview?.pages?.length) {
      setHasSeoResults(true);
    }
  }, [websiteSessionKey]);

  const savePreferences = useCallback(
    async (updated: Record<string, TaskConfig>) => {
      const payload: Record<string, { enabled: boolean; delay_mins: number }> = {};
      for (const [k, v] of Object.entries(updated)) {
        payload[k] = { enabled: v.enabled, delay_mins: v.delay_mins };
      }
      setSaving(true);
      try {
        await apiClient.put('/api/onboarding/step2/task-preferences', { tasks: payload });
        onConfigChange?.(payload);
      } catch (err) {
        console.error(BACKGROUND_SETUP_TAG, 'Failed to save preferences', err);
      } finally {
        setSaving(false);
      }
    },
    [onConfigChange]
  );

  const handleToggle = (taskId: string) => {
    if (!prefs) return;
    const updated = {
      ...prefs,
      [taskId]: { ...prefs[taskId], enabled: !prefs[taskId].enabled },
    };
    setPrefs(updated);
    void savePreferences(updated);
  };

  const runContentAudit = async () => {
    setRunLoading(true);
    setRunError(null);
    try {
      const res = await longRunningApiClient.post('/api/onboarding/content-audit/run', {
        website_url: websiteUrl,
      });
      if (res.data?.success || res.data?.audit) {
        setLastRunResult(res.data);
        setShowContentAudit(true);
        writeBackgroundSetupCache('contentAudit', websiteSessionKey, res.data);
      } else {
        setRunError(res.data?.error || 'Content audit returned no results');
      }
    } catch (e: any) {
      setRunError(e?.response?.data?.detail || e?.message || 'Could not run content audit');
    } finally {
      setRunLoading(false);
      void fetchAdvStatus();
    }
  };

  const runSiteHealth = async () => {
    setHealthLoading(true);
    setHealthError(null);
    try {
      const res = await longRunningApiClient.post('/api/onboarding/site-health/run', {
        website_url: websiteUrl,
      });
      if (res.data?.success || res.data?.site_health) {
        setLastHealthRun(res.data);
        setShowSiteHealth(true);
        writeBackgroundSetupCache('siteHealth', websiteSessionKey, res.data);
      } else {
        setHealthError(res.data?.error || 'Site health analysis returned no results');
      }
    } catch (e: any) {
      setHealthError(e?.response?.data?.detail || e?.message || 'Could not run site health analysis');
    } finally {
      setHealthLoading(false);
      void fetchAdvStatus();
    }
  };

  const mergedBrandAnalysis = useMemo(() => {
    const audit = lastRunResult?.audit;
    if (!audit) return brandAnalysis;
    const themes = audit.themes || audit.augmented_themes || brandAnalysis?.augmented_themes;
    return {
      ...(brandAnalysis || {}),
      ...(audit || {}),
      augmented_themes: themes,
      last_advertools_audit: new Date().toISOString(),
    };
  }, [brandAnalysis, lastRunResult]);

  const mergedSeoAudit = useMemo(() => {
    const health = lastHealthRun?.site_health;
    if (!health) return seoAudit;
    return {
      ...(seoAudit || {}),
      site_health: health,
      last_advertools_health_check: new Date().toISOString(),
    };
  }, [seoAudit, lastHealthRun]);

  return {
    prefs,
    saving,
    error,
    showSeoPreview,
    setShowSeoPreview,
    showSeoResults,
    setShowSeoResults,
    hasSeoResults,
    setHasSeoResults,
    setHasSeoResults,
    showContentAudit,
    setShowContentAudit,
    advStatus,
    runLoading,
    runError,
    lastRunResult,
    showSiteHealth,
    setShowSiteHealth,
    healthLoading,
    healthError,
    lastHealthRun,
    handleToggle,
    runContentAudit,
    runSiteHealth,
    mergedBrandAnalysis,
    mergedSeoAudit,
  };
}
