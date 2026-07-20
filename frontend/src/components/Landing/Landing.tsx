import React, { Suspense, lazy, useEffect, useCallback, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useClerk } from '@clerk/clerk-react';
import usePerformanceMonitor from '../../hooks/usePerformanceMonitor';
import {
  Box,
  Button,
  Container,
  Typography,
  Stack,
  Grid,
  Card,
  CardContent,
  Chip,
  Avatar,
  useTheme,
  useMediaQuery,
  alpha,
  Skeleton,
} from '@mui/material';
import { keyframes } from '@mui/system';
import {
  Analytics,
  CalendarToday,
  Create,
  Publish,
  Chat,
  Refresh,
  OpenInNew
} from '@mui/icons-material';
import Check from '@mui/icons-material/Check';
import { motion } from 'framer-motion';
import HeroSection from './HeroSection';
import LandingNav from './LandingNav';
import LandingFooter from './LandingFooter';
import EnterpriseCTA from './EnterpriseCTA';
import { ScrambleText } from '../ScrambleText';
import {
  landingSectionTitleSx,
  landingSectionSubtitleSx,
  landingSectionHeaderGap,
  landingCardHoverSx,
} from './landingStyles';
import { parseLandingHash, scrollToLandingSectionWithRetry, isLandingMarketingPath } from '../../utils/landingNavigation';
import { LANDING_PRICING_TEASER_PLANS } from './landingPricingTeaser';
import { LANDING_LIFECYCLE_FEATURES } from './landingLifecycleFeatures';
import { useDeferredBackground } from './useDeferredBackground';
import { useLandingCanonical } from './useLandingCanonical';
import { getPostAuthDestination } from '../../utils/returningUserStorage';
import LandingMobileDetailDialog from './LandingMobileDetailDialog';
import { landingDarkSectionSx, landingSectionBackgroundLayerBaseSx, landingMobileBackgroundBleedSx, landingMobileSeamBleedSx } from './landingSectionShellSx';

const LIFECYCLE_BG = '/content_lifecycle.png';

// Scrambling text component for multiple phrases
const ScramblingText: React.FC<{ phrases: string[]; interval?: number; duration?: number; delay?: number; style?: React.CSSProperties }> = ({ 
  phrases, 
  interval = 3000,
  duration = 400,
  delay = 200,
  style = {}
}) => {
  const [currentIndex, setCurrentIndex] = React.useState(0);

  React.useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % phrases.length);
    }, interval);
    return () => clearInterval(timer);
  }, [phrases.length, interval]);

  return (
    <ScrambleText
      text={phrases[currentIndex]}
      duration={duration}
      delay={delay}
      restartInterval={interval}
      as="span"
      style={style}
    />
  );
};

// Lazy load components for better performance
const FeatureShowcase = lazy(() => import('./FeatureShowcase'));
const SolopreneurDilemma = lazy(() => import('./SolopreneurDilemma'));
const IntroducingAlwrity = lazy(() => import('./IntroducingAlwrity'));

const LIFECYCLE_ICON_BY_KEY = {
  plan: <CalendarToday />,
  generate: <Create />,
  publish: <Publish />,
  analyze: <Analytics />,
  engage: <Chat />,
  remarket: <Refresh />,
} as const;

/** Skeleton heights tuned to real section sizes (TC 040). */
const SKELETON_HEIGHT = {
  welcome: 480,
  features: 520,
  solopreneur: 420,
} as const;

