import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  LinearProgress,
  Chip,
  IconButton,
  Tooltip,
  Alert,
  Skeleton,
  Button
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import WarningIcon from '@mui/icons-material/Warning';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RefreshIcon from '@mui/icons-material/Refresh';
import InfoIcon from '@mui/icons-material/Info';
import SpeedIcon from '@mui/icons-material/Speed';
import AssessmentIcon from '@mui/icons-material/Assessment';
import GroupIcon from '@mui/icons-material/Group';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard, ShimmerHeader } from '../../shared/styled';
import { useSemanticDashboardStore } from '../../../stores/semanticDashboardStore';
import { SemanticHealthMetric, CompetitorSemanticSnapshot, ContentSemanticInsight } from '../../../api/semanticDashboard';

interface SemanticDashboardProps {
  className?: string;
}

const SemanticDashboard: React.FC<SemanticDashboardProps> = ({ className }) => {
  const {
    semanticHealth,
    competitorSnapshots,
    contentInsights,
    loading,
    error,
    lastUpdated,
    monitoringStatus,
    fetchSemanticHealth,
    fetchCompetitorSnapshots,
    fetchContentInsights,
    fetchAllSemanticData,
    refreshSemanticAnalysis,
    getHealthStatusColor,
    getInsightTypeColor,
    getConfidenceColor
  } = useSemanticDashboardStore();

  const [refreshing, setRefreshing] = useState(false);

  // Fetch semantic data on component mount
  useEffect(() => {
    fetchAllSemanticData();
  }, []);

  // Auto-refresh every 24 hours (86400000ms)
  useEffect(() => {
    const interval = setInterval(() => {
      if (monitoringStatus === 'active') {
        fetchAllSemanticData();
      }
    }, 86400000); // 24 hours

    return () => clearInterval(interval);
  }, [monitoringStatus, fetchAllSemanticData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshSemanticAnalysis();
    } catch (error) {
      console.error('Failed to refresh semantic analysis:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircleIcon sx={{ color: '#4CAF50' }} />;
      case 'warning':
        return <WarningIcon sx={{ color: '#FF9800' }} />;
      case 'critical':
        return <WarningIcon sx={{ color: '#F44336' }} />;
      default:
        return <InfoIcon sx={{ color: '#9E9E9E' }} />;
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <TrendingUpIcon sx={{ color: '#4CAF50' }} />;
      case 'down':
        return <TrendingDownIcon sx={{ color: '#F44336' }} />;
      default:
        return <AssessmentIcon sx={{ color: '#9E9E9E' }} />;
    }
  };

  const formatLastUpdated = (timestamp: string | null) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  if (error) {
    return (
      <GlassCard className={className}>
        <CardContent>
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
          <Button 
            variant="outlined" 
            onClick={fetchAllSemanticData}
            disabled={loading}
            startIcon={<RefreshIcon />}
          >
            Retry
          </Button>
        </CardContent>
      </GlassCard>
    );
  }

  return (
    <Box className={className}>
      {/* Header */}
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
        <Box display="flex" alignItems="center" gap={1}>
          <AssessmentIcon sx={{ color: '#64B5F6', fontSize: 28 }} />
          <Typography variant="h5" component="h2" sx={{ color: 'white', fontWeight: 600 }}>
            Semantic Intelligence
          </Typography>
          <Chip 
            label={monitoringStatus === 'active' ? 'Active' : 'Inactive'}
            color={monitoringStatus === 'active' ? 'success' : 'default'}
            size="small"
            sx={{ ml: 1 }}
          />
        </Box>
        <Box display="flex" alignItems="center" gap={1}>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
            Updated: {formatLastUpdated(lastUpdated)}
          </Typography>
          <Tooltip title="Refresh semantic analysis">
            <IconButton 
              onClick={handleRefresh} 
              disabled={loading || refreshing}
              sx={{ color: 'rgba(255,255,255,0.7)' }}
            >
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Semantic Health Card */}
      <GlassCard sx={{ mb: 3 }}>
        <ShimmerHeader />
        <CardContent>
          <Box display="flex" alignItems="center" mb={2}>
            <SpeedIcon sx={{ color: '#64B5F6', mr: 1 }} />
            <Typography variant="h6" sx={{ color: 'white', fontWeight: 600 }}>
              Semantic Health
            </Typography>
          </Box>

          {loading && !semanticHealth ? (
            <Box>
              <Skeleton variant="rectangular" height={60} sx={{ mb: 2, borderRadius: 2 }} />
              <Skeleton variant="text" width="80%" />
              <Skeleton variant="text" width="60%" />
            </Box>
          ) : semanticHealth ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Box display="flex" alignItems="center" mb={2}>
                {getStatusIcon(semanticHealth.status)}
                <Box ml={2} flex={1}>
                  <Typography variant="h6" sx={{ color: 'white' }}>
                    {semanticHealth.metric_name.replace(/_/g, ' ').toUpperCase()}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                    {semanticHealth.description}
                  </Typography>
                </Box>
                <Box textAlign="right">
                  <Typography variant="h4" sx={{ color: 'white', fontWeight: 700 }}>
                    {Math.round(semanticHealth.value * 100)}%
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={semanticHealth.value * 100}
                    sx={{
                      width: 100,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: 'rgba(255,255,255,0.2)',
                      '& .MuiLinearProgress-bar': {
                        backgroundColor: getHealthStatusColor(semanticHealth.status),
                        borderRadius: 3
                      }
                    }}
                  />
                </Box>
              </Box>

              {semanticHealth.recommendations.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" sx={{ color: 'rgba(255,255,255,0.8)', mb: 1 }}>
                    Recommendations:
                  </Typography>
                  {semanticHealth.recommendations.map((rec, index) => (
                    <Typography key={index} variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', mb: 0.5 }}>
                      • {rec}
                    </Typography>
                  ))}
                </Box>
              )}
            </motion.div>
          ) : (
            <Typography sx={{ color: 'rgba(255,255,255,0.7)' }}>
              No semantic health data available
            </Typography>
          )}
        </CardContent>
      </GlassCard>

      {/* Competitor Semantic Analysis */}
      <GlassCard sx={{ mb: 3 }}>
        <ShimmerHeader />
        <CardContent>
          <Box display="flex" alignItems="center" mb={2}>
            <GroupIcon sx={{ color: '#81C784', mr: 1 }} />
            <Typography variant="h6" sx={{ color: 'white', fontWeight: 600 }}>
              Competitor Semantic Positioning
            </Typography>
          </Box>

          {loading && competitorSnapshots.length === 0 ? (
            <Grid container spacing={2}>
              {[1, 2, 3].map((i) => (
                <Grid item xs={12} md={6} key={i}>
                  <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 2 }} />
                </Grid>
              ))}
            </Grid>
          ) : competitorSnapshots.length > 0 ? (
            <Grid container spacing={2}>
              <AnimatePresence>
                {competitorSnapshots.map((competitor, index) => (
                  <Grid item xs={12} md={6} key={competitor.competitor_id}>
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: index * 0.1 }}
                    >
                      <Card 
                        sx={{ 
                          background: 'rgba(255,255,255,0.05)',
                          backdropFilter: 'blur(10px)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: 2
                        }}
                      >
                        <CardContent>
                          <Typography variant="h6" sx={{ color: 'white', mb: 1 }}>
                            {competitor.competitor_name}
                          </Typography>
                          
                          <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                              Semantic Overlap
                            </Typography>
                            <Typography variant="h6" sx={{ color: 'white' }}>
                              {Math.round(competitor.semantic_overlap * 100)}%
                            </Typography>
                          </Box>
                          
                          <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                              Authority Score
                            </Typography>
                            <Typography variant="h6" sx={{ color: 'white' }}>
                              {Math.round(competitor.authority_score * 100)}
                            </Typography>
                          </Box>
                          
                          <Box display="flex" justifyContent="space-between" alignItems="center">
                            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                              Content Volume
                            </Typography>
                            <Typography variant="body2" sx={{ color: 'white' }}>
                              {competitor.content_volume} pages
                            </Typography>
                          </Box>

                          {competitor.trending_topics.length > 0 && (
                            <Box mt={2}>
                              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', mb: 1, display: 'block' }}>
                                Trending Topics:
                              </Typography>
                              <Box display="flex" flexWrap="wrap" gap={0.5}>
                                {competitor.trending_topics.slice(0, 3).map((topic, idx) => (
                                  <Chip
                                    key={idx}
                                    label={topic}
                                    size="small"
                                    sx={{
                                      backgroundColor: 'rgba(255,255,255,0.1)',
                                      color: 'white',
                                      fontSize: '0.7rem'
                                    }}
                                  />
                                ))}
                              </Box>
                            </Box>
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  </Grid>
                ))}
              </AnimatePresence>
            </Grid>
          ) : (
            <Typography sx={{ color: 'rgba(255,255,255,0.7)' }}>
              No competitor semantic data available
            </Typography>
          )}
        </CardContent>
      </GlassCard>

      {/* Content Insights */}
      <GlassCard>
        <ShimmerHeader />
        <CardContent>
          <Box display="flex" alignItems="center" mb={2}>
            <LightbulbIcon sx={{ color: '#FFD54F', mr: 1 }} />
            <Typography variant="h6" sx={{ color: 'white', fontWeight: 600 }}>
              Content Intelligence Insights
            </Typography>
          </Box>

          {loading && contentInsights.length === 0 ? (
            <Box>
              {[1, 2, 3].map((i) => (
                <Box key={i} mb={2}>
                  <Skeleton variant="rectangular" height={80} sx={{ borderRadius: 2, mb: 1 }} />
                </Box>
              ))}
            </Box>
          ) : contentInsights.length > 0 ? (
            <AnimatePresence>
              {contentInsights.map((insight, index) => (
                <motion.div
                  key={insight.insight_id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                >
                  <Card 
                    sx={{ 
                      background: 'rgba(255,255,255,0.05)',
                      backdropFilter: 'blur(10px)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 2,
                      mb: 2
                    }}
                  >
                    <CardContent>
                      <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Chip
                            label={insight.insight_type.toUpperCase()}
                            size="small"
                            sx={{
                              backgroundColor: getInsightTypeColor(insight.insight_type),
                              color: 'white',
                              fontWeight: 600,
                              fontSize: '0.7rem'
                            }}
                          />
                          <Typography variant="subtitle2" sx={{ color: 'white', fontWeight: 600 }}>
                            {insight.title}
                          </Typography>
                        </Box>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Tooltip title={`Confidence: ${Math.round(insight.confidence_score * 100)}%`}>
                            <Box>
                              <LinearProgress
                                variant="determinate"
                                value={insight.confidence_score * 100}
                                sx={{
                                  width: 60,
                                  height: 4,
                                  borderRadius: 2,
                                  backgroundColor: 'rgba(255,255,255,0.2)',
                                  '& .MuiLinearProgress-bar': {
                                    backgroundColor: getConfidenceColor(insight.confidence_score),
                                    borderRadius: 2
                                  }
                                }}
                              />
                            </Box>
                          </Tooltip>
                        </Box>
                      </Box>

                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', mb: 1 }}>
                        {insight.description}
                      </Typography>

                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                          Impact Score: {Math.round(insight.impact_score * 100)}/100
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                          Expires: {new Date(insight.expires_at).toLocaleDateString()}
                        </Typography>
                      </Box>

                      {insight.suggested_actions.length > 0 && (
                        <Box mt={1}>
                          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', mb: 0.5, display: 'block' }}>
                            Suggested Actions:
                          </Typography>
                          {insight.suggested_actions.map((action, idx) => (
                            <Typography key={idx} variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', display: 'block' }}>
                              • {action}
                            </Typography>
                          ))}
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          ) : (
            <Typography sx={{ color: 'rgba(255,255,255,0.7)' }}>
              No content insights available
            </Typography>
          )}
        </CardContent>
      </GlassCard>
    </Box>
  );
};

export default SemanticDashboard;
