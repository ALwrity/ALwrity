import React, { useState } from 'react';
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
import { motion, AnimatePresence } from 'framer-motion';
import {
  ANALYSIS_CARD_STYLES,
  getAnalysisCardStyles,
  getEnhancedChipStyles
} from '../styles';
import ReviewStatusIndicator from './ReviewStatusIndicator';
import ReviewConfirmationPanel from './ReviewConfirmationPanel';
import { useStrategyReviewStore } from '../../../../../stores/strategyReviewStore';

interface ProgressiveCardProps {
  summary: React.ReactNode;
  details: React.ReactNode;
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  className?: string;
  componentId?: string; // For review functionality
  // Controlled accordion mode — the parent decides expansion (e.g. to enforce
  // single-open). When omitted the card toggles its own internal state.
  expanded?: boolean;
  onToggle?: () => void;
}

const ProgressiveCard: React.FC<ProgressiveCardProps> = ({
  summary,
  details,
  title,
  subtitle,
  icon,
  className,
  componentId,
  expanded,
  onToggle
}) => {
  const [internalExpanded, setInternalExpanded] = useState(false);
  const [isConfirmingReview, setIsConfirmingReview] = useState(false);
  const theme = useTheme();

  const cardStyles = getAnalysisCardStyles();

  const isExpanded = expanded !== undefined ? expanded : internalExpanded;

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

  // Handle click interactions
  const handleToggle = () => {
    if (expanded !== undefined) {
      onToggle?.();
    } else {
      setInternalExpanded(prev => !prev);
    }
  };

  const handleExpand = () => {
    if (!isExpanded) {
      if (expanded !== undefined) {
        onToggle?.();
      } else {
        setInternalExpanded(true);
      }
    }
  };

  // Review handlers — inline within the expanded accordion, no modal.
  const handleStartReview = () => {
    if (componentId) {
      handleExpand();
      startReview(componentId);
    }
  };

  const handleResetReview = () => {
    if (componentId) {
      resetReview(componentId);
    }
  };

  const handleCancelReview = () => {
    if (componentId) {
      resetReview(componentId);
    }
  };

  const handleConfirmReview = async (notes?: string) => {
    if (componentId) {
      setIsConfirmingReview(true);
      try {
        completeReview(componentId, notes);
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
        className={className}
      >
        <Card sx={cardStyles.card}>
          <CardContent sx={cardStyles.cardContent}>
            {/* Header Section */}
            {title && (
              <Box sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 1,
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
                      onResetReview={handleResetReview}
                      isReviewing={isReviewing}
                    />
                  </Box>
                )}

                {/* Trigger Button */}
                <Button
                  onClick={handleToggle}
                  variant="contained"
                  size="medium"
                  sx={{
                    background: `linear-gradient(135deg, ${ANALYSIS_CARD_STYLES.colors.primary} 0%, ${ANALYSIS_CARD_STYLES.colors.secondary} 100%)`,
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    px: 2.5,
                    py: 1,
                    borderRadius: 2,
                    border: `1px solid ${ANALYSIS_CARD_STYLES.colors.primary}60`,
                    boxShadow: `0 4px 14px ${ANALYSIS_CARD_STYLES.colors.primary}40`,
                    textTransform: 'none',
                    whiteSpace: 'nowrap',
                    '&:hover': {
                      background: `linear-gradient(135deg, ${ANALYSIS_CARD_STYLES.colors.secondary} 0%, ${ANALYSIS_CARD_STYLES.colors.accent} 100%)`,
                      boxShadow: `0 6px 18px ${ANALYSIS_CARD_STYLES.colors.primary}50`,
                      transform: 'translateY(-1px)'
                    },
                    '&:active': {
                      transform: 'translateY(0)'
                    }
                  }}
                  endIcon={
                    isExpanded ? (
                      <ExpandLessIcon sx={{ fontSize: 18 }} />
                    ) : (
                      <ExpandMoreIcon sx={{ fontSize: 18 }} />
                    )
                  }
                >
                  {isExpanded ? 'Show Less' : 'Read More'}
                </Button>
              </Box>
            )}

            {/* Summary Section - Always Visible */}
            <Box sx={{ mb: 2 }}>
              {summary}
            </Box>

            {/* Accordion Details Section */}
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

                      {/* Inline Review Panel — shown inside the expanded accordion */}
                      {componentStatus === 'in_review' && componentId && (
                        <ReviewConfirmationPanel
                          onConfirm={handleConfirmReview}
                          onCancel={handleCancelReview}
                          componentId={componentId}
                          componentTitle={title || ''}
                          componentSubtitle={subtitle || ''}
                          isConfirming={isConfirmingReview}
                        />
                      )}
                    </Box>
                  </Fade>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </motion.div>
    </>
  );
};

export default ProgressiveCard;