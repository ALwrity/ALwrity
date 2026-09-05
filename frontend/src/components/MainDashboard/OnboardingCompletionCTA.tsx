import React from 'react';
import {
  Box,
  Alert,
  Typography,
  Button,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';

interface OnboardingCompletionCTAProps {
  hasCompletedOnboarding: boolean;
  hasActiveStrategy: boolean;
  onCreateStrategy: () => void;
  onDismiss: () => void;
}

/**
 * Post-onboarding handoff banner: "your Marketing OS is ready — create your
 * content strategy". Styled as a celebratory gradient hero card consistent
 * with the dashboard's indigo/purple theme. Root stays an MUI <Alert> so it
 * keeps the `alert` role and info-severity semantics.
 */
const OnboardingCompletionCTA: React.FC<OnboardingCompletionCTAProps> = ({
  hasCompletedOnboarding,
  hasActiveStrategy,
  onCreateStrategy,
  onDismiss,
}) => {
  if (!hasCompletedOnboarding || hasActiveStrategy) {
    return null;
  }

  return (
    <Alert
      severity="info"
      icon={false}
      sx={{
        mb: 3,
        p: { xs: 2, md: 2.5 },
        borderRadius: 3,
        border: '1px solid rgba(255,255,255,0.25)',
        background: 'linear-gradient(120deg, #4f46e5 0%, #7c3aed 55%, #a855f7 100%)',
        boxShadow: '0 12px 32px rgba(79, 70, 229, 0.35)',
        color: '#fff',
        '& .MuiAlert-message': { width: '100%', p: 0 },
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 2,
          flexWrap: { xs: 'wrap', md: 'nowrap' },
        }}
      >
        {/* Copy */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.75, minWidth: 0 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 44,
              height: 44,
              borderRadius: '50%',
              bgcolor: 'rgba(255,255,255,0.16)',
              border: '1px solid rgba(255,255,255,0.35)',
              flexShrink: 0,
            }}
          >
            <AutoAwesomeIcon sx={{ color: '#fff', fontSize: 22 }} />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6" sx={{ fontWeight: 800, color: '#fff', letterSpacing: 0.2, lineHeight: 1.25 }}>
              Your Marketing OS is ready!
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5, color: 'rgba(255,255,255,0.85)', maxWidth: 560 }}>
              Your onboarding is complete. Create your first content strategy — we'll pre-fill it from your
              onboarding data and plan your first 30 days of content.
            </Typography>
          </Box>
        </Box>

        {/* Actions */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            flexShrink: 0,
            ml: { md: 2 },
            mt: { xs: 1.5, md: 0 },
          }}
        >
          <Button
            variant="contained"
            size="small"
            onClick={() => {
              onCreateStrategy();
              onDismiss();
            }}
            sx={{
              bgcolor: '#fff',
              color: '#4f46e5',
              fontWeight: 700,
              textTransform: 'none',
              px: 2,
              borderRadius: 2,
              boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
              '&:hover': { bgcolor: '#eef2ff' },
            }}
          >
            Create Content Strategy
          </Button>
          <Button
            variant="text"
            size="small"
            onClick={onDismiss}
            sx={{
              color: 'rgba(255,255,255,0.8)',
              textTransform: 'none',
              '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.08)' },
            }}
          >
            Maybe later
          </Button>
        </Box>
      </Box>
    </Alert>
  );
};

export default OnboardingCompletionCTA;
