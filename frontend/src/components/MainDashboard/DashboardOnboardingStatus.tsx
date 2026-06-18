import React, { useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Chip,
  IconButton,
  Skeleton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import ScheduleIcon from '@mui/icons-material/Schedule';
import { keyframes } from '@mui/system';

const pulse = keyframes`
  0% { opacity: 0.6; }
  50% { opacity: 1; }
  100% { opacity: 0.6; }
`;

interface TaskInfo {
  status: string;
  started_at: string | null;
  progress_pct: number;
  scheduled_at?: string;
}

interface DashboardOnboardingStatusProps {
  tasks: Record<string, TaskInfo>;
  total: number;
  completed_count: number;
  failed_count: number;
  all_done: boolean;
  onDismiss: () => void;
}

const TASK_DISPLAY_NAMES: Record<string, string> = {
  full_site_seo_audit: 'Full-Site SEO Audit',
  market_trends: 'Market Trends',
  deep_competitor_analysis: 'Deep Competitor Analysis',
  research_persona: 'Research Persona',
  facebook_persona: 'Facebook Persona',
  sif_indexing: 'Site Indexing (SIF)',
  advertools: 'Advertools Intelligence',
  deep_website_crawl: 'Deep Website Crawl',
};

const getElapsed = (startedAt: string | null): string => {
  if (!startedAt) return '';
  const diff = Date.now() - new Date(startedAt).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m ago`;
};

const statusColor = (status: string): string => {
  if (status === 'completed' || status === 'success') return 'success.main';
  if (status === 'failed' || status === 'error') return 'error.main';
  if (status === 'running' || status === 'active') return 'info.main';
  return 'text.disabled';
};

const DashboardOnboardingStatus: React.FC<DashboardOnboardingStatusProps> = ({
  tasks,
  total,
  completed_count,
  failed_count,
  all_done,
  onDismiss,
}) => {
  // Auto-dismiss 3s after all tasks complete
  useEffect(() => {
    if (all_done) {
      const timer = setTimeout(onDismiss, 3000);
      return () => clearTimeout(timer);
    }
  }, [all_done, onDismiss]);

  const anyLoaded = total > 0;

  if (!anyLoaded) {
    return (
      <Card sx={{ mb: 2, borderRadius: 3 }}>
        <CardContent>
          <Skeleton width="60%" height={28} sx={{ mb: 1 }} />
          <Skeleton width="40%" height={20} />
        </CardContent>
      </Card>
    );
  }

  const failedTasks = Object.entries(tasks).filter(
    ([, t]) => t.status === 'failed' || t.status === 'error',
  );

  return (
    <Card
      sx={{
        mb: 2,
        borderRadius: 3,
        border: all_done ? '1px solid' : '1px solid',
        borderColor: failed_count > 0 ? 'error.light' : all_done ? 'success.light' : 'info.light',
        bgcolor: all_done ? 'rgba(76, 175, 80, 0.04)' : 'background.paper',
        overflow: 'visible',
      }}
    >
      <CardContent sx={{ pb: '12px !important' }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {all_done ? (
              <CheckCircleIcon sx={{ color: 'success.main', fontSize: 20 }} />
            ) : failed_count > 0 ? (
              <ErrorIcon sx={{ color: 'error.main', fontSize: 20 }} />
            ) : (
              <Box
                sx={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  bgcolor: 'info.main',
                  animation: `${pulse} 1.5s ease-in-out infinite`,
                }}
              />
            )}
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              {all_done
                ? 'Setup complete!'
                : failed_count > 0
                  ? `${failed_count} task${failed_count > 1 ? 's' : ''} failed`
                  : 'Your Marketing OS is setting up'}
            </Typography>
          </Box>
          <IconButton size="small" onClick={onDismiss} sx={{ ml: 1 }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* Task list */}
        {Object.entries(tasks).map(([key, task]) => {
          const displayName = TASK_DISPLAY_NAMES[key] || key.replace(/_/g, ' ');
          const isRunning = task.status === 'running' || task.status === 'active';
          const isComplete = task.status === 'completed' || task.status === 'success';
          const isFailed = task.status === 'failed' || task.status === 'error';
          const isPending = task.status === 'pending' || (!task.started_at && !isComplete && !isFailed);

          return (
            <Box key={key} sx={{ mb: 1.5, '&:last-child': { mb: 0 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.25 }}>
                <Typography variant="caption" sx={{ fontWeight: 500, color: 'text.secondary' }}>
                  {displayName}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  {isComplete && <CheckCircleIcon sx={{ fontSize: 14, color: 'success.main' }} />}
                  {isFailed && <ErrorIcon sx={{ fontSize: 14, color: 'error.main' }} />}
                  {isPending && <ScheduleIcon sx={{ fontSize: 14, color: 'text.disabled' }} />}
                  <Chip
                    label={isPending ? 'pending' : isRunning ? 'running' : isComplete ? 'done' : 'failed'}
                    size="small"
                    sx={{
                      height: 18,
                      fontSize: 10,
                      fontWeight: 600,
                      bgcolor:
                        isComplete ? 'rgba(76, 175, 80, 0.1)' :
                        isFailed ? 'rgba(244, 67, 54, 0.1)' :
                        isRunning ? 'rgba(33, 150, 243, 0.1)' :
                        'rgba(158, 158, 158, 0.1)',
                      color:
                        isComplete ? 'success.main' :
                        isFailed ? 'error.main' :
                        isRunning ? 'info.main' :
                        'text.disabled',
                    }}
                  />
                </Box>
              </Box>
              {isRunning && (
                <LinearProgress
                  variant="determinate"
                  value={task.progress_pct}
                  sx={{
                    height: 4,
                    borderRadius: 2,
                    bgcolor: 'rgba(33, 150, 243, 0.12)',
                    '& .MuiLinearProgress-bar': {
                      bgcolor: 'info.main',
                    },
                  }}
                />
              )}
              {isComplete && <LinearProgress variant="determinate" value={100} sx={{ height: 4, borderRadius: 2, bgcolor: 'rgba(76, 175, 80, 0.12)', '& .MuiLinearProgress-bar': { bgcolor: 'success.main' } }} />}
              {isFailed && <LinearProgress variant="determinate" value={100} sx={{ height: 4, borderRadius: 2, bgcolor: 'rgba(244, 67, 54, 0.12)', '& .MuiLinearProgress-bar': { bgcolor: 'error.main' } }} />}
              {(isRunning || isComplete) && task.started_at && (
                <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: 10 }}>
                  {getElapsed(task.started_at)}
                </Typography>
              )}
            </Box>
          );
        })}

        {/* Summary */}
        {!all_done && (
          <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', mt: 1, textAlign: 'center' }}>
            Some analysis results will appear as they complete. You can start using the tool right away.
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};

export default DashboardOnboardingStatus;
