import React from 'react';
import {
  Box,
  Typography,
  Button,
  useTheme,
  useMediaQuery
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import PlayArrow from '@mui/icons-material/PlayArrow';
import TrendingUp from '@mui/icons-material/TrendingUp';
import Rocket from '@mui/icons-material/Rocket';
import ArrowRight from '@mui/icons-material/ArrowRight';
import Star from '@mui/icons-material/Star';

interface WorkflowHeroSectionProps {
  onStartWorkflow: () => void;
  isWorkflowActive: boolean;
  isLoading: boolean;
}

const WorkflowHeroSection: React.FC<WorkflowHeroSectionProps> = ({
  onStartWorkflow,
  isWorkflowActive,
  isLoading
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  // Show hero section only when workflow is not started, not in progress, and not completed
  const shouldShowHero = !isWorkflowActive;

  return (
    <AnimatePresence>
      {shouldShowHero && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          {/* Banner Overlay - Covers task workflow area with constrained width */}
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 2, // Match the parent container's border radius
              px: 2, // Add horizontal padding to constrain width
              minHeight: '200px', // Reserve space to prevent layout shift
              willChange: 'transform', // Optimize for animations
            }}
          >
            {/* Hero Content - Full Coverage */}
            <Box
              sx={{
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                px: 3,
                py: 4,
                background: 'linear-gradient(135deg, rgba(255,255,255,0.036) 0%, rgba(255,255,255,0.018) 100%)',
                backdropFilter: 'blur(20px)',
                borderRadius: 3,
                border: '1px solid rgba(255,255,255,0.2)',
                boxShadow: '0 15px 30px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.1)',
                position: 'relative',
                overflow: 'hidden',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'linear-gradient(45deg, rgba(255,107,53,0.1) 0%, rgba(255,140,66,0.1) 50%, rgba(255,107,53,0.1) 100%)',
                  backgroundSize: '200% 200%',
                  animation: 'gradientShift 6s ease-in-out infinite',
                  zIndex: -1,
                },
                '@keyframes gradientShift': {
                  '0%, 100%': { backgroundPosition: '0% 50%' },
                  '50%': { backgroundPosition: '100% 50%' },
                },
              }}
            >
              {/* Floating Sparkles */}
              <Box
                sx={{
                  position: 'absolute',
                  top: 20,
                  right: 20,
                  animation: 'float 3s ease-in-out infinite',
                  '@keyframes float': {
                    '0%, 100%': { transform: 'translateY(0px)' },
                    '50%': { transform: 'translateY(-10px)' },
                  },
                }}
              >
                <Star sx={{ color: 'rgba(255,255,255,0.6)', fontSize: 24 }} />
              </Box>
              
              <Box
                sx={{
                  position: 'absolute',
                  bottom: 20,
                  left: 20,
                  animation: 'float 3s ease-in-out infinite 1.5s',
                  '@keyframes float': {
                    '0%, 100%': { transform: 'translateY(0px)' },
                    '50%': { transform: 'translateY(-10px)' },
                  },
                }}
              >
                <TrendingUp sx={{ color: 'rgba(255,255,255,0.6)', fontSize: 24 }} />
              </Box>

              {/* Main Content */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                style={{ width: '100%' }} // Prevent width changes
              >
                {/* Main Heading with Rocket */}
                <Box sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  gap: 2,
                  mb: 2,
                  minHeight: '48px', // Reserve space for heading to prevent layout shift
                }}>
                  <Typography
                    variant={isMobile ? "h5" : "h4"}
                    sx={{
                      fontWeight: 800,
                      color: '#ffffff',
                      textShadow: '0 4px 8px rgba(0,0,0,0.3)',
                      background: 'linear-gradient(135deg, #ffffff 0%, #f0f0f0 100%)',
                      backgroundClip: 'text',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      lineHeight: 1.2, // Fixed line height to prevent shift
                    }}
                  >
                    Grow Your Business Now
                  </Typography>
                  
                  <motion.div
                    animate={{ 
                      rotate: [0, 5, -5, 0],
                      scale: [1, 1.1, 1]
                    }}
                    transition={{ 
                      duration: 2,
                      repeat: Infinity,
                      repeatType: "reverse"
                    }}
                  >
                    <Rocket 
                      sx={{ 
                        fontSize: isMobile ? 32 : 40,
                        color: '#FF6B35',
                        filter: 'drop-shadow(0 4px 8px rgba(255,107,53,0.3))'
                      }} 
                    />
                  </motion.div>
                </Box>

                {/* Supporting Text */}

                {/* CTA Button */}
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Button
                    variant="contained"
                    size="large"
                    startIcon={<PlayArrow />}
                    endIcon={<ArrowRight />}
                    onClick={onStartWorkflow}
                    disabled={isLoading}
                    sx={{
                      background: 'linear-gradient(135deg, #FF6B35 0%, #E55A2B 100%)',
                      border: '2px solid transparent',
                      borderRadius: 2,
                      px: 4,
                      py: 1.5,
                      fontSize: isMobile ? '0.9rem' : '1rem',
                      fontWeight: 700,
                      textTransform: 'none',
                      boxShadow: '0 6px 24px rgba(255,107,53,0.4), 0 0 0 1px rgba(255,255,255,0.2)',
                      position: 'relative',
                      overflow: 'hidden',
                      '&:hover': {
                        background: 'linear-gradient(135deg, #E55A2B 0%, #D1491F 100%)',
                        boxShadow: '0 12px 40px rgba(255,107,53,0.6), 0 0 0 1px rgba(255,255,255,0.3)',
                        transform: 'translateY(-2px)',
                      },
                      '&:disabled': {
                        background: 'rgba(255,255,255,0.1)',
                        color: 'rgba(255,255,255,0.5)',
                      },
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        left: '-100%',
                        width: '100%',
                        height: '100%',
                        background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.6), transparent)',
                        animation: 'shimmer 2.5s infinite',
                        zIndex: 1,
                        pointerEvents: 'none', // Prevent layout impact
                        willChange: 'left', // Optimize animation
                      },
                      '&::after': {
                        content: '""',
                        position: 'absolute',
                        top: -4,
                        left: -4,
                        right: -4,
                        bottom: -4,
                        background: 'linear-gradient(45deg, #FF6B35, #FF8C42, #FF6B35, #FF8C42)',
                        backgroundSize: '400% 400%',
                        borderRadius: 'inherit',
                        zIndex: -1,
                        animation: 'borderGlow 3s ease-in-out infinite',
                        pointerEvents: 'none', // Prevent layout impact
                        willChange: 'background-position', // Optimize animation
                      },
                      '@keyframes shimmer': {
                        '0%': { left: '-100%' },
                        '100%': { left: '100%' },
                      },
                      '@keyframes borderGlow': {
                        '0%, 100%': { backgroundPosition: '0% 50%' },
                        '50%': { backgroundPosition: '100% 50%' },
                      },
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                  >
                    {isLoading ? 'Starting...' : 'Start Today\'s Tasks'}
                  </Button>
                </motion.div>

                {/* Additional Info */}
                <Typography
                  variant="caption"
                  sx={{
                    color: 'rgba(255,255,255,0.7)',
                    mt: 2,
                    display: 'block',
                    textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                  }}
                >
                  ✨ Personalized workflow • 🎯 AI-powered guidance • 📈 Business growth
                </Typography>
              </motion.div>
            </Box>
          </Box>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default WorkflowHeroSection;
