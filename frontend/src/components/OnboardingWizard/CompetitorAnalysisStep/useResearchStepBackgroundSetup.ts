import { useCallback, useEffect, useRef, useState } from 'react';
import { longRunningApiClient, apiClient } from '../../../api/client';
import { seoDashboardAPI } from '../../../api/seoDashboard';
import type { OnboardingScheduledTaskHealthResponse } from '../../../api/seoDashboard';
import {
  POLL_INITIAL_INTERVAL,
  POLL_MAX_ATTEMPTS,
  TaskPreferencesResponse,
} from './researchStepBackgroundSetupConstants';

export function useResearchStepBackgroundSetup(active: boolean) {
  const [taskHealth, setTaskHealth] = useState<OnboardingScheduledTaskHealthResponse | null>(null);
  const [prefs, setPrefs] = useState<TaskPreferencesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [running, setRunning] = useState<Record<string, boolean>>({});
  const [runError, setRunError] = useState<Record<string, string | null>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [polling, setPolling] = useState<Record<string, boolean>>({});

  const pollTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const pollAttempts = useRef<Record<string, number>>({});
  const hasFetched = useRef(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [healthRes, prefsRes] = await Promise.allSettled([
        seoDashboardAPI.getOnboardingTaskHealth(),
        apiClient.get('/api/onboarding/step2/task-preferences'),
      ]);
      const errParts: string[] = [];
      if (healthRes.status === 'fulfilled') {
        setTaskHealth(healthRes.value);
      } else {
        errParts.push('task health');
      }
      if (prefsRes.status === 'fulfilled') {
        setPrefs(prefsRes.value.data);
      } else {
        errParts.push('task preferences');
      }
      if (errParts.length) {
        setLoadError(`Failed to load ${errParts.join(' and ')}. Some data may be unavailable.`);
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to load task data';
      setLoadError(message);
      console.error('[useResearchStepBackgroundSetup] fetchData failed:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!active) return;

    if (!hasFetched.current) {
      setTaskHealth(null);
      setPrefs(null);
      setLoadError(null);
      setRunning({});
      setRunError({});
      setExpanded({});
      setPolling({});
      Object.values(pollTimers.current).forEach(clearTimeout);
      pollTimers.current = {};
      pollAttempts.current = {};
      hasFetched.current = true;
      fetchData();
    }
  }, [active, fetchData]);

  useEffect(() => {
    if (!active) {
      hasFetched.current = false;
    }
  }, [active]);

  useEffect(() => {
    return () => {
      Object.values(pollTimers.current).forEach(clearTimeout);
    };
  }, []);

  const handleToggle = async (prefKey: string, enabled: boolean) => {
    if (!prefs?.tasks?.[prefKey]) return;
    const updatedTasks = {
      ...prefs.tasks,
      [prefKey]: { ...prefs.tasks[prefKey], enabled },
    };
    setPrefs({ ...prefs, tasks: updatedTasks });
    setSaving((s) => ({ ...s, [prefKey]: true }));
    try {
      const payload: Record<string, { enabled: boolean; delay_mins: number }> = {};
      for (const [k, v] of Object.entries(updatedTasks)) {
        payload[k] = { enabled: v.enabled, delay_mins: v.delay_mins };
      }
      await longRunningApiClient.put('/api/onboarding/step2/task-preferences', { tasks: payload });
    } catch (e) {
      console.error('[useResearchStepBackgroundSetup] handleToggle failed:', e);
      setPrefs(prefs);
    } finally {
      setSaving((s) => ({ ...s, [prefKey]: false }));
    }
  };

  const pollHealth = useCallback((healthKey: string) => {
    if (pollAttempts.current[healthKey] === undefined) {
      pollAttempts.current[healthKey] = 0;
    }
    if (pollAttempts.current[healthKey] >= POLL_MAX_ATTEMPTS) {
      setPolling((s) => ({ ...s, [healthKey]: false }));
      setRunning((s) => ({ ...s, [healthKey]: false }));
      setRunError((s) => ({ ...s, [healthKey]: 'Task still running in background — check back soon.' }));
      return;
    }
    pollAttempts.current[healthKey] += 1;

    const interval =
      pollAttempts.current[healthKey] > 10
        ? POLL_INITIAL_INTERVAL * 3
        : pollAttempts.current[healthKey] > 5
          ? POLL_INITIAL_INTERVAL * 2
          : POLL_INITIAL_INTERVAL;

    pollTimers.current[healthKey] = setTimeout(async () => {
      try {
        const health = await seoDashboardAPI.getOnboardingTaskHealth();
        setTaskHealth(health);
        const task = health.tasks?.[healthKey];
        const execStatus = task?.latest_execution?.status;
        if (execStatus === 'success' || execStatus === 'failed') {
          setPolling((s) => ({ ...s, [healthKey]: false }));
          setRunning((s) => ({ ...s, [healthKey]: false }));
          if (execStatus === 'failed') {
            setRunError((s) => ({
              ...s,
              [healthKey]: task?.latest_execution?.error_message || 'Task failed',
            }));
          }
          return;
        }
        pollHealth(healthKey);
      } catch (e) {
        console.warn('[useResearchStepBackgroundSetup] pollHealth retry:', e);
        pollHealth(healthKey);
      }
    }, interval);
  }, []);

  const handleRunNow = async (healthKey: string) => {
    const task = taskHealth?.tasks?.[healthKey];
    if (!task?.task_id || !task?.task_type) return;
    setRunning((s) => ({ ...s, [healthKey]: true }));
    setRunError((s) => ({ ...s, [healthKey]: null }));
    try {
      await longRunningApiClient.post(`/api/scheduler/tasks/${task.task_type}/${task.task_id}/manual-trigger`);
      setPolling((s) => ({ ...s, [healthKey]: true }));
      pollAttempts.current[healthKey] = 0;
      pollHealth(healthKey);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } }; message?: string };
      setRunning((s) => ({ ...s, [healthKey]: false }));
      setRunError((s) => ({
        ...s,
        [healthKey]: err?.response?.data?.detail || err?.message || 'Failed to trigger task',
      }));
      console.error('[useResearchStepBackgroundSetup] handleRunNow failed:', e);
    }
  };

  const toggleExpanded = (key: string) => {
    setExpanded((s) => ({ ...s, [key]: !s[key] }));
  };

  return {
    taskHealth,
    prefs,
    loading,
    loadError,
    running,
    runError,
    saving,
    expanded,
    polling,
    fetchData,
    handleToggle,
    handleRunNow,
    toggleExpanded,
  };
}
