import React from 'react';
import { Box, Chip, CircularProgress, Stack, Typography } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import ScheduleIcon from '@mui/icons-material/Schedule';
import SyncIcon from '@mui/icons-material/Sync';
import InfoIcon from '@mui/icons-material/Info';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';

import { useStrategySifStatus } from '../../../hooks/useStrategySifStatus';

const SemanticIndexSnapshotRow: React.FC = () => {
  const { data, loading, error } = useStrategySifStatus({ enabled: true });

  // Graceful degradation: if the read-only status endpoint errors, render
  // nothing (same behavior as the Phase 2 card on the Content Strategy tab).
  if (error) return null;

  if (loading || !data) {
    return (
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 2 }}>
        <CircularProgress size={16} />
        <Typography variant="body2" color="text.secondary">
          Checking indexing status…
        </Typography>
      </Stack>
    );
  }

  const phase = data.indexing?.phase ?? 'not_indexed';
  const count = data.indexing?.embedding_count ?? data.watermark?.embedding_count ?? 0;

  const getStatus = (): { label: string; color: any; body: string } => {
    switch (phase) {
      case 'pending':
        return {
          label: 'Indexing scheduled',
          color: 'info',
          body: 'Indexing runs in the background.',
        };
      case 'running':
        return {
          label: 'Indexing in progress',
          color: 'primary',
          body: 'Indexing runs in the background — your work is unaffected.',
        };
      case 'success':
        return {
          label: 'Indexed & searchable',
          color: 'success',
          body: `${count} documents prepared for AI-powered search.`,
        };
      case 'skipped':
        return {
          label: 'No changes to index',
          color: 'default',
          body: 'Your strategy hasn’t changed since the last indexing pass.',
        };
      case 'failed':
        return {
          label: 'Indexing needs attention',
          color: 'error',
          body: data.indexing?.error_message || 'The index could not be updated.',
        };
      case 'no_active_strategy':
        return {
          label: 'No active strategy',
          color: 'info',
          body: 'Activate a content strategy to enable AI-powered search.',
        };
      case 'not_indexed':
      default:
        return {
          label: 'Not yet indexed',
          color: 'default',
          body: 'Re-activating your strategy schedules the first indexing pass.',
        };
    }
  };

  const status = getStatus();

  return (
    <Box
      data-testid="semantic-index-snapshot-row"
      sx={{ mt: 2, p: 1.5, bgcolor: 'surface', borderRadius: 1, display: 'flex', alignItems: 'center', gap: 1 }}
    >
      <Chip
        icon={getIconFor(phase)}
        label={status.label}
        color={status.color}
        size="small"
        variant="outlined"
      />
      <Typography variant="body2" color="text.secondary">
        {status.body}
      </Typography>
    </Box>
  );
};

const getIconFor = (phase: string): React.ReactElement => {
  switch (phase) {
    case 'pending':
      return <ScheduleIcon />;
    case 'running':
      return <SyncIcon />;
    case 'success':
      return <CheckCircleIcon />;
    case 'failed':
      return <ErrorIcon />;
    case 'no_active_strategy':
      return <InfoIcon />;
    default:
      return <HourglassEmptyIcon />;
  }
};

export default SemanticIndexSnapshotRow;