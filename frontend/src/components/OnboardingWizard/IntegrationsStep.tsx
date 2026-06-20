import React, { useState, useEffect, useCallback } from 'react';
import { useUser } from '@clerk/clerk-react';
import {
  Box,
  Fade,
  Snackbar,
  Typography,
  Paper,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
  // FormLabel,
  Card,
  CardContent,
  Alert,
  Chip
} from '@mui/material';
import {
  ArrowForward as ArrowForwardIcon,
  // ExpandMore as ExpandMoreIcon,
  // ExpandLess as ExpandLessIcon,
  PlayArrow as PlayArrowIcon,
  // Social Media Icons
  Facebook as FacebookIcon,
  Twitter as TwitterIcon,
  Instagram as InstagramIcon,
  LinkedIn as LinkedInIcon,
  YouTube as YouTubeIcon,
  VideoLibrary as TikTokIcon,
  Pinterest as PinterestIcon,
  // Platform Icons
  Web as WordPressIcon,
  Web as WixIcon,
  Google as GoogleIcon,
  Analytics as AnalyticsIcon,
  // UI Icons
  Psychology as PsychologyIcon,
  AutoAwesome as AutoAwesomeIcon,
  Lightbulb as LightbulbIcon,
  CheckCircle as CheckCircleIcon,
  // Error as ErrorIcon
} from '@mui/icons-material';
import { motion } from 'framer-motion';

// Import refactored components
import EmailSection from './common/EmailSection';
import PlatformSection from './common/PlatformSection';
import BenefitsSummary from './common/BenefitsSummary';
import ComingSoonSection from './common/ComingSoonSection';
import { useWordPressOAuth } from '../../hooks/useWordPressOAuth';
import { useWixConnection } from '../../hooks/useWixConnection';
import { useBingOAuth } from '../../hooks/useBingOAuth';
import { useGSCConnection } from './common/useGSCConnection';
import { usePlatformConnections } from './common/usePlatformConnections';
import PlatformAnalytics from '../shared/PlatformAnalytics';
import { cachedAnalyticsAPI } from '../../api/cachedAnalytics';

interface IntegrationsStepProps {
  onContinue: () => void;
  updateHeaderContent: (content: { title: string; description: string }) => void;
  onValidationChange?: (isValid: boolean) => void;
  onDataChange?: (data: any) => void;
}

interface IntegrationPlatform {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: 'website' | 'social' | 'analytics';
  status: 'available' | 'connected' | 'coming_soon' | 'disabled';
  features: string[];
  benefits: string[];
  oauthUrl?: string;
  isEnabled: boolean;
  tooltip?: string;
}

