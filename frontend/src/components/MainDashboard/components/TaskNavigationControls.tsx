import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  IconButton,
  Tooltip,
  Typography,
  Card,
  CardContent,
  Chip,
  useTheme
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import BackIcon from '@mui/icons-material/ArrowBack';
import ForwardIcon from '@mui/icons-material/ArrowForward';
import PlayIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import SkipIcon from '@mui/icons-material/SkipNext';
import CompleteIcon from '@mui/icons-material/CheckCircle';
import NavigationIcon from '@mui/icons-material/Navigation';
import { useWorkflowStore } from '../../../stores/workflowStore';
import { taskNavigationService } from '../../../services/TaskNavigationService';
import { taskDependencyManager } from '../../../services/TaskDependencyManager';

interface TaskNavigationControlsProps {
  compact?: boolean;
  showTaskInfo?: boolean;
  onTaskChange?: (taskId: string) => void;
}

const TaskNavigationControls: React.FC<TaskNavigationControlsProps> = ({
  compact = false,
  showTaskInfo = true,
  onTaskChange
}) => {
  const theme = useTheme();
  const {
    currentWorkflow,
    navigationState,
    moveToNextTask,
    moveToPreviousTask,
    completeTask,
    skipTask,
    isLoading
  } = useWorkflowStore();

  const [isNavigating, setIsNavigating] = useState(false);
  const [navigationError, setNavigationError] = useState<string | null>(null);

  // Navigation event listener
  useEffect(() => {
    const handleNavigationEvent = (event: any) => {
      console.log('Navigation event:', event);
      if (onTaskChange && event.detail?.taskId) {
        onTaskChange(event.detail.taskId);
      }
    };

    taskNavigationService.addNavigationListener(handleNavigationEvent);
    
    return () => {
      taskNavigationService.removeNavigationListener(handleNavigationEvent);
    };
  }, [onTaskChange]);

  const handleNavigateToNext = async () => {
    if (!currentWorkflow || !navigationState?.nextTask) return;

    setIsNavigating(true);
    setNavigationError(null);

    try {
      await moveToNextTask();
    } catch (error) {
      setNavigationError(error instanceof Error ? error.message : 'Navigation failed');
    } finally {
      setIsNavigating(false);
    }
  };

  const handleNavigateBack = async () => {
    if (!currentWorkflow || !navigationState?.canGoBack) return;

    setIsNavigating(true);
    setNavigationError(null);

    try {
      await moveToPreviousTask();
    } catch (error) {
      setNavigationError(error instanceof Error ? error.message : 'Back navigation failed');
    } finally {
      setIsNavigating(false);
    }
  };

  const handleCompleteCurrentTask = async () => {
    if (!currentWorkflow || !navigationState?.currentTask) return;

    try {
      await completeTask(navigationState.currentTask.id);
    } catch (error) {
      setNavigationError(error instanceof Error ? error.message : 'Task completion failed');
    }
  };

  const handleSkipCurrentTask = async () => {
    if (!currentWorkflow || !navigationState?.currentTask) return;

    try {
      await skipTask(navigationState.currentTask.id);
    } catch (error) {
      setNavigationError(error instanceof Error ? error.message : 'Task skip failed');
    }
  };

  const getReadyTasks = () => {
    if (!currentWorkflow) return [];
    return taskDependencyManager.getReadyTasks(currentWorkflow);
  };

  const getBlockedTasks = () => {
    if (!currentWorkflow) return [];
    return taskDependencyManager.getBlockedTasks(currentWorkflow);
  };

  if (!currentWorkflow || !navigationState) {
    return null;
  }

  const currentTask = navigationState.currentTask;
  const readyTasks = getReadyTasks();
  const blockedTasks = getBlockedTasks();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card
        sx={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 2
        }}
      >
        <CardContent sx={{ p: compact ? 2 : 3 }}>
          {/* Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <NavigationIcon sx={{ color: theme.palette.primary.main }} />
            <Typography variant="h6" sx={{ color: 'white', fontWeight: 600 }}>
              Task Navigation
            </Typography>
            {navigationError && (
              <Chip
                label={navigationError}
                color="error"
                size="small"
                sx={{ ml: 'auto' }}
              />
            )}
          </Box>

          {/* Current Task Info */}
          {showTaskInfo && currentTask && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', mb: 1 }}>
                Current Task:
              </Typography>
              <Box
                sx={{
                  background: 'rgba(255,255,255,0.05)',
                  borderRadius: 1,
                  p: 2,
                  border: '1px solid rgba(255,255,255,0.1)'
                }}
              >
                <Typography variant="subtitle1" sx={{ color: 'white', fontWeight: 600, mb: 0.5 }}>
                  {currentTask.title}
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                  {currentTask.description}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                  <Chip
                    label={currentTask.pillarId}
                    size="small"
                    sx={{
                      background: `${currentTask.color}20`,
                      color: currentTask.color,
                      border: `1px solid ${currentTask.color}40`
                    }}
                  />
                  <Chip
                    label={`${currentTask.estimatedTime} min`}
                    size="small"
                    sx={{
                      background: 'rgba(255,255,255,0.1)',
                      color: 'rgba(255,255,255,0.8)'
                    }}
                  />
                </Box>
              </Box>
            </Box>
          )}

          {/* Navigation Controls */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            {/* Back Button */}
            <Tooltip title="Go to Previous Task">
              <IconButton
                onClick={handleNavigateBack}
                disabled={!navigationState.canGoBack || isLoading || isNavigating}
                sx={{
                  background: 'rgba(255,255,255,0.1)',
                  color: 'white',
                  '&:hover': {
                    background: 'rgba(255,255,255,0.2)'
                  },
                  '&:disabled': {
                    background: 'rgba(255,255,255,0.05)',
                    color: 'rgba(255,255,255,0.3)'
                  }
                }}
              >
                <BackIcon />
              </IconButton>
            </Tooltip>

            {/* Complete Task Button */}
            <Button
              variant="contained"
              startIcon={<CompleteIcon />}
              onClick={handleCompleteCurrentTask}
              disabled={!currentTask || isLoading}
              sx={{
                background: '#4CAF50',
                '&:hover': {
                  background: '#45a049'
                },
                flexGrow: 1
              }}
            >
              Complete Task
            </Button>

            {/* Skip Task Button */}
            <Tooltip title="Skip Current Task">
              <IconButton
                onClick={handleSkipCurrentTask}
                disabled={!currentTask || isLoading}
                sx={{
                  background: 'rgba(255,152,0,0.2)',
                  color: '#FF9800',
                  '&:hover': {
                    background: 'rgba(255,152,0,0.3)'
                  }
                }}
              >
                <SkipIcon />
              </IconButton>
            </Tooltip>

            {/* Forward Button */}
            <Tooltip title="Go to Next Task">
              <IconButton
                onClick={handleNavigateToNext}
                disabled={!navigationState.canGoForward || isLoading || isNavigating}
                sx={{
                  background: 'rgba(255,255,255,0.1)',
                  color: 'white',
                  '&:hover': {
                    background: 'rgba(255,255,255,0.2)'
                  },
                  '&:disabled': {
                    background: 'rgba(255,255,255,0.05)',
                    color: 'rgba(255,255,255,0.3)'
                  }
                }}
              >
                <ForwardIcon />
              </IconButton>
            </Tooltip>
          </Box>

          {/* Task Status Summary */}
          {!compact && (
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Chip
                label={`${readyTasks.length} Ready`}
                size="small"
                sx={{
                  background: 'rgba(76,175,80,0.2)',
                  color: '#4CAF50',
                  border: '1px solid rgba(76,175,80,0.3)'
                }}
              />
              <Chip
                label={`${blockedTasks.length} Blocked`}
                size="small"
                sx={{
                  background: 'rgba(244,67,54,0.2)',
                  color: '#F44336',
                  border: '1px solid rgba(244,67,54,0.3)'
                }}
              />
              <Chip
                label={`${currentWorkflow.completedTasks}/${currentWorkflow.totalTasks} Complete`}
                size="small"
                sx={{
                  background: 'rgba(33,150,243,0.2)',
                  color: '#2196F3',
                  border: '1px solid rgba(33,150,243,0.3)'
                }}
              />
            </Box>
          )}

          {/* Loading State */}
          <AnimatePresence>
            {(isLoading || isNavigating) && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'rgba(0,0,0,0.5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 'inherit'
                }}
              >
                <Typography variant="body2" sx={{ color: 'white' }}>
                  {isNavigating ? 'Navigating...' : 'Loading...'}
                </Typography>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default TaskNavigationControls;
