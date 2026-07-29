import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Container,
  Typography,
  Stack,
  Chip,
  useTheme,
  alpha,
} from '@mui/material';
import { useAuth, useClerk } from '@clerk/clerk-react';
import {
  RocketLaunch,
  Lightbulb,
  Verified,
  Security,
  Shield,
  CloudDone,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { ScrambleText } from '../ScrambleText';
import { scrollToLandingSection, scrollToLandingSectionWithRetry, type LandingSectionId } from '../../utils/landingNavigation';
import { getPostAuthDestination } from '../../utils/returningUserStorage';

const CTA_ROTATE_INTERVAL_MS = 6000;
const HEADLINE_ROTATE_INTERVAL_MS = 12000;

const HEADLINE_PHRASES = [
  'Content Planning',
  'MultiModal Generation',
  'Cross Platform Publishing',
  'All-in-One Analytics Platform',
  'Content Engagement',
  'Content Remarketing',
];

const ScramblingText: React.FC<{
  phrases: string[];
  interval?: number;
  duration?: number;
  delay?: number;
  variant?: 'headline' | 'button';
}> = ({
  phrases,
  interval = 4000,
  duration = 800,
  delay = 200,
  variant = 'headline',
}) => {
  const [currentIndex, setCurrentIndex] = React.useState(0);

  React.useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % phrases.length);
    }, interval);
    return () => clearInterval(timer);
  }, [phrases.length, interval]);

  const variantStyle =
    variant === 'button'
      ? { color: '#fff', fontWeight: 700 }
      : {
          color: '#fff',
          fontWeight: 900,
          textShadow: `
          0 2px 10px rgba(0, 0, 0, 0.9),
          0 4px 20px rgba(0, 0, 0, 0.7),
          0 0 40px rgba(102, 126, 234, 0.4)
        `,
        };

  return (
    <ScrambleText
      text={phrases[currentIndex]}
      duration={duration}
      delay={delay}
      restartInterval={interval}
      as="span"
      className="scramble-text"
      style={variantStyle}
    />
  );
};

