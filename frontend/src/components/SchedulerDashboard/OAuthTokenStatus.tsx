/**
 * OAuth Token Status Component
 * Compact terminal-themed component for displaying OAuth token monitoring status
 * with platform-specific execution logs in expanded sections
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  CircularProgress,
  Collapse,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Chip,
  Divider,
} from '@mui/material';
import {
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import {
  getOAuthTokenStatus,
  manualRefreshToken,
  getOAuthTokenExecutionLogs,
  OAuthTokenStatusResponse,
  ManualRefreshResponse,
  ExecutionLog,
  ExecutionLogsResponse,
} from '../../api/oauthTokenMonitoring';
import {
  TerminalPaper,
  TerminalTypography,
  TerminalChip,
  TerminalChipSuccess,
  TerminalChipError,
  TerminalChipWarning,
  TerminalAlert,
  TerminalTableCell,
  TerminalTableRow,
  terminalColors,
} from './terminalTheme';

interface OAuthTokenStatusProps {
  compact?: boolean;
}

interface PlatformLogs {
  [platform: string]: {
    logs: ExecutionLog[];
    loading: boolean;
    error: string | null;
  };
}

const OAuthTokenStatus: React.FC<OAuthTokenStatusProps> = ({ compact = true }) => {
  const { userId } = useAuth();
  const [status, setStatus] = useState<OAuthTokenStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedPlatform, setExpandedPlatform] = useState<string | null>(null);
  const [platformLogs, setPlatformLogs] = useState<PlatformLogs>({});
  const [hoveredLogId, setHoveredLogId] = useState<number | null>(null);
  
  const fetchStatus = async () => {
    if (!userId) return;
    
    try {
      setLoading(true);
      setError(null);
      const response = await getOAuthTokenStatus(userId);
      setStatus(response);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch token status');
      console.error('Error fetching OAuth token status:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const fetchPlatformLogs = async (platform: string) => {
    if (!userId) return;
    
    // Initialize platform logs state if not exists
    if (!platformLogs[platform]) {
      setPlatformLogs(prev => ({
        ...prev,
        [platform]: { logs: [], loading: false, error: null }
      }));
    }
    
    setPlatformLogs(prev => ({
      ...prev,
      [platform]: { ...prev[platform], loading: true, error: null }
    }));
    
    try {
      const response = await getOAuthTokenExecutionLogs(userId, platform, 10, 0); // Get latest 10 logs
      
      if (response.success && response.data) {
        setPlatformLogs(prev => ({
          ...prev,
          [platform]: {
            logs: response.data.logs || [],
            loading: false,
            error: null
          }
        }));
      }
    } catch (err: any) {
      setPlatformLogs(prev => ({
        ...prev,
        [platform]: {
          ...prev[platform],
          loading: false,
          error: err.message || 'Failed to fetch logs'
        }
      }));
      console.error(`Error fetching logs for ${platform}:`, err);
    }
  };
  
  useEffect(() => {
    fetchStatus();
    
    // Poll for status updates every 2 minutes
    const interval = setInterval(fetchStatus, 120000);
    return () => clearInterval(interval);
  }, [userId]);

  // Fetch logs when platform is expanded
  useEffect(() => {
    if (expandedPlatform && userId) {
      fetchPlatformLogs(expandedPlatform);
    }
  }, [expandedPlatform, userId]);
  
  const handleRefresh = async (platform: string) => {
    if (!userId) return;
    
    try {
      setRefreshing(platform);
      setError(null);
      const response: ManualRefreshResponse = await manualRefreshToken(userId, platform);
      
      // Refresh status after manual refresh
      await fetchStatus();
      
      // Refresh logs if platform is expanded
      if (expandedPlatform === platform) {
        await fetchPlatformLogs(platform);
      }
      
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

  const handleExpandPlatform = (platform: string) => {
    if (expandedPlatform === platform) {
      setExpandedPlatform(null);
    } else {
      setExpandedPlatform(platform);
    }
  };
  
  const getStatusIcon = (taskStatus: string | null, connected: boolean) => {
    if (!connected) {
      return <XCircle size={16} color={terminalColors.error} />;
    }
    
    if (!taskStatus || taskStatus === 'not_created') {
      return <Info size={16} color={terminalColors.info} />;
    }
    
    switch (taskStatus) {
      case 'active':
        return <CheckCircle size={16} color={terminalColors.success} />;
      case 'failed':
        return <XCircle size={16} color={terminalColors.error} />;
      case 'paused':
        return <AlertTriangle size={16} color={terminalColors.warning} />;
      default:
        return <Info size={16} color={terminalColors.primary} />;
    }
  };
  
  const getStatusChip = (taskStatus: string | null, connected: boolean) => {
    if (!connected) {
      return <TerminalChipError label="Not Connected" size="small" />;
    }
    
    if (!taskStatus || taskStatus === 'not_created') {
      return <TerminalChip label={taskStatus || 'Not Created'} size="small" />;
    }
    
    switch (taskStatus) {
      case 'active':
        return <TerminalChipSuccess label="Active" size="small" />;
      case 'failed':
        return <TerminalChipError label="Failed" size="small" />;
      case 'paused':
        return <TerminalChipWarning label="Paused" size="small" />;
      default:
        return <TerminalChip label={taskStatus} size="small" />;
    }
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
      gsc: 'GSC',
      bing: 'Bing',
      wordpress: 'WP',
      wix: 'Wix',
      linkedin: 'LinkedIn',
    };
    return names[platform] || platform.toUpperCase();
  };

  const getLogStatusChip = (logStatus: string) => {
    switch (logStatus) {
      case 'success':
        return <TerminalChipSuccess label="Success" size="small" />;
      case 'failed':
        return <TerminalChipError label="Failed" size="small" />;
      case 'running':
        return <TerminalChipWarning label="Running" size="small" />;
      default:
        return <Chip label={logStatus} size="small" />;
    }
  };

  const formatLogResult = (resultData: any): string => {
    if (!resultData) return 'N/A';
    if (typeof resultData === 'string') {
      try {
        resultData = JSON.parse(resultData);
      } catch {
        return resultData.substring(0, 50);
      }
    }
    
    if (resultData.token_status) {
      return `Token: ${resultData.token_status}`;
    }
    if (resultData.platform) {
      return `Platform: ${resultData.platform}`;
    }
    const str = JSON.stringify(resultData);
    return str.length > 60 ? str.substring(0, 60) + '...' : str;
  };
  
  if (loading && !status) {
    return (
      <TerminalPaper sx={{ p: 2 }}>
        <Box display="flex" justifyContent="center" alignItems="center" p={2}>
          <CircularProgress size={20} sx={{ color: terminalColors.primary }} />
        </Box>
      </TerminalPaper>
    );
  }
  
  if (!status) {
    return null;
  }
  
  const platforms = ['gsc', 'bing', 'wordpress', 'wix', 'linkedin'];
  
  return (
    <TerminalPaper sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <TerminalTypography variant="h6" component="h3">
          OAuth Token Status
        </TerminalTypography>
        <Tooltip title="Refresh status">
          <IconButton
            size="small"
            onClick={fetchStatus}
            disabled={loading}
            sx={{
              color: terminalColors.primary,
              border: `1px solid ${terminalColors.primary}`,
              '&:hover': {
                backgroundColor: 'rgba(0, 255, 0, 0.1)',
              },
              '&:disabled': {
                color: '#004400',
                borderColor: '#004400',
              }
            }}
          >
            <RefreshCw size={16} />
          </IconButton>
        </Tooltip>
      </Box>
      
      {error && (
        <TerminalAlert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </TerminalAlert>
      )}
      
      <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        <Table size="small" sx={{ '& .MuiTableCell-root': { color: terminalColors.primary, borderColor: terminalColors.primary + '40' } }}>
          <TableHead>
            <TableRow>
              <TableCell>Platform</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Last Check</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {platforms.map((platform) => {
              const platformStatus = status.data.platform_status[platform];
              const task = platformStatus?.monitoring_task;
              const isExpanded = expandedPlatform === platform;
              const logs = platformLogs[platform];
              
              return (
                <React.Fragment key={platform}>
                  <TableRow
                    sx={{
                      cursor: 'pointer',
                      '&:hover': {
                        backgroundColor: 'rgba(0, 255, 0, 0.05)',
                      }
                    }}
                  >
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1}>
                        {getStatusIcon(task?.status || null, platformStatus?.connected || false)}
                        <TerminalTypography variant="body2" fontWeight="medium">
                          {getPlatformDisplayName(platform)}
                        </TerminalTypography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                        {getStatusChip(task?.status || null, platformStatus?.connected || false)}
                        {task?.last_success && (
                          <Tooltip title={`Last successful: ${formatDate(task.last_success)}`}>
                            <Chip
                              label={`✓ ${formatDate(task.last_success).split(',')[0].trim()}`}
                              size="small"
                              sx={{
                                backgroundColor: terminalColors.success + '40',
                                color: terminalColors.success,
                                fontFamily: 'monospace',
                                fontSize: '0.65rem',
                                height: '20px',
                                border: `1px solid ${terminalColors.success}40`,
                                '& .MuiChip-label': {
                                  padding: '0 6px'
                                }
                              }}
                            />
                          </Tooltip>
                        )}
                        {task?.next_check && (
                          <Tooltip title={`Next check: ${formatDate(task.next_check)}`}>
                            <Chip
                              label={`⏱ ${formatDate(task.next_check).split(',')[0].trim()}`}
                              size="small"
                              sx={{
                                backgroundColor: terminalColors.info + '40',
                                color: terminalColors.info,
                                fontFamily: 'monospace',
                                fontSize: '0.65rem',
                                height: '20px',
                                border: `1px solid ${terminalColors.info}40`,
                                '& .MuiChip-label': {
                                  padding: '0 6px'
                                }
                              }}
                            />
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <TerminalTypography variant="caption" color={terminalColors.textSecondary}>
                        {formatDate(task?.last_check || null)}
                      </TerminalTypography>
                    </TableCell>
                    <TableCell align="right">
                      <Box display="flex" gap={0.5} justifyContent="flex-end">
                        <Tooltip title={isExpanded ? "Hide details" : "Show details"}>
                          <IconButton
                            size="small"
                            onClick={() => handleExpandPlatform(platform)}
                            sx={{
                              color: terminalColors.primary,
                              '&:hover': {
                                backgroundColor: 'rgba(0, 255, 0, 0.1)',
                              }
                            }}
                          >
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </IconButton>
                        </Tooltip>
                        {platformStatus?.connected && (
                          <Tooltip title="Manually refresh token">
                            <IconButton
                              size="small"
                              onClick={() => handleRefresh(platform)}
                              disabled={refreshing === platform}
                              sx={{
                                color: terminalColors.primary,
                                '&:hover': {
                                  backgroundColor: 'rgba(0, 255, 0, 0.1)',
                                },
                                '&:disabled': {
                                  color: '#004400',
                                }
                              }}
                            >
                              {refreshing === platform ? (
                                <CircularProgress size={14} sx={{ color: terminalColors.primary }} />
                              ) : (
                                <RefreshCw size={14} />
                              )}
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={4} sx={{ py: 0, border: 0 }}>
                      <Collapse in={isExpanded}>
                        <Box p={2} sx={{ backgroundColor: 'rgba(0, 255, 0, 0.05)', borderLeft: `2px solid ${terminalColors.primary}` }}>
                          {task?.failure_reason && (
                            <TerminalAlert severity="error" sx={{ mb: 1 }}>
                              <TerminalTypography variant="body2" fontWeight="bold">
                                Last Failure:
                              </TerminalTypography>
                              <TerminalTypography variant="body2">
                                {task.failure_reason}
                              </TerminalTypography>
                              <TerminalTypography variant="caption" color={terminalColors.textSecondary}>
                                {formatDate(task.last_failure || null)}
                              </TerminalTypography>
                            </TerminalAlert>
                          )}
                          {/* OAuth Monitoring Logs Section */}
                          {platformStatus?.connected && (
                            <>
                              <Divider sx={{ my: 1.5, borderColor: terminalColors.primary + '40' }} />
                              <TerminalTypography variant="subtitle2" fontWeight="bold" mb={1}>
                                🔐 Monitoring Logs
                              </TerminalTypography>
                              
                              {logs?.loading ? (
                                <Box display="flex" alignItems="center" gap={1} p={1}>
                                  <CircularProgress size={16} sx={{ color: terminalColors.primary }} />
                                  <TerminalTypography variant="caption" color={terminalColors.textSecondary}>
                                    Loading logs...
                                  </TerminalTypography>
                                </Box>
                              ) : logs?.error ? (
                                <TerminalAlert severity="error" sx={{ mb: 1 }}>
                                  <TerminalTypography variant="caption">
                                    {logs.error}
                                  </TerminalTypography>
                                </TerminalAlert>
                              ) : logs?.logs && logs.logs.length > 0 ? (
                                <Box sx={{ 
                                  maxHeight: '300px', 
                                  overflowY: 'auto',
                                  overflowX: 'hidden',
                                  '&::-webkit-scrollbar': {
                                    width: '8px',
                                  },
                                  '&::-webkit-scrollbar-track': {
                                    backgroundColor: 'rgba(0, 255, 0, 0.05)',
                                  },
                                  '&::-webkit-scrollbar-thumb': {
                                    backgroundColor: terminalColors.primary + '80',
                                    borderRadius: '4px',
                                    '&:hover': {
                                      backgroundColor: terminalColors.primary,
                                    }
                                  }
                                }}>
                                  <Table size="small" sx={{ 
                                    '& .MuiTableCell-root': { 
                                      color: terminalColors.primary, 
                                      borderColor: terminalColors.primary + '30',
                                      fontSize: '0.7rem',
                                      py: 0.5
                                    } 
                                  }}>
                                    <TableHead sx={{ position: 'sticky', top: 0, zIndex: 1, backgroundColor: 'rgba(0, 0, 0, 0.8)' }}>
                                      <TableRow>
                                        <TerminalTableCell>Date</TerminalTableCell>
                                        <TerminalTableCell>Status</TerminalTableCell>
                                        <TerminalTableCell>Result</TerminalTableCell>
                                        <TerminalTableCell>Duration</TerminalTableCell>
                                      </TableRow>
                                    </TableHead>
                                    <TableBody>
                                      {logs.logs.map((log) => (
                                        <React.Fragment key={log.id}>
                                          <TerminalTableRow
                                            onMouseEnter={() => setHoveredLogId(log.id)}
                                            onMouseLeave={() => setHoveredLogId(null)}
                                            sx={{
                                              cursor: 'pointer',
                                              '&:hover': {
                                                backgroundColor: 'rgba(0, 255, 0, 0.1)',
                                              }
                                            }}
                                          >
                                            <TerminalTableCell>
                                              <TerminalTypography variant="caption" fontSize="0.65rem">
                                                {formatDate(log.execution_date)}
                                              </TerminalTypography>
                                            </TerminalTableCell>
                                            <TerminalTableCell>
                                              {getLogStatusChip(log.status)}
                                            </TerminalTableCell>
                                            <TerminalTableCell>
                                              <TerminalTypography variant="caption" fontSize="0.65rem" sx={{
                                                fontFamily: 'monospace',
                                                color: terminalColors.info,
                                                maxWidth: '200px',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap'
                                              }}>
                                                {formatLogResult(log.result_data)}
                                              </TerminalTypography>
                                            </TerminalTableCell>
                                            <TerminalTableCell>
                                              <TerminalTypography variant="caption" fontSize="0.65rem">
                                                {log.execution_time_ms ? `${log.execution_time_ms}ms` : 'N/A'}
                                              </TerminalTypography>
                                            </TerminalTableCell>
                                          </TerminalTableRow>
                                          {hoveredLogId === log.id && (
                                            <TableRow>
                                              <TableCell colSpan={4} sx={{ py: 1, backgroundColor: 'rgba(0, 255, 0, 0.08)', borderLeft: `3px solid ${terminalColors.primary}` }}>
                                                <Box pl={2}>
                                                  <TerminalTypography variant="caption" fontWeight="bold" mb={0.5} display="block">
                                                    Full Details:
                                                  </TerminalTypography>
                                                  {log.error_message && (
                                                    <Box mb={1}>
                                                      <TerminalTypography variant="caption" fontWeight="bold" color={terminalColors.error} display="block" mb={0.5}>
                                                        Error:
                                                      </TerminalTypography>
                                                      <TerminalTypography variant="caption" fontSize="0.6rem" sx={{
                                                        fontFamily: 'monospace',
                                                        color: terminalColors.error,
                                                        wordBreak: 'break-word'
                                                      }}>
                                                        {log.error_message}
                                                      </TerminalTypography>
                                                    </Box>
                                                  )}
                                                  {log.result_data && (
                                                    <Box>
                                                      <TerminalTypography variant="caption" fontWeight="bold" color={terminalColors.info} display="block" mb={0.5}>
                                                        Result Data:
                                                      </TerminalTypography>
                                                      <TerminalTypography variant="caption" fontSize="0.6rem" sx={{
                                                        fontFamily: 'monospace',
                                                        color: terminalColors.info,
                                                        wordBreak: 'break-word',
                                                        whiteSpace: 'pre-wrap'
                                                      }}>
                                                        {typeof log.result_data === 'string' ? log.result_data : JSON.stringify(log.result_data, null, 2)}
                                                      </TerminalTypography>
                                                    </Box>
                                                  )}
                                                </Box>
                                              </TableCell>
                                            </TableRow>
                                          )}
                                        </React.Fragment>
                                      ))}
                                    </TableBody>
                                  </Table>
                                  {logs.logs.length >= 10 && (
                                    <Box mt={1} textAlign="center">
                                      <TerminalTypography variant="caption" color={terminalColors.textSecondary} sx={{ fontStyle: 'italic' }}>
                                        Showing latest 10 logs. View all logs in OAuth Monitoring section.
                                      </TerminalTypography>
                                    </Box>
                                  )}
                                </Box>
                              ) : (
                                <TerminalTypography variant="caption" color={terminalColors.textSecondary} sx={{ fontStyle: 'italic' }}>
                                  No monitoring logs available yet. Logs will appear after the first scheduled check.
                                </TerminalTypography>
                              )}
                            </>
                          )}

                          {/* Existing connection status messages */}
                          {!task && platformStatus?.connected && (
                            <TerminalAlert severity="info">
                              <TerminalTypography variant="body2">
                                Connected but no monitoring task. Create one manually or wait for onboarding completion.
                              </TerminalTypography>
                            </TerminalAlert>
                          )}
                          {!platformStatus?.connected && (
                            <TerminalAlert severity="warning">
                              <TerminalTypography variant="body2">
                                Not connected. Connect in onboarding step 5.
                              </TerminalTypography>
                            </TerminalAlert>
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
      </Box>
    </TerminalPaper>
  );
};

export default OAuthTokenStatus;

