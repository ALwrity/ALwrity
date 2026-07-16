/**
 * Publish-only plain-text preview — shows what LinkedIn will actually receive.
 * Renders paragraph gaps like the LinkedIn feed (blank line between blocks).
 */

import React, { useMemo } from 'react';
import { Alert, Box, Typography } from '@mui/material';
import {
  LINKEDIN_PUBLISH_PLAIN_NOTE,
} from '../utils/linkedInPostFormatConstants';
import {
  formatCharCountLabel,
  getCharReadiness,
  getPublishPlainText,
  getSeeMoreCaption,
} from '../utils/linkedInPublishReadiness';
import { LinkedInAuthenticatedImage } from './LinkedInAuthenticatedImage';
import type { LinkedInPublishMediaAttachment } from '../utils/linkedInPublishMediaUtils';

export interface LinkedInPublishPreviewPlainProps {
  /** Draft markdown or already-plain content; always normalized via formatDraftForPublish. */
  draft: string;
  /** Optional precomputed plain text (e.g. editable modal content). */
  plainText?: string;
  attachment?: LinkedInPublishMediaAttachment | null;
  compact?: boolean;
  title?: string;
}

function resolvePreviewImage(
  attachment: LinkedInPublishMediaAttachment | null | undefined,
): { kind: 'ai'; imageId: string; alt: string } | { kind: 'upload'; url: string; alt: string } | null {
  if (!attachment) return null;
  if (attachment.source === 'ai') {
    return { kind: 'ai', imageId: attachment.imageId, alt: attachment.alt || 'Post image' };
  }
  return {
    kind: 'upload',
    url: attachment.previewUrl,
    alt: attachment.fileName || 'Post image',
  };
}

export const LinkedInPublishPreviewPlain: React.FC<LinkedInPublishPreviewPlainProps> = ({
  draft,
  plainText,
  attachment = null,
  compact = false,
  title = 'What LinkedIn will see',
}) => {
  const text = (plainText ?? getPublishPlainText(draft)).trim();
  const chars = getCharReadiness(text);
  const seeMoreCaption = getSeeMoreCaption(chars);
  const image = resolvePreviewImage(attachment);

  const paragraphs = useMemo(
    () => (text ? text.split(/\n\n+/).map((p) => p.trim()).filter(Boolean) : []),
    [text],
  );

  return (
    <Box
      sx={{
        border: '1px solid #e2e8f0',
        borderRadius: 2,
        bgcolor: '#fff',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          px: compact ? 1.25 : 1.5,
          py: 1,
          borderBottom: '1px solid #e2e8f0',
          bgcolor: '#f8fafc',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
        }}
      >
        <Typography
          variant="caption"
          sx={{
            fontWeight: 700,
            color: '#475569',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}
        >
          {title}
        </Typography>
        <Typography
          variant="caption"
          sx={{
            color: chars.hardOk ? '#64748b' : '#dc2626',
            fontWeight: 600,
            whiteSpace: 'nowrap',
          }}
        >
          {formatCharCountLabel(chars.count)}
        </Typography>
      </Box>

      <Box
        sx={{
          p: compact ? 1.25 : 1.75,
          maxHeight: compact ? 280 : 480,
          overflow: 'auto',
        }}
      >
        {paragraphs.length > 0 ? (
          <Box
            sx={{
              fontFamily:
                '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
              fontSize: compact ? 14 : 15,
              lineHeight: 1.45,
              color: '#191919',
            }}
          >
            {paragraphs.map((paragraph, index) => (
              <Typography
                key={`p-${index}`}
                component="p"
                sx={{
                  m: 0,
                  mb: index === paragraphs.length - 1 ? 0 : compact ? 1.5 : 1.75,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  fontSize: 'inherit',
                  lineHeight: 'inherit',
                  color: 'inherit',
                  fontFamily: 'inherit',
                }}
              >
                {paragraph}
              </Typography>
            ))}
          </Box>
        ) : (
          <Typography variant="body2" sx={{ color: '#94a3b8', fontStyle: 'italic' }}>
            Nothing to preview yet. Add post text first.
          </Typography>
        )}

        {image && (
          <Box
            sx={{
              mt: 1.5,
              borderRadius: 1.5,
              overflow: 'hidden',
              border: '1px solid #e2e8f0',
              maxWidth: compact ? 200 : 280,
              '& img': {
                width: '100%',
                height: 'auto',
                maxHeight: compact ? 120 : 160,
                objectFit: 'cover',
                display: 'block',
                margin: '0 !important',
                borderRadius: 0,
              },
            }}
          >
            {image.kind === 'ai' ? (
              <LinkedInAuthenticatedImage imageId={image.imageId} alt={image.alt} />
            ) : (
              <img src={image.url} alt={image.alt} />
            )}
          </Box>
        )}

        {seeMoreCaption && (
          <Alert severity="warning" sx={{ mt: 1.25, py: 0, fontSize: 12 }}>
            {seeMoreCaption}
          </Alert>
        )}

        <Typography
          variant="caption"
          sx={{ color: '#64748b', display: 'block', mt: 1.25, lineHeight: 1.4 }}
        >
          {LINKEDIN_PUBLISH_PLAIN_NOTE}
        </Typography>
      </Box>
    </Box>
  );
};
