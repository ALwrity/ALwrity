import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Button,
  Grid,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Tooltip,
  IconButton,
  Collapse
} from '@mui/material';
import {
  Assessment as AssessmentIcon,
  Refresh as RefreshIcon,
  Info as InfoIcon,
  Lightbulb as LightbulbIcon,
  TrendingUp as TrendingUpIcon,
  Search as SearchIcon,
  AutoAwesome as AutoFixHighIcon,
  ExpandLess as ExpandLessIcon
} from '@mui/icons-material';
import { aiApiClient, longRunningApiClient } from '../../api/client';  // Use aiApiClient for long-running operations
import { useOnboardingStyles } from './common/useOnboardingStyles';
import { SocialMediaPresenceSection, CompetitorsGrid } from './WebsiteStep/components';
import type { Competitor } from './WebsiteStep/components';


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
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStep, setAnalysisStep] = useState('');
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [socialMediaAccounts, setSocialMediaAccounts] = useState<any>({});
  const [, setSocialMediaCitations] = useState<any[]>([]);
  const [researchSummary, setResearchSummary] = useState<ResearchSummary | null>(null);
  const [sifInsights, setSifInsights] = useState<any>(null);
  const [sifContentAnalysis, setSifContentAnalysis] = useState<any>(null);
  const [sifRecommendations, setSifRecommendations] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [showHighlightsModal, setShowHighlightsModal] = useState(false);
  const [selectedCompetitorHighlights, setSelectedCompetitorHighlights] = useState<string[]>([]);
  const [selectedCompetitorTitle, setSelectedCompetitorTitle] = useState<string>('');
  const [usingCachedData, setUsingCachedData] = useState(false);
  const [sitemapAnalysis, setSitemapAnalysis] = useState<any>(null);
  const [isAnalyzingSitemap, setIsAnalyzingSitemap] = useState(false);
  const [isDiscoveringSocial, setIsDiscoveringSocial] = useState(false);
  const [showHeaderInfo, setShowHeaderInfo] = useState(false);
  // const [showWhyImportant, setShowWhyImportant] = useState(false);
  const [missingData, setMissingData] = useState(false);
  const [showBenchmarksModal, setShowBenchmarksModal] = useState(false);
  const [showStrategyModal, setShowStrategyModal] = useState(false);
  const [showPublishingModal, setShowPublishingModal] = useState(false);
  const [showStructureModal, setShowStructureModal] = useState(false);

  // Ref to track if initialization has already started to prevent duplicate calls
  const initializationStarted = React.useRef(false);
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

  // Check for missing data
  useEffect(() => {
    // Wait a bit to ensure Wizard has finished initializing its stepData
    const timer = setTimeout(() => {
      const propUserUrl = userUrl || '';
      const localStorageUrl = localStorage.getItem('website_url') || '';
      const sessionStorageUrl = sessionStorage.getItem('website_url') || '';
      const onboardingContextUrl = (window as any).onboardingContext?.websiteUrl || '';
      
      // Also check initialData if available
      const initialDataUrl = initialData?.website || initialData?.website_url || '';
      
      const finalUserUrl = propUserUrl || localStorageUrl || sessionStorageUrl || onboardingContextUrl || initialDataUrl || '';
      
      if (!finalUserUrl) {
        console.warn('CompetitorAnalysisStep: No website URL found (prop, local, session, context, or initialData).');
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


  // Check for cached competitor analysis data
  const loadCachedAnalysis = useCallback(() => {
    try {
      const cachedData = localStorage.getItem('competitor_analysis_data');
      const cachedUrl = localStorage.getItem('competitor_analysis_url') || '';
      const cacheTimestamp = localStorage.getItem('competitor_analysis_timestamp');
      
      // Get current URL for comparison
      const finalUserUrl = userUrl || localStorage.getItem('website_url') || '';
      
      // Helper to normalize URL for comparison (ignore trailing slashes and protocol differences)
      const normalizeUrl = (url: string) => {
        if (!url) return '';
        return url.trim().toLowerCase().replace(/\/$/, '').replace(/^https?:\/\//, '').replace(/^www\./, '');
      };

      if (cachedData && normalizeUrl(cachedUrl) === normalizeUrl(finalUserUrl) && cacheTimestamp) {
        const cacheAge = Date.now() - parseInt(cacheTimestamp);
        const cacheValidDuration = 24 * 60 * 60 * 1000; // 24 hours
        
        // Check if cache is still valid (less than 24 hours old)
        if (cacheAge < cacheValidDuration) {
          const parsedData = JSON.parse(cachedData);
          
          console.log('CompetitorAnalysisStep: Loading cached competitor analysis:', {
            url: cachedUrl,
            currentUrl: finalUserUrl,
            match: 'normalized',
            cacheAge: Math.round(cacheAge / (60 * 1000)),
            competitors: parsedData.competitors?.length || 0
          });
          
          const hasCompetitors = (parsedData.competitors || []).length > 0;
          const hasResearch = !!parsedData.research_summary;

          // Only consider cache valid if it has actual data (avoid stale empty-competitor cache)
          if (hasCompetitors || hasResearch) {
            setCompetitors(parsedData.competitors || []);
            setSocialMediaAccounts(parsedData.social_media_accounts || {});
            setSocialMediaCitations(parsedData.social_media_citations || []);
            setResearchSummary(parsedData.research_summary || null);
            setSifInsights(parsedData.semantic_insights || null);
            setSifContentAnalysis(parsedData.content_analysis || null);
            setSifRecommendations(parsedData.strategic_recommendations || null);
            setSitemapAnalysis(parsedData.sitemap_analysis || null);
            setUsingCachedData(true);
            
            return true; // Successfully loaded from cache
          } else {
            console.log('CompetitorAnalysisStep: Cache has no competitor data, treating as miss');
            localStorage.removeItem('competitor_analysis_data');
            localStorage.removeItem('competitor_analysis_url');
            localStorage.removeItem('competitor_analysis_timestamp');
          }
        } else {
          console.log('CompetitorAnalysisStep: Cache expired, will run fresh analysis');
        }
      } else {
        console.log('CompetitorAnalysisStep: Cache miss or URL mismatch', {
            cachedUrl,
            finalUserUrl,
            hasData: !!cachedData,
            hasTimestamp: !!cacheTimestamp
        });
      }
      
      return false; // No valid cache found
    } catch (err) {
      console.error('Error loading cached analysis:', err);
      return false;
    }
  }, [userUrl]);

  // Update cache with sitemap analysis
  const updateCacheWithSitemapAnalysis = useCallback((sitemapResult: any) => {
    try {
      const cachedData = localStorage.getItem('competitor_analysis_data');
      if (cachedData) {
        const parsedData = JSON.parse(cachedData);
        parsedData.sitemap_analysis = sitemapResult;
        
        localStorage.setItem('competitor_analysis_data', JSON.stringify(parsedData));
        console.log('CompetitorAnalysisStep: Updated cache with sitemap analysis');
      }
    } catch (err) {
      console.warn('Failed to update cache with sitemap analysis:', err);
    }
  }, []);

  const startCompetitorDiscovery = useCallback(async (force = false) => {
    // Check cache first unless forced
    if (!force && loadCachedAnalysis()) {
      console.log('CompetitorAnalysisStep: Using cached competitor analysis');
      return;
    }

    setIsAnalyzing(true);
    setShowProgressModal(true);
    setError(null);
    setAnalysisProgress(0);
    setAnalysisStep('Initializing competitor discovery...');
    setUsingCachedData(false);

    try {
      setAnalysisStep('Validating session...');
      setAnalysisProgress(20);
      await new Promise(resolve => setTimeout(resolve, 500));

      setAnalysisStep('Discovering competitors using AI...');
      setAnalysisProgress(40);
      await new Promise(resolve => setTimeout(resolve, 1000));

      setAnalysisStep('Analyzing competitor content and strategy...');
      setAnalysisProgress(60);
      await new Promise(resolve => setTimeout(resolve, 1500));

      setAnalysisStep('Generating competitive insights...');
      setAnalysisProgress(80);
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Get website URL from multiple sources with better fallbacks
      const propUserUrl = userUrl || '';
      const localStorageUrl = localStorage.getItem('website_url') || '';
      const sessionStorageUrl = sessionStorage.getItem('website_url') || '';
      
      // Try to get from onboarding context or global state
      const onboardingContextUrl = (window as any).onboardingContext?.websiteUrl || '';
      
      const finalUserUrl = propUserUrl || localStorageUrl || sessionStorageUrl || onboardingContextUrl || '';
      
      // Get website analysis data from multiple sources
      const localStorageAnalysis = localStorage.getItem('website_analysis_data');
      const sessionStorageAnalysis = sessionStorage.getItem('website_analysis_data');
      
      let websiteAnalysisData = null;
      if (localStorageAnalysis) {
        try {
          websiteAnalysisData = JSON.parse(localStorageAnalysis);
        } catch (e) {
          console.warn('Failed to parse localStorage website_analysis_data:', e);
        }
      }
      if (!websiteAnalysisData && sessionStorageAnalysis) {
        try {
          websiteAnalysisData = JSON.parse(sessionStorageAnalysis);
        } catch (e) {
          console.warn('Failed to parse sessionStorage website_analysis_data:', e);
        }
      }
      
      console.log('CompetitorAnalysisStep: URL sources debug:', {
        propUserUrl,
        localStorageUrl,
        sessionStorageUrl,
        onboardingContextUrl,
        finalUserUrl,
        hasLocalStorageAnalysis: !!localStorageAnalysis,
        hasSessionStorageAnalysis: !!sessionStorageAnalysis,
        websiteAnalysisData: websiteAnalysisData ? 'present' : 'null'
      });

      console.log('CompetitorAnalysisStep: Making request with data:', {
        user_url: finalUserUrl,
        industry_context: industryContext,
        num_results: 25,
        website_analysis_data: websiteAnalysisData
      });

      // Validate that we have a URL before making the request
      if (!finalUserUrl || finalUserUrl.trim() === '') {
        throw new Error('No website URL available for competitor analysis. Please complete Step 2 (Website Analysis) first.');
      }

      const response = await aiApiClient.post('/api/onboarding/step3/discover-competitors', {
        // session_id removed - backend gets user from auth token
        user_url: finalUserUrl,
        industry_context: industryContext,
        num_results: 25,
        website_analysis_data: websiteAnalysisData
      });

      const result = response.data;

      if (result.success) {
        setAnalysisStep('Finalizing analysis...');
        setAnalysisProgress(100);
        await new Promise(resolve => setTimeout(resolve, 500));

        const analysisData = {
          competitors: result.competitors || [],
          social_media_accounts: result.social_media_accounts || {},
          social_media_citations: result.social_media_citations || [],
          research_summary: result.research_summary || null,
          sitemap_analysis: null // Will be updated when sitemap analysis completes
        };

        setCompetitors(analysisData.competitors);
        const mergedAccounts = mergeCrawlSocialMedia(analysisData.social_media_accounts);
        setSocialMediaAccounts(mergedAccounts);
        setSocialMediaCitations(analysisData.social_media_citations);
        setResearchSummary(analysisData.research_summary);

        // SIF-enhanced semantic intelligence insights
        const sifInsightsData = result.semantic_insights || null;
        const sifContentData = result.content_analysis || null;
        const sifRecommendationsData = result.strategic_recommendations || null;
        setSifInsights(sifInsightsData);
        setSifContentAnalysis(sifContentData);
        setSifRecommendations(sifRecommendationsData);
        
        // Cache the analysis results with merged data
        try {
          localStorage.setItem('competitor_analysis_data', JSON.stringify({
            ...analysisData,
            social_media_accounts: mergedAccounts,
            semantic_insights: sifInsightsData,
            content_analysis: sifContentData,
            strategic_recommendations: sifRecommendationsData
          }));
          localStorage.setItem('competitor_analysis_url', finalUserUrl);
          localStorage.setItem('competitor_analysis_timestamp', Date.now().toString());
          console.log('CompetitorAnalysisStep: Cached competitor analysis for future use');
        } catch (cacheErr) {
          console.warn('Failed to cache competitor analysis:', cacheErr);
        }
        
        setShowProgressModal(false);
        setIsAnalyzing(false);
      } else {
        throw new Error(result.error || 'Competitor discovery failed');
      }
    } catch (err) {
      console.error('Competitor discovery error:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      setIsAnalyzing(false);
      setShowProgressModal(false);
    }
  }, [userUrl, industryContext, loadCachedAnalysis]);  // sessionId removed from dependencies

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
    
    setIsAnalyzingSitemap(true);
    if (force) {
        setSitemapAnalysis(null); // Clear existing data to show loading state
    }
    
    try {
      const finalUserUrl = userUrl || localStorage.getItem('website_url') || '';
      const competitorDomains = competitors.map(c => c.domain).filter(Boolean);
      
      console.log('Starting sitemap analysis for:', finalUserUrl);
      
      const response = await aiApiClient.post('/api/onboarding/step3/analyze-sitemap', {
        user_url: finalUserUrl,
        competitors: competitorDomains,
        industry_context: industryContext,
        analyze_content_trends: true,
        analyze_publishing_patterns: true
      });
      
      const result = response.data;
      
      if (result.success) {
        console.log('Sitemap analysis completed successfully');
        setSitemapAnalysis(result);
        
        // Update cache with sitemap analysis
        updateCacheWithSitemapAnalysis(result);
      } else {
        console.error('Sitemap analysis failed:', result.error);
        setError(result.error || 'Sitemap analysis failed');
      }
    } catch (err) {
      console.error('Sitemap analysis error:', err);
      setError(err instanceof Error ? err.message : 'Sitemap analysis failed');
    } finally {
      setIsAnalyzingSitemap(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userUrl, competitors, industryContext, isAnalyzingSitemap]);

  // Initialize: Check cache first, then run analysis if needed
  useEffect(() => {
    const initialize = async () => {
      // Prevent double-initialization (React Strict Mode or rapid remounts)
      if (initializationStarted.current) {
        console.log('CompetitorAnalysisStep: Initialization already started, skipping duplicate run');
        return;
      }
      initializationStarted.current = true;

      // Extract crawl social media from step 2 for fallback
      const crawlData = initialData?.crawl_social_media || initialData?.crawlResult?.content?.social_media || {};
      if (Object.keys(crawlData).length > 0) {
        console.log('CompetitorAnalysisStep: Loaded crawl social media for fallback:', crawlData);
        crawlSocialMediaRef.current = crawlData;
      }

      // Apply crawl-merged social media accounts from backend (always available since init endpoint fix)
      if (initialData?.social_media_accounts) {
        console.log('CompetitorAnalysisStep: Applying backend social media accounts');
        setSocialMediaAccounts(mergeCrawlSocialMedia(initialData.social_media_accounts));
      }

      // 1. Check for backend competitors data (SSOT)
      if (initialData?.competitors?.length > 0) {
        console.log('CompetitorAnalysisStep: Initializing competitors from backend data');
        setCompetitors(initialData.competitors);
        if (initialData.social_media_citations) setSocialMediaCitations(initialData.social_media_citations);
        if (initialData.researchSummary) setResearchSummary(initialData.researchSummary);
        if (initialData.sitemapAnalysis) setSitemapAnalysis(initialData.sitemapAnalysis);
        setUsingCachedData(true);
        
        // Prime local cache for consistency
        try {
          const analysisData = {
            competitors: initialData.competitors || [],
            social_media_accounts: initialData.social_media_accounts || {},
            social_media_citations: initialData.social_media_citations || [],
            research_summary: initialData.researchSummary || null,
            sitemap_analysis: initialData.sitemapAnalysis || null
          };
          const finalUserUrl = userUrl || localStorage.getItem('website_url') || '';
          localStorage.setItem('competitor_analysis_data', JSON.stringify(analysisData));
          localStorage.setItem('competitor_analysis_url', finalUserUrl);
          localStorage.setItem('competitor_analysis_timestamp', Date.now().toString());
          console.log('CompetitorAnalysisStep: Primed cache from backend data');
        } catch (e) {
          console.warn('Failed to prime cache from backend data', e);
        }
        return;
      }

      // 2. Try to load from cache
      const cacheLoaded = loadCachedAnalysis();
      
      // 3. If no cache found, run fresh analysis
      if (!cacheLoaded) {
        await startCompetitorDiscovery(false);
      }
    };
    
    initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount

  // Auto-trigger sitemap analysis when competitors are loaded (only if not cached)
  useEffect(() => {
    if (competitors.length > 0 && !sitemapAnalysis && !isAnalyzingSitemap) {
      // Check if sitemap analysis is already cached
      const cachedData = localStorage.getItem('competitor_analysis_data');
      if (cachedData) {
        try {
          const parsedData = JSON.parse(cachedData);
          if (parsedData.sitemap_analysis) {
            console.log('CompetitorAnalysisStep: Sitemap analysis already cached, skipping auto-trigger');
            setSitemapAnalysis(parsedData.sitemap_analysis);
            return;
          }
        } catch (err) {
          console.warn('Error checking cached sitemap analysis:', err);
        }
      }
      
      console.log('Competitors loaded, starting sitemap analysis...');
      startSitemapAnalysis();
    }
  }, [competitors, sitemapAnalysis, isAnalyzingSitemap, startSitemapAnalysis]);

  // Data collection function for global Continue button
  const getResearchData = useCallback(() => {
    // Auto-schedule sitemap benchmark if proceeding to next step
    // We fire-and-forget this call to ensure it runs in background
    const validCompetitors = competitors
        .filter(c => c.url && (c.url.startsWith('http') || c.url.startsWith('https')))
        .map(c => c.url);

    longRunningApiClient.post('/api/seo/competitive-sitemap-benchmarking/run', { 
      max_competitors: 5,
      competitors: validCompetitors.slice(0, 5)
    })
      .then(() => console.log('CompetitorAnalysisStep: Auto-scheduled sitemap benchmark'))
      .catch(err => console.warn('CompetitorAnalysisStep: Failed to auto-schedule benchmark (may be running)', err));

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
    setSelectedCompetitorHighlights(competitor.highlights || []);
    setSelectedCompetitorTitle(competitor.title);
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

      {/* SIF Semantic Intelligence Section */}
      {sifInsights && (
        <Box mt={6} mb={4}>
          <Typography variant="h5" fontWeight={600} sx={{ color: '#1a202c !important', display: 'flex', alignItems: 'center', mb: 3 }}>
            <AutoFixHighIcon sx={{ mr: 1, color: '#7C3AED' }} />
            AI Semantic Insights
          </Typography>
          <Grid container spacing={3}>
            {/* Content Pillars */}
            {sifInsights.content_pillars?.length > 0 && (
              <Grid item xs={12} md={4}>
                <Card sx={{ height: '100%', bgcolor: '#f5f3ff', border: '1px solid #ddd6fe' }}>
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight={600} sx={{ color: '#5b21b6', mb: 1 }}>
                      Your Content Pillars
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#7c3aed', mb: 1.5, display: 'block' }}>
                      Topics your site strongly covers — your competitive strengths.
                    </Typography>
                    <Box display="flex" flexDirection="column" gap={1}>
                      {sifInsights.content_pillars.slice(0, 5).map((pillar: any, i: number) => (
                        <Paper key={i} variant="outlined" sx={{ p: 1.5, bgcolor: 'white', borderColor: '#ddd6fe' }}>
                          <Typography variant="body2" fontWeight={500} color="#4c1d95">
                            {pillar.name || pillar.topic || pillar.title || `Pillar ${i + 1}`}
                          </Typography>
                          {pillar.confidence && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                              <Box sx={{ flex: 1, height: 4, borderRadius: 2, bgcolor: '#e9d5ff' }}>
                                <Box sx={{ width: `${Math.round(pillar.confidence * 100)}%`, height: 4, borderRadius: 2, bgcolor: '#7c3aed' }} />
                              </Box>
                              <Typography variant="caption" color="#6b7280">{Math.round(pillar.confidence * 100)}%</Typography>
                            </Box>
                          )}
                        </Paper>
                      ))}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            )}

            {/* Semantic Gaps */}
            {sifInsights.semantic_gaps?.length > 0 && (
              <Grid item xs={12} md={4}>
                <Card sx={{ height: '100%', bgcolor: '#fffbeb', border: '1px solid #fde68a' }}>
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight={600} sx={{ color: '#92400e', mb: 1 }}>
                      Content Gaps & Opportunities
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#b45309', mb: 1.5, display: 'block' }}>
                      Topics competitors cover that you don't — prime content opportunities.
                    </Typography>
                    <Box display="flex" flexDirection="column" gap={1}>
                      {sifInsights.semantic_gaps.slice(0, 5).map((gap: any, i: number) => (
                        <Paper key={i} variant="outlined" sx={{ p: 1.5, bgcolor: 'white', borderColor: '#fde68a' }}>
                          <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                            <Typography variant="body2" fontWeight={500} color="#92400e">
                              {gap.topic || gap.gap || `Gap ${i + 1}`}
                            </Typography>
                            {gap.priority && (
                              <Chip
                                label={gap.priority}
                                size="small"
                                sx={{
                                  fontSize: '0.65rem',
                                  fontWeight: 600,
                                  bgcolor: gap.priority === 'high' ? '#fef2f2' : '#fffbeb',
                                  color: gap.priority === 'high' ? '#991b1b' : '#92400e',
                                  border: `1px solid ${gap.priority === 'high' ? '#fecaca' : '#fde68a'}`
                                }}
                              />
                            )}
                          </Box>
                          {gap.reason && (
                            <Typography variant="caption" color="#78716c" sx={{ mt: 0.5, display: 'block' }}>
                              {gap.reason}
                            </Typography>
                          )}
                          {gap.confidence && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                              <Box sx={{ flex: 1, height: 4, borderRadius: 2, bgcolor: '#fef3c7' }}>
                                <Box sx={{ width: `${Math.round(gap.confidence * 100)}%`, height: 4, borderRadius: 2, bgcolor: '#d97706' }} />
                              </Box>
                              <Typography variant="caption" color="#6b7280">{Math.round(gap.confidence * 100)}%</Typography>
                            </Box>
                          )}
                        </Paper>
                      ))}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            )}

            {/* Strategic Recommendations */}
            {sifRecommendations && sifRecommendations.length > 0 && (
              <Grid item xs={12} md={4}>
                <Card sx={{ height: '100%', bgcolor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight={600} sx={{ color: '#166534', mb: 1 }}>
                      Recommended Actions
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#16a34a', mb: 1.5, display: 'block' }}>
                      Prioritized steps to strengthen your content strategy.
                    </Typography>
                    <Box display="flex" flexDirection="column" gap={1}>
                      {sifRecommendations.slice(0, 5).map((rec: any, i: number) => (
                        <Paper key={i} variant="outlined" sx={{ p: 1.5, bgcolor: 'white', borderColor: '#bbf7d0' }}>
                          <Box display="flex" alignItems="flex-start" gap={1}>
                            <Box sx={{ width: 20, height: 20, borderRadius: '50%', bgcolor: '#22c55e', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0, mt: 0.25 }}>
                              {i + 1}
                            </Box>
                            <Box>
                              <Typography variant="body2" fontWeight={500} color="#166534">
                                {rec.title || `Recommendation ${i + 1}`}
                              </Typography>
                              {rec.description && (
                                <Typography variant="caption" color="#6b7280" sx={{ mt: 0.25, display: 'block' }}>
                                  {rec.description}
                                </Typography>
                              )}
                              {rec.action_items?.length > 0 && (
                                <Box component="ul" sx={{ mt: 0.5, mb: 0, pl: 1.5 }}>
                                  {rec.action_items.slice(0, 3).map((action: string, j: number) => (
                                    <Box component="li" key={j} sx={{ typography: 'caption', color: '#78716c', '&::marker': { color: '#86efac' } }}>
                                      {action}
                                    </Box>
                                  ))}
                                </Box>
                              )}
                            </Box>
                          </Box>
                          {rec.priority && (
                            <Chip
                              label={rec.priority}
                              size="small"
                              sx={{ mt: 0.5, fontSize: '0.65rem', fontWeight: 600, bgcolor: rec.priority === 'high' ? '#fef2f2' : rec.priority === 'medium' ? '#fffbeb' : '#f0fdf4', color: rec.priority === 'high' ? '#991b1b' : rec.priority === 'medium' ? '#92400e' : '#166534' }}
                            />
                          )}
                        </Paper>
                      ))}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            )}
          </Grid>

          {/* Content Analysis Stats Footer */}
          {sifContentAnalysis && (
            <Box mt={2} sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'center' }}>
              {sifContentAnalysis.user_pages_analyzed > 0 && (
                <Chip icon={<AutoFixHighIcon fontSize="small" />} label={`${sifContentAnalysis.user_pages_analyzed} user pages analyzed`} size="small" variant="outlined" sx={{ color: '#6b7280', borderColor: '#d1d5db' }} />
              )}
              {sifContentAnalysis.competitor_pages_analyzed > 0 && (
                <Chip icon={<SearchIcon fontSize="small" />} label={`${sifContentAnalysis.competitor_pages_analyzed} competitor pages analyzed`} size="small" variant="outlined" sx={{ color: '#6b7280', borderColor: '#d1d5db' }} />
              )}
            </Box>
          )}
        </Box>
      )}

      {/* Strategic Content Opportunities Section */}
      {(sitemapAnalysis || isAnalyzingSitemap) && (
        <Box mt={6} mb={4}>
          {/* Header */}
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
            <Tooltip title="Based on competitor analysis, these are specific recommendations to improve your SEO and content strategy.">
              <Typography variant="h5" fontWeight={600} sx={{ color: '#1a202c !important', display: 'flex', alignItems: 'center', cursor: 'help' }}>
                <LightbulbIcon sx={{ mr: 1, color: '#f59e0b' }} />
                Strategic Content Opportunities
                <InfoIcon sx={{ ml: 1, fontSize: 20, color: 'text.disabled' }} />
              </Typography>
            </Tooltip>
            <Button
              variant="outlined"
              size="small"
              startIcon={isAnalyzingSitemap ? <CircularProgress size={16} color="inherit" /> : <RefreshIcon />}
              onClick={() => startSitemapAnalysis(true)}
              disabled={isAnalyzingSitemap}
              sx={{ borderColor: '#667eea', color: '#667eea', textTransform: 'none', '&:hover': { borderColor: '#5a6fd8', bgcolor: 'rgba(102,126,234,0.04)' } }}
            >
              {isAnalyzingSitemap ? 'Refreshing...' : 'Refresh Strategy'}
            </Button>
          </Box>

          {isAnalyzingSitemap ? (
            <Paper sx={{ p: 4, textAlign: 'center', bgcolor: '#f8fafc', borderStyle: 'dashed', borderColor: '#cbd5e0' }}>
              <CircularProgress size={24} sx={{ mb: 2 }} />
              <Typography color="text.secondary">Analyzing competitive landscape for opportunities...</Typography>
            </Paper>
          ) : (
            <Box>
              {/* 1. Your Competitive Position */}
              {sitemapAnalysis?.analysis_data?.onboarding_insights?.competitive_positioning && (
                <Paper sx={{ p: 3, mb: 3, bgcolor: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                    <Box sx={{ p: 1, bgcolor: 'white', borderRadius: '50%', color: '#0284c7', flexShrink: 0 }}>
                      <AssessmentIcon />
                    </Box>
                    <Box>
                      <Typography variant="subtitle1" fontWeight={600} color="#0c4a6e" gutterBottom>
                        Your Competitive Position
                      </Typography>
                      <Typography variant="body2" color="#0c4a6e">
                        {sitemapAnalysis.analysis_data.onboarding_insights.competitive_positioning}
                      </Typography>
                    </Box>
                  </Box>
                </Paper>
              )}

              <Grid container spacing={3}>
                {/* 2. Topics to Create */}
                <Grid item xs={12} md={6}>
                  <Card sx={{ height: '100%', bgcolor: '#fffbeb', border: '1px solid #fde68a' }}>
                    <CardContent>
                      <Typography variant="h6" sx={{ color: '#92400e', display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <AutoFixHighIcon fontSize="small" sx={{ color: '#f59e0b' }} /> Topics to Create
                      </Typography>
                      <Typography variant="body2" sx={{ mb: 2, color: '#78716c' }}>
                        Subjects your competitors cover that you don't yet — create content on these to capture new audience segments.
                      </Typography>
                      {sitemapAnalysis?.analysis_data?.onboarding_insights?.content_gaps?.length > 0 ? (
                        <Box display="flex" flexWrap="wrap" gap={1}>
                          {sitemapAnalysis.analysis_data.onboarding_insights.content_gaps.map((gap: string, i: number) => (
                            <Chip key={i} label={gap} size="small" sx={{ bgcolor: 'white', border: '1px solid #fde68a', fontWeight: 500 }} />
                          ))}
                        </Box>
                      ) : (
                        <Typography variant="caption" fontStyle="italic" color="#78716c">No gaps detected yet.</Typography>
                      )}
                    </CardContent>
                  </Card>
                </Grid>

                {/* 3. Growth Moves */}
                <Grid item xs={12} md={6}>
                  <Card sx={{ height: '100%', bgcolor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                    <CardContent>
                      <Typography variant="h6" sx={{ color: '#166534', display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <TrendingUpIcon fontSize="small" sx={{ color: '#22c55e' }} /> Growth Moves
                      </Typography>
                      <Typography variant="body2" sx={{ mb: 2, color: '#6b7280' }}>
                        Prioritized actions to improve your content strategy and organic reach.
                      </Typography>
                      {(() => {
                        const ACTION_VERBS = ['Target', 'Expand', 'Create', 'Build', 'Optimize', 'Capture', 'Scale', 'Launch'];
                        const growthMoves = [
                          ...(sitemapAnalysis?.analysis_data?.onboarding_insights?.growth_opportunities || []),
                          ...(sitemapAnalysis?.analysis_data?.onboarding_insights?.strategic_recommendations || []).slice(0, 2)
                        ];
                        return growthMoves.length > 0 ? (
                          <List dense disablePadding>
                            {growthMoves.map((move: string, i: number) => (
                              <ListItem key={i} disableGutters sx={{ py: 0.5 }}>
                                <ListItemIcon sx={{ minWidth: 28 }}>
                                  <Box sx={{ width: 20, height: 20, borderRadius: '50%', bgcolor: '#22c55e', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
                                    {i + 1}
                                  </Box>
                                </ListItemIcon>
                                <ListItemText primary={`${ACTION_VERBS[i % ACTION_VERBS.length]} ${move}`} primaryTypographyProps={{ variant: 'body2', color: '#166534' }} />
                              </ListItem>
                            ))}
                          </List>
                        ) : (
                          <Typography variant="caption" fontStyle="italic" color="#6b7280">Generating recommendations...</Typography>
                        );
                      })()}
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {/* 4. Deeper Insights — secondary buttons */}
              <Box mt={3}>
                <Typography variant="caption" color="text.disabled" sx={{ display: 'block', textAlign: 'center', mb: 1, fontSize: '0.7rem', letterSpacing: 1 }}>
                  DEEPER INSIGHTS
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center' }}>
                  {sitemapAnalysis?.analysis_data?.onboarding_insights?.industry_benchmarks?.length > 0 && (
                    <Button size="small" variant="outlined" onClick={() => setShowBenchmarksModal(true)} startIcon={<AssessmentIcon />} sx={{ color: '#64748b', borderColor: '#cbd5e1', textTransform: 'none', fontSize: '0.75rem' }}>
                      Industry Benchmarks
                    </Button>
                  )}
                  {sitemapAnalysis?.analysis_data?.ai_insights?.content_strategy?.length > 0 && (
                    <Button size="small" variant="outlined" onClick={() => setShowStrategyModal(true)} startIcon={<LightbulbIcon />} sx={{ color: '#64748b', borderColor: '#cbd5e1', textTransform: 'none', fontSize: '0.75rem' }}>
                      Content Strategy & SEO
                    </Button>
                  )}
                  {sitemapAnalysis?.analysis_data?.content_trends?.trends?.length > 0 && (
                    <Button size="small" variant="outlined" onClick={() => setShowPublishingModal(true)} startIcon={<TrendingUpIcon />} sx={{ color: '#64748b', borderColor: '#cbd5e1', textTransform: 'none', fontSize: '0.75rem' }}>
                      Publishing Patterns
                    </Button>
                  )}
                  {sitemapAnalysis?.analysis_data?.structure_analysis?.keyword_clusters && Object.keys(sitemapAnalysis.analysis_data.structure_analysis.keyword_clusters).length > 0 && (
                    <Button size="small" variant="outlined" onClick={() => setShowStructureModal(true)} startIcon={<SearchIcon />} sx={{ color: '#64748b', borderColor: '#cbd5e1', textTransform: 'none', fontSize: '0.75rem' }}>
                      Topics Your Site Covers
                    </Button>
                  )}
                </Box>
              </Box>
            </Box>
          )}
        </Box>
      )}

      {/* Industry Benchmarks Modal */}
      <Dialog
        open={showBenchmarksModal}
        onClose={() => setShowBenchmarksModal(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ pb: 2 }}>
          <Typography variant="h6" fontWeight={600}>Industry Benchmarks</Typography>
        </DialogTitle>
        <DialogContent>
          {sitemapAnalysis?.analysis_data?.onboarding_insights?.industry_benchmarks?.map((benchmark: string, i: number) => (
            <Paper key={i} variant="outlined" sx={{ p: 1.5, mb: 1.5, bgcolor: '#f8fafc', display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#94a3b8', flexShrink: 0 }} />
              <Typography variant="body2" color="#334155">{benchmark}</Typography>
            </Paper>
          ))}
        </DialogContent>
      </Dialog>

      {/* Content Strategy & SEO Modal */}
      <Dialog open={showStrategyModal} onClose={() => setShowStrategyModal(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ pb: 2 }}>
          <Typography variant="h6" fontWeight={600}>Content Strategy & SEO Insights</Typography>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontSize: '0.85rem' }}>
            Actionable recommendations from AI analysis of your site structure and competitor landscape.
          </Typography>
          {sitemapAnalysis?.analysis_data?.ai_insights?.content_strategy?.length > 0 && (
            <Box mb={2}>
              <Typography variant="subtitle2" fontWeight={600} color="#0c4a6e" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <LightbulbIcon sx={{ fontSize: 16, color: '#f59e0b' }} /> Content Strategy
              </Typography>
              <List dense disablePadding>
                {sitemapAnalysis.analysis_data.ai_insights.content_strategy.map((item: string, i: number) => (
                  <ListItem key={i} disableGutters sx={{ py: 0.25 }}>
                    <ListItemIcon sx={{ minWidth: 24 }}><Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: '#94a3b8' }} /></ListItemIcon>
                    <ListItemText primary={item} primaryTypographyProps={{ variant: 'body2', color: '#334155' }} />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}
          {sitemapAnalysis?.analysis_data?.ai_insights?.seo_opportunities?.length > 0 && (
            <Box>
              <Typography variant="subtitle2" fontWeight={600} color="#0c4a6e" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <SearchIcon sx={{ fontSize: 16, color: '#0284c7' }} /> SEO Opportunities
              </Typography>
              <List dense disablePadding>
                {sitemapAnalysis.analysis_data.ai_insights.seo_opportunities.map((item: string, i: number) => (
                  <ListItem key={i} disableGutters sx={{ py: 0.25 }}>
                    <ListItemIcon sx={{ minWidth: 24 }}><Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: '#94a3b8' }} /></ListItemIcon>
                    <ListItemText primary={item} primaryTypographyProps={{ variant: 'body2', color: '#334155' }} />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}
        </DialogContent>
      </Dialog>

      {/* Publishing Patterns Modal */}
      <Dialog open={showPublishingModal} onClose={() => setShowPublishingModal(false)} maxWidth="md" fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}>
        <DialogTitle sx={{ pb: 1.5, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
          <Typography variant="h6" fontWeight={700} sx={{ color: '#0f172a' }}>Publishing Patterns &amp; Trends</Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 2.5, bgcolor: '#ffffff' }}>
          <Typography variant="body2" sx={{ mb: 2.5, color: '#475569', fontSize: '0.85rem' }}>
            How often you publish, when content was created, and optimization opportunities found in your sitemap.
          </Typography>

          {/* Velocity + Date range side by side */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2.5 }}>
            {sitemapAnalysis?.analysis_data?.content_trends?.publishing_velocity != null && (
              <Paper variant="outlined" sx={{ flex: 1, minWidth: 140, p: 2, textAlign: 'center', bgcolor: '#f0f9ff', borderColor: '#bae6fd' }}>
                <Typography variant="h4" sx={{ color: '#0369a1', fontWeight: 700 }}>
                  {typeof sitemapAnalysis.analysis_data.content_trends.publishing_velocity === 'number'
                    ? sitemapAnalysis.analysis_data.content_trends.publishing_velocity.toFixed(2)
                    : sitemapAnalysis.analysis_data.content_trends.publishing_velocity}
                </Typography>
                <Typography variant="caption" sx={{ color: '#475569' }}>Posts per day</Typography>
              </Paper>
            )}
            {sitemapAnalysis?.analysis_data?.content_trends?.date_range?.span_days != null && (
              <Paper variant="outlined" sx={{ flex: 1, minWidth: 140, p: 2, textAlign: 'center', bgcolor: '#fef2f2', borderColor: '#fecaca' }}>
                <Typography variant="h4" sx={{ color: '#b91c1c', fontWeight: 700 }}>
                  {sitemapAnalysis.analysis_data.content_trends.date_range.span_days}
                </Typography>
                <Typography variant="caption" sx={{ color: '#475569' }}>Days of content history</Typography>
              </Paper>
            )}
            {sitemapAnalysis?.analysis_data?.structure_analysis?.total_urls != null && (
              <Paper variant="outlined" sx={{ flex: 1, minWidth: 140, p: 2, textAlign: 'center', bgcolor: '#f0fdf4', borderColor: '#bbf7d0' }}>
                <Typography variant="h4" sx={{ color: '#15803d', fontWeight: 700 }}>
                  {sitemapAnalysis.analysis_data.structure_analysis.total_urls}
                </Typography>
                <Typography variant="caption" sx={{ color: '#475569' }}>Total URLs in sitemap</Typography>
              </Paper>
            )}
          </Box>

          {/* Trends */}
          {sitemapAnalysis?.analysis_data?.content_trends?.trends?.length > 0 && (
            <Box mb={2.5}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#0f172a', mb: 1 }}>Trends</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                {sitemapAnalysis.analysis_data.content_trends.trends.map((item: string, i: number) => (
                  <Paper key={i} variant="outlined" sx={{ p: 1.5, bgcolor: '#ffffff', borderColor: '#e2e8f0', display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#3b82f6', flexShrink: 0 }} />
                    <Typography variant="body2" sx={{ color: '#1e293b' }}>{item}</Typography>
                  </Paper>
                ))}
              </Box>
            </Box>
          )}

          {/* Optimization Opportunities */}
          {sitemapAnalysis?.analysis_data?.publishing_patterns?.optimization_opportunities?.length > 0 && (
            <Box mb={2.5}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#0f172a', mb: 1 }}>Sitemap Optimization Tips</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                {sitemapAnalysis.analysis_data.publishing_patterns.optimization_opportunities.map((item: string, i: number) => (
                  <Paper key={i} variant="outlined" sx={{ p: 1.5, bgcolor: '#fffbeb', borderColor: '#fde68a', display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#d97706', flexShrink: 0 }} />
                    <Typography variant="body2" sx={{ color: '#92400e' }}>{item}</Typography>
                  </Paper>
                ))}
              </Box>
            </Box>
          )}

          {/* Competitors Analyzed */}
          {sitemapAnalysis?.analysis_data?.competitors_analyzed?.length > 0 && (
            <Box>
              <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#0f172a', mb: 1 }}>Competitors Compared</Typography>
              <Box display="flex" flexWrap="wrap" gap={0.75}>
                {sitemapAnalysis.analysis_data.competitors_analyzed.map((domain: string, i: number) => (
                  <Chip key={i} label={domain} size="small" sx={{ bgcolor: '#f1f5f9', color: '#334155', fontWeight: 500 }} />
                ))}
              </Box>
            </Box>
          )}
        </DialogContent>
      </Dialog>

      {/* Site Structure Modal */}
      <Dialog open={showStructureModal} onClose={() => setShowStructureModal(false)} maxWidth="md" fullWidth
        PaperProps={{ sx: { borderRadius: 2, bgcolor: '#ffffff' } }}>
        <DialogTitle sx={{ pb: 1.5, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
          <Typography variant="h6" fontWeight={700} sx={{ color: '#0f172a' }}>Topics Your Site Covers</Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 2.5, bgcolor: '#ffffff' }}>
          <Typography variant="body2" sx={{ mb: 2.5, color: '#475569', fontSize: '0.85rem' }}>
            A high-contrast snapshot of the main topics, content pillars, and structure quality found across your website.
          </Typography>

          {/* Top Topics — light high-contrast chips */}
          {sitemapAnalysis?.analysis_data?.structure_analysis?.keyword_clusters && (
            <Box mb={2.5}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#0f172a', mb: 1 }}>Top Topics</Typography>
              <Box display="flex" flexWrap="wrap" gap={0.75}>
                {Object.entries(sitemapAnalysis.analysis_data.structure_analysis.keyword_clusters).map(([topic, count]: [string, any], i: number) => (
                  <Chip key={i} label={`${topic} (${count})`} size="small" sx={{ bgcolor: '#eef2ff', color: '#4338ca', border: '1px solid #c7d2fe', fontWeight: 600 }} />
                ))}
              </Box>
            </Box>
          )}

          {/* Content Mix — high contrast progress bars */}
          {sitemapAnalysis?.analysis_data?.structure_analysis?.strategic_pillars && (
            <Box mb={2.5}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#0f172a', mb: 1.5 }}>Content Mix</Typography>
              {(() => {
                const entries = Object.entries(sitemapAnalysis.analysis_data.structure_analysis.strategic_pillars);
                const maxCount = Math.max(...entries.map(([, c]) => c as number), 1);
                return (
                  <Box display="flex" flexDirection="column" gap={1.25}>
                    {entries.map(([pillar, count]: [string, any], i: number) => (
                      <Box key={i}>
                        <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
                          <Typography variant="body2" fontWeight={600} sx={{ color: '#1e293b' }}>{pillar}</Typography>
                          <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 500 }}>{count} URLs</Typography>
                        </Box>
                        <Box sx={{ width: '100%', height: 10, bgcolor: '#f1f5f9', borderRadius: 5, overflow: 'hidden' }}>
                          <Box sx={{ width: `${((count as number) / maxCount) * 100}%`, height: '100%', bgcolor: '#6366f1', borderRadius: 5 }} />
                        </Box>
                      </Box>
                    ))}
                  </Box>
                );
              })()}
            </Box>
          )}

          {/* Structure Quality — high contrast green */}
          {sitemapAnalysis?.analysis_data?.structure_analysis?.structure_quality && (
            <Paper variant="outlined" sx={{ p: 2, bgcolor: '#f0fdf4', border: '1px solid #86efac', borderRadius: 2 }}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#166534', mb: 0.5 }}>Structure Quality</Typography>
              <Typography variant="body2" sx={{ color: '#15803d' }}>{sitemapAnalysis.analysis_data.structure_analysis.structure_quality}</Typography>
            </Paper>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={showProgressModal}
        onClose={() => {}}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            p: 3
          }
        }}
      >
        <DialogTitle sx={{ textAlign: 'center', pb: 2 }}>
          <Box display="flex" alignItems="center" justifyContent="center" gap={2}>
            <CircularProgress size={32} color="primary" />
            <Typography variant="h6" fontWeight={600}>
              Analyzing Your Competition
            </Typography>
          </Box>
        </DialogTitle>
        
        <DialogContent sx={{ textAlign: 'center', pt: 2 }}>
          <Typography variant="body1" color="text.secondary" mb={3}>
            We're discovering your competitors and analyzing their strategies using AI...
          </Typography>
          
          <Box mb={3}>
            <LinearProgress 
              variant="determinate" 
              value={analysisProgress} 
              sx={{ 
                height: 8, 
                borderRadius: 4,
                mb: 2
              }} 
            />
            <Typography variant="body2" color="text.secondary">
              {analysisProgress}% Complete
            </Typography>
          </Box>
          
          <Typography variant="body2" color="primary" fontWeight={500}>
            {analysisStep}
          </Typography>
        </DialogContent>
      </Dialog>

      {/* Highlights Modal */}
      <Dialog 
        open={showHighlightsModal} 
        onClose={() => setShowHighlightsModal(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Typography variant="h6" fontWeight={600}>
            Key Highlights - {selectedCompetitorTitle}
          </Typography>
        </DialogTitle>
        <DialogContent>
          {selectedCompetitorHighlights.length > 0 ? (
            <Box>
              {selectedCompetitorHighlights.map((highlight, index) => (
                <Box 
                  key={index} 
                  sx={{ 
                    p: 2, 
                    mb: 2, 
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    backgroundColor: 'background.paper'
                  }}
                >
                  <Typography variant="body2" color="text.secondary">
                    {highlight}
                  </Typography>
                </Box>
              ))}
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No highlights available for this competitor.
            </Typography>
          )}
        </DialogContent>
      </Dialog>

    </Box>
  );
};

export default CompetitorAnalysisStep;
