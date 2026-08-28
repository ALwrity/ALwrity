import React from 'react';
import {
  Box,
  Chip,
  IconButton,
  Tooltip,
  Typography,
  Button
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ScheduleIcon from '@mui/icons-material/Schedule';
import WarningIcon from '@mui/icons-material/Warning';
import EditIcon from '@mui/icons-material/Edit';
import UndoIcon from '@mui/icons-material/Undo';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { motion } from 'framer-motion';
import { ReviewStatus } from '../../../../../stores/strategyReviewStore';
import { ANALYSIS_CARD_STYLES } from '../styles';

interface ReviewStatusIndicatorProps {
  status: ReviewStatus;
  reviewedAt?: Date;
  onStartReview?: () => void;
  onCompleteReview?: () => void;
  onResetReview?: () => void;
  isReviewing?: boolean;
}

const ReviewStatusIndicator: React.FC<ReviewStatusIndicatorProps> = ({
  status,
  reviewedAt,
  onStartReview,
  onCompleteReview,
  onResetReview,
  isReviewing = false
}) => {
  // Debug logging for status
  // Removed verbose logging for cleaner console
  const getStatusConfig = () => {
    switch (status) {
      case 'activated':
        return {
          icon: <PlayArrowIcon />,
          label: 'Activated',
          color: ANALYSIS_CARD_STYLES.colors.primary,
          bgColor: 'rgba(102, 126, 234, 0.1)',
          borderColor: 'rgba(102, 126, 234, 0.3)',
          textColor: ANALYSIS_CARD_STYLES.colors.primary
        };
      case 'reviewed':
        return {
          icon: <CheckCircleIcon />,
          label: 'Reviewed',
          color: ANALYSIS_CARD_STYLES.colors.success,
          bgColor: 'rgba(76, 175, 80, 0.1)',
          borderColor: 'rgba(76, 175, 80, 0.3)',
          textColor: ANALYSIS_CARD_STYLES.colors.success
        };
      case 'not_reviewed':
      default:
        return {
          icon: <WarningIcon />,
          label: 'Not Reviewed',
          color: ANALYSIS_CARD_STYLES.colors.warning,
          bgColor: 'rgba(255, 152, 0, 0.1)',
          borderColor: 'rgba(255, 152, 0, 0.3)',
          textColor: ANALYSIS_CARD_STYLES.colors.warning
        };
    }
  };

  const config = getStatusConfig();

  const formatReviewDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          p: 1,
          borderRadius: 1,
          background: config.bgColor,
          border: '1px solid',
          borderColor: config.borderColor,
          minHeight: 32,
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          '&:hover': {
            background: `${config.bgColor}80`,
            transform: 'translateY(-1px)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }
        }}
        onClick={() => {
          if (status === 'not_reviewed' && onStartReview) {
            onStartReview();
          } else if (status === 'reviewed' && onResetReview) {
            onResetReview();
          }
          // Activated status is read-only, no action needed
        }}
      >
        {/* Status Icon */}
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center',
          color: config.color
        }}>
          {config.icon}
        </Box>

        {/* Status Label */}
        <Typography
          variant="caption"
          sx={{
            color: config.textColor,
            fontWeight: 600,
            fontSize: '0.75rem',
            flex: 1
          }}
        >
          {config.label}
        </Typography>

        {/* Review Date */}
        {(status === 'reviewed' || status === 'activated') && reviewedAt && (
          <Typography
            variant="caption"
            sx={{
              color: ANALYSIS_CARD_STYLES.colors.text.secondary,
              fontSize: '0.7rem',
              fontStyle: 'italic'
            }}
          >
            {formatReviewDate(reviewedAt)}
          </Typography>
        )}

        {/* Action Buttons - Enhanced for better UX */}
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {/* Only show action buttons for non-activated states */}
          {status !== 'activated' && (
            <>
              {status === 'not_reviewed' && onStartReview && (
            <Tooltip title="Review Component">
              <Button
                variant="contained"
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onStartReview();
                }}
                disabled={isReviewing}
                startIcon={<EditIcon />}
                sx={{
                  background: 'linear-gradient(135deg, #ff9800 0%, #ffb74d 100%)',
                  color: 'white',
                  fontWeight: 600,
                  fontSize: '0.7rem',
                  px: 1.5,
                  py: 0.5,
                  borderRadius: 2,
                  boxShadow: '0 2px 8px rgba(255, 152, 0, 0.3)',
                  border: '1px solid rgba(255, 152, 0, 0.4)',
                  textTransform: 'none',
                  minWidth: 'auto',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #ffb74d 0%, #ffcc02 100%)',
                    boxShadow: '0 4px 12px rgba(255, 152, 0, 0.4)',
                    transform: 'translateY(-1px)'
                  },
                  '&:active': {
                    transform: 'translateY(0)',
                    boxShadow: '0 2px 4px rgba(255, 152, 0, 0.3)'
                  },
                  '&:disabled': {
                    background: 'rgba(255, 152, 0, 0.3)',
                    color: 'rgba(255, 255, 255, 0.7)',
                    boxShadow: 'none',
                    transform: 'none'
                  },
                  '& .MuiButton-startIcon': {
                    marginRight: 0.5
                  }
                }}
              >
                Review
              </Button>
            </Tooltip>
          )}

              {status === 'reviewed' && onResetReview && (
                <Tooltip title="Reset Review">
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      onResetReview();
                    }}
                    disabled={isReviewing}
                    startIcon={<UndoIcon />}
                    sx={{
                      color: ANALYSIS_CARD_STYLES.colors.warning,
                      borderColor: 'rgba(255, 152, 0, 0.5)',
                      fontWeight: 600,
                      fontSize: '0.7rem',
                      px: 1.5,
                      py: 0.5,
                      borderRadius: 2,
                      textTransform: 'none',
                      minWidth: 'auto',
                      background: 'rgba(255, 152, 0, 0.05)',
                      '&:hover': {
                        background: 'rgba(255, 152, 0, 0.1)',
                        borderColor: 'rgba(255, 152, 0, 0.7)',
                        transform: 'translateY(-1px)',
                        boxShadow: '0 2px 8px rgba(255, 152, 0, 0.2)'
                      },
                      '&:active': {
                        transform: 'translateY(0)'
                      },
                      '&:disabled': {
                        color: 'rgba(255, 152, 0, 0.4)',
                        borderColor: 'rgba(255, 152, 0, 0.2)',
                        background: 'rgba(255, 152, 0, 0.02)',
                        transform: 'none'
                      },
                      '& .MuiButton-startIcon': {
                        marginRight: 0.5
                      }
                    }}
                  >
                    Reset
                  </Button>
                </Tooltip>
              )}
            </>
          )}
        </Box>
      </Box>
    </motion.div>
  );
};

export default ReviewStatusIndicator;
