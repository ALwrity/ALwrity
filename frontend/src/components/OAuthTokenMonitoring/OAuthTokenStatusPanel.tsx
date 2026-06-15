/**
 * OAuth Token Status Panel
 * Displays OAuth token monitoring status for all platforms and allows manual refresh
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  Collapse,
} from '@mui/material';
import {
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
  Clock,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@clerk/clerk-react';
import {
  getOAuthTokenStatus,
  manualRefreshToken,
  OAuthTokenStatusResponse,
  ManualRefreshResponse,
} from '../../api/oauthTokenMonitoring';

interface OAuthTokenStatusPanelProps {
  userId?: string;
  compact?: boolean;
}

const OAuthTokenStatusPanel: React.FC<OAuthTokenStatusPanelProps> = ({ 
  userId,
  compact = false 
}) => {
  const { userId: clerkUserId } = useAuth();
  const actualUserId = userId || clerkUserId || '';
  
  const [status, setStatus] = useState<OAuthTokenStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedPlatform, setExpandedPlatform] = useState<string | null>(null);
  
  const fetchStatus = async () => {
    if (!actualUserId) return;
    
    try {
      setLoading(true);
      setError(null);
      const response = await getOAuthTokenStatus(actualUserId);
      setStatus(response);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch token status');
      console.error('Error fetching OAuth token status:', err);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    fetchStatus();
    
    // Poll for status updates every 2 minutes
    const interval = setInterval(fetchStatus, 120000);
    return () => clearInterval(interval);
  }, [actualUserId]);
  
  const handleRefresh = async (platform: string) => {
    if (!actualUserId) return;
    
    try {
      setRefreshing(platform);
      setError(null);
      const response: ManualRefreshResponse = await manualRefreshToken(actualUserId, platform);
      
      // Refresh status after manual refresh
      await fetchStatus();
      
      // Show success message
      if (response.success) {
        console.log(`Token refresh successful for ${platform}`);
      } else {
        console.error(`Token refresh failed for ${platform}:`, response.data.execution_result.error_message);
      }
    } catch (err: any) {
      setError(err.message || `Failed to refresh ${platform} token`);
      console.error(`Error refreshing ${platform} token:`, err);
    } finally {
      setRefreshing(null);
    }
  };
  
  const getStatusIcon = (taskStatus: string | null, connected: boolean) => {
    if (!connected) {
      return <XCircle size={20} color="#ef4444" />;
    }
    
    if (!taskStatus || taskStatus === 'not_created') {
      return <Info size={20} color="#3b82f6" />;
    }
    
    switch (taskStatus) {
      case 'active':
        return <CheckCircle size={20} color="#10b981" />;
      case 'failed':
        return <XCircle size={20} color="#ef4444" />;
      case 'paused':
        return <AlertTriangle size={20} color="#f59e0b" />;
      default:
        return <Info size={20} color="#6b7280" />;
    }
  };
  
  const getStatusColor = (taskStatus: string | null, connected: boolean) => {
    if (!connected) return 'error';
    if (!taskStatus || taskStatus === 'not_created') return 'info';
    if (taskStatus === 'active') return 'success';
    if (taskStatus === 'failed') return 'error';
    if (taskStatus === 'paused') return 'warning';
    return 'default';
  };
  
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch {
      return dateString;
    }
  };
  
  const getPlatformDisplayName = (platform: string) => {
    const names: { [key: string]: string } = {
      gsc: 'Google Search Console',
      bing: 'Bing Webmaster Tools',
      wordpress: 'WordPress',
      wix: 'Wix',
      linkedin: 'LinkedIn',
    };
    return names[platform] || platform.toUpperCase();
  };
  
  if (loading && !status) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }
  
  if (error && !status) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {error}
        <Button size="small" onClick={fetchStatus} sx={{ ml: 2 }}>
          Retry
        </Button>
      </Alert>
    );
  }
  
  if (!status) {
    return null;
  }
  
  const platforms = ['gsc', 'bing', 'wordpress', 'wix', 'linkedin'];
  
  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">OAuth Token Status</Typography>
          <Button
            size="small"
            startIcon={<RefreshCw size={16} />}
            onClick={fetchStatus}
            disabled={loading}
          >
            Refresh
          </Button>
        </Box>
        
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Platform</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Last Check</TableCell>
                <TableCell>Next Check</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {platforms.map((platform) => {
                const platformStatus = status.data.platform_status[platform];
                const task = platformStatus?.monitoring_task;
                
                return (
                  <React.Fragment key={platform}>
                    <TableRow>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          {getStatusIcon(task?.status || null, platformStatus?.connected || false)}
                          <Typography variant="body2" fontWeight="medium">
                            {getPlatformDisplayName(platform)}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={task?.status || (platformStatus?.connected ? 'Connected' : 'Not Connected')}
                          size="small"
                          color={getStatusColor(task?.status || null, platformStatus?.connected || false) as any}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {formatDate(task?.last_check || null)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {formatDate(task?.next_check || null)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Box display="flex" gap={1} justifyContent="flex-end">
                          <Tooltip title="View details">
                            <IconButton
                              size="small"
                              onClick={() => setExpandedPlatform(
                                expandedPlatform === platform ? null : platform
                              )}
                            >
                              {expandedPlatform === platform ? (
                                <ChevronUp size={16} />
                              ) : (
                                <ChevronDown size={16} />
                              )}
                            </IconButton>
                          </Tooltip>
                          {platformStatus?.connected && (
                            <Tooltip title="Manually refresh token">
                              <IconButton
                                size="small"
                                onClick={() => handleRefresh(platform)}
                                disabled={refreshing === platform}
                              >
                                {refreshing === platform ? (
                                  <CircularProgress size={16} />
                                ) : (
                                  <RefreshCw size={16} />
                                )}
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell colSpan={5} sx={{ py: 0, border: 0 }}>
                        <Collapse in={expandedPlatform === platform}>
                          <Box p={2} bgcolor="grey.50">
                            {task?.failure_reason && (
                              <Alert severity="error" sx={{ mb: 1 }}>
                                <Typography variant="body2" fontWeight="bold">
                                  Last Failure:
                                </Typography>
                                <Typography variant="body2">
                                  {task.failure_reason}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {formatDate(task.last_failure || null)}
                                </Typography>
                              </Alert>
                            )}
                            {task?.last_success && (
                              <Alert severity="success" sx={{ mb: 1 }}>
                                <Typography variant="body2">
                                  Last successful check: {formatDate(task.last_success)}
                                </Typography>
                              </Alert>
                            )}
                            {!task && platformStatus?.connected && (
                              <Alert severity="info">
                                <Typography variant="body2">
                                  Platform is connected but no monitoring task exists.
                                  Monitoring tasks are created automatically after onboarding.
                                </Typography>
                              </Alert>
                            )}
                            {!platformStatus?.connected && (
                              <Alert severity="warning">
                                <Typography variant="body2">
                                  Platform is not connected. Connect it in onboarding step 5.
                                </Typography>
                              </Alert>
                            )}
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );
};

export default OAuthTokenStatusPanel;

