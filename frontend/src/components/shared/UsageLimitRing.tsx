import React, { Suspense } from 'react';
import { Box, Typography } from '@mui/material';
import { LazyPieChart, Pie, Cell, ResponsiveContainer, ChartLoadingFallback } from '../../utils/lazyRecharts';
import { SafeResponsiveContainer } from './SafeResponsiveContainer';
import { motion } from 'framer-motion';

interface UsageLimitRingProps {
  used: number;
  limit: number;
  label: string;
  color: string;
  size?: number;
  showValue?: boolean;
  terminalTheme?: boolean;
  terminalColors?: any;
}

/**
 * UsageLimitRing - Circular progress ring showing usage vs limit
 * 
 * Usage:
 *   <UsageLimitRing 
 *     used={75} 
 *     limit={100} 
 *     label="Calls" 
 *     color="#4ade80"
 *   />
 */
export const UsageLimitRing: React.FC<UsageLimitRingProps> = ({ 
  used, 
  limit, 
  label, 
  color,
  size = 120,
  showValue = true,
  terminalTheme = false,
  terminalColors
}) => {
  const percentage = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  const remaining = Math.max(0, limit - used);
  
  const data = [
    { name: 'Used', value: used },
    { name: 'Remaining', value: remaining }
  ];

  // Determine color based on percentage
  const getRingColor = () => {
    if (percentage >= 90) return '#ef4444'; // Red
    if (percentage >= 75) return '#f59e0b'; // Orange
    if (percentage >= 50) return '#eab308'; // Yellow
    return color || '#22c55e'; // Green or provided color
  };

  const ringColor = getRingColor();

  return (
    <Box sx={{ position: 'relative', width: size, height: size }}>
      <Suspense fallback={<ChartLoadingFallback />}>
        <SafeResponsiveContainer width="100%" height="100%">
          <LazyPieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={size * 0.35}
              outerRadius={size * 0.45}
              startAngle={90}
              endAngle={-270}
              dataKey="value"
              animationBegin={0}
              animationDuration={1000}
            >
              <Cell fill={ringColor} />
              <Cell fill={terminalTheme 
                ? (terminalColors?.backgroundLight || 'rgba(255,255,255,0.1)')
                : 'rgba(255,255,255,0.1)'} 
              />
            </Pie>
          </LazyPieChart>
        </SafeResponsiveContainer>
      </Suspense>
      <Box sx={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        textAlign: 'center',
        pointerEvents: 'none'
      }}>
        {showValue && (
          <>
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.4 }}
            >
              <Typography 
                variant="h6" 
                sx={{ 
                  fontWeight: 'bold',
                  color: terminalTheme 
                    ? (terminalColors?.text || '#ffffff')
                    : '#ffffff',
                  fontSize: size * 0.15,
                  lineHeight: 1.2
                }}
              >
                {Math.round(percentage)}%
              </Typography>
            </motion.div>
            <Typography 
              variant="caption" 
              sx={{ 
                fontSize: size * 0.08,
                color: terminalTheme 
                  ? (terminalColors?.textSecondary || 'rgba(255,255,255,0.7)')
                  : 'rgba(255,255,255,0.7)',
                display: 'block',
                mt: 0.5
              }}
            >
              {label}
            </Typography>
          </>
        )}
      </Box>
    </Box>
  );
};

export default UsageLimitRing;
