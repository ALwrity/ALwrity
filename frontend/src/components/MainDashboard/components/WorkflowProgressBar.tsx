import React from 'react';
import { 
  Box, 
  Typography, 
  LinearProgress, 
  Chip, 
  IconButton,
  Tooltip,
  useTheme
} from '@mui/material';
import { motion } from 'framer-motion';
import { 
  PlayArrow, 
  Pause, 
  CheckCircle, 
  Schedule,
  TrendingUp,
  CloudOff
} from '@mui/icons-material';
import { useWorkflowStore } from '../../../stores/workflowStore';

interface WorkflowProgressBarProps {
  onStartWorkflow?: () => void;
  onPauseWorkflow?: () => void;
  onResumeWorkflow?: () => void;
  showControls?: boolean;
  compact?: boolean;
}

const WorkflowProgressBar: React.FC<WorkflowProgressBarProps> = ({
  onStartWorkflow,
  onPauseWorkflow,
  onResumeWorkflow,
  showControls = true,
  compact = false
}) => {
  const theme = useTheme();
  const {
    currentWorkflow,
    workflowProgress,
    navigationState,
    isLoading,
    startWorkflow,
    isWorkflowComplete,
    getCompletionPercentage,
    generateDailyWorkflow,
    isDegradedMode,
    degradedModeReason
  } = useWorkflowStore();

  const completionPercentage = getCompletionPercentage();
  const isComplete = isWorkflowComplete();
  const currentTask = navigationState?.currentTask;

  // Always show the progress bar, even if no workflow exists yet

  const handleStartWorkflow = async () => {
    try {
      if (currentWorkflow) {
        await startWorkflow(currentWorkflow.id);
        onStartWorkflow?.();
      } else {
        // Generate a new workflow if none exists
        await generateDailyWorkflow('demo-user');
        onStartWorkflow?.();
      }
    } catch (error) {
      console.error('Failed to start workflow:', error);
    }
  };

  const getStatusColor = () => {
    if (isComplete) return theme.palette.success.main;
    if (currentWorkflow?.workflowStatus === 'in_progress') return theme.palette.primary.main;
    return theme.palette.grey[500];
  };

  const getStatusText = () => {
    if (isComplete) return 'Workflow Complete! 🎉';
    if (currentWorkflow?.workflowStatus === 'in_progress') return 'In Progress';
    if (!currentWorkflow) return 'No Workflow Generated';
    return 'Ready to Start';
  };

  const getProvenanceLabel = () => {
    const summary = currentWorkflow?.provenanceSummary;
    if (!summary) return 'Daily Workflow';
    if (summary.generationMode === 'agent_committee') return 'Personalized by Agents';
    if (summary.generationMode === 'llm_pillar_backfill') return 'AI-Assisted Plan';
    if (summary.generationMode === 'llm_generation' && !summary.fallbackUsed) return 'AI Personalized Guide';
    if (summary.fallbackUsed || summary.generationMode === 'controlled_fallback') return 'Baseline Daily Guide';
    return 'Daily Workflow';
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
          borderRadius: 2,
          p: compact ? 2 : 3,
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          mb: 3
        }}
      >
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography 
              variant={compact ? "h6" : "h5"} 
              sx={{ 
                fontWeight: 700, 
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                gap: 1
              }}
            >
              {isComplete ? <CheckCircle sx={{ color: theme.palette.success.main }} /> : 
               currentWorkflow?.workflowStatus === 'in_progress' ? <TrendingUp sx={{ color: theme.palette.primary.main }} /> :
               <Schedule sx={{ color: theme.palette.grey[400] }} />}
              Today's Marketing Workflow
            </Typography>
            
            <Chip
              label={getStatusText()}
              size="small"
              sx={{
                background: `${getStatusColor()}20`,
                color: getStatusColor(),
                border: `1px solid ${getStatusColor()}40`,
                fontWeight: 600
              }}
            />
            <Chip
              label={getProvenanceLabel()}
              size="small"
              sx={{
                background: 'rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.9)',
                border: '1px solid rgba(255,255,255,0.2)',
                fontWeight: 600
              }}
            />
          </Box>

          {/* Controls */}
          {showControls && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {(currentWorkflow?.workflowStatus === 'not_started' || !currentWorkflow) && (
                <Tooltip title={currentWorkflow ? "Start Today's Workflow" : "Generate & Start Workflow"}>
                  <IconButton
                    onClick={handleStartWorkflow}
                    disabled={isLoading}
                    sx={{
                      background: theme.palette.primary.main,
                      color: 'white',
                      '&:hover': {
                        background: theme.palette.primary.dark,
                      }
                    }}
                  >
                    <PlayArrow />
                  </IconButton>
                </Tooltip>
              )}
              
              {currentWorkflow?.workflowStatus === 'in_progress' && (
                <Tooltip title="Pause Workflow">
                  <IconButton
                    onClick={onPauseWorkflow}
                    disabled={isLoading}
                    sx={{
                      background: theme.palette.warning.main,
                      color: 'white',
                      '&:hover': {
                        background: theme.palette.warning.dark,
                      }
                    }}
                  >
                    <Pause />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          )}
        </Box>


        {isDegradedMode && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              mb: 2,
              p: 1.5,
              borderRadius: 1,
              border: `1px solid ${theme.palette.warning.main}55`,
              bgcolor: `${theme.palette.warning.main}18`,
            }}
          >
            <CloudOff sx={{ color: theme.palette.warning.light, fontSize: 18 }} />
            <Typography variant="body2" sx={{ color: theme.palette.warning.light, fontWeight: 600 }}>
              Degraded mode
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.75)' }}>
              {degradedModeReason || 'Server workflow is unavailable; local fallback is active.'}
            </Typography>
          </Box>
        )}

        {/* Progress Bar */}
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>
              Progress
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>
              {workflowProgress?.completedTasks || 0} of {workflowProgress?.totalTasks || 0} tasks
            </Typography>
          </Box>
          
          <LinearProgress
            variant="determinate"
            value={currentWorkflow ? completionPercentage : 0}
            sx={{
              height: 8,
              borderRadius: 4,
              background: 'rgba(255,255,255,0.1)',
              '& .MuiLinearProgress-bar': {
                background: isComplete 
                  ? `linear-gradient(90deg, ${theme.palette.success.main} 0%, ${theme.palette.success.light} 100%)`
                  : `linear-gradient(90deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.light} 100%)`,
                borderRadius: 4,
                boxShadow: `0 0 10px ${isComplete ? theme.palette.success.main : theme.palette.primary.main}40`
              }
            }}
          />
          
          <Typography 
            variant="caption" 
            sx={{ 
              color: 'rgba(255,255,255,0.6)', 
              mt: 0.5, 
              display: 'block',
              textAlign: 'right'
            }}
          >
            {currentWorkflow ? `${completionPercentage}% complete` : 'No workflow active'}
          </Typography>
        </Box>

        {/* Current Task Info */}
        {currentTask && !isComplete && (
          <Box
            sx={{
              background: 'rgba(255,255,255,0.05)',
              borderRadius: 1,
              p: 2,
              border: '1px solid rgba(255,255,255,0.1)'
            }}
          >
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', mb: 0.5 }}>
              Current Task:
            </Typography>
            <Typography variant="body1" sx={{ color: 'white', fontWeight: 600 }}>
              {currentTask.title}
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
              {currentTask.description}
            </Typography>
          </Box>
        )}

        {/* Time Information */}
        {workflowProgress && (
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
              Time Spent: {workflowProgress.actualTimeSpent} min
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
              Est. Remaining: {workflowProgress.estimatedTimeRemaining} min
            </Typography>
          </Box>
        )}
      </Box>
    </motion.div>
  );
};

export default WorkflowProgressBar;
