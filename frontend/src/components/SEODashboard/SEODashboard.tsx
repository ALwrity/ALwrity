import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Box,
  Container,
  Grid,
  Typography,
  Alert,
  Skeleton,
  Chip,
  Button,
  IconButton,
  Tooltip,
  Menu,
  MenuItem,
  Divider,
  Avatar,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  CircularProgress,
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth, useUser, SignOutButton, useClerk } from '@clerk/clerk-react';
import { apiClient } from '../../api/client';
import {
  Refresh as RefreshIcon,
  Person as PersonIcon,
  ExitToApp as ExitIcon,
  ArrowBack as ArrowBackIcon,
  MoreVert as MoreVertIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  Info as InfoIcon,
  ExpandMore as ExpandMoreIcon,
  AutoAwesome as AIIcon,
  Tab as TabIcon,
} from '@mui/icons-material';
import { Tabs, Tab as MuiTab } from '@mui/material';

// Shared components
import { DashboardContainer, GlassCard } from '../shared/styled';
import SEOAnalyzerPanel from './components/SEOAnalyzerPanel';
import { SEOCopilotSuggestions } from './index';
import SEOCopilot from './SEOCopilot';
// Removed SEOCopilotTest
import useSEOCopilotStore from '../../stores/seoCopilotStore';

// Zustand store
import { useSEODashboardStore } from '../../stores/seoDashboardStore';

// API
import { userDataAPI } from '../../api/userData';
import { OnboardingScheduledTaskHealthResponse, OnboardingTaskStatus } from '../../api/seoDashboard';

// Shared components
import PlatformAnalytics from '../shared/PlatformAnalytics';
import { cachedAnalyticsAPI } from '../../api/cachedAnalytics';

// OAuth hooks
import { useBingOAuth } from '../../hooks/useBingOAuth';
import { useGSCConnection } from '../OnboardingWizard/common/useGSCConnection';

// SEO Dashboard component
import { SitemapBenchmarkResults } from '../OnboardingWizard/CompetitorAnalysisStep/SitemapBenchmarkResults';
import { StrategicInsightsResults } from '../OnboardingWizard/CompetitorAnalysisStep/StrategicInsightsResults';
import { AdvertoolsInsights } from './components/AdvertoolsInsights';

// Phase 2B: Semantic Dashboard components
import SemanticHealthCard from './components/SemanticHealthCard';
import SemanticInsights from './components/SemanticInsights';
import KeywordGapAnalysis from './components/KeywordGapAnalysis';
import ContentGapRadarCard from './components/ContentGapRadarCard';

// Phase 2A: Enterprise SEO Analysis
import SEOAnalysisController from './SEOAnalysisController';

