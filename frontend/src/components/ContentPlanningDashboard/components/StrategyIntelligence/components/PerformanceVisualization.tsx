import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  CircularProgress,
  Chip,
  IconButton,
  Tooltip,
  Alert,
  AlertTitle,
  LinearProgress,
  Divider
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import AssessmentIcon from '@mui/icons-material/Assessment';
import SpeedIcon from '@mui/icons-material/Speed';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EngagementIcon from '@mui/icons-material/People';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import RefreshIcon from '@mui/icons-material/Refresh';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import { motion } from 'framer-motion';
import { strategyMonitoringApi } from '../../../../../services/strategyMonitoringApi';

interface PerformanceMetrics {
  traffic_growth_percentage: number;
  engagement_rate_percentage: number;
  conversion_rate_percentage: number;
  roi_ratio: number;
  strategy_adoption_rate: number;
  content_quality_score: number;
  competitive_position_rank: number;
  audience_growth_percentage: number;
  confidence_score: number;
  last_updated: string;
}

interface PerformanceVisualizationProps {
  strategyId: number;
  strategyData?: any;
}

const PerformanceVisualization: React.FC<PerformanceVisualizationProps> = ({
  strategyId,
  strategyData
}) => {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  useEffect(() => {
    loadPerformanceMetrics();
  }, [strategyId]);

  const loadPerformanceMetrics = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Call the API to get performance metrics
      const response = await strategyMonitoringApi.getPerformanceMetrics(strategyId);
      setMetrics(response.data);
      setLastRefresh(new Date());
    } catch (err: any) {
      setError(err.message || 'Failed to load performance metrics');
    } finally {
      setLoading(false);
    }
  };

  const getMetricColor = (value: number, threshold: number = 0) => {
    if (value >= threshold + 10) return '#4caf50'; // Green
    if (value >= threshold) return '#ff9800'; // Orange
    return '#f44336'; // Red
  };

  const getMetricIcon = (value: number, threshold: number = 0) => {
    if (value >= threshold + 10) return <TrendingUpIcon />;
    if (value >= threshold) return <TrendingDownIcon />;
    return <ErrorIcon />;
  };

  const getMetricStatus = (value: number, threshold: number = 0) => {
    if (value >= threshold + 10) return 'Excellent';
    if (value >= threshold) return 'Good';
    return 'Needs Attention';
  };

  const MetricCard = ({ 
    title, 
    value, 
    unit = '%', 
    threshold = 0, 
    icon, 
    description 
  }: {
    title: string;
    value: number;
    unit?: string;
    threshold?: number;
    icon: React.ReactNode;
    description: string;
  }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card sx={{
        height: '100%',
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
          background: 'radial-gradient(circle at 20% 80%, rgba(255,255,255,0.1) 0%, transparent 50%)',
          pointerEvents: 'none'
        }
      }}>
        <CardContent sx={{ position: 'relative', zIndex: 1, p: 3 }}>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
            <Box display="flex" alignItems="center" gap={1}>
              {icon}
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                {title}
              </Typography>
            </Box>
            <Chip
              label={getMetricStatus(value, threshold)}
              size="small"
              sx={{
                background: getMetricColor(value, threshold),
                color: 'white',
                fontWeight: 600
              }}
            />
          </Box>
          
          <Typography variant="h3" sx={{ 
            fontWeight: 700, 
            mb: 1,
            color: getMetricColor(value, threshold)
          }}>
            {value}{unit}
          </Typography>
          
          <Typography variant="body2" sx={{ 
            opacity: 0.9,
            mb: 2
          }}>
            {description}
          </Typography>
          
          <LinearProgress
            variant="determinate"
            value={Math.min((value / (threshold + 20)) * 100, 100)}
            sx={{
              height: 6,
              borderRadius: 3,
              background: 'rgba(255,255,255,0.2)',
              '& .MuiLinearProgress-bar': {
                background: getMetricColor(value, threshold),
                borderRadius: 3
              }
            }}
          />
        </CardContent>
      </Card>
    </motion.div>
  );

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
        <CircularProgress size={60} />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 3 }}>
        <AlertTitle>Error Loading Performance Data</AlertTitle>
        {error}
      </Alert>
    );
  }

  if (!metrics) {
    return (
      <Alert severity="info" sx={{ mb: 3 }}>
        <AlertTitle>No Performance Data Available</AlertTitle>
        Performance metrics will appear here once your strategy is activated and monitoring begins.
      </Alert>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
    >
      {/* Header Section */}
      <Box sx={{ mb: 4 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Box>
            <Typography variant="h4" sx={{ 
              fontWeight: 700,
              background: 'linear-gradient(45deg, #667eea, #764ba2)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              mb: 1
            }}>
              🚀 Strategy Performance Dashboard
            </Typography>
            <Typography variant="body1" sx={{ color: 'text.secondary' }}>
              Real-time monitoring and performance analytics for your content strategy
            </Typography>
          </Box>
          
          <Box display="flex" alignItems="center" gap={2}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Last updated: {new Date(metrics.last_updated).toLocaleString()}
            </Typography>
            <Tooltip title="Refresh metrics">
              <IconButton onClick={loadPerformanceMetrics} sx={{ color: 'primary.main' }}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
        
        <Divider sx={{ mb: 3 }} />
      </Box>

      {/* Performance Metrics Grid */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={6} lg={3}>
          <MetricCard
            title="Traffic Growth"
            value={metrics.traffic_growth_percentage}
            unit="%"
            threshold={5}
            icon={<TrendingUpIcon />}
            description="Organic traffic growth compared to previous period"
          />
        </Grid>
        
        <Grid item xs={12} md={6} lg={3}>
          <MetricCard
            title="Engagement Rate"
            value={metrics.engagement_rate_percentage}
            unit="%"
            threshold={5}
            icon={<EngagementIcon />}
            description="Average engagement rate across all content"
          />
        </Grid>
        
        <Grid item xs={12} md={6} lg={3}>
          <MetricCard
            title="Conversion Rate"
            value={metrics.conversion_rate_percentage}
            unit="%"
            threshold={1}
            icon={<MonetizationOnIcon />}
            description="Content-driven conversion rate"
          />
        </Grid>
        
        <Grid item xs={12} md={6} lg={3}>
          <MetricCard
            title="ROI Ratio"
            value={metrics.roi_ratio}
            unit="x"
            threshold={2}
            icon={<SpeedIcon />}
            description="Return on investment for content strategy"
          />
        </Grid>
      </Grid>

      {/* Strategy Effectiveness Metrics */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%', background: 'linear-gradient(135deg, #4caf50 0%, #45a049 100%)', color: 'white' }}>
            <CardContent sx={{ p: 3 }}>
              <Box display="flex" alignItems="center" gap={2} mb={2}>
                <AutoAwesomeIcon />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Strategy Adoption Rate
                </Typography>
              </Box>
              
              <Typography variant="h2" sx={{ fontWeight: 700, mb: 2 }}>
                {metrics.strategy_adoption_rate}%
              </Typography>
              
              <Typography variant="body2" sx={{ opacity: 0.9, mb: 2 }}>
                Percentage of strategy components successfully implemented and monitored
              </Typography>
              
              <LinearProgress
                variant="determinate"
                value={metrics.strategy_adoption_rate}
                sx={{
                  height: 8,
                  borderRadius: 4,
                  background: 'rgba(255,255,255,0.2)',
                  '& .MuiLinearProgress-bar': {
                    background: 'white',
                    borderRadius: 4
                  }
                }}
              />
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%', background: 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)', color: 'white' }}>
            <CardContent sx={{ p: 3 }}>
              <Box display="flex" alignItems="center" gap={2} mb={2}>
                <AssessmentIcon />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Content Quality Score
                </Typography>
              </Box>
              
              <Typography variant="h2" sx={{ fontWeight: 700, mb: 2 }}>
                {metrics.content_quality_score}/100
              </Typography>
              
              <Typography variant="body2" sx={{ opacity: 0.9, mb: 2 }}>
                AI-powered quality assessment of your content strategy
              </Typography>
              
              <LinearProgress
                variant="determinate"
                value={metrics.content_quality_score}
                sx={{
                  height: 8,
                  borderRadius: 4,
                  background: 'rgba(255,255,255,0.2)',
                  '& .MuiLinearProgress-bar': {
                    background: 'white',
                    borderRadius: 4
                  }
                }}
              />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Competitive Analysis */}
      <Card sx={{ mb: 4, background: 'linear-gradient(135deg, #9c27b0 0%, #7b1fa2 100%)', color: 'white' }}>
        <CardContent sx={{ p: 3 }}>
          <Box display="flex" alignItems="center" gap={2} mb={3}>
            <VisibilityIcon />
            <Typography variant="h5" sx={{ fontWeight: 600 }}>
              Competitive Position Analysis
            </Typography>
          </Box>
          
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Box sx={{ mb: 2 }}>
                <Typography variant="h6" sx={{ mb: 1 }}>
                  Market Rank
                </Typography>
                <Typography variant="h3" sx={{ fontWeight: 700 }}>
                  #{metrics.competitive_position_rank}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  Your position among top competitors in the market
                </Typography>
              </Box>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Box sx={{ mb: 2 }}>
                <Typography variant="h6" sx={{ mb: 1 }}>
                  Audience Growth
                </Typography>
                <Typography variant="h3" sx={{ fontWeight: 700 }}>
                  {metrics.audience_growth_percentage}%
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  Monthly audience growth rate
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Confidence Score */}
      <Card sx={{ background: 'linear-gradient(135deg, #2196f3 0%, #1976d2 100%)', color: 'white' }}>
        <CardContent sx={{ p: 3 }}>
          <Box display="flex" alignItems="center" gap={2} mb={2}>
            <CheckCircleIcon />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              AI Confidence Score
            </Typography>
          </Box>
          
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
            {metrics.confidence_score}%
          </Typography>
          
          <Typography variant="body2" sx={{ opacity: 0.9 }}>
            AI confidence level in the accuracy of these performance metrics
          </Typography>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default PerformanceVisualization;
