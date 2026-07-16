import React, { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Link,
  Popover,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Image as ImageIcon,
  LinkedIn as LinkedInIcon,
  Visibility as PreviewIcon,
} from '@mui/icons-material';
import { useLinkedInSocialConnection } from '../../../hooks/useLinkedInSocialConnection';
import { getLinkedInPublishErrorMessage } from '../../../api/linkedinSocial';
import { useLinkedInPublishMedia } from '../hooks/useLinkedInPublishMedia';
import { LinkedInPublishMediaSection } from './LinkedInPublishMediaSection';
import { LinkedInPublishPreviewPlain } from './LinkedInPublishPreviewPlain';
import {
  buildLinkedInPublishSuccessMessage,
  getLinkedInPublishButtonLabel,
  publishLinkedInWithMedia,
} from '../utils/linkedInPublishHandler';
import {
  getLastDraftImageForPublish,
  resolvePublishMediaAttachment,
} from '../utils/linkedInPublishMediaUtils';
import {
  assertHardPublishLimits,
  formatCharCountLabel,
  getCharReadiness,
  getPublishPlainText,
  getSeeMoreCaption,
} from '../utils/linkedInPublishReadiness';

interface PublishLinkedInPanelProps {
  draft: string;
  topic?: string;
  compact?: boolean;
  /** Flush assistive editor pending edits and return latest draft before publish. */
  getDraftForPublish?: () => string;
}

interface PublishSuccessState {
  message: string;
  shareUrl?: string | null;
  hasMedia?: boolean;
}

