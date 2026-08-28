import React, { useState, useMemo } from 'react';
import {
  Paper,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  LinearProgress,
  Chip,
  IconButton,
  Tooltip,
  Collapse,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Badge,
  CircularProgress
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import InfoIcon from '@mui/icons-material/Info';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import ScheduleIcon from '@mui/icons-material/Schedule';
import SpeedIcon from '@mui/icons-material/Speed';
import DataUsageIcon from '@mui/icons-material/DataUsage';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import RecommendIcon from '@mui/icons-material/Recommend';
import TimelineIcon from '@mui/icons-material/Timeline';
import AssessmentIcon from '@mui/icons-material/Assessment';
import SecurityIcon from '@mui/icons-material/Security';
import BuildIcon from '@mui/icons-material/Build';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import StopIcon from '@mui/icons-material/Stop';
import RefreshIcon from '@mui/icons-material/Refresh';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import { motion, AnimatePresence } from 'framer-motion';

// Import enhanced types and STEP_INFO from the updated polling hook
import { 
  type CalendarGenerationProgress, 
  type QualityScores, 
  type StepResult,
  STEP_INFO 
} from './useCalendarGenerationPolling';

// Import styles
import {
  stepResultsCardStyles,
  stepResultsHeaderStyles,
  stepResultsContentStyles,
  animationDurations,
  animationEasing,
  springConfig,
  staggerDelay
} from '../CalendarGenerationModal.styles';

interface StepProgressTrackerProps {
  progress: CalendarGenerationProgress;
  isPolling?: boolean;
  getStepStatus?: (stepNumber: number) => string;
  getStepQualityScore?: (stepNumber: number) => number;
  getStepErrors?: (stepNumber: number) => any[];
  getStepWarnings?: (stepNumber: number) => any[];
  onStepClick?: (stepNumber: number) => void;
  onRetryStep?: (stepNumber: number) => void;
  onSkipStep?: (stepNumber: number) => void;
  onPauseGeneration?: () => void;
  onResumeGeneration?: () => void;
  onCancelGeneration?: () => void;
}

// Step-specific icons for visual identification
const STEP_ICONS = {
  1: <AssessmentIcon />,
  2: <DataUsageIcon />,
  3: <TimelineIcon />,
  4: <ScheduleIcon />,
  5: <BuildIcon />,
  6: <SpeedIcon />,
  7: <LightbulbIcon />,
  8: <TimelineIcon />,
  9: <RecommendIcon />,
  10: <TrendingUpIcon />,
  11: <SecurityIcon />,
  12: <AutoAwesomeIcon />
};

// Step status colors
const STEP_STATUS_COLORS = {
  pending: '#9e9e9e',
  running: '#2196f3',
  completed: '#4caf50',
  failed: '#f44336',
  skipped: '#ff9800'
};

const StepProgressTracker: React.FC<StepProgressTrackerProps> = ({
  progress,
  isPolling,
  getStepStatus,
  getStepQualityScore,
  getStepErrors,
  getStepWarnings,
  onStepClick,
  onRetryStep,
  onSkipStep,
  onPauseGeneration,
  onResumeGeneration,
  onCancelGeneration
}) => {
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  // Helper functions
  const getStepStatusColor = (stepNumber: number) => {
    const status = getStepStatus ? getStepStatus(stepNumber) : progress.stepResults[stepNumber]?.status || 'pending';
    return STEP_STATUS_COLORS[status as keyof typeof STEP_STATUS_COLORS] || STEP_STATUS_COLORS.pending;
  };

  const getStepStatusIcon = (stepNumber: number) => {
    const status = getStepStatus ? getStepStatus(stepNumber) : progress.stepResults[stepNumber]?.status || 'pending';
    switch (status) {
      case 'completed': return <CheckCircleIcon />;
      case 'running': return <CircularProgress size={20} />;
      case 'failed': return <ErrorIcon />;
      case 'skipped': return <WarningIcon />;
      default: return <InfoIcon />;
    }
  };

  const getQualityScoreColor = (stepNumber: number) => {
    const score = getStepQualityScore ? getStepQualityScore(stepNumber) : progress.qualityScores[`step${stepNumber}` as keyof QualityScores] || 0;
    if (score >= 0.9) return 'success';
    if (score >= 0.8) return 'warning';
    return 'error';
  };

  // Computed values
  const completedSteps = useMemo(() => {
    return Object.values(progress.stepResults).filter(result => result.status === 'completed').length;
  }, [progress.stepResults]);

  const failedSteps = useMemo(() => {
    return Object.values(progress.stepResults).filter(result => result.status === 'failed').length;
  }, [progress.stepResults]);

  const runningSteps = useMemo(() => {
    return Object.values(progress.stepResults).filter(result => result.status === 'running').length;
  }, [progress.stepResults]);

  const isGenerationActive = progress.status !== 'completed' && progress.status !== 'error';

  const renderStepCard = (stepNumber: number) => {
    const stepResult = progress.stepResults[stepNumber];
    const stepInfo = STEP_INFO[stepNumber as keyof typeof STEP_INFO];
    const stepStatus = getStepStatus ? getStepStatus(stepNumber) : stepResult?.status || 'pending';
    const stepErrors = getStepErrors ? getStepErrors(stepNumber) : progress.errors.filter(error => error.step === stepNumber);
    const stepWarnings = getStepWarnings ? getStepWarnings(stepNumber) : progress.warnings.filter(warning => warning.step === stepNumber);
    const isExpanded = expandedStep === stepNumber;
    const hasIssues = stepErrors.length > 0 || stepWarnings.length > 0;

    return (
      <motion.div
        key={stepNumber}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ 
          delay: (stepNumber - 1) * 0.05, 
          duration: 0.3,
          ease: "easeOut"
        }}
      >
        <Card
          sx={{
            mb: 2,
            border: `2px solid ${getStepStatusColor(stepNumber)}`,
            backgroundColor: stepStatus === 'running' ? 'action.hover' : 'background.paper',
            cursor: 'pointer',
            '&:hover': {
              boxShadow: 4,
              transform: 'translateY(-2px)',
              transition: 'all 0.2s ease-in-out'
            }
          }}
          onClick={() => {
            setExpandedStep(isExpanded ? null : stepNumber);
            onStepClick?.(stepNumber);
          }}
        >
          <CardContent sx={{ p: 2 }}>
            <Grid container alignItems="center" spacing={2}>
              {/* Step Icon and Number */}
              <Grid item>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    backgroundColor: `${getStepStatusColor(stepNumber)}20`,
                    color: getStepStatusColor(stepNumber)
                  }}
                >
                  {getStepStatusIcon(stepNumber)}
                </Box>
              </Grid>

              {/* Step Info */}
              <Grid item xs>
                <Box>
                  <Typography variant="h6" fontWeight="bold" gutterBottom>
                    Step {stepNumber}: {stepInfo?.name || `Step ${stepNumber}`}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    {stepInfo?.description || 'Processing...'}
                  </Typography>
                  
                  {/* Progress Bar for Running Steps */}
                  {stepStatus === 'running' && (
                    <Box mt={1}>
                      <LinearProgress
                        variant="indeterminate"
                        sx={{ height: 4, borderRadius: 2 }}
                      />
                    </Box>
                  )}
                </Box>
              </Grid>

              {/* Status and Quality */}
              <Grid item>
                <Box display="flex" alignItems="center" gap={1}>
                  <Chip
                    label={stepStatus}
                    size="small"
                    sx={{
                      backgroundColor: getStepStatusColor(stepNumber),
                      color: 'white',
                      fontWeight: 'bold'
                    }}
                  />
                  
                  {stepResult?.qualityScore && (
                    <Chip
                      icon={<TrendingUpIcon />}
                      label={`${Math.round(stepResult.qualityScore * 100)}%`}
                      color={getQualityScoreColor(stepNumber)}
                      size="small"
                    />
                  )}

                  {hasIssues && (
                    <Badge badgeContent={stepErrors.length + stepWarnings.length} color="error">
                      <WarningIcon color="warning" />
                    </Badge>
                  )}
                </Box>
              </Grid>

              {/* Expand/Collapse Icon */}
              <Grid item>
                <IconButton size="small">
                  {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </IconButton>
              </Grid>
            </Grid>

            {/* Expanded Details */}
            <Collapse in={isExpanded}>
              <Box mt={2}>
                <Divider sx={{ mb: 2 }} />
                
                {/* Execution Details */}
                {stepResult && (
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle2" gutterBottom>
                        Execution Details
                      </Typography>
                      <List dense>
                        {stepResult.startTime && (
                          <ListItem>
                            <ListItemIcon>
                              <ScheduleIcon color="action" />
                            </ListItemIcon>
                            <ListItemText
                              primary="Start Time"
                              secondary={new Date(stepResult.startTime).toLocaleString()}
                            />
                          </ListItem>
                        )}
                        
                        {stepResult.endTime && (
                          <ListItem>
                            <ListItemIcon>
                              <ScheduleIcon color="action" />
                            </ListItemIcon>
                            <ListItemText
                              primary="End Time"
                              secondary={new Date(stepResult.endTime).toLocaleString()}
                            />
                          </ListItem>
                        )}
                        
                        {stepResult.duration && (
                          <ListItem>
                            <ListItemIcon>
                              <SpeedIcon color="action" />
                            </ListItemIcon>
                            <ListItemText
                              primary="Duration"
                              secondary={`${Math.round(stepResult.duration)} seconds`}
                            />
                          </ListItem>
                        )}
                      </List>
                    </Grid>

                    {/* Data Sources */}
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle2" gutterBottom>
                        Data Sources Used
                      </Typography>
                      <Box display="flex" flexWrap="wrap" gap={1}>
                        {stepResult.metadata?.dataSources?.map((source: string, index: number) => (
                          <Chip
                            key={index}
                            label={source}
                            size="small"
                            variant="outlined"
                            icon={<DataUsageIcon />}
                          />
                        )) || (
                          <Typography variant="body2" color="text.secondary">
                            No data sources recorded
                          </Typography>
                        )}
                      </Box>
                    </Grid>
                  </Grid>
                )}

                {/* Errors and Warnings */}
                {hasIssues && (
                  <Box mt={2}>
                    <Divider sx={{ mb: 2 }} />
                    
                    {stepErrors.length > 0 && (
                      <Alert severity="error" sx={{ mb: 1 }}>
                        <Typography variant="subtitle2" gutterBottom>
                          Errors ({stepErrors.length})
                        </Typography>
                        {stepErrors.map((error, index) => (
                          <Typography key={index} variant="body2">
                            {error.message}
                          </Typography>
                        ))}
                      </Alert>
                    )}

                    {stepWarnings.length > 0 && (
                      <Alert severity="warning" sx={{ mb: 1 }}>
                        <Typography variant="subtitle2" gutterBottom>
                          Warnings ({stepWarnings.length})
                        </Typography>
                        {stepWarnings.map((warning, index) => (
                          <Typography key={index} variant="body2">
                            {warning.message}
                          </Typography>
                        ))}
                      </Alert>
                    )}
                  </Box>
                )}

                {/* Action Buttons */}
                <Box mt={2} display="flex" gap={1}>
                  {stepStatus === 'failed' && onRetryStep && (
                    <Tooltip title="Retry this step">
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRetryStep(stepNumber);
                        }}
                      >
                        <RefreshIcon />
                      </IconButton>
                    </Tooltip>
                  )}
                  
                  {stepStatus === 'pending' && onSkipStep && (
                    <Tooltip title="Skip this step">
                      <IconButton
                        size="small"
                        color="warning"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSkipStep(stepNumber);
                        }}
                      >
                        <SkipNextIcon />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              </Box>
            </Collapse>
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  return (
    <Paper elevation={1} sx={{ p: 3 }}>
      {/* Header */}
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight="bold" gutterBottom>
            Step Progress Tracker
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Real-time tracking of the 12-step calendar generation process
          </Typography>
        </Box>
        
        <Box display="flex" alignItems="center" gap={2}>
          {/* Generation Controls */}
          {isGenerationActive && (
            <Box display="flex" gap={1}>
              {onPauseGeneration && (
                <Tooltip title="Pause Generation">
                  <IconButton color="warning" onClick={onPauseGeneration}>
                    <PauseIcon />
                  </IconButton>
                </Tooltip>
              )}
              
              {onResumeGeneration && (
                <Tooltip title="Resume Generation">
                  <IconButton color="primary" onClick={onResumeGeneration}>
                    <PlayArrowIcon />
                  </IconButton>
                </Tooltip>
              )}
              
              {onCancelGeneration && (
                <Tooltip title="Cancel Generation">
                  <IconButton color="error" onClick={onCancelGeneration}>
                    <StopIcon />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          )}
          
          {/* Toggle Details */}
          <Tooltip title={showDetails ? "Hide Details" : "Show Details"}>
            <IconButton onClick={() => setShowDetails(!showDetails)}>
              {showDetails ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Overall Progress Summary */}
      <Box mb={3}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={3}>
            <Card variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h4" color="primary" fontWeight="bold">
                {completedSteps}/12
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Steps Completed
              </Typography>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={3}>
            <Card variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h4" color="error" fontWeight="bold">
                {failedSteps}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Failed Steps
              </Typography>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={3}>
            <Card variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h4" color="primary" fontWeight="bold">
                {runningSteps}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Currently Running
              </Typography>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={3}>
            <Card variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h4" color="success.main" fontWeight="bold">
                {Math.round(progress.qualityScores.overall * 100)}%
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Overall Quality
              </Typography>
            </Card>
          </Grid>
        </Grid>
      </Box>

      {/* Overall Progress Bar */}
      <Box mb={3}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
          <Typography variant="subtitle2">
            Overall Progress
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {Math.round(progress.overallProgress)}%
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={progress.overallProgress}
          sx={{ height: 8, borderRadius: 4 }}
        />
      </Box>

      {/* Step Cards */}
      <AnimatePresence>
        {Array.from({ length: 12 }, (_, i) => i + 1).map(stepNumber => 
          renderStepCard(stepNumber)
        )}
      </AnimatePresence>

      {/* No Progress Message */}
      {Object.keys(progress.stepResults).length === 0 && (
        <Box textAlign="center" py={4}>
          <InfoIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No Steps Started
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Step progress will appear here once the calendar generation begins.
          </Typography>
        </Box>
      )}
    </Paper>
  );
};

export default StepProgressTracker;
