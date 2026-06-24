import React, { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Typography,
} from '@mui/material';
import { LinkedIn as LinkedInIcon } from '@mui/icons-material';
import { useLinkedInSocialConnection } from '../../../hooks/useLinkedInSocialConnection';
import {
  getLinkedInSocialErrorMessage,
  publishLinkedInPost,
} from '../../../api/linkedinSocial';

interface PublishLinkedInPanelProps {
  draft: string;
}

const PublishLinkedInPanel: React.FC<PublishLinkedInPanelProps> = ({ draft }) => {
  const {
    connected,
    provider,
    selectedAccountId,
    selectedTarget,
    isLoading,
  } = useLinkedInSocialConnection();

  const [isPublishing, setIsPublishing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const trimmedDraft = draft.trim();
  const isOrgTarget = selectedTarget === 'organization';
  const canPublish =
    connected && !!trimmedDraft && !isOrgTarget && !isPublishing && !isLoading;

  const connectionLabel = connected
    ? `Connected via ${provider}`
    : 'Not connected — connect LinkedIn to publish';

  const handlePublish = async () => {
    if (!canPublish) return;

    setIsPublishing(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const result = await publishLinkedInPost({
        content: trimmedDraft,
        account_id: selectedAccountId || undefined,
      });
      setSuccessMessage(result.message || 'Published to LinkedIn.');
    } catch (err) {
      console.error('[LinkedInPublish] publish failed:', err);
      setErrorMessage(getLinkedInSocialErrorMessage(err));
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <Box
      sx={{
        mx: 3,
        mb: 2,
        p: 2,
        border: '1px solid #e2e8f0',
        borderRadius: 2,
        bgcolor: '#f8fafc',
      }}
    >
      <Box display="flex" alignItems="center" gap={1} mb={1.5}>
        <LinkedInIcon sx={{ color: '#0A66C2', fontSize: 20 }} />
        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#1e293b' }}>
          Publish to LinkedIn
        </Typography>
        <Chip
          size="small"
          label={isLoading ? 'Checking...' : connected ? 'Connected' : 'Not connected'}
          color={connected ? 'success' : 'default'}
          variant="outlined"
        />
      </Box>

      <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mb: 1.5 }}>
        {connectionLabel}
        {connected && selectedAccountId && (
          <>
            {' '}
            · Post as {selectedTarget === 'organization' ? 'company page' : 'profile'}
          </>
        )}
      </Typography>

      <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mb: 1.5 }}>
        Publishes your full draft text to your LinkedIn personal profile. First comment and
        media support coming soon.
      </Typography>

      {isOrgTarget && (
        <Alert severity="info" sx={{ mb: 1.5 }}>
          Switch to personal profile to publish. Company page posting is not available yet.
        </Alert>
      )}

      {successMessage && (
        <Alert severity="success" sx={{ mb: 1.5 }}>
          {successMessage}
        </Alert>
      )}

      {errorMessage && (
        <Alert severity="error" sx={{ mb: 1.5 }}>
          {errorMessage}
        </Alert>
      )}

      <Button
        variant="contained"
        disabled={!canPublish}
        onClick={handlePublish}
        startIcon={isPublishing ? <CircularProgress size={16} color="inherit" /> : undefined}
        sx={{ bgcolor: '#0A66C2', '&:hover': { bgcolor: '#004182' } }}
      >
        {isPublishing ? 'Publishing...' : 'Publish to LinkedIn'}
      </Button>
    </Box>
  );
};

export default PublishLinkedInPanel;
