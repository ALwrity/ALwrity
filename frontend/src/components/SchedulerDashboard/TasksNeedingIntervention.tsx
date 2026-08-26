/**
 * Tasks Needing Intervention Component
 * Displays tasks that have been marked for human intervention with actionable information.
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Alert,
  Button,
  Chip,
  Collapse,
  IconButton,
  Tooltip,
  CircularProgress
} from '@mui/material';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import RefreshIcon from '@mui/icons-material/Refresh';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import InfoIcon from '@mui/icons-material/Info';
import { styled } from '@mui/material/styles';
import { apiClient } from '../../api/client';
import { TerminalTypography, terminalColors } from './terminalTheme';
import { getTasksNeedingIntervention, TaskNeedingIntervention } from '../../api/schedulerDashboard';

const InterventionContainer = styled(Box)({
  backgroundColor: 'rgba(26, 26, 26, 0.8)',
  border: '2px solid #ff9800',
  borderRadius: '8px',
  padding: '16px',
  marginBottom: '24px',
  fontFamily: '"Courier New", "Monaco", "Consolas", "Fira Code", monospace',
});

const TaskCard = styled(Box)({
  backgroundColor: 'rgba(10, 10, 10, 0.6)',
  border: '1px solid #ff9800',
  borderRadius: '6px',
  padding: '12px',
  marginBottom: '12px',
  '&:last-child': {
    marginBottom: 0,
  },
});

const ActionButton = styled(Button)({
  backgroundColor: 'rgba(0, 255, 0, 0.1)',
  color: '#00ff00',
  border: '1px solid #00ff00',
  fontFamily: 'inherit',
  fontSize: '0.875rem',
  padding: '6px 16px',
  textTransform: 'none',
  '&:hover': {
    backgroundColor: 'rgba(0, 255, 0, 0.2)',
    boxShadow: '0 0 10px rgba(0, 255, 0, 0.3)',
  },
  '&:disabled': {
    backgroundColor: 'rgba(0, 68, 0, 0.3)',
    color: '#004400',
    borderColor: '#004400',
  }
});

const StatusChip = styled(Chip)(({ severity }: { severity: 'error' | 'warning' }) => ({
  backgroundColor: severity === 'error' ? 'rgba(244, 67, 54, 0.2)' : 'rgba(255, 152, 0, 0.2)',
  color: severity === 'error' ? '#f44336' : '#ff9800',
  border: `1px solid ${severity === 'error' ? '#f44336' : '#ff9800'}`,
  fontFamily: 'inherit',
  fontSize: '0.75rem',
  fontWeight: 'bold',
}));

interface TasksNeedingInterventionProps {
  userId: string;
}

const TasksNeedingIntervention: React.FC<TasksNeedingInterventionProps> = ({ userId }) => {
  const [tasks, setTasks] = useState<TaskNeedingIntervention[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTasks, setExpandedTasks] = useState<Set<number>>(new Set());
  const [triggeringTasks, setTriggeringTasks] = useState<Set<number>>(new Set());

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const fetchedTasks = await getTasksNeedingIntervention(userId);
      setTasks(fetchedTasks || []);
    } catch (error) {
      console.error('Error fetching tasks needing intervention:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
    // Refresh every 2 minutes
    const interval = setInterval(fetchTasks, 120000);
    return () => clearInterval(interval);
  }, [userId]);

  const toggleExpand = (taskId: number) => {
    const newExpanded = new Set(expandedTasks);
    if (newExpanded.has(taskId)) {
      newExpanded.delete(taskId);
    } else {
      newExpanded.add(taskId);
    }
    setExpandedTasks(newExpanded);
  };

  const handleManualTrigger = async (task: TaskNeedingIntervention) => {
    try {
      setTriggeringTasks(prev => new Set(prev).add(task.task_id));
      
      // Determine task type for API
      let taskType = task.task_type;
      if (task.task_type.includes('_insights')) {
        // Extract platform from task_type (e.g., "gsc_insights" -> "gsc_insights")
        taskType = task.task_type;
      }
      
      await apiClient.post(`/api/scheduler/tasks/${taskType}/${task.task_id}/manual-trigger`);
      
      // Show success toast
      showToast('Task triggered successfully. It will run shortly.', 'success');
      
      // Refresh the list after a short delay
      setTimeout(() => {
        fetchTasks();
      }, 2000);
    } catch (error: any) {
      console.error('Error triggering task:', error);
      showToast(
        error.response?.data?.detail || 'Failed to trigger task. Please try again.',
        'error'
      );
    } finally {
      setTriggeringTasks(prev => {
        const newSet = new Set(prev);
        newSet.delete(task.task_id);
        return newSet;
      });
    }
  };

  const getTaskDisplayName = (task: TaskNeedingIntervention): string => {
    if (task.task_type === 'oauth_token_monitoring') {
      return `OAuth ${task.platform?.toUpperCase() || 'Unknown'}`;
    } else if (task.task_type === 'website_analysis') {
      const url = task.website_url || 'Unknown';
      return `Website Analysis (${url.length > 40 ? url.substring(0, 40) + '...' : url})`;
    } else if (task.task_type.includes('_insights')) {
      return `${task.platform?.toUpperCase() || 'Unknown'} Insights`;
    }
    return task.task_type;
  };

  const getFailureReasonDisplay = (reason: string): { label: string; severity: 'error' | 'warning'; action: string } => {
    switch (reason) {
      case 'api_limit':
        return {
          label: 'API Limit Exceeded',
          severity: 'error',
          action: 'Your API quota has been exceeded. Wait for quota reset or upgrade your plan, then manually trigger the task.'
        };
      case 'auth_error':
        return {
          label: 'Authentication Error',
          severity: 'warning',
          action: 'Your credentials may have expired. Please reconnect the platform in onboarding, then manually trigger the task.'
        };
      case 'network_error':
        return {
          label: 'Network Error',
          severity: 'warning',
          action: 'Network connectivity issues detected. Check your connection and manually trigger the task when resolved.'
        };
      case 'config_error':
        return {
          label: 'Configuration Error',
          severity: 'warning',
          action: 'Task configuration is invalid. Please check task settings and manually trigger after fixing.'
        };
      default:
        return {
          label: 'Unknown Error',
          severity: 'error',
          action: 'An unexpected error occurred. Review the error details below and manually trigger after resolving the issue.'
        };
    }
  };

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return 'Unknown';
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  if (loading) {
    return (
      <InterventionContainer>
        <Box display="flex" alignItems="center" gap={2}>
          <CircularProgress size={20} sx={{ color: '#ff9800' }} />
          <TerminalTypography variant="body2" sx={{ color: '#ff9800' }}>
            Loading tasks needing intervention...
          </TerminalTypography>
        </Box>
      </InterventionContainer>
    );
  }

  if (tasks.length === 0) {
    return null; // Don't show section if no tasks need intervention
  }

  return (
    <InterventionContainer>
      <Box display="flex" alignItems="center" justifyContent="space-between" marginBottom={2}>
        <Box display="flex" alignItems="center" gap={1}>
          <WarningIcon sx={{ color: '#ff9800', fontSize: '24px' }} />
          <TerminalTypography variant="h6" sx={{ color: '#ff9800', fontWeight: 'bold' }}>
            Tasks Needing Intervention ({tasks.length})
          </TerminalTypography>
        </Box>
        <Tooltip title="Refresh">
          <IconButton
            onClick={fetchTasks}
            sx={{
              color: '#ff9800',
              border: '1px solid #ff9800',
              '&:hover': { backgroundColor: 'rgba(255, 152, 0, 0.1)' }
            }}
            size="small"
          >
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      <TerminalTypography variant="body2" sx={{ color: '#ff9800', opacity: 0.8, marginBottom: 2 }}>
        These tasks have failed repeatedly and require manual intervention. Review the details and take appropriate action.
      </TerminalTypography>

      {tasks.map((task) => {
        const reasonInfo = getFailureReasonDisplay(task.failure_pattern.failure_reason);
        const isExpanded = expandedTasks.has(task.task_id);
        const isTriggering = triggeringTasks.has(task.task_id);

        return (
          <TaskCard key={task.task_id}>
            <Box display="flex" alignItems="flex-start" justifyContent="space-between" gap={2}>
              <Box flex={1}>
                <Box display="flex" alignItems="center" gap={1} marginBottom={1}>
                  <TerminalTypography variant="subtitle1" sx={{ color: '#ff9800', fontWeight: 'bold' }}>
                    {getTaskDisplayName(task)}
                  </TerminalTypography>
                  <StatusChip
                    label={reasonInfo.label}
                    severity={reasonInfo.severity}
                    size="small"
                  />
                  <Chip
                    label={`${task.failure_pattern.consecutive_failures} consecutive failures`}
                    size="small"
                    sx={{
                      backgroundColor: 'rgba(244, 67, 54, 0.2)',
                      color: '#f44336',
                      border: '1px solid #f44336',
                      fontFamily: 'inherit',
                      fontSize: '0.7rem',
                    }}
                  />
                </Box>

                <TerminalTypography variant="body2" sx={{ color: '#ff9800', opacity: 0.9, marginBottom: 1 }}>
                  <InfoIcon sx={{ fontSize: '14px', verticalAlign: 'middle', marginRight: 0.5 }} />
                  {reasonInfo.action}
                </TerminalTypography>

                <Box display="flex" alignItems="center" gap={2} marginTop={1}>
                  <TerminalTypography variant="caption" sx={{ color: '#ff9800', opacity: 0.7 }}>
                    Last failure: {formatDate(task.last_failure)}
                  </TerminalTypography>
                  <IconButton
                    onClick={() => toggleExpand(task.task_id)}
                    size="small"
                    sx={{ color: '#ff9800' }}
                  >
                    {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  </IconButton>
                </Box>

                <Collapse in={isExpanded}>
                  <Box marginTop={2} padding={2} sx={{ backgroundColor: 'rgba(0, 0, 0, 0.3)', borderRadius: '4px' }}>
                    <TerminalTypography variant="caption" sx={{ color: '#ff9800', display: 'block', marginBottom: 1 }}>
                      <strong>Failure Details:</strong>
                    </TerminalTypography>
                    <TerminalTypography variant="caption" sx={{ color: '#ff9800', opacity: 0.8, display: 'block', marginBottom: 1 }}>
                      • Consecutive failures: {task.failure_pattern.consecutive_failures}
                    </TerminalTypography>
                    <TerminalTypography variant="caption" sx={{ color: '#ff9800', opacity: 0.8, display: 'block', marginBottom: 1 }}>
                      • Recent failures (7 days): {task.failure_pattern.recent_failures}
                    </TerminalTypography>
                    {task.failure_reason && (
                      <TerminalTypography variant="caption" sx={{ color: '#ff9800', opacity: 0.8, display: 'block', marginBottom: 1 }}>
                        • Error: {task.failure_reason.substring(0, 200)}
                        {task.failure_reason.length > 200 ? '...' : ''}
                      </TerminalTypography>
                    )}
                    {task.failure_pattern.error_patterns.length > 0 && (
                      <Box marginTop={1}>
                        <TerminalTypography variant="caption" sx={{ color: '#ff9800', display: 'block', marginBottom: 0.5 }}>
                          <strong>Error Patterns:</strong>
                        </TerminalTypography>
                        {task.failure_pattern.error_patterns.map((pattern, idx) => (
                          <TerminalTypography
                            key={idx}
                            variant="caption"
                            sx={{ color: '#ff9800', opacity: 0.7, display: 'block', fontFamily: 'monospace', fontSize: '0.7rem' }}
                          >
                            • {pattern}
                          </TerminalTypography>
                        ))}
                      </Box>
                    )}
                  </Box>
                </Collapse>
              </Box>

              <Box display="flex" flexDirection="column" gap={1}>
                <ActionButton
                  variant="outlined"
                  startIcon={isTriggering ? <CircularProgress size={16} sx={{ color: '#00ff00' }} /> : <PlayArrowIcon />}
                  onClick={() => handleManualTrigger(task)}
                  disabled={isTriggering}
                  size="small"
                >
                  {isTriggering ? 'Triggering...' : 'Trigger Now'}
                </ActionButton>
              </Box>
            </Box>
          </TaskCard>
        );
      })}
    </InterventionContainer>
  );
};

// Toast notification helper
function showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
  const toast = document.createElement('div');
  const bgColors = {
    error: '#f44336',
    warning: '#ff9800',
    info: '#2196f3',
    success: '#4caf50'
  };

  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 16px 24px;
    border-radius: 8px;
    color: white;
    font-weight: 500;
    font-size: 14px;
    z-index: 10000;
    max-width: 400px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    transform: translateX(100%);
    transition: transform 0.3s ease;
    background-color: ${bgColors[type] || bgColors.info};
    word-wrap: break-word;
  `;

  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.transform = 'translateX(0)';
  }, 100);

  const duration = type === 'error' ? 7000 : 5000;
  setTimeout(() => {
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => {
      if (document.body.contains(toast)) {
        document.body.removeChild(toast);
      }
    }, 300);
  }, duration);
}

export default TasksNeedingIntervention;

