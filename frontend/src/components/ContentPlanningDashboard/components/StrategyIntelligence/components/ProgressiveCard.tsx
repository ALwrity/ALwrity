import React, { useState, useRef } from 'react';
import {
  Card,
  CardContent,
  Box,
  Button,
  Typography,
  Fade,
  useTheme
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ANALYSIS_CARD_STYLES,
  getAnalysisCardStyles,
  getEnhancedChipStyles
} from '../styles';
import ReviewStatusIndicator from './ReviewStatusIndicator';
import ReviewConfirmationDialog from './ReviewConfirmationDialog';
import { useStrategyReviewStore } from '../../../../../stores/strategyReviewStore';

interface ProgressiveCardProps {
  summary: React.ReactNode;
  details: React.ReactNode;
  trigger?: 'hover' | 'click';
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  autoCollapseDelay?: number; // milliseconds
  className?: string;
  componentId?: string; // For review functionality
}

const ProgressiveCard: React.FC<ProgressiveCardProps> = ({
  summary,
  details,
  trigger = 'click',
  title,
  subtitle,
  icon,
  autoCollapseDelay = 3000, // 3 seconds default
  className,
  componentId
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [isConfirmingReview, setIsConfirmingReview] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const theme = useTheme();
  
  const cardStyles = getAnalysisCardStyles();

  // Get review state for this component
  const {
    components,
    isReviewing,
    startReview,
    completeReview,
    resetReview
  } = useStrategyReviewStore();

  const component = componentId ? components.find(c => c.id === componentId) : null;
  const componentStatus = component?.status || 'not_reviewed';
  const componentReviewedAt = component?.reviewedAt;

  // Debug logging for component status
  // Removed verbose logging for cleaner console

  // Handle hover interactions
  const handleMouseEnter = () => {
    if (trigger === 'hover') {
      // Clear any existing timeout
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = null;
      }
      setIsExpanded(true);
    }
  };

  const handleMouseLeave = () => {
    if (trigger === 'hover') {
      // Set timeout to auto-collapse
      hoverTimeoutRef.current = setTimeout(() => {
        setIsExpanded(false);
        hoverTimeoutRef.current = null;
      }, autoCollapseDelay);
    }
  };

  // Handle click interactions
  const handleToggle = () => {
    if (trigger === 'click') {
      setIsExpanded(!isExpanded);
    }
  };

  // Review handlers
  const handleStartReview = () => {
    if (componentId) {
      // Open the review dialog directly instead of setting to "in_review"
      setShowReviewDialog(true);
    }
  };

  const handleCompleteReview = () => {
    if (componentId) {
      setShowReviewDialog(true);
    }
  };

  const handleResetReview = () => {
    if (componentId) {
      resetReview(componentId);
    }
  };

  const handleConfirmReview = async (notes?: string) => {
    if (componentId) {
      setIsConfirmingReview(true);
      try {
        // Complete the review directly from "not_reviewed" to "reviewed"
        completeReview(componentId, notes);
        setShowReviewDialog(false);
      } finally {
        setIsConfirmingReview(false);
      }
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        whileHover={{ y: -4 }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={className}
        style={{
          gridColumn: isExpanded && trigger === 'hover' ? '1 / -1' : 'auto',
          zIndex: isExpanded && trigger === 'hover' ? 10 : 1,
          transition: 'grid-column 0.3s ease, z-index 0.3s ease, margin 0.3s ease',
          margin: isExpanded && trigger === 'hover' ? '16px 0' : '0',
          padding: isExpanded && trigger === 'hover' ? '8px 0' : '0',
        }}
      >
        <Card sx={{
          ...cardStyles.card,
          transform: isExpanded && trigger === 'hover' ? 'scale(1.02)' : 'scale(1)',
          boxShadow: isExpanded && trigger === 'hover' 
            ? '0 8px 32px rgba(0, 0, 0, 0.15)' 
            : cardStyles.card.boxShadow,
          transition: 'all 0.3s ease',
          margin: isExpanded && trigger === 'hover' ? '8px 0' : '0',
          '& .bounce-icon': {
            animation: 'bounce 2s infinite'
          },
          '@keyframes bounce': {
            '0%, 20%, 50%, 80%, 100%': { transform: 'translateY(0)' },
            '40%': { transform: 'translateY(-4px)' },
            '60%': { transform: 'translateY(-2px)' }
          }
        }}>
          <CardContent sx={cardStyles.cardContent}>
            {/* Header Section */}
            {title && (
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                mb: 2 
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  {icon && (
                    <Box sx={{ 
                      p: 1, 
                      borderRadius: 2, 
                      background: `linear-gradient(135deg, ${ANALYSIS_CARD_STYLES.colors.primary} 0%, ${ANALYSIS_CARD_STYLES.colors.secondary} 100%)`,
                      mr: 1.5,
                      boxShadow: `0 4px 12px ${ANALYSIS_CARD_STYLES.colors.primary}30`
                    }}>
                      {icon}
                    </Box>
                  )}
                  <Box>
                    <Typography variant="h6" sx={{ 
                      fontWeight: 600,
                      color: ANALYSIS_CARD_STYLES.colors.text.primary
                    }}>
                      {title}
                    </Typography>
                    {subtitle && (
                      <Typography variant="caption" sx={{ 
                        color: ANALYSIS_CARD_STYLES.colors.text.secondary,
                        fontSize: '0.75rem'
                      }}>
                        {subtitle}
                      </Typography>
                    )}
                  </Box>
                </Box>
                
                {/* Review Status Indicator */}
                {componentId && (
                  <Box sx={{ ml: 2 }}>
                    <ReviewStatusIndicator
                      status={componentStatus}
                      reviewedAt={componentReviewedAt}
                      onStartReview={handleStartReview}
                      onCompleteReview={handleCompleteReview}
                      onResetReview={handleResetReview}
                      isReviewing={isReviewing}
                    />
                  </Box>
                )}
                
                {/* Trigger Button */}
                {trigger === 'click' && (
                  <Button
                    onClick={handleToggle}
                    variant="text"
                    size="small"
                    sx={{
                      color: ANALYSIS_CARD_STYLES.colors.primary,
                      '&:hover': {
                        background: 'rgba(102, 126, 234, 0.1)'
                      },
                      minWidth: 'auto',
                      px: 1.5,
                      py: 0.5,
                      borderRadius: 2,
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      textTransform: 'none'
                    }}
                    endIcon={
                      isExpanded ? (
                        <ExpandLessIcon sx={{ fontSize: 16 }} />
                      ) : (
                        <ExpandMoreIcon sx={{ fontSize: 16 }} />
                      )
                    }
                  >
                    {isExpanded ? 'Show Less' : 'Read More'}
                  </Button>
                )}
              </Box>
            )}

            {/* Summary Section - Always Visible */}
            <Box sx={{ mb: trigger === 'click' ? 2 : 0 }}>
              {summary}
            </Box>

            {/* Progressive Details Section */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ 
                    height: 0, 
                    opacity: 0,
                    overflow: 'hidden'
                  }}
                  animate={{ 
                    height: 'auto', 
                    opacity: 1,
                    overflow: 'visible'
                  }}
                  exit={{ 
                    height: 0, 
                    opacity: 0,
                    overflow: 'hidden'
                  }}
                  transition={{ 
                    duration: 0.4, 
                    ease: [0.4, 0.0, 0.2, 1],
                    opacity: { duration: 0.3 }
                  }}
                >
                  <Fade in={isExpanded} timeout={300}>
                    <Box sx={{ 
                      pt: 2,
                      borderTop: `1px solid ${ANALYSIS_CARD_STYLES.colors.border.secondary}`,
                      opacity: 0.9
                    }}>
                      {details}
                    </Box>
                  </Fade>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Hover Indicator (for hover trigger) */}
            {trigger === 'hover' && !isExpanded && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.6 }}
                transition={{ duration: 0.3 }}
              >
                <Box sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  mt: 1,
                  py: 0.5
                }}>
                  <ArrowDownIcon className="bounce-icon" sx={{ 
                    color: ANALYSIS_CARD_STYLES.colors.text.secondary,
                    fontSize: 16
                  }} />
                  <Typography variant="caption" sx={{ 
                    color: ANALYSIS_CARD_STYLES.colors.text.secondary,
                    ml: 0.5,
                    fontSize: '0.7rem'
                  }}>
                    Hover to see more
                  </Typography>
                </Box>
              </motion.div>
            )}

            {/* Full Width Expansion Indicator */}
            {trigger === 'hover' && isExpanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Box sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  mt: 1,
                  py: 0.5,
                  background: 'rgba(102, 126, 234, 0.1)',
                  borderRadius: 1,
                  border: '1px solid rgba(102, 126, 234, 0.2)'
                }}>
                  <Typography variant="caption" sx={{ 
                    color: ANALYSIS_CARD_STYLES.colors.primary,
                    fontSize: '0.7rem',
                    fontWeight: 500
                  }}>
                    ✨ Expanded to full width for better readability
                  </Typography>
                </Box>
              </motion.div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Review Confirmation Dialog */}
      {componentId && (
        <ReviewConfirmationDialog
          open={showReviewDialog}
          onClose={() => setShowReviewDialog(false)}
          onConfirm={handleConfirmReview}
          componentId={componentId}
          componentTitle={title || ''}
          componentSubtitle={subtitle || ''}
          isConfirming={isConfirmingReview}
        />
      )}
    </>
  );
};

export default ProgressiveCard; 