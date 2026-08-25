import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
} from '@mui/material';
import StorageIcon from '@mui/icons-material/Storage';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import SearchIcon from '@mui/icons-material/Search';
import CalendarIcon from '@mui/icons-material/CalendarToday';
import AssessmentIcon from '@mui/icons-material/Assessment';
import RefreshIcon from '@mui/icons-material/Refresh';
import { apiClient } from '../../api/client';

interface AnalyticsSummary {
  period_days: number;
  total_clicks: number;
  total_impressions: number;
  total_queries: number;
  avg_ctr: number;
  ctr_trend: number;
  top_queries: Array<{
    query: string;
    clicks: number;
    impressions: number;
    count: number;
  }>;
  daily_metrics_count: number;
  data_quality: string;
}

interface DailyMetric {
  date: string;
  total_clicks: number;
  total_impressions: number;
  total_queries: number;
  avg_ctr: number;
  avg_position: number;
  clicks_change: number;
  impressions_change: number;
  ctr_change: number;
  top_queries: any[];
  collected_at: string;
}

interface TopQuery {
  query: string;
  total_clicks: number;
  total_impressions: number;
  avg_ctr: number;
  avg_position: number;
  days_appeared: number;
  category: string;
  is_brand: boolean;
}

const BingAnalyticsStorage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [collecting, setCollecting] = useState(false);
  const [siteUrl, setSiteUrl] = useState('https://www.alwrity.com/');
  const [days, setDays] = useState(30);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [dailyMetrics, setDailyMetrics] = useState<DailyMetric[]>([]);
  const [topQueries, setTopQueries] = useState<TopQuery[]>([]);
  const [sortBy, setSortBy] = useState('clicks');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadAnalyticsSummary = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiClient.get('/bing-analytics/summary', {
        params: { site_url: siteUrl, days: days }
      });

      setSummary(response.data.data);
      
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load analytics summary');
    } finally {
      setLoading(false);
    }
  }, [siteUrl, days]);

  const collectData = useCallback(async () => {
    try {
      setCollecting(true);
      setError(null);
      setSuccess(null);

      await apiClient.post('/bing-analytics/collect-data', null, {
        params: { site_url: siteUrl, days_back: days }
      });

      setSuccess(`Data collection started for ${siteUrl}. This may take a few minutes.`);
      
      // Refresh summary after a delay
      setTimeout(() => {
        loadAnalyticsSummary();
      }, 5000);
      
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to start data collection');
    } finally {
      setCollecting(false);
    }
  }, [siteUrl, days, loadAnalyticsSummary]);

  const loadDailyMetrics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiClient.get('/bing-analytics/daily-metrics', {
        params: { site_url: siteUrl, days: days }
      });

      setDailyMetrics(response.data.data);
      
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load daily metrics');
    } finally {
      setLoading(false);
    }
  }, [siteUrl, days]);

  const loadTopQueries = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiClient.get('/bing-analytics/top-queries', {
        params: { 
          site_url: siteUrl, 
          days: days, 
          limit: 20, 
          sort_by: sortBy 
        }
      });

      setTopQueries(response.data.data);
      
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load top queries');
    } finally {
      setLoading(false);
    }
  }, [siteUrl, days, sortBy]);

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  const getChangeColor = (change: number) => {
    if (change > 0) return 'success';
    if (change < 0) return 'error';
    return 'default';
  };

  const getChangeIcon = (change: number) => {
    if (change > 0) return '↗';
    if (change < 0) return '↘';
    return '→';
  };

  useEffect(() => {
    if (siteUrl) {
      loadAnalyticsSummary();
    }
  }, [siteUrl, days, loadAnalyticsSummary]);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <StorageIcon color="primary" />
        Bing Analytics Storage
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        This tool collects and stores Bing Webmaster Tools analytics data for historical analysis and trend tracking.
      </Alert>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {/* Controls */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Data Collection & Analysis
          </Typography>
          
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Site URL"
                value={siteUrl}
                onChange={(e) => setSiteUrl(e.target.value)}
                placeholder="https://www.example.com/"
              />
            </Grid>
            
            <Grid item xs={12} md={2}>
              <TextField
                fullWidth
                label="Days"
                type="number"
                value={days}
                onChange={(e) => setDays(parseInt(e.target.value) || 30)}
                inputProps={{ min: 1, max: 365 }}
              />
            </Grid>
            
            <Grid item xs={12} md={3}>
              <Button
                variant="contained"
                onClick={collectData}
                disabled={collecting || !siteUrl}
                startIcon={collecting ? <CircularProgress size={20} /> : <RefreshIcon />}
                fullWidth
              >
                {collecting ? 'Collecting...' : 'Collect Data'}
              </Button>
            </Grid>
            
            <Grid item xs={12} md={3}>
              <Button
                variant="outlined"
                onClick={loadAnalyticsSummary}
                disabled={loading}
                startIcon={loading ? <CircularProgress size={20} /> : <AssessmentIcon />}
                fullWidth
              >
                Refresh Summary
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Analytics Summary */}
      {summary && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TrendingUpIcon color="primary" />
              Analytics Summary ({summary.period_days} days)
            </Typography>
            
            <Grid container spacing={3}>
              <Grid item xs={6} md={3}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="primary">
                    {formatNumber(summary.total_clicks)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Total Clicks
                  </Typography>
                </Box>
              </Grid>
              
              <Grid item xs={6} md={3}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="secondary">
                    {formatNumber(summary.total_impressions)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Total Impressions
                  </Typography>
                </Box>
              </Grid>
              
              <Grid item xs={6} md={3}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="info">
                    {summary.avg_ctr.toFixed(2)}%
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Avg CTR
                    <Chip 
                      label={`${getChangeIcon(summary.ctr_trend)} ${summary.ctr_trend.toFixed(1)}%`}
                      color={getChangeColor(summary.ctr_trend)}
                      size="small"
                      sx={{ ml: 1 }}
                    />
                  </Typography>
                </Box>
              </Grid>
              
              <Grid item xs={6} md={3}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="success">
                    {summary.total_queries}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Unique Queries
                  </Typography>
                </Box>
              </Grid>
            </Grid>

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle2" gutterBottom>
              Top Performing Queries
            </Typography>
            
            <List dense>
              {summary.top_queries.slice(0, 5).map((query, index) => (
                <ListItem key={index}>
                  <ListItemIcon>
                    <Typography variant="caption" color="text.secondary">
                      {index + 1}
                    </Typography>
                  </ListItemIcon>
                  <ListItemText
                    primary={query.query}
                    secondary={`${query.clicks} clicks • ${query.impressions} impressions • ${((query.clicks / query.impressions) * 100).toFixed(1)}% CTR`}
                  />
                </ListItem>
              ))}
            </List>

            <Chip 
              label={`Data Quality: ${summary.data_quality}`}
              color={summary.data_quality === 'good' ? 'success' : 'warning'}
              size="small"
              sx={{ mt: 1 }}
            />
          </CardContent>
        </Card>
      )}

      {/* Top Queries Table */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <SearchIcon color="primary" />
              Top Queries
            </Typography>
            
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>Sort By</InputLabel>
                <Select
                  value={sortBy}
                  label="Sort By"
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <MenuItem value="clicks">Clicks</MenuItem>
                  <MenuItem value="impressions">Impressions</MenuItem>
                  <MenuItem value="ctr">CTR</MenuItem>
                </Select>
              </FormControl>
              
              <Button
                variant="outlined"
                onClick={loadTopQueries}
                disabled={loading}
                startIcon={loading ? <CircularProgress size={20} /> : <SearchIcon />}
              >
                Load Top Queries
              </Button>
            </Box>
          </Box>

          {topQueries.length > 0 && (
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Query</TableCell>
                    <TableCell align="right">Clicks</TableCell>
                    <TableCell align="right">Impressions</TableCell>
                    <TableCell align="right">CTR</TableCell>
                    <TableCell align="right">Avg Position</TableCell>
                    <TableCell align="right">Days</TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell>Brand</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {topQueries.map((query, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Typography variant="body2" sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {query.query}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">{query.total_clicks}</TableCell>
                      <TableCell align="right">{query.total_impressions}</TableCell>
                      <TableCell align="right">{query.avg_ctr.toFixed(1)}%</TableCell>
                      <TableCell align="right">{query.avg_position > 0 ? query.avg_position.toFixed(1) : 'N/A'}</TableCell>
                      <TableCell align="right">{query.days_appeared}</TableCell>
                      <TableCell>
                        <Chip label={query.category} size="small" color="default" />
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={query.is_brand ? 'Brand' : 'Generic'} 
                          size="small" 
                          color={query.is_brand ? 'primary' : 'default'} 
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Daily Metrics */}
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CalendarIcon color="primary" />
              Daily Metrics
            </Typography>
            
            <Button
              variant="outlined"
              onClick={loadDailyMetrics}
              disabled={loading}
              startIcon={loading ? <CircularProgress size={20} /> : <CalendarIcon />}
            >
              Load Daily Data
            </Button>
          </Box>

          {dailyMetrics.length > 0 && (
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell align="right">Clicks</TableCell>
                    <TableCell align="right">Impressions</TableCell>
                    <TableCell align="right">Queries</TableCell>
                    <TableCell align="right">CTR</TableCell>
                    <TableCell align="right">Position</TableCell>
                    <TableCell align="right">Clicks Δ</TableCell>
                    <TableCell align="right">CTR Δ</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {dailyMetrics.slice(0, 10).map((metric, index) => (
                    <TableRow key={index}>
                      <TableCell>{new Date(metric.date).toLocaleDateString()}</TableCell>
                      <TableCell align="right">{metric.total_clicks}</TableCell>
                      <TableCell align="right">{metric.total_impressions}</TableCell>
                      <TableCell align="right">{metric.total_queries}</TableCell>
                      <TableCell align="right">{metric.avg_ctr.toFixed(1)}%</TableCell>
                      <TableCell align="right">{metric.avg_position > 0 ? metric.avg_position.toFixed(1) : 'N/A'}</TableCell>
                      <TableCell align="right">
                        <Chip 
                          label={`${getChangeIcon(metric.clicks_change)} ${metric.clicks_change.toFixed(1)}%`}
                          color={getChangeColor(metric.clicks_change)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Chip 
                          label={`${getChangeIcon(metric.ctr_change)} ${metric.ctr_change.toFixed(1)}%`}
                          color={getChangeColor(metric.ctr_change)}
                          size="small"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default BingAnalyticsStorage;
