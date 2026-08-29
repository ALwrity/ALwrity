import React from 'react';
import {
  Box,
  Typography,
  Chip,
  Tooltip,
  CircularProgress,
  Badge,
  Button
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ScheduleIcon from '@mui/icons-material/Schedule';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { motion } from 'framer-motion';
import { StrategyData } from '../types/strategy.types';
import { useStrategyReviewStore, StrategyComponent } from '../../../../../stores/strategyReviewStore';
import { ANALYSIS_CARD_STYLES } from '../styles';
import EnhancedStrategyActivationButton from './EnhancedStrategyActivationButton';
import { useNavigationOrchestrator } from '../../../../../services/navigationOrchestrator';
import { useStrategyCalendarContext } from '../../../../../contexts/StrategyCalendarContext';
import { useStrategyBuilderStore } from '../../../../../stores/strategyBuilderStore';

interface ReviewProgressSectionProps {
  strategyData: StrategyData;
}

const ReviewProgressSection: React.FC<ReviewProgressSectionProps> = ({ strategyData }) => {
  const {
    components,
    reviewProgress,
    isAllReviewed,
    isActivated,
    resetAllReviews,
    getUnreviewedComponents,
    getReviewedComponents,
    activateStrategy
  } = useStrategyReviewStore();

  // Initialize navigation orchestrator
  const navigationOrchestrator = useNavigationOrchestrator();
  
  // Get strategy calendar context
  const { setStrategyContext } = useStrategyCalendarContext();
  
  // Get actual strategy data from strategy builder store
  const strategyBuilderData = useStrategyBuilderStore(state => state.currentStrategy);

  // Extract domain name from strategy data
  const getDomainName = () => {
    // Since StrategyMetadata doesn't have domain, we'll use a fallback
    return "alwrity.com"; // fallback
  };

  const unreviewedCount = getUnreviewedComponents().length;
  const reviewedCount = getReviewedComponents().length;
  const totalCount = components.length;

  // Debug logging
  console.log('🔍 ReviewProgressSection Debug:', {
    components,
    reviewProgress,
    unreviewedCount,
    reviewedCount,
    totalCount,
    isAllReviewed: isAllReviewed(),
    isActivated: isActivated(),
    strategyData
  });

  const getProgressColor = () => {
    if (isActivated()) return ANALYSIS_CARD_STYLES.colors.success;
    if (reviewProgress === 100) return ANALYSIS_CARD_STYLES.colors.success;
    if (reviewProgress >= 60) return ANALYSIS_CARD_STYLES.colors.primary;
    if (reviewProgress >= 30) return ANALYSIS_CARD_STYLES.colors.warning;
    return ANALYSIS_CARD_STYLES.colors.error;
  };

  const getProgressText = () => {
    if (isActivated()) return 'Strategy Active & Monitored!';
    if (reviewProgress === 100) return 'All components reviewed!';
    if (reviewProgress >= 60) return 'Great progress!';
    if (reviewProgress >= 30) return 'Making good progress';
    return 'Getting started';
  };

  // Prepare strategy data for the enhanced button
  const buttonStrategyData = strategyData ? {
    id: strategyData.strategy_metadata?.user_id || strategyData.metadata?.user_id || 1,
    business_name: strategyData.strategy_metadata?.strategy_name || strategyData.metadata?.strategy_name || "ALwrity",
    domain: getDomainName(),
    // Add other strategy data as needed
  } : {
    id: 1,
    business_name: "ALwrity",
    domain: getDomainName(),
  };

  const handleConfirmStrategy = async () => {
    // This will be called by the enhanced button when activation is confirmed
    console.log('🎯 Strategy activation confirmed');
    
    // Activate the strategy in the store
    activateStrategy();
    
    // You can add additional logic here if needed
  };

  const handleGenerateContentCalendar = () => {
    console.log('🎯 Generate content calendar clicked');
    
    // Use actual strategy data from strategy builder store
    const actualStrategyData = strategyBuilderData || strategyData;
    
    console.log('🎯 ReviewProgressSection: Strategy data for calendar generation:', {
      strategyBuilderData: !!strategyBuilderData,
      strategyData: !!strategyData,
      actualStrategyData: !!actualStrategyData
    });
    
    // Prepare strategy context for navigation
    const strategyContext = {
      strategyId: (() => {
        if (actualStrategyData && 'id' in actualStrategyData) {
          return actualStrategyData.id.toString();
        } else if (actualStrategyData && 'strategy_metadata' in actualStrategyData) {
          return actualStrategyData.strategy_metadata?.user_id?.toString() || '1';
        } else if (actualStrategyData && 'metadata' in actualStrategyData) {
          return actualStrategyData.metadata?.user_id?.toString() || '1';
        }
        return '1';
      })(),
      strategyData: actualStrategyData,
      activationStatus: 'active' as const,
      activationTimestamp: new Date().toISOString(),
      userPreferences: {},
      strategicIntelligence: {}
    };
    
    // Set strategy context in the StrategyCalendarContext
    setStrategyContext(strategyContext);
    
    // Navigate to calendar wizard using navigation orchestrator
    navigationOrchestrator.navigateToCalendarWizard(
      strategyContext.strategyId,
      strategyContext
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
    >
      {/* Header Section */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ 
            fontWeight: 700, 
            background: 'linear-gradient(45deg, #667eea, #764ba2)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            mb: 0.5
          }}>
            Strategy Review Progress
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.8)', fontWeight: 500 }}>
            Review all strategy components to activate your content strategy
          </Typography>
        </Box>

        {/* Progress Circle */}
        <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ position: 'relative' }}>
            <CircularProgress
              variant="determinate"
              value={reviewProgress}
              size={60}
              thickness={4}
              sx={{
                color: getProgressColor(),
                '& .MuiCircularProgress-circle': {
                  strokeLinecap: 'round',
                  filter: 'drop-shadow(0 0 8px rgba(102, 126, 234, 0.5))'
                }
              }}
            />
            <Box
              sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                textAlign: 'center'
              }}
            >
              <Typography variant="caption" sx={{ 
                fontSize: '0.7rem', 
                fontWeight: 700,
                color: 'white',
                lineHeight: 1
              }}>
                {reviewProgress}%
              </Typography>
            </Box>
          </Box>
          
          {/* Progress Text */}
          <Box>
            <Typography variant="body2" sx={{ 
              fontWeight: 600, 
              color: getProgressColor(),
              fontSize: '0.8rem'
            }}>
              {getProgressText()}
            </Typography>
            <Typography variant="caption" sx={{ 
              color: 'rgba(255, 255, 255, 0.7)',
              fontSize: '0.7rem'
            }}>
              {reviewedCount} of {totalCount} reviewed
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Component Status */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="body2" sx={{ 
          fontWeight: 600, 
          mb: 1,
          color: 'rgba(255, 255, 255, 0.9)'
        }}>
          Component Status:
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {components.map((component: StrategyComponent) => (
            <Tooltip
              key={component.id}
              title={`${component.title}: ${component.status === 'reviewed' ? 'Reviewed' : 'Pending Review'}`}
              arrow
            >
              <Badge
                badgeContent={
                  component.status === 'reviewed' ? (
                    <CheckCircleIcon sx={{ fontSize: 10, color: 'white' }} />
                  ) : (
                    <ScheduleIcon sx={{ fontSize: 10, color: 'white' }} />
                  )
                }
                color={component.status === 'reviewed' ? 'success' : 'warning'}
              >
                <Chip
                  label={component.title}
                  size="small"
                  sx={{
                    background: component.status === 'reviewed' 
                      ? 'rgba(76, 175, 80, 0.3)' 
                      : 'rgba(255, 152, 0, 0.3)',
                    color: component.status === 'reviewed' ? '#4caf50' : '#ff9800',
                    border: `1px solid ${component.status === 'reviewed' ? 'rgba(76, 175, 80, 0.5)' : 'rgba(255, 152, 0, 0.5)'}`,
                    fontWeight: 600,
                    fontSize: '0.65rem',
                    height: 22,
                    '&:hover': {
                      background: component.status === 'reviewed' 
                        ? 'rgba(76, 175, 80, 0.4)' 
                        : 'rgba(255, 152, 0, 0.4)',
                      transform: 'translateY(-1px)'
                    },
                    transition: 'all 0.2s ease'
                  }}
                />
              </Badge>
            </Tooltip>
          ))}
        </Box>
      </Box>

      {/* Completion Status */}
      {isAllReviewed() && (
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Chip
            icon={<CheckCircleIcon />}
            label={isActivated() ? "Strategy Active & Monitored" : "Ready for Calendar Creation"}
            size="small"
            sx={{
              background: ANALYSIS_CARD_STYLES.colors.success,
              color: 'white',
              fontWeight: 500,
              animation: 'pulse 2s infinite',
              fontSize: '0.65rem',
              height: 22,
              '@keyframes pulse': {
                '0%, 100%': { opacity: 1 },
                '50%': { opacity: 0.7 }
              },
              '& .MuiChip-icon': {
                color: 'white',
                fontSize: 14
              }
            }}
          />
        </Box>
      )}

      {/* Completion Message */}
      {isAllReviewed() && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <Box sx={{ 
            mt: 1.5, 
            p: 1.5, 
            borderRadius: 1,
            background: isActivated() ? 'rgba(76, 175, 80, 0.15)' : 'rgba(76, 175, 80, 0.1)',
            border: '1px solid rgba(76, 175, 80, 0.2)',
            textAlign: 'center'
          }}>
            <Typography variant="body2" sx={{ 
              color: ANALYSIS_CARD_STYLES.colors.success,
              fontWeight: 600,
              fontSize: '0.8rem'
            }}>
              {isActivated() 
                ? '🎉 Your content strategy is now active and being monitored! AI-powered insights and performance tracking are now live.'
                : '🎉 All strategy components have been reviewed! You can now proceed to create your content calendar.'
              }
            </Typography>
          </Box>
        </motion.div>
      )}

      {/* Enhanced Strategy Activation Button - Only shown when all components are reviewed and not yet activated */}
      {isAllReviewed() && !isActivated() && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
            <EnhancedStrategyActivationButton
              strategyData={buttonStrategyData}
              strategyConfirmed={false}
              onConfirmStrategy={handleConfirmStrategy}
              onGenerateContentCalendar={handleGenerateContentCalendar}
              disabled={false}
            />
          </Box>
        </motion.div>
      )}

      {/* Strategy Activated Success Message */}
      {isActivated() && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <Box sx={{ 
            mt: 3, 
            p: 3, 
            borderRadius: 2,
            background: 'linear-gradient(135deg, rgba(76, 175, 80, 0.1) 0%, rgba(76, 175, 80, 0.05) 100%)',
            border: '2px solid rgba(76, 175, 80, 0.3)',
            textAlign: 'center'
          }}>
            <Typography variant="h6" sx={{ 
              color: ANALYSIS_CARD_STYLES.colors.success,
              fontWeight: 700,
              mb: 1
            }}>
              🚀 Strategy Successfully Activated!
            </Typography>
            <Typography variant="body2" sx={{ 
              color: 'text.secondary',
              mb: 2
            }}>
              Your content strategy is now live and being monitored with AI-powered analytics.
            </Typography>
            <Button
              variant="contained"
              size="large"
              onClick={handleGenerateContentCalendar}
              startIcon={<AutoAwesomeIcon />}
              sx={{
                background: 'linear-gradient(135deg, #4caf50 0%, #45a049 100%)',
                borderRadius: 3,
                px: 4,
                py: 1.5,
                fontWeight: 600,
                textTransform: 'none',
                boxShadow: '0 8px 32px rgba(76, 175, 80, 0.3)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #45a049 0%, #3d8b40 100%)',
                  boxShadow: '0 12px 40px rgba(76, 175, 80, 0.4)',
                  transform: 'translateY(-2px)'
                },
                transition: 'all 0.3s ease'
              }}
            >
              Generate Content Calendar
            </Button>
          </Box>
        </motion.div>
      )}
    </motion.div>
  );
};

export default ReviewProgressSection;
