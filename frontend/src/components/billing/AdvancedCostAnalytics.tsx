import React, { useState, useEffect, useMemo, Suspense } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Grid,
  Chip,
  Tooltip,
  CircularProgress,
  Tabs,
  Tab,
  Alert,
} from '@mui/material';
import { motion } from 'framer-motion';
import { 
  Clock,
  Activity,
  TrendingUp,
  BarChart3,
  Zap,
  Calendar
} from 'lucide-react';
import {
  LazyBarChart,
  LazyPieChart,
  Bar,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
  ChartLoadingFallback
} from '../../utils/lazyRecharts';
import { SafeResponsiveContainer } from '../shared/SafeResponsiveContainer';

// Types
import { UsageLog } from '../../types/billing';

// Services
import { billingService, formatCurrency, formatNumber } from '../../services/billingService';

// Components
import DailyCostHeatmap from './DailyCostHeatmap';

interface AdvancedCostAnalyticsProps {
  userId?: string;
  terminalTheme?: boolean;
}

interface TimeOfDayData {
  hour: number;
  label: string;
  cost: number;
  calls: number;
  avgCostPerCall: number;
}

interface UserActionData {
  endpoint: string;
  action: string;
  cost: number;
  calls: number;
  avgCostPerCall: number;
  avgResponseTime: number;
}

interface EfficiencyMetric {
  label: string;
  value: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
  description: string;
}

