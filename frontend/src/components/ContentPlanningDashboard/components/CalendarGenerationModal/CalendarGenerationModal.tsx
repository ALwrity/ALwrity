import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Grid,
  Paper,
  LinearProgress,
  Chip,
  IconButton,
  CircularProgress
} from '@mui/material';
import {
  Close as CloseIcon,
  Schedule as ScheduleIcon,
  TrendingUp as TrendingUpIcon,
  School as SchoolIcon,
  DataUsage as DataUsageIcon,
  ViewModule as ViewModuleIcon,
  Devices as DevicesIcon
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';

// Import existing components for reuse
// Note: DataSourceTransparency and ProgressIndicator are imported but may be used by child components

// Import panel components
import {
  LiveProgressPanel,
  QualityGatesPanel,
  DataSourcePanel,
  StepResultsPanel,
  EducationalPanel,
  useCalendarGenerationPolling,
  type QualityScores
} from './calendarGenerationModalPanels';

// Import new StepProgressTracker component
import StepProgressTracker from './calendarGenerationModalPanels/StepProgressTracker';

// Import styles (only used ones)
import {
  dialogStyles,
  progressBarContainerStyles,
  progressBarStyles,
  getStepIndicatorStyles,
  tabButtonStyles,
  loadingContainerStyles,
  loadingContentStyles,
  animationDurations,
  animationEasing,
  fadeInLeft,
  hoverScale,
  tapScale,
  pulseAnimation,
  progressOverlayStyles
} from './CalendarGenerationModal.styles';

// Types
interface CalendarGenerationModalProps {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  initialConfig: CalendarConfig;
  onComplete: (results: CalendarGenerationResults) => void;
  onError: (error: string) => void;
}

interface CalendarConfig {
  userId: string;
  strategyId: string;
  calendarType: 'monthly' | 'quarterly' | 'yearly';
  platforms: string[];
  duration: number;
  postingFrequency: 'daily' | 'weekly' | 'biweekly';
}

interface CalendarGenerationResults {
  calendar: CalendarData;
  qualityScores: QualityScores;
  insights: GenerationInsights;
  recommendations: Recommendations;
  exportData: ExportData;
}

interface CalendarData {
  id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  content: CalendarContent[];
  themes: Theme[];
  platforms: Platform[];
}

interface CalendarContent {
  id: string;
  title: string;
  description: string;
  contentType: string;
  platform: string;
  scheduledDate: string;
  theme: string;
  keywords: string[];
}

interface Theme {
  id: string;
  name: string;
  description: string;
  weekNumber: number;
  contentTypes: string[];
}

interface Platform {
  id: string;
  name: string;
  contentCount: number;
  postingSchedule: PostingSchedule[];
}

interface PostingSchedule {
  day: string;
  time: string;
  contentType: string;
}

// QualityScores type imported from panels

interface GenerationInsights {
  contentGaps: ContentGap[];
  keywordOpportunities: KeywordOpportunity[];
  audienceInsights: AudienceInsight[];
  platformPerformance: PlatformPerformance[];
}

interface ContentGap {
  id: string;
  title: string;
  description: string;
  impact: number;
  priority: 'high' | 'medium' | 'low';
  estimatedTraffic: number;
}

interface KeywordOpportunity {
  id: string;
  keyword: string;
  searchVolume: number;
  competition: number;
  relevance: number;
  estimatedTraffic: number;
}

interface AudienceInsight {
  id: string;
  segment: string;
  demographics: string[];
  preferences: string[];
  engagementRate: number;
  bestTimes: string[];
}

interface PlatformPerformance {
  id: string;
  platform: string;
  engagementRate: number;
  reach: number;
  conversionRate: number;
  bestContentTypes: string[];
}

interface Recommendations {
  contentMix: ContentMixRecommendation;
  postingSchedule: PostingScheduleRecommendation;
  platformStrategy: PlatformStrategyRecommendation;
  optimizationTips: string[];
}

interface ContentMixRecommendation {
  educational: number;
  thoughtLeadership: number;
  engagement: number;
  promotional: number;
  reasoning: string;
}

interface PostingScheduleRecommendation {
  bestDays: string[];
  bestTimes: string[];
  frequency: string;
  reasoning: string;
}

interface PlatformStrategyRecommendation {
  primaryPlatforms: string[];
  contentDistribution: Record<string, number>;
  crossPlatformStrategy: string;
}

interface ExportData {
  calendarJson: string;
  insightsCsv: string;
  recommendationsPdf: string;
  qualityReport: string;
}

// Polling hook imported from panels

// Types imported from panels

// Remove mock data completely - no fallback
// const mockProgressData: CalendarGenerationProgress = { ... };

const CalendarGenerationModal: React.FC<CalendarGenerationModalProps> = ({
  open,
  onClose,
  sessionId,
  initialConfig,
  onComplete,
  onError
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const [educationalPanelExpanded, setEducationalPanelExpanded] = useState(false);

  // Use polling hook for real backend data only
  const { 
    progress, 
    isPolling, 
    startPolling, 
    stopPolling,
    getStepStatus,
    getStepQualityScore,
    getStepErrors,
    getStepWarnings
  } = useCalendarGenerationPolling(sessionId);
  
  // Use only real progress data - no fallback to mock data
  const currentProgress = progress;

  useEffect(() => {
    if (open && sessionId) {
      // Start real polling when modal opens with session ID
      console.log('🎯 Modal opened, starting polling for session:', sessionId);
      startPolling();
    } else if (open && !sessionId) {
      // Modal opened but no session ID yet - show loading state
      console.log('🎯 Modal opened, waiting for session ID...');
    } else if (!open) {
      console.log('🔒 Modal closed, stopping polling');
      stopPolling();
    }
  }, [open, sessionId, startPolling, stopPolling]);

  useEffect(() => {
    console.log('📊 Progress updated:', currentProgress);
    if (currentProgress?.status === 'completed') {
      // Handle completion
      console.log('🎉 Calendar generation completed');
    } else if (currentProgress?.status === 'error') {
      console.log('❌ Calendar generation error:', currentProgress.errors);
      onError(currentProgress.errors[0]?.message || 'Unknown error');
    }
  }, [currentProgress, onError]);

  const getQualityColor = (score: number) => {
    if (score >= 0.9) return 'success';
    if (score >= 0.8) return 'warning';
    return 'error';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'error':
        return 'error';
      case 'initializing':
        return 'info';
      default:
        return 'primary';
    }
  };

  const getStepIcon = (stepNumber: number) => {
    switch (stepNumber) {
      case 1:
        return <SchoolIcon />;
      case 2:
        return <DataUsageIcon />;
      case 3:
        return <TrendingUpIcon />;
      case 4:
        return <ScheduleIcon />;
      case 5:
        return <ViewModuleIcon />;
      case 6:
        return <DevicesIcon />;
      default:
        return <ScheduleIcon />;
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xl"
      fullWidth
      PaperProps={{
        sx: dialogStyles.paper
      }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h5">
            Calendar Generation Progress
          </Typography>
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        {!currentProgress ? (
          // Loading state when no progress data is available
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <Box sx={loadingContainerStyles}>
              <Box sx={loadingContentStyles}>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                >
                  <CircularProgress size={60} />
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3, duration: 0.5 }}
                >
                  <Typography variant="h6" sx={{ mt: 2 }}>
                    {!sessionId ? 'Starting Calendar Generation...' : 'Initializing Calendar Generation...'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    {!sessionId ? 'Please wait while we prepare your session...' : 'Please wait while we initialize the process...'}
                  </Typography>
                </motion.div>
              </Box>
            </Box>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <Grid container spacing={2}>
              {/* Header Section with Enhanced Animations */}
              <Grid item xs={12}>
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                >
                  <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
                    <Grid container spacing={2} alignItems="center">
                      {/* Progress Bar with Animation */}
                      <Grid item xs={12}>
                        <Box display="flex" alignItems="center" gap={2}>
                          <Typography variant="body2" color="text.secondary">
                            Overall Progress
                          </Typography>
                                                     <Box sx={progressBarContainerStyles}>
                             <LinearProgress
                               variant="determinate"
                               value={currentProgress.overallProgress}
                               sx={progressBarStyles}
                             />
                             <motion.div
                               initial={{ scaleX: 0 }}
                               animate={{ scaleX: currentProgress.overallProgress / 100 }}
                               transition={{ duration: animationDurations.slow, ease: animationEasing.easeOut }}
                               style={progressOverlayStyles}
                             />
                           </Box>
                          <motion.div
                            key={currentProgress.overallProgress}
                            initial={{ scale: 1.2 }}
                            animate={{ scale: 1 }}
                            transition={{ duration: 0.3 }}
                          >
                            <Typography variant="body2" color="text.secondary">
                              {Math.round(currentProgress.overallProgress)}%
                            </Typography>
                          </motion.div>
                        </Box>
                      </Grid>
                      
                      {/* Step Indicators with Staggered Animation */}
                      <Grid item xs={12}>
                        <Box display="flex" alignItems="center" gap={1}>
                          {[1, 2, 3, 4, 5, 6].map((step, index) => (
                            <motion.div
                              key={step}
                              initial={{ opacity: 0, x: -20, scale: 0.8 }}
                              animate={{ opacity: 1, x: 0, scale: 1 }}
                              transition={{ 
                                delay: index * 0.2, 
                                duration: 0.5, 
                                ease: "easeOut" 
                              }}
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                            >
                                                             <Box
                                 display="flex"
                                 alignItems="center"
                                 gap={1}
                                 sx={getStepIndicatorStyles(currentProgress.currentStep, step)}
                               >
                                <motion.div
                                  animate={{ 
                                    rotate: currentProgress.currentStep === step ? [0, 10, -10, 0] : 0,
                                    scale: currentProgress.currentStep === step ? 1.1 : 1
                                  }}
                                  transition={{ duration: 0.5 }}
                                >
                                  {getStepIcon(step)}
                                </motion.div>
                                <Typography variant="body2">
                                  Step {step}
                                </Typography>
                                {currentProgress.qualityScores[`step${step}` as keyof QualityScores] > 0 && (
                                  <motion.div
                                    initial={{ scale: 0, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    transition={{ delay: 0.5, type: "spring", stiffness: 200 }}
                                  >
                                    <Chip
                                      label={`${Math.round(currentProgress.qualityScores[`step${step}` as keyof QualityScores] * 100)}%`}
                                      size="small"
                                      color={getQualityColor(currentProgress.qualityScores[`step${step}` as keyof QualityScores])}
                                    />
                                  </motion.div>
                                )}
                              </Box>
                            </motion.div>
                          ))}
                        </Box>
                      </Grid>
                      
                      {/* Quality Score and Status with Pulse Animation */}
                      <Grid item xs={6}>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography variant="body2" color="text.secondary">
                            Overall Quality:
                          </Typography>
                                                     <motion.div
                             animate={pulseAnimation}
                             transition={{ 
                               duration: 2, 
                               repeat: Infinity,
                               ease: animationEasing.easeInOut 
                             }}
                           >
                            <Chip
                              label={`${Math.round(currentProgress.qualityScores.overall * 100)}%`}
                              color={getQualityColor(currentProgress.qualityScores.overall)}
                              size="small"
                            />
                          </motion.div>
                        </Box>
                      </Grid>
                      
                      <Grid item xs={6}>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography variant="body2" color="text.secondary">
                            Status:
                          </Typography>
                          <motion.div
                            key={currentProgress.status}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.3 }}
                          >
                            <Chip
                              label={currentProgress.status}
                              color={getStatusColor(currentProgress.status)}
                              size="small"
                            />
                          </motion.div>
                        </Box>
                      </Grid>
                    </Grid>
                  </Paper>
                </motion.div>
              </Grid>
              
              {/* Main Content Area */}
              <Grid item xs={12}>
                <Box sx={{ width: '100%' }}>
                  {/* Tabs with Enhanced Animations */}
                  <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                    <Grid container spacing={1}>
                                             {[
                         { id: 0, label: 'Live Progress' },
                         { id: 1, label: 'Step Results' },
                         { id: 2, label: 'Step Tracker' },
                         { id: 3, label: 'Data Sources' },
                         { id: 4, label: 'Quality Gates' }
                       ].map((tab, index) => (
                        <Grid item key={tab.id}>
                          <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1, duration: 0.3 }}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                                                         <Button
                               variant={activeTab === tab.id ? 'contained' : 'outlined'}
                               size="small"
                               onClick={() => setActiveTab(tab.id)}
                               sx={tabButtonStyles}
                             >
                              {tab.label}
                            </Button>
                          </motion.div>
                        </Grid>
                      ))}
                    </Grid>
                  </Box>
                  
                  {/* Tab Content with Enhanced Transitions */}
                  <AnimatePresence mode="wait">
                                         {activeTab === 0 && (
                       <motion.div
                         key="live-progress"
                         {...fadeInLeft}
                         transition={{ duration: 0.4, ease: animationEasing.easeInOut }}
                       >
                        <LiveProgressPanel
                          progress={currentProgress}
                          isPolling={isPolling}
                        />
                      </motion.div>
                    )}
                    
                                         {activeTab === 1 && (
                       <motion.div
                         key="step-results"
                         {...fadeInLeft}
                         transition={{ duration: 0.4, ease: animationEasing.easeInOut }}
                       >
                        <StepResultsPanel
                          progress={currentProgress}
                          getStepStatus={getStepStatus}
                          getStepQualityScore={getStepQualityScore}
                          getStepErrors={getStepErrors}
                          getStepWarnings={getStepWarnings}
                        />
                      </motion.div>
                                         )}
                     
                     {activeTab === 2 && (
                       <motion.div
                         key="step-tracker"
                         {...fadeInLeft}
                         transition={{ duration: 0.4, ease: animationEasing.easeInOut }}
                       >
                         <StepProgressTracker
                           progress={currentProgress}
                           isPolling={isPolling}
                           getStepStatus={getStepStatus}
                           getStepQualityScore={getStepQualityScore}
                           getStepErrors={getStepErrors}
                           getStepWarnings={getStepWarnings}
                         />
                       </motion.div>
                     )}
                     
                     {activeTab === 3 && (
                       <motion.div
                         key="data-sources"
                         {...fadeInLeft}
                         transition={{ duration: 0.4, ease: animationEasing.easeInOut }}
                       >
                        <DataSourcePanel 
                          currentStep={currentProgress.currentStep}
                          stepResults={currentProgress.stepResults}
                        />
                      </motion.div>
                    )}
                     
                     {activeTab === 4 && (
                       <motion.div
                         key="quality-gates"
                         {...fadeInLeft}
                         transition={{ duration: 0.4, ease: animationEasing.easeInOut }}
                       >
                        <QualityGatesPanel
                          qualityScores={currentProgress.qualityScores}
                          stepResults={currentProgress.stepResults}
                          currentStep={currentProgress.currentStep}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Box>
              </Grid>
              
              {/* Educational Panel with Animation */}
              <Grid item xs={12}>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8, duration: 0.5 }}
                >
                  <EducationalPanel
                    content={currentProgress.educationalContent}
                    currentStep={currentProgress.currentStep}
                    isExpanded={educationalPanelExpanded}
                    onToggleExpanded={() => setEducationalPanelExpanded(!educationalPanelExpanded)}
                  />
                </motion.div>
              </Grid>
            </Grid>
          </motion.div>
        )}
      </DialogContent>
      
      <DialogActions>
        <Box display="flex" gap={1}>
          {currentProgress && currentProgress.status !== 'completed' && currentProgress.status !== 'error' && (
            <motion.div
              whileHover={hoverScale}
              whileTap={tapScale}
            >
              <Button
                variant="outlined"
                color="error"
                onClick={async () => {
                  try {
                     await fetch(`/api/content-planning/calendar-generation/cancel/${sessionId}`, {
                      method: 'DELETE',
                    });
                    onClose();
                  } catch (error) {
                    console.error('Error cancelling generation:', error);
                  }
                }}
              >
                Cancel Generation
              </Button>
            </motion.div>
          )}
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Button
              variant="outlined"
              onClick={onClose}
            >
              Close
            </Button>
          </motion.div>
          {currentProgress && currentProgress.status === 'completed' && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 20 }}
              whileHover={hoverScale}
              whileTap={tapScale}
            >
              <Button
                variant="contained"
                onClick={() => {
                  console.log('Calendar generation completed');
                  const step12Result = currentProgress.stepResults[12];
                  const step12Data = step12Result?.data || {};
                  onComplete({
                    calendar: {
                      id: sessionId,
                      title: step12Data?.title || 'Generated Calendar',
                      description: step12Data?.description || '',
                      startDate: step12Data?.start_date || '',
                      endDate: step12Data?.end_date || '',
                      content: step12Data?.daily_schedule?.map?.((item: any, i: number) => ({
                        id: item.id || `event_${i}`,
                        title: item.title || '',
                        description: item.description || '',
                        contentType: item.content_type || item.contentType || 'post',
                        platform: item.platform || '',
                        scheduledDate: item.scheduled_date || item.date || '',
                        theme: item.theme || '',
                        keywords: item.keywords || []
                      })) || [],
                      themes: currentProgress.stepResults[7]?.data?.themes?.map?.((t: any, i: number) => ({
                        id: t.id || `theme_${i}`,
                        name: t.name || '',
                        description: t.description || '',
                        weekNumber: t.week_number || i + 1,
                        contentTypes: t.content_types || []
                      })) || [],
                      platforms: step12Data?.platform_strategies?.map?.((p: any, i: number) => ({
                        id: p.id || `platform_${i}`,
                        name: p.name || p.platform || '',
                        contentCount: p.content_count || 0,
                        postingSchedule: p.schedule || []
                      })) || []
                    },
                    qualityScores: currentProgress.qualityScores,
                    insights: step12Data?.insights || {},
                    recommendations: step12Data?.recommendations || {},
                    exportData: {
                      calendarJson: JSON.stringify(step12Data),
                      insightsCsv: '',
                      recommendationsPdf: '',
                      qualityReport: ''
                    }
                  });
                }}
              >
                View Calendar
              </Button>
            </motion.div>
          )}
        </Box>
      </DialogActions>
    </Dialog>
  );
};

// Components imported from panels

export default CalendarGenerationModal;
