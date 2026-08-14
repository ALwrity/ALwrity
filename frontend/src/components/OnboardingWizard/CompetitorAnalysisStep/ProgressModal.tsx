import React from 'react';
import {
  Box,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  CircularProgress,
  LinearProgress,
} from '@mui/material';

interface ProgressModalProps {
  open: boolean;
  progress: number;
  step: string;
}

export const ProgressModal: React.FC<ProgressModalProps> = ({ open, progress, step }) => {
  return (
    <Dialog
      open={open}
      onClose={() => {}}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3, p: 3 } }}
    >
      <DialogTitle sx={{ textAlign: 'center', pb: 2 }}>
        <Box display="flex" alignItems="center" justifyContent="center" gap={2}>
          <CircularProgress size={32} color="primary" />
          <Typography variant="h6" component="span" fontWeight={600}>
            Analyzing Your Competition
          </Typography>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ textAlign: 'center', pt: 2 }}>
        <Typography variant="body1" color="text.secondary" mb={3}>
          We're discovering your competitors and analyzing their strategies using AI...
        </Typography>
        <Box mb={3}>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{ height: 8, borderRadius: 4, mb: 2 }}
          />
          <Typography variant="body2" color="text.secondary">
            {progress}% Complete
          </Typography>
        </Box>
        <Typography variant="body2" color="primary" fontWeight={500}>
          {step}
        </Typography>
      </DialogContent>
    </Dialog>
  );
};
