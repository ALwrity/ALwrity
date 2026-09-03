import React from 'react';
import { SafeResponsiveContainer } from '../SafeResponsiveContainer';
import {
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ComposedChart
} from 'recharts';
import { Box, Typography, Paper, useTheme } from '@mui/material';

// Color palette for charts
const CHART_COLORS = {
  primary: '#667eea',
  secondary: '#764ba2',
  success: '#4caf50',
  warning: '#ff9800',
  error: '#f44336',
  info: '#2196f3',
  light: '#f5f5f5',
  dark: '#333333'
};

// Performance Trend Chart Component
interface PerformanceTrendChartProps {
  data: Array<{
    date: string;
    traffic_growth: number;
    engagement_rate: number;
    conversion_rate: number;
    content_quality_score: number;
  }>;
  title?: string;
  height?: number;
}

const PerformanceTrendChart: React.FC<PerformanceTrendChartProps> = ({
  data,
  title = 'Performance Trends',
  height = 400
}) => {
  const theme = useTheme();

  return (
    <Paper elevation={2} sx={{ p: 3, height }}>
      <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
        {title}
      </Typography>
      <SafeResponsiveContainer width="100%" height="85%">
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
          <XAxis 
            dataKey="date" 
            stroke={theme.palette.text.secondary}
            fontSize={12}
          />
          <YAxis 
            stroke={theme.palette.text.secondary}
            fontSize={12}
          />
          <Tooltip 
            contentStyle={{
              backgroundColor: theme.palette.background.paper,
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: 8
            }}
          />
          <Legend />
          <Area
            type="monotone"
            dataKey="content_quality_score"
            stackId="1"
            stroke={CHART_COLORS.info}
            fill={CHART_COLORS.info}
            fillOpacity={0.3}
            name="Content Quality Score"
          />
          <Line
            type="monotone"
            dataKey="traffic_growth"
            stroke={CHART_COLORS.primary}
            strokeWidth={3}
            dot={{ fill: CHART_COLORS.primary, strokeWidth: 2, r: 4 }}
            name="Traffic Growth (%)"
          />
          <Line
            type="monotone"
            dataKey="engagement_rate"
            stroke={CHART_COLORS.success}
            strokeWidth={3}
            dot={{ fill: CHART_COLORS.success, strokeWidth: 2, r: 4 }}
            name="Engagement Rate (%)"
          />
          <Line
            type="monotone"
            dataKey="conversion_rate"
            stroke={CHART_COLORS.warning}
            strokeWidth={3}
            dot={{ fill: CHART_COLORS.warning, strokeWidth: 2, r: 4 }}
            name="Conversion Rate (%)"
          />
        </ComposedChart>
      </SafeResponsiveContainer>
    </Paper>
  );
};

// Quality Metrics Radar Chart Component
interface QualityMetricsRadarProps {
  data: Array<{
    metric: string;
    score: number;
    target: number;
  }>;
  title?: string;
  height?: number;
}

const QualityMetricsRadar: React.FC<QualityMetricsRadarProps> = ({
  data,
  title = 'Quality Metrics Analysis',
  height = 400
}) => {
  const theme = useTheme();

  return (
    <Paper elevation={2} sx={{ p: 3, height }}>
      <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
        {title}
      </Typography>
      <SafeResponsiveContainer width="100%" height="85%">
        <RadarChart data={data}>
          <PolarGrid stroke={theme.palette.divider} />
          <PolarAngleAxis 
            dataKey="metric" 
            tick={{ fill: theme.palette.text.primary, fontSize: 12 }}
          />
          <PolarRadiusAxis 
            angle={90} 
            domain={[0, 100]}
            tick={{ fill: theme.palette.text.secondary, fontSize: 10 }}
          />
          <Radar
            name="Current Score"
            dataKey="score"
            stroke={CHART_COLORS.primary}
            fill={CHART_COLORS.primary}
            fillOpacity={0.3}
          />
          <Radar
            name="Target Score"
            dataKey="target"
            stroke={CHART_COLORS.success}
            fill={CHART_COLORS.success}
            fillOpacity={0.1}
            strokeDasharray="5 5"
          />
          <Legend />
          <Tooltip 
            contentStyle={{
              backgroundColor: theme.palette.background.paper,
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: 8
            }}
          />
        </RadarChart>
      </SafeResponsiveContainer>
    </Paper>
  );
};

