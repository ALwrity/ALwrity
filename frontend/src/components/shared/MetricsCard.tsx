import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  LinearProgress,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  Tooltip,
  Paper,
  Button,
} from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import MouseOutlined from '@mui/icons-material/MouseOutlined';
import TrendingUp from '@mui/icons-material/TrendingUp';
import { PlatformAnalytics as PlatformAnalyticsType, PlatformConnectionStatus } from '../../api/analytics';
import BingToolbar from './BingToolbar';

interface MetricsCardProps {
  platform: string;
  data: PlatformAnalyticsType;
  formatNumber: (n: number) => string;
  getPlatformIcon: (platform: string) => React.ReactNode;
  getStatusColor: (status: string) => string;
  getStatusIcon: (status: string) => React.ReactNode;
  bingSiteUrl: string;
  onBingSiteUrlChange: (url: string) => void;
  bingCollectMsg: string | null;
  onBingCollectMsgChange: (msg: string | null) => void;
  rangeDays: number;
  bingStatus: PlatformConnectionStatus | undefined;
  onForceRefresh: () => Promise<void>;
  onReconnect?: (platform: string) => void;
  risingQueries: Array<{ query: string; deltaClicks: number; deltaImpressions: number }>;
}

const MetricsCard: React.FC<MetricsCardProps> = ({
  platform,
  data,
  formatNumber,
  getPlatformIcon,
  getStatusColor,
  getStatusIcon,
  bingSiteUrl,
  onBingSiteUrlChange,
  bingCollectMsg,
  onBingCollectMsgChange,
  rangeDays,
  bingStatus,
  onForceRefresh,
  onReconnect,
  risingQueries,
}) => {
  const metrics = data.metrics;

  return (
    <Card sx={{ height: '100%', bgcolor: '#ffffff', color: '#1f2937', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {getPlatformIcon(platform)}
            <Typography variant="h6" component="div">
              {platform.toUpperCase()}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {getStatusIcon(data.status)}
            <Chip 
              label={data.status} 
              color={getStatusColor(data.status) as any}
              size="small"
            />
            {platform === 'bing' && (
              <BingToolbar
                siteUrl={bingSiteUrl}
                onSiteUrlChange={onBingSiteUrlChange}
                collectMsg={bingCollectMsg}
                onCollectMsgChange={onBingCollectMsgChange}
                rangeDays={rangeDays}
                bingStatus={bingStatus}
                metrics={(data as any)?.metrics}
                onForceRefresh={onForceRefresh}
              />
            )}
          </Box>
        </Box>

        {data.status === 'success' && (
          <>
            <Grid container spacing={2}>
              {metrics.total_clicks !== undefined && (
                <Grid item xs={6}>
                  <Box sx={{ textAlign: 'center' }}>
                    <MouseOutlined color="primary" sx={{ fontSize: 32, mb: 1 }} />
                    <Typography variant="h4" color="primary">
                      {formatNumber(metrics.total_clicks)}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#6b7280' }}>
                      Clicks
                    </Typography>
                  </Box>
                </Grid>
              )}
              
              {metrics.total_impressions !== undefined && (
                <Grid item xs={6}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Visibility color="secondary" sx={{ fontSize: 32, mb: 1 }} />
                    <Typography variant="h4" color="secondary">
                      {formatNumber(metrics.total_impressions)}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#6b7280' }}>
                      Impressions
                    </Typography>
                  </Box>
                </Grid>
              )}
            </Grid>

            {metrics.avg_ctr !== undefined && (
              <Box sx={{ mt: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2">CTR</Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {metrics.avg_ctr}%
                  </Typography>
                </Box>
                <LinearProgress 
                  variant="determinate" 
                  value={Math.min(metrics.avg_ctr * 10, 100)} 
                  sx={{ height: 8, borderRadius: 4 }}
                />
              </Box>
            )}

            {metrics.avg_position !== undefined && (
              <Box sx={{ mt: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2">Avg Position</Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {metrics.avg_position.toFixed(1)}
                  </Typography>
                </Box>
                <LinearProgress 
                  variant="determinate" 
                  value={Math.max(0, 100 - (metrics.avg_position - 1) * 5)} 
                  color="secondary"
                  sx={{ height: 6, borderRadius: 4 }}
                />
              </Box>
            )}

            {metrics.top_queries && metrics.top_queries.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Top Queries
                </Typography>
                <List dense>
                  {metrics.top_queries.slice(0, 3).map((q: any, index: number) => {
                    const clicks = Number(q.clicks || 0);
                    const impressions = Number(q.impressions || 0);
                    const ctr = Number(q.ctr || 0);
                    const ctrColor = ctr >= 3 ? '#065f46' : ctr >= 1 ? '#92400e' : '#7f1d1d';
                    const ctrBg = ctr >= 3 ? 'linear-gradient(135deg, #d1fae5 0%, #ecfdf5 100%)' : ctr >= 1 ? 'linear-gradient(135deg, #fef3c7 0%, #fffbeb 100%)' : 'linear-gradient(135deg, #fee2e2 0%, #fff1f2 100%)';
                    const risingSet = new Set(risingQueries.map(r => String(r.query || '').toLowerCase()));
                    const isTrending = risingSet.has(String(q.query || '').toLowerCase());
                    return (
                      <ListItem key={index} sx={{ px: 0, py: 0.5 }}>
                        <Paper elevation={0} sx={{ px: 1, py: 0.75, width: '100%', borderRadius: 2, border: '1px solid #e5e7eb', background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)' }}>
                        <ListItemIcon sx={{ minWidth: 28 }}>
                          <Typography variant="caption" sx={{ color: '#6b7280' }}>
                            {index + 1}
                          </Typography>
                        </ListItemIcon>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, width: '100%', justifyContent: 'space-between' }}>
                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Tooltip title={`${q.query}`}>
                              <Typography variant="body2" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {q.query}
                              </Typography>
                            </Tooltip>
                            {isTrending && (
                              <Chip
                                icon={<TrendingUp fontSize="small" />}
                                label="Trending"
                                size="small"
                                sx={{ mt: 0.5, backgroundImage: 'linear-gradient(135deg, #ecfdf5 0%, #ffffff 100%)', color: '#065f46', border: '1px solid #a7f3d0', boxShadow: '0 1px 2px rgba(0,0,0,0.04)', fontWeight: 700 }}
                              />
                            )}
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, flexShrink: 0 }}>
                            <Tooltip title="Total clicks across the selected date range. Higher is better.">
                              <Chip icon={<MouseOutlined fontSize="small" />} label={`${formatNumber(clicks)}`} size="small" sx={{ backgroundImage: 'linear-gradient(135deg, #dbeafe 0%, #eef2ff 100%)', color: '#1e3a8a', border: '1px solid #c7d2fe', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', fontWeight: 700 }} />
                            </Tooltip>
                            <Tooltip title="Total impressions across the selected date range. Indicates visibility in search results.">
                              <Chip icon={<Visibility fontSize="small" />} label={`${formatNumber(impressions)}`} size="small" sx={{ backgroundImage: 'linear-gradient(135deg, #e2e8f0 0%, #f8fafc 100%)', color: '#0f172a', border: '1px solid #cbd5e1', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', fontWeight: 700 }} />
                            </Tooltip>
                            <Tooltip title="Click-through rate. Higher indicates titles/meta attract clicks for given impressions.">
                              <Chip label={`${ctr.toFixed(1)}%`} size="small" sx={{ backgroundImage: ctrBg, color: ctrColor, border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 1px 2px rgba(0,0,0,0.04)', fontWeight: 700 }} />
                            </Tooltip>
                          </Box>
                        </Box>
                        </Paper>
                      </ListItem>
                    );
                  })}
                </List>
              </Box>
            )}
          </>
        )}

        {data.status === 'error' && (
          <Box sx={{ mt: 1 }}>
            <Alert severity="error" sx={{ mb: 2 }}>
              {data.error_message || 'Failed to load analytics data'}
            </Alert>
            {platform === 'bing' && bingCollectMsg && (
              <Alert severity="info" sx={{ mb: 2 }}>{bingCollectMsg}</Alert>
            )}
            {onReconnect && (
              <Button
                variant="outlined"
                color="error"
                size="small"
                onClick={() => onReconnect(platform)}
                sx={{ 
                  textTransform: 'none',
                  fontWeight: 600,
                  borderColor: '#f44336',
                  color: '#f44336',
                  '&:hover': {
                    borderColor: '#d32f2f',
                    backgroundColor: 'rgba(244, 67, 54, 0.04)'
                  }
                }}
              >
                Reconnect {platform.toUpperCase()}
              </Button>
            )}
          </Box>
        )}

        {data.status === 'partial' && (
          <Alert severity="warning" sx={{ mt: 1 }}>
            {data.error_message || 'Limited analytics data available'}
          </Alert>
        )}

        <Typography variant="caption" sx={{ display: 'block', mt: 1, color: '#6b7280' }}>
          Last updated: {data.last_updated ? new Date(data.last_updated).toLocaleString() : 'Never'}
        </Typography>
      </CardContent>
    </Card>
  );
};

export default MetricsCard;
