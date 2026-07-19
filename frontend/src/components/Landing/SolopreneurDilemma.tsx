import React, { useCallback, useState } from 'react';
import { 
  Box, 
  Container, 
  Typography, 
  Stack, 
  Grid, 
  useTheme,
  useMediaQuery,
  alpha,
  Button,
  Card,
  CardContent,
  Collapse,
} from '@mui/material';
import { 
  Psychology, 
  TrendingUp, 
  Speed, 
  CheckCircle,
  ArrowForward
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useClerk } from '@clerk/clerk-react';
import { ScrambleText } from '../ScrambleText';
import { useDeferredBackground } from './useDeferredBackground';
import { landingSectionTitleSx } from './landingStyles';
import { landingDarkSectionSx, landingSectionBackgroundLayerSx, landingMobileBackgroundBleedSx, landingGlassCardSx, landingWelcomeIconBoxSx } from './landingSectionShellSx';
import { getPostAuthDestination } from '../../utils/returningUserStorage';

const SECTION_BG = '/alwrity_landing_pg_bg.png';

// Scrambling text component for multiple phrases
const ScramblingText: React.FC<{ phrases: string[]; interval?: number; duration?: number; delay?: number }> = ({ 
  phrases, 
  interval = 4000,
  duration = 600,
  delay = 0
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
    />
  );
};