const HeroSection: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { isSignedIn } = useAuth();
  const { openSignIn } = useClerk();

  const handleAuthNavigation = () => {
    const destination = getPostAuthDestination();
    if (isSignedIn) {
      navigate(destination);
      return;
    }
    openSignIn({ forceRedirectUrl: destination });
  };

  const handleChipScroll = (section: LandingSectionId) => {
    if (section === 'features') {
      scrollToLandingSectionWithRetry('features');
      return;
    }
    scrollToLandingSection(section);
  };

  const primaryCtaSx = {
    py: { xs: 1.89, md: 1.55 },
    px: { xs: 4, md: 4 },
    fontSize: { xs: '1.22rem', md: '1.12rem' },
    fontWeight: 700,
    borderRadius: 2.5,
    width: { xs: '100%', md: 'auto' },
    minWidth: { xs: '100%', sm: 270 },
    maxWidth: { xs: '100%', md: 320 },
    minHeight: { xs: 52, md: 48 },
    background: 'linear-gradient(45deg, #667eea 30%, #764ba2 90%)',
    backgroundImage: `
      linear-gradient(120deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%),
      linear-gradient(45deg, #667eea 30%, #764ba2 90%)
    `,
    backgroundSize: '200% 100%, 100% 100%',
    backgroundPosition: '200% 0, 0 0',
    boxShadow: '0 10px 40px rgba(102, 126, 234, 0.4)',
    '&:hover': {
      boxShadow: '0 15px 50px rgba(102, 126, 234, 0.5)',
      transform: 'translateY(-2px)',
      backgroundPosition: '0 0, 0 0',
    },
    transition: 'all 0.3s ease',
    animation: 'shimmer 2.5s ease-in-out infinite',
    '@keyframes shimmer': {
      '0%': { backgroundPosition: '200% 0, 0 0' },
      '100%': { backgroundPosition: '-200% 0, 0 0' },
    },
  } as const;

  const fadeInUp = {
    hidden: { opacity: 0, y: 24 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' as const } },
  };

  const stagger = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.1 } },
  };

  const stats = [
    { value: '70%', label: 'Time Savings' },
    { value: '65%', label: 'Better Engagement' },
    { value: '5x', label: 'Faster Publishing' },
    { value: '21%', label: 'More ROI Tracking' },
  ];

  const trustSignals = [
    { icon: <Security />, label: 'Hyper Personalization', mobileLabel: 'Hyper\nPersonalization' },
    { icon: <Shield />, label: 'Fact-Checked Output', mobileLabel: 'Fact-Checked\nOutput' },
    { icon: <CloudDone />, label: 'SME AI Platform', mobileLabel: 'SME AI\nPlatform' },
    { icon: <Verified />, label: 'Connected Platforms', mobileLabel: 'Connected\nPlatforms' },
  ] as const;

  const glassPanelSx = {
    background: `linear-gradient(135deg, ${alpha(theme.palette.common.white, 0.08)} 0%, ${alpha(theme.palette.common.white, 0.03)} 100%)`,
    backdropFilter: 'blur(16px) saturate(180%)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 3,
    boxShadow: '0 12px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)',
  } as const;

  const chipSx = {
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: { xs: '0.78rem', md: '0.85rem' },
    height: { xs: 32, md: 'auto' },
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    '& .MuiChip-label': {
      px: { xs: 0.75, md: 1.25 },
    },
    '&:hover': {
      transform: 'translateY(-2px)',
      boxShadow: `0 4px 16px ${alpha(theme.palette.primary.main, 0.35)}`,
    },
  };

  return (
    <Box
      id="hero"
      sx={{
        position: 'relative',
        bgcolor: '#0a0a0a',
        color: theme.palette.getContrastText('#000'),
        overflow: 'hidden',
        minHeight: { xs: 'auto', md: '100vh' },
        pb: { xs: 3.5, md: 0 },
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          top: { xs: -32, md: 0 },
          left: { xs: -16, md: 0 },
          right: { xs: -16, md: 0 },
          bottom: { xs: -48, md: 0 },
          backgroundImage: 'url(/alwrity_landing_hero_bg.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          transform: { xs: 'scale(1.12)', md: 'none' },
          transformOrigin: 'center center',
          zIndex: 0,
        }}
      />

      <Box
        sx={{
          position: 'absolute',
          top: { xs: -32, md: 0 },
          left: { xs: -16, md: 0 },
          right: { xs: -16, md: 0 },
          bottom: { xs: -48, md: 0 },
          background: `
            linear-gradient(135deg,
              rgba(0, 0, 0, 0.55) 0%,
              rgba(0, 0, 0, 0.45) 50%,
              rgba(0, 0, 0, 0.50) 100%
            )
          `,
          zIndex: 1,
        }}
      />

      <Box
        sx={{
          position: 'absolute',
          top: { xs: -32, md: 0 },
          left: { xs: -16, md: 0 },
          right: { xs: -16, md: 0 },
          bottom: { xs: -48, md: 0 },
          background: `
            radial-gradient(circle at 50% 50%, ${alpha(theme.palette.primary.main, 0.10)} 0%, transparent 60%),
            radial-gradient(circle at 20% 80%, ${alpha(theme.palette.secondary.main, 0.08)} 0%, transparent 50%)
          `,
          zIndex: 2,
        }}
      />

      <Container
        maxWidth="lg"
        sx={{
          pt: { xs: 9, md: 10.5 },
          pb: { xs: 0, md: 3 },
          position: 'relative',
          zIndex: 3,
          flex: { xs: '0 0 auto', md: 1 },
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="visible"
          style={{ width: '100%' }}
        >
          <Stack
            spacing={0}
            alignItems="center"
            textAlign="center"
            sx={{ flex: { xs: '0 0 auto', md: 1 }, width: '100%' }}
          >
            {/* Top chips — flush below fixed nav on mobile */}
            <motion.div variants={fadeInUp} style={{ width: '100%' }}>
              <Stack
                direction="row"
                spacing={{ xs: 1, md: 7.5 }}
                alignItems="center"
                flexWrap="wrap"
                justifyContent="center"
                sx={{
                  mb: { xs: 3, md: 2 },
                  mt: { xs: 0, md: 0 },
                  display: { xs: 'none', md: 'flex' },
                }}
              >
                <Chip
                  icon={<RocketLaunch sx={{ fontSize: '1rem !important' }} />}
                  label="AI Marketing Platform"
                  variant="outlined"
                  onClick={() => handleChipScroll('lifecycle')}
                  sx={{
                    ...chipSx,
                    background: alpha(theme.palette.primary.main, 0.15),
                    borderColor: theme.palette.primary.main,
                    color: theme.palette.primary.light,
                  }}
                />
                <Chip
                  icon={<Verified sx={{ fontSize: '1rem !important' }} />}
                  label="AI-First Copilot"
                  variant="outlined"
                  onClick={() => handleChipScroll('features')}
                  sx={{
                    ...chipSx,
                    background: alpha(theme.palette.success.main, 0.15),
                    borderColor: theme.palette.success.main,
                    color: theme.palette.success.light,
                  }}
                />
              </Stack>
            </motion.div>

            {/* Headline */}
            <motion.div variants={fadeInUp} style={{ width: '100%' }}>
              <Typography
                variant="h1"
                component="h1"
                sx={{
                  fontSize: { xs: '2.05rem', sm: '2.35rem', md: '3.1rem', lg: '3.5rem' },
                  fontWeight: 900,
                  letterSpacing: '-0.03em',
                  lineHeight: 1.08,
                  mt: { xs: 0, md: 0 },
                  mb: { xs: 2, md: 4 },
                  color: '#fff',
                  textAlign: 'center',
                  whiteSpace: { xs: 'normal', sm: 'nowrap' },
                  textShadow: `
                    0 2px 10px rgba(0, 0, 0, 0.8),
                    0 4px 20px rgba(0, 0, 0, 0.6),
                    0 0 40px rgba(102, 126, 234, 0.3)
                  `,
                  '& .scramble-text': {
                    whiteSpace: { xs: 'normal', sm: 'nowrap' },
                  },
                }}
              >
                AI Copilot for{' '}
                <ScramblingText
                  phrases={HEADLINE_PHRASES}
                  interval={HEADLINE_ROTATE_INTERVAL_MS}
                  duration={500}
                />
              </Typography>
            </motion.div>

            {/* Subhead */}
            <motion.div variants={fadeInUp} style={{ width: '100%' }}>
              <Typography
                variant="h4"
                component="p"
                sx={{
                  fontSize: { xs: '0.95rem', sm: '1.1rem', md: '1.25rem' },
                  fontWeight: 500,
                  maxWidth: '780px',
                  mx: 'auto',
                  lineHeight: 1.45,
                  mb: { xs: 2, md: 4.5 },
                  color: 'rgba(255, 255, 255, 0.92)',
                  textShadow: `
                    0 2px 8px rgba(0, 0, 0, 0.8),
                    0 4px 16px rgba(0, 0, 0, 0.5)
                  `,
                }}
              >
                <Box component="span" sx={{ display: { xs: 'block', md: 'none' } }}>
                  ALwrity learns Your brand voice, outsmarts your competitors, and publishes on every channel —
                  <Box component="span" sx={{ display: 'block' }}>
                    AI Enterprise Firepower, without the Complexity
                  </Box>
                </Box>
                <Box component="span" sx={{ display: { xs: 'none', md: 'inline' } }}>
                  ALwrity learns Your brand voice, outsmarts your competitors, and publishes on every channel — AI
                  Enterprise Firepower, without the Complexity
                </Box>
              </Typography>
            </motion.div>

            {/* Mobile-first CTA — visible above the fold on small screens (TC 011) */}
            <motion.div variants={fadeInUp} style={{ width: '100%' }}>
              <Box
                sx={{
                  display: { xs: 'flex', md: 'none' },
                  justifyContent: 'center',
                  mb: { xs: 2, md: 2 },
                  mt: { xs: 0, md: 0 },
                  px: { xs: 2, sm: 2.5 },
                  width: '100%',
                }}
              >
                <Button
                  onClick={handleAuthNavigation}
                  variant="contained"
                  size="large"
                  startIcon={<Lightbulb sx={{ fontSize: { xs: '1.5rem !important', md: '1.35rem !important' } }} />}
                  sx={primaryCtaSx}
                >
                  <ScramblingText
                    phrases={['Start Free Trial', 'Get Started Now', 'Try AI Copilot']}
                    interval={CTA_ROTATE_INTERVAL_MS}
                    duration={500}
                    delay={0}
                    variant="button"
                  />
                </Button>
              </Box>
            </motion.div>

            {/* Glass CTA panel — stats anchored to bottom on mobile */}
            <motion.div
              variants={fadeInUp}
              style={{ width: '100%', display: 'flex', justifyContent: 'center' }}
            >
              <Box
                sx={{
                  ...glassPanelSx,
                  px: { xs: 1.5, md: 3 },
                  py: { xs: 1.08, md: 3.25 },
                  minHeight: { xs: 124, md: 260 },
                  maxWidth: 560,
                  width: '100%',
                  mx: 'auto',
                  mt: { xs: 2, md: 0 },
                  mb: { xs: 1, md: 1.5 },
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: { xs: 'flex-end', md: 'space-between' },
                }}
              >
                <Box sx={{ flex: { xs: 1, md: 0 }, minHeight: 0, width: '100%', display: { xs: 'block', md: 'none' } }} />

                <Stack
                  spacing={0}
                  alignItems="center"
                  sx={{
                    width: '100%',
                    flex: { xs: '0 0 auto', md: 1 },
                    justifyContent: { xs: 'flex-end', md: 'space-evenly' },
                  }}
                >
                  <Button
                    onClick={handleAuthNavigation}
                    variant="contained"
                    size="large"
                    startIcon={<Lightbulb sx={{ fontSize: '1.35rem !important' }} />}
                    sx={{
                      ...primaryCtaSx,
                      display: { xs: 'none', md: 'inline-flex' },
                    }}
                  >
                    <ScramblingText
                      phrases={['Start Free Trial', 'Get Started Now', 'Try AI Copilot']}
                      interval={CTA_ROTATE_INTERVAL_MS}
                      duration={500}
                      delay={0}
                      variant="button"
                    />
                  </Button>

                  <Typography
                    variant="body2"
                    sx={{
                      color: 'rgba(255, 255, 255, 0.9)',
                      fontWeight: 500,
                      fontSize: { xs: '0.78rem', md: '0.92rem' },
                      mt: { xs: 0, md: 2.75 },
                      mb: { xs: 0, md: 0 },
                      lineHeight: 1.45,
                      textAlign: 'center',
                      width: '100%',
                      textShadow: '0 2px 6px rgba(0, 0, 0, 0.7)',
                    }}
                  >
                    AI Marketing OS • No vendor lock-in • Enterprise security
                  </Typography>

                  <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center', mt: { xs: 1.75, md: 2.25 } }}>
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: {
                          xs: 'repeat(4, minmax(0, 1fr))',
                          md: 'repeat(4, minmax(0, 1fr))',
                        },
                        gap: { xs: 0.5, md: 2 },
                        width: '100%',
                        maxWidth: { xs: '100%', md: 460 },
                        mx: 'auto',
                      }}
                    >
                      {stats.map((stat, index) => (
                        <Stack
                          key={index}
                          spacing={{ xs: 0.6, md: 1.15 }}
                          alignItems="center"
                          sx={{ width: '100%', minWidth: 0 }}
                        >
                          <Typography
                            variant="h5"
                            component="p"
                            sx={{
                              order: { xs: 1, md: 3 },
                              fontWeight: 800,
                              fontSize: { xs: '0.82rem', md: '0.95rem' },
                              color: '#fff',
                              lineHeight: 1.1,
                              textAlign: 'center',
                              width: '100%',
                              m: 0,
                              mb: { xs: 0.35, md: 0 },
                              mt: { xs: 0, md: 2 },
                            }}
                          >
                            {stat.value}*
                          </Typography>
                          <Box
                            sx={{
                              order: { xs: 2, md: 1 },
                              width: '100%',
                              maxWidth: { xs: 36, md: 44 },
                              my: { xs: 0.2, md: 0 },
                              mb: { xs: 0.25, md: 0.5 },
                            }}
                          >
                            <Box
                              sx={{
                                height: 3,
                                borderRadius: 2,
                                background: 'rgba(255, 255, 255, 0.1)',
                                overflow: 'hidden',
                              }}
                            >
                              <Box
                                sx={{
                                  height: '100%',
                                  width: stat.value,
                                  background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
                                  borderRadius: 2,
                                  boxShadow: '0 0 8px rgba(102, 126, 234, 0.5)',
                                }}
                              />
                            </Box>
                          </Box>
                          <Typography
                            variant="caption"
                            sx={{
                              order: { xs: 3, md: 2 },
                              color: 'rgba(255, 255, 255, 0.85)',
                              fontWeight: 600,
                              fontSize: { xs: '0.58rem', md: '0.6rem' },
                              lineHeight: 1.15,
                              textAlign: 'center',
                              width: '100%',
                              px: 0.15,
                              mt: { xs: 0.25, md: 0.65 },
                              mb: { xs: 0, md: 1 },
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                            }}
                          >
                            {stat.label}
                          </Typography>
                        </Stack>
                      ))}
                    </Box>
                  </Box>

                  <Typography
                    variant="caption"
                    sx={{
                      color: 'rgba(255, 255, 255, 0.55)',
                      fontSize: '0.6rem',
                      fontStyle: 'italic',
                      mt: { xs: 0.5, md: 0.75 },
                      width: '100%',
                      textAlign: 'center',
                    }}
                  >
                    *Based on internal beta user surveys, 2025.
                  </Typography>
                </Stack>
              </Box>
            </motion.div>

            {/* Trust badges — mobile: icon + 2-line label, no pill box */}
            <motion.div variants={fadeInUp} style={{ width: '100%' }}>
              <Box
                sx={{
                  display: { xs: 'grid', md: 'flex' },
                  gridTemplateColumns: { xs: 'repeat(4, minmax(0, 1fr))', md: 'none' },
                  flexWrap: { md: 'wrap' },
                  gap: { xs: 0.5, md: 1.5 },
                  alignItems: { xs: 'flex-start', md: 'center' },
                  justifyContent: 'center',
                  width: '100%',
                  mt: { xs: 2, md: 1.5 },
                  mb: { xs: 0.5, md: 0 },
                }}
              >
                {trustSignals.map((signal, index) => (
                  <Stack
                    key={index}
                    direction={{ xs: 'column', md: 'row' }}
                    spacing={{ xs: 0.35, md: 0.75 }}
                    alignItems="center"
                    sx={{
                      minWidth: 0,
                      background: { xs: 'transparent', md: 'rgba(0, 0, 0, 0.3)' },
                      backdropFilter: { xs: 'none', md: 'blur(8px)' },
                      px: { xs: 0, md: 1.25 },
                      py: { xs: 0, md: 0.5 },
                      borderRadius: { xs: 0, md: 2 },
                      border: { xs: 'none', md: '1px solid rgba(255, 255, 255, 0.1)' },
                    }}
                  >
                    <Box sx={{ color: theme.palette.success.light, display: 'flex' }}>
                      {React.cloneElement(signal.icon as React.ReactElement, {
                        sx: { fontSize: { xs: 20, md: 18 } },
                      })}
                    </Box>
                    <Typography
                      variant="caption"
                      sx={{
                        display: { xs: 'block', md: 'none' },
                        color: 'rgba(255, 255, 255, 0.95)',
                        fontWeight: 600,
                        fontSize: '0.58rem',
                        lineHeight: 1.15,
                        textAlign: 'center',
                        whiteSpace: 'pre-line',
                      }}
                    >
                      {signal.mobileLabel}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        display: { xs: 'none', md: 'block' },
                        color: 'rgba(255, 255, 255, 0.95)',
                        fontWeight: 600,
                        fontSize: '0.68rem',
                        lineHeight: 1.15,
                        textAlign: { md: 'left' },
                      }}
                    >
                      {signal.label}
                    </Typography>
                  </Stack>
                ))}
              </Box>
            </motion.div>
          </Stack>
        </motion.div>
      </Container>
    </Box>
  );
};

export default HeroSection;
