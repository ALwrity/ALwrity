import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  LinearProgress,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Alert,
  IconButton,
  Collapse,
  Tooltip,
  Paper,
  CircularProgress,
  Tabs,
  Tab
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import DataUsageIcon from '@mui/icons-material/DataUsage';
import SchoolIcon from '@mui/icons-material/School';
import TimelineIcon from '@mui/icons-material/Timeline';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import InfoIcon from '@mui/icons-material/Info';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import RefreshIcon from '@mui/icons-material/Refresh';
import ScheduleIcon from '@mui/icons-material/Schedule';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import CloseIcon from '@mui/icons-material/Close';
import AssessmentIcon from '@mui/icons-material/Assessment';
import PsychologyIcon from '@mui/icons-material/Psychology';
import { motion, AnimatePresence } from 'framer-motion';

// Import existing transparency components
import DataSourceTransparency from './DataSourceTransparency';
import EducationalModal from './ContentStrategyBuilder/components/EducationalModal';

interface StrategyAutofillTransparencyModalProps {
  open: boolean;
  onClose: () => void;
  autoPopulatedFields: Record<string, any>;
  dataSources: Record<string, string>;
  inputDataPoints: Record<string, any>;
  isGenerating: boolean;
  generationProgress: number;
  currentPhase: string;
  educationalContent: any;
  transparencyMessages: string[];
  error: string | null;
}

