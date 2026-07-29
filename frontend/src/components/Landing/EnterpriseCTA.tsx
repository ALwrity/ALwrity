import React from 'react';
import {
  Box,
  Button,
  Container,
  Typography,
  Stack,
  Grid,
  useTheme,
  alpha,
} from '@mui/material';
import OptimizedImage from './OptimizedImage';
import { useClerk } from '@clerk/clerk-react';
import RocketLaunch from '@mui/icons-material/RocketLaunch';
import { motion } from 'framer-motion';
import { landingSectionTitleSx } from './landingStyles';
import { getPostAuthDestination } from '../../utils/returningUserStorage';

const EnterpriseCTA: React.FC = () => {
  const theme = useTheme();
  const { openSignIn } = useClerk();

  const fadeInUp = {
    hidden: { opacity: 0, y: 24 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' as const } },
  };

  const stagger = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.12 } },
  };

  const glassPanelSx = {
    background: `linear-gradient(135deg, ${alpha(theme.palette.common.white, 0.06)} 0%, ${alpha(theme.palette.common.white, 0.02)} 100%)`,
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: { xs: 2, md: 3 },
    boxShadow: '0 10px 30px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)',
  } as const;

  return (
    <Box sx={{ py: { xs: 2, md: 2.75 }, bgcolor: '#0a0a0a', mt: { xs: 0, md: 0 } }}>
      <Container maxWidth="lg" sx={{ px: { xs: 2, md: 3 } }}>
        <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }}>
            <Box
              sx={{
                ...glassPanelSx,
                p: { xs: 0, md: 3.5 },
                width: '100%',
                overflow: 'hidden',
              }}
            >
              <Box sx={{ position: 'relative', minHeight: { xs: 340, md: 'auto' } }}>
                <Grid container spacing={{ xs: 0, md: 3 }} alignItems="center">
                  <Grid
                    item
                    xs={12}
                    md={5}
                    sx={{
                      position: { xs: 'absolute', md: 'relative' },
                      inset: { xs: 0, md: 'auto' },
                      zIndex: { xs: 0, md: 1 },
                      height: { xs: '100%', md: 'auto' },
                    }}
                  >
                    <motion.div variants={fadeInUp}>
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'center',
                          alignItems: 'center',
                          minHeight: { xs: 340, md: 280 },
                          width: '100%',
                          height: { xs: '100%', md: 'auto' },
                        }}
                      >
                        <OptimizedImage
                          src="/alwrity_landing_copilot.png"
                          alt="ALwrity Copilot Interface"
                          priority={false}
                          fallback={
                            <Box
                              sx={{
                                width: '100%',
                                height: '100%',
                                minHeight: { xs: 340, md: 280 },
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 2,
                                borderRadius: { xs: 0, md: 3 },
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                boxShadow: { xs: 'none', md: '0 16px 36px rgba(0,0,0,0.35)' },
                              }}
                            >
                              <Box
                                sx={{
                                  width: 64,
                                  height: 64,
                                  borderRadius: 3,
                                  background: 'rgba(255, 255, 255, 0.2)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: 'white',
                                }}
                              >
                                <RocketLaunch sx={{ fontSize: 40 }} />
                              </Box>
                              <Typography variant="subtitle1" fontWeight={600} color="white">
                                ALwrity AI Copilot
                              </Typography>
                            </Box>
                          }
                          sx={{
                            width: '100%',
                            height: { xs: '100%', md: 'auto' },
                            maxWidth: '100%',
                            minHeight: { xs: 340, md: 'auto' },
                            objectFit: { xs: 'cover', md: 'contain' },
                            borderRadius: { xs: 0, md: 3 },
                            boxShadow: { xs: 'none', md: '0 16px 36px rgba(0,0,0,0.35)' },
                            transition: 'transform 0.3s ease',
                            display: 'block',
                            '&:hover': { transform: { xs: 'none', md: 'scale(1.02)' } },
                          }}
                        />
                      </Box>
                    </motion.div>
                  </Grid>

                  <Grid
                    item
                    xs={12}
                    md={7}
                    sx={{
                      position: 'relative',
                      zIndex: { xs: 2, md: 1 },
                      minHeight: { xs: 340, md: 'auto' },
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <motion.div variants={fadeInUp} style={{ width: '100%' }}>
                      <Stack
                        spacing={2}
                        alignItems={{ xs: 'center', md: 'flex-start' }}
                        textAlign={{ xs: 'center', md: 'left' }}
                        sx={{
                          width: '100%',
                          p: { xs: 3, md: 0 },
                          background: {
                            xs: `linear-gradient(180deg, ${alpha('#000', 0.35)} 0%, ${alpha('#000', 0.72)} 100%)`,
                            md: 'transparent',
                          },
                          backdropFilter: { xs: 'blur(6px)', md: 'none' },
                        }}
                      >
                    <Typography variant="h3" component="h2" sx={{ ...landingSectionTitleSx, color: 'white' }}>
                      Ready to Transform Your Content Creation?
                    </Typography>
                    <Typography
                      variant="body1"
                      component="p"
                      color="rgba(255,255,255,0.75)"
                      maxWidth="620px"
                      sx={{ fontSize: { xs: '0.95rem', md: '1.05rem' }, fontWeight: 400 }}
                    >
                      Join creators and marketers using ALwrity&apos;s open-source AI platform. Start creating
                      professional content in minutes, not hours.
                    </Typography>

                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
                      <Button
                        onClick={() => openSignIn({ forceRedirectUrl: getPostAuthDestination() })}
                        variant="contained"
                        size="large"
                        startIcon={<RocketLaunch />}
                        sx={{
                          py: 1.35,
                          px: 4,
                          fontSize: '1.02rem',
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
                        Start creating now
                      </Button>

                      <Stack alignItems={{ xs: 'center', sm: 'flex-start' }} spacing={0.5}>
                        <Typography variant="body2" color="rgba(255,255,255,0.65)" sx={{ fontSize: '0.85rem' }}>
                          ✓ Free to get started
                        </Typography>
                        <Typography variant="body2" color="rgba(255,255,255,0.65)" sx={{ fontSize: '0.85rem' }}>
                          ✓ Open-source & transparent
                        </Typography>
                        <Typography variant="body2" color="rgba(255,255,255,0.65)" sx={{ fontSize: '0.85rem' }}>
                          ✓ Human-in-the-loop — you approve every publish
                        </Typography>
                      </Stack>
                    </Stack>
                    </Stack>
                    </motion.div>
                  </Grid>
                </Grid>
              </Box>
            </Box>
        </motion.div>
      </Container>
    </Box>
  );
};

export default EnterpriseCTA;
