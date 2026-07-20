import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, useClerk } from '@clerk/clerk-react';
import {
  Box,
  Container,
  Typography,
  Stack,
  Grid,
  Card,
  CardContent,
  Chip,
  Avatar,
  IconButton,
  useTheme,
  useMediaQuery,
  alpha,
  Theme,
} from '@mui/material';
import ArrowBack from '@mui/icons-material/ArrowBack';
import ArrowForward from '@mui/icons-material/ArrowForward';
import Psychology from '@mui/icons-material/Psychology';
import Search from '@mui/icons-material/Search';
import FactCheck from '@mui/icons-material/FactCheck';
import Edit from '@mui/icons-material/Edit';
import Assistant from '@mui/icons-material/Assistant';
import Verified from '@mui/icons-material/Verified';
import { motion, AnimatePresence } from 'framer-motion';
import {
  landingSectionTitleSx,
  landingSectionSubtitleSx,
  landingCardHoverSx,
} from './landingStyles';
import { useDeferredBackground } from './useDeferredBackground';
import { getPostAuthDestination } from '../../utils/returningUserStorage';
import LandingMobileDetailDialog from './LandingMobileDetailDialog';
import { landingDarkSectionSx, landingSectionBackgroundLayerSx, landingMobileBackgroundBleedSx } from './landingSectionShellSx';

interface Feature {
  image: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  badge: string;
}

const PRIMARY_SECTION_BG = '/alwrity_platform_experience.png';

const features: Feature[] = [
  {
    image: '/alwrity-copilot1.png',
    title: 'AI-First Copilot',
    description:
      'Your AI writing copilot for LinkedIn, blogs, and social — persona-aware content that matches your unique voice.',
    icon: <Assistant />,
    badge: 'Persona-Aware',
  },
  {
    image: '/alwrity-copilot2.png',
    title: 'Intelligent Writing Partner',
    description: 'Context-aware AI Copilot that understands your content goals and audience. Get real-time suggestions and enhancements tailored to your strategy.',
    icon: <Psychology />,
    badge: 'Context-Aware',
  },
  {
    image: '/alwrity_research.png',
    title: 'Interactive Web Research',
    description: 'AI-powered research engine with 25+ source integration. Get SERP rankings, credibility scores, and real-time market insights for data-driven content.',
    icon: <Search />,
    badge: 'Live Research',
  },
  {
    image: '/alwrity-assistive-writing.png',
    title: 'Assistive Writing Flow',
    description: 'Smart writing assistant that contextually continues your thoughts. Never face writer\'s block again with AI that understands your draft and goals.',
    icon: <Edit />,
    badge: 'Smart Assist',
  },
  {
    image: '/fact-check1.png',
    title: 'Hallucination-Free Content',
    description: 'Advanced fact-checking with source verification and credibility scoring. Every claim is analyzed, validated, and cited with authority ratings.',
    icon: <FactCheck />,
    badge: 'Verified',
  },
  {
    image: '/alwrity-fact-check.png',
    title: 'Claims Analysis Engine',
    description: 'Comprehensive fact-check results with supported, refuted, and insufficient claims. Ensure accuracy with AI-powered reasoning and source citations.',
    icon: <Verified />,
    badge: 'AI-Verified',
  },
];

interface FeatureCardImageProps {
  feature: Feature;
  theme: Theme;
}

