import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  LinearProgress,
  Switch,
  Typography,
  Collapse,
  Alert,
  Tooltip,
} from '@mui/material';
import {
  Close as CloseIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { longRunningApiClient } from '../../../api/client';
import { seoDashboardAPI } from '../../../api/seoDashboard';
import type { OnboardingScheduledTaskHealthResponse, OnboardingScheduledTaskHealthItem } from '../../../api/seoDashboard';

interface TaskPreferences {
  enabled: boolean;
  delay_mins: number;
  label: string;
  description: string;
}

interface TaskPreferencesResponse {
  success: boolean;
  tasks: Record<string, TaskPreferences>;
}

const orderedTaskKeys = [
  'DeepCompetitorAnalysisTask',
  'SIFIndexingTask',
  'MarketTrendsTask',
];

const HEALTH_TO_PREFS: Record<string, string> = {
  DeepCompetitorAnalysisTask: 'deep_competitor_analysis',
  SIFIndexingTask: 'sif_indexing',
  MarketTrendsTask: 'market_trends',
};

const TASK_ICONS: Record<string, string> = {
  deep_competitor_analysis: '🔎',
  sif_indexing: '🧠',
  market_trends: '📈',
};

interface StatusUi {
  label: string;
  color: string;
  bg: string;
  border: string;
}

const statusUiMap: Record<string, StatusUi> = {
  active: { label: 'Active', color: '#22c55e', bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.4)' },
  running: { label: 'Running', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.4)' },
  completed: { label: 'Completed', color: '#22c55e', bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.4)' },
  failed: { label: 'Failed', color: '#ef4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.4)' },
  paused: { label: 'Paused', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.4)' },
  needs_intervention: { label: 'Needs intervention', color: '#f97316', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.4)' },
  not_scheduled: { label: 'Not scheduled', color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.4)' },
  scheduled: { label: 'Scheduled', color: '#64748b', bg: 'rgba(100,116,139,0.12)', border: 'rgba(100,116,139,0.4)' },
};

const POLL_MAX_ATTEMPTS = 20;
const POLL_INITIAL_INTERVAL = 3000;

interface Props {
  open: boolean;
  onClose: () => void;
}

const ResearchStepBackgroundSetupModal: React.FC<Props> = ({ open, onClose }) => {
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

  const fetchData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [healthRes, prefsRes] = await Promise.allSettled([
        seoDashboardAPI.getOnboardingTaskHealth(),
        longRunningApiClient.get('/api/onboarding/step2/task-preferences'),
      ]);
      let errParts: string[] = [];
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
    } catch (e: any) {
      setLoadError(e?.message || 'Failed to load task data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
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
      fetchData();
    }
  }, [open, fetchData]);

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
    } catch {
      setPrefs(prefs);
    } finally {
      setSaving((s) => ({ ...s, [prefKey]: false }));
    }
  };

  const pollHealth = useCallback(
    (healthKey: string) => {
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
        } catch {
          pollHealth(healthKey);
        }
      }, interval);
    },
    [],
  );

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
    } catch (e: any) {
      setRunning((s) => ({ ...s, [healthKey]: false }));
      setRunError((s) => ({
        ...s,
        [healthKey]: e?.response?.data?.detail || e?.message || 'Failed to trigger task',
      }));
    }
  };

  const toggleExpanded = (key: string) => {
    setExpanded((s) => ({ ...s, [key]: !s[key] }));
  };

  if (!open) return null;

  const renderTaskCard = (healthKey: string) => {
    const task: OnboardingScheduledTaskHealthItem | undefined = taskHealth?.tasks?.[healthKey];
    const prefKey = HEALTH_TO_PREFS[healthKey];
    const pref = prefs?.tasks?.[prefKey];
    const status = task?.status || 'not_scheduled';
    const ui = statusUiMap[status] || statusUiMap.not_scheduled;
    const isRunning = running[healthKey] || polling[healthKey];

    const hasResults = !!(task?.result_summary || task?.latest_execution?.result_summary);
    const resultSummary = task?.result_summary || task?.latest_execution?.result_summary;
    const lastDate = task?.last_success || task?.latest_execution?.execution_date;

    return (
      <Box
        key={healthKey}
        sx={{
          px: 3,
          py: 2,
          borderBottom: '1px solid #f1f5f9',
          '&:last-child': { borderBottom: 'none' },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
          <Typography sx={{ fontSize: 18, mt: 0.2 }}>
            {TASK_ICONS[prefKey] || '📋'}
          </Typography>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
              <Typography variant="body2" sx={{ fontWeight: 600, color: '#334155' }}>
                {pref?.label || task?.label || healthKey}
              </Typography>
              <Chip
                size="small"
                label={ui.label}
                sx={{
                  height: 20,
                  fontSize: '0.65rem',
                  fontWeight: 600,
                  color: ui.color,
                  bgcolor: ui.bg,
                  border: `1px solid ${ui.border}`,
                }}
              />
              {isRunning && (
                <CircularProgress size={12} sx={{ ml: 0.5 }} />
              )}
            </Box>
            {pref?.description && (
              <Typography variant="caption" sx={{ color: '#64748b', lineHeight: 1.5 }}>
                {pref.description}
              </Typography>
            )}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 0.5, flexWrap: 'wrap' }}>
              <Chip
                size="small"
                label={`⏱️ ~${pref?.delay_mins === 0 ? 'Now' : pref?.delay_mins ? `${pref.delay_mins}m` : '—'}`}
                variant="outlined"
                sx={{ fontSize: 10, height: 20 }}
              />
              {lastDate && (
                <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                  Last run: {new Date(lastDate).toLocaleString()}
                </Typography>
              )}
            </Box>
            {resultSummary && (
              <Typography variant="caption" sx={{ color: '#475569', display: 'block', mt: 0.5 }}>
                Latest results: {resultSummary}
              </Typography>
            )}
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0, pt: 0.3 }}>
            <Tooltip title={isRunning ? 'Task is running' : status === 'not_scheduled' ? 'This task has not been created yet' : 'Run this task immediately'}>
              <span>
                <Button
                  size="small"
                  variant="outlined"
                  disabled={isRunning || status === 'not_scheduled' || !task?.task_id}
                  startIcon={isRunning ? <CircularProgress size={12} /> : <RefreshIcon sx={{ fontSize: 14 }} />}
                  onClick={() => handleRunNow(healthKey)}
                  sx={{
                    textTransform: 'none',
                    fontSize: 11,
                    color: '#3b82f6',
                    borderColor: '#3b82f6',
                    '&:hover': { bgcolor: 'rgba(59,130,246,0.08)', borderColor: '#2563eb' },
                  }}
                >
                  {isRunning ? 'Running…' : 'Run Now'}
                </Button>
              </span>
            </Tooltip>

            {hasResults && !isRunning && (
              <Button
                size="small"
                variant="text"
                onClick={() => toggleExpanded(healthKey)}
                sx={{ textTransform: 'none', fontSize: 11, color: '#64748b' }}
              >
                {expanded[healthKey] ? 'Hide Results' : 'View Results'}
              </Button>
            )}

            {saving[prefKey] ? (
              <CircularProgress size={16} sx={{ ml: 0.5 }} />
            ) : (
              <Switch
                size="small"
                checked={pref?.enabled ?? false}
                onChange={() => handleToggle(prefKey, !pref?.enabled)}
                color="primary"
              />
            )}
          </Box>
        </Box>

        {runError[healthKey] && (
          <Typography variant="caption" sx={{ color: '#ef4444', display: 'block', mt: 1, ml: 4 }}>
            {runError[healthKey]}
          </Typography>
        )}

        {isRunning && (
          <Box sx={{ ml: 4, mt: 1 }}>
            <LinearProgress sx={{ height: 4, borderRadius: 2 }} />
            <Typography variant="caption" sx={{ color: '#64748b', mt: 0.5, display: 'block' }}>
              Running task — results will appear here when complete…
            </Typography>
          </Box>
        )}

        <Collapse in={expanded[healthKey]}>
          <Box sx={{ ml: 4, mt: 1.5, p: 2, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0' }}>
            <Typography variant="caption" sx={{ color: '#475569', fontWeight: 600, display: 'block', mb: 0.5 }}>
              Latest Execution Details
            </Typography>
            {task?.latest_execution ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <Typography variant="caption" sx={{ color: '#64748b' }}>
                  Status: {task.latest_execution.status || 'unknown'}
                </Typography>
                {task.latest_execution.execution_date && (
                  <Typography variant="caption" sx={{ color: '#64748b' }}>
                    Date: {new Date(task.latest_execution.execution_date).toLocaleString()}
                  </Typography>
                )}
                {task.latest_execution.execution_time_ms != null && (
                  <Typography variant="caption" sx={{ color: '#64748b' }}>
                    Duration: {(task.latest_execution.execution_time_ms / 1000).toFixed(1)}s
                  </Typography>
                )}
                {task.result_summary && (
                  <Typography variant="caption" sx={{ color: '#334155', fontWeight: 500 }}>
                    Result: {task.result_summary}
                  </Typography>
                )}
                {task.latest_execution.error_message && (
                  <Typography variant="caption" sx={{ color: '#ef4444' }}>
                    Error: {task.latest_execution.error_message}
                  </Typography>
                )}
              </Box>
            ) : (
              <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                No execution data yet.
              </Typography>
            )}
          </Box>
        </Collapse>
      </Box>
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: '#ffffff',
          borderRadius: 3,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          maxHeight: '85vh',
        },
      }}
    >
      <DialogTitle
        sx={{
          pb: 1.5,
          backgroundColor: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#1e293b' }}>
            ⚙️ Smart Background Setup
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748b', mt: 0.25 }}>
            {(() => {
              if (!prefs?.tasks) return 'Loading tasks…';
              const ourKeys = Object.values(HEALTH_TO_PREFS);
              const relevant = Object.entries(prefs.tasks).filter(([k]) => ourKeys.includes(k));
              const enabled = relevant.filter(([, t]) => t.enabled).length;
              return `${enabled} of ${relevant.length} tasks enabled — these run in the background. Run any task now to test immediately.`;
            })()}
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 0, backgroundColor: '#ffffff' }}>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={32} />
          </Box>
        )}

        {loadError && (
          <Box sx={{ p: 3 }}>
            <Alert severity="warning" action={
              <Button size="small" color="inherit" onClick={fetchData}>
                Retry
              </Button>
            }>
              {loadError}
            </Alert>
          </Box>
        )}

        {!loading && (taskHealth || prefs) && orderedTaskKeys.map((key) => renderTaskCard(key))}

        {!loading && !taskHealth && !prefs && !loadError && (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="body2" sx={{ color: '#94a3b8' }}>
              No task data available yet. Complete the Website step first to schedule background tasks.
            </Typography>
          </Box>
        )}

        {!loading && taskHealth && (
          <Box sx={{ px: 3, py: 2, borderTop: '1px solid #e2e8f0', bgcolor: '#f8fafc' }}>
            <Typography variant="caption" sx={{ color: '#94a3b8' }}>
              Last updated: {new Date(taskHealth.last_updated).toLocaleString()}
            </Typography>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ResearchStepBackgroundSetupModal;