// Performance Metrics Bar Chart Component
interface PerformanceMetricsBarProps {
  data: Array<{
    metric: string;
    value: number;
    target: number;
    status: 'excellent' | 'good' | 'needs_attention';
  }>;
  title?: string;
  height?: number;
}

const PerformanceMetricsBar: React.FC<PerformanceMetricsBarProps> = ({
  data,
  title = 'Performance Metrics',
  height = 400
}) => {
  const theme = useTheme();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'excellent': return CHART_COLORS.success;
      case 'good': return CHART_COLORS.warning;
      case 'needs_attention': return CHART_COLORS.error;
      default: return CHART_COLORS.primary;
    }
  };

  return (
    <Paper elevation={2} sx={{ p: 3, height }}>
      <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
        {title}
      </Typography>
      <SafeResponsiveContainer width="100%" height="85%">
        <BarChart data={data} layout="horizontal">
          <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
          <XAxis 
            type="number"
            stroke={theme.palette.text.secondary}
            fontSize={12}
          />
          <YAxis 
            type="category"
            dataKey="metric"
            stroke={theme.palette.text.secondary}
            fontSize={12}
            width={120}
          />
          <Tooltip 
            contentStyle={{
              backgroundColor: theme.palette.background.paper,
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: 8
            }}
          />
          <Legend />
          <Bar 
            dataKey="value" 
            fill={CHART_COLORS.primary}
            radius={[0, 4, 4, 0]}
          >
            {data.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={getStatusColor(entry.status)}
              />
            ))}
          </Bar>
          <Bar 
            dataKey="target" 
            fill={CHART_COLORS.info}
            fillOpacity={0.5}
            radius={[0, 4, 4, 0]}
          />
        </BarChart>
      </SafeResponsiveContainer>
    </Paper>
  );
};

// Content Distribution Pie Chart Component
interface ContentDistributionPieProps {
  data: Array<{
    name: string;
    value: number;
    color?: string;
  }>;
  title?: string;
  height?: number;
}

const ContentDistributionPie: React.FC<ContentDistributionPieProps> = ({
  data,
  title = 'Content Distribution',
  height = 400
}) => {
  const theme = useTheme();

  const COLORS = [
    CHART_COLORS.primary,
    CHART_COLORS.secondary,
    CHART_COLORS.success,
    CHART_COLORS.warning,
    CHART_COLORS.error,
    CHART_COLORS.info
  ];

  return (
    <Paper elevation={2} sx={{ p: 3, height }}>
      <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
        {title}
      </Typography>
      <SafeResponsiveContainer width="100%" height="85%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, value }) => `${name} ${value}`}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={entry.color || COLORS[index % COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{
              backgroundColor: theme.palette.background.paper,
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: 8
            }}
          />
        </PieChart>
      </SafeResponsiveContainer>
    </Paper>
  );
};

// Real-time Performance Gauge Component
interface PerformanceGaugeProps {
  value: number;
  maxValue: number;
  title: string;
  color?: string;
  size?: number;
}

const PerformanceGauge: React.FC<PerformanceGaugeProps> = ({
  value,
  maxValue,
  title,
  color = CHART_COLORS.primary,
  size = 200
}) => {
  const percentage = (value / maxValue) * 100;
  const circumference = 2 * Math.PI * 80; // radius = 80
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <Box sx={{ textAlign: 'center', p: 2 }}>
      <Typography variant="h6" gutterBottom>
        {title}
      </Typography>
      <Box sx={{ position: 'relative', display: 'inline-block' }}>
        <svg width={size} height={size} viewBox="0 0 200 200">
          {/* Background circle */}
          <circle
            cx="100"
            cy="100"
            r="80"
            fill="none"
            stroke="#e0e0e0"
            strokeWidth="12"
          />
          {/* Progress circle */}
          <circle
            cx="100"
            cy="100"
            r="80"
            fill="none"
            stroke={color}
            strokeWidth="12"
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            transform="rotate(-90 100 100)"
          />
        </svg>
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center'
          }}
        >
          <Typography variant="h4" sx={{ fontWeight: 'bold', color }}>
            {value}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            of {maxValue}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

// Export all components
export {
  PerformanceTrendChart,
  QualityMetricsRadar,
  PerformanceMetricsBar,
  ContentDistributionPie,
  PerformanceGauge
};
