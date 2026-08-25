import React from 'react';
import {
  Paper,
  Typography,
  Box,
  Grid,
  LinearProgress,
  Chip,
  CircularProgress,
  Card,
  Tooltip,
  IconButton,
  Collapse,
  Alert
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import InfoIcon from '@mui/icons-material/Info';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ScheduleIcon from '@mui/icons-material/Schedule';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
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
  progressBarContainerStyles,
  stepProgressBarStyles,
  getStepCardStyles,
  stepCircleBaseStyles,
  getStepCircleColor,
  activityIndicatorStyles,
  animationDurations,
  animationEasing,
  springConfig,
  staggerDelay,
  smallPulseAnimation,
  colorPulseAnimation,
  stepProgressOverlayStyles
} from '../CalendarGenerationModal.styles';

interface LiveProgressPanelProps {
  progress: CalendarGenerationProgress;
  isPolling: boolean;
  getStepStatus?: (stepNumber: number) => string;
  getStepQualityScore?: (stepNumber: number) => number;
  getStepErrors?: (stepNumber: number) => any[];
  getStepWarnings?: (stepNumber: number) => any[];
}

const LiveProgressPanel: React.FC<LiveProgressPanelProps> = ({ 
  progress, 
  isPolling,
  getStepStatus,
  getStepQualityScore,
  getStepErrors,
  getStepWarnings
}) => {
  const [expandedSteps, setExpandedSteps] = React.useState<Set<number>>(new Set());

  const toggleStepExpansion = (stepNumber: number) => {
    const newExpanded = new Set(expandedSteps);
    if (newExpanded.has(stepNumber)) {
      newExpanded.delete(stepNumber);
    } else {
      newExpanded.add(stepNumber);
    }
    setExpandedSteps(newExpanded);
  };

  const getStepStatusColor = (stepNumber: number) => {
    const status = getStepStatus ? getStepStatus(stepNumber) : progress.stepResults[stepNumber]?.status || 'pending';
    switch (status) {
      case 'completed': return '#4caf50';
      case 'running': return '#1976d2';
      case 'failed': return '#f44336';
      case 'skipped': return '#ff9800';
      default: return '#9e9e9e';
    }
  };

  const getStepStatusIcon = (stepNumber: number) => {
    const status = getStepStatus ? getStepStatus(stepNumber) : progress.stepResults[stepNumber]?.status || 'pending';
    switch (status) {
      case 'completed': return <CheckCircleIcon fontSize="small" />;
      case 'running': return <CircularProgress size={16} />;
      case 'failed': return <ErrorIcon fontSize="small" />;
      case 'skipped': return <WarningIcon fontSize="small" />;
      default: return <InfoIcon fontSize="small" />;
    }
  };

  const getQualityScoreColor = (stepNumber: number) => {
    const score = getStepQualityScore ? getStepQualityScore(stepNumber) : progress.qualityScores[`step${stepNumber}` as keyof QualityScores] || 0;
    if (score >= 0.9) return 'success';
    if (score >= 0.8) return 'warning';
    return 'error';
  };



  return (
    <Paper elevation={1} sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Live Progress - 12-Step Calendar Generation
      </Typography>
      
      {/* Current Status with Enhanced Animation */}
      <Box mb={3}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Box display="flex" alignItems="center" gap={2} mb={2}>
            <motion.div
              animate={{ 
                rotate: isPolling ? 360 : 0,
                scale: isPolling ? [1, 1.2, 1] : 1
              }}
              transition={{ 
                rotate: { duration: 2, repeat: Infinity, ease: "linear" },
                scale: { duration: 1, repeat: Infinity, ease: "easeInOut" }
              }}
            >
              <CircularProgress size={20} />
            </motion.div>
            <motion.div
              key={progress.status}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Typography variant="subtitle1">
                Current Step: {progress.currentStep} - {STEP_INFO[progress.currentStep as keyof typeof STEP_INFO]?.name || progress.status}
              </Typography>
            </motion.div>
          </Box>
        </motion.div>
        
        <Box display="flex" alignItems="center" gap={2}>
          <Typography variant="body2" color="text.secondary">
            Step Progress:
          </Typography>
          <Box sx={progressBarContainerStyles}>
            <LinearProgress
              variant="determinate"
              value={progress.stepProgress}
              sx={stepProgressBarStyles}
            />
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: progress.stepProgress / 100 }}
              transition={{ duration: 0.6, ease: animationEasing.easeOut }}
              style={stepProgressOverlayStyles}
            />
          </Box>
          <motion.div
            key={progress.stepProgress}
            initial={{ scale: 1.2 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <Typography variant="body2" color="text.secondary">
              {Math.round(progress.stepProgress || 0)}%
            </Typography>
          </motion.div>
        </Box>
      </Box>

      {/* 12-Step Progress Grid with Enhanced Visualization */}
      <Box mb={3}>
        <Typography variant="subtitle1" gutterBottom>
          Step-by-Step Progress ({progress.metadata?.completedSteps || 0}/12 Completed)
        </Typography>
        
        <Grid container spacing={2}>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((step, index) => {
            const stepInfo = STEP_INFO[step as keyof typeof STEP_INFO];
            const stepStatus = getStepStatus ? getStepStatus(step) : progress.stepResults[step]?.status || 'pending';
                         const stepErrors = getStepErrors ? getStepErrors(step) : progress.errors.filter(error => error.step === step);
             const stepWarnings = getStepWarnings ? getStepWarnings(step) : progress.warnings.filter(warning => warning.step === step);
            const isExpanded = expandedSteps.has(step);
            
            return (
              <Grid item xs={12} sm={6} md={4} lg={3} key={step}>
                <motion.div
                  initial={{ opacity: 0, y: 50, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ 
                    delay: index * 0.1, 
                    duration: 0.6, 
                    ease: "easeOut",
                    type: "spring",
                    stiffness: 100
                  }}
                  whileHover={{ 
                    scale: 1.02,
                    y: -5,
                    transition: { duration: 0.2 }
                  }}
                >
                  <Card 
                    variant="outlined" 
                    sx={{
                      ...getStepCardStyles(progress.currentStep, step),
                      borderColor: getStepStatusColor(step),
                      borderWidth: stepStatus === 'running' ? 2 : 1
                    }}
                  >
                    <Box display="flex" alignItems="center" gap={2} mb={1}>
                      <motion.div
                        animate={{ 
                          rotate: stepStatus === 'running' ? [0, 10, -10, 0] : 0,
                          scale: stepStatus === 'running' ? 1.1 : 1,
                          backgroundColor: getStepStatusColor(step)
                        }}
                        transition={{ 
                          rotate: { duration: 0.5 },
                          scale: { duration: 0.3 },
                          backgroundColor: { duration: 0.3 }
                        }}
                        style={{
                          ...stepCircleBaseStyles,
                          backgroundColor: getStepStatusColor(step)
                        }}
                      >
                        {stepStatus === 'completed' ? (
                          <motion.div
                            initial={{ scale: 0, rotate: -180 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{ type: "spring", stiffness: 200, damping: 10 }}
                          >
                            <CheckCircleIcon fontSize="small" />
                          </motion.div>
                        ) : (
                          <Box display="flex" alignItems="center" justifyContent="center">
                            {getStepStatusIcon(step)}
                          </Box>
                        )}
                      </motion.div>
                      <Box flex={1}>
                        <Typography variant="subtitle2">
                          Step {step}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {stepInfo?.name || `Step ${step}`}
                        </Typography>
                      </Box>
                      <IconButton
                        size="small"
                        onClick={() => toggleStepExpansion(step)}
                        sx={{ p: 0.5 }}
                      >
                        {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      </IconButton>
                    </Box>
                    
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      {stepInfo?.description || 'Processing...'}
                    </Typography>
                    
                    {/* Quality Score */}
                    {stepStatus !== 'pending' && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
                      >
                        <Box display="flex" alignItems="center" gap={1} mb={1}>
                          <motion.div
                            animate={smallPulseAnimation}
                            transition={{ 
                              duration: 2, 
                              repeat: Infinity,
                              ease: animationEasing.easeInOut 
                            }}
                          >
                            <Chip
                              label={`${Math.round(((getStepQualityScore ? getStepQualityScore(step) : progress.qualityScores[`step${step}` as keyof QualityScores] || 0) * 100) || 0)}%`}
                              size="small"
                              color={getQualityScoreColor(step)}
                              icon={<TrendingUpIcon />}
                            />
                          </motion.div>
                          <Typography variant="caption" color="text.secondary">
                            Quality
                          </Typography>
                        </Box>
                      </motion.div>
                    )}

                    {/* Step Details Collapse */}
                    <Collapse in={isExpanded}>
                      <Box mt={1} p={1} bgcolor="grey.50" borderRadius={1}>
                        {/* Step Duration */}
                        {progress.stepResults[step]?.duration && (
                          <Box display="flex" alignItems="center" gap={1} mb={1}>
                            <ScheduleIcon fontSize="small" color="action" />
                                                         <Typography variant="caption">
                               Duration: {Math.round(progress.stepResults[step]?.duration || 0)}s
                             </Typography>
                          </Box>
                        )}

                        {/* Errors */}
                                                {stepErrors.length > 0 && (  
                          <Box mb={1}>
                            <Alert severity="error">
                              {stepErrors.length} error(s) found
                            </Alert>
                          </Box>
                        )}

                        {/* Warnings */}
                        {stepWarnings.length > 0 && (
                          <Box mb={1}>
                            <Alert severity="warning">
                              {stepWarnings.length} warning(s) found
                            </Alert>
                          </Box>
                        )}

                        {/* Step Metadata */}
                        {progress.stepResults[step]?.metadata && (
                                                    <Box>
                            <Typography variant="caption" color="text.secondary">
                              Data Sources: {progress.stepResults[step]?.metadata?.dataSources?.join(', ') || 'None'} 
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    </Collapse>
                  </Card>
                </motion.div>
              </Grid>
            );
          })}
        </Grid>
      </Box>

      {/* Recent Activity with Staggered Animation */}
      <Box mb={3}>
        <Typography variant="subtitle1" gutterBottom>
          Recent Activity
        </Typography>
        
        <Box sx={{ maxHeight: 200, overflowY: 'auto' }}>
          <AnimatePresence>
            {progress.transparencyMessages.map((message, index) => (
              <motion.div
                key={`${message}-${index}`}
                initial={{ opacity: 0, x: -20, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 20, scale: 0.95 }}
                transition={{ 
                  delay: index * 0.1, 
                  duration: 0.4,
                  ease: "easeOut"
                }}
              >
                <Box display="flex" alignItems="flex-start" gap={2} mb={1}>
                  <motion.div
                    animate={colorPulseAnimation}
                    transition={{ 
                      duration: 2, 
                      repeat: Infinity,
                      ease: "easeInOut" 
                    }}
                    style={activityIndicatorStyles}
                  />
                  <Typography variant="body2">
                    {message}
                  </Typography>
                </Box>
              </motion.div>
            ))}
          </AnimatePresence>
        </Box>
      </Box>

      {/* Enhanced Performance Metrics with Counter Animation */}
      <Box>
        <Typography variant="subtitle1" gutterBottom>
          Performance Metrics
        </Typography>
        
        <Grid container spacing={2}>
          {[
            { 
              value: progress.overallProgress, 
              label: 'Overall Progress', 
              color: 'primary.main',
              suffix: '%'
            },
            { 
              value: progress.qualityScores.overall * 100, 
              label: 'Quality Score', 
              color: 'success.main',
              suffix: '%'
            },
            { 
              value: progress.metadata?.completedSteps || 0, 
              label: 'Steps Completed', 
              color: 'info.main',
              suffix: '/12'
            },
            { 
              value: progress.errors.length, 
              label: 'Issues Found', 
              color: 'error.main',
              suffix: ''
            },
            { 
              value: progress.metadata?.failedSteps || 0, 
              label: 'Failed Steps', 
              color: 'warning.main',
              suffix: ''
            },
            { 
              value: progress.metadata?.averageStepDuration || 0, 
              label: 'Avg Step Duration', 
              color: 'secondary.main',
              suffix: 's'
            }
          ].map((metric, index) => (
            <Grid item xs={12} sm={6} md={4} key={index}>
              <motion.div
                initial={{ opacity: 0, y: 30, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ 
                  delay: index * staggerDelay, 
                  duration: animationDurations.medium,
                  type: springConfig.type,
                  stiffness: 100
                }}
                whileHover={{ scale: 1.05 }}
              >
                <Box textAlign="center" p={2}>
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ 
                      delay: index * 0.1 + 0.3, 
                      type: "spring",
                      stiffness: 200,
                      damping: 10
                    }}
                  >
                    <Typography 
                      variant="h5" 
                      sx={{ color: metric.color }} 
                      gutterBottom
                    >
                      <motion.span
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ 
                          delay: index * 0.1 + 0.5, 
                          duration: 0.5,
                          ease: "easeOut"
                        }}
                      >
                        {Math.round(metric.value)}
                      </motion.span>
                      {metric.suffix}
                    </Typography>
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.1 + 0.8, duration: 0.5 }}
                  >
                    <Typography variant="body2">
                      {metric.label}
                    </Typography>
                  </motion.div>
                </Box>
              </motion.div>
            </Grid>
          ))}
        </Grid>
      </Box>
    </Paper>
  );
};

export default LiveProgressPanel;
