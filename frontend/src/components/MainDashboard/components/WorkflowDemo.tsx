import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  Stack,
  Alert,
  AlertTitle,
  Divider,
  IconButton,
  Tooltip,
  Collapse,
  LinearProgress,
  Paper,
  Grid
} from '@mui/material';
import PlayArrow from '@mui/icons-material/PlayArrow';
import Pause from '@mui/icons-material/Pause';
import Stop from '@mui/icons-material/Stop';
import Info from '@mui/icons-material/Info';
import ExpandMore from '@mui/icons-material/ExpandMore';
import ExpandLess from '@mui/icons-material/ExpandLess';
import CheckCircle from '@mui/icons-material/CheckCircle';
import Schedule from '@mui/icons-material/Schedule';
import TrendingUp from '@mui/icons-material/TrendingUp';
import NavigateNext from '@mui/icons-material/NavigateNext';
import NavigateBefore from '@mui/icons-material/NavigateBefore';
import SkipNext from '@mui/icons-material/SkipNext';
import TaskAlt from '@mui/icons-material/TaskAlt';
import Timer from '@mui/icons-material/Timer';
import Assignment from '@mui/icons-material/Assignment';
import { motion, AnimatePresence } from 'framer-motion';
import { useWorkflowStore } from '../../../stores/workflowStore';

interface WorkflowDemoProps {
  compact?: boolean;
}

