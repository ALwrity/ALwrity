import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  LinearProgress,
  Alert,
  IconButton,
  Collapse,
  Paper,
  Grid
} from '@mui/material';
import DataUsageIcon from '@mui/icons-material/DataUsage';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import TimelineIcon from '@mui/icons-material/Timeline';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import ScheduleIcon from '@mui/icons-material/Schedule';
import { motion } from 'framer-motion';

interface DataSourceTransparencyProps {
  autoPopulatedFields: Record<string, any>;
  dataSources: Record<string, string>;
  inputDataPoints?: Record<string, any>; // Actual input data used to generate each field
}

const DataSourceTransparency: React.FC<DataSourceTransparencyProps> = ({
  autoPopulatedFields,
  dataSources,
  inputDataPoints = {}
}) => {
  const [expanded, setExpanded] = React.useState(true);
  const [showDataFlow, setShowDataFlow] = React.useState(false);

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

  const getDataQualityScore = (source: string) => {
    // Mock quality scores based on data source
    const scores = {
      website_analysis: 0.85,
      research_preferences: 0.92,
      api_keys: 0.78,
      onboarding_session: 0.88
    };
    return scores[source as keyof typeof scores] || 0.7;
  };

  const getDataQualityColor = (score: number) => {
    if (score >= 0.8) return 'success';
    if (score >= 0.6) return 'warning';
    return 'error';
  };

  const getDataQualityLabel = (score: number) => {
    if (score >= 0.8) return 'High Quality';
    if (score >= 0.6) return 'Medium Quality';
    return 'Low Quality';
  };

  const getDataFreshness = (source: string) => {
    // Mock data freshness (in hours)
    const freshness = {
      website_analysis: 2,
      research_preferences: 24,
      api_keys: 168, // 1 week
      onboarding_session: 48
    };
    return freshness[source as keyof typeof freshness] || 24;
  };

  const getFreshnessColor = (hours: number) => {
    if (hours <= 6) return 'success';
    if (hours <= 24) return 'warning';
    return 'error';
  };

  const getFreshnessLabel = (hours: number) => {
    if (hours <= 6) return 'Very Fresh';
    if (hours <= 24) return 'Fresh';
    if (hours <= 168) return 'Recent';
    return 'Stale';
  };

  // Get input data points for a specific field
  const getInputDataPoints = (fieldId: string) => {
    return inputDataPoints[fieldId] || null;
  };

  // Format input data points for display
  const formatInputDataPoints = (dataPoints: any) => {
    if (!dataPoints) return null;
    
    if (typeof dataPoints === 'string') {
      return dataPoints;
    }
    
    if (Array.isArray(dataPoints)) {
      return dataPoints.join(', ');
    }
    
    if (typeof dataPoints === 'object') {
      return Object.entries(dataPoints)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ');
    }
    
    return String(dataPoints);
  };

  // Get data transformation info
  const getDataTransformationInfo = (fieldId: string, source: string) => {
    const transformations = {
      business_objectives: {
        from: 'website_analysis',
        transformation: 'Extracted business goals from website content and meta descriptions',
        inputData: 'Website content, meta descriptions, about page'
      },
      target_metrics: {
        from: 'research_preferences',
        transformation: 'Derived KPIs from research preferences and industry standards',
        inputData: 'Research preferences, industry benchmarks, competitor analysis'
      },
      content_preferences: {
        from: 'onboarding_session',
        transformation: 'Inferred from user preferences and industry analysis',
        inputData: 'User preferences, industry trends, content consumption patterns'
      },
      preferred_formats: {
        from: 'website_analysis',
        transformation: 'Analyzed existing content formats and user engagement',
        inputData: 'Existing content types, engagement metrics, platform analysis'
      },
      content_frequency: {
        from: 'research_preferences',
        transformation: 'Calculated optimal frequency based on audience and industry',
        inputData: 'Audience research, industry standards, competitor frequency'
      }
    };
    
    return transformations[fieldId as keyof typeof transformations] || {
      from: source,
      transformation: 'Data processed and transformed for optimal strategy',
      inputData: 'Various data sources combined'
    };
  };

  const autoPopulatedFieldsList = Object.entries(autoPopulatedFields).map(([fieldId, value]) => ({
    fieldId,
    value,
    source: dataSources[fieldId] || 'unknown',
    qualityScore: getDataQualityScore(dataSources[fieldId] || 'unknown'),
    freshness: getDataFreshness(dataSources[fieldId] || 'unknown')
  }));

  const sourceSummary = Object.entries(dataSources).reduce((acc, [fieldId, source]) => {
    if (!acc[source]) {
      acc[source] = [];
    }
    acc[source].push(fieldId);
    return acc;
  }, {} as Record<string, string[]>);

  if (Object.keys(autoPopulatedFields).length === 0) {
    return null;
  }

  return (
    <Card variant="outlined">
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <DataUsageIcon color="primary" />
          <Typography variant="h6">
            Data Sources & Transparency
          </Typography>
          <Chip
            icon={<AutoAwesomeIcon />}
            label={`${Object.keys(autoPopulatedFields).length} auto-populated`}
            color="info"
            size="small"
          />
          <IconButton
            size="small"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>

        <Collapse in={expanded}>
          {/* Summary */}
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              {Object.keys(autoPopulatedFields).length} fields were automatically populated from your onboarding data.
            </Typography>
          </Alert>

          {/* Visual Data Flow Diagram */}
          <Paper sx={{ p: 2, mb: 2, bgcolor: 'background.default' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <TimelineIcon color="primary" />
              <Typography variant="subtitle2">Data Flow Visualization</Typography>
              <IconButton
                size="small"
                onClick={() => setShowDataFlow(!showDataFlow)}
              >
                {showDataFlow ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            </Box>
            
            <Collapse in={showDataFlow}>
              <Grid container spacing={2}>
                {Object.entries(sourceSummary).map(([source, fields], index) => (
                  <Grid item xs={12} md={6} key={source}>
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <Paper sx={{ p: 2, bgcolor: 'background.paper' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <Typography variant="h6" sx={{ fontSize: '1.2rem' }}>
                            {getDataSourceIcon(source)}
                          </Typography>
                          <Typography variant="subtitle2" fontWeight="medium">
                            {getDataSourceLabel(source)}
                          </Typography>
                        </Box>
                        
                        {/* Data Flow Path */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <Box sx={{ 
                            width: 20, 
                            height: 20, 
                            borderRadius: '50%', 
                            bgcolor: 'primary.main',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <Typography variant="caption" color="white" fontWeight="bold">
                              {fields.length}
                            </Typography>
                          </Box>
                          <TrendingUpIcon color="primary" sx={{ fontSize: 16 }} />
                          <Typography variant="caption" color="text.secondary">
                            → {fields.length} fields populated
                          </Typography>
                        </Box>

                        {/* Sample Input Data */}
                        <Box sx={{ mb: 1 }}>
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
                            Sample Input Data:
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.6rem' }}>
                            {source === 'website_analysis' && 'Website content, meta tags, page structure'}
                            {source === 'research_preferences' && 'User preferences, industry research, competitor data'}
                            {source === 'api_keys' && 'API configurations, service integrations, authentication'}
                            {source === 'onboarding_session' && 'User responses, preferences, business information'}
                          </Typography>
                        </Box>

                        {/* Quality & Freshness */}
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                          <Chip
                            label={`${Math.round(getDataQualityScore(source) * 100)}% quality`}
                            size="small"
                            color={getDataQualityColor(getDataQualityScore(source))}
                            sx={{ fontSize: '0.6rem' }}
                          />
                          <Chip
                            label={getFreshnessLabel(getDataFreshness(source))}
                            size="small"
                            color={getFreshnessColor(getDataFreshness(source))}
                            icon={<ScheduleIcon sx={{ fontSize: 12 }} />}
                            sx={{ fontSize: '0.6rem' }}
                          />
                        </Box>
                      </Paper>
                    </motion.div>
                  </Grid>
                ))}
              </Grid>
            </Collapse>
          </Paper>

          {/* Data Sources Breakdown */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Data Sources
            </Typography>
            <List dense>
              {Object.entries(sourceSummary).map(([source, fields]) => (
                <ListItem key={source} sx={{ px: 0 }}>
                  <ListItemIcon sx={{ minWidth: 40 }}>
                    <Typography variant="body1">
                      {getDataSourceIcon(source)}
                    </Typography>
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" fontWeight="medium">
                          {getDataSourceLabel(source)}
                        </Typography>
                        <Chip
                          label={`${fields.length} fields`}
                          size="small"
                          variant="outlined"
                        />
                      </Box>
                    }
                    secondary={
                      <Box sx={{ mt: 0.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <LinearProgress
                            variant="determinate"
                            value={getDataQualityScore(source) * 100}
                            color={getDataQualityColor(getDataQualityScore(source))}
                            sx={{ flexGrow: 1, height: 4, borderRadius: 2 }}
                          />
                          <Typography variant="caption" color="text.secondary">
                            {Math.round(getDataQualityScore(source) * 100)}%
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="caption" color="text.secondary">
                            {getDataQualityLabel(getDataQualityScore(source))}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            •
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {getFreshnessLabel(getDataFreshness(source))} ({getDataFreshness(source)}h ago)
                          </Typography>
                        </Box>
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>
          </Box>

          <Divider sx={{ my: 2 }} />

          {/* Auto-populated Fields */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Auto-populated Fields
            </Typography>
            <List dense>
              {autoPopulatedFieldsList.map((field, index) => {
                const inputData = getInputDataPoints(field.fieldId);
                const transformationInfo = getDataTransformationInfo(field.fieldId, field.source);
                
                return (
                  <React.Fragment key={field.fieldId}>
                    <ListItem sx={{ px: 0 }}>
                      <ListItemIcon sx={{ minWidth: 40 }}>
                        <CheckCircleIcon color="success" fontSize="small" />
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2" fontWeight="medium">
                              {field.fieldId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </Typography>
                            <Chip
                              label={getDataSourceLabel(field.source)}
                              size="small"
                              variant="outlined"
                            />
                          </Box>
                        }
                        secondary={
                          <Box sx={{ mt: 0.5 }}>
                            <Typography variant="caption" color="text.secondary">
                              Source: {getDataSourceLabel(field.source)} • Quality: {getDataQualityLabel(field.qualityScore)}
                            </Typography>
                            
                            {/* Data Transformation Info */}
                            <Box sx={{ mt: 0.5, p: 1, bgcolor: 'rgba(76, 175, 80, 0.05)', borderRadius: 1 }}>
                              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
                                🔄 Transformation: {transformationInfo.transformation}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                📊 Input Data: {transformationInfo.inputData}
                              </Typography>
                              {inputData && (
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                  📝 Actual Input: {formatInputDataPoints(inputData)}
                                </Typography>
                              )}
                            </Box>
                            
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                              <Chip
                                label={`${Math.round(field.qualityScore * 100)}% confidence`}
                                size="small"
                                color={field.qualityScore > 0.8 ? 'success' : field.qualityScore > 0.6 ? 'warning' : 'error'}
                                sx={{ fontSize: '0.5rem', height: 16 }}
                              />
                              <Chip
                                label={getFreshnessLabel(field.freshness)}
                                size="small"
                                color={getFreshnessColor(field.freshness)}
                                icon={<ScheduleIcon sx={{ fontSize: 10 }} />}
                                sx={{ fontSize: '0.5rem', height: 16 }}
                              />
                            </Box>
                          </Box>
                        }
                      />
                    </ListItem>
                    {index < autoPopulatedFieldsList.length - 1 && <Divider />}
                  </React.Fragment>
                );
              })}
            </List>
          </Box>

          {/* Transparency Note */}
          <Box sx={{ mt: 2, p: 1, bgcolor: 'background.default', borderRadius: 1 }}>
            <Typography variant="caption" color="text.secondary">
              💡 You can modify any auto-populated field. The system learns from your changes to improve future recommendations.
            </Typography>
          </Box>
        </Collapse>
      </CardContent>
    </Card>
  );
};

export default DataSourceTransparency; 