import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  TextField,
  Tooltip,
  Typography,
  Chip,
} from '@mui/material';
import { LinkedIn as LinkedInIcon } from '@mui/icons-material';
import { useLinkedInSocialConnection } from '../../../hooks/useLinkedInSocialConnection';
import {
  applyLinkInFirstComment,
  buildPublishPayload,
} from '../utils/firstCommentUtils';

interface PublishLinkedInPanelProps {
  draft: string;
}

const PublishLinkedInPanel: React.FC<PublishLinkedInPanelProps> = ({ draft }) => {
  const {
    connected,
    provider,
    selectedAccountId,
    selectedTarget,
    selectedOrgId,
    isLoading,
  } = useLinkedInSocialConnection();

  const [firstComment, setFirstComment] = useState('');
  const [moveLinksEnabled, setMoveLinksEnabled] = useState(true);

  useEffect(() => {
    if (!moveLinksEnabled) return;
    setFirstComment((prev) => {
      if (prev.trim()) return prev;
      const applied = applyLinkInFirstComment(draft, '', true);
      return applied.firstComment;
    });
  }, [draft, moveLinksEnabled]);

  const previewPayload = useMemo(
    () => buildPublishPayload(draft, firstComment, moveLinksEnabled),
    [draft, firstComment, moveLinksEnabled]
  );

  const canPublish = connected && !!previewPayload.content.trim();
  const connectionLabel = connected
    ? `Connected via ${provider}`
    : 'Not connected — connect LinkedIn to publish';

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
            {selectedTarget === 'organization' && selectedOrgId ? ` (${selectedOrgId})` : ''}
          </>
        )}
      </Typography>

      <FormControlLabel
        control={
          <Checkbox
            size="small"
            checked={moveLinksEnabled}
            onChange={(e) => setMoveLinksEnabled(e.target.checked)}
          />
        }
        label={
          <Typography variant="body2" sx={{ color: '#334155' }}>
            Move links from post to first comment (recommended for reach)
          </Typography>
        }
        sx={{ mb: 1 }}
      />

      <TextField
        fullWidth
        size="small"
        label="Link to include in first comment"
        placeholder="https://example.com/your-article"
        value={firstComment}
        onChange={(e) => setFirstComment(e.target.value)}
        helperText="Zernio posts links in the first comment to avoid LinkedIn reach penalties on link posts."
        sx={{ mb: 1.5, bgcolor: '#fff' }}
      />

      <Tooltip title="Publishing ships in Phase 2 — payload is prepared with first_comment">
        <span>
          <Button
            variant="contained"
            disabled={!canPublish}
            sx={{ bgcolor: '#0A66C2', '&:hover': { bgcolor: '#004182' } }}
          >
            Publish to LinkedIn
          </Button>
        </span>
      </Tooltip>
    </Box>
  );
};

export default PublishLinkedInPanel;
