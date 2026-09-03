/**
 * TrendsChart Component
 * 
 * Advanced chart visualization for Google Trends data using Recharts.
 * Displays interest over time with interactive tooltips and zoom capabilities.
 */

import React, { useMemo } from 'react';
import { SafeResponsiveContainer } from '../../../shared/SafeResponsiveContainer';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Box, Typography, useTheme } from '@mui/material';
import { GoogleTrendsData } from '../../types/intent.types';

interface TrendsChartProps {
  data: GoogleTrendsData;
  height?: number;
  showAverage?: boolean;
}

export const TrendsChart: React.FC<TrendsChartProps> = ({
  data,
  height = 300,
  showAverage = true,
}) => {
  const theme = useTheme();

  // Transform data for Recharts
  const chartData = useMemo(() => {
    if (!data.interest_over_time || data.interest_over_time.length === 0) {
      return [];
    }

    return data.interest_over_time.map((point: any) => {
      const result: any = {};
      
      // Extract date
      const dateKey = Object.keys(point).find(k => 
        k.toLowerCase().includes('date') || k === 'date'
      );
      if (dateKey && point[dateKey]) {
        const dateValue = point[dateKey];
        result.date = typeof dateValue === 'string' 
          ? new Date(dateValue).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          : dateValue;
        result.fullDate = typeof dateValue === 'string' ? dateValue : dateValue;
      }

      // Extract interest values for each keyword
      data.keywords.forEach((keyword, idx) => {
        // Find the value column for this keyword
        const valueKey = Object.keys(point).find(k => {
          const val = point[k];
          return typeof val === 'number' && val !== null && val !== undefined && k !== 'isPartial';
        });
        
        if (valueKey) {
          result[keyword] = point[valueKey];
        } else {
          // Try to find by index if keywords match column order
          const numericKeys = Object.keys(point).filter(k => {
            const val = point[k];
            return typeof val === 'number' && val !== null && val !== undefined && k !== 'isPartial';
          });
          if (numericKeys[idx]) {
            result[keyword] = point[numericKeys[idx]];
          }
        }
      });

      // Add isPartial flag if available
      if (point.isPartial !== undefined) {
        result.isPartial = point.isPartial;
      }

      return result;
    }).filter(item => item.date); // Filter out items without dates
  }, [data.interest_over_time, data.keywords]);

  // Calculate average if needed
  const averageValue = useMemo(() => {
    if (!showAverage || chartData.length === 0) return null;
    
    const allValues: number[] = [];
    chartData.forEach((point: any) => {
      data.keywords.forEach(keyword => {
        if (point[keyword] !== undefined && point[keyword] !== null) {
          allValues.push(point[keyword]);
        }
      });
    });
    
    if (allValues.length === 0) return null;
    return allValues.reduce((sum, val) => sum + val, 0) / allValues.length;
  }, [chartData, data.keywords, showAverage]);

  // Color palette for multiple keywords
  const colors = [
    theme.palette.primary.main,
    theme.palette.secondary.main,
    '#10b981', // green
    '#f59e0b', // amber
    '#ef4444', // red
    '#8b5cf6', // purple
  ];

  if (chartData.length === 0) {
    return (
      <Box sx={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          No trend data available
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%', height }}>
      <SafeResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
          <XAxis
            dataKey="date"
            stroke={theme.palette.text.secondary}
            style={{ fontSize: '12px' }}
            angle={-45}
            textAnchor="end"
            height={60}
            interval="preserveStartEnd"
          />
          <YAxis
            stroke={theme.palette.text.secondary}
            style={{ fontSize: '12px' }}
            domain={[0, 100]}
            label={{ 
              value: 'Interest (0-100)', 
              angle: -90, 
              position: 'insideLeft',
              style: { fontSize: '12px', fill: theme.palette.text.secondary }
            }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: theme.palette.background.paper,
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: '8px',
            }}
            formatter={(value: any, name: any) => {
              if (typeof value === 'number') {
                return [`${Math.round(value)}`, String(name)];
              }
              return [value, String(name)];
            }}
            labelFormatter={(label) => `Date: ${label}`}
          />
          {data.keywords.length > 1 && (
            <Legend
              wrapperStyle={{ paddingTop: '20px' }}
              iconType="line"
            />
          )}
          {showAverage && averageValue !== null && (
            <ReferenceLine
              y={averageValue}
              stroke={theme.palette.text.secondary}
              strokeDasharray="5 5"
              label={{ 
                value: `Avg: ${Math.round(averageValue)}`, 
                position: 'right',
                style: { fontSize: '11px', fill: theme.palette.text.secondary }
              }}
            />
          )}
          {data.keywords.map((keyword, idx) => (
            <Line
              key={keyword}
              type="monotone"
              dataKey={keyword}
              stroke={colors[idx % colors.length]}
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
              name={keyword}
            />
          ))}
        </LineChart>
      </SafeResponsiveContainer>
      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block', textAlign: 'center' }}>
        Values are normalized (0-100) where 100 is peak popularity
        {data.timeframe && ` • Timeframe: ${data.timeframe}`}
        {data.geo && ` • Region: ${data.geo}`}
      </Typography>
    </Box>
  );
};
