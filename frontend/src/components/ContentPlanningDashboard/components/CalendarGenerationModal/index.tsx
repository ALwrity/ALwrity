import React, { useState, useEffect, useCallback } from 'react';
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
  Alert,
  CircularProgress
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import RefreshIcon from '@mui/icons-material/Refresh';
import ScheduleIcon from '@mui/icons-material/Schedule';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import SchoolIcon from '@mui/icons-material/School';
import DataUsageIcon from '@mui/icons-material/DataUsage';
import { motion, AnimatePresence } from 'framer-motion';

// Import existing components for reuse
import DataSourceTransparency from '../DataSourceTransparency';
import ProgressIndicator from '../ProgressIndicator';

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

interface QualityScores {
  overall: number;
  step1: number;
  step2: number;
  step3: number;
  step4: number;
  step5: number;
  step6: number;
  step7: number;
  step8: number;
  step9: number;
  step10: number;
  step11: number;
  step12: number;
}

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

// Polling hook for calendar generation progress
const useCalendarGenerationPolling = (sessionId: string) => {
  const [progress, setProgress] = useState<CalendarGenerationProgress | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const startPolling = useCallback(async () => {
    setIsPolling(true);
    setError(null);
    
    const poll = async () => {
      try {
        const response = await fetch(`/api/content-planning/calendar-generation/progress/${sessionId}`);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        setProgress(data);
        
        if (data.status === 'completed' || data.status === 'error') {
          setIsPolling(false);
          if (data.status === 'error') {
            setError(data.error || 'Unknown error occurred');
          }
          return;
        }
        
        // Continue polling every 2 seconds
        setTimeout(poll, 2000);
      } catch (error) {
        console.error('Calendar generation polling error:', error);
        setError(error instanceof Error ? error.message : 'Polling failed');
        // Retry after 5 seconds
        setTimeout(poll, 5000);
      }
    };
    
    poll();
  }, [sessionId]);
  
  const stopPolling = useCallback(() => {
    setIsPolling(false);
  }, []);
  
  return { progress, isPolling, error, startPolling, stopPolling };
};

// Mock progress data for development (remove when backend is ready)
interface CalendarGenerationProgress {
  status: 'initializing' | 'step1' | 'step2' | 'step3' | 'completed' | 'error';
  currentStep: number;
  stepProgress: number;
  overallProgress: number;
  stepResults: Record<number, any>;
  qualityScores: QualityScores;
  transparencyMessages: string[];
  educationalContent: any[];
  errors: any[];
  warnings: any[];
}

