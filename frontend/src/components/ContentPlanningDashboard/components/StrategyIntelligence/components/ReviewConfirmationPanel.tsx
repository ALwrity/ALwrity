import React, { useState } from 'react';
import {
  Box,
  Button,
  Typography,
  TextField,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  CircularProgress
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import TimelineIcon from '@mui/icons-material/Timeline';
import WarningIcon from '@mui/icons-material/Warning';
import CloseIcon from '@mui/icons-material/Close';
import { ANALYSIS_CARD_STYLES } from '../styles';
import { safeRenderText } from '../utils/defensiveRendering';

interface ReviewConfirmationPanelProps {
  onConfirm: (notes?: string) => void;
  onCancel: () => void;
  componentId: string;
  componentTitle: string;
  componentSubtitle: string;
  isConfirming?: boolean;
}

const ReviewConfirmationPanel: React.FC<ReviewConfirmationPanelProps> = ({
  onConfirm,
  onCancel,
  componentId,
  componentTitle,
  componentSubtitle,
  isConfirming = false
}) => {
  const [notes, setNotes] = useState('');

  const getComponentIcon = (id: string) => {
    switch (id) {
      case 'strategic_insights':
        return <LightbulbIcon />;
      case 'competitive_analysis':
        return <TrendingUpIcon />;
      case 'performance_predictions':
        return <ShowChartIcon />;
      case 'implementation_roadmap':
        return <TimelineIcon />;
      case 'risk_assessment':
        return <WarningIcon />;
      default:
        return <CheckCircleIcon />;
    }
  };

  const getComponentSummary = (id: string) => {
    switch (id) {
      case 'strategic_insights':
        return [
          'Market positioning analysis',
          'Growth potential assessment',
          'SWOT analysis summary',
          'Content opportunities identification'
        ];
      case 'competitive_analysis':
        return [
          'Competitor landscape analysis',
          'Market gaps identification',
          'Competitive advantages',
          'Strategic recommendations'
        ];
      case 'performance_predictions':
        return [
          'ROI projections',
          'Traffic growth forecasts',
          'Engagement metrics predictions',
          'Success probability assessment'
        ];
      case 'implementation_roadmap':
        return [
          'Project timeline and phases',
          'Resource allocation plan',
          'Milestone tracking',
          'Success metrics definition'
        ];
      case 'risk_assessment':
        return [
          'Risk identification and analysis',
          'Mitigation strategies',
          'Monitoring framework',
          'Contingency planning'
        ];
      default:
        return ['Strategy component analysis'];
    }
  };

  const handleConfirm = () => {
    onConfirm(notes.trim() || undefined);
    setNotes('');
  };

  const handleCancel = () => {
    setNotes('');
    onCancel();
  };

  return (
    <Box
      sx={{
        mt: 2,
        borderRadius: 2,
        p: 2,
        background: 'rgba(0, 0, 0, 0.35)',
        border: `1px solid rgba(102, 126, 234, 0.35)`,
        boxShadow: '0 4px 20px rgba(102, 126, 234, 0.15)',
        backdropFilter: 'blur(10px)'
      }}
    >
      {/* Panel Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <Box sx={{
          p: 1,
          borderRadius: 2,
          background: `linear-gradient(135deg, ${ANALYSIS_CARD_STYLES.colors.primary} 0%, ${ANALYSIS_CARD_STYLES.colors.secondary} 100%)`,
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: `0 4px 12px ${ANALYSIS_CARD_STYLES.colors.primary}40`
        }}>
          {getComponentIcon(componentId)}
        </Box>
        <Box>
          <Typography variant="subtitle1" sx={{
            color: ANALYSIS_CARD_STYLES.colors.text.primary,
            fontWeight: 700,
            lineHeight: 1.3
          }}>
            Review Strategy Component
          </Typography>
          <Typography variant="caption" sx={{
            color: ANALYSIS_CARD_STYLES.colors.text.secondary
          }}>
            {componentSubtitle}
          </Typography>
        </Box>
      </Box>

      {/* What is being reviewed */}
      <Typography variant="body2" sx={{
        color: ANALYSIS_CARD_STYLES.colors.text.primary,
        mb: 1,
        fontWeight: 600
      }}>
        You're reviewing <span style={{ color: ANALYSIS_CARD_STYLES.colors.primary }}>"{componentTitle}"</span>
      </Typography>
      <Typography variant="caption" sx={{
        color: ANALYSIS_CARD_STYLES.colors.text.secondary,
        display: 'block',
        mb: 1
      }}>
        This component includes the following analysis:
      </Typography>

      <List dense disablePadding sx={{ mb: 1.5 }}>
        {getComponentSummary(componentId).map((item, index) => (
          <ListItem key={index} sx={{ py: 0.5, px: 0 }}>
            <ListItemIcon sx={{ minWidth: 32 }}>
              <Box sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: ANALYSIS_CARD_STYLES.colors.primary,
                opacity: 0.8
              }} />
            </ListItemIcon>
            <ListItemText
              primary={safeRenderText(item)}
              primaryTypographyProps={{
                variant: 'body2',
                fontSize: '0.85rem',
                color: ANALYSIS_CARD_STYLES.colors.text.primary,
                fontWeight: 500
              }}
            />
          </ListItem>
        ))}
      </List>

      {/* Tip */}
      <Box sx={{
        p: 1.5,
        mb: 2,
        borderRadius: 2,
        background: `linear-gradient(135deg, rgba(102, 126, 234, 0.12) 0%, rgba(118, 75, 162, 0.12) 100%)`,
        border: `1px solid rgba(102, 126, 234, 0.25)`
      }}>
        <Typography variant="body2" sx={{
          color: ANALYSIS_CARD_STYLES.colors.primary,
          fontWeight: 600,
          fontSize: '0.8rem',
          lineHeight: 1.5
        }}>
          💡 Tip: Review all the insights and data, then confirm to mark this component as reviewed.
        </Typography>
      </Box>

      {/* Optional notes */}
      <Typography variant="body2" sx={{
        color: ANALYSIS_CARD_STYLES.colors.text.primary,
        mb: 1,
        fontWeight: 600
      }}>
        Optional Notes (for your reference):
      </Typography>
      <TextField
        fullWidth
        multiline
        rows={3}
        variant="outlined"
        placeholder="Add any notes or observations about this strategy component..."
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        sx={{
          '& .MuiOutlinedInput-root': {
            fontSize: '0.85rem',
            borderRadius: 2,
            color: ANALYSIS_CARD_STYLES.colors.text.primary,
            backgroundColor: 'rgba(0, 0, 0, 0.25)',
            '& fieldset': {
              borderColor: ANALYSIS_CARD_STYLES.colors.border.secondary
            },
            '&:hover fieldset': {
              borderColor: ANALYSIS_CARD_STYLES.colors.primary,
              borderWidth: '2px'
            },
            '&.Mui-focused fieldset': {
              borderColor: ANALYSIS_CARD_STYLES.colors.primary,
              borderWidth: '2px'
            }
          }
        }}
      />

      {/* Actions */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 2 }}>
        <Button
          onClick={handleCancel}
          disabled={isConfirming}
          startIcon={<CloseIcon />}
          sx={{
            color: ANALYSIS_CARD_STYLES.colors.text.secondary,
            fontWeight: 600,
            fontSize: '0.85rem',
            px: 2,
            py: 0.75,
            borderRadius: 2,
            textTransform: 'none',
            '&:hover': {
              background: 'rgba(255, 255, 255, 0.08)'
            }
          }}
        >
          Cancel
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={isConfirming}
          variant="contained"
          startIcon={isConfirming ? <CircularProgress size={18} /> : <CheckCircleIcon />}
          sx={{
            background: `linear-gradient(135deg, ${ANALYSIS_CARD_STYLES.colors.success} 0%, ${ANALYSIS_CARD_STYLES.colors.success}80 100%)`,
            fontWeight: 700,
            fontSize: '0.85rem',
            px: 2.5,
            py: 0.75,
            borderRadius: 2,
            boxShadow: `0 4px 12px ${ANALYSIS_CARD_STYLES.colors.success}40`,
            textTransform: 'none',
            '&:hover': {
              background: `linear-gradient(135deg, ${ANALYSIS_CARD_STYLES.colors.success}80 0%, ${ANALYSIS_CARD_STYLES.colors.success} 100%)`,
              boxShadow: `0 6px 16px ${ANALYSIS_CARD_STYLES.colors.success}50`,
              transform: 'translateY(-1px)'
            },
            '&:active': {
              transform: 'translateY(0)'
            }
          }}
        >
          {isConfirming ? 'Confirming...' : 'Mark as Reviewed'}
        </Button>
      </Box>
    </Box>
  );
};

export default ReviewConfirmationPanel;