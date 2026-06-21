import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Container,
  Typography,
  Stack,
  Grid,
  Card,
  CardContent,
  useTheme,
  alpha,
} from '@mui/material';
import { useClerk } from '@clerk/clerk-react';
import {
  RocketLaunch,
  Business,
  ContentCopy,
  TrendingUp,
  People,
  Code,
  Security,
  Speed,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { landingSectionTitleSx, landingSectionSubtitleSx } from './landingStyles';

const IntroducingAlwrity: React.FC = () => {
  const theme = useTheme();
  const [imageLoaded, setImageLoaded] = useState(false);
  const { openSignIn } = useClerk();

  useEffect(() => {
    const img = new Image();
    img.onload = () => setImageLoaded(true);
    img.src = '/alwrity_landing_bg_vortex.png';
  }, []);

  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' as const } },
  };

  const stagger = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.1 } },
  };

  const platformCapabilities = [
    {
      icon: <Code />,
      title: 'Open Source Foundation',
      description: 'Built with transparency and community in mind. Full source code available on GitHub for inspection and contribution.',
      highlight: '100% Open Source',
    },
    {
      icon: <Security />,
      title: 'Privacy First',
      description: 'Your data stays yours. No tracking, no data mining, no selling of user information. Complete privacy protection.',
      highlight: 'Zero Tracking',
    },
    {
      icon: <Speed />,
      title: 'Lightning Fast',
      description: 'Optimized for speed and efficiency. Generate high-quality content in seconds, not minutes.',
      highlight: 'Sub-second Response',
    },
  ];

  const socialProofStats = [
    { icon: <Business />, value: '1K+', label: 'GitHub Stars' },
    { icon: <ContentCopy />, value: '10K+', label: 'Content Pieces Generated' },
    { icon: <TrendingUp />, value: '95%', label: 'User Satisfaction' },
    { icon: <People />, value: '500+', label: 'Active Contributors' },
  ];

  const glassCardSx = {
    background: `linear-gradient(135deg, ${alpha(theme.palette.common.white, 0.08)} 0%, ${alpha(theme.palette.common.white, 0.03)} 100%)`,
    backdropFilter: 'blur(16px)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 3,
    boxShadow: '0 12px 28px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08)',
  } as const;

  return (
    <Box
      sx={{
        position: 'relative',
        minHeight: { xs: 'auto', md: 'auto' },
        py: { xs: 3.5, md: 4.5 },
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        backgroundColor: '#0a0a0a',
        overflow: 'visible',
        '&::after': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: 'url(/alwrity_landing_bg_vortex.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          opacity: imageLoaded ? 0.82 : 0,
          transition: 'opacity 0.8s ease',
          zIndex: 0,
        },
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(135deg, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.55) 100%)',
          zIndex: 1,
        },
      }}
    >
      <Container maxWidth="lg" sx={{ py: { xs: 2, md: 2.5 }, position: 'relative', zIndex: 2 }}>
        <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.15 }}>
          <Stack spacing={{ xs: 2.25, md: 2.75 }} alignItems="center" textAlign="center">
            {/* Main header */}
            <motion.div variants={fadeInUp}>
              <Typography variant="h3" component="h2" sx={{ ...landingSectionTitleSx, color: 'white' }}>
                Welcome to ALwrity
              </Typography>
            </motion.div>

            {/* Description */}
            <motion.div variants={fadeInUp}>
              <Typography
                variant="h6"
                component="p"
                color="rgba(255,255,255,0.9)"
                maxWidth="720px"
                sx={{ ...landingSectionSubtitleSx, fontWeight: 400, fontSize: { xs: '0.95rem', md: '1.05rem' } }}
              >
                Transform from a manual implementer to a strategic director. ALwrity automates the entire
                content strategy process with AI-powered intelligence.
              </Typography>
            </motion.div>

            {/* CTA */}
            <motion.div variants={fadeInUp}>
              <Button
                onClick={() => openSignIn({ forceRedirectUrl: '/onboarding' })}
                variant="contained"
                size="large"
                startIcon={<RocketLaunch />}
                sx={{
                  py: 1.5,
                  px: 4.5,
                  fontSize: '1.05rem',
                  fontWeight: 600,
                  borderRadius: 2,
                  background: 'linear-gradient(45deg, #667eea 30%, #764ba2 90%)',
                  boxShadow: '0 8px 32px rgba(102, 126, 234, 0.3)',
                  '&:hover': {
                    boxShadow: '0 12px 40px rgba(102, 126, 234, 0.4)',
                    transform: 'translateY(-2px)',
                  },
                  transition: 'all 0.3s ease',
                }}
              >
                Start free with ALwrity
              </Button>
            </motion.div>

            {/* Sub header */}
            <motion.div variants={fadeInUp} style={{ width: '100%' }}>
              <Stack spacing={1} alignItems="center" sx={{ pt: { xs: 1, md: 1.5 } }}>
                <Typography
                  variant="h4"
                  component="h3"
                  sx={{
                    fontWeight: 700,
                    fontSize: { xs: '1.35rem', md: '1.65rem' },
                    color: 'white',
                    letterSpacing: '-0.02em',
                  }}
                >
                  Why Choose ALwrity?
                </Typography>
                <Typography
                  variant="body1"
                  color="rgba(255,255,255,0.85)"
                  sx={{
                    fontSize: { xs: '0.88rem', md: '0.92rem' },
                    whiteSpace: { xs: 'normal', md: 'nowrap' },
                    maxWidth: '100%',
                  }}
                >
                  Built for creators, by creators. Open-source, privacy-focused, and designed to scale with your ambitions.
                </Typography>
              </Stack>
            </motion.div>

            {/* Capability cards */}
            <Grid container spacing={2} sx={{ width: '100%' }}>
              {platformCapabilities.map((capability, index) => (
                <Grid item xs={12} md={4} key={index}>
                  <motion.div variants={fadeInUp}>
                    <Card
                      sx={{
                        ...glassCardSx,
                        height: '100%',
                        transition: 'all 0.3s ease',
                        '&:hover': {
                          transform: 'translateY(-6px)',
                          boxShadow: `0 20px 40px ${alpha(theme.palette.primary.main, 0.18)}`,
                          borderColor: alpha('#fff', 0.2),
                        },
                      }}
                    >
                      <CardContent sx={{ p: 2.5 }}>
                        <Stack spacing={2}>
                          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                            <Box
                              sx={{
                                width: 44,
                                height: 44,
                                borderRadius: 2,
                                background: `linear-gradient(45deg, ${alpha(theme.palette.primary.main, 0.2)}, ${alpha(theme.palette.secondary.main, 0.2)})`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: theme.palette.primary.main,
                                '& .MuiSvgIcon-root': { fontSize: 22 },
                              }}
                            >
                              {capability.icon}
                            </Box>
                            <Typography
                              variant="caption"
                              sx={{
                                background: alpha(theme.palette.primary.main, 0.1),
                                color: theme.palette.primary.main,
                                fontWeight: 600,
                                px: 1.25,
                                py: 0.35,
                                borderRadius: 1,
                                fontSize: '0.7rem',
                              }}
                            >
                              {capability.highlight}
                            </Typography>
                          </Stack>
                          <Stack spacing={0.75}>
                            <Typography variant="subtitle1" fontWeight={700} sx={{ color: 'white', fontSize: '0.95rem' }}>
                              {capability.title}
                            </Typography>
                            <Typography variant="body2" color="rgba(255,255,255,0.8)" lineHeight={1.5} sx={{ fontSize: '0.82rem' }}>
                              {capability.description}
                            </Typography>
                          </Stack>
                        </Stack>
                      </CardContent>
                    </Card>
                  </motion.div>
                </Grid>
              ))}
            </Grid>

            {/* Social proof stats — reduced size */}
            <Grid container spacing={2} sx={{ width: '100%', pt: { xs: 0.5, md: 1 } }}>
              {socialProofStats.map((stat, index) => (
                <Grid item xs={6} md={3} key={index}>
                  <motion.div variants={fadeInUp}>
                    <Stack alignItems="center" spacing={1}>
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: 1.5,
                          background: `linear-gradient(45deg, ${alpha(theme.palette.primary.main, 0.2)}, ${alpha(theme.palette.secondary.main, 0.2)})`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: theme.palette.primary.main,
                          '& .MuiSvgIcon-root': { fontSize: 20 },
                        }}
                      >
                        {stat.icon}
                      </Box>
                      <Typography
                        variant="h6"
                        sx={{
                          fontWeight: 800,
                          fontSize: { xs: '1.1rem', md: '1.25rem' },
                          background: 'linear-gradient(45deg, #667eea 30%, #764ba2 90%)',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                        }}
                      >
                        {stat.value}
                      </Typography>
                      <Typography variant="caption" color="rgba(255,255,255,0.75)" fontWeight={500} textAlign="center" sx={{ fontSize: '0.72rem' }}>
                        {stat.label}
                      </Typography>
                    </Stack>
                  </motion.div>
                </Grid>
              ))}
            </Grid>
          </Stack>
        </motion.div>
      </Container>
    </Box>
  );
};

export default IntroducingAlwrity;
