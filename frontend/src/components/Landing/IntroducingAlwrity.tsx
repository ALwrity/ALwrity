import React, { useCallback, useState } from 'react';
import {
  Box,
  Button,
  Container,
  Typography,
  Stack,
  Grid,
  Card,
  CardContent,
  Collapse,
  useTheme,
  useMediaQuery,
  alpha,
} from '@mui/material';
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
import { landingSectionTitleSx, landingSectionSubtitleSx, landingDesktopPromotedCopySx } from './landingStyles';
import { scrollToLandingSection } from '../../utils/landingNavigation';
import { useDeferredBackground } from './useDeferredBackground';
import { landingDarkSectionSx, landingSectionBackgroundLayerSx, landingMobileBackgroundBleedSx, landingMobileSeamBleedSx } from './landingSectionShellSx';

const VORTEX_BG = '/alwrity_landing_bg_vortex.png';

type PlatformCapability = {
  icon: React.ReactElement;
  title: string;
  description: string;
  highlight: string;
};

type SocialProofStat = {
  icon: React.ReactElement;
  value: string;
  label: string;
  mobileLabel: string;
};

const platformCapabilities: PlatformCapability[] = [
  {
    icon: <Code />,
    title: 'Open Source Foundation',
    description:
      'Built with transparency and community in mind. Full source code available on GitHub for inspection and contribution.',
    highlight: '100% Open Source',
  },
  {
    icon: <Security />,
    title: 'Privacy First',
    description:
      'Your data stays yours. No tracking, no data mining, no selling of user information. Complete privacy protection.',
    highlight: 'Privacy-first design',
  },
  {
    icon: <Speed />,
    title: 'Lightning Fast',
    description: 'Optimized for speed and efficiency. Generate high-quality content in seconds, not minutes.',
    highlight: 'Sub-second Response',
  },
];

const socialProofStats: SocialProofStat[] = [
  { icon: <Business />, value: '1K+', label: 'GitHub Stars', mobileLabel: 'GitHub\nStars' },
  {
    icon: <ContentCopy />,
    value: '10K+',
    label: 'Content Pieces Generated',
    mobileLabel: 'Content Pieces\nGenerated',
  },
  { icon: <TrendingUp />, value: '95%', label: 'User Satisfaction', mobileLabel: 'User\nSatisfaction' },
  { icon: <People />, value: '500+', label: 'Active Contributors', mobileLabel: 'Active\nContributors' },
];

