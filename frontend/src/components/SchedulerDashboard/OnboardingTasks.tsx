import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  CircularProgress,
  Collapse,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import SuccessIcon from '@mui/icons-material/CheckCircle';
import FailedIcon from '@mui/icons-material/ErrorOutline';
import ScheduleIcon from '@mui/icons-material/Schedule';
import PausedIcon from '@mui/icons-material/PauseCircle';
import InterventionIcon from '@mui/icons-material/WarningAmber';
import ActiveIcon from '@mui/icons-material/Autorenew';
import { useAuth } from '@clerk/clerk-react';
import { getOnboardingTasks, type OnboardingTask } from '../../api/schedulerDashboard';
import { TerminalPaper, terminalColors } from './terminalTheme';

const statusIcon = (status: string) => {
  switch (status) {
    case 'active': return <ActiveIcon sx={{ fontSize: 16, color: '#4caf50' }} />;
    case 'completed': return <SuccessIcon sx={{ fontSize: 16, color: '#2196f3' }} />;
    case 'failed': return <FailedIcon sx={{ fontSize: 16, color: '#f44336' }} />;
    case 'needs_intervention': return <InterventionIcon sx={{ fontSize: 16, color: '#ff9800' }} />;
    case 'paused': return <PausedIcon sx={{ fontSize: 16, color: '#6b7280' }} />;
    default: return <ScheduleIcon sx={{ fontSize: 16, color: '#8b9cf7' }} />;
  }
};

const statusChipColor = (status: string) => {
  switch (status) {
    case 'active': return { bg: 'rgba(76,175,80,0.15)', color: '#4caf50' };
    case 'completed': return { bg: 'rgba(33,150,243,0.15)', color: '#2196f3' };
    case 'failed': return { bg: 'rgba(244,67,54,0.15)', color: '#f44336' };
    case 'needs_intervention': return { bg: 'rgba(255,152,0,0.15)', color: '#ff9800' };
    case 'paused': return { bg: 'rgba(107,114,128,0.15)', color: '#6b7280' };
    default: return { bg: 'rgba(139,156,247,0.15)', color: '#8b9cf7' };
  }
};

const formatRelativeTime = (iso: string | null): string => {
  if (!iso) return 'Not scheduled';
  try {
    const date = new Date(iso);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    if (Math.abs(diffMs) < 60000) return 'Just now';
    const diffMin = Math.floor(Math.abs(diffMs) / 60000);
    if (diffMin < 60) return diffMs > 0 ? `In ${diffMin}m` : `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return diffMs > 0 ? `In ${diffHr}h` : `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    return diffMs > 0 ? `In ${diffDay}d` : `${diffDay}d ago`;
  } catch {
    return iso;
  }
};

const OnboardingTasks: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { userId } = useAuth();
  const [tasks, setTasks] = useState<OnboardingTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const uid = userId || '';

  const fetchTasks = async () => {
    if (!uid) return;
    setLoading(true);
    try {
      const data = await getOnboardingTasks(uid);
      setTasks(data);
    } catch {
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTasks(); }, [uid]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeCount = tasks.filter(t => t.status === 'active').length;
  const failedCount = tasks.filter(t => t.status === 'failed' || t.status === 'needs_intervention').length;
  const pausedCount = tasks.filter(t => t.status === 'paused').length;

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress size={28} sx={{ color: terminalColors.primary }} />
      </Box>
    );
  }

  if (tasks.length === 0) {
    return (
      <TerminalPaper sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="body2" sx={{ color: terminalColors.textSecondary }}>
          No scheduled tasks found. Tasks will appear after onboarding completion.
        </Typography>
      </TerminalPaper>
    );
  }

  return (
    <Box>
      {!compact && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: terminalColors.primary, fontFamily: 'monospace' }}>
            Scheduled Tasks Overview
          </Typography>
          <Chip label={`${activeCount} active`} size="small" sx={{ height: 20, fontSize: 10, fontWeight: 600, bgcolor: 'rgba(76,175,80,0.15)', color: '#4caf50' }} />
          {failedCount > 0 && <Chip label={`${failedCount} need attention`} size="small" sx={{ height: 20, fontSize: 10, fontWeight: 600, bgcolor: 'rgba(244,67,54,0.15)', color: '#f44336' }} />}
          {pausedCount > 0 && <Chip label={`${pausedCount} paused`} size="small" sx={{ height: 20, fontSize: 10, fontWeight: 600, bgcolor: 'rgba(107,114,128,0.15)', color: '#6b7280' }} />}
          <Box sx={{ flex: 1 }} />
          <Tooltip title="Refresh">
            <IconButton size="small" onClick={fetchTasks} sx={{ color: terminalColors.textSecondary }}>
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {tasks.map((task) => {
          const chipColors = statusChipColor(task.status);
          const isExpanded = expanded === task.task_type;
          return (
            <Box key={`${task.task_type}_${task.task_id}`}
              sx={{
                borderRadius: 1,
                border: `1px solid ${terminalColors.border}`,
                bgcolor: isExpanded ? 'rgba(255,255,255,0.04)' : 'transparent',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' },
                transition: 'background 0.2s',
              }}
            >
              <Box
                onClick={() => setExpanded(isExpanded ? null : task.task_type)}
                sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, cursor: 'pointer', userSelect: 'none' }}
              >
                {statusIcon(task.status)}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: 'rgba(255,255,255,0.9)', fontSize: 13, lineHeight: 1.3 }}>
                    {task.label}
                  </Typography>
                  {!compact && (
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', display: 'block', fontSize: 10 }}>
                      {task.frequency}
                    </Typography>
                  )}
                </Box>
                <Chip
                  label={task.status_label}
                  size="small"
                  sx={{ height: 18, fontSize: 9, fontWeight: 600, bgcolor: chipColors.bg, color: chipColors.color }}
                />
                {isExpanded ? <ExpandLessIcon sx={{ fontSize: 14, color: terminalColors.textSecondary }} /> : <ExpandMoreIcon sx={{ fontSize: 14, color: terminalColors.textSecondary }} />}
              </Box>

              <Collapse in={isExpanded}>
                <Box sx={{ px: 1.5, pb: 1.5 }}>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', display: 'block', mb: 0.5, lineHeight: 1.4 }}>
                    {task.description}
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mt: 0.5 }}>
                    {task.website_url && (
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.35)' }}>
                        URL: {task.website_url}
                      </Typography>
                    )}
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.35)' }}>
                      Next: {formatRelativeTime(task.next_execution)}
                    </Typography>
                    {task.last_success && (
                      <Typography variant="caption" sx={{ color: '#4caf50' }}>
                        Last success: {formatRelativeTime(task.last_success)}
                      </Typography>
                    )}
                    {task.last_failure && (
                      <Typography variant="caption" sx={{ color: '#f44336' }}>
                        Last failure: {formatRelativeTime(task.last_failure)}
                      </Typography>
                    )}
                  </Box>
                  {task.failure_reason && (
                    <Typography variant="caption" sx={{ color: '#f44336', display: 'block', mt: 0.5 }}>
                      Error: {task.failure_reason}
                    </Typography>
                  )}
                  {task.consecutive_failures > 0 && (
                    <Typography variant="caption" sx={{ color: '#ff9800', display: 'block', mt: 0.25 }}>
                      {task.consecutive_failures} consecutive failure{task.consecutive_failures > 1 ? 's' : ''}
                    </Typography>
                  )}
                </Box>
              </Collapse>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

export default OnboardingTasks;