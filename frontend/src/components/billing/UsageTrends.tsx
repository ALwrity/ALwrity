import React, { Suspense } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Grid,
  Chip,
  CircularProgress,
  Tooltip as MuiTooltip,
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import CalendarIcon from '@mui/icons-material/CalendarToday';
import { motion } from 'framer-motion';
import { 
  LazyLineChart,
  LazyAreaChart,
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer,
  Area,
  ChartLoadingFallback
} from '../../utils/lazyRecharts';
import { SafeResponsiveContainer } from '../shared/SafeResponsiveContainer';

// Types
import { UsageTrends as UsageTrendsType, CostProjections } from '../../types/billing';

// Utils
import { 
  formatCurrency, 
  formatNumber,
  formatPercentage
} from '../../services/billingService';

// Components
import CostVelocityChart from './CostVelocityChart';
import MultiSeriesCostChart from './MultiSeriesCostChart';

interface UsageTrendsProps {
  trends: UsageTrendsType;
  projections: CostProjections;
}

const UsageTrends: React.FC<UsageTrendsProps> = ({ 
  trends, 
  projections 
}) => {
  // Transform data for charts
  const chartData = trends.periods.map((period, index) => ({
    period,
    calls: trends.total_calls[index] || 0,
    cost: trends.total_cost[index] || 0,
    tokens: trends.total_tokens[index] || 0,
  }));

  // Calculate growth rates (handle division by zero)
  const costGrowth = chartData.length > 1 
    ? chartData[0].cost > 0 
      ? ((chartData[chartData.length - 1].cost - chartData[0].cost) / chartData[0].cost) * 100
      : chartData[chartData.length - 1].cost > 0 ? 100 : 0
    : 0;
  
  const callsGrowth = chartData.length > 1 
    ? chartData[0].calls > 0 
      ? ((chartData[chartData.length - 1].calls - chartData[0].calls) / chartData[0].calls) * 100
      : chartData[chartData.length - 1].calls > 0 ? 100 : 0
    : 0;

  // Real current period metrics (non-predictive)
  const currentMonthCost = chartData.length > 0 ? chartData[chartData.length - 1].cost : 0;
  const currentMonthCalls = chartData.length > 0 ? chartData[chartData.length - 1].calls : 0;
  const budgetLimit = projections.cost_limit || 0;
  const actualUsagePercentage = budgetLimit > 0 ? (currentMonthCost / budgetLimit) * 100 : 0;
  
  // Calculate cost velocity trend (comparing recent vs earlier period)
  const recentPeriods = chartData.slice(-3); // Last 3 periods
  const earlierPeriods = chartData.slice(0, Math.min(3, chartData.length - 3));
  const recentAvgCost = recentPeriods.length > 0 
    ? recentPeriods.reduce((sum, p) => sum + p.cost, 0) / recentPeriods.length 
    : 0;
  const earlierAvgCost = earlierPeriods.length > 0
    ? earlierPeriods.reduce((sum, p) => sum + p.cost, 0) / earlierPeriods.length
    : 0;
  const velocityTrend = earlierAvgCost > 0 
    ? ((recentAvgCost - earlierAvgCost) / earlierAvgCost) * 100 
    : 0;

  // Custom tooltip for charts
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <Box
          sx={{
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            padding: 2,
            borderRadius: 2,
            border: '1px solid rgba(255,255,255,0.1)'
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
            {label}
          </Typography>
          {payload.map((entry: any, index: number) => (
            <Typography key={index} variant="body2" sx={{ color: entry.color }}>
              {entry.name}: {entry.name === 'Cost' ? formatCurrency(entry.value) : formatNumber(entry.value)}
            </Typography>
          ))}
        </Box>
      );
    }
    return null;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      whileHover={{ scale: 1.02 }}
    >
      <Card 
        sx={{ 
          height: '100%',
          background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 3,
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <CardContent sx={{ pb: 1 }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 'bold', mb: 2 }}>
            <TrendingUpIcon fontSize="small" />
            Usage Trends & Budget Status
          </Typography>
        </CardContent>

        <CardContent sx={{ pt: 0 }}>
          {/* Growth Indicators & Cost Velocity */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={6} sm={4}>
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
              >
                <MuiTooltip title="Percentage change in cost compared to first period" arrow>
                  <Box component="span"
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
                      {costGrowth >= 0 ? (
                        <TrendingUpIcon sx={{ fontSize: 16, color: '#22c55e' }} />
                      ) : (
                        <TrendingDownIcon sx={{ fontSize: 16, color: '#ef4444' }} />
                      )}
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                        Cost Growth
                      </Typography>
                    </Box>
                    <Typography 
                      variant="h6" 
                      sx={{ 
                        fontWeight: 'bold',
                        color: costGrowth >= 0 ? '#22c55e' : '#ef4444'
                      }}
                    >
                      {costGrowth >= 0 ? '+' : ''}{costGrowth.toFixed(1)}%
                    </Typography>
                  </Box>
                </MuiTooltip>
              </motion.div>
            </Grid>
            
            <Grid item xs={6} sm={4}>
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.1 }}
              >
                <MuiTooltip title="Percentage change in API calls compared to first period" arrow>
                  <Box component="span"
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
                      {callsGrowth >= 0 ? (
                        <TrendingUpIcon sx={{ fontSize: 16, color: '#22c55e' }} />
                      ) : (
                        <TrendingDownIcon sx={{ fontSize: 16, color: '#ef4444' }} />
                      )}
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                        Calls Growth
                      </Typography>
                    </Box>
                    <Typography 
                      variant="h6" 
                      sx={{ 
                        fontWeight: 'bold',
                        color: callsGrowth >= 0 ? '#22c55e' : '#ef4444'
                      }}
                    >
                      {callsGrowth >= 0 ? '+' : ''}{callsGrowth.toFixed(1)}%
                    </Typography>
                  </Box>
                </MuiTooltip>
              </motion.div>
            </Grid>

            <Grid item xs={12} sm={4}>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.2 }}
              >
                <MuiTooltip 
                  title={
                    <React.Fragment>
                      <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 0.5, display: 'block' }}>
                        Daily Spending Rate
                      </Typography>
                      <Typography variant="body2" sx={{ display: 'block' }}>
                        Average: {formatCurrency(avgDailyCost)}/day
                      </Typography>
                      <Typography variant="body2" sx={{ display: 'block' }}>
                        Velocity trend: {velocityTrend >= 0 ? '+' : ''}{velocityTrend.toFixed(1)}%
                      </Typography>
                      <Typography variant="caption" sx={{ mt: 1, display: 'block', opacity: 0.8 }}>
                        Based on current month's spending pattern
                      </Typography>
                    </React.Fragment>
                  }
                  arrow
                  placement="top"
                >
                  <Box component="span"
                    sx={{
                      p: 2,
                      backgroundColor: 'rgba(102, 126, 234, 0.1)',
                      borderRadius: 2,
                      border: '1px solid rgba(102, 126, 234, 0.3)',
                      textAlign: 'center',
                      cursor: 'help'
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 1 }}>
                      <CalendarIcon sx={{ fontSize: 16, color: '#667eea' }} />
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)', fontWeight: 500 }}>
                        Cost Velocity
                      </Typography>
                    </Box>
                    <Typography 
                      variant="h6" 
                      sx={{ 
                        fontWeight: 'bold',
                        color: '#667eea'
                      }}
                    >
                      {formatCurrency(avgDailyCost)}/day
                    </Typography>
                    <Typography 
                      variant="caption" 
                      sx={{ 
                        color: velocityTrend >= 0 ? '#ef4444' : '#22c55e',
                        display: 'block',
                        mt: 0.5
                      }}
                    >
                      {velocityTrend >= 0 ? '↑' : '↓'} {Math.abs(velocityTrend).toFixed(1)}% trend
                    </Typography>
                  </Box>
                </MuiTooltip>
              </motion.div>
            </Grid>
          </Grid>

          {/* Multi-Series Cost Chart */}
          <Box sx={{ mb: 3 }}>
            <MultiSeriesCostChart 
              trends={trends}
              monthlyLimit={projections.cost_limit || 0}
            />
          </Box>

          {/* API Calls Trend Chart */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 'bold', color: '#ffffff' }}>
              API Calls Trend
            </Typography>
            <Box sx={{ height: 150 }}>
              <SafeResponsiveContainer width="100%" height="100%">
                <Suspense fallback={<ChartLoadingFallback />}>
                  <LazyLineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis 
                    dataKey="period" 
                    stroke="rgba(255,255,255,0.6)"
                    fontSize={12}
                  />
                  <YAxis 
                    stroke="rgba(255,255,255,0.6)"
                    fontSize={12}
                    tickFormatter={(value) => formatNumber(value)}
                  />
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="calls"
                    stroke="#764ba2"
                    strokeWidth={2}
                    dot={{ fill: '#764ba2', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, stroke: '#764ba2', strokeWidth: 2 }}
                    animationDuration={1000}
                    animationBegin={200}
                  />
                </LazyLineChart>
                </Suspense>
              </SafeResponsiveContainer>
            </Box>
          </Box>

          {/* Current Period Usage & Budget */}
          <Box 
            sx={{ 
              p: 2.5, 
              backgroundColor: 'rgba(255,255,255,0.05)',
              borderRadius: 2,
              border: '1px solid rgba(255,255,255,0.1)'
            }}
          >
            <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1, color: '#ffffff' }}>
              <CalendarIcon fontSize="small" />
              Current Billing Period Status
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={6} sm={3}>
                <MuiTooltip title="Total spending in the current billing period" arrow placement="top">
                  <Box component="span" sx={{ textAlign: 'center', cursor: 'help' }}>
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', mb: 0.5 }}>
                      Current Spend
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#667eea' }}>
                      {formatCurrency(currentMonthCost)}
                    </Typography>
                  </Box>
                </MuiTooltip>
              </Grid>

              <Grid item xs={6} sm={3}>
                <MuiTooltip title="Maximum spending allowed for the current billing period" arrow placement="top">
                  <Box component="span" sx={{ textAlign: 'center', cursor: 'help' }}>
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', mb: 0.5 }}>
                      Budget Limit
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#ffffff' }}>
                      {budgetLimit > 0 ? formatCurrency(budgetLimit) : 'Unlimited'}
                    </Typography>
                  </Box>
                </MuiTooltip>
              </Grid>
              
              <Grid item xs={6} sm={3}>
                <MuiTooltip 
                  title={
                    <React.Fragment>
                      <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 0.5, display: 'block' }}>
                        Actual Usage Percentage
                      </Typography>
                      <Typography variant="body2" sx={{ display: 'block' }}>
                        Current spending vs monthly budget limit
                      </Typography>
                    </React.Fragment>
                  }
                  arrow
                  placement="top"
                >
                  <Box component="span" sx={{ textAlign: 'center', cursor: 'help' }}>
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', mb: 0.5 }}>
                      Current Usage %
                    </Typography>
                    <Typography 
                      variant="h6" 
                      sx={{ 
                        fontWeight: 'bold',
                        color: actualUsagePercentage >= 90 ? '#ef4444' : 
                               actualUsagePercentage >= 80 ? '#f59e0b' : '#22c55e'
                      }}
                    >
                      {budgetLimit > 0 ? formatPercentage(actualUsagePercentage) : '0%'}
                    </Typography>
                  </Box>
                </MuiTooltip>
              </Grid>

              <Grid item xs={6} sm={3}>
                <MuiTooltip title="Total API calls made across all providers this billing period" arrow placement="top">
                  <Box component="span" sx={{ textAlign: 'center', cursor: 'help' }}>
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', mb: 0.5 }}>
                      Total API Calls
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#ffffff' }}>
                      {formatNumber(currentMonthCalls)}
                    </Typography>
                  </Box>
                </MuiTooltip>
              </Grid>
            </Grid>
          </Box>
        </CardContent>

        {/* Decorative Elements */}
        <Box
          sx={{
            position: 'absolute',
            top: -50,
            right: -50,
            width: 100,
            height: 100,
            background: 'radial-gradient(circle, rgba(118, 75, 162, 0.1) 0%, transparent 70%)',
            borderRadius: '50%',
            pointerEvents: 'none'
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            bottom: -30,
            left: -30,
            width: 60,
            height: 60,
            background: 'radial-gradient(circle, rgba(102, 126, 234, 0.1) 0%, transparent 70%)',
            borderRadius: '50%',
            pointerEvents: 'none'
          }}
        />

          {/* Cost Velocity Chart */}
          <Box sx={{ mt: 3 }}>
            <CostVelocityChart 
              trends={trends}
              projections={projections}
              monthlyLimit={projections.cost_limit || 0}
            />
          </Box>
      </Card>
    </motion.div>
  );
};

export default UsageTrends;
