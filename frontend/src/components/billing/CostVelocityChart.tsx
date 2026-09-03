import React, { Suspense, useMemo } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  Tooltip as MuiTooltip,
} from '@mui/material';
import { motion } from 'framer-motion';
import { 
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { 
  LazyLineChart,
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer,
  ReferenceLine,
  ChartLoadingFallback
} from '../../utils/lazyRecharts';

// Types
import { UsageTrends as UsageTrendsType, CostProjections } from '../../types/billing';

// Utils
import { formatCurrency, formatNumber } from '../../services/billingService';

interface CostVelocityChartProps {
  trends: UsageTrendsType;
  projections?: CostProjections;
  monthlyLimit: number;
}

/**
 * CostVelocityChart - Shows spending trends across billing periods
 * with budget limit annotation and moving average
 */
const CostVelocityChart: React.FC<CostVelocityChartProps> = ({ 
  trends, 
  monthlyLimit
}) => {
  // Transform monthly period data
  const periodData = useMemo(() => {
    if (!trends.periods || trends.periods.length === 0) {
      return [];
    }

    return trends.periods.map((period, index) => {
      const cost = trends.total_cost[index] || 0;
      const calls = trends.total_calls[index] || 0;
      return {
        period,
        cost,
        calls
      };
    });
  }, [trends]);

  // Calculate 3-period moving average
  const movingAverageData = useMemo(() => {
    if (periodData.length === 0) return [];
    
    const windowSize = Math.min(3, periodData.length);
    return periodData.map((point, index) => {
      const start = Math.max(0, index - windowSize + 1);
      const window = periodData.slice(start, index + 1);
      const avg = window.reduce((sum, p) => sum + p.cost, 0) / window.length;
      return { ...point, movingAvg: Number(avg.toFixed(2)) };
    });
  }, [periodData]);

  // Current period spending metrics
  const currentPeriodCost = periodData.length > 0 
    ? periodData[periodData.length - 1].cost 
    : 0;
  const previousPeriodCost = periodData.length > 1
    ? periodData[periodData.length - 2].cost
    : 0;
  const costChange = previousPeriodCost > 0
    ? ((currentPeriodCost - previousPeriodCost) / previousPeriodCost) * 100
    : 0;

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
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
            Period: {data.period}
          </Typography>
          <Typography variant="body2">
            Spend: {formatCurrency(data.cost)}
          </Typography>
          {data.movingAvg !== undefined && (
            <Typography variant="body2">
              Avg: {formatCurrency(data.movingAvg)}
            </Typography>
          )}
          <Typography variant="body2">
            API Calls: {formatNumber(data.calls || 0)}
          </Typography>
        </Box>
      );
    }
    return null;
  };

  if (periodData.length === 0) {
    return null;
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
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#ffffff' }}>
              Monthly Spending Trends
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Chip
                icon={costChange >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                label={`${costChange >= 0 ? '+' : ''}${costChange.toFixed(1)}% vs prev month`}
                color={costChange > 20 ? 'warning' : 'default'}
                size="small"
              />
            </Box>
          </Box>

          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', mb: 0.5 }}>
              Current Period Spend: <strong style={{ color: monthlyLimit > 0 && currentPeriodCost > monthlyLimit ? '#ef4444' : '#4ade80' }}>
                {formatCurrency(currentPeriodCost)}
              </strong>
              {monthlyLimit > 0 && ` of ${formatCurrency(monthlyLimit)} budget`}
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
              Historical spending across billing periods
            </Typography>
          </Box>

          <Suspense fallback={<ChartLoadingFallback />}>
            <ResponsiveContainer width="100%" height={300}>
              <LazyLineChart data={movingAverageData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis 
                  dataKey="period" 
                  stroke="rgba(255,255,255,0.7)"
                  tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 12 }}
                />
                <YAxis 
                  stroke="rgba(255,255,255,0.7)"
                  tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 12 }}
                  tickFormatter={(value) => formatCurrency(value)}
                />
                <RechartsTooltip content={<CustomTooltip />} />
                
                {/* Monthly Spend Line */}
                <Line 
                  type="monotone" 
                  dataKey="cost" 
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ fill: '#3b82f6', r: 4 }}
                  name="Monthly Spend"
                  animationDuration={1000}
                  animationBegin={0}
                />
                
                {/* 3-Period Moving Average */}
                <Line 
                  type="monotone" 
                  dataKey="movingAvg" 
                  stroke="#4ade80"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                  name="3-Period Avg"
                  animationDuration={1000}
                  animationBegin={200}
                />
                
                {/* Budget Limit Reference Line */}
                {monthlyLimit > 0 && (
                  <ReferenceLine 
                    y={monthlyLimit} 
                    stroke="#ef4444" 
                    strokeDasharray="3 3"
                    label={{ value: "Budget Limit", position: "right", fill: "#ef4444" }}
                  />
                )}
              </LazyLineChart>
            </ResponsiveContainer>
          </Suspense>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default CostVelocityChart;
