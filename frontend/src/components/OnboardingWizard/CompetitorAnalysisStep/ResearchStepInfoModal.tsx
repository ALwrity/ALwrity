import React from 'react';
import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  Grid,
  Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AutoFixHighIcon from '@mui/icons-material/AutoAwesome';
import { OnboardingDialogCloseButton } from '../common/OnboardingDialogCloseButton';
import { lightTheme } from './competitorStepUiHelpers';

/** Matches "Discovered Competitors" section heading color in CompetitorsGrid */
export const RESEARCH_SECTION_HEADING_COLOR = '#1a202c';

export const RESEARCH_INFO_MODAL_TITLE = 'What ALwrity does?';

/** Baseline content min-height before 30% increase */
const INFO_MODAL_CONTENT_MIN_HEIGHT = 240;

export interface ResearchStepInfoModalProps {
  open: boolean;
  onClose: () => void;
}

const pillarLabelSx = {
  fontWeight: 700,
  color: RESEARCH_SECTION_HEADING_COLOR,
};

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
        {RESEARCH_INFO_MODAL_TITLE}
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
      <Grid container spacing={3} sx={{ width: '100%' }}>
        <Grid item xs={12} md={4}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            <Box sx={{ p: 1.5, bgcolor: '#DBEAFE', borderRadius: '50%', mb: 1.5, color: '#2563EB' }}>
              <SearchIcon />
            </Box>
            <Typography variant="subtitle2" sx={pillarLabelSx} gutterBottom>
              What
            </Typography>
            <Typography variant="body2" color="text.secondary">
              We analyze top competitors in your niche.
            </Typography>
          </Box>
        </Grid>
        <Grid item xs={12} md={4}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            <Box sx={{ p: 1.5, bgcolor: '#F3E8FF', borderRadius: '50%', mb: 1.5, color: '#7C3AED' }}>
              <TrendingUpIcon />
            </Box>
            <Typography variant="subtitle2" sx={pillarLabelSx} gutterBottom>
              Why
            </Typography>
            <Typography variant="body2" color="text.secondary">
              To identify content gaps and market positioning.
            </Typography>
          </Box>
        </Grid>
        <Grid item xs={12} md={4}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            <Box sx={{ p: 1.5, bgcolor: '#DCFCE7', borderRadius: '50%', mb: 1.5, color: '#16A34A' }}>
              <AutoFixHighIcon />
            </Box>
            <Typography variant="subtitle2" sx={pillarLabelSx} gutterBottom>
              How
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Using AI to scan their public content and social footprint.
            </Typography>
          </Box>
        </Grid>
      </Grid>
    </DialogContent>
  </Dialog>
);

export default ResearchStepInfoModal;
