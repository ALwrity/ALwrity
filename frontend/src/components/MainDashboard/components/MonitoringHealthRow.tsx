import React from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import ScheduleIcon from '@mui/icons-material/Schedule';
import RefreshIcon from '@mui/icons-material/Refresh';

import { useMonitoringHealth } from '../../../hooks/useMonitoringHealth';
import type { MonitoringHealthStatus } from '../../../services/monitoringHealthApi';

interface MonitoringHealthRowProps {
  strategyId: number | null;
}

const STATUS_META: Record<
  MonitoringHealthStatus,
  { label: string; color: any; icon: React.ReactElement }
> = {
  healthy: { label: 'Monitoring healthy', color: 'success', icon: <CheckCircleIcon /> },
  degraded: { label: 'Monitoring needs attention', color: 'warning', icon: <WarningIcon /> },
  down: { label: 'Monitoring failing', color: 'error', icon: <ErrorIcon /> },
};

/**
 * MonitoringHealthRow — compact monitoring summary for the main dashboard.
 *
 * Placement: rendered inside `ContentStrategySnapshot` below the metrics
 * section (same slot pattern as `SemanticIndexSnapshotRow`).
 * Unlike that row, errors are NOT swallowed: real failures render an
 * inline Alert with the backend message + Retry. Only the truthful
 * "awaiting first run" state renders as neutral info.
 */
const MonitoringHealthRow: React.FC<MonitoringHealthRowProps> = ({ strategyId }) => {
  const { data, loading, error, awaitingFirstRun, refresh } = useMonitoringHealth({
    strategyId,
    enabled: strategyId !== null,
  });

  if (strategyId === null) return null;

  if (loading && !data) {
    return (
      <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <CircularProgress size={16} />
        <Typography variant="body2" color="text.secondary">
          Checking monitoring health…
        </Typography>
      </Box>
    );
  }

  if (awaitingFirstRun) {
    return (
      <Box
        data-testid="monitoring-health-row"
        sx={{ mt: 2, p: 1.5, bgcolor: 'surface', borderRadius: 1, display: 'flex', alignItems: 'center', gap: 1 }}
      >
        <Chip icon={<ScheduleIcon />} label="Monitoring scheduled" color="info" size="small" variant="outlined" />
        <Typography variant="body2" color="text.secondary">
          Tasks are scheduled — the first run hasn’t completed yet.
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert
        data-testid="monitoring-health-row-error"
        severity="error"
        sx={{ mt: 2 }}
        action={
          <Button color="inherit" size="small" startIcon={<RefreshIcon />} onClick={refresh}>
            Retry
          </Button>
        }
      >
        <Typography variant="body2">Couldn’t load monitoring health: {error}</Typography>
      </Alert>
    );
  }

  if (!data) return null;

  const meta = STATUS_META[data.status];
  const passed = data.executedTasks - (data.byResult.failed ?? 0);

  return (
    <Box
      data-testid="monitoring-health-row"
      sx={{ mt: 2, p: 1.5, bgcolor: 'surface', borderRadius: 1, display: 'flex', alignItems: 'center', gap: 1 }}
    >
      <Chip icon={meta.icon} label={meta.label} color={meta.color} size="small" variant="outlined" />
      <Typography variant="body2" color="text.secondary">
        {passed}/{data.executedTasks} tasks passing
        {data.overdueCount > 0 ? ` · ${data.overdueCount} overdue` : ''}
        {data.lastExecuted ? ` · last run ${new Date(data.lastExecuted).toLocaleString()}` : ''}.
      </Typography>
    </Box>
  );
};

export default MonitoringHealthRow;
