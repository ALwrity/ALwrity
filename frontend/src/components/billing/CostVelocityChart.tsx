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
  TrendingDown,
  AlertTriangle
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
import { SafeResponsiveContainer } from '../shared/SafeResponsiveContainer';

// Types
import { UsageTrends as UsageTrendsType, CostProjections } from '../../types/billing';

// Utils
import { formatCurrency } from '../../services/billingService';

interface CostVelocityChartProps {
  trends: UsageTrendsType;
  projections: CostProjections;
  monthlyLimit: number;
}

/**
 * CostVelocityChart - Shows daily spending rate (cost velocity) over time
 * with projected monthly cost and budget limit annotations
 */
const CostVelocityChart: React.FC<CostVelocityChartProps> = ({ 
  trends, 
  projections,
  monthlyLimit
}) => {
  // Calculate daily spending rate for each period
  const velocityData = useMemo(() => {
    if (!trends.periods || trends.periods.length === 0) {
      return [];
    }

    const data = [];
    const currentDate = new Date();
    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();

    for (let i = 0; i < trends.periods.length; i++) {
      const period = trends.periods[i];
      const cost = trends.total_cost[i] || 0;
      
      // Parse period (assuming format like "2025-01" or day number)
      // For monthly periods, calculate daily average
      const dayNumber = i + 1; // Approximate day in month
      const dailyRate = dayNumber > 0 ? cost / dayNumber : 0;
      const projectedMonthly = dailyRate * daysInMonth;

      data.push({
        period,
        day: dayNumber,
        dailyRate,
        projectedMonthly,
        actualCost: cost
      });
    }

    return data;
  }, [trends]);

  // Calculate 7-day moving average
  const movingAverageData = useMemo(() => {
    if (velocityData.length === 0) return [];
    
    const windowSize = Math.min(7, velocityData.length);
    return velocityData.map((point, index) => {
      const start = Math.max(0, index - windowSize + 1);
      const window = velocityData.slice(start, index + 1);
      const avg = window.reduce((sum, p) => sum + p.dailyRate, 0) / window.length;
      return { ...point, movingAvg: avg };
    });
  }, [velocityData]);

  // Current velocity metrics
  const currentVelocity = velocityData.length > 0 
    ? velocityData[velocityData.length - 1].dailyRate 
    : 0;
  const projectedCost = projections.projected_monthly_cost || 0;
  const isOverBudget = projectedCost > monthlyLimit;

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
            Day {data.day}
          </Typography>
          <Typography variant="body2">
            Daily Rate: {formatCurrency(data.dailyRate)}
          </Typography>
          <Typography variant="body2">
            7-Day Avg: {formatCurrency(data.movingAvg || 0)}
          </Typography>
          <Typography variant="body2">
            Projected Monthly: {formatCurrency(data.projectedMonthly)}
          </Typography>
        </Box>
      );
    }
    return null;
  };

  if (velocityData.length === 0) {
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
              Cost Velocity Trend
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              {isOverBudget && (
                <Chip
                  icon={<AlertTriangle size={14} />}
                  label="Over Budget"
                  color="error"
                  size="small"
                />
              )}
              <Chip
                icon={currentVelocity > (monthlyLimit / 30) ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                label={`${formatCurrency(currentVelocity)}/day`}
                color={isOverBudget ? 'error' : 'default'}
                size="small"
              />
            </Box>
          </Box>

          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', mb: 0.5 }}>
              Projected Monthly Cost: <strong style={{ color: isOverBudget ? '#ef4444' : '#4ade80' }}>
                {formatCurrency(projectedCost)}
              </strong>
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
              Based on current daily spending rate
            </Typography>
          </Box>

          <Suspense fallback={<ChartLoadingFallback />}>
            <SafeResponsiveContainer width="100%" height={300}>
              <LazyLineChart data={movingAverageData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis 
                  dataKey="day" 
                  stroke="rgba(255,255,255,0.7)"
                  tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 12 }}
                />
                <YAxis 
                  stroke="rgba(255,255,255,0.7)"
                  tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 12 }}
                  tickFormatter={(value) => formatCurrency(value)}
                />
                <RechartsTooltip content={<CustomTooltip />} />
                
                {/* Daily Rate Line */}
                <Line 
                  type="monotone" 
                  dataKey="dailyRate" 
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ fill: '#3b82f6', r: 4 }}
                  name="Daily Rate"
                  animationDuration={1000}
                  animationBegin={0}
                />
                
                {/* 7-Day Moving Average */}
                <Line 
                  type="monotone" 
                  dataKey="movingAvg" 
                  stroke="#4ade80"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                  name="7-Day Avg"
                  animationDuration={1000}
                  animationBegin={200}
                />
                
                {/* Budget Limit Reference Line */}
                <ReferenceLine 
                  y={monthlyLimit / 30} 
                  stroke="#ef4444" 
                  strokeDasharray="3 3"
                  label={{ value: "Budget Limit", position: "right", fill: "#ef4444" }}
                />
              </LazyLineChart>
            </SafeResponsiveContainer>
          </Suspense>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default CostVelocityChart;
