/**
 * Usage Logs Table Component
 * Displays API usage logs in a table with pagination and filtering.
 * Terminal-themed UI matching scheduler dashboard style.
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
import RefreshIcon from '@mui/icons-material/Refresh';
import ReceiptIcon from '@mui/icons-material/Receipt';
import { billingService } from '../../services/billingService';
import { UsageLog, UsageLogsResponse } from '../../types/billing';
import { 
  TerminalPaper, 
  TerminalTypography, 
  TerminalChipSuccess, 
  TerminalChipError, 
  TerminalTableCell, 
  TerminalTableRow,
  TerminalAlert,
  terminalColors 
} from '../SchedulerDashboard/terminalTheme';
import { formatCurrency } from '../../services/billingService';

interface UsageLogsTableProps {
  initialLimit?: number;
}

const UsageLogsTable: React.FC<UsageLogsTableProps> = ({ initialLimit = 50 }) => {
  const [logs, setLogs] = useState<UsageLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(initialLimit);
  const [totalCount, setTotalCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState<'success' | 'failed' | 'all'>('all');
  const [providerFilter, setProviderFilter] = useState<string>('all');

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const statusCode = statusFilter === 'all' ? undefined : (statusFilter === 'success' ? 200 : 400);
      const provider = providerFilter === 'all' ? undefined : providerFilter;
      
      const response: UsageLogsResponse = await billingService.getUsageLogs(
        rowsPerPage,
        page * rowsPerPage,
        provider,
        statusCode
      );
      
      setLogs(response.logs || []);
      setTotalCount(response.total_count || 0);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch usage logs');
      console.error('Error fetching usage logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, rowsPerPage, statusFilter, providerFilter]);

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const getStatusIcon = (status: string): React.ReactElement | undefined => {
    switch (status) {
      case 'success':
        return <CheckCircleIcon fontSize="small" sx={{ color: terminalColors.success }} />;
      case 'failed':
        return <ErrorIcon fontSize="small" sx={{ color: terminalColors.error }} />;
      default:
        return undefined;
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

  const formatResponseTime = (seconds: number) => {
    if (!seconds) return 'N/A';
    const ms = seconds * 1000;
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    return `${seconds.toFixed(2)}s`;
  };

  const formatTokens = (tokens: number) => {
    return new Intl.NumberFormat('en-US').format(tokens);
  };

  return (
    <TerminalPaper sx={{ p: 3 }}>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <Box display="flex" alignItems="center" gap={1}>
          <ReceiptIcon sx={{ color: terminalColors.primary }} />
          <TerminalTypography variant="h6" component="h2" sx={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
            API Usage Logs
          </TerminalTypography>
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
            <InputLabel>Provider</InputLabel>
            <Select
              value={providerFilter}
              label="Provider"
              onChange={(e) => {
                setProviderFilter(e.target.value);
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
              <MenuItem value="gemini">Gemini</MenuItem>
              <MenuItem value="huggingface">HuggingFace</MenuItem>
            </Select>
          </FormControl>
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
          <TableContainer 
            sx={{ 
              backgroundColor: terminalColors.background,
              maxHeight: '600px',
              overflow: 'auto'
            }}
          >
            <Table size="small" sx={{ minWidth: 800 }}>
              <TableHead>
                <TerminalTableRow>
                  <TerminalTableCell sx={{ fontWeight: 'bold', color: terminalColors.primary }}>Timestamp</TerminalTableCell>
                  <TerminalTableCell sx={{ fontWeight: 'bold', color: terminalColors.primary }}>Provider</TerminalTableCell>
                  <TerminalTableCell sx={{ fontWeight: 'bold', color: terminalColors.primary }}>Model</TerminalTableCell>
                  <TerminalTableCell sx={{ fontWeight: 'bold', color: terminalColors.primary }}>Tokens</TerminalTableCell>
                  <TerminalTableCell sx={{ fontWeight: 'bold', color: terminalColors.primary }}>Cost</TerminalTableCell>
                  <TerminalTableCell sx={{ fontWeight: 'bold', color: terminalColors.primary }}>Status</TerminalTableCell>
                  <TerminalTableCell sx={{ fontWeight: 'bold', color: terminalColors.primary }}>Response Time</TerminalTableCell>
                  <TerminalTableCell sx={{ fontWeight: 'bold', color: terminalColors.primary }}>Endpoint</TerminalTableCell>
                </TerminalTableRow>
              </TableHead>
              <TableBody>
                {logs.length === 0 ? (
                  <TerminalTableRow>
                    <TerminalTableCell colSpan={8} align="center">
                      <Box sx={{ py: 4, textAlign: 'center' }}>
                        <ReceiptIcon sx={{ color: terminalColors.textSecondary, fontSize: 48, mb: 2, opacity: 0.5 }} />
                        <TerminalTypography variant="body2" sx={{ color: terminalColors.primary, mb: 1, fontWeight: 'bold' }}>
                          No Usage Logs Yet
                        </TerminalTypography>
                        <TerminalTypography variant="body2" sx={{ color: terminalColors.textSecondary }}>
                          API usage logs will appear here once you start making API calls.
                        </TerminalTypography>
                      </Box>
                    </TerminalTableCell>
                  </TerminalTableRow>
                ) : (
                  logs.map((log) => (
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
                      <TerminalTableCell>
                        <TerminalTypography variant="body2" sx={{ fontSize: '0.75rem' }}>
                          {formatDate(log.timestamp)}
                        </TerminalTypography>
                      </TerminalTableCell>
                      <TerminalTableCell>
                        <TerminalTypography variant="body2" sx={{ textTransform: 'capitalize', fontWeight: 'bold' }}>
                          {log.provider}
                        </TerminalTypography>
                      </TerminalTableCell>
                      <TerminalTableCell>
                        <TerminalTypography variant="body2" sx={{ fontSize: '0.75rem' }}>
                          {log.model_used || 'N/A'}
                        </TerminalTypography>
                      </TerminalTableCell>
                      <TerminalTableCell>
                        <TerminalTypography variant="body2">
                          {formatTokens(log.tokens_total)}
                        </TerminalTypography>
                      </TerminalTableCell>
                      <TerminalTableCell>
                        <TerminalTypography variant="body2">
                          {formatCurrency(log.cost_total)}
                        </TerminalTypography>
                      </TerminalTableCell>
                      <TerminalTableCell>
                        {log.status === 'success' ? (
                          <TerminalChipSuccess
                            icon={getStatusIcon(log.status) || undefined}
                            label={`${log.status_code}`}
                            size="small"
                          />
                        ) : (
                          <TerminalChipError
                            icon={getStatusIcon(log.status) || undefined}
                            label={`${log.status_code}`}
                            size="small"
                          />
                        )}
                      </TerminalTableCell>
                      <TerminalTableCell>
                        <TerminalTypography variant="body2" sx={{ fontSize: '0.75rem' }}>
                          {formatResponseTime(log.response_time)}
                        </TerminalTypography>
                      </TerminalTableCell>
                      <TerminalTableCell>
                        <Tooltip title={log.endpoint || ''}>
                          <TerminalTypography variant="body2" sx={{ fontSize: '0.75rem', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {log.is_aggregated ? (
                              <span style={{ color: terminalColors.warning, fontStyle: 'italic' }}>
                                [AGGREGATED] {log.error_message || 'Historical data'}
                              </span>
                            ) : (
                              `${log.method} ${log.endpoint?.substring(0, 30)}...`
                            )}
                          </TerminalTypography>
                        </Tooltip>
                      </TerminalTableCell>
                    </TerminalTableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
          
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
              borderTop: `1px solid ${terminalColors.primary}`,
              '& .MuiTablePagination-toolbar': {
                color: terminalColors.primary,
              },
              '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
                color: terminalColors.primary,
                fontFamily: 'monospace',
              },
              '& .MuiIconButton-root': {
                color: terminalColors.primary,
                '&:hover': {
                  backgroundColor: 'rgba(0, 255, 0, 0.1)',
                },
                '&.Mui-disabled': {
                  color: terminalColors.textSecondary,
                }
              },
              '& .MuiSelect-root': {
                color: terminalColors.primary,
                borderColor: terminalColors.primary,
              }
            }}
          />
        </>
      )}
    </TerminalPaper>
  );
};

export default UsageLogsTable;

