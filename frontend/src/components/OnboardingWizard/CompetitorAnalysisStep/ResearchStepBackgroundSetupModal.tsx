import React from 'react';
import { Box, Dialog, DialogContent, DialogTitle, Typography } from '@mui/material';
import { OnboardingDialogCloseButton } from '../common/OnboardingDialogCloseButton';
import { useResearchStepBackgroundSetup } from './useResearchStepBackgroundSetup';
import { ResearchStepBackgroundSetupContent } from './ResearchStepBackgroundSetupContent';
import { getBackgroundSetupTaskSummary } from './researchStepBackgroundSetupConstants';

interface Props {
  open: boolean;
  onClose: () => void;
}

const ResearchStepBackgroundSetupModal: React.FC<Props> = ({ open, onClose }) => {
  const setup = useResearchStepBackgroundSetup(open);

  if (!open) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: '#ffffff',
          borderRadius: 3,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          maxHeight: '85vh',
        },
      }}
    >
      <DialogTitle
        sx={{
          pb: 1.5,
          backgroundColor: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#1e293b' }}>
            ⚙️ Smart Background Setup
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748b', mt: 0.25 }}>
            {getBackgroundSetupTaskSummary(setup.prefs)}
          </Typography>
        </Box>
        <OnboardingDialogCloseButton onClick={onClose} />
      </DialogTitle>

      <DialogContent sx={{ p: 0, backgroundColor: '#ffffff' }}>
        <ResearchStepBackgroundSetupContent {...setup} />
      </DialogContent>
    </Dialog>
  );
};

export default ResearchStepBackgroundSetupModal;
