/**
 * Facebook Persona Generation Modal
 * 
 * Prompts user to generate Facebook persona if it doesn't exist.
 * Similar to ResearchPersonaModal but for Facebook-specific persona.
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
import FacebookIcon from '@mui/icons-material/Facebook';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import GroupIcon from '@mui/icons-material/Group';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloseIcon from '@mui/icons-material/Close';

interface FacebookPersonaModalProps {
  open: boolean;
  onClose: () => void;
  onGenerate: () => Promise<void>;
  onCancel: () => void;
}

export const FacebookPersonaModal: React.FC<FacebookPersonaModalProps> = ({
  open,
  onClose,
  onGenerate,
  onCancel
}) => {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    
    try {
      await onGenerate();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate Facebook persona');
    } finally {
      setGenerating(false);
    }
  };

  const handleCancel = () => {
    onCancel();
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={!generating ? onClose : undefined}
      maxWidth="md"
      fullWidth
      disableEscapeKeyDown={generating}
      PaperProps={{
        sx: {
          borderRadius: 3,
          background: 'linear-gradient(135deg, #fff 0%, #f8fafc 100%)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        }
      }}
    >
      <DialogTitle sx={{ textAlign: 'center', pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
          <FacebookIcon sx={{ fontSize: 32, color: '#1877F2' }} />
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            Generate Facebook Persona
          </Typography>
        </Box>
      </DialogTitle>
      
      <DialogContent sx={{ px: 4, py: 2 }}>
        <Typography variant="body1" sx={{ mb: 3, textAlign: 'center', color: 'text.secondary' }}>
          Enhance your Facebook content with AI-powered personalization based on your brand voice and Facebook's algorithm.
        </Typography>

        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
            Why generate a Facebook persona?
          </Typography>
          <Typography variant="caption">
            Your Facebook persona learns from your onboarding data to provide personalized content that matches 
            your brand voice and optimizes for Facebook's engagement algorithm.
          </Typography>
        </Alert>

        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5 }}>
            Benefits:
          </Typography>
          <List dense sx={{ py: 0 }}>
            <ListItem sx={{ px: 0, py: 0.5 }}>
              <ListItemIcon sx={{ minWidth: 36 }}>
                <AutoAwesomeIcon fontSize="small" color="primary" />
              </ListItemIcon>
              <ListItemText 
                primary="Algorithm Optimization"
                secondary="Content optimized for Facebook's engagement algorithm and reach"
              />
            </ListItem>
            <ListItem sx={{ px: 0, py: 0.5 }}>
              <ListItemIcon sx={{ minWidth: 36 }}>
                <TrendingUpIcon fontSize="small" color="primary" />
              </ListItemIcon>
              <ListItemText 
                primary="Platform-Specific Strategies"
                secondary="Facebook-specific engagement, timing, and community building strategies"
              />
            </ListItem>
            <ListItem sx={{ px: 0, py: 0.5 }}>
              <ListItemIcon sx={{ minWidth: 36 }}>
                <GroupIcon fontSize="small" color="primary" />
              </ListItemIcon>
              <ListItemText 
                primary="Community Building"
                secondary="Strategies for building and engaging your Facebook community"
              />
            </ListItem>
            <ListItem sx={{ px: 0, py: 0.5 }}>
              <ListItemIcon sx={{ minWidth: 36 }}>
                <CheckCircleIcon fontSize="small" color="primary" />
              </ListItemIcon>
              <ListItemText 
                primary="Brand Voice Alignment"
                secondary="Content that matches your brand voice and Facebook's best practices"
              />
            </ListItem>
          </List>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Typography variant="caption" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
          Note: This process takes about 30-60 seconds and uses your AI provider. 
          You can continue using generic persona if you skip this step.
        </Typography>
      </DialogContent>
      
      <DialogActions sx={{ px: 4, pb: 3, justifyContent: 'space-between' }}>
        <Button
          onClick={handleCancel}
          disabled={generating}
          startIcon={<CloseIcon />}
          color="inherit"
        >
          Skip for Now
        </Button>
        <Button
          onClick={handleGenerate}
          disabled={generating}
          variant="contained"
          startIcon={generating ? <CircularProgress size={16} /> : <FacebookIcon />}
          sx={{ minWidth: 150, bgcolor: '#1877F2', '&:hover': { bgcolor: '#1565C0' } }}
        >
          {generating ? 'Generating...' : 'Generate Persona'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

