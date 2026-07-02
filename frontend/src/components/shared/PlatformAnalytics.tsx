import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  LinearProgress,
  Alert,
  CircularProgress,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Tooltip,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Stack,
} from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import MouseOutlined from '@mui/icons-material/MouseOutlined';
import Search from '@mui/icons-material/Search';
import Web from '@mui/icons-material/Web';
import Refresh from '@mui/icons-material/Refresh';
import Info from '@mui/icons-material/Info';
import CheckCircle from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import Warning from '@mui/icons-material/Warning';
import TrendingUp from '@mui/icons-material/TrendingUp';
import { Button } from '@mui/material';
import { PlatformAnalytics as PlatformAnalyticsType, AnalyticsSummary, PlatformConnectionStatus } from '../../api/analytics';
import { cachedAnalyticsAPI } from '../../api/cachedAnalytics';
import BingInsightsCard from './BingInsightsCard';
import BackgroundJobManager from './BackgroundJobManager';
import TopPagesInsightsPanel from './TopPagesInsightsPanel';
import GscSuggestionsPanel from './GscSuggestionsPanel';
import RefreshQueuePanel from './RefreshQueuePanel';
import ChipLegend from './ChipLegend';
import { apiClient } from '../../api/client';
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

interface CannibalizationPage {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
}

interface CannibalizationAlert {
  query: string;
  total_clicks: number;
  recommended_target_page?: string;
  pages?: CannibalizationPage[];
}

interface CannibalizationAlertsPanelProps {
  alerts: CannibalizationAlert[];
  formatNumber: (n: number) => string;
  isValidHttpUrl: (url: string) => boolean;
  onOpenBrief: (page: string, query: string, totalClicks: number) => void;
}

