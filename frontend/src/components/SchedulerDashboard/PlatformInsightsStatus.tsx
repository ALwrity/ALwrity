/**
 * Platform Insights Status Component
 * Compact terminal-themed component for displaying platform insights (GSC/Bing) task status
 * with execution logs in expanded sections
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
  Search,
  Globe,
} from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import {
  getPlatformInsightsStatus,
  getPlatformInsightsLogs,
  ensurePlatformInsightsTasks,
  PlatformInsightsStatusResponse,
  PlatformInsightsTask,
  PlatformInsightsExecutionLog,
  PlatformInsightsLogsResponse,
} from '../../api/platformInsightsMonitoring';
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

interface PlatformInsightsStatusProps {
  compact?: boolean;
}

interface TaskLogs {
  [taskId: number]: {
    logs: PlatformInsightsExecutionLog[];
    loading: boolean;
    error: string | null;
  };
}

const PlatformInsightsStatus: React.FC<PlatformInsightsStatusProps> = ({ compact = true }) => {
  const { userId } = useAuth();
  const [status, setStatus] = useState<PlatformInsightsStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedTaskId, setExpandedTaskId] = useState<number | null>(null);
  const [taskLogs, setTaskLogs] = useState<TaskLogs>({});
  const [hoveredLogId, setHoveredLogId] = useState<number | null>(null);
  
  const fetchStatus = async () => {
    if (!userId) return;

    try {
      setLoading(true);
      setError(null);
      const response = await getPlatformInsightsStatus(userId);
      // C2: GET is now strictly read-only. If the server reports missing
      // platforms (user has connected integrations but no tracking tasks
      // yet), POST to the dedicated ensure-tasks endpoint to create them.
      // We re-fetch afterwards so the UI shows the freshly created tasks.
      if (response.missing_platforms && response.missing_platforms.length > 0) {
        try {
          const ensured = await ensurePlatformInsightsTasks(userId);
          setStatus(ensured);
        } catch (ensureErr: any) {
          console.error('Failed to ensure platform insights tasks:', ensureErr);
          // Fall back to the read-only response; the missing platforms
          // are still surfaced so the user knows what's pending.
          setStatus(response);
        }
      } else {
        setStatus(response);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch platform insights status');
      console.error('Error fetching platform insights status:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const fetchTaskLogs = async (taskId: number) => {
    if (!userId) return;
    
    // Initialize task logs state if not exists
    if (!taskLogs[taskId]) {
      setTaskLogs(prev => ({
        ...prev,
        [taskId]: { logs: [], loading: true, error: null }
      }));
    } else {
      setTaskLogs(prev => ({
        ...prev,
        [taskId]: { ...prev[taskId], loading: true, error: null }
      }));
    }
    
    try {
      console.log(`[PlatformInsights] Fetching logs for task ${taskId}...`);
      const response = await getPlatformInsightsLogs(userId, 10, taskId);
      console.log(`[PlatformInsights] Received logs response:`, {
        success: response.success,
        logsCount: response.logs?.length || 0,
        totalCount: response.total_count,
        hasLogs: !!(response.logs && response.logs.length > 0),
        firstLog: response.logs?.[0] || null
      });
      
      if (response.success && response.logs && Array.isArray(response.logs)) {
        setTaskLogs(prev => ({
          ...prev,
          [taskId]: {
            logs: response.logs,
            loading: false,
            error: null
          }
        }));
      } else {
        console.warn(`[PlatformInsights] Invalid logs response structure:`, response);
        setTaskLogs(prev => ({
          ...prev,
          [taskId]: {
            logs: prev[taskId]?.logs || [],
            loading: false,
            error: response.success === false ? 'Failed to fetch logs' : 'Invalid response structure'
          }
        }));
      }
    } catch (err: any) {
      console.error(`[PlatformInsights] Error fetching logs for task ${taskId}:`, err);
      setTaskLogs(prev => ({
        ...prev,
        [taskId]: {
          logs: prev[taskId]?.logs || [],
          loading: false,
          error: err.message || 'Failed to fetch logs'
        }
      }));
    }
  };
  
  const handleToggleExpand = (taskId: number) => {
    if (expandedTaskId === taskId) {
      setExpandedTaskId(null);
    } else {
      setExpandedTaskId(taskId);
      // Always fetch logs when expanding to get latest data
      fetchTaskLogs(taskId);
    }
  };
  
  useEffect(() => {
    fetchStatus();
    // Refresh every 5 minutes (same as other dashboard components)
    // Tasks only run weekly, so frequent polling is unnecessary
    const interval = setInterval(fetchStatus, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [userId]);

  // Fetch logs when task is expanded (similar to OAuth pattern)
  useEffect(() => {
    if (expandedTaskId && userId) {
      fetchTaskLogs(expandedTaskId);
    }
  }, [expandedTaskId, userId]);
  
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch {
      return dateString;
    }
  };
  
  const formatDuration = (ms: number | null) => {
    if (!ms) return 'N/A';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };
  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle size={16} color={terminalColors.success} />;
      case 'failed':
        return <XCircle size={16} color={terminalColors.error} />;
      case 'paused':
        return <AlertTriangle size={16} color={terminalColors.warning} />;
      default:
        return <Info size={16} color={terminalColors.info} />;
    }
  };
  
  const getStatusChip = (status: string) => {
    switch (status) {
      case 'active':
        return <TerminalChipSuccess label="Active" />;
      case 'failed':
        return <TerminalChipError label="Failed" />;
      case 'paused':
        return <TerminalChipWarning label="Paused" />;
      default:
        return <TerminalChip label={status} />;
    }
  };
  
  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'gsc':
        return <Search size={16} />;
      case 'bing':
        return <Globe size={16} />;
      default:
        return <Info size={16} />;
    }
  };
  
  const getPlatformName = (platform: string) => {
    switch (platform) {
      case 'gsc':
        return 'Google Search Console';
      case 'bing':
        return 'Bing Webmaster Tools';
      default:
        return platform.toUpperCase();
    }
  };
  
  const allTasks = [
    ...(status?.gsc_tasks || []).map(t => ({ ...t, platform: 'gsc' as const })),
    ...(status?.bing_tasks || []).map(t => ({ ...t, platform: 'bing' as const }))
  ];
  
  if (loading && !status) {
    return (
      <TerminalPaper>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2 }}>
          <CircularProgress size={20} sx={{ color: terminalColors.success }} />
          <TerminalTypography>Loading platform insights tasks...</TerminalTypography>
        </Box>
      </TerminalPaper>
    );
  }
  
  if (error) {
    return (
      <TerminalPaper>
        <TerminalAlert severity="error" sx={{ m: 2 }}>
          {error}
        </TerminalAlert>
      </TerminalPaper>
    );
  }
  
  if (!status || allTasks.length === 0) {
    return (
      <TerminalPaper>
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <TerminalTypography variant="body1" sx={{ mb: 1 }}>
            No platform insights tasks found.
          </TerminalTypography>
          <TerminalTypography variant="body2" sx={{ color: terminalColors.textSecondary }}>
            Connect GSC or Bing in onboarding Step 5 to create insights tasks.
          </TerminalTypography>
        </Box>
      </TerminalPaper>
    );
  }
  
  return (
    <TerminalPaper>
      <Box sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Search size={20} color={terminalColors.primary} />
            <TerminalTypography variant="h6">
              Platform Insights Tasks
            </TerminalTypography>
            <TerminalChip label={`${allTasks.length} tasks`} />
          </Box>
          <IconButton
            onClick={fetchStatus}
            disabled={loading}
            sx={{
              color: terminalColors.primary,
              border: `1px solid ${terminalColors.border}`,
              '&:hover': {
                backgroundColor: terminalColors.backgroundHover,
              }
            }}
          >
            <RefreshCw size={16} />
          </IconButton>
        </Box>
        
        <Divider sx={{ borderColor: terminalColors.border, mb: 2 }} />
        
        <Table size="small">
          <TableHead>
            <TableRow>
              <TerminalTableCell sx={{ width: '5%', fontSize: '0.75rem' }} />
              <TerminalTableCell sx={{ width: '15%', fontSize: '0.75rem' }}>Platform</TerminalTableCell>
              <TerminalTableCell sx={{ width: '30%', fontSize: '0.75rem' }}>Site URL</TerminalTableCell>
              <TerminalTableCell sx={{ width: '15%', fontSize: '0.75rem' }}>Status</TerminalTableCell>
              <TerminalTableCell sx={{ width: '35%', fontSize: '0.75rem' }}>Timing</TerminalTableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {allTasks.map((task) => {
              const isExpanded = expandedTaskId === task.id;
              const logs = taskLogs[task.id];
              
              return (
                <React.Fragment key={task.id}>
                  <TerminalTableRow
                    sx={{
                      cursor: 'pointer',
                      '&:hover': {
                        backgroundColor: terminalColors.backgroundHover,
                      }
                    }}
                    onClick={() => handleToggleExpand(task.id)}
                  >
                    <TerminalTableCell sx={{ width: '5%' }}>
                      <IconButton size="small" sx={{ color: terminalColors.primary }}>
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </IconButton>
                    </TerminalTableCell>
                    <TerminalTableCell sx={{ width: '15%' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {getPlatformIcon(task.platform)}
                        <Typography sx={{ fontFamily: 'inherit', color: terminalColors.text, fontSize: '0.875rem' }}>
                          {getPlatformName(task.platform)}
                        </Typography>
                      </Box>
                    </TerminalTableCell>
                    <TerminalTableCell sx={{ width: '30%' }}>
                      {task.site_url ? (
                        <Typography
                          sx={{
                            fontFamily: 'inherit',
                            color: terminalColors.textSecondary,
                            fontSize: '0.75rem',
                            maxWidth: 200,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {task.site_url}
                        </Typography>
                      ) : (
                        <Typography sx={{ fontFamily: 'inherit', color: terminalColors.textSecondary, fontSize: '0.75rem' }}>
                          Default site
                        </Typography>
                      )}
                    </TerminalTableCell>
                    <TerminalTableCell sx={{ width: '15%' }}>
                      {getStatusChip(task.status)}
                    </TerminalTableCell>
                    <TerminalTableCell sx={{ width: '35%' }}>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        {task.last_success && (
                          <Tooltip title={`Last successful: ${formatDate(task.last_success)}`}>
                            <Chip
                              label="Success"
                              size="small"
                              sx={{
                                backgroundColor: terminalColors.background,
                                color: terminalColors.success,
                                border: `1px solid ${terminalColors.success}`,
                                fontSize: '0.65rem',
                                height: 20,
                                fontFamily: 'inherit'
                              }}
                            />
                          </Tooltip>
                        )}
                        {task.next_check && (
                          <Tooltip title={`Next check: ${formatDate(task.next_check)}`}>
                            <Chip
                              label="Scheduled"
                              size="small"
                              sx={{
                                backgroundColor: terminalColors.background,
                                color: terminalColors.info,
                                border: `1px solid ${terminalColors.info}`,
                                fontSize: '0.65rem',
                                height: 20,
                                fontFamily: 'inherit'
                              }}
                            />
                          </Tooltip>
                        )}
                      </Box>
                    </TerminalTableCell>
                  </TerminalTableRow>
                  <TableRow>
                    <TableCell colSpan={5} sx={{ py: 0, border: 0 }}>
                      <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                <Box sx={{ p: 2, backgroundColor: terminalColors.backgroundSecondary }}>
                  {task.failure_reason && (
                    <TerminalAlert severity="error" sx={{ mb: 2 }}>
                      Error: {task.failure_reason}
                    </TerminalAlert>
                  )}
                  
                  <TerminalTypography variant="subtitle2" sx={{ mb: 1 }}>
                    Execution Logs
                  </TerminalTypography>
                  
                  {logs?.loading ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 2 }}>
                      <CircularProgress size={16} sx={{ color: terminalColors.success }} />
                      <TerminalTypography variant="body2">Loading logs...</TerminalTypography>
                    </Box>
                  ) : logs?.error ? (
                    <TerminalAlert severity="error" sx={{ mb: 2 }}>
                      {logs.error}
                    </TerminalAlert>
                  ) : logs?.logs && logs.logs.length > 0 ? (
                    <Box
                      sx={{
                        maxHeight: 300,
                        overflowY: 'auto',
                        border: `1px solid ${terminalColors.border}`,
                        borderRadius: 1,
                      }}
                    >
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TerminalTableCell>Date</TerminalTableCell>
                            <TerminalTableCell>Status</TerminalTableCell>
                            <TerminalTableCell>Source</TerminalTableCell>
                            <TerminalTableCell>Duration</TerminalTableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {logs.logs.map((log) => (
                            <React.Fragment key={log.id}>
                              <TerminalTableRow
                                sx={{
                                  '&:hover': {
                                    backgroundColor: terminalColors.backgroundHover,
                                  },
                                  cursor: 'pointer',
                                }}
                                onMouseEnter={() => setHoveredLogId(log.id)}
                                onMouseLeave={() => setHoveredLogId(null)}
                              >
                                <TerminalTableCell>
                                  {formatDate(log.execution_date)}
                                </TerminalTableCell>
                                <TerminalTableCell>
                                  {log.status === 'success' ? (
                                    <TerminalChipSuccess label="Success" />
                                  ) : log.status === 'failed' ? (
                                    <TerminalChipError label="Failed" />
                                  ) : (
                                    <TerminalChip label={log.status} />
                                  )}
                                </TerminalTableCell>
                                <TerminalTableCell>
                                  <Chip
                                    label={log.data_source || 'N/A'}
                                    size="small"
                                    sx={{
                                      backgroundColor: terminalColors.background,
                                      color: terminalColors.textSecondary,
                                      border: `1px solid ${terminalColors.border}`,
                                      fontSize: '0.65rem',
                                      height: 18,
                                      fontFamily: 'inherit'
                                    }}
                                  />
                                </TerminalTableCell>
                                <TerminalTableCell>
                                  {formatDuration(log.execution_time_ms)}
                                </TerminalTableCell>
                              </TerminalTableRow>
                              {hoveredLogId === log.id && (
                                <TableRow>
                                  <TableCell colSpan={4} sx={{ py: 1, border: 0, backgroundColor: terminalColors.backgroundSecondary }}>
                                    {log.error_message && (
                                      <Box sx={{ mb: 1 }}>
                                        <TerminalTypography variant="caption" sx={{ color: terminalColors.error, fontWeight: 'bold' }}>
                                          Error:
                                        </TerminalTypography>
                                        <TerminalTypography variant="caption" sx={{ color: terminalColors.text, ml: 1 }}>
                                          {log.error_message}
                                        </TerminalTypography>
                                      </Box>
                                    )}
                                    {log.result_data && (
                                      <Box>
                                        <TerminalTypography variant="caption" sx={{ color: terminalColors.info, fontWeight: 'bold' }}>
                                          Result:
                                        </TerminalTypography>
                                        <Box
                                          component="pre"
                                          sx={{
                                            fontFamily: 'inherit',
                                            fontSize: '0.7rem',
                                            color: terminalColors.textSecondary,
                                            backgroundColor: terminalColors.background,
                                            p: 1,
                                            borderRadius: 1,
                                            overflow: 'auto',
                                            maxHeight: 150,
                                            mt: 0.5,
                                            border: `1px solid ${terminalColors.border}`,
                                          }}
                                        >
                                          {JSON.stringify(log.result_data, null, 2)}
                                        </Box>
                                      </Box>
                                    )}
                                  </TableCell>
                                </TableRow>
                              )}
                            </React.Fragment>
                          ))}
                        </TableBody>
                      </Table>
                    </Box>
                  ) : (
                    <TerminalTypography variant="body2" sx={{ color: terminalColors.textSecondary, p: 2 }}>
                      No execution logs yet.
                    </TerminalTypography>
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

export default PlatformInsightsStatus;