const IntroducingAlwrity: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [expandedCardIndex, setExpandedCardIndex] = useState<number | null>(null);
  const bgUrl = useDeferredBackground(VORTEX_BG);

  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' as const } },
  };

  const stagger = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.1 } },
  };

  const glassCardSx = {
    background: `linear-gradient(135deg, ${alpha(theme.palette.common.white, 0.08)} 0%, ${alpha(theme.palette.common.white, 0.03)} 100%)`,
    backdropFilter: 'blur(16px)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 3,
    boxShadow: '0 12px 28px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08)',
  } as const;

  const iconBoxSx = {
    width: { xs: 36, md: 44 },
    height: { xs: 36, md: 44 },
    borderRadius: 2,
    background: `linear-gradient(45deg, ${alpha(theme.palette.primary.main, 0.2)}, ${alpha(theme.palette.secondary.main, 0.2)})`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: theme.palette.primary.main,
    flexShrink: 0,
    '& .MuiSvgIcon-root': { fontSize: { xs: 18, md: 22 } },
  } as const;

  const handleCardToggle = useCallback(
    (index: number) => {
      if (!isMobile) return;
      setExpandedCardIndex((prev) => (prev === index ? null : index));
    },
    [isMobile]
  );

  const handleCardKeyDown = useCallback(
    (event: React.KeyboardEvent, index: number) => {
      if (!isMobile) return;
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleCardToggle(index);
      }
    },
    [handleCardToggle, isMobile]
  );

  return (
    <Box
        sx={{
          ...landingDarkSectionSx,
          minHeight: { xs: 'auto', md: 'auto' },
          mt: { xs: 0, md: 0 },
          pt: { xs: 1.5, md: 4.5 },
          pb: { xs: 4.5, md: 4.5 },
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
        justifyContent: 'flex-start',
        '&::after': {
          ...landingSectionBackgroundLayerSx,
          ...landingMobileBackgroundBleedSx,
          ...landingMobileSeamBleedSx,
          backgroundImage: bgUrl ? `url(${bgUrl})` : 'none',
          opacity: bgUrl ? 0.88 : 0,
          transition: 'opacity 0.8s ease',
          zIndex: 0,
        },
        '&::before': {
          ...landingSectionBackgroundLayerSx,
          ...landingMobileBackgroundBleedSx,
          ...landingMobileSeamBleedSx,
          background: 'linear-gradient(135deg, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.58) 40%, rgba(0,0,0,1) 100%)',
          zIndex: 1,
        },
      }}
    >
      <Container maxWidth="lg" sx={{ py: { xs: 0.75, md: 2.5 }, position: 'relative', zIndex: 2 }}>
        <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.15 }}>
          <Stack spacing={{ xs: 1.75, md: 2.75 }} alignItems="center" textAlign="center">
            <motion.div variants={fadeInUp}>
              <Typography variant="h3" component="h2" sx={{ ...landingSectionTitleSx, color: 'white' }}>
                Welcome to ALwrity
              </Typography>
            </motion.div>

            <motion.div variants={fadeInUp}>
              <Typography
                variant="h5"
                component="p"
                color="rgba(255,255,255,0.9)"
                maxWidth="720px"
                sx={{
                  ...landingSectionSubtitleSx,
                  ...landingDesktopPromotedCopySx,
                  fontWeight: { xs: 400, md: 600 },
                  fontSize: { xs: '0.95rem', md: '1.15rem' },
                }}
              >
                Transform from a manual implementer to a Strategic Director. ALwrity automates the entire
                Content Strategy process with AI-powered Intelligence
              </Typography>
            </motion.div>

            <motion.div variants={fadeInUp} style={{ display: isMobile ? 'none' : 'block' }}>
              <Button
                onClick={() => scrollToLandingSection('lifecycle')}
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
                See how it works ↓
              </Button>
            </motion.div>

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
                  Built for creators, by creators. Open-source, privacy-focused, and designed to scale with your
                  ambitions.
                </Typography>
              </Stack>
            </motion.div>

            <Grid container spacing={2} sx={{ width: '100%' }}>
              {platformCapabilities.map((capability, index) => {
                const isExpanded = !isMobile || expandedCardIndex === index;

                return (
                  <Grid item xs={12} md={4} key={capability.title}>
                    <motion.div variants={fadeInUp}>
                      <Card
                        role={isMobile ? 'button' : undefined}
                        tabIndex={isMobile ? 0 : undefined}
                        aria-expanded={isMobile ? isExpanded : undefined}
                        onClick={() => handleCardToggle(index)}
                        onKeyDown={(event) => handleCardKeyDown(event, index)}
                        sx={{
                          ...glassCardSx,
                          height: '100%',
                          cursor: { xs: 'pointer', md: 'default' },
                          transition: 'all 0.3s ease',
                          borderColor:
                            isMobile && isExpanded ? alpha(theme.palette.primary.main, 0.45) : 'rgba(255,255,255,0.15)',
                          '&:hover': {
                            transform: { xs: 'none', md: 'translateY(-6px)' },
                            boxShadow: `0 20px 40px ${alpha(theme.palette.primary.main, 0.18)}`,
                            borderColor: alpha('#fff', 0.2),
                          },
                          '&:focus-visible': {
                            outline: `2px solid ${theme.palette.primary.main}`,
                            outlineOffset: 2,
                          },
                        }}
                      >
                        <CardContent sx={{ p: { xs: 1.25, md: 2.5 }, '&:last-child': { pb: { xs: 1.25, md: 2.5 } } }}>
                          {isMobile ? (
                            <Stack spacing={isExpanded ? 0.75 : 0}>
                              <Stack direction="row" spacing={1} alignItems="center" sx={{ width: '100%' }}>
                                <Box sx={iconBoxSx}>{capability.icon}</Box>
                                <Typography
                                  variant="subtitle1"
                                  component="h3"
                                  fontWeight={700}
                                  sx={{
                                    color: 'white',
                                    fontSize: '0.85rem',
                                    textAlign: 'left',
                                    lineHeight: 1.2,
                                    flex: 1,
                                    minWidth: 0,
                                  }}
                                >
                                  {capability.title}
                                </Typography>
                                {isExpanded && (
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
                                      flexShrink: 0,
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {capability.highlight}
                                  </Typography>
                                )}
                              </Stack>
                              <Collapse in={isExpanded} timeout={300}>
                                <Typography
                                  variant="body2"
                                  color="rgba(255,255,255,0.8)"
                                  lineHeight={1.5}
                                  sx={{ fontSize: '0.82rem', textAlign: 'left', pt: 0.25 }}
                                >
                                  {capability.description}
                                </Typography>
                              </Collapse>
                            </Stack>
                          ) : (
                            <Stack spacing={2}>
                              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                                <Box sx={iconBoxSx}>{capability.icon}</Box>
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
                                <Typography
                                  variant="subtitle1"
                                  component="h3"
                                  fontWeight={700}
                                  sx={{ color: 'white', fontSize: '0.95rem' }}
                                >
                                  {capability.title}
                                </Typography>
                                <Typography
                                  variant="body2"
                                  color="rgba(255,255,255,0.8)"
                                  lineHeight={1.5}
                                  sx={{ fontSize: '0.82rem' }}
                                >
                                  {capability.description}
                                </Typography>
                              </Stack>
                            </Stack>
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  </Grid>
                );
              })}
            </Grid>

            <Grid container spacing={2} sx={{ width: '100%', pt: 0, mt: { xs: -1, md: -2 } }}>
              {socialProofStats.map((stat) => (
                <Grid item xs={3} md={3} key={stat.label} sx={{ display: 'flex', justifyContent: 'center' }}>
                  <motion.div variants={fadeInUp} style={{ width: '100%' }}>
                    <Stack alignItems="center" spacing={{ xs: 0.35, md: 1 }} sx={{ minWidth: 0 }}>
                      <Box
                        sx={{
                          width: { xs: 36, md: 40 },
                          height: { xs: 36, md: 40 },
                          borderRadius: 1.5,
                          background: `linear-gradient(45deg, ${alpha(theme.palette.primary.main, 0.2)}, ${alpha(theme.palette.secondary.main, 0.2)})`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: theme.palette.primary.main,
                          '& .MuiSvgIcon-root': { fontSize: { xs: 18, md: 20 } },
                        }}
                      >
                        {stat.icon}
                      </Box>
                      <Typography
                        variant="h6"
                        component="p"
                        sx={{
                          fontWeight: 800,
                          fontSize: { xs: '0.95rem', md: '1.25rem' },
                          lineHeight: 1.1,
                          background: 'linear-gradient(45deg, #667eea 30%, #764ba2 90%)',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                        }}
                      >
                        {stat.value}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="rgba(255,255,255,0.75)"
                        fontWeight={500}
                        textAlign="center"
                        sx={{
                          fontSize: { xs: '0.58rem', md: '0.72rem' },
                          lineHeight: 1.15,
                          whiteSpace: { xs: 'pre-line', md: 'normal' },
                        }}
                      >
                        {isMobile ? stat.mobileLabel : stat.label}
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
