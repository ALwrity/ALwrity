import React from 'react';
import {
  Box,
  Typography,
  Chip,
  Tooltip,
  Modal,
  Paper,
  Button,
  IconButton,
  Avatar,
  Stack,
  CircularProgress,
  Card,
  CardContent,
  LinearProgress,
} from '@mui/material';
import { motion } from 'framer-motion';
import {
  Today as TodayIcon,
  Close as CloseIcon,
  AutoAwesome as AlwrityIcon,
  CheckCircle as CheckIcon,
  PlayArrow as PlayIcon,
  SkipNext as SkipIcon,
  NavigateNext,
  Psychology as AgentIcon,
  TrendingUp as TrendUpIcon,
  TrendingDown as TrendDownIcon,
  TrendingFlat as TrendFlatIcon,
  GpsFixed as GapIcon,
  BarChart as VolumeIcon,
  CalendarMonth as CalendarIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useWorkflowStore } from '../../../stores/workflowStore';
import { TodayTask } from '../../../types/workflow';

interface EnhancedTodayModalProps {
  open: boolean;
  onClose: () => void;
  pillarId: string;
  pillarTitle: string;
  pillarColor: string;
  tasks: TodayTask[];
  // When navigating away (Next), prevent the previous pillar modal from auto-reopening
  onPreventAutoReopen?: () => void;
}

