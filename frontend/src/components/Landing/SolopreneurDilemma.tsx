import React from 'react';
import { 
  Box, 
  Container, 
  Typography, 
  Stack, 
  Grid, 
  useTheme,
  alpha,
  Button
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
import { landingSectionTitleSx } from './landingStyles';

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
  const { openSignIn } = useClerk();

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

  return (
    <Box
      sx={{
        position: 'relative',
        py: { xs: 8, md: 12 },
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: 'url(/alwrity_landing_pg_bg.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          zIndex: 0,
        },
        '&::after': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.7) 0%, rgba(25, 118, 210, 0.3) 50%, rgba(156, 39, 176, 0.3) 100%)',
          zIndex: 1,
        },
      }}
    >
      <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 2, pt: { xs: 2, md: 3 } }}>
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
            alignItems={{ xs: 'center', md: 'flex-start' }}
            sx={{ mb: 6 }}
          >
            <Box sx={{ flex: 1 }}>
              <motion.div variants={itemVariants}>
                <Typography
                  variant="h2"
                  component="h2"
                  sx={{
                    ...landingSectionTitleSx,
                    color: 'white',
                    textShadow: '0 2px 10px rgba(0, 0, 0, 0.8)',
                    lineHeight: 1.12,
                  }}
                >
                  Content Struggle Is Real:
                  <br />
                  Scale Smart,
                  <br />
                  Burn Out Less
                </Typography>
              </motion.div>
            </Box>
            
            <Box sx={{ flex: 1 }}>
              <motion.div variants={itemVariants}>
                <Typography 
                  variant="h5" 
                  sx={{ 
                    color: 'rgba(255, 255, 255, 0.9)',
                    fontWeight: 400,
                    textShadow: '0 1px 3px rgba(0, 0, 0, 0.7)',
                    lineHeight: 1.4
                  }}
                >
                  You're juggling multiple platforms, struggling to maintain your voice, 
                  and spending hours on content that should take minutes.
                </Typography>
              </motion.div>
            </Box>
          </Stack>

          <Box sx={{ ml: { xs: 0, md: '45%' } }}>
            <Grid container spacing={6} alignItems="center">
              {/* Left Column - Pain Points */}
              <Grid item xs={12} md={6}>
                <motion.div variants={itemVariants}>
                  <Stack spacing={4}>
                    {/* Before ALwrity Label */}
                    <Box
                      sx={{
                        display: 'inline-block',
                        px: 2,
                        py: 1,
                        background: `linear-gradient(135deg, ${theme.palette.error.main} 0%, ${theme.palette.error.dark} 100%)`,
                        borderRadius: 2,
                        mb: 2
                      }}
                    >
                      <Typography 
                        variant="caption" 
                        fontWeight={700}
                        sx={{ 
                          color: 'white',
                          textTransform: 'uppercase',
                          letterSpacing: '1px',
                          fontSize: '0.8rem'
                        }}
                      >
                        Before ALwrity
                      </Typography>
                    </Box>
                    

                  
                  {painPoints.map((point, index) => (
                    <motion.div
                      key={index}
                      variants={itemVariants}
                      whileHover={{ scale: 1.02 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Box
                        sx={{
                          p: 3,
                          borderRadius: 3,
                          background: `linear-gradient(135deg, ${alpha(theme.palette.error.main, 0.1)} 0%, ${alpha(theme.palette.error.dark, 0.05)} 100%)`,
                          border: `1px solid ${alpha(theme.palette.error.main, 0.2)}`,
                          backdropFilter: 'blur(10px)',
                          transition: 'all 0.3s ease',
                          '&:hover': {
                            background: `linear-gradient(135deg, ${alpha(theme.palette.error.main, 0.15)} 0%, ${alpha(theme.palette.error.dark, 0.08)} 100%)`,
                            border: `1px solid ${alpha(theme.palette.error.main, 0.3)}`,
                          }
                        }}
                      >
                        <Stack direction="row" spacing={2} alignItems="flex-start">
                          <Box
                            sx={{
                              p: 1.5,
                              borderRadius: 2,
                              background: `linear-gradient(135deg, ${theme.palette.error.main} 0%, ${theme.palette.error.dark} 100%)`,
                              color: 'white',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              minWidth: 48,
                              height: 48,
                            }}
                          >
                            {point.icon}
                          </Box>
                          <Stack spacing={1} sx={{ flex: 1 }}>
                            <Typography 
                              variant="h6" 
                              fontWeight={600}
                              sx={{ 
                                color: 'white',
                                textShadow: '0 1px 2px rgba(0, 0, 0, 0.7)'
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
                                lineHeight: 1.5
                              }}
                            >
                              {point.description}
                            </Typography>
                          </Stack>
                        </Stack>
                      </Box>
                    </motion.div>
                  ))}
                </Stack>
              </motion.div>
            </Grid>

              {/* Right Column - Solutions */}
              <Grid item xs={12} md={6}>
                <motion.div variants={itemVariants}>
                  <Stack spacing={4}>
                    {/* After ALwrity Label */}
                    <Box
                      sx={{
                        display: 'inline-block',
                        px: 2,
                        py: 1,
                        background: `linear-gradient(135deg, ${theme.palette.success.main} 0%, ${theme.palette.success.dark} 100%)`,
                        borderRadius: 2,
                        mb: 2
                      }}
                    >
                      <Typography 
                        variant="caption" 
                        fontWeight={700}
                        sx={{ 
                          color: 'white',
                          textTransform: 'uppercase',
                          letterSpacing: '1px',
                          fontSize: '0.8rem'
                        }}
                      >
                        After ALwrity
                      </Typography>
                    </Box>
                    
                  {solutions.map((solution, index) => (
                    <motion.div
                      key={index}
                      variants={itemVariants}
                      whileHover={{ scale: 1.02 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Box
                        sx={{
                          p: 3,
                          borderRadius: 3,
                          background: `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.1)} 0%, ${alpha(theme.palette.success.dark, 0.05)} 100%)`,
                          border: `1px solid ${alpha(theme.palette.success.main, 0.2)}`,
                          backdropFilter: 'blur(10px)',
                          transition: 'all 0.3s ease',
                          '&:hover': {
                            background: `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.15)} 0%, ${alpha(theme.palette.success.dark, 0.08)} 100%)`,
                            border: `1px solid ${alpha(theme.palette.success.main, 0.3)}`,
                          }
                        }}
                      >
                        <Stack direction="row" spacing={2} alignItems="flex-start">
                          <Box
                            sx={{
                              p: 1.5,
                              borderRadius: 2,
                              background: `linear-gradient(135deg, ${theme.palette.success.main} 0%, ${theme.palette.success.dark} 100%)`,
                              color: 'white',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              minWidth: 48,
                              height: 48,
                            }}
                          >
                            {solution.icon}
                          </Box>
                          <Stack spacing={1} sx={{ flex: 1 }}>
                            <Typography 
                              variant="h6" 
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
                                textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
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

                  {/* CTA Button */}
                  <motion.div variants={itemVariants}>
                    <Button
                      variant="contained"
                      size="large"
                      endIcon={<ArrowForward />}
                      onClick={() => openSignIn({ forceRedirectUrl: '/onboarding' })}
                      sx={{
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
