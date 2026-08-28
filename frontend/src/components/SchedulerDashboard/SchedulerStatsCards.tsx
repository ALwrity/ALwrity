/**
 * Scheduler Stats Cards Component
 * Displays scheduler metrics in card format.
 */

import React from 'react';
import { Grid, Typography, Box } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import ScheduleIcon from '@mui/icons-material/Schedule';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { SchedulerStats } from '../../api/schedulerDashboard';
import { TerminalCard, TerminalCardContent, TerminalTypography, TerminalChip, TerminalChipSuccess, TerminalChipError, terminalColors } from './terminalTheme';

interface SchedulerStatsCardsProps {
  stats: SchedulerStats;
}

const SchedulerStatsCards: React.FC<SchedulerStatsCardsProps> = ({ stats }) => {
  // Debug: Only log if cumulative values are actually present (not just 0 from defaults)
  // Suppress logging when all cumulative values are 0 to reduce console noise
  if (stats.cumulative_total_check_cycles !== undefined) {
    const hasCumulativeData = stats.cumulative_total_check_cycles > 0 || 
                             stats.cumulative_tasks_found > 0 || 
                             stats.cumulative_tasks_executed > 0;
    
    // Only log if there's actual cumulative data or if this is the first render
    if (hasCumulativeData || stats.total_checks > 0) {
      console.log('📊 StatsCards received stats:', {
        total_checks: stats.total_checks,
        cumulative_total_check_cycles: stats.cumulative_total_check_cycles,
        cumulative_tasks_found: stats.cumulative_tasks_found,
        cumulative_tasks_executed: stats.cumulative_tasks_executed,
        cumulative_tasks_failed: stats.cumulative_tasks_failed,
        has_cumulative_data: hasCumulativeData
      });
    }
  }

  const getStatusColor = (running: boolean) => {
    return running ? 'success' : 'error';
  };

  const getStatusIcon = (running: boolean) => {
    return running ? <PlayArrowIcon /> : <PauseIcon />;
  };

  const formatTime = (minutes: number) => {
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    return `${minutes}m`;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d ago`;
    } catch {
      return dateString;
    }
  };

  const cards = [
    {
      title: 'Scheduler Status',
      value: stats.running ? 'Running' : 'Stopped',
      icon: getStatusIcon(stats.running),
      color: getStatusColor(stats.running),
      subtitle: stats.running ? 'Active' : 'Inactive'
    },
    {
      title: 'Total Check Cycles',
      value: (stats.cumulative_total_check_cycles !== undefined && stats.cumulative_total_check_cycles !== null)
        ? stats.cumulative_total_check_cycles.toLocaleString()
        : stats.total_checks.toLocaleString(),
      icon: <CheckCircleIcon />,
      color: 'primary' as const,
      subtitle: (stats.cumulative_total_check_cycles !== undefined && stats.cumulative_total_check_cycles !== null && stats.cumulative_total_check_cycles > 0)
        ? `${stats.total_checks.toLocaleString()} this session (${stats.cumulative_total_check_cycles.toLocaleString()} total)`
        : stats.total_checks === 0 
          ? 'No cycles yet (scheduler waiting)' 
          : 'Since startup'
    },
    {
      title: 'Tasks Executed',
      value: (stats.cumulative_tasks_executed !== undefined && stats.cumulative_tasks_executed !== null)
        ? stats.cumulative_tasks_executed.toLocaleString()
        : stats.tasks_executed.toLocaleString(),
      icon: <TrendingUpIcon />,
      color: 'success' as const,
      subtitle: (stats.cumulative_tasks_executed !== undefined && stats.cumulative_tasks_executed !== null && stats.cumulative_tasks_executed > 0)
        ? `${stats.tasks_executed.toLocaleString()} this session (${stats.cumulative_tasks_executed.toLocaleString()} total)`
        : stats.tasks_executed === 0
          ? 'No tasks executed yet'
          : `${stats.tasks_failed > 0 ? `${stats.tasks_failed} failed` : 'All successful'}`
    },
    {
      title: 'Tasks Found',
      value: (stats.cumulative_tasks_found !== undefined && stats.cumulative_tasks_found !== null)
        ? stats.cumulative_tasks_found.toLocaleString()
        : stats.tasks_found.toLocaleString(),
      icon: <ScheduleIcon />,
      color: 'info' as const,
      subtitle: (stats.cumulative_tasks_found !== undefined && stats.cumulative_tasks_found !== null && stats.cumulative_tasks_found > 0)
        ? `${stats.tasks_found.toLocaleString()} this session (${stats.cumulative_tasks_found.toLocaleString()} total)`
        : stats.tasks_found === 0
          ? 'No tasks scheduled yet'
          : `${stats.tasks_executed} executed, ${stats.tasks_failed} failed`
    },
    {
      title: 'Check Interval',
      value: formatTime(stats.check_interval_minutes),
      icon: <AccessTimeIcon />,
      color: 'secondary' as const,
      subtitle: stats.intelligent_scheduling 
        ? `Intelligent (${stats.active_strategies_count > 0 ? '15min' : '60min'} range)`
        : 'Fixed interval'
    },
    {
      title: 'Active Strategies',
      value: stats.active_strategies_count.toString(),
      icon: <TrendingUpIcon />,
      color: stats.active_strategies_count > 0 ? 'success' : 'default' as const,
      subtitle: stats.active_strategies_count > 0 
        ? 'With monitoring tasks' 
        : 'No active strategies'
    }
  ];

  const getCardIconColor = (cardColor: string) => {
    switch (cardColor) {
      case 'success':
        return terminalColors.success;
      case 'error':
        return terminalColors.error;
      case 'primary':
        return terminalColors.primary;
      case 'info':
        return terminalColors.info;
      case 'secondary':
        return terminalColors.secondary;
      default:
        return terminalColors.text;
    }
  };

  return (
    <Grid container spacing={2}>
      {cards.map((card, index) => (
        <Grid item xs={12} sm={6} md={4} key={index}>
          <TerminalCard sx={{ height: '100%' }}>
            <TerminalCardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                <Box display="flex" alignItems="center" gap={1}>
                  <Box
                    sx={{
                      p: 1,
                      borderRadius: '4px',
                      backgroundColor: terminalColors.backgroundLight,
                      border: `1px solid ${getCardIconColor(card.color)}`,
                      color: getCardIconColor(card.color),
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    {card.icon}
                  </Box>
                  <TerminalTypography variant="body2" sx={{ color: terminalColors.textSecondary }}>
                    {card.title}
                  </TerminalTypography>
                </Box>
              </Box>
              <TerminalTypography variant="h4" component="div" sx={{ fontWeight: 600, mb: 0.5, fontSize: '1.75rem', color: terminalColors.primary }}>
                {card.value}
              </TerminalTypography>
              <TerminalTypography variant="body2" sx={{ color: terminalColors.textSecondary, fontSize: '0.875rem' }}>
                {card.subtitle}
              </TerminalTypography>
              {card.title === 'Scheduler Status' && stats.last_check && (
                <TerminalTypography variant="caption" sx={{ mt: 1, display: 'block', color: terminalColors.textSecondary, fontSize: '0.75rem' }}>
                  Last check: {formatDate(stats.last_check)}
                </TerminalTypography>
              )}
            </TerminalCardContent>
          </TerminalCard>
        </Grid>
      ))}
    </Grid>
  );
};

export default SchedulerStatsCards;