const FeatureCardImage: React.FC<FeatureCardImageProps> = ({ feature, theme }) => {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');

  useEffect(() => {
    setStatus('loading');
    const img = new Image();
    img.onload = () => setStatus('loaded');
    img.onerror = () => setStatus('error');
    img.src = feature.image;
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [feature.image]);

  const imageAlt = `ALwrity Copilot — ${feature.title}`;

  return (
    <Box
      sx={{
        width: '100%',
        height: { xs: 200, md: 240 },
        position: 'relative',
        overflow: 'hidden',
        bgcolor: '#eef1f6',
        flexShrink: 0,
      }}
    >
      {status === 'loaded' && (
        <Box
          component="img"
          src={feature.image}
          alt={imageAlt}
          sx={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center top',
            display: 'block',
          }}
        />
      )}
      {status === 'error' && (
        <Box
          sx={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1.5,
            background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
            px: 2,
          }}
        >
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: 2,
              background: 'rgba(255, 255, 255, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              '& .MuiSvgIcon-root': { fontSize: 24 },
            }}
          >
            {feature.icon}
          </Box>
          <Typography variant="body2" fontWeight={700} color="white" textAlign="center">
            {feature.title}
          </Typography>
        </Box>
      )}
      {status === 'loading' && (
        <Box
          sx={{
            width: '100%',
            height: '100%',
            background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.25)} 0%, ${alpha(theme.palette.secondary.main, 0.25)} 100%)`,
          }}
        />
      )}
      {(status === 'loaded' || status === 'error') && (
        <Box
          sx={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '40%',
            background: 'linear-gradient(to bottom, transparent, rgba(0,0,0,0.4))',
            pointerEvents: 'none',
          }}
        />
      )}
    </Box>
  );
};

const FeatureShowcase: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { isSignedIn } = useAuth();
  const { openSignIn } = useClerk();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const itemsPerPage = isMobile ? 1 : 3;
  const [currentPage, setCurrentPage] = useState(0);
  const [featureDialogIndex, setFeatureDialogIndex] = useState<number | null>(null);
  const sectionBg = useDeferredBackground(PRIMARY_SECTION_BG);
  const totalPages = Math.ceil(features.length / itemsPerPage);

  const glassCardSx = {
    background: `linear-gradient(135deg, ${alpha(theme.palette.common.white, 0.08)} 0%, ${alpha(theme.palette.common.white, 0.03)} 100%)`,
    backdropFilter: 'blur(16px)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 3,
    boxShadow: '0 12px 28px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08)',
  } as const;

  useEffect(() => {
    setCurrentPage((prev) => Math.min(prev, Math.max(0, totalPages - 1)));
  }, [totalPages]);

  const handleFeatureAuth = useCallback(() => {
    const destination = getPostAuthDestination();
    if (isSignedIn) {
      navigate(destination);
      return;
    }
    openSignIn({ forceRedirectUrl: destination });
  }, [isSignedIn, navigate, openSignIn]);

  const handleFeatureCardOpen = useCallback(
    (index: number) => {
      if (!isMobile) {
        handleFeatureAuth();
        return;
      }
      setFeatureDialogIndex(index);
    },
    [handleFeatureAuth, isMobile]
  );

  const handleFeatureCardKeyDown = useCallback(
    (event: React.KeyboardEvent, index: number) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleFeatureCardOpen(index);
      }
    },
    [handleFeatureCardOpen]
  );

  const handleNext = () => setCurrentPage((prev) => (prev + 1) % totalPages);
  const handlePrev = () => setCurrentPage((prev) => (prev - 1 + totalPages) % totalPages);

  const currentFeatures = features.slice(
    currentPage * itemsPerPage,
    (currentPage + 1) * itemsPerPage
  );

  const slideVariants = {
    enter: (direction: number) => ({ x: direction > 0 ? 600 : -600, opacity: 0 }),
    center: { x: 0, opacity: 1, transition: { duration: 0.4, ease: 'easeOut' as const } },
    exit: (direction: number) => ({
      x: direction > 0 ? -600 : 600,
      opacity: 0,
      transition: { duration: 0.35, ease: 'easeOut' as const },
    }),
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.08, duration: 0.4, ease: 'easeOut' as const },
    }),
  };

  const arrowButtonSx = {
    background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
    color: 'white',
    width: 44,
    height: 44,
    boxShadow: `0 4px 16px ${alpha(theme.palette.primary.main, 0.4)}`,
    '&:hover': {
      background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.secondary.dark} 100%)`,
    },
  } as const;

  return (
    <Box
      id="features"
      sx={{
        ...landingDarkSectionSx,
        minHeight: { xs: 'auto', md: '100vh' },
        mt: { xs: 0, md: 0 },
        py: { xs: 2.5, md: 0 },
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        '&::before': {
          ...landingSectionBackgroundLayerSx,
          ...landingMobileBackgroundBleedSx,
          zIndex: 0,
          bgcolor: '#0a0a0a',
          backgroundImage: sectionBg ? `url(${sectionBg})` : 'none',
        },
        '&::after': {
          ...landingSectionBackgroundLayerSx,
          ...landingMobileBackgroundBleedSx,
          zIndex: 1,
          background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.35) 0%, rgba(25, 118, 210, 0.2) 50%, rgba(156, 39, 176, 0.2) 100%)',
        },
      }}
    >
      <Container
        maxWidth="xl"
        sx={{
          pb: { xs: 1, md: 3.5 },
          pt: { xs: 1, md: 2.5 },
          position: 'relative',
          zIndex: 2,
        }}
      >
        <Stack spacing={0} alignItems="center" sx={{ width: '100%' }}>
          <Box sx={{ width: '100%', textAlign: 'center' }}>
            <Typography
              variant="h3"
              component="h2"
              sx={{
                ...landingSectionTitleSx,
                color: '#fff',
                mb: { xs: 1, md: 1.25 },
              }}
            >
              Experience the Platform
            </Typography>
            <Typography
              variant="h5"
              component="p"
              maxWidth="780px"
              textAlign="center"
              sx={{
                ...landingSectionSubtitleSx,
                color: alpha('#fff', 0.9),
                fontWeight: 500,
                fontSize: { xs: '0.95rem', md: '1.05rem' },
                mt: { xs: 2.5, md: 3 },
                mb: { xs: 3.5, md: 4.5 },
                mx: 'auto',
              }}
            >
              See ALwrity in action: AI copilot writing, live web research, and built-in fact-checking — Transform
              Your Content workflow on one Dashboard
            </Typography>
          </Box>

          <Box sx={{ position: 'relative', width: '100%', overflow: 'visible', px: { xs: 0.5, md: 9 }, mt: { xs: 1, md: 1.5 } }}>
            {isMobile ? (
              <Grid container spacing={1.25} sx={{ px: 0.5 }}>
                {features.map((feature, index) => (
                  <Grid item xs={6} key={feature.title}>
                    <Card
                      role="button"
                      tabIndex={0}
                      aria-haspopup="dialog"
                      onClick={() => handleFeatureCardOpen(index)}
                      onKeyDown={(event) => handleFeatureCardKeyDown(event, index)}
                      sx={{
                        ...glassCardSx,
                        height: '100%',
                        cursor: 'pointer',
                        '&:focus-visible': {
                          outline: `2px solid ${theme.palette.primary.main}`,
                          outlineOffset: 2,
                        },
                      }}
                    >
                      <CardContent sx={{ p: 1.25, '&:last-child': { pb: 1.25 } }}>
                        <Stack spacing={0.75} alignItems="center">
                          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ width: '100%' }}>
                            <Avatar
                              sx={{
                                width: 32,
                                height: 32,
                                borderRadius: 2,
                                background: `linear-gradient(45deg, ${alpha(theme.palette.primary.main, 0.25)}, ${alpha(theme.palette.secondary.main, 0.25)})`,
                                color: theme.palette.primary.main,
                                '& .MuiSvgIcon-root': { fontSize: 18 },
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
                                fontSize: '0.62rem',
                                height: 22,
                              }}
                            />
                          </Stack>
                          <Typography
                            variant="subtitle2"
                            component="h3"
                            fontWeight={700}
                            sx={{
                              color: 'white',
                              fontSize: '0.92rem',
                              lineHeight: 1.2,
                              textAlign: 'center',
                              width: '100%',
                            }}
                          >
                            {feature.title}
                          </Typography>
                        </Stack>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            ) : (
              <>
            <AnimatePresence mode="wait" custom={currentPage}>
              <motion.div
                key={currentPage}
                custom={currentPage}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                style={{ width: '100%' }}
              >
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
                    gap: { xs: 2, md: 3 },
                    px: { xs: 0.5, md: 1 },
                  }}
                >
                  {currentFeatures.map((feature, index) => (
                    <motion.div
                      key={feature.title}
                      custom={index}
                      variants={cardVariants}
                      initial="hidden"
                      animate="visible"
                    >
                      <Box
                        role="button"
                        tabIndex={0}
                        aria-label={`Explore ${feature.title}`}
                        onClick={handleFeatureAuth}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleFeatureAuth();
                          }
                        }}
                        sx={{
                          position: 'relative',
                          borderRadius: 3,
                          overflow: 'hidden',
                          cursor: 'pointer',
                          background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.08)} 0%, ${alpha(theme.palette.secondary.main, 0.08)} 100%)`,
                          border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                          boxShadow: `0 8px 28px ${alpha(theme.palette.primary.main, 0.15)}`,
                          ...landingCardHoverSx,
                          '&:hover': {
                            ...landingCardHoverSx['&:hover'],
                            boxShadow: `0 16px 44px ${alpha(theme.palette.primary.main, 0.3)}`,
                            borderColor: alpha(theme.palette.primary.main, 0.4),
                          },
                          '&:focus-visible': {
                            outline: `2px solid ${theme.palette.primary.main}`,
                            outlineOffset: 2,
                          },
                        }}
                      >
                        <Box
                          sx={{
                            position: 'absolute',
                            top: 10,
                            right: 10,
                            zIndex: 2,
                            background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                            px: 1.25,
                            py: 0.4,
                            borderRadius: 2,
                            border: '1px solid rgba(255, 255, 255, 0.25)',
                          }}
                        >
                          <Typography variant="caption" fontWeight={700} color="white" sx={{ fontSize: '0.65rem', textTransform: 'uppercase' }}>
                            {feature.badge}
                          </Typography>
                        </Box>

                        <FeatureCardImage feature={feature} theme={theme} />

                        <Box
                          sx={{
                            p: 1.75,
                            background: `linear-gradient(135deg, ${alpha(theme.palette.common.white, 0.06)} 0%, ${alpha(theme.palette.common.white, 0.02)} 100%)`,
                            backdropFilter: 'blur(12px)',
                          }}
                        >
                          <Stack spacing={1}>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Box
                                sx={{
                                  width: 30,
                                  height: 30,
                                  borderRadius: 1.5,
                                  background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: 'white',
                                  '& .MuiSvgIcon-root': { fontSize: 18 },
                                }}
                              >
                                {feature.icon}
                              </Box>
                              <Typography variant="subtitle2" component="h3" fontWeight={700} color="white" sx={{ fontSize: '0.92rem' }}>
                                {feature.title}
                              </Typography>
                            </Stack>
                            <Typography variant="body2" color="white" sx={{ lineHeight: 1.45, fontSize: '0.8rem', color: alpha('#fff', 0.9) }}>
                              {feature.description}
                            </Typography>
                          </Stack>
                        </Box>
                      </Box>
                    </motion.div>
                  ))}
                </Box>
              </motion.div>
            </AnimatePresence>

            {totalPages > 1 && (
              <>
                <IconButton
                  aria-label="Previous features"
                  onClick={handlePrev}
                  sx={{
                    ...arrowButtonSx,
                    position: 'absolute',
                    left: 8,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    zIndex: 10,
                  }}
                >
                  <ArrowBack />
                </IconButton>
                <IconButton
                  aria-label="Next features"
                  onClick={handleNext}
                  sx={{
                    ...arrowButtonSx,
                    position: 'absolute',
                    right: 8,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    zIndex: 10,
                  }}
                >
                  <ArrowForward />
                </IconButton>
              </>
            )}
              </>
            )}
          </Box>
        </Stack>
      </Container>

      {isMobile && featureDialogIndex !== null && (
        <LandingMobileDetailDialog
          open
          onClose={() => setFeatureDialogIndex(null)}
          title={features[featureDialogIndex].title}
          description={features[featureDialogIndex].description}
          badge={features[featureDialogIndex].badge}
          icon={features[featureDialogIndex].icon}
          media={<FeatureCardImage feature={features[featureDialogIndex]} theme={theme} />}
          actionLabel="Start creating now"
          onAction={handleFeatureAuth}
        />
      )}
    </Box>
  );
};

export default FeatureShowcase;
