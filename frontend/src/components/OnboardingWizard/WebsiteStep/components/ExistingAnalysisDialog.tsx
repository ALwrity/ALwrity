import React from 'react';
import {
  Box,
  Button,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText
} from '@mui/material';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import HistoryIcon from '@mui/icons-material/History';

interface ExistingAnalysis {
  exists: boolean;
  analysis_date?: string;
  analysis_id?: number;
  summary?: {
    writing_style?: any;
    target_audience?: any;
    content_type?: any;
  };
  error?: string;
}

interface ExistingAnalysisDialogProps {
  open: boolean;
  onClose: () => void;
  existingAnalysis: ExistingAnalysis | null;
  handleLoadExistingConfirm: () => void;
  handleNewAnalysis: () => void;
}

const ExistingAnalysisDialog: React.FC<ExistingAnalysisDialogProps> = ({
  open,
  onClose,
  existingAnalysis,
  handleLoadExistingConfirm,
  handleNewAnalysis
}) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: '#EFF6FF',
          border: '1px solid #CBD5E1',
        }
      }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <HistoryIcon sx={{ color: '#2563EB' }} />
          <Typography sx={{ color: '#1E293B', fontWeight: 600 }}>Previous Analysis Found</Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ color: '#475569' }}>
          We found a previous analysis for this website from{' '}
          {existingAnalysis?.analysis_date ? 
            new Date(existingAnalysis.analysis_date).toLocaleDateString() : 
            'a previous session'
          }.
        </DialogContentText>
        <DialogContentText sx={{ mt: 2, color: '#475569' }}>
          Would you like to load the previous analysis or perform a new one?
        </DialogContentText>
        {existingAnalysis?.summary && (
          <Box sx={{ mt: 2, p: 2, bgcolor: '#EFF6FF', borderRadius: 1, border: '1px solid #BFDBFE' }}>
            <Typography variant="subtitle2" gutterBottom sx={{ color: '#1E40AF' }}>
              Previous Analysis Summary:
            </Typography>
            {existingAnalysis.summary.writing_style?.tone && (
              <Typography variant="body2" sx={{ color: '#1E293B' }}>
                Tone: {existingAnalysis.summary.writing_style.tone}
              </Typography>
            )}
            {existingAnalysis.summary.target_audience?.expertise_level && (
              <Typography variant="body2" sx={{ color: '#1E293B' }}>
                Target Audience: {existingAnalysis.summary.target_audience.expertise_level}
              </Typography>
            )}
            {existingAnalysis.summary.content_type?.primary_type && (
              <Typography variant="body2" sx={{ color: '#1E293B' }}>
                Content Type: {existingAnalysis.summary.content_type.primary_type}
              </Typography>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ color: '#64748B' }}>
          Cancel
        </Button>
        <Button onClick={handleLoadExistingConfirm} variant="outlined" startIcon={<HistoryIcon />}
          sx={{ borderColor: '#BFDBFE', color: '#2563EB', '&:hover': { borderColor: '#3B82F6', backgroundColor: '#EFF6FF' } }}>
          Load Previous
        </Button>
        <Button onClick={handleNewAnalysis} variant="contained" startIcon={<AnalyticsIcon />}
          sx={{ background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)', boxShadow: '0 4px 14px rgba(37, 99, 235, 0.3)', '&:hover': { background: 'linear-gradient(135deg, #1D4ED8 0%, #1E40AF 100%)', boxShadow: '0 6px 20px rgba(37, 99, 235, 0.4)' } }}>
          New Analysis
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ExistingAnalysisDialog;
