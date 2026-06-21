import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Container,
  Typography,
  Stack,
  Grid,
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

const CTA_ROTATE_INTERVAL_MS = 6000;
const HEADLINE_ROTATE_INTERVAL_MS = 12000;

const HEADLINE_PHRASES = [
  'Content Planning',
  'MultiModal Generation',
  'Cross Platform Publishing',
  'All-Analytics One-platform',
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
    if (isSignedIn) {
      navigate('/');
      return;
    }
    openSignIn({ forceRedirectUrl: '/onboarding' });
  };

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
    { icon: <Security />, label: 'Hyper Personalization' },
    { icon: <Shield />, label: 'Fact-Checked Output' },
    { icon: <CloudDone />, label: 'SME AI Platform' },
    { icon: <Verified />, label: 'Connected Platforms' },
  ];

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
    fontSize: '0.85rem',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
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
        bgcolor: '#000',
        color: theme.palette.getContrastText('#000'),
        overflow: 'hidden',
        minHeight: { xs: 'auto', md: '100vh' },
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: 'url(/alwrity_landing_hero_bg.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          zIndex: 0,
        }}
      />

      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
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
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
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
          pt: { xs: 6.5, md: 7 },
          pb: { xs: 2.5, md: 3 },
          position: 'relative',
          zIndex: 3,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <motion.div variants={stagger} initial="hidden" animate="visible" style={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%' }}>
          <Stack spacing={0} alignItems="center" textAlign="center" sx={{ flex: 1, width: '100%' }}>
            {/* Top chips — close below fixed nav */}
            <motion.div variants={fadeInUp} style={{ width: '100%' }}>
              <Stack
                direction="row"
                spacing={1.5}
                alignItems="center"
                flexWrap="wrap"
                justifyContent="center"
                sx={{ mb: { xs: 2.5, md: 3.5 }, mt: 0 }}
              >
                <Chip
                  icon={<RocketLaunch sx={{ fontSize: '1rem !important' }} />}
                  label="AI Marketing Platform"
                  variant="outlined"
                  onClick={handleAuthNavigation}
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
                  onClick={handleAuthNavigation}
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
                  fontSize: { xs: '2.1rem', sm: '2.65rem', md: '3.35rem', lg: '3.85rem' },
                  fontWeight: 900,
                  letterSpacing: '-0.03em',
                  lineHeight: 1.06,
                  mb: { xs: 2.75, md: 4 },
                  color: '#fff',
                  textShadow: `
                    0 2px 10px rgba(0, 0, 0, 0.8),
                    0 4px 20px rgba(0, 0, 0, 0.6),
                    0 0 40px rgba(102, 126, 234, 0.3)
                  `,
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
                sx={{
                  fontSize: { xs: '0.95rem', sm: '1.1rem', md: '1.25rem' },
                  fontWeight: 500,
                  maxWidth: '780px',
                  mx: 'auto',
                  lineHeight: 1.45,
                  mb: { xs: 3.25, md: 4.5 },
                  color: 'rgba(255, 255, 255, 0.92)',
                  textShadow: `
                    0 2px 8px rgba(0, 0, 0, 0.8),
                    0 4px 16px rgba(0, 0, 0, 0.5)
                  `,
                }}
              >
                ALwrity learns your brand voice, outsmarts your competitors, and publishes on every
                channel — AI enterprise firepower, without the complexity
              </Typography>
            </motion.div>

            <Box sx={{ flex: 1, minHeight: { xs: 24, md: 48 }, width: '100%' }} />

            {/* Glass CTA panel — anchored toward bottom of hero */}
            <motion.div variants={fadeInUp} style={{ width: '100%', marginTop: 'auto' }}>
              <Box
                sx={{
                  ...glassPanelSx,
                  px: { xs: 2.25, md: 3 },
                  py: { xs: 2.75, md: 3.25 },
                  minHeight: { xs: 220, md: 260 },
                  maxWidth: 560,
                  width: '100%',
                  mx: 'auto',
                  mb: { xs: 1.25, md: 1.5 },
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <Stack spacing={0} alignItems="center" sx={{ width: '100%', flex: 1, justifyContent: 'space-evenly' }}>
                  <Button
                    onClick={handleAuthNavigation}
                    variant="contained"
                    size="large"
                    startIcon={<Lightbulb sx={{ fontSize: '1.35rem !important' }} />}
                    sx={{
                      py: 1.55,
                      px: 4,
                      fontSize: { xs: '1.05rem', md: '1.12rem' },
                      fontWeight: 700,
                      borderRadius: 2.5,
                      width: 'auto',
                      minWidth: { xs: 240, sm: 270 },
                      maxWidth: 320,
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
                      fontSize: { xs: '0.82rem', md: '0.92rem' },
                      mt: 2.75,
                      mb: 0,
                      lineHeight: 1.5,
                      textShadow: '0 2px 6px rgba(0, 0, 0, 0.7)',
                    }}
                  >
                    Bring Your Own Keys • No vendor lock-in • Enterprise security
                  </Typography>

                  <Grid
                    container
                    spacing={{ xs: 1, md: 1.25 }}
                    sx={{ mx: 'auto', maxWidth: 420, mt: 3 }}
                  >
                    {stats.map((stat, index) => (
                      <Grid item xs={6} md={3} key={index}>
                        <Stack alignItems="center" spacing={0.35}>
                          <Box sx={{ width: '100%', maxWidth: 44 }}>
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
                            variant="h5"
                            sx={{
                              fontWeight: 800,
                              fontSize: { xs: '0.85rem', md: '0.95rem' },
                              color: '#fff',
                              lineHeight: 1.2,
                            }}
                          >
                            {stat.value}*
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{
                              color: 'rgba(255, 255, 255, 0.7)',
                              fontWeight: 600,
                              fontSize: '0.52rem',
                              lineHeight: 1.15,
                              textAlign: 'center',
                            }}
                          >
                            {stat.label}
                          </Typography>
                        </Stack>
                      </Grid>
                    ))}
                  </Grid>

                  <Typography
                    variant="caption"
                    sx={{
                      color: 'rgba(255, 255, 255, 0.55)',
                      fontSize: '0.58rem',
                      fontStyle: 'italic',
                      mt: 0.75,
                    }}
                  >
                    *Based on internal beta user surveys, 2025.
                  </Typography>
                </Stack>
              </Box>
            </motion.div>

            {/* Trust badges */}
            <motion.div variants={fadeInUp} style={{ width: '100%' }}>
              <Stack
                direction="row"
                spacing={{ xs: 0.75, md: 1.5 }}
                alignItems="center"
                flexWrap="wrap"
                justifyContent="center"
                sx={{ mt: { xs: 1.25, md: 1.5 } }}
              >
                {trustSignals.map((signal, index) => (
                  <Stack
                    key={index}
                    direction="row"
                    spacing={0.75}
                    alignItems="center"
                    sx={{
                      background: 'rgba(0, 0, 0, 0.3)',
                      backdropFilter: 'blur(8px)',
                      px: { xs: 1, md: 1.25 },
                      py: 0.5,
                      borderRadius: 2,
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                    }}
                  >
                    <Box sx={{ color: theme.palette.success.light, display: 'flex' }}>
                      {React.cloneElement(signal.icon as React.ReactElement, { sx: { fontSize: 18 } })}
                    </Box>
                    <Typography
                      variant="caption"
                      sx={{
                        color: 'rgba(255, 255, 255, 0.95)',
                        fontWeight: 600,
                        fontSize: { xs: '0.65rem', md: '0.68rem' },
                      }}
                    >
                      {signal.label}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </motion.div>
          </Stack>
        </motion.div>
      </Container>
    </Box>
  );
};

export default HeroSection;