const AdvancedCostAnalytics: React.FC<AdvancedCostAnalyticsProps> = ({ 
  userId,
  terminalTheme = false 
}) => {
  const [usageLogs, setUsageLogs] = useState<UsageLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    const fetchUsageLogs = async () => {
      try {
        setLoading(true);
        setError(null);
        const currentDate = new Date();
        const billingPeriod = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
        
        console.log('[AdvancedCostAnalytics] Fetching usage logs for period:', billingPeriod);
        
        // Try with billing period first, then without if no results
        let response = await billingService.getUsageLogs(2000, 0, undefined, undefined, billingPeriod);
        let logs = response.logs || [];
        
        // If no logs for current period, try without billing period filter to get recent logs
        if (logs.length === 0) {
          console.log('[AdvancedCostAnalytics] No logs for current period, fetching all recent logs...');
          response = await billingService.getUsageLogs(2000, 0);
          logs = response.logs || [];
        }
        
        console.log('[AdvancedCostAnalytics] Received logs:', {
          total: logs.length,
          sample: logs.slice(0, 3),
          totalCost: logs.reduce((sum, log) => sum + (log.cost_total || 0), 0),
          totalCalls: logs.length,
          logsWithCost: logs.filter(log => (log.cost_total || 0) > 0).length,
          logsWithTokens: logs.filter(log => (log.tokens_total || 0) > 0).length,
          sampleLogStructure: logs[0] ? {
            id: logs[0].id,
            cost_total: logs[0].cost_total,
            tokens_total: logs[0].tokens_total,
            status: logs[0].status,
            status_code: logs[0].status_code,
            response_time: logs[0].response_time
          } : null
        });
        
        setUsageLogs(logs);
      } catch (err) {
        console.error('[AdvancedCostAnalytics] Error fetching usage logs:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch usage logs');
        // Set empty array on error to prevent showing stale data
        setUsageLogs([]);
      } finally {
        setLoading(false);
      }
    };

    fetchUsageLogs();
  }, [userId]);

  // Time of Day Analysis
  const timeOfDayData = useMemo(() => {
    const hourlyData: Record<number, { cost: number; calls: number }> = {};
    
    usageLogs.forEach(log => {
      // Include all logs, not just those with cost > 0, for accurate call counts
      const cost = log.cost_total || 0;
      
      try {
        const date = new Date(log.timestamp);
        if (isNaN(date.getTime())) {
          console.warn('[AdvancedCostAnalytics] Invalid timestamp:', log.timestamp);
          return;
        }
        const hour = date.getHours();
        
        if (!hourlyData[hour]) {
          hourlyData[hour] = { cost: 0, calls: 0 };
        }
        hourlyData[hour].cost += cost;
        hourlyData[hour].calls += 1;
      } catch (err) {
        console.warn('[AdvancedCostAnalytics] Error processing log timestamp:', err, log);
      }
    });

    return Array.from({ length: 24 }, (_, hour) => {
      const data = hourlyData[hour] || { cost: 0, calls: 0 };
      return {
        hour,
        label: `${hour.toString().padStart(2, '0')}:00`,
        cost: data.cost,
        calls: data.calls,
        avgCostPerCall: data.calls > 0 ? data.cost / data.calls : 0
      } as TimeOfDayData;
    });
  }, [usageLogs]);

  // User Action Breakdown
  const userActionData = useMemo(() => {
    const actionMap: Record<string, { cost: number; calls: number; responseTime: number }> = {};
    
    usageLogs.forEach(log => {
      // Include all logs for accurate call counts
      const cost = log.cost_total || 0;
      
      // Extract action from endpoint (e.g., /api/blog-writer/generate -> blog-writer)
      const endpoint = log.endpoint || '';
      const endpointParts = endpoint.split('/');
      const action = endpointParts.length > 2 ? endpointParts[2] : 'other';
      
      if (!actionMap[action]) {
        actionMap[action] = { cost: 0, calls: 0, responseTime: 0 };
      }
      actionMap[action].cost += cost;
      actionMap[action].calls += 1;
      actionMap[action].responseTime += log.response_time || 0;
    });

    return Object.entries(actionMap)
      .map(([endpoint, data]) => ({
        endpoint,
        action: endpoint.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        cost: data.cost,
        calls: data.calls,
        avgCostPerCall: data.calls > 0 ? data.cost / data.calls : 0,
        avgResponseTime: data.calls > 0 ? data.responseTime / data.calls : 0
      } as UserActionData))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 10); // Top 10 actions
  }, [usageLogs]);

  // Cost Efficiency Metrics
  const efficiencyMetrics = useMemo(() => {
    const totalCost = usageLogs.reduce((sum, log) => sum + (log.cost_total || 0), 0);
    const totalCalls = usageLogs.length;
    const totalTokens = usageLogs.reduce((sum, log) => sum + (log.tokens_total || 0), 0);
    const totalResponseTime = usageLogs.reduce((sum, log) => sum + (log.response_time || 0), 0);
    const successfulCalls = usageLogs.filter(log => log.status === 'success' || (log.status_code && log.status_code < 400)).length;
    const failedCalls = usageLogs.filter(log => log.status === 'failed' || (log.status_code && log.status_code >= 400)).length;
    
    // Debug logging
    if (usageLogs.length > 0) {
      console.log('[AdvancedCostAnalytics] Efficiency metrics calculation:', {
        totalLogs: usageLogs.length,
        totalCost,
        totalTokens,
        totalCalls,
        successfulCalls,
        failedCalls,
        sampleLog: usageLogs[0]
      });
    }

    const avgCostPerCall = totalCalls > 0 ? totalCost / totalCalls : 0;
    const avgCostPerToken = totalTokens > 0 ? totalCost / totalTokens : 0;
    const avgResponseTime = totalCalls > 0 ? totalResponseTime / totalCalls : 0;
    const successRate = totalCalls > 0 ? (successfulCalls / totalCalls) * 100 : 0;
    // Tokens per dollar - handle division by zero
    const costEfficiency = totalCost > 0 && totalTokens > 0 ? totalTokens / totalCost : 0;

    // Calculate trends (simplified - compare first half vs second half)
    const midPoint = Math.floor(usageLogs.length / 2);
    const firstHalf = usageLogs.slice(0, midPoint);
    const secondHalf = usageLogs.slice(midPoint);
    
    const firstHalfAvgCost = firstHalf.length > 0 
      ? firstHalf.reduce((sum, log) => sum + (log.cost_total || 0), 0) / firstHalf.length 
      : 0;
    const secondHalfAvgCost = secondHalf.length > 0
      ? secondHalf.reduce((sum, log) => sum + (log.cost_total || 0), 0) / secondHalf.length
      : 0;

    const costTrend = secondHalfAvgCost > firstHalfAvgCost * 1.05 ? 'up' :
                     secondHalfAvgCost < firstHalfAvgCost * 0.95 ? 'down' : 'stable';

    return [
      {
        label: 'Avg Cost per Call',
        value: avgCostPerCall,
        unit: '$',
        trend: costTrend,
        description: 'Average cost per API call'
      },
      {
        label: 'Cost per 1K Tokens',
        value: avgCostPerToken * 1000,
        unit: '$',
        trend: costTrend,
        description: 'Cost efficiency for token usage'
      },
      {
        label: 'Tokens per Dollar',
        value: costEfficiency,
        unit: '',
        trend: costTrend === 'down' ? 'up' : costTrend === 'up' ? 'down' : 'stable',
        description: 'How many tokens you get per dollar spent'
      },
      {
        label: 'Avg Response Time',
        value: avgResponseTime,
        unit: 's',
        trend: 'stable',
        description: 'Average API response time'
      },
      {
        label: 'Success Rate',
        value: successRate,
        unit: '%',
        trend: successRate > 95 ? 'up' : successRate < 90 ? 'down' : 'stable',
        description: 'Percentage of successful API calls'
      },
      {
        label: 'Failed Calls',
        value: failedCalls,
        unit: '',
        trend: failedCalls > 0 ? 'down' : 'stable',
        description: 'Number of failed API calls'
      }
    ] as EfficiencyMetric[];
  }, [usageLogs]);

  const COLORS = ['#667eea', '#764ba2', '#f093fb', '#4facfe', '#00f2fe', '#43e97b', '#fa709a', '#fee140', '#30cfd0', '#a8edea'];

  if (loading) {
    return (
      <Card sx={{ p: 3, textAlign: 'center' }}>
        <CircularProgress />
        <Typography sx={{ mt: 2, color: 'rgba(255,255,255,0.7)' }}>
          Loading analytics...
        </Typography>
      </Card>
    );
  }

  if (error) {
    return (
      <Card sx={{ p: 3 }}>
        <Alert severity="error">
          {error}
          <Typography variant="body2" sx={{ mt: 1, color: 'rgba(255,255,255,0.7)' }}>
            Unable to load usage analytics. Please try refreshing the page.
          </Typography>
        </Alert>
      </Card>
    );
  }

  // Show message if no logs available
  if (usageLogs.length === 0) {
    return (
      <Card sx={{ p: 3, textAlign: 'center' }}>
        <Alert severity="info">
          <Typography variant="h6" sx={{ mb: 1 }}>
            No Usage Data Available
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
            Usage analytics will appear here once you start making API calls.
          </Typography>
        </Alert>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card 
        sx={{ 
          height: '100%',
          background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 3,
        }}
      >
        <CardContent sx={{ pb: 1 }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 'bold', color: '#ffffff', mb: 2 }}>
            <BarChart3 size={20} />
            Advanced Cost Analytics
          </Typography>

          <Tabs
            value={activeTab}
            onChange={(_, newValue) => setActiveTab(newValue)}
            sx={{
              borderBottom: '1px solid rgba(255,255,255,0.1)',
              mb: 2,
              '& .MuiTab-root': {
                color: 'rgba(255,255,255,0.7)',
                '&.Mui-selected': {
                  color: '#667eea',
                  fontWeight: 'bold'
                }
              },
              '& .MuiTabs-indicator': {
                backgroundColor: '#667eea'
              }
            }}
          >
            <Tab icon={<Clock size={16} />} label="Time of Day" iconPosition="start" />
            <Tab icon={<Activity size={16} />} label="User Actions" iconPosition="start" />
            <Tab icon={<Zap size={16} />} label="Efficiency Metrics" iconPosition="start" />
            <Tab icon={<Calendar size={16} />} label="Daily Heatmap" iconPosition="start" />
          </Tabs>
        </CardContent>

        <CardContent sx={{ pt: 0 }}>
          {/* Time of Day Tab */}
          {activeTab === 0 && (
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 'bold', color: '#ffffff' }}>
                Cost Distribution by Hour of Day
              </Typography>
              
              <Box sx={{ height: 300, mb: 3 }}>
                <SafeResponsiveContainer width="100%" height="100%">
                  <Suspense fallback={<ChartLoadingFallback />}>
                    <LazyBarChart data={timeOfDayData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                      <XAxis 
                        dataKey="label" 
                        stroke="rgba(255,255,255,0.9)"
                        fontSize={10}
                        angle={-45}
                        textAnchor="end"
                        height={60}
                      />
                      <YAxis 
                        stroke="rgba(255,255,255,0.9)"
                        fontSize={12}
                        tickFormatter={(value) => `$${value.toFixed(2)}`}
                      />
                      <RechartsTooltip
                        contentStyle={{
                          backgroundColor: 'rgba(0, 0, 0, 0.8)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: 8
                        }}
                        formatter={(value: any) => [formatCurrency(Number(value) || 0), 'Cost']}
                      />
                      <Bar dataKey="cost" fill="#667eea" radius={[4, 4, 0, 0]} />
                    </LazyBarChart>
                  </Suspense>
                </SafeResponsiveContainer>
              </Box>

              {/* Peak Hours Summary */}
              <Grid container spacing={2}>
                {timeOfDayData
                  .sort((a, b) => b.cost - a.cost)
                  .slice(0, 3)
                  .map((data, idx) => (
                    <Grid item xs={4} key={data.hour}>
                      <Box sx={{ p: 1.5, backgroundColor: 'rgba(102, 126, 234, 0.1)', borderRadius: 1, textAlign: 'center' }}>
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                          Peak Hour {idx + 1}
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#667eea' }}>
                          {data.label}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                          {formatCurrency(data.cost)}
                        </Typography>
                      </Box>
                    </Grid>
                  ))}
              </Grid>
            </Box>
          )}

          {/* User Actions Tab */}
          {activeTab === 1 && (
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 'bold', color: '#ffffff' }}>
                Cost Breakdown by User Action
              </Typography>
              
              <Box sx={{ height: 300, mb: 3 }}>
                <SafeResponsiveContainer width="100%" height="100%">
                  <Suspense fallback={<ChartLoadingFallback />}>
                    <LazyPieChart>
                      <Pie
                        data={userActionData}
                        dataKey="cost"
                        nameKey="action"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={(entry: any) => {
                          const data = userActionData[entry.index];
                          return data ? `${data.action}: ${(entry.percent * 100).toFixed(0)}%` : '';
                        }}
                      >
                        {userActionData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        formatter={(value: any) => formatCurrency(Number(value) || 0)}
                        contentStyle={{
                          backgroundColor: 'rgba(0, 0, 0, 0.8)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: 8
                        }}
                      />
                    </LazyPieChart>
                  </Suspense>
                </SafeResponsiveContainer>
              </Box>

              {/* Top Actions Table */}
              <Box sx={{ maxHeight: 200, overflowY: 'auto' }}>
                {userActionData.map((action, idx) => (
                  <Box
                    key={action.endpoint}
                    sx={{
                      p: 1.5,
                      mb: 1,
                      backgroundColor: 'rgba(255,255,255,0.05)',
                      borderRadius: 1,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#ffffff' }}>
                        {action.action}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                        {action.calls} calls • {formatCurrency(action.avgCostPerCall)} avg
                      </Typography>
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 'bold', color: COLORS[idx % COLORS.length] }}>
                      {formatCurrency(action.cost)}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          )}

          {/* Efficiency Metrics Tab */}
          {activeTab === 2 && (
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 'bold', color: '#ffffff' }}>
                Cost Efficiency Metrics
              </Typography>
              
              <Grid container spacing={2}>
                {efficiencyMetrics.map((metric, idx) => (
                  <Grid item xs={6} sm={4} key={metric.label}>
                    <Tooltip title={metric.description} arrow>
                      <Box
                        sx={{
                          p: 2,
                          backgroundColor: 'rgba(255,255,255,0.05)',
                          borderRadius: 2,
                          border: '1px solid rgba(255,255,255,0.1)',
                          textAlign: 'center',
                          cursor: 'help'
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 1 }}>
                          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                            {metric.label}
                          </Typography>
                          {metric.trend === 'up' && <TrendingUp size={14} color="#22c55e" />}
                          {metric.trend === 'down' && <TrendingUp size={14} color="#ef4444" style={{ transform: 'rotate(180deg)' }} />}
                        </Box>
                        <Typography 
                          variant="h5" 
                          sx={{ 
                            fontWeight: 'bold',
                            color: metric.trend === 'up' ? '#22c55e' : 
                                   metric.trend === 'down' ? '#ef4444' : '#ffffff'
                          }}
                        >
                          {metric.unit === '$' ? formatCurrency(metric.value) :
                           metric.unit === '%' ? `${metric.value.toFixed(1)}%` :
                           metric.unit === 's' ? `${metric.value.toFixed(2)}s` :
                           formatNumber(metric.value)}
                        </Typography>
                      </Box>
                    </Tooltip>
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}

          {/* Daily Heatmap Tab */}
          {activeTab === 3 && (
            <Box>
              <DailyCostHeatmap
                usageLogs={usageLogs}
                currentMonth={new Date().getMonth()}
                currentYear={new Date().getFullYear()}
              />
            </Box>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default AdvancedCostAnalytics;
