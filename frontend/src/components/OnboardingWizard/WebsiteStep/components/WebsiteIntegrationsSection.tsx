import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Snackbar,
  Fade,
  Chip,
  Paper,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
  Card,
  CardContent,
  Alert,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Google as GoogleIcon,
  Analytics as AnalyticsIcon,
  LinkedIn as LinkedInIcon,
  Web as WordPressIcon,
  Web as WixIcon,
  CheckCircle as CheckCircleIcon,
  Lightbulb as LightbulbIcon,
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
  socialPlatforms?: Record<string, boolean>;
  connectedPlatforms: string[];
  updatedAt: string;
}

interface WebsiteIntegrationsSectionProps {
  websiteUrl: string;
  onIntegrationChange: (data: IntegrationData) => void;
  connectedPlatforms: string[];
  setConnectedPlatforms: React.Dispatch<React.SetStateAction<string[]>>;
}

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

  const [primarySite, setPrimarySite] = useState<string>('');

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

  // Use ref for connectedPlatforms to avoid re-running effect when we update it
  const connectedRef = useRef(connectedPlatforms);
  connectedRef.current = connectedPlatforms;

  // Consolidate platform sync: WordPress, Bing, and GSC all follow the same pattern
  useEffect(() => {
    const prev = connectedRef.current;
    const updated = [...prev];
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
    setConnectedPlatforms, invalidateAnalyticsCache,
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
    } else if (platformId === 'linkedin') {
      // LinkedInPlatformCard manages its own OAuth internally — no-op here
      console.log('LinkedIn connection handled by card component');
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
    {
      id: 'linkedin',
      name: 'LinkedIn',
      description: 'Connect LinkedIn for professional content publishing',
      icon: <LinkedInIcon />,
      category: 'analytics' as const,
      status: 'available' as const,
      features: ['Professional publishing', 'Company pages', 'Audience targeting'],
      benefits: ['Post to LinkedIn directly', 'Manage company pages', 'Target professional audience'],
      oauthUrl: '/api/linkedin/connect',
      isEnabled: true,
    },
  ], []);

  const websitePlatforms = integrations.filter(p => p.category === 'website');
  const analyticsPlatforms = integrations.filter(p => p.category === 'analytics');

  const availableSites = useMemo(() => {
    const sites: { url: string; source: string; name: string }[] = [];
    if (wixConnected && wixSites.length > 0) {
      sites.push(...wixSites.map(s => ({ url: s.blog_url, source: 'Wix', name: 'Wix Site' })));
    }
    if (wordpressConnected && wordpressSites.length > 0) {
      sites.push(...wordpressSites.map(s => ({ url: s.blog_url, source: 'WordPress', name: 'WordPress Site' })));
    }
    return sites;
  }, [wixConnected, wixSites, wordpressConnected, wordpressSites]);

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

  useEffect(() => {
    const data: IntegrationData = {
      primaryWebsite: primarySite || null,
      websitePlatforms: {
        wix: wixConnected ? wixSites.map(s => ({ url: s.blog_url, name: 'Wix Site' })) : [],
        wordpress: wordpressConnected ? wordpressSites.map(s => ({ url: s.blog_url, name: 'WordPress Site' })) : [],
        primaryWebsite: primarySite || null,
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
      socialPlatforms: {
        linkedin: connectedPlatforms.includes('linkedin'),
      },
      connectedPlatforms,
      updatedAt: new Date().toISOString(),
    };
    onIntegrationChange(data);
  }, [
    onIntegrationChange,
    primarySite,
    wixConnected, wixSites,
    wordpressConnected, wordpressSites,
    gscSites, bingConnected, bingSites,
    connectedPlatforms,
  ]);

  return (
    <Box sx={{ mt: 3, animation: 'fadeIn 0.6s ease-out' }}>
      <Accordion
        defaultExpanded={false}
        sx={{
          borderRadius: 3,
          border: '1px solid #CBD5E1',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          bgcolor: '#EFF6FF',
          '&:before': { display: 'none' },
          '&.Mui-expanded': { margin: 0, mb: 2 },
        }}
      >
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          sx={{
            borderRadius: 3,
            bgcolor: '#EFF6FF',
            '&.Mui-expanded': {
              borderBottom: '1px solid #CBD5E1',
              borderBottomLeftRadius: 0,
              borderBottomRightRadius: 0,
            },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <CheckCircleIcon sx={{ color: connectedPlatforms.length > 0 ? '#2563EB' : '#94A3B8' }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#1E293B' }}>
              Connect Website Platforms
            </Typography>
            {connectedPlatforms.length > 0 && (
              <Chip
                icon={<CheckCircleIcon sx={{ fontSize: 18, color: '#FFFFFF' }} />}
                label={`${connectedPlatforms.length} Connected`}
                sx={{
                  background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  height: 30,
                  px: 1,
                  '& .MuiChip-icon': { ml: 0.5 },
                  boxShadow: '0 2px 8px rgba(37, 99, 235, 0.35)',
                }}
              />
            )}
          </Box>
        </AccordionSummary>
        <AccordionDetails sx={{ p: 2.5 }}>
          <Typography variant="body2" sx={{ color: '#64748B', mb: 2 }}>
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
        </AccordionDetails>
      </Accordion>

      {/* Primary Site Selection */}
      {availableSites.length > 0 && (
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
            </Paper>
          </Box>
        </Fade>
      )}

      <Snackbar
        open={showToast}
        autoHideDuration={4000}
        onClose={() => setShowToast(false)}
        message={toastMessage}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{
          '& .MuiSnackbarContent-root': {
            backgroundColor: '#2563EB',
            color: 'white',
            fontWeight: 600,
          },
        }}
      />
    </Box>
  );
};

export default WebsiteIntegrationsSection;
