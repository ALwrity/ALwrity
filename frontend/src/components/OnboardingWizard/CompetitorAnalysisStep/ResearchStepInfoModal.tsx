import React from 'react';
import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';
import { OnboardingDialogCloseButton } from '../common/OnboardingDialogCloseButton';
import { lightTheme } from './competitorStepUiHelpers';
import { ResearchStepInfoPanel } from './ResearchStepInfoPanel';
import {
  RESEARCH_INFO_PANEL_TITLE,
  RESEARCH_SECTION_HEADING_COLOR,
} from './researchStepInfoConstants';

export {
  RESEARCH_INFO_MODAL_TITLE,
  RESEARCH_INFO_PANEL_TITLE,
  RESEARCH_SECTION_HEADING_COLOR,
} from './researchStepInfoConstants';

const INFO_MODAL_CONTENT_MIN_HEIGHT = 240;

export interface ResearchStepInfoModalProps {
  open: boolean;
  onClose: () => void;
}

export const ResearchStepInfoModal: React.FC<ResearchStepInfoModalProps> = ({ open, onClose }) => (
  <Dialog
    open={open}
    onClose={onClose}
    maxWidth="md"
    fullWidth
    PaperProps={{
      sx: {
        borderRadius: 3,
        bgcolor: '#ffffff',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        minHeight: `${INFO_MODAL_CONTENT_MIN_HEIGHT * 1.3}px`,
      },
    }}
  >
    <DialogTitle
      sx={{
        position: 'relative',
        textAlign: 'center',
        px: 6,
        py: 2,
        bgcolor: '#f8fafc',
        borderBottom: `1px solid ${lightTheme.border}`,
      }}
    >
      <Typography
        variant="h6"
        component="span"
        fontWeight={700}
        sx={{ color: RESEARCH_SECTION_HEADING_COLOR, display: 'block', textAlign: 'center' }}
      >
        {RESEARCH_INFO_PANEL_TITLE}
      </Typography>
      <Box sx={{ position: 'absolute', right: 12, top: 12 }}>
        <OnboardingDialogCloseButton onClick={onClose} />
      </Box>
    </DialogTitle>
    <DialogContent
      sx={{
        pt: 3.25,
        pb: 3.9,
        minHeight: `${INFO_MODAL_CONTENT_MIN_HEIGHT * 1.3}px`,
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <Box sx={{ width: '100%', '& [data-testid="research-step-info-panel"]': { mb: 0, boxShadow: 'none', border: 'none', p: 0 } }}>
        <ResearchStepInfoPanel showTitle={false} />
      </Box>
    </DialogContent>
  </Dialog>
);

export default ResearchStepInfoModal;