const CannibalizationAlertsPanel: React.FC<CannibalizationAlertsPanelProps> = ({
  alerts,
  formatNumber,
  isValidHttpUrl,
  onOpenBrief,
}) => {
  return (
    <Card sx={{ mt: 2, bgcolor: '#ffffff !important', color: '#1f2937 !important', border: '1px solid #e5e7eb !important', boxShadow: '0 1px 3px 0 rgba(0,0,0,0.1) !important' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="subtitle1">Cannibalization Alerts</Typography>
            <Tooltip title="The same search query points to multiple pages on your site, splitting clicks. Choose one target page and consolidate overlapping pages or add internal links.">
              <Info fontSize="small" color="action" />
            </Tooltip>
          </Box>
          <Typography variant="caption" color="text.secondary">Queries competing across pages</Typography>
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          “No cannibalization” is normal for tightly targeted sites or low‑traffic windows. For demos we can relax sensitivity.
        </Typography>
        <ChipLegend
          items={[
            {
              label: 'Competing page',
              icon: <MouseOutlined fontSize="small" />,
              tooltip: 'Each chip is a page that shares the same query. Text shows URL • clicks • impressions • CTR.',
              sx: {
                backgroundImage: 'linear-gradient(135deg, #e2e8f0 0%, #f8fafc 100%)',
                color: '#0f172a',
                border: '1px solid #cbd5e1',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                fontWeight: 700,
              },
            },
            {
              label: 'Higher CTR',
              tooltip: 'Greener backgrounds mean this page converts searchers relatively well.',
              sx: {
                backgroundImage: 'linear-gradient(135deg, #d1fae5 0%, #ecfdf5 100%)',
                color: '#065f46',
                border: '1px solid #86efac',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                fontWeight: 700,
              },
            },
            {
              label: 'Weaker CTR',
              tooltip: 'Redder backgrounds flag pages that may need consolidation or updates.',
              sx: {
                backgroundImage: 'linear-gradient(135deg, #fee2e2 0%, #fff1f2 100%)',
                color: '#7f1d1d',
                border: '1px solid #fecdd3',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                fontWeight: 700,
              },
            },
          ]}
        />
        {(!alerts || alerts.length === 0) ? (
          <Alert severity="info">No cannibalization detected for this window.</Alert>
        ) : (
          <List dense>
            {alerts.slice(0, 10).map((a, idx) => (
              <ListItem key={`${a.query}-${idx}`} sx={{ px: 0, alignItems: 'flex-start' }}>
                <ListItemText
                  primary={a.query}
                  secondary={
                    <Box sx={{ mt: 0.5 }}>
                      <Typography variant="caption" sx={{ color: '#6b7280', display: 'block', mb: 0.5 }}>
                        Total clicks: {formatNumber(a.total_clicks || 0)} • Target: {a.recommended_target_page || 'N/A'}
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {(a.pages || []).map((p, i) => {
                          const clicks = Number(p.clicks || 0);
                          const impressions = Number(p.impressions || 0);
                          const ctr = Number(p.ctr || 0);
                          const ctrColor = ctr >= 3 ? '#065f46' : ctr >= 1 ? '#92400e' : '#7f1d1d';
                          const ctrBg = ctr >= 3
                            ? 'linear-gradient(135deg, #d1fae5 0%, #ecfdf5 100%)'
                            : ctr >= 1
                            ? 'linear-gradient(135deg, #fef3c7 0%, #fffbeb 100%)'
                            : 'linear-gradient(135deg, #fee2e2 0%, #fff1f2 100%)';
                          const label = `${String(p.page || '').replace(/^https?:\/\//, '').slice(0, 40)} • ${formatNumber(clicks)}c/${formatNumber(impressions)}i • ${ctr.toFixed(1)}%`;
                          return (
                            <Tooltip
                              key={`${p.page}-${i}`}
                              title={`Clicks ${clicks}, impressions ${impressions}, CTR ${ctr.toFixed(1)}% for this page`}
                            >
                              <Chip
                                label={label}
                                size="small"
                                sx={{
                                  backgroundImage: ctrBg,
                                  color: ctrColor,
                                  border: '1px solid rgba(0,0,0,0.06)',
                                  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                                  fontWeight: 700,
                                  maxWidth: 260,
                                }}
                              />
                            </Tooltip>
                          );
                        })}
                      </Box>
                    </Box>
                  }
                  primaryTypographyProps={{ variant: 'body2' }}
                />
                <Button
                  size="small"
                  variant="outlined"
                  sx={{ mr: 1, textTransform: 'none' }}
                  disabled={!a.recommended_target_page || !isValidHttpUrl(String(a.recommended_target_page))}
                  onClick={() => {
                    if (a.recommended_target_page && isValidHttpUrl(String(a.recommended_target_page))) {
                      window.open(String(a.recommended_target_page), '_blank');
                    }
                  }}
                >
                  Open Target Page
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  sx={{ textTransform: 'none' }}
                  onClick={() => {
                    const page = String(a.recommended_target_page || '');
                    onOpenBrief(page, a.query, a.total_clicks || 0);
                  }}
                >
                  Create Brief
                </Button>
              </ListItem>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );
};

interface PlatformAnalyticsComponentProps {
  platforms?: string[];
  showSummary?: boolean;
  refreshInterval?: number; // in milliseconds, 0 = no auto-refresh
  onDataLoaded?: (data: any) => void;
  onRefreshReady?: (refreshFn: () => Promise<void>) => void; // Expose refresh function to parent
  onReconnect?: (platform: string) => void; // Reconnect handler for individual platforms
  showBackgroundJobs?: boolean; // Only render background jobs when user triggers
  siteUrl?: string; // Primary website URL (SSOT — passed from user's entered website)
}

const PlatformAnalytics: React.FC<PlatformAnalyticsComponentProps> = ({
  platforms = [],
  showSummary = true,
  refreshInterval = 0,
  onDataLoaded,
  onRefreshReady,
  onReconnect,
  showBackgroundJobs = false,
  siteUrl,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analyticsData, setAnalyticsData] = useState<Record<string, PlatformAnalyticsType>>({});
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [platformStatus, setPlatformStatus] = useState<Record<string, PlatformConnectionStatus>>({});
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [priorityPlatform, setPriorityPlatform] = useState<'auto' | 'gsc' | 'bing'>('auto');
  const [rangeDays, setRangeDays] = useState<number>(30);
  const [suggestions, setSuggestions] = useState<Array<{ query: string; impressions: number; ctr: number; position: number }>>([]);
  const [refreshQueue, setRefreshQueue] = useState<{
    risingQueries: Array<{ query: string; deltaClicks: number; deltaImpressions: number }>;
    decliningQueries: Array<{ query: string; deltaClicks: number; deltaImpressions: number }>;
  }>({ risingQueries: [], decliningQueries: [] });
  const [loadingQueue, setLoadingQueue] = useState<boolean>(false);
  const [briefOpen, setBriefOpen] = useState<boolean>(false);
  const [briefData, setBriefData] = useState<{ page: string; queries: Array<{ query: string; clicks: number; impressions: number; ctr: number }> } | null>(null);
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiInsights, setAiInsights] = useState<any | null>(null);
  const [resyncAttempted, setResyncAttempted] = useState<boolean>(false);
  const [bingCollecting, setBingCollecting] = useState<boolean>(false);
  const [bingCollectMsg, setBingCollectMsg] = useState<string | null>(null);
  const [bingSiteUrl, setBingSiteUrl] = useState<string>('');
  const [showLegend, setShowLegend] = useState<boolean>(false);

  const platformsRef = useRef(platforms);
  platformsRef.current = platforms;
  const rangeDaysRef = useRef(rangeDays);
  rangeDaysRef.current = rangeDays;
  const siteUrlRef = useRef(siteUrl);
  siteUrlRef.current = siteUrl;

  const onDataLoadedRef = useRef<typeof onDataLoaded>();
  const onRefreshReadyRef = useRef<typeof onRefreshReady>();

  useEffect(() => {
    onDataLoadedRef.current = onDataLoaded;
  }, [onDataLoaded]);

  useEffect(() => {
    onRefreshReadyRef.current = onRefreshReady;
  }, [onRefreshReady]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const activePlatforms = platformsRef.current || [];

      // Load platform connection status
      const statusResponse = await cachedAnalyticsAPI.getPlatformStatus();
      setPlatformStatus(statusResponse.platforms);
      const bingSitesResp: any[] = (statusResponse.platforms?.['bing']?.sites || []);

      // Load analytics data
      const end = new Date();
      const start = new Date(end);
      const rDays = rangeDaysRef.current;
      start.setDate(end.getDate() - (rDays - 1));
      const fmt = (d: Date) => d.toISOString().slice(0, 10);
      const analyticsResponse = await cachedAnalyticsAPI.getAnalyticsData(activePlatforms, false, {
        start_date: fmt(start),
        end_date: fmt(end),
      });
      setAnalyticsData(analyticsResponse.data as Record<string, PlatformAnalyticsType>);
      setSummary(analyticsResponse.summary);
      setLastUpdated(new Date());

      // Initialize site URL: use SSOT prop first, then Bing API sites, then localStorage
      let initialSite = siteUrlRef.current || '';
      if (!initialSite && bingSitesResp && bingSitesResp.length > 0) {
        const preferred = bingSitesResp.find(s => typeof s?.Url === 'string')?.Url
          || bingSitesResp.find(s => typeof s?.url === 'string')?.url
          || '';
        initialSite = preferred;
      }
      if (!initialSite) {
        const ls = (typeof window !== 'undefined') ? (localStorage.getItem('website_url') || sessionStorage.getItem('website_url') || '') : '';
        initialSite = ls || '';
      }
      if (initialSite) {
        setBingSiteUrl(initialSite);
      }

      const dataCallback = onDataLoadedRef.current;
      if (dataCallback) {
        dataCallback({
          analytics: analyticsResponse.data,
          summary: analyticsResponse.summary,
          status: statusResponse.platforms,
        });
      }
      const gsc = (analyticsResponse.data as any)['gsc'] as PlatformAnalyticsType | undefined;
      if (gsc && gsc.status === 'error') {
        console.warn(`GSC analytics error: ${gsc.error_message}`);
      }
      if (gsc && gsc.status === 'success') {
        const tq = (gsc.metrics as any)?.top_queries || [];
        const impThreshold = rDays <= 7 ? 100 : rDays <= 30 ? 500 : 1500;
        const ctrThreshold = 2.5;
        let filtered = tq
          .filter((row: any) => {
            const impressions = Number(row.impressions || 0);
            const ctr = Number(row.ctr || 0);
            return impressions >= impThreshold && ctr > 0 && ctr <= ctrThreshold;
          })
          .map((row: any) => ({
            query: String(row.query || ''),
            impressions: Number(row.impressions || 0),
            ctr: Number(row.ctr || 0),
            position: Number(row.position || 0),
          }));
        if (filtered.length === 0 && Array.isArray(tq) && tq.length > 0) {
          // Fallback: show lowest-CTR queries with decent impressions
          const fallback = [...tq]
            .filter((row: any) => Number(row.impressions || 0) >= Math.max(20, Math.floor(impThreshold / 2)))
            .sort((a: any, b: any) => Number(a.ctr || 0) - Number(b.ctr || 0))
            .slice(0, 5)
            .map((row: any) => ({
              query: String(row.query || ''),
              impressions: Number(row.impressions || 0),
              ctr: Number(row.ctr || 0),
              position: Number(row.position || 0),
            }));
          filtered = fallback;
        }
        setSuggestions(filtered.slice(0, 10));
      } else {
        setSuggestions([]);
      }
    } catch (err: unknown) {
      console.error('Error loading analytics data:', err, { platformStatus });
      let errorMessage = 'Failed to load analytics data';
      if (err instanceof Error) {
        errorMessage = (err as Error).message;
      } else if (typeof err === 'string') {
        errorMessage = err;
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  // Method to force refresh (bypass cache) — stable, reads latest values from refs
  const forceRefresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const end = new Date();
      const start = new Date(end);
      const rDays = rangeDaysRef.current;
      start.setDate(end.getDate() - (rDays - 1));
      const fmt = (d: Date) => d.toISOString().slice(0, 10);
      const activePlatforms = platformsRef.current || [];
      await cachedAnalyticsAPI.forceRefreshAnalyticsData(activePlatforms, {
        start_date: fmt(start),
        end_date: fmt(end),
      });
      
      await loadData();
      
    } catch (err) {
      console.error('PlatformAnalytics: Force refresh failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to refresh data');
    } finally {
      setLoading(false);
    }
  }, [loadData]);

  // Auto-resync when Bing status shows connected but analytics returns token errors (post-OAuth page reload)
  useEffect(() => {
    if (resyncAttempted) return;
    const status = platformStatus?.['bing'];
    const bing = analyticsData?.['bing'];
    const connected = !!status?.connected;
    const hasTokenError = !!(bing && bing.status === 'error' && /token|expired|not connected|oauth/i.test(bing.error_message || ''));
    if (connected && hasTokenError) {
      setResyncAttempted(true);
      (async () => {
        try {
          await cachedAnalyticsAPI.invalidatePlatformStatus();
          await cachedAnalyticsAPI.forceRefreshAnalyticsData(['bing']);
          await loadData();
        } catch (e) {
          console.error('Bing OAuth resync failed — user can force refresh manually:', e);
        }
      })();
    }
  }, [platformStatus, analyticsData, resyncAttempted, loadData]);

  const computeRefreshQueue = useCallback(async () => {
    try {
      setLoadingQueue(true);
      const end = new Date();
      const start = new Date(end);
      start.setDate(end.getDate() - (rangeDays - 1));
      const prevEnd = new Date(start);
      prevEnd.setDate(start.getDate() - 1);
      const prevStart = new Date(prevEnd);
      prevStart.setDate(prevEnd.getDate() - (rangeDays - 1));
      const fmt = (d: Date) => d.toISOString().slice(0, 10);
      let currentGSC = (analyticsData['gsc'] as PlatformAnalyticsType | undefined);
      if (!currentGSC) {
        const currentResp = await cachedAnalyticsAPI.getAnalyticsData(['gsc'], false, {
          start_date: fmt(start),
          end_date: fmt(end),
        });
        currentGSC = (currentResp.data as any)['gsc'] as PlatformAnalyticsType | undefined;
      }
      const prevResp = await cachedAnalyticsAPI.getAnalyticsData(['gsc'], false, {
        start_date: fmt(prevStart),
        end_date: fmt(prevEnd),
      });
      const prevGSC = (prevResp.data as any)['gsc'] as PlatformAnalyticsType | undefined;
      const currQueries = (currentGSC?.metrics as any)?.top_queries || [];
      const prevQueries = (prevGSC?.metrics as any)?.top_queries || [];
      const prevMap: Record<string, { clicks: number; impressions: number }> = {};
      prevQueries.forEach((q: any) => {
        const key = String(q.query || '').toLowerCase();
        prevMap[key] = { clicks: Number(q.clicks || 0), impressions: Number(q.impressions || 0) };
      });
      const rising: Array<{ query: string; deltaClicks: number; deltaImpressions: number }> = [];
      const declining: Array<{ query: string; deltaClicks: number; deltaImpressions: number }> = [];
      const riseClicksThresh = rangeDays <= 7 ? 5 : rangeDays <= 30 ? 20 : 40;
      const riseImprThresh = rangeDays <= 7 ? 50 : rangeDays <= 30 ? 200 : 500;
      const dropClicksThresh = -riseClicksThresh;
      const dropImprThresh = -riseImprThresh;
      currQueries.forEach((q: any) => {
        const key = String(q.query || '').toLowerCase();
        const prev = prevMap[key] || { clicks: 0, impressions: 0 };
        const deltaClicks = Number(q.clicks || 0) - prev.clicks;
        const deltaImpressions = Number(q.impressions || 0) - prev.impressions;
        if (deltaClicks > 0 && deltaImpressions > 0 && (deltaClicks >= riseClicksThresh || deltaImpressions >= riseImprThresh)) {
          rising.push({ query: String(q.query || ''), deltaClicks, deltaImpressions });
        }
        if (deltaClicks < 0 && deltaImpressions <= 0 && (deltaClicks <= dropClicksThresh || deltaImpressions <= dropImprThresh)) {
          declining.push({ query: String(q.query || ''), deltaClicks, deltaImpressions });
        }
      });
      rising.sort((a, b) => (b.deltaClicks + b.deltaImpressions) - (a.deltaClicks + a.deltaImpressions));
      declining.sort((a, b) => (a.deltaClicks + a.deltaImpressions) - (b.deltaClicks + b.deltaImpressions));
      // Fallback: if none meet thresholds, show the most changed queries by absolute delta
      if (rising.length === 0 && declining.length === 0) {
        const deltas: Array<{ query: string; deltaClicks: number; deltaImpressions: number; score: number }> = [];
        currQueries.forEach((q: any) => {
          const key = String(q.query || '').toLowerCase();
          const prev = prevMap[key] || { clicks: 0, impressions: 0 };
          const dC = Number(q.clicks || 0) - prev.clicks;
          const dI = Number(q.impressions || 0) - prev.impressions;
          const score = Math.abs(dC) + Math.abs(dI);
          if (score > 0) {
            deltas.push({ query: String(q.query || ''), deltaClicks: dC, deltaImpressions: dI, score });
          }
        });
        deltas.sort((a, b) => b.score - a.score);
        const top = deltas.slice(0, 10);
        if (top.length === 0 && Array.isArray(currQueries) && currQueries.length > 0) {
          const topByClicks = [...currQueries]
            .sort((a: any, b: any) => Number(b.clicks || 0) - Number(a.clicks || 0))
            .slice(0, 10);
          setRefreshQueue({
            risingQueries: topByClicks.map((q: any) => ({
              query: String(q.query || ''),
              deltaClicks: Number(q.clicks || 0),
              deltaImpressions: Number(q.impressions || 0),
            })),
            decliningQueries: [],
          });
        } else {
          setRefreshQueue({
            risingQueries: top.filter(d => d.deltaClicks > 0 || d.deltaImpressions > 0).map(({ score, ...rest }) => rest),
            decliningQueries: top.filter(d => d.deltaClicks < 0 || d.deltaImpressions < 0).map(({ score, ...rest }) => rest),
          });
        }
      } else {
        setRefreshQueue({ risingQueries: rising.slice(0, 10), decliningQueries: declining.slice(0, 10) });
      }
    } catch (e) {
      console.error('Error computing refresh queue:', e);
      setError('Failed to compute query refresh trends');
      setRefreshQueue({ risingQueries: [], decliningQueries: [] });
    } finally {
      setLoadingQueue(false);
    }
  }, [rangeDays, analyticsData]);

  // One-run guard to prevent duplicate calls in StrictMode
  const dataLoadedRef = useRef(false);

  useEffect(() => {
    if (dataLoadedRef.current) return;
    dataLoadedRef.current = true;
    
    loadData();

    // Listen for Bing OAuth success/error to invalidate caches and refresh
    const handleMessage = (event: MessageEvent) => {
      const data: any = event?.data;
      if (!data || typeof data !== 'object') return;
      if (data.type === 'BING_OAUTH_SUCCESS') {
        try {
          cachedAnalyticsAPI.invalidatePlatformStatus();
          cachedAnalyticsAPI.invalidateAnalyticsData();
        } catch (e) {
          console.error('Failed to invalidate analytics cache after Bing OAuth success:', e);
        }
        forceRefresh();
      }
      if (data.type === 'BING_OAUTH_ERROR') {
        try {
          cachedAnalyticsAPI.invalidatePlatformStatus();
        } catch (e) {
          console.error('Failed to invalidate platform status cache after Bing OAuth error:', e);
        }
      }
    };
    window.addEventListener('message', handleMessage);

    // Set up auto-refresh if interval is specified
    let interval: NodeJS.Timeout | null = null;
    if (refreshInterval > 0) {
      interval = setInterval(loadData, refreshInterval);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
      window.removeEventListener('message', handleMessage);
    };
  }, [refreshInterval, loadData, forceRefresh]);

  // Reload data when the date range changes after initial mount
  useEffect(() => {
    if (!dataLoadedRef.current) return;
    loadData();
  }, [rangeDays]);

  // Reload data when platforms change after initial mount
  useEffect(() => {
    if (!dataLoadedRef.current) return;
    loadData();
  }, [platforms]);

  // Auto-compute refresh queue only when background jobs/advanced insights are enabled
  useEffect(() => {
    if (!dataLoadedRef.current) return;
    if (!lastUpdated) return;
    if (!showBackgroundJobs) return;
    computeRefreshQueue();
  }, [rangeDays, lastUpdated, computeRefreshQueue, showBackgroundJobs]);

  // Expose refresh function to parent component
  useEffect(() => {
    const cb = onRefreshReadyRef.current;
    if (cb) {
      cb(forceRefresh);
    }
  }, [forceRefresh]);

  const getPlatformIcon = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'gsc':
        return <Search color="primary" />;
      case 'wix':
        return <Web color="secondary" />;
      case 'wordpress':
        return <Web color="info" />;
      case 'bing':
        return <Search color="primary" />;
      default:
        return <Web />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'success';
      case 'error':
        return 'error';
      case 'partial':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle color="success" fontSize="small" />;
      case 'error':
        return <ErrorIcon color="error" fontSize="small" />;
      case 'partial':
        return <Warning color="warning" fontSize="small" />;
      default:
        return <Info fontSize="small" />;
    }
  };

  const isValidHttpUrl = (value: string) => {
    try {
      const u = new URL(value);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  // Compute summary display based on priority and available platform data
  const computedSummary = React.useMemo(() => {
    const gsc = analyticsData['gsc'];
    const bing = analyticsData['bing'];
    const isGscOk = gsc && (gsc.status === 'success' || gsc.status === 'partial');
    const isBingOk = bing && (bing.status === 'success' || bing.status === 'partial');
    const anyPlatformOk = isGscOk || isBingOk;
    const sumFromTopPages = (metrics?: any) => {
      const pages = Array.isArray(metrics?.top_pages) ? metrics.top_pages : [];
      if (!pages.length) {
        return { clicks: 0, impressions: 0 };
      }
      let clicks = 0;
      let impressions = 0;
      for (const row of pages) {
        clicks += Number(row?.clicks || 0);
        impressions += Number(row?.impressions || 0);
      }
      return { clicks, impressions };
    };
    const pick = (m?: any) => ({
      clicks: Number(m?.total_clicks || 0),
      impressions: Number(m?.total_impressions || 0),
    });

    if (priorityPlatform === 'auto') {
      if (isGscOk) {
        let g = pick(gsc.metrics);
        if (g.clicks === 0) {
          const fromPages = sumFromTopPages(gsc.metrics);
          if (fromPages.clicks > 0) {
            g = {
              clicks: fromPages.clicks,
              impressions: g.impressions || fromPages.impressions,
            };
          }
        }
        return {
          clicks: g.clicks,
          impressions: g.impressions,
          label: 'GSC (Auto)',
          na: false,
        };
      }
      if (summary) {
        const clicks = Number(summary.total_clicks || 0);
        const impressions = Number(summary.total_impressions || 0);
        return {
          clicks,
          impressions,
          label: 'Combined',
          na: !anyPlatformOk && clicks === 0 && impressions === 0,
        };
      }
      return { clicks: 0, impressions: 0, label: 'Combined', na: !anyPlatformOk };
    }

    if (priorityPlatform === 'gsc') {
      if (isGscOk) {
        let g = pick(gsc.metrics);
        if (g.clicks === 0) {
          const fromPages = sumFromTopPages(gsc.metrics);
          if (fromPages.clicks > 0) {
            g = {
              clicks: fromPages.clicks,
              impressions: g.impressions || fromPages.impressions,
            };
          }
        }
        return { ...g, label: 'GSC', na: false };
      }
      return { clicks: 0, impressions: 0, label: 'GSC', na: !gsc };
    }
    if (priorityPlatform === 'bing') {
      if (isBingOk) return { ...pick(bing.metrics), label: 'Bing', na: false };
      return { clicks: 0, impressions: 0, label: 'Bing', na: !bing };
    }

    return { clicks: 0, impressions: 0, label: 'N/A', na: true };
  }, [analyticsData, priorityPlatform, summary]);

  const renderMetricsCard = (platform: string, data: PlatformAnalyticsType) => {
    const metrics = data.metrics;
    
    return (
      <Card key={platform} sx={{ height: '100%', bgcolor: '#ffffff', color: '#1f2937', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)' }}>
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
                <>
                  <TextField
                    size="small"
                    placeholder="https://www.example.com/"
                    value={bingSiteUrl}
                    onChange={(e) => setBingSiteUrl(e.target.value)}
                    sx={{ minWidth: 280 }}
                    label="Bing Site URL"
                  />
                <Button
                  variant="outlined"
                  size="small"
                  disabled={bingCollecting}
                  onClick={async () => {
                    try {
                      setBingCollectMsg(null);
                      setBingCollecting(true);
                      // Derive a site URL from platform status first, then metrics fallback
                      const bingStatus = platformStatus?.['bing'];
                      const statusSites: any[] = Array.isArray(bingStatus?.sites) ? bingStatus!.sites : [];
                      const metricsSites: any[] = Array.isArray((data as any)?.metrics?.sites) ? (data as any).metrics.sites : [];
                      const candidates = [...statusSites, ...metricsSites];
                      let siteUrl: string =
                        (candidates.find(s => typeof s?.Url === 'string')?.Url) ||
                        (candidates.find(s => typeof s?.url === 'string')?.url) ||
                        '';
                      // If user entered a site URL, prefer it
                      if (bingSiteUrl && typeof bingSiteUrl === 'string') {
                        siteUrl = bingSiteUrl.trim();
                      }
                      if (!siteUrl) {
                        setBingCollectMsg('No Bing site found to collect.');
                        return;
                      }
                      await apiClient.post('/bing-analytics/collect-data', null, {
                        params: { site_url: siteUrl, days_back: Math.max(7, Math.min(90, rangeDays)) }
                      });
                      setBingCollectMsg('Bing storage refresh started…');
                      // Soft refresh after a short delay to reflect any quick writes
                      setTimeout(() => {
                        forceRefresh().catch(() => {});
                      }, 3500);
                    } catch (e: any) {
                      setBingCollectMsg(e?.message || 'Failed to start Bing collection');
                    } finally {
                      setBingCollecting(false);
                    }
                  }}
                  sx={{ textTransform: 'none' }}
                >
                  {bingCollecting ? 'Refreshing…' : 'Refresh Bing Storage'}
                </Button>
                </>
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
                      const risingSet = new Set((refreshQueue?.risingQueries || []).map(r => String(r.query || '').toLowerCase()));
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

  const renderSummaryCard = () => {
    if (!summary) return null;

    const totalClicks = computedSummary.clicks || 0;
    const totalImpressions = computedSummary.impressions || 0;
    const connectedCount = Object.values(platformStatus).filter(s => s.connected).length;
    const ctrDisplay = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : 'N/A';
    const bingStatus = platformStatus['bing'];
    const bingConnected = !!bingStatus?.connected;
    const bingLastSync = (analyticsData['bing']?.last_updated) ? new Date(analyticsData['bing']!.last_updated).toLocaleString() : (bingStatus as any)?.last_sync || null;
    const gscMetrics: any = (analyticsData['gsc'] as any)?.metrics || {};
    const topPagesRaw: any[] = Array.isArray(gscMetrics.top_pages) ? gscMetrics.top_pages : [];
    const topPagesChart = topPagesRaw
      .slice()
      .sort((a, b) => Number(b?.clicks || 0) - Number(a?.clicks || 0))
      .slice(0, 5)
      .map((p) => ({
        label: String(p?.page || '')
          .replace(/^https?:\/\//, '')
          .replace(/^www\./, '')
          .slice(0, 26),
        clicks: Number(p?.clicks || 0),
        impressions: Number(p?.impressions || 0),
        ctr: Number(p?.ctr || 0),
        fullUrl: String(p?.page || ''),
      }));
    const topQueriesRaw: any[] = Array.isArray(gscMetrics.top_queries) ? gscMetrics.top_queries : [];
    const ctrPositionData = topQueriesRaw
      .filter((q) => typeof q?.position !== 'undefined' && typeof q?.ctr !== 'undefined')
      .slice(0, 40)
      .map((q) => ({
        query: String(q?.query || ''),
        position: Number(q?.position || 0),
        ctr: Number(q?.ctr || 0),
      }));

    return (
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Box>
              <Typography variant="h6">
                Analytics Summary
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                <Typography variant="caption" color="text.secondary">
                  Platform Health
                </Typography>
                <Chip
                  size="small"
                  label={`Bing: ${bingConnected ? 'Connected' : 'Disconnected'}`}
                  color={bingConnected ? 'success' : 'error'}
                />
                <Typography variant="caption" color="text.secondary">
                  {bingLastSync ? `Last sync: ${bingLastSync}` : 'Last sync: N/A'}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              {lastUpdated && (
                <Typography variant="caption" color="text.secondary">
                  Last refreshed: {lastUpdated.toLocaleString()}
                </Typography>
              )}
              <IconButton onClick={forceRefresh} disabled={loading} title="Force refresh (bypass cache)">
                <Refresh />
              </IconButton>
            </Box>
          </Box>
          
          <Grid container spacing={2} sx={{ mb: 1 }}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth size="small">
                <InputLabel id="platform-priority-label">Platform View</InputLabel>
                <Select
                  labelId="platform-priority-label"
                  label="Platform View"
                  value={priorityPlatform}
                  onChange={(e) => setPriorityPlatform(e.target.value as any)}
                >
                  <MenuItem value="auto">Auto (Combined)</MenuItem>
                  <MenuItem value="gsc" disabled={!platformStatus['gsc'] || !platformStatus['gsc'].connected}>GSC</MenuItem>
                  <MenuItem value="bing" disabled={!platformStatus['bing'] || !platformStatus['bing'].connected}>Bing</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth size="small">
                <InputLabel id="date-range-label">Date Range</InputLabel>
                <Select
                  labelId="date-range-label"
                  label="Date Range"
                  value={rangeDays}
                  onChange={(e) => setRangeDays(Number(e.target.value))}
                >
                  <MenuItem value={7}>Last 7 days</MenuItem>
                  <MenuItem value={30}>Last 30 days</MenuItem>
                  <MenuItem value={90}>Last 90 days</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          <Grid container spacing={3}>
            <Grid item xs={6} sm={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="primary">
                  {connectedCount}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Connected Platforms
                </Typography>
              </Box>
            </Grid>
            
            <Grid item xs={6} sm={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="secondary">
                  {computedSummary.na ? 'N/A' : formatNumber(totalClicks)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Total Clicks
                </Typography>
              </Box>
            </Grid>
            
            <Grid item xs={6} sm={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="info">
                  {computedSummary.na ? 'N/A' : formatNumber(totalImpressions)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Total Impressions
                </Typography>
              </Box>
            </Grid>
            
            <Grid item xs={6} sm={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="success">
                  {typeof ctrDisplay === 'string' ? ctrDisplay : `${ctrDisplay}%`}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Overall CTR
                </Typography>
              </Box>
            </Grid>
          </Grid>

          {(totalClicks === 0 && totalImpressions === 0) && (
            <Alert severity="info" sx={{ mt: 2 }}>
              {computedSummary.na ? 'Failed to fetch analytics for selected view.' : 'No recent search traffic detected.'}
            </Alert>
          )}

          {(topPagesChart.length > 0 || ctrPositionData.length > 0) && (
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
          )}

          <Box
            sx={{
              mt: 2.5,
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 1.5,
              flexWrap: 'wrap',
            }}
          >
            <Button
              size="small"
              variant="contained"
              onClick={() => setShowLegend(v => !v)}
              sx={{
                px: 2.5,
                py: 0.75,
                borderRadius: 999,
                textTransform: 'none',
                fontWeight: 600,
                letterSpacing: 0.03,
                backgroundImage: 'linear-gradient(120deg, #0ea5e9, #22c55e)',
                backgroundSize: '200% 200%',
                color: '#f9fafb',
                boxShadow: '0 0 18px rgba(34, 197, 94, 0.45)',
                transition: 'transform 0.15s ease-out, box-shadow 0.15s ease-out, background-position 0.3s ease-out',
                '@keyframes shimmerLegend': {
                  '0%': { backgroundPosition: '0% 50%' },
                  '50%': { backgroundPosition: '100% 50%' },
                  '100%': { backgroundPosition: '0% 50%' },
                },
                animation: 'shimmerLegend 7s ease infinite',
                '&:hover': {
                  boxShadow: '0 0 26px rgba(34, 197, 94, 0.85)',
                  transform: 'translateY(-1px)',
                },
              }}
            >
              {showLegend ? 'Hide Metric Legend' : 'Show Metric Legend'}
            </Button>
            <Button
              size="small"
              variant="contained"
              disabled={aiLoading}
              onClick={async () => {
                try {
                  setAiLoading(true);
                  setAiError(null);
                  const end = new Date();
                  const start = new Date(end);
                  start.setDate(end.getDate() - (rangeDays - 1));
                  const fmt = (d: Date) => d.toISOString().slice(0, 10);
                  const resp = await cachedAnalyticsAPI.getAIInsights({ start_date: fmt(start), end_date: fmt(end) });
                  if (!resp.success) {
                    setAiError(resp.error || 'Failed to generate insights');
                    setAiInsights(null);
                  } else {
                    setAiInsights(resp.insights || null);
                  }
                } catch (e: any) {
                  setAiError(e?.message || 'Failed to generate insights');
                  setAiInsights(null);
                } finally {
                  setAiLoading(false);
                }
              }}
              sx={{
                px: 2.8,
                py: 0.75,
                borderRadius: 999,
                textTransform: 'none',
                fontWeight: 700,
                letterSpacing: 0.04,
                backgroundImage: 'linear-gradient(120deg, #4f46e5, #7c3aed, #ec4899)',
                backgroundSize: '220% 220%',
                color: '#f9fafb',
                boxShadow: '0 0 22px rgba(129, 140, 248, 0.6)',
                transition: 'transform 0.15s ease-out, box-shadow 0.15s ease-out, background-position 0.3s ease-out',
                '@keyframes shimmerAI': {
                  '0%': { backgroundPosition: '0% 50%' },
                  '50%': { backgroundPosition: '100% 50%' },
                  '100%': { backgroundPosition: '0% 50%' },
                },
                animation: 'shimmerAI 6s ease infinite',
                '&:hover': {
                  boxShadow: '0 0 30px rgba(129, 140, 248, 0.95)',
                  transform: 'translateY(-1px)',
                },
                '&.Mui-disabled': {
                  opacity: 0.6,
                  boxShadow: 'none',
                },
              }}
            >
              {aiLoading ? 'Analyzing…' : 'Explain These Insights'}
            </Button>
          </Box>

          {showLegend && (
            <Box sx={{ mt: 2.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="subtitle2">Metric legend</Typography>
                <Typography variant="caption" color="text.secondary">How to read the chips across this step</Typography>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                <ChipLegend
                  items={[
                    {
                      label: 'Clicks',
                      icon: <MouseOutlined fontSize="small" />,
                      tooltip: 'Total visits from Google for this item in the selected date range.',
                      sx: { backgroundImage: 'linear-gradient(135deg, #dbeafe 0%, #eef2ff 100%)', color: '#1e3a8a', border: '1px solid #c7d2fe', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', fontWeight: 700 },
                    },
                    {
                      label: 'Impressions',
                      icon: <Visibility fontSize="small" />,
                      tooltip: 'How often your result was shown in search. Higher means more visibility.',
                      sx: { backgroundImage: 'linear-gradient(135deg, #e2e8f0 0%, #f8fafc 100%)', color: '#0f172a', border: '1px solid #cbd5e1', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', fontWeight: 700 },
                    },
                    {
                      label: 'CTR',
                      tooltip: 'Click‑through rate: clicks ÷ impressions. Higher is better.',
                      sx: { backgroundImage: 'linear-gradient(135deg, #d1fae5 0%, #ecfdf5 100%)', color: '#065f46', border: '1px solid #86efac', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', fontWeight: 700 },
                    },
                  ]}
                />
                <ChipLegend
                  items={[
                    {
                      label: 'Trending',
                      icon: <TrendingUp fontSize="small" />,
                      tooltip: 'Query is rising versus the previous window. Great candidate to double‑down on.',
                      sx: { backgroundImage: 'linear-gradient(135deg, #ecfdf5 0%, #ffffff 100%)', color: '#065f46', border: '1px solid #a7f3d0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', fontWeight: 700 },
                    },
                    {
                      label: 'Δ Clicks / Δ Impr',
                      icon: <MouseOutlined fontSize="small" />,
                      tooltip: 'Change in clicks or impressions versus the previous date window.',
                      sx: { backgroundImage: 'linear-gradient(135deg, #ede9fe 0%, #eff6ff 100%)', color: '#4c1d95', border: '1px solid #ddd6fe', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', fontWeight: 700 },
                    },
                  ]}
                />
              </Box>
            </Box>
          )}

          {(aiError || aiInsights) && (
            <Box sx={{ mt: 2.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Typography variant="subtitle2">AI Insights</Typography>
                <Tooltip title="Summarizes all panels into simple recommendations for creators.">
                  <Info fontSize="small" color="action" />
                </Tooltip>
              </Box>
              {aiError && <Alert severity="error" sx={{ mb: 1 }}>{aiError}</Alert>}
              {aiInsights && (
                <Box>
                  <Typography variant="body2" sx={{ mb: 1 }}>{aiInsights.quick_summary}</Typography>
                  {Array.isArray(aiInsights.prioritized_findings) && aiInsights.prioritized_findings.length > 0 && (
                    <List dense>
                      {aiInsights.prioritized_findings.slice(0, 3).map((f: any, i: number) => (
                        <ListItem key={`ai-find-${i}`} sx={{ px: 0, alignItems: 'flex-start' }}>
                          <ListItemText
                            primary={f.title}
                            secondary={
                              <Box sx={{ mt: 0.5 }}>
                                <Typography variant="caption" sx={{ color: '#6b7280', display: 'block' }}>{f.evidence}</Typography>
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 0.5 }}>
                                  {(f.actions || []).slice(0, 2).map((a: string, idx: number) => (
                                    <Chip key={`act-${idx}`} label={a} size="small" />
                                  ))}
                                </Box>
                              </Box>
                            }
                            primaryTypographyProps={{ variant: 'body2' }}
                          />
                        </ListItem>
                      ))}
                    </List>
                  )}
                </Box>
              )}
            </Box>
          )}
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
        <CircularProgress />
        <Typography variant="body2" sx={{ ml: 2 }}>
          Loading analytics data...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box>
      {showSummary && renderSummaryCard()}
      <GscSuggestionsPanel
        suggestions={suggestions}
        rangeDays={rangeDays}
        formatNumber={formatNumber}
      />

      <CannibalizationAlertsPanel
        alerts={((analyticsData['gsc']?.metrics as any)?.cannibalization || []) as any}
        formatNumber={formatNumber}
        isValidHttpUrl={isValidHttpUrl}
        onOpenBrief={(page: string, query: string, totalClicks: number) => {
          const queries = [{ query, clicks: totalClicks, impressions: 0, ctr: 0 }];
          setBriefData({ page, queries });
          setBriefOpen(true);
        }}
      />

      {(() => {
        const gsc = analyticsData['gsc'];
        const pages = (gsc?.metrics as any)?.top_pages || [];
        return (
          <TopPagesInsightsPanel
            pages={pages}
            risingQueries={refreshQueue.risingQueries}
            onOpenPage={(url) => { if (url && isValidHttpUrl(String(url))) window.open(String(url), '_blank'); }}
            onCreateBrief={(page, queries) => { setBriefData({ page: String(page || ''), queries: Array.isArray(queries) ? queries : [] }); setBriefOpen(true); }}
            formatNumber={formatNumber}
          />
        );
      })()}

      <Dialog open={briefOpen} onClose={() => setBriefOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Create Content Brief</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <TextField
              label="Page URL"
              value={briefData?.page || ''}
              InputProps={{ readOnly: true }}
              fullWidth
              size="small"
            />
            <Box>
              <Typography variant="subtitle2" gutterBottom>Recent queries pointing to this page</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {(briefData?.queries || []).slice(0, 10).map((q, i) => (
                  <Chip
                    key={`${q.query}-${i}`}
                    label={`${q.query} • ${q.clicks}c/${q.impressions}i • ${q.ctr.toFixed(1)}%`}
                    size="small"
                  />
                ))}
                {(briefData?.queries || []).length === 0 && (
                  <Typography variant="caption" color="text.secondary">No query mappings available for this window.</Typography>
                )}
              </Box>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBriefOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => {
              try {
                const prefill = {
                  page: briefData?.page || '',
                  queries: briefData?.queries || [],
                  created_at: new Date().toISOString(),
                  source: 'platform_analytics_top_pages',
                };
                localStorage.setItem('alwrity_brief_prefill', JSON.stringify(prefill));
              } catch {}
              setBriefOpen(false);
              // Optional: navigate to writer; keeping simple and non-disruptive
              // window.location.href = '/blog-writer';
            }}
          >
            Start Brief
          </Button>
        </DialogActions>
      </Dialog>

      {showBackgroundJobs && (
        <RefreshQueuePanel
          risingQueries={refreshQueue.risingQueries}
          decliningQueries={refreshQueue.decliningQueries}
          loading={loadingQueue}
          onRecompute={computeRefreshQueue}
          formatNumber={formatNumber}
        />
      )}

      <Grid container spacing={3}>
        {Object.entries(analyticsData)
          .filter(([platform]) => platform.toLowerCase() !== 'wordpress') // Exclude WordPress analytics
          .map(([platform, data]) => (
            <Grid item xs={12} sm={6} lg={4} key={platform}>
              {renderMetricsCard(platform, data)}
            </Grid>
          ))}
      </Grid>

      {/* Background Job Manager - render only when explicitly enabled */}
      {showBackgroundJobs && (
        <Box sx={{ mt: 3 }}>
          <BackgroundJobManager
            siteUrl={bingSiteUrl}
            days={rangeDays}
            onJobCompleted={() => forceRefresh()}
          />
        </Box>
      )}

      {/* Debug section removed */}

      {/* Bing Insights Card - Show when Bing is connected */}
      {analyticsData.bing && (
        <Box sx={{ mt: 3 }}>
          {/* Debug text removed */}
          {analyticsData.bing.metrics?.connection_status === 'connected' && (
            <BingInsightsCard
              siteUrl={bingSiteUrl || analyticsData.bing.metrics?.sites?.[0]?.Url || analyticsData.bing.metrics?.sites?.[0]?.url || ''}
              days={rangeDays}
              insights={analyticsData.bing.metrics?.insights}
              loading={loading}
              error={error}
            />
          )}
        </Box>
      )}

      {Object.keys(analyticsData).length === 0 && (
        <Alert severity="info">
          No analytics data available. Connect your platforms to see analytics insights.
        </Alert>
      )}
    </Box>
  );
};

export default PlatformAnalytics;
