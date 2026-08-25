import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Tooltip, 
  Typography, 
  Chip,
  CircularProgress,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Card,
  CardContent,
  CardHeader,
  Avatar
} from '@mui/material';
import { apiClient } from '../../../api/client';
import { isFeatureOnlyMode } from '../../../utils/demoMode';
import HealthyIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import CriticalIcon from '@mui/icons-material/Error';
import UnknownIcon from '@mui/icons-material/Help';
import RefreshIcon from '@mui/icons-material/Refresh';
import CloseIcon from '@mui/icons-material/Close';
import BugReportIcon from '@mui/icons-material/BugReport';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import { motion, AnimatePresence } from 'framer-motion';
import MonitoringCharts from './MonitoringCharts';

interface SystemStatusData {
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  icon: string;
  recent_requests: number;
  recent_errors: number;
  error_rate: number;
  timestamp: string;
}

interface DetailedStatsData {
  overview: {
    total_requests: number;
    total_errors: number;
    recent_requests: number;
    recent_errors: number;
  };
  cache_performance: {
    hits: number;
    misses: number;
    hit_rate: number;
  };
  top_endpoints: Array<{
    endpoint: string;
    count: number;
    avg_time: number;
    errors: number;
    last_called: string;
    cache_hit_rate: number;
  }>;
  recent_errors: Array<{
    timestamp: string;
    path: string;
    method: string;
    status_code: number;
    duration: number;
  }>;
  system_health: {
    status: string;
    error_rate: number;
  };
}

interface SystemStatusIndicatorProps {
  className?: string;
  /** Light compact row for UserBadge dropdown; default is dark dashboard pill. */
  variant?: 'dashboard' | 'menu';
}