const SEODashboard: React.FC = () => {
  // Clerk authentication hooks
  const { isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();
  const { openSignIn } = useClerk();
  
  // Zustand store hooks
  const {
    loading,
    error,
    data,
    analysisData,
    analysisLoading,
    analysisError,
    setData,
    setLoading,
    runSEOAnalysis,
    refreshSEOAnalysis,
    getAnalysisFreshness,
  } = useSEODashboardStore();

  // OAuth hooks
  const { connect: connectBing } = useBingOAuth();
  const { handleGSCConnect } = useGSCConnection();

  // Platform status state
  const [platformStatus, setPlatformStatus] = useState({
    gsc: { connected: false, sites: [], last_sync: null, status: 'disconnected' },
    bing: { 
      connected: false, 
      sites: [], 
      last_sync: null, 
      status: 'disconnected',
      has_expired_tokens: false,
      last_token_date: undefined,
      total_tokens: 0
    }
  });

  // Menu state
  const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null);
  const [statusMenuAnchor, setStatusMenuAnchor] = useState<null | HTMLElement>(null);
  
  // Dashboard Tab State for Enterprise Analysis
  const [dashboardTab, setDashboardTab] = useState<number>(0);
  const location = useLocation();

  // Hash-based deep-link scroll (e.g. #content-gap-radar from workflow tasks)
  useEffect(() => {
    if (location.hash) {
      const id = location.hash.replace('#', '');
      const el = document.getElementById(id);
      if (el) {
        setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
      }
    }
  }, [location.hash]);

  // Competitor analysis data from onboarding step 3
  const [competitorAnalysisData, setCompetitorAnalysisData] = useState<any>(null);
  const [deepCompetitorAnalysisData, setDeepCompetitorAnalysisData] = useState<any>(null);
  const [strategicInsightsHistory, setStrategicInsightsHistory] = useState<any[]>([]);
  const [strategicInsightsLoading, setStrategicInsightsLoading] = useState(false);
  const [competitiveSitemapBenchmarkingReport, setCompetitiveSitemapBenchmarkingReport] = useState<any>(null);
  const [competitiveSitemapBenchmarkingLoading, setCompetitiveSitemapBenchmarkingLoading] = useState(false);
  const [competitiveSitemapBenchmarkingError, setCompetitiveSitemapBenchmarkingError] = useState<string | null>(null);
  const [onboardingTaskHealth, setOnboardingTaskHealth] = useState<OnboardingScheduledTaskHealthResponse | null>(null);

  // PlatformAnalytics refresh handle
  const platformRefreshRef = useRef<(() => Promise<void>) | null>(null);
  const analyticsPlatforms = useMemo(() => ['gsc', 'bing'], []);

  // Sync dashboard analysis to Copilot store so readables have URL/context
  const setCopilotAnalysisData = useSEOCopilotStore(state => state.setAnalysisData);
  useEffect(() => {
    if (analysisData) {
      setCopilotAnalysisData(analysisData as any);
      if (process.env.NODE_ENV === 'development') {
        console.log('[CopilotSync] Pushed analysis to Copilot store', analysisData?.url);
      }
    }
  }, [analysisData, setCopilotAnalysisData]);

  // Load competitor analysis data on component mount
  useEffect(() => {
    loadCompetitorAnalysisData();
    fetchStrategicInsightsHistory();
  }, []);


  const fetchStrategicInsightsHistory = async () => {
    setStrategicInsightsLoading(true);
    try {
      const res = await apiClient.get('/api/seo-dashboard/strategic-insights/history');
      if (res.data?.history?.length > 0) {
        setStrategicInsightsHistory(res.data.history);
      }
    } catch (e) {
      console.error("Failed to fetch strategic insights history", e);
    } finally {
      setStrategicInsightsLoading(false);
    }
  };

  // Reconnect handlers using existing OAuth hooks
  const handleGSCReconnect = async () => {
    try {
      console.log('Initiating GSC reconnect...');
      await handleGSCConnect();
    } catch (error) {
      console.error('Error reconnecting GSC:', error);
    }
  };

  const handleBingReconnect = async () => {
    try {
      console.log('Initiating Bing reconnect...');
      // Purge expired tokens before reconnecting to avoid refresh loops
      try {
        await apiClient.post('/bing/purge-expired');
        console.log('Purged expired Bing tokens before reconnect');
      } catch (purgeError) {
        console.warn('Failed to purge expired tokens (non-critical):', purgeError);
      }
      await connectBing();
      // After successful reconnect, refresh platform status and run analysis
      try {
        // Invalidate backend analytics cache for Bing
        try {
          await apiClient.post('/api/analytics/cache/clear', null, { params: { platform: 'bing' } });
          console.log('Cleared backend analytics cache for Bing');
        } catch (cacheErr) {
          console.warn('Failed to clear backend analytics cache (non-critical):', cacheErr);
        }

        // Invalidate frontend cached analytics
        try {
          cachedAnalyticsAPI.invalidatePlatformStatus();
          // Optional: clear all analytics cache if available
          // @ts-ignore - method may not exist in older builds
          cachedAnalyticsAPI.clearCache?.();
          console.log('Cleared frontend analytics cache');
        } catch (feCacheErr) {
          console.warn('Failed to clear frontend analytics cache (non-critical):', feCacheErr);
        }

        await fetchPlatformStatus();
      } catch (e) {
        console.warn('Post-reconnect platform status refresh failed:', e);
      }
      try {
        await useSEODashboardStore.getState().refreshSEOAnalysis();
      } catch (e) {
        console.warn('Post-reconnect analysis refresh failed:', e);
      }

      // Force PlatformAnalytics to refresh (bypass cache)
      try {
        await platformRefreshRef.current?.();
      } catch (e) {
        console.warn('Platform analytics forced refresh failed (non-critical):', e);
      }
    } catch (error) {
      console.error('Error reconnecting Bing:', error);
    }
  };

  // One-run guard to avoid duplicate fetches under StrictMode
  const dataFetchedRef = useRef(false);

  // Consolidated data fetching effect
  useEffect(() => {
    if (dataFetchedRef.current || !isSignedIn) return;
    dataFetchedRef.current = true;

    const fetchAllData = async () => {
      let websiteUrl = 'https://alwrity.com'; // Default fallback
      
      try {
        setLoading(true);
        
        // Fetch platform status and user data in parallel
        const [platformResponse, userData, onboardingTaskHealthResponse] = await Promise.all([
          apiClient.get('/api/seo-dashboard/platforms'),
          userDataAPI.getUserData(),
          apiClient.get('/api/seo-dashboard/onboarding-task-health')
        ]);
        
        console.log('Platform status response:', platformResponse.status, platformResponse.statusText);
        console.log('Platform status data:', platformResponse.data);
        setPlatformStatus(platformResponse.data);
        setOnboardingTaskHealth(onboardingTaskHealthResponse.data);
        
        websiteUrl = userData?.website_url || 'https://alwrity.com';
        
        // Fetch real data from backend using authenticated API client
        console.log('Fetching SEO dashboard overview...');
        const response = await apiClient.get('/api/seo-dashboard/overview', {
          params: { site_url: websiteUrl }
        });
        
        console.log('SEO overview response:', response.status, response.statusText);
        console.log('Real SEO data received:', response.data);
        setData(response.data);

        try {
          const deepResponse = await apiClient.get('/api/seo-dashboard/deep-competitor-analysis', {
            params: { site_url: websiteUrl }
          });
          setDeepCompetitorAnalysisData(deepResponse.data);
        } catch (e) {
          console.warn('Deep competitor analysis not available yet:', e);
          setDeepCompetitorAnalysisData(null);
        }

        try {
          const sitemapBenchResponse = await apiClient.get('/api/seo/competitive-sitemap-benchmarking');
          const report = sitemapBenchResponse?.data?.data?.report ?? null;
          setCompetitiveSitemapBenchmarkingReport(report);
        } catch (e) {
          console.warn('Competitive sitemap benchmarking not available yet:', e);
          setCompetitiveSitemapBenchmarkingReport(null);
        }

        try {
          setStrategicInsightsLoading(true);
          const strategicHistoryRes = await apiClient.get('/api/seo-dashboard/strategic-insights/history');
          setStrategicInsightsHistory(strategicHistoryRes.data?.history || []);
        } catch (e) {
          console.warn('Strategic insights history not available yet:', e);
        } finally {
          setStrategicInsightsLoading(false);
        }
      } catch (error) {
        console.error('Error fetching SEO dashboard data:', error);
        // Fallback to mock data on error
        const mockData = {
          health_score: {
            score: 84,
            change: 5,
            trend: 'up',
            label: 'EXCELLENT',
            color: '#4CAF50'
          },
          key_insight: 'Your website has excellent technical SEO foundation with room for improvement',
          priority_alert: 'Mobile page speed could be optimized further',
          metrics: {
            traffic: { value: 12500, change: 15, trend: 'up', description: 'Organic traffic', color: '#4CAF50' },
            rankings: { value: 8.5, change: 2.3, trend: 'up', description: 'Average ranking', color: '#2196F3' },
            mobile: { value: 92, change: -3, trend: 'down', description: 'Mobile speed', color: '#FF9800' },
            keywords: { value: 150, change: 12, trend: 'up', description: 'Keywords tracked', color: '#9C27B0' }
          },
          platforms: {
            google: { status: 'connected', connected: true, last_sync: '2024-01-15T10:30:00Z', data_points: 1250 },
            bing: { status: 'connected', connected: true, last_sync: '2024-01-15T09:45:00Z', data_points: 850 },
            yandex: { status: 'disconnected', connected: false }
          },
          ai_insights: [
            {
              insight: 'Your website has excellent technical SEO foundation',
              priority: 'low',
              category: 'technical',
              action_required: false
            },
            {
              insight: 'Consider adding more internal links to improve page authority',
              priority: 'medium',
              category: 'content',
              action_required: false
            },
            {
              insight: 'Mobile page speed could be optimized further',
              priority: 'high',
              category: 'performance',
              action_required: true,
              tool_path: '/seo-dashboard'
            }
          ],
          last_updated: new Date().toISOString(),
          website_url: websiteUrl || undefined // Convert null to undefined for TypeScript
        };
        setData(mockData);
        setDeepCompetitorAnalysisData(null);
        setCompetitiveSitemapBenchmarkingReport(null);
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, [isSignedIn, setLoading, setData]);

  useEffect(() => {
    // Run initial SEO analysis if no data exists
    if (!loading && !error && data) {
      // Check if we have cached analysis data first
      const store = useSEODashboardStore.getState();
      store.checkAndRunInitialAnalysis();
      
      // If no cached analysis data and we have a website URL, run initial analysis
      if (!store.analysisData && data.website_url) {
        console.log('No cached analysis data found, running initial SEO analysis...');
        store.runSEOAnalysis();
      }
    }
  }, [loading, error, data]);

  // Menu handlers
  const handleUserMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setUserMenuAnchor(event.currentTarget);
  };

  const handleUserMenuClose = () => {
    setUserMenuAnchor(null);
  };

  const handleStatusMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setStatusMenuAnchor(event.currentTarget);
  };

  const handleStatusMenuClose = () => {
    setStatusMenuAnchor(null);
  };

  const handleBackToDashboard = () => {
    window.location.href = '/seo-dashboard';
  };

  const handleRefreshData = async () => {
    try {
      setLoading(true);
      await refreshSEOAnalysis();
      await fetchPlatformStatus();
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setLoading(false);
    }
  };

  const runStrategicInsights = async () => {
    setStrategicInsightsLoading(true);
    try {
      const res = await apiClient.post('/api/seo-dashboard/strategic-insights/run');
      if (res.data?.success) {
        setStrategicInsightsHistory(prev => [res.data.report, ...prev]);
      }
    } catch (e: any) {
      console.error('Failed to run strategic insights:', e);
    } finally {
      setStrategicInsightsLoading(false);
    }
  };

  // Background jobs visibility (user-triggered)
  const [showBackgroundJobs, setShowBackgroundJobs] = useState(false);

  // Platform status fetching function
  const fetchPlatformStatus = async () => {
    try {
      console.log('Fetching platform status...');
      const response = await apiClient.get('/api/seo-dashboard/platforms');
      console.log('Platform status response:', response.status, response.statusText);
      console.log('Platform status data:', response.data);
      setPlatformStatus(response.data);
    } catch (error) {
      console.error('Error fetching platform status:', error);
    }
  };

  // Load competitor analysis data from onboarding step 3
  const loadCompetitorAnalysisData = () => {
    try {
      const cachedData = localStorage.getItem('competitor_analysis_data');
      const cachedUrl = localStorage.getItem('competitor_analysis_url');
      const cachedTimestamp = localStorage.getItem('competitor_analysis_timestamp');
      
      if (cachedData && cachedUrl && cachedTimestamp) {
        const analysisData = JSON.parse(cachedData);
        const timestamp = parseInt(cachedTimestamp);
        const isRecent = (Date.now() - timestamp) < (7 * 24 * 60 * 60 * 1000); // 7 days
        
        if (isRecent) {
          console.log('Loading competitor analysis data from onboarding step 3:', analysisData);
          setCompetitorAnalysisData(analysisData);
        } else {
          console.log('Competitor analysis data is too old, not loading');
        }
      } else {
        console.log('No competitor analysis data found in localStorage');
      }
    } catch (error) {
      console.error('Error loading competitor analysis data:', error);
    }
  };

  const runCompetitiveSitemapBenchmarking = async () => {
    setCompetitiveSitemapBenchmarkingError(null);
    setCompetitiveSitemapBenchmarkingLoading(true);
    try {
      await apiClient.post('/api/seo/competitive-sitemap-benchmarking/run', { max_competitors: null });
      const sitemapBenchResponse = await apiClient.get('/api/seo/competitive-sitemap-benchmarking');
      const report = sitemapBenchResponse?.data?.data?.report ?? null;
      setCompetitiveSitemapBenchmarkingReport(report);
    } catch (e: any) {
      setCompetitiveSitemapBenchmarkingError(e?.response?.data?.detail || e?.message || 'Failed to run benchmark');
    } finally {
      setCompetitiveSitemapBenchmarkingLoading(false);
    }
  };


  if (loading) {
    return <Skeleton variant="rectangular" height={200} />;
  }

  if (error || !data) {
    return <Alert severity="error">Failed to load dashboard data</Alert>;
  }

  // Show sign-in prompt if not authenticated


  const statusUiMap: Record<OnboardingTaskStatus, { label: string; color: string; bg: string; border: string; action: string }> = {
    active: { label: 'Active', color: '#22c55e', bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.4)', action: 'No action needed. Monitor next execution to confirm regular runs.' },
    failed: { label: 'Failed', color: '#ef4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.4)', action: 'Review the latest error and rerun after fixing data/source issues.' },
    paused: { label: 'Paused', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.4)', action: 'Resume this task from scheduler controls when ready.' },
    needs_intervention: { label: 'Needs intervention', color: '#f97316', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.4)', action: 'Immediate action required. Inspect failures and reconfigure before retrying.' },
    not_scheduled: { label: 'Not scheduled', color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.4)', action: 'Complete onboarding scheduling or create the task in scheduler.' }
  };

  const orderedTaskKeys = [
    'OnboardingFullWebsiteAnalysisTask',
    'DeepCompetitorAnalysisTask',
    'SIFIndexingTask',
    'MarketTrendsTask'
  ];

  if (!isLoaded) {
    return <Skeleton variant="rectangular" height={200} />;
  }

  if (!isSignedIn) {
    return (
      <DashboardContainer>
        <Container maxWidth="md">
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center', 
            minHeight: '60vh',
            textAlign: 'center',
            gap: 3
          }}>
            <Typography variant="h4" sx={{ color: 'white', fontWeight: 700 }}>
              🔍 SEO Dashboard
            </Typography>
            <Typography variant="h6" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
              Sign in to access your SEO analytics and Google Search Console data
            </Typography>
            <Button 
                onClick={() => openSignIn({ forceRedirectUrl: '/seo-dashboard' })}
                variant="contained" 
                size="large"
                sx={{ 
                  bgcolor: '#4285f4',
                  '&:hover': { bgcolor: '#3367d6' },
                  px: 4,
                  py: 1.5,
                  fontSize: '1.1rem',
                  fontWeight: 600
                }}
              >
                Sign In to Continue
              </Button>
          </Box>
        </Container>
      </DashboardContainer>
    );
  }

  return (
    <DashboardContainer>
      <Container maxWidth="xl">
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            {/* Professional Compact Header */}
              <Box sx={{ 
                mb: 4, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                py: 2,
                px: 3,
                bgcolor: 'rgba(255, 255, 255, 0.05)',
                borderRadius: 2,
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}>
                {/* Left Section - Navigation & Title */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <IconButton
                    onClick={handleBackToDashboard}
                    sx={{ 
                      color: 'white',
                      '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.1)' }
                    }}
                  >
                    <ArrowBackIcon />
                  </IconButton>
                  
                  <Box>
                    <Typography variant="h5" sx={{ color: 'white', fontWeight: 700, lineHeight: 1.2 }}>
                      SEO Dashboard
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                      AI-powered insights and recommendations
                    </Typography>
                  </Box>
                </Box>

                {/* Center Section - Status Overview */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Tooltip title="Platform Connection Status">
                    <IconButton
                      onClick={handleStatusMenuOpen}
                      sx={{ 
                        color: 'white',
                        '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.1)' }
                      }}
                    >
                      <CheckCircleIcon sx={{ 
                        color: platformStatus.gsc.connected && platformStatus.bing.connected 
                          ? '#4CAF50' 
                          : platformStatus.gsc.connected || platformStatus.bing.connected 
                            ? '#FF9800' 
                            : '#f44336' 
                      }} />
                    </IconButton>
                  </Tooltip>
                  
                  <Tooltip title="Data Freshness">
                    <Chip
                      icon={<ScheduleIcon />}
                      label={(() => {
                        const freshness = getAnalysisFreshness();
                        return freshness.label;
                      })()}
                      size="small"
                      sx={{
                        bgcolor: 'rgba(255, 255, 255, 0.1)',
                        color: 'white',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        fontSize: '0.75rem'
                      }}
                    />
                  </Tooltip>
                  {onboardingTaskHealth && (
                    <Tooltip title="Onboarding Scheduled SEO Tasks">
                      <Chip
                        label={`Onboarding Tasks: ${Object.values(onboardingTaskHealth.tasks || {}).filter((task: any) => task?.status === 'active').length} active`}
                        size="small"
                        sx={{
                          ml: 2,
                          bgcolor: 'rgba(255, 255, 255, 0.1)',
                          color: 'white',
                          border: '1px solid rgba(255, 255, 255, 0.2)'
                        }}
                      />
                    </Tooltip>
                  )}
                </Box>

                {/* Right Section - User Menu */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Avatar sx={{ width: 32, height: 32, bgcolor: 'rgba(33, 150, 243, 0.8)' }}>
                    <PersonIcon fontSize="small" />
                  </Avatar>
                  
                  <IconButton
                    onClick={handleUserMenuOpen}
                    sx={{ 
                      color: 'white',
                      '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.1)' }
                    }}
                  >
                    <MoreVertIcon />
                  </IconButton>
                </Box>

          {/* Status Menu */}
          <Menu
            anchorEl={statusMenuAnchor}
            open={Boolean(statusMenuAnchor)}
            onClose={handleStatusMenuClose}
            PaperProps={{
              sx: {
                bgcolor: 'rgba(30, 30, 30, 0.95)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: 'white',
                minWidth: 280
              }
            }}
          >
            <MenuItem disabled>
              <Typography variant="subtitle2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                Platform Status
              </Typography>
            </MenuItem>
            
            {/* GSC Status */}
            <MenuItem>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CheckCircleIcon sx={{ 
                    color: platformStatus.gsc.connected ? '#4CAF50' : '#f44336',
                    fontSize: 16
                  }} />
                  <Typography variant="body2">
                    Google Search Console: {platformStatus.gsc.connected ? 'Connected' : 'Disconnected'}
                  </Typography>
                </Box>
                {!platformStatus.gsc.connected && (
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={handleGSCReconnect}
                    sx={{
                      ml: 2,
                      borderColor: 'rgba(255, 255, 255, 0.3)',
                      color: 'white',
                      fontSize: '0.75rem',
                      '&:hover': {
                        borderColor: 'rgba(255, 255, 255, 0.5)',
                        bgcolor: 'rgba(255, 255, 255, 0.1)'
                      }
                    }}
                  >
                    Reconnect
                  </Button>
                )}
              </Box>
            </MenuItem>
            
            {/* Bing Status */}
            <MenuItem>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CheckCircleIcon sx={{ 
                    color: platformStatus.bing.connected ? '#4CAF50' : 
                           platformStatus.bing.status === 'expired' ? '#FF9800' : '#f44336',
                    fontSize: 16
                  }} />
                  <Box>
                    <Typography variant="body2">
                      Bing Webmaster: {platformStatus.bing.connected ? 'Connected' : 
                                     platformStatus.bing.status === 'expired' ? 'Expired' : 'Disconnected'}
                    </Typography>
                    {platformStatus.bing.status === 'expired' && platformStatus.bing.last_token_date && (
                      <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.7rem' }}>
                        Last connected: {new Date(platformStatus.bing.last_token_date).toLocaleDateString()}
                      </Typography>
                    )}
                  </Box>
                </Box>
                {!platformStatus.bing.connected && (
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={handleBingReconnect}
                    sx={{
                      ml: 2,
                      borderColor: platformStatus.bing.status === 'expired' ? '#FF9800' : 'rgba(255, 255, 255, 0.3)',
                      color: platformStatus.bing.status === 'expired' ? '#FF9800' : 'white',
                      fontSize: '0.75rem',
                      '&:hover': {
                        borderColor: platformStatus.bing.status === 'expired' ? '#FFB74D' : 'rgba(255, 255, 255, 0.5)',
                        bgcolor: platformStatus.bing.status === 'expired' ? 'rgba(255, 152, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)'
                      }
                    }}
                  >
                    {platformStatus.bing.status === 'expired' ? 'Reconnect' : 'Connect'}
                  </Button>
                )}
              </Box>
            </MenuItem>
          </Menu>

                {/* User Menu */}
                <Menu
                  anchorEl={userMenuAnchor}
                  open={Boolean(userMenuAnchor)}
                  onClose={handleUserMenuClose}
                  PaperProps={{
                    sx: {
                      bgcolor: 'rgba(30, 30, 30, 0.95)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: 'white'
                    }
                  }}
                >
                  <MenuItem disabled>
                    <Typography variant="subtitle2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                      {user?.primaryEmailAddress?.emailAddress || 'User'}
                    </Typography>
                  </MenuItem>
                  <Divider sx={{ bgcolor: 'rgba(255, 255, 255, 0.1)' }} />
                  <MenuItem onClick={handleRefreshData}>
                    <RefreshIcon sx={{ mr: 1, fontSize: 16 }} />
                    <Typography variant="body2">Refresh Data</Typography>
                  </MenuItem>
                  <Divider sx={{ bgcolor: 'rgba(255, 255, 255, 0.1)' }} />
                  <SignOutButton>
                    <MenuItem>
                      <ExitIcon sx={{ mr: 1, fontSize: 16 }} />
                      <Typography variant="body2">Sign Out</Typography>
                    </MenuItem>
                  </SignOutButton>
                </Menu>
              </Box>


              {/* CopilotKit Test Panel removed */}

              {/* Dashboard Tabs */}
              <Box sx={{ mb: 4, display: 'flex', gap: 1, borderBottom: '1px solid rgba(255, 255, 255, 0.1)', pb: 1 }}>
                <Button
                  variant={dashboardTab === 0 ? 'contained' : 'text'}
                  onClick={() => setDashboardTab(0)}
                  sx={{
                    color: dashboardTab === 0 ? 'white' : 'rgba(255, 255, 255, 0.7)',
                    bgcolor: dashboardTab === 0 ? 'rgba(33, 150, 243, 0.3)' : 'transparent',
                    borderBottom: dashboardTab === 0 ? '2px solid #2196F3' : 'none',
                    borderRadius: 0,
                    '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.05)' }
                  }}
                >
                  📊 Overview
                </Button>
                <Button
                  variant={dashboardTab === 1 ? 'contained' : 'text'}
                  onClick={() => setDashboardTab(1)}
                  sx={{
                    color: dashboardTab === 1 ? 'white' : 'rgba(255, 255, 255, 0.7)',
                    bgcolor: dashboardTab === 1 ? 'rgba(33, 150, 243, 0.3)' : 'transparent',
                    borderBottom: dashboardTab === 1 ? '2px solid #2196F3' : 'none',
                    borderRadius: 0,
                    '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.05)' }
                  }}
                >
                  🔍 Enterprise Analysis
                </Button>
              </Box>

              {/* Tab Content: Overview */}
              {dashboardTab === 0 && (
              <>

              {/* Search Performance Overview */}
              <Box sx={{ mb: 4 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                  <Typography variant="h6" sx={{ color: 'white', fontWeight: 600 }}>
                    📊 Search Performance Overview
                  </Typography>
                  <Tooltip title="Real-time analytics data from connected search platforms">
                    <InfoIcon sx={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: 18 }} />
                  </Tooltip>
                  <Box sx={{ flexGrow: 1 }} />
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => setShowBackgroundJobs((v) => !v)}
                    sx={{ textTransform: 'none' }}
                  >
                    {showBackgroundJobs ? 'Hide Background Jobs' : 'Run Background Jobs'}
                  </Button>
                </Box>
                
                <PlatformAnalytics
                  platforms={analyticsPlatforms}
                  showSummary={true}
                  refreshInterval={0}
                  onDataLoaded={() => {}}
                  onRefreshReady={(fn) => { platformRefreshRef.current = fn; }}
                  onReconnect={(platform) => {
                    if (platform === 'gsc') {
                      handleGSCReconnect();
                    } else if (platform === 'bing') {
                      handleBingReconnect();
                    }
                  }}
                  showBackgroundJobs={showBackgroundJobs}
                />
                
                {/* Enhanced Metrics with Tooltips */}
                <Box sx={{ mt: 3 }}>
                  <Grid container spacing={2}>
                    <Grid item xs={6} sm={3}>
                      <Tooltip title="Number of search engine platforms (GSC, Bing) currently connected to your dashboard">
                        <GlassCard sx={{ p: 2, cursor: 'help' }}>
                          <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 1 }}>
                            Connected Platforms
                          </Typography>
                          <Typography variant="h4" sx={{ color: '#4CAF50', fontWeight: 700 }}>
                            {(platformStatus.gsc.connected ? 1 : 0) + (platformStatus.bing.connected ? 1 : 0)}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                            of 2 platforms
                          </Typography>
                        </GlassCard>
                      </Tooltip>
                    </Grid>
                    
                    <Grid item xs={6} sm={3}>
                      <Tooltip title="Total number of clicks from search results to your website within the selected time period">
                        <GlassCard sx={{ p: 2, cursor: 'help' }}>
                          <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 1 }}>
                            Total Clicks
                          </Typography>
                          <Typography variant="h4" sx={{ color: '#2196F3', fontWeight: 700 }}>
                            {data.metrics?.traffic?.value || data.summary?.clicks || 0}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                            from search results
                          </Typography>
                        </GlassCard>
                      </Tooltip>
                    </Grid>
                    
                    <Grid item xs={6} sm={3}>
                      <Tooltip title="Total number of times your website appeared in search results within the selected time period">
                        <GlassCard sx={{ p: 2, cursor: 'help' }}>
                          <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 1 }}>
                            Total Impressions
                          </Typography>
                          <Typography variant="h4" sx={{ color: '#FF9800', fontWeight: 700 }}>
                            {data.metrics?.impressions?.value || data.summary?.impressions || 0}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                            search appearances
                          </Typography>
                        </GlassCard>
                      </Tooltip>
                    </Grid>
                    
                    <Grid item xs={6} sm={3}>
                      <Tooltip title="Percentage of impressions that resulted in a click to your website (Clicks ÷ Impressions × 100)">
                        <GlassCard sx={{ p: 2, cursor: 'help' }}>
                          <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 1 }}>
                            Overall CTR
                          </Typography>
                          <Typography variant="h4" sx={{ color: '#9C27B0', fontWeight: 700 }}>
                            {data.metrics?.ctr?.value || data.summary?.ctr || 0}%
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                            click-through rate
                          </Typography>
                        </GlassCard>
                      </Tooltip>
                    </Grid>
                  </Grid>
                </Box>
              </Box>

              {/* Keyword Gap Analysis */}
              <KeywordGapAnalysis />

              {/* Content Gap Radar */}
              <Box id="content-gap-radar">
                <ContentGapRadarCard />
              </Box>

              {/* Full Site Technical SEO Audit (from onboarding background job) */}
              {data.technical_seo_audit && (
                <Box sx={{ mb: 4 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                    <Typography variant="h6" sx={{ color: 'white', fontWeight: 600 }}>
                      🧩 Technical SEO Audit
                    </Typography>
                    <Tooltip title="Full-site audit runs automatically after onboarding. Low-scoring pages are marked as Fix Scheduled.">
                      <InfoIcon sx={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: 18 }} />
                    </Tooltip>
                    <Box sx={{ flexGrow: 1 }} />
                    {data.technical_seo_audit.status === 'scheduled' && (
                      <Chip
                        icon={<ScheduleIcon />}
                        label={`Scheduled${data.technical_seo_audit.next_execution ? ` • ${new Date(data.technical_seo_audit.next_execution).toLocaleString()}` : ''}`}
                        sx={{ bgcolor: 'rgba(255, 193, 7, 0.15)', color: '#FFC107' }}
                      />
                    )}
                    {data.technical_seo_audit.status === 'ready' && (
                      <Chip
                        icon={<CheckCircleIcon />}
                        label="Results Available"
                        sx={{ bgcolor: 'rgba(76, 175, 80, 0.15)', color: '#4CAF50' }}
                      />
                    )}
                    {data.technical_seo_audit.status === 'error' && (
                      <Chip
                        label="Audit Error"
                        sx={{ bgcolor: 'rgba(244, 67, 54, 0.15)', color: '#F44336' }}
                      />
                    )}
                  </Box>

                  {data.technical_seo_audit.status === 'scheduled' && (
                    <Alert severity="info" sx={{ mb: 2 }}>
                      Full-site audit runs automatically after onboarding. This may take a few minutes depending on how many pages we discover.
                    </Alert>
                  )}

                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={4}>
                      <GlassCard sx={{ p: 2 }}>
                        <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 1 }}>
                          Pages Audited
                        </Typography>
                        <Typography variant="h4" sx={{ color: 'white', fontWeight: 700 }}>
                          {data.technical_seo_audit.pages_audited}
                        </Typography>
                      </GlassCard>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <GlassCard sx={{ p: 2 }}>
                        <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 1 }}>
                          Average Score
                        </Typography>
                        <Typography variant="h4" sx={{ color: '#2196F3', fontWeight: 700 }}>
                          {data.technical_seo_audit.avg_score}/100
                        </Typography>
                      </GlassCard>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <GlassCard sx={{ p: 2 }}>
                        <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 1 }}>
                          Fix Scheduled
                        </Typography>
                        <Typography variant="h4" sx={{ color: '#FF9800', fontWeight: 700 }}>
                          {data.technical_seo_audit.fix_scheduled_pages}
                        </Typography>
                      </GlassCard>
                    </Grid>
                  </Grid>

                  {data.technical_seo_audit.worst_pages?.length > 0 && (
                    <Box sx={{ mt: 2 }}>
                      <GlassCard sx={{ p: 2 }}>
                        <Typography variant="subtitle2" sx={{ color: 'white', fontWeight: 600, mb: 1 }}>
                          Lowest Scoring Pages
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          {data.technical_seo_audit.worst_pages.slice(0, 5).map((p) => (
                            <Box
                              key={p.page_url}
                              sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}
                            >
                              <Typography
                                variant="body2"
                                sx={{ color: 'rgba(255, 255, 255, 0.85)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                title={p.page_url}
                              >
                                {p.page_url}
                              </Typography>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Chip
                                  size="small"
                                  label={`${p.overall_score}/100`}
                                  sx={{ bgcolor: 'rgba(33, 150, 243, 0.15)', color: '#90CAF9' }}
                                />
                                <Chip
                                  size="small"
                                  label={p.status === 'fix_scheduled' ? 'Fix Scheduled' : p.status}
                                  sx={{ bgcolor: 'rgba(255, 152, 0, 0.15)', color: '#FFB74D' }}
                                />
                              </Box>
                            </Box>
                          ))}
                        </Box>
                      </GlassCard>
                    </Box>
                  )}
                </Box>
              )}

              {/* Data-Driven Content Intelligence (Advertools) */}
              {data.advertools_insights && (
                <AdvertoolsInsights data={data.advertools_insights} />
              )}

              {/* Competitive Analysis from Onboarding Step 3 */}
              {competitorAnalysisData && (
                <Box sx={{ mb: 4 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                    <Typography variant="h6" sx={{ color: 'white', fontWeight: 600 }}>
                      🎯 Competitive Analysis
                    </Typography>
                    <Tooltip title="Real competitor analysis data from onboarding step 3">
                      <InfoIcon sx={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: 18 }} />
                    </Tooltip>
                  </Box>
                  
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={4}>
                      <Tooltip title="Number of competitors discovered during onboarding analysis">
                        <GlassCard sx={{ p: 2, cursor: 'help' }}>
                          <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 1 }}>
                            Competitors Found
                          </Typography>
                          <Typography variant="h4" sx={{ color: '#4CAF50', fontWeight: 700 }}>
                            {competitorAnalysisData.competitors?.length || 0}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                            in your market
                          </Typography>
                        </GlassCard>
                      </Tooltip>
                    </Grid>
                    
                    <Grid item xs={12} md={4}>
                      <Tooltip title="Social media accounts discovered for competitors">
                        <GlassCard sx={{ p: 2, cursor: 'help' }}>
                          <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 1 }}>
                            Social Media Accounts
                          </Typography>
                          <Typography variant="h4" sx={{ color: '#2196F3', fontWeight: 700 }}>
                            {Object.keys(competitorAnalysisData.social_media_accounts || {}).length}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                            competitor accounts
                          </Typography>
                        </GlassCard>
                      </Tooltip>
                    </Grid>
                    
                    <Grid item xs={12} md={4}>
                      <Tooltip title="Social media citations and mentions found">
                        <GlassCard sx={{ p: 2, cursor: 'help' }}>
                          <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 1 }}>
                            Social Citations
                          </Typography>
                          <Typography variant="h4" sx={{ color: '#FF9800', fontWeight: 700 }}>
                            {competitorAnalysisData.social_media_citations?.length || 0}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                            mentions found
                          </Typography>
                        </GlassCard>
                      </Tooltip>
                    </Grid>
                  </Grid>

                  {/* Competitor List */}
                  {competitorAnalysisData.competitors && competitorAnalysisData.competitors.length > 0 && (
                    <Box sx={{ mt: 3 }}>
                      <Typography variant="h6" sx={{ color: 'white', fontWeight: 600, mb: 2 }}>
                        Top Competitors
                      </Typography>
                      <Grid container spacing={2}>
                        {competitorAnalysisData.competitors.slice(0, 6).map((competitor: any, index: number) => (
                          <Grid item xs={12} sm={6} md={4} key={index}>
                            <GlassCard sx={{ p: 2 }}>
                              <Typography variant="subtitle2" sx={{ color: 'white', fontWeight: 600, mb: 1 }}>
                                {competitor.name || competitor.domain || `Competitor ${index + 1}`}
                              </Typography>
                              <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 1 }}>
                                {competitor.domain || competitor.url || 'No domain available'}
                              </Typography>
                              {competitor.description && (
                                <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                                  {competitor.description.length > 100 
                                    ? `${competitor.description.substring(0, 100)}...` 
                                    : competitor.description}
                                </Typography>
                              )}
                            </GlassCard>
                          </Grid>
                        ))}
                      </Grid>
                    </Box>
                  )}

                  {/* Research Summary */}
                  {competitorAnalysisData.research_summary && (
                    <Box sx={{ mt: 3 }}>
                      <Typography variant="h6" sx={{ color: 'white', fontWeight: 600, mb: 2 }}>
                        Research Summary
                      </Typography>
                      <GlassCard sx={{ p: 3 }}>
                        <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.9)', lineHeight: 1.6 }}>
                          {competitorAnalysisData.research_summary}
                        </Typography>
                      </GlassCard>
                    </Box>
                  )}
                </Box>
              )}

              {/* Strategic Insights (Winning Moves) */}
              {strategicInsightsHistory.length > 0 && (
                <Box sx={{ mb: 4 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                    <Typography variant="h6" sx={{ color: 'white', fontWeight: 600 }}>
                      🏆 Strategic Insights (Winning Moves)
                    </Typography>
                    <Tooltip title="AI-generated weekly strategic briefs to outperform competitors.">
                      <InfoIcon sx={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: 18 }} />
                    </Tooltip>
                    <Box sx={{ flexGrow: 1 }} />
                    <Chip
                      label={`Latest: ${new Date(strategicInsightsHistory[0].generated_at).toLocaleDateString()}`}
                      size="small"
                      sx={{ bgcolor: 'rgba(139, 92, 246, 0.15)', color: '#a78bfa' }}
                    />
                  </Box>
                  
                  <StrategicInsightsResults 
                    report={strategicInsightsHistory[0]} 
                    hideCreateContent={false} 
                  />
                </Box>
              )}

              {/* Phase 2B: Semantic Intelligence Dashboard */}
              <Box sx={{ mb: 4 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                  <Typography variant="h6" sx={{ color: 'white', fontWeight: 600 }}>
                    🧠 Semantic Intelligence
                  </Typography>
                  <Tooltip title="Real-time semantic analysis powered by AI. Updates every 24 hours.">
                    <InfoIcon sx={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: 18 }} />
                  </Tooltip>
                </Box>

                {/* Semantic Health Overview */}
                <Grid container spacing={2} sx={{ mb: 3 }}>
                  <Grid item xs={12} md={6}>
                    <SemanticHealthCard compact />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    {/* Placeholder for additional semantic metrics */}
                    <SemanticInsights maxInsights={2} />
                  </Grid>
                </Grid>

                {/* Full Semantic Dashboard */}
                <SemanticInsights />
              </Box>

              {/* Deep Competitor Analysis (auto-scheduled) */}
              {deepCompetitorAnalysisData && (
                <Box sx={{ mb: 4 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                    <Typography variant="h6" sx={{ color: 'white', fontWeight: 600 }}>
                      🔍 Deep Competitor Analysis
                    </Typography>
                    <Tooltip title="Auto-scheduled after onboarding completion. Uses Step 2 website insights and Step 3 competitors.">
                      <InfoIcon sx={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: 18 }} />
                    </Tooltip>
                  </Box>

                  <Grid container spacing={2}>
                    <Grid item xs={12} md={4}>
                      <GlassCard sx={{ p: 2 }}>
                        <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 1 }}>
                          Status
                        </Typography>
                        <Chip
                          size="small"
                          label={(deepCompetitorAnalysisData.status || 'unknown').toString()}
                          sx={{ bgcolor: 'rgba(34, 197, 94, 0.15)', color: '#86efac', fontWeight: 700 }}
                        />
                        {deepCompetitorAnalysisData.last_status && (
                          <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'rgba(255, 255, 255, 0.6)' }}>
                            Last run: {deepCompetitorAnalysisData.last_status}
                          </Typography>
                        )}
                      </GlassCard>
                    </Grid>

                    <Grid item xs={12} md={4}>
                      <GlassCard sx={{ p: 2 }}>
                        <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 1 }}>
                          Competitors
                        </Typography>
                        <Typography variant="h4" sx={{ color: '#4CAF50', fontWeight: 700 }}>
                          {deepCompetitorAnalysisData.competitors_count ?? (deepCompetitorAnalysisData.report?.competitors?.length || 0)}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                          analyzed
                        </Typography>
                      </GlassCard>
                    </Grid>

                    <Grid item xs={12} md={4}>
                      <GlassCard sx={{ p: 2 }}>
                        <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 1 }}>
                          Schedule
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <ScheduleIcon sx={{ color: 'rgba(255,255,255,0.7)', fontSize: 18 }} />
                          <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.85)' }}>
                            {deepCompetitorAnalysisData.next_execution
                              ? deepCompetitorAnalysisData.next_execution
                              : (deepCompetitorAnalysisData.last_run ? 'Completed' : 'Pending')}
                          </Typography>
                        </Box>
                        {deepCompetitorAnalysisData.last_run && (
                          <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'rgba(255, 255, 255, 0.6)' }}>
                            Last run: {deepCompetitorAnalysisData.last_run}
                          </Typography>
                        )}
                      </GlassCard>
                    </Grid>
                  </Grid>

                  {!deepCompetitorAnalysisData.report && (
                    <Box sx={{ mt: 3 }}>
                      <Alert severity="info">
                        Deep competitor analysis is scheduled or running. Once complete, the full per-competitor extraction, AI analysis, and aggregated insights will appear here.
                      </Alert>
                    </Box>
                  )}

                  {deepCompetitorAnalysisData.report?.aggregation && (
                    <Box sx={{ mt: 3 }}>
                      <Typography variant="h6" sx={{ color: 'white', fontWeight: 600, mb: 2 }}>
                        Aggregated Insights
                      </Typography>
                      <GlassCard sx={{ p: 3 }}>
                        <Typography variant="subtitle2" sx={{ color: 'rgba(255,255,255,0.9)', fontWeight: 700, mb: 1 }}>
                          Common Themes
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', mb: 2 }}>
                          {(deepCompetitorAnalysisData.report.aggregation.common_patterns?.common_themes || []).slice(0, 8).join(' • ') || '—'}
                        </Typography>

                        <Typography variant="subtitle2" sx={{ color: 'rgba(255,255,255,0.9)', fontWeight: 700, mb: 1 }}>
                          Top Opportunities
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', mb: 2 }}>
                          {(deepCompetitorAnalysisData.report.aggregation.content_gaps_and_opportunities || [])
                            .slice(0, 5)
                            .map((g: any) => g.gap)
                            .filter(Boolean)
                            .join(' • ') || '—'}
                        </Typography>

                        <Typography variant="subtitle2" sx={{ color: 'rgba(255,255,255,0.9)', fontWeight: 700, mb: 1 }}>
                          Recommended Actions
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                          {(deepCompetitorAnalysisData.report.aggregation.strategic_recommendations || [])
                            .slice(0, 5)
                            .map((r: any) => r.action)
                            .filter(Boolean)
                            .join(' • ') || '—'}
                        </Typography>
                      </GlassCard>
                    </Box>
                  )}

                  {deepCompetitorAnalysisData.report?.competitors?.length > 0 && (
                    <Box sx={{ mt: 3 }}>
                      <Typography variant="h6" sx={{ color: 'white', fontWeight: 600, mb: 2 }}>
                        Per-Competitor Details
                      </Typography>
                      {deepCompetitorAnalysisData.report.competitors.slice(0, 25).map((c: any, idx: number) => {
                        const input = c?.input || {};
                        const extraction = c?.extraction || {};
                        const ai = c?.ai_analysis || {};
                        const title = input.name || input.domain || `Competitor ${idx + 1}`;
                        const domain = input.domain || input.url || '';
                        return (
                          <Accordion key={`${domain}-${idx}`} sx={{ bgcolor: 'rgba(255,255,255,0.06)', mb: 1, borderRadius: 2 }}>
                            <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: 'rgba(255,255,255,0.8)' }} />}>
                              <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                                <Typography variant="subtitle2" sx={{ color: 'white', fontWeight: 700 }}>
                                  {title}
                                </Typography>
                                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                                  {domain}
                                </Typography>
                              </Box>
                            </AccordionSummary>
                            <AccordionDetails>
                              <Grid container spacing={2}>
                                <Grid item xs={12} md={6}>
                                  <GlassCard sx={{ p: 2 }}>
                                    <Typography variant="subtitle2" sx={{ color: 'white', fontWeight: 700, mb: 1 }}>
                                      Extraction
                                    </Typography>
                                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', mb: 1 }}>
                                      {extraction.page_meta?.title || '—'}
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                                      {(extraction.page_meta?.meta_description || '').slice(0, 220) || '—'}
                                    </Typography>
                                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', mt: 2 }}>
                                      CTA signals: {(extraction.signals?.cta_signals?.keyword_hits || []).slice(0, 8).join(', ') || '—'}
                                    </Typography>
                                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', mt: 1 }}>
                                      Proof signals: {(extraction.signals?.proof_signals?.keyword_hits || []).slice(0, 6).join(', ') || '—'}
                                    </Typography>
                                  </GlassCard>
                                </Grid>
                                <Grid item xs={12} md={6}>
                                  <GlassCard sx={{ p: 2 }}>
                                    <Typography variant="subtitle2" sx={{ color: 'white', fontWeight: 700, mb: 1 }}>
                                      AI Analysis
                                    </Typography>
                                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.85)', mb: 1 }}>
                                      Value prop: {ai.positioning?.value_prop || '—'}
                                    </Typography>
                                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.85)', mb: 1 }}>
                                      Primary offer: {ai.positioning?.primary_offer || '—'}
                                    </Typography>
                                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.85)', mb: 1 }}>
                                      Themes: {(ai.content_strategy?.themes || []).slice(0, 6).join(' • ') || '—'}
                                    </Typography>
                                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.85)' }}>
                                      Opportunities vs you: {(ai.comparison_to_user_baseline?.opportunities || []).slice(0, 4).join(' • ') || '—'}
                                    </Typography>
                                  </GlassCard>
                                </Grid>
                              </Grid>
                            </AccordionDetails>
                          </Accordion>
                        );
                      })}
                    </Box>
                  )}
                </Box>
              )}

              {/* Weekly Strategic Brief */}
              <Box sx={{ mb: 4 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="h6" sx={{ color: 'white', fontWeight: 600 }}>
                      🧠 Weekly Strategy Brief
                    </Typography>
                    <Tooltip title="AI-powered strategic insights based on competitor content velocity and market shifts.">
                      <InfoIcon sx={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: 18 }} />
                    </Tooltip>
                  </Box>
                  <Button
                    variant="contained"
                    startIcon={strategicInsightsLoading ? <CircularProgress size={20} color="inherit" /> : <AIIcon />}
                    onClick={runStrategicInsights}
                    disabled={strategicInsightsLoading}
                    sx={{
                      bgcolor: '#8b5cf6',
                      '&:hover': { bgcolor: '#7c3aed' },
                      textTransform: 'none',
                      fontWeight: 700
                    }}
                  >
                    {strategicInsightsLoading ? 'Analyzing...' : 'Run Analysis Now'}
                  </Button>
                </Box>

                {strategicInsightsHistory.length > 0 ? (
                  <GlassCard sx={{ p: 0, overflow: 'hidden', border: 'none', bgcolor: 'transparent' }}>
                    <StrategicInsightsResults report={strategicInsightsHistory[0]} />
                  </GlassCard>
                ) : (
                  <GlassCard sx={{ p: 4, textAlign: 'center' }}>
                    <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.7)', mb: 2 }}>
                      No strategic insights generated yet. Run your first analysis to see "The Big Move" and market opportunities.
                    </Typography>
                    <Button 
                      variant="outlined" 
                      onClick={runStrategicInsights}
                      sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.3)' }}
                    >
                      Get Started
                    </Button>
                  </GlassCard>
                )}
              </Box>

              {(competitiveSitemapBenchmarkingReport || competitorAnalysisData) && (
                <Box sx={{ mb: 4 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="h6" sx={{ color: 'white', fontWeight: 600 }}>
                        🗺️ Competitive Sitemap Benchmarking (No AI)
                      </Typography>
                      <Tooltip title="Uses public sitemaps and deterministic rules (no LLM calls) to compare structure, coverage, and publishing signals.">
                        <InfoIcon sx={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: 18 }} />
                      </Tooltip>
                    </Box>

                    <Button
                      variant="contained"
                      onClick={runCompetitiveSitemapBenchmarking}
                      disabled={competitiveSitemapBenchmarkingLoading}
                      sx={{
                        bgcolor: '#10b981',
                        '&:hover': { bgcolor: '#059669' },
                        textTransform: 'none',
                        fontWeight: 700
                      }}
                    >
                      {competitiveSitemapBenchmarkingLoading ? 'Running…' : 'Run Benchmark'}
                    </Button>
                  </Box>

                  {competitiveSitemapBenchmarkingError && (
                    <Box sx={{ mb: 2 }}>
                      <Alert severity="error">{competitiveSitemapBenchmarkingError}</Alert>
                    </Box>
                  )}

                  {!competitiveSitemapBenchmarkingReport && (
                    <Box sx={{ mt: 2 }}>
                      <Alert severity="info">
                        No benchmarking report yet. Run it to compare your sitemap structure against competitors and discover missing sections.
                      </Alert>
                    </Box>
                  )}

                  {competitiveSitemapBenchmarkingReport && competitiveSitemapBenchmarkingReport.benchmark && (
                    <SitemapBenchmarkResults
                      data={{
                        user_summary: competitiveSitemapBenchmarkingReport.benchmark.user?.summary || {},
                        competitor_summaries: competitiveSitemapBenchmarkingReport.benchmark.competitors?.summaries || {},
                        timestamp: competitiveSitemapBenchmarkingReport.timestamp,
                        benchmark: competitiveSitemapBenchmarkingReport.benchmark
                      }}
                    />
                  )}
                </Box>
              )}

              {/* Strategic Insights Section */}
              {strategicInsightsHistory.length > 0 && (
                <Box sx={{ mb: 4 }} id="strategic-insights-results">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                    <Typography variant="h6" sx={{ color: 'white', fontWeight: 600 }}>
                      🧠 AI-Powered Strategic Insights
                    </Typography>
                    <Tooltip title="Weekly strategic briefs generated by AI analysis of competitor content moves and market shifts.">
                      <InfoIcon sx={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: 18 }} />
                    </Tooltip>
                  </Box>
                  <StrategicInsightsResults report={strategicInsightsHistory[0]} />
                </Box>
              )}



              {onboardingTaskHealth && (
                <Box sx={{ mt: 4 }}>
                  <GlassCard>
                    <Box sx={{ p: 3 }}>
                      <Typography variant="h6" sx={{ color: 'white', fontWeight: 700, mb: 0.5 }}>
                        Onboarding Scheduled SEO Tasks
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', mb: 2 }}>
                        Unified health view for onboarding automation jobs.
                      </Typography>

                      <Grid container spacing={2}>
                        {orderedTaskKeys.map((taskKey) => {
                          const task = onboardingTaskHealth.tasks?.[taskKey];
                          if (!task) return null;
                          const status = (task.status || 'not_scheduled') as OnboardingTaskStatus;
                          const ui = statusUiMap[status] || statusUiMap.not_scheduled;

                          return (
                            <Grid item xs={12} md={6} key={taskKey}>
                              <Box sx={{ p: 2, borderRadius: 2, border: `1px solid ${ui.border}`, bgcolor: 'rgba(15,23,42,0.5)' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                                  <Typography variant="subtitle2" sx={{ color: 'white', fontWeight: 600 }}>
                                    {task.label || taskKey}
                                  </Typography>
                                  <Chip size="small" label={ui.label} sx={{ color: ui.color, bgcolor: ui.bg, border: `1px solid ${ui.border}` }} />
                                </Box>
                                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.75)', display: 'block' }}>
                                  Next: {task.next_execution ? new Date(task.next_execution).toLocaleString() : 'Not scheduled'}
                                </Typography>
                                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.75)', display: 'block' }}>
                                  Last success: {task.last_success ? new Date(task.last_success).toLocaleString() : 'No successful runs yet'}
                                </Typography>
                                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.75)', display: 'block' }}>
                                  Last failure: {task.last_failure ? new Date(task.last_failure).toLocaleString() : 'No failure recorded'}
                                </Typography>
                                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.75)', display: 'block', mb: 1 }}>
                                  Consecutive failures: {task.consecutive_failures ?? 0}
                                </Typography>
                                <Alert severity={status === 'active' ? 'success' : status === 'not_scheduled' ? 'info' : 'warning'} sx={{ bgcolor: 'rgba(15,23,42,0.65)', color: 'white', border: `1px solid ${ui.border}` }}>
                                  {ui.action}
                                  {task.latest_execution?.error_message ? ` Latest error: ${task.latest_execution.error_message}` : ''}
                                </Alert>
                              </Box>
                            </Grid>
                          );
                        })}
                      </Grid>
                    </Box>
                  </GlassCard>
                </Box>
              )}

              {/* SEO Analyzer Panel */}
              <SEOAnalyzerPanel
                analysisData={analysisData}
                onRunAnalysis={runSEOAnalysis}
                loading={analysisLoading}
                error={analysisError}
              />

              {/* Copilot Suggestions Panel */}
              <Box sx={{ mt: 4 }}>
                <SEOCopilotSuggestions />
              </Box>
              
              {/* SEO Copilot Component for data loading and error handling */}
              <SEOCopilot />
              </>
              )}

              {/* Tab Content: Enterprise Analysis */}
              {dashboardTab === 1 && (
                <SEOAnalysisController />
              )}
            </motion.div>
          </AnimatePresence>
        </Container>


      </DashboardContainer>
  );
};

export default SEODashboard;
