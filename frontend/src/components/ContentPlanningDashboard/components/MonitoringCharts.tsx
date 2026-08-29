import React from 'react';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Typography,
  Grid,
  Avatar,
  Chip
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import SpeedIcon from '@mui/icons-material/Speed';
import BugReportIcon from '@mui/icons-material/BugReport';
import StorageIcon from '@mui/icons-material/Storage';
import TimelineIcon from '@mui/icons-material/Timeline';
import { motion } from 'framer-motion';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, Radar,
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell
} from 'recharts';

interface ChartData {
  name: string;
  requests: number;
  avgTime: number;
  errors: number;
  hitRate: number;
}

interface MonitoringChartsProps {
  chartData: ChartData[];
  cachePerformance: {
    hits: number;
    misses: number;
    hit_rate: number;
  };
  apiPerformance: {
    recent_requests: number;
    recent_errors: number;
    error_rate: number;
  };
}

// const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

const MonitoringCharts: React.FC<MonitoringChartsProps> = ({
  chartData,
  cachePerformance,
  apiPerformance
}) => {
  // Generate time series data for line chart
  const timeSeriesData = chartData.map((item, index) => ({
    time: `${index + 1}`,
    requests: item.requests,
    errors: item.errors,
    avgTime: item.avgTime * 1000, // Convert to milliseconds for better visualization
  }));

  // Generate radar chart data
  const radarData = [
    { metric: 'Performance', value: 100 - apiPerformance.error_rate },
    { metric: 'Reliability', value: 100 - (apiPerformance.recent_errors / Math.max(apiPerformance.recent_requests, 1)) * 100 },
    { metric: 'Cache Hit Rate', value: cachePerformance.hit_rate },
    { metric: 'Response Time', value: Math.max(0, 100 - (chartData.reduce((acc, item) => acc + item.avgTime, 0) / Math.max(chartData.length, 1)) * 1000) },
    { metric: 'Error Rate', value: Math.max(0, 100 - apiPerformance.error_rate) },
  ];

  // Generate pie chart data for cache performance
  const cacheData = [
    { name: 'Cache Hits', value: cachePerformance.hits, color: '#00C49F' },
    { name: 'Cache Misses', value: cachePerformance.misses, color: '#FF8042' },
  ];

  return (
    <Grid container spacing={3}>
      {/* Line Chart - Request Trends */}
      <Grid item xs={12} md={6}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card sx={{ height: '100%', background: 'rgba(255,255,255,0.95)' }}>
            <CardHeader
              avatar={<Avatar sx={{ bgcolor: 'primary.main' }}><TimelineIcon /></Avatar>}
              title="Request Trends"
              subheader="Real-time request and error patterns"
            />
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={timeSeriesData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip />
                  <Line 
                    type="monotone" 
                    dataKey="requests" 
                    stroke="#8884d8" 
                    strokeWidth={2}
                    dot={{ fill: '#8884d8', strokeWidth: 2, r: 4 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="errors" 
                    stroke="#ff0000" 
                    strokeWidth={2}
                    dot={{ fill: '#ff0000', strokeWidth: 2, r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      </Grid>

      {/* Area Chart - Response Times */}
      <Grid item xs={12} md={6}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card sx={{ height: '100%', background: 'rgba(255,255,255,0.95)' }}>
            <CardHeader
              avatar={<Avatar sx={{ bgcolor: 'info.main' }}><SpeedIcon /></Avatar>}
              title="Response Times"
              subheader="Average response time trends"
            />
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={timeSeriesData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip />
                  <Area 
                    type="monotone" 
                    dataKey="avgTime" 
                    stroke="#82ca9d" 
                    fill="#82ca9d" 
                    fillOpacity={0.6}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      </Grid>

      {/* Bar Chart - Endpoint Performance */}
      <Grid item xs={12} md={8}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card sx={{ background: 'rgba(255,255,255,0.95)' }}>
            <CardHeader
              avatar={<Avatar sx={{ bgcolor: 'success.main' }}><TrendingUpIcon /></Avatar>}
              title="Endpoint Performance"
              subheader="Request volume and error distribution"
            />
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="requests" fill="#8884d8" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="errors" fill="#ff0000" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      </Grid>

      {/* Pie Chart - Cache Performance */}
      <Grid item xs={12} md={4}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card sx={{ height: '100%', background: 'rgba(255,255,255,0.95)' }}>
            <CardHeader
              avatar={<Avatar sx={{ bgcolor: 'warning.main' }}><StorageIcon /></Avatar>}
              title="Cache Performance"
              subheader="Hit vs Miss distribution"
            />
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={cacheData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name} ${value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {cacheData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <Box sx={{ textAlign: 'center', mt: 2 }}>
                <Typography variant="h6" color="primary">
                  {cachePerformance.hit_rate.toFixed(1)}%
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Overall Hit Rate
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </motion.div>
      </Grid>

      {/* Radar Chart - System Health */}
      <Grid item xs={12}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card sx={{ background: 'rgba(255,255,255,0.95)' }}>
            <CardHeader
              avatar={<Avatar sx={{ bgcolor: 'error.main' }}><BugReportIcon /></Avatar>}
              title="System Health Overview"
              subheader="Multi-dimensional performance metrics"
              action={
                <Chip 
                  label={`${100 - apiPerformance.error_rate}% Healthy`}
                  color={apiPerformance.error_rate > 5 ? 'error' : 'success'}
                  size="small"
                />
              }
            />
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="metric" />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} />
                  <Radar
                    name="Performance"
                    dataKey="value"
                    stroke="#8884d8"
                    fill="#8884d8"
                    fillOpacity={0.6}
                  />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      </Grid>

      {/* Performance Metrics Cards */}
      <Grid item xs={12}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ background: 'rgba(255,255,255,0.95)' }}>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="primary" gutterBottom>
                    {apiPerformance.recent_requests}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Recent Requests
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ background: 'rgba(255,255,255,0.95)' }}>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="error" gutterBottom>
                    {apiPerformance.recent_errors}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Recent Errors
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ background: 'rgba(255,255,255,0.95)' }}>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="success.main" gutterBottom>
                    {cachePerformance.hit_rate.toFixed(1)}%
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Cache Hit Rate
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ background: 'rgba(255,255,255,0.95)' }}>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="info.main" gutterBottom>
                    {chartData.length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Active Endpoints
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </motion.div>
      </Grid>
    </Grid>
  );
};

export default MonitoringCharts;
