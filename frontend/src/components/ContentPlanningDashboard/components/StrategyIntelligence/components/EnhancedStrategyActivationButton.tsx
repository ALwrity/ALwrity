import React, { useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Typography,
  Snackbar,
  Alert,
} from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CelebrationIcon from '@mui/icons-material/Celebration';
import { motion, AnimatePresence, easeOut } from 'framer-motion';
import StrategyActivationModal from '../../StrategyActivationModal';
import { safeRenderText } from '../utils/defensiveRendering';


interface EnhancedStrategyActivationButtonProps {
  strategyData: any;
  strategyConfirmed: boolean;
  onConfirmStrategy: () => Promise<void>;
  onGenerateContentCalendar: () => void;
  disabled?: boolean;
}

const EnhancedStrategyActivationButton: React.FC<EnhancedStrategyActivationButtonProps> = ({
  strategyData,
  strategyConfirmed,
  onConfirmStrategy,
  onGenerateContentCalendar,
  disabled = false
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [activationProgress, setActivationProgress] = useState(0);
  const [showActivationModal, setShowActivationModal] = useState(false);
  
  // Initialize navigation orchestrator
  // const navigationOrchestrator = useNavigationOrchestrator();

  const handleActivation = async () => {
    console.log('🎯 EnhancedStrategyActivationButton: handleActivation called');
    if (isLoading || disabled) return;

    // Open the activation modal to show monitoring setup
    console.log('🎯 EnhancedStrategyActivationButton: Opening activation modal');
    setShowActivationModal(true);
  };

  const handleGenerateCalendar = () => {
    onGenerateContentCalendar();
  };

  const handleCloseModal = () => {
    setShowActivationModal(false);
  };

  const handleSetupMonitoring = async (monitoringPlan: any) => {
    setIsLoading(true);
    setActivationProgress(10);
    
    try {
      console.log('🎯 EnhancedStrategyActivationButton: handleSetupMonitoring called');
      
      // Get strategy ID
      const strategyId = strategyData?.id || 1;
      
      // Step 1: Generate monitoring plan if not provided
      setActivationProgress(30);
      let finalMonitoringPlan = monitoringPlan;
      if (!finalMonitoringPlan) {
        console.log('🎯 Generating monitoring plan...');
        try {
          const response = await fetch(`/api/content-planning/strategy/${strategyId}/generate-monitoring-plan`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          });
          const planResponse = await response.json();
          finalMonitoringPlan = planResponse.data;
          console.log('🎯 Monitoring plan generated:', finalMonitoringPlan);
        } catch (error) {
          console.warn('Could not generate monitoring plan:', error);
          // Continue without monitoring plan
        }
      }
      
      setActivationProgress(60);
      
      // Step 2: Activate strategy with monitoring plan
      console.log('🎯 Activating strategy with monitoring...');
      try {
        const response = await fetch(`/api/content-planning/strategy/${strategyId}/activate-with-monitoring`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(finalMonitoringPlan)
        });
        const activationResponse = await response.json();
        console.log('🎯 Strategy activated with monitoring:', activationResponse);
      } catch (error) {
        console.warn('Could not activate strategy with monitoring:', error);
        // Continue with local activation only
      }
      
      setActivationProgress(80);
      
      // Step 3: Call the local confirmation function
      console.log('🎯 EnhancedStrategyActivationButton: Calling onConfirmStrategy()');
      await onConfirmStrategy();
      console.log('🎯 EnhancedStrategyActivationButton: onConfirmStrategy() completed');
      
      setActivationProgress(100);
      setIsSuccess(true);
      setShowSuccessMessage(true);
      
      // Reset success state after a delay
      setTimeout(() => {
        setIsSuccess(false);
      }, 3000);
      
    } catch (error) {
      console.error('Strategy activation failed:', error);
      // Optional: Show error message
    } finally {
      setIsLoading(false);
      setActivationProgress(0);
    }
  };

  /* const setupAnalyticsAndMonitoring = async (strategyId: number, monitoringPlan: any) => {
    try {
      console.log('🎯 Setting up analytics and monitoring for strategy:', strategyId);
      
      // Update analytics page with monitoring data
      // This will populate the analytics dashboard with the new monitoring tasks
      const analyticsData = {
        strategy_id: strategyId,
        monitoring_plan: monitoringPlan,
        activation_date: new Date().toISOString(),
        status: 'active'
      };
      
      // Store analytics data in localStorage for the analytics page to access
      localStorage.setItem('strategy_analytics_data', JSON.stringify(analyticsData));
      
      // Also store monitoring tasks for the data transparency panel
      const monitoringTasks = monitoringPlan?.monitoringTasks || [];
      localStorage.setItem('strategy_monitoring_tasks', JSON.stringify(monitoringTasks));
      
      console.log('🎯 Analytics and monitoring setup completed');
      
    } catch (error) {
      console.error('Error setting up analytics and monitoring:', error);
      // Don't fail the activation if analytics setup fails
    }
  }; */

  // Success animation variants
  const successVariants = {
    initial: { scale: 0, opacity: 0 },
    animate: { 
      scale: [0, 1.2, 1], 
      opacity: [0, 1, 1],
      transition: { duration: 0.6, ease: easeOut }
    },
    exit: { scale: 0, opacity: 0 }
  };

  // Confetti animation variants
  const confettiVariants = {
    initial: { y: -20, opacity: 0, rotate: 0 },
    animate: { 
      y: [0, -30, 0], 
      opacity: [0, 1, 0], 
      rotate: [0, 360],
      transition: { duration: 1.5, ease: easeOut }
    }
  };

  return (
    <Box sx={{ position: 'relative' }}>
      {/* Strategy Activation Modal */}
      <StrategyActivationModal
        open={showActivationModal}
        onClose={handleCloseModal}
        strategyId={strategyData?.id || 1} // Use actual strategy ID
        strategyData={strategyData}
        onSetupMonitoring={handleSetupMonitoring}
      />

      {/* Success Message Snackbar */}
      <Snackbar
        open={showSuccessMessage}
        autoHideDuration={4000}
        onClose={() => setShowSuccessMessage(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert 
          severity="success" 
          sx={{ 
            borderRadius: 2,
            boxShadow: '0 8px 32px rgba(76, 175, 80, 0.3)',
            border: '1px solid rgba(76, 175, 80, 0.3)'
          }}
        >
          🎉 Strategy activated successfully! Ready to generate content calendar.
        </Alert>
      </Snackbar>

      {/* Main Button Container */}
      <Box sx={{ display: 'flex', justifyContent: 'center', position: 'relative' }}>
        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          style={{ position: 'relative' }}
        >
          {/* Enhanced Activation Button */}
          <Button
            variant="contained"
            size="large"
            onClick={strategyConfirmed ? handleGenerateCalendar : handleActivation}
            disabled={disabled || isLoading}
            startIcon={
              isLoading ? (
                <CircularProgress 
                  size={20} 
                  sx={{ color: 'white' }} 
                />
              ) : isSuccess ? (
                <CheckIcon />
              ) : strategyConfirmed ? (
                <AutoAwesomeIcon />
              ) : (
                <PlayArrowIcon />
              )
            }
            sx={{
              background: strategyConfirmed 
                ? 'linear-gradient(135deg, #4caf50 0%, #45a049 100%)'
                : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              borderRadius: 4,
              px: 6,
              py: 2,
              fontWeight: 700,
              fontSize: '1.1rem',
              textTransform: 'none',
              letterSpacing: '0.5px',
              boxShadow: strategyConfirmed
                ? '0 8px 32px rgba(76, 175, 80, 0.4), 0 0 20px rgba(76, 175, 80, 0.2)'
                : '0 8px 32px rgba(102, 126, 234, 0.4), 0 0 20px rgba(102, 126, 234, 0.2)',
              border: '2px solid transparent',
              backgroundClip: 'padding-box',
              position: 'relative',
              overflow: 'hidden',
              minWidth: 280,
              height: 56,
              '&:hover': {
                background: strategyConfirmed
                  ? 'linear-gradient(135deg, #45a049 0%, #3d8b40 100%)'
                  : 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)',
                boxShadow: strategyConfirmed
                  ? '0 12px 40px rgba(76, 175, 80, 0.5), 0 0 30px rgba(76, 175, 80, 0.3)'
                  : '0 12px 40px rgba(102, 126, 234, 0.5), 0 0 30px rgba(102, 126, 234, 0.3)',
                transform: 'translateY(-3px)',
                '&::before': {
                  opacity: 1,
                  transform: 'scale(1.1)'
                }
              },
              '&:disabled': {
                background: 'linear-gradient(135deg, #9e9e9e 0%, #757575 100%)',
                boxShadow: 'none',
                transform: 'none'
              },
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.2) 50%, transparent 70%)',
                opacity: 0,
                transform: 'scale(0.8)',
                transition: 'all 0.3s ease',
                pointerEvents: 'none'
              },
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          >
            {/* Button Text */}
            <AnimatePresence mode="wait">
              {isLoading ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <Typography variant="button" sx={{ fontWeight: 600 }}>
                    Activating Strategy... {activationProgress}%
                  </Typography>
                </motion.div>
              ) : isSuccess ? (
                <motion.div
                  key="success"
                  variants={successVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CelebrationIcon />
                    <Typography variant="button" sx={{ fontWeight: 600 }}>
                      Strategy Activated!
                    </Typography>
                    <motion.span
                      variants={confettiVariants}
                      initial="initial"
                      animate="animate"
                    >
                      🎉
                    </motion.span>
                  </Box>
                </motion.div>
              ) : strategyConfirmed ? (
                <motion.div
                  key="calendar"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Typography variant="button" sx={{ fontWeight: 600 }}>
                    Generate Content Calendar
                  </Typography>
                </motion.div>
              ) : (
                <motion.div
                  key="activate"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Typography variant="button" sx={{ fontWeight: 600 }}>
                    Confirm & Activate Strategy
                  </Typography>
                </motion.div>
              )}
            </AnimatePresence>
          </Button>

          {/* Progress Ring (shown during loading) */}
          <AnimatePresence>
            {isLoading && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  zIndex: 1
                }}
              >
                <Box
                  sx={{
                    width: 80,
                    height: 80,
                    borderRadius: '50%',
                    background: 'conic-gradient(from 0deg, rgba(102, 126, 234, 0.3) 0deg, rgba(102, 126, 234, 0.8) 360deg)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    animation: 'spin 2s linear infinite',
                    '@keyframes spin': {
                      '0%': { transform: 'translate(-50%, -50%) rotate(0deg)' },
                      '100%': { transform: 'translate(-50%, -50%) rotate(360deg)' }
                    }
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Success Animation Overlay */}
          <AnimatePresence>
            {isSuccess && (
              <motion.div
                variants={successVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  zIndex: 2
                }}
              >
                <Box
                  sx={{
                    width: 60,
                    height: 60,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #4caf50 0%, #45a049 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 8px 32px rgba(76, 175, 80, 0.4)'
                  }}
                >
                  <CheckIcon sx={{ color: 'white', fontSize: 32 }} />
                </Box>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Confetti Animation */}
          <AnimatePresence>
            {isSuccess && (
              <>
                {[...Array(8)].map((_, index) => (
                  <motion.div
                    key={index}
                    variants={confettiVariants}
                    initial="initial"
                    animate="animate"
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      zIndex: 3,
                      transform: `translate(-50%, -50%) rotate(${index * 45}deg)`
                    }}
                  >
                    <CelebrationIcon 
                      sx={{ 
                        color: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57'][index % 5],
                        fontSize: 16
                      }} 
                    />
                  </motion.div>
                ))}
              </>
            )}
          </AnimatePresence>
        </motion.div>
      </Box>

      {/* Status Text */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            style={{ marginTop: 16, textAlign: 'center' }}
          >
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
              Setting up monitoring and quality gates...
            </Typography>
          </motion.div>
        )}
      </AnimatePresence>
    </Box>
  );
};

export default EnhancedStrategyActivationButton;