const StrategyAutofillTransparencyModal: React.FC<StrategyAutofillTransparencyModalProps> = ({
  open,
  onClose,
  autoPopulatedFields,
  dataSources,
  inputDataPoints,
  isGenerating,
  generationProgress,
  currentPhase,
  educationalContent,
  transparencyMessages,
  error
}) => {
  const [expandedSections, setExpandedSections] = useState({
    dataSources: true, // Show data sources by default
    progress: true,
    educational: false,
    messages: true,
    fieldMapping: true // New section for field-to-source mapping
  });

  const [activeTab, setActiveTab] = useState(0);

  // Ref for auto-scrolling messages
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [lastMessageCount, setLastMessageCount] = useState(0);
  const [showNewMessageIndicator, setShowNewMessageIndicator] = useState(false);

  // Debug logging for props - removed for cleaner console
  useEffect(() => {
    // Props monitoring removed for cleaner console
  }, [open, autoPopulatedFields, dataSources, inputDataPoints, isGenerating, generationProgress, currentPhase, transparencyMessages, error]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current && transparencyMessages.length > 0) {
      // Check if new message arrived
      if (transparencyMessages.length > lastMessageCount) {
        setLastMessageCount(transparencyMessages.length);
        
        // Show new message indicator
        setShowNewMessageIndicator(true);
        setTimeout(() => setShowNewMessageIndicator(false), 2000);
        
        // Immediate scroll for better responsiveness
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }
    }
  }, [transparencyMessages, lastMessageCount]);

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const getPhaseIcon = (phase: string) => {
    const icons = {
      'autofill_initialization': <InfoIcon />,
      'autofill_data_collection': <DataUsageIcon />,
      'autofill_data_quality': <CheckCircleIcon />,
      'autofill_context_analysis': <SchoolIcon />,
      'autofill_strategy_generation': <AutoAwesomeIcon />,
      'autofill_field_generation': <TimelineIcon />,
      'autofill_quality_validation': <CheckCircleIcon />,
      'autofill_alignment_check': <TrendingUpIcon />,
      'autofill_final_review': <ScheduleIcon />,
      'autofill_complete': <CheckCircleIcon />
    };
    return icons[phase as keyof typeof icons] || <InfoIcon />;
  };

  const getPhaseColor = (phase: string) => {
    const colors = {
      'autofill_initialization': 'info',
      'autofill_data_collection': 'primary',
      'autofill_data_quality': 'success',
      'autofill_context_analysis': 'primary',
      'autofill_strategy_generation': 'secondary',
      'autofill_field_generation': 'primary',
      'autofill_quality_validation': 'success',
      'autofill_alignment_check': 'warning',
      'autofill_final_review': 'info',
      'autofill_complete': 'success'
    };
    return colors[phase as keyof typeof colors] || 'info';
  };

  const getPhaseLabel = (phase: string) => {
    const labels = {
      'autofill_initialization': 'Initializing Strategy Inputs Generation',
      'autofill_data_collection': 'Collecting and Analyzing Data Sources',
      'autofill_data_quality': 'Assessing Data Quality and Completeness',
      'autofill_context_analysis': 'Analyzing Business Context and Strategic Framework',
      'autofill_strategy_generation': 'Generating Strategic Insights and Recommendations',
      'autofill_field_generation': 'Generating Individual Strategy Input Fields',
      'autofill_quality_validation': 'Validating Generated Strategy Inputs',
      'autofill_alignment_check': 'Checking Strategy Alignment and Consistency',
      'autofill_final_review': 'Performing Final Review and Optimization',
      'autofill_complete': 'Strategy Inputs Generation Completed Successfully'
    };
    return labels[phase as keyof typeof labels] || phase;
  };

  // Enhanced field mapping with confidence scores and data quality
  const getFieldMappingData = () => {
    const fieldCategories = {
      'Business Context': [
        'business_objectives', 'target_metrics', 'content_budget', 'team_size',
        'implementation_timeline', 'market_share', 'competitive_position', 'performance_metrics'
      ],
      'Audience Intelligence': [
        'content_preferences', 'consumption_patterns', 'audience_pain_points',
        'buying_journey', 'seasonal_trends', 'engagement_metrics'
      ],
      'Competitive Intelligence': [
        'top_competitors', 'competitor_content_strategies', 'market_gaps',
        'industry_trends', 'emerging_trends'
      ],
      'Content Strategy': [
        'preferred_formats', 'content_mix', 'content_frequency', 'optimal_timing',
        'quality_metrics', 'editorial_guidelines', 'brand_voice'
      ],
      'Performance & Analytics': [
        'traffic_sources', 'conversion_rates', 'content_roi_targets', 'ab_testing_capabilities'
      ]
    };

    return Object.entries(fieldCategories).map(([category, fields]) => ({
      category,
      fields: fields.map(fieldId => {
        const dataSource = dataSources[fieldId] || 'unknown';
        const inputData = inputDataPoints[fieldId];
        const fieldValue = autoPopulatedFields[fieldId];
        
        // Calculate confidence and quality scores based on data source and content
        const confidence = calculateFieldConfidence(fieldId, dataSource, inputData);
        const dataQuality = calculateFieldDataQuality(fieldId, dataSource, inputData);
        
        return {
          fieldId,
          label: fieldId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          source: dataSource,
          value: fieldValue,
          confidence,
          dataQuality,
          inputData
        };
      })
    }));
  };

  // Calculate field confidence score based on data source and content
  const calculateFieldConfidence = (fieldId: string, dataSource: string, inputData: any): number => {
    // Base confidence scores by data source
    const sourceConfidence: Record<string, number> = {
      'website_analysis': 0.85,
      'research_preferences': 0.92,
      'api_keys': 0.78,
      'onboarding_session': 0.88,
      'unknown': 0.70
    };
    
    const baseConfidence = sourceConfidence[dataSource] || 0.70;
    
    // Adjust based on data completeness
    const completenessScore = calculateDataCompleteness(inputData);
    
    // Adjust based on data freshness
    const freshnessScore = calculateDataFreshness(dataSource);
    
    // Adjust based on field-specific factors
    const fieldFactor = getFieldSpecificFactor(fieldId);
    
    // Calculate final confidence score
    const finalConfidence = baseConfidence * completenessScore * freshnessScore * fieldFactor;
    
    // Ensure confidence is between 0.5 and 1.0
    return Math.max(0.5, Math.min(1.0, finalConfidence));
  };

  // Calculate field data quality score
  const calculateFieldDataQuality = (fieldId: string, dataSource: string, inputData: any): number => {
    // Base quality scores by data source
    const sourceQuality: Record<string, number> = {
      'website_analysis': 0.88,
      'research_preferences': 0.94,
      'api_keys': 0.82,
      'onboarding_session': 0.90,
      'unknown': 0.75
    };
    
    const baseQuality = sourceQuality[dataSource] || 0.75;
    
    // Adjust based on data structure and format
    const structureScore = calculateDataStructureQuality(inputData);
    
    // Adjust based on data consistency
    const consistencyScore = calculateDataConsistency(fieldId, inputData);
    
    // Adjust based on field-specific quality factors
    const fieldQualityFactor = getFieldQualityFactor(fieldId);
    
    // Calculate final quality score
    const finalQuality = baseQuality * structureScore * consistencyScore * fieldQualityFactor;
    
    // Ensure quality is between 0.6 and 1.0
    return Math.max(0.6, Math.min(1.0, finalQuality));
  };

  // Calculate data completeness score
  const calculateDataCompleteness = (inputData: any): number => {
    if (inputData === null || inputData === undefined) {
      return 0.3;
    }
    
    if (typeof inputData === 'string') {
      return inputData.trim().length > 10 ? 0.8 : 0.5;
    }
    
    if (Array.isArray(inputData)) {
      return inputData.length > 0 ? 0.9 : 0.4;
    }
    
    if (typeof inputData === 'object') {
      if (Object.keys(inputData).length === 0) {
        return 0.4;
      }
      // Check if values are not empty
      const nonEmptyValues = Object.values(inputData).filter(v => v && String(v).trim()).length;
      return 0.7 + (0.2 * (nonEmptyValues / Object.keys(inputData).length));
    }
    
    return 0.8;
  };

  // Calculate data freshness score
  const calculateDataFreshness = (dataSource: string): number => {
    const freshnessScores: Record<string, number> = {
      'website_analysis': 0.95,  // Usually recent
      'research_preferences': 0.90,  // User-provided, recent
      'api_keys': 0.85,  // Configuration data
      'onboarding_session': 0.92,  // Recent user input
      'unknown': 0.80
    };
    return freshnessScores[dataSource] || 0.80;
  };

  // Calculate data structure quality score
  const calculateDataStructureQuality = (inputData: any): number => {
    if (inputData === null || inputData === undefined) {
      return 0.5;
    }
    
    if (typeof inputData === 'string') {
      return inputData.trim().length > 0 ? 0.9 : 0.6;
    }
    
    if (Array.isArray(inputData)) {
      return inputData.length > 0 ? 0.95 : 0.7;
    }
    
    if (typeof inputData === 'object') {
      return Object.keys(inputData).length > 0 ? 0.92 : 0.6;
    }
    
    return 0.8;
  };

  // Calculate data consistency score
  const calculateDataConsistency = (fieldId: string, inputData: any): number => {
    if (inputData === null || inputData === undefined) {
      return 0.6;
    }
    
    // Field-specific consistency factors
    const consistencyFactors: Record<string, number> = {
      'business_objectives': 0.95,
      'target_metrics': 0.92,
      'content_budget': 0.88,
      'team_size': 0.90,
      'implementation_timeline': 0.85,
      'market_share': 0.87,
      'competitive_position': 0.89,
      'performance_metrics': 0.91,
      'content_preferences': 0.93,
      'consumption_patterns': 0.90,
      'audience_pain_points': 0.88,
      'buying_journey': 0.89,
      'seasonal_trends': 0.86,
      'engagement_metrics': 0.92,
      'top_competitors': 0.90,
      'competitor_content_strategies': 0.87,
      'market_gaps': 0.85,
      'industry_trends': 0.88,
      'emerging_trends': 0.84,
      'preferred_formats': 0.93,
      'content_mix': 0.89,
      'content_frequency': 0.91,
      'optimal_timing': 0.88,
      'quality_metrics': 0.90,
      'editorial_guidelines': 0.87,
      'brand_voice': 0.89,
      'traffic_sources': 0.92,
      'conversion_rates': 0.88,
      'content_roi_targets': 0.86,
      'ab_testing_capabilities': 0.90
    };
    
    return consistencyFactors[fieldId] || 0.85;
  };

  // Get field-specific confidence factor
  const getFieldSpecificFactor = (fieldId: string): number => {
    const fieldFactors: Record<string, number> = {
      'business_objectives': 1.0,  // High confidence
      'target_metrics': 0.95,
      'content_budget': 0.90,
      'team_size': 0.92,
      'implementation_timeline': 0.88,
      'market_share': 0.85,
      'competitive_position': 0.87,
      'performance_metrics': 0.93,
      'content_preferences': 0.96,  // User-provided, high confidence
      'consumption_patterns': 0.89,
      'audience_pain_points': 0.86,
      'buying_journey': 0.88,
      'seasonal_trends': 0.84,
      'engagement_metrics': 0.91,
      'top_competitors': 0.89,
      'competitor_content_strategies': 0.85,
      'market_gaps': 0.83,
      'industry_trends': 0.87,
      'emerging_trends': 0.82,
      'preferred_formats': 0.94,
      'content_mix': 0.88,
      'content_frequency': 0.90,
      'optimal_timing': 0.86,
      'quality_metrics': 0.89,
      'editorial_guidelines': 0.85,
      'brand_voice': 0.87,
      'traffic_sources': 0.91,
      'conversion_rates': 0.88,
      'content_roi_targets': 0.85,
      'ab_testing_capabilities': 0.89
    };
    
    return fieldFactors[fieldId] || 0.85;
  };

  // Get field-specific quality factor
  const getFieldQualityFactor = (fieldId: string): number => {
    const qualityFactors: Record<string, number> = {
      'business_objectives': 0.95,
      'target_metrics': 0.93,
      'content_budget': 0.90,
      'team_size': 0.92,
      'implementation_timeline': 0.88,
      'market_share': 0.86,
      'competitive_position': 0.89,
      'performance_metrics': 0.94,
      'content_preferences': 0.96,
      'consumption_patterns': 0.91,
      'audience_pain_points': 0.87,
      'buying_journey': 0.89,
      'seasonal_trends': 0.85,
      'engagement_metrics': 0.93,
      'top_competitors': 0.90,
      'competitor_content_strategies': 0.86,
      'market_gaps': 0.84,
      'industry_trends': 0.88,
      'emerging_trends': 0.83,
      'preferred_formats': 0.95,
      'content_mix': 0.89,
      'content_frequency': 0.91,
      'optimal_timing': 0.87,
      'quality_metrics': 0.92,
      'editorial_guidelines': 0.86,
      'brand_voice': 0.88,
      'traffic_sources': 0.93,
      'conversion_rates': 0.89,
      'content_roi_targets': 0.86,
      'ab_testing_capabilities': 0.90
    };
    
    return qualityFactors[fieldId] || 0.87;
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'success';
    if (confidence >= 0.7) return 'warning';
    return 'error';
  };

  const getDataQualityColor = (quality: number) => {
    if (quality >= 0.9) return 'success';
    if (quality >= 0.7) return 'warning';
    return 'error';
  };

  const getDataSourceIcon = (source: string) => {
    const icons = {
      website_analysis: '🌐',
      research_preferences: '🔍',
      api_keys: '🔑',
      onboarding_session: '📋'
    };
    return icons[source as keyof typeof icons] || '📊';
  };

  const getDataSourceLabel = (source: string) => {
    const labels = {
      website_analysis: 'Website Analysis',
      research_preferences: 'Research Preferences',
      api_keys: 'API Configuration',
      onboarding_session: 'Onboarding Session'
    };
    return labels[source as keyof typeof labels] || source;
  };

  const fieldMappingData = getFieldMappingData();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xl"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 4,
          background: 'linear-gradient(135deg, #ffffff 0%, #f8f9ff 100%)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15)',
          border: '1px solid rgba(102, 126, 234, 0.1)',
          overflow: 'hidden',
          maxHeight: '95vh'
        }
      }}
    >
      <DialogTitle sx={{ 
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(45deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 100%)',
          pointerEvents: 'none'
        }
      }}>
        <Box display="flex" alignItems="center" justifyContent="space-between" sx={{ position: 'relative', zIndex: 1 }}>
          <Box display="flex" alignItems="center" gap={2}>
            <Box sx={{ 
              p: 1, 
              borderRadius: 2, 
              background: 'rgba(255, 255, 255, 0.2)',
              backdropFilter: 'blur(10px)',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
            }}>
              <AutoAwesomeIcon sx={{ color: 'white', fontSize: 24 }} />
            </Box>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
                Strategy Inputs Transparency
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9, fontWeight: 500 }}>
                Real-time visibility into AI-powered strategy input generation
              </Typography>
            </Box>
          </Box>
          <IconButton
            onClick={onClose}
            sx={{ 
              color: 'white',
              '&:hover': { 
                backgroundColor: 'rgba(255, 255, 255, 0.1)' 
              }
            }}
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      
      <DialogContent sx={{ p: 0, overflowY: 'hidden' }}>
        {/* Tabs for different sections */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
          <Tabs 
            value={activeTab} 
            onChange={(_, newValue) => setActiveTab(newValue)}
            sx={{ px: 3 }}
          >
            <Tab 
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TimelineIcon fontSize="small" />
                  <span>Progress & Messages</span>
                </Box>
              } 
            />
            <Tab 
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <DataUsageIcon fontSize="small" />
                  <span>Data Sources</span>
                </Box>
              } 
            />
            <Tab 
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AssessmentIcon fontSize="small" />
                  <span>Field Mapping</span>
                </Box>
              } 
            />
          </Tabs>
        </Box>

        {/* Tab Content */}
        <Box sx={{ p: 4, height: '70vh', overflowY: 'auto' }}>
          {/* Tab 1: Progress & Messages */}
          {activeTab === 0 && (
            <Grid container spacing={3}>
              {/* Error Alert */}
              {error && (
                <Grid item xs={12}>
                  <Alert severity="error" sx={{ mb: 2 }}>
                    <Typography variant="subtitle2">Generation Error</Typography>
                    <Typography variant="body2">{error}</Typography>
                  </Alert>
                </Grid>
              )}

              {/* Main Content Area - Left Side with Circular Progress */}
              <Grid item xs={12} md={4}>
                <Card variant="outlined" sx={{ 
                  height: '100%',
                  background: 'linear-gradient(135deg, #f8f9ff 0%, #eef3fb 100%)',
                  border: '2px solid rgba(102, 126, 234, 0.2)'
                }}>
                  <CardContent sx={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    height: '100%',
                    textAlign: 'center'
                  }}>
                    {/* Circular Progress Bar */}
                    <Box sx={{ position: 'relative', mb: 3 }}>
                      <CircularProgress
                        variant="determinate"
                        value={generationProgress}
                        size={120}
                        thickness={4}
                        sx={{
                          color: 'rgba(102, 126, 234, 0.2)',
                          '& .MuiCircularProgress-circle': {
                            strokeLinecap: 'round',
                            stroke: 'url(#gradient)'
                          }
                        }}
                      />
                      <Box sx={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        textAlign: 'center'
                      }}>
                        <Typography variant="h4" sx={{ fontWeight: 700, color: '#667eea' }}>
                          {Math.round(generationProgress)}%
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Complete
                        </Typography>
                      </Box>
                      {/* SVG Gradient for circular progress */}
                      <svg width="0" height="0">
                        <defs>
                          <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#667eea" />
                            <stop offset="100%" stopColor="#764ba2" />
                          </linearGradient>
                        </defs>
                      </svg>
                    </Box>

                    {/* Current Phase */}
                    {currentPhase && (
                      <Box sx={{ mb: 2, width: '100%' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 1 }}>
                          {getPhaseIcon(currentPhase)}
                          <Typography variant="subtitle2" color="primary" sx={{ fontWeight: 600 }}>
                            Current Phase
                          </Typography>
                        </Box>
                        <Chip
                          label={getPhaseLabel(currentPhase)}
                          color={getPhaseColor(currentPhase) as any}
                          variant="outlined"
                          sx={{ fontWeight: 500, maxWidth: '100%' }}
                        />
                      </Box>
                    )}

                    {/* Generation Status */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      {isGenerating ? (
                        <>
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                          >
                            <RefreshIcon color="primary" fontSize="small" />
                          </motion.div>
                          <Typography variant="body2" color="primary" sx={{ fontWeight: 500 }}>
                            AI is generating...
                          </Typography>
                        </>
                      ) : (
                        <>
                          <CheckCircleIcon color="success" fontSize="small" />
                          <Typography variant="body2" color="success.main" sx={{ fontWeight: 500 }}>
                            Generation completed
                          </Typography>
                        </>
                      )}
                    </Box>

                    {/* Success Indicator when Complete */}
                    {!isGenerating && generationProgress >= 100 && (
                      <Box sx={{ 
                        p: 2, 
                        bgcolor: 'success.light', 
                        borderRadius: 2, 
                        mb: 2,
                        border: '1px solid',
                        borderColor: 'success.main'
                      }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <CheckCircleIcon color="success" />
                          <Typography variant="subtitle2" color="success.dark" sx={{ fontWeight: 600 }}>
                            Strategy Inputs Generated Successfully!
                          </Typography>
                        </Box>
                        <Typography variant="body2" color="success.dark">
                          All fields have been populated with AI-generated values. You can now review and modify them as needed.
                        </Typography>
                      </Box>
                    )}

                    {/* Steps Counter */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip
                        label={`${transparencyMessages.length} steps completed`}
                        color="primary"
                        size="small"
                        sx={{ fontWeight: 600 }}
                      />
                      {isGenerating && (
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        >
                          <RefreshIcon color="primary" />
                        </motion.div>
                      )}
                      {showNewMessageIndicator && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          exit={{ scale: 0 }}
                        >
                          <Chip
                            label="New Step!"
                            color="success"
                            size="small"
                            sx={{ fontWeight: 600, animation: 'pulse 1s infinite' }}
                          />
                        </motion.div>
                      )}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              {/* Real-Time Messages - Right Side */}
              <Grid item xs={12} md={8}>
                <Card variant="outlined" sx={{ 
                  height: '100%',
                  background: 'linear-gradient(135deg, #ffffff 0%, #f8f9ff 100%)',
                  border: '2px solid rgba(102, 126, 234, 0.2)'
                }}>
                  <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                    {/* Header */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                      <Box sx={{ 
                        p: 1, 
                        borderRadius: 2, 
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: 'white'
                      }}>
                        <AutoAwesomeIcon />
                      </Box>
                      <Box>
                        <Typography variant="h6" sx={{ fontWeight: 600, color: '#667eea' }}>
                          Real-Time Generation Progress
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Watch AI generate your strategy inputs step by step
                        </Typography>
                      </Box>
                    </Box>

                    {/* Messages List */}
                    <Box sx={{ flex: 1, overflowY: 'auto' }}>
                      {transparencyMessages.length > 0 ? (
                        <List sx={{ py: 0 }}>
                          {transparencyMessages.map((message, index) => (
                            <React.Fragment key={index}>
                              <ListItem sx={{ 
                                py: 1, 
                                px: 2,
                                backgroundColor: index % 2 === 0 ? 'rgba(102, 126, 234, 0.05)' : 'transparent',
                                borderRadius: 1,
                                mb: 1,
                                border: '1px solid rgba(102, 126, 234, 0.1)',
                                transition: 'all 0.2s ease',
                                '&:hover': {
                                  backgroundColor: 'rgba(102, 126, 234, 0.08)',
                                  transform: 'translateX(4px)'
                                }
                              }}>
                                <ListItemIcon sx={{ minWidth: 40 }}>
                                  <Box sx={{ 
                                    p: 0.5, 
                                    borderRadius: 1, 
                                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                    color: 'white',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: 24,
                                    height: 24
                                  }}>
                                    <Typography variant="caption" sx={{ fontWeight: 600 }}>
                                      {index + 1}
                                    </Typography>
                                  </Box>
                                </ListItemIcon>
                                <ListItemText 
                                  primary={message}
                                  primaryTypographyProps={{ 
                                    variant: 'body1',
                                    sx: { 
                                      fontSize: '0.9rem',
                                      lineHeight: 1.5,
                                      color: 'text.primary',
                                      fontWeight: 500
                                    }
                                  }}
                                />
                              </ListItem>
                            </React.Fragment>
                          ))}
                          {/* Invisible div for auto-scroll */}
                          <div ref={messagesEndRef} />
                        </List>
                      ) : (
                        <Box sx={{ 
                          textAlign: 'center', 
                          py: 4,
                          color: 'text.secondary'
                        }}>
                          <AutoAwesomeIcon sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
                          <Typography variant="h6" gutterBottom>
                            Ready to Generate
                          </Typography>
                          <Typography variant="body2">
                            Click "Refresh Data (AI)" to start generating your strategy inputs with real-time transparency
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}

          {/* Tab 2: Data Sources */}
          {activeTab === 1 && (
            <DataSourceTransparency
              autoPopulatedFields={autoPopulatedFields}
              dataSources={dataSources}
              inputDataPoints={inputDataPoints}
            />
          )}

          {/* Tab 3: Field Mapping */}
          {activeTab === 2 && (
            <Box>
              <Typography variant="h6" gutterBottom sx={{ color: '#667eea', fontWeight: 600 }}>
                Field-to-Source Mapping with Confidence Scores
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                See how each of the 30 strategy input fields is mapped to data sources, along with confidence scores and data quality metrics.
              </Typography>

              {fieldMappingData.map((category, categoryIndex) => (
                <Card key={category.category} variant="outlined" sx={{ mb: 3 }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                      <PsychologyIcon color="primary" />
                      <Typography variant="h6" sx={{ fontWeight: 600, color: '#667eea' }}>
                        {category.category}
                      </Typography>
                      <Chip 
                        label={`${category.fields.length} fields`} 
                        color="primary" 
                        size="small" 
                      />
                    </Box>

                    <Grid container spacing={2}>
                      {category.fields.map((field, fieldIndex) => (
                        <Grid item xs={12} md={6} key={field.fieldId}>
                          <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: (categoryIndex * 0.1) + (fieldIndex * 0.05) }}
                          >
                            <Paper sx={{ p: 2, border: '1px solid rgba(102, 126, 234, 0.1)' }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                <Typography variant="body1">
                                  {getDataSourceIcon(field.source)}
                                </Typography>
                                <Typography variant="subtitle2" fontWeight="medium">
                                  {field.label}
                                </Typography>
                              </Box>

                              <Box sx={{ mb: 1 }}>
                                <Typography variant="caption" color="text.secondary">
                                  Source: {getDataSourceLabel(field.source)}
                                </Typography>
                              </Box>

                              {/* Confidence and Quality Metrics */}
                              <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                                <Chip
                                  label={`${Math.round(field.confidence * 100)}% confidence`}
                                  size="small"
                                  color={getConfidenceColor(field.confidence) as any}
                                  sx={{ fontSize: '0.6rem', height: 20 }}
                                />
                                <Chip
                                  label={`${Math.round(field.dataQuality * 100)}% quality`}
                                  size="small"
                                  color={getDataQualityColor(field.dataQuality) as any}
                                  sx={{ fontSize: '0.6rem', height: 20 }}
                                />
                              </Box>

                              {/* Progress Bars */}
                              <Box sx={{ mb: 1 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                  <Typography variant="caption" color="text.secondary">
                                    Confidence
                                  </Typography>
                                  <LinearProgress
                                    variant="determinate"
                                    value={field.confidence * 100}
                                    color={getConfidenceColor(field.confidence) as any}
                                    sx={{ flexGrow: 1, height: 4, borderRadius: 2 }}
                                  />
                                </Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Typography variant="caption" color="text.secondary">
                                    Data Quality
                                  </Typography>
                                  <LinearProgress
                                    variant="determinate"
                                    value={field.dataQuality * 100}
                                    color={getDataQualityColor(field.dataQuality) as any}
                                    sx={{ flexGrow: 1, height: 4, borderRadius: 2 }}
                                  />
                                </Box>
                              </Box>

                              {/* Input Data Preview */}
                              {field.inputData && (
                                <Box sx={{ 
                                  p: 1, 
                                  bgcolor: 'rgba(102, 126, 234, 0.05)', 
                                  borderRadius: 1,
                                  mt: 1
                                }}>
                                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
                                    Input Data:
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                    {typeof field.inputData === 'string' 
                                      ? field.inputData 
                                      : JSON.stringify(field.inputData).substring(0, 100) + '...'
                                    }
                                  </Typography>
                                </Box>
                              )}
                            </Paper>
                          </motion.div>
                        </Grid>
                      ))}
                    </Grid>
                  </CardContent>
                </Card>
              ))}
            </Box>
          )}
        </Box>
      </DialogContent>
      
      <DialogActions sx={{ 
        p: 3, 
        pt: 0,
        justifyContent: 'center'
      }}>
        <Button
          variant={!isGenerating && generationProgress >= 100 ? "contained" : "outlined"}
          color={!isGenerating && generationProgress >= 100 ? "success" : "primary"}
          onClick={onClose}
          sx={{ 
            borderRadius: 2,
            px: 4,
            py: 1.5,
            fontWeight: 600,
            ...(isGenerating || generationProgress < 100 ? {
              borderColor: 'rgba(102, 126, 234, 0.3)',
              color: '#667eea',
              '&:hover': {
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.05)'
              }
            } : {
              '&:hover': {
                backgroundColor: 'success.dark'
              }
            })
          }}
        >
          {!isGenerating && generationProgress >= 100 ? 'Next: Review & Create Strategy' : 'Close'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default StrategyAutofillTransparencyModal;