// Enhanced Today Modal with Workflow Integration
const EnhancedTodayModal: React.FC<EnhancedTodayModalProps> = ({ 
  open, 
  onClose, 
  pillarId, 
  pillarTitle, 
  pillarColor, 
  tasks, 
  onPreventAutoReopen 
}) => {
  const navigate = useNavigate();
  const {
    currentWorkflow,
    workflowProgress,
    navigationState,
    completeTask,
    skipTask,
    isLoading,
    isWorkflowComplete
  } = useWorkflowStore();

  // Prefer live workflow tasks (to reflect updated statuses), fallback to props
  const liveTasks = currentWorkflow?.tasks && Array.isArray(currentWorkflow.tasks) && currentWorkflow.tasks.length > 0
    ? currentWorkflow.tasks
    : tasks;

  // Filter tasks for this pillar
  const pillarTasks = liveTasks.filter(task => task.pillarId === pillarId);
  const currentTask = navigationState?.currentTask;
  const isComplete = isWorkflowComplete();

  const handleTaskAction = async (task: TodayTask) => {
    if (!task.enabled) return;

    try {
      // Execute the task action
      if (task.action) {
        task.action();
      } else if (task.actionUrl) {
        const navigationState: Record<string, any> = {
          workflowTaskId: task.id
        };
        if (task.metadata?.source === 'calendar_event') {
          navigationState.calendarEventId = task.metadata.source_event_id;
          navigationState.calendarTopic = task.title;
          navigationState.calendarDescription = task.description;
        }
        navigate(task.actionUrl, { state: navigationState });
      }

      // Mark task as completed in workflow (skip for calendar tasks — writers handle it after save/publish)
      if (currentWorkflow && task.metadata?.source !== 'calendar_event') {
        await completeTask(task.id);
      }
    } catch (error) {
      console.error('Error executing task:', error);
    }
  };

  const handleSkipTask = async (task: TodayTask) => {
    if (currentWorkflow) {
      await skipTask(task.id);
    }
  };

  const handleNextPillar = async () => {
    // Close current modal
    onClose();
    
    // Prevent auto-reopen of current modal during navigation
    if (onPreventAutoReopen) {
      onPreventAutoReopen();
    }
    
    // Navigate to next pillar
    if (nextPillarId) {
      setTimeout(() => {
        // Trigger next pillar modal opening
        const nextChip = document.querySelector(`[data-pillar-id="${nextPillarId}"]`);
        if (nextChip) {
          (nextChip as HTMLElement).click();
        }
      }, 300);
    }
  };

  const handleWorkflowComplete = async () => {
    console.log('Workflow Complete clicked for pillar:', pillarId);
    console.log('Current pillar tasks:', pillarTasks);
    
    // Mark all remaining tasks in this pillar as completed
    const incompleteTasks = pillarTasks.filter(task => 
      task.status !== 'completed' && task.status !== 'skipped'
    );
    
    console.log('Incomplete tasks to complete:', incompleteTasks);
    
    for (const task of incompleteTasks) {
      try {
        console.log('Completing task:', task.id);
        await completeTask(task.id);
        console.log('Task completed successfully:', task.id);
      } catch (error) {
        console.error(`Failed to complete task ${task.id}:`, error);
      }
    }
    
    console.log('All tasks completed, closing modal');
    // Close the modal
    onClose();
  };

  // Check if all tasks in this pillar are completed or skipped
  const areAllTasksCompleted = pillarTasks.every(task => 
    task.status === 'completed' || task.status === 'skipped'
  );

  // Define pillar order for navigation
  const pillarOrder = ['plan', 'generate', 'publish', 'analyze', 'engage', 'remarket'];
  const currentPillarIndex = pillarOrder.indexOf(pillarId);
  const isLastPillar = currentPillarIndex === pillarOrder.length - 1;
  const nextPillarId = !isLastPillar ? pillarOrder[currentPillarIndex + 1] : null;

  const MetricBar = ({ label, value, color }: { label: string; value: number; color: string }) => (
  <Box sx={{ mb: 1 }}>
    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
      <Typography variant="caption" sx={{ color: '#888', fontWeight: 600 }}>{label}</Typography>
      <Typography variant="caption" sx={{ color, fontWeight: 700 }}>{(value * 100).toFixed(0)}%</Typography>
    </Box>
    <LinearProgress
      variant="determinate"
      value={value * 100}
      sx={{
        height: 6,
        borderRadius: 3,
        bgcolor: '#e8e8e8',
        '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 3 },
      }}
    />
  </Box>
);

const GapScoringBreakdown = ({ scoring }: { scoring: Record<string, number> }) => {
  const roi = scoring.roi_score ?? scoring.roi ?? 0;
  const roiColor = roi >= 0.6 ? '#2e7d32' : roi >= 0.3 ? '#f57c00' : '#9e9e9e';

  return (
    <Box sx={{ mt: 2, p: 1.5, bgcolor: '#f5f7fa', borderRadius: 2, border: '1px solid #e0e4e8' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <GapIcon sx={{ fontSize: 18, color: roiColor }} />
        <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#333', flexGrow: 1 }}>
          Opportunity Score
        </Typography>
        <Chip
          label={`${(roi * 100).toFixed(0)}% ROI`}
          size="small"
          sx={{
            fontWeight: 800,
            bgcolor: `${roiColor}18`,
            color: roiColor,
            border: `1px solid ${roiColor}40`,
          }}
        />
      </Box>
      <MetricBar label="Gap Size" value={scoring.gap_size ?? 0} color="#1565C0" />
      <MetricBar label="Search Volume" value={scoring.volume ?? 0} color="#7b1fa2" />
      <MetricBar label="Competition" value={scoring.competition ?? 0} color="#c62828" />
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
        {(() => {
          const t = scoring.trend ?? 0.5;
          const Icon = t > 0.6 ? TrendUpIcon : t < 0.4 ? TrendDownIcon : TrendFlatIcon;
          const tColor = t > 0.6 ? '#2e7d32' : t < 0.4 ? '#c62828' : '#f57c00';
          return <Icon sx={{ fontSize: 16, color: tColor }} />;
        })()}
        <Typography variant="caption" sx={{ color: '#888', fontWeight: 600 }}>
          Trend: {(scoring.trend ?? 0.5) >= 0.6 ? 'Rising' : (scoring.trend ?? 0.5) <= 0.4 ? 'Declining' : 'Stable'}
        </Typography>
        <Chip
          label={scoring.intent && scoring.intent >= 0.7 ? 'Commercial' : scoring.intent && scoring.intent >= 0.5 ? 'Transactional' : 'Informational'}
          size="small"
          sx={{
            ml: 'auto',
            height: 20,
            fontSize: '0.65rem',
            fontWeight: 700,
            bgcolor: '#e3f2fd',
            color: '#1565C0',
          }}
        />
      </Box>
    </Box>
  );
};

const getTaskStatus = (task: TodayTask) => {
    if (task.status === 'completed') return 'completed';
    if (task.status === 'in_progress') return 'active';
    if (task.status === 'skipped') return 'skipped';
    return 'pending';
  };

  const getTaskStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return '#4CAF50';
      case 'active': return '#2196F3';
      case 'skipped': return '#FF9800';
      default: return '#9E9E9E';
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: { xs: 1.5, md: 3 }
      }}
    >
      <Paper
        sx={{
          width: { xs: '96vw', sm: '94vw', md: '90vw' },
          maxWidth: 1200,
          maxHeight: '92vh',
          overflow: 'auto',
          background: 'linear-gradient(135deg, rgba(255,255,255,0.96) 0%, rgba(250,250,252,0.92) 100%)',
          backdropFilter: 'blur(24px)',
          borderRadius: 4,
          boxShadow: '0 30px 60px rgba(0,0,0,0.35)',
          border: '1px solid rgba(0,0,0,0.06)'
        }}
      >
        {/* Header */}
        <Box sx={{ p: { xs: 2, md: 3 }, borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Avatar
                sx={{
                  background: pillarColor,
                  width: 48,
                  height: 48
                }}
              >
                <TodayIcon sx={{ fontSize: 24, color: 'white' }} />
              </Avatar>
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 800, color: '#23252F', letterSpacing: 0.2 }}>
                  Today's {pillarTitle} Tasks
                </Typography>
                <Typography variant="body2" sx={{ color: '#5A5F6A' }}>
                  Complete your daily marketing workflow
                </Typography>
              </Box>
            </Box>
            <IconButton onClick={onClose} sx={{ color: '#6B7280' }}>
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>

        {/* Workflow Progress - Circular in Header */}
        {workflowProgress && (
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            p: { xs: 2, md: 3 }, 
            borderBottom: '1px solid rgba(0,0,0,0.08)' 
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="body2" sx={{ color: '#5A5F6A', fontWeight: 600 }}>
                Overall Progress
              </Typography>
              <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                <CircularProgress
                  variant="determinate"
                  value={workflowProgress.completionPercentage}
                  size={40}
                  thickness={4}
                  sx={{
                    color: pillarColor,
                    '& .MuiCircularProgress-circle': {
                      strokeLinecap: 'round',
                    }
                  }}
                />
                <Box
                  sx={{
                    top: 0,
                    left: 0,
                    bottom: 0,
                    right: 0,
                    position: 'absolute',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Typography
                    variant="caption"
                    component="div"
                    sx={{ 
                      color: '#5A5F6A', 
                      fontWeight: 700,
                      fontSize: '0.7rem'
                    }}
                  >
                    {`${Math.round(workflowProgress.completionPercentage)}%`}
                  </Typography>
                </Box>
              </Box>
            </Box>
            <Typography variant="body2" sx={{ color: '#5A5F6A', fontWeight: 600 }}>
              {workflowProgress.completedTasks} of {workflowProgress.totalTasks} tasks
            </Typography>
          </Box>
        )}

        {/* Tasks List */}
        <Box sx={{ p: { xs: 2, md: 3 } }}>
          <Typography variant="h6" sx={{ mb: 2, color: '#23252F', fontWeight: 800 }}>
            {pillarTitle} Tasks
          </Typography>
          
          {pillarTasks.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <CalendarIcon sx={{ fontSize: 48, color: '#ccc', mb: 2 }} />
              <Typography variant="body1" sx={{ color: '#5A5F6A', mb: 1 }}>
                No content scheduled for this pillar today
              </Typography>
              <Typography variant="body2" sx={{ color: '#999', mb: 2 }}>
                Add content to your Content Calendar to populate workflow tasks
              </Typography>
              <Button
                variant="outlined"
                size="small"
                startIcon={<CalendarIcon />}
                onClick={onClose}
                sx={{ borderColor: pillarColor, color: pillarColor }}
              >
                Go to Calendar
              </Button>
            </Box>
          ) : (
          <Stack spacing={2}>
            {pillarTasks.map((task, index) => {
              const status = getTaskStatus(task);
              const statusColor = getTaskStatusColor(status);
              const isCurrentTask = currentTask?.id === task.id;
              const IconComponent = (typeof task.icon === 'function' ? task.icon : undefined) as any;

              return (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                >
                  <Card
                    sx={{
                      border: isCurrentTask ? `2px solid ${pillarColor}` : '1px solid rgba(0,0,0,0.08)',
                      background: isCurrentTask ? `${pillarColor}12` : 'white',
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: '0 8px 20px rgba(0,0,0,0.08)'
                      }
                    }}
                  >
                    <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                        {IconComponent && (
                          <Avatar
                            sx={{
                              background: statusColor,
                              width: 36,
                              height: 36
                            }}
                          >
                            <IconComponent sx={{ fontSize: 18, color: 'white' }} />
                          </Avatar>
                        )}
                        
                        <Box sx={{ flexGrow: 1 }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#23252F' }}>
                            {task.title}
                          </Typography>
                          <Typography variant="body2" sx={{ color: '#5A5F6A' }}>
                            {task.description}
                          </Typography>
                        </Box>

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Chip
                            label={status}
                            size="small"
                            sx={{
                              background: `${statusColor}18`,
                              color: statusColor,
                              border: `1px solid ${statusColor}40`,
                              textTransform: 'capitalize'
                            }}
                          />
                          
                          <Typography variant="caption" sx={{ color: '#999' }}>
                            {task.estimatedTime} min
                          </Typography>
                        </Box>
                      </Box>
                      
                      {/* Calendar Event Source Badge */}
                      {task.metadata?.source === 'calendar_event' && (
                        <Box sx={{ 
                          mt: 1.5, 
                          mb: 1.5,
                          p: 1.5, 
                          bgcolor: '#e8f4fd', 
                          borderRadius: 2,
                          border: '1px solid #b3d9f2',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 1.5
                        }}>
                          <CalendarIcon sx={{ fontSize: 16, color: '#1976d2', mt: 0.3 }} />
                          <Box sx={{ flexGrow: 1 }}>
                            <Typography variant="caption" sx={{ fontWeight: 700, color: '#1565c0' }}>
                              From your Content Calendar
                            </Typography>
                          </Box>
                        </Box>
                      )}

                      {/* AI-Suggested Badge */}
                      {task.metadata?.source === 'agent_generated' && (
                        <Box sx={{ 
                          mt: 1.5, 
                          mb: 1.5,
                          p: 1.5, 
                          bgcolor: '#f3e8ff', 
                          borderRadius: 2,
                          border: '1px solid #d4bfff',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 1.5
                        }}>
                          <AlwrityIcon sx={{ fontSize: 16, color: '#7c3aed', mt: 0.3 }} />
                          <Box sx={{ flexGrow: 1 }}>
                            <Typography variant="caption" sx={{ fontWeight: 700, color: '#6d28d9' }}>
                              AI-suggested
                            </Typography>
                          </Box>
                        </Box>
                      )}

                      {/* Agent Reasoning Section */}
                      {task.metadata?.source_agent && (
                        <Box sx={{ 
                          mt: 1.5, 
                          mb: 1.5,
                          p: 1.5, 
                          bgcolor: '#f8f9fa', 
                          borderRadius: 2,
                          border: '1px solid #e0e0e0',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 1.5
                        }}>
                          <AgentIcon sx={{ fontSize: 16, color: pillarColor, mt: 0.3 }} />
                          <Box sx={{ flexGrow: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                              <Typography variant="caption" sx={{ fontWeight: 700, color: '#444' }}>
                                Suggested by {task.metadata.source_agent.replace('Agent', '')}
                              </Typography>
                            </Box>
                            {task.metadata.reasoning && (
                              <Typography variant="caption" sx={{ color: '#666', display: 'block', lineHeight: 1.4 }}>
                                "{task.metadata.reasoning}"
                              </Typography>
                            )}
                            {/* Gap scoring breakdown for ContentGapRadarAgent tasks */}
                            {task.metadata.source_agent === 'ContentGapRadarAgent' && task.metadata.context_data?.gap?.scoring && (
                              <GapScoringBreakdown scoring={task.metadata.context_data.gap.scoring} />
                            )}
                          </Box>
                        </Box>
                      )}

                      {/* Task Actions */}
                      <Box sx={{ display: 'flex', gap: 1.25, mt: 2 }}>
                        {status === 'pending' && task.enabled && (
                          <Button
                            variant="contained"
                            size="small"
                            startIcon={<AlwrityIcon />}
                            onClick={() => handleTaskAction(task)}
                            disabled={isLoading}
                            sx={{
                              background: pillarColor,
                              '&:hover': {
                                background: pillarColor,
                                opacity: 0.9
                              }
                            }}
                          >
                            ALwrity it
                          </Button>
                        )}

                        {status === 'active' && (
                          <Button
                            variant="outlined"
                            size="small"
                            startIcon={<PlayIcon />}
                            onClick={() => handleTaskAction(task)}
                            disabled={isLoading}
                            sx={{ borderColor: pillarColor, color: pillarColor }}
                          >
                            Continue
                          </Button>
                        )}

                        {status === 'completed' && (
                          <Button
                            variant="outlined"
                            size="small"
                            startIcon={<CheckIcon />}
                            disabled
                            sx={{ borderColor: '#4CAF50', color: '#4CAF50' }}
                          >
                            Completed
                          </Button>
                        )}

                        {status === 'pending' && (
                          <Button
                            variant="text"
                            size="small"
                            startIcon={<SkipIcon />}
                            onClick={() => handleSkipTask(task)}
                            disabled={isLoading}
                            sx={{ color: '#FF9800' }}
                          >
                            Skip
                          </Button>
                        )}
                      </Box>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </Stack>
          )}
        </Box>

        {/* Footer Actions */}
        <Box sx={{ p: { xs: 2, md: 3 }, borderTop: '1px solid rgba(0,0,0,0.08)' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="body2" sx={{ color: '#5A5F6A' }}>
              {isComplete ? '🎉 All tasks completed!' : `${pillarTasks.length} tasks in this pillar`}
            </Typography>
            
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
              {/* Next button for all pillars except the last one */}
              {!isLastPillar && (
                <>
                  <Button variant="outlined" onClick={onClose}>
                    Close
                  </Button>
                  <Tooltip 
                    title={areAllTasksCompleted 
                      ? `All tasks completed! Click to proceed to ${nextPillarId ? nextPillarId.charAt(0).toUpperCase() + nextPillarId.slice(1) : 'next'} pillar` 
                      : "Complete or skip all tasks in this pillar to proceed"
                    }
                    arrow
                  >
                    <span>
                      <Button
                        variant="contained"
                        startIcon={<NavigateNext />}
                        onClick={handleNextPillar}
                        disabled={!areAllTasksCompleted || isLoading}
                        sx={{
                          background: pillarColor,
                          '&:hover': {
                            background: pillarColor,
                            opacity: 0.9
                          },
                          '&:disabled': {
                            background: '#ccc',
                            color: '#666'
                          }
                        }}
                      >
                        Next
                      </Button>
                    </span>
                  </Tooltip>
                </>
              )}
              
              {/* Last pillar (Remarket) - Workflow Complete button acts as close */}
              {isLastPillar && (
                <Button
                  variant="contained"
                  startIcon={<CheckIcon />}
                  onClick={handleWorkflowComplete}
                  sx={{
                    background: '#4CAF50',
                    '&:hover': {
                      background: '#45a049',
                      opacity: 0.9
                    }
                  }}
                >
                  Workflow Complete!
                </Button>
              )}
            </Box>
          </Box>
        </Box>
      </Paper>
    </Modal>
  );
};

export default EnhancedTodayModal;
