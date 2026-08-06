import React, { Suspense } from 'react';
import { Box, Grid, Typography } from '@mui/material';
import {
  LazyLineChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Line,
  ChartLoadingFallback,
} from '../../utils/lazyRecharts';

interface ChartItem {
  query: string;
  position: number;
  ctr: number;
}

interface CtrPositionChartProps {
  data: ChartItem[];
}

const CtrPositionChart: React.FC<CtrPositionChartProps> = ({ data }) => {
  if (!data || data.length === 0) return null;

  return (
    <Grid item xs={12} md={6}>
      <Typography variant="subtitle2" sx={{ mb: 0.25 }}>CTR vs average position</Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
        How click‑through rate changes as your queries move up and down.
      </Typography>
      <Box sx={{ height: 180, bgcolor: '#020617', borderRadius: 2, p: 1.5, border: '1px solid rgba(148, 163, 184, 0.4)' }}>
        <Suspense fallback={<ChartLoadingFallback />}>
          <ResponsiveContainer width="100%" height="100%">
            <LazyLineChart
              data={data}
              margin={{ top: 8, right: 12, bottom: 8, left: -10 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#475569" opacity={0.25} />
              <XAxis
                type="number"
                dataKey="position"
                domain={[1, 'dataMax']}
                tick={{ fill: '#e5e7eb', fontSize: 11 }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#e5e7eb', fontSize: 11 }}
                tickFormatter={(v) => `${v}%`}
                tickLine={false}
              />
              <RechartsTooltip
                contentStyle={{
                  backgroundColor: '#020617',
                  borderRadius: 8,
                  border: '1px solid #4b5563',
                  padding: 8,
                }}
                formatter={(value: any, name: any, _props: any) => {
                  if (name === 'ctr') return [`${Number(value || 0).toFixed(2)}%`, 'CTR'];
                  return [value, name];
                }}
                labelFormatter={(label: any, payload: any) => {
                  const q = payload && payload[0] && (payload[0].payload as any)?.query;
                  return `Position ${label}${q ? ` • ${q}` : ''}`;
                }}
              />
              <Line
                type="monotone"
                dataKey="ctr"
                stroke="#a855f7"
                strokeWidth={2.2}
                dot={{ r: 3, fill: '#a855f7', strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
            </LazyLineChart>
          </ResponsiveContainer>
        </Suspense>
      </Box>
    </Grid>
  );
};

export default React.memo(CtrPositionChart);