const SolopreneurDilemma: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [expandedPainIndex, setExpandedPainIndex] = useState<number | null>(null);
  const [expandedSolutionIndex, setExpandedSolutionIndex] = useState<number | null>(null);
  const { openSignIn } = useClerk();
  const sectionBgUrl = useDeferredBackground(SECTION_BG);
  const iconBoxSx = landingWelcomeIconBoxSx(theme);

  const painPoints = [
    {
      icon: <Psychology />,
      title: "Content Overwhelm",
      titleVariations: ["Content Overwhelm", "Content Chaos", "Content Confusion", "Content Crisis"],
      description: "Managing 8+ social platforms with different audiences, tones, and posting schedules"
    },
    {
      icon: <TrendingUp />,
      title: "Inconsistent Brand Voice",
      titleVariations: ["Inconsistent Brand Voice", "Voice Confusion", "Brand Inconsistency", "Tone Problems"],
      description: "Struggling to maintain your unique voice across all platforms while scaling content"
    },
    {
      icon: <Speed />,
      title: "Time Drain",
      titleVariations: ["Time Drain", "Time Sink", "Time Waste", "Productivity Loss"],
      description: "Spending 4-6 hours daily on content creation, research, and platform management"
    }
  ];

  const solutions = [
    {
      icon: <CheckCircle />,
      title: "Unified AI Copilot",
      description: "One intelligent assistant that understands your brand voice and adapts to each platform"
    },
    {
      icon: <CheckCircle />,
      title: "Automated Research",
      description: "AI-powered competitor analysis and trend discovery across 25+ sources"
    },
    {
      icon: <CheckCircle />,
      title: "Content at Scale",
      description: "Generate weeks of content in minutes, not hours, with fact-checked accuracy"
    }
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        delayChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        ease: "easeOut" as const
      }
    }
  };

  const mobileCardContentSx = {
    p: { xs: 0.61, md: 2.5 },
    '&:last-child': { pb: { xs: 0.61, md: 2.5 } },
  } as const;

  const mobileIconBoxSx = {
    ...iconBoxSx,
    width: 26,
    height: 26,
    minWidth: 26,
    '& .MuiSvgIcon-root': { fontSize: 15 },
  } as const;

  const makeIconBoxSx = (accent: 'error' | 'success') => ({
    width: { xs: 36, md: 48 },
    height: { xs: 36, md: 48 },
    borderRadius: 2,
    p: { xs: 0, md: 1.5 },
    background: `linear-gradient(135deg, ${theme.palette[accent].main} 0%, ${theme.palette[accent].dark} 100%)`,
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    minWidth: { xs: 36, md: 48 },
    '& .MuiSvgIcon-root': { fontSize: { xs: 18, md: 24 } },
  });

  const cardBoxSx = (accent: 'error' | 'success') => ({
    display: { xs: 'none', md: 'block' },
    p: { xs: 2, md: 3 },
    borderRadius: 3,
    background: `linear-gradient(135deg, ${alpha(theme.palette[accent].main, 0.1)} 0%, ${alpha(theme.palette[accent].dark, 0.05)} 100%)`,
    border: `1px solid ${alpha(theme.palette[accent].main, 0.2)}`,
    backdropFilter: 'blur(10px)',
    transition: 'all 0.3s ease',
    '&:hover': {
      background: `linear-gradient(135deg, ${alpha(theme.palette[accent].main, 0.15)} 0%, ${alpha(theme.palette[accent].dark, 0.08)} 100%)`,
      border: `1px solid ${alpha(theme.palette[accent].main, 0.3)}`,
    },
  });

  const handleMobileCardToggle = useCallback(
    (setter: React.Dispatch<React.SetStateAction<number | null>>, index: number) => {
      if (!isMobile) return;
      setter((prev) => (prev === index ? null : index));
    },
    [isMobile]
  );

  const handleMobileCardKeyDown = useCallback(
    (
      event: React.KeyboardEvent,
      setter: React.Dispatch<React.SetStateAction<number | null>>,
      index: number
    ) => {
      if (!isMobile) return;
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleMobileCardToggle(setter, index);
      }
    },
    [handleMobileCardToggle, isMobile]
  );

  const renderMobileGlassCard = (
    title: string,
    description: string,
    icon: React.ReactNode,
    index: number,
    expandedIndex: number | null,
    setExpandedIndex: React.Dispatch<React.SetStateAction<number | null>>,
    variant: 'pain' | 'solution',
    titleVariations?: string[]
  ) => {
    const isExpanded = expandedIndex === index;
    const iconOnRight = variant === 'pain';
    const alignRight = variant === 'pain';

    return (
      <Card
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        onClick={() => handleMobileCardToggle(setExpandedIndex, index)}
        onKeyDown={(event) => handleMobileCardKeyDown(event, setExpandedIndex, index)}
        sx={{
          ...landingGlassCardSx,
          display: { xs: 'block', md: 'none' },
          width: { xs: '70%', md: 'auto' },
          alignSelf: { xs: alignRight ? 'flex-end' : 'flex-start', md: 'stretch' },
          cursor: 'pointer',
          borderColor: isExpanded ? alpha(theme.palette.primary.main, 0.45) : 'rgba(255,255,255,0.15)',
          '&:focus-visible': {
            outline: `2px solid ${theme.palette.primary.main}`,
            outlineOffset: 2,
          },
        }}
      >
        <CardContent sx={mobileCardContentSx}>
          <Stack spacing={isExpanded ? 0.5 : 0} alignItems="stretch">
            <Stack
              direction={iconOnRight ? 'row-reverse' : 'row'}
              spacing={0.75}
              alignItems="center"
              justifyContent={iconOnRight ? 'flex-end' : 'flex-start'}
              sx={{ width: '100%' }}
            >
              <Box sx={mobileIconBoxSx}>{icon}</Box>
              <Typography
                variant="subtitle1"
                component="h3"
                fontWeight={700}
                sx={{
                  color: 'white',
                  fontSize: '0.8rem',
                  textAlign: iconOnRight ? 'right' : 'left',
                  lineHeight: 1.15,
                  flex: 1,
                  minWidth: 0,
                }}
              >
                {variant === 'pain' && titleVariations ? (
                  <ScramblingText
                    phrases={titleVariations}
                    duration={500}
                    delay={500}
                    interval={10000}
                  />
                ) : (
                  title
                )}
              </Typography>
            </Stack>
            <Collapse in={isExpanded} timeout={300}>
              <Typography
                variant="body2"
                color="rgba(255,255,255,0.8)"
                lineHeight={1.5}
                sx={{ fontSize: '0.82rem', textAlign: 'center', pt: 0.25, px: 0.5 }}
              >
                {description}
              </Typography>
            </Collapse>
          </Stack>
        </CardContent>
      </Card>
    );
  };

  return (
    <Box
      sx={{
        ...landingDarkSectionSx,
        py: { xs: 2.5, md: 7 },
        mt: { xs: 0, md: 0 },
        '&::before': {
          ...landingSectionBackgroundLayerSx,
          ...landingMobileBackgroundBleedSx,
          backgroundImage: sectionBgUrl ? `url(${sectionBgUrl})` : 'none',
          zIndex: 0,
        },
        '&::after': {
          ...landingSectionBackgroundLayerSx,
          ...landingMobileBackgroundBleedSx,
          background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.7) 0%, rgba(25, 118, 210, 0.3) 50%, rgba(156, 39, 176, 0.3) 100%)',
          zIndex: 1,
        },
      }}
    >
      <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 2, pt: { xs: 0, md: 0.5 } }}>
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
        >
          {/* Section Header - Side by Side */}
          <Stack 
            direction={{ xs: 'column', md: 'row' }} 
            spacing={{ xs: 1, md: 2 }} 
            alignItems={{ xs: 'flex-start', md: 'flex-start' }}
            sx={{ mb: { xs: 2.5, md: 5 } }}
          >
            <Box sx={{ flex: 1, width: { xs: '100%', md: 'auto' } }}>
              <motion.div variants={itemVariants}>
                <Typography
                  variant="h2"
                  component="h2"
                  sx={{
                    ...landingSectionTitleSx,
                    color: 'white',
                    textShadow: '0 2px 10px rgba(0, 0, 0, 0.8)',
                    lineHeight: 1.12,
                    textAlign: { xs: 'left', md: 'left' },
                  }}
                >
                  Content Struggle Is Real:
                  <Box
                    component="span"
                    sx={{
                      display: { xs: 'block', md: 'none' },
                      whiteSpace: 'nowrap',
                      fontSize: { xs: '1.35rem', sm: 'inherit' },
                    }}
                  >
                    Scale Smart, Burn Out Less
                  </Box>
                  <Box component="span" sx={{ display: { xs: 'none', md: 'inline' } }}>
                    <br />
                    Scale Smart,
                    <br />
                    Burn Out Less
                  </Box>
                </Typography>
              </motion.div>
            </Box>
            
            <Box sx={{ flex: 1, width: { xs: '100%', md: 'auto' }, display: { xs: 'none', md: 'flex' }, justifyContent: { md: 'flex-start' } }}>
              <motion.div variants={itemVariants} style={{ maxWidth: '100%' }}>
                <Typography 
                  variant="h2"
                  component="p"
                  sx={{
                    color: 'rgba(255, 255, 255, 0.9)',
                    fontWeight: 400,
                    textShadow: '0 1px 3px rgba(0, 0, 0, 0.7)',
                    lineHeight: 1.4,
                  }}
                >
                  You're juggling multiple platforms, struggling to maintain your voice, and
                  spending hours on content that should take minutes.
                </Typography>
              </motion.div>
            </Box>
          </Stack>

          <Box sx={{ ml: { xs: 0, md: '35%' } }}>
            <Grid container spacing={{ xs: 2, md: 6 }} alignItems="center">
              {/* Left Column - Pain Points */}
              <Grid item xs={12} md={6}>
                <motion.div variants={itemVariants}>
                  <Stack spacing={{ xs: 1.5, md: 4 }} sx={{ alignItems: { xs: 'flex-end', md: 'stretch' } }}>
                    {/* Before ALwrity Label */}
                    <Box sx={{ display: 'flex', justifyContent: { xs: 'flex-end', md: 'flex-start' }, width: { xs: '100%', md: 'auto' } }}>
                      <Box
                        sx={{
                          display: 'inline-block',
                          px: { xs: 1.36, md: 2 },
                          py: { xs: 0.42, md: 1 },
                          borderRadius: { xs: 1.5, md: 2 },
                          mb: { xs: 0.75, md: 2 },
                          background: `linear-gradient(135deg, ${theme.palette.error.main} 0%, ${theme.palette.error.dark} 100%)`,
                        }}
                      >
                        <Typography 
                          variant="caption" 
                          fontWeight={700}
                          sx={{ 
                            color: 'white',
                            textTransform: 'uppercase',
                            letterSpacing: { xs: '0.78px', md: '1px' },
                            fontSize: { xs: '0.95rem', md: '0.8rem' },
                          }}
                        >
                          Before ALwrity
                        </Typography>
                      </Box>
                    </Box>
                  

                  
                  {painPoints.map((point, index) => (
                    <motion.div
                      key={index}
                      variants={itemVariants}
                      whileHover={{ scale: 1.02 }}
                      transition={{ duration: 0.2 }}
                      style={{ width: '100%', display: 'flex', justifyContent: 'flex-end' }}
                    >
                      {renderMobileGlassCard(
                        point.title,
                        point.description,
                        point.icon,
                        index,
                        expandedPainIndex,
                        setExpandedPainIndex,
                        'pain',
                        point.titleVariations
                      )}
                      <Box sx={cardBoxSx('error')}>
                        <Stack direction="row" spacing={2} alignItems="flex-start">
                          <Box sx={makeIconBoxSx('error')}>
                            {point.icon}
                          </Box>
                          <Stack spacing={1} sx={{ flex: 1 }}>
                            <Typography 
                              variant="h6"
                              component="h3"
                              fontWeight={600}
                              sx={{ 
                                color: 'white',
                                textShadow: '0 1px 2px rgba(0, 0, 0, 0.7)',
                                fontSize: { xs: '0.95rem', md: 'inherit' },
                              }}
                            >
                              <ScramblingText 
                                phrases={point.titleVariations || [point.title]}
                                duration={500}
                                delay={500}
                                interval={10000}
                              />
                            </Typography>
                            <Typography 
                              variant="body1"
                              sx={{ 
                                color: 'rgba(255, 255, 255, 0.8)',
                                textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
                                lineHeight: 1.5,
                                fontSize: { xs: '0.88rem', md: 'inherit' },
                              }}
                            >
                              {point.description}
                            </Typography>
                          </Stack>
                        </Stack>
                      </Box>
                    </motion.div>
                  ))}

                  {isMobile && (
                    <Typography
                      variant="body1"
                      component="p"
                      sx={{
                        color: 'rgba(255, 255, 255, 0.85)',
                        fontWeight: 400,
                        fontSize: '0.88rem',
                        lineHeight: 1.55,
                        textShadow: '0 1px 3px rgba(0, 0, 0, 0.7)',
                        textAlign: 'right',
                        maxWidth: 320,
                        alignSelf: 'flex-end',
                        mt: 0.5,
                      }}
                    >
                      You're juggling multiple platforms, struggling to maintain your voice, and spending hours on
                      content that should take minutes.
                    </Typography>
                  )}
                </Stack>
              </motion.div>
            </Grid>

              {/* Right Column - Solutions */}
              <Grid item xs={12} md={6}>
                <motion.div variants={itemVariants}>
                  <Stack spacing={{ xs: 1.5, md: 4 }} sx={{ alignItems: { xs: 'flex-start', md: 'stretch' } }}>
                    {/* After ALwrity Label */}
                    <Box sx={{ display: 'flex', justifyContent: { xs: 'flex-start', md: 'flex-start' }, width: { xs: '100%', md: 'auto' } }}>
                      <Box
                        sx={{
                          display: 'inline-block',
                          px: { xs: 1.36, md: 2 },
                          py: { xs: 0.42, md: 1 },
                          borderRadius: { xs: 1.5, md: 2 },
                          mb: { xs: 0.75, md: 2 },
                          background: `linear-gradient(135deg, ${theme.palette.success.main} 0%, ${theme.palette.success.dark} 100%)`,
                        }}
                      >
                        <Typography 
                          variant="caption" 
                          fontWeight={700}
                          sx={{ 
                            color: 'white',
                            textTransform: 'uppercase',
                            letterSpacing: { xs: '0.78px', md: '1px' },
                            fontSize: { xs: '0.95rem', md: '0.8rem' },
                          }}
                        >
                          After ALwrity
                        </Typography>
                      </Box>
                    </Box>
                    
                  {solutions.map((solution, index) => (
                    <motion.div
                      key={index}
                      variants={itemVariants}
                      whileHover={{ scale: 1.02 }}
                      transition={{ duration: 0.2 }}
                      style={{ width: '100%' }}
                    >
                      {renderMobileGlassCard(
                        solution.title,
                        solution.description,
                        solution.icon,
                        index,
                        expandedSolutionIndex,
                        setExpandedSolutionIndex,
                        'solution'
                      )}
                      <Box sx={cardBoxSx('success')}>
                        <Stack direction="row" spacing={2} alignItems="flex-start">
                          <Box sx={makeIconBoxSx('success')}>
                            {solution.icon}
                          </Box>
                          <Stack spacing={1} sx={{ flex: 1 }}>
                            <Typography 
                              variant="h6"
                              component="h3"
                              fontWeight={600}
                              sx={{ 
                                color: 'white',
                                textShadow: '0 1px 2px rgba(0, 0, 0, 0.7)'
                              }}
                            >
                              {solution.title}
                            </Typography>
                            <Typography 
                              variant="body1"
                              sx={{ 
                                color: 'rgba(255, 255, 255, 0.8)',
                                textShadow: '0 1px 2px rgba(0, 0, 0.5)',
                                lineHeight: 1.5
                              }}
                            >
                              {solution.description}
                            </Typography>
                          </Stack>
                        </Stack>
                      </Box>
                    </motion.div>
                  ))}

                  {/* CTA Button — desktop only */}
                  <motion.div variants={itemVariants}>
                    <Button
                      variant="contained"
                      size="large"
                      endIcon={<ArrowForward />}
                      onClick={() => openSignIn({ forceRedirectUrl: getPostAuthDestination() })}
                      sx={{
                        display: { xs: 'none', md: 'inline-flex' },
                        mt: 3,
                        py: 2,
                        px: 4,
                        fontSize: '1.1rem',
                        fontWeight: 700,
                        borderRadius: 3,
                        background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                        boxShadow: `0 8px 32px ${alpha(theme.palette.primary.main, 0.4)}`,
                        '&:hover': {
                          background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.secondary.dark} 100%)`,
                          transform: 'translateY(-2px)',
                          boxShadow: `0 12px 40px ${alpha(theme.palette.primary.main, 0.5)}`,
                        },
                        transition: 'all 0.3s ease',
                      }}
                    >
                      <ScramblingText
                        phrases={['End the Struggle Today', 'Stop the Chaos', 'Transform Your Workflow']}
                        interval={6000}
                        duration={500}
                      />
                    </Button>
                  </motion.div>
                </Stack>
              </motion.div>
            </Grid>
            </Grid>
          </Box>
        </motion.div>
      </Container>
    </Box>
  );
};

export default SolopreneurDilemma;
