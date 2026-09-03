import React, { Suspense, useMemo } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Tooltip as MuiTooltip,
} from '@mui/material';
import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react';
import { 
  LazyPieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  ChartLoadingFallback
} from '../../utils/lazyRecharts';
import { SafeResponsiveContainer } from '../shared/SafeResponsiveContainer';
import { SystemHealth } from '../../types/monitoring';

interface ErrorRateGaugeProps {
  systemHealth: SystemHealth | null;
  terminalTheme?: boolean;
  terminalColors?: any;
}

/**
 * ErrorRateGauge - Semi-circular gauge showing API error rate
 * 
 * Visual gauge with:
 * - Green (0-5%): Healthy
 * - Yellow (5-10%): Warning
 * - Red (>10%): Critical
 */
const ErrorRateGauge: React.FC<ErrorRateGaugeProps> = ({
  systemHealth,
  terminalTheme = false,
  terminalColors
}) => {
  const errorRate = systemHealth?.error_rate || 0;
  const recentRequests = systemHealth?.recent_requests || 0;
  const recentErrors = systemHealth?.recent_errors || 0;

  // Determine status and color
  const { status, color, icon } = useMemo(() => {
    if (errorRate <= 5) {
      return {
        status: 'Healthy',
        color: terminalTheme ? (terminalColors?.success || '#22c55e') : '#22c55e',
        icon: <CheckCircle size={20} color="#22c55e" />
      };
    } else if (errorRate <= 10) {
      return {
        status: 'Warning',
        color: terminalTheme ? (terminalColors?.warning || '#f59e0b') : '#f59e0b',
        icon: <AlertCircle size={20} color="#f59e0b" />
      };
    } else {
      return {
        status: 'Critical',
        color: terminalTheme ? (terminalColors?.error || '#ef4444') : '#ef4444',
        icon: <AlertTriangle size={20} color="#ef4444" />
      };
    }
  }, [errorRate, terminalTheme, terminalColors]);

  // Data for semi-circular gauge (using Pie chart)
  const gaugeData = [
    { name: 'Errors', value: errorRate, fill: color },
    { name: 'Success', value: Math.max(0, 100 - errorRate), fill: 'rgba(255,255,255,0.1)' }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
    >
      <Card 
        sx={{ 
          height: '100%',
          background: terminalTheme
            ? (terminalColors?.background || 'rgba(0,0,0,0.8)')
            : 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
          backdropFilter: 'blur(10px)',
          border: `1px solid ${terminalTheme 
            ? (terminalColors?.border || 'rgba(255,255,255,0.1)')
            : 'rgba(255,255,255,0.1)'}`,
          borderRadius: 3,
        }}
      >
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            {icon}
            <Typography variant="h6" sx={{ fontWeight: 'bold', color: terminalTheme ? terminalColors?.text : '#ffffff' }}>
              Error Rate Gauge
            </Typography>
          </Box>

          <Box sx={{ position: 'relative', height: 200, mb: 2 }}>
            <Suspense fallback={<ChartLoadingFallback />}>
              <SafeResponsiveContainer width="100%" height="100%">
                <LazyPieChart>
                  <Pie
                    data={gaugeData}
                    cx="50%"
                    cy="80%"
                    startAngle={180}
                    endAngle={0}
                    innerRadius={60}
                    outerRadius={80}
                    dataKey="value"
                    animationDuration={1000}
                    animationBegin={0}
                  >
                    <Cell fill={color} />
                    <Cell fill={terminalTheme 
                      ? (terminalColors?.backgroundLight || 'rgba(255,255,255,0.1)')
                      : 'rgba(255,255,255,0.1)'} 
                    />
                  </Pie>
                </LazyPieChart>
              </SafeResponsiveContainer>
            </Suspense>
            
            {/* Center value display */}
            <Box
              sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                textAlign: 'center',
                mt: 2
              }}
            >
              <Typography
                variant="h3"
                sx={{
                  fontWeight: 800,
                  color: color,
                  textShadow: terminalTheme ? 'none' : '0 2px 8px rgba(0,0,0,0.3)'
                }}
              >
                {errorRate.toFixed(1)}%
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color: terminalTheme 
                    ? (terminalColors?.textSecondary || 'rgba(255,255,255,0.7)')
                    : 'rgba(255,255,255,0.7)',
                  fontSize: '0.7rem',
                  textTransform: 'uppercase',
                  letterSpacing: '1px'
                }}
              >
                Error Rate
              </Typography>
            </Box>
          </Box>

          {/* Stats */}
          <Box sx={{ display: 'flex', justifyContent: 'space-around', gap: 2 }}>
            <MuiTooltip title="Total API requests in the last 5 minutes">
              <Box sx={{ textAlign: 'center' }}>
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 'bold',
                    color: terminalTheme ? terminalColors?.text : '#ffffff'
                  }}
                >
                  {recentRequests.toLocaleString()}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    color: terminalTheme 
                      ? (terminalColors?.textSecondary || 'rgba(255,255,255,0.7)')
                      : 'rgba(255,255,255,0.7)',
                    fontSize: '0.7rem'
                  }}
                >
                  Requests
                </Typography>
              </Box>
            </MuiTooltip>
            <MuiTooltip title="Failed requests in the last 5 minutes">
              <Box sx={{ textAlign: 'center' }}>
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 'bold',
                    color: color
                  }}
                >
                  {recentErrors.toLocaleString()}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    color: terminalTheme 
                      ? (terminalColors?.textSecondary || 'rgba(255,255,255,0.7)')
                      : 'rgba(255,255,255,0.7)',
                    fontSize: '0.7rem'
                  }}
                >
                  Errors
                </Typography>
              </Box>
            </MuiTooltip>
            <MuiTooltip title="System health status">
              <Box sx={{ textAlign: 'center' }}>
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 'bold',
                    color: color,
                    textTransform: 'capitalize'
                  }}
                >
                  {status}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    color: terminalTheme 
                      ? (terminalColors?.textSecondary || 'rgba(255,255,255,0.7)')
                      : 'rgba(255,255,255,0.7)',
                    fontSize: '0.7rem'
                  }}
                >
                  Status
                </Typography>
              </Box>
            </MuiTooltip>
          </Box>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default ErrorRateGauge;
