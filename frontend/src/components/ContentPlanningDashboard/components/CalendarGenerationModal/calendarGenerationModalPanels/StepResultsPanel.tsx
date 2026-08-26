import React, { useState } from 'react';
import {
  Paper,
  Typography,
  Box,
  Chip,
  Card,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Grid,
  LinearProgress,
  Alert,
  IconButton,
  Tooltip,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Badge
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import InfoIcon from '@mui/icons-material/Info';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import ScheduleIcon from '@mui/icons-material/Schedule';
import DataUsageIcon from '@mui/icons-material/DataUsage';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import RecommendIcon from '@mui/icons-material/Recommend';
import TimelineIcon from '@mui/icons-material/Timeline';
import AssessmentIcon from '@mui/icons-material/Assessment';
import SpeedIcon from '@mui/icons-material/Speed';
import SecurityIcon from '@mui/icons-material/Security';
import BuildIcon from '@mui/icons-material/Build';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
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

interface StepResultsPanelProps {
  progress: CalendarGenerationProgress;
  getStepStatus?: (stepNumber: number) => string;
  getStepQualityScore?: (stepNumber: number) => number;
  getStepErrors?: (stepNumber: number) => any[];
  getStepWarnings?: (stepNumber: number) => any[];
}

// Step-specific icons for better visual identification
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

const StepResultsPanel: React.FC<StepResultsPanelProps> = ({ 
  progress,
  getStepStatus,
  getStepQualityScore,
  getStepErrors,
  getStepWarnings
}) => {
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());

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
      case 'completed': return 'success';
      case 'running': return 'primary';
      case 'failed': return 'error';
      case 'skipped': return 'warning';
      default: return 'default';
    }
  };

  const getStepStatusIcon = (stepNumber: number) => {
    const status = getStepStatus ? getStepStatus(stepNumber) : progress.stepResults[stepNumber]?.status || 'pending';
    switch (status) {
      case 'completed': return <CheckCircleIcon />;
      case 'running': return <InfoIcon />;
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

  const formatStepData = (data: any): string => {
    if (typeof data === 'string') return data;
    if (typeof data === 'number') return data.toString();
    if (Array.isArray(data)) return data.join(', ');
    if (typeof data === 'object' && data !== null) {
      return Object.entries(data)
        .map(([key, value]) => `${key}: ${formatStepData(value)}`)
        .join('; ');
    }
    return String(data);
  };

  const renderStepResults = (stepNumber: number) => {
    const stepResult = progress.stepResults[stepNumber];
    if (!stepResult) return null;

    const stepInfo = STEP_INFO[stepNumber as keyof typeof STEP_INFO];
    const stepStatus = getStepStatus ? getStepStatus(stepNumber) : stepResult.status || 'pending';
    const stepErrors = getStepErrors ? getStepErrors(stepNumber) : progress.errors.filter(error => error.step === stepNumber);
    const stepWarnings = getStepWarnings ? getStepWarnings(stepNumber) : progress.warnings.filter(warning => warning.step === stepNumber);
    const isExpanded = expandedSteps.has(stepNumber);

    return (
      <motion.div
        key={stepNumber}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ 
          delay: (stepNumber - 1) * 0.1, 
          duration: 0.5,
          ease: "easeOut"
        }}
      >
        <Accordion 
          expanded={isExpanded}
          onChange={() => toggleStepExpansion(stepNumber)}
          sx={{ 
            mb: 2,
            border: `2px solid`,
            borderColor: getStepStatusColor(stepNumber) === 'success' ? 'success.main' :
                        getStepStatusColor(stepNumber) === 'error' ? 'error.main' :
                        getStepStatusColor(stepNumber) === 'warning' ? 'warning.main' :
                        'grey.300'
          }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            sx={{
              '&:hover': {
                backgroundColor: 'action.hover'
              }
            }}
          >
            <Grid container alignItems="center" spacing={2}>
              <Grid item>
                <Box display="flex" alignItems="center" gap={1}>
                  <Box sx={{ color: `${getStepStatusColor(stepNumber)}.main` }}>
                    {STEP_ICONS[stepNumber as keyof typeof STEP_ICONS]}
                  </Box>
                  <Typography variant="h6" component="span">
                    Step {stepNumber}
                  </Typography>
                </Box>
              </Grid>
              
              <Grid item xs>
                <Box>
                  <Typography variant="subtitle1" fontWeight="bold">
                    {stepInfo?.name || `Step ${stepNumber}`}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {stepInfo?.description || 'Processing...'}
                  </Typography>
                </Box>
              </Grid>
              
              <Grid item>
                <Box display="flex" alignItems="center" gap={1}>
                  <Chip
                    icon={getStepStatusIcon(stepNumber)}
                    label={stepStatus}
                    color={getStepStatusColor(stepNumber)}
                    size="small"
                  />
                  <Chip
                    icon={<TrendingUpIcon />}
                    label={`${Math.round((getStepQualityScore ? getStepQualityScore(stepNumber) : progress.qualityScores[`step${stepNumber}` as keyof QualityScores] || 0) * 100)}%`}
                    color={getQualityScoreColor(stepNumber)}
                    size="small"
                  />
                  {stepErrors.length > 0 && (
                    <Badge badgeContent={stepErrors.length} color="error">
                      <ErrorIcon color="error" />
                    </Badge>
                  )}
                  {stepWarnings.length > 0 && (
                    <Badge badgeContent={stepWarnings.length} color="warning">
                      <WarningIcon color="warning" />
                    </Badge>
                  )}
                </Box>
              </Grid>
            </Grid>
          </AccordionSummary>
          
          <AccordionDetails>
            <Grid container spacing={3}>
              {/* Step Execution Details */}
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>
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
                  
                  {stepResult.qualityScore && (
                    <ListItem>
                      <ListItemIcon>
                        <TrendingUpIcon color="action" />
                      </ListItemIcon>
                      <ListItemText
                        primary="Quality Score"
                        secondary={`${Math.round(stepResult.qualityScore * 100)}%`}
                      />
                    </ListItem>
                  )}
                </List>
              </Grid>

              {/* Step Data and Results */}
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>
                  Results & Data
                </Typography>
                
                {stepResult.data && (
                  <Box mb={2}>
                    <Typography variant="subtitle2" gutterBottom>
                      Generated Data:
                    </Typography>
                    <Box sx={stepResultsContentStyles}>
                      {Object.entries(stepResult.data).map(([key, value]) => (
                        <Box key={key} mb={1}>
                          <Typography variant="body2" fontWeight="bold" color="text.secondary">
                            {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}:
                          </Typography>
                          <Typography variant="body2">
                            {formatStepData(value)}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  </Box>
                )}

                {stepResult.metadata?.dataSources && (
                  <Box mb={2}>
                    <Typography variant="subtitle2" gutterBottom>
                      Data Sources Used:
                    </Typography>
                    <Box display="flex" flexWrap="wrap" gap={1}>
                      {stepResult.metadata.dataSources.map((source: string, index: number) => (
                        <Chip
                          key={index}
                          label={source}
                          size="small"
                          variant="outlined"
                          color="primary"
                          icon={<DataUsageIcon />}
                        />
                      ))}
                    </Box>
                  </Box>
                )}
              </Grid>

              {/* Errors and Warnings */}
              {(stepErrors.length > 0 || stepWarnings.length > 0) && (
                <Grid item xs={12}>
                  <Divider sx={{ my: 2 }} />
                  
                  {stepErrors.length > 0 && (
                    <Box mb={2}>
                      <Typography variant="h6" color="error" gutterBottom>
                        Errors ({stepErrors.length})
                      </Typography>
                      {stepErrors.map((error, index) => (
                        <Alert key={index} severity="error" sx={{ mb: 1 }}>
                          <Typography variant="body2">
                            {error.message}
                          </Typography>
                          {error.timestamp && (
                            <Typography variant="caption" color="text.secondary">
                              {new Date(error.timestamp).toLocaleString()}
                            </Typography>
                          )}
                        </Alert>
                      ))}
                    </Box>
                  )}

                  {stepWarnings.length > 0 && (
                    <Box mb={2}>
                      <Typography variant="h6" color="warning.main" gutterBottom>
                        Warnings ({stepWarnings.length})
                      </Typography>
                      {stepWarnings.map((warning, index) => (
                        <Alert key={index} severity="warning" sx={{ mb: 1 }}>
                          <Typography variant="body2">
                            {warning.message}
                          </Typography>
                          {warning.timestamp && (
                            <Typography variant="caption" color="text.secondary">
                              {new Date(warning.timestamp).toLocaleString()}
                            </Typography>
                          )}
                        </Alert>
                      ))}
                    </Box>
                  )}
                </Grid>
              )}

              {/* Performance Metrics */}
              {stepResult.metadata?.performanceMetrics && (
                <Grid item xs={12}>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="h6" gutterBottom>
                    Performance Metrics
                  </Typography>
                  <Grid container spacing={2}>
                    {Object.entries(stepResult.metadata.performanceMetrics).map(([key, value]) => (
                      <Grid item xs={12} sm={6} md={4} key={key}>
                        <Card variant="outlined" sx={{ p: 2 }}>
                          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                            {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                          </Typography>
                          <Typography variant="h6">
                            {typeof value === 'number' ? value.toFixed(2) : String(value)}
                          </Typography>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                </Grid>
              )}
            </Grid>
          </AccordionDetails>
        </Accordion>
      </motion.div>
    );
  };

  return (
    <Paper elevation={1} sx={{ p: 2 }}>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
        <Typography variant="h6">
          Step Results - 12-Step Calendar Generation
        </Typography>
        <Box display="flex" alignItems="center" gap={1}>
          <Chip
            label={`${progress.metadata?.completedSteps || 0}/12 Completed`}
            color="primary"
            variant="outlined"
          />
          <Chip
            icon={<TrendingUpIcon />}
            label={`${Math.round(progress.qualityScores.overall * 100)}% Quality`}
            color={progress.qualityScores.overall >= 0.9 ? 'success' : 
                   progress.qualityScores.overall >= 0.8 ? 'warning' : 'error'}
          />
        </Box>
      </Box>

      {/* Overall Progress */}
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

      {/* Step Results */}
      <AnimatePresence>
        {Array.from({ length: 12 }, (_, i) => i + 1).map(stepNumber => 
          renderStepResults(stepNumber)
        )}
      </AnimatePresence>

      {/* No Results Message */}
      {Object.keys(progress.stepResults).length === 0 && (
        <Box textAlign="center" py={4}>
          <InfoIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No Step Results Available
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Step results will appear here as the calendar generation progresses.
          </Typography>
        </Box>
      )}
    </Paper>
  );
};

export default StepResultsPanel;
