import React from 'react';
import { SafeResponsiveContainer } from '../shared/SafeResponsiveContainer';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Grid,
  Chip,
} from '@mui/material';
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { 
  PieChart as PieChartIcon
} from 'lucide-react';

// Types
import { ProviderBreakdown } from '../../types/billing';

// Utils
import { 
  formatCurrency, 
  formatNumber,
  getProviderIcon,
  getProviderColor
} from '../../services/billingService';

interface CostBreakdownProps {
  providerBreakdown: ProviderBreakdown;
  totalCost: number;
}

const CostBreakdown: React.FC<CostBreakdownProps> = ({ 
  providerBreakdown, 
  totalCost 
}) => {
  // Transform data for pie chart
  const chartData = Object.entries(providerBreakdown)
    .filter(([_, data]) => data && data.cost > 0)
    .map(([provider, data]) => ({
      name: provider.charAt(0).toUpperCase() + provider.slice(1),
      value: data?.cost ?? 0,
      calls: data?.calls ?? 0,
      tokens: data?.tokens ?? 0,
      color: getProviderColor(provider),
      icon: getProviderIcon(provider)
    }))
    .sort((a, b) => b.value - a.value);

  // Custom tooltip for pie chart
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
            Cost: {formatCurrency(data.value)}
          </Typography>
          <Typography variant="body2">
            Calls: {formatNumber(data.calls)}
          </Typography>
          <Typography variant="body2">
            Tokens: {formatNumber(data.tokens)}
          </Typography>
        </Box>
      );
    }
    return null;
  };

  // Custom label for pie chart
  const renderLabel = (entry: any) => {
    const percent = ((entry.value / totalCost) * 100).toFixed(1);
    return `${entry.name}: ${percent}%`;
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
            <PieChartIcon size={20} />
            Cost Breakdown by Provider
          </Typography>
        </CardContent>

        <CardContent sx={{ pt: 0 }}>
          {/* Pie Chart */}
          <Box sx={{ height: 300, mb: 3 }}>
            <SafeResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={renderLabel}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  animationBegin={0}
                  animationDuration={1000}
                >
                  {chartData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.color}
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </SafeResponsiveContainer>
          </Box>

          {/* Provider Details */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 'bold' }}>
              Provider Details
            </Typography>
            <Grid container spacing={2}>
              {chartData.map((provider, index) => {
                const percentage = ((provider.value / totalCost) * 100).toFixed(1);
                return (
                  <Grid item xs={12} sm={6} key={provider.name}>
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.1 }}
                    >
                      <Box
                        sx={{
                          p: 2,
                          backgroundColor: 'rgba(255,255,255,0.05)',
                          borderRadius: 2,
                          border: '1px solid rgba(255,255,255,0.1)',
                          position: 'relative'
                        }}
                      >
                        {/* Provider Header */}
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <span style={{ fontSize: '18px' }}>{provider.icon}</span>
                            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                              {provider.name}
                            </Typography>
                          </Box>
                          <Chip
                            label={`${percentage}%`}
                            size="small"
                            sx={{
                              backgroundColor: `${provider.color}20`,
                              color: provider.color,
                              fontWeight: 'bold'
                            }}
                          />
                        </Box>

                        {/* Metrics */}
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                            Cost:
                          </Typography>
                          <Typography variant="caption" sx={{ fontWeight: 'bold', color: '#ffffff' }}>
                            {formatCurrency(provider.value)}
                          </Typography>
                        </Box>
                        
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                            Calls:
                          </Typography>
                          <Typography variant="caption" sx={{ fontWeight: 'bold', color: '#ffffff' }}>
                            {formatNumber(provider.calls)}
                          </Typography>
                        </Box>
                        
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                            Tokens:
                          </Typography>
                          <Typography variant="caption" sx={{ fontWeight: 'bold', color: '#ffffff' }}>
                            {formatNumber(provider.tokens)}
                          </Typography>
                        </Box>

                        {/* Progress bar */}
                        <Box sx={{ mt: 1 }}>
                          <Box
                            sx={{
                              height: 4,
                              backgroundColor: 'rgba(255,255,255,0.1)',
                              borderRadius: 2,
                              overflow: 'hidden'
                            }}
                          >
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${percentage}%` }}
                              transition={{ duration: 1, delay: index * 0.1 }}
                              style={{
                                height: '100%',
                                backgroundColor: provider.color,
                                borderRadius: 2
                              }}
                            />
                          </Box>
                        </Box>
                      </Box>
                    </motion.div>
                  </Grid>
                );
              })}
            </Grid>
          </Box>

          {/* Summary Stats */}
          <Box 
            sx={{ 
              p: 2, 
              backgroundColor: 'rgba(255,255,255,0.05)',
              borderRadius: 2,
              border: '1px solid rgba(255,255,255,0.1)'
            }}
          >
            <Typography variant="body2" sx={{ mb: 1, color: 'rgba(255,255,255,0.8)' }}>
              Total Monthly Cost
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#ffffff' }}>
              {formatCurrency(totalCost)}
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
              Across {chartData.length} active providers
            </Typography>
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
            background: 'radial-gradient(circle, rgba(102, 126, 234, 0.1) 0%, transparent 70%)',
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
            background: 'radial-gradient(circle, rgba(118, 75, 162, 0.1) 0%, transparent 70%)',
            borderRadius: '50%',
            pointerEvents: 'none'
          }}
        />
      </Card>
    </motion.div>
  );
};

export default CostBreakdown;
