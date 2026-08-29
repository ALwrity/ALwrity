/**
 * Subscription Renewal History Component
 * Displays historical subscription renewals with details about plan changes, renewals, and usage.
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
  CircularProgress,
  Chip,
  Typography,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import AddIcon from '@mui/icons-material/Add';
import { RefreshCw } from 'lucide-react'; // Use lucide-react for header icon
import { billingService } from '../../services/billingService';
import { SubscriptionRenewal, RenewalHistoryResponse } from '../../types/billing';
import {
  TerminalPaper,
  TerminalTypography,
  TerminalTableCell,
  TerminalTableRow,
  TerminalAlert,
  TerminalChip,
  TerminalChipSuccess,
  TerminalChipWarning,
  TerminalChipError,
  terminalColors
} from '../SchedulerDashboard/terminalTheme';
import { showToastNotification } from '../../utils/toastNotifications';

interface SubscriptionRenewalHistoryProps {
  userId: string;
  terminalTheme?: boolean;
  initialLimit?: number;
}

const SubscriptionRenewalHistory: React.FC<SubscriptionRenewalHistoryProps> = ({
  userId,
  terminalTheme = false,
  initialLimit = 20
}) => {
  const [renewals, setRenewals] = useState<SubscriptionRenewal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(initialLimit);
  const [totalCount, setTotalCount] = useState(0);

  const fetchRenewals = async () => {
    try {
      setLoading(true);
      setError(null);

      const response: RenewalHistoryResponse = await billingService.getRenewalHistory(
        userId,
        rowsPerPage,
        page * rowsPerPage
      );

      setRenewals(response.renewals || []);
      setTotalCount(response.total_count || 0);
      
      // Don't show success toast on automatic refresh - only show errors
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to fetch renewal history';
      setError(errorMessage);
      console.error('Error fetching renewal history:', err);
      
      // Show error toast
      showToastNotification(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRenewals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, rowsPerPage, userId]);

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Invalid Date';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const getRenewalTypeIcon = (type: string): React.ReactElement | undefined => {
    switch (type) {
      case 'upgrade':
        return <TrendingUpIcon fontSize="small" sx={{ color: terminalTheme ? terminalColors.success : '#4ade80' }} />;
      case 'downgrade':
        return <TrendingDownIcon fontSize="small" sx={{ color: terminalTheme ? terminalColors.warning : '#f59e0b' }} />;
      case 'renewal':
        return <RefreshIcon fontSize="small" sx={{ color: terminalTheme ? terminalColors.primary : '#3b82f6' }} />;
      case 'new':
        return <AddIcon fontSize="small" sx={{ color: terminalTheme ? terminalColors.primary : '#3b82f6' }} />;
      default:
        return undefined;
    }
  };

  const getRenewalTypeChip = (type: string) => {
    const ChipComponent = terminalTheme ? TerminalChip : Chip;
    const chipStyles = {
      upgrade: { backgroundColor: 'rgba(34, 197, 94, 0.2)', color: '#22c55e' },
      downgrade: { backgroundColor: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b' },
      renewal: { backgroundColor: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6' },
      new: { backgroundColor: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6' },
    };
    
    const chipStyle = chipStyles[type as keyof typeof chipStyles] || chipStyles.renewal;
    const label = type.charAt(0).toUpperCase() + type.slice(1);
    const icon = getRenewalTypeIcon(type);
    
    if (terminalTheme) {
      const TerminalChipComponent = type === 'upgrade' ? TerminalChipSuccess :
                                   type === 'downgrade' ? TerminalChipWarning :
                                   TerminalChip;
      return (
        <TerminalChipComponent
          label={label}
          size="small"
          icon={icon}
          sx={{ fontWeight: 500 }}
        />
      );
    }
    
    return (
      <Chip
        label={label}
        size="small"
        icon={icon}
        sx={{
          ...chipStyle,
          fontWeight: 500,
          border: `1px solid ${chipStyle.color}40`
        }}
      />
    );
  };

  // Conditional component selection based on terminal theme
  const PaperComponent = terminalTheme ? TerminalPaper : Box;
  
  // Alert component wrapper for terminal theme
  const AlertWrapper: React.FC<{ children: React.ReactNode; severity?: 'error' | 'info' | 'warning'; sx?: any }> = ({ children, severity = 'info', sx }) => {
    if (terminalTheme) {
      return (
        <TerminalAlert severity={severity} sx={sx}>
          {children}
        </TerminalAlert>
      );
    }
    return (
      <Box sx={{ 
        p: 2, 
        backgroundColor: severity === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)', 
        borderRadius: 2, 
        color: severity === 'error' ? '#ef4444' : '#3b82f6',
        ...sx 
      }}>
        {children}
      </Box>
    );
  };

  return (
    <PaperComponent sx={{ p: 3, mt: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {terminalTheme ? (
            <RefreshCw size={20} color={terminalColors.primary} />
          ) : (
            <RefreshCw size={20} />
          )}
          {terminalTheme ? (
            <TerminalTypography variant="h6" sx={{ fontWeight: 'bold' }}>
              Subscription Renewal History
            </TerminalTypography>
          ) : (
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              Subscription Renewal History
            </Typography>
          )}
        </Box>
        <Tooltip title="Refresh Renewal History">
          <IconButton 
            onClick={fetchRenewals} 
            disabled={loading}
            sx={{ color: terminalTheme ? terminalColors.primary : 'inherit' }}
          >
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {loading && renewals.length === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
          <CircularProgress sx={{ color: terminalTheme ? terminalColors.primary : 'inherit' }} />
        </Box>
      ) : error ? (
        <AlertWrapper severity="error">
          {terminalTheme ? (
            <TerminalTypography>{error}</TerminalTypography>
          ) : (
            <Typography>{error}</Typography>
          )}
        </AlertWrapper>
      ) : renewals.length === 0 ? (
        <AlertWrapper severity="info">
          {terminalTheme ? (
            <TerminalTypography>No renewal history found. Your subscription renewals will appear here.</TerminalTypography>
          ) : (
            <Typography>No renewal history found. Your subscription renewals will appear here.</Typography>
          )}
        </AlertWrapper>
      ) : (
        <>
          <TableContainer component={Box} sx={{ maxHeight: 600, overflow: 'auto' }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TerminalTableCell sx={{ width: '8%' }}>#</TerminalTableCell>
                  <TerminalTableCell sx={{ width: '12%' }}>Type</TerminalTableCell>
                  <TerminalTableCell sx={{ width: '15%' }}>Plan</TerminalTableCell>
                  <TerminalTableCell sx={{ width: '12%' }}>Previous Plan</TerminalTableCell>
                  <TerminalTableCell sx={{ width: '10%' }}>Billing Cycle</TerminalTableCell>
                  <TerminalTableCell sx={{ width: '12%' }}>Period Start</TerminalTableCell>
                  <TerminalTableCell sx={{ width: '12%' }}>Period End</TerminalTableCell>
                  <TerminalTableCell sx={{ width: '10%' }}>Amount</TerminalTableCell>
                  <TerminalTableCell sx={{ width: '9%' }}>Status</TerminalTableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {renewals.map((renewal) => (
                  <TerminalTableRow key={renewal.id}>
                    <TerminalTableCell>
                      {terminalTheme ? (
                        <TerminalTypography variant="body2" sx={{ fontSize: '0.75rem' }}>
                          #{renewal.renewal_count}
                        </TerminalTypography>
                      ) : (
                        <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                          #{renewal.renewal_count}
                        </Typography>
                      )}
                    </TerminalTableCell>
                    <TerminalTableCell>
                      {getRenewalTypeChip(renewal.renewal_type)}
                    </TerminalTableCell>
                    <TerminalTableCell>
                      {terminalTheme ? (
                        <>
                          <TerminalTypography variant="body2" sx={{ fontSize: '0.75rem', fontWeight: 600 }}>
                            {renewal.plan_name}
                          </TerminalTypography>
                          <TerminalTypography variant="caption" sx={{ fontSize: '0.7rem', display: 'block', opacity: 0.7 }}>
                            {renewal.plan_tier}
                          </TerminalTypography>
                        </>
                      ) : (
                        <>
                          <Typography variant="body2" sx={{ fontSize: '0.75rem', fontWeight: 600 }}>
                            {renewal.plan_name}
                          </Typography>
                          <Typography variant="caption" sx={{ fontSize: '0.7rem', display: 'block', opacity: 0.7 }}>
                            {renewal.plan_tier}
                          </Typography>
                        </>
                      )}
                    </TerminalTableCell>
                    <TerminalTableCell>
                      {renewal.previous_plan_name ? (
                        terminalTheme ? (
                          <>
                            <TerminalTypography variant="body2" sx={{ fontSize: '0.75rem' }}>
                              {renewal.previous_plan_name}
                            </TerminalTypography>
                            <TerminalTypography variant="caption" sx={{ fontSize: '0.7rem', display: 'block', opacity: 0.7 }}>
                              {renewal.previous_plan_tier}
                            </TerminalTypography>
                          </>
                        ) : (
                          <>
                            <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                              {renewal.previous_plan_name}
                            </Typography>
                            <Typography variant="caption" sx={{ fontSize: '0.7rem', display: 'block', opacity: 0.7 }}>
                              {renewal.previous_plan_tier}
                            </Typography>
                          </>
                        )
                      ) : (
                        terminalTheme ? (
                          <TerminalTypography variant="body2" sx={{ fontSize: '0.75rem', fontStyle: 'italic', opacity: 0.5 }}>
                            N/A
                          </TerminalTypography>
                        ) : (
                          <Typography variant="body2" sx={{ fontSize: '0.75rem', fontStyle: 'italic', opacity: 0.5 }}>
                            N/A
                          </Typography>
                        )
                      )}
                    </TerminalTableCell>
                    <TerminalTableCell>
                      {terminalTheme ? (
                        <TerminalTypography variant="body2" sx={{ fontSize: '0.75rem', textTransform: 'capitalize' }}>
                          {renewal.billing_cycle}
                        </TerminalTypography>
                      ) : (
                        <Typography variant="body2" sx={{ fontSize: '0.75rem', textTransform: 'capitalize' }}>
                          {renewal.billing_cycle}
                        </Typography>
                      )}
                    </TerminalTableCell>
                    <TerminalTableCell>
                      {terminalTheme ? (
                        <TerminalTypography variant="body2" sx={{ fontSize: '0.75rem' }}>
                          {formatDate(renewal.new_period_start)}
                        </TerminalTypography>
                      ) : (
                        <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                          {formatDate(renewal.new_period_start)}
                        </Typography>
                      )}
                    </TerminalTableCell>
                    <TerminalTableCell>
                      {terminalTheme ? (
                        <TerminalTypography variant="body2" sx={{ fontSize: '0.75rem' }}>
                          {formatDate(renewal.new_period_end)}
                        </TerminalTypography>
                      ) : (
                        <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                          {formatDate(renewal.new_period_end)}
                        </Typography>
                      )}
                    </TerminalTableCell>
                    <TerminalTableCell>
                      {terminalTheme ? (
                        <TerminalTypography variant="body2" sx={{ fontSize: '0.75rem', fontWeight: 600 }}>
                          {formatCurrency(renewal.payment_amount)}
                        </TerminalTypography>
                      ) : (
                        <Typography variant="body2" sx={{ fontSize: '0.75rem', fontWeight: 600 }}>
                          {formatCurrency(renewal.payment_amount)}
                        </Typography>
                      )}
                    </TerminalTableCell>
                    <TerminalTableCell>
                      {renewal.payment_status === 'paid' ? (
                        terminalTheme ? (
                          <TerminalChipSuccess label="Paid" size="small" />
                        ) : (
                          <Chip 
                            label="Paid" 
                            size="small" 
                            sx={{ 
                              backgroundColor: 'rgba(34, 197, 94, 0.2)', 
                              color: '#22c55e',
                              fontWeight: 500
                            }} 
                          />
                        )
                      ) : renewal.payment_status === 'pending' ? (
                        terminalTheme ? (
                          <TerminalChipWarning label="Pending" size="small" />
                        ) : (
                          <Chip 
                            label="Pending" 
                            size="small" 
                            sx={{ 
                              backgroundColor: 'rgba(245, 158, 11, 0.2)', 
                              color: '#f59e0b',
                              fontWeight: 500
                            }} 
                          />
                        )
                      ) : (
                        terminalTheme ? (
                          <TerminalChipError label="Failed" size="small" />
                        ) : (
                          <Chip 
                            label="Failed" 
                            size="small" 
                            sx={{ 
                              backgroundColor: 'rgba(239, 68, 68, 0.2)', 
                              color: '#ef4444',
                              fontWeight: 500
                            }} 
                          />
                        )
                      )}
                    </TerminalTableCell>
                  </TerminalTableRow>
                ))}
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
            rowsPerPageOptions={[10, 20, 50, 100]}
            sx={{
              color: terminalTheme ? terminalColors.text : 'inherit',
              '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
                color: terminalTheme ? terminalColors.text : 'inherit',
                fontFamily: terminalTheme ? 'monospace' : 'inherit'
              },
              '& .MuiIconButton-root': {
                color: terminalTheme ? terminalColors.primary : 'inherit'
              }
            }}
          />
        </>
      )}
    </PaperComponent>
  );
};

export default SubscriptionRenewalHistory;

