import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Snackbar,
  Fade,
  Paper,
  Chip,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Google as GoogleIcon,
  Analytics as AnalyticsIcon,
  Web as WordPressIcon,
  Web as WixIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import PlatformSection from '../../common/PlatformSection';
import { usePlatformConnections } from '../../common/usePlatformConnections';
import { useGSCConnection } from '../../common/useGSCConnection';
import { useWordPressOAuth } from '../../../../hooks/useWordPressOAuth';
import { useWixConnection } from '../../../../hooks/useWixConnection';
import { useBingOAuth } from '../../../../hooks/useBingOAuth';
import { cachedAnalyticsAPI } from '../../../../api/cachedAnalytics';

interface IntegrationData {
  primaryWebsite: string | null;
  websitePlatforms: {
    wix: { url: string; name: string }[];
    wordpress: { url: string; name: string }[];
    primaryWebsite: string | null;
  };
  analyticsPlatforms: {
    gsc: { connected: boolean; sites: { siteUrl: string }[] };
    bing: { connected: boolean; sites: { siteUrl: string }[] };
  };
  connectedPlatforms: string[];
  updatedAt: string;
}

interface WebsiteIntegrationsSectionProps {
  websiteUrl: string;
  onIntegrationChange: (data: IntegrationData) => void;
  connectedPlatforms: string[];
  setConnectedPlatforms: React.Dispatch<React.SetStateAction<string[]>>;
}

const WALKTHROUGH_TITLES: readonly string[] = [
  'Connect your platforms',
  'We cache your insights',
  'Agents analyze weekly',
  'We propose clear fixes',
  'You review and publish',
];
const WALKTHROUGH_DESCRIPTIONS: readonly string[] = [
  'Link Google Search Console and Bing to unlock search signals for your site.',
  'We safely store key metrics so recommendations are quick and quota-friendly.',
  'SIF agents look for low-CTR pages, striking-distance wins, declines, and overlaps.',
  'You will see simple suggestions: better titles/meta, refreshes, and consolidations.',
  'Pick what you like and publish; we keep the rhythm going week after week.',
];
const WALKTHROUGH_LABELS: readonly string[] = [
  'Step 1 of 5',
  'Step 2 of 5',
  'Step 3 of 5',
  'Step 4 of 5',
  'Step 5 of 5',
];

