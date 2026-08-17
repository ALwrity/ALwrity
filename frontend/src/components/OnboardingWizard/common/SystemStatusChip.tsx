import React from 'react';
import { Box, Chip, Typography, Tooltip } from '@mui/material';
import { keyframes } from '@mui/system';

const pulse = keyframes`
  0% { opacity: 0.6; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.05); }
  100% { opacity: 0.6; transform: scale(1); }
`;

interface TaskInfo {
  status: string;
  progress_pct?: number;
  recurring?: boolean;
}

interface SystemStatusChipProps {
  activeTasks: number;
  totalTasks: number;
  tasks?: Record<string, TaskInfo>;
}

const TASK_LABELS: Record<string, string> = {
  'full_site_seo_audit': 'SEO Audit',
  'deep_competitor_analysis': 'Competitor Analysis',
  'sif_indexing': 'SIF Indexing',
  'market_trends': 'Market Trends',
  'advertools': 'Advertools',
  'deep_website_crawl': 'Site Crawl',
};

const SystemStatusChip: React.FC<SystemStatusChipProps> = ({ activeTasks, totalTasks, tasks }) => {
  const runningTasks = tasks
    ? Object.entries(tasks).filter(([, t]) => t.status === 'running')
    : [];

  const pendingTasks = tasks
    ? Object.entries(tasks).filter(([, t]) => t.status === 'pending')
    : [];

  const completedTasks = tasks
    ? Object.entries(tasks).filter(([, t]) => t.status === 'completed')
    : [];

  const failedTasks = tasks
    ? Object.entries(tasks).filter(([, t]) => t.status === 'failed')
    : [];

  const hasRecurring = tasks
    ? Object.values(tasks).some((t) => t.recurring)
    : false;

  const tooltipContent = (
    <Box sx={{ fontSize: '0.8rem' }}>
      {runningTasks.length > 0 && (
        <>
          <Box sx={{ fontWeight: 600, mb: 0.5 }}>Running:</Box>
          {runningTasks.map(([key, t]) => (
            <Box key={key} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, mb: 0.25 }}>
              <span>{TASK_LABELS[key] || key}{t.recurring ? ' ↻' : ''}</span>
              <span>{t.progress_pct || 0}%</span>
            </Box>
          ))}
        </>
      )}
      {pendingTasks.length > 0 && (
        <>
          <Box sx={{ fontWeight: 600, mb: 0.5, mt: runningTasks.length > 0 ? 1 : 0, color: '#64748b' }}>Pending:</Box>
          {pendingTasks.map(([key]) => (
            <Box key={key} sx={{ mb: 0.25, color: '#64748b' }}>
              {TASK_LABELS[key] || key}
            </Box>
          ))}
        </>
      )}
      {completedTasks.length > 0 && (
        <>
          <Box sx={{ fontWeight: 600, mb: 0.5, mt: (runningTasks.length > 0 || pendingTasks.length > 0) ? 1 : 0, color: '#16a34a' }}>Done:</Box>
          {completedTasks.map(([key, t]) => (
            <Box key={key} sx={{ mb: 0.25, color: '#16a34a' }}>
              {TASK_LABELS[key] || key}{t.recurring ? ' ↻' : ''}
            </Box>
          ))}
        </>
      )}
      {failedTasks.length > 0 && (
        <>
          <Box sx={{ fontWeight: 600, mb: 0.5, mt: (runningTasks.length > 0 || pendingTasks.length > 0 || completedTasks.length > 0) ? 1 : 0, color: '#dc2626' }}>Failed:</Box>
          {failedTasks.map(([key]) => (
            <Box key={key} sx={{ mb: 0.25, color: '#dc2626' }}>
              {TASK_LABELS[key] || key}
            </Box>
          ))}
        </>
      )}
      {hasRecurring && (
        <Box sx={{ fontSize: '0.7rem', color: '#64748b', mt: 1, borderTop: '1px solid #e2e8f0', pt: 0.75 }}>
          ↻ recurring / scheduled task
        </Box>
      )}
    </Box>
  );

  return (
    <Box sx={{ px: 2, pb: 0.5, display: 'flex', justifyContent: 'center' }}>
      <Tooltip title={tooltipContent} arrow placement="bottom">
        <Chip
          icon={
            <Box
              component="span"
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: failedTasks.length > 0 ? '#ef4444' : '#4caf50',
                display: 'inline-block',
                ml: 0.5,
                animation: `${pulse} 2s ease-in-out infinite`,
              }}
            />
          }
          label={
            <Typography variant="caption" sx={{ fontWeight: 500, color: 'text.secondary' }}>
              {tasks
                ? runningTasks.length + pendingTasks.length > 0
                  ? `${runningTasks.length} running · ${completedTasks.length} done`
                  : failedTasks.length > 0
                    ? `${failedTasks.length} failed · ${completedTasks.length} done`
                    : `All ${totalTasks} tasks complete`
                : activeTasks > 0
                  ? `${activeTasks} running`
                  : `All ${totalTasks} tasks complete`}
            </Typography>
          }
          variant="outlined"
          size="small"
          sx={{
            borderRadius: 2,
            borderColor: 'success.light',
            bgcolor: 'rgba(76, 175, 80, 0.08)',
            height: 28,
            cursor: 'pointer',
            '& .MuiChip-icon': { ml: 0.5 },
          }}
        />
      </Tooltip>
    </Box>
  );
};

export default SystemStatusChip;