// Mock progress data for Phase 1 testing
const mockProgressData: CalendarGenerationProgress = {
  status: 'step1',
  currentStep: 1,
  stepProgress: 75,
  overallProgress: 25,
  stepResults: {
    1: {
      stepNumber: 1,
      stepName: 'Content Strategy Analysis',
      results: {
        contentPillars: ['Educational', 'Thought Leadership', 'Product Updates', 'Industry Insights'],
        targetAudience: ['Marketing Professionals', 'Business Owners', 'Content Creators'],
        businessGoals: ['Increase Brand Awareness', 'Generate Leads', 'Establish Thought Leadership'],
        strategyAlignment: 0.94
      },
      qualityScore: 0.94,
      executionTime: '2.3s',
      dataSourcesUsed: ['Content Strategy', 'Onboarding Data', 'AI Analysis'],
      insights: [
        'Content strategy shows strong alignment with business goals',
        '4 content pillars identified with clear focus areas',
        '3 distinct audience segments with specific preferences'
      ],
      recommendations: [
        'Focus on educational content (40%) for lead generation',
        'Increase thought leadership content (30%) for brand awareness',
        'Optimize content mix for platform-specific performance'
      ]
    }
  },
  qualityScores: {
    overall: 0.94,
    step1: 0.94,
    step2: 0.0,
    step3: 0.0,
    step4: 0.0,
    step5: 0.0,
    step6: 0.0,
    step7: 0.0,
    step8: 0.0,
    step9: 0.0,
    step10: 0.0,
    step11: 0.0,
    step12: 0.0
  },
  transparencyMessages: [
    'Starting content strategy analysis...',
    'Analyzing your content pillars and target audience...',
    'Generating strategic insights with AI analysis...',
    'Content strategy analysis completed with 94% quality score'
  ],
  educationalContent: [
    {
      title: 'Content Strategy Analysis',
      description: 'Understanding how your content strategy influences calendar generation',
      level: 'intermediate',
      category: 'strategy',
      tips: [
        'Your content pillars define the main themes for your calendar',
        'Target audience data helps determine content timing and platforms',
        'Business goals influence content mix and promotional frequency'
      ],
      examples: [
        'Educational content: 40% of calendar based on your strategy',
        'Thought leadership: 30% aligned with your expertise areas',
        'Engagement content: 20% to build audience relationships'
      ]
    }
  ],
  errors: [],
  warnings: []
};

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
  const [expandedSections, setExpandedSections] = useState({
    dataSources: true,
    progress: true,
    educational: false,
    messages: true,
    stepResults: true
  });

  // Use polling hook (replace with real implementation when backend is ready)
  const { progress, isPolling, error, startPolling, stopPolling } = useCalendarGenerationPolling(sessionId);
  
  // For development, use mock data
  const currentProgress = progress || mockProgressData;

  useEffect(() => {
    if (open && sessionId) {
      // For development, simulate polling
      // startPolling();
    } else if (!open) {
      stopPolling();
    }
  }, [open, sessionId, startPolling, stopPolling]);

  useEffect(() => {
    if (currentProgress.status === 'completed') {
      // Handle completion
      console.log('Calendar generation completed');
    } else if (currentProgress.status === 'error') {
      onError(currentProgress.errors[0]?.message || 'Unknown error');
    }
  }, [currentProgress.status, currentProgress.errors, onError]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

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
        sx: {
          height: '90vh',
          maxHeight: '90vh'
        }
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
        <Grid container spacing={2}>
          {/* Header Section */}
          <Grid item xs={12}>
            <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
              <Grid container spacing={2} alignItems="center">
                {/* Progress Bar */}
                <Grid item xs={12}>
                  <Box display="flex" alignItems="center" gap={2}>
                    <Typography variant="body2" color="text.secondary">
                      Overall Progress
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={currentProgress.overallProgress}
                      sx={{ flexGrow: 1 }}
                    />
                    <Typography variant="body2" color="text.secondary">
                      {Math.round(currentProgress.overallProgress)}%
                    </Typography>
                  </Box>
                </Grid>
                
                {/* Step Indicators */}
                <Grid item xs={12}>
                  <Box display="flex" alignItems="center" gap={1}>
                    {[1, 2, 3].map((step) => (
                      <Box
                        key={step}
                        display="flex"
                        alignItems="center"
                        gap={1}
                        sx={{
                          p: 1,
                          borderRadius: 1,
                          backgroundColor: currentProgress.currentStep === step ? 'primary.light' : 'grey.100',
                          color: currentProgress.currentStep === step ? 'primary.contrastText' : 'text.secondary'
                        }}
                      >
                        {getStepIcon(step)}
                        <Typography variant="body2">
                          Step {step}
                        </Typography>
                        {currentProgress.qualityScores[`step${step}` as keyof QualityScores] > 0 && (
                          <Chip
                            label={`${Math.round(currentProgress.qualityScores[`step${step}` as keyof QualityScores] * 100)}%`}
                            size="small"
                            color={getQualityColor(currentProgress.qualityScores[`step${step}` as keyof QualityScores])}
                          />
                        )}
                      </Box>
                    ))}
                  </Box>
                </Grid>
                
                {/* Quality Score and Status */}
                <Grid item xs={6}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Typography variant="body2" color="text.secondary">
                      Overall Quality:
                    </Typography>
                    <Chip
                      label={`${Math.round(currentProgress.qualityScores.overall * 100)}%`}
                      color={getQualityColor(currentProgress.qualityScores.overall)}
                      size="small"
                    />
                  </Box>
                </Grid>
                
                <Grid item xs={6}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Typography variant="body2" color="text.secondary">
                      Status:
                    </Typography>
                    <Chip
                      label={currentProgress.status}
                      color={getStatusColor(currentProgress.status)}
                      size="small"
                    />
                  </Box>
                </Grid>
              </Grid>
            </Paper>
          </Grid>
          
          {/* Main Content Area */}
          <Grid item xs={12}>
            <Box sx={{ width: '100%' }}>
              {/* Tabs */}
              <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                <Grid container spacing={1}>
                  <Grid item>
                    <Button
                      variant={activeTab === 0 ? 'contained' : 'outlined'}
                      size="small"
                      onClick={() => setActiveTab(0)}
                    >
                      Live Progress
                    </Button>
                  </Grid>
                  <Grid item>
                    <Button
                      variant={activeTab === 1 ? 'contained' : 'outlined'}
                      size="small"
                      onClick={() => setActiveTab(1)}
                    >
                      Step Results
                    </Button>
                  </Grid>
                  <Grid item>
                    <Button
                      variant={activeTab === 2 ? 'contained' : 'outlined'}
                      size="small"
                      onClick={() => setActiveTab(2)}
                    >
                      Data Sources
                    </Button>
                  </Grid>
                  <Grid item>
                    <Button
                      variant={activeTab === 3 ? 'contained' : 'outlined'}
                      size="small"
                      onClick={() => setActiveTab(3)}
                    >
                      Quality Gates
                    </Button>
                  </Grid>
                </Grid>
              </Box>
              
              {/* Tab Content */}
              <AnimatePresence mode="wait">
                {activeTab === 0 && (
                  <motion.div
                    key="live-progress"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
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
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <StepResultsPanel
                      stepResults={currentProgress.stepResults}
                      qualityScores={currentProgress.qualityScores}
                    />
                  </motion.div>
                )}
                
                {activeTab === 2 && (
                  <motion.div
                    key="data-sources"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <DataSourcePanel />
                  </motion.div>
                )}
                
                {activeTab === 3 && (
                  <motion.div
                    key="quality-gates"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <QualityGatesPanel
                      qualityScores={currentProgress.qualityScores}
                      stepResults={currentProgress.stepResults}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </Box>
          </Grid>
          
          {/* Educational Panel */}
          <Grid item xs={12}>
            <EducationalPanel
              content={currentProgress.educationalContent}
              currentStep={currentProgress.currentStep}
              isExpanded={educationalPanelExpanded}
              onToggleExpanded={() => setEducationalPanelExpanded(!educationalPanelExpanded)}
            />
          </Grid>
        </Grid>
      </DialogContent>
      
      <DialogActions>
        <Box display="flex" gap={1}>
          <Button
            variant="outlined"
            onClick={onClose}
          >
            Close
          </Button>
          {currentProgress.status === 'completed' && (
            <Button
              variant="contained"
              onClick={() => {
                // Handle completion
                console.log('Calendar generation completed');
              }}
            >
              View Calendar
            </Button>
          )}
        </Box>
      </DialogActions>
    </Dialog>
  );
};

// Placeholder components (to be implemented)
const LiveProgressPanel: React.FC<{ progress: CalendarGenerationProgress; isPolling: boolean }> = ({ progress, isPolling }) => (
  <Paper elevation={1} sx={{ p: 2 }}>
    <Typography variant="h6" gutterBottom>
      Live Progress
    </Typography>
    <Box display="flex" alignItems="center" gap={2} mb={2}>
      {isPolling && <CircularProgress size={20} />}
      <Typography variant="body2">
        Current Step: {progress.currentStep} - {progress.status}
      </Typography>
    </Box>
    <Typography variant="body2" color="text.secondary">
      Step Progress: {progress.stepProgress}%
    </Typography>
  </Paper>
);

const StepResultsPanel: React.FC<{ stepResults: Record<number, any>; qualityScores: QualityScores }> = ({ stepResults, qualityScores }) => (
  <Paper elevation={1} sx={{ p: 2 }}>
    <Typography variant="h6" gutterBottom>
      Step Results
    </Typography>
    {Object.entries(stepResults).map(([stepNumber, results]) => (
      <Box key={stepNumber} mb={2}>
        <Typography variant="subtitle1">
          Step {stepNumber}: {results.stepName}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Quality Score: {Math.round(results.qualityScore * 100)}%
        </Typography>
      </Box>
    ))}
  </Paper>
);

const DataSourcePanel: React.FC = () => (
  <Paper elevation={1} sx={{ p: 2 }}>
    <Typography variant="h6" gutterBottom>
      Data Sources
    </Typography>
    <Typography variant="body2" color="text.secondary">
      Data source transparency information will be displayed here.
    </Typography>
  </Paper>
);

const QualityGatesPanel: React.FC<{ qualityScores: QualityScores; stepResults: Record<number, any> }> = ({ qualityScores, stepResults }) => (
  <Paper elevation={1} sx={{ p: 2 }}>
    <Typography variant="h6" gutterBottom>
      Quality Gates
    </Typography>
    <Typography variant="body2" color="text.secondary">
      Quality gate validation results will be displayed here.
    </Typography>
  </Paper>
);

const EducationalPanel: React.FC<{
  content: any[];
  currentStep: number;
  isExpanded: boolean;
  onToggleExpanded: () => void;
}> = ({ content, currentStep, isExpanded, onToggleExpanded }) => (
  <Paper elevation={1} sx={{ p: 2 }}>
    <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
      <Typography variant="h6">
        Educational Content
      </Typography>
      <IconButton onClick={onToggleExpanded} size="small">
        {isExpanded ? <CheckCircleIcon /> : <SchoolIcon />}
      </IconButton>
    </Box>
    {isExpanded && content.length > 0 && (
      <Box>
        <Typography variant="subtitle1" gutterBottom>
          {content[0].title}
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          {content[0].description}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Tips: {content[0].tips.join(', ')}
        </Typography>
      </Box>
    )}
  </Paper>
);

export default CalendarGenerationModal;
