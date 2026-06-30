import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  LinearProgress,
  Alert,
  CircularProgress,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
  Tooltip,
  Badge,
} from '@mui/material';
import {
  Visibility,
  MouseOutlined,
  Search,
  TrendingUp,
  TrendingDown,
  Insights,
  Lightbulb,
  Assessment,
  Refresh,
  ExpandMore,
  CheckCircle,
  Error as ErrorIcon,
  Warning,
  Star,
  Speed,
  Analytics,
} from '@mui/icons-material';
import { apiClient } from '../../api/client';

interface BingInsightsCardProps {
  siteUrl?: string;
  days?: number;
  onInsightsLoaded?: (insights: any) => void;
  insights?: {
    performance?: PerformanceInsights;
    seo?: SEOInsights;
    recommendations?: Recommendations;
    last_analyzed?: string;
  };
  loading?: boolean;
  error?: string | null;
}

interface PerformanceInsights {
  performance_summary: {
    total_clicks: number;
    total_impressions: number;
    avg_ctr: number;
    total_queries: number;
  };
  trends: {
    status?: string;
    message?: string;
    ctr_trend?: {
      current: number;
      previous: number;
      change_percent: number;
      direction: string;
    };
    clicks_trend?: {
      current: number;
      previous: number;
      change_percent: number;
      direction: string;
    };
    trend_strength?: string;
  };
  performance_indicators: {
    ctr_score?: number;
    volume_score?: number;
    consistency_score?: number;
    overall_score?: number;
    performance_level: string;
    traffic_quality?: string;
    growth_potential?: string;
  };
  insights: string[];
  error?: string; // Add error property for error handling
}

interface SEOInsights {
  query_analysis: {
    total_queries: number;
    brand_queries: {
      count: number;
      clicks: number;
      percentage: number;
    };
    non_brand_queries: {
      count: number;
      clicks: number;
      percentage: number;
    };
    query_length_distribution: {
      short_queries: number;
      long_queries: number;
      average_length: number;
    };
    top_categories: Record<string, number>;
  };
  content_opportunities: Array<{
    query: string;
    impressions: number;
    ctr: number;
    opportunity: string;
    priority: string;
  }>;
  technical_insights: {
    average_position: number;
    average_ctr: number;
    position_distribution: {
      top_3: number;
      top_10: number;
      page_2_plus: number;
    };
    ctr_distribution: {
      excellent: number;
      good: number;
      poor: number;
    };
  };
  seo_recommendations: Array<{
    type: string;
    priority: string;
    recommendation: string;
    action: string;
  }>;
  error?: string; // Add error property for error handling
}

interface Recommendations {
  immediate_actions: Array<{
    action: string;
    priority: string;
    description: string;
  }>;
  content_optimization: Array<{
    query: string;
    opportunity: string;
    priority: string;
  }>;
  technical_improvements: Array<{
    issue: string;
    solution: string;
    priority: string;
  }>;
  long_term_strategy: Array<{
    strategy: string;
    timeline: string;
    expected_impact: string;
  }>;
  priority_score: Record<string, number>;
  error?: string; // Add error property for error handling
}