const PublishLinkedInPanel: React.FC<PublishLinkedInPanelProps> = ({
  draft,
  topic,
  compact = false,
  getDraftForPublish,
}) => {
  const {
    connected,
    provider,
    selectedAccountId,
    selectedTarget,
    isLoading,
  } = useLinkedInSocialConnection();

  const [isPublishing, setIsPublishing] = useState(false);
  const [successState, setSuccessState] = useState<PublishSuccessState | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [mediaAnchor, setMediaAnchor] = useState<HTMLElement | null>(null);
  const [previewAnchor, setPreviewAnchor] = useState<HTMLElement | null>(null);

  const publishMedia = useLinkedInPublishMedia({ draft, autoDetectFromDraft: true });

  const publishContent = getPublishPlainText(draft);
  const chars = getCharReadiness(publishContent);
  const seeMoreCaption = getSeeMoreCaption(chars);
  const draftHasImage = Boolean(getLastDraftImageForPublish(draft));
  const hasPublishMedia = publishMedia.hasAttachment || draftHasImage;
  const previewAttachment = resolvePublishMediaAttachment(draft, publishMedia.attachment);
  const isOrgTarget = selectedTarget === 'organization';
  const canPublish =
    connected &&
    chars.hardOk &&
    !isOrgTarget &&
    !isPublishing &&
    !isLoading;

  const connectionLabel = connected
    ? `Connected via ${provider}`
    : 'Not connected — connect LinkedIn to publish';

  const publishLabel = getLinkedInPublishButtonLabel(
    hasPublishMedia,
    isPublishing,
  );

  const handlePublish = async () => {
    if (!canPublish) return;

    const draftForPublish = getDraftForPublish?.() ?? draft;
    const contentForPublish = getPublishPlainText(draftForPublish);
    const hardCheck = assertHardPublishLimits(contentForPublish);
    if (!hardCheck.ok) {
      setErrorMessage(hardCheck.error || 'Cannot publish this post.');
      setSuccessState(null);
      return;
    }

    setIsPublishing(true);
    publishMedia.beginPublishing();
    setSuccessState(null);
    setErrorMessage(null);

    try {
      const result = await publishLinkedInWithMedia({
        content: contentForPublish,
        accountId: selectedAccountId || undefined,
        draft: draftForPublish,
        attachment: publishMedia.attachment,
      });

      setSuccessState({
        message: buildLinkedInPublishSuccessMessage(result),
        shareUrl: result.share_url,
        hasMedia: result.has_media,
      });
    } catch (err) {
      console.error('[LinkedInPublish] publish failed:', err);
      setErrorMessage(getLinkedInPublishErrorMessage(err));
    } finally {
      setIsPublishing(false);
      publishMedia.endPublishing();
    }
  };

  const successDetails = successState ? (
    <Box>
      <Typography variant="caption" sx={{ color: '#059669', display: 'block' }}>
        {successState.message}
      </Typography>
      {successState.hasMedia && (
        <Typography variant="caption" sx={{ color: '#059669', display: 'block' }}>
          Published with image
        </Typography>
      )}
      {successState.shareUrl && (
        <Link
          href={successState.shareUrl}
          target="_blank"
          rel="noopener noreferrer"
          variant="caption"
          sx={{ display: 'block', mt: 0.5 }}
        >
          View on LinkedIn
        </Link>
      )}
    </Box>
  ) : null;

  const charCaption = (
    <Typography
      variant="caption"
      sx={{
        color: chars.hardOk ? '#64748b' : '#dc2626',
        display: 'block',
        whiteSpace: 'nowrap',
      }}
    >
      {formatCharCountLabel(chars.count)}
      {seeMoreCaption ? ' · see more' : ''}
    </Typography>
  );

  const mediaControls = (
    <>
      <Tooltip title={hasPublishMedia ? 'Image attached' : 'Add post image'}>
        <IconButton
          size="small"
          onClick={(event) => setMediaAnchor(event.currentTarget)}
          sx={{
            color: hasPublishMedia ? '#0A66C2' : '#64748b',
            border: '1px solid #e2e8f0',
          }}
        >
          <ImageIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      {hasPublishMedia ? (
        <Chip
          size="small"
          label="1 image"
          sx={{ height: 24, fontSize: 11, bgcolor: '#e8f4fd', color: '#0A66C2' }}
        />
      ) : null}
      <Tooltip title="Preview what LinkedIn will see">
        <IconButton
          size="small"
          onClick={(event) => setPreviewAnchor(event.currentTarget)}
          sx={{ color: '#64748b', border: '1px solid #e2e8f0' }}
        >
          <PreviewIcon fontSize="small" />
        </IconButton>
      </Tooltip>
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
      <Popover
        open={Boolean(previewAnchor)}
        anchorEl={previewAnchor}
        onClose={() => setPreviewAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: { p: 1.5, width: 380, maxWidth: '94vw' },
          },
        }}
      >
        <LinkedInPublishPreviewPlain
          draft={draft}
          attachment={previewAttachment}
          compact
        />
      </Popover>
    </>
  );

  if (compact) {
    return (
      <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
        <Chip
          size="small"
          label={isLoading ? 'Checking...' : connected ? 'Connected' : 'Not connected'}
          color={connected ? 'success' : 'default'}
          variant="outlined"
        />
        {mediaControls}
        {charCaption}
        <Button
          variant="contained"
          disabled={!canPublish}
          onClick={handlePublish}
          startIcon={isPublishing ? <CircularProgress size={16} color="inherit" /> : <LinkedInIcon />}
          sx={{ bgcolor: '#0A66C2', '&:hover': { bgcolor: '#004182' }, textTransform: 'none', fontSize: 13, fontWeight: 600 }}
        >
          {publishLabel}
        </Button>
        {successDetails}
        {errorMessage && (
          <Typography variant="caption" sx={{ color: '#dc2626', maxWidth: 220 }}>
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
        Publish your draft text to your LinkedIn personal profile with optional image attachment.
      </Typography>

      <LinkedInPublishMediaSection draft={draft} topic={topic} media={publishMedia} />

      <Box sx={{ mb: 1.5 }}>
        <LinkedInPublishPreviewPlain
          draft={draft}
          attachment={previewAttachment}
        />
      </Box>

      <Box sx={{ mb: 1.5 }}>
        <Typography variant="caption" sx={{ color: chars.hardOk ? '#64748b' : '#dc2626' }}>
          {formatCharCountLabel(chars.count)}
        </Typography>
        {seeMoreCaption && (
          <Alert severity="warning" sx={{ mt: 1, py: 0, fontSize: 12 }}>
            {seeMoreCaption}
          </Alert>
        )}
      </Box>

      {isOrgTarget && (
        <Alert severity="info" sx={{ mb: 1.5 }}>
          Switch to personal profile to publish. Company page posting is not available yet.
        </Alert>
      )}

      {successState && (
        <Alert severity="success" sx={{ mb: 1.5 }}>
          {successState.message}
          {successState.hasMedia && (
            <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
              Published with image
            </Typography>
          )}
          {successState.shareUrl && (
            <Link
              href={successState.shareUrl}
              target="_blank"
              rel="noopener noreferrer"
              variant="caption"
              sx={{ display: 'block', mt: 0.5 }}
            >
              View on LinkedIn
            </Link>
          )}
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
        {publishLabel}
      </Button>
    </Box>
  );
};

export default PublishLinkedInPanel;
