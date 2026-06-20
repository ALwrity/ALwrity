import React from 'react';
import {
  Box,
  Button,
  Container,
  Typography,
  Stack,
  Grid,
} from '@mui/material';
import { useClerk } from '@clerk/clerk-react';
import RocketLaunch from '@mui/icons-material/RocketLaunch';
import { motion } from 'framer-motion';
import { landingSectionTitleSx } from './landingStyles';

const EnterpriseCTA: React.FC = () => {
  const { openSignIn } = useClerk();

  const fadeInUp = {
    hidden: { opacity: 0, y: 24 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' as const } },
  };

  const stagger = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.12 } },
  };

  return (
    <Box sx={{ py: { xs: 3, md: 4 }, bgcolor: '#0a0a0a' }}>
      <Container maxWidth="lg" sx={{ px: { xs: 2, md: 3 } }}>
        <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }}>
          <Grid container spacing={{ xs: 3, md: 4 }} alignItems="center">
            <Grid item xs={12} md={5}>
              <motion.div variants={fadeInUp}>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    minHeight: { xs: 220, md: 300 },
                    width: '100%',
                  }}
                >
                  <Box
                    component="img"
                    src="/alwrity_landing_copilot.png"
                    alt="ALwrity Copilot Interface"
                    loading="lazy"
                    decoding="async"
                    sx={{
                      width: '100%',
                      height: 'auto',
                      maxWidth: '100%',
                      objectFit: 'contain',
                      objectPosition: 'center center',
                      borderRadius: 3,
                      boxShadow: '0 16px 36px rgba(0,0,0,0.35)',
                      transition: 'transform 0.3s ease',
                      display: 'block',
                      '&:hover': { transform: 'scale(1.02)' },
                    }}
                  />
                </Box>
              </motion.div>
            </Grid>

            <Grid item xs={12} md={7}>
              <motion.div variants={fadeInUp}>
                <Stack spacing={2.5} alignItems={{ xs: 'center', md: 'flex-start' }} textAlign={{ xs: 'center', md: 'left' }}>
                  <Typography variant="h3" component="h2" sx={{ ...landingSectionTitleSx, color: 'white' }}>
                    Ready to Transform Your Content Creation?
                  </Typography>
                  <Typography
                    variant="h6"
                    color="rgba(255,255,255,0.75)"
                    maxWidth="620px"
                    sx={{ fontSize: { xs: '0.95rem', md: '1.05rem' }, fontWeight: 400 }}
                  >
                    Join thousands of creators, marketers, and businesses already using ALwrity's open-source AI platform.
                    Start creating professional content in minutes, not hours.
                  </Typography>

                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2.5} alignItems="center">
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
                        ✓ No credit card required
                      </Typography>
                    </Stack>
                  </Stack>
                </Stack>
              </motion.div>
            </Grid>
          </Grid>
        </motion.div>
      </Container>
    </Box>
  );
};

export default EnterpriseCTA;
