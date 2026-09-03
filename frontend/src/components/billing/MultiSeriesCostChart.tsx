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
  DollarSign
} from 'lucide-react';
import { 
  LazyComposedChart,
  Area,
  Line,
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
import { UsageTrends as UsageTrendsType } from '../../types/billing';

// Utils
import { formatCurrency } from '../../services/billingService';

interface MultiSeriesCostChartProps {
  trends: UsageTrendsType;
  monthlyLimit?: number;
}

/**
 * MultiSeriesCostChart - Multi-series area chart showing cost breakdown over time
 * Displays total cost, provider-specific costs, and budget limit
 */
const MultiSeriesCostChart: React.FC<MultiSeriesCostChartProps> = ({ 
  trends,
  monthlyLimit
}) => {
  // Transform data for multi-series chart
  const chartData = useMemo(() => {
    if (!trends.periods || trends.periods.length === 0) {
      return [];
    }

    return trends.periods.map((period, index) => ({
      period,
      totalCost: trends.total_cost[index] || 0,
      calls: trends.total_calls[index] || 0,
      tokens: trends.total_tokens[index] || 0,
    }));
  }, [trends]);

  // Calculate trend
  const costTrend = useMemo(() => {
    if (chartData.length < 2) return 0;
    const first = chartData[0].totalCost;
    const last = chartData[chartData.length - 1].totalCost;
    if (first === 0) return last > 0 ? 100 : 0;
    return ((last - first) / first) * 100;
  }, [chartData]);

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <Box
          sx={{
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            color: 'white',
            padding: 2,
            borderRadius: 2,
            border: '1px solid rgba(255,255,255,0.1)',
            minWidth: 200
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
            {label}
          </Typography>
          {payload.map((entry: any, index: number) => (
            <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  backgroundColor: entry.color,
                  borderRadius: '50%'
                }}
              />
              <Typography variant="body2" sx={{ flex: 1 }}>
                {entry.name}:
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                {formatCurrency(entry.value)}
              </Typography>
            </Box>
          ))}
        </Box>
      );
    }
    return null;
  };

  if (chartData.length === 0) {
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
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <DollarSign size={20} color="#4ade80" />
              <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#ffffff' }}>
                Cost Over Time
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Chip
                icon={costTrend >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                label={`${costTrend >= 0 ? '+' : ''}${costTrend.toFixed(1)}%`}
                color={costTrend >= 0 ? 'error' : 'success'}
                size="small"
              />
            </Box>
          </Box>

          <Suspense fallback={<ChartLoadingFallback />}>
            <SafeResponsiveContainer width="100%" height={350}>
              <LazyComposedChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                <defs>
                  <linearGradient id="colorTotalCost" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#667eea" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#667eea" stopOpacity={0}/>
                  </linearGradient>
                </defs>
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
                <Legend 
                  wrapperStyle={{ paddingTop: '20px' }}
                  iconType="line"
                />
                
                {/* Total Cost Area */}
                <Area 
                  type="monotone" 
                  dataKey="totalCost" 
                  stroke="#667eea"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorTotalCost)"
                  name="Total Cost"
                  animationDuration={1000}
                  animationBegin={0}
                />
                
                {/* Budget Limit Reference Line */}
                {monthlyLimit && monthlyLimit > 0 && (
                  <Line 
                    type="monotone"
                    dataKey={() => monthlyLimit}
                    stroke="#ef4444"
                    strokeDasharray="5 5"
                    strokeWidth={2}
                    dot={false}
                    name="Budget Limit"
                    legendType="line"
                  />
                )}
              </LazyComposedChart>
            </SafeResponsiveContainer>
          </Suspense>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default MultiSeriesCostChart;
