import React, { Suspense } from 'react';
import { Box, Grid, Typography } from '@mui/material';
import {
  LazyBarChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Bar,
  ChartLoadingFallback,
} from '../../utils/lazyRecharts';
import { formatNumber } from './PlatformAnalytics.utils';

interface ChartItem {
  label: string;
  clicks: number;
  impressions: number;
  ctr: number;
  fullUrl: string;
}

interface TopPagesBarChartProps {
  data: ChartItem[];
}

const TopPagesBarChart: React.FC<TopPagesBarChartProps> = ({ data }) => {
  if (!data || data.length === 0) return null;

  return (
    <Grid item xs={12} md={6}>
      <Typography variant="subtitle2" sx={{ mb: 0.25 }}>Top pages impact</Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
        Where most of your clicks are concentrated in this window.
      </Typography>
      <Box sx={{ height: 180, bgcolor: '#020617', borderRadius: 2, p: 1.5, border: '1px solid rgba(148, 163, 184, 0.4)' }}>
        <Suspense fallback={<ChartLoadingFallback />}>
          <ResponsiveContainer width="100%" height="100%">
            <LazyBarChart
              data={data}
              layout="vertical"
              margin={{ top: 8, right: 12, bottom: 8, left: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#475569" opacity={0.25} />
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="label"
                width={130}
                tick={{ fill: '#e5e7eb', fontSize: 11 }}
              />
              <RechartsTooltip
                contentStyle={{
                  backgroundColor: '#020617',
                  borderRadius: 8,
                  border: '1px solid #4b5563',
                  padding: 8,
                }}
                formatter={(value: any, name: any, _props: any) => {
                  if (name === 'clicks') return [formatNumber(Number(value || 0)), 'Clicks'];
                  if (name === 'impressions') return [formatNumber(Number(value || 0)), 'Impressions'];
                  if (name === 'ctr') return [`${Number(value || 0).toFixed(2)}%`, 'CTR'];
                  return [value, name];
                }}
                labelFormatter={(label: any, payload: any) => {
                  const full = payload && payload[0] && (payload[0].payload as any)?.fullUrl;
                  return full || String(label || '');
                }}
              />
              <Bar dataKey="clicks" fill="#38bdf8" radius={[0, 6, 6, 0]} />
            </LazyBarChart>
          </ResponsiveContainer>
        </Suspense>
      </Box>
    </Grid>
  );
};

export default React.memo(TopPagesBarChart);
