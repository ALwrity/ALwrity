/**
 * LinkedInConnectStep — Onboarding Step 0 for LinkedIn onboarding type.
 *
 * Replaces WebsiteStep for users whose OnboardingSession.onboarding_type
 * is "linkedin". The user connects their LinkedIn account, then the
 * backend strategy runs the 7-phase profile pipeline + post sync +
 * writing-style analysis when the step is completed.
 *
 * Follows the standard step prop contract used by WebsiteStep.
 */

import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Typography,
  CircularProgress,
  Avatar,
  Chip,
  Card,
  CardContent,
  Divider,
} from '@mui/material';
import {
  LinkedIn as LinkedInIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import { useLinkedInSocialConnection } from '../../hooks/useLinkedInSocialConnection';

interface LinkedInConnectStepProps {
  onContinue: (stepData?: any) => void;
  updateHeaderContent: (content: { title: string; description: string }) => void;
  onValidationChange?: (isValid: boolean) => void;
  onDataReady?: (getData: () => any) => void;
}

const LinkedInConnectStep: React.FC<LinkedInConnectStepProps> = ({
  onContinue,
  updateHeaderContent,
  onValidationChange,
  onDataReady,
}) => {
  const {
    connected,
    isLoading,
    isConnecting,
    connectError,
    displayName,
    avatarUrl,
    primaryProfile,
    connectWithOAuth,
  } = useLinkedInSocialConnection();

  const [connectTriggered, setConnectTriggered] = useState(false);

  // ------------------------------------------------------------------
  // Set wizard header
  // ------------------------------------------------------------------
  useEffect(() => {
    updateHeaderContent({
      title: 'Connect Your LinkedIn',
      description:
        'Connect your LinkedIn account so ALwrity can analyze your profile, posts, and writing style. This powers your persona and content strategy.',
    });
  }, [updateHeaderContent]);

  // ------------------------------------------------------------------
  // Report validation state to wizard (connected = valid)
  // ------------------------------------------------------------------
  useEffect(() => {
    if (onValidationChange) {
      onValidationChange(connected);
    }
  }, [connected, onValidationChange]);

  // ------------------------------------------------------------------
  // Register a data collector for the wizard's handleNext
  // ------------------------------------------------------------------
  useEffect(() => {
    if (onDataReady) {
      onDataReady(() => ({
        integrations: {
          connectedPlatforms: connected ? ['linkedin'] : [],
          socialPlatforms: { linkedin: connected },
          updatedAt: new Date().toISOString(),
        },
      }));
    }
  }, [onDataReady, connected]);

  // ------------------------------------------------------------------
  // Auto-advance after connection is established (if user triggered it)
  // ------------------------------------------------------------------
  useEffect(() => {
    if (connectTriggered && connected) {
      setConnectTriggered(false);
    }
  }, [connectTriggered, connected]);

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
        <CircularProgress size={40} />
        <Typography variant="body2" sx={{ ml: 2, color: 'text.secondary' }}>
          Checking LinkedIn connection…
        </Typography>
      </Box>
    );
  }

  if (!connected) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, py: 4 }}>
        {/* LinkedIn logo badge */}
        <Box
          sx={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #0077B5 0%, #0A66C2 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(0, 119, 181, 0.3)',
          }}
        >
          <LinkedInIcon sx={{ fontSize: 44, color: '#fff' }} />
        </Box>

        <Box sx={{ textAlign: 'center', maxWidth: 480 }}>
          <Typography variant="h5" fontWeight={700} gutterBottom>
            Connect Your LinkedIn Account
          </Typography>
          <Typography variant="body1" color="text.secondary">
            We'll fetch your profile, recent posts, and engagement metrics to build a
            personalized content persona. Your data stays private to your workspace.
          </Typography>
        </Box>

        {/* Feature list */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, width: '100%', maxWidth: 420 }}>
          {[
            'Profile analysis — headline, experience, skills, completeness scoring',
            'Post history sync — last 50 posts with engagement metrics',
            'Writing style analysis — tone, vocabulary, readability from your posts',
            'Growth engine — trending topics, content gaps, viral patterns',
          ].map((feature, idx) => (
            <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <LinkedInIcon sx={{ fontSize: 18, color: '#0A66C2' }} />
              <Typography variant="body2" color="text.secondary">
                {feature}
              </Typography>
            </Box>
          ))}
        </Box>

        {/* Connect button */}
        <Button
          variant="contained"
          size="large"
          onClick={() => {
            setConnectTriggered(true);
            connectWithOAuth();
          }}
          disabled={isConnecting}
          startIcon={isConnecting ? <CircularProgress size={18} color="inherit" /> : <LinkedInIcon />}
          sx={{
            background: 'linear-gradient(135deg, #0077B5 0%, #0A66C2 100%)',
            px: 4,
            py: 1.5,
            borderRadius: 2,
            textTransform: 'none',
            fontSize: '1rem',
            fontWeight: 600,
            boxShadow: '0 6px 20px rgba(0, 119, 181, 0.3)',
            '&:hover': {
              background: 'linear-gradient(135deg, #0066A0 0%, #005A99 100%)',
              boxShadow: '0 8px 26px rgba(0, 119, 181, 0.4)',
            },
          }}
        >
          {isConnecting ? 'Connecting…' : 'Connect LinkedIn'}
        </Button>

        {/* Error display */}
        {connectError && (
          <Typography variant="body2" color="error" sx={{ textAlign: 'center', maxWidth: 420 }}>
            {connectError}
          </Typography>
        )}

        {connectTriggered && isConnecting && (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
            A popup window opened for you to authorize LinkedIn. Complete the flow there to continue.
          </Typography>
        )}
      </Box>
    );
  }

  // ------------------------------------------------------------------
  // Connected state — show profile card
  // ------------------------------------------------------------------
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, py: 4 }}>
      {/* Success badge */}
      <Chip
        icon={<CheckCircleIcon />}
        label="LinkedIn Connected"
        color="success"
        sx={{ fontSize: '0.9rem', py: 2, px: 1 }}
      />

      {/* Profile card */}
      <Card sx={{ width: '100%', maxWidth: 500, borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Avatar
              src={avatarUrl || undefined}
              sx={{ width: 64, height: 64, bgcolor: '#0A66C2' }}
            >
              {!avatarUrl && displayName?.charAt(0)?.toUpperCase()}
            </Avatar>
            <Box>
              <Typography variant="h6" fontWeight={700}>
                {displayName || 'LinkedIn User'}
              </Typography>
              {primaryProfile?.accountTypeLabel && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {primaryProfile.accountTypeLabel}
                </Typography>
              )}
            </Box>
          </Box>
          <Divider sx={{ my: 2 }} />
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">
                Profile synced
              </Typography>
              <CheckCircleIcon color="success" fontSize="small" />
            </Box>
            <Typography variant="caption" color="text.disabled">
              When you click "Continue", ALwrity will analyze your profile, sync your posts, and
              build a writing style baseline. This may take a few moments.
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default LinkedInConnectStep;