const IntegrationsStep: React.FC<IntegrationsStepProps> = ({ onContinue, updateHeaderContent, onValidationChange, onDataChange }) => {
  const { user } = useUser();
  const [email, setEmail] = useState<string>('');
  const [oauthError, setOauthError] = useState<string | null>(null);
  
  // Use custom hooks
  const { gscSites, connectedPlatforms, setConnectedPlatforms, handleGSCConnect } = useGSCConnection();

  // Invalidate analytics cache when platform connections change
  const invalidateAnalyticsCache = useCallback(() => {
    cachedAnalyticsAPI.invalidateAll();
  }, []);

  // Force refresh analytics data (bypass cache)
  /* const forceRefreshAnalytics = useCallback(async () => {
    try {
      // Clear all cache first
      cachedAnalyticsAPI.clearCache();
      
      // Force refresh platform status
      await cachedAnalyticsAPI.forceRefreshPlatformStatus();
      
      // Force refresh analytics data
      await cachedAnalyticsAPI.forceRefreshAnalyticsData(['bing', 'gsc']);
      
    } catch (error) {
      console.error('IntegrationsStep: Error force refreshing analytics:', error);
    }
  }, []); */
  const { isLoading, showToast, setShowToast, toastMessage, handleConnect } = usePlatformConnections();
  
  // WordPress OAuth hook
  const { connected: wordpressConnected, sites: wordpressSites } = useWordPressOAuth();
  
  // Bing OAuth hook
  const { connected: bingConnected, sites: bingSites, connect: connectBing, refreshStatus: refreshBingStatus } = useBingOAuth();

  // Hardcoded value-prop copy for each platform.
  // oneLiner = short value prop shown under the name.
  // tooltip   = longer "what this unlocks" text behind a hover ⓘ.
  const INTEGRATION_COPY: Record<string, { oneLiner: string; tooltip: string }> = {
    wix: {
      oneLiner: 'Publish posts directly to your Wix site.',
      tooltip: 'Auto-publish blog posts to your Wix site, sync media, and use Wix SEO settings to optimize each post before it goes live.',
    },
    wordpress: {
      oneLiner: 'Publish posts directly to your WordPress site.',
      tooltip: 'Secure OAuth login to WordPress.com or self-hosted sites. Push drafts, manage media, and apply SEO meta from ALwrity in one click.',
    },
    gsc: {
      oneLiner: 'See what people search before they find you.',
      tooltip: 'Powers AI Visibility, Search Console insights, and the SEO agent. We use cached GSC data to find low-CTR pages, striking-distance queries, and cannibalization.',
    },
    bing: {
      oneLiner: 'Add Bing search data to your SEO picture.',
      tooltip: 'Complements GSC with Bing search performance, index coverage, and crawl stats. Cached for fast, quota-safe weekly recommendations.',
    },
    facebook: {
      oneLiner: 'Schedule and publish Facebook posts.',
      tooltip: 'Connect a Facebook Page to schedule posts, recycle top performers, and pull engagement metrics back into your dashboard.',
    },
    twitter: {
      oneLiner: 'Schedule and publish tweets.',
      tooltip: 'Connect an X account to schedule threads, monitor trends, and track engagement on every post you publish from ALwrity.',
    },
    linkedin: {
      oneLiner: 'Publish to your personal profile or company page.',
      tooltip: 'Great for B2B. Schedule posts, run AI-drafted articles, and pull network analytics. Uses your Step 4 persona to keep tone on-brand.',
    },
    instagram: {
      oneLiner: 'Schedule and publish Instagram posts.',
      tooltip: 'Connect an Instagram Business account to schedule feed posts, manage captions with your persona, and pull reach and engagement metrics.',
    },
    youtube: {
      oneLiner: 'Optimize videos and pull channel analytics.',
      tooltip: 'Pull view, watch-time, and CTR data for your YouTube channel. Video SEO and thumbnail suggestions are on the roadmap.',
    },
    tiktok: {
      oneLiner: 'Pull TikTok performance and trends.',
      tooltip: 'Pull video performance and trend data once TikTok connectors ship. Roadmap: trend-aware short-form repurposing from your best posts.',
    },
    pinterest: {
      oneLiner: 'Schedule pins and pull Pinterest analytics.',
      tooltip: 'Connect a Pinterest Business account to schedule pins and boards, and pull impression and click metrics into your dashboard.',
    },
  };

  // Initialize integrations data
  const [integrations] = useState<IntegrationPlatform[]>([
    // Website Platforms
    {
      id: 'wix',
      name: 'Wix',
      description: INTEGRATION_COPY.wix.oneLiner,
      icon: <WixIcon />,
      category: 'website',
      status: 'available',
      features: ['Auto-publish content', 'Analytics tracking', 'SEO optimization'],
      benefits: ['Direct publishing to your Wix site', 'Content performance insights', 'Automated SEO optimization'],
      oauthUrl: '/api/oauth/wix/connect',
      isEnabled: true
    },
    {
      id: 'wordpress',
      name: 'WordPress',
      description: INTEGRATION_COPY.wordpress.oneLiner,
      icon: <WordPressIcon />,
      category: 'website',
      status: 'available',
      features: ['OAuth authentication', 'Auto-publish content', 'Media management', 'SEO optimization'],
      benefits: ['Secure OAuth connection', 'Direct publishing to WordPress', 'Media library integration', 'Advanced SEO features'],
      isEnabled: true
    },
    // Analytics Platforms
    {
      id: 'gsc',
      name: 'Google Search Console',
      description: INTEGRATION_COPY.gsc.oneLiner,
      icon: <GoogleIcon />,
      category: 'analytics',
      status: 'available',
      features: ['Search performance data', 'Keyword insights', 'Content optimization'],
      benefits: ['Real-time SEO metrics', 'Keyword performance tracking', 'Content gap analysis'],
      oauthUrl: '/gsc/auth/url',
      isEnabled: true
    },
    {
      id: 'bing',
      name: 'Bing Webmaster Tools',
      description: INTEGRATION_COPY.bing.oneLiner,
      icon: <AnalyticsIcon />,
      category: 'analytics',
      status: 'available',
      features: ['Bing search performance', 'SEO insights', 'Index status monitoring'],
      benefits: ['Bing search analytics', 'SEO optimization insights', 'Search engine visibility tracking'],
      oauthUrl: '/bing/auth/url',
      isEnabled: true
    },
    // Social Media Platforms
    {
      id: 'facebook',
      name: 'Facebook',
      description: INTEGRATION_COPY.facebook.oneLiner,
      icon: <FacebookIcon />,
      category: 'social',
      status: 'coming_soon',
      features: ['Auto-posting', 'Engagement tracking', 'Content optimization'],
      benefits: ['Automated Facebook posts', 'Engagement analytics', 'Content performance insights'],
      isEnabled: false
    },
    {
      id: 'twitter',
      name: 'Twitter',
      description: INTEGRATION_COPY.twitter.oneLiner,
      icon: <TwitterIcon />,
      category: 'social',
      status: 'coming_soon',
      features: ['Auto-tweeting', 'Trend analysis', 'Engagement tracking'],
      benefits: ['Automated Twitter posts', 'Trend monitoring', 'Audience insights'],
      isEnabled: false
    },
    {
      id: 'linkedin',
      name: 'LinkedIn',
      description: INTEGRATION_COPY.linkedin.oneLiner,
      icon: <LinkedInIcon />,
      category: 'social',
      status: 'coming_soon',
      features: ['Professional posting', 'Network insights', 'Content optimization'],
      benefits: ['LinkedIn article publishing', 'Professional network analytics', 'B2B content insights'],
      isEnabled: false
    },
    {
      id: 'instagram',
      name: 'Instagram',
      description: INTEGRATION_COPY.instagram.oneLiner,
      icon: <InstagramIcon />,
      category: 'social',
      status: 'coming_soon',
      features: ['Visual content posting', 'Story management', 'Engagement tracking'],
      benefits: ['Instagram post automation', 'Visual content optimization', 'Story insights'],
      isEnabled: false
    },
    {
      id: 'youtube',
      name: 'YouTube',
      description: INTEGRATION_COPY.youtube.oneLiner,
      icon: <YouTubeIcon />,
      category: 'social',
      status: 'coming_soon',
      features: ['Video optimization', 'Thumbnail generation', 'Analytics tracking'],
      benefits: ['Video SEO optimization', 'Thumbnail automation', 'YouTube analytics'],
      isEnabled: false
    },
    {
      id: 'tiktok',
      name: 'TikTok',
      description: INTEGRATION_COPY.tiktok.oneLiner,
      icon: <TikTokIcon />,
      category: 'social',
      status: 'coming_soon',
      features: ['Trend analysis', 'Content optimization', 'Performance tracking'],
      benefits: ['TikTok trend insights', 'Content performance analytics', 'Viral content optimization'],
      isEnabled: false
    },
    {
      id: 'pinterest',
      name: 'Pinterest',
      description: INTEGRATION_COPY.pinterest.oneLiner,
      icon: <PinterestIcon />,
      category: 'social',
      status: 'coming_soon',
      features: ['Pin optimization', 'Board management', 'Visual analytics'],
      benefits: ['Pinterest pin automation', 'Visual content strategy', 'Pin performance insights'],
      isEnabled: false
    }
  ]);

  useEffect(() => {
    updateHeaderContent({
      title: 'Connect Your Platforms',
      description: 'Plug in the sites and channels you publish to. Everything is optional — connect what you have now, and add the rest later in Settings.'
    });
  }, [updateHeaderContent]);

  // Handle WordPress connection status changes
  useEffect(() => {
    
    if (wordpressConnected && wordpressSites.length > 0) {
      if (!connectedPlatforms.includes('wordpress')) {
        setConnectedPlatforms([...connectedPlatforms, 'wordpress']);
        invalidateAnalyticsCache();
      }
    } else if (!wordpressConnected && connectedPlatforms.includes('wordpress')) {
      // WordPress is disconnected, remove from connected platforms
      setConnectedPlatforms(connectedPlatforms.filter(platform => platform !== 'wordpress'));
      invalidateAnalyticsCache();
    }
  }, [wordpressConnected, wordpressSites, connectedPlatforms, setConnectedPlatforms, invalidateAnalyticsCache]);

  useEffect(() => {
    (async () => {
      try {
        await refreshBingStatus();
      } catch (e) {
        console.error('Failed to refresh Bing status:', e);
        setOauthError('Could not verify Bing connection status.');
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle Bing connection status changes
  useEffect(() => {
    
    if (bingConnected && bingSites.length > 0) {
      if (!connectedPlatforms.includes('bing')) {
        setConnectedPlatforms([...connectedPlatforms, 'bing']);
        invalidateAnalyticsCache();
      }
    } else if (!bingConnected && connectedPlatforms.includes('bing')) {
      setConnectedPlatforms(connectedPlatforms.filter(platform => platform !== 'bing'));
      invalidateAnalyticsCache();
    }
  }, [bingConnected, bingSites, connectedPlatforms, setConnectedPlatforms, invalidateAnalyticsCache]);

  // Handle OAuth callback parameters (legacy support)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const wordpressConnected = urlParams.get('wordpress_connected');
    const blogUrl = urlParams.get('blog_url');
    const error = urlParams.get('error');

    if (wordpressConnected === 'true' && blogUrl) {
      // WordPress OAuth successful
      setConnectedPlatforms([...connectedPlatforms, 'wordpress']);
      // Remove query parameters from URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (error) {
      console.error('WordPress OAuth error:', error);
      setOauthError('WordPress connection failed. Please try again.');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Get user email from Clerk
  useEffect(() => {
    if (user) {
      const primaryEmail = user.primaryEmailAddress?.emailAddress;
      const firstEmail = user.emailAddresses?.[0]?.emailAddress;
      const resolvedEmail = primaryEmail || firstEmail || '';
      
      if (resolvedEmail) {
        setEmail(resolvedEmail);
      }
    }
  }, [user]);

  const handlePlatformConnect = async (platformId: string) => {
    if (platformId === 'gsc') {
      await handleGSCConnect();
    } else if (platformId === 'bing') {
      try {
        await connectBing();
      } catch (error) {
        console.error('Bing connection failed:', error);
        setOauthError('Bing connection failed. Please try again.');
      }
    } else {
      await handleConnect(platformId);
    }
  };

  // Filter platforms by category
  const websitePlatforms = integrations.filter(p => p.category === 'website');
  const analyticsPlatforms = integrations.filter(p => p.category === 'analytics');
  const socialPlatforms = integrations.filter(p => p.category === 'social');

  // Attach hardcoded tooltip text to each platform for the card UI.
  const withTooltip = (list: IntegrationPlatform[]) =>
    list.map(p => ({ ...p, tooltip: INTEGRATION_COPY[p.id]?.tooltip || p.tooltip }));


  // Primary Site Selection State
  const [primarySite, setPrimarySite] = useState<string>('');

  // Get sites from hooks for the memo
  const { sites: wixSites, connected: wixConnected } = useWixConnection();

  // Live status per platform, derived from the existing OAuth hooks (no new API calls).
  // Source of truth per platform:
  //   - gsc:    connectedPlatforms includes 'gsc' (set by useGSCConnection after getStatus)
  //   - bing:   bingConnected (from useBingOAuth)
  //   - wix:    wixConnected  (from useWixConnection)
  //   - wp:     wordpressConnected (from useWordPressOAuth)
  // needs_reauth = local state thinks connected but underlying hook says not connected
  //                (e.g. cached flag survived but token was revoked server-side).
  const liveStatus: Record<string, IntegrationPlatform['status']> = {
    gsc: connectedPlatforms.includes('gsc') ? 'connected' : 'available',
    bing: bingConnected ? 'connected' : 'available',
    wix: wixConnected ? 'connected' : 'available',
    wordpress: wordpressConnected ? 'connected' : 'available',
    facebook: 'coming_soon',
    twitter: 'coming_soon',
    linkedin: 'coming_soon',
    instagram: 'coming_soon',
    youtube: 'coming_soon',
    tiktok: 'coming_soon',
    pinterest: 'coming_soon',
  };

  // Platforms that are actually connectable today (not coming_soon).
  const CONNECTABLE_IDS = ['gsc', 'bing', 'wix', 'wordpress'] as const;
  const connectedCount = CONNECTABLE_IDS.filter(id => liveStatus[id] === 'connected').length;
  const allConnectableEmpty = connectedCount === 0;

  // Per-platform readiness row data: icon, display name, and a 1-line hint
  // shown in the readiness panel for both connected and not-connected states.
  const READINESS_ROWS: Record<string, { name: string; icon: React.ReactNode; connectedHint: string; disconnectedHint: string }> = {
    gsc: {
      name: 'Google Search Console',
      icon: <GoogleIcon sx={{ fontSize: 18 }} />,
      connectedHint: 'Powers SEO agent and AI Visibility.',
      disconnectedHint: 'Connect for search analytics and SEO suggestions.',
    },
    bing: {
      name: 'Bing Webmaster Tools',
      icon: <AnalyticsIcon sx={{ fontSize: 18 }} />,
      connectedHint: 'Adds Bing data to your SEO picture.',
      disconnectedHint: 'Connect to add Bing search data.',
    },
    wix: {
      name: 'Wix',
      icon: <WixIcon sx={{ fontSize: 18 }} />,
      connectedHint: 'Ready to publish posts to your Wix site.',
      disconnectedHint: 'Connect to publish directly to Wix.',
    },
    wordpress: {
      name: 'WordPress',
      icon: <WordPressIcon sx={{ fontSize: 18 }} />,
      connectedHint: 'Ready to publish posts to your WordPress site.',
      disconnectedHint: 'Connect to publish directly to WordPress.',
    },
  };
  
  const availableSites = React.useMemo(() => {
    const sites: { url: string; source: string; name: string }[] = [];
    
    if (wixConnected && wixSites.length > 0) {
      sites.push(...wixSites.map(s => ({ 
        url: s.blog_url, 
        source: 'Wix',
        name: 'Wix Site'
      })));
    }
    
    if (wordpressConnected && wordpressSites.length > 0) {
      sites.push(...wordpressSites.map(s => ({ 
        url: s.blog_url, 
        source: 'WordPress',
        name: 'WordPress Site'
      })));
    }
    
    return sites;
  }, [wixConnected, wixSites, wordpressConnected, wordpressSites]);

  useEffect(() => {
    if (!onDataChange) {
      return;
    }

    const websiteIntegrations = {
      wix: wixConnected ? wixSites.map(s => ({ url: s.blog_url, name: 'Wix Site' })) : [],
      wordpress: wordpressConnected ? wordpressSites.map(s => ({ url: s.blog_url, name: 'WordPress Site' })) : [],
      primaryWebsite: primarySite || null,
    };

    const analyticsIntegrations = {
      gsc: {
        connected: connectedPlatforms.includes('gsc'),
        sites: (gscSites || []).map((site: any) => ({
          siteUrl: site.siteUrl || site.site_url || '',
        })),
      },
      bing: {
        connected: connectedPlatforms.includes('bing') || !!bingConnected,
        sites: (bingSites || []).map((site: any) => ({
          siteUrl: site.siteUrl || site.site_url || '',
        })),
      },
    };

    const socialIntegrations = {
      facebook: connectedPlatforms.includes('facebook'),
      twitter: connectedPlatforms.includes('twitter'),
      linkedin: connectedPlatforms.includes('linkedin'),
      instagram: connectedPlatforms.includes('instagram'),
      youtube: connectedPlatforms.includes('youtube'),
      tiktok: connectedPlatforms.includes('tiktok'),
      pinterest: connectedPlatforms.includes('pinterest'),
    };

    onDataChange({
      integrations: {
        primaryWebsite: websiteIntegrations.primaryWebsite,
        websitePlatforms: websiteIntegrations,
        analyticsPlatforms: analyticsIntegrations,
        socialPlatforms: socialIntegrations,
        connectedPlatforms,
        updatedAt: new Date().toISOString(),
      },
    });
  }, [
    onDataChange,
    primarySite,
    wixConnected,
    wixSites,
    wordpressConnected,
    wordpressSites,
    gscSites,
    bingConnected,
    bingSites,
    connectedPlatforms,
  ]);

  // Default to first site
  useEffect(() => {
    if (availableSites.length > 0 && !primarySite) {
      setPrimarySite(availableSites[0].url);
    }
  }, [availableSites, primarySite]);

  // Save primary site when selected
  useEffect(() => {
    if (primarySite) {
      localStorage.setItem('primary_website', primarySite);
    }
  }, [primarySite]);

  // Validation Effect
  useEffect(() => {
    if (onValidationChange) {
      // Valid if:
      // 1. No sites available (user can proceed without site)
      // 2. Sites available AND primarySite selected
      const isValid = availableSites.length === 0 || !!primarySite;
      onValidationChange(isValid);
    }
  }, [availableSites.length, primarySite, onValidationChange]);

  const [walkthroughStep, setWalkthroughStep] = useState<number>(0);
  const walkthroughTitles: string[] = [
    'Connect your platforms',
    'We cache your insights',
    'Agents analyze weekly',
    'We propose clear fixes',
    'You review and publish',
  ];
  const walkthroughDescriptions: string[] = [
    'Link Google Search Console and Bing to unlock search signals for your site.',
    'We safely store key metrics so recommendations are quick and quota‑friendly.',
    'SIF agents look for low‑CTR pages, striking‑distance wins, declines, and overlaps.',
    'You’ll see simple suggestions: better titles/meta, refreshes, and consolidations.',
    'Pick what you like and publish; we keep the rhythm going week after week.',
  ];
  const walkthroughLabels: string[] = ['Step 1 of 5', 'Step 2 of 5', 'Step 3 of 5', 'Step 4 of 5', 'Step 5 of 5'];

  useEffect(() => {
    const id = setInterval(() => {
      setWalkthroughStep(prev => (prev + 1) % walkthroughTitles.length);
    }, 4500);
    return () => clearInterval(id);
  }, [walkthroughTitles.length]);

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', p: { xs: 1, sm: 2, md: 3 } }}>
      {/* Email Address Section */}
      <EmailSection email={email} onEmailChange={setEmail} />

      {/* OAuth Error Alert */}
      {oauthError && (
        <Fade in timeout={500}>
          <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setOauthError(null)}>
            {oauthError}
          </Alert>
        </Fade>
      )}

      {/* Website Platforms */}
      <Fade in timeout={800}>
        <div>
          <Box sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>
              All integrations are optional. Connect what you have now — you can add the rest anytime in Settings.
            </Typography>
            <Chip
              size="small"
              icon={<CheckCircleIcon sx={{ fontSize: 16 }} />}
              label={`${connectedCount} of ${CONNECTABLE_IDS.length} connectable platforms connected`}
              sx={{
                ml: 'auto',
                bgcolor: allConnectableEmpty ? '#f1f5f9' : '#ecfdf5',
                color: allConnectableEmpty ? '#475569' : '#065f46',
                fontWeight: 700,
                '& .MuiChip-icon': { color: 'inherit' }
              }}
            />
          </Box>
          <PlatformSection
            title="Website Platforms"
            description="Publish blog posts and pages directly to your site."
            platforms={withTooltip(websitePlatforms)}
            connectedPlatforms={connectedPlatforms}
            gscSites={null}
            isLoading={isLoading}
            onConnect={handlePlatformConnect}
            onDisconnect={(platformId) => {
              setConnectedPlatforms(connectedPlatforms.filter(p => p !== platformId));
            }}
            setConnectedPlatforms={setConnectedPlatforms}
            liveStatus={liveStatus}
          />
        </div>
      </Fade>

      {/* Primary Site Selection */}
      <Fade in timeout={900}>
        <Box sx={{ mt: 3 }}>
          <Paper 
            elevation={2} 
            sx={{ 
              p: 3, 
              borderRadius: 2,
              background: 'linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)',
              border: '1px solid',
              borderColor: primarySite ? '#86efac' : '#e2e8f0'
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Box 
                  sx={{ 
                    width: 40, 
                    height: 40, 
                    borderRadius: '50%', 
                    bgcolor: primarySite ? '#dcfce7' : '#f1f5f9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mr: 2
                  }}
                >
                  <LightbulbIcon sx={{ color: primarySite ? '#22c55e' : '#94a3b8' }} />
                </Box>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 600, color: '#1e293b' }}>
                    Primary Website Selection
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#64748b' }}>
                    Select your primary website for content publishing
                  </Typography>
                </Box>
              </Box>
              
              {/* Green/Red Indicator */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box
                  sx={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    bgcolor: primarySite ? '#22c55e' : '#ef4444',
                    boxShadow: primarySite ? '0 0 0 4px #dcfce7' : '0 0 0 4px #fee2e2'
                  }}
                />
                <Typography variant="caption" sx={{ fontWeight: 600, color: primarySite ? '#15803d' : '#b91c1c' }}>
                  {primarySite ? 'Primary Set' : 'Selection Required'}
                </Typography>
              </Box>
            </Box>

            {availableSites.length > 0 ? (
              <FormControl component="fieldset" sx={{ width: '100%', mt: 1 }}>
                <RadioGroup
                  value={primarySite}
                  onChange={(e) => setPrimarySite(e.target.value)}
                >
                  {availableSites.map((site, index) => (
                    <Card 
                      key={index} 
                      variant="outlined" 
                      sx={{ 
                        mb: 1.5, 
                        borderColor: primarySite === site.url ? '#22c55e' : '#e2e8f0',
                        bgcolor: primarySite === site.url ? '#f0fdf4' : '#ffffff',
                        transition: 'all 0.2s',
                        '&:hover': { borderColor: '#22c55e' }
                      }}
                    >
                      <CardContent sx={{ p: '12px !important', '&:last-child': { pb: '12px !important' } }}>
                        <FormControlLabel
                          value={site.url}
                          control={<Radio size="small" sx={{ color: primarySite === site.url ? '#22c55e' : undefined, '&.Mui-checked': { color: '#22c55e' } }} />}
                          label={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                              <Typography variant="body2" sx={{ fontWeight: 600, color: '#334155' }}>
                                {site.url ? site.url.replace(/^https?:\/\//, '') : 'No URL'}
                              </Typography>
                              <Chip 
                                label={site.source} 
                                size="small" 
                                sx={{ 
                                  height: 20, 
                                  fontSize: '0.65rem', 
                                  fontWeight: 600,
                                  bgcolor: site.source === 'Wix' ? '#000000' : '#21759b',
                                  color: '#ffffff'
                                }} 
                              />
                            </Box>
                          }
                          sx={{ width: '100%', m: 0 }}
                        />
                      </CardContent>
                    </Card>
                  ))}
                </RadioGroup>
              </FormControl>
            ) : (
              <Alert severity="warning" sx={{ mt: 1, borderRadius: 2 }}>
                No connected websites found. Please connect Wix or WordPress to continue.
              </Alert>
            )}
          </Paper>
        </Box>
      </Fade>

      {/* Analytics Platforms */}
      <Fade in timeout={1000}>
        <div>
          <PlatformSection
            title="Analytics & SEO"
            description="Plug in search data so the SEO and Content agents have real signals to work with."
            platforms={withTooltip(analyticsPlatforms)}
            connectedPlatforms={connectedPlatforms}
            gscSites={gscSites}
                  isLoading={isLoading}
            onConnect={handlePlatformConnect}
                  liveStatus={liveStatus}
                />
        </div>
      </Fade>

      {/* Analytics Data Display */}
      {connectedPlatforms.length > 0 && (
        <Fade in timeout={1200}>
          <div>
            <Paper 
              elevation={2} 
              sx={{ 
                mt: 3, 
                p: 3, 
                borderRadius: 2,
                background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)'
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <AnalyticsIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
                  Platform Analytics
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
                Here's what data is available from your connected platforms:
              </Typography>
              
              <PlatformAnalytics 
                platforms={connectedPlatforms.filter(p => ['gsc', 'bing'].includes(p))}
                showSummary={true}
                refreshInterval={connectedPlatforms.some(p => ['gsc', 'bing'].includes(p)) ? 300000 : 0} // 5 minutes, only if connected
                onDataLoaded={(data) => {
                  // Data loaded silently
                }}
                onRefreshReady={(refreshFn) => {
                  // Store refresh function if needed
                }}
              />
            </Paper>
          </div>
        </Fade>
      )}

      {/* Data-Readiness Panel — honest state of the 4 connectable platforms */}
      <Fade in timeout={1100}>
        <Paper
          elevation={1}
          sx={{
            mt: 3,
            p: { xs: 2, md: 2.5 },
            borderRadius: 2,
            border: '1px solid',
            borderColor: connectedCount > 0 ? '#bbf7d0' : '#e2e8f0',
            background: connectedCount > 0
              ? 'linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%)'
              : 'linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                bgcolor: connectedCount > 0 ? '#dcfce7' : '#f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {connectedCount > 0 ? (
                <CheckCircleIcon sx={{ color: '#16a34a' }} />
              ) : (
                <LightbulbIcon sx={{ color: '#94a3b8' }} />
              )}
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0f172a' }}>
                {connectedCount > 0
                  ? `${connectedCount} of ${CONNECTABLE_IDS.length} connectable platforms connected`
                  : 'No platforms connected yet'}
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748b' }}>
                {connectedCount > 0
                  ? 'You can finish onboarding now, or connect more to unlock features.'
                  : 'Finish onboarding to add platforms later in Settings → Integrations.'}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1 }}>
            {CONNECTABLE_IDS.map(id => {
              const row = READINESS_ROWS[id];
              const isConnected = liveStatus[id] === 'connected';
              return (
                <Box
                  key={id}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.25,
                    p: 1.25,
                    borderRadius: 1.5,
                    border: '1px solid',
                    borderColor: isConnected ? '#86efac' : '#e2e8f0',
                    bgcolor: isConnected ? '#f0fdf4' : '#ffffff',
                    transition: 'all 0.2s',
                  }}
                >
                  <Box
                    sx={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      bgcolor: isConnected ? '#dcfce7' : '#f1f5f9',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: isConnected ? '#16a34a' : '#94a3b8',
                      flexShrink: 0,
                    }}
                  >
                    {row.icon}
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#0f172a' }}>
                      {row.name}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>
                      {isConnected ? row.connectedHint : row.disconnectedHint}
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      bgcolor: isConnected ? '#22c55e' : '#cbd5e1',
                      flexShrink: 0,
                    }}
                  />
                </Box>
              );
            })}
          </Box>
        </Paper>
      </Fade>

      {/* Social Media Platforms */}
      <Fade in timeout={1200}>
        <div>
          <PlatformSection
            title="Social Media Platforms"
            description="Schedule posts and pull engagement back into your dashboard."
            platforms={withTooltip(socialPlatforms)}
            connectedPlatforms={connectedPlatforms}
            gscSites={null}
            isLoading={isLoading}
            onConnect={handlePlatformConnect}
            liveStatus={liveStatus}
          />
        </div>
      </Fade>

      {/* Benefits Summary */}
      <Fade in timeout={1400}>
        <div>
        <BenefitsSummary />
        </div>
      </Fade>

      {/* Coming Soon Section */}
      <ComingSoonSection />

      {/* Recommendation Panel */}
      <Fade in timeout={1500}>
        <div>
          <Paper 
            elevation={2} 
            sx={{ 
              mt: 2.5, 
              p: { xs: 2, md: 2.5 }, 
              borderRadius: 2,
              background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
              border: '1px solid #e2e8f0'
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1 }}>
              <AutoAwesomeIcon sx={{ color: '#7c3aed' }} />
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#111827' }}>
                How ALwrity’s SIF Agents Help You Every Week
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ color: '#334155', mb: 1.5 }}>
              Your connected analytics power a helpful weekly routine. Our SIF agent framework reads real search signals and proposes simple, high‑impact actions for your content—no jargon, just clear next steps.
            </Typography>

            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 2 }}>
              <Chip icon={<AnalyticsIcon />} label="Low‑CTR pages" sx={{ bgcolor: '#eef2ff', color: '#312e81', fontWeight: 600 }} />
              <Chip icon={<AnalyticsIcon />} label="Striking‑distance wins" sx={{ bgcolor: '#ecfeff', color: '#075985', fontWeight: 600 }} />
              <Chip icon={<AnalyticsIcon />} label="Declining queries" sx={{ bgcolor: '#f0fdf4', color: '#14532d', fontWeight: 600 }} />
              <Chip icon={<AnalyticsIcon />} label="Cannibalization fixes" sx={{ bgcolor: '#fff7ed', color: '#7c2d12', fontWeight: 600 }} />
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', mb: 2 }}>
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid #e5e7eb', minWidth: 210, textAlign: 'center', bgcolor: '#f9fafb' }}>
                  <Typography variant="caption" sx={{ color: '#334155', fontWeight: 700, display: 'block', mb: 1 }}>
                    GSC & Bing Metrics
                  </Typography>
                  <AnalyticsIcon sx={{ color: '#2563eb' }} />
                  <Typography variant="body2" sx={{ color: '#334155', mt: 1 }}>
                    Clicks, impressions, CTR, positions
                  </Typography>
                </Paper>
              </motion.div>
              <ArrowForwardIcon sx={{ color: '#64748b' }} />
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.05 }}>
                <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid #e5e7eb', minWidth: 210, textAlign: 'center', bgcolor: '#f9fafb' }}>
                  <Typography variant="caption" sx={{ color: '#334155', fontWeight: 700, display: 'block', mb: 1 }}>
                    SIF Agents
                  </Typography>
                  <PsychologyIcon sx={{ color: '#7c3aed' }} />
                  <Typography variant="body2" sx={{ color: '#334155', mt: 1 }}>
                    Turns signals into clear suggestions
                  </Typography>
                </Paper>
              </motion.div>
              <ArrowForwardIcon sx={{ color: '#64748b' }} />
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}>
                <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid #e5e7eb', minWidth: 210, textAlign: 'center', bgcolor: '#f9fafb' }}>
                  <Typography variant="caption" sx={{ color: '#334155', fontWeight: 700, display: 'block', mb: 1 }}>
                    Suggested Actions
                  </Typography>
                  <AutoAwesomeIcon sx={{ color: '#059669' }} />
                  <Typography variant="body2" sx={{ color: '#334155', mt: 1 }}>
                    Better titles/meta, refreshes, consolidations
                  </Typography>
                </Paper>
              </motion.div>
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
              <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.45 }}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    border: '1px solid #e5e7eb',
                    bgcolor: '#f9fafb',
                  }}
                >
                  <Typography variant="subtitle2" sx={{ color: '#111827', fontWeight: 700, mb: 1 }}>
                    Who does what
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
                    <Chip size="small" label="SEO Agent" sx={{ bgcolor: '#eef2ff', color: '#312e81', fontWeight: 700 }} />
                    <Typography variant="body2" sx={{ color: '#334155' }}>
                      Finds low‑CTR pages and striking‑distance queries; suggests title/meta fixes and refreshes.
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip size="small" label="Content Agent" sx={{ bgcolor: '#ecfeff', color: '#075985', fontWeight: 700 }} />
                    <Typography variant="body2" sx={{ color: '#334155' }}>
                      Recommends consolidation and internal links from cannibalization; queues refresh topics.
                    </Typography>
                  </Box>
                </Paper>
              </motion.div>
              <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.45 }}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    border: '1px solid #e5e7eb',
                    bgcolor: '#f9fafb',
                  }}
                >
                  <Typography variant="subtitle2" sx={{ color: '#111827', fontWeight: 700, mb: 1 }}>
                    What you get
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
                    <CheckCircleIcon sx={{ color: '#16a34a' }} />
                    <Typography variant="body2" sx={{ color: '#334155' }}>
                      Clear, bite‑size fixes that improve visibility and clicks.
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
                    <CheckCircleIcon sx={{ color: '#16a34a' }} />
                    <Typography variant="body2" sx={{ color: '#334155' }}>
                      A weekly rhythm that keeps content fresh and organized.
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CheckCircleIcon sx={{ color: '#16a34a' }} />
                    <Typography variant="body2" sx={{ color: '#334155' }}>
                      Caching protects your quota; agents use cached insights, not direct API calls.
                    </Typography>
                  </Box>
                </Paper>
              </motion.div>
            </Box>

            <Box sx={{ mt: 2 }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 1.75,
                    borderRadius: 2,
                    border: '1px solid #e5e7eb',
                    bgcolor: '#f9fafb',
                  }}
                >
                  <Typography variant="subtitle2" sx={{ color: '#111827', fontWeight: 700, mb: 1 }}>
                    Full Flow at a Glance
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap' }}>
                    <Paper
                      elevation={0}
                      sx={{
                        p: 1.25,
                        borderRadius: 2,
                        border: '1px solid #e5e7eb',
                        minWidth: 150,
                        textAlign: 'center',
                        bgcolor: '#ffffff',
                      }}
                    >
                      <Typography variant="caption" sx={{ color: '#334155', fontWeight: 700, display: 'block', mb: 0.5 }}>
                        1. Connect
                      </Typography>
                      <AnalyticsIcon sx={{ color: '#2563eb' }} />
                      <Typography variant="body2" sx={{ color: '#334155', mt: 0.5 }}>
                        GSC & Bing
                      </Typography>
                    </Paper>
                    <ArrowForwardIcon sx={{ color: '#64748b' }} />
                    <Paper
                      elevation={0}
                      sx={{
                        p: 1.25,
                        borderRadius: 2,
                        border: '1px solid #e5e7eb',
                        minWidth: 150,
                        textAlign: 'center',
                        bgcolor: '#ffffff',
                      }}
                    >
                      <Typography variant="caption" sx={{ color: '#334155', fontWeight: 700, display: 'block', mb: 0.5 }}>
                        2. Cache
                      </Typography>
                      <AutoAwesomeIcon sx={{ color: '#0891b2' }} />
                      <Typography variant="body2" sx={{ color: '#334155', mt: 0.5 }}>
                        Fast, quota‑safe
                      </Typography>
                    </Paper>
                    <ArrowForwardIcon sx={{ color: '#64748b' }} />
                    <Paper
                      elevation={0}
                      sx={{
                        p: 1.25,
                        borderRadius: 2,
                        border: '1px solid #e5e7eb',
                        minWidth: 150,
                        textAlign: 'center',
                        bgcolor: '#ffffff',
                      }}
                    >
                      <Typography variant="caption" sx={{ color: '#334155', fontWeight: 700, display: 'block', mb: 0.5 }}>
                        3. Analyze
                      </Typography>
                      <PsychologyIcon sx={{ color: '#7c3aed' }} />
                      <Typography variant="body2" sx={{ color: '#334155', mt: 0.5 }}>
                        SIF agents
                      </Typography>
                    </Paper>
                    <ArrowForwardIcon sx={{ color: '#64748b' }} />
                    <Paper
                      elevation={0}
                      sx={{
                        p: 1.25,
                        borderRadius: 2,
                        border: '1px solid #e5e7eb',
                        minWidth: 150,
                        textAlign: 'center',
                        bgcolor: '#ffffff',
                      }}
                    >
                      <Typography variant="caption" sx={{ color: '#334155', fontWeight: 700, display: 'block', mb: 0.5 }}>
                        4. Suggest
                      </Typography>
                      <AutoAwesomeIcon sx={{ color: '#059669' }} />
                      <Typography variant="body2" sx={{ color: '#334155', mt: 0.5 }}>
                        Clear fixes
                      </Typography>
                    </Paper>
                  </Box>
                </Paper>
                <Paper
                  elevation={0}
                  sx={{
                    p: 1.75,
                    borderRadius: 2,
                    border: '1px solid #e5e7eb',
                    bgcolor: '#f9fafb',
                  }}
                >
                  <Typography variant="subtitle2" sx={{ color: '#111827', fontWeight: 700, mb: 1 }}>
                    Guided Walkthrough
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1.5 }}>
                    <Chip
                      icon={<PlayArrowIcon />}
                      label="Auto walkthrough"
                      sx={{ bgcolor: '#eef2ff', color: '#111827', fontWeight: 700 }}
                    />
                    <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>
                      {walkthroughLabels[walkthroughStep]}
                    </Typography>
                  </Box>
                  <Box sx={{ position: 'relative', minHeight: 120 }}>
                    <motion.div
                      key={`walk-${walkthroughStep}`}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      transition={{ duration: 0.35 }}
                    >
                      <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px dashed #cbd5e1', bgcolor: '#f8fafc' }}>
                        <Typography variant="body2" sx={{ color: '#334155', fontWeight: 600, mb: 0.5 }}>
                          {walkthroughTitles[walkthroughStep]}
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#475569' }}>
                          {walkthroughDescriptions[walkthroughStep]}
                        </Typography>
                      </Paper>
                    </motion.div>
                  </Box>
                </Paper>
              </Box>
            </Box>
          </Paper>
        </div>
      </Fade>


      {/* Success Toast */}
      <Snackbar
        open={showToast}
        autoHideDuration={4000}
        onClose={() => setShowToast(false)}
        message={toastMessage}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{
          '& .MuiSnackbarContent-root': {
            backgroundColor: '#10b981',
            color: 'white',
            fontWeight: 600
          }
        }}
      />
    </Box>
  );
};

export default IntegrationsStep; 
