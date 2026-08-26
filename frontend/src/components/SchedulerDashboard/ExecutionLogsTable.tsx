/**
 * Execution Logs Table Component
 * Displays task execution logs in a table with pagination and filtering.
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Table,
  TableBody,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  IconButton,
  Tooltip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import ScheduleIcon from '@mui/icons-material/Schedule';
import RefreshIcon from '@mui/icons-material/Refresh';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { getExecutionLogs, getRecentSchedulerLogs, ExecutionLog, ExecutionLogsResponse } from '../../api/schedulerDashboard';
import { 
  TerminalPaper, 
  TerminalTypography, 
  TerminalChipSuccess, 
  TerminalChipError, 
  TerminalChipWarning, 
  TerminalTableCell, 
  TerminalTableRow,
  TerminalAlert,
  terminalColors 
} from './terminalTheme';

interface ExecutionLogsTableProps {
  initialLimit?: number;
}

const ExecutionLogsTable: React.FC<ExecutionLogsTableProps> = ({ initialLimit = 50 }) => {
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(initialLimit);
  const [totalCount, setTotalCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState<'success' | 'failed' | 'running' | 'skipped' | 'all'>('all');
  const [isShowingSchedulerLogs, setIsShowingSchedulerLogs] = useState(false);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // First, try to fetch actual execution logs
      const response = await getExecutionLogs(
        rowsPerPage,
        page * rowsPerPage,
        statusFilter === 'all' ? undefined : statusFilter
      );
      
      console.log('📋 Execution Logs Response:', JSON.stringify({
        logsCount: response.logs?.length || 0,
        totalCount: response.total_count,
        hasLogs: !!(response.logs && response.logs.length > 0),
        isSchedulerLogs: response.is_scheduler_logs,
        firstLog: response.logs?.[0] || null
      }, null, 2));
      
      // If we have actual execution logs, use them
      if (response.logs && response.logs.length > 0 && !response.is_scheduler_logs) {
        console.log('✅ Using execution logs:', response.logs.length);
        setLogs(response.logs);
        setTotalCount(response.total_count || 0);
        setIsShowingSchedulerLogs(false);
      } else {
        // No execution logs available, fetch scheduler logs as fallback (latest 5 only)
        console.log('📋 No execution logs found, fetching latest scheduler logs...');
        try {
          const schedulerLogsResponse = await getRecentSchedulerLogs();
          console.log('📋 Scheduler Logs Response:', JSON.stringify({
            logsCount: schedulerLogsResponse.logs?.length || 0,
            totalCount: schedulerLogsResponse.total_count,
            isSchedulerLogs: schedulerLogsResponse.is_scheduler_logs,
            allLogs: schedulerLogsResponse.logs || []
          }, null, 2));
          
          if (schedulerLogsResponse.logs && schedulerLogsResponse.logs.length > 0) {
            console.log('✅ Setting scheduler logs:', schedulerLogsResponse.logs.length, 'logs');
            setLogs(schedulerLogsResponse.logs);
            setTotalCount(schedulerLogsResponse.total_count || 0);
            setIsShowingSchedulerLogs(true);
          } else {
            console.warn('⚠️ Scheduler logs response is empty');
            setLogs([]);
            setTotalCount(0);
            setIsShowingSchedulerLogs(false);
          }
        } catch (schedulerErr: any) {
          console.error('❌ Error fetching scheduler logs:', schedulerErr);
          setLogs([]);
          setTotalCount(0);
          setIsShowingSchedulerLogs(false);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch execution logs');
      console.error('❌ Error fetching execution logs:', err);
      
      // Try to fetch scheduler logs as fallback even on error (latest 5 only)
      try {
        const schedulerLogsResponse = await getRecentSchedulerLogs();
        setLogs(schedulerLogsResponse.logs || []);
        setTotalCount(schedulerLogsResponse.total_count || 0);
        setIsShowingSchedulerLogs(true);
      } catch (schedulerErr: any) {
        console.error('❌ Error fetching scheduler logs:', schedulerErr);
        setLogs([]);
        setTotalCount(0);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, rowsPerPage, statusFilter]); // fetchLogs is stable, no need to include

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircleIcon fontSize="small" color="success" />;
      case 'failed':
        return <ErrorIcon fontSize="small" color="error" />;
      case 'running':
        return <ScheduleIcon fontSize="small" color="primary" />;
      default:
        return <ScheduleIcon fontSize="small" />;
    }
  };

  const getStatusColor = (status: string): "success" | "error" | "warning" | "default" => {
    switch (status) {
      case 'success':
        return 'success';
      case 'failed':
        return 'error';
      case 'running':
        return 'warning';
      default:
        return 'default';
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch {
      return dateString;
    }
  };

  const formatExecutionTime = (ms: number | null) => {
    if (!ms) return 'N/A';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  return (
    <TerminalPaper sx={{ p: 3 }}>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <Box display="flex" alignItems="center" gap={1}>
          <ScheduleIcon sx={{ color: terminalColors.primary }} />
          <TerminalTypography variant="h6" component="h2" sx={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
            Execution Logs
          </TerminalTypography>
          {isShowingSchedulerLogs && (
            <TerminalChipWarning 
              label="Showing Scheduler Logs" 
              size="small"
              sx={{ ml: 1 }}
            />
          )}
        </Box>
        <Box display="flex" alignItems="center" gap={2}>
          <FormControl 
            size="small" 
            sx={{ 
              minWidth: 120,
              '& .MuiOutlinedInput-root': {
                color: terminalColors.primary,
                '& fieldset': {
                  borderColor: terminalColors.primary,
                },
                '&:hover fieldset': {
                  borderColor: terminalColors.secondary,
                },
              },
              '& .MuiInputLabel-root': {
                color: terminalColors.textSecondary,
              },
              '& .MuiSelect-icon': {
                color: terminalColors.primary,
              }
            }}
          >
            <InputLabel>Status</InputLabel>
            <Select
              value={statusFilter}
              label="Status"
              onChange={(e) => {
                setStatusFilter(e.target.value as any);
                setPage(0);
              }}
              MenuProps={{
                PaperProps: {
                  sx: {
                    backgroundColor: terminalColors.backgroundLight,
                    border: `1px solid ${terminalColors.primary}`,
                    '& .MuiMenuItem-root': {
                      color: terminalColors.primary,
                      fontFamily: 'monospace',
                      '&:hover': {
                        backgroundColor: 'rgba(0, 255, 0, 0.1)',
                      },
                      '&.Mui-selected': {
                        backgroundColor: 'rgba(0, 255, 0, 0.15)',
                      }
                    }
                  }
                }
              }}
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="success">Success</MenuItem>
              <MenuItem value="failed">Failed</MenuItem>
              <MenuItem value="running">Running</MenuItem>
              <MenuItem value="skipped">Skipped</MenuItem>
            </Select>
          </FormControl>
          <Tooltip title="Refresh logs">
            <IconButton 
              onClick={fetchLogs} 
              size="small"
              sx={{ 
                color: terminalColors.primary,
                border: `1px solid ${terminalColors.primary}`,
                '&:hover': {
                  backgroundColor: 'rgba(0, 255, 0, 0.1)',
                }
              }}
            >
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {error && (
        <TerminalAlert severity="error" sx={{ mb: 2 }}>
          {error}
        </TerminalAlert>
      )}

      {loading ? (
        <Box display="flex" justifyContent="center" p={3}>
          <CircularProgress sx={{ color: terminalColors.primary }} />
        </Box>
      ) : (
        <>
          {isShowingSchedulerLogs && (
            <TerminalAlert severity="info" sx={{ mb: 2 }}>
              <TerminalTypography variant="body2" sx={{ fontSize: '0.875rem' }}>
                Showing latest 5 scheduler activity logs (job scheduling, completion, failures). 
                Historical execution logs are available in the Event History section below.
              </TerminalTypography>
            </TerminalAlert>
          )}
          <TableContainer 
            sx={{ 
              backgroundColor: terminalColors.background,
              maxHeight: '600px',
              overflow: 'auto'
            }}
          >
            <Table size="small" sx={{ minWidth: 650 }}>
              <TableHead>
                <TerminalTableRow>
                  <TerminalTableCell sx={{ fontWeight: 'bold', color: terminalColors.primary }}>Task</TerminalTableCell>
                  <TerminalTableCell sx={{ fontWeight: 'bold', color: terminalColors.primary }}>Status</TerminalTableCell>
                  <TerminalTableCell sx={{ fontWeight: 'bold', color: terminalColors.primary }}>Execution Time</TerminalTableCell>
                  <TerminalTableCell sx={{ fontWeight: 'bold', color: terminalColors.primary }}>Duration</TerminalTableCell>
                  <TerminalTableCell sx={{ fontWeight: 'bold', color: terminalColors.primary }}>User ID</TerminalTableCell>
                  <TerminalTableCell sx={{ fontWeight: 'bold', color: terminalColors.primary }}>Date</TerminalTableCell>
                  <TerminalTableCell sx={{ fontWeight: 'bold', color: terminalColors.primary }}>Error</TerminalTableCell>
                </TerminalTableRow>
              </TableHead>
              <TableBody>
                {(() => {
                  // Debug logging
                  if (logs.length > 0) {
                    console.log('🔍 Rendering logs table:', {
                      logsCount: logs.length,
                      loading,
                      isShowingSchedulerLogs,
                      firstLogId: logs[0]?.id,
                      firstLogStatus: logs[0]?.status
                    });
                  }
                  return null;
                })()}
                {logs.length === 0 && !loading ? (
                  <TerminalTableRow>
                    <TerminalTableCell colSpan={7} align="center">
                      <Box sx={{ py: 4, textAlign: 'center' }}>
                        <ScheduleIcon sx={{ color: terminalColors.textSecondary, fontSize: 48, mb: 2, opacity: 0.5 }} />
                        <TerminalTypography variant="body2" sx={{ color: terminalColors.primary, mb: 1, fontWeight: 'bold' }}>
                          {isShowingSchedulerLogs ? 'No Scheduler Logs Yet' : 'No Execution Logs Yet'}
                        </TerminalTypography>
                        <TerminalTypography variant="body2" sx={{ color: terminalColors.textSecondary, mb: 1 }}>
                          {isShowingSchedulerLogs 
                            ? 'Scheduler activity logs (job scheduling, restoration, etc.) will appear here when the scheduler starts or schedules jobs.'
                            : 'Execution logs will appear here once the scheduler runs and executes tasks.'}
                        </TerminalTypography>
                        <TerminalTypography variant="caption" sx={{ color: terminalColors.textSecondary, fontSize: '0.75rem', fontStyle: 'italic', display: 'block' }}>
                          {isShowingSchedulerLogs
                            ? 'These logs show scheduler activity (job restoration, scheduling) when actual task execution logs are not available.'
                            : 'The scheduler checks for due tasks every 60 minutes (or based on active strategies).'}
                          {!isShowingSchedulerLogs && totalCount === 0 && ' Currently, no tasks have been executed yet.'}
                        </TerminalTypography>
                      </Box>
                    </TerminalTableCell>
                  </TerminalTableRow>
                ) : loading ? (
                  <TerminalTableRow>
                    <TerminalTableCell colSpan={7} align="center">
                      <Box sx={{ py: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 2 }}>
                        <CircularProgress size={24} sx={{ color: terminalColors.primary }} />
                        <TerminalTypography variant="body2" sx={{ color: terminalColors.textSecondary }}>
                          Loading execution logs...
                        </TerminalTypography>
                      </Box>
                    </TerminalTableCell>
                  </TerminalTableRow>
                ) : (
                  logs.map((log) => {
                    // Debug: log each row being rendered
                    if (log.id === logs[0]?.id) {
                      console.log('🎯 Rendering first log row:', log.id, log.status, log.task?.task_title);
                    }
                    return (
                      <TerminalTableRow 
                        key={log.id}
                        sx={{
                          backgroundColor: terminalColors.background,
                          color: terminalColors.primary,
                          '&:hover': {
                            backgroundColor: 'rgba(0, 255, 0, 0.1)',
                          }
                        }}
                      >
                      <TerminalTableCell sx={{ color: terminalColors.primary }}>
                        <Box>
                          <TerminalTypography variant="body2" fontWeight="medium" sx={{ fontSize: '0.875rem' }}>
                            {log.is_scheduler_log 
                              ? (log.task?.task_title || `Scheduler Event: ${log.event_type || 'unknown'}`)
                              : (log.task?.task_title || `Task #${log.task_id}`)
                            }
                          </TerminalTypography>
                          {log.is_scheduler_log && log.job_id && (
                            <TerminalTypography variant="caption" sx={{ fontSize: '0.7rem', color: terminalColors.textSecondary, display: 'block', mt: 0.5 }}>
                              Job ID: {log.job_id}
                            </TerminalTypography>
                          )}
                          {!log.is_scheduler_log && log.task?.component_name && (
                            <TerminalTypography variant="caption" sx={{ color: terminalColors.textSecondary, fontSize: '0.75rem' }}>
                              {log.task.component_name}
                            </TerminalTypography>
                          )}
                          {log.is_scheduler_log && log.task?.metric && (
                            <TerminalTypography variant="caption" sx={{ color: terminalColors.textSecondary, fontSize: '0.75rem' }}>
                              Function: {log.task.metric}
                            </TerminalTypography>
                          )}
                        </Box>
                      </TerminalTableCell>
                      <TerminalTableCell sx={{ color: terminalColors.primary }}>
                        {log.status === 'success' ? (
                          <TerminalChipSuccess
                            icon={getStatusIcon(log.status)}
                            label={log.status}
                            size="small"
                          />
                        ) : log.status === 'failed' ? (
                          <TerminalChipError
                            icon={getStatusIcon(log.status)}
                            label={log.status}
                            size="small"
                          />
                        ) : (
                          <TerminalChipWarning
                            icon={getStatusIcon(log.status)}
                            label={log.status}
                            size="small"
                          />
                        )}
                      </TerminalTableCell>
                      <TerminalTableCell sx={{ color: terminalColors.primary }}>
                        <TerminalTypography variant="body2" sx={{ fontSize: '0.875rem', color: terminalColors.primary }}>
                          {formatExecutionTime(log.execution_time_ms)}
                        </TerminalTypography>
                      </TerminalTableCell>
                      <TerminalTableCell sx={{ color: terminalColors.primary }}>
                        <TerminalTypography variant="body2" sx={{ fontSize: '0.875rem', color: terminalColors.primary }}>
                          {log.execution_date ? formatDate(log.execution_date) : 'N/A'}
                        </TerminalTypography>
                      </TerminalTableCell>
                      <TerminalTableCell sx={{ color: terminalColors.primary }}>
                        {log.user_id ? (
                          <TerminalTypography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.875rem', color: terminalColors.primary }}>
                            {String(log.user_id).substring(0, 12)}...
                          </TerminalTypography>
                        ) : (
                          <TerminalTypography variant="body2" sx={{ color: terminalColors.textSecondary, fontSize: '0.875rem' }}>
                            System
                          </TerminalTypography>
                        )}
                      </TerminalTableCell>
                      <TerminalTableCell sx={{ color: terminalColors.primary }}>
                        <TerminalTypography variant="body2" sx={{ fontSize: '0.875rem', color: terminalColors.primary }}>
                          {formatDate(log.created_at)}
                        </TerminalTypography>
                      </TerminalTableCell>
                      <TerminalTableCell sx={{ color: terminalColors.primary }}>
                        {log.error_message ? (
                          <Tooltip title={log.error_message} arrow>
                            <TerminalTypography
                              variant="body2"
                              sx={{
                                fontSize: '0.875rem',
                                color: terminalColors.error,
                                maxWidth: 300,
                                wordBreak: 'break-word',
                                wordWrap: 'break-word',
                                overflowWrap: 'break-word',
                                whiteSpace: 'normal',
                                overflow: 'hidden',
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                cursor: 'help'
                              }}
                            >
                              {log.error_message}
                            </TerminalTypography>
                          </Tooltip>
                        ) : (
                          <TerminalTypography variant="body2" sx={{ color: terminalColors.textSecondary, fontSize: '0.875rem' }}>
                            -
                          </TerminalTypography>
                        )}
                      </TerminalTableCell>
                    </TerminalTableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Only show pagination for actual execution logs, not scheduler logs */}
          {!isShowingSchedulerLogs && logs.length > 0 && (
            <TablePagination
              component="div"
              count={totalCount}
              page={page}
              onPageChange={handleChangePage}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              rowsPerPageOptions={[10, 25, 50, 100]}
              sx={{
                color: terminalColors.primary,
                '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
                  color: terminalColors.textSecondary,
                  fontFamily: 'monospace',
                },
              '& .MuiTablePagination-select': {
                color: terminalColors.primary,
                fontFamily: 'monospace',
              },
              '& .MuiIconButton-root': {
                color: terminalColors.primary,
                '&:hover': {
                  backgroundColor: 'rgba(0, 255, 0, 0.1)',
                }
              },
              '& .MuiIconButton-root.Mui-disabled': {
                color: terminalColors.textSecondary,
                opacity: 0.3,
              }
            }}
            />
          )}
          
          {/* Info message for scheduler logs */}
          {isShowingSchedulerLogs && logs.length > 0 && (
            <Box mt={2}>
              <TerminalTypography variant="caption" sx={{ color: terminalColors.textSecondary, fontSize: '0.75rem', fontStyle: 'italic' }}>
                Displaying latest 5 scheduler activity logs. Only the most recent logs are shown here.
              </TerminalTypography>
            </Box>
          )}
        </>
      )}
    </TerminalPaper>
  );
};

export default ExecutionLogsTable;