const WebsiteIntegrationsSection: React.FC<WebsiteIntegrationsSectionProps> = ({
  websiteUrl,
  onIntegrationChange,
  connectedPlatforms,
  setConnectedPlatforms,
}) => {
  const { gscSites, connectedPlatforms: gscInternalPlatforms, handleGSCConnect } = useGSCConnection();
  const { isLoading, showToast, setShowToast, toastMessage, handleConnect } = usePlatformConnections();
  const { connected: wordpressConnected, sites: wordpressSites } = useWordPressOAuth();
  const { connected: bingConnected, sites: bingSites, connect: connectBing, refreshStatus: refreshBingStatus } = useBingOAuth();
  const { connected: wixConnected, sites: wixSites } = useWixConnection();
  const [walkthroughStep, setWalkthroughStep] = useState<number>(0);
  const [walkthroughPaused, setWalkthroughPaused] = useState<boolean>(false);

  const invalidateAnalyticsCache = useCallback(() => {
    cachedAnalyticsAPI.invalidateAll();
  }, []);

  // Refresh Bing status on mount
  useEffect(() => {
    (async () => {
      try {
        await refreshBingStatus();
      } catch (e) {
        console.error('Failed to refresh Bing status:', e);
      }
    })();
  }, [refreshBingStatus]);

  // Consolidate platform sync: WordPress, Bing, and GSC all follow the same pattern
  useEffect(() => {
    const updated = [...connectedPlatforms];
    let changed = false;

    const sync = (platformId: string, isConnected: boolean, hasSites: boolean) => {
      if (isConnected && hasSites) {
        if (!updated.includes(platformId)) {
          updated.push(platformId);
          changed = true;
        }
      } else if (!isConnected && updated.includes(platformId)) {
        updated.splice(updated.indexOf(platformId), 1);
        changed = true;
      }
    };

    sync('wordpress', wordpressConnected, wordpressSites.length > 0);
    sync('bing', bingConnected, bingSites.length > 0);
    sync('gsc', gscInternalPlatforms.includes('gsc'), true);

    if (changed) {
      setConnectedPlatforms(updated);
      invalidateAnalyticsCache();
    }
  }, [
    wordpressConnected, wordpressSites,
    bingConnected, bingSites,
    gscInternalPlatforms,
    connectedPlatforms, setConnectedPlatforms, invalidateAnalyticsCache,
  ]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const wpConnected = urlParams.get('wordpress_connected');
    const blogUrl = urlParams.get('blog_url');
    const error = urlParams.get('error');

    if (wpConnected === 'true' && blogUrl) {
      setConnectedPlatforms((prev) =>
        prev.includes('wordpress') ? prev : [...prev, 'wordpress'],
      );
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (error) {
      console.error('WordPress OAuth error:', error);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [setConnectedPlatforms]);

  const handlePlatformConnect = async (platformId: string) => {
    if (platformId === 'gsc') {
      await handleGSCConnect();
    } else if (platformId === 'bing') {
      try {
        await connectBing();
      } catch (error) {
        console.error('Bing connection failed:', error);
      }
    } else {
      await handleConnect(platformId);
    }
  };

  const integrations = React.useMemo(() => [
    {
      id: 'wix',
      name: 'Wix',
      description: 'Connect your Wix website for automated content publishing',
      icon: <WixIcon />,
      category: 'website' as const,
      status: 'available' as const,
      features: ['Auto-publish content', 'Analytics tracking', 'SEO optimization'],
      benefits: ['Direct publishing to your Wix site', 'Content performance insights', 'Automated SEO optimization'],
      oauthUrl: '/api/oauth/wix/connect',
      isEnabled: true,
    },
    {
      id: 'wordpress',
      name: 'WordPress',
      description: 'Connect your WordPress.com sites with OAuth authentication',
      icon: <WordPressIcon />,
      category: 'website' as const,
      status: 'available' as const,
      features: ['OAuth authentication', 'Auto-publish content', 'SEO optimization'],
      benefits: ['Secure OAuth connection', 'Direct publishing to WordPress', 'Advanced SEO features'],
      isEnabled: true,
    },
    {
      id: 'gsc',
      name: 'Google Search Console',
      description: 'Connect GSC for SEO analytics and content optimization',
      icon: <GoogleIcon />,
      category: 'analytics' as const,
      status: 'available' as const,
      features: ['Search performance data', 'Keyword insights', 'Content optimization'],
      benefits: ['Real-time SEO metrics', 'Keyword performance tracking', 'Content gap analysis'],
      oauthUrl: '/gsc/auth/url',
      isEnabled: true,
    },
    {
      id: 'bing',
      name: 'Bing Webmaster Tools',
      description: 'Connect Bing Webmaster for SEO insights and search performance data',
      icon: <AnalyticsIcon />,
      category: 'analytics' as const,
      status: 'available' as const,
      features: ['Bing search performance', 'SEO insights', 'Index status monitoring'],
      benefits: ['Bing search analytics', 'SEO optimization insights', 'Search engine visibility tracking'],
      oauthUrl: '/bing/auth/url',
      isEnabled: true,
    },
  ], []);

  const websitePlatforms = integrations.filter(p => p.category === 'website');
  const analyticsPlatforms = integrations.filter(p => p.category === 'analytics');

  useEffect(() => {
    const data: IntegrationData = {
      primaryWebsite: null,
      websitePlatforms: {
        wix: wixConnected ? wixSites.map(s => ({ url: s.blog_url, name: 'Wix Site' })) : [],
        wordpress: wordpressConnected ? wordpressSites.map(s => ({ url: s.blog_url, name: 'WordPress Site' })) : [],
        primaryWebsite: null,
      },
      analyticsPlatforms: {
        gsc: {
          connected: connectedPlatforms.includes('gsc'),
          sites: (gscSites || []).map((site: any) => ({ siteUrl: site.siteUrl || site.site_url || '' })),
        },
        bing: {
          connected: connectedPlatforms.includes('bing') || !!bingConnected,
          sites: (bingSites || []).map((site: any) => ({ siteUrl: site.siteUrl || site.site_url || '' })),
        },
      },
      connectedPlatforms,
      updatedAt: new Date().toISOString(),
    };
    onIntegrationChange(data);
  }, [
    onIntegrationChange,
    wixConnected, wixSites,
    wordpressConnected, wordpressSites,
    gscSites, bingConnected, bingSites,
    connectedPlatforms,
  ]);

  useEffect(() => {
    if (walkthroughPaused) return;
    const id = setInterval(() => {
      setWalkthroughStep((prev) => (prev + 1) % WALKTHROUGH_TITLES.length);
    }, 4500);
    return () => clearInterval(id);
  }, [walkthroughPaused]);

  return (
    <Box sx={{ mt: 3, animation: 'fadeIn 0.6s ease-out' }}>
      <Accordion
        defaultExpanded={false}
        sx={{
          borderRadius: 3,
          border: '1px solid #E5E7EB',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          '&:before': { display: 'none' },
          '&.Mui-expanded': { margin: 0, mb: 2 },
        }}
      >
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          sx={{
            borderRadius: 3,
            bgcolor: '#F9FAFB',
            '&.Mui-expanded': {
              borderBottom: '1px solid #E5E7EB',
              borderBottomLeftRadius: 0,
              borderBottomRightRadius: 0,
            },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <CheckCircleIcon sx={{ color: connectedPlatforms.length > 0 ? '#22c55e' : '#94a3b8' }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#1e293b' }}>
              Connect Website Platforms
            </Typography>
            {connectedPlatforms.length > 0 && (
              <Chip
                label={`${connectedPlatforms.length} connected`}
                size="small"
                sx={{ bgcolor: '#dcfce7', color: '#15803d', fontWeight: 600, fontSize: '0.75rem' }}
              />
            )}
          </Box>
        </AccordionSummary>
        <AccordionDetails sx={{ p: 2.5 }}>
          <Typography variant="body2" sx={{ color: '#64748b', mb: 2 }}>
            Connect your website and analytics platforms to enable AI-powered content publishing and insights.
            All connections are optional.
          </Typography>

          <Fade in timeout={800}>
            <div>
              <PlatformSection
                title="Website Platforms"
                description="Connect your website for automated content publishing"
                platforms={websitePlatforms}
                connectedPlatforms={connectedPlatforms}
                gscSites={null}
                isLoading={isLoading}
                onConnect={handlePlatformConnect}
                onDisconnect={(platformId) => {
                  setConnectedPlatforms(connectedPlatforms.filter(p => p !== platformId));
                }}
                setConnectedPlatforms={setConnectedPlatforms}
              />
            </div>
          </Fade>

          <Fade in timeout={1000}>
            <div>
              <PlatformSection
                title="Analytics & SEO"
                description="Connect analytics platforms for data-driven content optimization"
                platforms={analyticsPlatforms}
                connectedPlatforms={connectedPlatforms}
                gscSites={gscSites}
                isLoading={isLoading}
                onConnect={handlePlatformConnect}
              />
            </div>
          </Fade>

          <Paper
            elevation={0}
            sx={{
              mt: 2,
              p: 2,
              borderRadius: 2,
              border: '1px dashed #cbd5e1',
              bgcolor: '#f8fafc',
            }}
          >
            <Box
              sx={{ position: 'relative', minHeight: 80 }}
              onMouseEnter={() => setWalkthroughPaused(true)}
              onMouseLeave={() => setWalkthroughPaused(false)}
            >
              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, display: 'block', mb: 1 }}>
                {WALKTHROUGH_LABELS[walkthroughStep]}
              </Typography>
              <Typography variant="subtitle2" sx={{ color: '#334155', fontWeight: 600, mb: 0.5 }}>
                {WALKTHROUGH_TITLES[walkthroughStep]}
              </Typography>
              <Typography variant="body2" sx={{ color: '#475569' }}>
                {WALKTHROUGH_DESCRIPTIONS[walkthroughStep]}
              </Typography>
            </Box>
          </Paper>
        </AccordionDetails>
      </Accordion>

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
            fontWeight: 600,
          },
        }}
      />
    </Box>
  );
};

export default WebsiteIntegrationsSection;
