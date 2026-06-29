import React, { useState, useEffect, useCallback, useRef } from 'react';
import { keyframes } from '@emotion/react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  Alert,
  CircularProgress,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
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
import CannibalizationAlertsPanel from './CannibalizationAlertsPanel';
import SummaryCharts from './SummaryCharts';
import ContentBriefDialog from './ContentBriefDialog';
import AIInsightsPanel from './AIInsightsPanel';
import BingToolbar from './BingToolbar';
import MetricsCard from './MetricsCard';

const shimmerBg = keyframes`
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
`;

// CannibalizationPage, CannibalizationAlert, CannibalizationAlertsPanelProps, CannibalizationAlertsPanel moved to CannibalizationAlertsPanel.tsx

interface PlatformAnalyticsComponentProps {
  platforms?: string[];
  showSummary?: boolean;
  refreshInterval?: number; // in milliseconds, 0 = no auto-refresh
  onDataLoaded?: (data: any) => void;
  onRefreshReady?: (refreshFn: () => Promise<void>) => void; // Expose refresh function to parent
  onReconnect?: (platform: string) => void; // Reconnect handler for individual platforms
  showBackgroundJobs?: boolean; // Only render background jobs when user triggers
}

const PlatformAnalytics: React.FC<PlatformAnalyticsComponentProps> = ({
  platforms,
  showSummary = true,
  refreshInterval = 0,
  onDataLoaded,
  onRefreshReady,
  onReconnect,
  showBackgroundJobs = false,
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
  const [bingCollectMsg, setBingCollectMsg] = useState<string | null>(null);
  const [bingSiteUrl, setBingSiteUrl] = useState<string>('');
  const [showLegend, setShowLegend] = useState<boolean>(false);

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

      // Load platform connection status
      const statusResponse = await cachedAnalyticsAPI.getPlatformStatus();
      setPlatformStatus(statusResponse.platforms);
      const bingSitesResp: any[] = (statusResponse.platforms?.['bing']?.sites || []);

      // Load analytics data
      const end = new Date();
      const start = new Date(end);
      start.setDate(end.getDate() - (rangeDays - 1));
      const fmt = (d: Date) => d.toISOString().slice(0, 10);
      const analyticsResponse = await cachedAnalyticsAPI.getAnalyticsData(platforms, false, {
        start_date: fmt(start),
        end_date: fmt(end),
      });
      console.log('PlatformAnalytics: analyticsResponse', analyticsResponse);
      setAnalyticsData(analyticsResponse.data as Record<string, PlatformAnalyticsType>);
      setSummary(analyticsResponse.summary);
      setLastUpdated(new Date());

      // Initialize Bing site URL preference with safe fallbacks (avoid backend lookup on failure)
      let initialSite = '';
      if (bingSitesResp && bingSitesResp.length > 0) {
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
      if (gsc && gsc.status === 'success') {
        const tq = (gsc.metrics as any)?.top_queries || [];
        const impThreshold = rangeDays <= 7 ? 100 : rangeDays <= 30 ? 500 : 1500;
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
      console.error('Error loading analytics data:', err);
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
  }, [platforms, rangeDays]);

  // Method to force refresh (bypass cache)
  const forceRefresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Clear cache and force fresh data
      const end = new Date();
      const start = new Date(end);
      start.setDate(end.getDate() - (rangeDays - 1));
      const fmt = (d: Date) => d.toISOString().slice(0, 10);
      await cachedAnalyticsAPI.forceRefreshAnalyticsData(platforms, {
        start_date: fmt(start),
        end_date: fmt(end),
      });
      
      // Reload data
      await loadData();
      
    } catch (err) {
      console.error('PlatformAnalytics: Force refresh failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to refresh data');
    } finally {
      setLoading(false);
    }
  }, [platforms, loadData, rangeDays]);

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
          // swallow; user can force refresh
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
        if (!q) return;
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
        if (!q) return;
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
          if (!q) return;
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
        } catch {}
        forceRefresh();
      }
      if (data.type === 'BING_OAUTH_ERROR') {
        try {
          cachedAnalyticsAPI.invalidatePlatformStatus();
        } catch {}
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
          na: g.clicks === 0 && g.impressions === 0,
        };
      }
      if (summary) {
        const clicks = Number(summary.total_clicks || 0);
        const impressions = Number(summary.total_impressions || 0);
        return {
          clicks,
          impressions,
          label: 'Combined',
          na: clicks === 0 && impressions === 0,
        };
      }
      return { clicks: 0, impressions: 0, label: 'Combined', na: true as const };
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
        return { ...g, label: 'GSC' };
      }
      return { clicks: 0, impressions: 0, label: 'GSC', na: true };
    }
    if (priorityPlatform === 'bing') {
      if (isBingOk) return { ...pick(bing.metrics), label: 'Bing' };
      return { clicks: 0, impressions: 0, label: 'Bing', na: true };
    }

    return { clicks: 0, impressions: 0, label: 'N/A', na: true };
  }, [analyticsData, priorityPlatform, summary]);

  useEffect(() => {
    console.log('PlatformAnalytics: debug summary/computedSummary', {
      priorityPlatform,
      summary,
      computedSummary,
      analyticsData,
      platformStatus,
    });
  }, [summary, computedSummary, analyticsData, priorityPlatform, platformStatus]);

  const renderMetricsCard = (platform: string, data: PlatformAnalyticsType) => (
    <MetricsCard
      platform={platform}
      data={data}
      formatNumber={formatNumber}
      getPlatformIcon={getPlatformIcon}
      getStatusColor={getStatusColor}
      getStatusIcon={getStatusIcon}
      bingSiteUrl={bingSiteUrl}
      onBingSiteUrlChange={setBingSiteUrl}
      bingCollectMsg={bingCollectMsg}
      onBingCollectMsgChange={setBingCollectMsg}
      rangeDays={rangeDays}
      bingStatus={platformStatus?.['bing']}
      onForceRefresh={forceRefresh}
      onReconnect={onReconnect}
      risingQueries={refreshQueue?.risingQueries || []}
    />
  );

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

          <SummaryCharts
            topPagesChart={topPagesChart}
            ctrPositionData={ctrPositionData}
            formatNumber={formatNumber}
          />

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
                animation: `${shimmerBg} 7s ease infinite`,
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
                animation: `${shimmerBg} 6s ease infinite`,
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

          <AIInsightsPanel aiError={aiError} aiInsights={aiInsights} />
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

      <ContentBriefDialog
        open={briefOpen}
        onClose={() => setBriefOpen(false)}
        briefData={briefData}
      />

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
            siteUrl="https://www.alwrity.com/"
            days={30}
            onJobCompleted={(job) => {
              console.log('🎉 Background job completed:', job);
              // Refresh analytics data when job completes
              forceRefresh();
            }}
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
              siteUrl={
                analyticsData.bing.metrics?.sites?.[0]?.Url ||
                analyticsData.bing.metrics?.sites?.[0]?.url ||
                'https://www.alwrity.com/'
              }
              days={30}
              insights={analyticsData.bing.metrics?.insights}
              loading={loading}
              error={error}
              onInsightsLoaded={(insights) => {
                console.log('Bing insights loaded:', insights);
              }}
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