const Landing: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [lifecycleDialogIndex, setLifecycleDialogIndex] = useState<number | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { openSignIn } = useClerk();
  const lifecycleBgUrl = useDeferredBackground(LIFECYCLE_BG);
  useLandingCanonical();
  
  // Monitor performance
  usePerformanceMonitor('Landing');

  useEffect(() => {
    if (!isLandingMarketingPath(location.pathname)) return undefined;
    const section = parseLandingHash(location.hash);
    if (!section) return undefined;
    return scrollToLandingSectionWithRetry(section);
  }, [location.pathname, location.hash]);

  const handleLifecycleCardOpen = useCallback(
    (index: number) => {
      if (!isMobile) return;
      setLifecycleDialogIndex(index);
    },
    [isMobile]
  );

  const handleLifecycleCardKeyDown = useCallback(
    (event: React.KeyboardEvent, index: number) => {
      if (!isMobile) return;
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleLifecycleCardOpen(index);
      }
    },
    [handleLifecycleCardOpen, isMobile]
  );

  // Optimized Framer Motion variants for better performance

  // Cinematic lifecycle section animations
  const titleFlyIn = {
    hidden: { opacity: 0, y: -40, scale: 0.95 },
    visible: { 
      opacity: 1, 
      y: 0,
      scale: 1,
      transition: { 
        delay: 0.15,
        duration: 0.6, 
        ease: [0.22, 1, 0.36, 1] as const
      }
    }
  };

  const chipsFlyIn = {
    hidden: { opacity: 0, y: 30 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { 
        delay: 0.3,
        duration: 0.5,
        ease: "easeOut" as const
      }
    }
  };

  const descriptionFade = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { 
        delay: 0.45,
        duration: 0.5
      }
    }
  };

  // Card zoom animations from different directions
  const cardVariants = [
    // Top-left
    { 
      hidden: { opacity: 0, scale: 0.3, x: -200, y: -200, rotate: -15 },
      visible: { opacity: 1, scale: 1, x: 0, y: 0, rotate: 0 }
    },
    // Top
    { 
      hidden: { opacity: 0, scale: 0.3, y: -250, rotate: 0 },
      visible: { opacity: 1, scale: 1, y: 0, rotate: 0 }
    },
    // Top-right
    { 
      hidden: { opacity: 0, scale: 0.3, x: 200, y: -200, rotate: 15 },
      visible: { opacity: 1, scale: 1, x: 0, y: 0, rotate: 0 }
    },
    // Bottom-left
    { 
      hidden: { opacity: 0, scale: 0.3, x: -200, y: 200, rotate: 15 },
      visible: { opacity: 1, scale: 1, x: 0, y: 0, rotate: 0 }
    },
    // Bottom
    { 
      hidden: { opacity: 0, scale: 0.3, y: 250, rotate: 0 },
      visible: { opacity: 1, scale: 1, y: 0, rotate: 0 }
    },
    // Bottom-right
    { 
      hidden: { opacity: 0, scale: 0.3, x: 200, y: 200, rotate: -15 },
      visible: { opacity: 1, scale: 1, x: 0, y: 0, rotate: 0 }
    }
  ];

  const cardsStagger = {
    hidden: {},
    visible: {
      transition: {
        delayChildren: 0.3,
        staggerChildren: 0.1
      }
    }
  };

  const features = LANDING_LIFECYCLE_FEATURES.map((feature) => ({
    ...feature,
    icon: LIFECYCLE_ICON_BY_KEY[feature.iconKey],
  }));






  const glassCardSx = {
    background: `linear-gradient(135deg, ${alpha(theme.palette.common.white, 0.05)} 0%, ${alpha(theme.palette.common.white, 0.015)} 100%)`,
    backdropFilter: 'blur(14px)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 3,
    boxShadow: '0 10px 25px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.06)',
    p: 0
  } as const;

  // Shimmer animation for lifecycle chip line
  const shimmer = keyframes`
    0% { background-position: 0% 50%; }
    100% { background-position: 100% 50%; }
  `;

  // Glow pulse animation for chips
  const glowPulse = keyframes`
    0%, 100% { 
      box-shadow: 0 0 10px ${alpha(theme.palette.primary.main, 0.3)}, 
                  0 0 20px ${alpha(theme.palette.primary.main, 0.2)},
                  inset 0 0 10px ${alpha(theme.palette.primary.main, 0.1)};
    }
    50% { 
      box-shadow: 0 0 20px ${alpha(theme.palette.primary.main, 0.6)}, 
                  0 0 30px ${alpha(theme.palette.primary.main, 0.4)},
                  inset 0 0 15px ${alpha(theme.palette.primary.main, 0.2)};
    }
  `;


  const SectionSkeleton: React.FC<{ minHeight: number }> = ({ minHeight }) => (
    <Box sx={{ py: 0, px: 0, bgcolor: '#0a0a0a' }}>
      <Skeleton
        variant="rectangular"
        height={minHeight}
        sx={{
          borderRadius: 0,
          bgcolor: '#0a0a0a',
          maxWidth: '100%',
          mx: 'auto',
        }}
      />
    </Box>
  );

  return (
    <Box sx={{ minHeight: '100vh', overflowX: 'hidden', position: 'relative', bgcolor: '#0a0a0a' }}>
      <Box
        component="a"
        href="#main-content"
        sx={{
          position: 'absolute',
          left: -9999,
          zIndex: 9999,
          px: 2,
          py: 1,
          background: theme.palette.primary.main,
          color: '#fff',
          textDecoration: 'none',
          fontWeight: 600,
          '&:focus-visible': {
            position: 'fixed',
            left: 16,
            top: 16,
            outline: '2px solid #fff',
            outlineOffset: 2,
          },
        }}
      >
        Skip to main content
      </Box>

      <LandingNav />

      <Box component="main" id="main-content" sx={{ bgcolor: '#0a0a0a', display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Hero Section */}
      <HeroSection />

      {/* Welcome / Why ALwrity — moved up for better conversion flow */}
      <Suspense fallback={<SectionSkeleton minHeight={SKELETON_HEIGHT.welcome} />}>
        <IntroducingAlwrity />
      </Suspense>

      {/* Lifecycle Section with Background Image */}
      <Box
        id="lifecycle"
        sx={{
          ...landingDarkSectionSx,
          minHeight: { xs: 'auto', md: 'calc(100vh - 48px)' },
          pt: { xs: 3, md: 4 },
          pb: { xs: 2.5, md: 4 },
          position: 'relative',
          zIndex: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        <Box
          sx={{
            ...landingSectionBackgroundLayerBaseSx,
            ...landingMobileBackgroundBleedSx,
            ...landingMobileSeamBleedSx,
            zIndex: 0,
            bgcolor: '#0a0a0a',
            backgroundImage: lifecycleBgUrl ? `url(${lifecycleBgUrl})` : 'none',
          }}
        />
        <Box
          sx={{
            ...landingSectionBackgroundLayerBaseSx,
            ...landingMobileBackgroundBleedSx,
            ...landingMobileSeamBleedSx,
            zIndex: 1,
            background: `linear-gradient(
              135deg,
              rgba(0,0,0,1) 0%,
              rgba(0,0,0,0.92) 30%,
              rgba(0,0,0,0.88) 35%,
              rgba(0,0,0,0.78) 50%,
              rgba(0,0,0,0.88) 100%
            )`,
            backdropFilter: 'blur(2px)',
          }}
        />

        <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 2 }}>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.1 }}
          >
            <Stack spacing={0} alignItems="center">
              {/* Title + subtitle */}
              <motion.div variants={titleFlyIn} style={{ width: '100%' }}>
                <Stack spacing={1.5} alignItems="center" textAlign="center" sx={{ mb: landingSectionHeaderGap }}>
                  <Typography 
                    variant="h2" 
                    component="h2"
                    sx={{
                      ...landingSectionTitleSx,
                      color: 'white',
                      textShadow: `0 0 30px ${alpha(theme.palette.primary.main, 0.5)}, 0 4px 20px rgba(0,0,0,0.8)`,
                    }}
                  >
                    ALwrity Content Lifecycle
                  </Typography>
                  <Typography 
                    variant="h5" 
                    component="p"
                    sx={{
                      ...landingSectionSubtitleSx,
                      color: alpha('#fff', 0.9),
                      fontWeight: 600,
                      fontSize: { xs: '1rem', md: '1.5rem' },
                      lineHeight: { xs: 1.55, md: 1.45 },
                      textShadow: '0 2px 10px rgba(0,0,0,0.6)',
                    }}
                  >
                    End-to-End, with You in Control
                  </Typography>
                </Stack>
              </motion.div>

              {/* Phase chips strip */}
              <motion.div variants={chipsFlyIn} style={{ width: '100%' }}>
                <Box sx={{ position: 'relative', width: '100%', maxWidth: 1100, px: { xs: 1, md: 2 }, pt: 0.5, pb: 0.5, mb: landingSectionHeaderGap }}>
                  {/* animated line */}
                  <Box
                    sx={{
                      position: 'absolute',
                      top: { xs: 28, md: 32 },
                      left: 0,
                      right: 0,
                      height: 3,
                      borderRadius: 2,
                      background: `linear-gradient(90deg, 
                        ${alpha(theme.palette.primary.main, 0.4)}, 
                        ${alpha(theme.palette.secondary.main, 0.5)}, 
                        ${alpha(theme.palette.primary.main, 0.4)})`,
                      overflow: 'hidden',
                      boxShadow: `0 0 20px ${alpha(theme.palette.primary.main, 0.6)}`
                    }}
                  >
                    <Box
                      sx={{
                        width: '40%',
                        height: '100%',
                        background: `linear-gradient(90deg, 
                          transparent, 
                          ${alpha(theme.palette.primary.main, 1)}, 
                          ${alpha(theme.palette.secondary.main, 1)},
                          transparent)`,
                        backgroundSize: '200% 100%',
                        animation: `${shimmer} 3s ease-in-out infinite`
                      }}
                    />
                  </Box>
                  {/* chips — 2×3 on mobile, single row on desktop */}
                  <Grid container spacing={{ xs: 1, md: 1.5 }} justifyContent="center" alignItems="center">
                    {[
                      { label: 'Plan', variations: ['Plan', 'Strategy', 'Research', 'Blueprint'] },
                      { label: 'Generate', variations: ['Generate', 'Create', 'Produce', 'Craft'] },
                      { label: 'Publish', variations: ['Publish', 'Launch', 'Deploy', 'Release'] },
                      { label: 'Analyze', variations: ['Analyze', 'Measure', 'Track', 'Monitor'] },
                      { label: 'Engage', variations: ['Engage', 'Interact', 'Connect', 'Respond'] },
                      { label: 'Remarket', variations: ['Remarket', 'Repurpose', 'Recycle', 'Amplify'] }
                    ].map((item, idx) => (
                      <Grid item key={item.label} xs={4} md={2} sx={{ display: 'flex', justifyContent: 'center' }}>
                        <Chip 
                          label={
                            <Stack direction="row" spacing={0.5} alignItems="center">
                              <Typography 
                                variant="caption" 
                                sx={{ 
                                  fontWeight: 800, 
                                  fontSize: { xs: '0.6rem', md: '0.7rem' },
                                  color: 'primary.main'
                                }}
                              >
                                {idx+1}
                              </Typography>
                              <ScramblingText
                                phrases={item.variations}
                                duration={400}
                                delay={200}
                                interval={4000}
                                style={{
                                  fontWeight: 700,
                                  fontSize: '0.65rem',
                                  color: 'white'
                                }}
                              />
                            </Stack>
                          }
                          size="small"
                          sx={{
                            px: { xs: 0.75, md: 1.5 },
                            py: { xs: 1, md: 1.25 },
                            fontWeight: 700,
                            letterSpacing: 0.5,
                            width: '100%',
                            maxWidth: { xs: 110, md: 140 },
                            background: `linear-gradient(135deg, 
                              ${alpha(theme.palette.primary.main, 0.3)}, 
                              ${alpha(theme.palette.secondary.main, 0.3)})`,
                            border: `2px solid ${alpha(theme.palette.primary.main, 0.6)}`,
                            backdropFilter: 'blur(12px)',
                            animation: `${glowPulse} 3s ease-in-out infinite`,
                            animationDelay: `${idx * 0.3}s`,
                            transition: 'all 0.3s ease',
                            '&:hover': {
                              transform: 'scale(1.05) translateY(-2px)',
                              background: `linear-gradient(135deg, 
                                ${alpha(theme.palette.primary.main, 0.5)}, 
                                ${alpha(theme.palette.secondary.main, 0.5)})`,
                              boxShadow: `0 8px 30px ${alpha(theme.palette.primary.main, 0.7)}`
                            }
                          }}
                        />
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              </motion.div>

              {/* Description — between chips and cards */}
              <motion.div variants={descriptionFade} style={{ width: '100%' }}>
                <Typography 
                  variant="body1" 
                  color={alpha('#fff', 0.9)}
                  maxWidth="720px"
                  textAlign="center"
                  mx="auto"
                  sx={{
                    textShadow: '0 2px 10px rgba(0,0,0,0.6)',
                    ...landingSectionSubtitleSx,
                    fontSize: { xs: '0.9rem', md: '1rem' },
                    mb: { xs: 2, md: 2.5 },
                  }}
                >
                  AI-Powered Automation with Human-in-the-Loop Design, ensuring You have the Final Say
                </Typography>
              </motion.div>

              {/* Cards — 3×2 grid on desktop */}
              <motion.div
                variants={cardsStagger}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.1 }}
                style={{ width: '100%' }}
              >
                <Grid container spacing={{ xs: 1.25, md: 2 }} sx={{ px: { xs: 0.5, md: 1 } }}>
                  {features.map((feature, index) => (
                    <Grid item xs={6} sm={6} md={4} key={feature.title}>
                    <motion.div
                      variants={cardVariants[index]}
                      transition={{
                        duration: 0.45,
                        ease: [0.25, 0.46, 0.45, 0.94],
                      }}
                    >
                      <Card 
                        role={isMobile ? 'button' : undefined}
                        tabIndex={isMobile ? 0 : undefined}
                        aria-haspopup={isMobile ? 'dialog' : undefined}
                        onClick={() => handleLifecycleCardOpen(index)}
                        onKeyDown={(event) => handleLifecycleCardKeyDown(event, index)}
                        sx={{ 
                          ...glassCardSx, 
                          height: { xs: 'auto', md: '100%' },
                          aspectRatio: { xs: '15 / 6.3', md: 'auto' },
                          borderRadius: { xs: 0, md: 3 },
                          cursor: { xs: 'pointer', md: 'default' },
                          position: 'relative',
                          background: `linear-gradient(135deg, ${alpha(theme.palette.common.white, 0.08)} 0%, ${alpha(theme.palette.common.white, 0.03)} 100%)`,
                          backdropFilter: 'blur(20px)',
                          border: `1px solid ${alpha(theme.palette.common.white, 0.15)}`,
                          ...landingCardHoverSx,
                          '& .lifecycle-card-desc': {
                            display: 'block',
                            overflow: 'visible',
                          },
                          [`@media (min-width: ${theme.breakpoints.values.md}px)`]: {
                            '& .lifecycle-card-desc': {
                              display: '-webkit-box',
                              WebkitLineClamp: 3,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                            },
                          },
                          '&:hover': {
                            ...landingCardHoverSx['&:hover'],
                            boxShadow: `0 24px 48px ${alpha(theme.palette.primary.main, 0.45)}, 0 0 24px ${alpha(theme.palette.primary.main, 0.2)}`,
                            borderColor: alpha(theme.palette.primary.main, 0.55),
                            '& .lifecycle-card-desc': {
                              WebkitLineClamp: 'unset',
                              overflow: 'visible',
                            },
                          },
                          '&:focus-visible': {
                            outline: `2px solid ${theme.palette.primary.main}`,
                            outlineOffset: 2,
                          },
                        }}
                      >
                        <CardContent
                          sx={{
                            p: { xs: 1, md: 2 },
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: { xs: 'center', md: 'flex-start' },
                            '&:last-child': { pb: { xs: 1, md: 2 } },
                          }}
                        >
                          <Stack spacing={{ xs: 0.75, md: 1.25 }} alignItems={{ xs: 'center', md: 'stretch' }}>
                            <Stack
                              direction="row"
                              justifyContent="space-between"
                              alignItems="center"
                              sx={{ width: '100%' }}
                            >
                              <Avatar
                                sx={{
                                  width: { xs: 32, md: 36 },
                                  height: { xs: 32, md: 36 },
                                  borderRadius: 2,
                                  background: `linear-gradient(45deg, ${alpha(theme.palette.primary.main, 0.25)}, ${alpha(theme.palette.secondary.main, 0.25)})`,
                                  color: theme.palette.primary.main,
                                  '& .MuiSvgIcon-root': { fontSize: { xs: 18, md: 20 } },
                                }}
                              >
                                {feature.icon}
                              </Avatar>
                              <Chip 
                                label={feature.badge} 
                                size="small" 
                                sx={{ 
                                  background: alpha(theme.palette.primary.main, 0.2),
                                  color: theme.palette.primary.main,
                                  fontWeight: 600,
                                  fontSize: { xs: '0.62rem', md: '0.7rem' },
                                  height: { xs: 22, md: 24 },
                                }} 
                              />
                            </Stack>
                            <Typography
                              variant="subtitle1"
                              component="h3"
                              fontWeight={700}
                              sx={{
                                fontSize: { xs: '0.92rem', md: '0.95rem' },
                                color: 'white',
                                lineHeight: 1.2,
                                textAlign: { xs: 'center', md: 'left' },
                                width: '100%',
                              }}
                            >
                              {feature.title}
                            </Typography>
                            <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                              <Stack spacing={0.75}>
                                <Typography
                                  className="lifecycle-card-desc"
                                  variant="body2"
                                  color={alpha('#fff', 0.85)}
                                  lineHeight={1.45}
                                  sx={{ fontSize: '0.8rem', textAlign: 'left' }}
                                >
                                  {feature.description}
                                </Typography>
                                <Box>
                                  <Button
                                    onClick={() => openSignIn({ forceRedirectUrl: feature.href })}
                                    size="small"
                                    endIcon={<OpenInNew sx={{ fontSize: 14 }} />}
                                    aria-label={`Sign in to explore ${feature.title}`}
                                    data-landing-redirect={feature.href}
                                    sx={{
                                      textTransform: 'none',
                                      fontWeight: 600,
                                      px: 0,
                                      minWidth: 0,
                                      fontSize: '0.8rem',
                                      color: theme.palette.primary.main,
                                      '&:hover': {
                                        color: theme.palette.primary.light,
                                      },
                                    }}
                                  >
                                    Sign in to explore →
                                  </Button>
                                </Box>
                              </Stack>
                            </Box>
                          </Stack>
                        </CardContent>
                      </Card>
                    </motion.div>
                    </Grid>
                  ))}
                </Grid>
              </motion.div>
            </Stack>
          </motion.div>
        </Container>

        {isMobile && lifecycleDialogIndex !== null && (
          <LandingMobileDetailDialog
            open
            onClose={() => setLifecycleDialogIndex(null)}
            title={features[lifecycleDialogIndex].title}
            description={features[lifecycleDialogIndex].description}
            badge={features[lifecycleDialogIndex].badge}
            icon={features[lifecycleDialogIndex].icon}
            actionLabel={`Explore ${features[lifecycleDialogIndex].title} →`}
            onAction={() => openSignIn({ forceRedirectUrl: features[lifecycleDialogIndex].href })}
          />
        )}
      </Box>

      {/* Feature Showcase with Carousel - Lazy Loaded */}
      <Suspense fallback={<SectionSkeleton minHeight={SKELETON_HEIGHT.features} />}>
        <FeatureShowcase />
      </Suspense>

      {/* The Solopreneur's Dilemma Section - Lazy Loaded */}
      <Suspense fallback={<SectionSkeleton minHeight={SKELETON_HEIGHT.solopreneur} />}>
        <SolopreneurDilemma />
      </Suspense>

      {/* Pricing Section - Embedded in Landing */}
      <Box 
        id="pricing" 
        sx={{ 
          py: { xs: 2.5, md: 5 },
          minHeight: { xs: 'auto', md: 'calc(100vh - 64px)' },
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          background: `linear-gradient(180deg, ${alpha(theme.palette.background.default, 0.95)} 0%, ${alpha(theme.palette.background.paper, 0.98)} 100%)`,
        }}
      >
        <Container maxWidth="lg">
          <Stack spacing={3} alignItems="center">
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h3" component="h2" gutterBottom sx={{ ...landingSectionTitleSx, color: 'text.primary' }}>
                Choose Your Plan
              </Typography>
              <Typography
                variant="body1"
                component="p"
                color="text.secondary"
                sx={{
                  maxWidth: 900,
                  mx: 'auto',
                  whiteSpace: { xs: 'normal', md: 'nowrap' },
                  fontSize: { xs: '0.95rem', md: '1.05rem' },
                }}
              >
                Start Free to Test-Drive: Then Choose the Plan That Fits Your Workflow
              </Typography>
            </Box>

            <Grid container spacing={2} sx={{ width: '100%' }}>
              {LANDING_PRICING_TEASER_PLANS.map((plan) => (
                <Grid item xs={12} sm={6} md={3} key={plan.name}>
                  <Card
                    sx={{
                      height: '100%',
                      borderRadius: 3,
                      border: plan.highlight
                        ? `2px solid ${theme.palette.primary.main}`
                        : `1px solid ${alpha(theme.palette.divider, 0.2)}`,
                      boxShadow: plan.highlight
                        ? `0 12px 32px ${alpha(theme.palette.primary.main, 0.2)}`
                        : '0 4px 16px rgba(0,0,0,0.06)',
                      ...landingCardHoverSx,
                      '&:hover': {
                        ...landingCardHoverSx['&:hover'],
                        boxShadow: `0 20px 40px ${alpha(theme.palette.primary.main, 0.25)}`,
                      },
                    }}
                  >
                    <CardContent sx={{ p: { xs: 1.75, md: 2.25 } }}>
                      {/* Mobile: plan name (left) → price (center) → CTA (right) */}
                      <Box
                        sx={{
                          display: { xs: 'grid', md: 'none' },
                          gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)',
                          alignItems: 'center',
                          columnGap: 1.25,
                          px: { xs: 0.75, md: 0 },
                          mb: 1.5,
                          width: '100%',
                        }}
                      >
                        <Typography
                          variant="subtitle1"
                          component="h3"
                          fontWeight={700}
                          noWrap
                          sx={{
                            fontSize: '1.25rem',
                            justifySelf: 'start',
                            minWidth: 0,
                            pl: { xs: 0.25, md: 0 },
                          }}
                        >
                          {plan.name}
                        </Typography>
                        <Stack
                          direction="row"
                          alignItems="baseline"
                          spacing={0.35}
                          sx={{ justifySelf: 'center' }}
                        >
                          <Typography
                            variant="h6"
                            component="span"
                            fontWeight={800}
                            color="primary.main"
                            sx={{ fontSize: '1.48rem', lineHeight: 1 }}
                          >
                            {plan.price}
                          </Typography>
                          {plan.period && (
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.85rem' }}>
                              {plan.period}
                            </Typography>
                          )}
                        </Stack>
                        <Button
                          variant={plan.highlight ? 'contained' : 'outlined'}
                          size="small"
                          onClick={() => {
                            if (plan.ctaAction === 'signin') {
                              openSignIn({ forceRedirectUrl: getPostAuthDestination() });
                              return;
                            }
                            navigate('/pricing');
                          }}
                          sx={{
                            justifySelf: 'end',
                            mr: { xs: 0.25, md: 0 },
                            textTransform: 'none',
                            fontWeight: 600,
                            fontSize: '0.82rem',
                            py: 0.65,
                            px: 1.25,
                            minWidth: 'auto',
                            minHeight: 40,
                            whiteSpace: 'nowrap',
                            ...(plan.highlight
                              ? {
                                  background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                                }
                              : {}),
                          }}
                        >
                          {plan.mobileCtaLabel ?? plan.ctaLabel}
                        </Button>
                      </Box>

                      {/* Desktop: stacked header */}
                      <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                        <Typography variant="h6" component="h3" fontWeight={700} gutterBottom>
                          {plan.name}
                        </Typography>
                        <Stack direction="row" alignItems="baseline" spacing={0.5} sx={{ mb: 2 }}>
                          <Typography variant="h4" component="p" fontWeight={800} color="primary.main">
                            {plan.price}
                          </Typography>
                          {plan.period && (
                            <Typography variant="body2" color="text.secondary">
                              {plan.period}
                            </Typography>
                          )}
                        </Stack>
                      </Box>

                      <Stack spacing={0.75} sx={{ mb: { xs: 0, md: 1.5 } }}>
                        {plan.features.map((feature) => (
                          <Stack key={feature} direction="row" spacing={0.75} alignItems="flex-start">
                            <Check sx={{ fontSize: 16, color: 'primary.main', mt: 0.25 }} />
                            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.82rem', lineHeight: 1.4 }}>
                              {feature}
                            </Typography>
                          </Stack>
                        ))}
                      </Stack>
                      <Button
                        fullWidth
                        variant={plan.highlight ? 'contained' : 'outlined'}
                        size="small"
                        onClick={() => {
                          if (plan.ctaAction === 'signin') {
                            openSignIn({ forceRedirectUrl: getPostAuthDestination() });
                            return;
                          }
                          navigate('/pricing');
                        }}
                        sx={{
                          display: { xs: 'none', md: 'inline-flex' },
                          textTransform: 'none',
                          fontWeight: 600,
                          fontSize: '0.82rem',
                          py: 0.85,
                          ...(plan.highlight
                            ? {
                                background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                              }
                            : {}),
                        }}
                      >
                        {plan.ctaLabel}
                      </Button>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>

            <Button
              variant="contained"
              size="large"
              onClick={() => navigate('/pricing')}
              sx={{
                px: 5,
                py: 1.75,
                fontSize: '1.05rem',
                fontWeight: 600,
                background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                '&:hover': {
                  background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.secondary.dark} 100%)`,
                  transform: 'translateY(-2px)',
                  boxShadow: `0 8px 24px ${alpha(theme.palette.primary.main, 0.4)}`,
                }
              }}
            >
              View Plans & Features
            </Button>
          </Stack>
        </Container>
      </Box>

      {/* Final CTA Section — eager load to avoid CLS (TC 040) */}
      <EnterpriseCTA />
      </Box>

      <LandingFooter />
    </Box>
  );
};

export default Landing;


