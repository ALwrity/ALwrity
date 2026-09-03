/**
 * Scheduler Charts Component
 * Visualizes scheduler event history data using Recharts
 */

import React, { useMemo, useState, useEffect } from 'react';
import { SafeResponsiveContainer } from '../shared/SafeResponsiveContainer';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { Box, Paper, CircularProgress, Modal, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import MaximizeIcon from '@mui/icons-material/OpenInFull';
import { TerminalTypography, TerminalPaper, terminalColors } from './terminalTheme';
import { getSchedulerEventHistory, SchedulerEvent } from '../../api/schedulerDashboard';

interface SchedulerChartsProps {
  // Optional: can receive events as prop or fetch them internally
  events?: SchedulerEvent[];
}

interface ChartModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

const ChartModal: React.FC<ChartModalProps> = ({ open, onClose, title, children }) => {
  return (
    <Modal
      open={open}
      onClose={onClose}
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
      }}
    >
      <TerminalPaper
        sx={{
          position: 'relative',
          width: '90%',
          maxWidth: '1200px',
          maxHeight: '90vh',
          overflow: 'auto',
          p: 3,
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <TerminalTypography variant="h5" sx={{ color: terminalColors.primary }}>
            {title}
          </TerminalTypography>
          <IconButton onClick={onClose} sx={{ color: terminalColors.primary }}>
            <CloseIcon />
          </IconButton>
        </Box>
        {children}
      </TerminalPaper>
    </Modal>
  );
};

const SchedulerCharts: React.FC<SchedulerChartsProps> = ({ events: propEvents }) => {
  const [events, setEvents] = useState<SchedulerEvent[]>(propEvents || []);
  const [loading, setLoading] = useState(!propEvents);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState<string | null>(null);

  // Fetch events if not provided as prop
  useEffect(() => {
    if (!propEvents) {
      const fetchEvents = async () => {
        try {
          setLoading(true);
          setError(null);
          // Fetch events for visualization (max 500 per backend API limit)
          // Pass undefined to get all event types, use 30 days for charts
          console.log('📊 Charts - Fetching event history...');
          const response = await getSchedulerEventHistory(500, 0, undefined, 30);
          console.log('📊 Charts - Fetched events:', {
            totalEvents: response.events?.length || 0,
            totalCount: response.total_count,
            hasEvents: !!(response.events && response.events.length > 0),
            sampleEvent: response.events?.[0]
          });
          setEvents(response.events || []);
        } catch (err: any) {
          console.error('❌ Charts - Error fetching events:', err);
          console.error('❌ Charts - Error details:', {
            message: err?.message,
            response: err?.response,
            responseData: err?.response?.data,
            stack: err?.stack
          });
          const errorMessage = err?.response?.data?.detail || err?.response?.data?.message || err?.message || String(err) || 'Failed to fetch event history';
          setError(errorMessage);
        } finally {
          setLoading(false);
        }
      };
      fetchEvents();
    }
  }, [propEvents]);

  // Process events for charting
  const chartData = useMemo(() => {
    if (!events || events.length === 0) return [];

    // Group events by date (day)
    const eventsByDate: Record<string, {
      date: string;
      check_cycles: number;
      tasks_found: number;
      tasks_executed: number;
      tasks_failed: number;
      job_scheduled: number;
      job_completed: number;
      job_failed: number;
    }> = {};

    events.forEach(event => {
      const date = event.event_date ? new Date(event.event_date).toLocaleDateString() : 'Unknown';
      
      if (!eventsByDate[date]) {
        eventsByDate[date] = {
          date,
          check_cycles: 0,
          tasks_found: 0,
          tasks_executed: 0,
          tasks_failed: 0,
          job_scheduled: 0,
          job_completed: 0,
          job_failed: 0,
        };
      }

      switch (event.event_type) {
        case 'check_cycle':
          eventsByDate[date].check_cycles++;
          eventsByDate[date].tasks_found += event.tasks_found || 0;
          eventsByDate[date].tasks_executed += event.tasks_executed || 0;
          eventsByDate[date].tasks_failed += event.tasks_failed || 0;
          break;
        case 'job_scheduled':
          eventsByDate[date].job_scheduled++;
          break;
        case 'job_completed':
          eventsByDate[date].job_completed++;
          break;
        case 'job_failed':
          eventsByDate[date].job_failed++;
          break;
      }
    });

    // Convert to array and sort by date
    return Object.values(eventsByDate).sort((a, b) => {
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    }).slice(-30); // Last 30 days
  }, [events]);

  // Calculate totals for summary
  const totals = useMemo(() => {
    return events.reduce((acc, event) => {
      switch (event.event_type) {
        case 'check_cycle':
          acc.check_cycles++;
          acc.tasks_found += event.tasks_found || 0;
          acc.tasks_executed += event.tasks_executed || 0;
          acc.tasks_failed += event.tasks_failed || 0;
          break;
        case 'job_scheduled':
          acc.job_scheduled++;
          break;
        case 'job_completed':
          acc.job_completed++;
          break;
        case 'job_failed':
          acc.job_failed++;
          break;
      }
      return acc;
    }, {
      check_cycles: 0,
      tasks_found: 0,
      tasks_executed: 0,
      tasks_failed: 0,
      job_scheduled: 0,
      job_completed: 0,
      job_failed: 0,
    });
  }, [events]);

  // Custom tooltip with terminal theme
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <Paper
          sx={{
            backgroundColor: terminalColors.background,
            border: `1px solid ${terminalColors.primary}`,
            padding: 1,
            fontFamily: 'monospace'
          }}
        >
          <TerminalTypography variant="body2" sx={{ color: terminalColors.primary, fontWeight: 'bold', mb: 0.5 }}>
            {label}
          </TerminalTypography>
          {payload.map((entry: any, index: number) => (
            <TerminalTypography
              key={index}
              variant="body2"
              sx={{ color: entry.color, fontSize: '0.75rem' }}
            >
              {entry.name}: {entry.value}
            </TerminalTypography>
          ))}
        </Paper>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <TerminalPaper sx={{ p: 3, textAlign: 'center' }}>
        <CircularProgress sx={{ color: terminalColors.primary, mb: 2 }} />
        <TerminalTypography variant="body2" sx={{ color: terminalColors.textSecondary }}>
          Loading chart data...
        </TerminalTypography>
      </TerminalPaper>
    );
  }

  if (error) {
    return (
      <TerminalPaper sx={{ p: 3, textAlign: 'center' }}>
        <TerminalTypography variant="body2" sx={{ color: terminalColors.error }}>
          Error loading charts: {error}
        </TerminalTypography>
      </TerminalPaper>
    );
  }

  if (events.length === 0) {
    return (
      <TerminalPaper sx={{ p: 3, textAlign: 'center' }}>
        <TerminalTypography variant="body2" sx={{ color: terminalColors.textSecondary }}>
          No event history data available yet. Charts will appear once scheduler events are logged.
        </TerminalTypography>
      </TerminalPaper>
    );
  }

  const handleChartClick = (chartId: string) => {
    setModalOpen(chartId);
  };

  const handleModalClose = () => {
    setModalOpen(null);
  };

  return (
    <Box>
      {/* Compact Charts in Single Row */}
      <Box sx={{ display: 'flex', gap: 2, overflowX: 'auto', pb: 2 }}>
        {/* Task Execution Trends - Compact */}
        <Box
          sx={{
            flex: '0 0 300px',
            cursor: 'pointer',
            transition: 'transform 0.2s',
            '&:hover': {
              transform: 'scale(1.05)',
            },
          }}
          onClick={() => handleChartClick('task-execution')}
        >
          <TerminalPaper sx={{ p: 2, position: 'relative' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <TerminalTypography variant="body2" sx={{ color: terminalColors.primary, fontSize: '0.875rem' }}>
                Task Execution Trends
              </TerminalTypography>
              <MaximizeIcon sx={{ fontSize: 16, color: terminalColors.primary }} />
            </Box>
            <SafeResponsiveContainer width="100%" height={150}>
              <LineChart data={chartData.slice(-7)}>
                <CartesianGrid strokeDasharray="3 3" stroke={terminalColors.border} />
                <XAxis 
                  dataKey="date" 
                  stroke={terminalColors.primary}
                  tick={{ fill: terminalColors.primary, fontSize: 10 }}
                  interval="preserveStartEnd"
                />
                <YAxis 
                  stroke={terminalColors.primary}
                  tick={{ fill: terminalColors.primary, fontSize: 10 }}
                  width={30}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line 
                  type="monotone" 
                  dataKey="tasks_executed" 
                  stroke={terminalColors.success}
                  strokeWidth={2}
                  dot={false}
                />
                <Line 
                  type="monotone" 
                  dataKey="tasks_failed" 
                  stroke={terminalColors.error}
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </SafeResponsiveContainer>
          </TerminalPaper>
        </Box>

        {/* Job Status Distribution - Compact */}
        <Box
          sx={{
            flex: '0 0 300px',
            cursor: 'pointer',
            transition: 'transform 0.2s',
            '&:hover': {
              transform: 'scale(1.05)',
            },
          }}
          onClick={() => handleChartClick('job-status')}
        >
          <TerminalPaper sx={{ p: 2, position: 'relative' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <TerminalTypography variant="body2" sx={{ color: terminalColors.primary, fontSize: '0.875rem' }}>
                Job Status Distribution
              </TerminalTypography>
              <MaximizeIcon sx={{ fontSize: 16, color: terminalColors.primary }} />
            </Box>
            <SafeResponsiveContainer width="100%" height={150}>
              <BarChart data={chartData.slice(-7)}>
                <CartesianGrid strokeDasharray="3 3" stroke={terminalColors.border} />
                <XAxis 
                  dataKey="date" 
                  stroke={terminalColors.primary}
                  tick={{ fill: terminalColors.primary, fontSize: 10 }}
                  interval="preserveStartEnd"
                />
                <YAxis 
                  stroke={terminalColors.primary}
                  tick={{ fill: terminalColors.primary, fontSize: 10 }}
                  width={30}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar 
                  dataKey="job_completed" 
                  fill={terminalColors.success}
                  radius={[4, 4, 0, 0]}
                />
                <Bar 
                  dataKey="job_failed" 
                  fill={terminalColors.error}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </SafeResponsiveContainer>
          </TerminalPaper>
        </Box>

        {/* Check Cycles - Compact */}
        <Box
          sx={{
            flex: '0 0 300px',
            cursor: 'pointer',
            transition: 'transform 0.2s',
            '&:hover': {
              transform: 'scale(1.05)',
            },
          }}
          onClick={() => handleChartClick('check-cycles')}
        >
          <TerminalPaper sx={{ p: 2, position: 'relative' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <TerminalTypography variant="body2" sx={{ color: terminalColors.primary, fontSize: '0.875rem' }}>
                Check Cycles Over Time
              </TerminalTypography>
              <MaximizeIcon sx={{ fontSize: 16, color: terminalColors.primary }} />
            </Box>
            <SafeResponsiveContainer width="100%" height={150}>
              <BarChart data={chartData.slice(-7)}>
                <CartesianGrid strokeDasharray="3 3" stroke={terminalColors.border} />
                <XAxis 
                  dataKey="date" 
                  stroke={terminalColors.primary}
                  tick={{ fill: terminalColors.primary, fontSize: 10 }}
                  interval="preserveStartEnd"
                />
                <YAxis 
                  stroke={terminalColors.primary}
                  tick={{ fill: terminalColors.primary, fontSize: 10 }}
                  width={30}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar 
                  dataKey="check_cycles" 
                  fill={terminalColors.primary}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </SafeResponsiveContainer>
          </TerminalPaper>
        </Box>
      </Box>

      {/* Modals for Expanded Charts */}
      <ChartModal
        open={modalOpen === 'task-execution'}
        onClose={handleModalClose}
        title="Task Execution Trends (Last 30 Days)"
      >
        <SafeResponsiveContainer width="100%" height={400}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke={terminalColors.border} />
            <XAxis 
              dataKey="date" 
              stroke={terminalColors.primary}
              tick={{ fill: terminalColors.primary, fontSize: 12 }}
            />
            <YAxis 
              stroke={terminalColors.primary}
              tick={{ fill: terminalColors.primary, fontSize: 12 }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              wrapperStyle={{ color: terminalColors.primary, fontFamily: 'monospace' }}
            />
            <Line 
              type="monotone" 
              dataKey="tasks_found" 
              stroke={terminalColors.info}
              strokeWidth={2}
              name="Tasks Found"
              dot={{ fill: terminalColors.info, r: 4 }}
            />
            <Line 
              type="monotone" 
              dataKey="tasks_executed" 
              stroke={terminalColors.success}
              strokeWidth={2}
              name="Tasks Executed"
              dot={{ fill: terminalColors.success, r: 4 }}
            />
            <Line 
              type="monotone" 
              dataKey="tasks_failed" 
              stroke={terminalColors.error}
              strokeWidth={2}
              name="Tasks Failed"
              dot={{ fill: terminalColors.error, r: 4 }}
            />
          </LineChart>
        </SafeResponsiveContainer>
      </ChartModal>

      <ChartModal
        open={modalOpen === 'job-status'}
        onClose={handleModalClose}
        title="Job Status Distribution (Last 30 Days)"
      >
        <SafeResponsiveContainer width="100%" height={400}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke={terminalColors.border} />
            <XAxis 
              dataKey="date" 
              stroke={terminalColors.primary}
              tick={{ fill: terminalColors.primary, fontSize: 12 }}
            />
            <YAxis 
              stroke={terminalColors.primary}
              tick={{ fill: terminalColors.primary, fontSize: 12 }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              wrapperStyle={{ color: terminalColors.primary, fontFamily: 'monospace' }}
            />
            <Bar 
              dataKey="job_scheduled" 
              fill={terminalColors.info}
              name="Scheduled"
            />
            <Bar 
              dataKey="job_completed" 
              fill={terminalColors.success}
              name="Completed"
            />
            <Bar 
              dataKey="job_failed" 
              fill={terminalColors.error}
              name="Failed"
            />
          </BarChart>
        </SafeResponsiveContainer>
      </ChartModal>

      <ChartModal
        open={modalOpen === 'check-cycles'}
        onClose={handleModalClose}
        title="Check Cycles Over Time (Last 30 Days)"
      >
        <SafeResponsiveContainer width="100%" height={400}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke={terminalColors.border} />
            <XAxis 
              dataKey="date" 
              stroke={terminalColors.primary}
              tick={{ fill: terminalColors.primary, fontSize: 12 }}
            />
            <YAxis 
              stroke={terminalColors.primary}
              tick={{ fill: terminalColors.primary, fontSize: 12 }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar 
              dataKey="check_cycles" 
              fill={terminalColors.primary}
              name="Check Cycles"
            />
          </BarChart>
        </SafeResponsiveContainer>
      </ChartModal>

      {/* Summary Stats - Compact */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 2, mt: 2 }}>
        <TerminalPaper sx={{ p: 2, textAlign: 'center' }}>
          <TerminalTypography variant="h6" sx={{ color: terminalColors.primary, fontSize: '1.5rem' }}>
            {totals.check_cycles}
          </TerminalTypography>
          <TerminalTypography variant="caption" sx={{ color: terminalColors.textSecondary, fontSize: '0.75rem' }}>
            Check Cycles
          </TerminalTypography>
        </TerminalPaper>
        <TerminalPaper sx={{ p: 2, textAlign: 'center' }}>
          <TerminalTypography variant="h6" sx={{ color: terminalColors.primary, fontSize: '1.5rem' }}>
            {totals.tasks_executed}
          </TerminalTypography>
          <TerminalTypography variant="caption" sx={{ color: terminalColors.textSecondary, fontSize: '0.75rem' }}>
            Tasks Executed
          </TerminalTypography>
        </TerminalPaper>
        <TerminalPaper sx={{ p: 2, textAlign: 'center' }}>
          <TerminalTypography variant="h6" sx={{ color: terminalColors.error, fontSize: '1.5rem' }}>
            {totals.tasks_failed}
          </TerminalTypography>
          <TerminalTypography variant="caption" sx={{ color: terminalColors.textSecondary, fontSize: '0.75rem' }}>
            Tasks Failed
          </TerminalTypography>
        </TerminalPaper>
        <TerminalPaper sx={{ p: 2, textAlign: 'center' }}>
          <TerminalTypography variant="h6" sx={{ color: terminalColors.primary, fontSize: '1.5rem' }}>
            {totals.job_completed}
          </TerminalTypography>
          <TerminalTypography variant="caption" sx={{ color: terminalColors.textSecondary, fontSize: '0.75rem' }}>
            Jobs Completed
          </TerminalTypography>
        </TerminalPaper>
        <TerminalPaper sx={{ p: 2, textAlign: 'center' }}>
          <TerminalTypography variant="h6" sx={{ color: terminalColors.error, fontSize: '1.5rem' }}>
            {totals.job_failed}
          </TerminalTypography>
          <TerminalTypography variant="caption" sx={{ color: terminalColors.textSecondary, fontSize: '0.75rem' }}>
            Jobs Failed
          </TerminalTypography>
        </TerminalPaper>
      </Box>
    </Box>
  );
};

export default SchedulerCharts;

