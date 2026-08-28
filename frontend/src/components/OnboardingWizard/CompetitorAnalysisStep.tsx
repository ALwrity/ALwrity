import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Button,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  Divider,
  Tooltip,
  IconButton,
  Collapse,
  Chip,
  Stack,
} from '@mui/material';
import AssessmentIcon from '@mui/icons-material/Assessment';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import InfoIcon from '@mui/icons-material/Info';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import SearchIcon from '@mui/icons-material/Search';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AutoFixHighIcon from '@mui/icons-material/AutoAwesome';
import { aiApiClient, longRunningApiClient } from '../../api/client';
import { useOnboardingStyles } from './common/useOnboardingStyles';
import { SocialMediaPresenceSection, CompetitorsGrid } from './WebsiteStep/components';
import type { Competitor } from './WebsiteStep/components';
import ResearchStepBackgroundSetupModal from './CompetitorAnalysisStep/ResearchStepBackgroundSetupModal';
import { SifIndexingPanel } from './common/SifIndexingPanel';
import { ContentPillarsSection, type ContentPillarData } from './CompetitorAnalysisStep/ContentPillarsSection';
import { StrategicInsightsSection } from './CompetitorAnalysisStep/StrategicInsightsSection';
import { InsightsModals } from './CompetitorAnalysisStep/InsightsModals';
import { ProgressModal } from './CompetitorAnalysisStep/ProgressModal';
import { useCompetitorDiscovery } from './CompetitorAnalysisStep/useCompetitorDiscovery';


// Light theme constants matching requirements
const lightTheme = {
  surface: '#FFFFFF',
  text: '#0B1220',
  textSecondary: '#4B5563',
  border: '#E5E7EB',
  inputBg: '#FFFFFF',
  inputText: '#0B1220',
  placeholder: '#6B7280',
  primary: '#6C5CE7',
  primaryContrast: '#FFFFFF',
  shadowSm: '0 1px 2px rgba(16,24,40,0.06)',
  shadowMd: '0 4px 10px rgba(16,24,40,0.08)',
  radiusLg: '20px'
};

// Render a titled list of strings with bullet styling (used in the competitor modal)
const renderStringList = (title: string, items: string[]): React.ReactNode => (
  <Box>
    <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#0B1220', mb: 0.5 }}>
      {title}
    </Typography>
    <Stack spacing={0.5}>
      {items.map((item, i) => (
        <Typography key={i} variant="body2" sx={{ color: '#4B5563' }}>
          • {item}
        </Typography>
      ))}
    </Stack>
  </Box>
);

// Convert snake_case keys into human-friendly labels
const labelify = (key: string): string =>
  key
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

interface ResearchSummary {
  total_competitors: number;
  market_insights: string;
  key_findings: string[];
}

interface CompetitorAnalysisStepProps {
  onContinue: (researchData?: any) => void;
  onBack: () => void;
  userUrl: string;
  industryContext?: string;
  // Expose data collection function for global Continue button
  onDataReady?: (getData: () => any) => void;
  initialData?: any;
}

