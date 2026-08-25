import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  Chip,
  Divider,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  Button
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import AssessmentIcon from '@mui/icons-material/Assessment';
import VisibilityIcon from '@mui/icons-material/Visibility';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useContentPlanningStore } from '../../../stores/contentPlanningStore';
// import { contentPlanningApi } from '../../../services/contentPlanningApi';
import EnhancedPerformanceVisualization from '../components/StrategyIntelligence/components/EnhancedPerformanceVisualization';
import TrendAnalysis from '../components/StrategyIntelligence/components/TrendAnalysis';
import DataTransparencyPanel from '../components/StrategyIntelligence/components/DataTransparencyPanel';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`analytics-tabpanel-${index}`}
      aria-labelledby={`analytics-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

const AnalyticsTab: React.FC = () => {
  const { 
    currentStrategy,
    error: storeError
  } = useContentPlanningStore();
  
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  
  // Cache for analytics data to prevent redundant calls
  const [lastLoadTime, setLastLoadTime] = useState<number>(0);
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  useEffect(() => {
    loadAnalyticsData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadAnalyticsData = async () => {
    try {
      // Check if we have recent cached data to avoid redundant calls
      const now = Date.now();
      if (analyticsData && (now - lastLoadTime) < CACHE_DURATION) {
        console.log('🎯 Using cached analytics data (cache valid for', Math.round((CACHE_DURATION - (now - lastLoadTime)) / 1000), 'seconds)');
        return;
      }
      
      setDataLoading(true);
      setError(null);
      
      console.log('🎯 Loading analytics data...');
      
      // Get strategy ID
      const strategyId = Number(currentStrategy?.id) || currentStrategy?.user_id || 1;
      
      // First, try to load from database (monitoring data)
      try {
        console.log('🎯 Fetching analytics data from database...');
        const response = await fetch(`/api/content-planning/strategy/${strategyId}/analytics-data`);
        
        if (response.ok) {
          const result = await response.json();
          const dbAnalyticsData = result.data;
          
          console.log('✅ Analytics data from database:', dbAnalyticsData);
          setAnalyticsData(dbAnalyticsData);
          setLastLoadTime(Date.now());
          return;
        } else {
          console.warn('⚠️ Database fetch failed, trying cache...');
        }
      } catch (dbError) {
        console.warn('⚠️ Database fetch error, trying cache:', dbError);
      }
      
      // Fallback to cached monitoring data
      const strategyAnalyticsData = localStorage.getItem('strategy_analytics_data');
      const monitoringTasks = localStorage.getItem('strategy_monitoring_tasks');
      
      console.log('🎯 Checking cached monitoring data...');
      
      if (strategyAnalyticsData && monitoringTasks) {
        console.log('✅ Found cached monitoring data');
        
        const cachedData = JSON.parse(strategyAnalyticsData);
        const tasks = JSON.parse(monitoringTasks);
        
        const analyticsData = {
          performance_trends: cachedData.monitoring_plan?.performance_metrics || {},
          content_evolution: cachedData.monitoring_plan?.content_evolution || {},
          engagement_patterns: cachedData.monitoring_plan?.engagement_patterns || {},
          recommendations: cachedData.monitoring_plan?.recommendations || [],
          insights: cachedData.monitoring_plan?.insights || [],
          monitoring_data: cachedData,
          monitoring_tasks: tasks,
          _source: 'cached_monitoring'
        };
        
        console.log('✅ Analytics Data from cache:', analyticsData);
        setAnalyticsData(analyticsData);
        setLastLoadTime(Date.now());
        
      } else {
        // No data available
        console.log('⚠️ No monitoring data found in database or cache');
        const emptyData = {
          performance_trends: {},
          content_evolution: {},
          engagement_patterns: {},
          recommendations: [],
          insights: [],
          monitoring_data: null,
          monitoring_tasks: [],
          _source: 'empty'
        };
        
        setAnalyticsData(emptyData);
        setLastLoadTime(Date.now());
        setError('No monitoring data available. Please activate a strategy first.');
      }
    } catch (error) {
      console.error('❌ Error loading analytics data:', error);
      setError('Failed to load analytics data. Please try again.');
    } finally {
      setDataLoading(false);
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleRefresh = () => {
    console.log('🔄 Manual refresh requested');
    setLastLoadTime(0); // Reset cache
    loadAnalyticsData();
  };

  const getPerformanceColor = (value: number) => {
    if (value >= 80) return 'success';
    if (value >= 60) return 'warning';
    return 'error';
  };

  // Get strategy ID for performance components
  const strategyId = Number(currentStrategy?.id) || currentStrategy?.user_id || 1;

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4">
          Analytics Dashboard
        </Typography>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={handleRefresh}
          disabled={dataLoading}
          sx={{ minWidth: 120 }}
        >
          {dataLoading ? 'Refreshing...' : 'Refresh'}
        </Button>
      </Box>

              {(error || storeError) && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error || storeError}
          </Alert>
        )}

        {/* Data Source Indicator */}
        {analyticsData && (
          <Alert 
            severity="info" 
            sx={{ mb: 2 }}
            action={
              <Chip 
                label={analyticsData._source === 'database_monitoring' ? 'Database' : 
                       analyticsData._source === 'cached_monitoring' ? 'Cache' : 
                       analyticsData._source === 'empty' ? 'No Data' : 'Unknown'} 
                size="small" 
                color="primary" 
                variant="outlined"
              />
            }
          >
            Data source: {analyticsData._source === 'database_monitoring' ? 'Monitoring database' : 
                         analyticsData._source === 'cached_monitoring' ? 'Local cache' : 
                         analyticsData._source === 'empty' ? 'No monitoring data available' : 'Unknown source'}
          </Alert>
        )}

      {/* Tabs Navigation */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs 
          value={activeTab} 
          onChange={handleTabChange}
          sx={{
            '& .MuiTab-root': {
              color: 'text.secondary',
              fontWeight: 600,
              textTransform: 'none',
              fontSize: '1rem',
              minHeight: 48,
              '&.Mui-selected': {
                color: 'primary.main',
                fontWeight: 700
              }
            },
            '& .MuiTabs-indicator': {
              height: 3,
              borderRadius: '3px 3px 0 0'
            }
          }}
        >
          <Tab label="Performance Analytics" icon={<ShowChartIcon />} iconPosition="start" />
          <Tab label="Content Analytics" icon={<AnalyticsIcon />} iconPosition="start" />
          <Tab label="Data Transparency" icon={<VisibilityIcon />} iconPosition="start" />
        </Tabs>
      </Box>

      {/* Performance Analytics Tab */}
      <TabPanel value={activeTab} index={0}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <EnhancedPerformanceVisualization 
            strategyId={strategyId} 
            strategyData={currentStrategy} 
          />
          <TrendAnalysis 
            strategyId={strategyId} 
            strategyData={currentStrategy} 
          />
        </Box>
      </TabPanel>

      {/* Content Analytics Tab */}
      <TabPanel value={activeTab} index={1}>
        {dataLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Grid container spacing={3}>
            {/* Performance Overview */}
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                  <AnalyticsIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Performance Overview
                </Typography>
                <Divider sx={{ mb: 2 }} />
                
                {analyticsData && analyticsData.performance_trends ? (
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">
                        Engagement Rate
                      </Typography>
                      <Typography variant="h4" color={getPerformanceColor(analyticsData.performance_trends.engagement_rate || 0)}>
                        {analyticsData.performance_trends.engagement_rate || 0}%
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">
                        Traffic Growth
                      </Typography>
                      <Typography variant="h4" color="primary">
                        {analyticsData.performance_trends.traffic_growth || 0}%
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">
                        Conversion Rate
                      </Typography>
                      <Typography variant="h4" color={getPerformanceColor(analyticsData.performance_trends.conversion_rate || 0)}>
                        {analyticsData.performance_trends.conversion_rate || 0}%
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">
                        Content Quality
                      </Typography>
                      <Typography variant="h4" color="success.main">
                        {analyticsData.performance_trends.content_quality_score || 0}/100
                      </Typography>
                    </Grid>
                  </Grid>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No performance data available
                  </Typography>
                )}
              </Paper>
            </Grid>

            {/* AI Insights */}
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                  <AssessmentIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                  AI Insights
                </Typography>
                <Divider sx={{ mb: 2 }} />
                
                {analyticsData && analyticsData.insights && analyticsData.insights.length > 0 ? (
                  <Box>
                    {analyticsData.insights.slice(0, 3).map((insight: any, index: number) => (
                      <Box key={index} sx={{ mb: 2 }}>
                        <Typography variant="subtitle2" gutterBottom>
                          {insight.title || `Insight ${index + 1}`}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          {insight.description || insight}
                        </Typography>
                        <Chip 
                          label={insight.priority || 'medium'} 
                          color={insight.priority === 'high' ? 'error' : insight.priority === 'medium' ? 'warning' : 'success'}
                          size="small"
                        />
                      </Box>
                    ))}
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No insights available
                  </Typography>
                )}
              </Paper>
            </Grid>

            {/* Content Evolution */}
            {analyticsData && analyticsData.content_evolution && (
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 3, mb: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    <ShowChartIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Content Evolution
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  
                  {analyticsData.content_evolution.content_types ? (
                    <Box>
                      {analyticsData.content_evolution.content_types.map((contentType: string, index: number) => {
                        const performance = analyticsData.content_evolution.performance_by_type?.[contentType];
                        return (
                          <Box key={index} sx={{ mb: 2 }}>
                            <Typography variant="subtitle1" sx={{ textTransform: 'capitalize' }}>
                              {contentType.replace('_', ' ')}
                            </Typography>
                            {performance && (
                              <Grid container spacing={1}>
                                <Grid item xs={6}>
                                  <Typography variant="body2" color="text.secondary">
                                    Growth
                                  </Typography>
                                  <Typography variant="h6" color="success.main">
                                    +{performance.growth}%
                                  </Typography>
                                </Grid>
                                <Grid item xs={6}>
                                  <Typography variant="body2" color="text.secondary">
                                    Engagement
                                  </Typography>
                                  <Typography variant="h6">
                                    {performance.engagement}%
                                  </Typography>
                                </Grid>
                              </Grid>
                            )}
                          </Box>
                        );
                      })}
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No content evolution data available
                    </Typography>
                  )}
                </Paper>
              </Grid>
            )}

            {/* Performance Trends */}
            {analyticsData && analyticsData.performance_trends && (
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 3, mb: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    <TrendingUpIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Performance Trends
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  
                  {analyticsData.performance_trends.engagement_trend ? (
                    <Box>
                      <Typography variant="subtitle2" gutterBottom>
                        Engagement Trend (Last 5 periods)
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        {analyticsData.performance_trends.engagement_trend.map((value: number, index: number) => (
                          <Box key={index} sx={{ flex: 1, textAlign: 'center' }}>
                            <Typography variant="h6" color="primary">
                              {value}%
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Period {index + 1}
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No trend data available
                    </Typography>
                  )}
                </Paper>
              </Grid>
            )}

            {/* Engagement Patterns */}
            {analyticsData && analyticsData.engagement_patterns && (
              <Grid item xs={12}>
                <Paper sx={{ p: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    <AnalyticsIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Engagement Patterns
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  
                  <Grid container spacing={3}>
                    {analyticsData.engagement_patterns.peak_times && (
                      <Grid item xs={12} md={4}>
                        <Typography variant="subtitle2" gutterBottom>
                          Peak Engagement Times
                        </Typography>
                        {analyticsData.engagement_patterns.peak_times.map((time: string, index: number) => (
                          <Chip 
                            key={index}
                            label={time} 
                            color="primary" 
                            variant="outlined"
                            sx={{ mr: 1, mb: 1 }}
                          />
                        ))}
                      </Grid>
                    )}
                    
                    {analyticsData.engagement_patterns.best_days && (
                      <Grid item xs={12} md={4}>
                        <Typography variant="subtitle2" gutterBottom>
                          Best Performing Days
                        </Typography>
                        {analyticsData.engagement_patterns.best_days.map((day: string, index: number) => (
                          <Chip 
                            key={index}
                            label={day} 
                            color="success" 
                            variant="outlined"
                            sx={{ mr: 1, mb: 1 }}
                          />
                        ))}
                      </Grid>
                    )}
                    
                    {analyticsData.engagement_patterns.audience_segments && (
                      <Grid item xs={12} md={4}>
                        <Typography variant="subtitle2" gutterBottom>
                          Top Audience Segments
                        </Typography>
                        {analyticsData.engagement_patterns.audience_segments.map((segment: string, index: number) => (
                          <Chip 
                            key={index}
                            label={segment.replace('_', ' ')} 
                            color="secondary" 
                            variant="outlined"
                            sx={{ mr: 1, mb: 1 }}
                          />
                        ))}
                      </Grid>
                    )}
                  </Grid>
                </Paper>
              </Grid>
            )}

            {/* Recommendations */}
            {analyticsData && analyticsData.recommendations && analyticsData.recommendations.length > 0 && (
              <Grid item xs={12}>
                <Paper sx={{ p: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    <AssessmentIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                    AI Recommendations
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  
                  <Grid container spacing={2}>
                    {analyticsData.recommendations.map((recommendation: any, index: number) => (
                      <Grid item xs={12} md={6} key={index}>
                        <Card variant="outlined">
                          <CardContent>
                            <Typography variant="subtitle1" gutterBottom>
                              {recommendation.title}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                              {recommendation.description}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1 }}>
                              <Chip 
                                label={recommendation.type} 
                                color="primary" 
                                size="small"
                              />
                              <Chip 
                                label={`${(recommendation.confidence * 100).toFixed(0)}% confidence`} 
                                color="success" 
                                size="small"
                              />
                            </Box>
                          </CardContent>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                </Paper>
              </Grid>
            )}
          </Grid>
        )}
      </TabPanel>

      {/* Data Transparency Tab */}
      <TabPanel value={activeTab} index={2}>
        <DataTransparencyPanel 
          strategyId={strategyId} 
          strategyData={currentStrategy} 
        />
      </TabPanel>
    </Box>
  );
};

export default AnalyticsTab; 