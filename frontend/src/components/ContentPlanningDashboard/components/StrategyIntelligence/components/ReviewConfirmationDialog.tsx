import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  TextField,
  Chip,
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
import { motion } from 'framer-motion';
import { ANALYSIS_CARD_STYLES } from '../styles';
import { safeRenderText, safeRenderArray, hasValidData, getFallbackValue } from '../utils/defensiveRendering';

interface ReviewConfirmationDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (notes?: string) => void;
  componentId: string;
  componentTitle: string;
  componentSubtitle: string;
  isConfirming?: boolean;
}

const ReviewConfirmationDialog: React.FC<ReviewConfirmationDialogProps> = ({
  open,
  onClose,
  onConfirm,
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

  const handleClose = () => {
    setNotes('');
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(102, 126, 234, 0.3)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15), 0 0 40px rgba(102, 126, 234, 0.1)'
        }
      }}
    >
             <DialogTitle sx={{ 
         pb: 2,
         display: 'flex',
         alignItems: 'center',
         gap: 2,
         background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.08) 0%, rgba(118, 75, 162, 0.08) 100%)',
         borderBottom: '1px solid rgba(102, 126, 234, 0.15)'
       }}>
        <Box sx={{
          p: 1.5,
          borderRadius: 2,
          background: `linear-gradient(135deg, ${ANALYSIS_CARD_STYLES.colors.primary} 0%, ${ANALYSIS_CARD_STYLES.colors.secondary} 100%)`,
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
        }}>
          {getComponentIcon(componentId)}
        </Box>
                 <Box>
           <Typography variant="h5" sx={{ 
             color: '#1a1a1a',
             fontWeight: 700,
             mb: 0.5
           }}>
             Review Strategy Component
           </Typography>
           <Typography variant="body1" sx={{ 
             color: '#666666',
             fontSize: '1rem',
             fontWeight: 500
           }}>
             {componentSubtitle}
           </Typography>
         </Box>
      </DialogTitle>

      <DialogContent sx={{ pt: 3, pb: 2 }}>
                 <Box sx={{ mb: 4 }}>
           <Typography variant="h6" sx={{ 
             color: '#1a1a1a',
             mb: 2,
             fontWeight: 600,
             fontSize: '1.1rem'
           }}>
             You're reviewing <strong style={{ color: ANALYSIS_CARD_STYLES.colors.primary }}>"{componentTitle}"</strong>
           </Typography>
           
           <Typography variant="body1" sx={{ 
             color: '#666666',
             mb: 3,
             fontSize: '1rem',
             fontWeight: 500
           }}>
             This component includes the following analysis:
           </Typography>

          <List dense sx={{ mb: 3 }}>
            {getComponentSummary(componentId).map((item, index) => (
              <ListItem key={index} sx={{ py: 1, px: 0 }}>
                <ListItemIcon sx={{ minWidth: 40 }}>
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
                     variant: 'body1',
                     fontSize: '1rem',
                     color: '#1a1a1a',
                     fontWeight: 500
                   }}
                 />
              </ListItem>
            ))}
          </List>

          <Box sx={{
            p: 2.5,
            borderRadius: 2,
            background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.08) 0%, rgba(118, 75, 162, 0.08) 100%)',
            border: '1px solid rgba(102, 126, 234, 0.2)',
            boxShadow: '0 2px 8px rgba(102, 126, 234, 0.1)'
          }}>
            <Typography variant="body1" sx={{ 
              color: ANALYSIS_CARD_STYLES.colors.primary,
              fontWeight: 600,
              fontSize: '1rem',
              lineHeight: 1.5
            }}>
              💡 Tip: Review all the insights and data, then confirm to mark this component as reviewed.
            </Typography>
          </Box>
        </Box>

                 <Box sx={{ mb: 3 }}>
           <Typography variant="body1" sx={{ 
             color: '#1a1a1a',
             mb: 1.5,
             fontWeight: 600,
             fontSize: '1rem'
           }}>
             Optional Notes (for your reference):
           </Typography>
          <TextField
            fullWidth
            multiline
            rows={4}
            variant="outlined"
            placeholder="Add any notes or observations about this strategy component..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            sx={{
              '& .MuiOutlinedInput-root': {
                fontSize: '1rem',
                borderRadius: 2,
                '&:hover fieldset': {
                  borderColor: ANALYSIS_CARD_STYLES.colors.primary,
                  borderWidth: '2px'
                },
                '&.Mui-focused fieldset': {
                  borderColor: ANALYSIS_CARD_STYLES.colors.primary,
                  borderWidth: '2px'
                }
              },
              '& .MuiInputBase-input': {
                fontSize: '1rem',
                lineHeight: 1.5
              }
            }}
          />
        </Box>
      </DialogContent>

             <DialogActions sx={{ p: 3, pt: 2, background: 'rgba(102, 126, 234, 0.05)', borderTop: '1px solid rgba(102, 126, 234, 0.15)' }}>
         <Button
           onClick={handleClose}
           disabled={isConfirming}
           startIcon={<CloseIcon />}
           sx={{
             color: '#666666',
             fontWeight: 600,
             fontSize: '1rem',
             px: 3,
             py: 1,
             borderRadius: 2,
             '&:hover': {
               background: 'rgba(0, 0, 0, 0.05)',
               transform: 'translateY(-1px)'
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
            fontWeight: 600,
            fontSize: '1rem',
            px: 3,
            py: 1,
            borderRadius: 2,
            boxShadow: '0 4px 12px rgba(76, 175, 80, 0.3)',
            '&:hover': {
              background: `linear-gradient(135deg, ${ANALYSIS_CARD_STYLES.colors.success}80 0%, ${ANALYSIS_CARD_STYLES.colors.success} 100%)`,
              boxShadow: '0 6px 16px rgba(76, 175, 80, 0.4)',
              transform: 'translateY(-1px)'
            },
            '&:active': {
              transform: 'translateY(0)'
            }
          }}
        >
          {isConfirming ? 'Confirming...' : 'Mark as Reviewed'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ReviewConfirmationDialog;
