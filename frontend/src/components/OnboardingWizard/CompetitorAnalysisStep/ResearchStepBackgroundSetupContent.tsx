import React from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  LinearProgress,
  Switch,
  Typography,
  Collapse,
  Alert,
  Tooltip,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import type { OnboardingScheduledTaskHealthItem } from '../../../api/seoDashboard';
import type { useResearchStepBackgroundSetup } from './useResearchStepBackgroundSetup';
import {
  HEALTH_TO_PREFS,
  ORDERED_TASK_KEYS,
  STATUS_UI_MAP,
  TASK_ICONS,
} from './researchStepBackgroundSetupConstants';

export type BackgroundSetupContentState = ReturnType<typeof useResearchStepBackgroundSetup>;

interface ResearchStepBackgroundSetupContentProps extends BackgroundSetupContentState {}

export const ResearchStepBackgroundSetupContent: React.FC<ResearchStepBackgroundSetupContentProps> = ({
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
}) => {
  const renderTaskCard = (healthKey: string) => {
    const task: OnboardingScheduledTaskHealthItem | undefined = taskHealth?.tasks?.[healthKey];
    const prefKey = HEALTH_TO_PREFS[healthKey];
    const pref = prefs?.tasks?.[prefKey];
    const status = task?.status || 'not_scheduled';
    const ui = STATUS_UI_MAP[status] || STATUS_UI_MAP.not_scheduled;
    const isRunning = running[healthKey] || polling[healthKey];
    const hasResults = !!(task?.result_summary || task?.latest_execution?.result_summary);
    const resultSummary = task?.result_summary || task?.latest_execution?.result_summary;
    const lastDate = task?.last_success || task?.latest_execution?.execution_date;

    return (
      <Box
        key={healthKey}
        sx={{
          px: { xs: 2, md: 3 },
          py: 2,
          borderBottom: '1px solid #f1f5f9',
          '&:last-child': { borderBottom: 'none' },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, flexWrap: { xs: 'wrap', sm: 'nowrap' } }}>
          <Typography sx={{ fontSize: 18, mt: 0.2 }}>{TASK_ICONS[prefKey] || '📋'}</Typography>
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
              {isRunning && <CircularProgress size={12} sx={{ ml: 0.5 }} />}
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
            <Tooltip
              title={
                isRunning
                  ? 'Task is running'
                  : status === 'not_scheduled'
                    ? 'This task has not been created yet'
                    : 'Run this task immediately'
              }
            >
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
              <Typography variant="caption" sx={{ color: '#94a3b8' }}>No execution data yet.</Typography>
            )}
          </Box>
        </Collapse>
      </Box>
    );
  };

  return (
    <Box data-testid="research-background-setup-content">
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={32} />
        </Box>
      )}

      {loadError && (
        <Box sx={{ p: 3 }}>
          <Alert
            severity="warning"
            action={
              <Button size="small" color="inherit" onClick={fetchData}>
                Retry
              </Button>
            }
          >
            {loadError}
          </Alert>
        </Box>
      )}

      {!loading && (taskHealth || prefs) && ORDERED_TASK_KEYS.map((key) => renderTaskCard(key))}

      {!loading && !taskHealth && !prefs && !loadError && (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="body2" sx={{ color: '#94a3b8' }}>
            No task data available yet. Complete the Website step first to schedule background tasks.
          </Typography>
        </Box>
      )}

    </Box>
  );
};
