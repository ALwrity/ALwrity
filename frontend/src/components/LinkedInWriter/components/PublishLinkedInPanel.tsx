import React, { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Popover,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Image as ImageIcon,
  LinkedIn as LinkedInIcon,
} from '@mui/icons-material';
import { useLinkedInSocialConnection } from '../../../hooks/useLinkedInSocialConnection';
import {
  getLinkedInSocialErrorMessage,
  publishLinkedInPost,
} from '../../../api/linkedinSocial';
import { formatDraftForPublish } from '../utils/linkedInPublishFormatters';
import { LINKEDIN_PUBLISH_MEDIA_ENABLED } from '../utils/linkedInPublishMediaConstants';
import { useLinkedInPublishMedia } from '../hooks/useLinkedInPublishMedia';
import { LinkedInPublishMediaSection } from './LinkedInPublishMediaSection';

interface PublishLinkedInPanelProps {
  draft: string;
  topic?: string;
  compact?: boolean;
}

const PublishLinkedInPanel: React.FC<PublishLinkedInPanelProps> = ({
  draft,
  topic,
  compact = false,
}) => {
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
  const [mediaAnchor, setMediaAnchor] = useState<HTMLElement | null>(null);

  const publishMedia = useLinkedInPublishMedia({ draft, autoDetectFromDraft: LINKEDIN_PUBLISH_MEDIA_ENABLED });

  const publishContent = formatDraftForPublish(draft);
  const trimmedDraft = publishContent.trim();
  const isOrgTarget = selectedTarget === 'organization';
  const canPublish =
    connected && !!trimmedDraft && !isOrgTarget && !isPublishing && !isLoading;

  const connectionLabel = connected
    ? `Connected via ${provider}`
    : 'Not connected — connect LinkedIn to publish';

  const publishLabel = publishMedia.hasAttachment && LINKEDIN_PUBLISH_MEDIA_ENABLED
    ? 'Publish text + image'
    : 'Publish';

  const handlePublish = async () => {
    if (!canPublish) return;

    setIsPublishing(true);
    publishMedia.beginPublishing();
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      // Phase 1: text-only publish. Phase 3 will pass image_ids / multipart file.
      const result = await publishLinkedInPost({
        content: publishContent,
        account_id: selectedAccountId || undefined,
      });

      const suffix = publishMedia.hasAttachment && LINKEDIN_PUBLISH_MEDIA_ENABLED
        ? ' (text published; image attachment ships in Phase 3)'
        : '';
      setSuccessMessage((result.message || 'Published to LinkedIn.') + suffix);
    } catch (err) {
      console.error('[LinkedInPublish] publish failed:', err);
      setErrorMessage(getLinkedInSocialErrorMessage(err));
    } finally {
      setIsPublishing(false);
      publishMedia.endPublishing();
    }
  };

  const mediaControls = LINKEDIN_PUBLISH_MEDIA_ENABLED ? (
    <>
      <Tooltip title={publishMedia.hasAttachment ? 'Image attached' : 'Add post image'}>
        <IconButton
          size="small"
          onClick={(event) => setMediaAnchor(event.currentTarget)}
          sx={{
            color: publishMedia.hasAttachment ? '#0A66C2' : '#64748b',
            border: '1px solid #e2e8f0',
          }}
        >
          <ImageIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      {publishMedia.hasAttachment && (
        <Chip
          size="small"
          label="1 image"
          sx={{ height: 24, fontSize: 11, bgcolor: '#e8f4fd', color: '#0A66C2' }}
        />
      )}
      <Popover
        open={Boolean(mediaAnchor)}
        anchorEl={mediaAnchor}
        onClose={() => setMediaAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: { p: 2, width: 360, maxWidth: '92vw' },
          },
        }}
      >
        <LinkedInPublishMediaSection
          draft={draft}
          topic={topic}
          compact
          media={publishMedia}
        />
      </Popover>
    </>
  ) : null;

  if (compact) {
    return (
      <Box display="flex" alignItems="center" gap={1}>
        <Chip
          size="small"
          label={isLoading ? 'Checking...' : connected ? 'Connected' : 'Not connected'}
          color={connected ? 'success' : 'default'}
          variant="outlined"
        />
        {mediaControls}
        <Button
          variant="contained"
          disabled={!canPublish}
          onClick={handlePublish}
          startIcon={isPublishing ? <CircularProgress size={16} color="inherit" /> : <LinkedInIcon />}
          sx={{ bgcolor: '#0A66C2', '&:hover': { bgcolor: '#004182' }, textTransform: 'none', fontSize: 13, fontWeight: 600 }}
        >
          {isPublishing ? 'Publishing...' : publishLabel}
        </Button>
        {successMessage && (
          <Typography variant="caption" sx={{ color: '#059669', maxWidth: 200 }}>
            {successMessage}
          </Typography>
        )}
        {errorMessage && (
          <Typography variant="caption" sx={{ color: '#dc2626', maxWidth: 200 }}>
            {errorMessage}
          </Typography>
        )}
      </Box>
    );
  }

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
        Publish your draft text to your LinkedIn personal profile
        {LINKEDIN_PUBLISH_MEDIA_ENABLED ? ' with optional image attachment' : ''}.
      </Typography>

      {LINKEDIN_PUBLISH_MEDIA_ENABLED && (
        <LinkedInPublishMediaSection draft={draft} topic={topic} media={publishMedia} />
      )}

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
        {isPublishing ? 'Publishing...' : publishLabel}
      </Button>
    </Box>
  );
};

export default PublishLinkedInPanel;