const WorkflowDemo: React.FC<WorkflowDemoProps> = ({ compact = false }) => {
  const [expanded, setExpanded] = useState(false);
  const {
    currentWorkflow,
    workflowProgress,
    navigationState,
    isLoading,
    generateDailyWorkflow,
    startWorkflow,
    completeTask,
    skipTask,
    moveToNextTask,
    moveToPreviousTask,
    isWorkflowComplete
  } = useWorkflowStore();

  const handleGenerateWorkflow = async () => {
    try {
      await generateDailyWorkflow('demo-user');
    } catch (error) {
      console.error('Failed to generate workflow:', error);
    }
  };

  const handleStartWorkflow = async () => {
    if (currentWorkflow) {
      try {
        await startWorkflow(currentWorkflow.id);
      } catch (error) {
        console.error('Failed to start workflow:', error);
      }
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    try {
      await completeTask(taskId);
    } catch (error) {
      console.error('Failed to complete task:', error);
    }
  };

  const handleSkipTask = async (taskId: string) => {
    try {
      await skipTask(taskId);
    } catch (error) {
      console.error('Failed to skip task:', error);
    }
  };

  const handleNextTask = async () => {
    try {
      await moveToNextTask();
    } catch (error) {
      console.error('Failed to move to next task:', error);
    }
  };

  const handlePreviousTask = async () => {
    try {
      await moveToPreviousTask();
    } catch (error) {
      console.error('Failed to move to previous task:', error);
    }
  };

  const isComplete = isWorkflowComplete();
  const hasWorkflow = !!currentWorkflow;
  const isInProgress = currentWorkflow?.workflowStatus === 'in_progress';

  if (compact) {
    return (
      <Card sx={{ 
        background: 'linear-gradient(135deg, rgba(25, 118, 210, 0.1) 0%, rgba(25, 118, 210, 0.05) 100%)',
        border: '1px solid rgba(25, 118, 210, 0.2)',
        borderRadius: 2,
        mb: 2
      }}>
        <CardContent sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Schedule color="primary" />
              <Typography variant="h6" color="primary">
                Today's Workflow
              </Typography>
              {hasWorkflow && (
                <Chip 
                  label={isComplete ? 'Complete' : isInProgress ? 'In Progress' : 'Ready'}
                  color={isComplete ? 'success' : isInProgress ? 'primary' : 'default'}
                  size="small"
                />
              )}
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {!hasWorkflow && (
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<PlayArrow />}
                  onClick={handleGenerateWorkflow}
                  disabled={isLoading}
                >
                  Generate
                </Button>
              )}
              {hasWorkflow && !isInProgress && !isComplete && (
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<PlayArrow />}
                  onClick={handleStartWorkflow}
                  disabled={isLoading}
                >
                  Start
                </Button>
              )}
              <IconButton
                size="small"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? <ExpandLess /> : <ExpandMore />}
              </IconButton>
            </Box>
          </Box>
          
          <Collapse in={expanded}>
            <Box sx={{ mt: 2 }}>
              {workflowProgress && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Progress: {workflowProgress.completedTasks} of {workflowProgress.totalTasks} tasks
                  </Typography>
                </Box>
              )}
              
              {currentWorkflow && (
                <Stack spacing={1}>
                  {currentWorkflow.tasks.slice(0, 3).map((task) => (
                    <Box
                      key={task.id}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        p: 1,
                        background: 'rgba(255, 255, 255, 0.05)',
                        borderRadius: 1,
                        border: '1px solid rgba(255, 255, 255, 0.1)'
                      }}
                    >
                      <Box>
                        <Typography variant="body2" fontWeight="medium">
                          {task.title}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {task.estimatedTime} min • {task.priority}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        {task.status === 'pending' && isInProgress && (
                          <>
                            <Tooltip title="Complete Task">
                              <IconButton
                                size="small"
                                onClick={() => handleCompleteTask(task.id)}
                                sx={{ color: 'success.main' }}
                              >
                                <CheckCircle fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Skip Task">
                              <IconButton
                                size="small"
                                onClick={() => handleSkipTask(task.id)}
                                sx={{ color: 'warning.main' }}
                              >
                                <Stop fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </>
                        )}
                        {task.status === 'completed' && (
                          <CheckCircle color="success" fontSize="small" />
                        )}
                        {task.status === 'skipped' && (
                          <Stop color="warning" fontSize="small" />
                        )}
                      </Box>
                    </Box>
                  ))}
                </Stack>
              )}
            </Box>
          </Collapse>
        </CardContent>
      </Card>
    );
  }

  const getStatusColor = () => {
    if (isComplete) return 'success';
    if (isInProgress) return 'primary';
    return 'default';
  };

  const getStatusText = () => {
    if (isComplete) return 'Workflow Complete! 🎉';
    if (isInProgress) return 'In Progress';
    if (!hasWorkflow) return 'No Workflow Generated';
    return 'Ready to Start';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Box
        sx={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
          backdropFilter: 'blur(10px)',
          borderRadius: 3,
          p: 3,
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          mb: 3,
          overflow: 'hidden'
        }}
      >
        {/* Header Section */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography 
              variant="h5" 
              sx={{ 
                fontWeight: 700, 
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                gap: 1
              }}
            >
              {isComplete ? <CheckCircle sx={{ color: 'success.main' }} /> : 
             isInProgress ? <TrendingUp sx={{ color: 'primary.main' }} /> :
             <Schedule sx={{ color: 'grey.400' }} />}
              Today's Marketing Workflow
            </Typography>
            
            <Chip
              label={getStatusText()}
              size="small"
              color={getStatusColor()}
              sx={{
                background: `${getStatusColor() === 'success' ? 'success.main' : getStatusColor() === 'primary' ? 'primary.main' : 'grey.500'}20`,
                color: getStatusColor() === 'success' ? 'success.main' : getStatusColor() === 'primary' ? 'primary.main' : 'grey.500',
                border: `1px solid ${getStatusColor() === 'success' ? 'success.main' : getStatusColor() === 'primary' ? 'primary.main' : 'grey.500'}40`,
                fontWeight: 600
              }}
            />
          </Box>

        </Box>



        {/* Current Task Navigation */}
        {navigationState?.currentTask && isInProgress && (
          <Box sx={{ 
            p: 2, 
            mb: 3, 
            background: 'rgba(76, 175, 80, 0.1)', 
            border: '1px solid rgba(76, 175, 80, 0.3)',
            borderRadius: 2,
            backdropFilter: 'blur(10px)'
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <TaskAlt color="success" />
              <Typography variant="h6" color="success.main" sx={{ fontWeight: 600 }}>
                Current Task
              </Typography>
            </Box>
            <Typography variant="subtitle1" fontWeight="medium" sx={{ mb: 1, color: 'white' }}>
              {navigationState.currentTask.title}
            </Typography>
            <Typography variant="body2" sx={{ mb: 2, color: 'rgba(255,255,255,0.7)' }}>
              {navigationState.currentTask.description}
            </Typography>
            
            {/* Navigation Controls */}
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                size="small"
                startIcon={<CheckCircle />}
                onClick={() => navigationState.currentTask && handleCompleteTask(navigationState.currentTask.id)}
                sx={{ background: 'linear-gradient(135deg, #4caf50 0%, #388e3c 100%)' }}
              >
                Complete
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={<SkipNext />}
                onClick={() => navigationState.currentTask && handleSkipTask(navigationState.currentTask.id)}
                sx={{ borderColor: 'warning.main', color: 'warning.main' }}
              >
                Skip
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={<NavigateNext />}
                onClick={handleNextTask}
                disabled={!navigationState.canGoForward}
                sx={{ borderColor: 'primary.main', color: 'primary.main' }}
              >
                Next
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={<NavigateBefore />}
                onClick={handlePreviousTask}
                disabled={!navigationState.canGoBack}
                sx={{ borderColor: 'primary.main', color: 'primary.main' }}
              >
                Previous
              </Button>
            </Box>
          </Box>
        )}

        {/* Task List */}
        {currentWorkflow && (
          <Box>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'white', fontWeight: 600 }}>
              <Assignment color="primary" />
              Today's Tasks
            </Typography>
              <Grid container spacing={2}>
                <AnimatePresence>
                  {currentWorkflow.tasks.map((task, index) => (
                    <Grid item xs={12} md={6} key={task.id}>
                      <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                      >
                        <Box
                          sx={{
                            p: 2,
                            background: task.id === navigationState?.currentTask?.id 
                              ? 'rgba(76, 175, 80, 0.1)' 
                              : 'rgba(255, 255, 255, 0.05)',
                            border: task.id === navigationState?.currentTask?.id 
                              ? '2px solid rgba(76, 175, 80, 0.5)' 
                              : '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: 2,
                            height: '100%',
                            backdropFilter: 'blur(10px)'
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1 }}>
                            <Typography variant="subtitle1" fontWeight="medium" sx={{ flexGrow: 1, color: 'white' }}>
                              {task.title}
                            </Typography>
                            {task.id === navigationState?.currentTask?.id && (
                              <Chip label="Current" color="success" size="small" />
                            )}
                          </Box>
                          
                          <Typography variant="body2" sx={{ mb: 2, color: 'rgba(255,255,255,0.7)' }}>
                            {task.description}
                          </Typography>
                          
                          <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                            <Chip 
                              label={`${task.estimatedTime} min`} 
                              size="small" 
                              variant="outlined"
                              icon={<Timer />}
                            />
                            <Chip 
                              label={task.priority} 
                              size="small" 
                              color={task.priority === 'high' ? 'error' : task.priority === 'medium' ? 'warning' : 'default'}
                            />
                            <Chip 
                              label={task.status} 
                              size="small" 
                              color={task.status === 'completed' ? 'success' : task.status === 'skipped' ? 'warning' : 'default'}
                            />
                          </Box>
                          
                          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                            {task.status === 'pending' && isInProgress && (
                              <>
                                <Tooltip title="Complete Task">
                                  <IconButton
                                    size="small"
                                    onClick={() => handleCompleteTask(task.id)}
                                    sx={{ 
                                      color: 'success.main',
                                      '&:hover': { background: 'rgba(76, 175, 80, 0.1)' }
                                    }}
                                  >
                                    <CheckCircle />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Skip Task">
                                  <IconButton
                                    size="small"
                                    onClick={() => handleSkipTask(task.id)}
                                    sx={{ 
                                      color: 'warning.main',
                                      '&:hover': { background: 'rgba(255, 152, 0, 0.1)' }
                                    }}
                                  >
                                    <Stop />
                                  </IconButton>
                                </Tooltip>
                              </>
                            )}
                            {task.status === 'completed' && (
                              <CheckCircle color="success" />
                            )}
                            {task.status === 'skipped' && (
                              <Stop color="warning" />
                            )}
                          </Box>
                        </Box>
                      </motion.div>
                    </Grid>
                  ))}
                </AnimatePresence>
              </Grid>
            </Box>
          )}

        {/* Help Section */}
        {!hasWorkflow && (
          <Alert severity="info" sx={{ mt: 3, background: 'rgba(33, 150, 243, 0.1)', border: '1px solid rgba(33, 150, 243, 0.3)' }}>
            <AlertTitle>Getting Started</AlertTitle>
            Generate today's workflow to see your personalized marketing tasks. The system will guide you through each task with clear instructions and navigation controls.
          </Alert>
        )}
      </Box>
    </motion.div>
  );
};

export default WorkflowDemo;