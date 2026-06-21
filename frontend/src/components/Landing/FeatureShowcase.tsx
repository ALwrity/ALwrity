import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, useClerk } from '@clerk/clerk-react';
import { Box, Container, Typography, Stack, IconButton, useTheme, alpha, Theme } from '@mui/material';
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
  landingSectionHeaderGap,
  landingCardHoverSx,
} from './landingStyles';

interface Feature {
  image: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  badge: string;
}

const PRIMARY_SECTION_BG = '/alwrity_platform_experience.png';
const FALLBACK_SECTION_BG = '/alwrity_co_pilote.png';

const features: Feature[] = [
  {
    image: '/Alwrity-copilot1.png',
    title: 'AI-First Copilot',
    description: 'Your personal LinkedIn writing assistant with persona-aware content generation. Create professional posts, articles, and carousels that match your unique voice.',
    icon: <Assistant />,
    badge: 'Persona-Aware',
  },
  {
    image: '/Alwrity-copilot2.png',
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
    image: '/ALwrity-assistive-writing.png',
    title: 'Assistive Writing Flow',
    description: 'Smart writing assistant that contextually continues your thoughts. Never face writer\'s block again with AI that understands your draft and goals.',
    icon: <Edit />,
    badge: 'Smart Assist',
  },
  {
    image: '/Fact-check1.png',
    title: 'Hallucination-Free Content',
    description: 'Advanced fact-checking with source verification and credibility scoring. Every claim is analyzed, validated, and cited with authority ratings.',
    icon: <FactCheck />,
    badge: 'Verified',
  },
  {
    image: '/Alwrity-fact-check.png',
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
  const [currentPage, setCurrentPage] = useState(0);
  const [sectionBg, setSectionBg] = useState(PRIMARY_SECTION_BG);
  const itemsPerPage = 3;
  const totalPages = Math.ceil(features.length / itemsPerPage);

  useEffect(() => {
    const img = new Image();
    img.onload = () => setSectionBg(PRIMARY_SECTION_BG);
    img.onerror = () => setSectionBg(FALLBACK_SECTION_BG);
    img.src = PRIMARY_SECTION_BG;
  }, []);

  const handleFeatureClick = useCallback(() => {
    if (isSignedIn) {
      navigate('/');
      return;
    }
    openSignIn({ forceRedirectUrl: '/onboarding' });
  }, [isSignedIn, navigate, openSignIn]);

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

  return (
    <Box
      id="features"
      sx={{
        position: 'relative',
        backgroundImage: `url(${sectionBg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        minHeight: { xs: 'auto', md: '100vh' },
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        '&::after': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.35) 0%, rgba(25, 118, 210, 0.2) 50%, rgba(156, 39, 176, 0.2) 100%)',
          zIndex: 1,
        },
      }}
    >
      <Container
        maxWidth="xl"
        sx={{
          pb: { xs: 3, md: 3.5 },
          pt: { xs: 2, md: 2.5 },
          position: 'relative',
          zIndex: 2,
        }}
      >
        <Stack spacing={0} alignItems="center">
          <Stack spacing={1.25} alignItems="center" textAlign="center" sx={{ mb: landingSectionHeaderGap, mt: 0 }}>
            <Typography variant="h3" component="h2" sx={{ ...landingSectionTitleSx, color: '#fff' }}>
              Experience the Platform
            </Typography>
            <Typography
              variant="body1"
              maxWidth="780px"
              sx={{ ...landingSectionSubtitleSx, color: alpha('#fff', 0.9), fontSize: { xs: '0.95rem', md: '1.05rem' } }}
            >
              See ALwrity in action: AI copilot writing, live web research, and built-in fact-checking
              — Transform your content workflow on one Dashboard
            </Typography>
          </Stack>

          <Box sx={{ position: 'relative', width: '100%', overflow: 'visible', px: { xs: 5, md: 9 } }}>
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
                        onClick={handleFeatureClick}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleFeatureClick();
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
                              <Typography variant="subtitle2" fontWeight={700} color="white" sx={{ fontSize: '0.92rem' }}>
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
                    position: 'absolute',
                    left: { xs: 4, md: 8 },
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                    color: 'white',
                    width: 44,
                    height: 44,
                    zIndex: 10,
                    boxShadow: `0 4px 16px ${alpha(theme.palette.primary.main, 0.4)}`,
                  }}
                >
                  <ArrowBack />
                </IconButton>
                <IconButton
                  aria-label="Next features"
                  onClick={handleNext}
                  sx={{
                    position: 'absolute',
                    right: { xs: 4, md: 8 },
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                    color: 'white',
                    width: 44,
                    height: 44,
                    zIndex: 10,
                    boxShadow: `0 4px 16px ${alpha(theme.palette.primary.main, 0.4)}`,
                  }}
                >
                  <ArrowForward />
                </IconButton>
              </>
            )}
          </Box>

          {totalPages > 1 && (
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 2 }}>
              {Array.from({ length: totalPages }).map((_, index) => (
                <Box
                  key={index}
                  role="button"
                  tabIndex={0}
                  aria-label={`Go to feature page ${index + 1}`}
                  onClick={() => setCurrentPage(index)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') setCurrentPage(index);
                  }}
                  sx={{
                    width: index === currentPage ? 28 : 8,
                    height: 8,
                    borderRadius: 4,
                    cursor: 'pointer',
                    background: index === currentPage
                      ? `linear-gradient(90deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`
                      : alpha('#fff', 0.25),
                    transition: 'all 0.3s ease',
                  }}
                />
              ))}
            </Stack>
          )}
        </Stack>
      </Container>
    </Box>
  );
};

export default FeatureShowcase;