const CompetitorAnalysisStep: React.FC<CompetitorAnalysisStepProps> = ({
  onContinue,
  onBack,
  userUrl,
  industryContext,
  onDataReady,
  initialData
}) => {
  const classes = useOnboardingStyles();

  // UI state (modals, header, sitemap, social discovery) — stays in parent
  const [showHighlightsModal, setShowHighlightsModal] = useState(false);
  const [selectedCompetitor, setSelectedCompetitor] = useState<Competitor | null>(null);
  // Seed from initialData so the persisted sitemap/strategic insights render
  // immediately and don't trigger an unnecessary AI call on back-navigation.
  const [sitemapAnalysis, setSitemapAnalysis] = useState<any>(initialData?.sitemapAnalysis ?? null);
  const [isAnalyzingSitemap, setIsAnalyzingSitemap] = useState(false);
  const [isDiscoveringSocial, setIsDiscoveringSocial] = useState(false);
  const [showHeaderInfo, setShowHeaderInfo] = useState(false);
  const [missingData, setMissingData] = useState(false);
  const [showBenchmarksModal, setShowBenchmarksModal] = useState(false);
  const [showStrategyModal, setShowStrategyModal] = useState(false);
  const [showPublishingModal, setShowPublishingModal] = useState(false);
  const [showStructureModal, setShowStructureModal] = useState(false);
  const [backgroundSetupOpen, setBackgroundSetupOpen] = useState(false);

  const sitemapAutoTriggered = React.useRef(false);
  const crawlSocialMediaRef = React.useRef<Record<string, string>>({});

  const mergeCrawlSocialMedia = React.useCallback((exaData: Record<string, any>) => {
    const merged = { ...exaData };
    for (const [platform, url] of Object.entries(crawlSocialMediaRef.current)) {
      const existing = merged[platform];
      if (!existing || String(existing).trim() === '' || String(existing).trim() === '1' || String(existing).toLowerCase() === 'true') {
        merged[platform] = url;
      }
    }
    return merged;
  }, []);

  // Data-fetching hook — manages competitors, social media, pillars, analysis state
  const {
    competitors, setCompetitors,
    socialMediaAccounts, setSocialMediaAccounts,
    researchSummary,
    contentPillars,
    isLoadingPillars,
    error, setError,
    isAnalyzing,
    analysisProgress, analysisStep,
    showProgressModal,
    usingCachedData,
    startCompetitorDiscovery,
    updateCacheWithSitemapAnalysis,
    refreshContentPillars,
  } = useCompetitorDiscovery({
    userUrl,
    industryContext,
    initialData,
    sitemapAnalysis,
    mergeCrawlSocialMedia,
  });

  // Check for missing data
  useEffect(() => {
    // Wait a bit to ensure Wizard has finished initializing its stepData
    const timer = setTimeout(() => {
      const propUserUrl = userUrl || '';
      const localStorageUrl = localStorage.getItem('website_url') || '';
      const onboardingContextUrl = (window as any).onboardingContext?.websiteUrl || '';
      
      // Also check initialData if available
      const initialDataUrl = initialData?.website || initialData?.website_url || '';
      
      const finalUserUrl = propUserUrl || localStorageUrl || onboardingContextUrl || initialDataUrl || '';
      
      if (!finalUserUrl) {
        console.warn('CompetitorAnalysisStep: No website URL found (prop, local, context, or initialData).');
        setMissingData(true);
      } else {
        console.log('CompetitorAnalysisStep: Valid website URL found:', finalUserUrl);
        setMissingData(false);
        // Ensure website_url is in localStorage for other parts of the step to use
        if (!localStorage.getItem('website_url')) {
          localStorage.setItem('website_url', finalUserUrl);
        }
      }
    }, 1000); // Increased timeout to 1s to allow for slower data loading
    
    return () => clearTimeout(timer);
  }, [userUrl, initialData]);

  // Social Media Discovery Function
  const discoverSocialMedia = useCallback(async () => {
    if (isDiscoveringSocial) return;
    
    setIsDiscoveringSocial(true);
    try {
      const finalUserUrl = userUrl || localStorage.getItem('website_url') || '';
      console.log('Starting targeted social media discovery for:', finalUserUrl);
      
      const response = await aiApiClient.post('/api/onboarding/step3/discover-social-media', {
        user_url: finalUserUrl
      });
      
      const result = response.data;
      
      if (result.success) {
        console.log('Social media discovery completed:', result.social_media_accounts);
        const newAccounts = mergeCrawlSocialMedia(result.social_media_accounts || {});
        
        // Check if we found any valid accounts
        const hasNewAccounts = Object.values(newAccounts).some((val: any) => val && String(val).trim() !== '' && String(val) !== '1');
        const hasExistingAccounts = Object.values(socialMediaAccounts).some((val: any) => val && String(val).trim() !== '' && String(val) !== '1');

        // Only update if we found something, or if we had nothing to begin with.
        // This prevents "vanishing" profiles if a re-discovery returns a false negative/empty result.
        if (hasNewAccounts || !hasExistingAccounts) {
            setSocialMediaAccounts(newAccounts);
            
            // Update cache
            try {
                const cachedData = localStorage.getItem('competitor_analysis_data');
                if (cachedData) {
                    const parsedData = JSON.parse(cachedData);
                    parsedData.social_media_accounts = newAccounts;
                    localStorage.setItem('competitor_analysis_data', JSON.stringify(parsedData));
                }
            } catch (e) {
                console.warn('Failed to update cache for social accounts', e);
            }
        } else {
            console.warn('Re-discovery returned no accounts. Keeping existing ones to prevent vanishing.');
        }
      } else {
        console.error('Social media discovery failed:', result.error);
        setError(result.error || 'Social media discovery failed');
      }
    } catch (err) {
      console.error('Social media discovery error:', err);
      setError(err instanceof Error ? err.message : 'Social media discovery failed');
    } finally {
      setIsDiscoveringSocial(false);
    }
  }, [userUrl, isDiscoveringSocial, socialMediaAccounts]);

  // Sitemap Analysis Function
  const startSitemapAnalysis = useCallback(async (force = false) => {
    if (isAnalyzingSitemap) return;
    
    const finalUserUrl = userUrl || localStorage.getItem('website_url') || '';
    const stateKey = 'alwrity_sitemap_state';

    // DB-first: when not forced, restore the persisted analysis from the DB
    // (mirrors the Discovered Competitors flow) before paying for an LLM call.
    if (!force && finalUserUrl) {
      try {
        const dbResp = await aiApiClient.get('/api/onboarding/step3/sitemap-analysis', {
          params: { user_url: finalUserUrl }
        });
        if (dbResp?.data?.success && dbResp.data.sitemap_analysis) {
          const cached = dbResp.data.sitemap_analysis;
          console.log('[sitemap] Loaded persisted analysis from DB');
          setSitemapAnalysis(cached);
          updateCacheWithSitemapAnalysis(cached);
          return;
        }
      } catch (e) {
        console.warn('[sitemap] DB lookup failed, will fall through to LLM', e);
      }
    }

    // Persistent guard (localStorage, not sessionStorage — survives hard refresh):
    // blocks duplicate LLM calls across remounts AND page reloads.
    if (!force && finalUserUrl) {
      try {
        const prev = JSON.parse(localStorage.getItem(stateKey) || 'null');
        if (prev && prev.url === finalUserUrl) {
          const ageMs = Date.now() - (prev.ts || 0);
          if (prev.status === 'inflight' && ageMs < 5 * 60_000) {
            console.log('[sitemap] Blocked: already inflight');
            return;
          }
          if (prev.status === 'done' && ageMs < 24 * 60 * 60_000) {
            console.log('[sitemap] Blocked: completed within 24h');
            return;
          }
        }
      } catch { /* corrupted — ignore */ }
    }
    
    setIsAnalyzingSitemap(true);
    if (force) {
        setSitemapAnalysis(null);
    }

    // Mark inflight
    if (finalUserUrl) {
      try {
        localStorage.setItem(stateKey, JSON.stringify({ url: finalUserUrl, status: 'inflight', ts: Date.now() }));
      } catch { /* non-critical */ }
    }
    
    try {
      const competitorDomains = competitors.map(c => c.domain).filter(Boolean);
      
      console.log('[sitemap] Starting analysis for:', finalUserUrl);
      
      const response = await aiApiClient.post('/api/onboarding/step3/analyze-sitemap', {
        user_url: finalUserUrl,
        competitors: competitorDomains,
        industry_context: industryContext,
        analyze_content_trends: true,
        analyze_publishing_patterns: true,
        force
      });
      
      const result = response.data;
      
      if (result.success) {
        console.log('[sitemap] Analysis completed successfully');
        setSitemapAnalysis(result);
        updateCacheWithSitemapAnalysis(result);

        // Mark done (24h TTL in the check above)
        if (finalUserUrl) {
          try {
            localStorage.setItem(stateKey, JSON.stringify({ url: finalUserUrl, status: 'done', ts: Date.now() }));
          } catch { /* non-critical */ }
        }
      } else if (result.error === 'analysis_in_progress') {
        console.log('[sitemap] Backend busy — another request running');
        // Leave state as-is so next mount also waits
      } else {
        console.error('[sitemap] Analysis failed:', result.error);
        setError(result.error || 'Sitemap analysis failed');
        // Clear state on hard failure so next mount retries
        if (finalUserUrl) localStorage.removeItem(stateKey);
      }
    } catch (err) {
      console.error('[sitemap] Request error:', err);
      setError(err instanceof Error ? err.message : 'Sitemap analysis failed');
      if (finalUserUrl) localStorage.removeItem(stateKey);
    } finally {
      setIsAnalyzingSitemap(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userUrl, competitors, industryContext, isAnalyzingSitemap]);

  // Pick up sitemapAnalysis from initialData (competitors/cache handled by hook)
  useEffect(() => {
    if (initialData?.sitemapAnalysis) {
      setSitemapAnalysis(initialData.sitemapAnalysis);
    }
  }, [initialData?.sitemapAnalysis]);

  // Load cached sitemap analysis if available (no auto-trigger — user clicks Refresh Strategy)
  useEffect(() => {
    if (competitors.length > 0 && !sitemapAnalysis) {
      const cachedData = localStorage.getItem('competitor_analysis_data');
      if (cachedData) {
        try {
          const parsedData = JSON.parse(cachedData);
          if (parsedData.sitemap_analysis) {
            setSitemapAnalysis(parsedData.sitemap_analysis);
          }
        } catch (err) {
          console.warn('Error loading cached sitemap analysis:', err);
        }
      }
    }
  }, [competitors.length, sitemapAnalysis]);

  // Auto-trigger sitemap analysis only when competitors load and there is no
  // persisted data available in state, initialData, or localStorage. The
  // localStorage check here must be SYNCHRONOUS: the cache-load effect above
  // only schedules a state update, and within the same commit this effect
  // would otherwise still see the stale null value and fire an LLM call.
  useEffect(() => {
    if (
      competitors.length > 0 &&
      !sitemapAnalysis &&
      !isAnalyzing &&
      !isAnalyzingSitemap &&
      !sitemapAutoTriggered.current
    ) {
      // Re-check initialData at fire time
      if (initialData?.sitemapAnalysis) return;

      // Re-check localStorage synchronously (covers back-navigation where
      // Wizard's stepData was seeded before the analysis ever ran)
      let hasCached = false;
      try {
        const cachedData = JSON.parse(localStorage.getItem('competitor_analysis_data') || 'null');
        if (cachedData?.sitemap_analysis) {
          setSitemapAnalysis(cachedData.sitemap_analysis);
          hasCached = true;
        }
      } catch {
        // Corrupted cache — treat as absent
      }
      if (hasCached) {
        console.log('CompetitorAnalysisStep: Using cached sitemap analysis, skipping auto-trigger');
        return;
      }

      sitemapAutoTriggered.current = true;
      console.log('CompetitorAnalysisStep: Auto-triggering sitemap analysis');
      startSitemapAnalysis(false);
    }
  }, [competitors.length, isAnalyzing, sitemapAnalysis, isAnalyzingSitemap, startSitemapAnalysis, initialData?.sitemapAnalysis]);

  // Fetch sitemap benchmark results (runs in background after competitor discovery)
  const [benchmarkReport, setBenchmarkReport] = useState<any>(null);
  const [benchmarkLoading, setBenchmarkLoading] = useState(false);
  const [isRunningBenchmark, setIsRunningBenchmark] = useState(false);

  useEffect(() => {
    if (!competitors.length || isAnalyzing) return;
    let cancelled = false;
    setBenchmarkLoading(true);
    longRunningApiClient.get('/api/onboarding/step3/sitemap-benchmark-report')
      .then((resp) => {
        if (!cancelled) setBenchmarkReport(resp.data || null);
      })
      .catch(() => {
        if (!cancelled) setBenchmarkReport(null);
      })
      .finally(() => {
        if (!cancelled) setBenchmarkLoading(false);
      });
    return () => { cancelled = true; };
  }, [competitors.length, isAnalyzing]);

  const runSitemapBenchmark = async () => {
    const validCompetitors = competitors
      .filter(c => c.url && (c.url.startsWith('http') || c.url.startsWith('https')))
      .map(c => c.url);
    if (!validCompetitors.length) return;
    setIsRunningBenchmark(true);
    try {
      await longRunningApiClient.post('/api/seo/competitive-sitemap-benchmarking/run', {
        max_competitors: 5,
        competitors: validCompetitors.slice(0, 5)
      });
    } catch (err) {
      console.warn('Sitemap benchmark run failed (may already be running):', err);
    }
    setIsRunningBenchmark(false);
  };

  const fetchSitemapReport = async () => {
    setBenchmarkLoading(true);
    try {
      const resp = await aiApiClient.get('/api/onboarding/step3/sitemap-benchmark-report');
      setBenchmarkReport(resp.data || resp.data?.benchmark);
    } catch {
      setBenchmarkReport(null);
    } finally {
      setBenchmarkLoading(false);
    }
  };

  // Data collection function for global Continue button (no side effects)
  const getResearchData = useCallback(() => {
    return {
      competitors,
      social_media_accounts: socialMediaAccounts,
      researchSummary,
      sitemapAnalysis,
      userUrl,
      industryContext,
      analysisTimestamp: new Date().toISOString()
    };
  }, [competitors, socialMediaAccounts, researchSummary, sitemapAnalysis, userUrl, industryContext]);


  // Expose data collection function to parent (only when onDataReady changes)
  useEffect(() => {
    if (onDataReady) {
      console.log('CompetitorAnalysisStep: Exposing data collection function to parent');
      // Always provide a data collection function, even if data is empty
      const safeGetData = () => {
        console.log('CompetitorAnalysisStep: getResearchData called');
        return getResearchData();
      };
      onDataReady(safeGetData);
    }
  }, [onDataReady, getResearchData]); // Include getResearchData in dependencies

  const handleShowHighlights = (competitor: Competitor) => {
    setSelectedCompetitor(competitor);
    setShowHighlightsModal(true);
  };

  // Handlers for interactive features
  const handleUpdateSocialAccounts = (newAccounts: { [key: string]: string }) => {
    setSocialMediaAccounts(newAccounts);
    // Update cache
    try {
        const cachedData = localStorage.getItem('competitor_analysis_data');
        if (cachedData) {
            const parsedData = JSON.parse(cachedData);
            parsedData.social_media_accounts = newAccounts;
            localStorage.setItem('competitor_analysis_data', JSON.stringify(parsedData));
        }
    } catch (e) {
        console.warn('Failed to update cache for social accounts', e);
    }
  };

  const handleRemoveCompetitor = (index: number) => {
    const removed = competitors[index];
    const newCompetitors = [...competitors];
    newCompetitors.splice(index, 1);
    setCompetitors(newCompetitors);
    // Update cache
    try {
        const cachedData = localStorage.getItem('competitor_analysis_data');
        if (cachedData) {
            const parsedData = JSON.parse(cachedData);
            parsedData.competitors = newCompetitors;
            localStorage.setItem('competitor_analysis_data', JSON.stringify(parsedData));
        }
    } catch (e) {
        console.warn('Failed to update cache for competitors', e);
    }
    // Delete from DB — resolve URL across possible field names
    const removedUrl = removed?.url || removed?.domain || '';
    if (removedUrl) {
      longRunningApiClient.delete('/api/onboarding/competitor-analysis', { params: { competitor_url: removedUrl } })
        .then(() => console.log('Deleted competitor from DB:', removedUrl))
        .catch((e: any) => console.warn('Failed to delete competitor from DB:', e));
    }
  };

  const handleAddCompetitor = (competitor: Competitor) => {
    const newCompetitors = [...competitors, competitor];
    setCompetitors(newCompetitors);
    // Update cache
    try {
        const cachedData = localStorage.getItem('competitor_analysis_data');
        if (cachedData) {
            const parsedData = JSON.parse(cachedData);
            parsedData.competitors = newCompetitors;
            localStorage.setItem('competitor_analysis_data', JSON.stringify(parsedData));
        }
    } catch (e) {
        console.warn('Failed to update cache for competitors', e);
    }
  };

  if (missingData) {
    return (
      <Box sx={{ p: 4, textAlign: 'center', mt: 8 }}>
        <Typography variant="h5" color="error" gutterBottom>
          Missing Website URL
        </Typography>
        <Typography variant="body1" sx={{ mb: 3 }}>
          We couldn't find the website URL to analyze. This might happen if the page was refreshed and session data was lost.
        </Typography>
        <Button variant="contained" onClick={onBack}>
          Return to Website Step
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={classes.container}>
      {/* Compact Header: Title, subtitle, info, and Run Fresh Analysis on one line */}
      <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 4 }}>
        <Typography variant="h4" sx={{ 
          fontWeight: 700,
          background: 'linear-gradient(45deg, #2563EB 30%, #7C3AED 90%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          whiteSpace: 'nowrap'
        }}>
          Competitive Intelligence
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{
          flex: 1,
          minWidth: 200,
          fontSize: '0.9rem'
        }}>
          — Uncover the strategies that are working for your competitors to build your own advantage.
        </Typography>
        <Tooltip title="About this step">
          <IconButton 
            size="small" 
            onClick={() => setShowHeaderInfo(!showHeaderInfo)}
            sx={{ color: '#64748b' }}
          >
            {showHeaderInfo ? <ExpandLessIcon /> : <InfoIcon />}
          </IconButton>
        </Tooltip>
        <Button
          size="small"
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={() => startCompetitorDiscovery(true)}
          disabled={isAnalyzing}
          sx={{
            borderColor: '#667eea',
            color: '#667eea',
            textTransform: 'none',
            whiteSpace: 'nowrap',
            '&:hover': { borderColor: '#5a6fd8', bgcolor: 'rgba(102,126,234,0.04)' }
          }}
        >
          {isAnalyzing ? 'Analyzing...' : 'Run Fresh Analysis'}
        </Button>
        <Button
          size="small"
          variant="outlined"
          onClick={() => setBackgroundSetupOpen(true)}
          sx={{
            borderColor: '#3b82f6',
            color: '#3b82f6',
            textTransform: 'none',
            whiteSpace: 'nowrap',
            '&:hover': { borderColor: '#2563eb', bgcolor: 'rgba(59,130,246,0.08)' }
          }}
        >
          ⚙️ Smart Background Setup
        </Button>
      </Box>

      {/* Collapsible info modal */}
      <Collapse in={showHeaderInfo}>
        <Box sx={{ 
          mb: 3, 
          p: 3, 
          bgcolor: lightTheme.surface,
          color: lightTheme.text,
          borderRadius: 3,
          border: `1px solid ${lightTheme.border}`,
          boxShadow: lightTheme.shadowSm,
          maxWidth: 800,
          textAlign: 'left'
        }}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                <Box sx={{ p: 1.5, bgcolor: '#DBEAFE', borderRadius: '50%', mb: 1.5, color: '#2563EB' }}>
                  <SearchIcon />
                </Box>
                <Typography variant="subtitle2" fontWeight="bold" gutterBottom>What</Typography>
                <Typography variant="caption" color="text.secondary">We analyze top competitors in your niche.</Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={4}>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                <Box sx={{ p: 1.5, bgcolor: '#F3E8FF', borderRadius: '50%', mb: 1.5, color: '#7C3AED' }}>
                  <TrendingUpIcon />
                </Box>
                <Typography variant="subtitle2" fontWeight="bold" gutterBottom>Why</Typography>
                <Typography variant="caption" color="text.secondary">To identify content gaps and market positioning.</Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={4}>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                <Box sx={{ p: 1.5, bgcolor: '#DCFCE7', borderRadius: '50%', mb: 1.5, color: '#16A34A' }}>
                  <AutoFixHighIcon />
                </Box>
                <Typography variant="subtitle2" fontWeight="bold" gutterBottom>How</Typography>
                <Typography variant="caption" color="text.secondary">Using AI to scan their public content and social footprint.</Typography>
              </Box>
            </Grid>
          </Grid>
        </Box>
      </Collapse>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
          <Button 
            startIcon={<RefreshIcon />} 
            onClick={() => startCompetitorDiscovery(true)}
            sx={{ ml: 2 }}
          >
            Retry
          </Button>
        </Alert>
      )}

      {/* Social Media Accounts Section (always visible) */}
      <SocialMediaPresenceSection 
        socialMediaAccounts={socialMediaAccounts} 
        onUpdateAccounts={handleUpdateSocialAccounts}
        onRefresh={discoverSocialMedia}
        isRefreshing={isDiscoveringSocial}
      />

      {/* Competitors Grid Section (always visible) */}
      <CompetitorsGrid 
        competitors={competitors}
        onShowHighlights={handleShowHighlights}
        onRemoveCompetitor={handleRemoveCompetitor}
        onAddCompetitor={handleAddCompetitor}
      />

      {/* Sitemap Benchmark Actions — user-triggered */}
      {competitors.length > 0 && (
        <Box mt={3} display="flex" gap={2} flexWrap="wrap">
          <Button
            variant="outlined"
            size="small"
            startIcon={isRunningBenchmark ? <CircularProgress size={14} /> : <RefreshIcon />}
            onClick={runSitemapBenchmark}
            disabled={isRunningBenchmark}
            sx={{ textTransform: 'none' }}
          >
            {isRunningBenchmark ? 'Scheduling...' : 'Run Sitemap Benchmark'}
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={benchmarkLoading ? <CircularProgress size={14} /> : <AssessmentIcon />}
            onClick={fetchSitemapReport}
            disabled={benchmarkLoading}
            sx={{ textTransform: 'none' }}
          >
            {benchmarkLoading ? 'Loading...' : 'View Sitemap Report'}
          </Button>
        </Box>
      )}

      {/* Content Pillars Section */}
      <ContentPillarsSection data={contentPillars} isLoading={isLoadingPillars} error={error} onRefresh={refreshContentPillars} />

      {/* Competitor Sitemap Analysis — results */}
      {benchmarkReport && (
        <Box mt={4} mb={3}>
          <Paper sx={{ p: 3, bgcolor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2, color: '#1e293b' }}>
              Competitor Sitemap Analysis
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {benchmarkReport.competitors?.summaries &&
                Object.entries(benchmarkReport.competitors.summaries).map(([url, info]: [string, any]) => {
                  let hostname = url;
                  try { hostname = new URL(url).hostname.replace('www.', ''); } catch {}
                  return (
                  <Chip
                    key={url}
                    size="small"
                    label={hostname}
                    icon={info?.error ? <span style={{ fontSize: 14 }}>⚠️</span> : <CheckCircleIcon sx={{ fontSize: 18, color: '#10b981' }} />}
                    color={info?.error ? 'default' : 'success'}
                    variant={info?.error ? 'outlined' : 'filled'}
                    title={info?.error || `Analyzed: ${(info as any)?.total_urls ?? '?'} URLs`}
                  />
                )})}
              {benchmarkReport.competitors?.errors &&
                Object.entries(benchmarkReport.competitors.errors).map(([url, err]: [string, any]) => {
                  let hostname = url;
                  try { hostname = new URL(url).hostname.replace('www.', ''); } catch {}
                  return (
                  <Chip
                    key={`err-${url}`}
                    size="small"
                    label={hostname}
                    icon={<span style={{ fontSize: 14 }}>❌</span>}
                    color="error"
                    variant="outlined"
                    title={typeof err === 'string' ? err : 'Analysis failed'}
                  />
                )})}
            </Box>
            {(!benchmarkReport?.competitors?.summaries && !benchmarkReport?.competitors?.errors) && (
              <Typography variant="body2" sx={{ color: '#64748b', fontStyle: 'italic' }}>
                Analysis running in background — results will appear here when complete.
              </Typography>
            )}
          </Paper>
        </Box>
      )}

      {/* Strategic Content Opportunities Section */}
      {competitors.length > 0 && (
        <StrategicInsightsSection
          sitemapAnalysis={sitemapAnalysis}
          isAnalyzingSitemap={isAnalyzingSitemap}
          onRefreshStrategy={() => startSitemapAnalysis(true)}
          onShowBenchmarks={() => setShowBenchmarksModal(true)}
          onShowStrategy={() => setShowStrategyModal(true)}
          onShowPublishing={() => setShowPublishingModal(true)}
          onShowStructure={() => setShowStructureModal(true)}
        />
      )}

      {/* Insight Modals */}
      <InsightsModals
        sitemapAnalysis={sitemapAnalysis}
        showBenchmarks={showBenchmarksModal}
        showStrategy={showStrategyModal}
        showPublishing={showPublishingModal}
        showStructure={showStructureModal}
        onCloseBenchmarks={() => setShowBenchmarksModal(false)}
        onCloseStrategy={() => setShowStrategyModal(false)}
        onClosePublishing={() => setShowPublishingModal(false)}
        onCloseStructure={() => setShowStructureModal(false)}
      />

      {/* Progress Modal */}
      <ProgressModal
        open={showProgressModal}
        progress={analysisProgress}
        step={analysisStep}
      />

      {/* Competitor analysis modal — shows the full data persisted by the backend */}
      <Dialog
        open={showHighlightsModal}
        onClose={() => setShowHighlightsModal(false)}
        maxWidth="md"
        fullWidth
      >
        {selectedCompetitor && (
          <>
            <DialogTitle>
              <Typography variant="h6" component="span" fontWeight={700} sx={{ color: '#0B1220' }}>
                {selectedCompetitor.title || selectedCompetitor.domain}
              </Typography>
              <Typography variant="caption" component="div" sx={{ color: '#6B7280', mt: 0.5 }}>
                {selectedCompetitor.domain}
              </Typography>
            </DialogTitle>
            <DialogContent dividers>
              <Stack spacing={2.5}>
                {/* Top-line chips */}
                <Box display="flex" gap={1} flexWrap="wrap">
                  <Chip
                    size="small"
                    label={`${Math.round(selectedCompetitor.relevance_score * 100)}% match`}
                    sx={{ bgcolor: '#f0fdf4', color: '#15803d', fontWeight: 600, border: '1px solid #bbf7d0' }}
                  />
                  {selectedCompetitor.competitive_insights?.threat_level && (
                    <Chip
                      size="small"
                      label={`Threat: ${selectedCompetitor.competitive_insights.threat_level}`}
                      sx={{
                        bgcolor:
                          selectedCompetitor.competitive_insights.threat_level === 'high'
                            ? '#fef2f2' : selectedCompetitor.competitive_insights.threat_level === 'low'
                            ? '#f0fdf4' : '#fffbeb',
                        color:
                          selectedCompetitor.competitive_insights.threat_level === 'high'
                            ? '#b91c1c' : selectedCompetitor.competitive_insights.threat_level === 'low'
                            ? '#15803d' : '#b45309',
                        fontWeight: 600,
                        border: '1px solid',
                        borderColor:
                          selectedCompetitor.competitive_insights.threat_level === 'high'
                            ? '#fecaca' : selectedCompetitor.competitive_insights.threat_level === 'low'
                            ? '#bbf7d0' : '#fde68a',
                      }}
                    />
                  )}
                  {selectedCompetitor.published_date && (
                    <Chip
                      size="small"
                      label={`Published: ${new Date(selectedCompetitor.published_date).toLocaleDateString()}`}
                      variant="outlined"
                      sx={{ fontSize: '0.7rem', height: 22, borderColor: '#E5E7EB', color: '#6B7280' }}
                    />
                  )}
                </Box>

                {/* Summary */}
                {selectedCompetitor.summary && (
                  <Box>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#0B1220', mb: 0.5 }}>
                      Summary
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#4B5563' }}>
                      {selectedCompetitor.summary}
                    </Typography>
                  </Box>
                )}

                {/* Business / audience / market share */}
                <Box>
                  <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#0B1220', mb: 0.5 }}>
                    Business & Audience
                  </Typography>
                  <Box display="flex" gap={1} flexWrap="wrap">
                    {selectedCompetitor.competitive_insights?.business_model &&
                      selectedCompetitor.competitive_insights.business_model !== 'unknown' && (
                        <Chip size="small" label={`Model: ${selectedCompetitor.competitive_insights.business_model}`} variant="outlined" sx={{ fontSize: '0.72rem', borderColor: '#d1d5db', color: '#374151' }} />
                      )}
                    {selectedCompetitor.competitive_insights?.target_audience &&
                      selectedCompetitor.competitive_insights.target_audience !== 'unknown' && (
                        <Chip size="small" label={`Audience: ${selectedCompetitor.competitive_insights.target_audience}`} variant="outlined" sx={{ fontSize: '0.72rem', borderColor: '#d1d5db', color: '#374151' }} />
                      )}
                    {selectedCompetitor.competitive_insights?.market_share_estimate &&
                      selectedCompetitor.competitive_insights.market_share_estimate !== 'unknown' && (
                        <Chip size="small" label={`Market share: ${selectedCompetitor.competitive_insights.market_share_estimate}`} variant="outlined" sx={{ fontSize: '0.72rem', borderColor: '#d1d5db', color: '#374151' }} />
                      )}
                  </Box>
                </Box>

                {/* Strengths */}
                {selectedCompetitor.competitive_insights.competitive_strengths &&
                  selectedCompetitor.competitive_insights.competitive_strengths.length > 0 && (
                    renderStringList('Competitive Strengths', selectedCompetitor.competitive_insights.competitive_strengths)
                  )}

                {/* Weaknesses */}
                {selectedCompetitor.competitive_insights.competitive_weaknesses &&
                  selectedCompetitor.competitive_insights.competitive_weaknesses.length > 0 && (
                    renderStringList('Competitive Weaknesses', selectedCompetitor.competitive_insights.competitive_weaknesses)
                  )}

                {/* Differentiation opportunities */}
                {selectedCompetitor.competitive_insights.differentiation_opportunities &&
                  selectedCompetitor.competitive_insights.differentiation_opportunities.length > 0 && (
                    renderStringList('Differentiation Opportunities', selectedCompetitor.competitive_insights.differentiation_opportunities)
                  )}

                {/* Market positioning */}
                {selectedCompetitor.market_positioning && (
                  <Box>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#0B1220', mb: 0.5 }}>
                      Market Positioning
                    </Typography>
                    <Box display="flex" gap={1} flexWrap="wrap">
                      {Object.entries(selectedCompetitor.market_positioning)
                        .filter(([, v]) => v && v !== 'unknown')
                        .map(([k, v]) => (
                          <Chip key={k} size="small" label={`${labelify(k)}: ${v}`} variant="outlined" sx={{ fontSize: '0.72rem', borderColor: '#d1d5db', color: '#374151' }} />
                        ))}
                      {(!selectedCompetitor.market_positioning || 
                        !Object.values(selectedCompetitor.market_positioning).some((v) => v && v !== 'unknown')) && (
                        <Typography variant="body2" color="text.secondary">No market positioning data available.</Typography>
                      )}
                    </Box>
                  </Box>
                )}

                {/* Content insights */}
                {selectedCompetitor.content_insights && (
                  <Box>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#0B1220', mb: 0.5 }}>
                      Content Insights
                    </Typography>
                    <Box display="flex" gap={1} flexWrap="wrap">
                      {selectedCompetitor.content_insights.content_focus && (
                        <Chip size="small" label={`Focus: ${selectedCompetitor.content_insights.content_focus}`} variant="outlined" sx={{ fontSize: '0.72rem', borderColor: '#d1d5db', color: '#374151' }} />
                      )}
                      {selectedCompetitor.content_insights.target_audience && (
                        <Chip size="small" label={`Audience: ${selectedCompetitor.content_insights.target_audience}`} variant="outlined" sx={{ fontSize: '0.72rem', borderColor: '#d1d5db', color: '#374151' }} />
                      )}
                      {selectedCompetitor.content_insights.content_quality && (
                        <Chip size="small" label={`Quality: ${selectedCompetitor.content_insights.content_quality}`} variant="outlined" sx={{ fontSize: '0.72rem', borderColor: '#d1d5db', color: '#374151' }} />
                      )}
                      {selectedCompetitor.content_insights.publishing_frequency && (
                        <Chip size="small" label={`Frequency: ${selectedCompetitor.content_insights.publishing_frequency}`} variant="outlined" sx={{ fontSize: '0.72rem', borderColor: '#d1d5db', color: '#374151' }} />
                      )}
                    </Box>
                    {selectedCompetitor.content_insights.content_types &&
                      selectedCompetitor.content_insights.content_types.length > 0 && (
                      <Typography variant="body2" sx={{ color: '#4B5563', mt: 0.75 }}>
                        <strong>Content types:</strong> {selectedCompetitor.content_insights.content_types.join(', ')}
                      </Typography>
                    )}
                  </Box>
                )}

                <Divider />

                {/* Highlights */}
                <Box>
                  <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#0B1220', mb: 0.5 }}>
                    Key Highlights
                  </Typography>
                  {selectedCompetitor.highlights && selectedCompetitor.highlights.length > 0 ? (
                    <Box>
                      {selectedCompetitor.highlights.map((highlight, index) => (
                        <Box
                          key={index}
                          sx={{
                            p: 1.5,
                            mb: 1,
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: 1,
                            backgroundColor: 'background.paper'
                          }}
                        >
                          <Typography variant="body2" color="text.secondary">{highlight}</Typography>
                        </Box>
                      ))}
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary">No highlights available.</Typography>
                  )}
                </Box>

                {/* Subpages */}
                {selectedCompetitor.subpages && selectedCompetitor.subpages.length > 0 && (
                  <Box>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#0B1220', mb: 0.5 }}>
                      Subpages ({selectedCompetitor.subpages.length})
                    </Typography>
                    <Stack spacing={0.5}>
                      {selectedCompetitor.subpages.map((sp, i) => (
                        <Typography key={i} variant="body2" sx={{ color: '#4B5563', wordBreak: 'break-all' }}>
                          • {sp}
                        </Typography>
                      ))}
                    </Stack>
                  </Box>
                )}
              </Stack>
            </DialogContent>
          </>
        )}
      </Dialog>

      <ResearchStepBackgroundSetupModal
        open={backgroundSetupOpen}
        onClose={() => setBackgroundSetupOpen(false)}
      />

      <SifIndexingPanel />

    </Box>
  );
};

export default CompetitorAnalysisStep;
