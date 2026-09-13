import React, { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  CircularProgress,
  MenuItem,
  Select,
  Typography,
} from '@mui/material';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RefreshIcon from '@mui/icons-material/Refresh';

import { useMonitoringHealth } from '../../../hooks/useMonitoringHealth';
import {
  monitoringHealthApi,
  type MonitoringTaskHealth,
} from '../../../services/monitoringHealthApi';
import StrategyErrorBoundary from './StrategyIntelligence/components/StrategyErrorBoundary';

interface MonitoringTasksHealthCardProps {
  strategyId: number | null;
}

const FREQUENCIES = ['Daily', 'Weekly', 'Monthly', 'Quarterly'] as const;

const RESULT_COLOR: Record<string, any> = {
  success: 'success',
  failed: 'error',
  skipped: 'warning',
  running: 'info',
};

/**
 * MonitoringTasksHealthCard — per-task health + constrained schedule editing
 * for the Content Planning dashboard (Strategy tab).
 *
 * Editing is deliberately constrained to `frequency` + pause/resume, matching
 * the backend PATCH contract. Metric/tool edits are never offered — they
 * would break the deterministic TOOL_REGISTRY mapping.
 * Every mutation error renders inline with the real backend message; the
 * card never pretends a failed save succeeded.
 */
const MonitoringTasksHealthCardInner: React.FC<MonitoringTasksHealthCardProps> = ({
  strategyId,
}) => {
  const { data, loading, error, awaitingFirstRun, refresh } = useMonitoringHealth({
    strategyId,
    enabled: strategyId !== null,
  });
  const [savingId, setSavingId] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  if (strategyId === null) return null;

  const handleScheduleChange = async (
    task: MonitoringTaskHealth,
    patch: { frequency?: string; status?: 'active' | 'paused' },
  ) => {
    setSavingId(task.id);
    setSaveError(null);
    try {
      await monitoringHealthApi.updateTaskSchedule(strategyId, task.id, patch);
      refresh();
    } catch (e: any) {
      // Real backend message surfaces inline; list refreshes only on success.
      setSaveError(`Task “${task.title}”: ${e?.message || 'save failed'}`);
    } finally {
      setSavingId(null);
    }
  };

  const renderBody = () => {
    if (loading && !data) {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 2 }}>
          <CircularProgress size={20} />
          <Typography variant="body2" color="text.secondary">
            Loading monitoring tasks…
          </Typography>
        </Box>
      );
    }
    if (awaitingFirstRun) {
      return (
        <Alert severity="info" sx={{ m: 2 }}>
          Monitoring tasks are scheduled — the first run hasn’t completed yet. Results
          appear here automatically.
        </Alert>
      );
    }
    if (error) {
      return (
        <Alert
          severity="error"
          sx={{ m: 2 }}
          action={
            <Button color="inherit" size="small" startIcon={<RefreshIcon />} onClick={refresh}>
              Retry
            </Button>
          }
        >
          Couldn’t load monitoring tasks: {error}
        </Alert>
      );
    }
    if (!data || data.tasks.length === 0) return null;

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {data.tasks.map((task) => {
          const paused = task.status === 'paused';
          const busy = savingId === task.id;
          return (
            <Box
              key={task.id}
              sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Typography variant="body2" sx={{ fontWeight: 600, flexGrow: 1 }}>
                  {task.title}
                </Typography>
                {task.lastResult && (
                  <Chip
                    label={task.lastResult}
                    color={RESULT_COLOR[task.lastResult] ?? 'default'}
                    size="small"
                  />
                )}
                {paused && <Chip label="paused" size="small" variant="outlined" />}
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                {task.metric} · {task.assignee}
                {task.lastExecuted
                  ? ` · last run ${new Date(task.lastExecuted).toLocaleString()}`
                  : ' · never run'}
                {task.nextExecution
                  ? ` · next ${new Date(task.nextExecution).toLocaleString()}`
                  : ''}
              </Typography>
              {task.lastError && (
                <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>
                  Last error: {task.lastError}
                </Typography>
              )}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                <Select
                  value={task.frequency}
                  size="small"
                  disabled={busy}
                  onChange={(e) => handleScheduleChange(task, { frequency: e.target.value })}
                  aria-label={`Frequency for ${task.title}`}
                >
                  {FREQUENCIES.map((f) => (
                    <MenuItem key={f} value={f}>
                      {f}
                    </MenuItem>
                  ))}
                </Select>
                <Button
                  size="small"
                  variant="outlined"
                  disabled={busy}
                  startIcon={paused ? <PlayArrowIcon /> : <PauseIcon />}
                  onClick={() =>
                    handleScheduleChange(task, { status: paused ? 'active' : 'paused' })
                  }
                >
                  {paused ? 'Resume' : 'Pause'}
                </Button>
                {busy && <CircularProgress size={16} />}
              </Box>
            </Box>
          );
        })}
      </Box>
    );
  };

  return (
    <Card data-testid="monitoring-tasks-health-card" sx={{ mt: 3 }}>
      <CardHeader
        avatar={<MonitorHeartIcon color="primary" />}
        title="Monitoring tasks"
        subheader={
          data
            ? `${data.executedTasks}/${data.totalTasks} executed · ${data.status}`
            : 'Live health from scheduled monitoring runs'
        }
        action={
          <Button size="small" startIcon={<RefreshIcon />} onClick={refresh}>
            Refresh
          </Button>
        }
      />
      <CardContent>
        {saveError && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setSaveError(null)}>
            {saveError}
          </Alert>
        )}
        {renderBody()}
      </CardContent>
    </Card>
  );
};

/** Boundary-wrapped export: render crashes in this card never take down the tab. */
const MonitoringTasksHealthCard: React.FC<MonitoringTasksHealthCardProps> = (props) => (
  <StrategyErrorBoundary>
    <MonitoringTasksHealthCardInner {...props} />
  </StrategyErrorBoundary>
);

export default MonitoringTasksHealthCard;