const SystemStatusIndicator: React.FC<SystemStatusIndicatorProps> = ({
  className,
  variant = 'dashboard',
}) => {
  const [statusData, setStatusData] = useState<SystemStatusData | null>(null);
  const [detailedStats, setDetailedStats] = useState<DetailedStatsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [, setError] = useState<string | null>(null);
  const [dashboardOpen, setDashboardOpen] = useState(false);
  const [chartData, setChartData] = useState<any[]>([]);
  const [, setCachePerf] = useState<{ hits: number; misses: number; hit_rate: number } | null>(null);

  const fetchStatus = async () => {
    // Skip system status checks in feature-limited mode (endpoint not available)
    if (isFeatureOnlyMode()) {
      setStatusData({
        status: 'unknown',
        icon: '⚪',
        recent_requests: 0,
        recent_errors: 0,
        error_rate: 0,
        timestamp: new Date().toISOString()
      });
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const response = await apiClient.get('/api/content-planning/monitoring/lightweight-stats');
      const result = response.data;
      if (result.status === 'success') {
        setStatusData(result.data);
      } else {
        throw new Error(result.message || 'Failed to get system status');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setStatusData({
        status: 'unknown',
        icon: '⚪',
        recent_requests: 0,
        recent_errors: 0,
        error_rate: 0,
        timestamp: new Date().toISOString()
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchDetailedStats = async () => {
    // Skip detailed stats in feature-limited mode (endpoint not available)
    if (isFeatureOnlyMode()) {
      setChartData([]);
      return;
    }

    try {
      const response = await apiClient.get('/api/content-planning/monitoring/api-stats');
      const result = response?.data;
      
      // Validate response structure
      if (!result || result.status !== 'success' || !result.data) {
        console.warn('Invalid response structure from api-stats endpoint:', result);
        setChartData([]);
        return;
      }
      
      const data = result.data;
      setDetailedStats(data);
      
      if (data?.cache_performance) {
        setCachePerf(data.cache_performance);
        }
        
      // Generate chart data - safely handle missing top_endpoints
      if (data?.top_endpoints && Array.isArray(data.top_endpoints) && data.top_endpoints.length > 0) {
        try {
          const chartData = data.top_endpoints.slice(0, 5).map((endpoint: any) => ({
            name: endpoint?.endpoint?.split(' ')[1]?.split('/').pop() || 'API',
            requests: endpoint?.count || 0,
            avgTime: endpoint?.avg_time || 0,
            errors: endpoint?.errors || 0,
            hitRate: endpoint?.cache_hit_rate || 0
        }));
        setChartData(chartData);
        } catch (mapError) {
          console.error('Error mapping chart data:', mapError);
          setChartData([]);
        }
      } else {
        // If top_endpoints is missing or not an array, set empty chart data
        setChartData([]);
      }
    } catch (err) {
      console.error('Error fetching detailed stats:', err);
      setChartData([]);
    }
  };

  useEffect(() => {
    fetchStatus();
    // Skip detailed stats in feature-limited mode
    if (!isFeatureOnlyMode()) {
      fetchDetailedStats();
    }

    // Refresh every 120 seconds
    const interval = setInterval(fetchStatus, 120000);
    // Refresh detailed stats much less frequently in background (5 mins)
    const cacheInterval = setInterval(fetchDetailedStats, 300000);
    return () => {
      clearInterval(interval);
      clearInterval(cacheInterval);
    };
  }, []);

  useEffect(() => {
    if (dashboardOpen) {
      fetchDetailedStats();
      const interval = setInterval(fetchDetailedStats, 10000); // Refresh every 10 seconds when dashboard is open
      return () => clearInterval(interval);
    }
  }, [dashboardOpen]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <HealthyIcon sx={{ color: 'success.main', fontSize: 20 }} />;
      case 'warning':
        return <WarningIcon sx={{ color: 'warning.main', fontSize: 20 }} />;
      case 'critical':
        return <CriticalIcon sx={{ color: 'error.main', fontSize: 20 }} />;
      default:
        return <UnknownIcon sx={{ color: 'grey.500', fontSize: 20 }} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'success';
      case 'warning':
        return 'warning';
      case 'critical':
        return 'error';
      default:
        return 'default';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const tooltipContent = statusData ? (
    <Box sx={{ p: 1, maxWidth: 300 }}>
      <Typography variant="subtitle2" gutterBottom>
        System Status: {statusData.status.toUpperCase()}
      </Typography>
      <Typography variant="body2" sx={{ mb: 1 }}>
        Recent Requests: {statusData.recent_requests}
      </Typography>
      <Typography variant="body2" sx={{ mb: 1 }}>
        Recent Errors: {statusData.recent_errors}
      </Typography>
      <Typography variant="body2" sx={{ mb: 1 }}>
        Error Rate: {statusData.error_rate}%
      </Typography>
      <Typography variant="caption" color="text.secondary">
        Last Updated: {formatTimestamp(statusData.timestamp)}
      </Typography>
      <Typography variant="caption" color="primary" sx={{ display: 'block', mt: 1 }}>
        Click for detailed dashboard
      </Typography>
    </Box>
  ) : (
    <Typography>Loading system status...</Typography>
  );

  const isMenuVariant = variant === 'menu';

  const handleDashboardClick = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setDashboardOpen(true);
  };

  if (loading && !statusData) {
    return (
      <Box className={className} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <CircularProgress size={16} />
        <Typography variant="caption" sx={{ color: isMenuVariant ? '#6b7280' : 'inherit' }}>
          Checking system status…
        </Typography>
      </Box>
    );
  }

  const controlButtonSx = isMenuVariant
    ? {
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 1.25,
        py: 0.75,
        width: '100%',
        minHeight: 36,
        borderRadius: 1.5,
        justifyContent: 'flex-start',
        background: '#ffffff',
        borderColor: '#e5e7eb',
        color: '#1a1a2e',
        boxShadow: 'none',
        textTransform: 'none' as const,
        '&:hover': {
          background: '#f8fafc',
          borderColor: '#cbd5e1',
        },
      }
    : {
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 1,
        py: 0.5,
        minHeight: 34,
        borderRadius: 2,
        background: 'linear-gradient(180deg, rgba(255,255,255,0.18), rgba(255,255,255,0.1))',
        borderColor: 'rgba(255,255,255,0.35)',
        color: 'white',
        boxShadow: '0 10px 28px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.2)',
      };

  return (
    <>
      <Tooltip title={tooltipContent} arrow placement="bottom">
        <Button
          variant="outlined"
          onClick={handleDashboardClick}
          sx={controlButtonSx}
        >
          {statusData ? getStatusIcon(statusData.status) : <UnknownIcon sx={{ color: isMenuVariant ? 'grey.500' : 'grey.200' }} />}
          <Chip
            label={`System • ${(statusData?.status || 'unknown').toUpperCase()}`}
            size="small"
            color={getStatusColor(statusData?.status || 'unknown')}
            sx={{ height: 22, fontSize: '0.70rem' }}
          />
          <Box
            component="div"
            onClick={(e) => {
              e.stopPropagation();
              void fetchStatus();
              void fetchDetailedStats();
            }}
            sx={{
              ml: isMenuVariant ? 'auto' : 0.5,
              color: isMenuVariant ? '#0a66c2' : 'rgba(255,255,255,0.9)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 24,
              height: 24,
              borderRadius: '50%',
              '&:hover': {
                backgroundColor: isMenuVariant ? 'rgba(10, 102, 194, 0.08)' : 'rgba(255,255,255,0.1)',
              },
            }}
          >
            <RefreshIcon sx={{ fontSize: 16 }} />
          </Box>
        </Button>
      </Tooltip>

      {/* Enhanced Monitoring Dashboard */}
      <Dialog
        open={dashboardOpen}
        onClose={() => setDashboardOpen(false)}
        maxWidth="lg"
        fullWidth
        sx={{
          zIndex: 1400,
          '& .MuiDialog-paper': {
            borderRadius: 3,
            background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
            maxHeight: '90vh',
          },
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          borderRadius: '12px 12px 0 0'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <AnalyticsIcon />
            <Typography variant="h6">System Monitoring Dashboard</Typography>
            {statusData && (
              <Chip 
                label={statusData.status.toUpperCase()} 
                color={getStatusColor(statusData.status)}
                size="small"
                sx={{ color: 'white' }}
              />
            )}
          </Box>
          <IconButton onClick={() => setDashboardOpen(false)} sx={{ color: 'white' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 3, overflow: 'auto' }}>
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
            >
              {detailedStats ? (
                <MonitoringCharts
                  chartData={chartData}
                  cachePerformance={detailedStats.cache_performance}
                  apiPerformance={{
                    recent_requests: detailedStats.overview.recent_requests,
                    recent_errors: detailedStats.overview.recent_errors,
                    error_rate: detailedStats.system_health.error_rate
                  }}
                />
              ) : (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
                  <CircularProgress size={60} />
                </Box>
              )}

              {/* Recent Errors Section */}
              {detailedStats?.recent_errors && Array.isArray(detailedStats.recent_errors) && detailedStats.recent_errors.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 }}
                >
                  <Card sx={{ mt: 3, background: 'rgba(255,255,255,0.95)' }}>
                    <CardHeader
                      avatar={<Avatar sx={{ bgcolor: 'error.main' }}><BugReportIcon /></Avatar>}
                      title="Recent Errors"
                      subheader="Latest API errors and issues"
                    />
                    <CardContent>
                      <List>
                        {detailedStats.recent_errors.slice(0, 5).map((error, index) => (
                          <ListItem key={index} sx={{ border: '1px solid #f0f0f0', borderRadius: 1, mb: 1 }}>
                            <ListItemIcon>
                              <CriticalIcon color="error" />
                            </ListItemIcon>
                            <ListItemText
                              primary={`${error.method} ${error.path}`}
                              secondary={`Status: ${error.status_code} | Duration: ${error.duration.toFixed(3)}s | ${formatTimestamp(error.timestamp)}`}
                            />
                          </ListItem>
                        ))}
                      </List>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </motion.div>
          </AnimatePresence>
        </DialogContent>

        <DialogActions sx={{ p: 3, background: 'rgba(255,255,255,0.9)' }}>
          <Button 
            onClick={() => setDashboardOpen(false)}
            variant="outlined"
            startIcon={<CloseIcon />}
          >
            Close
          </Button>
          <Tooltip title={loading ? "Refreshing data..." : "Refresh monitoring data"}>
            <span>
          <Button 
            onClick={fetchDetailedStats}
            variant="contained"
            startIcon={<RefreshIcon />}
            disabled={loading}
          >
            Refresh Data
          </Button>
            </span>
          </Tooltip>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default SystemStatusIndicator;