const BingInsightsCard: React.FC<BingInsightsCardProps> = ({
  siteUrl,
  days = 30,
  onInsightsLoaded,
  insights: propInsights,
  loading: propLoading,
  error: propError,
}) => {
  const [internalLoading, setInternalLoading] = useState(!propInsights);
  const [internalError, setInternalError] = useState<string | null>(null);
  const [internalInsights, setInternalInsights] = useState<{
    performance?: PerformanceInsights;
    seo?: SEOInsights;
    recommendations?: Recommendations;
    last_analyzed?: string;
  }>({});
  
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Use props if available, otherwise use internal state
  const loading = propLoading !== undefined ? propLoading : internalLoading;
  const error = propError !== undefined ? propError : internalError;
  const insights = propInsights || internalInsights;

  const loadInsights = useCallback(async () => {
    // Only load if we don't have insights passed as props
    if (propInsights) return;

    // Fail fast: require a real siteUrl
    if (!siteUrl) {
      setInternalError('No site URL provided for Bing insights');
      setInternalLoading(false);
      return;
    }

    // Clear any existing timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    
    // Debounce the API call to prevent rapid successive requests
    debounceTimeoutRef.current = setTimeout(async () => {
      try {
        setInternalLoading(true);
        setInternalError(null);

        const response = await apiClient.get('/api/bing-insights/comprehensive', {
          params: { site_url: siteUrl, days }
        });

        console.log('Raw Bing insights response:', response.data.data);
        
        // The API response structure is directly the insights data (no metrics wrapper)
        const insightsData = response.data.data;
        
        console.log('Insights data structure:', insightsData);
        setInternalInsights(insightsData);
        onInsightsLoaded?.(insightsData);
        
      } catch (err: any) {
        setInternalError(err.response?.data?.detail || 'Failed to load Bing insights');
      } finally {
        setInternalLoading(false);
      }
    }, 300); // 300ms debounce
  }, [siteUrl, days, onInsightsLoaded, propInsights]);

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  const getChangeColor = (change: number) => {
    if (change > 0) return 'success';
    if (change < 0) return 'error';
    return 'default';
  };

  const getChangeIcon = (change: number) => {
    if (change > 0) return <TrendingUp />;
    if (change < 0) return <TrendingDown />;
    return <TrendingUp style={{ transform: 'rotate(90deg)' }} />;
  };

  const getPerformanceLevelColor = (level: string) => {
    switch (level) {
      case 'excellent': return 'success';
      case 'good': return 'info';
      case 'fair': return 'warning';
      case 'needs_improvement': return 'error';
      default: return 'default';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'info';
      default: return 'default';
    }
  };

  useEffect(() => {
    // Only load insights if we don't have them passed as props
    if (!propInsights) {
      loadInsights();
    }
    
    // Cleanup timeout on unmount
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [loadInsights, propInsights]);

  if (loading) {
    return (
      <Card sx={{ p: 2 }}>
        <Box display="flex" alignItems="center" justifyContent="center" minHeight="200px">
          <CircularProgress />
          <Typography variant="body2" sx={{ ml: 2 }}>
            Loading Bing insights...
          </Typography>
        </Box>
      </Card>
    );
  }

  if (error) {
    return (
      <Card sx={{ p: 2 }}>
        <Alert severity="error" action={
          <IconButton color="inherit" size="small" onClick={loadInsights}>
            <Refresh />
          </IconButton>
        }>
          {error}
        </Alert>
      </Card>
    );
  }

  return (
    <Card sx={{ p: 2 }}>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <Typography variant="h6" component="h2" display="flex" alignItems="center">
          <Search sx={{ mr: 1 }} />
          Bing Webmaster Insights
        </Typography>
        <IconButton onClick={loadInsights} size="small">
          <Refresh />
        </IconButton>
      </Box>

      {/* Connection Status and Basic Metrics */}
      <Card sx={{ mb: 2, p: 2, bgcolor: 'background.paper' }}>
        <Typography variant="subtitle1" gutterBottom display="flex" alignItems="center">
          <CheckCircle sx={{ mr: 1, color: 'success.main' }} />
          Connection Status
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={3}>
            <Box textAlign="center">
              <Typography variant="h4" color="primary">
                {formatNumber(insights.performance?.performance_summary?.total_clicks || 0)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Clicks
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} md={3}>
            <Box textAlign="center">
              <Typography variant="h4" color="primary">
                {formatNumber(insights.performance?.performance_summary?.total_impressions || 0)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Impressions
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} md={3}>
            <Box textAlign="center">
              <Typography variant="h4" color="primary">
                {(insights.performance?.performance_summary?.avg_ctr || 0).toFixed(2)}%
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Average CTR
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} md={3}>
            <Box textAlign="center">
              <Typography variant="h4" color="primary">
                {formatNumber(insights.performance?.performance_summary?.total_queries || 0)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Queries
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Card>

      {/* Performance Insights */}
      {insights.performance && !insights.performance.error && insights.performance.performance_indicators && insights.performance.performance_summary && (
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Box display="flex" alignItems="center">
              <Assessment sx={{ mr: 1 }} />
              <Typography variant="subtitle1">Performance Analysis</Typography>
              <Chip 
                label={insights.performance?.performance_indicators?.performance_level || 'Unknown'}
                color={getPerformanceLevelColor(insights.performance?.performance_indicators?.performance_level || 'Unknown')}
                size="small"
                sx={{ ml: 2 }}
              />
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2}>
              {/* Performance Summary */}
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" gutterBottom>Performance Summary</Typography>
                <Box display="flex" flexDirection="column" gap={1}>
                  <Box display="flex" justifyContent="space-between">
                    <Typography variant="body2">Total Clicks:</Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {formatNumber(insights.performance.performance_summary.total_clicks || 0)}
                    </Typography>
                  </Box>
                  <Box display="flex" justifyContent="space-between">
                    <Typography variant="body2">Total Impressions:</Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {formatNumber(insights.performance.performance_summary.total_impressions || 0)}
                    </Typography>
                  </Box>
                  <Box display="flex" justifyContent="space-between">
                    <Typography variant="body2">Average CTR:</Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {(insights.performance.performance_summary.avg_ctr || 0).toFixed(2)}%
                    </Typography>
                  </Box>
                  <Box display="flex" justifyContent="space-between">
                    <Typography variant="body2">Total Queries:</Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {formatNumber(insights.performance.performance_summary.total_queries || 0)}
                    </Typography>
                  </Box>
                </Box>
              </Grid>

              {/* Performance Indicators */}
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" gutterBottom>Performance Indicators</Typography>
                <Box display="flex" flexDirection="column" gap={1}>
                  <Box display="flex" justifyContent="space-between">
                    <Typography variant="body2">Performance Level:</Typography>
                    <Chip 
                      label={insights.performance.performance_indicators.performance_level || 'Unknown'}
                      color={getPerformanceLevelColor(insights.performance.performance_indicators.performance_level || 'Unknown')}
                      size="small"
                    />
                  </Box>
                  <Box display="flex" justifyContent="space-between">
                    <Typography variant="body2">Traffic Quality:</Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {insights.performance.performance_indicators.traffic_quality || 'Unknown'}
                    </Typography>
                  </Box>
                  <Box display="flex" justifyContent="space-between">
                    <Typography variant="body2">Growth Potential:</Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {insights.performance.performance_indicators.growth_potential || 'Unknown'}
                    </Typography>
                  </Box>
                  {/* Legacy scores if available */}
                  {insights.performance.performance_indicators.ctr_score !== undefined && (
                    <Box>
                      <Box display="flex" justifyContent="space-between" mb={0.5}>
                        <Typography variant="body2">CTR Score:</Typography>
                        <Typography variant="body2">{insights.performance.performance_indicators.ctr_score || 0}/100</Typography>
                      </Box>
                      <LinearProgress 
                        variant="determinate" 
                        value={insights.performance.performance_indicators.ctr_score || 0}
                        color={(insights.performance.performance_indicators.ctr_score || 0) > 70 ? 'success' : 'primary'}
                      />
                    </Box>
                  )}
                </Box>
              </Grid>

              {/* Trends */}
              {insights.performance.trends && (
                <Grid item xs={12}>
                  <Typography variant="subtitle2" gutterBottom>Trends</Typography>
                  {insights.performance.trends.status === 'insufficient_data' ? (
                    <Alert severity="info" sx={{ mb: 2 }}>
                      <Typography variant="body2">
                        {insights.performance.trends.message || 'Detailed analytics data not available for trend analysis'}
                      </Typography>
                    </Alert>
                  ) : (
                    <Grid container spacing={2}>
                      {insights.performance.trends.ctr_trend && (
                        <Grid item xs={6}>
                          <Box display="flex" alignItems="center" gap={1}>
                            {getChangeIcon(insights.performance.trends.ctr_trend.change_percent || 0)}
                            <Typography variant="body2">CTR Trend:</Typography>
                            <Chip 
                              label={`${(insights.performance.trends.ctr_trend.change_percent || 0) > 0 ? '+' : ''}${insights.performance.trends.ctr_trend.change_percent || 0}%`}
                              color={getChangeColor(insights.performance.trends.ctr_trend.change_percent || 0)}
                              size="small"
                            />
                          </Box>
                        </Grid>
                      )}
                      {insights.performance.trends.clicks_trend && (
                        <Grid item xs={6}>
                          <Box display="flex" alignItems="center" gap={1}>
                            {getChangeIcon(insights.performance.trends.clicks_trend.change_percent || 0)}
                            <Typography variant="body2">Clicks Trend:</Typography>
                            <Chip 
                              label={`${(insights.performance.trends.clicks_trend.change_percent || 0) > 0 ? '+' : ''}${insights.performance.trends.clicks_trend.change_percent || 0}%`}
                              color={getChangeColor(insights.performance.trends.clicks_trend.change_percent || 0)}
                              size="small"
                            />
                          </Box>
                        </Grid>
                      )}
                    </Grid>
                  )}
                </Grid>
              )}

              {/* Performance Insights */}
              {insights.performance.insights && insights.performance.insights.length > 0 && (
                <Grid item xs={12}>
                  <Typography variant="subtitle2" gutterBottom>Key Insights</Typography>
                  <List dense>
                    {insights.performance.insights.map((insight, index) => (
                      <ListItem key={index}>
                        <ListItemIcon>
                          <Lightbulb color="primary" />
                        </ListItemIcon>
                        <ListItemText primary={insight} />
                      </ListItem>
                    ))}
                  </List>
                </Grid>
              )}
            </Grid>
          </AccordionDetails>
        </Accordion>
      )}

      {/* Performance Error Fallback */}
      {insights.performance && insights.performance.error && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <Typography variant="body2">
            Performance insights unavailable: {insights.performance.error}
          </Typography>
        </Alert>
      )}

      {/* SEO Insights */}
      {insights.seo && !insights.seo.error && insights.seo.query_analysis && (
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Box display="flex" alignItems="center">
              <Analytics sx={{ mr: 1 }} />
              <Typography variant="subtitle1">SEO Analysis</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2}>
              {/* Query Analysis */}
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" gutterBottom>Query Analysis</Typography>
                <Box display="flex" flexDirection="column" gap={1}>
                  <Box display="flex" justifyContent="space-between">
                    <Typography variant="body2">Total Queries:</Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {insights.seo?.query_analysis?.total_queries || 0}
                    </Typography>
                  </Box>
                  <Box display="flex" justifyContent="space-between">
                    <Typography variant="body2">Brand Queries:</Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {insights.seo?.query_analysis?.brand_queries?.percentage || 0}%
                    </Typography>
                  </Box>
                  <Box display="flex" justifyContent="space-between">
                    <Typography variant="body2">Non-Brand Queries:</Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {insights.seo?.query_analysis?.non_brand_queries?.percentage || 0}%
                    </Typography>
                  </Box>
                  <Box display="flex" justifyContent="space-between">
                    <Typography variant="body2">Avg Query Length:</Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {insights.seo?.query_analysis?.query_length_distribution?.average_length || 0} chars
                    </Typography>
                  </Box>
                </Box>
              </Grid>

              {/* Technical Insights */}
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" gutterBottom>Technical Performance</Typography>
                <Box display="flex" flexDirection="column" gap={1}>
                  <Box display="flex" justifyContent="space-between">
                    <Typography variant="body2">Avg Position:</Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {insights.seo?.technical_insights?.average_position !== undefined 
                        ? insights.seo.technical_insights.average_position 
                        : 'N/A'}
                    </Typography>
                  </Box>
                  <Box display="flex" justifyContent="space-between">
                    <Typography variant="body2">Avg CTR:</Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {(insights.seo?.technical_insights?.average_ctr || 0).toFixed(2)}%
                    </Typography>
                  </Box>
                  <Box display="flex" justifyContent="space-between">
                    <Typography variant="body2">Top 3 Positions:</Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {insights.seo?.technical_insights?.position_distribution?.top_3 || 0}
                    </Typography>
                  </Box>
                  <Box display="flex" justifyContent="space-between">
                    <Typography variant="body2">Top 10 Positions:</Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {insights.seo?.technical_insights?.position_distribution?.top_10 || 0}
                    </Typography>
                  </Box>
                </Box>
              </Grid>

              {/* Content Opportunities */}
              {insights.seo?.content_opportunities && insights.seo.content_opportunities.length > 0 && (
                <Grid item xs={12}>
                  <Typography variant="subtitle2" gutterBottom>Content Opportunities</Typography>
                  <List dense>
                    {insights.seo.content_opportunities.slice(0, 3).map((opportunity, index) => (
                      <ListItem key={index}>
                        <ListItemIcon>
                          <Star color="warning" />
                        </ListItemIcon>
                        <ListItemText 
                          primary={opportunity.query}
                          secondary={`${opportunity.impressions} impressions, ${opportunity.ctr.toFixed(2)}% CTR - ${opportunity.opportunity}`}
                        />
                        <Chip 
                          label={opportunity.priority}
                          color={getPriorityColor(opportunity.priority)}
                          size="small"
                        />
                      </ListItem>
                    ))}
                  </List>
                </Grid>
              )}

              {/* SEO Recommendations */}
              {insights.seo.seo_recommendations && insights.seo.seo_recommendations.length > 0 && (
                <Grid item xs={12}>
                  <Typography variant="subtitle2" gutterBottom>SEO Recommendations</Typography>
                  <List dense>
                    {insights.seo.seo_recommendations.map((rec, index) => (
                      <ListItem key={index}>
                        <ListItemIcon>
                          <Lightbulb color="primary" />
                        </ListItemIcon>
                        <ListItemText 
                          primary={rec.recommendation}
                          secondary={rec.action}
                        />
                        <Chip 
                          label={rec.priority}
                          color={getPriorityColor(rec.priority)}
                          size="small"
                        />
                      </ListItem>
                    ))}
                  </List>
                </Grid>
              )}
            </Grid>
          </AccordionDetails>
        </Accordion>
      )}

      {/* SEO Error Fallback */}
      {insights.seo && insights.seo.error && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <Typography variant="body2">
            SEO insights unavailable: {insights.seo.error}
          </Typography>
        </Alert>
      )}

      {/* Recommendations */}
      {insights.recommendations && (
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Box display="flex" alignItems="center">
              <Lightbulb sx={{ mr: 1 }} />
              <Typography variant="subtitle1">Actionable Recommendations</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2}>
              {/* Immediate Actions */}
              {insights.recommendations.immediate_actions && insights.recommendations.immediate_actions.length > 0 && (
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" gutterBottom>Immediate Actions</Typography>
                  <List dense>
                    {insights.recommendations.immediate_actions.map((action, index) => (
                      <ListItem key={index}>
                        <ListItemIcon>
                          <Speed color="error" />
                        </ListItemIcon>
                        <ListItemText 
                          primary={action.action}
                          secondary={action.description}
                        />
                        <Chip 
                          label={action.priority}
                          color={getPriorityColor(action.priority)}
                          size="small"
                        />
                      </ListItem>
                    ))}
                  </List>
                </Grid>
              )}

              {/* Long-term Strategy */}
              {insights.recommendations.long_term_strategy && insights.recommendations.long_term_strategy.length > 0 && (
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" gutterBottom>Long-term Strategy</Typography>
                  <List dense>
                    {insights.recommendations.long_term_strategy.map((strategy, index) => (
                      <ListItem key={index}>
                        <ListItemIcon>
                          <TrendingUp color="success" />
                        </ListItemIcon>
                        <ListItemText 
                          primary={strategy.strategy}
                          secondary={`${strategy.timeline} - ${strategy.expected_impact}`}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Grid>
              )}
            </Grid>
          </AccordionDetails>
        </Accordion>
      )}

      {/* Last Updated Information */}
      {insights.last_analyzed && (
        <Box mt={2} p={1} bgcolor="grey.50" borderRadius={1}>
          <Typography variant="caption" color="text.secondary" display="flex" alignItems="center">
            <Assessment sx={{ mr: 0.5, fontSize: 14 }} />
            Last analyzed: {new Date(insights.last_analyzed).toLocaleString()}
          </Typography>
        </Box>
      )}
    </Card>
  );
};

export default BingInsightsCard;
