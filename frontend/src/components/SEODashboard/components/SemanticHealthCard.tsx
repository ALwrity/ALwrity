import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Chip,
  IconButton,
  Tooltip,
  Skeleton,
  Alert,
  Button
} from '@mui/material';
import SpeedIcon from '@mui/icons-material/Speed';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import InfoIcon from '@mui/icons-material/Info';
import { motion } from 'framer-motion';
import { GlassCard, ShimmerHeader } from '../../shared/styled';
import { semanticDashboardAPI } from '../../../api/semanticDashboard';
import { SemanticHealthMetric } from '../../../api/semanticDashboard';

interface SemanticHealthCardProps {
  className?: string;
  onRefresh?: () => void;
  compact?: boolean;
}

const SemanticHealthCard: React.FC<SemanticHealthCardProps> = ({ 
  className, 
  onRefresh, 
  compact = false 
}) => {
  const [semanticHealth, setSemanticHealth] = useState<SemanticHealthMetric | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  // Fetch semantic health data
  const fetchSemanticHealth = async () => {
    try {
      setLoading(true);
      setError(null);
      const health = await semanticDashboardAPI.getSemanticHealth();
      setSemanticHealth(health);
      setLastUpdated(new Date().toISOString());
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch semantic health';
      setError(errorMessage);
      console.error('Error fetching semantic health:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch data on component mount
  useEffect(() => {
    fetchSemanticHealth();
  }, []);

  // Auto-refresh every 24 hours (86400000ms)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchSemanticHealth();
    }, 86400000); // 24 hours

    return () => clearInterval(interval);
  }, []);

  const handleRefresh = async () => {
    if (onRefresh) {
      onRefresh();
    }
    await fetchSemanticHealth();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return '#4CAF50';
      case 'warning': return '#FF9800';
      case 'critical': return '#F44336';
      default: return '#9E9E9E';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircleIcon sx={{ color: '#4CAF50' }} />;
      case 'warning':
        return <WarningIcon sx={{ color: '#FF9800' }} />;
      case 'critical':
        return <ErrorIcon sx={{ color: '#F44336' }} />;
      default:
        return <InfoIcon sx={{ color: '#9E9E9E' }} />;
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

  if (error && !compact) {
    return (
      <GlassCard className={className}>
        <CardContent>
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
          <Box display="flex" gap={1}>
            <Button 
              variant="outlined" 
              onClick={handleRefresh}
              disabled={loading}
              startIcon={<RefreshIcon />}
              size="small"
            >
              Retry
            </Button>
          </Box>
        </CardContent>
      </GlassCard>
    );
  }

  if (compact) {
    return (
      <Card 
        sx={{ 
          background: 'rgba(255,255,255,0.05)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 2
        }}
        className={className}
      >
        <CardContent sx={{ p: 2 }}>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Box display="flex" alignItems="center" gap={1}>
              <SpeedIcon sx={{ color: '#64B5F6', fontSize: 20 }} />
              <Typography variant="subtitle2" sx={{ color: 'white' }}>
                Semantic Health
              </Typography>
            </Box>
            <Box display="flex" alignItems="center" gap={1}>
              {semanticHealth && getStatusIcon(semanticHealth.status)}
              {semanticHealth && (
                <Typography variant="h6" sx={{ color: 'white' }}>
                  {Math.round(semanticHealth.value * 100)}%
                </Typography>
              )}
              <Tooltip title="Refresh">
                <IconButton 
                  onClick={handleRefresh} 
                  disabled={loading}
                  sx={{ color: 'rgba(255,255,255,0.7)', p: 0.5 }}
                  size="small"
                >
                  <RefreshIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
          
          {loading && !semanticHealth && (
            <LinearProgress sx={{ mt: 1, height: 2 }} />
          )}
          
          {semanticHealth && (
            <LinearProgress
              variant="determinate"
              value={semanticHealth.value * 100}
              sx={{
                mt: 1,
                height: 2,
                borderRadius: 1,
                backgroundColor: 'rgba(255,255,255,0.2)',
                '& .MuiLinearProgress-bar': {
                  backgroundColor: getStatusColor(semanticHealth.status),
                  borderRadius: 1
                }
              }}
            />
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <GlassCard className={className}>
      <ShimmerHeader />
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Box display="flex" alignItems="center" gap={1}>
            <SpeedIcon sx={{ color: '#64B5F6' }} />
            <Typography variant="h6" sx={{ color: 'white', fontWeight: 600 }}>
              Semantic Health
            </Typography>
          </Box>
          <Box display="flex" alignItems="center" gap={1}>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
              {formatLastUpdated(lastUpdated)}
            </Typography>
            <Tooltip title="Refresh semantic analysis">
              <IconButton 
                onClick={handleRefresh} 
                disabled={loading}
                sx={{ color: 'rgba(255,255,255,0.7)' }}
              >
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>
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
                      backgroundColor: getStatusColor(semanticHealth.status),
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
  );
};

export default SemanticHealthCard;
