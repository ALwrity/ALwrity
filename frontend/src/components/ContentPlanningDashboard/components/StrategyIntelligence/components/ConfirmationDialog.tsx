import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Alert,
  Box
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { ConfirmationDialogProps } from '../types/strategy.types';

const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  open,
  onClose,
  onConfirm
}) => {
  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="sm" 
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          boxShadow: '0 16px 48px rgba(0, 0, 0, 0.2)'
        }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Box sx={{ 
            p: 1, 
            borderRadius: 2, 
            background: 'linear-gradient(135deg, #4caf50 0%, #8bc34a 100%)',
            mr: 1.5,
            boxShadow: '0 4px 12px rgba(76, 175, 80, 0.3)'
          }}>
            <CheckCircleIcon sx={{ color: 'white', fontSize: 20 }} />
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Confirm Strategy
          </Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Typography variant="body1" sx={{ mb: 2, fontWeight: 500 }}>
          Are you sure you want to confirm this strategy? Once confirmed, you'll be able to generate a content calendar based on this strategy.
        </Typography>
        <Alert severity="info" sx={{ 
          mb: 2,
          borderRadius: 2,
          border: '1px solid rgba(33, 150, 243, 0.3)'
        }}>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            <strong>Next Steps:</strong> After confirmation, you can generate a comprehensive content calendar that follows this strategy.
          </Typography>
        </Alert>
      </DialogContent>
      <DialogActions sx={{ p: 3, pt: 0 }}>
        <Button 
          onClick={onClose}
          sx={{ 
            borderRadius: 2,
            px: 3,
            fontWeight: 600
          }}
        >
          Cancel
        </Button>
        <Button 
          onClick={onConfirm} 
          variant="contained" 
          color="success"
          sx={{ 
            borderRadius: 2,
            px: 3,
            fontWeight: 600,
            boxShadow: '0 4px 12px rgba(76, 175, 80, 0.3)',
            '&:hover': {
              boxShadow: '0 6px 16px rgba(76, 175, 80, 0.4)'
            }
          }}
        >
          Confirm Strategy
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConfirmationDialog; 