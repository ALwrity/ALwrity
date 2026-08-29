/**
 * Research Persona Generation Modal
 * 
 * Prompts user to generate research persona if it doesn't exist.
 * Explains benefits and allows user to generate or skip.
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Alert,
  CircularProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import PsychologyIcon from '@mui/icons-material/Psychology';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import SearchIcon from '@mui/icons-material/Search';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloseIcon from '@mui/icons-material/Close';
import { refreshResearchPersona } from '../../api/researchConfig';
import { triggerSubscriptionError } from '../../api/client';

interface ResearchPersonaModalProps {
  open: boolean;
  onClose: () => void;
  onGenerate: () => Promise<void>;
  onCancel: () => void;
}

export const ResearchPersonaModal: React.FC<ResearchPersonaModalProps> = ({
  open,
  onClose,
  onGenerate,
  onCancel
}) => {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Debug: Track modal open state
  React.useEffect(() => {
    console.log('[ResearchPersonaModal] Modal open state:', open);
    if (open) {
      console.log('[ResearchPersonaModal] ✅ Modal is now OPEN');
    } else {
      console.log('[ResearchPersonaModal] Modal is CLOSED');
    }
  }, [open]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    
    try {
      await onGenerate();
      // Close modal on success
      onClose();
    } catch (err: any) {
      // Check if this is a subscription error (429/402)
      // The apiClient interceptor should have already handled it via the global handler
      // We just need to check if the global handler suppressed it (subscription is active)
      const status = err?.response?.status;
      if (status === 429 || status === 402) {
        console.log('[ResearchPersonaModal] Detected subscription error', {
          status,
          data: err?.response?.data
        });
        
        // The global handler in apiClient interceptor should have already processed this
        // If subscription is active, the global handler suppresses the modal
        // If subscription is inactive, the global handler shows the modal
        // We just need to avoid showing a duplicate error message
        // Wait a moment to see if the global handler shows the modal
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // If the global handler showed the modal, it will handle it
        // We just stop here and don't show a local error
        setGenerating(false);
        return;
      }
      
      // For non-subscription errors, show local error message
      setError(err instanceof Error ? err.message : 'Failed to generate research persona');
    } finally {
      setGenerating(false);
    }
  };

  const handleCancel = () => {
    onCancel();
    onClose();
  };

  const handleClose = () => {
    if (!generating) {
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      disableEscapeKeyDown={generating}
      PaperProps={{
        sx: {
          borderRadius: 3,
          background: 'linear-gradient(135deg, #fff 0%, #f8fafc 100%)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          // Force dark text colors for readability on light background
          color: '#1e293b',
          '& *': {
            color: 'inherit',
          },
        }
      }}
    >
      <DialogTitle sx={{ textAlign: 'center', pb: 1, color: '#0f172a' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
          <PsychologyIcon sx={{ fontSize: 32, color: 'primary.main' }} />
          <Typography variant="h5" sx={{ fontWeight: 600, color: '#0f172a' }}>
            Generate Research Persona
          </Typography>
        </Box>
      </DialogTitle>
      
      <DialogContent sx={{ px: 4, py: 2, color: '#1e293b' }}>
        <Typography variant="body1" sx={{ mb: 3, textAlign: 'center', color: '#475569' }}>
          Enhance your research experience with AI-powered personalization based on your business profile and preferences.
        </Typography>

        <Alert 
          severity="info" 
          sx={{ 
            mb: 3, 
            backgroundColor: '#e0f2fe', 
            borderColor: '#7dd3fc',
            '& .MuiAlert-icon': {
              color: '#0284c7',
            },
            '& .MuiAlert-message': {
              color: '#0c4a6e',
            },
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5, color: '#0c4a6e' }}>
            Why generate a research persona?
          </Typography>
          <Typography variant="caption" sx={{ color: '#075985', display: 'block' }}>
            Your research persona learns from your onboarding data to provide personalized research suggestions, 
            keyword expansions, and research angles tailored to your industry and audience.
          </Typography>
        </Alert>

        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5, color: '#0f172a' }}>
            Benefits:
          </Typography>
          <List dense sx={{ py: 0 }}>
            <ListItem sx={{ px: 0, py: 0.5 }}>
              <ListItemIcon sx={{ minWidth: 36 }}>
                <AutoAwesomeIcon fontSize="small" color="primary" />
              </ListItemIcon>
              <ListItemText 
                primary={<Typography sx={{ color: '#1e293b', fontWeight: 500 }}>Smart Keyword Expansion</Typography>}
                secondary={<Typography sx={{ color: '#64748b', fontSize: '0.875rem' }}>Automatically expand your keywords with industry-specific terms</Typography>}
              />
            </ListItem>
            <ListItem sx={{ px: 0, py: 0.5 }}>
              <ListItemIcon sx={{ minWidth: 36 }}>
                <TrendingUpIcon fontSize="small" color="primary" />
              </ListItemIcon>
              <ListItemText 
                primary={<Typography sx={{ color: '#1e293b', fontWeight: 500 }}>Alternative Research Angles</Typography>}
                secondary={<Typography sx={{ color: '#64748b', fontSize: '0.875rem' }}>Discover new research directions based on your business context</Typography>}
              />
            </ListItem>
            <ListItem sx={{ px: 0, py: 0.5 }}>
              <ListItemIcon sx={{ minWidth: 36 }}>
                <SearchIcon fontSize="small" color="primary" />
              </ListItemIcon>
              <ListItemText 
                primary={<Typography sx={{ color: '#1e293b', fontWeight: 500 }}>Personalized Research Presets</Typography>}
                secondary={<Typography sx={{ color: '#64748b', fontSize: '0.875rem' }}>Get recommended research configurations tailored to your needs</Typography>}
              />
            </ListItem>
            <ListItem sx={{ px: 0, py: 0.5 }}>
              <ListItemIcon sx={{ minWidth: 36 }}>
                <CheckCircleIcon fontSize="small" color="primary" />
              </ListItemIcon>
              <ListItemText 
                primary={<Typography sx={{ color: '#1e293b', fontWeight: 500 }}>Better Search Results</Typography>}
                secondary={<Typography sx={{ color: '#64748b', fontSize: '0.875rem' }}>Improved query enhancement and domain suggestions for your industry</Typography>}
              />
            </ListItem>
          </List>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Typography variant="caption" sx={{ color: '#64748b', fontStyle: 'italic' }}>
          Note: This process takes about 30-60 seconds and uses your AI provider. 
          You can continue using rule-based suggestions if you skip this step.
        </Typography>
      </DialogContent>
      
      <DialogActions sx={{ px: 4, pb: 3, justifyContent: 'space-between', gap: 2 }}>
        <Button
          onClick={handleCancel}
          disabled={generating}
          startIcon={<CloseIcon />}
          variant="outlined"
          sx={{ 
            color: '#475569',
            borderColor: '#cbd5e1',
            '&:hover': {
              borderColor: '#94a3b8',
              backgroundColor: 'rgba(148, 163, 184, 0.08)',
            },
            px: 3,
            py: 1.25,
          }}
        >
          Skip for Now
        </Button>
        <Button
          onClick={handleGenerate}
          disabled={generating}
          variant="contained"
          startIcon={generating ? <CircularProgress size={18} sx={{ color: 'white' }} /> : <PsychologyIcon />}
          sx={{ 
            minWidth: 180,
            px: 4,
            py: 1.5,
            fontSize: '1rem',
            fontWeight: 600,
            background: generating 
              ? 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)'
              : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            boxShadow: generating
              ? '0 4px 14px rgba(139, 92, 246, 0.3)'
              : '0 8px 20px rgba(102, 126, 234, 0.4), 0 0 0 1px rgba(102, 126, 234, 0.1) inset',
            '&:hover': {
              background: 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)',
              boxShadow: '0 12px 28px rgba(102, 126, 234, 0.5), 0 0 0 1px rgba(102, 126, 234, 0.2) inset',
              transform: 'translateY(-1px)',
            },
            '&:active': {
              transform: 'translateY(0)',
              boxShadow: '0 4px 14px rgba(102, 126, 234, 0.4)',
            },
            '&:disabled': {
              background: 'linear-gradient(135deg, #cbd5e1 0%, #94a3b8 100%)',
              boxShadow: 'none',
            },
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            position: 'relative',
            overflow: 'hidden',
            '&::before': generating ? {
              content: '""',
              position: 'absolute',
              top: 0,
              left: '-100%',
              width: '100%',
              height: '100%',
              background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent)',
              animation: 'shimmer 2s infinite',
            } : {},
            '@keyframes shimmer': {
              '0%': { left: '-100%' },
              '100%': { left: '100%' },
            },
          }}
        >
          {generating ? 'Generating...' : 'Generate Persona'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

