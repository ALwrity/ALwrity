import React, { Suspense } from 'react';
import { Box, Grid, Typography } from '@mui/material';
import {
  LazyBarChart,
  LazyLineChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Bar,
  Line,
  ChartLoadingFallback,
} from '../../utils/lazyRecharts';

interface TopPageChartItem {
  label: string;
  clicks: number;
  impressions: number;
  ctr: number;
  fullUrl: string;
}

interface CTRPositionItem {
  query: string;
  position: number;
  ctr: number;
}

interface SummaryChartsProps {
  topPagesChart: TopPageChartItem[];
  ctrPositionData: CTRPositionItem[];
  formatNumber: (n: number) => string;
}

const SummaryCharts: React.FC<SummaryChartsProps> = ({ topPagesChart, ctrPositionData, formatNumber }) => {
  if (topPagesChart.length === 0 && ctrPositionData.length === 0) return null;

  return (
    <Box sx={{ mt: 2.5 }}>
      <Grid container spacing={2}>
        {topPagesChart.length > 0 && (
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" sx={{ mb: 0.25 }}>Top pages impact</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              Where most of your clicks are concentrated in this window.
            </Typography>
            <Box sx={{ height: 180, bgcolor: '#020617', borderRadius: 2, p: 1.5, border: '1px solid rgba(148, 163, 184, 0.4)' }}>
              <Suspense fallback={<ChartLoadingFallback />}>
                <ResponsiveContainer width="100%" height="100%">
                  <LazyBarChart
                    data={topPagesChart}
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
                      formatter={(value: any, name: any, props: any) => {
                        if (name === 'clicks') {
                          return [formatNumber(Number(value || 0)), 'Clicks'];
                        }
                        if (name === 'impressions') {
                          return [formatNumber(Number(value || 0)), 'Impressions'];
                        }
                        if (name === 'ctr') {
                          return [`${Number(value || 0).toFixed(2)}%`, 'CTR'];
                        }
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
        )}
        {ctrPositionData.length > 0 && (
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" sx={{ mb: 0.25 }}>CTR vs average position</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              How click‑through rate changes as your queries move up and down.
            </Typography>
            <Box sx={{ height: 180, bgcolor: '#020617', borderRadius: 2, p: 1.5, border: '1px solid rgba(148, 163, 184, 0.4)' }}>
              <Suspense fallback={<ChartLoadingFallback />}>
                <ResponsiveContainer width="100%" height="100%">
                  <LazyLineChart
                    data={ctrPositionData}
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
                      formatter={(value: any, name: any, props: any) => {
                        if (name === 'ctr') {
                          return [`${Number(value || 0).toFixed(2)}%`, 'CTR'];
                        }
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
        )}
      </Grid>
    </Box>
  );
};

export default SummaryCharts;
