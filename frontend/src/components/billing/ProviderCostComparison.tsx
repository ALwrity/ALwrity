import React, { Suspense } from 'react';
import {
  Box,
  Typography,
  Tooltip as MuiTooltip,
} from '@mui/material';
import { motion } from 'framer-motion';
import { 
  LazyBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
  ChartLoadingFallback
} from '../../utils/lazyRecharts';
import { SafeResponsiveContainer } from '../shared/SafeResponsiveContainer';

// Types
import { ProviderBreakdown } from '../../types/billing';

// Utils
import { 
  formatCurrency, 
  getProviderColor,
  getProviderIcon
} from '../../services/billingService';

interface ProviderCostComparisonProps {
  providerBreakdown: ProviderBreakdown;
  terminalTheme?: boolean;
  terminalColors?: any;
}

/**
 * ProviderCostComparison - Horizontal bar chart comparing costs across providers
 * 
 * Usage:
 *   <ProviderCostComparison providerBreakdown={breakdown} />
 */
const ProviderCostComparison: React.FC<ProviderCostComparisonProps> = ({ 
  providerBreakdown,
  terminalTheme = false,
  terminalColors
}) => {
  // Transform data for chart
  const chartData = Object.entries(providerBreakdown)
    .filter(([_, data]) => data && (data.cost ?? 0) > 0)
    .map(([provider, data]) => ({
      name: provider.charAt(0).toUpperCase() + provider.slice(1),
      cost: data?.cost ?? 0,
      calls: data?.calls ?? 0,
      tokens: data?.tokens ?? 0,
      color: getProviderColor(provider),
      icon: getProviderIcon(provider)
    }))
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 5); // Top 5 providers

  if (chartData.length === 0) {
    return null;
  }

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
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
            {data.icon} {data.name}
          </Typography>
          <Typography variant="body2">
            Cost: {formatCurrency(data.cost)}
          </Typography>
          <Typography variant="body2">
            Calls: {data.calls.toLocaleString()}
          </Typography>
          <Typography variant="body2">
            Tokens: {data.tokens.toLocaleString()}
          </Typography>
        </Box>
      );
    }
    return null;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
    >
      <Box sx={{ mt: 2 }}>
        <Typography 
          variant="subtitle2" 
          sx={{ 
            fontWeight: 600,
            mb: 1.5,
            color: terminalTheme 
              ? (terminalColors?.text || '#ffffff')
              : 'rgba(255,255,255,0.9)'
          }}
        >
          Provider Cost Comparison
        </Typography>
        
        <Suspense fallback={<ChartLoadingFallback />}>
          <SafeResponsiveContainer width="100%" height={200}>
            <LazyBarChart 
              data={chartData} 
              layout="vertical"
              margin={{ top: 5, right: 20, bottom: 5, left: 60 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={terminalTheme 
                ? (terminalColors?.border || 'rgba(255,255,255,0.1)')
                : 'rgba(255,255,255,0.1)'} 
              />
              <XAxis 
                type="number"
                stroke={terminalTheme 
                  ? (terminalColors?.textSecondary || 'rgba(255,255,255,0.7)')
                  : 'rgba(255,255,255,0.7)'}
                tick={{ fill: terminalTheme 
                  ? (terminalColors?.textSecondary || 'rgba(255,255,255,0.7)')
                  : 'rgba(255,255,255,0.7)', fontSize: 11 }}
                tickFormatter={(value) => formatCurrency(value)}
              />
              <YAxis 
                type="category"
                dataKey="name"
                stroke={terminalTheme 
                  ? (terminalColors?.textSecondary || 'rgba(255,255,255,0.7)')
                  : 'rgba(255,255,255,0.7)'}
                tick={{ fill: terminalTheme 
                  ? (terminalColors?.textSecondary || 'rgba(255,255,255,0.7)')
                  : 'rgba(255,255,255,0.7)', fontSize: 11 }}
                width={55}
              />
              <RechartsTooltip content={<CustomTooltip />} />
              <Bar 
                dataKey="cost" 
                radius={[0, 4, 4, 0]}
                animationDuration={800}
                animationBegin={0}
              >
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`}
                    fill={entry.color}
                  />
                ))}
              </Bar>
            </LazyBarChart>
          </SafeResponsiveContainer>
        </Suspense>
      </Box>
    </motion.div>
  );
};

export default ProviderCostComparison;
