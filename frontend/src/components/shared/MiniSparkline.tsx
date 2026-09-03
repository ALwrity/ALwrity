import React, { Suspense } from 'react';
import { Box, Typography } from '@mui/material';
import { 
  LazyLineChart, 
  Line, 
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer, 
  ChartLoadingFallback 
} from '../../utils/lazyRecharts';

interface MiniSparklineProps {
  data: Array<{ date: string; value: number }>;
  color: string;
  height?: number;
  showArea?: boolean;
  formatValue?: (value: number) => string;
  label?: string;
}

/**
 * MiniSparkline - Enhanced trend line chart for metric cards with axes and tooltips
 * 
 * Usage:
 *   <MiniSparkline 
 *     data={last7DaysData} 
 *     color="#4ade80" 
 *     height={60}
 *     formatValue={(v) => `$${v.toFixed(2)}`}
 *     label="Cost"
 *   />
 */
export const MiniSparkline: React.FC<MiniSparklineProps> = ({
  data,
  color,
  height = 60,
  showArea = false,
  formatValue = (v) => v.toLocaleString(),
  label = 'Value'
}) => {
  // Guard against zero-size mounts: during AnimatePresence exit animations
  // (e.g. billing card switching) the parent collapses to width/height -1
  // and recharts logs warnings. Render the chart only when the container
  // is actually measurable.
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [hasSize, setHasSize] = React.useState(false);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect?.width ?? 0;
      const observedHeight = entries[0]?.contentRect?.height ?? 0;
      setHasSize(width > 0 && observedHeight > 0);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Ensure we have data
  if (!data || data.length === 0) {
    return (
      <Box sx={{ height, width: '100%', mt: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.7rem' }}>
          No data available
        </Typography>
      </Box>
    );
  }

  // If only one data point, duplicate it for visual consistency
  const chartData = data.length === 1 
    ? [data[0], { ...data[0], value: data[0].value }]
    : data;

  // Calculate min/max for Y-axis domain
  const values = chartData.map(d => d.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const padding = (maxValue - minValue) * 0.1 || 0.1;

  // Format date for X-axis
  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      // Show day of month for daily data
      return date.getDate().toString();
    } catch {
      return dateStr;
    }
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <Box
          sx={{
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            color: 'white',
            padding: 1,
            borderRadius: 1,
            border: `1px solid ${color}`,
            fontSize: '0.75rem'
          }}
        >
          <Typography variant="caption" sx={{ display: 'block', fontWeight: 'bold', mb: 0.5 }}>
            {new Date(data.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </Typography>
          <Typography variant="caption" sx={{ color: color }}>
            {label}: {formatValue(data.value)}
          </Typography>
        </Box>
      );
    }
    return null;
  };

  return (
    <Box ref={containerRef} sx={{ height, width: '100%', mt: 1 }}>
      {hasSize && (
        <Suspense fallback={<ChartLoadingFallback />}>
          <ResponsiveContainer width="100%" height={height}>
            <LazyLineChart
              data={chartData}
              margin={{ top: 5, right: 5, bottom: 20, left: 5 }}
            >
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                stroke="rgba(255,255,255,0.5)"
                tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }}
                height={20}
              />
              <YAxis
                domain={[minValue - padding, maxValue + padding]}
                tickFormatter={(value) => {
                  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
                  if (value >= 1) return value.toFixed(0);
                  return value.toFixed(2);
                }}
                stroke="rgba(255,255,255,0.5)"
                tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }}
                width={40}
              />
              <RechartsTooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2}
                dot={{ fill: color, r: 3 }}
                activeDot={{ r: 5, fill: color }}
                isAnimationActive={true}
                animationDuration={1000}
                animationBegin={0}
              />
            </LazyLineChart>
          </ResponsiveContainer>
        </Suspense>
      )}
    </Box>
  );
};

export default MiniSparkline;
