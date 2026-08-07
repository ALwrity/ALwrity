import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
import Refresh from '@mui/icons-material/Refresh';
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
import { isValidHttpUrl, formatNumber } from './PlatformAnalytics.utils';
import { deriveSummaryDisplay } from './deriveSummaryDisplay';
import BriefDialog from './BriefDialog';
import TopPagesBarChart from './TopPagesBarChart';
import CtrPositionChart from './CtrPositionChart';
import CannibalizationAlertsPanel from './CannibalizationAlertsPanel';
import PlatformMetricCard from './PlatformMetricCard';
import AiInsightsPanel from './AiInsightsPanel';
import { useRefreshQueue } from './useRefreshQueue';

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
  const [aiInsights, setAiInsights] = useState<any | null>(null);
  const [briefOpen, setBriefOpen] = useState<boolean>(false);
  const [briefData, setBriefData] = useState<{ page: string; queries: Array<{ query: string; clicks: number; impressions: number; ctr: number }> } | null>(null);
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [resyncAttempted, setResyncAttempted] = useState<boolean>(false);
  const [bingCollecting, setBingCollecting] = useState<boolean>(false);
  const [bingCollectMsg, setBingCollectMsg] = useState<string | null>(null);
  const [bingSiteUrl, setBingSiteUrl] = useState<string>('');
  const [selectedGscSite, setSelectedGscSite] = useState<string>('');
  const [showLegend, setShowLegend] = useState<boolean>(false);

  const platformsRef = useRef(platforms);
  platformsRef.current = platforms;
  const rangeDaysRef = useRef(rangeDays);
  rangeDaysRef.current = rangeDays;
  const siteUrlRef = useRef(siteUrl);
  siteUrlRef.current = siteUrl;
  const selectedGscSiteRef = useRef(selectedGscSite);
  selectedGscSiteRef.current = selectedGscSite;

  const loadingRef = useRef(false);
  const analyticsDataRef = useRef<Record<string, PlatformAnalyticsType>>({});
  const platformStatusRef = useRef<Record<string, PlatformConnectionStatus>>({});

  const onDataLoadedRef = useRef<typeof onDataLoaded>();
  const onRefreshReadyRef = useRef<typeof onRefreshReady>();

  useEffect(() => {
    onDataLoadedRef.current = onDataLoaded;
  }, [onDataLoaded]);

  useEffect(() => {
    onRefreshReadyRef.current = onRefreshReady;
  }, [onRefreshReady]);

  const shallowEqual = (a: Record<string, any>, b: Record<string, any>) => {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every(k => {
      if (!(k in b)) return false;
      const aVal = a[k];
      const bVal = b[k];
      return aVal?.status === bVal?.status
        && aVal?.metrics?.total_clicks === bVal?.metrics?.total_clicks
        && aVal?.metrics?.total_impressions === bVal?.metrics?.total_impressions;
    });
  };

  // When user selects a different GSC site, re-fetch analytics
  useEffect(() => {
    if (selectedGscSite) {
      loadData();
    }
  }, [selectedGscSite]);

  const loadData = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      setLoading(true);
      setError(null);

      const activePlatforms = platformsRef.current || [];

      // Load platform connection status
      const statusResponse = await cachedAnalyticsAPI.getPlatformStatus();
      if (!shallowEqual(platformStatusRef.current, statusResponse.platforms)) {
        platformStatusRef.current = statusResponse.platforms;
        setPlatformStatus(statusResponse.platforms);
      }
      const bingSitesResp: any[] = (statusResponse.platforms?.['bing']?.sites || []);

      // Load analytics data — try DB cache first
      const end = new Date();
      const start = new Date(end);
      const rDays = rangeDaysRef.current;
      start.setDate(end.getDate() - (rDays - 1));
      const fmt = (d: Date) => d.toISOString().slice(0, 10);

      let analyticsResponse;
      let usedDBCache = false;
      if (activePlatforms.length > 0) {
        try {
          const firstPlatform = activePlatforms[0];
          const siteUrl = siteUrlRef.current || '';
          const existing = await cachedAnalyticsAPI.checkExistingAnalytics(firstPlatform, siteUrl);
          if (existing.exists && existing.analysis_id) {
            const dbData = await cachedAnalyticsAPI.loadAnalyticsFromDB(existing.analysis_id);
            if (dbData?.data) {
              analyticsResponse = dbData;
              usedDBCache = true;
              console.log('📦 PlatformAnalytics: Loaded from DB cache');
            }
          }
        } catch (e) {
          console.debug('PlatformAnalytics: DB cache miss, fetching fresh', e);
        }
      }

      if (!analyticsResponse) {
        analyticsResponse = await cachedAnalyticsAPI.getAnalyticsData(activePlatforms, false, {
          start_date: fmt(start),
          end_date: fmt(end),
        });
      }
      const newData = analyticsResponse.data as Record<string, PlatformAnalyticsType>;
      if (!shallowEqual(analyticsDataRef.current, newData)) {
        analyticsDataRef.current = newData;
        setAnalyticsData({ ...newData });
      }
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
        const ls = (typeof window !== 'undefined') ? (localStorage.getItem('website_url') || '') : '';
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
      loadingRef.current = false;
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

  const { refreshQueue, loadingQueue, computeRefreshQueue } = useRefreshQueue({ analyticsData, rangeDays });

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

  // Compute summary display based on priority and available platform data
  const computedSummary = React.useMemo(
    () => deriveSummaryDisplay(analyticsData, priorityPlatform, summary),
    [analyticsData, priorityPlatform, summary]
  );

  const isPriorityPlatformDisconnected = React.useMemo(() => {
    if (priorityPlatform === 'auto') {
      const platforms = Object.values(platformStatus);
      if (platforms.length === 0) return true;
      return platforms.every((s: any) => !s.connected);
    }
    const status = platformStatus[priorityPlatform];
    return !status || !status.connected;
  }, [priorityPlatform, platformStatus]);

  const topPagesChart = React.useMemo(() => {
    const gscMetrics: any = (analyticsData['gsc'] as any)?.metrics || {};
    const topPagesRaw: any[] = Array.isArray(gscMetrics.top_pages) ? gscMetrics.top_pages : [];
    return topPagesRaw
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
  }, [analyticsData]);

  const ctrPositionData = React.useMemo(() => {
    const gscMetrics: any = (analyticsData['gsc'] as any)?.metrics || {};
    const topQueriesRaw: any[] = Array.isArray(gscMetrics.top_queries) ? gscMetrics.top_queries : [];
    return topQueriesRaw
      .filter((q) => typeof q?.position !== 'undefined' && typeof q?.ctr !== 'undefined')
      .slice(0, 40)
      .map((q) => ({
        query: String(q?.query || ''),
        position: Number(q?.position || 0),
        ctr: Number(q?.ctr || 0),
      }));
  }, [analyticsData]);

  const renderSummaryCard = () => {
    if (!summary) return null;

    const totalClicks = computedSummary.clicks || 0;
    const totalImpressions = computedSummary.impressions || 0;
    const connectedCount = Object.values(platformStatus).filter(s => s.connected).length;
    const ctrDisplay = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : 'N/A';
    const bingStatus = platformStatus['bing'];
    const bingConnected = !!bingStatus?.connected;
    const bingLastSync = (analyticsData['bing']?.last_updated) ? new Date(analyticsData['bing']!.last_updated).toLocaleString() : (bingStatus as any)?.last_sync || null;

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
            {platformStatus['gsc']?.sites && (platformStatus['gsc']?.sites?.length || 0) > 1 && (
              <Grid item xs={12} md={6}>
                <FormControl fullWidth size="small">
                  <InputLabel id="gsc-site-label">GSC Site</InputLabel>
                  <Select
                    labelId="gsc-site-label"
                    label="GSC Site"
                    value={selectedGscSite}
                    onChange={(e) => setSelectedGscSite(e.target.value)}
                  >
                    {platformStatus['gsc'].sites.map((site: any) => (
                      <MenuItem key={site.siteUrl} value={site.siteUrl}>
                        {site.siteUrl}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            )}
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

          {isPriorityPlatformDisconnected && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              {priorityPlatform === 'auto'
                ? 'No platforms connected. Analytics charts will populate once you connect GSC or Bing.'
                : `${priorityPlatform.toUpperCase()} is not connected. Charts and metrics will populate once connected.`}
            </Alert>
          )}

          {!isPriorityPlatformDisconnected && totalClicks === 0 && totalImpressions === 0 && (
            <Alert severity="info" sx={{ mt: 2 }}>
              {computedSummary.na ? 'Failed to fetch analytics for selected view.' : 'No recent search traffic detected.'}
            </Alert>
          )}

          {(topPagesChart.length > 0 || ctrPositionData.length > 0) && (
            <Box sx={{ mt: 2.5 }}>
              <Grid container spacing={2}>
                {topPagesChart.length > 0 && (
                  <TopPagesBarChart data={topPagesChart} />
                )}
                {ctrPositionData.length > 0 && (
                  <CtrPositionChart data={ctrPositionData} />
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

          <AiInsightsPanel aiError={aiError} aiInsights={aiInsights} />
        </CardContent>
      </Card>
    );
  };

  const summaryCardContent = useMemo(
    () => renderSummaryCard(),
    [summary, platformStatus, analyticsData, lastUpdated, priorityPlatform, rangeDays, aiLoading, aiError, aiInsights, showLegend, topPagesChart, ctrPositionData]
  );

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
      {isPriorityPlatformDisconnected && (
        <Alert severity="warning" sx={{ mb: 2 }} action={
          priorityPlatform !== 'auto' && onReconnect ? (
            <Button color="inherit" size="small" onClick={() => onReconnect(priorityPlatform)}>
              Connect
            </Button>
          ) : undefined
        }>
          {priorityPlatform === 'auto'
            ? 'No analytics platforms are connected. Connect Google Search Console or Bing to see real data.'
            : `${priorityPlatform.toUpperCase()} is not connected. Connect it to see real analytics data.`}
        </Alert>
      )}
      {showSummary && summaryCardContent}
      {(!isPriorityPlatformDisconnected || priorityPlatform === 'bing') && (
        <GscSuggestionsPanel
          suggestions={suggestions}
          rangeDays={rangeDays}
          formatNumber={formatNumber}
        />
      )}

      {(!isPriorityPlatformDisconnected || priorityPlatform === 'bing') && (
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
      )}

      {(!isPriorityPlatformDisconnected || priorityPlatform === 'bing') && (
        (() => {
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
      })())}

      <BriefDialog
        open={briefOpen}
        briefData={briefData}
        onClose={() => setBriefOpen(false)}
      />

      {showBackgroundJobs && !isPriorityPlatformDisconnected && (
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
          .filter(([platform]) => platform.toLowerCase() !== 'wordpress')
          .map(([platform, data]) => (
            <Grid item xs={12} sm={6} lg={4} key={platform}>
              <PlatformMetricCard
                platform={platform}
                data={data}
                bingSiteUrl={bingSiteUrl}
                bingCollecting={bingCollecting}
                bingCollectMsg={bingCollectMsg}
                platformStatus={platformStatus}
                rangeDays={rangeDays}
                refreshQueue={refreshQueue}
                onBingSiteUrlChange={setBingSiteUrl}
                onBingCollectStart={() => setBingCollecting(true)}
                onBingCollectMsg={setBingCollectMsg}
                onBingCollectEnd={() => setBingCollecting(false)}
                onRefresh={forceRefresh}
                onReconnect={onReconnect}
              />
            </Grid>
          ))}
      </Grid>

      {/* Background Job Manager - render only when explicitly enabled */}
      {showBackgroundJobs && !isPriorityPlatformDisconnected && (
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
